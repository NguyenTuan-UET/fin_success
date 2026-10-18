"use client";

// Phiên và dữ liệu dùng chung cho mọi màn hình: tải /v1/state (đã lọc theo quyền), cập nhật tức thời qua SSE,
// gói các thao tác ghi (tự hỏi mã MFA khi máy chủ yêu cầu rồi thử lại).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppData, AuditEvent, Org } from "@fcc/domain/types";
import { api, ApiError, getToken, newIdempotencyKey, setToken } from "./api";

export type OrgType = Org["type"];
export interface Me {
  id: string;
  email: string;
  name: string;
  title: string;
  role: string;
  orgId: string;
  activeOrgId: string;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}
export interface MembershipView {
  orgId: string;
  orgName: string;
  orgType?: OrgType;
  role: string;
  roleLabel: string;
}
export type FccState = AppData & { audit: AuditEvent[] };
type Snapshot = { version: number; me: Me; state: FccState };
type Status = "loading" | "anon" | "ready" | "error";

interface Ctx {
  status: Status;
  error: string | null;
  me: Me | null;
  org: Org | null;
  memberships: MembershipView[];
  data: FccState | null;
  version: number;
  dev: boolean;
  /** Nạp lại dữ liệu (chỉ phần thay đổi theo version) */
  refresh: () => Promise<void>;
  /** Thao tác ghi qua /v1: tự hỏi MFA khi cần, thử lại một lần, rồi nạp lại dữ liệu */
  act: <T = unknown>(method: "POST" | "PUT", path: string, body?: unknown) => Promise<T>;
  login: (email: string, password: string, code?: string) => Promise<void>;
  enter: (r: { token: string } & Partial<Snapshot> & { memberships?: MembershipView[] }) => Promise<void>;
  devSession: (role: "supplier" | "buyer" | "lender" | "fcc") => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
}

const C = createContext<Ctx | null>(null);

export function useFcc() {
  const c = useContext(C);
  if (!c) throw new Error("useFcc phải nằm trong <FccProvider>");
  return c;
}

/** Dữ liệu đã sẵn sàng (dùng trong màn hình bên trong AppShell, nơi đã chặn trạng thái chưa đăng nhập). */
export function useData() {
  const c = useFcc();
  if (!c.data || !c.me || !c.org) throw new Error("Dữ liệu chưa sẵn sàng");
  return { ...c, data: c.data, me: c.me, org: c.org };
}

