// API REST /v1. Bảng ENDPOINTS là nguồn duy nhất: vừa đăng ký route, vừa sinh tài liệu OpenAPI (GET /v1/openapi.json).
// Hành động ghi chạy qua cùng luật nghiệp vụ (service.ts) và cùng ma trận quyền/MFA như giao diện.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createHash, randomBytes } from 'node:crypto'
import { matchProduct, rankMatches } from '@fcc/domain/marketplace'
import { ewsAlerts } from '@fcc/domain/ews'
import { applicationScoreOf, buyerScoreOf, esgOf, supplierScoreOf } from '@fcc/domain/engine'
import type { Authed, Core } from '../core'
import { actions, fundApplication, matchContextFor, reconciliationOf } from '../service'
import { balanceAt } from '@fcc/domain/settlement'
import { viewFor } from '../views'
import { HttpError, bad, forbidden, notFound } from '../errors'
import { enqueueEvents, newIntegrationKey, partnerAuth, SCOPES, verifySignature, type PartnerAuth, type Scope } from '../integrations/partner'
import { isAdminRole } from '../auth/roles'
import type { State } from '../state'
import { provisionSimBanks } from '../sim/provision'
import { assertCanAssess, assess, canSeeAssessment, OFFICIAL_VALID_DAYS, shape, type Kind } from '../assessments'
import { DEFAULT_SCORECARD, type ScorecardParams } from '@fcc/domain/credit'
import { uid } from '../core'
import { bankStatement, computeAndStoreForecast, forecastAccuracy, journalFor, parseRegime } from '../accounting'
import { toCsv, type JournalEntry } from '@fcc/domain/journal'
import { billingRun, chargeReport, chargeScoring, feeSourceLabel, scheduleAt } from '../billing'
import { FEE_SOURCES, validateSchedule, type FeeSchedule } from '@fcc/domain/fees'

type Json = Record<string, unknown>
interface Src {
  params: Record<string, string>
  body: Json
  query: Record<string, string | undefined>
  a?: Authed
  p?: PartnerAuth
  req: FastifyRequest
  reply: FastifyReply
}
interface Endpoint {
  method: 'GET' | 'POST' | 'PUT'
  path: string // kiểu OpenAPI: /v1/receivables/{id}
  tag: string
  summary: string
  auth: 'user' | 'partner' | 'public'
  /** Hành động nghiệp vụ (service.ts) và cách lấy tham số */
  action?: string
  args?: (s: Src) => unknown[]
  /** Phạm vi cần có với khóa tích hợp */
  scope?: Scope
  /** Đọc dữ liệu hoặc xử lý riêng */
  run?: (s: Src, core: Core) => unknown | Promise<unknown>
  /** Mô tả thân yêu cầu cho tài liệu */
  body?: Record<string, string>
  /** Kiểm tra bổ sung trước khi chạy hành động */
  check?: 'receivableFiles'
}

const P = (s: Src, k: string) => {
  const v = s.params[k]
  if (!v) throw bad(`Thiếu ${k}`)
  return v
}
const B = (s: Src) => s.body ?? {}

/** Phân trang bằng cursor (id của phần tử cuối trang trước). */
function page<T extends { id?: string }>(items: T[], q: Src['query'], idOf: (t: T) => string = (t) => String(t.id)) {
  const limit = Math.min(200, Math.max(1, Number(q.limit ?? 50) || 50))
  let start = 0
  if (q.cursor) {
    const i = items.findIndex((t) => idOf(t) === q.cursor)
    if (i < 0) throw bad('cursor không hợp lệ')
    start = i + 1
  }
  const slice = items.slice(start, start + limit)
  return { items: slice, nextCursor: start + limit < items.length ? idOf(slice[slice.length - 1]) : null }
}

const csv = (head: string[], rows: (string | number)[][]) => [head, ...rows].map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(',')).join('\n') + '\n'
const view = (core: Core, orgId: string) => viewFor(core.getState(), orgId, core.clock()) as State
const orgOf = (core: Core, id: string) => core.getState().orgs.find((o) => o.id === id)

