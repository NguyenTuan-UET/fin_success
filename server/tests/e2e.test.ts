import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { buildApp } from '../src/app'
import type { Receivable, Rfq, FundingApplication, FinancingProduct } from '../../web/src/domain/types'

const SECRET = 'test-secret'
const app = buildApp({ dbPath: ':memory:', demo: true, webhookSecret: SECRET, listedDir: '../web/public/listed' })
const iso = (d: Date) => d.toISOString().slice(0, 10)

async function login(orgId: string, reviewer = false) {
  const r = await app.inject({ method: 'POST', url: '/api/auth/demo-login', payload: { orgId, reviewer } })
  expect(r.statusCode).toBe(200)
  return r.json().token as string
}
async function act(token: string, name: string, ...args: unknown[]) {
  const r = await app.inject({ method: 'POST', url: `/api/actions/${name}`, headers: { authorization: `Bearer ${token}` }, payload: { args } })
  return { status: r.statusCode, body: r.json() as { result?: any; state?: any; error?: string } }
}
async function otp(token: string, purpose: string, entity: string) {
  const r = await app.inject({ method: 'POST', url: '/api/otp', headers: { authorization: `Bearer ${token}` }, payload: { purpose, entity } })
  expect(r.statusCode).toBe(200)
  return { id: r.json().otpId as string, code: r.json().demoCode as string }
}
const getState = async (token: string) => (await app.inject({ method: 'GET', url: '/api/state', headers: { authorization: `Bearer ${token}` } })).json().state

afterAll(() => app.close())

