# FCC — đặc tả triển khai MVP vận hành thật

**Phiên bản:** 1.0 · **Ngày:** 09/10/2026 · **Trạng thái:** Bản để thiết kế, ước lượng và triển khai thử nghiệm có kiểm soát

## 1. Mục tiêu và ranh giới

FCC giúp nhà cung cấp SME biến một khoản phải thu B2B đã được bên mua xác nhận thành **hồ sơ đề nghị tài trợ** gửi tới tổ chức tài chính đối tác. FCC quản lý chứng từ, quyền chia sẻ, trạng thái hồ sơ và đối soát kết quả. **Tổ chức tài chính tự thẩm định, ra quyết định, ký thỏa thuận tài trợ, giải ngân và thu hồi theo hợp đồng của mình.** FCC không giữ tiền, tự cho vay, tự hứa hạn mức/lãi suất hoặc tự phê duyệt tín dụng.

MVP chỉ hỗ trợ doanh nghiệp Việt Nam, giao dịch VND, hóa đơn điện tử B2B, một khoản phải thu được gửi tới **một đối tác tài trợ tại một thời điểm**. Bắt đầu bằng một ngành và 1–2 bên mua đầu chuỗi đã đồng ý tham gia pilot. Không triển khai marketplace mở, điểm tín dụng AI tự động, ưu đãi ESG, blockchain, LC, bảo hiểm, kế toán tổng hợp hoặc tích hợp mọi ERP trong MVP.

### Kết quả cần chứng minh

1. Nhà cung cấp tạo được hồ sơ từ hóa đơn và chứng từ; bên mua xác nhận hoặc nêu tranh chấp; đối tác tài trợ nhận đủ bằng chứng và trả kết quả.
2. Không thể gửi trùng cùng khoản phải thu trong FCC; mọi lần sửa, xác nhận, chia sẻ và đổi trạng thái có dấu vết.
3. Người dùng thấy **tổng chi phí ước tính theo đề nghị thực của đối tác** trước khi chấp thuận gửi hồ sơ; không hiển thị lãi suất giả lập như báo giá thật.
4. FCC đối soát được trạng thái giải ngân, thanh toán và tất toán do đối tác cung cấp, kể cả khi webhook đến chậm hoặc lặp.

## 2. Chủ thể và quyền

| Vai trò | Quyền chính | Giới hạn |
| --- | --- | --- |
| Nhà cung cấp: owner | Quản lý tổ chức, mời nhân sự, tạo/sửa hồ sơ nháp, chọn đối tác, cấp/thu hồi quyền chia sẻ | Không tự xác nhận nghĩa vụ của bên mua hoặc sửa hồ sơ đã gửi |
| Nhà cung cấp: operator | Tải chứng từ, lập hồ sơ, xem tiến độ | Không thay owner chấp thuận chia sẻ dữ liệu hoặc điều khoản |
| Bên mua: approver | Xem chứng từ được chia sẻ; xác nhận số tiền, nghĩa vụ và hạn thanh toán; hoặc từ chối/nêu tranh chấp | Không sửa hóa đơn hay phê duyệt tín dụng |
| Tổ chức tài chính: analyst | Xem hồ sơ được đồng ý chia sẻ, yêu cầu bổ sung, ghi quyết định và điều kiện tài trợ | Chỉ thấy hồ sơ được gửi tới tổ chức mình |
| FCC: operations | Xử lý ngoại lệ, hỗ trợ đối soát, khóa hồ sơ nghi ngờ | Không thay bên mua xác nhận, không thay đối tác quyết định tín dụng |
| FCC: auditor | Xem nhật ký và bằng chứng theo phạm vi được cấp | Chỉ đọc; truy cập có lý do và được ghi log |

Một người có thể thuộc nhiều tổ chức, nhưng mỗi phiên thao tác phải có `active_org_id`; mọi truy vấn dữ liệu nghiệp vụ lọc theo tổ chức và quyền trên từng hồ sơ. Hành động nhạy cảm cần xác thực lại hoặc MFA.

## 3. Luồng nghiệp vụ chuẩn