export const ENDPOINTS: Endpoint[] = [
  // ---- tài khoản & trạng thái ----
  { method: 'GET', path: '/v1/me', tag: 'Tài khoản', summary: 'Người dùng, vai trò và tổ chức đang hoạt động', auth: 'user', run: (s, core) => core.me(s.a!) },
  { method: 'GET', path: '/v1/state', tag: 'Tài khoản', summary: 'Toàn bộ dữ liệu được phép xem (đã lọc theo quyền chia sẻ); ?since=<version> trả unchanged nếu không đổi', auth: 'user',
    run: (s, core) => (Number(s.query.since) === core.version() ? { version: core.version(), unchanged: true } : core.snapshot(s.a!)) },

  // ---- khoản phải thu ----
  { method: 'GET', path: '/v1/receivables', tag: 'Khoản phải thu', summary: 'Danh sách (cursor, limit); lọc ?state=', auth: 'user',
    run: (s, core) => page(view(core, s.a!.activeOrgId).receivables.filter((r) => !s.query.state || r.state === s.query.state), s.query) },
  { method: 'GET', path: '/v1/receivables/{id}', tag: 'Khoản phải thu', summary: 'Chi tiết', auth: 'user',
    run: (s, core) => view(core, s.a!.activeOrgId).receivables.find((r) => r.id === P(s, 'id')) ?? (() => { throw notFound('Không tìm thấy khoản phải thu') })() },
  { method: 'POST', path: '/v1/receivables', tag: 'Khoản phải thu', summary: 'Tạo khoản phải thu từ hóa đơn (files: khóa tệp đã tải lên /api/files)', auth: 'user', action: 'createReceivable', args: (s) => [B(s)], check: 'receivableFiles',
    body: { buyerId: 'string', invoiceSeries: 'string', invoiceNumber: 'string', issueDate: 'YYYY-MM-DD', dueDate: 'YYYY-MM-DD', amount: 'integer VND', fingerprint: 'string', source: 'xml|ocr|manual|accounting' } },
  { method: 'POST', path: '/v1/receivables/{id}/buyer-invitation', tag: 'Khoản phải thu', summary: 'Gửi bên mua xác nhận', auth: 'user', action: 'sendToBuyer', args: (s) => [P(s, 'id')] },
  { method: 'POST', path: '/v1/receivables/{id}/buyer-decision', tag: 'Bên mua', summary: 'Bên mua xác nhận nghĩa vụ hoặc nêu tranh chấp (cần MFA)', auth: 'user', action: 'buyerDecision',
    args: (s) => [P(s, 'id'), B(s).confirm === true, B(s).reason], body: { confirm: 'boolean', reason: 'string (khi tranh chấp)' } },
  { method: 'POST', path: '/v1/receivables/{id}/revise', tag: 'Khoản phải thu', summary: 'Điều chỉnh khoản bị tranh chấp', auth: 'user', action: 'reviseDisputed', args: (s) => [P(s, 'id'), B(s).amount, B(s).note], body: { amount: 'integer', note: 'string' } },
  { method: 'POST', path: '/v1/receivables/{id}/amendment', tag: 'Khoản phải thu', summary: 'Hóa đơn điều chỉnh/thay thế: đổi số tiền hoặc hạn; xác nhận cũ mất hiệu lực, bên mua xác nhận lại', auth: 'user', action: 'reviseReceivable', args: (s) => [P(s, 'id'), B(s)], body: { amount: 'integer (tùy chọn)', dueDate: 'YYYY-MM-DD (tùy chọn)', note: 'string' } },
  { method: 'POST', path: '/v1/receivables/{id}/flags/{code}/resolve', tag: 'Vận hành FCC', summary: 'FCC xử lý cờ bất thường của hóa đơn', auth: 'user', action: 'resolveFlag', args: (s) => [P(s, 'id'), P(s, 'code'), B(s).note], body: { note: 'string' } },
  { method: 'POST', path: '/v1/receivables/{id}/tax-check', tag: 'Vận hành FCC', summary: 'Ghi nhận kết quả đối chiếu hóa đơn với cơ quan thuế', auth: 'user', action: 'recordTaxCheck', args: (s) => [P(s, 'id'), B(s)], body: { status: 'verified|mismatch|cancelled', note: 'string', evidenceKey: 'khóa tệp ảnh chụp (tùy chọn)' } },
  { method: 'POST', path: '/v1/receivables/{id}/cancel', tag: 'Khoản phải thu', summary: 'Hủy khoản phải thu', auth: 'user', action: 'cancelReceivable', args: (s) => [P(s, 'id')] },
  { method: 'POST', path: '/v1/receivables/{id}/buyer-payment', tag: 'Bên mua', summary: 'Bên mua ghi nhận đã thanh toán, một phần hoặc đủ (cần MFA). Khoản đã tài trợ: chờ tổ chức tài chính xác nhận tiền về', auth: 'user', action: 'markBuyerPaid', args: (s) => [P(s, 'id'), B(s)], body: { amount: 'integer (mặc định: phần chưa báo)', paidAt: 'YYYY-MM-DD', reference: 'string' } },
  { method: 'GET', path: '/v1/receivables/{id}/matches', tag: 'Marketplace', summary: 'Sản phẩm phù hợp/chưa phù hợp kèm chi phí ước tính (theo biểu giá công bố)', auth: 'user',
    run: (s, core) => {
      const st = core.getState()
      const r = st.receivables.find((x) => x.id === P(s, 'id'))
      if (!r || r.sellerId !== s.a!.activeOrgId) throw notFound('Không tìm thấy khoản phải thu')
      const ctx = matchContextFor(st, r, core.clock())
      const ms = st.products.filter((p) => p.status === 'published').map((p) => matchProduct(p, ctx))
      const sort = (['cost', 'advance', 'sla'] as const).find((k) => k === s.query.sort) ?? 'cost'
      const ranked = rankMatches(ms, sort)
      return { eligible: ranked.eligible, notEligible: ranked.ineligible, note: 'Ước tính theo biểu giá công bố, không phải báo giá' }
    } },
  { method: 'GET', path: '/v1/receivables/{id}/application-score', tag: 'Chấm điểm', summary: 'Điểm hồ sơ tài trợ của khoản phải thu (tham khảo)', auth: 'user',
    run: (s, core) => {
      const v = view(core, s.a!.activeOrgId)
      if (!v.receivables.some((r) => r.id === P(s, 'id'))) throw notFound('Không tìm thấy khoản phải thu')
      return applicationScoreOf(core.getState(), P(s, 'id'))
    } },

  // ---- RFQ & hồ sơ tài trợ ----
  { method: 'POST', path: '/v1/rfqs', tag: 'Marketplace', summary: 'Gửi yêu cầu báo giá tới 1–3 sản phẩm (chia sẻ gói tóm tắt, cần MFA)', auth: 'user', action: 'createRfq',
    args: (s) => [B(s).receivableId, B(s).productIds], body: { receivableId: 'string', productIds: 'string[] (1–3)' } },
  { method: 'POST', path: '/v1/rfqs/{id}/responses', tag: 'Marketplace', summary: 'Tổ chức tài chính trả báo giá/từ chối', auth: 'user', action: 'respondRfq', args: (s) => [P(s, 'id'), B(s)],
    body: { productId: 'string', kind: 'quote|decline', advancePct: 'number', ratePct: 'number', feesVnd: 'integer', validUntil: 'YYYY-MM-DD', conditions: 'string' } },
  { method: 'POST', path: '/v1/rfqs/{id}/select', tag: 'Marketplace', summary: 'Chọn báo giá và gửi hồ sơ (cần MFA)', auth: 'user', action: 'selectQuote', args: (s) => [P(s, 'id'), B(s).lenderId], body: { lenderId: 'string' } },
  { method: 'POST', path: '/v1/rfqs/{id}/cancel', tag: 'Marketplace', summary: 'Hủy RFQ, thu hồi quyền xem', auth: 'user', action: 'cancelRfq', args: (s) => [P(s, 'id')] },
  { method: 'GET', path: '/v1/funding-applications', tag: 'Hồ sơ tài trợ', summary: 'Danh sách hồ sơ (cursor, limit)', auth: 'user', run: (s, core) => page(view(core, s.a!.activeOrgId).applications, s.query) },
  { method: 'GET', path: '/v1/funding-applications/{id}', tag: 'Hồ sơ tài trợ', summary: 'Chi tiết hồ sơ', auth: 'user',
    run: (s, core) => view(core, s.a!.activeOrgId).applications.find((x) => x.id === P(s, 'id')) ?? (() => { throw notFound('Không tìm thấy hồ sơ') })() },
  { method: 'POST', path: '/v1/funding-applications', tag: 'Hồ sơ tài trợ', summary: 'Gửi hồ sơ thẳng tới một sản phẩm (cần MFA)', auth: 'user', action: 'submitDirect', args: (s) => [B(s).receivableId, B(s).productId], body: { receivableId: 'string', productId: 'string' } },
  { method: 'POST', path: '/v1/funding-applications/{id}/review', tag: 'Hồ sơ tài trợ', summary: 'Tổ chức tài chính bắt đầu thẩm định', auth: 'user', action: 'startReview', args: (s) => [P(s, 'id')] },
  { method: 'POST', path: '/v1/funding-applications/{id}/offer', tag: 'Hồ sơ tài trợ', summary: 'Ra đề nghị tài trợ chính thức', auth: 'user', action: 'makeOffer', args: (s) => [P(s, 'id'), B(s)],
    body: { advanceVnd: 'integer', ratePct: 'number', feesVnd: 'integer', tenorDays: 'integer', conditions: 'string', expiresAt: 'YYYY-MM-DD' } },
  { method: 'POST', path: '/v1/funding-applications/{id}/reject', tag: 'Hồ sơ tài trợ', summary: 'Từ chối hồ sơ', auth: 'user', action: 'rejectApp', args: (s) => [P(s, 'id'), B(s).reason], body: { reason: 'string' } },
  { method: 'POST', path: '/v1/funding-applications/{id}/accept', tag: 'Hồ sơ tài trợ', summary: 'Doanh nghiệp chấp thuận đề nghị (cần MFA)', auth: 'user', action: 'acceptOffer', args: (s) => [P(s, 'id')] },
  { method: 'POST', path: '/v1/funding-applications/{id}/payments', tag: 'Hồ sơ tài trợ', summary: 'Tổ chức tài chính xác nhận tiền về (thanh toán hoặc thanh lý tài sản): thu theo phí → lãi → gốc, đủ thì tất toán, phần dư hoàn cho nhà cung cấp', auth: 'user', action: 'confirmPayment', args: (s) => [P(s, 'id'), B(s)], body: { amount: 'integer', paidAt: 'YYYY-MM-DD', kind: 'payment|collateral', reference: 'string' } },
  { method: 'POST', path: '/v1/funding-applications/{id}/refunds', tag: 'Hồ sơ tài trợ', summary: 'Tổ chức tài chính xác nhận đã hoàn phần dư cho nhà cung cấp', auth: 'user', action: 'confirmRefund', args: (s) => [P(s, 'id'), B(s)], body: { amount: 'integer', reference: 'string' } },
  { method: 'GET', path: '/v1/funding-applications/{id}/settlement', tag: 'Hồ sơ tài trợ', summary: 'Sự kiện tiền, dư nợ, phần dư phải hoàn và trạng thái đối soát', auth: 'user',
    run: (s, core) => {
      const a = view(core, s.a!.activeOrgId).applications.find((x) => x.id === P(s, 'id'))
      const full = core.getState().applications.find((x) => x.id === P(s, 'id'))
      if (!a || !full || !('offer' in a)) throw notFound('Không tìm thấy hồ sơ')
      const r = core.getState().receivables.find((x) => x.id === full.receivableId)
      const bal = full.offer && full.fundedAt && r ? balanceAt(full.offer, full.fundedAt, r.dueDate, full.settlements ?? [], core.clock().toISOString(), core.getState().products.find((p) => p.id === full.productId)?.pricing.latePenaltyPct) : null
      return { events: full.settlements ?? [], balance: bal, refundDue: full.refundDue ?? 0, refundPaid: full.refundPaid ?? 0, reconciliation: reconciliationOf(full) }
    } },
  { method: 'POST', path: '/v1/funding-applications/{id}/fund', tag: 'Hồ sơ tài trợ', summary: 'Tổ chức tài chính ghi nhận giải ngân (cần MFA)', auth: 'user', action: 'fundApp', args: (s) => [P(s, 'id')] },

  // ---- sản phẩm ----
  { method: 'GET', path: '/v1/financing-products', tag: 'Marketplace', summary: 'Sản phẩm được phép xem (cursor, limit)', auth: 'user', run: (s, core) => page(view(core, s.a!.activeOrgId).products, s.query) },
  { method: 'POST', path: '/v1/financing-products', tag: 'Marketplace', summary: 'Tạo/sửa sản phẩm (sửa phải FCC duyệt lại)', auth: 'user', action: 'upsertProduct', args: (s) => [B(s)] },
  { method: 'POST', path: '/v1/financing-products/{id}/status', tag: 'Marketplace', summary: 'Tạm dừng/mở lại sản phẩm', auth: 'user', action: 'setProductStatus', args: (s) => [P(s, 'id'), B(s).status], body: { status: 'published|paused' } },
  { method: 'POST', path: '/v1/financing-products/{id}/review', tag: 'Vận hành FCC', summary: 'FCC duyệt/từ chối sản phẩm', auth: 'user', action: 'approveProduct', args: (s) => [P(s, 'id'), B(s).approve === true, B(s).note], body: { approve: 'boolean', note: 'string' } },
  { method: 'GET', path: '/v1/market-overview', tag: 'Marketplace', summary: 'Mặt bằng lãi suất/tỷ lệ ứng từ sản phẩm đang công bố', auth: 'user',
    run: (_s, core) => {
      const ps = core.getState().products.filter((p) => p.status === 'published')
      const byType = new Map<string, number[][]>()
      for (const p of ps) byType.set(p.type, [...(byType.get(p.type) ?? []), [p.pricing.rateMin, p.pricing.rateMax, p.pricing.advancePct]])
      return [...byType].map(([type, xs]) => ({ type, products: xs.length, rateMin: Math.min(...xs.map((x) => x[0])), rateMax: Math.max(...xs.map((x) => x[1])), advanceAvgPct: xs.reduce((a, x) => a + x[2], 0) / xs.length }))
    } },

  { method: 'GET', path: '/v1/ews-alerts', tag: 'Giám sát', summary: 'Cảnh báo sớm theo luật cho danh mục hồ sơ (tổ chức tài chính: hồ sơ của mình; nhà cung cấp: hồ sơ trên hóa đơn của mình)', auth: 'user',
    run: (s, core) => {
      const v = view(core, s.a!.activeOrgId)
      const type = orgOf(core, s.a!.activeOrgId)?.type
      if (type !== 'lender' && type !== 'supplier') throw forbidden('Chỉ tổ chức tài chính và nhà cung cấp')
      const apps = v.applications.filter((a) => (type === 'lender' ? a.lenderId === s.a!.activeOrgId : v.receivables.find((r) => r.id === a.receivableId)?.sellerId === s.a!.activeOrgId))
      return page(ewsAlerts(core.getState(), apps, core.clock()), s.query)
    } },

  // ---- tổ chức, KYC, chấm điểm ----
  { method: 'POST', path: '/v1/organizations/me', tag: 'Tổ chức', summary: 'Cập nhật hồ sơ tổ chức', auth: 'user', action: 'updateOrg', args: (s) => [B(s)] },
  { method: 'POST', path: '/v1/organizations/me/kyc', tag: 'Tổ chức', summary: 'Nộp hồ sơ xác minh người đại diện', auth: 'user', action: 'submitKyc', args: (s) => [B(s)], body: { representativeName: 'string', documentKeys: 'string[] (khóa tệp)' } },
  { method: 'POST', path: '/v1/organizations/{id}/kyc-decision', tag: 'Vận hành FCC', summary: 'FCC duyệt hồ sơ xác minh (cần MFA)', auth: 'user', action: 'decideKyc', args: (s) => [P(s, 'id'), B(s).approve === true, B(s).note], body: { approve: 'boolean', note: 'string' } },
  { method: 'POST', path: '/v1/organizations/{id}/verify', tag: 'Vận hành FCC', summary: 'FCC xác minh tổ chức tài chính', auth: 'user', action: 'verifyOrg', args: (s) => [P(s, 'id'), B(s).verified === true], body: { verified: 'boolean' } },
  { method: 'GET', path: '/v1/organizations/{id}/scores', tag: 'Chấm điểm', summary: 'Điểm tín dụng tham khảo và ESG của tổ chức (theo quyền chia sẻ)', auth: 'user',
    run: (s, core) => {
      const id = P(s, 'id')
      const o = view(core, s.a!.activeOrgId).orgs.find((x) => x.id === id)
      if (!o) throw notFound('Không tìm thấy tổ chức')
      const st = core.getState()
      const canSee = id === s.a!.activeOrgId || orgOf(core, s.a!.activeOrgId)?.type === 'fcc' || st.consents.some((k) => k.ownerId === id && k.recipientId === s.a!.activeOrgId && !k.revokedAt && k.scopes.includes('credit_score') && k.expiresAt >= core.clock().toISOString().slice(0, 10))
      if (!canSee && o.type !== 'buyer') throw forbidden('Chưa được chia sẻ điểm của tổ chức này')
      const credit = o.type === 'buyer' ? buyerScoreOf(st, id) : o.type === 'supplier' ? supplierScoreOf(st, id) : undefined
      const e = esgOf(st, id)
      return { credit, esg: e ? { score: e.result.score, level: e.result.level, coverage: e.result.coverage, status: e.assessment.status } : null, note: 'Xếp hạng tham khảo FCC — không phải quyết định tín dụng' }
    } },
  // ---- chấm điểm tín dụng tham khảo (chạy ở máy chủ, lưu bất biến) ----
  { method: 'POST', path: '/v1/organizations/{id}/credit-assessments', tag: 'Chấm điểm', summary: 'Chấm điểm nhà cung cấp/bên mua (5C hoặc bên mua). Cùng đầu vào + phiên bản trả lại bản ghi cũ (cùng input_hash); khác thì tạo bản ghi mới', auth: 'user',
    run: async (s, core) => {
      const id = P(s, 'id')
      const o = orgOf(core, id)
      if (!o || !['supplier', 'buyer'].includes(o.type)) throw notFound('Chỉ chấm điểm nhà cung cấp hoặc bên mua')
      assertCanAssess(core, s.a!.activeOrgId, o.type as Kind, id, s.a!.role)
      const { row, reused } = await assess(core, o.type as Kind, id, s.a!.id)
      if (!reused) await core.audit(s.a!.activeOrgId, s.a!.id, 'Chấm điểm tín dụng tham khảo', row.id, `${o.shortName}: ${row.rating} ${Math.round(Number(row.score))} (bao phủ ${Math.round(Number(row.coverage) * 100)}%)`, s.req.id)
      return { ...shape(row), reused }
    } },
  { method: 'POST', path: '/v1/receivables/{id}/application-assessments', tag: 'Chấm điểm', summary: 'Chấm điểm hồ sơ tài trợ của khoản phải thu (chỉ khi bên mua đã xác nhận)', auth: 'user',
    run: async (s, core) => {
      const r = core.getState().receivables.find((x) => x.id === P(s, 'id'))
      if (!r || r.sellerId !== s.a!.activeOrgId) throw notFound('Không tìm thấy khoản phải thu')
      if (!['BUYER_CONFIRMED', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'FUNDED', 'SETTLED'].includes(r.state)) throw new HttpError(409, 'Chỉ chấm điểm hồ sơ khi bên mua đã xác nhận')
      const { row, reused } = await assess(core, 'application', r.id, s.a!.id)
      if (!reused) await core.audit(s.a!.activeOrgId, s.a!.id, 'Chấm điểm hồ sơ tài trợ', row.id, `${r.code}: ${row.rating}`, s.req.id)
      return { ...shape(row), reused }
    } },
  { method: 'GET', path: '/v1/organizations/{id}/credit-assessments', tag: 'Chấm điểm', summary: 'Các kết quả chấm điểm của tổ chức (theo quyền chia sẻ)', auth: 'user',
    run: async (s, core) => {
      const id = P(s, 'id')
      const o = orgOf(core, id)
      if (!o) throw notFound('Không tìm thấy tổ chức')
      const rows = (await core.db.assessmentsOf(o.type === 'buyer' ? 'buyer' : 'supplier', id)).filter((r) => canSeeAssessment(core, s.a!.activeOrgId, r))
      return rows.map((r) => ({ ...shape(r), result: undefined }))
    } },
  { method: 'GET', path: '/v1/credit-assessments/{id}', tag: 'Chấm điểm', summary: 'Chi tiết một kết quả chấm điểm: thành phần, yếu tố, lý do, phiên bản bộ chấm điểm', auth: 'user',
    run: async (s, core) => {
      const r = await core.db.assessment(P(s, 'id'))
      if (!r || !canSeeAssessment(core, s.a!.activeOrgId, r)) throw notFound('Không tìm thấy kết quả chấm điểm')
      return shape(r)
    } },
  { method: 'POST', path: '/v1/credit-assessments/{id}/issue', tag: 'Vận hành FCC', summary: 'Thẩm định viên FCC phát hành điểm chính thức (cần MFA; chỉ khi độ bao phủ đạt ngưỡng; không sửa sau phát hành)', auth: 'user',
    run: async (s, core) => {
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'fcc' || !['fcc_admin', 'fcc_reviewer'].includes(s.a!.role)) throw forbidden('Chỉ thẩm định viên FCC')
      core.requireStepUp(s.a!)
      const r = await core.db.assessment(P(s, 'id'))
      if (!r) throw notFound('Không tìm thấy kết quả chấm điểm')
      if (r.status !== 'provisional') throw new HttpError(409, 'Chỉ phát hành bản tạm tính mới nhất')
      if (!(r.result as { official?: boolean }).official) throw new HttpError(422, `Độ bao phủ ${Math.round(Number(r.coverage) * 100)}% hoặc thiếu dữ liệu bắt buộc — chưa phát hành điểm chính thức`)
      if (!(await core.db.issueAssessment(r.id, s.a!.id, new Date(core.clock().getTime() + OFFICIAL_VALID_DAYS * 86_400_000)))) throw new HttpError(409, 'Kết quả đã được phát hành hoặc bị thay thế')
      await chargeScoring(core, r.org_id, r.id)
      await core.audit(s.a!.activeOrgId, s.a!.id, 'Phát hành điểm tín dụng chính thức', r.id, `${r.rating} · hiệu lực ${OFFICIAL_VALID_DAYS} ngày`, s.req.id)
      return shape(await core.db.assessment(r.id))
    } },
  { method: 'POST', path: '/v1/credit-assessments/{id}/appeals', tag: 'Chấm điểm', summary: 'Doanh nghiệp yêu cầu xem xét lại kết quả (kèm lý do và bằng chứng)', auth: 'user', body: { reason: 'string', evidenceKeys: 'string[] (khóa tệp)' },
    run: async (s, core) => {
      const r = await core.db.assessment(P(s, 'id'))
      if (!r || r.org_id !== s.a!.activeOrgId) throw notFound('Không tìm thấy kết quả chấm điểm của tổ chức bạn')
      const reason = String(B(s).reason ?? '').trim()
      if (reason.length < 10) throw bad('Nêu rõ lý do (tối thiểu 10 ký tự)')
      const keys = Array.isArray(B(s).evidenceKeys) ? (B(s).evidenceKeys as string[]) : []
      for (const k of keys) if (typeof k !== 'string' || !(await core.db.fileOf(k, s.a!.activeOrgId))) throw bad('Bằng chứng chưa được tải lên bởi tổ chức này')
      const id = uid('AP')
      await core.db.createAppeal({ id, assessmentId: r.id, orgId: r.org_id, reason: reason.slice(0, 2000), evidenceKeys: keys, createdBy: s.a!.id })
      await core.audit(s.a!.activeOrgId, s.a!.id, 'Yêu cầu xem xét lại điểm tín dụng', r.id, reason.slice(0, 200), s.req.id)
      return { id, status: 'open' }
    } },
  { method: 'GET', path: '/v1/credit-assessments', tag: 'Vận hành FCC', summary: 'Kết quả tạm tính đủ điều kiện chờ phát hành chính thức (FCC)', auth: 'user',
    run: async (s, core) => {
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'fcc') throw forbidden('Chỉ nhân sự FCC')
      return (await core.db.assessmentsAwaitingIssue()).map((r) => ({ ...shape(r), result: undefined }))
    } },
  { method: 'GET', path: '/v1/appeals', tag: 'Chấm điểm', summary: 'Yêu cầu xem xét lại (doanh nghiệp: của mình; FCC: toàn bộ, lọc ?status=)', auth: 'user',
    run: async (s, core) => core.db.appeals({ orgId: orgOf(core, s.a!.activeOrgId)?.type === 'fcc' ? undefined : s.a!.activeOrgId, status: s.query.status }) },
  { method: 'POST', path: '/v1/appeals/{id}/resolve', tag: 'Vận hành FCC', summary: 'FCC xử lý yêu cầu xem xét lại: upheld (chấp nhận → chấm lại bằng dữ liệu hiện tại) hoặc rejected, có ghi chú', auth: 'user', body: { outcome: 'upheld|rejected', note: 'string' },
    run: async (s, core) => {
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'fcc' || !['fcc_admin', 'fcc_reviewer'].includes(s.a!.role)) throw forbidden('Chỉ thẩm định viên FCC')
      const ap = await core.db.appeal(P(s, 'id'))
      if (!ap) throw notFound('Không tìm thấy yêu cầu')
      const outcome = B(s).outcome
      const note = String(B(s).note ?? '').trim()
      if (!['upheld', 'rejected'].includes(String(outcome)) || !note) throw bad('Cần kết quả (upheld|rejected) và ghi chú')
      const a = await core.db.assessment(ap.assessmentId)
      let newId: string | undefined
      if (outcome === 'upheld') newId = (await assess(core, a.kind as Kind, a.subject_id, s.a!.id)).row.id
      if (!(await core.db.resolveAppeal(ap.id, { status: outcome as 'upheld' | 'rejected', note, by: s.a!.id, newAssessmentId: newId }))) throw new HttpError(409, 'Yêu cầu đã được xử lý')
      await core.audit(s.a!.activeOrgId, s.a!.id, 'Xử lý yêu cầu xem xét lại điểm', ap.id, `${outcome}: ${note}`, s.req.id)
      return { id: ap.id, status: outcome, newAssessmentId: newId }
    } },
  { method: 'GET', path: '/v1/operations/scorecard-versions', tag: 'Vận hành FCC', summary: 'Các phiên bản bộ chấm điểm và trạng thái duyệt', auth: 'user',
    run: async (s, core) => {
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'fcc') throw forbidden('Chỉ nhân sự FCC')
      return { default: DEFAULT_SCORECARD, versions: await core.db.scorecardVersions() }
    } },
  { method: 'POST', path: '/v1/operations/scorecard-versions', tag: 'Vận hành FCC', summary: 'Chủ mô hình đề xuất phiên bản mới (tham số). Có hiệu lực sau khi hai người khác duyệt; không sửa kết quả đã phát hành', auth: 'user', body: { name: 'string', params: 'ScorecardParams' },
    run: async (s, core) => {
      if (!['fcc_admin', 'fcc_model_owner'].includes(s.a!.role)) throw forbidden('Chỉ chủ mô hình hoặc quản trị FCC')
      core.requireStepUp(s.a!)
      const p = B(s).params as ScorecardParams | undefined
      const cut = p?.ratingCutoffs
      if (!Array.isArray(cut) || cut.length !== 6 || cut.some((x, i) => typeof x !== 'number' || (i > 0 && x >= cut[i - 1]))) throw bad('ratingCutoffs phải gồm 6 ngưỡng giảm dần')
      if (!p?.industryMargin || !['manufacturing', 'trade', 'agri', 'tech'].every((k) => typeof p.industryMargin[k as 'trade'] === 'number')) throw bad('industryMargin cần đủ 4 nhóm ngành')
      const id = uid('sc')
      await core.db.createScorecard({ id, name: String(B(s).name ?? 'Phiên bản mới').slice(0, 120), params: { ratingCutoffs: cut, industryMargin: p.industryMargin, industryRisk: p.industryRisk ?? {} }, proposedBy: s.a!.id })
      await core.audit(s.a!.activeOrgId, s.a!.id, 'Đề xuất phiên bản bộ chấm điểm', id, String(B(s).name ?? ''), s.req.id)
      return { id, status: 'proposed', needs: 'hai người khác duyệt' }
    } },
  { method: 'POST', path: '/v1/operations/scorecard-versions/{id}/approve', tag: 'Vận hành FCC', summary: 'Duyệt một phiên bản bộ chấm điểm (hai người duyệt khác nhau, khác người đề xuất, mới có hiệu lực)', auth: 'user',
    run: async (s, core) => {
      if (!['fcc_admin', 'fcc_model_owner'].includes(s.a!.role)) throw forbidden('Chỉ chủ mô hình hoặc quản trị FCC')
      core.requireStepUp(s.a!)
      try {
        const r = await core.db.approveScorecard(P(s, 'id'), s.a!.id)
        await core.audit(s.a!.activeOrgId, s.a!.id, r.active ? 'Kích hoạt phiên bản bộ chấm điểm' : 'Duyệt phiên bản bộ chấm điểm', P(s, 'id'), `${r.approvals.length}/2 người duyệt`, s.req.id)
        return r
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code === 'NOT_FOUND') throw notFound((e as Error).message)
        if (code) throw new HttpError(409, (e as Error).message)
        throw e
      }
    } },

  { method: 'POST', path: '/v1/organizations/{id}/financial-years', tag: 'Chấm điểm', summary: 'Khai/cập nhật BCTC một năm', auth: 'user', action: 'upsertFinancialYear', args: (s) => [P(s, 'id'), B(s)] },
  { method: 'POST', path: '/v1/organizations/{id}/credit-profile', tag: 'Chấm điểm', summary: 'Cập nhật dữ liệu hồ sơ tín dụng', auth: 'user', action: 'updateProfile', args: (s) => [P(s, 'id'), B(s)] },
  { method: 'POST', path: '/v1/listed/{symbol}/refresh', tag: 'Chấm điểm', summary: 'Nạp dữ liệu niêm yết của mã đã khai', auth: 'user', action: 'refreshListed', args: (s) => [P(s, 'symbol')] },

  // ---- thanh toán sớm ----
  { method: 'POST', path: '/v1/early-payment-offers', tag: 'Bên mua', summary: 'Bên mua đề nghị thanh toán sớm có chiết khấu', auth: 'user', action: 'createEarlyOffer', args: (s) => [B(s)], body: { receivableId: 'string', discountPct: 'number', payBy: 'YYYY-MM-DD' } },
  { method: 'POST', path: '/v1/early-payment-offers/{id}/accept', tag: 'Bên mua', summary: 'Nhà cung cấp đồng ý thanh toán sớm', auth: 'user', action: 'acceptEarlyOffer', args: (s) => [P(s, 'id')] },
  { method: 'POST', path: '/v1/early-payment-offers/{id}/paid', tag: 'Bên mua', summary: 'Bên mua ghi nhận đã trả sớm (cần MFA)', auth: 'user', action: 'payEarlyOffer', args: (s) => [P(s, 'id')] },

  // ---- ESG ----
  { method: 'POST', path: '/v1/esg-assessments', tag: 'ESG', summary: 'Mở hồ sơ ESG của tổ chức', auth: 'user', action: 'ensureEsg', args: (s) => [B(s).orgId], body: { orgId: 'string' } },
  { method: 'PUT', path: '/v1/esg-assessments/{id}/indicators/{code}', tag: 'ESG', summary: 'Doanh nghiệp khai/FCC xác nhận mức một chỉ tiêu', auth: 'user', action: 'updateIndicator', args: (s) => [P(s, 'id'), P(s, 'code'), B(s)] },
  { method: 'POST', path: '/v1/esg-assessments/{id}/evidence', tag: 'ESG', summary: 'Thêm bằng chứng', auth: 'user', action: 'addEsgDocument', args: (s) => [P(s, 'id'), B(s)] },
  { method: 'POST', path: '/v1/esg-assessments/{id}/metrics', tag: 'ESG', summary: 'Cập nhật số liệu (điện, nhiên liệu…)', auth: 'user', action: 'updateEsgMetrics', args: (s) => [P(s, 'id'), B(s)] },
  { method: 'POST', path: '/v1/esg-assessments/{id}/industry', tag: 'ESG', summary: 'Đổi nhóm ngành (trọng số)', auth: 'user', action: 'setEsgIndustry', args: (s) => [P(s, 'id'), B(s).industryGroup] },
  { method: 'POST', path: '/v1/esg-assessments/{id}/issue', tag: 'ESG', summary: 'FCC phát hành điểm ESG (cần MFA)', auth: 'user', action: 'issueEsg', args: (s) => [P(s, 'id'), B(s).official !== false], body: { official: 'boolean' } },

  // ---- dòng tiền, chia sẻ, thông báo, nhật ký ----
  { method: 'POST', path: '/v1/organizations/{id}/cash-profile', tag: 'Kế toán & dòng tiền', summary: 'Số dư tiền và chi định kỳ', auth: 'user', action: 'saveCashProfile', args: (s) => [P(s, 'id'), B(s)] },
  { method: 'POST', path: '/v1/accounting-imports', tag: 'Kế toán & dòng tiền', summary: 'Nhập công nợ phải thu/phải trả', auth: 'user', action: 'importLedger', args: (s) => [B(s).orgId, B(s).items], body: { orgId: 'string', items: 'LedgerItem[]' } },
  { method: 'POST', path: '/v1/consents/{id}/revoke', tag: 'Chia sẻ dữ liệu', summary: 'Thu hồi quyền chia sẻ', auth: 'user', action: 'revokeConsent', args: (s) => [P(s, 'id')] },
  { method: 'POST', path: '/v1/notifications/read', tag: 'Tài khoản', summary: 'Đánh dấu đã đọc thông báo', auth: 'user', action: 'markNotificationsRead', args: () => [] },
  { method: 'GET', path: '/v1/audit-events', tag: 'Nhật ký', summary: 'Nhật ký (lọc ?from=&to= ISO; cursor). FCC xem toàn hệ thống, tổ chức xem sự kiện của mình', auth: 'user',
    run: (s, core) => {
      const fcc = orgOf(core, s.a!.activeOrgId)?.type === 'fcc'
      const all = fcc ? core.getState().audit : view(core, s.a!.activeOrgId).audit
      const xs = all.filter((e) => (!s.query.from || e.at >= s.query.from) && (!s.query.to || e.at <= s.query.to))
      return page(xs, s.query)
    } },
  { method: 'GET', path: '/v1/audit-events/integrity', tag: 'Nhật ký', summary: 'Kiểm tra chuỗi băm nhật ký (FCC)', auth: 'user',
    run: async (s, core) => {
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'fcc') throw forbidden('Chỉ nhân sự FCC')
      return core.db.verifyAudit()
    } },

  // ---- ngân hàng giả lập, bút toán, dự báo ----
  { method: 'POST', path: '/v1/bank/link', tag: 'Kế toán & dòng tiền', summary: 'Liên kết tài khoản với ngân hàng GIẢ LẬP (phase này chưa kết nối ngân hàng thật); cần khai số dư trước', auth: 'user', action: 'linkBank', args: (s) => [s.a!.activeOrgId] },
  { method: 'GET', path: '/v1/bank/statement', tag: 'Kế toán & dòng tiền', summary: 'Sao kê (?from=&to=) dựng từ sự kiện tiền trên FCC, ghi rõ nguồn giả lập', auth: 'user',
    run: (s, core) => bankStatement(core, s.a!.activeOrgId, s.query.from ?? '2000-01-01', s.query.to ?? core.clock().toISOString().slice(0, 10)) },
  { method: 'GET', path: '/v1/journal-entries', tag: 'Kế toán & dòng tiền', summary: 'Bút toán đề xuất theo chế độ ?regime=TT133|TT200, kèm trạng thái duyệt', auth: 'user', run: (s, core) => journalFor(core, s.a!.activeOrgId, parseRegime(s.query.regime)) },
  { method: 'POST', path: '/v1/journal-entries/decision', tag: 'Kế toán & dòng tiền', summary: 'Kế toán duyệt hoặc từ chối một bút toán (có thể sửa dòng, phải cân Nợ/Có)', auth: 'user', body: { ref: 'string', status: 'approved|rejected', lines: 'JournalLine[] (tùy chọn)', note: 'string', regime: 'TT133|TT200' },
    run: async (s, core) => {
      if (!['owner', 'approver', 'operator'].includes(s.a!.role)) throw forbidden('Chỉ kế toán của doanh nghiệp')
      const regime = parseRegime(String(B(s).regime ?? ''))
      const cur = (await journalFor(core, s.a!.activeOrgId, regime)).entries.find((e) => e.ref === B(s).ref)
      if (!cur) throw notFound('Không tìm thấy bút toán')
      const status = B(s).status
      if (status !== 'approved' && status !== 'rejected') throw bad('status phải là approved hoặc rejected')
      const lines = (B(s).lines ?? undefined) as JournalEntry['lines'] | undefined
      if (lines) {
        const d = lines.reduce((t, l) => t + Number(l.debit || 0), 0)
        const c = lines.reduce((t, l) => t + Number(l.credit || 0), 0)
        if (!lines.length || d !== c || d <= 0) throw bad('Bút toán sau khi sửa phải cân Nợ = Có')
        if (lines.some((l) => !/^\d{3,4}$/.test(String(l.account)))) throw bad('Số hiệu tài khoản không hợp lệ')
      }
      await core.db.decideJournal(s.a!.activeOrgId, String(B(s).ref), { status, lines, note: String(B(s).note ?? '').slice(0, 300) || undefined, by: s.a!.id })
      await core.audit(s.a!.activeOrgId, s.a!.id, status === 'approved' ? 'Duyệt bút toán' : 'Từ chối bút toán', String(B(s).ref), lines ? 'có chỉnh sửa' : 'giữ nguyên đề xuất', s.req.id)
      return { ok: true }
    } },
  { method: 'GET', path: '/v1/journal-entries/export.csv', tag: 'Kế toán & dòng tiền', summary: 'Xuất các bút toán đã duyệt (CSV nhập vào phần mềm kế toán); có thể phát sinh phí báo cáo', auth: 'user',
    run: async (s, core) => {
      const approved = (await journalFor(core, s.a!.activeOrgId, parseRegime(s.query.regime))).entries.filter((e) => e.status === 'approved')
      await chargeReport(core, s.a!.activeOrgId, 'bút toán', `${s.a!.id}:${core.clock().getTime()}`)
      s.reply.type('text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="but-toan.csv"')
      return toCsv(approved)
    } },
  { method: 'POST', path: '/v1/cashflow-forecasts', tag: 'Kế toán & dòng tiền', summary: 'Tính và lưu dự báo 7/30/90 ngày (ba kịch bản) từ số dư (sao kê nếu đã liên kết), công nợ và hóa đơn trên FCC', auth: 'user',
    run: async (s, core) => {
      const r = await computeAndStoreForecast(core, s.a!.activeOrgId)
      return { stored: r.stored, asOf: r.forecast.asOf, opening: r.opening, modelVersion: r.modelVersion, inputsHash: r.inputsHash, summary: { minBase: r.forecast.minBase, shortfall: r.forecast.shortfall ?? null, inflow: r.forecast.inflow, outflow: r.forecast.outflow }, points: r.forecast.points, note: 'Dự báo – không phải cam kết' }
    } },
  { method: 'GET', path: '/v1/cashflow-forecasts/latest', tag: 'Kế toán & dòng tiền', summary: 'Dự báo đã lưu gần nhất', auth: 'user', run: async (s, core) => (await core.db.latestForecast(s.a!.activeOrgId)) ?? (() => { throw notFound('Chưa có dự báo đã lưu') })() },
  { method: 'GET', path: '/v1/cashflow-forecasts/accuracy', tag: 'Kế toán & dòng tiền', summary: 'Sai số dự báo thu (ngày) trên các khoản phải thu đã thanh toán', auth: 'user', run: (s, core) => forecastAccuracy(core, s.a!.activeOrgId) },

  // ---- phí, hóa đơn phí, doanh thu ----
  { method: 'GET', path: '/v1/fee-schedule', tag: 'Phí', summary: 'Biểu phí đang hiệu lực (công khai cho người dùng trước khi phát sinh phí)', auth: 'user',
    run: async (_s, core) => ({ active: await scheduleAt(core.db, core.clock()), sources: FEE_SOURCES }) },
  { method: 'GET', path: '/v1/fees', tag: 'Phí', summary: 'Phí đã phát sinh của tổ chức (lọc ?period=YYYY-MM)', auth: 'user',
    run: async (s, core) => {
      const rows = await core.db.chargesOf(s.a!.activeOrgId, s.query.period)
      return { charges: rows.map((r) => ({ ...r, sourceLabel: feeSourceLabel(r.source), amount: Number(r.amount) })), total: rows.reduce((t, r) => t + Number(r.amount), 0) }
    } },
  { method: 'GET', path: '/v1/fees/invoice-link', tag: 'Phí', summary: 'Liên kết ký (10 phút) tới hóa đơn phí tháng, mở/in thành PDF từ trình duyệt', auth: 'user',
    run: (s, core) => {
      const period = s.query.period ?? new Date().toISOString().slice(0, 7)
      if (!/^\d{4}-\d{2}$/.test(period)) throw bad('period phải có dạng YYYY-MM')
      const exp = Math.floor(core.clock().getTime() / 1000) + 600
      const v = `${s.a!.activeOrgId}|${period}`
      return { url: `/v1/fees/invoice?org=${encodeURIComponent(s.a!.activeOrgId)}&period=${period}&exp=${exp}&sig=${core.files.signValue(v, exp)}` }
    } },
  { method: 'GET', path: '/v1/operations/revenue', tag: 'Vận hành FCC', summary: 'Doanh thu theo nguồn và tháng (FCC)', auth: 'user',
    run: async (s, core) => {
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'fcc') throw forbidden('Chỉ nhân sự FCC')
      const rows = await core.db.revenueBySource(s.query.from, s.query.to)
      const bySource = Object.keys(FEE_SOURCES).map((k) => ({ source: k, label: feeSourceLabel(k), total: rows.filter((r) => r.source === k).reduce((t, r) => t + Number(r.total), 0), count: rows.filter((r) => r.source === k).reduce((t, r) => t + Number(r.n), 0), paid: rows.filter((r) => r.source === k).reduce((t, r) => t + Number(r.paid), 0) }))
      return { bySource, byPeriod: rows.map((r) => ({ period: r.period, source: r.source, total: Number(r.total), count: Number(r.n), paid: Number(r.paid) })), total: bySource.reduce((t, x) => t + x.total, 0), paid: bySource.reduce((t, x) => t + x.paid, 0) }
    } },
  { method: 'GET', path: '/v1/operations/fee-schedules', tag: 'Vận hành FCC', summary: 'Các phiên bản biểu phí', auth: 'user',
    run: async (s, core) => {
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'fcc') throw forbidden('Chỉ nhân sự FCC')
      return core.db.feeSchedules()
    } },
  { method: 'POST', path: '/v1/operations/fee-schedules', tag: 'Vận hành FCC', summary: 'Tạo phiên bản biểu phí mới có hiệu lực từ ngày chỉ định (không đổi phí đã phát sinh; cần MFA)', auth: 'user', body: { name: 'string', params: 'FeeSchedule', effectiveFrom: 'YYYY-MM-DD (từ hôm nay trở đi)' },
    run: async (s, core) => {
      if (s.a!.role !== 'fcc_admin') throw forbidden('Chỉ quản trị FCC')
      core.requireStepUp(s.a!)
      const p = (B(s).params ?? {}) as Partial<FeeSchedule>
      const errs = validateSchedule(p)
      if (errs.length) throw bad(errs.join('; '))
      const from = new Date(`${String(B(s).effectiveFrom)}T00:00:00Z`)
      if (Number.isNaN(from.getTime()) || from.toISOString().slice(0, 10) < core.clock().toISOString().slice(0, 10)) throw bad('Ngày hiệu lực phải từ hôm nay trở đi')
      const id = uid('fee')
      await core.db.createFeeSchedule({ id, name: String(B(s).name ?? 'Biểu phí mới').slice(0, 120), params: p, effectiveFrom: from, createdBy: s.a!.id })
      await core.audit(s.a!.activeOrgId, s.a!.id, 'Tạo phiên bản biểu phí', id, String(B(s).name ?? ''), s.req.id)
      return { id }
    } },
  { method: 'POST', path: '/v1/operations/billing-run', tag: 'Vận hành FCC', summary: 'Chạy tính phí định kỳ (thuê bao SaaS, kết nối API) cho một tháng; chạy lại không tạo trùng', auth: 'user', body: { period: 'YYYY-MM' },
    run: async (s, core) => {
      if (s.a!.role !== 'fcc_admin') throw forbidden('Chỉ quản trị FCC')
      const period = String(B(s).period ?? '')
      if (!/^\d{4}-\d{2}$/.test(period)) throw bad('period phải có dạng YYYY-MM')
      const r = await billingRun(core, period)
      await core.audit(s.a!.activeOrgId, s.a!.id, 'Chạy tính phí định kỳ', period, `${r.created} khoản mới`, s.req.id)
      return r
    } },
  { method: 'POST', path: '/v1/operations/fees/mark-paid', tag: 'Vận hành FCC', summary: 'Ghi nhận khách hàng đã thanh toán phí của một tháng', auth: 'user', body: { orgId: 'string', period: 'YYYY-MM', reference: 'string' },
    run: async (s, core) => {
      if (s.a!.role !== 'fcc_admin') throw forbidden('Chỉ quản trị FCC')
      const n = await core.db.markChargesPaid(String(B(s).orgId), String(B(s).period), String(B(s).reference ?? '').slice(0, 100) || 'manual')
      await core.audit(s.a!.activeOrgId, s.a!.id, 'Ghi nhận thanh toán phí', String(B(s).orgId), `${B(s).period}: ${n} khoản`, s.req.id)
      return { updated: n }
    } },

  // ---- xuất báo cáo CSV (có thể có phí báo cáo theo biểu phí) ----
  { method: 'GET', path: '/v1/exports/receivables.csv', tag: 'Báo cáo', summary: 'Xuất danh sách khoản phải thu của tổ chức (CSV)', auth: 'user',
    run: async (s, core) => {
      const v = view(core, s.a!.activeOrgId)
      const type = orgOf(core, s.a!.activeOrgId)?.type
      if (type !== 'supplier' && type !== 'buyer') throw forbidden('Chỉ nhà cung cấp và bên mua')
      const mine = v.receivables.filter((r) => (type === 'supplier' ? r.sellerId : r.buyerId) === s.a!.activeOrgId)
      await chargeReport(core, s.a!.activeOrgId, 'khoản phải thu', `${s.a!.id}:${core.clock().getTime()}`)
      s.reply.type('text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="khoan-phai-thu.csv"')
      return csv(['ma', 'so_hoa_don', 'doi_tac', 'so_tien', 'ngay_lap', 'han_thanh_toan', 'trang_thai'], mine.map((r) => [r.code, `${r.invoiceSeries}-${r.invoiceNumber}`, v.orgs.find((o) => o.id === (type === 'supplier' ? r.buyerId : r.sellerId))?.name ?? '', r.amount, r.issueDate, r.dueDate, r.state]))
    } },
  { method: 'GET', path: '/v1/exports/portfolio.csv', tag: 'Báo cáo', summary: 'Xuất danh mục hồ sơ tài trợ của tổ chức tài chính (CSV)', auth: 'user',
    run: async (s, core) => {
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'lender') throw forbidden('Chỉ tổ chức tài chính')
      const v = view(core, s.a!.activeOrgId)
      const apps = v.applications.filter((a) => a.lenderId === s.a!.activeOrgId)
      await chargeReport(core, s.a!.activeOrgId, 'danh mục', `${s.a!.id}:${core.clock().getTime()}`)
      s.reply.type('text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="danh-muc.csv"')
      return csv(['ho_so', 'hoa_don', 'doanh_nghiep', 'trang_thai', 'ung_truoc', 'lai_suat', 'du_no'], apps.map((a) => { const r = v.receivables.find((x) => x.id === a.receivableId); return [a.id, r?.code ?? '', r ? v.orgs.find((o) => o.id === r.sellerId)?.name ?? '' : '', a.state, a.offer?.advanceVnd ?? '', a.offer?.ratePct ?? '', a.outstanding ?? ''] }))
    } },

  // ---- cập nhật tức thời (SSE) ----
  { method: 'POST', path: '/v1/events/ticket', tag: 'Tức thời', summary: 'Lấy vé (60 giây) để mở kết nối SSE', auth: 'user',
    run: async (s, core) => {
      const ticket = randomBytes(24).toString('base64url')
      await core.db.createSseTicket(createHash('sha256').update(ticket).digest('hex'), s.a!.tokenHash, 60_000)
      return { ticket, url: `/v1/events?ticket=${ticket}` }
    } },

  // ---- khóa tích hợp & địa chỉ webhook (người dùng của tổ chức tài chính quản lý) ----
  { method: 'GET', path: '/v1/integration-keys', tag: 'Tích hợp đối tác', summary: 'Khóa tích hợp của tổ chức', auth: 'user',
    run: async (s, core) => ({ keys: await core.db.integrationKeys(s.a!.activeOrgId), scopes: SCOPES, endpoint: (await core.db.partnerEndpoint(s.a!.activeOrgId)) ?? null }) },
  { method: 'POST', path: '/v1/integration-keys', tag: 'Tích hợp đối tác', summary: 'Tạo khóa tích hợp (chỉ hiển thị một lần; chủ tổ chức, cần MFA)', auth: 'user', body: { name: 'string', scopes: `(${Object.keys(SCOPES).join('|')})[]` },
    run: async (s, core) => {
      if (!isAdminRole(s.a!.role)) throw forbidden('Chỉ chủ tổ chức tạo khóa tích hợp')
      core.requireStepUp(s.a!)
      if (orgOf(core, s.a!.activeOrgId)?.type !== 'lender') throw forbidden('Khóa tích hợp dành cho tổ chức tài chính')
      const scopes = Array.isArray(B(s).scopes) ? (B(s).scopes as string[]) : []
      if (!scopes.length || !scopes.every((x) => x in SCOPES)) throw bad(`Phạm vi hợp lệ: ${Object.keys(SCOPES).join(', ')}`)
      const name = String(B(s).name ?? '').trim().slice(0, 80) || 'Khóa tích hợp'
      const k = newIntegrationKey()
      await core.db.createIntegrationKey({ id: k.id, orgId: s.a!.activeOrgId, name, scopes, keyHash: k.hash, createdBy: s.a!.id })
      return { id: k.id, token: k.token, scopes, note: 'Lưu khóa ngay — FCC không lưu bản gốc và không hiển thị lại.' }
    } },
  { method: 'POST', path: '/v1/integration-keys/{id}/revoke', tag: 'Tích hợp đối tác', summary: 'Thu hồi khóa tích hợp', auth: 'user',
    run: async (s, core) => {
      if (!isAdminRole(s.a!.role)) throw forbidden('Chỉ chủ tổ chức')
      if (!(await core.db.revokeIntegrationKey(s.a!.activeOrgId, P(s, 'id')))) throw notFound('Không tìm thấy khóa')
      return { ok: true }
    } },
  { method: 'POST', path: '/v1/partner-endpoint', tag: 'Tích hợp đối tác', summary: 'Đặt địa chỉ nhận webhook (HTTPS; http chỉ cho localhost)', auth: 'user', body: { url: 'string | null' },
    run: async (s, core) => {
      if (!isAdminRole(s.a!.role)) throw forbidden('Chỉ chủ tổ chức')
      const url = B(s).url
      if (url !== null) {
        let u: URL
        try {
          u = new URL(String(url))
        } catch {
          throw bad('URL không hợp lệ')
        }
        if (!(u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)))) throw bad('Địa chỉ webhook phải dùng HTTPS')
      }
      await core.db.setPartnerEndpoint(s.a!.activeOrgId, url === null ? null : String(url))
      return { ok: true }
    } },
  { method: 'GET', path: '/v1/partner-endpoint/deliveries', tag: 'Tích hợp đối tác', summary: 'Lịch sử gửi webhook', auth: 'user', run: async (s, core) => core.db.webhookDeliveries(s.a!.activeOrgId) },

  // ---- vận hành: tổ chức tài chính giả lập ----
  { method: 'POST', path: '/v1/operations/sim-banks/provision', tag: 'Vận hành FCC', summary: 'Cấp phát 3 tổ chức tài chính giả lập (sim-bank); trả khóa tích hợp và khóa ký (chỉ hiển thị một lần)', auth: 'user',
    body: { endpoint: 'URL gốc của sim-bank, ví dụ http://127.0.0.1:8790' },
    run: async (s, core) => {
      if (s.a!.role !== 'fcc_admin') throw forbidden('Chỉ quản trị FCC')
      core.requireStepUp(s.a!)
      const endpoint = String(B(s).endpoint ?? '')
      if (!/^https?:\/\//.test(endpoint)) throw bad('Cần endpoint của sim-bank')
      return { institutions: await provisionSimBanks(core, endpoint) }
    } },

  // ---- API đối tác (khóa tích hợp) ----
  { method: 'GET', path: '/v1/partner/rfqs', tag: 'API đối tác', summary: 'RFQ gửi tới tổ chức kèm gói tóm tắt được chia sẻ', auth: 'partner', scope: 'packages:read',
    run: (s, core) => {
      const v = view(core, s.p!.orgId)
      const mine = new Set(v.products.filter((p) => p.lenderId === s.p!.orgId).map((p) => p.id))
      // gói tóm tắt: khoản phải thu + điểm hồ sơ (quyền chia sẻ của RFQ gồm credit_score)
      return page(v.rfqs.filter((q) => q.productIds.some((p) => mine.has(p))).map((q) => ({ ...q, receivable: v.receivables.find((r) => r.id === q.receivableId), score: applicationScoreOf(core.getState(), q.receivableId) })), s.query)
    } },
  { method: 'GET', path: '/v1/partner/applications', tag: 'API đối tác', summary: 'Hồ sơ tài trợ gửi tới tổ chức (gói đầy đủ theo quyền chia sẻ)', auth: 'partner', scope: 'packages:read',
    run: (s, core) => {
      const v = view(core, s.p!.orgId)
      const st = core.getState()
      return page(v.applications.filter((a) => a.lenderId === s.p!.orgId).map((a) => ({
        ...a,
        receivable: v.receivables.find((r) => r.id === a.receivableId),
        product: st.products.find((p) => p.id === a.productId),
        // báo giá sơ bộ của chính tổ chức này trong RFQ đã được chọn
        quote: a.rfqId ? st.rfqs.find((q) => q.id === a.rfqId)?.responses.find((x) => x.lenderId === s.p!.orgId) : undefined,
        score: applicationScoreOf(st, a.receivableId),
      })), s.query)
    } },
  { method: 'GET', path: '/v1/partner/products', tag: 'API đối tác', summary: 'Sản phẩm của tổ chức', auth: 'partner', scope: 'products:write',
    run: (s, core) => core.getState().products.filter((p) => p.lenderId === s.p!.orgId) },
  { method: 'POST', path: '/v1/partner/products', tag: 'API đối tác', summary: 'Đăng/sửa sản phẩm', auth: 'partner', scope: 'products:write', action: 'upsertProduct', args: (s) => [B(s)] },
  { method: 'POST', path: '/v1/partner/products/{id}/status', tag: 'API đối tác', summary: 'Tạm dừng/mở lại sản phẩm', auth: 'partner', scope: 'products:write', action: 'setProductStatus', args: (s) => [P(s, 'id'), B(s).status] },
  { method: 'POST', path: '/v1/partner/rfqs/{id}/responses', tag: 'API đối tác', summary: 'Trả báo giá/từ chối RFQ', auth: 'partner', scope: 'rfqs:respond', action: 'respondRfq', args: (s) => [P(s, 'id'), B(s)] },
  { method: 'POST', path: '/v1/partner/applications/{id}/review', tag: 'API đối tác', summary: 'Bắt đầu thẩm định', auth: 'partner', scope: 'applications:write', action: 'startReview', args: (s) => [P(s, 'id')] },
  { method: 'POST', path: '/v1/partner/applications/{id}/offer', tag: 'API đối tác', summary: 'Ra đề nghị chính thức', auth: 'partner', scope: 'applications:write', action: 'makeOffer', args: (s) => [P(s, 'id'), B(s)] },
  { method: 'POST', path: '/v1/partner/applications/{id}/reject', tag: 'API đối tác', summary: 'Từ chối hồ sơ', auth: 'partner', scope: 'applications:write', action: 'rejectApp', args: (s) => [P(s, 'id'), B(s).reason] },
  { method: 'POST', path: '/v1/partner/events', tag: 'API đối tác', summary: 'Sự kiện tiền từ tổ chức tài chính (ký x-fcc-signature: t=,v1=; id sự kiện chống xử lý lặp)', auth: 'partner', scope: 'events:write',
    body: { id: 'string (duy nhất theo đối tác)', type: 'application.funded', data: 'object' },
    run: async (s, core) => {
      const raw = (s.req as FastifyRequest & { rawBody?: string }).rawBody ?? ''
      if (!verifySignature(await core.db.getWebhookSecret(s.p!.orgId), String(s.req.headers['x-fcc-signature'] ?? ''), raw, core.clock().getTime())) throw new HttpError(401, 'Chữ ký không hợp lệ hoặc quá hạn (±5 phút)')
      const { id, type, data } = B(s) as { id?: string; type?: string; data?: Json }
      if (!id || typeof id !== 'string' || id.length > 100) throw bad('Thiếu id sự kiện')
      const key = `partner-event:${s.p!.orgId}:${id}`
      const prior = await core.db.getIdempotent(key)
      if (prior) {
        s.reply.header('x-idempotent-replay', 'true')
        return JSON.parse(prior)
      }
      const handler = PARTNER_EVENTS[String(type)]
      if (!handler) throw bad(`Loại sự kiện chưa hỗ trợ: ${type}. Hỗ trợ: ${Object.keys(PARTNER_EVENTS).join(', ')}`)
      const result = await handler(core, s.p!, data ?? {}, s.req.id, id)
      const body = { ok: true, id, type, result }
      await core.db.putIdempotent(key, JSON.stringify(body))
      return body
    } },
]

