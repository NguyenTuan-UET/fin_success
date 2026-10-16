import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { EsgPortfolio } from "@/components/screens/EsgScore";

export const metadata: Metadata = { title: "ESG danh mục" };

export default function LenderEsg() {
  return (
    <>
      <PageHeader eyebrow="ESG & Xanh · Tổ chức tài chính" title="ESG trong hồ sơ tài trợ" sub="ESG của doanh nghiệp trong hồ sơ bạn nhận, theo quyền chia sẻ. ESG là đầu vào bổ trợ, không thay thế phân tích dòng tiền." />
      <EsgPortfolio kind="lender" />
    </>
  );
}
