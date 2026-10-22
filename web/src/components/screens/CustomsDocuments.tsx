"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { CUSTOMS_DOC_KINDS, type CustomsDocKind, type Receivable } from "@fcc/domain/types";
import { customsGateCheck, kindAllowedFor, CUSTOMS_GATE } from "@fcc/domain/customs";
import { api, fileToBase64 } from "@/lib/api";
import { date, dateTime } from "@/lib/format";
import { useData } from "@/lib/session";
import { useToast } from "@/components/providers/Toast";
import { FileInput } from "@/components/ui/Fields";

const OPEN_STATES = ["DRAFT", "BUYER_PENDING", "BUYER_DISPUTED", "BUYER_CONFIRMED", "SUBMITTED", "UNDER_REVIEW", "OFFERED", "ACCEPTED", "FUNDED", "OVERDUE"];
const KINDS = Object.keys(CUSTOMS_DOC_KINDS) as CustomsDocKind[];

/** Còn thiếu gì để gửi yêu cầu tài trợ theo cổng hải quan hiện hành (dùng ở màn hóa đơn và marketplace). */
export const customsGate = (r: Receivable) => customsGateCheck(r, CUSTOMS_GATE);
export const missingCustoms = (r: Receivable) => { const g = customsGate(r); return g.missing.length + g.warnings.length > 0; };

type Form = { declarationNo: string; declarationDate: string; clearance: string; channel: string; transportMode: string; transportDocNo: string; exporterTaxCode: string; shipmentDate: string; portOfLoading: string; portOfDischarge: string; incoterms: string };
const blank: Form = { declarationNo: "", declarationDate: "", clearance: "", channel: "", transportMode: "", transportDocNo: "", exporterTaxCode: "", shipmentDate: "", portOfLoading: "", portOfDischarge: "", incoterms: "" };

/**
 * Chứng từ hải quan của khoản phải thu: chứng từ hai phía (xuất/nhập), thông tin tờ khai, và (đơn vị xuất khẩu / bên nhập khẩu của khoản)
 * tải thêm chứng từ. Chỉ thêm, không gỡ. FCC không tự khẳng định đã đối chiếu tờ khai với cơ quan hải quan.
 */
