// Khung chấm điểm ESG cho SME vay vốn FCC — triển khai nguyên văn
// document/Khung chấm điểm ESG cho SMEs vay vốn FCC.md
import type { EsgAssessment, EsgIndicatorResult, EsgIssue, IndustryGroup } from './types'

export interface EsgIndicatorDef {
  code: string
  issue: EsgIssue
  name: string
  evidence: string
  rubric: [string, string, string, string, string]
  criticalFlag: boolean // E5, S1, S2, G1, G2, G4
}

export const ISSUES: Record<EsgIssue, { label: string; pillar: 'E' | 'S' | 'G' }> = {
  E_RES: { label: 'E – Tài nguyên', pillar: 'E' },
  E_ENV: { label: 'E – Môi trường', pillar: 'E' },
  S_LAB: { label: 'S – Lao động', pillar: 'S' },
  S_CUS: { label: 'S – Khách hàng', pillar: 'S' },
  G_TRA: { label: 'G – Minh bạch', pillar: 'G' },
  G_CTL: { label: 'G – Kiểm soát', pillar: 'G' },
}

export const INDICATORS: EsgIndicatorDef[] = [
  { code: 'E1', issue: 'E_RES', name: 'Tiêu thụ điện, nhiên liệu', evidence: 'Hóa đơn năng lượng 12 tháng; sản lượng/doanh thu; chỉ số năng lượng trên đơn vị sản phẩm', rubric: ['Không kiểm soát', 'Ước tính', 'Lưu số liệu đầy đủ', 'Có mục tiêu và hành động tiết kiệm', 'Có kết quả giảm cường độ được xác minh'], criticalFlag: false },
  { code: 'E2', issue: 'E_RES', name: 'Quản lý sử dụng nước', evidence: 'Hóa đơn nước/giấy phép khai thác nếu cần, nhật ký sử dụng, kế hoạch tiết kiệm', rubric: ['Khai thác/xả trái phép', 'Không đo', 'Theo dõi và tuân thủ', 'Đặt mục tiêu giảm/tuần hoàn', 'Chứng minh cải thiện có kiểm tra'], criticalFlag: false },
  { code: 'E3', issue: 'E_RES', name: 'Phát thải và hiệu quả tài nguyên', evidence: 'Kiểm kê nhiên liệu, điện, nguồn phát thải chính, biện pháp thay thế', rubric: ['Sự cố/vi phạm nghiêm trọng', 'Chưa xác định nguồn', 'Liệt kê và theo dõi', 'Có kế hoạch giảm', 'Đo và chứng minh kết quả giảm'], criticalFlag: false },
  { code: 'E4', issue: 'E_ENV', name: 'Chất thải và nước thải', evidence: 'Hợp đồng thu gom, chứng từ chất thải nguy hại nếu phát sinh, báo cáo quan trắc theo yêu cầu', rubric: ['Xả thải trái phép', 'Xử lý không rõ', 'Có chứng từ và tuân thủ', 'Phân loại/giảm thải', 'Đo tỷ lệ giảm/tái chế'], criticalFlag: false },
  { code: 'E5', issue: 'E_ENV', name: 'Giấy phép và tuân thủ môi trường', evidence: 'Giấy phép môi trường/đăng ký theo diện áp dụng, biên bản kiểm tra, hồ sơ khắc phục', rubric: ['Bị xử phạt nghiêm trọng chưa khắc phục', 'Thiếu nghĩa vụ đáng kể', 'Giấy tờ hợp lệ', 'Tự kiểm tra định kỳ', 'Kiểm tra độc lập và cải thiện'], criticalFlag: true },
  { code: 'E6', issue: 'E_ENV', name: 'Rủi ro khí hậu và chuỗi cung ứng vật tư', evidence: 'Đánh giá rủi ro lũ/nắng nóng, nguồn nguyên liệu, kế hoạch gián đoạn hoạt động', rubric: ['Rủi ro rõ ràng không ứng phó', 'Nhận diện sơ bộ', 'Phương án ứng phó cơ bản', 'Kiểm thử/cập nhật định kỳ', 'Có diễn tập và chỉ số hiệu quả'], criticalFlag: false },
  { code: 'S1', issue: 'S_LAB', name: 'Hợp đồng và bảo hiểm lao động', evidence: 'Hợp đồng, hồ sơ tiền lương, BHXH/BHYT theo diện bắt buộc', rubric: ['Vi phạm nghiêm trọng', 'Thiếu diện rộng', 'Tuân thủ cơ bản', 'Kiểm soát và rà soát định kỳ', 'Kiểm toán/hồ sơ tỷ lệ tuân thủ'], criticalFlag: true },
  { code: 'S2', issue: 'S_LAB', name: 'An toàn và sức khỏe nghề nghiệp', evidence: 'Đánh giá nguy cơ, trang bị bảo hộ, huấn luyện, nhật ký tai nạn', rubric: ['Rủi ro nặng không khắc phục', 'Bảo hộ rời rạc', 'Đáp ứng cơ bản', 'Giám sát và phòng ngừa', 'Giảm sự cố có dữ liệu đối chiếu'], criticalFlag: true },
  { code: 'S3', issue: 'S_LAB', name: 'Đào tạo và giữ chân nhân sự', evidence: 'Kế hoạch đào tạo, số giờ đào tạo/người, biến động nhân sự', rubric: ['Không triển khai khi có nhu cầu an toàn bắt buộc', 'Tự phát', 'Đào tạo cơ bản', 'Có kế hoạch và đánh giá', 'Có kết quả năng lực/giữ chân đo được'], criticalFlag: false },
  { code: 'S4', issue: 'S_CUS', name: 'Chất lượng, an toàn sản phẩm', evidence: 'Kiểm soát chất lượng, khiếu nại, thu hồi nếu có, chứng nhận thích hợp', rubric: ['Sản phẩm gây nguy hại chưa xử lý', 'Thiếu kiểm soát', 'Có quy trình cơ bản', 'Kiểm tra/khắc phục có hồ sơ', 'Tỷ lệ lỗi/khiếu nại cải thiện'], criticalFlag: false },
  { code: 'S5', issue: 'S_CUS', name: 'Bảo vệ dữ liệu khách hàng', evidence: 'Chính sách truy cập, bảo mật, sao lưu, nhật ký sự cố, quy định liên quan', rubric: ['Lộ lọt nghiêm trọng chưa xử lý', 'Kiểm soát yếu', 'Biện pháp cơ bản', 'Đào tạo/kiểm thử', 'Theo dõi và cải thiện kiểm chứng'], criticalFlag: false },
  { code: 'S6', issue: 'S_CUS', name: 'Đối xử với khách hàng và nhà cung cấp', evidence: 'Quy trình khiếu nại, hợp đồng, chứng từ thanh toán, chính sách cung ứng', rubric: ['Gian dối/vi phạm trọng yếu', 'Thiếu kênh phản ánh', 'Có quy trình', 'Theo dõi thời hạn giải quyết', 'Có KPI và kết quả cải thiện'], criticalFlag: false },
  { code: 'G1', issue: 'G_TRA', name: 'Minh bạch báo cáo tài chính', evidence: 'BCTC, sổ sách, đối chiếu doanh thu, thuyết minh công nợ', rubric: ['Gian lận', 'Thiếu đáng kể', 'Hồ sơ đầy đủ cơ bản', 'Đối soát định kỳ', 'Có soát xét/kiểm toán phù hợp'], criticalFlag: true },
  { code: 'G2', issue: 'G_TRA', name: 'Thuế và nghĩa vụ công bố', evidence: 'Tờ khai, chứng từ nộp thuế, biên bản kiểm tra, trạng thái nợ thuế', rubric: ['Trốn thuế có căn cứ', 'Chậm/thiếu đáng kể', 'Tuân thủ cơ bản', 'Kiểm tra chéo định kỳ', 'Kiểm soát nội bộ và không sai lệch trọng yếu'], criticalFlag: true },
  { code: 'G3', issue: 'G_TRA', name: 'Sở hữu và giao dịch bên liên quan', evidence: 'Danh sách chủ sở hữu hưởng lợi, giao dịch liên quan, phê duyệt', rubric: ['Che giấu chủ sở hữu/giao dịch gian lận', 'Công bố không đầy đủ', 'Có danh sách cơ bản', 'Phê duyệt và ghi nhận', 'Rà soát độc lập'], criticalFlag: false },
  { code: 'G4', issue: 'G_CTL', name: 'Phòng chống tham nhũng, xung đột lợi ích', evidence: 'Quy tắc ứng xử, đào tạo, kê khai xung đột, kênh tố cáo', rubric: ['Hành vi hối lộ trọng yếu', 'Không quy định', 'Có chính sách', 'Triển khai giám sát', 'Kiểm tra hiệu lực và xử lý minh bạch'], criticalFlag: true },
  { code: 'G5', issue: 'G_CTL', name: 'Phân quyền và quản trị rủi ro', evidence: 'Sơ đồ phê duyệt, hạn mức, quy trình quản trị rủi ro, ghi nhận sự cố', rubric: ['Không có kiểm soát với rủi ro nghiêm trọng', 'Tập trung thiếu đối soát', 'Phân quyền cơ bản', 'Có kiểm tra chéo', 'Kiểm tra định kỳ và kết quả'], criticalFlag: false },
  { code: 'G6', issue: 'G_CTL', name: 'Quản trị khiếu nại và khắc phục sai phạm', evidence: 'Sổ phản ánh nội bộ, hồ sơ khắc phục, trách nhiệm và thời hạn', rubric: ['Che giấu/không khắc phục sai phạm lớn', 'Giải quyết tùy tiện', 'Có đầu mối', 'Theo dõi và đóng việc', 'Thống kê và giảm tái diễn'], criticalFlag: false },
]

