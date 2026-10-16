# FCC — Hướng dẫn sử dụng (dành cho người dùng thử)

**FCC (Fast Cash Connect)** là nền tảng giúp **nhà cung cấp** (doanh nghiệp nhỏ và vừa) nhận tiền sớm cho hóa đơn đã giao hàng. Khoản tiền này do **tổ chức tài chính** ứng trước, căn cứ vào uy tín của **bên mua**. FCC làm nhiệm vụ chấm điểm, kết nối và theo dõi. FCC **không giữ tiền, không cho vay và không quyết định tín dụng**.

> **Đây là bản thử nghiệm.**
> - Các tổ chức tài chính trong hệ thống là **giả lập**: báo giá và giải ngân đều là mô phỏng, **không có tiền thật**.
> - Điểm số và xếp hạng chỉ để **tham khảo**.
> - Vui lòng **không nhập thông tin thật** của doanh nghiệp hay cá nhân. Dùng tên, mã số thuế và số liệu giả.

---

## 1. Truy cập hệ thống

1. Mở **đường dẫn** do ban tổ chức gửi cho bạn bằng trình duyệt (Chrome hoặc Edge, máy tính hoặc điện thoại).
2. Đăng nhập bằng **email và mật khẩu** được cấp, hoặc bấm **Đăng ký tổ chức** để tự tạo tổ chức thử nghiệm:
   - chọn loại: *nhà cung cấp*, *bên mua* hoặc *tổ chức tài chính*;
   - điền thông tin (mã số thuế gồm 10 hoặc 13 chữ số; có thể điền số giả nhưng phải đúng định dạng và **không trùng** với tổ chức khác);
   - tạo tài khoản chủ tổ chức (mật khẩu dài, khó đoán).
3. Nếu quên mật khẩu, bấm **Quên mật khẩu** ở màn hình đăng nhập để nhận liên kết đặt lại qua email.

### Xác thực 2 bước (MFA)

Các thao tác quan trọng (xác nhận hóa đơn, gửi yêu cầu báo giá, chọn báo giá, chấp thuận đề nghị, giải ngân…) cần thêm **mã 6 số** từ ứng dụng xác thực trên điện thoại (Google Authenticator, Microsoft Authenticator…). Cách bật, làm một lần:

1. Cài ứng dụng xác thực trên điện thoại.
2. Bấm **Bảo mật** ở góc trên bên phải.
3. Quét mã QR và nhập mã 6 số để bật.
4. Từ đó, khi hệ thống hỏi, bạn nhập mã 6 số hiện trong ứng dụng. Mã đổi sau mỗi 30 giây và **mỗi mã chỉ dùng một lần**: nếu bị báo sai, hãy chờ mã mới.

---

## 2. Làm quen với giao diện

- **Menu bên trái** thay đổi theo vai trò của bạn.
- **Chuông** ở góc trên: thông báo mới (cũng có thể gửi qua email).
- **Biểu tượng trợ lý** (AI): hỏi về số liệu của chính bạn, ví dụ "hóa đơn nào nên tài trợ?". Trợ lý chỉ giải thích dữ liệu hệ thống đang có, và từ chối câu hỏi ngoài phạm vi.
- Những từ có **gạch chân** (5C, ESG…): rê chuột vào để xem giải thích.
- Một số nút ghi **(cần MFA)**: bạn sẽ được hỏi mã 6 số.
- Thông báo màu xanh/đỏ ở góc màn hình cho biết thao tác thành công hay lỗi. Nếu lỗi, đọc kỹ nội dung, thường có chỉ dẫn cách sửa.

### Vai trò và quyền

