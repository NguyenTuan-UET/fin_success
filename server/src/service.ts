// Luật nghiệp vụ FCC chạy phía máy chủ. Mỗi hành động kiểm tra quyền theo tổ chức đăng nhập (actor),
// kiểm tra trạng thái hợp lệ, rồi mới thay đổi dữ liệu. Chuyển từ web-legacy/src/store.ts (trước đây chạy ở trình duyệt).
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AccountingConnection, Consent, CreditProfile, SignatureEvidence, EarlyPaymentOffer, EsgAssessment, EsgDocument, EsgIndicatorResult, FinancialYear,
  FinancingProduct, FundingApplication, LedgerItem, ListedSnapshot, Org, Receivable, ReceivableState, Rfq, RfqResponse,
} from '@fcc/domain/types'
import { iso } from '@fcc/domain/util'
import { applicationScoreOf, buyerScoreOf, esgOf, supplierScoreOf } from '@fcc/domain/engine'
import { matchProduct } from '@fcc/domain/marketplace'
import { bad, conflict, forbidden, notFound, unprocessable } from './errors'
import type { State } from './state'
import type { MemberRole } from './auth/roles'
import { canonical } from './state'

export type Role = MemberRole | 'system'

export interface Ctx {
  actor: Org
  /** Vai trò của người dùng ở tổ chức đang hoạt động; 'system' cho tác vụ định kỳ và webhook đã xác thực */
  role: Role
  /** Người dùng thực hiện (không có với tác vụ hệ thống/webhook) */
  userId?: string
  /** Mã truy vết yêu cầu */
  correlationId?: string
  /** Bản nháp trạng thái — chỉ được ghi nhận khi hành động thành công. */
  s: State
  now: Date
  listedDir: string
  /** Chế độ dev: sản phẩm của tổ chức tài chính được công bố ngay, không chờ FCC duyệt */
  autoApprove: boolean
  /** Sự kiện nghiệp vụ phát sinh trong hành động; sau khi ghi thành công được chuyển tới webhook của đối tác */
  events?: DomainEvent[]
  /** Phương thức xác thực của thao tác có giá trị pháp lý (route đã kiểm tra MFA trước khi gọi), dùng cho nhật ký và bằng chứng ký */
  authMethod: 'mfa' | 'dev_session' | 'system'
}

export interface DomainEvent {
  /** Tổ chức nhận sự kiện */
  orgId: string
  type:
    | 'rfq.created' | 'rfq.closed' | 'application.submitted' | 'application.not_selected' | 'offer.accepted'
    | 'application.withdrawn' | 'receivable.paid' | 'receivable.overdue' | 'application.funded' | 'application.settled'
  data: Record<string, unknown>
  at: string
}
function emit(c: Ctx, orgId: string, type: DomainEvent['type'], data: Record<string, unknown>) {
  c.events?.push({ orgId, type, data, at: c.now.toISOString() })
}

/** Bằng chứng ký: băm nội dung đã đồng ý + phương thức xác thực của người ký. */
export function signatureOf(c: Ctx, content: unknown): SignatureEvidence {
  return {
    method: c.authMethod === 'mfa' ? 'mfa_snapshot' : 'dev_session',
    contentSha256: createHash('sha256').update(canonical(content)).digest('hex'),
    userId: c.userId ?? 'system',
    signedAt: c.now.toISOString(),
  }
}
const authNote = (c: Ctx) => (c.authMethod === 'mfa' ? 'xác thực MFA' : c.authMethod === 'dev_session' ? 'phiên dev (không xác thực)' : 'hệ thống')

const uid = (p: string) => `${p}-${randomBytes(4).toString('hex').toUpperCase()}`
const vnd = (n: number) => n.toLocaleString('vi-VN')
const DAY = 86_400_000
const ACTIVE_APP = (a: FundingApplication) => !['REJECTED', 'WITHDRAWN'].includes(a.state)

