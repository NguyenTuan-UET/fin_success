// Máy khách HTTP tới backend FCC (/api). Token phiên lưu ở sessionStorage của tab.
const KEY = 'fcc-token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface Me {
  id: string
  email: string
  name: string
  title: string
  role: 'member' | 'fcc_reviewer'
  orgId: string
}

export const getToken = () => sessionStorage.getItem(KEY)
export const setToken = (t: string | null) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY))

export function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
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
    throw new ApiError(0, 'Không kết nối được máy chủ FCC (đã chạy backend trong thư mục server chưa?)')
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
