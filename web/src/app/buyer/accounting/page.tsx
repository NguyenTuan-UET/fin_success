import type { Metadata } from "next";
import { Accounting } from "@/components/screens/Accounting";

export const metadata: Metadata = { title: "Kế toán" };

export default function Page() {
  return <Accounting role="buyer" />;
}
