// Ghép dữ liệu trong store thành đầu vào cho các bộ chấm điểm.
import { computeEsg, esgOfficialScore } from './esg'
import { scoreApplication, scoreBuyer, scoreSupplier, type ScoreResult } from './credit'
import type { SeedData } from '../data/seed'
import type { Receivable } from './types'

type S = Pick<SeedData, 'orgs' | 'profiles' | 'listed' | 'receivables' | 'esg' | 'external' | 'applications'>

const PAID: Receivable['state'][] = ['SETTLED', 'EARLY_PAID']

export function paymentHistory(s: S, buyerId: string, sellerId?: string) {
  const rs = s.receivables.filter((r) => r.buyerId === buyerId && (!sellerId || r.sellerId === sellerId) && (PAID.includes(r.state) || r.state === 'OVERDUE' || r.state === 'BUYER_DISPUTED'))
  let onTime = 0
  let late = 0
  let disputes = 0
  for (const r of rs) {
    if (r.state === 'BUYER_DISPUTED') {
      disputes++
      continue
    }
    if (r.state === 'OVERDUE') {
      late += Math.max(0, (Date.now() - new Date(r.dueDate).getTime()) / 86_400_000)
      continue
    }
    const d = (new Date(r.paidAt!).getTime() - new Date(r.dueDate).getTime()) / 86_400_000
    if (d <= 5) onTime++
    late += Math.max(0, d)
  }
  return { total: rs.length, onTime, avgLateDays: rs.length ? late / rs.length : 0, disputes }
}

export function esgOf(s: S, orgId: string) {
  const a = s.esg.find((e) => e.orgId === orgId && e.source === 'assessed') ?? s.esg.find((e) => e.orgId === orgId)
  if (!a) return undefined
  return { assessment: a, result: computeEsg(a.indicators, a.industryGroup), official: esgOfficialScore(a) }
}

// Bộ chấm điểm rẻ (vài chục doanh nghiệp) nên tính lại mỗi lần render thay vì cache — tránh kết quả cũ.
export function buyerScoreOf(s: S, buyerId: string): ScoreResult {
  return (() => {
    const org = s.orgs.find((o) => o.id === buyerId)!
    const profile = s.profiles.find((p) => p.orgId === buyerId)
    const listed = s.listed.find((l) => l.orgId === buyerId)
    if (listed || org.type === 'buyer') return scoreBuyer({ org, profile, listed, payment: paymentHistory(s, buyerId) })
    return scoreSupplier({ org, profile: profile ?? { orgId: buyerId, financials: [], collateral: [] } })
  })()
}

export function supplierScoreOf(s: S, sellerId: string): ScoreResult {
  return (() => {
    const org = s.orgs.find((o) => o.id === sellerId)!
    const profile = s.profiles.find((p) => p.orgId === sellerId) ?? { orgId: sellerId, financials: [], collateral: [] }
    const open = s.receivables.filter((r) => r.sellerId === sellerId && !['SETTLED', 'EARLY_PAID', 'CANCELLED', 'DRAFT'].includes(r.state))
    const total = open.reduce((a, r) => a + r.amount, 0)
    const confirmed = open.filter((r) => !['BUYER_PENDING', 'BUYER_DISPUTED'].includes(r.state)).reduce((a, r) => a + r.amount, 0)
    const buyers = [...new Set(open.map((r) => r.buyerId))]
    const avgBuyer = buyers.length ? buyers.reduce((a, b) => a + buyerScoreOf(s, b).score, 0) / buyers.length : undefined
    const mine = s.receivables.filter((r) => r.sellerId === sellerId)
    const apps = s.applications.filter((a) => mine.some((r) => r.id === a.receivableId))
    const esg = esgOf(s, sellerId)
    const e6 = esg?.assessment.indicators.find((i) => i.code === 'E6')?.finalLevel
    const ext = s.external.filter((e) => e.orgId === sellerId && !e.disputed)
    const legal = ext.find((e) => e.field === 'Sự kiện pháp lý')
    return scoreSupplier({
      org,
      profile,
      confirmedArShare: total ? confirmed / total : undefined,
      avgBuyerScore: avgBuyer,
      topCustomerRating: profile.topCustomerId ? buyerScoreOf(s, profile.topCustomerId).rating : undefined,
      fccBehavior: { disputes: mine.filter((r) => r.state === 'BUYER_DISPUTED').length, returned: apps.filter((a) => a.state === 'REJECTED').length, total: mine.length },
      esgE6Level: e6,
      legalEventsFromCrawl: legal ? (/khắc phục/.test(legal.value) ? 'minor_resolved' : 'major') : profile.legalEvents,
    })
  })()
}

export function applicationScoreOf(s: S, receivableId: string) {
  const r = s.receivables.find((x) => x.id === receivableId)!
  const sellerOpen = s.receivables.filter((x) => x.sellerId === r.sellerId && !['SETTLED', 'EARLY_PAID', 'CANCELLED', 'DRAFT'].includes(x.state))
  const total = sellerOpen.reduce((a, x) => a + x.amount, 0)
  const toBuyer = sellerOpen.filter((x) => x.buyerId === r.buyerId).reduce((a, x) => a + x.amount, 0)
  const pair = paymentHistory(s, r.buyerId, r.sellerId)
  return scoreApplication({
    receivable: r,
    buyerScore: buyerScoreOf(s, r.buyerId),
    supplierScore: supplierScoreOf(s, r.sellerId),
    pairHistory: { total: pair.total - pair.disputes, onTime: pair.onTime },
    concentration: total ? toBuyer / total : undefined,
  })
}
