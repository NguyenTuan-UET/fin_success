"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import { useData } from "@/lib/session";
import { PageHeader } from "@/components/ui/basic";
import { useToast } from "@/components/providers/Toast";

type Rev = { bySource: { source: string; label: string; total: number; count: number; paid: number }[]; total: number; paid: number };
type Schedule = { id: string; name: string; params: Record<string, unknown>; effectiveFrom: string };
type FeeForm = { name: string; transactionPct: string; supplier: string; buyer: string; lender: string; scoringFee: string; apiMonthlyPerKey: string; reportFee: string; referralPctOfFees: string; effectiveFrom: string };

export default function AdminRevenue() {
  const { act } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState<Rev | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [feeForm, setFeeForm] = useState<FeeForm | null>(null);
  const load = useCallback(async () => {
    setRev(await api<Rev>("GET", "/v1/operations/revenue").catch(() => null));
    setSchedules(await api<Schedule[]>("GET", "/v1/operations/fee-schedules").catch(() => []));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <PageHeader eyebrow="Quản trị FCC" title="Doanh thu & biểu phí" sub="Phí dịch vụ công nghệ FCC đã phát sinh và đã thu. Vốn tài trợ cho doanh nghiệp do tổ chức tài chính cấp, không phải doanh thu của FCC." />
      <section className="card flush">
        <div className="ch"><h2 className="ct">Doanh thu theo nguồn</h2>
          <span className="row" style={{ gap: 8 }}>
            <button className="btn bs sm" disabled={busy} onClick={() => run(async () => { const r = await act<{ created: number }>("POST", "/v1/operations/billing-run", { period: new Date().toISOString().slice(0, 7) }); await load(); toast(`Đã tính phí định kỳ: ${r.created} khoản mới`); }, "Hoàn tất")}>Chạy tính phí tháng này</button>
            <button className="btn bs sm" onClick={() => setFeeForm({ name: "Biểu phí mới", transactionPct: "0.3", supplier: "0", buyer: "0", lender: "0", scoringFee: "0", apiMonthlyPerKey: "0", reportFee: "0", referralPctOfFees: "0", effectiveFrom: new Date().toISOString().slice(0, 10) })}>Tạo biểu phí mới</button>
          </span></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Nguồn thu</th><th className="r">Số khoản</th><th className="r">Phát sinh (đ)</th><th className="r">Đã thu (đ)</th></tr></thead>
          <tbody>
            {rev?.bySource.map((x) => <tr key={x.source}><td>{x.label}</td><td className="r num">{x.count}</td><td className="r num">{x.total.toLocaleString("vi-VN")}</td><td className="r num">{x.paid.toLocaleString("vi-VN")}</td></tr>)}
            <tr><th>Tổng</th><th></th><th className="r num">{(rev?.total ?? 0).toLocaleString("vi-VN")}</th><th className="r num">{(rev?.paid ?? 0).toLocaleString("vi-VN")}</th></tr>
          </tbody></table></div>
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Phiên bản biểu phí</h2><span className="muted">Phiên bản cũ không đổi phí đã phát sinh</span></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Tên</th><th>Hiệu lực từ</th><th className="r">Phí giao dịch</th></tr></thead>
          <tbody>
            {schedules.map((s, i) => <tr key={s.id}><td>{s.name}{i === 0 && <span className="chip c-ok" style={{ marginLeft: 6 }}>Đang dùng</span>}</td><td>{date(s.effectiveFrom)}</td><td className="r num">{String(s.params.transactionPct ?? "—")}%</td></tr>)}
            {schedules.length === 0 && <tr><td colSpan={3} className="empty">Chưa có biểu phí.</td></tr>}
          </tbody></table></div>
      </section>

      {feeForm && (
        <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="fee-title">
          <div className="card modal wide">
            <h2 className="ct" id="fee-title">Biểu phí mới</h2>
            <div className="grid-fields">
              {([["name", "Tên"], ["transactionPct", "Phí giao dịch (% số tiền ứng)"], ["supplier", "SaaS nhà cung cấp (đ/tháng)"], ["buyer", "SaaS bên mua (đ/tháng)"], ["lender", "SaaS tổ chức tài chính (đ/tháng)"], ["scoringFee", "Phí chấm điểm chính thức (đ)"], ["apiMonthlyPerKey", "Phí API (đ/khóa/tháng)"], ["reportFee", "Phí xuất báo cáo (đ/lần)"], ["referralPctOfFees", "Hoa hồng (% phí xử lý)"]] as const).map(([k, label]) => (
                <label key={k} className="field"><span>{label}</span><input className="input" value={feeForm[k]} onChange={(e) => setFeeForm({ ...feeForm, [k]: e.target.value })} /></label>
              ))}
              <label className="field"><span>Hiệu lực từ</span><input className="input num" type="date" value={feeForm.effectiveFrom} onChange={(e) => setFeeForm({ ...feeForm, effectiveFrom: e.target.value })} /></label>
            </div>
            <div className="muted">Biểu phí mới chỉ áp dụng cho phí phát sinh từ ngày hiệu lực; cần MFA. Hoa hồng không được dùng để sắp xếp thứ tự gợi ý gói tài trợ.</div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn bs" onClick={() => setFeeForm(null)}>Hủy</button>
              <button className="btn bp" disabled={busy} onClick={() => run(async () => { const f = feeForm; await act("POST", "/v1/operations/fee-schedules", { name: f.name, effectiveFrom: f.effectiveFrom, params: { transactionPct: Number(f.transactionPct), saasMonthly: { supplier: Number(f.supplier), buyer: Number(f.buyer), lender: Number(f.lender) }, scoringFee: Number(f.scoringFee), apiMonthlyPerKey: Number(f.apiMonthlyPerKey), reportFee: Number(f.reportFee), referralPctOfFees: Number(f.referralPctOfFees) } }); setFeeForm(null); await load(); }, "Đã tạo biểu phí")}>Tạo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
