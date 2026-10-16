// TOTP theo RFC 6238 (HMAC-SHA1, bước 30 giây, 6 chữ số) — tương thích Google Authenticator, Microsoft Authenticator…
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch)
    if (i < 0) throw new Error('Chuỗi base32 không hợp lệ')
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export const newTotpSecret = () => base32Encode(randomBytes(20))

/** Mã tại bước thời gian `counter`. */
export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', secret).update(msg).digest()
  const off = h[h.length - 1] & 0xf
  const code = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(code % 10 ** digits).padStart(digits, '0')
}

export function totp(secretB32: string, at = Date.now(), step = 30, digits = 6) {
  return hotp(base32Decode(secretB32), Math.floor(at / 1000 / step), digits)
}

/** Kiểm tra mã, chấp nhận lệch ±1 bước. Trả về bước khớp (để chặn dùng lại cùng mã), hoặc null. */
export function verifyTotp(secretB32: string, code: string, at = Date.now(), step = 30): number | null {
  if (!/^\d{6}$/.test(code)) return null
  const key = base32Decode(secretB32)
  const now = Math.floor(at / 1000 / step)
  for (const w of [0, -1, 1]) {
    const expect = hotp(key, now + w)
    if (timingSafeEqual(Buffer.from(expect), Buffer.from(code))) return now + w
  }
  return null
}

export function otpauthUri(secretB32: string, account: string, issuer = 'FCC') {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}
