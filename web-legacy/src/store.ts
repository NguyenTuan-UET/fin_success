// Trạng thái phía trình duyệt: bản sao (đã lọc theo quyền) của dữ liệu trên máy chủ FCC.
// Mọi thao tác nghiệp vụ gọi POST /api/actions/:name; máy chủ kiểm tra quyền/trạng thái rồi trả lại dữ liệu mới.
import { create } from 'zustand'
import { api, ApiError, getToken, setToken } from './lib/api'
import type {
  AppData, AuditEvent, CreditProfile, EarlyPaymentOffer, EsgAssessment, EsgDocument, EsgIndicatorResult, FinancialYear,
  FinancingProduct, FundingApplication, LedgerItem, Org, Receivable, Rfq, RfqResponse,
} from './domain/types'
import type { Me } from './lib/api'

type ServerState = AppData & { audit: AuditEvent[] }
type Snapshot = { version: number; me: Me; state: ServerState }

interface State extends AppData {
  audit: AuditEvent[]
  me: Me | null
  /** đã có phiên và tải dữ liệu từ máy chủ */
  ready: boolean
  /** đã kiểm tra phiên đã lưu (để biết nên hiện trang chọn vai trò chưa) */
  checked: boolean
  error: string | null
  version: number
}

interface Actions {
  boot: () => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
  logout: () => Promise<void>
  updateOrg: (patch: Partial<Pick<Org, 'name' | 'shortName' | 'vsic' | 'industryLabel' | 'industryGroup' | 'province' | 'foundedYear' | 'employees' | 'listedSymbol' | 'exchange'>>) => Promise<void>
  markNotificationsRead: () => Promise<void>

  createReceivable: (r: Omit<Receivable, 'id' | 'code' | 'version' | 'createdAt' | 'state' | 'sellerId'>) => Promise<Receivable>
  sendToBuyer: (id: string) => Promise<void>
  /** Xác nhận cần nhập lại mật khẩu */
  buyerDecision: (id: string, confirm: boolean, reason?: string, password?: string) => Promise<void>
  reviseDisputed: (id: string, amount: number, note: string) => Promise<void>
  cancelReceivable: (id: string) => Promise<void>
  markBuyerPaid: (id: string) => Promise<void>

  createRfq: (receivableId: string, productIds: string[]) => Promise<Rfq>
  respondRfq: (rfqId: string, resp: Omit<RfqResponse, 'lenderId' | 'respondedAt'>) => Promise<void>
  selectQuote: (rfqId: string, lenderId: string) => Promise<void>
  cancelRfq: (rfqId: string) => Promise<void>
  submitDirect: (receivableId: string, productId: string) => Promise<void>

  startReview: (appId: string) => Promise<void>
  makeOffer: (appId: string, offer: NonNullable<FundingApplication['offer']>) => Promise<void>
  rejectApp: (appId: string, reason: string) => Promise<void>
  acceptOffer: (appId: string, password?: string) => Promise<void>
  fundApp: (appId: string) => Promise<void>

  upsertProduct: (p: Partial<FinancingProduct>) => Promise<void>
  setProductStatus: (id: string, status: FinancingProduct['status']) => Promise<void>
  approveProduct: (id: string, approve: boolean, note?: string) => Promise<void>
  verifyOrg: (orgId: string, verified: boolean) => Promise<void>

  createEarlyOffer: (o: Omit<EarlyPaymentOffer, 'id' | 'createdAt' | 'state'>) => Promise<void>
  acceptEarlyOffer: (id: string) => Promise<void>
  payEarlyOffer: (id: string) => Promise<void>

  ensureEsg: (orgId: string) => Promise<EsgAssessment>
  updateIndicator: (assessmentId: string, code: string, patch: Partial<EsgIndicatorResult>) => Promise<void>
  addEsgDocument: (assessmentId: string, doc: EsgDocument) => Promise<void>
  updateEsgMetrics: (assessmentId: string, m: Partial<EsgAssessment['metrics']>) => Promise<void>
  issueEsg: (assessmentId: string, official: boolean) => Promise<void>
  setEsgIndustry: (assessmentId: string, g: EsgAssessment['industryGroup']) => Promise<void>

  refreshListed: (symbol: string) => Promise<void>
  upsertFinancialYear: (orgId: string, fy: FinancialYear) => Promise<void>
  updateProfile: (orgId: string, patch: Partial<CreditProfile>) => Promise<void>

  saveCashProfile: (orgId: string, input: { openingCash: number; recurringMonthlyOut: { name: string; amount: number; day: number }[] }) => Promise<void>
  importLedger: (orgId: string, items: LedgerItem[]) => Promise<void>

  revokeConsent: (id: string) => Promise<void>
}

/** Mỗi vai trò có một trang riêng (/supplier, /buyer, /lender, /fcc) tự vào phiên của vai trò đó. */
export const SESSION_ROLES = ['supplier', 'buyer', 'lender', 'fcc'] as const

const empty = (): AppData => ({
  orgs: [], profiles: [], listed: [], receivables: [], products: [], rfqs: [], applications: [], earlyOffers: [], limits: [],
  esg: [], connections: [], ledger: [], sources: [], external: [], consents: [], notifications: [],
})

