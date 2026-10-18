import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { BuyerConfirm } from "@/components/screens/BuyerConfirm";

export const metadata: Metadata = { title: "Xác nhận hóa đơn" };

export default function BuyerInvoices() {
  return (
    <>
      <PageHeader
        eyebrow="Hóa đơn · Người mua"
        title="Xác nhận hóa đơn & thanh toán sớm"
        sub="Xác nhận khoản phải thu giúp nhà cung cấp tiếp cận vốn với chi phí thấp hơn dựa trên uy tín của bạn. Mỗi hóa đơn hiển thị chứng từ nhà cung cấp đã tải lên để bạn đối chiếu với đơn mua hàng và biên bản giao nhận của mình."
      />
      <BuyerConfirm />
    </>
  );
}
