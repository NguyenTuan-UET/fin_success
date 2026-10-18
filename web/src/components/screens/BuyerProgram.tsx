"use client";

import Link from "next/link";
import { dec, money, vnd } from "@/lib/format";
import { orgName, PRODUCT_TYPE_LABEL } from "@/lib/model";
import { useData } from "@/lib/session";
import { useScores } from "@/lib/scores";
import { Kpi } from "@/components/ui/basic";

export function BuyerProgram() {
  const { data, org } = useData();
  const scores = useScores(data);
  const mine = data.receivables.filter((r) => r.buyerId === org.id);
  const suppliers = [...new Set(mine.map((r) => r.sellerId))];
  const funded = data.applications.filter((a) => ["ACCEPTED", "FUNDED", "SETTLED"].includes(a.state) && mine.some((r) => r.id === a.receivableId));
  const fundedVnd = funded.reduce((a, x) => a + (x.fundedAmount ?? x.offer?.advanceVnd ?? 0), 0);
  const products = data.products.filter((p) => p.status === "published");
  const rating = scores.buyer(org.id);
  const rates = products.map((p) => p.pricing.rateMin);

  return (
    <>
      <section className="grid-kpi">
        <Kpi label="Xếp hạng của bạn (tham khảo)" value={!rating.official && rating.coverage < 0.5 ? "Chưa đủ dữ liệu" : rating.rating} note={rating.official ? "Điểm chính thức" : `Tạm tính, chỉ để tham khảo · độ bao phủ dữ liệu ${Math.round(rating.coverage * 100)}% (cần ≥ 50% để hiển thị hạng)`} />
        <Kpi label="Nhà cung cấp đã gửi hóa đơn" value={String(suppliers.length)} note={`${mine.length} hóa đơn tới bạn`} />
        <Kpi label="Đang được tài trợ" value={money(fundedVnd)} note={`${funded.length} hồ sơ đã chấp thuận/giải ngân`} />
        <Kpi label="Lãi suất sàn thấp nhất đang công bố" value={rates.length ? `${dec(Math.min(...rates))}%` : "—"} note={`${products.length} gói đang công bố`} />
      </section>
      <section className="card flush">
        <div className="ch"><h2 className="ct">Gói đang công bố trên Marketplace</h2></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm">
          <table>
            <thead><tr><th>Tổ chức</th><th>Gói</th><th>Loại</th><th className="r">Ứng trước</th><th className="r">Lãi/năm</th><th className="r">Hạn mức/hồ sơ</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{orgName(data.orgs, p.lenderId)}</td><td className="wrap">{p.name}</td><td>{PRODUCT_TYPE_LABEL[p.type]}</td>
                  <td className="r num">{p.pricing.advancePct}%</td><td className="r num">{dec(p.pricing.rateMin)}–{dec(p.pricing.rateMax)}%</td>
                  <td className="r num">{vnd(p.eligibility.minAmount)} – {vnd(p.eligibility.maxAmount)} đ</td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={6} className="empty">Chưa có tổ chức tài chính nào công bố gói.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ padding: "12px 16px", borderTop: "1px solid var(--line-2)" }}>Giá và điều kiện do tổ chức tài chính công bố; FCC không cam kết giá. Muốn nhà cung cấp hưởng lãi thấp hơn, hãy xác nhận hóa đơn nhanh và thanh toán đúng hạn — lịch sử đó được dùng để chấm điểm hồ sơ. <Link href="/buyer/invoices">Tới xác nhận hóa đơn</Link></p>
      </section>
    </>
  );
}
