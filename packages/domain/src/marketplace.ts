// Marketplace tài chính — SPEC mục 6: lọc điều kiện, chi phí ước tính từ biểu giá công bố, xếp theo chi phí.
import { ratingAtLeast } from './credit'
import type { FinancingProduct, IndustryGroup, ProductType, Rating, Receivable } from './types'

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  factoring_recourse: 'Bao thanh toán có truy đòi',
  factoring_nonrecourse: 'Bao thanh toán miễn truy đòi',
  invoice_finance: 'Tài trợ hóa đơn',
  reverse_factoring: 'SCF do bên mua khởi tạo',
  green_loan: 'Tín dụng xanh vốn lưu động',
}

export interface MatchContext {
  receivable: Receivable
  industryGroup: IndustryGroup
  supplierRating: Rating
  buyerRating: Rating
  applicationRating: Rating
  esg?: { score: number; coverage: number; official: boolean; flags: number }
  now?: Date
}

export interface CostEstimate {
  tenorDays: number
  advance: number
  rateMin: number
  rateMax: number
  interestMin: number
  interestMax: number
  fees: number
  upfrontFees: number
  totalMin: number
  totalMax: number
  netReceived: number
  effAprMin: number // %/năm (đã nhân 100)
  effAprMax: number
  greenApplied: boolean
  greenDiscount: number
}

export interface MatchResult {
  product: FinancingProduct
  eligible: boolean
  reasons: string[] // lý do chưa phù hợp
  fits: string[] // lý do phù hợp
  cost: CostEstimate
}

export function greenEligible(p: FinancingProduct, esg?: MatchContext['esg']) {
  const g = p.greenRule
  return !!(g && esg && esg.official && esg.flags === 0 && esg.score >= g.minEsg && esg.coverage >= g.minCoverage)
}

export function estimateCost(p: FinancingProduct, amount: number, tenorDays: number, esg?: MatchContext['esg']): CostEstimate {
  const advance = Math.round((amount * p.pricing.advancePct) / 100)
  const green = greenEligible(p, esg)
  const disc = green ? (p.greenRule as NonNullable<FinancingProduct['greenRule']>).discountPct : 0
  const rateMin = Math.max(0, p.pricing.rateMin - disc)
  const rateMax = Math.max(0, p.pricing.rateMax - disc)
  const interest = (r: number) => Math.round((advance * (r / 100) * tenorDays) / 365)
  let fees = 0
  let upfront = 0
  for (const f of p.pricing.fees) {
    const v = f.kind === 'fixed' ? f.value : Math.round((advance * f.value) / 100)
    fees += v
    if (f.upfront) upfront += v
  }
  const interestMin = interest(rateMin)
  const interestMax = interest(rateMax)
  const netReceived = advance - upfront
  const apr = (total: number) => (netReceived > 0 && tenorDays > 0 ? (total / netReceived) * (365 / tenorDays) * 100 : 0)
  return {
    tenorDays,
    advance,
    rateMin,
    rateMax,
    interestMin,
    interestMax,
    fees,
    upfrontFees: upfront,
    totalMin: interestMin + fees,
    totalMax: interestMax + fees,
    netReceived,
    effAprMin: apr(interestMin + fees),
    effAprMax: apr(interestMax + fees),
    greenApplied: green,
    greenDiscount: disc,
  }
}

export function tenorOf(r: Receivable, now = new Date()) {
  return Math.max(1, Math.round((new Date(r.dueDate).getTime() - now.getTime()) / 86_400_000))
}

export function matchProduct(p: FinancingProduct, ctx: MatchContext): MatchResult {
  const now = ctx.now ?? new Date()
  const r = ctx.receivable
  const e = p.eligibility
  const tenor = tenorOf(r, now)
  const reasons: string[] = []
  const fits: string[] = []
  const check = (ok: boolean, okMsg: string, failMsg: string) => (ok ? fits.push(okMsg) : reasons.push(failMsg))

  if (p.status !== 'published' || new Date(p.effectiveTo) < now) reasons.push('Sản phẩm không còn công bố')
  if (e.industryGroups?.length) check(e.industryGroups.includes(ctx.industryGroup), 'Đúng nhóm ngành', 'Ngành không thuộc phạm vi sản phẩm')
  check(r.amount >= e.minAmount && r.amount <= e.maxAmount, 'Giá trị trong khoảng tài trợ', `Giá trị ngoài khoảng ${fmt(e.minAmount)}–${fmt(e.maxAmount)}`)
  check(tenor <= e.maxTenorDays, `Kỳ hạn ${tenor} ngày ≤ ${e.maxTenorDays}`, `Kỳ hạn ${tenor} ngày vượt tối đa ${e.maxTenorDays} ngày`)
  if (e.requireBuyerConfirmation) check(r.state === 'BUYER_CONFIRMED', 'Đã được bên mua xác nhận', 'Cần bên mua xác nhận khoản phải thu')
  if (e.buyerWhitelist?.length) check(e.buyerWhitelist.includes(r.buyerId), 'Bên mua thuộc chương trình', 'Bên mua không thuộc danh sách chương trình')
  if (e.minSupplierRating) check(ratingAtLeast(ctx.supplierRating, e.minSupplierRating), `Bên bán ${ctx.supplierRating} ≥ ${e.minSupplierRating}`, `Cần xếp hạng bên bán ≥ ${e.minSupplierRating} — hiện tại ${ctx.supplierRating}`)
  if (e.minBuyerRating) check(ratingAtLeast(ctx.buyerRating, e.minBuyerRating), `Bên mua ${ctx.buyerRating} ≥ ${e.minBuyerRating}`, `Cần xếp hạng bên mua ≥ ${e.minBuyerRating} — hiện tại ${ctx.buyerRating}`)
  if (e.minApplicationRating) check(ratingAtLeast(ctx.applicationRating, e.minApplicationRating), `Hồ sơ ${ctx.applicationRating} ≥ ${e.minApplicationRating}`, `Cần xếp hạng hồ sơ ≥ ${e.minApplicationRating} — hiện tại ${ctx.applicationRating}`)
  if (e.minEsg !== undefined) {
    const ok = !!ctx.esg?.official && ctx.esg.score >= e.minEsg
    check(ok, `ESG ${ctx.esg?.score.toFixed(0)} ≥ ${e.minEsg}`, ctx.esg?.official ? `Cần ESG chính thức ≥ ${e.minEsg} — hiện tại ${ctx.esg.score.toFixed(0)}` : `Cần điểm ESG chính thức ≥ ${e.minEsg}`)
  }
  return { product: p, eligible: reasons.length === 0, reasons, fits, cost: estimateCost(p, r.amount, tenor, ctx.esg) }
}

export type SortKey = 'cost' | 'advance' | 'sla'

export function rankMatches(ms: MatchResult[], sort: SortKey = 'cost') {
  const s = [...ms]
  if (sort === 'cost') s.sort((a, b) => a.cost.effAprMin - b.cost.effAprMin)
  if (sort === 'advance') s.sort((a, b) => b.product.pricing.advancePct - a.product.pricing.advancePct)
  if (sort === 'sla') s.sort((a, b) => (a.product.sla.reviewHours ?? 999) - (b.product.sla.reviewHours ?? 999))
  return { eligible: s.filter((m) => m.eligible), ineligible: s.filter((m) => !m.eligible) }
}

function fmt(v: number) {
  return v >= 1e9 ? `${(v / 1e9).toLocaleString('vi-VN')} tỷ` : `${(v / 1e6).toLocaleString('vi-VN')} tr`
}
