import type { Metadata } from "next";
import { Check, Download, Minus } from "lucide-react";
import { Bar, Kpi, PageHeader } from "@/components/ui/basic";
import { ToastButton } from "@/components/ui/ToastButton";
import { AdminUsers } from "@/components/screens/AdminUsers";

export const metadata: Metadata = { title: "Quản trị hệ thống" };

const REVENUE: [string, number][] = [
  ["Phí giao dịch tài trợ hóa đơn", 612],
  ["Phí thuê nền tảng SaaS", 214],
  ["Phí chấm điểm tín dụng", 98],
  ["Phí kết nối API", 71],
  ["Báo cáo & phân tích dữ liệu", 52],
  ["Hoa hồng giới thiệu sản phẩm", 33],
];

const Y = "Có";
const N = "—";
const MATRIX: [string, string, string, string, string][] = [
  ["Xem hóa đơn liên quan", Y, Y, "Khi được chia sẻ", Y],
  ["Tải lên & sửa hóa đơn", N, Y, N, N],
  ["Xác nhận khoản phải thu", Y, N, N, N],
  ["Gửi hồ sơ tài trợ", N, Y, N, N],
  ["Xem hồ sơ tín dụng & ESG", "Của mình", "Của mình", "Khi được chia sẻ", Y],
  ["Phê duyệt & giải ngân", N, N, Y, N],
  ["Quản trị người dùng & cấu hình", "Trong doanh nghiệp", "Trong doanh nghiệp", "Trong tổ chức", Y],
];

function Cell({ v }: { v: string }) {
  if (v === Y)
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ok)", fontWeight: 600 }}>
        <Check size={15} aria-hidden="true" />
        Có
      </span>
    );
  if (v === N)
    return (
      <span className="muted" style={{ display: "inline-flex", alignItems: "center" }}>
        <Minus size={15} aria-label="Không" />
      </span>
    );
  return <span>{v}</span>;
}

export default function AdminPage() {
  return (
    <>
      <PageHeader
        eyebrow="Quản trị hệ thống"
        title="Vận hành nền tảng FCC"
        sub="Người dùng, phân quyền, bảo mật và báo cáo hoạt động của toàn nền tảng · tháng 10/2026"
        actions={
          <ToastButton message="Đã tạo báo cáo vận hành tháng 10/2026 (bản mock).">
            <Download size={16} aria-hidden="true" />
            Báo cáo tháng
          </ToastButton>
        }
      />
      <section className="grid-kpi" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))" }}>
        <Kpi label="Doanh nghiệp hoạt động" value="486" note="+38 trong tháng · 6 tổ chức tài chính" />
        <Kpi label="Hóa đơn xử lý" value="4.920" note="tháng này · 96,8% OCR tự động" />
        <Kpi label="Giá trị tài trợ" value="412 tỷ" note="lũy kế · dư nợ 188 tỷ" />
        <Kpi label="Tỷ lệ phê duyệt" value="71%" note="thời gian giải ngân TB 1,6 ngày" />
        <Kpi label="Doanh thu nền tảng" value="1,08 tỷ" note="tháng 10 · 6 nguồn thu" />
      </section>

      <section className="row">
        <div className="card grow-1" style={{ flexBasis: 380 }}>
          <div className="ch">
            <h2 className="ct">Doanh thu theo nguồn</h2>
            <span className="muted">Triệu đồng · tháng 10</span>
          </div>
          <div className="stack-sm" style={{ gap: 12 }}>
            {REVENUE.map(([n, v]) => (
              <div key={n} style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1.2fr) minmax(0, 2fr) 48px", gap: 12, alignItems: "center", fontSize: 13 }}>
                <span>{n}</span>
                <Bar value={(v / 650) * 100} lg />
                <span className="num" style={{ textAlign: "right" }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div id="security" className="card grow-1 stack-sm" style={{ flexBasis: 380, gap: 12, scrollMarginTop: 80 }}>
          <div className="ch" style={{ margin: 0 }}>
            <h2 className="ct">Bảo mật & chống gian lận</h2>
            <span className="chip c-ok">Hệ thống ổn định</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {[
              ["14", "hóa đơn trùng lặp bị chặn"],
              ["6", "giao dịch bất thường"],
              ["3", "đăng nhập bất thường"],
            ].map(([v, l]) => (
              <div key={l} className="soft">
                <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                  {v}
                </div>
                <div className="muted">{l}</div>
              </div>
            ))}
          </div>
          {[
            ["Mã hóa dữ liệu AES-256 · TLS", "c-ok", "Hoạt động"],
            ["MFA bắt buộc cho phê duyệt", "c-ok", "98% người dùng"],
            ["Sao lưu & Audit Trail", "c-ok", "Đầy đủ"],
            ["ISO/IEC 27001 · PCI DSS", "c-warn", "Đang chuẩn bị"],
          ].map(([l, c, s]) => (
            <div key={l} className="between" style={{ fontSize: 13 }}>
              <span>{l}</span>
              <span className={`chip ${c}`}>{s}</span>
            </div>
          ))}
        </div>
      </section>

      <AdminUsers />

      <section className="card flush">
        <div className="ch">
          <h2 className="ct">Ma trận phân quyền theo vai trò (RBAC)</h2>
          <ToastButton className="btn bs sm" message="Chỉnh ma trận quyền cần phê duyệt hai người (bản mock).">
            Chỉnh ma trận
          </ToastButton>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Quyền</th>
                <th>Người mua</th>
                <th>Nhà cung cấp</th>
                <th>Tổ chức tài chính</th>
                <th>Quản trị</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(([p, a, b, c, d]) => (
                <tr key={p}>
                  <td>{p}</td>
                  {[a, b, c, d].map((v, i) => (
                    <td key={i}>
                      <Cell v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
