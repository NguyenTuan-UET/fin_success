"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CircleCheck, CloudUpload, FileStack, PlugZap, RefreshCw } from "lucide-react";
import { useToast } from "@/components/providers/Toast";
import { Term } from "@/components/ui/Term";

type QueueItem = { name: string; progress: number };

const FIELDS: { label: string; value: string; conf: number; wide?: boolean; strong?: boolean; mono?: boolean }[] = [
  { label: "Số hóa đơn", value: "00000418", conf: 99, mono: true },
  { label: "Ký hiệu", value: "1C26TSM", conf: 99, mono: true },
  { label: "Ngày lập", value: "15/10/2026", conf: 98, mono: true },
  { label: "MST người mua", value: "0101•••567", conf: 97, mono: true },
  { label: "Người mua", value: "CTCP Xây dựng Đông Á", conf: 97, wide: true },
  { label: "Tiền hàng trước thuế", value: "1.818.181.818", conf: 99, mono: true },
  { label: "Thuế GTGT 10%", value: "181.818.182", conf: 99, mono: true },
  { label: "Tổng thanh toán (đ)", value: "2.000.000.000", conf: 99, mono: true, strong: true },
];

const CHECKS = [
  ["Không trùng lặp", "Đối chiếu toàn hệ thống và các tổ chức tài chính"],
  ["Hóa đơn chưa bị hủy", "Tra cứu trạng thái trên hệ thống thuế"],
  ["MST hai bên hợp lệ", "Doanh nghiệp đang hoạt động"],
  ["Chữ ký số người bán", "Hợp lệ, còn hiệu lực"],
  ["Khớp hợp đồng", "Giá trị nằm trong hạn mức HĐMB 2026/017"],
];

