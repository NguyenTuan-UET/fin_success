// Kiểm tra một CSDL FCC: số bản ghi theo bộ sưu tập, số người dùng, chuỗi băm nhật ký. Thoát mã 2 nếu nhật ký bị sửa.
//   npx tsx scripts/verify-db.ts [DATABASE_URL]
import { resolve } from 'node:path'
import { Database } from '../src/state'

const url = process.argv[2] ?? process.env.DATABASE_URL ?? `postgres://fcc@/fcc?host=${resolve('data/pg-run')}&port=5433`
const db = await Database.open(url)
const s = await db.load()
const counts = Object.fromEntries(Object.entries(s).filter(([k, v]) => k !== 'sources' && Array.isArray(v) && v.length).map(([k, v]) => [k, (v as unknown[]).length]))
console.log('Bản ghi:', counts, '· người dùng:', await db.countUsers())
const v = await db.verifyAudit()
console.log('Chuỗi băm nhật ký:', v.ok ? 'hợp lệ' : `SAI tại seq ${v.badSeq}`, `(${v.count} sự kiện, hash cuối ${v.lastHash.slice(0, 16)}…)`)
await db.close()
if (!v.ok) process.exit(2)