| Vai trò trong tổ chức | Làm được |
| --- | --- |
| **Chủ tổ chức** | Toàn quyền, kể cả sửa hồ sơ tổ chức, mời và phân quyền thành viên |
| **Người phê duyệt** (nhà cung cấp, bên mua) | Xác nhận, cam kết, chia sẻ dữ liệu |
| **Người lập hồ sơ** (nhà cung cấp, bên mua) | Nhập hóa đơn và hồ sơ; **không** được phê duyệt hay cam kết |
| **Chuyên viên thẩm định** (tổ chức tài chính) | Báo giá, thẩm định, đề nghị, giải ngân, thu hồi |
| **Quản lý sản phẩm** (tổ chức tài chính) | Đăng và sửa sản phẩm |
| **Nhân sự FCC** | Xác minh, duyệt, thẩm định, phát hành điểm |
| **Kiểm toán** | Chỉ xem, không sửa được |

Mời thêm người: **Cài đặt → Thành viên & vai trò**, nhập email, chọn vai trò, bấm **Mời thành viên** (chỉ chủ tổ chức).

---

## 3. Dành cho nhà cung cấp

### 3.1. Chuẩn bị hồ sơ (làm một lần)
1. Vào **Cài đặt → Hồ sơ tổ chức**: điền năm thành lập, số lao động, ngành nghề, tỉnh/thành, (tùy chọn) website. Bấm **Lưu hồ sơ**.
2. Phần **Xác minh người đại diện**: nhập họ tên, tải ảnh giấy tờ (dùng ảnh giả), bấm **Nộp hồ sơ xác minh**. Nhân sự FCC sẽ xem và duyệt.

### 3.2. Tạo khoản phải thu (hóa đơn)
1. Vào **Hóa đơn → Tải hóa đơn OCR/AI**.
2. Chọn một trong ba cách: tải **tệp XML** của hóa đơn, tải **ảnh/PDF** để AI đọc, hoặc chọn **Nhập tay**.
3. **Kiểm tra kỹ** các con số AI đọc được (ký hiệu, số hóa đơn, ngày, bên mua, số tiền). AI có thể đọc sai. Sửa rồi mới lưu.
4. Tải thêm chứng từ gốc nếu có: hợp đồng, biên bản giao hàng.
5. Bấm **Gửi người mua xác nhận**.
6. Nếu bên mua **tranh chấp**, vào lại hóa đơn, bấm **Điều chỉnh & gửi lại**.
7. Hóa đơn còn ở trạng thái nháp có thể **Hủy hóa đơn nháp**.

Hệ thống có thể gắn **cờ** cho hóa đơn có dấu hiệu bất thường để nhân sự FCC xem xét. Cờ không tự động từ chối hóa đơn.

### 3.3. Xin tài trợ
1. Khi bên mua đã xác nhận, vào **Marketplace**.
2. Xem các sản phẩm phù hợp kèm **chi phí ước tính**. Chọn **tối đa 3 sản phẩm**.
3. Bấm **Gửi yêu cầu báo giá (n/3)**. Hệ thống chỉ chia sẻ gói tóm tắt (điểm tín dụng, ESG) cho các tổ chức bạn chọn, trong 5 ngày.
4. Khi có báo giá, so sánh rồi bấm **Chọn & gửi hồ sơ** ở báo giá bạn muốn (cần MFA). Các bên còn lại sẽ bị thu hồi quyền xem.
5. Theo dõi ở **Hồ sơ tài trợ**. Khi tổ chức tài chính ra **đề nghị chính thức**, vào **Giải ngân & thu hồi** và bấm **Chấp thuận đề nghị (cần MFA)** trước hạn.
6. Sau khi giải ngân, màn hình **Giải ngân & thu hồi** cho thấy tiền về và tiến độ thu hồi. Khi bên mua trả tiền, số tiền được trừ theo thứ tự **phí → lãi → gốc**. Nếu trả dư, phần dư được hoàn cho bạn. Khi đủ, hồ sơ chuyển sang **Đã tất toán**.

### 3.4. Điểm tín dụng
- Vào **Hồ sơ tài trợ** (phần chấm điểm): nhập **BCTC** từng năm rồi bấm **Lưu BCTC**, khai tài sản bảo đảm (nếu có), bấm **Chấm điểm & lưu**.
- Bạn sẽ thấy điểm, hạng và **lý do từng chỉ tiêu**. Càng nhiều dữ liệu, độ bao phủ càng cao.
- Không đồng ý với kết quả: bấm **Yêu cầu xem xét lại** và nêu lý do.

