import { resolve } from 'node:path'
import { buildApp } from './app'

const demo = process.env.DEMO_MODE !== 'false'
const secret = process.env.WEBHOOK_SECRET ?? 'change-me'
if (!demo && secret === 'change-me') throw new Error('Đặt WEBHOOK_SECRET khi chạy ngoài chế độ demo')

const app = buildApp({
  dbPath: resolve(process.env.DB_PATH ?? 'data/fcc.db'),
  demo,
  webhookSecret: secret,
  listedDir: resolve(process.env.LISTED_DIR ?? '../web/public/listed'),
  ollamaKey: process.env.OLLAMA_API_KEY || undefined,
  ollamaBase: process.env.OLLAMA_BASE_URL || undefined,
})
app.sweep()
const port = Number(process.env.PORT ?? 8787)
await app.listen({ port, host: '127.0.0.1' })
