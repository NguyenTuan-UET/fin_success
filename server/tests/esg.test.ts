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
const CODES = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']

describe('ESG — quy tắc bằng chứng, lý do và phát hành (SPEC F16–F18)', () => {
  it('thẩm định: mức ≥ 2 cần bằng chứng; khác AI cần lý do; N/A cần lý do; không phát hành khi thiếu bao phủ hoặc cờ chưa xử lý', async () => {
    const S = await session('supplier')
    const F = await session('fcc')
    const orgId = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    const id = (await act(S, 'ensureEsg', orgId)).body.result.id

    // AI đề xuất
    expect((await act(S, 'updateIndicator', id, 'E1', { aiLevel: 3, aiRationale: 'Có hóa đơn', aiCitations: [] })).status).toBe(422)
    expect((await act(S, 'updateIndicator', id, 'E1', { aiLevel: 3, aiRationale: 'Có hóa đơn', aiCitations: [{ documentId: 'khong-co', note: 'x' }] })).status).toBe(422)
    expect((await act(S, 'updateIndicator', id, 'E1', { aiLevel: 1, aiRationale: 'Chỉ tuyên bố' })).status).toBe(200)
    expect((await act(S, 'addEsgDocument', id, { id: 'd-old', name: 'cu.pdf', mime: 'application/pdf', docType: 'Hóa đơn điện', indicatorCodes: ['E1', 'E2'] })).status).toBe(200)
    expect((await act(S, 'updateIndicator', id, 'E2', { aiLevel: 3, aiRationale: 'Đủ', aiCitations: [{ documentId: 'd-old', note: '12 tháng điện' }] })).status).toBe(200)

    // mức ≥ 2 cần bằng chứng gắn với chỉ tiêu
    expect((await act(F, 'updateIndicator', id, 'E3', { finalLevel: 2, reviewerNote: 'ok' })).status).toBe(422)
    expect((await act(F, 'updateIndicator', id, 'E2', { finalLevel: 3 })).status).toBe(200) // trùng đề xuất AI: không cần lý do
    // khác đề xuất AI (E1: AI = 1) → cần lý do
    expect((await act(F, 'updateIndicator', id, 'E1', { finalLevel: 0 })).status).toBe(400)
    expect((await act(F, 'updateIndicator', id, 'E1', { finalLevel: 0, reviewerNote: 'Phát hiện hóa đơn điện bị gián đoạn' })).status).toBe(200)
    // N/A cần lý do
    expect((await act(F, 'updateIndicator', id, 'E4', { na: true })).status).toBe(400)
    expect((await act(F, 'updateIndicator', id, 'E4', { na: true, naReason: 'Không phát sinh chất thải nguy hại' })).status).toBe(200)

    // đủ bao phủ nhưng còn cờ trọng yếu (E5 mức 0 là chỉ tiêu trọng yếu) chưa có ghi chú
    for (const c of CODES.filter((c) => !['E1', 'E2', 'E4'].includes(c))) {
      const patch = c === 'E5' ? { finalLevel: 0 } : { finalLevel: 1 }
      expect((await act(F, 'updateIndicator', id, c, patch)).status, c).toBe(200)
    }
    const flagged = await act(F, 'issueEsg', id, true)
    expect(flagged.status).toBe(422)
    expect(flagged.body.error).toContain('E5')
    expect((await act(F, 'updateIndicator', id, 'E5', { reviewerNote: 'Đã đối chiếu: vi phạm đã khắc phục, có biên bản' })).status).toBe(200)
    expect((await act(F, 'issueEsg', id, true)).status).toBe(200)
    expect(app.getState().esg.find((e) => e.id === id)).toMatchObject({ status: 'official' })
  })

  it('không phát hành chính thức khi độ bao phủ dưới 80%', async () => {
    const F = await session('fcc')
    const B = await session('buyer')
    const orgId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
    const id = (await act(B, 'ensureEsg', orgId)).body.result.id
    for (const c of CODES.slice(0, 5)) await act(F, 'updateIndicator', id, c, { finalLevel: 1 })
    const r = await act(F, 'issueEsg', id, true)
    expect(r.status).toBe(422)
    expect(r.body.error).toContain('80%')
  })
})
