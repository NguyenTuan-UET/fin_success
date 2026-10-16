// Mã hóa giá trị bí mật nhỏ lưu trong CSDL (secret TOTP…) bằng AES-256-GCM với khóa dữ liệu của máy chủ.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function seal(key: Buffer, plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `v1.${Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')}`
}

export function unseal(key: Buffer, sealed: string): string {
  if (!sealed.startsWith('v1.')) throw new Error('Định dạng giá trị mã hóa không hỗ trợ')
  const raw = Buffer.from(sealed.slice(3), 'base64')
  const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
  d.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8')
}
