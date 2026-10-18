import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@/components/providers/Toast";
import { DialogProvider } from "@/components/providers/Dialog";
import { AssistantProvider } from "@/components/assistant/Assistant";
import { FccProvider } from "@/lib/session";
import { RegisterSW } from "@/components/providers/RegisterSW";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FCC · Fast Cash Connect",
    template: "%s · FCC Fast Cash Connect",
  },
  icons: { icon: "/icon.svg" },
  description:
    "Nền tảng quản lý vốn lưu động và tài trợ chuỗi cung ứng cho SME: đẩy nhanh thanh toán hóa đơn, kết nối đa tổ chức tài chính, chấm điểm 5C và ESG.",
};

export const viewport: Viewport = {
  themeColor: "#0E2A23",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${plexMono.variable}`}>
      <body>
        <RegisterSW />
        <ToastProvider>
          <DialogProvider>
            <FccProvider>
              <AssistantProvider>{children}</AssistantProvider>
            </FccProvider>
          </DialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
