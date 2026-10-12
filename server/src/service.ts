// Luật nghiệp vụ FCC chạy phía máy chủ. Mỗi hành động kiểm tra quyền theo tổ chức đăng nhập (actor),
// kiểm tra trạng thái hợp lệ, rồi mới thay đổi dữ liệu. Chuyển từ web/src/store.ts (trước đây chạy ở trình duyệt).
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AccountingConnection, Consent, CreditProfile, EarlyPaymentOffer, EsgAssessment, EsgDocument, EsgIndicatorResult, FinancialYear,
  FinancingProduct, FundingApplication, LedgerItem, ListedSnapshot, Org, Receivable, ReceivableState, Rfq, RfqResponse,
} from '../../web/src/domain/types'
import { iso } from '../../web/src/data/seed'
import { applicationScoreOf, buyerScoreOf, esgOf, supplierScoreOf } from '../../web/src/domain/engine'
import { estimateCost, matchProduct, tenorOf } from '../../web/src/domain/marketplace'
import { RATING_ORDER } from '../../web/src/domain/credit'
import { bad, conflict, forbidden, notFound, unprocessable } from './errors'
import type { State } from './state'

export type Role = 'member' | 'fcc_reviewer'
export interface OtpProof { id: string; code: string }

export interface Ctx {
  actor: Org
  role: Role
  /** Bản nháp trạng thái — chỉ được ghi nhận khi hành động thành công. */
  s: State
  now: Date
  demo: boolean
  listedDir: string
  /** Xác thực OTP đã cấp cho (actor, purpose, entity); ném lỗi nếu sai/hết hạn/đã dùng. */
  checkOtp: (purpose: string, entity: string, proof: OtpProof | undefined) => void
}

const uid = (p: string) => `${p}-${randomBytes(4).toString('hex').toUpperCase()}`
const vnd = (n: number) => n.toLocaleString('vi-VN')
const DAY = 86_400_000
const ACTIVE_APP = (a: FundingApplication) => !['REJECTED', 'WITHDRAWN'].includes(a.state)

// ---------------- helper ----------------
const orgName = (c: Ctx, id: string) => c.s.orgs.find((o) => o.id === id)?.shortName ?? id
function log(c: Ctx, action: string, entity: string, detail: string) {
  c.s.audit = [{ id: uid('EV'), at: c.now.toISOString(), actorOrgId: c.actor.id, action, entity, detail }, ...c.s.audit].slice(0, 1000)
}
function notify(c: Ctx, orgId: string, title: string, body: string, link?: string) {
  c.s.notifications = [{ id: uid('N'), orgId, at: c.now.toISOString(), title, body, link, read: false }, ...c.s.notifications]
}
function grantConsent(c: Ctx, k: Omit<Consent, 'id' | 'grantedAt'>) {
  c.s.consents = [{ ...k, id: uid('CS'), grantedAt: iso(c.now) }, ...c.s.consents]
}
function patchRecv(c: Ctx, id: string, patch: Partial<Receivable>) {
  c.s.receivables = c.s.receivables.map((r) => (r.id === id ? { ...r, ...patch } : r))
}
function patchApp(c: Ctx, id: string, patch: Partial<FundingApplication>) {
  c.s.applications = c.s.applications.map((a) => (a.id === id ? { ...a, ...patch } : a))
}
function recv(c: Ctx, id: string) {
  const r = c.s.receivables.find((x) => x.id === id)
  if (!r) throw notFound(`Không tìm thấy khoản phải thu ${id}`)
  return r
}
function app(c: Ctx, id: string) {
  const a = c.s.applications.find((x) => x.id === id)
  if (!a) throw notFound(`Không tìm thấy hồ sơ tài trợ ${id}`)
  return a
}
function rfqOf(c: Ctx, id: string) {
  const q = c.s.rfqs.find((x) => x.id === id)
  if (!q) throw notFound(`Không tìm thấy RFQ ${id}`)
  return q
}
function requireType(c: Ctx, t: Org['type']) {
  if (c.actor.type !== t) throw forbidden(`Chỉ ${t === 'supplier' ? 'nhà cung cấp' : t === 'buyer' ? 'bên mua' : 'tổ chức tài chính'} mới được thực hiện thao tác này`)
}
function requireSelf(c: Ctx, orgId: string) {
  if (orgId !== c.actor.id) throw forbidden('Chỉ được thao tác trên dữ liệu của tổ chức mình')
}
function requireState<T extends string>(what: string, cur: T, allowed: T[]) {
  if (!allowed.includes(cur)) throw conflict(`${what} đang ở trạng thái ${cur}; thao tác chỉ hợp lệ khi ở ${allowed.join(' / ')}`)
}
function positiveInt(v: unknown, label: string) {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v <= 0) throw bad(`${label} phải là số nguyên dương`)
  return v
}
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

function matchCtx(c: Ctx, r: Receivable) {
  const seller = c.s.orgs.find((o) => o.id === r.sellerId)!
  const e = esgOf(c.s, r.sellerId)
  return {
    receivable: r,
    industryGroup: seller.industryGroup,
    supplierRating: supplierScoreOf(c.s, r.sellerId).rating,
    buyerRating: buyerScoreOf(c.s, r.buyerId).rating,
    applicationRating: applicationScoreOf(c.s, r.id).rating,
    esg: e ? { score: e.result.score, coverage: e.result.coverage, official: e.assessment.status === 'official', flags: e.result.flags.length } : undefined,
    now: c.now,
  }
}

function assertEligible(c: Ctx, r: Receivable, productIds: string[]) {
  const mc = matchCtx(c, r)
  for (const pid of productIds) {
    const p = c.s.products.find((x) => x.id === pid)
    if (!p) throw notFound(`Không tìm thấy sản phẩm ${pid}`)
    const m = matchProduct(p, mc)
    if (!m.eligible) throw unprocessable(`Sản phẩm “${p.name}” chưa phù hợp: ${m.reasons.join('; ')}`)
  }
}

function openApplicationFor(c: Ctx, receivableId: string) {
  return c.s.applications.some((a) => a.receivableId === receivableId && ACTIVE_APP(a))
}

// ---------------- hành động ----------------
type Action = (c: Ctx, ...args: any[]) => unknown // eslint-disable-line @typescript-eslint/no-explicit-any

