// FCC vận hành cấp phát các tổ chức tài chính giả lập (sim-bank): tổ chức đã xác minh, chủ tổ chức, khóa tích hợp đủ
// phạm vi, khóa ký webhook và địa chỉ nhận webhook. Chạy lại được: tổ chức đã có thì dùng lại, khóa cấp mới (khóa cũ bị thu hồi).
import { randomBytes } from 'node:crypto'
import type { Org } from '@fcc/domain/types'
import { uid, type Core } from '../core'
import type { State } from '../state'
import { hashPassword } from '../auth/password'
import { newIntegrationKey, SCOPES } from '../integrations/partner'

/** Tên hư cấu, tiền tố "Sim" — không dùng tên tổ chức tài chính có thật. MST đầu 999 không thuộc mã tỉnh nào. */
export const SIM_INSTITUTIONS = [
  { slug: 'ankhang', name: 'SimBank An Khang', shortName: 'SimBank An Khang', taxCode: '9990000101', industryLabel: 'Ngân hàng thương mại (giả lập)' },
  { slug: 'binhminh', name: 'SimFinance Bình Minh', shortName: 'SimFinance Bình Minh', taxCode: '9990000102', industryLabel: 'Công ty tài chính (giả lập)' },
  { slug: 'cuulong', name: 'SimFund Cửu Long', shortName: 'SimFund Cửu Long', taxCode: '9990000103', industryLabel: 'Quỹ đầu tư xanh (giả lập)' },
] as const

export interface SimInstitutionConfig {
  slug: string
  orgId: string
  name: string
  token: string
  signingSecret: string
}

export async function provisionSimBanks(core: Core, endpointBase: string): Promise<SimInstitutionConfig[]> {
  const out: SimInstitutionConfig[] = []
  for (const inst of SIM_INSTITUTIONS) {
    const org = await core.serial(async () => {
      const found = core.getState().orgs.find((o) => o.taxCode === inst.taxCode)
      if (found) return found
      const now = core.clock()
      const o: Org = {
        id: uid('l'), name: inst.name, shortName: inst.shortName, taxCode: inst.taxCode, type: 'lender', vsic: '6419', industryLabel: inst.industryLabel,
        industryGroup: 'trade', foundedYear: now.getFullYear(), employees: 0, province: 'Giả lập', createdAt: now.toISOString(), verified: true, simulated: true,
      }
      const draft: State = { ...core.getState() }
      draft.orgs = [...draft.orgs, o]
      draft.audit = [{ id: uid('EV'), at: now.toISOString(), actorOrgId: o.id, action: 'FCC cấp phát tổ chức tài chính giả lập', entity: o.id, detail: `${o.name} — chưa kết nối ngân hàng thật` }, ...draft.audit]
      await core.commit(draft)
      return o
    })
    const ownerEmail = `ops@${inst.slug}.sim.fcc.local`
    if (!(await core.db.userByEmail(ownerEmail))) {
      await core.db.createUser({ id: uid('u'), email: ownerEmail, passwordHash: hashPassword(randomBytes(24).toString('hex')), orgId: org.id, name: `Vận hành ${inst.shortName}`, title: 'Tài khoản hệ thống giả lập', role: 'owner' })
    }
    for (const k of await core.db.integrationKeys(org.id)) if (!k.revokedAt) await core.db.revokeIntegrationKey(org.id, k.id)
    const key = newIntegrationKey()
    await core.db.createIntegrationKey({ id: key.id, orgId: org.id, name: 'sim-bank', scopes: Object.keys(SCOPES), keyHash: key.hash, createdBy: 'provision-sim-bank' })
    const signingSecret = randomBytes(32).toString('hex')
    await core.db.setWebhookSecret(org.id, signingSecret)
    await core.db.setPartnerEndpoint(org.id, `${endpointBase.replace(/\/$/, '')}/hooks/${inst.slug}`)
    out.push({ slug: inst.slug, orgId: org.id, name: inst.name, token: key.token, signingSecret })
  }
  return out
}
