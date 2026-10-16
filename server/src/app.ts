import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { Database, type State } from './state'
import { ObjectStore } from './storage'
import { createCore, uid, type Core } from './core'
import { runSweep, type Ctx } from './service'
import { hashPassword } from './auth/password'
import { HttpError } from './errors'
import { authRoutes } from './routes/auth'
import { orgRoutes } from './routes/org'
import { businessRoutes } from './routes/business'
import { v1Routes } from './routes/v1'
import { ensureDefaultScorecard } from './assessments'
import { deliverWebhooks } from './integrations/partner'

export interface AppOptions {
  /** Chuỗi kết nối PostgreSQL */
  dbUrl: string
  /** Schema dùng cho ứng dụng (mặc định public); kiểm thử dùng schema riêng cho mỗi lần chạy */
  dbSchema?: string
  listedDir: string
  /** Thư mục kho tệp (đã mã hóa) */
  filesDir?: string
  /** Khóa dữ liệu 64 ký tự hex: mã hóa tệp và secret MFA */
  dataKey: string
  /** Địa chỉ giao diện, dùng trong liên kết email */
  appUrl?: string
  /** Tài khoản quản trị FCC tạo khi khởi động nếu chưa có */
  admin?: { email: string; password: string }
  /** Chế độ dev (chỉ chạy trên localhost): mỗi bên có trang riêng tự đăng nhập, bỏ MFA, tự công bố sản phẩm */
  devAutologin?: boolean
  ollamaKey?: string
  ollamaBase?: string
  now?: () => Date
}

export type FccApp = FastifyInstance & { db: Database; core: Core; sweep: () => Promise<void>; getState: () => State; deliverWebhooks: () => Promise<unknown>; routes: { method: string; url: string }[] }

export async function buildApp(opt: AppOptions): Promise<FccApp> {
  const db = await Database.open(opt.dbUrl, opt.dbSchema)
  const dataKey = Buffer.from(opt.dataKey, 'hex')
  const files = new ObjectStore(opt.filesDir ?? 'data/objects', opt.dataKey)
  const core = createCore(db, files, dataKey, await db.load(), {
    listedDir: opt.listedDir, devAutologin: opt.devAutologin, now: opt.now, appUrl: opt.appUrl ?? 'http://localhost:3000',
  })

  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info', redact: ['req.headers.authorization', 'req.headers["x-fcc-signature"]'] },
    bodyLimit: 25 * 1024 * 1024,
    genReqId: (req) => String(req.headers['x-request-id'] ?? '').slice(0, 64) || randomUUID(),
  })
  const routes: { method: string; url: string }[] = []
  app.addHook('onRoute', (r) => {
    for (const m of [r.method].flat()) if (m !== 'HEAD') routes.push({ method: m, url: r.url })
  })
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id)
  })

  // giữ nguyên thân thô để kiểm tra chữ ký webhook
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as FastifyRequest & { rawBody?: string }).rawBody = body as string
    try {
      done(null, body ? JSON.parse(body as string) : {})
    } catch {
      done(new HttpError(400, 'JSON không hợp lệ'), undefined)
    }
  })

  app.setErrorHandler((err, req, reply) => {
    // /v1: dữ liệu không hợp lệ trả 422 (SPEC mục 13); /api giữ 400 cho giao diện cũ
    const status = err instanceof HttpError && err.status === 400 && req.url.startsWith('/v1/') ? 422 : err instanceof HttpError ? err.status : 0
    if (err instanceof HttpError) return reply.code(status).send({ error: err.message, ...((err as { mfaRequired?: boolean }).mfaRequired ? { mfaRequired: true } : {}) })
    const e = err as { statusCode?: number; message: string }
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: e.message })
    req.log.error(err)
    return reply.code(500).send({ error: 'Lỗi máy chủ', requestId: req.id })
  })

  await ensureDefaultScorecard(db)
  const { openSession } = authRoutes(app, core)
  orgRoutes(app, core, openSession)
  businessRoutes(app, core, { ollamaKey: opt.ollamaKey, ollamaBase: opt.ollamaBase })
  v1Routes(app, core)

  // ---------------- khởi tạo ----------------
  if (opt.admin) {
    const email = opt.admin.email.toLowerCase()
    if (!(await db.userByEmail(email))) {
      const draft: State = { ...core.getState() }
      let fcc = draft.orgs.find((o) => o.type === 'fcc')
      if (!fcc) {
        const now = core.clock()
        fcc = { id: uid('f'), name: 'Vận hành nền tảng FCC', shortName: 'FCC', taxCode: 'FCC-OPS', type: 'fcc', vsic: '6399', industryLabel: 'Vận hành nền tảng', industryGroup: 'tech', foundedYear: now.getFullYear(), employees: 0, province: '—', createdAt: now.toISOString() }
        draft.orgs = [...draft.orgs, fcc]
        await core.commit(draft)
      }
      await db.createUser({ id: uid('u'), email, passwordHash: hashPassword(opt.admin.password), orgId: fcc.id, name: 'Quản trị FCC', title: 'Thẩm định & vận hành', role: 'fcc_admin' })
    }
  } else if (!opt.devAutologin && !core.getState().orgs.some((o) => o.type === 'fcc')) {
    app.log.warn('Chưa có tài khoản nhân sự FCC (đặt ADMIN_EMAIL và ADMIN_PASSWORD): chưa ai xác minh được tổ chức tài chính hay thẩm định ESG')
  }

  // ---------------- tác vụ định kỳ ----------------
  const sweep = () =>
    core.serial(async () => {
      try {
        await db.purgeSessions()
        const st = core.getState()
        if (!st.orgs.length) return
        const draft: State = { ...st }
        // tác nhân hệ thống; nhật ký ghi "Hệ thống"
        const ctx: Ctx = { s: draft, now: core.clock(), listedDir: opt.listedDir, autoApprove: !!opt.devAutologin, actor: { ...st.orgs[0], id: 'system', shortName: 'Hệ thống' }, role: 'system', authMethod: 'system', events: [] }
        if (runSweep(ctx) > 0) await core.commitWithEvents(draft, ctx.events ?? [])
      } catch (e) {
        app.log.error(e, 'sweep failed')
      }
    })
  const timer = setInterval(() => void sweep(), 60_000)
  timer.unref()
  // gửi webhook tới đối tác (có thử lại); kiểm thử gọi trực tiếp app.deliverWebhooks()
  const deliver = () => deliverWebhooks(db, core.clock).catch((e) => app.log.error(e, 'webhook delivery failed'))
  const hookTimer = process.env.NODE_ENV === 'test' ? undefined : setInterval(() => void deliver(), 5_000)
  hookTimer?.unref()
  app.addHook('onClose', async () => {
    clearInterval(timer)
    if (hookTimer) clearInterval(hookTimer)
    await core.serial(async () => undefined)
    await db.close()
  })

  return Object.assign(app, { db, core, sweep, getState: () => core.getState(), deliverWebhooks: deliver, routes }) as FccApp
}
