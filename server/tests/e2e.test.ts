import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { dropSchema, newSchema, startApp } from './helpers'
import { totp } from '../src/auth/totp'
import type { FinancingProduct, FundingApplication, Receivable, Rfq } from '@fcc/domain/types'

const schema = newSchema()
const ADMIN = { email: 'ops@example.test', password: 'ops-password-123' }
const PW = 'correct-horse-battery'
// Đồng hồ của app tiến 30 giây mỗi khi test cần một mã TOTP mới (mã đã dùng không dùng lại được).
let offset = 0
const now = () => new Date(Date.now() + offset)
const code = (secret: string) => {
  offset += 30_000
  return totp(secret, now().getTime())
}
let app = await startApp(schema, { admin: ADMIN, now })
const iso = (d: Date) => d.toISOString().slice(0, 10)
const due = iso(new Date(Date.now() + 40 * 86_400_000))

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
async function post(path: string, body: unknown, token?: string, headers: Record<string, string> = {}) {
  const r = await app.inject({ method: 'POST', url: path, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, payload: body as never })
  return { status: r.statusCode, body: r.json() as Json, headers: r.headers }
}
const act = (token: string, name: string, ...args: unknown[]) => post(`/api/actions/${name}`, { args }, token)
const getState = async (token: string) => (await app.inject({ method: 'GET', url: '/api/state', headers: { authorization: `Bearer ${token}` } })).json().state as Json

/** Bật MFA cho tài khoản của phiên; trả secret để tạo mã về sau. */
const secrets = new Map<string, string>()
const nextCode = code
async function enableMfa(token: string) {
  const s = await post('/api/auth/mfa/setup', {}, token)
  expect(s.status, JSON.stringify(s.body)).toBe(200)
  const e = await post('/api/auth/mfa/enable', { code: code(s.body.secret) }, token)
  expect(e.status, JSON.stringify(e.body)).toBe(200)
  secrets.set(token, s.body.secret)
  return s.body.secret as string
}
/** Làm cũ thời điểm MFA của phiên (giả lập đã quá 10 phút). */
const staleMfa = (token: string) => app.db.rawQuery(`UPDATE sessions SET mfa_at = $2 WHERE token_hash = encode(sha256($1::bytea), 'hex')`, [token, new Date(now().getTime() - 11 * 60_000)])

let mst = 3_000_000_000
async function register(type: 'buyer' | 'supplier' | 'lender', name: string, extra: Record<string, unknown> = {}) {
  const n = ++mst
  const r = await post('/api/auth/register', {
    email: `${name.toLowerCase().replace(/\W+/g, '')}@example.test`, password: PW, name: `Người dùng ${name}`, title: 'Giám đốc',
    org: { name: `Công ty ${name}`, shortName: name, taxCode: String(n), type, vsic: '2592', industryLabel: 'Gia công cơ khí', industryGroup: 'manufacturing', foundedYear: 2015, employees: 50, province: 'Bình Dương', ...extra },
  })
  expect(r.status, JSON.stringify(r.body)).toBe(201)
  return { token: r.body.token as string, orgId: r.body.state.orgs.at(-1).id as string, email: `${name.toLowerCase().replace(/\W+/g, '')}@example.test` }
}
const product = (name: string): Partial<FinancingProduct> => ({
  name, type: 'factoring_recourse', description: 'Bảo lý có truy đòi', status: 'pending_review',
  eligibility: { minAmount: 100_000_000, maxAmount: 10_000_000_000, maxTenorDays: 120, requireBuyerConfirmation: true },
  pricing: { advancePct: 80, rateMin: 8, rateMax: 12, fees: [], latePenaltyPct: 150 }, sla: { quoteHours: 24 }, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31',
})

afterAll(async () => {
  await app.close()
  await dropSchema(schema)
})

