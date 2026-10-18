"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { classifyFunding, COLLATERAL_HAIRCUT, preliminaryValue, totalPreliminaryValue } from "@fcc/domain/collateral";
import type { CollateralItem, CreditProfile, FinancialYear } from "@fcc/domain/types";
import { api } from "@/lib/api";
import { date, dec, money, vnd } from "@/lib/format";
import { orgName, ratingTone } from "@/lib/model";
import { useData } from "@/lib/session";
import { useScores } from "@/lib/scores";
import { Bar, Disclaimer } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";

const FY_FIELDS: [keyof FinancialYear, string][] = [
  ["revenue", "Doanh thu"], ["netProfit", "Lợi nhuận sau thuế"], ["ebit", "EBIT"], ["interestExpense", "Chi phí lãi vay"], ["depreciation", "Khấu hao"],
  ["totalAssets", "Tổng tài sản"], ["currentAssets", "Tài sản ngắn hạn"], ["currentLiabilities", "Nợ ngắn hạn"], ["totalLiabilities", "Tổng nợ"], ["equity", "Vốn chủ sở hữu"],
  ["operatingCashFlow", "Dòng tiền kinh doanh"], ["debtService", "Nợ gốc + lãi phải trả trong năm"], ["cash", "Tiền"], ["inventory", "Hàng tồn kho"], ["receivables", "Phải thu"],
];

