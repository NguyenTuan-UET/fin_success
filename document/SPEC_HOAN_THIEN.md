# FCC — đặc tả hoàn thiện chức năng (từ hiện trạng tới pilot)

**Phiên bản:** 1.1 · **Ngày:** 16/10/2026 · **Đọc kèm:** [SPEC_FCC_MVP.md](SPEC_FCC_MVP.md) (v2.0), [REPPORT_FINSUCCESS.md](REPPORT_FINSUCCESS.md) (hồ sơ dự án)

`SPEC_FCC_MVP.md` mô tả **hệ thống cần có**: nguyên tắc, yêu cầu F01–F27, mô hình dữ liệu, API, pháp lý. Tài liệu này mô tả **cách đi từ code hiện tại tới đủ chức năng** mà hồ sơ dự án cam kết: hiện trạng từng yêu cầu, quyết định phạm vi, gói việc (WP) kèm tiêu chí nghiệm thu, và thứ tự làm. Khi hai tài liệu khác nhau về phạm vi, tài liệu này áp dụng cho phase hiện tại; nguyên tắc ở mục 1.2 của SPEC v2.0 vẫn giữ nguyên.

**Thay đổi so với 1.0:** phía ngân hàng/tổ chức tài chính được **giả lập** thay vì bỏ trống; mọi chức năng khác trong hồ sơ dự án đều làm thật. Bổ sung theo hồ sơ dự án: tài sản bảo đảm và định giá sơ bộ, phân loại (i)/(ii)/(iii), xác thực hóa đơn với cơ quan thuế, đồng bộ hóa đơn điện tử, chữ ký số khi chia sẻ dữ liệu, sổ nhật ký chống sửa (thay blockchain), bút toán khi giải ngân/tất toán, phí và doanh thu, phát hiện gian lận. vnstock chuyển từ "ưu tiên thấp" sang nguồn chính cho bên mua đầu chuỗi niêm yết.

## 1. Hiện trạng code (16/10/2026)

| Thư mục | Là gì | Tình trạng |
| --- | --- | --- |
| `web/` | Giao diện Next.js 16, 16 màn hình theo vai trò (nhà cung cấp, bên mua, tổ chức tài chính, quản trị) | Giao diện hoàn chỉnh, **dữ liệu cứng** trong `src/lib/data.ts`, không gọi API. Các nút xuất file, báo cáo, mời, liên kết… chỉ hiện thông báo. Trợ lý FCC trả lời theo luật cứng |
| `web-legacy/` | Giao diện React + Vite nối với `server/` | Chạy được trọn luồng nghiệp vụ. Bộ chấm điểm tín dụng, ESG, khớp sản phẩm, dòng tiền nằm ở `src/domain/` và **chạy trong trình duyệt** |
| `server/` | Fastify + SQLite | Luật nghiệp vụ và phân quyền ở `service.ts`; 37 action qua `POST /api/actions/:name`; webhook giải ngân HMAC + idempotency; proxy AI Ollama; tác vụ định kỳ mỗi phút. **Import mã domain từ `web-legacy/`** |
| `ocr_lab/` | Thí nghiệm OCR hóa đơn (RapidOCR + VietOCR) trên 10 hóa đơn mẫu | Chưa tích hợp vào ứng dụng |
| `scripts/fetch_listed.py` | Lấy BCTC bên mua niêm yết qua vnstock | Chạy tay, ghi JSON vào `web-legacy/public/listed/` |

Các đặc điểm kỹ thuật quyết định khối lượng việc:

- **Lưu trữ:** toàn bộ trạng thái nghiệp vụ nằm trong một bảng `docs` (mỗi bản ghi là một chuỗi JSON). Mỗi thao tác ghi lại toàn bộ trạng thái. Không có ràng buộc duy nhất ở mức CSDL, không chạy được nhiều tiến trình.
- **Đăng nhập đã bị tắt** (15/10): mỗi vai trò vào bằng một phiên cố định (`/supplier`, `/buyer`, `/lender`, `/fcc`), chỉ chạy trên localhost. Ở chế độ này, sản phẩm tự công bố, tổ chức tài chính tự được xác minh, bỏ nhập lại mật khẩu. API `/api/auth/*` vẫn còn và có test.
- **Chứng từ:** chứng từ hóa đơn chỉ lưu cờ có/không (`docs.xml`, `docs.contract`, `docs.delivery`), không lưu tệp gốc. Bằng chứng ESG lưu dạng data URL trong CSDL (tối đa khoảng 6 MB).
- **Đồng bộ:** trình duyệt hỏi `GET /api/state?since=` mỗi 4 giây và nhận về toàn bộ dữ liệu đã lọc theo quyền.
- **Kiểm thử:** 14 test end-to-end cho server, 6 test cho công thức chấm điểm. `web/` chưa có test; `eslint` của `web/` còn 1 lỗi ở `BuyerConfirm.tsx:74`.

## 2. Phạm vi phase này

### 2.1. Quyết định đã chốt

1. **Phía ngân hàng/tổ chức tài chính được giả lập, không liên hệ đối tác thật.** Một dịch vụ giả lập (WP14) đóng vai các tổ chức tài chính và đi qua **đúng các API và webhook mà đối tác thật sẽ dùng**: đăng sản phẩm, báo giá, thẩm định, cấp hạn mức, ký đề nghị, giải ngân, nhận thanh toán, tất toán, xử lý quá hạn. Dữ liệu vốn chỉ ngân hàng có (sao kê tài khoản, sự kiện tiền vào/ra) cũng do dịch vụ này sinh ra. Thay bằng ngân hàng thật về sau chỉ là cấp khóa tích hợp và cấu hình, không sửa nghiệp vụ.
2. **Mọi chức năng khác làm thật.** Chức năng phụ thuộc đối tác không phải ngân hàng (nhà cung cấp hóa đơn điện tử, phần mềm kế toán, nhà cung cấp chữ ký số) được xây đủ adapter và chạy được khi có tài khoản đối tác; trong lúc chờ, dùng đường thay thế thật (nhập file, tra cứu thủ công có hỗ trợ), **không giả lập**.
3. **`web/` là giao diện duy nhất.** Nối `web/` với `server/` theo từng màn hình; khi `web/` phủ đủ chức năng của `web-legacy/` thì ngừng `web-legacy/`.
4. **Bật lại xác thực** trước khi chạy ngoài localhost. Phiên theo vai trò chỉ còn trong môi trường `dev`.
5. **vnstock giữ lại cho bên mua đầu chuỗi niêm yết.** Hồ sơ dự án đặt uy tín và khả năng thanh toán của bên mua (anchor buyer) làm cơ sở để tổ chức tài chính tài trợ cả khi nhà cung cấp không có tài sản bảo đảm (mục 3.3.b, bước 2–3). Các ngành mục tiêu (thép, vật liệu xây dựng, giấy, sợi) có nhiều bên mua đầu chuỗi niêm yết, và BCTC đã công bố là nguồn số liệu tài chính tốt nhất về họ. Không nguồn crawl nào trong WP10-B cung cấp BCTC có cấu trúc. Vì vnstock có ràng buộc giấy phép thương mại (SPEC v2.0 mục 9.1), truy cập qua một interface để thay được bằng nguồn công bố thông tin của Sở giao dịch chứng khoán (WP10-A).
6. **Crawl dữ liệu công khai để hiển thị** (F27): nguồn công khai nào lấy được hợp lệ thì làm, theo SPEC v2.0 mục 9.2 — không vượt CAPTCHA, đăng nhập hay biện pháp chặn kỹ thuật. Dữ liệu crawl hiển thị với nhãn "Nguồn công khai – tham khảo"; chưa đưa vào điểm tín dụng ở phase này.
7. **Blockchain → sổ nhật ký chống sửa.** Hồ sơ dự án dùng blockchain để "xác thực thông tin, giao dịch và hạn chế giả mạo". Phase này đạt cùng mục đích bằng nhật ký nối chuỗi băm (mỗi sự kiện chứa hash của sự kiện trước) và SHA-256 cho mọi chứng từ, kèm công cụ kiểm tra toàn vẹn. Không dùng blockchain công khai: không cần thêm bên thứ ba để đạt mục đích và tránh đưa dữ liệu doanh nghiệp ra ngoài.
8. **Ứng dụng di động → web responsive cài được (PWA).** `web/` đã responsive; thêm manifest và service worker để cài lên điện thoại. Ứng dụng native để sau khi có người dùng thật.
9. **FCC không giữ tiền, không cho vay, không tự quyết định tín dụng** (giữ nguyên SPEC v2.0 mục 1.2). Hạn mức, lãi suất, phê duyệt luôn đến từ phía tổ chức tài chính (ở phase này là dịch vụ giả lập).

