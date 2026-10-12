import { useState } from 'react'
import { Database, Globe, LineChart, RefreshCw, ShieldAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useActiveOrg, useStore } from '../store'
import { hasConsent, useOrgMap } from '../hooks'
import { Badge, Button, Callout, Card, Table, Tabs } from '../components/ui'
import { dateTime } from '../lib/format'

export function DataSources() {
  const [tab, setTab] = useState<'profile' | 'sources' | 'listed'>('profile')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dữ liệu doanh nghiệp</h1>
        <p className="text-[13px] text-ink-3">Bên mua niêm yết: vnstock. Bên bán SME/gia công: dữ liệu doanh nghiệp đồng ý chia sẻ → API chính thức → crawl nguồn công khai có kiểm soát. Mọi giá trị có nguồn, thời điểm lấy và trạng thái.</p>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'profile', label: 'Hồ sơ dữ liệu ngoài' }, { value: 'sources', label: 'Danh mục nguồn' }, { value: 'listed', label: 'Ánh xạ MST ↔ mã CK' }]} />
      {tab === 'profile' && <Profiles />}
      {tab === 'sources' && <Sources />}
      {tab === 'listed' && <Listed />}
    </div>
  )
}

function Profiles() {
  const org = useActiveOrg()
  const orgs = useStore((s) => s.orgs)
  const consents = useStore((s) => s.consents)
  const external = useStore((s) => s.external)
  const sources = useStore((s) => s.sources)
  const refresh = useStore((s) => s.refreshExternal)
  const dispute = useStore((s) => s.disputeExternal)
  const orgMap = useOrgMap()
  const visible = orgs.filter((o) => o.type === 'supplier' && (o.id === org.id || hasConsent(consents, o.id, org.id, 'credit_score') || org.type === 'buyer'))
  const [sel, setSel] = useState(visible.find((o) => o.id === org.id)?.id ?? visible[0]?.id)
  const recs = external.filter((e) => e.orgId === sel)
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card title="Doanh nghiệp" className="h-fit">
        <div className="flex flex-col gap-1">{visible.map((o) => <Button key={o.id} variant={o.id === sel ? 'primary' : 'ghost'} className="justify-start" onClick={() => setSel(o.id)}>{o.shortName}</Button>)}</div>
      </Card>
      {sel && (
        <Card title={`Dữ liệu từ nguồn công khai — ${orgMap[sel].name}`} subtitle={`Tra cứu theo MST ${orgMap[sel].taxCode} · trạng thái “nguồn công khai – tham khảo”`} action={<Button size="sm" icon={<RefreshCw className="size-4" />} onClick={() => refresh(sel)}>Làm mới (nguồn đã duyệt)</Button>}>
          <Table head={['Trường', 'Giá trị', 'Nguồn', 'Lấy lúc', 'Provenance', '']}>
            {recs.map((r) => {
              const src = sources.find((s) => s.id === r.sourceId)!
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">{r.field}</td>
                  <td className="px-3 py-2">{r.value} {r.disputed && <Badge tone="warn">Đang khiếu nại</Badge>}</td>
                  <td className="px-3 py-2 text-ink-2">{src.name} {src.status !== 'approved' && <Badge tone="warn">Nguồn chờ duyệt</Badge>}</td>
                  <td className="px-3 py-2">{dateTime(r.fetchedAt)}</td>
                  <td className="px-3 py-2 text-[11px] text-ink-3"><div className="max-w-56 truncate" title={r.url}>{r.url}</div><div>{r.contentHash} · parser v1</div></td>
                  <td className="px-3 py-2">{sel === org.id && !r.disputed && <Button size="sm" variant="ghost" onClick={() => dispute(r.id)}>Khiếu nại sai lệch</Button>}</td>
                </tr>
              )
            })}
          </Table>
          <p className="mt-3 text-xs text-ink-3">Dữ liệu đang khiếu nại không được dùng cho cờ knock-out cho đến khi FCC operations xử lý. URL trong bản demo là địa chỉ minh họa (example).</p>
        </Card>
      )}
    </div>
  )
}

