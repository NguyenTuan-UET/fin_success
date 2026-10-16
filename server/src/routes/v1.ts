// API REST /v1. Bảng ENDPOINTS là nguồn duy nhất: vừa đăng ký route, vừa sinh tài liệu OpenAPI (GET /v1/openapi.json).
// Hành động ghi chạy qua cùng luật nghiệp vụ (service.ts) và cùng ma trận quyền/MFA như giao diện.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createHash, randomBytes } from 'node:crypto'
import { matchProduct, rankMatches } from '@fcc/domain/marketplace'
import { ewsAlerts } from '@fcc/domain/ews'
import { applicationScoreOf, buyerScoreOf, esgOf, supplierScoreOf } from '@fcc/domain/engine'
import type { Authed, Core } from '../core'
import { actions, fundApplication, matchContextFor } from '../service'
import { viewFor } from '../views'
import { HttpError, bad, forbidden, notFound } from '../errors'
import { enqueueEvents, newIntegrationKey, partnerAuth, SCOPES, verifySignature, type PartnerAuth, type Scope } from '../integrations/partner'
import { isAdminRole } from '../auth/roles'
import type { State } from '../state'
import { provisionSimBanks } from '../sim/provision'

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
  { method: 'POST', path: '/v1/receivables/{id}/cancel', tag: 'Khoản phải thu', summary: 'Hủy khoản phải thu', auth: 'user', action: 'cancelReceivable', args: (s) => [P(s, 'id')] },
  { method: 'POST', path: '/v1/receivables/{id}/buyer-payment', tag: 'Bên mua', summary: 'Bên mua ghi nhận đã thanh toán (cần MFA)', auth: 'user', action: 'markBuyerPaid', args: (s) => [P(s, 'id')] },
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
      const result = await handler(core, s.p!, data ?? {}, s.req.id)
      const body = { ok: true, id, type, result }
      await core.db.putIdempotent(key, JSON.stringify(body))
      return body
    } },
]

/** Sự kiện tiền đối tác gửi vào. WP8 bổ sung thanh toán/tất toán/quá hạn/xử lý tài sản bảo đảm. */
export const PARTNER_EVENTS: Record<string, (core: Core, p: PartnerAuth, data: Json, correlationId: string) => Promise<unknown>> = {
  'application.funded': async (core, p, data, correlationId) => {
    const ap = core.getState().applications.find((x) => x.id === data.applicationId)
    if (!ap || ap.lenderId !== p.orgId) throw notFound('Không tìm thấy hồ sơ của tổ chức này')
    return { changed: await core.mutate({ kind: 'partner', orgId: p.orgId, role: 'analyst', keyId: p.keyId, correlationId }, (c) => fundApplication(c, ap, 'sự kiện từ hệ thống tổ chức tài chính')) }
  },
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
