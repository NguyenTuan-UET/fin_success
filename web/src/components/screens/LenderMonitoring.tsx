"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, Database, Info } from "lucide-react";
import { useToast } from "@/components/providers/Toast";

const LEVELS = {
  crit: { label: "Nghiêm trọng", bg: "var(--bad-bg)", fg: "var(--bad)", Icon: AlertOctagon },
  high: { label: "Cao", bg: "var(--warn-bg)", fg: "var(--warn)", Icon: AlertTriangle },
  med: { label: "Trung bình", bg: "var(--info-bg)", fg: "var(--info)", Icon: Info },
  data: { label: "Bất thường dữ liệu", bg: "var(--violet-bg)", fg: "var(--violet)", Icon: Database },
} as const;

const ALERTS: {
  lv: keyof typeof LEVELS;
  title: string;
  loan: string;
  company: string;
  amount: string;
  time: string;
  detail: string;
  signals: string[];
  layer: string;
  actions: string[];
}[] = [
  { lv: "crit", title: "Quá hạn 12 ngày, người mua chưa thanh toán", loan: "TT-0362", company: "Thủy sản Cửu Long", amount: "620 tr", time: "16/10 08:00", detail: "Người mua (chuỗi siêu thị) chưa chuyển tiền vào tài khoản chuyên thu dù đã nhắc 3 lần. Khoản có TSBĐ là kho lạnh.", signals: ["Người mua chậm trả 2 nhà cung cấp khác trên FCC", "Số dư tài khoản doanh nghiệp giảm 58% trong 30 ngày"], layer: "Lớp 2 · TSBĐ", actions: ["Gửi thông báo vi phạm nghĩa vụ", "Kích hoạt hồ sơ xử lý TSBĐ", "Đàm phán cơ cấu lại kỳ hạn"] },
  { lv: "high", title: "Doanh thu 60 ngày giảm 34%", loan: "TT-0488", company: "In ấn Gia Phát", amount: "410 tr", time: "15/10 21:10", detail: "Hóa đơn bán ra giảm mạnh, mất một khách hàng lớn. Khoản đang tài trợ vẫn trong hạn (còn 41 ngày).", signals: ["Hóa đơn bán ra tháng 9 giảm 41%", "Hạn mức sử dụng tăng lên 92%"], layer: "Lớp 4 · EWS", actions: ["Rà soát lại hạn mức", "Tạm dừng tài trợ hóa đơn mới", "Liên hệ doanh nghiệp"] },
  { lv: "data", title: "Nghi trùng lặp hóa đơn với tổ chức khác", loan: "TT-0470", company: "Thương mại Bảo Long", amount: "275 tr", time: "15/10 14:32", detail: "Hóa đơn mới có cùng người mua, giá trị và kỳ hạn với hóa đơn đã được tài trợ tại một tổ chức khác trên FCC.", signals: ["Trùng 3/4 trường dữ liệu chính", "Ngày lập cách nhau 1 ngày"], layer: "Chống gian lận", actions: ["Khóa giải ngân hóa đơn liên quan", "Yêu cầu người mua xác nhận lại", "Chuyển bộ phận tuân thủ"] },
  { lv: "med", title: "Người mua chậm trả 2 hóa đơn khác", loan: "TT-0451", company: "Cơ khí Bình An", amount: "390 tr", time: "15/10 09:15", detail: "Người mua của khoản này trả chậm 5–9 ngày tại hai giao dịch khác trong tháng.", signals: ["Điểm người mua giảm từ A- xuống B+", "Khoản vẫn còn 22 ngày đến hạn"], layer: "Lớp 1 · phải thu", actions: ["Đôn đốc người mua lên lịch chi", "Theo dõi hằng ngày đến khi đến hạn"] },
  { lv: "med", title: "Điểm ESG giảm từ 66 xuống 58", loan: "TT-0433", company: "Dệt nhuộm Phước Thịnh", amount: "530 tr", time: "14/10 16:40", detail: "Tái chấm ESG sau biên bản kiểm tra môi trường; E4 (chất thải và nước thải) giảm từ 3 xuống 1.", signals: ["Biên bản kiểm tra môi trường 10/2026", "Đã có kế hoạch khắc phục 60 ngày"], layer: "Giám sát ESG", actions: ["Gắn điều kiện khắc phục vào hợp đồng", "Rút ưu đãi lãi suất ESG từ kỳ sau"] },
];