1. **Onboarding:** FCC kiểm tra thông tin pháp nhân, mã số thuế, người đại diện/quyền ủy quyền, email và điện thoại. Nhân sự FCC xác minh thủ công trước khi mở quyền gửi hồ sơ. Kết quả và chứng từ xác minh có hạn hiệu lực.
2. **Tạo khoản phải thu:** nhà cung cấp tải XML hóa đơn gốc, có thể thêm PDF, hợp đồng, biên bản giao nhận/nghiệm thu. Hệ thống đọc XML, trích thông tin, tính dấu vân tay và kiểm tra định dạng/trùng trong FCC. Trường hợp chưa có XML hoặc không đối chiếu được thì chuyển kiểm tra thủ công; không tự coi OCR là xác thực pháp lý.
3. **Xác minh giao dịch:** đối chiếu người bán, người mua, mã số thuế, số/ký hiệu hóa đơn, số tiền, ngày phát hành, hạn thanh toán, chứng từ giao nhận. Kết quả từ nguồn xác thực bên ngoài chỉ được ghi là `verified` khi có kết nối và bằng chứng trả về thật; nếu không là `unverified`.
4. **Xác nhận của bên mua:** gửi lời mời có thời hạn tới người có thẩm quyền bên mua. Bên mua xem bộ chứng từ, xác nhận khoản phải trả/hạn thanh toán và trạng thái tranh chấp; hoặc từ chối kèm lý do. Lưu phiên bản nội dung đã xác nhận, danh tính, thời điểm, phương thức xác thực và bằng chứng chấp thuận. Mẫu xác nhận và hiệu lực của nó phải được đối tác tài trợ/pháp chế duyệt.
5. **Đề nghị tài trợ:** nhà cung cấp xem điều kiện dự kiến từ đối tác đã ký hợp tác (nếu có), bao gồm số tiền ứng trước, tất cả phí, phương pháp tính, thời hạn, trách nhiệm trả nợ, điều kiện tiên quyết. Owner chọn một đối tác và đồng ý phạm vi dữ liệu chia sẻ. FCC khóa phiên bản hồ sơ, gửi qua API đối tác hoặc cổng nhận hồ sơ an toàn.
6. **Thẩm định:** đối tác yêu cầu bổ sung, từ chối hoặc đưa ra đề nghị chính thức. FCC hiển thị nguyên văn điều kiện và hạn chấp thuận do đối tác trả về; không biến dự đoán nội bộ thành cam kết của đối tác.
7. **Ký, giải ngân, thu hồi:** thực hiện trên kênh/hợp đồng của đối tác. FCC chỉ nhận mã giao dịch, số tiền, thời gian, chứng từ xác nhận và trạng thái qua tích hợp hoặc nhập liệu có đối soát hai người. Bên mua thanh toán theo chỉ dẫn hợp đồng; FCC theo dõi quá hạn và tất toán dựa trên dữ liệu đối tác.

### Vòng đời và quy tắc chuyển trạng thái

`DRAFT → DOCS_PENDING → BUYER_PENDING → BUYER_CONFIRMED → READY_TO_SUBMIT → SUBMITTED → UNDER_REVIEW → OFFERED → ACCEPTED → FUNDED → SETTLED`

Nhánh hợp lệ: `BUYER_DISPUTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`, `OVERDUE`, `CANCELLED`. Không chuyển trực tiếp từ `DRAFT` sang `FUNDED`. `BUYER_DISPUTED` chặn gửi hồ sơ cho đến khi tranh chấp được giải quyết và bên mua xác nhận phiên bản mới. Sau `SUBMITTED`, mọi thay đổi dữ liệu trọng yếu tạo phiên bản mới và yêu cầu đối tác chấp nhận lại. `FUNDED` và `SETTLED` chỉ được xác lập từ bằng chứng đối tác, không từ thao tác của nhà cung cấp.

**Ngoại lệ:** hóa đơn bị hủy/điều chỉnh, bên mua từ chối, sai số tiền, tài trợ đã tồn tại, webhook lặp/đến sai thứ tự, đối tác mất kết nối, thanh toán một phần và quá hạn đều có mã lý do, người xử lý và hướng khôi phục; không âm thầm đổi trạng thái.

