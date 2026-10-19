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

Nhật ký kiểm toán sau kiểm thử có 76 sự kiện; chức năng kiểm tra báo chuỗi băm hợp lệ.

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

- `INV-003` và hồ sơ `APP-0DDB8821` đã tất toán; khoản hoàn 4.000.000 đ đã được ghi nhận là hoàn đủ. `INV-004` đã được thanh toán theo nhánh chiết khấu sớm; `INV-001` phiên bản 3 đã được xác nhận và ghi nhận thanh toán trực tiếp.
- Một bút toán QA được duyệt, một bút toán QA khác bị từ chối; CSV bút toán đã xuất ra tệp cục bộ. CSV công nợ và chứng từ OCR tổng hợp không được nhập/lưu.
- Gói `QA 19-10-2026 - Mo phong giao dich FCC` đã tạm dừng sau kiểm thử.
- MFA đã được tắt lại cho cả bốn tài khoản QA (FCC, nhà cung cấp, bên mua, tổ chức tài chính), khôi phục trạng thái ban đầu sau khi hoàn tất kiểm thử. Từng trang bảo mật xác nhận “Đã tắt MFA” và hiển thị “Thiết lập MFA”.
- Không đưa khóa MFA hoặc mã xác thực vào báo cáo.


## Kiểm thử mở rộng theo tài liệu chức năng

Phạm vi đối chiếu là các màn và tính năng demo ở mục 3.1, cùng các giá trị cung cấp nêu ở mục 3.3.1. Các phần mô hình kinh doanh, dự báo doanh thu và kế hoạch tương lai trong hồ sơ dự thi không phải chức năng đang chạy trên production.

| Vai trò | Màn đã mở và kiểm tra hiển thị | Nghiệp vụ đã thao tác |
|---|---|---|
| Nhà cung cấp | Tổng quan/dự báo, hóa đơn, tải hóa đơn, Marketplace, hồ sơ tài trợ/5C, giải ngân & thu hồi, ESG, kế toán, cài đặt/bảo mật | Tải XML, chặn XML trùng; tạo/gửi RFQ, chọn báo giá; thử OCR ảnh/PDF QA; đổi khoảng dự báo 7/30 ngày; xem trước CSV QA rồi hủy; lưu dự báo và kết nối ngân hàng giả lập; duyệt một bút toán QA, từ chối một bút toán QA và xuất CSV; kiểm tra trợ lý đề xuất hóa đơn |
| Bên mua | Tổng quan, xác nhận hóa đơn, Marketplace/chiết khấu sớm, ESG chuỗi cung ứng, kế toán, cài đặt/bảo mật | Xác nhận và thanh toán QA; tạo đề nghị chiết khấu 1%, nhà cung cấp chấp nhận và bên mua ghi nhận đã trả; yêu cầu làm rõ hóa đơn, nhận phiên bản sửa và xác nhận; lưu thanh toán trực tiếp QA; lưu tùy chọn thông báo |
| Tổ chức tài chính | Tổng quan, thẩm định, Marketplace, giám sát/EWS, ESG, kế toán được chia sẻ, cài đặt/bảo mật | Tạo/sửa gói, FCC duyệt gói, tạm dừng gói; báo giá, thẩm định, gửi/chấp thuận đề nghị, giải ngân giả lập, ghi nhận thu hồi và hoàn phần dư; bật/tắt MFA; tạo rồi thu hồi khóa API QA; kiểm tra từ chối webhook không HTTPS và lưu lại cấu hình trống |
| FCC | Hàng đợi, thành viên & quyền, tổ chức, thẩm định ESG, nguồn dữ liệu công khai, doanh thu & biểu phí, nhật ký, bảo mật | Kiểm tra hàng đợi và tổ chức; kiểm tra nhật ký: hợp lệ 76 sự kiện; thử mời email thành viên đã tồn tại và được từ chối. Các màn quản trị khác được kiểm tra ở chế độ đọc |

### Phát hiện bổ sung

#### P1 — Nút lưu hóa đơn OCR vẫn bật khi MST người bán không khớp

