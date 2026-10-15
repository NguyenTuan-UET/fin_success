import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Banknote, Clock, Gauge, HandCoins, Leaf, Percent, Sparkles, Users, Wallet } from 'lucide-react'
import { useActiveOrg, useStore } from '../store'
import { hasConsent, useData, useForecast, useMatches, useOrgMap, useScores } from '../hooks'
import { Badge, Button, Callout, Card, Empty, Progress, Stat, Table } from '../components/ui'
import { EsgBadge, RatingBadge, StateBadge } from '../components/domain'
import { CashflowChart, HBar } from '../components/charts'
import { date, daysFromNow, median, pct, vnd, num } from '../lib/format'
import { INDUSTRY_RISK } from '../domain/credit'
import { ESG_BADGE } from '../domain/esg'
import { PRODUCT_TYPE_LABEL } from '../domain/marketplace'

export function Overview() {
  const org = useActiveOrg()
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Tổng quan</h1>
        <p className="text-[13px] text-ink-3">Số liệu tính từ dữ liệu trên FCC. Di chuột vào chỉ số để xem công thức và nguồn.</p>
      </div>
      {org.type === 'supplier' && <SupplierOverview />}
      {org.type === 'buyer' && <BuyerOverview />}
      {org.type === 'lender' && <LenderOverview />}
    </div>
  )
}