### 2.2. Để sau (theo chính hồ sơ dự án)

- **Bảo hiểm tín dụng, tài trợ thương mại quốc tế:** hồ sơ dự án xếp vào giai đoạn 3 của kế hoạch kinh doanh.
- **Mở rộng ngành** logistics, nông nghiệp, dệt may, FMCG: giai đoạn 2. Phase này chỉ bảo đảm bảng ngành và trọng số ESG có cấu hình được cho các ngành đó.
- **Tái huấn luyện mô hình chấm điểm bằng dữ liệu ẩn danh (data recycling):** phase này chỉ lưu bộ dữ liệu ẩn danh sau tất toán (WP6); huấn luyện lại cần đủ số hồ sơ thật.
- **Ghi ngược trực tiếp vào phần mềm kế toán của doanh nghiệp:** phase này sinh bút toán để doanh nghiệp duyệt và xuất file nhập vào phần mềm kế toán (WP9).

## 3. Hiện trạng theo yêu cầu F01–F27

**Đã có**: đạt phần lớn tiêu chí của SPEC v2.0 trên `web-legacy/` + `server/`. **Một phần**: chạy được nhưng thiếu tiêu chí quan trọng. **Chưa có**: chưa có code. Dấu (\*) là mục đánh giá từ đọc code, cần kiểm tra lại khi bắt đầu gói việc tương ứng.

| ID | Yêu cầu | Hiện trạng | Thiếu so với tiêu chí | Gói việc |
| --- | --- | --- | --- | --- |
| F01 | Tổ chức, người dùng, phân quyền, MFA | Một phần | Một người dùng mỗi tổ chức; không mời thành viên, không vai trò owner/operator/approver, không MFA; giao diện đã bỏ đăng nhập | WP2 |
| F02 | Tải chứng từ | Một phần | Hóa đơn không lưu tệp gốc; không SHA-256, không quét mã độc, không object storage | WP1, WP5 |
| F03 | Trích xuất, kiểm tra hóa đơn | Một phần | Có đọc XML TT78 và AI OCR; không lưu song song giá trị AI và giá trị người sửa, không vị trí trang và độ tin cậy; chưa xác thực với cơ quan thuế | WP5 |
| F04 | Chống trùng | Đã có | Có dấu vân tay hóa đơn và test chặn trùng; thiếu hàng đợi xử lý xung đột | WP5 |
| F05 | Bên mua xác nhận/tranh chấp | Đã có | Thiếu ủy quyền theo người và MFA; nhập lại mật khẩu đang tắt | WP2, WP5 |
| F06 | Quyền chia sẻ dữ liệu | Một phần | Quyền được cấp tự động khi gửi RFQ/chọn báo giá và thu hồi được; doanh nghiệp chưa tự chọn bên nhận, mục đích, thời hạn; chưa ký số | WP2, WP8 |
| F07 | Gửi và theo dõi hồ sơ | Đã có | Idempotency mới có ở webhook; ràng buộc "một hồ sơ hoạt động" mới ở mức code, chưa ở CSDL | WP1, WP3 |
| F08 | Báo giá và chấp thuận | Đã có | — | WP4 (giao diện) |
| F09 | Giải ngân, thanh toán, tất toán | Một phần | Thanh toán một phần, sự kiện tiền từ phía ngân hàng, hoàn phần còn lại cho nhà cung cấp, đối soát số dư | WP8, WP14 |
| F10 | Nhật ký | Một phần | Không có trước/sau, correlation ID, chuỗi băm; nhật ký nằm chung khối JSON nên sửa được | WP1, WP12 |
| F11 | Thông báo | Một phần | Chỉ trong ứng dụng; không email, không hàng đợi thử lại | WP11 |
| F12 | Chấm điểm bên bán | Một phần | Chạy trong trình duyệt; kết quả không lưu bất biến; phiên bản là chuỗi cố định; tham số là giá trị khởi tạo; chưa tính tài sản bảo đảm và phân loại (i)/(ii)/(iii) ở server | WP6, WP8 |
| F13 | Chấm điểm bên mua qua vnstock | Một phần | Script tay; ánh xạ MST ↔ mã chưa xác minh; thiếu ý kiến kiểm toán, diện cảnh báo | WP10 |
| F14 | Điểm hồ sơ và giải thích | Một phần | Chưa có yêu cầu xem xét lại (appeal) | WP6 |
| F15 | AI trích xuất BCTC/CIC/thuế | Một phần (\*) | Không vị trí trang, độ tin cậy, ngưỡng chính xác | WP5, WP9 |
| F16 | Hồ sơ ESG và bằng chứng | Một phần (\*) | Lưu bằng chứng trong CSDL; cần kiểm tra quy tắc loại tài liệu quá 12 tháng | WP1, WP7 |
| F17 | AI đề xuất mức ESG | Một phần (\*) | Bắt buộc trích dẫn cho mức ≥ 2; bắt buộc lý do khi reviewer sửa | WP7 |
| F18 | Tính điểm ESG | Đã có | Có test tái lập 66,67, N/A, cờ trọng yếu | — |
| F19 | ESG chuỗi cung ứng | Một phần (\*) | Cần đối chiếu công thức gia quyền và định nghĩa "nhà cung cấp xanh" với SPEC 5.5 | WP7 |
| F20 | Sản phẩm Marketplace | Một phần | Có trạng thái và FCC duyệt (đang tự duyệt ở chế độ hiện tại); chưa có phiên bản sản phẩm; chưa có loại bảo lãnh, LC | WP8, WP14 |
| F21 | Khớp và chi phí ước tính | Đã có | Có test công thức | — |
| F22 | RFQ | Đã có | Chạy đúng vì server một tiến trình; cần ràng buộc CSDL khi chuyển PostgreSQL | WP1 |
| F23 | Thanh toán sớm từ bên mua | Đã có (\*) | Ghi nhận chứng từ thanh toán | WP8 |
| F24 | Tổng quan theo vai trò | Một phần | `web-legacy/` tính từ dữ liệu thật; `web/` toàn số cứng | WP4 |
| F25 | Kết nối kế toán | Một phần | Có nhập CSV công nợ; chưa có connector, chưa sinh bút toán | WP9 |
| F26 | Dự báo dòng tiền | Một phần (\*) | Đo và hiển thị sai số dự báo; chưa dùng sao kê | WP9, WP14 |
| F27 | Nguồn dữ liệu và crawl | Chưa có | Có danh mục nguồn (`server/src/reference.ts`); chưa có crawler, snapshot, khiếu nại | WP10 |

