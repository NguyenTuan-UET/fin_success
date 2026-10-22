import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FCC · Fast Cash Connect",
    short_name: "FCC",
    description: "Tài trợ chuỗi cung ứng, chấm điểm tín dụng và ESG cho doanh nghiệp xuất khẩu",
    start_url: "/",
    display: "standalone",
    background_color: "#0E2A23",
    theme_color: "#0E2A23",
    lang: "vi",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
