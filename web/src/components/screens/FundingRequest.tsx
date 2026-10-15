"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Info, Plus, Sparkles } from "lucide-react";
import { Bar, Disclaimer } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";

const ASSETS = [
  { name: "Nhà xưởng KCN Tân Phú", type: "Bất động sản", value: 3_200_000_000, ltv: 0.7, doc: "Đã xác thực", note: "Sổ đỏ", ok: true },
  { name: "Máy cắt CNC 5 trục", type: "Máy móc thiết bị", value: 850_000_000, ltv: 0.5, doc: "Đã xác thực", note: "Hóa đơn mua", ok: true },
  { name: "Thép cuộn tồn kho", type: "Hàng tồn kho", value: 1_200_000_000, ltv: 0.4, doc: "Chờ kiểm kê", note: "Thiếu biên bản kiểm kê", ok: false },
];

const fmt = (v: number) => Math.round(v).toLocaleString("vi-VN");

export function FundingRequest() {
  const toast = useToast();
  const [collat, setCollat] = useState(true);

  const fives = [
    { name: "Nhân cách", en: "Character", score: 18, max: 20, note: "CIC nhóm 1, không nợ quá hạn 36 tháng, quan hệ với 2 ngân hàng" },
    { name: "Năng lực trả nợ", en: "Capacity", score: 22, max: 30, note: "DSCR 1,55; nợ/VCSH 1,8; doanh thu tăng 14% so với năm trước" },
    { name: "Vốn", en: "Capital", score: 12, max: 15, note: "Vốn tự có tham gia 30% tổng nhu cầu vốn" },
    collat
      ? { name: "Tài sản bảo đảm", en: "Collateral", score: 10, max: 15, note: "Giá trị công nhận 3,15 tỷ; nhà xưởng LTV 70%" }
      : { name: "Tài sản bảo đảm", en: "Collateral", score: 4, max: 15, note: "Không có TSBĐ; thay bằng khoản phải thu từ người mua hạng A" },
    { name: "Hoàn cảnh", en: "Conditions", score: 14, max: 20, note: "Ngành vật liệu xây dựng xếp hạng B+, chu kỳ thanh toán dài" },
  ];
  const total = fives.reduce((a, f) => a + f.score, 0);
  const grade = total >= 90 ? "AAA" : total >= 80 ? "AA" : total >= 70 ? "A" : total >= 60 ? "BBB" : total >= 50 ? "BB" : total >= 40 ? "B" : "CCC";
  const weakest = [...fives].sort((a, b) => a.score / a.max - b.score / b.max)[0];

  const cases = [
    { title: "(i) Có TSBĐ & khoản phải thu tốt", desc: "Ưu tiên, hạn mức đầy đủ", on: collat },
    { title: "(ii) Không TSBĐ, khoản phải thu chất lượng cao", desc: "Tài trợ dựa trên khoản phải thu và uy tín người mua", on: !collat },
    { title: "(iii) Không TSBĐ, phải thu yếu, điểm thấp", desc: "FCC không gợi ý sản phẩm", on: false },
  ];

  const offer = collat
    ? { limit: "4,20 tỷ", ratio: "80%", base: "6,6%", rate: "5,9%", advance: "1.600.000.000 đ" }
    : { limit: "2,50 tỷ", ratio: "75%", base: "7,1%", rate: "6,4%", advance: "1.500.000.000 đ" };

  const totalValue = ASSETS.reduce((a, x) => a + x.value, 0);
  const totalRecognized = ASSETS.reduce((a, x) => a + x.value * x.ltv, 0);

  return (
    <section className="row top">
      <div className="stack grow-3">
        <div className="card">
          <div className="ch">
            <h2 className="ct">Khoản phải thu đề nghị tài trợ</h2>
            <Link href="/supplier/invoices" className="strong" style={{ fontSize: 13 }}>
              Đổi hóa đơn
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 14 }}>
            {[
              ["Hóa đơn", <span key="a" className="num">HD-0418</span>],
              ["Giá trị", <span key="b" className="num">2.000.000.000 đ</span>],
              ["Kỳ hạn", <span key="c" className="num">90 ngày · 13/01/2027</span>],
              ["Người mua", "Xây dựng Đông Á"],
              [
                <Term key="t" k="riskScore">Xếp hạng người mua</Term>,
                <span key="d">
                  <span className="num">A</span> · trả đúng hạn 96%
                </span>,
              ],
            ].map(([k, v], i) => (
              <div key={i}>
                <div className="muted">{k}</div>
                <div className="strong">{v}</div>
              </div>
            ))}
          </div>
          <div className="chip c-ok" style={{ marginTop: 14 }}>
            <Check size={14} aria-hidden="true" />
            Người mua đã xác nhận khoản phải thu ngày 15/10
          </div>
        </div>

        <div className="card">
          <div className="ch">
            <div>
              <h2 className="ct">
                <Term k="tsbd">Tài sản bảo đảm</Term> <span className="muted">(không bắt buộc)</span>
              </h2>
              <p className="muted">Định giá sơ bộ từ dữ liệu thị trường; tổ chức tài chính quyết định giá trị công nhận.</p>
            </div>
            <div className="seg" role="group" aria-label="Tài sản bảo đảm">
              <button className="seg-btn" aria-pressed={collat} onClick={() => setCollat(true)}>
                Có TSBĐ
              </button>
              <button className="seg-btn" aria-pressed={!collat} onClick={() => setCollat(false)}>
                Không có TSBĐ
              </button>
            </div>
          </div>
          {collat ? (
            <>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Tài sản</th>
                      <th className="r">Định giá sơ bộ (đ)</th>
                      <th className="r">
                        <Term k="ltv">LTV</Term> tối đa
                      </th>
                      <th className="r">Giá trị công nhận (đ)</th>
                      <th>Hồ sơ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ASSETS.map((a) => (
                      <tr key={a.name}>
                        <td className="wrap" style={{ minWidth: 140 }}>
                          {a.name}
                          <div className="muted">{a.type}</div>
                        </td>
                        <td className="r num">{fmt(a.value)}</td>
                        <td className="r num">{a.ltv * 100}%</td>
                        <td className="r num">{fmt(a.value * a.ltv)}</td>
                        <td>
                          <span className={`chip ${a.ok ? "c-ok" : "c-warn"}`} title={a.note}>
                            {a.doc}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="strong">Tổng</td>
                      <td className="r num strong">{fmt(totalValue)}</td>
                      <td />
                      <td className="r num strong">{fmt(totalRecognized)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <button className="btn bs" style={{ marginTop: 12 }} onClick={() => toast("Mở biểu mẫu thêm tài sản.")}>
                <Plus size={16} aria-hidden="true" />
                Thêm tài sản
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 14, background: "var(--info-bg)", borderRadius: 12, color: "#183F75" }}>
              <Info size={18} style={{ flex: "0 0 auto", marginTop: 2 }} aria-hidden="true" />
              <p style={{ fontSize: 13 }}>
                Không sao cả! Không có tài sản cố định vẫn có thể được tài trợ dựa trên khoản phải thu: hóa đơn hợp lệ, người mua xếp hạng A
                và dòng tiền ổn định. Hạn mức và tỷ lệ tài trợ thấp hơn một chút, lãi suất cao hơn.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="ch">
            <div>
              <h2 className="ct">
                AI Credit Scoring · <Term k="fiveC">mô hình 5C</Term>
              </h2>
              <p className="muted">BCTC 2 năm (TT 200/2014), CIC 36 tháng, dữ liệu hóa đơn & dòng tiền trên FCC</p>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="num" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>
                {total}
              </span>
              <span className="muted">/100</span>
              <span className="chip c-ok lg">Hạng {grade}</span>
            </div>
          </div>
          <div className="stack" style={{ gap: 14 }}>
            {fives.map((c) => (
              <div
                key={c.en}
                style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1.1fr) minmax(120px, 2fr) 64px", gap: "8px 16px", alignItems: "center" }}
              >
                <div>
                  <div className="strong" style={{ fontSize: 13.5 }}>
                    {c.name}
                  </div>
                  <div className="muted">{c.en}</div>
                </div>
                <div className="stack-sm" style={{ gap: 6 }}>
                  <Bar value={(c.score / c.max) * 100} color={c.score / c.max < 0.5 ? "var(--warn-strong)" : undefined} />
                  <div className="muted wrap">{c.note}</div>
                </div>
                <div className="num strong" style={{ textAlign: "right" }}>
                  {c.score}
                  <span className="muted">/{c.max}</span>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))",
              gap: 10,
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid var(--line-2)",
            }}
          >
            <div>
              <div className="muted">
                <Term k="dscr" />
              </div>
              <div className="num strong">
                1,55 <span className="chip c-ok" style={{ height: 20 }}>≥ 1,3</span>
              </div>
            </div>
            <div>
              <div className="muted">Nợ phải trả / VCSH</div>
              <div className="num strong">
                1,8 <span className="chip c-ok" style={{ height: 20 }}>≤ 3</span>
              </div>
            </div>
            <div>
              <div className="muted">ROE · ROA</div>
              <div className="num strong">18% · 7,2%</div>
            </div>
            <div>
              <div className="muted">Vốn tự có</div>
              <div className="num strong">
                30% <span className="chip c-ok" style={{ height: 20 }}>≥ 15%</span>
              </div>
            </div>
            <div>
              <div className="muted">
                <Term k="cic" />
              </div>
              <div className="strong">Nhóm 1</div>
            </div>
            <div>
              <div className="muted">Xếp hạng ngành</div>
              <div className="num strong">VLXD · B+</div>
            </div>
          </div>
          <div className="soft" style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
            <Sparkles size={16} color="var(--brand)" style={{ flex: "0 0 auto", marginTop: 2 }} aria-hidden="true" />
            <span>
              <strong>Gợi ý cải thiện:</strong> thành phần yếu nhất là <strong>{weakest.name}</strong> ({weakest.score}/{weakest.max}).{" "}
              {collat
                ? "Bổ sung biên bản kiểm kê thép cuộn để được công nhận thêm 480 tr giá trị TSBĐ."
                : "Bổ sung hợp đồng khung ≥ 12 tháng với Xây dựng Đông Á để tăng điểm hỗ trợ tín dụng."}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Disclaimer>Xếp hạng tham khảo FCC — không phải quyết định tín dụng. Tổ chức tài chính tự thẩm định và quyết định.</Disclaimer>
          </div>
        </div>
      </div>

      <aside className="stack grow-1">
        <div className="card stack-sm" style={{ gap: 12 }}>
          <h2 className="ct">Phân loại hồ sơ</h2>
          {cases.map((k) => (
            <div
              key={k.title}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: 12,
                borderRadius: 10,
                border: k.on ? "2px solid var(--brand-fill)" : "1px solid var(--line-2)",
                background: k.on ? "var(--surface-3)" : "#fff",
              }}
            >
              <div className="between">
                <strong style={{ fontSize: 13 }}>{k.title}</strong>
                {k.on && <span className="chip c-ok">Hồ sơ này</span>}
              </div>
              <span className="muted wrap">{k.desc}</span>
            </div>
          ))}
        </div>
        <div className="dark stack-sm" style={{ gap: 12 }}>
          <span className="d-title">
            <Sparkles size={18} color="#DDF1C4" aria-hidden="true" />
            Ước tính hạn mức
          </span>
          <div className="d-line">
            <span>Hạn mức tài trợ</span>
            <span className="num strong">{offer.limit}</span>
          </div>
          <div className="d-line">
            <span>
              <Term k="advance">Tỷ lệ tài trợ</Term>
            </span>
            <span className="num strong">{offer.ratio}</span>
          </div>
          <div className="d-line">
            <span>Lãi suất tham chiếu</span>
            <span className="num">{offer.base}</span>
          </div>
          <div className="d-line">
            <span>Ưu đãi ESG (74 · Hạng Vàng)</span>
            <span className="num" style={{ color: "var(--lime)" }}>
              −0,7%
            </span>
          </div>
          <div className="d-line" style={{ paddingTop: 10, borderTop: "1px solid var(--forest-3)" }}>
            <span style={{ color: "#fff" }}>Lãi suất dự kiến</span>
            <span className="num strong">{offer.rate}/năm</span>
          </div>
          <div className="d-box">
            <span style={{ color: "var(--on-forest-2)", fontSize: 12.5 }}>Số tiền dự kiến nhận</span>
            <span className="num" style={{ color: "#fff", fontSize: 26, fontWeight: 600 }}>
              {offer.advance}
            </span>
            <span style={{ color: "var(--on-forest-2)", fontSize: 12.5 }}>
              Giải ngân mục tiêu <Term k="tPlus">T+1/T+2</Term> sau phê duyệt
            </span>
          </div>
          <Link className="btn bl" href="/supplier/marketplace">
            Chọn nguồn vốn trên Marketplace
          </Link>
          <span style={{ fontSize: 12, color: "var(--on-forest-2)" }}>Ước tính theo biểu giá công bố, không phải cam kết cho vay.</span>
        </div>
      </aside>
    </section>
  );
}