export const actions: Record<string, Action> = {
  // ===== Khoản phải thu =====
  createReceivable(c, input: Omit<Receivable, 'id' | 'code' | 'version' | 'createdAt' | 'state' | 'sellerId'>) {
    requireType(c, 'supplier')
    if (!input || typeof input !== 'object') throw bad('Thiếu dữ liệu khoản phải thu')
    const buyer = c.s.orgs.find((o) => o.id === input.buyerId)
    if (!buyer || buyer.type !== 'buyer') throw bad('Bên mua không hợp lệ')
    positiveInt(input.amount, 'Số tiền')
    if (!isDate(input.issueDate) || !isDate(input.dueDate)) throw bad('Ngày phát hành/hạn thanh toán không hợp lệ (YYYY-MM-DD)')
    if (input.dueDate <= input.issueDate) throw bad('Hạn thanh toán phải sau ngày phát hành')
    if (!input.invoiceNumber || !input.invoiceSeries) throw bad('Cần ký hiệu và số hóa đơn')
    if (!input.fingerprint) throw bad('Thiếu dấu vân tay hóa đơn')
    const norm = (s: string) => s.replace(/^0+/, '').toUpperCase()
    const dup = c.s.receivables.find(
      (r) => r.state !== 'CANCELLED' && r.sellerId === c.actor.id && (r.fingerprint === input.fingerprint || (r.invoiceSeries.toUpperCase() === input.invoiceSeries.toUpperCase() && norm(r.invoiceNumber) === norm(input.invoiceNumber) && r.issueDate === input.issueDate)),
    )
    if (dup) throw conflict(`Trùng khoản phải thu ${dup.code} (cùng MST bán, ký hiệu, số, ngày). Hồ sơ trùng được đưa vào review — không tạo mới.`)
    const maxN = c.s.receivables.reduce((m, r) => Math.max(m, Number(/(\d+)$/.exec(r.code)?.[1] ?? 0)), 0)
    const r: Receivable = {
      id: uid('r'), code: `INV-${String(maxN + 1).padStart(3, '0')}`, version: 1, createdAt: iso(c.now), state: 'DRAFT',
      sellerId: c.actor.id, buyerId: input.buyerId, invoiceSeries: input.invoiceSeries, invoiceNumber: input.invoiceNumber,
      issueDate: input.issueDate, dueDate: input.dueDate, amount: input.amount, description: String(input.description ?? '').slice(0, 500),
      fingerprint: input.fingerprint, docs: { xml: !!input.docs?.xml, contract: !!input.docs?.contract, delivery: !!input.docs?.delivery },
      source: (['xml', 'ocr', 'manual', 'accounting'] as const).includes(input.source) ? input.source : 'manual',
    }
    c.s.receivables = [r, ...c.s.receivables]
    log(c, 'Tạo khoản phải thu', r.code, `${orgName(c, r.buyerId)} · ${vnd(r.amount)} ₫ · nguồn ${r.source}`)
    return r
  },
  sendToBuyer(c, id: string) {
    const r = recv(c, id)
    requireSelf(c, r.sellerId)
    requireState('Khoản phải thu', r.state, ['DRAFT'])
    patchRecv(c, id, { state: 'BUYER_PENDING' })
    notify(c, r.buyerId, `Yêu cầu xác nhận ${r.code}`, `${orgName(c, r.sellerId)} đề nghị xác nhận khoản phải trả ${vnd(r.amount)} ₫.`, '/invoices')
    log(c, 'Gửi lời mời xác nhận', r.code, `Tới ${orgName(c, r.buyerId)}`)
  },
  buyerDecision(c, id: string, confirm: boolean, reason?: string, otp?: OtpProof) {
    const r = recv(c, id)
    requireSelf(c, r.buyerId)
    requireState('Khoản phải thu', r.state, ['BUYER_PENDING'])
    if (confirm) c.checkOtp('buyer_confirm', `${r.id}@v${r.version}`, otp)
    else if (!reason?.trim()) throw bad('Cần nêu lý do tranh chấp')
    patchRecv(c, id, confirm ? { state: 'BUYER_CONFIRMED', confirmedAt: iso(c.now), disputeReason: undefined } : { state: 'BUYER_DISPUTED', disputeReason: reason!.trim().slice(0, 500) })
    notify(c, r.sellerId, confirm ? `${r.code} đã được xác nhận` : `${r.code} bị tranh chấp`, confirm ? `${orgName(c, r.buyerId)} xác nhận nghĩa vụ thanh toán phiên bản v${r.version}. Có thể đưa lên Marketplace.` : `Lý do: ${reason}`, '/invoices')
    log(c, confirm ? 'Bên mua xác nhận' : 'Bên mua nêu tranh chấp', r.code, confirm ? `Phiên bản v${r.version}, xác thực lại bằng OTP` : reason!)
  },
  reviseDisputed(c, id: string, amount: number, note: string) {
    const r = recv(c, id)
    requireSelf(c, r.sellerId)
    requireState('Khoản phải thu', r.state, ['BUYER_DISPUTED'])
    positiveInt(amount, 'Số tiền')
    if (!note?.trim()) throw bad('Cần ghi chú điều chỉnh')
    patchRecv(c, id, { amount, version: r.version + 1, state: 'BUYER_PENDING', description: `${r.description} (điều chỉnh: ${note.trim()})` })
    notify(c, r.buyerId, `${r.code} đã điều chỉnh — cần xác nhận lại`, note, '/invoices')
    log(c, 'Tạo phiên bản mới sau tranh chấp', r.code, `v${r.version + 1}: ${note}`)
  },
  cancelReceivable(c, id: string) {
    const r = recv(c, id)
    requireSelf(c, r.sellerId)
    requireState('Khoản phải thu', r.state, ['DRAFT', 'BUYER_PENDING', 'BUYER_DISPUTED', 'BUYER_CONFIRMED'])
    if (openApplicationFor(c, id)) throw conflict('Khoản phải thu đang có hồ sơ tài trợ')
    patchRecv(c, id, { state: 'CANCELLED' })
    log(c, 'Hủy khoản phải thu', r.code, '')
  },
  markBuyerPaid(c, id: string) {
    const r = recv(c, id)
    const a = c.s.applications.find((x) => x.receivableId === id && x.state === 'FUNDED')
    // Bên mua tự ghi nhận, hoặc tổ chức tài chính đã giải ngân ghi nhận theo sự kiện đối soát
    if (!(c.actor.id === r.buyerId || (a && c.actor.id === a.lenderId))) throw forbidden('Chỉ bên mua hoặc tổ chức tài chính đã giải ngân mới ghi nhận thanh toán')
    requireState('Khoản phải thu', r.state, ['FUNDED', 'BUYER_CONFIRMED', 'OVERDUE'])
    patchRecv(c, id, { state: 'SETTLED', paidAt: iso(c.now), paidAmount: r.amount })
    if (a) {
      patchApp(c, a.id, { state: 'SETTLED', settledAt: iso(c.now) })
      notify(c, a.lenderId, `${r.code} đã tất toán`, `Bên mua thanh toán ${vnd(r.amount)} ₫ vào tài khoản chuyên dùng.`)
    }
    notify(c, r.sellerId, `${r.code} đã được thanh toán`, 'Khoản phải thu đã tất toán.')
    log(c, 'Ghi nhận thanh toán của bên mua', r.code, a ? `Tất toán ${a.id}` : 'Thanh toán trực tiếp')
  },

  // ===== RFQ =====
  createRfq(c, receivableId: string, productIds: string[]) {
    const r = recv(c, receivableId)
    requireSelf(c, r.sellerId)
    if (r.state !== 'BUYER_CONFIRMED') throw conflict('Chỉ tạo RFQ khi khoản phải thu ở trạng thái “Bên mua đã xác nhận”')
    if (!Array.isArray(productIds) || productIds.length === 0 || productIds.length > 3 || new Set(productIds).size !== productIds.length) throw bad('Chọn 1–3 sản phẩm khác nhau')
    if (c.s.rfqs.some((q) => q.receivableId === receivableId && ['OPEN', 'RESPONDED'].includes(q.state))) throw conflict('Khoản phải thu đã có RFQ đang mở')
    assertEligible(c, r, productIds)
    const rfq: Rfq = { id: uid('RFQ'), receivableId, sellerId: r.sellerId, productIds, state: 'OPEN', createdAt: iso(c.now), expiresAt: iso(new Date(c.now.getTime() + 5 * DAY)), responses: [] }
    c.s.rfqs = [rfq, ...c.s.rfqs]
    const lenders = [...new Set(productIds.map((p) => c.s.products.find((x) => x.id === p)!.lenderId))]
    for (const l of lenders) {
      grantConsent(c, { ownerId: r.sellerId, recipientId: l, purpose: `Gói tóm tắt RFQ ${rfq.id}`, scopes: ['credit_score', 'esg'], expiresAt: rfq.expiresAt })
      notify(c, l, `Yêu cầu báo giá ${rfq.id}`, `${orgName(c, r.sellerId)} — ${r.code}, ${vnd(r.amount)} ₫, bên mua ${orgName(c, r.buyerId)}.`, '/marketplace?tab=rfq')
    }
    log(c, 'Tạo yêu cầu báo giá', rfq.id, `${r.code} → ${lenders.map((l) => orgName(c, l)).join(', ')} (chia sẻ gói tóm tắt)`)
    return rfq
  },
  respondRfq(c, rfqId: string, resp: Omit<RfqResponse, 'lenderId' | 'respondedAt' | 'simulated'>) {
    requireType(c, 'lender')
    const q = rfqOf(c, rfqId)
    requireState('RFQ', q.state, ['OPEN', 'RESPONDED'])
    if (q.expiresAt < iso(c.now)) throw conflict('RFQ đã hết hạn')
    const p = c.s.products.find((x) => x.id === resp?.productId)
    if (!p || p.lenderId !== c.actor.id || !q.productIds.includes(p.id)) throw forbidden('RFQ này không gửi tới sản phẩm của tổ chức bạn')
    if (resp.kind === 'quote') {
      if (!(typeof resp.advancePct === 'number' && resp.advancePct > 0 && resp.advancePct <= 100)) throw bad('Tỷ lệ ứng không hợp lệ (0–100%)')
      if (!(typeof resp.ratePct === 'number' && resp.ratePct > 0 && resp.ratePct <= 100)) throw bad('Lãi suất không hợp lệ')
      if (resp.feesVnd !== undefined && (!Number.isFinite(resp.feesVnd) || resp.feesVnd < 0)) throw bad('Phí không hợp lệ')
    } else if (resp.kind !== 'decline') throw bad('Loại phản hồi không hợp lệ')
    const full: RfqResponse = { ...resp, lenderId: c.actor.id, respondedAt: c.now.toISOString(), simulated: false }
    putResponse(c, q, full)
  },
  /** Chỉ chế độ demo: nhà cung cấp tạo phản hồi mẫu thay cho các đối tác chưa trả lời. */
  simulateRfqResponses(c, rfqId: string) {
    if (!c.demo) throw forbidden('Chức năng mô phỏng chỉ có ở chế độ demo')
    const q = rfqOf(c, rfqId)
    requireSelf(c, q.sellerId)
    requireState('RFQ', q.state, ['OPEN', 'RESPONDED'])
    const r = recv(c, q.receivableId)
    const rating = applicationScoreOf(c.s, r.id).rating
    const bump = Math.max(0, RATING_ORDER.indexOf('AAA') - RATING_ORDER.indexOf(rating)) * 0.12
    const e = esgOf(c.s, r.sellerId)
    for (const pid of q.productIds) {
      const p = c.s.products.find((x) => x.id === pid)!
      if (rfqOf(c, rfqId).responses.some((x) => x.lenderId === p.lenderId)) continue
      const cost = estimateCost(p, r.amount, tenorOf(r, c.now), e ? { score: e.result.score, coverage: e.result.coverage, official: e.assessment.status === 'official', flags: e.result.flags.length } : undefined)
      const rate = Math.min(cost.rateMax, Math.round((cost.rateMin + bump) * 100) / 100)
      putResponse(c, rfqOf(c, rfqId), {
        lenderId: p.lenderId, productId: pid, kind: 'quote', advancePct: p.pricing.advancePct, ratePct: rate, feesVnd: cost.fees,
        conditions: p.type === 'factoring_nonrecourse' ? 'Miễn truy đòi; bảo hiểm rủi ro bên mua' : 'Có truy đòi; bên mua thanh toán vào TK chuyên dùng',
        validUntil: iso(new Date(c.now.getTime() + 4 * DAY)), respondedAt: c.now.toISOString(), simulated: true,
      })
    }
  },
  selectQuote(c, rfqId: string, lenderId: string) {
    const q = rfqOf(c, rfqId)
    requireSelf(c, q.sellerId)
    requireState('RFQ', q.state, ['RESPONDED'])
    if (openApplicationFor(c, q.receivableId)) throw conflict('Khoản phải thu đã có hồ sơ tài trợ (đang hoạt động hoặc đã tài trợ)')
    const resp = q.responses.find((x) => x.lenderId === lenderId)
    if (!resp || resp.kind !== 'quote') throw bad('Đối tác này chưa có báo giá')
    if (resp.validUntil && resp.validUntil < iso(c.now)) throw conflict('Báo giá đã hết hiệu lực')
    const a: FundingApplication = { id: uid('APP'), receivableId: q.receivableId, lenderId, productId: resp.productId, rfqId, state: 'SUBMITTED', submittedAt: iso(c.now) }
    c.s.rfqs = c.s.rfqs.map((x) => (x.id === rfqId ? { ...x, state: 'SELECTED', selectedLenderId: lenderId } : x))
    c.s.applications = [a, ...c.s.applications]
    c.s.consents = c.s.consents.map((k) => (k.purpose === `Gói tóm tắt RFQ ${rfqId}` && k.recipientId !== lenderId && !k.revokedAt ? { ...k, revokedAt: iso(c.now) } : k))
    patchRecv(c, q.receivableId, { state: 'SUBMITTED' })
    grantConsent(c, { ownerId: q.sellerId, recipientId: lenderId, purpose: `Hồ sơ đầy đủ ${a.id}`, scopes: ['credit_score', 'esg', 'documents', 'accounting'], expiresAt: iso(new Date(c.now.getTime() + 180 * DAY)) })
    for (const x of q.responses) if (x.lenderId !== lenderId) notify(c, x.lenderId, `${rfqId}: doanh nghiệp đã chọn đối tác khác`, 'Quyền xem gói tóm tắt đã được thu hồi.')
    notify(c, lenderId, `Hồ sơ mới ${a.id}`, `Được chọn từ ${rfqId}. Bộ chứng từ đầy đủ đã được chia sẻ.`, '/invoices')
    log(c, 'Chọn báo giá & gửi hồ sơ', a.id, `${orgName(c, lenderId)} từ ${rfqId}; khóa khoản phải thu, thu hồi quyền của đối tác còn lại`)
  },
  cancelRfq(c, rfqId: string) {
    const q = rfqOf(c, rfqId)
    requireSelf(c, q.sellerId)
    requireState('RFQ', q.state, ['OPEN', 'RESPONDED'])
    c.s.rfqs = c.s.rfqs.map((x) => (x.id === rfqId ? { ...x, state: 'CANCELLED' } : x))
    c.s.consents = c.s.consents.map((k) => (k.purpose === `Gói tóm tắt RFQ ${rfqId}` && !k.revokedAt ? { ...k, revokedAt: iso(c.now) } : k))
    log(c, 'Hủy RFQ', rfqId, 'Thu hồi quyền xem gói tóm tắt')
  },
  submitDirect(c, receivableId: string, productId: string) {
    const r = recv(c, receivableId)
    requireSelf(c, r.sellerId)
    if (r.state !== 'BUYER_CONFIRMED') throw conflict('Chỉ gửi hồ sơ khi khoản phải thu ở trạng thái “Bên mua đã xác nhận”')
    if (openApplicationFor(c, receivableId)) throw conflict('Khoản phải thu đã có hồ sơ tài trợ (đang hoạt động hoặc đã tài trợ)')
    if (c.s.rfqs.some((q) => q.receivableId === receivableId && ['OPEN', 'RESPONDED'].includes(q.state))) throw conflict('Khoản phải thu đang có RFQ mở — hủy RFQ trước khi gửi trực tiếp')
    assertEligible(c, r, [productId])
    const p = c.s.products.find((x) => x.id === productId)!
    const a: FundingApplication = { id: uid('APP'), receivableId, lenderId: p.lenderId, productId, state: 'SUBMITTED', submittedAt: iso(c.now) }
    c.s.applications = [a, ...c.s.applications]
    patchRecv(c, receivableId, { state: 'SUBMITTED' })
    grantConsent(c, { ownerId: r.sellerId, recipientId: p.lenderId, purpose: `Hồ sơ đầy đủ ${a.id}`, scopes: ['credit_score', 'esg', 'documents', 'accounting'], expiresAt: iso(new Date(c.now.getTime() + 180 * DAY)) })
    notify(c, p.lenderId, `Hồ sơ mới ${a.id}`, `${orgName(c, r.sellerId)} — ${r.code}`, '/invoices')
    log(c, 'Gửi hồ sơ tài trợ', a.id, `${r.code} → ${orgName(c, p.lenderId)} · ${p.name}`)
    return a
  },

  // ===== Hồ sơ tài trợ (tổ chức tài chính) =====
  startReview(c, appId: string) {
    const a = app(c, appId)
    requireSelf(c, a.lenderId)
    requireState('Hồ sơ', a.state, ['SUBMITTED'])
    patchApp(c, appId, { state: 'UNDER_REVIEW' })
    patchRecv(c, a.receivableId, { state: 'UNDER_REVIEW' })
    log(c, 'Đối tác bắt đầu thẩm định', appId, '')
  },
  makeOffer(c, appId: string, offer: NonNullable<FundingApplication['offer']>) {
    const a = app(c, appId)
    requireSelf(c, a.lenderId)
    requireState('Hồ sơ', a.state, ['UNDER_REVIEW'])
    const r = recv(c, a.receivableId)
    positiveInt(offer?.advanceVnd, 'Số tiền ứng')
    if (offer.advanceVnd > r.amount) throw bad('Số tiền ứng không được vượt giá trị khoản phải thu')
    if (!(offer.ratePct > 0 && offer.ratePct <= 100)) throw bad('Lãi suất không hợp lệ')
    if (!(offer.feesVnd >= 0)) throw bad('Phí không hợp lệ')
    positiveInt(offer.tenorDays, 'Kỳ hạn')
    if (!isDate(offer.expiresAt) || offer.expiresAt < iso(c.now)) throw bad('Hạn chấp thuận không hợp lệ')
    const clean = { advanceVnd: offer.advanceVnd, ratePct: offer.ratePct, feesVnd: offer.feesVnd, tenorDays: offer.tenorDays, conditions: String(offer.conditions ?? '').slice(0, 1000), expiresAt: offer.expiresAt }
    patchApp(c, appId, { state: 'OFFERED', offer: clean, decidedAt: iso(c.now) })
    patchRecv(c, a.receivableId, { state: 'OFFERED' })
    notify(c, r.sellerId, `Đề nghị tài trợ chính thức ${appId}`, `${orgName(c, a.lenderId)}: ứng ${vnd(clean.advanceVnd)} ₫, ${clean.ratePct}%/năm. Hạn chấp thuận ${clean.expiresAt}.`, '/invoices')
    log(c, 'Đối tác đưa đề nghị chính thức', appId, `${clean.ratePct}%/năm, ứng ${vnd(clean.advanceVnd)} ₫`)
  },
  rejectApp(c, appId: string, reason: string) {
    const a = app(c, appId)
    requireSelf(c, a.lenderId)
    requireState('Hồ sơ', a.state, ['SUBMITTED', 'UNDER_REVIEW'])
    if (!reason?.trim()) throw bad('Cần nêu lý do từ chối')
    const r = recv(c, a.receivableId)
    patchApp(c, appId, { state: 'REJECTED', decidedAt: iso(c.now) })
    patchRecv(c, a.receivableId, { state: 'BUYER_CONFIRMED' })
    notify(c, r.sellerId, `${appId} bị từ chối`, reason, '/invoices')
    log(c, 'Đối tác từ chối hồ sơ', appId, reason)
  },
  acceptOffer(c, appId: string, otp?: OtpProof) {
    const a = app(c, appId)
    const r = recv(c, a.receivableId)
    requireSelf(c, r.sellerId)
    requireState('Hồ sơ', a.state, ['OFFERED'])
    if (a.offer && a.offer.expiresAt < iso(c.now)) throw conflict('Đề nghị đã hết hạn chấp thuận')
    c.checkOtp('accept_offer', appId, otp)
    patchApp(c, appId, { state: 'ACCEPTED' })
    patchRecv(c, a.receivableId, { state: 'ACCEPTED' })
    notify(c, a.lenderId, `${appId}: doanh nghiệp chấp thuận đề nghị`, 'Tiến hành ký hợp đồng và giải ngân trên kênh của tổ chức tài chính.')
    log(c, 'Doanh nghiệp chấp thuận đề nghị', appId, 'Xác thực lại bằng OTP')
  },
  fundApp(c, appId: string) {
    const a = app(c, appId)
    requireSelf(c, a.lenderId)
    fundApplication(c, a)
  },

  // ===== Sản phẩm Marketplace =====
  upsertProduct(c, p: FinancingProduct) {
    requireType(c, 'lender')
    const ex = c.s.products.find((x) => x.id === p?.id)
    if (ex && ex.lenderId !== c.actor.id) throw forbidden('Sản phẩm thuộc tổ chức khác')
    if (!p?.name?.trim() || !p.eligibility || !p.pricing) throw bad('Thiếu thông tin sản phẩm')
    if (!(p.pricing.advancePct > 0 && p.pricing.advancePct <= 100) || !(p.pricing.rateMin > 0) || p.pricing.rateMax < p.pricing.rateMin) throw bad('Biểu giá không hợp lệ')
    if (p.eligibility.minAmount > p.eligibility.maxAmount) throw bad('Khoảng giá trị tài trợ không hợp lệ')
    const next: FinancingProduct = { ...p, lenderId: c.actor.id, sample: ex?.sample ?? false, version: ex ? ex.version + 1 : 1 }
    c.s.products = ex ? c.s.products.map((x) => (x.id === next.id ? next : x)) : [next, ...c.s.products]
    log(c, 'Lưu sản phẩm Marketplace', next.id, `${next.name} — phiên bản v${next.version}`)
    return next
  },
  setProductStatus(c, id: string, status: FinancingProduct['status']) {
    const p = c.s.products.find((x) => x.id === id)
    if (!p) throw notFound('Không tìm thấy sản phẩm')
    requireSelf(c, p.lenderId)
    if (!['draft', 'pending_review', 'published', 'paused', 'expired'].includes(status)) throw bad('Trạng thái không hợp lệ')
    c.s.products = c.s.products.map((x) => (x.id === id ? { ...x, status } : x))
    log(c, 'Đổi trạng thái sản phẩm', id, status)
  },

  // ===== Thanh toán sớm =====
  createEarlyOffer(c, o: { receivableId: string; discountPct: number; payBy: string }) {
    requireType(c, 'buyer')
    const r = recv(c, o?.receivableId)
    requireSelf(c, r.buyerId)
    requireState('Khoản phải thu', r.state, ['BUYER_CONFIRMED'])
    if (openApplicationFor(c, r.id)) throw conflict('Khoản phải thu đang có hồ sơ tài trợ')
    if (c.s.earlyOffers.some((x) => x.receivableId === r.id && ['OPEN', 'ACCEPTED'].includes(x.state))) throw conflict('Đã có đề nghị thanh toán sớm đang mở')
    if (!(o.discountPct > 0 && o.discountPct < 100)) throw bad('Tỷ lệ chiết khấu không hợp lệ')
    if (!isDate(o.payBy) || o.payBy < iso(c.now) || o.payBy > r.dueDate) throw bad('Ngày thanh toán sớm phải từ hôm nay đến hạn thanh toán')
    const offer: EarlyPaymentOffer = { id: uid('EP'), buyerId: c.actor.id, receivableId: r.id, discountPct: o.discountPct, payBy: o.payBy, createdAt: iso(c.now), state: 'OPEN' }
    c.s.earlyOffers = [offer, ...c.s.earlyOffers]
    notify(c, r.sellerId, `Đề nghị thanh toán sớm ${r.code}`, `${orgName(c, offer.buyerId)} trả sớm trước ${offer.payBy}, chiết khấu ${offer.discountPct}%.`, '/marketplace?tab=early')
    log(c, 'Bên mua tạo đề nghị thanh toán sớm', offer.id, `${r.code}, chiết khấu ${offer.discountPct}%`)
    return offer
  },
  acceptEarlyOffer(c, id: string) {
    const o = c.s.earlyOffers.find((x) => x.id === id)
    if (!o) throw notFound('Không tìm thấy đề nghị')
    const r = recv(c, o.receivableId)
    requireSelf(c, r.sellerId)
    requireState('Đề nghị', o.state, ['OPEN'])
    if (r.state !== 'BUYER_CONFIRMED') throw conflict('Khoản phải thu không còn ở trạng thái có thể thanh toán sớm')
    c.s.earlyOffers = c.s.earlyOffers.map((x) => (x.id === id ? { ...x, state: 'ACCEPTED' } : x))
    notify(c, o.buyerId, `Nhà cung cấp đồng ý thanh toán sớm ${id}`, 'Bên mua chuyển khoản trực tiếp cho nhà cung cấp; FCC chỉ ghi nhận.', '/marketplace?tab=early')
    log(c, 'Nhà cung cấp chấp nhận thanh toán sớm', id, '')
  },
  payEarlyOffer(c, id: string) {
    const o = c.s.earlyOffers.find((x) => x.id === id)
    if (!o) throw notFound('Không tìm thấy đề nghị')
    requireSelf(c, o.buyerId)
    requireState('Đề nghị', o.state, ['ACCEPTED'])
    const r = recv(c, o.receivableId)
    const paid = Math.round(r.amount * (1 - o.discountPct / 100))
    c.s.earlyOffers = c.s.earlyOffers.map((x) => (x.id === id ? { ...x, state: 'PAID' } : x))
    patchRecv(c, r.id, { state: 'EARLY_PAID', paidAt: iso(c.now), paidAmount: paid })
    notify(c, r.sellerId, `${r.code} đã được thanh toán sớm`, `${vnd(paid)} ₫ (sau chiết khấu ${o.discountPct}%).`)
    log(c, 'Ghi nhận thanh toán sớm', id, `${vnd(paid)} ₫ — bên mua xác nhận đã chuyển khoản trực tiếp`)
  },

  // ===== ESG =====
  ensureEsg(c, orgId: string) {
    requireSelf(c, orgId)
    const ex = c.s.esg.find((e) => e.orgId === orgId && e.source === 'assessed')
    if (ex) return ex
    const a: EsgAssessment = { id: uid('ESG'), orgId, industryGroup: c.actor.industryGroup, period: `${iso(new Date(c.now.getTime() - 365 * DAY))} → ${iso(c.now)}`, status: 'draft', indicators: [], documents: [], metrics: {}, source: 'assessed' }
    c.s.esg = [a, ...c.s.esg]
    log(c, 'Khởi tạo đánh giá ESG', a.id, '')
    return a
  },
  updateIndicator(c, assessmentId: string, code: string, patch: Partial<EsgIndicatorResult>) {
    const a = ownEsg(c, assessmentId)
    const OWNER_FIELDS = ['aiLevel', 'aiRationale', 'aiCitations', 'aiMissing', 'aiSimulated', 'selfDeclared']
    const REVIEWER_FIELDS = ['finalLevel', 'na', 'naReason', 'reviewerNote', 'redFlag']
    const keys = Object.keys(patch ?? {})
    if (keys.some((k) => !OWNER_FIELDS.includes(k) && !REVIEWER_FIELDS.includes(k))) throw bad('Trường không hợp lệ')
    if (keys.some((k) => REVIEWER_FIELDS.includes(k)) && c.role !== 'fcc_reviewer') throw forbidden('Chỉ người thẩm định FCC mới được xác nhận mức/ghi chú thẩm định')
    if ('finalLevel' in patch && patch.finalLevel !== undefined && ![0, 1, 2, 3, 4].includes(patch.finalLevel)) throw bad('Mức chỉ tiêu phải từ 0 đến 4')
    const has = a.indicators.some((i) => i.code === code)
    const indicators = has ? a.indicators.map((i) => (i.code === code ? { ...i, ...patch } : i)) : [...a.indicators, { code, ...patch }]
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, indicators, status: x.status === 'official' || x.status === 'draft' ? 'in_review' : x.status } : x))
    if ('finalLevel' in patch || 'na' in patch) log(c, 'Reviewer cập nhật chỉ tiêu ESG', `${a.id}/${code}`, patch.na ? `N/A: ${patch.naReason ?? ''}` : `Mức ${patch.finalLevel ?? 'chưa xác minh'}${patch.reviewerNote ? ` — ${patch.reviewerNote}` : ''}`)
  },
  addEsgDocument(c, assessmentId: string, doc: EsgDocument) {
    const a = ownEsg(c, assessmentId)
    if (!doc?.name || !doc.mime) throw bad('Thiếu thông tin tài liệu')
    if (doc.dataUrl && doc.dataUrl.length > 8_000_000) throw bad('Tệp quá lớn (tối đa ~6 MB)')
    const clean: EsgDocument = { ...doc, id: doc.id || uid('doc'), uploadedAt: c.now.toISOString(), indicatorCodes: doc.indicatorCodes ?? [] }
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, documents: [clean, ...x.documents] } : x))
    log(c, 'Tải bằng chứng ESG', a.id, `${clean.name} → ${clean.indicatorCodes.join(', ') || 'chưa phân loại'}`)
  },
  updateEsgMetrics(c, assessmentId: string, m: Partial<EsgAssessment['metrics']>) {
    const a = ownEsg(c, assessmentId)
    const allowed = ['kwh12m', 'waterM3_12m', 'solarKwh12m', 'bhxhCovered', 'employees'] as const
    const clean: EsgAssessment['metrics'] = {}
    for (const k of allowed) if (m?.[k] !== undefined && Number.isFinite(m[k])) clean[k] = m[k]
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, metrics: { ...x.metrics, ...clean } } : x))
  },
  issueEsg(c, assessmentId: string, official: boolean) {
    const a = ownEsg(c, assessmentId)
    if (official && c.role !== 'fcc_reviewer') throw forbidden('Chỉ người thẩm định FCC mới được phát hành điểm ESG chính thức')
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, status: official ? 'official' : 'provisional', issuedAt: iso(c.now), validUntil: iso(new Date(c.now.getTime() + 365 * DAY)) } : x))
    log(c, official ? 'Phát hành điểm ESG chính thức' : 'Lưu điểm ESG tạm tính', assessmentId, '')
  },
  setEsgIndustry(c, assessmentId: string, g: EsgAssessment['industryGroup']) {
    const a = ownEsg(c, assessmentId)
    if (!['manufacturing', 'trade', 'agri', 'tech'].includes(g)) throw bad('Nhóm ngành không hợp lệ')
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, industryGroup: g } : x))
  },

  // ===== Hồ sơ chấm điểm =====
  /** Nạp dữ liệu niêm yết từ file JSON do scripts/fetch_listed.py (vnstock) sinh ra; máy chủ tự đọc, không nhận dữ liệu từ trình duyệt. */
  refreshListed(c, symbol: string) {
    if (c.actor.type !== 'buyer') throw forbidden('Chỉ bên mua niêm yết mới nạp dữ liệu niêm yết')
    const sym = String(symbol ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{2,6}$/.test(sym)) throw bad('Mã chứng khoán không hợp lệ')
    let j: { snapshot: Omit<ListedSnapshot, 'orgId'>; financials: Omit<FinancialYear, 'status'>[] }
    try {
      j = JSON.parse(readFileSync(join(c.listedDir, `${sym}.json`), 'utf8'))
    } catch {
      throw notFound(`Chưa có dữ liệu ${sym}. Chạy: python scripts/fetch_listed.py ${sym} --tax-code <MST> (cần vnstock).`)
    }
    const snap: ListedSnapshot = { ...j.snapshot, orgId: c.actor.id }
    const financials = j.financials.map((f) => ({ ...f, status: 'public_reference' as const }))
    c.s.listed = [snap, ...c.s.listed.filter((l) => l.orgId !== snap.orgId)]
    c.s.profiles = c.s.profiles.map((p) => (p.orgId === snap.orgId && financials.length ? { ...p, financials } : p))
    log(c, 'Cập nhật dữ liệu niêm yết', snap.symbol, `${snap.provider} · ${financials.length} năm BCTC`)
    return snap
  },
  upsertFinancialYear(c, orgId: string, fy: FinancialYear) {
    requireSelf(c, orgId)
    if (!Number.isInteger(fy?.year) || fy.year < 1990 || fy.year > c.now.getFullYear()) throw bad('Năm tài chính không hợp lệ')
    const clean = { ...fy, status: fy.status === 'verified' ? 'extracted' : fy.status } as FinancialYear // chỉ FCC/đối soát mới đặt “verified”
    c.s.profiles = c.s.profiles.some((p) => p.orgId === orgId)
      ? c.s.profiles.map((p) => (p.orgId === orgId ? { ...p, financials: [clean, ...p.financials.filter((f) => f.year !== clean.year)] } : p))
      : [...c.s.profiles, { orgId, financials: [clean], collateral: [] }]
    log(c, 'Cập nhật BCTC', orgId, `Năm ${clean.year} — ${clean.source}`)
  },
  updateProfile(c, orgId: string, patch: Partial<CreditProfile>) {
    requireSelf(c, orgId)
    const ALLOWED = ['cic', 'taxStatus', 'legalEvents', 'capitalNeed', 'ownContribution', 'collateral', 'frameworkContractMonths', 'topCustomerShare', 'topCustomerId', 'dsoDays', 'contractTermDays', 'einvoiceRevenue', 'vatDeclaredRevenue']
    const keys = Object.keys(patch ?? {})
    if (keys.some((k) => !ALLOWED.includes(k))) throw bad('Trường không hợp lệ')
    c.s.profiles = c.s.profiles.some((p) => p.orgId === orgId) ? c.s.profiles.map((p) => (p.orgId === orgId ? { ...p, ...patch } : p)) : [...c.s.profiles, { orgId, financials: [], collateral: [], ...patch }]
    log(c, 'Cập nhật hồ sơ chấm điểm', orgId, keys.join(', '))
  },

  // ===== Kế toán =====
  connectAccounting(c, orgId: string, provider: AccountingConnection['provider'], method: AccountingConnection['method']) {
    requireSelf(c, orgId)
    const exist = c.s.connections.find((x) => x.orgId === orgId)
    const nowIso = c.now.toISOString()
    const conn: AccountingConnection = exist
      ? { ...exist, provider, method, status: 'connected', lastSyncedAt: nowIso }
      : { orgId, provider, method, status: 'connected', lastSyncedAt: nowIso, openingCash: 900_000_000, recurringMonthlyOut: [{ name: 'Lương nhân viên', amount: 420_000_000, day: 5 }, { name: 'Chi phí vận hành', amount: 150_000_000, day: 15 }], buyerDelayDays: { '*': { median: 7, p80: 18 } }, simulated: true }
    c.s.connections = [conn, ...c.s.connections.filter((x) => x.orgId !== orgId)]
    if (!c.s.ledger.some((l) => l.orgId === orgId)) {
      const items: LedgerItem[] = c.s.receivables
        .filter((r) => r.sellerId === orgId && ['BUYER_PENDING', 'BUYER_CONFIRMED', 'OVERDUE', 'BUYER_DISPUTED'].includes(r.state))
        .map((r) => ({ id: uid('L'), orgId, kind: 'AR' as const, counterpartyName: orgName(c, r.buyerId), counterpartyTaxCode: c.s.orgs.find((o) => o.id === r.buyerId)?.taxCode, docNo: r.code, amount: r.amount, paid: 0, dueDate: r.dueDate }))
      c.s.ledger = [...c.s.ledger, ...items]
    }
    log(c, 'Kết nối phần mềm kế toán', orgId, `${provider} (${method === 'api' ? 'API' : 'nhập file'}) — chỉ đọc`)
  },
  disconnectAccounting(c, orgId: string) {
    requireSelf(c, orgId)
    c.s.connections = c.s.connections.map((x) => (x.orgId === orgId ? { ...x, status: 'disconnected' } : x))
    log(c, 'Ngắt kết nối kế toán', orgId, 'Dừng đồng bộ ngay')
  },
  syncAccounting(c, orgId: string) {
    requireSelf(c, orgId)
    const conn = c.s.connections.find((x) => x.orgId === orgId)
    if (!conn || conn.status !== 'connected') throw conflict('Chưa kết nối phần mềm kế toán')
    c.s.connections = c.s.connections.map((x) => (x.orgId === orgId ? { ...x, lastSyncedAt: c.now.toISOString() } : x))
    log(c, 'Đồng bộ kế toán', orgId, 'Đồng bộ tăng dần')
  },
  importLedger(c, orgId: string, items: LedgerItem[]) {
    requireSelf(c, orgId)
    if (!Array.isArray(items) || items.length > 5000) throw bad('Dữ liệu công nợ không hợp lệ')
    const clean: LedgerItem[] = items.map((i) => {
      if (!i.docNo || !(i.amount >= 0) || !(i.paid >= 0) || !isDate(i.dueDate) || (i.kind !== 'AR' && i.kind !== 'AP')) throw bad(`Dòng công nợ không hợp lệ: ${i.docNo ?? '?'}`)
      return { id: i.id || uid('L'), orgId, kind: i.kind, counterpartyName: String(i.counterpartyName ?? ''), counterpartyTaxCode: i.counterpartyTaxCode, docNo: i.docNo, amount: i.amount, paid: i.paid, dueDate: i.dueDate }
    })
    c.s.ledger = [...c.s.ledger.filter((l) => l.orgId !== orgId || !clean.some((i) => i.docNo === l.docNo)), ...clean]
    log(c, 'Nhập file công nợ', orgId, `${clean.length} dòng`)
  },

  // ===== Quyền chia sẻ, dữ liệu ngoài, thông báo =====
  revokeConsent(c, id: string) {
    const k = c.s.consents.find((x) => x.id === id)
    if (!k) throw notFound('Không tìm thấy quyền chia sẻ')
    requireSelf(c, k.ownerId)
    if (k.revokedAt) return
    c.s.consents = c.s.consents.map((x) => (x.id === id ? { ...x, revokedAt: iso(c.now) } : x))
    log(c, 'Thu hồi quyền chia sẻ', id, 'Có hiệu lực tức thời với truy cập mới')
  },
  refreshExternal(c, orgId: string) {
    requireSelf(c, orgId)
    c.s.external = c.s.external.map((e) => (e.orgId === orgId && c.s.sources.find((x) => x.id === e.sourceId)?.status === 'approved' ? { ...e, fetchedAt: c.now.toISOString() } : e))
    log(c, 'Làm mới dữ liệu nguồn công khai', orgId, 'Chỉ nguồn đã phê duyệt; tra cứu theo MST')
  },
  disputeExternal(c, id: string) {
    const e = c.s.external.find((x) => x.id === id)
    if (!e) throw notFound('Không tìm thấy bản ghi')
    requireSelf(c, e.orgId)
    c.s.external = c.s.external.map((x) => (x.id === id ? { ...x, disputed: true } : x))
    log(c, 'Doanh nghiệp khiếu nại dữ liệu ngoài', id, 'Chờ FCC operations xử lý')
  },
  markNotificationsRead(c) {
    c.s.notifications = c.s.notifications.map((n) => (n.orgId === c.actor.id ? { ...n, read: true } : n))
  },
}