describe('luồng tài trợ chuỗi cung ứng end-to-end', () => {
  let seller: string, buyer: string, lender: string, other: string
  let rec: Receivable
  let rfq: Rfq
  let fa: FundingApplication
  const due = iso(new Date(Date.now() + 40 * 86_400_000))

  beforeAll(async () => {
    seller = await login('s1')
    buyer = await login('b1')
    other = await login('l4')
  })

  it('từ chối khi không có token / token sai', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/state' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/api/state', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401)
  })

  it('nhà cung cấp tạo khoản phải thu; trùng bị chặn; bên mua không được tạo', async () => {
    const input = { buyerId: 'b1', invoiceSeries: 'C26TAA', invoiceNumber: '0009001', issueDate: iso(new Date()), dueDate: due, amount: 1_500_000_000, description: 'Gia công', fingerprint: 'fp-test-1', docs: { xml: true, contract: true, delivery: true }, source: 'xml' }
    const a = await act(seller, 'createReceivable', input)
    expect(a.status).toBe(200)
    rec = a.body.result
    expect(rec.state).toBe('DRAFT')
    expect(rec.sellerId).toBe('s1')
    expect((await act(seller, 'createReceivable', input)).status).toBe(409)
    expect((await act(buyer, 'createReceivable', input)).status).toBe(403)
    expect((await act(seller, 'createReceivable', { ...input, invoiceNumber: '1', amount: -5 })).status).toBe(400)
  })

  it('bên mua phải xác thực OTP mới được xác nhận; người khác không được xác nhận', async () => {
    expect((await act(seller, 'sendToBuyer', rec.id)).status).toBe(200)
    expect((await act(seller, 'buyerDecision', rec.id, true)).status).toBe(403)
    expect((await act(buyer, 'buyerDecision', rec.id, true)).status).toBe(401) // thiếu OTP
    const bad = await otp(buyer, 'buyer_confirm', `${rec.id}@v1`)
    expect((await act(buyer, 'buyerDecision', rec.id, true, undefined, { id: bad.id, code: bad.code === '000000' ? '111111' : '000000' })).status).toBe(401)
    const good = await otp(buyer, 'buyer_confirm', `${rec.id}@v1`)
    const ok = await act(buyer, 'buyerDecision', rec.id, true, undefined, good)
    expect(ok.status).toBe(200)
    expect(ok.body.state.receivables.find((r: Receivable) => r.id === rec.id).state).toBe('BUYER_CONFIRMED')
    // OTP dùng một lần
    expect((await act(buyer, 'buyerDecision', rec.id, true, undefined, good)).status).toBe(409)
  })

  it('RFQ: chỉ sản phẩm phù hợp; đối tác trả lời; chọn báo giá tạo hồ sơ và thu hồi quyền đối tác khác', async () => {
    const st = await getState(seller)
    const products: FinancingProduct[] = st.products.filter((p: FinancingProduct) => p.status === 'published')
    const okIds: string[] = []
    for (const p of products) {
      const probe = await act(seller, 'createRfq', rec.id, [p.id])
      if (probe.status === 200) {
        okIds.push(p.id)
        await act(seller, 'cancelRfq', probe.body.result.id)
      } else expect(probe.status).toBe(422)
    }
    expect(okIds.length).toBeGreaterThanOrEqual(2)
    const pick = okIds.slice(0, 3)
    const created = await act(seller, 'createRfq', rec.id, pick)
    expect(created.status).toBe(200)
    rfq = created.body.result
    expect((await act(seller, 'createRfq', rec.id, pick)).status).toBe(409) // đã có RFQ mở
    await act(seller, 'simulateRfqResponses', rfq.id)
    const after = (await getState(seller)).rfqs.find((q: Rfq) => q.id === rfq.id) as Rfq
    expect(after.responses.length).toBe(pick.length)
    const chosen = after.responses.find((x) => x.kind === 'quote')!
    lender = await login(chosen.lenderId)

    const sel = await act(seller, 'selectQuote', rfq.id, chosen.lenderId)
    expect(sel.status).toBe(200)
    fa = sel.body.state.applications.find((a: FundingApplication) => a.rfqId === rfq.id)
    expect(fa.lenderId).toBe(chosen.lenderId)
    expect(sel.body.state.receivables.find((r: Receivable) => r.id === rec.id).state).toBe('SUBMITTED')
    // đối tác không được chọn mất quyền xem
    const rest = after.responses.filter((x) => x.lenderId !== chosen.lenderId).map((x) => x.lenderId)
    const st2 = await getState(seller)
    for (const l of rest) expect(st2.consents.find((c: any) => c.recipientId === l && c.purpose === `Gói tóm tắt RFQ ${rfq.id}`).revokedAt).toBeTruthy()
  })

  it('phân quyền dữ liệu: tổ chức không liên quan không thấy chứng từ; đối tác được chọn thấy', async () => {
    const o = await getState(other)
    const lr = o.receivables.find((r: Receivable) => r.id === rec.id)
    if (lr) expect(lr.fingerprint).toBe('') // chỉ còn bản rút gọn cho chấm điểm
    expect(o.consents.every((c: any) => c.ownerId === 'l4' || c.recipientId === 'l4')).toBe(true)
    const l = await getState(lender)
    expect(l.receivables.find((r: Receivable) => r.id === rec.id).fingerprint).toBeTruthy()
  })

  it('tổ chức tài chính thẩm định → đề nghị; doanh nghiệp chấp thuận bằng OTP; giải ngân qua webhook idempotent', async () => {
    expect((await act(seller, 'startReview', fa.id)).status).toBe(403)
    expect((await act(other, 'startReview', fa.id)).status).toBe(403)
    expect((await act(lender, 'makeOffer', fa.id, {})).status).toBe(409) // chưa thẩm định
    expect((await act(lender, 'startReview', fa.id)).status).toBe(200)
    const offer = { advanceVnd: 1_200_000_000, ratePct: 11.5, feesVnd: 3_000_000, tenorDays: 40, conditions: 'Có truy đòi', expiresAt: iso(new Date(Date.now() + 5 * 86_400_000)) }
    expect((await act(lender, 'makeOffer', fa.id, { ...offer, advanceVnd: 9_999_999_999 })).status).toBe(400)
    expect((await act(lender, 'makeOffer', fa.id, offer)).status).toBe(200)
    expect((await act(seller, 'acceptOffer', fa.id)).status).toBe(401) // thiếu OTP
    const p = await otp(seller, 'accept_offer', fa.id)
    expect((await act(seller, 'acceptOffer', fa.id, p)).status).toBe(200)
    expect((await act(seller, 'fundApp', fa.id)).status).toBe(403) // chỉ tổ chức tài chính

    const body = JSON.stringify({ applicationId: fa.id, amount: offer.advanceVnd })
    const sign = (b: string) => createHmac('sha256', SECRET).update(b).digest('hex')
    const hook = (b: string, sig: string, key: string) => app.inject({ method: 'POST', url: '/api/webhooks/funding', headers: { 'content-type': 'application/json', 'x-fcc-signature': sig, 'x-idempotency-key': key }, payload: b })
    expect((await hook(body, 'deadbeef', 'k1')).statusCode).toBe(401)
    const h1 = await hook(body, sign(body), 'k1')
    expect(h1.statusCode).toBe(200)
    expect(h1.json().changed).toBe(true)
    const h2 = await hook(body, sign(body), 'k1')
    expect(h2.headers['x-idempotent-replay']).toBe('true')
    const h3 = await hook(body, sign(body), 'k2') // khóa khác nhưng đã giải ngân → không đổi
    expect(h3.json().changed).toBe(false)
    const s = await getState(seller)
    expect(s.applications.find((a: FundingApplication) => a.id === fa.id).state).toBe('FUNDED')
    expect(s.receivables.find((r: Receivable) => r.id === rec.id).state).toBe('FUNDED')
    expect(s.notifications.some((n: any) => n.title.includes('đã giải ngân'))).toBe(true)
  })

  it('bên mua thanh toán → tất toán cả khoản phải thu lẫn hồ sơ; nhật ký có dấu vết', async () => {
    expect((await act(seller, 'markBuyerPaid', rec.id)).status).toBe(403)
    const r = await act(buyer, 'markBuyerPaid', rec.id)
    expect(r.status).toBe(200)
    expect(r.body.state.receivables.find((x: Receivable) => x.id === rec.id).state).toBe('SETTLED')
    const l = await getState(lender)
    expect(l.applications.find((a: FundingApplication) => a.id === fa.id).state).toBe('SETTLED')
    const actionsLogged = (await getState(seller)).audit.map((e: any) => e.action)
    for (const a of ['Tạo khoản phải thu', 'Bên mua xác nhận', 'Chọn báo giá & gửi hồ sơ', 'Ghi nhận giải ngân', 'Ghi nhận thanh toán của bên mua']) expect(actionsLogged).toContain(a)
  })

  it('ESG: chỉ reviewer mới xác nhận mức; dữ liệu được lưu bền', async () => {
    const s3 = await login('s3')
    const a = await act(s3, 'ensureEsg', 's3')
    const id = a.body.result.id
    expect((await act(s3, 'updateIndicator', id, 'E1', { finalLevel: 3 })).status).toBe(403)
    const rv = await login('s3', true)
    expect((await act(rv, 'updateIndicator', id, 'E1', { finalLevel: 3, reviewerNote: 'ok' })).status).toBe(200)
    expect((await act(s3, 'issueEsg', id, true)).status).toBe(403)
    expect((await act(rv, 'issueEsg', id, true)).status).toBe(200)
  })

  it('tải lại từ DB cho cùng trạng thái', async () => {
    const before = app.getState()
    const { Database } = await import('../src/state')
    const db2 = new Database(':memory:')
    db2.save(before)
    expect(db2.load().receivables.map((r) => r.id)).toEqual(before.receivables.map((r) => r.id))
  })
})
