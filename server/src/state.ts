import pg from 'pg'
import { createHash } from 'node:crypto'
import { SOURCES } from './reference'
import type { AppData, AuditEvent } from '@fcc/domain/types'

export interface State extends AppData {
  audit: AuditEvent[]
}

/** Tên bộ sưu tập → trường khóa. Mỗi dòng lưu dạng JSONB, giữ thứ tự mảng bằng cột pos. Nhật ký (audit) nằm ở bảng riêng. */
export const KEYS = {
  orgs: 'id', profiles: 'orgId', listed: 'orgId', receivables: 'id', products: 'id', rfqs: 'id', applications: 'id',
  earlyOffers: 'id', limits: 'id', esg: 'id', connections: 'orgId', ledger: 'id', external: 'id',
  consents: 'id', notifications: 'id',
} as const
export type CollectionName = keyof typeof KEYS
const NAMES = Object.keys(KEYS) as CollectionName[]

export interface UserRow { id: string; email: string; passwordHash: string; orgId: string; name: string; title: string; role: string }

/** Ràng buộc nghiệp vụ ở mức CSDL → thông báo cho người dùng khi bị vi phạm. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  ex_org_tax_code: 'Mã số thuế đã được đăng ký trên hệ thống',
  ex_active_application: 'Khoản phải thu đã có hồ sơ tài trợ đang hoạt động',
  ex_open_rfq: 'Khoản phải thu đã có RFQ đang mở',
  ex_invoice_key: 'Trùng hóa đơn (cùng MST bán, ký hiệu, số, ngày)',
  ex_invoice_fingerprint: 'Trùng dấu vân tay hóa đơn',
}

export class ConstraintError extends Error {
  constructor(public constraint: string) {
    super(CONSTRAINT_MESSAGES[constraint] ?? `Vi phạm ràng buộc dữ liệu (${constraint})`)
  }
}

/** JSON với khóa sắp xếp — để băm nhật ký ổn định dù JSONB đổi thứ tự khóa. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
}
export const auditHash = (prev: string, doc: unknown) => createHash('sha256').update(prev).update('\n').update(canonical(doc)).digest('hex')
const GENESIS = '0'.repeat(64)

const SCHEMA_SQL = (schema: string) => `
CREATE SCHEMA IF NOT EXISTS ${schema};
SET search_path TO ${schema};
CREATE TABLE IF NOT EXISTS docs (col text NOT NULL, id text NOT NULL, pos integer NOT NULL, doc jsonb NOT NULL, PRIMARY KEY (col, id));
DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT ex_org_tax_code EXCLUDE USING btree ((doc->>'taxCode') WITH =) WHERE (col = 'orgs') DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT ex_active_application EXCLUDE USING btree ((doc->>'receivableId') WITH =)
    WHERE (col = 'applications' AND doc->>'state' NOT IN ('REJECTED', 'WITHDRAWN')) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT ex_open_rfq EXCLUDE USING btree ((doc->>'receivableId') WITH =)
    WHERE (col = 'rfqs' AND doc->>'state' IN ('OPEN', 'RESPONDED')) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT ex_invoice_key EXCLUDE USING btree (
    (doc->>'sellerId') WITH =, upper(doc->>'invoiceSeries') WITH =, ltrim(upper(doc->>'invoiceNumber'), '0') WITH =, (doc->>'issueDate') WITH =)
    WHERE (col = 'receivables' AND doc->>'state' <> 'CANCELLED') DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT ex_invoice_fingerprint EXCLUDE USING btree ((doc->>'sellerId') WITH =, (doc->>'fingerprint') WITH =)
    WHERE (col = 'receivables' AND doc->>'state' <> 'CANCELLED') DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- Nhật ký chỉ cho thêm, nối chuỗi băm: hash = sha256(prev_hash || '\\n' || canonical(doc)).
CREATE TABLE IF NOT EXISTS audit_events (
  seq bigserial PRIMARY KEY, id text NOT NULL UNIQUE, doc jsonb NOT NULL, prev_hash text NOT NULL, hash text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN RAISE EXCEPTION 'audit_events chỉ cho phép thêm, không sửa/xóa'; END $f$;
DROP TRIGGER IF EXISTS audit_events_no_change ON audit_events;
CREATE TRIGGER audit_events_no_change BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();

CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, org_id text NOT NULL, name text NOT NULL, title text NOT NULL, role text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_keys (org_id text PRIMARY KEY, secret text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS idempotency (key text PRIMARY KEY, response text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
`

export class Database {
  private pool: pg.Pool
  private cache = new Map<string, string>() // `${col}:${id}` -> `${pos}|${json}` đã ghi
  private auditIds = new Set<string>()
  private lastHash = GENESIS

  private constructor(url: string, readonly schema: string) {
    if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Tên schema không hợp lệ: ${schema}`)
    this.pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public`, max: 10 })
  }

  static async open(url: string, schema = 'public') {
    const db = new Database(url, schema)
    const c = await db.pool.connect()
    try {
      // khóa tư vấn để hai tiến trình khởi động cùng lúc không chạy migration song song
      await c.query('SELECT pg_advisory_lock(hashtext($1))', [`fcc-migrate:${schema}`])
      await c.query(SCHEMA_SQL(schema))
      await c.query('SELECT pg_advisory_unlock(hashtext($1))', [`fcc-migrate:${schema}`])
    } finally {
      c.release()
    }
    return db
  }

  async load(): Promise<State> {
    const state = {} as Record<string, unknown>
    for (const col of NAMES) state[col] = []
    const { rows } = await this.pool.query<{ col: string; id: string; pos: number; doc: unknown }>('SELECT col, id, pos, doc FROM docs ORDER BY col, pos')
    this.cache.clear()
    for (const r of rows) {
      if (!(r.col in KEYS)) continue
      ;(state[r.col] as unknown[]).push(r.doc)
      this.cache.set(`${r.col}:${r.id}`, `${r.pos}|${JSON.stringify(r.doc)}`)
    }
    const audit = await this.pool.query<{ id: string; doc: AuditEvent; hash: string }>('SELECT id, doc, hash FROM audit_events ORDER BY seq DESC')
    state.audit = audit.rows.map((r) => r.doc)
    this.auditIds = new Set(audit.rows.map((r) => r.id))
    this.lastHash = audit.rows[0]?.hash ?? GENESIS
    state.sources = SOURCES
    return state as unknown as State
  }

  /**
   * Ghi các dòng thay đổi so với lần ghi trước trong một giao dịch. Ràng buộc nghiệp vụ được kiểm tra lúc COMMIT;
   * vi phạm thì ném ConstraintError và bộ nhớ đệm giữ nguyên (lần ghi sau so sánh với trạng thái đã ghi thật).
   */
  async save(state: State) {
    const ups: { col: string; id: string; pos: number; json: string; sig: string }[] = []
    const seen = new Set<string>()
    for (const col of NAMES) {
      const key = KEYS[col]
      ;(state[col] as unknown as Record<string, unknown>[]).forEach((item, pos) => {
        const id = String(item[key])
        const ck = `${col}:${id}`
        const json = JSON.stringify(item)
        const sig = `${pos}|${json}`
        seen.add(ck)
        if (this.cache.get(ck) !== sig) ups.push({ col, id, pos, json, sig })
      })
    }
    const dels = [...this.cache.keys()].filter((ck) => !seen.has(ck))
    // nhật ký mới nằm đầu mảng (mới nhất trước) → ghi theo thứ tự thời gian
    const newAudit = state.audit.filter((e) => !this.auditIds.has(e.id)).reverse()
    if (!ups.length && !dels.length && !newAudit.length) return

    const c = await this.pool.connect()
    let hash = this.lastHash
    try {
      await c.query('BEGIN')
      if (dels.length) {
        const cols = dels.map((ck) => ck.slice(0, ck.indexOf(':')))
        const ids = dels.map((ck) => ck.slice(ck.indexOf(':') + 1))
        await c.query('DELETE FROM docs d USING unnest($1::text[], $2::text[]) AS x(col, id) WHERE d.col = x.col AND d.id = x.id', [cols, ids])
      }
      if (ups.length) {
        await c.query(
          `INSERT INTO docs (col, id, pos, doc) SELECT * FROM unnest($1::text[], $2::text[], $3::int[], $4::jsonb[])
           ON CONFLICT (col, id) DO UPDATE SET pos = excluded.pos, doc = excluded.doc`,
          [ups.map((u) => u.col), ups.map((u) => u.id), ups.map((u) => u.pos), ups.map((u) => u.json)],
        )
      }
      for (const e of newAudit) {
        const next = auditHash(hash, e)
        await c.query('INSERT INTO audit_events (id, doc, prev_hash, hash) VALUES ($1, $2, $3, $4)', [e.id, JSON.stringify(e), hash, next])
        hash = next
      }
      await c.query('COMMIT')
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined)
      const err = e as { code?: string; constraint?: string }
      if ((err.code === '23P01' || err.code === '23505') && err.constraint) throw new ConstraintError(err.constraint)
      throw e
    } finally {
      c.release()
    }
    for (const u of ups) this.cache.set(`${u.col}:${u.id}`, u.sig)
    for (const ck of dels) this.cache.delete(ck)
    for (const e of newAudit) this.auditIds.add(e.id)
    this.lastHash = hash
  }

  /** Kiểm tra chuỗi băm nhật ký. Trả về vị trí (seq) đầu tiên bị sai nếu có. */
  async verifyAudit(): Promise<{ ok: boolean; count: number; badSeq?: number; lastHash: string }> {
    const { rows } = await this.pool.query<{ seq: string; doc: unknown; prev_hash: string; hash: string }>('SELECT seq, doc, prev_hash, hash FROM audit_events ORDER BY seq')
    let prev = GENESIS
    for (const r of rows) {
      if (r.prev_hash !== prev || auditHash(prev, r.doc) !== r.hash) return { ok: false, count: rows.length, badSeq: Number(r.seq), lastHash: prev }
      prev = r.hash
    }
    return { ok: true, count: rows.length, lastHash: prev }
  }

  // ---- người dùng, phiên, khóa webhook ----
  async createUser(u: { id: string; email: string; passwordHash: string; orgId: string; name: string; title: string; role: string }) {
    await this.pool.query('INSERT INTO users (id, email, password_hash, org_id, name, title, role) VALUES ($1, $2, $3, $4, $5, $6, $7)', [u.id, u.email, u.passwordHash, u.orgId, u.name, u.title, u.role])
  }
  private static USER_COLS = 'id, email, password_hash AS "passwordHash", org_id AS "orgId", name, title, role'
  async userByEmail(email: string) {
    return (await this.pool.query<UserRow>(`SELECT ${Database.USER_COLS} FROM users WHERE email = $1`, [email])).rows[0]
  }
  async userById(id: string) {
    return (await this.pool.query<UserRow>(`SELECT ${Database.USER_COLS} FROM users WHERE id = $1`, [id])).rows[0]
  }
  async countUsers() {
    return Number((await this.pool.query<{ n: string }>('SELECT COUNT(*) AS n FROM users')).rows[0].n)
  }
  async createSession(tokenHash: string, userId: string, ttlMs: number) {
    await this.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, new Date(Date.now() + ttlMs)])
  }
  async sessionUser(tokenHash: string) {
    return (
      await this.pool.query<Omit<UserRow, 'passwordHash'>>(
        'SELECT u.id, u.email, u.org_id AS "orgId", u.name, u.title, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()',
        [tokenHash],
      )
    ).rows[0]
  }
  async deleteSession(tokenHash: string) {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
  }
  async purgeSessions() {
    await this.pool.query('DELETE FROM sessions WHERE expires_at <= now()')
  }
  async getWebhookSecret(orgId: string) {
    return (await this.pool.query<{ secret: string }>('SELECT secret FROM webhook_keys WHERE org_id = $1', [orgId])).rows[0]?.secret
  }
  async setWebhookSecret(orgId: string, secret: string) {
    await this.pool.query('INSERT INTO webhook_keys (org_id, secret) VALUES ($1, $2) ON CONFLICT (org_id) DO UPDATE SET secret = excluded.secret, created_at = now()', [orgId, secret])
  }
  async getIdempotent(key: string) {
    return (await this.pool.query<{ response: string }>('SELECT response FROM idempotency WHERE key = $1', [key])).rows[0]?.response
  }
  async putIdempotent(key: string, response: string) {
    await this.pool.query('INSERT INTO idempotency (key, response) VALUES ($1, $2) ON CONFLICT DO NOTHING', [key, response])
  }
  /** Chỉ dùng cho kiểm thử: chạy SQL thô (ví dụ thử sửa nhật ký). */
  async rawQuery(sql: string, params: unknown[] = []) {
    return this.pool.query(sql, params)
  }
  async dropSchema() {
    if (this.schema === 'public') throw new Error('Không xóa schema public')
    await this.pool.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`)
  }
  async close() {
    await this.pool.end()
  }
}
