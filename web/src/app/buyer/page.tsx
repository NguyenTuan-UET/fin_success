"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { Disclaimer, Kpi, PageHeader } from "@/components/ui/basic";
import { TodoTiles, type Todo } from "@/components/ui/TodoTiles";
import { date, daysFromNow, money, vnd } from "@/lib/format";
import { orgName, RECEIVABLE_STAGE, sumAmount } from "@/lib/model";
import { useData } from "@/lib/session";
import { useScores } from "@/lib/scores";

export default function BuyerOverview() {
  const { data, org, me } = useData();
  const scores = useScores(data);
  const mine = data.receivables.filter((r) => r.buyerId === org.id && !["DRAFT", "CANCELLED"].includes(r.state));
  const pending = mine.filter((r) => r.state === "BUYER_PENDING");
  const payable = mine.filter((r) => ["BUYER_CONFIRMED", "SUBMITTED", "UNDER_REVIEW", "OFFERED", "ACCEPTED", "FUNDED", "OVERDUE"].includes(r.state)).sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));
  const dueSoon = payable.filter((r) => daysFromNow(r.dueDate) <= 7);
  const overdue = payable.filter((r) => r.state === "OVERDUE" || daysFromNow(r.dueDate) < 0);
  const suppliers = [...new Set(mine.map((r) => r.sellerId))];
  const earlyOpen = data.earlyOffers.filter((o) => o.buyerId === org.id && ["OPEN", "ACCEPTED"].includes(o.state));
  const rating = scores.buyer(org.id);

  // lịch thanh toán theo tuần, 8 tuần tới
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = i * 7;
    const items = payable.filter((r) => { const d = daysFromNow(r.dueDate); return d >= from && d < from + 7; });
    return { i, from, items, total: sumAmount(items) };
  });
  const maxW = Math.max(1, ...weeks.map((w) => w.total));

  const todos: Todo[] = [
    ...(pending.length ? [{ icon: Clock, bg: "var(--warn-bg)", fg: "var(--warn)", title: `${pending.length} hóa đơn chờ bạn xác nhận`, note: `Tổng ${money(sumAmount(pending))} đ`, href: "/buyer/invoices", cta: "Xác nhận" }] : []),
    ...(overdue.length ? [{ icon: AlertTriangle, bg: "var(--bad-bg)", fg: "var(--bad)", title: `${overdue.length} khoản quá hạn thanh toán`, note: `${money(sumAmount(overdue))} đ`, href: "/buyer/invoices", cta: "Xử lý" }] : []),
    ...(dueSoon.length ? [{ icon: Clock, bg: "var(--info-bg)", fg: "var(--info)", title: `${dueSoon.length} khoản đến hạn trong 7 ngày`, note: `${money(sumAmount(dueSoon))} đ`, href: "/buyer/invoices", cta: "Xem" }] : []),
    ...(earlyOpen.length ? [{ icon: Sparkles, bg: "var(--ok-bg)", fg: "var(--ok)", title: `${earlyOpen.length} đề nghị trả sớm đang mở`, note: "Theo dõi phản hồi nhà cung cấp", href: "/buyer/invoices", cta: "Xem" }] : []),
  ];

  return (
    <>
      <PageHeader eyebrow="Tổng quan · Người mua" title={`Xin chào, ${me.name}`} sub="Xác nhận hóa đơn, lên lịch thanh toán và theo dõi nhà cung cấp của bạn." />
      {todos.length > 0 ? <TodoTiles items={todos} /> : <section className="card empty">Chưa có việc cần làm. Hóa đơn nhà cung cấp gửi tới sẽ xuất hiện ở đây.</section>}
      <section className="grid-kpi">
        <Kpi label="Phải trả (đã xác nhận)" value={money(sumAmount(payable))} note={`${payable.length} hóa đơn`} />
        <Kpi label="Chờ xác nhận" value={String(pending.length)} note={money(sumAmount(pending)) + " đ"} />
        <Kpi label="Nhà cung cấp" value={String(suppliers.length)} note="đã gửi hóa đơn cho bạn" />
        <Kpi label="Xếp hạng của bạn (tham khảo)" value={rating.rating} note={rating.official ? "Điểm chính thức" : `Tạm tính · bao phủ ${Math.round(rating.coverage * 100)}%`} />
      </section>
      <section className="row top">
        <div className="card grow-2 stack-sm">
          <h2 className="ct">Lịch thanh toán 8 tuần tới</h2>
          {weeks.map((w) => (
            <div key={w.i} style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px", gap: 10, alignItems: "center", fontSize: 13 }}>
              <span className="muted">Tuần {w.i + 1}</span>
              <div className="bar"><span className="fill" style={{ width: `${(w.total / maxW) * 100}%` }} /></div>
              <span className="num r">{w.total ? `${money(w.total)} đ` : "—"}</span>
            </div>
          ))}
          {overdue.length > 0 && <div className="err">Đã quá hạn: {money(sumAmount(overdue))} đ ({overdue.length} khoản)</div>}
        </div>
        <div className="card flush grow-2">
          <div className="ch"><h2 className="ct">Sắp đến hạn</h2><Link className="btn bs sm" href="/buyer/invoices">Tất cả</Link></div>
          <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
            <thead><tr><th>Mã</th><th>Nhà cung cấp</th><th className="r">Số tiền (đ)</th><th>Hạn</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {payable.slice(0, 6).map((r) => <tr key={r.id}><td className="num strong">{r.code}</td><td>{orgName(data.orgs, r.sellerId)}</td><td className="r num">{vnd(r.amount)}</td><td className="num">{date(r.dueDate)}</td><td><span className={`chip ${RECEIVABLE_STAGE[r.state].chip}`}>{RECEIVABLE_STAGE[r.state].short}</span></td></tr>)}
              {payable.length === 0 && <tr><td colSpan={5} className="empty">Không có khoản phải trả.</td></tr>}
            </tbody></table></div>
        </div>
      </section>
      <Disclaimer>Xác nhận hóa đơn trên FCC là xác nhận nghĩa vụ thanh toán; FCC không giữ tiền — bạn thanh toán trực tiếp theo thỏa thuận.</Disclaimer>
    </>
  );
}
