import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { Database, type State } from './state'
import { actions, fundApplication, runSweep, type Ctx, type OtpProof, type Role } from './service'
import { viewFor } from './views'
import { HttpError, bad, forbidden, notFound, conflict } from './errors'

export interface AppOptions {
  dbPath: string
  demo: boolean
  webhookSecret: string
  listedDir: string
  ollamaKey?: string
  ollamaBase?: string
  now?: () => Date
}

const SESSION_TTL = 12 * 3600_000
const OTP_TTL = 5 * 60_000
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export function buildApp(opt: AppOptions): FastifyInstance & { db: Database; sweep: () => void; getState: () => State } {
  const db = new Database(opt.dbPath)
  let state = db.load()
  let version = 1 // tăng sau mỗi thay đổi; trình duyệt dùng để hỏi “có gì mới không” mà không tải lại toàn bộ
  const clock = opt.now ?? (() => new Date())
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : { level: 'info', redact: ['req.headers.authorization'] }, bodyLimit: 25 * 1024 * 1024 })

  // giữ nguyên thân thô để kiểm tra chữ ký webhook
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as FastifyRequest & { rawBody?: string }).rawBody = body as string
    try {
      done(null, body ? JSON.parse(body as string) : {})
    } catch {
      done(new HttpError(400, 'JSON không hợp lệ'), undefined)
    }
  })

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message })
    const e = err as { statusCode?: number; message: string }
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: e.message })
    app.log.error(err)
    return reply.code(500).send({ error: 'Lỗi máy chủ' })
  })

  function auth(req: FastifyRequest): { orgId: string; role: Role; token: string } {
    const h = req.headers.authorization
    const token = h?.startsWith('Bearer ') ? h.slice(7) : ''
    const s = token ? db.getSession(token) : undefined
    if (!s) throw new HttpError(401, 'Chưa đăng nhập hoặc phiên đã hết hạn')
    return { orgId: s.orgId, role: s.role as Role, token }
  }

  function makeCtx(draft: State, orgId: string, role: Role): Ctx {
    const actor = draft.orgs.find((o) => o.id === orgId)
    if (!actor) throw new HttpError(401, 'Tổ chức không tồn tại')
    return {
      actor, role, s: draft, now: clock(), demo: opt.demo, listedDir: opt.listedDir,
      checkOtp: (purpose, entity, proof) => verifyOtp(orgId, purpose, entity, proof),
    }
  }

  function verifyOtp(orgId: string, purpose: string, entity: string, proof: OtpProof | undefined) {
    if (!proof?.id || !proof.code) throw new HttpError(401, 'Cần mã OTP xác thực')
    const o = db.getOtp(proof.id)
    if (!o || o.orgId !== orgId || o.purpose !== purpose || o.entity !== entity) throw new HttpError(401, 'OTP không hợp lệ cho thao tác này')
    if (o.used) throw new HttpError(401, 'OTP đã được sử dụng')
    if (o.expiresAt < clock().toISOString()) throw new HttpError(401, 'OTP đã hết hạn')
    if (o.attempts >= 5) throw new HttpError(429, 'Nhập sai OTP quá số lần cho phép')
    const ok = timingSafeEqual(Buffer.from(sha(`${proof.id}:${proof.code}`)), Buffer.from(o.codeHash))
    db.bumpOtp(o.id, ok)
    if (!ok) throw new HttpError(401, 'Mã OTP không đúng')
  }

  /** Chạy một hàm trên bản nháp, chỉ chốt (ghi DB) khi không lỗi. Đồng bộ nên không có xen kẽ giữa các yêu cầu. */
  function mutate<T>(orgId: string, role: Role, fn: (c: Ctx) => T): T {
    const draft: State = { ...state }
    const result = fn(makeCtx(draft, orgId, role))
    db.save(draft)
    state = draft
    version++
    return result
  }

  // ---------------- công khai ----------------
  app.get('/api/health', async () => ({ ok: true, demo: opt.demo, seededAt: state.seededAt }))

  app.post('/api/auth/demo-login', async (req) => {
    if (!opt.demo) throw notFound('Đăng nhập mẫu đã tắt')
    const b = (req.body ?? {}) as { orgId?: string; reviewer?: boolean }
    const org = state.orgs.find((o) => o.id === b.orgId)
    if (!org) throw bad('Tổ chức không tồn tại')
    const role: Role = b.reviewer && org.type === 'supplier' ? 'fcc_reviewer' : 'member'
    const token = randomBytes(24).toString('hex')
    db.createSession(token, org.id, role, SESSION_TTL)
    return { token, orgId: org.id, role }
  })

  // ---------------- cần đăng nhập ----------------
  app.post('/api/auth/logout', async (req) => {
    db.deleteSession(auth(req).token)
    return { ok: true }
  })

  app.get('/api/state', async (req) => {
    const a = auth(req)
    const since = Number((req.query as { since?: string }).since)
    if (since === version) return { version, unchanged: true }
    return { version, role: a.role, state: viewFor(state, a.orgId, clock()) }
  })

  app.post('/api/actions/:name', async (req) => {
    const a = auth(req)
    const name = (req.params as { name: string }).name
    const fn = Object.hasOwn(actions, name) ? actions[name] : undefined
    if (!fn) throw notFound(`Không có hành động ${name}`)
    const args = (req.body as { args?: unknown[] } | undefined)?.args ?? []
    if (!Array.isArray(args)) throw bad('args phải là mảng')
    const result = mutate(a.orgId, a.role, (c) => fn(c, ...args))
    return { result: result ?? null, version, state: viewFor(state, a.orgId, clock()) }
  })

  app.post('/api/otp', async (req) => {
    const a = auth(req)
    const { purpose, entity } = (req.body ?? {}) as { purpose?: string; entity?: string }
    if (purpose === 'buyer_confirm') {
      const r = state.receivables.find((x) => `${x.id}@v${x.version}` === entity)
      if (!r || r.buyerId !== a.orgId) throw forbidden()
      if (r.state !== 'BUYER_PENDING') throw conflict('Khoản phải thu không ở trạng thái chờ bên mua xác nhận')
    } else if (purpose === 'accept_offer') {
      const ap = state.applications.find((x) => x.id === entity)
      const r = ap && state.receivables.find((x) => x.id === ap.receivableId)
      if (!ap || !r || r.sellerId !== a.orgId) throw forbidden()
      if (ap.state !== 'OFFERED') throw conflict('Hồ sơ không ở trạng thái chờ chấp thuận')
    } else throw bad('Mục đích OTP không hợp lệ')
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const id = `OTP-${randomBytes(6).toString('hex')}`
    db.createOtp(id, a.orgId, purpose, entity!, sha(`${id}:${code}`), OTP_TTL)
    // Chưa tích hợp kênh SMS/email: ở chế độ demo trả mã trong phản hồi; thực tế gửi qua nhà cung cấp OTP.
    app.log.info({ otpId: id, purpose }, 'OTP issued')
    return { otpId: id, expiresInSec: OTP_TTL / 1000, ...(opt.demo ? { demoCode: code } : {}) }
  })

  app.post('/api/admin/reset', async (req) => {
    const a = auth(req)
    if (!opt.demo) throw forbidden()
    const draft: State = db.reset()
    state = draft
    version++
    return { version, state: viewFor(state, a.orgId, clock()) }
  })

  // ---------------- webhook của tổ chức tài chính ----------------
  // Tổ chức tài chính gọi khi đã giải ngân. Chữ ký HMAC-SHA256(secret, thân thô) ở header x-fcc-signature;
  // x-idempotency-key chống xử lý lặp.
  app.post('/api/webhooks/funding', async (req, reply) => {
    const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? ''
    const sig = String(req.headers['x-fcc-signature'] ?? '')
    const expect = createHmac('sha256', opt.webhookSecret).update(raw).digest('hex')
    if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) throw new HttpError(401, 'Chữ ký không hợp lệ')
    const key = String(req.headers['x-idempotency-key'] ?? '')
    if (!key) throw bad('Thiếu x-idempotency-key')
    const prior = db.getIdempotent(key)
    if (prior) return reply.header('x-idempotent-replay', 'true').send(JSON.parse(prior))
    const { applicationId } = (req.body ?? {}) as { applicationId?: string }
    const ap = state.applications.find((x) => x.id === applicationId)
    if (!ap) throw notFound('Không tìm thấy hồ sơ')
    const changed = mutate(ap.lenderId, 'member', (c) => fundApplication(c, ap, 'webhook của tổ chức tài chính'))
    const body = { ok: true, applicationId, changed }
    db.putIdempotent(key, JSON.stringify(body))
    return body
  })

  // ---------------- proxy AI (khóa API chỉ nằm ở máy chủ) ----------------
  app.post('/api/ollama/:path', async (req, reply) => {
    auth(req)
    const path = (req.params as { path: string }).path
    if (path !== 'chat') throw notFound('Không hỗ trợ')
    if (!opt.ollamaKey) return reply.code(503).send({ error: 'Máy chủ chưa cấu hình OLLAMA_API_KEY' })
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 180_000)
    try {
      const res = await fetch(`${opt.ollamaBase ?? 'https://ollama.com'}/api/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opt.ollamaKey}` }, body: JSON.stringify(req.body), signal: ctl.signal,
      })
      return reply.code(res.status).type('application/json').send(await res.text())
    } catch (e) {
      return reply.code(502).send({ error: ctl.signal.aborted ? 'Dịch vụ AI quá thời gian' : `Không kết nối được dịch vụ AI: ${(e as Error).message}` })
    } finally {
      clearTimeout(t)
    }
  })

  // ---------------- tác vụ định kỳ ----------------
  const sweep = () => {
    try {
      const draft: State = { ...state }
      const ctx = makeCtx(draft, draft.orgs[0].id, 'member')
      ctx.actor = { ...ctx.actor, id: 'system', shortName: 'Hệ thống' } // nhật ký ghi tác nhân là hệ thống
      if (runSweep(ctx) > 0) {
        db.save(draft)
        state = draft
        version++
      }
    } catch (e) {
      app.log.error(e, 'sweep failed')
    }
  }
  const timer = setInterval(sweep, 60_000)
  timer.unref()
  app.addHook('onClose', async () => {
    clearInterval(timer)
    db.close()
  })

  return Object.assign(app, { db, sweep, getState: () => state })
}

