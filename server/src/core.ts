// Lõi dùng chung cho các route: trạng thái nghiệp vụ trong bộ nhớ, hàng đợi ghi tuần tự, xác thực phiên, kiểm tra quyền.
import type { FastifyRequest } from 'fastify'
import { randomBytes } from 'node:crypto'
import { ConstraintError, type Database, type SessionInfo, type State } from './state'
import type { ObjectStore } from './storage'
import type { Ctx, DomainEvent, Role } from './service'
import { canDo, MFA_ROLES, STEP_UP_ACTIONS, STEP_UP_MS, type MemberRole } from './auth/roles'
import { hashToken } from './auth/password'
import { HttpError, forbidden } from './errors'
import { viewFor } from './views'

import type { ListedFetcher } from './listed-sync'

export interface CoreOptions {
  listedDir: string
  /** Tự chạy vnstock (scripts/fetch_listed.py) trước khi nạp dữ liệu niêm yết; không đặt thì chỉ đọc file có sẵn */
  listedFetch?: ListedFetcher
  devAutologin?: boolean
  now?: () => Date
  /** Địa chỉ gốc của giao diện, dùng trong liên kết email (mời thành viên, đặt lại mật khẩu) */
  appUrl: string
}

export interface Authed extends SessionInfo {
  token: string
  tokenHash: string
  role: MemberRole
}

/** Ai đang thực hiện một thay đổi. */
export type Who =
  | { kind: 'user'; user: Authed; correlationId?: string }
  | { kind: 'system'; orgId: string; label: string; correlationId?: string }
  | { kind: 'partner'; orgId: string; role: MemberRole; keyId: string; correlationId?: string }

export type Core = ReturnType<typeof createCore>

export const uid = (p: string) => `${p}-${randomBytes(5).toString('hex')}`

