"use client";

import { useCallback, useEffect, useState } from "react";
import type { Balance, Reconciliation, SettlementEvent } from "@fcc/domain/settlement";
import type { FundingApplication } from "@fcc/domain/types";
import { api } from "@/lib/api";
import { date, vnd } from "@/lib/format";
import { useData } from "@/lib/session";
import { useToast } from "@/components/providers/Toast";

type Info = { events: SettlementEvent[]; balance: Balance | null; refundDue: number; refundPaid: number; reconciliation: Reconciliation };
const TYPE: Record<SettlementEvent["type"], string> = { buyer_reported: "Bên mua báo đã trả", payment_received: "Tiền về (tổ chức tài chính xác nhận)", collateral_liquidated: "Thanh lý tài sản bảo đảm", refund_due: "Phần dư phải hoàn", refund_paid: "Đã hoàn cho nhà cung cấp" };
const REC: Record<Reconciliation, [string, string]> = { none: ["Chưa có", "c-neu"], pending: ["Chờ xác nhận tiền về", "c-warn"], matched: ["Khớp", "c-ok"], mismatch: ["Lệch — cần đối soát", "c-bad"] };

/** Thu hồi của một hồ sơ: dư nợ theo phí → lãi → gốc, sự kiện tiền, đối soát; tổ chức tài chính xác nhận tiền về / hoàn phần dư. */
export function SettlementPanel({ app }: { app: FundingApplication }) {
  const { org, act } = useData();
  const toast = useToast();
  const isLender = org.type === "lender" && org.id === app.lenderId;
  const [info, setInfo] = useState<Info | null>(null);
  const [f, setF] = useState({ amount: "", paidAt: "", kind: "payment", reference: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<Info>("GET", `/v1/funding-applications/${app.id}/settlement`).then(setInfo, () => undefined), [app.id]);
  // tải lại khi hồ sơ đổi (SSE cập nhật dữ liệu chung → app thay đổi)
   
  useEffect(() => { void load(); }, [load, app.state, app.outstanding, app.refundPaid, app.settlements?.length]);

  if (!["FUNDED", "SETTLED"].includes(app.state) || !info) return null;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); setF({ amount: "", paidAt: "", kind: "payment", reference: "" }); await load(); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const b = info.balance;
  const refundLeft = info.refundDue - info.refundPaid;

  return (
    <div className="stack-sm">
      <div className="between"><strong>Thu hồi & đối soát</strong><span className={`chip ${REC[info.reconciliation][1]}`}>{REC[info.reconciliation][0]}</span></div>
      {b && (
        <div className="grid-fields" style={{ fontSize: 13 }}>
          <div><div className="muted">Gốc còn</div><div className="num">{vnd(b.principal)} đ</div></div>
          <div><div className="muted">Lãi đến hôm nay</div><div className="num">{vnd(b.interest)} đ</div></div>
          <div><div className="muted">Phí còn</div><div className="num">{vnd(b.fees)} đ</div></div>
          <div><div className="muted">Cần thu để tất toán</div><div className="num strong">{vnd(b.outstanding)} đ</div></div>
        </div>
      )}
      {info.events.map((e) => (
        <div key={e.id} className="between soft" style={{ fontSize: 12.5 }}>
          <span>{TYPE[e.type]}{e.reference ? ` · ${e.reference}` : ""}<div className="muted">{date(e.at)}{e.allocation ? ` · phí ${vnd(e.allocation.fees)}, lãi ${vnd(e.allocation.interest)}, gốc ${vnd(e.allocation.principal)}` : ""}</div></span>
          <strong className="num">{vnd(e.amount)} đ</strong>
        </div>
      ))}
      {app.state === "SETTLED" && info.refundDue > 0 && <div className={refundLeft > 0 ? "okmsg" : "muted"}>Phần dư hoàn cho nhà cung cấp: {vnd(info.refundDue)} đ · đã hoàn {vnd(info.refundPaid)} đ{refundLeft > 0 ? ` · còn ${vnd(refundLeft)} đ` : " ✓"}</div>}
      {isLender && app.state === "FUNDED" && (
        <div className="stack-sm">
          <div className="grid-fields">
            <label className="field"><span>Số tiền về (đ)</span><input className="input num" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "") })} placeholder={b ? String(b.outstanding) : ""} /></label>
            <label className="field"><span>Ngày</span><input className="input num" type="date" value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} /></label>
            <label className="field"><span>Loại</span><select className="select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="payment">Thanh toán của bên mua</option><option value="collateral">Thanh lý tài sản bảo đảm</option></select></label>
            <label className="field"><span>Mã giao dịch</span><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></label>
          </div>
          <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={busy || !(Number(f.amount) > 0)} onClick={() => run(() => act("POST", `/v1/funding-applications/${app.id}/payments`, { amount: Number(f.amount), ...(f.paidAt ? { paidAt: f.paidAt } : {}), kind: f.kind, reference: f.reference || undefined }), "Đã ghi nhận tiền về")}>Ghi nhận tiền về (cần MFA)</button>
        </div>
      )}
      {isLender && app.state === "SETTLED" && refundLeft > 0 && (
        <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => run(() => act("POST", `/v1/funding-applications/${app.id}/refunds`, { amount: refundLeft }), "Đã ghi nhận hoàn phần dư")}>Ghi nhận đã hoàn {vnd(refundLeft)} đ</button>
      )}
    </div>
  );
}
