import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { BuyerProgram } from "@/components/screens/BuyerProgram";

export const metadata: Metadata = { title: "Marketplace bên nhập khẩu" };

export default function BuyerMarketplace() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Bên nhập khẩu"
        title="Chương trình tài trợ cho đơn vị xuất khẩu"
        sub="Uy tín thanh toán của bạn giúp đơn vị xuất khẩu nhận tiền sớm với chi phí thấp hơn. Theo dõi các gói đang công bố và mức độ tham gia của chuỗi cung ứng."
      />
      <BuyerProgram />
    </>
  );
}
