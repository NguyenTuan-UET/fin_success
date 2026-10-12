# fin_success — FCC (Fast Cash Connect)

Nền tảng tài trợ chuỗi cung ứng cho **bên mua**, **bên bán (SME/gia công)** và **tổ chức tài chính**: chấm điểm doanh nghiệp, chấm điểm ESG bằng AI, Marketplace tài chính, tổng quan và dự báo dòng tiền từ phần mềm kế toán.

- Đặc tả: [document/SPEC_FCC_MVP.md](document/SPEC_FCC_MVP.md)
- Phương pháp: [5C](document/Phương%20pháp%20đánh%20giá%20tín%20dụng%20SME%20theo%20mô%20hình%205C.md), [khung ESG](document/Khung%20chấm%20điểm%20ESG%20cho%20SMEs%20vay%20vốn%20FCC.md)
- Frontend: [web/](web/) — React + TypeScript + Vite. Backend: [server/](server/) — Fastify + SQLite (luật nghiệp vụ, phân quyền, OTP, webhook, nhật ký).

## Chạy dự án (backend + frontend)

Cần Node ≥ 22.13 (backend dùng `node:sqlite` có sẵn, không cần cài driver).

```bash
# Terminal 1 — backend (http://127.0.0.1:8787)
cd server
npm install
cp .env.example .env         # điền OLLAMA_API_KEY nếu muốn dùng AI thật
npm start                    # tạo server/data/fcc.db và nạp dữ liệu mẫu ở lần chạy đầu

# Terminal 2 — frontend (http://localhost:5173, tự chuyển tiếp /api tới backend)
cd web
npm install
npm run dev
```

- **Backend** ([server/](server/)): Fastify + SQLite. Toàn bộ luật nghiệp vụ và phân quyền nằm ở [server/src/service.ts](server/src/service.ts); mỗi hành động kiểm tra tổ chức đăng nhập, trạng thái hợp lệ, rồi mới ghi DB và nhật ký. Trình duyệt chỉ giữ bản sao đã lọc theo quyền ([server/src/views.ts](server/src/views.ts)) và tự đồng bộ mỗi 4 giây, nên mở hai tab (hai tổ chức) sẽ thấy thay đổi của nhau.
- **Đăng nhập:** chế độ demo (`DEMO_MODE=true`) cho chọn tổ chức ở ô góc trên trái, không mật khẩu. Đây chưa phải xác thực thật — khi triển khai cần đặt `DEMO_MODE=false` và cắm nhà cung cấp danh tính (SSO/OIDC).
- **OTP:** máy chủ phát mã dùng một lần cho thao tác “bên mua xác nhận” và “doanh nghiệp chấp thuận đề nghị” (hết hạn 5 phút, tối đa 5 lần thử). Chưa nối SMS/email nên ở chế độ demo mã được trả về và điền sẵn vào ô nhập.
- **Webhook giải ngân:** `POST /api/webhooks/funding` — chữ ký `x-fcc-signature` = HMAC-SHA256(`WEBHOOK_SECRET`, thân yêu cầu), kèm `x-idempotency-key`; gọi lặp không ghi nhận hai lần. Nút “Ghi nhận giải ngân” trên giao diện dùng chung logic này.
- **AI:** trình duyệt gọi `/api/ollama/chat` (cần đăng nhập); backend gắn khóa và chuyển tới ollama.com — khóa chỉ nằm ở `server/.env`. `gpt-oss:120b` (văn bản), `gemma4:31b` (ảnh/OCR). Khi API lỗi app tự chuyển sang **AI mô phỏng** và gắn nhãn rõ; có thể chọn ở *Cài đặt → AI*.
- **Tác vụ định kỳ** (mỗi phút): RFQ quá hạn → `EXPIRED` và thu hồi quyền xem; đề nghị tài trợ quá hạn chấp thuận → rút lại; khoản đến hạn chưa thanh toán → `OVERDUE`.
- `cd server && npm test` chạy kịch bản end-to-end qua API (tạo hóa đơn → bên mua xác nhận bằng OTP → RFQ → chọn báo giá → thẩm định → đề nghị → chấp thuận → giải ngân bằng webhook → tất toán) cùng các kiểm tra phân quyền; `cd web && npm test` chạy kiểm thử công thức (ESG 66,67/100; ví dụ 2 tỷ – 90 ngày – ứng 80%).
- Đặt lại dữ liệu mẫu: *Cài đặt → Khôi phục dữ liệu mẫu* (áp dụng cho mọi người dùng) hoặc xóa `server/data/`.

