"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useFcc } from "@/lib/session";
import { Logo } from "@/components/ui/basic";
import { DEV_ROLE, type Role } from "@/lib/roles";

const INDUSTRY: Record<string, string> = {
  manufacturing: "Sản xuất / xây dựng",
  trade: "Thương mại / dịch vụ / tài chính",
  agri: "Nông nghiệp / thực phẩm",
  tech: "Công nghệ",
};
const TYPES: Record<string, string> = {
  supplier: "Nhà cung cấp (bán hàng, cần vốn)",
  buyer: "Bên mua (doanh nghiệp lớn)",
  lender: "Tổ chức tài chính",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Màn hình vào hệ thống: ở chế độ dev tự vào phiên của vai trò (mỗi tab một vai trò); ngược lại đăng nhập / đăng ký. */
export function AuthGate({ role }: { role?: Role }) {
  const { dev, devSession } = useFcc();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [devErr, setDevErr] = useState("");

  useEffect(() => {
    if (!dev || !role) return;
    devSession(DEV_ROLE[role]).catch((e) => setDevErr((e as Error).message));
  }, [dev, role, devSession]);

  if (dev && role) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card stack">
          <span className="muted">{devErr || "Đang vào phiên của vai trò này…"}</span>
          {devErr && (
            <button className="btn bs" onClick={() => devSession(DEV_ROLE[role]).catch((e) => setDevErr((e as Error).message))}>
              Thử lại
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className={`card auth-card stack${mode === "register" ? "" : " narrow"}`}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <Logo size={40} />
          <div>
            <h1 className="h1" style={{ margin: 0 }}>
              FCC · Fast Cash Connect
            </h1>
            <p className="sub" style={{ margin: 0 }}>
              Nền tảng tài trợ chuỗi cung ứng và chấm điểm ESG
            </p>
          </div>
        </div>
        <div className="tabs" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={`btn ${mode === m ? "bp" : "bs"}`} onClick={() => setMode(m)}>
              {m === "login" ? "Đăng nhập" : "Đăng ký tổ chức"}
            </button>
          ))}
        </div>
        {mode === "login" && <Login onForgot={() => setMode("forgot")} />}
        {mode === "register" && <Register />}
        {mode === "forgot" && <Forgot onBack={() => setMode("login")} />}
      </div>
    </div>
  );
}

function Login({ onForgot }: { onForgot: () => void }) {
  const { login } = useFcc();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await login(email, password, needCode ? code : undefined);
    } catch (x) {
      const er = x as Error & { mfaRequired?: boolean; needsMfa?: boolean };
      if (er.mfaRequired) {
        setNeedCode(true);
        setErr("");
      } else setErr(er.message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="stack" >
      {err && <div className="err">{err}</div>}
      <Field label="Email">
        <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Mật khẩu">
        <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {needCode && (
        <Field label="Mã xác thực 6 số (ứng dụng xác thực)">
          <input className="input num" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus required />
        </Field>
      )}
      <button className="btn bp" disabled={busy}>
        Đăng nhập
      </button>
      <button type="button" className="btn bs sm" onClick={onForgot}>
        Quên mật khẩu
      </button>
    </form>
  );
}

function Forgot({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const r = await api<{ message: string }>("POST", "/api/auth/password/forgot", { email }, { token: null });
      setMsg(r.message);
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <form onSubmit={submit} className="stack" >
      {err && <div className="err">{err}</div>}
      {msg && <div className="okmsg">{msg}</div>}
      <Field label="Email đã đăng ký">
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <button className="btn bp">Gửi liên kết đặt lại</button>
      <button type="button" className="btn bs sm" onClick={onBack}>
        Quay lại đăng nhập
      </button>
    </form>
  );
}

function Register() {
  const { enter } = useFcc();
  const [f, setF] = useState({
    type: "supplier", name: "", shortName: "", taxCode: "", vsic: "", industryLabel: "", industryGroup: "manufacturing", province: "",
    foundedYear: String(new Date().getFullYear() - 5), employees: "", listedSymbol: "", exchange: "HOSE", userName: "", title: "", email: "", password: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ token: string }>(
        "POST",
        "/api/auth/register",
        {
          email: f.email, password: f.password, name: f.userName, title: f.title,
          org: {
            type: f.type, name: f.name, shortName: f.shortName || f.name, taxCode: f.taxCode, vsic: f.vsic, industryLabel: f.industryLabel,
            industryGroup: f.industryGroup, province: f.province, foundedYear: Number(f.foundedYear), employees: Number(f.employees),
            ...(f.type === "buyer" && f.listedSymbol ? { listedSymbol: f.listedSymbol, exchange: f.exchange } : {}),
          },
        },
        { token: null },
      );
      await enter(r as never);
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  };
  const inp = (k: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}>
      <input className="input" value={f[k]} onChange={(e) => set(k, e.target.value)} required={extra.required ?? true} {...extra} />
    </Field>
  );
  return (
    <form onSubmit={submit} className="stack">
      {err && <div className="err">{err}</div>}
      <Field label="Loại tổ chức">
        <select className="select" value={f.type} onChange={(e) => set("type", e.target.value)}>
          {Object.entries(TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid-fields">
        {inp("name", "Tên đầy đủ của doanh nghiệp")}
        {inp("shortName", "Tên viết tắt", { required: false })}
        {inp("taxCode", "Mã số thuế (10 hoặc 13 số)", { inputMode: "numeric" })}
        {inp("vsic", "Mã ngành VSIC chính")}
        {inp("industryLabel", "Ngành nghề kinh doanh")}
        <Field label="Nhóm ngành (dùng cho trọng số ESG)">
          <select className="select" value={f.industryGroup} onChange={(e) => set("industryGroup", e.target.value)}>
            {Object.entries(INDUSTRY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        {inp("province", "Tỉnh/thành")}
        {inp("foundedYear", "Năm thành lập", { inputMode: "numeric" })}
        {inp("employees", "Số lao động", { inputMode: "numeric" })}
        {f.type === "buyer" && inp("listedSymbol", "Mã chứng khoán (nếu niêm yết)", { required: false, placeholder: "VD: HPG" })}
        {f.type === "buyer" && f.listedSymbol && (
          <Field label="Sàn">
            <select className="select" value={f.exchange} onChange={(e) => set("exchange", e.target.value)}>
              <option>HOSE</option>
              <option>HNX</option>
              <option>UPCOM</option>
            </select>
          </Field>
        )}
      </div>
      <strong style={{ fontSize: 13 }}>Người dùng đầu tiên (chủ tổ chức)</strong>
      <div className="grid-fields">
        {inp("userName", "Họ tên")}
        {inp("title", "Chức danh")}
        {inp("email", "Email", { type: "email", autoComplete: "username" })}
        {inp("password", "Mật khẩu (tối thiểu 10 ký tự)", { type: "password", autoComplete: "new-password", minLength: 10 })}
      </div>
      {f.type === "lender" && <div className="muted">Tổ chức tài chính cần được FCC xác minh pháp nhân và giấy phép trước khi đăng sản phẩm lên Marketplace.</div>}
      <button className="btn bp" disabled={busy}>
        Đăng ký
      </button>
    </form>
  );
}
