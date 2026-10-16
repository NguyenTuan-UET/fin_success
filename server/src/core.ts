// Lõi dùng chung cho các route: trạng thái nghiệp vụ trong bộ nhớ, hàng đợi ghi tuần tự, xác thực phiên, kiểm tra quyền.
import type { FastifyRequest } from 'fastify'
import { randomBytes } from 'node:crypto'
import { ConstraintError, type Database, type SessionInfo, type State } from './state'
import type { ObjectStore } from './storage'
import type { Ctx, Role } from './service'
import { canDo, MFA_ROLES, STEP_UP_ACTIONS, STEP_UP_MS, type MemberRole } from './auth/roles'
import { hashToken } from './auth/password'
import { HttpError, forbidden } from './errors'
import { viewFor } from './views'

export interface CoreOptions {
  listedDir: string
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

export type Core = ReturnType<typeof createCore>

export const uid = (p: string) => `${p}-${randomBytes(5).toString('hex')}`

export function createCore(db: Database, files: ObjectStore, dataKey: Buffer, initial: State, opt: CoreOptions) {
  let state = initial
  let version = 1 // tăng sau mỗi thay đổi; trình duyệt dùng để hỏi “có gì mới không”
  const clock = opt.now ?? (() => new Date())
  const listeners = new Set<(v: number) => void>()

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
    const base = { s: draft, now: clock(), listedDir: opt.listedDir, autoApprove: !!opt.devAutologin, correlationId: who.correlationId }
    if (who.kind === 'system') return { ...base, actor, role: 'system' as Role, authMethod: 'system' }
    return { ...base, actor, role: who.user.role, userId: who.user.id, authMethod: opt.devAutologin ? 'dev_session' : 'mfa' }
  }

  /** Chạy một hàm nghiệp vụ trên bản nháp, chỉ chốt khi không lỗi và CSDL chấp nhận. */
  function mutate<T>(who: Who, fn: (c: Ctx) => T): Promise<T> {
    return serial(async () => {
      const draft: State = { ...state }
      const result = fn(ctxFor(draft, who))
      await commit(draft)
      return result
    })
  }

  async function auth(req: FastifyRequest): Promise<Authed> {
    const h = req.headers.authorization
    const token = h?.startsWith('Bearer ') ? h.slice(7) : ''
    const tokenHash = token ? hashToken(token) : ''
    const s = token ? await db.sessionUser(tokenHash) : undefined
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

  return {
    db, files, dataKey, opt, clock, serial, commit, mutate, auth, authorize, requireStepUp, snapshot, me,
    getState: () => state,
    version: () => version,
    onChange: (l: (v: number) => void) => (listeners.add(l), () => listeners.delete(l)),
    sessionTokenHash: (token: string) => hashToken(token),
  }
}
