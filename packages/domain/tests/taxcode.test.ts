import { describe, expect, it } from 'vitest'
import { editDistance, matchTaxCode, taxCodeProblem } from '../src/taxcode'

const orgs = [
  { taxCode: '9980000002', name: 'Công ty CP Demo Bên Mua', shortName: 'Demo Bên Mua' },
  { taxCode: '0101234567', name: 'Công ty TNHH Xây dựng Đông Á', shortName: 'Đông Á' },
]

describe('MST từ OCR', () => {
  it('định dạng: 10 hoặc 13 chữ số', () => {
    expect(taxCodeProblem('9980000002')).toBeNull()
    expect(taxCodeProblem('0101234567-001')).toBeNull()
    expect(taxCodeProblem('99800000002')).toContain('11 chữ số') // thừa một số 0 như phản hồi F04
    expect(taxCodeProblem('99800A0002')).toContain('chữ số')
    expect(taxCodeProblem('')).toBe('Chưa có MST')
  })
  it('khoảng cách chỉnh sửa', () => {
    expect(editDistance('99800000002', '9980000002')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
  })
  it('khớp đúng thì trả exact; lệch một chữ số thì chỉ gợi ý, không tự gán', () => {
    expect(matchTaxCode('998 000 0002', '', orgs).exact?.shortName).toBe('Demo Bên Mua')
    const m = matchTaxCode('99800000002', 'Demo Ben Mua', orgs)
    expect(m.exact).toBeUndefined()
    expect(m.suggestions.map((s) => s.org.shortName)).toEqual(['Demo Bên Mua'])
    expect(m.suggestions[0].reason).toContain('1 chữ số')
  })
  it('MST sai hẳn nhưng tên khớp thì gợi ý theo tên', () => {
    const m = matchTaxCode('1111111111', 'CONG TY TNHH XAY DUNG DONG A', orgs)
    expect(m.suggestions.map((s) => s.org.taxCode)).toEqual(['0101234567'])
  })
  it('không khớp gì thì không gợi ý', () => {
    expect(matchTaxCode('5555555555', 'Công ty Khác', orgs).suggestions).toEqual([])
  })
})