/** Sự kiện tiền đối tác gửi vào (id sự kiện là externalEventId: gửi lại không ghi nhận hai lần). */
async function partnerAction(core: Core, p: PartnerAuth, correlationId: string, action: string, data: Json, extra: Json) {
  const id = String(data.applicationId ?? '')
  const ap = core.getState().applications.find((x) => x.id === id)
  if (!ap || ap.lenderId !== p.orgId) throw notFound('Không tìm thấy hồ sơ của tổ chức này')
  const fn = actions[action]
  const { applicationId: _a, ...rest } = data
  void _a
  return core.mutate({ kind: 'partner', orgId: p.orgId, role: 'analyst', keyId: p.keyId, correlationId }, (c) => fn(c, id, { ...rest, ...extra }))
}

export const PARTNER_EVENTS: Record<string, (core: Core, p: PartnerAuth, data: Json, correlationId: string, eventId: string) => Promise<unknown>> = {
  'application.funded': async (core, p, data, correlationId) => {
    const ap = core.getState().applications.find((x) => x.id === data.applicationId)
    if (!ap || ap.lenderId !== p.orgId) throw notFound('Không tìm thấy hồ sơ của tổ chức này')
    return { changed: await core.mutate({ kind: 'partner', orgId: p.orgId, role: 'analyst', keyId: p.keyId, correlationId }, (c) => fundApplication(c, ap, 'sự kiện từ hệ thống tổ chức tài chính')) }
  },
  'application.payment_received': (core, p, data, cid, eventId) => partnerAction(core, p, cid, 'confirmPayment', data, { kind: 'payment', externalEventId: eventId }),
  'application.collateral_liquidated': (core, p, data, cid, eventId) => partnerAction(core, p, cid, 'confirmPayment', data, { kind: 'collateral', externalEventId: eventId }),
  'application.refund_paid': (core, p, data, cid, eventId) => partnerAction(core, p, cid, 'confirmRefund', data, { externalEventId: eventId }),
}

