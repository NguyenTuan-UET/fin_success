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
  const text = r.body
  let json: Json = null
  try { json = JSON.parse(text) } catch { /* không phải JSON */ }
  return { status: r.statusCode, body: json, text, headers: r.headers }
}
const post = (u: string, b: unknown, t?: string) => call('POST', u, b, t)
const act = (t: string, n: string, ...args: unknown[]) => post(`/api/actions/${n}`, { args }, t)
const session = async (role: string) => (await post('/api/dev/session', { role })).body.token as string
const iso = (d: Date) => d.toISOString().slice(0, 10)
const period = new Date().toISOString().slice(0, 7)

async function fundOne(n: string) {
  const [S, B, L] = await Promise.all([session('supplier'), session('buyer'), session('lender')])
  await act(S, 'updateOrg', { foundedYear: 2012, employees: 60 })
  const buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
  const rec = (await act(S, 'createReceivable', { buyerId, invoiceSeries: 'F', invoiceNumber: n, issueDate: iso(new Date()), dueDate: iso(new Date(Date.now() + 90 * 86_400_000)), amount: 2_000_000_000, description: '', fingerprint: `fee-${n}`, docs: { xml: true }, source: 'xml' })).body.result
  await act(S, 'sendToBuyer', rec.id)
  await act(B, 'buyerDecision', rec.id, true)
  const prod = app.getState().products[0] ?? (await act(L, 'upsertProduct', { name: 'P', type: 'factoring_recourse', description: '', status: 'pending_review', eligibility: { minAmount: 1, maxAmount: 1e12, maxTenorDays: 365, requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 6, rateMax: 6, fees: [], latePenaltyPct: 150 }, sla: {}, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31' })).body.result
  await act(S, 'submitDirect', rec.id, prod.id)
  const appId = app.getState().applications.find((a) => a.receivableId === rec.id)!.id
  await act(L, 'startReview', appId)
  await act(L, 'makeOffer', appId, { advanceVnd: 1_600_000_000, ratePct: 6, feesVnd: 3_200_000, tenorDays: 90, conditions: '', expiresAt: iso(new Date(Date.now() + 5 * 86_400_000)) })
  await act(S, 'acceptOffer', appId)
  await act(L, 'fundApp', appId)
  return { S, B, L, appId }
}

describe('phí và doanh thu theo 6 nguồn', () => {
  it('biểu phí 0 đồng: chạy bình thường, không phát sinh phí; biểu phí công khai', async () => {
    const { S } = await fundOne('1')
    const sch = (await call('GET', '/v1/fee-schedule', undefined, S)).body
    expect(sch.active).toMatchObject({ id: 'fee-v0', transactionPct: 0 })
    expect(Object.keys(sch.sources)).toHaveLength(6)
    expect((await call('GET', '/v1/fees', undefined, S)).body).toMatchObject({ charges: [], total: 0 })
  })

  it('tạo biểu phí mới (chỉ quản trị FCC, từ hôm nay): phí giao dịch và hoa hồng phát sinh khi giải ngân, truy được về phiên bản', async () => {
    const F = await session('fcc')
    const S = await session('supplier')
    expect((await post('/v1/operations/fee-schedules', { name: 'x', params: {}, effectiveFrom: iso(new Date()) }, S)).status).toBe(403)
    const bad = await post('/v1/operations/fee-schedules', { name: 'sai', params: { transactionPct: -2 }, effectiveFrom: iso(new Date()) }, F)
    expect(bad.status).toBe(422)
    expect((await post('/v1/operations/fee-schedules', { name: 'quá khứ', params: { transactionPct: 0.3, saasMonthly: { supplier: 0, buyer: 0, lender: 0 }, scoringFee: 0, apiMonthlyPerKey: 0, reportFee: 0, referralPctOfFees: 0 }, effectiveFrom: '2020-01-01' }, F)).status).toBe(422)
    const created = await post('/v1/operations/fee-schedules', { name: 'Pilot v1', params: { transactionPct: 0.3, saasMonthly: { supplier: 500_000, buyer: 1_000_000, lender: 5_000_000 }, scoringFee: 200_000, apiMonthlyPerKey: 2_000_000, reportFee: 100_000, referralPctOfFees: 20 }, effectiveFrom: iso(new Date()) }, F)
    expect(created.status, JSON.stringify(created.body)).toBe(200)

    const { S: S2, L, appId } = await fundOne('2')
    const fees = (await call('GET', '/v1/fees', undefined, S2)).body
    expect(fees.charges).toHaveLength(1)
    expect(fees.charges[0]).toMatchObject({ source: 'transaction', amount: 4_800_000, scheduleId: created.body.id }) // 0,3% × 1,6 tỷ
    const lf = (await call('GET', '/v1/fees', undefined, L)).body
    expect(lf.charges.find((c: Json) => c.source === 'referral')).toMatchObject({ amount: 640_000 }) // 20% × 3,2 tr
    expect(appId).toBeTruthy()
  })

  it('chạy tính phí tháng: thuê bao SaaS và kết nối API, chạy lại không tạo trùng; dashboard doanh thu khớp', async () => {
    const F = await session('fcc')
    const L = await session('lender')
    const key = await call('POST', '/v1/integration-keys', { name: 'k', scopes: ['packages:read'] }, L)
    expect(key.status, JSON.stringify(key.body)).toBe(200)
    expect((await call('GET', '/v1/partner/rfqs', undefined, key.body.token)).status).toBe(200) // một lượt gọi API
    const first = await post('/v1/operations/billing-run', { period }, F)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.created).toBeGreaterThanOrEqual(4) // 3 loại tổ chức + khóa API
    const again = await post('/v1/operations/billing-run', { period }, F)
    expect(again.body.created).toBe(0)
    expect((await call('GET', '/v1/fees', undefined, L)).body.charges.some((c: Json) => c.source === 'api' && c.amount === 2_000_000)).toBe(true)

    const rev = (await call('GET', '/v1/operations/revenue', undefined, F)).body
    const sum = rev.bySource.reduce((t: number, x: Json) => t + x.total, 0)
    expect(rev.total).toBe(sum)
    expect(rev.bySource.find((x: Json) => x.source === 'saas').total).toBe(500_000 + 1_000_000 + 5_000_000)
    expect(rev.bySource.find((x: Json) => x.source === 'transaction').total).toBe(4_800_000)
    expect((await call('GET', '/v1/operations/revenue', undefined, L)).status).toBe(403)
  })

  it('phí đã phát sinh không đổi khi đổi biểu phí; không sửa/xóa ở mức CSDL; thanh toán được ghi nhận', async () => {
    const F = await session('fcc')
    const S = await session('supplier')
    const before = (await call('GET', '/v1/fees', undefined, S)).body.charges[0]
    await post('/v1/operations/fee-schedules', { name: 'Pilot v2', params: { transactionPct: 1, saasMonthly: { supplier: 0, buyer: 0, lender: 0 }, scoringFee: 0, apiMonthlyPerKey: 0, reportFee: 0, referralPctOfFees: 0 }, effectiveFrom: iso(new Date()) }, F)
    expect((await call('GET', '/v1/fees', undefined, S)).body.charges[0]).toMatchObject({ amount: before.amount, scheduleId: before.scheduleId })
    await expect(app.db.rawQuery(`UPDATE fee_charges SET amount = 1`)).rejects.toThrow('không được sửa')
    await expect(app.db.rawQuery(`DELETE FROM fee_charges`)).rejects.toThrow('không được xóa')
    const orgId = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    expect((await post('/v1/operations/fees/mark-paid', { orgId, period, reference: 'CK-123' }, F)).body.updated).toBeGreaterThan(0)
    expect((await call('GET', '/v1/fees', undefined, S)).body.charges.every((c: Json) => c.paidAt)).toBe(true)
  })

  it('hóa đơn phí in được qua liên kết ký ngắn hạn; xuất báo cáo CSV phát sinh phí báo cáo', async () => {
    const S = await session('supplier')
    const link = await call('GET', `/v1/fees/invoice-link?period=${period}`, undefined, S)
    const html = await call('GET', link.body.url)
    expect(html.status).toBe(200)
    expect(html.text).toContain('Bảng kê phí dịch vụ FCC')
    expect(html.text).toContain('Phí giao dịch tài trợ')
    expect((await call('GET', link.body.url.replace(/sig=(\w)/, (_, c) => `sig=${c === '0' ? '1' : '0'}`))).status).toBe(403)
    const before = (await call('GET', '/v1/fees', undefined, S)).body.charges.length
    const csv = await call('GET', '/v1/exports/receivables.csv', undefined, S)
    expect(csv.status).toBe(200)
    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.text.split('\n')[0]).toBe('ma,so_hoa_don,doi_tac,so_tien,ngay_lap,han_thanh_toan,trang_thai')
    // biểu phí hiện hành (v2) có reportFee 0 → không phát sinh phí báo cáo
    expect((await call('GET', '/v1/fees', undefined, S)).body.charges.length).toBe(before)
    const L = await session('lender')
    expect((await call('GET', '/v1/exports/receivables.csv', undefined, L)).status).toBe(403)
    expect((await call('GET', '/v1/exports/portfolio.csv', undefined, L)).text).toContain('ho_so,hoa_don')
  })
})
