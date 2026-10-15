import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, FileUp, Flag, Leaf, Lock, Sparkles, Sun, Zap } from 'lucide-react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useActiveOrg, useStore } from '../store'
import { hasConsent, useOrgMap, useScores } from '../hooks'
import { AiTag, Badge, Button, Callout, Card, Empty, Progress, Table, Tabs } from '../components/ui'
import { EsgBadge } from '../components/domain'
import { HBar } from '../components/charts'
import { PillarBars } from './Overview'
import { computeEsg, ESG_BADGE, ESG_LEVEL_ACTION, ESG_OFFICIAL_COVERAGE, ESG_WEIGHTS, GRID_EMISSION_FACTOR, INDICATOR_BY_CODE, INDICATORS, INDUSTRY_GROUP_LABEL, ISSUES } from '../domain/esg'
import { greenEligible, PRODUCT_TYPE_LABEL } from '../domain/marketplace'
import { classifyEvidence, fileToImage, proposeLevel, type EvidenceExtraction } from '../lib/ai'
import { date, num, pct } from '../lib/format'
import type { EsgAssessment, EsgIndicatorResult, IndicatorLevel, IndustryGroup } from '../domain/types'

export function Esg() {
  const org = useActiveOrg()
  const { orgId } = useParams()
  const consents = useStore((s) => s.consents)
  const orgMap = useOrgMap()
  if (org.type === 'fcc') return orgId ? <Workspace orgId={orgId} /> : <Navigate to="/admin" replace />
  if (orgId === org.id && org.type !== 'supplier') return <Workspace orgId={orgId} readOnly />
  if (orgId && orgId !== org.id) {
    if (!hasConsent(consents, orgId, org.id, 'esg')) return <Callout tone="critical" title="Không có quyền xem">{orgMap[orgId]?.shortName ?? orgId} chưa đồng ý chia sẻ ESG với {org.shortName}.</Callout>
    return <Workspace orgId={orgId} readOnly />
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">ESG & Tài chính xanh</h1>
        <p className="text-[13px] text-ink-3">Khung 18 chỉ tiêu E1–G6 (0–4), 6 vấn đề trọng yếu, trọng số theo 4 nhóm ngành. AI trích xuất bằng chứng và đề xuất mức; người thẩm định xác nhận; công thức tính điểm cố định.</p>
      </div>
      {org.type === 'supplier' && <Workspace orgId={org.id} />}
      {org.type === 'buyer' && <BuyerEsg />}
      {org.type === 'lender' && <LenderEsg />}
    </div>
  )
}

function Workspace({ orgId, readOnly }: { orgId: string; readOnly?: boolean }) {
  const ensure = useStore((s) => s.ensureEsg)
  const a = useStore((s) => s.esg.find((e) => e.orgId === orgId && e.source === 'assessed') ?? s.esg.find((e) => e.orgId === orgId))
  const orgMap = useOrgMap()
  const [tab, setTab] = useState<'indicators' | 'evidence' | 'green' | 'report'>('indicators')
  const viewer = useActiveOrg()
  const reviewer = viewer.type === 'fcc' // nhân sự FCC thẩm định; doanh nghiệp chỉ tải bằng chứng và yêu cầu AI đề xuất
  if (!a) return readOnly ? <Empty title="Chưa có đánh giá ESG" /> : <Empty title="Chưa có hồ sơ ESG" action={<Button variant="primary" onClick={() => ensure(orgId)}>Bắt đầu đánh giá</Button>}>Tải bằng chứng 12 tháng gần nhất; AI sẽ phân loại và đề xuất mức cho từng chỉ tiêu.</Empty>
  return (
    <div className="space-y-4">
      {(readOnly || reviewer) && <h1 className="text-xl font-bold">ESG — {orgMap[orgId]?.name}</h1>}
      <ScoreHeader a={a} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'indicators', label: '18 chỉ tiêu' }, { value: 'evidence', label: `Bằng chứng (${a.documents.length})` }, { value: 'green', label: 'Tài chính xanh' }, { value: 'report', label: 'Báo cáo & phát hành' }]} />
      </div>
      {tab === 'indicators' && <IndicatorTable a={a} reviewer={reviewer} readOnly={!!readOnly} />}
      {tab === 'evidence' && <Evidence a={a} readOnly={!!readOnly || reviewer} />}
      {tab === 'green' && <Green a={a} />}
      {tab === 'report' && <Report a={a} reviewer={reviewer} />}
    </div>
  )
}

