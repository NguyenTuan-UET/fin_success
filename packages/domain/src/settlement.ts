// Thu hồi theo thứ tự phí → lãi → gốc; phần thừa hoàn cho nhà cung cấp (hồ sơ dự án mục 3.3.b, lớp 1–2).
// Lãi tính theo ngày trên dư nợ gốc: lãi suất đề nghị đến hạn thanh toán của hóa đơn, sau đó lãi quá hạn = lãi suất × latePenaltyPct%.
// Hàm thuần, xác định: cùng chuỗi sự kiện → cùng kết quả. Số tiền do tổ chức tài chính xác nhận là nguồn sự thật.
import type { FundingApplication } from './types'

export interface SettlementEvent {
  id: string
  type: 'buyer_reported' | 'payment_received' | 'collateral_liquidated' | 'refund_due' | 'refund_paid'
  amount: number
  at: string // ISO
  source: 'lender' | 'buyer' | 'system'
  externalEventId?: string
  reference?: string
  note?: string
  /** Phân bổ của khoản thu (payment_received, collateral_liquidated) */
  allocation?: { fees: number; interest: number; principal: number; surplus: number }
}

export interface Balance {
  principal: number
  interest: number
  fees: number
  /** Tổng còn phải thu hồi */
  outstanding: number
  /** Tổng đã thu (thanh toán + thanh lý tài sản) */
  received: number
  /** Phần thừa phải hoàn cho nhà cung cấp */
  surplus: number
  settled: boolean
}

const DAY = 86_400_000
const day = (iso: string) => Math.floor(new Date(iso).getTime() / DAY)
const r0 = (n: number) => Math.round(n)

type Offer = NonNullable<FundingApplication['offer']>
const RECEIVED: SettlementEvent['type'][] = ['payment_received', 'collateral_liquidated']

/** Lãi phát sinh trên `principal` từ ngày a đến ngày b (b > a), tách phần trong hạn và quá hạn. */
function accrue(principal: number, ratePct: number, lateRatePct: number, fromDay: number, toDay: number, dueDay: number) {
  if (toDay <= fromDay || principal <= 0) return 0
  const normalDays = Math.max(0, Math.min(toDay, dueDay) - fromDay)
  const lateDays = Math.max(0, toDay - Math.max(fromDay, dueDay))
  return (principal * ratePct * normalDays + principal * lateRatePct * lateDays) / 36500
}

/** Dư nợ tại thời điểm `asOf` sau khi áp dụng các khoản thu theo thứ tự thời gian. */
export function balanceAt(offer: Offer, fundedAt: string, dueDate: string, events: SettlementEvent[], asOf: string, latePenaltyPct = 150): Balance {
  const lateRate = (offer.ratePct * latePenaltyPct) / 100
  const dueDay = day(dueDate)
  let principal = offer.advanceVnd
  let interest = 0
  let fees = offer.feesVnd
  let received = 0
  let surplus = 0
  let last = day(fundedAt)
  const paid = events.filter((e) => RECEIVED.includes(e.type) && e.at <= asOf).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1))
  for (const e of paid) {
    const d = day(e.at)
    interest += accrue(principal, offer.ratePct, lateRate, last, d, dueDay)
    last = Math.max(last, d)
    let left = e.amount
    const f = Math.min(left, fees)
    fees -= f
    left -= f
    const i = Math.min(left, r0(interest))
    interest -= i
    left -= i
    const p = Math.min(left, principal)
    principal -= p
    left -= p
    surplus += left
    received += e.amount
  }
  interest += accrue(principal, offer.ratePct, lateRate, last, day(asOf), dueDay)
  interest = Math.max(0, interest)
  const settled = principal <= 0 && r0(interest) <= 0 && fees <= 0
  return { principal: r0(principal), interest: r0(interest), fees: r0(fees), outstanding: settled ? 0 : r0(principal + interest + fees), received, surplus: r0(surplus), settled }
}

/** Phân bổ của riêng khoản thu `e` (để lưu kèm sự kiện): so dư nợ trước và sau khi áp dụng. */
export function allocationOf(offer: Offer, fundedAt: string, dueDate: string, prior: SettlementEvent[], e: SettlementEvent, latePenaltyPct = 150) {
  const before = balanceAt(offer, fundedAt, dueDate, prior, e.at, latePenaltyPct)
  const after = balanceAt(offer, fundedAt, dueDate, [...prior, e], e.at, latePenaltyPct)
  return { fees: before.fees - after.fees, interest: before.interest - after.interest, principal: before.principal - after.principal, surplus: after.surplus - before.surplus }
}

/** Số tiền cần thu để tất toán tại ngày `asOf`. */
export const payoffAt = (offer: Offer, fundedAt: string, dueDate: string, events: SettlementEvent[], asOf: string, latePenaltyPct = 150) =>
  balanceAt(offer, fundedAt, dueDate, events, asOf, latePenaltyPct).outstanding

/** Tổng tiền bên mua tự ghi nhận đã trả (để đối soát với tiền tổ chức tài chính xác nhận). */
export const reportedByBuyer = (events: SettlementEvent[]) => events.filter((e) => e.type === 'buyer_reported').reduce((a, e) => a + e.amount, 0)

export type Reconciliation = 'none' | 'pending' | 'matched' | 'mismatch'
/** Đối soát: bên mua báo đã trả ↔ tổ chức tài chính xác nhận đã nhận (chỉ tính thanh toán, không tính thanh lý tài sản). */
export function reconcile(events: SettlementEvent[]): Reconciliation {
  const reported = reportedByBuyer(events)
  const confirmed = events.filter((e) => e.type === 'payment_received').reduce((a, e) => a + e.amount, 0)
  if (!reported && !confirmed) return 'none'
  if (reported && !confirmed) return 'pending'
  return reported === confirmed ? 'matched' : 'mismatch'
}
