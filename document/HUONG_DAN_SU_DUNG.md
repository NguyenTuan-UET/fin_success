# FCC — hiện trạng và hướng dẫn sử dụng phiên bản hiện tại

**Cập nhật:** 16/10/2026 · Đọc kèm: [README.md](../README.md) (cách chạy), [VAN_HANH.md](VAN_HANH.md) (triển khai), [SPEC_HOAN_THIEN.md](SPEC_HOAN_THIEN.md) (kế hoạch và trạng thái từng gói việc)

Phase này **không kết nối ngân hàng thật**. Phía ngân hàng và tổ chức tài chính do `sim-bank/` giả lập (tổ chức hư cấu, đi qua đúng API đối tác và webhook ký HMAC). Mọi chức năng còn lại chạy thật.

---

## 1. Đã làm

### Nền tảng
- PostgreSQL có ràng buộc ở mức CSDL: mỗi khoản phải thu chỉ có một hồ sơ tài trợ hoạt động, một RFQ mở, MST và hóa đơn không trùng.
- Nhật ký kiểm toán chỉ thêm, mỗi sự kiện nối chuỗi băm với sự kiện trước; có công cụ kiểm tra toàn vẹn.
- Kho tệp chứng từ mã hóa AES-256-GCM, định danh theo SHA-256.
- Đăng nhập email/mật khẩu, MFA TOTP, xác thực lại (step-up, 10 phút) cho hành động nhạy cảm.
- Một người thuộc nhiều tổ chức, mỗi nơi một vai trò; mời thành viên; thu hồi quyền có hiệu lực ngay.
- Xác minh người đại diện (KYC) bằng giấy tờ tải lên, nhân sự FCC đối chiếu.
- API công khai `/v1` có OpenAPI, cập nhật thời gian thực (SSE), khóa tích hợp theo phạm vi, webhook hai chiều ký HMAC có timestamp, `Idempotency-Key`, giới hạn tần suất.
- Sao lưu và diễn tập khôi phục; PWA (cài lên điện thoại, không lưu dữ liệu API trên thiết bị).

### Nghiệp vụ
- **Hóa đơn / khoản phải thu:** nhập XML, ảnh/PDF qua AI OCR (người dùng xác nhận trước khi lưu) hoặc nhập tay; phát hiện bất thường (số tiền lạ, bên nhập khẩu mới số tiền lớn, ngày phát hành tương lai, dồn dập…); hóa đơn điều chỉnh; hàng đợi cờ do FCC xử lý; đối chiếu thuế do FCC nhập kết quả tra cứu.
- **Chấm điểm:** điểm đơn vị xuất khẩu theo 5C, điểm bên nhập khẩu, điểm hồ sơ tài trợ. Tính ở máy chủ, lưu bất biến, cùng đầu vào cho cùng kết quả. Có xem xét lại (appeal). Phiên bản bộ chấm điểm cần hai người duyệt.
- **ESG:** hồ sơ và bằng chứng, AI đề xuất mức kèm trích dẫn, luật kiểm tra ở máy chủ; FCC phát hành điểm chính thức (cần MFA).
- **Marketplace và tài trợ:** sản phẩm của tổ chức tài chính, khớp và chi phí ước tính, RFQ (tối đa 3 sản phẩm), báo giá, thẩm định, đề nghị chính thức, chấp thuận (MFA), giải ngân.
- **Thu hồi:** thu theo phí → lãi → gốc (có lãi quá hạn), thanh toán một phần, đối soát, thanh lý tài sản bảo đảm, hoàn phần dư cho đơn vị xuất khẩu. Định giá sơ bộ tài sản bảo đảm và phân loại (i)/(ii)/(iii). Cảnh báo sớm (EWS).
- **Thanh toán sớm từ bên nhập khẩu.**
- **Kế toán và dòng tiền:** nhập CSV công nợ; bút toán đề xuất theo TT133/TT200 (xuất file); sao kê ngân hàng giả lập; dự báo dòng tiền 3 kịch bản, lưu kèm sai số dự báo.
- **Phí và doanh thu:** biểu phí có phiên bản, 6 nguồn thu, hóa đơn phí in được, xuất CSV, chạy tính phí hằng tháng.
- **Thông báo:** trong ứng dụng và email (hàng đợi có thử lại), tùy chọn theo loại thông báo.
- **Dữ liệu công khai:** đọc tự động website do doanh nghiệp tự khai (khi FCC duyệt nguồn); FCC tra cứu thủ công nguồn nhà nước kèm đường dẫn; bản chụp có băm; doanh nghiệp khiếu nại được. Dữ liệu này chỉ để tham khảo, không đưa vào điểm.
- **Bên nhập khẩu niêm yết (vnstock):** FCC xác minh ánh xạ MST ↔ mã chứng khoán trước khi nạp; dữ liệu tự làm mới định kỳ; ý kiến kiểm toán và diện cảnh báo do FCC đối chiếu và xác nhận có nguồn (chưa xác nhận thì không được chấm).
- **Trợ lý AI:** chỉ diễn giải số liệu do máy chủ trả về, từ chối câu hỏi ngoài phạm vi.
- **Quản trị (`/admin`):** chỉ số vận hành thật, duyệt tổ chức tài chính và sản phẩm, KYC, ESG, điểm tín dụng, nguồn dữ liệu, biểu phí; tài khoản kiểm toán viên chỉ đọc, mọi lần truy cập được ghi lại.

