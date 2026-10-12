import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Building2, FileUp, Lock, Plus, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { useActiveOrg, useStore } from '../store'
import { hasConsent, useScores } from '../hooks'
import { AiTag, Badge, Button, Callout, Card, Empty, Field, inputCls, Modal, Table } from '../components/ui'
import { RatingBadge, ScorePanel } from '../components/domain'
import { PriceLine, QuarterBars } from '../components/charts'
import { date, dateTime, vnd, num } from '../lib/format'
import { detectAnomalies } from '../domain/credit'
import { extractFinancials, fileToImage, type AiOutcome, type ExtractedFinancials } from '../lib/ai'
import type { CollateralItem, FinancialYear, ListedSnapshot, Org } from '../domain/types'

export function Credit() {
  const org = useActiveOrg()
  const orgs = useStore((s) => s.orgs)
  const consents = useStore((s) => s.consents)
  const { orgId } = useParams()
  const nav = useNavigate()
  const sc = useScores()
  // phạm vi được xem: chính mình; bên mua (anchor — dữ liệu công khai/niêm yết); doanh nghiệp đã đồng ý chia sẻ điểm
  const visible = orgs.filter((o) => o.type !== 'lender' && (o.id === org.id || o.type === 'buyer' || hasConsent(consents, o.id, org.id, 'credit_score')))
  const locked = orgs.filter((o) => o.type === 'supplier' && !visible.includes(o))
  const selectedId = orgId && visible.some((o) => o.id === orgId) ? orgId : org.type === 'lender' ? visible.find((o) => o.type === 'supplier')?.id ?? visible[0]?.id : org.id
  const sel = orgs.find((o) => o.id === selectedId)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Chấm điểm doanh nghiệp</h1>
        <p className="text-[13px] text-ink-3">Scorecard 5C + dữ liệu thay thế (bên bán), bộ chấm anchor dùng dữ liệu niêm yết qua vnstock (bên mua). Xác định, có phiên bản, có giải thích — tham khảo cho tổ chức tài chính.</p>
      </div>
      {orgId && orgId !== selectedId && <Callout tone="critical" title="Không có quyền xem">Doanh nghiệp chưa đồng ý chia sẻ điểm tín dụng với {org.shortName}.</Callout>}
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card title="Doanh nghiệp" className="h-fit">
          <ul className="-mx-2 space-y-0.5">
            {visible.map((o) => {
              const s = o.type === 'buyer' ? sc.buyer(o.id) : sc.supplier(o.id)
              return (
                <li key={o.id}>
                  <button onClick={() => nav(`/credit/${o.id}`)} className={clsx('flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted', o.id === selectedId && 'bg-brand-soft')}>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{o.shortName}{o.id === org.id && ' (bạn)'}</span>
                      <span className="block text-[11px] text-ink-3">{o.type === 'buyer' ? (o.listedSymbol ? `Bên mua · ${o.exchange}:${o.listedSymbol}` : 'Bên mua · chưa niêm yết') : 'Nhà cung cấp SME'}</span>
                    </span>
                    <RatingBadge score={s} />
                  </button>
                </li>
              )
            })}
          </ul>
          {locked.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 border-t border-line pt-3 text-[11px] text-ink-3">
              <Lock className="mt-px size-3.5 shrink-0" /> {locked.length} nhà cung cấp chưa chia sẻ điểm với {org.shortName}.
            </p>
          )}
        </Card>
        {sel ? <OrgCredit key={sel.id} org={sel} editable={sel.id === org.id} /> : <Empty title="Chọn doanh nghiệp" />}
      </div>
    </div>
  )
}

