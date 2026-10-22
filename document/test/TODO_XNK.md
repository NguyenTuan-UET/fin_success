# Checklist — Chuyển FCC sang bối cảnh xuất nhập khẩu

Nguồn: `document/test/FCC_Dac_ta_thay_doi_XNK.docx` (22/10/2026, commit d88de66).
Thứ tự: từ đơn giản đến phức tạp, đã tính phụ thuộc. Cỡ: S nhỏ · M vừa · L lớn.

---

## Bậc 0 — Chốt quyết định (không code, chặn các bậc sau)

- [ ] **Q1** Bên nhập khẩu có thể là pháp nhân nước ngoài? → quyết định có làm Bậc 7 (WP6) không
- [ ] **Q2** Chỉ đổi nhãn hiển thị, giữ `supplier/buyer`, `sellerId/buyerId` (mặc định: giữ)
- [ ] **Q3** Giữ đường dẫn `/supplier`, `/buyer` (mặc định: giữ)
- [ ] **Q4** `CUSTOMS_GATE` = `block` / `warn` / `off` (đề xuất: `warn` khi thử nghiệm)
- [ ] **Q5** Duyệt danh mục loại chứng từ hải quan (bảng B.2) với người có chuyên môn
- [ ] **Q6** Bên nhập khẩu chỉ tải + xem, chưa đối chiếu (mặc định)
- [ ] **Q7** Giữ VND, chưa có ngoại tệ (mặc định)
- [ ] **Q8** Chứng từ chỉ thêm, không gỡ (mặc định)
- [ ] **Q9** Bỏ chữ “SME” ở giao diện; giữ tên hai tệp phương pháp
- [ ] **Q10** Bên tài trợ nước ngoài: cần ý kiến pháp chế
- [ ] Chuyên gia tín dụng duyệt thang điểm T1 mới (0→20 … 4→100) — README yêu cầu hai người duyệt

## Bậc 1 — Sửa mâu thuẫn trong đặc tả (S)

- [x] Thống nhất mức cờ `CUSTOMS_DECL_REUSED`: B.8 ghi `high`, mục 5.2 ghi `medium` (đề xuất `medium`)
- [x] Thống nhất mã lỗi “kind sai phía”: B.4 = 422, B.6 = 403 (đề xuất 403)
- [x] Thống nhất điều kiện nhãn “Thiếu chứng từ hải quan” (B.7) với điều kiện cổng RFQ (B.8)
- [ ] Quyết định webhook/thông báo có gửi tổ chức tài chính chỉ có RFQ mở (chưa có hồ sơ) không
- [ ] Quyết định loại email cho tiêu đề “bổ sung chứng từ hải quan” (`emailKind`, mailer.ts:30)

## Bậc 2 — Thay đổi nhỏ, ít rủi ro (S)

- [x] Tạo `packages/domain/src/labels.ts`: `ORG_TYPE_LABEL`, `orgTypeInSentence`; export từ `@fcc/domain`
- [x] `types.ts`: thêm `CUSTOMS_DOC_KINDS`, `CustomsDocKind`, `ReceivableFileKind`, `ReceivableFile` (`by`, `at`), `CustomsSideInfo`, `CustomsInfo`, `docs.customs?`, `customsInfo?` — tất cả tùy chọn
- [x] Chạy `tsc` ở server, web, packages/domain; sửa chỗ vỡ do kiểu `files` mới
- [x] `views.ts` (viewFor): `strip` thêm `docs.customs: false`, gỡ `customsInfo`; FCC cũng không thấy `customsInfo`
- [x] `routes/org.ts:146` quyền xem tệp: thêm vế `r.sellerId === a.activeOrgId`
- [x] `attachDocuments` và `createReceivable`: từ chối kind hải quan (422 “dùng chứng từ hải quan”), không biến thành `other`
- [x] `attachDocuments`: đổi `slice(0, 20)` thành `slice(0, 40)`
- [x] `auth/roles.ts`: thêm `attachCustomsDocuments` vào nhóm OPERATOR (không thêm vào STEP_UP_ACTIONS)
- [x] Thêm `receivable.customs_documents_added` vào `DomainEvent['type']`

## Bậc 3 — Logic thuần ở domain (S–M)

- [x] Hàm chuẩn hóa số tờ khai (cắt khoảng trắng, chữ hoa; chấp nhận 5–30 ký tự chữ-số, chưa đặt regex chặn)
- [x] Hàm tính `docs.customs` (có tờ khai xuất hoặc nhập)
- [x] `credit.ts` T1: đếm 4 mục, điểm 20/40/60/80/100, cập nhật `raw`/`reason`
- [x] Tăng `SCORECARD_VERSION` (`application-v1.1`)
- [x] `fraud.ts`: cờ `CUSTOMS_DECL_REUSED` (trùng số tờ khai với khoản đang hoạt động khác, gắn cả hai khoản)
- [x] `fraud.ts`: cờ `CUSTOMS_EXPORTER_MISMATCH` (MST trên tờ khai ≠ MST đơn vị xuất khẩu)
- [x] Hằng `CUSTOMS_GATE` trong `@fcc/domain` + hàm kiểm tra “thiếu gì” (truyền tham số được để test)
- [x] Unit test domain: T1 với 0–4 mục, hai cờ, chuẩn hóa, `docs.customs`, phân phía `CUSTOMS_DOC_KINDS`

