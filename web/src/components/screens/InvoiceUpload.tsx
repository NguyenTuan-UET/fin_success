"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CircleCheck, CloudUpload } from "lucide-react";
import { api, fileToBase64 } from "@/lib/api";
import { today } from "@/lib/format";
import { useData } from "@/lib/session";
import { parseEInvoiceXml, invoiceFingerprint } from "@/lib/einvoice";
import { extractInvoice, fileToImage } from "@/lib/ai";
import { useToast } from "@/components/providers/Toast";

interface Draft {
  series: string;
  number: string;
  issueDate: string;
  buyerTaxCode: string;
  buyerName: string;
  total: string;
  description: string;
  lookupCode: string;
  dueDate: string;
  source: "xml" | "ocr" | "manual";
  /** OCR: người dùng phải đối chiếu từng trường trước khi lưu (SPEC F03) */
  confidence?: number;
}

const EMPTY: Draft = { series: "", number: "", issueDate: today(), buyerTaxCode: "", buyerName: "", total: "", description: "", lookupCode: "", dueDate: "", source: "manual" };
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export function InvoiceUpload() {
  const { data, org, act } = useData();
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [d, setD] = useState<Draft | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [extra, setExtra] = useState<{ contract?: File; delivery?: File }>({});
  const [reading, setReading] = useState("");
  const [err, setErr] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [sendNow, setSendNow] = useState(true);
  const [busy, setBusy] = useState(false);

  const buyers = data.orgs.filter((o) => o.type === "buyer");
  const buyer = buyers.find((b) => b.taxCode === d?.buyerTaxCode.replace(/[\s.]/g, ""));
  const set = (k: keyof Draft, v: string) => setD((x) => (x ? { ...x, [k]: v } : x));

  const read = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setErr("");
    setConfirmed(false);
    setFiles([f]);
    try {
      if (/\.xml$/i.test(f.name) || f.type.includes("xml")) {
        setReading("Đang đọc XML hóa đơn điện tử…");
        const p = parseEInvoiceXml(await f.text());
        if (p.sellerTaxCode && p.sellerTaxCode !== org.taxCode) throw new Error(`MST người bán trên hóa đơn (${p.sellerTaxCode}) không khớp MST tổ chức (${org.taxCode}).`);
        setD({ series: p.series, number: p.number, issueDate: p.issueDate, buyerTaxCode: p.buyerTaxCode, buyerName: p.buyerName, total: String(p.total), description: p.description, lookupCode: p.lookupCode ?? "", dueDate: addDays(p.issueDate, 60), source: "xml" });
      } else if (/^image\/|pdf$/.test(f.type)) {
        setReading("AI đang đọc hóa đơn (OCR)… có thể mất 20–60 giây");
        const img = await fileToImage(f);
        let x;
        try {
          x = (await extractInvoice(img.base64)).data;
        } catch (e) {
          throw new Error(`${(e as Error).message} — nhập tay các trường bên dưới.`);
        }
        setD({ series: x.series ?? "", number: x.number ?? "", issueDate: x.issueDate ?? today(), buyerTaxCode: x.buyerTaxCode ?? "", buyerName: x.buyerName ?? "", total: x.total ? String(Math.round(x.total)) : "", description: x.description ?? "", lookupCode: x.lookupCode ?? "", dueDate: addDays(x.issueDate ?? today(), 60), source: "ocr", confidence: x.confidence });
      } else throw new Error("Chỉ hỗ trợ XML, PDF hoặc ảnh hóa đơn.");
    } catch (e) {
      setErr((e as Error).message);
      setD((x) => x ?? { ...EMPTY, source: "manual" });
    }
    setReading("");
  };

  const upload = async (f: File, kind: string) => api<{ key: string }>("POST", "/api/files", { name: f.name, mime: f.type || "application/octet-stream", dataBase64: await fileToBase64(f), kind });

  const valid = d && d.series && d.number && /^\d{4}-\d{2}-\d{2}$/.test(d.issueDate) && /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) && Number(d.total) > 0 && buyer;
  const submit = async () => {
    if (!d || !buyer) return;
    setBusy(true);
    setErr("");
    try {
      const uploaded: { key: string; name: string; kind: "invoice" | "contract" | "delivery" }[] = [];
      for (const f of files) uploaded.push({ ...(await upload(f, "invoice")), name: f.name, kind: "invoice" });
      if (extra.contract) uploaded.push({ ...(await upload(extra.contract, "contract")), name: extra.contract.name, kind: "contract" });
      if (extra.delivery) uploaded.push({ ...(await upload(extra.delivery, "delivery")), name: extra.delivery.name, kind: "delivery" });
      const series = d.series.trim();
      const fingerprint = await invoiceFingerprint({ sellerTaxCode: org.taxCode, series, number: d.number.trim(), issueDate: d.issueDate, lookupCode: d.lookupCode || undefined });
      const r = await act<{ result: { id: string; code: string } }>("POST", "/v1/receivables", {
        buyerId: buyer.id, invoiceSeries: series, invoiceNumber: d.number.trim(), issueDate: d.issueDate, dueDate: d.dueDate, amount: Math.round(Number(d.total)),
        description: d.description, fingerprint, source: d.source, files: uploaded, docs: { xml: d.source === "xml", contract: !!extra.contract, delivery: !!extra.delivery },
      });
      if (sendNow) await act("POST", `/v1/receivables/${r.result.id}/buyer-invitation`);
      toast(sendNow ? `Đã tạo ${r.result.code} và gửi ${buyer.shortName} xác nhận.` : `Đã lưu ${r.result.code} ở trạng thái nháp.`);
      router.push("/supplier/invoices");
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <section className="row top">
      <div className="stack grow-2">
        <div
          className="card"
          style={{ borderStyle: "dashed", borderWidth: 2, borderColor: drag ? "var(--brand-fill)" : "var(--line-strong)", textAlign: "center", padding: 28 }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void read(e.dataTransfer.files); }}
        >
          <CloudUpload size={32} aria-hidden="true" />
          <h2 className="ct">Kéo thả hóa đơn vào đây</h2>
          <p className="sub">XML hóa đơn điện tử (đọc trực tiếp, chính xác nhất), ảnh hoặc PDF (AI OCR — cần đối chiếu).</p>
          <input ref={fileRef} type="file" accept=".xml,application/xml,text/xml,application/pdf,image/*" hidden onChange={(e) => void read(e.target.files)} />
          <button className="btn bp" onClick={() => fileRef.current?.click()} disabled={!!reading}>Chọn tệp</button>
          <div className="muted" style={{ marginTop: 8 }}>Hoặc <button className="link-btn" onClick={() => setD({ ...EMPTY })}>nhập tay</button></div>
          {reading && <div className="muted" role="status" style={{ marginTop: 10 }}>{reading}</div>}
        </div>

        {err && <div className="err" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {err}</div>}

        {d && (
          <div className="card stack">
            <div className="between">
              <h2 className="ct">Thông tin hóa đơn</h2>
              <span className="chip c-neu">{d.source === "xml" ? "Từ XML" : d.source === "ocr" ? `OCR/AI${d.confidence ? ` · tin cậy ${Math.round(d.confidence * 100)}%` : ""}` : "Nhập tay"}</span>
            </div>
            {d.source === "ocr" && <div className="muted">Dữ liệu do AI đọc có thể sai. Đối chiếu từng trường với hóa đơn gốc rồi tích xác nhận bên dưới — hệ thống không coi OCR là đã xác minh.</div>}
            <div className="grid-fields">
              <label className="field"><span>Ký hiệu</span><input className="input num" value={d.series} onChange={(e) => set("series", e.target.value)} /></label>
              <label className="field"><span>Số hóa đơn</span><input className="input num" value={d.number} onChange={(e) => set("number", e.target.value)} /></label>
              <label className="field"><span>Ngày lập</span><input className="input num" type="date" value={d.issueDate} onChange={(e) => set("issueDate", e.target.value)} /></label>
              <label className="field"><span>Hạn thanh toán</span><input className="input num" type="date" value={d.dueDate} min={d.issueDate} onChange={(e) => set("dueDate", e.target.value)} /></label>
              <label className="field"><span>MST người mua</span><input className="input num" value={d.buyerTaxCode} onChange={(e) => set("buyerTaxCode", e.target.value)} /></label>
              <label className="field"><span>Tổng thanh toán (đ)</span><input className="input num" inputMode="numeric" value={d.total} onChange={(e) => set("total", e.target.value.replace(/\D/g, ""))} /></label>
              <label className="field" style={{ gridColumn: "1 / -1" }}><span>Mô tả hàng hóa/dịch vụ</span><input className="input" value={d.description} onChange={(e) => set("description", e.target.value)} /></label>
              <label className="field"><span>Mã cơ quan thuế (nếu có)</span><input className="input num" value={d.lookupCode} onChange={(e) => set("lookupCode", e.target.value)} /></label>
            </div>
            {buyer ? (
              <div className="okmsg"><CircleCheck size={14} aria-hidden="true" /> Người mua trên FCC: <strong>{buyer.name}</strong></div>
            ) : (
              <div className="err">
                {d.buyerTaxCode ? `MST ${d.buyerTaxCode}${d.buyerName ? ` (${d.buyerName})` : ""} chưa đăng ký trên FCC.` : "Cần MST người mua."} Chỉ gửi xác nhận được cho người mua đã đăng ký.
                {buyers.length > 0 && (
                  <select className="select" style={{ marginTop: 6 }} value="" onChange={(e) => set("buyerTaxCode", buyers.find((b) => b.id === e.target.value)?.taxCode ?? "")}>
                    <option value="">Chọn người mua đã đăng ký…</option>
                    {buyers.map((b) => <option key={b.id} value={b.id}>{b.name} · MST {b.taxCode}</option>)}
                  </select>
                )}
              </div>
            )}
            <div className="grid-fields">
              <label className="field"><span>Hợp đồng mua bán (tùy chọn)</span><input type="file" onChange={(e) => setExtra((x) => ({ ...x, contract: e.target.files?.[0] }))} /></label>
              <label className="field"><span>Chứng từ giao nhận (tùy chọn)</span><input type="file" onChange={(e) => setExtra((x) => ({ ...x, delivery: e.target.files?.[0] }))} /></label>
            </div>
            {d.source === "ocr" && (
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Tôi đã đối chiếu các trường trên với hóa đơn gốc</label>
            )}
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} /> Gửi người mua xác nhận ngay</label>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <Link className="btn bs" href="/supplier/invoices">Hủy</Link>
              <button className="btn bp" disabled={!valid || busy || (d.source === "ocr" && !confirmed)} onClick={submit}>{busy ? "Đang lưu…" : "Lưu khoản phải thu"}</button>
            </div>
          </div>
        )}
      </div>

      <aside className="stack grow-1">
        <div className="card stack-sm">
          <h2 className="ct">Kiểm tra trước khi gửi</h2>
          {[
            ["Không trùng lặp", "Máy chủ chặn cùng MST bán + ký hiệu + số + ngày"],
            ["Chứng từ gốc lưu bất biến", "Mã hóa AES-256, định danh theo SHA-256"],
            ["Người mua phải xác nhận", "Chỉ khoản đã được xác nhận mới gửi tài trợ được"],
          ].map(([t, n]) => (
            <div key={t} style={{ display: "flex", gap: 8 }}><CircleCheck size={16} color="var(--brand-fill)" aria-hidden="true" /><span><strong>{t}</strong><br /><span className="muted">{n}</span></span></div>
          ))}
          <div className="muted" style={{ fontSize: 12.5 }}>Đối chiếu với cơ quan thuế và đồng bộ hóa đơn điện tử tự động (MST, mã tra cứu) thuộc gói WP5 — hiện nhập mã tra cứu để lưu kèm hóa đơn.</div>
        </div>
      </aside>
    </section>
  );
}
