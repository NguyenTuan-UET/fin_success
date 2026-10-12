// Máy khách HTTP tới backend FCC (/api). Token phiên lưu ở sessionStorage của tab — mỗi tab có thể đăng nhập một tổ chức khác.
const KEY = 'fcc-session'

export interface Session {
  token: string
  orgId: string
  role: 'member' | 'fcc_reviewer'
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const getSession = (): Session | null => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}
export const setSession = (s: Session | null) => (s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY))

export function authHeaders(): Record<string, string> {
  const s = getSession()
  return s ? { Authorization: `Bearer ${s.token}` } : {}
}

export async function api<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      headers: { ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ FCC (đã chạy `npm run dev` trong thư mục server chưa?)')
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* không phải JSON */
  }
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string } | null)?.error ?? `Lỗi HTTP ${res.status}`)
  return json as T
}

export async function demoLogin(orgId: string, reviewer = false): Promise<Session> {
  const r = await api<Session>('/auth/demo-login', { method: 'POST', body: { orgId, reviewer } })
  setSession(r)
  return r
}

export interface OtpChallenge {
  otpId: string
  expiresInSec: number
  /** Chỉ có ở chế độ demo (chưa nối kênh SMS/email) */
  demoCode?: string
}
export const requestOtp = (purpose: 'buyer_confirm' | 'accept_offer', entity: string) => api<OtpChallenge>('/otp', { method: 'POST', body: { purpose, entity } })
