import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, CircleAlert, Clock, Sparkles, Upload } from "lucide-react";
import { Bar, Kpi, PageHeader } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { CashForecast } from "@/components/charts/CashForecast";
import { TodoTiles, type Todo } from "@/components/ui/TodoTiles";
import { AskButton } from "@/components/assistant/Assistant";
import { SUPPLIER_INVOICES, STAGES } from "@/lib/data";
import { vnd } from "@/lib/format";

export const metadata: Metadata = { title: "Tổng quan nhà cung cấp" };

const RECENT = ["HD-0421", "HD-0418", "HD-0412", "HD-0405", "HD-0398"].map(
  (id) => SUPPLIER_INVOICES.find((i) => i.id === id)!,
);

const TODOS: Todo[] = [
  {
    icon: AlertTriangle,
    bg: "var(--warn-bg)",
    fg: "var(--warn)",
    title: "Bù thiếu hụt 420 tr trước 28/10",
    note: "Tài trợ HD-0412 là cách rẻ nhất · chi phí ≈ 7,0 tr",
    href: "/supplier/marketplace",
    cta: "Xem phương án",
  },
  {
    icon: Clock,
    bg: "var(--info-bg)",
    fg: "var(--info)",
    title: "3 hóa đơn chờ người mua xác nhận",
    note: "Đã gửi 3 ngày · FCC sẽ nhắc tự động",
    href: "/supplier/invoices",
    cta: "Theo dõi",
  },
  {
    icon: CircleAlert,
    bg: "var(--bad-bg)",
    fg: "var(--bad)",
    title: "HD-0398 quá hạn 7 ngày",
    note: "Nội thất Phố Hội · 315 tr",
    href: "/supplier/invoices",
    cta: "Xử lý",
  },
  {
    icon: Upload,
    bg: "var(--ok-bg)",
    fg: "var(--ok)",
    title: "2 hóa đơn nháp chưa gửi",
    note: "HD-0423, HD-0422 · 705 tr",
    href: "/supplier/invoices/upload",
    cta: "Hoàn tất",
  },
];

