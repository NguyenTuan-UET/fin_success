# FCC chuyển sang bối cảnh xuất nhập khẩu — các điểm cần xin ý kiến

Ngày 23/10/2026

## Bối cảnh

FCC là nền tảng tài trợ khoản phải thu: doanh nghiệp đưa hóa đơn lên, bên đối ứng xác nhận, tổ chức tài chính báo giá và giải ngân. Yêu cầu mới có hai phần:

1. Đổi tên các bên: "Nhà cung cấp (SME)" thành **Đơn vị xuất khẩu**, "Bên mua" thành **Bên nhập khẩu**.
2. Cho phép cả hai bên **tải chứng từ hải quan** (tờ khai, vận đơn, C/O…) vào hồ sơ, để chống hóa đơn khống.

Nhóm đã làm xong phần lõi theo phương án mặc định:

- **Đổi tên:** đổi toàn bộ chữ hiển thị, giữ nguyên mã nội bộ.
- **Tải chứng từ hải quan:** cả hai bên tải được, có ghi nhật ký và gửi thông báo.
- **Kiểm soát rủi ro:**
  - gắn cờ khi một số tờ khai dùng cho nhiều hóa đơn;
  - gắn cờ khi mã số thuế trên tờ khai khác mã số thuế của đơn vị xuất khẩu;
  - kiểm tra tờ khai trước khi gửi yêu cầu báo giá;
  - điểm chứng từ tính thêm tờ khai hải quan.

Các điểm dưới đây cần người có chuyên môn nghiệp vụ quyết định. Mỗi điểm ghi rõ hiện trạng và ảnh hưởng của từng lựa chọn.

---

## A. Cần quyết định trước khi làm tiếp (quan trọng nhất)

### 1. Bên nhập khẩu có thể là doanh nghiệp nước ngoài không?

- **Vì sao quan trọng:** trong thực tế, bên nhập khẩu thường ở nước ngoài. Hiện đăng ký bắt buộc mã số thuế Việt Nam (10/13 số), mã ngành VSIC và tỉnh/thành, nên đối tác nước ngoài **không đăng ký được** và đơn vị xuất khẩu không chọn được họ trên hóa đơn.
- **Nếu có:**
  - thêm trường quốc gia;
  - nước ngoài thì dùng mã đăng ký doanh nghiệp của nước sở tại;
  - KYC đối chiếu thủ công;
  - điểm tín dụng của bên nhập khẩu nước ngoài chỉ là tạm tính, vì thiếu dữ liệu.

  Khối lượng khoảng một gói việc cỡ vừa.
- **Nếu không** (chỉ doanh nghiệp Việt Nam): giữ nguyên, không tốn thêm công.
- **Câu hỏi thêm:** nếu có, điểm tín dụng bên nhập khẩu nước ngoài nên dựa vào nguồn nào? Chỉ lịch sử thanh toán trên FCC, hay cần nguồn tín dụng quốc tế?

### 2. Thiếu tờ khai hải quan thì có chặn gửi yêu cầu báo giá không?

- **Hiện tại:** chỉ **cảnh báo**. Doanh nghiệp vẫn gửi được, kèm thông báo "tổ chức tài chính có thể từ chối hoặc báo giá kém hơn".
- **Lựa chọn:**

| Mức | Cách hoạt động | Phù hợp khi |
|---|---|---|
| Tắt | Không kiểm tra | Bỏ tính năng |
| Cảnh báo (đang dùng) | Báo thiếu, vẫn cho gửi | Giai đoạn thử, dữ liệu chưa đủ |
| Chặn | Phải có tờ khai xuất khẩu **đã thông quan** mới gửi được | Vận hành thật, coi tờ khai là điều kiện bắt buộc |

- **Lưu ý:** hệ thống chỉ ghi nhận thông tin doanh nghiệp tự khai, chưa đối chiếu được với cổng hải quan (cổng nhà nước không cho tự động hóa).
- **Câu hỏi:** chuyển sang "chặn" vào thời điểm nào? Thiếu vận đơn có nên chặn không (hiện chỉ nhắc)?

### 3. Danh mục loại chứng từ hải quan có đúng thông lệ không?

Danh mục do nhóm tự đề xuất, chưa được người có chuyên môn hải quan/ngoại thương rà soát:

| Phía | Loại chứng từ |
|---|---|
| Xuất khẩu | Tờ khai hải quan xuất khẩu · Vận đơn (B/L, AWB, CMR) · Phiếu đóng gói · C/O · Giấy kiểm dịch/chất lượng/hun trùng · Bảo hiểm hàng hóa |
| Nhập khẩu | Tờ khai hải quan nhập khẩu · Xác nhận nhận hàng tại cảng/kho đến |
| Cả hai | Chứng từ hải quan khác |

- **Câu hỏi:**
  - Có thiếu hay thừa loại nào không?
  - Loại nào nên bắt buộc?
  - Số tờ khai có định dạng chuẩn để kiểm tra không? Hiện chỉ chấp nhận 5–30 ký tự chữ-số.
