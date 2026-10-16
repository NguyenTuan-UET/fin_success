// Kiểu dữ liệu nghiệp vụ FCC (xem document/SPEC_FCC_MVP.md mục 12).
// Tiền luôn là số nguyên VND.

export type OrgType = 'buyer' | 'supplier' | 'lender' | 'fcc'
export type IndustryGroup = 'manufacturing' | 'trade' | 'agri' | 'tech'
export type DataStatus = 'self_declared' | 'extracted' | 'verified' | 'public_reference'

export interface Org {
  id: string
  name: string
  shortName: string
  taxCode: string
  type: OrgType
  vsic: string
  industryLabel: string
  industryGroup: IndustryGroup
  listedSymbol?: string
  exchange?: 'HOSE' | 'HNX' | 'UPCOM'
  foundedYear: number
  employees: number
  province: string
  createdAt: string
  /** Tổ chức tài chính chỉ được công bố sản phẩm sau khi FCC xác minh pháp nhân/giấy phép */
  verified?: boolean
  /** Xác minh danh tính người đại diện (eKYC qua nhà cung cấp, hoặc FCC đối chiếu giấy tờ) */
  kyc?: OrgKyc
}

export interface OrgKyc {
  status: 'pending' | 'verified' | 'rejected'
  method: 'manual_documents' | 'ekyc_provider'
  provider?: string
  representativeName: string
  /** Khóa đối tượng (SHA-256) của giấy tờ đã tải lên kho tệp */
  documentKeys: string[]
  submittedAt: string
  submittedBy: string
  decidedAt?: string
  decidedBy?: string
  note?: string
}

/** Bằng chứng ký khi doanh nghiệp đồng ý chia sẻ dữ liệu hoặc chấp thuận đề nghị. */
export interface SignatureEvidence {
  /** digital_signature: ký số từ xa qua nhà cung cấp chứng thực; mfa_snapshot: xác thực MFA + băm nội dung đã đồng ý */
  method: 'digital_signature' | 'mfa_snapshot' | 'dev_session'
  provider?: string
  /** SHA-256 của nội dung đã ký (chuẩn hóa) */
  contentSha256: string
  userId: string
  signedAt: string
  certificateSerial?: string
}

export interface FinancialYear {
  year: number
  revenue: number
  netProfit: number
  ebit: number
  interestExpense: number
  depreciation: number
  totalAssets: number
  currentAssets: number
  currentLiabilities: number
  totalLiabilities: number
  equity: number
  operatingCashFlow: number
  debtService: number // gốc + lãi phải trả trong năm
  cash: number
  inventory: number
  receivables: number
  source: string
  status: DataStatus
}

export interface CicReport {
  worstDebtGroup: 1 | 2 | 3 | 4 | 5
  maxLateDays: number
  months: number
  source: string
}

export interface CollateralItem {
  id: string
  kind: 'realestate' | 'machinery' | 'inventory'
  description: string
  declaredValue: number
}

/** Hồ sơ đầu vào chấm điểm cho một doanh nghiệp (chủ yếu bên bán/bên mua chưa niêm yết). */
export interface CreditProfile {
  orgId: string
  financials: FinancialYear[]
  cic?: CicReport
  taxStatus?: 'active' | 'deferred' | 'enforced' | 'ceased'
  legalEvents?: 'none' | 'minor_resolved' | 'major'
  capitalNeed?: number
  ownContribution?: number
  collateral: CollateralItem[]
  frameworkContractMonths?: number
  topCustomerShare?: number // 0..1
  topCustomerId?: string
  dsoDays?: number
  contractTermDays?: number
  einvoiceRevenue?: number
  vatDeclaredRevenue?: number
}

/** Snapshot dữ liệu thị trường của bên mua niêm yết, cùng cấu trúc với dữ liệu lấy qua vnstock. */
export interface ListedSnapshot {
  orgId: string
  symbol: string
  exchange: string
  provider: string
  fetchedAt: string
  marketCap: number
  volatility90d: number // độ lệch chuẩn lợi suất ngày, năm hóa (0..1)
  auditOpinion: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer'
  tradingStatus: 'normal' | 'warning' | 'controlled' | 'restricted'
  quarters: { period: string; revenue: number; netProfit: number; operatingCashFlow: number }[]
  priceHistory: { date: string; close: number }[]
  events: { date: string; title: string }[]
}

