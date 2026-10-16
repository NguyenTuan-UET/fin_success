import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'

const N = 16384
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const h = scryptSync(password, salt, 32, { N })
  return `scrypt$${N}$${salt.toString('hex')}$${h.toString('hex')}`
}
export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, salt, hash] = stored.split('$')
  if (alg !== 'scrypt') return false
  const h = scryptSync(password, Buffer.from(salt, 'hex'), 32, { N: Number(n) })
  const want = Buffer.from(hash, 'hex')
  return h.length === want.length && timingSafeEqual(h, want)
}
export const newToken = () => randomBytes(32).toString('hex')
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

/** Giới hạn số lần thất bại theo khóa (email/IP/người dùng) trong cửa sổ trượt. */
export class FailureLimiter {
  private hits = new Map<string, number[]>()
  constructor(private max = 5, private windowMs = 15 * 60_000) {}
  private recent(key: string, now: number) {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs)
    this.hits.set(key, arr)
    return arr
  }
  blocked(key: string, now = Date.now()) {
    return this.recent(key, now).length >= this.max
  }
  fail(key: string, now = Date.now()) {
    this.recent(key, now).push(now)
  }
  clear(key: string) {
    this.hits.delete(key)
  }
}
