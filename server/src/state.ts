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

export interface UserRow { id: string; email: string; passwordHash: string; orgId: string; name: string; title: string; role: string; mfaEnabled: boolean }
export interface Membership { orgId: string; role: string; status: 'active' | 'revoked' }
export interface SessionInfo { id: string; email: string; name: string; title: string; mfaEnabled: boolean; activeOrgId: string; role: string; mfaAt: Date | null }
export interface MemberRow { userId: string; email: string; name: string; title: string; role: string; status: string; mfaEnabled: boolean; createdAt: Date }

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

-- WP2: thành viên nhiều tổ chức, MFA, mời thành viên, đặt lại mật khẩu, hàng đợi email
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_step bigint NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_org_id text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_at timestamptz;
CREATE TABLE IF NOT EXISTS memberships (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, org_id text NOT NULL, role text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, org_id)
);
INSERT INTO memberships (user_id, org_id, role)
  SELECT id, org_id, CASE WHEN role = 'fcc_reviewer' THEN 'fcc_admin' ELSE 'owner' END FROM users
  ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS invitations (
  token_hash text PRIMARY KEY, org_id text NOT NULL, email text NOT NULL, role text NOT NULL, invited_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, accepted_at timestamptz, accepted_by text
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE TABLE IF NOT EXISTS files (
  key text NOT NULL, org_id text NOT NULL, name text NOT NULL, mime text NOT NULL, size bigint NOT NULL, kind text NOT NULL,
  uploaded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (key, org_id)
);
-- WP3: khóa tích hợp đối tác, địa chỉ webhook đi, hàng đợi webhook, vé SSE
CREATE TABLE IF NOT EXISTS integration_keys (
  id text PRIMARY KEY, org_id text NOT NULL, name text NOT NULL, scopes text[] NOT NULL, key_hash text NOT NULL,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz, revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS partner_endpoints (org_id text PRIMARY KEY, url text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id bigserial PRIMARY KEY, event_id text NOT NULL UNIQUE, org_id text NOT NULL, type text NOT NULL, payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), attempts int NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz, dead_at timestamptz, last_status int, last_error text
);
CREATE INDEX IF NOT EXISTS webhook_outbox_due ON webhook_outbox (next_attempt_at) WHERE delivered_at IS NULL AND dead_at IS NULL;
CREATE TABLE IF NOT EXISTS sse_tickets (ticket_hash text PRIMARY KEY, session_hash text NOT NULL, expires_at timestamptz NOT NULL);
-- WP6: phiên bản bộ chấm điểm, kết quả chấm bất biến, yêu cầu xem xét lại
CREATE TABLE IF NOT EXISTS scorecard_versions (
  id text PRIMARY KEY, name text NOT NULL, params jsonb NOT NULL, status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'retired')),
  proposed_by text NOT NULL, approvals text[] NOT NULL DEFAULT '{}', effective_from timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS credit_assessments (
  id text PRIMARY KEY, kind text NOT NULL, subject_id text NOT NULL, org_id text NOT NULL, scorecard_version_id text NOT NULL REFERENCES scorecard_versions(id),
  input_hash text NOT NULL, score numeric NOT NULL, rating text NOT NULL, coverage numeric NOT NULL, flags jsonb NOT NULL, result jsonb NOT NULL,
  status text NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional', 'official', 'superseded')),
  requested_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), issued_by text, issued_at timestamptz, valid_until timestamptz
);
CREATE INDEX IF NOT EXISTS credit_assessments_subject ON credit_assessments (kind, subject_id, created_at DESC);
CREATE OR REPLACE FUNCTION credit_assessments_immutable() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'credit_assessments không được xóa'; END IF;
  IF NEW.id <> OLD.id OR NEW.kind <> OLD.kind OR NEW.subject_id <> OLD.subject_id OR NEW.input_hash <> OLD.input_hash OR NEW.score <> OLD.score
     OR NEW.rating <> OLD.rating OR NEW.coverage <> OLD.coverage OR NEW.result::text <> OLD.result::text OR NEW.flags::text <> OLD.flags::text
     OR NEW.scorecard_version_id <> OLD.scorecard_version_id OR NEW.requested_by <> OLD.requested_by THEN
    RAISE EXCEPTION 'Kết quả chấm điểm đã lưu là bất biến; chấm lại sẽ tạo bản ghi mới';
  END IF;
  IF OLD.issued_at IS NOT NULL AND (NEW.issued_at IS DISTINCT FROM OLD.issued_at OR NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.valid_until IS DISTINCT FROM OLD.valid_until) THEN
    RAISE EXCEPTION 'Điểm đã phát hành không được sửa';
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS credit_assessments_guard ON credit_assessments;
CREATE TRIGGER credit_assessments_guard BEFORE UPDATE OR DELETE ON credit_assessments FOR EACH ROW EXECUTE FUNCTION credit_assessments_immutable();
CREATE TABLE IF NOT EXISTS credit_appeals (
  id text PRIMARY KEY, assessment_id text NOT NULL REFERENCES credit_assessments(id), org_id text NOT NULL, reason text NOT NULL, evidence_keys text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'rejected')), resolution_note text, resolved_by text, resolved_at timestamptz,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), new_assessment_id text
);
CREATE TABLE IF NOT EXISTS email_outbox (
  id bigserial PRIMARY KEY, to_email text NOT NULL, subject text NOT NULL, body text NOT NULL, kind text NOT NULL,
  dedupe_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, last_error text
);
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

  // ---- người dùng, thành viên, phiên ----
  /** Tạo người dùng và thành viên đầu tiên (tổ chức gốc). */
  async createUser(u: { id: string; email: string; passwordHash: string; orgId: string; name: string; title: string; role: string }) {
    const c = await this.pool.connect()
    try {
      await c.query('BEGIN')
      await c.query('INSERT INTO users (id, email, password_hash, org_id, name, title, role) VALUES ($1, $2, $3, $4, $5, $6, $7)', [u.id, u.email, u.passwordHash, u.orgId, u.name, u.title, u.role])
      await c.query('INSERT INTO memberships (user_id, org_id, role) VALUES ($1, $2, $3)', [u.id, u.orgId, u.role])
      await c.query('COMMIT')
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined)
      throw e
    } finally {
      c.release()
    }
  }
  private static USER_COLS = 'id, email, password_hash AS "passwordHash", org_id AS "orgId", name, title, role, mfa_enabled AS "mfaEnabled"'
  async userByEmail(email: string) {
    return (await this.pool.query<UserRow>(`SELECT ${Database.USER_COLS} FROM users WHERE email = $1`, [email])).rows[0]
  }
  async userById(id: string) {
    return (await this.pool.query<UserRow>(`SELECT ${Database.USER_COLS} FROM users WHERE id = $1`, [id])).rows[0]
  }
  async countUsers() {
    return Number((await this.pool.query<{ n: string }>('SELECT COUNT(*) AS n FROM users')).rows[0].n)
  }
  async setPassword(userId: string, passwordHash: string) {
    await this.pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash])
    await this.pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]) // đổi mật khẩu thì thu hồi mọi phiên
  }
  async membershipsOf(userId: string) {
    return (await this.pool.query<Membership>(`SELECT org_id AS "orgId", role, status FROM memberships WHERE user_id = $1 AND status = 'active' ORDER BY created_at`, [userId])).rows
  }
  async addMembership(userId: string, orgId: string, role: string) {
    await this.pool.query(
      `INSERT INTO memberships (user_id, org_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, org_id) DO UPDATE SET role = excluded.role, status = 'active', updated_at = now()`,
      [userId, orgId, role],
    )
  }
  async membersOf(orgId: string) {
    return (
      await this.pool.query<MemberRow>(
        `SELECT m.user_id AS "userId", u.email, u.name, u.title, m.role, m.status, u.mfa_enabled AS "mfaEnabled", m.created_at AS "createdAt"
         FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 ORDER BY m.created_at`,
        [orgId],
      )
    ).rows
  }
  async setMemberRole(orgId: string, userId: string, role: string) {
    return (await this.pool.query(`UPDATE memberships SET role = $3, updated_at = now() WHERE org_id = $1 AND user_id = $2 AND status = 'active'`, [orgId, userId, role])).rowCount === 1
  }
  async revokeMember(orgId: string, userId: string) {
    return (await this.pool.query(`UPDATE memberships SET status = 'revoked', updated_at = now() WHERE org_id = $1 AND user_id = $2 AND status = 'active'`, [orgId, userId])).rowCount === 1
  }
  async countActiveRole(orgId: string, role: string) {
    return Number((await this.pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM memberships WHERE org_id = $1 AND role = $2 AND status = 'active'`, [orgId, role])).rows[0].n)
  }

  async createSession(tokenHash: string, userId: string, ttlMs: number, activeOrgId: string, mfaAt: Date | null = null) {
    await this.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at, active_org_id, mfa_at) VALUES ($1, $2, $3, $4, $5)', [tokenHash, userId, new Date(Date.now() + ttlMs), activeOrgId, mfaAt])
  }
  /** Người dùng của phiên + vai trò ở tổ chức đang hoạt động. Thành viên đã bị thu hồi thì không có phiên hợp lệ. */
  async sessionUser(tokenHash: string) {
    return (
      await this.pool.query<SessionInfo>(
        `SELECT u.id, u.email, u.name, u.title, u.mfa_enabled AS "mfaEnabled", s.active_org_id AS "activeOrgId", m.role, s.mfa_at AS "mfaAt"
         FROM sessions s JOIN users u ON u.id = s.user_id
         JOIN memberships m ON m.user_id = u.id AND m.org_id = s.active_org_id AND m.status = 'active'
         WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [tokenHash],
      )
    ).rows[0]
  }
  async setActiveOrg(tokenHash: string, orgId: string) {
    await this.pool.query('UPDATE sessions SET active_org_id = $2 WHERE token_hash = $1', [tokenHash, orgId])
  }
  async markSessionMfa(tokenHash: string, at: Date) {
    await this.pool.query('UPDATE sessions SET mfa_at = $2 WHERE token_hash = $1', [tokenHash, at])
  }
  async deleteSession(tokenHash: string) {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
  }
  async purgeSessions() {
    await this.pool.query('DELETE FROM sessions WHERE expires_at <= now()')
  }

  // ---- MFA ----
  async getMfa(userId: string) {
    return (await this.pool.query<{ secret: string | null; enabled: boolean; lastStep: string }>('SELECT mfa_secret AS secret, mfa_enabled AS enabled, mfa_last_step AS "lastStep" FROM users WHERE id = $1', [userId])).rows[0]
  }
  async setMfaSecret(userId: string, sealedSecret: string | null, enabled: boolean) {
    await this.pool.query('UPDATE users SET mfa_secret = $2, mfa_enabled = $3, mfa_last_step = 0 WHERE id = $1', [userId, sealedSecret, enabled])
  }
  async enableMfa(userId: string) {
    await this.pool.query('UPDATE users SET mfa_enabled = true WHERE id = $1 AND mfa_secret IS NOT NULL', [userId])
  }
  /** Ghi nhận bước TOTP đã dùng; trả false nếu mã đã dùng (chống phát lại). */
  async useMfaStep(userId: string, step: number) {
    return (await this.pool.query('UPDATE users SET mfa_last_step = $2 WHERE id = $1 AND mfa_last_step < $2', [userId, step])).rowCount === 1
  }

  // ---- mời thành viên, đặt lại mật khẩu, email ----
  async createInvitation(i: { tokenHash: string; orgId: string; email: string; role: string; invitedBy: string; ttlMs: number }) {
    await this.pool.query('INSERT INTO invitations (token_hash, org_id, email, role, invited_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6)', [i.tokenHash, i.orgId, i.email, i.role, i.invitedBy, new Date(Date.now() + i.ttlMs)])
  }
  async invitation(tokenHash: string) {
    return (
      await this.pool.query<{ orgId: string; email: string; role: string; expiresAt: Date; acceptedAt: Date | null }>(
        'SELECT org_id AS "orgId", email, role, expires_at AS "expiresAt", accepted_at AS "acceptedAt" FROM invitations WHERE token_hash = $1',
        [tokenHash],
      )
    ).rows[0]
  }
  async pendingInvitations(orgId: string) {
    return (
      await this.pool.query<{ email: string; role: string; createdAt: Date; expiresAt: Date }>(
        'SELECT email, role, created_at AS "createdAt", expires_at AS "expiresAt" FROM invitations WHERE org_id = $1 AND accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC',
        [orgId],
      )
    ).rows
  }
  /** Đánh dấu đã dùng (một lần); trả false nếu đã dùng hoặc hết hạn. */
  async consumeInvitation(tokenHash: string, userId: string) {
    return (await this.pool.query('UPDATE invitations SET accepted_at = now(), accepted_by = $2 WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > now()', [tokenHash, userId])).rowCount === 1
  }
  async createPasswordReset(tokenHash: string, userId: string, ttlMs: number) {
    await this.pool.query('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, new Date(Date.now() + ttlMs)])
  }
  async consumePasswordReset(tokenHash: string) {
    return (await this.pool.query<{ userId: string }>('UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id AS "userId"', [tokenHash])).rows[0]?.userId
  }
  // ---- tệp: metadata theo tổ chức (nội dung ở kho tệp mã hóa) ----
  async addFile(f: { key: string; orgId: string; name: string; mime: string; size: number; kind: string; uploadedBy: string }) {
    await this.pool.query(
      'INSERT INTO files (key, org_id, name, mime, size, kind, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (key, org_id) DO NOTHING',
      [f.key, f.orgId, f.name, f.mime, f.size, f.kind, f.uploadedBy],
    )
  }
  async fileOf(key: string, orgId: string) {
    return (await this.pool.query<{ key: string; name: string; mime: string; size: string; kind: string }>('SELECT key, name, mime, size, kind FROM files WHERE key = $1 AND org_id = $2', [key, orgId])).rows[0]
  }
  async anyFile(key: string) {
    return (await this.pool.query<{ name: string; mime: string }>('SELECT name, mime FROM files WHERE key = $1 LIMIT 1', [key])).rows[0]
  }
  // ---- chấm điểm ----
  async scorecardVersion(id: string) {
    return (await this.pool.query<{ id: string; name: string; params: unknown; status: string; proposedBy: string; approvals: string[] }>('SELECT id, name, params, status, proposed_by AS "proposedBy", approvals FROM scorecard_versions WHERE id = $1', [id])).rows[0]
  }
  async activeScorecard() {
    return (await this.pool.query<{ id: string; name: string; params: unknown }>(`SELECT id, name, params FROM scorecard_versions WHERE status = 'active' ORDER BY effective_from DESC NULLS LAST, created_at DESC LIMIT 1`)).rows[0]
  }
  async scorecardVersions() {
    return (await this.pool.query('SELECT id, name, params, status, proposed_by AS "proposedBy", approvals, effective_from AS "effectiveFrom", created_at AS "createdAt" FROM scorecard_versions ORDER BY created_at DESC')).rows
  }
  async createScorecard(v: { id: string; name: string; params: unknown; proposedBy: string; status?: string; approvals?: string[] }) {
    await this.pool.query('INSERT INTO scorecard_versions (id, name, params, proposed_by, status, approvals, effective_from) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING', [v.id, v.name, JSON.stringify(v.params), v.proposedBy, v.status ?? 'proposed', v.approvals ?? [], v.status === 'active' ? new Date() : null])
  }
  /** Thêm một người duyệt; đủ hai người duyệt khác nhau (không kể người đề xuất) thì kích hoạt và hạ phiên bản cũ. */
  async approveScorecard(id: string, userId: string) {
    const c = await this.pool.connect()
    try {
      await c.query('BEGIN')
      const { rows } = await c.query<{ proposed_by: string; approvals: string[]; status: string }>('SELECT proposed_by, approvals, status FROM scorecard_versions WHERE id = $1 FOR UPDATE', [id])
      const v = rows[0]
      if (!v) throw Object.assign(new Error('Không tìm thấy phiên bản'), { code: 'NOT_FOUND' })
      if (v.status !== 'proposed') throw Object.assign(new Error('Phiên bản không còn ở trạng thái đề xuất'), { code: 'STATE' })
      if (v.proposed_by === userId) throw Object.assign(new Error('Người đề xuất không tự duyệt phiên bản của mình'), { code: 'SELF' })
      if (v.approvals.includes(userId)) throw Object.assign(new Error('Bạn đã duyệt phiên bản này'), { code: 'DUP' })
      const approvals = [...v.approvals, userId]
      const active = approvals.length >= 2
      if (active) await c.query(`UPDATE scorecard_versions SET status = 'retired' WHERE status = 'active'`)
      await c.query(`UPDATE scorecard_versions SET approvals = $2, status = $3, effective_from = $4 WHERE id = $1`, [id, approvals, active ? 'active' : 'proposed', active ? new Date() : null])
      await c.query('COMMIT')
      return { approvals, active }
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined)
      throw e
    } finally {
      c.release()
    }
  }
  async latestAssessment(kind: string, subjectId: string) {
    return (await this.pool.query('SELECT * FROM credit_assessments WHERE kind = $1 AND subject_id = $2 AND status <> $3 ORDER BY created_at DESC LIMIT 1', [kind, subjectId, 'superseded'])).rows[0]
  }
  async assessment(id: string) {
    return (await this.pool.query('SELECT * FROM credit_assessments WHERE id = $1', [id])).rows[0]
  }
  async assessmentsOf(kind: string, subjectId: string, limit = 20) {
    return (await this.pool.query('SELECT * FROM credit_assessments WHERE kind = $1 AND subject_id = $2 ORDER BY created_at DESC LIMIT $3', [kind, subjectId, limit])).rows
  }
  async insertAssessment(a: { id: string; kind: string; subjectId: string; orgId: string; scorecardVersionId: string; inputHash: string; score: number; rating: string; coverage: number; flags: unknown; result: unknown; requestedBy: string }) {
    await this.pool.query(
      `INSERT INTO credit_assessments (id, kind, subject_id, org_id, scorecard_version_id, input_hash, score, rating, coverage, flags, result, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [a.id, a.kind, a.subjectId, a.orgId, a.scorecardVersionId, a.inputHash, a.score, a.rating, a.coverage, JSON.stringify(a.flags), JSON.stringify(a.result), a.requestedBy],
    )
    // bản trước chưa phát hành bị thay thế; bản đã phát hành giữ nguyên cho tới khi hết hạn
    await this.pool.query(`UPDATE credit_assessments SET status = 'superseded' WHERE kind = $1 AND subject_id = $2 AND id <> $3 AND status = 'provisional'`, [a.kind, a.subjectId, a.id])
  }
  async issueAssessment(id: string, by: string, validUntil: Date) {
    const r = await this.pool.query(`UPDATE credit_assessments SET status = 'official', issued_by = $2, issued_at = now(), valid_until = $3 WHERE id = $1 AND issued_at IS NULL AND status = 'provisional'`, [id, by, validUntil])
    return r.rowCount === 1
  }
  async assessmentsAwaitingIssue() {
    return (await this.pool.query(`SELECT * FROM credit_assessments WHERE status = 'provisional' AND (result->>'official')::boolean ORDER BY created_at DESC LIMIT 100`)).rows
  }
  async createAppeal(a: { id: string; assessmentId: string; orgId: string; reason: string; evidenceKeys: string[]; createdBy: string }) {
    await this.pool.query('INSERT INTO credit_appeals (id, assessment_id, org_id, reason, evidence_keys, created_by) VALUES ($1, $2, $3, $4, $5, $6)', [a.id, a.assessmentId, a.orgId, a.reason, a.evidenceKeys, a.createdBy])
  }
  async appeals(filter: { orgId?: string; status?: string }) {
    return (await this.pool.query(`SELECT id, assessment_id AS "assessmentId", org_id AS "orgId", reason, evidence_keys AS "evidenceKeys", status, resolution_note AS "resolutionNote", created_at AS "createdAt", new_assessment_id AS "newAssessmentId" FROM credit_appeals WHERE ($1::text IS NULL OR org_id = $1) AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC`, [filter.orgId ?? null, filter.status ?? null])).rows
  }
  async appeal(id: string) {
    return (await this.pool.query('SELECT id, assessment_id AS "assessmentId", org_id AS "orgId", status FROM credit_appeals WHERE id = $1', [id])).rows[0]
  }
  async resolveAppeal(id: string, r: { status: 'upheld' | 'rejected'; note: string; by: string; newAssessmentId?: string }) {
    return (await this.pool.query(`UPDATE credit_appeals SET status = $2, resolution_note = $3, resolved_by = $4, resolved_at = now(), new_assessment_id = $5 WHERE id = $1 AND status = 'open'`, [id, r.status, r.note, r.by, r.newAssessmentId ?? null])).rowCount === 1
  }

  // ---- tích hợp đối tác ----
  async createIntegrationKey(k: { id: string; orgId: string; name: string; scopes: string[]; keyHash: string; createdBy: string }) {
    await this.pool.query('INSERT INTO integration_keys (id, org_id, name, scopes, key_hash, created_by) VALUES ($1, $2, $3, $4, $5, $6)', [k.id, k.orgId, k.name, k.scopes, k.keyHash, k.createdBy])
  }
  async integrationKey(id: string) {
    return (
      await this.pool.query<{ id: string; orgId: string; scopes: string[]; keyHash: string; revokedAt: Date | null }>(
        'SELECT id, org_id AS "orgId", scopes, key_hash AS "keyHash", revoked_at AS "revokedAt" FROM integration_keys WHERE id = $1',
        [id],
      )
    ).rows[0]
  }
  async touchIntegrationKey(id: string) {
    await this.pool.query('UPDATE integration_keys SET last_used_at = now() WHERE id = $1', [id])
  }
  async integrationKeys(orgId: string) {
    return (
      await this.pool.query(
        'SELECT id, name, scopes, created_by AS "createdBy", created_at AS "createdAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt" FROM integration_keys WHERE org_id = $1 ORDER BY created_at DESC',
        [orgId],
      )
    ).rows
  }
  async revokeIntegrationKey(orgId: string, id: string) {
    return (await this.pool.query('UPDATE integration_keys SET revoked_at = now() WHERE org_id = $1 AND id = $2 AND revoked_at IS NULL', [orgId, id])).rowCount === 1
  }
  async setPartnerEndpoint(orgId: string, url: string | null) {
    if (url === null) await this.pool.query('DELETE FROM partner_endpoints WHERE org_id = $1', [orgId])
    else await this.pool.query('INSERT INTO partner_endpoints (org_id, url) VALUES ($1, $2) ON CONFLICT (org_id) DO UPDATE SET url = excluded.url, updated_at = now()', [orgId, url])
  }
  async partnerEndpoint(orgId: string) {
    return (await this.pool.query<{ url: string }>('SELECT url FROM partner_endpoints WHERE org_id = $1', [orgId])).rows[0]?.url
  }
  async enqueueWebhooks(rows: { eventId: string; orgId: string; type: string; payload: unknown }[]) {
    if (!rows.length) return
    await this.pool.query(
      `INSERT INTO webhook_outbox (event_id, org_id, type, payload) SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::jsonb[]) ON CONFLICT (event_id) DO NOTHING`,
      [rows.map((r) => r.eventId), rows.map((r) => r.orgId), rows.map((r) => r.type), rows.map((r) => JSON.stringify(r.payload))],
    )
  }
  /** Nhận một lô webhook đến hạn gửi (khóa dòng để nhiều tiến trình không gửi trùng). */
  async claimWebhooks(limit: number, now: Date) {
    return (
      await this.pool.query<{ id: string; eventId: string; orgId: string; type: string; payload: unknown; attempts: number }>(
        `UPDATE webhook_outbox SET next_attempt_at = $2::timestamptz + interval '2 minutes'
         WHERE id IN (SELECT id FROM webhook_outbox WHERE delivered_at IS NULL AND dead_at IS NULL AND next_attempt_at <= $2 ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
         RETURNING id, event_id AS "eventId", org_id AS "orgId", type, payload, attempts`,
        [limit, now],
      )
    ).rows
  }
  async webhookResult(id: string, r: { ok: boolean; status?: number; error?: string; nextAttemptAt?: Date; dead?: boolean }) {
    await this.pool.query(
      `UPDATE webhook_outbox SET attempts = attempts + 1, last_status = $2, last_error = $3,
         delivered_at = CASE WHEN $4 THEN now() END, dead_at = CASE WHEN $5 THEN now() END,
         next_attempt_at = COALESCE($6, next_attempt_at) WHERE id = $1`,
      [id, r.status ?? null, r.error ?? null, r.ok, !!r.dead, r.nextAttemptAt ?? null],
    )
  }
  async webhookDeliveries(orgId: string, limit = 50) {
    return (
      await this.pool.query(
        `SELECT event_id AS "eventId", type, created_at AS "createdAt", attempts, last_status AS "lastStatus", last_error AS "lastError",
           delivered_at AS "deliveredAt", dead_at AS "deadAt" FROM webhook_outbox WHERE org_id = $1 ORDER BY id DESC LIMIT $2`,
        [orgId, limit],
      )
    ).rows
  }
  async createSseTicket(ticketHash: string, sessionHash: string, ttlMs: number) {
    await this.pool.query('DELETE FROM sse_tickets WHERE expires_at < now()')
    await this.pool.query('INSERT INTO sse_tickets (ticket_hash, session_hash, expires_at) VALUES ($1, $2, $3)', [ticketHash, sessionHash, new Date(Date.now() + ttlMs)])
  }
  async useSseTicket(ticketHash: string) {
    return (await this.pool.query<{ sessionHash: string }>('DELETE FROM sse_tickets WHERE ticket_hash = $1 AND expires_at > now() RETURNING session_hash AS "sessionHash"', [ticketHash])).rows[0]?.sessionHash
  }

  async queueEmail(m: { to: string; subject: string; body: string; kind: string; dedupeKey?: string }) {
    await this.pool.query('INSERT INTO email_outbox (to_email, subject, body, kind, dedupe_key) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (dedupe_key) DO NOTHING', [m.to, m.subject, m.body, m.kind, m.dedupeKey ?? null])
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
