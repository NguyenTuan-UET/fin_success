import { describe, expect, it } from 'vitest'
import { computeEsg } from '../src/esg'
import { estimateCost } from '../src/marketplace'
import { toRating } from '../src/credit'
import type { EsgIndicatorResult, FinancingProduct, IndicatorLevel } from '../src/types'

const lv = (m: Record<string, number>): EsgIndicatorResult[] => Object.entries(m).map(([code, l]) => ({ code, finalLevel: l as IndicatorLevel }))

describe('ESG — ví dụ mục 7 của khung', () => {
  const example = lv({ E1: 3, E2: 2, E3: 2, E4: 3, E5: 3, E6: 2, S1: 3, S2: 3, S3: 2, S4: 3, S5: 2, S6: 3, G1: 3, G2: 4, G3: 2, G4: 3, G5: 3, G6: 2 })

  it('tái lập 66,67/100, coverage 100%', () => {
    const r = computeEsg(example, 'manufacturing')
    expect(r.score).toBeCloseTo(66.67, 2)
    expect(r.coverage).toBe(1)
    expect(r.official).toBe(true)
    expect(r.level).toBe('Khá')
    const k = Object.fromEntries(r.issues.map((i) => [i.issue, i.score]))
    expect(k.E_RES).toBeCloseTo(58.33, 2)
    expect(k.G_TRA).toBeCloseTo(75, 2)
  })

  it('thiếu dữ liệu không thành 0 và không phát hành chính thức', () => {
    const partial = example.filter((r) => !['E1', 'E2', 'S5', 'G3'].includes(r.code))
    const r = computeEsg(partial, 'manufacturing')
    expect(r.coverage).toBeCloseTo(14 / 18, 5)
    expect(r.official).toBe(false)
    expect(r.min).toBeLessThan(r.score)
    expect(r.max).toBeGreaterThan(r.score)
  })

  it('N/A chuẩn hóa trong nhóm và cờ trọng yếu', () => {
    const withNa = example.map((r) => (r.code === 'E2' ? { ...r, finalLevel: undefined, na: true } : r.code === 'S1' ? { ...r, finalLevel: 0 as IndicatorLevel } : r))
    const r = computeEsg(withNa, 'manufacturing')
    expect(r.issues.find((i) => i.issue === 'E_RES')?.score).toBeCloseTo(62.5, 2)
    expect(r.coverage).toBe(1)
    expect(r.flags.map((f) => f.code)).toContain('S1')
  })
})

describe('Marketplace — chi phí ước tính', () => {
  const p: FinancingProduct = {
    id: 'p', lenderId: 'l', name: 'x', type: 'factoring_recourse', description: '',
    eligibility: { minAmount: 0, maxAmount: 1e13, maxTenorDays: 180, requireBuyerConfirmation: true },
    pricing: { advancePct: 80, rateMin: 8, rateMax: 10, fees: [{ name: 'Phí xử lý', kind: 'pct', value: 0.5, upfront: true }], latePenaltyPct: 150 },
    greenRule: { minEsg: 65, minCoverage: 0.8, discountPct: 0.7 },
    sla: {}, status: 'published', version: 1, effectiveFrom: '2026-01-01', effectiveTo: '2027-12-31',
  }
  it('ví dụ báo cáo: hóa đơn 2 tỷ, 90 ngày, ứng 80% = 1,6 tỷ', () => {
    const c = estimateCost(p, 2_000_000_000, 90)
    expect(c.advance).toBe(1_600_000_000)
    expect(c.interestMin).toBe(Math.round((1.6e9 * 0.08 * 90) / 365))
    expect(c.fees).toBe(8_000_000)
    expect(c.netReceived).toBe(1_592_000_000)
    expect(c.greenApplied).toBe(false)
  })
  it('ưu đãi xanh chỉ áp khi ESG chính thức đủ ngưỡng, không cờ', () => {
    expect(estimateCost(p, 2e9, 90, { score: 70, coverage: 0.9, official: true, flags: 0 }).rateMin).toBeCloseTo(7.3)
    expect(estimateCost(p, 2e9, 90, { score: 70, coverage: 0.9, official: false, flags: 0 }).greenApplied).toBe(false)
    expect(estimateCost(p, 2e9, 90, { score: 70, coverage: 0.9, official: true, flags: 1 }).greenApplied).toBe(false)
  })
})

describe('Xếp hạng', () => {
  it('ngưỡng AAA..CCC', () => {
    expect(toRating(90)).toBe('AAA')
    expect(toRating(79.9)).toBe('A')
    expect(toRating(39)).toBe('CCC')
  })
})

import { DEFAULT_SCORECARD, scoreSupplier, withScorecard } from '../src/credit'
import type { CreditProfile, Org } from '../src/types'

describe('tham số bộ chấm điểm (scorecard_versions)', () => {
  const org: Org = { id: 's', name: 's', shortName: 's', taxCode: '1', type: 'supplier', vsic: '2592', industryLabel: 'x', industryGroup: 'manufacturing', foundedYear: 2012, employees: 50, province: 'HN', createdAt: '2026-01-01' }
  const fy = (year: number, netProfit: number) => ({ year, revenue: 10_000_000_000, netProfit, ebit: 900_000_000, interestExpense: 100_000_000, depreciation: 200_000_000, totalAssets: 8e9, currentAssets: 5e9, currentLiabilities: 3e9, totalLiabilities: 4e9, equity: 4e9, operatingCashFlow: 600_000_000, debtService: 500_000_000, cash: 1e9, inventory: 1e9, receivables: 2e9, source: 'x', status: 'self_declared' as const })
  const profile: CreditProfile = { orgId: 's', financials: [fy(2025, 450_000_000), fy(2024, 400_000_000)], collateral: [] }
  const run = () => scoreSupplier({ org, profile, now: new Date('2026-10-16') } as never)

  it('mặc định không đổi kết quả; đổi trung vị biên lợi nhuận hoặc ngưỡng hạng thì kết quả đổi, và khôi phục sau khi chạy', () => {
    const base = run()
    expect(withScorecard(DEFAULT_SCORECARD, run).score).toBe(base.score)
    const strict = withScorecard({ ...DEFAULT_SCORECARD, industryMargin: { ...DEFAULT_SCORECARD.industryMargin, manufacturing: 0.2 } }, run)
    expect(strict.score).toBeLessThan(base.score) // biên 4,5% thấp hơn nhiều so với trung vị 20%
    const cut = withScorecard({ ...DEFAULT_SCORECARD, ratingCutoffs: [99, 98, 97, 96, 95, 94] }, run)
    expect(cut.score).toBe(base.score)
    expect(cut.rating).toBe('CCC')
    expect(run().rating).toBe(base.rating) // tham số cũ được khôi phục
  })
})
