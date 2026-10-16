"use client";

import { useState } from "react";
import { AlertTriangle, CircleCheck, Undo2 } from "lucide-react";
import { cx, vnd } from "@/lib/format";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";

type Check = ["ok" | "warn", string, string];
const PENDING: { id: string; sup: string; amt: number; due: string; ok3: boolean; checks: Check[] }[] = [
  {
    id: "HD-0421",
    sup: "Vật liệu Sao Mai",
    amt: 1_120_000_000,
    due: "25/01/2027",
    ok3: true,
    checks: [
      ["ok", "Khớp đơn mua hàng PO-2026-311", "Đơn giá và số lượng trùng khớp"],
      ["ok", "Biên bản giao hàng BBGH-0421", "Ký số bởi kho công trình khu B"],
      ["ok", "Hóa đơn điện tử hợp lệ", "Không trùng lặp, chưa hủy"],
    ],
  },
  {
    id: "HD-2209",
    sup: "Điện cơ Nam Việt",
    amt: 860_000_000,
    due: "10/12/2026",
    ok3: true,
    checks: [
      ["ok", "Khớp đơn mua hàng PO-2026-298", "Đơn giá và số lượng trùng khớp"],
      ["ok", "Biên bản nghiệm thu", "Nghiệm thu lắp đặt 08/10"],
      ["ok", "Hóa đơn điện tử hợp lệ", "Không trùng lặp, chưa hủy"],
    ],
  },
  {
    id: "HD-0631",
    sup: "Vận tải Hưng Phát",
    amt: 145_000_000,
    due: "14/11/2026",
    ok3: false,
    checks: [
      ["ok", "Khớp hợp đồng vận chuyển", "Đơn giá theo phụ lục 03"],
      ["warn", "Chênh lệch số chuyến", "Hóa đơn 24 chuyến, nhật ký công trình ghi 22 chuyến"],
      ["ok", "Hóa đơn điện tử hợp lệ", "Không trùng lặp, chưa hủy"],
    ],
  },
];

const EARLY = [
  { id: "HD-0406", sup: "Vật liệu Sao Mai", amt: 455_000_000, due: "24/11/2026", days: 40, d: 0.012 },
  { id: "HD-1187", sup: "Bê tông Thành Công", amt: 620_000_000, due: "19/11/2026", days: 35, d: 0.008 },
  { id: "HD-2174", sup: "Điện cơ Nam Việt", amt: 380_000_000, due: "02/11/2026", days: 18, d: 0.002 },
  { id: "HD-0617", sup: "Vận tải Hưng Phát", amt: 210_000_000, due: "30/11/2026", days: 46, d: 0.01 },
];
const HURDLE = 0.045;

