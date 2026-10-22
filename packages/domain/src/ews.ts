// Cảnh báo sớm (EWS) theo luật xác định, giải thích được — hồ sơ dự án mục 3.3.b (lớp 4), SPEC mục 7.
// Chỉ phát hiện và đề xuất; tổ chức tài chính quyết định biện pháp.
import { buyerScoreOf, paymentHistory } from './engine'
import { RATING_ORDER } from './credit'
import type { AppData, FundingApplication, Receivable } from './types'
import { iso } from './util'

export type EwsSeverity = 'high' | 'medium' | 'low'
export type EwsCode = 'OVERDUE' | 'DUE_SOON' | 'BUYER_LATE_HISTORY' | 'BUYER_RATING_LOW' | 'CONCENTRATION' | 'DISPUTE_ON_FUNDED' | 'OFFER_EXPIRING'

export interface EwsAlert {
  id: string
  code: EwsCode
  severity: EwsSeverity
  applicationId?: string
  receivableId?: string
  buyerId?: string
  title: string
  detail: string
  /** Đề xuất xử lý (tổ chức tài chính tự quyết định) */
  suggestion: string
  /** Giá trị liên quan (VND) */
  amount?: number
}

type S = Pick<AppData, 'orgs' | 'profiles' | 'listed' | 'receivables' | 'esg' | 'external' | 'applications'>

export const EWS_PARAMS = { dueSoonDays: 7, concentrationShare: 0.4, lateHistoryDays: 5, lowRating: 'BB' as const, offerExpiringDays: 2 }
const DAY = 86_400_000
const daysTo = (s: string, now: Date) => Math.round((new Date(s).getTime() - new Date(iso(now)).getTime()) / DAY)

/** Cảnh báo cho danh mục hồ sơ của một tổ chức tài chính (hoặc một tập hồ sơ bất kỳ). */
export function ewsAlerts(s: S, apps: FundingApplication[], now = new Date()): EwsAlert[] {
  const out: EwsAlert[] = []
  const rec = new Map<string, Receivable>(s.receivables.map((r) => [r.id, r]))
  const funded = apps.filter((a) => a.state === 'FUNDED')
  const exposure = funded.reduce((t, a) => t + (a.fundedAmount ?? a.offer?.advanceVnd ?? 0), 0)

  const byBuyer = new Map<string, number>()
  for (const a of funded) {
    const r = rec.get(a.receivableId)
    if (r) byBuyer.set(r.buyerId, (byBuyer.get(r.buyerId) ?? 0) + (a.fundedAmount ?? a.offer?.advanceVnd ?? 0))
  }

  for (const a of apps) {
    const r = rec.get(a.receivableId)
    if (!r) continue
    const base = { applicationId: a.id, receivableId: r.id, buyerId: r.buyerId }
    if (a.state === 'FUNDED') {
      const d = daysTo(r.dueDate, now)
      const amt = a.fundedAmount ?? a.offer?.advanceVnd ?? 0
      if (r.state === 'OVERDUE' || d < 0) {
        out.push({ ...base, id: `${a.id}:OVERDUE`, code: 'OVERDUE', severity: -d > 30 ? 'high' : 'medium', amount: amt, title: `${r.code} quá hạn ${-d} ngày`, detail: `Bên nhập khẩu chưa thanh toán đến hạn ${r.dueDate}; dư nợ ${amt.toLocaleString('vi-VN')} ₫.`, suggestion: 'Đôn đốc bên nhập khẩu; kích hoạt xử lý tài sản bảo đảm nếu có và theo hợp đồng.' })
      } else if (d <= EWS_PARAMS.dueSoonDays) {
        out.push({ ...base, id: `${a.id}:DUE_SOON`, code: 'DUE_SOON', severity: 'low', amount: amt, title: `${r.code} đến hạn sau ${d} ngày`, detail: `Hạn thanh toán ${r.dueDate}.`, suggestion: 'Nhắc bên nhập khẩu; chuẩn bị đối soát khi tiền về.' })
      }
      const h = paymentHistory(s, r.buyerId)
      if (h.total >= 3 && h.avgLateDays > EWS_PARAMS.lateHistoryDays) {
        out.push({ ...base, id: `${a.id}:BUYER_LATE_HISTORY`, code: 'BUYER_LATE_HISTORY', severity: 'medium', title: `Bên nhập khẩu thường trả chậm (TB ${h.avgLateDays.toFixed(1)} ngày)`, detail: `${h.total} khoản gần đây, ${h.onTime} đúng hạn.`, suggestion: 'Rà soát hạn mức và điều kiện với bên nhập khẩu này.' })
      }
      const br = buyerScoreOf(s, r.buyerId).rating
      if (RATING_ORDER.indexOf(br) <= RATING_ORDER.indexOf(EWS_PARAMS.lowRating)) {
        out.push({ ...base, id: `${a.id}:BUYER_RATING_LOW`, code: 'BUYER_RATING_LOW', severity: 'medium', title: `Bên nhập khẩu xếp hạng ${br}`, detail: 'Hạng tham khảo thấp hơn ngưỡng theo dõi.', suggestion: 'Cân nhắc giảm hạn mức mới cho bên nhập khẩu này.' })
      }
      if (r.state === 'BUYER_DISPUTED') {
        out.push({ ...base, id: `${a.id}:DISPUTE_ON_FUNDED`, code: 'DISPUTE_ON_FUNDED', severity: 'high', title: `Bên nhập khẩu tranh chấp ${r.code} sau giải ngân`, detail: r.disputeReason ?? '', suggestion: 'Yêu cầu doanh nghiệp giải trình; tạm dừng giải ngân mới cùng bên nhập khẩu.' })
      }
    }
    if (a.state === 'OFFERED' && a.offer) {
      const d = daysTo(a.offer.expiresAt, now)
      if (d <= EWS_PARAMS.offerExpiringDays && d >= 0) out.push({ ...base, id: `${a.id}:OFFER_EXPIRING`, code: 'OFFER_EXPIRING', severity: 'low', title: `Đề nghị ${a.id} sắp hết hạn chấp thuận (${d} ngày)`, detail: `Hạn ${a.offer.expiresAt}.`, suggestion: 'Chờ doanh nghiệp chấp thuận hoặc gia hạn bằng đề nghị mới.' })
    }
  }

  if (exposure > 0) {
    for (const [buyerId, v] of byBuyer) {
      if (v / exposure > EWS_PARAMS.concentrationShare && byBuyer.size > 1) {
        const name = s.orgs.find((o) => o.id === buyerId)?.shortName ?? buyerId
        out.push({ id: `buyer:${buyerId}:CONCENTRATION`, code: 'CONCENTRATION', severity: 'medium', buyerId, amount: v, title: `Tập trung rủi ro vào ${name}`, detail: `${Math.round((v / exposure) * 100)}% dư nợ danh mục (ngưỡng ${EWS_PARAMS.concentrationShare * 100}%).`, suggestion: 'Đa dạng hóa bên nhập khẩu hoặc đặt hạn mức theo bên nhập khẩu.' })
      }
    }
  }
  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.amount ?? 0) - (a.amount ?? 0))
}
