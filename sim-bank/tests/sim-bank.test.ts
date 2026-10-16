import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { buildApp, type FccApp } from '../../server/src/app'
import { Database } from '../../server/src/state'
import { provisionSimBanks } from '../../server/src/sim/provision'
import { createSimBank } from '../src/bank'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const DB = process.env.TEST_DATABASE_URL ?? `postgres://fcc@/fcc_test?host=${resolve('../server/data/pg-run')}&port=5433`
const schema = `t_${randomBytes(6).toString('hex')}`
let fcc: FccApp
let sim: ReturnType<typeof createSimBank>
let fccUrl = ''

beforeAll(async () => {
  // FCC ở chế độ dev (không MFA, sản phẩm tự công bố) — test tập trung vào hành vi ngân hàng giả lập
  fcc = await buildApp({ dbUrl: DB, dbSchema: schema, listedDir: '../server/seed/listed', dataKey: randomBytes(32).toString('hex'), filesDir: mkdtempSync(join(tmpdir(), 'fcc-sim-')), devAutologin: true })
  await fcc.listen({ port: 0, host: '127.0.0.1' })
  fccUrl = `http://127.0.0.1:${(fcc.server.address() as AddressInfo).port}`
  // cấp phát trước để biết khóa, rồi dựng sim-bank và cập nhật địa chỉ webhook theo cổng thật
  const tmp = await provisionSimBanks(fcc.core, 'http://127.0.0.1:1')
  sim = createSimBank({ fccApiUrl: fccUrl, institutions: tmp, disburseDelaySec: 0 })
  await sim.app.listen({ port: 0, host: '127.0.0.1' })
  const simUrl = `http://127.0.0.1:${(sim.app.server.address() as AddressInfo).port}`
  for (const i of tmp) await fcc.db.setPartnerEndpoint(i.orgId, `${simUrl}/hooks/${i.slug}`)
  await sim.ensureProducts()
})
afterAll(async () => {
  await sim?.app.close()
  await fcc?.close()
  const db = await Database.open(DB, schema)
  await db.dropSchema()
  await db.close()
})

