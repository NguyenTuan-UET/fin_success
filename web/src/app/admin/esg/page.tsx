import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { EsgReview } from "@/components/screens/EsgScore";

export const metadata: Metadata = { title: "Thẩm định ESG" };

export default function AdminEsg() {
  return (
    <>
      <PageHeader eyebrow="Quản trị FCC · ESG" title="Thẩm định điểm ESG" sub="Rà soát đề xuất AI và bằng chứng, xác nhận mức từng chỉ tiêu, phát hành điểm chính thức khi độ bao phủ ≥ 80% và đã xử lý cờ trọng yếu." />
      <EsgReview />
    </>
  );
}