export const INDICATOR_BY_CODE = Object.fromEntries(INDICATORS.map((i) => [i.code, i]))

export const INDUSTRY_GROUP_LABEL: Record<IndustryGroup, string> = {
  manufacturing: 'Sản xuất',
  trade: 'Thương mại – dịch vụ',
  agri: 'Nông nghiệp – thực phẩm',
  tech: 'Công nghệ – số',
}

/** Mục 5 của khung: trọng số 6 vấn đề theo 4 nhóm ngành (tổng = 1). */
export const ESG_WEIGHTS: Record<IndustryGroup, Record<EsgIssue, number>> = {
  manufacturing: { E_RES: 0.2, E_ENV: 0.2, S_LAB: 0.15, S_CUS: 0.1, G_TRA: 0.2, G_CTL: 0.15 },
  trade: { E_RES: 0.1, E_ENV: 0.1, S_LAB: 0.15, S_CUS: 0.25, G_TRA: 0.2, G_CTL: 0.2 },
  agri: { E_RES: 0.15, E_ENV: 0.2, S_LAB: 0.15, S_CUS: 0.15, G_TRA: 0.2, G_CTL: 0.15 },
  tech: { E_RES: 0.05, E_ENV: 0.05, S_LAB: 0.15, S_CUS: 0.4, G_TRA: 0.2, G_CTL: 0.15 },
}