Chức năng có trong hồ sơ dự án nhưng chưa có mã F trong SPEC v2.0, được thêm ở tài liệu này: tài sản bảo đảm và định giá sơ bộ (WP8), phát hiện gian lận (WP5, WP8), bút toán (WP9), phí và doanh thu (WP15), chữ ký số và eKYC (WP2), PWA (WP4).

## 4. Kiến trúc đích của phase

```
web/ (Next.js, PWA) ──HTTPS──▶ server/ (Fastify, API /v1) ──▶ PostgreSQL
   ▲                              │   ├──▶ Lưu trữ tệp (S3-compatible; MinIO khi chạy nội bộ)
   └── SSE (sự kiện thay đổi) ◀───┘   ├──▶ Hàng đợi job (pg-boss hoặc tương đương)
                                      │      ├─ crawl nguồn công khai · vnstock · đồng bộ HĐĐT/kế toán
                                      │      └─ chấm lại điểm · EWS · dự báo · thông báo
                                      ├──▶ Dịch vụ AI (OCR, trích xuất, gợi ý ESG, trợ lý)
                                      ├──▶ Email (SMTP) · nhà cung cấp chữ ký số/eKYC
                                      └──▶ Adapter đối tác: HĐĐT, kế toán
sim-bank/ (dịch vụ giả lập tổ chức tài chính) ──API /v1/partner + webhook──▶ server/
packages/domain/ — chấm điểm, ESG, khớp sản phẩm, dòng tiền, biểu phí; dùng chung cho server và web/
```

- **Chấm điểm chạy ở server.** `web/` chỉ hiển thị kết quả và phần giải thích do server trả về.
- **`sim-bank/` là tiến trình riêng**, chỉ nói chuyện với `server/` qua API đối tác và webhook như một ngân hàng bên ngoài. Không đọc CSDL của FCC.
- **Một backend, một CSDL.** Python chỉ dùng cho vnstock và OCR nếu chọn hướng `ocr_lab/`.
- **Triển khai:** `web/` có thể lên Vercel (Root Directory = `web`) và gọi API qua `NEXT_PUBLIC_API_URL`. `server/` và `sim-bank/` cần máy chạy tiến trình lâu dài (VPS, Railway, Fly.io) cùng PostgreSQL có sao lưu.

## 5. Gói việc

Mỗi gói việc chỉ xong khi đạt **Definition of Done** của SPEC v2.0 mục 16: có API/UI, migration, kiểm tra quyền và consent, audit, xử lý lỗi, test nghiệp vụ, log, tài liệu vận hành.

### WP0 — Dọn nền

- Chuyển `web-legacy/src/domain/` sang `packages/domain/` (npm workspaces). `server/`, `web-legacy/`, `web/` cùng import từ đây; bỏ đường dẫn `../../web-legacy/...` trong server.
- CI: chạy test server, test domain, lint, build `web/` cho mỗi PR.
- Sửa lỗi lint `BuyerConfirm.tsx:74`.
- Cấu hình theo môi trường: `dev` (phiên theo vai trò), `staging`, `production` (bắt buộc đăng nhập).

**Nghiệm thu:** server không còn import từ `web-legacy/`; CI xanh; `NODE_ENV=production` thì `/api/dev/session` trả 404.

### WP1 — Lưu trữ

- PostgreSQL với bảng chuẩn hóa theo SPEC v2.0 mục 12, ưu tiên: `organizations`, `users`, `memberships`, `receivables`, `invoices`, `documents`, `buyer_confirmations`, `consents`, `financing_products`, `product_versions`, `rfqs`, `rfq_responses`, `funding_applications`, `offers`, `settlement_events`, `early_payment_offers`, `collaterals`, `esg_*`, `credit_assessments`, `fees`, `journal_entries`, `audit_events`.
- Ràng buộc ở CSDL: unique khóa nghiệp vụ hóa đơn; unique partial index "một hồ sơ hoạt động mỗi khoản phải thu" và "một RFQ `OPEN` mỗi khoản phải thu".
- Tệp lưu ở object storage, CSDL chỉ giữ `object_key`, `sha256`, `mime`, `size`. URL tải có hạn ngắn. Mã hóa khi lưu (AES-256, theo hồ sơ dự án mục 3.3.a).
- Script chuyển dữ liệu từ SQLite hiện tại sang PostgreSQL.
- Sao lưu hằng ngày, có diễn tập khôi phục.

**Nghiệm thu:** 14 test end-to-end hiện có chạy xanh trên PostgreSQL; test đồng thời: hai yêu cầu chọn báo giá cùng lúc chỉ tạo một hồ sơ; khôi phục được bản sao lưu vào môi trường trống.

### WP2 — Danh tính, phân quyền, chữ ký số

- Đăng nhập email + mật khẩu (đã có) và tùy chọn OIDC cho nhân sự FCC dùng nội bộ.
- Nhiều người dùng mỗi tổ chức; vai trò theo SPEC v2.0 mục 2 (owner, operator, approver, analyst, product manager, FCC reviewer, operations, auditor).
- Mời thành viên qua email, thu hồi, quên mật khẩu.
- MFA (TOTP) cho owner, approver, analyst, reviewer, admin; xác thực lại cho hành động nhạy cảm: xác nhận nghĩa vụ, chấp thuận đề nghị, chọn báo giá, cấp quyền chia sẻ, phát hành điểm.
- **Chữ ký số khi chia sẻ dữ liệu và chấp thuận đề nghị** (hồ sơ dự án mục 6.3: chia sẻ khi "có sự đồng ý chủ động và xác thực bằng chữ ký số của đại diện doanh nghiệp"): adapter ký số từ xa của nhà cung cấp dịch vụ chứng thực chữ ký số; lưu tệp đã ký và chứng thư. Khi chưa có hợp đồng nhà cung cấp, dùng xác thực MFA + snapshot nội dung như đường thay thế, ghi rõ phương thức trong nhật ký.
- **eKYC người đại diện** khi tổ chức đăng ký (hồ sơ dự án mục 3.3.a): adapter nhà cung cấp eKYC; khi chưa có hợp đồng, FCC operations đối chiếu giấy tờ tải lên.
- Một người thuộc nhiều tổ chức, chuyển `active_org_id` trên topbar (thay bộ chuyển vai trò của bản demo).
- Khôi phục các bước FCC xác minh tổ chức tài chính và duyệt sản phẩm.

**Nghiệm thu:** test truy cập xuyên tổ chức bị chặn; operator không chấp thuận được báo giá; thu hồi thành viên có hiệu lực ngay với yêu cầu tiếp theo; hành động nhạy cảm không có MFA trả 401; mỗi lần chia sẻ dữ liệu có bằng chứng ký (chữ ký số hoặc MFA + snapshot) truy được từ nhật ký.

### WP3 — API v1, API đối tác, cập nhật tức thời

- API REST `/v1` theo SPEC v2.0 mục 13; OpenAPI là hợp đồng nguồn; sinh client TypeScript cho `web/`.
- Mọi POST tạo nghiệp vụ nhận `Idempotency-Key`; mã lỗi `409` (xung đột trạng thái/phiên bản), `422` (dữ liệu sai); phân trang bằng cursor.
- **API đối tác** `/v1/partner/*` cho tổ chức tài chính: đọc gói hồ sơ được chia sẻ, đăng/sửa sản phẩm, trả báo giá, ghi quyết định thẩm định, đề nghị, hạn mức; **webhook đến** cho sự kiện tiền (giải ngân, nhận thanh toán, tất toán, quá hạn) ký HMAC, có timestamp, event ID, chống replay (mở rộng từ webhook giải ngân đã có); **webhook đi** báo cho đối tác khi có RFQ mới, hồ sơ mới, bên mua xác nhận. Khóa tích hợp theo tổ chức và phạm vi quyền (`POST /v1/integration-keys`).
- Thay polling 4 giây bằng **SSE** `GET /v1/events`: server đẩy sự kiện "đối tượng X đã đổi", client tải lại phần liên quan.
- Giữ `/api/actions/:name` cho `web-legacy/` tới khi ngừng `web-legacy/`.

