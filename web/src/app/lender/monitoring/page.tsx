import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Kpi, PageHeader } from "@/components/ui/basic";
import { ToastButton } from "@/components/ui/ToastButton";
import { LenderMonitoring } from "@/components/screens/LenderMonitoring";

export const metadata: Metadata = { title: "Giám sát và EWS" };

const SCHEDULE = [
  ["17/10", "TT-0344", "Cơ khí Bình An", "Ô tô Trường Sơn", "812.400.000", "c-ok", "Đã lên lịch 17/10"],
  ["18/10", "TT-0351", "Vật liệu Sao Mai", "Hạ tầng Bình Minh", "505.900.000", "c-ok", "Đã lên lịch 18/10"],
  ["20/10", "TT-0349", "Bao bì Hòa Khánh", "Thực phẩm Mekong", "1.214.000.000", "c-warn", "Chưa lên lịch · đã nhắc"],
  ["21/10", "TT-0355", "Điện cơ Nam Việt", "Xây dựng Đông Á", "2.031.500.000", "c-ok", "Đã lên lịch 21/10"],
] as const;

export default function MonitoringPage() {
  return (
    <>
      <PageHeader
        eyebrow="Giám sát danh mục · EWS"
        title="Cảnh báo sớm & xử lý quá hạn"
        sub="Hệ thống theo dõi liên tục tình trạng hóa đơn, lịch sử thanh toán, dòng tiền và biến động bất thường sau giải ngân."
        actions={
          <ToastButton message="Đã tạo báo cáo danh mục tháng 10 (bản mock).">
            <Download size={16} aria-hidden="true" />
            Báo cáo danh mục
          </ToastButton>
        }
      />
      <section className="grid-kpi">
        <Kpi label="Khoản cần chú ý" value="7" note="trên 142 khoản" />
        <Kpi label="Quá hạn" value="1,38 tỷ" note="3 khoản · 1,6% dư nợ" tone="bad" />
        <Kpi label="Đến hạn 7 ngày tới" value="9,20 tỷ" note="14 khoản · 12 người mua đã lên lịch chi" />
        <Kpi label="Thu hồi đúng hạn (12 tháng)" value="98,4%" note="từ khoản phải thu, lớp 1" tone="ok" />
      </section>
      <LenderMonitoring />
      <section className="card flush">
        <div className="ch">
          <h2 className="ct">Lịch thu hồi 7 ngày tới</h2>
          <span className="muted">Nguồn trả nợ: thanh toán của người mua</span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Đến hạn</th>
                <th>Khoản</th>
                <th>Doanh nghiệp</th>
                <th>Người mua</th>
                <th className="r">Gốc + lãi (đ)</th>
                <th>Lịch chi của người mua</th>
              </tr>
            </thead>
            <tbody>
              {SCHEDULE.map(([d, id, co, buyer, amt, chip, st]) => (
                <tr key={id}>
                  <td className="num">{d}</td>
                  <td className="num">{id}</td>
                  <td>{co}</td>
                  <td>{buyer}</td>
                  <td className="r num">{amt}</td>
                  <td>
                    <span className={`chip ${chip}`}>{st}</span>
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
