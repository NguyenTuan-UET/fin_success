import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/basic";
import { Stepper } from "@/components/ui/Stepper";
import { FundingRequest } from "@/components/screens/FundingRequest";

export const metadata: Metadata = { title: "Hồ sơ tài trợ" };

export default function FundingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Marketplace · Hồ sơ tài trợ"
        title="Hồ sơ tài trợ HD-0418"
        sub="Tài sản bảo đảm là lớp bổ sung, không phải điều kiện duy nhất. FCC chấm điểm theo mô hình 5C kết hợp chất lượng khoản phải thu và uy tín người mua."
        actions={<span className="chip c-info lg">Lưu tự động · 23:48</span>}
      />
      <Stepper
        label="Tiến trình hồ sơ"
        steps={[
          { title: "Hồ sơ & hóa đơn", note: "Đã xác thực", state: "done" },
          { title: "Tài sản bảo đảm", note: "Không bắt buộc", state: "done" },
          { title: "AI Credit Scoring", note: "Đang xem kết quả", state: "cur" },
          { title: "Chọn nguồn vốn", note: "Marketplace · giải ngân", state: "todo" },
        ]}
      />
      <FundingRequest />
    </>
  );
}