**Nghiệm thu:** OpenAPI kiểm tra tự động khớp với route; báo giá mới hiện bên nhà cung cấp trong ≤ 2 giây không cần tải lại; gọi lặp cùng `Idempotency-Key` hoặc cùng event ID trả cùng kết quả; webhook có timestamp quá hạn bị từ chối.

### WP4 — Nối `web/` với backend

Thay `src/lib/data.ts` bằng client API theo từng màn hình. Mỗi màn hình phải có trạng thái rỗng, đang tải, lỗi; không còn số liệu cố định; mốc ngày tính theo ngày thật. Thêm manifest và service worker để cài như ứng dụng trên điện thoại (PWA).

| Màn hình (`web/`) | Dữ liệu cần | API chính |
| --- | --- | --- |
| `/supplier` Tổng quan | Vốn lưu động, cảnh báo, dự báo 7/30 ngày, việc cần làm, AI đề xuất hóa đơn nên tài trợ | `GET /v1/dashboard`, `GET /v1/cashflow-forecasts/latest` |
| `/supplier/invoices`, `/upload` | Danh sách, vòng đời, chi tiết, tải lên + OCR, kết quả xác thực với cơ quan thuế | `GET/POST /v1/receivables`, `POST /v1/receivables/{id}/documents`, `POST /v1/receivables/{id}/validate` |
| `/supplier/funding` | Hồ sơ, 5C, tài sản bảo đảm, phân loại (i)/(ii)/(iii), ước tính hạn mức | `GET /v1/credit-assessments/{id}`, `GET /v1/receivables/{id}/application-score`, `/v1/collaterals` |
| `/supplier/marketplace` | Gói phù hợp/chưa phù hợp, chi phí, RFQ, đồng ý chia sẻ (ký số) | `GET /v1/receivables/{id}/matches`, `POST /v1/rfqs`, `POST /v1/consents` |
| `/supplier/disbursement` | Vòng tuần hoàn giải ngân – thu hồi, các lớp bảo vệ, cảnh báo sớm | `GET /v1/funding-applications/{id}`, `settlement_events`, `GET /v1/ews-alerts` |
| `/buyer`, `/buyer/invoices` | Phải trả, lịch thanh toán, xác nhận/tranh chấp, trả sớm | `POST /v1/receivables/{id}/buyer-decision`, `POST /v1/early-payment-offers` |
| `/buyer/marketplace` | Chương trình tài trợ cho nhà cung cấp của mình | `GET /v1/financing-products?anchor=` |
| `/buyer/esg` | ESG chuỗi cung ứng (nhà cung cấp đã đồng ý) | `GET /v1/buyers/{id}/supply-chain-esg` |
| `/lender`, `/lender/appraisal` | Danh mục, hàng đợi thẩm định, quyết định | `GET /v1/funding-applications`, `POST .../offers`, `POST .../reject` |
| `/lender/monitoring` | Cảnh báo sớm, lịch thu hồi | `GET /v1/ews-alerts` |
| `/lender/marketplace` | Sản phẩm của mình, mặt bằng lãi suất, chính sách ưu đãi ESG | `GET/POST /v1/financing-products`, `GET /v1/market-overview` |
| `/{vai-trò}/esg` | 18 chỉ tiêu, bằng chứng, mô phỏng | `/v1/esg-assessments/*` |
| `/{vai-trò}/accounting` | Công nợ, CCC, bút toán chờ duyệt, nhập/xuất file | `POST /v1/accounting-imports`, `/v1/journal-entries` |
| `/{vai-trò}/settings` | Tổ chức, thành viên, chia sẻ dữ liệu, kết nối, nhật ký | `/v1/organizations/*`, `/v1/consents`, `/v1/connections`, `GET /v1/audit-events` |
| `/admin` | KPI nền tảng, doanh thu 6 nguồn, người dùng, RBAC, bảo mật & gian lận | `GET /v1/operations/*`, `GET /v1/operations/revenue` |

Các nút hiện chỉ hiện thông báo phải được làm thật:

| Nút | Xử lý |
| --- | --- |
| Xuất Excel hóa đơn, xuất BCTC, xuất nhật ký truy cập | Xuất CSV/XLSX phía server |
| Tạo báo cáo danh mục / báo cáo vận hành | PDF hoặc XLSX từ dữ liệu thật |
| Mời thành viên, mời nhà cung cấp chia sẻ ESG | WP2, WP11 |
| Tạo API key cho đối tác | WP3 |
| Tải mẫu file nhập liệu | File mẫu tĩnh |
| Đồng bộ ERP, ủy quyền nguồn dữ liệu kế toán | WP9: chạy connector nếu đã kết nối; chưa kết nối thì mở hướng dẫn kết nối hoặc nhập file |
| Liên kết tài khoản ngân hàng | WP14: liên kết với tài khoản tại ngân hàng giả lập, lấy sao kê |
| Tạo gói tài trợ | WP8 (tổ chức tài chính hoặc ngân hàng giả lập đăng) |
| Thêm tài sản bảo đảm | WP8 |
| Mở hợp đồng tài trợ | WP8: tệp hợp đồng do tổ chức tài chính phát hành, lưu kèm chữ ký |

**Nghiệm thu:** tìm trong `web/src` không còn import `lib/data`; chạy trọn luồng mục 7 chỉ bằng `web/`; mỗi chỉ số trên Tổng quan có chú thích công thức/nguồn (F24); cài được lên điện thoại Android và iOS từ trình duyệt.

### WP5 — Hóa đơn, chứng từ, chống gian lận

- Tải lên XML, PDF, ảnh; lưu bản gốc bất biến + SHA-256 (WP1); quét mã độc; giới hạn loại và kích thước.
- Trích xuất: XML theo TT78 (đã có); ảnh/PDF qua OCR. **Chọn một hướng OCR** (mục 6): AI qua Ollama (đang dùng) hoặc RapidOCR + VietOCR (`ocr_lab/`). Lưu bảng `extractions`: giá trị AI, trang, độ tin cậy, giá trị người xác nhận. Trường độ tin cậy thấp bắt buộc xác nhận.
- **Đồng bộ hóa đơn điện tử** (hồ sơ dự án mục 6.3: VNPT, Viettel, BKAV): adapter theo API của từng nhà cung cấp, chạy khi doanh nghiệp cấp quyền tài khoản của họ. Khi chưa có quyền truy cập API, doanh nghiệp tải XML tay (đã có).
- **Xác thực hóa đơn với cơ quan thuế:** tra cứu hóa đơn trên cổng hóa đơn điện tử của cơ quan thuế theo mã tra cứu/ký hiệu/số. Phân loại nguồn theo WP10-B bước 1; nếu cổng có CAPTCHA thì là tra cứu thủ công có hỗ trợ (hệ thống mở sẵn thông tin tra cứu, người kiểm tra ghi kết quả và ảnh chụp). Trạng thái hóa đơn: chưa xác thực / đã xác thực / không khớp / đã hủy.
- Hóa đơn điều chỉnh/thay thế/hủy (mẫu `inv02_fpt_dieuchinh` trong `ocr_lab/`): liên kết với hóa đơn gốc, tăng `version` khoản phải thu, buộc bên mua xác nhận lại nếu số tiền hoặc hạn đổi.
- **Phát hiện gian lận theo luật** (hồ sơ dự án mục 3.3.a): trùng lặp (đã có), hóa đơn đã hủy, giá trị bất thường so với lịch sử cặp mua–bán, nhiều hóa đơn sát ngưỡng sản phẩm, bên mua mới không có lịch sử, chứng từ bị sửa (hash khác bản đã nộp). Mỗi cờ có lý do; hồ sơ có cờ vào hàng đợi FCC operations, không tự từ chối.

