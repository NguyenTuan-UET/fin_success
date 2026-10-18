// Dữ liệu trả về cho trình duyệt được lọc theo tổ chức đăng nhập: không gửi chứng từ, hồ sơ, sổ công nợ…
// của tổ chức khác khi chưa có quyền chia sẻ (consent) còn hiệu lực.
import type { Consent, Receivable } from '@fcc/domain/types'
import { iso } from '@fcc/domain/util'
import type { State } from './state'

type Scope = Consent['scopes'][number]

export function viewFor(s: State, actorId: string, now = new Date()): State {
  const today = iso(now)
  const actor = s.orgs.find((o) => o.id === actorId)!
  const isFcc = actor.type === 'fcc'
  const can = (ownerId: string, scope: Scope) =>
    ownerId === actorId || s.consents.some((c) => c.ownerId === ownerId && c.recipientId === actorId && !c.revokedAt && c.expiresAt >= today && c.scopes.includes(scope))
  const isBuyerOrg = (id: string) => s.orgs.find((o) => o.id === id)?.type === 'buyer' // thông tin bên mua là dữ liệu tham chiếu công khai

  // Nhân sự FCC chỉ thấy hồ sơ cần thẩm định (ESG, sản phẩm, tổ chức), không thấy chứng từ/hồ sơ tài trợ
  if (isFcc) {
    // external: dữ liệu công khai FCC tự tra cứu hoặc crawl (để xử lý khiếu nại)
    return {
      orgs: s.orgs, products: s.products, sources: s.sources, listed: [], limits: [], profiles: [], esg: s.esg, external: s.external, connections: [], ledger: [],
      // chỉ các khoản có cờ bất thường hoặc đã đối chiếu thuế, đã rút gọn (không mô tả, không chứng từ, không số/ký hiệu hóa đơn)
      receivables: s.receivables.filter((r) => (r.flags?.length ?? 0) > 0 || r.taxCheck).map((r) => ({ ...r, description: '', files: undefined, fingerprint: '', docs: { xml: false, contract: false, delivery: false }, disputeReason: undefined })),
      rfqs: [], applications: [], earlyOffers: [], consents: [],
      notifications: s.notifications.filter((n) => n.orgId === actorId).slice(0, 200),
      audit: s.audit.slice(0, 300).map((e) => (e.actorOrgId === actorId ? e : { ...e, detail: redactAuditDetail(e.action, e.detail) })),
    }
  }

  // Khoản phải thu được xem đầy đủ khi là bên bán/bên mua, hoặc là đối tác có hồ sơ/RFQ liên quan
  const myProducts = new Set(s.products.filter((p) => p.lenderId === actorId).map((p) => p.id))
  const lenderRfqRecv = new Set(s.rfqs.filter((q) => ['OPEN', 'RESPONDED'].includes(q.state) && q.productIds.some((p) => myProducts.has(p))).map((q) => q.receivableId))
  const lenderAppRecv = new Set(s.applications.filter((a) => a.lenderId === actorId).map((a) => a.receivableId))
  // bản nháp (chưa gửi) chỉ bên bán thấy — kể cả bên mua có tên trên hóa đơn
  const unsent = (r: Receivable) => r.state === 'DRAFT' || (r.state === 'CANCELLED' && !r.sentAt && !r.confirmedAt)
  const shared = s.receivables.filter((r) => r.sellerId === actorId || !unsent(r))
  const fullRecv = new Set(s.receivables.filter((r) => r.sellerId === actorId || r.buyerId === actorId || lenderRfqRecv.has(r.id) || lenderAppRecv.has(r.id)).map((r) => r.id))

  // Phần còn lại chỉ giữ các trường cần cho lịch sử thanh toán/tỷ trọng khi chấm điểm
  const strip = (r: Receivable): Receivable => ({ ...r, invoiceSeries: '', invoiceNumber: '', description: '', fingerprint: '', docs: { xml: false, contract: false, delivery: false }, disputeReason: undefined, files: undefined, revisions: undefined })
  const receivables = shared.map((r) => (fullRecv.has(r.id) ? r : strip(r)))

  const rfqs = s.rfqs
    .filter((q) => q.sellerId === actorId || q.productIds.some((p) => myProducts.has(p)))
    .map((q) => (q.sellerId === actorId ? q : { ...q, responses: q.responses.filter((x) => x.lenderId === actorId) }))
  const recvById = new Map(s.receivables.map((r) => [r.id, r]))
  const appFull = (a: State['applications'][number]) => {
    const r = recvById.get(a.receivableId)
    return a.lenderId === actorId || (!!r && (r.sellerId === actorId || r.buyerId === actorId))
  }
  const applications = s.applications.map((a) => (appFull(a) ? a : { id: a.id, receivableId: a.receivableId, lenderId: a.lenderId, productId: a.productId, state: a.state, submittedAt: a.submittedAt }))
  const earlyOffers = s.earlyOffers.filter((o) => o.buyerId === actorId || recvById.get(o.receivableId)?.sellerId === actorId)

  const visibleEntities = new Set<string>()
  for (const r of shared) if (fullRecv.has(r.id)) { visibleEntities.add(r.code); visibleEntities.add(r.id) }
  for (const q of rfqs) visibleEntities.add(q.id)
  for (const a of applications) if (appFull(a)) visibleEntities.add(a.id)
  for (const o of earlyOffers) visibleEntities.add(o.id)

  return {
    orgs: s.orgs,
    products: s.products.filter((p) => p.status === 'published' || p.lenderId === actorId),
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

/**
 * Tối thiểu hóa dữ liệu trong nhật ký hiển thị cho nhân sự FCC: sự kiện do tổ chức khác thực hiện được ẩn số tiền,
 * lãi suất và kết quả chấm điểm. Bản ghi gốc (và chuỗi băm) không đổi; kiểm toán viên tra cứu qua /v1/audit-events (có ghi vết).
 */
export function redactAuditDetail(action: string, detail: string): string {
  if (/^Chấm điểm/.test(action)) return '[kết quả chấm điểm đã ẩn]'
  return detail
    .replace(/\d[\d.]*(,\d+)?\s*₫/g, '[số tiền]')
    .replace(/\d{1,3}(\.\d{3})+(,\d+)?/g, '[số tiền]') // số có phân cách hàng nghìn, kể cả khi không ghi ₫
    .replace(/\d+(,\d+)?%\/năm/g, '[lãi suất]')
}
