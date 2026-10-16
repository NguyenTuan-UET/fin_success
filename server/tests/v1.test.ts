import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createHmac } from 'node:crypto'
import { dropSchema, newSchema, startApp } from './helpers'
import { totp } from '../src/auth/totp'
import { signPayload, verifySignature } from '../src/integrations/partner'
import { ENDPOINTS, openApi } from '../src/routes/v1'

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

// máy nhận webhook của "ngân hàng": lần đầu trả 500 để kiểm tra thử lại
const received: { headers: IncomingMessage['headers']; body: string }[] = []
let failNext = true
const hookServer = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (failNext) {
      failNext = false
      res.writeHead(500).end()
      return
    }
    received.push({ headers: req.headers, body })
    res.writeHead(200).end('ok')
  })
})
await new Promise<void>((r) => hookServer.listen(0, '127.0.0.1', r))
const hookUrl = `http://127.0.0.1:${(hookServer.address() as AddressInfo).port}/fcc-hook`

afterAll(async () => {
  hookServer.close()
  await app.close()
  await dropSchema(schema)
})

async function call(method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const r = await app.inject({ method, url, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { payload: body as never } : {}) })
  return { status: r.statusCode, body: r.json() as Json, headers: r.headers }
}
let mst = 5_000_000_000
async function register(type: string, name: string) {
  const r = await call('POST', '/api/auth/register', {
    email: `${name}@example.test`, password: PW, name, title: 'Giám đốc',
    org: { name: `Công ty ${name}`, shortName: name, taxCode: String(++mst), type, vsic: '2592', industryLabel: 'Cơ khí', industryGroup: 'manufacturing', foundedYear: 2015, employees: 40, province: 'Hà Nội' },
  })
  expect(r.status, JSON.stringify(r.body)).toBe(201)
  const token = r.body.token as string
  const s = await call('POST', '/api/auth/mfa/setup', {}, token)
  expect((await call('POST', '/api/auth/mfa/enable', { code: code(s.body.secret) }, token)).status).toBe(200)
  return { token, orgId: r.body.me.activeOrgId as string }
}

