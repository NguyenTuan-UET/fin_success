// Trạng thái phía trình duyệt: bản sao (đã lọc theo quyền) của dữ liệu trên máy chủ FCC.
// Mọi thao tác nghiệp vụ gọi POST /api/actions/:name; máy chủ kiểm tra quyền/trạng thái rồi trả lại dữ liệu mới.
import { create } from 'zustand'
import type { SeedData } from './data/seed'
import { api, ApiError, demoLogin, getSession, setSession } from './lib/api'
import type {
  AccountingConnection, AuditEvent, Consent, CreditProfile, EarlyPaymentOffer, EsgAssessment, EsgDocument, EsgIndicatorResult,
  FinancialYear, FinancingProduct, FundingApplication, LedgerItem, Receivable, Rfq, RfqResponse,
} from './domain/types'
import type { OtpChallenge } from './lib/api'

export type AiMode = 'auto' | 'simulate'
export type Role = 'member' | 'fcc_reviewer'

type ServerState = SeedData & { activeOrgId: string; audit: AuditEvent[] }

interface State extends SeedData {
  activeOrgId: string
  audit: AuditEvent[]
  aiMode: AiMode
  /** đã tải dữ liệu lần đầu từ máy chủ */
  ready: boolean
  /** lỗi gần nhất (hiển thị ở banner) */
  error: string | null
  role: Role
  version: number
}

interface Actions {
  boot: () => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
  setActiveOrg: (id: string) => Promise<void>
  setReviewer: (on: boolean) => Promise<void>
  setAiMode: (m: AiMode) => void
  resetDemo: () => Promise<void>
  markNotificationsRead: (orgId: string) => Promise<void>

  createReceivable: (r: Omit<Receivable, 'id' | 'code' | 'version' | 'createdAt' | 'state' | 'sellerId'>) => Promise<Receivable>
  sendToBuyer: (id: string) => Promise<void>
  buyerDecision: (id: string, confirm: boolean, reason?: string, otp?: { id: string; code: string }) => Promise<void>
  reviseDisputed: (id: string, amount: number, note: string) => Promise<void>
  cancelReceivable: (id: string) => Promise<void>
  markBuyerPaid: (id: string) => Promise<void>

  createRfq: (receivableId: string, productIds: string[]) => Promise<Rfq>
  respondRfq: (rfqId: string, resp: Omit<RfqResponse, 'lenderId' | 'respondedAt' | 'simulated'>) => Promise<void>
  simulateRfqResponses: (rfqId: string) => Promise<void>
  selectQuote: (rfqId: string, lenderId: string) => Promise<void>
  cancelRfq: (rfqId: string) => Promise<void>
  submitDirect: (receivableId: string, productId: string) => Promise<void>

  startReview: (appId: string) => Promise<void>
  makeOffer: (appId: string, offer: NonNullable<FundingApplication['offer']>) => Promise<void>
  rejectApp: (appId: string, reason: string) => Promise<void>
  acceptOffer: (appId: string, otp?: { id: string; code: string }) => Promise<void>
  fundApp: (appId: string) => Promise<void>

  upsertProduct: (p: FinancingProduct) => Promise<void>
  setProductStatus: (id: string, status: FinancingProduct['status']) => Promise<void>

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

  connectAccounting: (orgId: string, provider: AccountingConnection['provider'], method: AccountingConnection['method']) => Promise<void>
  disconnectAccounting: (orgId: string) => Promise<void>
  syncAccounting: (orgId: string) => Promise<void>
  importLedger: (orgId: string, items: LedgerItem[]) => Promise<void>

  revokeConsent: (id: string) => Promise<void>
  refreshExternal: (orgId: string) => Promise<void>
  disputeExternal: (id: string) => Promise<void>
}

const AI_KEY = 'fcc-ai-mode'
const initialAi = (): AiMode => (localStorage.getItem(AI_KEY) === 'simulate' ? 'simulate' : 'auto')

const empty = (): SeedData => ({
  seededAt: '', orgs: [], profiles: [], listed: [], receivables: [], products: [], rfqs: [], applications: [], earlyOffers: [], limits: [],
  esg: [], connections: [], ledger: [], sources: [], external: [], consents: [], notifications: [],
})

