"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FinancingProduct } from "@fcc/domain/types";
import { api } from "@/lib/api";
import { date, money, vnd } from "@/lib/format";
import { ASSESSMENT_KIND_LABEL, flagLabel, PRODUCT_TYPE_LABEL } from "@/lib/model";
import { useData } from "@/lib/session";
import { Kpi, PageHeader } from "@/components/ui/basic";
import { useToast } from "@/components/providers/Toast";
import { useAsk } from "@/components/providers/Dialog";

/** Dưới ngưỡng này tỷ lệ dễ gây hiểu nhầm: hiển thị "Không đủ dữ liệu" kèm tử số/mẫu số. */
const MIN_SAMPLES = 5;
const ratio = (num: number, den: number) => (den < MIN_SAMPLES ? "—" : `${Math.round((num / den) * 1000) / 10}%`);
const sample = (den: number) => (den < MIN_SAMPLES ? `Không đủ dữ liệu (cần ≥ ${MIN_SAMPLES} mẫu) · ` : "");

export default function AdminPage() {
  const { data, act } = useData();
  const toast = useToast();
  const ask = useAsk();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<FinancingProduct | null>(null);
  /** Hỏi lý do/ghi chú bằng hộp thoại của ứng dụng rồi thực hiện. */
  const withNote = async (title: string, label: string, f: (note: string, choice?: string) => Promise<unknown>, ok: string, choices?: { value: string; label: string }[]) => {
    const a = await ask({ title, label, choices, minLength: 5 });
    if (a) await run(() => f(a.text, a.choice), ok);
  };
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
  type Step = { avgDays: number | null; samples: number };
  type Kpis = { users: number; receivables: { total: number; totalAmount: number }; financed: { count: number; amount: number }; approval: { approved: number; decided: number }; dispute: { disputed: number; sent: number }; stepTimes: Record<"createdToBuyerConfirmed" | "submittedToDecision" | "decisionToFunded" | "fundedToSettled", Step>; exceptions: { openInvoiceFlags: number; openRefunds: number; disputedPublicData: number } };
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const loadScoring = useCallback(async () => {
    setToIssue(await api<Row[]>("GET", "/v1/credit-assessments").catch(() => []));
    setAppeals(await api<Appeal[]>("GET", "/v1/appeals?status=open").catch(() => []));
    setVersions((await api<{ versions: Ver[] }>("GET", "/v1/operations/scorecard-versions").catch(() => ({ versions: [] }))).versions);
    setKpis(await api<Kpis>("GET", "/v1/operations/kpis").catch(() => null));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadScoring(); }, [loadScoring]);
  const lendersPending = data.orgs.filter((o) => o.type === "lender" && !o.verified);
  const kycPending = data.orgs.filter((o) => o.kyc?.status === "pending");
  const productsPending = data.products.filter((p) => p.status === "pending_review");
  const flagged = data.receivables.filter((r) => (r.flags ?? []).some((f) => !f.resolvedAt));
  const esgPending = data.esg.filter((e) => e.source === "assessed" && e.status !== "official");

  return (
    <>
      <PageHeader eyebrow="Quản trị hệ thống" title="Việc cần xử lý" sub="Hàng đợi xác minh, cờ bất thường và kết quả chấm điểm chờ phát hành. FCC không quyết định tín dụng hay giải ngân và không xem chứng từ hoặc hồ sơ tài trợ của doanh nghiệp." />
      <section className="grid-kpi">
        <Kpi label="Chờ xác minh" value={String(lendersPending.length + kycPending.length)} note={`${lendersPending.length} tổ chức tài chính · ${kycPending.length} KYC người đại diện`} tone={lendersPending.length + kycPending.length ? "bad" : undefined} />
        <Kpi label="Sản phẩm chờ duyệt" value={String(productsPending.length)} note="kiểm tra trình bày, không quyết định giá" />
        <Kpi label="Hóa đơn có cờ" value={String(flagged.length)} tone={flagged.length ? "bad" : undefined} />
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
              <button className="btn bs sm" disabled={busy} onClick={() => withNote(`Từ chối KYC · ${o.name}`, "Lý do chưa đạt (doanh nghiệp sẽ nhận được)", (note) => act("POST", `/v1/organizations/${o.id}/kyc-decision`, { approve: false, note }), "Đã từ chối")}>Từ chối</button>
            </span>
          </div>
        ))}
        {productsPending.map((p) => (
          <div key={p.id} className="between soft" style={{ margin: "0 16px 8px" }}>
            <span><strong>{p.name}</strong> · {data.orgs.find((o) => o.id === p.lenderId)?.name}<div className="muted">v{p.version} · ứng {p.pricing.advancePct}% · lãi {p.pricing.rateMin}–{p.pricing.rateMax}% · kiểm tra trình bày, FCC không quyết định giá</div></span>
            <button className="btn bp sm" disabled={busy} onClick={() => setReview(p)}>Xem và quyết định</button>
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
                <button className="btn bs sm" disabled={busy} onClick={() => withNote(`Đối chiếu thuế · ${r.code}`, "Căn cứ tra cứu (cổng tra cứu, thời điểm, mã tra cứu)", (note, status) => act("POST", `/v1/receivables/${r.id}/tax-check`, { status, note }), "Đã ghi nhận đối chiếu thuế", [{ value: "verified", label: "Khớp — hóa đơn hợp lệ" }, { value: "mismatch", label: "Không khớp thông tin" }, { value: "cancelled", label: "Hóa đơn đã bị hủy" }])}>Ghi kết quả đối chiếu thuế</button>
              </span></div>
            {(r.flags ?? []).filter((f) => !f.resolvedAt).map((f) => (
              <div key={f.code} className="between soft"><span><span className={`chip ${f.severity === "high" ? "c-bad" : f.severity === "medium" ? "c-warn" : "c-neu"}`} title={`Mã kỹ thuật: ${f.code}`}>{flagLabel(f.code)}</span> {f.detail}</span>
                <button className="btn bp sm" disabled={busy} onClick={() => withNote(`Xử lý cờ · ${flagLabel(f.code)}`, "Ghi chú xử lý (đã kiểm tra gì, kết luận)", (note) => act("POST", `/v1/receivables/${r.id}/flags/${f.code}/resolve`, { note }), "Đã xử lý cờ")}>Đã xem xét</button></div>
            ))}
          </div>
        ))}
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Chấm điểm tín dụng</h2><span className="muted">Phát hành điểm chính thức, xem xét lại, phiên bản bộ chấm điểm</span></div>
        <div className="stack-sm" style={{ padding: "0 16px 12px" }}>
          <strong style={{ fontSize: 13 }}>Chờ phát hành chính thức ({toIssue.length})</strong>
          {toIssue.length === 0 && <span className="muted">Không có kết quả đủ điều kiện (cần độ bao phủ đạt ngưỡng).</span>}
          {toIssue.map((a) => <div key={a.id} className="between soft"><span>{data.orgs.find((o) => o.id === a.orgId)?.shortName} · {ASSESSMENT_KIND_LABEL[a.kind] ?? a.kind} · {a.rating} {Math.round(a.score)} · bao phủ {Math.round(a.coverage * 100)}%</span><button className="btn bp sm" disabled={busy} onClick={() => run(async () => { await act("POST", `/v1/credit-assessments/${a.id}/issue`); await loadScoring(); }, "Đã phát hành điểm chính thức")}>Phát hành (MFA)</button></div>)}
          <strong style={{ fontSize: 13 }}>Yêu cầu xem xét lại ({appeals.length})</strong>
          {appeals.map((a) => <div key={a.id} className="between soft"><span><strong>{data.orgs.find((o) => o.id === a.orgId)?.shortName}</strong>: {a.reason}</span><span className="row" style={{ gap: 6 }}>
            <button className="btn bp sm" disabled={busy} onClick={() => withNote("Chấp nhận xem xét lại", "Ghi chú (chấp nhận → chấm lại bằng dữ liệu hiện tại)", async (note) => { await act("POST", `/v1/appeals/${a.id}/resolve`, { outcome: "upheld", note }); await loadScoring(); }, "Đã chấp nhận và chấm lại")}>Chấp nhận</button>
            <button className="btn bs sm" disabled={busy} onClick={() => withNote("Từ chối xem xét lại", "Lý do từ chối (doanh nghiệp sẽ nhận được)", async (note) => { await act("POST", `/v1/appeals/${a.id}/resolve`, { outcome: "rejected", note }); await loadScoring(); }, "Đã từ chối")}>Từ chối</button></span></div>)}
          <strong style={{ fontSize: 13 }}>Phiên bản bộ chấm điểm</strong>
          {versions.map((v) => <div key={v.id} className="between soft"><span><strong>{v.name}</strong> <span className="muted">· ngưỡng {v.params.ratingCutoffs.join("/")}</span></span><span className="row" style={{ gap: 6 }}><span className={`chip ${v.status === "active" ? "c-ok" : v.status === "proposed" ? "c-warn" : "c-neu"}`}>{{ active: "Đang dùng", proposed: `Chờ duyệt ${v.approvals.length}/2`, retired: "Đã thay" }[v.status]}</span>{v.status === "proposed" && <button className="btn bs sm" disabled={busy} onClick={() => run(async () => { await act("POST", `/v1/operations/scorecard-versions/${v.id}/approve`); await loadScoring(); }, "Đã duyệt")}>Duyệt (MFA)</button>}</span></div>)}
        </div>
      </section>

      {kpis && (
        <section className="card stack-sm">
          <div className="between"><h2 className="ct">Chỉ số vận hành</h2><span className="muted">Tính từ dữ liệu trên nền tảng (gồm cả dữ liệu thử nghiệm và tổ chức giả lập); dưới {MIN_SAMPLES} mẫu không tính tỷ lệ</span></div>
          <div className="grid-kpi">
            <Kpi label="Người dùng" value={String(kpis.users)} />
            <Kpi label="Khoản phải thu trên nền tảng" value={String(kpis.receivables.total)} note={`${money(kpis.receivables.totalAmount)} tổng giá trị`} />
            <Kpi label="Giá trị bên tài trợ đã giải ngân" value={money(kpis.financed.amount)} note={`${kpis.financed.count} hồ sơ · tiền đi trực tiếp, không qua FCC`} />
            <Kpi label="Tỷ lệ phê duyệt" value={ratio(kpis.approval.approved, kpis.approval.decided)} note={`${sample(kpis.approval.decided)}${kpis.approval.approved}/${kpis.approval.decided} hồ sơ đã quyết định không bị từ chối`} />
            <Kpi label="Tỷ lệ tranh chấp" value={ratio(kpis.dispute.disputed, kpis.dispute.sent)} tone={kpis.dispute.sent >= MIN_SAMPLES && kpis.dispute.disputed / kpis.dispute.sent > 0.1 ? "bad" : undefined} note={`${sample(kpis.dispute.sent)}${kpis.dispute.disputed}/${kpis.dispute.sent} khoản đã gửi bên mua từng bị tranh chấp`} />
          </div>
          <b>Thời gian trung bình từng bước (ngày)</b>
          <div className="grid-fields" style={{ fontSize: 13 }}>
            {([["createdToBuyerConfirmed", "Tạo hóa đơn → bên mua xác nhận"], ["submittedToDecision", "Nộp hồ sơ → quyết định"], ["decisionToFunded", "Quyết định → giải ngân"], ["fundedToSettled", "Giải ngân → tất toán"]] as const).map(([k, label]) => (
              <div key={k}><div className="muted">{label}</div><div className="num strong">{kpis.stepTimes[k].samples < MIN_SAMPLES ? "Không đủ dữ liệu" : kpis.stepTimes[k].avgDays}<span className="muted"> ({kpis.stepTimes[k].samples} mẫu)</span></div></div>
            ))}
          </div>
          <div className="muted">Ngoại lệ đang mở: {kpis.exceptions.openInvoiceFlags} cờ hóa đơn · {kpis.exceptions.openRefunds} hoàn tiền chưa trả · {kpis.exceptions.disputedPublicData} khiếu nại dữ liệu công khai.</div>
        </section>
      )}
      {review && (
        <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="pr-title">
          <div className="card modal wide stack-sm">
            <h2 className="ct" id="pr-title">Duyệt trình bày sản phẩm · {review.name}</h2>
            <div className="muted">{data.orgs.find((o) => o.id === review.lenderId)?.name} · phiên bản v{review.version} · {PRODUCT_TYPE_LABEL[review.type] ?? review.type}. FCC kiểm tra thông tin công bố có đầy đủ, rõ ràng, không gây hiểu nhầm — không quyết định giá hay khẩu vị tín dụng.</div>
            <div className="tw" tabIndex={0} role="region" aria-label="Thông tin sản phẩm"><table><tbody>
              <tr><th>Mô tả</th><td className="wrap">{review.description || <span className="t-bad">Chưa có mô tả</span>}</td></tr>
              <tr><th>Tỷ lệ ứng trước</th><td className="num">{review.pricing.advancePct}%</td></tr>
              <tr><th>Lãi suất</th><td className="num">{review.pricing.rateMin}–{review.pricing.rateMax}%/năm · phạt quá hạn {review.pricing.latePenaltyPct}% lãi</td></tr>
              <tr><th>Phí</th><td className="wrap">{review.pricing.fees.length ? review.pricing.fees.map((f) => `${f.name}: ${f.kind === "fixed" ? `${vnd(f.value)} đ` : `${f.value}%`}${f.upfront ? " (trả trước)" : ""}`).join("; ") : "Không có phí"}</td></tr>
              <tr><th>Hạn mức mỗi hồ sơ</th><td className="num">{vnd(review.eligibility.minAmount)} – {vnd(review.eligibility.maxAmount)} đ · kỳ hạn tối đa {review.eligibility.maxTenorDays} ngày{review.eligibility.requireBuyerConfirmation ? " · cần bên mua xác nhận" : ""}</td></tr>
              <tr><th>Cam kết thời gian</th><td>{review.sla.quoteHours ? `báo giá ${review.sla.quoteHours} giờ` : "—"}{review.sla.reviewHours ? ` · thẩm định ${review.sla.reviewHours} giờ` : ""}</td></tr>
              <tr><th>Ưu đãi xanh</th><td>{review.greenRule ? `ESG ≥ ${review.greenRule.minEsg}: giảm ${review.greenRule.discountPct} điểm %` : "Không"}</td></tr>
              <tr><th>Hiệu lực</th><td className="num">{date(review.effectiveFrom)} → {date(review.effectiveTo)}</td></tr>
            </tbody></table></div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button className="btn bs" onClick={() => setReview(null)}>Đóng</button>
              <button className="btn bs" disabled={busy} onClick={async () => { const p = review; setReview(null); await withNote(`Từ chối · ${p.name}`, "Lý do chưa duyệt (tổ chức tài chính sẽ nhận được)", (note) => act("POST", `/v1/financing-products/${p.id}/review`, { approve: false, note }), "Đã từ chối, đã báo tổ chức tài chính"); }}>Từ chối</button>
              <button className="btn bp" disabled={busy} onClick={() => { const p = review; setReview(null); void run(() => act("POST", `/v1/financing-products/${p.id}/review`, { approve: true }), "Đã duyệt công bố"); }}>Duyệt công bố (cần MFA)</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
