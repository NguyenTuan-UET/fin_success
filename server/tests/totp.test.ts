import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { base32Decode, base32Encode, hotp, totp, verifyTotp } from '../src/auth/totp'
import { seal, unseal } from '../src/auth/seal'

describe('TOTP theo RFC 6238', () => {
  // Vector kiểm thử RFC 6238 phụ lục B (SHA1, khóa "12345678901234567890", 8 chữ số)
  const key = Buffer.from('12345678901234567890')
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('t=%i → %s', (t, code) => {
    expect(hotp(key, Math.floor(t / 30), 8)).toBe(code)
  })

  it('base32 hai chiều; mã hiện tại hợp lệ, lệch quá 1 bước thì không', () => {
    const secret = base32Encode(randomBytes(20))
    expect(base32Decode(secret)).toHaveLength(20)
    const now = Date.now()
    expect(verifyTotp(secret, totp(secret, now), now)).not.toBeNull()
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).not.toBeNull()
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBeNull()
    expect(verifyTotp(secret, 'abcdef', now)).toBeNull()
  })

  it('mã hóa secret khi lưu: giải mã đúng, sai khóa thì lỗi', () => {
    const k = randomBytes(32)
    const s = seal(k, 'JBSWY3DPEHPK3PXP')
    expect(s).not.toContain('JBSWY3DPEHPK3PXP')
    expect(unseal(k, s)).toBe('JBSWY3DPEHPK3PXP')
    expect(() => unseal(randomBytes(32), s)).toThrow()
  })
})
