import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app'

const on = buildApp({ dbPath: ':memory:', listedDir: '../web-legacy/public/listed', devAutologin: true })
const off = buildApp({ dbPath: ':memory:', listedDir: '../web-legacy/public/listed' })
afterAll(async () => {
  await on.close()
  await off.close()
})

const post = async (app: typeof on, url: string, body: unknown, token?: string) => {
  const r = await app.inject({ method: 'POST', url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body as never })
  return { status: r.statusCode, body: r.json() as any } // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('chế độ dev: mỗi bên một trang tự vào', () => {
  it('tắt theo mặc định', async () => {
    expect((await off.inject({ method: 'GET', url: '/api/health' })).json().dev).toBe(false)
    expect((await post(off, '/api/dev/session', { role: 'supplier' })).status).toBe(404)
  })

  it('cấp phiên cho từng bên, chỉ tạo tổ chức trống, dùng lại lần sau', async () => {
    expect((await on.inject({ method: 'GET', url: '/api/health' })).json().dev).toBe(true)
    expect((await post(on, '/api/dev/session', { role: 'hacker' })).status).toBe(400)
    const s = await post(on, '/api/dev/session', { role: 'supplier' })
    expect(s.status).toBe(200)
    expect(s.body.state.orgs.map((o: any) => o.type)).toEqual(['supplier'])
    for (const k of ['receivables', 'products', 'profiles', 'esg']) expect(s.body.state[k]).toEqual([])
    const again = await post(on, '/api/dev/session', { role: 'supplier' })
    expect(again.body.me.id).toBe(s.body.me.id)
    const b = await post(on, '/api/dev/session', { role: 'buyer' })
    const l = await post(on, '/api/dev/session', { role: 'lender' })
    expect(l.body.state.orgs.find((o: any) => o.type === 'lender').verified).toBe(true)
    expect(on.getState().orgs).toHaveLength(3)

    // luồng ngắn: sản phẩm tự công bố, bên mua xác nhận không cần mật khẩu
    const act = (t: string, n: string, ...args: unknown[]) => post(on, `/api/actions/${n}`, { args }, t)
    const p = await act(l.body.token, 'upsertProduct', { name: 'SP', type: 'factoring_recourse', description: '', status: 'pending_review', eligibility: { minAmount: 1, maxAmount: 1e12, maxTenorDays: 365, requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 8, rateMax: 12, fees: [], latePenaltyPct: 150 }, sla: {}, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31' })
    expect(p.body.result.status).toBe('published')
    const due = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
    const r = await act(s.body.token, 'createReceivable', { buyerId: b.body.me.orgId, invoiceSeries: 'A', invoiceNumber: '1', issueDate: new Date().toISOString().slice(0, 10), dueDate: due, amount: 1_000_000, description: '', fingerprint: 'x', docs: {}, source: 'manual' })
    await act(s.body.token, 'sendToBuyer', r.body.result.id)
    expect((await act(b.body.token, 'buyerDecision', r.body.result.id, true)).status).toBe(200)
    expect((await act(s.body.token, 'updateOrg', { name: 'Công ty thật', employees: 12, foundedYear: 2015 })).status).toBe(200)
    expect((await act(s.body.token, 'updateOrg', { employees: -1 })).status).toBe(400)
  })
})