## Bậc 4 — Hành động server và API (M)

- [ ] `service.ts`: `attachCustomsDocuments(c, id, { files, info })`
  - [ ] Xác định phía theo `sellerId`/`buyerId`; bên thứ ba → 403
  - [ ] Bên nhập khẩu khi DRAFT → 409
  - [ ] Trạng thái cho phép đến OVERDUE; chặn CANCELLED/REJECTED/SETTLED/EARLY_PAID; **không** chặn khi có hồ sơ tài trợ
  - [ ] Lọc tệp: khóa 64 hex, kind đúng phía; 10 tệp/lần, 40 tệp/khoản; bỏ trùng key + kind
  - [ ] Cập nhật `customsInfo[side]` + `updatedAt/updatedBy`; tính lại `docs.customs`
  - [ ] Nhật ký: “Bổ sung chứng từ hải quan”, “Cập nhật thông tin tờ khai”
  - [ ] Thông báo bên đối ứng (khi không DRAFT) + tổ chức tài chính có hồ sơ đang hoạt động
  - [ ] Phát sự kiện webhook `receivable.customs_documents_added`
  - [ ] Chạy kiểm tra cờ hải quan sau khi cập nhật `customsInfo.export`
- [x] `routes/v1.ts`: thêm dòng ENDPOINTS `POST /v1/receivables/{id}/customs-documents` (`check: receivableFiles`, Idempotency-Key)
- [x] Ghi chú OpenAPI: `/v1/partner/*` chưa nhận điểm cuối này
- [x] Cổng RFQ trong `createRfq` và `submitDirect`: 422 nêu rõ thiếu gì; thiếu vận đơn không chặn
- [x] Đưa hai cờ `CUSTOMS_*` vào hàng đợi FCC, xử lý bằng `resolveFlag` sẵn có
- [x] sim-bank: bỏ qua an toàn sự kiện mới
- [ ] Cập nhật dữ liệu mẫu (seed, dev mode) có tờ khai đã thông quan, để luồng RFQ không bị cổng chặn

## Bậc 5 — Test server (M)

- [x] `invoices.test.ts`: các ca B.11 (DRAFT, sau khi gửi, bên thứ ba, sai phía, kind hải quan qua `/documents`, vượt 40, CANCELLED/SETTLED, có hồ sơ tài trợ → 200)
- [x] `views.test.ts`: tổ chức tài chính có RFQ mở thấy / RFQ đóng không thấy; FCC không thấy; bên nhập khẩu không thấy DRAFT
- [x] `storage-files.test.ts`: bên xuất khẩu mở được tệp bên nhập khẩu tải; tổ chức lạ nhận 404
- [x] `v1.test.ts`: OpenAPI có điểm cuối; khóa tệp của tổ chức khác bị từ chối; Idempotency phát lại; cổng block/warn/off
- [x] Nhật ký + thông báo đúng người, không gửi tổ chức tài chính đã WITHDRAWN
- [x] `reviseDisputed`/amendment không xóa `files`
- [x] Sửa các test RFQ cũ bị cổng chặn (thêm tờ khai trong bước thiết lập)

## Bậc 6 — Giao diện chứng từ hải quan (M–L)

- [ ] `InvoiceUpload`: bước “Chứng từ hải quan” sau kiểm tra số liệu; gọi customs-documents sau `createReceivable`; lỗi thì toast + thử lại ở màn chi tiết
- [x] `InvoiceParts` / `InvoiceManager`: nhóm “Chứng từ hải quan” (loại, ai tải, ngày, nút tải thêm); nhãn “Thiếu chứng từ hải quan”; nút tắt kèm lý do khi trạng thái không cho phép
- [x] `BuyerConfirm`: xem chứng từ + thông tin tờ khai phía xuất; tải chứng từ + nhập thông tin phía nhập (chỉ khi không DRAFT)
- [x] `LenderAppraisal`: khung chỉ đọc, chứng từ hai phía, cảnh báo trùng tờ khai, loại còn thiếu
- [ ] `FundingRequest` / `MarketplaceCompare`: tắt nút hoặc cảnh báo theo `CUSTOMS_GATE`, liên kết tới nơi bổ sung
- [x] Chuông thông báo: mục “Bổ sung chứng từ hải quan”
- [x] `glossary.ts`: Tờ khai hải quan, Vận đơn, C/O, Incoterms, Thông quan
- [x] `tours.ts`: thêm một bước cho hai vai trò
- [x] `facts.ts` / `answers.ts`: câu hỏi “hóa đơn này thiếu chứng từ hải quan nào?”
- [ ] Trợ năng: nhãn ô tải tệp, lỗi dùng `aria-live`, không chỉ dựa vào màu

## Bậc 7 — Đổi tên toàn bộ (L — nhiều tệp, ít logic, duyệt từng tệp, không thay hàng loạt)

