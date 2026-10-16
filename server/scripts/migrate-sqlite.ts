// Chuyển dữ liệu từ bản SQLite cũ (server/data/fcc.db) sang PostgreSQL. Chạy một lần:
//   npx tsx scripts/migrate-sqlite.ts [đường-dẫn-sqlite] [DATABASE_URL]
// SQLite chỉ được mở để đọc. Từ chối chạy nếu CSDL đích đã có dữ liệu nghiệp vụ hoặc người dùng.
import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'
import { Database, KEYS, type State } from '../src/state'

const src = resolve(process.argv[2] ?? 'data/fcc.db')
const url = process.argv[3] ?? process.env.DATABASE_URL ?? `postgres://fcc@/fcc?host=${resolve('data/pg-run')}&port=5433`

const lite = new DatabaseSync(src, { readOnly: true })
const pg = await Database.open(url)
const existing = await pg.load()
if (existing.orgs.length || (await pg.countUsers()) > 0) {
  console.error('CSDL đích đã có dữ liệu — dừng để tránh ghi đè.')
  process.exit(1)
}

const state = { ...existing } as unknown as Record<string, unknown[]>
for (const col of [...Object.keys(KEYS), 'audit']) {
  const rows = lite.prepare('SELECT json FROM docs WHERE col = ? ORDER BY pos').all(col) as { json: string }[]
  state[col] = rows.map((r) => JSON.parse(r.json))
}
await pg.save(state as unknown as State)

type U = { id: string; email: string; password_hash: string; org_id: string; name: string; title: string; role: string }
const users = lite.prepare('SELECT * FROM users').all() as U[]
for (const u of users) await pg.createUser({ id: u.id, email: u.email, passwordHash: u.password_hash, orgId: u.org_id, name: u.name, title: u.title, role: u.role })
const hooks = lite.prepare('SELECT org_id, secret FROM webhook_keys').all() as { org_id: string; secret: string }[]
for (const h of hooks) await pg.setWebhookSecret(h.org_id, h.secret)
const idem = lite.prepare('SELECT key, response FROM idempotency').all() as { key: string; response: string }[]
for (const i of idem) await pg.putIdempotent(i.key, i.response)
// phiên đăng nhập cũ không chuyển: người dùng đăng nhập lại

const counts = Object.fromEntries(Object.entries(state).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => [k, v.length]))
console.log('Đã chuyển:', { ...counts, users: users.length, webhookKeys: hooks.length, idempotency: idem.length })
console.log('Kiểm tra nhật ký:', await pg.verifyAudit())
lite.close()
await pg.close()
