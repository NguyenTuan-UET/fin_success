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
        sub="Tải XML, ảnh hoặc PDF hóa đơn: hệ thống đọc các trường để bạn kiểm tra lại, chặn hóa đơn trùng và lưu chứng từ gốc trước khi gửi người mua xác nhận. Đối chiếu tự động với cơ quan thuế chưa bật."
      />
      <InvoiceUpload />
    </>
  );
}