### 3.5. ESG & Xanh
Đây là phần doanh nghiệp tự khai trên hệ thống:
1. Vào **ESG & Xanh**, chọn **nhóm ngành**.
2. Với mỗi chỉ tiêu, chọn **mức từ 0 đến 3**, hoặc "không áp dụng" kèm lý do.
3. **Tải bằng chứng** (chứng nhận, hóa đơn điện/nước, hợp đồng lao động, báo cáo môi trường…). Mức từ 2 trở lên bắt buộc có bằng chứng.
4. Bấm **AI đề xuất mức** để AI đọc bằng chứng và gợi ý. Nếu bạn chọn khác gợi ý, phải ghi lý do.
5. Điểm lúc này là **tạm tính**. Điểm **chính thức** do nhân sự FCC thẩm định và phát hành, khi bao phủ đạt từ 80% và các cờ quan trọng đã xử lý.

### 3.6. Kế toán và dòng tiền
Vào **Kế toán**:
- **Nhập công nợ CSV** (có nút **Tải file mẫu**).
- Xem **bút toán đề xuất**: bấm **Duyệt** hoặc **Từ chối** từng dòng, rồi **Xuất bút toán đã duyệt**.
- **Liên kết ngân hàng (giả lập)** để xem sao kê giả.
- Xem **dự báo dòng tiền** theo 3 kịch bản, **Thêm khoản chi**, **Lưu dự báo**.

### 3.7. Dữ liệu công khai về doanh nghiệp bạn
Trong **Cài đặt → Dữ liệu công khai về tổ chức** là các thông tin hệ thống thu thập từ nguồn công khai (luôn có nhãn *Nguồn công khai – tham khảo*, kèm đường dẫn nguồn và ngày lấy). Nếu sai, bấm **Khiếu nại** và ghi rõ thông tin đúng là gì. Dữ liệu này **không** ảnh hưởng điểm số.

---

## 4. Dành cho bên mua

1. Vào **Xác nhận hóa đơn**: danh sách hóa đơn nhà cung cấp gửi cho bạn. Với mỗi hóa đơn, bấm **Xác nhận** (cần MFA), hoặc **tranh chấp** và nêu lý do.
2. Khi đến hạn trả tiền, bấm **Ghi nhận đã thanh toán**: nhập số tiền, ngày, mã giao dịch, bấm **Ghi nhận**. Có thể trả một phần.
   - Đây chỉ là bên mua **tự báo**. Hồ sơ chỉ **tất toán** khi tổ chức tài chính xác nhận đã nhận tiền.
3. **Thanh toán sớm**: bấm **Đề nghị trả sớm** để đề nghị với nhà cung cấp, rồi **Ghi nhận đã trả** khi đã trả.
4. **Bên mua niêm yết chứng khoán:** ở **Cài đặt**, điền **mã chứng khoán** (ví dụ HPG hoặc CTD để thử). Nhờ nhân sự FCC **xác minh** mã. Sau đó vào phần chấm điểm và bấm nạp dữ liệu, bạn sẽ thấy báo cáo tài chính của công ty niêm yết và điểm bên mua. Nếu bị từ chối, nghĩa là FCC chưa xác minh hoặc mã khác với mã đã khai.
5. **ESG chuỗi cung ứng** và **Kế toán** dùng tương tự nhà cung cấp.

---

## 5. Dành cho tổ chức tài chính