function OrgCredit({ org, editable }: { org: Org; editable: boolean }) {
  const sc = useScores()
  const profile = useStore((s) => s.profiles.find((p) => p.orgId === org.id))
  const listed = useStore((s) => s.listed.find((l) => l.orgId === org.id))
  const receivables = useStore((s) => s.receivables)
  const isBuyer = org.type === 'buyer'
  const score = isBuyer ? sc.buyer(org.id) : sc.supplier(org.id)
  const anomalies = useMemo(() => (isBuyer ? [] : detectAnomalies(receivables, org.id)), [receivables, org.id, isBuyer])
  return (
    <div className="min-w-0 space-y-4">
      <Card
        title={<span className="flex items-center gap-2"><Building2 className="size-4 text-ink-3" />{org.name}</span>}
        subtitle={`MST ${org.taxCode} · ${org.industryLabel} (VSIC ${org.vsic}) · thành lập ${org.foundedYear} · ${org.employees} lao động · ${org.province}`}
        action={<Badge tone="neutral" icon={false}>{isBuyer ? 'Bộ chấm bên mua (anchor)' : 'Bộ chấm bên bán (5C)'}</Badge>}
      >
        <ScorePanel score={score} orgName={org.shortName} />
      </Card>
      {anomalies.length > 0 && (
        <Callout tone="warn" title="Dấu hiệu bất thường (quy tắc tự động) — để người thẩm định xem xét, không phải kết luận gian lận">
          <ul className="list-disc pl-5">{anomalies.map((a) => <li key={a}>{a}</li>)}</ul>
        </Callout>
      )}
      {listed && <ListedPanel key={org.id} snap={listed} org={org} editable={editable} />}
      <FinancialsCard org={org} financials={profile?.financials ?? []} editable={editable} />
      {!isBuyer && <CicCollateralCard org={org} editable={editable} />}
    </div>
  )
}

