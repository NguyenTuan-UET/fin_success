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
  return { status: r.statusCode, body: r.json() as Json }
}
const post = (u: string, b: unknown, t?: string) => call('POST', u, b, t)
const act = (t: string, n: string, ...args: unknown[]) => post(`/api/actions/${n}`, { args }, t)
const session = async (role: string) => (await post('/api/dev/session', { role })).body.token as string

const fy = (year: number, netProfit: number) => ({ year, revenue: 12_000_000_000, netProfit, ebit: 1_400_000_000, interestExpense: 150_000_000, depreciation: 300_000_000, totalAssets: 9e9, currentAssets: 5.5e9, currentLiabilities: 3e9, totalLiabilities: 4.5e9, equity: 4.5e9, operatingCashFlow: 900_000_000, debtService: 700_000_000, cash: 1.2e9, inventory: 1.5e9, receivables: 2.4e9, source: 'Doanh nghiệp tự khai', status: 'self_declared' })

describe('chấm điểm tín dụng ở máy chủ: bất biến, tái lập, xem xét lại, phiên bản', () => {
  it('cùng đầu vào → cùng kết quả và cùng input_hash (không tạo bản ghi mới); đổi dữ liệu → bản ghi mới; kết quả đã lưu không sửa được', async () => {
    const S = await session('supplier')
    const orgId = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    await act(S, 'updateOrg', { foundedYear: 2012, employees: 60, vsic: '2592' })
    const a = await post(`/v1/organizations/${orgId}/credit-assessments`, {}, S)
    expect(a.status, JSON.stringify(a.body)).toBe(200)
    expect(a.body).toMatchObject({ kind: 'supplier', status: 'provisional', reused: false, scorecardVersionId: 'sc-v1.0' })
    expect(a.body.inputHash).toMatch(/^[0-9a-f]{64}$/)
    const again = await post(`/v1/organizations/${orgId}/credit-assessments`, {}, S)
    expect(again.body).toMatchObject({ id: a.body.id, reused: true, inputHash: a.body.inputHash })

    await act(S, 'upsertFinancialYear', orgId, fy(2025, 800_000_000))
    const b = await post(`/v1/organizations/${orgId}/credit-assessments`, {}, S)
    expect(b.body.id).not.toBe(a.body.id)
    expect(b.body.inputHash).not.toBe(a.body.inputHash)
    expect((await call('GET', `/v1/credit-assessments/${a.body.id}`, undefined, S)).body.status).toBe('superseded') // bản tạm tính cũ bị thay thế

    // bất biến ở mức CSDL
    await expect(app.db.rawQuery(`UPDATE credit_assessments SET score = 99 WHERE id = $1`, [a.body.id])).rejects.toThrow('bất biến')
    await expect(app.db.rawQuery(`DELETE FROM credit_assessments WHERE id = $1`, [a.body.id])).rejects.toThrow('không được xóa')
    expect((await call('GET', `/v1/credit-assessments/${a.body.id}`, undefined, S)).body.result.components.length).toBeGreaterThan(0)
  })

  it('quyền: chỉ chính doanh nghiệp/FCC chấm và xem; tổ chức tài chính cần được chia sẻ', async () => {
    const S = await session('supplier')
    const L = await session('lender')
    const B = await session('buyer')
    const sup = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    expect((await post(`/v1/organizations/${sup}/credit-assessments`, {}, B)).status).toBe(403)
    const a = (await call('GET', `/v1/organizations/${sup}/credit-assessments`, undefined, S)).body[0]
    expect((await call('GET', `/v1/credit-assessments/${a.id}`, undefined, L)).status).toBe(404) // chưa chia sẻ
    expect((await call('GET', `/v1/organizations/${sup}/credit-assessments`, undefined, L)).body).toEqual([])
    // kết quả có ghi chú tham khảo
    expect((await call('GET', `/v1/credit-assessments/${a.id}`, undefined, S)).body.disclaimer).toContain('không phải quyết định tín dụng')
  })

  it('phát hành chính thức: thiếu bao phủ bị từ chối; xem xét lại do doanh nghiệp gửi, FCC chấp nhận thì chấm lại bản mới', async () => {
    const S = await session('supplier')
    const F = await session('fcc')
    const sup = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    const a = (await call('GET', `/v1/organizations/${sup}/credit-assessments`, undefined, S)).body.find((x: Json) => x.status === 'provisional')
    expect((await post(`/v1/credit-assessments/${a.id}/issue`, {}, S)).status).toBe(403)
    const issue = await post(`/v1/credit-assessments/${a.id}/issue`, {}, F)
    expect(issue.status).toBe(422) // dữ liệu còn thiếu
    expect(issue.body.error).toContain('chưa phát hành')

    expect((await post(`/v1/credit-assessments/${a.id}/appeals`, { reason: 'ngắn' }, S)).status).toBe(422)
    const ap = await post(`/v1/credit-assessments/${a.id}/appeals`, { reason: 'Điểm chưa tính BCTC 2024 mà chúng tôi vừa bổ sung đầy đủ' }, S)
    expect(ap.status, JSON.stringify(ap.body)).toBe(200)
    expect((await call('GET', '/v1/appeals', undefined, S)).body).toHaveLength(1)
    await act(S, 'upsertFinancialYear', sup, fy(2024, 700_000_000)) // bổ sung dữ liệu
    expect((await post(`/v1/appeals/${ap.body.id}/resolve`, { outcome: 'upheld', note: '' }, F)).status).toBe(422)
    const res = await post(`/v1/appeals/${ap.body.id}/resolve`, { outcome: 'upheld', note: 'Đã đối chiếu BCTC 2024, chấm lại' }, F)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.newAssessmentId).toBeTruthy()
    expect(res.body.newAssessmentId).not.toBe(a.id)
    expect((await post(`/v1/appeals/${ap.body.id}/resolve`, { outcome: 'rejected', note: 'x' }, F)).status).toBe(409) // đã xử lý
    expect((await call('GET', '/v1/appeals', undefined, S)).body[0]).toMatchObject({ status: 'upheld', newAssessmentId: res.body.newAssessmentId })
  })

  it('phiên bản bộ chấm điểm: cần hai người khác nhau duyệt; áp dụng cho lần chấm sau, kết quả cũ giữ nguyên', async () => {
    const F = await session('fcc')
    const inviteAndJoin = async (email: string, role: string) => {
      const inv = await post('/api/org/invitations', { email, role }, F)
      expect(inv.status, JSON.stringify(inv.body)).toBe(200)
      const acc = await post(`/api/invitations/${new URL(inv.body.inviteUrl).searchParams.get('token')}/accept`, { password: 'correct-horse-battery', name: email, title: 'FCC' })
      expect(acc.status, JSON.stringify(acc.body)).toBe(201)
      return acc.body.token as string
    }
    const owner = await inviteAndJoin('owner1@fcc.test', 'fcc_model_owner')
    const second = await inviteAndJoin('owner2@fcc.test', 'fcc_model_owner')
    const S = await session('supplier')
    const sup = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    const before = (await post(`/v1/organizations/${sup}/credit-assessments`, {}, S)).body

    const prop = await post('/v1/operations/scorecard-versions', { name: 'v1.1 siết ngưỡng', params: { ratingCutoffs: [99, 98, 97, 96, 95, 94], industryMargin: { manufacturing: 0.045, trade: 0.025, agri: 0.04, tech: 0.08 }, industryRisk: {} } }, owner)
    expect(prop.status, JSON.stringify(prop.body)).toBe(200)
    expect((await post('/v1/operations/scorecard-versions', { name: 'x', params: { ratingCutoffs: [50, 60, 70, 80, 90, 95], industryMargin: {} } }, owner)).status).toBe(422)
    expect((await post(`/v1/operations/scorecard-versions/${prop.body.id}/approve`, {}, owner)).status).toBe(409) // người đề xuất không tự duyệt
    expect((await post(`/v1/operations/scorecard-versions/${prop.body.id}/approve`, {}, second)).body).toMatchObject({ active: false })
    expect((await post(`/v1/operations/scorecard-versions/${prop.body.id}/approve`, {}, second)).status).toBe(409) // một người duyệt hai lần
    expect((await call('GET', '/v1/operations/scorecard-versions', undefined, S)).status).toBe(403)
    // chưa đủ hai người: vẫn dùng phiên bản cũ
    expect((await post(`/v1/organizations/${sup}/credit-assessments`, {}, S)).body.scorecardVersionId).toBe('sc-v1.0')
    expect((await post(`/v1/operations/scorecard-versions/${prop.body.id}/approve`, {}, F)).body).toMatchObject({ active: true })

    const after = (await post(`/v1/organizations/${sup}/credit-assessments`, {}, S)).body
    expect(after.scorecardVersionId).toBe(prop.body.id)
    expect(after.id).not.toBe(before.id)
    expect(after.score).toBe(before.score) // cùng công thức, cùng dữ liệu
    expect(after.rating).toBe('CCC') // ngưỡng mới siết
    const old = (await call('GET', `/v1/credit-assessments/${before.id}`, undefined, S)).body
    expect(old).toMatchObject({ scorecardVersionId: 'sc-v1.0', rating: before.rating }) // kết quả cũ không đổi
    const versions = (await call('GET', '/v1/operations/scorecard-versions', undefined, F)).body.versions
    expect(versions.filter((v: Json) => v.status === 'active')).toHaveLength(1)
  })
})
