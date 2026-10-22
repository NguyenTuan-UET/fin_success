"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource, ExternalRecord } from "@fcc/domain/types";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { orgName } from "@/lib/model";
import { useData } from "@/lib/session";
import { PageHeader } from "@/components/ui/basic";
import { useToast } from "@/components/providers/Toast";

type SyncState = { enabled: boolean; symbols: Record<string, { at: string; ok: boolean; error?: string }> };
type Job = { id: string; sourceId: string; orgId: string; status: string; attempts: number; reason?: string; error?: string; createdAt: string };
const CLASS_LABEL = { A: "A — crawl tự động", B: "B — tra cứu thủ công", C: "C — bỏ" } as const;
const AUDIT_LABEL = { unqualified: "chấp nhận toàn phần", qualified: "ngoại trừ", adverse: "trái ngược", disclaimer: "từ chối" } as const;
const TRADING_LABEL = { normal: "bình thường", warning: "cảnh báo", controlled: "kiểm soát", restricted: "hạn chế" } as const;
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
  const [sync, setSync] = useState<SyncState | null>(null);

  const load = useCallback(async () => {
    setSources(await api<DataSource[]>("GET", "/v1/operations/data-sources").catch(() => []));
    setJobs(await api<Job[]>("GET", "/v1/operations/crawl-jobs").catch(() => []));
    setSync(await api<SyncState>("GET", "/v1/operations/listed-sync").catch(() => null));
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
  const manualSources = sources.filter((s) => s.sourceClass === "B" && s.status !== "blocked");
  const manualReady = manualSources.length > 0 && customers.length > 0;
  const listedBuyers = data.orgs.filter((o) => o.type === "buyer" && o.listedSymbol);

  return (
    <div className="stack">
      <PageHeader title="Nguồn dữ liệu công khai" sub="Phê duyệt nguồn, theo dõi việc crawl, tra cứu thủ công, xử lý khiếu nại và xác minh mã chứng khoán" />

      <section className="card stack">
        <h2 className="ct">Danh mục nguồn</h2>
        <div className="muted">Nguồn chưa phê duyệt thì không chạy. Loại B chỉ tra cứu thủ công kèm đường dẫn; loại C không dùng (kết quả khảo sát bên dưới). Phê duyệt cần MFA và ghi căn cứ pháp lý/điều khoản.</div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Nguồn</th><th>Loại</th><th>Trạng thái</th><th>Khảo sát / căn cứ</th><th style={{ minWidth: 340 }}>Thao tác</th></tr></thead>
          <tbody>
            {sources.length === 0 && <tr><td colSpan={5} className="empty">Chưa cấu hình nguồn dữ liệu. Bước tiếp theo: khai báo nguồn trong danh mục máy chủ (kèm điều khoản sử dụng), sau đó phê duyệt tại đây với căn cứ pháp lý. Các bước tra cứu bên dưới tạm khóa cho tới khi có nguồn.</td></tr>}
            {sources.map((s) => (
              <tr key={s.id}>
                <td className="wrap">{s.name}<div className="muted">{s.owner}</div></td>
                <td>{s.sourceClass ? CLASS_LABEL[s.sourceClass] : "—"}{s.adapter && <div className="muted">adapter {s.adapter}</div>}</td>
                <td><span className={`chip ${STATUS_LABEL[s.status][1]}`}>{STATUS_LABEL[s.status][0]}</span>{s.approvedBy && <div className="muted">{s.approvedBy} · {s.approvedAt?.slice(0, 10)}</div>}</td>
                <td className="wrap muted" style={{ fontSize: 12.5 }}>{s.survey ?? s.note}</td>
                <td className="wrap" style={{ minWidth: 340 }}>{s.kind !== "vnstock" && s.sourceClass !== "C" && (
                  <div className="stack-sm">
                    <input className="input" placeholder="Căn cứ (điều khoản, ý kiến pháp chế…)" value={note[s.id] ?? ""} onChange={(e) => setNote({ ...note, [s.id]: e.target.value })} />
                    <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                      <button className="btn bp sm" disabled={s.status === "approved" || !note[s.id]?.trim()} onClick={() => run(() => api("POST", `/v1/operations/data-sources/${s.id}/review`, { status: "approved", note: note[s.id] ?? "" }), "Đã phê duyệt nguồn")}>Phê duyệt</button>
                      <button className="btn bs sm" disabled={s.status === "blocked" || !note[s.id]?.trim()} onClick={() => run(() => api("POST", `/v1/operations/data-sources/${s.id}/review`, { status: "blocked", note: note[s.id] ?? "" }), "Đã chặn nguồn")}>Chặn</button>
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
          <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
            <thead><tr><th>Thời điểm</th><th>Tổ chức</th><th>Nguồn</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
            <tbody>{jobs.map((j) => (
              <tr key={j.id}><td>{dateTime(j.createdAt)}</td><td>{orgName(data.orgs, j.orgId)}</td><td>{sources.find((s) => s.id === j.sourceId)?.name ?? j.sourceId}</td>
                <td><span className={`chip ${j.status === "done" ? "c-ok" : j.status === "queued" ? "c-neu" : "c-warn"}`}>{{ done: "Xong", queued: "Chờ", running: "Đang chạy", failed: "Lỗi", manual_needed: "Cần tra cứu thủ công" }[j.status] ?? j.status}</span></td>
                <td className="wrap muted">{j.reason ?? j.error}</td></tr>
            ))}</tbody></table></div>)}
        {manualJobs.length > 0 && <div className="muted">{manualJobs.length} việc cần FCC xử lý: tra cứu thủ công ở biểu mẫu dưới.</div>}
      </section>

      <section className="card stack">
        <h2 className="ct">Ghi kết quả tra cứu thủ công</h2>
        {!manualReady && <div className="muted">{!manualSources.length ? "Chưa có nguồn tra cứu thủ công (loại B) khả dụng — cấu hình nguồn ở danh mục trên trước khi ghi kết quả." : "Chưa có doanh nghiệp nào đăng ký để tra cứu."}</div>}
        <fieldset disabled={!manualReady} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="stack">
        <div className="grid-fields">
          <label className="field"><span>Doanh nghiệp</span><select className="select" value={manual.orgId} onChange={(e) => setManual({ ...manual, orgId: e.target.value })}><option value="">—</option>{customers.map((o) => <option key={o.id} value={o.id}>{o.shortName} · MST {o.taxCode}</option>)}</select></label>
          <label className="field"><span>Nguồn</span><select className="select" value={manual.sourceId} onChange={(e) => setManual({ ...manual, sourceId: e.target.value })}><option value="">—</option>{manualSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="field"><span>Thông tin</span><input className="input" value={manual.field} onChange={(e) => setManual({ ...manual, field: e.target.value })} /></label>
          <label className="field"><span>Giá trị</span><input className="input" value={manual.value} onChange={(e) => setManual({ ...manual, value: e.target.value })} /></label>
          <label className="field"><span>Đường dẫn nguồn (URL)</span><input className="input" value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} /></label>
          <label className="field"><span>Ghi chú</span><input className="input" value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} /></label>
        </div>
        <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={!manual.orgId || !manual.sourceId || !manual.field || !manual.value || !manual.url}
          onClick={() => run(async () => { await act("POST", `/v1/organizations/${manual.orgId}/external-records`, { sourceId: manual.sourceId, field: manual.field, value: manual.value, url: manual.url, note: manual.note }); setManual({ ...manual, field: "", value: "", url: "", note: "" }); }, "Đã ghi kết quả tra cứu")}>Ghi kết quả</button>
        </fieldset>
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
        <div className="between">
          <h2 className="ct">Bên nhập khẩu niêm yết (vnstock)</h2>
          {sync?.enabled && <button className="btn bs sm" onClick={() => run(() => api("POST", "/v1/operations/listed-sync", {}), "Đã lấy dữ liệu mới từ vnstock")}>Lấy dữ liệu ngay</button>}
        </div>
        <div className="muted">Chỉ nạp dữ liệu niêm yết sau khi FCC xác minh ánh xạ MST ↔ mã chứng khoán. {sync?.enabled ? "Máy chủ tự lấy lại dữ liệu mỗi 15 phút trong giờ giao dịch, 6 giờ ngoài giờ." : "Máy chủ chưa bật tự động lấy dữ liệu (VNSTOCK_AUTO)."} Ý kiến kiểm toán và diện cảnh báo không có trong vnstock: FCC đối chiếu công bố thông tin của sở giao dịch rồi xác nhận bên dưới, trước đó hai chỉ tiêu này không được chấm.</div>
        {!listedBuyers.length ? <div className="muted">Chưa có bên nhập khẩu nào khai mã chứng khoán.</div> : (
          <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
            <thead><tr><th>Bên nhập khẩu</th><th>Mã</th><th>Xác minh</th><th>Dữ liệu</th></tr></thead>
            <tbody>{listedBuyers.map((o) => {
              const l = data.listed.find((x) => x.orgId === o.id);
              const ok = o.listedVerified?.symbol === o.listedSymbol;
              return (
                <tr key={o.id}><td>{o.shortName}<div className="muted">MST {o.taxCode}</div></td><td>{o.listedSymbol}</td>
                  <td>{ok ? <span className="chip c-ok">Đã xác minh {o.listedVerified?.at.slice(0, 10)}</span> : (
                    <div className="stack-sm"><input className="input" placeholder="Căn cứ đối chiếu MST ↔ mã" value={verifyNote[o.id] ?? ""} onChange={(e) => setVerifyNote({ ...verifyNote, [o.id]: e.target.value })} />
                      <button className="btn bp sm" onClick={() => run(() => api("POST", `/v1/organizations/${o.id}/listed-verification`, { note: verifyNote[o.id] ?? "" }), "Đã xác minh mã chứng khoán")}>Xác minh</button></div>)}</td>
                  <td className="wrap">{l ? <>Nạp {dateTime(l.fetchedAt)}{nowMs - new Date(l.fetchedAt).getTime() > 7 * 86_400_000 && <span className="chip c-warn" style={{ marginLeft: 6 }}>Dữ liệu cũ</span>}
                    <div>{l.flagsReviewed ? <>Kiểm toán: {AUDIT_LABEL[l.auditOpinion]} · giao dịch: {TRADING_LABEL[l.tradingStatus]} <span className="chip c-ok">Đã đối chiếu {l.flagsReviewed.at.slice(0, 10)}</span></> : <span className="chip c-warn">Chưa đối chiếu kiểm toán / diện giao dịch</span>}</div>
                    {(l.warnings ?? []).map((w) => <div key={w} className="muted">⚠ {w}</div>)}</> : <span className="muted">Chưa nạp</span>}
                    {sync?.symbols[o.listedSymbol!.toUpperCase()]?.ok === false && <div className="chip c-bad">Lần lấy gần nhất lỗi: {sync.symbols[o.listedSymbol!.toUpperCase()].error}</div>}</td></tr>);
            })}</tbody></table></div>)}
        {data.listed.length > 0 && (
          <div className="stack-sm">
            <b>Nhập ý kiến kiểm toán / diện giao dịch</b>
            <div className="grid-fields">
              <label className="field"><span>Bên nhập khẩu</span><select className="select" value={flags.orgId} onChange={(e) => setFlags({ ...flags, orgId: e.target.value })}><option value="">—</option>{data.listed.map((l) => <option key={l.orgId} value={l.orgId}>{l.symbol} · {orgName(data.orgs, l.orgId)}</option>)}</select></label>
              <label className="field"><span>Ý kiến kiểm toán</span><select className="select" value={flags.auditOpinion} onChange={(e) => setFlags({ ...flags, auditOpinion: e.target.value })}><option value="">Giữ nguyên (xác nhận đúng)</option><option value="unqualified">Chấp nhận toàn phần</option><option value="qualified">Ngoại trừ</option><option value="adverse">Trái ngược</option><option value="disclaimer">Từ chối đưa ý kiến</option></select></label>
              <label className="field"><span>Diện giao dịch</span><select className="select" value={flags.tradingStatus} onChange={(e) => setFlags({ ...flags, tradingStatus: e.target.value })}><option value="">Giữ nguyên (xác nhận đúng)</option><option value="normal">Bình thường</option><option value="warning">Cảnh báo</option><option value="controlled">Kiểm soát</option><option value="restricted">Hạn chế giao dịch</option></select></label>
              <label className="field"><span>Nguồn công bố</span><input className="input" value={flags.note} onChange={(e) => setFlags({ ...flags, note: e.target.value })} /></label>
            </div>
            <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={!flags.orgId || flags.note.trim().length < 10}
              onClick={() => run(() => api("POST", `/v1/organizations/${flags.orgId}/listed-flags`, { ...(flags.auditOpinion ? { auditOpinion: flags.auditOpinion } : {}), ...(flags.tradingStatus ? { tradingStatus: flags.tradingStatus } : {}), note: flags.note }), "Đã ghi nhận đối chiếu")}>Xác nhận đã đối chiếu</button>
          </div>)}
      </section>
    </div>
  );
}
