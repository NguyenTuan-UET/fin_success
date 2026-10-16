import { describe, expect, it } from 'vitest'
import { referralFee, saasFee, transactionFee, validateSchedule, ZERO_SCHEDULE, type FeeSchedule } from '../src/fees'

const S: FeeSchedule = { id: 'fee-v1', name: 'Pilot', transactionPct: 0.3, saasMonthly: { supplier: 500_000, buyer: 1_000_000, lender: 5_000_000 }, scoringFee: 200_000, apiMonthlyPerKey: 2_000_000, reportFee: 100_000, referralPctOfFees: 20 }

describe('biểu phí', () => {
  it('phí giao dịch theo % số tiền ứng; hoa hồng theo % phí xử lý của đề nghị', () => {
    expect(transactionFee(S, 1_600_000_000)).toBe(4_800_000)
    expect(referralFee(S, 3_200_000)).toBe(640_000)
    expect(saasFee(S, 'lender')).toBe(5_000_000)
  })
  it('biểu phí 0 đồng không phát sinh phí', () => {
    expect(transactionFee(ZERO_SCHEDULE, 1e9)).toBe(0)
    expect(referralFee(ZERO_SCHEDULE, 1e7)).toBe(0)
  })
  it('kiểm tra hợp lệ: số âm, % quá lớn, thiếu trường', () => {
    expect(validateSchedule(S)).toEqual([])
    expect(validateSchedule({ ...S, transactionPct: -1, referralPctOfFees: 150 })).toHaveLength(2)
    expect(validateSchedule({ transactionPct: 1 }).length).toBeGreaterThan(3)
  })
})
