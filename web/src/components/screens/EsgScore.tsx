"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlaskConical, RotateCcw, Sparkles } from "lucide-react";
import { ESG_INDUSTRIES, ESG_ISSUES, ESG_ITEMS, ESG_WEIGHTS, esgBand } from "@/lib/data";
import { dec } from "@/lib/format";
import { Term } from "@/components/ui/Term";
import { PageHeader } from "@/components/ui/basic";
import type { Role } from "@/lib/roles";

const LV = ["không có", "sơ khai", "tối thiểu", "có hệ thống", "chủ động & đo lường"];
const f2 = (v: number) => v.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EsgScore({
  role,
  header,
}: {
  role: Role;
  header: { eyebrow: string; title: string; sub: string; as?: "h1" | "h2" };
}) {
  const [ind, setInd] = useState(0);
  const [sim, setSim] = useState<Record<string, number>>({});
  const canSimulate = role === "supplier";

  const items = useMemo(() => ESG_ITEMS.map((x) => ({ ...x, score: sim[x.code] ?? x.score, base: x.score })), [sim]);
  const w = ESG_WEIGHTS[ind];
  const K = [0, 1, 2, 3, 4, 5].map((k) => (25 * (items[k * 3].score + items[k * 3 + 1].score + items[k * 3 + 2].score)) / 3);
  const total = K.reduce((a, v, i) => a + (v * w[i]) / 100, 0);
  const baseTotal = [0, 1, 2, 3, 4, 5]
    .map((k) => (25 * (ESG_ITEMS[k * 3].score + ESG_ITEMS[k * 3 + 1].score + ESG_ITEMS[k * 3 + 2].score)) / 3)
    .reduce((a, v, i) => a + (v * w[i]) / 100, 0);
  const b = esgBand(total);
  const simulating = Object.keys(sim).length > 0;
  const delta = total - baseTotal;

  const pill = (a: number, c: number) => Math.round((K[a] * w[a] + K[c] * w[c]) / (w[a] + w[c]));
  const pillars = [
    ["E", "Môi trường", pill(0, 1), w[0] + w[1]],
    ["S", "Xã hội", pill(2, 3), w[2] + w[3]],
    ["G", "Quản trị", pill(4, 5), w[4] + w[5]],
  ] as const;

  const plan = items
    .map((x, i) => ({ x, gain: x.score < 4 ? (w[Math.floor(i / 3)] * 25) / 3 / 100 : 0 }))
    .filter((p) => p.gain > 0)
    .sort((a, c) => c.gain - a.gain || a.x.score - c.x.score)
    .slice(0, 3);

  const setLevel = (code: string, level: number, base: number) =>
    setSim((s) => {
      const n = { ...s };
      if (level === base) delete n[code];
      else n[code] = level;
      return n;
    });

  return (
    <>
      <PageHeader
        as={header.as}
        eyebrow={header.eyebrow}
        title={header.title}
        sub={header.sub}
        actions={
          <div className="stack-sm" style={{ gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>Nhóm ngành áp trọng số</span>
            <div className="seg" role="group" aria-label="Nhóm ngành">
              {ESG_INDUSTRIES.map((l, i) => (
                <button key={l} className="seg-btn" aria-pressed={ind === i} onClick={() => setInd(i)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {simulating && (
        <div
          role="status"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            padding: "12px 16px",
            borderRadius: 14,
            background: "var(--violet-bg)",
            color: "var(--violet)",
          }}
        >
          <FlaskConical size={18} aria-hidden="true" />
          <span style={{ flex: "1 1 300px" }}>
            <strong>Đang mô phỏng:</strong> nếu cải thiện {Object.keys(sim).length} chỉ tiêu, điểm ESG{" "}
            {delta >= 0 ? "tăng" : "giảm"} <strong className="num">{f2(Math.abs(delta))}</strong> → <strong className="num">{f2(total)}</strong> (
            {b.band}). Đây chỉ là mô phỏng, không thay đổi điểm chính thức.
          </span>
          <button className="btn bs sm" onClick={() => setSim({})}>
            <RotateCcw size={15} aria-hidden="true" />
            Về điểm thật
          </button>
        </div>
      )}

      <section className="row">
        <div className="card grow-1 stack-sm" style={{ gap: 14 }}>
          <div className="between">
            <span className="ct">Điểm ESG tổng hợp</span>
            <span className={`chip ${b.chip}`}>{b.medal}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="num" style={{ fontSize: 64, fontWeight: 600, lineHeight: 1 }}>
              {Math.round(total)}
            </span>
            <span className="muted" style={{ fontSize: 14 }}>
              /100 · mức {b.band}
            </span>
          </div>
          <div style={{ position: "relative", paddingTop: 18 }}>
            <span
              className="num"
              style={{ position: "absolute", top: 0, left: `${total}%`, transform: "translateX(-50%)", fontSize: 11, fontWeight: 700 }}
            >
              {f2(total)}
            </span>
            <div style={{ display: "flex", gap: 2, height: 10 }} aria-hidden="true">
              <span style={{ width: "50%", background: "#F2D3CF", borderRadius: "4px 0 0 4px" }} />
              <span style={{ width: "15%", background: "#F5E2C2" }} />
              <span style={{ width: "15%", background: "#CFE6DB" }} />
              <span style={{ flex: "1 1 auto", background: "#9CCBB9", borderRadius: "0 4px 4px 0" }} />
            </div>
            <span
              style={{
                position: "absolute",
                top: 14,
                left: `${total}%`,
                width: 3,
                height: 18,
                marginLeft: -1,
                background: "var(--ink)",
                borderRadius: 2,
                transition: "left .3s var(--ease)",
              }}
            />
            <div style={{ display: "flex", marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
              <span style={{ width: "50%" }}>Yếu &lt;50</span>
              <span style={{ width: "15%" }}>TB</span>
              <span style={{ width: "15%" }}>Khá</span>
              <span>Tốt ≥80</span>
            </div>
          </div>
          <div className="line-item divider">
            <span>
              <Term k="coverage">Độ bao phủ chứng cứ</Term>
            </span>
            <strong className="num">18/18 · 100%</strong>
          </div>
          <div className="line-item">
            <span>Cờ rủi ro nghiêm trọng</span>
            <strong>Không có</strong>
          </div>
          <div className="line-item">
            <span>Hiệu lực điểm</span>
            <strong>đến 10/2027</strong>
          </div>
        </div>

        <div className="card grow-1 stack-sm" style={{ gap: 14 }}>
          <span className="ct">Ba trụ cột</span>
          {pillars.map(([code, name, score, wt]) => (
            <div key={code} className="stack-sm" style={{ gap: 6 }}>
              <div className="between" style={{ fontSize: 13.5 }}>
                <span>
                  <strong>{code}</strong> · {name}
                </span>
                <span className="num strong">{score}</span>
              </div>
              <div className="bar lg">
                <span className="fill" style={{ width: `${score}%` }} />
              </div>
              <span className="muted">Trọng số {wt}%</span>
            </div>
          ))}
        </div>

        <div className="dark grow-1 stack-sm" style={{ gap: 12 }}>
          <span className="d-title">
            <Sparkles size={18} color="#DDF1C4" aria-hidden="true" />
            {role === "lender" ? "Chính sách ưu đãi xanh của bạn" : "Ưu đãi tài chính xanh"}
          </span>
          <div className="d-line">
            <span>Giảm lãi suất</span>
            <span className="num strong">{total >= 80 ? "−1,0%/năm" : total >= 65 ? "−0,7%/năm" : "Chưa đủ điều kiện"}</span>
          </div>
          <div className="d-line">
            <span>Thời gian phê duyệt</span>
            <span className="num strong">{total >= 65 ? "24 giờ" : "Thẩm định tăng cường"}</span>
          </div>
          <div className="d-line">
            <span>Gói xanh khả dụng</span>
            <span className="strong">{total >= 80 ? "4 / 7 tổ chức" : total >= 65 ? "3 / 6 tổ chức" : "0 / 6 tổ chức"}</span>
          </div>
          <p style={{ fontSize: 12.5 }}>
            Ưu đãi do từng tổ chức tài chính công bố. Điểm ESG là đầu vào bổ trợ, không thay thế phân tích dòng tiền, lịch sử trả nợ hay tài
            sản bảo đảm.
          </p>
          <span className="spacer" />
          {role === "supplier" && (
            <Link className="btn bl" href="/supplier/marketplace">
              Xem gói tài trợ xanh
            </Link>
          )}
        </div>
      </section>

      <section className="row top">
        <div className="card flush grow-3">
          <div className="ch">
            <div>
              <h2 className="ct">6 vấn đề trọng yếu</h2>
              <p className="muted">K = 25 × điểm bình quân · ESG = Σ trọng số ngành × K</p>
            </div>
            <span className="chip c-info">Trọng số: {ESG_INDUSTRIES[ind]}</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Vấn đề</th>
                  <th>Điểm 3 chỉ tiêu</th>
                  <th className="r">Điểm nhóm /100</th>
                  <th className="r">Trọng số</th>
                  <th className="r">Đóng góp</th>
                </tr>
              </thead>
              <tbody>
                {ESG_ISSUES.map((n, k) => (
                  <tr key={n}>
                    <td className="strong">{n}</td>
                    <td className="num">
                      {[0, 1, 2].map((j) => `${items[k * 3 + j].code}=${items[k * 3 + j].score}`).join(", ")}
                    </td>
                    <td className="r num">{f2(K[k])}</td>
                    <td className="r num">{w[k]}%</td>
                    <td className="r num">{f2((K[k] * w[k]) / 100)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Tổng</td>
                  <td />
                  <td />
                  <td className="r num" style={{ fontWeight: 700 }}>
                    100%
                  </td>
                  <td className="r num" style={{ fontWeight: 700 }}>
                    {f2(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside className="card grow-1 stack-sm" style={{ gap: 12 }}>
          <h2 className="ct">{role === "supplier" ? "Kế hoạch cải thiện" : "Gợi ý cải thiện cho doanh nghiệp"}</h2>
          <p className="muted">
            Nâng 1 bậc ở các chỉ tiêu có tác động lớn nhất.{" "}
            {total < 80 ? (
              <>
                Cần thêm{" "}
                <strong className="num" style={{ color: "var(--ink)" }}>
                  {f2(80 - total)}
                </strong>{" "}
                điểm để đạt mức Tốt.
              </>
            ) : (
              "Đã đạt mức Tốt."
            )}
          </p>
          {plan.map((p) => (
            <div key={p.x.code} className="soft" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="num" style={{ flex: "0 0 auto", fontWeight: 700, color: "var(--ok)", minWidth: 44 }}>
                +{f2(p.gain)}
              </span>
              <div>
                <strong style={{ fontSize: 13 }}>
                  {p.x.code} · {p.x.name}
                </strong>
                <div className="muted wrap">
                  Từ mức {LV[p.x.score]} lên {LV[p.x.score + 1]}: {p.x.next || "duy trì kết quả hiện tại"}
                </div>
                {canSimulate && (
                  <button className="link-btn" style={{ fontSize: 12.5, minHeight: 28, padding: 0 }} onClick={() => setLevel(p.x.code, p.x.score + 1, p.x.base)}>
                    Thử mô phỏng →
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className="muted">Kế hoạch có thể gắn với điều kiện giám sát sau giải ngân; không tự động suy ra giảm lãi suất.</p>
        </aside>
      </section>

      <section className="card">
        <div className="ch">
          <div>
            <h2 className="ct">18 chỉ tiêu & minh chứng</h2>
            <p className="muted">
              0 không có/vi phạm · 1 sơ khai · 2 đáp ứng tối thiểu · 3 quản lý có hệ thống · 4 chủ động, có kết quả đo lường
              {canSimulate && " · Bấm vào ô mức để mô phỏng"}
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 20 }}>
          {(
            [
              ["E · Môi trường", 0],
              ["S · Xã hội", 6],
              ["G · Quản trị", 12],
            ] as const
          ).map(([title, start]) => (
            <div key={title} className="stack-sm" style={{ gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</span>
              {items.slice(start, start + 6).map((it) => (
                <div
                  key={it.code}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "34px minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: "1px solid var(--line-2)",
                  }}
                >
                  <span className="num strong" style={{ fontSize: 12.5 }}>
                    {it.code}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="strong" style={{ fontSize: 13 }}>
                      {it.name}
                    </div>
                    <div className="muted wrap">{it.evidence}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <div style={{ display: "flex", gap: 3 }} role={canSimulate ? "group" : "img"} aria-label={`${it.code} mức ${it.score} trên 4`}>
                      {[1, 2, 3, 4].map((n) => {
                        const filled = it.score >= n;
                        const changed = it.score !== it.base && n > Math.min(it.score, it.base) && n <= Math.max(it.score, it.base);
                        const style = {
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: 0,
                          padding: 0,
                          background: filled ? (changed ? "var(--violet)" : "var(--brand-fill)") : changed ? "#E5D6F5" : "#E6ECE8",
                          cursor: canSimulate ? "pointer" : undefined,
                        } as const;
                        return canSimulate ? (
                          <button
                            key={n}
                            style={style}
                            aria-label={`Đặt ${it.code} ở mức ${n}`}
                            onClick={() => setLevel(it.code, it.score === n ? n - 1 : n, it.base)}
                          />
                        ) : (
                          <span key={n} style={style} />
                        );
                      })}
                    </div>
                    <span className="num muted" style={{ fontSize: 11.5 }}>
                      {it.score}/4{it.score !== it.base && ` (thật: ${it.base})`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="ch">
          <h2 className="ct">Quy trình chấm điểm 9 bước</h2>
          <span className="muted">Tái chấm định kỳ: 10/2027 hoặc khi có sự cố</span>
        </div>
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
            gap: 8,
          }}
        >
          {[
            "Tiếp nhận hồ sơ",
            "Gắn nhóm ngành",
            "Sàng lọc rủi ro nghiêm trọng",
            "Thu thập minh chứng",
            "AI đề xuất · người thẩm định xác nhận",
            "Tính 6 vấn đề",
            "Áp trọng số ngành",
            "Chất lượng dữ liệu & cờ",
            "Báo cáo & giám sát",
          ].map((t, i) => (
            <li
              key={t}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: i === 8 ? "var(--forest)" : "var(--surface-3)",
                color: i === 8 ? "#fff" : undefined,
              }}
            >
              <span className="num" style={{ fontSize: 12.5, color: i === 8 ? "var(--on-forest-2)" : "var(--ink-3)" }}>
                B{i + 1}
              </span>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t}</div>
            </li>
          ))}
        </ol>
        <p className="muted" style={{ marginTop: 12 }}>
          Áp dụng “Khung chấm điểm ESG cho SMEs vay vốn FCC” · Coverage ≥ 80% mới phát hành điểm chính thức · chỉ dùng minh chứng trong 12 tháng
          gần nhất · tổng hiện tại {dec(total, 2)}.
        </p>
      </section>
    </>
  );
}
