// Chấm điểm tín dụng tham khảo chạy ở máy chủ: kết quả lưu bất biến kèm phiên bản bộ chấm điểm và băm đầu vào.
// Cùng đầu vào + cùng phiên bản → cùng kết quả và cùng input_hash (không tạo bản ghi mới).
import { createHash } from 'node:crypto'
import { applicationScoreOf, buyerScoreOf, supplierScoreOf } from '@fcc/domain/engine'
import { DEFAULT_SCORECARD, SCORECARD_VERSION, withScorecard, type ScoreResult, type ScorecardParams } from '@fcc/domain/credit'
import type { Core } from './core'
import { uid } from './core'
import { canonical, type Database, type State } from './state'
import { HttpError, forbidden, notFound } from './errors'
import { iso } from '@fcc/domain/util'

export const DEFAULT_SCORECARD_ID = 'sc-v1.0'
export const OFFICIAL_VALID_DAYS = 180

export async function ensureDefaultScorecard(db: Database) {
  await db.createScorecard({ id: DEFAULT_SCORECARD_ID, name: SCORECARD_VERSION, params: DEFAULT_SCORECARD, proposedBy: 'system', status: 'active', approvals: ['system', 'system-2'] })
}

export type Kind = 'supplier' | 'buyer' | 'application'

/** Phần dữ liệu thực sự dùng để chấm: băm phần này làm input_hash. */
function inputSlice(s: State, kind: Kind, subjectId: string) {
  const org = (id: string) => ({
    org: s.orgs.find((o) => o.id === id),
    profile: s.profiles.find((p) => p.orgId === id),
    listed: s.listed.find((l) => l.orgId === id),
    esg: s.esg.filter((e) => e.orgId === id).map((e) => ({ id: e.id, status: e.status, industryGroup: e.industryGroup, indicators: e.indicators.map((i) => [i.code, i.finalLevel, i.na, i.redFlag]) })),
    external: s.external.filter((e) => e.orgId === id),
  })
  const recvOf = (id: string) => s.receivables.filter((r) => r.sellerId === id || r.buyerId === id).map((r) => [r.id, r.sellerId, r.buyerId, r.amount, r.issueDate, r.dueDate, r.state, r.paidAt, r.version])
  if (kind === 'application') {
    const r = s.receivables.find((x) => x.id === subjectId)!
    return { receivable: r, seller: org(r.sellerId), buyer: org(r.buyerId), sellerRecv: recvOf(r.sellerId), buyerRecv: recvOf(r.buyerId) }
  }
  return { ...org(subjectId), recv: recvOf(subjectId) }
}

export const hashInputs = (s: State, kind: Kind, subjectId: string, versionId: string) =>
  createHash('sha256').update(canonical({ versionId, kind, subjectId, input: inputSlice(s, kind, subjectId) })).digest('hex')

export async function assess(core: Core, kind: Kind, subjectId: string, requestedBy: string) {
  const s = core.getState()
  const sc = (await core.db.activeScorecard()) ?? (await ensureDefaultScorecard(core.db), await core.db.activeScorecard())!
  const params = sc.params as ScorecardParams
  const orgIdOf = kind === 'application' ? s.receivables.find((r) => r.id === subjectId)?.sellerId : subjectId
  if (!orgIdOf) throw notFound('Không tìm thấy đối tượng chấm điểm')
  const inputHash = hashInputs(s, kind, subjectId, sc.id)
  const latest = await core.db.latestAssessment(kind, subjectId)
  if (latest && latest.input_hash === inputHash && latest.scorecard_version_id === sc.id) return { row: latest, reused: true }
  const result: ScoreResult = withScorecard(params, () => (kind === 'supplier' ? supplierScoreOf(s, subjectId) : kind === 'buyer' ? buyerScoreOf(s, subjectId) : applicationScoreOf(s, subjectId)))
  const id = uid('CA')
  await core.db.insertAssessment({ id, kind, subjectId, orgId: orgIdOf, scorecardVersionId: sc.id, inputHash, score: result.score, rating: result.rating, coverage: result.coverage, flags: result.flags, result, requestedBy })
  return { row: await core.db.assessment(id), reused: false }
}

/** Ai được xem một kết quả: chính doanh nghiệp, nhân sự FCC, hoặc tổ chức tài chính được doanh nghiệp chia sẻ (credit_score). */
export function canSeeAssessment(core: Core, viewerOrgId: string, row: { org_id: string }, now = core.clock()) {
  const s = core.getState()
  if (row.org_id === viewerOrgId) return true
  const viewer = s.orgs.find((o) => o.id === viewerOrgId)
  if (viewer?.type === 'fcc') return true
  const today = iso(now)
  return s.consents.some((k) => k.ownerId === row.org_id && k.recipientId === viewerOrgId && !k.revokedAt && k.expiresAt >= today && k.scopes.includes('credit_score'))
}

export const shape = (r: Record<string, unknown>) => ({
  id: r.id, kind: r.kind, subjectId: r.subject_id, orgId: r.org_id, scorecardVersionId: r.scorecard_version_id, inputHash: r.input_hash,
  score: Number(r.score), rating: r.rating, coverage: Number(r.coverage), flags: r.flags, status: r.status, createdAt: r.created_at, issuedAt: r.issued_at, validUntil: r.valid_until,
  result: r.result, disclaimer: 'Xếp hạng tham khảo FCC — không phải quyết định tín dụng',
})

export function assertCanAssess(core: Core, orgId: string, kind: Kind, subjectOrgId: string, role: string) {
  const viewer = core.getState().orgs.find((o) => o.id === orgId)
  if (viewer?.type === 'fcc') {
    if (!['fcc_admin', 'fcc_reviewer'].includes(role)) throw forbidden('Chỉ thẩm định viên FCC')
    return
  }
  if (orgId !== subjectOrgId) throw forbidden('Chỉ chấm điểm cho tổ chức của mình')
  const type = viewer?.type
  if ((kind === 'supplier' || kind === 'application') && type !== 'supplier') throw new HttpError(403, 'Chỉ nhà cung cấp chấm điểm nhà cung cấp và hồ sơ')
  if (kind === 'buyer' && type !== 'buyer') throw new HttpError(403, 'Chỉ bên mua chấm điểm bên mua')
}
