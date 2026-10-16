import { afterAll, describe, expect, it } from 'vitest'
import { dropSchema, newSchema, startApp } from './helpers'
import type { Mailer } from '../src/integrations/mailer'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const schema = newSchema()
let offset = 0
const now = () => new Date(Date.now() + offset)
const sent: { to: string; subject: string }[] = []
let failNext = 0
const mailer: Mailer = {
  async send(m) {
    if (failNext > 0) {
      failNext--
      throw new Error('SMTP 421 tạm thời không khả dụng')
    }
    sent.push({ to: m.to, subject: m.subject })
  },
}
const app = await startApp(schema, { devAutologin: true, now, mailer })
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
const iso = (d: Date) => d.toISOString().slice(0, 10)
const due = iso(new Date(Date.now() + 60 * 86_400_000))
const invoice = (buyerId: string, n: string) => ({ buyerId, invoiceSeries: 'E', invoiceNumber: n, issueDate: iso(new Date()), dueDate: due, amount: 100_000_000 + Number(n), description: '', fingerprint: `em-${n}`, docs: { xml: true }, source: 'xml' })

describe('email thông báo: hàng đợi, thử lại, không gửi trùng, tùy chọn', () => {
  it('thông báo nghiệp vụ → email tới thành viên; lỗi tạm thời được gửi lại sau thời gian chờ; không gửi hai lần', async () => {
    const S = await session('supplier')
    const B = await session('buyer')
    const buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
    const id = (await act(S, 'createReceivable', invoice(buyerId, '1'))).body.result.id
    await act(S, 'sendToBuyer', id)

    const queued = await app.db.emailsOf('buyer@dev.local', 'confirm')
    expect(queued).toHaveLength(1)
    expect(queued[0].subject).toContain('Yêu cầu xác nhận')

    failNext = 1
    expect(await app.deliverEmails()).toBe(1)
    expect(sent).toHaveLength(0) // lỗi tạm thời
    let row = (await app.db.emailsOf('buyer@dev.local', 'confirm'))[0]
    expect(row).toMatchObject({ attempts: 1, sentAt: null })
    expect(row.lastError).toContain('SMTP 421')
    expect(await app.deliverEmails()).toBe(0) // chưa tới hạn thử lại

    offset += 3 * 60_000 // qua thời gian chờ
    expect(await app.deliverEmails()).toBe(1)
    expect(sent).toEqual([{ to: 'buyer@dev.local', subject: expect.stringContaining('Yêu cầu xác nhận') }])
    row = (await app.db.emailsOf('buyer@dev.local', 'confirm'))[0]
    expect(row.sentAt).not.toBeNull()
    offset += 3 * 60_000
    expect(await app.deliverEmails()).toBe(0) // không gửi lại
    expect(sent).toHaveLength(1)
    void B
  })

  it('người dùng tắt một loại thông báo thì không nhận email loại đó; loại tài khoản luôn gửi', async () => {
    const S = await session('supplier')
    const B = await session('buyer')
    const buyerId = app.getState().orgs.find((o) => o.type === 'buyer')!.id
    const prefs = await call('GET', '/api/auth/email-prefs', undefined, B)
    expect(prefs.body.kinds.find((k: Json) => k.kind === 'confirm')).toMatchObject({ enabled: true })
    expect(prefs.body.kinds.find((k: Json) => k.kind === 'account')).toMatchObject({ locked: true })
    expect((await post('/api/auth/email-prefs', { prefs: { khong_co: false } }, B)).status).toBe(400)
    expect((await post('/api/auth/email-prefs', { prefs: { confirm: false, account: false } }, B)).status).toBe(200)
    expect((await call('GET', '/api/auth/email-prefs', undefined, B)).body.kinds.find((k: Json) => k.kind === 'account').enabled).toBe(true)

    const before = (await app.db.emailsOf('buyer@dev.local', 'confirm')).length
    const id = (await act(S, 'createReceivable', invoice(buyerId, '2'))).body.result.id
    await act(S, 'sendToBuyer', id)
    expect((await app.db.emailsOf('buyer@dev.local', 'confirm')).length).toBe(before) // đã tắt loại "confirm"
    // thông báo trong ứng dụng vẫn có
    expect(app.getState().notifications.some((n) => n.orgId === buyerId && n.title.includes(`${(app.getState().receivables.find((r) => r.id === id)!).code}`))).toBe(true)
  })

  it('email đặt lại mật khẩu đi qua cùng hàng đợi; quá nhiều lần thất bại thì ngừng (dead)', async () => {
    const reg = await post('/api/dev/session', { role: 'lender' })
    expect(reg.status).toBe(200)
    await app.db.queueEmail({ to: 'x@example.test', kind: 'account', subject: 'thử', body: 'b', dedupeKey: 'fail-forever' })
    failNext = 1000
    for (let i = 0; i < 10; i++) {
      offset += 3600_000
      await app.deliverEmails()
    }
    failNext = 0
    const row = (await app.db.emailsOf('x@example.test'))[0]
    expect(row.deadAt).not.toBeNull()
    expect(row.attempts).toBe(8)
    // trùng dedupe_key không tạo thêm thư
    await app.db.queueEmail({ to: 'x@example.test', kind: 'account', subject: 'thử', body: 'b', dedupeKey: 'fail-forever' })
    expect(await app.db.emailsOf('x@example.test')).toHaveLength(1)
  })
})