const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const r = await fetch(`${fccUrl}${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  return { status: r.status, body: (await r.json()) as Json }
}
/** Gửi webhook đang chờ và để sim-bank xử lý xong, lặp tới khi hết việc. */
async function pump() {
  for (let i = 0; i < 10; i++) {
    const n = await fcc.deliverWebhooks()
    await sim.settle()
    if (!n) return
  }
}
/** Phiên dev; doanh nghiệp khai hồ sơ cơ bản như ở Cài đặt → Tổ chức (năm thành lập, số lao động). */
const session = async (role: string) => {
  const t = (await call('POST', '/api/dev/session', { role })).body.token as string
  expect((await call('POST', '/v1/organizations/me', { foundedYear: 2015, employees: 40 }, t)).status).toBe(200)
  return t
}
let invoiceNo = 100
async function confirmedReceivable(S: string, B: string, amount = 900_000_000) {
  const buyerId = (await call('GET', '/v1/me', undefined, B)).body.orgId
  const due = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)
  const n = String(++invoiceNo)
  const r = await call('POST', '/v1/receivables', { buyerId, invoiceSeries: '1C26TSM', invoiceNumber: n, issueDate: new Date().toISOString().slice(0, 10), dueDate: due, amount, description: 'Thép cuộn', fingerprint: `sim-${n}`, source: 'xml', docs: { xml: true, contract: true, delivery: true } }, S)
  expect(r.status, JSON.stringify(r.body)).toBe(200)
  const id = r.body.result.id
  await call('POST', `/v1/receivables/${id}/buyer-invitation`, {}, S)
  expect((await call('POST', `/v1/receivables/${id}/buyer-decision`, { confirm: true }, B)).status).toBe(200)
  return id as string
}

describe('ngân hàng giả lập đi qua đúng API đối tác và webhook của FCC', () => {
  it('3 tổ chức hư cấu, đã xác minh, gắn cờ giả lập; sản phẩm được đăng qua API đối tác', async () => {
    const orgs = fcc.getState().orgs.filter((o) => o.simulated)
    expect(orgs.map((o) => o.name).sort()).toEqual(['SimBank An Khang', 'SimFinance Bình Minh', 'SimFund Cửu Long'])
    expect(orgs.every((o) => o.type === 'lender' && o.verified)).toBe(true)
    const products = fcc.getState().products
    expect(products.length).toBe(5)
    expect(products.every((p) => orgs.some((o) => o.id === p.lenderId))).toBe(true)
    await sim.ensureProducts() // chạy lại không đăng trùng
    expect(fcc.getState().products.length).toBe(5)
  })

  it('trọn vòng: RFQ → báo giá theo hạng → chọn → thẩm định, đề nghị → chấp thuận → giải ngân (sự kiện có chữ ký)', async () => {
    const S = await session('supplier')
    const B = await session('buyer')
    const rec = await confirmedReceivable(S, B)
    const m = await call('GET', `/v1/receivables/${rec}/matches`, undefined, S)
    const ankhang = m.body.eligible.find((x: Json) => x.product.name === 'Bao thanh toán có truy đòi')
    expect(ankhang, JSON.stringify(m.body.notEligible.map((x: Json) => [x.product.name, x.reasons]))).toBeDefined()
    const q = await call('POST', '/v1/rfqs', { receivableId: rec, productIds: [ankhang.product.id] }, S)
    expect(q.status, JSON.stringify(q.body)).toBe(200)
    await pump()
    const rfq = fcc.getState().rfqs.find((x) => x.id === q.body.result.id)!
    expect(rfq.responses).toHaveLength(1)
    expect(rfq.responses[0]).toMatchObject({ kind: 'quote', advancePct: 80 })
    expect(rfq.responses[0].ratePct).toBeGreaterThanOrEqual(8)

    expect((await call('POST', `/v1/rfqs/${rfq.id}/select`, { lenderId: rfq.responses[0].lenderId }, S)).status).toBe(200)
    await pump()
    const ap = fcc.getState().applications.find((a) => a.rfqId === rfq.id)!
    expect(ap.state).toBe('OFFERED')
    expect(ap.offer!.advanceVnd).toBe(720_000_000)

    expect((await call('POST', `/v1/funding-applications/${ap.id}/accept`, {}, S)).status).toBe(200)
    await pump()
    expect(fcc.getState().applications.find((a) => a.id === ap.id)!.state).toBe('FUNDED')
    const audit = fcc.getState().audit.find((e) => e.action === 'Ghi nhận giải ngân' && e.entity === ap.id)
    expect(audit?.actorUserId).toMatch(/^key:/)
    expect(sim.log.some((l) => l.kind === 'disbursement' && l.detail.includes('đã giải ngân'))).toBe(true)

    // bên mua thanh toán → ngân hàng giả lập xác nhận tiền về → tất toán → hoàn phần dư
    expect((await call('POST', `/v1/receivables/${rec}/buyer-payment`, { amount: 900_000_000 }, B)).status).toBe(200)
    await pump()
    const settled = fcc.getState().applications.find((x) => x.id === ap.id)!
    expect(settled.state).toBe('SETTLED')
    expect(settled.refundDue).toBeGreaterThan(0)
    expect(settled.refundPaid).toBe(settled.refundDue)
    expect(sim.log.some((l) => l.kind === 'settlement' && l.detail.includes('đã hoàn phần dư'))).toBe(true)

    // phát lại: FCC bỏ qua sự kiện trùng, từ chối chữ ký sai
    const slug = 'ankhang'
    const dup = await sim.app.inject({ method: 'POST', url: '/control/replay', payload: JSON.stringify({ slug, kind: 'duplicate' }), headers: { 'content-type': 'application/json' } })
    expect(dup.json()).toMatchObject({ status: 200, replay: true })
    const bad = await sim.app.inject({ method: 'POST', url: '/control/replay', payload: JSON.stringify({ slug, kind: 'bad_signature' }), headers: { 'content-type': 'application/json' } })
    expect(bad.json().status).toBe(401)
  })

  it('kịch bản: bên mua trả một phần → chưa tất toán; thanh lý tài sản bù thiếu hụt thì tất toán', async () => {
    const S = await session('supplier')
    const B = await session('buyer')
    const rec = await confirmedReceivable(S, B, 1_000_000_000)
    const pid = fcc.getState().products.find((p) => p.name === 'Bao thanh toán có truy đòi')!.id
    const q = await call('POST', '/v1/rfqs', { receivableId: rec, productIds: [pid] }, S)
    await pump()
    const rfq = fcc.getState().rfqs.find((x) => x.id === q.body.result.id)!
    await call('POST', `/v1/rfqs/${rfq.id}/select`, { lenderId: rfq.responses[0].lenderId }, S)
    await pump()
    const ap = fcc.getState().applications.find((a) => a.rfqId === rfq.id)!
    await call('POST', `/v1/funding-applications/${ap.id}/accept`, {}, S)
    await pump()
    expect(fcc.getState().applications.find((a) => a.id === ap.id)!.state).toBe('FUNDED')
    await sim.app.inject({ method: 'POST', url: '/control/scenario', payload: JSON.stringify({ id: ap.id, behavior: 'partial_payment' }), headers: { 'content-type': 'application/json' } })
    await call('POST', `/v1/receivables/${rec}/buyer-payment`, {}, B)
    await pump()
    const partial = fcc.getState().applications.find((a) => a.id === ap.id)!
    expect(partial.state).toBe('FUNDED')
    expect(partial.outstanding).toBeGreaterThan(0)
    const liq = await sim.app.inject({ method: 'POST', url: '/control/collateral', payload: JSON.stringify({ slug: 'ankhang', applicationId: ap.id, amount: partial.outstanding! + 1_000_000 }), headers: { 'content-type': 'application/json' } })
    expect(liq.json().ok).toBe(true)
    await pump()
    expect(fcc.getState().applications.find((a) => a.id === ap.id)!.state).toBe('SETTLED')
  })

  it('kịch bản từ chối thẩm định; tắt tự động thì hồ sơ chờ người thao tác', async () => {
    const S = await session('supplier')
    const B = await session('buyer')
    const rec = await confirmedReceivable(S, B, 800_000_000)
    const pid = fcc.getState().products.find((p) => p.name === 'Bao thanh toán có truy đòi')!.id
    const q = await call('POST', '/v1/rfqs', { receivableId: rec, productIds: [pid] }, S)
    expect(q.status, JSON.stringify(q.body)).toBe(200)
    await pump()
    const lenderId = fcc.getState().rfqs.find((x) => x.id === q.body.result.id)!.responses[0].lenderId
    const sel = await call('POST', `/v1/rfqs/${q.body.result.id}/select`, { lenderId }, S)
    expect(sel.status, JSON.stringify(sel.body)).toBe(200)
    // ép từ chối cho hồ sơ vừa tạo (ngân hàng xử lý khi nhận webhook)
    const ap = fcc.getState().applications.find((a) => a.rfqId === q.body.result.id)!
    await sim.app.inject({ method: 'POST', url: '/control/scenario', payload: JSON.stringify({ id: ap.id, behavior: 'reject' }), headers: { 'content-type': 'application/json' } })
    await pump()
    expect(fcc.getState().applications.find((a) => a.id === ap.id)!.state).toBe('REJECTED')

    // hạng hồ sơ giờ thấp hơn (tập trung vào cùng bên mua, có hồ sơ bị từ chối) → dùng sản phẩm nhận hạng BB của SimFinance
    await sim.app.inject({ method: 'POST', url: '/control/auto', payload: JSON.stringify({ slug: 'binhminh', auto: false }), headers: { 'content-type': 'application/json' } })
    const quick = fcc.getState().products.find((p) => p.name === 'Tài trợ hóa đơn nhanh')!.id
    const rec2 = await confirmedReceivable(S, B, 700_000_000)
    const q2 = await call('POST', '/v1/rfqs', { receivableId: rec2, productIds: [quick] }, S)
    expect(q2.status, JSON.stringify(q2.body)).toBe(200)
    await pump()
    expect(fcc.getState().rfqs.find((x) => x.id === q2.body.result.id)!.responses).toHaveLength(0)
    expect(sim.log[0].detail).toContain('Tự động đang tắt')
  })

  it('webhook giả mạo (sai chữ ký) bị ngân hàng giả lập từ chối', async () => {
    const r = await sim.app.inject({ method: 'POST', url: '/hooks/ankhang', payload: JSON.stringify({ id: 'evt_x', type: 'offer.accepted', data: { applicationId: 'x' } }), headers: { 'content-type': 'application/json', 'x-fcc-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}` } })
    expect(r.statusCode).toBe(401)
  })
})
