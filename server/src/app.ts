import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { Database, type State, type UserRow } from './state'
import { actions, fundApplication, runSweep, type Ctx, type Role } from './service'
import { viewFor } from './views'
import { FailureLimiter, hashPassword, hashToken, newToken, verifyPassword } from './auth'
import { HttpError, bad, notFound } from './errors'
import type { IndustryGroup, Org, OrgType } from '../../web-legacy/src/domain/types'

export interface AppOptions {
  dbPath: string
  listedDir: string
  /** Tài khoản nhân sự FCC (thẩm định ESG, duyệt sản phẩm, xác minh tổ chức tài chính) tạo khi khởi động nếu chưa có */
  admin?: { email: string; password: string }
  /** Chế độ dev (chỉ chạy trên localhost): mỗi bên có trang riêng tự đăng nhập, bỏ nhập lại mật khẩu, tự công bố sản phẩm */
  devAutologin?: boolean
  ollamaKey?: string
  ollamaBase?: string
  now?: () => Date
}

const DEV_DOMAIN = '@dev.local'
const SESSION_TTL = 12 * 3600_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const uid = (p: string) => `${p}-${randomBytes(5).toString('hex')}`

export function buildApp(opt: AppOptions): FastifyInstance & { db: Database; sweep: () => void; getState: () => State } {
  const db = new Database(opt.dbPath)
  let state = db.load()
  let version = 1 // tăng sau mỗi thay đổi; trình duyệt dùng để hỏi “có gì mới không” mà không tải lại toàn bộ
  const clock = opt.now ?? (() => new Date())
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : { level: 'info', redact: ['req.headers.authorization'] }, bodyLimit: 25 * 1024 * 1024 })
  const loginLimit = new FailureLimiter(5, 15 * 60_000)
  const reauthLimit = new FailureLimiter(5, 15 * 60_000)
  const registerLimit = new FailureLimiter(10, 60 * 60_000)

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

  type Authed = Omit<UserRow, 'passwordHash'>
  function auth(req: FastifyRequest): { user: Authed; token: string } {
    const h = req.headers.authorization
    const token = h?.startsWith('Bearer ') ? h.slice(7) : ''
    const user = token ? db.sessionUser(hashToken(token)) : undefined
    if (!user) throw new HttpError(401, 'Chưa đăng nhập hoặc phiên đã hết hạn')
    return { user, token }
  }

  function makeCtx(draft: State, user: Authed | { orgId: string; id: string; role: string }): Ctx {
    const actor = draft.orgs.find((o) => o.id === user.orgId)
    if (!actor) throw new HttpError(401, 'Tổ chức không tồn tại')
    return {
      actor, role: user.role as Role, s: draft, now: clock(), listedDir: opt.listedDir, autoApprove: !!opt.devAutologin,
      checkPassword: (password) => {
        if (opt.devAutologin && actor.type !== 'fcc' && 'email' in user && String(user.email).endsWith(DEV_DOMAIN)) return // chế độ dev: tài khoản dev không có mật khẩu
        const key = `u:${user.id}`
        if (reauthLimit.blocked(key)) throw new HttpError(429, 'Nhập sai mật khẩu quá nhiều lần, thử lại sau 15 phút')
        const row = db.userById(user.id)
        if (!password || !row || !verifyPassword(password, row.passwordHash)) {
          reauthLimit.fail(key)
          throw new HttpError(401, 'Mật khẩu xác thực không đúng')
        }
        reauthLimit.clear(key)
      },
    }
  }

  /** Chạy một hàm trên bản nháp, chỉ chốt (ghi DB) khi không lỗi. Đồng bộ nên không có xen kẽ giữa các yêu cầu. */
  function mutate<T>(user: Authed | { orgId: string; id: string; role: string }, fn: (c: Ctx) => T): T {
    const draft: State = { ...state }
    const result = fn(makeCtx(draft, user))
    db.save(draft)
    state = draft
    version++
    return result
  }

  const me = (u: Authed) => ({ id: u.id, email: u.email, name: u.name, title: u.title, role: u.role, orgId: u.orgId })
  const snapshot = (u: Authed) => ({ version, me: me(u), state: viewFor(state, u.orgId, clock()) })

  // ---------------- tài khoản ----------------
  const INDUSTRY: IndustryGroup[] = ['manufacturing', 'trade', 'agri', 'tech']
  const str = (v: unknown, label: string, max = 200) => {
    if (typeof v !== 'string' || !v.trim()) throw bad(`Thiếu ${label}`)
    if (v.length > max) throw bad(`${label} quá dài`)
    return v.trim()
  }

  app.post('/api/auth/register', async (req, reply) => {
    const ip = req.ip
    if (registerLimit.blocked(ip)) throw new HttpError(429, 'Đăng ký quá nhiều lần, thử lại sau')
    registerLimit.fail(ip)
    const b = (req.body ?? {}) as { email?: string; password?: string; name?: string; title?: string; org?: Record<string, unknown> }
    const email = str(b.email, 'email', 120).toLowerCase()
    if (!EMAIL.test(email)) throw bad('Email không hợp lệ')
    if (typeof b.password !== 'string' || b.password.length < 10 || b.password.length > 200) throw bad('Mật khẩu tối thiểu 10 ký tự')
    const o = b.org ?? {}
    const type = o.type as OrgType
    if (!['buyer', 'supplier', 'lender'].includes(type)) throw bad('Loại tổ chức phải là bên mua, nhà cung cấp hoặc tổ chức tài chính')
    const taxCode = str(o.taxCode, 'mã số thuế', 20).replace(/[\s.]/g, '')
    if (!/^\d{10}(-?\d{3})?$/.test(taxCode)) throw bad('Mã số thuế phải gồm 10 hoặc 13 chữ số')
    const industryGroup = o.industryGroup as IndustryGroup
    if (!INDUSTRY.includes(industryGroup)) throw bad('Nhóm ngành không hợp lệ')
    const foundedYear = Number(o.foundedYear)
    const employees = Number(o.employees)
    if (!Number.isInteger(foundedYear) || foundedYear < 1900 || foundedYear > clock().getFullYear()) throw bad('Năm thành lập không hợp lệ')
    if (!Number.isInteger(employees) || employees < 0) throw bad('Số lao động không hợp lệ')
    const listedSymbol = type === 'buyer' && typeof o.listedSymbol === 'string' && o.listedSymbol.trim() ? o.listedSymbol.trim().toUpperCase() : undefined
    if (listedSymbol && !/^[A-Z0-9]{2,6}$/.test(listedSymbol)) throw bad('Mã chứng khoán không hợp lệ')
    if (db.userByEmail(email)) throw new HttpError(409, 'Email đã được đăng ký')
    if (state.orgs.some((x) => x.taxCode === taxCode)) throw new HttpError(409, 'Mã số thuế đã được đăng ký trên hệ thống')

    const org: Org = {
      id: uid(type[0]), name: str(o.name, 'tên tổ chức'), shortName: str(o.shortName ?? o.name, 'tên viết tắt', 40), taxCode, type,
      vsic: str(o.vsic, 'mã ngành VSIC', 8), industryLabel: str(o.industryLabel, 'ngành nghề'), industryGroup,
      listedSymbol, exchange: listedSymbol && ['HOSE', 'HNX', 'UPCOM'].includes(String(o.exchange)) ? (o.exchange as Org['exchange']) : undefined,
      foundedYear, employees, province: str(o.province, 'tỉnh/thành'), createdAt: clock().toISOString(), verified: type === 'lender' ? false : undefined,
    }
    const user = { id: uid('u'), email, passwordHash: hashPassword(b.password), orgId: org.id, name: str(b.name, 'họ tên', 80), title: str(b.title, 'chức danh', 80), role: 'member' }
    const draft: State = { ...state }
    draft.orgs = [...draft.orgs, org]
    draft.audit = [{ id: uid('EV'), at: clock().toISOString(), actorOrgId: org.id, action: 'Đăng ký tổ chức', entity: org.id, detail: `${org.name} (${type})` }, ...draft.audit]
    if (type === 'lender') {
      for (const f of draft.orgs.filter((x) => x.type === 'fcc')) {
        draft.notifications = [{ id: uid('N'), orgId: f.id, at: clock().toISOString(), title: 'Tổ chức tài chính mới chờ xác minh', body: `${org.name} (MST ${org.taxCode})`, link: '/admin', read: false }, ...draft.notifications]
      }
    }
    db.save(draft)
    db.createUser(user)
    state = draft
    version++
    const token = newToken()
    db.createSession(hashToken(token), user.id, SESSION_TTL)
    return reply.code(201).send({ token, ...snapshot({ ...user, passwordHash: undefined } as never) })
  })

  app.post('/api/auth/login', async (req) => {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string }
    const key = `${String(email).toLowerCase()}|${req.ip}`
    if (loginLimit.blocked(key)) throw new HttpError(429, 'Đăng nhập sai quá nhiều lần, thử lại sau 15 phút')
    const u = typeof email === 'string' ? db.userByEmail(email.toLowerCase()) : undefined
    // luôn băm một lần để thời gian phản hồi không lộ email nào tồn tại
    const ok = verifyPassword(typeof password === 'string' ? password : '', u?.passwordHash ?? hashPassword('dummy-password'))
    if (!u || !ok) {
      loginLimit.fail(key)
      throw new HttpError(401, 'Email hoặc mật khẩu không đúng')
    }
    loginLimit.clear(key)
    const token = newToken()
    db.createSession(hashToken(token), u.id, SESSION_TTL)
    return { token, ...snapshot(u) }
  })

  app.post('/api/auth/logout', async (req) => {
    db.deleteSession(hashToken(auth(req).token))
    return { ok: true }
  })

  // ---------------- dữ liệu & hành động ----------------
  app.get('/api/health', async () => ({ ok: true, dev: !!opt.devAutologin }))

  // Chế độ dev: tạo (nếu chưa có) tài khoản trống cho từng bên rồi cấp phiên — không có dữ liệu mẫu, chỉ có tổ chức/tài khoản rỗng.
  const DEV_ORGS: Record<string, { type: OrgType; name: string; tax: string; user: string }> = {
    supplier: { type: 'supplier', name: 'Nhà cung cấp (tài khoản dev)', tax: '1000000001', user: 'Nhà cung cấp' },
    buyer: { type: 'buyer', name: 'Bên mua (tài khoản dev)', tax: '1000000002', user: 'Bên mua' },
    lender: { type: 'lender', name: 'Tổ chức tài chính (tài khoản dev)', tax: '1000000003', user: 'Tổ chức tài chính' },
    fcc: { type: 'fcc', name: 'Vận hành nền tảng FCC (dev)', tax: 'FCC-OPS-DEV', user: 'Nhân sự FCC' },
  }
  app.post('/api/dev/session', async (req) => {
    if (!opt.devAutologin) throw notFound('Chế độ dev đã tắt')
    const role = String((req.body as { role?: string } | undefined)?.role)
    const d = Object.hasOwn(DEV_ORGS, role) ? DEV_ORGS[role] : undefined
    if (!d) throw bad('Bên không hợp lệ (supplier | buyer | lender | fcc)')
    const email = `${role}${DEV_DOMAIN}`
    let u = db.userByEmail(email)
    if (!u) {
      const draft: State = { ...state }
      let org = draft.orgs.find((o) => o.taxCode === d.tax)
      if (!org) {
        org = { id: uid(d.type[0]), name: d.name, shortName: d.user, taxCode: d.tax, type: d.type, vsic: '0000', industryLabel: 'Chưa khai báo', industryGroup: 'manufacturing', foundedYear: clock().getFullYear(), employees: 0, province: 'Chưa khai báo', createdAt: clock().toISOString(), verified: d.type === 'lender' ? true : undefined }
        draft.orgs = [...draft.orgs, org]
        db.save(draft)
        state = draft
        version++
      }
      db.createUser({ id: uid('u'), email, passwordHash: hashPassword(randomBytes(24).toString('hex')), orgId: org.id, name: d.user, title: 'Tài khoản dev', role: role === 'fcc' ? 'fcc_reviewer' : 'member' })
      u = db.userByEmail(email)!
    }
    const token = newToken()
    db.createSession(hashToken(token), u.id, SESSION_TTL)
    return { token, ...snapshot(u) }
  })

  app.get('/api/state', async (req) => {
    const { user } = auth(req)
    const since = Number((req.query as { since?: string }).since)
    if (since === version) return { version, unchanged: true }
    return snapshot(user)
  })

  app.post('/api/actions/:name', async (req) => {
    const { user } = auth(req)
    const name = (req.params as { name: string }).name
    const fn = Object.hasOwn(actions, name) ? actions[name] : undefined
    if (!fn) throw notFound(`Không có hành động ${name}`)
    const args = (req.body as { args?: unknown[] } | undefined)?.args ?? []
    if (!Array.isArray(args)) throw bad('args phải là mảng')
    const result = mutate(user, (c) => fn(c, ...args))
    return { result: result ?? null, ...snapshot(user) }
  })

  // ---------------- webhook của tổ chức tài chính ----------------
  // Mỗi tổ chức tài chính có khóa riêng (POST /api/webhook-secret). Chữ ký HMAC-SHA256(khóa, thân thô) ở header
  // x-fcc-signature, định danh tổ chức ở x-fcc-org, x-idempotency-key chống xử lý lặp.
  app.post('/api/webhook-secret', async (req) => {
    const { user } = auth(req)
    const org = state.orgs.find((o) => o.id === user.orgId)
    if (org?.type !== 'lender' || !org.verified) throw new HttpError(403, 'Chỉ tổ chức tài chính đã được FCC xác minh mới có khóa webhook')
    const secret = randomBytes(32).toString('hex')
    db.setWebhookSecret(org.id, secret)
    return { orgId: org.id, secret, note: 'Chỉ hiển thị một lần; tạo mới sẽ vô hiệu khóa cũ.' }
  })

  app.post('/api/webhooks/funding', async (req, reply) => {
    const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? ''
    const orgId = String(req.headers['x-fcc-org'] ?? '')
    const secret = db.getWebhookSecret(orgId)
    const sig = String(req.headers['x-fcc-signature'] ?? '')
    const expect = createHmac('sha256', secret ?? randomBytes(32)).update(raw).digest('hex')
    if (!secret || sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) throw new HttpError(401, 'Chữ ký không hợp lệ')
    const key = `${orgId}:${String(req.headers['x-idempotency-key'] ?? '')}`
    if (key.endsWith(':')) throw bad('Thiếu x-idempotency-key')
    const prior = db.getIdempotent(key)
    if (prior) return reply.header('x-idempotent-replay', 'true').send(JSON.parse(prior))
    const { applicationId } = (req.body ?? {}) as { applicationId?: string }
    const ap = state.applications.find((x) => x.id === applicationId)
    if (!ap || ap.lenderId !== orgId) throw notFound('Không tìm thấy hồ sơ của tổ chức này')
    const changed = mutate({ id: `webhook:${orgId}`, orgId, role: 'member' }, (c) => fundApplication(c, ap, 'webhook của tổ chức tài chính'))
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

  // ---------------- khởi tạo & tác vụ định kỳ ----------------
  if (opt.admin) {
    if (!db.userByEmail(opt.admin.email.toLowerCase())) {
      const draft: State = { ...state }
      let fcc = draft.orgs.find((o) => o.type === 'fcc')
      if (!fcc) {
        fcc = { id: uid('f'), name: 'Vận hành nền tảng FCC', shortName: 'FCC', taxCode: 'FCC-OPS', type: 'fcc', vsic: '6399', industryLabel: 'Vận hành nền tảng', industryGroup: 'tech', foundedYear: clock().getFullYear(), employees: 0, province: '—', createdAt: clock().toISOString() }
        draft.orgs = [...draft.orgs, fcc]
        db.save(draft)
        state = draft
      }
      db.createUser({ id: uid('u'), email: opt.admin.email.toLowerCase(), passwordHash: hashPassword(opt.admin.password), orgId: fcc.id, name: 'Quản trị FCC', title: 'Thẩm định & vận hành', role: 'fcc_reviewer' })
    }
  } else if (!state.orgs.some((o) => o.type === 'fcc')) {
    app.log.warn('Chưa có tài khoản nhân sự FCC (đặt ADMIN_EMAIL và ADMIN_PASSWORD): chưa ai xác minh được tổ chức tài chính hay thẩm định ESG')
  }

  const sweep = () => {
    try {
      db.purgeSessions()
      const draft: State = { ...state }
      const ctx = makeCtx(draft, { id: 'system', orgId: draft.orgs[0]?.id ?? '', role: 'member' })
      ctx.actor = { ...ctx.actor, id: 'system', shortName: 'Hệ thống' } // nhật ký ghi tác nhân là hệ thống
      if (runSweep(ctx) > 0) {
        db.save(draft)
        state = draft
        version++
      }
    } catch (e) {
      if (state.orgs.length) app.log.error(e, 'sweep failed')
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
