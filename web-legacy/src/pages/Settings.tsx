import { useState } from 'react'
import { Activity, KeyRound, ShieldCheck } from 'lucide-react'
import { useActiveOrg, useStore } from '../store'
import { useOrgMap } from '../hooks'
import { Badge, Button, Callout, Card, Field, inputCls, Table, Tabs } from '../components/ui'
import { api } from '../lib/api'
import type { Org } from '@fcc/domain/types'
import { pingAi, TEXT_MODEL, VISION_MODEL } from '../lib/ai'
import { date, dateTime } from '../lib/format'

export function SettingsPage() {
  const [tab, setTab] = useState<'org' | 'ai' | 'consent' | 'audit'>('org')
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Cài đặt & nhật ký</h1>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'org', label: 'Tổ chức' }, { value: 'ai', label: 'AI' }, { value: 'consent', label: 'Quyền chia sẻ dữ liệu' }, { value: 'audit', label: 'Nhật ký' }]} />
      {tab === 'org' && <OrgTab />}
      {tab === 'ai' && <AiTab />}
      {tab === 'consent' && <ConsentTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

function OrgTab() {
  const org = useActiveOrg()
  const me = useStore((s) => s.me)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Hồ sơ tổ chức">
        <dl className="space-y-2 text-[13px]">
          {[['Tên', org.name], ['MST', org.taxCode], ['Ngành', `${org.industryLabel} (VSIC ${org.vsic})`], ['Niêm yết', org.listedSymbol ? `${org.exchange ?? ''}:${org.listedSymbol}` : 'Không'], ['Địa chỉ', org.province], ['Lao động', String(org.employees)], ['Năm thành lập', String(org.foundedYear)], ['Người dùng', me ? `${me.name} · ${me.title} · ${me.email}` : '']].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-3">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
          {org.type === 'lender' && <div className="flex justify-between"><dt className="text-ink-3">Xác minh bởi FCC</dt><dd>{org.verified ? <Badge tone="good">Đã xác minh</Badge> : <Badge tone="warn">Chờ xác minh</Badge>}</dd></div>}
        </dl>
        <p className="mt-3 text-xs text-ink-3">MST chưa được đối chiếu với cơ quan thuế tự động.</p>
      </Card>
      {org.type !== 'fcc' && <EditOrg key={org.id + org.name + org.employees} />}
      {org.type === 'lender' && <WebhookCard orgId={org.id} verified={!!org.verified} />}
    </div>
  )
}

function EditOrg() {
  const org = useActiveOrg()
  const update = useStore((s) => s.updateOrg)
  const [f, setF] = useState({ name: org.name, shortName: org.shortName, vsic: org.vsic, industryLabel: org.industryLabel, province: org.province, foundedYear: String(org.foundedYear), employees: String(org.employees), listedSymbol: org.listedSymbol ?? '', exchange: org.exchange ?? 'HOSE' })
  const [msg, setMsg] = useState<{ tone: 'good' | 'critical'; text: string } | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const save = async () => {
    try {
      await update({ name: f.name, shortName: f.shortName, vsic: f.vsic, industryLabel: f.industryLabel, province: f.province, foundedYear: Number(f.foundedYear), employees: Number(f.employees), ...(org.type === 'buyer' ? { listedSymbol: f.listedSymbol, exchange: f.exchange as Org['exchange'] } : {}) })
      setMsg({ tone: 'good', text: 'Đã lưu hồ sơ tổ chức.' })
    } catch (e) {
      setMsg({ tone: 'critical', text: (e as Error).message })
    }
  }
  const row = (k: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}><input className={inputCls} value={f[k]} onChange={(e) => set(k, e.target.value)} {...extra} /></Field>
  )
  return (
    <Card title="Cập nhật hồ sơ" subtitle="Thông tin này dùng cho chấm điểm và ESG; MST không đổi được">
      {msg && <div className="mb-3"><Callout tone={msg.tone}>{msg.text}</Callout></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {row('name', 'Tên đầy đủ')}
        {row('shortName', 'Tên viết tắt')}
        {row('industryLabel', 'Ngành nghề')}
        {row('vsic', 'Mã VSIC')}
        {row('province', 'Tỉnh/thành')}
        {row('foundedYear', 'Năm thành lập', { inputMode: 'numeric' })}
        {row('employees', 'Số lao động', { inputMode: 'numeric' })}
        {org.type === 'buyer' && row('listedSymbol', 'Mã chứng khoán (nếu niêm yết)', { placeholder: 'VD: HPG' })}
        {org.type === 'buyer' && f.listedSymbol && <Field label="Sàn"><select className={inputCls} value={f.exchange} onChange={(e) => set('exchange', e.target.value)}><option>HOSE</option><option>HNX</option><option>UPCOM</option></select></Field>}
      </div>
      <Button className="mt-3" variant="primary" onClick={save}>Lưu</Button>
    </Card>
  )
}

function WebhookCard({ orgId, verified }: { orgId: string; verified: boolean }) {
  const [secret, setSecret] = useState('')
  const [err, setErr] = useState('')
  const create = async () => {
    setErr('')
    try {
      setSecret((await api<{ secret: string }>('/webhook-secret', { method: 'POST', body: {} })).secret)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return (
    <Card title={<span className="flex items-center gap-1.5"><KeyRound className="size-4 text-brand" /> Webhook ghi nhận giải ngân</span>} subtitle="Hệ thống của tổ chức tài chính gọi khi đã giải ngân; có thể thay bằng nút “Ghi nhận giải ngân” trên hồ sơ">
      {!verified && <Callout tone="warn">Cần FCC xác minh tổ chức trước khi tạo khóa webhook.</Callout>}
      {err && <Callout tone="critical">{err}</Callout>}
      <div className="mt-2 space-y-2 text-[12.5px]">
        <p>POST <code>{origin}/api/webhooks/funding</code> với header <code>x-fcc-org: {orgId}</code>, <code>x-idempotency-key</code>, <code>x-fcc-signature</code> = HMAC-SHA256(khóa, thân yêu cầu) dạng hex; thân JSON <code>{'{"applicationId":"APP-…"}'}</code>.</p>
        {secret && <Callout tone="good" title="Khóa webhook (chỉ hiển thị một lần)"><code className="break-all">{secret}</code></Callout>}
        <Button disabled={!verified} onClick={create}>{secret ? 'Tạo khóa mới (vô hiệu khóa cũ)' : 'Tạo khóa webhook'}</Button>
      </div>
    </Card>
  )
}

function AiTab() {
  const [ping, setPing] = useState<Awaited<ReturnType<typeof pingAi>> | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Dịch vụ AI">
        <p className="text-[13px] text-ink-2">ollama.com qua máy chủ FCC — {TEXT_MODEL} (văn bản), {VISION_MODEL} (ảnh/OCR). Khi AI lỗi, tác vụ báo lỗi và bạn nhập/xác nhận thủ công; hệ thống không tự điền dữ liệu thay AI.</p>
        <div className="mt-4 flex items-center gap-3">
          <Button icon={<Activity className="size-4" />} loading={busy} onClick={async () => { setBusy(true); setPing(await pingAi()); setBusy(false) }}>Kiểm tra kết nối</Button>
          {ping && <Badge tone={ping.ok ? 'good' : 'critical'}>{ping.ok ? `OK · ${ping.ms} ms` : 'Lỗi'}</Badge>}
        </div>
        {ping && !ping.ok && <div className="mt-2"><Callout tone="critical">{ping.message}</Callout></div>}
      </Card>
      <Card title={<span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-brand" /> Nguyên tắc AI</span>}>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-2">
          <li>Khóa API chỉ nằm ở máy chủ FCC (<code>server/.env</code>), không vào mã chạy trên trình duyệt.</li>
          <li>AI chỉ trích xuất, đề xuất và diễn giải. Điểm tín dụng/ESG do bộ chấm xác định tính — chạy lại cho cùng kết quả.</li>
          <li>Không có trích dẫn bằng chứng → không đề xuất mức ESG ≥ 2; thiếu bằng chứng → “Chưa xác minh”, không gán 0.</li>
          <li>Mọi kết quả AI cần người xác nhận trước khi dùng. Không dùng đặc điểm cá nhân chủ doanh nghiệp làm biến chấm điểm.</li>
          <li>Tài liệu bạn tải lên (BCTC, hóa đơn, chứng từ ESG) được gửi tới nhà cung cấp AI để đọc. Cần hợp đồng xử lý dữ liệu với nhà cung cấp AI và sự đồng ý của doanh nghiệp trước khi dùng cho dữ liệu thật.</li>
        </ul>
      </Card>
    </div>
  )
}

function ConsentTab() {
  const org = useActiveOrg()
  const consents = useStore((s) => s.consents)
  const revoke = useStore((s) => s.revokeConsent)
  const orgMap = useOrgMap()
  const given = consents.filter((c) => c.ownerId === org.id)
  const received = consents.filter((c) => c.recipientId === org.id)
  const today = new Date().toISOString().slice(0, 10)
  const status = (c: (typeof consents)[number]) => (c.revokedAt ? <Badge tone="neutral" icon={false}>Đã thu hồi {date(c.revokedAt)}</Badge> : c.expiresAt < today ? <Badge tone="neutral" icon={false}>Hết hạn</Badge> : <Badge tone="good">Hiệu lực</Badge>)
  const SCOPE = { credit_score: 'Điểm tín dụng', esg: 'ESG', documents: 'Chứng từ', accounting: 'Kế toán' }
  return (
    <div className="space-y-4">
      <Card title="Bạn đã chia sẻ" subtitle="Bên nhận, mục đích, loại dữ liệu, thời hạn. Thu hồi có hiệu lực tức thời với truy cập mới.">
        <Table head={['Bên nhận', 'Mục đích', 'Dữ liệu', 'Cấp', 'Hết hạn', 'Trạng thái', '']}>
          {given.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2.5 font-medium">{orgMap[c.recipientId]?.shortName}</td>
              <td className="px-3 py-2.5">{c.purpose}</td>
              <td className="px-3 py-2.5">{c.scopes.map((s) => SCOPE[s]).join(', ')}</td>
              <td className="px-3 py-2.5">{date(c.grantedAt)}</td>
              <td className="px-3 py-2.5">{date(c.expiresAt)}</td>
              <td className="px-3 py-2.5">{status(c)}</td>
              <td className="px-3 py-2.5">{!c.revokedAt && c.expiresAt >= today && <Button size="sm" variant="danger" onClick={() => revoke(c.id)}>Thu hồi</Button>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="Bạn được chia sẻ">
        <Table head={['Chủ dữ liệu', 'Mục đích', 'Dữ liệu', 'Hết hạn', 'Trạng thái']}>
          {received.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2.5 font-medium">{orgMap[c.ownerId]?.shortName}</td>
              <td className="px-3 py-2.5">{c.purpose}</td>
              <td className="px-3 py-2.5">{c.scopes.map((s) => SCOPE[s]).join(', ')}</td>
              <td className="px-3 py-2.5">{date(c.expiresAt)}</td>
              <td className="px-3 py-2.5">{status(c)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}

function AuditTab() {
  const audit = useStore((s) => s.audit)
  const orgMap = useOrgMap()
  return (
    <Card title="Nhật ký sự kiện (append-only)" subtitle="Ai làm gì, lúc nào, trên đối tượng nào. Không sửa/xóa.">
      {audit.length ? (
        <Table head={['Thời điểm', 'Tổ chức', 'Hành động', 'Đối tượng', 'Chi tiết']}>
          {audit.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap px-3 py-2">{dateTime(e.at)}</td>
              <td className="px-3 py-2">{orgMap[e.actorOrgId]?.shortName ?? (e.actorOrgId === 'system' ? 'Hệ thống' : e.actorOrgId)}</td>
              <td className="px-3 py-2 font-medium">{e.action}</td>
              <td className="px-3 py-2">{e.entity}</td>
              <td className="min-w-64 !whitespace-normal px-3 py-2 text-ink-2">{e.detail}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="text-[13px] text-ink-3">Chưa có sự kiện.</p>
      )}
    </Card>
  )
}
