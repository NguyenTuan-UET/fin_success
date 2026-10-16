// Bút toán đề xuất, sao kê, dự báo dòng tiền đã lưu (WP9). Tính từ trạng thái đã lọc theo quyền của tổ chức.
import { createHash } from 'node:crypto'
import { orgForecast } from '@fcc/domain/cashflow'
import { feeEntry, suggestEntries, type JournalEntry, type Regime } from '@fcc/domain/journal'
import { statementFor } from '@fcc/domain/statement'
import type { Core } from './core'
import { uid } from './core'
import { canonical } from './state'
import { viewFor } from './views'
import { bad, conflict, notFound } from './errors'

export const FORECAST_MODEL = 'cashflow-v1 (lịch phải thu/phải trả + độ trễ lịch sử)'
export const parseRegime = (v?: string): Regime => (v === 'TT200' ? 'TT200' : 'TT133')

export async function journalFor(core: Core, orgId: string, regime: Regime) {
  const st = viewFor(core.getState(), orgId, core.clock())
  const org = st.orgs.find((o) => o.id === orgId)!
  if (!['supplier', 'buyer'].includes(org.type)) throw bad('Bút toán dành cho doanh nghiệp bán/mua')
  const fees = (await core.db.chargesOf(orgId)).map((c) => feeEntry(regime, { id: c.id, amount: Number(c.amount), description: c.description, period: c.period, createdAt: new Date(c.createdAt as unknown as string).toISOString() }))
  const decisions = new Map((await core.db.journalDecisions(orgId)).map((d) => [d.ref, d]))
  const entries = [...suggestEntries(st, org, regime), ...fees].sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => {
    const d = decisions.get(e.ref)
    return { ...e, status: d?.status ?? 'suggested', lines: (d?.lines as JournalEntry['lines'] | null) ?? e.lines, decidedNote: d?.note ?? undefined }
  })
  return { regime, entries }
}

export function bankStatement(core: Core, orgId: string, from: string, to: string) {
  const st = viewFor(core.getState(), orgId, core.clock())
  const org = st.orgs.find((o) => o.id === orgId)!
  const conn = st.connections.find((c) => c.orgId === orgId)
  if (!conn?.bankLinkedAt) throw conflict('Chưa liên kết tài khoản ngân hàng (giả lập)')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw bad('Khoảng ngày không hợp lệ (YYYY-MM-DD)')
  return statementFor(st, org, conn, from, to)
}

/** Số dư hôm nay: nếu đã liên kết ngân hàng thì dựng từ sao kê, ngược lại là số dư doanh nghiệp khai. */
export function currentBalance(core: Core, orgId: string) {
  const st = viewFor(core.getState(), orgId, core.clock())
  const org = st.orgs.find((o) => o.id === orgId)!
  const conn = st.connections.find((c) => c.orgId === orgId)
  if (!conn) return undefined
  if (!conn.bankLinkedAt) return conn.openingCash
  return statementFor(st, org, conn, conn.bankLinkedAt.slice(0, 10), core.clock().toISOString().slice(0, 10)).closing
}

/** Dự báo 90 ngày ba kịch bản, lưu lại; cùng đầu vào cùng ngày thì không lưu trùng. Kèm danh sách phải thu FCC dự kiến để đo sai số về sau. */
export async function computeAndStoreForecast(core: Core, orgId: string) {
  const full = core.getState()
  const st = viewFor(full, orgId, core.clock())
  const org = st.orgs.find((o) => o.id === orgId)!
  const conn = st.connections.find((c) => c.orgId === orgId)
  if (!conn) throw conflict('Khai số dư tiền mặt trước khi dự báo')
  const now = core.clock()
  const opening = currentBalance(core, orgId)!
  const f = orgForecast(st, org, now, 90, opening)!
  const inputsHash = createHash('sha256').update(canonical({ opening, conn, ledger: st.ledger.filter((l) => l.orgId === orgId), recv: st.receivables.filter((r) => r.sellerId === orgId || r.buyerId === orgId).map((r) => [r.id, r.amount, r.dueDate, r.state]), apps: st.applications.map((a) => [a.id, a.state]), asOf: now.toISOString().slice(0, 10) })).digest('hex')
  const delays = f ? ((await import('@fcc/domain/cashflow')).paymentDelays(st.receivables, st.orgs, orgId)) : {}
  const expectedAr = st.receivables
    .filter((r) => r.sellerId === orgId && ['BUYER_CONFIRMED', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'FUNDED', 'OVERDUE'].includes(r.state))
    .map((r) => {
      const tax = st.orgs.find((o) => o.id === r.buyerId)?.taxCode ?? ''
      const delay = (delays[tax] ?? delays['*'] ?? { median: 0 }).median
      return { receivableId: r.id, code: r.code, amount: r.amount, expectedDate: new Date(new Date(r.dueDate).getTime() + delay * 86_400_000).toISOString().slice(0, 10) }
    })
  const summary = { minBase: f.minBase, shortfall: f.shortfall ?? null, inflow: f.inflow, outflow: f.outflow, minConservative: Math.min(...f.points.map((p) => p.conservative)), minOptimistic: Math.min(...f.points.map((p) => p.optimistic)) }
  const id = uid('CF')
  const created = await core.db.saveForecast({ id, orgId, asOf: now.toISOString().slice(0, 10), horizon: 90, inputsHash, modelVersion: FORECAST_MODEL, opening, series: f.points, summary, expectedAr })
  return { stored: created, forecast: { ...f, asOf: f.asOf }, opening, modelVersion: FORECAST_MODEL, inputsHash, expectedAr }
}

/** Sai số dự báo thu: so ngày thu dự kiến của mỗi khoản phải thu (lúc dự báo, đã qua ≥ 7 ngày) với ngày thực tế thanh toán. */
export async function forecastAccuracy(core: Core, orgId: string) {
  const st = viewFor(core.getState(), orgId, core.clock())
  const today = core.clock().toISOString().slice(0, 10)
  const rows = await core.db.forecastsOf(orgId)
  const seen = new Set<string>()
  const errs: { code: string; expected: string; actual: string; errorDays: number; asOf: string }[] = []
  for (const f of [...rows].reverse()) {
    for (const e of f.expectedAr as { receivableId: string; code: string; expectedDate: string }[]) {
      if (seen.has(e.receivableId)) continue // dùng dự báo sớm nhất của mỗi khoản để đo
      const r = st.receivables.find((x) => x.id === e.receivableId)
      if (!r?.paidAt) continue
      seen.add(e.receivableId)
      const actual = r.paidAt.slice(0, 10)
      if (actual > today) continue
      errs.push({ code: e.code, expected: e.expectedDate, actual, errorDays: Math.round((new Date(actual).getTime() - new Date(e.expectedDate).getTime()) / 86_400_000), asOf: String(f.asOf) })
    }
  }
  const abs = errs.map((e) => Math.abs(e.errorDays))
  return {
    evaluated: errs.length,
    meanAbsErrorDays: abs.length ? +(abs.reduce((a, b) => a + b, 0) / abs.length).toFixed(1) : null,
    within5DaysPct: abs.length ? Math.round((abs.filter((d) => d <= 5).length / abs.length) * 100) : null,
    details: errs.slice(0, 50),
    note: 'Sai số đo trên các khoản phải thu trên FCC đã thanh toán; dự báo không phải cam kết',
  }
}

export const requireOrgType = (core: Core, orgId: string, types: string[]) => {
  const o = core.getState().orgs.find((x) => x.id === orgId)
  if (!o || !types.includes(o.type)) throw notFound('Không áp dụng cho loại tổ chức này')
}
