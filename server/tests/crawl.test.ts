import { afterAll, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dropSchema, newSchema, startApp } from './helpers'
import { assertPublicUrl, detectBlock, isPrivateIp, robotsAllows } from '../src/crawl/guard'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any

// Máy chủ giả đóng vai các website: /ok có chứng nhận, /captcha yêu cầu mã xác thực, /robots chặn, /broken không phải HTML
const hits: string[] = []
let robotsTxt = ''
const site = createServer((req, res) => {
  const host = String(req.headers.host)
  hits.push(`${req.url}`)
  const [, area] = /^\/(\w+)/.exec(req.url ?? '/') ?? []
  if (req.url === '/robots.txt') return void (robotsTxt ? res.writeHead(200).end(robotsTxt) : res.writeHead(404).end())
  if (area === 'ok') return void res.writeHead(200, { 'content-type': 'text/html' }).end(`<html><head><title>Công ty Sao Mai</title></head><body>Chúng tôi đạt chứng nhận ISO 9001 và ISO 14001. Liên hệ ${host}</body></html>`)
  if (area === 'captcha') return void res.writeHead(200, { 'content-type': 'text/html' }).end('<html><body><div class="g-recaptcha"></div>Nhập mã xác thực</body></html>')
  if (area === 'robots') return void res.writeHead(200, { 'content-type': 'text/html' }).end('<html><body>x</body></html>')
  if (area === 'broken') return void res.writeHead(200, { 'content-type': 'application/json' }).end('{"khong":"phai html"}')
  res.writeHead(404).end('khong co')
})
await new Promise<void>((r) => site.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${(site.address() as AddressInfo).port}`

const schema = newSchema()
const app = await startApp(schema, { devAutologin: true, crawl: { allowPrivate: true, minIntervalMs: 0 } })
afterAll(async () => {
  site.close()
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

describe('khung crawl: quy tắc an toàn', () => {
  it('chặn địa chỉ nội bộ (SSRF); nhận diện CAPTCHA/đăng nhập/chặn; đọc robots.txt', async () => {
    expect(isPrivateIp('10.1.2.3')).toBe(true)
    expect(isPrivateIp('169.254.169.254')).toBe(true)
    expect(isPrivateIp('8.8.8.8')).toBe(false)
    await expect(assertPublicUrl('http://localhost:8787/x')).rejects.toThrow('nội bộ')
    await expect(assertPublicUrl('http://127.0.0.1/x')).rejects.toThrow('nội bộ')
    await expect(assertPublicUrl('ftp://example.com')).rejects.toThrow('http')
    await expect(assertPublicUrl('https://user:pw@example.com')).rejects.toThrow('thông tin đăng nhập')
    expect(detectBlock(200, '<div class="g-recaptcha"></div>')).toContain('CAPTCHA')
    expect(detectBlock(200, '<input type="password">')).toContain('đăng nhập')
    expect(detectBlock(403, '')).toContain('403')
    expect(detectBlock(200, '<html>bình thường</html>')).toBeNull()
    const robots = 'User-agent: *\nDisallow: /private\nAllow: /private/public\nUser-agent: FCC-Bot\nDisallow: /admin'
    expect(robotsAllows(robots, '/admin/x')).toBe(false) // nhóm FCC-Bot
    expect(robotsAllows(robots, '/private')).toBe(true) // nhóm riêng của FCC-Bot không chặn /private
    expect(robotsAllows('User-agent: *\nDisallow: /private\nAllow: /private/public', '/private/public/a')).toBe(true)
    expect(robotsAllows('User-agent: *\nDisallow: /private', '/private/a')).toBe(false)
    expect(robotsAllows('', '/bat-ky')).toBe(true)
  })
})

describe('crawl website do doanh nghiệp khai', () => {
  it('nguồn chưa phê duyệt thì không xếp việc; nguồn không cho tự động (loại B/C) không thể phê duyệt thành loại A', async () => {
    const F = await session('fcc')
    const S = await session('supplier')
    expect((await post('/v1/operations/data-sources/src-company-website/review', { status: 'pending' }, F)).status).toBe(200)
    await act(S, 'updateOrg', { website: `${base}/ok` })
    expect((await call('GET', '/v1/operations/crawl-jobs', undefined, F)).body).toHaveLength(0)
    expect((await post('/v1/operations/data-sources/src-company-website/review', { status: 'approved', sourceClass: 'A' }, F)).status).toBe(422) // cần ghi chú căn cứ
    expect((await post('/v1/operations/data-sources/src-news/review', { status: 'approved', sourceClass: 'C', note: 'x' }, F)).status).toBe(422)
    expect((await post('/v1/operations/data-sources/src-gdt-mst/review', { status: 'approved', sourceClass: 'A', note: 'x' }, F)).status).toBe(422) // loại A cần adapter
    expect((await post('/v1/operations/data-sources/src-company-website/review', { status: 'approved', note: 'Doanh nghiệp đồng ý; điều khoản: tự khai website; pháp chế duyệt 16/10' }, S)).status).toBe(403)
    expect((await post('/v1/operations/data-sources/src-company-website/review', { status: 'approved', note: 'Doanh nghiệp đồng ý; điều khoản: tự khai website; pháp chế duyệt 16/10' }, F)).status).toBe(200)
    expect(app.getState().sources.find((x) => x.id === 'src-company-website')).toMatchObject({ status: 'approved' })
  })

  it('đọc được: lưu bản chụp có băm và phiên bản parser, ghi bản ghi có provenance; doanh nghiệp xem được', async () => {
    const S = await session('supplier')
    const F = await session('fcc')
    const orgId = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    await act(S, 'updateOrg', { website: `${base}/ok/` }) // đổi website → xếp việc
    const q = (await call('GET', '/v1/operations/crawl-jobs?status=queued', undefined, F)).body
    expect(q).toHaveLength(1)
    expect(await app.processCrawl()).toBe(1)
    const job = (await call('GET', '/v1/operations/crawl-jobs', undefined, F)).body[0]
    expect(job).toMatchObject({ status: 'done', orgId })
    const recs = (await call('GET', `/v1/organizations/${orgId}/external-profile`, undefined, S)).body
    const cert = recs.find((r: Json) => r.field === 'Chứng nhận công bố trên website')
    expect(cert.value).toContain('ISO 9001')
    expect(cert.value).toContain('ISO 14001')
    expect(cert).toMatchObject({ label: 'Nguồn công khai – tham khảo', parserVersion: 'company-website@1.0' })
    expect(cert.snapshotId).toBeTruthy()
    expect(cert.url).toContain(base)
    const snap = await app.db.snapshot(cert.snapshotId)
    expect(snap.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(app.core.files.get(snap.objectKey).toString('utf8')).toContain('ISO 9001') // bản chụp thô lưu bất biến
    // không dùng dữ liệu crawl để tính điểm
    const sc = (await post(`/v1/organizations/${orgId}/credit-assessments`, {}, S)).body
    expect(JSON.stringify(sc.result.factors)).not.toContain('website')
  })

  it('robots.txt cấm → không đọc; CAPTCHA → dừng, chuyển tra cứu thủ công, máy chủ bị tạm dừng 24 giờ (không thử lại)', async () => {
    const S = await session('supplier')
    const F = await session('fcc')
    hits.length = 0
    await app.db.rawQuery('DELETE FROM source_hosts') // bỏ bộ nhớ đệm robots.txt
    robotsTxt = 'User-agent: *\nDisallow: /robots'
    await act(S, 'updateOrg', { website: `${base}/robots/page` })
    await app.processCrawl()
    robotsTxt = ''
    expect(hits).toEqual(['/robots.txt']) // chỉ đọc robots.txt rồi dừng, không tải trang
    expect((await call('GET', '/v1/operations/crawl-jobs', undefined, F)).body[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('robots.txt') })

    // đổi sang trang CAPTCHA (cùng máy chủ giả; xóa trạng thái robots để đọc lại)
    await app.db.rawQuery('DELETE FROM source_hosts')
    await act(S, 'updateOrg', { website: `${base}/captcha` })
    await app.processCrawl()
    const j = (await call('GET', '/v1/operations/crawl-jobs', undefined, F)).body[0]
    expect(j).toMatchObject({ status: 'manual_needed' })
    expect(j.reason).toContain('CAPTCHA')
    hits.length = 0
    await act(S, 'updateOrg', { website: `${base}/ok/lai` })
    await app.processCrawl()
    expect(hits).toEqual([]) // máy chủ đang bị tạm dừng: không gửi yêu cầu nào
    expect((await call('GET', '/v1/operations/crawl-jobs', undefined, F)).body[0].status).toBe('manual_needed')
  })

  it('parser lỗi (nguồn đổi định dạng): không ghi dữ liệu sai, vào hàng đợi ngoại lệ', async () => {
    const S = await session('supplier')
    const F = await session('fcc')
    const orgId = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    await app.db.rawQuery('DELETE FROM source_hosts')
    const before = app.getState().external.filter((e) => e.orgId === orgId).length
    await act(S, 'updateOrg', { website: `${base}/broken` })
    await app.processCrawl()
    const j = (await call('GET', '/v1/operations/crawl-jobs', undefined, F)).body[0]
    expect(j).toMatchObject({ status: 'failed', error: expect.stringContaining('Parser company-website@1.0 lỗi') })
    expect(app.getState().external.filter((e) => e.orgId === orgId).length).toBe(before)
  })
})

describe('tra cứu thủ công và khiếu nại', () => {
  it('FCC ghi kết quả từ nguồn loại B kèm đường dẫn; doanh nghiệp khiếu nại; FCC chấp nhận (gỡ) hoặc giữ nguyên có lý do', async () => {
    const S = await session('supplier')
    const F = await session('fcc')
    const orgId = app.getState().orgs.find((o) => o.type === 'supplier')!.id
    expect((await act(S, 'addExternalRecord', orgId, { sourceId: 'src-gdt-mst', field: 'Trạng thái MST', value: 'Đang hoạt động', url: 'https://x' })).status).toBe(403)
    expect((await act(F, 'addExternalRecord', orgId, { sourceId: 'src-gdt-mst', field: 'Trạng thái MST', value: 'Đang hoạt động', url: 'khong-phai-url' })).status).toBe(400)
    expect((await act(F, 'addExternalRecord', orgId, { sourceId: 'src-news', field: 'Tin', value: 'x', url: 'https://x' })).status).toBe(403) // nguồn loại C
    const r1 = await post(`/v1/organizations/${orgId}/external-records`, { sourceId: 'src-gdt-mst', field: 'Trạng thái MST', value: 'Ngừng hoạt động', url: 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp', note: 'Tra cứu 16/10/2026' }, F)
    expect(r1.status, JSON.stringify(r1.body)).toBe(200)
    const r2 = (await act(F, 'addExternalRecord', orgId, { sourceId: 'src-dkkd', field: 'Ngày thành lập', value: '01/01/2015', url: 'https://dangkykinhdoanh.gov.vn' })).body.result
    expect(r1.body.result.manual).toBe(true)

    const mine = (await call('GET', `/v1/organizations/${orgId}/external-profile`, undefined, S)).body
    expect(mine.find((x: Json) => x.id === r1.body.result.id)).toMatchObject({ manual: true, label: 'Nguồn công khai – tham khảo' })

    expect((await post(`/v1/external-records/${r1.body.result.id}/disputes`, { reason: 'ngắn' }, S)).status).toBe(422)
    expect((await post(`/v1/external-records/${r1.body.result.id}/disputes`, { reason: 'Công ty vẫn đang hoạt động, có thông báo thuế tháng 10' }, S)).status).toBe(200)
    expect((await call('GET', `/v1/organizations/${orgId}/external-profile`, undefined, S)).body.find((x: Json) => x.id === r1.body.result.id).status).toBe('Đang được xem xét')
    expect((await post(`/v1/external-records/${r1.body.result.id}/resolution`, { outcome: 'upheld', note: '' }, F)).status).toBe(422)
    expect((await post(`/v1/external-records/${r1.body.result.id}/resolution`, { outcome: 'upheld', note: 'Đối chiếu lại: sai khác trạng thái, gỡ bản ghi' }, F)).status).toBe(200)
    expect(app.getState().external.some((x) => x.id === r1.body.result.id)).toBe(false)

    await post(`/v1/external-records/${r2.id}/disputes`, { reason: 'Ngày thành lập thực tế khác, có giấy phép đính kèm' }, S)
    await post(`/v1/external-records/${r2.id}/resolution`, { outcome: 'rejected', note: 'Giấy phép trùng khớp với nguồn, giữ nguyên' }, F)
    expect(app.getState().external.find((x) => x.id === r2.id)).toMatchObject({ disputed: false, resolution: { outcome: 'rejected' } })
  })
})
