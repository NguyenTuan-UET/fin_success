import { useState } from 'react'
import { num } from '../lib/format'
import { AlertTriangle, ChevronDown, ChevronUp, FileSearch, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { AiTag, Badge, Button, Progress, type Tone } from './ui'
import type { ScoreResult } from '@fcc/domain/credit'
import type { Rating, ReceivableState } from '@fcc/domain/types'
import { ESG_BADGE, esgLevel } from '@fcc/domain/esg'
import { explainScore, templateExplanation, type AiOutcome } from '../lib/ai'

export const STATE_META: Record<ReceivableState, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Nháp', tone: 'neutral' },
  BUYER_PENDING: { label: 'Chờ bên mua xác nhận', tone: 'warn' },
  BUYER_CONFIRMED: { label: 'Bên mua đã xác nhận', tone: 'good' },
  BUYER_DISPUTED: { label: 'Tranh chấp', tone: 'critical' },
  SUBMITTED: { label: 'Đã gửi đối tác', tone: 'brand' },
  UNDER_REVIEW: { label: 'Đang thẩm định', tone: 'brand' },
  OFFERED: { label: 'Có đề nghị tài trợ', tone: 'brand' },
  ACCEPTED: { label: 'Đã chấp thuận', tone: 'brand' },
  FUNDED: { label: 'Đã giải ngân', tone: 'good' },
  SETTLED: { label: 'Đã tất toán', tone: 'neutral' },
  EARLY_PAID: { label: 'Thanh toán sớm', tone: 'neutral' },
  REJECTED: { label: 'Bị từ chối', tone: 'critical' },
  OVERDUE: { label: 'Quá hạn', tone: 'critical' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
}

export function StateBadge({ state }: { state: ReceivableState }) {
  const m = STATE_META[state]
  return <Badge tone={m.tone}>{m.label}</Badge>
}

export function ratingTone(r: Rating): Tone {
  return r === 'AAA' || r === 'AA' || r === 'A' ? 'good' : r === 'BBB' ? 'brand' : r === 'BB' ? 'warn' : 'critical'
}

export function RatingBadge({ score, provisional }: { score: ScoreResult | { rating: Rating; score: number }; provisional?: boolean }) {
  return (
    <Badge tone={ratingTone(score.rating)} icon={false} className="tabular">
      <span className="font-bold">{score.rating}</span>
      <span className="opacity-75">· {num(score.score, 0)}</span>
      {provisional && <span className="opacity-75">· tạm tính</span>}
    </Badge>
  )
}

export function EsgBadge({ score, official = true }: { score?: number | null; official?: boolean }) {
  if (score === undefined || score === null) return <span className="text-xs text-ink-3">Chưa có</span>
  const lv = esgLevel(score)
  const tone: Tone = lv === 'Tốt' ? 'good' : lv === 'Khá' ? 'brand' : lv === 'Trung bình' ? 'warn' : 'critical'
  return (
    <Badge tone={tone} icon={false} className="tabular">
      <span className="font-bold">{num(score, 0)}</span>
      <span className="opacity-75">· {ESG_BADGE[lv]}</span>
      {!official && <span className="opacity-75">· tạm tính</span>}
    </Badge>
  )
}

/** Thẻ điểm tín dụng: tổng, khoảng, thành phần, yếu tố, cờ, giải thích AI. */
export function ScorePanel({ score, orgName, compact }: { score: ScoreResult; orgName: string; compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  const [ex, setEx] = useState<AiOutcome<string> | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    setEx(await explainScore(orgName, score, () => templateExplanation(orgName, score)))
    setBusy(false)
  }
  const missing = score.factors.filter((f) => f.points === null && !f.na)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className="text-xs font-medium text-ink-3">Xếp hạng tham khảo FCC</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={clsx('text-4xl font-extrabold tracking-tight', { good: 'text-good-ink', brand: 'text-brand-dark', warn: 'text-warn-ink', critical: 'text-critical-ink', neutral: 'text-ink', serious: 'text-serious-ink' }[ratingTone(score.rating)])}>{score.rating}</span>
            <span className="tabular text-xl font-semibold text-ink">{num(score.score, 1)}</span>
            <span className="text-sm text-ink-3">/100</span>
          </div>
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          <div className="flex justify-between text-xs text-ink-3">
            <span>Độ bao phủ dữ liệu</span>
            <span className="tabular font-semibold text-ink-2">{Math.round(score.coverage * 100)}%</span>
          </div>
          <Progress value={score.coverage * 100} tone={score.coverage >= 0.75 ? 'good' : 'warn'} label="Độ bao phủ dữ liệu" />
          <div className="text-xs text-ink-3">
            {score.official ? (
              <Badge tone="good">Điểm chính thức</Badge>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-1">
                <Badge tone="warn">Tạm tính – chưa đủ cơ sở</Badge>
                <span className="tabular">khoảng {num(score.min, 0)}–{num(score.max, 0)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {score.flags.length > 0 && (
        <div className="rounded-lg border border-critical/30 bg-critical-soft px-3 py-2 text-[13px] text-critical-ink">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4" aria-hidden /> Cờ rủi ro — chuyển thẩm định tăng cường (không tự từ chối)
          </p>
          <ul className="mt-1 list-disc pl-5">
            {score.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {score.missingMandatory.length > 0 && <p className="text-xs text-warn-ink">Thiếu chỉ tiêu bắt buộc: {score.missingMandatory.join(', ')}</p>}

      <div className="space-y-2">
        {score.components.map((c) => (
          <div key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-2">
                {c.label} <span className="text-ink-3">· {Math.round(c.weight * 100)}%</span>
              </span>
            </div>
            <span className="tabular w-14 text-right text-[13px] font-semibold">{c.score === null ? <span className="font-normal text-ink-3">thiếu</span> : num(c.score, 0)}</span>
            <div className="col-span-2">
              <Progress value={c.score ?? 0} tone={c.score === null ? 'warn' : c.score >= 70 ? 'good' : c.score >= 50 ? 'brand' : 'critical'} label={c.label} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-good-ink">
            <TrendingUp className="size-3.5" aria-hidden /> Kéo điểm lên
          </p>
          <ul className="space-y-1 text-[13px] text-ink-2">
            {score.positives.length ? score.positives.map((f) => <li key={f.code}>• {f.reason} <span className="text-ink-3">({f.raw})</span></li>) : <li className="text-ink-3">—</li>}
          </ul>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-critical-ink">
            <TrendingDown className="size-3.5" aria-hidden /> Kéo điểm xuống
          </p>
          <ul className="space-y-1 text-[13px] text-ink-2">
            {score.negatives.length ? score.negatives.map((f) => <li key={f.code}>• {f.reason} <span className="text-ink-3">({f.raw})</span></li>) : <li className="text-ink-3">—</li>}
            {missing.slice(0, 2).map((f) => (
              <li key={f.code} className="text-warn-ink">• Thiếu: {f.name}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-page p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Sparkles className="size-4 text-brand" aria-hidden /> Nhận xét & gợi ý cải thiện
          </p>
          <div className="flex items-center gap-2">
            {ex && <AiTag fallback={ex.fallback} error={ex.error} />}
            <Button size="sm" onClick={run} loading={busy}>
              {ex ? 'Tạo lại' : 'Tạo nhận xét AI'}
            </Button>
          </div>
        </div>
        {ex ? (
          <>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{ex.data}</p>
            {ex.error && <p className="mt-1 text-xs text-warn-ink">Không gọi được {ex.model}: {ex.error}. Đang hiển thị nhận xét dựng từ reason code.</p>}
          </>
        ) : (
          <p className="mt-1 text-xs text-ink-3">AI chỉ diễn giải từ reason code của bộ chấm điểm, không tạo số liệu mới và không khuyến nghị cho vay.</p>
        )}
      </div>

      <div>
        <button onClick={() => setOpen(!open)} className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-brand-dark hover:underline">
          <FileSearch className="size-4" aria-hidden />
          {open ? 'Ẩn' : 'Xem'} chi tiết {score.factors.length} chỉ tiêu & nguồn dữ liệu
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {open && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-3">
                  <th className="px-2 py-1.5">Mã</th>
                  <th className="px-2 py-1.5">Chỉ tiêu</th>
                  <th className="px-2 py-1.5">Giá trị</th>
                  <th className="px-2 py-1.5 text-right">Điểm</th>
                  <th className="px-2 py-1.5">Nguồn</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {score.factors.map((f) => (
                  <tr key={f.code} className={clsx(f.flag && 'bg-critical-soft/60')}>
                    <td className="px-2 py-1.5 font-semibold text-ink-3">{f.code}</td>
                    <td className="px-2 py-1.5">{f.name}</td>
                    <td className="px-2 py-1.5 text-ink-2">{f.raw}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{f.na ? <span className="font-normal text-ink-3">N/A</span> : f.points === null ? <span className="font-normal text-warn-ink">thiếu</span> : f.points}</td>
                    <td className="px-2 py-1.5 text-ink-3">{f.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-ink-3">Phiên bản bộ chấm: {score.version}. Xếp hạng tham khảo FCC — không phải quyết định tín dụng, xếp hạng CIC hay xếp hạng nội bộ ngân hàng.</p>
          </div>
        )}
      </div>
    </div>
  )
}
