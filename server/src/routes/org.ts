import type { FastifyInstance } from 'fastify'
import { uid, type Core } from '../core'
import type { State } from '../state'
import { hashPassword, hashToken, newToken, verifyPassword } from '../auth/password'
import { isAdminRole, ROLE_LABEL, ROLES_BY_ORG, type MemberRole } from '../auth/roles'
import { HttpError, bad, forbidden, notFound } from '../errors'
import { EMAIL, str, strongPassword } from './auth'

const INVITE_TTL = 7 * 86_400_000
/** Loại tệp được tải lên: chứng từ hóa đơn, giấy tờ pháp lý, bằng chứng ESG, BCTC, hợp đồng… */
const MIME_OK = /^(application\/(pdf|xml|zip|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-excel)|text\/(xml|csv|plain)|image\/(png|jpeg|webp))$/
const MAX_FILE = 15 * 1024 * 1024

export function orgRoutes(app: FastifyInstance, core: Core, openSession: (userId: string, orgId?: string, mfa?: boolean) => Promise<unknown>) {
  const { db } = core

  const orgOf = (id: string) => core.getState().orgs.find((o) => o.id === id)

  async function audit(orgId: string, userId: string, action: string, entity: string, detail: string) {
    await core.serial(async () => {
      const draft: State = { ...core.getState() }
      draft.audit = [{ id: uid('EV'), at: core.clock().toISOString(), actorOrgId: orgId, actorUserId: userId, action, entity, detail }, ...draft.audit]
      await core.commit(draft)
    })
  }
  const requireOwner = (role: MemberRole) => {
    if (!isAdminRole(role)) throw forbidden('Chỉ chủ tổ chức quản lý thành viên')
  }

  // ---- thành viên ----
  app.get('/api/org/members', async (req) => {
    const a = await core.auth(req)
    const members = (await db.membersOf(a.activeOrgId)).map((m) => ({ ...m, roleLabel: ROLE_LABEL[m.role as MemberRole] ?? m.role }))
    const invitations = isAdminRole(a.role) ? await db.pendingInvitations(a.activeOrgId) : []
    const org = orgOf(a.activeOrgId)!
    return { members, invitations, roles: ROLES_BY_ORG[org.type].map((r) => ({ role: r, label: ROLE_LABEL[r] })) }
  })

  app.post('/api/org/invitations', async (req) => {
    const a = await core.auth(req)
    requireOwner(a.role)
    core.requireStepUp(a) // thay quyền: cần MFA gần đây
    const b = (req.body ?? {}) as { email?: string; role?: string }
    const email = str(b.email, 'email', 120).toLowerCase()
    if (!EMAIL.test(email)) throw bad('Email không hợp lệ')
    const org = orgOf(a.activeOrgId)!
    const role = b.role as MemberRole
    if (!ROLES_BY_ORG[org.type].includes(role)) throw bad(`Vai trò không hợp lệ với ${org.type}: ${ROLES_BY_ORG[org.type].join(', ')}`)
    const existing = await db.userByEmail(email)
    if (existing && (await db.membershipsOf(existing.id)).some((m) => m.orgId === org.id)) throw new HttpError(409, 'Người này đã là thành viên')
    const token = newToken()
    await db.createInvitation({ tokenHash: hashToken(token), orgId: org.id, email, role, invitedBy: a.id, ttlMs: INVITE_TTL })
    const inviteUrl = `${core.opt.appUrl}/invite?token=${token}`
    await db.queueEmail({
      to: email, kind: 'invitation', subject: `FCC — lời mời tham gia ${org.name}`,
      body: `${a.name} mời bạn tham gia ${org.name} trên FCC với vai trò ${ROLE_LABEL[role]}.\n\nNhận lời mời trong 7 ngày:\n${inviteUrl}`,
    })
    await audit(org.id, a.id, 'Mời thành viên', email, ROLE_LABEL[role])
    // trả liên kết để chủ tổ chức có thể gửi qua kênh khác nếu email chậm
    return { ok: true, inviteUrl }
  })

  app.get('/api/invitations/:token', async (req) => {
    const inv = await db.invitation(hashToken((req.params as { token: string }).token))
    if (!inv) throw notFound('Lời mời không tồn tại')
    const org = orgOf(inv.orgId)
    const exists = !!(await db.userByEmail(inv.email))
    return { orgName: org?.name, orgType: org?.type, email: inv.email, role: inv.role, roleLabel: ROLE_LABEL[inv.role as MemberRole], valid: !inv.acceptedAt && inv.expiresAt > core.clock(), hasAccount: exists }
  })

  app.post('/api/invitations/:token/accept', async (req, reply) => {
    const tokenHash = hashToken((req.params as { token: string }).token)
    const inv = await db.invitation(tokenHash)
    if (!inv || inv.acceptedAt || inv.expiresAt <= core.clock()) throw bad('Lời mời không hợp lệ hoặc đã hết hạn')
    const b = (req.body ?? {}) as { password?: string; name?: string; title?: string }
    let user = await db.userByEmail(inv.email)
    if (user) {
      // đã có tài khoản: xác nhận bằng mật khẩu hiện tại
      if (!verifyPassword(String(b.password ?? ''), user.passwordHash)) throw new HttpError(401, 'Mật khẩu không đúng')
    } else {
      await db.createUser({ id: uid('u'), email: inv.email, passwordHash: hashPassword(strongPassword(b.password)), orgId: inv.orgId, name: str(b.name, 'họ tên', 80), title: str(b.title, 'chức danh', 80), role: inv.role })
      user = (await db.userByEmail(inv.email))!
    }
    if (!(await db.consumeInvitation(tokenHash, user.id))) throw bad('Lời mời đã được dùng')
    await db.addMembership(user.id, inv.orgId, inv.role)
    await audit(inv.orgId, user.id, 'Nhận lời mời thành viên', user.email, ROLE_LABEL[inv.role as MemberRole])
    return reply.code(201).send(await openSession(user.id, inv.orgId))
  })

  app.post('/api/org/members/:userId/role', async (req) => {
    const a = await core.auth(req)
    requireOwner(a.role)
    core.requireStepUp(a) // thay quyền: cần MFA gần đây
    const userId = (req.params as { userId: string }).userId
    const role = (req.body as { role?: string } | undefined)?.role as MemberRole
    const org = orgOf(a.activeOrgId)!
    if (!ROLES_BY_ORG[org.type].includes(role)) throw bad('Vai trò không hợp lệ')
    await guardLastOwner(a.activeOrgId, userId, role)
    if (!(await db.setMemberRole(a.activeOrgId, userId, role))) throw notFound('Không tìm thấy thành viên')
    await audit(a.activeOrgId, a.id, 'Đổi vai trò thành viên', userId, ROLE_LABEL[role])
    return { ok: true }
  })

  app.post('/api/org/members/:userId/revoke', async (req) => {
    const a = await core.auth(req)
    requireOwner(a.role)
    const userId = (req.params as { userId: string }).userId
    await guardLastOwner(a.activeOrgId, userId, null)
    if (!(await db.revokeMember(a.activeOrgId, userId))) throw notFound('Không tìm thấy thành viên')
    await audit(a.activeOrgId, a.id, 'Thu hồi thành viên', userId, 'Hiệu lực ngay với mọi phiên')
    return { ok: true }
  })

  /** Không để tổ chức mất chủ cuối cùng. */
  async function guardLastOwner(orgId: string, userId: string, nextRole: MemberRole | null) {
    const ownerRole = orgOf(orgId)?.type === 'fcc' ? 'fcc_admin' : 'owner'
    const target = (await db.membersOf(orgId)).find((m) => m.userId === userId && m.status === 'active')
    if (target?.role === ownerRole && nextRole !== ownerRole && (await db.countActiveRole(orgId, ownerRole)) <= 1) {
      throw new HttpError(409, 'Tổ chức cần ít nhất một chủ tổ chức')
    }
  }

  // ---- tệp ----
  app.post('/api/files', async (req, reply) => {
    const a = await core.auth(req)
    if (a.role === 'fcc_auditor') throw forbidden('Tài khoản kiểm toán chỉ đọc')
    const b = (req.body ?? {}) as { name?: string; mime?: string; dataBase64?: string; kind?: string }
    const name = str(b.name, 'tên tệp', 200)
    const mime = String(b.mime ?? '')
    if (!MIME_OK.test(mime)) throw bad('Loại tệp không được hỗ trợ (PDF, XML, ảnh, Excel, CSV, ZIP)')
    if (typeof b.dataBase64 !== 'string' || !b.dataBase64) throw bad('Thiếu nội dung tệp')
    const data = Buffer.from(b.dataBase64, 'base64')
    if (!data.length || data.length > MAX_FILE) throw bad('Tệp rỗng hoặc lớn hơn 15 MB')
    const o = core.files.put(data, mime)
    await db.addFile({ key: o.key, orgId: a.activeOrgId, name, mime, size: o.size, kind: str(b.kind ?? 'document', 'loại', 40), uploadedBy: a.id })
    return reply.code(201).send({ ...o, name })
  })

  /** URL tải có hạn: chủ sở hữu tệp, hoặc nhân sự FCC với hồ sơ được giao thẩm định (KYC, bằng chứng ESG) — FCC không xem chứng từ hóa đơn, hợp đồng, giao nhận. */
  app.get('/api/files/:key/url', async (req) => {
    const a = await core.auth(req)
    const key = (req.params as { key: string }).key
    const own = await db.fileOf(key, a.activeOrgId)
    const fcc = orgOf(a.activeOrgId)?.type === 'fcc'
    // bên mua của khoản đã gửi, hoặc tổ chức tài chính có hồ sơ trên khoản đó, được xem chứng từ gắn với khoản phải thu
    const st = core.getState()
    const party = st.receivables.some((r) => r.files?.some((f) => f.key === key) && r.state !== 'DRAFT' &&
      (r.buyerId === a.activeOrgId || st.applications.some((x) => x.receivableId === r.id && x.lenderId === a.activeOrgId)))
    if (!own && !party && !(fcc && (await db.fccReviewableFile(key)))) throw notFound('Không tìm thấy tệp')
    return { url: core.files.signedPath(key, 300, core.clock().getTime()), expiresInSeconds: 300 }
  })

  app.get('/v1/files/:key', async (req, reply) => {
    const key = (req.params as { key: string }).key
    const q = req.query as { exp?: string; sig?: string }
    if (!core.files.verifySigned(key, Number(q.exp), String(q.sig ?? ''), core.clock().getTime())) throw new HttpError(403, 'Liên kết tải không hợp lệ hoặc đã hết hạn')
    const meta = await db.anyFile(key)
    if (!meta) throw notFound('Không tìm thấy tệp')
    return reply.type(meta.mime).header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`).header('cache-control', 'private, no-store').send(core.files.get(key))
  })
}
