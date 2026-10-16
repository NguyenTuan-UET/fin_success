import type { DataSource } from '@fcc/domain/types'

/** Danh mục nguồn dữ liệu đang được hệ thống sử dụng thật (cấu hình tham chiếu, không lưu trong DB). */
export const SOURCES: DataSource[] = [
  { id: 'src-vnstock', name: 'vnstock (Fundamental, Market, Reference)', kind: 'vnstock', owner: 'Thư viện vnstock — dữ liệu từ VCI', dataFields: 'BCTC quý/năm, giá, vốn hóa', legalBasis: 'Theo giấy phép vnstock của đơn vị vận hành', personalData: false, rateLimit: '60 lượt/phút (Community)', status: 'approved', note: 'Chạy bằng scripts/fetch_listed.py; ý kiến kiểm toán và diện cảnh báo không có trong vnstock nên để mặc định' },
  { id: 'src-upload', name: 'Doanh nghiệp tải lên (BCTC, hóa đơn, chứng từ ESG, file công nợ)', kind: 'upload', owner: 'Doanh nghiệp', dataFields: 'Tài liệu, số liệu', legalBasis: 'Đồng ý của doanh nghiệp', personalData: true, rateLimit: '—', status: 'approved', note: 'AI trích xuất, người dùng/người thẩm định xác nhận' },
]
