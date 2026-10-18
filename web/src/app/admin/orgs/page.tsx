"use client";

import { useState } from "react";
import { date } from "@/lib/format";
import { useData } from "@/lib/session";
import { PageHeader } from "@/components/ui/basic";
import { Pager } from "@/components/ui/Pager";

const TYPE_LABEL = { supplier: "Nhà cung cấp", buyer: "Bên mua", lender: "Tổ chức tài chính", fcc: "FCC" } as const;
const SIZE = 20;

export default function AdminOrgs() {
  const { data } = useData();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(0);
  const all = data.orgs.filter((o) => o.type !== "fcc");
  const rows = all.filter((o) => (!type || o.type === type) && (!q || `${o.name} ${o.shortName} ${o.taxCode}`.toLowerCase().includes(q.toLowerCase())));
  const shown = rows.slice(page * SIZE, (page + 1) * SIZE);
  const filter = (f: () => void) => { f(); setPage(0); };

  return (
    <>
      <PageHeader eyebrow="Quản trị FCC" title="Tổ chức" sub="Tổ chức đã đăng ký, trạng thái xác minh pháp nhân và KYC người đại diện. Việc xác minh thực hiện ở mục Việc cần xử lý." />
      <section className="card flush">
        <div className="row" style={{ gap: 8, flexWrap: "wrap", padding: "12px 16px" }}>
          <label className="field" style={{ flex: "1 1 240px" }}><span>Tìm kiếm</span><input className="input" placeholder="Tên hoặc MST" value={q} onChange={(e) => filter(() => setQ(e.target.value))} /></label>
          <label className="field"><span>Loại</span><select className="select" value={type} onChange={(e) => filter(() => setType(e.target.value))}><option value="">Tất cả ({all.length})</option>{(["supplier", "buyer", "lender"] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]} ({all.filter((o) => o.type === t).length})</option>)}</select></label>
        </div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Tên</th><th>Loại</th><th>MST</th><th>Tạo</th><th>Xác minh</th><th>KYC</th></tr></thead>
          <tbody>
            {shown.map((o) => <tr key={o.id}><td className="wrap">{o.name}{o.simulated && <span className="chip c-neu" style={{ marginLeft: 6 }}>Giả lập</span>}</td><td>{TYPE_LABEL[o.type]}</td><td className="num">{o.taxCode}</td><td>{date(o.createdAt)}</td><td>{o.type === "lender" ? (o.verified ? <span className="chip c-ok">Đã xác minh</span> : <span className="chip c-warn">Chờ</span>) : "—"}</td><td>{o.kyc ? <span className={`chip ${o.kyc.status === "verified" ? "c-ok" : o.kyc.status === "pending" ? "c-warn" : "c-bad"}`}>{{ verified: "Đã xác minh", pending: "Chờ", rejected: "Chưa đạt" }[o.kyc.status]}</span> : "—"}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={6} className="empty">{all.length ? "Không có tổ chức khớp bộ lọc." : "Chưa có tổ chức nào đăng ký."}</td></tr>}
          </tbody></table></div>
        <Pager page={page} total={rows.length} size={SIZE} onPage={setPage} />
      </section>
    </>
  );
}
