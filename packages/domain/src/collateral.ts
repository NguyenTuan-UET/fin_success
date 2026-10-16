// Định giá sơ bộ tài sản bảo đảm và phân loại hồ sơ (i)/(ii)/(iii) — hồ sơ dự án mục 3.3.b bước 2–3.
// Đây là ước tính THAM KHẢO theo hệ số công khai, không có giá trị pháp lý: tổ chức tài chính tự quyết định giá trị được công nhận.
import { RATING_ORDER } from './credit'
import type { CollateralItem, Rating } from './types'

/** Hệ số chiết khấu theo loại tài sản (giá trị tham khảo được tính vào cơ sở bảo đảm). */
export const COLLATERAL_HAIRCUT: Record<CollateralItem['kind'], { factor: number; label: string; note: string }> = {
  realestate: { factor: 0.7, label: 'Bất động sản', note: 'Tối đa 70% giá trị khai báo' },
  machinery: { factor: 0.5, label: 'Máy móc, thiết bị', note: 'Tối đa 50% do khấu hao nhanh' },
  inventory: { factor: 0.4, label: 'Hàng tồn kho', note: 'Tối đa 40% do biến động giá và thanh khoản' },
}

export function preliminaryValue(c: CollateralItem) {
  return Math.round(c.declaredValue * COLLATERAL_HAIRCUT[c.kind].factor)
}
export const totalPreliminaryValue = (cs: CollateralItem[]) => cs.reduce((t, c) => t + preliminaryValue(c), 0)

export type FundingCase = 1 | 2 | 3

export interface Classification {
  case: FundingCase
  label: string
  /** FCC không gợi ý sản phẩm với nhóm (iii) */
  suggestProducts: boolean
  reasons: string[]
}

const rank = (r: Rating) => RATING_ORDER.indexOf(r) // RATING_ORDER: CCC thấp nhất → AAA cao nhất
const GOOD: Rating = 'BBB'

/**
 * (i) có tài sản bảo đảm và khoản phải thu tốt; (ii) không tài sản bảo đảm nhưng khoản phải thu chất lượng, bên mua uy tín;
 * (iii) khoản phải thu yếu hoặc điểm thấp — không gợi ý sản phẩm. Ngưỡng là tham số khởi tạo (scorecard_versions).
 */
export function classifyFunding(i: { applicationRating: Rating; buyerRating: Rating; collateralValue: number; amount: number }): Classification {
  const goodReceivable = rank(i.applicationRating) >= rank(GOOD) && rank(i.buyerRating) >= rank(GOOD)
  const reasons: string[] = []
  if (!goodReceivable) {
    if (rank(i.applicationRating) < rank(GOOD)) reasons.push(`Điểm hồ sơ ${i.applicationRating} thấp hơn ngưỡng ${GOOD}`)
    if (rank(i.buyerRating) < rank(GOOD)) reasons.push(`Bên mua xếp hạng ${i.buyerRating} thấp hơn ngưỡng ${GOOD}`)
    return { case: 3, label: '(iii) Không đủ điều kiện', suggestProducts: false, reasons }
  }
  if (i.collateralValue > 0) return { case: 1, label: '(i) Có tài sản bảo đảm và khoản phải thu tốt', suggestProducts: true, reasons: [`Cơ sở bảo đảm tham khảo ${Math.round(i.collateralValue).toLocaleString('vi-VN')} ₫`] }
  return { case: 2, label: '(ii) Không tài sản bảo đảm, dựa trên khoản phải thu', suggestProducts: true, reasons: ['Khoản phải thu chất lượng, bên mua uy tín'] }
}
