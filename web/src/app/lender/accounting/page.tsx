import type { Metadata } from "next";
import { Accounting } from "@/components/screens/Accounting";

export const metadata: Metadata = { title: "Dữ liệu kế toán được chia sẻ" };

export default function Page() {
  return <Accounting role="lender" />;
}
