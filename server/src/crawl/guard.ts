// Chống SSRF và kiểm tra robots.txt cho crawler.
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const CRAWL_UA = process.env.CRAWL_USER_AGENT ?? 'FCC-Bot/1.0 (public read by registered tax code; contact: devtamin04@users.noreply.github.com)'

const PRIVATE = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./]
export function isPrivateIp(ip: string) {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  return PRIVATE.some((r) => r.test(v4))
}

/** Chỉ http/https tới máy chủ công khai (không IP nội bộ, localhost). allowPrivate chỉ dùng trong kiểm thử. */
export async function assertPublicUrl(raw: string, allowPrivate = false): Promise<URL> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error('Địa chỉ không hợp lệ')
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Chỉ hỗ trợ http/https')
  if (u.username || u.password) throw new Error('Địa chỉ không được chứa thông tin đăng nhập')
  if (allowPrivate) return u
  if (u.hostname === 'localhost' || u.hostname.endsWith('.local') || u.hostname.endsWith('.internal')) throw new Error('Không truy cập địa chỉ nội bộ')
  const ips = isIP(u.hostname) ? [u.hostname] : (await lookup(u.hostname, { all: true })).map((a) => a.address)
  if (!ips.length || ips.some(isPrivateIp)) throw new Error('Không truy cập địa chỉ nội bộ')
  return u
}

/** robots.txt: nhóm User-agent khớp "*" hoặc "FCC-Bot"; Disallow/Allow theo tiền tố dài nhất. */
export function robotsAllows(robotsTxt: string, path: string, agent = 'fcc-bot'): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []
  let cur: (typeof groups)[number] | null = null
  let lastWasAgent = false
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line)
    if (!m) continue
    const k = m[1].toLowerCase()
    const v = m[2].trim()
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }))
      cur.agents.push(v.toLowerCase())
      lastWasAgent = true
    } else if ((k === 'disallow' || k === 'allow') && cur) {
      cur.rules.push({ allow: k === 'allow', path: v })
      lastWasAgent = false
    } else lastWasAgent = false
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)))
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'))
  let best: { allow: boolean; len: number } | null = null
  for (const g of chosen) for (const r of g.rules) {
    if (r.path === '') continue
    if (path.startsWith(r.path.replace(/\*$/, '')) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length }
  }
  return best ? best.allow : true
}

/** Dấu hiệu trang yêu cầu xác thực/CAPTCHA/chặn truy cập tự động → dừng, không thử vượt. */
export function detectBlock(status: number, body: string): string | null {
  if ([401, 403, 407, 429, 451].includes(status)) return `Máy chủ từ chối truy cập tự động (HTTP ${status})`
  const head = body.slice(0, 200_000).toLowerCase()
  if (/g-recaptcha|h-captcha|cf-turnstile|captcha|mã xác thực|ma xac thuc/.test(head)) return 'Trang yêu cầu CAPTCHA/mã xác thực'
  if (/<input[^>]+type=["']?password/.test(head)) return 'Trang yêu cầu đăng nhập'
  if (/attention required|checking your browser|access denied|just a moment/.test(head) && status >= 400) return 'Trang chặn truy cập tự động'
  return null
}
