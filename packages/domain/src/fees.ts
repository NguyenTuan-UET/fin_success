// Biểu phí FCC theo 6 nguồn thu của hồ sơ dự án (mục 3.3.5): phí giao dịch tài trợ, phí thuê nền tảng SaaS, phí chấm điểm tín dụng,
// phí kết nối API, phí báo cáo/phân tích, hoa hồng giới thiệu sản phẩm. Biểu phí có phiên bản; đổi biểu phí không đổi phí đã phát sinh.
export type FeeSource = 'transaction' | 'saas' | 'scoring' | 'api' | 'report' | 'referral'

export const FEE_SOURCES: Record<FeeSource, { label: string; payer: string }> = {
  transaction: { label: 'Phí giao dịch tài trợ hóa đơn', payer: 'Nhà cung cấp' },
  saas: { label: 'Phí thuê nền tảng SaaS', payer: 'Mọi tổ chức theo gói' },
  scoring: { label: 'Phí chấm điểm tín dụng', payer: 'Doanh nghiệp được chấm' },
  api: { label: 'Phí kết nối API', payer: 'Tổ chức tài chính' },
  report: { label: 'Phí báo cáo và phân tích dữ liệu', payer: 'Tổ chức xuất báo cáo' },
  referral: { label: 'Hoa hồng giới thiệu sản phẩm tài chính', payer: 'Tổ chức tài chính' },
}

export interface FeeSchedule {
  id: string
  name: string
  /** Phí giao dịch: % số tiền ứng, thu của nhà cung cấp khi giải ngân */
  transactionPct: number
  /** Phí thuê bao tháng theo loại tổ chức (VND) */
  saasMonthly: { supplier: number; buyer: number; lender: number }
  /** Mỗi lần phát hành điểm tín dụng chính thức (VND) */
  scoringFee: number
  /** Mỗi khóa tích hợp đang hoạt động mỗi tháng (VND) */
  apiMonthlyPerKey: number
  /** Mỗi lần xuất báo cáo (VND) */
  reportFee: number
  /** % phí xử lý của đề nghị tài trợ, thu của tổ chức tài chính khi giải ngân */
  referralPctOfFees: number
}

/** Biểu phí mặc định 0 đồng: hệ thống chạy được khi chưa chốt giá (quyết định cần chốt của nhóm kinh doanh). */
export const ZERO_SCHEDULE: FeeSchedule = { id: 'fee-v0', name: 'Chưa thu phí (0 đồng)', transactionPct: 0, saasMonthly: { supplier: 0, buyer: 0, lender: 0 }, scoringFee: 0, apiMonthlyPerKey: 0, reportFee: 0, referralPctOfFees: 0 }

const r0 = (n: number) => Math.round(n)
export const transactionFee = (s: FeeSchedule, advanceVnd: number) => r0((advanceVnd * s.transactionPct) / 100)
export const referralFee = (s: FeeSchedule, offerFeesVnd: number) => r0((offerFeesVnd * s.referralPctOfFees) / 100)
export const saasFee = (s: FeeSchedule, orgType: 'supplier' | 'buyer' | 'lender') => s.saasMonthly[orgType]
export const monthOf = (iso: string) => iso.slice(0, 7)

/** Kiểm tra biểu phí hợp lệ; trả về danh sách lỗi (rỗng nếu hợp lệ). */
export function validateSchedule(s: Partial<FeeSchedule>): string[] {
  const errs: string[] = []
  const nn = (v: unknown, label: string, max = 1e12) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) errs.push(`${label} phải là số từ 0 đến ${max.toLocaleString('vi-VN')}`)
  }
  nn(s.transactionPct, 'transactionPct', 10)
  nn(s.referralPctOfFees, 'referralPctOfFees', 100)
  nn(s.scoringFee, 'scoringFee')
  nn(s.apiMonthlyPerKey, 'apiMonthlyPerKey')
  nn(s.reportFee, 'reportFee')
  for (const k of ['supplier', 'buyer', 'lender'] as const) nn(s.saasMonthly?.[k], `saasMonthly.${k}`)
  return errs
}
