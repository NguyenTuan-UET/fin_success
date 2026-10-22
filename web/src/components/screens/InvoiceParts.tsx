"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import type { FundingApplication, Receivable } from "@fcc/domain/types";
import { api, fileToBase64 } from "@/lib/api";
import { date, dateTime, vnd } from "@/lib/format";
import { useData } from "@/lib/session";
import { useToast } from "@/components/providers/Toast";
import { FileInput } from "@/components/ui/Fields";

type Step = { label: string; at?: string; done: boolean; note: string };

/** Tiến trình theo sự kiện đã xảy ra: hoàn tất / đang ở bước này / chưa bắt đầu, kèm mốc thời gian. */
export function InvoiceTimeline({ r, app }: { r: Receivable; app?: FundingApplication }) {
  const sent = r.state !== "DRAFT" && !(r.state === "CANCELLED" && !r.sentAt);
  const confirmed = !!r.confirmedAt && !["DRAFT", "BUYER_PENDING", "BUYER_DISPUTED", "CANCELLED"].includes(r.state);
  const funded = ["FUNDED", "SETTLED", "OVERDUE"].includes(r.state) && !!app?.fundedAt;
  const paid = ["SETTLED", "EARLY_PAID"].includes(r.state);
  const steps: Step[] = [
    { label: "Chuẩn bị chứng từ", at: r.createdAt, done: true, note: `Tạo ngày ${date(r.createdAt)}` },
    { label: "Gửi bên nhập khẩu xác nhận", at: r.sentAt, done: sent, note: sent ? `Đã gửi${r.sentAt ? ` ${dateTime(r.sentAt)}` : ""}` : "Bản nháp — bên nhập khẩu chưa thấy hóa đơn" },
    { label: "Bên nhập khẩu xác nhận", at: r.confirmedAt, done: confirmed, note: confirmed ? `Xác nhận phiên bản v${r.version} ngày ${date(r.confirmedAt)}` : r.state === "BUYER_DISPUTED" ? "Bên nhập khẩu hỏi lại / tranh chấp" : "Xác nhận khoản phải thu" },
    { label: "Tổ chức tài chính giải ngân", at: app?.fundedAt, done: funded, note: funded ? `Giải ngân ${date(app?.fundedAt)}` : "Sau khi chọn gói và được duyệt" },
    { label: "Bên nhập khẩu thanh toán & tất toán", at: r.paidAt, done: paid, note: paid ? `Ngày ${date(r.paidAt)}` : `Đến hạn ${date(r.dueDate)}` },
  ];
  const cur = r.state === "CANCELLED" ? -1 : steps.findIndex((s) => !s.done);
  return (
    <ol className="tl" style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Tiến trình hóa đơn">
      {steps.map((st, i) => {
        const now = i === cur;
        const bad = now && (r.state === "OVERDUE" || r.state === "BUYER_DISPUTED");
        const c = bad ? "var(--bad-strong)" : st.done ? "var(--brand-fill)" : now ? "var(--warn-strong)" : "var(--line-strong)";
        return (
          <li key={st.label} className="tl-item">
            <div className="tl-rail">
              <span className="tl-dot" style={{ borderColor: c, background: st.done ? c : "#fff" }} />
              <span className="tl-line" style={{ background: i === steps.length - 1 ? "transparent" : st.done ? "var(--brand-fill)" : "var(--line)" }} />
            </div>
            <div className="tl-body">
              <span style={{ fontSize: 13, fontWeight: 600, color: st.done || now ? "var(--ink)" : "var(--ink-3)" }}>
                {st.label} <span className={`chip ${st.done ? "c-ok" : now ? "c-warn" : "c-neu"}`} style={{ marginLeft: 4, height: 20, fontSize: 11 }}>{st.done ? "Hoàn tất" : now ? "Đang ở bước này" : "Chưa bắt đầu"}</span>
              </span>
              <span className="muted">{r.state === "OVERDUE" && now ? "Bên nhập khẩu chậm thanh toán" : st.note}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const DOC_KINDS = [
  { kind: "invoice", label: "Hóa đơn gốc (XML/PDF/ảnh)", has: (r: Receivable) => r.docs.xml || !!r.files?.some((f) => f.kind === "invoice") },
  { kind: "contract", label: "Hợp đồng ngoại thương / đơn đặt hàng", has: (r: Receivable) => r.docs.contract },
  { kind: "delivery", label: "Chứng từ giao hàng / vận chuyển", has: (r: Receivable) => r.docs.delivery },
] as const;

export const missingDocs = (r: Receivable) => DOC_KINDS.filter((d) => !d.has(r)).length;

/**
 * Chứng từ của khoản phải thu: trạng thái từng loại (chưa có / đã tải lên — chưa đối chiếu nội dung), xem bản gốc qua URL có hạn,
 * và (đơn vị xuất khẩu) bổ sung chứng từ khi còn chưa tài trợ. FCC không tự khẳng định đã đối chiếu nội dung chứng từ.
 */
export function InvoiceDocuments({ r, canAttach }: { r: Receivable; canAttach?: boolean }) {
  const { act } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const open = async (key: string) => {
    try {
      const u = await api<{ url: string }>("GET", `/api/files/${key}/url`);
      window.open(u.url, "_blank", "noopener");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const attach = async (kind: string, f: File | null) => {
    if (!f) return;
    setBusy(kind);
    try {
      const stored = await api<{ key: string }>("POST", "/api/files", { name: f.name, mime: f.type || "application/octet-stream", dataBase64: await fileToBase64(f), kind });
      await act("POST", `/v1/receivables/${r.id}/documents`, { files: [{ key: stored.key, name: f.name, kind }] });
      toast(`Đã bổ sung ${f.name}${r.state !== "DRAFT" ? " — đã báo bên nhập khẩu" : ""}`);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(null);
  };
  return (
    <div className="stack-sm" aria-label="Chứng từ">
      <strong style={{ fontSize: 13 }}>Chứng từ ({3 - missingDocs(r)}/3)</strong>
      {DOC_KINDS.map((d) => {
        const files = (r.files ?? []).filter((f) => f.kind === d.kind);
        const has = d.has(r);
        return (
          <div key={d.kind} className="soft stack-sm" style={{ gap: 6 }}>
            <div className="between">
              <span style={{ fontSize: 13 }}>{d.label}</span>
              <span className={`chip ${has ? "c-info" : "c-warn"}`}>{has ? "Đã tải lên — chưa đối chiếu nội dung" : "Chưa có"}</span>
            </div>
            {files.map((f) => (
              <div key={f.key} className="between" style={{ fontSize: 12.5 }}>
                <span className="wrap">{f.name}</span>
                <button className="btn bs sm" onClick={() => void open(f.key)}><Eye size={14} aria-hidden="true" /> Xem bản gốc</button>
              </div>
            ))}
            {d.kind === "invoice" && r.docs.xml && !files.length && <span className="muted" style={{ fontSize: 12.5 }}>Dữ liệu đọc từ XML hóa đơn điện tử</span>}
            {canAttach && !has && <FileInput label={<span className="sr-only">Bổ sung {d.label}</span>} accept="application/pdf,image/*,.xml" busy={busy === d.kind} onFile={(f) => void attach(d.kind, f)} hint="PDF, ảnh hoặc XML · tối đa 15 MB" />}
          </div>
        );
      })}
    </div>
  );
}

/** Lịch sử điều chỉnh tại chính hóa đơn: trước/sau, thời điểm, lý do, xác nhận cũ có bị thay thế không. */
export function RevisionHistory({ r }: { r: Receivable }) {
  if (!r.revisions?.length) return null;
  return (
    <div className="stack-sm" aria-label="Lịch sử điều chỉnh">
      <strong style={{ fontSize: 13 }}>Lịch sử điều chỉnh</strong>
      {[...r.revisions].reverse().map((v) => (
        <div key={v.version} className="soft" style={{ fontSize: 12.5 }}>
          <div className="between"><strong>Phiên bản v{v.version}</strong><span className="muted num">{dateTime(v.at)}</span></div>
          {v.before.amount !== v.after.amount && <div>Số tiền: <s className="num">{vnd(v.before.amount)} đ</s> → <strong className="num">{vnd(v.after.amount)} đ</strong></div>}
          {v.before.dueDate !== v.after.dueDate && <div>Hạn thanh toán: <s className="num">{date(v.before.dueDate)}</s> → <strong className="num">{date(v.after.dueDate)}</strong></div>}
          <div className="muted">Lý do: {v.note}{v.voidedConfirmation ? " · xác nhận của phiên bản trước đã mất hiệu lực" : ""}</div>
        </div>
      ))}
    </div>
  );
}
