"use client";

import Link from "next/link";
import { useState } from "react";
import type { FundingApplication, Receivable } from "@fcc/domain/types";
import { cx, date, daysFromNow, dec, vnd } from "@/lib/format";
import { APP_STATE_LABEL, orgName } from "@/lib/model";
import { useData } from "@/lib/session";
import { Term } from "@/components/ui/Term";
import { SettlementPanel } from "./SettlementPanel";
import { useToast } from "@/components/providers/Toast";

const STEPS = [
  "Hồ sơ đã gửi", "Tổ chức tài chính thẩm định", "Đề nghị chính thức", "Doanh nghiệp chấp thuận", "Giải ngân", "Giám sát & cảnh báo sớm",
  "Người mua thanh toán", "Thu hồi gốc & phí", "Tất toán, hoàn phần dư",
];
const stepOf = (a: FundingApplication, r?: Receivable) => ({ SUBMITTED: 1, UNDER_REVIEW: 1, OFFERED: 2, ACCEPTED: 3, FUNDED: r?.state === "OVERDUE" ? 5 : 5, SETTLED: 8, REJECTED: -1, WITHDRAWN: -1 })[a.state];

export function Disbursement() {
  const { data, org, act } = useData();
  const toast = useToast();
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apps = data.applications.filter((a) => data.receivables.find((r) => r.id === a.receivableId)?.sellerId === org.id).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const a = apps.find((x) => x.id === sel) ?? apps[0] ?? null;
  const r = a ? data.receivables.find((x) => x.id === a.receivableId) : undefined;

  if (!apps.length) return <section className="card empty stack" style={{ alignItems: "center" }}><strong>Chưa có hồ sơ tài trợ.</strong><span>Chọn báo giá ở Marketplace để gửi hồ sơ cho tổ chức tài chính.</span><Link className="btn bp" href="/supplier/marketplace">Tới Marketplace</Link></section>;

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };

  const o = a?.offer;
  const interest = o ? (o.advanceVnd * o.ratePct) / 100 * (o.tenorDays / 365) : 0;
  const back = r && o ? r.amount - o.advanceVnd - interest - o.feesVnd : 0;
  const step = a ? stepOf(a, r) : -1;
  const events = a ? data.audit.filter((e) => e.entity === a.id || e.entity === r?.code || e.entity === r?.id).slice(0, 12) : [];

  return (
    <>
      <section className="card flush">
        <div className="ch"><h2 className="ct">Hồ sơ của bạn</h2></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm">
          <table>
            <thead><tr><th>Hồ sơ</th><th>Hóa đơn</th><th>Tổ chức tài chính</th><th className="r">Đề nghị (đ)</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {apps.map((x) => {
                const rc = data.receivables.find((y) => y.id === x.receivableId);
                return (
                  <tr key={x.id} className={cx("clickable", a?.id === x.id && "sel")} onClick={() => setSel(x.id)}>
                    <td className="num strong">{x.id}</td><td className="num">{rc?.code}</td><td>{orgName(data.orgs, x.lenderId)}</td>
                    <td className="r num">{x.offer ? vnd(x.offer.advanceVnd) : "—"}</td>
                    <td><span className={`chip ${APP_STATE_LABEL[x.state].chip}`}>{APP_STATE_LABEL[x.state].label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {a && r && (
        <>
          <section className="card" aria-label="Vòng đời khoản tài trợ">
            <div className="ch"><h2 className="ct">Vòng đời {a.id}</h2><span className="muted">{step >= 0 ? `Bước ${Math.min(step + 1, STEPS.length)} / ${STEPS.length}` : "Đã dừng"}</span></div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 10 }}>
              {STEPS.map((t, i) => {
                const done = step >= 0 && i < step;
                const cur = step >= 0 && i === step;
                return (
                  <li key={t} aria-current={cur ? "step" : undefined} style={{ padding: 12, borderRadius: 12, display: "flex", flexDirection: "column", gap: 4, background: done ? "var(--surface-3)" : cur ? "var(--forest)" : "#fff", color: cur ? "#fff" : undefined, border: !done && !cur ? "1px solid var(--line)" : "1px solid transparent" }}>
                    <span className="num" style={{ fontSize: 12.5, color: cur ? "var(--on-forest-2)" : "var(--ink-3)" }}>{String(i + 1).padStart(2, "0")}</span>
                    <strong style={{ fontSize: 13 }}>{t}</strong>
                    {done && <span className="chip c-ok" style={{ alignSelf: "flex-start" }}>Xong</span>}
                    {cur && <span className="chip c-lime" style={{ alignSelf: "flex-start" }}>Hiện tại</span>}
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="row top">
            <div className="card grow-3 stack">
              <h2 className="ct">{o ? "Đề nghị tài trợ" : "Chưa có đề nghị"}</h2>
              {!o && <p className="muted">{a.state === "REJECTED" ? "Tổ chức tài chính đã từ chối hồ sơ." : "Tổ chức tài chính đang thẩm định. Bạn sẽ nhận thông báo khi có đề nghị chính thức."}</p>}
              {o && (
                <>
                  <div className="grid-fields" style={{ fontSize: 13 }}>
                    <div><div className="muted">Tổ chức tài chính</div><div className="strong">{orgName(data.orgs, a.lenderId)}</div></div>
                    <div><div className="muted">Ứng trước</div><div className="num strong">{vnd(o.advanceVnd)} đ ({dec((o.advanceVnd / r.amount) * 100, 0)}%)</div></div>
                    <div><div className="muted">Lãi suất</div><div className="num">{o.ratePct}%/năm · {o.tenorDays} ngày</div></div>
                    <div><div className="muted">Phí</div><div className="num">{vnd(o.feesVnd)} đ</div></div>
                    <div><div className="muted">Hạn chấp thuận</div><div className="num">{date(o.expiresAt)}{a.state === "OFFERED" && ` (còn ${daysFromNow(o.expiresAt)} ngày)`}</div></div>
                    <div><div className="muted">Điều kiện</div><div>{o.conditions || "—"}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 2, height: 40, borderRadius: 8, overflow: "hidden" }} role="img" aria-label="Phân bổ giá trị hóa đơn">
                    <div style={{ flex: o.advanceVnd, background: "var(--forest)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12 }}>Ứng trước</div>
                    <div style={{ flex: Math.max(interest + o.feesVnd, r.amount * 0.01), background: "var(--warn-strong)" }} title="Lãi và phí" />
                    <div style={{ flex: Math.max(back, 0), background: "var(--brand-fill)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12 }}>Hoàn trả</div>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Khi người mua thanh toán {vnd(r.amount)} đ ngày {date(r.dueDate)}: tổ chức tài chính thu {vnd(o.advanceVnd)} đ gốc + ước tính {vnd(interest)} đ lãi + {vnd(o.feesVnd)} đ phí; phần còn lại khoảng <strong className="num">{vnd(back)} đ</strong> hoàn cho bạn. Số cuối cùng theo hợp đồng của tổ chức tài chính.
                  </div>
                </>
              )}
              {a.state === "OFFERED" && (
                <button className="btn bp" disabled={busy} onClick={() => run(() => act("POST", `/v1/funding-applications/${a.id}/accept`), "Đã chấp thuận đề nghị. Tổ chức tài chính sẽ ký hợp đồng và giải ngân.")}>Chấp thuận đề nghị (cần MFA)</button>
              )}
              {a.state === "ACCEPTED" && <div className="okmsg">Đã chấp thuận — chờ tổ chức tài chính giải ngân (mục tiêu T+1).</div>}
              {a.state === "FUNDED" && <div className="okmsg">Đã nhận {vnd(a.fundedAmount ?? o?.advanceVnd ?? 0)} đ ngày {date(a.fundedAt)}.</div>}
              {a.state === "SETTLED" && <div className="muted">Đã tất toán ngày {date(a.settledAt)}.</div>}
              <SettlementPanel app={a} />
            </div>

            <aside className="stack grow-2">
              <div className="card stack-sm">
                <h2 className="ct">Các lớp bảo vệ thu hồi</h2>
                {[
                  ["Thu hồi từ khoản phải thu", "Người mua thanh toán, tổ chức tài chính thu gốc và phí; phần dư hoàn bạn"],
                  ["Xử lý tài sản bảo đảm", "Chỉ khi thiếu hụt; do tổ chức tài chính thực hiện theo hợp đồng"],
                  ["Không có tài sản bảo đảm", "Dựa trên uy tín người mua và dòng tiền chuỗi cung ứng"],
                  ["Cảnh báo sớm", <Term key="ews" k="ews">EWS</Term>],
                ].map(([t, n], i) => <div key={i} className="soft"><strong style={{ fontSize: 13 }}>{t}</strong><div className="muted">{n}</div></div>)}
              </div>
              <div className="card stack-sm">
                <h2 className="ct">Lịch sử</h2>
                {events.length === 0 && <span className="muted">Chưa có sự kiện.</span>}
                {events.map((e) => <div key={e.id} style={{ fontSize: 12.5 }}><strong>{e.action}</strong><div className="muted">{date(e.at)} · {e.detail}</div></div>)}
              </div>
            </aside>
          </section>
        </>
      )}
    </>
  );
}