describe('OpenAPI là hợp đồng nguồn', () => {
  it('mọi route /v1 đã đăng ký đều có trong tài liệu và ngược lại', async () => {
    const doc = (await call('GET', '/v1/openapi.json')).body
    const documented = new Set(Object.entries(doc.paths as Record<string, Record<string, unknown>>).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${p}`)))
    const registered = new Set(app.routes.filter((r) => r.url.startsWith('/v1/')).map((r) => `${r.method} ${r.url.replace(/:(\w+)/g, '{$1}')}`))
    expect([...registered].filter((x) => !documented.has(x))).toEqual([])
    expect([...documented].filter((x) => !registered.has(x))).toEqual([])
    expect(openApi().paths['/v1/rfqs']).toBeDefined()
    expect(ENDPOINTS.filter((e) => e.action).every((e) => typeof e.action === 'string')).toBe(true)
  })
})

describe('luồng tài trợ qua /v1, tổ chức tài chính dùng khóa tích hợp', () => {
  let admin: string, S: Awaited<ReturnType<typeof register>>, B: typeof S, L: typeof S
  let partner: string, signing: string, recId: string, rfqId: string, appId: string, productId: string

  beforeAll(async () => {
    const lg = await call('POST', '/api/auth/login', ADMIN)
    admin = lg.body.token
    const s = await call('POST', '/api/auth/mfa/setup', {}, admin)
    await call('POST', '/api/auth/mfa/enable', { code: code(s.body.secret) }, admin)
    S = await register('supplier', 'v1sup')
    B = await register('buyer', 'v1buy')
    L = await register('lender', 'v1bank')
    expect((await call('POST', `/v1/organizations/${L.orgId}/verify`, { verified: true }, admin)).status).toBe(200)
  })

  it('tổ chức tài chính tạo khóa tích hợp, đặt địa chỉ webhook; khóa sai phạm vi bị chặn', async () => {
    expect((await call('POST', '/v1/integration-keys', { name: 'x', scopes: ['products:write'] }, S.token)).status).toBe(403)
    expect((await call('POST', '/v1/integration-keys', { name: 'x', scopes: ['admin:all'] }, L.token)).status).toBe(422)
    const k = await call('POST', '/v1/integration-keys', { name: 'Core banking', scopes: ['products:write', 'rfqs:respond', 'applications:write', 'packages:read', 'events:write'] }, L.token)
    expect(k.status, JSON.stringify(k.body)).toBe(200)
    partner = k.body.token
    const ro = await call('POST', '/v1/integration-keys', { name: 'Chỉ đọc', scopes: ['packages:read'] }, L.token)
    expect((await call('POST', '/v1/partner/products', {}, ro.body.token)).status).toBe(403)
    expect((await call('GET', '/v1/partner/rfqs', undefined, 'fcck_k_000000000000.sai')).status).toBe(401)
    signing = (await call('POST', '/api/webhook-secret', {}, L.token)).body.secret
    expect((await call('POST', '/v1/partner-endpoint', { url: 'http://example.com/x' }, L.token)).status).toBe(422)
    expect((await call('POST', '/v1/partner-endpoint', { url: hookUrl }, L.token)).status).toBe(200)
  })

  it('đối tác đăng sản phẩm qua API; FCC duyệt', async () => {
    const p = await call('POST', '/v1/partner/products', {
      name: 'Bao thanh toán API', type: 'factoring_recourse', description: 'Có truy đòi', status: 'pending_review',
      eligibility: { minAmount: 100_000_000, maxAmount: 5_000_000_000, maxTenorDays: 120, requireBuyerConfirmation: true },
      pricing: { advancePct: 80, rateMin: 8, rateMax: 11, fees: [], latePenaltyPct: 150 }, sla: { quoteHours: 24 }, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31',
    }, partner)
    expect(p.status, JSON.stringify(p.body)).toBe(200)
    productId = p.body.result.id
    expect((await call('POST', `/v1/financing-products/${productId}/review`, { approve: true }, admin)).status).toBe(200)
  })

  it('khoản phải thu: 422 khi dữ liệu sai, Idempotency-Key chống tạo trùng, phân trang bằng cursor', async () => {
    const due = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)
    const base = { buyerId: B.orgId, invoiceSeries: '1C26TAA', issueDate: new Date().toISOString().slice(0, 10), dueDate: due, amount: 900_000_000, description: 'Thép', source: 'manual', docs: {} }
    expect((await call('POST', '/v1/receivables', { ...base, invoiceNumber: '1', fingerprint: 'f1', amount: -1 }, S.token)).status).toBe(422)
    const k = { 'idempotency-key': 'tao-hd-0000123' }
    const a = await call('POST', '/v1/receivables', { ...base, invoiceNumber: '123', fingerprint: 'f123' }, S.token, k)
    const b = await call('POST', '/v1/receivables', { ...base, invoiceNumber: '123', fingerprint: 'f123' }, S.token, k)
    expect(a.status, JSON.stringify(a.body)).toBe(200)
    expect(b.headers['x-idempotent-replay']).toBe('true')
    expect(b.body.result.id).toBe(a.body.result.id)
    recId = a.body.result.id
    for (const n of ['124', '125']) await call('POST', '/v1/receivables', { ...base, invoiceNumber: n, fingerprint: `f${n}` }, S.token)
    const p1 = await call('GET', '/v1/receivables?limit=2', undefined, S.token)
    expect(p1.body.items).toHaveLength(2)
    const p2 = await call('GET', `/v1/receivables?limit=2&cursor=${p1.body.nextCursor}`, undefined, S.token)
    expect(p2.body.items).toHaveLength(1)
    expect(p2.body.nextCursor).toBeNull()
    expect((await call('GET', '/v1/receivables?cursor=khong-co', undefined, S.token)).status).toBe(422)
  })

  it('SSE: bên mua nhận sự kiện thay đổi trong ≤ 2 giây khi nhà cung cấp gửi lời mời xác nhận', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' })
    const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
    const t = await call('POST', '/v1/events/ticket', {}, B.token)
    expect((await fetch(`${base}/v1/events?ticket=sai`)).status).toBe(401)
    const ctl = new AbortController()
    const res = await fetch(`${base}${t.body.url}`, { signal: ctl.signal })
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''
    const waitFor = async (needle: string) => {
      const until = Date.now() + 2000
      while (!buf.includes(needle)) {
        if (Date.now() > until) throw new Error(`không nhận được ${needle}: ${buf}`)
        const { value } = await reader.read()
        buf += dec.decode(value)
      }
    }
    await waitFor('event: hello')
    const started = Date.now()
    expect((await call('POST', `/v1/receivables/${recId}/buyer-invitation`, {}, S.token)).status).toBe(200)
    await waitFor('event: change')
    expect(Date.now() - started).toBeLessThan(2000)
    ctl.abort()
    expect((await fetch(`${base}${t.body.url}`)).status).toBe(401) // vé chỉ dùng một lần
  })

  it('bên mua xác nhận; RFQ; đối tác thấy RFQ qua API và nhận webhook rfq.created (có thử lại, có chữ ký)', async () => {
    expect((await call('POST', `/v1/receivables/${recId}/buyer-decision`, { confirm: true }, B.token)).status).toBe(200)
    const m = await call('GET', `/v1/receivables/${recId}/matches`, undefined, S.token)
    expect(m.body.eligible.map((x: Json) => x.product.id)).toContain(productId)
    const q = await call('POST', '/v1/rfqs', { receivableId: recId, productIds: [productId] }, S.token)
    expect(q.status, JSON.stringify(q.body)).toBe(200)
    rfqId = q.body.result.id
    const list = await call('GET', '/v1/partner/rfqs', undefined, partner)
    expect(list.body.items.map((x: Json) => x.id)).toContain(rfqId)

    await app.deliverWebhooks() // lần 1: máy nhận trả 500
    expect(received).toHaveLength(0)
    const pending = await call('GET', '/v1/partner-endpoint/deliveries', undefined, L.token)
    expect(pending.body[0]).toMatchObject({ type: 'rfq.created', attempts: 1, lastStatus: 500 })
    offset += 15_000 // qua thời gian chờ thử lại (10 giây)
    await app.deliverWebhooks()
    expect(received).toHaveLength(1)
    const h = received[0]
    expect(h.headers['x-fcc-event-type']).toBe('rfq.created')
    expect(verifySignature(signing, String(h.headers['x-fcc-signature']), h.body, now().getTime())).toBe(true)
    expect(JSON.parse(h.body).data).toMatchObject({ rfqId, receivableId: recId, amount: 900_000_000 })
  })

  it('đối tác báo giá → doanh nghiệp chọn → đối tác thẩm định, ra đề nghị → doanh nghiệp chấp thuận', async () => {
    const resp = await call('POST', `/v1/partner/rfqs/${rfqId}/responses`, { productId, kind: 'quote', advancePct: 80, ratePct: 9, feesVnd: 500_000, validUntil: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) }, partner)
    expect(resp.status, JSON.stringify(resp.body)).toBe(200)
    const sel = await call('POST', `/v1/rfqs/${rfqId}/select`, { lenderId: L.orgId }, S.token)
    expect(sel.status, JSON.stringify(sel.body)).toBe(200)
    const apps = await call('GET', '/v1/partner/applications', undefined, partner)
    appId = apps.body.items.find((a: Json) => a.receivableId === recId).id
    expect(apps.body.items[0].score).toBeDefined()
    expect((await call('POST', `/v1/partner/applications/${appId}/review`, {}, partner)).status).toBe(200)
    const offer = { advanceVnd: 720_000_000, ratePct: 9, feesVnd: 500_000, tenorDays: 60, conditions: 'Có truy đòi', expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) }
    expect((await call('POST', `/v1/partner/applications/${appId}/offer`, offer, partner)).status).toBe(200)
    expect((await call('POST', `/v1/funding-applications/${appId}/accept`, {}, S.token)).status).toBe(200)
  })

  it('sự kiện giải ngân từ đối tác: phải ký, chống phát lại theo thời điểm và theo id', async () => {
    const body = JSON.stringify({ id: 'disb-0001', type: 'application.funded', data: { applicationId: appId } })
    const send = (sig: string, b = body) => app.inject({ method: 'POST', url: '/v1/partner/events', headers: { authorization: `Bearer ${partner}`, 'content-type': 'application/json', 'x-fcc-signature': sig }, payload: b })
    expect((await send('t=1,v1=' + '0'.repeat(64))).statusCode).toBe(401)
    const old = Math.floor(now().getTime() / 1000) - 600
    expect((await send(signPayload(signing, body, old))).statusCode).toBe(401) // quá 5 phút
    const ok = await send(signPayload(signing, body, Math.floor(now().getTime() / 1000)))
    expect(ok.statusCode, ok.body).toBe(200)
    expect(ok.json().result.changed).toBe(true)
    const again = await send(signPayload(signing, body, Math.floor(now().getTime() / 1000)))
    expect(again.headers['x-idempotent-replay']).toBe('true')
    const bad = JSON.stringify({ id: 'x-1', type: 'money.teleported', data: {} })
    expect((await send(signPayload(signing, bad, Math.floor(now().getTime() / 1000)), bad)).statusCode).toBe(422)
    const st = await call('GET', `/v1/funding-applications/${appId}`, undefined, S.token)
    expect(st.body.state).toBe('FUNDED')
    const audit = await call('GET', '/v1/audit-events?limit=500', undefined, admin)
    expect(audit.body.items.some((e: Json) => e.action === 'Ghi nhận giải ngân' && e.actorUserId?.startsWith('key:'))).toBe(true)
    expect((await call('GET', '/v1/audit-events/integrity', undefined, admin)).body.ok).toBe(true)
    expect(createHmac).toBeDefined()
  })
})
