"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { computeEsg, ESG_BADGE, ESG_LEVEL_ACTION, INDICATORS, ISSUES, esgOfficialScore, type EsgIndicatorDef } from "@fcc/domain/esg";
import type { EsgAssessment, EsgIndicatorResult, IndicatorLevel } from "@fcc/domain/types";
import { api, fileToBase64 } from "@/lib/api";
import { classifyEvidence, fileToImage, proposeLevel } from "@/lib/ai";
import { date, dec } from "@/lib/format";
import { orgName } from "@/lib/model";
import { useData } from "@/lib/session";
import { Bar, Disclaimer, Kpi } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";

const LEVEL_CHIP = (s: number | null) => (s === null ? "c-neu" : s >= 80 ? "c-ok" : s >= 65 ? "c-info" : s >= 50 ? "c-warn" : "c-bad");
const YEAR_MS = 365 * 86_400_000;

function Summary({ a }: { a: EsgAssessment }) {
  const r = computeEsg(a.indicators, a.industryGroup);
  const official = esgOfficialScore(a);
  return (
    <section className="grid-kpi">
      <Kpi label={<Term k="esg">Điểm ESG</Term>} value={`${dec(r.score, 1)}/100`} note={official ? `Chính thức · ${ESG_BADGE[official.level]}` : `Tạm tính · khoảng ${dec(r.min, 0)}–${dec(r.max, 0)}`} />
      <Kpi label={<Term k="coverage">Độ bao phủ</Term>} value={`${Math.round(r.coverage * 100)}%`} note={`${r.verifiedCount}/${r.applicableCount} chỉ tiêu đã xác minh · cần ≥ 80% để chính thức`} tone={r.coverage >= 0.8 ? "ok" : undefined} />
      <Kpi label="Mức" value={r.level} note={ESG_LEVEL_ACTION[r.level]} />
      <Kpi label="Cờ trọng yếu" value={String(r.flags.length)} note={r.flags.length ? r.flags.map((f) => f.code).join(", ") : "Không có"} tone={r.flags.length ? "bad" : "ok"} />
    </section>
  );
}

function IssueBars({ a }: { a: EsgAssessment }) {
  const r = computeEsg(a.indicators, a.industryGroup);
  return (
    <section className="card stack-sm">
      <h2 className="ct">Theo vấn đề trọng yếu</h2>
      {r.issues.map((i) => (
        <div key={i.issue}>
          <div className="between"><span>{ISSUES[i.issue].label} ({Math.round(i.weight * 100)}%)</span><strong>{i.score === null ? "Chưa xác minh" : dec(i.score, 0)}</strong></div>
          <Bar value={i.score ?? 0} />
        </div>
      ))}
    </section>
  );
}

