export function vnd(v: number, compact = true) {
  if (!compact) return `${Math.round(v).toLocaleString('vi-VN')} ₫`
  const a = Math.abs(v)
  if (a >= 1e12) return `${(v / 1e12).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} nghìn tỷ ₫`
  if (a >= 1e9) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ ₫`
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr ₫`
  return `${Math.round(v).toLocaleString('vi-VN')} ₫`
}

export function num(v: number, digits = 0) {
  return v.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function pct(v: number, digits = 1) {
  return `${(v * 100).toLocaleString('vi-VN', { maximumFractionDigits: digits })}%`
}

export function date(s?: string) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
}

export function dateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
}

export function daysFromNow(s: string) {
  return Math.round((new Date(s).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86_400_000)
}

export function median(xs: number[]) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export async function sha256(text: string | ArrayBuffer) {
  const buf = typeof text === 'string' ? new TextEncoder().encode(text) : new Uint8Array(text)
  const h = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
