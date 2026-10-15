import type { Metadata } from "next";
import Link from "next/link";
import { BadgePercent, ClipboardCheck, Leaf, Sparkles } from "lucide-react";
import { Bar, Kpi, PageHeader } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { AskButton } from "@/components/assistant/Assistant";
import { TodoTiles, type Todo } from "@/components/ui/TodoTiles";

export const metadata: Metadata = { title: "Tổng quan người mua" };

const WEEKS: [string, number][] = [
  ["19/10", 0.42],
  ["26/10", 0.31],
  ["02/11", 0.86],
  ["09/11", 0.55],
  ["16/11", 0.5],
  ["23/11", 1.12],
  ["30/11", 0.64],
  ["07/12", 0.38],
];

const SUPPLIERS = [
  ["Điện cơ Nam Việt", "Sản xuất", "1.240.000.000", 81, "c-ok", "Tốt", "c-info", "Đang sử dụng", "42 ngày"],
  ["Công ty TNHH Vật liệu Sao Mai", "Sản xuất", "4.925.000.000", 74, "c-gold", "Khá · Hạng Vàng", "c-info", "Đang sử dụng", "88 ngày"],
  ["Bê tông Thành Công", "Sản xuất", "1.860.000.000", 68, "c-ok", "Khá", "c-neu", "Chưa tham gia", "61 ngày"],
  ["Vận tải Hưng Phát", "TM – dịch vụ", "540.000.000", 63, "c-warn", "Trung bình", "c-info", "Đang sử dụng", "37 ngày"],
  ["Gỗ ván Tân Lập", "Nông nghiệp – TP", "380.000.000", 48, "c-bad", "Yếu · cần rà soát", "c-neu", "Chưa tham gia", "55 ngày"],
] as const;

const TODOS: Todo[] = [
  { icon: ClipboardCheck, bg: "var(--warn-bg)", fg: "var(--warn)", title: "3 hóa đơn chờ bạn xác nhận", note: "Tổng 2,13 tỷ · 1 hóa đơn lệch số chuyến", href: "/buyer/invoices", cta: "Xác nhận" },
  { icon: BadgePercent, bg: "var(--ok-bg)", fg: "var(--ok)", title: "Tiết kiệm 10,4 tr nhờ trả sớm", note: "2 hóa đơn có lợi suất > chi phí vốn 4,5%", href: "/buyer/invoices", cta: "Xem" },
  { icon: Leaf, bg: "var(--bad-bg)", fg: "var(--bad)", title: "1 nhà cung cấp ESG yếu", note: "Gỗ ván Tân Lập · 48 điểm", href: "/buyer/esg", cta: "Rà soát" },
];

