// Ngân hàng giả lập: nhận webhook từ FCC (đã ký), phản ứng theo hồ sơ hành vi, gọi lại FCC qua API đối tác với khóa tích hợp.
// Không đọc CSDL của FCC — chỉ dùng đúng bề mặt tích hợp mà ngân hàng thật sẽ dùng.
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { atLeast, PROFILES, type Profile, type Rating } from './profiles'
import { controlPage } from './control'

export interface InstitutionConfig {
  slug: string
  orgId: string
  name: string
  token: string
  signingSecret: string
}
export interface SimConfig {
  fccApiUrl: string
  institutions: InstitutionConfig[]
  /** Ghi đè thời gian giải ngân (giây) cho mọi tổ chức — kiểm thử đặt 0 */
  disburseDelaySec?: number
  /** Bật tự động cho từng tổ chức; tắt để người thật thao tác qua /lender trên FCC */
  auto?: Record<string, boolean>
}

/** Hành vi ép cho một hồ sơ/RFQ cụ thể (bảng điều khiển kịch bản). */
export type Behavior = 'auto' | 'approve' | 'reject' | 'decline_quote' | 'delay_disbursement' | 'hold'
export interface LogEntry {
  at: string
  slug: string
  kind: string
  detail: string
  ok: boolean
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const verify = (secret: string, header: string, body: string, now: number) => {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header)
  if (!m || Math.abs(Math.floor(now / 1000) - Number(m[1])) > 300) return false
  const expect = createHmac('sha256', secret).update(`${m[1]}.${body}`).digest('hex')
  return timingSafeEqual(Buffer.from(expect), Buffer.from(m[2]))
}
const sign = (secret: string, body: string, t: number) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
const isoDate = (d: Date) => d.toISOString().slice(0, 10)