function Sources() {
  const sources = useStore((s) => s.sources)
  return (
    <div className="space-y-4">
      <Callout tone="warn" title={<span className="flex items-center gap-1.5"><ShieldAlert className="size-4" /> Quy tắc crawl bắt buộc</span>}>
        <ul className="list-disc pl-5">
          <li>Nguồn chưa được phê duyệt (điều khoản sử dụng, robots.txt, căn cứ pháp lý, dữ liệu cá nhân) thì không chạy.</li>
          <li>Không vượt CAPTCHA, đăng nhập, paywall hay biện pháp chặn kỹ thuật — nguồn có CAPTCHA dùng tra cứu thủ công có hỗ trợ hoặc dữ liệu doanh nghiệp tự cung cấp.</li>
          <li>Tra cứu theo MST cần thiết (không quét toàn bộ CSDL), giới hạn tần suất, user-agent định danh, cache; lưu URL, thời điểm, hash, phiên bản parser.</li>
          <li>Thu tối thiểu dữ liệu cá nhân (ví dụ tên người đại diện) theo Luật Bảo vệ dữ liệu cá nhân; doanh nghiệp được xem và khiếu nại dữ liệu về mình.</li>
        </ul>
      </Callout>
      <Card title="Danh mục nguồn dữ liệu">
        <Table head={['Nguồn', 'Loại', 'Dữ liệu', 'Căn cứ', 'DL cá nhân', 'Tần suất', 'Trạng thái', 'Ghi chú']}>
          {sources.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2.5 font-medium"><span className="flex items-center gap-1.5">{s.kind === 'vnstock' ? <LineChart className="size-4 text-brand" /> : s.kind === 'crawl' ? <Globe className="size-4 text-ink-3" /> : <Database className="size-4 text-ink-3" />}{s.name}</span></td>
              <td className="px-3 py-2.5">{s.kind}</td>
              <td className="min-w-48 !whitespace-normal px-3 py-2.5 text-ink-2">{s.dataFields}</td>
              <td className="min-w-48 !whitespace-normal px-3 py-2.5 text-ink-2">{s.legalBasis}</td>
              <td className="px-3 py-2.5">{s.personalData ? <Badge tone="warn">Có</Badge> : 'Không'}</td>
              <td className="px-3 py-2.5 text-ink-2">{s.rateLimit}</td>
              <td className="px-3 py-2.5"><Badge tone={s.status === 'approved' ? 'good' : s.status === 'pending' ? 'warn' : 'critical'}>{{ approved: 'Đã duyệt', pending: 'Chờ duyệt', blocked: 'Chặn' }[s.status]}</Badge></td>
              <td className="min-w-56 !whitespace-normal px-3 py-2.5 text-xs text-ink-3">{s.note}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}

function Listed() {
  const orgs = useStore(useShallow((s) => s.orgs.filter((o) => o.listedSymbol)))
  const listed = useStore((s) => s.listed)
  return (
    <Card title="Bên mua niêm yết — ánh xạ MST ↔ mã chứng khoán" subtitle="Lần đầu xác minh thủ công; dữ liệu tài chính lấy qua vnstock (Fundamental, Market, Reference)">
      <Table head={['Doanh nghiệp', 'MST', 'Sàn', 'Mã', 'Nguồn dữ liệu', 'Cập nhật', 'Trạng thái']}>
        {orgs.map((o) => {
          const l = listed.find((x) => x.orgId === o.id)
          return (
            <tr key={o.id}>
              <td className="px-3 py-2.5 font-medium">{o.name}</td>
              <td className="px-3 py-2.5">{o.taxCode}</td>
              <td className="px-3 py-2.5">{o.exchange}</td>
              <td className="px-3 py-2.5 font-semibold">{o.listedSymbol}</td>
              <td className="px-3 py-2.5 text-ink-2">{l?.provider}</td>
              <td className="px-3 py-2.5">{l && dateTime(l.fetchedAt)}</td>
              <td className="px-3 py-2.5">{l?.isMock ? <Badge tone="warn">Snapshot mẫu</Badge> : <Badge tone="good">Dữ liệu vnstock</Badge>}</td>
            </tr>
          )
        })}
      </Table>
      <div className="mt-3 rounded-lg bg-page p-3 text-[12.5px]">
        <p className="font-semibold">Lấy dữ liệu thật</p>
        <pre className="mt-1 overflow-x-auto text-[11.5px] text-ink-2">python scripts/fetch_listed.py &lt;MÃ_CK&gt; --tax-code &lt;MST&gt; --out web/public/listed</pre>
        <p className="mt-1 text-ink-3">Script ghi <code>public/listed/&lt;MÃ&gt;.json</code>; trang Chấm điểm → “Làm mới từ vnstock” sẽ nạp file này. Mã CK trong demo (…X) là hư cấu — đổi sang mã thật khi dùng dữ liệu thật.</p>
      </div>
    </Card>
  )
}
