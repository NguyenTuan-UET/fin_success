// Bút toán đề xuất từ sự kiện tiền trên FCC (giải ngân, thu hồi, thanh toán của bên mua), theo chế độ kế toán doanh nghiệp.
// Chỉ là ĐỀ XUẤT có độ tin cậy; kế toán duyệt/sửa từng dòng rồi xuất file nhập vào phần mềm kế toán. FCC không ghi vào sổ của doanh nghiệp.
import type { AppData, Org, Receivable } from './types'
import { dayOf } from './util'

export type Regime = 'TT133' | 'TT200'

export interface JournalLine {
  account: string
  accountName: string
  debit: number
  credit: number
}
export interface JournalEntry {
  /** Khóa ổn định theo sự kiện nguồn: cùng sự kiện → cùng ref, không sinh lại */
  ref: string
  date: string
  title: string
  lines: JournalLine[]
  /** 0..1: mức chắc chắn của gợi ý tài khoản */
  confidence: number
  note?: string
}

type S = Pick<AppData, 'orgs' | 'receivables' | 'applications' | 'products' | 'earlyOffers'>

/** Tài khoản theo chế độ: TT133 (DN nhỏ và vừa) và TT200 dùng chung số hiệu cho các nghiệp vụ này; khác biệt ở tên/tài khoản chi tiết. */
const A = (regime: Regime) => ({
  cash: { account: '112', accountName: 'Tiền gửi ngân hàng' },
  recv: { account: '131', accountName: 'Phải thu của khách hàng' },
  pay: { account: '331', accountName: 'Phải trả cho người bán' },
  loan: { account: regime === 'TT133' ? '341' : '3411', accountName: 'Vay và nợ thuê tài chính' },
  finCost: { account: '635', accountName: 'Chi phí tài chính' },
  finIncome: { account: '515', accountName: 'Doanh thu hoạt động tài chính' },
  svcFee: { account: regime === 'TT133' ? '642' : '6428', accountName: 'Chi phí quản lý (phí dịch vụ nền tảng)' },
})

const L = (a: { account: string; accountName: string }, debit: number, credit: number): JournalLine => ({ ...a, debit, credit })
const day = dayOf

export const balanced = (e: JournalEntry) => e.lines.reduce((t, l) => t + l.debit, 0) === e.lines.reduce((t, l) => t + l.credit, 0)