function ScoreHeader({ a }: { a: EsgAssessment }) {
  const r = computeEsg(a.indicators, a.industryGroup)
  const setInd = useStore((s) => s.setEsgIndustry)
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-ink-3">Điểm ESG tổng hợp</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight">{num(r.score, 1)}</span>
              <span className="text-sm text-ink-3">/100</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <EsgBadge score={r.score} official={a.status === 'official'} />
              <span className="text-[13px] font-semibold">{r.level}</span>
            </div>
          </div>
          <Badge tone={a.status === 'official' ? 'good' : a.status === 'provisional' ? 'warn' : 'neutral'}>{{ official: 'Chính thức', provisional: a.source === 'disclosure' ? 'Theo công bố – chưa thẩm định' : 'Tạm tính', draft: 'Nháp', in_review: 'Đang thẩm định' }[a.status]}</Badge>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-ink-3"><span>Coverage (ngưỡng {pct(ESG_OFFICIAL_COVERAGE, 0)})</span><span className="tabular font-semibold text-ink-2">{r.verifiedCount}/{r.applicableCount} · {pct(r.coverage, 0)}</span></div>
          <Progress value={r.coverage * 100} tone={r.official ? 'good' : 'warn'} label="Coverage" />
          {!r.official && <p className="text-xs text-warn-ink">Thiếu dữ liệu — khoảng điểm {num(r.min, 1)}–{num(r.max, 1)}. Không tính thiếu = 0.</p>}
        </div>
        <p className="mt-3 text-xs text-ink-3">Xử lý tham khảo: {ESG_LEVEL_ACTION[r.level]}. {a.validUntil && `Hiệu lực tới ${date(a.validUntil)}.`}</p>
      </Card>
      <Card title="Ba trụ cột">
        <PillarBars pillars={r.pillars} />
        {r.flags.length > 0 && (
          <div className="mt-3 rounded-lg border border-critical/30 bg-critical-soft px-3 py-2 text-xs text-critical-ink">
            <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="size-4" /> Cờ trọng yếu — thẩm định bất kể Coverage</p>
            {r.flags.map((f) => <p key={f.code}>{f.reason}</p>)}
          </div>
        )}
      </Card>
      <Card title="6 vấn đề trọng yếu" action={a.source === 'assessed' ? <select aria-label="Nhóm ngành" className="h-8 rounded-lg border border-line px-2 text-xs" value={a.industryGroup} onChange={(e) => setInd(a.id, e.target.value as IndustryGroup)}>{Object.entries(INDUSTRY_GROUP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> : <Badge tone="neutral" icon={false}>{INDUSTRY_GROUP_LABEL[a.industryGroup]}</Badge>}>
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-[11px] uppercase text-ink-3"><th className="text-left font-semibold">Vấn đề</th><th className="text-right font-semibold">Trọng số</th><th className="text-right font-semibold">Điểm</th><th className="text-right font-semibold">Đóng góp</th></tr></thead>
          <tbody className="tabular">
            {r.issues.map((i) => (
              <tr key={i.issue} className="border-t border-line">
                <td className="py-1.5">{ISSUES[i.issue].label}</td>
                <td className="py-1.5 text-right">{pct(ESG_WEIGHTS[a.industryGroup][i.issue], 0)}</td>
                <td className="py-1.5 text-right font-semibold">{i.score === null ? '—' : num(i.score, 2)}</td>
                <td className="py-1.5 text-right">{i.score === null ? '—' : num(i.weight * i.score, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function IndicatorTable({ a, reviewer, readOnly }: { a: EsgAssessment; reviewer: boolean; readOnly: boolean }) {
  const update = useStore((s) => s.updateIndicator)
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const byCode = Object.fromEntries(a.indicators.map((i) => [i.code, i]))
  const propose = async (code: string) => {
    setBusy(code)
    const def = INDICATOR_BY_CODE[code]
    const ev = a.documents.filter((d) => d.indicatorCodes.includes(code)).map((d) => ({ id: d.id, name: d.name, docType: d.docType, summary: d.extractionSummary, extracted: d.extracted }))
    try {
      const out = await proposeLevel(def, ev, byCode[code]?.selfDeclared)
      await update(a.id, code, { aiLevel: out.data.level ?? undefined, aiRationale: out.data.rationale, aiCitations: out.data.citations, aiMissing: out.data.missing })
      setErrors((e) => ({ ...e, [code]: '' }))
    } catch (e) {
      setErrors((x) => ({ ...x, [code]: `AI chưa đề xuất được: ${e instanceof Error ? e.message : String(e)}` }))
    }
    setBusy(null)
  }
  const proposeAll = async () => {
    for (const d of INDICATORS) if (byCode[d.code]?.finalLevel === undefined && !byCode[d.code]?.na) await propose(d.code)
  }
  const accept = (code: string) => {
    const i = byCode[code]
    update(a.id, code, { finalLevel: i.aiLevel, reviewerNote: undefined })
  }
  const setFinal = (code: string, v: string) => {
    const i: EsgIndicatorResult | undefined = byCode[code]
    if (v === 'na') {
      const reason = prompt('Lý do N/A (bắt buộc — chỉ khi không phát sinh hoạt động liên quan và đã kiểm tra):')
      if (reason) update(a.id, code, { na: true, naReason: reason, finalLevel: undefined })
      return
    }
    const lv = v === '' ? undefined : (Number(v) as IndicatorLevel)
    let note: string | undefined
    if (i?.aiLevel !== undefined && lv !== i.aiLevel) {
      note = prompt(`Bạn đang chọn mức khác đề xuất AI (${i.aiLevel}). Ghi lý do (bắt buộc):`) ?? undefined
      if (!note) return
    }
    update(a.id, code, { finalLevel: lv, na: false, reviewerNote: note })
  }
  return (
    <Card
      title="Chấm 18 chỉ tiêu"
      subtitle={reviewer ? 'Chế độ thẩm định: chấp nhận/sửa đề xuất AI. Sửa khác đề xuất phải ghi lý do.' : 'Doanh nghiệp tải bằng chứng và yêu cầu AI đề xuất. Mức chính thức do người thẩm định FCC xác nhận.'}
      action={!readOnly && !reviewer && <Button size="sm" variant="primary" icon={<Sparkles className="size-4" />} loading={!!busy} onClick={proposeAll}>AI đề xuất các chỉ tiêu chưa có</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-3">
              <th className="px-2 py-2">Mã</th>
              <th className="px-2 py-2">Chỉ tiêu</th>
              <th className="px-2 py-2">Đề xuất AI</th>
              <th className="px-2 py-2">Mức xác nhận</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {INDICATORS.map((d) => {
              const i = byCode[d.code]
              const lvl = i?.finalLevel
              return (
                <tr key={d.code} className={clsx('align-top', i?.redFlag && 'bg-critical-soft/50')}>
                  <td className="px-2 py-2.5">
                    <div className="font-bold">{d.code}</div>
                    {d.criticalFlag && <span title="Chỉ tiêu có cờ trọng yếu" className="text-critical-ink"><Flag className="size-3.5" /></span>}
                  </td>
                  <td className="max-w-xs px-2 py-2.5">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-[11px] text-ink-3">{ISSUES[d.issue].label} · {d.evidence}</div>
                    {i?.selfDeclared && <div className="mt-1 text-[11px] text-ink-2">Tự khai: {i.selfDeclared}</div>}
                  </td>
                  <td className="max-w-md px-2 py-2.5">
                    {i?.aiRationale ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <AiTag />
                          <span className="font-semibold">{i.aiLevel === undefined ? 'Chưa xác minh' : `Mức ${i.aiLevel} — ${d.rubric[i.aiLevel]}`}</span>
                        </div>
                        <p className="text-ink-2">{i.aiRationale}</p>
                        {!!i.aiCitations?.length && <p className="text-[11px] text-brand-dark">Trích dẫn: {i.aiCitations.map((c) => a.documents.find((x) => x.id === c.documentId)?.name ?? c.documentId).join(', ')}</p>}
                        {!!i.aiMissing?.length && <p className="text-[11px] text-warn-ink">Còn thiếu: {i.aiMissing.join('; ')}</p>}
                      </div>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                    {errors[d.code] && <p className="mt-1 text-[11px] text-warn-ink">{errors[d.code]}</p>}
                  </td>
                  <td className="px-2 py-2.5">
                    {reviewer ? (
                      <select aria-label={`Mức ${d.code}`} className="h-8 rounded-lg border border-line px-2 text-[12.5px]" value={i?.na ? 'na' : lvl ?? ''} onChange={(e) => setFinal(d.code, e.target.value)}>
                        <option value="">Chưa xác minh</option>
                        {d.rubric.map((r, k) => <option key={k} value={k}>{k} — {r}</option>)}
                        <option value="na">N/A (có lý do)</option>
                      </select>
                    ) : i?.na ? (
                      <Badge tone="neutral" icon={false}>N/A</Badge>
                    ) : lvl === undefined ? (
                      <Badge tone="warn">Chưa xác minh</Badge>
                    ) : (
                      <span className="font-semibold">Mức {lvl} <span className="font-normal text-ink-3">({25 * lvl}/100)</span></span>
                    )}
                    {i?.na && i.naReason && <p className="mt-1 max-w-48 text-[11px] text-ink-3">{i.naReason}</p>}
                    {i?.reviewerNote && <p className="mt-1 max-w-48 text-[11px] text-ink-3">Ghi chú thẩm định: {i.reviewerNote}</p>}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-col gap-1">
                      {!readOnly && <Button size="sm" variant="ghost" loading={busy === d.code} onClick={() => propose(d.code)}>AI đề xuất</Button>}
                      {reviewer && i?.aiLevel !== undefined && i.finalLevel !== i.aiLevel && <Button size="sm" onClick={() => accept(d.code)}>Chấp nhận AI</Button>}
                      {reviewer && d.criticalFlag && <Button size="sm" variant={i?.redFlag ? 'danger' : 'ghost'} onClick={() => update(a.id, d.code, { redFlag: !i?.redFlag })}>{i?.redFlag ? 'Bỏ cờ' : 'Gắn cờ'}</Button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const KEYWORDS: [RegExp, string[], string][] = [
  [/dien|điện|evn|kwh|solar|mat_troi/i, ['E1', 'E3'], 'Hóa đơn điện'],
  [/nuoc|nước|water/i, ['E2'], 'Hóa đơn nước'],
  [/rac|chat_thai|chất thải|waste/i, ['E4'], 'Hợp đồng/chứng từ chất thải'],
  [/giay_phep|moi_truong|môi trường|dtm|env/i, ['E5'], 'Giấy phép môi trường'],
  [/bhxh|bao_hiem|lao_dong|hop_dong_ld/i, ['S1'], 'Danh sách đóng BHXH'],
  [/an_toan|atld|tai_nan|bao_ho/i, ['S2'], 'Hồ sơ an toàn lao động'],
  [/dao_tao|training/i, ['S3'], 'Kế hoạch đào tạo'],
  [/iso|chat_luong|qc|khieu_nai/i, ['S4', 'S6'], 'Hồ sơ chất lượng'],
  [/bctc|tai_chinh|kiem_toan/i, ['G1'], 'Báo cáo tài chính'],
  [/thue|tax|to_khai/i, ['G2'], 'Tờ khai/chứng từ thuế'],
  [/co_dong|so_huu|ubo/i, ['G3'], 'Danh sách chủ sở hữu'],
  [/quy_tac|ung_xu|tham_nhung|code_of_conduct/i, ['G4'], 'Quy tắc ứng xử'],
]

function Evidence({ a, readOnly }: { a: EsgAssessment; readOnly: boolean }) {
  const add = useStore((s) => s.addEsgDocument)
  const updateMetrics = useStore((s) => s.updateEsgMetrics)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<{ fallback: boolean; error?: string } | null>(null)
  const onFiles = async (files: FileList) => {
    setBusy(true)
    for (const f of [...files]) {
      const isImg = f.type.startsWith('image/') || f.type === 'application/pdf'
      const img = isImg ? await fileToImage(f).catch(() => null) : null
      const kw = KEYWORDS.find(([re]) => re.test(f.name))
      const out = await classifyEvidence(img?.base64 ?? null, f.name, INDICATORS, (): EvidenceExtraction => ({ docType: kw?.[2] ?? 'Chứng từ chưa phân loại', period: '12 tháng gần nhất', indicatorCodes: kw?.[1] ?? [], extracted: {}, summary: `Phân loại theo tên tệp "${f.name}" vì AI không đọc được tài liệu.` }))
      setLast({ fallback: out.fallback, error: out.error })
      add(a.id, { id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: f.name, mime: f.type, dataUrl: img?.dataUrl, docType: out.data.docType, period: out.data.period, indicatorCodes: out.data.indicatorCodes, extracted: out.data.extracted, extractionSummary: out.data.summary, uploadedAt: new Date().toISOString() })
      // số liệu định lượng cho chỉ số năng lượng
      const kwh = Object.entries(out.data.extracted).find(([k]) => /kwh/i.test(k) && !/mặt trời|solar/i.test(k))
      const solar = Object.entries(out.data.extracted).find(([k]) => /mặt trời|solar/i.test(k))
      if (kwh && typeof kwh[1] === 'number') updateMetrics(a.id, { kwh12m: kwh[1] })
      if (solar && typeof solar[1] === 'number') updateMetrics(a.id, { solarKwh12m: solar[1] })
    }
    setBusy(false)
  }
  const m = a.metrics
  const scope2 = m.kwh12m ? (m.kwh12m * GRID_EMISSION_FACTOR.kgPerKwh) / 1000 : null // kWh trên hóa đơn là điện lưới; điện mặt trời tự dùng không phát thải Scope 2
  const avoided = m.solarKwh12m ? (m.solarKwh12m * GRID_EMISSION_FACTOR.kgPerKwh) / 1000 : null
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2" title="Bằng chứng 12 tháng" subtitle="AI phân loại loại chứng từ, kỳ, chỉ tiêu liên quan và trích số liệu định lượng" action={!readOnly && (
        <label className="cursor-pointer">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-dark"><FileUp className="size-4" />{busy ? 'AI đang đọc…' : 'Tải bằng chứng'}</span>
          <input type="file" multiple accept="image/*,application/pdf,.xlsx,.xls,.csv,.docx" className="sr-only" disabled={busy} onChange={(e) => e.target.files && onFiles(e.target.files)} />
        </label>
      )}>
        {last && <div className="mb-3 flex items-center gap-2 text-xs"><AiTag fallback={last.fallback} error={last.error} />{last.error && <span className="text-warn-ink">{last.error} — phân loại theo tên tệp.</span>}</div>}
        {a.documents.length ? (
          <ul className="divide-y divide-line">
            {a.documents.map((d) => (
              <li key={d.id} className="flex gap-3 py-3">
                {d.dataUrl ? <img src={d.dataUrl} alt="" className="size-16 shrink-0 rounded-lg border border-line object-cover" /> : <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted text-[10px] text-ink-3">{d.name.split('.').pop()?.toUpperCase()}</div>}
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="flex flex-wrap items-center gap-1.5"><span className="font-semibold">{d.name}</span></div>
                  <div className="text-xs text-ink-3">{d.docType} · {d.period ?? '—'} · {date(d.uploadedAt)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{d.indicatorCodes.length ? d.indicatorCodes.map((c) => <Badge key={c} tone="brand" icon={false}>{c}</Badge>) : <Badge tone="warn">Chưa gắn chỉ tiêu</Badge>}</div>
                  {d.extractionSummary && <p className="mt-1 text-xs text-ink-2">{d.extractionSummary}</p>}
                  {d.extracted && Object.keys(d.extracted).length > 0 && <p className="mt-0.5 text-xs text-ink-2">{Object.entries(d.extracted).map(([k, v]) => `${k}: ${typeof v === 'number' ? num(v) : v}`).join(' · ')}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Chưa có bằng chứng">Gợi ý: hóa đơn điện/nước 12 tháng, hợp đồng thu gom chất thải, giấy phép môi trường, danh sách đóng BHXH, nhật ký an toàn, BCTC, tờ khai thuế, quy tắc ứng xử.</Empty>
        )}
      </Card>
      <Card title={<span className="flex items-center gap-1.5"><Zap className="size-4 text-brand" /> Chỉ số năng lượng & phát thải</span>}>
        <dl className="space-y-2 text-[13px]">
          <div className="flex justify-between"><dt className="text-ink-3">Điện lưới tiêu thụ 12 tháng</dt><dd className="font-semibold">{m.kwh12m ? `${num(m.kwh12m)} kWh` : '—'}</dd></div>
          <div className="flex justify-between"><dt className="flex items-center gap-1 text-ink-3"><Sun className="size-3.5" />Điện mặt trời tự dùng</dt><dd className="font-semibold">{m.solarKwh12m ? `${num(m.solarKwh12m)} kWh` : '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Tỷ trọng tái tạo</dt><dd className="font-semibold">{m.kwh12m && m.solarKwh12m ? pct(m.solarKwh12m / (m.kwh12m + m.solarKwh12m)) : '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Scope 2 ước tính (lưới)</dt><dd className="font-semibold">{scope2 === null ? '—' : `${num(scope2, 1)} tCO₂e`}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Phát thải tránh được nhờ điện mặt trời</dt><dd className="font-semibold text-good-ink">{avoided === null ? '—' : `${num(avoided, 1)} tCO₂e`}</dd></div>
          {m.bhxhCovered && m.employees && <div className="flex justify-between"><dt className="text-ink-3">Tỷ lệ đóng BHXH</dt><dd className="font-semibold">{pct(m.bhxhCovered / m.employees)}</dd></div>}
        </dl>
        <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-3">Scope 2 = kWh điện lưới × hệ số {GRID_EMISSION_FACTOR.kgPerKwh} kgCO₂/kWh ({GRID_EMISSION_FACTOR.year}). {GRID_EMISSION_FACTOR.source}.</p>
      </Card>
    </div>
  )
}

function Green({ a }: { a: EsgAssessment }) {
  const products = useStore(useShallow((s) => s.products.filter((p) => p.status === 'published' && (p.greenRule || p.eligibility.minEsg !== undefined))))
  const orgMap = useOrgMap()
  const r = computeEsg(a.indicators, a.industryGroup)
  const esg = { score: r.score, coverage: r.coverage, official: a.status === 'official', flags: r.flags.length }
  return (
    <Card title="Tác động của ESG tới nguồn vốn" subtitle="Chỉ liệt kê ưu đãi do tổ chức tài chính cấu hình trong sản phẩm thật — FCC không tự hứa giảm lãi suất">
      <Table head={['Sản phẩm', 'Tổ chức', 'Loại', 'Điều kiện ESG', 'Ưu đãi', 'Trạng thái của bạn']}>
        {products.map((p) => {
          const ok = greenEligible(p, esg)
          const minOk = p.eligibility.minEsg === undefined || (esg.official && esg.score >= p.eligibility.minEsg)
          return (
            <tr key={p.id}>
              <td className="px-3 py-2.5 font-medium">{p.name}</td>
              <td className="px-3 py-2.5">{orgMap[p.lenderId].shortName}</td>
              <td className="px-3 py-2.5 text-ink-2">{PRODUCT_TYPE_LABEL[p.type]}</td>
              <td className="min-w-64 !whitespace-normal px-3 py-2.5 text-ink-2">{[p.eligibility.minEsg !== undefined && `Điều kiện vào: ESG ≥ ${p.eligibility.minEsg}`, p.greenRule && `Ưu đãi: ESG ≥ ${p.greenRule.minEsg}, Coverage ≥ ${pct(p.greenRule.minCoverage, 0)}, không cờ`].filter(Boolean).join(' · ')}</td>
              <td className="px-3 py-2.5 font-semibold text-good-ink">{p.greenRule ? `−${p.greenRule.discountPct}%/năm` : '—'}</td>
              <td className="px-3 py-2.5">{!minOk ? <Badge tone="critical">Chưa đủ điều kiện vào</Badge> : ok ? <Badge tone="good">Được hưởng ưu đãi</Badge> : p.greenRule ? <Badge tone="warn">Chưa đủ ưu đãi</Badge> : <Badge tone="good">Đủ điều kiện</Badge>}</td>
            </tr>
          )
        })}
      </Table>
      {!esg.official && <p className="mt-3 text-xs text-warn-ink">Ưu đãi chỉ áp dụng với điểm ESG chính thức (Coverage ≥ 80%, đã thẩm định).</p>}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3"><Leaf className="size-4" /> Việc công nhận tín dụng/dự án xanh thuộc tổ chức tài chính theo quy định hiện hành về phân loại xanh và quản lý rủi ro môi trường.</p>
    </Card>
  )
}

function Report({ a, reviewer }: { a: EsgAssessment; reviewer: boolean }) {
  const issue = useStore((s) => s.issueEsg)
  const orgMap = useOrgMap()
  const r = computeEsg(a.indicators, a.industryGroup)
  const weak = INDICATORS.map((d) => ({ d, i: a.indicators.find((x) => x.code === d.code) })).filter((x) => !x.i?.na && (x.i?.finalLevel === undefined || x.i.finalLevel <= 2)).sort((x, y) => (x.i?.finalLevel ?? -1) - (y.i?.finalLevel ?? -1))
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2" title="Kế hoạch cải thiện" subtitle="Chỉ tiêu chưa xác minh hoặc ≤ mức 2 — hành động để lên mức kế tiếp">
        <Table head={['Chỉ tiêu', 'Hiện tại', 'Mục tiêu', 'Hành động/bằng chứng cần có']}>
          {weak.map(({ d, i }) => {
            const cur = i?.finalLevel
            const next = Math.min(4, (cur ?? 1) + 1)
            return (
              <tr key={d.code}>
                <td className="min-w-48 !whitespace-normal px-3 py-2"><b>{d.code}</b> {d.name}</td>
                <td className="px-3 py-2">{cur === undefined ? <Badge tone="warn">Chưa xác minh</Badge> : `Mức ${cur}`}</td>
                <td className="px-3 py-2">Mức {next}</td>
                <td className="min-w-64 !whitespace-normal px-3 py-2 text-ink-2">{cur === undefined ? `Nộp: ${d.evidence}` : d.rubric[next]}{i?.aiMissing?.length ? ` — ${i.aiMissing[0]}` : ''}</td>
              </tr>
            )
          })}
        </Table>
      </Card>
      <Card title="Phát hành điểm">
        <dl className="space-y-1.5 text-[13px]">
          <div className="flex justify-between"><dt className="text-ink-3">Doanh nghiệp</dt><dd className="font-medium">{orgMap[a.orgId].shortName}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Kỳ dữ liệu</dt><dd>{a.period}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Điểm</dt><dd className="font-semibold">{num(r.score, 2)} ({r.level} · {ESG_BADGE[r.level]})</dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Coverage</dt><dd>{pct(r.coverage, 0)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Cờ</dt><dd>{r.flags.length}</dd></div>
        </dl>
        {reviewer ? (
          <div className="mt-3 space-y-2">
            <Button className="w-full" variant="primary" disabled={!r.official} onClick={() => issue(a.id, true)}>Phát hành chính thức</Button>
            {!r.official && <p className="text-xs text-warn-ink">Coverage {pct(r.coverage, 0)} &lt; 80% — chỉ lưu tạm tính.</p>}
            <Button className="w-full" onClick={() => issue(a.id, false)}>Lưu điểm tạm tính</Button>
          </div>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-3"><Lock className="mt-px size-3.5 shrink-0" /> Bật “Chế độ người thẩm định FCC” để phát hành.</p>
        )}
        <p className="mt-3 text-[11px] text-ink-3">Điểm ESG là đầu vào bổ trợ đánh giá rủi ro phi tài chính, không thay thế phân tích dòng tiền, lịch sử trả nợ, tài sản bảo đảm hay thẩm định pháp lý. Tái chấm tối thiểu hằng năm hoặc khi có sự cố.</p>
      </Card>
    </div>
  )
}

function BuyerEsg() {
  const org = useActiveOrg()
  const receivables = useStore((s) => s.receivables)
  const consents = useStore((s) => s.consents)
  const own = useStore((s) => s.esg.find((e) => e.orgId === org.id))
  const orgMap = useOrgMap()
  const sc = useScores()
  const nav = useNavigate()
  const suppliers = useMemo(() => {
    const ids = [...new Set(receivables.filter((r) => r.buyerId === org.id).map((r) => r.sellerId))]
    return ids.map((id) => ({ id, spend: receivables.filter((r) => r.buyerId === org.id && r.sellerId === id).reduce((a, r) => a + r.amount, 0), shared: hasConsent(consents, id, org.id, 'esg'), e: sc.esg(id) }))
  }, [receivables, consents, org.id, sc])
  const official = suppliers.filter((s) => s.shared && s.e?.assessment.status === 'official')
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="ESG chuỗi cung ứng" subtitle="Nhà cung cấp xanh = ESG chính thức ≥ 65, còn hiệu lực, không có cờ trọng yếu">
          <Table head={['Nhà cung cấp', 'Giá trị mua', 'ESG', 'E / S / G', 'Coverage', 'Xanh', '']}>
            {suppliers.map((s) => {
              const r = s.e?.result
              const green = s.shared && s.e?.assessment.status === 'official' && r && r.score >= 65 && r.flags.length === 0
              return (
                <tr key={s.id}>
                  <td className="px-3 py-2.5 font-medium">{orgMap[s.id].shortName}</td>
                  <td className="px-3 py-2.5">{(s.spend / 1e6).toLocaleString('vi-VN')} tr ₫</td>
                  <td className="px-3 py-2.5">{s.shared ? <EsgBadge score={r?.score} official={s.e?.assessment.status === 'official'} /> : <span className="flex items-center gap-1 text-xs text-ink-3"><Lock className="size-3.5" />Chưa chia sẻ</span>}</td>
                  <td className="tabular px-3 py-2.5 text-ink-2">{s.shared && r ? `${r.pillars.E?.toFixed(0) ?? '—'} / ${r.pillars.S?.toFixed(0) ?? '—'} / ${r.pillars.G?.toFixed(0) ?? '—'}` : '—'}</td>
                  <td className="px-3 py-2.5">{s.shared && r ? pct(r.coverage, 0) : '—'}</td>
                  <td className="px-3 py-2.5">{green ? <Badge tone="good">Xanh</Badge> : '—'}</td>
                  <td className="px-3 py-2.5">{s.shared && <Button size="sm" variant="ghost" onClick={() => nav(`/esg/${s.id}`)}>Chi tiết</Button>}</td>
                </tr>
              )
            })}
          </Table>
        </Card>
        <Card title="Điểm ESG nhà cung cấp" subtitle="Chỉ nhà cung cấp có điểm chính thức và đồng ý chia sẻ">
          {official.length ? <HBar data={official.map((s) => ({ label: orgMap[s.id].shortName, value: s.e!.result.score, sub: `ESG · ${s.e!.result.level}` }))} format={(v) => num(v, 0)} /> : <Empty title="Chưa có dữ liệu" />}
        </Card>
      </div>
      {own && (
        <Card title={`ESG của ${org.shortName}`} subtitle={own.source === 'disclosure' ? 'AI trích xuất từ báo cáo thường niên/phát triển bền vững (công bố theo TT96/2020) — chưa thẩm định' : undefined} action={<Link className="text-[13px] font-medium text-brand-dark hover:underline" to={`/esg/${org.id}`}>Chi tiết</Link>}>
          {(() => {
            const r = computeEsg(own.indicators, own.industryGroup)
            return (
              <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
                <div className="flex items-baseline gap-2"><span className="text-4xl font-extrabold">{num(r.score, 0)}</span><EsgBadge score={r.score} official={own.status === 'official'} /></div>
                <PillarBars pillars={r.pillars} />
              </div>
            )
          })()}
        </Card>
      )}
    </div>
  )
}

function LenderEsg() {
  const org = useActiveOrg()
  const apps = useStore(useShallow((s) => s.applications.filter((a) => a.lenderId === org.id)))
  const receivables = useStore((s) => s.receivables)
  const consents = useStore((s) => s.consents)
  const orgMap = useOrgMap()
  const sc = useScores()
  const nav = useNavigate()
  const sellers = [...new Set(apps.map((a) => receivables.find((r) => r.id === a.receivableId)!.sellerId))].filter((id) => hasConsent(consents, id, org.id, 'esg'))
  const rows = sellers.map((id) => ({ id, e: sc.esg(id), exposure: apps.filter((a) => a.state === 'FUNDED' && receivables.find((r) => r.id === a.receivableId)?.sellerId === id).reduce((x, a) => x + (a.fundedAmount ?? 0), 0) }))
  return (
    <Card title="ESG danh mục khách hàng" subtitle="Doanh nghiệp đã gửi hồ sơ và đồng ý chia sẻ ESG với tổ chức của bạn">
      <Table head={['Doanh nghiệp', 'ESG', 'Mức', 'Coverage', 'Cờ', 'Dư nợ', '']}>
        {rows.map((x) => (
          <tr key={x.id}>
            <td className="px-3 py-2.5 font-medium">{orgMap[x.id].shortName}</td>
            <td className="px-3 py-2.5"><EsgBadge score={x.e?.result.score} official={x.e?.assessment.status === 'official'} /></td>
            <td className="px-3 py-2.5">{x.e ? x.e.result.level : '—'}</td>
            <td className="px-3 py-2.5">{x.e ? pct(x.e.result.coverage, 0) : '—'}</td>
            <td className="px-3 py-2.5">{x.e?.result.flags.length ? <Badge tone="critical">{x.e.result.flags.length}</Badge> : '—'}</td>
            <td className="px-3 py-2.5">{x.exposure ? `${(x.exposure / 1e6).toLocaleString('vi-VN')} tr ₫` : '—'}</td>
            <td className="px-3 py-2.5">{x.e && <Button size="sm" variant="ghost" onClick={() => nav(`/esg/${x.id}`)}>Chi tiết</Button>}</td>
          </tr>
        ))}
      </Table>
      {!rows.length && <Empty title="Chưa có dữ liệu" />}
      <p className="mt-3 text-xs text-ink-3">Gợi ý: cấu hình ưu đãi xanh trong sản phẩm (Marketplace → Sản phẩm của tôi) để doanh nghiệp có ESG chính thức tự động thấy mức giảm.</p>
    </Card>
  )
}
