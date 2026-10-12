// Dự báo dòng tiền v1 theo lịch, giải thích được — SPEC mục 7.3.
import type { AccountingConnection, FundingApplication, LedgerItem } from './types'

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
      const delay = conn.buyerDelayDays[it.counterpartyTaxCode ?? ''] ?? conn.buyerDelayDays['*'] ?? { median: 5, p80: 15 }
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
