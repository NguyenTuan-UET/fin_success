// Adapter loại A: website do chính doanh nghiệp khai. Đọc trang chủ và tối đa 3 trang chứng nhận/giới thiệu cùng máy chủ,
// tìm các chứng nhận công bố (ISO…). Kết quả chỉ để gợi ý bằng chứng ESG cho người thẩm định.
import type { Org } from '@fcc/domain/types'
import { registerAdapter, type Adapter } from './engine'

const CERTS: [RegExp, string][] = [
  [/iso\s*9001/i, 'ISO 9001 (quản lý chất lượng)'],
  [/iso\s*14001/i, 'ISO 14001 (quản lý môi trường)'],
  [/iso\s*45001|ohsas\s*18001/i, 'ISO 45001 (an toàn sức khỏe nghề nghiệp)'],
  [/iso\s*50001/i, 'ISO 50001 (quản lý năng lượng)'],
  [/iso\s*27001/i, 'ISO 27001 (an toàn thông tin)'],
  [/iso\s*22000|haccp/i, 'ISO 22000/HACCP (an toàn thực phẩm)'],
  [/\bfsc\b/i, 'FSC (chứng nhận rừng/chuỗi hành trình)'],
  [/sa\s*8000|bsci|sedex/i, 'Tuân thủ lao động (SA8000/BSCI/Sedex)'],
]

const text = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')

export const companyWebsite: Adapter = {
  name: 'company-website',
  parserVersion: 'company-website@1.0',
  targets(org: Org) {
    if (!org.website) return []
    try {
      const u = new URL(org.website)
      return [u.toString(), `${u.origin}/chung-nhan`, `${u.origin}/gioi-thieu`, `${u.origin}/about`].filter((x, i, a) => a.indexOf(x) === i)
    } catch {
      return []
    }
  },
  parse(raw) {
    const home = raw[0]
    if (!home || !/<html|<body|<!doctype/i.test(home.body)) throw new Error('Trang chủ không phải HTML hợp lệ')
    const all = raw.map((r) => text(r.body)).join(' ')
    const found = CERTS.filter(([re]) => re.test(all)).map(([, label]) => label)
    const title = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(home.body)?.[1]?.trim()
    const out: { field: string; value: string }[] = []
    if (found.length) out.push({ field: 'Chứng nhận công bố trên website', value: found.join('; ') })
    if (title) out.push({ field: 'Tiêu đề website', value: title })
    return out
  },
}
registerAdapter(companyWebsite)
