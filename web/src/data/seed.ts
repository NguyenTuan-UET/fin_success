// Dữ liệu mẫu (synthetic) cho bản demo thi. Tên doanh nghiệp, ngân hàng, MST, mã chứng khoán đều là hư cấu.
// Mã chứng khoán dùng 4 ký tự (…X) để không trùng mã thật. Ngày tháng tính tương đối theo thời điểm khởi tạo.
import type {
  AccountingConnection, Consent, CreditLimit, CreditProfile, DataSource, EarlyPaymentOffer, EsgAssessment, EsgIndicatorResult,
  ExternalRecord, FinancialYear, FinancingProduct, FundingApplication, IndicatorLevel, LedgerItem, ListedSnapshot, Notification, Org,
  Receivable, Rfq,
} from '../domain/types'

const DAY = 86_400_000
export const iso = (d: Date) => d.toISOString().slice(0, 10)
const rel = (base: Date, days: number) => iso(new Date(base.getTime() + days * DAY))
const B = 1_000_000_000
const M = 1_000_000

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export const ORGS: Org[] = [
  { id: 'b1', name: 'Tổng CTCP Xây dựng An Phát Hưng', shortName: 'An Phát Hưng', taxCode: '9900100011', type: 'buyer', vsic: '4101', industryLabel: 'Xây dựng công trình', industryGroup: 'manufacturing', listedSymbol: 'APHX', realDataSymbol: 'CTD', exchange: 'HOSE', foundedYear: 2004, employees: 3200, province: 'TP. Hồ Chí Minh', sample: true },
  { id: 'b2', name: 'CTCP Thép Đông Á Việt', shortName: 'Thép Đông Á Việt', taxCode: '9900100022', type: 'buyer', vsic: '2410', industryLabel: 'Sản xuất sắt thép', industryGroup: 'manufacturing', listedSymbol: 'DAVX', realDataSymbol: 'HPG', exchange: 'HOSE', foundedYear: 2001, employees: 5400, province: 'Bình Dương', sample: true },
  { id: 'b3', name: 'Công ty TNHH Bao bì Nam Việt', shortName: 'Bao bì Nam Việt', taxCode: '9900100033', type: 'buyer', vsic: '1702', industryLabel: 'Sản xuất bao bì giấy', industryGroup: 'manufacturing', foundedYear: 2010, employees: 640, province: 'Đồng Nai', sample: true },
  { id: 's1', name: 'Công ty TNHH Cơ khí Minh Tâm', shortName: 'Cơ khí Minh Tâm', taxCode: '9900200011', type: 'supplier', vsic: '2592', industryLabel: 'Gia công cơ khí', industryGroup: 'manufacturing', foundedYear: 2014, employees: 85, province: 'Bình Dương', sample: true },
  { id: 's2', name: 'Công ty TNHH Vật liệu Xây dựng Phú Gia', shortName: 'VLXD Phú Gia', taxCode: '9900200022', type: 'supplier', vsic: '2395', industryLabel: 'Sản xuất bê tông, vật liệu', industryGroup: 'manufacturing', foundedYear: 2019, employees: 42, province: 'Long An', sample: true },
  { id: 's3', name: 'Công ty TNHH Giấy Hưng Thịnh', shortName: 'Giấy Hưng Thịnh', taxCode: '9900200033', type: 'supplier', vsic: '1709', industryLabel: 'Sản xuất sản phẩm giấy', industryGroup: 'manufacturing', foundedYear: 2016, employees: 120, province: 'Đồng Nai', sample: true },
  { id: 's4', name: 'Công ty TNHH Dệt may Sao Mai', shortName: 'Dệt may Sao Mai', taxCode: '9900200044', type: 'supplier', vsic: '1410', industryLabel: 'May trang phục', industryGroup: 'manufacturing', foundedYear: 2021, employees: 210, province: 'Tây Ninh', sample: true },
  { id: 'l1', name: 'Ngân hàng TMCP Hồng Lam', shortName: 'NH Hồng Lam', taxCode: '9900300011', type: 'lender', vsic: '6419', industryLabel: 'Ngân hàng', industryGroup: 'trade', foundedYear: 1993, employees: 8000, province: 'Hà Nội', sample: true },
  { id: 'l2', name: 'Công ty Tài chính Ánh Dương', shortName: 'TC Ánh Dương', taxCode: '9900300022', type: 'lender', vsic: '6492', industryLabel: 'Công ty tài chính', industryGroup: 'trade', foundedYear: 2008, employees: 900, province: 'TP. Hồ Chí Minh', sample: true },
  { id: 'l3', name: 'Quỹ Tài chính Xanh Cửu Long', shortName: 'Quỹ Xanh Cửu Long', taxCode: '9900300033', type: 'lender', vsic: '6430', industryLabel: 'Quỹ đầu tư', industryGroup: 'trade', foundedYear: 2019, employees: 60, province: 'Cần Thơ', sample: true },
  { id: 'l4', name: 'Ngân hàng TMCP Đại Việt Số', shortName: 'NH Đại Việt Số', taxCode: '9900300044', type: 'lender', vsic: '6419', industryLabel: 'Ngân hàng', industryGroup: 'trade', foundedYear: 2006, employees: 5200, province: 'Hà Nội', sample: true },
]

export const PERSONAS: Record<string, { name: string; title: string }> = {
  b1: { name: 'Trần Ngọc Hà', title: 'Kế toán trưởng' },
  b2: { name: 'Lê Quang Vinh', title: 'Giám đốc tài chính' },
  b3: { name: 'Phạm Thu Trang', title: 'Giám đốc mua hàng' },
  s1: { name: 'Nguyễn Minh Tâm', title: 'Giám đốc' },
  s2: { name: 'Võ Thành Phú', title: 'Giám đốc' },
  s3: { name: 'Đặng Thị Hưng', title: 'Kế toán trưởng' },
  s4: { name: 'Huỳnh Sao Mai', title: 'Giám đốc' },
  l1: { name: 'Bùi Đức Anh', title: 'Chuyên viên thẩm định SCF' },
  l2: { name: 'Ngô Thanh Tú', title: 'Trưởng phòng sản phẩm' },
  l3: { name: 'Lý Minh Châu', title: 'Chuyên viên tín dụng xanh' },
  l4: { name: 'Đỗ Hải Nam', title: 'Chuyên viên thẩm định' },
}

function fy(year: number, v: Omit<FinancialYear, 'year' | 'source' | 'status'>, source: string, status: FinancialYear['status']): FinancialYear {
  return { year, ...v, source, status }
}