Thử bằng ảnh/PDF hóa đơn tổng hợp, không lưu hóa đơn. OCR trả về MST người bán `99800000001`, khác MST tổ chức đang đăng nhập `9980000001`; màn hình hiện cảnh báo đỏ. OCR cũng đọc MST bên mua sai một chữ số và giao diện gợi ý đúng tổ chức QA. Sau khi chọn bên mua được gợi ý và tích “đã đối chiếu”, nút “Lưu khoản phải thu” vẫn bật dù cảnh báo MST người bán còn nguyên. Có thể lưu hóa đơn dựa trên chứng từ không thuộc người bán đang đăng nhập; cần chặn lưu hoặc yêu cầu sửa/xác minh sai khác.

**Tái hiện:** Nhà cung cấp → Tải hóa đơn OCR/AI → dùng ảnh/PDF tổng hợp → chọn người mua gợi ý → tích xác nhận đã đối chiếu. Không bấm lưu.

OCR có đọc được tổng tiền và ngày trên fixture, đồng thời phát hiện lỗi MST và đề xuất người mua gần khớp. Đây là kiểm tra bằng fixture QA tổng hợp; chưa kiểm thử với chứng từ doanh nghiệp thật.

#### P2 — Sao kê ngân hàng giả lập chỉ hiện khoản hoàn, thiếu khoản giải ngân lịch sử

Sau khi liên kết ngân hàng giả lập cho nhà cung cấp, sao kê hiển thị khoản hoàn QA 4.000.000 đ và số dư đóng 1.004.000.000 đ, nhưng không thấy khoản giải ngân giả lập 16.000.000 đ của hồ sơ `APP-0DDB8821`. Khoản giải ngân được ghi nhận ngày 18/10, còn kết nối giả lập được tạo ngày 19/10; có thể sao kê chỉ lấy sự kiện từ ngày liên kết. Cần xác nhận quy tắc lấy mốc đầu kỳ và đảm bảo người dùng hiểu đây không phải lịch sử đầy đủ. Không có kết nối ngân hàng thật hoặc chuyển tiền thật.

### Nhánh nghiệp vụ QA bổ sung

- Tạo `INV-004` thủ công trị giá 1.234.567 đ; bên mua xác nhận, tạo đề nghị chiết khấu 1%, nhà cung cấp chấp nhận và bên mua ghi nhận thanh toán sớm. Trạng thái đề nghị thành “Đã trả”; không có chuyển tiền thật.
- Trên `INV-001`, bên mua yêu cầu làm rõ; nhà cung cấp sửa số tiền từ 12.000.000 đ thành 11.900.000 đ và gửi phiên bản 3; bên mua xác nhận rồi ghi nhận thanh toán trực tiếp bằng tham chiếu QA. Không có chuyển tiền thật.
- Các tùy chọn MFA của bốn tài khoản QA được đưa về tắt sau khi thử. Khóa API thử nghiệm đã thu hồi, địa chỉ webhook trở về trống. Sản phẩm tài trợ thử nghiệm đã tạm dừng.

### Phạm vi chưa xác nhận bằng thao tác

- Các thao tác quản trị có tác động bền vững chưa chạy: gửi email mời thành viên (chỉ thử email đã tồn tại), tạo bí mật ký webhook, tải bằng chứng ESG, xác minh pháp nhân/KYC, phát hành điểm ESG/tín dụng, phê duyệt nguồn dữ liệu, tạo biểu phí/chạy tính phí và nhập công nợ CSV thật. Khóa API QA đã tạo rồi thu hồi; webhook chỉ kiểm tra HTTPS; CSV tổng hợp chỉ được xem trước rồi hủy. Các màn quản trị tương ứng đã được mở để kiểm tra nội dung.
- Tài liệu mô tả kết nối ngân hàng/ERP và đối chiếu cơ quan thuế; giao diện hiện ghi ngân hàng là giả lập, kế toán kết nối đối tác “khi có tài khoản”, và đối chiếu hóa đơn tự động chưa bật. Những tích hợp ngoài chưa thể xác nhận từ demo production.
- Các tính năng OCR ảnh/PDF ở trên được thử bằng dữ liệu QA tự tạo; lỗi nhận dạng MST được cảnh báo, nhưng lỗi chặn lưu MST người bán vẫn tồn tại.
