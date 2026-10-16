import { describe, expect, it } from 'vitest'
import { balanced, feeEntry, suggestEntries, toCsv } from '../src/journal'
import { statementFor } from '../src/statement'
import type { FundingApplication, Org, Receivable } from '../src/types'

const org = (id: string, type: Org['type']): Org => ({ id, name: id, shortName: id, taxCode: id, type, vsic: '1', industryLabel: 'x', industryGroup: 'manufacturing', foundedYear: 2015, employees: 10, province: 'HN', createdAt: '2026-01-01' })
const r: Receivable = { id: 'r1', code: 'INV-001', sellerId: 's', buyerId: 'b', amount: 2_000_000_000, issueDate: '2026-10-01', dueDate: '2027-01-14', state: 'SETTLED', version: 1, invoiceSeries: 'A', invoiceNumber: '1', fingerprint: 'f', docs: { xml: true, contract: false, delivery: false }, source: 'xml', description: '', createdAt: '2026-10-01', paidAt: '2027-01-14', paidAmount: 2_000_000_000 } as Receivable
const ap = {
  id: 'a1', receivableId: 'r1', lenderId: 'l', productId: 'p', state: 'SETTLED', submittedAt: '2026-10-02', fundedAt: '2026-10-16T00:00:00Z', fundedAmount: 1_600_000_000, settledAt: '2027-01-14T00:00:00Z',
  offer: { advanceVnd: 1_600_000_000, ratePct: 6, feesVnd: 3_200_000, tenorDays: 90, conditions: '', expiresAt: '2026-10-20' },
  settlements: [
    { id: 'e1', type: 'buyer_reported', amount: 2_000_000_000, at: '2027-01-14T00:00:00Z', source: 'buyer' },
    { id: 'e2', type: 'payment_received', amount: 2_000_000_000, at: '2027-01-14T00:00:00Z', source: 'lender', allocation: { fees: 3_200_000, interest: 23_671_233, principal: 1_600_000_000, surplus: 373_128_767 } },
    { id: 'e3', type: 'refund_paid', amount: 373_128_767, at: '2027-01-15T00:00:00Z', source: 'lender' },
  ],
  refundDue: 373_128_767, refundPaid: 373_128_767,
} as FundingApplication
const state = { orgs: [org('s', 'supplier'), org('b', 'buyer'), org('l', 'lender')], receivables: [r], applications: [ap], products: [{ id: 'p', type: 'factoring_recourse' }] as never, earlyOffers: [] }

describe('bút toán đề xuất', () => {
  it('nhà cung cấp: nhận tiền ứng và tất toán — mọi bút toán cân Nợ/Có, có độ tin cậy', () => {
    const es = suggestEntries(state, state.orgs[0])
    expect(es.map((e) => e.ref).sort()).toEqual(['funded:a1', 'settled:a1'])
    expect(es.every(balanced)).toBe(true)
    const funded = es.find((e) => e.ref === 'funded:a1')!
    expect(funded.lines).toEqual([
      { account: '112', accountName: 'Tiền gửi ngân hàng', debit: 1_596_800_000, credit: 0 },
      { account: '635', accountName: 'Chi phí tài chính', debit: 3_200_000, credit: 0 },
      { account: '341', accountName: 'Vay và nợ thuê tài chính', debit: 0, credit: 1_600_000_000 },
    ])
    expect(funded.confidence).toBeGreaterThan(0)
  })

  it('TT200 dùng tài khoản chi tiết khác TT133', () => {
    expect(suggestEntries(state, state.orgs[0], 'TT200').find((e) => e.ref === 'funded:a1')!.lines.map((l) => l.account)).toContain('3411')
  })

  it('bên mua: thanh toán hóa đơn trực tiếp và trả sớm có chiết khấu ghi doanh thu tài chính', () => {
    const direct = suggestEntries({ ...state, applications: [] }, state.orgs[1])
    expect(direct).toHaveLength(1)
    expect(direct[0].lines.map((l) => [l.account, l.debit, l.credit])).toEqual([['331', 2_000_000_000, 0], ['112', 0, 2_000_000_000]])
    const early = suggestEntries({ ...state, applications: [], receivables: [{ ...r, state: 'EARLY_PAID', paidAmount: 1_980_000_000 }], earlyOffers: [{ id: 'eo', receivableId: 'r1', buyerId: 'b', discountPct: 1, payBy: '2026-11-01', state: 'PAID', createdAt: '2026-10-20' }] }, state.orgs[1])
    expect(early[0].lines.find((l) => l.account === '515')).toMatchObject({ credit: 20_000_000 })
    expect(balanced(early[0])).toBe(true)
  })

  it('phí dịch vụ FCC và file xuất CSV ghép Nợ–Có', () => {
    const fee = feeEntry('TT133', { id: 'F1', amount: 4_800_000, description: 'Phí giao dịch', period: '2026-10', createdAt: '2026-10-16T00:00:00Z' })
    expect(balanced(fee)).toBe(true)
    const csv = toCsv([fee, ...suggestEntries(state, state.orgs[0]).filter((e) => e.ref === 'funded:a1')]).split('\n')
    expect(csv[0]).toBe('ngay,so_chung_tu,dien_giai,tk_no,tk_co,so_tien')
    expect(csv).toContain('2026-10-16,fee:F1,"Phí giao dịch",642,331,4800000')
    expect(csv.filter((l) => l.includes('funded:a1')).map((l) => l.split(',').slice(-3).join(','))).toEqual(['112,341,1596800000', '635,341,3200000'])
  })
})

