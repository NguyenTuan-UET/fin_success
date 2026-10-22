import { afterAll, describe, expect, it } from 'vitest'
import { dropSchema, newSchema, startApp } from './helpers'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const schema = newSchema()
const app = await startApp(schema, { devAutologin: true })
afterAll(async () => {
  await app.close()
  await dropSchema(schema)
})
const post = async (url: string, body: unknown, token?: string) => {
  const r = await app.inject({ method: 'POST', url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body as never })
  return { status: r.statusCode, body: r.json() as Json }
}
const act = (t: string, n: string, ...args: unknown[]) => post(`/api/actions/${n}`, { args }, t)
const session = async (role: string) => (await post('/api/dev/session', { role })).body.token as string
const today = new Date().toISOString().slice(0, 10)
const due = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)

describe('hóa đơn: cờ bất thường, điều chỉnh, đối chiếu thuế', () => {
  it('hóa đơn lớn cho bên nhập khẩu mới bị gắn cờ, báo FCC; FCC thấy bản rút gọn và xử lý cờ', async () => {
    const S = await session('supplier')
    const B = await session('buyer')
    const F = await session('fcc')
    const buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
    const r = await act(S, 'createReceivable', { buyerId, invoiceSeries: 'A', invoiceNumber: '1', issueDate: today, dueDate: due, amount: 2_500_000_000, description: 'Thép', fingerprint: 'fp-1', docs: {}, source: 'manual' })
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(r.body.result.flags.map((f: Json) => f.code)).toEqual(expect.arrayContaining(['NEW_BUYER_LARGE', 'ROUND_LARGE_MANUAL', 'NO_SOURCE_DOCUMENT']))
    expect(app.getState().notifications.some((n) => n.title.includes('cờ bất thường'))).toBe(true)

    const seen = (await app.inject({ method: 'GET', url: '/api/state', headers: { authorization: `Bearer ${F}` } })).json().state.receivables
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ code: r.body.result.code, description: '', fingerprint: '' }) // FCC không thấy chứng từ/mô tả

    expect((await act(S, 'resolveFlag', r.body.result.id, 'NEW_BUYER_LARGE', 'ok')).status).toBe(403) // chỉ FCC
    expect((await act(F, 'resolveFlag', r.body.result.id, 'NEW_BUYER_LARGE', '')).status).toBe(400)
    expect((await act(F, 'resolveFlag', r.body.result.id, 'NEW_BUYER_LARGE', 'Đã gọi xác nhận với bên nhập khẩu, có hợp đồng khung')).status).toBe(200)
    expect((await act(F, 'resolveFlag', r.body.result.id, 'NEW_BUYER_LARGE', 'lần hai')).status).toBe(404) // đã xử lý
    const flags = app.getState().receivables.find((x) => x.id === r.body.result.id)!.flags!
    expect(flags.find((f) => f.code === 'NEW_BUYER_LARGE')).toMatchObject({ resolvedBy: expect.any(String), resolutionNote: expect.stringContaining('hợp đồng khung') })
    void B
  })

  it('điều chỉnh sau xác nhận: tăng phiên bản, xác nhận cũ mất hiệu lực, RFQ đang mở bị đóng', async () => {
    const S = await session('supplier')
    const B = await session('buyer')
    const L = await session('lender')
    const buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
    const id = (await act(S, 'createReceivable', { buyerId, invoiceSeries: 'A', invoiceNumber: '2', issueDate: today, dueDate: due, amount: 800_000_000, description: '', fingerprint: 'fp-2', docs: { xml: true }, source: 'xml' })).body.result.id
    await act(S, 'sendToBuyer', id)
    expect((await act(S, 'reviseReceivable', id, { amount: 700_000_000, note: '' })).status).toBe(400)
    await act(B, 'buyerDecision', id, true)
    // sản phẩm + RFQ
    await act(S, 'updateOrg', { foundedYear: 2015, employees: 40 })
    const p = (await act(L, 'upsertProduct', { name: 'P', type: 'factoring_recourse', description: '', status: 'pending_review', eligibility: { minAmount: 1, maxAmount: 1e12, maxTenorDays: 365, requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 8, rateMax: 12, fees: [], latePenaltyPct: 150 }, sla: {}, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31' })).body.result
    const q = await act(S, 'createRfq', id, [p.id])
    expect(q.status, JSON.stringify(q.body)).toBe(200)

    const rev = await act(S, 'reviseReceivable', id, { amount: 700_000_000, note: 'Giảm do trả hàng lô 2' })
    expect(rev.status, JSON.stringify(rev.body)).toBe(200)
    const r = app.getState().receivables.find((x) => x.id === id)!
    expect(r).toMatchObject({ amount: 700_000_000, version: 2, state: 'BUYER_PENDING' })
    expect(r.confirmedAt).toBeUndefined()
    expect(app.getState().rfqs.find((x) => x.id === q.body.result.id)!.state).toBe('CANCELLED')
    // không điều chỉnh khi đã được tài trợ/đang có hồ sơ; bên nhập khẩu phải xác nhận lại phiên bản mới
    expect((await act(B, 'reviseReceivable', id, { amount: 1, note: 'x' })).status).toBe(403)
    expect((await act(B, 'buyerDecision', id, true)).status).toBe(200)
    expect(app.getState().receivables.find((x) => x.id === id)!.state).toBe('BUYER_CONFIRMED')
  })

  it('đối chiếu thuế: chỉ vận hành FCC ghi nhận; không khớp/đã hủy cần ghi chú và báo đơn vị xuất khẩu', async () => {
    const S = await session('supplier')
    const F = await session('fcc')
    const rid = app.getState().receivables[0].id
    expect((await act(S, 'recordTaxCheck', rid, { status: 'verified' })).status).toBe(403)
    expect((await act(F, 'recordTaxCheck', rid, { status: 'cancelled' })).status).toBe(400)
    expect((await act(F, 'recordTaxCheck', rid, { status: 'cancelled', note: 'Cổng thuế: hóa đơn đã bị hủy ngày 10/10' })).status).toBe(200)
    expect(app.getState().receivables.find((x) => x.id === rid)!.taxCheck).toMatchObject({ status: 'cancelled', method: 'manual_lookup' })
    expect(app.getState().notifications.some((n) => n.title.includes('đối chiếu thuế'))).toBe(true)
  })
})
