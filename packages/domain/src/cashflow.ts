// Dự báo dòng tiền v1 theo lịch, giải thích được — SPEC mục 7.3.
import type { AccountingConnection, AppData, FundingApplication, LedgerItem, Org } from './types'

export interface ForecastPoint {
  day: number
  date: string
  base: number
  conservative: number
  optimistic: number
}

export interface ForecastDriver {
  date: string
  label: string
  amount: number
}

export interface Forecast {
  asOf: string
  points: ForecastPoint[]
  drivers: ForecastDriver[]
  inflow: { d7: number; d30: number; d90: number }
  outflow: { d7: number; d30: number; d90: number }
  minBase: { value: number; date: string }
  shortfall?: { date: string; value: number; scenario: 'base' | 'conservative' }
}

const DAY = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)

export function forecastCash(conn: AccountingConnection, items: LedgerItem[], apps: FundingApplication[], horizon = 90, now = new Date(), threshold = 0): Forecast {
  const start = new Date(iso(now))
  const flows = { base: new Array(horizon + 1).fill(0), conservative: new Array(horizon + 1).fill(0), optimistic: new Array(horizon + 1).fill(0) }
  const drivers: ForecastDriver[] = []
  const put = (scn: keyof typeof flows, d: number, v: number) => {
    const i = Math.min(horizon, Math.max(0, d))
    if (d <= horizon) flows[scn][i] += v
  }
  const dayIdx = (s: string, add = 0) => Math.round((new Date(s).getTime() - start.getTime()) / DAY) + add

  for (const it of items) {
    const open = it.amount - it.paid
    if (open <= 0) continue
    if (it.kind === 'AR') {
      const delay = conn.buyerDelayDays[it.counterpartyTaxCode ?? ''] ?? conn.buyerDelayDays['*'] ?? { median: 0, p80: 0 }
      const optimistic = Math.max(0, delay.median - 5)
      put('base', Math.max(0, dayIdx(it.dueDate, delay.median)), open)
      put('conservative', Math.max(0, dayIdx(it.dueDate, delay.p80)), open)
      put('optimistic', Math.max(0, dayIdx(it.dueDate, optimistic)), open)
      const d = dayIdx(it.dueDate, delay.median)
      if (d <= horizon) drivers.push({ date: iso(new Date(start.getTime() + Math.max(0, d) * DAY)), label: `Thu ${it.docNo} — ${it.counterpartyName} (trễ TB ${delay.median} ngày)`, amount: open })
    } else {
      for (const scn of ['base', 'conservative', 'optimistic'] as const) put(scn, Math.max(0, dayIdx(it.dueDate)), -open)
      const d = dayIdx(it.dueDate)
      if (d <= horizon) drivers.push({ date: iso(new Date(start.getTime() + Math.max(0, d) * DAY)), label: `Trả ${it.docNo} — ${it.counterpartyName}`, amount: -open })
    }
  }

  // chi định kỳ hằng tháng
  for (let d = 0; d <= horizon; d++) {
    const date = new Date(start.getTime() + d * DAY)
    for (const r of conn.recurringMonthlyOut) {
      if (date.getDate() === r.day) {
        for (const scn of ['base', 'conservative', 'optimistic'] as const) put(scn, d, -r.amount)
        drivers.push({ date: iso(date), label: r.name, amount: -r.amount })
      }
    }
    for (const r of conn.recurringMonthlyIn ?? []) {
      if (date.getDate() === r.day && d >= r.fromDay) {
        put('base', d, r.amount)
        put('optimistic', d, Math.round(r.amount * 1.1))
        put('conservative', d, Math.round(r.amount * 0.8))
        drivers.push({ date: iso(date), label: r.name, amount: r.amount })
      }
    }
  }

  // giải ngân/trả nợ tài trợ đã xác nhận
  for (const a of apps) {
    if (a.state === 'FUNDED' && a.offer && a.fundedAt) {
      const due = dayIdx(a.fundedAt, a.offer.tenorDays)
      const repay = a.offer.advanceVnd + Math.round((a.offer.advanceVnd * a.offer.ratePct * a.offer.tenorDays) / 36500)
      // khoản phải thu đã tài trợ: tiền bên mua trả đi thẳng để tất toán khoản tài trợ, phần chênh lệch về doanh nghiệp đã nằm trong AR
      for (const scn of ['base', 'conservative', 'optimistic'] as const) put(scn, due, -repay)
      if (due <= horizon && due >= 0) drivers.push({ date: iso(new Date(start.getTime() + due * DAY)), label: `Tất toán khoản tài trợ ${a.id}`, amount: -repay })
    }
  }

  const points: ForecastPoint[] = []
  let b = conn.openingCash
  let c = conn.openingCash
  let o = conn.openingCash
  for (let d = 0; d <= horizon; d++) {
    b += flows.base[d]
    c += flows.conservative[d]
    o += flows.optimistic[d]
    points.push({ day: d, date: iso(new Date(start.getTime() + d * DAY)), base: b, conservative: c, optimistic: o })
  }
  const sumRange = (sign: 1 | -1, n: number) => flows.base.slice(0, n + 1).filter((v) => v * sign > 0).reduce((a, v) => a + v, 0)
  const minBase = points.reduce((m, p) => (p.base < m.value ? { value: p.base, date: p.date } : m), { value: Infinity, date: '' })
  const shortBase = points.find((p) => p.base < threshold)
  const shortCons = points.find((p) => p.conservative < threshold)
  return {
    asOf: iso(start),
    points,
    drivers: drivers.sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount)).slice(0, 12),
    inflow: { d7: sumRange(1, 7), d30: sumRange(1, 30), d90: sumRange(1, horizon) },
    outflow: { d7: -sumRange(-1, 7), d30: -sumRange(-1, 30), d90: -sumRange(-1, horizon) },
    minBase,
    shortfall: shortBase ? { date: shortBase.date, value: shortBase.base, scenario: 'base' } : shortCons ? { date: shortCons.date, value: shortCons.conservative, scenario: 'conservative' } : undefined,
  }
}