### Ngân hàng giả lập
- 3 tổ chức hư cấu báo giá, thẩm định, giải ngân qua API đối tác, có bảng điều khiển kịch bản (trễ giải ngân, từ chối, thanh toán một phần, webhook trùng hoặc sai chữ ký…).

---

## 2. Chưa làm

**Cần đối tác hoặc quyết định bên ngoài**
- Kết nối ngân hàng thật (để phase sau).
- Chữ ký số từ xa và eKYC qua đơn vị xuất khẩu (đang dùng MFA + băm nội dung và FCC đối chiếu giấy tờ).
- Kết nối trực tiếp phần mềm kế toán (MISA…): hiện nhập CSV.
- Tra cứu tự động cơ quan thuế, đăng ký kinh doanh, hóa đơn điện tử, tòa án, BHXH: các cổng này dùng CAPTCHA, đăng nhập hoặc không kết nối được, nên chỉ tra cứu thủ công.
- Giấy phép vnstock cho mục đích thương mại; pháp chế duyệt từng nguồn crawl.

**Chưa có trong mã**
- vnstock chỉ cho dữ liệu gần thời gian thực (làm mới 15 phút trong giờ giao dịch), không phải giá khớp lệnh tức thời.
- Tác vụ xóa bản chụp crawl quá 24 tháng.
- Sản phẩm bảo lãnh, LC, bảo hiểm tín dụng, tài trợ thương mại quốc tế.
- Client TypeScript sinh từ OpenAPI; bộ câu hỏi mẫu tự động cho trợ lý AI.
- Ứng dụng di động native; huấn luyện lại mô hình bằng dữ liệu thật.
- Đăng nhập qua Google/OIDC hoặc Supabase (hiện tự cài đặt email/mật khẩu + TOTP).

**Cần làm trước pilot (không thuộc mã)**
- Quyết định AI nội bộ hay dịch vụ ngoài (hiện gọi ollama.com, chứng từ đi ra ngoài khi dùng AI đọc chứng từ).
- Hiệu chỉnh tham số chấm điểm bởi chuyên gia tín dụng (hiện là giá trị khởi tạo, chưa thẩm định).
- Biểu phí ban đầu, đơn vị xuất khẩu email (SMTP).
- Hạ tầng có TLS, quản lý khóa bí mật, cảnh báo job, neo băm nhật ký ra nơi lưu độc lập.
- Đổi khóa Ollama đã lộ trong quá trình phát triển.

---

## 3. Hướng dẫn sử dụng

### 3.1. Ba cách chạy

| Cách | Khi nào dùng | Đăng nhập |
| --- | --- | --- |
| **Dev** (`FCC_ENV=dev`, mặc định) | Thử nhanh trên máy mình | Không: mở `/supplier`, `/buyer`, `/lender`, `/admin`, mỗi vai trò một tab |
| **Đăng nhập thật** (`FCC_ENV=staging`/`production`) | Thử như người dùng thật, hoặc cho người khác vào | Email/mật khẩu + MFA |
| **Máy cá nhân + tunnel** | Cho người khác truy cập qua Vercel | Như đăng nhập thật |

