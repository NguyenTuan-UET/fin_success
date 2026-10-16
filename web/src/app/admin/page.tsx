"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { date, dateTime } from "@/lib/format";
import { useData } from "@/lib/session";
import { Kpi, PageHeader } from "@/components/ui/basic";
import { useToast } from "@/components/providers/Toast";

const Y = "Có";
const N = "—";
const ROLES_MATRIX: [string, string[]][] = [
  ["Xem hóa đơn liên quan", [Y, Y, Y, "Khi được chia sẻ", N, N]],
  ["Tải lên & sửa hóa đơn", [Y, Y, Y, N, N, N]],
  ["Xác nhận khoản phải thu (MFA)", [Y, Y, N, N, N, N]],
  ["Gửi RFQ, chọn báo giá, chấp thuận (MFA)", [Y, Y, N, N, N, N]],
  ["Trả báo giá, thẩm định, giải ngân", [Y, N, N, "Chuyên viên thẩm định", N, N]],
  ["Đăng sản phẩm Marketplace", [Y, N, N, "Quản lý sản phẩm", N, N]],
  ["Mời thành viên, đổi vai trò", [Y, N, N, N, N, N]],
  ["Thẩm định và phát hành điểm ESG", ["—", N, N, N, "FCC reviewer", N]],
  ["Duyệt sản phẩm, xác minh tổ chức", ["—", N, N, N, "FCC operations", N]],
  ["Xem nhật ký (chỉ đọc)", [Y, Y, Y, Y, Y, "Kiểm toán"]],
];
const COLS = ["Chủ tổ chức", "Phê duyệt", "Lập hồ sơ", "Tổ chức tài chính", "FCC", "Kiểm toán"];

function Cell({ v }: { v: string }) {
  if (v === Y) return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ok)", fontWeight: 600 }}><Check size={15} aria-hidden="true" />Có</span>;
  if (v === N) return <span className="muted"><Minus size={15} aria-label="Không" /></span>;
  return <span>{v}</span>;
}

