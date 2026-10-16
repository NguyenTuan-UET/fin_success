import { afterAll, describe, expect, it } from 'vitest'
import { dropSchema, newSchema, startApp } from './helpers'
import { totp } from '../src/auth/totp'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const schema = newSchema()
const ADMIN = { email: 'ops@example.test', password: 'ops-password-123' }
const PW = 'correct-horse-battery'
let offset = 0
const now = () => new Date(Date.now() + offset)
const code = (secret: string) => {
  offset += 30_000
  return totp(secret, now().getTime())
}
const app = await startApp(schema, { admin: ADMIN, now })
afterAll(async () => {
  await app.close()
  await dropSchema(schema)
})

async function call(method: 'GET' | 'POST', url: string, body?: unknown, token?: string) {
  const r = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(body !== undefined ? { payload: body as never } : {}) })
  return { status: r.statusCode, body: r.json() as Json }
}
const post = (url: string, body: unknown, token?: string) => call('POST', url, body, token)
const act = (token: string, name: string, ...args: unknown[]) => post(`/api/actions/${name}`, { args }, token)
let mst = 4_000_000_000
async function register(type: string, name: string) {
  const email = `${name}@example.test`
  const r = await post('/api/auth/register', {
    email, password: PW, name, title: 'Giám đốc',
    org: { name: `Công ty ${name}`, shortName: name, taxCode: String(++mst), type, vsic: '2592', industryLabel: 'Cơ khí', industryGroup: 'manufacturing', foundedYear: 2015, employees: 10, province: 'Hà Nội' },
  })
  expect(r.status, JSON.stringify(r.body)).toBe(201)
  return { token: r.body.token as string, orgId: r.body.me.activeOrgId as string, email, userId: r.body.me.id as string }
}
async function enableMfa(token: string) {
  const s = await post('/api/auth/mfa/setup', {}, token)
  expect((await post('/api/auth/mfa/enable', { code: code(s.body.secret) }, token)).status).toBe(200)
  return s.body.secret as string
}
const inviteToken = (url: string) => new URL(url).searchParams.get('token')!
let adminToken = ''

describe('thành viên, vai trò, phân quyền theo hành động', () => {
  it('chủ tổ chức mời người lập hồ sơ; người lập hồ sơ không chia sẻ dữ liệu hay chấp thuận được', async () => {
    const S = await register('supplier', 'sup1')
    expect(S.userId).toBeTruthy()
    const inv = await post('/api/org/invitations', { email: 'opr@example.test', role: 'operator' }, S.token)
    expect(inv.status, JSON.stringify(inv.body)).toBe(200)
    expect((await post('/api/org/invitations', { email: 'x@example.test', role: 'analyst' }, S.token)).status).toBe(400) // vai trò của tổ chức tài chính
    const t = inviteToken(inv.body.inviteUrl)
    expect((await call('GET', `/api/invitations/${t}`)).body).toMatchObject({ email: 'opr@example.test', role: 'operator', valid: true, hasAccount: false })
    const acc = await post(`/api/invitations/${t}/accept`, { password: PW, name: 'Người lập', title: 'Kế toán' })
    expect(acc.status, JSON.stringify(acc.body)).toBe(201)
    expect((await post(`/api/invitations/${t}/accept`, { password: PW, name: 'x', title: 'x' })).status).toBe(400) // dùng một lần
    const op = acc.body.token as string
    expect(acc.body.me.role).toBe('operator')
    expect((await post('/api/org/invitations', { email: 'y@example.test', role: 'operator' }, op)).status).toBe(403)
    expect((await act(op, 'updateOrg', { employees: 5 })).status).toBe(403)
    expect((await act(op, 'createRfq', 'r', ['p'])).status).toBe(403)
    expect((await act(op, 'acceptOffer', 'a')).status).toBe(403)
    expect((await act(op, 'saveCashProfile', S.orgId, { openingCash: 1_000_000, recurringMonthlyOut: [] })).status).toBe(200)

    // thu hồi có hiệu lực ngay với yêu cầu tiếp theo
    const members = (await call('GET', '/api/org/members', undefined, S.token)).body.members
    const opId = members.find((m: Json) => m.email === 'opr@example.test').userId
    expect((await post(`/api/org/members/${opId}/revoke`, {}, S.token)).status).toBe(200)
    expect((await call('GET', '/api/state', undefined, op)).status).toBe(401)
    // không bỏ được chủ tổ chức cuối cùng
    expect((await post(`/api/org/members/${S.userId}/role`, { role: 'operator' }, S.token)).status).toBe(409)
    expect((await post(`/api/org/members/${S.userId}/revoke`, {}, S.token)).status).toBe(409)
  })

  it('một người thuộc nhiều tổ chức, chuyển tổ chức đang hoạt động; không chuyển sang tổ chức khác', async () => {
    const A = await register('supplier', 'multiA')
    const B = await register('buyer', 'multiB')
    const inv = await post('/api/org/invitations', { email: A.email, role: 'approver' }, B.token)
    const t = inviteToken(inv.body.inviteUrl)
    expect((await post(`/api/invitations/${t}/accept`, { password: 'sai-mat-khau-1' })).status).toBe(401)
    const acc = await post(`/api/invitations/${t}/accept`, { password: PW })
    expect(acc.status).toBe(201)
    expect(acc.body.memberships.map((m: Json) => m.orgId).sort()).toEqual([A.orgId, B.orgId].sort())
    const sw = await post('/api/auth/switch-org', { orgId: A.orgId }, acc.body.token)
    expect(sw.status).toBe(200)
    expect(sw.body.me).toMatchObject({ activeOrgId: A.orgId, role: 'owner' })
    const C = await register('lender', 'multiC')
    expect((await post('/api/auth/switch-org', { orgId: C.orgId }, acc.body.token)).status).toBe(403)
  })
})

