import { afterAll, describe, expect, it } from 'vitest'
import { dropSchema, newSchema, startApp } from './helpers'
import { signPayload } from '../src/integrations/partner'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const schema = newSchema()
const app = await startApp(schema, { devAutologin: true })
afterAll(async () => {
  await app.close()
  await dropSchema(schema)
})
async function call(method: 'GET' | 'POST', url: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const r = await app.inject({ method, url, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { payload: body as never } : {}) })
  return { status: r.statusCode, body: r.json() as Json }
}
const post = (u: string, b: unknown, t?: string) => call('POST', u, b, t)
const act = (t: string, n: string, ...args: unknown[]) => post(`/api/actions/${n}`, { args }, t)
const session = async (role: string) => (await post('/api/dev/session', { role })).body.token as string
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Dựng một hồ sơ đã giải ngân: hóa đơn 2 tỷ, hạn 90 ngày, ứng 1,6 tỷ, lãi 6%, phí 3,2 tr. */
async function funded(n: string) {
  const [S, B, L] = await Promise.all([session('supplier'), session('buyer'), session('lender')])
  await act(S, 'updateOrg', { foundedYear: 2012, employees: 60 })
  const buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
  const due = iso(new Date(Date.now() + 90 * 86_400_000))
  const rec = (await act(S, 'createReceivable', { buyerId, invoiceSeries: 'S', invoiceNumber: n, issueDate: iso(new Date()), dueDate: due, amount: 2_000_000_000, description: '', fingerprint: `fp-${n}`, docs: { xml: true }, source: 'xml' })).body.result
  await act(S, 'sendToBuyer', rec.id)
  await act(B, 'buyerDecision', rec.id, true)
  let prod = app.getState().products[0]
  if (!prod) prod = (await act(L, 'upsertProduct', { name: 'P', type: 'factoring_recourse', description: '', status: 'pending_review', eligibility: { minAmount: 1, maxAmount: 1e12, maxTenorDays: 365, requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 6, rateMax: 6, fees: [], latePenaltyPct: 150 }, sla: {}, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31' })).body.result
  const sub = await act(S, 'submitDirect', rec.id, prod.id)
  expect(sub.status, JSON.stringify(sub.body)).toBe(200)
  const appId = app.getState().applications.find((a) => a.receivableId === rec.id)!.id
  await act(L, 'startReview', appId)
  await act(L, 'makeOffer', appId, { advanceVnd: 1_600_000_000, ratePct: 6, feesVnd: 3_200_000, tenorDays: 90, conditions: '', expiresAt: iso(new Date(Date.now() + 5 * 86_400_000)) })
  await act(S, 'acceptOffer', appId)
  expect((await act(L, 'fundApp', appId)).status).toBe(200)
  return { S, B, L, rec, appId, due }
}

describe('thu hồi: thanh toán một phần, hai lần, đối soát, thanh lý tài sản, hoàn phần dư', () => {
  it('thanh toán hai lần: lần một giảm dư nợ (chưa tất toán), lần hai tất toán và có phần dư hoàn', async () => {
    const { L, B, S, rec, appId, due } = await funded('H1')
    const at = `${due}`
    const p1 = await act(L, 'confirmPayment', appId, { amount: 1_000_000_000, paidAt: at, reference: 'FT001', externalEventId: 'bank-1' })
    expect(p1.status, JSON.stringify(p1.body)).toBe(200)
    expect(p1.body.result).toMatchObject({ settled: false })
    const mid = app.getState().applications.find((a) => a.id === appId)!
    expect(mid.state).toBe('FUNDED')
    expect(mid.outstanding).toBe(p1.body.result.outstanding)
    expect(mid.settlements![0].allocation).toMatchObject({ fees: 3_200_000 }) // phí trả trước, rồi lãi, rồi gốc
    expect(app.getState().receivables.find((r) => r.id === rec.id)!.state).toBe('FUNDED')

    // gửi lại cùng mã giao dịch ngân hàng: không ghi nhận hai lần
    expect((await act(L, 'confirmPayment', appId, { amount: 1_000_000_000, paidAt: at, externalEventId: 'bank-1' })).body.result).toMatchObject({ duplicate: true })
    expect(app.getState().applications.find((a) => a.id === appId)!.settlements!.filter((e) => e.type === 'payment_received')).toHaveLength(1)

    const p2 = await act(L, 'confirmPayment', appId, { amount: 1_000_000_000, paidAt: at, externalEventId: 'bank-2' })
    expect(p2.body.result).toMatchObject({ settled: true })
    const done = app.getState().applications.find((a) => a.id === appId)!
    expect(done).toMatchObject({ state: 'SETTLED', outstanding: 0 })
    expect(done.refundDue).toBe(373_128_767) // 2 tỷ − gốc 1,6 tỷ − phí 3,2 tr − lãi 90 ngày 23.671.233 (ví dụ của báo cáo)
    expect(done.refundDue).toBeGreaterThan(0)
    expect(app.getState().receivables.find((r) => r.id === rec.id)).toMatchObject({ state: 'SETTLED', paidAmount: 2_000_000_000 })
    await act(L, 'confirmRefund', appId, { amount: done.refundDue })
    expect(app.getState().applications.find((a) => a.id === appId)!.refundPaid).toBe(done.refundDue)
    void B
    void S
  })

  it('đối soát: bên mua báo khác tiền tổ chức tài chính xác nhận thì hiện lệch', async () => {
    const { L, B, appId, rec } = await funded('H2')
    expect((await act(B, 'markBuyerPaid', rec.id, { amount: 2_000_000_000, reference: 'UNC-77' })).status).toBe(200)
    const st = await call('GET', `/v1/funding-applications/${appId}/settlement`, undefined, L)
    expect(st.body.reconciliation).toBe('pending')
    await act(L, 'confirmPayment', appId, { amount: 1_900_000_000 })
    expect((await call('GET', `/v1/funding-applications/${appId}/settlement`, undefined, L)).body.reconciliation).toBe('mismatch')
    expect((await call('GET', `/v1/funding-applications/${appId}/settlement`, undefined, B)).body.reconciliation).toBe('mismatch')
  })

  it('thiếu hụt: thanh lý tài sản bảo đảm bù dư nợ do tổ chức tài chính xác nhận', async () => {
    const { L, appId } = await funded('H3')
    const first = await act(L, 'confirmPayment', appId, { amount: 1_200_000_000, paidAt: iso(new Date(Date.now() + 91 * 86_400_000)) })
    expect(first.body.result.settled).toBe(false)
    const out = first.body.result.outstanding
    expect(out).toBeGreaterThan(0)
    const liq = await act(L, 'confirmPayment', appId, { amount: out + 5_000_000, kind: 'collateral', paidAt: iso(new Date(Date.now() + 120 * 86_400_000)), reference: 'Phát mại lô 2' })
    expect(liq.body.result.settled).toBe(true)
    expect(app.getState().applications.find((a) => a.id === appId)!.settlements!.some((e) => e.type === 'collateral_liquidated')).toBe(true)
  })

  it('sự kiện tiền từ đối tác qua API đối tác: ký, id sự kiện chống ghi nhận lặp, hoàn dư', async () => {
    const { L, appId, rec } = await funded('H4')
    const orgId = app.getState().applications.find((a) => a.id === appId)!.lenderId
    const key = (await call('POST', '/v1/integration-keys', { name: 'k', scopes: ['events:write', 'packages:read'] }, L)).body
    const secret = (await post('/api/webhook-secret', {}, L)).body.secret
    const send = async (id: string, type: string, data: Json) => {
      const body = JSON.stringify({ id, type, data })
      const r = await app.inject({ method: 'POST', url: '/v1/partner/events', headers: { authorization: `Bearer ${key.token}`, 'content-type': 'application/json', 'x-fcc-signature': signPayload(secret, body) }, payload: body })
      return { status: r.statusCode, body: r.json() as Json, replay: r.headers['x-idempotent-replay'] }
    }
    const a = await send('pay-1', 'application.payment_received', { applicationId: appId, amount: 2_000_000_000, paidAt: iso(new Date(Date.now() + 90 * 86_400_000)), reference: 'FT-9' })
    expect(a.status, JSON.stringify(a.body)).toBe(200)
    expect(a.body.result.settled).toBe(true)
    expect((await send('pay-1', 'application.payment_received', { applicationId: appId, amount: 2_000_000_000 })).replay).toBe('true')
    const due = app.getState().applications.find((x) => x.id === appId)!.refundDue!
    expect((await send('ref-1', 'application.refund_paid', { applicationId: appId, amount: due })).status).toBe(200)
    expect(app.getState().applications.find((x) => x.id === appId)!.refundPaid).toBe(due)
    expect((await send('pay-x', 'application.payment_received', { applicationId: 'khong-co', amount: 1 })).status).toBe(404)
    void orgId
    void rec
  })
})