const fastifyPath = (p: string) => p.replace(/\{(\w+)\}/g, ':$1')

export function v1Routes(app: FastifyInstance, core: Core) {
  core.onEvents((events) => enqueueEvents(core.db, events))

  for (const ep of ENDPOINTS) {
    app.route({
      method: ep.method,
      url: fastifyPath(ep.path),
      handler: async (req, reply) => {
        const s: Src = { params: req.params as Record<string, string>, body: (req.body ?? {}) as Json, query: req.query as Src['query'], req, reply }
        if (ep.auth === 'user') s.a = await core.auth(req)
        if (ep.auth === 'partner') s.p = await partnerAuth(core.db, req, ep.scope!)

        // Idempotency-Key cho mọi POST/PUT: gọi lặp cùng khóa trả lại đúng kết quả lần đầu
        const idem = ep.method !== 'GET' ? String(req.headers['idempotency-key'] ?? '').slice(0, 100) : ''
        const idemKey = idem ? `v1:${s.a?.id ?? s.p?.keyId}:${ep.method}:${req.url}:${idem}` : ''
        if (idemKey) {
          const prior = await core.db.getIdempotent(idemKey)
          if (prior) return reply.header('x-idempotent-replay', 'true').send(JSON.parse(prior))
        }

        let out: unknown
        if (ep.action) {
          const fn = actions[ep.action]
          const args = ep.args ? ep.args(s) : []
          if (s.a) {
            core.authorize(s.a, ep.action)
            if (ep.check === 'receivableFiles') {
              const files = (B(s).files ?? []) as { key?: unknown }[]
              for (const f of Array.isArray(files) ? files : []) if (typeof f?.key !== 'string' || !(await core.db.fileOf(f.key, s.a.activeOrgId))) throw bad('Chứng từ chưa được tải lên bởi tổ chức này')
            }
            const result = await core.mutate({ kind: 'user', user: s.a, correlationId: req.id }, (c) => fn(c, ...args))
            out = { result: result ?? null, version: core.version() }
          } else {
            const role = SCOPES[ep.scope!].role
            const result = await core.mutate({ kind: 'partner', orgId: s.p!.orgId, role, keyId: s.p!.keyId, correlationId: req.id }, (c) => fn(c, ...args))
            out = { result: result ?? null, version: core.version() }
          }
        } else {
          out = await ep.run!(s, core)
        }
        if (idemKey) await core.db.putIdempotent(idemKey, JSON.stringify(out))
        return out
      },
    })
  }

  // SSE: client mở EventSource với vé ngắn hạn; mỗi thay đổi dữ liệu gửi `change` kèm version mới
  app.get('/v1/events', async (req, reply) => {
    const ticket = String((req.query as { ticket?: string }).ticket ?? '')
    const sessionHash = ticket ? await core.db.useSseTicket(createHash('sha256').update(ticket).digest('hex')) : undefined
    if (!sessionHash) throw new HttpError(401, 'Vé SSE không hợp lệ hoặc đã dùng')
    await core.authByHash(sessionHash)
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' })
    res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ version: core.version() })}\n\n`)
    const off = core.onChange((v) => res.write(`event: change\ndata: ${JSON.stringify({ version: v })}\n\n`))
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
    let checking = false
    // phiên bị thu hồi/hết hạn thì đóng luồng
    const recheck = setInterval(async () => {
      if (checking) return
      checking = true
      try {
        await core.authByHash(sessionHash)
      } catch {
        res.end()
      } finally {
        checking = false
      }
    }, 60_000)
    req.raw.on('close', () => {
      off()
      clearInterval(ping)
      clearInterval(recheck)
    })
  })

  // Hóa đơn phí in được (HTML → in thành PDF từ trình duyệt). Truy cập bằng liên kết ký ngắn hạn từ /v1/fees/invoice-link.
  app.get('/v1/fees/invoice', async (req, reply) => {
    const q = req.query as { org?: string; period?: string; exp?: string; sig?: string }
    if (!q.org || !q.period || !core.files.verifyValue(`${q.org}|${q.period}`, Number(q.exp), String(q.sig ?? ''), core.clock().getTime())) throw new HttpError(403, 'Liên kết không hợp lệ hoặc đã hết hạn')
    const org = core.getState().orgs.find((o) => o.id === q.org)
    if (!org) throw notFound('Không tìm thấy tổ chức')
    const rows = await core.db.chargesOf(org.id, q.period)
    const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
    const total = rows.reduce((t, r) => t + Number(r.amount), 0)
    return reply.type('text/html; charset=utf-8').send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn phí FCC ${esc(q.period)}</title>
<style>body{font:14px system-ui;margin:32px;color:#10201b}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:16px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}td.r,th.r{text-align:right}.muted{color:#5e6e67}@media print{button{display:none}}</style></head><body>
<button onclick="print()">In / lưu PDF</button>
<h1>Bảng kê phí dịch vụ FCC — tháng ${esc(q.period)}</h1>
<p>${esc(org.name)} · MST ${esc(org.taxCode)}</p>
<table><thead><tr><th>Nội dung</th><th>Nguồn</th><th>Biểu phí</th><th class="r">Số tiền (₫)</th><th>Thanh toán</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${esc(r.description)}</td><td>${esc(feeSourceLabel(r.source))}</td><td>${esc(r.scheduleId)}</td><td class="r">${Number(r.amount).toLocaleString('vi-VN')}</td><td>${r.paidAt ? 'Đã thanh toán' : 'Chưa'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Không phát sinh phí trong tháng.</td></tr>'}
</tbody><tfoot><tr><th colspan="3">Tổng</th><th class="r">${total.toLocaleString('vi-VN')}</th><th></th></tr></tfoot></table>
<p class="muted">Bảng kê này không phải hóa đơn giá trị gia tăng. FCC không giữ tiền của khách hàng; phí được tính theo biểu phí đã công bố tại thời điểm phát sinh.</p></body></html>`)
  })

  app.get('/v1/openapi.json', async () => openApi())
}

