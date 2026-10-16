# FCC — hướng dẫn sử dụng nhanh

FCC (Fast Cash Connect) giúp **nhà cung cấp (SME)** nhận tiền sớm cho hóa đơn đã giao, dựa trên uy tín của **bên mua**, thông qua **tổ chức tài chính**. FCC chấm điểm, kết nối và theo dõi; FCC **không giữ tiền, không cho vay, không quyết định tín dụng**.

> Phiên bản hiện tại không kết nối ngân hàng thật: phía ngân hàng do **ngân hàng giả lập** (`sim-bank/`) đóng vai. Mọi số liệu điểm và xếp hạng chỉ là tham khảo.

Tài liệu đầy đủ: [document/HUONG_DAN_SU_DUNG.md](document/HUONG_DAN_SU_DUNG.md) (đã làm/chưa làm, chi tiết từng vai trò) · [README.md](README.md) (cài đặt, kiến trúc) · [document/VAN_HANH.md](document/VAN_HANH.md) (triển khai).

---

## 1. Bắt đầu

### 1.1. Chạy hệ thống trên máy

Cần Node ≥ 22.13. Mở hai terminal:

```bash
# Terminal 1 — backend (http://127.0.0.1:8787)
cd server
npm install
scripts/pg-local.sh start          # PostgreSQL cục bộ
cp .env.example .env               # lần đầu; điền OLLAMA_API_KEY để dùng AI
npm start

# Terminal 2 — giao diện (http://localhost:3000)
cd web
npm install
npm run dev
```

Cơ sở dữ liệu khởi động **trống**: không có doanh nghiệp, hóa đơn hay sản phẩm mẫu.

### 1.2. Hai chế độ vào hệ thống

| Chế độ | Cách vào |
| --- | --- |
| **Dev** (mặc định, chỉ localhost) | Không đăng nhập. Mở `/supplier`, `/buyer`, `/lender`, `/admin`; mỗi vai trò một tab trình duyệt |
| **Đăng nhập thật** (`FCC_ENV=staging` hoặc `production`) | Vào `/login` → **Đăng ký tổ chức** (chọn loại tổ chức, điền thông tin, tạo tài khoản chủ tổ chức) rồi đăng nhập bằng email/mật khẩu |

Ở chế độ đăng nhập thật, vào **Bảo mật** (`/security`) để bật **MFA**: quét mã bằng ứng dụng Authenticator. Các hành động nhạy cảm sẽ yêu cầu nhập mã 6 số: xác nhận hóa đơn, gửi RFQ, chọn báo giá, chấp thuận đề nghị, giải ngân, phát hành điểm.

### 1.3. Dữ liệu để thử

| Cần | Dùng |
| --- | --- |
| BCTC bên mua thật | Khai mã `HPG` hoặc `CTD` ở Cài đặt của bên mua → nhờ FCC xác minh → bấm nạp (xem 3.2) |
| BCTC, hóa đơn, chứng từ của nhà cung cấp | Ảnh mẫu giả lập ở `ocr_lab/samples/` (BCTC công ty "Phú Gia", hóa đơn GTGT, hóa đơn điện 12 tháng, thông báo BHXH): tải lên để AI đọc |
| Ngân hàng phản hồi tự động | Chạy `sim-bank/` (xem mục 5) |

---

## 2. Vai trò và quyền

| Loại tổ chức | Vai trò trong tổ chức | Làm được |
| --- | --- | --- |
| Nhà cung cấp, bên mua | **Chủ tổ chức** | Toàn quyền, mời thành viên, sửa hồ sơ |
| | **Người phê duyệt** | Xác nhận, cam kết (gửi RFQ, chọn báo giá, chấp thuận), chia sẻ dữ liệu |
| | **Người lập hồ sơ** | Nhập hóa đơn, hồ sơ, ESG; không được phê duyệt hay cam kết |
| Tổ chức tài chính | **Chủ tổ chức** | Toàn quyền |
| | **Chuyên viên thẩm định** | Báo giá, thẩm định, đề nghị, giải ngân, thu hồi |
| | **Quản lý sản phẩm** | Đăng và sửa sản phẩm |
| FCC | **Quản trị**, **Thẩm định tín dụng/ESG**, **Vận hành**, **Chủ mô hình chấm điểm** | Xem mục 4 |
| | **Kiểm toán** | Chỉ đọc; mọi lần truy cập được ghi lại |

Mời thành viên và đổi vai trò ở **Cài đặt → Thành viên & vai trò** (chỉ chủ tổ chức).

---

## 3. Luồng sử dụng chính

```
Nhà cung cấp: hóa đơn → bên mua xác nhận → RFQ → báo giá → thẩm định → đề nghị → chấp thuận → giải ngân → bên mua trả → thu hồi → tất toán
```

### 3.1. Nhà cung cấp