## 4. Yêu cầu chức năng và tiêu chí chấp nhận

| ID | Yêu cầu MVP | Tiêu chí chấp nhận |
| --- | --- | --- |
| F01 | Tổ chức, người dùng, mời thành viên, phân quyền, MFA | Tài khoản khác tổ chức không đọc được dữ liệu; owner thu hồi quyền có hiệu lực tức thời |
| F02 | Tải XML/PDF và chứng từ bổ trợ | Quét tệp độc hại, giới hạn loại/kích thước, lưu bản gốc bất biến và SHA-256; lỗi tải lên có thể thử lại |
| F03 | Trích xuất và kiểm tra hóa đơn | Hiển thị trường trích xuất cho người sửa/xác nhận; lưu giá trị gốc và giá trị sửa; không tự đánh dấu đã xác minh từ OCR |
| F04 | Phát hiện trùng và khóa khoản phải thu | Tổ hợp mã số thuế người bán, mẫu/ký hiệu, số hóa đơn, ngày phát hành và mã tra cứu (nếu có) là khóa kiểm tra; xung đột đưa vào review, không tự xóa hồ sơ |
| F05 | Bên mua xác nhận/tranh chấp | Chỉ người được ủy quyền thao tác; lưu snapshot nội dung, phương thức xác thực, thời điểm, IP và phiên bản chứng từ |
| F06 | Quyền chia sẻ dữ liệu | Owner thấy rõ bên nhận, mục đích, loại dữ liệu, thời hạn; hệ thống lưu bằng chứng đồng ý và xử lý yêu cầu thu hồi theo hợp đồng/nghĩa vụ lưu giữ |
| F07 | Gửi và theo dõi hồ sơ tài trợ | Gửi một đối tác mỗi lần; idempotency key; lưu request/response; trạng thái hiển thị khớp phản hồi đối tác |
| F08 | Báo giá và chấp thuận | Hiển thị số tiền thực nhận, phí/lãi theo kỳ hạn, tổng phải trả và giả định tính; không có giá đối tác thì ghi “Chưa có báo giá” |
| F09 | Giải ngân, thanh toán, tất toán | Chỉ cập nhật khi có sự kiện/chứng từ đối tác; hỗ trợ thanh toán một phần và đối soát số dư |
| F10 | Nhật ký và vận hành ngoại lệ | Mọi sự kiện quan trọng có actor, thời gian, đối tượng, phiên bản trước/sau, correlation ID; nhân sự không sửa/xóa log |
| F11 | Dashboard và thông báo | Số liệu tính từ hồ sơ thật; thông báo gửi thất bại có hàng đợi thử lại; không dùng KPI giả lập trong môi trường thật |

### Giao diện tối thiểu

- Nhà cung cấp: danh sách khoản phải thu; wizard tạo hồ sơ; chi tiết chứng từ; trạng thái xác nhận; điều kiện tài trợ; timeline và lịch thanh toán.
- Bên mua: hộp yêu cầu xác nhận; trang xem hồ sơ; xác nhận/tranh chấp; lịch sử nghĩa vụ đã xác nhận.
- Đối tác tài trợ: hàng đợi hồ sơ, bộ chứng từ có kiểm soát quyền, yêu cầu bổ sung, quyết định/đề nghị, cập nhật giải ngân và thu hồi.
- FCC operations: hàng đợi ngoại lệ, đối soát, nhật ký truy cập và báo cáo SLA.

UI demo `DEMO_FINSUCCESS.html` chỉ là tham chiếu trình bày. Dữ liệu và lãi suất hard-code phải được thay bằng API; các nút không có nghiệp vụ phải được nối luồng hoặc ẩn trong môi trường thật.

## 5. Mô hình dữ liệu tối thiểu