function makeListed(orgId: string, symbol: string, base: Date, startPrice: number, vol: number, seed: number, qRevenue: number, qProfit: number, events: { d: number; title: string }[]): ListedSnapshot {
  const r = rng(seed)
  const prices: { date: string; close: number }[] = []
  let p = startPrice
  for (let i = 180; i >= 0; i--) {
    const d = new Date(base.getTime() - i * DAY)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    p = Math.max(1000, p * (1 + (r() - 0.49) * vol * 0.12))
    prices.push({ date: iso(d), close: Math.round(p / 50) * 50 })
  }
  const yr = base.getFullYear()
  const quarters = [
    { period: `Q2/${yr}`, f: 1.06 }, { period: `Q1/${yr}`, f: 0.92 }, { period: `Q4/${yr - 1}`, f: 1.12 }, { period: `Q3/${yr - 1}`, f: 1.0 },
    { period: `Q2/${yr - 1}`, f: 0.97 }, { period: `Q1/${yr - 1}`, f: 0.88 }, { period: `Q4/${yr - 2}`, f: 1.05 }, { period: `Q3/${yr - 2}`, f: 0.95 },
  ].map((q, i) => ({ period: q.period, revenue: Math.round(qRevenue * q.f * (1 - i * 0.012)), netProfit: Math.round(qProfit * q.f * (1 - i * 0.02)), operatingCashFlow: Math.round(qProfit * q.f * (i % 3 === 1 ? -0.4 : 1.3)) }))
  return {
    orgId, symbol, exchange: 'HOSE', provider: 'vnstock (snapshot mẫu — cùng cấu trúc Fundamental/Market)', fetchedAt: base.toISOString(),
    marketCap: Math.round(p * (orgId === 'b1' ? 410_000_000 : 1_250_000_000)), volatility90d: vol, auditOpinion: 'unqualified', tradingStatus: 'normal',
    quarters, priceHistory: prices, events: events.map((e) => ({ date: rel(base, e.d), title: e.title })), isMock: true,
  }
}

function esgLevels(m: Record<string, number | null | 'na'>, simulated = true, docMap: Record<string, string> = {}): EsgIndicatorResult[] {
  return Object.entries(m).map(([code, v]) => {
    if (v === 'na') return { code, na: true, naReason: 'Không phát sinh hoạt động liên quan (đã kiểm tra thực địa)' }
    if (v === null) return { code, aiMissing: ['Chưa có bằng chứng trong 12 tháng gần nhất'] }
    return { code, aiLevel: v as IndicatorLevel, finalLevel: v as IndicatorLevel, aiSimulated: simulated, aiRationale: 'Đánh giá mẫu khởi tạo cho demo — dựa trên bộ chứng từ mô phỏng.', aiCitations: docMap[code] ? [{ documentId: docMap[code], note: 'Chứng từ mẫu' }] : [] }
  })
}

export interface SeedData {
  seededAt: string
  orgs: Org[]
  profiles: CreditProfile[]
  listed: ListedSnapshot[]
  receivables: Receivable[]
  products: FinancingProduct[]
  rfqs: Rfq[]
  applications: FundingApplication[]
  earlyOffers: EarlyPaymentOffer[]
  limits: CreditLimit[]
  esg: EsgAssessment[]
  connections: AccountingConnection[]
  ledger: LedgerItem[]
  sources: DataSource[]
  external: ExternalRecord[]
  consents: Consent[]
  notifications: Notification[]
}

