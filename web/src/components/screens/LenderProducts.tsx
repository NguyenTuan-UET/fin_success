"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { FinancingProduct, ProductType, Rating } from "@fcc/domain/types";
import { api } from "@/lib/api";
import { date, dec, vnd } from "@/lib/format";
import { PRODUCT_TYPE_LABEL } from "@/lib/model";
import { useData } from "@/lib/session";
import { Kpi } from "@/components/ui/basic";
import { useToast } from "@/components/providers/Toast";

const RATINGS: Rating[] = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"];
const STATUS: Record<FinancingProduct["status"], [string, string]> = {
  draft: ["Nháp", "c-neu"], pending_review: ["Chờ FCC duyệt", "c-warn"], published: ["Đang công bố", "c-ok"], paused: ["Tạm dừng", "c-neu"], expired: ["Hết hiệu lực", "c-bad"],
};
type Overview = { type: string; products: number; rateMin: number; rateMax: number; advanceAvgPct: number }[];

const blank = () => ({
  id: "", name: "", type: "factoring_recourse" as ProductType, description: "", minAmount: "100000000", maxAmount: "5000000000", maxTenorDays: "120",
  minApplicationRating: "" as Rating | "", advancePct: "80", rateMin: "8", rateMax: "12", feePct: "0.3", latePenaltyPct: "150",
  greenMinEsg: "", greenMinCoverage: "0.8", greenDiscount: "", reviewHours: "24", effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: `${new Date().getFullYear() + 1}-12-31`,
});

