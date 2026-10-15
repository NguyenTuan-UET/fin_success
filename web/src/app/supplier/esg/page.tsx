import type { Metadata } from "next";
import { EsgScore } from "@/components/screens/EsgScore";

export const metadata: Metadata = { title: "ESG và tài chính xanh" };

export default function SupplierEsg() {
  return (
    <EsgScore
      role="supplier"
      header={{
        eyebrow: "ESG & Tài chính xanh",
        title: "Điểm ESG · Vật liệu Sao Mai",
        sub: "18 chỉ tiêu chấm 0–4 theo minh chứng, gộp thành 6 vấn đề trọng yếu và áp trọng số theo nhóm ngành. Kỳ dữ liệu 10/2025 – 09/2026 · xác minh 12/10/2026.",
      }}
    />
  );
}
