import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Leaf, Plus, Send, Sparkles, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useActiveOrg, useStore } from '../store'
import { useMatches, useOrgMap, useScores } from '../hooks'
import { Badge, Button, Callout, Card, Empty, Field, inputCls, Modal, SampleTag, Table, Tabs } from '../components/ui'
import { RatingBadge, StateBadge } from '../components/domain'
import { date, daysFromNow, vnd, num } from '../lib/format'
import { estimateCost, PRODUCT_TYPE_LABEL, tenorOf, type MatchResult } from '../domain/marketplace'
import { RATING_ORDER } from '../domain/credit'
import type { FinancingProduct, ProductType, Rating, Rfq } from '../domain/types'

export function Marketplace() {
  const org = useActiveOrg()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Marketplace tài chính</h1>
        <p className="text-[13px] text-ink-3">Khoản phải thu đã được bên mua xác nhận + điểm tín dụng + ESG → khớp sản phẩm do tổ chức tài chính công bố → lấy báo giá cạnh tranh, khóa một hồ sơ hoạt động. Giá hiển thị là biểu giá đối tác công bố, không phải báo giá.</p>
      </div>
      {org.type === 'supplier' && <SupplierMarket />}
      {org.type === 'buyer' && <BuyerMarket />}
      {org.type === 'lender' && <LenderMarket />}
    </div>
  )
}

// ======================= NHÀ CUNG CẤP =======================

function SupplierMarket() {
  const org = useActiveOrg()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'find' | 'rfq' | 'early' | 'catalog') ?? 'find'
  const rfqs = useStore(useShallow((s) => s.rfqs.filter((q) => q.sellerId === org.id)))
  const early = useStore((s) => s.earlyOffers)
  const receivables = useStore((s) => s.receivables)
  const myEarly = early.filter((o) => receivables.find((r) => r.id === o.receivableId)?.sellerId === org.id)
  return (
    <>
      <Tabs
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        items={[
          { value: 'find', label: 'Tìm nguồn vốn' },
          { value: 'rfq', label: `Yêu cầu báo giá (${rfqs.filter((q) => ['OPEN', 'RESPONDED'].includes(q.state)).length})` },
          { value: 'early', label: `Thanh toán sớm từ bên mua (${myEarly.filter((o) => o.state === 'OPEN').length})` },
          { value: 'catalog', label: 'Tất cả sản phẩm' },
        ]}
      />
      {tab === 'find' && <FindFunding />}
      {tab === 'rfq' && <RfqList rfqs={rfqs} />}
      {tab === 'early' && <EarlyList offers={myEarly} role="supplier" />}
      {tab === 'catalog' && <Catalog />}
    </>
  )
}

