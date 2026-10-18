"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { date, dateTime } from "@/lib/format";
import { useData } from "@/lib/session";
import { useToast } from "@/components/providers/Toast";

type Member = { userId: string; email: string; name: string; title: string; role: string; roleLabel: string; status: string; mfaEnabled: boolean };
type Members = { members: Member[]; invitations: { email: string; role: string; expiresAt: string }[]; roles: { role: string; label: string }[] };
const MEMBER_ACTIONS = ["Nhận lời mời thành viên", "Đổi vai trò thành viên", "Thu hồi thành viên", "Mời thành viên"];

/** Thành viên của tổ chức đang hoạt động: tìm kiếm, lọc theo vai trò/MFA, mời, đổi vai trò, thu hồi và lịch sử thay đổi. */
export function MembersSection({ history = false }: { history?: boolean }) {
  const { data, me, act: write } = useData();
  const toast = useToast();
  const isOwner = ["owner", "fcc_admin"].includes(me.role);
  const [members, setMembers] = useState<Members | null>(null);
  const [invite, setInvite] = useState({ email: "", role: "" });
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [mfaFilter, setMfaFilter] = useState<"" | "on" | "off">("");

  const load = useCallback(() => api<Members>("GET", "/api/org/members").then(setMembers, () => undefined), []);
  useEffect(() => { void load(); }, [load]);
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };

  const active = (members?.members ?? []).filter((m) => m.status === "active");
  const rows = active.filter((m) =>
    (!q || `${m.name} ${m.email} ${m.title}`.toLowerCase().includes(q.toLowerCase())) &&
    (!roleFilter || m.role === roleFilter) &&
    (!mfaFilter || m.mfaEnabled === (mfaFilter === "on")));
  const noMfa = active.filter((m) => !m.mfaEnabled).length;
  const log = useMemo(() => data.audit.filter((e) => MEMBER_ACTIONS.includes(e.action)).slice(0, 20), [data.audit]);
  const defaultRole = members ? members.roles[members.roles.length > 1 ? 1 : 0].role : "";

  return (
    <>
      <section className="card stack">
        <div className="between">
          <h2 className="ct">Thành viên ({active.length})</h2>
          {noMfa > 0 && <span className="chip c-warn">{noMfa} thành viên chưa bật MFA — không thực hiện được thao tác nhạy cảm</span>}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: "1 1 220px" }}><span>Tìm kiếm</span><input className="input" placeholder="Tên, email, chức danh" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="field"><span>Vai trò</span><select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="">Tất cả</option>{members?.roles.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}</select></label>
          <label className="field"><span>MFA</span><select className="select" value={mfaFilter} onChange={(e) => setMfaFilter(e.target.value as typeof mfaFilter)}><option value="">Tất cả</option><option value="on">Đã bật</option><option value="off">Chưa bật</option></select></label>
        </div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>MFA</th><th></th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.userId}>
                <td>{m.name}<div className="muted">{m.title}</div></td><td>{m.email}</td>
                <td>{isOwner && m.userId !== me.id && members ? (
                  <select className="select" aria-label={`Vai trò của ${m.name}`} value={m.role} disabled={busy} onChange={(e) => void run(async () => { await write("POST", `/api/org/members/${m.userId}/role`, { role: e.target.value }); await load(); }, "Đã đổi vai trò")}>
                    {members.roles.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
                  </select>) : m.roleLabel}</td>
                <td><span className="chip c-ok">Đang hoạt động</span></td>
                <td><span className={`chip ${m.mfaEnabled ? "c-ok" : "c-warn"}`}>{m.mfaEnabled ? "Đã bật" : "Chưa bật"}</span></td>
                <td>{isOwner && m.userId !== me.id && <button className="btn bs sm" disabled={busy} onClick={() => run(async () => { await api("POST", `/api/org/members/${m.userId}/revoke`, {}); await load(); }, "Đã thu hồi quyền — hiệu lực ngay")}>Thu hồi</button>}</td>
              </tr>
            ))}
            {members && rows.length === 0 && <tr><td colSpan={6} className="empty">Không có thành viên khớp bộ lọc.</td></tr>}
          </tbody></table></div>
        {members?.invitations.map((i) => <div key={i.email} className="muted">Đã mời {i.email} ({members.roles.find((r) => r.role === i.role)?.label ?? i.role}) — hết hạn {date(i.expiresAt)}</div>)}
        {isOwner && members && (
          <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className="field"><span>Email người được mời</span><input className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
            <label className="field"><span>Vai trò</span><select className="select" value={invite.role || defaultRole} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>{members.roles.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}</select></label>
            <button className="btn bp" disabled={busy || !invite.email} onClick={() => run(async () => { const r = await write<{ inviteUrl: string }>("POST", "/api/org/invitations", { email: invite.email, role: invite.role || defaultRole }); setInviteUrl(r.inviteUrl); setInvite({ email: "", role: "" }); await load(); }, "Đã gửi lời mời qua email")}>Mời thành viên (cần MFA)</button>
          </div>
        )}
        {inviteUrl && <div className="okmsg">Liên kết mời (cũng đã gửi email): <code style={{ wordBreak: "break-all" }}>{inviteUrl}</code></div>}
      </section>

      {history && (
        <section className="card flush">
          <div className="ch"><h2 className="ct">Lịch sử thay đổi thành viên</h2><span className="muted">Từ nhật ký kiểm toán</span></div>
          <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
            <thead><tr><th>Thời gian</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {log.map((e) => <tr key={e.id}><td className="num">{dateTime(e.at)}</td><td>{e.action}</td><td className="num">{e.entity}</td><td className="wrap">{e.detail}</td></tr>)}
              {log.length === 0 && <tr><td colSpan={4} className="empty">Chưa có thay đổi.</td></tr>}
            </tbody></table></div>
        </section>
      )}
    </>
  );
}
