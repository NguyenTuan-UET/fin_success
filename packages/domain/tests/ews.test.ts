import { describe, expect, it } from 'vitest'
import { ewsAlerts } from '../src/ews'
import type { FundingApplication, Org, Receivable } from '../src/types'

const org = (id: string, type: Org['type']): Org => ({ id, name: id, shortName: id, taxCode: id, type, vsic: '1', industryLabel: 'x', industryGroup: 'manufacturing', foundedYear: 2015, employees: 10, province: 'HN', createdAt: '2026-01-01' })
const NOW = new Date('2026-10-16T00:00:00Z')
const rec = (id: string, buyer: string, dueDate: string, state: Receivable['state'] = 'FUNDED', extra: Partial<Receivable> = {}): Receivable =>
  ({ id, code: id.toUpperCase(), sellerId: 's', buyerId: buyer, amount: 1_000_000_000, issueDate: '2026-08-01', dueDate, state, version: 1, invoiceSeries: 'A', invoiceNumber: id, fingerprint: id, docs: { xml: true, contract: true, delivery: true }, source: 'xml', description: '', createdAt: '2026-08-01', ...extra }) as Receivable
const app = (id: string, receivableId: string, state: FundingApplication['state'] = 'FUNDED', adv = 800_000_000): FundingApplication =>
  ({ id, receivableId, lenderId: 'l', productId: 'p', state, submittedAt: '2026-08-02', fundedAmount: adv, offer: { advanceVnd: adv, ratePct: 9, feesVnd: 0, tenorDays: 60, conditions: '', expiresAt: '2026-10-17' } }) as FundingApplication
const S = (receivables: Receivable[], applications: FundingApplication[]) => ({ orgs: [org('s', 'supplier'), org('b1', 'buyer'), org('b2', 'buyer'), org('l', 'lender')], profiles: [], listed: [], receivables, esg: [], external: [], applications })

describe('EWS — cảnh báo sớm theo luật', () => {
  it('khoản quá hạn: mức theo số ngày, kèm số tiền và đề xuất', () => {
    const s = S([rec('r1', 'b1', '2026-10-01', 'OVERDUE'), rec('r2', 'b2', '2026-08-30', 'OVERDUE')], [app('a1', 'r1'), app('a2', 'r2')])
    const a = ewsAlerts(s, s.applications, NOW).filter((x) => x.code === 'OVERDUE')
    expect(a.map((x) => [x.applicationId, x.severity])).toEqual([['a2', 'high'], ['a1', 'medium']]) // 47 ngày > 30 → high
    expect(a[0].amount).toBe(800_000_000)
    expect(a[0].suggestion).toContain('Đôn đốc')
  })

  it('sắp đến hạn trong 7 ngày; khoản còn xa thì không cảnh báo', () => {
    const s = S([rec('r1', 'b1', '2026-10-20'), rec('r2', 'b2', '2026-12-01')], [app('a1', 'r1'), app('a2', 'r2')])
    const a = ewsAlerts(s, s.applications, NOW)
    expect(a.filter((x) => x.code === 'DUE_SOON').map((x) => x.applicationId)).toEqual(['a1'])
    expect(a.some((x) => x.applicationId === 'a2' && x.code === 'DUE_SOON')).toBe(false)
  })

  it('tập trung rủi ro: một bên mua quá 40% dư nợ (chỉ khi có từ hai bên mua)', () => {
    const big = S([rec('r1', 'b1', '2026-12-01'), rec('r2', 'b2', '2026-12-01')], [app('a1', 'r1', 'FUNDED', 900_000_000), app('a2', 'r2', 'FUNDED', 100_000_000)])
    expect(ewsAlerts(big, big.applications, NOW).filter((x) => x.code === 'CONCENTRATION').map((x) => x.buyerId)).toEqual(['b1'])
    const one = S([rec('r1', 'b1', '2026-12-01')], [app('a1', 'r1')])
    expect(ewsAlerts(one, one.applications, NOW).some((x) => x.code === 'CONCENTRATION')).toBe(false)
  })

  it('bên mua tranh chấp sau giải ngân là mức cao; đề nghị sắp hết hạn là mức thấp', () => {
    const s = S([rec('r1', 'b1', '2026-12-01', 'BUYER_DISPUTED', { disputeReason: 'Giao thiếu' }), rec('r2', 'b2', '2026-12-01', 'OFFERED')], [app('a1', 'r1'), app('a2', 'r2', 'OFFERED')])
    const a = ewsAlerts(s, s.applications, NOW)
    expect(a.find((x) => x.code === 'DISPUTE_ON_FUNDED')).toMatchObject({ severity: 'high', applicationId: 'a1' })
    expect(a.find((x) => x.code === 'OFFER_EXPIRING')).toMatchObject({ severity: 'low', applicationId: 'a2' })
  })

  it('không có khoản đang tài trợ thì không có cảnh báo', () => {
    const s = S([rec('r1', 'b1', '2026-12-01', 'BUYER_CONFIRMED')], [])
    expect(ewsAlerts(s, [], NOW)).toEqual([])
  })
})
