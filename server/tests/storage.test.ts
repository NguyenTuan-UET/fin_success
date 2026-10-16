import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConstraintError, Database, type State } from '../src/state'
import { TEST_DB_URL, dropSchema, newSchema } from './helpers'

const schema = newSchema()
let db: Database

const empty = (): State =>
  ({
    orgs: [], profiles: [], listed: [], receivables: [], products: [], rfqs: [], applications: [], earlyOffers: [], limits: [],
    esg: [], connections: [], ledger: [], sources: [], external: [], consents: [], notifications: [], audit: [],
  }) as unknown as State

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app = (id: string, receivableId: string, state: string) => ({ id, receivableId, state }) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ev = (id: string, action: string) => ({ id, at: new Date().toISOString(), actorOrgId: 'o1', action, entity: 'x', detail: '' }) as any

beforeAll(async () => {
  db = await Database.open(TEST_DB_URL, schema)
})
afterAll(async () => {
  await db.close()
  await dropSchema(schema)
})

describe('ràng buộc nghiệp vụ ở mức CSDL (kể cả khi bỏ qua lớp nghiệp vụ)', () => {
  it('không cho hai hồ sơ tài trợ đang hoạt động trên cùng một khoản phải thu', async () => {
    const s = empty()
    s.applications = [app('A1', 'R1', 'SUBMITTED')]
    await db.save(s)
    const bad = { ...s, applications: [app('A2', 'R1', 'UNDER_REVIEW'), ...s.applications] }
    await expect(db.save(bad)).rejects.toBeInstanceOf(ConstraintError)
    await expect(db.save(bad)).rejects.toThrow('hồ sơ tài trợ đang hoạt động')
    // trạng thái đã ghi không đổi: nạp lại chỉ có A1
    const fresh = await Database.open(TEST_DB_URL, schema)
    expect((await fresh.load()).applications.map((a) => a.id)).toEqual(['A1'])
    await fresh.close()
  })

  it('đóng hồ sơ cũ và mở hồ sơ mới trong cùng giao dịch thì hợp lệ (kiểm tra lúc COMMIT)', async () => {
    const s = empty()
    s.applications = [app('A2', 'R1', 'SUBMITTED'), app('A1', 'R1', 'WITHDRAWN')]
    await db.save(s)
    const loaded = await (await Database.open(TEST_DB_URL, schema)).load()
    expect(loaded.applications.map((a) => `${a.id}:${a.state}`)).toEqual(['A2:SUBMITTED', 'A1:WITHDRAWN'])
  })

  it('một RFQ mở mỗi khoản phải thu; MST không trùng', async () => {
    const s = empty()
    s.applications = [app('A2', 'R1', 'SUBMITTED'), app('A1', 'R1', 'WITHDRAWN')]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s.rfqs = [{ id: 'Q1', receivableId: 'R9', state: 'OPEN' }, { id: 'Q2', receivableId: 'R9', state: 'RESPONDED' }] as any
    await expect(db.save(s)).rejects.toThrow('RFQ đang mở')
    s.rfqs = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s.orgs = [{ id: 'o1', taxCode: '0100000001' }, { id: 'o2', taxCode: '0100000001' }] as any
    await expect(db.save(s)).rejects.toThrow('Mã số thuế')
  })
})

describe('nhật ký chỉ thêm, nối chuỗi băm', () => {
  it('ghi theo thứ tự thời gian, nạp lại mới nhất trước, chuỗi băm hợp lệ', async () => {
    const s = empty()
    s.applications = [app('A2', 'R1', 'SUBMITTED'), app('A1', 'R1', 'WITHDRAWN')]
    s.audit = [ev('E2', 'hai'), ev('E1', 'một')]
    await db.save(s)
    s.audit = [ev('E3', 'ba'), ...s.audit]
    await db.save(s)
    const fresh = await Database.open(TEST_DB_URL, schema)
    expect((await fresh.load()).audit.map((e) => e.id)).toEqual(['E3', 'E2', 'E1'])
    await fresh.close()
    expect(await db.verifyAudit()).toMatchObject({ ok: true, count: 3 })
  })

  it('không sửa, không xóa được qua SQL', async () => {
    await expect(db.rawQuery(`UPDATE audit_events SET doc = '{}'::jsonb WHERE id = 'E1'`)).rejects.toThrow('chỉ cho phép thêm')
    await expect(db.rawQuery(`DELETE FROM audit_events WHERE id = 'E1'`)).rejects.toThrow('chỉ cho phép thêm')
    await expect(db.rawQuery(`TRUNCATE audit_events`)).rejects.toThrow('chỉ cho phép thêm')
  })

  it('sửa lén (tắt trigger) thì công cụ kiểm tra chỉ ra đúng dòng', async () => {
    await db.rawQuery('ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_change')
    await db.rawQuery(`UPDATE audit_events SET doc = jsonb_set(doc, '{detail}', '"đã sửa"') WHERE id = 'E2'`)
    await db.rawQuery('ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_change')
    const seq = Number((await db.rawQuery(`SELECT seq FROM audit_events WHERE id = 'E2'`)).rows[0].seq)
    expect(await db.verifyAudit()).toMatchObject({ ok: false, badSeq: seq })
  })
})
