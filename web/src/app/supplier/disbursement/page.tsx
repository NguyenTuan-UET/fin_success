import type { Metadata } from "next";
import { FileSignature } from "lucide-react";
import { PageHeader } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { ToastButton } from "@/components/ui/ToastButton";

export const metadata: Metadata = { title: "Giải ngân và thu hồi" };

const STEPS: { n: string; date?: string; title: string; tag: string; state: "done" | "cur" | "todo" | "opt" }[] = [
  { n: "01", date: "15/10", title: "Đăng ký & hồ sơ", tag: "Xong", state: "done" },
  { n: "02", date: "15/10", title: "Đăng tải TSBĐ", tag: "Xong", state: "done" },
  { n: "03", date: "15/10", title: "Xác thực HĐ & định giá TS", tag: "Xong", state: "done" },
  { n: "04", date: "15/10", title: "AI Credit Scoring", tag: "76/100", state: "done" },
  { n: "05", date: "16/10", title: "TCTC phê duyệt", tag: "Xong · 9 giờ", state: "done" },
  { n: "06", date: "16/10", title: "Giải ngân T+1", tag: "Đang xử lý", state: "cur" },
  { n: "07", title: "Giám sát EWS", tag: "90 ngày", state: "todo" },
  { n: "08", date: "13/01", title: "Người mua thanh toán", tag: "2.000.000.000", state: "todo" },
  { n: "09", title: "Thu hồi gốc & phí", tag: "Tự động", state: "todo" },
  { n: "10", title: "Xử lý TSBĐ", tag: "Chỉ khi thiếu hụt", state: "opt" },
  { n: "11", title: "Tất toán", tag: "Hoàn phần còn lại", state: "todo" },
];

const LAYERS = [
  ["Thu hồi từ khoản phải thu", "Người mua trả vào tài khoản chuyên thu, tự động phân bổ"],
  ["Xử lý tài sản bảo đảm", "Nhà xưởng KCN Tân Phú · do tổ chức tài chính thực hiện theo hợp đồng"],
  ["Quản trị rủi ro khi không có TSBĐ", "Dựa trên uy tín người mua và dòng tiền chuỗi cung ứng"],
  ["Cảnh báo sớm & xử lý quá hạn", "EWS theo dõi doanh thu, chậm thanh toán, bất thường dữ liệu"],
];

const PORTFOLIO = [
  ["TT-0418", "HD-0418", "Quỹ Đầu tư Xanh", "1.600.000.000", "5,9%", "13/01/2027", ["c-ok", "Bình thường"], ["c-warn", "Chờ giải ngân"]],
  ["TT-0401", "HD-0401", "Ngân hàng TMCP Thịnh An", "1.080.000.000", "6,5%", "14/12/2026", ["c-ok", "Bình thường"], ["c-info", "Đang tài trợ"]],
  ["TT-0405", "HD-0405", "Ngân hàng Hải Đăng", "459.000.000", "6,8%", "20/11/2026", ["c-warn", "Theo dõi · người mua chậm phản hồi"], ["c-info", "Đang tài trợ"]],
  ["TT-0392", "HD-0392", "Quỹ Đầu tư Xanh", "624.000.000", "5,9%", "30/09/2026", ["c-neu", "—"], ["c-ok", "Đã tất toán"]],
] as const;

