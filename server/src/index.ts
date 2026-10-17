import { resolve } from 'node:path'
import { buildApp } from './app'
import { ObjectStore } from './storage'

// FCC_ENV: dev (mặc định) | staging | production.
// dev: không đăng nhập, mỗi vai trò (/supplier, /buyer, /lender, /fcc) tự vào phiên của vai trò đó — ai vào được cổng là dùng
// được mọi vai trò, nên chỉ cho chạy trên localhost. staging/production: bắt buộc đăng nhập, tạo tài khoản FCC từ ADMIN_EMAIL/ADMIN_PASSWORD.
const env = process.env.FCC_ENV ?? 'dev'
if (!['dev', 'staging', 'production'].includes(env)) throw new Error(`FCC_ENV không hợp lệ: ${env}`)
const dev = env === 'dev'
const host = process.env.HOST ?? '127.0.0.1'
if (dev && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('FCC_ENV=dev không có đăng nhập nên chỉ được chạy trên localhost')

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
if (!dev && password && password.length < 12) throw new Error('ADMIN_PASSWORD tối thiểu 12 ký tự')

// dev mặc định dùng cụm PostgreSQL cục bộ do scripts/pg-local.sh dựng; staging/production bắt buộc đặt DATABASE_URL.
const dbUrl = process.env.DATABASE_URL ?? (dev ? `postgres://fcc@/fcc_prod?host=${resolve('data/pg-run')}&port=5433` : undefined)
if (!dbUrl) throw new Error('Thiếu DATABASE_URL')

const app = await buildApp({
  devAutologin: dev,
  dbUrl,
  // khóa mã hóa tệp và secret MFA: dev tự tạo ở data/data.key, staging/production bắt buộc FCC_DATA_KEY
  dataKey: ObjectStore.keyFor(dev, resolve('data')),
  filesDir: resolve(process.env.FILES_DIR ?? 'data/objects'),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  listedDir: resolve(process.env.LISTED_DIR ?? 'seed/listed'),
  admin: !dev && email && password ? { email, password } : undefined,
  ollamaKey: process.env.OLLAMA_API_KEY || undefined,
  ollamaBase: process.env.OLLAMA_BASE_URL || undefined,
  // dev: tắt (nhiều vai trò thử cùng một địa chỉ); staging/production: bật, chỉnh bằng RATE_LIMIT_PER_MIN / RATE_LIMIT_AUTH_PER_MIN
  rateLimit: dev ? false : { perMinute: Number(process.env.RATE_LIMIT_PER_MIN ?? 600), authPerMinute: Number(process.env.RATE_LIMIT_AUTH_PER_MIN ?? 30) },
  trustProxy: process.env.TRUST_PROXY === '1',
})
await app.sweep()
const port = Number(process.env.PORT ?? 8787)
await app.listen({ port, host })
