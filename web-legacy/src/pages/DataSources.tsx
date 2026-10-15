import { useState } from 'react'
import { Database, Globe, LineChart, ShieldAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { Badge, Callout, Card, Table, Tabs } from '../components/ui'
import { dateTime } from '../lib/format'

export function DataSources() {
  const [tab, setTab] = useState<'sources' | 'listed'>('sources')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dữ liệu doanh nghiệp</h1>
        <p className="text-[13px] text-ink-3">Nguồn dữ liệu hệ thống đang dùng thật: vnstock cho bên mua niêm yết và tài liệu do chính doanh nghiệp tải lên. Chưa có bộ thu thập (crawl) nào được triển khai.</p>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'sources', label: 'Danh mục nguồn' }, { value: 'listed', label: 'Bên mua niêm yết' }]} />
      {tab === 'sources' && <Sources />}
      {tab === 'listed' && <Listed />}
    </div>
  )
}

function Sources() {
  const sources = useStore((s) => s.sources)
  return (
    <div className="space-y-4">
      <Callout tone="warn" title={<span className="flex items-center gap-1.5"><ShieldAlert className="size-4" /> Quy tắc bắt buộc nếu bổ sung nguồn crawl (chưa triển khai)</span>}>
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
    <Card title="Bên mua niêm yết" subtitle="Mã chứng khoán do bên mua khai báo khi đăng ký; dữ liệu tài chính lấy qua vnstock (Fundamental, Market, Reference)">
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
              <td className="px-3 py-2.5">{l ? <Badge tone="good">Dữ liệu vnstock</Badge> : <Badge tone="warn">Chưa nạp</Badge>}</td>
            </tr>
          )
        })}
      </Table>
      <div className="mt-3 rounded-lg bg-page p-3 text-[12.5px]">
        <p className="font-semibold">Lấy dữ liệu thật</p>
        <pre className="mt-1 overflow-x-auto text-[11.5px] text-ink-2">python scripts/fetch_listed.py &lt;MÃ_CK&gt; --tax-code &lt;MST&gt; --out web/public/listed</pre>
        <p className="mt-1 text-ink-3">Script ghi <code>public/listed/&lt;MÃ&gt;.json</code>; bên mua niêm yết vào Chấm điểm DN → “Nạp dữ liệu từ vnstock” để máy chủ nạp file này (chỉ nạp được đúng mã của tổ chức mình).</p>
      </div>
    </Card>
  )
}
