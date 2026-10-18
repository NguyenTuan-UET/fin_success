"use client";

import { useMemo } from "react";
import { ewsAlerts } from "@fcc/domain/ews";
import { cx, date, daysFromNow, money, vnd } from "@/lib/format";
import { orgName } from "@/lib/model";
import { useData } from "@/lib/session";
import { Kpi, Disclaimer } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";

const SEV: Record<string, [string, string]> = { high: ["Cao", "c-bad"], medium: ["Trung bình", "c-warn"], low: ["Thấp", "c-info"] };

export function LenderMonitoring() {
  const { data, org } = useData();
  const apps = useMemo(() => data.applications.filter((a) => a.lenderId === org.id), [data.applications, org.id]);
  const alerts = useMemo(() => ewsAlerts(data, apps, new Date()), [data, apps]);
  const funded = apps.filter((a) => a.state === "FUNDED").map((a) => ({ a, r: data.receivables.find((x) => x.id === a.receivableId)! })).filter((x) => x.r).sort((x, y) => (x.r.dueDate > y.r.dueDate ? 1 : -1));
  const exposure = funded.reduce((t, x) => t + (x.a.fundedAmount ?? x.a.offer?.advanceVnd ?? 0), 0);
  const overdue = funded.filter((x) => x.r.state === "OVERDUE" || daysFromNow(x.r.dueDate) < 0);

  return (
    <>
      <section className="grid-kpi">
        <Kpi label="Dư nợ đang theo dõi" value={money(exposure)} note={`${funded.length} khoản`} />
        <Kpi label="Cảnh báo" value={String(alerts.length)} note={`${alerts.filter((a) => a.severity === "high").length} mức cao`} tone={alerts.some((a) => a.severity === "high") ? "bad" : undefined} />
        <Kpi label="Quá hạn" value={String(overdue.length)} note={overdue.length ? `${money(overdue.reduce((t, x) => t + (x.a.fundedAmount ?? 0), 0))} đ` : "Không có khoản quá hạn"} tone={overdue.length ? "bad" : "ok"} />
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct"><Term k="ews">Cảnh báo sớm</Term></h2></div>
        {alerts.length === 0 && <div className="empty">Không có cảnh báo. Danh mục đang bình thường.</div>}
        {alerts.map((a) => (
          <div key={a.id} className="stack-sm" style={{ padding: "12px 16px", borderTop: "1px solid var(--line-2)" }}>
            <div className="between">
              <strong>{a.title}</strong>
              <span className={`chip ${SEV[a.severity][1]}`}>{SEV[a.severity][0]}</span>
            </div>
            <div className="muted">{a.detail}</div>
            <div style={{ fontSize: 13 }}>Đề xuất: {a.suggestion}</div>
          </div>
        ))}
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Lịch thu hồi</h2><span className="muted">Theo hạn thanh toán của bên mua</span></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Hạn</th><th>Hồ sơ</th><th>Doanh nghiệp</th><th>Bên mua</th><th className="r">Dư nợ (đ)</th><th>Tình trạng</th></tr></thead>
          <tbody>
            {funded.map(({ a, r }) => {
              const d = daysFromNow(r.dueDate);
              return (
                <tr key={a.id} className={cx(d < 0 && "sel")}>
                  <td className="num">{date(r.dueDate)}</td><td className="num strong">{a.id}</td><td>{orgName(data.orgs, r.sellerId)}</td><td>{orgName(data.orgs, r.buyerId)}</td>
                  <td className="r num">{vnd(a.fundedAmount ?? a.offer?.advanceVnd ?? 0)}</td>
                  <td><span className={`chip ${d < 0 ? "c-bad" : d <= 7 ? "c-warn" : "c-ok"}`}>{d < 0 ? `Quá hạn ${-d} ngày` : d <= 7 ? `Còn ${d} ngày` : "Bình thường"}</span></td>
                </tr>
              );
            })}
            {funded.length === 0 && <tr><td colSpan={6} className="empty">Chưa có khoản đang tài trợ.</td></tr>}
          </tbody>
        </table></div>
      </section>
      <Disclaimer>Cảnh báo là gợi ý theo luật cố định (quá hạn, sắp đến hạn, lịch sử thanh toán, xếp hạng bên mua, tập trung, tranh chấp). FCC không thu hồi nợ hay xử lý tài sản thay tổ chức tài chính.</Disclaimer>
    </>
  );
}
