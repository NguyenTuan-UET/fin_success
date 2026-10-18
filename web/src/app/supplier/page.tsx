"use client";

import Link from "next/link";
import { AlertTriangle, CircleAlert, Clock, FileSignature, Sparkles, Upload } from "lucide-react";
import { Bar, Disclaimer, Kpi, PageHeader } from "@/components/ui/basic";
import { CashForecast } from "@/components/charts/CashForecast";
import { TodoTiles, type Todo } from "@/components/ui/TodoTiles";
import { AskButton } from "@/components/assistant/Assistant";
import { daysFromNow, money, vnd, date } from "@/lib/format";
import { orgName, RECEIVABLE_STAGE, sumAmount } from "@/lib/model";
import { useData } from "@/lib/session";
import { useScores } from "@/lib/scores";
import { useCashForecast } from "@/lib/cash";

export default function SupplierOverview() {
  const { data, org, me } = useData();
  const scores = useScores(data);
  const { forecast, hasSetup, openingCash } = useCashForecast(data, org);

  const mine = data.receivables.filter((r) => r.sellerId === org.id && r.state !== "CANCELLED");
  const open = mine.filter((r) => !["SETTLED", "EARLY_PAID", "REJECTED"].includes(r.state));
  const overdue = mine.filter((r) => r.state === "OVERDUE");
  const pending = mine.filter((r) => r.state === "BUYER_PENDING");
  const disputed = mine.filter((r) => r.state === "BUYER_DISPUTED");
  const drafts = mine.filter((r) => r.state === "DRAFT");
  const eligible = mine.filter((r) => r.state === "BUYER_CONFIRMED");
  const funded = data.applications.filter((a) => ["ACCEPTED", "FUNDED"].includes(a.state) && mine.some((r) => r.id === a.receivableId));
  const offers = data.applications.filter((a) => a.state === "OFFERED" && mine.some((r) => r.id === a.receivableId));
  const quotes = data.rfqs.filter((q) => q.sellerId === org.id && q.state === "RESPONDED");
  const ap = data.ledger.filter((l) => l.orgId === org.id && l.kind === "AP").reduce((a, l) => a + l.amount - l.paid, 0);
  const score = scores.supplier(org.id);
  const SAFE = 0; // ngưỡng an toàn: số dư thấp hơn 0 là thiếu hụt thật
  const short = forecast?.shortfall;
  const best = [...eligible].sort((a, b) => scores.buyer(a.buyerId).score - scores.buyer(b.buyerId).score).reverse()[0];

  const todos: Todo[] = [
    ...(short ? [{ icon: AlertTriangle, bg: "var(--warn-bg)", fg: "var(--warn)", title: `Dự báo thiếu hụt ${money(-short.value)} từ ${date(short.date)}`, note: "Xem gói tài trợ để bù thiếu hụt", href: "/supplier/marketplace", cta: "Xem phương án" }] : []),
    ...(offers.length ? [{ icon: FileSignature, bg: "var(--ok-bg)", fg: "var(--ok)", title: `${offers.length} đề nghị tài trợ chờ bạn chấp thuận`, note: "Có hạn chấp thuận", href: "/supplier/disbursement", cta: "Xem đề nghị" }] : []),
    ...(quotes.length ? [{ icon: Sparkles, bg: "var(--info-bg)", fg: "var(--info)", title: `${quotes.length} RFQ đã có báo giá`, note: "Chọn báo giá tốt nhất", href: "/supplier/marketplace", cta: "So sánh" }] : []),
    ...(disputed.length ? [{ icon: CircleAlert, bg: "var(--bad-bg)", fg: "var(--bad)", title: `${disputed.length} hóa đơn bị người mua hỏi lại`, note: disputed[0].disputeReason ?? "Cần giải trình hoặc điều chỉnh", href: "/supplier/invoices", cta: "Xử lý" }] : []),
    ...(pending.length ? [{ icon: Clock, bg: "var(--info-bg)", fg: "var(--info)", title: `${pending.length} hóa đơn chờ người mua xác nhận`, note: "Theo dõi ở Hóa đơn", href: "/supplier/invoices", cta: "Theo dõi" }] : []),
    ...(drafts.length ? [{ icon: Upload, bg: "var(--warn-bg)", fg: "var(--warn)", title: `${drafts.length} hóa đơn nháp chưa gửi`, note: "Gửi người mua để xác nhận", href: "/supplier/invoices", cta: "Hoàn tất" }] : []),
    ...(overdue.length ? [{ icon: AlertTriangle, bg: "var(--bad-bg)", fg: "var(--bad)", title: `${overdue.length} hóa đơn quá hạn`, note: `${money(sumAmount(overdue))} đ chưa thu`, href: "/supplier/invoices", cta: "Xem" }] : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan · Nhà cung cấp"
        title={`Xin chào ${me.name.split(" ").slice(-1)[0]}`}
        sub={short ? `Dự báo thiếu hụt ${money(-short.value)} ngày ${date(short.date)}. Xem các gói tài trợ để bù thiếu hụt.` : "Theo dõi vốn lưu động, hóa đơn và tài trợ của bạn."}
        actions={<Link className="btn bp" href="/supplier/invoices/upload"><Upload size={16} aria-hidden="true" /> Tải hóa đơn</Link>}
      />

      {todos.length > 0 ? <TodoTiles items={todos} /> : <section className="card empty">Không có việc cần làm. Tải hóa đơn đầu tiên để bắt đầu.</section>}

      <section className="grid-kpi" aria-label="Chỉ tiêu vốn lưu động">
        <Kpi label="Phải thu đang mở" value={money(sumAmount(open))} note={<>{open.length} hóa đơn{overdue.length > 0 && <> · <span className="t-bad strong">{overdue.length} quá hạn</span></>}</>} />
        <Kpi label="Phải trả (công nợ đã nhập)" value={money(ap)} note={ap ? "theo file công nợ" : "Chưa nhập công nợ phải trả"} />
        <Kpi label="Đang được tài trợ" value={money(funded.reduce((a, x) => a + (x.fundedAmount ?? x.offer?.advanceVnd ?? 0), 0))} note={`${funded.length} hồ sơ`} />
        <Kpi label="Tiền mặt (khai báo)" value={hasSetup ? money(openingCash) : "—"} note={hasSetup ? "số dư đầu kỳ do doanh nghiệp khai" : <Link href="/supplier/accounting">Khai số dư để có dự báo</Link>} />
      </section>

      <section className="row">
        <div className="card grow-2">
          {forecast ? (
            <CashForecast forecast={forecast} openingCash={openingCash} safeBalance={SAFE} />
          ) : (
            <div className="empty stack" style={{ alignItems: "center" }}>
              <strong>Chưa có dự báo dòng tiền.</strong>
              <span>Khai số dư tiền mặt, chi định kỳ và nhập công nợ để FCC dự báo 7/30/90 ngày.</span>
              <Link className="btn bp" href="/supplier/accounting">Thiết lập dòng tiền</Link>
            </div>
          )}
        </div>
        <div className="dark grow-1" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="d-title"><Sparkles size={18} color="#DDF1C4" aria-hidden="true" />Gợi ý tài trợ</span>
          {best ? (
            <>
              <p>Hóa đơn có người mua xếp hạng cao nhất trong các khoản đã xác nhận:</p>
              <div className="d-box">
                <div className="between"><strong className="num" style={{ color: "#fff" }}>{best.code}</strong><span className="chip c-lime">Gợi ý</span></div>
                <div>{orgName(data.orgs, best.buyerId)} · {money(best.amount)} đ · hạn {date(best.dueDate)} (còn {daysFromNow(best.dueDate)} ngày)</div>
                <div className="muted" style={{ color: "var(--on-forest-2)" }}>Xếp hạng người mua {scores.buyer(best.buyerId).rating}</div>
              </div>
              <Link className="btn bl" href={`/supplier/marketplace?r=${best.id}`}>So sánh gói cho hóa đơn này</Link>
            </>
          ) : <p>Chưa có hóa đơn nào được người mua xác nhận. Sau khi được xác nhận, FCC gợi ý hóa đơn nên tài trợ.</p>}
          <AskButton className="btn bl" question="Nên tài trợ hóa đơn nào?">Hỏi trợ lý</AskButton>
        </div>
      </section>

      <section className="row top">
        <div className="card flush grow-2">
          <div className="ch"><h2 className="ct">Hóa đơn gần đây</h2><Link className="btn bs sm" href="/supplier/invoices">Xem tất cả</Link></div>
          <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm">
            <table>
              <thead><tr><th>Mã</th><th>Người mua</th><th className="r">Số tiền (đ)</th><th>Hạn</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {[...mine].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6).map((r) => (
                  <tr key={r.id}><td className="num strong">{r.code}</td><td>{orgName(data.orgs, r.buyerId)}</td><td className="r num">{vnd(r.amount)}</td><td className="num">{date(r.dueDate)}</td><td><span className={`chip ${RECEIVABLE_STAGE[r.state].chip}`}>{RECEIVABLE_STAGE[r.state].short}</span></td></tr>
                ))}
                {mine.length === 0 && <tr><td colSpan={5} className="empty">Chưa có hóa đơn.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card grow-1 stack-sm">
          <h2 className="ct">Điểm tín dụng tham khảo</h2>
          <div className="between"><strong style={{ fontSize: 28 }}>{score.rating}</strong><span className="num">{Math.round(score.score)}/100</span></div>
          <Bar value={score.score} />
          <span className="muted">{score.official ? "Điểm chính thức" : `Tạm tính · độ bao phủ dữ liệu ${Math.round(score.coverage * 100)}%`}. Bổ sung hồ sơ tài chính, ESG để tăng độ bao phủ.</span>
          {score.missingMandatory.length > 0 && <span className="muted">Còn thiếu: {score.missingMandatory.join(", ")}</span>}
          <Link className="btn bs sm" href="/supplier/funding">Xem hồ sơ & 5C</Link>
        </div>
      </section>
      <Disclaimer>Xếp hạng tham khảo FCC — không phải quyết định tín dụng. Dự báo – không phải cam kết.</Disclaimer>
    </>
  );
}
