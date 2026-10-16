import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { BuyerProgram } from "@/components/screens/BuyerProgram";

export const metadata: Metadata = { title: "Marketplace người mua" };

export default function BuyerMarketplace() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Người mua"
        title="Chương trình tài trợ cho nhà cung cấp"
        sub="Uy tín thanh toán của bạn giúp nhà cung cấp nhận tiền sớm với chi phí thấp hơn. Theo dõi các gói đang công bố và mức độ tham gia của chuỗi cung ứng."
      />
      <BuyerProgram />
    </>
  );
}