- [x] Domain (12 tệp): credit, ews, fraud, marketplace, settlement, statement, journal, cashflow, fees, esg, collateral, types (comment)
- [x] Server (11 tệp): service (bảng nhãn `requireType`), assessments, billing, kpis, routes/v1 (summary/tag), routes/auth (lỗi đăng ký), routes/org, auth/roles, identity-providers, views, listed-sync
- [x] sim-bank (3 tệp): bank, profiles, control
- [x] Web khung/menu: `roles.ts` (nhãn + dữ liệu mẫu), AppShell, các `page.tsx`, layout, manifest
- [x] Web màn hình (14 screens)
- [x] Web trợ giúp: tours, glossary, model, ai, answers, facts (kể cả lời nhắc hệ thống của trợ lý AI)
- [x] Nhãn kind: `delivery` → “Chứng từ giao hàng / vận chuyển”; `contract` → “Hợp đồng ngoại thương / đơn đặt hàng”
- [x] Dùng `ORG_TYPE_LABEL` thay các bảng nhãn riêng ở service.ts, auth.ts, web/roles.ts
- [x] Sau mỗi nhóm: chạy test, sửa các so khớp chuỗi (server/tests, domain tests, sim-bank tests, e2e Playwright)
- [x] Test chống tái phát trong `server/tests` quét chuỗi cấm (có danh sách ngoại lệ)
- [x] Kiểm tra `GET /v1/openapi.json` không còn “nhà cung cấp”, “bên mua”

## Bậc 8 — Bên nhập khẩu nước ngoài, WP6 (M–L, chỉ khi Q1 = có)

- [ ] `Org.country` (ISO alpha-2, mặc định VN cho dữ liệu cũ)
- [ ] `province`, `vsic`, `foundedYear`, `employees` cho phép rỗng khi không phải VN
- [ ] Tách kiểm tra mã định danh theo quốc gia; duy nhất theo cặp (country, taxCode); đổi nhãn trường
- [ ] Màn đăng ký: chọn quốc gia, ẩn hoặc nới trường VN
- [ ] `taxcode.ts` / InvoiceUpload: chỉ kiểm tra MST VN khi bên nhập khẩu thuộc VN; chọn bên nước ngoài theo tên + quốc gia
- [ ] `einvoice.ts`: không chặn khi MST người mua trống hoặc là mã nước ngoài
- [ ] KYC: chấp nhận giấy đăng ký kinh doanh nước ngoài, FCC đối chiếu thủ công
- [ ] Ẩn hoặc ghi “không áp dụng” cho crawl/tra cứu thuế và vnstock với bên nước ngoài
- [ ] Test cả hai nhánh VN / nước ngoài

## Bậc 9 — Nghiệm thu và tài liệu (M)

- [ ] e2e `flow.spec.ts`: xuất khẩu tải → nhập khẩu thấy và tải tờ khai nhập → tổ chức tài chính thấy cả hai
- [ ] `a11y.spec.ts` cho các màn mới
- [ ] Chạy đủ: server `npm test`, domain `npm test`, sim-bank `npm test`, web `npm run e2e`
- [ ] Chạy với bản sao CSDL hiện có: đăng nhập được, khoản cũ mở được, không lỗi do trường mới thiếu
- [ ] Duyệt tay 4 vai trò: đăng ký → hóa đơn → xác nhận → RFQ → giải ngân → thu hồi; không còn chữ cũ (kể cả `email_outbox`)
- [ ] Chuỗi băm nhật ký vẫn hợp lệ (`GET /v1/audit-events/integrity`)
- [x] Tài liệu: README, README_SU_DUNG, HUONG_DAN_SU_DUNG (mục chứng từ hải quan), VAN_HANH (nhật ký cũ giữ chữ cũ), SPEC_HOAN_THIEN, `.env.example`
- [x] Ghi chú đầu trang cho REPPORT_FINSUCCESS.md, QA_PRODUCTION_*.md, hai tệp phương pháp
- [ ] Cập nhật hoặc ghi chú lỗi thời `FCC_Mo_ta_he_thong.docx`
- [ ] Báo nhóm vận hành: điểm T1 của khoản cũ giảm, không tính lại điểm đã phát hành

---

## Ghi chú tiến độ (23/10/2026)

- Q4 để `CUSTOMS_GATE = "warn"` (đổi một dòng ở `packages/domain/src/customs.ts` để thành `block`). Q1 chưa chốt nên Bậc 8 (WP6) chưa làm.
- Cờ `CUSTOMS_DECL_REUSED` để mức `medium`; kind sai phía trả 403.
- Chưa làm: bước “Chứng từ hải quan” riêng trong `InvoiceUpload` (hiện thêm ở chi tiết hóa đơn), email kind riêng, e2e Playwright / a11y cho màn mới (cần dựng server + Chrome), webhook cho tổ chức chỉ có RFQ mở, kiểm tra với bản sao CSDL thật, duyệt tay 4 vai trò.
- `sim-bank/tests` có 2 ca đỏ do ngày thu tiền theo giờ UTC/VN (cũng đỏ ở commit d88de66, không do thay đổi này).
