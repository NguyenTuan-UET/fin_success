import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { EsgPortfolio } from "@/components/screens/EsgScore";

export const metadata: Metadata = { title: "ESG chuỗi cung ứng" };

export default function BuyerEsg() {
  return (
    <>
      <PageHeader eyebrow="ESG chuỗi cung ứng · Bên nhập khẩu" title="Đơn vị xuất khẩu của bạn bền vững đến đâu?" sub="Chỉ hiển thị ESG của đơn vị xuất khẩu đã đồng ý chia sẻ. Đơn vị xuất khẩu xanh = ESG chính thức ≥ 65, còn hiệu lực và không có cờ trọng yếu." />
      <EsgPortfolio kind="buyer" />
    </>
  );
}