export function CustomsDocuments({ r }: { r: Receivable }) {
  const { act, org } = useData();
  const toast = useToast();
  const side: "export" | "import" | null = org.id === r.sellerId ? "export" : org.id === r.buyerId ? "import" : null;
  const reason = !side ? "" : side === "import" && r.state === "DRAFT" ? "Hóa đơn chưa gửi cho bên nhập khẩu" : !OPEN_STATES.includes(r.state) ? "Khoản đã đóng, không thêm được chứng từ" : "";
  const canAttach = !!side && !reason;
  const [kind, setKind] = useState<CustomsDocKind>(side === "import" ? "customs_import_declaration" : "customs_export_declaration");
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const files = r.files ?? [];
  const mine = KINDS.filter((k) => side && kindAllowedFor(k, side));
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const open = async (key: string) => {
    try { window.open((await api<{ url: string }>("GET", `/api/files/${key}/url`)).url, "_blank", "noopener"); } catch (e) { toast((e as Error).message); }
  };
  const send = async (body: { files?: unknown[]; info?: Record<string, string> }, ok: string) => {
    setBusy(true);
    try { await act("POST", `/v1/receivables/${r.id}/customs-documents`, body); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const upload = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      const stored = await api<{ key: string }>("POST", "/api/files", { name: f.name, mime: f.type || "application/octet-stream", dataBase64: await fileToBase64(f), kind: "customs" });
      await act("POST", `/v1/receivables/${r.id}/customs-documents`, { files: [{ key: stored.key, name: f.name, kind }] });
      toast(`Đã bổ sung ${f.name}`);
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const saveInfo = () => {
    const info = Object.fromEntries(Object.entries(form).filter(([k, v]) => v && (side === "export" || ["declarationNo", "declarationDate", "clearance", "channel"].includes(k))));
    if (!Object.keys(info).length) return toast("Chưa nhập thông tin tờ khai");
    void send({ info }, "Đã lưu thông tin tờ khai");
  };

  const info = r.customsInfo;
  const gate = customsGate(r);
  return (
    <div className="stack-sm" aria-label="Chứng từ hải quan">
      <strong style={{ fontSize: 13 }}>Chứng từ hải quan</strong>
      {(["export", "import"] as const).map((sd) => {
        const list = files.filter((f) => f.kind in CUSTOMS_DOC_KINDS && (sd === "export" ? f.by === r.sellerId : f.by === r.buyerId));
        const i = info?.[sd];
        return (
          <div key={sd} className="soft stack-sm" style={{ gap: 6 }}>
            <div className="between"><span style={{ fontSize: 13, fontWeight: 600 }}>{sd === "export" ? "Phía đơn vị xuất khẩu" : "Phía bên nhập khẩu"}</span><span className={`chip ${list.length ? "c-info" : "c-warn"}`}>{list.length ? `${list.length} tệp` : "Chưa có"}</span></div>
            {i && (i.declarationNo || i.clearance) && (
              <div className="muted" style={{ fontSize: 12.5 }}>
                Tờ khai {i.declarationNo ?? "—"}{i.declarationDate ? ` · ${date(i.declarationDate)}` : ""}{i.clearance ? ` · ${i.clearance === "cleared" ? "đã thông quan" : "chờ thông quan"}` : ""}{i.channel ? ` · luồng ${{ green: "xanh", yellow: "vàng", red: "đỏ" }[i.channel]}` : ""}
                {sd === "export" && info?.export?.transportDocNo ? ` · vận đơn ${info.export.transportDocNo}` : ""}{sd === "export" && info?.export?.incoterms ? ` · ${info.export.incoterms}` : ""}{sd === "export" && (info?.export?.portOfLoading || info?.export?.portOfDischarge) ? ` · ${info?.export?.portOfLoading ?? "?"} → ${info?.export?.portOfDischarge ?? "?"}` : ""}
                {i.updatedAt ? ` · cập nhật ${dateTime(i.updatedAt)}` : ""}
              </div>
            )}
            {list.map((f) => (
              <div key={`${f.key}-${f.kind}`} className="between" style={{ fontSize: 12.5 }}>
                <span className="wrap">{CUSTOMS_DOC_KINDS[f.kind as CustomsDocKind].label}: {f.name}{f.at ? ` · ${dateTime(f.at)}` : ""}</span>
                <button className="btn bs sm" onClick={() => void open(f.key)}><Eye size={14} aria-hidden="true" /> Xem bản gốc</button>
              </div>
            ))}
          </div>
        );
      })}
      {gate.missing.length > 0 && <div className="err" role="status">Thiếu: {gate.missing.join("; ")}.{CUSTOMS_GATE === "block" ? " Cần bổ sung trước khi gửi yêu cầu báo giá." : " Tổ chức tài chính có thể từ chối hoặc báo giá kém hơn."}</div>}
      {gate.warnings.length > 0 && <div className="muted" style={{ fontSize: 12.5 }}>Nên bổ sung: {gate.warnings.join(", ")}.</div>}
      {side && reason && <div className="muted" style={{ fontSize: 12.5 }}>{reason}.</div>}
      {canAttach && (
        <div className="soft stack-sm" style={{ gap: 8 }}>
          <label className="field"><span>Loại chứng từ</span>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as CustomsDocKind)}>{mine.map((k) => <option key={k} value={k}>{CUSTOMS_DOC_KINDS[k].label}</option>)}</select>
          </label>
          <FileInput label={<span className="sr-only">Tải chứng từ hải quan: {CUSTOMS_DOC_KINDS[kind].label}</span>} accept="application/pdf,image/*,.xml,.xlsx,.csv,.zip" busy={busy} onFile={(f) => void upload(f)} hint="PDF, ảnh, XML, Excel hoặc ZIP · tối đa 15 MB · chỉ thêm, không gỡ" />
          <strong style={{ fontSize: 12.5 }}>Thông tin tờ khai {side === "export" ? "xuất khẩu" : "nhập khẩu"}</strong>
          <div className="grid2" style={{ gap: 8 }}>
            <label className="field"><span>Số tờ khai</span><input className="input" value={form.declarationNo} onChange={set("declarationNo")} /></label>
            <label className="field"><span>Ngày tờ khai</span><input className="input" type="date" value={form.declarationDate} onChange={set("declarationDate")} /></label>
            <label className="field"><span>Thông quan</span><select className="select" value={form.clearance} onChange={set("clearance")}><option value="">—</option><option value="cleared">Đã thông quan</option><option value="pending">Chờ thông quan</option></select></label>
            <label className="field"><span>Luồng tờ khai</span><select className="select" value={form.channel} onChange={set("channel")}><option value="">—</option><option value="green">Xanh</option><option value="yellow">Vàng</option><option value="red">Đỏ</option></select></label>
            {side === "export" && (<>
              <label className="field"><span>Phương thức vận tải</span><select className="select" value={form.transportMode} onChange={set("transportMode")}><option value="">—</option><option value="sea">Đường biển</option><option value="air">Đường hàng không</option><option value="road">Đường bộ</option><option value="rail">Đường sắt</option></select></label>
              <label className="field"><span>Số vận đơn</span><input className="input" value={form.transportDocNo} onChange={set("transportDocNo")} /></label>
              <label className="field"><span>MST người xuất khẩu trên tờ khai</span><input className="input" value={form.exporterTaxCode} onChange={set("exporterTaxCode")} /></label>
              <label className="field"><span>Ngày giao hàng</span><input className="input" type="date" value={form.shipmentDate} onChange={set("shipmentDate")} /></label>
              <label className="field"><span>Cảng đi</span><input className="input" value={form.portOfLoading} onChange={set("portOfLoading")} /></label>
              <label className="field"><span>Cảng đến</span><input className="input" value={form.portOfDischarge} onChange={set("portOfDischarge")} /></label>
              <label className="field"><span>Incoterms</span><input className="input" placeholder="FOB, CIF…" value={form.incoterms} onChange={set("incoterms")} /></label>
            </>)}
          </div>
          <div><button className="btn bs" disabled={busy} onClick={saveInfo}>Lưu thông tin tờ khai</button></div>
        </div>
      )}
    </div>
  );
}