export function LenderMonitoring() {
  const toast = useToast();
  const [sel, setSel] = useState(0);
  const [handled, setHandled] = useState<Record<string, string>>({});
  const s = ALERTS[sel];

  return (
    <section className="row top">
      <div className="card flush grow-3">
        <div className="ch">
          <h2 className="ct">Cảnh báo đang mở</h2>
          <span className="muted">Sắp xếp theo mức độ</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {ALERTS.map((a, i) => {
            const L = LEVELS[a.lv];
            const on = i === sel;
            return (
              <button
                key={a.loan}
                onClick={() => setSel(i)}
                aria-current={on ? "true" : undefined}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  border: 0,
                  borderTop: "1px solid var(--line-2)",
                  textAlign: "left",
                  cursor: "pointer",
                  width: "100%",
                  background: on ? "var(--surface-3)" : "#fff",
                  boxShadow: on ? "inset 3px 0 0 var(--brand)" : undefined,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 26,
                    padding: "0 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    flex: "0 0 auto",
                    width: 160,
                    background: L.bg,
                    color: L.fg,
                  }}
                >
                  <L.Icon size={14} aria-hidden="true" />
                  {L.label}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 260px", minWidth: 0 }}>
                  <strong style={{ fontSize: 13.5 }}>{a.title}</strong>
                  <span className="muted wrap">
                    {a.loan} · {a.company} · {a.amount}
                  </span>
                </span>
                {handled[a.loan] ? (
                  <span className="chip c-ok">Đã xử lý</span>
                ) : (
                  <span className="muted num" style={{ flex: "0 0 auto" }}>
                    {a.time}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="stack grow-1" style={{ flexBasis: 320 }}>
        <div className="card stack-sm" style={{ gap: 12 }}>
          <span className="muted num">
            {s.loan} · {s.company}
          </span>
          <h2 className="ct" style={{ fontSize: 16 }}>
            {s.title}
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{s.detail}</p>
          <div className="stack-sm" style={{ gap: 6 }}>
            <span className="muted strong">Tín hiệu</span>
            {s.signals.map((g) => (
              <span key={g} style={{ fontSize: 13, display: "flex", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink-2)", marginTop: 8, flex: "0 0 auto" }} />
                {g}
              </span>
            ))}
          </div>
          <div className="divider stack-sm" style={{ gap: 8 }}>
            <span className="muted strong">Đề xuất xử lý · {s.layer}</span>
            {s.actions.map((x) => (
              <button
                key={x}
                className="btn bs"
                style={{ justifyContent: "flex-start" }}
                onClick={() => {
                  setHandled((h) => ({ ...h, [s.loan]: x }));
                  toast(`${x} · ${s.loan}. Đã ghi vào Audit Trail.`);
                }}
              >
                {x}
              </button>
            ))}
            {handled[s.loan] && <span className="muted t-ok">Đã chọn: {handled[s.loan]}</span>}
          </div>
        </div>
        {s.loan === "TT-0362" && (
          <div className="card stack-sm">
            <h3 className="ct">Hồ sơ TSBĐ · TT-0362</h3>
            <div className="line-item">
              <span>Kho lạnh KCN Trà Nóc</span>
              <span className="num">1,9 tỷ</span>
            </div>
            <div className="line-item">
              <span>Định giá cập nhật 10/2026</span>
              <span className="num">−4% so với lúc cấp</span>
            </div>
            <div className="line-item">
              <span>Giá trị công nhận (LTV 70%)</span>
              <span className="num">1,33 tỷ</span>
            </div>
            <p className="muted">FCC cung cấp hồ sơ, dữ liệu định giá và lịch sử tài sản. Tổ chức tài chính thực hiện quyền xử lý theo hợp đồng và pháp luật.</p>
          </div>
        )}
      </aside>
    </section>
  );
}
