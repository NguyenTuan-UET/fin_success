/** Thông tin tham khảo từ trang công khai của ngân hàng, không phải sản phẩm do đối tác đăng trên FCC. */
export interface PublicProduct {
  id: string
  lender: string
  name: string
  category: string
  description: string
  eligibility: string
  advanceUpToPct?: number
  note?: string
  sourceUrl: string
  checkedAt: string
}

export const PUBLIC_PRODUCTS: PublicProduct[] = [
  {
    id: 'bidv-supplier-finance', lender: 'BIDV', name: 'Tài trợ nhà cung cấp', category: 'Tài trợ chuỗi cung ứng',
    description: 'Tài trợ vốn ngắn hạn cho bên bán dựa trên việc bên mua chấp nhận thanh toán và chuyển nhượng khoản phải thu; quản lý công nợ qua BIDV SCF.',
    eligibility: 'Bên bán trong chuỗi cung ứng có khoản phải thu được bên mua chấp nhận thanh toán.',
    sourceUrl: 'https://bidv.com.vn/vn/doanh-nghiep/san-pham-dich-vu/tai-tro-chuoi-cung-ung/tai-tro-nha-cung-cap', checkedAt: '2026-10-12',
  },
  {
    id: 'techcombank-domestic-factoring', lender: 'Techcombank', name: 'Bao thanh toán nội địa', category: 'Bao thanh toán',
    description: 'Nhà cung cấp có thể đề nghị ứng trước sau khi giao hàng và xuất hóa đơn trên cơ sở hợp đồng và chứng từ giao nhận. Techcombank công bố mức ứng trước tối đa 100% giá trị khoản phải thu.',
    eligibility: 'Nhà cung cấp có hợp đồng, chứng từ mua bán và giao hàng; xác nhận thanh toán của bên mua nếu có.',
    advanceUpToPct: 100, note: 'Trang nguồn nêu giải ngân trong vòng 3 giờ từ khi nhà cung cấp gửi đề nghị ứng trước; điều kiện thực tế do ngân hàng xác nhận.',
    sourceUrl: 'https://techcombank.com/khach-hang-doanh-nghiep/thuong-mai/dich-vu-noi-dia/tai-tro-thuong-mai/bao-thanh-toan-noi-dia', checkedAt: '2026-10-12',
  },
  {
    id: 'techcombank-samsung-factoring', lender: 'Techcombank', name: 'Bao thanh toán nhà cung cấp Samsung', category: 'Bao thanh toán có truy đòi',
    description: 'Ứng trước có truy đòi đối với khoản phải thu từ Samsung, kèm dịch vụ quản lý và thu hộ khoản phải thu.',
    eligibility: 'Nhà cung cấp Samsung có khoản phải thu phát sinh từ bán hàng hoặc cung ứng dịch vụ.',
    advanceUpToPct: 90,
    sourceUrl: 'https://techcombank.com/khach-hang-doanh-nghiep/vay/vay-von-luu-dong/tai-tro-bao-thanh-toan-danh-cho-nha-cung-cap-samsung', checkedAt: '2026-10-12',
  },
  {
    id: 'mb-multitier-scf', lender: 'MB', name: 'Tài trợ chuỗi cung ứng đa tầng', category: 'Tài trợ chuỗi cung ứng',
    description: 'MB giới thiệu gói sản phẩm và nền tảng tài trợ chuỗi cung ứng đa tầng cho doanh nghiệp.',
    eligibility: 'Trang nguồn chưa công bố điều kiện tham gia; cần liên hệ MB để xác nhận.',
    sourceUrl: 'https://www.mbbank.com.vn/836/846/2668/Chi-tiet/goi-san-pham-va-nen-tang-tai-tro-chuoi-cung-ung-da-tang-2026-5-13-18-44-15', checkedAt: '2026-10-12',
  },
]
