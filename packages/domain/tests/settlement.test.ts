import { describe, expect, it } from 'vitest'
import { allocationOf, balanceAt, reconcile, type SettlementEvent } from '../src/settlement'

// Ví dụ báo cáo: hóa đơn 2 tỷ, 90 ngày, ứng 80% = 1,6 tỷ. Lãi 6%/năm, phí 3.200.000.
const offer = { advanceVnd: 1_600_000_000, ratePct: 6, feesVnd: 3_200_000, tenorDays: 90, conditions: '', expiresAt: '2026-11-01' }
const FUNDED = '2026-10-16T00:00:00Z'
const DUE = '2027-01-14' // 90 ngày sau
const ev = (id: string, type: SettlementEvent['type'], amount: number, at: string): SettlementEvent => ({ id, type, amount, at, source: 'lender' })

describe('thu hồi và tất toán', () => {
  it('trả đủ đúng hạn: phí → lãi → gốc, phần còn lại hoàn cho nhà cung cấp', () => {
    const interest = Math.round((1_600_000_000 * 6 * 90) / 36500) // 23.671.233
    const b = balanceAt(offer, FUNDED, DUE, [ev('p1', 'payment_received', 2_000_000_000, '2027-01-14T00:00:00Z')], '2027-01-14T00:00:00Z')
    expect(b.settled).toBe(true)
    expect(b.surplus).toBe(2_000_000_000 - 1_600_000_000 - interest - 3_200_000)
    expect(allocationOf(offer, FUNDED, DUE, [], ev('p1', 'payment_received', 2_000_000_000, '2027-01-14T00:00:00Z'))).toEqual({ fees: 3_200_000, interest, principal: 1_600_000_000, surplus: b.surplus })
  })

  it('thanh toán một phần: dư nợ giảm theo thứ tự phí → lãi → gốc, chưa tất toán', () => {
    const b = balanceAt(offer, FUNDED, DUE, [ev('p1', 'payment_received', 600_000_000, '2027-01-14T00:00:00Z')], '2027-01-14T00:00:00Z')
    expect(b.settled).toBe(false)
    expect(b.fees).toBe(0)
    expect(b.interest).toBe(0)
    expect(b.principal).toBe(1_600_000_000 - (600_000_000 - 3_200_000 - 23_671_233)) // thu 600 tr: trả phí và lãi trước, phần còn lại giảm gốc
    expect(b.outstanding).toBe(b.principal)
    expect(b.surplus).toBe(0)
  })

  it('hai lần thanh toán: lần hai tất toán và có phần thừa; lãi tính trên gốc còn lại', () => {
    const e1 = ev('p1', 'payment_received', 1_000_000_000, '2027-01-14T00:00:00Z')
    const e2 = ev('p2', 'payment_received', 1_000_000_000, '2027-01-14T00:00:00Z')
    const b = balanceAt(offer, FUNDED, DUE, [e1, e2], '2027-01-14T00:00:00Z')
    expect(b.settled).toBe(true)
    expect(b.received).toBe(2_000_000_000)
    expect(b.surplus).toBe(2_000_000_000 - 1_600_000_000 - 23_671_233 - 3_200_000)
  })

  it('trả chậm: lãi quá hạn = 150% lãi suất cho số ngày trễ', () => {
    const onTime = balanceAt(offer, FUNDED, DUE, [], DUE + 'T00:00:00Z')
    const late = balanceAt(offer, FUNDED, DUE, [], '2027-02-13T00:00:00Z') // trễ 30 ngày
    const extra = Math.round((1_600_000_000 * 6 * 1.5 * 30) / 36500)
    expect(late.interest - onTime.interest).toBe(extra)
  })

  it('thanh lý tài sản bảo đảm được tính như khoản thu và bù thiếu hụt', () => {
    const paid = ev('p1', 'payment_received', 1_200_000_000, '2027-01-14T00:00:00Z')
    const liquidation = ev('c1', 'collateral_liquidated', 500_000_000, '2027-03-01T00:00:00Z')
    const short = balanceAt(offer, FUNDED, DUE, [paid], '2027-03-01T00:00:00Z')
    expect(short.settled).toBe(false)
    const after = balanceAt(offer, FUNDED, DUE, [paid, liquidation], '2027-03-01T00:00:00Z')
    expect(after.received).toBe(1_700_000_000)
    expect(after.outstanding).toBeLessThan(short.outstanding)
  })

  it('đối soát: bên mua báo ↔ tổ chức tài chính xác nhận', () => {
    const rep = (a: number): SettlementEvent => ({ id: 'r', type: 'buyer_reported', amount: a, at: '2027-01-14T00:00:00Z', source: 'buyer' })
    expect(reconcile([])).toBe('none')
    expect(reconcile([rep(100)])).toBe('pending')
    expect(reconcile([rep(100), ev('p', 'payment_received', 100, '2027-01-14T00:00:00Z')])).toBe('matched')
    expect(reconcile([rep(100), ev('p', 'payment_received', 90, '2027-01-14T00:00:00Z')])).toBe('mismatch')
  })
})