export default function AdminPage() {
  const { data, act } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [integrity, setIntegrity] = useState<{ ok: boolean; count: number; badSeq?: number } | null>(null);
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };

  type Row = { id: string; status: string; kind: string; orgId: string; rating: string; score: number; coverage: number };
  type Ver = { id: string; name: string; status: string; proposedBy: string; approvals: string[]; params: { ratingCutoffs: number[] } };
  type Appeal = { id: string; assessmentId: string; orgId: string; reason: string; status: string };
  const [toIssue, setToIssue] = useState<Row[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [versions, setVersions] = useState<Ver[]>([]);
  const loadScoring = useCallback(async () => {
    setToIssue(await api<Row[]>("GET", "/v1/credit-assessments").catch(() => []));
    setAppeals(await api<Appeal[]>("GET", "/v1/appeals?status=open").catch(() => []));
    setVersions((await api<{ versions: Ver[] }>("GET", "/v1/operations/scorecard-versions").catch(() => ({ versions: [] }))).versions);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadScoring(); }, [loadScoring]);
  const orgs = data.orgs.filter((o) => o.type !== "fcc");
  const lendersPending = data.orgs.filter((o) => o.type === "lender" && !o.verified);
  const kycPending = data.orgs.filter((o) => o.kyc?.status === "pending");
  const productsPending = data.products.filter((p) => p.status === "pending_review");
  const flagged = data.receivables.filter((r) => (r.flags ?? []).some((f) => !f.resolvedAt));
  const esgPending = data.esg.filter((e) => e.source === "assessed" && e.status !== "official");

  return (
    <>
      <PageHeader eyebrow="Quản trị hệ thống" title="Vận hành nền tảng FCC" sub="Xác minh tổ chức, duyệt sản phẩm Marketplace và hồ sơ người đại diện, thẩm định ESG, kiểm tra nhật ký. Nhân sự FCC không xem chứng từ hay hồ sơ tài trợ của doanh nghiệp." />
      <section className="grid-kpi">
        <Kpi label="Tổ chức đã đăng ký" value={String(orgs.length)} note={`${orgs.filter((o) => o.type === "supplier").length} nhà cung cấp · ${orgs.filter((o) => o.type === "buyer").length} bên mua · ${orgs.filter((o) => o.type === "lender").length} tổ chức tài chính`} />
        <Kpi label="Chờ xác minh tổ chức tài chính" value={String(lendersPending.length)} tone={lendersPending.length ? "bad" : undefined} />
        <Kpi label="Sản phẩm chờ duyệt" value={String(productsPending.length)} />
        <Kpi label="Hồ sơ ESG chưa phát hành" value={String(esgPending.length)} note={<Link href="/admin/esg">Thẩm định</Link>} />
      </section>

      <section className="card flush" id="users">
        <div className="ch"><h2 className="ct">Hàng đợi xác minh</h2></div>
        {lendersPending.length + kycPending.length + productsPending.length === 0 && <div className="empty">Không có việc chờ xử lý.</div>}
        {lendersPending.map((o) => <div key={o.id} className="between soft" style={{ margin: "0 16px 8px" }}><span><strong>{o.name}</strong> · MST {o.taxCode}<div className="muted">Tổ chức tài chính — xác minh pháp nhân và giấy phép trước khi đăng sản phẩm</div></span><button className="btn bp sm" disabled={busy} onClick={() => run(() => act("POST", `/v1/organizations/${o.id}/verify`, { verified: true }), "Đã xác minh")}>Xác minh</button></div>)}
        {kycPending.map((o) => (
          <div key={o.id} className="between soft" style={{ margin: "0 16px 8px" }}>
            <span><strong>{o.name}</strong> · KYC người đại diện {o.kyc!.representativeName}<div className="muted">{o.kyc!.documentKeys.length} giấy tờ · nộp {date(o.kyc!.submittedAt)}{" "}{o.kyc!.documentKeys.map((k, i) => <button key={k} className="link-btn" style={{ marginLeft: 6 }} onClick={async () => { const u = await api<{ url: string }>("GET", `/api/files/${k}/url`); window.open(u.url, "_blank"); }}>Giấy tờ {i + 1}</button>)}</div></span>
            <span className="row" style={{ gap: 6 }}>
              <button className="btn bp sm" disabled={busy} onClick={() => run(() => act("POST", `/v1/organizations/${o.id}/kyc-decision`, { approve: true }), "Đã xác minh người đại diện (cần MFA)")}>Duyệt</button>
              <button className="btn bs sm" disabled={busy} onClick={() => { const note = prompt("Lý do chưa đạt"); if (note) void run(() => act("POST", `/v1/organizations/${o.id}/kyc-decision`, { approve: false, note }), "Đã từ chối"); }}>Từ chối</button>
            </span>
          </div>
        ))}
        {productsPending.map((p) => (
          <div key={p.id} className="between soft" style={{ margin: "0 16px 8px" }}>
            <span><strong>{p.name}</strong> · {data.orgs.find((o) => o.id === p.lenderId)?.name}<div className="muted">v{p.version} · ứng {p.pricing.advancePct}% · lãi {p.pricing.rateMin}–{p.pricing.rateMax}% · kiểm tra trình bày, FCC không quyết định giá</div></span>
            <span className="row" style={{ gap: 6 }}>
              <button className="btn bp sm" disabled={busy} onClick={() => run(() => act("POST", `/v1/financing-products/${p.id}/review`, { approve: true }), "Đã duyệt")}>Duyệt</button>
              <button className="btn bs sm" disabled={busy} onClick={() => { const note = prompt("Lý do chưa duyệt"); if (note) void run(() => act("POST", `/v1/financing-products/${p.id}/review`, { approve: false, note }), "Đã từ chối"); }}>Từ chối</button>
            </span>
          </div>
        ))}
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Hóa đơn có cờ bất thường</h2><span className="muted">{flagged.length} cần xem xét · FCC không thấy chứng từ, chỉ thông tin tối thiểu</span></div>
        {flagged.length === 0 && <div className="empty">Không có hóa đơn nào cần xem xét.</div>}
        {flagged.map((r) => (
          <div key={r.id} className="stack-sm" style={{ padding: "12px 16px", borderTop: "1px solid var(--line-2)" }}>
            <div className="between"><span><strong className="num">{r.code}</strong> · {data.orgs.find((o) => o.id === r.sellerId)?.shortName} → {data.orgs.find((o) => o.id === r.buyerId)?.shortName} · {r.amount.toLocaleString("vi-VN")} đ</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn bs sm" disabled={busy} onClick={() => { const note = prompt("Kết quả tra cứu cơ quan thuế (ghi chú)"); if (note) void run(() => act("POST", `/v1/receivables/${r.id}/tax-check`, { status: /hủy/i.test(note) ? "cancelled" : /không khớp|sai/i.test(note) ? "mismatch" : "verified", note }), "Đã ghi nhận đối chiếu thuế"); }}>Ghi kết quả đối chiếu thuế</button>
              </span></div>
            {(r.flags ?? []).filter((f) => !f.resolvedAt).map((f) => (
              <div key={f.code} className="between soft"><span><span className={`chip ${f.severity === "high" ? "c-bad" : f.severity === "medium" ? "c-warn" : "c-neu"}`}>{f.code}</span> {f.detail}</span>
                <button className="btn bp sm" disabled={busy} onClick={() => { const note = prompt("Ghi chú xử lý"); if (note) void run(() => act("POST", `/v1/receivables/${r.id}/flags/${f.code}/resolve`, { note }), "Đã xử lý cờ"); }}>Đã xem xét</button></div>
            ))}
          </div>
        ))}
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Chấm điểm tín dụng</h2><span className="muted">Phát hành điểm chính thức, xem xét lại, phiên bản bộ chấm điểm</span></div>
        <div className="stack-sm" style={{ padding: "0 16px 12px" }}>
          <strong style={{ fontSize: 13 }}>Chờ phát hành chính thức ({toIssue.length})</strong>
          {toIssue.length === 0 && <span className="muted">Không có kết quả đủ điều kiện (cần độ bao phủ đạt ngưỡng).</span>}
          {toIssue.map((a) => <div key={a.id} className="between soft"><span>{data.orgs.find((o) => o.id === a.orgId)?.shortName} · {a.kind} · {a.rating} {Math.round(a.score)} · bao phủ {Math.round(a.coverage * 100)}%</span><button className="btn bp sm" disabled={busy} onClick={() => run(async () => { await act("POST", `/v1/credit-assessments/${a.id}/issue`); await loadScoring(); }, "Đã phát hành điểm chính thức")}>Phát hành (MFA)</button></div>)}
          <strong style={{ fontSize: 13 }}>Yêu cầu xem xét lại ({appeals.length})</strong>
          {appeals.map((a) => <div key={a.id} className="between soft"><span><strong>{data.orgs.find((o) => o.id === a.orgId)?.shortName}</strong>: {a.reason}</span><span className="row" style={{ gap: 6 }}>
            <button className="btn bp sm" disabled={busy} onClick={() => { const note = prompt("Ghi chú (chấp nhận → chấm lại bằng dữ liệu hiện tại)"); if (note) void run(async () => { await act("POST", `/v1/appeals/${a.id}/resolve`, { outcome: "upheld", note }); await loadScoring(); }, "Đã chấp nhận và chấm lại"); }}>Chấp nhận</button>
            <button className="btn bs sm" disabled={busy} onClick={() => { const note = prompt("Lý do từ chối"); if (note) void run(async () => { await act("POST", `/v1/appeals/${a.id}/resolve`, { outcome: "rejected", note }); await loadScoring(); }, "Đã từ chối"); }}>Từ chối</button></span></div>)}
          <strong style={{ fontSize: 13 }}>Phiên bản bộ chấm điểm</strong>
          {versions.map((v) => <div key={v.id} className="between soft"><span><strong>{v.name}</strong> <span className="muted">· ngưỡng {v.params.ratingCutoffs.join("/")}</span></span><span className="row" style={{ gap: 6 }}><span className={`chip ${v.status === "active" ? "c-ok" : v.status === "proposed" ? "c-warn" : "c-neu"}`}>{{ active: "Đang dùng", proposed: `Chờ duyệt ${v.approvals.length}/2`, retired: "Đã thay" }[v.status]}</span>{v.status === "proposed" && <button className="btn bs sm" disabled={busy} onClick={() => run(async () => { await act("POST", `/v1/operations/scorecard-versions/${v.id}/approve`); await loadScoring(); }, "Đã duyệt")}>Duyệt (MFA)</button>}</span></div>)}
        </div>
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Tổ chức</h2></div>
        <div className="tw"><table>
          <thead><tr><th>Tên</th><th>Loại</th><th>MST</th><th>Tạo</th><th>Xác minh</th><th>KYC</th></tr></thead>
          <tbody>
            {orgs.map((o) => <tr key={o.id}><td className="wrap">{o.name}{o.simulated && <span className="chip c-neu" style={{ marginLeft: 6 }}>Giả lập</span>}</td><td>{{ supplier: "Nhà cung cấp", buyer: "Bên mua", lender: "Tổ chức tài chính", fcc: "FCC" }[o.type]}</td><td className="num">{o.taxCode}</td><td>{date(o.createdAt)}</td><td>{o.type === "lender" ? (o.verified ? <span className="chip c-ok">Đã xác minh</span> : <span className="chip c-warn">Chờ</span>) : "—"}</td><td>{o.kyc ? <span className={`chip ${o.kyc.status === "verified" ? "c-ok" : o.kyc.status === "pending" ? "c-warn" : "c-bad"}`}>{{ verified: "Đã xác minh", pending: "Chờ", rejected: "Chưa đạt" }[o.kyc.status]}</span> : "—"}</td></tr>)}
            {orgs.length === 0 && <tr><td colSpan={6} className="empty">Chưa có tổ chức nào đăng ký.</td></tr>}
          </tbody></table></div>
      </section>

      <section className="card flush" id="security">
        <div className="ch"><h2 className="ct">Nhật ký kiểm toán</h2>
          <button className="btn bs sm" onClick={async () => setIntegrity(await api("GET", "/v1/audit-events/integrity"))}>Kiểm tra chuỗi băm</button></div>
        {integrity && <div className={integrity.ok ? "okmsg" : "err"} style={{ margin: "0 16px 8px" }}>{integrity.ok ? `Chuỗi băm hợp lệ (${integrity.count} sự kiện).` : `Phát hiện sửa đổi tại sự kiện số ${integrity.badSeq}.`}</div>}
        <div className="tw"><table>
          <thead><tr><th>Thời gian</th><th>Tổ chức</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
          <tbody>{data.audit.slice(0, 30).map((e) => <tr key={e.id}><td className="num">{dateTime(e.at)}</td><td>{data.orgs.find((o) => o.id === e.actorOrgId)?.shortName ?? e.actorOrgId}</td><td>{e.action}</td><td className="num">{e.entity}</td><td className="wrap">{e.detail}</td></tr>)}</tbody></table></div>
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Ma trận quyền (RBAC)</h2><span className="muted">Kiểm tra trên máy chủ cho từng hành động; hành động nhạy cảm cần MFA</span></div>
        <div className="tw"><table>
          <thead><tr><th>Chức năng</th>{COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{ROLES_MATRIX.map(([f, cells]) => <tr key={f}><td>{f}</td>{cells.map((c, i) => <td key={i}><Cell v={c} /></td>)}</tr>)}</tbody></table></div>
      </section>
    </>
  );
}
