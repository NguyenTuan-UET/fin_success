"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useFcc } from "@/lib/session";
import { ROLES, roleOfOrgType } from "@/lib/roles";

type Info = { orgName?: string; email: string; roleLabel?: string; valid: boolean; hasAccount: boolean };

function Invite() {
  const token = useSearchParams().get("token") ?? "";
  const { enter } = useFcc();
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [f, setF] = useState({ name: "", title: "", password: "" });
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Info>("GET", `/api/invitations/${encodeURIComponent(token)}`, undefined, { token: null }).then(setInfo, (e) => setErr((e as Error).message));
  }, [token]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const r = await api<{ token: string; me: { activeOrgId: string } }>("POST", `/api/invitations/${encodeURIComponent(token)}/accept`, f, { token: null });
      await enter(r as never);
      router.replace("/login");
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  void ROLES;
  void roleOfOrgType;
  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit} style={{ maxWidth: 440 }}>
        <h1 className="h1">Lời mời tham gia FCC</h1>
        {err && <div className="err">{err}</div>}
        {info && !info.valid && <div className="err">Lời mời đã được dùng hoặc hết hạn.</div>}
        {info?.valid && (
          <>
            <p className="sub">
              Bạn được mời vào <strong>{info.orgName}</strong> với vai trò <strong>{info.roleLabel}</strong> ({info.email}).
            </p>
            {!info.hasAccount && (
              <>
                <label className="field"><span>Họ tên</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
                <label className="field"><span>Chức danh</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></label>
              </>
            )}
            <label className="field">
              <span>{info.hasAccount ? "Mật khẩu hiện tại của bạn" : "Đặt mật khẩu (tối thiểu 10 ký tự)"}</span>
              <input className="input" type="password" minLength={info.hasAccount ? 1 : 10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
            </label>
            <button className="btn bp">Tham gia</button>
          </>
        )}
      </form>
    </div>
  );
}
export default function InvitePage() {
  return (
    <Suspense>
      <Invite />
    </Suspense>
  );
}
