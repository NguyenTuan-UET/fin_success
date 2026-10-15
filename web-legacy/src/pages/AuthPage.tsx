import { useState } from 'react'
import { useStore } from '../store'
import { Button, Callout, Field, inputCls } from '../components/ui'
import type { IndustryGroup } from '../domain/types'

const INDUSTRY: Record<IndustryGroup, string> = { manufacturing: 'Sản xuất / xây dựng', trade: 'Thương mại / dịch vụ / tài chính', agri: 'Nông nghiệp / thực phẩm', tech: 'Công nghệ' }
const TYPES = { supplier: 'Nhà cung cấp (bán hàng, cần vốn)', buyer: 'Bên mua (doanh nghiệp lớn)', lender: 'Tổ chức tài chính' } as const

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  return (
    <div className="grid min-h-full place-items-center bg-page p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight">FCC · Fast Cash Connect</h1>
          <p className="text-[13px] text-ink-3">Nền tảng tài trợ chuỗi cung ứng và chấm điểm ESG</p>
        </div>
        <div className="mb-5 flex gap-2" role="tablist">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium ${mode === m ? 'bg-brand-soft text-brand-dark' : 'text-ink-2 hover:bg-muted'}`}>
              {m === 'login' ? 'Đăng nhập' : 'Đăng ký tổ chức'}
            </button>
          ))}
        </div>
        {mode === 'login' ? <Login /> : <Register />}
      </div>
    </div>
  )
}

function Login() {
  const login = useStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await login(email, password)
    } catch (x) {
      setErr((x as Error).message)
    }
    setBusy(false)
  }
  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      {err && <Callout tone="critical">{err}</Callout>}
      <Field label="Email"><input className={inputCls} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label="Mật khẩu"><input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <Button type="submit" variant="primary" loading={busy}>Đăng nhập</Button>
    </form>
  )
}

function Register() {
  const register = useStore((s) => s.register)
  const [f, setF] = useState({
    type: 'supplier' as keyof typeof TYPES, name: '', shortName: '', taxCode: '', vsic: '', industryLabel: '', industryGroup: 'manufacturing' as IndustryGroup,
    province: '', foundedYear: String(new Date().getFullYear() - 5), employees: '', listedSymbol: '', exchange: 'HOSE',
    userName: '', title: '', email: '', password: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await register({
        email: f.email, password: f.password, name: f.userName, title: f.title,
        org: { type: f.type, name: f.name, shortName: f.shortName || f.name, taxCode: f.taxCode, vsic: f.vsic, industryLabel: f.industryLabel, industryGroup: f.industryGroup, province: f.province, foundedYear: Number(f.foundedYear), employees: Number(f.employees), ...(f.type === 'buyer' && f.listedSymbol ? { listedSymbol: f.listedSymbol, exchange: f.exchange } : {}) },
      })
    } catch (x) {
      setErr((x as Error).message)
    }
    setBusy(false)
  }
  const inp = (k: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}><input className={inputCls} value={f[k]} onChange={(e) => set(k, e.target.value)} required={extra.required ?? true} {...extra} /></Field>
  )
  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <Callout tone="critical">{err}</Callout>}
      <Field label="Loại tổ chức">
        <select className={inputCls} value={f.type} onChange={(e) => set('type', e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {inp('name', 'Tên đầy đủ của doanh nghiệp')}
        {inp('shortName', 'Tên viết tắt', { required: false })}
        {inp('taxCode', 'Mã số thuế (10 hoặc 13 số)', { inputMode: 'numeric' })}
        {inp('vsic', 'Mã ngành VSIC chính')}
        {inp('industryLabel', 'Ngành nghề kinh doanh')}
        <Field label="Nhóm ngành (dùng cho trọng số ESG)">
          <select className={inputCls} value={f.industryGroup} onChange={(e) => set('industryGroup', e.target.value)}>{Object.entries(INDUSTRY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        {inp('province', 'Tỉnh/thành')}
        {inp('foundedYear', 'Năm thành lập', { inputMode: 'numeric' })}
        {inp('employees', 'Số lao động', { inputMode: 'numeric' })}
        {f.type === 'buyer' && inp('listedSymbol', 'Mã chứng khoán (nếu niêm yết)', { required: false, placeholder: 'VD: HPG' })}
        {f.type === 'buyer' && f.listedSymbol && (
          <Field label="Sàn"><select className={inputCls} value={f.exchange} onChange={(e) => set('exchange', e.target.value)}><option>HOSE</option><option>HNX</option><option>UPCOM</option></select></Field>
        )}
      </div>
      <p className="border-t border-line pt-3 text-[13px] font-semibold">Người dùng đầu tiên (quản trị tổ chức)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {inp('userName', 'Họ tên')}
        {inp('title', 'Chức danh')}
        {inp('email', 'Email', { type: 'email', autoComplete: 'username' })}
        {inp('password', 'Mật khẩu (tối thiểu 10 ký tự)', { type: 'password', autoComplete: 'new-password', minLength: 10 })}
      </div>
      {f.type === 'lender' && <Callout tone="warn">Tổ chức tài chính cần được FCC xác minh pháp nhân và giấy phép trước khi đăng sản phẩm lên Marketplace.</Callout>}
      <Button type="submit" variant="primary" loading={busy}>Đăng ký</Button>
    </form>
  )
}

const PARTIES = [
  { path: 'supplier', label: 'Nhà cung cấp', desc: 'Tạo hóa đơn, gửi RFQ, chấp thuận đề nghị, ESG, dòng tiền' },
  { path: 'buyer', label: 'Bên mua', desc: 'Xác nhận hóa đơn, thanh toán, đề nghị thanh toán sớm' },
  { path: 'lender', label: 'Tổ chức tài chính', desc: 'Đăng sản phẩm, báo giá RFQ, thẩm định, giải ngân' },
  { path: 'fcc', label: 'Nhân sự FCC', desc: 'Thẩm định và phát hành điểm ESG chính thức (không cần cho luồng tài trợ)' },
] as const

/** Chế độ dev: mỗi bên một trang riêng, tự đăng nhập tài khoản dev. Mở mỗi bên ở một tab. */
export function DevChooser() {
  return (
    <div className="grid min-h-full place-items-center bg-page p-4">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold tracking-tight">FCC · chế độ dev</h1>
        <p className="mb-4 text-[13px] text-ink-3">Mỗi bên có một trang riêng, tự vào bằng tài khoản dev (không đăng nhập). Mở mỗi bên ở một tab để chạy luồng từ đầu đến cuối.</p>
        <div className="space-y-2">
          {PARTIES.map((p) => (
            <a key={p.path} href={`/${p.path}`} className="block rounded-xl border border-line px-4 py-3 hover:border-brand hover:bg-brand-soft/40">
              <div className="font-semibold">/{p.path} — {p.label}</div>
              <div className="text-[13px] text-ink-3">{p.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
