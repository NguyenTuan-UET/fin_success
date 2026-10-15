// Bộ chấm điểm tín dụng tham khảo FCC — SPEC mục 4.
// Scorecard chuyên gia, xác định (cùng đầu vào → cùng kết quả), có phiên bản.
import type { CreditProfile, FinancialYear, IndustryGroup, ListedSnapshot, Org, Rating, Receivable } from './types'

export const SCORECARD_VERSION = 'supplier-v1.0 · buyer-v1.0 · application-v1.0 (ngưỡng khởi tạo)'

export interface FactorResult {
  code: string
  name: string
  component: string
  raw: string // giá trị đầu vào đã định dạng
  points: number | null // null = thiếu dữ liệu; NA thì na=true
  na?: boolean
  flag?: string
  source: string
  reason: string // reason code ngắn
}

export interface ComponentResult {
  key: string
  label: string
  weight: number
  score: number | null
  min: number
  max: number
}

export interface ScoreResult {
  kind: 'supplier' | 'buyer' | 'application'
  score: number
  min: number
  max: number
  coverage: number
  official: boolean
  rating: Rating
  components: ComponentResult[]
  factors: FactorResult[]
  flags: string[]
  missingMandatory: string[]
  positives: FactorResult[]
  negatives: FactorResult[]
  version: string
}