function SupplierOverview() {
  const org = useActiveOrg()
  const d = useData()
  const orgMap = useOrgMap()
  const limits = useStore((s) => s.limits)
  const products = useStore((s) => s.products)
  const sc = useScores()
  const nav = useNavigate()
  const mine = d.receivables.filter((r) => r.sellerId === org.id)
  const open = mine.filter((r) => ['BUYER_PENDING', 'BUYER_CONFIRMED', 'BUYER_DISPUTED', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'OVERDUE'].includes(r.state))
  const confirmed = open.filter((r) => !['BUYER_PENDING', 'BUYER_DISPUTED'].includes(r.state))
  const monthStart = new Date().toISOString().slice(0, 8) + '01'
  const early =
    d.applications.filter((a) => mine.some((r) => r.id === a.receivableId) && a.fundedAt && a.fundedAt >= monthStart).reduce((x, a) => x + (a.fundedAmount ?? 0), 0) +
    mine.filter((r) => r.state === 'EARLY_PAID' && r.paidAt && r.paidAt >= monthStart).reduce((x, r) => x + (r.paidAmount ?? 0), 0)
  const myLimits = limits.filter((l) => l.borrowerId === org.id && l.validUntil >= new Date().toISOString().slice(0, 10))
  const score = sc.supplier(org.id)
  const esg = sc.esg(org.id)
  const fc = useForecast(org.id)
  const candidate = mine.filter((r) => r.state === 'BUYER_CONFIRMED').sort((a, b) => b.amount - a.amount)[0]
  const matches = useMatches(candidate?.id)
  const best = matches.eligible[0]

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Khoản phải thu" value={vnd(open.reduce((a, r) => a + r.amount, 0))} sub={`${open.length} hóa đơn mở · ${vnd(confirmed.reduce((a, r) => a + r.amount, 0))} đã được bên mua xác nhận`} icon={<Wallet className="size-4" />} hint="Tổng khoản phải thu mở trên FCC; tách phần đã được bên mua xác nhận." />
        <Stat label="Nhận tiền sớm trong tháng" value={vnd(early)} sub="giải ngân + thanh toán sớm" icon={<HandCoins className="size-4" />} hint="Từ sự kiện giải ngân của đối tác và thanh toán sớm của bên mua trong tháng hiện tại." />
        <Stat label="Hạn mức tài trợ" value={myLimits.length ? vnd(myLimits.reduce((a, l) => a + l.amount, 0)) : 'Chưa có hạn mức'} sub={myLimits.length ? `từ ${myLimits.length} tổ chức tài chính` : undefined} icon={<Banknote className="size-4" />} hint="Chỉ tính hạn mức do tổ chức tài chính cấp và gửi về FCC; FCC không tự cấp hạn mức." />
        <Stat label="Điểm tín dụng tham khảo" value={<span className="flex items-baseline gap-2">{score.rating}<span className="text-base font-semibold text-ink-3">{num(score.score, 0)}/100</span></span>} sub={score.official ? <Badge tone="good">Chính thức</Badge> : <Badge tone="warn">Tạm tính</Badge>} icon={<Gauge className="size-4" />} hint="Xếp hạng tham khảo FCC theo 5C + dữ liệu thay thế; không phải quyết định tín dụng." />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Hóa đơn bán hàng" action={<Link to="/invoices" className="text-[13px] font-medium text-brand-dark hover:underline">Xem tất cả →</Link>}>
          <Table head={['Mã', 'Người mua', 'Số tiền', 'Hạn thanh toán', 'ESG bên mua', 'Trạng thái']}>
            {mine.slice(0, 6).map((r) => {
              const e = sc.esg(r.buyerId)
              return (
                <tr key={r.id} className="cursor-pointer hover:bg-page" onClick={() => nav(`/invoices/${r.id}`)}>
                  <td className="px-3 py-2.5 font-semibold text-brand-dark">{r.code}</td>
                  <td className="px-3 py-2.5">{orgMap[r.buyerId].shortName}</td>
                  <td className="px-3 py-2.5 font-medium">{vnd(r.amount)}</td>
                  <td className="px-3 py-2.5">{date(r.dueDate)}</td>
                  <td className="px-3 py-2.5"><EsgBadge score={e?.result.score} official={e?.assessment.status === 'official'} /></td>
                  <td className="px-3 py-2.5"><StateBadge state={r.state} /></td>
                </tr>
              )
            })}
          </Table>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card title={<span className="flex items-center gap-1.5"><Sparkles className="size-4 text-brand" /> Đề xuất tài trợ</span>}>
            {candidate && best ? (
              <div className="space-y-2 text-[13px]">
                <p>
                  Hóa đơn <b>{candidate.code}</b> ({vnd(candidate.amount)}, bên mua {orgMap[candidate.buyerId].shortName} đã xác nhận) phù hợp <b>{matches.eligible.length}</b> sản phẩm. Chi phí thấp nhất: <b>{best.product.name}</b> — {orgMap[best.product.lenderId].shortName}, ứng {best.product.pricing.advancePct}%, chi phí hiệu dụng ~{num(best.cost.effAprMin, 1)}%/năm{best.cost.greenApplied && ' (đã áp ưu đãi xanh)'}.
                </p>
                <p className="text-xs text-ink-3">Ước tính theo biểu giá công bố, không phải báo giá. Chỉ gợi ý — không phải lời khuyên vay.</p>
                <Button size="sm" variant="primary" onClick={() => nav(`/marketplace?r=${candidate.id}`)} icon={<ArrowRight className="size-4" />}>
                  So sánh & yêu cầu báo giá
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">Chưa có khoản phải thu đã xác nhận phù hợp sản phẩm nào. Gửi hóa đơn cho bên mua xác nhận để mở Marketplace.</p>
            )}
          </Card>
          <Card title="Cơ hội tài trợ" subtitle={candidate ? `cho ${candidate.code}` : undefined}>
            {matches.eligible.length ? (
              <ul className="space-y-2">
                {matches.eligible.slice(0, 3).map((m) => (
                  <li key={m.product.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{orgMap[m.product.lenderId].shortName}</div>
                      <div className="truncate text-xs text-ink-3">{PRODUCT_TYPE_LABEL[m.product.type]}</div>
                    </div>
                    <span className="tabular shrink-0 font-semibold">{num(m.cost.rateMin, 1)}–{num(m.cost.rateMax, 1)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-3">{products.length ? 'Không có sản phẩm phù hợp.' : 'Chưa có sản phẩm.'}</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Dự báo dòng tiền" subtitle={fc ? `Từ dữ liệu kế toán đã kết nối · dự báo, không phải cam kết` : undefined} action={<Link to="/accounting" className="text-[13px] font-medium text-brand-dark hover:underline">Chi tiết →</Link>}>
          {fc ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Thu dự kiến 7 ngày" value={vnd(fc.inflow.d7)} />
                <MiniStat label="Thu dự kiến 30 ngày" value={vnd(fc.inflow.d30)} />
                <MiniStat label="Chi dự kiến 30 ngày" value={vnd(fc.outflow.d30)} />
                <MiniStat label="Số dư thấp nhất (cơ sở)" value={vnd(fc.minBase.value)} tone={fc.minBase.value < 0 ? 'critical' : undefined} />
              </div>
              {fc.shortfall && (
                <Callout tone="critical" title={`Cảnh báo thiếu hụt tiền ngày ${date(fc.shortfall.date)} (kịch bản ${fc.shortfall.scenario === 'base' ? 'cơ sở' : 'thận trọng'})`}>
                  Số dư dự kiến {vnd(fc.shortfall.value)}. {candidate ? <>Có thể dùng <Link className="font-semibold underline" to={`/marketplace?r=${candidate.id}`}>{candidate.code}</Link> trên Marketplace để nhận tiền sớm.</> : 'Cân nhắc tài trợ khoản phải thu.'}
                </Callout>
              )}
              <CashflowChart points={fc.points.slice(0, 31)} height={200} />
            </div>
          ) : (
            <Empty title="Chưa kết nối phần mềm kế toán" action={<Button size="sm" variant="primary" onClick={() => nav('/accounting')}>Kết nối để xem dự báo</Button>}>
              Dự báo dòng tiền cần số dư tiền, chi phí định kỳ (bạn khai ở trang Kế toán) và công nợ. FCC không tự điền số liệu.
            </Empty>
          )}
        </Card>
        <Card title="ESG của doanh nghiệp" action={<Link to="/esg" className="text-[13px] font-medium text-brand-dark hover:underline">Chi tiết →</Link>}>
          {esg ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold">{num(esg.result.score, 0)}</span>
                <span className="text-sm text-ink-3">/100 · {esg.result.level} ({ESG_BADGE[esg.result.level]})</span>
              </div>
              {esg.assessment.status !== 'official' && <Badge tone="warn">Chưa phát hành chính thức · Coverage {pct(esg.result.coverage, 0)}</Badge>}
              <PillarBars pillars={esg.result.pillars} />
            </div>
          ) : (
            <Empty title="Chưa đánh giá ESG" action={<Button size="sm" onClick={() => nav('/esg')}>Bắt đầu đánh giá</Button>} />
          )}
        </Card>
      </div>
    </>
  )
}

export function PillarBars({ pillars }: { pillars: { E: number | null; S: number | null; G: number | null } }) {
  const rows = [
    { k: 'E', label: 'Môi trường', v: pillars.E },
    { k: 'S', label: 'Xã hội', v: pillars.S },
    { k: 'G', label: 'Quản trị', v: pillars.G },
  ]
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.k}>
          <div className="mb-1 flex justify-between text-[13px]">
            <span className="text-ink-2">{r.label}</span>
            <span className="tabular font-semibold">{r.v === null ? '—' : num(r.v, 0)}</span>
          </div>
          <Progress value={r.v ?? 0} tone={r.v === null ? 'warn' : r.v >= 65 ? 'good' : r.v >= 50 ? 'brand' : 'critical'} label={r.label} />
        </div>
      ))}
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'critical' }) {
  return (
    <div className="rounded-lg bg-page px-3 py-2">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={`tabular text-[15px] font-bold ${tone === 'critical' ? 'text-critical-ink' : ''}`}>{value}</div>
    </div>
  )
}

