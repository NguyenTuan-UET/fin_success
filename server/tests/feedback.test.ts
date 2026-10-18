// Phản hồi người dùng thử (document/test): bản nháp không lộ cho bên mua, kiểm phiên bản khi xác nhận, lịch sử điều chỉnh,
// bổ sung chứng từ, bên mua xem chứng từ của khoản đã gửi.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dropSchema, newSchema, startApp } from './helpers'
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
const stateOf = async (t: string) => (await call('GET', '/api/state', undefined, t)).body.state as Json

let S: string, B: string, buyerId: string
beforeAll(async () => {
  ;[S, B] = await Promise.all([session('supplier'), session('buyer')])
  buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
})
const draft = async (n: string, amount = 12_345_678) =>
  (await act(S, 'createReceivable', { buyerId, invoiceSeries: 'F', invoiceNumber: n, issueDate: iso(new Date()), dueDate: iso(new Date(Date.now() + 30 * 86_400_000)), amount, description: '', fingerprint: `fp-f-${n}`, docs: {}, source: 'manual' })).body.result as { id: string; code: string }

describe('bản nháp chỉ bên bán thấy (F02, F03)', () => {
  it('trước khi gửi: bên mua không thấy khoản, nhật ký hay số tiền; sau khi gửi mới thấy', async () => {
    const r = await draft('D1')
    const b1 = await stateOf(B)
    expect(b1.receivables.find((x: Json) => x.id === r.id)).toBeUndefined()
    expect(JSON.stringify(b1.audit)).not.toContain(r.code)
    expect((await call('GET', `/v1/receivables/${r.id}`, undefined, B)).status).toBe(404)
    const lender = await session('lender')
    expect((await stateOf(lender)).receivables.find((x: Json) => x.id === r.id)).toBeUndefined() // không lộ cả bản rút gọn
    expect((await act(S, 'sendToBuyer', r.id)).status).toBe(200)
    const b2 = await stateOf(B)
    expect(b2.receivables.find((x: Json) => x.id === r.id)).toMatchObject({ amount: 12_345_678, state: 'BUYER_PENDING' })
    expect(b2.receivables.find((x: Json) => x.id === r.id).sentAt).toBeTruthy()
  })

  it('bản nháp bị hủy trước khi gửi vẫn không lộ', async () => {
    const r = await draft('D2')
    expect((await act(S, 'cancelReceivable', r.id)).status).toBe(200)
    expect((await stateOf(B)).receivables.find((x: Json) => x.id === r.id)).toBeUndefined()
  })
})

describe('điều chỉnh sau khi gửi (F01, F16)', () => {
  it('bên mua xác nhận phiên bản cũ bị từ chối 409; lịch sử ghi trước/sau và lý do', async () => {
    const r = await draft('V1', 10_000_000)
    await act(S, 'sendToBuyer', r.id)
    expect((await act(S, 'reviseReceivable', r.id, { amount: 12_000_000, note: 'Sai đơn giá' })).status).toBe(200)
    const stale = await post(`/v1/receivables/${r.id}/buyer-decision`, { confirm: true, version: 1 }, B)
    expect(stale.status).toBe(409)
    expect(stale.body.error).toContain('v2')
    const ok = await post(`/v1/receivables/${r.id}/buyer-decision`, { confirm: true, version: 2 }, B)
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect((await act(S, 'reviseReceivable', r.id, { dueDate: iso(new Date(Date.now() + 45 * 86_400_000)), note: 'Gia hạn' })).status).toBe(200)
    const rec = (await stateOf(B)).receivables.find((x: Json) => x.id === r.id)
    expect(rec.revisions).toHaveLength(2)
    expect(rec.revisions[0]).toMatchObject({ version: 2, note: 'Sai đơn giá', before: { amount: 10_000_000 }, after: { amount: 12_000_000 }, voidedConfirmation: false })
    expect(rec.revisions[1]).toMatchObject({ version: 3, voidedConfirmation: true })
  })
})

describe('bổ sung và xem chứng từ (F14, F15)', () => {
  it('bên bán bổ sung chứng từ cho khoản đang chờ; bên mua xem được tệp của khoản đã gửi, không xem được của bản nháp', async () => {
    const up = async (name: string) => (await post('/api/files', { name, mime: 'application/pdf', dataBase64: Buffer.from(`%PDF ${name}`).toString('base64'), kind: 'contract' }, S)).body.key as string
    const sent = await draft('A1')
    await act(S, 'sendToBuyer', sent.id)
    const k1 = await up('hop-dong.pdf')
    expect((await post(`/v1/receivables/${sent.id}/documents`, { files: [{ key: k1, name: 'hop-dong.pdf', kind: 'contract' }] }, S)).status).toBe(200)
    expect((await post(`/v1/receivables/${sent.id}/documents`, { files: [{ key: 'f'.repeat(64), name: 'x', kind: 'contract' }] }, S)).status).toBeGreaterThanOrEqual(400) // tệp không thuộc tổ chức
    expect((await post(`/v1/receivables/${sent.id}/documents`, { files: [{ key: k1, name: 'x', kind: 'contract' }] }, B)).status).toBeGreaterThanOrEqual(400) // bên mua không gắn chứng từ cho khoản của bên bán
    const rec = app.getState().receivables.find((x) => x.id === sent.id)!
    expect(rec.docs.contract).toBe(true)
    expect(rec.files?.map((f) => f.kind)).toEqual(['contract'])
    expect((await call('GET', `/api/files/${k1}/url`, undefined, B)).status).toBe(200)

    const d = await draft('A2')
    const k2 = await up('nhap.pdf')
    await post(`/v1/receivables/${d.id}/documents`, { files: [{ key: k2, name: 'nhap.pdf', kind: 'delivery' }] }, S)
    expect((await call('GET', `/api/files/${k2}/url`, undefined, B)).status).toBe(404)
  })
})