export function BuyerConfirm() {
  const toast = useToast();
  const [dec, setDec] = useState<Record<string, "ok" | "no">>({});
  const [sel, setSel] = useState("HD-0421");
  const [early, setEarly] = useState<Record<string, boolean>>({ "HD-0406": true, "HD-1187": true });
  const [approved, setApproved] = useState(false);

  const s = PENDING.find((p) => p.id === sel) ?? PENDING[0];
  const left = PENDING.filter((p) => !dec[p.id]);

  const rows = EARLY.map((e) => {
    const on = !!early[e.id];
    const sv = e.amt * e.d;
    const y = (e.d / e.days) * 365;
    return { ...e, on, sv, y };
  });
  const pay = rows.reduce((a, r) => (r.on ? a + r.amt - r.sv : a), 0);
  const save = rows.reduce((a, r) => (r.on ? a + r.sv : a), 0);

  const decide = (id: string, v: "ok" | "no") => {
    setDec((d) => ({ ...d, [id]: v }));
    setSel(id);
    const p = PENDING.find((x) => x.id === id)!;
    toast(v === "ok" ? `Đã xác nhận ${id}. ${p.sup} có thể dùng hóa đơn này để nhận tiền sớm.` : `Đã gửi yêu cầu giải trình ${id} tới ${p.sup}.`);
  };

  return (
    <>
      <section className="row top">
        <div className="card flush grow-3">
          <div className="ch">
            <h2 className="ct">Chờ xác nhận</h2>
            <span className="muted">{left.length ? `${left.length} hóa đơn · ${vnd(left.reduce((a, p) => a + p.amt, 0))} đ` : "Đã xử lý hết"}</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Hóa đơn</th>
                  <th>Nhà cung cấp</th>
                  <th className="r">Số tiền (đ)</th>
                  <th>Hạn thanh toán</th>
                  <th>
                    <Term k="threeWay">Đối chiếu 3 chiều</Term>
                  </th>
                  <th>Quyết định</th>
                </tr>
              </thead>
              <tbody>
                {PENDING.map((p) => {
                  const d = dec[p.id];
                  return (
                    <tr key={p.id} className={cx("clickable", p.id === sel && "sel")} onClick={() => setSel(p.id)}>
                      <td>
                        <button className="link-btn num" onClick={() => setSel(p.id)} aria-label={`Xem đối chiếu ${p.id}`}>
                          {p.id}
                        </button>
                      </td>
                      <td className="wrap" style={{ minWidth: 110 }}>
                        {p.sup}
                      </td>
                      <td className="r num">{vnd(p.amt)}</td>
                      <td className="num">{p.due}</td>
                      <td>
                        <span className={`chip ${p.ok3 ? "c-ok" : "c-warn"}`}>{p.ok3 ? "Khớp 3/3" : "Lệch 1/3"}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {d ? (
                          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <span className={`chip ${d === "ok" ? "c-ok" : "c-warn"}`}>{d === "ok" ? "Đã xác nhận" : "Đã yêu cầu giải trình"}</span>
                            <button
                              className="ibtn"
                              style={{ width: 32, height: 32 }}
                              aria-label={`Hoàn tác quyết định ${p.id}`}
                              onClick={() =>
                                setDec((x) => {
                                  const n = { ...x };
                                  delete n[p.id];
                                  return n;
                                })
                              }
                            >
                              <Undo2 size={15} aria-hidden="true" />
                            </button>
                          </span>
                        ) : (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn bp sm" onClick={() => decide(p.id, "ok")} title={p.ok3 ? undefined : "Chứng từ đang lệch — nên kiểm tra trước"}>
                              Xác nhận
                            </button>
                            <button
                              className="btn bs sm"
                              onClick={() => decide(p.id, "no")}
                              title="Yêu cầu nhà cung cấp giải trình hoặc điều chỉnh"
                              aria-label={`Yêu cầu giải trình ${p.id}`}
                            >
                              Hỏi lại
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="card grow-1 stack-sm" style={{ gap: 12 }} aria-label="Đối chiếu chi tiết">
          <span className="muted">Đối chiếu chi tiết</span>
          <h2 className="num" style={{ fontSize: 20, fontWeight: 600 }}>
            {s.id}
          </h2>
          <span style={{ fontSize: 13 }}>
            {s.sup} · <span className="num">{vnd(s.amt)} đ</span>
          </span>
          {s.checks.map(([lv, t, n]) => (
            <div key={t} className="soft" style={{ display: "flex", gap: 10, alignItems: "flex-start", background: lv === "warn" ? "#FFFBF3" : undefined }}>
              {lv === "ok" ? (
                <CircleCheck size={17} color="var(--brand-fill)" style={{ flex: "0 0 auto", marginTop: 1 }} aria-hidden="true" />
              ) : (
                <AlertTriangle size={17} color="var(--warn-strong)" style={{ flex: "0 0 auto", marginTop: 1 }} aria-hidden="true" />
              )}
              <div>
                <strong style={{ fontSize: 13 }}>{t}</strong>
                <div className="muted wrap">{n}</div>
              </div>
            </div>
          ))}
          {!s.ok3 && (
            <p className="t-warn" style={{ fontSize: 13 }}>
              Gợi ý: chọn <strong>Hỏi lại</strong> để nhà cung cấp điều chỉnh hóa đơn hoặc bổ sung nhật ký chuyến.
            </p>
          )}
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", background: "var(--info-bg)", padding: "10px 12px", borderRadius: 10 }}>
            Xác nhận chỉ là khẳng định khoản phải trả là thật và đúng hạn. Nếu nhà cung cấp tài trợ hóa đơn này, bạn thanh toán đúng hạn vào tài
            khoản chuyên thu — không phát sinh nghĩa vụ mới.
          </div>
        </aside>
      </section>

      <section className="card flush">
        <div className="ch">
          <div>
            <h2 className="ct">
              <Term k="earlyPay">Chiết khấu thanh toán sớm</Term>
            </h2>
            <p className="muted">Hóa đơn đã xác nhận · nhà cung cấp đồng ý chiết khấu nếu được thanh toán trước hạn</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <span className="muted">
              Chi:{" "}
              <strong className="num" style={{ color: "var(--ink)" }}>
                {vnd(pay)} đ
              </strong>
            </span>
            <span className="muted">
              Tiết kiệm:{" "}
              <strong className="num" style={{ color: "var(--ok)" }}>
                {vnd(save)} đ
              </strong>
            </span>
            <button
              className="btn bp"
              disabled={approved || pay === 0}
              onClick={() => {
                setApproved(true);
                toast(`Đã duyệt thanh toán sớm ${rows.filter((r) => r.on).length} hóa đơn, tiết kiệm ${vnd(save)} đ.`);
              }}
            >
              {approved ? "Đã duyệt" : "Duyệt thanh toán sớm"}
            </button>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Chọn</th>
                <th>Hóa đơn</th>
                <th>Nhà cung cấp</th>
                <th className="r">Số tiền (đ)</th>
                <th>Hạn gốc</th>
                <th className="r">Trả sớm</th>
                <th className="r">Chiết khấu</th>
                <th className="r">Tiết kiệm (đ)</th>
                <th className="r">
                  <Term k="annualYield">Lợi suất quy năm</Term>
                </th>
                <th>Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const good = e.y > HURDLE;
                return (
                  <tr key={e.id}>
                    <td>
                      <label className="check" style={{ alignItems: "center", minHeight: 32 }}>
                        <input
                          type="checkbox"
                          checked={e.on}
                          disabled={approved}
                          onChange={() => setEarly((x) => ({ ...x, [e.id]: !e.on }))}
                        />
                        <span className="sr-only">Chọn {e.id}</span>
                      </label>
                    </td>
                    <td className="num strong">{e.id}</td>
                    <td>{e.sup}</td>
                    <td className="r num">{vnd(e.amt)}</td>
                    <td className="num">{e.due}</td>
                    <td className="r num">{e.days} ngày</td>
                    <td className="r num">{(e.d * 100).toLocaleString("vi-VN")}%</td>
                    <td className="r num">{vnd(e.sv)}</td>
                    <td className={cx("r num", good ? "t-ok strong" : "t-bad")}>
                      {(e.y * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%
                    </td>
                    <td>
                      <span className={`chip ${good ? "c-ok" : "c-neu"}`}>{good ? "Nên trả sớm" : "Chưa đáng"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ padding: "12px 16px", borderTop: "1px solid var(--line-2)" }}>
          Lợi suất quy năm = chiết khấu ÷ số ngày trả sớm × 365. Đề xuất chọn khi lợi suất vượt chi phí cơ hội tiền mặt 4,5%/năm. Bạn tự chuyển
          tiền cho nhà cung cấp; FCC chỉ ghi nhận thỏa thuận và đối soát.
        </p>
      </section>
    </>
  );
}
