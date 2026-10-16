import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { FundingRequest } from "@/components/screens/FundingRequest";

export const metadata: Metadata = { title: "Hồ sơ tài trợ" };

export default function FundingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Hồ sơ tài trợ"
        title="Hồ sơ tín dụng & tài sản bảo đảm"
        sub="Tài sản bảo đảm là lớp bổ sung, không phải điều kiện duy nhất. FCC chấm điểm theo mô hình 5C kết hợp chất lượng khoản phải thu và uy tín người mua. Thiếu dữ liệu hiển thị “Chưa xác minh”, không phải điểm 0."
      />
      <FundingRequest />
    </>
  );
}
