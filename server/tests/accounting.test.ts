import { afterAll, describe, expect, it } from 'vitest'
import { dropSchema, newSchema, startApp } from './helpers'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const schema = newSchema()
const app = await startApp(schema, { devAutologin: true })
afterAll(async () => {
  await app.close()
  await dropSchema(schema)
})
async function call(method: 'GET' | 'POST', url: string, body?: unknown, token?: string) {
  const r = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(body !== undefined ? { payload: body as never } : {}) })
  let json: Json = null
  try { json = JSON.parse(r.body) } catch { /* không phải JSON */ }
  return { status: r.statusCode, body: json, text: r.body }
}
const post = (u: string, b: unknown, t?: string) => call('POST', u, b, t)
const act = (t: string, n: string, ...args: unknown[]) => post(`/api/actions/${n}`, { args }, t)
const session = async (role: string) => (await post('/api/dev/session', { role })).body.token as string
const iso = (d: Date) => d.toISOString().slice(0, 10)

describe('kế toán: sao kê giả lập, bút toán đề xuất, dự báo lưu và sai số', () => {
  let S: string, B: string, L: string, appId: string, recId: string

  it('liên kết ngân hàng giả lập cần khai số dư trước; sao kê ghi rõ nguồn giả lập', async () => {
    S = await session('supplier')
    B = await session('buyer')
    L = await session('lender')
    const orgId = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    expect((await post('/v1/bank/link', {}, S)).status).toBe(409)
    expect((await act(S, 'saveCashProfile', orgId, { openingCash: 500_000_000, recurringMonthlyOut: [{ name: 'Lương', amount: 100_000_000, day: 5 }] })).status).toBe(200)
    expect((await post('/v1/bank/link', {}, S)).status).toBe(200)
    const st = await call('GET', '/v1/bank/statement', undefined, S)
    expect(st.body.source).toContain('giả lập')
    expect(st.body.opening).toBe(500_000_000)
    expect((await call('GET', '/v1/bank/statement?from=2026-02-01&to=2026-01-01', undefined, S)).status).toBe(422)
    expect((await call('GET', '/v1/bank/statement', undefined, L)).status).toBe(409) // tổ chức tài chính chưa liên kết
  })

  it('giải ngân → sao kê có dòng tiền vào (đã trừ phí) và bút toán đề xuất cân Nợ/Có', async () => {
    await act(S, 'updateOrg', { foundedYear: 2012, employees: 60 })
    const buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
    const rec = (await act(S, 'createReceivable', { buyerId, invoiceSeries: 'K', invoiceNumber: '1', issueDate: iso(new Date()), dueDate: iso(new Date(Date.now() + 90 * 86_400_000)), amount: 2_000_000_000, description: '', fingerprint: 'kt-1', docs: { xml: true }, source: 'xml' })).body.result
    recId = rec.id
    await act(S, 'sendToBuyer', rec.id)
    await act(B, 'buyerDecision', rec.id, true)
    const prod = (await act(L, 'upsertProduct', { name: 'P', type: 'factoring_recourse', description: '', status: 'pending_review', eligibility: { minAmount: 1, maxAmount: 1e12, maxTenorDays: 365, requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 6, rateMax: 6, fees: [], latePenaltyPct: 150 }, sla: {}, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31' })).body.result
    await act(S, 'submitDirect', rec.id, prod.id)
    appId = app.getState().applications.find((a) => a.receivableId === rec.id)!.id
    await act(L, 'startReview', appId)
    await act(L, 'makeOffer', appId, { advanceVnd: 1_600_000_000, ratePct: 6, feesVnd: 3_200_000, tenorDays: 90, conditions: '', expiresAt: iso(new Date(Date.now() + 5 * 86_400_000)) })
    await act(S, 'acceptOffer', appId)
    await act(L, 'fundApp', appId)

    const st = (await call('GET', '/v1/bank/statement', undefined, S)).body
    expect(st.lines.find((l: Json) => l.kind === 'advance').amount).toBe(1_596_800_000)
    const j = (await call('GET', '/v1/journal-entries', undefined, S)).body
    const funded = j.entries.find((e: Json) => e.ref === `funded:${appId}`)
    expect(funded).toMatchObject({ status: 'suggested' })
    expect(funded.lines.reduce((t: number, l: Json) => t + l.debit, 0)).toBe(funded.lines.reduce((t: number, l: Json) => t + l.credit, 0))
    expect((await call('GET', '/v1/journal-entries?regime=TT200', undefined, S)).body.entries.find((e: Json) => e.ref === `funded:${appId}`).lines.map((l: Json) => l.account)).toContain('3411')
    expect((await call('GET', '/v1/journal-entries', undefined, L)).status).toBe(422) // tổ chức tài chính không dùng bút toán
  })

  it('duyệt bút toán: sửa phải cân; xuất CSV chỉ gồm bút toán đã duyệt', async () => {
    const ref = `funded:${appId}`
    expect((await post('/v1/journal-entries/decision', { ref, status: 'approved', lines: [{ account: '112', accountName: 'x', debit: 100, credit: 0 }, { account: '341', accountName: 'y', debit: 0, credit: 90 }] }, S)).status).toBe(422)
    expect((await post('/v1/journal-entries/decision', { ref: 'khong-co', status: 'approved' }, S)).status).toBe(404)
    expect((await call('GET', '/v1/journal-entries/export.csv', undefined, S)).text.trim().split('\n')).toHaveLength(1) // chưa duyệt gì
    expect((await post('/v1/journal-entries/decision', { ref, status: 'approved', note: 'Đã đối chiếu giấy báo có' }, S)).status).toBe(200)
    const csv = (await call('GET', '/v1/journal-entries/export.csv', undefined, S)).text.trim().split('\n')
    expect(csv[0]).toBe('ngay,so_chung_tu,dien_giai,tk_no,tk_co,so_tien')
    expect(csv.some((l) => l.includes(ref) && l.endsWith('112,341,1596800000'))).toBe(true)
    expect((await call('GET', '/v1/journal-entries', undefined, S)).body.entries.find((e: Json) => e.ref === ref)).toMatchObject({ status: 'approved', decidedNote: 'Đã đối chiếu giấy báo có' })
  })

  it('dự báo: lưu theo đầu vào (không lưu trùng), dùng số dư từ sao kê; sai số đo trên khoản đã thanh toán', async () => {
    const f1 = await post('/v1/cashflow-forecasts', {}, S)
    expect(f1.status, JSON.stringify(f1.body)).toBe(200)
    expect(f1.body).toMatchObject({ stored: true, modelVersion: expect.stringContaining('cashflow-v1') })
    expect(f1.body.opening).toBeGreaterThan(1_500_000_000) // số dư khai + giải ngân từ sao kê
    expect(f1.body.points).toHaveLength(91)
    expect((await post('/v1/cashflow-forecasts', {}, S)).body).toMatchObject({ stored: false, inputsHash: f1.body.inputsHash }) // cùng đầu vào cùng ngày
    expect((await call('GET', '/v1/cashflow-forecasts/latest', undefined, S)).body.expectedAr).toHaveLength(1)

    // bên mua trả đúng hạn dự kiến+3 ngày; tổ chức tài chính xác nhận → đo sai số
    const due = app.getState().receivables.find((r) => r.id === recId)!.dueDate
    const paidAt = iso(new Date(new Date(due).getTime() + 3 * 86_400_000))
    await act(B, 'markBuyerPaid', recId, { amount: 2_000_000_000, paidAt: iso(new Date()) })
    await act(L, 'confirmPayment', appId, { amount: 2_100_000_000, paidAt: iso(new Date()) })
    void paidAt
    const acc = (await call('GET', '/v1/cashflow-forecasts/accuracy', undefined, S)).body
    expect(acc.evaluated).toBe(1)
    expect(acc.meanAbsErrorDays).toBeGreaterThan(80) // thanh toán sớm ~90 ngày so với hạn: lệch lớn, được đo và hiển thị
    expect(acc.note).toContain('không phải cam kết')
  })
})
