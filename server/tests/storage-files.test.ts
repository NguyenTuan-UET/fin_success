import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { ObjectStore } from '../src/storage'

const dir = mkdtempSync(join(tmpdir(), 'fcc-objects-'))
const store = new ObjectStore(dir, randomBytes(32).toString('hex'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('kho tệp mã hóa, định danh theo SHA-256', () => {
  const data = Buffer.from('<HDon><DLHDon>hóa đơn thử</DLHDon></HDon>')
  const sha = createHash('sha256').update(data).digest('hex')

  it('lưu và đọc lại đúng nội dung; khóa là SHA-256; tệp trên đĩa đã mã hóa', () => {
    const o = store.put(data, 'application/xml')
    expect(o).toEqual({ key: sha, sha256: sha, size: data.length, mime: 'application/xml' })
    expect(store.get(sha).equals(data)).toBe(true)
    const onDisk = readFileSync(join(dir, sha.slice(0, 2), sha))
    expect(onDisk.includes(Buffer.from('hóa đơn thử'))).toBe(false)
  })

  it('cùng nội dung không tạo bản thứ hai', () => {
    store.put(data, 'application/xml')
    expect(readdirSync(join(dir, sha.slice(0, 2)))).toEqual([sha])
  })

  it('tệp bị sửa trên đĩa thì không đọc được', () => {
    const p = join(dir, sha.slice(0, 2), sha)
    const raw = readFileSync(p)
    raw[raw.length - 1] ^= 0xff
    writeFileSync(p, raw)
    expect(() => store.get(sha)).toThrow()
  })

  it('URL ký có hạn: đúng chữ ký và còn hạn mới hợp lệ', () => {
    const now = Date.now()
    const u = new URL(`http://x${store.signedPath(sha, 60, now)}`)
    const exp = Number(u.searchParams.get('exp'))
    const sig = u.searchParams.get('sig')!
    expect(store.verifySigned(sha, exp, sig, now)).toBe(true)
    expect(store.verifySigned(sha, exp, sig, now + 61_000)).toBe(false)
    expect(store.verifySigned(sha, exp + 1, sig, now)).toBe(false)
    expect(() => store.get('../../etc/passwd')).toThrow('không hợp lệ')
  })
})