describe('mật khẩu', () => {
  it('quên mật khẩu: không lộ email có tài khoản; đặt lại thu hồi mọi phiên cũ', async () => {
    const U = await register('buyer', 'forgot1')
    const a = await post('/api/auth/password/forgot', { email: U.email })
    const b = await post('/api/auth/password/forgot', { email: 'khong-ton-tai@example.test' })
    expect(a.body).toEqual(b.body)
    const mail = (await app.db.rawQuery(`SELECT body FROM email_outbox WHERE to_email = $1 AND kind = 'password_reset'`, [U.email])).rows[0].body as string
    const token = /token=([0-9a-f]+)/.exec(mail)![1]
    expect((await post('/api/auth/password/reset', { token, password: 'short' })).status).toBe(400)
    expect((await post('/api/auth/password/reset', { token, password: 'mat-khau-moi-123' })).status).toBe(200)
    expect((await post('/api/auth/password/reset', { token, password: 'mat-khau-moi-456' })).status).toBe(400) // dùng một lần
    expect((await call('GET', '/api/state', undefined, U.token)).status).toBe(401)
    expect((await post('/api/auth/login', { email: U.email, password: 'mat-khau-moi-123' })).status).toBe(200)
  })
})

describe('xác minh người đại diện (KYC) với giấy tờ trong kho tệp', () => {
  it('doanh nghiệp tải giấy tờ, nộp hồ sơ; FCC (có MFA) xem tệp qua URL ký và duyệt', async () => {
    const S = await register('supplier', 'kyc1')
    const other = await register('supplier', 'kyc2')
    const up = await post('/api/files', { name: 'cccd.pdf', mime: 'application/pdf', dataBase64: Buffer.from('%PDF-1.4 giấy tờ').toString('base64'), kind: 'kyc' }, S.token)
    expect(up.status, JSON.stringify(up.body)).toBe(201)
    expect((await post('/api/files', { name: 'x.exe', mime: 'application/x-msdownload', dataBase64: 'AA==' }, S.token)).status).toBe(400)
    expect((await act(other.token, 'submitKyc', { representativeName: 'Nguyễn Văn A', documentKeys: [up.body.key] })).status).toBe(400) // tệp của tổ chức khác
    expect((await call('GET', `/api/files/${up.body.key}/url`, undefined, other.token)).status).toBe(404)
    const sub = await act(S.token, 'submitKyc', { representativeName: 'Nguyễn Văn A', documentKeys: [up.body.key] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)

    const adm = (await post('/api/auth/login', ADMIN)).body.token as string
    expect((await act(adm, 'decideKyc', S.orgId, true)).status).toBe(403) // chưa bật MFA
    await enableMfa(adm)
    adminToken = adm
    const u = await call('GET', `/api/files/${up.body.key}/url`, undefined, adm)
    expect(u.status).toBe(200)
    const file = await app.inject({ method: 'GET', url: u.body.url })
    expect(file.statusCode).toBe(200)
    expect(file.body).toContain('giấy tờ')
    expect((await app.inject({ method: 'GET', url: u.body.url.replace(/sig=(\w)/, (_, c) => `sig=${c === '0' ? '1' : '0'}`) })).statusCode).toBe(403)
    const d = await act(adm, 'decideKyc', S.orgId, true)
    expect(d.status, JSON.stringify(d.body)).toBe(200)
    expect(d.body.state.orgs.find((o: Json) => o.id === S.orgId).kyc).toMatchObject({ status: 'verified', method: 'manual_documents' })
  })

  it('tài khoản kiểm toán FCC xem được dữ liệu nhưng không thao tác, không tải tệp', async () => {
    const adminSecret = (await app.db.rawQuery(`SELECT mfa_secret FROM users WHERE email = $1`, [ADMIN.email])).rows[0].mfa_secret as string
    expect(adminSecret.startsWith('v1.')).toBe(true) // secret MFA được mã hóa khi lưu
    expect((await post('/api/auth/login', ADMIN)).body.mfaRequired).toBe(true)
    const L = await register('lender', 'audit-owner')
    expect((await post('/api/org/invitations', { email: 'auditor@example.test', role: 'fcc_auditor' }, L.token)).status).toBe(400) // vai trò chỉ có ở FCC
    const inv = await post('/api/org/invitations', { email: 'auditor@example.test', role: 'fcc_auditor' }, adminToken)
    expect(inv.status, JSON.stringify(inv.body)).toBe(200)
    const acc = await post(`/api/invitations/${inviteToken(inv.body.inviteUrl)}/accept`, { password: PW, name: 'Kiểm toán viên', title: 'Kiểm toán nội bộ' })
    const aud = acc.body.token as string
    expect(acc.body.me.role).toBe('fcc_auditor')
    expect((await call('GET', '/api/state', undefined, aud)).status).toBe(200)
    expect((await post('/api/files', { name: 'a.pdf', mime: 'application/pdf', dataBase64: 'JVBERg==' }, aud)).status).toBe(403)
    expect((await act(aud, 'verifyOrg', L.orgId, true)).status).toBe(403)
    expect((await act(aud, 'approveProduct', 'x', true)).status).toBe(403)
    expect((await act(aud, 'markNotificationsRead')).status).toBe(200)
  })
})