- **Ảnh hưởng nếu sửa:** chỉ sửa một bảng danh mục, không đổi kiến trúc.

### 4. Thang điểm chứng từ mới trong điểm hồ sơ tài trợ

- **Cũ:** đếm 3 loại (hóa đơn, hợp đồng, chứng từ giao hàng), số loại có 0/1/2/3 tương ứng 20/50/75/100 điểm.
- **Mới:** đếm thêm tờ khai hải quan thành 4 loại, số loại có 0/1/2/3/4 tương ứng **20/40/60/80/100** điểm.
- **Hệ quả:**
  - hồ sơ cũ đủ 3 loại tụt từ 100 xuống 80 điểm chứng từ;
  - trong kịch bản thử, xếp hạng hồ sơ có thể tụt một bậc (BBB xuống BB) và mất điều kiện vay một số sản phẩm.

  Phiên bản bộ chấm đã tăng lên `application-v1.1`, và điểm đã phát hành trước đó không bị tính lại.
- **Câu hỏi:** các con số này có hợp lý không? Theo quy trình, thay đổi tham số mô hình cần **hai người duyệt**, nên cần chuyên gia tín dụng ký duyệt.

---

## B. Cần quyết định nhưng không chặn công việc hiện tại

### 5. Hóa đơn bằng ngoại tệ

Hóa đơn xuất khẩu thường lập bằng USD/EUR, nhưng hệ thống chỉ lưu số tiền VND (người dùng tự quy đổi). Nếu cần lưu ngoại tệ và tỷ giá, sẽ ảnh hưởng tới bút toán (chênh lệch tỷ giá), dự báo dòng tiền, hiển thị và thu hồi. Ngoại tệ cũng là điều kiện để đối chiếu trị giá tờ khai với hóa đơn, là tín hiệu chống hóa đơn khống mạnh nhất sau số tờ khai.

- **Câu hỏi:** có cần ngoại tệ trong đợt tới không, hay để giai đoạn sau?

### 6. Tổ chức tài chính nước ngoài có được tham gia không?

Hiện chưa chặn về mặt kỹ thuật; FCC xác minh tổ chức tài chính thủ công.

- **Câu hỏi:** cần ý kiến pháp chế về luồng vốn ngoại trước khi mở cho tổ chức nước ngoài đăng ký.

### 7. Xử lý khi một số tờ khai xuất hiện ở nhiều hóa đơn

Hiện hệ thống gắn cờ mức trung bình ở cả hai hóa đơn, đưa vào hàng đợi FCC xem xét và không tự từ chối, vì một lô hàng hợp lệ có thể có nhiều hóa đơn.

- **Câu hỏi:**
  - Mức cảnh báo này có phù hợp không?
  - Khi rà soát, FCC nên kiểm tra gì? Nhóm cần viết hướng dẫn xử lý cho người vận hành.

### 8. Bên nhập khẩu có cần xác nhận chứng từ của đơn vị xuất khẩu không?

Hiện bên nhập khẩu chỉ xem và tải chứng từ phía mình, chưa đánh dấu "khớp/không khớp" cho từng chứng từ của bên kia.

- **Câu hỏi:** có cần bước đối chiếu này không? Nếu có thì cần thêm trạng thái cho từng tệp.

### 9. Có cho gỡ/thay chứng từ đã tải không?

Hiện **không**: chỉ được thêm, tệp định danh bằng mã băm, mọi lần thêm đều ghi nhật ký. Tải nhầm thì liên hệ FCC.

- **Câu hỏi:** cách này có quá cứng với người dùng không?

---

## C. Đã làm theo mặc định, chỉ cần xác nhận

| # | Điểm | Đã làm | Nếu muốn khác |
|---|---|---|---|
| 10 | Đổi tên ở đâu | Chỉ đổi chữ hiển thị; giữ mã nội bộ, API, dữ liệu | Đổi cả mã nội bộ: cần migration toàn bộ dữ liệu và báo đối tác tích hợp; tốn nhiều công mà người dùng không thấy khác |
| 11 | Đường dẫn trang `/supplier`, `/buyer` | Giữ nguyên | Đổi thành `/exporter`, `/importer` và chuyển hướng từ liên kết cũ |
| 12 | Chữ "SME" | Bỏ khỏi giao diện; giữ tên hai tài liệu phương pháp (5C, ESG) và thêm ghi chú | Đổi cả tên tài liệu |
| 13 | Nhật ký kiểm toán cũ | Giữ nguyên chữ cũ (không sửa được vì chuỗi băm) | — |
| 14 | Dữ liệu niêm yết (vnstock) | Chỉ áp dụng doanh nghiệp niêm yết ở sàn Việt Nam | Nếu bên nhập khẩu chủ yếu ở nước ngoài thì tính năng này ít tác dụng |

---

## Tóm tắt điều cần xin

1. **Nghiệp vụ / ngoại thương:** điểm 1, 3, 5, 8
2. **Rủi ro / tín dụng:** điểm 2, 4, 7
3. **Pháp chế:** điểm 6
4. **Xác nhận nhanh:** điểm 9–14