// ---------------- Hóa đơn / khoản phải thu ----------------

export type ReceivableState =
  | 'DRAFT'
  | 'BUYER_PENDING'
  | 'BUYER_CONFIRMED'
  | 'BUYER_DISPUTED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'FUNDED'
  | 'SETTLED'
  | 'EARLY_PAID'
  | 'REJECTED'
  | 'OVERDUE'
  | 'CANCELLED'

export interface Receivable {
  id: string
  code: string
  sellerId: string
  buyerId: string
  invoiceSeries: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  amount: number
  description: string
  state: ReceivableState
  version: number
  fingerprint: string
  docs: { xml: boolean; contract: boolean; delivery: boolean }
  source: 'xml' | 'ocr' | 'manual' | 'accounting'
  disputeReason?: string
  confirmedAt?: string
  paidAt?: string
  paidAmount?: number
  dilution?: number // tỷ lệ điều chỉnh giảm/hàng trả lại 0..1
  createdAt: string
}

// ---------------- Marketplace ----------------

export type ProductType = 'factoring_recourse' | 'factoring_nonrecourse' | 'invoice_finance' | 'reverse_factoring' | 'green_loan'
export type Rating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC'

export interface Fee {
  name: string
  kind: 'fixed' | 'pct'
  value: number // VND hoặc % trên số tiền ứng
  upfront: boolean
}

export interface FinancingProduct {
  id: string
  lenderId: string
  name: string
  type: ProductType
  description: string
  eligibility: {
    industryGroups?: IndustryGroup[]
    minAmount: number
    maxAmount: number
    maxTenorDays: number
    minSupplierRating?: Rating
    minBuyerRating?: Rating
    minApplicationRating?: Rating
    minEsg?: number
    requireBuyerConfirmation: boolean
    buyerWhitelist?: string[]
  }
  pricing: { advancePct: number; rateMin: number; rateMax: number; fees: Fee[]; latePenaltyPct: number }
  greenRule?: { minEsg: number; minCoverage: number; discountPct: number }
  sla: { quoteHours?: number; reviewHours?: number }
  status: 'draft' | 'pending_review' | 'published' | 'paused' | 'expired'
  version: number
  effectiveFrom: string
  effectiveTo: string
  /** FCC đã duyệt nội dung sản phẩm; sửa sản phẩm sẽ phải duyệt lại */
  fccApproved?: boolean
}

export interface RfqResponse {
  lenderId: string
  productId: string
  kind: 'quote' | 'decline'
  advancePct?: number
  ratePct?: number
  feesVnd?: number
  conditions?: string
  validUntil?: string
  respondedAt: string
}

export interface Rfq {
  id: string
  receivableId: string
  sellerId: string
  productIds: string[]
  state: 'OPEN' | 'RESPONDED' | 'SELECTED' | 'EXPIRED' | 'CANCELLED'
  createdAt: string
  expiresAt: string
  responses: RfqResponse[]
  selectedLenderId?: string
}

export interface FundingApplication {
  id: string
  receivableId: string
  lenderId: string
  productId: string
  rfqId?: string
  state: 'SUBMITTED' | 'UNDER_REVIEW' | 'OFFERED' | 'ACCEPTED' | 'FUNDED' | 'SETTLED' | 'REJECTED' | 'WITHDRAWN'
  offer?: { advanceVnd: number; ratePct: number; feesVnd: number; tenorDays: number; conditions: string; expiresAt: string }
  fundedAt?: string
  fundedAmount?: number
  settledAt?: string
  submittedAt: string
  decidedAt?: string
}

export interface EarlyPaymentOffer {
  id: string
  buyerId: string
  receivableId: string
  discountPct: number // % trên giá trị hóa đơn
  payBy: string
  state: 'OPEN' | 'ACCEPTED' | 'PAID' | 'EXPIRED' | 'CANCELLED'
  createdAt: string
}

