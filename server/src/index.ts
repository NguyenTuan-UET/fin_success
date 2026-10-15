import { resolve } from 'node:path'
import { buildApp } from './app'

// Không có đăng nhập: mỗi vai trò (/supplier, /buyer, /lender, /fcc) tự vào phiên của vai trò đó.
// Ai truy cập được cổng này đều vào được mọi vai trò, nên chỉ cho chạy trên localhost.
const host = process.env.HOST ?? '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Máy chủ không có đăng nhập nên chỉ được chạy trên localhost')

const app = buildApp({
  devAutologin: true,
  dbPath: resolve(process.env.DB_PATH ?? 'data/fcc.db'),
  listedDir: resolve(process.env.LISTED_DIR ?? '../web-legacy/public/listed'),
  ollamaKey: process.env.OLLAMA_API_KEY || undefined,
  ollamaBase: process.env.OLLAMA_BASE_URL || undefined,
})
app.sweep()
const port = Number(process.env.PORT ?? 8787)
await app.listen({ port, host })
