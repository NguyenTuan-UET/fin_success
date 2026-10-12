import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CircleDot, FileCheck2, FileX2, ShieldCheck, Store } from 'lucide-react'
import clsx from 'clsx'
import { useActiveOrg, useStore } from '../store'
import { requestOtp } from '../lib/api'
import { hasConsent, useOrgMap, useScores } from '../hooks'
import { Badge, Button, Callout, Card, Field, inputCls, Modal } from '../components/ui'
import { RatingBadge, ScorePanel, StateBadge } from '../components/domain'
import { date, daysFromNow, vnd } from '../lib/format'
import { SEGMENT_LABEL } from '../domain/credit'
import type { ReceivableState } from '../domain/types'

const FLOW: { s: ReceivableState[]; label: string }[] = [
  { s: ['DRAFT'], label: 'Tạo hồ sơ' },
  { s: ['BUYER_PENDING', 'BUYER_DISPUTED'], label: 'Bên mua xác nhận' },
  { s: ['BUYER_CONFIRMED'], label: 'Sẵn sàng tài trợ' },
  { s: ['SUBMITTED', 'UNDER_REVIEW'], label: 'Thẩm định' },
  { s: ['OFFERED', 'ACCEPTED'], label: 'Đề nghị & chấp thuận' },
  { s: ['FUNDED'], label: 'Giải ngân' },
  { s: ['SETTLED', 'EARLY_PAID'], label: 'Tất toán' },
]

