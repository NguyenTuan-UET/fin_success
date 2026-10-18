"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Sparkles, Upload } from "lucide-react";
import type { Receivable } from "@fcc/domain/types";
import { cx, date, vnd } from "@/lib/format";
import { daysLeft, orgName, RECEIVABLE_STAGE, STAGE_GROUPS } from "@/lib/model";
import { useData } from "@/lib/session";
import { useScores } from "@/lib/scores";
import { useToast } from "@/components/providers/Toast";
import { AskButton } from "@/components/assistant/Assistant";
import { Term } from "@/components/ui/Term";

const STEPS: { label: string; note: (r: Receivable) => string; done: (r: Receivable) => boolean }[] = [
  { label: "Phát hành hóa đơn", note: (r) => `Ngày ${date(r.issueDate)}`, done: () => true },
  { label: "Người mua xác nhận", note: () => "Xác nhận khoản phải thu", done: (r) => !["DRAFT", "BUYER_PENDING", "BUYER_DISPUTED", "CANCELLED"].includes(r.state) },
  { label: "Gửi hồ sơ & thẩm định", note: () => "Tổ chức tài chính thẩm định", done: (r) => ["OFFERED", "ACCEPTED", "FUNDED", "SETTLED", "OVERDUE"].includes(r.state) },
  { label: "Giải ngân", note: () => "Tổ chức tài chính chuyển trực tiếp", done: (r) => ["FUNDED", "SETTLED", "OVERDUE"].includes(r.state) },
  { label: "Người mua thanh toán", note: (r) => `Đến hạn ${date(r.dueDate)}`, done: (r) => ["SETTLED", "EARLY_PAID"].includes(r.state) },
  { label: "Tất toán", note: () => "Hoàn phần còn lại cho doanh nghiệp", done: (r) => ["SETTLED", "EARLY_PAID"].includes(r.state) },
];

