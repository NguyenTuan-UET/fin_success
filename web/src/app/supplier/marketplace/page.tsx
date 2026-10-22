import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/basic";
import { MarketplaceCompare } from "@/components/screens/MarketplaceCompare";

export const metadata: Metadata = { title: "Marketplace tài chính" };

export default function SupplierMarketplace() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace tài chính"
        title="So sánh gói tài trợ"
        sub="Các gói do tổ chức tài chính công bố. Chọn hóa đơn đã được bên nhập khẩu xác nhận, FCC tính ngay số tiền thực nhận và tổng chi phí ước tính của từng gói."
        actions={
          <Link className="btn bs" href="/supplier/funding">
            Xem lại hồ sơ tài trợ
          </Link>
        }
      />
      <MarketplaceCompare />
    </>
  );
}
