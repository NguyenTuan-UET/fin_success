"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/Toast";

const LO = 5.5;
const HI = 8.5;
const pos = (r: number) => ((r - LO) / (HI - LO)) * 100;

const BANKS: [string, number, boolean, boolean][] = [
  ["Quỹ Đầu tư Xanh (bạn)", 5.9, true, false],
  ["Thịnh An", 6.5, false, true],
  ["Hải Đăng", 6.8, false, false],
  ["Phù Sa", 7.1, false, true],
  ["Vạn Lộc", 7.4, false, false],
  ["An Khang", 8.1, false, true],
];

const PRODUCTS = [
  { id: "green", name: "Tài trợ hóa đơn xanh", sub: "Dành cho SME đạt ESG Khá trở lên", rate: "5,9%", ratio: "80%", cond: "ESG ≥ 65, Coverage ≥ 80%, người mua hạng A–B", speed: "T+1" },
  { id: "std", name: "Tài trợ khoản phải thu tiêu chuẩn", sub: "Không yêu cầu TSBĐ", rate: "7,0%", ratio: "75%", cond: "Xếp hạng FCC ≥ BBB, hóa đơn đã được người mua xác nhận", speed: "T+2" },
  { id: "sme", name: "Tài trợ đơn hàng siêu nhỏ", sub: "Hóa đơn dưới 200 triệu", rate: "7,8%", ratio: "70%", cond: "Đang thử nghiệm với 20 doanh nghiệp", speed: "T+1" },
];

export function RateStrip() {
  return (
    <div style={{ position: "relative", height: 150, margin: "0 28px" }} role="img" aria-label={`Lãi suất: ${BANKS.map((b) => `${b[0]} ${b[1]}%`).join(", ")}`}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 74, height: 2, background: "var(--line)" }} />
      {BANKS.map(([name, rate, me, below]) => (
        <div key={name} style={{ position: "absolute", left: `${pos(rate)}%`, top: 0, height: 150, width: 0 }}>
          <span
            style={{
              position: "absolute",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              textAlign: "center",
              fontSize: 12,
              lineHeight: 1.3,
              top: below ? 92 : 22,
              color: me ? "var(--ok)" : "var(--ink-2)",
              fontWeight: me ? 700 : 400,
            }}
          >
            {name}
            <br />
            <span className="num strong">{rate.toLocaleString("vi-VN")}%</span>
          </span>
          <span
            style={{
              position: "absolute",
              left: -8,
              top: 67,
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2px solid #fff",
              background: me ? "var(--brand)" : "var(--info-strong)",
            }}
          />
        </div>
      ))}
      {[5.5, 6, 6.5, 7, 7.5, 8, 8.5].map((t) => (
        <span key={t} className="muted num" style={{ position: "absolute", top: 132, fontSize: 11, transform: "translateX(-50%)", left: `${pos(t)}%` }}>
          {t.toLocaleString("vi-VN")}
        </span>
      ))}
    </div>
  );
}

export function LenderProducts() {
  const toast = useToast();
  const [off, setOff] = useState<Record<string, boolean>>({ std: false, sme: true });
  return (
    <div className="card flush grow-2">
      <div className="ch">
        <h2 className="ct">Gói tài trợ của bạn</h2>
        <span className="muted">Biểu giá có phiên bản · FCC chỉ kiểm tra trình bày</span>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Gói</th>
              <th className="r">Lãi suất</th>
              <th className="r">Tài trợ tới</th>
              <th>Điều kiện</th>
              <th>Giải ngân</th>
              <th>Trạng thái</th>
              <th>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((p) => {
              const isOff = !!off[p.id];
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="muted">{p.sub}</div>
                  </td>
                  <td className="r num">{p.rate}</td>
                  <td className="r num">{p.ratio}</td>
                  <td className="wrap" style={{ minWidth: 200 }}>
                    {p.cond}
                  </td>
                  <td className="num">{p.speed}</td>
                  <td>
                    <span className={`chip ${isOff ? "c-neu" : "c-ok"}`}>{isOff ? "Tạm dừng" : "Đang chào"}</span>
                  </td>
                  <td>
                    <button
                      className="btn bs sm"
                      onClick={() => {
                        setOff((o) => ({ ...o, [p.id]: !isOff }));
                        toast(isOff ? `Đã mở chào lại “${p.name}”.` : `Đã tạm dừng “${p.name}”. Hồ sơ đang xử lý không bị ảnh hưởng.`);
                      }}
                    >
                      {isOff ? "Mở chào" : "Tạm dừng"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
