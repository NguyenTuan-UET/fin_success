import type { NextConfig } from "next";
import path from "node:path";

// Backend FCC (thư mục server/). Trình duyệt chỉ gọi /api và /v1 cùng nguồn; Next chuyển tiếp tới backend.
const API = process.env.FCC_API_URL ?? "http://127.0.0.1:8787";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // @fcc/domain nằm ở ../packages/domain (công thức chấm điểm, ESG, khớp sản phẩm dùng chung với server)
  transpilePackages: ["@fcc/domain"],
  turbopack: { root: path.resolve(process.cwd(), "..") },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      { source: "/v1/:path*", destination: `${API}/v1/:path*` },
    ];
  },
};

export default nextConfig;
