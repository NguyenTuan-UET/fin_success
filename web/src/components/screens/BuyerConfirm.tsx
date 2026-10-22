"use client";

import { useMemo, useState } from "react";
import type { Receivable } from "@fcc/domain/types";
import { cx, date, dateTime, daysFromNow, today, vnd } from "@/lib/format";
import { orgName, RECEIVABLE_STAGE } from "@/lib/model";
import { useData } from "@/lib/session";
import { useScores } from "@/lib/scores";
import { Term } from "@/components/ui/Term";
import { DateInput, MoneyInput } from "@/components/ui/Fields";
import { InvoiceDocuments, missingDocs, RevisionHistory } from "@/components/screens/InvoiceParts";
import { CustomsDocuments } from "@/components/screens/CustomsDocuments";
import { useToast } from "@/components/providers/Toast";

const HURDLE = 0.045; // chi phí cơ hội tiền mặt, %/năm (cấu hình mặc định)

export function BuyerConfirm() {
  const { data, org, act } = useData();
  const toast = useToast();
  const scores = useScores(data);
  const [sel, setSel] = useState<string | null>(null);
  const [dispute, setDispute] = useState<{ id: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [payFor, setPayFor] = useState<{ r: Receivable; amount: number | null; paidAt: string; reference: string } | null>(null);
  const [offerFor, setOfferFor] = useState<Receivable | null>(null);
  const [disc, setDisc] = useState("1");
  const [payBy, setPayBy] = useState("");

  const mine = useMemo(() => data.receivables.filter((r) => r.buyerId === org.id), [data.receivables, org.id]);
  const pending = mine.filter((r) => r.state === "BUYER_PENDING");
  const confirmed = mine.filter((r) => ["BUYER_CONFIRMED", "SUBMITTED", "UNDER_REVIEW", "OFFERED", "ACCEPTED", "FUNDED", "OVERDUE"].includes(r.state));
  const s = mine.find((r) => r.id === sel) ?? pending[0] ?? null;
  const offers = data.earlyOffers.filter((o) => o.buyerId === org.id);
  const activeApp = (rid: string) => data.applications.some((a) => a.receivableId === rid && !["REJECTED", "WITHDRAWN"].includes(a.state));

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

  const updatedAt = (r: Receivable) => r.revisions?.at(-1)?.at ?? r.sentAt;
  const confirm = (p: Receivable) => run(() => act("POST", `/v1/receivables/${p.id}/buyer-decision`, { confirm: true, version: p.version }), `Đã xác nhận ${p.code} (v${p.version}). ${orgName(data.orgs, p.sellerId)} có thể dùng hóa đơn này để nhận tiền sớm.`);

  return (
    <>
      <section className="row top">
        <div className="card flush grow-3">
          <div className="ch">
            <h2 className="ct">Chờ xác nhận</h2>
            <span className="muted">{pending.length ? `${pending.length} hóa đơn · ${vnd(pending.reduce((a, p) => a + p.amount, 0))} đ` : "Không có hóa đơn nào chờ xác nhận"}</span>
          </div>
          <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm">
            <table className="cards">
              <thead>
                <tr><th>Hóa đơn</th><th>Nhà cung cấp</th><th className="r">Số tiền (đ)</th><th>Hạn thanh toán</th><th><Term k="threeWay">Chứng từ</Term></th><th>Quyết định</th></tr>
              </thead>
              <tbody>
                {pending.map((p) => {
                  const warn = missingDocs(p);
                  return (
                    <tr key={p.id} className={cx("clickable", s?.id === p.id && "sel")} onClick={() => setSel(p.id)}>
                      <td data-label="Hóa đơn"><button className="link-btn num" onClick={() => setSel(p.id)}>{p.code}</button> <span className="muted">v{p.version}</span>{p.version > 1 && <span className="chip c-warn" style={{ marginLeft: 6 }}>Đã điều chỉnh</span>}<div className="muted num">{p.invoiceSeries}-{p.invoiceNumber}</div></td>
                      <td data-label="Nhà cung cấp" className="wrap" style={{ minWidth: 110 }}>{orgName(data.orgs, p.sellerId)}</td>
                      <td data-label="Số tiền (đ)" className="r num">{vnd(p.amount)}</td>
                      <td data-label="Hạn thanh toán" className="num">{date(p.dueDate)}</td>
                      <td data-label="Chứng từ"><span className={`chip ${warn ? "c-warn" : "c-info"}`}>{warn ? `Có ${3 - warn}/3` : "Đã tải đủ 3/3"}</span></td>
                      <td data-label="Quyết định" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn bp sm" disabled={busy} onClick={() => confirm(p)}>Xác nhận v{p.version}</button>
                          <button className="btn bs sm" disabled={busy} onClick={() => setDispute({ id: p.id, reason: "" })}>Hỏi lại</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pending.length === 0 && <tr><td colSpan={6} className="empty">Đã xử lý hết.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="card grow-1 stack-sm" style={{ gap: 12 }} aria-label="Đối chiếu chi tiết">
          {s ? (
            <>
              <span className="muted">Đối chiếu chi tiết</span>
              <h2 className="num" style={{ fontSize: 20, fontWeight: 600 }}>{s.code} <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>phiên bản v{s.version}</span></h2>
              <span style={{ fontSize: 13 }}>{orgName(data.orgs, s.sellerId)} · <span className="num">{vnd(s.amount)} đ</span> · hạn {date(s.dueDate)}</span>
              {updatedAt(s) && <span className="muted">Cập nhật lần cuối {dateTime(updatedAt(s))}</span>}
              <span className="muted">Xếp hạng nhà cung cấp (tham khảo): {(() => { const x = scores.supplier(s.sellerId); return !x.official && x.coverage < 0.5 ? "chưa đủ dữ liệu" : `${x.rating}${x.official ? "" : " · tạm tính"}`; })()}</span>
              <RevisionHistory r={s} />
              <InvoiceDocuments r={s} />
              <CustomsDocuments r={s} />
              <div className="muted" style={{ fontSize: 12.5 }}>FCC lưu chứng từ nhà cung cấp tải lên nhưng chưa tự đối chiếu nội dung với đơn hàng hay biên bản của bạn — hãy kiểm tra trước khi xác nhận.</div>
              {s.state === "BUYER_PENDING" && <div className="row" style={{ gap: 8 }}><button className="btn bp" disabled={busy} onClick={() => confirm(s)}>Xác nhận phiên bản v{s.version}</button><button className="btn bs" disabled={busy} onClick={() => setDispute({ id: s.id, reason: "" })}>Hỏi lại</button></div>}
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", background: "var(--info-bg)", padding: "10px 12px", borderRadius: 10 }}>
                Xác nhận là khẳng định khoản phải trả là thật và đúng hạn (cần xác thực MFA). Nếu nhà cung cấp tài trợ hóa đơn này, bạn thanh toán đúng hạn — không phát sinh nghĩa vụ mới.
              </div>
            </>
          ) : <div className="empty">Chọn một hóa đơn để xem đối chiếu.</div>}
        </aside>
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Hóa đơn đã xác nhận</h2><span className="muted">Ghi nhận thanh toán khi bạn đã chuyển tiền</span></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm">
          <table className="cards">
            <thead><tr><th>Hóa đơn</th><th>Nhà cung cấp</th><th className="r">Số tiền (đ)</th><th>Hạn</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {confirmed.map((r) => {
                const d = daysFromNow(r.dueDate);
                const canEarly = r.state === "BUYER_CONFIRMED" && !activeApp(r.id) && !offers.some((o) => o.receivableId === r.id && ["OPEN", "ACCEPTED"].includes(o.state));
                return (
                  <tr key={r.id}>
                    <td data-label="Hóa đơn" className="num strong">{r.code}</td>
                    <td data-label="Nhà cung cấp">{orgName(data.orgs, r.sellerId)}</td>
                    <td data-label="Số tiền (đ)" className="r num">{vnd(r.amount)}</td>
                    <td data-label="Hạn"><div className="num">{date(r.dueDate)}</div><div className={cx("muted", d < 0 && "t-bad")}>{d < 0 ? `quá hạn ${-d} ngày` : `còn ${d} ngày`}</div></td>
                    <td data-label="Trạng thái"><span className={`chip ${RECEIVABLE_STAGE[r.state].chip}`}>{RECEIVABLE_STAGE[r.state].short}</span></td>
                    <td data-label="Thao tác" style={{ display: "flex", gap: 6 }}>
                      {canEarly && <button className="btn bs sm" onClick={() => { setOfferFor(r); setPayBy(addDays(today(), 7)); }}>Đề nghị trả sớm</button>}
                      {["BUYER_CONFIRMED", "FUNDED", "OVERDUE"].includes(r.state) && (
                        <button className="btn bp sm" disabled={busy} onClick={() => setPayFor({ r, amount: r.amount, paidAt: today(), reference: "" })}>Ghi nhận đã thanh toán</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {confirmed.length === 0 && <tr><td colSpan={6} className="empty">Chưa có hóa đơn đã xác nhận.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card flush">
        <div className="ch"><div><h2 className="ct"><Term k="earlyPay">Chiết khấu thanh toán sớm</Term></h2><p className="muted">Bạn đề nghị trả trước hạn để được chiết khấu; nhà cung cấp đồng ý rồi bạn tự chuyển tiền, FCC chỉ ghi nhận.</p></div></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm">
          <table>
            <thead><tr><th>Hóa đơn</th><th>Nhà cung cấp</th><th className="r">Số tiền (đ)</th><th className="r">Chiết khấu</th><th>Trả trước</th><th className="r"><Term k="annualYield">Lợi suất quy năm</Term></th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {offers.map((o) => {
                const r = data.receivables.find((x) => x.id === o.receivableId);
                if (!r) return null;
                const days = Math.max(1, Math.round((new Date(r.dueDate).getTime() - new Date(o.payBy).getTime()) / 86_400_000));
                const y = (o.discountPct / 100 / days) * 365;
                const pay = r.amount * (1 - o.discountPct / 100);
                return (
                  <tr key={o.id}>
                    <td className="num strong">{r.code}</td>
                    <td>{orgName(data.orgs, r.sellerId)}</td>
                    <td className="r num">{vnd(r.amount)}</td>
                    <td className="r num">{o.discountPct}% → trả {vnd(pay)} đ</td>
                    <td className="num">{date(o.payBy)}</td>
                    <td className={cx("r num", y > HURDLE ? "t-ok strong" : "t-bad")}>{(y * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</td>
                    <td><span className={`chip ${o.state === "PAID" ? "c-ok" : o.state === "ACCEPTED" ? "c-info" : "c-neu"}`}>{{ OPEN: "Chờ nhà cung cấp", ACCEPTED: "Nhà cung cấp đồng ý", PAID: "Đã trả", EXPIRED: "Hết hạn", CANCELLED: "Đã hủy" }[o.state]}</span></td>
                    <td>{o.state === "ACCEPTED" && <button className="btn bp sm" disabled={busy} onClick={() => run(() => act("POST", `/v1/early-payment-offers/${o.id}/paid`), `Đã ghi nhận trả sớm ${r.code}`)}>Ghi nhận đã trả</button>}</td>
                  </tr>
                );
              })}
              {offers.length === 0 && <tr><td colSpan={8} className="empty">Chưa có đề nghị trả sớm. Chọn “Đề nghị trả sớm” ở hóa đơn đã xác nhận.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ padding: "12px 16px", borderTop: "1px solid var(--line-2)" }}>Lợi suất quy năm = chiết khấu ÷ số ngày trả sớm × 365. Nên trả sớm khi lợi suất vượt chi phí cơ hội tiền mặt {HURDLE * 100}%/năm.</p>
      </section>

      {dispute && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div className="card modal">
            <h2 className="ct">Yêu cầu nhà cung cấp giải trình</h2>
            <label className="field"><span>Lý do (bắt buộc)</span><textarea className="input" rows={3} value={dispute.reason} onChange={(e) => setDispute({ ...dispute, reason: e.target.value })} placeholder="VD: giao thiếu số lượng, sai đơn giá…" /></label>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn bs" onClick={() => setDispute(null)}>Hủy</button>
              <button className="btn bp" disabled={!dispute.reason.trim() || busy} onClick={() => run(async () => { await act("POST", `/v1/receivables/${dispute.id}/buyer-decision`, { confirm: false, reason: dispute.reason }); setDispute(null); }, "Đã gửi yêu cầu giải trình")}>Gửi</button>
            </div>
          </div>
        </div>
      )}
      {payFor && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div className="card modal">
            <h2 className="ct">Ghi nhận thanh toán {payFor.r.code}</h2>
            <div className="muted">{payFor.r.state === "BUYER_CONFIRMED" ? "Khoản chưa tài trợ: thanh toán trực tiếp cho nhà cung cấp, FCC chỉ ghi nhận." : "Khoản đã tài trợ: tiền chuyển cho tổ chức tài chính; họ xác nhận tiền về thì mới tất toán và đối soát với số bạn báo."}</div>
            <MoneyInput label="Số tiền đã trả (đ)" value={payFor.amount} onChange={(v) => setPayFor({ ...payFor, amount: v })} />
            <DateInput label="Ngày trả" max={today()} value={payFor.paidAt} onChange={(v) => setPayFor({ ...payFor, paidAt: v })} />
            <label className="field"><span>Số chứng từ chuyển khoản</span><input className="input" value={payFor.reference} onChange={(e) => setPayFor({ ...payFor, reference: e.target.value })} /></label>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn bs" onClick={() => setPayFor(null)}>Hủy</button>
              <button className="btn bp" disabled={busy || !payFor.amount} onClick={() => run(async () => { await act("POST", `/v1/receivables/${payFor.r.id}/buyer-payment`, { amount: payFor.amount, paidAt: payFor.paidAt, reference: payFor.reference || undefined }); setPayFor(null); }, `Đã ghi nhận thanh toán ${payFor.r.code}`)}>Ghi nhận</button>
            </div>
          </div>
        </div>
      )}
      {offerFor && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div className="card modal">
            <h2 className="ct">Đề nghị thanh toán sớm {offerFor.code}</h2>
            <label className="field"><span>Chiết khấu (% giá trị hóa đơn)</span><input className="input num" inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value.replace(",", "."))} /></label>
            <DateInput label="Ngày trả" min={today()} max={offerFor.dueDate} value={payBy} onChange={setPayBy} />
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn bs" onClick={() => setOfferFor(null)}>Hủy</button>
              <button className="btn bp" disabled={busy || !(Number(disc) > 0) || !payBy} onClick={() => run(async () => { await act("POST", "/v1/early-payment-offers", { receivableId: offerFor.id, discountPct: Number(disc), payBy }); setOfferFor(null); }, "Đã gửi đề nghị tới nhà cung cấp")}>Gửi đề nghị</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86_400_000).toISOString().slice(0, 10);