**Chạy dev**
```bash
cd server && npm install && scripts/pg-local.sh start && cp .env.example .env && npm start   # http://127.0.0.1:8787
cd web && npm install && npm run dev                                                          # http://localhost:3000
```
Điền `OLLAMA_API_KEY` trong `server/.env` để dùng AI. Cơ sở dữ liệu khởi động trống, không có dữ liệu mẫu.

**Chạy đăng nhập thật trên máy mình, đưa ra Vercel**
```bash
cd server
scripts/pg-local.sh start
scripts/run-public.sh                              # đọc server/.env.production
cloudflared tunnel --url http://127.0.0.1:8787     # in ra địa chỉ https://xxx.trycloudflare.com
```
Trên Vercel đặt biến `FCC_API_URL` bằng địa chỉ tunnel và Redeploy. Địa chỉ tunnel miễn phí **đổi mỗi lần chạy lại**; hệ thống chỉ truy cập được khi máy bật và cả hai tiến trình đang chạy. Đặt `APP_URL` trong `server/.env.production` bằng địa chỉ Vercel. Không nhập dữ liệu doanh nghiệp thật khi chạy kiểu này.

### 3.2. Đăng nhập, MFA, thành viên
1. Vào `/login` → tab **Đăng ký tổ chức** để tạo tổ chức (đơn vị xuất khẩu, bên nhập khẩu hoặc tổ chức tài chính) kèm tài khoản chủ tổ chức. Tài khoản quản trị FCC được tạo từ `ADMIN_EMAIL` và `ADMIN_PASSWORD` khi khởi động.
2. Vào `/security` để bật **MFA** (quét mã bằng app Authenticator). Các hành động nhạy cảm yêu cầu nhập mã lại: xác nhận hoặc tranh chấp hóa đơn, gửi RFQ, chọn báo giá, chấp thuận đề nghị, chia sẻ dữ liệu, giải ngân, ghi nhận tiền về, phát hành điểm.
3. Ở **Cài đặt**: sửa hồ sơ tổ chức, nộp KYC, mời thành viên (email + vai trò), đổi hoặc thu hồi vai trò, chọn loại thông báo gửi email.

Vai trò: đơn vị xuất khẩu và bên nhập khẩu có *Chủ tổ chức*, *Người phê duyệt*, *Người lập hồ sơ*; tổ chức tài chính có *Chuyên viên thẩm định*, *Quản lý sản phẩm*; FCC có *Quản trị*, *Thẩm định tín dụng/ESG*, *Vận hành*, *Chủ mô hình chấm điểm*, *Kiểm toán (chỉ đọc)*. Người lập hồ sơ không được phê duyệt hay cam kết.

### 3.3. Đơn vị xuất khẩu
1. **Cài đặt:** khai đủ hồ sơ (năm thành lập, lao động, ngành…), nhập website nếu muốn FCC đọc chứng nhận công bố, nộp KYC.
2. **Hóa đơn** → thêm khoản phải thu: tải XML hoặc ảnh/PDF để AI trích xuất (kiểm tra lại số liệu rồi mới lưu), hoặc nhập tay; đính chứng từ gốc (hóa đơn, hợp đồng ngoại thương, chứng từ giao hàng). Gửi cho bên nhập khẩu xác nhận. Nếu bị tranh chấp, sửa và gửi lại.
3. **Chứng từ hải quan:** mở chi tiết hóa đơn → mục *Chứng từ hải quan*: chọn loại (tờ khai xuất khẩu, vận đơn, phiếu đóng gói, C/O…), tải tệp và khai số tờ khai, ngày, tình trạng thông quan. Chỉ thêm, không gỡ. Bên nhập khẩu thêm tờ khai nhập khẩu / xác nhận nhận hàng ở cùng mục (sau khi hóa đơn được gửi). Cần có tờ khai xuất khẩu đã thông quan trước khi gửi RFQ (hằng `CUSTOMS_GATE` trong `packages/domain/src/customs.ts`: `warn` cảnh báo, `block` chặn). FCC chỉ ghi nhận thông tin bạn khai, chưa đối chiếu với cơ quan hải quan.
4. **Marketplace:** xem danh sách sản phẩm phù hợp với chi phí ước tính; chọn tối đa 3 sản phẩm để gửi **RFQ**; so sánh báo giá và **chọn báo giá** (MFA).
5. **Hồ sơ tài trợ:** theo dõi thẩm định; khi có đề nghị chính thức thì **chấp thuận** (MFA) trước hạn.
6. **Giải ngân & thu hồi:** xem tiền về, thu theo phí → lãi → gốc, phần dư được hoàn.
7. **Chấm điểm & ESG:** xem điểm 5C, mức xếp hạng và lý do; nếu không đồng ý thì gửi *yêu cầu xem xét lại*. Khai hồ sơ ESG và tải bằng chứng; điểm chính thức do FCC phát hành.
8. **Kế toán:** nhập CSV công nợ, xem bút toán đề xuất, sao kê giả lập và dự báo dòng tiền.
9. **Dữ liệu công khai:** xem những gì FCC có về doanh nghiệp bạn; nếu sai thì bấm **Khiếu nại** và nêu lý do.

