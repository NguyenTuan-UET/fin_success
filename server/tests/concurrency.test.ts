// Kịch bản kiểm thử theo báo cáo đánh giá (mục 16): T02 truy cập chéo, T06 thao tác đồng thời, T09 sự kiện tiền lặp/sai thứ tự.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dropSchema, newSchema, startApp } from './helpers'
import { signPayload } from '../src/integrations/partner'
import { iso } from '@fcc/domain/util' // ngày VN, như giao diện gửi lên

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const schema = newSchema()
const app = await startApp(schema, { devAutologin: true })
afterAll(async () => {
  await app.close()
  await dropSchema(schema)
})
async function call(method: 'GET' | 'POST', url: string, body?: unknown, token?: string) {
  const r = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(body !== undefined ? { payload: body as never } : {}) })
  return { status: r.statusCode, body: r.json() as Json }
}
const post = (u: string, b: unknown, t?: string) => call('POST', u, b, t)
const act = (t: string, n: string, ...args: unknown[]) => post(`/api/actions/${n}`, { args }, t)
const session = async (role: string) => (await post('/api/dev/session', { role })).body.token as string
const st = () => app.getState()

let mst = 5_000_000_000
async function register(type: 'supplier' | 'lender', name: string) {
  const r = await post('/api/auth/register', {
    email: `${name}@example.test`, password: 'correct-horse-battery', name, title: 'Giám đốc',
    org: { name: `Công ty ${name}`, shortName: name, taxCode: String(++mst), type, vsic: '2592', industryLabel: 'Cơ khí', industryGroup: 'manufacturing', foundedYear: 2015, employees: 20, province: 'Hà Nội' },
  })
  expect(r.status, JSON.stringify(r.body)).toBe(201)
  return { token: r.body.token as string, orgId: r.body.me.activeOrgId as string }
}
const productInput = (name: string) => ({ name, type: 'factoring_recourse', description: '', status: 'pending_review', eligibility: { minAmount: 1, maxAmount: 1e12, maxTenorDays: 365, requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 6, rateMax: 6, fees: [], latePenaltyPct: 150 }, sla: {}, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31' })
const offer = () => ({ advanceVnd: 1_600_000_000, ratePct: 6, feesVnd: 0, tenorDays: 90, conditions: '', expiresAt: iso(new Date(Date.now() + 5 * 86_400_000)) })

let S: string, B: string, L1: string, F: string
let L2: { token: string; orgId: string }
let p1: string, p2: string, buyerId: string, l1Id: string

/** Khoản phải thu 2 tỷ đã được bên nhập khẩu xác nhận. */
async function confirmed(n: string) {
  const due = iso(new Date(Date.now() + 90 * 86_400_000))
  const rec = (await act(S, 'createReceivable', { buyerId, invoiceSeries: 'C', invoiceNumber: n, issueDate: iso(new Date()), dueDate: due, amount: 2_000_000_000, description: '', fingerprint: `fp-c-${n}`, docs: { xml: true }, source: 'xml' })).body.result
  await act(S, 'sendToBuyer', rec.id)
  expect((await act(B, 'buyerDecision', rec.id, true)).status).toBe(200)
  return rec as { id: string; code: string }
}
const appsOf = (recId: string) => st().applications.filter((a) => a.receivableId === recId)

beforeAll(async () => {
  ;[S, B, L1, F] = await Promise.all([session('supplier'), session('buyer'), session('lender'), session('fcc')])
  await act(S, 'updateOrg', { foundedYear: 2012, employees: 60 })
  buyerId = st().orgs.find((o) => o.type === 'buyer')!.id
  l1Id = st().orgs.find((o) => o.type === 'lender' && o.verified)!.id
  L2 = await register('lender', 'lender-two')
  expect((await act(F, 'verifyOrg', L2.orgId, true)).status).toBe(200)
  p1 = (await act(L1, 'upsertProduct', productInput('Gói L1'))).body.result.id
  p2 = (await act(L2.token, 'upsertProduct', productInput('Gói L2'))).body.result.id
  expect(st().products.filter((p) => p.status === 'published')).toHaveLength(2) // dev: tự công bố
})

describe('T02 — truy cập chéo giữa các tổ chức', () => {
  it('đơn vị xuất khẩu khác không đọc đầy đủ, không sửa, không hủy, không gửi tài trợ hóa đơn của mình dù biết mã', async () => {
    const rec = await confirmed('X1')
    const other = await register('supplier', 'supplier-two')
    const seen = await call('GET', `/v1/receivables/${rec.id}`, undefined, other.token)
    // chỉ thấy bản rút gọn dùng cho chấm điểm: không số/ký hiệu hóa đơn, không mô tả, không dấu vân tay chứng từ
    if (seen.status === 200) expect(seen.body).toMatchObject({ invoiceNumber: '', invoiceSeries: '', fingerprint: '', description: '' })
    else expect(seen.status).toBe(404)
    for (const [name, ...args] of [
      ['reviseReceivable', rec.id, { amount: 1_000_000, note: 'sửa trái phép' }],
      ['cancelReceivable', rec.id],
      ['sendToBuyer', rec.id],
      ['submitDirect', rec.id, p1],
      ['createRfq', rec.id, [p1]],
    ] as [string, ...unknown[]][]) {
      const r = await act(other.token, name, ...args)
      expect([403, 404], `${name}: ${JSON.stringify(r.body)}`).toContain(r.status)
    }
    expect(st().receivables.find((r) => r.id === rec.id)).toMatchObject({ amount: 2_000_000_000, state: 'BUYER_CONFIRMED' })
    expect(appsOf(rec.id)).toHaveLength(0)
  })

  it('tổ chức tài chính không liên quan không thao tác được trên hồ sơ của tổ chức khác', async () => {
    const rec = await confirmed('X2')
    expect((await act(S, 'submitDirect', rec.id, p1)).status).toBe(200)
    const appId = appsOf(rec.id)[0].id
    for (const [name, ...args] of [['startReview', appId], ['makeOffer', appId, offer()], ['fundApp', appId], ['rejectApp', appId, 'x']] as [string, ...unknown[]][]) {
      const r = await act(L2.token, name, ...args)
      expect([403, 404], `${name}: ${JSON.stringify(r.body)}`).toContain(r.status)
    }
    expect(appsOf(rec.id)[0].state).toBe('SUBMITTED')
  })
})

describe('T06 — thao tác đồng thời không tạo tài trợ trùng', () => {
  it('hai tab gửi hồ sơ cùng lúc tới hai tổ chức tài chính: chỉ một hồ sơ hoạt động', async () => {
    const rec = await confirmed('D1')
    const rs = await Promise.all([act(S, 'submitDirect', rec.id, p1), act(S, 'submitDirect', rec.id, p2)])
    expect(rs.map((r) => r.status).sort(), JSON.stringify(rs.map((r) => r.body.error))).toEqual([200, 409])
    expect(appsOf(rec.id)).toHaveLength(1)
  })

  it('hai báo giá, chọn hai bên cùng lúc: chỉ một được chọn, bên còn lại bị thu hồi quyền', async () => {
    const rec = await confirmed('D2')
    const rfq = (await act(S, 'createRfq', rec.id, [p1, p2])).body.result
    const validUntil = iso(new Date(Date.now() + 3 * 86_400_000))
    expect((await act(L1, 'respondRfq', rfq.id, { productId: p1, kind: 'quote', advancePct: 80, ratePct: 6, validUntil })).status).toBe(200)
    expect((await act(L2.token, 'respondRfq', rfq.id, { productId: p2, kind: 'quote', advancePct: 80, ratePct: 5.5, validUntil })).status).toBe(200)
    const rs = await Promise.all([act(S, 'selectQuote', rfq.id, l1Id), act(S, 'selectQuote', rfq.id, L2.orgId)])
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409])
    const apps = appsOf(rec.id)
    expect(apps).toHaveLength(1)
    const loser = apps[0].lenderId === l1Id ? L2.orgId : l1Id
    expect(st().consents.filter((k) => k.recipientId === loser && k.purpose === `Gói tóm tắt RFQ ${rfq.id}` && !k.revokedAt)).toHaveLength(0)
  })

  it('giải ngân hai lần cùng lúc (nút và sự kiện): chỉ ghi một lần, số tiền không vượt đề nghị', async () => {
    const rec = await confirmed('D3')
    await act(S, 'submitDirect', rec.id, p1)
    const appId = appsOf(rec.id)[0].id
    await act(L1, 'startReview', appId)
    await act(L1, 'makeOffer', appId, offer())
    expect((await act(S, 'acceptOffer', appId)).status).toBe(200)
    await Promise.all([act(L1, 'fundApp', appId), act(L1, 'fundApp', appId), act(L1, 'fundApp', appId)])
    const a = st().applications.find((x) => x.id === appId)!
    expect(a.state).toBe('FUNDED')
    expect(a.fundedAmount).toBe(1_600_000_000)
    expect(st().audit.filter((e) => e.entity === appId && e.action === 'Ghi nhận giải ngân')).toHaveLength(1)
  })
})