export const useStore = create<State & Actions>()((set, get) => {
  const apply = (server: ServerState, version: number, role?: Role) => set({ ...server, version, ...(role ? { role } : {}), ready: true })
  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    set({ error: msg })
    return e
  }

  /** Gọi một hành động nghiệp vụ; lỗi được đặt vào `error` rồi ném lại cho nơi gọi. */
  async function call<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
    try {
      const r = await api<{ result: T; version: number; state: ServerState }>(`/actions/${name}`, { method: 'POST', body: { args } })
      apply(r.state, r.version)
      return r.result
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && /phiên|đăng nhập/i.test(e.message)) {
        setSession(null)
        void get().boot()
      }
      throw fail(e)
    }
  }
  /** Như `call` nhưng không ném lỗi — dùng cho nút bấm không tự xử lý lỗi (lỗi hiện ở banner). */
  const fire = (name: string, ...args: unknown[]) => call(name, ...args).then(() => undefined, () => undefined)

  let polling: ReturnType<typeof setInterval> | null = null

  return {
    ...empty(),
    activeOrgId: '',
    audit: [],
    aiMode: initialAi(),
    ready: false,
    error: null,
    role: 'member',
    version: 0,

    boot: async () => {
      try {
        let s = getSession()
        if (!s) s = await demoLogin('s1')
        try {
          const r = await api<{ version: number; role: Role; state: ServerState }>('/state')
          apply(r.state, r.version, r.role)
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 401)) throw e
          await demoLogin(s.orgId)
          const r = await api<{ version: number; role: Role; state: ServerState }>('/state')
          apply(r.state, r.version, r.role)
        }
        set({ error: null })
        if (!polling) {
          // đồng bộ thay đổi do tổ chức khác tạo (thông báo, báo giá, hồ sơ…) — chỉ tải lại khi máy chủ báo có thay đổi
          polling = setInterval(() => {
            if (document.visibilityState === 'visible') void get().refresh()
          }, 4000)
        }
      } catch (e) {
        fail(e)
      }
    },
    refresh: async () => {
      try {
        const r = await api<{ version: number; unchanged?: boolean; role?: Role; state?: ServerState }>(`/state?since=${get().version}`)
        if (!r.unchanged && r.state) apply(r.state, r.version, r.role)
      } catch {
        /* mất kết nối tạm thời: giữ dữ liệu hiện có, lần sau thử lại */
      }
    },
    clearError: () => set({ error: null }),
    setActiveOrg: async (id) => {
      try {
        await demoLogin(id)
        const r = await api<{ version: number; role: Role; state: ServerState }>('/state')
        apply(r.state, r.version, r.role)
        set({ error: null })
      } catch (e) {
        fail(e)
      }
    },
    setReviewer: async (on) => {
      try {
        await demoLogin(get().activeOrgId, on)
        const r = await api<{ version: number; role: Role; state: ServerState }>('/state')
        apply(r.state, r.version, r.role)
      } catch (e) {
        fail(e)
      }
    },
    setAiMode: (m) => {
      localStorage.setItem(AI_KEY, m)
      set({ aiMode: m })
    },
    resetDemo: async () => {
      try {
        const r = await api<{ version: number; state: ServerState }>('/admin/reset', { method: 'POST' })
        apply(r.state, r.version)
      } catch (e) {
        fail(e)
      }
    },
    markNotificationsRead: () => fire('markNotificationsRead'),

    createReceivable: (r) => call<Receivable>('createReceivable', r),
    sendToBuyer: (id) => fire('sendToBuyer', id),
    buyerDecision: (id, confirm, reason, otp) => fire('buyerDecision', id, confirm, reason, otp),
    reviseDisputed: (id, amount, note) => fire('reviseDisputed', id, amount, note),
    cancelReceivable: (id) => fire('cancelReceivable', id),
    markBuyerPaid: (id) => fire('markBuyerPaid', id),

    createRfq: (receivableId, productIds) => call<Rfq>('createRfq', receivableId, productIds),
    respondRfq: (rfqId, resp) => fire('respondRfq', rfqId, resp),
    simulateRfqResponses: (rfqId) => fire('simulateRfqResponses', rfqId),
    selectQuote: (rfqId, lenderId) => call('selectQuote', rfqId, lenderId).then(() => undefined),
    cancelRfq: (rfqId) => fire('cancelRfq', rfqId),
    submitDirect: (receivableId, productId) => call('submitDirect', receivableId, productId).then(() => undefined),

    startReview: (appId) => fire('startReview', appId),
    makeOffer: (appId, offer) => fire('makeOffer', appId, offer),
    rejectApp: (appId, reason) => fire('rejectApp', appId, reason),
    acceptOffer: (appId, otp) => fire('acceptOffer', appId, otp),
    fundApp: (appId) => fire('fundApp', appId),

    upsertProduct: (p) => fire('upsertProduct', p),
    setProductStatus: (id, status) => fire('setProductStatus', id, status),

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

    connectAccounting: (orgId, provider, method) => fire('connectAccounting', orgId, provider, method),
    disconnectAccounting: (orgId) => fire('disconnectAccounting', orgId),
    syncAccounting: (orgId) => fire('syncAccounting', orgId),
    importLedger: (orgId, items) => fire('importLedger', orgId, items),

    revokeConsent: (id) => fire('revokeConsent', id),
    refreshExternal: (orgId) => fire('refreshExternal', orgId),
    disputeExternal: (id) => fire('disputeExternal', id),
  }
})

export const useActiveOrg = () => {
  const id = useStore((s) => s.activeOrgId)
  const orgs = useStore((s) => s.orgs)
  return orgs.find((o) => o.id === id)!
}

export type { OtpChallenge, Consent }
