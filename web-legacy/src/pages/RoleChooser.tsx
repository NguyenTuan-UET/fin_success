const PARTIES = [
  { path: 'supplier', label: 'Nhà cung cấp', desc: 'Tạo hóa đơn, gửi RFQ, chấp thuận đề nghị, ESG, dòng tiền' },
  { path: 'buyer', label: 'Bên mua', desc: 'Xác nhận hóa đơn, thanh toán, đề nghị thanh toán sớm' },
  { path: 'lender', label: 'Tổ chức tài chính', desc: 'Đăng sản phẩm, báo giá RFQ, thẩm định, giải ngân' },
  { path: 'fcc', label: 'Nhân sự FCC', desc: 'Thẩm định và phát hành điểm ESG chính thức (không cần cho luồng tài trợ)' },
] as const

/** Mỗi vai trò có một trang riêng, tự vào phiên của vai trò đó. Mở mỗi vai trò ở một tab. */
export function RoleChooser() {
  return (
    <div className="grid min-h-full place-items-center bg-page p-4">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold tracking-tight">FCC · Fast Cash Connect</h1>
        <p className="mb-4 text-[13px] text-ink-3">Chọn vai trò để vào. Mỗi vai trò có một trang riêng; mở mỗi vai trò ở một tab để chạy luồng từ đầu đến cuối.</p>
        <div className="space-y-2">
          {PARTIES.map((p) => (
            <a key={p.path} href={`/${p.path}`} className="block rounded-xl border border-line px-4 py-3 hover:border-brand hover:bg-brand-soft/40">
              <div className="font-semibold">/{p.path} — {p.label}</div>
              <div className="text-[13px] text-ink-3">{p.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