export const useStore = create<State & Actions>()((set, get) => {
  const apply = (r: Snapshot) => set({ ...r.state, me: r.me, version: r.version, ready: true, checked: true })
  const fail = (e: unknown) => {
    set({ error: e instanceof Error ? e.message : String(e) })
    return e
  }

  /** Gọi một hành động nghiệp vụ; lỗi được đặt vào `error` rồi ném lại cho nơi gọi. */
  async function call<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
    try {
      const r = await api<Snapshot & { result: T }>(`/actions/${name}`, { method: 'POST', body: { args } })
      apply(r)
      return r.result
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && /phiên|đăng nhập/i.test(e.message)) {
        setToken(null)
        set({ ...empty(), me: null, ready: false, checked: true, audit: [] })
        void get().boot()
      }
      throw fail(e)
    }
  }
  /** Như `call` nhưng không ném lỗi — lỗi hiện ở banner. */
  const fire = (name: string, ...args: unknown[]) => call(name, ...args).then(() => undefined, () => undefined)

  let polling: ReturnType<typeof setInterval> | null = null
  const startPolling = () => {
    if (polling) return
    // đồng bộ thay đổi do tổ chức khác tạo (thông báo, báo giá, hồ sơ…) — chỉ tải lại khi máy chủ báo có thay đổi
    polling = setInterval(() => {
      if (document.visibilityState === 'visible' && get().ready) void get().refresh()
    }, 4000)
    // quay lại tab sau một lúc thì cập nhật ngay
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && get().ready) void get().refresh()
    })
  }
  const enter = (r: Snapshot & { token: string }) => {
    setToken(r.token)
    apply(r)
    set({ error: null })
    startPolling()
  }

  return {
    ...empty(),
    audit: [],
    me: null,
    ready: false,
    checked: false,
    error: null,
    version: 0,

    boot: async () => {
      const role = SESSION_ROLES.find((r) => location.pathname.split('/')[1] === r)
      if (role) {
        try {
          enter(await api('/dev/session', { method: 'POST', body: { role } }))
        } catch (e) {
          fail(e)
        }
        return
      }
      if (!getToken()) return set({ checked: true })
      try {
        apply(await api<Snapshot>('/state'))
        set({ error: null })
        startPolling()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setToken(null)
          set({ checked: true })
        } else fail(e)
      }
    },
    refresh: async () => {
      try {
        const r = await api<Snapshot & { unchanged?: boolean }>(`/state?since=${get().version}`)
        if (!r.unchanged) apply(r)
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setToken(null)
          set({ ...empty(), me: null, ready: false, audit: [] })
          void get().boot()
        }
        /* mất kết nối tạm thời: giữ dữ liệu hiện có, lần sau thử lại */
      }
    },
    clearError: () => set({ error: null }),
    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST' })
      } catch {
        /* phiên có thể đã hết hạn */
      }
      setToken(null)
      if (polling) clearInterval(polling)
      polling = null
      set({ ...empty(), audit: [], me: null, ready: false, error: null, version: 0 })
      if (location.pathname !== '/') location.assign('/')
    },
    updateOrg: (patch) => call('updateOrg', patch).then(() => undefined),
    markNotificationsRead: () => fire('markNotificationsRead'),

    createReceivable: (r) => call<Receivable>('createReceivable', r),
    sendToBuyer: (id) => fire('sendToBuyer', id),
    buyerDecision: (id, confirm, reason, password) => call('buyerDecision', id, confirm, reason, password).then(() => undefined),
    reviseDisputed: (id, amount, note) => fire('reviseDisputed', id, amount, note),
    cancelReceivable: (id) => fire('cancelReceivable', id),
    markBuyerPaid: (id) => fire('markBuyerPaid', id),

    createRfq: (receivableId, productIds) => call<Rfq>('createRfq', receivableId, productIds),
    respondRfq: (rfqId, resp) => fire('respondRfq', rfqId, resp),
    selectQuote: (rfqId, lenderId) => call('selectQuote', rfqId, lenderId).then(() => undefined),
    cancelRfq: (rfqId) => fire('cancelRfq', rfqId),
    submitDirect: (receivableId, productId) => call('submitDirect', receivableId, productId).then(() => undefined),

    startReview: (appId) => fire('startReview', appId),
    makeOffer: (appId, offer) => fire('makeOffer', appId, offer),
    rejectApp: (appId, reason) => fire('rejectApp', appId, reason),
    acceptOffer: (appId, password) => call('acceptOffer', appId, password).then(() => undefined),
    fundApp: (appId) => fire('fundApp', appId),

    upsertProduct: (p) => call('upsertProduct', p).then(() => undefined),
    setProductStatus: (id, status) => fire('setProductStatus', id, status),
    approveProduct: (id, approve, note) => fire('approveProduct', id, approve, note),
    verifyOrg: (orgId, verified) => fire('verifyOrg', orgId, verified),

    createEarlyOffer: (o) => fire('createEarlyOffer', o),
    acceptEarlyOffer: (id) => fire('acceptEarlyOffer', id),
    payEarlyOffer: (id) => fire('payEarlyOffer', id),

    ensureEsg: (orgId) => call<EsgAssessment>('ensureEsg', orgId),
    updateIndicator: (aid, code, patch) => fire('updateIndicator', aid, code, patch),
    addEsgDocument: (aid, doc) => fire('addEsgDocument', aid, doc),
    updateEsgMetrics: (aid, m) => fire('updateEsgMetrics', aid, m),
    issueEsg: (aid, official) => fire('issueEsg', aid, official),
    setEsgIndustry: (aid, g) => fire('setEsgIndustry', aid, g),

    refreshListed: (symbol) => call('refreshListed', symbol).then(() => undefined),
    upsertFinancialYear: (orgId, fy) => fire('upsertFinancialYear', orgId, fy),
    updateProfile: (orgId, patch) => fire('updateProfile', orgId, patch),

    saveCashProfile: (orgId, input) => fire('saveCashProfile', orgId, input),
    importLedger: (orgId, items) => fire('importLedger', orgId, items),

    revokeConsent: (id) => fire('revokeConsent', id),
  }
})

export const useActiveOrg = () => {
  const id = useStore((s) => s.me?.orgId)
  const orgs = useStore((s) => s.orgs)
  return orgs.find((o) => o.id === id)!
}