| Bảng/thực thể | Trường quan trọng | Quy tắc |
| --- | --- | --- |
| `organizations` | id, tax_code, legal_name, type, verification_status | `tax_code` duy nhất theo pháp nhân |
| `users`, `memberships` | id, org_id, role, mfa_status, status | Không gắn quyền chỉ bằng vai trò UI |
| `receivables` | id, seller_org_id, buyer_org_id, amount_vnd, due_date, state, version | Tiền dùng số nguyên VND; thay đổi trọng yếu tăng version |
| `invoices` | id, receivable_id, seller_tax_code, buyer_tax_code, series, number, issue_date, total_vnd, lookup_code, source_status, fingerprint | Unique theo khóa nghiệp vụ khi đủ dữ liệu; xung đột review |
| `documents` | id, owner_org_id, type, object_key, sha256, mime, size, version | Bản gốc bất biến, metadata theo quyền |
| `buyer_confirmations` | id, receivable_id, version, decision, amount_vnd, due_date, actor_id, evidence_id, decided_at | Chỉ xác nhận đúng phiên bản đang hiển thị |
| `consents` | id, owner_org_id, recipient_org_id, purpose, scope, version, granted_at, revoked_at, evidence_id | Mọi lần chia sẻ kiểm tra consent hiện hành |
| `funding_applications` | id, receivable_id, lender_org_id, state, idempotency_key, external_ref | Một hồ sơ hoạt động tại một thời điểm cho mỗi khoản phải thu |
| `offers` | id, application_id, advance_vnd, fees_vnd, rate_basis, maturity, expires_at, terms_version | Giá do đối tác cung cấp, có nguồn và hạn hiệu lực |
| `settlement_events` | id, application_id, event_type, amount_vnd, occurred_at, external_event_id | `external_event_id` duy nhất theo đối tác; hỗ trợ thanh toán từng phần |
| `audit_events`, `outbox_events` | id, actor, action, entity, before_hash, after_hash, created_at, correlation_id | Append-only; không lưu bí mật trong log |

Số dư khoản tài trợ được tính từ sự kiện đối tác và có bảng đối soát; không nhập tay trực tiếp vào một trường “đã tất toán”. Lưu chứng từ trong object storage riêng tư, DB chỉ giữ khóa đối tượng. Thiết kế chính sách lưu/xóa theo từng loại dữ liệu, hợp đồng đối tác và kết quả rà soát pháp lý.

## 6. API và tích hợp

API JSON phiên bản `/v1`, OpenAPI là hợp đồng nguồn; tất cả POST tạo nghiệp vụ nhận `Idempotency-Key`, trả `request_id`. Dùng UTC trong DB, hiển thị `Asia/Ho_Chi_Minh`; tiền là số nguyên VND. Phân trang cursor, mã lỗi ổn định, `409` cho xung đột trạng thái/phiên bản và `422` cho dữ liệu không hợp lệ.

| Nhóm | Endpoint tiêu biểu |
| --- | --- |
| Phiên và tổ chức | `POST /v1/sessions`, `GET /v1/me`, `POST /v1/organizations`, `POST /v1/organizations/{id}/members` |
| Hồ sơ/chứng từ | `POST /v1/receivables`, `GET /v1/receivables`, `POST /v1/receivables/{id}/documents`, `POST /v1/receivables/{id}/validate` |
| Bên mua | `POST /v1/receivables/{id}/buyer-invitation`, `POST /v1/receivables/{id}/buyer-decision` |
| Chia sẻ và tài trợ | `POST /v1/consents`, `POST /v1/funding-applications`, `GET /v1/funding-applications/{id}`, `POST /v1/offers/{id}/accept` |
| Đối tác | `POST /v1/partner/events`, `GET /v1/partner/applications/{id}/package` |
| Vận hành | `GET /v1/operations/exceptions`, `POST /v1/operations/exceptions/{id}/resolve`, `GET /v1/audit-events` |

Webhook đối tác ký HMAC hoặc mTLS, có timestamp, nonce, event ID, schema version; từ chối replay và sự kiện không xác thực. Lưu raw payload được mã hóa trước khi xử lý. Trả 2xx sau khi ghi bền vào inbox; worker xử lý idempotent, có retry và dead-letter queue. Có job đối soát hằng ngày với file/API đối tác để phát hiện trạng thái thiếu, trùng hoặc sai tiền. Nếu đối tác chưa có API, dùng cổng thao tác và file đối soát có chữ ký/kiểm soát hai người; không giả lập tích hợp.

