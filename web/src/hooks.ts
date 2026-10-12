import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from './store'
import { applicationScoreOf, buyerScoreOf, esgOf, supplierScoreOf } from './domain/engine'
import { matchProduct, rankMatches, type MatchResult } from './domain/marketplace'
import { forecastCash } from './domain/cashflow'
import type { Consent } from './domain/types'

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

export function useForecast(orgId: string, threshold = 0) {
  const conn = useStore((s) => s.connections.find((c) => c.orgId === orgId))
  const ledger = useStore((s) => s.ledger)
  const apps = useStore((s) => s.applications)
  const receivables = useStore((s) => s.receivables)
  return useMemo(() => {
    if (!conn || conn.status !== 'connected') return null
    const myApps = apps.filter((a) => receivables.find((r) => r.id === a.receivableId)?.sellerId === orgId)
    return forecastCash(conn, ledger.filter((l) => l.orgId === orgId), myApps, 90, new Date(), threshold)
  }, [conn, ledger, apps, receivables, orgId, threshold])
}

export const ACTIVE_APP_STATES = ['SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'FUNDED'] as const
