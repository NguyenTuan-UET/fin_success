import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { LenderMonitoring } from "@/components/screens/LenderMonitoring";

export const metadata: Metadata = { title: "Giám sát và EWS" };

export default function MonitoringPage() {
  return (
    <>
      <PageHeader
        eyebrow="Giám sát danh mục · EWS"
        title="Cảnh báo sớm & xử lý quá hạn"
        sub="Hệ thống theo dõi tình trạng hóa đơn, lịch sử thanh toán của bên nhập khẩu và mức tập trung rủi ro sau giải ngân. Cảnh báo theo luật, có giải thích và đề xuất — bạn quyết định biện pháp."
      />
      <LenderMonitoring />
    </>
  );
}