**Nghiệm thu:** đo độ chính xác trích xuất trên 10 hóa đơn trong `ocr_lab/invoices` so với `ocr_lab/expected_output`, đạt ngưỡng chốt ở mục 6; sửa hóa đơn sau khi bên mua xác nhận thì xác nhận cũ mất hiệu lực; mỗi luật gian lận có ca kiểm thử dương tính và âm tính.

### WP6 — Chấm điểm tín dụng

- Chạy bộ chấm điểm ở server từ `packages/domain/`; lưu `credit_assessments` và `credit_factor_results` bất biến, kèm `input_hash`; chấm lại tạo bản ghi mới.
- Đầu vào theo hồ sơ dự án mục 6.3: sức khỏe tài chính, chất lượng hóa đơn, lịch sử thanh toán của bên mua trên FCC, độ ổn định dòng tiền (sao kê từ WP14, công nợ từ WP9), nghĩa vụ thuế và báo cáo CIC do doanh nghiệp tự cung cấp (AI trích xuất, người xác nhận), tài sản bảo đảm (WP8).
- `scorecard_versions` lưu tham số (bảng rủi ro ngành, trung vị biên lợi nhuận, ngưỡng hạng, bảng ngành giai đoạn 2); đổi phiên bản cần hai người duyệt.
- Phát hành chính thức khi Coverage đạt ngưỡng; dưới ngưỡng thì "tạm tính" kèm khoảng điểm.
- Yêu cầu xem xét lại (appeal): doanh nghiệp gửi lý do + bằng chứng, reviewer xử lý, có nhật ký.
- Lưu bộ dữ liệu ẩn danh của mỗi hồ sơ đã tất toán (đặc trưng đầu vào + kết quả trả nợ) để tái huấn luyện về sau.
- Hiệu chỉnh tham số với chuyên gia tín dụng (cố vấn dự án) vì chưa có đối tác thật: bộ ≥ 20 ca tính tay làm test hồi quy.

**Nghiệm thu:** cùng đầu vào cho cùng kết quả và cùng `input_hash`; bộ ca tính tay xanh; điểm đã phát hành không sửa được qua API; bộ dữ liệu ẩn danh không chứa MST, tên, số hóa đơn.

### WP7 — ESG

- Bằng chứng lưu ở object storage; loại tài liệu ngoài 12 tháng.
- AI đề xuất mức 0–4 cho 18 chỉ tiêu, mỗi đề xuất có trích dẫn (tài liệu, trang); không có trích dẫn thì không đề xuất mức ≥ 2.
- Reviewer FCC xác nhận/sửa; sửa khác AI bắt buộc ghi lý do; phát hành chính thức khi Coverage ≥ 80% và xử lý hết cờ trọng yếu.
- Xác minh chứng chỉ (ví dụ ISO 14001) theo số chứng chỉ và tổ chức cấp; nguồn tra cứu xếp loại theo WP10-B.
- ESG chuỗi cung ứng cho bên mua: chỉ gồm nhà cung cấp đã đồng ý chia sẻ; công thức theo SPEC v2.0 mục 5.5.
- Ưu đãi xanh: chỉ áp khi tổ chức tài chính (hoặc ngân hàng giả lập) cấu hình trong sản phẩm. Mức giảm 0,3–0,5% trong hồ sơ dự án là cấu hình mặc định của ngân hàng giả lập, không phải cam kết của FCC.

**Nghiệm thu:** test 66,67 hiện có vẫn xanh khi chạy ở server; không phát hành được khi Coverage < 80%; bên mua không thấy ESG của nhà cung cấp chưa đồng ý.

### WP8 — Marketplace, tài trợ, thu hồi, theo dõi

- Phiên bản sản phẩm (`product_versions`); báo giá tham chiếu đúng phiên bản; sửa sản phẩm cần FCC duyệt lại; hết hiệu lực tự ẩn. Loại sản phẩm: bao thanh toán có/không truy đòi, tài trợ người mua (reverse factoring), tài trợ đơn hàng, bảo lãnh, LC (hồ sơ dự án mục 1.2).
- Màn hình cấp quyền chia sẻ: doanh nghiệp chọn bên nhận, mục đích, loại dữ liệu, thời hạn; ký theo WP2; thu hồi có hiệu lực ngay.
- **Tài sản bảo đảm** (hồ sơ dự án mục 3.3.b, bước 2): doanh nghiệp khai bất động sản, máy móc, phương tiện, hàng tồn kho kèm giấy tờ; FCC kiểm tra hồ sơ đủ/thiếu và **định giá sơ bộ tham khảo** theo phương pháp công khai (giá trị khai báo có chứng từ, khấu hao theo loại tài sản và tuổi, hệ số chiết khấu theo loại), ghi rõ "không phải định giá có giá trị pháp lý". Tổ chức tài chính quyết định giá trị được công nhận.
- **Phân loại (i)/(ii)/(iii)** tính ở server: (i) có tài sản bảo đảm và khoản phải thu tốt; (ii) không tài sản bảo đảm nhưng khoản phải thu chất lượng, bên mua uy tín, dòng tiền tốt; (iii) không đủ điều kiện — FCC không gợi ý sản phẩm. Ngưỡng nằm trong `scorecard_versions`.
- Giải ngân: tổ chức tài chính ghi nhận bằng nút hoặc webhook, kèm số hợp đồng và tệp hợp đồng.
- **Thu hồi theo các lớp** (hồ sơ dự án mục 3.3.b): lớp 1 — bên mua thanh toán, ngân hàng ghi nhận tiền về, trừ gốc và phí/lãi, **hoàn phần còn lại cho nhà cung cấp**; hỗ trợ thanh toán một phần; lớp 2 — thiếu hụt thì ngân hàng ghi nhận xử lý tài sản bảo đảm, FCC cung cấp hồ sơ tài sản; lớp 3–4 — quá hạn sinh cảnh báo, ngân hàng ghi nhận biện pháp. FCC không trực tiếp thu giữ hay bán tài sản.
- Bên mua ghi nhận thanh toán kèm chứng từ; đối chiếu với sự kiện tiền về từ ngân hàng (WP14). Lệch nhau vào hàng đợi đối soát.
- Hạn mức (`credit_limits`): chỉ do tổ chức tài chính cấp.
- **Cảnh báo sớm (EWS)** theo luật: khoản sắp đến hạn/quá hạn, điểm bên mua giảm, doanh thu suy giảm, thanh toán chậm dần, tập trung rủi ro vào một bên mua, tranh chấp mới, cờ dữ liệu công khai mới. Hiện ở `/lender/monitoring` và `/supplier/disbursement`.
- Gian lận sau giải ngân: một khoản phải thu bị đem tài trợ lại, bên mua thanh toán thẳng cho nhà cung cấp mà không báo.

**Nghiệm thu:** trọn vòng tuần hoàn của hồ sơ dự án (ví dụ hóa đơn 2 tỷ, 90 ngày, ứng 80% = 1,6 tỷ) từ tạo hóa đơn tới tất toán, kể cả thanh toán hai lần và hoàn phần còn lại; nhánh thiếu hụt có xử lý tài sản bảo đảm; số dư khoản tài trợ khớp tổng sự kiện; quá hạn sinh cảnh báo trong ≤ 1 phút.

