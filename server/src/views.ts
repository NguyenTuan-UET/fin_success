// Dữ liệu trả về cho trình duyệt được lọc theo tổ chức đăng nhập: không gửi chứng từ, hồ sơ, sổ công nợ… của tổ chức khác
// khi chưa có quyền chia sẻ (consent) còn hiệu lực.
import type { Consent, Receivable } from '../../web/src/domain/types'
import { iso } from '../../web/src/data/seed'
import type { State } from './state'

type Scope = Consent['scopes'][number]

export function viewFor(s: State, actorId: string, now = new Date()): State & { activeOrgId: string } {
  const today = iso(now)
  const actor = s.orgs.find((o) => o.id === actorId)!
  const can = (ownerId: string, scope: Scope) =>
    ownerId === actorId || s.consents.some((c) => c.ownerId === ownerId && c.recipientId === actorId && !c.revokedAt && c.expiresAt >= today && c.scopes.includes(scope))
  const isBuyerOrg = (id: string) => s.orgs.find((o) => o.id === id)?.type === 'buyer' // thông tin bên mua là dữ liệu tham chiếu công khai

  // Khoản phải thu được xem đầy đủ khi là bên bán/bên mua, hoặc là đối tác có hồ sơ/RFQ liên quan
  const myProducts = new Set(s.products.filter((p) => p.lenderId === actorId).map((p) => p.id))
  const lenderRfqRecv = new Set(s.rfqs.filter((q) => ['OPEN', 'RESPONDED'].includes(q.state) && q.productIds.some((p) => myProducts.has(p))).map((q) => q.receivableId))
  const lenderAppRecv = new Set(s.applications.filter((a) => a.lenderId === actorId).map((a) => a.receivableId))
  const fullRecv = new Set(s.receivables.filter((r) => r.sellerId === actorId || r.buyerId === actorId || lenderRfqRecv.has(r.id) || lenderAppRecv.has(r.id)).map((r) => r.id))

  // Phần còn lại chỉ giữ các trường cần cho lịch sử thanh toán/tỷ trọng khi chấm điểm
  const strip = (r: Receivable): Receivable => ({ ...r, invoiceSeries: '', invoiceNumber: '', description: '', fingerprint: '', docs: { xml: false, contract: false, delivery: false }, disputeReason: undefined })
  const receivables = s.receivables.map((r) => (fullRecv.has(r.id) ? r : strip(r)))

  const rfqs = s.rfqs
    .filter((q) => q.sellerId === actorId || q.productIds.some((p) => myProducts.has(p)))
    .map((q) => (q.sellerId === actorId ? q : { ...q, responses: q.responses.filter((x) => x.lenderId === actorId) }))
  const appFull = (a: State['applications'][number]) => a.lenderId === actorId || fullRecv.has(a.receivableId) && (s.receivables.find((r) => r.id === a.receivableId)!.sellerId === actorId || s.receivables.find((r) => r.id === a.receivableId)!.buyerId === actorId)
  const applications = s.applications.map((a) => (appFull(a) ? a : { id: a.id, receivableId: a.receivableId, lenderId: a.lenderId, productId: a.productId, state: a.state, submittedAt: a.submittedAt }))
  const earlyOffers = s.earlyOffers.filter((o) => o.buyerId === actorId || s.receivables.find((r) => r.id === o.receivableId)?.sellerId === actorId)

  const visibleEntities = new Set<string>()
  for (const r of s.receivables) if (fullRecv.has(r.id)) { visibleEntities.add(r.code); visibleEntities.add(r.id) }
  for (const q of rfqs) visibleEntities.add(q.id)
  for (const a of applications) if (appFull(a)) visibleEntities.add(a.id)
  for (const o of earlyOffers) visibleEntities.add(o.id)

  return {
    activeOrgId: actor.id,
    seededAt: s.seededAt,
    orgs: s.orgs,
    products: s.products,
    sources: s.sources,
    listed: s.listed,
    limits: s.limits.filter((l) => l.lenderId === actorId || l.borrowerId === actorId),
    profiles: s.profiles.filter((p) => can(p.orgId, 'credit_score') || isBuyerOrg(p.orgId)),
    esg: s.esg.filter((e) => can(e.orgId, 'esg') || e.source === 'disclosure' || isBuyerOrg(e.orgId)),
    external: s.external.filter((e) => can(e.orgId, 'credit_score')),
    connections: s.connections.filter((c) => can(c.orgId, 'accounting')),
    ledger: s.ledger.filter((l) => can(l.orgId, 'accounting')),
    receivables,
    rfqs,
    applications,
    earlyOffers,
    consents: s.consents.filter((c) => c.ownerId === actorId || c.recipientId === actorId),
    notifications: s.notifications.filter((n) => n.orgId === actorId).slice(0, 200),
    audit: s.audit.filter((e) => e.actorOrgId === actorId || visibleEntities.has(e.entity)).slice(0, 300),
  }
}
