import { afterAll, describe, expect, it } from 'vitest'
import { setCustomsGate } from '../src/service'
import { dropSchema, newSchema, startApp } from './helpers'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const schema = newSchema()
const app = await startApp(schema, { devAutologin: true })
afterAll(async () => {
  setCustomsGate('warn')
  await app.close()
  await dropSchema(schema)
})
const call = async (method: string, url: string, body: unknown, token: string, headers: Record<string, string> = {}) => {
  const r = await app.inject({ method: method as never, url, headers: { authorization: `Bearer ${token}`, ...headers }, payload: body as never })
  return { status: r.statusCode, body: r.json() as Json }
}
const post = (url: string, body: unknown, token: string, headers?: Record<string, string>) => call('POST', url, body, token, headers)
const act = (t: string, n: string, ...args: unknown[]) => post(`/api/actions/${n}`, { args }, t)
const session = async (role: string) => ((await app.inject({ method: 'POST', url: '/api/dev/session', payload: { role } as never })).json() as Json).token as string
const today = new Date().toISOString().slice(0, 10)
const due = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)

const S = await session('supplier')
const B = await session('buyer')
const L = await session('lender')
const F = await session('fcc')
const buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
let n = 0
const draft = async () => {
  n++
  const r = await act(S, 'createReceivable', { buyerId, invoiceSeries: 'C', invoiceNumber: String(n), issueDate: today, dueDate: due, amount: 300_000_000 + n, description: '', fingerprint: `fp-c${n}`, docs: { xml: true }, source: 'xml' })
  expect(r.status, JSON.stringify(r.body)).toBe(200)
  return r.body.result.id as string
}
const up = async (t: string, name: string) => ((await post('/api/files', { name, mime: 'application/pdf', dataBase64: Buffer.from(`%PDF ${name}`).toString('base64'), kind: 'customs' }, t)).body.key as string)
const recv = (id: string) => app.getState().receivables.find((x) => x.id === id)!
const url = (id: string) => `/v1/receivables/${id}/customs-documents`