### WP9 — Kế toán, bút toán, dòng tiền

- Nhập công nợ CSV/XLSX theo file mẫu (đã có CSV); nhập số dư đầu kỳ và chi định kỳ (đã có).
- Connector chỉ đọc cho phần mềm kế toán (hồ sơ dự án mục 6.3: MISA, Fast, Bravo, SAP), ưu tiên theo khảo sát doanh nghiệp; mỗi connector chạy khi có tài khoản đối tác (MISA AMIS cần `app_id`). Trước đó dùng nhập file.
- **Bút toán** (màn hình `JournalQueue` trong `web/`): khi giải ngân, nhận thanh toán, tất toán, trả phí, hệ thống sinh bút toán đề xuất theo chế độ kế toán áp dụng (TT133 hoặc TT200, cấu hình theo doanh nghiệp), có độ tin cậy; kế toán duyệt từng dòng; xuất file nhập được vào phần mềm kế toán đã kết nối.
- Dự báo 7/30/90 ngày, ba kịch bản; dùng sao kê (WP14) khi doanh nghiệp đã liên kết; lưu dự báo để so với thực tế và hiển thị sai số.
- Cảnh báo thiếu hụt dòng tiền dẫn tới Marketplace.

**Nghiệm thu:** nhập lại cùng file không tạo trùng; mỗi sự kiện tiền sinh đúng cặp bút toán Nợ/Có trên bộ ca kiểm thử; sai số dự báo hiển thị khi đã qua kỳ dự báo.

### WP10 — Dữ liệu bên ngoài

**A. Bên mua đầu chuỗi niêm yết (vnstock)**

- Interface `MarketDataProvider`; adapter đầu tiên là vnstock (dùng lại logic của `scripts/fetch_listed.py`, gồm kiểm tra thứ tự năm và nguồn VCI).
- Job định kỳ theo SPEC v2.0 mục 9.1: giá hằng ngày; BCTC hằng tuần, hằng ngày trong mùa công bố; có kỳ BCTC mới thì tự chấm lại điểm bên mua.
- Ánh xạ MST ↔ mã chứng khoán xác minh tay lần đầu (`listed_companies.verified_by`).
- Ý kiến kiểm toán, diện cảnh báo: lấy từ nguồn công bố thông tin của Sở giao dịch chứng khoán (khảo sát ở WP10-B; loại B thì FCC operations nhập tay có nguồn và ngày).
- **Giấy phép:** chốt giấy phép vnstock cho mục đích thương mại trước production. Nếu không được, thay adapter bằng nguồn công bố thông tin của Sở giao dịch (BCTC PDF + trích xuất như WP5), không đổi bộ chấm điểm.

**B. Crawl nguồn công khai cho doanh nghiệp (F27)**

*Bước 1 — khảo sát kỹ thuật và pháp lý từng nguồn (làm trước, chạy song song với M1).* Với mỗi nguồn ứng viên, ghi vào `data_sources`: truy cập có cần đăng nhập không, có CAPTCHA không, `robots.txt`, điều khoản sử dụng, định dạng (HTML, JSON, tệp), dữ liệu cá nhân liên quan, tần suất cho phép. Kết quả xếp mỗi nguồn vào một loại:

- **Loại A — crawl tự động:** công khai, không CAPTCHA/đăng nhập, điều khoản không cấm.
- **Loại B — tra cứu thủ công có hỗ trợ:** có CAPTCHA, đăng nhập hoặc điều khoản không cho tự động. Hệ thống mở sẵn đường dẫn tra cứu theo MST; nhân sự FCC nhập kết quả kèm URL và ảnh chụp làm bằng chứng.
- **Loại C — bỏ:** điều khoản cấm khai thác hoặc dữ liệu không đủ tin cậy.

Nguồn ứng viên (theo SPEC v2.0 mục 9.2 và hồ sơ dự án mục 6.3). Loại A/B/C chỉ chốt sau khảo sát:

| Nguồn | Dữ liệu hiển thị | Hiển thị ở |
| --- | --- | --- |
| Cổng thông tin quốc gia về đăng ký doanh nghiệp | Tình trạng pháp lý, ngày thành lập, ngành nghề, địa chỉ, người đại diện | Hồ sơ tổ chức; gợi ý điền khi đăng ký |
| Tra cứu người nộp thuế của cơ quan thuế | Trạng thái MST (đang hoạt động, ngừng, không còn ở địa chỉ đăng ký) | Hồ sơ tổ chức; cảnh báo cho bên mua và tổ chức tài chính |
| Cổng hóa đơn điện tử của cơ quan thuế | Trạng thái hóa đơn theo mã tra cứu | Xác thực hóa đơn (WP5) |
| Danh sách công khai người nộp thuế nợ thuế, vi phạm (cơ quan thuế các cấp) | Có tên trong danh sách, kỳ công bố | Mục "Dữ liệu công khai" |
| Danh sách đơn vị nợ BHXH do BHXH các tỉnh công bố | Có tên, kỳ công bố | Mục "Dữ liệu công khai"; gợi ý bằng chứng ESG nhóm S |
| Hệ thống mạng đấu thầu quốc gia | Gói thầu đã tham gia/trúng, giá trị, bên mời thầu | Năng lực thực hiện hợp đồng |
| Cổng công bố bản án, quyết định của tòa án | Bản án kinh doanh thương mại, phá sản có liên quan | Mục "Dữ liệu công khai", cờ cần xem xét |
| Thông báo xử phạt môi trường, lao động | Quyết định xử phạt | Gợi ý cho reviewer ESG (E5, S1, S2) |
| Tra cứu chứng chỉ hệ thống quản lý (ISO 14001…) của tổ chức chứng nhận | Hiệu lực chứng chỉ | Xác minh bằng chứng ESG (WP7) |
| Công bố thông tin của Sở giao dịch chứng khoán | BCTC, ý kiến kiểm toán, diện cảnh báo của bên mua niêm yết | WP10-A |
| Website doanh nghiệp, báo chí | Chứng nhận, sự kiện, tin bất lợi | Gợi ý bằng chứng ESG; tin cho reviewer |

*Bước 2 — khung crawler.*

- Mỗi nguồn là một adapter: `fetch(taxCode)` → nội dung thô, `parse(raw)` → bản ghi chuẩn hóa. Thêm nguồn mới không sửa phần còn lại.
- Chạy trên hàng đợi job; giới hạn tần suất theo từng nguồn; user-agent định danh có địa chỉ liên hệ; cache; tôn trọng `robots.txt` và thời gian chờ.
- **Chỉ crawl theo MST cần tra cứu**, không quét toàn bộ nguồn. Kích hoạt khi: tổ chức đăng ký hoặc cập nhật MST; nhà cung cấp gửi RFQ; FCC operations bấm làm mới; làm mới định kỳ (mặc định 30 ngày, cấu hình theo nguồn).
- Phát hiện CAPTCHA, trang đăng nhập hoặc mã chặn thì **dừng ngay**, đánh dấu nguồn và tạo việc tra cứu thủ công. Không thử vượt.
- Lưu `source_snapshots`: URL, thời điểm, hash nội dung, phiên bản parser, nội dung thô ở object storage. Parser lỗi (nguồn đổi định dạng) thì đưa vào hàng đợi ngoại lệ, không ghi dữ liệu.
- Khớp thực thể theo MST; khớp theo tên/địa chỉ chỉ là gợi ý và cần người xác nhận.
- Dữ liệu cá nhân (tên người đại diện…) chỉ lưu trường cần cho mục đích đã đăng ký trong `data_sources`.

