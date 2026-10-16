"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { FundingApplication } from "@fcc/domain/types";
import type { ScoreResult } from "@fcc/domain/credit";
import { cx, date, dec, vnd } from "@/lib/format";
import { APP_STATE_LABEL, orgName, ratingTone } from "@/lib/model";
import { useData } from "@/lib/session";
import { useScores } from "@/lib/scores";
import { Bar, Disclaimer } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";

const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function ScoreBlock({ title, s, term }: { title: string; s: ScoreResult; term?: React.ReactNode }) {
  return (
    <div className="soft stack-sm" style={{ gap: 8 }}>
      <div className="between">
        <strong style={{ fontSize: 13 }}>{term ?? title}</strong>
        <span className={`chip ${ratingTone(s.rating)}`}>{s.rating} · {dec(s.score, 0)}/100{s.official ? "" : " · tạm tính"}</span>
      </div>
      <div className="muted">Độ bao phủ dữ liệu {Math.round(s.coverage * 100)}% · khoảng {dec(s.min, 0)}–{dec(s.max, 0)}</div>
      {s.components.map((c) => (
        <div key={c.key}>
          <div className="between muted"><span>{c.label} ({Math.round(c.weight * 100)}%)</span><span>{c.score === null ? "Chưa xác minh" : dec(c.score, 0)}</span></div>
          <Bar value={c.score ?? 0} />
        </div>
      ))}
      {s.flags.length > 0 && <div className="err">{s.flags.join("; ")}</div>}
      {s.positives.slice(0, 2).map((f) => <div key={f.code} className="t-ok" style={{ fontSize: 12.5 }}>＋ {f.name}: {f.raw}</div>)}
      {s.negatives.slice(0, 2).map((f) => <div key={f.code} className="t-bad" style={{ fontSize: 12.5 }}>− {f.name}: {f.raw}</div>)}
    </div>
  );
}