function FindFunding() {
  const org = useActiveOrg()
  const receivables = useStore((s) => s.receivables)
  const applications = useStore((s) => s.applications)
  const rfqs = useStore((s) => s.rfqs)
  const createRfq = useStore((s) => s.createRfq)
  const submitDirect = useStore((s) => s.submitDirect)
  const orgMap = useOrgMap()
  const sc = useScores()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const ready = receivables.filter((r) => r.sellerId === org.id && r.state === 'BUYER_CONFIRMED')
  const rid = params.get('r') && ready.some((r) => r.id === params.get('r')) ? params.get('r')! : ready[0]?.id
  const r = ready.find((x) => x.id === rid)
  const { eligible, ineligible } = useMatches(rid)
  const [picked, setPicked] = useState<string[]>([])
  const [err, setErr] = useState('')
  const busy = r && (applications.some((a) => a.receivableId === r.id && !['REJECTED', 'WITHDRAWN', 'SETTLED'].includes(a.state)) || rfqs.some((q) => q.receivableId === r.id && ['OPEN', 'RESPONDED'].includes(q.state)))
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]))

  if (!ready.length)
    return (
      <Empty title="Chưa có khoản phải thu đã được bên mua xác nhận" action={<Button onClick={() => nav('/invoices')}>Đến Hóa đơn</Button>}>
        Marketplace chỉ mở cho khoản phải thu ở trạng thái “Bên mua đã xác nhận”.
      </Empty>
    )
  const app = sc.application(r!.id)
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card title="Khoản phải thu" className="h-fit">
        <ul className="-mx-2 space-y-0.5">
          {ready.map((x) => (
            <li key={x.id}>
              <button onClick={() => { setParams({ r: x.id }); setPicked([]) }} className={clsx('w-full cursor-pointer rounded-lg px-2 py-2 text-left hover:bg-muted', x.id === rid && 'bg-brand-soft')}>
                <div className="flex justify-between text-[13px]"><b>{x.code}</b><span className="font-semibold">{vnd(x.amount)}</span></div>
                <div className="text-[11px] text-ink-3">{orgMap[x.buyerId].shortName} · hạn {date(x.dueDate)} · {tenorOf(x)} ngày</div>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px]">
          <div className="flex justify-between"><span className="text-ink-3">Điểm hồ sơ</span><RatingBadge score={app} provisional={!app.official} /></div>
          <div className="flex justify-between"><span className="text-ink-3">Bên mua</span><RatingBadge score={sc.buyer(r!.buyerId)} /></div>
          <div className="flex justify-between"><span className="text-ink-3">Bên bán</span><RatingBadge score={sc.supplier(org.id)} /></div>
          <div className="flex justify-between"><span className="text-ink-3">ESG</span><span className="font-semibold">{sc.esg(org.id)?.assessment.status === 'official' ? sc.esg(org.id)!.result.score.toFixed(0) : 'chưa chính thức'}</span></div>
        </div>
      </Card>

      <div className="space-y-4">
        {busy && <Callout tone="warn">{r!.code} đã có RFQ hoặc hồ sơ tài trợ đang hoạt động — không thể gửi thêm. <Link className="underline" to="/marketplace?tab=rfq">Xem RFQ</Link></Callout>}
        {err && <Callout tone="critical">{err}</Callout>}
        <Card
          title={`${eligible.length} sản phẩm phù hợp — sắp theo chi phí hiệu dụng`}
          subtitle={`${r!.code}: ${vnd(r!.amount)}, kỳ hạn còn ${tenorOf(r!)} ngày. Chọn tối đa 3 để gửi yêu cầu báo giá (chia sẻ gói tóm tắt).`}
          action={<Button variant="primary" icon={<Send className="size-4" />} disabled={!picked.length || !!busy} onClick={async () => { try { setErr(''); await createRfq(r!.id, picked); setPicked([]); setParams({ tab: 'rfq' }) } catch (e) { setErr((e as Error).message) } }}>Gửi RFQ ({picked.length}/3)</Button>}
        >
          {eligible.length ? (
            <div className="space-y-3">
              {eligible.map((m, i) => (
                <ProductMatch key={m.product.id} m={m} best={i === 0} picked={picked.includes(m.product.id)} onPick={() => toggle(m.product.id)} disabled={!!busy || (!picked.includes(m.product.id) && picked.length >= 3)} onDirect={async () => { try { setErr(''); await submitDirect(r!.id, m.product.id); nav(`/invoices/${r!.id}`) } catch (e) { setErr((e as Error).message) } }} />
              ))}
            </div>
          ) : (
            <Empty title="Không có sản phẩm phù hợp" />
          )}
        </Card>
        {ineligible.length > 0 && (
          <Card title={`Chưa phù hợp (${ineligible.length})`} subtitle="Lý do cụ thể giúp doanh nghiệp biết cần cải thiện gì">
            <ul className="divide-y divide-line">
              {ineligible.map((m) => (
                <li key={m.product.id} className="py-2.5 text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{m.product.name} <span className="text-ink-3">· {orgMap[m.product.lenderId].shortName}</span></span>
                    <span className="tabular text-ink-3">{m.product.pricing.rateMin}–{m.product.pricing.rateMax}%/năm</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">{m.reasons.map((x) => <li key={x} className="flex items-center gap-1 text-critical-ink"><XCircle className="size-3.5" /> {x}</li>)}</ul>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

function ProductMatch({ m, best, picked, onPick, disabled, onDirect }: { m: MatchResult; best: boolean; picked: boolean; onPick: () => void; disabled: boolean; onDirect: () => void }) {
  const orgMap = useOrgMap()
  const p = m.product
  const c = m.cost
  return (
    <div className={clsx('rounded-xl border p-3.5 transition-colors', picked ? 'border-brand bg-brand-soft/40' : 'border-line')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className={clsx('flex min-w-0 gap-3', disabled && !picked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
          <input type="checkbox" className="mt-1 size-4" checked={picked} disabled={disabled} onChange={onPick} aria-label={`Chọn ${p.name}`} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold">{p.name}</span>
              {best && <Badge tone="good">Chi phí thấp nhất</Badge>}
              {c.greenApplied && <Badge tone="good" icon={false}><Leaf className="size-3.5" /> Ưu đãi xanh −{c.greenDiscount}%</Badge>}
              {p.sample && <SampleTag />}
            </span>
            <span className="block text-[12.5px] text-ink-3">{orgMap[p.lenderId].name} · {PRODUCT_TYPE_LABEL[p.type]}</span>
          </span>
        </label>
        <div className="text-right">
          <div className="tabular text-lg font-bold">{num(c.rateMin, 2)}–{num(c.rateMax, 2)}%<span className="text-xs font-medium text-ink-3">/năm</span></div>
          <div className="tabular text-xs text-ink-3">chi phí hiệu dụng {num(c.effAprMin, 2)}–{num(c.effAprMax, 2)}%/năm</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-5">
        <Cell k={`Số tiền ứng (${p.pricing.advancePct}%)`} v={vnd(c.advance)} />
        <Cell k="Lãi ước tính" v={`${vnd(c.interestMin)}–${vnd(c.interestMax)}`} />
        <Cell k="Phí" v={vnd(c.fees)} />
        <Cell k="Thực nhận" v={vnd(c.netReceived)} />
        <Cell k="SLA" v={p.sla.reviewHours ? `thẩm định ≤ ${p.sla.reviewHours}h` : 'chưa cam kết'} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-good-ink">{m.fits.slice(0, 4).map((f) => <span key={f} className="flex items-center gap-1"><CheckCircle2 className="size-3.5" />{f}</span>)}</p>
        <Button size="sm" variant="ghost" onClick={onDirect} disabled={disabled && !picked}>Gửi hồ sơ trực tiếp →</Button>
      </div>
    </div>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-page px-2.5 py-1.5">
      <div className="text-[11px] text-ink-3">{k}</div>
      <div className="tabular font-semibold">{v}</div>
    </div>
  )
}

function RfqList({ rfqs }: { rfqs: Rfq[] }) {
  const receivables = useStore((s) => s.receivables)
  const products = useStore((s) => s.products)
  const simulateRfq = useStore((s) => s.simulateRfqResponses)
  const select = useStore((s) => s.selectQuote)
  const cancel = useStore((s) => s.cancelRfq)
  const orgMap = useOrgMap()
  const nav = useNavigate()
  const [err, setErr] = useState('')
  if (!rfqs.length) return <Empty title="Chưa có yêu cầu báo giá">Chọn sản phẩm ở tab “Tìm nguồn vốn” để gửi RFQ.</Empty>
  const simulate = (q: Rfq) => void simulateRfq(q.id)
  return (
    <div className="space-y-4">
      {err && <Callout tone="critical">{err}</Callout>}
      {rfqs.map((q) => {
        const r = receivables.find((x) => x.id === q.receivableId)!
        const tenor = Math.max(1, daysFromNow(r.dueDate))
        const quotes = q.responses.filter((x) => x.kind === 'quote').map((x) => {
          const adv = Math.round((r.amount * (x.advancePct ?? 0)) / 100)
          const interest = Math.round((adv * (x.ratePct ?? 0) * tenor) / 36500)
          const total = interest + (x.feesVnd ?? 0)
          return { ...x, adv, interest, total, apr: (total / Math.max(1, adv - (x.feesVnd ?? 0))) * (365 / tenor) * 100 }
        }).sort((a, b) => a.apr - b.apr)
        const pending = q.productIds.filter((pid) => !q.responses.some((x) => x.productId === pid))
        return (
          <Card key={q.id} title={<span className="flex flex-wrap items-center gap-2">{q.id} · {r.code} <StateBadge state={r.state} /> <Badge tone={q.state === 'SELECTED' ? 'good' : q.state === 'CANCELLED' ? 'neutral' : 'brand'} icon={false}>{q.state}</Badge></span>} subtitle={`${vnd(r.amount)} · bên mua ${orgMap[r.buyerId].shortName} · tạo ${date(q.createdAt)} · hạn ${date(q.expiresAt)}`}
            action={['OPEN', 'RESPONDED'].includes(q.state) && <><Button size="sm" onClick={() => simulate(q)} disabled={!pending.length} icon={<Sparkles className="size-4" />}>Mô phỏng phản hồi đối tác</Button><Button size="sm" variant="ghost" onClick={() => cancel(q.id)}>Hủy RFQ</Button></>}>
            {quotes.length ? (
              <Table head={['Tổ chức', 'Sản phẩm', 'Ứng', 'Lãi suất', 'Phí', 'Tổng chi phí', 'Hiệu dụng/năm', 'Điều kiện', '']}>
                {quotes.map((x, i) => (
                  <tr key={x.lenderId} className={clsx(q.selectedLenderId === x.lenderId && 'bg-good-soft')}>
                    <td className="px-3 py-2.5 font-medium">{orgMap[x.lenderId].shortName}{x.simulated && <span className="ml-1 text-[10px] text-warn-ink">(mô phỏng)</span>}</td>
                    <td className="min-w-40 !whitespace-normal px-3 py-2.5 text-ink-2">{products.find((p) => p.id === x.productId)?.name}</td>
                    <td className="px-3 py-2.5">{x.advancePct}% · {vnd(x.adv)}</td>
                    <td className="px-3 py-2.5 font-semibold">{num(x.ratePct ?? 0, 2)}%</td>
                    <td className="px-3 py-2.5">{vnd(x.feesVnd ?? 0)}</td>
                    <td className="px-3 py-2.5 font-semibold">{vnd(x.total)}</td>
                    <td className="px-3 py-2.5">{num(x.apr, 2)}% {i === 0 && <Badge tone="good">Tốt nhất</Badge>}</td>
                    <td className="min-w-40 max-w-48 !whitespace-normal px-3 py-2.5 text-xs text-ink-3">{x.conditions} · hiệu lực tới {date(x.validUntil)}</td>
                    <td className="px-3 py-2.5">{['OPEN', 'RESPONDED'].includes(q.state) && <Button size="sm" variant="primary" onClick={async () => { try { setErr(''); await select(q.id, x.lenderId); nav(`/invoices/${r.id}`) } catch (e) { setErr((e as Error).message) } }}>Chọn</Button>}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="text-[13px] text-ink-3">Chưa có báo giá.</p>
            )}
            {pending.length > 0 && ['OPEN', 'RESPONDED'].includes(q.state) && <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><Clock className="size-3.5" /> Đang chờ: {pending.map((pid) => orgMap[products.find((p) => p.id === pid)!.lenderId].shortName).join(', ')} (chuyển sang vai trò tổ chức tài chính để trả lời, hoặc mô phỏng)</p>}
            {q.responses.filter((x) => x.kind === 'decline').map((x) => <p key={x.lenderId} className="mt-1 text-xs text-critical-ink">{orgMap[x.lenderId].shortName} từ chối: {x.conditions}</p>)}
            <p className="mt-2 text-[11px] text-ink-3">Báo giá sơ bộ không ràng buộc. Khi chọn một đối tác: khóa khoản phải thu, chia sẻ bộ chứng từ đầy đủ cho đối tác đó và thu hồi quyền xem của các đối tác còn lại.</p>
          </Card>
        )
      })}
    </div>
  )
}

// ======================= BÊN MUA =======================

function BuyerMarket() {
  const org = useActiveOrg()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'early' | 'catalog') ?? 'early'
  const offers = useStore(useShallow((s) => s.earlyOffers.filter((o) => o.buyerId === org.id)))
  return (
    <>
      <Tabs value={tab} onChange={(v) => setParams({ tab: v })} items={[{ value: 'early', label: 'Chương trình thanh toán sớm' }, { value: 'catalog', label: 'Sản phẩm tài trợ cho nhà cung cấp' }]} />
      {tab === 'early' && <EarlyList offers={offers} role="buyer" />}
      {tab === 'catalog' && <Catalog />}
    </>
  )
}

function EarlyList({ offers, role }: { offers: ReturnType<typeof useStore.getState>['earlyOffers']; role: 'buyer' | 'supplier' }) {
  const org = useActiveOrg()
  const receivables = useStore((s) => s.receivables)
  const applications = useStore((s) => s.applications)
  const createOffer = useStore((s) => s.createEarlyOffer)
  const accept = useStore((s) => s.acceptEarlyOffer)
  const pay = useStore((s) => s.payEarlyOffer)
  const orgMap = useOrgMap()
  const [open, setOpen] = useState(false)
  const candidates = receivables.filter((r) => r.buyerId === org.id && r.state === 'BUYER_CONFIRMED' && !applications.some((a) => a.receivableId === r.id && !['REJECTED', 'WITHDRAWN'].includes(a.state)) && !offers.some((o) => o.receivableId === r.id && ['OPEN', 'ACCEPTED'].includes(o.state)))
  const [f, setF] = useState({ rid: '', apr: '12', payBy: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) })
  const sel = receivables.find((r) => r.id === (f.rid || candidates[0]?.id))
  const daysEarly = sel ? Math.max(0, Math.round((new Date(sel.dueDate).getTime() - new Date(f.payBy).getTime()) / 86_400_000)) : 0
  const disc = +((Number(f.apr) * daysEarly) / 365).toFixed(2)
  return (
    <Card
      title={role === 'buyer' ? 'Đề nghị thanh toán sớm (dynamic discounting)' : 'Đề nghị thanh toán sớm từ bên mua'}
      subtitle="Bên mua tự chuyển tiền cho nhà cung cấp; FCC chỉ ghi nhận thỏa thuận, chứng từ và đối soát. Không áp dụng cho khoản đang có hồ sơ tài trợ."
      action={role === 'buyer' && <Button variant="primary" icon={<Plus className="size-4" />} disabled={!candidates.length} onClick={() => setOpen(true)}>Tạo đề nghị</Button>}
    >
      {offers.length ? (
        <Table head={['Mã', 'Hóa đơn', role === 'buyer' ? 'Nhà cung cấp' : 'Bên mua', 'Giá trị', 'Chiết khấu', 'Thực trả', 'Trả trước ngày', 'Trạng thái', '']}>
          {offers.map((o) => {
            const r = receivables.find((x) => x.id === o.receivableId)!
            return (
              <tr key={o.id}>
                <td className="px-3 py-2.5 font-semibold">{o.id}</td>
                <td className="px-3 py-2.5">{r.code}</td>
                <td className="px-3 py-2.5">{orgMap[role === 'buyer' ? r.sellerId : r.buyerId].shortName}</td>
                <td className="px-3 py-2.5">{vnd(r.amount)}</td>
                <td className="px-3 py-2.5 font-semibold">{o.discountPct}% · {vnd((r.amount * o.discountPct) / 100)}</td>
                <td className="px-3 py-2.5">{vnd(r.amount * (1 - o.discountPct / 100))}</td>
                <td className="px-3 py-2.5">{date(o.payBy)}</td>
                <td className="px-3 py-2.5"><Badge tone={o.state === 'PAID' ? 'good' : o.state === 'OPEN' ? 'warn' : 'brand'} icon={false}>{{ OPEN: 'Chờ NCC đồng ý', ACCEPTED: 'NCC đã đồng ý', PAID: 'Đã thanh toán', EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy' }[o.state]}</Badge></td>
                <td className="px-3 py-2.5">
                  {role === 'supplier' && o.state === 'OPEN' && <Button size="sm" variant="primary" onClick={() => accept(o.id)}>Đồng ý</Button>}
                  {role === 'buyer' && o.state === 'ACCEPTED' && <Button size="sm" variant="primary" onClick={() => pay(o.id)}>Ghi nhận đã chuyển tiền</Button>}
                </td>
              </tr>
            )
          })}
        </Table>
      ) : (
        <Empty title="Chưa có đề nghị thanh toán sớm" />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Tạo đề nghị thanh toán sớm" footer={<><Button onClick={() => setOpen(false)}>Hủy</Button><Button variant="primary" disabled={!sel || daysEarly <= 0} onClick={() => { createOffer({ buyerId: org.id, receivableId: sel!.id, discountPct: disc, payBy: f.payBy }); setOpen(false) }}>Gửi nhà cung cấp</Button></>}>
        <div className="space-y-3">
          <Field label="Khoản phải trả đã xác nhận">
            <select className={inputCls} value={f.rid || candidates[0]?.id} onChange={(e) => setF({ ...f, rid: e.target.value })}>
              {candidates.map((r) => <option key={r.id} value={r.id}>{r.code} · {orgMap[r.sellerId].shortName} · {vnd(r.amount)} · hạn {date(r.dueDate)}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lãi suất chiết khấu (%/năm)"><input className={inputCls} value={f.apr} onChange={(e) => setF({ ...f, apr: e.target.value })} /></Field>
            <Field label="Thanh toán trước ngày"><input type="date" className={inputCls} value={f.payBy} onChange={(e) => setF({ ...f, payBy: e.target.value })} /></Field>
          </div>
          {sel && <Callout tone="brand">Trả sớm {daysEarly} ngày → chiết khấu <b>{disc}%</b> = {vnd((sel.amount * disc) / 100)}. Nhà cung cấp nhận {vnd(sel.amount * (1 - disc / 100))}.</Callout>}
        </div>
      </Modal>
    </Card>
  )
}

function Catalog() {
  const products = useStore(useShallow((s) => s.products.filter((p) => p.status === 'published')))
  const orgMap = useOrgMap()
  return (
    <Card title="Sản phẩm đang công bố" subtitle="Thông tin do tổ chức tài chính công bố; FCC chỉ kiểm tra trình bày, không thẩm định hay bảo đảm sản phẩm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => <ProductCard key={p.id} p={p} lender={orgMap[p.lenderId].shortName} />)}
      </div>
    </Card>
  )
}

function ProductCard({ p, lender, actions }: { p: FinancingProduct; lender: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-line p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 font-semibold">{p.name} {p.sample && <SampleTag />}</div>
          <div className="text-xs text-ink-3">{lender} · {PRODUCT_TYPE_LABEL[p.type]} · v{p.version}</div>
        </div>
        <div className="tabular whitespace-nowrap text-right text-lg font-bold">{num(p.pricing.rateMin, 1)}–{num(p.pricing.rateMax, 1)}%</div>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-2">{p.description}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-3">Ứng trước</dt><dd className="text-right font-medium">{p.pricing.advancePct}%</dd>
        <dt className="text-ink-3">Khoảng tài trợ</dt><dd className="text-right font-medium">{vnd(p.eligibility.minAmount)}–{vnd(p.eligibility.maxAmount)}</dd>
        <dt className="text-ink-3">Kỳ hạn tối đa</dt><dd className="text-right font-medium">{p.eligibility.maxTenorDays} ngày</dd>
        <dt className="text-ink-3">Xếp hạng tối thiểu</dt><dd className="text-right font-medium">{[p.eligibility.minSupplierRating && `NCC ${p.eligibility.minSupplierRating}`, p.eligibility.minBuyerRating && `BM ${p.eligibility.minBuyerRating}`, p.eligibility.minApplicationRating && `HS ${p.eligibility.minApplicationRating}`].filter(Boolean).join(' · ') || '—'}</dd>
        <dt className="text-ink-3">Phí</dt><dd className="text-right font-medium">{p.pricing.fees.length ? p.pricing.fees.map((f) => (f.kind === 'pct' ? `${f.value}%` : vnd(f.value))).join(' + ') : 'Không'}</dd>
        {p.greenRule && <><dt className="text-good-ink">Ưu đãi xanh</dt><dd className="text-right font-medium text-good-ink">−{p.greenRule.discountPct}% nếu ESG ≥ {p.greenRule.minEsg}</dd></>}
        {p.eligibility.minEsg !== undefined && <><dt className="text-ink-3">ESG tối thiểu</dt><dd className="text-right font-medium">{p.eligibility.minEsg}</dd></>}
      </dl>
      {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{actions}</div>}
    </div>
  )
}

// ======================= TỔ CHỨC TÀI CHÍNH =======================

function LenderMarket() {
  const org = useActiveOrg()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'products' | 'rfq' | 'market') ?? 'products'
  const products = useStore((s) => s.products)
  const rfqs = useStore((s) => s.rfqs)
  const myIds = products.filter((p) => p.lenderId === org.id).map((p) => p.id)
  const inbox = rfqs.filter((q) => q.productIds.some((p) => myIds.includes(p)))
  return (
    <>
      <Tabs value={tab} onChange={(v) => setParams({ tab: v })} items={[{ value: 'products', label: 'Sản phẩm của tôi' }, { value: 'rfq', label: `Hộp yêu cầu báo giá (${inbox.filter((q) => ['OPEN', 'RESPONDED'].includes(q.state) && !q.responses.some((r) => r.lenderId === org.id)).length})` }, { value: 'market', label: 'Toàn cảnh thị trường' }]} />
      {tab === 'products' && <MyProducts />}
      {tab === 'rfq' && <RfqInbox rfqs={inbox} />}
      {tab === 'market' && <MarketOverview />}
    </>
  )
}

function MyProducts() {
  const org = useActiveOrg()
  const products = useStore(useShallow((s) => s.products.filter((p) => p.lenderId === org.id)))
  const setStatus = useStore((s) => s.setProductStatus)
  const [edit, setEdit] = useState<FinancingProduct | null>(null)
  const blank: FinancingProduct = { id: `p-${Date.now()}`, lenderId: org.id, name: '', type: 'factoring_recourse', description: '', eligibility: { minAmount: 100_000_000, maxAmount: 3_000_000_000, maxTenorDays: 120, minSupplierRating: 'BB', requireBuyerConfirmation: true }, pricing: { advancePct: 80, rateMin: 7, rateMax: 8, fees: [], latePenaltyPct: 150 }, sla: { quoteHours: 8, reviewHours: 48 }, status: 'draft', version: 1, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10), sample: false }
  const STATUS = { draft: ['Nháp', 'neutral'], pending_review: ['Chờ FCC kiểm tra trình bày', 'warn'], published: ['Đang công bố', 'good'], paused: ['Tạm dừng', 'neutral'], expired: ['Hết hiệu lực', 'neutral'] } as const
  return (
    <Card title="Sản phẩm của tôi" action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit(blank)}>Tạo sản phẩm</Button>}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.id} p={p} lender={org.shortName} actions={<>
            <Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>
            <Button size="sm" onClick={() => setEdit(p)}>Sửa (tạo phiên bản mới)</Button>
            {p.status === 'draft' && <Button size="sm" variant="primary" onClick={() => setStatus(p.id, 'pending_review')}>Gửi FCC kiểm tra</Button>}
            {p.status === 'pending_review' && <Button size="sm" variant="primary" onClick={() => setStatus(p.id, 'published')}>FCC duyệt trình bày (mô phỏng)</Button>}
            {p.status === 'published' && <Button size="sm" onClick={() => setStatus(p.id, 'paused')}>Tạm dừng</Button>}
            {p.status === 'paused' && <Button size="sm" onClick={() => setStatus(p.id, 'published')}>Mở lại</Button>}
          </>} />
        ))}
      </div>
      {edit && <ProductForm initial={edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}

function ProductForm({ initial, onClose }: { initial: FinancingProduct; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertProduct)
  const [p, setP] = useState(initial)
  const e = p.eligibility
  const setE = (patch: Partial<FinancingProduct['eligibility']>) => setP({ ...p, eligibility: { ...e, ...patch } })
  const setPr = (patch: Partial<FinancingProduct['pricing']>) => setP({ ...p, pricing: { ...p.pricing, ...patch } })
  const ratings: (Rating | '')[] = ['', ...RATING_ORDER]
  return (
    <Modal open onClose={onClose} title={initial.name ? `Sửa ${initial.name}` : 'Tạo sản phẩm'} wide footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" disabled={!p.name} onClick={() => { upsert({ ...p, status: initial.status === 'published' ? 'pending_review' : p.status }); onClose() }}>Lưu</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên sản phẩm"><input className={inputCls} value={p.name} onChange={(x) => setP({ ...p, name: x.target.value })} /></Field>
        <Field label="Loại"><select className={inputCls} value={p.type} onChange={(x) => setP({ ...p, type: x.target.value as ProductType })}>{Object.entries(PRODUCT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="Mô tả"><input className={inputCls} value={p.description} onChange={(x) => setP({ ...p, description: x.target.value })} /></Field></div>
        <Field label="Tỷ lệ ứng trước (%)"><input className={inputCls} value={p.pricing.advancePct} onChange={(x) => setPr({ advancePct: Number(x.target.value) })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lãi suất min (%/năm)"><input className={inputCls} value={p.pricing.rateMin} onChange={(x) => setPr({ rateMin: Number(x.target.value) })} /></Field>
          <Field label="Lãi suất max"><input className={inputCls} value={p.pricing.rateMax} onChange={(x) => setPr({ rateMax: Number(x.target.value) })} /></Field>
        </div>
        <Field label="Phí xử lý (% số tiền ứng, thu trước)"><input className={inputCls} value={p.pricing.fees.find((f) => f.kind === 'pct')?.value ?? 0} onChange={(x) => setPr({ fees: [...p.pricing.fees.filter((f) => f.kind !== 'pct'), ...(Number(x.target.value) ? [{ name: 'Phí xử lý', kind: 'pct' as const, value: Number(x.target.value), upfront: true }] : [])] })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Số tiền tối thiểu"><input className={inputCls} value={e.minAmount} onChange={(x) => setE({ minAmount: Number(x.target.value) })} /></Field>
          <Field label="Tối đa"><input className={inputCls} value={e.maxAmount} onChange={(x) => setE({ maxAmount: Number(x.target.value) })} /></Field>
        </div>
        <Field label="Kỳ hạn tối đa (ngày)"><input className={inputCls} value={e.maxTenorDays} onChange={(x) => setE({ maxTenorDays: Number(x.target.value) })} /></Field>
        <div className="grid grid-cols-3 gap-2">
          {(['minSupplierRating', 'minBuyerRating', 'minApplicationRating'] as const).map((k) => (
            <Field key={k} label={{ minSupplierRating: 'XH NCC ≥', minBuyerRating: 'XH bên mua ≥', minApplicationRating: 'XH hồ sơ ≥' }[k]}>
              <select className={inputCls} value={e[k] ?? ''} onChange={(x) => setE({ [k]: (x.target.value || undefined) as Rating | undefined })}>{ratings.map((r) => <option key={r} value={r}>{r || '—'}</option>)}</select>
            </Field>
          ))}
        </div>
        <Field label="ESG tối thiểu (bỏ trống nếu không yêu cầu)"><input className={inputCls} value={e.minEsg ?? ''} onChange={(x) => setE({ minEsg: x.target.value ? Number(x.target.value) : undefined })} /></Field>
        <Field label="Ưu đãi xanh: giảm (%) khi ESG chính thức ≥ 70, Coverage ≥ 80%"><input className={inputCls} value={p.greenRule?.discountPct ?? ''} onChange={(x) => setP({ ...p, greenRule: x.target.value ? { minEsg: 70, minCoverage: 0.8, discountPct: Number(x.target.value) } : undefined })} /></Field>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={e.requireBuyerConfirmation} onChange={(x) => setE({ requireBuyerConfirmation: x.target.checked })} /> Yêu cầu bên mua xác nhận</label>
      </div>
    </Modal>
  )
}

function RfqInbox({ rfqs }: { rfqs: Rfq[] }) {
  const org = useActiveOrg()
  const receivables = useStore((s) => s.receivables)
  const products = useStore((s) => s.products)
  const respond = useStore((s) => s.respondRfq)
  const orgMap = useOrgMap()
  const sc = useScores()
  const [form, setForm] = useState<{ rfq: Rfq; pid: string; rate: string; adv: string; fees: string; cond: string } | null>(null)
  if (!rfqs.length) return <Empty title="Chưa có yêu cầu báo giá" />
  return (
    <Card title="Yêu cầu báo giá" subtitle="Bạn chỉ thấy gói tóm tắt (doanh nghiệp, xếp hạng, ESG, khoản phải thu). Bộ chứng từ đầy đủ chỉ mở khi doanh nghiệp chọn bạn.">
      <Table head={['RFQ', 'Nhà cung cấp', 'Bên mua', 'Giá trị', 'Kỳ hạn', 'Điểm hồ sơ', 'ESG', 'Trạng thái', '']}>
        {rfqs.map((q) => {
          const r = receivables.find((x) => x.id === q.receivableId)!
          const mine = q.responses.find((x) => x.lenderId === org.id)
          const pid = q.productIds.find((p) => products.find((x) => x.id === p)?.lenderId === org.id)!
          const prod = products.find((x) => x.id === pid)!
          const s = sc.application(r.id)
          const e = sc.esg(r.sellerId)
          const lost = q.state === 'SELECTED' && q.selectedLenderId !== org.id
          return (
            <tr key={q.id}>
              <td className="px-3 py-2.5 font-semibold">{q.id}</td>
              <td className="px-3 py-2.5">{lost ? <span className="text-ink-3">(đã thu hồi quyền xem)</span> : orgMap[r.sellerId].shortName}</td>
              <td className="px-3 py-2.5">{orgMap[r.buyerId].shortName}</td>
              <td className="px-3 py-2.5">{vnd(r.amount)}</td>
              <td className="px-3 py-2.5">{tenorOf(r)} ngày</td>
              <td className="px-3 py-2.5">{lost ? '—' : <RatingBadge score={s} />}</td>
              <td className="px-3 py-2.5">{lost ? '—' : e?.assessment.status === 'official' ? num(e.result.score, 0) : 'chưa'}</td>
              <td className="px-3 py-2.5">{q.state === 'SELECTED' ? (q.selectedLenderId === org.id ? <Badge tone="good">Được chọn</Badge> : <Badge tone="neutral" icon={false}>Chọn đối tác khác</Badge>) : mine ? <Badge tone="brand" icon={false}>Đã {mine.kind === 'quote' ? `báo ${mine.ratePct}%` : 'từ chối'}</Badge> : <Badge tone="warn">Chờ phản hồi</Badge>}</td>
              <td className="px-3 py-2.5">
                {['OPEN', 'RESPONDED'].includes(q.state) && !mine && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="primary" onClick={() => {
                      const bump = Math.max(0, RATING_ORDER.indexOf('AAA') - RATING_ORDER.indexOf(s.rating)) * 0.12
                      setForm({ rfq: q, pid, rate: Math.min(prod.pricing.rateMax, Math.round((prod.pricing.rateMin + bump) * 100) / 100).toString(), adv: String(prod.pricing.advancePct), fees: String(estimateCost(prod, r.amount, tenorOf(r)).fees), cond: 'Có truy đòi; bên mua thanh toán vào TK chuyên dùng' })
                    }}>Báo giá</Button>
                    <Button size="sm" variant="danger" onClick={() => respond(q.id, { productId: pid, kind: 'decline', conditions: 'Ngoài khẩu vị rủi ro hiện tại' })}>Từ chối</Button>
                  </div>
                )}
              </td>
            </tr>
          )
        })}
      </Table>
      <Modal open={!!form} onClose={() => setForm(null)} title={`Báo giá sơ bộ ${form?.rfq.id ?? ''}`} footer={<><Button onClick={() => setForm(null)}>Hủy</Button><Button variant="primary" onClick={() => { respond(form!.rfq.id, { productId: form!.pid, kind: 'quote', ratePct: Number(form!.rate), advancePct: Number(form!.adv), feesVnd: Number(form!.fees), conditions: form!.cond, validUntil: new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10) }); setForm(null) }}>Gửi báo giá</Button></>}>
        {form && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Callout tone="brand" title="Gợi ý từ biểu giá công bố">Lãi suất gợi ý = mức sàn sản phẩm + 0,12%/bậc xếp hạng dưới AAA. Bạn quyết định giá cuối cùng.</Callout>
            <div />
            <Field label="Lãi suất (%/năm)"><input className={inputCls} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
            <Field label="Tỷ lệ ứng (%)"><input className={inputCls} value={form.adv} onChange={(e) => setForm({ ...form, adv: e.target.value })} /></Field>
            <Field label="Phí (VND)"><input className={inputCls} value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} /></Field>
            <Field label="Điều kiện"><input className={inputCls} value={form.cond} onChange={(e) => setForm({ ...form, cond: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </Card>
  )
}

function MarketOverview() {
  const products = useStore(useShallow((s) => s.products.filter((p) => p.status === 'published')))
  const orgMap = useOrgMap()
  const byType = useMemo(() => {
    const m = new Map<ProductType, FinancingProduct[]>()
    for (const p of products) m.set(p.type, [...(m.get(p.type) ?? []), p])
    return [...m.entries()]
  }, [products])
  const all = products.flatMap((p) => [p.pricing.rateMin, p.pricing.rateMax])
  return (
    <Card title="Toàn cảnh thị trường" subtitle={`Khoảng lãi suất công bố ${Math.min(...all)}–${Math.max(...all)}%/năm trên ${products.length} sản phẩm. Chỉ dữ liệu công bố — không hiển thị báo giá riêng của đối tác khác.`}>
      <Table head={['Loại sản phẩm', 'Số sản phẩm', 'Lãi suất', 'Ứng trước', 'Kỳ hạn tối đa', 'Có ưu đãi xanh', 'Tổ chức']}>
        {byType.map(([t, ps]) => (
          <tr key={t}>
            <td className="px-3 py-2.5 font-medium">{PRODUCT_TYPE_LABEL[t]}</td>
            <td className="px-3 py-2.5">{ps.length}</td>
            <td className="px-3 py-2.5 font-semibold">{Math.min(...ps.map((p) => p.pricing.rateMin))}–{Math.max(...ps.map((p) => p.pricing.rateMax))}%</td>
            <td className="px-3 py-2.5">{Math.min(...ps.map((p) => p.pricing.advancePct))}–{Math.max(...ps.map((p) => p.pricing.advancePct))}%</td>
            <td className="px-3 py-2.5">{Math.max(...ps.map((p) => p.eligibility.maxTenorDays))} ngày</td>
            <td className="px-3 py-2.5">{ps.filter((p) => p.greenRule).length ? <Badge tone="good">{ps.filter((p) => p.greenRule).length}</Badge> : '—'}</td>
            <td className="px-3 py-2.5 text-ink-2">{[...new Set(ps.map((p) => orgMap[p.lenderId].shortName))].join(', ')}</td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}