describe('chứng từ hải quan', () => {
  it('phân quyền theo phía, trạng thái và kind', async () => {
    const id = await draft()
    const kx = await up(S, 'tk-xk.pdf')
    const kv = await up(S, 'bl.pdf')
    expect((await post(url(id), { files: [{ key: kx, name: 'tk-xk.pdf', kind: 'customs_export_declaration' }, { key: kv, name: 'bl.pdf', kind: 'transport_document' }], info: { declarationNo: ' abc 123456 ', clearance: 'cleared' } }, S)).status).toBe(200)
    expect(recv(id)).toMatchObject({ docs: { customs: true }, customsInfo: { export: { declarationNo: 'ABC123456', clearance: 'cleared' } } })
    expect(recv(id).files!.filter((f) => f.by).length).toBe(2)
    expect((await post(url(id), { files: [{ key: kx, name: 'tk-xk.pdf', kind: 'customs_export_declaration' }] }, S)).status).toBe(200) // trùng: bỏ qua
    expect(recv(id).files).toHaveLength(2)

    const ki = await up(B, 'tk-nk.pdf')
    expect((await post(url(id), { files: [{ key: ki, name: 'tk-nk.pdf', kind: 'customs_import_declaration' }] }, B)).status).toBe(409) // DRAFT
    expect((await post(url(id), { files: [{ key: await up(L, 'l.pdf'), name: 'x', kind: 'customs_other' }] }, L)).status).toBe(403) // bên thứ ba
    await act(S, 'sendToBuyer', id)
    expect((await post(url(id), { files: [{ key: ki, name: 'tk-nk.pdf', kind: 'customs_import_declaration' }], info: { declarationNo: 'IMP98765', clearance: 'cleared' } }, B)).status).toBe(200)
    expect(recv(id).customsInfo?.import?.declarationNo).toBe('IMP98765')
    expect(recv(id).customsInfo?.export?.declarationNo).toBe('ABC123456') // không đụng phía xuất
    expect((await post(url(id), { files: [{ key: ki, name: 'x', kind: 'customs_export_declaration' }] }, B)).status).toBe(403) // sai phía
    expect((await post(url(id), { files: [{ key: ki, name: 'x', kind: 'nope' }] }, B)).status).toBe(422)
    expect((await post(url(id), {}, B)).status).toBe(422) // /v1 trả 422 cho dữ liệu sai
    expect((await post(url(id), { info: { declarationDate: '15/10/2026' } }, S)).status).toBe(422)

    // kind hải quan không đi qua /documents hay createReceivable
    expect((await post(`/v1/receivables/${id}/documents`, { files: [{ key: kx, name: 'x', kind: 'transport_document' }] }, S)).status).toBe(422)
    // khóa tệp của tổ chức khác bị từ chối
    expect((await post(url(id), { files: [{ key: ki, name: 'x', kind: 'customs_other' }] }, S)).status).toBe(422)

    // bên xuất mở được tệp do bên nhập tải; tổ chức không liên quan thì không; FCC không thấy files
    expect((await call('GET', `/api/files/${ki}/url`, undefined, S)).status).toBe(200)
    expect((await call('GET', `/api/files/${ki}/url`, undefined, L)).status).toBe(404)
    const fccView = (await call('GET', '/api/state', undefined, F)).body.state.receivables as Json[]
    expect(fccView.every((r) => !r.files && !r.customsInfo)).toBe(true)

    // khoản đã hủy: khóa
    await act(S, 'cancelReceivable', id)
    expect((await post(url(id), { files: [{ key: kv, name: 'x', kind: 'packing_list' }] }, S)).status).toBe(409)
  })

  it('giới hạn tệp, cờ trùng tờ khai, MST khác, nhật ký, thông báo', async () => {
    const a = await draft()
    const b = await draft()
    const files = [] as Json[]
    for (let i = 0; i < 10; i++) files.push({ key: await up(S, `f${i}.pdf`), name: `f${i}.pdf`, kind: 'customs_other' })
    expect((await post(url(a), { files: [...files, files[0]] }, S)).status).toBe(422) // > 10 tệp/lần
    expect((await post(url(a), { files }, S)).status).toBe(200)
    expect((await post(url(b), { info: { declarationNo: 'SAME-0001' } }, S)).status).toBe(200)
    expect((await post(url(a), { info: { declarationNo: 'same-0001', exporterTaxCode: '0000000000' } }, S)).status).toBe(200)
    expect(recv(a).flags?.map((f) => f.code)).toEqual(expect.arrayContaining(['CUSTOMS_DECL_REUSED', 'CUSTOMS_EXPORTER_MISMATCH']))
    expect(recv(b).flags?.map((f) => f.code)).toContain('CUSTOMS_DECL_REUSED')
    expect(app.getState().audit.some((e) => e.action === 'Bổ sung chứng từ hải quan' && e.entity === recv(a).code)).toBe(true)
    expect((await call('GET', '/v1/audit-events/integrity', undefined, S)).status).toBeLessThan(500)
    const spec = (await app.inject({ method: 'GET', url: '/v1/openapi.json' })).json() as Json
    expect(Object.keys(spec.paths)).toContain('/v1/receivables/{id}/customs-documents')
  })

  it('cổng RFQ: block chặn khi thiếu tờ khai hoặc chưa thông quan; warn/off cho qua', async () => {
    const id = await draft()
    await act(S, 'sendToBuyer', id)
    expect((await act(B, 'buyerDecision', id, true)).status).toBe(200)
    await act(S, 'updateOrg', { foundedYear: 2015, employees: 40 })
    const p = (await act(L, 'upsertProduct', { name: 'P', type: 'factoring_recourse', description: '', status: 'pending_review', eligibility: { minAmount: 1, maxAmount: 1e12, maxTenorDays: 365, requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 8, rateMax: 12, fees: [], latePenaltyPct: 150 }, sla: {}, effectiveFrom: '2020-01-01', effectiveTo: '2099-12-31' })).body.result
    setCustomsGate('block')
    const missing = await act(S, 'createRfq', id, [p.id])
    expect(missing.status).toBe(422)
    expect(JSON.stringify(missing.body)).toContain('tờ khai')
    const k = await up(S, 'tk.pdf')
    await post(url(id), { files: [{ key: k, name: 'tk.pdf', kind: 'customs_export_declaration' }], info: { declarationNo: 'GATE0001', clearance: 'pending' } }, S)
    expect((await act(S, 'createRfq', id, [p.id])).status).toBe(422) // chưa thông quan
    await post(url(id), { info: { clearance: 'cleared' } }, S)
    const ok = await act(S, 'createRfq', id, [p.id])
    expect(ok.status, JSON.stringify(ok.body)).toBe(200) // thiếu vận đơn không chặn
    // RFQ mở: tổ chức tài chính thấy files; thông báo/sự kiện bổ sung không lỗi
    expect((await post(url(id), { files: [{ key: await up(S, 'bl.pdf'), name: 'bl.pdf', kind: 'transport_document' }] }, S)).status).toBe(200)
    const lenderView = (await call('GET', '/api/state', undefined, L)).body.state.receivables.find((r: Json) => r.id === id)
    expect(lenderView.files.length).toBe(2)
    expect(lenderView.customsInfo.export.clearance).toBe('cleared')
    setCustomsGate('off')
    setCustomsGate('warn')
  })
})