1. Sau khi đăng ký, **chờ nhân sự FCC xác minh**. Chưa xác minh thì chưa đăng sản phẩm hay báo giá được.
2. **Marketplace → sản phẩm của bạn:** điền loại sản phẩm, điều kiện, mức phí, thời gian xử lý; bấm **Lưu nháp** rồi **Gửi FCC duyệt**. Sản phẩm mới hoặc sau khi sửa phải được FCC duyệt mới hiển thị. Có thể **Tạm dừng** hoặc **Mở lại**.
3. **Thẩm định hồ sơ:**
   - Phần *RFQ chờ báo giá*: bấm **Gửi báo giá** (lãi, % ứng trước) hoặc **Từ chối**.
   - Phần *Hàng đợi hồ sơ*: bấm **Bắt đầu thẩm định**. Xem điểm hồ sơ, điểm nhà cung cấp, điểm bên mua, chứng từ, tài sản bảo đảm và dữ liệu công khai nếu được chia sẻ. Sau đó bấm **Gửi đề nghị tài trợ** hoặc **Từ chối** (kèm lý do).
4. Khi nhà cung cấp chấp thuận, bấm **Ghi nhận giải ngân** (cần MFA).
5. **Thu hồi:** ô **Số tiền về**: nhập đúng số còn phải thu để tất toán (hệ thống gợi ý số này), chọn loại *Thanh toán của bên mua* hoặc *Thanh lý tài sản bảo đảm*, bấm **Ghi nhận tiền về (cần MFA)**. Nếu có phần dư, bấm **Ghi nhận đã hoàn**.
6. **Giám sát & EWS:** danh sách cảnh báo sớm theo từng hồ sơ.

---

## 6. Dành cho nhân sự FCC

Vào mục **Quản trị**. Menu gồm: **Bảng điều khiển**, **Người dùng & quyền**, **Thẩm định ESG**, **Nguồn dữ liệu công khai**, **Bảo mật & gian lận**, **Cài đặt hệ thống**.

| Việc | Ở đâu |
| --- | --- |
| Xem số liệu vận hành (người dùng, giá trị tài trợ, tỷ lệ phê duyệt, tranh chấp, thời gian từng bước) | Bảng điều khiển |
| Xác minh tổ chức tài chính, duyệt hồ sơ người đại diện, duyệt sản phẩm | Bảng điều khiển → hàng đợi xác minh |
| Xử lý hóa đơn bị gắn cờ, ghi kết quả đối chiếu thuế (ghi chú kết quả tra cứu) | Bảng điều khiển |
| Phát hành điểm tín dụng chính thức, xử lý yêu cầu xem xét lại | Bảng điều khiển |
| Thẩm định và **Phát hành chính thức** điểm ESG (cần MFA) | Thẩm định ESG |
| Duyệt nguồn dữ liệu, ghi kết quả tra cứu thủ công, xử lý khiếu nại, xác minh mã chứng khoán của bên mua, nhập ý kiến kiểm toán | Nguồn dữ liệu công khai |
| Biểu phí và doanh thu | Bảng điều khiển |

Lưu ý: nhân sự FCC không xem chứng từ hay hồ sơ tài trợ của doanh nghiệp.

---

## 7. Kịch bản thử nghiệm gợi ý (một vòng đầy đủ)

Cần ít nhất 3 tab trình duyệt (hoặc 3 người): nhà cung cấp, bên mua, tổ chức tài chính, thêm 1 người của FCC.

