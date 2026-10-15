import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/basic";
import { InvoiceUpload } from "@/components/screens/InvoiceUpload";

export const metadata: Metadata = { title: "Tải hóa đơn OCR/AI" };

export default function UploadPage() {
  return (
    <>
      <PageHeader
        back={
          <Link href="/supplier/invoices" className="muted strong" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={15} aria-hidden="true" />
            Quản lý hóa đơn
          </Link>
        }
        title="Tải hóa đơn & nhận diện OCR/AI"
        sub="Hóa đơn điện tử được trích xuất tự động, đối chiếu với cơ quan thuế và hợp đồng, kiểm tra trùng lặp trước khi gửi người mua xác nhận."
      />
      <InvoiceUpload />
    </>
  );
}
