import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import type { IndustryGroup, Org, OrgType } from '@fcc/domain/types'
import { uid, type Core } from '../core'
import type { State } from '../state'
import { FailureLimiter, hashPassword, hashToken, newToken, verifyPassword } from '../auth/password'
import { newTotpSecret, otpauthUri, verifyTotp } from '../auth/totp'
import { seal, unseal } from '../auth/seal'
import { ROLE_LABEL, type MemberRole } from '../auth/roles'
import { HttpError, bad, notFound } from '../errors'
import { EMAIL_KINDS } from '../integrations/mailer'

export const SESSION_TTL = 12 * 3600_000
const RESET_TTL = 60 * 60_000
export const DEV_DOMAIN = '@dev.local'
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const INDUSTRY: IndustryGroup[] = ['manufacturing', 'trade', 'agri', 'tech']

export const str = (v: unknown, label: string, max = 200) => {
  if (typeof v !== 'string' || !v.trim()) throw bad(`Thiếu ${label}`)
  if (v.length > max) throw bad(`${label} quá dài`)
  return v.trim()
}
export const strongPassword = (p: unknown) => {
  if (typeof p !== 'string' || p.length < 10 || p.length > 200) throw bad('Mật khẩu tối thiểu 10 ký tự')
  return p
}

export function authRoutes(app: FastifyInstance, core: Core) {
  const { db } = core
  const loginLimit = new FailureLimiter(5, 15 * 60_000)
  const mfaLimit = new FailureLimiter(5, 15 * 60_000)
  const registerLimit = new FailureLimiter(10, 60 * 60_000)
  const forgotLimit = new FailureLimiter(5, 60 * 60_000)

  /** Phiên mới; tổ chức hoạt động mặc định là thành viên đầu tiên. */
  async function openSession(userId: string, orgId?: string, mfa = false) {
    const ms = await db.membershipsOf(userId)
    const active = (orgId && ms.find((m) => m.orgId === orgId)) || ms[0]
    if (!active) throw new HttpError(403, 'Tài khoản không còn thuộc tổ chức nào')
    const token = newToken()
    await db.createSession(hashToken(token), userId, SESSION_TTL, active.orgId, mfa ? core.clock() : null)
    const a = await core.auth({ headers: { authorization: `Bearer ${token}` } } as never)
    return { token, ...core.snapshot(a), memberships: await membershipView(userId) }
  }

  async function membershipView(userId: string) {
    const orgs = core.getState().orgs
    return (await db.membershipsOf(userId)).map((m) => {
      const o = orgs.find((x) => x.id === m.orgId)
      return { orgId: m.orgId, orgName: o?.name ?? m.orgId, orgType: o?.type, role: m.role, roleLabel: ROLE_LABEL[m.role as MemberRole] ?? m.role }
    })
  }

  /** Kiểm tra mã TOTP của người dùng (chống dùng lại cùng mã, khóa tạm khi sai nhiều lần). */
  async function checkCode(userId: string, code: unknown) {
    if (mfaLimit.blocked(userId)) throw new HttpError(429, 'Nhập sai mã quá nhiều lần, thử lại sau 15 phút')
    const m = await db.getMfa(userId)
    if (!m?.secret) throw bad('Tài khoản chưa thiết lập MFA')
    const step = typeof code === 'string' ? verifyTotp(unseal(core.dataKey, m.secret), code.trim(), core.clock().getTime()) : null
    if (step === null || !(await db.useMfaStep(userId, step))) {
      mfaLimit.fail(userId)
      throw new HttpError(401, 'Mã xác thực không đúng hoặc đã được dùng')
    }
    mfaLimit.clear(userId)
  }

  app.post('/api/auth/register', async (req, reply) => {
    if (registerLimit.blocked(req.ip)) throw new HttpError(429, 'Đăng ký quá nhiều lần, thử lại sau')
    registerLimit.fail(req.ip)
    const b = (req.body ?? {}) as { email?: string; password?: string; name?: string; title?: string; org?: Record<string, unknown> }
    const email = str(b.email, 'email', 120).toLowerCase()
    if (!EMAIL.test(email)) throw bad('Email không hợp lệ')
    const password = strongPassword(b.password)
    const o = b.org ?? {}
    const type = o.type as OrgType
    if (!['buyer', 'supplier', 'lender'].includes(type)) throw bad('Loại tổ chức phải là bên mua, nhà cung cấp hoặc tổ chức tài chính')
    const taxCode = str(o.taxCode, 'mã số thuế', 20).replace(/[\s.]/g, '')
    if (!/^\d{10}(-?\d{3})?$/.test(taxCode)) throw bad('Mã số thuế phải gồm 10 hoặc 13 chữ số')
    const industryGroup = o.industryGroup as IndustryGroup
    if (!INDUSTRY.includes(industryGroup)) throw bad('Nhóm ngành không hợp lệ')
    const foundedYear = Number(o.foundedYear)
    const employees = Number(o.employees)
    if (!Number.isInteger(foundedYear) || foundedYear < 1900 || foundedYear > core.clock().getFullYear()) throw bad('Năm thành lập không hợp lệ')
    if (!Number.isInteger(employees) || employees < 0) throw bad('Số lao động không hợp lệ')
    const listedSymbol = type === 'buyer' && typeof o.listedSymbol === 'string' && o.listedSymbol.trim() ? o.listedSymbol.trim().toUpperCase() : undefined
    if (listedSymbol && !/^[A-Z0-9]{2,6}$/.test(listedSymbol)) throw bad('Mã chứng khoán không hợp lệ')
    if (await db.userByEmail(email)) throw new HttpError(409, 'Email đã được đăng ký')
    if (core.getState().orgs.some((x) => x.taxCode === taxCode)) throw new HttpError(409, 'Mã số thuế đã được đăng ký trên hệ thống')

    const now = core.clock().toISOString()
    const org: Org = {
      id: uid(type[0]), name: str(o.name, 'tên tổ chức'), shortName: str(o.shortName ?? o.name, 'tên viết tắt', 40), taxCode, type,
      vsic: str(o.vsic, 'mã ngành VSIC', 8), industryLabel: str(o.industryLabel, 'ngành nghề'), industryGroup,
      listedSymbol, exchange: listedSymbol && ['HOSE', 'HNX', 'UPCOM'].includes(String(o.exchange)) ? (o.exchange as Org['exchange']) : undefined,
      foundedYear, employees, province: str(o.province, 'tỉnh/thành'), createdAt: now, verified: type === 'lender' ? false : undefined,
    }
    const user = { id: uid('u'), email, passwordHash: hashPassword(password), orgId: org.id, name: str(b.name, 'họ tên', 80), title: str(b.title, 'chức danh', 80), role: 'owner' }
    await core.serial(async () => {
      const draft: State = { ...core.getState() }
      draft.orgs = [...draft.orgs, org]
      draft.audit = [{ id: uid('EV'), at: now, actorOrgId: org.id, actorUserId: user.id, action: 'Đăng ký tổ chức', entity: org.id, detail: `${org.name} (${type})` }, ...draft.audit]
      for (const f of draft.orgs.filter((x) => x.type === 'fcc')) {
        const title = type === 'lender' ? 'Tổ chức tài chính mới chờ xác minh' : 'Tổ chức mới đăng ký'
        draft.notifications = [{ id: uid('N'), orgId: f.id, at: now, title, body: `${org.name} (MST ${org.taxCode})`, link: '/admin', read: false }, ...draft.notifications]
      }
      await core.commit(draft)
      await db.createUser(user)
    })
    return reply.code(201).send(await openSession(user.id, org.id))
  })

  app.post('/api/auth/login', async (req) => {
    const { email, password, code, orgId } = (req.body ?? {}) as { email?: string; password?: string; code?: string; orgId?: string }
    const key = `${String(email).toLowerCase()}|${req.ip}`
    if (loginLimit.blocked(key)) throw new HttpError(429, 'Đăng nhập sai quá nhiều lần, thử lại sau 15 phút')
    const u = typeof email === 'string' ? await db.userByEmail(email.toLowerCase()) : undefined
    // luôn băm một lần để thời gian phản hồi không lộ email nào tồn tại
    const ok = verifyPassword(typeof password === 'string' ? password : '', u?.passwordHash ?? hashPassword('dummy-password'))
    if (!u || !ok) {
      loginLimit.fail(key)
      throw new HttpError(401, 'Email hoặc mật khẩu không đúng')
    }
    loginLimit.clear(key)
    if (u.mfaEnabled) {
      if (!code) throw Object.assign(new HttpError(401, 'Nhập mã xác thực 6 số trong ứng dụng xác thực'), { mfaRequired: true })
      await checkCode(u.id, code)
    }
    return openSession(u.id, orgId, u.mfaEnabled)
  })

  app.post('/api/auth/logout', async (req) => {
    const a = await core.auth(req)
    await db.deleteSession(a.tokenHash)
    return { ok: true }
  })

  app.get('/api/auth/me', async (req) => {
    const a = await core.auth(req)
    return { me: core.me(a), memberships: await membershipView(a.id) }
  })

  app.post('/api/auth/switch-org', async (req) => {
    const a = await core.auth(req)
    const { orgId } = (req.body ?? {}) as { orgId?: string }
    if (!(await db.membershipsOf(a.id)).some((m) => m.orgId === orgId)) throw new HttpError(403, 'Bạn không thuộc tổ chức này')
    await db.setActiveOrg(a.tokenHash, orgId!)
    return { ...core.snapshot(await core.auth(req)), memberships: await membershipView(a.id) }
  })

  // ---- MFA (TOTP) ----
  app.post('/api/auth/mfa/setup', async (req) => {
    const a = await core.auth(req)
    if (a.mfaEnabled) throw new HttpError(409, 'MFA đã bật; tắt MFA trước khi thiết lập lại')
    const secret = newTotpSecret()
    await db.setMfaSecret(a.id, seal(core.dataKey, secret), false)
    return { secret, otpauthUri: otpauthUri(secret, a.email), note: 'Quét mã/nhập khóa vào ứng dụng xác thực rồi gửi mã 6 số để bật MFA.' }
  })
  app.post('/api/auth/mfa/enable', async (req) => {
    const a = await core.auth(req)
    if (a.mfaEnabled) throw new HttpError(409, 'MFA đã bật')
    await checkCode(a.id, (req.body as { code?: string } | undefined)?.code)
    await db.enableMfa(a.id) // giữ bước đã dùng: mã vừa nhập không dùng lại được
    await db.markSessionMfa(a.tokenHash, core.clock())
    await logSecurity(a, 'Bật xác thực hai lớp (MFA)')
    return { ok: true }
  })
  app.post('/api/auth/mfa/verify', async (req) => {
    const a = await core.auth(req)
    await checkCode(a.id, (req.body as { code?: string } | undefined)?.code)
    await db.markSessionMfa(a.tokenHash, core.clock())
    return { ok: true, validForMinutes: 10 }
  })
  app.post('/api/auth/mfa/disable', async (req) => {
    const a = await core.auth(req)
    if (!a.mfaEnabled) throw bad('MFA chưa bật')
    await checkCode(a.id, (req.body as { code?: string } | undefined)?.code)
    await db.setMfaSecret(a.id, null, false)
    await logSecurity(a, 'Tắt xác thực hai lớp (MFA)')
    return { ok: true }
  })

  // ---- tùy chọn nhận email ----
  app.get('/api/auth/email-prefs', async (req) => {
    const a = await core.auth(req)
    const prefs = await db.emailPrefs(a.id)
    return { kinds: Object.entries(EMAIL_KINDS).map(([k, label]) => ({ kind: k, label, enabled: k === 'account' ? true : prefs[k] !== false, locked: k === 'account' })) }
  })
  app.post('/api/auth/email-prefs', async (req) => {
    const a = await core.auth(req)
    const body = ((req.body ?? {}) as { prefs?: Record<string, unknown> }).prefs ?? {}
    const clean: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(body)) {
      if (!(k in EMAIL_KINDS)) throw bad(`Loại thông báo không hợp lệ: ${k}`)
      if (k !== 'account') clean[k] = !!v
    }
    await db.setEmailPrefs(a.id, { ...(await db.emailPrefs(a.id)), ...clean })
    return { ok: true }
  })

  // ---- mật khẩu ----
  app.post('/api/auth/password/forgot', async (req) => {
    const email = String((req.body as { email?: string } | undefined)?.email ?? '').toLowerCase()
    if (forgotLimit.blocked(req.ip)) throw new HttpError(429, 'Thử lại sau')
    forgotLimit.fail(req.ip)
    const u = EMAIL.test(email) ? await db.userByEmail(email) : undefined
    if (u) {
      const token = newToken()
      await db.createPasswordReset(hashToken(token), u.id, RESET_TTL)
      await db.queueEmail({
        to: u.email, kind: 'password_reset', subject: 'FCC — đặt lại mật khẩu',
        body: `Chào ${u.name},\n\nMở liên kết sau trong 60 phút để đặt mật khẩu mới:\n${core.opt.appUrl}/reset-password?token=${token}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      })
    }
    // luôn trả cùng một câu để không lộ email nào có tài khoản
    return { ok: true, message: 'Nếu email có tài khoản, liên kết đặt lại mật khẩu đã được gửi.' }
  })
  app.post('/api/auth/password/reset', async (req) => {
    const b = (req.body ?? {}) as { token?: string; password?: string }
    const password = strongPassword(b.password)
    const userId = typeof b.token === 'string' ? await db.consumePasswordReset(hashToken(b.token)) : undefined
    if (!userId) throw bad('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
    await db.setPassword(userId, hashPassword(password))
    return { ok: true }
  })
  app.post('/api/auth/password/change', async (req) => {
    const a = await core.auth(req)
    const b = (req.body ?? {}) as { current?: string; password?: string }
    const u = await db.userById(a.id)
    if (!u || !verifyPassword(String(b.current ?? ''), u.passwordHash)) throw new HttpError(401, 'Mật khẩu hiện tại không đúng')
    await db.setPassword(a.id, hashPassword(strongPassword(b.password)))
    await logSecurity(a, 'Đổi mật khẩu (các phiên khác đã bị thu hồi)')
    return openSession(a.id, a.activeOrgId, false)
  })

  async function logSecurity(a: { id: string; activeOrgId: string }, action: string) {
    await core.serial(async () => {
      const draft: State = { ...core.getState() }
      draft.audit = [{ id: uid('EV'), at: core.clock().toISOString(), actorOrgId: a.activeOrgId, actorUserId: a.id, action, entity: a.id, detail: 'Bảo mật tài khoản' }, ...draft.audit]
      await core.commit(draft)
    })
  }

  // ---- chế độ dev: mỗi vai trò một tài khoản trống ----
  const DEV_ORGS: Record<string, { type: OrgType; name: string; tax: string; user: string; role: MemberRole }> = {
    supplier: { type: 'supplier', name: 'Nhà cung cấp (tài khoản dev)', tax: '1000000001', user: 'Nhà cung cấp', role: 'owner' },
    buyer: { type: 'buyer', name: 'Bên mua (tài khoản dev)', tax: '1000000002', user: 'Bên mua', role: 'owner' },
    lender: { type: 'lender', name: 'Tổ chức tài chính (tài khoản dev)', tax: '1000000003', user: 'Tổ chức tài chính', role: 'owner' },
    fcc: { type: 'fcc', name: 'Vận hành nền tảng FCC (dev)', tax: 'FCC-OPS-DEV', user: 'Nhân sự FCC', role: 'fcc_admin' },
  }
  app.post('/api/dev/session', async (req) => {
    if (!core.opt.devAutologin) throw notFound('Chế độ dev đã tắt')
    const role = String((req.body as { role?: string } | undefined)?.role)
    const d = Object.hasOwn(DEV_ORGS, role) ? DEV_ORGS[role] : undefined
    if (!d) throw bad('Bên không hợp lệ (supplier | buyer | lender | fcc)')
    const email = `${role}${DEV_DOMAIN}`
    const u = await core.serial(async () => {
      const found = await db.userByEmail(email)
      if (found) return found
      const draft: State = { ...core.getState() }
      let org = draft.orgs.find((o) => o.taxCode === d.tax)
      if (!org) {
        const now = core.clock()
        org = { id: uid(d.type[0]), name: d.name, shortName: d.user, taxCode: d.tax, type: d.type, vsic: '0000', industryLabel: 'Chưa khai báo', industryGroup: 'manufacturing', foundedYear: now.getFullYear(), employees: 0, province: 'Chưa khai báo', createdAt: now.toISOString(), verified: d.type === 'lender' ? true : undefined }
        draft.orgs = [...draft.orgs, org]
        await core.commit(draft)
      }
      await db.createUser({ id: uid('u'), email, passwordHash: hashPassword(randomBytes(24).toString('hex')), orgId: org.id, name: d.user, title: 'Tài khoản dev', role: d.role })
      return (await db.userByEmail(email))!
    })
    return openSession(u.id)
  })

  return { openSession, membershipView, checkCode }
}