export function LenderProducts() {
  const { data, org, act } = useData();
  const toast = useToast();
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [overview, setOverview] = useState<Overview>([]);
  const [busy, setBusy] = useState(false);
  const mine = data.products.filter((p) => p.lenderId === org.id);

  useEffect(() => { api<Overview>("GET", "/v1/market-overview").then(setOverview, () => undefined); }, [data.products]);

  const edit = (p: FinancingProduct) =>
    setForm({
      id: p.id, name: p.name, type: p.type, description: p.description, minAmount: String(p.eligibility.minAmount), maxAmount: String(p.eligibility.maxAmount), maxTenorDays: String(p.eligibility.maxTenorDays),
      minApplicationRating: p.eligibility.minApplicationRating ?? "", advancePct: String(p.pricing.advancePct), rateMin: String(p.pricing.rateMin), rateMax: String(p.pricing.rateMax),
      feePct: String(p.pricing.fees.find((f) => f.kind === "pct")?.value ?? 0), latePenaltyPct: String(p.pricing.latePenaltyPct), greenMinEsg: String(p.greenRule?.minEsg ?? ""),
      greenMinCoverage: String(p.greenRule?.minCoverage ?? 0.8), greenDiscount: String(p.greenRule?.discountPct ?? ""), reviewHours: String(p.sla.reviewHours ?? ""), effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo,
    });

  const save = async (draft: boolean) => {
    if (!form) return;
    setBusy(true);
    try {
      const f = form;
      const body = {
        ...(f.id ? { id: f.id } : {}), name: f.name, type: f.type, description: f.description, status: draft ? "draft" : "pending_review",
        eligibility: { minAmount: Number(f.minAmount), maxAmount: Number(f.maxAmount), maxTenorDays: Number(f.maxTenorDays), requireBuyerConfirmation: true, ...(f.minApplicationRating ? { minApplicationRating: f.minApplicationRating } : {}) },
        pricing: { advancePct: Number(f.advancePct), rateMin: Number(f.rateMin), rateMax: Number(f.rateMax), fees: Number(f.feePct) > 0 ? [{ name: "Phí xử lý hồ sơ", kind: "pct", value: Number(f.feePct), upfront: true }] : [], latePenaltyPct: Number(f.latePenaltyPct) },
        ...(f.greenMinEsg && f.greenDiscount ? { greenRule: { minEsg: Number(f.greenMinEsg), minCoverage: Number(f.greenMinCoverage), discountPct: Number(f.greenDiscount) } } : {}),
        sla: { ...(f.reviewHours ? { reviewHours: Number(f.reviewHours) } : {}), quoteHours: 24 }, effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo,
      };
      await act("POST", "/v1/financing-products", body);
      toast(draft ? "Đã lưu nháp" : "Đã gửi FCC duyệt");
      setForm(null);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  const setStatus = async (p: FinancingProduct, status: string) => {
    try { await act("POST", `/v1/financing-products/${p.id}/status`, { status }); toast(status === "paused" ? "Đã tạm dừng" : "Đã mở lại"); } catch (e) { toast((e as Error).message); }
  };
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setForm((x) => (x ? { ...x, [k]: v } : x));
  const num = (k: keyof ReturnType<typeof blank>, label: string, extra = "") => <label className="field"><span>{label}</span><input className="input num" inputMode="decimal" value={form![k]} onChange={(e) => set(k, e.target.value.replace(",", "."))} placeholder={extra} /></label>;

  return (
    <>
      <section className="grid-kpi">
        <Kpi label="Sản phẩm của bạn" value={String(mine.length)} note={`${mine.filter((p) => p.status === "published").length} đang công bố`} />
        <Kpi label="Chờ FCC duyệt" value={String(mine.filter((p) => p.status === "pending_review").length)} />
        <Kpi label="Lãi suất sàn thấp nhất thị trường" value={overview.length ? `${dec(Math.min(...overview.map((o) => o.rateMin)))}%` : "—"} note={`${overview.reduce((a, o) => a + o.products, 0)} gói đang công bố`} />
      </section>

      <section className="card flush">
        <div className="ch">
          <h2 className="ct">Sản phẩm của bạn</h2>
          <button className="btn bp" disabled={!org.verified} title={org.verified ? undefined : "Cần FCC xác minh tổ chức trước"} onClick={() => setForm(blank())}><Plus size={16} aria-hidden="true" /> Tạo gói tài trợ</button>
        </div>
        {!org.verified && <div className="err" style={{ margin: "0 16px 12px" }}>Tổ chức chưa được FCC xác minh pháp nhân và giấy phép nên chưa đăng được sản phẩm.</div>}
        <div className="tw"><table>
          <thead><tr><th>Gói</th><th>Loại</th><th className="r">Ứng trước</th><th className="r">Lãi/năm</th><th className="r">Giá trị tài trợ (đ)</th><th>Hiệu lực</th><th>Phiên bản</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {mine.map((p) => (
              <tr key={p.id}>
                <td className="wrap strong">{p.name}</td><td>{PRODUCT_TYPE_LABEL[p.type]}</td>
                <td className="r num">{p.pricing.advancePct}%</td><td className="r num">{dec(p.pricing.rateMin)}–{dec(p.pricing.rateMax)}%</td>
                <td className="r num">{vnd(p.eligibility.minAmount)} – {vnd(p.eligibility.maxAmount)}</td>
                <td className="num">{date(p.effectiveFrom)} → {date(p.effectiveTo)}</td><td className="num">v{p.version}</td>
                <td><span className={`chip ${STATUS[p.status][1]}`}>{STATUS[p.status][0]}</span></td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn bs sm" onClick={() => edit(p)}>Sửa</button>
                  {p.status === "published" && <button className="btn bs sm" onClick={() => setStatus(p, "paused")}>Tạm dừng</button>}
                  {p.status === "paused" && <button className="btn bs sm" onClick={() => setStatus(p, "published")}>Mở lại</button>}
                </td>
              </tr>
            ))}
            {mine.length === 0 && <tr><td colSpan={9} className="empty">Chưa có sản phẩm. Tạo gói đầu tiên để doanh nghiệp thấy bạn trên Marketplace.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Mặt bằng thị trường</h2><span className="muted">Từ các gói đang công bố</span></div>
        <div className="tw"><table>
          <thead><tr><th>Loại</th><th className="r">Số gói</th><th className="r">Lãi/năm</th><th className="r">Ứng trước bình quân</th></tr></thead>
          <tbody>
            {overview.map((o) => <tr key={o.type}><td>{PRODUCT_TYPE_LABEL[o.type] ?? o.type}</td><td className="r num">{o.products}</td><td className="r num">{dec(o.rateMin)}–{dec(o.rateMax)}%</td><td className="r num">{dec(o.advanceAvgPct, 0)}%</td></tr>)}
            {overview.length === 0 && <tr><td colSpan={4} className="empty">Chưa có gói nào được công bố.</td></tr>}
          </tbody></table></div>
        <p className="muted" style={{ padding: "12px 16px" }}>Bạn không thấy báo giá riêng mà tổ chức khác gửi cho doanh nghiệp.</p>
      </section>

      {form && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div className="card modal wide">
            <h2 className="ct">{form.id ? "Sửa gói tài trợ" : "Tạo gói tài trợ"}</h2>
            <div className="grid-fields">
              <label className="field" style={{ gridColumn: "1 / -1" }}><span>Tên gói</span><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
              <label className="field"><span>Loại</span><select className="select" value={form.type} onChange={(e) => set("type", e.target.value)}>{Object.entries(PRODUCT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="field"><span>Hạng hồ sơ tối thiểu</span><select className="select" value={form.minApplicationRating} onChange={(e) => set("minApplicationRating", e.target.value)}><option value="">Không yêu cầu</option>{RATINGS.map((r) => <option key={r}>{r}</option>)}</select></label>
              {num("minAmount", "Giá trị tối thiểu (đ)")}{num("maxAmount", "Giá trị tối đa (đ)")}{num("maxTenorDays", "Kỳ hạn tối đa (ngày)")}{num("advancePct", "Ứng trước (%)")}
              {num("rateMin", "Lãi suất từ (%/năm)")}{num("rateMax", "Lãi suất đến (%/năm)")}{num("feePct", "Phí xử lý (% số tiền ứng)")}{num("latePenaltyPct", "Phạt quá hạn (% lãi)")}
              {num("greenMinEsg", "Ưu đãi xanh: ESG tối thiểu", "để trống nếu không có")}{num("greenDiscount", "Ưu đãi xanh: giảm lãi (điểm %)")}{num("reviewHours", "Cam kết thẩm định (giờ)")}
              <label className="field"><span>Hiệu lực từ</span><input className="input num" type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} /></label>
              <label className="field"><span>Đến</span><input className="input num" type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} /></label>
              <label className="field" style={{ gridColumn: "1 / -1" }}><span>Mô tả</span><textarea className="input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
            </div>
            <div className="muted">Ưu đãi xanh và cam kết thẩm định chỉ hiển thị khi bạn khai ở đây. Giá và điều kiện do bạn công bố; FCC chỉ kiểm tra trình bày.</div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn bs" onClick={() => setForm(null)}>Hủy</button>
              <button className="btn bs" disabled={busy || !form.name.trim()} onClick={() => save(true)}>Lưu nháp</button>
              <button className="btn bp" disabled={busy || !form.name.trim()} onClick={() => save(false)}>Gửi FCC duyệt</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function RateStrip() {
  return null;
}
