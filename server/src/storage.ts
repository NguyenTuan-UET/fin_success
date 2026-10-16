// Kho tệp chứng từ: lưu theo SHA-256 của nội dung gốc (trùng nội dung thì dùng lại), mã hóa AES-256-GCM khi lưu,
// kiểm tra lại SHA-256 khi đọc. CSDL chỉ giữ khóa đối tượng + metadata. Đường dẫn tải là URL ký HMAC có hạn ngắn.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface StoredObject {
  key: string // = sha256 hex của nội dung gốc
  sha256: string
  size: number
  mime: string
}

export class ObjectStore {
  private key: Buffer

  /** dataKey: 32 byte (64 ký tự hex). */
  constructor(private dir: string, dataKey: string) {
    if (!/^[0-9a-f]{64}$/i.test(dataKey)) throw new Error('Khóa mã hóa tệp phải là 64 ký tự hex (32 byte)')
    this.key = Buffer.from(dataKey, 'hex')
    mkdirSync(dir, { recursive: true })
  }

  /** Dev: tạo/đọc khóa ở data/data.key. Staging/production: bắt buộc biến FCC_DATA_KEY. */
  static keyFor(dev: boolean, dataDir: string) {
    if (process.env.FCC_DATA_KEY) return process.env.FCC_DATA_KEY
    if (!dev) throw new Error('Thiếu FCC_DATA_KEY (64 ký tự hex) để mã hóa tệp')
    const p = join(dataDir, 'data.key')
    if (!existsSync(p)) {
      mkdirSync(dataDir, { recursive: true })
      writeFileSync(p, randomBytes(32).toString('hex'), { mode: 0o600 })
    }
    return readFileSync(p, 'utf8').trim()
  }

  private path(key: string) {
    if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Khóa đối tượng không hợp lệ')
    return join(this.dir, key.slice(0, 2), key)
  }

  put(data: Buffer, mime: string): StoredObject {
    const sha256 = createHash('sha256').update(data).digest('hex')
    const p = this.path(sha256)
    if (!existsSync(p)) {
      const iv = randomBytes(12)
      const c = createCipheriv('aes-256-gcm', this.key, iv)
      const enc = Buffer.concat([c.update(data), c.final()])
      mkdirSync(dirname(p), { recursive: true })
      const tmp = `${p}.${randomBytes(4).toString('hex')}.tmp`
      writeFileSync(tmp, Buffer.concat([iv, c.getAuthTag(), enc]), { mode: 0o600 })
      renameSync(tmp, p) // ghi nguyên tử
    }
    return { key: sha256, sha256, size: data.length, mime }
  }

  get(key: string): Buffer {
    const raw = readFileSync(this.path(key))
    const d = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12))
    d.setAuthTag(raw.subarray(12, 28))
    const data = Buffer.concat([d.update(raw.subarray(28)), d.final()])
    if (createHash('sha256').update(data).digest('hex') !== key) throw new Error(`Tệp ${key} không khớp SHA-256`)
    return data
  }

  has(key: string) {
    return existsSync(this.path(key))
  }

  /** URL tải có chữ ký, hết hạn sau ttlSec giây. */
  signedPath(key: string, ttlSec = 300, now = Date.now()) {
    const exp = Math.floor(now / 1000) + ttlSec
    return `/v1/files/${key}?exp=${exp}&sig=${this.sign(key, exp)}`
  }

  verifySigned(key: string, exp: number, sig: string, now = Date.now()) {
    if (!Number.isFinite(exp) || exp < Math.floor(now / 1000)) return false
    const expect = this.sign(key, exp)
    return sig.length === expect.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expect))
  }

  /** Ký một giá trị tùy ý (đường dẫn tải hóa đơn phí…) đến thời điểm exp (giây UNIX). */
  signValue(value: string, exp: number) {
    return createHmac('sha256', this.key).update(`val:${value}:${exp}`).digest('hex')
  }
  verifyValue(value: string, exp: number, sig: string, now = Date.now()) {
    if (!Number.isFinite(exp) || exp < Math.floor(now / 1000)) return false
    const expect = this.signValue(value, exp)
    return sig.length === expect.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expect))
  }

  private sign(key: string, exp: number) {
    return createHmac('sha256', this.key).update(`file:${key}:${exp}`).digest('hex')
  }
}