export const ESG_OFFICIAL_COVERAGE = 0.8

export type EsgLevel = 'Tốt' | 'Khá' | 'Trung bình' | 'Yếu'
export const ESG_BADGE: Record<EsgLevel, string> = { Tốt: 'Bạch kim', Khá: 'Vàng', 'Trung bình': 'Bạc', Yếu: 'Đồng' }

export function esgLevel(score: number): EsgLevel {
  if (score >= 80) return 'Tốt'
  if (score >= 65) return 'Khá'
  if (score >= 50) return 'Trung bình'
  return 'Yếu'
}

export const ESG_LEVEL_ACTION: Record<EsgLevel, string> = {
  Tốt: 'Theo dõi định kỳ; kiểm tra cờ rủi ro độc lập',
  Khá: 'Lập kế hoạch cải thiện các vấn đề điểm thấp',
  'Trung bình': 'Thẩm định tăng cường và yêu cầu hành động khắc phục',
  Yếu: 'Rà soát chuyên sâu trước khi xem xét sử dụng điểm ESG',
}

export interface EsgIssueResult {
  issue: EsgIssue
  weight: number
  score: number | null // null khi không có chỉ tiêu nào đã xác minh
  min: number
  max: number
  applicable: number
  verified: number
}

export interface EsgResult {
  score: number // điểm điểm-ước-lượng (chuẩn hóa trong nhóm)
  min: number
  max: number
  coverage: number
  official: boolean
  level: EsgLevel
  issues: EsgIssueResult[]
  pillars: { E: number | null; S: number | null; G: number | null }
  flags: { code: string; reason: string }[]
  applicableCount: number
  verifiedCount: number
}

