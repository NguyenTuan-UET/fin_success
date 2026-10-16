"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource, ExternalRecord } from "@fcc/domain/types";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { orgName } from "@/lib/model";
import { useData } from "@/lib/session";
import { PageHeader } from "@/components/ui/basic";
import { useToast } from "@/components/providers/Toast";

type Job = { id: string; sourceId: string; orgId: string; status: string; attempts: number; reason?: string; error?: string; createdAt: string };
const CLASS_LABEL = { A: "A — crawl tự động", B: "B — tra cứu thủ công", C: "C — bỏ" } as const;
const STATUS_LABEL = { approved: ["Đã phê duyệt", "c-ok"], pending: ["Chờ phê duyệt", "c-warn"], blocked: ["Bị chặn", "c-bad"] } as const;

export default function SourcesPage() {
  const { data, act } = useData();
  const toast = useToast();
  const [nowMs] = useState(() => Date.now());
  const [sources, setSources] = useState<DataSource[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [manual, setManual] = useState({ orgId: "", sourceId: "", field: "", value: "", url: "", note: "" });
  const [resolve, setResolve] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState({ orgId: "", auditOpinion: "", tradingStatus: "", note: "" });
  const [verifyNote, setVerifyNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setSources(await api<DataSource[]>("GET", "/v1/operations/data-sources").catch(() => []));
    setJobs(await api<Job[]>("GET", "/v1/operations/crawl-jobs").catch(() => []));
  }, []);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void load(); }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const run = async (f: () => Promise<unknown>, ok: string) => {
    try { await f(); toast(ok); await load(); } catch (e) { toast((e as Error).message); }
  };

  const customers = data.orgs.filter((o) => o.type === "supplier" || o.type === "buyer");
  const disputed = data.external.filter((e: ExternalRecord) => e.disputed);
  const manualJobs = jobs.filter((j) => j.status === "manual_needed" || j.status === "failed");
  const listedBuyers = data.orgs.filter((o) => o.type === "buyer" && o.listedSymbol);

  return (
    <div className="stack">
      <PageHeader title="Nguồn dữ liệu công khai" sub="Phê duyệt nguồn, theo dõi việc crawl, tra cứu thủ công, xử lý khiếu nại và xác minh mã chứng khoán" />

      <section className="card stack">
        <h2 className="ct">Danh mục nguồn</h2>
        <div className="muted">Nguồn chưa phê duyệt thì không chạy. Loại B chỉ tra cứu thủ công kèm đường dẫn; loại C không dùng (kết quả khảo sát bên dưới). Phê duyệt cần MFA và ghi căn cứ pháp lý/điều khoản.</div>
        <div className="tw"><table>
          <thead><tr><th>Nguồn</th><th>Loại</th><th>Trạng thái</th><th>Khảo sát / căn cứ</th><th>Thao tác</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>{s.name}<div className="muted">{s.owner}</div></td>
                <td>{s.sourceClass ? CLASS_LABEL[s.sourceClass] : "—"}{s.adapter && <div className="muted">adapter {s.adapter}</div>}</td>
                <td><span className={`chip ${STATUS_LABEL[s.status][1]}`}>{STATUS_LABEL[s.status][0]}</span>{s.approvedBy && <div className="muted">{s.approvedBy} · {s.approvedAt?.slice(0, 10)}</div>}</td>
                <td className="muted">{s.survey ?? s.note}</td>
                <td>{s.kind !== "vnstock" && s.sourceClass !== "C" && (
                  <div className="stack-sm">
                    <input className="input" placeholder="Căn cứ (điều khoản, ý kiến pháp chế…)" value={note[s.id] ?? ""} onChange={(e) => setNote({ ...note, [s.id]: e.target.value })} />
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn bp sm" disabled={s.status === "approved"} onClick={() => run(() => api("POST", `/v1/operations/data-sources/${s.id}/review`, { status: "approved", note: note[s.id] ?? "" }), "Đã phê duyệt nguồn")}>Phê duyệt</button>
                      <button className="btn bs sm" disabled={s.status === "blocked"} onClick={() => run(() => api("POST", `/v1/operations/data-sources/${s.id}/review`, { status: "blocked", note: note[s.id] ?? "" }), "Đã chặn nguồn")}>Chặn</button>
                    </div>
                  </div>)}</td>
              </tr>
            ))}
          </tbody></table></div>
      </section>

      <section className="card stack">
        <div className="between"><h2 className="ct">Hàng đợi crawl và việc tra cứu thủ công</h2>
          <button className="btn bs sm" onClick={() => void load()}>Làm mới</button></div>
        {!jobs.length ? <div className="muted">Chưa có việc nào.</div> : (
          <div className="tw"><table>
            <thead><tr><th>Thời điểm</th><th>Tổ chức</th><th>Nguồn</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
            <tbody>{jobs.map((j) => (
              <tr key={j.id}><td>{dateTime(j.createdAt)}</td><td>{orgName(data.orgs, j.orgId)}</td><td>{sources.find((s) => s.id === j.sourceId)?.name ?? j.sourceId}</td>
                <td><span className={`chip ${j.status === "done" ? "c-ok" : j.status === "queued" ? "c-neu" : "c-warn"}`}>{{ done: "Xong", queued: "Chờ", running: "Đang chạy", failed: "Lỗi", manual_needed: "Cần tra cứu thủ công" }[j.status] ?? j.status}</span></td>
                <td className="muted">{j.reason ?? j.error}</td></tr>
            ))}</tbody></table></div>)}
        {manualJobs.length > 0 && <div className="muted">{manualJobs.length} việc cần FCC xử lý: tra cứu thủ công ở biểu mẫu dưới.</div>}
      </section>

      <section className="card stack">
        <h2 className="ct">Ghi kết quả tra cứu thủ công</h2>
        <div className="grid-fields">
          <label className="field"><span>Doanh nghiệp</span><select className="select" value={manual.orgId} onChange={(e) => setManual({ ...manual, orgId: e.target.value })}><option value="">—</option>{customers.map((o) => <option key={o.id} value={o.id}>{o.shortName} · MST {o.taxCode}</option>)}</select></label>
          <label className="field"><span>Nguồn</span><select className="select" value={manual.sourceId} onChange={(e) => setManual({ ...manual, sourceId: e.target.value })}><option value="">—</option>{sources.filter((s) => s.sourceClass === "B").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="field"><span>Thông tin</span><input className="input" value={manual.field} onChange={(e) => setManual({ ...manual, field: e.target.value })} /></label>
          <label className="field"><span>Giá trị</span><input className="input" value={manual.value} onChange={(e) => setManual({ ...manual, value: e.target.value })} /></label>
          <label className="field"><span>Đường dẫn nguồn (URL)</span><input className="input" value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} /></label>
          <label className="field"><span>Ghi chú</span><input className="input" value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} /></label>
        </div>
        <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={!manual.orgId || !manual.sourceId || !manual.field || !manual.value || !manual.url}
          onClick={() => run(async () => { await act("POST", `/v1/organizations/${manual.orgId}/external-records`, { sourceId: manual.sourceId, field: manual.field, value: manual.value, url: manual.url, note: manual.note }); setManual({ ...manual, field: "", value: "", url: "", note: "" }); }, "Đã ghi kết quả tra cứu")}>Ghi kết quả</button>
      </section>

      <section className="card stack">
        <h2 className="ct">Khiếu nại dữ liệu công khai ({disputed.length})</h2>
        {!disputed.length ? <div className="muted">Không có khiếu nại nào đang mở.</div> : disputed.map((d) => (
          <div key={d.id} className="stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
            <div><b>{orgName(data.orgs, d.orgId)}</b> · {d.field}: {d.value}</div>
            <div className="muted">Lý do khiếu nại: {d.disputeReason}</div>
            <input className="input" placeholder="Kết luận và căn cứ đối chiếu" value={resolve[d.id] ?? ""} onChange={(e) => setResolve({ ...resolve, [d.id]: e.target.value })} />
            <div className="row" style={{ gap: 6 }}>
              <button className="btn bp sm" onClick={() => run(() => api("POST", `/v1/external-records/${d.id}/resolution`, { outcome: "upheld", note: resolve[d.id] ?? "" }), "Đã chấp nhận khiếu nại — bản ghi được gỡ")}>Chấp nhận (gỡ bản ghi)</button>
              <button className="btn bs sm" onClick={() => run(() => api("POST", `/v1/external-records/${d.id}/resolution`, { outcome: "rejected", note: resolve[d.id] ?? "" }), "Đã giữ nguyên bản ghi")}>Giữ nguyên</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2 className="ct">Bên mua niêm yết (vnstock)</h2>
        <div className="muted">Chỉ nạp dữ liệu niêm yết sau khi FCC xác minh ánh xạ MST ↔ mã chứng khoán. Ý kiến kiểm toán và diện cảnh báo không có trong vnstock — FCC nhập từ công bố thông tin của sở giao dịch.</div>
        {!listedBuyers.length ? <div className="muted">Chưa có bên mua nào khai mã chứng khoán.</div> : (
          <div className="tw"><table>
            <thead><tr><th>Bên mua</th><th>Mã</th><th>Xác minh</th><th>Dữ liệu</th></tr></thead>
            <tbody>{listedBuyers.map((o) => {
              const l = data.listed.find((x) => x.orgId === o.id);
              const ok = o.listedVerified?.symbol === o.listedSymbol;
              return (
                <tr key={o.id}><td>{o.shortName}<div className="muted">MST {o.taxCode}</div></td><td>{o.listedSymbol}</td>
                  <td>{ok ? <span className="chip c-ok">Đã xác minh {o.listedVerified?.at.slice(0, 10)}</span> : (
                    <div className="stack-sm"><input className="input" placeholder="Căn cứ đối chiếu MST ↔ mã" value={verifyNote[o.id] ?? ""} onChange={(e) => setVerifyNote({ ...verifyNote, [o.id]: e.target.value })} />
                      <button className="btn bp sm" onClick={() => run(() => api("POST", `/v1/organizations/${o.id}/listed-verification`, { note: verifyNote[o.id] ?? "" }), "Đã xác minh mã chứng khoán")}>Xác minh</button></div>)}</td>
                  <td>{l ? <>Nạp {dateTime(l.fetchedAt)} · kiểm toán: {l.auditOpinion} · giao dịch: {l.tradingStatus}{nowMs - new Date(l.fetchedAt).getTime() > 7 * 86_400_000 && <span className="chip c-warn" style={{ marginLeft: 6 }}>Dữ liệu cũ</span>}</> : <span className="muted">Chưa nạp</span>}</td></tr>);
            })}</tbody></table></div>)}
        {data.listed.length > 0 && (
          <div className="stack-sm">
            <b>Nhập ý kiến kiểm toán / diện giao dịch</b>
            <div className="grid-fields">
              <label className="field"><span>Bên mua</span><select className="select" value={flags.orgId} onChange={(e) => setFlags({ ...flags, orgId: e.target.value })}><option value="">—</option>{data.listed.map((l) => <option key={l.orgId} value={l.orgId}>{l.symbol} · {orgName(data.orgs, l.orgId)}</option>)}</select></label>
              <label className="field"><span>Ý kiến kiểm toán</span><select className="select" value={flags.auditOpinion} onChange={(e) => setFlags({ ...flags, auditOpinion: e.target.value })}><option value="">Giữ nguyên</option><option value="unqualified">Chấp nhận toàn phần</option><option value="qualified">Ngoại trừ</option><option value="adverse">Trái ngược</option><option value="disclaimer">Từ chối đưa ý kiến</option></select></label>
              <label className="field"><span>Diện giao dịch</span><select className="select" value={flags.tradingStatus} onChange={(e) => setFlags({ ...flags, tradingStatus: e.target.value })}><option value="">Giữ nguyên</option><option value="normal">Bình thường</option><option value="warning">Cảnh báo</option><option value="controlled">Kiểm soát</option><option value="restricted">Hạn chế giao dịch</option></select></label>
              <label className="field"><span>Nguồn công bố</span><input className="input" value={flags.note} onChange={(e) => setFlags({ ...flags, note: e.target.value })} /></label>
            </div>
            <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={!flags.orgId || (!flags.auditOpinion && !flags.tradingStatus)}
              onClick={() => run(() => api("POST", `/v1/organizations/${flags.orgId}/listed-flags`, { ...(flags.auditOpinion ? { auditOpinion: flags.auditOpinion } : {}), ...(flags.tradingStatus ? { tradingStatus: flags.tradingStatus } : {}), note: flags.note }), "Đã cập nhật")}>Lưu</button>
          </div>)}
      </section>
    </div>
  );
}