// ---------------- helper ----------------
const orgName = (c: Ctx, id: string) => c.s.orgs.find((o) => o.id === id)?.shortName ?? id
function log(c: Ctx, action: string, entity: string, detail: string) {
  c.s.audit = [{ id: uid('EV'), at: c.now.toISOString(), actorOrgId: c.actor.id, actorUserId: c.userId, action, entity, detail, correlationId: c.correlationId }, ...c.s.audit].slice(0, 1000)
}
function notify(c: Ctx, orgId: string, title: string, body: string, link?: string) {
  c.s.notifications = [{ id: uid('N'), orgId, at: c.now.toISOString(), title, body, link, read: false }, ...c.s.notifications]
}
function grantConsent(c: Ctx, k: Omit<Consent, 'id' | 'grantedAt' | 'signature'>) {
  // nội dung đồng ý (bên nhận, mục đích, loại dữ liệu, thời hạn) được băm và ký bằng phương thức xác thực của người thao tác
  c.s.consents = [{ ...k, id: uid('CS'), grantedAt: iso(c.now), signature: signatureOf(c, k) }, ...c.s.consents]
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
  if (c.actor.type !== t) throw forbidden(`Chỉ ${{ supplier: 'nhà cung cấp', buyer: 'bên mua', lender: 'tổ chức tài chính', fcc: 'nhân sự FCC' }[t]} mới được thực hiện thao tác này`)
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

/** Đầu vào khớp sản phẩm cho một khoản phải thu (dùng cả ở API /v1/receivables/{id}/matches). */
export function matchContextFor(s: State, r: Receivable, now: Date) {
  const seller = s.orgs.find((o) => o.id === r.sellerId)!
  const e = esgOf(s, r.sellerId)
  return {
    receivable: r,
    industryGroup: seller.industryGroup,
    supplierRating: supplierScoreOf(s, r.sellerId).rating,
    buyerRating: buyerScoreOf(s, r.buyerId).rating,
    applicationRating: applicationScoreOf(s, r.id).rating,
    esg: e ? { score: e.result.score, coverage: e.result.coverage, official: e.assessment.status === 'official', flags: e.result.flags.length } : undefined,
    now,
  }
}
const matchCtx = (c: Ctx, r: Receivable) => matchContextFor(c.s, r, c.now)

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
      files: Array.isArray(input.files)
        ? input.files.slice(0, 10).filter((f) => /^[0-9a-f]{64}$/.test(f?.key)).map((f) => ({ key: f.key, name: String(f.name ?? '').slice(0, 200), kind: (['invoice', 'contract', 'delivery'] as const).find((k) => k === f.kind) ?? ('other' as const) }))
        : undefined,
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
  buyerDecision(c, id: string, confirm: boolean, reason?: string) {
    const r = recv(c, id)
    requireSelf(c, r.buyerId)
    requireState('Khoản phải thu', r.state, ['BUYER_PENDING'])
    if (!confirm && !reason?.trim()) throw bad('Cần nêu lý do tranh chấp')
    patchRecv(c, id, confirm ? { state: 'BUYER_CONFIRMED', confirmedAt: iso(c.now), disputeReason: undefined } : { state: 'BUYER_DISPUTED', disputeReason: reason!.trim().slice(0, 500) })
    notify(c, r.sellerId, confirm ? `${r.code} đã được xác nhận` : `${r.code} bị tranh chấp`, confirm ? `${orgName(c, r.buyerId)} xác nhận nghĩa vụ thanh toán phiên bản v${r.version}. Có thể đưa lên Marketplace.` : `Lý do: ${reason}`, '/invoices')
    log(c, confirm ? 'Bên mua xác nhận' : 'Bên mua nêu tranh chấp', r.code, confirm ? `Phiên bản v${r.version}, ${authNote(c)}` : reason!)
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
      emit(c, a.lenderId, 'receivable.paid', { applicationId: a.id, receivableId: r.id, amount: r.amount })
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
      emit(c, l, 'rfq.created', { rfqId: rfq.id, receivableId: r.id, amount: r.amount, dueDate: r.dueDate, sellerId: r.sellerId, buyerId: r.buyerId, productIds: productIds.filter((p) => c.s.products.find((x) => x.id === p)?.lenderId === l), expiresAt: rfq.expiresAt })
    }
    log(c, 'Tạo yêu cầu báo giá', rfq.id, `${r.code} → ${lenders.map((l) => orgName(c, l)).join(', ')} (chia sẻ gói tóm tắt)`)
    return rfq
  },
  respondRfq(c, rfqId: string, resp: Omit<RfqResponse, 'lenderId' | 'respondedAt'>) {
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
    const full: RfqResponse = { ...resp, lenderId: c.actor.id, respondedAt: c.now.toISOString() }
    putResponse(c, q, full)
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
    for (const x of q.responses) if (x.lenderId !== lenderId) {
      notify(c, x.lenderId, `${rfqId}: doanh nghiệp đã chọn đối tác khác`, 'Quyền xem gói tóm tắt đã được thu hồi.')
      emit(c, x.lenderId, 'application.not_selected', { rfqId })
    }
    notify(c, lenderId, `Hồ sơ mới ${a.id}`, `Được chọn từ ${rfqId}. Bộ chứng từ đầy đủ đã được chia sẻ.`, '/invoices')
    emit(c, lenderId, 'application.submitted', { applicationId: a.id, rfqId, receivableId: a.receivableId })
    log(c, 'Chọn báo giá & gửi hồ sơ', a.id, `${orgName(c, lenderId)} từ ${rfqId}; khóa khoản phải thu, thu hồi quyền của đối tác còn lại`)
  },
  cancelRfq(c, rfqId: string) {
    const q = rfqOf(c, rfqId)
    requireSelf(c, q.sellerId)
    requireState('RFQ', q.state, ['OPEN', 'RESPONDED'])
    c.s.rfqs = c.s.rfqs.map((x) => (x.id === rfqId ? { ...x, state: 'CANCELLED' } : x))
    c.s.consents = c.s.consents.map((k) => (k.purpose === `Gói tóm tắt RFQ ${rfqId}` && !k.revokedAt ? { ...k, revokedAt: iso(c.now) } : k))
    for (const l of new Set(q.productIds.map((p) => c.s.products.find((x) => x.id === p)?.lenderId).filter(Boolean) as string[])) emit(c, l, 'rfq.closed', { rfqId, reason: 'cancelled' })
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
    emit(c, p.lenderId, 'application.submitted', { applicationId: a.id, receivableId: r.id, productId })
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
  acceptOffer(c, appId: string) {
    const a = app(c, appId)
    const r = recv(c, a.receivableId)
    requireSelf(c, r.sellerId)
    requireState('Hồ sơ', a.state, ['OFFERED'])
    if (a.offer && a.offer.expiresAt < iso(c.now)) throw conflict('Đề nghị đã hết hạn chấp thuận')
    patchApp(c, appId, { state: 'ACCEPTED' })
    patchRecv(c, a.receivableId, { state: 'ACCEPTED' })
    notify(c, a.lenderId, `${appId}: doanh nghiệp chấp thuận đề nghị`, 'Tiến hành ký hợp đồng và giải ngân trên kênh của tổ chức tài chính.')
    emit(c, a.lenderId, 'offer.accepted', { applicationId: appId, receivableId: a.receivableId, offer: a.offer })
    log(c, 'Doanh nghiệp chấp thuận đề nghị', appId, authNote(c))
  },
  fundApp(c, appId: string) {
    const a = app(c, appId)
    requireSelf(c, a.lenderId)
    fundApplication(c, a)
  },

  // ===== Sản phẩm Marketplace =====
  upsertProduct(c, p: FinancingProduct) {
    requireType(c, 'lender')
    if (!c.actor.verified) throw forbidden('Tổ chức chưa được FCC xác minh nên chưa đăng sản phẩm')
    const ex = c.s.products.find((x) => x.id === p?.id)
    if (ex && ex.lenderId !== c.actor.id) throw forbidden('Sản phẩm thuộc tổ chức khác')
    if (!p?.name?.trim() || !p.eligibility || !p.pricing) throw bad('Thiếu thông tin sản phẩm')
    if (!(p.pricing.advancePct > 0 && p.pricing.advancePct <= 100) || !(p.pricing.rateMin > 0) || p.pricing.rateMax < p.pricing.rateMin) throw bad('Biểu giá không hợp lệ')
    if (p.eligibility.minAmount > p.eligibility.maxAmount) throw bad('Khoảng giá trị tài trợ không hợp lệ')
    // mọi lần sửa nội dung đều quay lại chờ FCC duyệt
    const publish = c.autoApprove && p.status !== 'draft'
    const next: FinancingProduct = { ...p, id: ex?.id ?? uid('P'), lenderId: c.actor.id, version: ex ? ex.version + 1 : 1, status: p.status === 'draft' ? 'draft' : publish ? 'published' : 'pending_review', fccApproved: publish }
    c.s.products = ex ? c.s.products.map((x) => (x.id === next.id ? next : x)) : [next, ...c.s.products]
    log(c, 'Lưu sản phẩm Marketplace', next.id, `${next.name} — phiên bản v${next.version}, ${next.status === 'draft' ? 'nháp' : publish ? 'công bố (chế độ dev)' : 'chờ FCC duyệt'}`)
    return next
  },
  setProductStatus(c, id: string, status: FinancingProduct['status']) {
    const p = c.s.products.find((x) => x.id === id)
    if (!p) throw notFound('Không tìm thấy sản phẩm')
    requireSelf(c, p.lenderId)
    if (status === 'published') {
      if (!p.fccApproved) throw forbidden('Sản phẩm cần FCC duyệt trước khi công bố')
    } else if (!['draft', 'pending_review', 'paused'].includes(status)) throw bad('Trạng thái không hợp lệ')
    if (status === 'pending_review' && p.fccApproved) throw conflict('Sản phẩm đã được duyệt')
    c.s.products = c.s.products.map((x) => (x.id === id ? { ...x, status } : x))
    log(c, 'Đổi trạng thái sản phẩm', id, status)
  },

  /** Cập nhật hồ sơ tổ chức của chính mình (MST không đổi được). */
  updateOrg(c, patch: Partial<Pick<Org, 'name' | 'shortName' | 'vsic' | 'industryLabel' | 'industryGroup' | 'province' | 'foundedYear' | 'employees' | 'listedSymbol' | 'exchange'>>) {
    const o = c.actor
    const next: Org = { ...o }
    const text = (k: 'name' | 'shortName' | 'vsic' | 'industryLabel' | 'province', max: number) => {
      if (patch[k] === undefined) return
      const v = String(patch[k]).trim()
      if (!v || v.length > max) throw bad(`Giá trị ${k} không hợp lệ`)
      next[k] = v
    }
    text('name', 200); text('shortName', 40); text('vsic', 8); text('industryLabel', 200); text('province', 80)
    if (patch.industryGroup !== undefined) {
      if (!['manufacturing', 'trade', 'agri', 'tech'].includes(patch.industryGroup)) throw bad('Nhóm ngành không hợp lệ')
      next.industryGroup = patch.industryGroup
    }
    if (patch.foundedYear !== undefined) {
      if (!Number.isInteger(patch.foundedYear) || patch.foundedYear < 1900 || patch.foundedYear > c.now.getFullYear()) throw bad('Năm thành lập không hợp lệ')
      next.foundedYear = patch.foundedYear
    }
    if (patch.employees !== undefined) {
      if (!Number.isInteger(patch.employees) || patch.employees < 0) throw bad('Số lao động không hợp lệ')
      next.employees = patch.employees
    }
    if (o.type === 'buyer' && patch.listedSymbol !== undefined) {
      const sym = String(patch.listedSymbol).trim().toUpperCase()
      if (sym && !/^[A-Z0-9]{2,6}$/.test(sym)) throw bad('Mã chứng khoán không hợp lệ')
      next.listedSymbol = sym || undefined
      next.exchange = sym && ['HOSE', 'HNX', 'UPCOM'].includes(String(patch.exchange)) ? patch.exchange : undefined
    }
    c.s.orgs = c.s.orgs.map((x) => (x.id === o.id ? next : x))
    log(c, 'Cập nhật hồ sơ tổ chức', o.id, Object.keys(patch).join(', '))
  },

  // ===== Quản trị FCC =====
  approveProduct(c, id: string, approve: boolean, note?: string) {
    requireType(c, 'fcc')
    const p = c.s.products.find((x) => x.id === id)
    if (!p) throw notFound('Không tìm thấy sản phẩm')
    requireState('Sản phẩm', p.status, ['pending_review'])
    c.s.products = c.s.products.map((x) => (x.id === id ? { ...x, status: approve ? 'published' : 'draft', fccApproved: approve } : x))
    notify(c, p.lenderId, approve ? `Sản phẩm “${p.name}” đã được duyệt` : `Sản phẩm “${p.name}” chưa được duyệt`, approve ? 'Sản phẩm đã công bố trên Marketplace.' : (note ?? 'Cần chỉnh sửa và gửi lại.'), '/marketplace?tab=mine')
    log(c, approve ? 'FCC duyệt sản phẩm' : 'FCC từ chối sản phẩm', id, note ?? p.name)
  },
  verifyOrg(c, orgId: string, verified: boolean) {
    requireType(c, 'fcc')
    const o = c.s.orgs.find((x) => x.id === orgId)
    if (!o || o.type !== 'lender') throw notFound('Chỉ xác minh tổ chức tài chính')
    c.s.orgs = c.s.orgs.map((x) => (x.id === orgId ? { ...x, verified } : x))
    notify(c, orgId, verified ? 'Tổ chức đã được FCC xác minh' : 'FCC đã thu hồi xác minh', verified ? 'Bạn có thể đăng sản phẩm lên Marketplace.' : 'Sản phẩm đang công bố vẫn hiển thị cho đến khi FCC tạm dừng.')
    log(c, verified ? 'FCC xác minh tổ chức tài chính' : 'FCC thu hồi xác minh', orgId, o.name)
  },

  // ===== Xác minh danh tính người đại diện (eKYC / đối chiếu giấy tờ) =====
  /** Chủ tổ chức nộp hồ sơ người đại diện; giấy tờ đã tải lên kho tệp (route kiểm tra tệp thuộc tổ chức). */
  submitKyc(c, input: { representativeName: string; documentKeys: string[] }) {
    if (c.actor.type === 'fcc') throw forbidden('Tổ chức FCC không cần eKYC')
    const name = String(input?.representativeName ?? '').trim()
    if (!name || name.length > 120) throw bad('Cần họ tên người đại diện theo pháp luật')
    const keys = Array.isArray(input?.documentKeys) ? input.documentKeys : []
    if (!keys.length || keys.length > 10 || !keys.every((k) => /^[0-9a-f]{64}$/.test(k))) throw bad('Cần 1–10 giấy tờ đã tải lên (CCCD/hộ chiếu, giấy phép đăng ký kinh doanh)')
    if (c.actor.kyc?.status === 'verified') throw conflict('Tổ chức đã được xác minh')
    const kyc = { status: 'pending' as const, method: 'manual_documents' as const, representativeName: name, documentKeys: keys, submittedAt: iso(c.now), submittedBy: c.userId ?? 'system' }
    c.s.orgs = c.s.orgs.map((o) => (o.id === c.actor.id ? { ...o, kyc } : o))
    for (const f of c.s.orgs.filter((x) => x.type === 'fcc')) notify(c, f.id, 'Hồ sơ xác minh người đại diện mới', `${c.actor.name} (MST ${c.actor.taxCode})`, '/admin')
    log(c, 'Nộp hồ sơ xác minh người đại diện', c.actor.id, `${name} · ${keys.length} giấy tờ`)
  },
  decideKyc(c, orgId: string, approve: boolean, note?: string) {
    requireType(c, 'fcc')
    const o = c.s.orgs.find((x) => x.id === orgId)
    if (!o?.kyc) throw notFound('Tổ chức chưa nộp hồ sơ xác minh')
    requireState('Hồ sơ xác minh', o.kyc.status, ['pending'])
    if (!approve && !note?.trim()) throw bad('Cần nêu lý do không xác minh')
    const kyc = { ...o.kyc, status: approve ? ('verified' as const) : ('rejected' as const), decidedAt: iso(c.now), decidedBy: c.userId ?? 'system', note: note?.trim() || undefined }
    c.s.orgs = c.s.orgs.map((x) => (x.id === orgId ? { ...x, kyc } : x))
    notify(c, orgId, approve ? 'Người đại diện đã được xác minh' : 'Hồ sơ xác minh chưa đạt', approve ? 'FCC đã đối chiếu giấy tờ người đại diện.' : `Lý do: ${note}`, '/settings')
    log(c, approve ? 'FCC xác minh người đại diện' : 'FCC từ chối hồ sơ xác minh', orgId, note?.trim() || o.kyc.representativeName)
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
    const a = esgAccess(c, assessmentId, 'any')
    const OWNER_FIELDS = ['aiLevel', 'aiRationale', 'aiCitations', 'aiMissing', 'aiSimulated', 'selfDeclared']
    const REVIEWER_FIELDS = ['finalLevel', 'na', 'naReason', 'reviewerNote', 'redFlag']
    const keys = Object.keys(patch ?? {})
    if (keys.some((k) => !OWNER_FIELDS.includes(k) && !REVIEWER_FIELDS.includes(k))) throw bad('Trường không hợp lệ')
    const isFcc = c.actor.type === 'fcc'
    if (keys.some((k) => REVIEWER_FIELDS.includes(k)) && !isFcc) throw forbidden('Chỉ người thẩm định FCC mới được xác nhận mức/ghi chú thẩm định')
    if (keys.some((k) => OWNER_FIELDS.includes(k)) && isFcc) throw forbidden('Người thẩm định không sửa dữ liệu tự khai/đề xuất AI của doanh nghiệp')
    if ('finalLevel' in patch && patch.finalLevel !== undefined && ![0, 1, 2, 3, 4].includes(patch.finalLevel)) throw bad('Mức chỉ tiêu phải từ 0 đến 4')
    const has = a.indicators.some((i) => i.code === code)
    const indicators = has ? a.indicators.map((i) => (i.code === code ? { ...i, ...patch } : i)) : [...a.indicators, { code, ...patch }]
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, indicators, status: x.status === 'official' || x.status === 'draft' ? 'in_review' : x.status } : x))
    if ('finalLevel' in patch || 'na' in patch) log(c, 'Reviewer cập nhật chỉ tiêu ESG', `${a.id}/${code}`, patch.na ? `N/A: ${patch.naReason ?? ''}` : `Mức ${patch.finalLevel ?? 'chưa xác minh'}${patch.reviewerNote ? ` — ${patch.reviewerNote}` : ''}`)
  },
  addEsgDocument(c, assessmentId: string, doc: EsgDocument) {
    const a = esgAccess(c, assessmentId, 'owner')
    if (!doc?.name || !doc.mime) throw bad('Thiếu thông tin tài liệu')
    if (doc.dataUrl && doc.dataUrl.length > 8_000_000) throw bad('Tệp quá lớn (tối đa ~6 MB)')
    const clean: EsgDocument = { ...doc, fileKey: /^[0-9a-f]{64}$/.test(String(doc.fileKey)) ? doc.fileKey : undefined, id: doc.id || uid('doc'), uploadedAt: c.now.toISOString(), indicatorCodes: doc.indicatorCodes ?? [] }
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, documents: [clean, ...x.documents] } : x))
    log(c, 'Tải bằng chứng ESG', a.id, `${clean.name} → ${clean.indicatorCodes.join(', ') || 'chưa phân loại'}`)
  },
  updateEsgMetrics(c, assessmentId: string, m: Partial<EsgAssessment['metrics']>) {
    const a = esgAccess(c, assessmentId, 'owner')
    const allowed = ['kwh12m', 'waterM3_12m', 'solarKwh12m', 'bhxhCovered', 'employees'] as const
    const clean: EsgAssessment['metrics'] = {}
    for (const k of allowed) if (m?.[k] !== undefined && Number.isFinite(m[k])) clean[k] = m[k]
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, metrics: { ...x.metrics, ...clean } } : x))
  },
  issueEsg(c, assessmentId: string, official: boolean) {
    const a = esgAccess(c, assessmentId, 'any')
    if (official && c.actor.type !== 'fcc') throw forbidden('Chỉ người thẩm định FCC mới được phát hành điểm ESG chính thức')
    if (!official && c.actor.type === 'fcc') throw forbidden('Người thẩm định chỉ phát hành điểm chính thức')
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, status: official ? 'official' : 'provisional', issuedAt: iso(c.now), validUntil: iso(new Date(c.now.getTime() + 365 * DAY)) } : x))
    log(c, official ? 'Phát hành điểm ESG chính thức' : 'Lưu điểm ESG tạm tính', assessmentId, '')
  },
  setEsgIndustry(c, assessmentId: string, g: EsgAssessment['industryGroup']) {
    const a = esgAccess(c, assessmentId, 'owner')
    if (!['manufacturing', 'trade', 'agri', 'tech'].includes(g)) throw bad('Nhóm ngành không hợp lệ')
    c.s.esg = c.s.esg.map((x) => (x.id === a.id ? { ...x, industryGroup: g } : x))
  },

  // ===== Hồ sơ chấm điểm =====
  /** Nạp dữ liệu niêm yết từ file JSON do scripts/fetch_listed.py (vnstock) sinh ra; máy chủ tự đọc, không nhận dữ liệu từ trình duyệt. */
  refreshListed(c, symbol: string) {
    if (c.actor.type !== 'buyer' || !c.actor.listedSymbol) throw forbidden('Chỉ bên mua có mã chứng khoán đã khai báo mới nạp dữ liệu niêm yết')
    const sym = String(symbol ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{2,6}$/.test(sym)) throw bad('Mã chứng khoán không hợp lệ')
    if (sym !== c.actor.listedSymbol.toUpperCase()) throw forbidden(`Tổ chức chỉ được nạp dữ liệu của mã ${c.actor.listedSymbol}`)
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

  // ===== Dòng tiền =====
  /** Doanh nghiệp tự khai số dư tiền và các khoản chi định kỳ; công nợ lấy từ hóa đơn trên FCC và file nhập. */
  saveCashProfile(c, orgId: string, input: { openingCash: number; recurringMonthlyOut: { name: string; amount: number; day: number }[] }) {
    requireSelf(c, orgId)
    if (c.actor.type === 'lender' || c.actor.type === 'fcc') throw forbidden('Chỉ doanh nghiệp bán/mua mới thiết lập dòng tiền')
    if (!Number.isFinite(input?.openingCash) || input.openingCash < 0) throw bad('Số dư tiền không hợp lệ')
    const out = (input.recurringMonthlyOut ?? []).map((r) => {
      if (!r.name?.trim() || !(r.amount > 0) || !Number.isInteger(r.day) || r.day < 1 || r.day > 28) throw bad('Khoản chi định kỳ không hợp lệ (ngày 1–28)')
      return { name: r.name.trim().slice(0, 80), amount: Math.round(r.amount), day: r.day }
    })
    const conn: AccountingConnection = { orgId, provider: 'CSV', method: 'file', status: 'connected', lastSyncedAt: c.now.toISOString(), openingCash: Math.round(input.openingCash), recurringMonthlyOut: out, buyerDelayDays: {} }
    c.s.connections = [conn, ...c.s.connections.filter((x) => x.orgId !== orgId)]
    log(c, 'Cập nhật thiết lập dòng tiền', orgId, `Số dư ${vnd(conn.openingCash)} ₫, ${out.length} khoản chi định kỳ`)
  },
  importLedger(c, orgId: string, items: LedgerItem[]) {
    requireSelf(c, orgId)
    if (!Array.isArray(items) || items.length === 0 || items.length > 5000) throw bad('Dữ liệu công nợ không hợp lệ')
    const clean: LedgerItem[] = items.map((i) => {
      if (!i.docNo || !(i.amount >= 0) || !(i.paid >= 0) || !isDate(i.dueDate) || (i.kind !== 'AR' && i.kind !== 'AP')) throw bad(`Dòng công nợ không hợp lệ: ${i.docNo ?? '?'}`)
      return { id: i.id || uid('L'), orgId, kind: i.kind, counterpartyName: String(i.counterpartyName ?? ''), counterpartyTaxCode: i.counterpartyTaxCode, docNo: i.docNo, amount: i.amount, paid: i.paid, dueDate: i.dueDate }
    })
    c.s.ledger = [...c.s.ledger.filter((l) => l.orgId !== orgId || !clean.some((i) => i.docNo === l.docNo)), ...clean]
    c.s.connections = c.s.connections.map((x) => (x.orgId === orgId ? { ...x, lastSyncedAt: c.now.toISOString() } : x))
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
  markNotificationsRead(c) {
    c.s.notifications = c.s.notifications.map((n) => (n.orgId === c.actor.id ? { ...n, read: true } : n))
  },
}

// ---------------- dùng chung với webhook/tick ----------------
function putResponse(c: Ctx, q: Rfq, resp: RfqResponse) {
  c.s.rfqs = c.s.rfqs.map((x) => (x.id === q.id ? { ...x, state: 'RESPONDED', responses: [...x.responses.filter((y) => y.lenderId !== resp.lenderId), resp] } : x))
  notify(c, q.sellerId, `Báo giá mới cho ${q.id}`, `${orgName(c, resp.lenderId)} ${resp.kind === 'quote' ? `báo giá ${resp.ratePct}%/năm, ứng ${resp.advancePct}%` : 'từ chối'}.`, '/marketplace?tab=rfq')
  log(c, resp.kind === 'quote' ? 'Đối tác trả báo giá sơ bộ' : 'Đối tác từ chối RFQ', q.id, orgName(c, resp.lenderId))
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
  emit(c, r.sellerId, 'application.funded', { applicationId: a.id, amount: amt })
  log(c, 'Ghi nhận giải ngân', a.id, `${vnd(amt)} ₫ — ${source}`)
  return true
}

function esgAccess(c: Ctx, assessmentId: string, who: 'owner' | 'any') {
  const a = c.s.esg.find((x) => x.id === assessmentId)
  if (!a) throw notFound('Không tìm thấy đánh giá ESG')
  if (!(who === 'any' && c.actor.type === 'fcc')) requireSelf(c, a.orgId)
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
    for (const l of new Set(q.productIds.map((p) => c.s.products.find((x) => x.id === p)?.lenderId).filter(Boolean) as string[])) emit(c, l, 'rfq.closed', { rfqId: q.id, reason: 'expired' })
    log(c, 'RFQ hết hạn', q.id, 'Tự động')
    n++
  }
  for (const a of c.s.applications.filter((x) => x.state === 'OFFERED' && x.offer && x.offer.expiresAt < today)) {
    patchApp(c, a.id, { state: 'WITHDRAWN' })
    patchRecv(c, a.receivableId, { state: 'BUYER_CONFIRMED' })
    emit(c, a.lenderId, 'application.withdrawn', { applicationId: a.id, reason: 'offer_expired' })
    log(c, 'Đề nghị tài trợ hết hạn chấp thuận', a.id, 'Tự động')
    n++
  }
  for (const r of c.s.receivables.filter((x) => (['FUNDED', 'BUYER_CONFIRMED'] as ReceivableState[]).includes(x.state) && x.dueDate < today)) {
    patchRecv(c, r.id, { state: 'OVERDUE' })
    notify(c, r.buyerId, `${r.code} quá hạn thanh toán`, `Hạn thanh toán ${r.dueDate}.`, '/invoices')
    notify(c, r.sellerId, `${r.code} quá hạn thanh toán`, `Bên mua chưa thanh toán đến hạn ${r.dueDate}.`, '/invoices')
    const fa = c.s.applications.find((x) => x.receivableId === r.id && x.state === 'FUNDED')
    if (fa) emit(c, fa.lenderId, 'receivable.overdue', { applicationId: fa.id, receivableId: r.id, dueDate: r.dueDate })
    log(c, 'Khoản phải thu quá hạn', r.code, 'Tự động')
    n++
  }
  return n
}
