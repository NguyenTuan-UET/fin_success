import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useStore } from '../store'
import { useOrgMap } from '../hooks'
import { PRODUCT_TYPE_LABEL } from '../domain/marketplace'
import { Badge, Button, Card, Empty, Table } from '../components/ui'
import { computeEsg } from '../domain/esg'
import { date, vnd } from '../lib/format'

export function Admin() {
  const orgs = useStore((s) => s.orgs)
  const products = useStore((s) => s.products)
  const esg = useStore((s) => s.esg)
  const verify = useStore((s) => s.verifyOrg)
  const approve = useStore((s) => s.approveProduct)
  const orgMap = useOrgMap()
  const lenders = orgs.filter((o) => o.type === 'lender')
  const pending = products.filter((p) => p.status === 'pending_review')
  const assessments = esg.filter((a) => a.source === 'assessed')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Quản trị FCC</h1>
        <p className="text-[13px] text-ink-3">Xác minh tổ chức tài chính, duyệt sản phẩm Marketplace và thẩm định ESG. Nhân sự FCC không xem chứng từ hay hồ sơ tài trợ của doanh nghiệp.</p>
      </div>
      <Card title={`Tổ chức tài chính (${lenders.length})`} subtitle="Chỉ tổ chức đã xác minh pháp nhân/giấy phép mới đăng được sản phẩm">
        {lenders.length ? (
          <Table head={['Tên', 'MST', 'Tỉnh/thành', 'Đăng ký', 'Trạng thái', '']}>
            {lenders.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2.5 font-medium">{o.name}</td>
                <td className="px-3 py-2.5">{o.taxCode}</td>
                <td className="px-3 py-2.5">{o.province}</td>
                <td className="px-3 py-2.5">{date(o.createdAt)}</td>
                <td className="px-3 py-2.5">{o.verified ? <Badge tone="good">Đã xác minh</Badge> : <Badge tone="warn">Chờ xác minh</Badge>}</td>
                <td className="px-3 py-2.5">{o.verified ? <Button size="sm" variant="ghost" onClick={() => verify(o.id, false)}>Thu hồi</Button> : <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => verify(o.id, true)}>Xác minh</Button>}</td>
              </tr>
            ))}
          </Table>
        ) : <Empty title="Chưa có tổ chức tài chính đăng ký" />}
      </Card>
      <Card title={`Sản phẩm chờ duyệt (${pending.length})`}>
        {pending.length ? (
          <Table head={['Sản phẩm', 'Tổ chức', 'Loại', 'Tài trợ', 'Ứng / lãi suất', 'Phiên bản', '']}>
            {pending.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2.5 font-medium">{p.name}<div className="max-w-xs whitespace-normal text-xs text-ink-3">{p.description}</div></td>
                <td className="px-3 py-2.5">{orgMap[p.lenderId]?.shortName}</td>
                <td className="px-3 py-2.5">{PRODUCT_TYPE_LABEL[p.type]}</td>
                <td className="px-3 py-2.5">{vnd(p.eligibility.minAmount)} – {vnd(p.eligibility.maxAmount)}, ≤ {p.eligibility.maxTenorDays} ngày</td>
                <td className="px-3 py-2.5">{p.pricing.advancePct}% · {p.pricing.rateMin}–{p.pricing.rateMax}%/năm</td>
                <td className="px-3 py-2.5">v{p.version}</td>
                <td className="flex gap-1.5 px-3 py-2.5">
                  <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => approve(p.id, true)}>Duyệt</Button>
                  <Button size="sm" variant="danger" icon={<X className="size-4" />} onClick={() => { const note = prompt('Lý do từ chối (gửi cho tổ chức tài chính):'); if (note) void approve(p.id, false, note) }}>Từ chối</Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty title="Không có sản phẩm chờ duyệt" />}
      </Card>
      <Card title={`Đánh giá ESG (${assessments.length})`} subtitle="Mở hồ sơ để xác nhận mức từng chỉ tiêu dựa trên bằng chứng và đề xuất AI, rồi phát hành điểm chính thức">
        {assessments.length ? (
          <Table head={['Doanh nghiệp', 'Trạng thái', 'Điểm hiện tại', 'Bằng chứng', 'Kỳ', '']}>
            {assessments.map((a) => {
              const r = computeEsg(a.indicators, a.industryGroup)
              return (
                <tr key={a.id}>
                  <td className="px-3 py-2.5 font-medium">{orgMap[a.orgId]?.name}</td>
                  <td className="px-3 py-2.5"><Badge tone={a.status === 'official' ? 'good' : a.status === 'in_review' ? 'warn' : 'neutral'} icon={false}>{{ draft: 'Nháp', in_review: 'Chờ thẩm định', official: 'Chính thức', provisional: 'Tạm tính' }[a.status]}</Badge></td>
                  <td className="px-3 py-2.5">{r.score.toFixed(1)} (bao phủ {Math.round(r.coverage * 100)}%)</td>
                  <td className="px-3 py-2.5">{a.documents.length} tài liệu</td>
                  <td className="px-3 py-2.5 text-xs">{a.period}</td>
                  <td className="px-3 py-2.5"><Link className="text-brand-dark underline" to={`/esg/${a.orgId}`}>Thẩm định</Link></td>
                </tr>
              )
            })}
          </Table>
        ) : <Empty title="Chưa có doanh nghiệp nào bắt đầu đánh giá ESG" />}
      </Card>
    </div>
  )
}
