import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { LenderAppraisal } from "@/components/screens/LenderAppraisal";

export const metadata: Metadata = { title: "Thẩm định hồ sơ" };

export default function AppraisalPage() {
  return (
    <>
      <PageHeader
        eyebrow="Hóa đơn & thẩm định · Tổ chức tài chính"
        title="Thẩm định hồ sơ tài trợ"
        sub="Hồ sơ tín dụng số: điểm 5C, chất lượng khoản phải thu, uy tín bên nhập khẩu và điểm ESG. Mỗi điểm đều có lý do và độ bao phủ dữ liệu để bạn quyết định nhanh hơn."
      />
      <LenderAppraisal />
    </>
  );
}
