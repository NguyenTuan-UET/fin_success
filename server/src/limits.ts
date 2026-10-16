// Giới hạn tần suất theo địa chỉ khách (bộ nhớ, cửa sổ trượt 1 phút) và tiêu đề bảo mật. Địa chỉ chỉ nằm trong bộ nhớ, không ghi log.
import type { FastifyInstance } from 'fastify'

export interface RateLimitOptions {
  /** Số yêu cầu / phút / địa chỉ cho API nói chung */
  perMinute: number
  /** Số yêu cầu / phút / địa chỉ cho đăng nhập, đăng ký, quên mật khẩu, MFA */
  authPerMinute: number
}
export const DEFAULT_RATE_LIMIT: RateLimitOptions = { perMinute: 600, authPerMinute: 30 }

export function installLimits(app: FastifyInstance, rl: RateLimitOptions | false, now: () => number = Date.now) {
  const hits = new Map<string, number[]>()
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff')
    reply.header('referrer-policy', 'no-referrer')
    reply.header('x-frame-options', 'DENY')
    reply.header('cache-control', 'no-store') // phản hồi API chứa dữ liệu doanh nghiệp: không để trình duyệt/proxy lưu
  })
  if (!rl) return
  const timer = setInterval(() => {
    const cut = now() - 60_000
    for (const [k, v] of hits) if (!v.some((t) => t > cut)) hits.delete(k)
  }, 60_000)
  timer.unref()
  app.addHook('onClose', async () => clearInterval(timer))
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0]
    if (!path.startsWith('/api/') && !path.startsWith('/v1/')) return
    const auth = /^\/api\/(auth\/(login|register|forgot|reset|mfa)|invite)/.test(path)
    const limit = auth ? rl.authPerMinute : rl.perMinute
    const key = `${auth ? 'a' : 'g'}:${req.ip}`
    const t = now()
    const list = (hits.get(key) ?? []).filter((x) => x > t - 60_000)
    if (list.length >= limit) {
      hits.set(key, list)
      return reply.code(429).header('retry-after', '30').send({ error: 'Quá nhiều yêu cầu, thử lại sau ít phút' })
    }
    list.push(t)
    hits.set(key, list)
  })
}
