import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from './store'
import { applicationScoreOf, buyerScoreOf, esgOf, supplierScoreOf } from './domain/engine'
import { matchProduct, rankMatches, type MatchResult } from './domain/marketplace'
import { forecastCash } from './domain/cashflow'
import type { Consent, LedgerItem, Receivable } from './domain/types'

export function useData() {
  return useStore(useShallow((s) => ({ orgs: s.orgs, profiles: s.profiles, listed: s.listed, receivables: s.receivables, esg: s.esg, external: s.external, applications: s.applications })))
}

export function useOrgMap() {
  const orgs = useStore((s) => s.orgs)
  return useMemo(() => Object.fromEntries(orgs.map((o) => [o.id, o])), [orgs])
}

/** Kiểm tra consent hiện hành — mọi màn hình xem dữ liệu của tổ chức khác phải đi qua đây. */
export function hasConsent(consents: Consent[], ownerId: string, recipientId: string, scope: Consent['scopes'][number]) {
  if (ownerId === recipientId) return true
  const today = new Date().toISOString().slice(0, 10)
  return consents.some((c) => c.ownerId === ownerId && c.recipientId === recipientId && !c.revokedAt && c.expiresAt >= today && c.scopes.includes(scope))
}

export function useScores() {
  const d = useData()
  return useMemo(
    () => ({
      supplier: (id: string) => supplierScoreOf(d, id),
      buyer: (id: string) => buyerScoreOf(d, id),
      application: (rid: string) => applicationScoreOf(d, rid),
      esg: (id: string) => esgOf(d, id),
    }),
    [d],
  )
}

export function useMatches(receivableId: string | undefined): { eligible: MatchResult[]; ineligible: MatchResult[] } {
  const d = useData()
  const products = useStore((s) => s.products)
  return useMemo(() => {
    if (!receivableId) return { eligible: [], ineligible: [] }
    const r = d.receivables.find((x) => x.id === receivableId)
    if (!r) return { eligible: [], ineligible: [] }
    const seller = d.orgs.find((o) => o.id === r.sellerId)!
    const app = applicationScoreOf(d, r.id)
    const e = esgOf(d, r.sellerId)
    const esg = e ? { score: e.result.score, coverage: e.result.coverage, official: e.assessment.status === 'official', flags: e.result.flags.length } : undefined
    const ms = products
      .filter((p) => p.status === 'published')
      .map((p) => matchProduct(p, { receivable: r, industryGroup: seller.industryGroup, supplierRating: supplierScoreOf(d, r.sellerId).rating, buyerRating: buyerScoreOf(d, r.buyerId).rating, applicationRating: app.rating, esg }))
    return rankMatches(ms, 'cost')
  }, [d, products, receivableId])
}

const OPEN_AR: Receivable['state'][] = ['BUYER_PENDING', 'BUYER_CONFIRMED', 'OVERDUE', 'BUYER_DISPUTED']

/** Độ trễ thanh toán (ngày) của từng bên mua, tính từ các khoản đã thanh toán thật trên FCC; chưa có lịch sử thì coi như đúng hạn. */
export function buyerDelays(receivables: Receivable[], sellerId: string) {
  const byBuyer = new Map<string, number[]>()
  for (const r of receivables) {
    if (r.sellerId !== sellerId || !r.paidAt || !['SETTLED', 'EARLY_PAID'].includes(r.state)) continue
    const d = Math.max(0, Math.round((new Date(r.paidAt).getTime() - new Date(r.dueDate).getTime()) / 86_400_000))
    byBuyer.set(r.buyerId, [...(byBuyer.get(r.buyerId) ?? []), d])
  }
  const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]
  return Object.fromEntries([...byBuyer].map(([id, xs]) => [id, { median: pct(xs, 0.5), p80: pct(xs, 0.8) }]))
}

export function useForecast(orgId: string, threshold = 0) {
  const conn = useStore((s) => s.connections.find((c) => c.orgId === orgId))
  const ledger = useStore((s) => s.ledger)
  const apps = useStore((s) => s.applications)
  const receivables = useStore((s) => s.receivables)
  const orgs = useStore((s) => s.orgs)
  return useMemo(() => {
    if (!conn || conn.status !== 'connected') return null
    const mine = ledger.filter((l) => l.orgId === orgId)
    const have = new Set(mine.map((l) => l.docNo))
    // khoản phải thu trên FCC tự vào dự báo (trừ khi file nhập đã có cùng số chứng từ)
    const fromFcc: LedgerItem[] = receivables
      .filter((r) => r.sellerId === orgId && OPEN_AR.includes(r.state) && !have.has(r.code))
      .map((r) => {
        const b = orgs.find((o) => o.id === r.buyerId)
        return { id: `fcc-${r.id}`, orgId, kind: 'AR' as const, counterpartyName: b?.shortName ?? r.buyerId, counterpartyTaxCode: b?.taxCode, docNo: r.code, amount: r.amount, paid: 0, dueDate: r.dueDate }
      })
    const delays = buyerDelays(receivables, orgId)
    const byTax = Object.fromEntries(orgs.filter((o) => delays[o.id]).map((o) => [o.taxCode, delays[o.id]]))
    const myApps = apps.filter((a) => receivables.find((r) => r.id === a.receivableId)?.sellerId === orgId)
    return forecastCash({ ...conn, buyerDelayDays: { '*': { median: 0, p80: 0 }, ...byTax } }, [...mine, ...fromFcc], myApps, 90, new Date(), threshold)
  }, [conn, ledger, apps, receivables, orgs, orgId, threshold])
}

export const ACTIVE_APP_STATES = ['SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'FUNDED'] as const