*Bước 3 — hiển thị và khiếu nại.*

- Mục **"Dữ liệu công khai"** trong hồ sơ doanh nghiệp, hiện ở: trang tổ chức của chính doanh nghiệp, `/supplier/funding`, `/lender/appraisal` (khi có quyền chia sẻ), trang nhà cung cấp phía bên mua. Mỗi dòng có: giá trị, tên nguồn, liên kết gốc, ngày lấy, nhãn "Nguồn công khai – tham khảo".
- Doanh nghiệp xem được mọi dữ liệu công khai về mình và gửi khiếu nại sai lệch kèm bằng chứng. Dòng đang khiếu nại hiện nhãn "Đang được xem xét"; FCC operations xử lý và ghi nhật ký.
- Phase này **chỉ hiển thị** (riêng trạng thái hóa đơn và chứng chỉ ESG dùng cho xác thực ở WP5, WP7). Đưa dữ liệu crawl vào điểm tín dụng hoặc cờ knock-out cần: nguồn chạy ổn định, quy trình khiếu nại đã vận hành, và một phiên bản bộ chấm điểm mới được duyệt theo WP6.

**Nghiệm thu:**

- Điểm bên mua niêm yết ghi rõ nguồn và kỳ BCTC; nguồn lỗi thì giữ dữ liệu cũ, gắn nhãn "dữ liệu cũ"; đổi adapter không đổi kết quả chấm trên cùng số liệu.
- Có biên bản khảo sát cho mọi nguồn ứng viên; mỗi nguồn được xếp loại A/B/C và có người phê duyệt.
- Nguồn chưa `approved` không chạy được (có test).
- Gặp CAPTCHA hoặc đăng nhập: job dừng và tạo việc tra cứu thủ công (có test với trang có CAPTCHA dựng sẵn).
- Mỗi bản ghi truy được về snapshot (URL, thời điểm, hash, phiên bản parser).
- Parser lỗi không ghi dữ liệu sai và sinh ngoại lệ.
- Khiếu nại của doanh nghiệp đổi được trạng thái hiển thị và có nhật ký.

### WP11 — Thông báo

- Email qua SMTP cho: mời thành viên, bên mua cần xác nhận, báo giá mới, đề nghị chờ chấp thuận, giải ngân, quá hạn, cảnh báo sớm.
- Hàng đợi thử lại; người dùng chọn loại thông báo nhận.

**Nghiệm thu:** máy chủ email lỗi tạm thời thì thư được gửi lại; không gửi trùng.

### WP12 — Quản trị, vận hành, bảo mật

- `/admin`: KPI thật (người dùng, hóa đơn, giá trị tài trợ, tỷ lệ phê duyệt, thời gian từng bước, tỷ lệ tranh chấp); người dùng và ma trận quyền; xác minh tổ chức; duyệt sản phẩm; hàng đợi ngoại lệ, đối soát, gian lận.
- **Nhật ký chống sửa:** `audit_events` chỉ thêm; mỗi sự kiện chứa hash của sự kiện trước (chuỗi băm); công cụ kiểm tra toàn vẹn chạy hằng ngày và theo yêu cầu; neo hash cuối ngày vào nơi lưu độc lập (email tới hộp thư kiểm toán hoặc bucket khóa ghi).
- Xuất nhật ký kiểm toán theo khoảng thời gian (`GET /v1/audit-events`).
- HTTPS (TLS), rate limit, khóa bí mật trong biến môi trường/secret manager, log có `correlation_id`, cảnh báo lỗi job và webhook.
- **AI và dữ liệu:** Ollama đang gọi dịch vụ ngoài (`ollama.com`). Trước pilot cần quyết định tự vận hành mô hình hay giữ dịch vụ ngoài, theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (SPEC v2.0 mục 15.4).

**Nghiệm thu:** tài khoản auditor chỉ đọc; mọi lần auditor truy cập được ghi log; sửa trực tiếp một dòng nhật ký trong CSDL thì công cụ kiểm tra báo đúng vị trí; khôi phục sao lưu trong ≤ 4 giờ.

### WP13 — Trợ lý FCC

- Chuyển từ luật cứng sang mô hình AI **chỉ diễn giải** số liệu và reason code server trả về; không tự suy ra số; mỗi câu trả lời dẫn tới màn hình nguồn. Có mặt ở mọi màn hình, theo vai trò (hồ sơ dự án mục 3.3.3: chatbot AI 24/7).
- Gợi ý cá nhân hóa: hóa đơn nên tài trợ, sản phẩm phù hợp, cảnh báo dòng tiền — đều từ dữ liệu và công thức của server.

**Nghiệm thu:** bộ câu hỏi mẫu theo vai trò; câu trả lời có số liệu khớp API; câu hỏi ngoài phạm vi được từ chối.

### WP14 — Ngân hàng giả lập (`sim-bank/`)

Thay cho đối tác tài chính thật trong phase này. Mục tiêu là mọi luồng có phía ngân hàng chạy được đầu–cuối mà không cần người thao tác thay ngân hàng, và đi qua đúng bề mặt tích hợp mà ngân hàng thật sẽ dùng.

- **Danh tính:** 3 tổ chức tài chính hư cấu (một ngân hàng thương mại, một công ty tài chính, một quỹ). **Không dùng tên ngân hàng thật** để tránh hiển thị như sản phẩm hay quyết định của một tổ chức có thật. Mỗi tổ chức là một `organization` loại `lender`, có cờ `simulated = true` trong danh mục nguồn dữ liệu, dùng khóa tích hợp như đối tác thật.
- **Sản phẩm:** đăng qua `/v1/partner/*` đủ các loại ở WP8, có biểu giá, điều kiện, SLA, ưu đãi xanh (mặc định giảm 0,3–0,5% theo hồ sơ dự án); qua FCC duyệt như sản phẩm thật.
- **Hành vi theo luật cấu hình:** nhận RFQ → báo giá theo hạng điểm, kỳ hạn, phân loại (i)/(ii)/(iii); thẩm định → duyệt/từ chối/yêu cầu bổ sung; cấp hạn mức; ra đề nghị; giải ngân sau T+1/T+2 (đồng hồ cấu hình được); nhận tiền bên mua; trừ gốc + phí/lãi, hoàn phần còn lại; quá hạn; xử lý tài sản bảo đảm.
- **Tài khoản và sao kê:** doanh nghiệp "liên kết tài khoản" với ngân hàng giả lập; sao kê sinh từ các sự kiện tiền đã ghi nhận trên FCC (giải ngân, thanh toán, phí) cộng số dư đầu kỳ và chi định kỳ doanh nghiệp tự khai — **không sinh giao dịch ngẫu nhiên**. Sao kê ghi nguồn "Ngân hàng giả lập" để tách khỏi dữ liệu thật khi có ngân hàng thật.
- **Thu phí của FCC:** nhận lệnh thu phí (WP15) và trả sự kiện đã thu.
- **Bảng điều khiển kịch bản** cho FCC operations và kiểm thử: chọn hành vi cho từng hồ sơ (duyệt, từ chối, trễ giải ngân, bên mua trả một phần, trả chậm, vỡ nợ → xử lý tài sản bảo đảm), gửi lại webhook trùng, gửi webhook sai chữ ký.
- Người thật vẫn thao tác được vai tổ chức tài chính qua `/lender` trên `web/`; dịch vụ giả lập chỉ tự động hóa khi bật cho tổ chức đó.

