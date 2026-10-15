"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Bar, Disclaimer } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";

type App = {
  id: string;
  company: string;
  industry: string;
  amount: string;
  received: string;
  inv: string;
  invVal: string;
  buyer: string;
  five: number[];
  esg: number;
  cov: number;
  unv: string;
  range: string;
  flag: string;
  flagLv: 0 | 1 | 2;
  dscr: string;
  de: string;
  cic: string;
  verify: string;
  ontime: string;
  collat: string;
  cs: 1 | 2 | 3;
  ratio: string;
  rate: string;
  limit: string;
  cond: string;
  ai: [string, string];
};

const APPS: App[] = [
  { id: "TT-0418", company: "Vật liệu Sao Mai", industry: "Sản xuất · VLXD", amount: "1.600.000.000", received: "15/10 23:55", inv: "HD-0418", invVal: "2 tỷ · 90 ngày", buyer: "Đông Á · A", five: [18, 22, 12, 10, 14], esg: 74, cov: 18, unv: "Không", range: "74 (đủ cơ sở)", flag: "Không có cờ rủi ro nghiêm trọng", flagLv: 0, dscr: "1,55", de: "1,8", cic: "Nhóm 1", verify: "Người mua đã xác nhận", ontime: "96%", collat: "3,15 tỷ (nhà xưởng, máy, tồn kho)", cs: 1, ratio: "80", rate: "5,9", limit: "4.200.000.000", cond: "Thanh toán qua tài khoản chuyên thu; cập nhật biên bản kiểm kê tồn kho.", ai: ["Khuyến nghị phê duyệt", "Người mua hạng A đã xác nhận khoản phải thu; DSCR 1,55 vượt ngưỡng 1,3; ESG 74 đủ ưu đãi −0,7% và phê duyệt trong 24 giờ."] },
  { id: "TT-0533", company: "Điện cơ Nam Việt", industry: "Sản xuất · thiết bị điện", amount: "688.000.000", received: "15/10 17:20", inv: "HD-2209", invVal: "860 tr · 56 ngày", buyer: "Đông Á · A", five: [19, 25, 12, 6, 19], esg: 81, cov: 17, unv: "S5", range: "79–83", flag: "Không có cờ rủi ro nghiêm trọng", flagLv: 0, dscr: "1,82", de: "1,2", cic: "Nhóm 1", verify: "Người mua đã xác nhận", ontime: "96%", collat: "Không có", cs: 2, ratio: "80", rate: "5,9", limit: "2.000.000.000", cond: "Tài trợ dựa trên khoản phải thu; người mua cam kết trả vào tài khoản chuyên thu.", ai: ["Khuyến nghị phê duyệt", "Không có TSBĐ nhưng khoản phải thu chất lượng cao, người mua hạng A, dòng tiền ổn định 24 tháng."] },
  { id: "TT-0529", company: "Bao bì Hòa Khánh", industry: "Sản xuất · bao bì", amount: "940.000.000", received: "15/10 10:05", inv: "HD-3051", invVal: "1,25 tỷ · 75 ngày", buyer: "Thực phẩm Mekong · B+", five: [15, 21, 10, 7, 15], esg: 61, cov: 15, unv: "E4, S2, G3", range: "55–68 (chưa đủ cơ sở)", flag: "Coverage dưới 80%: chưa trình điểm ESG chính thức", flagLv: 1, dscr: "1,34", de: "2,6", cic: "Nhóm 1", verify: "Người mua đã xác nhận", ontime: "88%", collat: "Máy ép màng 520 tr (LTV 50%)", cs: 2, ratio: "75", rate: "6,6", limit: "1.500.000.000", cond: "Bổ sung chứng từ xử lý chất thải (E4) và hồ sơ an toàn lao động (S2) trước giải ngân.", ai: ["Phê duyệt có điều kiện", "Khả năng trả nợ đạt ngưỡng nhưng sát giới hạn; ESG thiếu 3 chỉ tiêu nên chỉ hiển thị khoảng điểm."] },
  { id: "TT-0521", company: "Gỗ ván Tân Lập", industry: "Nông nghiệp – thực phẩm", amount: "300.000.000", received: "14/10 15:40", inv: "HD-0877", invVal: "400 tr · 60 ngày", buyer: "Đông Á · A", five: [12, 16, 8, 4, 14], esg: 48, cov: 16, unv: "E2, S3", range: "44–52", flag: "Cờ đỏ G2: chậm nộp thuế 2 kỳ — thẩm định tăng cường", flagLv: 2, dscr: "1,08", de: "4,1", cic: "Nhóm 2", verify: "Người mua đã xác nhận", ontime: "96%", collat: "Không có", cs: 3, ratio: "", rate: "", limit: "", cond: "Không đề xuất giải ngân; chuyển tổ chức có sản phẩm phù hợp nếu doanh nghiệp đồng ý.", ai: ["Không đề xuất giải ngân", "DSCR 1,08 dưới ngưỡng 1,3, nợ/VCSH 4,1 vượt 3, ESG yếu kèm cờ đỏ thuế. Người mua tốt không bù được rủi ro bên bán."] },
];

