import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { Disbursement } from "@/components/screens/Disbursement";

export const metadata: Metadata = { title: "Giải ngân và thu hồi" };

export default function DisbursementPage() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Giải ngân & thu hồi"
        title="Hồ sơ tài trợ & giải ngân"
        sub="Theo dõi vòng đời từng khoản tài trợ, chấp thuận đề nghị và xem tiền sẽ được phân bổ thế nào khi bên nhập khẩu thanh toán. Nguồn trả nợ đầu tiên là khoản thanh toán của bên nhập khẩu."
      />
      <Disbursement />
    </>
  );
}
