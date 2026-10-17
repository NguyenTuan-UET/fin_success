// Tạo bộ tài khoản demo: 4 tài khoản, mỗi bên một tài khoản toàn quyền (FCC, nhà cung cấp, bên mua, tổ chức tài chính).
//   DEMO_EMAIL_FCC=a@gmail.com DEMO_EMAIL_SUPPLIER=b@gmail.com DEMO_EMAIL_BUYER=c@gmail.com DEMO_EMAIL_LENDER=d@gmail.com \
//   DEMO_PASSWORD='<mật khẩu riêng, tối thiểu 8 ký tự>' pnpm --filter @fcc/server seed:demo
// Chạy lại được: tổ chức đã có thì dùng lại, tài khoản đã có thì đặt lại mật khẩu (và thu hồi phiên). Không đặt DEMO_PASSWORD thì sinh mật khẩu ngẫu nhiên và in ra.
// Tên tổ chức hư cấu, MST đầu 998 (không thuộc mã tỉnh nào). Nếu máy chủ FCC đang chạy, khởi động lại để nạp tổ chức mới.
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import type { IndustryGroup, Org, OrgType } from '@fcc/domain/types'
import { Database } from '../src/state'
import { ObjectStore } from '../src/storage'
import { createCore, uid } from '../src/core'
import type { State } from '../src/state'
import { hashPassword } from '../src/auth/password'

const dev = (process.env.FCC_ENV ?? 'dev') === 'dev'
const url = process.env.DATABASE_URL ?? `postgres://fcc@/fcc_prod?host=${resolve('data/pg-run')}&port=5433`
const dataKey = ObjectStore.keyFor(dev, resolve('data'))
const password = process.env.DEMO_PASSWORD ?? randomBytes(9).toString('base64url')
if (password.length < 8) throw new Error('DEMO_PASSWORD tối thiểu 8 ký tự')

const emailOf = (key: string) => {
  const v = process.env[key]?.trim().toLowerCase()
  if (!v || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new Error(`Thiếu hoặc sai email: đặt biến môi trường ${key}`)
  return v
}
const EMAILS = { fcc: emailOf('DEMO_EMAIL_FCC'), supplier: emailOf('DEMO_EMAIL_SUPPLIER'), buyer: emailOf('DEMO_EMAIL_BUYER'), lender: emailOf('DEMO_EMAIL_LENDER') }
if (new Set(Object.values(EMAILS)).size !== 4) throw new Error('4 email phải khác nhau')

interface DemoOrg { type: OrgType; slug: string; name: string; taxCode: string; vsic: string; industryLabel: string; industryGroup: IndustryGroup; user: { role: string; title: string } }
const ORGS: DemoOrg[] = [
  { type: 'supplier', slug: 'supplier', name: 'Công ty TNHH Demo Nhà Cung Cấp', taxCode: '9980000001', vsic: '1079', industryLabel: 'Chế biến thực phẩm (demo)', industryGroup: 'manufacturing',
    user: { role: 'owner', title: 'Giám đốc' } },
  { type: 'buyer', slug: 'buyer', name: 'Công ty CP Demo Bên Mua', taxCode: '9980000002', vsic: '4690', industryLabel: 'Bán buôn tổng hợp (demo)', industryGroup: 'trade',
    user: { role: 'owner', title: 'Giám đốc' } },
  { type: 'lender', slug: 'lender', name: 'SimBank Demo Tài Chính', taxCode: '9980000003', vsic: '6419', industryLabel: 'Tổ chức tài chính (demo)', industryGroup: 'trade',
    user: { role: 'owner', title: 'Giám đốc khối' } },
]
const FCC_USER = { role: 'fcc_admin', title: 'Quản trị FCC' }

const db = await Database.open(url)
const core = createCore(db, new ObjectStore(resolve('data/objects'), dataKey), Buffer.from(dataKey, 'hex'), await db.load(), { listedDir: '', appUrl: '' })
const rows: string[] = []

async function ensureOrg(find: (o: Org) => boolean, make: () => Org): Promise<Org> {
  return core.serial(async () => {
    const found = core.getState().orgs.find(find)
    if (found) return found
    const o = make()
    const draft: State = { ...core.getState() }
    draft.orgs = [...draft.orgs, o]
    draft.audit = [{ id: uid('EV'), at: o.createdAt, actorOrgId: o.id, action: 'Tạo tổ chức demo', entity: o.id, detail: o.name }, ...draft.audit]
    await core.commit(draft)
    return o
  })
}
async function ensureUser(org: Org, email: string, role: string, title: string, name: string) {
  const existing = await db.userByEmail(email)
  if (existing) await db.setPassword(existing.id, hashPassword(password))
  else await db.createUser({ id: uid('u'), email, passwordHash: hashPassword(password), orgId: org.id, name, title, role })
  rows.push(`${org.shortName.padEnd(34)} ${role.padEnd(16)} ${email}`)
}

const now = core.clock()
const fcc = await ensureOrg((o) => o.type === 'fcc', () => ({
  id: uid('f'), name: 'Vận hành nền tảng FCC', shortName: 'FCC', taxCode: 'FCC-OPS', type: 'fcc', vsic: '6399', industryLabel: 'Vận hành nền tảng', industryGroup: 'tech',
  foundedYear: now.getFullYear(), employees: 0, province: '—', createdAt: now.toISOString(),
}))
await ensureUser(fcc, EMAILS.fcc, FCC_USER.role, FCC_USER.title, `Demo ${FCC_USER.title}`)
for (const d of ORGS) {
  const org = await ensureOrg((o) => o.taxCode === d.taxCode, () => ({
    id: uid(d.type[0]), name: d.name, shortName: d.name, taxCode: d.taxCode, type: d.type, vsic: d.vsic, industryLabel: d.industryLabel, industryGroup: d.industryGroup,
    foundedYear: 2015, employees: 50, province: 'Hà Nội', createdAt: now.toISOString(), verified: d.type === 'lender' ? true : undefined,
  }))
  await ensureUser(org, EMAILS[d.type as 'supplier' | 'buyer' | 'lender'], d.user.role, d.user.title, `Demo ${d.user.title}`)
}
console.log(rows.join('\n'))
console.log(`\nMật khẩu chung: ${password}`)
console.log('Hành động nhạy cảm cần bật MFA (TOTP) cho từng tài khoản khi đăng nhập lần đầu. Nếu máy chủ đang chạy, khởi động lại để nạp tổ chức mới.')
await db.close()
