import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { BuyerConfirm } from "@/components/screens/BuyerConfirm";

export const metadata: Metadata = { title: "Xác nhận hóa đơn" };

export default function BuyerInvoices() {
  return (
    <>
      <PageHeader
        eyebrow="Hóa đơn · Bên nhập khẩu"
        title="Xác nhận hóa đơn & thanh toán sớm"
        sub="Xác nhận khoản phải thu giúp đơn vị xuất khẩu tiếp cận vốn với chi phí thấp hơn dựa trên uy tín của bạn. Mỗi hóa đơn hiển thị chứng từ đơn vị xuất khẩu đã tải lên để bạn đối chiếu với đơn đặt hàng và chứng từ giao hàng của mình."
      />
      <BuyerConfirm />
    </>
  );
}