export function FundingRequest() {
  const { data, org, act } = useData();
  const toast = useToast();
  const scores = useScores(data);
  const profile = data.profiles.find((p) => p.orgId === org.id);
  const score = scores.supplier(org.id);
  const collateral = profile?.collateral ?? [];
  const [col, setCol] = useState({ kind: "realestate" as CollateralItem["kind"], description: "", declaredValue: "" });
  const [fy, setFy] = useState<Record<string, string>>({ year: String(new Date().getFullYear() - 1) });
  const [misc, setMisc] = useState({ cicGroup: String(profile?.cic?.worstDebtGroup ?? ""), cicLate: String(profile?.cic?.maxLateDays ?? ""), taxStatus: profile?.taxStatus ?? "", legalEvents: profile?.legalEvents ?? "", capitalNeed: String(profile?.capitalNeed ?? "") });
  const [busy, setBusy] = useState(false);

  type Saved = { id: string; status: string; rating: string; score: number; coverage: number; inputHash: string; scorecardVersionId: string; createdAt: string; validUntil?: string };
  const [saved, setSaved] = useState<Saved[]>([]);
  const loadSaved = useCallback(() => api<Saved[]>("GET", `/v1/organizations/${org.id}/credit-assessments`).then(setSaved, () => undefined), [org.id]);
   
  useEffect(() => { void loadSaved(); }, [loadSaved]);
  const [appealFor, setAppealFor] = useState<{ id: string; reason: string } | null>(null);

  const targets = data.receivables.filter((r) => r.sellerId === org.id && ["BUYER_CONFIRMED", "REJECTED"].includes(r.state));
  const [tid, setTid] = useState("");
  const t = targets.find((x) => x.id === tid) ?? targets[0];
  const app = t ? scores.application(t.id) : null;
  const cls = t && app ? classifyFunding({ applicationRating: app.rating, buyerRating: scores.buyer(t.buyerId).rating, collateralValue: totalPreliminaryValue(collateral), amount: t.amount }) : null;

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const saveCollateral = (items: CollateralItem[]) => act("POST", `/v1/organizations/${org.id}/credit-profile`, { collateral: items });

  return (
    <>
      <section className="row top">
        <div className="card grow-2 stack-sm">
          <div className="between">
            <h2 className="ct"><Term k="fiveC">Điểm nhà cung cấp (5C)</Term></h2>
            <span className={`chip ${ratingTone(score.rating)}`}>{score.rating} · {dec(score.score, 0)}/100{score.official ? "" : " · tạm tính"}</span>
          </div>
          <div className="muted">Độ bao phủ dữ liệu {Math.round(score.coverage * 100)}% · khoảng điểm {dec(score.min, 0)}–{dec(score.max, 0)}. Cần bao phủ đủ ngưỡng mới là điểm chính thức.</div>
          {score.components.map((c) => (
            <div key={c.key}>
              <div className="between"><span>{c.label} ({Math.round(c.weight * 100)}%)</span><strong>{c.score === null ? "Chưa xác minh" : dec(c.score, 0)}</strong></div>
              <Bar value={c.score ?? 0} />
            </div>
          ))}
          {score.flags.length > 0 && <div className="err">{score.flags.join("; ")}</div>}
          {score.missingMandatory.length > 0 && <div className="muted">Còn thiếu để tính đủ: {score.missingMandatory.join(", ")}</div>}
          <div className="stack-sm">
            {score.positives.slice(0, 3).map((f) => <div key={f.code} className="t-ok">＋ {f.name}: {f.raw}</div>)}
            {score.negatives.slice(0, 3).map((f) => <div key={f.code} className="t-bad">− {f.name}: {f.raw}</div>)}
          </div>
        </div>

        <div className="card grow-2 stack-sm">
          <h2 className="ct">Phân loại hồ sơ tài trợ</h2>
          {!t ? <div className="empty">Chưa có hóa đơn đã xác nhận để phân loại.</div> : (
            <>
              <label className="field"><span>Hóa đơn</span><select className="select" value={t.id} onChange={(e) => setTid(e.target.value)}>{targets.map((x) => <option key={x.id} value={x.id}>{x.code} · {orgName(data.orgs, x.buyerId)} · {money(x.amount)} đ</option>)}</select></label>
              {app && cls && (
                <>
                  <div className="between"><span>Điểm hồ sơ (tham khảo)</span><span className={`chip ${ratingTone(app.rating)}`}>{app.rating} · {dec(app.score, 0)}</span></div>
                  <div className="between"><span>Bên mua</span><span className={`chip ${ratingTone(scores.buyer(t.buyerId).rating)}`}>{scores.buyer(t.buyerId).rating}</span></div>
                  <div className={`soft ${cls.case === 3 ? "err" : "okmsg"}`}><strong>{cls.label}</strong>{cls.reasons.map((r) => <div key={r}>{r}</div>)}</div>
                  {!cls.suggestProducts && <div className="muted">FCC không gợi ý sản phẩm cho nhóm này. Bạn vẫn có thể bổ sung dữ liệu để cải thiện điểm.</div>}
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="card stack">
        <div className="between"><h2 className="ct">Kết quả chấm điểm đã lưu</h2>
          <button className="btn bp" disabled={busy} onClick={() => run(async () => { await api("POST", `/v1/organizations/${org.id}/credit-assessments`, {}); await loadSaved(); }, "Đã chấm điểm và lưu (bất biến)")}>Chấm điểm & lưu</button></div>
        <div className="muted">Mỗi kết quả lưu kèm phiên bản bộ chấm điểm và mã băm đầu vào; cùng dữ liệu thì cho cùng kết quả. Điểm chính thức do thẩm định viên FCC phát hành khi độ bao phủ đủ.</div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Ngày</th><th>Hạng</th><th className="r">Điểm</th><th className="r">Bao phủ</th><th>Phiên bản</th><th>Mã băm đầu vào</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {saved.map((a) => <tr key={a.id}><td className="num">{date(a.createdAt)}</td><td><span className={`chip ${ratingTone(a.rating)}`}>{a.rating}</span></td><td className="r num">{dec(a.score, 0)}</td><td className="r num">{Math.round(a.coverage * 100)}%</td><td className="num">{a.scorecardVersionId}</td><td className="num muted">{a.inputHash.slice(0, 10)}…</td>
              <td><span className={`chip ${a.status === "official" ? "c-ok" : a.status === "superseded" ? "c-neu" : "c-warn"}`}>{{ official: `Chính thức · đến ${date(a.validUntil)}`, provisional: "Tạm tính", superseded: "Đã thay thế" }[a.status]}</span></td>
              <td>{a.status !== "superseded" && <button className="btn bs sm" onClick={() => setAppealFor({ id: a.id, reason: "" })}>Yêu cầu xem xét lại</button>}</td></tr>)}
            {saved.length === 0 && <tr><td colSpan={8} className="empty">Chưa có kết quả nào được lưu.</td></tr>}
          </tbody></table></div>
        {appealFor && (
          <div className="stack-sm">
            <label className="field"><span>Lý do yêu cầu xem xét lại (tối thiểu 10 ký tự)</span><textarea className="input" rows={2} value={appealFor.reason} onChange={(e) => setAppealFor({ ...appealFor, reason: e.target.value })} /></label>
            <div className="row" style={{ gap: 8 }}><button className="btn bs" onClick={() => setAppealFor(null)}>Hủy</button><button className="btn bp" disabled={busy || appealFor.reason.trim().length < 10} onClick={() => run(async () => { await api("POST", `/v1/credit-assessments/${appealFor.id}/appeals`, { reason: appealFor.reason }); setAppealFor(null); }, "Đã gửi yêu cầu xem xét lại tới thẩm định viên FCC")}>Gửi</button></div>
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="between"><h2 className="ct"><Term k="tsbd">Tài sản bảo đảm</Term> (không bắt buộc)</h2><span className="muted">Cơ sở bảo đảm tham khảo: <strong className="num">{vnd(totalPreliminaryValue(collateral))} đ</strong></span></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Loại</th><th>Mô tả</th><th className="r">Giá trị khai báo (đ)</th><th className="r">Định giá sơ bộ (đ)</th><th></th></tr></thead>
          <tbody>
            {collateral.map((c) => <tr key={c.id}><td>{COLLATERAL_HAIRCUT[c.kind].label}<div className="muted">{COLLATERAL_HAIRCUT[c.kind].note}</div></td><td className="wrap">{c.description}</td><td className="r num">{vnd(c.declaredValue)}</td><td className="r num strong">{vnd(preliminaryValue(c))}</td>
              <td><button className="ibtn" aria-label="Xóa tài sản" onClick={() => run(() => saveCollateral(collateral.filter((x) => x.id !== c.id)), "Đã xóa tài sản")}><Trash2 size={15} aria-hidden="true" /></button></td></tr>)}
            {collateral.length === 0 && <tr><td colSpan={5} className="empty">Không có tài sản bảo đảm. Khoản phải thu chất lượng vẫn có thể được tài trợ (nhóm ii).</td></tr>}
          </tbody></table></div>
        <div className="grid-fields">
          <label className="field"><span>Loại</span><select className="select" value={col.kind} onChange={(e) => setCol({ ...col, kind: e.target.value as CollateralItem["kind"] })}>{Object.entries(COLLATERAL_HAIRCUT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label className="field"><span>Mô tả</span><input className="input" value={col.description} onChange={(e) => setCol({ ...col, description: e.target.value })} /></label>
          <label className="field"><span>Giá trị khai báo (đ)</span><input className="input num" inputMode="numeric" value={col.declaredValue} onChange={(e) => setCol({ ...col, declaredValue: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
        <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={busy || !col.description.trim() || !col.declaredValue} onClick={() => run(async () => { await saveCollateral([...collateral, { id: `col-${Date.now().toString(36)}`, kind: col.kind, description: col.description.trim(), declaredValue: Number(col.declaredValue) }]); setCol({ ...col, description: "", declaredValue: "" }); }, "Đã thêm tài sản")}>Thêm tài sản</button>
        <Disclaimer>Định giá sơ bộ theo hệ số chiết khấu công khai, chỉ để tham khảo — không có giá trị pháp lý. Tổ chức tài chính quyết định giá trị được công nhận và tự xử lý tài sản theo hợp đồng.</Disclaimer>
      </section>

      <section className="card stack">
        <h2 className="ct">Báo cáo tài chính (VND)</h2>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Năm</th><th className="r">Doanh thu</th><th className="r">Lợi nhuận</th><th className="r">Tổng tài sản</th><th className="r">Vốn chủ</th><th>Nguồn</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {(profile?.financials ?? []).map((f) => <tr key={f.year}><td className="num strong">{f.year}</td><td className="r num">{vnd(f.revenue)}</td><td className="r num">{vnd(f.netProfit)}</td><td className="r num">{vnd(f.totalAssets)}</td><td className="r num">{vnd(f.equity)}</td><td>{f.source}</td><td><span className="chip c-neu">{{ self_declared: "Tự khai", extracted: "AI trích xuất", verified: "Đã xác minh", public_reference: "Công bố tham khảo" }[f.status] ?? f.status}</span></td></tr>)}
            {!profile?.financials.length && <tr><td colSpan={7} className="empty">Chưa có BCTC. Khai ít nhất 2 năm để chấm 5C đầy đủ hơn.</td></tr>}
          </tbody></table></div>
        <div className="grid-fields">
          <label className="field"><span>Năm</span><input className="input num" inputMode="numeric" value={fy.year ?? ""} onChange={(e) => setFy({ ...fy, year: e.target.value.replace(/\D/g, "") })} /></label>
          {FY_FIELDS.map(([k, label]) => <label key={k} className="field"><span>{label}</span><input className="input num" inputMode="numeric" value={fy[k] ?? ""} onChange={(e) => setFy({ ...fy, [k]: e.target.value.replace(/[^\d-]/g, "") })} /></label>)}
        </div>
        <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={busy || !fy.year || !fy.revenue} onClick={() => run(async () => {
          const o = Object.fromEntries(FY_FIELDS.map(([k]) => [k, Number(fy[k] ?? 0)]));
          await act("POST", `/v1/organizations/${org.id}/financial-years`, { year: Number(fy.year), ...o, source: "Doanh nghiệp tự khai", status: "self_declared" });
        }, "Đã lưu BCTC (tự khai, chưa xác minh)")}>Lưu BCTC</button>
      </section>

      <section className="card stack">
        <h2 className="ct">Tín dụng, thuế, pháp lý & nhu cầu vốn</h2>
        <div className="muted">Báo cáo CIC do doanh nghiệp tự tra cứu và khai; FCC không truy cập CIC thay doanh nghiệp.</div>
        <div className="grid-fields">
          <label className="field"><span>Nhóm nợ CIC xấu nhất (1–5)</span><input className="input num" inputMode="numeric" value={misc.cicGroup} onChange={(e) => setMisc({ ...misc, cicGroup: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="field"><span>Số ngày trễ tối đa (CIC)</span><input className="input num" inputMode="numeric" value={misc.cicLate} onChange={(e) => setMisc({ ...misc, cicLate: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="field"><span>Tình trạng thuế</span><select className="select" value={misc.taxStatus} onChange={(e) => setMisc({ ...misc, taxStatus: e.target.value as typeof misc.taxStatus })}><option value="">Chưa khai</option><option value="active">Đang hoạt động, nộp đủ</option><option value="deferred">Có khoản nộp chậm/gia hạn</option><option value="enforced">Bị cưỡng chế</option><option value="ceased">Ngừng hoạt động</option></select></label>
          <label className="field"><span>Sự kiện pháp lý</span><select className="select" value={misc.legalEvents} onChange={(e) => setMisc({ ...misc, legalEvents: e.target.value as typeof misc.legalEvents })}><option value="">Chưa khai</option><option value="none">Không có</option><option value="minor_resolved">Nhỏ, đã giải quyết</option><option value="major">Nghiêm trọng</option></select></label>
          <label className="field"><span>Nhu cầu vốn (đ)</span><input className="input num" inputMode="numeric" value={misc.capitalNeed} onChange={(e) => setMisc({ ...misc, capitalNeed: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
        <button className="btn bp" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => run(() => {
          const patch: Partial<CreditProfile> = {};
          if (misc.cicGroup) patch.cic = { worstDebtGroup: Number(misc.cicGroup) as 1 | 2 | 3 | 4 | 5, maxLateDays: Number(misc.cicLate || 0), months: 24, source: "Doanh nghiệp tự khai" };
          if (misc.taxStatus) patch.taxStatus = misc.taxStatus as CreditProfile["taxStatus"];
          if (misc.legalEvents) patch.legalEvents = misc.legalEvents as CreditProfile["legalEvents"];
          if (misc.capitalNeed) patch.capitalNeed = Number(misc.capitalNeed);
          return act("POST", `/v1/organizations/${org.id}/credit-profile`, patch);
        }, "Đã lưu")}>Lưu</button>
      </section>
    </>
  );
}
