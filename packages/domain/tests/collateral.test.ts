import { describe, expect, it } from 'vitest'
import { classifyFunding, preliminaryValue, totalPreliminaryValue } from '../src/collateral'

describe('định giá sơ bộ tài sản bảo đảm', () => {
  it('áp hệ số theo loại tài sản và cộng dồn', () => {
    const cs = [{ id: 'a', kind: 'realestate' as const, description: 'Nhà xưởng', declaredValue: 3_000_000_000 }, { id: 'b', kind: 'machinery' as const, description: 'Máy', declaredValue: 520_000_000 }, { id: 'c', kind: 'inventory' as const, description: 'Thép', declaredValue: 1_000_000_000 }]
    expect(cs.map(preliminaryValue)).toEqual([2_100_000_000, 260_000_000, 400_000_000])
    expect(totalPreliminaryValue(cs)).toBe(2_760_000_000)
  })
})

describe('phân loại hồ sơ (i)/(ii)/(iii)', () => {
  const base = { applicationRating: 'A' as const, buyerRating: 'A' as const, amount: 2_000_000_000 }
  it('(i) có tài sản bảo đảm và khoản phải thu tốt', () => expect(classifyFunding({ ...base, collateralValue: 1e9 })).toMatchObject({ case: 1, suggestProducts: true }))
  it('(ii) không tài sản bảo đảm nhưng khoản phải thu tốt vẫn được tài trợ', () => expect(classifyFunding({ ...base, collateralValue: 0 })).toMatchObject({ case: 2, suggestProducts: true }))
  it('(iii) hồ sơ yếu: không gợi ý sản phẩm dù có tài sản bảo đảm, kèm lý do', () => {
    const c = classifyFunding({ applicationRating: 'BB', buyerRating: 'B', collateralValue: 5e9, amount: 1e9 })
    expect(c).toMatchObject({ case: 3, suggestProducts: false })
    expect(c.reasons).toHaveLength(2)
  })
})
