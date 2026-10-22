import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Chống tái phát: giao diện và thông báo dùng “đơn vị xuất khẩu / bên nhập khẩu”, không dùng lại chữ cũ.
// Mã nội bộ (supplier, buyer, sellerId, buyerId) giữ nguyên nên không bị quét.
const ROOT = resolve(__dirname, '../..')
const DIRS = ['server/src', 'web/src', 'packages/domain/src', 'sim-bank/src']
const BANNED = /nhà cung cấp|bên mua|người mua|bên bán|người bán|\bSMEs?\b/i
/** Ngoại lệ có chú thích: nhà cung cấp dịch vụ (không phải đơn vị xuất khẩu); thuật ngữ trường hóa đơn điện tử NBan/NMua; tên tệp phương pháp. */
const EXEMPT = new Set(['server/src/integrations/identity-providers.ts', 'web/src/lib/einvoice.ts', 'packages/domain/src/esg.ts'])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (n === 'node_modules' || n === '.next') return []
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}

describe('thuật ngữ sau khi chuyển sang xuất nhập khẩu', () => {
  it('không còn chữ cũ trong mã nguồn (ngoài danh sách ngoại lệ)', () => {
    const hits: string[] = []
    for (const d of DIRS) {
      for (const f of walk(join(ROOT, d))) {
        const rel = relative(ROOT, f)
        if (EXEMPT.has(rel)) continue
        readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (BANNED.test(line)) hits.push(`${rel}:${i + 1}`) })
      }
    }
    expect(hits).toEqual([])
  })
})
