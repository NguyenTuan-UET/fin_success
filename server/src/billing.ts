// Tính phí theo biểu phí đang hiệu lực. Mỗi khoản phí truy được về sự kiện phát sinh (ref) và phiên bản biểu phí; trùng ref không tính hai lần.
import { FEE_SOURCES, referralFee, saasFee, transactionFee, validateSchedule, ZERO_SCHEDULE, monthOf, type FeeSchedule, type FeeSource } from '@fcc/domain/fees'
import type { Core } from './core'
import { uid } from './core'
import type { Database } from './state'
import type { DomainEvent } from './service'

export const feeSourceLabel = (s: string) => FEE_SOURCES[s as FeeSource]?.label ?? s

export async function ensureFeeSchedule(db: Database) {
  await db.createFeeSchedule({ id: ZERO_SCHEDULE.id, name: ZERO_SCHEDULE.name, params: ZERO_SCHEDULE, effectiveFrom: new Date('2000-01-01'), createdBy: 'system' })
}

export async function scheduleAt(db: Database, at: Date): Promise<FeeSchedule> {
  const row = (await db.activeFeeSchedule(at)) ?? (await ensureFeeSchedule(db), (await db.activeFeeSchedule(at))!)
  return { ...(row.params as unknown as FeeSchedule), id: row.id, name: row.name }
}

async function charge(core: Core, orgId: string, source: FeeSource, amount: number, ref: string, description: string, at = core.clock()) {
  const sch = await scheduleAt(core.db, at)
  return core.db.addCharge({ id: uid('FEE'), orgId, source, amount, scheduleId: sch.id, ref, description, period: monthOf(at.toISOString()) })
}

/** Phí phát sinh từ sự kiện nghiệp vụ: giải ngân → phí giao dịch (đơn vị xuất khẩu) + hoa hồng giới thiệu (tổ chức tài chính). */
export async function chargeFromEvents(core: Core, events: DomainEvent[]) {
  for (const e of events) {
    if (e.type !== 'application.funded') continue
    const st = core.getState()
    const a = st.applications.find((x) => x.id === e.data.applicationId)
    if (!a?.offer) continue
    const r = st.receivables.find((x) => x.id === a.receivableId)
    if (!r) continue
    const sch = await scheduleAt(core.db, core.clock())
    const advance = Number(e.data.amount ?? a.offer.advanceVnd)
    await charge(core, r.sellerId, 'transaction', transactionFee(sch, advance), `funded:${a.id}`, `Phí giao dịch tài trợ ${r.code} (${advance.toLocaleString('vi-VN')} ₫)`)
    await charge(core, a.lenderId, 'referral', referralFee(sch, a.offer.feesVnd), `funded:${a.id}`, `Hoa hồng giới thiệu hồ sơ ${a.id}`)
  }
}

/** Chạy tính phí định kỳ cho một tháng (YYYY-MM): thuê bao SaaS và phí kết nối API. Chạy lại không tạo trùng. */
export async function billingRun(core: Core, period: string) {
  const at = new Date(`${period}-28T00:00:00Z`)
  const sch = await scheduleAt(core.db, at)
  let created = 0
  for (const o of core.getState().orgs) {
    if (o.type === 'fcc') continue
    if (await charge(core, o.id, 'saas', saasFee(sch, o.type), `saas:${period}`, `Phí thuê bao tháng ${period}`, at)) created++
  }
  for (const k of await core.db.activeKeyOrgs()) {
    if (await charge(core, k.orgId, 'api', sch.apiMonthlyPerKey * Number(k.keys), `api:${period}`, `Phí kết nối API tháng ${period} (${k.keys} khóa)`, at)) created++
  }
  return { period, created, scheduleId: sch.id }
}

export const chargeScoring = (core: Core, orgId: string, assessmentId: string) => scheduleAt(core.db, core.clock()).then((s) => charge(core, orgId, 'scoring', s.scoringFee, `score:${assessmentId}`, 'Phát hành điểm tín dụng chính thức'))
export const chargeReport = (core: Core, orgId: string, name: string, ref: string) => scheduleAt(core.db, core.clock()).then((s) => charge(core, orgId, 'report', s.reportFee, `report:${ref}`, `Xuất báo cáo ${name}`))

export { validateSchedule }
