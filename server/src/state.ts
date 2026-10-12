import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { buildSeed, type SeedData } from '../../web/src/data/seed'
import type { AuditEvent } from '../../web/src/domain/types'

export interface State extends SeedData {
  audit: AuditEvent[]
}

/** Tên bộ sưu tập → trường khóa. Mỗi dòng lưu dạng JSON, giữ thứ tự mảng bằng cột pos. */
export const KEYS = {
  orgs: 'id', profiles: 'orgId', listed: 'orgId', receivables: 'id', products: 'id', rfqs: 'id', applications: 'id',
  earlyOffers: 'id', limits: 'id', esg: 'id', connections: 'orgId', ledger: 'id', sources: 'id', external: 'id',
  consents: 'id', notifications: 'id', audit: 'id',
} as const
export type CollectionName = keyof typeof KEYS
const NAMES = Object.keys(KEYS) as CollectionName[]

type Row = { id: string; pos: number; json: string }

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
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, org_id TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS otp (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, purpose TEXT NOT NULL, entity TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS idempotency (key TEXT PRIMARY KEY, response TEXT NOT NULL, created_at TEXT NOT NULL);
    `)
  }

  load(): State {
    const has = this.db.prepare('SELECT COUNT(*) AS n FROM docs').get() as { n: number }
    if (has.n === 0) {
      const fresh: State = { ...buildSeed(), audit: [] }
      this.save(fresh)
      return fresh
    }
    const state = { seededAt: (this.db.prepare("SELECT value FROM meta WHERE key='seededAt'").get() as { value: string } | undefined)?.value ?? '' } as Record<string, unknown>
    for (const col of NAMES) {
      const rows = this.db.prepare('SELECT id, pos, json FROM docs WHERE col = ? ORDER BY pos').all(col) as Row[]
      state[col] = rows.map((r) => {
        this.cache.set(`${col}:${r.id}`, `${r.pos}|${r.json}`)
        return JSON.parse(r.json)
      })
    }
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
      this.db.prepare("INSERT INTO meta (key, value) VALUES ('seededAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(state.seededAt)
      this.db.exec('COMMIT')
    } catch (e) {
      this.db.exec('ROLLBACK')
      this.cache.clear() // buộc ghi lại đầy đủ lần sau
      throw e
    }
  }

  reset(): State {
    this.db.exec('DELETE FROM docs; DELETE FROM meta;')
    this.cache.clear()
    return this.load()
  }

  // ---- phiên, OTP, idempotency ----
  createSession(token: string, orgId: string, role: string, ttlMs: number) {
    const now = Date.now()
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)').run(token, orgId, role, new Date(now).toISOString(), new Date(now + ttlMs).toISOString())
  }
  getSession(token: string) {
    const s = this.db.prepare('SELECT org_id AS orgId, role, expires_at AS expiresAt FROM sessions WHERE token = ?').get(token) as { orgId: string; role: string; expiresAt: string } | undefined
    return s && s.expiresAt > new Date().toISOString() ? s : undefined
  }
  deleteSession(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }
  createOtp(id: string, orgId: string, purpose: string, entity: string, codeHash: string, ttlMs: number) {
    this.db.prepare('INSERT INTO otp (id, org_id, purpose, entity, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, orgId, purpose, entity, codeHash, new Date(Date.now() + ttlMs).toISOString())
  }
  getOtp(id: string) {
    return this.db.prepare('SELECT id, org_id AS orgId, purpose, entity, code_hash AS codeHash, expires_at AS expiresAt, used, attempts FROM otp WHERE id = ?').get(id) as
      | { id: string; orgId: string; purpose: string; entity: string; codeHash: string; expiresAt: string; used: number; attempts: number }
      | undefined
  }
  bumpOtp(id: string, used: boolean) {
    this.db.prepare('UPDATE otp SET attempts = attempts + 1, used = ? WHERE id = ?').run(used ? 1 : 0, id)
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
