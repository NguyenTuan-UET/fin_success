// Hồ sơ hành vi của 3 tổ chức tài chính giả lập. Số liệu là cấu hình của ngân hàng giả lập, không phải biểu giá thật của ai.
// Ưu đãi xanh 0,3–0,5% theo hồ sơ dự án (REPPORT_FINSUCCESS mục 6.3).

export type Rating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC'
export const RATING_ORDER: Rating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC']
export const atLeast = (r: Rating, min: Rating) => RATING_ORDER.indexOf(r) <= RATING_ORDER.indexOf(min)

export interface ProductDef {
  name: string
  type: 'factoring_recourse' | 'factoring_nonrecourse' | 'invoice_finance' | 'reverse_factoring' | 'green_loan'
  description: string
  advancePct: number
  rateMin: number
  rateMax: number
  feePct: number
  minAmount: number
  maxAmount: number
  maxTenorDays: number
  minApplicationRating?: Rating
  minBuyerRating?: Rating
  green?: { minEsg: number; minCoverage: number; discountPct: number }
}

export interface Profile {
  /** Hạng hồ sơ thấp nhất được báo giá/duyệt */
  minRating: Rating
  /** Cộng vào lãi suất sàn theo hạng hồ sơ (điểm %) */
  spread: Record<Rating, number>
  /** Thời gian từ khi doanh nghiệp chấp thuận tới khi giải ngân (giây); demo T+1 thu gọn */
  disburseDelaySec: number
  products: ProductDef[]
}

const SPREAD_STD: Record<Rating, number> = { AAA: 0, AA: 0.3, A: 0.7, BBB: 1.4, BB: 2.4, B: 3.5, CCC: 5 }

export const PROFILES: Record<string, Profile> = {
  ankhang: {
    minRating: 'BBB',
    spread: SPREAD_STD,
    disburseDelaySec: 30,
    products: [
      { name: 'Bao thanh toán có truy đòi', type: 'factoring_recourse', description: 'Ứng trước khoản phải thu đã được bên nhập khẩu xác nhận; truy đòi đơn vị xuất khẩu nếu bên nhập khẩu không trả.', advancePct: 80, rateMin: 8, rateMax: 11.5, feePct: 0.2, minAmount: 100_000_000, maxAmount: 10_000_000_000, maxTenorDays: 150, minApplicationRating: 'BBB', green: { minEsg: 70, minCoverage: 0.8, discountPct: 0.5 } },
      { name: 'Tài trợ chuỗi cung ứng theo bên nhập khẩu', type: 'reverse_factoring', description: 'Hạn mức theo uy tín bên nhập khẩu đầu chuỗi; áp dụng cho đơn vị xuất khẩu của bên nhập khẩu đã ký chương trình.', advancePct: 90, rateMin: 7, rateMax: 9.5, feePct: 0.15, minAmount: 50_000_000, maxAmount: 20_000_000_000, maxTenorDays: 180, minBuyerRating: 'A' },
    ],
  },
  binhminh: {
    minRating: 'BB',
    spread: { ...SPREAD_STD, BB: 3, B: 4.5 },
    disburseDelaySec: 30,
    products: [
      { name: 'Tài trợ hóa đơn nhanh', type: 'invoice_finance', description: 'Hồ sơ đơn giản cho doanh nghiệp xuất khẩu, phê duyệt nhanh; lãi cao hơn ngân hàng.', advancePct: 75, rateMin: 10, rateMax: 15, feePct: 0.5, minAmount: 30_000_000, maxAmount: 3_000_000_000, maxTenorDays: 120, minApplicationRating: 'BB' },
      { name: 'Bao thanh toán miễn truy đòi', type: 'factoring_nonrecourse', description: 'Tổ chức tài chính chịu rủi ro bên nhập khẩu không trả; cần bên nhập khẩu hạng tốt.', advancePct: 70, rateMin: 11, rateMax: 14, feePct: 0.6, minAmount: 100_000_000, maxAmount: 5_000_000_000, maxTenorDays: 120, minBuyerRating: 'A' },
    ],
  },
  cuulong: {
    minRating: 'BBB',
    spread: SPREAD_STD,
    disburseDelaySec: 30,
    products: [
      { name: 'Tín dụng xanh cho đơn vị xuất khẩu', type: 'green_loan', description: 'Ưu tiên doanh nghiệp có điểm ESG chính thức; giảm lãi khi đạt ngưỡng xanh.', advancePct: 70, rateMin: 8.5, rateMax: 11, feePct: 0.2, minAmount: 100_000_000, maxAmount: 8_000_000_000, maxTenorDays: 180, minApplicationRating: 'BBB', green: { minEsg: 65, minCoverage: 0.8, discountPct: 0.3 } },
    ],
  },
}
