import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { InvoiceHeaderActions, InvoiceManager } from "@/components/screens/InvoiceManager";

export const metadata: Metadata = { title: "Quản lý hóa đơn" };

export default function SupplierInvoices() {
  return (
    <>
      <PageHeader
        eyebrow="Hóa đơn · Đơn vị xuất khẩu"
        title="Quản lý hóa đơn"
        sub="Theo dõi vòng đời từng hóa đơn từ phát hành đến thanh toán. Bấm vào một hóa đơn để xem chi tiết; AI đánh dấu hóa đơn nên ưu tiên tài trợ."
        actions={<InvoiceHeaderActions />}
      />
      <InvoiceManager />
    </>
  );
}
