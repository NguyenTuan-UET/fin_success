import { resolve } from 'node:path'
import { buildApp } from './app'

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
if (password && password.length < 12) throw new Error('ADMIN_PASSWORD tối thiểu 12 ký tự')

const dev = process.env.DEV_AUTOLOGIN === 'true'
const host = process.env.HOST ?? '127.0.0.1'
if (dev && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('DEV_AUTOLOGIN chỉ được bật khi chạy trên localhost')
if (dev) console.warn('⚠ DEV_AUTOLOGIN bật: ai truy cập được cổng này đều vào được tài khoản dev. Chỉ dùng khi phát triển.')

const app = buildApp({
  devAutologin: dev,
  dbPath: resolve(process.env.DB_PATH ?? 'data/fcc.db'),
  listedDir: resolve(process.env.LISTED_DIR ?? '../web-legacy/public/listed'),
  admin: email && password ? { email, password } : undefined,
  ollamaKey: process.env.OLLAMA_API_KEY || undefined,
  ollamaBase: process.env.OLLAMA_BASE_URL || undefined,
})
app.sweep()
const port = Number(process.env.PORT ?? 8787)
await app.listen({ port, host })