export function createCore(db: Database, files: ObjectStore, dataKey: Buffer, initial: State, opt: CoreOptions) {
  let state = initial
  let version = 1 // tăng sau mỗi thay đổi; trình duyệt dùng để hỏi “có gì mới không”
  const clock = opt.now ?? (() => new Date())
  const listeners = new Set<(v: number) => void>()
  const eventSinks = new Set<(events: DomainEvent[]) => Promise<void>>()
  const noticeSinks = new Set<(notices: NonNullable<Ctx['notices']>) => Promise<void>>()

  // Mọi thay đổi chạy tuần tự: bản nháp luôn dựng từ trạng thái đã ghi mới nhất.
  let chain: Promise<unknown> = Promise.resolve()
  function serial<T>(f: () => Promise<T>): Promise<T> {
    const p = chain.then(f, f)
    chain = p.catch(() => undefined)
    return p
  }

  /** Ghi bản nháp trong một giao dịch; chỉ thay trạng thái trong bộ nhớ khi CSDL đã chốt. */
  async function commit(draft: State) {
    try {
      await db.save(draft)
    } catch (e) {
      if (e instanceof ConstraintError) throw new HttpError(409, e.message)
      throw e
    }
    state = draft
    version++
    for (const l of listeners) l(version)
  }

  function ctxFor(draft: State, who: Who): Ctx {
    const orgId = who.kind === 'user' ? who.user.activeOrgId : who.orgId
    const actor = draft.orgs.find((o) => o.id === orgId)
    if (!actor) throw new HttpError(401, 'Tổ chức không tồn tại')
    const base = { s: draft, now: clock(), listedDir: opt.listedDir, autoApprove: !!opt.devAutologin, correlationId: who.correlationId, events: [] as DomainEvent[], notices: [] as NonNullable<Ctx['notices']> }
    if (who.kind === 'system') return { ...base, actor, role: 'system' as Role, authMethod: 'system' }
    if (who.kind === 'partner') return { ...base, actor, role: who.role, userId: `key:${who.keyId}`, authMethod: 'system' }
    return { ...base, actor, role: who.user.role, userId: who.user.id, authMethod: opt.devAutologin ? 'dev_session' : 'mfa' }
  }

  /** Chạy một hàm nghiệp vụ trên bản nháp, chỉ chốt khi không lỗi và CSDL chấp nhận; sau đó chuyển sự kiện tới webhook. */
  function mutate<T>(who: Who, fn: (c: Ctx) => T): Promise<T> {
    return serial(async () => {
      const draft: State = { ...state }
      const c = ctxFor(draft, who)
      const result = fn(c)
      await commit(draft)
      await dispatch(c.events ?? [], c.notices ?? [])
      return result
    })
  }
  async function dispatch(events: DomainEvent[], notices: NonNullable<Ctx['notices']> = []) {
    if (events.length) for (const sink of eventSinks) await sink(events)
    if (notices.length) for (const sink of noticeSinks) await sink(notices)
  }
  /** Chạy với một ngữ cảnh đã dựng sẵn (tác vụ định kỳ), cùng quy tắc chốt và phát sự kiện. */
  async function commitWithEvents(draft: State, events: DomainEvent[], notices: NonNullable<Ctx['notices']> = []) {
    await commit(draft)
    await dispatch(events, notices)
  }

  async function auth(req: FastifyRequest): Promise<Authed> {
    const h = req.headers.authorization
    const token = h?.startsWith('Bearer ') ? h.slice(7) : ''
    return authByHash(token ? hashToken(token) : '', token)
  }
  async function authByHash(tokenHash: string, token = ''): Promise<Authed> {
    const s = tokenHash ? await db.sessionUser(tokenHash) : undefined
    if (!s) throw new HttpError(401, 'Chưa đăng nhập, phiên đã hết hạn hoặc quyền thành viên đã bị thu hồi')
    return { ...s, role: s.role as MemberRole, token, tokenHash }
  }

  /** MFA trong STEP_UP_MS gần nhất; dev bỏ qua. */
  function requireStepUp(a: Authed) {
    if (opt.devAutologin) return
    if (!a.mfaEnabled) throw new HttpError(403, 'Thao tác này cần bật xác thực hai lớp (MFA) cho tài khoản — vào Cài đặt → Bảo mật')
    if (!a.mfaAt || clock().getTime() - new Date(a.mfaAt).getTime() > STEP_UP_MS) throw new HttpError(401, 'Cần xác thực MFA lại cho thao tác này (mã 6 số trong ứng dụng xác thực)')
  }

  function authorize(a: Authed, action: string) {
    if (!canDo(a.role, action)) throw forbidden(`Vai trò của bạn không được thực hiện thao tác này (${action})`)
    if (STEP_UP_ACTIONS.has(action)) requireStepUp(a)
  }

  const me = (a: Authed) => ({
    id: a.id, email: a.email, name: a.name, title: a.title, role: a.role, orgId: a.activeOrgId, activeOrgId: a.activeOrgId,
    mfaEnabled: a.mfaEnabled, mfaRequired: MFA_ROLES.includes(a.role),
  })
  const snapshot = (a: Authed) => ({ version, me: me(a), state: viewFor(state, a.activeOrgId, clock()) })

  /** Ghi một sự kiện nhật ký (cho các thao tác ngoài hành động nghiệp vụ, ví dụ chấm điểm, phiên bản bộ chấm điểm). */
  function audit(orgId: string, userId: string | undefined, action: string, entity: string, detail: string, correlationId?: string) {
    return serial(async () => {
      const draft: State = { ...state }
      draft.audit = [{ id: uid('EV'), at: clock().toISOString(), actorOrgId: orgId, actorUserId: userId, action, entity, detail, correlationId }, ...draft.audit]
      await commit(draft)
    })
  }

  return {
    audit, db, files, dataKey, opt, clock, serial, commit, mutate, auth, authByHash, authorize, requireStepUp, snapshot, me,
    getState: () => state,
    version: () => version,
    onChange: (l: (v: number) => void) => (listeners.add(l), () => listeners.delete(l)),
    onNotices: (sink: (notices: NonNullable<Ctx['notices']>) => Promise<void>) => (noticeSinks.add(sink), () => noticeSinks.delete(sink)),
    onEvents: (sink: (events: DomainEvent[]) => Promise<void>) => (eventSinks.add(sink), () => eventSinks.delete(sink)),
    commitWithEvents,
    sessionTokenHash: (token: string) => hashToken(token),
  }
}