**Nghiệm thu:** chạy tự động trọn vòng tuần hoàn của WP8 với cả ba tổ chức giả lập, gồm các nhánh lỗi trong bảng điều khiển; webhook trùng không ghi nhận hai lần, webhook sai chữ ký bị từ chối; thay một tổ chức giả lập bằng một tổ chức do người thao tác qua `/lender` không cần sửa code; sao kê khớp tổng sự kiện tiền trên FCC.

### WP15 — Phí và doanh thu

Theo 6 nguồn thu trong hồ sơ dự án (mục 3.3.5): phí giao dịch tài trợ hóa đơn, phí SaaS, phí chấm điểm tín dụng, phí kết nối API, phí báo cáo và phân tích, hoa hồng giới thiệu sản phẩm tài chính.

- Biểu phí có phiên bản (`fee_schedules`), cấu hình theo gói và theo đối tượng (doanh nghiệp hoặc tổ chức tài chính); hiển thị công khai cho người dùng trước khi phát sinh.
- Phát sinh phí từ sự kiện: giải ngân (phí giao dịch, hoa hồng), phát hành điểm chính thức, gọi API đối tác, xuất báo cáo; phí SaaS theo kỳ.
- Hóa đơn phí cho khách hàng (xuất PDF); thu phí qua ngân hàng giả lập (WP14); sinh bút toán phía khách hàng (WP9).
- Dashboard doanh thu 6 nguồn ở `/admin`.

**Nghiệm thu:** mỗi khoản phí truy được về sự kiện phát sinh và phiên bản biểu phí; đổi biểu phí không đổi phí đã phát sinh; tổng doanh thu trên dashboard khớp tổng các khoản phí.

## 6. Quyết định cần chốt

| # | Câu hỏi | Ảnh hưởng | Đề xuất mặc định |
| --- | --- | --- | --- |
| 1 | OCR hóa đơn: Ollama (AI) hay RapidOCR + VietOCR (`ocr_lab/`)? Ngưỡng chính xác? | WP5 | Chạy cả hai trên 10 hóa đơn mẫu, chọn theo độ chính xác và nơi xử lý dữ liệu |
| 2 | Đăng nhập: email/mật khẩu hay OIDC? | WP2 | Email/mật khẩu + TOTP cho doanh nghiệp; OIDC cho nhân sự FCC |
| 3 | Hạ tầng: VPS hay dịch vụ quản lý; vị trí lưu dữ liệu | WP1, WP12 | PostgreSQL có sao lưu tự động, máy chủ đặt tại Việt Nam nếu pháp chế yêu cầu |
| 4 | Mô hình AI tự vận hành hay dịch vụ ngoài | WP5, WP7, WP13 | Cần ý kiến pháp chế trước pilot |
| 5 | Ai hiệu chỉnh tham số chấm điểm khi chưa có ngân hàng thật | WP6, WP14 | Chuyên gia tín dụng trong ban cố vấn; dùng chung tham số cho hành vi ngân hàng giả lập |
| 6 | Ai phê duyệt từng nguồn crawl; thời gian lưu snapshot thô | WP10 | FCC operations + pháp chế phê duyệt; lưu snapshot 24 tháng |
| 7 | Nhà cung cấp hóa đơn điện tử, phần mềm kế toán làm trước | WP5, WP9 | Theo khảo sát doanh nghiệp pilot; trong lúc chờ tài khoản đối tác dùng nhập file |
| 8 | Nhà cung cấp chữ ký số từ xa và eKYC | WP2 | Chọn một nhà cung cấp có API ký từ xa; trong lúc chờ dùng MFA + snapshot |
| 9 | Giấy phép vnstock cho mục đích thương mại | WP10-A | Hỏi đơn vị phát triển vnstock trước staging; song song khảo sát nguồn công bố thông tin |
| 10 | Biểu phí ban đầu (mức từng nguồn thu) | WP15 | Nhóm kinh doanh chốt; hệ thống chạy được với biểu phí 0 đồng |
| 11 | Nhà cung cấp email | WP11 | SMTP của tên miền công ty |

## 7. Lộ trình

Ước lượng là tuần-người cho một lập trình viên full-stack quen code hiện tại, chưa tính chờ đối tác và pháp chế. Chỉ dùng để sắp thứ tự, không phải cam kết.

| Mốc | Gói việc | Ước lượng | Kết quả có thể demo |
| --- | --- | --- | --- |
| M1 — Nền | WP0, WP1, WP2 (trừ chữ ký số, eKYC); khảo sát nguồn (WP10-B bước 1) | 6–8 tuần | Đăng nhập thật, nhiều người dùng, dữ liệu trên PostgreSQL, tệp có SHA-256; biên bản phân loại nguồn A/B/C |
| M2 — API, ngân hàng giả lập, giao diện | WP3, WP14, WP4 (luồng hóa đơn → RFQ → hồ sơ → giải ngân) | 7–9 tuần | Trọn luồng tài trợ chạy trên `web/` với ngân hàng giả lập tự báo giá, giải ngân; cập nhật tức thời |
| M3 — Chấm điểm và ESG | WP6, WP7, WP10-A, WP4 (màn hình liên quan) | 6–8 tuần | Điểm chạy ở server, phát hành chính thức, xem xét lại, ESG có trích dẫn; điểm bên mua niêm yết cập nhật định kỳ |
| M4 — Hóa đơn, thu hồi, dữ liệu công khai | WP5, WP8, WP10-B (bước 2–3), WP11 | 8–11 tuần | Xác thực hóa đơn, gian lận, tài sản bảo đảm, các lớp thu hồi, EWS, email; mục "Dữ liệu công khai" |
| M5 — Kế toán, doanh thu, vận hành | WP9, WP15, WP12, WP13, WP2 (chữ ký số, eKYC); ngừng `web-legacy/` | 6–8 tuần | Bút toán, dự báo có sao kê, doanh thu 6 nguồn, nhật ký chống sửa, trợ lý AI; sẵn sàng UAT |

**Luồng nghiệm thu cuối phase (chạy hoàn toàn trên `web/`, môi trường `staging`):**
1. Ba tổ chức tài chính giả lập đăng sản phẩm qua API đối tác; FCC duyệt.
2. Nhà cung cấp đăng ký (eKYC hoặc đối chiếu giấy tờ), mời thành viên; operator tải hóa đơn ảnh, owner xác nhận trường OCR; hóa đơn được xác thực với cơ quan thuế.
3. Bên mua (approver, có MFA) xác nhận nghĩa vụ.
4. Nhà cung cấp khai tài sản bảo đảm, xem phân loại và định giá sơ bộ; ký chia sẻ dữ liệu; gửi RFQ tới 3 sản phẩm; ngân hàng giả lập báo giá; chọn một, quyền của bên còn lại bị thu hồi.
5. Ngân hàng giả lập thẩm định, cấp hạn mức, ra đề nghị; nhà cung cấp chấp thuận (ký); giải ngân T+1 qua webhook; phí giao dịch phát sinh; bút toán đề xuất hiện ở trang Kế toán.
6. Bên mua thanh toán hai lần; ngân hàng giả lập ghi nhận tiền về, trừ gốc và phí, hoàn phần còn lại; khoản được tất toán. Chạy lại với kịch bản vỡ nợ: EWS cảnh báo, ngân hàng giả lập xử lý tài sản bảo đảm.
7. Tổ chức tài chính xem mục "Dữ liệu công khai" của nhà cung cấp; nhà cung cấp khiếu nại một dòng và dòng đó chuyển sang "Đang được xem xét".
8. Trong suốt luồng: điểm tín dụng và ESG đã phát hành không đổi; công cụ kiểm tra nhật ký báo toàn vẹn; Tổng quan ba vai trò và dashboard doanh thu khớp dữ liệu.
