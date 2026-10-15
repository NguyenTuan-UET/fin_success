import type { Metadata } from "next";
import { Kpi, PageHeader } from "@/components/ui/basic";
import { EsgScore } from "@/components/screens/EsgScore";

export const metadata: Metadata = { title: "ESG danh mục" };

const DIST = [
  ["Tốt", 31, 21.8, "#0A7A5C", "#fff", "0,6%"],
  ["Khá", 58, 40.8, "#4E9E85", "#0E2A23", "1,1%"],
  ["Trung bình", 39, 27.5, "#9CCBB9", "#0E2A23", "1,9%"],
  ["Yếu", 14, 9.9, "#D5E9E0", "#0E2A23", "4,3%"],
] as const;

export default function LenderEsg() {
  return (
    <>
      <PageHeader
        eyebrow="ESG & Xanh · Tổ chức tài chính"
        title="ESG trong danh mục tài trợ"
        sub="Cơ cấu danh mục theo mức ESG và hồ sơ đủ điều kiện ưu đãi xanh. ESG là đầu vào bổ trợ, không thay thế phân tích dòng tiền."
      />
      <section className="grid-kpi">
        <Kpi label="Tỷ trọng tài trợ xanh" value="64%" note="Dư nợ của doanh nghiệp ESG ≥ 65" />
        <Kpi label="Hồ sơ hưởng ưu đãi xanh" value="89" note="trên 142 khoản đang hoạt động" />
        <Kpi label="Quá hạn nhóm ESG Yếu" value="4,3%" note="gấp 2,7 lần trung bình danh mục" tone="bad" />
        <Kpi label="ESG giảm trong tháng" value="1" note="TT-0433 · Dệt nhuộm Phước Thịnh" />
      </section>
      <section className="card">
        <div className="ch">
          <h2 className="ct">Phân bố khoản tài trợ theo mức ESG</h2>
          <span className="muted">số khoản · tỷ lệ quá hạn</span>
        </div>
        <div style={{ display: "flex", gap: 2, height: 32, borderRadius: 6, overflow: "hidden" }} role="img" aria-label="Tốt 31, Khá 58, Trung bình 39, Yếu 14 khoản">
          {DIST.map(([l, n, w, bg, fg]) => (
            <span key={l} style={{ width: `${w}%`, background: bg, color: fg, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", paddingLeft: 8, whiteSpace: "nowrap" }}>
              {l} {n}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 12, marginTop: 14 }}>
          {DIST.map(([l, n, , bg, , od]) => (
            <div key={l} style={{ display: "flex", gap: 10 }}>
              <span className="swatch" style={{ background: bg, marginTop: 4, border: "1px solid var(--line)" }} />
              <div>
                <div className="strong">{l}</div>
                <div className="muted">
                  {n} khoản · quá hạn <span className="num">{od}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <EsgScore
        role="lender"
        header={{
          as: "h2",
          eyebrow: "Hồ sơ đang thẩm định · TT-0418",
          title: "Vật liệu Sao Mai · ESG theo 18 chỉ tiêu",
          sub: "Doanh nghiệp đã đồng ý chia sẻ cho Quỹ Đầu tư Xanh đến 13/01/2027. Coverage 100%, không có cờ trọng yếu.",
        }}
      />
    </>
  );
}
