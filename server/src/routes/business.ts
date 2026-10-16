import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Core } from '../core'
import { actions, fundApplication } from '../service'
import { HttpError, bad, notFound } from '../errors'
import { identityProviderStatus } from '../integrations/identity-providers'

export interface BusinessOptions {
  ollamaKey?: string
  ollamaBase?: string
}

export function businessRoutes(app: FastifyInstance, core: Core, opt: BusinessOptions) {
  const { db } = core

  app.get('/api/health', async () => ({ ok: true, dev: !!core.opt.devAutologin, identity: identityProviderStatus() }))

  app.get('/api/state', async (req) => {
    const a = await core.auth(req)
    const since = Number((req.query as { since?: string }).since)
    if (since === core.version()) return { version: since, unchanged: true }
    return core.snapshot(a)
  })

  app.post('/api/actions/:name', async (req) => {
    const a = await core.auth(req)
    const name = (req.params as { name: string }).name
    const fn = Object.hasOwn(actions, name) ? actions[name] : undefined
    if (!fn) throw notFound(`Không có hành động ${name}`)
    core.authorize(a, name)
    const args = (req.body as { args?: unknown[] } | undefined)?.args ?? []
    if (!Array.isArray(args)) throw bad('args phải là mảng')
    if (name === 'submitKyc') {
      // giấy tờ phải là tệp của chính tổ chức
      const keys = (args[0] as { documentKeys?: unknown } | undefined)?.documentKeys
      for (const k of Array.isArray(keys) ? keys : []) if (typeof k !== 'string' || !(await db.fileOf(k, a.activeOrgId))) throw bad('Giấy tờ chưa được tải lên bởi tổ chức này')
    }
    const result = await core.mutate({ kind: 'user', user: a, correlationId: req.id }, (c) => fn(c, ...args))
    return { result: result ?? null, ...core.snapshot(a) }
  })

  // ---------------- webhook của tổ chức tài chính ----------------
  // Mỗi tổ chức tài chính có khóa riêng (POST /api/webhook-secret). Chữ ký HMAC-SHA256(khóa, thân thô) ở header
  // x-fcc-signature, định danh tổ chức ở x-fcc-org, x-idempotency-key chống xử lý lặp.
  app.post('/api/webhook-secret', async (req) => {
    const a = await core.auth(req)
    core.authorize(a, 'upsertProduct') // owner hoặc quản lý sản phẩm của tổ chức tài chính
    const org = core.getState().orgs.find((o) => o.id === a.activeOrgId)
    if (org?.type !== 'lender' || !org.verified) throw new HttpError(403, 'Chỉ tổ chức tài chính đã được FCC xác minh mới có khóa webhook')
    const secret = randomBytes(32).toString('hex')
    await db.setWebhookSecret(org.id, secret)
    return { orgId: org.id, secret, note: 'Chỉ hiển thị một lần; tạo mới sẽ vô hiệu khóa cũ.' }
  })

  app.post('/api/webhooks/funding', async (req, reply) => {
    const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? ''
    const orgId = String(req.headers['x-fcc-org'] ?? '')
    const secret = await db.getWebhookSecret(orgId)
    const sig = String(req.headers['x-fcc-signature'] ?? '')
    const expect = createHmac('sha256', secret ?? randomBytes(32)).update(raw).digest('hex')
    if (!secret || sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) throw new HttpError(401, 'Chữ ký không hợp lệ')
    const key = `${orgId}:${String(req.headers['x-idempotency-key'] ?? '')}`
    if (key.endsWith(':')) throw bad('Thiếu x-idempotency-key')
    const prior = await db.getIdempotent(key)
    if (prior) return reply.header('x-idempotent-replay', 'true').send(JSON.parse(prior))
    const { applicationId } = (req.body ?? {}) as { applicationId?: string }
    const ap = core.getState().applications.find((x) => x.id === applicationId)
    if (!ap || ap.lenderId !== orgId) throw notFound('Không tìm thấy hồ sơ của tổ chức này')
    const changed = await core.mutate({ kind: 'system', orgId, label: 'webhook', correlationId: req.id }, (c) => fundApplication(c, ap, 'webhook của tổ chức tài chính'))
    const body = { ok: true, applicationId, changed }
    await db.putIdempotent(key, JSON.stringify(body))
    return body
  })

  // ---------------- proxy AI (khóa API chỉ nằm ở máy chủ) ----------------
  app.post('/api/ollama/:path', async (req, reply) => {
    await core.auth(req)
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
}
