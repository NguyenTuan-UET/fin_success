// Gửi email: SMTP qua nodemailer khi cấu hình SMTP_URL (ví dụ smtps://user:pass@smtp.congty.vn:465), ngược lại chỉ ghi log
// (môi trường dev/test). Hàng đợi email_outbox có thử lại lũy thừa; mỗi thư có dedupe_key nên cùng một thông báo không gửi hai lần.
import nodemailer from 'nodemailer'
import type { Database } from '../state'

export interface Mailer {
  send(m: { to: string; subject: string; text: string }): Promise<void>
}

export function createMailer(url = process.env.SMTP_URL, from = process.env.MAIL_FROM ?? 'FCC <no-reply@fcc.local>', log: (msg: string) => void = console.log): Mailer {
  if (!url) {
    return { async send(m) { log(`[email:log-only] tới ${m.to} · ${m.subject}`) } }
  }
  const t = nodemailer.createTransport(url)
  return { async send(m) { await t.sendMail({ from, to: m.to, subject: m.subject, text: m.text }) } }
}

/** Phân loại thông báo để người dùng chọn loại nhận. */
export const EMAIL_KINDS = {
  confirm: 'Cần bạn xác nhận (hóa đơn, đề nghị)',
  quote: 'Báo giá và RFQ',
  offer: 'Đề nghị tài trợ và hồ sơ',
  funding: 'Giải ngân, thu hồi, tất toán',
  alert: 'Quá hạn và cảnh báo',
  account: 'Tài khoản và thành viên (luôn gửi)',
  other: 'Khác',
} as const
export type EmailKind = keyof typeof EMAIL_KINDS

export function emailKind(title: string): EmailKind {
  const t = title.toLowerCase()
  if (/quá hạn|cờ|cảnh báo|tranh chấp/.test(t)) return 'alert'
  if (/giải ngân|tất toán|thanh toán|tiền về|hoàn|đã thu/.test(t)) return 'funding'
  if (/báo giá|rfq/.test(t)) return 'quote'
  if (/đề nghị|hồ sơ/.test(t)) return 'offer'
  if (/xác nhận|điều chỉnh/.test(t)) return 'confirm'
  return 'other'
}

const MAX_ATTEMPTS = 8

/** Gửi một lô thư đến hạn. Lỗi tạm thời thì hẹn lại (30 giây × 2^n, tối đa 1 giờ); quá 8 lần thì ngừng. */
export async function deliverEmails(db: Database, mailer: Mailer, now: () => Date) {
  const batch = await db.claimEmails(20, now())
  for (const m of batch) {
    try {
      await mailer.send({ to: m.to, subject: m.subject, text: m.body })
      await db.emailResult(m.id, { ok: true })
    } catch (e) {
      const attempts = m.attempts + 1
      await db.emailResult(m.id, { ok: false, error: (e as Error).message.slice(0, 300), dead: attempts >= MAX_ATTEMPTS, nextAttemptAt: new Date(now().getTime() + Math.min(3600_000, 30_000 * 2 ** (attempts - 1))) })
    }
  }
  return batch.length
}