## 7. Kiến trúc và vận hành

**Đề xuất triển khai:** frontend web + backend modular monolith + PostgreSQL + object storage riêng tư + queue/worker + dịch vụ email/SMS. Các module backend: Identity, Organization, Receivables, Documents, Buyer Confirmation, Consent, Funding, Partner Adapter, Settlement, Audit, Notifications. Bắt đầu bằng một codebase và một CSDL; tách dịch vụ sau khi có nhu cầu tải/vận hành cụ thể. Môi trường `dev`, `staging`, `production` tách dữ liệu và khóa bí mật.

- Auth dùng OIDC hoặc giải pháp tương đương, MFA cho owner/approver/analyst/admin; RBAC kết hợp kiểm tra quyền theo bản ghi. Phiên có thời hạn, logout/revoke token, rate limit và khóa tạm khi thử đăng nhập bất thường.
- TLS trên đường truyền; mã hóa ổ đĩa/object storage; khóa trong secret manager; sao lưu có kiểm tra khôi phục; upload quét malware; URL chứng từ có thời hạn ngắn và không công khai.
- Logs, metrics, tracing với `correlation_id`; cảnh báo backlog, webhook lỗi, đối soát lệch, truy cập bất thường. Có runbook sự cố và quy trình thông báo đối tác/người dùng.
- Không dùng dữ liệu khách hàng để huấn luyện mô hình, gửi tới dịch vụ AI bên thứ ba hoặc hiển thị trong môi trường demo nếu chưa có cơ sở/đồng ý phù hợp.
- Kiểm thử xuyên tổ chức, phân quyền, replay webhook, race condition gửi trùng, thay đổi hóa đơn sau xác nhận, khôi phục backup và đối soát tiền là bắt buộc trước pilot.

**Chỉ tiêu kỹ thuật ban đầu để đo, không phải cam kết pháp lý/kinh doanh:** API đọc p95 < 500 ms ở tải pilot; 99,5% khả dụng hàng tháng sau pilot; RPO ≤ 24 giờ và RTO ≤ 4 giờ khi bắt đầu pilot. Chỉ tăng mục tiêu sau khi đo được chi phí và năng lực vận hành thực tế.

## 8. Điều kiện pháp lý và hợp đồng trước giao dịch thật

1. Pháp chế xác nhận mô hình FCC là cung cấp công nghệ/kết nối trong hợp đồng thực tế, đánh giá hoạt động nào có thể bị coi là trung gian thanh toán, môi giới/tư vấn sản phẩm tài chính hoặc hoạt động có điều kiện. **Không mở luồng tiền qua tài khoản FCC** khi chưa có cơ sở pháp lý và giấy phép thích hợp.
2. Ký hợp đồng đối tác xác định rõ ai xác minh khách hàng, kiểm tra hóa đơn, quyết định tín dụng, công bố giá, ký hợp đồng, giải ngân, thu hồi, xử lý khiếu nại, lưu trữ và báo cáo. Đối tác duyệt mẫu xác nhận bên mua, mẫu chia sẻ dữ liệu và tiêu chí chống tài trợ trùng.
3. Lập bản đồ dữ liệu cá nhân/doanh nghiệp, mục đích xử lý, căn cứ xử lý, bên nhận, thời hạn lưu, quyền của chủ thể và quy trình sự cố. Rà soát chuyển dữ liệu ra nước ngoài nếu dùng cloud/dịch vụ nước ngoài. Báo cáo cũ viện dẫn Nghị định 13/2023/NĐ-CP; tại ngày soạn spec, cần đối chiếu **Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP** đã có hiệu lực.
4. Kiểm tra giá trị pháp lý của xác nhận, hợp đồng và chữ ký điện tử theo quy trình cụ thể; không coi một nút “Đồng ý” bất kỳ là đủ cho mọi thỏa thuận.

