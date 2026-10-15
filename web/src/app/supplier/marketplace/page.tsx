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
        sub="6 tổ chức tài chính đang chào gói phù hợp với hồ sơ của bạn. Chọn hóa đơn, FCC tính ngay số tiền thực nhận và tổng chi phí của từng gói."
        actions={
          <Link className="btn bs" href="/supplier/funding">
            Xem lại hồ sơ tài trợ
          </Link>
        }
      />
      <MarketplaceCompare
        partyLabel="Người mua"
        nextHref="/supplier/disbursement"
        targets={[
          { id: "HD-0418", party: "Xây dựng Đông Á", amount: 2_000_000_000, days: 90 },
          { id: "HD-0412", party: "Kết cấu Thép Miền Trung", amount: 860_000_000, days: 51 },
          { id: "HD-0410", party: "Hạ tầng Bình Minh", amount: 395_000_000, days: 77 },
        ]}
      />
    </>
  );
}
