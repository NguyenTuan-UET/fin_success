"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useToast } from "@/components/providers/Toast";

type Rec = { id: string; field: string; value: string; source?: string; url?: string; fetchedAt: string; manual?: boolean; label: string; status?: string; parserVersion?: string; disputed?: boolean };

/** Dữ liệu công khai về một tổ chức: luôn có nhãn “Nguồn công khai – tham khảo”, liên kết gốc, ngày lấy; không dùng để tính điểm. */
export function PublicData({ orgId, canDispute = false, empty }: { orgId: string; canDispute?: boolean; empty?: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [reason, setReason] = useState<{ id: string; text: string } | null>(null);
  const load = useCallback(() => api<Rec[]>("GET", `/v1/organizations/${orgId}/external-profile`).then(setRows, () => setRows([])), [orgId]);
  useEffect(() => { void load(); }, [load]);

  if (!rows) return <div className="muted">Đang tải…</div>;
  if (!rows.length) return <div className="muted">{empty ?? "Chưa có dữ liệu công khai. Khai báo website ở hồ sơ tổ chức để FCC đọc các chứng nhận công bố; một số nguồn nhà nước do FCC tra cứu thủ công."}</div>;
  return (
    <div className="stack-sm">
      <div className="tw"><table>
        <thead><tr><th>Thông tin</th><th>Giá trị</th><th>Nguồn</th><th>Ngày lấy</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="wrap">{r.field}<div><span className="chip c-neu">{r.label}</span></div></td>
              <td className="wrap">{r.value}{r.status && <div><span className="chip c-warn">{r.status}</span></div>}</td>
              <td className="wrap">{r.source}{r.manual ? " (FCC tra cứu thủ công)" : ""}{r.url && <div><a href={r.url} target="_blank" rel="noreferrer noopener">Xem nguồn gốc</a></div>}</td>
              <td>{dateTime(r.fetchedAt)}</td>
              <td>{canDispute && !r.disputed && <button className="btn bs sm" onClick={() => setReason({ id: r.id, text: "" })}>Khiếu nại</button>}</td>
            </tr>
          ))}
        </tbody></table></div>
      {reason && (
        <div className="stack-sm">
          <label className="field"><span>Lý do khiếu nại (ít nhất 10 ký tự, nêu rõ thông tin đúng là gì)</span><textarea className="input" rows={2} value={reason.text} onChange={(e) => setReason({ ...reason, text: e.target.value })} /></label>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn bp" disabled={reason.text.trim().length < 10} onClick={async () => {
              try { await api("POST", `/v1/external-records/${reason.id}/disputes`, { reason: reason.text }); toast("Đã gửi khiếu nại — bản ghi chuyển sang “Đang được xem xét”"); setReason(null); await load(); } catch (e) { toast((e as Error).message); }
            }}>Gửi khiếu nại</button>
            <button className="btn bs" onClick={() => setReason(null)}>Hủy</button>
          </div>
        </div>
      )}
    </div>
  );
}
