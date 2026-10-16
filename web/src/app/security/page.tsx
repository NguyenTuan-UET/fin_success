"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useFcc } from "@/lib/session";
import { ROLES, roleOfOrgType } from "@/lib/roles";
import { AuthGate } from "@/components/auth/AuthGate";

export default function SecurityPage() {
  const { status, me, org, refresh } = useFcc();
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pw, setPw] = useState({ current: "", password: "" });
  const [kinds, setKinds] = useState<{ kind: string; label: string; enabled: boolean; locked: boolean }[]>([]);
  const loadKinds = useCallback(() => api<{ kinds: typeof kinds }>("GET", "/api/auth/email-prefs").then((r) => setKinds(r.kinds), () => undefined), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadKinds(); }, [loadKinds]);
  if (status === "loading") return <div className="auth-wrap muted">Đang tải…</div>;
  if (status !== "ready" || !me) return <AuthGate />;
  const home = org ? ROLES[roleOfOrgType(org.type)].home : "/";
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setErr("");
    setMsg("");
    try {
      await f();
      setMsg(ok);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="auth-wrap">
      <div className="card auth-card stack">
        <div className="between">
          <h1 className="h1" style={{ margin: 0 }}>Bảo mật tài khoản</h1>
          <Link className="btn bs sm" href={home}>Quay lại</Link>
        </div>
        <p className="sub">{me.name} · {me.email} · vai trò {me.role}</p>
        {err && <div className="err">{err}</div>}
        {msg && <div className="okmsg">{msg}</div>}

        <section className="stack">
          <h2 className="ct">Xác thực hai lớp (MFA)</h2>
          {me.mfaRequired && !me.mfaEnabled && <div className="err">Vai trò của bạn bắt buộc bật MFA để xác nhận nghĩa vụ, chia sẻ dữ liệu và chấp thuận đề nghị.</div>}
          {me.mfaEnabled ? (
            <>
              <div className="okmsg">MFA đang bật.</div>
              <label className="field"><span>Nhập mã hiện tại để tắt</span><input className="input num" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
              <button className="btn bs" disabled={code.length !== 6} onClick={() => run(() => api("POST", "/api/auth/mfa/disable", { code }), "Đã tắt MFA")}>Tắt MFA</button>
            </>
          ) : !setup ? (
            <button className="btn bp" onClick={() => run(async () => setSetup(await api("POST", "/api/auth/mfa/setup", {})), "")}>Thiết lập MFA</button>
          ) : (
            <>
              <p className="sub">Thêm khóa sau vào ứng dụng xác thực (Google Authenticator, Microsoft Authenticator, Authy…) rồi nhập mã 6 số.</p>
              <code className="num" style={{ wordBreak: "break-all" }}>{setup.secret}</code>
              <a className="btn bs sm" href={setup.otpauthUri}>Mở trong ứng dụng xác thực</a>
              <label className="field"><span>Mã 6 số</span><input className="input num" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
              <button className="btn bp" disabled={code.length !== 6} onClick={() => run(async () => { await api("POST", "/api/auth/mfa/enable", { code }); setSetup(null); setCode(""); }, "Đã bật MFA")}>Bật MFA</button>
            </>
          )}
        </section>

        <section className="stack">
          <h2 className="ct">Thông báo qua email</h2>
          <p className="sub">Chọn loại thông báo gửi tới {me.email}. Thông báo trong ứng dụng luôn có.</p>
          {kinds.map((k) => (
            <label key={k.kind} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={k.enabled} disabled={k.locked} onChange={(e) => run(async () => { await api("POST", "/api/auth/email-prefs", { prefs: { [k.kind]: e.target.checked } }); await loadKinds(); }, "Đã lưu tùy chọn")} /> {k.label}
            </label>
          ))}
        </section>

        <section className="stack">
          <h2 className="ct">Đổi mật khẩu</h2>
          <label className="field"><span>Mật khẩu hiện tại</span><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
          <label className="field"><span>Mật khẩu mới (tối thiểu 10 ký tự)</span><input className="input" type="password" minLength={10} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></label>
          <button className="btn bs" disabled={!pw.current || pw.password.length < 10} onClick={() => run(async () => { await api("POST", "/api/auth/password/change", pw); setPw({ current: "", password: "" }); }, "Đã đổi mật khẩu; các phiên khác đã bị thu hồi")}>Đổi mật khẩu</button>
        </section>
      </div>
    </div>
  );
}