export default function Disbursement() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Giải ngân & thu hồi"
        title="Khoản tài trợ TT-0418"
        sub="Quỹ Đầu tư Xanh · tài trợ hóa đơn HD-0418 · 80% giá trị · 5,9%/năm. Nguồn trả nợ đầu tiên là khoản thanh toán của người mua, bạn không phải trả trước."
        actions={
          <>
            <span className="chip c-warn lg">Đã phê duyệt · chờ giải ngân T+1</span>
            <ToastButton message="Mở hợp đồng tài trợ TT-0418 (đã ký số) — bản mock.">
              <FileSignature size={16} aria-hidden="true" />
              Hợp đồng tài trợ
            </ToastButton>
          </>
        }
      />

      <section className="card" aria-label="Vòng đời khoản tài trợ">
        <div className="ch">
          <h2 className="ct">Vòng tuần hoàn khép kín</h2>
          <span className="muted">Bước 6 / 11</span>
        </div>
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
            gap: 10,
          }}
        >
          {STEPS.map((s) => {
            const cur = s.state === "cur";
            return (
              <li
                key={s.n}
                aria-current={cur ? "step" : undefined}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  background: s.state === "done" ? "var(--surface-3)" : cur ? "var(--forest)" : "#fff",
                  color: cur ? "#fff" : undefined,
                  border: s.state === "todo" ? "1px solid var(--line)" : s.state === "opt" ? "1px dashed var(--line-strong)" : "1px solid transparent",
                }}
              >
                <span className="num" style={{ fontSize: 12.5, color: cur ? "var(--on-forest-2)" : "var(--ink-3)" }}>
                  {s.n}
                  {s.date && ` · ${s.date}`}
                </span>
                <strong style={{ fontSize: 13 }}>{s.title}</strong>
                {s.state === "done" ? (
                  <span className="chip c-ok" style={{ alignSelf: "flex-start" }}>
                    {s.tag}
                  </span>
                ) : cur ? (
                  <span className="chip c-lime" style={{ alignSelf: "flex-start" }}>
                    {s.tag}
                  </span>
                ) : (
                  <span className="muted">{s.tag}</span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="row top">
        <div className="card grow-3">
          <div className="ch">
            <div>
              <h2 className="ct">Phân bổ giá trị hóa đơn 2 tỷ đồng</h2>
              <p className="muted">Khi người mua thanh toán ngày 13/01/2027</p>
            </div>
          </div>
          <div
            style={{ display: "flex", gap: 2, height: 40, borderRadius: 8, overflow: "hidden" }}
            role="img"
            aria-label="Thanh phân bổ: 80% ứng trước, 1,2% lãi, 18,8% hoàn trả doanh nghiệp"
          >
            <span style={{ width: "80%", background: "var(--brand-fill)" }} />
            <span style={{ width: "1.2%", background: "var(--warn-strong)" }} />
            <span style={{ flex: "1 1 auto", background: "var(--info-strong)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: 14, marginTop: 16 }}>
            {[
              ["var(--brand-fill)", "Gốc ứng trước (80%) · trả tổ chức tài chính", "1.600.000.000"],
              ["var(--warn-strong)", "Lãi 90 ngày · 5,9%/năm", "23.276.712"],
              ["var(--info-strong)", "Hoàn trả doanh nghiệp", "376.723.288"],
            ].map(([c, l, v]) => (
              <div key={l} style={{ display: "flex", gap: 10 }}>
                <span className="swatch" style={{ background: c, marginTop: 4 }} />
                <div>
                  <div className="muted">{l}</div>
                  <div className="num strong">{v}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="tw" style={{ marginTop: 18, borderTop: "1px solid var(--line-2)", paddingTop: 6 }}>
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giao dịch</th>
                  <th>Bên</th>
                  <th className="r">Số tiền (đ)</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["16/10/2026", "Giải ngân ứng trước", "Quỹ Đầu tư Xanh → Vật liệu Sao Mai", "1.596.800.000", "c-warn", "Đang xử lý"],
                  ["16/10/2026", "Phí xử lý 0,2%", "Khấu trừ khi giải ngân", "3.200.000", "c-warn", "Đang xử lý"],
                  ["13/01/2027", "Người mua thanh toán vào tài khoản chuyên thu", "Xây dựng Đông Á", "2.000.000.000", "c-neu", "Dự kiến"],
                  ["13/01/2027", "Thu hồi gốc & lãi", "→ Quỹ Đầu tư Xanh", "1.623.276.712", "c-neu", "Tự động"],
                  ["13/01/2027", "Hoàn phần còn lại · tất toán", "→ Vật liệu Sao Mai", "376.723.288", "c-neu", "Tự động"],
                ].map(([d, t, p, v, c, st]) => (
                  <tr key={t}>
                    <td className="num">{d}</td>
                    <td className="wrap" style={{ minWidth: 160 }}>
                      {t}
                    </td>
                    <td className="wrap" style={{ minWidth: 140 }}>
                      {p}
                    </td>
                    <td className="r num">{v}</td>
                    <td>
                      <span className={`chip ${c}`}>{st}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="stack grow-1">
          <div className="card stack-sm" style={{ gap: 12 }}>
            <h2 className="ct">Các lớp bảo vệ thu hồi</h2>
            {LAYERS.map(([t, n], i) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span
                  className="num"
                  style={{
                    width: 28,
                    height: 28,
                    flex: "0 0 auto",
                    borderRadius: 8,
                    background: i === 0 ? "var(--brand-fill)" : "var(--ok-bg)",
                    color: i === 0 ? "#fff" : "var(--ok)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <strong style={{ fontSize: 13 }}>{t}</strong>
                  <div className="muted">{n}</div>
                </div>
              </div>
            ))}
            <p className="muted soft">FCC không bảo lãnh khoản vay và không trực tiếp thu giữ tài sản.</p>
          </div>
          <div className="card stack-sm">
            <div className="between">
              <h2 className="ct">
                Cảnh báo sớm (<Term k="ews" />)
              </h2>
              <span className="chip c-ok">Bình thường</span>
            </div>
            <div className="line-item">
              <span>Doanh thu 30 ngày</span>
              <span className="num">+6% so với kỳ trước</span>
            </div>
            <div className="line-item">
              <span>Người mua trả đúng hạn</span>
              <span className="num">96%</span>
            </div>
            <div className="line-item">
              <span>Bất thường dữ liệu</span>
              <span>Không phát hiện</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="card flush">
        <div className="ch">
          <h2 className="ct">Danh mục khoản tài trợ của tôi</h2>
          <span className="muted">
            Dư nợ đang tài trợ:{" "}
            <strong className="num" style={{ color: "var(--ink)" }}>
              3,14 tỷ
            </strong>
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Hóa đơn</th>
                <th>Tổ chức tài chính</th>
                <th className="r">Số tiền tài trợ (đ)</th>
                <th className="r">Lãi suất</th>
                <th>Đến hạn</th>
                <th>EWS</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {PORTFOLIO.map(([id, inv, org, amt, rate, due, ews, st]) => (
                <tr key={id}>
                  <td className="num strong">{id}</td>
                  <td className="num">{inv}</td>
                  <td>{org}</td>
                  <td className="r num">{amt}</td>
                  <td className="r num">{rate}</td>
                  <td className="num">{due}</td>
                  <td>
                    <span className={`chip ${ews[0]}`}>{ews[1]}</span>
                  </td>
                  <td>
                    <span className={`chip ${st[0]}`}>{st[1]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
