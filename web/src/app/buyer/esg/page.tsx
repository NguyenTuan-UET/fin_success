import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { EsgPortfolio } from "@/components/screens/EsgScore";

export const metadata: Metadata = { title: "ESG chuỗi cung ứng" };

export default function BuyerEsg() {
  return (
    <>
      <PageHeader eyebrow="ESG chuỗi cung ứng · Người mua" title="Nhà cung cấp của bạn bền vững đến đâu?" sub="Chỉ hiển thị ESG của nhà cung cấp đã đồng ý chia sẻ. Nhà cung cấp xanh = ESG chính thức ≥ 65, còn hiệu lực và không có cờ trọng yếu." />
      <EsgPortfolio kind="buyer" />
    </>
  );
}
