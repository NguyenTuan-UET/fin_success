# Báo cáo kiểm thử production FCC

**Ngày kiểm thử:** 19/10/2026 (Asia/Bangkok)  
**Môi trường:** https://fin-success.vercel.app/  
**Phạm vi:** Kiểm tra thủ công các màn chính theo vai trò và chạy trọn luồng tài trợ bằng dữ liệu QA. Hệ thống hiển thị “Ngân hàng giả lập · không có giao dịch tiền thật”.

## Kết quả luồng giao dịch

Đã chạy thành công:

1. Nhà cung cấp tải XML QA, tạo `INV-003` trị giá 20.000.000 đ và gửi Bên mua.
2. Tải lại cùng XML bị chặn là trùng, không tạo thêm hóa đơn.
3. Bên mua xác nhận phiên bản 1 của `INV-003`.
4. Nhà cung cấp gửi RFQ `RFQ-EACC1060` cho gói QA đã được FCC duyệt.
5. Tổ chức tài chính báo giá 80%, lãi 8%/năm, phí 0 đ.
6. Nhà cung cấp chọn báo giá; tổ chức tài chính bắt đầu thẩm định và gửi đề nghị 16.000.000 đ.
7. Nhà cung cấp chấp thuận; tổ chức tài chính ghi nhận giải ngân giả lập.
8. Bên mua báo đã trả 20.000.000 đ; tổ chức tài chính ghi nhận tiền về.
9. Hệ thống phân bổ 16.000.000 đ vào gốc, ghi lãi 0 đ, tạo phần dư 4.000.000 đ; tổ chức tài chính ghi nhận đã hoàn đủ phần dư.
10. Nhà cung cấp hiển thị `INV-003` ở trạng thái Đã tất toán. Gói tài trợ QA đã được tạm dừng.

Nhật ký kiểm toán sau kiểm thử có 52 sự kiện; chức năng kiểm tra báo chuỗi băm hợp lệ.

## Lỗi phát hiện

### P1 — Chi phí hiệu dụng năm cao gấp 100 lần

Marketplace hiển thị chi phí hiệu dụng `988,6–1.389,8%/năm` cho hóa đơn 20.000.000 đ, ứng 16.000.000 đ, phí 48.000 đ, kỳ hạn 59 ngày. Theo chính các số hiển thị, chi phí là 254.904–358.356 đ và tiền thực nhận 15.952.000 đ, nên chi phí hiệu dụng quy năm xấp xỉ **9,89–13,90%**, thấp hơn đúng 100 lần.

**Tái hiện:** Nhà cung cấp → Marketplace → chọn `INV-003` → xem cột “Chi phí hiệu dụng/năm”. Đây là số liệu có thể ảnh hưởng trực tiếp đến lựa chọn gói vốn.

### P1 — Ngày nghiệp vụ lệch một ngày so với ngày hiển thị

Thanh tiêu đề hiển thị 19/10/2026, nhưng biểu mẫu ngày lập hóa đơn và ngày trả có `max=18/10/2026`. Các màn hóa đơn và thu hồi ghi một số sự kiện là 18/10, trong khi lịch sử hoạt động cho cùng luồng ghi thao tác vào 19/10. Vì vậy, lần giải ngân và thu hồi QA cùng ngày 18/10 được tính lãi 0 đ, dù giao diện đang báo ngày 19/10.

**Tái hiện:** Đăng nhập bất kỳ vai trò có ngày nghiệp vụ → mở biểu mẫu ngày hoặc xem chi tiết `INV-003` / `APP-0DDB8821`; so sánh với ngày trên thanh tiêu đề và nhật ký. Có dấu hiệu dùng ngày UTC ở một số phần và ngày địa phương ở phần khác; cần xác nhận trong mã nguồn.

### P2 — Trợ lý quản trị bỏ sót việc đang chờ

Trên dashboard FCC có 2 tổ chức tài chính chờ xác minh và 1 hóa đơn có cờ bất thường. Trợ lý trả lời “Việc nào đang chờ xử lý?” chỉ nêu 1 sản phẩm chờ duyệt, 2 hồ sơ ESG và 0 hồ sơ KYC; câu trả lời bỏ qua 2 tổ chức và hóa đơn cần xem xét.

**Tái hiện:** Quản trị FCC → “Hỏi trợ lý” → chọn câu “Việc nào đang chờ xử lý?” → đối chiếu với các hàng đợi và bộ đếm trên dashboard.

## Các kiểm tra khác

- Truy cập trực tiếp URL thuộc vai trò khác bị chuyển về khu vực của vai trò đang đăng nhập.
- Hóa đơn trùng bị chặn đúng.
- Các trang chính của Nhà cung cấp, Bên mua, Tổ chức tài chính và FCC tải được.
- Màn Cài đặt tổ chức tài chính không tràn ngang ở viewport rộng 390 px.
- Xác nhận hóa đơn, chọn báo giá, chấp thuận đề nghị, giải ngân, ghi nhận thu hồi và hoàn phần dư đều cập nhật trạng thái đúng theo luồng.

## Trạng thái dữ liệu QA và MFA

- `INV-003` và hồ sơ `APP-0DDB8821` đã tất toán; khoản hoàn 4.000.000 đ đã được ghi nhận là hoàn đủ.
- Gói `QA 19-10-2026 - Mo phong giao dich FCC` đã tạm dừng sau kiểm thử.
- MFA đã được tắt lại cho cả bốn tài khoản QA (FCC, nhà cung cấp, bên mua, tổ chức tài chính), khôi phục trạng thái ban đầu sau khi hoàn tất kiểm thử. Từng trang bảo mật xác nhận “Đã tắt MFA” và hiển thị “Thiết lập MFA”.
- Không đưa khóa MFA hoặc mã xác thực vào báo cáo.
