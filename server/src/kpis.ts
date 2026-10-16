// Chỉ số vận hành cho /admin: tính từ dữ liệu thật trong trạng thái, không số cứng.
import type { State } from './state'

const days = (a?: string, b?: string) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000 : undefined)
const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number' && x >= 0)
  return v.length ? { avgDays: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10, samples: v.length } : { avgDays: null, samples: 0 }
}

export function operationsKpis(s: State, users: number) {
  const byState = (xs: { state: string }[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x.state] = (m[x.state] ?? 0) + 1), m), {})
  const apps = s.applications
  const decided = apps.filter((a) => a.decidedAt)
  const approved = decided.filter((a) => a.state !== 'REJECTED')
  const funded = apps.filter((a) => a.state === 'FUNDED' || a.state === 'SETTLED')
  const everDisputed = s.receivables.filter((r) => r.state === 'BUYER_DISPUTED' || r.disputeReason).length
  const confirmable = s.receivables.filter((r) => r.state !== 'DRAFT').length
  return {
    users,
    orgs: { total: s.orgs.length, supplier: s.orgs.filter((o) => o.type === 'supplier').length, buyer: s.orgs.filter((o) => o.type === 'buyer').length, lender: s.orgs.filter((o) => o.type === 'lender').length },
    receivables: { total: s.receivables.length, byState: byState(s.receivables), totalAmount: s.receivables.reduce((a, r) => a + r.amount, 0) },
    applications: { total: apps.length, byState: byState(apps) },
    financed: { count: funded.length, amount: funded.reduce((a, x) => a + (x.fundedAmount ?? 0), 0) },
    approvalRate: decided.length ? Math.round((approved.length / decided.length) * 1000) / 10 : null, // % hồ sơ đã quyết định mà không bị từ chối
    disputeRate: confirmable ? Math.round((everDisputed / confirmable) * 1000) / 10 : null, // % khoản đã gửi bên mua từng bị tranh chấp
    stepTimes: {
      createdToBuyerConfirmed: avg(s.receivables.map((r) => days(r.createdAt, r.confirmedAt))),
      submittedToDecision: avg(decided.map((a) => days(a.submittedAt, a.decidedAt))),
      decisionToFunded: avg(funded.map((a) => days(a.decidedAt, a.fundedAt))),
      fundedToSettled: avg(apps.map((a) => days(a.fundedAt, a.settledAt))),
    },
    exceptions: {
      openInvoiceFlags: s.receivables.reduce((a, r) => a + (r.flags ?? []).filter((f) => !f.resolvedAt).length, 0),
      openRefunds: apps.filter((a) => (a.refundDue ?? 0) > (a.refundPaid ?? 0)).length,
      disputedPublicData: s.external.filter((e) => e.disputed).length,
    },
  }
}
