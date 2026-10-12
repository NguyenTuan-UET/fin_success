import { useState } from 'react'
import { Activity, RotateCcw, ShieldCheck } from 'lucide-react'
import { useActiveOrg, useStore } from '../store'
import { useOrgMap } from '../hooks'
import { Badge, Button, Callout, Card, Modal, Table, Tabs } from '../components/ui'
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
  const reset = useStore((s) => s.resetDemo)
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Hồ sơ tổ chức">
        <dl className="space-y-2 text-[13px]">
          {[['Tên', org.name], ['MST', org.taxCode], ['Ngành', `${org.industryLabel} (VSIC ${org.vsic})`], ['Niêm yết', org.listedSymbol ? `${org.exchange}:${org.listedSymbol}` : 'Không'], ['Địa chỉ', org.province], ['Lao động', String(org.employees)]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-3">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
          <div className="flex justify-between"><dt className="text-ink-3">Xác thực 2 lớp</dt><dd><Badge tone="good">Bật (mô phỏng OTP)</Badge></dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Xác minh pháp nhân</dt><dd><Badge tone="good">Đã xác minh thủ công (mẫu)</Badge></dd></div>
        </dl>
      </Card>
      <Card title="Dữ liệu demo">
        <p className="text-[13px] text-ink-2">Toàn bộ dữ liệu là mô phỏng (doanh nghiệp, ngân hàng, MST, mã CK hư cấu) và lưu trong cơ sở dữ liệu SQLite của máy chủ FCC (server/data/fcc.db); nút “Đặt lại demo” khôi phục dữ liệu mẫu cho mọi người dùng.</p>
        <Button className="mt-3" variant="danger" icon={<RotateCcw className="size-4" />} onClick={() => setConfirm(true)}>Khôi phục dữ liệu mẫu ban đầu</Button>
        <Modal open={confirm} onClose={() => setConfirm(false)} title="Khôi phục dữ liệu mẫu?" footer={<><Button onClick={() => setConfirm(false)}>Hủy</Button><Button variant="danger" onClick={() => { reset(); setConfirm(false) }}>Khôi phục</Button></>}>
          <p className="text-[13px]">Mọi thay đổi trong phiên demo (hóa đơn mới, RFQ, đánh giá ESG, nhật ký…) sẽ bị xóa.</p>
        </Modal>
      </Card>
    </div>
  )
}

function AiTab() {
  const mode = useStore((s) => s.aiMode)
  const setMode = useStore((s) => s.setAiMode)
  const [ping, setPing] = useState<Awaited<ReturnType<typeof pingAi>> | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Chế độ AI">
        <fieldset className="space-y-2 text-[13px]">
          <label className="flex cursor-pointer items-start gap-2"><input type="radio" checked={mode === 'auto'} onChange={() => setMode('auto')} className="mt-1" /><span><b>ollama.com</b> — {TEXT_MODEL} (văn bản), {VISION_MODEL} (ảnh/OCR). Lỗi API → tự chuyển sang mô phỏng và gắn nhãn.</span></label>
          <label className="flex cursor-pointer items-start gap-2"><input type="radio" checked={mode === 'simulate'} onChange={() => setMode('simulate')} className="mt-1" /><span><b>Mô phỏng</b> — không gọi API; kết quả dựng theo quy tắc, luôn gắn nhãn “AI mô phỏng”.</span></label>
        </fieldset>
        <div className="mt-4 flex items-center gap-3">
          <Button icon={<Activity className="size-4" />} loading={busy} onClick={async () => { setBusy(true); setPing(await pingAi()); setBusy(false) }}>Kiểm tra kết nối</Button>
          {ping && <Badge tone={ping.ok ? 'good' : 'critical'}>{ping.ok ? `OK · ${ping.ms} ms` : 'Lỗi'}</Badge>}
        </div>
        {ping && !ping.ok && <div className="mt-2"><Callout tone="critical">{ping.message}</Callout></div>}
      </Card>
      <Card title={<span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-brand" /> Nguyên tắc AI</span>}>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-2">
          <li>Khóa API chỉ nằm ở dev server (proxy <code>/api/ollama</code>, file <code>.env.local</code>), không vào mã chạy trên trình duyệt.</li>
          <li>AI chỉ trích xuất, đề xuất và diễn giải. Điểm tín dụng/ESG do bộ chấm xác định tính — chạy lại cho cùng kết quả.</li>
          <li>Không có trích dẫn bằng chứng → không đề xuất mức ESG ≥ 2; thiếu bằng chứng → “Chưa xác minh”, không gán 0.</li>
          <li>Mọi kết quả AI cần người xác nhận trước khi dùng. Không dùng đặc điểm cá nhân chủ doanh nghiệp làm biến chấm điểm.</li>
          <li>Bản demo chỉ dùng dữ liệu mô phỏng. Dữ liệu khách hàng thật cần hợp đồng xử lý dữ liệu với nhà cung cấp AI và đồng ý của doanh nghiệp.</li>
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
              <td className="px-3 py-2">{orgMap[e.actorOrgId]?.shortName}</td>
              <td className="px-3 py-2 font-medium">{e.action}</td>
              <td className="px-3 py-2">{e.entity}</td>
              <td className="min-w-64 !whitespace-normal px-3 py-2 text-ink-2">{e.detail}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="text-[13px] text-ink-3">Chưa có sự kiện trong phiên demo.</p>
      )}
    </Card>
  )
}
