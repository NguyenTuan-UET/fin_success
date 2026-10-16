import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCode2, ImageUp, PenLine, Plus, Search } from 'lucide-react'
import { useActiveOrg, useStore } from '../store'
import { useOrgMap, useScores } from '../hooks'
import { AiTag, Badge, Button, Callout, Card, Empty, Field, inputCls, Modal, Table, Tabs } from '../components/ui'
import { EsgBadge, RatingBadge, STATE_META, StateBadge } from '../components/domain'
import { date, vnd } from '../lib/format'
import { invoiceFingerprint, parseEInvoiceXml, type ParsedInvoice } from '../lib/einvoice'
import { extractInvoice, fileToImage, type AiOutcome, type ExtractedInvoice } from '../lib/ai'
import type { ReceivableState } from '@fcc/domain/types'

export function Invoices() {
  const org = useActiveOrg()
  return org.type === 'lender' ? <LenderQueue /> : <InvoiceList />
}

function InvoiceList() {
  const org = useActiveOrg()
  const receivables = useStore((s) => s.receivables)
  const orgMap = useOrgMap()
  const sc = useScores()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'action' | 'open' | 'done'>('all')
  const [creating, setCreating] = useState(false)
  const isSeller = org.type === 'supplier'
  const mine = receivables.filter((r) => (isSeller ? r.sellerId === org.id : r.buyerId === org.id))
  const needAction = (s: ReceivableState) => (isSeller ? ['DRAFT', 'BUYER_DISPUTED', 'BUYER_CONFIRMED', 'OFFERED'].includes(s) : s === 'BUYER_PENDING')
  const rows = mine
    .filter((r) => filter === 'all' || (filter === 'action' && needAction(r.state)) || (filter === 'done' && ['SETTLED', 'EARLY_PAID', 'CANCELLED'].includes(r.state)) || (filter === 'open' && !['SETTLED', 'EARLY_PAID', 'CANCELLED'].includes(r.state)))
    .filter((r) => !q || `${r.code} ${r.invoiceNumber} ${orgMap[r.buyerId].name} ${orgMap[r.sellerId].name} ${r.description}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{isSeller ? 'Hóa đơn bán hàng & khoản phải thu' : 'Hóa đơn mua hàng & khoản phải trả'}</h1>
          <p className="text-[13px] text-ink-3">Vòng đời: nháp → bên mua xác nhận → Marketplace → thẩm định → giải ngân → tất toán. Mọi thay đổi được ghi nhật ký.</p>
        </div>
        {isSeller && (
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Tạo khoản phải thu
          </Button>
        )}
      </div>
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Tabs
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: `Tất cả (${mine.length})` },
              { value: 'action', label: `Cần xử lý (${mine.filter((r) => needAction(r.state)).length})` },
              { value: 'open', label: 'Đang mở' },
              { value: 'done', label: 'Đã đóng' },
            ]}
          />
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input aria-label="Tìm kiếm" className={`${inputCls} pl-9`} placeholder="Tìm mã, đối tác, nội dung…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Table head={['Mã', 'Số HĐ', isSeller ? 'Người mua' : 'Nhà cung cấp', 'Số tiền', 'Ngày phát hành', 'Hạn thanh toán', isSeller ? 'Xếp hạng bên mua' : 'ESG NCC', 'Trạng thái']} empty={rows.length === 0 && <div className="pt-3"><Empty title="Không có hóa đơn phù hợp" /></div>}>
          {rows.map((r) => {
            const cp = isSeller ? r.buyerId : r.sellerId
            const e = sc.esg(cp)
            return (
              <tr key={r.id} className="cursor-pointer hover:bg-page" onClick={() => nav(`/invoices/${r.id}`)}>
                <td className="px-3 py-2.5 font-semibold text-brand-dark">{r.code}</td>
                <td className="px-3 py-2.5 text-ink-2">{r.invoiceSeries}-{r.invoiceNumber}</td>
                <td className="px-3 py-2.5">{orgMap[cp].shortName}</td>
                <td className="px-3 py-2.5 font-medium">{vnd(r.amount)}</td>
                <td className="px-3 py-2.5">{date(r.issueDate)}</td>
                <td className="px-3 py-2.5">{date(r.dueDate)}</td>
                <td className="px-3 py-2.5">{isSeller ? <RatingBadge score={sc.buyer(cp)} /> : <EsgBadge score={e?.result.score} official={e?.assessment.status === 'official'} />}</td>
                <td className="px-3 py-2.5"><StateBadge state={r.state} /></td>
              </tr>
            )
          })}
        </Table>
      </Card>
      {creating && <CreateReceivable onClose={() => setCreating(false)} />}
    </div>
  )
}

function CreateReceivable({ onClose }: { onClose: () => void }) {
  const org = useActiveOrg()
  const orgs = useStore((s) => s.orgs)
  const receivables = useStore((s) => s.receivables)
  const create = useStore((s) => s.createReceivable)
  const sendToBuyer = useStore((s) => s.sendToBuyer)
  const nav = useNavigate()
  const buyers = orgs.filter((o) => o.type === 'buyer')
  const [mode, setMode] = useState<'xml' | 'ocr' | 'manual'>('xml')
  const [form, setForm] = useState({ buyerId: buyers[0]?.id ?? '', series: '', number: '', issueDate: new Date().toISOString().slice(0, 10), dueDate: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), amount: '', description: '', contract: true, delivery: false, lookupCode: '' })
  const [source, setSource] = useState<'xml' | 'ocr' | 'manual'>('manual')
  const [err, setErr] = useState('')
  const [warn, setWarn] = useState('')
  const [ai, setAi] = useState<AiOutcome<ExtractedInvoice> | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const applyParsed = (p: ParsedInvoice | ExtractedInvoice, src: 'xml' | 'ocr') => {
    const pi = p as ParsedInvoice & ExtractedInvoice
    const buyer = orgs.find((o) => o.taxCode === pi.buyerTaxCode)
    if (pi.sellerTaxCode && pi.sellerTaxCode !== org.taxCode) setWarn(`MST người bán trên hóa đơn (${pi.sellerTaxCode}) khác MST của ${org.shortName} (${org.taxCode}).`)
    else setWarn(buyer ? '' : `Không tìm thấy bên mua MST ${pi.buyerTaxCode ?? '?'} trên FCC — chọn thủ công hoặc mời bên mua tham gia.`)
    setForm((f) => ({ ...f, buyerId: buyer?.id ?? f.buyerId, series: pi.series ?? f.series, number: pi.number ?? f.number, issueDate: pi.issueDate || f.issueDate, amount: String(pi.total ?? ''), description: pi.description ?? f.description, lookupCode: pi.lookupCode ?? '' }))
    setSource(src)
  }

  const onXml = async (file: File) => {
    setErr('')
    try {
      applyParsed(parseEInvoiceXml(await file.text()), 'xml')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }
  const onImage = async (file: File) => {
    setErr('')
    setBusy(true)
    try {
      const img = await fileToImage(file)
      const out = await extractInvoice(img.base64)
      setAi(out)
      applyParsed(out.data, 'ocr')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }
  const submit = async (send: boolean) => {
    const amount = Number(String(form.amount).replace(/\D/g, ''))
    if (!form.number || !amount) return setErr('Cần số hóa đơn và số tiền')
    if (form.dueDate <= form.issueDate) return setErr('Hạn thanh toán phải sau ngày phát hành')
    const fp = await invoiceFingerprint({ sellerTaxCode: org.taxCode, series: form.series, number: form.number, issueDate: form.issueDate, lookupCode: form.lookupCode })
    const dup = receivables.find((r) => r.fingerprint === fp && r.state !== 'CANCELLED')
    if (dup) return setErr(`Trùng khoản phải thu ${dup.code} (cùng MST bán, ký hiệu, số, ngày). Hồ sơ trùng được đưa vào review — không tạo mới.`)
    let r
    try {
      r = await create({ buyerId: form.buyerId, invoiceSeries: form.series, invoiceNumber: form.number, issueDate: form.issueDate, dueDate: form.dueDate, amount, description: form.description || 'Hàng hóa/dịch vụ', fingerprint: fp, docs: { xml: source === 'xml', contract: form.contract, delivery: form.delivery }, source })
      if (send) await sendToBuyer(r.id)
    } catch (e) {
      return setErr((e as Error).message)
    }
    onClose()
    nav(`/invoices/${r.id}`)
  }

  return (
    <Modal open onClose={onClose} title="Tạo khoản phải thu" wide footer={<><Button onClick={() => submit(false)}>Lưu nháp</Button><Button variant="primary" onClick={() => submit(true)}>Lưu & gửi bên mua xác nhận</Button></>}>
      <div className="space-y-4">
        <Tabs value={mode} onChange={setMode} items={[{ value: 'xml', label: <span className="flex items-center gap-1.5"><FileCode2 className="size-4" />XML hóa đơn điện tử</span> }, { value: 'ocr', label: <span className="flex items-center gap-1.5"><ImageUp className="size-4" />Ảnh/PDF (AI OCR)</span> }, { value: 'manual', label: <span className="flex items-center gap-1.5"><PenLine className="size-4" />Nhập tay</span> }]} />
        {mode === 'xml' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-brand bg-brand-soft px-4 text-sm font-medium text-brand-dark">Chọn file XML…</span>
              <input type="file" accept=".xml,application/xml,text/xml" className="sr-only" onChange={(e) => e.target.files?.[0] && onXml(e.target.files[0])} />
            </label>
            <p className="w-full text-xs text-ink-3">Ưu tiên XML gốc: trích xuất chính xác, có mã CQT để chống trùng. Chưa tra cứu cổng hóa đơn của cơ quan thuế → trạng thái “chưa xác minh với nguồn bên ngoài”.</p>
          </div>
        )}
        {mode === 'ocr' && (
          <div className="space-y-2">
            <label className="cursor-pointer">
              <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-brand bg-brand-soft px-4 text-sm font-medium text-brand-dark">{busy ? 'Đang đọc bằng AI…' : 'Chọn ảnh hoặc PDF hóa đơn…'}</span>
              <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
            </label>
            {ai && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <AiTag />
                <span className="text-ink-3">{ai.model} · {ai.ms} ms · độ tin cậy {ai.data.confidence ?? '?'}</span>
              </div>
            )}
            <Callout tone="warn">Kết quả OCR phải được người dùng kiểm tra; OCR không được coi là xác thực pháp lý của hóa đơn.</Callout>
          </div>
        )}
        {!buyers.length && <Callout tone="warn">Chưa có bên mua nào đăng ký trên FCC. Hãy mời bên mua đăng ký tài khoản trước khi tạo khoản phải thu.</Callout>}
        {err && <Callout tone="critical">{err}</Callout>}
        {warn && <Callout tone="warn">{warn}</Callout>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bên mua">
            <select className={inputCls} value={form.buyerId} onChange={(e) => set('buyerId', e.target.value)}>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — MST {b.taxCode}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ký hiệu"><input className={inputCls} value={form.series} onChange={(e) => set('series', e.target.value)} /></Field>
            <Field label="Số hóa đơn"><input className={inputCls} value={form.number} onChange={(e) => set('number', e.target.value)} /></Field>
          </div>
          <Field label="Ngày phát hành"><input type="date" className={inputCls} value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} /></Field>
          <Field label="Hạn thanh toán"><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
          <Field label="Tổng tiền thanh toán (VND)" hint={form.amount ? vnd(Number(String(form.amount).replace(/\D/g, '')), false) : undefined}>
            <input inputMode="numeric" className={inputCls} value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </Field>
          <Field label="Nội dung"><input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
        <fieldset className="flex flex-wrap gap-4 text-[13px]">
          <legend className="mb-1 text-[13px] font-medium text-ink-2">Chứng từ bổ trợ đã tải</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={source === 'xml'} disabled /> XML hóa đơn gốc</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={form.contract} onChange={(e) => set('contract', e.target.checked)} /> Hợp đồng</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={form.delivery} onChange={(e) => set('delivery', e.target.checked)} /> Biên bản giao nhận/nghiệm thu</label>
        </fieldset>
      </div>
    </Modal>
  )
}

function LenderQueue() {
  const org = useActiveOrg()
  const apps = useStore((s) => s.applications)
  const receivables = useStore((s) => s.receivables)
  const products = useStore((s) => s.products)
  const orgMap = useOrgMap()
  const sc = useScores()
  const nav = useNavigate()
  const [tab, setTab] = useState<'queue' | 'active' | 'closed'>('queue')
  const mine = apps.filter((a) => a.lenderId === org.id)
  const rows = useMemo(() => mine.filter((a) => (tab === 'queue' ? ['SUBMITTED', 'UNDER_REVIEW'].includes(a.state) : tab === 'active' ? ['OFFERED', 'ACCEPTED', 'FUNDED'].includes(a.state) : ['SETTLED', 'REJECTED', 'WITHDRAWN'].includes(a.state))), [mine, tab])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Hồ sơ tài trợ</h1>
        <p className="text-[13px] text-ink-3">Chỉ hiển thị hồ sơ doanh nghiệp gửi tới {org.shortName} kèm đồng ý chia sẻ. Quyết định tín dụng, giá và giải ngân thuộc tổ chức của bạn.</p>
      </div>
      <Card>
        <Tabs value={tab} onChange={setTab} items={[{ value: 'queue', label: `Chờ thẩm định (${mine.filter((a) => ['SUBMITTED', 'UNDER_REVIEW'].includes(a.state)).length})` }, { value: 'active', label: 'Đang hiệu lực' }, { value: 'closed', label: 'Đã đóng' }]} />
        <div className="mt-3">
          <Table head={['Hồ sơ', 'Nhà cung cấp', 'Bên mua', 'Khoản phải thu', 'Sản phẩm', 'Điểm hồ sơ', 'Nộp', 'Trạng thái']} empty={rows.length === 0 && <div className="pt-3"><Empty title="Không có hồ sơ" /></div>}>
            {rows.map((a) => {
              const r = receivables.find((x) => x.id === a.receivableId)!
              const s = sc.application(r.id)
              return (
                <tr key={a.id} className="cursor-pointer hover:bg-page" onClick={() => nav(`/invoices/${r.id}`)}>
                  <td className="px-3 py-2.5 font-semibold text-brand-dark">{a.id}</td>
                  <td className="px-3 py-2.5">{orgMap[r.sellerId].shortName}</td>
                  <td className="px-3 py-2.5">{orgMap[r.buyerId].shortName}</td>
                  <td className="px-3 py-2.5 font-medium">{vnd(r.amount)} <span className="text-xs text-ink-3">· {r.code}</span></td>
                  <td className="px-3 py-2.5 text-ink-2">{products.find((p) => p.id === a.productId)?.name}</td>
                  <td className="px-3 py-2.5"><RatingBadge score={s} /></td>
                  <td className="px-3 py-2.5">{date(a.submittedAt)}</td>
                  <td className="px-3 py-2.5"><Badge tone={a.state === 'REJECTED' ? 'critical' : a.state === 'FUNDED' ? 'good' : 'brand'} icon={false}>{STATE_META[a.state as ReceivableState]?.label ?? a.state}</Badge></td>
                </tr>
              )
            })}
          </Table>
        </div>
      </Card>
    </div>
  )
}
