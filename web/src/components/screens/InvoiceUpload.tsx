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
import { DateInput, FileInput, MoneyInput } from "@/components/ui/Fields";
import { matchTaxCode, normalizeTaxCode, taxCodeProblem } from "@fcc/domain/taxcode";

interface Draft {
  series: string;
  number: string;
  issueDate: string;
  buyerTaxCode: string;
  buyerName: string;
  total: number | null;
  description: string;
  lookupCode: string;
  dueDate: string;
  source: "xml" | "ocr" | "manual";
  sellerTaxCode?: string;
  /** Nguồn từng trường: đọc từ chứng từ, hệ thống đề xuất (không có trên chứng từ), hoặc người dùng đã sửa */
  origin: Partial<Record<Field, "doc" | "suggested" | "user">>;
  /** Trường AI tự báo không chắc */
  uncertain: Field[];
}
type Field = "series" | "number" | "issueDate" | "buyerTaxCode" | "total" | "description" | "lookupCode" | "dueDate";
const FIELDS: Field[] = ["series", "number", "issueDate", "buyerTaxCode", "total", "description", "lookupCode", "dueDate"];

const EMPTY: Draft = { series: "", number: "", issueDate: today(), buyerTaxCode: "", buyerName: "", total: null, description: "", lookupCode: "", dueDate: "", source: "manual", origin: {}, uncertain: [] };
const fromDoc = (d: Omit<Draft, "origin" | "uncertain">, uncertain: string[] = []): Draft => ({
  ...d,
  origin: Object.fromEntries(FIELDS.filter((k) => d[k] !== "" && d[k] !== null && k !== "dueDate").map((k) => [k, "doc"])),
  uncertain: FIELDS.filter((k) => uncertain.includes(k)),
});
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
  const match = d ? matchTaxCode(d.buyerTaxCode, d.buyerName, buyers) : { suggestions: [] };
  const buyer = match.exact;
  const taxProblem = d?.buyerTaxCode ? taxCodeProblem(d.buyerTaxCode) : null;
  const set = <K extends Field>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v, origin: { ...x.origin, [k]: "user" }, uncertain: x.uncertain.filter((u) => u !== k) } : x));
  /** Nhãn nguồn của trường để người dùng biết phải đối chiếu gì. */
  const tag = (k: Field) => {
    if (!d || d.source === "manual") return null;
    if (d.uncertain.includes(k)) return <span className="chip c-warn" style={{ marginLeft: 6 }}>AI không chắc</span>;
    const o = d.origin[k];
    return o === "doc" ? <span className="chip c-neu" style={{ marginLeft: 6 }}>{d.source === "xml" ? "Từ XML" : "AI đọc — đối chiếu"}</span> : o === "user" ? <span className="chip c-info" style={{ marginLeft: 6 }}>Bạn đã sửa</span> : null;
  };

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
        // XML hóa đơn không có hạn thanh toán: để trống, người dùng nhập hoặc chọn đề xuất
        setD(fromDoc({ series: p.series, number: p.number, issueDate: p.issueDate, buyerTaxCode: p.buyerTaxCode, buyerName: p.buyerName, total: p.total, description: p.description, lookupCode: p.lookupCode ?? "", dueDate: "", source: "xml", sellerTaxCode: p.sellerTaxCode }));
      } else if (/^image\/|pdf$/.test(f.type)) {
        setReading("AI đang đọc hóa đơn (OCR)… có thể mất 20–60 giây");
        const img = await fileToImage(f);
        let x;
        try {
          x = (await extractInvoice(img.base64)).data;
        } catch (e) {
          throw new Error(`${(e as Error).message} — nhập tay các trường bên dưới.`);
        }
        const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
        const nd = fromDoc({ series: x.series ?? "", number: x.number ?? "", issueDate: iso(x.issueDate), buyerTaxCode: x.buyerTaxCode ?? "", buyerName: x.buyerName ?? "", total: x.total && x.total > 0 ? Math.round(x.total) : null, description: x.description ?? "", lookupCode: x.lookupCode ?? "", dueDate: iso(x.dueDate), source: "ocr", sellerTaxCode: x.sellerTaxCode }, x.uncertain ?? []);
        if (nd.dueDate) nd.origin.dueDate = "doc";
        setD(nd);
      } else throw new Error("Chỉ hỗ trợ XML, PDF hoặc ảnh hóa đơn.");
    } catch (e) {
      setErr((e as Error).message);
      setD((x) => x ?? { ...EMPTY, source: "manual" });
    }
    setReading("");
  };

  const upload = async (f: File, kind: string) => api<{ key: string }>("POST", "/api/files", { name: f.name, mime: f.type || "application/octet-stream", dataBase64: await fileToBase64(f), kind });

  const valid = d && d.series && d.number && /^\d{4}-\d{2}-\d{2}$/.test(d.issueDate) && /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) && d.dueDate > d.issueDate && !!d.total && buyer;
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
        buyerId: buyer.id, invoiceSeries: series, invoiceNumber: d.number.trim(), issueDate: d.issueDate, dueDate: d.dueDate, amount: d.total!,
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
              <span className="chip c-neu">{d.source === "xml" ? "Từ XML hóa đơn điện tử" : d.source === "ocr" ? "OCR/AI · chưa kiểm chứng" : "Nhập tay"}</span>
            </div>
            {d.source === "ocr" && <div className="muted">AI đọc ảnh có thể sai từng chữ số. Mỗi trường có nhãn nguồn: <em>AI đọc — đối chiếu</em>, <em>AI không chắc</em> hoặc <em>Đề xuất</em> (không có trên chứng từ). Đối chiếu với hóa đơn gốc rồi tích xác nhận bên dưới.</div>}
            {d.sellerTaxCode && normalizeTaxCode(d.sellerTaxCode) !== normalizeTaxCode(org.taxCode) && <div className="err" role="alert">MST người bán đọc được ({d.sellerTaxCode}) khác MST tổ chức của bạn ({org.taxCode}). Kiểm tra lại chứng từ.</div>}
            <div className="grid-fields">
              <label className="field"><span>Ký hiệu{tag("series")}</span><input className="input num" value={d.series} onChange={(e) => set("series", e.target.value)} /></label>
              <label className="field"><span>Số hóa đơn{tag("number")}</span><input className="input num" value={d.number} onChange={(e) => set("number", e.target.value)} /></label>
              <DateInput label={<>Ngày lập{tag("issueDate")}</>} value={d.issueDate} max={today()} onChange={(v) => set("issueDate", v)} />
              <div className="stack-sm" style={{ gap: 4 }}>
                <DateInput label={<>Hạn thanh toán{d.origin.dueDate === "suggested" ? null : tag("dueDate")}</>} value={d.dueDate} min={d.issueDate} suggested={d.origin.dueDate === "suggested"} onChange={(v) => set("dueDate", v)} note={d.source === "manual" ? "Theo hợp đồng/điều khoản thanh toán" : "Không có trên chứng từ — nhập theo hợp đồng"} />
                {!d.dueDate && d.issueDate && <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>{[30, 45, 60, 90].map((n) => <button key={n} type="button" className="btn bs sm" onClick={() => setD((x) => (x ? { ...x, dueDate: addDays(x.issueDate, n), origin: { ...x.origin, dueDate: "suggested" } } : x))}>+{n} ngày</button>)}</span>}
              </div>
              <label className="field"><span>MST người mua{tag("buyerTaxCode")}</span>
                <input className={`input num${taxProblem ? " invalid" : ""}`} value={d.buyerTaxCode} aria-invalid={!!taxProblem} aria-describedby="mst-note" onChange={(e) => set("buyerTaxCode", e.target.value)} />
                <span id="mst-note" className={taxProblem ? "field-err" : "field-note"}>{taxProblem ?? (d.buyerName ? `Tên trên chứng từ: ${d.buyerName}` : "10 chữ số (hoặc 10-3)")}</span>
              </label>
              <MoneyInput label={<>Tổng thanh toán (đ){tag("total")}</>} value={d.total} onChange={(v) => set("total", v)} required />
              <label className="field" style={{ gridColumn: "1 / -1" }}><span>Mô tả hàng hóa/dịch vụ{tag("description")}</span><input className="input" value={d.description} onChange={(e) => set("description", e.target.value)} /></label>
              <label className="field"><span>Mã tra cứu của cơ quan thuế (nếu có){tag("lookupCode")}</span><input className="input num" value={d.lookupCode} onChange={(e) => set("lookupCode", e.target.value)} /><span className="field-note">Lưu kèm hóa đơn; chưa tự đối chiếu với cơ quan thuế</span></label>
            </div>
            {buyer ? (
              <div className="okmsg"><CircleCheck size={14} aria-hidden="true" /> Người mua trên FCC: <strong>{buyer.name}</strong></div>
            ) : (
              <div className="err">
                {d.buyerTaxCode ? `Không có người mua nào trên FCC với MST ${d.buyerTaxCode}${d.buyerName ? ` (${d.buyerName})` : ""}.` : "Cần MST người mua."} Chỉ gửi xác nhận được cho người mua đã đăng ký.
                {match.suggestions.length > 0 && (
                  <div className="stack-sm" style={{ marginTop: 6 }}>
                    <span>Có phải một trong các doanh nghiệp sau? Kiểm tra lại trên chứng từ trước khi chọn:</span>
                    {match.suggestions.map((m) => <button key={m.org.id} type="button" className="btn bs sm btn-wrap" style={{ alignSelf: "flex-start" }} onClick={() => set("buyerTaxCode", m.org.taxCode)}>{m.org.name} · MST {m.org.taxCode} — {m.reason}</button>)}
                  </div>
                )}
                {buyers.length > 0 && (
                  <select className="select" style={{ marginTop: 6 }} value="" onChange={(e) => set("buyerTaxCode", buyers.find((b) => b.id === e.target.value)?.taxCode ?? "")}>
                    <option value="">Chọn người mua đã đăng ký…</option>
                    {buyers.map((b) => <option key={b.id} value={b.id}>{b.name} · MST {b.taxCode}</option>)}
                  </select>
                )}
              </div>
            )}
            <div className="grid-fields">
              <FileInput label="Hợp đồng mua bán (tùy chọn)" accept="application/pdf,image/*" fileName={extra.contract?.name} onFile={(f) => setExtra((x) => ({ ...x, contract: f ?? undefined }))} hint="PDF hoặc ảnh · tối đa 15 MB · bổ sung sau cũng được" />
              <FileInput label="Biên bản giao nhận (tùy chọn)" accept="application/pdf,image/*" fileName={extra.delivery?.name} onFile={(f) => setExtra((x) => ({ ...x, delivery: f ?? undefined }))} hint="PDF hoặc ảnh · tối đa 15 MB · bổ sung sau cũng được" />
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
            ["Chứng từ gốc lưu bất biến", "Lưu mã hóa, định danh theo SHA-256; xem lại được ở chi tiết hóa đơn"],
            ["Người mua phải xác nhận", "Chỉ khoản đã được xác nhận mới gửi tài trợ được"],
          ].map(([t, n]) => (
            <div key={t} style={{ display: "flex", gap: 8 }}><CircleCheck size={16} color="var(--brand-fill)" aria-hidden="true" /><span><strong>{t}</strong><br /><span className="muted">{n}</span></span></div>
          ))}
          <div className="muted" style={{ fontSize: 12.5 }}>Chưa bật: đối chiếu tự động với cơ quan thuế và đồng bộ hóa đơn điện tử. Mã tra cứu bạn nhập chỉ được lưu kèm hóa đơn.</div>
        </div>
      </aside>
    </section>
  );
}