function ListedPanel({ snap, org, editable }: { snap: ListedSnapshot; org: Org; editable: boolean }) {
  const refreshListed = useStore((s) => s.refreshListed)
  const [msg, setMsg] = useState<{ tone: 'good' | 'warn'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [sym, setSym] = useState(org.realDataSymbol ?? snap.symbol)
  const refresh = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await refreshListed(sym)
      setMsg({ tone: 'good', text: `Đã nạp dữ liệu ${sym.trim().toUpperCase()} từ máy chủ.` })
    } catch (e) {
      setMsg({ tone: 'warn', text: `${(e as Error).message} Đang giữ dữ liệu hiện tại.` })
    }
    setBusy(false)
  }
  return (
    <Card
      title={`Dữ liệu niêm yết · ${snap.exchange}:${snap.symbol}`}
      subtitle={`${snap.provider} · cập nhật ${dateTime(snap.fetchedAt)}`}
      action={<>{snap.isMock && <Badge tone="warn">Snapshot mẫu</Badge>}{editable && <input aria-label="Mã chứng khoán để nạp" className="h-8 w-20 rounded-lg border border-line px-2 text-xs uppercase" value={sym} onChange={(e) => setSym(e.target.value)} />}{editable && <Button size="sm" icon={<RefreshCw className="size-4" />} loading={busy} onClick={refresh}>Làm mới từ vnstock</Button>}</>}
    >
      {msg && <div className="mb-3"><Callout tone={msg.tone}>{msg.text}</Callout></div>}
      {!snap.isMock && snap.symbol !== org.listedSymbol && (
        <div className="mb-3"><Callout tone="warn" title="Dữ liệu thật dùng để minh họa">Đây là dữ liệu thật của {snap.exchange}:{snap.symbol} (vnstock) được gán cho bên mua mẫu “{org.shortName}” cùng ngành. Tên doanh nghiệp trên FCC là hư cấu; khi triển khai thật, ánh xạ MST ↔ mã CK phải được xác minh thủ công.</Callout></div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[13px] font-semibold">Giá đóng cửa 6 tháng</p>
          <PriceLine data={snap.priceHistory} />
        </div>
        <div>
          <p className="mb-1 text-[13px] font-semibold">Doanh thu theo quý</p>
          <QuarterBars data={[...snap.quarters].reverse().map((q) => ({ period: q.period, value: q.revenue }))} />
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-4">
        <KV k="Vốn hóa" v={vnd(snap.marketCap)} />
        <KV k="Biến động 90 ngày" v={`${num(snap.volatility90d * 100, 0)}%/năm`} />
        <KV k="Ý kiến kiểm toán" v={snap.auditOpinion === 'unqualified' ? 'Chấp nhận toàn phần' : snap.auditOpinion} />
        <KV k="Diện giao dịch" v={snap.tradingStatus === 'normal' ? 'Bình thường' : snap.tradingStatus} />
      </div>
      {snap.events.length > 0 && <div className="mt-3">
        <p className="mb-1 text-[13px] font-semibold">Sự kiện gần đây</p>
        <ul className="space-y-1 text-[13px]">{snap.events.map((e) => <li key={e.title}><span className="text-ink-3">{date(e.date)}</span> — {e.title}</li>)}</ul>
      </div>}
    </Card>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-page px-3 py-2">
      <div className="text-[11px] text-ink-3">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  )
}

const FIN_FIELDS: { k: keyof ExtractedFinancials & keyof FinancialYear; label: string }[] = [
  { k: 'revenue', label: 'Doanh thu thuần' },
  { k: 'netProfit', label: 'Lợi nhuận sau thuế' },
  { k: 'ebit', label: 'EBIT' },
  { k: 'interestExpense', label: 'Chi phí lãi vay' },
  { k: 'depreciation', label: 'Khấu hao' },
  { k: 'totalAssets', label: 'Tổng tài sản' },
  { k: 'currentAssets', label: 'Tài sản ngắn hạn' },
  { k: 'currentLiabilities', label: 'Nợ ngắn hạn' },
  { k: 'totalLiabilities', label: 'Nợ phải trả' },
  { k: 'equity', label: 'Vốn chủ sở hữu' },
  { k: 'operatingCashFlow', label: 'LCTT từ HĐKD' },
  { k: 'cash', label: 'Tiền & tương đương' },
  { k: 'inventory', label: 'Hàng tồn kho' },
  { k: 'receivables', label: 'Phải thu' },
]

const STATUS_LABEL = { self_declared: 'Tự khai', extracted: 'AI trích xuất', verified: 'Đã đối chiếu', public_reference: 'Nguồn công khai' }

function FinancialsCard({ org, financials, editable }: { org: Org; financials: FinancialYear[]; editable: boolean }) {
  const [open, setOpen] = useState(false)
  const ys = [...financials].sort((a, b) => b.year - a.year)
  return (
    <Card title="Báo cáo tài chính" subtitle="Đầu vào Capacity & Capital" action={editable && <Button size="sm" variant="primary" icon={<FileUp className="size-4" />} onClick={() => setOpen(true)}>Tải BCTC (AI trích xuất)</Button>}>
      {ys.length ? (
        <Table head={['Chỉ tiêu', ...ys.map((y) => `${y.year}`)]}>
          {FIN_FIELDS.map((f) => (
            <tr key={f.k}>
              <td className="px-3 py-1.5 text-ink-2">{f.label}</td>
              {ys.map((y) => <td key={y.year} className="px-3 py-1.5 font-medium">{vnd(y[f.k] as number)}</td>)}
            </tr>
          ))}
          <tr>
            <td className="px-3 py-1.5 text-ink-3">Nguồn / trạng thái</td>
            {ys.map((y) => <td key={y.year} className="px-3 py-1.5 text-xs text-ink-3">{y.source} · <Badge tone={y.status === 'verified' ? 'good' : y.status === 'extracted' ? 'warn' : 'neutral'} icon={false}>{STATUS_LABEL[y.status]}</Badge></td>)}
          </tr>
        </Table>
      ) : (
        <Empty title="Chưa có BCTC">Tải ảnh/PDF BCTC để AI trích xuất, sau đó kiểm tra và xác nhận.</Empty>
      )}
      {open && <UploadFinancials org={org} onClose={() => setOpen(false)} />}
    </Card>
  )
}

function UploadFinancials({ org, onClose }: { org: Org; onClose: () => void }) {
  const aiMode = useStore((s) => s.aiMode)
  const upsert = useStore((s) => s.upsertFinancialYear)
  const prev = useStore((s) => s.profiles.find((p) => p.orgId === org.id)?.financials[0])
  const [ai, setAi] = useState<AiOutcome<ExtractedFinancials> | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState('')
  const [vals, setVals] = useState<Record<string, string>>({ year: String(new Date().getFullYear() - 1) })
  const onFile = async (file: File) => {
    setBusy(true)
    const img = await fileToImage(file)
    setPreview(img.dataUrl)
    const out = await extractFinancials(aiMode, img.base64, () => {
      // mô phỏng: tăng trưởng nhẹ so với năm gần nhất để minh họa luồng (ghi rõ là mô phỏng)
      const g = 1.07
      const base = prev
      return base ? { year: base.year + 1, ...Object.fromEntries(FIN_FIELDS.map((f) => [f.k, Math.round((base[f.k] as number) * g)])), unit: 'VND', confidence: 0.3, notes: 'Mô phỏng — API AI không khả dụng' } : { year: new Date().getFullYear() - 1, confidence: 0.2, notes: 'Mô phỏng — nhập tay' }
    })
    setAi(out)
    setVals(Object.fromEntries(Object.entries(out.data).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, String(v)])))
    setBusy(false)
  }
  const save = () => {
    const n = (k: string) => Number(vals[k] ?? 0) || 0
    upsert(org.id, { year: n('year'), revenue: n('revenue'), netProfit: n('netProfit'), ebit: n('ebit'), interestExpense: n('interestExpense'), depreciation: n('depreciation'), totalAssets: n('totalAssets'), currentAssets: n('currentAssets'), currentLiabilities: n('currentLiabilities'), totalLiabilities: n('totalLiabilities'), equity: n('equity'), operatingCashFlow: n('operatingCashFlow'), debtService: Math.round(n('interestExpense') * 3.5), cash: n('cash'), inventory: n('inventory'), receivables: n('receivables'), source: ai?.simulated ? 'BCTC tải lên (AI mô phỏng, người dùng xác nhận)' : `BCTC tải lên (${ai?.model ?? 'nhập tay'} trích xuất, người dùng xác nhận)`, status: 'extracted' })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Tải BCTC — AI trích xuất" wide footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={save} disabled={!vals.revenue}>Xác nhận & lưu</Button></>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block cursor-pointer">
            <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-brand bg-brand-soft px-4 text-sm font-medium text-brand-dark">{busy ? `Đang đọc bằng ${'gemma4:31b'}…` : 'Chọn ảnh/PDF BCTC (trang CĐKT/KQKD)…'}</span>
            <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {ai && (
            <div className="space-y-1 text-xs">
              <AiTag simulated={ai.simulated} error={ai.error} />
              {ai.error && <p className="text-warn-ink">{ai.error}</p>}
              {ai.data.notes && <p className="text-ink-3">Ghi chú mô hình: {ai.data.notes}</p>}
              {ai.data.confidence !== undefined && <p className="text-ink-3">Độ tin cậy: {ai.data.confidence}</p>}
            </div>
          )}
          {preview && <img src={preview} alt="Trang BCTC đã tải" className="max-h-96 w-full rounded-lg border border-line object-contain" />}
          <Callout tone="warn">Kiểm tra từng trường trước khi lưu. Giá trị lưu ở trạng thái “AI trích xuất” cho đến khi đối chiếu với nguồn khác.</Callout>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Năm tài chính"><input className={inputCls} value={vals.year ?? ''} onChange={(e) => setVals({ ...vals, year: e.target.value })} /></Field>
          {FIN_FIELDS.map((f) => (
            <Field key={f.k} label={f.label} hint={vals[f.k] ? vnd(Number(vals[f.k])) : undefined}>
              <input className={inputCls} inputMode="numeric" value={vals[f.k] ?? ''} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value.replace(/[^\d-]/g, '') })} />
            </Field>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function CicCollateralCard({ org, editable }: { org: Org; editable: boolean }) {
  const profile = useStore((s) => s.profiles.find((p) => p.orgId === org.id))
  const update = useStore((s) => s.updateProfile)
  const [cicOpen, setCicOpen] = useState(false)
  const [col, setCol] = useState<Omit<CollateralItem, 'id'>>({ kind: 'machinery', description: '', declaredValue: 0 })
  const [cic, setCic] = useState({ worstDebtGroup: '1', maxLateDays: '0', months: '36' })
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Lịch sử tín dụng (CIC)" subtitle="FCC không truy cập CIC trực tiếp — doanh nghiệp tự tra cứu và tải lên" action={editable && <Button size="sm" onClick={() => setCicOpen(true)}>Cập nhật</Button>}>
        {profile?.cic ? (
          <dl className="space-y-1.5 text-[13px]">
            <div className="flex justify-between"><dt className="text-ink-3">Nhóm nợ cao nhất</dt><dd className="font-semibold">Nhóm {profile.cic.worstDebtGroup}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Quá hạn tối đa</dt><dd className="font-semibold">{profile.cic.maxLateDays} ngày</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Kỳ xem xét</dt><dd>{profile.cic.months} tháng</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Nguồn</dt><dd className="text-right text-ink-2">{profile.cic.source}</dd></div>
            {profile.cic.worstDebtGroup >= 3 && <p className="flex items-center gap-1 text-critical-ink"><AlertTriangle className="size-4" /> Nợ nhóm 3–5 là cờ knock-out</p>}
          </dl>
        ) : (
          <Empty title="Chưa có báo cáo CIC">Thiếu dữ liệu không bị tính 0 — điểm được gắn nhãn tạm tính.</Empty>
        )}
      </Card>
      <Card title="Tài sản bảo đảm khai báo" subtitle="Không bắt buộc với tài trợ khoản phải thu; FCC không định giá">
        {profile?.collateral.length ? (
          <ul className="space-y-1.5 text-[13px]">
            {profile.collateral.map((c) => (
              <li key={c.id} className="flex justify-between gap-2"><span>{c.description} <span className="text-ink-3">({{ realestate: 'BĐS ≤70%', machinery: 'Máy móc ≤50%', inventory: 'Tồn kho ≤40%' }[c.kind]})</span></span><span className="font-semibold">{vnd(c.declaredValue)}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">Không khai báo — được coi N/A, không phạt.</p>
        )}
        {editable && (
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 border-t border-line pt-3">
            <input className={inputCls} placeholder="Mô tả tài sản" value={col.description} onChange={(e) => setCol({ ...col, description: e.target.value })} />
            <select className={inputCls} value={col.kind} onChange={(e) => setCol({ ...col, kind: e.target.value as CollateralItem['kind'] })}>
              <option value="realestate">Bất động sản</option>
              <option value="machinery">Máy móc</option>
              <option value="inventory">Tồn kho</option>
            </select>
            <input className={inputCls} placeholder="Giá trị khai báo (VND)" inputMode="numeric" value={col.declaredValue || ''} onChange={(e) => setCol({ ...col, declaredValue: Number(e.target.value.replace(/\D/g, '')) })} />
            <Button icon={<Plus className="size-4" />} disabled={!col.description || !col.declaredValue} onClick={() => { update(org.id, { collateral: [...(profile?.collateral ?? []), { ...col, id: `c-${Date.now()}` }], capitalNeed: profile?.capitalNeed ?? col.declaredValue }); setCol({ kind: 'machinery', description: '', declaredValue: 0 }) }}>Thêm</Button>
          </div>
        )}
      </Card>
      <Modal open={cicOpen} onClose={() => setCicOpen(false)} title="Cập nhật báo cáo CIC" footer={<><Button onClick={() => setCicOpen(false)}>Hủy</Button><Button variant="primary" onClick={() => { update(org.id, { cic: { worstDebtGroup: Number(cic.worstDebtGroup) as 1, maxLateDays: Number(cic.maxLateDays), months: Number(cic.months), source: 'Báo cáo CIC doanh nghiệp tự tra cứu, tải lên ' + new Date().toLocaleDateString('vi-VN') } }); setCicOpen(false) }}>Lưu</Button></>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nhóm nợ cao nhất"><select className={inputCls} value={cic.worstDebtGroup} onChange={(e) => setCic({ ...cic, worstDebtGroup: e.target.value })}>{[1, 2, 3, 4, 5].map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="Quá hạn tối đa (ngày)"><input className={inputCls} value={cic.maxLateDays} onChange={(e) => setCic({ ...cic, maxLateDays: e.target.value })} /></Field>
          <Field label="Kỳ (tháng)"><input className={inputCls} value={cic.months} onChange={(e) => setCic({ ...cic, months: e.target.value })} /></Field>
        </div>
        <p className="mt-3 text-xs text-ink-3">Doanh nghiệp có thể tự tra cứu báo cáo CIC của mình qua kênh chính thức của CIC rồi tải lên. <Link to="/data" className="underline">Xem nguồn dữ liệu</Link></p>
      </Modal>
    </div>
  )
}