/**
 * Tính điểm ESG theo công thức của khung:
 * P = 25·x ; K = trung bình các chỉ tiêu áp dụng ; ESG = Σ w·K ; Coverage = đã xác minh / áp dụng.
 * Thiếu dữ liệu không thành 0: điểm ước lượng chuẩn hóa trong cùng vấn đề; khoảng [min,max] tính thiếu=0 → thiếu=100.
 */
export function computeEsg(indicators: EsgIndicatorResult[], group: IndustryGroup): EsgResult {
  const weights = ESG_WEIGHTS[group]
  const byCode = Object.fromEntries(indicators.map((r) => [r.code, r]))
  const issues: EsgIssueResult[] = (Object.keys(weights) as EsgIssue[]).map((issue) => {
    const defs = INDICATORS.filter((d) => d.issue === issue)
    const applicable = defs.filter((d) => !byCode[d.code]?.na)
    const levels = applicable.map((d) => byCode[d.code]?.finalLevel)
    const known = levels.filter((l): l is NonNullable<typeof l> => l !== undefined).map((l) => 25 * l)
    const n = applicable.length
    const sumKnown = known.reduce((a, b) => a + b, 0)
    const missing = n - known.length
    return {
      issue,
      weight: weights[issue],
      score: known.length ? sumKnown / known.length : null,
      min: n ? sumKnown / n : 0,
      max: n ? (sumKnown + missing * 100) / n : 0,
      applicable: n,
      verified: known.length,
    }
  })
  let score = 0
  let min = 0
  let max = 0
  for (const r of issues) {
    score += r.weight * (r.score ?? (r.min + r.max) / 2)
    min += r.weight * r.min
    max += r.weight * r.max
  }
  const applicableCount = issues.reduce((a, r) => a + r.applicable, 0)
  const verifiedCount = issues.reduce((a, r) => a + r.verified, 0)
  const coverage = applicableCount ? verifiedCount / applicableCount : 0

  const flags: { code: string; reason: string }[] = []
  for (const d of INDICATORS) {
    const r = byCode[d.code]
    if (!r || r.na) continue
    if (r.redFlag) flags.push({ code: d.code, reason: `${d.code} có dấu hiệu vi phạm trọng yếu — cần thẩm định bất kể Coverage` })
    else if (d.criticalFlag && r.finalLevel === 0) flags.push({ code: d.code, reason: `${d.code} mức 0 (${d.rubric[0]}) — kích hoạt thẩm định tăng cường` })
  }

  const pillar = (p: 'E' | 'S' | 'G') => {
    const rs = issues.filter((r) => ISSUES[r.issue].pillar === p && r.score !== null)
    const w = rs.reduce((a, r) => a + r.weight, 0)
    return w ? rs.reduce((a, r) => a + r.weight * (r.score as number), 0) / w : null
  }

  return {
    score: round2(score),
    min: round2(min),
    max: round2(max),
    coverage,
    official: coverage >= ESG_OFFICIAL_COVERAGE,
    level: esgLevel(score),
    issues,
    pillars: { E: pillar('E'), S: pillar('S'), G: pillar('G') },
    flags,
    applicableCount,
    verifiedCount,
  }
}

export function esgOfficialScore(a: EsgAssessment | undefined): { score: number; level: EsgLevel; coverage: number; flags: number } | null {
  if (!a || a.status !== 'official') return null
  const r = computeEsg(a.indicators, a.industryGroup)
  return { score: r.score, level: r.level, coverage: r.coverage, flags: r.flags.length }
}

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Tham số cấu hình: hệ số phát thải lưới điện (kg CO2/kWh) — phải cập nhật theo công bố chính thức từng năm. */
export const GRID_EMISSION_FACTOR = {
  year: 2023,
  kgPerKwh: 0.6592,
  source: 'Hệ số phát thải lưới điện Việt Nam — công bố của cơ quan quản lý (giá trị tham khảo, cần đối chiếu văn bản hiện hành)',
}