export const RATING_ORDER: Rating[] = ['CCC', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA']

export function toRating(score: number): Rating {
  if (score >= 90) return 'AAA'
  if (score >= 80) return 'AA'
  if (score >= 70) return 'A'
  if (score >= 60) return 'BBB'
  if (score >= 50) return 'BB'
  if (score >= 40) return 'B'
  return 'CCC'
}

export function ratingAtLeast(r: Rating, min?: Rating) {
  if (!min) return true
  return RATING_ORDER.indexOf(r) >= RATING_ORDER.indexOf(min)
}

const band = (v: number, steps: [number, number][], below: number) => {
  // steps: [ngưỡng >=, điểm] theo thứ tự giảm dần
  for (const [t, p] of steps) if (v >= t) return p
  return below
}

const pct = (n: number) => `${(n * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
const x = (n: number) => `${n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lần`

/** Bảng rủi ro ngành nội bộ (cấu hình, theo VSIC cấp 2). Giá trị khởi tạo, cần hiệu chỉnh với dữ liệu thật. */
export const INDUSTRY_RISK: Record<string, { label: string; risk: 'low' | 'medium' | 'high' }> = {
  '41': { label: 'Xây dựng nhà các loại', risk: 'high' },
  '42': { label: 'Xây dựng công trình kỹ thuật dân dụng', risk: 'high' },
  '24': { label: 'Sản xuất kim loại', risk: 'medium' },
  '25': { label: 'Sản xuất sản phẩm từ kim loại đúc sẵn', risk: 'medium' },
  '17': { label: 'Sản xuất giấy và sản phẩm từ giấy', risk: 'medium' },
  '13': { label: 'Dệt', risk: 'medium' },
  '14': { label: 'Sản xuất trang phục', risk: 'medium' },
  '10': { label: 'Sản xuất chế biến thực phẩm', risk: 'low' },
  '22': { label: 'Sản xuất sản phẩm từ cao su và plastic', risk: 'medium' },
  '46': { label: 'Bán buôn', risk: 'medium' },
  '49': { label: 'Vận tải đường bộ', risk: 'medium' },
  '62': { label: 'Lập trình máy vi tính', risk: 'low' },
  '23': { label: 'Sản xuất sản phẩm từ khoáng phi kim loại', risk: 'medium' },
}

/** Trung vị biên lợi nhuận ròng theo nhóm ngành (giá trị khởi tạo, cần hiệu chỉnh). */
const INDUSTRY_MARGIN: Record<IndustryGroup, number> = { manufacturing: 0.045, trade: 0.025, agri: 0.04, tech: 0.08 }

function lastTwo(f: FinancialYear[]) {
  const s = [...f].sort((a, b) => b.year - a.year)
  return { cur: s[0] as FinancialYear | undefined, prev: s[1] as FinancialYear | undefined }
}

interface Comp {
  key: string
  label: string
  weight: number
}

function aggregate(kind: ScoreResult['kind'], comps: Comp[], factors: FactorResult[], mandatory: { label: string; ok: boolean }[], officialCoverage: number): ScoreResult {
  const components: ComponentResult[] = comps.map((c) => {
    const fs = factors.filter((f) => f.component === c.key && !f.na)
    const known = fs.filter((f) => f.points !== null).map((f) => f.points as number)
    const n = fs.length
    const sum = known.reduce((a, b) => a + b, 0)
    return {
      key: c.key,
      label: c.label,
      weight: c.weight,
      score: known.length ? sum / known.length : null,
      min: n ? sum / n : 0,
      max: n ? (sum + (n - known.length) * 100) / n : 100,
    }
  })
  let score = 0
  let min = 0
  let max = 0
  let covW = 0
  let appW = 0
  for (const c of components) {
    // thành phần thiếu toàn bộ: lấy điểm giữa khoảng và buộc trạng thái tạm tính (không chuyển trọng số sang thành phần khác)
    score += c.weight * (c.score ?? (c.min + c.max) / 2)
    min += c.weight * c.min
    max += c.weight * c.max
    const fs = factors.filter((f) => f.component === c.key && !f.na)
    if (fs.length) {
      const per = c.weight / fs.length
      appW += c.weight
      covW += per * fs.filter((f) => f.points !== null).length
    }
  }
  const coverage = appW ? covW / appW : 0
  const missingMandatory = mandatory.filter((m) => !m.ok).map((m) => m.label)
  const flags = factors.filter((f) => f.flag).map((f) => f.flag as string)
  const scored = factors.filter((f) => f.points !== null && !f.na)
  const official = coverage >= officialCoverage && missingMandatory.length === 0 && components.every((c) => c.score !== null)
  return {
    kind,
    score: Math.round(score * 10) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    coverage,
    official,
    rating: toRating(score),
    components,
    factors,
    flags,
    missingMandatory,
    positives: [...scored].sort((a, b) => (b.points as number) - (a.points as number)).filter((f) => (f.points as number) >= 70).slice(0, 3),
    negatives: [...scored].sort((a, b) => (a.points as number) - (b.points as number)).filter((f) => (f.points as number) < 60).slice(0, 3),
    version: SCORECARD_VERSION,
  }
}

// ======================= BÊN BÁN (SME) =======================

export interface SupplierContext {
  org: Org
  profile: CreditProfile
  confirmedArShare?: number // tỷ lệ phải thu đã được bên mua xác nhận (0..1)
  avgBuyerScore?: number // điểm bình quân bên mua
  topCustomerRating?: Rating
  fccBehavior?: { disputes: number; returned: number; total: number }
  esgE6Level?: number
  legalEventsFromCrawl?: 'none' | 'minor_resolved' | 'major'
  taxStatusFromCrawl?: CreditProfile['taxStatus']
}

export function scoreSupplier(ctx: SupplierContext, now = new Date()): ScoreResult {
  const { org, profile: p } = ctx
  const { cur, prev } = lastTwo(p.financials)
  const F: FactorResult[] = []
  const add = (f: FactorResult) => F.push(f)

  // ---- Character 20% ----
  if (p.cic) {
    const c = p.cic
    const pts = c.worstDebtGroup >= 3 ? 0 : c.worstDebtGroup === 2 ? 40 : c.maxLateDays > 0 ? 70 : 100
    add({ code: 'C1', name: 'Lịch sử tín dụng (CIC)', component: 'character', raw: `Nhóm nợ cao nhất ${c.worstDebtGroup}, quá hạn tối đa ${c.maxLateDays} ngày / ${c.months} tháng`, points: pts, flag: c.worstDebtGroup >= 3 ? `Nợ nhóm ${c.worstDebtGroup} trong ${c.months} tháng` : undefined, source: c.source, reason: pts >= 100 ? 'Không có nợ quá hạn' : 'Có lịch sử quá hạn' })
  } else add({ code: 'C1', name: 'Lịch sử tín dụng (CIC)', component: 'character', raw: 'Chưa có báo cáo CIC', points: null, source: '—', reason: 'Thiếu báo cáo CIC — doanh nghiệp có thể tự tra cứu và tải lên' })

  const tax = ctx.taxStatusFromCrawl ?? p.taxStatus
  if (tax) {
    const pts = tax === 'active' ? 100 : tax === 'deferred' ? 50 : 0
    add({ code: 'C2', name: 'Tuân thủ thuế', component: 'character', raw: { active: 'MST đang hoạt động, không nợ đọng', deferred: 'Nợ thuế trong hạn gia hạn', enforced: 'Bị cưỡng chế thuế', ceased: 'MST ngừng hoạt động' }[tax], points: pts, flag: pts === 0 ? 'Trạng thái thuế bất lợi (cưỡng chế/ngừng hoạt động)' : undefined, source: 'Tra cứu người nộp thuế (nguồn công khai – tham khảo)', reason: pts === 100 ? 'Tuân thủ thuế tốt' : 'Vướng nghĩa vụ thuế' })
  } else add({ code: 'C2', name: 'Tuân thủ thuế', component: 'character', raw: 'Chưa tra cứu', points: null, source: '—', reason: 'Thiếu trạng thái thuế' })

  const age = now.getFullYear() - org.foundedYear
  add({ code: 'C3', name: 'Thời gian hoạt động', component: 'character', raw: `${age} năm (thành lập ${org.foundedYear})`, points: band(age, [[5, 100], [3, 70], [1, 40]], 10), source: 'Đăng ký doanh nghiệp', reason: age >= 5 ? 'Hoạt động lâu năm' : 'Doanh nghiệp còn non trẻ' })

  const legal = ctx.legalEventsFromCrawl ?? p.legalEvents
  if (legal) add({ code: 'C4', name: 'Sự kiện pháp lý, xử phạt', component: 'character', raw: { none: 'Không ghi nhận', minor_resolved: 'Vi phạm nhỏ đã khắc phục', major: 'Tranh chấp/vi phạm trọng yếu' }[legal], points: legal === 'none' ? 100 : legal === 'minor_resolved' ? 60 : 0, flag: legal === 'major' ? 'Sự kiện pháp lý trọng yếu' : undefined, source: 'Nguồn công khai (crawl) – tham khảo', reason: legal === 'none' ? 'Không có sự kiện pháp lý' : 'Có sự kiện pháp lý' })
  else add({ code: 'C4', name: 'Sự kiện pháp lý, xử phạt', component: 'character', raw: 'Chưa tra cứu', points: null, source: '—', reason: 'Thiếu dữ liệu pháp lý' })

  const b = ctx.fccBehavior
  if (b && b.total > 0) {
    const bad = (b.disputes + b.returned) / b.total
    add({ code: 'C5', name: 'Hành vi trên FCC', component: 'character', raw: `${b.disputes} tranh chấp, ${b.returned} hồ sơ bị trả / ${b.total} hồ sơ`, points: band(1 - bad, [[0.95, 100], [0.85, 70], [0.7, 40]], 10), source: 'FCC', reason: bad < 0.05 ? 'Hồ sơ sạch trên FCC' : 'Có tranh chấp/hồ sơ bị trả' })
  } else add({ code: 'C5', name: 'Hành vi trên FCC', component: 'character', raw: 'Chưa có lịch sử', points: null, na: true, source: 'FCC', reason: 'Chưa có lịch sử (không phạt)' })

  // ---- Capacity 35% ----
  if (cur && cur.debtService > 0) {
    const dscr = (cur.ebit + cur.depreciation) / cur.debtService
    add({ code: 'P1', name: 'DSCR', component: 'capacity', raw: x(dscr), points: band(dscr, [[1.5, 100], [1.3, 75], [1.0, 40]], 0), source: cur.source, reason: dscr >= 1.3 ? 'DSCR đạt ngưỡng ≥ 1,3' : `DSCR ${x(dscr)} dưới ngưỡng 1,3` })
  } else add({ code: 'P1', name: 'DSCR', component: 'capacity', raw: cur ? 'Không có nghĩa vụ nợ' : 'Thiếu BCTC', points: cur ? 100 : null, source: cur?.source ?? '—', reason: cur ? 'Không có nghĩa vụ trả nợ' : 'Thiếu BCTC để tính DSCR' })

  if (cur) {
    const ys = [cur, prev].filter(Boolean) as FinancialYear[]
    const positive = ys.filter((y) => y.operatingCashFlow > 0).length
    add({ code: 'P2', name: 'Dòng tiền HĐKD', component: 'capacity', raw: ys.map((y) => `${y.year}: ${fmtB(y.operatingCashFlow)}`).join(' · '), points: positive === ys.length ? 100 : positive > 0 ? 50 : 0, source: cur.source, reason: positive === ys.length ? 'Dòng tiền HĐKD dương' : 'Dòng tiền HĐKD âm' })
  } else add({ code: 'P2', name: 'Dòng tiền HĐKD', component: 'capacity', raw: 'Thiếu BCTC', points: null, source: '—', reason: 'Thiếu LCTT' })

  if (cur && prev) {
    const g = (cur.revenue - prev.revenue) / prev.revenue
    add({ code: 'P3', name: 'Tăng trưởng doanh thu', component: 'capacity', raw: pct(g), points: band(g, [[0.1, 100], [0, 70], [-0.1, 40]], 10), source: cur.source, reason: g >= 0 ? 'Doanh thu tăng trưởng' : 'Doanh thu suy giảm' })
  } else add({ code: 'P3', name: 'Tăng trưởng doanh thu', component: 'capacity', raw: 'Cần BCTC 2 năm', points: null, source: '—', reason: 'Thiếu BCTC năm trước' })

  if (cur) {
    const m = cur.netProfit / cur.revenue
    const med = INDUSTRY_MARGIN[org.industryGroup]
    const pts = m < 0 ? 0 : m >= med * 1.15 ? 100 : m >= med * 0.85 ? 60 : 30
    add({ code: 'P4', name: 'Biên lợi nhuận ròng', component: 'capacity', raw: `${pct(m)} (trung vị ngành ${pct(med)})`, points: pts, source: cur.source, reason: pts >= 60 ? 'Biên lợi nhuận ngang/hơn ngành' : 'Biên lợi nhuận thấp hơn ngành' })
  } else add({ code: 'P4', name: 'Biên lợi nhuận ròng', component: 'capacity', raw: 'Thiếu BCTC', points: null, source: '—', reason: 'Thiếu KQKD' })

  if (p.dsoDays !== undefined && p.contractTermDays !== undefined) {
    const over = p.dsoDays - p.contractTermDays
    add({ code: 'P5', name: 'Kỳ thu tiền bình quân (DSO)', component: 'capacity', raw: `${p.dsoDays} ngày (kỳ hạn HĐ ${p.contractTermDays} ngày)`, points: over <= 15 ? 100 : over <= 45 ? 60 : 20, source: 'Dữ liệu kế toán', reason: over <= 15 ? 'Thu tiền đúng hạn' : 'Thu tiền chậm hơn kỳ hạn hợp đồng' })
  } else add({ code: 'P5', name: 'Kỳ thu tiền bình quân (DSO)', component: 'capacity', raw: 'Chưa kết nối kế toán', points: null, source: '—', reason: 'Thiếu dữ liệu công nợ' })

  if (cur && p.einvoiceRevenue !== undefined) {
    const vals = [cur.revenue, p.einvoiceRevenue, p.vatDeclaredRevenue].filter((v): v is number => v !== undefined)
    const dev = (Math.max(...vals) - Math.min(...vals)) / Math.max(...vals)
    add({ code: 'P6', name: 'Đối chiếu doanh thu (HĐĐT ↔ BCTC ↔ tờ khai)', component: 'capacity', raw: `Lệch ${pct(dev)}`, points: dev <= 0.1 ? 100 : dev <= 0.25 ? 50 : 0, flag: dev > 0.25 ? `Doanh thu lệch ${pct(dev)} giữa các nguồn — dấu hiệu bất thường` : undefined, source: 'Hóa đơn điện tử, BCTC, tờ khai GTGT', reason: dev <= 0.1 ? 'Doanh thu khớp giữa các nguồn' : 'Doanh thu lệch giữa các nguồn' })
  } else add({ code: 'P6', name: 'Đối chiếu doanh thu', component: 'capacity', raw: 'Thiếu dữ liệu hóa đơn điện tử', points: null, source: '—', reason: 'Chưa đối chiếu được doanh thu' })

  // ---- Capital 15% ----
  if (cur) {
    const de = cur.totalLiabilities / cur.equity
    add({ code: 'K1', name: 'Nợ phải trả / VCSH', component: 'capital', raw: x(de), points: cur.equity <= 0 ? 0 : de <= 1 ? 100 : de <= 3 ? 70 : de <= 5 ? 30 : 0, flag: cur.equity <= 0 ? 'Vốn chủ sở hữu âm' : undefined, source: cur.source, reason: de <= 3 ? 'Đòn bẩy trong ngưỡng ≤ 3' : 'Đòn bẩy cao' })
    const cr = cur.currentAssets / cur.currentLiabilities
    add({ code: 'K2', name: 'Hệ số thanh toán hiện hành', component: 'capital', raw: x(cr), points: band(cr, [[1.5, 100], [1.2, 70], [1.0, 40]], 10), source: cur.source, reason: cr >= 1.2 ? 'Thanh khoản tốt' : 'Thanh khoản yếu' })
  } else {
    add({ code: 'K1', name: 'Nợ phải trả / VCSH', component: 'capital', raw: 'Thiếu BCTC', points: null, source: '—', reason: 'Thiếu CĐKT' })
    add({ code: 'K2', name: 'Hệ số thanh toán hiện hành', component: 'capital', raw: 'Thiếu BCTC', points: null, source: '—', reason: 'Thiếu CĐKT' })
  }
  if (p.capitalNeed && p.ownContribution !== undefined) {
    const r = p.ownContribution / p.capitalNeed
    const agriOk = org.industryGroup === 'agri' && r >= 0.1
    add({ code: 'K3', name: 'Vốn tự có tham gia', component: 'capital', raw: pct(r), points: r >= 0.3 ? 100 : r >= 0.15 || agriOk ? 60 : 20, source: 'Phương án kinh doanh (tự khai)', reason: r >= 0.15 ? 'Vốn tự có đủ tỷ lệ tham gia' : 'Vốn tự có thấp' })
  } else add({ code: 'K3', name: 'Vốn tự có tham gia', component: 'capital', raw: 'Chưa khai phương án', points: null, na: true, source: '—', reason: 'Không áp dụng cho tài trợ khoản phải thu' })

  // ---- Collateral & credit support 15% ----
  if (ctx.confirmedArShare !== undefined && ctx.avgBuyerScore !== undefined) {
    const v = ctx.confirmedArShare * ctx.avgBuyerScore
    add({ code: 'B1', name: 'Chất lượng danh mục phải thu', component: 'collateral', raw: `${pct(ctx.confirmedArShare)} đã xác nhận × điểm bên mua ${ctx.avgBuyerScore.toFixed(0)}`, points: Math.round(v), source: 'FCC', reason: v >= 60 ? 'Khoản phải thu chất lượng, bên mua uy tín' : 'Khoản phải thu chưa được xác nhận nhiều' })
  } else add({ code: 'B1', name: 'Chất lượng danh mục phải thu', component: 'collateral', raw: 'Chưa có khoản phải thu', points: null, source: 'FCC', reason: 'Chưa có khoản phải thu trên FCC' })

  if (p.collateral.length && p.capitalNeed) {
    const LTV = { realestate: 0.7, machinery: 0.5, inventory: 0.4 }
    const covered = p.collateral.reduce((a, c) => a + c.declaredValue * LTV[c.kind], 0)
    const ratio = covered / p.capitalNeed
    add({ code: 'B2', name: 'Tài sản bảo đảm khai báo', component: 'collateral', raw: `Độ phủ ${pct(ratio)} (sau tỷ lệ tham chiếu BĐS 70%, máy 50%, tồn kho 40%)`, points: ratio >= 1 ? 100 : ratio >= 0.5 ? 60 : 30, source: 'Doanh nghiệp khai báo — không phải định giá', reason: ratio >= 0.5 ? 'Có tài sản bảo đảm bổ sung' : 'Tài sản bảo đảm thấp' })
  } else add({ code: 'B2', name: 'Tài sản bảo đảm khai báo', component: 'collateral', raw: 'Không khai báo', points: null, na: true, source: '—', reason: 'Không có TSBĐ (không bắt buộc với SCF)' })

  if (p.frameworkContractMonths !== undefined) {
    const m = p.frameworkContractMonths
    add({ code: 'B3', name: 'Hợp đồng khung với bên mua lớn', component: 'collateral', raw: m > 0 ? `Còn hiệu lực ${m} tháng` : 'Không có', points: m >= 12 ? 100 : m > 0 ? 60 : 30, source: 'Hợp đồng tải lên', reason: m >= 12 ? 'Quan hệ dài hạn với bên mua' : 'Quan hệ mua bán ngắn hạn' })
  } else add({ code: 'B3', name: 'Hợp đồng khung', component: 'collateral', raw: 'Chưa tải hợp đồng', points: null, source: '—', reason: 'Thiếu hợp đồng khung' })

  // ---- Conditions 15% ----
  const ir = INDUSTRY_RISK[org.vsic.slice(0, 2)]
  if (ir) add({ code: 'D1', name: 'Rủi ro ngành', component: 'conditions', raw: `${ir.label} — rủi ro ${{ low: 'thấp', medium: 'trung bình', high: 'cao' }[ir.risk]}`, points: { low: 100, medium: 60, high: 30 }[ir.risk], source: 'Bảng xếp hạng ngành nội bộ (VSIC)', reason: ir.risk === 'high' ? 'Ngành chu kỳ thanh toán dài, rủi ro cao' : 'Rủi ro ngành chấp nhận được' })
  else add({ code: 'D1', name: 'Rủi ro ngành', component: 'conditions', raw: `VSIC ${org.vsic} chưa có trong bảng`, points: null, source: '—', reason: 'Chưa xếp hạng ngành' })

  if (p.topCustomerShare !== undefined) {
    const s = p.topCustomerShare
    let pts = s < 0.4 ? 100 : s <= 0.7 ? 60 : 30
    if (ctx.topCustomerRating && ratingAtLeast(ctx.topCustomerRating, 'A')) pts = Math.min(100, pts + 20)
    add({ code: 'D2', name: 'Tập trung khách hàng', component: 'conditions', raw: `Bên mua lớn nhất chiếm ${pct(s)}${ctx.topCustomerRating ? ` (xếp hạng ${ctx.topCustomerRating})` : ''}`, points: pts, source: 'Dữ liệu kế toán/hóa đơn', reason: s < 0.4 ? 'Khách hàng đa dạng' : 'Phụ thuộc một bên mua' })
  } else add({ code: 'D2', name: 'Tập trung khách hàng', component: 'conditions', raw: 'Chưa có dữ liệu', points: null, source: '—', reason: 'Thiếu cơ cấu doanh thu theo khách hàng' })

  if (ctx.esgE6Level !== undefined) add({ code: 'D3', name: 'Rủi ro khí hậu/địa điểm (ESG E6)', component: 'conditions', raw: `Mức E6 = ${ctx.esgE6Level}`, points: ctx.esgE6Level * 25, source: 'Đánh giá ESG', reason: ctx.esgE6Level >= 2 ? 'Có phương án ứng phó rủi ro khí hậu' : 'Chưa ứng phó rủi ro khí hậu' })
  else add({ code: 'D3', name: 'Rủi ro khí hậu/địa điểm (ESG E6)', component: 'conditions', raw: 'Chưa đánh giá ESG', points: null, source: '—', reason: 'Thiếu đánh giá ESG E6' })

  const has = (c: string) => F.some((f) => f.code === c && f.points !== null)
  return aggregate(
    'supplier',
    [
      { key: 'character', label: 'Character – Uy tín', weight: 0.2 },
      { key: 'capacity', label: 'Capacity – Năng lực trả nợ', weight: 0.35 },
      { key: 'capital', label: 'Capital – Vốn', weight: 0.15 },
      { key: 'collateral', label: 'Collateral – Bảo đảm & hỗ trợ', weight: 0.15 },
      { key: 'conditions', label: 'Conditions – Ngành & thị trường', weight: 0.15 },
    ],
    F,
    [
      { label: 'DSCR hoặc dòng tiền HĐKD', ok: has('P1') || has('P2') },
      { label: 'Nợ phải trả/VCSH', ok: has('K1') },
      { label: 'Báo cáo CIC hoặc trạng thái thuế', ok: has('C1') || has('C2') },
    ],
    0.75,
  )
}

// ======================= BÊN MUA (ANCHOR) =======================

export interface BuyerContext {
  org: Org
  profile?: CreditProfile
  listed?: ListedSnapshot
  payment?: { total: number; onTime: number; avgLateDays: number; disputes: number }
}

export function scoreBuyer(ctx: BuyerContext): ScoreResult {
  const F: FactorResult[] = []
  const add = (f: FactorResult) => F.push(f)
  const { cur, prev } = lastTwo(ctx.profile?.financials ?? [])
  const src = ctx.listed ? `${ctx.listed.provider} · ${ctx.listed.symbol}` : (cur?.source ?? '—')

  if (cur) {
    add({ code: 'F1', name: 'Quy mô doanh thu', component: 'fin', raw: fmtB(cur.revenue), points: band(cur.revenue, [[10e12, 100], [2e12, 85], [5e11, 70], [1e11, 50]], 30), source: src, reason: 'Quy mô doanh nghiệp' })
    const de = cur.totalLiabilities / cur.equity
    add({ code: 'F2', name: 'Nợ phải trả / VCSH', component: 'fin', raw: x(de), points: de <= 1 ? 100 : de <= 2 ? 75 : de <= 3 ? 50 : 20, source: src, reason: de <= 2 ? 'Đòn bẩy hợp lý' : 'Đòn bẩy cao' })
    const cr = cur.currentAssets / cur.currentLiabilities
    add({ code: 'F3', name: 'Hệ số thanh toán hiện hành', component: 'fin', raw: x(cr), points: band(cr, [[1.5, 100], [1.2, 75], [1.0, 50]], 20), source: src, reason: cr >= 1.2 ? 'Thanh khoản tốt' : 'Thanh khoản yếu' })
    const icr = cur.interestExpense > 0 ? cur.ebit / cur.interestExpense : 99
    add({ code: 'F4', name: 'Khả năng trả lãi (EBIT/lãi vay)', component: 'fin', raw: icr >= 99 ? 'Không có lãi vay' : x(icr), points: band(icr, [[5, 100], [3, 75], [1.5, 50]], 10), source: src, reason: icr >= 3 ? 'Khả năng trả lãi tốt' : 'Áp lực lãi vay' })
    const roa = cur.netProfit / cur.totalAssets
    add({ code: 'F5', name: 'ROA', component: 'fin', raw: pct(roa), points: roa < 0 ? 0 : band(roa, [[0.08, 100], [0.04, 75], [0.01, 50]], 30), source: src, reason: roa > 0.04 ? 'Sinh lời tốt' : 'Sinh lời thấp' })
    add({ code: 'F6', name: 'Dòng tiền HĐKD', component: 'fin', raw: fmtB(cur.operatingCashFlow), points: cur.operatingCashFlow > 0 ? 100 : 20, source: src, reason: cur.operatingCashFlow > 0 ? 'Dòng tiền HĐKD dương' : 'Dòng tiền HĐKD âm' })
    if (prev) {
      const g = (cur.revenue - prev.revenue) / prev.revenue
      add({ code: 'F7', name: 'Xu hướng doanh thu', component: 'fin', raw: pct(g), points: band(g, [[0.05, 100], [-0.05, 70], [-0.15, 40]], 10), source: src, reason: g >= -0.05 ? 'Doanh thu ổn định/tăng' : 'Doanh thu giảm mạnh' })
    }
  } else add({ code: 'F1', name: 'BCTC', component: 'fin', raw: 'Thiếu BCTC', points: null, source: '—', reason: 'Thiếu BCTC bên mua' })

  if (ctx.listed) {
    const L = ctx.listed
    const ao = { unqualified: 100, qualified: 30, adverse: 0, disclaimer: 0 }[L.auditOpinion]
    add({ code: 'M1', name: 'Ý kiến kiểm toán', component: 'market', raw: { unqualified: 'Chấp nhận toàn phần', qualified: 'Ngoại trừ', adverse: 'Trái ngược', disclaimer: 'Từ chối' }[L.auditOpinion], points: ao, flag: ao < 100 ? 'Ý kiến kiểm toán không phải chấp nhận toàn phần' : undefined, source: src, reason: ao === 100 ? 'BCTC kiểm toán chấp nhận toàn phần' : 'Kiểm toán có ý kiến ngoại trừ' })
    const ts = { normal: 100, warning: 30, controlled: 10, restricted: 0 }[L.tradingStatus]
    add({ code: 'M2', name: 'Diện cảnh báo/kiểm soát', component: 'market', raw: { normal: 'Bình thường', warning: 'Bị cảnh báo', controlled: 'Bị kiểm soát', restricted: 'Hạn chế giao dịch' }[L.tradingStatus], points: ts, flag: ts < 100 ? 'Cổ phiếu thuộc diện cảnh báo/kiểm soát' : undefined, source: src, reason: ts === 100 ? 'Không thuộc diện cảnh báo' : 'Thuộc diện cảnh báo' })
    add({ code: 'M3', name: 'Biến động giá 90 ngày (năm hóa)', component: 'market', raw: pct(L.volatility90d), points: band(-L.volatility90d, [[-0.25, 100], [-0.4, 70], [-0.6, 40]], 20), source: src, reason: L.volatility90d <= 0.4 ? 'Biến động giá vừa phải' : 'Biến động giá cao' })
  }

  if (ctx.payment && ctx.payment.total > 0) {
    const pmt = ctx.payment
    const r = pmt.onTime / pmt.total
    add({ code: 'H1', name: 'Tỷ lệ thanh toán đúng hạn', component: 'pay', raw: `${pct(r)} (${pmt.onTime}/${pmt.total} khoản)`, points: band(r, [[0.95, 100], [0.85, 75], [0.7, 45]], 15), source: 'FCC', reason: r >= 0.85 ? 'Thanh toán đúng hạn' : 'Thường thanh toán trễ' })
    add({ code: 'H2', name: 'Số ngày trễ bình quân (DBT)', component: 'pay', raw: `${pmt.avgLateDays.toFixed(0)} ngày`, points: band(-pmt.avgLateDays, [[-5, 100], [-15, 70], [-30, 40]], 10), source: 'FCC', reason: pmt.avgLateDays <= 15 ? 'Trễ hạn ít' : 'Trễ hạn nhiều' })
    add({ code: 'H3', name: 'Tỷ lệ tranh chấp', component: 'pay', raw: pct(pmt.disputes / pmt.total), points: band(-(pmt.disputes / pmt.total), [[-0.02, 100], [-0.05, 70], [-0.1, 40]], 10), source: 'FCC', reason: 'Tranh chấp hóa đơn' })
  } else add({ code: 'H1', name: 'Hành vi thanh toán', component: 'pay', raw: 'Chưa có lịch sử', points: null, na: true, source: 'FCC', reason: 'Chưa có lịch sử (không phạt)' })

  const comps = [
    { key: 'fin', label: 'Tài chính', weight: ctx.listed ? 0.6 : 0.75 },
    ...(ctx.listed ? [{ key: 'market', label: 'Thị trường & công bố', weight: 0.15 }] : []),
    { key: 'pay', label: 'Hành vi thanh toán', weight: 0.25 },
  ]
  // nếu chưa có lịch sử thanh toán: chuẩn hóa trong phạm vi thành phần áp dụng (pay là N/A toàn phần)
  const payNA = F.filter((f) => f.component === 'pay').every((f) => f.na)
  const used = payNA ? comps.filter((c) => c.key !== 'pay').map((c, _i, arr) => ({ ...c, weight: c.weight / arr.reduce((a, b) => a + b.weight, 0) })) : comps
  return aggregate('buyer', used, F, [{ label: 'BCTC bên mua', ok: !!cur }], 0.75)
}

// ======================= HỒ SƠ TÀI TRỢ =======================

export interface ApplicationContext {
  receivable: Receivable
  buyerScore: ScoreResult
  supplierScore: ScoreResult
  pairHistory?: { total: number; onTime: number }
  concentration?: number // tỷ trọng khoản phải thu vào bên mua này trong tổng phải thu
  now?: Date
}

export const APPLICATION_WEIGHTS = { buyer: 0.45, supplier: 0.3, transaction: 0.25 }

export function scoreApplication(ctx: ApplicationContext): ScoreResult & { eligible: boolean; segment: 'i' | 'ii' | 'iii'; transactionScore: number } {
  const r = ctx.receivable
  const now = ctx.now ?? new Date()
  const T: FactorResult[] = []
  const docs = [r.docs.xml, r.docs.contract, r.docs.delivery].filter(Boolean).length
  T.push({ code: 'T1', name: 'Chứng từ đã xác minh', component: 'tx', raw: `${r.docs.xml ? 'XML ✓' : 'XML ✗'} · ${r.docs.contract ? 'Hợp đồng ✓' : 'Hợp đồng ✗'} · ${r.docs.delivery ? 'Biên bản giao nhận ✓' : 'Biên bản ✗'}`, points: [20, 50, 75, 100][docs], source: 'FCC', reason: docs === 3 ? 'Bộ chứng từ đầy đủ' : 'Thiếu chứng từ' })
  if (ctx.pairHistory && ctx.pairHistory.total > 0) {
    const rr = ctx.pairHistory.onTime / ctx.pairHistory.total
    T.push({ code: 'T2', name: 'Lịch sử thanh toán cặp mua–bán', component: 'tx', raw: `${ctx.pairHistory.onTime}/${ctx.pairHistory.total} đúng hạn`, points: band(rr, [[0.95, 100], [0.8, 70], [0.6, 40]], 10), source: 'FCC', reason: rr >= 0.8 ? 'Cặp mua–bán thanh toán tốt' : 'Cặp mua–bán hay trễ' })
  } else T.push({ code: 'T2', name: 'Lịch sử cặp mua–bán', component: 'tx', raw: 'Giao dịch đầu tiên', points: null, na: true, source: 'FCC', reason: 'Chưa có lịch sử' })
  const days = Math.round((new Date(r.dueDate).getTime() - now.getTime()) / 86_400_000)
  T.push({ code: 'T3', name: 'Kỳ hạn còn lại', component: 'tx', raw: `${days} ngày`, points: days <= 0 ? 0 : days <= 90 ? 100 : days <= 120 ? 70 : days <= 180 ? 40 : 20, source: 'Hóa đơn', reason: days <= 90 ? 'Kỳ hạn ngắn' : 'Kỳ hạn dài' })
  const dil = r.dilution ?? 0
  T.push({ code: 'T4', name: 'Tỷ lệ pha loãng', component: 'tx', raw: pct(dil), points: band(-dil, [[-0.02, 100], [-0.05, 70], [-0.1, 40]], 10), source: 'FCC/kế toán', reason: dil <= 0.02 ? 'Ít điều chỉnh giảm/trả hàng' : 'Pha loãng cao' })
  if (ctx.concentration !== undefined) T.push({ code: 'T5', name: 'Tập trung vào bên mua', component: 'tx', raw: pct(ctx.concentration), points: ctx.concentration < 0.4 ? 100 : ctx.concentration <= 0.7 ? 60 : 30, source: 'FCC', reason: 'Mức tập trung khoản phải thu' })

  const tx = aggregate('application', [{ key: 'tx', label: 'Giao dịch', weight: 1 }], T, [], 0)
  const W = APPLICATION_WEIGHTS
  const score = W.buyer * ctx.buyerScore.score + W.supplier * ctx.supplierScore.score + W.transaction * tx.score
  const min = W.buyer * ctx.buyerScore.min + W.supplier * ctx.supplierScore.min + W.transaction * tx.min
  const max = W.buyer * ctx.buyerScore.max + W.supplier * ctx.supplierScore.max + W.transaction * tx.max
  const eligible = ['BUYER_CONFIRMED', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'FUNDED'].includes(r.state)
  const hasCollateral = ctx.supplierScore.factors.some((f) => f.code === 'B2' && !f.na && (f.points ?? 0) >= 60)
  const strong = score >= 60 && ctx.buyerScore.score >= 65
  const segment: 'i' | 'ii' | 'iii' = hasCollateral && strong ? 'i' : strong ? 'ii' : 'iii'
  const flags = [...ctx.buyerScore.flags.map((f) => `Bên mua: ${f}`), ...ctx.supplierScore.flags.map((f) => `Bên bán: ${f}`), ...tx.flags]
  const components: ComponentResult[] = [
    { key: 'buyer', label: 'Bên mua', weight: W.buyer, score: ctx.buyerScore.score, min: ctx.buyerScore.min, max: ctx.buyerScore.max },
    { key: 'supplier', label: 'Bên bán', weight: W.supplier, score: ctx.supplierScore.score, min: ctx.supplierScore.min, max: ctx.supplierScore.max },
    { key: 'tx', label: 'Chất lượng giao dịch', weight: W.transaction, score: tx.score, min: tx.min, max: tx.max },
  ]
  return {
    ...tx,
    kind: 'application',
    score: Math.round(score * 10) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    rating: toRating(score),
    components,
    official: ctx.buyerScore.official && ctx.supplierScore.official && eligible,
    coverage: (ctx.buyerScore.coverage * W.buyer + ctx.supplierScore.coverage * W.supplier + tx.coverage * W.transaction),
    flags,
    eligible,
    segment,
    transactionScore: tx.score,
  }
}

export const SEGMENT_LABEL = {
  i: '(i) Có TSBĐ và khoản phải thu tốt',
  ii: '(ii) Không cần TSBĐ — khoản phải thu chất lượng, bên mua uy tín',
  iii: '(iii) Khoản phải thu yếu / điểm thấp — cần thẩm định tăng cường',
}

/** Phát hiện bất thường theo quy tắc (SPEC 4.5.2) — chỉ là cờ để người xem xét. */
export function detectAnomalies(receivables: Receivable[], sellerId: string): string[] {
  const out: string[] = []
  const mine = receivables.filter((r) => r.sellerId === sellerId)
  const seen = new Map<string, number>()
  for (const r of mine) seen.set(r.fingerprint, (seen.get(r.fingerprint) ?? 0) + 1)
  for (const [, n] of seen) if (n > 1) out.push('Có hóa đơn trùng dấu vân tay trong nhiều hồ sơ')
  const round = mine.filter((r) => r.amount % 100_000_000 === 0).length
  if (mine.length >= 4 && round / mine.length > 0.5) out.push('Hơn 50% hóa đơn có giá trị tròn trăm triệu')
  const sameDay = new Map<string, number>()
  for (const r of mine) sameDay.set(r.issueDate + r.buyerId, (sameDay.get(r.issueDate + r.buyerId) ?? 0) + 1)
  if ([...sameDay.values()].some((n) => n >= 4)) out.push('Nhiều hóa đơn cùng ngày cho cùng một bên mua')
  return [...new Set(out)]
}

export function fmtB(v: number) {
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} nghìn tỷ ₫`
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ ₫`
  return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr ₫`
}
