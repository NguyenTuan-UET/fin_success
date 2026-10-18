"use client";

import { PageHeader } from "@/components/ui/basic";
import { MembersSection } from "@/components/screens/Members";

// Quyền = loại tổ chức + vai trò + đối tượng/trạng thái + phạm vi được chia sẻ (đối chiếu server/src/auth/roles.ts).
// "Chủ tổ chức" chỉ có quyền trong phạm vi loại tổ chức của mình, không vượt sang nghiệp vụ của loại tổ chức khác.
type Perm = { what: string; roles: string; mfa: boolean; limit: string };
const MATRIX: { org: string; perms: Perm[] }[] = [
  {
    org: "Nhà cung cấp",
    perms: [
      { what: "Tạo, sửa, hủy khoản phải thu", roles: "Chủ tổ chức · Người phê duyệt · Người lập hồ sơ", mfa: false, limit: "Chỉ hóa đơn của tổ chức mình; sửa sau xác nhận làm xác nhận cũ mất hiệu lực" },
      { what: "Gửi yêu cầu báo giá, chọn báo giá, chấp thuận đề nghị", roles: "Chủ tổ chức · Người phê duyệt", mfa: true, limit: "Khoản đã được bên mua xác nhận; người lập hồ sơ không tự duyệt" },
      { what: "Chia sẻ dữ liệu cho bên nhận", roles: "Chủ tổ chức · Người phê duyệt", mfa: true, limit: "Theo từng bên nhận, mục đích và thời hạn; thu hồi có hiệu lực với truy cập mới" },
    ],
  },
  {
    org: "Bên mua",
    perms: [
      { what: "Xác nhận hoặc tranh chấp khoản phải thu", roles: "Chủ tổ chức · Người phê duyệt", mfa: true, limit: "Chỉ khoản ghi tên mình là bên mua; bên bán không xác nhận hộ" },
      { what: "Báo đã thanh toán, đề nghị thanh toán sớm", roles: "Chủ tổ chức · Người phê duyệt", mfa: true, limit: "Tiền chuyển trực tiếp tới bên tài trợ; FCC không nhận tiền" },
    ],
  },
  {
    org: "Tổ chức tài chính",
    perms: [
      { what: "Trả báo giá, thẩm định, đưa đề nghị hoặc từ chối", roles: "Chủ tổ chức · Chuyên viên thẩm định", mfa: false, limit: "Chỉ hồ sơ gửi tới sản phẩm của mình; tổ chức phải được FCC xác minh" },
      { what: "Ghi nhận giải ngân, tiền về, hoàn phần dư", roles: "Chủ tổ chức · Chuyên viên thẩm định", mfa: true, limit: "Theo chứng từ ngân hàng; không sửa số tiền đã giải ngân" },
      { what: "Đăng sản phẩm Marketplace", roles: "Chủ tổ chức · Quản lý sản phẩm", mfa: false, limit: "Chỉ hiển thị sau khi FCC duyệt trình bày; FCC không quyết định giá" },
    ],
  },
  {
    org: "FCC",
    perms: [
      { what: "Xác minh tổ chức, duyệt KYC người đại diện, duyệt sản phẩm", roles: "Quản trị FCC · Vận hành FCC", mfa: true, limit: "Không quyết định tín dụng hay giải ngân; không xem chứng từ của doanh nghiệp" },
      { what: "Xử lý cờ hóa đơn, ghi đối chiếu thuế", roles: "Quản trị FCC · Vận hành FCC", mfa: false, limit: "Chỉ thông tin tối thiểu của khoản có cờ" },
      { what: "Thẩm định và phát hành điểm ESG, điểm tín dụng", roles: "Quản trị FCC · Thẩm định tín dụng/ESG", mfa: true, limit: "Chỉ khi độ bao phủ đạt ngưỡng; không sửa sau phát hành" },
      { what: "Đề xuất và duyệt phiên bản bộ chấm điểm", roles: "Chủ mô hình (đề xuất) · hai người khác duyệt", mfa: true, limit: "Người đề xuất không tự duyệt; không đổi kết quả đã phát hành" },
      { what: "Tạo biểu phí", roles: "Quản trị FCC", mfa: true, limit: "Chỉ áp dụng từ ngày hiệu lực; không đổi phí đã phát sinh" },
      { what: "Xem nhật ký kiểm toán", roles: "Mọi vai trò FCC · Kiểm toán (chỉ đọc)", mfa: false, limit: "Số tiền, lãi suất và điểm của tổ chức khác được ẩn; mỗi lần kiểm toán viên truy cập được ghi vết" },
    ],
  },
  {
    org: "Mọi tổ chức",
    perms: [
      { what: "Mời thành viên, đổi vai trò, thu hồi", roles: "Chủ tổ chức (FCC: Quản trị FCC)", mfa: true, limit: "Chỉ vai trò thuộc loại tổ chức của mình; không bỏ được chủ tổ chức cuối cùng" },
    ],
  },
];

export default function AdminMembers() {
  return (
    <>
      <PageHeader eyebrow="Quản trị FCC" title="Thành viên & quyền" sub="Thành viên của FCC, lời mời, lịch sử thay đổi quyền và ma trận quyền theo loại tổ chức, vai trò và đối tượng. Mọi quyền được kiểm tra trên máy chủ." />
      <MembersSection history />
      <section className="card flush">
        <div className="ch"><h2 className="ct">Ma trận quyền</h2><span className="muted">Quyền = loại tổ chức + vai trò + đối tượng/trạng thái + phạm vi được chia sẻ</span></div>
        <div className="tw"><table>
          <thead><tr><th>Chức năng</th><th>Vai trò được làm</th><th>MFA</th><th>Giới hạn bắt buộc</th></tr></thead>
          <tbody>
            {MATRIX.flatMap(({ org, perms }) => [
              <tr key={org}><th colSpan={4} style={{ background: "var(--surface-2)" }}>{org}</th></tr>,
              ...perms.map((p) => (
              <tr key={`${org}-${p.what}`}>
                <td className="wrap">{p.what}</td>
                <td className="wrap">{p.roles}</td>
                <td>{p.mfa ? <span className="chip c-info">Cần MFA</span> : <span className="muted">—</span>}</td>
                <td className="wrap muted">{p.limit}</td>
              </tr>
            ))])}
          </tbody></table></div>
        <div className="muted" style={{ padding: "12px 16px" }}>Chủ tổ chức có mọi quyền trong phạm vi loại tổ chức của mình, không có quyền nghiệp vụ của loại tổ chức khác (ví dụ chủ nhà cung cấp không trả báo giá hay giải ngân).</div>
      </section>
    </>
  );
}