// ---------------- dùng chung với webhook/tick ----------------
function putResponse(c: Ctx, q: Rfq, resp: RfqResponse) {
  c.s.rfqs = c.s.rfqs.map((x) => (x.id === q.id ? { ...x, state: 'RESPONDED', responses: [...x.responses.filter((y) => y.lenderId !== resp.lenderId), resp] } : x))
  notify(c, q.sellerId, `Báo giá mới cho ${q.id}`, `${orgName(c, resp.lenderId)} ${resp.kind === 'quote' ? `báo giá ${resp.ratePct}%/năm, ứng ${resp.advancePct}%` : 'từ chối'}.`, '/marketplace?tab=rfq')
  log(c, resp.kind === 'quote' ? 'Đối tác trả báo giá sơ bộ' : 'Đối tác từ chối RFQ', q.id, `${orgName(c, resp.lenderId)}${resp.simulated ? ' (mô phỏng)' : ''}`)
}

/** Ghi nhận giải ngân — idempotent: gọi lại khi đã FUNDED không đổi gì. */
export function fundApplication(c: Ctx, a: FundingApplication, source = 'thao tác của tổ chức tài chính') {
  if (a.state === 'FUNDED' || a.state === 'SETTLED') return false
  requireState('Hồ sơ', a.state, ['ACCEPTED'])
  const r = recv(c, a.receivableId)
  const amt = a.offer?.advanceVnd ?? 0
  patchApp(c, a.id, { state: 'FUNDED', fundedAt: iso(c.now), fundedAmount: amt })
  patchRecv(c, a.receivableId, { state: 'FUNDED' })
  notify(c, r.sellerId, `${a.id} đã giải ngân`, `${vnd(amt)} ₫ từ ${orgName(c, a.lenderId)}.`)
  log(c, 'Ghi nhận giải ngân', a.id, `${vnd(amt)} ₫ — ${source}`)
  return true
}

