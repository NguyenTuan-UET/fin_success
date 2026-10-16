"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Consent, Org } from "@fcc/domain/types";
import { api, fileToBase64 } from "@/lib/api";
import { date, dateTime } from "@/lib/format";
import { orgName } from "@/lib/model";
import { useData } from "@/lib/session";
import { PageHeader } from "@/components/ui/basic";
import { PublicData } from "@/components/screens/PublicData";
import { useToast } from "@/components/providers/Toast";
import type { Role } from "@/lib/roles";

type Member = { userId: string; email: string; name: string; title: string; role: string; roleLabel: string; status: string; mfaEnabled: boolean };
type Members = { members: Member[]; invitations: { email: string; role: string; expiresAt: string }[]; roles: { role: string; label: string }[] };
type Keys = { keys: { id: string; name: string; scopes: string[]; createdAt: string; lastUsedAt?: string; revokedAt?: string }[]; scopes: Record<string, { label: string }>; endpoint: string | null };
const SCOPE_LABEL: Record<string, string> = { products: "sản phẩm", rfqs: "báo giá", applications: "hồ sơ", packages: "gói hồ sơ", events: "sự kiện tiền" };
const KYC_LABEL = { pending: ["Chờ FCC xác minh", "c-warn"], verified: ["Đã xác minh", "c-ok"], rejected: ["Chưa đạt", "c-bad"] } as const;