export function createSimBank(cfg: SimConfig, deps: { fetch?: typeof fetch; now?: () => Date; schedule?: (fn: () => void, ms: number) => void } = {}) {
  const f = deps.fetch ?? fetch
  const now = deps.now ?? (() => new Date())
  const schedule = deps.schedule ?? ((fn, ms) => void setTimeout(fn, ms).unref())
  const bySlug = new Map(cfg.institutions.map((i) => [i.slug, i]))
  const overrides = new Map<string, Behavior>() // khóa: id hồ sơ hoặc RFQ
  const seen = new Set<string>() // id sự kiện đã xử lý
  const log: LogEntry[] = []
  const lastFunded = new Map<string, string>() // slug → thân sự kiện giải ngân gần nhất (để phát lại)
  const pending: Promise<unknown>[] = []

  const note = (slug: string, kind: string, detail: string, ok = true) => {
    log.unshift({ at: now().toISOString(), slug, kind, detail, ok })
    log.length = Math.min(log.length, 300)
  }
  const profileOf = (slug: string): Profile => PROFILES[slug]
  const isAuto = (slug: string) => cfg.auto?.[slug] !== false

  async function api(inst: InstitutionConfig, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await f(`${cfg.fccApiUrl}${path}`, {
      method, headers: { authorization: `Bearer ${inst.token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    })
    const text = await res.text()
    const json = text ? JSON.parse(text) : null
    if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status}: ${json?.error ?? text}`), { status: res.status })
    return json
  }

  /** Đăng các sản phẩm còn thiếu theo hồ sơ (FCC duyệt trước khi công bố). */
  async function ensureProducts(inst: InstitutionConfig) {
    const have: Json[] = await api(inst, 'GET', '/v1/partner/products')
    for (const p of profileOf(inst.slug).products) {
      if (have.some((x) => x.name === p.name)) continue
      const product = {
        name: p.name, type: p.type, description: p.description, status: 'pending_review',
        eligibility: { minAmount: p.minAmount, maxAmount: p.maxAmount, maxTenorDays: p.maxTenorDays, requireBuyerConfirmation: true, minApplicationRating: p.minApplicationRating, minBuyerRating: p.minBuyerRating },
        pricing: { advancePct: p.advancePct, rateMin: p.rateMin, rateMax: p.rateMax, fees: [{ name: 'Phí xử lý hồ sơ', kind: 'pct', value: p.feePct, upfront: true }], latePenaltyPct: 150 },
        ...(p.green ? { greenRule: p.green } : {}),
        sla: { quoteHours: 4, reviewHours: 24 }, effectiveFrom: isoDate(now()), effectiveTo: `${now().getFullYear() + 1}-12-31`,
      }
      await api(inst, 'POST', '/v1/partner/products', product)
      note(inst.slug, 'product', `Đăng sản phẩm “${p.name}” (chờ FCC duyệt)`)
    }
  }

  const rateFor = (inst: InstitutionConfig, productName: string | undefined, rating: Rating) => {
    const prof = profileOf(inst.slug)
    const p = prof.products.find((x) => x.name === productName) ?? prof.products[0]
    return { p, rate: Math.min(p.rateMax, Math.round((p.rateMin + prof.spread[rating]) * 100) / 100) }
  }

  async function onRfq(inst: InstitutionConfig, data: Json) {
    const page = await api(inst, 'GET', '/v1/partner/rfqs?limit=200')
    const rfq = page.items.find((q: Json) => q.id === data.rfqId)
    if (!rfq) return note(inst.slug, 'rfq', `Không thấy RFQ ${data.rfqId} trong gói được chia sẻ`, false)
    const rating: Rating = rfq.score?.rating ?? 'CCC'
    const products: Json[] = await api(inst, 'GET', '/v1/partner/products')
    for (const pid of data.productIds as string[]) {
      const prod = products.find((x) => x.id === pid)
      const forced = overrides.get(rfq.id)
      if (forced === 'hold') return note(inst.slug, 'rfq', `${rfq.id}: giữ lại theo kịch bản, chưa trả lời`)
      const decline = forced === 'decline_quote' || (forced !== 'approve' && !atLeast(rating, profileOf(inst.slug).minRating))
      if (decline) {
        await api(inst, 'POST', `/v1/partner/rfqs/${rfq.id}/responses`, { productId: pid, kind: 'decline', conditions: forced ? 'Từ chối theo kịch bản' : `Hạng hồ sơ ${rating} thấp hơn khẩu vị ${profileOf(inst.slug).minRating}` })
        note(inst.slug, 'rfq', `${rfq.id}: từ chối báo giá (hạng ${rating})`)
        continue
      }
      const { p, rate } = rateFor(inst, prod?.name, rating)
      const amount = rfq.receivable?.amount ?? 0
      await api(inst, 'POST', `/v1/partner/rfqs/${rfq.id}/responses`, {
        productId: pid, kind: 'quote', advancePct: p.advancePct, ratePct: rate, feesVnd: Math.round((amount * p.advancePct) / 100 * p.feePct / 100),
        validUntil: isoDate(new Date(now().getTime() + 3 * 86_400_000)), conditions: `Báo giá sơ bộ theo hạng ${rating}; chính thức sau thẩm định`,
      })
      note(inst.slug, 'rfq', `${rfq.id}: báo giá ${rate}%/năm, ứng ${p.advancePct}% (hạng ${rating})`)
    }
  }

  async function onApplication(inst: InstitutionConfig, data: Json) {
    const appId = String(data.applicationId)
    const page = await api(inst, 'GET', '/v1/partner/applications?limit=200')
    const ap = page.items.find((a: Json) => a.id === appId)
    if (!ap) return note(inst.slug, 'application', `Không thấy hồ sơ ${appId}`, false)
    await api(inst, 'POST', `/v1/partner/applications/${appId}/review`, {})
    const rating: Rating = ap.score?.rating ?? 'CCC'
    const forced = overrides.get(appId)
    if (forced === 'hold') return note(inst.slug, 'application', `${appId}: đang thẩm định, giữ lại theo kịch bản`)
    const reject = forced === 'reject' || (forced !== 'approve' && !atLeast(rating, profileOf(inst.slug).minRating))
    if (reject) {
      const reason = forced === 'reject' ? 'Từ chối theo kịch bản thẩm định' : `Hạng hồ sơ ${rating} thấp hơn khẩu vị ${profileOf(inst.slug).minRating}; FCC không đề xuất giải ngân (nhóm iii)`
      await api(inst, 'POST', `/v1/partner/applications/${appId}/reject`, { reason })
      return note(inst.slug, 'application', `${appId}: từ chối — ${reason}`)
    }
    const r = ap.receivable
    const quote = ap.quote ?? {}
    const { p, rate } = rateFor(inst, ap.product?.name, rating)
    const advancePct = quote.advancePct ?? p.advancePct
    const tenorDays = Math.max(1, Math.round((new Date(r.dueDate).getTime() - now().getTime()) / 86_400_000))
    const advanceVnd = Math.floor((r.amount * advancePct) / 100 / 1_000_000) * 1_000_000
    const offer = {
      advanceVnd, ratePct: quote.ratePct ?? rate, feesVnd: Math.round((advanceVnd * p.feePct) / 100), tenorDays,
      conditions: `${p.name}; giải ngân T+1 sau ký hợp đồng; thu hồi từ khoản thanh toán của bên mua`,
      expiresAt: isoDate(new Date(now().getTime() + 5 * 86_400_000)),
    }
    await api(inst, 'POST', `/v1/partner/applications/${appId}/offer`, offer)
    note(inst.slug, 'application', `${appId}: đề nghị ứng ${advanceVnd.toLocaleString('vi-VN')} ₫, ${offer.ratePct}%/năm`)
  }

  async function sendFunded(inst: InstitutionConfig, appId: string) {
    const body = JSON.stringify({ id: `disb-${appId}`, type: 'application.funded', data: { applicationId: appId, contractRef: `HD-${inst.slug.toUpperCase()}-${appId.slice(-6)}` } })
    lastFunded.set(inst.slug, body)
    const t = Math.floor(now().getTime() / 1000)
    await api(inst, 'POST', '/v1/partner/events', body, { 'x-fcc-signature': sign(inst.signingSecret, body, t) })
    note(inst.slug, 'disbursement', `${appId}: đã giải ngân, báo FCC qua sự kiện có chữ ký`)
  }

  function onAccepted(inst: InstitutionConfig, data: Json) {
    const appId = String(data.applicationId)
    const forced = overrides.get(appId)
    if (forced === 'hold') return note(inst.slug, 'disbursement', `${appId}: giữ giải ngân theo kịch bản`)
    const base = cfg.disburseDelaySec ?? profileOf(inst.slug).disburseDelaySec
    const delay = (forced === 'delay_disbursement' ? base * 10 : base) * 1000
    note(inst.slug, 'disbursement', `${appId}: doanh nghiệp chấp thuận; giải ngân sau ${Math.round(delay / 1000)} giây (T+1 thu gọn)`)
    const run = () => {
      const p = sendFunded(inst, appId).catch((e) => note(inst.slug, 'disbursement', `${appId}: lỗi báo giải ngân — ${(e as Error).message}`, false))
      pending.push(p)
    }
    if (delay === 0) run()
    else schedule(run, delay)
  }

  async function handle(slug: string, evt: Json) {
    const inst = bySlug.get(slug)!
    if (!isAuto(slug)) return note(slug, evt.type, 'Tự động đang tắt — chờ người thao tác qua FCC')
    switch (evt.type) {
      case 'rfq.created':
        return onRfq(inst, evt.data)
      case 'application.submitted':
        return onApplication(inst, evt.data)
      case 'offer.accepted':
        return onAccepted(inst, evt.data)
      default:
        return note(slug, evt.type, JSON.stringify(evt.data).slice(0, 200))
    }
  }

  const app: FastifyInstance = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' } })
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body))

  app.post('/hooks/:slug', async (req, reply) => {
    const slug = (req.params as { slug: string }).slug
    const inst = bySlug.get(slug)
    const raw = String(req.body ?? '')
    if (!inst || !verify(inst.signingSecret, String(req.headers['x-fcc-signature'] ?? ''), raw, now().getTime())) {
      note(slug, 'webhook', 'Từ chối webhook: chữ ký sai hoặc quá hạn', false)
      return reply.code(401).send({ error: 'Chữ ký không hợp lệ' })
    }
    const evt = JSON.parse(raw) as Json
    if (seen.has(evt.id)) return { ok: true, duplicate: true }
    seen.add(evt.id)
    // xử lý nền: trả 200 ngay để FCC không coi là lỗi khi bước sau mất thời gian
    const p = handle(slug, evt).catch((e) => note(slug, evt.type, `Lỗi xử lý: ${(e as Error).message}`, false))
    pending.push(p)
    return { ok: true }
  })

  // ---- bảng điều khiển kịch bản ----
  app.get('/', async (_req, reply) => reply.type('text/html; charset=utf-8').send(controlPage(cfg.institutions.map((i) => ({ slug: i.slug, name: i.name, auto: isAuto(i.slug) })), [...overrides], log)))
  app.get('/control/log', async () => log)
  app.post('/control/scenario', async (req) => {
    const b = JSON.parse(String(req.body ?? '{}')) as { id?: string; behavior?: Behavior }
    if (!b.id || !b.behavior) return { error: 'Cần id (hồ sơ hoặc RFQ) và behavior' }
    if (b.behavior === 'auto') overrides.delete(b.id)
    else overrides.set(b.id, b.behavior)
    return { ok: true, overrides: [...overrides] }
  })
  app.post('/control/auto', async (req) => {
    const b = JSON.parse(String(req.body ?? '{}')) as { slug?: string; auto?: boolean }
    if (!b.slug || !bySlug.has(b.slug)) return { error: 'slug không hợp lệ' }
    cfg.auto = { ...cfg.auto, [b.slug]: !!b.auto }
    return { ok: true, auto: cfg.auto }
  })
  /** Gửi lại sự kiện giải ngân gần nhất: trùng (FCC phải bỏ qua) hoặc sai chữ ký (FCC phải từ chối). */
  app.post('/control/replay', async (req) => {
    const b = JSON.parse(String(req.body ?? '{}')) as { slug?: string; kind?: 'duplicate' | 'bad_signature' }
    const inst = b.slug ? bySlug.get(b.slug) : undefined
    const body = inst ? lastFunded.get(inst.slug) : undefined
    if (!inst || !body) return { error: 'Chưa có sự kiện giải ngân nào để phát lại' }
    const t = Math.floor(now().getTime() / 1000)
    const sig = b.kind === 'bad_signature' ? sign(randomBytes(32).toString('hex'), body, t) : sign(inst.signingSecret, body, t)
    const res = await f(`${cfg.fccApiUrl}/v1/partner/events`, { method: 'POST', headers: { authorization: `Bearer ${inst.token}`, 'content-type': 'application/json', 'x-fcc-signature': sig }, body })
    const out = { status: res.status, replay: res.headers.get('x-idempotent-replay') === 'true', body: await res.json() }
    note(inst.slug, 'replay', `${b.kind}: FCC trả ${out.status}${out.replay ? ' (đã xử lý trước đó, không ghi nhận lại)' : ''}`, b.kind === 'bad_signature' ? out.status === 401 : out.replay)
    return out
  })

  return {
    app,
    log,
    overrides,
    /** Đăng sản phẩm còn thiếu cho mọi tổ chức. */
    ensureProducts: () => Promise.all(cfg.institutions.map((i) => ensureProducts(i))),
    /** Chờ mọi xử lý nền xong (kiểm thử). */
    settle: async () => {
      while (pending.length) await Promise.allSettled(pending.splice(0))
    },
  }
}
