import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { EsgEditor } from "@/components/screens/EsgScore";

export const metadata: Metadata = { title: "ESG và tài chính xanh" };

export default function SupplierEsg() {
  return (
    <>
      <PageHeader eyebrow="ESG & Tài chính xanh" title="Điểm ESG của doanh nghiệp" sub="18 chỉ tiêu chấm 0–4 theo bằng chứng, gộp thành 6 vấn đề trọng yếu và áp trọng số theo nhóm ngành. Cần độ bao phủ ≥ 80% và người thẩm định FCC xác nhận mới có điểm chính thức." />
      <EsgEditor />
    </>
  );
}
