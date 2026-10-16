// Máy khách HTTP tới backend FCC. Trình duyệt gọi /api và /v1 cùng nguồn (Next chuyển tiếp tới server/).
// Token phiên lưu ở sessionStorage của tab — mỗi tab một phiên, mở nhiều vai trò ở nhiều tab được.

const KEY = "fcc-token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public mfaRequired = false,
  ) {
    super(message);
  }
  /** Máy chủ yêu cầu xác thực MFA lại (hoặc bật MFA) cho thao tác này. */
  get needsMfa() {
    return this.mfaRequired || ((this.status === 401 || this.status === 403) && /MFA/.test(this.message));
  }
}

export const getToken = () => (typeof window === "undefined" ? null : sessionStorage.getItem(KEY));
export const setToken = (t: string | null) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

export async function api<T = unknown>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  opts: { idempotencyKey?: string; token?: string | null } = {},
): Promise<T> {
  const token = opts.token === undefined ? getToken() : opts.token;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(opts.idempotencyKey ? { "idempotency-key": opts.idempotencyKey } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ FCC. Kiểm tra kết nối mạng hoặc máy chủ (thư mục server/).");
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* không phải JSON */
  }
  if (!res.ok) {
    const j = (json ?? {}) as { error?: string; mfaRequired?: boolean };
    throw new ApiError(res.status, j.error ?? `Lỗi HTTP ${res.status}`, !!j.mfaRequired);
  }
  return json as T;
}

export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Đọc tệp thành base64 (không tiền tố data:) để tải lên /api/files. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