export interface CreditLimit {
  id: string
  lenderId: string
  borrowerId: string
  amount: number
  validUntil: string
}

// ---------------- ESG ----------------

export type EsgIssue = 'E_RES' | 'E_ENV' | 'S_LAB' | 'S_CUS' | 'G_TRA' | 'G_CTL'
export type IndicatorLevel = 0 | 1 | 2 | 3 | 4

export interface EsgIndicatorResult {
  code: string
  aiLevel?: IndicatorLevel
  aiRationale?: string
  aiCitations?: { documentId: string; note: string }[]
  aiMissing?: string[]
  finalLevel?: IndicatorLevel // undefined = chưa xác minh
  na?: boolean
  naReason?: string
  reviewerNote?: string
  redFlag?: boolean
  selfDeclared?: string
}

export interface EsgDocument {
  id: string
  name: string
  mime: string
  dataUrl?: string // ảnh xem trước (chỉ lưu khi nhỏ)
  docType: string
  period?: string
  indicatorCodes: string[]
  extracted?: Record<string, string | number>
  extractionSummary?: string
  uploadedAt: string
}

export interface EsgAssessment {
  id: string
  orgId: string
  industryGroup: IndustryGroup
  period: string
  status: 'draft' | 'in_review' | 'official' | 'provisional'
  indicators: EsgIndicatorResult[]
  documents: EsgDocument[]
  metrics: { kwh12m?: number; waterM3_12m?: number; solarKwh12m?: number; bhxhCovered?: number; employees?: number }
  issuedAt?: string
  validUntil?: string
  source: 'assessed' | 'disclosure'
}

// ---------------- Kế toán & dòng tiền ----------------

export interface LedgerItem {
  id: string
  orgId: string
  kind: 'AR' | 'AP'
  counterpartyName: string
  counterpartyTaxCode?: string
  docNo: string
  amount: number
  paid: number
  dueDate: string
}

export interface AccountingConnection {
  orgId: string
  provider: 'CSV'
  method: 'file'
  status: 'connected' | 'disconnected'
  lastSyncedAt: string
  openingCash: number
  recurringMonthlyOut: { name: string; amount: number; day: number }[]
  /** Thu từ đơn hàng mới ngoài AR hiện có (bình quân lịch sử) — chỉ tính từ ngày `fromDay` */
  recurringMonthlyIn?: { name: string; amount: number; day: number; fromDay: number }[]
  buyerDelayDays: Record<string, { median: number; p80: number }>
}

// ---------------- Dữ liệu ngoài ----------------

export interface DataSource {
  id: string
  name: string
  kind: 'vnstock' | 'crawl' | 'api' | 'upload' | 'accounting'
  owner: string
  dataFields: string
  legalBasis: string
  personalData: boolean
  rateLimit: string
  status: 'approved' | 'pending' | 'blocked'
  note: string
}

export interface ExternalRecord {
  id: string
  orgId: string
  sourceId: string
  field: string
  value: string
  fetchedAt: string
  url: string
  contentHash: string
  disputed?: boolean
}

// ---------------- Chung ----------------

export interface Consent {
  id: string
  ownerId: string
  recipientId: string
  purpose: string
  scopes: ('credit_score' | 'esg' | 'documents' | 'accounting')[]
  grantedAt: string
  expiresAt: string
  revokedAt?: string
  signature?: SignatureEvidence
}

export interface AuditEvent {
  id: string
  at: string
  actorOrgId: string
  /** Người dùng thực hiện (không có với tác vụ hệ thống, webhook) */
  actorUserId?: string
  action: string
  entity: string
  detail: string
  /** Mã truy vết yêu cầu, nối nhật ký với log máy chủ */
  correlationId?: string
}

export interface Notification {
  id: string
  orgId: string
  at: string
  title: string
  body: string
  link?: string
  read: boolean
}

// ---------------- Dữ liệu ứng dụng ----------------

/** Toàn bộ bộ sưu tập dữ liệu nghiệp vụ (máy chủ giữ bản đầy đủ; trình duyệt nhận bản đã lọc theo quyền). */
export interface AppData {
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