1. **Cài đặt:** khai hồ sơ tổ chức (năm thành lập, số lao động, ngành…), nhập website nếu muốn, nộp **KYC** (họ tên người đại diện + tải CCCD và giấy đăng ký kinh doanh).
2. **Hóa đơn → thêm khoản phải thu:**
   - tải **XML** hóa đơn, hoặc **ảnh/PDF** cho AI đọc, hoặc nhập tay;
   - **luôn kiểm tra lại** các số AI đọc được trước khi lưu;
   - đính chứng từ gốc (hóa đơn, hợp đồng, biên bản giao hàng);
   - gửi cho bên mua xác nhận. Nếu bị tranh chấp thì sửa rồi gửi lại. Hệ thống có thể gắn **cờ** hóa đơn bất thường để FCC kiểm tra, không tự từ chối.
3. **Marketplace:** xem sản phẩm phù hợp kèm chi phí ước tính; chọn tối đa **3 sản phẩm** để gửi **RFQ**; so sánh báo giá và **chọn báo giá** (MFA).
4. **Hồ sơ tài trợ:** theo dõi thẩm định. Khi có đề nghị chính thức, **chấp thuận trước hạn** (MFA).
5. **Giải ngân & thu hồi:** xem tiền về; khi thu hồi, tiền trừ theo thứ tự **phí → lãi → gốc**; phần dư được hoàn.
6. **Chấm điểm & ESG:** xem điểm 5C và lý do từng chỉ tiêu. Không đồng ý thì gửi **yêu cầu xem xét lại**. Khai ESG (mục 3.4).
7. **Kế toán:** nhập CSV công nợ, xem bút toán đề xuất, sao kê giả lập, dự báo dòng tiền 3 kịch bản.
8. **Dữ liệu công khai:** xem thông tin FCC có về doanh nghiệp bạn (luôn có nhãn *Nguồn công khai – tham khảo*); sai thì bấm **Khiếu nại** kèm lý do. Dữ liệu này **không** đưa vào điểm.

### 3.2. Bên mua

1. **Xác nhận hoặc tranh chấp** hóa đơn nhà cung cấp gửi (MFA).
2. **Ghi nhận đã thanh toán:** nhập số tiền, ngày, mã giao dịch. Đây chỉ là bên mua tự báo; hồ sơ tất toán khi **tổ chức tài chính xác nhận tiền về**.
3. **Thanh toán sớm:** tạo đề nghị cho nhà cung cấp, ghi nhận khi đã trả.
4. **Bên mua niêm yết** (muốn có điểm từ dữ liệu thị trường): khai mã chứng khoán ở Cài đặt → **FCC xác minh** mã thuộc đúng MST (Quản trị → *Nguồn dữ liệu công khai*) → bên mua vào mục chấm điểm và bấm **Nạp dữ liệu từ vnstock**. Ý kiến kiểm toán và diện cảnh báo do FCC nhập tay có nguồn.

### 3.3. Tổ chức tài chính

1. Đăng ký tổ chức, rồi **chờ FCC xác minh**. Chưa xác minh thì chưa đăng sản phẩm hay báo giá được.
2. **Sản phẩm:** tạo và sửa sản phẩm (điều kiện, biểu giá, SLA, ưu đãi xanh). Sản phẩm mới hoặc đã sửa phải được FCC duyệt.
3. **Thẩm định:**
   - *RFQ chờ báo giá*: trả báo giá (lãi, % ứng trước) hoặc từ chối.
   - *Hàng đợi hồ sơ*: **bắt đầu thẩm định**, xem điểm hồ sơ, điểm nhà cung cấp, điểm bên mua, chứng từ, tài sản bảo đảm khai báo, dữ liệu công khai được chia sẻ; rồi **ra đề nghị chính thức** hoặc **từ chối**.
4. **Giải ngân:** **Ghi nhận giải ngân** (MFA).
5. **Thu hồi:** nhập số tiền về (đúng số còn phải thu để tất toán); có thể chọn loại *thanh lý tài sản bảo đảm*. Nếu có phần dư, ghi nhận **đã hoàn**.
6. **Giám sát:** cảnh báo sớm theo luật.
7. **Tích hợp (API):** Cài đặt → tạo **khóa tích hợp** theo phạm vi và đặt địa chỉ nhận webhook. Tài liệu API ở `/v1/openapi.json`; gọi `/v1/partner/*` với `Authorization: Bearer fcck_...`. Webhook gửi tới bạn có header `x-fcc-signature` dạng `t=<unix>,v1=<HMAC>`; lệch thời gian quá ±5 phút thì bị từ chối.

### 3.4. ESG

ESG **không có dữ liệu cài sẵn**; doanh nghiệp tự khai trên giao diện (không dùng Google Form):

1. Vào **ESG**, chọn **nhóm ngành**.
2. Với từng chỉ tiêu: chọn **mức 0–3**, hoặc **không áp dụng** kèm lý do.
3. Tải **bằng chứng** (chứng nhận ISO 14001/45001, hóa đơn điện/nước, hợp đồng lao động, báo cáo môi trường…).
4. **AI đề xuất mức** và trích dẫn tài liệu. Nếu bạn chọn khác đề xuất, phải ghi lý do.
5. Điểm ban đầu là **tạm tính**. **FCC reviewer** thẩm định rồi **phát hành điểm chính thức** (MFA). Điều kiện phát hành: bao phủ ≥ 80% và các cờ trọng yếu đã xử lý.

