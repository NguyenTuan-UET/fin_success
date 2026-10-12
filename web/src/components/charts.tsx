// Biểu đồ theo quy tắc dataviz: nét mảnh, lưới mờ, một trục, tooltip, legend khi ≥ 2 chuỗi, màu chuỗi cố định thứ tự.
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ForecastPoint } from '../domain/cashflow'
import { date, vnd } from '../lib/format'

const C = { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', grid: '#e1e0d9', axis: '#898781', ink: '#0b0b0b', ink2: '#52514e', critical: '#d03b3b' }
const tick = { fill: C.axis, fontSize: 11 }

function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-2">
            {r.color && <span className="inline-block h-0.5 w-3 rounded" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="tabular font-semibold text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

const SERIES = [
  { key: 'base', label: 'Cơ sở (trễ trung vị)', color: C.s1 },
  { key: 'conservative', label: 'Thận trọng (trễ p80)', color: C.s2 },
  { key: 'optimistic', label: 'Lạc quan', color: C.s3 },
] as const

export function CashflowChart({ points, height = 260, threshold = 0 }: { points: ForecastPoint[]; height?: number; threshold?: number }) {
  const data = points.map((p) => ({ ...p, base: p.base / 1e6, conservative: p.conservative / 1e6, optimistic: p.optimistic / 1e6 }))
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chú giải">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: C.critical }} />
          Ngưỡng tối thiểu
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} tickFormatter={(v: string) => v.slice(8, 10) + '/' + v.slice(5, 7)} minTickGap={28} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ` : `${v.toFixed(0)} tr`)} />
          <ReferenceLine y={threshold / 1e6} stroke={C.critical} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: C.axis, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? <TipBox title={`Ngày ${date(String(label))}`} rows={SERIES.map((s) => ({ label: s.label, value: vnd((payload.find((p) => p.dataKey === s.key)?.value as number) * 1e6), color: s.color }))} /> : null
            }
          />
          {SERIES.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Thanh ngang một chuỗi (độ lớn) — tiêu đề card đặt tên chuỗi nên không cần legend. */
export function HBar({ data, height, format = vnd, color = C.s1 }: { data: { label: string; value: number; sub?: string }[]; height?: number; format?: (v: number) => string; color?: string }) {
  const h = height ?? Math.max(120, data.length * 52 + 20)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={10}>
        <CartesianGrid stroke={C.grid} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={170} tick={{ fill: C.ink2, fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={({ active, payload }) => (active && payload?.length ? <TipBox title={String(payload[0].payload.label)} rows={[{ label: payload[0].payload.sub ?? 'Giá trị', value: format(payload[0].value as number) }]} /> : null)} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} label={{ position: 'right', fill: C.ink2, fontSize: 11, formatter: (v: unknown) => format(Number(v)) }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PriceLine({ data, height = 160 }: { data: { date: string; close: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} tickFormatter={(v: string) => v.slice(5, 7) + '/' + v.slice(2, 4)} minTickGap={40} />
        <YAxis tick={tick} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} tickFormatter={(v: number) => (v / 1000).toFixed(1) + 'k'} />
        <Tooltip cursor={{ stroke: C.axis }} content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={date(String(label))} rows={[{ label: 'Giá đóng cửa', value: `${Number(payload[0].value).toLocaleString('vi-VN')} ₫` }]} /> : null)} />
        <Line type="monotone" dataKey="close" stroke={C.s1} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function QuarterBars({ data, height = 180 }: { data: { period: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="period" tick={tick} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} />
        <YAxis tick={tick} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tỷ`} />
        <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={String(label)} rows={[{ label: 'Giá trị', value: vnd(Number(payload[0].value)) }]} /> : null)} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.period} fill={d.value < 0 ? C.critical : C.s1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
