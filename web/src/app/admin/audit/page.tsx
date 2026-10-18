"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useData } from "@/lib/session";
import { PageHeader } from "@/components/ui/basic";
import { Pager } from "@/components/ui/Pager";

const SIZE = 25;

export default function AdminAudit() {
  const { data } = useData();
  const [integrity, setIntegrity] = useState<{ ok: boolean; count: number; badSeq?: number } | null>(null);
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState("");
  const [page, setPage] = useState(0);
  const rows = data.audit.filter((e) => (!orgId || e.actorOrgId === orgId) && (!q || `${e.action} ${e.entity} ${e.detail}`.toLowerCase().includes(q.toLowerCase())));
  const shown = rows.slice(page * SIZE, (page + 1) * SIZE);
  const actors = [...new Set(data.audit.map((e) => e.actorOrgId))];
  const short = (id: string) => data.orgs.find((o) => o.id === id)?.shortName ?? id;

  return (
    <>
      <PageHeader eyebrow="Quản trị FCC · Bảo mật" title="Nhật ký kiểm toán" sub="Chỉ thêm, không sửa; nối chuỗi băm để phát hiện thay đổi sau khi ghi." />
      <section className="card flush">
        <div className="ch"><h2 className="ct">Sự kiện ({rows.length})</h2>
          <button className="btn bs sm" onClick={async () => setIntegrity(await api("GET", "/v1/audit-events/integrity"))}>Kiểm tra chuỗi băm</button></div>
        <p className="muted" style={{ margin: "0 16px 8px" }}>Nhật ký chỉ ghi siêu dữ liệu và tóm tắt sự kiện, không chứa tệp gốc của chứng từ. Với sự kiện của tổ chức khác, số tiền, lãi suất và kết quả chấm điểm được ẩn khỏi màn hình này (bản ghi gốc không đổi). Chuỗi băm chỉ phát hiện sửa đổi sau khi ghi, không chứng minh nội dung ban đầu là đúng.</p>
        {integrity && <div className={integrity.ok ? "okmsg" : "err"} style={{ margin: "0 16px 8px" }}>{integrity.ok ? `Chuỗi băm hợp lệ (${integrity.count} sự kiện).` : `Phát hiện sửa đổi tại sự kiện số ${integrity.badSeq}.`}</div>}
        <div className="row" style={{ gap: 8, flexWrap: "wrap", padding: "0 16px 8px" }}>
          <label className="field" style={{ flex: "1 1 240px" }}><span>Tìm kiếm</span><input className="input" placeholder="Hành động, đối tượng, chi tiết" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></label>
          <label className="field"><span>Tổ chức thực hiện</span><select className="select" value={orgId} onChange={(e) => { setOrgId(e.target.value); setPage(0); }}><option value="">Tất cả</option>{actors.map((id) => <option key={id} value={id}>{short(id)}</option>)}</select></label>
        </div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Thời gian</th><th>Tổ chức</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
          <tbody>
            {shown.map((e) => <tr key={e.id}><td className="num">{dateTime(e.at)}</td><td>{short(e.actorOrgId)}</td><td>{e.action}</td><td className="num">{e.entity}</td><td className="wrap">{e.detail}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">Không có sự kiện.</td></tr>}
          </tbody></table></div>
        <Pager page={page} total={rows.length} size={SIZE} onPage={setPage} />
      </section>
    </>
  );
}