/** Doanh nghiệp: khai báo, tải bằng chứng, nhờ AI đề xuất mức (cần trích dẫn); mức chính thức do nhân sự FCC xác nhận. */
export function EsgEditor() {
  const { data, org, act } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const a = data.esg.find((e) => e.orgId === org.id && e.source === "assessed");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!a) void act("POST", "/v1/esg-assessments", { orgId: org.id }).catch(() => undefined);
  }, [a, act, org.id]);

  if (!a) return <section className="card empty">Đang khởi tạo hồ sơ ESG…</section>;
  // tài liệu cũ hơn 12 tháng không được dùng làm bằng chứng
  const cutoff = new Date(a.period.split(" → ")[1] ?? a.issuedAt ?? 0).getTime() - YEAR_MS;
  const recent = a.documents.filter((d) => !d.uploadedAt || new Date(d.uploadedAt).getTime() >= cutoff);
  const ind = (code: string): EsgIndicatorResult => a.indicators.find((i) => i.code === code) ?? { code };
  const run = async (key: string, f: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy("");
  };

  const upload = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    await run("upload", async () => {
      const stored = await api<{ key: string }>("POST", "/api/files", { name: f.name, mime: f.type || "application/octet-stream", dataBase64: await fileToBase64(f), kind: "esg" });
      let base64: string | null = null;
      if (/^image\/|pdf$/.test(f.type)) base64 = (await fileToImage(f)).base64;
      // AI phân loại; lỗi thì để chưa phân loại — không tự điền
      let cls: { docType: string; period?: string; indicatorCodes: string[]; extracted: Record<string, string | number>; summary: string } = { docType: "Chưa phân loại", indicatorCodes: [], extracted: {}, summary: "" };
      try { cls = (await classifyEvidence(base64, f.name, INDICATORS, () => cls)).data; } catch { /* nhập tay */ }
      await act("POST", `/v1/esg-assessments/${a.id}/evidence`, { id: `doc-${Date.now().toString(36)}`, name: f.name, mime: f.type || "application/octet-stream", docType: cls.docType, period: cls.period, indicatorCodes: cls.indicatorCodes, extracted: cls.extracted, extractionSummary: cls.summary, fileKey: stored.key });
    }, "Đã tải bằng chứng (lưu bất biến, SHA-256)");
  };

  const suggest = (def: EsgIndicatorDef) =>
    run(def.code, async () => {
      const ev = recent.filter((d) => d.indicatorCodes.includes(def.code)).map((d) => ({ id: d.id, name: d.name, docType: d.docType, summary: d.extractionSummary, extracted: d.extracted }));
      const p = (await proposeLevel(def, ev, ind(def.code).selfDeclared)).data;
      await act("PUT", `/v1/esg-assessments/${a.id}/indicators/${def.code}`, { aiLevel: p.level ?? undefined, aiRationale: p.rationale, aiCitations: p.citations, aiMissing: p.missing });
    }, "AI đã đề xuất (người thẩm định FCC sẽ xác nhận)");

  return (
    <>
      <Summary a={a} />
      <section className="card stack">
        <div className="between">
          <div><h2 className="ct">Bằng chứng</h2><p className="muted">Tài liệu trong 12 tháng gần nhất. AI phân loại và trích số liệu; không có trích dẫn thì AI không đề xuất mức ≥ 2.</p></div>
          <div>
            <input ref={fileRef} type="file" hidden accept="application/pdf,image/*,.xml,.csv,.xlsx" onChange={(e) => void upload(e.target.files)} />
            <button className="btn bp" disabled={busy === "upload"} onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden="true" /> {busy === "upload" ? "Đang xử lý…" : "Tải bằng chứng"}</button>
          </div>
        </div>
        {recent.length === 0 && <div className="muted">Chưa có bằng chứng. Tải hóa đơn điện, chứng nhận ISO, hợp đồng BHXH, biên bản xử lý chất thải…</div>}
        {recent.map((d) => (
          <div key={d.id} className="soft"><strong>{d.name}</strong> · {d.docType}{d.period ? ` · ${d.period}` : ""}<div className="muted">{d.extractionSummary || "Chưa phân loại — chọn chỉ tiêu liên quan bên dưới"} · chỉ tiêu: {d.indicatorCodes.join(", ") || "—"}</div></div>
        ))}
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">18 chỉ tiêu</h2><span className="muted">Mức 0–4 · “Chưa xác minh” không phải điểm 0</span></div>
        {INDICATORS.map((def) => {
          const i = ind(def.code);
          const n = recent.filter((d) => d.indicatorCodes.includes(def.code)).length;
          return (
            <div key={def.code} style={{ borderTop: "1px solid var(--line-2)", padding: "12px 16px" }} className="stack-sm">
              <div className="between" style={{ cursor: "pointer" }} onClick={() => setOpen(open === def.code ? null : def.code)}>
                <span><strong className="num">{def.code}</strong> {def.name}{def.criticalFlag && <span className="chip c-warn" style={{ marginLeft: 6 }}>trọng yếu</span>}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="muted">{n} bằng chứng</span>
                  {i.aiLevel !== undefined && <span className="chip c-ai">AI đề xuất {i.aiLevel}</span>}
                  <span className={`chip ${i.finalLevel === undefined ? "c-neu" : "c-ok"}`}>{i.na ? "Không áp dụng" : i.finalLevel === undefined ? "Chưa xác minh" : `Mức ${i.finalLevel}`}</span>
                </span>
              </div>
              {open === def.code && (
                <div className="stack-sm">
                  <div className="muted">Bằng chứng cần: {def.evidence}</div>
                  <ol className="muted" style={{ margin: 0, paddingLeft: 18 }}>{def.rubric.map((r, k) => <li key={k} value={k}>Mức {k}: {r}</li>)}</ol>
                  <label className="field"><span>Doanh nghiệp tự khai</span><textarea className="input" rows={2} defaultValue={i.selfDeclared ?? ""} onBlur={(e) => e.target.value !== (i.selfDeclared ?? "") && void run(def.code, () => act("PUT", `/v1/esg-assessments/${a.id}/indicators/${def.code}`, { selfDeclared: e.target.value }), "Đã lưu")} /></label>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <button className="btn bs sm" disabled={busy === def.code} onClick={() => void suggest(def)}><Sparkles size={14} aria-hidden="true" /> AI đề xuất mức</button>
                    <span className="muted">Đề xuất chỉ để tham khảo; mức chính thức do người thẩm định FCC xác nhận.</span>
                  </div>
                  {i.aiRationale && <div className="soft"><strong>AI:</strong> {i.aiLevel === undefined ? "Chưa đủ bằng chứng (Chưa xác minh)" : `đề xuất mức ${i.aiLevel}`} — {i.aiRationale}{i.aiCitations?.map((c) => <div key={c.documentId} className="muted">Trích dẫn [{recent.find((d) => d.id === c.documentId)?.name ?? c.documentId}]: {c.note}</div>)}{i.aiMissing?.length ? <div className="muted">Còn thiếu: {i.aiMissing.join("; ")}</div> : null}</div>}
                  {i.reviewerNote && <div className="okmsg">Người thẩm định: {i.reviewerNote}</div>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <IssueBars a={a} />
      <Disclaimer>Điểm ESG của FCC là đánh giá theo khung nội bộ, không phải chứng nhận hay công nhận “xanh”. Ưu đãi xanh chỉ áp dụng khi tổ chức tài chính cấu hình và hồ sơ đủ điều kiện.</Disclaimer>
    </>
  );
}

/** Nhân sự FCC: rà soát đề xuất AI, xác nhận mức từng chỉ tiêu (ghi lý do khi khác AI), phát hành điểm chính thức. */
export function EsgReview() {
  const { data, act } = useData();
  const toast = useToast();
  const list = data.esg.filter((e) => e.source === "assessed");
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const a = list.find((x) => x.id === sel) ?? list[0];
  const r = a ? computeEsg(a.indicators, a.industryGroup) : null;
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!list.length) return <section className="card empty">Chưa có doanh nghiệp nào khởi tạo hồ sơ ESG.</section>;
  return (
    <section className="row top">
      <div className="card flush grow-1" style={{ flexBasis: 280 }}>
        <div className="ch"><h2 className="ct">Hồ sơ ESG</h2></div>
        {list.map((e) => { const x = computeEsg(e.indicators, e.industryGroup); return (
          <button key={e.id} onClick={() => setSel(e.id)} className="soft" style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderTop: "1px solid var(--line-2)", cursor: "pointer", background: a?.id === e.id ? "var(--surface-3)" : undefined }}>
            <strong>{orgName(data.orgs, e.orgId)}</strong>
            <div className="muted">{dec(x.score, 0)}/100 · bao phủ {Math.round(x.coverage * 100)}% · {{ draft: "Nháp", in_review: "Đang rà soát", official: "Chính thức", provisional: "Tạm tính" }[e.status]}</div>
          </button>
        ); })}
      </div>
      {a && r && (
        <div className="stack grow-3" style={{ flexBasis: 520 }}>
          <Summary a={a} />
          <section className="card flush">
            <div className="ch"><h2 className="ct">Xác nhận chỉ tiêu · {orgName(data.orgs, a.orgId)}</h2>
              <button className="btn bp" disabled={busy || r.coverage < 0.8} title={r.coverage < 0.8 ? "Độ bao phủ dưới 80% — chưa phát hành chính thức" : undefined} onClick={() => run(() => act("POST", `/v1/esg-assessments/${a.id}/issue`, { official: true }), "Đã phát hành điểm ESG chính thức")}>Phát hành chính thức (cần MFA)</button></div>
            {a.status === "official" && <div className="okmsg" style={{ margin: "0 16px 8px" }}>Đã phát hành ngày {date(a.issuedAt)}, hiệu lực đến {date(a.validUntil)}.</div>}
            {INDICATORS.map((def) => {
              const i = a.indicators.find((x) => x.code === def.code) ?? { code: def.code };
              const docs = a.documents.filter((d) => d.indicatorCodes.includes(def.code));
              const note = notes[def.code] ?? i.reviewerNote ?? "";
              const setLevel = (lvl: IndicatorLevel) => {
                if (i.aiLevel !== undefined && lvl !== i.aiLevel && !note.trim()) return toast("Khác đề xuất AI: cần ghi lý do");
                void run(() => act("PUT", `/v1/esg-assessments/${a.id}/indicators/${def.code}`, { finalLevel: lvl, reviewerNote: note || undefined }), `${def.code}: mức ${lvl}`);
              };
              return (
                <div key={def.code} style={{ borderTop: "1px solid var(--line-2)", padding: "12px 16px" }} className="stack-sm">
                  <div className="between"><span><strong className="num">{def.code}</strong> {def.name}</span><span className={`chip ${i.finalLevel === undefined ? "c-neu" : "c-ok"}`}>{i.finalLevel === undefined ? "Chưa xác minh" : `Mức ${i.finalLevel}`}</span></div>
                  {i.selfDeclared && <div className="muted">Tự khai: {i.selfDeclared}</div>}
                  {i.aiRationale && <div className="soft">AI {i.aiLevel !== undefined ? `đề xuất ${i.aiLevel}` : "chưa đủ bằng chứng"}: {i.aiRationale}{i.aiCitations?.map((c) => <div key={c.documentId} className="muted">[{docs.find((d) => d.id === c.documentId)?.name ?? c.documentId}] {c.note}</div>)}</div>}
                  <div className="muted">{docs.length} bằng chứng liên quan{docs.map((d) => d.fileKey ? <button key={d.id} className="link-btn" style={{ marginLeft: 8 }} onClick={async () => { const u = await api<{ url: string }>("GET", `/api/files/${d.fileKey}/url`); window.open(u.url, "_blank"); }}>{d.name}</button> : null)}</div>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {[0, 1, 2, 3, 4].map((l) => <button key={l} className={`btn sm ${i.finalLevel === l ? "bp" : "bs"}`} disabled={busy} onClick={() => setLevel(l as IndicatorLevel)}>{l}</button>)}
                    <input className="input" style={{ flex: "1 1 220px" }} placeholder="Ghi chú thẩm định (bắt buộc khi khác AI)" value={note} onChange={(e) => setNotes({ ...notes, [def.code]: e.target.value })} />
                  </div>
                </div>
              );
            })}
          </section>
          <IssueBars a={a} />
        </div>
      )}
    </section>
  );
}

/** Bên mua / tổ chức tài chính: ESG của các doanh nghiệp đã đồng ý chia sẻ. */
export function EsgPortfolio({ kind }: { kind: "buyer" | "lender" }) {
  const { data, org } = useData();
  const rows = useMemo(() => {
    const related = new Set<string>();
    for (const r of data.receivables) {
      if (kind === "buyer" && r.buyerId === org.id) related.add(r.sellerId);
      if (kind === "lender" && data.applications.some((a) => a.lenderId === org.id && a.receivableId === r.id)) related.add(r.sellerId);
    }
    return data.esg.filter((e) => e.source === "assessed" && related.has(e.orgId)).map((e) => ({ e, r: computeEsg(e.indicators, e.industryGroup), official: esgOfficialScore(e) }));
  }, [data, org.id, kind]);
  const green = rows.filter((x) => x.official && x.official.score >= 65 && x.official.flags === 0);
  return (
    <>
      <section className="grid-kpi">
        <Kpi label="Doanh nghiệp chia sẻ ESG" value={String(rows.length)} note={kind === "buyer" ? "nhà cung cấp của bạn" : "doanh nghiệp trong hồ sơ của bạn"} />
        <Kpi label="Đạt ngưỡng xanh" value={`${green.length}/${rows.length}`} note="ESG chính thức ≥ 65, còn hiệu lực, không cờ trọng yếu" />
        <Kpi label="Có cờ trọng yếu" value={String(rows.filter((x) => x.r.flags.length).length)} tone={rows.some((x) => x.r.flags.length) ? "bad" : "ok"} />
      </section>
      <section className="card flush">
        <div className="ch"><h2 className="ct">ESG theo doanh nghiệp</h2></div>
        <div className="tw"><table>
          <thead><tr><th>Doanh nghiệp</th><th className="r">Điểm</th><th>Mức</th><th className="r">Bao phủ</th><th>Cờ</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {rows.map(({ e, r, official }) => <tr key={e.id}><td>{orgName(data.orgs, e.orgId)}</td><td className="r num strong">{dec(r.score, 1)}</td><td><span className={`chip ${LEVEL_CHIP(r.score)}`}>{r.level}</span></td><td className="r num">{Math.round(r.coverage * 100)}%</td><td>{r.flags.map((f) => f.code).join(", ") || "—"}</td><td>{official ? <span className="chip c-ok">Chính thức</span> : <span className="chip c-neu">Tạm tính</span>}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={6} className="empty">Chưa có doanh nghiệp nào chia sẻ ESG. Doanh nghiệp chia sẻ khi gửi yêu cầu báo giá hoặc hồ sơ tài trợ.</td></tr>}
          </tbody></table></div>
      </section>
      <Disclaimer>Chỉ hiển thị doanh nghiệp đã đồng ý chia sẻ. ESG là đầu vào bổ trợ, không thay thế phân tích dòng tiền và tín dụng.</Disclaimer>
    </>
  );
}