Văn bản tham chiếu chính thức: [Thông tư 20/2024/TT-NHNN về bao thanh toán](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=168109), [Luật Giao dịch điện tử 2023](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=165913), [Luật Bảo vệ dữ liệu cá nhân 2025](https://vbpl.vn/tw/Pages/vbpq-thuoctinh.aspx?ItemID=179252), [Nghị định 356/2025/NĐ-CP](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=187276), [Nghị định 52/2024/NĐ-CP về thanh toán không dùng tiền mặt](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=167087). Cần kiểm tra lịch sử sửa đổi và hiệu lực của từng văn bản khi ký hợp đồng pilot; trang CSDL pháp luật có thể hiển thị hiệu lực theo từng phiên bản văn bản.

## 9. Lộ trình triển khai và bàn giao

| Giai đoạn | Bàn giao | Điều kiện qua cổng |
| --- | --- | --- |
| 0 — chốt pilot | 1 bên mua, 1 đối tác tài trợ, 5–10 nhà cung cấp; hợp đồng, mẫu chứng từ, quy tắc sản phẩm và pháp lý được ký duyệt | Có đầu mối nghiệp vụ, sandbox/file tích hợp và quy trình xử lý ngoại lệ |
| 1 — nền tảng | Auth, tổ chức, phân quyền, upload, hóa đơn, audit, môi trường staging | Hoàn thành test bảo mật quyền và khôi phục dữ liệu |
| 2 — luồng giao dịch | Xác nhận bên mua, consent, gửi hồ sơ, quyết định/đề nghị, thông báo | Chạy end-to-end trên dữ liệu giả lập có đủ nhánh lỗi |
| 3 — đối tác thật | Adapter, webhook hoặc cổng thủ công, giải ngân/thu hồi và đối soát | Đối tác ký xác nhận UAT; không còn sai lệch tiền/trạng thái chưa giải quyết |
| 4 — pilot giới hạn | Giao dịch thật với hạn mức/số lượng do đối tác quyết định; trực vận hành hằng ngày | Đo KPI, xử lý mọi sự cố trọng yếu, đối soát đủ 100% giao dịch |

**Definition of Done cho mỗi chức năng:** có mô tả API/UI, migration, kiểm tra quyền, audit, xử lý lỗi và retry, test nghiệp vụ có ý nghĩa, log/metric, tài liệu vận hành và người chịu trách nhiệm. Không đánh dấu hoàn thành chỉ vì màn hình hiển thị đúng.

### KPI pilot và tiêu chuẩn mở rộng

Theo dõi số hồ sơ tạo/gửi/được xác nhận/được duyệt/được giải ngân; thời gian trung vị và p90 từng bước; tỷ lệ tranh chấp, trùng, phải bổ sung; chi phí thực trả; tỷ lệ đối soát khớp; số sự cố bảo mật; phản hồi bên mua/nhà cung cấp/đối tác. Mục tiêu số cụ thể do ba bên chốt **trước pilot** theo baseline hiện tại. Chỉ mở rộng khi không có sai lệch tiền chưa giải quyết, không có lỗ hổng truy cập chéo tổ chức mức nghiêm trọng, đối tác xác nhận chất lượng hồ sơ và nhà cung cấp chấp nhận chi phí thực tế.

## 10. Quyết định cần chốt để đội bắt đầu xây dựng

1. Ngành và bên mua đầu chuỗi đầu tiên; loại hóa đơn/chứng từ được chấp nhận.
2. Đối tác tài trợ đầu tiên, sản phẩm cụ thể, cách xác nhận bên mua và API/file trao đổi.
3. Chính sách khi hóa đơn điều chỉnh/hủy, tranh chấp, tài trợ trùng và thanh toán một phần.
4. Mẫu giá/phí và quyền hạn người ký của mỗi bên.
5. Cloud, thời hạn lưu dữ liệu, chính sách truy cập hỗ trợ và người phụ trách tuân thủ.

Các mục này là **đầu vào bắt buộc của pilot**, không phải lý do trì hoãn xây dựng phần nền tảng và luồng staging. Khi chưa có đối tác tài trợ xác nhận, hệ thống chỉ được vận hành thử bằng dữ liệu giả lập, không công bố khả năng giải ngân thực tế.
