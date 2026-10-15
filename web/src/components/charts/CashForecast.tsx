"use client";

import { useState } from "react";
import { CASH_FORECAST, forecastDates, SAFE_BALANCE } from "@/lib/data";
import { vnd } from "@/lib/format";

const W = 720;
const TOP = 12;
const PLOT_H = 188;
const MAX = 2000;
const x = (i: number, n: number) => (i / (n - 1)) * W;
const y = (v: number) => TOP + (1 - v / MAX) * PLOT_H;

export function CashForecast() {
  const [range, setRange] = useState<7 | 30>(30);
  const [hover, setHover] = useState<number | null>(null);

  const n = range;
  const data = CASH_FORECAST.slice(0, n);
  const pts = data.map((v, i) => `${x(i, n).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `M0,200 L${pts.replaceAll(" ", " L")} L${W},200 Z`;
  let minI = 0;
  data.forEach((v, i) => v < data[minI] && (minI = i));
  const hasDip = data[minI] < SAFE_BALANCE;
  const step = n === 7 ? 1 : 5;
  const ticks = Array.from({ length: Math.ceil(n / step) }, (_, k) => k * step);
  const h = hover !== null && hover < n ? hover : null;
  const pctX = (i: number) => (x(i, n) / W) * 100;

  // Số dư đầu + thu − chi = số dư cuối kỳ (khớp với chuỗi dự báo).
  const flows =
    n === 7
      ? { inn: 1030, innNote: "4 hóa đơn đến hạn", out: 1050, outNote: "phải trả đến hạn 7 ngày" }
      : { inn: 4820, innNote: "12 hóa đơn · theo độ trễ từng người mua", out: 4260, outNote: "phải trả, lương, thuế" };

  const summary = hasDip
    ? `Thấp nhất ${vnd(data[minI])} tr ngày ${forecastDates[minI]}, dưới mức an toàn ${vnd(SAFE_BALANCE)} tr.`
    : `Không có ngày nào dưới mức an toàn trong ${n} ngày tới.`;

  return (
    <div>
      <div className="ch">
        <div>
          <h2 className="ct">Dự báo số dư tiền mặt</h2>
          <p className="muted">Triệu đồng · tính từ lịch phải thu/phải trả và độ trễ thanh toán của từng người mua</p>
        </div>
        <div className="seg" role="group" aria-label="Khoảng dự báo">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              className="seg-btn"
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                setHover(null);
              }}
            >
              {r} ngày
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", paddingLeft: 48 }} onMouseLeave={() => setHover(null)}>
        {[2000, 1500, 1000, 500, 0].map((v, i) => (
          <span key={v} className="muted num chart-y" style={{ top: 4 + i * 47 }}>
            {vnd(v)}
          </span>
        ))}
        <div style={{ position: "relative", height: 220 }}>
          <svg width="100%" height="220" viewBox={`0 0 ${W} 220`} preserveAspectRatio="none" role="img" aria-label={`Biểu đồ số dư tiền mặt dự báo ${n} ngày. ${summary}`}>
            {[12, 59, 106, 153].map((yy) => (
              <line key={yy} x1="0" y1={yy} x2={W} y2={yy} stroke="#E6ECE8" vectorEffect="non-scaling-stroke" />
            ))}
            <line x1="0" y1="200" x2={W} y2="200" stroke="#C9D4CE" vectorEffect="non-scaling-stroke" />
            <path d={area} fill="#0A7A5C" fillOpacity="0.10" />
            <line
              x1="0"
              y1={y(SAFE_BALANCE)}
              x2={W}
              y2={y(SAFE_BALANCE)}
              stroke="#B42318"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
            <polyline points={pts} fill="none" stroke="#0A7A5C" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            style={{
              position: "absolute",
              right: 0,
              top: y(SAFE_BALANCE) - 20,
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--bad)",
              background: "#fff",
              padding: "0 4px",
            }}
          >
            Mức an toàn {vnd(SAFE_BALANCE)}
          </span>
          {hasDip && (
            <span
              title={`Thấp nhất ${forecastDates[minI]}`}
              style={{
                position: "absolute",
                left: `${pctX(minI)}%`,
                top: y(data[minI]),
                width: 12,
                height: 12,
                margin: "-6px 0 0 -6px",
                borderRadius: "50%",
                background: "var(--bad-strong)",
                border: "2px solid #fff",
              }}
            />
          )}
          {h !== null && (
            <>
              <span
                style={{
                  position: "absolute",
                  left: `${pctX(h)}%`,
                  top: 12,
                  bottom: 20,
                  width: 1,
                  background: "var(--ink)",
                  opacity: 0.35,
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: `${pctX(h)}%`,
                  top: y(data[h]),
                  width: 10,
                  height: 10,
                  margin: "-5px 0 0 -5px",
                  borderRadius: "50%",
                  background: data[h] < SAFE_BALANCE ? "var(--bad-strong)" : "var(--brand-fill)",
                  border: "2px solid #fff",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: `${Math.min(86, Math.max(14, pctX(h)))}%`,
                  top: 0,
                  transform: "translateX(-50%)",
                  background: "var(--ink)",
                  color: "#fff",
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                <strong>{forecastDates[h]}</strong> · <span className="num">{vnd(data[h])} tr</span>
                {data[h] < SAFE_BALANCE && <span style={{ color: "#FFB4AB" }}> · thiếu {vnd(SAFE_BALANCE - data[h])} tr</span>}
              </span>
            </>
          )}
          <div style={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((_, i) => (
              <div key={i} style={{ flex: "1 1 0", height: "100%" }} onMouseEnter={() => setHover(i)} />
            ))}
          </div>
        </div>
        <div style={{ position: "relative", height: 22 }}>
          {ticks.map((i) => (
            <span
              key={i}
              className="muted num"
              style={{ position: "absolute", left: `${pctX(i)}%`, transform: "translateX(-50%)", fontSize: 11, top: 4 }}
            >
              {forecastDates[i]}
            </span>
          ))}
        </div>
      </div>
      <div className="legend muted">
        <span>
          <span style={{ width: 16, height: 2, background: "var(--brand-fill)" }} />
          Số dư dự báo
        </span>
        <span>
          <span style={{ width: 16, height: 0, borderTop: "2px dashed var(--bad-strong)" }} />
          Mức an toàn
        </span>
        <span style={{ color: hasDip ? "var(--bad)" : "var(--ok)", fontWeight: 600 }}>{summary}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        {(
          [
            ["Số dư hôm nay", 1260, "2 tài khoản"],
            ["Thu dự kiến", flows.inn, flows.innNote],
            ["Chi dự kiến", -flows.out, flows.outNote],
            [`Cuối kỳ ${n} ngày`, data[n - 1], data[n - 1] >= SAFE_BALANCE ? "trên mức an toàn" : "dưới mức an toàn"],
          ] as const
        ).map(([label, v, note]) => (
          <div key={label} className="soft">
            <div className="muted">{label}</div>
            <div className="num" style={{ fontSize: 17, fontWeight: 600, color: v < 0 ? "var(--warn)" : undefined }}>
              {v < 0 ? "−" : v > 0 && label === "Thu dự kiến" ? "+" : ""}
              {vnd(Math.abs(v))} tr
            </div>
            <div className="muted">{note}</div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        Dự báo – không phải cam kết. Sai số trung bình 30 ngày gần nhất: ±6%.
      </p>
    </div>
  );
}
