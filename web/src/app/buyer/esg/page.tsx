import type { Metadata } from "next";
import { Kpi, PageHeader } from "@/components/ui/basic";
import { EsgScore } from "@/components/screens/EsgScore";
import { ToastButton } from "@/components/ui/ToastButton";

export const metadata: Metadata = { title: "ESG chuỗi cung ứng" };

const SUPPLIERS = [
  ["Điện cơ Nam Việt", "Sản xuất", 81, "c-ok", "Tốt", "—", "Đang chia sẻ"],
  ["Công ty TNHH Vật liệu Sao Mai", "Sản xuất", 74, "c-gold", "Khá · Hạng Vàng", "S3, G3", "Đang chia sẻ"],
  ["Bê tông Thành Công", "Sản xuất", 68, "c-ok", "Khá", "E3", "Đang chia sẻ"],
  ["Vận tải Hưng Phát", "TM – dịch vụ", 63, "c-warn", "Trung bình", "S2, S6", "Đang chia sẻ"],
  ["Gỗ ván Tân Lập", "Nông nghiệp – TP", 48, "c-bad", "Yếu · cần rà soát", "E2, S3, G2 (cờ)", "Đang chia sẻ"],
] as const;

export default function BuyerEsg() {
  return (
    <>
      <PageHeader
        eyebrow="ESG chuỗi cung ứng · Người mua"
        title="Nhà cung cấp của bạn bền vững đến đâu?"
        sub="Chỉ hiển thị ESG của nhà cung cấp đã đồng ý chia sẻ với Xây dựng Đông Á. Nhà cung cấp xanh = ESG chính thức ≥ 65, còn hiệu lực và không có cờ trọng yếu."
      />
      <section className="grid-kpi">
        <Kpi label="ESG chuỗi cung ứng" value="70,4" note="Bình quân gia quyền theo giá trị mua 12 tháng" />
        <Kpi label="Nhà cung cấp xanh" value="3 / 5" note="60% giá trị mua hàng" />
        <Kpi label="Cần rà soát" value="1" note="Gỗ ván Tân Lập · cờ G2 thuế" tone="bad" />
        <Kpi label="Kế hoạch cải thiện đang theo dõi" value="2" note="Hưng Phát, Tân Lập" />
      </section>
      <section className="card flush">
        <div className="ch">
          <h2 className="ct">ESG theo nhà cung cấp</h2>
          <ToastButton className="btn bs sm" message="Đã gửi lời mời chia sẻ ESG tới 9 nhà cung cấp chưa tham gia.">
            Mời nhà cung cấp chia sẻ ESG
          </ToastButton>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Nhà cung cấp</th>
                <th>Ngành</th>
                <th className="r">ESG</th>
                <th>Mức</th>
                <th>Chỉ tiêu yếu</th>
                <th>Chia sẻ</th>
              </tr>
            </thead>
            <tbody>
              {SUPPLIERS.map(([n, ind, esg, chip, band, weak, share]) => (
                <tr key={n}>
                  <td className="strong">{n}</td>
                  <td>{ind}</td>
                  <td className="r num">{esg}</td>
                  <td>
                    <span className={`chip ${chip}`}>{band}</span>
                  </td>
                  <td className="num">{weak}</td>
                  <td>
                    <span className="chip c-ok">{share}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <EsgScore
        role="buyer"
        header={{
          as: "h2",
          eyebrow: "Chi tiết nhà cung cấp · được chia sẻ",
          title: "Vật liệu Sao Mai · ESG theo 18 chỉ tiêu",
          sub: "Dữ liệu do nhà cung cấp đồng ý chia sẻ đến 13/01/2027. Đổi nhóm ngành để xem trọng số khác nhau ảnh hưởng thế nào.",
        }}
      />
    </>
  );
}