/** RFQ chờ báo giá: tổ chức tài chính trả báo giá sơ bộ theo biểu giá sản phẩm hoặc từ chối. */
function RfqQueue() {
  const { data, org, act } = useData();
  const toast = useToast();
  const scores = useScores(data);
  const mine = new Set(data.products.filter((p) => p.lenderId === org.id).map((p) => p.id));
  const open = data.rfqs.filter((q) => ["OPEN", "RESPONDED"].includes(q.state) && q.productIds.some((p) => mine.has(p)) && !q.responses.some((x) => x.lenderId === org.id));
  const [f, setF] = useState<Record<string, { rate: string; adv: string; fees: string; reason: string }>>({});
  const [busy, setBusy] = useState(false);
  if (!open.length) return null;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  return (
    <section className="card flush" style={{ marginBottom: 16 }}>
      <div className="ch"><h2 className="ct">RFQ chờ báo giá</h2><span className="muted">{open.length} yêu cầu · hết hạn sau 5 ngày</span></div>
      {open.map((q) => {
        const r = data.receivables.find((x) => x.id === q.receivableId);
        const pid = q.productIds.find((p) => mine.has(p))!;
        const prod = data.products.find((p) => p.id === pid);
        const v = f[q.id] ?? { rate: String(prod?.pricing.rateMin ?? ""), adv: String(prod?.pricing.advancePct ?? 80), fees: "0", reason: "" };
        const set = (k: keyof typeof v, x: string) => setF({ ...f, [q.id]: { ...v, [k]: x } });
        const sc = r ? scores.application(r.id) : null;
        return (
          <div key={q.id} className="stack-sm" style={{ padding: 16, borderTop: "1px solid var(--line-2)" }}>
            <div className="between"><span><strong className="num">{q.id}</strong> · {r ? `${orgName(data.orgs, r.sellerId)} · ${vnd(r.amount)} đ · hạn ${date(r.dueDate)}` : ""}</span>{sc && <span className={`chip ${ratingTone(sc.rating)}`}>Hạng hồ sơ {sc.rating}</span>}</div>
            <div className="muted">Gói: {prod?.name}. Gói tóm tắt gồm điểm tín dụng và ESG đã được doanh nghiệp đồng ý chia sẻ.</div>
            <div className="grid-fields">
              <label className="field"><span>Ứng trước (%)</span><input className="input num" inputMode="decimal" value={v.adv} onChange={(e) => set("adv", e.target.value.replace(",", "."))} /></label>
              <label className="field"><span>Lãi suất (%/năm)</span><input className="input num" inputMode="decimal" value={v.rate} onChange={(e) => set("rate", e.target.value.replace(",", "."))} /></label>
              <label className="field"><span>Phí (đ)</span><input className="input num" inputMode="numeric" value={v.fees} onChange={(e) => set("fees", e.target.value.replace(/\D/g, ""))} /></label>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn bp" disabled={busy || !v.rate} onClick={() => run(() => act("POST", `/v1/rfqs/${q.id}/responses`, { productId: pid, kind: "quote", advancePct: Number(v.adv), ratePct: Number(v.rate), feesVnd: Number(v.fees || 0), validUntil: addDays(3), conditions: "Báo giá sơ bộ; chính thức sau thẩm định" }), "Đã gửi báo giá")}>Gửi báo giá</button>
              <input className="input" style={{ flex: "1 1 200px" }} placeholder="Lý do từ chối" value={v.reason} onChange={(e) => set("reason", e.target.value)} />
              <button className="btn bs" disabled={busy || !v.reason.trim()} onClick={() => run(() => act("POST", `/v1/rfqs/${q.id}/responses`, { productId: pid, kind: "decline", conditions: v.reason.trim() }), "Đã từ chối RFQ")}>Từ chối</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function LenderAppraisal() {
  const { data, org, act } = useData();
  const toast = useToast();
  const scores = useScores(data);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState("");
  const [form, setForm] = useState({ advance: "", rate: "", fees: "", tenor: "", cond: "", expires: addDays(5) });

  const apps = useMemo(() => data.applications.filter((a) => a.lenderId === org.id).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)), [data.applications, org.id]);
  const a = apps.find((x) => x.id === sel) ?? apps.find((x) => ["SUBMITTED", "UNDER_REVIEW"].includes(x.state)) ?? apps[0] ?? null;
  const r = a ? data.receivables.find((x) => x.id === a.receivableId) : undefined;
  const product = a ? data.products.find((p) => p.id === a.productId) : undefined;
  const quote = a?.rfqId ? data.rfqs.find((q) => q.id === a.rfqId)?.responses.find((x) => x.lenderId === org.id) : undefined;

  // gợi ý đề nghị: theo báo giá đã chọn hoặc biểu giá sản phẩm; đặt lại mỗi khi đổi hồ sơ đang xem
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!a || !r) return;
    const adv = (quote?.advancePct ?? product?.pricing.advancePct ?? 80) / 100;
    const tenor = Math.max(1, Math.round((new Date(r.dueDate).getTime() - Date.now()) / 86_400_000));
    setForm({ advance: String(Math.floor((r.amount * adv) / 1e6) * 1e6), rate: String(quote?.ratePct ?? product?.pricing.rateMin ?? ""), fees: String(quote?.feesVnd ?? 0), tenor: String(tenor), cond: quote?.conditions ?? "", expires: addDays(5) });
    setRejecting("");
  }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };

  if (!apps.length) return <><RfqQueue /><section className="card empty">Chưa có hồ sơ nào gửi tới tổ chức của bạn. Hồ sơ xuất hiện khi doanh nghiệp chọn báo giá của bạn trong RFQ hoặc gửi thẳng tới sản phẩm.</section></>;

  const appScore = r ? scores.application(r.id) : null;
  const seller = r ? scores.supplier(r.sellerId) : null;
  const buyer = r ? scores.buyer(r.buyerId) : null;
  const esg = r ? scores.esg(r.sellerId) : undefined;
  const profile = r ? data.profiles.find((p) => p.orgId === r.sellerId) : undefined;

  return (
    <>
    <RfqQueue />
    <section className="row top">
      <div className="card flush grow-2" style={{ flexBasis: 360 }}>
        <div className="ch"><h2 className="ct">Hàng đợi hồ sơ</h2><span className="muted">{apps.filter((x) => ["SUBMITTED", "UNDER_REVIEW"].includes(x.state)).length} cần xử lý</span></div>
        <div className="tw">
          <table>
            <thead><tr><th>Hồ sơ</th><th>Doanh nghiệp</th><th className="r">Giá trị (đ)</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {apps.map((x) => {
                const rc = data.receivables.find((y) => y.id === x.receivableId);
                return (
                  <tr key={x.id} className={cx("clickable", a?.id === x.id && "sel")} onClick={() => setSel(x.id)}>
                    <td><button className="link-btn num" onClick={() => setSel(x.id)}>{x.id}</button><div className="muted">{date(x.submittedAt)}</div></td>
                    <td className="wrap">{rc ? orgName(data.orgs, rc.sellerId) : "—"}</td>
                    <td className="r num">{rc ? vnd(rc.amount) : "—"}</td>
                    <td><span className={`chip ${APP_STATE_LABEL[x.state as FundingApplication["state"]].chip}`}>{APP_STATE_LABEL[x.state as FundingApplication["state"]].label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {a && r && appScore && seller && buyer && (
        <div className="stack grow-3" style={{ flexBasis: 480 }}>
          <div className="card stack">
            <div className="between" style={{ alignItems: "flex-start" }}>
              <div>
                <span className="muted">Hồ sơ {a.id} · {product?.name}</span>
                <h2 style={{ fontSize: 20, fontWeight: 600 }}>{orgName(data.orgs, r.sellerId)}</h2>
              </div>
              <span className={`chip ${APP_STATE_LABEL[a.state].chip}`}>{APP_STATE_LABEL[a.state].label}</span>
            </div>
            <div className="grid-fields" style={{ fontSize: 13 }}>
              <div><div className="muted">Hóa đơn</div><div className="num">{r.code} · {r.invoiceSeries}-{r.invoiceNumber}</div></div>
              <div><div className="muted">Giá trị</div><div className="num strong">{vnd(r.amount)} đ</div></div>
              <div><div className="muted">Người mua</div><div>{orgName(data.orgs, r.buyerId)} · {buyer.rating}</div></div>
              <div><div className="muted">Hạn thanh toán</div><div className="num">{date(r.dueDate)}</div></div>
              {quote && <div><div className="muted">Báo giá đã chọn</div><div className="num">{quote.ratePct}%/năm · ứng {quote.advancePct}%</div></div>}
              <div><div className="muted"><Term k="esg">ESG</Term></div><div>{esg ? `${dec(esg.result.score, 0)}/100 · độ bao phủ ${Math.round(esg.result.coverage * 100)}%${esg.official ? " (chính thức)" : " (tạm tính)"}` : "Chưa được chia sẻ"}</div></div>
            </div>
            {r.files?.length ? <div className="muted" style={{ fontSize: 12.5 }}>Chứng từ gốc (SHA-256): {r.files.map((f) => f.name).join(", ")}</div> : <div className="muted">Chưa có chứng từ gốc đính kèm — yêu cầu bổ sung nếu cần.</div>}
            {profile?.collateral?.length ? <div className="muted" style={{ fontSize: 12.5 }}>Tài sản bảo đảm khai báo: {profile.collateral.length} tài sản (giá trị khai báo, chưa thẩm định)</div> : null}
          </div>

          <div className="row top" style={{ gap: 12 }}>
            <div className="grow-1"><ScoreBlock title="Điểm hồ sơ tài trợ" s={appScore} term={<Term k="riskScore">Điểm hồ sơ tài trợ</Term>} /></div>
            <div className="grow-1"><ScoreBlock title="Điểm nhà cung cấp (5C)" s={seller} term={<Term k="fiveC">Điểm nhà cung cấp (5C)</Term>} /></div>
            <div className="grow-1"><ScoreBlock title="Điểm bên mua" s={buyer} /></div>
          </div>

          <Disclaimer>Xếp hạng tham khảo FCC — không phải quyết định tín dụng. Bạn tự thẩm định, ra quyết định, ký hợp đồng và giải ngân.</Disclaimer>

          <div className="card stack">
            <h2 className="ct">Quyết định</h2>
            {a.state === "SUBMITTED" && <button className="btn bp" disabled={busy} onClick={() => run(() => act("POST", `/v1/funding-applications/${a.id}/review`), "Đã bắt đầu thẩm định")}>Bắt đầu thẩm định</button>}
            {["SUBMITTED", "UNDER_REVIEW"].includes(a.state) && a.state === "UNDER_REVIEW" && (
              <div className="stack">
                <div className="grid-fields">
                  <label className="field"><span>Số tiền ứng (đ)</span><input className="input num" inputMode="numeric" value={form.advance} onChange={(e) => setForm({ ...form, advance: e.target.value.replace(/\D/g, "") })} /></label>
                  <label className="field"><span>Lãi suất (%/năm)</span><input className="input num" inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value.replace(",", ".") })} /></label>
                  <label className="field"><span>Phí (đ)</span><input className="input num" inputMode="numeric" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value.replace(/\D/g, "") })} /></label>
                  <label className="field"><span>Kỳ hạn (ngày)</span><input className="input num" inputMode="numeric" value={form.tenor} onChange={(e) => setForm({ ...form, tenor: e.target.value.replace(/\D/g, "") })} /></label>
                  <label className="field"><span>Hạn doanh nghiệp chấp thuận</span><input className="input num" type="date" min={addDays(0)} value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} /></label>
                </div>
                <label className="field"><span>Điều kiện</span><textarea className="input" rows={2} value={form.cond} onChange={(e) => setForm({ ...form, cond: e.target.value })} /></label>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn bp" disabled={busy || !form.advance || !form.rate || !form.tenor} onClick={() => run(() => act("POST", `/v1/funding-applications/${a.id}/offer`, { advanceVnd: Number(form.advance), ratePct: Number(form.rate), feesVnd: Number(form.fees || 0), tenorDays: Number(form.tenor), conditions: form.cond, expiresAt: form.expires }), "Đã gửi đề nghị tài trợ chính thức")}>Gửi đề nghị tài trợ</button>
                  <button className="btn bs" onClick={() => setRejecting(rejecting === "" ? " " : "")}>Từ chối…</button>
                </div>
              </div>
            )}
            {["SUBMITTED"].includes(a.state) && <button className="btn bs" onClick={() => setRejecting(rejecting === "" ? " " : "")}>Từ chối…</button>}
            {rejecting !== "" && ["SUBMITTED", "UNDER_REVIEW"].includes(a.state) && (
              <div className="stack-sm">
                <label className="field"><span>Lý do từ chối (bắt buộc)</span><textarea className="input" rows={2} value={rejecting.trim() ? rejecting : ""} onChange={(e) => setRejecting(e.target.value || " ")} /></label>
                <button className="btn bs" disabled={busy || !rejecting.trim()} onClick={() => run(() => act("POST", `/v1/funding-applications/${a.id}/reject`, { reason: rejecting.trim() }), "Đã từ chối hồ sơ")}>Xác nhận từ chối</button>
              </div>
            )}
            {a.state === "OFFERED" && a.offer && <div className="muted">Đã gửi đề nghị: ứng {vnd(a.offer.advanceVnd)} đ, {a.offer.ratePct}%/năm, hạn chấp thuận {date(a.offer.expiresAt)}. Chờ doanh nghiệp.</div>}
            {a.state === "ACCEPTED" && (
              <div className="stack-sm">
                <div className="okmsg">Doanh nghiệp đã chấp thuận. Ký hợp đồng trên kênh của bạn rồi ghi nhận giải ngân (cần MFA).</div>
                <button className="btn bp" disabled={busy} onClick={() => run(() => act("POST", `/v1/funding-applications/${a.id}/fund`), "Đã ghi nhận giải ngân")}>Ghi nhận giải ngân</button>
              </div>
            )}
            {a.state === "FUNDED" && <div className="okmsg">Đã giải ngân {vnd(a.fundedAmount ?? a.offer?.advanceVnd ?? 0)} đ ngày {date(a.fundedAt)}. Theo dõi thu hồi ở Giám sát & EWS.</div>}
            {a.state === "SETTLED" && <div className="muted">Đã tất toán ngày {date(a.settledAt)}.</div>}
            {a.state === "REJECTED" && <div className="muted">Hồ sơ đã bị từ chối.</div>}
          </div>
          <div className="dark stack-sm">
            <span className="d-title"><Sparkles size={18} color="#DDF1C4" aria-hidden="true" />Vì sao điểm này?</span>
            <p>Mỗi thành phần điểm ở trên kèm độ bao phủ dữ liệu; thiếu dữ liệu hiển thị “Chưa xác minh” thay vì điểm 0. Cờ rủi ro nghiêm trọng không bị điểm bình quân che lấp.</p>
          </div>
        </div>
      )}
    </section>
    </>
  );
}
