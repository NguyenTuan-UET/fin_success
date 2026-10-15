import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Bar, Disclaimer, Kpi, PageHeader } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";

export const metadata: Metadata = { title: "Tổng quan tổ chức tài chính" };

const FLOW: [string, number, string][] = [
  ["Hồ sơ mới từ Marketplace", 18, "var(--info-strong)"],
  ["Đang thẩm định", 9, "var(--info-strong)"],
  ["Chờ phê duyệt", 5, "var(--info-strong)"],
  ["Đã giải ngân", 12, "var(--brand-fill)"],
  ["Từ chối", 2, "#8A9A93"],
];

const SECTORS: [string, number, string][] = [
  ["Xây dựng", 28, "B+"],
  ["Vật liệu xây dựng", 22, "B+"],
  ["Sản xuất", 15, "A-"],
  ["Thép", 14, "B"],
  ["Logistics", 13, "B+"],
  ["Thương mại", 8, "B"],
];

const STACK = (parts: [string, number, string, string][]) => (
  <div style={{ display: "flex", gap: 2, height: 28, borderRadius: 6, overflow: "hidden" }}>
    {parts.map(([l, w, bg, fg]) => (
      <span
        key={l}
        style={{ width: `${w}%`, background: bg, color: fg, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", paddingLeft: 8, whiteSpace: "nowrap", overflow: "hidden" }}
      >
        {l}
      </span>
    ))}
  </div>
);

const QUEUE = [
  ["TT-0418", "Vật liệu Sao Mai", "Xây dựng Đông Á · A", "1.600.000.000", 76, 74, "c-ok", "(i) Có TSBĐ", "15/10 23:55"],
  ["TT-0533", "Điện cơ Nam Việt", "Xây dựng Đông Á · A", "688.000.000", 81, 81, "c-info", "(ii) Dựa trên phải thu", "15/10 17:20"],
  ["TT-0529", "Bao bì Hòa Khánh", "Thực phẩm Mekong · B+", "940.000.000", 68, 61, "c-info", "(ii) Dựa trên phải thu", "15/10 10:05"],
  ["TT-0521", "Gỗ ván Tân Lập", "Xây dựng Đông Á · A", "300.000.000", 54, 48, "c-bad", "(iii) Chưa đủ điều kiện", "14/10 15:40"],
] as const;

export default function LenderOverview() {
  return (
    <>
      <PageHeader
        eyebrow="Tổng quan · Tổ chức tài chính"
        title="Danh mục tài trợ chuỗi cung ứng"
        sub="Xin chào Phạm Minh · Quỹ Đầu tư Xanh · dữ liệu khoản phải thu, tín dụng và ESG của doanh nghiệp đã đồng ý chia sẻ"
        actions={
          <Link className="btn bp" href="/lender/appraisal">
            Thẩm định hồ sơ
            <span className="chip c-lime" style={{ height: 20 }}>
              4
            </span>
          </Link>
        }
      />

      <section className="grid-kpi" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))" }} aria-label="KPI danh mục">
        <Kpi label="Dư nợ tài trợ" value="86,4 tỷ" note="142 khoản đang hoạt động" />
        <Kpi label="Thời gian thẩm định TB" value="1,8 ngày" note="trung vị · p90 2,6 ngày" />
        <Kpi label="Tỷ lệ quá hạn" value="1,6%" note="3 khoản · 1,38 tỷ" tone="bad" />
        <Kpi label="Tỷ trọng tài trợ xanh" value="64%" note="Doanh nghiệp ESG ≥ 65" />
        <Kpi label="Lợi suất bình quân" value="6,1%" note="/năm, sau ưu đãi ESG" />
      </section>

      <section className="row">
        <div className="card grow-1" style={{ flexBasis: 340 }}>
          <div className="ch">
            <h2 className="ct">Luồng hồ sơ tuần này</h2>
          </div>
          <div className="stack-sm" style={{ gap: 12 }}>
            {FLOW.map(([l, v, c]) => (
              <div key={l}>
                <div className="between" style={{ fontSize: 13 }}>
                  <span>{l}</span>
                  <strong className="num">{v}</strong>
                </div>
                <Bar value={(v / 18) * 100} color={c} lg />
              </div>
            ))}
          </div>
        </div>
        <div className="card grow-1" style={{ flexBasis: 340 }}>
          <div className="ch">
            <h2 className="ct">Dư nợ theo ngành</h2>
            <span className="muted">% dư nợ · xếp hạng ngành</span>
          </div>
          <div className="stack-sm">
            {SECTORS.map(([n, p, r]) => (
              <div key={n} style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) 40px 32px", gap: 10, alignItems: "center", fontSize: 13 }}>
                <span>{n}</span>
                <Bar value={(p / 30) * 100} lg />
                <span className="num" style={{ textAlign: "right" }}>
                  {p}%
                </span>
                <span className="num muted" style={{ textAlign: "right" }}>
                  {r}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card grow-1 stack" style={{ flexBasis: 340 }}>
          <div>
            <div className="ch" style={{ marginBottom: 10 }}>
              <h2 className="ct">
                Hạng tín dụng (<Term k="riskScore" />)
              </h2>
              <span className="muted">số khoản</span>
            </div>
            {STACK([
              ["A 46", 32.4, "#0A7A5C", "#fff"],
              ["B 61", 43, "#4E9E85", "#0E2A23"],
              ["C 29", 20.4, "#9CCBB9", "#0E2A23"],
              ["D 6", 4.2, "#D5E9E0", "#0E2A23"],
            ])}
          </div>
          <div>
            <div className="ch" style={{ marginBottom: 10 }}>
              <h2 className="ct">Mức ESG</h2>
              <span className="muted">số khoản</span>
            </div>
            {STACK([
              ["Tốt 31", 21.8, "#0A7A5C", "#fff"],
              ["Khá 58", 40.8, "#4E9E85", "#0E2A23"],
              ["TB 39", 27.5, "#9CCBB9", "#0E2A23"],
              ["Yếu 14", 9.9, "#D5E9E0", "#0E2A23"],
            ])}
          </div>
          <p className="muted">Khoản ESG “Yếu” có tỷ lệ quá hạn 4,3%, gấp 2,7 lần trung bình danh mục.</p>
        </div>
      </section>

      <section className="card flush">
        <div className="ch">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} color="var(--brand)" aria-hidden="true" />
            <h2 className="ct">Hồ sơ khớp khẩu vị rủi ro của bạn</h2>
          </div>
          <Link href="/lender/appraisal" className="strong" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
            Mở hàng đợi thẩm định <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Hồ sơ</th>
                <th>Doanh nghiệp</th>
                <th>Người mua</th>
                <th className="r">Đề nghị (đ)</th>
                <th className="r">
                  Điểm <Term k="fiveC">5C</Term>
                </th>
                <th className="r">ESG</th>
                <th>Phân loại</th>
                <th>Nhận lúc</th>
              </tr>
            </thead>
            <tbody>
              {QUEUE.map(([id, co, buyer, amt, s5, esg, chip, cls, at]) => (
                <tr key={id}>
                  <td className="num strong">
                    <Link href="/lender/appraisal">{id}</Link>
                  </td>
                  <td>{co}</td>
                  <td>{buyer}</td>
                  <td className="r num">{amt}</td>
                  <td className="r num">{s5}</td>
                  <td className="r num">{esg}</td>
                  <td>
                    <span className={`chip ${chip}`}>{cls}</span>
                  </td>
                  <td className="num">{at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px 14px" }}>
          <Disclaimer>Xếp hạng tham khảo FCC — không phải quyết định tín dụng. Khớp theo tiêu chí bạn cấu hình trong từng gói tài trợ.</Disclaimer>
        </div>
      </section>
    </>
  );
}
