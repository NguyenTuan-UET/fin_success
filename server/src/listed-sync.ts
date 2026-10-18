// Tự động lấy dữ liệu niêm yết từ vnstock: chạy scripts/fetch_listed.py (Python, venv có vnstock) cho từng bên mua đã được FCC xác minh mã,
// ghi JSON vào listedDir rồi nạp vào hệ thống bằng đúng hành động refreshListed. Server vẫn chỉ đọc file, không nhận dữ liệu từ trình duyệt.
import { execFile } from 'node:child_process'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import type { Org } from '@fcc/domain/types'
import type { Core } from './core'
import { actions } from './service'

export interface ListedFetcher {
  /** Python trong venv có vnstock */
  python: string
  /** Đường dẫn scripts/fetch_listed.py */
  script: string
  timeoutMs?: number
  /** Thay thế việc chạy script (kiểm thử) */
  run?: (symbol: string, org: Org, outDir: string) => Promise<void>
  /** Phút giữ dữ liệu "còn mới" trong giờ giao dịch (mặc định 15) và ngoài giờ (mặc định 360) */
  freshMinOpen?: number
  freshMinClosed?: number
  /** Giãn cách giữa hai lần chạy script (mỗi lần ~7 lượt gọi vnstock; bản Cộng đồng 60 lượt/phút). Mặc định 15 giây */
  gapMs?: number
  sleep?: (ms: number) => Promise<void>
}

export interface SyncResult { symbol: string; orgId: string; status: 'updated' | 'fresh' | 'failed'; error?: string }

const inflight = new Map<string, Promise<void>>()
/** Kết quả lần đồng bộ gần nhất theo mã, để FCC thấy mã nào đang lỗi */
export const syncStatus = new Map<string, { at: string; ok: boolean; error?: string }>()
let syncing: Promise<SyncResult[]> | undefined

/** Giờ giao dịch HOSE/HNX: thứ Hai–thứ Sáu, 9:00–15:00 giờ Việt Nam. */
export function marketOpen(now: Date) {
  const v = new Date(now.getTime() + 7 * 3600_000)
  const d = v.getUTCDay()
  return d >= 1 && d <= 5 && v.getUTCHours() >= 9 && v.getUTCHours() < 15
}

export function fileAgeMs(listedDir: string, symbol: string, now: Date): number {
  try {
    return now.getTime() - statSync(join(listedDir, `${symbol}.json`)).mtimeMs
  } catch {
    return Infinity
  }
}

const isFresh = (f: ListedFetcher, listedDir: string, symbol: string, now: Date) =>
  fileAgeMs(listedDir, symbol, now) < (marketOpen(now) ? f.freshMinOpen ?? 15 : f.freshMinClosed ?? 360) * 60_000

/** Chạy script lấy dữ liệu một mã; các lần gọi đồng thời cùng mã dùng chung một tiến trình. */
export function fetchListedFile(f: ListedFetcher, org: Org, listedDir: string): Promise<void> {
  const symbol = org.listedSymbol?.toUpperCase() ?? ''
  if (!/^[A-Z0-9]{2,6}$/.test(symbol)) return Promise.reject(new Error('Mã chứng khoán không hợp lệ'))
  const running = inflight.get(symbol)
  if (running) return running
  const p = (f.run
    ? f.run(symbol, org, listedDir)
    : new Promise<void>((ok, fail) =>
        // đối số truyền dạng mảng, không qua shell
        execFile(f.python, [f.script, symbol, '--tax-code', org.taxCode, '--exchange', org.exchange ?? 'HOSE', '--out', listedDir], { timeout: f.timeoutMs ?? 180_000, maxBuffer: 1 << 20 }, (err, _out, stderr) =>
          err ? fail(new Error(String(stderr || err.message).trim().split('\n').slice(-3).join(' | '))) : ok(),
        ),
      )
  ).finally(() => inflight.delete(symbol))
  inflight.set(symbol, p)
  return p
}

/** Bên mua niêm yết đã được FCC xác minh ánh xạ MST ↔ mã (điều kiện của refreshListed). */
export const syncTargets = (core: Core) =>
  core.getState().orgs.filter((o) => o.type === 'buyer' && o.listedSymbol && o.listedVerified?.symbol === o.listedSymbol)

/** Làm mới dữ liệu cho mọi bên mua đủ điều kiện; mã còn mới (theo giờ giao dịch) thì bỏ qua trừ khi force. Lỗi một mã không chặn mã khác.
 *  Chỉ một lượt đồng bộ chạy tại một thời điểm; gọi trong lúc đang chạy thì nhận kết quả của lượt đó. */
export function syncListed(core: Core, f: ListedFetcher, opt: { force?: boolean; log?: (m: string) => void } = {}): Promise<SyncResult[]> {
  syncing ??= runSync(core, f, opt).finally(() => (syncing = undefined))
  return syncing
}

async function runSync(core: Core, f: ListedFetcher, opt: { force?: boolean; log?: (m: string) => void }): Promise<SyncResult[]> {
  const out: SyncResult[] = []
  const sleep = f.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let ran = false
  for (const org of syncTargets(core)) {
    const symbol = org.listedSymbol!.toUpperCase()
    if (!opt.force && isFresh(f, core.opt.listedDir, symbol, core.clock()) && core.getState().listed.some((l) => l.orgId === org.id)) {
      out.push({ symbol, orgId: org.id, status: 'fresh' })
      continue
    }
    if (ran) await sleep(f.gapMs ?? 15_000)
    ran = true
    try {
      await fetchListedFile(f, org, core.opt.listedDir)
      await core.mutate({ kind: 'system', orgId: org.id, label: 'Hệ thống' }, (c) => actions.refreshListed(c, symbol))
      syncStatus.set(symbol, { at: core.clock().toISOString(), ok: true })
      out.push({ symbol, orgId: org.id, status: 'updated' })
    } catch (e) {
      // lỗi thì giữ nguyên dữ liệu đã nạp trước đó; lần sau thử lại
      const error = e instanceof Error ? e.message : String(e)
      syncStatus.set(symbol, { at: core.clock().toISOString(), ok: false, error })
      opt.log?.(`vnstock ${symbol}: ${error}`)
      out.push({ symbol, orgId: org.id, status: 'failed', error })
    }
  }
  return out
}