### 3.4. Bên nhập khẩu
- **Xác nhận hoặc tranh chấp** hóa đơn đơn vị xuất khẩu gửi (MFA).
- **Ghi nhận đã thanh toán:** nhập số tiền, ngày, mã giao dịch. Việc này chỉ là bên nhập khẩu tự báo; hồ sơ chỉ tất toán khi tổ chức tài chính xác nhận tiền về.
- **Chương trình thanh toán sớm:** tạo đề nghị cho đơn vị xuất khẩu, ghi nhận khi đã trả.
- Bên nhập khẩu niêm yết khai mã chứng khoán ở Cài đặt; sau khi FCC xác minh, máy chủ tự lấy dữ liệu từ vnstock định kỳ; bấm **Làm mới ngay** ở Cài đặt để lấy ngay.

### 3.5. Tổ chức tài chính
1. Đăng ký tổ chức rồi **chờ FCC xác minh** (chưa xác minh thì chưa đăng sản phẩm hoặc báo giá được).
2. **Sản phẩm:** tạo và sửa sản phẩm (điều kiện, biểu giá, SLA, ưu đãi xanh); sản phẩm mới hoặc sửa phải được FCC duyệt.
3. **Thẩm định:** *RFQ chờ báo giá* → trả báo giá (lãi, % ứng) hoặc từ chối. *Hàng đợi hồ sơ* → bắt đầu thẩm định, xem điểm hồ sơ, điểm đơn vị xuất khẩu, điểm bên nhập khẩu, chứng từ gốc, tài sản bảo đảm khai báo và dữ liệu công khai được chia sẻ → ra đề nghị chính thức hoặc từ chối.
4. **Giải ngân:** *Ghi nhận giải ngân* (MFA). **Thu hồi:** nhập số tiền về (đúng số còn phải thu để tất toán), có thể chọn loại *thanh lý tài sản bảo đảm*; nếu có phần dư thì ghi nhận *đã hoàn*.
5. **Giám sát:** cảnh báo sớm (EWS) theo luật.
6. **Cài đặt → tích hợp:** tạo **khóa tích hợp** theo phạm vi và đặt địa chỉ nhận webhook. Với API: tài liệu OpenAPI ở `/v1/openapi.json`; gọi `/v1/partner/*` với `Authorization: Bearer fcck_...`; webhook gửi tới bạn có header `x-fcc-signature` dạng `t=<unix>,v1=<HMAC>`, sai lệch thời gian quá ±5 phút bị từ chối.

