// Mã số thuế (MST) doanh nghiệp Việt Nam: 10 chữ số, hoặc 13 chữ số dạng 10-3 cho đơn vị phụ thuộc.
// Dùng để kiểm tra kết quả OCR và gợi ý (không tự sửa) tổ chức đã đăng ký gần khớp.

export function normalizeTaxCode(s: string) {
  return s.replace(/[\s.]/g, '').replace(/-/g, '')
}

/** null nếu đúng định dạng; ngược lại là lý do. */
export function taxCodeProblem(s: string): string | null {
  const raw = s.trim()
  if (!raw) return 'Chưa có MST'
  const n = normalizeTaxCode(raw)
  if (!/^\d+$/.test(n)) return 'MST chỉ gồm chữ số (có thể có dấu gạch 10-3)'
  if (n.length !== 10 && n.length !== 13) return `MST có ${n.length} chữ số — MST doanh nghiệp có 10 chữ số (hoặc 13 với đơn vị phụ thuộc)`
  return null
}

/** Khoảng cách chỉnh sửa (thêm/bớt/thay một ký tự). */
export function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\b(cong ty|cty|co phan|cp|tnhh|mtv|jsc|co\.?,? ltd|company|limited)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

export interface TaxMatch<T> {
  /** Khớp đúng MST */
  exact?: T
  /** Gợi ý gần khớp — người dùng phải tự chọn, không tự gán */
  suggestions: { org: T; reason: string }[]
}

/** Đối chiếu MST (và tên) đọc được với danh sách tổ chức đã đăng ký. */
export function matchTaxCode<T extends { taxCode: string; name: string; shortName?: string }>(taxCode: string, name: string, orgs: T[]): TaxMatch<T> {
  const n = normalizeTaxCode(taxCode)
  const exact = n ? orgs.find((o) => normalizeTaxCode(o.taxCode) === n) : undefined
  if (exact) return { exact, suggestions: [] }
  const out: { org: T; reason: string }[] = []
  for (const o of orgs) {
    const d = n ? editDistance(n, normalizeTaxCode(o.taxCode)) : Infinity
    if (d === 1) out.push({ org: o, reason: `MST chỉ khác 1 chữ số (${o.taxCode}) — có thể OCR đọc thừa/thiếu/sai một số` })
    else if (name && normName(name) && [o.name, o.shortName ?? ''].some((x) => normName(x) && (normName(x) === normName(name) || normName(x).includes(normName(name)) || normName(name).includes(normName(x)))))
      out.push({ org: o, reason: `Tên gần khớp “${o.name}”, MST ${o.taxCode}` })
  }
  return { suggestions: out.slice(0, 3) }
}