describe('T09 — sự kiện tiền lặp, sai thứ tự, tiền chưa về đúng tài khoản', () => {
  let send: (id: string, type: string, data: Json) => Promise<{ status: number; body: Json; replay?: unknown }>
  let appId: string, recId: string

  beforeAll(async () => {
    const rec = await confirmed('W1')
    recId = rec.id
    await act(S, 'submitDirect', rec.id, p1)
    appId = appsOf(rec.id)[0].id
    await act(L1, 'startReview', appId)
    await act(L1, 'makeOffer', appId, offer())
    await act(S, 'acceptOffer', appId)
    const key = (await call('POST', '/v1/integration-keys', { name: 'k', scopes: ['events:write'] }, L1)).body
    const secret = (await post('/api/webhook-secret', {}, L1)).body.secret
    send = async (id, type, data) => {
      const body = JSON.stringify({ id, type, data })
      const r = await app.inject({ method: 'POST', url: '/v1/partner/events', headers: { authorization: `Bearer ${key.token}`, 'content-type': 'application/json', 'x-fcc-signature': signPayload(secret, body) }, payload: body })
      return { status: r.statusCode, body: r.json() as Json, replay: r.headers['x-idempotent-replay'] }
    }
  })

  it('tiền về đến trước sự kiện giải ngân: bị từ chối, không ghi nhận; gửi lại sau giải ngân thì xử lý một lần', async () => {
    const early = await send('pay-early', 'application.payment_received', { applicationId: appId, amount: 500_000_000 })
    expect(early.status, JSON.stringify(early.body)).toBe(409)
    expect(st().applications.find((a) => a.id === appId)!.settlements ?? []).toEqual([])
    const refund = await send('refund-early', 'application.refund_paid', { applicationId: appId, amount: 1 })
    expect(refund.status).toBe(409) // hoàn phần dư trước tất toán

    expect((await send('fund-1', 'application.funded', { applicationId: appId })).status).toBe(200)
    expect((await send('fund-1', 'application.funded', { applicationId: appId })).replay).toBe('true')
    expect((await send('fund-2', 'application.funded', { applicationId: appId })).body.result).toMatchObject({ changed: false })

    const again = await send('pay-early', 'application.payment_received', { applicationId: appId, amount: 500_000_000 })
    expect(again.status, JSON.stringify(again.body)).toBe(200) // lần trước lỗi nên chưa bị coi là đã xử lý
    expect(st().applications.find((a) => a.id === appId)!.settlements!.filter((e) => e.type === 'payment_received')).toHaveLength(1)
  })

  it('cùng một sự kiện gửi đồng thời nhiều lần: chỉ ghi nhận một lần', async () => {
    await Promise.all(Array.from({ length: 4 }, () => send('pay-dup', 'application.payment_received', { applicationId: appId, amount: 300_000_000 })))
    const pays = st().applications.find((a) => a.id === appId)!.settlements!.filter((e) => e.type === 'payment_received')
    expect(pays.filter((e) => e.externalEventId === 'pay-dup')).toHaveLength(1)
    expect(pays).toHaveLength(2)
  })

  it('bên nhập khẩu báo đã trả nhưng tiền không về tổ chức tài chính: không tất toán, đối soát báo lệch', async () => {
    expect((await act(B, 'markBuyerPaid', recId, { amount: 1_200_000_000, reference: 'UNC-sai-tk' })).status).toBe(200)
    const a = st().applications.find((x) => x.id === appId)!
    expect(a.state).toBe('FUNDED')
    expect(a.outstanding).toBeGreaterThan(0)
    expect(st().receivables.find((r) => r.id === recId)!.state).not.toBe('SETTLED')
    const rec = (await call('GET', `/v1/funding-applications/${appId}/settlement`, undefined, L1)).body.reconciliation
    expect(['pending', 'mismatch']).toContain(rec)
  })

  it('sự kiện ký sai hoặc của hồ sơ thuộc tổ chức khác bị từ chối', async () => {
    const body = JSON.stringify({ id: 'forged', type: 'application.payment_received', data: { applicationId: appId, amount: 1 } })
    const key = (await call('POST', '/v1/integration-keys', { name: 'k2', scopes: ['events:write'] }, L1)).body
    const r = await app.inject({ method: 'POST', url: '/v1/partner/events', headers: { authorization: `Bearer ${key.token}`, 'content-type': 'application/json', 'x-fcc-signature': signPayload('khoa-gia', body) }, payload: body })
    expect(r.statusCode).toBe(401)
    const k2 = (await call('POST', '/v1/integration-keys', { name: 'l2', scopes: ['events:write'] }, L2.token)).body
    const s2 = (await post('/api/webhook-secret', {}, L2.token)).body.secret
    const b2 = JSON.stringify({ id: 'cross', type: 'application.payment_received', data: { applicationId: appId, amount: 1 } })
    const x = await app.inject({ method: 'POST', url: '/v1/partner/events', headers: { authorization: `Bearer ${k2.token}`, 'content-type': 'application/json', 'x-fcc-signature': signPayload(s2, b2) }, payload: b2 })
    expect(x.statusCode).toBe(404)
  })
})
