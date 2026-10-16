// Phát hiện bất thường hóa đơn theo luật xác định (hồ sơ dự án mục 3.3.a). Chỉ gắn cờ và đưa vào hàng đợi người xem xét;
// không tự từ chối hồ sơ. Trùng lặp được chặn riêng ở luật tạo khoản phải thu và ở ràng buộc CSDL.
import type { InvoiceFlag, Receivable } from './types'

export const FRAUD_PARAMS = { anomalyMultiple: 3, minHistory: 3, newBuyerLarge: 2_000_000_000, burstCount: 5, roundLarge: 1_000_000_000, futureDays: 1 }
const DAY = 86_400_000
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

type Draft = Pick<Receivable, 'sellerId' | 'buyerId' | 'amount' | 'issueDate' | 'source' | 'files' | 'docs'>

/** Cờ cho hóa đơn mới, dựa trên lịch sử các khoản phải thu khác của cùng cặp mua–bán. */
export function invoiceFlags(r: Draft, existing: Receivable[], now = new Date()): InvoiceFlag[] {
  const out: InvoiceFlag[] = []
  const pair = existing.filter((x) => x.sellerId === r.sellerId && x.buyerId === r.buyerId && x.state !== 'CANCELLED')

  if (pair.length >= FRAUD_PARAMS.minHistory) {
    const med = median(pair.map((x) => x.amount))
    if (med > 0 && r.amount > med * FRAUD_PARAMS.anomalyMultiple) {
      out.push({ code: 'AMOUNT_ANOMALY', severity: 'medium', detail: `Giá trị ${r.amount.toLocaleString('vi-VN')} ₫ gấp ${(r.amount / med).toFixed(1)} lần trung vị ${Math.round(med).toLocaleString('vi-VN')} ₫ của ${pair.length} hóa đơn trước với cùng bên mua.` })
    }
  }
  if (pair.length === 0 && r.amount >= FRAUD_PARAMS.newBuyerLarge) {
    out.push({ code: 'NEW_BUYER_LARGE', severity: 'medium', detail: `Bên mua mới (chưa có hóa đơn nào với nhà cung cấp này) và giá trị từ ${FRAUD_PARAMS.newBuyerLarge.toLocaleString('vi-VN')} ₫.` })
  }
  if (new Date(r.issueDate).getTime() > now.getTime() + FRAUD_PARAMS.futureDays * DAY) {
    out.push({ code: 'FUTURE_ISSUE_DATE', severity: 'high', detail: `Ngày lập ${r.issueDate} ở tương lai.` })
  }
  const sameDay = existing.filter((x) => x.sellerId === r.sellerId && x.buyerId === r.buyerId && x.createdAt.slice(0, 10) === now.toISOString().slice(0, 10) && x.state !== 'CANCELLED').length
  if (sameDay + 1 >= FRAUD_PARAMS.burstCount) {
    out.push({ code: 'BURST_SAME_BUYER', severity: 'low', detail: `${sameDay + 1} hóa đơn cho cùng bên mua trong một ngày.` })
  }
  if (r.source === 'manual' && r.amount >= FRAUD_PARAMS.roundLarge && r.amount % 1_000_000 === 0) {
    out.push({ code: 'ROUND_LARGE_MANUAL', severity: 'low', detail: 'Nhập tay, giá trị lớn và tròn triệu — nên đối chiếu chứng từ gốc.' })
  }
  if (!r.files?.some((f) => f.kind === 'invoice') && !r.docs.xml) {
    out.push({ code: 'NO_SOURCE_DOCUMENT', severity: 'low', detail: 'Chưa có tệp hóa đơn gốc đính kèm.' })
  }
  return out
}

export const openFlags = (r: { flags?: InvoiceFlag[] }) => (r.flags ?? []).filter((f) => !f.resolvedAt)
