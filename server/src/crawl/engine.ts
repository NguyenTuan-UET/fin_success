// Khung crawl nguồn công khai. Quy tắc (SPEC v2.0 mục 9.2): nguồn chưa phê duyệt không chạy; chỉ crawl theo MST cần tra cứu; giới hạn tần suất;
// user-agent định danh; tôn trọng robots.txt; gặp CAPTCHA/đăng nhập thì dừng và chuyển tra cứu thủ công; lưu bản chụp có băm và phiên bản parser;
// parser lỗi thì không ghi dữ liệu mà đưa vào hàng đợi ngoại lệ.
import { createHash } from 'node:crypto'
import type { DataSource, ExternalRecord, Org } from '@fcc/domain/types'
import type { Core } from '../core'
import { uid } from '../core'
import type { State } from '../state'
import { assertPublicUrl, CRAWL_UA, detectBlock, robotsAllows } from './guard'

export interface FetchResult {
  url: string
  status: number
  body: string
}
export interface Adapter {
  name: string
  parserVersion: string
  /** Địa chỉ cần đọc cho tổ chức này (không có thì không có gì để crawl) */
  targets(org: Org): string[]
  /** Chuyển nội dung thô thành bản ghi chuẩn hóa; ném lỗi nếu cấu trúc không đúng kỳ vọng */
  parse(raw: FetchResult[], org: Org): { field: string; value: string }[]
}

export interface CrawlOptions {
  fetchImpl?: typeof fetch
  /** Cho phép địa chỉ nội bộ (chỉ kiểm thử) */
  allowPrivate?: boolean
  /** Khoảng cách tối thiểu giữa hai yêu cầu tới cùng máy chủ (ms) */
  minIntervalMs?: number
  sleep?: (ms: number) => Promise<void>
}

const adapters = new Map<string, Adapter>()
export const registerAdapter = (a: Adapter) => adapters.set(a.name, a)
export const getAdapter = (name?: string) => (name ? adapters.get(name) : undefined)
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