export function FccProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [data, setData] = useState<FccState | null>(null);
  const [memberships, setMemberships] = useState<MembershipView[]>([]);
  const [dev, setDev] = useState(false);
  const versionRef = useRef(0);
  const [version, setVersion] = useState(0);
  const [mfa, setMfa] = useState<null | { resolve: (ok: boolean) => void; message: string }>(null);

  const apply = useCallback((s: Snapshot) => {
    versionRef.current = s.version;
    setVersion(s.version);
    setMe(s.me);
    setData(s.state);
    setStatus("ready");
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      const r = await api<Snapshot & { unchanged?: boolean }>("GET", `/v1/state?since=${versionRef.current}`);
      if (!r.unchanged) apply(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        setStatus("anon");
      }
    }
  }, [apply]);

  const loadMemberships = useCallback(async () => {
    try {
      const r = await api<{ memberships: MembershipView[] }>("GET", "/api/auth/me");
      setMemberships(r.memberships);
    } catch {
      /* giữ danh sách cũ */
    }
  }, []);

  // khởi động: kiểm tra chế độ dev và phiên đã lưu
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const h = await api<{ dev: boolean }>("GET", "/api/health", undefined, { token: null });
        if (alive) setDev(h.dev);
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setStatus("error");
        }
        return;
      }
      if (!getToken()) return alive && setStatus("anon");
      try {
        const r = await api<Snapshot>("GET", "/v1/state");
        if (!alive) return;
        apply(r);
        void loadMemberships();
      } catch {
        setToken(null);
        if (alive) setStatus("anon");
      }
    })();
    return () => {
      alive = false;
    };
  }, [apply, loadMemberships]);

  // cập nhật tức thời: SSE với vé ngắn hạn; mất kết nối thì mở lại, đồng thời hỏi lại khi quay về tab
  useEffect(() => {
    if (status !== "ready") return;
    let es: EventSource | null = null;
    let stop = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = async () => {
      try {
        const t = await api<{ url: string }>("POST", "/v1/events/ticket", {});
        if (stop) return;
        es = new EventSource(t.url);
        es.addEventListener("change", () => void refresh());
        es.onerror = () => {
          es?.close();
          if (!stop) retry = setTimeout(open, 3000);
        };
      } catch {
        if (!stop) retry = setTimeout(open, 5000);
      }
    };
    void open();
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    // dự phòng khi proxy/CDN gom hoặc cắt luồng SSE: hỏi lại định kỳ (chỉ trả dữ liệu khi version đổi) lúc tab đang mở
    const poll = setInterval(() => document.visibilityState === "visible" && void refresh(), 5000);
    return () => {
      stop = true;
      es?.close();
      clearTimeout(retry);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [status, refresh]);

  const askMfa = (message: string) => new Promise<boolean>((resolve) => setMfa({ resolve, message }));

  const act = useCallback(
    async <T,>(method: "POST" | "PUT", path: string, body?: unknown): Promise<T> => {
      const key = newIdempotencyKey();
      const run = () => api<T>(method, path, body ?? {}, { idempotencyKey: key });
      let out: T;
      try {
        out = await run();
      } catch (e) {
        if (!(e instanceof ApiError && e.needsMfa)) throw e;
        if (!(await askMfa(e.message))) throw e;
        out = await run();
      }
      await refresh();
      return out;
    },
    [refresh],
  );

  const enter = useCallback(
    async (r: { token: string } & Partial<Snapshot> & { memberships?: MembershipView[] }) => {
      setToken(r.token);
      if (r.me && r.state && r.version !== undefined) apply(r as Snapshot);
      else apply(await api<Snapshot>("GET", "/v1/state"));
      if (r.memberships) setMemberships(r.memberships);
      else void loadMemberships();
    },
    [apply, loadMemberships],
  );

  const login = useCallback(
    async (email: string, password: string, code?: string) => {
      const r = await api<{ token: string } & Snapshot & { memberships: MembershipView[] }>("POST", "/api/auth/login", { email, password, code }, { token: null });
      await enter(r);
    },
    [enter],
  );

  const devSession = useCallback(
    async (role: "supplier" | "buyer" | "lender" | "fcc") => {
      const r = await api<{ token: string } & Snapshot & { memberships: MembershipView[] }>("POST", "/api/dev/session", { role }, { token: null });
      await enter(r);
    },
    [enter],
  );

  const logout = useCallback(async () => {
    try {
      await api("POST", "/api/auth/logout", {});
    } catch {
      /* phiên có thể đã hết hạn */
    }
    setToken(null);
    setMe(null);
    setData(null);
    setMemberships([]);
    setStatus("anon");
  }, []);

  const switchOrg = useCallback(
    async (orgId: string) => {
      const r = await api<Snapshot & { memberships: MembershipView[] }>("POST", "/api/auth/switch-org", { orgId });
      apply(r);
      setMemberships(r.memberships);
    },
    [apply],
  );

  const org = useMemo(() => (me && data ? (data.orgs.find((o) => o.id === me.activeOrgId) ?? null) : null), [me, data]);

  const value: Ctx = { status, error, me, org, memberships, data, version, dev, refresh, act, login, enter, devSession, logout, switchOrg };
  return (
    <C.Provider value={value}>
      {children}
      {mfa && (
        <MfaPrompt
          message={mfa.message}
          onDone={(ok) => {
            mfa.resolve(ok);
            setMfa(null);
          }}
        />
      )}
    </C.Provider>
  );
}

/** Hộp nhập mã MFA khi máy chủ yêu cầu xác thực lại cho thao tác nhạy cảm. */
function MfaPrompt({ message, onDone }: { message: string; onDone: (ok: boolean) => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const notEnabled = /bật xác thực hai lớp/.test(message);
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("POST", "/api/auth/mfa/verify", { code: code.trim() });
      onDone(true);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="mfa-title">
      <div className="card modal">
        <h2 className="ct" id="mfa-title">
          Xác thực hai lớp
        </h2>
        {notEnabled ? (
          <>
            <p className="sub">{message}</p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn bs" onClick={() => onDone(false)}>
                Đóng
              </button>
              <a className="btn bp" href="/security">
                Bật MFA
              </a>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="stack"
          >
            <p className="sub">Nhập mã 6 số trong ứng dụng xác thực để tiếp tục thao tác này. Mã có hiệu lực cho các thao tác trong 10 phút.</p>
            <input
              className="input num"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              aria-label="Mã xác thực 6 số"
            />
            {err && <p className="err">{err}</p>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn bs" onClick={() => onDone(false)}>
                Hủy
              </button>
              <button className="btn bp" disabled={code.length !== 6 || busy}>
                Xác thực
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