export function InvoiceManager() {
  const { data, org, act } = useData();
  const toast = useToast();
  const scores = useScores(data);
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviseTo, setReviseTo] = useState("");
  const [amend, setAmend] = useState<{ amount: string; dueDate: string; note: string } | null>(null);

  const mine = useMemo(() => data.receivables.filter((r) => r.sellerId === org.id && r.state !== "CANCELLED"), [data.receivables, org.id]);
  const list = useMemo(() => {
    const g = STAGE_GROUPS.find((x) => x.key === group);
    const needle = q.trim().toLowerCase();
    return mine.filter((r) => (!g || g.states.includes(r.state)) && (!needle || r.code.toLowerCase().includes(needle) || `${r.invoiceSeries}${r.invoiceNumber}`.toLowerCase().includes(needle) || orgName(data.orgs, r.buyerId).toLowerCase().includes(needle)));
  }, [mine, group, q, data.orgs]);

  const s = mine.find((r) => r.id === sel) ?? list[0] ?? null;
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await f();
      toast(ok);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };

  if (!mine.length) {
    return (
      <section className="card empty stack" style={{ alignItems: "center" }}>
        <strong>Chưa có hóa đơn nào.</strong>
        <span>Tải hóa đơn điện tử (XML), ảnh hoặc PDF để tạo khoản phải thu đầu tiên.</span>
        <Link className="btn bp" href="/supplier/invoices/upload">
          <Upload size={16} aria-hidden="true" /> Tải hóa đơn
        </Link>
      </section>
    );
  }

  const stage = s ? RECEIVABLE_STAGE[s.state] : null;
  const buyer = s ? scores.buyer(s.buyerId) : null;
  const dl = s ? daysLeft(s) : null;
  const total = list.reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <section className="card" style={{ padding: 14 }} aria-label="Vòng đời hóa đơn">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[{ key: "all", label: "Tất cả", states: [] as string[] }, ...STAGE_GROUPS].map((g) => {
            const on = group === g.key;
            const count = g.key === "all" ? mine.length : mine.filter((r) => (g as { states: string[] }).states.includes(r.state)).length;
            return (
              <button
                key={g.key}
                aria-pressed={on}
                onClick={() => setGroup(g.key)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minHeight: 64, padding: "10px 14px", borderRadius: 10,
                  cursor: "pointer", textAlign: "left", flex: "1 1 120px", border: `1px solid ${on ? "var(--forest)" : "var(--line)"}`,
                  background: on ? "var(--forest)" : g.key === "over" ? "var(--bad-bg)" : "#fff", color: on ? "#fff" : g.key === "over" ? "var(--bad)" : "var(--ink)",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{g.label}</span>
                <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="row top">
        <div className="card flush grow-3">
          <div className="ch">
            <h2 className="ct">Danh sách hóa đơn</h2>
            <input className="input" style={{ maxWidth: 260 }} placeholder="Tìm mã, số hóa đơn, người mua…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm hóa đơn" />
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Hóa đơn</th>
                  <th>Người mua</th>
                  <th className="r">Số tiền (đ)</th>
                  <th>Hạn thanh toán</th>
                  <th><Term k="riskScore">Xếp hạng</Term></th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const d = daysLeft(r);
                  return (
                    <tr key={r.id} className={cx("clickable", s?.id === r.id && "sel")} onClick={() => setSel(r.id)}>
                      <td><button className="link-btn num" onClick={() => setSel(r.id)}>{r.code}</button></td>
                      <td className="num">{r.invoiceSeries}-{r.invoiceNumber}</td>
                      <td className="wrap" style={{ minWidth: 140 }}>{orgName(data.orgs, r.buyerId)}</td>
                      <td className="r num">{vnd(r.amount)}</td>
                      <td>
                        <div className="num">{date(r.dueDate)}</div>
                        <div className={cx("muted", r.state === "OVERDUE" && "t-bad strong")}>{d === null ? "đã thanh toán" : d < 0 ? `quá hạn ${-d} ngày` : `còn ${d} ngày`}</div>
                      </td>
                      <td className="num">{(() => { const b = scores.buyer(r.buyerId); return !b.official && b.coverage < 0.5 ? "Chưa đủ dữ liệu" : b.rating; })()}</td>
                      <td><span className={`chip ${RECEIVABLE_STAGE[r.state].chip}`}>{RECEIVABLE_STAGE[r.state].short}</span></td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr><td colSpan={7} className="empty">Không có hóa đơn phù hợp. Thử bỏ bớt bộ lọc.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card-foot muted">
            <span>Hiển thị {list.length} / {mine.length} hóa đơn</span>
            <span>Tổng giá trị: <strong className="num" style={{ color: "var(--ink)" }}>{vnd(total)} đ</strong></span>
          </div>
        </div>

        {s && stage && buyer && (
          <aside className="stack grow-1" aria-label="Chi tiết hóa đơn">
            <div className="card stack-sm" style={{ gap: 14 }}>
              <div className="between" style={{ alignItems: "flex-start" }}>
                <div>
                  <span className="muted">Chi tiết hóa đơn</span>
                  <h2 className="num" style={{ fontSize: 20, fontWeight: 600 }}>{s.code}</h2>
                </div>
                <span className={`chip ${stage.chip}`}>{stage.label}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 12px", fontSize: 13 }}>
                <div><div className="muted">Người mua</div><div className="strong wrap">{orgName(data.orgs, s.buyerId)}</div></div>
                <div><div className="muted">Số tiền</div><div className="num strong">{vnd(s.amount)} đ</div></div>
                <div><div className="muted">Hạn thanh toán</div><div className="num">{date(s.dueDate)}{dl !== null && ` (${dl < 0 ? `quá ${-dl}` : `còn ${dl}`} ngày)`}</div></div>
                <div><div className="muted">Xếp hạng người mua (tham khảo)</div><div className="num">{!buyer.official && buyer.coverage < 0.5 ? "Chưa đủ dữ liệu" : buyer.rating}{buyer.official ? "" : ` · tạm tính (bao phủ ${Math.round(buyer.coverage * 100)}%)`}</div></div>
                <div><div className="muted">Hóa đơn</div><div className="num">{s.invoiceSeries}-{s.invoiceNumber}</div></div>
                <div><div className="muted">Nguồn</div><div>{{ xml: "XML hóa đơn điện tử", ocr: "OCR/AI", manual: "Nhập tay", accounting: "Phần mềm kế toán" }[s.source]}</div></div>
              </div>
              {s.disputeReason && <div className="err">Bên mua tranh chấp: {s.disputeReason}</div>}
              {s.taxCheck && <div className={s.taxCheck.status === "verified" ? "okmsg" : "err"}>Đối chiếu cơ quan thuế: {{ verified: "hợp lệ", mismatch: "không khớp", cancelled: "hóa đơn đã hủy" }[s.taxCheck.status]}{s.taxCheck.note ? ` — ${s.taxCheck.note}` : ""}</div>}
              {(s.flags ?? []).map((f) => <div key={f.code} className={f.resolvedAt ? "muted" : "err"} style={{ fontSize: 12.5 }}>{f.resolvedAt ? "✓ Đã xem xét" : "⚑ Cờ bất thường"}: {f.detail}{f.resolutionNote ? ` — ${f.resolutionNote}` : ""}</div>)}
              {s.files?.length ? (
                <div className="muted" style={{ fontSize: 12.5 }}>Chứng từ gốc lưu bất biến (SHA-256): {s.files.map((f) => f.name).join(", ")}</div>
              ) : null}

              <ol className="tl" style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Tiến trình hóa đơn">
                {(() => {
                  const firstOpen = STEPS.findIndex((st) => !st.done(s));
                  return STEPS.map((st, i) => {
                    const done = st.done(s);
                    const cur = i === firstOpen;
                    const bad = s.state === "OVERDUE" && cur;
                    const c = bad ? "var(--bad-strong)" : done ? "var(--brand-fill)" : cur ? "var(--warn-strong)" : "var(--line-strong)";
                    return (
                      <li key={st.label} className="tl-item">
                        <div className="tl-rail">
                          <span className="tl-dot" style={{ borderColor: c, background: done ? c : "#fff" }} />
                          <span className="tl-line" style={{ background: i === STEPS.length - 1 ? "transparent" : done ? "var(--brand-fill)" : "var(--line)" }} />
                        </div>
                        <div className="tl-body">
                          <span style={{ fontSize: 13, fontWeight: 600, color: done || cur ? "var(--ink)" : "var(--ink-3)" }}>{st.label}{cur && <span className="sr-only"> (bước hiện tại)</span>}</span>
                          <span className="muted">{bad ? "Bên mua chậm thanh toán" : st.note(s)}</span>
                        </div>
                      </li>
                    );
                  });
                })()}
              </ol>

              {s.state === "DRAFT" && (
                <div className="stack-sm" style={{ gap: 8 }}>
                  <button className="btn bp" disabled={busy} onClick={() => run(() => act("POST", `/v1/receivables/${s.id}/buyer-invitation`), `Đã gửi ${s.code} cho ${orgName(data.orgs, s.buyerId)} xác nhận`)}>Gửi người mua xác nhận</button>
                  <button className="btn bs" disabled={busy} onClick={() => run(() => act("POST", `/v1/receivables/${s.id}/cancel`), `Đã hủy ${s.code}`)}>Hủy hóa đơn nháp</button>
                </div>
              )}
              {s.state === "BUYER_DISPUTED" && (
                <div className="stack-sm" style={{ gap: 8 }}>
                  <label className="field"><span>Điều chỉnh số tiền sau khi trao đổi với bên mua</span><input className="input num" inputMode="numeric" value={reviseTo} onChange={(e) => setReviseTo(e.target.value.replace(/\D/g, ""))} placeholder={String(s.amount)} /></label>
                  <button className="btn bp" disabled={busy || !reviseTo} onClick={() => run(() => act("POST", `/v1/receivables/${s.id}/revise`, { amount: Number(reviseTo), note: "Điều chỉnh sau trao đổi với bên mua" }), "Đã điều chỉnh; bên mua cần xác nhận lại")}>Điều chỉnh & gửi lại</button>
                </div>
              )}
              {s.state === "BUYER_CONFIRMED" && (
                <div className="stack-sm" style={{ gap: 8 }}>
                  <div className="line-item"><span>Có thể nhận trước (tối đa theo gói)</span><strong className="num">tới {vnd(s.amount * 0.9)} đ</strong></div>
                  <Link className="btn bp" href={`/supplier/marketplace?r=${s.id}`}>So sánh gói & yêu cầu tài trợ</Link>
                </div>
              )}
              {s.state === "BUYER_PENDING" && <div className="muted">Đang chờ {orgName(data.orgs, s.buyerId)} xác nhận.</div>}
              {["BUYER_PENDING", "BUYER_CONFIRMED"].includes(s.state) && !data.applications.some((a) => a.receivableId === s.id && !["REJECTED", "WITHDRAWN"].includes(a.state)) && (
                amend ? (
                  <div className="stack-sm">
                    <strong style={{ fontSize: 13 }}>Hóa đơn điều chỉnh/thay thế</strong>
                    <label className="field"><span>Số tiền mới (đ)</span><input className="input num" inputMode="numeric" value={amend.amount} onChange={(e) => setAmend({ ...amend, amount: e.target.value.replace(/\D/g, "") })} /></label>
                    <label className="field"><span>Hạn thanh toán mới</span><input className="input num" type="date" value={amend.dueDate} onChange={(e) => setAmend({ ...amend, dueDate: e.target.value })} /></label>
                    <label className="field"><span>Lý do (bắt buộc)</span><input className="input" value={amend.note} onChange={(e) => setAmend({ ...amend, note: e.target.value })} /></label>
                    <div className="muted">Xác nhận cũ của bên mua sẽ mất hiệu lực; RFQ đang mở bị đóng.</div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn bs" onClick={() => setAmend(null)}>Hủy</button>
                      <button className="btn bp" disabled={busy || !amend.note.trim()} onClick={() => run(async () => { await act("POST", `/v1/receivables/${s.id}/amendment`, { ...(amend.amount && Number(amend.amount) !== s.amount ? { amount: Number(amend.amount) } : {}), ...(amend.dueDate && amend.dueDate !== s.dueDate ? { dueDate: amend.dueDate } : {}), note: amend.note }); setAmend(null); }, "Đã điều chỉnh; bên mua cần xác nhận lại")}>Điều chỉnh</button>
                    </div>
                  </div>
                ) : <button className="btn bs" onClick={() => setAmend({ amount: String(s.amount), dueDate: s.dueDate, note: "" })}>Điều chỉnh hóa đơn…</button>
              )}
            </div>
            <div className="dark stack-sm">
              <span className="d-title"><Sparkles size={18} color="#DDF1C4" aria-hidden="true" />Chọn hóa đơn nào để tài trợ?</span>
              <p>Hóa đơn có người mua xếp hạng cao, đã được xác nhận và còn nhiều ngày đến hạn thường có chi phí thấp hơn. Xem so sánh chi phí thật ở Marketplace.</p>
              <AskButton className="btn bl" question="Nên tài trợ hóa đơn nào?">Hỏi thêm trợ lý</AskButton>
            </div>
          </aside>
        )}
      </section>
    </>
  );
}

export function InvoiceHeaderActions() {
  return (
    <Link className="btn bp" href="/supplier/invoices/upload">
      <Upload size={16} aria-hidden="true" />
      Tải hóa đơn
    </Link>
  );
}
void Check;
