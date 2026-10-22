import { describe, expect, it } from 'vitest'
import { invoiceFlags } from '../src/fraud'
import type { Receivable } from '../src/types'

const NOW = new Date('2026-10-16T08:00:00Z')
const base = { sellerId: 's', buyerId: 'b', docs: { xml: true, contract: false, delivery: false }, source: 'xml' as const, files: [{ key: 'k', name: 'a.xml', kind: 'invoice' as const }] }
const past = (amount: number, i: number, extra: Partial<Receivable> = {}): Receivable => ({ ...base, id: `r${i}`, code: `INV-${i}`, amount, issueDate: '2026-08-01', dueDate: '2026-12-01', state: 'SETTLED', version: 1, invoiceSeries: 'A', invoiceNumber: String(i), fingerprint: `f${i}`, description: '', createdAt: '2026-08-02T00:00:00Z', ...extra }) as Receivable
const codes = (xs: { code: string }[]) => xs.map((x) => x.code)

describe('phát hiện bất thường hóa đơn', () => {
  it('giá trị gấp > 3 lần trung vị lịch sử cùng bên nhập khẩu', () => {
    const hist = [100, 120, 110].map((m, i) => past(m * 1_000_000, i))
    expect(codes(invoiceFlags({ ...base, amount: 600_000_000, issueDate: '2026-10-15' }, hist, NOW))).toContain('AMOUNT_ANOMALY')
    expect(codes(invoiceFlags({ ...base, amount: 300_000_000, issueDate: '2026-10-15' }, hist, NOW))).not.toContain('AMOUNT_ANOMALY')
  })

  it('không cờ giá trị khi lịch sử dưới 3 hóa đơn', () => {
    expect(codes(invoiceFlags({ ...base, amount: 900_000_000, issueDate: '2026-10-15' }, [past(100_000_000, 1)], NOW))).not.toContain('AMOUNT_ANOMALY')
  })

  it('bên nhập khẩu mới + giá trị lớn; ngày lập tương lai', () => {
    expect(codes(invoiceFlags({ ...base, amount: 2_500_000_000, issueDate: '2026-10-15' }, [], NOW))).toContain('NEW_BUYER_LARGE')
    const f = invoiceFlags({ ...base, amount: 100_000_000, issueDate: '2026-11-30' }, [], NOW)
    expect(f.find((x) => x.code === 'FUTURE_ISSUE_DATE')).toMatchObject({ severity: 'high' })
  })

  it('nhiều hóa đơn cùng bên nhập khẩu trong ngày; nhập tay tròn triệu giá trị lớn; thiếu tệp gốc', () => {
    const today = Array.from({ length: 4 }, (_, i) => past(10_000_000, i, { createdAt: '2026-10-16T01:00:00Z', state: 'DRAFT' }))
    expect(codes(invoiceFlags({ ...base, amount: 10_000_000, issueDate: '2026-10-16' }, today, NOW))).toContain('BURST_SAME_BUYER')
    expect(codes(invoiceFlags({ ...base, source: 'manual', amount: 1_500_000_000, issueDate: '2026-10-15' }, [], NOW))).toContain('ROUND_LARGE_MANUAL')
    expect(codes(invoiceFlags({ ...base, files: [], docs: { xml: false, contract: false, delivery: false }, amount: 5_000_000, issueDate: '2026-10-15' }, [], NOW))).toContain('NO_SOURCE_DOCUMENT')
  })

  it('hóa đơn bình thường không có cờ', () => {
    const hist = [100, 120, 110].map((m, i) => past(m * 1_000_000, i))
    expect(invoiceFlags({ ...base, amount: 115_000_000, issueDate: '2026-10-15' }, hist, NOW)).toEqual([])
  })
})
