import type { Metadata } from "next";
import { SettingsPanel } from "@/components/screens/SettingsPanel";

export const metadata: Metadata = { title: "Cài đặt" };

export default function Page() {
  return <SettingsPanel role="buyer" />;
}