/** Bút toán đề xuất cho một tổ chức. Sắp xếp mới nhất trước. */
export function suggestEntries(s: S, org: Org, regime: Regime = 'TT133'): JournalEntry[] {
  const a = A(regime)
  const out: JournalEntry[] = []
  const recv = new Map<string, Receivable>(s.receivables.map((r) => [r.id, r]))

  if (org.type === 'supplier') {
    for (const ap of s.applications) {
      const r = recv.get(ap.receivableId)
      if (!r || r.sellerId !== org.id || !ap.offer || !ap.fundedAt) continue
      const prod = s.products.find((p) => p.id === ap.productId)
      const nonRecourse = prod?.type === 'factoring_nonrecourse'
      const adv = ap.fundedAmount ?? ap.offer.advanceVnd
      const fee = ap.offer.feesVnd
      // nhận tiền ứng: phí xử lý thu ngay; có truy đòi → ghi nhận như khoản vay, miễn truy đòi → giảm khoản phải thu
      out.push({
        ref: `funded:${ap.id}`, date: day(ap.fundedAt), title: `Nhận tiền ứng ${ap.id} (${r.code})`, confidence: prod ? 0.8 : 0.6,
        lines: [L(a.cash, adv - fee, 0), L(a.finCost, fee, 0), nonRecourse ? L(a.recv, 0, adv) : L(a.loan, 0, adv)],
        note: nonRecourse ? 'Bao thanh toán miễn truy đòi: giảm phải thu' : 'Có truy đòi: ghi nhận như khoản vay',
      })
      const ev = ap.settlements ?? []
      const received = ev.filter((e) => e.type === 'payment_received' || e.type === 'collateral_liquidated')
      if (ap.state === 'SETTLED' && received.length) {
        const alloc = received.reduce((t, e) => ({ fees: t.fees + (e.allocation?.fees ?? 0), interest: t.interest + (e.allocation?.interest ?? 0), principal: t.principal + (e.allocation?.principal ?? 0), surplus: t.surplus + (e.allocation?.surplus ?? 0) }), { fees: 0, interest: 0, principal: 0, surplus: 0 })
        // bên mua trả cho tổ chức tài chính: tất toán khoản tài trợ, ghi giảm phải thu; phần dư hoàn về tài khoản
        const lines: JournalLine[] = [
          nonRecourse ? L(a.loan, 0, 0) : L(a.loan, alloc.principal, 0),
          L(a.finCost, alloc.interest + (alloc.fees - fee > 0 ? alloc.fees - fee : 0), 0),
          L(a.cash, ap.refundPaid ?? 0, 0),
          L(a.recv, 0, r.paidAmount ?? r.amount),
        ].filter((l) => l.debit || l.credit)
        const dr = lines.reduce((t, l) => t + l.debit, 0)
        const cr = lines.reduce((t, l) => t + l.credit, 0)
        // phần dư chưa hoàn xong: ghi vào phải thu khác để bút toán cân
        if (cr > dr) lines.push(L({ account: '1388', accountName: 'Phải thu khác (phần dư chờ hoàn)' }, cr - dr, 0))
        else if (dr > cr) lines.push(L(a.recv, 0, dr - cr))
        out.push({ ref: `settled:${ap.id}`, date: day(ap.settledAt), title: `Tất toán khoản tài trợ ${ap.id}`, confidence: 0.65, lines, note: 'Phần dư hoàn về sẽ khác nếu ngân hàng tính lãi/phí theo hợp đồng riêng — đối chiếu với giấy báo của ngân hàng' })
      }
    }
  }

  if (org.type === 'buyer') {
    for (const r of s.receivables) {
      if (r.buyerId !== org.id) continue
      const eo = s.earlyOffers.find((o) => o.receivableId === r.id && o.state === 'PAID')
      if (r.state === 'EARLY_PAID' && eo) {
        const paid = r.paidAmount ?? Math.round(r.amount * (1 - eo.discountPct / 100))
        out.push({ ref: `early:${eo.id}`, date: day(r.paidAt), title: `Thanh toán sớm ${r.code} (chiết khấu ${eo.discountPct}%)`, confidence: 0.85, lines: [L(a.pay, r.amount, 0), L(a.cash, 0, paid), L(a.finIncome, 0, r.amount - paid)] })
      } else if (r.state === 'SETTLED') {
        out.push({ ref: `paid:${r.id}`, date: day(r.paidAt), title: `Thanh toán hóa đơn ${r.code}`, confidence: 0.9, lines: [L(a.pay, r.amount, 0), L(a.cash, 0, r.amount)] })
      }
    }
  }

  return out.filter(balanced).sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : x.ref < y.ref ? 1 : -1))
}

/** Bút toán phí dịch vụ FCC (cho cả ba loại tổ chức). */
export function feeEntry(regime: Regime, c: { id: string; amount: number; description: string; period: string; createdAt: string }): JournalEntry {
  const a = A(regime)
  return { ref: `fee:${c.id}`, date: day(c.createdAt), title: c.description, confidence: 0.75, lines: [L(a.svcFee, c.amount, 0), L(a.pay, 0, c.amount)], note: 'Chưa gồm thuế GTGT nếu hóa đơn phí có VAT — kế toán điều chỉnh' }
}

/** File nhập vào phần mềm kế toán: mỗi dòng một tài khoản (CSV UTF-8). */
export function toCsv(entries: JournalEntry[]): string {
  const rows = [['ngay', 'so_chung_tu', 'dien_giai', 'tk_no', 'tk_co', 'so_tien']]
  for (const e of entries) {
    const debits = e.lines.filter((l) => l.debit > 0)
    const credits = e.lines.filter((l) => l.credit > 0)
    // ghép Nợ–Có theo thứ tự, phần dư của bên dài hơn ghép với bên còn lại
    let i = 0
    let j = 0
    let dl = debits[0]?.debit ?? 0
    let cl = credits[0]?.credit ?? 0
    while (i < debits.length && j < credits.length) {
      const m = Math.min(dl, cl)
      rows.push([e.date, e.ref, `"${e.title.replace(/"/g, '""')}"`, debits[i].account, credits[j].account, String(m)])
      dl -= m
      cl -= m
      if (dl === 0) { i++; dl = debits[i]?.debit ?? 0 }
      if (cl === 0) { j++; cl = credits[j]?.credit ?? 0 }
    }
  }
  return rows.map((r) => r.join(',')).join('\n') + '\n'
}
