# fin_success — FCC (Fast Cash Connect)

Nền tảng tài trợ chuỗi cung ứng cho **bên mua**, **bên bán (SME/gia công)** và **tổ chức tài chính**: chấm điểm tín dụng và ESG, Marketplace tài chính (RFQ → thẩm định → giải ngân → thu hồi), bút toán đề xuất, dự báo dòng tiền, phí và doanh thu theo 6 nguồn thu.

Phase này **không kết nối ngân hàng thật**: phía ngân hàng/tổ chức tài chính do [sim-bank/](sim-bank/) giả lập (tổ chức hư cấu, đi qua đúng API đối tác và webhook ký HMAC). Mọi chức năng còn lại chạy thật.

- Đặc tả: [document/SPEC_FCC_MVP.md](document/SPEC_FCC_MVP.md); kế hoạch hoàn thiện và trạng thái từng gói việc: [document/SPEC_HOAN_THIEN.md](document/SPEC_HOAN_THIEN.md); vận hành: [document/VAN_HANH.md](document/VAN_HANH.md)
- Phương pháp: [5C](document/Phương%20pháp%20đánh%20giá%20tín%20dụng%20SME%20theo%20mô%20hình%205C.md), [khung ESG](document/Khung%20chấm%20điểm%20ESG%20cho%20SMEs%20vay%20vốn%20FCC.md)

## Cấu trúc

| Thư mục | Vai trò |
| --- | --- |
| [web/](web/) | Giao diện duy nhất (Next.js 16, React 19); gọi `/api` và `/v1` cùng nguồn, Next chuyển tiếp tới `server/`. Kiểm thử e2e Playwright |
| [server/](server/) | Fastify 5 + PostgreSQL: luật nghiệp vụ, phân quyền theo vai trò, MFA, kho tệp mã hóa, nhật ký chuỗi băm, API công khai `/v1` (OpenAPI), SSE, webhook hai chiều, crawl nguồn công khai |
| [packages/domain/](packages/domain/) | `@fcc/domain`: công thức chấm điểm 5C/bên mua/hồ sơ, ESG, EWS, tài sản bảo đảm, gian lận hóa đơn, thu hồi, phí, bút toán, dòng tiền — dùng chung cho server và giao diện |
| [sim-bank/](sim-bank/) | Ngân hàng giả lập: 3 tổ chức hư cấu báo giá, thẩm định, giải ngân qua API đối tác |
| [scripts/](scripts/) | `fetch_listed.py` (vnstock cho bên mua niêm yết) |
| [ocr_lab/](ocr_lab/) | Thử nghiệm đọc chứng từ; `samples/` là ảnh chứng từ giả lập để thử AI |

## Chạy dự án

Cần Node ≥ 22.13 và PostgreSQL (dev dùng cụm riêng do script dựng, không cần sudo).

```bash
# Terminal 1 — PostgreSQL cục bộ + backend (http://127.0.0.1:8787)
cd server
npm install
scripts/pg-local.sh start
cp .env.example .env       # điền OLLAMA_API_KEY (AI đọc chứng từ, chấm ESG, trợ lý)
npm start

# Terminal 2 — giao diện (http://localhost:3000)
cd web
npm install
npm run dev

# Terminal 3 (tùy chọn) — ngân hàng giả lập, xem sim-bank/README.md
```

Cơ sở dữ liệu khởi động **trống** — không có doanh nghiệp, hóa đơn hay sản phẩm mẫu.

**Chế độ dev (`FCC_ENV=dev`, mặc định, chỉ localhost):** không đăng nhập; mở http://localhost:3000 chọn vai trò hoặc vào thẳng `/supplier`, `/buyer`, `/lender`, `/admin`, mỗi vai trò một tab. **Staging/production (`FCC_ENV=staging|production`):** bắt buộc đăng nhập email/mật khẩu + MFA (TOTP) cho hành động nhạy cảm, nhiều tổ chức/vai trò theo thành viên, tài khoản FCC tạo từ `ADMIN_EMAIL`/`ADMIN_PASSWORD`; cần `DATABASE_URL`, `FCC_DATA_KEY`, HTTPS ở lớp proxy (xem [VAN_HANH.md](document/VAN_HANH.md)).

**Luồng sử dụng**
1. Nhân sự FCC xác minh tổ chức tài chính, duyệt sản phẩm, thẩm định/phát hành điểm ESG và điểm tín dụng, phê duyệt nguồn dữ liệu công khai.
2. Tổ chức tài chính đăng sản phẩm Marketplace (giao diện hoặc API `/v1/partner/*`).
3. Nhà cung cấp tạo khoản phải thu (XML, ảnh/PDF qua AI OCR hoặc nhập tay; hệ thống cảnh báo bất thường) → bên mua xác nhận → RFQ tới tối đa 3 sản phẩm → báo giá → thẩm định → đề nghị chính thức → chấp thuận (MFA) → giải ngân → bên mua thanh toán → thu hồi theo phí → lãi → gốc → hoàn phần dư.
4. Dòng tiền, bút toán đề xuất (TT133/TT200) và sao kê giả lập sinh từ dữ liệu thật trên nền tảng; sai số dự báo được đo và hiển thị.

**Kiểm thử:** `cd server && npm test` (API từ CSDL trống, phân quyền, MFA, webhook, crawl, thanh toán…); `cd packages/domain && npm test`; `cd sim-bank && npm test`; `cd web && npm run e2e` (Playwright, cần backend dev đang chạy).