export default function SupplierOverview() {
  return (
    <>
      <PageHeader
        eyebrow="Tổng quan · Nhà cung cấp"
        title="Vốn lưu động hôm nay"
        sub="Xin chào Nguyễn Lan · đồng bộ từ hóa đơn điện tử và 2 tài khoản ngân hàng lúc 23:40"
        actions={
          <>
            <Link className="btn bs" href="/supplier/invoices/upload">
              <Upload size={16} aria-hidden="true" />
              Tải hóa đơn
            </Link>
            <Link className="btn bp" href="/supplier/funding">
              Yêu cầu tài trợ
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </>
        }
      />

      <div
        role="alert"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px 16px",
          padding: "14px 18px",
          borderRadius: 14,
          background: "var(--warn-bg)",
          color: "#4D2B00",
        }}
      >
        <AlertTriangle size={20} color="#A35A00" aria-hidden="true" />
        <p style={{ flex: "1 1 320px" }}>
          <strong>Cảnh báo thanh khoản:</strong> số dư dự báo xuống <span className="num">380 tr</span> ngày 28/10, thấp hơn mức an toàn{" "}
          <span className="num">800 tr</span>. Thiếu hụt <span className="num">420 tr</span> có thể bù bằng tài trợ 1 hóa đơn.
        </p>
        <AskButton className="btn bs sm" question="Khi nào tôi có thể thiếu tiền?">
          <Sparkles size={15} aria-hidden="true" />
          Giải thích
        </AskButton>
        <Link className="btn bp sm" href="/supplier/marketplace">
          Xem phương án
        </Link>
      </div>

      <section className="grid-kpi" aria-label="Chỉ tiêu vốn lưu động">
        <Kpi
          label="Phải thu"
          value="6,84 tỷ"
          note={
            <>
              18 hóa đơn · <span className="t-bad strong">1 quá hạn</span>
            </>
          }
        />
        <Kpi label="Phải trả" value="3,12 tỷ" note="9 hóa đơn · đến hạn 7 ngày: 1,05 tỷ" />
        <Kpi label="Hàng tồn kho" value="2,47 tỷ" note={<>Vòng quay 41 ngày (<Term k="dio" />)</>} />
        <Kpi label="Tiền mặt" value="1,26 tỷ" note="2 tài khoản ngân hàng" />
      </section>

      <section className="row">
        <div className="card grow-2">
          <CashForecast />
        </div>
        <div className="dark grow-1" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="d-title">
            <Sparkles size={18} color="#DDF1C4" aria-hidden="true" />
            AI đề xuất tài trợ
          </span>
          <p>Ưu tiên hóa đơn bù đủ thiếu hụt 420 tr với chi phí vốn thấp nhất.</p>
          <div className="d-box">
            <div className="between">
              <strong className="num" style={{ color: "#fff" }}>
                HD-0412
              </strong>
              <span className="chip c-lime">Khuyến nghị</span>
            </div>
            <span className="d-text" style={{ fontSize: 12.5 }}>
              Kết cấu Thép Miền Trung · còn 51 ngày
            </span>
            <div className="d-line">
              <span>Nhận trước 80%</span>
              <span className="num">688 tr</span>
            </div>
            <div className="d-line">
              <span>Chi phí ước tính · 5,9%/năm</span>
              <span className="num">≈ 7,0 tr</span>
            </div>
          </div>
          <div className="d-box outline">
            <div className="between">
              <strong className="num" style={{ color: "#fff" }}>
                HD-0418
              </strong>
              <span className="chip" style={{ background: "var(--forest-3)", color: "#E6F0EB" }}>
                Phương án 2
              </span>
            </div>
            <span className="d-text" style={{ fontSize: 12.5 }}>
              Xây dựng Đông Á · còn 90 ngày
            </span>
            <div className="d-line">
              <span>Nhận trước 80%</span>
              <span className="num">1,60 tỷ</span>
            </div>
            <div className="d-line">
              <span>Chi phí ước tính · 5,9%/năm</span>
              <span className="num">≈ 26,5 tr</span>
            </div>
          </div>
          <span className="spacer" />
          <Link className="btn bl" href="/supplier/marketplace">
            So sánh trên Marketplace
          </Link>
          <AskButton className="btn bg-dark" question="Nên tài trợ hóa đơn nào?">
            Vì sao lại là HD-0412?
          </AskButton>
        </div>
      </section>

      <TodoTiles items={TODOS} />

      <section className="card flush">
          <div className="ch">
            <h2 className="ct">Hóa đơn gần đây</h2>
            <Link href="/supplier/invoices" className="strong" style={{ fontSize: 13 }}>
              Xem tất cả
            </Link>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Người mua</th>
                  <th className="r">Số tiền (đ)</th>
                  <th>Hạn thanh toán</th>
                  <th className="r">ESG người mua</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {RECENT.map((i) => (
                  <tr key={i.id}>
                    <td className="num strong">{i.id}</td>
                    <td>{i.buyer}</td>
                    <td className="r num">{vnd(i.amount)}</td>
                    <td className="num">{i.due}</td>
                    <td className="r num">{i.esg}</td>
                    <td>
                      <span className={`chip ${STAGES[i.stage].chip}`}>
                        {i.stage === "over" ? "Quá hạn 7 ngày" : STAGES[i.stage].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </section>

      <section className="grid-kpi" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))" }}>
        <Link className="card stack-sm" href="/supplier/esg">
          <div className="between">
            <span className="ct">Điểm ESG doanh nghiệp</span>
            <span className="chip c-gold">Hạng Vàng</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1 }}>
              74
            </span>
            <span className="muted">/100 · mức Khá</span>
          </div>
          <Bar value={74} />
          <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
            Đủ điều kiện ưu đãi <strong>−0,7%/năm</strong> từ 3 tổ chức có gói xanh.
          </span>
        </Link>
        <Link className="card stack-sm" href="/supplier/funding">
          <div className="between">
            <span className="ct">Xếp hạng tín dụng FCC</span>
            <span className="chip c-ok">
              <BadgeCheck size={14} aria-hidden="true" />
              +1 bậc
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1 }}>
              A
            </span>
            <span className="muted">76/100 · mô hình 5C · kỳ trước BBB</span>
          </div>
          <Bar value={76} />
          <span className="muted">Xếp hạng tham khảo FCC — không phải quyết định tín dụng.</span>
        </Link>
        <Link className="card stack-sm" href="/supplier/marketplace">
          <span className="muted">Ưu đãi tốt nhất trên Marketplace</span>
          <span className="ct">Quỹ Đầu tư Xanh</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="num" style={{ fontSize: 32, fontWeight: 600 }}>
              5,9%
            </span>
            <span className="muted">/năm · tài trợ tới 80% · T+1</span>
          </div>
          <span className="muted">Giá do đối tác công bố, cập nhật 23:30.</span>
        </Link>
      </section>
    </>
  );
}
