import { afterAll, describe, expect, it } from 'vitest'
import { copyFileSync, mkdtempSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scoreBuyer } from '@fcc/domain/credit'
import { dropSchema, LISTED_DIR, newSchema, startApp } from './helpers'
import { marketOpen, syncListed, type ListedFetcher } from '../src/listed-sync'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any

// Thay việc chạy scripts/fetch_listed.py bằng bản giả: chép file mẫu (hoặc báo lỗi như vnstock hết hạn mức)
const dir = mkdtempSync(join(tmpdir(), 'fcc-listed-'))
const calls: string[] = []
let failWith = ''
const fetcher: ListedFetcher = {
  python: 'python', script: 'x',
  run: async (symbol, _org, outDir) => {
    calls.push(symbol)
    if (failWith) throw new Error(failWith)
    copyFileSync(join(LISTED_DIR, `${symbol}.json`), join(outDir, `${symbol}.json`))
  },
  sleep: async () => undefined,
}

const schema = newSchema()
const app = await startApp(schema, { devAutologin: true, listedDir: dir, listedFetch: fetcher })
afterAll(async () => {
  await app.close()
  await dropSchema(schema)
})
async function call(method: 'GET' | 'POST', url: string, body?: unknown, token?: string) {
  const r = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(body !== undefined ? { payload: body as never } : {}) })
  let json: Json = null
  try { json = JSON.parse(r.body) } catch { /* không phải JSON */ }
  return { status: r.statusCode, body: json }
}
const post = (u: string, b: unknown, t?: string) => call('POST', u, b, t)
const act = (t: string, n: string, ...args: unknown[]) => post(`/api/actions/${n}`, { args }, t)
const session = async (role: string) => (await post('/api/dev/session', { role })).body.token as string

describe('tự động lấy dữ liệu niêm yết (vnstock)', () => {
  it('giờ giao dịch theo giờ Việt Nam', () => {
    expect(marketOpen(new Date('2026-10-19T03:00:00Z'))).toBe(true) // thứ Hai 10:00
    expect(marketOpen(new Date('2026-10-19T09:00:00Z'))).toBe(false) // thứ Hai 16:00
    expect(marketOpen(new Date('2026-10-18T03:00:00Z'))).toBe(false) // Chủ nhật
  })

  it('chỉ chạy cho mã đã xác minh; giữ đối chiếu của FCC khi nạp lại; lỗi thì giữ dữ liệu cũ', async () => {
    const F = await session('fcc')
    const B = await session('buyer')
    const buyer = app.getState().orgs.find((o) => o.type === 'buyer')!
    await act(B, 'updateOrg', { listedSymbol: 'HPG', exchange: 'HOSE' })

    // chưa xác minh: không chạy script
    expect(await syncListed(app.core, fetcher)).toEqual([])
    expect(calls).toEqual([])

    await post(`/v1/organizations/${buyer.id}/listed-verification`, { note: 'Đối chiếu MST với công bố thông tin trên HOSE' }, F)
    expect((await syncListed(app.core, fetcher)).map((r) => r.status)).toEqual(['updated'])
    const l = app.getState().listed.find((x) => x.orgId === buyer.id)!
    expect(l.symbol).toBe('HPG')
    expect(l.flagsReviewed).toBeUndefined()

    // chưa đối chiếu: M1, M2 không được điểm tối đa mặc định mà để trống
    const before = scoreBuyer({ org: buyer, profile: app.getState().profiles.find((p) => p.orgId === buyer.id), listed: l })
    expect(before.factors.filter((f) => f.code === 'M1' || f.code === 'M2').map((f) => f.points)).toEqual([null, null])

    // FCC đối chiếu (giữ nguyên giá trị vẫn được ghi nhận) rồi nạp lại: không bị ghi đè về mặc định
    expect((await post(`/v1/organizations/${buyer.id}/listed-flags`, { auditOpinion: 'qualified', note: 'BCTC kiểm toán 2025 công bố trên HOSE' }, F)).status).toBe(200)
    expect((await syncListed(app.core, fetcher, { force: true }))[0].status).toBe('updated')
    const after = app.getState().listed.find((x) => x.orgId === buyer.id)!
    expect(after).toMatchObject({ auditOpinion: 'qualified', tradingStatus: 'normal' })
    expect(after.flagsReviewed?.note).toContain('HOSE')
    const scored = scoreBuyer({ org: buyer, profile: app.getState().profiles.find((p) => p.orgId === buyer.id), listed: after })
    expect(scored.factors.find((f) => f.code === 'M1')?.points).toBe(30)

    // file còn mới: bỏ qua, không gọi vnstock
    calls.length = 0
    expect((await syncListed(app.core, fetcher))[0].status).toBe('fresh')
    expect(calls).toEqual([])

    // file cũ + vnstock lỗi: báo lỗi, dữ liệu đã nạp vẫn còn, FCC thấy lỗi
    utimesSync(join(dir, 'HPG.json'), new Date(0), new Date(0))
    failWith = 'Rate limit exceeded'
    expect((await syncListed(app.core, fetcher))[0]).toMatchObject({ status: 'failed', error: 'Rate limit exceeded' })
    expect(app.getState().listed.find((x) => x.orgId === buyer.id)?.auditOpinion).toBe('qualified')
    const st = await call('GET', '/v1/operations/listed-sync', undefined, F)
    expect(st.body).toMatchObject({ enabled: true, symbols: { HPG: { ok: false, error: 'Rate limit exceeded' } } })

    // bên nhập khẩu bấm làm mới khi vnstock lỗi: báo lỗi rõ ràng
    const r = await post('/v1/listed/HPG/refresh', {}, B)
    expect(r.status).toBe(422)
    expect(r.body.error ?? r.body.message).toContain('vnstock')
    failWith = ''
    expect((await post('/v1/listed/HPG/refresh', {}, B)).status).toBe(200)

    // chạy ngay: chỉ vận hành FCC
    expect((await post('/v1/operations/listed-sync', {}, B)).status).toBe(403)
    const run = await post('/v1/operations/listed-sync', {}, F)
    expect(run.status).toBe(200)
    expect(run.body[0]).toMatchObject({ symbol: 'HPG', status: 'updated' })
  })
})
