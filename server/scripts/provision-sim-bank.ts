// Cấp phát 3 tổ chức tài chính giả lập trên CSDL FCC và ghi cấu hình cho sim-bank.
//   npx tsx scripts/provision-sim-bank.ts [--endpoint http://127.0.0.1:8790] [--out ../sim-bank/config.local.json]
// Tệp cấu hình chứa khóa tích hợp và khóa ký — đã gitignore, không chia sẻ.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Database } from '../src/state'
import { ObjectStore } from '../src/storage'
import { createCore } from '../src/core'
import { provisionSimBanks } from '../src/sim/provision'

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : d
}
const endpoint = arg('--endpoint', 'http://127.0.0.1:8790')
const outPath = resolve(arg('--out', '../sim-bank/config.local.json'))
const dev = (process.env.FCC_ENV ?? 'dev') === 'dev'
const url = process.env.DATABASE_URL ?? `postgres://fcc@/fcc_prod?host=${resolve('data/pg-run')}&port=5433`
const dataKey = ObjectStore.keyFor(dev, resolve('data'))

const db = await Database.open(url)
const core = createCore(db, new ObjectStore(resolve('data/objects'), dataKey), Buffer.from(dataKey, 'hex'), await db.load(), { listedDir: '', appUrl: '' })
const institutions = await provisionSimBanks(core, endpoint)
writeFileSync(outPath, JSON.stringify({ fccApiUrl: process.env.FCC_API_URL ?? 'http://127.0.0.1:8787', listen: endpoint, institutions }, null, 2), { mode: 0o600 })
console.log(`Đã cấp phát ${institutions.length} tổ chức giả lập: ${institutions.map((i) => i.name).join(', ')}`)
console.log(`Cấu hình sim-bank: ${outPath}`)
console.log('Lưu ý: nếu máy chủ FCC đang chạy, khởi động lại để nạp tổ chức mới.')
await db.close()