## Dữ liệu bên mua niêm yết (vnstock)

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # vnstock 4 từ chỉ mục vnstocks.com
# scripts/.env (gitignored): VNSTOCK_API_KEY=..., VNSTOCK_DEVICE_ID=<uuid trung tính>, VNSTOCK_TELEMETRY=off, VNSTOCK_DISABLE_AGENT_SETUP=1
.venv/bin/python scripts/fetch_listed.py HPG --tax-code <MST>
```

- **Máy chủ tự chạy script** (`server/src/listed-sync.ts`) cho mọi bên mua niêm yết đã được **FCC xác minh ánh xạ MST ↔ mã** (`/admin/sources`): mỗi 5 phút kiểm tra, lấy lại khi dữ liệu cũ hơn 15 phút trong giờ giao dịch (T2–T6, 9–15h) hoặc 6 giờ ngoài giờ; giãn 15 giây giữa các mã để không vượt hạn mức. Bên mua bấm **Làm mới ngay** ở *Cài đặt*, FCC bấm **Lấy dữ liệu ngay** ở `/admin/sources` (kèm trạng thái lỗi theo mã). Lần lấy lỗi thì giữ dữ liệu cũ.
- Cấu hình (`server/.env`): `VNSTOCK_AUTO=0` để tắt; `VNSTOCK_PYTHON` (mặc định `../.venv/bin/python`), `VNSTOCK_SCRIPT`, `VNSTOCK_FRESH_MIN_OPEN` (15), `VNSTOCK_FRESH_MIN_CLOSED` (360). Chạy tay vẫn được: lệnh ở trên ghi `server/seed/listed/<MÃ>.json`. Repo có sẵn `HPG.json`, `CTD.json`.
- Script kiểm tra dữ liệu: dừng (giữ file cũ) nếu tổng tài sản/doanh thu không dương hoặc thiếu vốn chủ/nợ ngắn hạn; ghi cảnh báo khi lệch cân đối > 2%, BCTC quá cũ, thiếu giá, giá đứng quá 7 ngày; vốn hóa và nghĩa vụ trả nợ được đánh dấu là ước tính. Ghi file tạm rồi đổi tên nên máy chủ không đọc phải file ghi dở.
- **Lưu ý dữ liệu (vnstock 4.0.9):** nguồn mặc định KBS trả BCTC năm với **nhãn năm bị đảo** (cột "2025" chứa số liệu 2022 của HPG; quý cũng lệch). Script dùng nguồn **VCI** (nhãn đúng, đã đối chiếu: tổng 4 quý 2025 của HPG = doanh thu năm 2025 = 156,1 nghìn tỷ) và dừng nếu thứ tự năm bất thường.
- Bản Cộng đồng: 60 lượt/phút, tối đa 8 kỳ BCTC. Ý kiến kiểm toán và diện cảnh báo không có trong vnstock: nhân sự FCC đối chiếu công bố thông tin của sở giao dịch rồi bấm **Xác nhận đã đối chiếu** kèm nguồn (`/admin/sources`). Trước khi xác nhận, hai chỉ tiêu M1, M2 không được chấm (điểm tạm tính), không mặc định là tốt.
- Quyền riêng tư: vnai đăng ký thiết bị với vnstocks.com (mặc định băm hostname) và có telemetry tùy chọn — đặt `VNSTOCK_DEVICE_ID` trung tính và `VNSTOCK_TELEMETRY=off`. Bản 4.0.9 không còn tự ghi vào file hướng dẫn của trợ lý AI (`~/.claude/CLAUDE.md`…) khi import; vẫn đặt `VNSTOCK_DISABLE_AGENT_SETUP=1` để chặn.

## Giới hạn hiện tại

- **Không liên kết ngân hàng thật** (phase sau): giải ngân/sao kê do sim-bank phát sinh.
- **Đối chiếu cơ quan nhà nước:** cổng thuế, đăng ký kinh doanh, hóa đơn điện tử, tòa án… khảo sát 16/10/2026 đều không cho tự động hóa (CAPTCHA, đăng nhập, không kết nối được) nên xếp loại B — nhân sự FCC tra cứu thủ công và ghi kết quả kèm đường dẫn nguồn. Chỉ website do chính doanh nghiệp khai (loại A) được đọc tự động, và chỉ sau khi FCC phê duyệt nguồn. Dữ liệu công khai chỉ để tham khảo, **không đưa vào điểm**.
- **Tham số mô hình chấm điểm là giá trị khởi tạo** (bảng rủi ro ngành, trung vị biên lợi nhuận, hệ số phát thải lưới điện); đổi tham số cần hai người duyệt, nhưng vẫn cần chuyên gia tín dụng hiệu chỉnh trước khi dùng cho quyết định thật.
- **AI** chạy qua dịch vụ ngoài (ollama.com); khóa chỉ ở `server/.env`. Cần quyết định tự vận hành hay giữ dịch vụ ngoài trước pilot (xem [VAN_HANH.md](document/VAN_HANH.md)).
- Chữ ký số từ xa và eKYC qua nhà cung cấp chưa tích hợp (dùng MFA + băm nội dung, FCC đối chiếu giấy tờ); kết nối trực tiếp phần mềm kế toán (MISA AMIS…) cần đăng ký đối tác, hiện nhập CSV công nợ.
- Gói `vnstock` trên PyPI ở trạng thái *quarantined*; cài từ chỉ mục chính thức vnstocks.com (`requirements.txt`).