describe('sao kê ngân hàng giả lập', () => {
  const conn = { openingCash: 500_000_000, recurringMonthlyOut: [{ name: 'Lương', amount: 100_000_000, day: 5 }], lastSyncedAt: '2026-10-01T00:00:00Z', bankLinkedAt: '2026-10-01T00:00:00Z' }
  it('nhà cung cấp: số dư chạy từ số dư khai báo + giải ngân + hoàn dư − chi định kỳ, có nguồn', () => {
    const st = statementFor(state, state.orgs[0], conn, '2026-10-01', '2027-01-31')
    expect(st.source).toContain('giả lập')
    expect(st.opening).toBe(500_000_000)
    const adv = st.lines.find((l) => l.kind === 'advance')!
    expect(adv.amount).toBe(1_596_800_000)
    expect(st.lines.find((l) => l.kind === 'refund')!.amount).toBe(373_128_767)
    const recurring = st.lines.filter((l) => l.kind === 'recurring')
    expect(recurring.length).toBe(4) // 5/11, 5/12, 5/1 và 5/10 không có (đã qua trước ngày liên kết là 1/10 → có 5/10)
    expect(st.closing).toBe(500_000_000 + 1_596_800_000 + 373_128_767 - recurring.length * 100_000_000)
    expect(st.lines.at(-1)!.balance).toBe(st.closing)
  })
  it('tổ chức tài chính: giải ngân ra, tiền về vào, hoàn dư ra; bên mua: thanh toán ra', () => {
    const l = statementFor(state, state.orgs[2], { ...conn, openingCash: 0, recurringMonthlyOut: [] }, '2026-10-01', '2027-02-01')
    expect(l.lines.map((x) => [x.kind, x.amount])).toEqual([['payout', -1_600_000_000], ['collection', 2_000_000_000], ['refund', -373_128_767]])
    const b = statementFor(state, state.orgs[1], { ...conn, openingCash: 0, recurringMonthlyOut: [] }, '2026-10-01', '2027-02-01')
    expect(b.lines.map((x) => [x.kind, x.amount])).toEqual([['buyer_payment', -2_000_000_000]])
  })
  it('lọc theo khoảng ngày: số dư đầu kỳ gồm các giao dịch trước ngày bắt đầu', () => {
    const st = statementFor(state, state.orgs[0], conn, '2026-12-01', '2027-01-31')
    expect(st.opening).toBe(500_000_000 + 1_596_800_000 - 100_000_000 * 2) // trừ lương 5/10 và 5/11
  })
})