const OPEN_FCC_STATES = ['BUYER_CONFIRMED', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'FUNDED', 'OVERDUE']

/**
 * Dự báo cho một tổ chức: công nợ đã nhập + khoản phải thu/phải trả đang mở trên FCC, từ số dư đầu kỳ `opening` (mặc định số dư khai báo).
 * Dùng chung cho giao diện và máy chủ để cùng đầu vào cho cùng kết quả.
 */
export function orgForecast(s: Pick<AppData, 'orgs' | 'receivables' | 'ledger' | 'connections' | 'applications'>, org: Org, now = new Date(), horizon = 90, opening?: number): Forecast | null {
  const conn = s.connections.find((c) => c.orgId === org.id)
  if (!conn) return null
  const fcc: LedgerItem[] = s.receivables
    .filter((r) => (r.sellerId === org.id || r.buyerId === org.id) && OPEN_FCC_STATES.includes(r.state))
    .map((r) => {
      const ar = r.sellerId === org.id
      const other = s.orgs.find((o) => o.id === (ar ? r.buyerId : r.sellerId))
      return { id: `fcc-${r.id}`, orgId: org.id, kind: ar ? 'AR' : 'AP', counterpartyName: other?.name ?? '', counterpartyTaxCode: other?.taxCode, docNo: r.code, amount: r.amount, paid: 0, dueDate: r.dueDate } as LedgerItem
    })
  const own = s.ledger.filter((l) => l.orgId === org.id)
  const base = { ...conn, buyerDelayDays: { ...paymentDelays(s.receivables, s.orgs, org.id), ...conn.buyerDelayDays } }
  return forecastCash(opening === undefined ? base : { ...base, openingCash: opening }, [...own, ...fcc], s.applications, horizon, now, 0)
}

/** Độ trễ thanh toán thực tế (ngày) của từng bên mua với nhà cung cấp này, từ lịch sử khoản đã thanh toán trên FCC; theo MST, '*' là chung. */
export function paymentDelays(receivables: AppData['receivables'], orgs: Org[], sellerId: string): AccountingConnection['buyerDelayDays'] {
  const by = new Map<string, number[]>()
  for (const r of receivables) {
    if (r.sellerId !== sellerId || !r.paidAt || !['SETTLED', 'EARLY_PAID'].includes(r.state)) continue
    const tax = orgs.find((o) => o.id === r.buyerId)?.taxCode ?? ''
    const d = Math.round((new Date(r.paidAt).getTime() - new Date(r.dueDate).getTime()) / DAY)
    by.set(tax, [...(by.get(tax) ?? []), d])
    by.set('*', [...(by.get('*') ?? []), d])
  }
  const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]
  return Object.fromEntries([...by].map(([k, xs]) => [k, { median: Math.max(0, pct(xs, 0.5)), p80: Math.max(0, pct(xs, 0.8)) }]))
}