export function openApi() {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const ep of ENDPOINTS) {
    const params = [...ep.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }))
    const op: Record<string, unknown> = {
      tags: [ep.tag], summary: ep.summary,
      security: ep.auth === 'user' ? [{ session: [] }] : ep.auth === 'partner' ? [{ integrationKey: [ep.scope] }] : [],
      parameters: [...params, ...(ep.method !== 'GET' ? [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }] : [])],
      responses: { 200: { description: 'Thành công' }, 401: { description: 'Chưa xác thực / cần MFA' }, 403: { description: 'Không đủ quyền' }, 404: { description: 'Không tìm thấy' }, 409: { description: 'Xung đột trạng thái' }, 422: { description: 'Dữ liệu không hợp lệ' } },
      ...(ep.action ? { 'x-fcc-action': ep.action } : {}),
    }
    if (ep.body) op.requestBody = { content: { 'application/json': { schema: { type: 'object', properties: Object.fromEntries(Object.entries(ep.body).map(([k, v]) => [k, { description: v }])) } } } }
    paths[ep.path] = { ...(paths[ep.path] ?? {}), [ep.method.toLowerCase()]: op }
  }
  paths['/v1/events'] = { get: { tags: ['Tức thời'], summary: 'Luồng SSE (?ticket= từ POST /v1/events/ticket); sự kiện hello, change', parameters: [{ name: 'ticket', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'text/event-stream' } } } }
  paths['/v1/openapi.json'] = { get: { tags: ['Tài liệu'], summary: 'Tài liệu OpenAPI này', responses: { 200: { description: 'OpenAPI 3.1' } } } }
  paths['/v1/fees/invoice'] = { get: { tags: ['Phí'], summary: 'Bảng kê phí tháng (HTML in được) bằng liên kết ký từ /v1/fees/invoice-link', parameters: ['org', 'period', 'exp', 'sig'].map((n) => ({ name: n, in: 'query', required: true, schema: { type: 'string' } })), responses: { 200: { description: 'text/html' }, 403: { description: 'Liên kết hết hạn' } } } }
  paths['/v1/files/{key}'] = { get: { tags: ['Tệp'], summary: 'Tải tệp bằng URL ký (?exp=&sig= từ GET /api/files/{key}/url)', parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Nội dung tệp' }, 403: { description: 'Liên kết hết hạn' } } } }
  return {
    openapi: '3.1.0',
    info: { title: 'FCC — Fast Cash Connect API', version: '1.0.0', description: 'Xếp hạng/điểm là tham khảo FCC — không phải quyết định tín dụng. Tiền là số nguyên VND. Thời gian lưu UTC.' },
    components: {
      securitySchemes: {
        session: { type: 'http', scheme: 'bearer', description: 'Phiên người dùng từ POST /api/auth/login' },
        integrationKey: { type: 'http', scheme: 'bearer', description: 'Khóa tích hợp fcck_<id>.<bí mật> (POST /v1/integration-keys)' },
      },
    },
    paths,
  }
}
