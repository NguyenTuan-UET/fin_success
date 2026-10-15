import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { SOURCES } from './reference'
import type { AppData, AuditEvent } from '../../web-legacy/src/domain/types'

export interface State extends AppData {
  audit: AuditEvent[]
}

/** Tên bộ sưu tập → trường khóa. Mỗi dòng lưu dạng JSON, giữ thứ tự mảng bằng cột pos. */
export const KEYS = {
  orgs: 'id', profiles: 'orgId', listed: 'orgId', receivables: 'id', products: 'id', rfqs: 'id', applications: 'id',
  earlyOffers: 'id', limits: 'id', esg: 'id', connections: 'orgId', ledger: 'id', external: 'id',
  consents: 'id', notifications: 'id', audit: 'id',
} as const
export type CollectionName = keyof typeof KEYS
const NAMES = Object.keys(KEYS) as CollectionName[]

type Row = { id: string; pos: number; json: string }
export interface UserRow { id: string; email: string; passwordHash: string; orgId: string; name: string; title: string; role: string }

export class Database {
  private db: DatabaseSync
  private cache = new Map<string, string>() // `${col}:${id}` -> `${pos}|${json}`

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, pos INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY (col, id));
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, org_id TEXT NOT NULL, name TEXT NOT NULL, title TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS webhook_keys (org_id TEXT PRIMARY KEY, secret TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS idempotency (key TEXT PRIMARY KEY, response TEXT NOT NULL, created_at TEXT NOT NULL);
    `)
  }

  load(): State {
    const state = {} as Record<string, unknown>
    for (const col of NAMES) {
      const rows = this.db.prepare('SELECT id, pos, json FROM docs WHERE col = ? ORDER BY pos').all(col) as Row[]
      state[col] = rows.map((r) => {
        this.cache.set(`${col}:${r.id}`, `${r.pos}|${r.json}`)
        return JSON.parse(r.json)
      })
    }
    state.sources = SOURCES
    return state as unknown as State
  }

  /** Ghi các dòng thay đổi trong một giao dịch (so với lần ghi trước). */
  save(state: State) {
    const up = this.db.prepare('INSERT INTO docs (col, id, pos, json) VALUES (?, ?, ?, ?) ON CONFLICT(col, id) DO UPDATE SET pos = excluded.pos, json = excluded.json')
    const del = this.db.prepare('DELETE FROM docs WHERE col = ? AND id = ?')
    this.db.exec('BEGIN')
    try {
      const seen = new Set<string>()
      for (const col of NAMES) {
        const key = KEYS[col]
        ;(state[col] as unknown as Record<string, unknown>[]).forEach((item, pos) => {
          const id = String(item[key])
          const ck = `${col}:${id}`
          const sig = `${pos}|${JSON.stringify(item)}`
          seen.add(ck)
          if (this.cache.get(ck) !== sig) {
            up.run(col, id, pos, sig.slice(sig.indexOf('|') + 1))
            this.cache.set(ck, sig)
          }
        })
      }
      for (const ck of [...this.cache.keys()]) {
        if (!seen.has(ck)) {
          const i = ck.indexOf(':')
          del.run(ck.slice(0, i), ck.slice(i + 1))
          this.cache.delete(ck)
        }
      }
      this.db.exec('COMMIT')
    } catch (e) {
      this.db.exec('ROLLBACK')
      this.cache.clear() // buộc ghi lại đầy đủ lần sau
      throw e
    }
  }

  // ---- người dùng, phiên, khóa webhook ----
  createUser(u: { id: string; email: string; passwordHash: string; orgId: string; name: string; title: string; role: string }) {
    this.db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(u.id, u.email, u.passwordHash, u.orgId, u.name, u.title, u.role, new Date().toISOString())
  }
  userByEmail(email: string) {
    return this.db.prepare('SELECT id, email, password_hash AS passwordHash, org_id AS orgId, name, title, role FROM users WHERE email = ?').get(email) as UserRow | undefined
  }
  userById(id: string) {
    return this.db.prepare('SELECT id, email, password_hash AS passwordHash, org_id AS orgId, name, title, role FROM users WHERE id = ?').get(id) as UserRow | undefined
  }
  countUsers() {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  }
  createSession(tokenHash: string, userId: string, ttlMs: number) {
    const now = Date.now()
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(tokenHash, userId, new Date(now).toISOString(), new Date(now + ttlMs).toISOString())
  }
  sessionUser(tokenHash: string) {
    return this.db
      .prepare('SELECT u.id, u.email, u.org_id AS orgId, u.name, u.title, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
      .get(tokenHash, new Date().toISOString()) as Omit<UserRow, 'passwordHash'> | undefined
  }
  deleteSession(tokenHash: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
  }
  purgeSessions() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString())
  }
  getWebhookSecret(orgId: string) {
    return (this.db.prepare('SELECT secret FROM webhook_keys WHERE org_id = ?').get(orgId) as { secret: string } | undefined)?.secret
  }
  setWebhookSecret(orgId: string, secret: string) {
    this.db.prepare('INSERT INTO webhook_keys VALUES (?, ?, ?) ON CONFLICT(org_id) DO UPDATE SET secret = excluded.secret, created_at = excluded.created_at').run(orgId, secret, new Date().toISOString())
  }
  getIdempotent(key: string) {
    return (this.db.prepare('SELECT response FROM idempotency WHERE key = ?').get(key) as { response: string } | undefined)?.response
  }
  putIdempotent(key: string, response: string) {
    this.db.prepare('INSERT OR IGNORE INTO idempotency VALUES (?, ?, ?)').run(key, response, new Date().toISOString())
  }
  close() {
    this.db.close()
  }
}