### 3.6. Nhân sự FCC (`/admin`)
- **Bảng điều khiển:** chỉ số vận hành (người dùng, khoản phải thu, giá trị tài trợ, tỷ lệ phê duyệt, tỷ lệ tranh chấp, thời gian từng bước, ngoại lệ đang mở).
- **Hàng đợi xác minh:** xác minh tổ chức tài chính, duyệt KYC, duyệt sản phẩm.
- **Cờ hóa đơn:** xử lý cờ bất thường, ghi kết quả đối chiếu thuế (nhập thủ công).
- **Chấm điểm:** phát hành điểm chính thức (MFA); xử lý yêu cầu xem xét lại (chấp nhận thì chấm lại bằng dữ liệu hiện tại); đề xuất và duyệt phiên bản bộ chấm điểm (cần hai người khác nhau).
- **Thẩm định ESG** (`/admin/esg`): thẩm định bằng chứng và phát hành điểm ESG.
- **Nguồn dữ liệu công khai** (`/admin/sources`): duyệt hoặc chặn từng nguồn (cần MFA và ghi căn cứ); xem hàng đợi crawl và việc tra cứu thủ công; ghi kết quả tra cứu kèm URL; xử lý khiếu nại (chấp nhận thì gỡ bản ghi, giữ nguyên thì ghi lý do); xác minh mã chứng khoán của bên nhập khẩu; nhập ý kiến kiểm toán và diện giao dịch.
- **Biểu phí và doanh thu:** tạo biểu phí mới (có ngày hiệu lực, không sửa biểu cũ), xem doanh thu theo 6 nguồn, chạy tính phí hằng tháng, đánh dấu đã thanh toán.
- **Nhật ký:** xem, lọc theo thời gian, kiểm tra toàn vẹn chuỗi băm. Tài khoản kiểm toán viên chỉ đọc và mọi lần truy cập đều được ghi lại.

### 3.7. Dữ liệu công khai: nguyên tắc
- Nguồn **chưa được FCC phê duyệt thì không chạy**.
- Tự động chỉ áp dụng cho website doanh nghiệp tự khai; tôn trọng robots.txt, 1 yêu cầu/5 giây/máy chủ; gặp CAPTCHA, đăng nhập hoặc bị chặn thì dừng 24 giờ và chuyển sang tra cứu thủ công.
- Mỗi bản ghi truy được về bản chụp gốc (URL, thời điểm, mã băm, phiên bản parser) và luôn có nhãn **"Nguồn công khai – tham khảo"**.
- **Không đưa vào điểm tín dụng.**

### 3.8. Thử cùng ngân hàng giả lập
1. Dừng backend, cấp phát: `cd server && npx tsx scripts/provision-sim-bank.ts` (ghi `sim-bank/config.local.json`).
2. Chạy lại backend, rồi `cd sim-bank && npm install && npm start` (bảng điều khiển ở `http://127.0.0.1:8790`).
3. Đơn vị xuất khẩu tạo hóa đơn → bên nhập khẩu xác nhận → gửi RFQ → ngân hàng giả lập tự báo giá theo hạng → chọn báo giá → ngân hàng ra đề nghị → chấp thuận → giải ngân sau khoảng 30 giây.
4. Trên bảng điều khiển có thể ép kịch bản cho từng hồ sơ: từ chối, trễ giải ngân, bên nhập khẩu trả một phần, không có tiền về, gửi lại giải ngân trùng hoặc sai chữ ký.

Xem chi tiết ở [sim-bank/README.md](../sim-bank/README.md).

---

## 4. Kiểm thử và sao lưu

```bash
cd server && npm test            # 78 test: API, phân quyền, MFA, webhook, crawl, thanh toán…
cd packages/domain && npm test   # 37 test công thức chấm điểm, ESG, thu hồi…
cd sim-bank && npm test          # 5 test
cd web && npm run e2e            # Playwright; cần backend dev đang chạy và CSDL mới
cd server && scripts/backup.sh && scripts/restore-check.sh    # sao lưu và diễn tập khôi phục
```

**Cất riêng `FCC_DATA_KEY`** (hoặc `server/data/data.key` ở dev): mất khóa này là mất toàn bộ tệp chứng từ đã mã hóa.

## 5. Lưu ý an toàn
- Chế độ dev không có đăng nhập, chỉ cho chạy trên localhost; không đưa ra Internet.
- Điểm và xếp hạng chỉ là tham khảo của FCC, không phải quyết định tín dụng; tổ chức tài chính tự thẩm định, ra quyết định và giải ngân.
- Không nhập dữ liệu doanh nghiệp thật cho tới khi có quyết định về AI (nội bộ hay dịch vụ ngoài), TLS và sao lưu theo [VAN_HANH.md](VAN_HANH.md).
- Khóa API và mật khẩu chỉ nằm trong các tệp `.env*` (đã gitignore), không dán vào chat hay commit.
