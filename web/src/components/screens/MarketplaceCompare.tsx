"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Send } from "lucide-react";
import type { MatchResult } from "@fcc/domain/marketplace";
import { api } from "@/lib/api";
import { date, dec, vnd } from "@/lib/format";
import { orgName, PRODUCT_TYPE_LABEL } from "@/lib/model";
import { useData } from "@/lib/session";
import { Disclaimer } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";

type Matches = { eligible: MatchResult[]; notEligible: MatchResult[]; note: string };

function Compare() {
  const { data, org, act } = useData();
  const toast = useToast();
  const param = useSearchParams().get("r");
  const [sort, setSort] = useState<"cost" | "advance" | "sla">("cost");
  const [greenOnly, setGreenOnly] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [m, setM] = useState<Matches | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState(false);

  const targets = useMemo(() => data.receivables.filter((r) => r.sellerId === org.id && r.state === "BUYER_CONFIRMED"), [data.receivables, org.id]);
  const [target, setTarget] = useState<string>(param ?? "");
  const rid = targets.some((t) => t.id === target) ? target : targets[0]?.id ?? "";
  const r = targets.find((t) => t.id === rid);
  const hasRfq = data.rfqs.some((q) => q.receivableId === rid && ["OPEN", "RESPONDED"].includes(q.state));

  // tính lại khi đổi hóa đơn/cách sắp xếp, hoặc dữ liệu đổi (sản phẩm mới công bố)
  useEffect(() => {
    if (!rid) return;
    let alive = true;
    api<Matches>("GET", `/v1/receivables/${rid}/matches?sort=${sort}`).then(
      (x) => { if (alive) { setM(x); setLoadErr(""); } },
      (e) => alive && setLoadErr((e as Error).message),
    );
    return () => { alive = false; };
  }, [rid, sort, data.products.length, data.esg.length]);

  const eligible = (m?.eligible ?? []).filter((x) => !greenOnly || x.cost.greenApplied);
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));

  const myRfqs = data.rfqs.filter((q) => q.sellerId === org.id).slice(0, 10);
  const earlyIn = data.earlyOffers.filter((o) => o.state === "OPEN" && data.receivables.find((x) => x.id === o.receivableId)?.sellerId === org.id);

  return (
    <>
      {earlyIn.length > 0 && (
        <section className="card stack-sm">
          <h2 className="ct">Đề nghị thanh toán sớm từ người mua</h2>
          {earlyIn.map((o) => {
            const rc = data.receivables.find((x) => x.id === o.receivableId)!;
            return (
              <div key={o.id} className="between soft">
                <span>{orgName(data.orgs, o.buyerId)} trả {rc.code} ({vnd(rc.amount)} đ) trước {date(o.payBy)}, chiết khấu <strong>{o.discountPct}%</strong> → nhận <strong className="num">{vnd(rc.amount * (1 - o.discountPct / 100))} đ</strong></span>
                <button className="btn bp sm" disabled={busy} onClick={() => run(() => act("POST", `/v1/early-payment-offers/${o.id}/accept`), "Đã đồng ý thanh toán sớm")}>Đồng ý</button>
              </div>
            );
          })}
        </section>
      )}

      {!targets.length ? (
        <section className="card empty stack" style={{ alignItems: "center" }}>
          <strong>Chưa có hóa đơn nào được người mua xác nhận.</strong>
          <span>Chỉ khoản phải thu đã được bên mua xác nhận mới so sánh và gửi tài trợ được.</span>
          <Link className="btn bp" href="/supplier/invoices">Tới Hóa đơn</Link>
        </section>
      ) : (
        <>
          <section className="card row" style={{ gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className="field" style={{ minWidth: 260 }}>
              <span>Hóa đơn cần tài trợ</span>
              <select className="select" value={rid} onChange={(e) => { setTarget(e.target.value); setPicked([]); }}>
                {targets.map((t) => <option key={t.id} value={t.id}>{t.code} · {orgName(data.orgs, t.buyerId)} · {vnd(t.amount)} đ</option>)}
              </select>
            </label>
            <label className="field"><span>Sắp xếp</span>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="cost">Chi phí thấp nhất</option><option value="advance">Tỷ lệ ứng cao nhất</option><option value="sla">Thẩm định nhanh nhất</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 40 }}><input type="checkbox" checked={greenOnly} onChange={(e) => setGreenOnly(e.target.checked)} /> Chỉ gói có ưu đãi xanh</label>
          </section>

          {loadErr && <div className="err">{loadErr}</div>}

          <section className="card flush">
            <div className="ch">
              <div><h2 className="ct">Gói phù hợp</h2><p className="muted">Chi phí ước tính theo biểu giá công bố của tổ chức tài chính — không phải báo giá. Chọn tối đa 3 gói để gửi yêu cầu báo giá.</p></div>
              <button className="btn bp" disabled={!picked.length || busy || hasRfq} onClick={() => run(async () => { await act("POST", "/v1/rfqs", { receivableId: rid, productIds: picked }); setPicked([]); }, "Đã gửi yêu cầu báo giá")}>
                <Send size={16} aria-hidden="true" /> Gửi yêu cầu báo giá ({picked.length}/3)
              </button>
            </div>
            {eligible[0] && <div className="muted" style={{ padding: "0 16px 8px" }}>Cơ sở tính: {eligible[0].cost.tenorDays} ngày theo năm 365 ngày, lãi thu cuối kỳ, phí trả trước được trừ vào thực nhận; chưa gồm thuế và phí dịch vụ FCC. Thứ tự chỉ theo tiêu chí “Sắp xếp” bạn chọn — FCC không xếp hạng theo hoa hồng hay quan hệ với tổ chức tài chính.</div>}
            {hasRfq && <div className="muted" style={{ padding: "0 16px 8px" }}>Hóa đơn này đã có RFQ đang mở. Hủy hoặc chờ phản hồi ở bên dưới.</div>}
            <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm">
              <table>
                <thead><tr><th></th><th>Tổ chức · gói</th><th className="r">Ứng trước</th><th className="r"><Term k="advance">Thực nhận</Term></th><th className="r">Lãi/năm</th><th className="r">Tổng chi phí</th><th className="r">Chi phí hiệu dụng/năm</th><th>Thẩm định</th><th>Ưu đãi xanh</th></tr></thead>
                <tbody>
                  {eligible.map(({ product: p, cost: c }) => (
                    <tr key={p.id}>
                      <td><input type="checkbox" checked={picked.includes(p.id)} disabled={hasRfq} onChange={() => toggle(p.id)} aria-label={`Chọn ${p.name}`} /></td>
                      <td className="wrap"><strong>{orgName(data.orgs, p.lenderId)}</strong><div className="muted">{p.name} · {PRODUCT_TYPE_LABEL[p.type]}</div></td>
                      <td className="r num">{p.pricing.advancePct}%<div className="muted">{vnd(c.advance)} đ</div></td>
                      <td className="r num strong">{vnd(c.netReceived)} đ</td>
                      <td className="r num">{dec(c.rateMin)}{c.rateMax !== c.rateMin ? `–${dec(c.rateMax)}` : ""}%</td>
                      <td className="r num">{vnd(c.totalMin)}{c.totalMax !== c.totalMin ? `–${vnd(c.totalMax)}` : ""} đ<div className="muted">lãi {vnd(c.interestMin)}{c.interestMax !== c.interestMin ? `–${vnd(c.interestMax)}` : ""} + phí {vnd(c.fees)}</div></td>
                      <td className="r num">{dec(c.effAprMin)}{c.effAprMax !== c.effAprMin ? `–${dec(c.effAprMax)}` : ""}%</td>
                      <td>{p.sla.reviewHours ? `${p.sla.reviewHours} giờ` : "—"}</td>
                      <td>{c.greenApplied ? <span className="chip c-ok">−{dec(c.greenDiscount)}%</span> : p.greenRule ? <span className="chip c-neu">Cần ESG ≥ {p.greenRule.minEsg}</span> : "—"}</td>
                    </tr>
                  ))}
                  {eligible.length === 0 && <tr><td colSpan={9} className="empty">{m ? "Chưa có gói phù hợp. Tổ chức tài chính chưa công bố sản phẩm, hoặc hóa đơn chưa đạt điều kiện của gói nào." : "Đang tính…"}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {(m?.notEligible.length ?? 0) > 0 && (
            <section className="card stack-sm">
              <h2 className="ct">Gói chưa phù hợp</h2>
              {m!.notEligible.map((x) => (
                <div key={x.product.id} className="soft"><strong>{orgName(data.orgs, x.product.lenderId)} · {x.product.name}</strong><div className="muted">{x.reasons.join("; ")}</div></div>
              ))}
            </section>
          )}
          {r && <Disclaimer>Gửi yêu cầu báo giá chỉ chia sẻ gói tóm tắt (điểm tín dụng, ESG) cho tối đa 3 tổ chức bạn chọn, trong 5 ngày; chọn một báo giá thì quyền của các bên còn lại bị thu hồi.</Disclaimer>}
        </>
      )}

      {myRfqs.length > 0 && (
        <section className="card flush">
          <div className="ch"><h2 className="ct">Yêu cầu báo giá của bạn</h2></div>
          {myRfqs.map((q) => {
            const rc = data.receivables.find((x) => x.id === q.receivableId);
            return (
              <div key={q.id} className="stack-sm" style={{ padding: 16, borderTop: "1px solid var(--line-2)" }}>
                <div className="between">
                  <span><strong className="num">{q.id}</strong> · {rc?.code} · hết hạn {date(q.expiresAt)}</span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className={`chip ${q.state === "SELECTED" ? "c-ok" : q.state === "RESPONDED" ? "c-info" : "c-neu"}`}>{{ OPEN: "Chờ báo giá", RESPONDED: "Đã có báo giá", SELECTED: "Đã chọn", EXPIRED: "Hết hạn", CANCELLED: "Đã hủy" }[q.state]}</span>
                    {["OPEN", "RESPONDED"].includes(q.state) && <button className="btn bs sm" disabled={busy} onClick={() => run(() => act("POST", `/v1/rfqs/${q.id}/cancel`), "Đã hủy RFQ")}>Hủy</button>}
                  </span>
                </div>
                {q.responses.length === 0 && ["OPEN", "RESPONDED"].includes(q.state) && <div className="muted">Chưa có tổ chức nào trả lời.</div>}
                {q.responses.map((x) => (
                  <div key={x.lenderId + x.productId} className="between soft">
                    <span>
                      <strong>{orgName(data.orgs, x.lenderId)}</strong>{" "}
                      {x.kind === "quote" ? <>báo giá <strong>{x.ratePct}%/năm</strong>, ứng {x.advancePct}%, phí {vnd(x.feesVnd ?? 0)} đ, hiệu lực đến {date(x.validUntil)}</> : <>từ chối{x.conditions ? `: ${x.conditions}` : ""}</>}
                    </span>
                    {x.kind === "quote" && q.state === "RESPONDED" && (
                      <button className="btn bp sm" disabled={busy} onClick={() => run(() => act("POST", `/v1/rfqs/${q.id}/select`, { lenderId: x.lenderId }), "Đã chọn báo giá và gửi hồ sơ")}><Lock size={14} aria-hidden="true" /> Chọn & gửi hồ sơ</button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          <div className="card-foot"><Link className="btn bs sm" href="/supplier/disbursement">Theo dõi hồ sơ & giải ngân</Link></div>
        </section>
      )}
    </>
  );
}

export function MarketplaceCompare() {
  return (
    <Suspense fallback={<div className="empty">Đang tải…</div>}>
      <Compare />
    </Suspense>
  );
}