| Bước | Ai làm | Việc | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Nhà cung cấp | Điền hồ sơ tổ chức, nhập BCTC, bấm **Chấm điểm & lưu** | Có điểm và hạng, kèm lý do từng chỉ tiêu |
| 2 | FCC | Xác minh tổ chức tài chính | Tổ chức tài chính đăng sản phẩm được |
| 3 | Tổ chức tài chính | Tạo sản phẩm, **Gửi FCC duyệt** | Sau khi FCC duyệt, sản phẩm hiện ở Marketplace của nhà cung cấp |
| 4 | Nhà cung cấp | Tạo hóa đơn, **Gửi người mua xác nhận** | Hóa đơn hiện ở bên mua |
| 5 | Bên mua | **Xác nhận** hóa đơn (MFA) | Hóa đơn chuyển sang đã xác nhận |
| 6 | Nhà cung cấp | Chọn sản phẩm, **Gửi yêu cầu báo giá** | Tổ chức tài chính thấy RFQ |
| 7 | Tổ chức tài chính | **Gửi báo giá** | Nhà cung cấp thấy báo giá |
| 8 | Nhà cung cấp | **Chọn & gửi hồ sơ** | Hồ sơ vào hàng đợi thẩm định |
| 9 | Tổ chức tài chính | **Bắt đầu thẩm định** → **Gửi đề nghị tài trợ** | Nhà cung cấp thấy đề nghị chính thức |
| 10 | Nhà cung cấp | **Chấp thuận đề nghị** (MFA) | Trạng thái đã chấp thuận |
| 11 | Tổ chức tài chính | **Ghi nhận giải ngân** (MFA) | Hồ sơ chuyển sang đã giải ngân |
| 12 | Bên mua | **Ghi nhận đã thanh toán** | Có ghi nhận bên mua đã báo trả |
| 13 | Tổ chức tài chính | **Ghi nhận tiền về** đúng số còn phải thu | Hồ sơ **Đã tất toán** ở cả hai phía |

Thử thêm các tình huống:
- Bên mua **tranh chấp** hóa đơn → nhà cung cấp điều chỉnh và gửi lại.
- Bên mua trả **một phần**, rồi trả nốt.
- Tổ chức tài chính **từ chối** hồ sơ hoặc từ chối báo giá.
- Nhập hóa đơn trùng với hóa đơn đã có (hệ thống phải từ chối).
- Người **lập hồ sơ** thử bấm các nút cam kết (phải bị chặn).
- Nhà cung cấp **khiếu nại** dữ liệu công khai, hoặc **yêu cầu xem xét lại** điểm.

---

## 8. Câu hỏi thường gặp

| Tình huống | Cách xử lý |
| --- | --- |
| Không đăng nhập được | Kiểm tra email và mật khẩu; thử **Quên mật khẩu**. Nếu vẫn không được, báo ban tổ chức |
| Báo "cần MFA" hoặc mã sai | Bật MFA ở **Bảo mật** (mục 1). Nếu mã sai, chờ mã mới (mỗi mã dùng một lần) |
| Tổ chức tài chính không đăng được sản phẩm | Chờ FCC xác minh tổ chức; sản phẩm mới cũng phải được FCC duyệt |
| Điểm bên mua báo "Thiếu BCTC" | Chưa có báo cáo tài chính: nhập, tải lên, hoặc (bên mua niêm yết) nạp dữ liệu sau khi FCC xác minh |
| Bên mua đã bấm thanh toán nhưng hồ sơ chưa tất toán | Bình thường: tổ chức tài chính phải **ghi nhận tiền về** đúng số còn phải thu |
| Số AI đọc từ hóa đơn bị sai | Sửa tay trước khi lưu. AI chỉ là gợi ý |
| Không thấy nút cần bấm | Vai trò của bạn không có quyền đó (ví dụ người lập hồ sơ không được xác nhận), hoặc bước trước chưa xong |
| Không thấy dữ liệu mới | Tải lại trang |
| Màn hình lỗi, trống, hoặc chậm bất thường | Chụp ảnh màn hình kèm ngày giờ, báo ban tổ chức |

---

## 9. Báo lỗi và góp ý

Khi báo lỗi, vui lòng gửi:
1. **Bạn đang dùng vai trò nào** (nhà cung cấp, bên mua, tổ chức tài chính, FCC).
2. **Bạn đang ở màn hình nào** và **đã bấm gì**.
3. **Điều bạn mong đợi** và **điều thực tế xảy ra**.
4. **Ảnh chụp màn hình** (có cả nội dung thông báo lỗi) và **ngày giờ** xảy ra.
5. Trình duyệt và thiết bị (Chrome trên Windows, Safari trên iPhone…).

**Lưu ý an toàn:** không chia sẻ mật khẩu hay mã 6 số; không tải lên giấy tờ hay số liệu thật; đăng xuất khi dùng máy chung (nút **Đăng xuất** ở góc trên bên phải).