export function InvoiceUpload() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([
    { name: "HD-0419.xml", progress: 100 },
    { name: "HD-0420.pdf", progress: 100 },
    { name: "scan_0921.jpg", progress: 64 },
  ]);
  const [due, setDue] = useState("13/01/2027");
  const [dueChecked, setDueChecked] = useState(false);
  const [attach, setAttach] = useState(true);
  const [sent, setSent] = useState(false);

  // Mô phỏng OCR chạy dần cho các tệp trong hàng đợi.
  const running = queue.some((q) => q.progress < 100);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setQueue((qs) => qs.map((q) => (q.progress < 100 ? { ...q, progress: Math.min(100, q.progress + 9) } : q)));
    }, 380);
    return () => clearInterval(t);
  }, [running]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const names = Array.from(files).slice(0, 20).map((f) => f.name);
    setQueue((qs) => [...names.map((name) => ({ name, progress: 4 })), ...qs]);
    toast(`Đã nhận ${names.length} tệp. OCR/AI đang đọc dữ liệu…`);
  };

  const canSend = dueChecked && !sent;

  return (
    <>
      <section
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 16 }}
        aria-label="Nguồn hóa đơn"
      >
        <div
          className="card stack-sm"
          style={{
            border: `2px dashed ${drag ? "var(--brand)" : "#8FB8A6"}`,
            background: drag ? "var(--surface-3)" : "#F6FAF8",
            alignItems: "flex-start",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <span className="todo-ic" style={{ background: "var(--ok-bg)", color: "var(--brand)" }}>
            <CloudUpload size={20} aria-hidden="true" />
          </span>
          <strong>{drag ? "Thả tệp để tải lên" : "Kéo thả tệp vào đây"}</strong>
          <span className="muted">XML hóa đơn điện tử, PDF hoặc ảnh chụp · tối đa 20 tệp, 10 MB/tệp</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".xml,.pdf,image/*"
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button className="btn bp sm" onClick={() => fileRef.current?.click()}>
            Chọn tệp
          </button>
        </div>
        <div className="card stack-sm" style={{ alignItems: "flex-start" }}>
          <span className="todo-ic" style={{ background: "var(--info-bg)", color: "var(--info)" }}>
            <RefreshCw size={20} aria-hidden="true" />
          </span>
          <strong>Đồng bộ hóa đơn điện tử</strong>
          <span className="muted">Lấy tự động qua API nhà cung cấp hóa đơn điện tử · lần cuối 23:40</span>
          <span className="chip c-ok">Đã kết nối · 4 hóa đơn mới</span>
        </div>
        <div className="card stack-sm" style={{ alignItems: "flex-start" }}>
          <span className="todo-ic" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
            <PlugZap size={20} aria-hidden="true" />
          </span>
          <strong>Kết nối ERP / kế toán</strong>
          <span className="muted">MISA, SAP, Odoo và phần mềm kế toán nội bộ · chỉ đọc</span>
          <Link className="btn bs sm" href="/supplier/settings">
            Thiết lập tích hợp
          </Link>
        </div>
      </section>

      <section className="row top">
        <div className="card grow-1" style={{ background: "var(--surface-2)", flexBasis: 420 }}>
          <div className="ch">
            <h2 className="ct">Bản xem trước · HD-0418.xml</h2>
            <span className="chip c-info">
              <Term k="ocr">OCR</Term> hoàn tất · 2,4 giây
            </span>
          </div>
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "28px 28px 36px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
            aria-label="Mô phỏng hóa đơn với các vùng đã nhận dạng"
          >
            <div className="between" style={{ flexWrap: "wrap" }}>
              <div className="stack-sm" style={{ gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em" }}>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</span>
                <span style={{ height: 7, width: 160, borderRadius: 4, background: "#E6ECE8" }} />
              </div>
              <div className="num" style={{ outline: "2px solid var(--info-strong)", outlineOffset: 3, borderRadius: 4, padding: "2px 6px", fontSize: 12 }}>
                Ký hiệu 1C26TSM · Số 00000418
              </div>
            </div>
            {[
              ["Đơn vị bán:", "Công ty TNHH Vật liệu Sao Mai", "70%"],
              ["Người mua:", "CTCP Xây dựng Đông Á", "60%"],
            ].map(([k, v, w]) => (
              <div
                key={k}
                style={{ outline: "2px solid var(--info-strong)", outlineOffset: 3, borderRadius: 4, padding: "4px 6px", display: "flex", flexDirection: "column", gap: 6 }}
              >
                <span style={{ fontSize: 12 }}>
                  <strong>{k}</strong> {v}
                </span>
                <span style={{ height: 7, width: w, borderRadius: 4, background: "#E6ECE8" }} />
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0", borderTop: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)" }}>
              {["100%", "92%", "96%", "80%"].map((w) => (
                <span key={w} style={{ height: 7, width: w, borderRadius: 4, background: "var(--bg)" }} />
              ))}
            </div>
            <div className="num" style={{ alignSelf: "flex-end", outline: "2px solid var(--warn-strong)", outlineOffset: 3, borderRadius: 4, padding: "2px 6px", fontSize: 12 }}>
              Tổng thanh toán: 2.000.000.000
            </div>
            <div style={{ outline: "2px dashed var(--warn-strong)", outlineOffset: 3, borderRadius: 4, padding: "2px 6px", fontSize: 12, alignSelf: "flex-start" }}>
              Thời hạn thanh toán: 90 ngày
            </div>
          </div>
          <div className="legend muted">
            <span>
              <span className="swatch" style={{ border: "2px solid var(--info-strong)" }} />
              Độ tin cậy ≥ 95%
            </span>
            <span>
              <span className="swatch" style={{ border: "2px dashed var(--warn-strong)" }} />
              Cần kiểm tra
            </span>
          </div>
        </div>

        <div className="card grow-1 stack" style={{ flexBasis: 420, gap: 14 }}>
          <div className="ch" style={{ margin: 0 }}>
            <h2 className="ct">Dữ liệu trích xuất</h2>
            <span className="muted">Sửa trực tiếp nếu cần</span>
          </div>
          <div className="grid-fields">
            {FIELDS.map((f) => (
              <label key={f.label} className="field" style={f.wide ? { gridColumn: "1 / -1" } : undefined}>
                <span className="field-label">
                  {f.label}
                  <span className="num t-ok">{f.conf}%</span>
                </span>
                <input className={`input${f.mono ? " num" : ""}`} defaultValue={f.value} style={f.strong ? { fontWeight: 600 } : undefined} />
              </label>
            ))}
            <label className="field">
              <span className="field-label" style={{ color: dueChecked ? "var(--ink-2)" : "var(--warn)" }}>
                Hạn thanh toán
                <span className="num">{dueChecked ? "đã kiểm tra" : "72% · cần kiểm tra"}</span>
              </span>
              <input
                className={`input num${dueChecked ? "" : " attention"}`}
                value={due}
                onChange={(e) => {
                  setDue(e.target.value);
                  setDueChecked(true);
                }}
                aria-describedby="due-hint"
              />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="field-label">Hợp đồng mua bán liên kết</span>
              <input className="input" defaultValue="HĐMB 2026/017 · Cung cấp thép & vật liệu dự án khu B" />
            </label>
          </div>
          <div id="due-hint" style={{ fontSize: 12.5, color: "var(--warn)", background: "var(--warn-bg)", padding: "10px 12px", borderRadius: 10 }} className="stack-sm">
            <span>
              Hạn thanh toán không in trên hóa đơn; AI suy ra từ điều khoản “90 ngày kể từ ngày lập” trong hợp đồng 2026/017.
            </span>
            <label className="check" style={{ color: "var(--ink)" }}>
              <input type="checkbox" checked={dueChecked} onChange={(e) => setDueChecked(e.target.checked)} />
              Tôi đã kiểm tra, hạn thanh toán {due} là đúng
            </label>
          </div>
        </div>
      </section>

      <section className="row top">
        <div className="card grow-2">
          <div className="ch">
            <h2 className="ct">Kiểm tra xác thực & chống gian lận</h2>
            <span className="chip c-warn">5/6 đạt · 1 cần chú ý</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 10 }}>
            {CHECKS.map(([t, n]) => (
              <div key={t} style={{ display: "flex", gap: 10, padding: 12, border: "1px solid var(--line-2)", borderRadius: 10 }}>
                <CircleCheck size={18} color="var(--brand-fill)" style={{ flex: "0 0 auto" }} aria-hidden="true" />
                <div>
                  <strong style={{ fontSize: 13 }}>{t}</strong>
                  <div className="muted">{n}</div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, padding: 12, border: "1px solid #F0D3A6", background: "#FFFBF3", borderRadius: 10 }}>
              <AlertTriangle size={18} color="var(--warn-strong)" style={{ flex: "0 0 auto" }} aria-hidden="true" />
              <div>
                <strong style={{ fontSize: 13 }}>Giá trị bất thường</strong>
                <div className="muted t-warn">Cao gấp 2,1 lần trung bình 3 tháng với người mua này · nên đính kèm biên bản giao hàng</div>
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Cờ cảnh báo là để người xem xét, không phải kết luận gian lận.
          </p>
        </div>

        <div className="card grow-1 stack-sm" style={{ gap: 12 }}>
          <h2 className="ct">Bước tiếp theo</h2>
          {sent ? (
            <>
              <div className="soft" style={{ display: "flex", gap: 10, background: "var(--ok-bg)", color: "var(--ok)" }}>
                <CircleCheck size={20} style={{ flex: "0 0 auto" }} aria-hidden="true" />
                <span>
                  <strong>Đã gửi tới Xây dựng Đông Á.</strong> Bạn sẽ nhận thông báo khi người mua xác nhận (thường trong 1 ngày làm việc).
                </span>
              </div>
              <Link className="btn bp" href="/supplier/invoices">
                Về danh sách hóa đơn
              </Link>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
                Gửi yêu cầu xác nhận khoản phải thu tới người mua. Sau khi người mua xác nhận, hóa đơn có thể dùng để nhận tiền sớm.
              </p>
              <label className="check">
                <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
                Đính kèm biên bản giao hàng (BBGH-0418.pdf)
              </label>
              <button
                className="btn bp"
                disabled={!canSend}
                onClick={() => {
                  setSent(true);
                  toast("Đã gửi HD-0418 cho người mua xác nhận.");
                }}
              >
                Gửi người mua xác nhận
              </button>
              {!dueChecked && <span className="muted t-warn">Vui lòng kiểm tra hạn thanh toán trước khi gửi.</span>}
              <button className="btn bs" onClick={() => toast("Đã lưu nháp HD-0418.")}>
                Lưu nháp
              </button>
            </>
          )}
          <div className="divider stack-sm" style={{ gap: 8 }}>
            <span className="muted strong" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FileStack size={15} aria-hidden="true" />
              Hàng đợi xử lý
            </span>
            {queue.slice(0, 6).map((q) => (
              <div key={q.name} className="between" style={{ fontSize: 13 }}>
                <span className="num" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.name}
                </span>
                {q.progress >= 100 ? (
                  <span className="chip c-ok">Xong</span>
                ) : (
                  <span className="bar" style={{ flex: "1 1 60px", maxWidth: 120 }} role="progressbar" aria-valuenow={q.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Đang xử lý ${q.name}`}>
                    <span className="fill" style={{ width: `${q.progress}%` }} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
