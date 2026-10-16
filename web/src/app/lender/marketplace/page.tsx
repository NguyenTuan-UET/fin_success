import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { LenderProducts } from "@/components/screens/LenderProducts";

export const metadata: Metadata = { title: "Marketplace tổ chức tài chính" };

export default function LenderMarketplace() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Tổ chức tài chính"
        title="Sản phẩm tài trợ & lãi suất thị trường"
        sub="Đăng và quản lý gói tài trợ của bạn, theo dõi mặt bằng lãi suất các gói đang công bố. Gói mới hoặc đã sửa cần FCC kiểm tra trình bày trước khi công bố."
      />
      <LenderProducts />
    </>
  );
}