const NAMES = ["Nhân cách", "Năng lực trả nợ", "Vốn", "Tài sản bảo đảm", "Hoàn cảnh"];
const MAXES = [20, 30, 15, 15, 20];
const DEC = { ok: ["Đã phê duyệt", "c-ok"], more: ["Đã yêu cầu bổ sung", "c-warn"], no: ["Đã từ chối", "c-bad"] } as const;
const CASES = { 1: ["(i) Có TSBĐ & phải thu tốt", "c-ok"], 2: ["(ii) Dựa trên khoản phải thu", "c-info"], 3: ["(iii) Không đủ điều kiện", "c-bad"] } as const;
const FLAG_STYLE = [
  { background: "var(--ok-bg)", color: "var(--ok)" },
  { background: "var(--warn-bg)", color: "var(--warn)" },
  { background: "var(--bad-bg)", color: "var(--bad)", fontWeight: 600 },
];
const band = (e: number) => (e >= 80 ? ["Tốt", "c-ok"] : e >= 65 ? ["Khá", "c-gold"] : e >= 50 ? ["Trung bình", "c-warn"] : ["Yếu", "c-bad"]);

export function LenderAppraisal() {
  const toast = useToast();
  const [sel, setSel] = useState("TT-0418");
  const [dec, setDec] = useState<Record<string, keyof typeof DEC>>({});
  const [form, setForm] = useState<Record<string, { ratio: string; rate: string; limit: string; cond: string }>>({});

  const a = APPS.find((x) => x.id === sel) ?? APPS[0];
  const f = form[a.id] ?? { ratio: a.ratio, rate: a.rate, limit: a.limit, cond: a.cond };
  const setF = (k: keyof typeof f, v: string) => setForm((x) => ({ ...x, [a.id]: { ...f, [k]: v } }));
  const total = a.five.reduce((x, y) => x + y, 0);
  const b = band(a.esg);
  const d = dec[a.id];
  const covPct = Math.round((a.cov / 18) * 100);

  const decide = (v: keyof typeof DEC) => {
    setDec((x) => ({ ...x, [a.id]: v }));
    toast(`${DEC[v][0]} ${a.id} · ${a.company}. Doanh nghiệp đã được thông báo.`);
  };

  return (
    <section className="row top">
      <nav className="card stack-sm" style={{ flex: "1 1 220px", minWidth: 0, padding: 12, gap: 8 }} aria-label="Hàng đợi hồ sơ">
        <span className="muted strong" style={{ padding: "4px 6px" }}>
          Hàng đợi · {APPS.filter((x) => !dec[x.id]).length} hồ sơ chờ
        </span>
        {APPS.map((p) => {
          const on = p.id === sel;
          const pd = dec[p.id];
          const sum = p.five.reduce((x, y) => x + y, 0);
          return (
            <button
              key={p.id}
              onClick={() => setSel(p.id)}
              aria-current={on ? "true" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                padding: 12,
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                border: on ? "2px solid var(--brand)" : "1px solid var(--line-2)",
                background: on ? "var(--surface-3)" : "#fff",
              }}
            >
              <span className="between" style={{ width: "100%" }}>
                <strong className="num">{p.id}</strong>
                <span className={`chip ${pd ? DEC[pd][1] : p.cs === 3 ? "c-bad" : "c-neu"}`}>
                  {pd ? DEC[pd][0] : p.cs === 3 ? "Rủi ro cao" : "Chờ xử lý"}
                </span>
              </span>
              <span style={{ fontSize: 13 }}>{p.company}</span>
              <span className="muted num">
                {p.amount} đ · 5C {sum} · ESG {p.esg}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="stack" style={{ flex: "3 1 480px", minWidth: 0 }}>
        <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: "16px 28px", alignItems: "center" }}>
          <div style={{ flex: "2 1 260px" }}>
            <span className="muted num">
              {a.id} · nhận {a.received}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>{a.company}</h2>
            <span className="muted">
              {a.industry} · đề nghị <span className="num">{a.amount} đ</span> · hóa đơn {a.inv}
            </span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div className="muted">
                <Term k="riskScore">Điểm 5C</Term>
              </div>
              <div className="num" style={{ fontSize: 28, fontWeight: 600 }}>
                {total}
                <span className="muted">/100</span>
              </div>
            </div>
            <div>
              <div className="muted">ESG</div>
              <div className="num" style={{ fontSize: 28, fontWeight: 600 }}>
                {a.esg}
                <span className="muted">/100</span>
              </div>
            </div>
            <div>
              <div className="muted">Người mua</div>
              <div className="strong" style={{ fontSize: 15, paddingTop: 6 }}>
                {a.buyer}
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="card grow-1" style={{ flexBasis: 260 }}>
            <div className="ch">
              <h3 className="ct">
                <Term k="fiveC">Mô hình 5C</Term>
              </h3>
              <span className="muted">Trọng số 20/30/15/15/20</span>
            </div>
            <div className="stack-sm">
              {a.five.map((s, i) => (
                <div key={NAMES[i]} style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) 52px", gap: 10, alignItems: "center", fontSize: 13 }}>
                  <span>{NAMES[i]}</span>
                  <Bar value={(s / MAXES[i]) * 100} color={s / MAXES[i] < 0.5 ? "var(--warn-strong)" : undefined} />
                  <span className="num" style={{ textAlign: "right" }}>
                    {s}/{MAXES[i]}
                  </span>
                </div>
              ))}
            </div>
            <div className="divider" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14, fontSize: 12.5 }}>
              <div>
                <div className="muted">
                  <Term k="dscr" />
                </div>
                <div className="num strong">{a.dscr}</div>
              </div>
              <div>
                <div className="muted">Nợ/VCSH</div>
                <div className="num strong">{a.de}</div>
              </div>
              <div>
                <div className="muted">
                  <Term k="cic" />
                </div>
                <div className="strong">{a.cic}</div>
              </div>
            </div>
          </div>
          <div className="card grow-1 stack-sm" style={{ flexBasis: 260 }}>
            <div className="ch" style={{ marginBottom: 4 }}>
              <h3 className="ct">ESG & chất lượng dữ liệu</h3>
              <span className={`chip ${b[1]}`}>{b[0]}</span>
            </div>
            <div className="line-item">
              <span>
                <Term k="coverage">Độ bao phủ chứng cứ</Term>
              </span>
              <strong className="num">
                {a.cov}/18 · {covPct}%
              </strong>
            </div>
            <Bar value={covPct} color={covPct >= 80 ? undefined : "var(--warn-strong)"} />
            <div className="line-item">
              <span>Khoảng điểm nếu thiếu dữ liệu</span>
              <span className="num">{a.range}</span>
            </div>
            <div className="line-item">
              <span>Chỉ tiêu chưa xác minh</span>
              <span className="num">{a.unv}</span>
            </div>
            <div style={{ fontSize: 12.5, padding: "10px 12px", borderRadius: 10, ...FLAG_STYLE[a.flagLv] }}>{a.flag}</div>
            <Link href="/lender/esg" className="strong" style={{ fontSize: 13 }}>
              Xem 18 chỉ tiêu ESG
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="ch">
            <h3 className="ct">Khoản phải thu & tài sản bảo đảm</h3>
            <span className={`chip ${CASES[a.cs][1]}`}>{CASES[a.cs][0]}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: 14, fontSize: 13 }}>
            <div>
              <div className="muted">Hóa đơn</div>
              <div className="strong">
                <span className="num">{a.inv}</span> · {a.invVal}
              </div>
            </div>
            <div>
              <div className="muted">Xác thực</div>
              <div className="strong">{a.verify}</div>
            </div>
            <div>
              <div className="muted">Người mua trả đúng hạn</div>
              <div className="num strong">{a.ontime}</div>
            </div>
            <div>
              <div className="muted">
                <Term k="tsbd">TSBĐ</Term> công nhận
              </div>
              <div className="strong">{a.collat}</div>
            </div>
          </div>
        </div>
        <Disclaimer>Điểm của FCC là đầu vào tham khảo. Hạn mức, giá và quyết định tín dụng thuộc về tổ chức của bạn.</Disclaimer>
      </div>

      <aside className="stack" style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div className="dark stack-sm">
          <span className="d-title">
            <Sparkles size={18} color="#DDF1C4" aria-hidden="true" />
            Khuyến nghị AI
          </span>
          <strong style={{ color: "var(--lime)", fontSize: 15 }}>{a.ai[0]}</strong>
          <p>{a.ai[1]}</p>
        </div>
        <div className="card stack-sm" style={{ gap: 12 }}>
          <h3 className="ct">Quyết định tài trợ</h3>
          {a.cs === 3 ? (
            <p className="muted soft">Hồ sơ thuộc nhóm (iii). Bạn vẫn có thể yêu cầu bổ sung hoặc từ chối.</p>
          ) : (
            <>
              <div className="grid-fields" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <label className="field">
                  <span className="field-label">Tỷ lệ tài trợ (%)</span>
                  <input className="input num" inputMode="decimal" value={f.ratio} onChange={(e) => setF("ratio", e.target.value)} disabled={!!d} />
                </label>
                <label className="field">
                  <span className="field-label">Lãi suất (%/năm)</span>
                  <input className="input num" inputMode="decimal" value={f.rate} onChange={(e) => setF("rate", e.target.value)} disabled={!!d} />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Hạn mức doanh nghiệp (đ)</span>
                <input className="input num" inputMode="numeric" value={f.limit} onChange={(e) => setF("limit", e.target.value)} disabled={!!d} />
              </label>
            </>
          )}
          <label className="field">
            <span className="field-label">Điều kiện kèm theo</span>
            <textarea className="textarea" rows={3} value={f.cond} onChange={(e) => setF("cond", e.target.value)} disabled={!!d} />
          </label>
          {d ? (
            <div className="stack-sm" style={{ gap: 8 }}>
              <span className={`chip lg ${DEC[d][1]}`} style={{ alignSelf: "flex-start" }}>
                {DEC[d][0]}
              </span>
              <button
                className="btn bs"
                onClick={() =>
                  setDec((x) => {
                    const n = { ...x };
                    delete n[a.id];
                    return n;
                  })
                }
              >
                Hoàn tác
              </button>
            </div>
          ) : (
            <div className="stack-sm" style={{ gap: 8 }}>
              {a.cs !== 3 && (
                <button className="btn bp" onClick={() => decide("ok")}>
                  Phê duyệt & gửi điều khoản
                </button>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn bs" style={{ flex: "1 1 0" }} onClick={() => decide("more")}>
                  Yêu cầu bổ sung
                </button>
                <button className="btn bd" style={{ flex: "1 1 0" }} onClick={() => decide("no")}>
                  Từ chối
                </button>
              </div>
            </div>
          )}
          <p className="muted">Mọi quyết định cần MFA, được ghi vào Audit Trail và thông báo cho doanh nghiệp.</p>
        </div>
      </aside>
    </section>
  );
}
