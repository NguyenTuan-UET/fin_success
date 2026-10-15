import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, Loader2, Sparkles, X, XCircle } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function Card({ children, className, title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className={clsx('min-w-0 rounded-xl border border-line bg-white', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink flex-wrap items-center justify-end gap-2">{action}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'good'
export function Button({ variant = 'secondary', size = 'md', loading, icon, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-3.5 text-sm',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-dark',
        variant === 'secondary' && 'border border-line bg-white text-ink hover:bg-muted',
        variant === 'ghost' && 'text-ink-2 hover:bg-muted',
        variant === 'danger' && 'border border-critical/30 bg-white text-critical-ink hover:bg-critical-soft',
        variant === 'good' && 'bg-good-ink text-white hover:opacity-90',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

export type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'serious' | 'critical'
const toneCls: Record<Tone, string> = {
  neutral: 'bg-muted text-ink-2 border-line',
  brand: 'bg-brand-soft text-brand-dark border-brand/20',
  good: 'bg-good-soft text-good-ink border-good/30',
  warn: 'bg-warn-soft text-warn-ink border-warn/40',
  serious: 'bg-serious-soft text-serious-ink border-serious/40',
  critical: 'bg-critical-soft text-critical-ink border-critical/30',
}
const toneIcon: Partial<Record<Tone, ReactNode>> = {
  good: <CheckCircle2 className="size-3.5" aria-hidden />,
  warn: <AlertTriangle className="size-3.5" aria-hidden />,
  serious: <AlertTriangle className="size-3.5" aria-hidden />,
  critical: <XCircle className="size-3.5" aria-hidden />,
}

/** Nhãn trạng thái — luôn có chữ (và icon cho trạng thái), không truyền nghĩa bằng màu đơn thuần. */
export function Badge({ tone = 'neutral', children, icon = true, className }: { tone?: Tone; children: ReactNode; icon?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium', toneCls[tone], className)}>
      {icon && toneIcon[tone]}
      {children}
    </span>
  )
}

export function Stat({ label, value, sub, delta, hint, icon }: { label: string; value: ReactNode; sub?: ReactNode; delta?: { text: string; good: boolean } | null; hint?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4" title={hint}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-3">{label}</span>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
        {delta && <span className={clsx('font-semibold', delta.good ? 'text-good-ink' : 'text-critical-ink')}>{delta.text}</span>}
        {sub}
      </div>
      {hint && (
        <p className="mt-2 flex items-start gap-1 border-t border-line pt-2 text-[11px] leading-snug text-ink-3">
          <Info className="mt-px size-3 shrink-0" aria-hidden />
          {hint}
        </p>
      )}
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <p className="font-medium text-ink-2">{title}</p>
      {children && <p className="mt-1 max-w-md text-[13px] text-ink-3">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal aria-label={title} className={clsx('w-full rounded-xl bg-white shadow-xl', wide ? 'max-w-4xl' : 'max-w-xl')} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button aria-label="Đóng" className="cursor-pointer rounded-md p-1.5 text-ink-3 hover:bg-muted" onClick={onClose}>
            <X className="size-4" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={clsx('-mb-px cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors', value === it.value ? 'border-brand text-brand-dark' : 'border-transparent text-ink-3 hover:text-ink')}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-critical-ink">{error}</span>}
    </label>
  )
}

export const inputCls = 'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'

export function AiTag({ fallback, error }: { fallback?: boolean; error?: string }) {
  return fallback ? (
    <span title={error} className="inline-flex items-center gap-1 rounded-md border border-warn/40 bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn-ink">
      <AlertTriangle className="size-3.5" aria-hidden />
      Theo quy tắc, không phải AI{error ? ' — API lỗi' : ''}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-brand/20 bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand-dark">
      <Sparkles className="size-3.5" aria-hidden />
      AI đề xuất
    </span>
  )
}

export function Callout({ tone = 'brand', title, children }: { tone?: Tone; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={clsx('rounded-lg border px-3 py-2.5 text-[13px]', toneCls[tone])}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

export function Progress({ value, tone = 'brand', label }: { value: number; tone?: 'brand' | 'good' | 'warn' | 'critical'; label: string }) {
  const color = { brand: 'bg-s1', good: 'bg-good', warn: 'bg-warn', critical: 'bg-critical' }[tone]
  return (
    <div role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={clsx('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-3">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-line [&_td]:whitespace-nowrap">{children}</tbody>
      </table>
      {empty}
    </div>
  )
}

export function SampleTag() {
  return <span className="rounded border border-line bg-muted px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-ink-3">Mẫu</span>
}