export function InvoiceDetail() {
  const { id } = useParams()
  const org = useActiveOrg()
  const r = useStore((s) => s.receivables.find((x) => x.id === id))
  const apps = useStore((s) => s.applications)
  const products = useStore((s) => s.products)
  const consents = useStore((s) => s.consents)
  const audit = useStore((s) => s.audit)
  const a = useStore.getState()
  const orgMap = useOrgMap()
  const sc = useScores()
  const nav = useNavigate()
  const [otp, setOtp] = useState<null | 'confirm' | 'accept'>(null)
  const [challenge, setChallenge] = useState<{ id: string; demoCode?: string } | null>(null)
  const [code, setCode] = useState('')
  const [otpErr, setOtpErr] = useState('')
  const openOtp = async (kind: 'confirm' | 'accept') => {
    setOtpErr('')
    setCode('')
    setChallenge(null)
    setOtp(kind)
    try {
      const c = await requestOtp(kind === 'confirm' ? 'buyer_confirm' : 'accept_offer', kind === 'confirm' ? `${r!.id}@v${r!.version}` : app!.id)
      setChallenge({ id: c.otpId, demoCode: c.demoCode })
      setCode(c.demoCode ?? '')
    } catch (e) {
      setOtpErr((e as Error).message)
    }
  }
  const submitOtp = async () => {
    if (!challenge) return
    const proof = { id: challenge.id, code }
    if (otp === 'confirm') await a.buyerDecision(r!.id, true, undefined, proof)
    else if (app) await a.acceptOffer(app.id, proof)
    setOtp(null)
  }
  const [dispute, setDispute] = useState(false)
  const [reason, setReason] = useState('')
  const [revise, setRevise] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)

  if (!r) return <p>Không tìm thấy khoản phải thu. <Link to="/invoices" className="text-brand-dark underline">Quay lại</Link></p>
  const isSeller = org.id === r.sellerId
  const isBuyer = org.id === r.buyerId
  const app = apps.find((x) => x.receivableId === r.id && !['REJECTED', 'WITHDRAWN'].includes(x.state)) ?? apps.find((x) => x.receivableId === r.id)
  const isLender = org.type === 'lender' && app?.lenderId === org.id
  if (!isSeller && !isBuyer && !isLender) return <Callout tone="critical" title="Không có quyền truy cập">Hồ sơ này không thuộc tổ chức {org.shortName} hoặc chưa được chia sẻ.</Callout>
  const canSeeScores = isSeller || (isLender && hasConsent(consents, r.sellerId, org.id, 'credit_score'))
  const flowIdx = FLOW.findIndex((f) => f.s.includes(r.state))
  const appScore = sc.application(r.id)
  const product = app && products.find((p) => p.id === app.productId)
  const events = audit.filter((e) => e.entity === r.code || (app && e.entity === app.id)).slice(0, 12)

  return (
    <div className="space-y-4">
      <button onClick={() => nav(-1)} className="flex cursor-pointer items-center gap-1 text-[13px] text-ink-3 hover:text-ink"><ArrowLeft className="size-4" /> Quay lại</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{r.code}</h1>
            <StateBadge state={r.state} />
            <Badge tone="neutral" icon={false}>v{r.version}</Badge>
            {app && <Badge tone="brand" icon={false}>{app.id}</Badge>}
          </div>
          <p className="text-[13px] text-ink-3">{r.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSeller && r.state === 'DRAFT' && <Button variant="primary" onClick={() => a.sendToBuyer(r.id)}>Gửi bên mua xác nhận</Button>}
          {isSeller && r.state === 'DRAFT' && <Button variant="danger" onClick={() => a.cancelReceivable(r.id)}>Hủy</Button>}
          {isSeller && r.state === 'BUYER_DISPUTED' && <Button variant="primary" onClick={() => setRevise(true)}>Điều chỉnh & gửi lại</Button>}
          {isSeller && r.state === 'BUYER_CONFIRMED' && <Button variant="primary" icon={<Store className="size-4" />} onClick={() => nav(`/marketplace?r=${r.id}`)}>Tìm nguồn vốn trên Marketplace</Button>}
          {isSeller && app?.state === 'OFFERED' && <Button variant="primary" onClick={() => openOtp('accept')}>Chấp thuận đề nghị</Button>}
          {isBuyer && r.state === 'BUYER_PENDING' && (
            <>
              <Button variant="good" icon={<FileCheck2 className="size-4" />} onClick={() => openOtp('confirm')}>Xác nhận nghĩa vụ</Button>
              <Button variant="danger" icon={<FileX2 className="size-4" />} onClick={() => setDispute(true)}>Nêu tranh chấp</Button>
            </>
          )}
          {isBuyer && ['FUNDED', 'BUYER_CONFIRMED', 'OVERDUE'].includes(r.state) && <Button onClick={() => a.markBuyerPaid(r.id)}>Ghi nhận đã thanh toán (mô phỏng)</Button>}
          {isLender && app?.state === 'SUBMITTED' && <Button variant="primary" onClick={() => a.startReview(app.id)}>Bắt đầu thẩm định</Button>}
          {isLender && app?.state === 'UNDER_REVIEW' && (
            <>
              <Button variant="primary" onClick={() => setOfferOpen(true)}>Đưa đề nghị chính thức</Button>
              <Button variant="danger" onClick={() => a.rejectApp(app.id, 'Không phù hợp khẩu vị rủi ro hiện tại')}>Từ chối</Button>
            </>
          )}
          {isLender && app?.state === 'ACCEPTED' && <Button variant="primary" onClick={() => a.fundApp(app.id)}>Ghi nhận giải ngân</Button>}
          {isLender && app?.state === 'FUNDED' && <Button onClick={() => a.markBuyerPaid(r.id)}>Ghi nhận bên mua thanh toán (sự kiện)</Button>}
        </div>
      </div>

      <ol className="flex flex-wrap gap-y-2 rounded-xl border border-line bg-white p-3" aria-label="Tiến trình">
        {FLOW.map((f, i) => (
          <li key={f.label} className="flex items-center text-[12.5px]">
            <span className={clsx('flex items-center gap-1.5 rounded-full px-2.5 py-1', i < flowIdx && 'text-good-ink', i === flowIdx && 'bg-brand-soft font-semibold text-brand-dark', i > flowIdx && 'text-ink-3')}>
              {i < flowIdx ? <Check className="size-3.5" /> : <CircleDot className="size-3.5" />}
              {f.label}
            </span>
            {i < FLOW.length - 1 && <span className="mx-1 h-px w-4 bg-line" />}
          </li>
        ))}
      </ol>

      {r.state === 'BUYER_DISPUTED' && <Callout tone="critical" title="Bên mua nêu tranh chấp — chặn gửi hồ sơ tài trợ">{r.disputeReason}</Callout>}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Thông tin khoản phải thu">
            <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
              <Info k="Người bán" v={`${orgMap[r.sellerId].name} · MST ${orgMap[r.sellerId].taxCode}`} />
              <Info k="Người mua" v={`${orgMap[r.buyerId].name} · MST ${orgMap[r.buyerId].taxCode}`} />
              <Info k="Hóa đơn" v={`${r.invoiceSeries} – số ${r.invoiceNumber}`} />
              <Info k="Số tiền" v={vnd(r.amount, false)} />
              <Info k="Ngày phát hành" v={date(r.issueDate)} />
              <Info k="Hạn thanh toán" v={`${date(r.dueDate)} (${daysFromNow(r.dueDate) >= 0 ? `còn ${daysFromNow(r.dueDate)} ngày` : `quá ${-daysFromNow(r.dueDate)} ngày`})`} />
              <Info k="Nguồn dữ liệu" v={{ xml: 'XML hóa đơn điện tử', ocr: 'AI OCR — đã người dùng kiểm tra', manual: 'Nhập tay', accounting: 'Phần mềm kế toán' }[r.source]} />
              <Info k="Xác minh nguồn ngoài" v="unverified — chưa kết nối cổng tra cứu hóa đơn cơ quan thuế (demo)" />
              <Info k="Dấu vân tay (chống trùng)" v={<code className="break-all text-[11px]">{r.fingerprint.slice(0, 32)}…</code>} />
              <Info k="Chứng từ" v={<span className="flex flex-wrap gap-1.5"><DocChip ok={r.docs.xml} label="XML" /><DocChip ok={r.docs.contract} label="Hợp đồng" /><DocChip ok={r.docs.delivery} label="Biên bản giao nhận" /></span>} />
              {r.confirmedAt && <Info k="Bên mua xác nhận" v={`${date(r.confirmedAt)} · phiên bản v${r.version} · xác thực lại bằng OTP`} />}
              {r.paidAt && <Info k="Đã thanh toán" v={`${date(r.paidAt)} · ${vnd(r.paidAmount ?? 0)}`} />}
            </dl>
          </Card>

          {canSeeScores ? (
            <Card title="Điểm hồ sơ tài trợ" subtitle={`0,45 × bên mua + 0,30 × bên bán + 0,25 × giao dịch · ${SEGMENT_LABEL[appScore.segment]}`} action={<RatingBadge score={appScore} provisional={!appScore.official} />}>
              {!appScore.eligible && <Callout tone="warn">Khoản phải thu chưa ở trạng thái “Bên mua đã xác nhận” — điểm hồ sơ chỉ để tham khảo, chưa đưa lên Marketplace.</Callout>}
              <div className="mt-2">
                <ScorePanel score={appScore} orgName={`hồ sơ ${r.code}`} compact />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link to={`/credit/${r.sellerId}`} className="rounded-lg border border-line p-3 text-[13px] hover:bg-page">Bên bán: <RatingBadge score={sc.supplier(r.sellerId)} /> →</Link>
                <Link to={`/credit/${r.buyerId}`} className="rounded-lg border border-line p-3 text-[13px] hover:bg-page">Bên mua: <RatingBadge score={sc.buyer(r.buyerId)} /> →</Link>
              </div>
            </Card>
          ) : (
            isLender && <Callout tone="warn">Doanh nghiệp chưa đồng ý chia sẻ điểm tín dụng với {org.shortName}.</Callout>
          )}
        </div>

        <div className="space-y-4">
          {app && (
            <Card title="Hồ sơ tài trợ" subtitle={`${orgMap[app.lenderId].shortName} · ${product?.name ?? ''}`}>
              <dl className="space-y-2 text-[13px]">
                <Info k="Trạng thái" v={app.state} />
                <Info k="Gửi lúc" v={date(app.submittedAt)} />
                {app.rfqId && <Info k="Từ RFQ" v={app.rfqId} />}
                {app.offer ? (
                  <div className="rounded-lg border border-line bg-page p-3">
                    <p className="mb-1 text-xs font-semibold text-ink-3">ĐỀ NGHỊ CHÍNH THỨC (nguyên văn từ đối tác)</p>
                    <Info k="Số tiền ứng" v={vnd(app.offer.advanceVnd, false)} />
                    <Info k="Lãi suất" v={`${app.offer.ratePct}%/năm · ${app.offer.tenorDays} ngày`} />
                    <Info k="Phí" v={vnd(app.offer.feesVnd, false)} />
                    <Info k="Lãi ước tính" v={vnd(Math.round((app.offer.advanceVnd * app.offer.ratePct * app.offer.tenorDays) / 36500), false)} />
                    <Info k="Tổng phải trả" v={vnd(app.offer.advanceVnd + app.offer.feesVnd + Math.round((app.offer.advanceVnd * app.offer.ratePct * app.offer.tenorDays) / 36500), false)} />
                    <Info k="Điều kiện" v={app.offer.conditions} />
                    <Info k="Hạn chấp thuận" v={date(app.offer.expiresAt)} />
                  </div>
                ) : (
                  <p className="text-ink-3">Chưa có báo giá chính thức.</p>
                )}
                {app.fundedAt && <Info k="Giải ngân" v={`${date(app.fundedAt)} · ${vnd(app.fundedAmount ?? 0)}`} />}
                {app.settledAt && <Info k="Tất toán" v={date(app.settledAt)} />}
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-3"><ShieldCheck className="mt-px size-3.5 shrink-0" /> Ký hợp đồng, giải ngân, thu hồi diễn ra trên kênh của tổ chức tài chính. FCC không giữ tiền; trạng thái giải ngân/tất toán chỉ cập nhật từ sự kiện đối tác.</p>
            </Card>
          )}
          <Card title="Nhật ký">
            {events.length ? (
              <ol className="space-y-2.5 text-[12.5px]">
                {events.map((e) => (
                  <li key={e.id} className="border-l-2 border-brand/30 pl-2.5">
                    <div className="font-medium">{e.action}</div>
                    <div className="text-ink-3">{orgMap[e.actorOrgId]?.shortName} · {new Date(e.at).toLocaleString('vi-VN')}</div>
                    {e.detail && <div className="text-ink-2">{e.detail}</div>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-ink-3">Chưa có sự kiện trong phiên demo này (dữ liệu khởi tạo).</p>
            )}
          </Card>
        </div>
      </div>

      <Modal open={otp !== null} onClose={() => setOtp(null)} title={otp === 'confirm' ? 'Xác nhận nghĩa vụ thanh toán' : 'Chấp thuận đề nghị tài trợ'} footer={<><Button onClick={() => setOtp(null)}>Hủy</Button><Button variant="primary" disabled={!challenge || code.length !== 6} onClick={submitOtp}>Xác thực & đồng ý</Button></>}>
        <div className="space-y-3 text-[13px]">
          {otp === 'confirm' ? (
            <p>{orgMap[r.buyerId].name} xác nhận có nghĩa vụ thanh toán <b>{vnd(r.amount, false)}</b> cho {orgMap[r.sellerId].name} theo hóa đơn {r.invoiceSeries}-{r.invoiceNumber}, hạn <b>{date(r.dueDate)}</b>, phiên bản v{r.version}; không có tranh chấp tại thời điểm xác nhận.</p>
          ) : (
            <p>Chấp thuận đề nghị của {app && orgMap[app.lenderId].name}: ứng {app?.offer && vnd(app.offer.advanceVnd, false)}, {app?.offer?.ratePct}%/năm. Hợp đồng sẽ được ký trên kênh của tổ chức tài chính.</p>
          )}
          {otpErr && <Callout tone="critical">{otpErr}</Callout>}
          <Field label="Mã OTP" hint={challenge?.demoCode ? 'Demo: chưa nối SMS/email nên mã được điền sẵn; bản thật gửi qua kênh của nhà cung cấp OTP.' : undefined}><input className={inputCls} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
          <p className="text-xs text-ink-3">Hệ thống lưu snapshot nội dung, danh tính, thời điểm, phương thức xác thực. Mẫu xác nhận thực tế cần đối tác/pháp chế duyệt.</p>
        </div>
      </Modal>
      <Modal open={dispute} onClose={() => setDispute(false)} title="Nêu tranh chấp" footer={<><Button onClick={() => setDispute(false)}>Hủy</Button><Button variant="danger" disabled={!reason.trim()} onClick={() => { a.buyerDecision(r.id, false, reason); setDispute(false) }}>Gửi tranh chấp</Button></>}>
        <Field label="Lý do (bắt buộc)"><textarea className={`${inputCls} h-24 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: giao thiếu số lượng, sai đơn giá…" /></Field>
      </Modal>
      {revise && <ReviseModal id={r.id} amount={r.amount} onClose={() => setRevise(false)} />}
      {offerOpen && app && <OfferModal appId={app.id} amount={r.amount} dueDate={r.dueDate} defaultRate={product?.pricing.rateMin ?? 7} advancePct={product?.pricing.advancePct ?? 80} onClose={() => setOfferOpen(false)} />}
    </div>
  )
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
      <dt className="text-ink-3">{k}</dt>
      <dd className="font-medium text-ink sm:text-right">{v}</dd>
    </div>
  )
}

function DocChip({ ok, label }: { ok: boolean; label: string }) {
  return <Badge tone={ok ? 'good' : 'warn'}>{label}</Badge>
}

function ReviseModal({ id, amount, onClose }: { id: string; amount: number; onClose: () => void }) {
  const revise = useStore((s) => s.reviseDisputed)
  const [v, setV] = useState(String(amount))
  const [note, setNote] = useState('')
  return (
    <Modal open onClose={onClose} title="Tạo phiên bản mới sau tranh chấp" footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" disabled={!note} onClick={() => { revise(id, Number(v.replace(/\D/g, '')), note); onClose() }}>Gửi bên mua xác nhận lại</Button></>}>
      <div className="space-y-3">
        <Field label="Số tiền sau điều chỉnh (VND)"><input className={inputCls} value={v} onChange={(e) => setV(e.target.value)} /></Field>
        <Field label="Nội dung điều chỉnh"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: lập hóa đơn điều chỉnh giảm 4.000 viên" /></Field>
      </div>
    </Modal>
  )
}

function OfferModal({ appId, amount, dueDate, defaultRate, advancePct, onClose }: { appId: string; amount: number; dueDate: string; defaultRate: number; advancePct: number; onClose: () => void }) {
  const make = useStore((s) => s.makeOffer)
  const [f, setF] = useState({ advance: String(Math.round((amount * advancePct) / 100)), rate: String(defaultRate), fees: '0', tenor: String(Math.max(1, daysFromNow(dueDate))), conditions: 'Bên mua thanh toán vào tài khoản chuyên dùng; có truy đòi nhà cung cấp' })
  return (
    <Modal open onClose={onClose} title="Đề nghị tài trợ chính thức" footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={() => { make(appId, { advanceVnd: Number(f.advance), ratePct: Number(f.rate), feesVnd: Number(f.fees), tenorDays: Number(f.tenor), conditions: f.conditions, expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) }); onClose() }}>Gửi đề nghị</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Số tiền ứng (VND)" hint={vnd(Number(f.advance))}><input className={inputCls} value={f.advance} onChange={(e) => setF({ ...f, advance: e.target.value })} /></Field>
        <Field label="Lãi suất (%/năm)"><input className={inputCls} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
        <Field label="Phí (VND)"><input className={inputCls} value={f.fees} onChange={(e) => setF({ ...f, fees: e.target.value })} /></Field>
        <Field label="Kỳ hạn (ngày)"><input className={inputCls} value={f.tenor} onChange={(e) => setF({ ...f, tenor: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Điều kiện"><input className={inputCls} value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} /></Field></div>
      </div>
    </Modal>
  )
}