### 3.5. Nhân sự FCC (`/admin`)

| Việc | Ở đâu |
| --- | --- |
| Chỉ số vận hành, ngoại lệ đang mở | Bảng điều khiển |
| Xác minh tổ chức tài chính, duyệt KYC, duyệt sản phẩm | Hàng đợi xác minh |
| Xử lý cờ hóa đơn, ghi kết quả đối chiếu thuế (nhập tay từ tra cứu) | Cờ hóa đơn |
| Phát hành điểm tín dụng, xử lý yêu cầu xem xét lại, duyệt phiên bản bộ chấm điểm (cần **hai người khác nhau**) | Chấm điểm |
| Thẩm định và phát hành điểm ESG | **Thẩm định ESG** (`/admin/esg`) |
| Duyệt nguồn dữ liệu công khai, ghi kết quả tra cứu thủ công, xử lý khiếu nại, xác minh mã chứng khoán, nhập ý kiến kiểm toán | **Nguồn dữ liệu công khai** (`/admin/sources`) |
| Biểu phí, doanh thu theo 6 nguồn, tính phí hằng tháng | Biểu phí và doanh thu |
| Nhật ký và kiểm tra toàn vẹn | Nhật ký |

---

## 4. Dữ liệu công khai: quy tắc cần nhớ

- Nguồn **chưa được FCC phê duyệt thì không chạy**.
- Tự động chỉ đọc **website do chính doanh nghiệp khai** (tìm chứng nhận công bố). Tôn trọng robots.txt, 1 yêu cầu/5 giây; gặp CAPTCHA hoặc đăng nhập thì dừng và chuyển sang tra cứu thủ công.
- Nguồn nhà nước (thuế, đăng ký kinh doanh, hóa đơn điện tử, tòa án, BHXH) **không tự động hóa được**: FCC tra cứu thủ công và ghi kèm đường dẫn nguồn.
- Mọi bản ghi truy được về bản chụp gốc và **không đưa vào điểm tín dụng**.

---

## 5. Thử cùng ngân hàng giả lập

```bash
cd server && npx tsx scripts/provision-sim-bank.ts   # khi backend đang tắt; ghi sim-bank/config.local.json
cd server && npm start                               # chạy lại backend
cd sim-bank && npm install && npm start              # http://127.0.0.1:8790 (bảng điều khiển)
```

Sau đó đi một vòng: nhà cung cấp tạo hóa đơn → bên mua xác nhận → gửi RFQ → ngân hàng giả lập **tự báo giá** theo hạng → chọn báo giá → ngân hàng ra đề nghị → chấp thuận → giải ngân sau khoảng 30 giây. Trên bảng điều khiển có thể ép kịch bản cho từng hồ sơ: từ chối, trễ giải ngân, bên mua trả một phần, không có tiền về, gửi giải ngân trùng hoặc sai chữ ký. Chi tiết: [sim-bank/README.md](sim-bank/README.md).

---

## 6. Hỏi nhanh

| Câu hỏi | Trả lời |
| --- | --- |
| Không đăng nhập được | Dev: mở thẳng `/supplier`, `/buyer`, `/lender`, `/admin`. Đăng nhập thật: backend phải chạy ở `FCC_ENV=staging/production`; giao diện phải trỏ đúng backend (`FCC_API_URL`) |
| Báo "cần MFA" | Vào `/security`, bật MFA, rồi nhập mã 6 số khi được hỏi |
| Tổ chức tài chính không đăng được sản phẩm | Chờ FCC xác minh tổ chức; sản phẩm mới cũng phải được FCC duyệt |
| Điểm bên mua báo "Thiếu BCTC" | Bên mua chưa có BCTC: nhập tay, tải lên, hoặc (nếu niêm yết) nạp từ vnstock sau khi FCC xác minh |
| Nạp vnstock bị từ chối | FCC chưa xác minh mã chứng khoán, hoặc mã khác với mã đã khai |
| Hồ sơ chưa tất toán dù bên mua đã bấm thanh toán | Bên mua chỉ tự báo; tổ chức tài chính phải **ghi nhận tiền về** đúng số còn phải thu |
| AI không trả lời | Kiểm tra `OLLAMA_API_KEY` trong `server/.env`. Khi AI lỗi, hệ thống báo lỗi để nhập tay, không tự điền số |
| Mất khóa mã hóa | Mất `FCC_DATA_KEY` (hoặc `server/data/data.key` ở dev) là mất toàn bộ tệp chứng từ; hãy cất riêng |

## 7. Lưu ý an toàn

- Chế độ dev không đăng nhập: chỉ chạy trên máy mình, không đưa ra Internet.
- Chưa nhập dữ liệu doanh nghiệp thật cho đến khi có quyết định về AI (nội bộ hay dịch vụ ngoài), HTTPS và sao lưu (xem [VAN_HANH.md](document/VAN_HANH.md)).
- Khóa API và mật khẩu chỉ nằm trong các tệp `.env*` (đã gitignore). Không dán vào chat hay commit.