function BuyerOverview() {
  const org = useActiveOrg()
  const d = useData()
  const orgMap = useOrgMap()
  const consents = useStore((s) => s.consents)
  const earlyOffers = useStore((s) => s.earlyOffers)
  const sc = useScores()
  const nav = useNavigate()
  const fc = useForecast(org.id)
  const mine = d.receivables.filter((r) => r.buyerId === org.id)
  const payable = mine.filter((r) => ['BUYER_CONFIRMED', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'FUNDED', 'OVERDUE'].includes(r.state))
  const due30 = payable.filter((r) => daysFromNow(r.dueDate) <= 30)
  const pending = mine.filter((r) => r.state === 'BUYER_PENDING')
  const paid = mine.filter((r) => r.paidAt)
  const dpo = paid.length ? median(paid.map((r) => (new Date(r.paidAt!).getTime() - new Date(r.issueDate).getTime()) / 86_400_000)) : null
  const activeSuppliers = new Set(mine.filter((r) => daysFromNow(r.issueDate) >= -90).map((r) => r.sellerId))
  const openOffers = earlyOffers.filter((o) => o.buyerId === org.id && ['OPEN', 'ACCEPTED'].includes(o.state))
  const discountPotential = openOffers.reduce((a, o) => a + (mine.find((r) => r.id === o.receivableId)?.amount ?? 0) * (o.discountPct / 100), 0)
  const supplierIds = [...new Set(mine.map((r) => r.sellerId))]
  const supplierEsg = supplierIds.map((id) => ({ id, esg: hasConsent(consents, id, org.id, 'esg') ? sc.esg(id) : undefined, spend: mine.filter((r) => r.sellerId === id).reduce((a, r) => a + r.amount, 0) }))
  const official = supplierEsg.filter((x) => x.esg?.assessment.status === 'official')
  const wEsg = official.length ? official.reduce((a, x) => a + x.esg!.result.score * x.spend, 0) / official.reduce((a, x) => a + x.spend, 0) : null
  const green = official.filter((x) => x.esg!.result.score >= 65 && x.esg!.result.flags.length === 0).length
  const pil = (k: 'E' | 'S' | 'G') => (official.length ? official.reduce((a, x) => a + (x.esg!.result.pillars[k] ?? 0) * x.spend, 0) / official.reduce((a, x) => a + x.spend, 0) : null)
  const own = sc.buyer(org.id)
  // gợi ý thanh toán sớm khi dự báo dư tiền
  const surplus = fc && fc.minBase.value > 0 ? fc.minBase.value : 0
  const earlyCandidate = payable.filter((r) => r.state === 'BUYER_CONFIRMED' && !earlyOffers.some((o) => o.receivableId === r.id && o.state !== 'CANCELLED') && daysFromNow(r.dueDate) > 14).sort((a, b) => b.amount - a.amount)[0]

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tổng phải trả đã xác nhận" value={vnd(payable.reduce((a, r) => a + r.amount, 0))} sub={`${due30.length} hóa đơn đến hạn trong 30 ngày`} icon={<Wallet className="size-4" />} hint="Nghĩa vụ bên mua đã xác nhận trên FCC và chưa thanh toán." />
        <Stat label="Chiết khấu thanh toán sớm" value={vnd(discountPotential)} sub={`${openOffers.length} đề nghị đang mở`} icon={<Percent className="size-4" />} hint="Tổng chiết khấu nhận được từ các đề nghị thanh toán sớm còn hiệu lực." />
        <Stat label="Kỳ trả tiền (DPO)" value={dpo === null ? '—' : `${num(dpo, 0)} ngày`} sub="trung vị, hóa đơn trên FCC" icon={<Clock className="size-4" />} hint="Trung vị số ngày từ phát hành đến thanh toán của các hóa đơn đã thanh toán trên FCC." />
        <Stat label="Nhà cung cấp hoạt động" value={activeSuppliers.size} sub="có giao dịch 90 ngày" icon={<Users className="size-4" />} />
      </div>

      {pending.length > 0 && (
        <Callout tone="warn" title={`${pending.length} khoản phải trả đang chờ bạn xác nhận`}>
          {pending.map((r) => (
            <Link key={r.id} to={`/invoices/${r.id}`} className="mr-3 font-semibold underline">
              {r.code} · {orgMap[r.sellerId].shortName} · {vnd(r.amount)}
            </Link>
          ))}
        </Callout>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Hóa đơn mua hàng" action={<Link to="/invoices" className="text-[13px] font-medium text-brand-dark hover:underline">Xem tất cả →</Link>}>
          <Table head={['Mã', 'Nhà cung cấp', 'Số tiền', 'Hạn', 'ESG NCC', 'Trạng thái']}>
            {mine.slice(0, 7).map((r) => {
              const e = hasConsent(consents, r.sellerId, org.id, 'esg') ? sc.esg(r.sellerId) : undefined
              return (
                <tr key={r.id} className="cursor-pointer hover:bg-page" onClick={() => nav(`/invoices/${r.id}`)}>
                  <td className="px-3 py-2.5 font-semibold text-brand-dark">{r.code}</td>
                  <td className="px-3 py-2.5">{orgMap[r.sellerId].shortName}</td>
                  <td className="px-3 py-2.5 font-medium">{vnd(r.amount)}</td>
                  <td className="px-3 py-2.5">{date(r.dueDate)}</td>
                  <td className="px-3 py-2.5">{e ? <EsgBadge score={e.result.score} official={e.assessment.status === 'official'} /> : <span className="text-xs text-ink-3">Chưa chia sẻ</span>}</td>
                  <td className="px-3 py-2.5"><StateBadge state={r.state} /></td>
                </tr>
              )
            })}
          </Table>
        </Card>
        <div className="min-w-0 space-y-4">
          <Card title={<span className="flex items-center gap-1.5"><Sparkles className="size-4 text-brand" /> Đề xuất</span>}>
            {earlyCandidate ? (
              <div className="space-y-2 text-[13px]">
                <p>
                  {fc ? <>Dự báo số dư thấp nhất 90 ngày là <b>{vnd(surplus)}</b>. </> : null}
                  Thanh toán sớm <b>{earlyCandidate.code}</b> của {orgMap[earlyCandidate.sellerId].shortName} ({vnd(earlyCandidate.amount)}, còn {daysFromNow(earlyCandidate.dueDate)} ngày) với chiết khấu ~{((12 * daysFromNow(earlyCandidate.dueDate)) / 365).toFixed(1)}% (12%/năm) giúp tiết kiệm ~{vnd((earlyCandidate.amount * 0.12 * daysFromNow(earlyCandidate.dueDate)) / 365)} và hỗ trợ thanh khoản nhà cung cấp.
                </p>
                <Button size="sm" variant="primary" onClick={() => nav('/marketplace?tab=early')}>Tạo đề nghị thanh toán sớm</Button>
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">Không có gợi ý mới.</p>
            )}
          </Card>
          <Card title="ESG – Chuỗi cung ứng" action={<Link to="/esg" className="text-[13px] font-medium text-brand-dark hover:underline">Chi tiết →</Link>}>
            {wEsg !== null ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold">{num(wEsg, 0)}</span>
                  <span className="text-[13px] text-ink-3">điểm bình quân gia quyền theo giá trị mua</span>
                </div>
                <PillarBars pillars={{ E: pil('E'), S: pil('S'), G: pil('G') }} />
                <p className="flex items-center gap-1.5 text-[13px]">
                  <Leaf className="size-4 text-good-ink" aria-hidden /> Nhà cung cấp xanh: <b>{green}/{supplierIds.length}</b>
                </p>
                <p className="text-[11px] text-ink-3">Chỉ gồm {official.length} nhà cung cấp có điểm ESG chính thức và đồng ý chia sẻ với {org.shortName}.</p>
              </div>
            ) : (
              <Empty title="Chưa có dữ liệu ESG nhà cung cấp">Nhà cung cấp cần có điểm chính thức và đồng ý chia sẻ.</Empty>
            )}
          </Card>
          <Card title="Xếp hạng bên mua (anchor)">
            <div className="flex items-center justify-between">
              <RatingBadge score={own} provisional={!own.official} />
              <Link to="/credit" className="text-[13px] font-medium text-brand-dark hover:underline">Xem chấm điểm →</Link>
            </div>
            <p className="mt-2 text-xs text-ink-3">{org.listedSymbol ? `Niêm yết ${org.exchange}: ${org.listedSymbol} — dữ liệu tài chính qua vnstock.` : 'Chưa niêm yết — chấm từ BCTC doanh nghiệp cung cấp.'} Xếp hạng tốt giúp nhà cung cấp của bạn được tài trợ rẻ hơn.</p>
          </Card>
        </div>
      </div>
    </>
  )
}

