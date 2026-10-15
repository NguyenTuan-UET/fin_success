"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Send, Sparkles } from "lucide-react";
import { OFFERS, estimate, type Offer } from "@/lib/data";
import { dec, pct, vnd } from "@/lib/format";
import { Disclaimer } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";

type Target = { id: string; party: string; amount: number; days: number };

const TONES: Record<Offer["tone"], [string, string]> = {
  ok: ["var(--ok-bg)", "var(--ok)"],
  info: ["var(--info-bg)", "var(--info)"],
  violet: ["var(--violet-bg)", "var(--violet)"],
  warn: ["var(--warn-bg)", "var(--warn)"],
};

const OUR_ESG = 74;

export function MarketplaceCompare({
  targets,
  nextHref,
  partyLabel,
  esgHref = "/supplier/esg",
  esgOwner = "bạn",
}: {
  targets: Target[];
  nextHref: string;
  partyLabel: string;
  esgHref?: string;
  esgOwner?: string;
}) {
  const toast = useToast();
  const [targetId, setTargetId] = useState(targets[0].id);
  const [sort, setSort] = useState<"cost" | "speed" | "ratio">("cost");
  const [greenOnly, setGreenOnly] = useState(false);
  const [sel, setSel] = useState("xanh");
  const [rfq, setRfq] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const t = targets.find((x) => x.id === targetId) ?? targets[0];

  const rows = OFFERS.filter((o) => !greenOnly || o.green)
    .map((o) => ({ o, e: estimate(o, t.amount, t.days) }))
    .sort((a, b) =>
      sort === "cost"
        ? a.e.cost - b.e.cost
        : sort === "speed"
          ? a.o.days - b.o.days || a.e.cost - b.e.cost
          : b.o.ratio - a.o.ratio || a.e.cost - b.e.cost,
    );
  const cheapest = rows.length ? Math.min(...rows.map((r) => r.e.cost)) : 0;

  const s = OFFERS.find((o) => o.id === sel) ?? OFFERS[0];
  const e = estimate(s, t.amount, t.days);

  const toggleRfq = (id: string) =>
    setRfq((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= 3 ? xs : [...xs, id]));

  return (
    <>
      <div className="card" style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span className="muted strong">Khoản muốn tài trợ</span>
        <div className="seg" role="group" aria-label="Chọn hóa đơn">
          {targets.map((x) => (
            <button
              key={x.id}
              className="seg-btn"
              aria-pressed={x.id === targetId}
              onClick={() => {
                setTargetId(x.id);
                setSubmitted(false);
              }}
            >
              <span className="num">{x.id}</span>
              <span style={{ opacity: 0.8 }}>· {vnd(x.amount / 1e6)} tr</span>
            </button>
          ))}
        </div>
        <span className="muted">
          {partyLabel}: <strong style={{ color: "var(--ink)" }}>{t.party}</strong> · kỳ hạn {t.days} ngày
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <span className="muted strong">Sắp xếp</span>
        <div className="seg" role="group" aria-label="Sắp xếp">
          {(
            [
              ["cost", "Chi phí thấp nhất"],
              ["speed", "Giải ngân nhanh nhất"],
              ["ratio", "Tỷ lệ tài trợ cao nhất"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className="seg-btn" aria-pressed={sort === k} onClick={() => setSort(k)}>
              {l}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <label className="check" style={{ alignItems: "center", minHeight: 40 }}>
          <input type="checkbox" checked={greenOnly} onChange={() => setGreenOnly((g) => !g)} />
          Chỉ gói có ưu đãi ESG
        </label>
      </div>

      <section className="row top">
        <div className="stack grow-3" style={{ gap: 12 }}>
          {rows.map(({ o, e: oe }) => {
            const on = o.id === sel;
            const inRfq = rfq.includes(o.id);
            const [bg, fg] = TONES[o.tone];
            return (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "#fff",
                  border: on ? "2px solid var(--brand)" : "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: "2 1 220px", minWidth: 0 }}>
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      flex: "0 0 auto",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      background: bg,
                      color: fg,
                    }}
                    aria-hidden="true"
                  >
                    {o.ini}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <strong style={{ fontSize: 14.5 }}>{o.name}</strong>
                      {oe.cost === cheapest && <span className="chip c-ai">Chi phí thấp nhất</span>}
                    </div>
                    <div className="muted">
                      {o.type} · {o.collat}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(72px, 1fr))", gap: 12, flex: "3 1 360px" }}>
                  <div>
                    <div className="muted">Lãi suất/năm</div>
                    <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>
                      {dec(o.rate)}%
                    </div>
                  </div>
                  <div>
                    <div className="muted">Tài trợ tới</div>
                    <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>
                      {pct(o.ratio, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="muted">Giải ngân</div>
                    <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>
                      {`T+${o.days}`}
                    </div>
                  </div>
                  <div>
                    <div className="muted">Tổng chi phí</div>
                    <div className="num" style={{ fontSize: 15, fontWeight: 600, paddingTop: 2 }}>
                      {dec(oe.cost / 1e6)} tr
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
                  <button className={on ? "btn bp sm" : "btn bs sm"} onClick={() => setSel(o.id)} aria-pressed={on} style={{ minWidth: 96 }}>
                    {on ? "Đang xem" : "Xem chi phí"}
                  </button>
                  <label className="check" style={{ fontSize: 12.5, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={inRfq}
                      disabled={!inRfq && rfq.length >= 3}
                      onChange={() => toggleRfq(o.id)}
                    />
                    Lấy báo giá
                  </label>
                </div>
                {o.green && (
                  <span className="muted" style={{ flexBasis: "100%", marginTop: -6 }}>
                    Ưu đãi ESG: <strong style={{ color: "var(--ok)" }}>{o.esg}</strong> · yêu cầu ESG ≥ {o.minEsg}, {esgOwner} có {OUR_ESG} ✓
                  </span>
                )}
              </div>
            );
          })}

          <div className="card" style={{ background: "var(--surface-2)", borderStyle: "dashed" }}>
            <div className="ch" style={{ marginBottom: 8 }}>
              <h3 className="ct">Chưa phù hợp (1)</h3>
              <span className="muted">FCC chỉ ra lý do để bạn biết cần cải thiện gì</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <Lock size={18} color="var(--ink-3)" aria-hidden="true" />
              <div style={{ flex: "1 1 260px" }}>
                <strong>Ngân hàng Phương Nam · Tín dụng xanh 5,2%/năm</strong>
                <div className="muted">
                  Cần ESG ≥ 80 — điểm hiện tại {OUR_ESG}. Còn thiếu 6,25 điểm; xem các chỉ tiêu nâng bậc dễ nhất.
                </div>
              </div>
              <Link className="btn bs sm" href={esgHref}>
                Xem kế hoạch ESG
              </Link>
            </div>
          </div>

          <Disclaimer>
            Ước tính theo biểu giá các tổ chức công bố ngày 15/10/2026, không phải báo giá. Sắp xếp theo tổng chi phí, không theo hoa hồng.
            Lãi suất thực tế do tổ chức tài chính quyết định sau thẩm định.
          </Disclaimer>
        </div>

        <aside className="stack grow-1">
          <div className="card stack-sm" style={{ gap: 12 }}>
            <span className="muted">
              Chi phí ước tính · {t.id} · {t.days} ngày
            </span>
            <h2 className="ct" style={{ fontSize: 17 }}>
              {s.name}
            </h2>
            <div className="line-item">
              <span>Giá trị hóa đơn</span>
              <span className="num">{vnd(t.amount)}</span>
            </div>
            <div className="line-item">
              <span>
                Số tiền tài trợ (<Term k="advance">{pct(s.ratio, 0)}</Term>)
              </span>
              <span className="num strong">{vnd(e.adv)}</span>
            </div>
            <div className="line-item">
              <span>Phí xử lý ({pct(s.fee, 2)})</span>
              <span className="num">−{vnd(e.fee)}</span>
            </div>
            <div
              className="line-item"
              style={{ fontSize: 14, padding: "10px 0", borderTop: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)" }}
            >
              <strong style={{ color: "var(--ink)" }}>Thực nhận khi giải ngân</strong>
              <strong className="num">{vnd(e.net)}</strong>
            </div>
            <div className="line-item">
              <span>
                Lãi {t.days} ngày ({dec(s.rate)}%)
              </span>
              <span className="num">{vnd(e.interest)}</span>
            </div>
            <div className="line-item">
              <span>Hoàn lại khi đến hạn thanh toán</span>
              <span className="num">{vnd(e.back)}</span>
            </div>
            <div className="line-item">
              <span>Tổng chi phí vốn</span>
              <span className="num strong">{vnd(e.cost)}</span>
            </div>
            <div className="line-item">
              <span>Chi phí hiệu dụng/năm</span>
              <span className="num">{pct(e.effective, 2)}</span>
            </div>

            {submitted ? (
              <>
                <div className="soft" style={{ background: "var(--ok-bg)", color: "var(--ok)", fontSize: 13 }}>
                  <strong>Đã gửi hồ sơ tới {s.name}.</strong> Khoản phải thu {t.id} đã được khóa để tránh tài trợ trùng.
                </div>
                <Link className="btn bp" href={nextHref}>
                  Theo dõi giải ngân
                </Link>
              </>
            ) : (
              <>
                <label className="check">
                  <input type="checkbox" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} />
                  <span>
                    Tôi đồng ý chia sẻ hồ sơ (hóa đơn, BCTC, ESG) với <strong>{s.name}</strong> cho mục đích thẩm định khoản này.
                  </span>
                </label>
                <button
                  className="btn bp"
                  disabled={!consent}
                  onClick={() => {
                    setSubmitted(true);
                    toast(`Đã gửi hồ sơ ${t.id} tới ${s.name}.`);
                  }}
                >
                  Gửi hồ sơ & đồng ý điều khoản
                </button>
                <p className="muted">Có thể thu hồi quyền truy cập bất kỳ lúc nào trong Cài đặt.</p>
              </>
            )}
          </div>

          {rfq.length > 0 && (
            <div className="card stack-sm" style={{ gap: 10, borderColor: "var(--brand)" }}>
              <h3 className="ct">Yêu cầu báo giá ({rfq.length}/3)</h3>
              <p className="muted">Gửi gói tóm tắt (chưa gồm chứng từ đầy đủ) để các tổ chức cạnh tranh báo giá. Bạn chọn 1 sau khi nhận phản hồi.</p>
              {rfq.map((id) => (
                <span key={id} className="between" style={{ fontSize: 13 }}>
                  {OFFERS.find((o) => o.id === id)?.name}
                  <button className="link-btn" onClick={() => toggleRfq(id)}>
                    Bỏ
                  </button>
                </span>
              ))}
              <button
                className="btn bs"
                onClick={() => {
                  toast(`Đã gửi yêu cầu báo giá tới ${rfq.length} tổ chức. Phản hồi dự kiến trong 4 giờ làm việc.`);
                  setRfq([]);
                }}
              >
                <Send size={15} aria-hidden="true" />
                Gửi yêu cầu báo giá
              </button>
            </div>
          )}

          <div className="dark stack-sm">
            <span className="d-title">
              <Sparkles size={18} color="#DDF1C4" aria-hidden="true" />
              Vì sao Quỹ Đầu tư Xanh?
            </span>
            <p>Tổng chi phí thấp nhất, giải ngân T+1 và không bắt buộc TSBĐ. Điểm ESG 74 của {esgOwner} vượt ngưỡng 65 mà quỹ yêu cầu.</p>
          </div>
        </aside>
      </section>
    </>
  );
}
