import type { Metadata } from "next";
import { Kpi, PageHeader, Bar } from "@/components/ui/basic";
import { MarketplaceCompare } from "@/components/screens/MarketplaceCompare";

export const metadata: Metadata = { title: "Marketplace người mua" };

export default function BuyerMarketplace() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Người mua"
        title="Tài trợ khoản phải trả & chương trình cho nhà cung cấp"
        sub="Dùng uy tín của Xây dựng Đông Á để nhà cung cấp nhận tiền sớm với chi phí thấp (reverse factoring), hoặc giãn kỳ thanh toán của chính bạn."
      />
      <section className="grid-kpi">
        <Kpi label="Hạn mức chương trình NCC" value="11,6 / 20 tỷ" note="Ngân hàng TMCP Thịnh An cấp cho chuỗi">
          <Bar value={58} />
        </Kpi>
        <Kpi label="Nhà cung cấp tham gia" value="9 / 14" note="5 NCC chưa tham gia" />
        <Kpi label="Lãi suất bình quân cho NCC" value="6,2%" note="thấp hơn 1,4 điểm % so với vay riêng lẻ" />
      </section>
      <MarketplaceCompare
        partyLabel="Nhà cung cấp"
        esgHref="/buyer/esg"
        esgOwner="Vật liệu Sao Mai"
        nextHref="/buyer"
        targets={[
          { id: "HD-0421", party: "Vật liệu Sao Mai", amount: 1_120_000_000, days: 102 },
          { id: "HD-2209", party: "Điện cơ Nam Việt", amount: 860_000_000, days: 56 },
        ]}
      />
    </>
  );
}
