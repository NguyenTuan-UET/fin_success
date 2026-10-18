import { describe, expect, it } from 'vitest'
import { redactAuditDetail } from '../src/views'

describe('nhật ký hiển thị cho FCC được tối thiểu hóa', () => {
  it('ẩn số tiền, lãi suất và kết quả chấm điểm; giữ phần mô tả còn lại', () => {
    expect(redactAuditDetail('Tạo khoản phải thu', 'Đông Á · 2.000.000.000 ₫ · nguồn xml')).toBe('Đông Á · [số tiền] · nguồn xml')
    expect(redactAuditDetail('Đối tác đưa đề nghị chính thức', '5,9%/năm, ứng 1.600.000.000 ₫')).toBe('[lãi suất], ứng [số tiền]')
    expect(redactAuditDetail('Chấm điểm tín dụng tham khảo', 'ABC: BBB 60 (bao phủ 21%)')).toBe('[kết quả chấm điểm đã ẩn]')
    expect(redactAuditDetail('Ghi nhận tiền về', 'phí 0, lãi 0, gốc 720.000.000 · tất toán')).toBe('phí 0, lãi 0, gốc [số tiền] · tất toán')
    expect(redactAuditDetail('Gửi lời mời xác nhận', 'Tới Đông Á')).toBe('Tới Đông Á')
  })
})