export function SettingsPanel({ role }: { role: Role }) {
  const { data, org, me, act } = useData();
  const toast = useToast();
  const isOwner = ["owner", "fcc_admin"].includes(me.role);
  const [members, setMembers] = useState<Members | null>(null);
  const [invite, setInvite] = useState({ email: "", role: "" });
  const [inviteUrl, setInviteUrl] = useState("");
  const [profile, setProfile] = useState<Partial<Org>>({});
  const [kycName, setKycName] = useState("");
  const [kycKeys, setKycKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [keys, setKeys] = useState<Keys | null>(null);
  const [newKey, setNewKey] = useState<{ token: string; secret?: string } | null>(null);
  const [hookEdit, setHookEdit] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<{ eventId: string; type: string; attempts: number; lastStatus?: number; deliveredAt?: string; deadAt?: string; lastError?: string }[]>([]);

  const loadMembers = useCallback(() => api<Members>("GET", "/api/org/members").then(setMembers, () => undefined), []);
  const loadKeys = useCallback(async () => {
    if (org.type !== "lender") return;
    setKeys(await api<Keys>("GET", "/v1/integration-keys").catch(() => null));
    setDeliveries(await api<typeof deliveries>("GET", "/v1/partner-endpoint/deliveries").catch(() => []));
  }, [org.type]);
  // tải danh sách khi mở màn hình (dữ liệu từ máy chủ, không nằm trong trạng thái chung)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadMembers(); void loadKeys(); }, [loadMembers, loadKeys]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const hookUrl = hookEdit ?? keys?.endpoint ?? "";
  const setHookUrl = setHookEdit;

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const upd = <K extends keyof Org>(k: K, v: Org[K]) => setProfile((p) => ({ ...p, [k]: v }));
  const val = <K extends keyof Org>(k: K) => (profile[k] ?? org[k] ?? "") as string | number;

  const consentsOut = data.consents.filter((c) => c.ownerId === org.id);
  const consentsIn = data.consents.filter((c) => c.recipientId === org.id);
  const today = new Date().toISOString().slice(0, 10);
  const live = (c: Consent) => !c.revokedAt && c.expiresAt >= today;
  const myAudit = data.audit.slice(0, 40);

  const uploadKyc = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    await run(async () => {
      const stored = await api<{ key: string }>("POST", "/api/files", { name: f.name, mime: f.type || "application/octet-stream", dataBase64: await fileToBase64(f), kind: "kyc" });
      setKycKeys((k) => [...k, stored.key]);
    }, "Đã tải giấy tờ lên (lưu mã hóa, SHA-256)");
  };

  return (
    <>
      <PageHeader eyebrow="Cài đặt" title="Tổ chức, thành viên & chia sẻ dữ liệu" sub="Quản lý hồ sơ tổ chức, thành viên và quyền, dữ liệu bạn chia sẻ cho tổ chức khác, và nhật ký truy cập." actions={<Link className="btn bs" href="/security">Bảo mật tài khoản (MFA)</Link>} />

      <section className="card stack">
        <div className="between">
          <h2 className="ct">Hồ sơ tổ chức</h2>
          {org.type === "lender" && <span className={`chip ${org.verified ? "c-ok" : "c-warn"}`}>{org.verified ? "FCC đã xác minh" : "Chờ FCC xác minh"}</span>}
          {org.simulated && <span className="chip c-neu">Giả lập</span>}
        </div>
        <div className="muted">MST {org.taxCode} · tạo {date(org.createdAt)}. MST chưa được đối chiếu tự động với cơ quan thuế.</div>
        <div className="grid-fields">
          {([["name", "Tên đầy đủ"], ["shortName", "Tên viết tắt"], ["vsic", "Mã ngành VSIC"], ["industryLabel", "Ngành nghề"], ["province", "Tỉnh/thành"], ["foundedYear", "Năm thành lập"], ["employees", "Số lao động"]] as const).map(([k, label]) => (
            <label key={k} className="field"><span>{label}</span><input className="input" disabled={!isOwner || org.type === "fcc"} value={val(k)} onChange={(e) => upd(k, (typeof org[k] === "number" ? Number(e.target.value.replace(/\D/g, "")) : e.target.value) as never)} /></label>
          ))}
          {(org.type === "supplier" || org.type === "buyer") && <label className="field"><span>Website doanh nghiệp (để FCC đọc chứng nhận công bố)</span><input className="input" disabled={!isOwner} placeholder="https://" value={val("website")} onChange={(e) => upd("website", e.target.value.trim())} /></label>}
          {org.type === "buyer" && <label className="field"><span>Mã chứng khoán (nếu niêm yết)</span><input className="input" disabled={!isOwner} value={val("listedSymbol")} onChange={(e) => upd("listedSymbol", e.target.value.toUpperCase())} /></label>}
        </div>
        {isOwner && org.type !== "fcc" && <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={busy || !Object.keys(profile).length} onClick={() => run(async () => { await act("POST", "/v1/organizations/me", profile); setProfile({}); }, "Đã cập nhật hồ sơ")}>Lưu hồ sơ</button>}
      </section>

      {org.type !== "fcc" && (
        <section className="card stack">
          <div className="between"><h2 className="ct">Xác minh người đại diện (KYC)</h2>{org.kyc && <span className={`chip ${KYC_LABEL[org.kyc.status][1]}`}>{KYC_LABEL[org.kyc.status][0]}</span>}</div>
          {org.kyc ? <div className="muted">Người đại diện: {org.kyc.representativeName} · nộp {date(org.kyc.submittedAt)}{org.kyc.note ? ` · ${org.kyc.note}` : ""}. Hiện FCC đối chiếu giấy tờ tải lên; eKYC qua nhà cung cấp sẽ bật khi có hợp đồng.</div> : <div className="muted">Tải CCCD/hộ chiếu của người đại diện và giấy đăng ký kinh doanh để FCC đối chiếu.</div>}
          {isOwner && org.kyc?.status !== "verified" && (
            <div className="stack-sm">
              <label className="field"><span>Họ tên người đại diện theo pháp luật</span><input className="input" value={kycName || org.kyc?.representativeName || ""} onChange={(e) => setKycName(e.target.value)} /></label>
              <label className="field"><span>Giấy tờ (tải từng tệp){kycKeys.length ? ` — đã tải ${kycKeys.length}` : ""}</span><input type="file" accept="application/pdf,image/*" onChange={(e) => void uploadKyc(e.target.files)} /></label>
              <button className="btn bs" style={{ alignSelf: "flex-start" }} disabled={busy || !kycKeys.length || !(kycName || org.kyc?.representativeName)} onClick={() => run(async () => {
                await act("POST", "/v1/organizations/me/kyc", { representativeName: kycName || org.kyc?.representativeName, documentKeys: kycKeys });
                setKycKeys([]);
              }, "Đã nộp hồ sơ xác minh")}>Nộp hồ sơ xác minh</button>
            </div>
          )}
        </section>
      )}

      {(org.type === "supplier" || org.type === "buyer") && (
        <section className="card stack">
          <h2 className="ct">Dữ liệu công khai về tổ chức</h2>
          <div className="muted">Thông tin FCC đọc từ nguồn công khai về doanh nghiệp bạn. Chỉ để tham khảo khi thẩm định, không tự động đổi điểm. Nếu có sai lệch, bạn có thể khiếu nại.</div>
          <PublicData orgId={org.id} canDispute={["owner", "approver"].includes(me.role)} />
        </section>
      )}

      <section className="card stack">
        <h2 className="ct">Thành viên & vai trò</h2>
        <div className="tw"><table>
          <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>MFA</th><th></th></tr></thead>
          <tbody>
            {members?.members.filter((m) => m.status === "active").map((m) => (
              <tr key={m.userId}>
                <td>{m.name}<div className="muted">{m.title}</div></td><td>{m.email}</td>
                <td>{isOwner && m.userId !== me.id ? (
                  <select className="select" value={m.role} onChange={(e) => void run(async () => { await api("POST", `/api/org/members/${m.userId}/role`, { role: e.target.value }); await loadMembers(); }, "Đã đổi vai trò")}>
                    {members.roles.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
                  </select>) : m.roleLabel}</td>
                <td><span className={`chip ${m.mfaEnabled ? "c-ok" : "c-warn"}`}>{m.mfaEnabled ? "Đã bật" : "Chưa bật"}</span></td>
                <td>{isOwner && m.userId !== me.id && <button className="btn bs sm" onClick={() => run(async () => { await api("POST", `/api/org/members/${m.userId}/revoke`, {}); await loadMembers(); }, "Đã thu hồi quyền — hiệu lực ngay")}>Thu hồi</button>}</td>
              </tr>
            ))}
          </tbody></table></div>
        {members?.invitations.map((i) => <div key={i.email} className="muted">Đã mời {i.email} ({i.role}) — hết hạn {date(i.expiresAt)}</div>)}
        {isOwner && members && (
          <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className="field"><span>Email người được mời</span><input className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
            <label className="field"><span>Vai trò</span><select className="select" value={invite.role || members.roles[members.roles.length > 1 ? 1 : 0].role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>{members.roles.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}</select></label>
            <button className="btn bp" disabled={busy || !invite.email} onClick={() => run(async () => { const r = await api<{ inviteUrl: string }>("POST", "/api/org/invitations", { email: invite.email, role: invite.role || members.roles[members.roles.length > 1 ? 1 : 0].role }); setInviteUrl(r.inviteUrl); setInvite({ email: "", role: "" }); await loadMembers(); }, "Đã gửi lời mời qua email")}>Mời thành viên</button>
          </div>
        )}
        {inviteUrl && <div className="okmsg">Liên kết mời (cũng đã gửi email): <code style={{ wordBreak: "break-all" }}>{inviteUrl}</code></div>}
      </section>

      <section className="card stack">
        <h2 className="ct">Chia sẻ dữ liệu</h2>
        <div className="muted">Quyền xem dữ liệu của bạn được cấp theo từng bên nhận, mục đích và thời hạn; thu hồi có hiệu lực ngay với truy cập mới.</div>
        {[["Bạn đã chia sẻ cho", consentsOut, (c: Consent) => orgName(data.orgs, c.recipientId)], ["Chia sẻ tới bạn", consentsIn, (c: Consent) => orgName(data.orgs, c.ownerId)]].map(([title, list, who]) => (
          <div key={title as string} className="stack-sm">
            <strong style={{ fontSize: 13 }}>{title as string}</strong>
            {(list as Consent[]).length === 0 && <span className="muted">Không có.</span>}
            {(list as Consent[]).map((c) => (
              <div key={c.id} className="between soft">
                <span><strong>{(who as (c: Consent) => string)(c)}</strong> · {c.purpose}<div className="muted">{c.scopes.join(", ")} · đến {date(c.expiresAt)}{c.signature ? ` · ký ${c.signature.method === "mfa_snapshot" ? "MFA" : c.signature.method}` : ""}</div></span>
                {live(c) ? (c.ownerId === org.id && <button className="btn bs sm" onClick={() => run(() => act("POST", `/v1/consents/${c.id}/revoke`), "Đã thu hồi quyền chia sẻ")}>Thu hồi</button>) : <span className="chip c-neu">{c.revokedAt ? "Đã thu hồi" : "Hết hạn"}</span>}
              </div>
            ))}
          </div>
        ))}
      </section>

      {org.type === "lender" && isOwner && keys && (
        <section className="card stack">
          <h2 className="ct">Tích hợp hệ thống của tổ chức tài chính</h2>
          <div className="muted">Dùng khóa tích hợp để đăng sản phẩm, trả báo giá, thẩm định và gửi sự kiện giải ngân từ hệ thống của bạn (tài liệu: <code>/v1/openapi.json</code>). Webhook gửi tới địa chỉ bạn đăng ký, ký <code>t=,v1=HMAC-SHA256</code>.</div>
          <label className="field"><span>Địa chỉ nhận webhook (HTTPS)</span><input className="input" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://…" /></label>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn bs" disabled={busy} onClick={() => run(async () => { await api("POST", "/v1/partner-endpoint", { url: hookUrl || null }); await loadKeys(); }, "Đã lưu địa chỉ webhook")}>Lưu địa chỉ</button>
            <button className="btn bs" disabled={busy || !org.verified} onClick={() => run(async () => { const r = await api<{ secret: string }>("POST", "/api/webhook-secret", {}); setNewKey({ token: "", secret: r.secret }); }, "Đã tạo khóa ký webhook")}>Tạo khóa ký webhook</button>
            <button className="btn bp" disabled={busy} onClick={() => run(async () => { const r = await act<{ token: string }>("POST", "/v1/integration-keys", { name: "Hệ thống nội bộ", scopes: Object.keys(keys.scopes) }); setNewKey({ token: r.token }); await loadKeys(); }, "Đã tạo khóa tích hợp")}>Tạo khóa tích hợp (cần MFA)</button>
          </div>
          {newKey && <div className="okmsg">Lưu ngay — chỉ hiển thị một lần:{newKey.token && <div><code style={{ wordBreak: "break-all" }}>{newKey.token}</code></div>}{newKey.secret && <div>Khóa ký: <code style={{ wordBreak: "break-all" }}>{newKey.secret}</code></div>}</div>}
          <div className="tw"><table>
            <thead><tr><th>Khóa</th><th>Phạm vi</th><th>Tạo</th><th>Dùng lần cuối</th><th></th></tr></thead>
            <tbody>
              {keys.keys.map((k) => <tr key={k.id}><td className="num">{k.id}<div className="muted">{k.name}</div></td><td>{k.scopes.map((s) => SCOPE_LABEL[s.split(":")[0]] ?? s).join(", ")}</td><td>{date(k.createdAt)}</td><td>{k.lastUsedAt ? dateTime(k.lastUsedAt) : "—"}</td><td>{k.revokedAt ? <span className="chip c-neu">Đã thu hồi</span> : <button className="btn bs sm" onClick={() => run(async () => { await api("POST", `/v1/integration-keys/${k.id}/revoke`, {}); await loadKeys(); }, "Đã thu hồi khóa")}>Thu hồi</button>}</td></tr>)}
              {keys.keys.length === 0 && <tr><td colSpan={5} className="empty">Chưa có khóa tích hợp.</td></tr>}
            </tbody></table></div>
          {deliveries.length > 0 && <div className="stack-sm"><strong style={{ fontSize: 13 }}>Lịch sử gửi webhook</strong>{deliveries.slice(0, 8).map((d) => <div key={d.eventId} className="between soft"><span className="num">{d.type}</span><span className={`chip ${d.deliveredAt ? "c-ok" : d.deadAt ? "c-bad" : "c-warn"}`}>{d.deliveredAt ? "Đã gửi" : d.deadAt ? "Ngừng thử" : `Thử lại (lần ${d.attempts})`}{d.lastStatus ? ` · HTTP ${d.lastStatus}` : ""}</span></div>)}</div>}
        </section>
      )}

      <FeesSection />

      <section className="card flush">
        <div className="ch"><h2 className="ct">Nhật ký hoạt động</h2><span className="muted">Chỉ thêm, không sửa; nối chuỗi băm kiểm tra toàn vẹn</span></div>
        <div className="tw"><table>
          <thead><tr><th>Thời gian</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
          <tbody>
            {myAudit.map((e) => <tr key={e.id}><td className="num">{dateTime(e.at)}</td><td>{e.action}</td><td className="num">{e.entity}</td><td className="wrap">{e.detail}</td></tr>)}
            {myAudit.length === 0 && <tr><td colSpan={4} className="empty">Chưa có hoạt động.</td></tr>}
          </tbody></table></div>
      </section>
      <span className="muted">Đang đăng nhập: {me.name} · {me.email} · vai trò {me.role} · {role}</span>
    </>
  );
}

type Charge = { id: string; sourceLabel: string; amount: number; description: string; period: string; paidAt?: string };
/** Phí dịch vụ của tổ chức: biểu phí đang áp dụng, phí đã phát sinh theo tháng, bảng kê in được. */
function FeesSection() {
  const { org } = useData();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<{ charges: Charge[]; total: number } | null>(null);
  const [sch, setSch] = useState<{ active: { name: string; transactionPct: number }; } | null>(null);
  useEffect(() => { api<typeof data>("GET", `/v1/fees?period=${period}`).then(setData, () => undefined); }, [period]);
  useEffect(() => { api<typeof sch>("GET", "/v1/fee-schedule").then(setSch, () => undefined); }, []);
  if (org.type === "fcc") return null;
  const open = async () => { const l = await api<{ url: string }>("GET", `/v1/fees/invoice-link?period=${period}`); window.open(l.url, "_blank"); };
  return (
    <section className="card flush">
      <div className="ch"><h2 className="ct">Phí dịch vụ</h2>
        <span className="row" style={{ gap: 8 }}><input className="input num" style={{ maxWidth: 130 }} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /><button className="btn bs sm" onClick={open}>Bảng kê (in PDF)</button></span></div>
      <div className="muted" style={{ padding: "0 16px 8px" }}>Biểu phí đang áp dụng: {sch?.active.name ?? "—"}. Phí được công bố trước khi phát sinh; FCC không giữ tiền của bạn.</div>
      <div className="tw"><table>
        <thead><tr><th>Nội dung</th><th>Nguồn</th><th className="r">Số tiền (đ)</th><th>Thanh toán</th></tr></thead>
        <tbody>
          {data?.charges.map((c) => <tr key={c.id}><td className="wrap">{c.description}</td><td>{c.sourceLabel}</td><td className="r num">{c.amount.toLocaleString("vi-VN")}</td><td>{c.paidAt ? <span className="chip c-ok">Đã thanh toán</span> : <span className="chip c-neu">Chưa</span>}</td></tr>)}
          {(data?.charges.length ?? 0) === 0 && <tr><td colSpan={4} className="empty">Không phát sinh phí trong tháng.</td></tr>}
        </tbody></table></div>
    </section>
  );
}
