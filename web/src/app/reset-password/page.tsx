"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function Reset() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      await api("POST", "/api/auth/password/reset", { token, password }, { token: null });
      setDone(true);
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit} style={{ maxWidth: 420 }}>
        <h1 className="h1">Đặt lại mật khẩu</h1>
        {err && <div className="err">{err}</div>}
        {done ? (
          <>
            <div className="okmsg">Đã đặt mật khẩu mới. Mọi phiên cũ đã bị thu hồi.</div>
            <Link className="btn bp" href="/login">Đăng nhập</Link>
          </>
        ) : (
          <>
            <label className="field"><span>Mật khẩu mới (tối thiểu 10 ký tự)</span><input className="input" type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <button className="btn bp">Đặt mật khẩu</button>
          </>
        )}
      </form>
    </div>
  );
}
export default function ResetPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}