export function buildSeed(now = new Date()): SeedData {
  const base = new Date(iso(now))
  const yr = base.getFullYear() - 1
  const d = (n: number) => rel(base, n)

  const profiles: CreditProfile[] = [
    {
      orgId: 's1',
      financials: [
        fy(yr, { revenue: 48.6 * B, netProfit: 2.9 * B, ebit: 4.6 * B, interestExpense: 0.9 * B, depreciation: 1.4 * B, totalAssets: 31 * B, currentAssets: 19.5 * B, currentLiabilities: 12.1 * B, totalLiabilities: 17.2 * B, equity: 13.8 * B, operatingCashFlow: 3.4 * B, debtService: 3.6 * B, cash: 2.1 * B, inventory: 5.6 * B, receivables: 10.8 * B }, 'BCTC năm (doanh nghiệp tải lên, đã đối chiếu)', 'verified'),
        fy(yr - 1, { revenue: 42.1 * B, netProfit: 2.3 * B, ebit: 3.9 * B, interestExpense: 0.85 * B, depreciation: 1.3 * B, totalAssets: 27.4 * B, currentAssets: 16.8 * B, currentLiabilities: 11.2 * B, totalLiabilities: 15.9 * B, equity: 11.5 * B, operatingCashFlow: 2.6 * B, debtService: 3.4 * B, cash: 1.6 * B, inventory: 5.1 * B, receivables: 9.4 * B }, 'BCTC năm (doanh nghiệp tải lên, đã đối chiếu)', 'verified'),
      ],
      cic: { worstDebtGroup: 1, maxLateDays: 0, months: 36, source: 'Báo cáo CIC doanh nghiệp tự tra cứu (mẫu)' },
      taxStatus: 'active', legalEvents: 'none', capitalNeed: 6 * B, ownContribution: 2 * B,
      collateral: [{ id: 'c1', kind: 'machinery', description: 'Máy CNC 5 trục (2 máy)', declaredValue: 4.2 * B }],
      frameworkContractMonths: 18, topCustomerShare: 0.46, topCustomerId: 'b1', dsoDays: 58, contractTermDays: 45, einvoiceRevenue: 47.9 * B, vatDeclaredRevenue: 48.2 * B,
    },
    {
      orgId: 's2',
      financials: [
        fy(yr, { revenue: 21.3 * B, netProfit: 0.42 * B, ebit: 1.3 * B, interestExpense: 0.62 * B, depreciation: 0.55 * B, totalAssets: 18.4 * B, currentAssets: 10.1 * B, currentLiabilities: 9.3 * B, totalLiabilities: 13.6 * B, equity: 4.8 * B, operatingCashFlow: 0.6 * B, debtService: 1.55 * B, cash: 0.5 * B, inventory: 3.9 * B, receivables: 5.2 * B }, 'BCTC năm (tự khai, AI trích xuất)', 'extracted'),
        fy(yr - 1, { revenue: 22.8 * B, netProfit: 0.61 * B, ebit: 1.5 * B, interestExpense: 0.58 * B, depreciation: 0.5 * B, totalAssets: 17.2 * B, currentAssets: 9.4 * B, currentLiabilities: 8.1 * B, totalLiabilities: 12.8 * B, equity: 4.4 * B, operatingCashFlow: -0.3 * B, debtService: 1.5 * B, cash: 0.4 * B, inventory: 3.5 * B, receivables: 4.8 * B }, 'BCTC năm (tự khai, AI trích xuất)', 'extracted'),
      ],
      taxStatus: 'active', legalEvents: 'minor_resolved', collateral: [], frameworkContractMonths: 6, topCustomerShare: 0.72, topCustomerId: 'b1', dsoDays: 78, contractTermDays: 45,
    },
    {
      orgId: 's3',
      financials: [
        fy(yr, { revenue: 36.4 * B, netProfit: 1.1 * B, ebit: 2.4 * B, interestExpense: 0.95 * B, depreciation: 1.1 * B, totalAssets: 24.6 * B, currentAssets: 13.2 * B, currentLiabilities: 11.9 * B, totalLiabilities: 16.1 * B, equity: 8.5 * B, operatingCashFlow: 1.9 * B, debtService: 2.6 * B, cash: 0.9 * B, inventory: 4.4 * B, receivables: 7.3 * B }, 'BCTC năm (doanh nghiệp tải lên)', 'verified'),
        fy(yr - 1, { revenue: 33.9 * B, netProfit: 0.95 * B, ebit: 2.1 * B, interestExpense: 0.9 * B, depreciation: 1.0 * B, totalAssets: 22.9 * B, currentAssets: 12.1 * B, currentLiabilities: 10.6 * B, totalLiabilities: 15.2 * B, equity: 7.7 * B, operatingCashFlow: 1.2 * B, debtService: 2.5 * B, cash: 0.7 * B, inventory: 4.1 * B, receivables: 6.9 * B }, 'BCTC năm (doanh nghiệp tải lên)', 'verified'),
      ],
      cic: { worstDebtGroup: 2, maxLateDays: 22, months: 36, source: 'Báo cáo CIC doanh nghiệp tự tra cứu (mẫu)' },
      taxStatus: 'active', legalEvents: 'none', collateral: [{ id: 'c2', kind: 'realestate', description: 'Nhà xưởng 2.400 m² KCN Nhơn Trạch', declaredValue: 9.5 * B }], capitalNeed: 5 * B, ownContribution: 1.2 * B,
      frameworkContractMonths: 24, topCustomerShare: 0.38, topCustomerId: 'b3', dsoDays: 52, contractTermDays: 45, einvoiceRevenue: 35.8 * B, vatDeclaredRevenue: 36.1 * B,
    },
    {
      orgId: 's4',
      financials: [
        fy(yr, { revenue: 15.2 * B, netProfit: 0.35 * B, ebit: 0.9 * B, interestExpense: 0.4 * B, depreciation: 0.6 * B, totalAssets: 12.1 * B, currentAssets: 6.9 * B, currentLiabilities: 6.5 * B, totalLiabilities: 9.4 * B, equity: 2.7 * B, operatingCashFlow: 0.2 * B, debtService: 1.4 * B, cash: 0.3 * B, inventory: 2.8 * B, receivables: 3.1 * B }, 'BCTC năm (tự khai)', 'self_declared'),
      ],
      taxStatus: 'active', collateral: [], topCustomerShare: 0.55, einvoiceRevenue: 10.4 * B, vatDeclaredRevenue: 10.9 * B,
    },
    {
      orgId: 'b3',
      financials: [
        fy(yr, { revenue: 412 * B, netProfit: 18.5 * B, ebit: 31 * B, interestExpense: 7.2 * B, depreciation: 12 * B, totalAssets: 286 * B, currentAssets: 158 * B, currentLiabilities: 112 * B, totalLiabilities: 171 * B, equity: 115 * B, operatingCashFlow: 24 * B, debtService: 28 * B, cash: 21 * B, inventory: 52 * B, receivables: 61 * B }, 'BCTC kiểm toán (doanh nghiệp tải lên)', 'verified'),
        fy(yr - 1, { revenue: 389 * B, netProfit: 16.2 * B, ebit: 28 * B, interestExpense: 7.0 * B, depreciation: 11 * B, totalAssets: 268 * B, currentAssets: 147 * B, currentLiabilities: 104 * B, totalLiabilities: 163 * B, equity: 105 * B, operatingCashFlow: 19 * B, debtService: 26 * B, cash: 18 * B, inventory: 49 * B, receivables: 57 * B }, 'BCTC kiểm toán (doanh nghiệp tải lên)', 'verified'),
      ],
      taxStatus: 'active', legalEvents: 'none', collateral: [],
    },
    {
      orgId: 'b1',
      financials: [
        fy(yr, { revenue: 9_850 * B, netProfit: 312 * B, ebit: 590 * B, interestExpense: 145 * B, depreciation: 160 * B, totalAssets: 11_200 * B, currentAssets: 8_400 * B, currentLiabilities: 6_300 * B, totalLiabilities: 7_450 * B, equity: 3_750 * B, operatingCashFlow: 420 * B, debtService: 610 * B, cash: 980 * B, inventory: 2_100 * B, receivables: 3_900 * B }, 'vnstock snapshot mẫu · Fundamental.balance_sheet/income_statement/cash_flow', 'public_reference'),
        fy(yr - 1, { revenue: 9_120 * B, netProfit: 268 * B, ebit: 530 * B, interestExpense: 150 * B, depreciation: 150 * B, totalAssets: 10_600 * B, currentAssets: 7_900 * B, currentLiabilities: 6_000 * B, totalLiabilities: 7_200 * B, equity: 3_400 * B, operatingCashFlow: 290 * B, debtService: 640 * B, cash: 860 * B, inventory: 2_000 * B, receivables: 3_600 * B }, 'vnstock snapshot mẫu', 'public_reference'),
      ],
      collateral: [],
    },
    {
      orgId: 'b2',
      financials: [
        fy(yr, { revenue: 28_400 * B, netProfit: 1_150 * B, ebit: 1_900 * B, interestExpense: 410 * B, depreciation: 980 * B, totalAssets: 36_500 * B, currentAssets: 17_800 * B, currentLiabilities: 15_200 * B, totalLiabilities: 19_900 * B, equity: 16_600 * B, operatingCashFlow: 2_300 * B, debtService: 3_100 * B, cash: 2_400 * B, inventory: 9_600 * B, receivables: 3_100 * B }, 'vnstock snapshot mẫu · Fundamental.balance_sheet/income_statement/cash_flow', 'public_reference'),
        fy(yr - 1, { revenue: 30_100 * B, netProfit: 1_420 * B, ebit: 2_250 * B, interestExpense: 390 * B, depreciation: 940 * B, totalAssets: 35_100 * B, currentAssets: 17_100 * B, currentLiabilities: 14_300 * B, totalLiabilities: 19_000 * B, equity: 16_100 * B, operatingCashFlow: 2_900 * B, debtService: 3_000 * B, cash: 2_700 * B, inventory: 9_100 * B, receivables: 2_900 * B }, 'vnstock snapshot mẫu', 'public_reference'),
      ],
      collateral: [],
    },
  ]

  const listed: ListedSnapshot[] = [
    makeListed('b1', 'APHX', base, 24_500, 0.34, 7, 2_460 * B, 78 * B, [{ d: -12, title: 'Trúng thầu gói EPC nhà máy điện mặt trời áp mái 1.200 tỷ' }, { d: -41, title: 'Công bố BCTC quý 2 đã soát xét' }, { d: -75, title: 'ĐHĐCĐ thông qua kế hoạch phát hành trái phiếu xanh' }]),
    makeListed('b2', 'DAVX', base, 26_800, 0.29, 11, 7_100 * B, 290 * B, [{ d: -9, title: 'Sản lượng tiêu thụ thép tháng tăng 8% so với cùng kỳ' }, { d: -38, title: 'Công bố BCTC quý 2 đã soát xét' }, { d: -66, title: 'Khởi công dây chuyền lò điện hồ quang (EAF) giảm phát thải' }]),
  ]

  // ------------ Khoản phải thu ------------
  let n = 0
  const rv = (p: Partial<Receivable> & Pick<Receivable, 'sellerId' | 'buyerId' | 'amount' | 'state'> & { issue: number; due: number }): Receivable => {
    n++
    const { issue, due, ...rest } = p
    const num = String(1200 + n * 7).padStart(7, '0')
    return {
      id: `r${n}`, code: `INV-${String(n).padStart(3, '0')}`, invoiceSeries: '1C26TMT', invoiceNumber: num, issueDate: d(issue), dueDate: d(due),
      description: 'Hàng hóa/dịch vụ theo hợp đồng nguyên tắc', version: 1, fingerprint: `fp-${p.sellerId}-${num}`,
      docs: { xml: true, contract: true, delivery: true }, source: 'xml', createdAt: d(issue), ...rest,
    }
  }
  const receivables: Receivable[] = [
    rv({ sellerId: 's1', buyerId: 'b1', amount: 1_230 * M, state: 'BUYER_CONFIRMED', issue: -20, due: 55, description: 'Gia công kết cấu thép dầm cầu trục — dự án Nhà xưởng KCN Bàu Bàng', confirmedAt: d(-14) }),
    rv({ sellerId: 's1', buyerId: 'b2', amount: 845 * M, state: 'BUYER_CONFIRMED', issue: -12, due: 48, description: 'Gia công khuôn đúc phôi thép', confirmedAt: d(-8) }),
    rv({ sellerId: 's1', buyerId: 'b1', amount: 690 * M, state: 'BUYER_PENDING', issue: -4, due: 70, description: 'Lan can, cầu thang thép — dự án chung cư An Phát Riverside', docs: { xml: true, contract: true, delivery: false } }),
    rv({ sellerId: 's1', buyerId: 'b1', amount: 1_560 * M, state: 'FUNDED', issue: -40, due: 20, description: 'Kết cấu thép mái nhà xưởng', confirmedAt: d(-36) }),
    rv({ sellerId: 's1', buyerId: 'b2', amount: 520 * M, state: 'SETTLED', issue: -110, due: -50, description: 'Gia công bánh răng máy cán', confirmedAt: d(-105), paidAt: d(-48), paidAmount: 520 * M }),
    rv({ sellerId: 's1', buyerId: 'b1', amount: 760 * M, state: 'SETTLED', issue: -150, due: -95, description: 'Bulông, bản mã liên kết', confirmedAt: d(-146), paidAt: d(-86), paidAmount: 760 * M }),
    rv({ sellerId: 's1', buyerId: 'b2', amount: 410 * M, state: 'DRAFT', issue: -1, due: 59, description: 'Gia công trục cán (nháp)', docs: { xml: true, contract: false, delivery: false } }),
    rv({ sellerId: 's2', buyerId: 'b1', amount: 890 * M, state: 'UNDER_REVIEW', issue: -25, due: 35, description: 'Bê tông thương phẩm M300 — dự án Riverside', confirmedAt: d(-20) }),
    rv({ sellerId: 's2', buyerId: 'b1', amount: 340 * M, state: 'BUYER_DISPUTED', issue: -18, due: 27, description: 'Gạch không nung đợt 3', disputeReason: 'Số lượng giao thiếu 4.000 viên so với biên bản giao nhận', docs: { xml: true, contract: true, delivery: true } }),
    rv({ sellerId: 's2', buyerId: 'b1', amount: 300 * M, state: 'OVERDUE', issue: -80, due: -12, description: 'Cát xây dựng đợt 2', confirmedAt: d(-75) }),
    rv({ sellerId: 's3', buyerId: 'b3', amount: 210 * M, state: 'BUYER_CONFIRMED', issue: -9, due: 36, description: 'Giấy kraft cuộn 150gsm', confirmedAt: d(-6) }),
    rv({ sellerId: 's3', buyerId: 'b3', amount: 455 * M, state: 'SUBMITTED', issue: -15, due: 30, description: 'Thùng carton 5 lớp', confirmedAt: d(-11) }),
    rv({ sellerId: 's3', buyerId: 'b3', amount: 380 * M, state: 'EARLY_PAID', issue: -50, due: -5, description: 'Giấy duplex', confirmedAt: d(-46), paidAt: d(-30), paidAmount: 371 * M }),
    rv({ sellerId: 's3', buyerId: 'b2', amount: 265 * M, state: 'SETTLED', issue: -95, due: -40, description: 'Bao bì đóng gói thép cuộn', confirmedAt: d(-90), paidAt: d(-31), paidAmount: 265 * M }),
    rv({ sellerId: 's4', buyerId: 'b3', amount: 567 * M, state: 'BUYER_CONFIRMED', issue: -14, due: 31, description: 'Đồng phục bảo hộ lao động', confirmedAt: d(-10) }),
    rv({ sellerId: 's4', buyerId: 'b3', amount: 300 * M, state: 'BUYER_PENDING', issue: -3, due: 42, description: 'Găng tay, khẩu trang vải', docs: { xml: false, contract: true, delivery: false }, source: 'ocr' }),
    rv({ sellerId: 's2', buyerId: 'b1', amount: 610 * M, state: 'SETTLED', issue: -140, due: -80, description: 'Đá 1x2 đợt 1', confirmedAt: d(-135), paidAt: d(-62), paidAmount: 610 * M }),
  ]

  // ------------ Sản phẩm Marketplace (MẪU) ------------
  const prod = (p: Omit<FinancingProduct, 'status' | 'version' | 'effectiveFrom' | 'effectiveTo' | 'sample'> & Partial<FinancingProduct>): FinancingProduct => ({ status: 'published', version: 1, effectiveFrom: d(-60), effectiveTo: d(300), sample: true, ...p })
  const products: FinancingProduct[] = [
    prod({ id: 'p1', lenderId: 'l1', name: 'Bao thanh toán nội địa SCF Plus', type: 'factoring_recourse', description: 'Ứng trước khoản phải thu đã được bên mua xác nhận, có truy đòi nhà cung cấp.', eligibility: { minAmount: 100 * M, maxAmount: 5 * B, maxTenorDays: 120, minSupplierRating: 'BB', minBuyerRating: 'BBB', requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 6.9, rateMax: 7.8, fees: [{ name: 'Phí xử lý hồ sơ', kind: 'pct', value: 0.3, upfront: true }], latePenaltyPct: 150 }, greenRule: { minEsg: 65, minCoverage: 0.8, discountPct: 0.5 }, sla: { quoteHours: 8, reviewHours: 48 } }),
    prod({ id: 'p2', lenderId: 'l1', name: 'Reverse Factoring — Chương trình An Phát Hưng', type: 'reverse_factoring', description: 'Chương trình SCF do An Phát Hưng khởi tạo cho nhà cung cấp trong chuỗi; rủi ro dựa trên tín dụng bên mua.', eligibility: { minAmount: 50 * M, maxAmount: 3 * B, maxTenorDays: 90, minBuyerRating: 'A', requireBuyerConfirmation: true, buyerWhitelist: ['b1'] }, pricing: { advancePct: 90, rateMin: 6.2, rateMax: 6.6, fees: [], latePenaltyPct: 150 }, sla: { quoteHours: 4, reviewHours: 24 } }),
    prod({ id: 'p3', lenderId: 'l2', name: 'Ứng vốn hóa đơn nhanh 24h', type: 'invoice_finance', description: 'Tài trợ hóa đơn cho SME, thẩm định nhanh, không yêu cầu TSBĐ.', eligibility: { minAmount: 50 * M, maxAmount: 2 * B, maxTenorDays: 150, minSupplierRating: 'B', requireBuyerConfirmation: true }, pricing: { advancePct: 75, rateMin: 7.6, rateMax: 8.1, fees: [{ name: 'Phí dịch vụ', kind: 'fixed', value: 2 * M, upfront: true }, { name: 'Phí quản lý khoản phải thu', kind: 'pct', value: 0.2, upfront: false }], latePenaltyPct: 150 }, sla: { quoteHours: 2, reviewHours: 24 } }),
    prod({ id: 'p4', lenderId: 'l3', name: 'Vốn lưu động Xanh cho chuỗi cung ứng', type: 'green_loan', description: 'Ưu tiên doanh nghiệp có điểm ESG chính thức; lãi suất thấp nhờ nguồn vốn xanh ủy thác.', eligibility: { industryGroups: ['manufacturing', 'agri'], minAmount: 100 * M, maxAmount: 3 * B, maxTenorDays: 120, minSupplierRating: 'BBB', minEsg: 60, requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 5.9, rateMax: 6.5, fees: [{ name: 'Phí thẩm định ESG', kind: 'fixed', value: 3 * M, upfront: true }], latePenaltyPct: 150 }, greenRule: { minEsg: 70, minCoverage: 0.8, discountPct: 0.7 }, sla: { quoteHours: 24, reviewHours: 72 } }),
    prod({ id: 'p5', lenderId: 'l4', name: 'Bao thanh toán miễn truy đòi', type: 'factoring_nonrecourse', description: 'Chuyển rủi ro thanh toán sang ngân hàng khi bên mua có xếp hạng cao.', eligibility: { minAmount: 300 * M, maxAmount: 10 * B, maxTenorDays: 90, minBuyerRating: 'A', minApplicationRating: 'BBB', requireBuyerConfirmation: true }, pricing: { advancePct: 85, rateMin: 7.2, rateMax: 7.9, fees: [{ name: 'Phí bảo hiểm rủi ro bên mua', kind: 'pct', value: 0.4, upfront: true }], latePenaltyPct: 150 }, sla: { quoteHours: 12, reviewHours: 72 } }),
    prod({ id: 'p6', lenderId: 'l4', name: 'Tài trợ hóa đơn ngành giấy & bao bì', type: 'invoice_finance', description: 'Sản phẩm chuyên ngành giấy, bao bì; kỳ hạn tới 120 ngày.', eligibility: { minAmount: 100 * M, maxAmount: 2 * B, maxTenorDays: 120, minSupplierRating: 'BB', requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 7.0, rateMax: 7.5, fees: [{ name: 'Phí xử lý', kind: 'pct', value: 0.25, upfront: true }], latePenaltyPct: 150 }, sla: { quoteHours: 8, reviewHours: 48 } }),
    prod({ id: 'p7', lenderId: 'l2', name: 'Thấu chi khoản phải thu (bản nháp)', type: 'invoice_finance', description: 'Đang xây dựng — chưa công bố.', eligibility: { minAmount: 50 * M, maxAmount: 1 * B, maxTenorDays: 60, requireBuyerConfirmation: false }, pricing: { advancePct: 70, rateMin: 9, rateMax: 11, fees: [], latePenaltyPct: 150 }, sla: {}, status: 'draft' }),
  ]

  const applications: FundingApplication[] = [
    { id: 'APP-001', receivableId: 'r4', lenderId: 'l1', productId: 'p2', state: 'FUNDED', submittedAt: d(-35), decidedAt: d(-34), offer: { advanceVnd: 1_404 * M, ratePct: 6.4, feesVnd: 0, tenorDays: 60, conditions: 'Bên mua thanh toán vào tài khoản chuyên dùng tại NH Hồng Lam', expiresAt: d(-30) }, fundedAt: d(-33), fundedAmount: 1_404 * M },
    { id: 'APP-002', receivableId: 'r5', lenderId: 'l2', productId: 'p3', state: 'SETTLED', submittedAt: d(-100), decidedAt: d(-99), offer: { advanceVnd: 390 * M, ratePct: 7.9, feesVnd: 2 * M, tenorDays: 60, conditions: 'Có truy đòi', expiresAt: d(-95) }, fundedAt: d(-98), fundedAmount: 390 * M, settledAt: d(-48) },
    { id: 'APP-003', receivableId: 'r8', lenderId: 'l1', productId: 'p1', state: 'UNDER_REVIEW', submittedAt: d(-3) },
    { id: 'APP-004', receivableId: 'r12', lenderId: 'l4', productId: 'p6', state: 'SUBMITTED', submittedAt: d(-1) },
    { id: 'APP-005', receivableId: 'r14', lenderId: 'l4', productId: 'p6', state: 'SETTLED', submittedAt: d(-88), decidedAt: d(-86), offer: { advanceVnd: 212 * M, ratePct: 7.2, feesVnd: 0.53 * M, tenorDays: 55, conditions: '—', expiresAt: d(-80) }, fundedAt: d(-85), fundedAmount: 212 * M, settledAt: d(-31) },
    { id: 'APP-006', receivableId: 'r17', lenderId: 'l1', productId: 'p2', state: 'SETTLED', submittedAt: d(-130), decidedAt: d(-129), offer: { advanceVnd: 549 * M, ratePct: 6.5, feesVnd: 0, tenorDays: 60, conditions: '—', expiresAt: d(-125) }, fundedAt: d(-128), fundedAmount: 549 * M, settledAt: d(-62) },
  ]

  const rfqs: Rfq[] = [
    {
      id: 'RFQ-001', receivableId: 'r2', sellerId: 's1', productIds: ['p1', 'p3', 'p4'], state: 'RESPONDED', createdAt: d(-2), expiresAt: d(3),
      responses: [
        { lenderId: 'l1', productId: 'p1', kind: 'quote', advancePct: 80, ratePct: 7.1, feesVnd: 2_028_000, conditions: 'Có truy đòi; bên mua thanh toán vào TK chuyên dùng', validUntil: d(4), respondedAt: d(-1), simulated: true },
        { lenderId: 'l2', productId: 'p3', kind: 'quote', advancePct: 75, ratePct: 7.8, feesVnd: 2_000_000, conditions: 'Giải ngân trong 24h sau ký', validUntil: d(3), respondedAt: d(-1), simulated: true },
      ],
    },
  ]

  const earlyOffers: EarlyPaymentOffer[] = [
    { id: 'EP-001', buyerId: 'b3', receivableId: 'r13', discountPct: 2.4, payBy: d(-31), state: 'PAID', createdAt: d(-35) },
    { id: 'EP-002', buyerId: 'b3', receivableId: 'r11', discountPct: 1.8, payBy: d(10), state: 'OPEN', createdAt: d(-1) },
  ]

  const limits: CreditLimit[] = [
    { id: 'LM-1', lenderId: 'l1', borrowerId: 's1', amount: 2.5 * B, validUntil: d(250) },
    { id: 'LM-2', lenderId: 'l2', borrowerId: 's1', amount: 1.2 * B, validUntil: d(180) },
    { id: 'LM-3', lenderId: 'l4', borrowerId: 's3', amount: 1.5 * B, validUntil: d(200) },
  ]

  const esg: EsgAssessment[] = [
    {
      id: 'ESG-s1', orgId: 's1', industryGroup: 'manufacturing', period: `${d(-365)} → ${d(0)}`, status: 'official', issuedAt: d(-20), validUntil: d(345), source: 'assessed',
      indicators: esgLevels({ E1: 3, E2: 2, E3: 3, E4: 3, E5: 3, E6: 2, S1: 3, S2: 3, S3: 2, S4: 3, S5: 2, S6: 3, G1: 3, G2: 4, G3: 2, G4: 3, G5: 3, G6: 2 }),
      documents: [
        { id: 'doc-s1-1', name: 'Hoa_don_dien_12_thang.pdf', mime: 'application/pdf', docType: 'Hóa đơn điện', period: '12 tháng', indicatorCodes: ['E1', 'E3'], extracted: { 'Tổng kWh 12 tháng': 412_800, 'kWh điện mặt trời tự dùng': 96_500 }, uploadedAt: d(-30), simulated: true },
        { id: 'doc-s1-2', name: 'Danh_sach_dong_BHXH.xlsx', mime: 'application/vnd.ms-excel', docType: 'Danh sách đóng BHXH', period: 'T6', indicatorCodes: ['S1'], extracted: { 'Lao động đóng BHXH': 81, 'Tổng lao động': 85 }, uploadedAt: d(-30), simulated: true },
        { id: 'doc-s1-3', name: 'HD_thu_gom_chat_thai.pdf', mime: 'application/pdf', docType: 'Hợp đồng thu gom chất thải', period: 'Còn hiệu lực', indicatorCodes: ['E4'], uploadedAt: d(-30), simulated: true },
      ],
      metrics: { kwh12m: 412_800, solarKwh12m: 96_500, waterM3_12m: 5_400, bhxhCovered: 81, employees: 85 },
    },
    {
      id: 'ESG-s2', orgId: 's2', industryGroup: 'manufacturing', period: `${d(-365)} → ${d(0)}`, status: 'in_review', source: 'assessed',
      indicators: esgLevels({ E1: 2, E2: 1, E3: null, E4: 2, E5: 2, E6: null, S1: 2, S2: 2, S3: 1, S4: 2, S5: null, S6: 2, G1: 2, G2: 2, G3: null, G4: 1, G5: 2, G6: null }),
      documents: [], metrics: { kwh12m: 188_000, employees: 42 },
    },
    {
      id: 'ESG-s3', orgId: 's3', industryGroup: 'manufacturing', period: `${d(-365)} → ${d(0)}`, status: 'official', issuedAt: d(-60), validUntil: d(305), source: 'assessed',
      indicators: esgLevels({ E1: 2, E2: 2, E3: 2, E4: 3, E5: 2, E6: 1, S1: 2, S2: 2, S3: 2, S4: 3, S5: 1, S6: 2, G1: 3, G2: 2, G3: 2, G4: 2, G5: 2, G6: 2 }),
      documents: [], metrics: { kwh12m: 520_000, waterM3_12m: 18_200, employees: 120 },
    },
    {
      id: 'ESG-b1', orgId: 'b1', industryGroup: 'manufacturing', period: `Năm ${yr}`, status: 'provisional', source: 'disclosure',
      indicators: esgLevels({ E1: 3, E2: 2, E3: 3, E4: 3, E5: 3, E6: 3, S1: 4, S2: 3, S3: 3, S4: 3, S5: 2, S6: 3, G1: 4, G2: 4, G3: 3, G4: 3, G5: 3, G6: 3 }),
      documents: [], metrics: {},
    },
  ]

  const connections: AccountingConnection[] = [
    {
      orgId: 's1', provider: 'MISA', method: 'api', status: 'connected', lastSyncedAt: new Date(base.getTime() - 3 * 3600_000).toISOString(), openingCash: 1_850 * M,
      recurringMonthlyOut: [{ name: 'Lương nhân viên', amount: 980 * M, day: 5 }, { name: 'Thuê nhà xưởng', amount: 120 * M, day: 10 }, { name: 'Trả nợ vay trung hạn (máy CNC)', amount: 210 * M, day: 25 }, { name: 'Thuế GTGT/TNDN tạm nộp', amount: 160 * M, day: 20 }],
      recurringMonthlyIn: [{ name: 'Thu từ đơn hàng mới (bình quân 6 tháng, ngoài công nợ hiện có)', amount: 2_900 * M, day: 28, fromDay: 30 }],
      buyerDelayDays: { '9900100011': { median: 9, p80: 21 }, '9900100022': { median: 3, p80: 8 }, '*': { median: 7, p80: 18 } }, simulated: true,
    },
    {
      orgId: 'b3', provider: 'FAST', method: 'file', status: 'connected', lastSyncedAt: new Date(base.getTime() - 26 * 3600_000).toISOString(), openingCash: 21_000 * M,
      recurringMonthlyOut: [{ name: 'Lương nhân viên', amount: 7_200 * M, day: 5 }, { name: 'Điện, nước, khí', amount: 1_900 * M, day: 15 }, { name: 'Trả nợ vay', amount: 2_300 * M, day: 25 }],
      recurringMonthlyIn: [{ name: 'Thu từ đơn hàng mới (bình quân 6 tháng)', amount: 30_000 * M, day: 20, fromDay: 20 }],
      buyerDelayDays: { '*': { median: 4, p80: 12 } }, simulated: true,
    },
  ]

  const ledger: LedgerItem[] = [
    // s1 — phải thu từ hóa đơn trên FCC + ngoài FCC; phải trả nhà cung cấp thép
    ...receivables.filter((r) => r.sellerId === 's1' && !['SETTLED', 'DRAFT', 'FUNDED'].includes(r.state)).map((r) => ({ id: `L-${r.id}`, orgId: 's1', kind: 'AR' as const, counterpartyName: ORGS.find((o) => o.id === r.buyerId)!.shortName, counterpartyTaxCode: ORGS.find((o) => o.id === r.buyerId)!.taxCode, docNo: r.code, amount: r.amount, paid: 0, dueDate: r.dueDate })),
    { id: 'L-x1', orgId: 's1', kind: 'AR', counterpartyName: 'Công ty TNHH Kết cấu Thép Lộc Phát', counterpartyTaxCode: '9900900001', docNo: 'HĐ 0001188', amount: 320 * M, paid: 0, dueDate: d(18) },
    { id: 'L-x2', orgId: 's1', kind: 'AR', counterpartyName: 'CTCP Cơ điện Tân Tiến', counterpartyTaxCode: '9900900002', docNo: 'HĐ 0001192', amount: 185 * M, paid: 60 * M, dueDate: d(6) },
    { id: 'L-x6', orgId: 's1', kind: 'AR', counterpartyName: 'An Phát Hưng (phần giữ lại sau tài trợ INV-004)', counterpartyTaxCode: '9900100011', docNo: 'INV-004 (20%)', amount: 156 * M, paid: 0, dueDate: d(20) },
    { id: 'L-x3', orgId: 's1', kind: 'AP', counterpartyName: 'Thép Đông Á Việt (mua phôi)', docNo: 'PN 0458', amount: 1_120 * M, paid: 0, dueDate: d(12) },
    { id: 'L-x4', orgId: 's1', kind: 'AP', counterpartyName: 'Công ty TNHH Que hàn Việt Đức', docNo: 'PN 0461', amount: 240 * M, paid: 0, dueDate: d(22) },
    { id: 'L-x5', orgId: 's1', kind: 'AP', counterpartyName: 'Công ty TNHH Khí công nghiệp Sài Gòn', docNo: 'PN 0466', amount: 95 * M, paid: 0, dueDate: d(31) },
    { id: 'L-x7', orgId: 's1', kind: 'AP', counterpartyName: 'Thép Đông Á Việt (mua phôi đợt 2)', docNo: 'PN 0472', amount: 1_380 * M, paid: 0, dueDate: d(41) },
    // b3 — phải trả nhà cung cấp
    ...receivables.filter((r) => r.buyerId === 'b3' && !['SETTLED', 'EARLY_PAID'].includes(r.state)).map((r) => ({ id: `L-b3-${r.id}`, orgId: 'b3', kind: 'AP' as const, counterpartyName: ORGS.find((o) => o.id === r.sellerId)!.shortName, docNo: r.code, amount: r.amount, paid: 0, dueDate: r.dueDate })),
    { id: 'L-b3-1', orgId: 'b3', kind: 'AR', counterpartyName: 'Chuỗi siêu thị Bách Hóa Sao (mẫu)', counterpartyTaxCode: '9900900010', docNo: 'HĐ 0230', amount: 6_400 * M, paid: 0, dueDate: d(15) },
    { id: 'L-b3-2', orgId: 'b3', kind: 'AR', counterpartyName: 'CTCP Thực phẩm Việt Xanh (mẫu)', counterpartyTaxCode: '9900900011', docNo: 'HĐ 0234', amount: 4_800 * M, paid: 0, dueDate: d(28) },
  ]

  const sources: DataSource[] = [
    { id: 'src-vnstock', name: 'vnstock (Fundamental, Market, Reference)', kind: 'vnstock', owner: 'Thư viện vnstock — dữ liệu từ KBS/VCI/MSN', dataFields: 'BCTC quý/năm, chỉ số, giá, hồ sơ công ty, sự kiện', legalBasis: 'Giấy phép vnstock đã cấp cho nhóm (theo xác nhận của nhóm)', personalData: false, rateLimit: '60 lượt/phút (Community)', status: 'approved', note: 'Dùng nguồn VCI (nguồn KBS trả nhãn năm BCTC bị đảo ở vnstock 4.0.9). Có sẵn HPG, CTD; chạy scripts/fetch_listed.py để lấy mã khác' },
    { id: 'src-dkkd', name: 'Cổng thông tin quốc gia về đăng ký doanh nghiệp', kind: 'crawl', owner: 'Cơ quan đăng ký kinh doanh', dataFields: 'Tình trạng pháp lý, ngày thành lập, ngành nghề, địa chỉ', legalBasis: 'Thông tin công khai — cần rà soát điều khoản sử dụng', personalData: true, rateLimit: '≤ 1 yêu cầu/5 giây, theo MST', status: 'approved', note: 'Có CAPTCHA → tra cứu thủ công có hỗ trợ, không vượt CAPTCHA' },
    { id: 'src-tax', name: 'Tra cứu người nộp thuế', kind: 'crawl', owner: 'Cơ quan thuế', dataFields: 'Trạng thái MST', legalBasis: 'Thông tin công khai — cần rà soát', personalData: false, rateLimit: 'Theo MST, có cache 7 ngày', status: 'approved', note: 'Có CAPTCHA → tra cứu thủ công có hỗ trợ' },
    { id: 'src-bid', name: 'Hệ thống mạng đấu thầu quốc gia', kind: 'crawl', owner: 'Cơ quan quản lý đấu thầu', dataFields: 'Lịch sử tham gia/trúng thầu', legalBasis: 'Thông tin công khai', personalData: false, rateLimit: '≤ 1 yêu cầu/3 giây', status: 'approved', note: 'Dùng cho năng lực thực hiện ngành xây dựng' },
    { id: 'src-court', name: 'Cổng công bố bản án, quyết định', kind: 'crawl', owner: 'Tòa án', dataFields: 'Tranh chấp, phá sản', legalBasis: 'Thông tin công khai', personalData: true, rateLimit: '≤ 1 yêu cầu/5 giây', status: 'pending', note: 'Chờ rà soát dữ liệu cá nhân trong bản án' },
    { id: 'src-news', name: 'Báo chí, website doanh nghiệp', kind: 'crawl', owner: 'Nhiều đơn vị', dataFields: 'Sự kiện, chứng nhận', legalBasis: 'Theo robots.txt và điều khoản từng trang', personalData: false, rateLimit: 'Theo robots.txt', status: 'pending', note: 'Chỉ trang cho phép' },
    { id: 'src-acc', name: 'Kết nối phần mềm kế toán', kind: 'accounting', owner: 'Doanh nghiệp (ủy quyền)', dataFields: 'Công nợ, số dư tiền, BCTC', legalBasis: 'Đồng ý của doanh nghiệp', personalData: false, rateLimit: '—', status: 'approved', note: 'Chỉ đọc' },
    { id: 'src-upload', name: 'Doanh nghiệp tải lên (BCTC, CIC, chứng từ ESG)', kind: 'upload', owner: 'Doanh nghiệp', dataFields: 'Tài liệu', legalBasis: 'Đồng ý của doanh nghiệp', personalData: true, rateLimit: '—', status: 'approved', note: 'AI trích xuất, người xác nhận' },
  ]

  const ext = (orgId: string, sourceId: string, field: string, value: string, daysAgo: number): ExternalRecord => ({ id: `ex-${orgId}-${field}`.replace(/\s/g, ''), orgId, sourceId, field, value, fetchedAt: new Date(base.getTime() - daysAgo * DAY).toISOString(), url: `https://nguon-cong-khai.example/${sourceId}?mst=${ORGS.find((o) => o.id === orgId)!.taxCode}`, contentHash: `sha256:${(orgId + field).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0')}…` })
  const external: ExternalRecord[] = [
    ext('s1', 'src-dkkd', 'Tình trạng pháp lý', 'Đang hoạt động', 4), ext('s1', 'src-dkkd', 'Ngày thành lập', '14/03/2014', 4), ext('s1', 'src-tax', 'Trạng thái MST', 'NNT đang hoạt động (đã được cấp MST)', 4), ext('s1', 'src-bid', 'Lịch sử thầu', '3 gói trúng thầu (gia công kết cấu thép) trong 24 tháng', 9),
    ext('s2', 'src-dkkd', 'Tình trạng pháp lý', 'Đang hoạt động', 6), ext('s2', 'src-tax', 'Trạng thái MST', 'NNT đang hoạt động', 6), ext('s2', 'src-court', 'Sự kiện pháp lý', 'Quyết định xử phạt hành chính về PCCC (đã khắc phục)', 20),
    ext('s3', 'src-dkkd', 'Tình trạng pháp lý', 'Đang hoạt động', 3), ext('s3', 'src-tax', 'Trạng thái MST', 'NNT đang hoạt động', 3),
    ext('s4', 'src-dkkd', 'Tình trạng pháp lý', 'Đang hoạt động', 2), ext('s4', 'src-tax', 'Trạng thái MST', 'NNT đang hoạt động', 2),
  ]

  const consents: Consent[] = [
    { id: 'CS-1', ownerId: 's1', recipientId: 'l1', purpose: 'Thẩm định tài trợ khoản phải thu', scopes: ['credit_score', 'esg', 'documents', 'accounting'], grantedAt: d(-40), expiresAt: d(325) },
    { id: 'CS-2', ownerId: 's1', recipientId: 'b1', purpose: 'ESG chuỗi cung ứng', scopes: ['esg'], grantedAt: d(-20), expiresAt: d(345) },
    { id: 'CS-3', ownerId: 's1', recipientId: 'b2', purpose: 'ESG chuỗi cung ứng', scopes: ['esg'], grantedAt: d(-20), expiresAt: d(345) },
    { id: 'CS-4', ownerId: 's2', recipientId: 'l1', purpose: 'Thẩm định tài trợ khoản phải thu', scopes: ['credit_score', 'esg', 'documents'], grantedAt: d(-3), expiresAt: d(87) },
    { id: 'CS-5', ownerId: 's2', recipientId: 'b1', purpose: 'ESG chuỗi cung ứng', scopes: ['esg'], grantedAt: d(-30), expiresAt: d(335) },
    { id: 'CS-6', ownerId: 's3', recipientId: 'b3', purpose: 'ESG chuỗi cung ứng', scopes: ['esg'], grantedAt: d(-60), expiresAt: d(305) },
    { id: 'CS-7', ownerId: 's3', recipientId: 'l4', purpose: 'Thẩm định tài trợ khoản phải thu', scopes: ['credit_score', 'esg', 'documents'], grantedAt: d(-90), expiresAt: d(275) },
    { id: 'CS-8', ownerId: 's1', recipientId: 'l2', purpose: 'Thẩm định tài trợ khoản phải thu', scopes: ['credit_score', 'documents'], grantedAt: d(-100), expiresAt: d(-10), revokedAt: d(-10) },
  ]

  const notifications: Notification[] = [
    { id: 'N1', orgId: 's1', at: d(-1), title: 'Có 2 báo giá mới cho INV-002', body: 'NH Hồng Lam và TC Ánh Dương đã phản hồi yêu cầu báo giá RFQ-001.', link: '/marketplace?tab=rfq', read: false },
    { id: 'N2', orgId: 'b1', at: d(-4), title: 'Yêu cầu xác nhận khoản phải trả', body: 'Cơ khí Minh Tâm đề nghị xác nhận INV-003 (690 tr ₫).', link: '/invoices', read: false },
    { id: 'N3', orgId: 'l1', at: d(-3), title: 'Hồ sơ mới cần thẩm định', body: 'APP-003 — VLXD Phú Gia, khoản phải thu 890 tr ₫ từ An Phát Hưng.', link: '/invoices', read: false },
    { id: 'N4', orgId: 'l4', at: d(-1), title: 'Hồ sơ mới', body: 'APP-004 — Giấy Hưng Thịnh, 455 tr ₫.', link: '/invoices', read: false },
  ]

  return { seededAt: base.toISOString(), orgs: ORGS, profiles, listed, receivables, products, rfqs, applications, earlyOffers, limits, esg, connections, ledger, sources, external, consents, notifications }
}