export default function BuyerOverview() {
  const max = 1.2;
  return (
    <>
      <PageHeader
        eyebrow="Tổng quan · Người mua"
        title="Công nợ phải trả & nhà cung cấp"
        sub="Xin chào Trần Hùng · CTCP Xây dựng Đông Á · 14 nhà cung cấp trên FCC · dữ liệu đồng bộ từ ERP lúc 23:30"
        actions={
          <Link className="btn bp" href="/buyer/invoices">
            Xác nhận hóa đơn
            <span className="chip c-lime" style={{ height: 20 }}>
              3
            </span>
          </Link>
        }
      />

      <section className="grid-kpi" aria-label="Chỉ tiêu">
        <Kpi label="Phải trả nhà cung cấp" value="12,40 tỷ" note="24 hóa đơn" />
        <Kpi label="Đến hạn trong 30 ngày" value="2,14 tỷ" note="7 hóa đơn" />
        <Kpi label="Tiền mặt khả dụng" value="4,80 tỷ" note="Chi phí cơ hội 4,5%/năm" />
        <Kpi label="Chương trình tài trợ NCC" value="11,6 / 20 tỷ" note="Hạn mức do ngân hàng cấp cho chuỗi của bạn">
          <Bar value={58} />
        </Kpi>
      </section>

      <section className="row">
        <div className="card grow-2">
          <div className="ch">
            <div>
              <h2 className="ct">Lịch thanh toán 8 tuần tới</h2>
              <p className="muted">Tỷ đồng · theo tuần bắt đầu thứ Hai · cột cam là tuần vượt 1 tỷ</p>
            </div>
          </div>
          <div
            style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 220, paddingTop: 8, borderBottom: "1px solid var(--line-strong)" }}
            role="img"
            aria-label={`Phải trả theo tuần: ${WEEKS.map(([w, v]) => `tuần ${w} ${v.toLocaleString("vi-VN")} tỷ`).join("; ")}`}
          >
            {WEEKS.map(([w, v]) => (
              <div
                key={w}
                title={`Tuần ${w}: ${v.toLocaleString("vi-VN")} tỷ`}
                style={{ flex: "1 1 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, height: "100%", minWidth: 0 }}
              >
                <span className="num" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                  {v.toLocaleString("vi-VN")}
                </span>
                <span
                  style={{
                    width: "100%",
                    maxWidth: 44,
                    borderRadius: "4px 4px 0 0",
                    height: Math.round((v / max) * 170),
                    background: v > 1 ? "var(--warn-strong)" : "var(--info-strong)",
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            {WEEKS.map(([w]) => (
              <span key={w} className="muted num" style={{ flex: "1 1 0", textAlign: "center", fontSize: 11, minWidth: 0 }}>
                {w}
              </span>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            Tuần 23/11 tập trung 1,12 tỷ, trong đó có HD-0406 (Vật liệu Sao Mai, 455 tr) — thanh toán sớm có chiết khấu giúp giãn áp lực tuần
            này.
          </p>
        </div>
        <div className="dark grow-1 stack-sm" style={{ gap: 12 }}>
          <span className="d-title">
            <Sparkles size={18} color="#DDF1C4" aria-hidden="true" />
            AI đề xuất <Term k="earlyPay">chiết khấu thanh toán sớm</Term>
          </span>
          <p>Lợi suất chiết khấu quy năm cao hơn chi phí cơ hội tiền mặt 4,5%.</p>
          <div className="d-box">
            <div className="between">
              <strong className="num" style={{ color: "#fff" }}>
                HD-0406 · Sao Mai
              </strong>
              <span className="num" style={{ color: "var(--lime)" }}>
                −1,2%
              </span>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--on-forest-2)" }}>455 tr · trả sớm 40 ngày · tiết kiệm 5,46 tr · ≈ 11,0%/năm</span>
          </div>
          <div className="d-box">
            <div className="between">
              <strong className="num" style={{ color: "#fff" }}>
                HD-1187 · Bê tông Thành Công
              </strong>
              <span className="num" style={{ color: "var(--lime)" }}>
                −0,8%
              </span>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--on-forest-2)" }}>620 tr · trả sớm 35 ngày · tiết kiệm 4,96 tr · ≈ 8,3%/năm</span>
          </div>
          <span className="spacer" />
          <Link className="btn bl" href="/buyer/invoices">
            Xem & duyệt thanh toán sớm
          </Link>
          <AskButton className="btn bg-dark" question="Có nên thanh toán sớm không?">
            Hỏi trợ lý: có nên trả sớm?
          </AskButton>
        </div>
      </section>

      <TodoTiles items={TODOS} />

      <section className="card flush">
          <div className="ch">
            <h2 className="ct">Nhà cung cấp chiến lược</h2>
            <Link href="/buyer/esg" className="strong" style={{ fontSize: 13 }}>
              ESG chuỗi cung ứng
            </Link>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Nhà cung cấp</th>
                  <th>Ngành</th>
                  <th className="r">Phải trả (đ)</th>
                  <th className="r">ESG</th>
                  <th>Mức ESG</th>
                  <th>Tài trợ qua FCC</th>
                  <th>Thời gian trả TB</th>
                </tr>
              </thead>
              <tbody>
                {SUPPLIERS.map(([n, ind, amt, esg, ec, el, fc, fl, days]) => (
                  <tr key={n}>
                    <td className="strong">{n}</td>
                    <td>{ind}</td>
                    <td className="r num">{amt}</td>
                    <td className="r num">{esg}</td>
                    <td>
                      <span className={`chip ${ec}`}>{el}</span>
                    </td>
                    <td>
                      <span className={`chip ${fc}`}>{fl}</span>
                    </td>
                    <td className="num">{days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </section>
    </>
  );
}