function ownEsg(c: Ctx, assessmentId: string) {
  const a = c.s.esg.find((x) => x.id === assessmentId)
  if (!a) throw notFound('Không tìm thấy đánh giá ESG')
  requireSelf(c, a.orgId)
  if (a.source !== 'assessed') throw forbidden('Đánh giá từ báo cáo công bố không chỉnh sửa tại đây')
  return a
}

/** Tác vụ định kỳ: RFQ quá hạn, đề nghị tài trợ quá hạn chấp thuận, khoản đến hạn chưa thanh toán. */
export function runSweep(c: Ctx): number {
  let n = 0
  const today = iso(c.now)
  for (const q of c.s.rfqs.filter((x) => ['OPEN', 'RESPONDED'].includes(x.state) && x.expiresAt < today)) {
    c.s.rfqs = c.s.rfqs.map((x) => (x.id === q.id ? { ...x, state: 'EXPIRED' } : x))
    c.s.consents = c.s.consents.map((k) => (k.purpose === `Gói tóm tắt RFQ ${q.id}` && !k.revokedAt ? { ...k, revokedAt: today } : k))
    notify(c, q.sellerId, `${q.id} đã hết hạn`, 'Yêu cầu báo giá hết hạn; quyền xem gói tóm tắt đã thu hồi.', '/marketplace?tab=rfq')
    log(c, 'RFQ hết hạn', q.id, 'Tự động')
    n++
  }
  for (const a of c.s.applications.filter((x) => x.state === 'OFFERED' && x.offer && x.offer.expiresAt < today)) {
    patchApp(c, a.id, { state: 'WITHDRAWN' })
    patchRecv(c, a.receivableId, { state: 'BUYER_CONFIRMED' })
    log(c, 'Đề nghị tài trợ hết hạn chấp thuận', a.id, 'Tự động')
    n++
  }
  for (const r of c.s.receivables.filter((x) => (['FUNDED', 'BUYER_CONFIRMED'] as ReceivableState[]).includes(x.state) && x.dueDate < today)) {
    patchRecv(c, r.id, { state: 'OVERDUE' })
    notify(c, r.buyerId, `${r.code} quá hạn thanh toán`, `Hạn thanh toán ${r.dueDate}.`, '/invoices')
    notify(c, r.sellerId, `${r.code} quá hạn thanh toán`, `Bên mua chưa thanh toán đến hạn ${r.dueDate}.`, '/invoices')
    log(c, 'Khoản phải thu quá hạn', r.code, 'Tự động')
    n++
  }
  return n
}
