"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Download, RefreshCw, Search, Sparkles, Upload } from "lucide-react";
import { SUPPLIER_INVOICES, STAGES, shortName, type InvoiceStage } from "@/lib/data";
import { cx, vnd } from "@/lib/format";
import { useToast } from "@/components/providers/Toast";
import { AskButton } from "@/components/assistant/Assistant";
import { Term } from "@/components/ui/Term";

const ORDER: ("all" | InvoiceStage)[] = ["all", "draft", "wait", "ver", "elig", "fund", "paid", "over"];

const STEP_LABELS = (due: string, risk: string, issued: string) => [
  ["Phát hành hóa đơn", issued],
  ["Người mua xác nhận", "Xác nhận khoản phải thu"],
  ["AI xác thực", "OCR · chống trùng lặp · MST"],
  ["Đủ điều kiện tài trợ", `Xếp hạng người mua ${risk}`],
  ["Giải ngân", "Mục tiêu T+1/T+2"],
  ["Người mua thanh toán", `Đến hạn ${due}`],
  ["Tất toán", "Hoàn phần còn lại cho doanh nghiệp"],
];

export function InvoiceManager() {
  const toast = useToast();
  const [stage, setStage] = useState<(typeof ORDER)[number]>("all");
  const [q, setQ] = useState("");
  const [esgOnly, setEsgOnly] = useState(false);
  const [sel, setSel] = useState("HD-0418");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return SUPPLIER_INVOICES.filter(
      (d) =>
        (stage === "all" || d.stage === stage) &&
        (!esgOnly || d.esg >= 70) &&
        (!needle || d.id.toLowerCase().includes(needle) || d.buyer.toLowerCase().includes(needle)),
    );
  }, [stage, q, esgOnly]);

  const s = SUPPLIER_INVOICES.find((d) => d.id === sel) ?? SUPPLIER_INVOICES[5];
  const st = STAGES[s.stage];
  const total = list.reduce((a, d) => a + d.amount, 0);
  const steps = STEP_LABELS(s.due, s.risk, s.issued);

  return (
    <>
      <section className="card" style={{ padding: 14 }} aria-label="Vòng đời hóa đơn">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ORDER.map((k) => {
            const on = stage === k;
            const warn = k === "over";
            const count = k === "all" ? SUPPLIER_INVOICES.length : SUPPLIER_INVOICES.filter((d) => d.stage === k).length;
            return (
              <button
                key={k}
                aria-pressed={on}
                onClick={() => setStage(k)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  minHeight: 64,
                  padding: "10px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  flex: "1 1 120px",
                  border: `1px solid ${on ? "var(--forest)" : "var(--line)"}`,
                  background: on ? "var(--forest)" : warn ? "var(--bad-bg)" : "#fff",
                  color: on ? "#fff" : warn ? "var(--bad)" : "var(--ink)",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{k === "all" ? "Tất cả" : STAGES[k].label}</span>
                <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="row top">
        <div className="card flush grow-3">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "16px 16px 12px" }}>
            <label className="search" style={{ flex: "1 1 240px" }}>
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Tìm hóa đơn</span>
              <input type="search" placeholder="Tìm mã hóa đơn, người mua…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <button className="btn bs" aria-pressed={esgOnly} onClick={() => setEsgOnly((v) => !v)} style={esgOnly ? { borderColor: "var(--brand)", background: "var(--surface-3)" } : undefined}>
              {esgOnly && <Check size={15} aria-hidden="true" />}
              ESG người mua ≥ 70
            </button>
            <button className="btn bs" onClick={() => toast(`Đã xuất ${list.length} hóa đơn ra Excel (bản mock).`)}>
              <Download size={16} aria-hidden="true" />
              Xuất Excel
            </button>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Mã hóa đơn</th>
                  <th>Người mua</th>
                  <th className="r">Số tiền (đ)</th>
                  <th>Hạn thanh toán</th>
                  <th>
                    <Term k="riskScore">Xếp hạng</Term> · ESG
                  </th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} className={cx("clickable", d.id === sel && "sel")} onClick={() => setSel(d.id)}>
                    <td>
                      <button className="link-btn num" onClick={() => setSel(d.id)} aria-label={`Xem chi tiết ${d.id}`}>
                        {d.id}
                      </button>
                      {d.ai && (
                        <span className="chip c-ai" style={{ height: 20, fontSize: 11, display: "flex", width: "fit-content" }}>
                          AI ưu tiên
                        </span>
                      )}
                    </td>
                    <td className="wrap" title={d.buyer} style={{ minWidth: 150 }}>
                      {shortName(d.buyer)}
                    </td>
                    <td className="r num">{vnd(d.amount)}</td>
                    <td>
                      <div className="num">{d.due}</div>
                      <div className={cx("muted", d.stage === "over" && "t-bad strong")}>
                        {d.daysLeft === null ? "đã thanh toán" : d.daysLeft < 0 ? `quá hạn ${-d.daysLeft} ngày` : `còn ${d.daysLeft} ngày`}
                      </div>
                    </td>
                    <td className="num">
                      {d.risk} · {d.esg}
                    </td>
                    <td>
                      <span className={`chip ${STAGES[d.stage].chip}`}>{STAGES[d.stage].short}</span>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 32 }} className="muted">
                      Không có hóa đơn phù hợp. Thử bỏ bớt bộ lọc nhé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card-foot muted">
            <span>
              Hiển thị {list.length} / {SUPPLIER_INVOICES.length} hóa đơn
            </span>
            <span>
              Tổng giá trị:{" "}
              <strong className="num" style={{ color: "var(--ink)" }}>
                {vnd(total)} đ
              </strong>
            </span>
          </div>
        </div>

        <aside className="stack grow-1" aria-label="Chi tiết hóa đơn">
          <div className="card stack-sm" style={{ gap: 14 }}>
            <div className="between" style={{ alignItems: "flex-start" }}>
              <div>
                <span className="muted">Chi tiết hóa đơn</span>
                <h2 className="num" style={{ fontSize: 20, fontWeight: 600 }}>
                  {s.id}
                </h2>
              </div>
              <span className={`chip ${st.chip}`}>{s.stage === "over" ? "Quá hạn 7 ngày" : st.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 12px", fontSize: 13 }}>
              <div>
                <div className="muted">Người mua</div>
                <div className="strong wrap">{s.buyer}</div>
              </div>
              <div>
                <div className="muted">Số tiền</div>
                <div className="num strong">{vnd(s.amount)} đ</div>
              </div>
              <div>
                <div className="muted">Hạn thanh toán</div>
                <div className="num">{s.due}</div>
              </div>
              <div>
                <div className="muted">Rủi ro người mua</div>
                <div className="num">
                  {s.risk} · ESG {s.esg}
                </div>
              </div>
            </div>

            <ol className="tl" style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Tiến trình hóa đơn">
              {steps.map(([label, note], i) => {
                const done = i < st.done;
                const cur = i === st.done && s.stage !== "paid";
                const bad = s.stage === "over" && cur;
                const c = bad ? "var(--bad-strong)" : done ? "var(--brand-fill)" : cur ? "var(--warn-strong)" : "var(--line-strong)";
                return (
                  <li key={label} className="tl-item">
                    <div className="tl-rail">
                      <span className="tl-dot" style={{ borderColor: c, background: done ? c : "#fff" }} />
                      <span className="tl-line" style={{ background: i === steps.length - 1 ? "transparent" : done ? "var(--brand-fill)" : "var(--line)" }} />
                    </div>
                    <div className="tl-body">
                      <span style={{ fontSize: 13, fontWeight: 600, color: done || cur ? "var(--ink)" : "var(--ink-3)" }}>
                        {label}
                        {cur && <span className="sr-only"> (bước hiện tại)</span>}
                      </span>
                      <span className="muted">{bad ? "Bên mua chậm thanh toán · đã gửi nhắc nợ" : note}</span>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="soft stack-sm" style={{ gap: 6, fontSize: 12.5 }}>
              <strong style={{ fontSize: 13 }}>Kiểm tra chống gian lận</strong>
              {["Không trùng lặp trên toàn hệ thống", "Hóa đơn điện tử hợp lệ, chưa hủy", "Khớp hợp đồng mua bán & MST người mua"].map((t) => (
                <span key={t} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Check size={15} color="var(--brand-fill)" aria-hidden="true" />
                  {t}
                </span>
              ))}
            </div>

            {s.stage === "elig" && (
              <div className="stack-sm" style={{ gap: 8 }}>
                <div className="line-item">
                  <span>Có thể nhận trước (80%)</span>
                  <strong className="num">{vnd(s.amount * 0.8)} đ</strong>
                </div>
                <Link className="btn bp" href="/supplier/funding">
                  Yêu cầu tài trợ hóa đơn này
                </Link>
              </div>
            )}
            {s.stage === "draft" && (
              <Link className="btn bp" href="/supplier/invoices/upload">
                Hoàn tất & gửi người mua xác nhận
              </Link>
            )}
            {s.stage === "wait" && (
              <button className="btn bs" onClick={() => toast(`Đã gửi lại lời nhắc xác nhận ${s.id} cho người mua.`)}>
                Nhắc người mua xác nhận
              </button>
            )}
            {s.stage === "over" && (
              <button className="btn bs" onClick={() => toast(`Đã gửi thông báo nhắc nợ lần 2 cho ${s.buyer}.`)}>
                Gửi nhắc nợ lần 2
              </button>
            )}
          </div>
          <div className="dark stack-sm">
            <span className="d-title">
              <Sparkles size={18} color="#DDF1C4" aria-hidden="true" />
              Vì sao AI ưu tiên?
            </span>
            <p>
              Ba hóa đơn có người mua xếp hạng A–B, đã được xác nhận và còn ≥ 50 ngày đến hạn. Tài trợ HD-0412 đủ bù thiếu hụt 420 tr ngày
              28/10 với chi phí thấp nhất.
            </p>
            <AskButton className="btn bl" question="Nên tài trợ hóa đơn nào?">
              Hỏi thêm trợ lý
            </AskButton>
          </div>
        </aside>
      </section>
    </>
  );
}

export function InvoiceHeaderActions() {
  const toast = useToast();
  return (
    <>
      <button className="btn bs" onClick={() => toast("Đã đồng bộ ERP: 0 hóa đơn mới (bản mock).")}>
        <RefreshCw size={16} aria-hidden="true" />
        Đồng bộ ERP
      </button>
      <Link className="btn bp" href="/supplier/invoices/upload">
        <Upload size={16} aria-hidden="true" />
        Tải hóa đơn
      </Link>
    </>
  );
}
