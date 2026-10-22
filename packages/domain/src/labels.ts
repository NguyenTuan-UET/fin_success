// Nhãn hiển thị dùng chung cho server và giao diện. Mã nội bộ (supplier, buyer) giữ nguyên.
import type { OrgType } from './types'

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  supplier: 'Đơn vị xuất khẩu',
  buyer: 'Bên nhập khẩu',
  lender: 'Tổ chức tài chính',
  fcc: 'Nhân sự FCC',
}

/** Dạng viết thường để chèn giữa câu */
export const orgTypeInSentence = (t: OrgType) => ORG_TYPE_LABEL[t].toLowerCase().replace('nhân sự fcc', 'nhân sự FCC')
