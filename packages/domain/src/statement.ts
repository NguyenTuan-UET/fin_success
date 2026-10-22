// Sao kê tài khoản từ ngân hàng GIẢ LẬP: dựng từ các sự kiện tiền đã ghi nhận trên FCC (giải ngân, thu hồi, hoàn phần dư, thanh toán của
// bên nhập khẩu) cộng chi định kỳ doanh nghiệp tự khai. Không có giao dịch ngẫu nhiên. Mọi dòng ghi nguồn để tách khỏi dữ liệu ngân hàng thật về sau.
import type { AccountingConnection, AppData, Org } from './types'
import { dayOf } from './util'

export const STATEMENT_SOURCE = 'Ngân hàng giả lập (dựng từ sự kiện tiền trên FCC)'

export interface StatementLine {
  date: string // YYYY-MM-DD
  description: string
  /** Dương: tiền vào; âm: tiền ra */
  amount: number
  balance: number
  kind: 'advance' | 'refund' | 'repayment' | 'collection' | 'payout' | 'buyer_payment' | 'recurring'
  ref: string
}

type S = Pick<AppData, 'receivables' | 'applications' | 'earlyOffers'>
const day = dayOf

export function statementFor(s: S, org: Org, conn: Pick<AccountingConnection, 'openingCash' | 'recurringMonthlyOut' | 'lastSyncedAt'> & { bankLinkedAt?: string }, from: string, to: string): { lines: StatementLine[]; opening: number; closing: number; source: string } {
  const since = day(conn.bankLinkedAt ?? conn.lastSyncedAt)
  const raw: Omit<StatementLine, 'balance'>[] = []
  const recv = new Map(s.receivables.map((r) => [r.id, r]))

  for (const ap of s.applications) {
    const r = recv.get(ap.receivableId)
    if (!r) continue
    const fee = ap.offer?.feesVnd ?? 0
    const adv = ap.fundedAmount ?? ap.offer?.advanceVnd ?? 0
    if (org.type === 'supplier' && r.sellerId === org.id) {
      if (ap.fundedAt) raw.push({ date: day(ap.fundedAt), description: `Giải ngân ${ap.id} (đã trừ phí xử lý)`, amount: adv - fee, kind: 'advance', ref: `adv:${ap.id}` })
      for (const e of ap.settlements ?? []) if (e.type === 'refund_paid') raw.push({ date: day(e.at), description: `Hoàn phần dư ${ap.id}${e.reference ? ` · ${e.reference}` : ''}`, amount: e.amount, kind: 'refund', ref: `ref:${e.id}` })
    }
    if (org.type === 'lender' && ap.lenderId === org.id) {
      if (ap.fundedAt) raw.push({ date: day(ap.fundedAt), description: `Giải ngân ${ap.id}`, amount: -adv, kind: 'payout', ref: `adv:${ap.id}` })
      for (const e of ap.settlements ?? []) {
        if (e.type === 'payment_received' || e.type === 'collateral_liquidated') raw.push({ date: day(e.at), description: `${e.type === 'collateral_liquidated' ? 'Thanh lý tài sản' : 'Tiền về'} ${ap.id}${e.reference ? ` · ${e.reference}` : ''}`, amount: e.amount, kind: 'collection', ref: `col:${e.id}` })
        if (e.type === 'refund_paid') raw.push({ date: day(e.at), description: `Hoàn phần dư ${ap.id}`, amount: -e.amount, kind: 'refund', ref: `ref:${e.id}` })
      }
    }
    if (org.type === 'buyer' && r.buyerId === org.id) {
      for (const e of ap.settlements ?? []) if (e.type === 'buyer_reported') raw.push({ date: day(e.at), description: `Thanh toán ${r.code} cho ${ap.id}${e.reference ? ` · ${e.reference}` : ''}`, amount: -e.amount, kind: 'buyer_payment', ref: `bp:${e.id}` })
    }
  }
  // thanh toán trực tiếp (khoản không tài trợ) và thanh toán sớm
  for (const r of s.receivables) {
    if (!r.paidAt || !r.paidAmount) continue
    const financed = s.applications.some((a) => a.receivableId === r.id && ['FUNDED', 'SETTLED'].includes(a.state))
    if (financed) continue
    if (org.type === 'buyer' && r.buyerId === org.id) raw.push({ date: day(r.paidAt), description: `Thanh toán ${r.code} trực tiếp cho đơn vị xuất khẩu`, amount: -r.paidAmount, kind: 'buyer_payment', ref: `direct:${r.id}` })
    if (org.type === 'supplier' && r.sellerId === org.id) raw.push({ date: day(r.paidAt), description: `Nhận thanh toán ${r.code} từ bên nhập khẩu`, amount: r.paidAmount, kind: 'collection', ref: `direct:${r.id}` })
  }
  // chi định kỳ hằng tháng do doanh nghiệp khai
  const end = new Date(`${to}T00:00:00Z`)
  for (let d = new Date(`${since}T00:00:00Z`); d <= end; d = new Date(d.getTime() + 86_400_000)) {
    for (const o of conn.recurringMonthlyOut) if (d.getUTCDate() === o.day) raw.push({ date: d.toISOString().slice(0, 10), description: `${o.name} (chi định kỳ khai báo)`, amount: -o.amount, kind: 'recurring', ref: `rec:${o.name}:${d.toISOString().slice(0, 10)}` })
  }

  const all = raw.filter((l) => l.date >= since && l.date <= to).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ref < b.ref ? -1 : 1))
  let bal = conn.openingCash
  let opening = conn.openingCash
  const lines: StatementLine[] = []
  for (const l of all) {
    if (l.date < from) opening = bal += l.amount
    else {
      bal += l.amount
      lines.push({ ...l, balance: bal })
    }
  }
  return { lines, opening, closing: bal, source: STATEMENT_SOURCE }
}