describe('luồng tài trợ chuỗi cung ứng — không có dữ liệu mẫu', () => {
  let admin: string, S: Awaited<ReturnType<typeof register>>, S2: typeof S, B: typeof S, L1: typeof S, L2: typeof S, L3: typeof S
  let rec: Receivable, rfq: Rfq, fa: FundingApplication, p1: string, p2: string

  beforeAll(async () => {
    const r = await post('/api/auth/login', ADMIN)
    expect(r.status).toBe(200)
    admin = r.body.token
    await enableMfa(admin)
  })

  it('CSDL mới hoàn toàn trống ngoài tài khoản FCC', async () => {
    const st = await getState(admin)
    expect(st.orgs.map((o: Json) => o.type)).toEqual(['fcc'])
    for (const k of ['profiles', 'products', 'receivables', 'rfqs', 'applications', 'esg', 'ledger', 'listed', 'external', 'limits']) expect(st[k], k).toEqual([])
  })

  it('đăng ký: kiểm tra dữ liệu, trùng MST/email, mật khẩu yếu; đăng nhập sai bị khóa sau 5 lần', async () => {
    S = await register('supplier', 'Minh Tam')
    S2 = await register('supplier', 'Phu Gia')
    B = await register('buyer', 'An Phat')
    L1 = await register('lender', 'Ngan Hang Mot')
    L2 = await register('lender', 'Ngan Hang Hai')
    L3 = await register('lender', 'Ngan Hang Ba')
    const dupTax = await post('/api/auth/register', { email: 'x@example.test', password: PW, name: 'x', title: 'x', org: { name: 'x', taxCode: String(mst), type: 'buyer', vsic: '1', industryLabel: 'x', industryGroup: 'trade', foundedYear: 2000, employees: 1, province: 'x' } })
    expect(dupTax.status).toBe(409)
    expect((await post('/api/auth/register', { email: S.email, password: PW, name: 'x', title: 'x', org: { name: 'x', taxCode: '9999999999', type: 'buyer', vsic: '1', industryLabel: 'x', industryGroup: 'trade', foundedYear: 2000, employees: 1, province: 'x' } })).status).toBe(409)
    expect((await post('/api/auth/register', { email: 'weak@example.test', password: 'short', name: 'x', title: 'x', org: {} })).status).toBe(400)
    expect((await post('/api/auth/register', { email: 'bad@example.test', password: PW, name: 'x', title: 'x', org: { name: 'x', taxCode: '12AB', type: 'buyer' } })).status).toBe(400)
    for (let i = 0; i < 5; i++) expect((await post('/api/auth/login', { email: S.email, password: 'sai-mat-khau-x' })).status).toBe(401)
    expect((await post('/api/auth/login', { email: S.email, password: PW })).status).toBe(429)
    expect((await app.inject({ method: 'GET', url: '/api/state' })).statusCode).toBe(401)
  })

  it('tổ chức tài chính chỉ đăng sản phẩm sau khi FCC xác minh; sản phẩm phải được FCC duyệt mới hiện với doanh nghiệp', async () => {
    expect((await act(L1.token, 'upsertProduct', product('SP1'))).status).toBe(403) // chưa xác minh
    expect((await act(L1.token, 'verifyOrg', L1.orgId, true)).status).toBe(403) // không tự xác minh
    for (const l of [L1, L2]) expect((await act(admin, 'verifyOrg', l.orgId, true)).status).toBe(200)
    const a = await act(L1.token, 'upsertProduct', product('SP1'))
    const b = await act(L2.token, 'upsertProduct', product('SP2'))
    expect(a.status).toBe(200)
    p1 = a.body.result.id
    p2 = b.body.result.id
    expect((await act(L1.token, 'setProductStatus', p1, 'published')).status).toBe(403) // không tự công bố
    expect((await getState(S.token)).products).toEqual([]) // chưa duyệt → doanh nghiệp không thấy
    expect((await act(S.token, 'approveProduct', p1, true)).status).toBe(403)
    expect((await act(admin, 'approveProduct', p1, true)).status).toBe(200)
    expect((await act(admin, 'approveProduct', p2, true)).status).toBe(200)
    expect((await getState(S.token)).products.map((p: Json) => p.id).sort()).toEqual([p1, p2].sort())
  })

  it('nhà cung cấp tạo khoản phải thu; trùng bị chặn; sai vai trò bị từ chối', async () => {
    const input = { buyerId: B.orgId, invoiceSeries: 'C26TAA', invoiceNumber: '0009001', issueDate: iso(new Date()), dueDate: due, amount: 1_500_000_000, description: 'Gia công', fingerprint: 'fp-1', docs: { xml: true, contract: true, delivery: true }, source: 'xml' }
    const a = await act(S.token, 'createReceivable', input)
    expect(a.status).toBe(200)
    rec = a.body.result
    expect(rec.sellerId).toBe(S.orgId)
    expect((await act(S.token, 'createReceivable', input)).status).toBe(409)
    expect((await act(B.token, 'createReceivable', input)).status).toBe(403)
    expect((await act(S.token, 'createReceivable', { ...input, invoiceNumber: '2', amount: -5 })).status).toBe(400)
    expect((await act(S.token, 'createReceivable', { ...input, invoiceNumber: '3', buyerId: L1.orgId })).status).toBe(400)
  })

  it('bên mua phải có MFA (bật và xác thực trong 10 phút) mới xác nhận được; người khác không xác nhận hộ', async () => {
    expect((await act(S.token, 'sendToBuyer', rec.id)).status).toBe(200)
    expect((await act(S.token, 'buyerDecision', rec.id, true)).status).toBe(403)
    const noMfa = await act(B.token, 'buyerDecision', rec.id, true)
    expect(noMfa.status).toBe(403) // chưa bật MFA
    expect(noMfa.body.error).toContain('MFA')
    const secret = await enableMfa(B.token)
    await staleMfa(B.token)
    expect((await act(B.token, 'buyerDecision', rec.id, true)).status).toBe(401) // MFA đã quá 10 phút
    expect((await post('/api/auth/mfa/verify', { code: '000000' }, B.token)).status).toBe(401)
    expect((await post('/api/auth/mfa/verify', { code: nextCode(secret) }, B.token)).status).toBe(200)
    const ok = await act(B.token, 'buyerDecision', rec.id, true)
    expect(ok.status).toBe(200)
    expect(ok.body.state.receivables.find((r: Receivable) => r.id === rec.id).state).toBe('BUYER_CONFIRMED')
  })

  it('RFQ → báo giá của tổ chức tài chính thật (không có phản hồi giả lập) → chọn báo giá', async () => {
    expect((await act(S.token, 'simulateRfqResponses', 'x')).status).toBe(404)
    expect((await act(S.token, 'createRfq', rec.id, [p1, p2])).status).toBe(403) // chia sẻ dữ liệu cần MFA
    await enableMfa(S.token)
    await enableMfa(L1.token)
    await enableMfa(L2.token)
    const c = await act(S.token, 'createRfq', rec.id, [p1, p2])
    expect(c.status, JSON.stringify(c.body)).toBe(200)
    rfq = c.body.result
    expect((await getState(S.token)).rfqs[0].responses).toEqual([]) // chưa ai trả lời thì không có báo giá nào
    expect((await act(L3.token, 'respondRfq', rfq.id, { productId: p1, kind: 'quote', advancePct: 80, ratePct: 9 })).status).toBe(403) // không thuộc RFQ
    expect((await act(L1.token, 'respondRfq', rfq.id, { productId: p1, kind: 'quote', advancePct: 80, ratePct: 9.5, feesVnd: 1_000_000, validUntil: iso(new Date(Date.now() + 3 * 86_400_000)) })).status).toBe(200)
    expect((await act(L2.token, 'respondRfq', rfq.id, { productId: p2, kind: 'decline', conditions: 'Ngoài khẩu vị' })).status).toBe(200)
    expect((await act(S.token, 'selectQuote', rfq.id, L2.orgId)).status).toBe(400) // L2 từ chối, không có báo giá
    // hai yêu cầu chọn báo giá gửi cùng lúc: chỉ một thành công, chỉ một hồ sơ được tạo
    const [s1, s2] = await Promise.all([act(S.token, 'selectQuote', rfq.id, L1.orgId), act(S.token, 'selectQuote', rfq.id, L1.orgId)])
    expect([s1.status, s2.status].sort()).toEqual([200, 409])
    const sel = s1.status === 200 ? s1 : s2
    expect(sel.body.state.applications.filter((a: FundingApplication) => a.receivableId === rec.id)).toHaveLength(1)
    fa = sel.body.state.applications.find((a: FundingApplication) => a.rfqId === rfq.id)
    expect(fa.lenderId).toBe(L1.orgId)
    const st = await getState(S.token)
    expect(st.consents.find((k: Json) => k.recipientId === L2.orgId && k.purpose === `Gói tóm tắt RFQ ${rfq.id}`).revokedAt).toBeTruthy()
  })

  it('phân quyền dữ liệu', async () => {
    const other = await getState(S2.token)
    const seen = other.receivables.find((r: Receivable) => r.id === rec.id)
    expect(seen.fingerprint).toBe('') // nhà cung cấp khác chỉ thấy bản rút gọn
    expect(other.consents).toEqual([])
    const l2 = await getState(L2.token) // đã bị loại khỏi RFQ
    expect(l2.receivables.find((r: Receivable) => r.id === rec.id)?.fingerprint ?? '').toBe('')
    expect((await getState(L1.token)).receivables.find((r: Receivable) => r.id === rec.id).fingerprint).toBe('fp-1')
    const fcc = await getState(admin)
    expect(fcc.receivables).toEqual([])
    expect(fcc.applications).toEqual([])
  })

  it('thẩm định → đề nghị → chấp thuận (nhập lại mật khẩu) → giải ngân qua webhook theo khóa riêng, idempotent', async () => {
    expect((await act(S.token, 'startReview', fa.id)).status).toBe(403)
    expect((await act(L2.token, 'startReview', fa.id)).status).toBe(403)
    expect((await act(L1.token, 'makeOffer', fa.id, {})).status).toBe(409)
    expect((await act(L1.token, 'startReview', fa.id)).status).toBe(200)
    const offer = { advanceVnd: 1_200_000_000, ratePct: 9.5, feesVnd: 1_000_000, tenorDays: 40, conditions: 'Có truy đòi', expiresAt: iso(new Date(Date.now() + 5 * 86_400_000)) }
    expect((await act(L1.token, 'makeOffer', fa.id, { ...offer, advanceVnd: 9_999_999_999 })).status).toBe(400)
    expect((await act(L1.token, 'makeOffer', fa.id, offer)).status).toBe(200)
    await staleMfa(S.token)
    expect((await act(S.token, 'acceptOffer', fa.id)).status).toBe(401)
    expect((await post('/api/auth/mfa/verify', { code: nextCode(secrets.get(S.token)!) }, S.token)).status).toBe(200)
    const acc = await act(S.token, 'acceptOffer', fa.id)
    expect(acc.status).toBe(200)
    const consent = acc.body.state.consents.find((k: Json) => k.recipientId === L1.orgId && k.purpose.startsWith('Hồ sơ đầy đủ'))
    expect(consent.signature).toMatchObject({ method: 'mfa_snapshot', contentSha256: expect.stringMatching(/^[0-9a-f]{64}$/) })
    expect((await act(S.token, 'fundApp', fa.id)).status).toBe(403)

    const k1 = await post('/api/webhook-secret', {}, L1.token)
    expect(k1.status).toBe(200)
    expect((await post('/api/webhook-secret', {}, S.token)).status).toBe(403)
    const k2 = await post('/api/webhook-secret', {}, L2.token)
    const body = JSON.stringify({ applicationId: fa.id, amount: offer.advanceVnd })
    const sign = (secret: string) => createHmac('sha256', secret).update(body).digest('hex')
    const hook = (org: string, sig: string, key: string) => app.inject({ method: 'POST', url: '/api/webhooks/funding', headers: { 'content-type': 'application/json', 'x-fcc-org': org, 'x-fcc-signature': sig, 'x-idempotency-key': key }, payload: body })
    expect((await hook(L1.orgId, 'deadbeef', 'k1')).statusCode).toBe(401)
    expect((await hook(L1.orgId, sign(k2.body.secret), 'k1')).statusCode).toBe(401) // khóa của tổ chức khác
    expect((await hook(L2.orgId, sign(k2.body.secret), 'k1')).statusCode).toBe(404) // hồ sơ không thuộc L2
    const h1 = await hook(L1.orgId, sign(k1.body.secret), 'k1')
    expect(h1.statusCode).toBe(200)
    expect(h1.json().changed).toBe(true)
    expect((await hook(L1.orgId, sign(k1.body.secret), 'k1')).headers['x-idempotent-replay']).toBe('true')
    expect((await hook(L1.orgId, sign(k1.body.secret), 'k2')).json().changed).toBe(false)
    const s = await getState(S.token)
    expect(s.applications.find((a: FundingApplication) => a.id === fa.id).state).toBe('FUNDED')
    expect(s.notifications.some((n: Json) => n.title.includes('đã giải ngân'))).toBe(true)
  })

  it('bên mua báo thanh toán → tổ chức tài chính xác nhận tiền về → tất toán và hoàn phần dư; nhật ký có dấu vết', async () => {
    expect((await act(S.token, 'markBuyerPaid', rec.id)).status).toBe(403)
    const r = await act(B.token, 'markBuyerPaid', rec.id)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    // khoản đã tài trợ: bên mua báo chưa đủ để tất toán — chờ tổ chức tài chính xác nhận tiền về
    expect(r.body.state.receivables.find((x: Receivable) => x.id === rec.id).state).toBe('FUNDED')
    expect((await act(L2.token, 'confirmPayment', fa.id, { amount: 1 })).status).toBe(403) // không phải tổ chức tài chính của hồ sơ
    expect((await act(L1.token, 'confirmPayment', fa.id, { amount: -5 })).status).toBe(400)
    const paid = await act(L1.token, 'confirmPayment', fa.id, { amount: rec.amount })
    expect(paid.status, JSON.stringify(paid.body)).toBe(200)
    expect(paid.body.result.settled).toBe(true)
    expect(paid.body.result.surplus).toBeGreaterThan(0)
    const st = await getState(S.token)
    expect(st.receivables.find((x: Receivable) => x.id === rec.id).state).toBe('SETTLED')
    const done = st.applications.find((a: FundingApplication) => a.id === fa.id)
    expect(done.state).toBe('SETTLED')
    expect(done.refundDue).toBe(paid.body.result.surplus)
    // hoàn phần dư cho nhà cung cấp
    expect((await act(L1.token, 'confirmRefund', fa.id, { amount: done.refundDue + 1 })).status).toBe(400)
    expect((await act(L1.token, 'confirmRefund', fa.id, { amount: done.refundDue })).status).toBe(200)
    expect((await getState(S.token)).applications.find((a: FundingApplication) => a.id === fa.id).refundPaid).toBe(done.refundDue)
    const logged = (await getState(S.token)).audit.map((e: Json) => e.action)
    for (const a of ['Tạo khoản phải thu', 'Bên mua xác nhận', 'Chọn báo giá & gửi hồ sơ', 'Ghi nhận giải ngân', 'Bên mua báo đã thanh toán', 'Ghi nhận tiền về', 'Ghi nhận hoàn phần dư cho nhà cung cấp']) expect(logged).toContain(a)
  })

  it('ESG: doanh nghiệp tải bằng chứng, chỉ nhân sự FCC xác nhận mức và phát hành chính thức', async () => {
    const e = await act(S2.token, 'ensureEsg', S2.orgId)
    const id = e.body.result.id
    expect((await act(S2.token, 'updateIndicator', id, 'E1', { selfDeclared: 'Có hóa đơn điện 12 tháng' })).status).toBe(200)
    expect((await act(S2.token, 'updateIndicator', id, 'E1', { finalLevel: 3 })).status).toBe(403)
    expect((await act(admin, 'updateIndicator', id, 'E1', { selfDeclared: 'sửa hộ' })).status).toBe(403)
    expect((await act(S.token, 'updateIndicator', id, 'E1', { selfDeclared: 'x' })).status).toBe(403) // doanh nghiệp khác
    expect((await getState(admin)).esg.some((x: Json) => x.id === id)).toBe(true)
    // mức ≥ 2 cần bằng chứng gắn với chỉ tiêu
    expect((await act(admin, 'updateIndicator', id, 'E1', { finalLevel: 3, reviewerNote: 'Đã đối chiếu hóa đơn' })).status).toBe(422)
    expect((await act(S2.token, 'addEsgDocument', id, { id: 'd1', name: 'hoa-don-dien.pdf', mime: 'application/pdf', docType: 'Hóa đơn điện', indicatorCodes: ['E1'] })).status).toBe(200)
    expect((await act(admin, 'updateIndicator', id, 'E1', { finalLevel: 3, reviewerNote: 'Đã đối chiếu hóa đơn' })).status).toBe(200)
    expect((await act(S2.token, 'issueEsg', id, true)).status).toBe(403)
    expect((await act(admin, 'issueEsg', id, true)).status).toBe(422) // độ bao phủ mới 1/18
    for (const code of ['E2', 'E3', 'E4', 'E5', 'E6', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']) {
      expect((await act(admin, 'updateIndicator', id, code, { finalLevel: 1 })).status, code).toBe(200)
    }
    expect((await act(admin, 'issueEsg', id, true)).status).toBe(200)
    expect((await getState(S2.token)).esg.find((x: Json) => x.id === id).status).toBe('official')
  })

  it('dòng tiền: nhập số dư, chi định kỳ và công nợ do người dùng cung cấp', async () => {
    expect((await act(S.token, 'saveCashProfile', S.orgId, { openingCash: 500_000_000, recurringMonthlyOut: [{ name: 'Lương', amount: 100_000_000, day: 5 }] })).status).toBe(200)
    expect((await act(S.token, 'saveCashProfile', S.orgId, { openingCash: 1, recurringMonthlyOut: [{ name: 'x', amount: 1, day: 31 }] })).status).toBe(400)
    expect((await act(S.token, 'importLedger', S.orgId, [{ kind: 'AP', counterpartyName: 'NCC A', docNo: 'PN01', amount: 50_000_000, paid: 0, dueDate: due }])).status).toBe(200)
    expect((await act(S2.token, 'importLedger', S.orgId, [])).status).toBe(403)
    const st = await getState(S.token)
    expect(st.connections[0].openingCash).toBe(500_000_000)
    expect(st.ledger).toHaveLength(1)
  })

  it('dữ liệu và tài khoản còn nguyên sau khi khởi động lại; thu hồi phiên khi đăng xuất', async () => {
    const before = app.getState().receivables.map((r) => r.id)
    await app.close()
    app = await startApp(schema, { admin: ADMIN, now })
    expect(app.getState().receivables.map((r) => r.id)).toEqual(before)
    const needCode = await post('/api/auth/login', { email: B.email, password: PW })
    expect(needCode.status).toBe(401)
    expect(needCode.body.mfaRequired).toBe(true)
    const lg = await post('/api/auth/login', { email: B.email, password: PW, code: nextCode(secrets.get(B.token)!) })
    expect(lg.status, JSON.stringify(lg.body)).toBe(200)
    expect((await post('/api/auth/logout', {}, lg.body.token)).status).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/state', headers: { authorization: `Bearer ${lg.body.token}` } })).statusCode).toBe(401)
  })
})
