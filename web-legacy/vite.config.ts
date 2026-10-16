import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

// Trình duyệt chỉ gọi /api/* ; Vite chuyển tiếp tới backend FCC (thư mục server/). Khóa API AI nằm ở backend, không ở đây.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const api: Record<string, ProxyOptions> = {
    '/api': { target: env.FCC_API_URL || 'http://127.0.0.1:8787', changeOrigin: true, timeout: 200_000, proxyTimeout: 200_000 },
  }
  return {
    plugins: [react(), tailwindcss()],
    // @fcc/domain nằm ở ../packages/domain (liên kết qua node_modules) nên cho phép Vite đọc thư mục cha
    server: { proxy: api, fs: { allow: ['..'] } },
    preview: { proxy: api },
  }
})