## Tài liệu mẫu để trình diễn AI

`web/public/samples/` (mở tại http://localhost:5173/samples/…) — chứng từ **giả lập** để tải lên khi demo:

| File | Dùng ở | Kết quả AI đã kiểm tra (12/10/2026) |
| --- | --- | --- |
| `BCTC_mau_Phu_Gia_2025.png` | Chấm điểm DN → VLXD Phú Gia → Tải BCTC | `gemma4:31b` trích đúng 15/15 chỉ tiêu, ~4 giây |
| `Hoa_don_GTGT_mau_0005678.png` | Hóa đơn → Tạo khoản phải thu → Ảnh/PDF (vai Cơ khí Minh Tâm) | Đúng ký hiệu, số, ngày, MST, tổng tiền; tự khớp bên mua theo MST, ~9 giây |
| `Hoa_don_dien_12_thang_Hung_Thinh.png` | ESG → Giấy Hưng Thịnh → Bằng chứng | Phân loại E1/E3, trích 500.400 kWh và 98.000 kWh điện mặt trời |
| `Thong_bao_BHXH_Hung_Thinh.png` | ESG → Giấy Hưng Thịnh → Bằng chứng | Phân loại S1, trích 114/120 lao động đóng BHXH |

Sau khi tải bằng chứng, bấm **AI đề xuất** ở E1/S1: `gpt-oss:120b` đề xuất mức 2 kèm trích dẫn và danh sách bằng chứng còn thiếu; chỉ tiêu không có bằng chứng (ví dụ G3) trả về “Chưa xác minh”, không gán 0.

## Dữ liệu bên mua niêm yết (vnstock)

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # vnstock 4 từ chỉ mục vnstocks.com
# scripts/.env (gitignored): VNSTOCK_API_KEY=..., VNSTOCK_DEVICE_ID=<uuid trung tính>, VNSTOCK_TELEMETRY=off, VNSTOCK_DISABLE_AGENT_SETUP=1
.venv/bin/python scripts/fetch_listed.py HPG --tax-code <MST>
```

- Script ghi `web/public/listed/<MÃ>.json`; trong app: *Chấm điểm DN* → bên mua niêm yết → nhập mã → **Làm mới từ vnstock**. Đã có sẵn `HPG.json` (gán cho bên mua mẫu *Thép Đông Á Việt*) và `CTD.json` (gán cho *An Phát Hưng*) lấy ngày 12/10/2026 — giao diện ghi rõ đây là dữ liệu thật dùng để minh họa cho doanh nghiệp hư cấu.
- **Lưu ý dữ liệu (vnstock 4.0.9):** nguồn mặc định KBS trả BCTC năm với **nhãn năm bị đảo** (cột "2025" chứa số liệu 2022 của HPG; quý cũng lệch). Script dùng nguồn **VCI** (nhãn đúng, đã đối chiếu: tổng 4 quý 2025 của HPG = doanh thu năm 2025 = 156,1 nghìn tỷ) và dừng nếu thứ tự năm bất thường.
- Bản Cộng đồng: 60 lượt/phút, tối đa 8 kỳ BCTC. Ý kiến kiểm toán và diện cảnh báo không có trong vnstock — đang để mặc định, cần đối chiếu nguồn công bố thông tin.
- Quyền riêng tư: vnai đăng ký thiết bị với vnstocks.com (mặc định băm hostname) và có telemetry tùy chọn — đặt `VNSTOCK_DEVICE_ID` trung tính và `VNSTOCK_TELEMETRY=off`. Bản 4.0.9 không còn tự ghi vào file hướng dẫn của trợ lý AI (`~/.claude/CLAUDE.md`…) khi import; vẫn đặt `VNSTOCK_DISABLE_AGENT_SETUP=1` để chặn.

## Kịch bản trình diễn (≈ 7 phút)

Chuyển vai trò bằng ô tổ chức ở góc trên trái.

1. **Nhà cung cấp — Cơ khí Minh Tâm**: *Tổng quan* (phải thu, hạn mức do đối tác cấp, xếp hạng AA, dự báo dòng tiền có cảnh báo thiếu hụt → gợi ý tài trợ).
2. *Chấm điểm DN*: 5C + dữ liệu thay thế, độ bao phủ, cờ rủi ro, 20 chỉ tiêu có nguồn; **Tạo nhận xét AI**; *Tải BCTC* để AI trích xuất.
3. *Hóa đơn → Tạo khoản phải thu*: tải XML mẫu (QĐ1450), tạo lại lần 2 để thấy **chặn trùng**.
4. *Marketplace → Tìm nguồn vốn*: INV-001 khớp 4 sản phẩm, 2 sản phẩm “chưa phù hợp” kèm lý do; chọn 3 → **Gửi RFQ** → *Mô phỏng phản hồi* → **Chọn** báo giá tốt nhất (khóa hồ sơ, thu hồi quyền đối tác khác).
5. **Tổ chức tài chính** (đối tác được chọn): *Hồ sơ tài trợ* → thẩm định → đưa đề nghị chính thức; quay lại nhà cung cấp **chấp thuận**; tổ chức tài chính **ghi nhận giải ngân**.
6. **Bên mua — An Phát Hưng**: xác nhận INV-003 (OTP mô phỏng), ESG chuỗi cung ứng, ghi nhận thanh toán → tất toán.
7. **Nhà cung cấp — Giấy Hưng Thịnh**: *ESG & Xanh* → tải bằng chứng (ví dụ ảnh hóa đơn điện) → AI phân loại/trích số liệu → bật *Chế độ người thẩm định FCC* → AI đề xuất, chấp nhận/sửa có lý do → phát hành; tab *Tài chính xanh* cho thấy ưu đãi do đối tác cấu hình.
8. *Cài đặt → Nhật ký*: mọi bước đều có dấu vết; *Quyền chia sẻ dữ liệu*: thu hồi có hiệu lực ngay.

## Giới hạn hiện tại

- Toàn bộ doanh nghiệp, ngân hàng, MST, mã CK (…X) là hư cấu; số liệu là mô phỏng.
- Chưa có xác thực thật (chỉ đăng nhập mẫu), chưa gửi OTP qua SMS/email, chưa có kết nối thật tới MISA/FAST hay ngân hàng; “kết nối kế toán”, “crawl” và phản hồi báo giá của “Mô phỏng phản hồi đối tác” là dữ liệu mẫu và được gắn nhãn.
- Bộ chấm điểm (5C, ESG, xếp hạng hồ sơ) vẫn chạy ở trình duyệt trên dữ liệu máy chủ đã lọc. Để chấm điểm các khoản phải thu của tổ chức khác, máy chủ gửi bản rút gọn (không có số/ký hiệu hóa đơn, mô tả, chứng từ); bước tiếp theo là chuyển chấm điểm sang máy chủ.
- SQLite một tiến trình, phù hợp demo; chạy nhiều bản sao cần chuyển sang PostgreSQL.
- Gói `vnstock` trên PyPI ở trạng thái *quarantined*; cài từ chỉ mục chính thức vnstocks.com (`requirements.txt`).