function LenderOverview() {
  const org = useActiveOrg()
  const d = useData()
  const orgMap = useOrgMap()
  const rfqs = useStore((s) => s.rfqs)
  const products = useStore((s) => s.products)
  const sc = useScores()
  const nav = useNavigate()
  const apps = d.applications.filter((a) => a.lenderId === org.id)
  const funded = apps.filter((a) => a.state === 'FUNDED')
  const outstanding = funded.reduce((a, x) => a + (x.fundedAmount ?? 0), 0)
  const avgRate = outstanding ? funded.reduce((a, x) => a + (x.offer?.ratePct ?? 0) * (x.fundedAmount ?? 0), 0) / outstanding : null
  const review = apps.filter((a) => a.decidedAt).map((a) => (new Date(a.decidedAt!).getTime() - new Date(a.submittedAt).getTime()) / 86_400_000)
  const sellers = new Set(apps.filter((a) => a.fundedAt).map((a) => d.receivables.find((r) => r.id === a.receivableId)?.sellerId))
  const queue = apps.filter((a) => ['SUBMITTED', 'UNDER_REVIEW'].includes(a.state))
  const myProducts = products.filter((p) => p.lenderId === org.id).map((p) => p.id)
  const openRfqs = rfqs.filter((q) => q.state !== 'SELECTED' && q.state !== 'CANCELLED' && q.productIds.some((p) => myProducts.includes(p)) && !q.responses.some((x) => x.lenderId === org.id))
  const byIndustry = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of apps.filter((x) => x.fundedAt)) {
      const r = d.receivables.find((x) => x.id === a.receivableId)!
      const s = orgMap[r.sellerId]
      const label = INDUSTRY_RISK[s.vsic.slice(0, 2)]?.label ?? s.industryLabel
      m.set(label, (m.get(label) ?? 0) + (a.fundedAmount ?? 0))
    }
    return [...m.entries()].map(([label, value]) => ({ label, value, sub: 'Giá trị đã giải ngân' })).sort((a, b) => b.value - a.value)
  }, [apps, d.receivables, orgMap])
  const recommended = [...queue.map((a) => ({ kind: 'app' as const, id: a.id, rid: a.receivableId })), ...openRfqs.map((q) => ({ kind: 'rfq' as const, id: q.id, rid: q.receivableId }))]
    .map((x) => ({ ...x, score: sc.application(x.rid) }))
    .sort((a, b) => b.score.score - a.score.score)
  const greens = recommended.filter((x) => {
    const r = d.receivables.find((y) => y.id === x.rid)!
    const e = sc.esg(r.sellerId)
    return e?.assessment.status === 'official' && e.result.score >= 65
  })

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tổng dư nợ" value={vnd(outstanding)} sub={`${funded.length} khoản đang hoạt động`} icon={<Wallet className="size-4" />} hint="Tính từ sự kiện giải ngân/thu hồi của chính tổ chức." />
        <Stat label="Lãi suất bình quân" value={avgRate === null ? '—' : `${num(avgRate, 2)}%`} sub="gia quyền theo dư nợ" icon={<Percent className="size-4" />} />
        <Stat label="Thời gian thẩm định" value={review.length ? `${num(median(review), 1)} ngày` : '—'} sub="trung vị, nhận hồ sơ → quyết định" icon={<Clock className="size-4" />} />
        <Stat label="SME được tài trợ" value={sellers.size} sub="có giải ngân" icon={<Users className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Hồ sơ & yêu cầu báo giá chờ xử lý" action={<Link to="/invoices" className="text-[13px] font-medium text-brand-dark hover:underline">Hàng đợi →</Link>}>
          {recommended.length ? (
            <Table head={['Mã', 'Nhà cung cấp', 'Số tiền', 'Người mua', 'Điểm hồ sơ', 'ESG', 'Loại']}>
              {recommended.map((x) => {
                const r = d.receivables.find((y) => y.id === x.rid)!
                const e = sc.esg(r.sellerId)
                return (
                  <tr key={x.id} className="cursor-pointer hover:bg-page" onClick={() => nav(x.kind === 'app' ? `/invoices/${r.id}` : '/marketplace?tab=rfq')}>
                    <td className="px-3 py-2.5 font-semibold text-brand-dark">{x.id}</td>
                    <td className="px-3 py-2.5">{orgMap[r.sellerId].shortName}</td>
                    <td className="px-3 py-2.5 font-medium">{vnd(r.amount)}</td>
                    <td className="px-3 py-2.5">{orgMap[r.buyerId].shortName}</td>
                    <td className="px-3 py-2.5"><RatingBadge score={x.score} /></td>
                    <td className="px-3 py-2.5"><EsgBadge score={e?.result.score} official={e?.assessment.status === 'official'} /></td>
                    <td className="px-3 py-2.5">{x.kind === 'app' ? <Badge tone="brand" icon={false}>Hồ sơ</Badge> : <Badge tone="warn" icon={false}>RFQ</Badge>}</td>
                  </tr>
                )
              })}
            </Table>
          ) : (
            <Empty title="Không có hồ sơ chờ xử lý" />
          )}
        </Card>
        <div className="min-w-0 space-y-4">
          <Card title={<span className="flex items-center gap-1.5"><Sparkles className="size-4 text-brand" /> Phân tích ưu tiên</span>}>
            {recommended[0] ? (
              <p className="text-[13px]">
                <b>{recommended[0].id}</b> có điểm hồ sơ cao nhất ({recommended[0].score.rating}, {num(recommended[0].score.score, 0)}) — nhóm {recommended[0].score.segment.toUpperCase()}; bên mua {orgMap[d.receivables.find((r) => r.id === recommended[0].rid)!.buyerId].shortName}. Xếp hạng chỉ hỗ trợ sắp hàng đợi; quyết định thuộc tổ chức của bạn.
              </p>
            ) : (
              <p className="text-[13px] text-ink-3">—</p>
            )}
          </Card>
          <Card title="Phân phối dư nợ theo ngành" subtitle="Giá trị đã giải ngân">
            {byIndustry.length ? <HBar data={byIndustry} /> : <Empty title="Chưa có giải ngân" />}
          </Card>
          <Card title={<span className="flex items-center gap-1.5"><Leaf className="size-4 text-good-ink" /> Ưu tiên tài trợ xanh</span>}>
            {greens.length ? (
              <ul className="space-y-1.5 text-[13px]">
                {greens.map((x) => {
                  const r = d.receivables.find((y) => y.id === x.rid)!
                  return (
                    <li key={x.id} className="flex justify-between gap-2">
                      <span>{x.id} · {orgMap[r.sellerId].shortName}</span>
                      <EsgBadge score={sc.esg(r.sellerId)?.result.score} />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-3">Không có hồ sơ đạt ESG chính thức ≥ 65.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