async function politeFetch(core: Core, rawUrl: string, opt: CrawlOptions): Promise<FetchResult> {
  const f = opt.fetchImpl ?? fetch
  const u = await assertPublicUrl(rawUrl, opt.allowPrivate)
  const host = u.host
  const now = () => core.clock().getTime()
  const h = await core.db.host(host)
  if (h?.blockedUntil && h.blockedUntil.getTime() > now()) throw Object.assign(new Error(`Máy chủ ${host} đang bị tạm dừng crawl đến ${h.blockedUntil.toISOString()}`), { block: true })
  // robots.txt (cache 24 giờ)
  let robots = h?.robotsTxt ?? null
  if (robots === null || !h?.robotsAt || now() - h.robotsAt.getTime() > 86_400_000) {
    try {
      const r = await f(`${u.origin}/robots.txt`, { headers: { 'user-agent': CRAWL_UA }, signal: AbortSignal.timeout(10_000), redirect: 'manual' })
      robots = r.status === 200 ? await r.text() : ''
    } catch {
      robots = ''
    }
    await core.db.touchHost(host, { robotsTxt: robots, robotsAt: core.clock() })
  }
  if (!robotsAllows(robots, u.pathname + u.search)) throw Object.assign(new Error('robots.txt không cho phép đường dẫn này'), { robots: true })
  // giới hạn tần suất theo máy chủ
  const interval = opt.minIntervalMs ?? 5000
  if (h?.lastRequestAt) {
    const wait = interval - (now() - h.lastRequestAt.getTime())
    if (wait > 0) await (opt.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))))(wait)
  }
  await core.db.touchHost(host, { lastRequestAt: core.clock() })
  const res = await f(u.toString(), { headers: { 'user-agent': CRAWL_UA, accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(15_000), redirect: 'follow' })
  const body = (await res.text()).slice(0, 2_000_000)
  const blocked = detectBlock(res.status, body)
  if (blocked) {
    await core.db.touchHost(host, { blockedUntil: new Date(now() + 24 * 3600_000) }) // ngừng 24 giờ, không thử vượt
    throw Object.assign(new Error(blocked), { block: true })
  }
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`)
  return { url: res.url || u.toString(), status: res.status, body }
}

/** Chạy một việc crawl. Trả về trạng thái cuối. */
export async function runCrawlJob(core: Core, job: { id: string; sourceId: string; orgId: string; taxCode: string; attempts: number }, opt: CrawlOptions = {}) {
  const src: DataSource | undefined = await core.db.dataSource(job.sourceId)
  const done = (status: 'done' | 'manual_needed' | 'failed' | 'queued', extra: { reason?: string; result?: unknown; error?: string; retryAt?: Date } = {}) => core.db.finishCrawl(job.id, { status, ...extra }).then(() => status)
  if (!src || src.status !== 'approved') return done('failed', { error: 'Nguồn chưa được phê duyệt — không chạy' })
  const adapter = getAdapter(src.adapter)
  if (src.sourceClass !== 'A' || !adapter) return done('manual_needed', { reason: 'Nguồn không cho tự động hóa — FCC tra cứu thủ công' })
  const org = core.getState().orgs.find((o) => o.id === job.orgId)
  if (!org || org.taxCode !== job.taxCode) return done('failed', { error: 'Tổ chức không còn khớp MST' }) // chỉ crawl theo MST đã đăng ký
  const targets = adapter.targets(org)
  if (!targets.length) return done('failed', { error: 'Không có địa chỉ để đọc cho tổ chức này' })

  const raw: FetchResult[] = []
  try {
    for (const [i, t] of targets.slice(0, 4).entries()) {
      try {
        raw.push(await politeFetch(core, t, opt))
      } catch (e) {
        // trang đầu là bắt buộc; các trang phụ (không tồn tại, 404…) bỏ qua, nhưng chặn/robots thì dừng toàn bộ
        const x = e as Error & { block?: boolean; robots?: boolean }
        if (i === 0 || x.block) throw e
        if (x.robots) continue
      }
    }
  } catch (e) {
    const err = e as Error & { block?: boolean; robots?: boolean }
    if (err.block) return done('manual_needed', { reason: `Dừng crawl: ${err.message}. Chuyển tra cứu thủ công.` })
    if (err.robots) return done('failed', { error: err.message })
    if (job.attempts < 3) return done('queued', { error: err.message, retryAt: new Date(core.clock().getTime() + 5 * 60_000 * job.attempts) })
    return done('failed', { error: err.message })
  }

  // lưu bản chụp thô (bất biến, SHA-256) trước khi phân tích
  const snapshots: { id: string; url: string; hash: string }[] = []
  for (const r of raw) {
    const stored = core.files.put(Buffer.from(r.body, 'utf8'), 'text/html')
    const id = uid('SN')
    await core.db.addSnapshot({ id, sourceId: src.id, orgId: org.id, taxCode: org.taxCode, url: r.url, statusCode: r.status, contentHash: stored.sha256, objectKey: stored.key, parserVersion: adapter.parserVersion })
    snapshots.push({ id, url: r.url, hash: stored.sha256 })
  }
  let parsed: { field: string; value: string }[]
  try {
    parsed = adapter.parse(raw, org)
  } catch (e) {
    // nguồn đổi định dạng: không ghi dữ liệu sai, báo hàng đợi ngoại lệ
    await core.audit(org.id, undefined, 'Parser lỗi — chuyển ngoại lệ', src.id, (e as Error).message)
    return done('failed', { error: `Parser ${adapter.parserVersion} lỗi: ${(e as Error).message}` })
  }

  const snap = snapshots[0]
  await core.serial(async () => {
    const draft: State = { ...core.getState() }
    const now = core.clock().toISOString()
    // giữ bản ghi thủ công/đang khiếu nại; thay bản ghi tự động cũ cùng trường
    const keep = draft.external.filter((x) => !(x.orgId === org.id && x.sourceId === src.id && !x.manual && !x.disputed && parsed.some((p) => p.field === x.field)))
    draft.external = [
      ...parsed.map<ExternalRecord>((p) => ({ id: uid('X'), orgId: org.id, sourceId: src.id, field: p.field, value: p.value, fetchedAt: now, url: snap.url, contentHash: sha(p.value + snap.hash), snapshotId: snap.id, parserVersion: adapter.parserVersion })),
      ...keep,
    ]
    draft.audit = [{ id: uid('EV'), at: now, actorOrgId: org.id, action: 'Crawl nguồn công khai', entity: src.id, detail: `${parsed.length} bản ghi từ ${snapshots.length} trang` }, ...draft.audit]
    await core.commit(draft)
  })
  return done('done', { result: { records: parsed.length, snapshots: snapshots.map((s) => s.id) } })
}

/** Xếp việc crawl cho các nguồn loại A đã phê duyệt và có địa chỉ cho tổ chức. */
export async function enqueueForOrg(core: Core, orgId: string) {
  const org = core.getState().orgs.find((o) => o.id === orgId)
  if (!org || org.type === 'fcc') return 0
  let n = 0
  for (const s of await core.db.dataSources()) {
    const a = getAdapter(s.adapter)
    if (s.status !== 'approved' || s.sourceClass !== 'A' || !a || !a.targets(org).length) continue
    if (await core.db.enqueueCrawl({ sourceId: s.id, orgId, taxCode: org.taxCode })) n++
  }
  return n
}

export async function processQueue(core: Core, opt: CrawlOptions = {}, limit = 5) {
  const jobs = await core.db.claimCrawl(limit, core.clock())
  for (const j of jobs) await runCrawlJob(core, j, opt).catch((e) => core.db.finishCrawl(j.id, { status: 'failed', error: (e as Error).message }))
  return jobs.length
}
