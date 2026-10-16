// Tích hợp tổ chức tài chính: khóa API theo phạm vi, chữ ký webhook (cả hai chiều), bộ gửi webhook đi có thử lại.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import type { Database } from '../state'
import type { MemberRole } from '../auth/roles'
import type { DomainEvent } from '../service'
import { HttpError } from '../errors'

/** Phạm vi quyền của khóa tích hợp → vai trò tương đương khi chạy hành động nghiệp vụ. */
export const SCOPES = {
  'products:write': { role: 'product_manager', label: 'Đăng/sửa sản phẩm Marketplace' },
  'rfqs:respond': { role: 'analyst', label: 'Trả báo giá RFQ' },
  'applications:write': { role: 'analyst', label: 'Thẩm định, ra đề nghị, từ chối hồ sơ' },
  'packages:read': { role: 'analyst', label: 'Đọc gói hồ sơ được chia sẻ' },
  'events:write': { role: 'analyst', label: 'Gửi sự kiện tiền (giải ngân, nhận thanh toán, tất toán, quá hạn)' },
} as const satisfies Record<string, { role: MemberRole; label: string }>
export type Scope = keyof typeof SCOPES

export interface PartnerAuth {
  keyId: string
  orgId: string
  scopes: Scope[]
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export function newIntegrationKey() {
  const id = `k_${randomBytes(6).toString('hex')}`
  const secret = randomBytes(24).toString('base64url')
  return { id, secret, token: `fcck_${id}.${secret}`, hash: sha(secret) }
}

export async function partnerAuth(db: Database, req: FastifyRequest, need: Scope): Promise<PartnerAuth> {
  const h = req.headers.authorization ?? ''
  const m = /^Bearer fcck_(k_[0-9a-f]{12})\.([A-Za-z0-9_-]+)$/.exec(h)
  const k = m ? await db.integrationKey(m[1]) : undefined
  const ok = !!k && !k.revokedAt && timingSafeEqual(Buffer.from(sha(m![2])), Buffer.from(k.keyHash))
  if (!ok) throw new HttpError(401, 'Khóa tích hợp không hợp lệ hoặc đã bị thu hồi')
  if (!k.scopes.includes(need)) throw new HttpError(403, `Khóa tích hợp thiếu phạm vi ${need}`)
  await db.touchIntegrationKey(k.id)
  await db.countApiCall(k.orgId, new Date().toISOString().slice(0, 7)) // số lượt gọi theo tháng (cơ sở báo cáo sử dụng API)
  return { keyId: k.id, orgId: k.orgId, scopes: k.scopes as Scope[] }
}

/** Chữ ký kiểu `t=<unix>,v1=<hex HMAC-SHA256(secret, "t.body")>` — ký cả thời điểm để chặn phát lại. */
export function signPayload(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
}

export function verifySignature(secret: string | undefined, header: string, body: string, now = Date.now(), toleranceSec = 300) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header)
  if (!secret || !m) return false
  if (Math.abs(Math.floor(now / 1000) - Number(m[1])) > toleranceSec) return false
  const expect = createHmac('sha256', secret).update(`${m[1]}.${body}`).digest('hex')
  return timingSafeEqual(Buffer.from(expect), Buffer.from(m[2]))
}

/** Đưa sự kiện nghiệp vụ vào hàng đợi webhook của các tổ chức đã đăng ký địa chỉ nhận. */
export async function enqueueEvents(db: Database, events: DomainEvent[]) {
  const rows = []
  for (const e of events) {
    if (!(await db.partnerEndpoint(e.orgId))) continue
    const eventId = `evt_${randomBytes(8).toString('hex')}`
    rows.push({ eventId, orgId: e.orgId, type: e.type, payload: { id: eventId, type: e.type, createdAt: e.at, data: e.data } })
  }
  await db.enqueueWebhooks(rows)
}

const MAX_ATTEMPTS = 12

/** Gửi một lô webhook đến hạn. Thất bại thì thử lại theo lũy thừa (10 giây × 2^n, tối đa 1 giờ); quá 12 lần thì dừng (dead). */
export async function deliverWebhooks(db: Database, now: () => Date, fetchImpl: typeof fetch = fetch) {
  const batch = await db.claimWebhooks(20, now())
  for (const w of batch) {
    const url = await db.partnerEndpoint(w.orgId)
    const secret = await db.getWebhookSecret(w.orgId)
    if (!url || !secret) {
      await db.webhookResult(w.id, { ok: false, error: 'Tổ chức chưa có địa chỉ nhận hoặc khóa ký', dead: true })
      continue
    }
    const body = JSON.stringify(w.payload)
    let status: number | undefined
    let error: string | undefined
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-fcc-event-id': w.eventId, 'x-fcc-event-type': w.type, 'x-fcc-signature': signPayload(secret, body, Math.floor(now().getTime() / 1000)) },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      status = res.status
      if (res.ok) {
        await db.webhookResult(w.id, { ok: true, status })
        continue
      }
      error = `HTTP ${res.status}`
    } catch (e) {
      error = (e as Error).message
    }
    const attempts = w.attempts + 1
    const dead = attempts >= MAX_ATTEMPTS
    const delay = Math.min(3600_000, 10_000 * 2 ** (attempts - 1))
    await db.webhookResult(w.id, { ok: false, status, error, dead, nextAttemptAt: new Date(now().getTime() + delay) })
  }
  return batch.length
}
