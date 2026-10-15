import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Bar, Kpi, PageHeader } from "@/components/ui/basic";
import { ToastButton } from "@/components/ui/ToastButton";
import { LenderProducts, RateStrip } from "@/components/screens/LenderProducts";

export const metadata: Metadata = { title: "Marketplace tổ chức tài chính" };

const POLICY = [
  ["Tốt", "80–100", "−1,0%", "c-ok", "Duyệt 24 giờ", false],
  ["Khá", "65–79", "−0,7%", "c-ok", "Duyệt 24 giờ", false],
  ["Trung bình", "50–64", "0%", "c-neu", "Thẩm định tăng cường", false],
  ["Yếu", "dưới 50", "—", "c-bad", "Không áp dụng gói xanh", true],
] as const;

export default function LenderMarketplace() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Tổ chức tài chính"
        title="Sản phẩm tài trợ & lãi suất thị trường"
        sub="Theo dõi mặt bằng lãi suất các gói đang công bố trên FCC, điều chỉnh gói chào và chính sách ưu đãi ESG. Bạn không thấy báo giá riêng mà tổ chức khác gửi cho doanh nghiệp."
        actions={
          <ToastButton className="btn bp" message="Mở biểu mẫu tạo gói tài trợ mới (bản mock). Gói mới cần FCC kiểm tra trình bày trước khi công bố.">
            <Plus size={16} aria-hidden="true" />
            Tạo gói tài trợ
          </ToastButton>
        }
      />
      <section className="grid-kpi">
        <Kpi label="Hồ sơ trên Marketplace · 30 ngày" value="214" note="tổng đề nghị 312 tỷ" />
        <Kpi label="Tỷ lệ doanh nghiệp chọn bạn" value="38%" note="khi bạn có chào giá" />
        <Kpi label="Lãi suất được chọn (trung vị)" value="6,4%" note="toàn thị trường" />
        <Kpi label="Hạn mức sản phẩm đã dùng" value="86,4 / 120 tỷ">
          <Bar value={72} />
        </Kpi>
      </section>
      <section className="card">
        <div className="ch">
          <div>
            <h2 className="ct">Mặt bằng lãi suất tài trợ hóa đơn</h2>
            <p className="muted">%/năm · kỳ hạn 90 ngày · đã gồm ưu đãi ESG nếu có</p>
          </div>
        </div>
        <RateStrip />
      </section>
      <section className="row top">
        <LenderProducts />
        <div className="card grow-1 stack-sm" style={{ gap: 12, flexBasis: 320 }}>
          <h2 className="ct">Chính sách ưu đãi ESG</h2>
          <p className="muted">Áp dụng tự động theo điểm ESG chính thức (Coverage ≥ 80%, không có cờ, còn hiệu lực).</p>
          {POLICY.map(([band, range, cut, chip, sla, bad]) => (
            <div
              key={band}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 10,
                background: bad ? "var(--bad-bg)" : "var(--surface-2)",
                fontSize: 13,
              }}
            >
              <span>
                <strong>{band}</strong> · {range}
              </span>
              <span className="num">{cut}</span>
              <span className={`chip ${chip}`}>{sla}</span>
            </div>
          ))}
          <ToastButton message="Thay đổi chính sách tạo phiên bản biểu giá mới; báo giá đã phát hành giữ phiên bản cũ.">Chỉnh chính sách</ToastButton>
        </div>
      </section>
    </>
  );
}
