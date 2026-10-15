# fin_success — FCC (Fast Cash Connect)

Nền tảng tài trợ chuỗi cung ứng cho **bên mua**, **bên bán (SME/gia công)** và **tổ chức tài chính**: chấm điểm doanh nghiệp, chấm điểm ESG bằng AI, Marketplace tài chính, tổng quan và dự báo dòng tiền từ phần mềm kế toán.

- Đặc tả: [document/SPEC_FCC_MVP.md](document/SPEC_FCC_MVP.md)
- Phương pháp: [5C](document/Phương%20pháp%20đánh%20giá%20tín%20dụng%20SME%20theo%20mô%20hình%205C.md), [khung ESG](document/Khung%20chấm%20điểm%20ESG%20cho%20SMEs%20vay%20vốn%20FCC.md)
- Frontend: [web/](web/) — **bản mock giao diện** Next.js (dữ liệu minh họa, chưa nối backend), xem [web/README.md](web/README.md). Bản frontend React + Vite nối với backend đã chuyển sang [web-legacy/](web-legacy/). Backend: [server/](server/) — Fastify + SQLite (luật nghiệp vụ, phân quyền, OTP, webhook, nhật ký).

## Chạy dự án (backend + frontend)

Cần Node ≥ 22.13 (backend dùng `node:sqlite` có sẵn). **Hệ thống khởi động với cơ sở dữ liệu trống** — không có doanh nghiệp, hóa đơn hay sản phẩm mẫu; mọi dữ liệu do người dùng khai, nhập, tải lên hoặc lấy từ nguồn thật (AI, vnstock).

```bash
# Terminal 1 — backend (http://127.0.0.1:8787)
cd server
npm install
cp .env.example .env     # điền OLLAMA_API_KEY
npm start                # tạo server/data/fcc.db

# Terminal 2 — frontend nối backend (http://localhost:5173, tự chuyển /api tới backend)
cd web-legacy
npm install
npm run dev
```

**Không có đăng nhập.** Mở http://localhost:5173 để chọn vai trò, hoặc mở thẳng trang của từng vai trò, mỗi vai trò một tab:
- http://localhost:5173/supplier — nhà cung cấp
- http://localhost:5173/buyer — bên mua
- http://localhost:5173/lender — tổ chức tài chính (tự được xác minh, sản phẩm tự công bố)
- http://localhost:5173/fcc — nhân sự FCC (chỉ cần để thẩm định/phát hành ESG chính thức)

Mỗi trang tự vào phiên của vai trò đó, dùng một tổ chức trống (không có dữ liệu mẫu); nút *Đổi vai trò* trên thanh trên cùng quay về trang chọn vai trò. Điền thông tin tổ chức (kể cả mã chứng khoán của bên mua niêm yết) ở *Cài đặt → Tổ chức → Cập nhật hồ sơ*. Vì ai vào được cổng máy chủ cũng dùng được mọi vai trò, máy chủ chỉ chạy trên localhost.

**Luồng sử dụng**
1. Nhân sự FCC (`/fcc`) vào *Quản trị FCC*: thẩm định và phát hành điểm ESG chính thức. Nhân sự FCC không xem chứng từ hay hồ sơ tài trợ.
2. Tổ chức tài chính đăng sản phẩm Marketplace, hiện ngay cho doanh nghiệp.
3. Nhà cung cấp tạo khoản phải thu (XML hóa đơn, ảnh/PDF qua AI OCR hoặc nhập tay) → bên mua xác nhận → RFQ tới tối đa 3 sản phẩm phù hợp → tổ chức tài chính tự báo giá → chọn báo giá → thẩm định → đề nghị chính thức → doanh nghiệp chấp thuận → giải ngân → bên mua thanh toán → tất toán.
4. Giải ngân ghi nhận bằng nút của tổ chức tài chính hoặc **webhook** `POST /api/webhooks/funding`: mỗi tổ chức tài chính có khóa riêng (*Cài đặt → Tổ chức → Tạo khóa webhook*), header `x-fcc-org`, `x-idempotency-key`, `x-fcc-signature` = HMAC-SHA256(khóa, thân yêu cầu); gọi lặp không ghi nhận hai lần.
5. Dòng tiền: doanh nghiệp tự khai số dư tiền và chi định kỳ, nhập file công nợ CSV; hóa đơn trên FCC tự vào dự báo; độ trễ thanh toán bên mua tính từ lịch sử thanh toán thật trên FCC.

**Kiến trúc**
- Backend ([server/](server/)): Fastify + SQLite. Luật nghiệp vụ và phân quyền ở [server/src/service.ts](server/src/service.ts); dữ liệu trả về trình duyệt được lọc theo quyền chia sẻ ở [server/src/views.ts](server/src/views.ts). Trình duyệt tự đồng bộ mỗi 4 giây nên nhiều người dùng thấy thay đổi của nhau.
- AI: trình duyệt gọi `/api/ollama/chat` (cần có phiên); backend gắn khóa ollama.com (chỉ ở `server/.env`). Khi AI lỗi, tác vụ báo lỗi để nhập tay — không tự điền số liệu thay AI.
- Tác vụ định kỳ mỗi phút: RFQ quá hạn → hết hạn và thu hồi quyền xem; đề nghị quá hạn chấp thuận → rút lại; khoản đến hạn chưa thanh toán → `OVERDUE`.
- Kiểm thử: `cd server && npm test` (luồng end-to-end qua API từ CSDL trống, kèm phân quyền, webhook, khởi động lại); `cd web-legacy && npm test` (công thức chấm điểm).

## Dữ liệu bên mua niêm yết (vnstock)

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # vnstock 4 từ chỉ mục vnstocks.com
# scripts/.env (gitignored): VNSTOCK_API_KEY=..., VNSTOCK_DEVICE_ID=<uuid trung tính>, VNSTOCK_TELEMETRY=off, VNSTOCK_DISABLE_AGENT_SETUP=1
.venv/bin/python scripts/fetch_listed.py HPG --tax-code <MST>
```

- Script ghi `web-legacy/public/listed/<MÃ>.json`. Bên mua niêm yết (đã khai mã chứng khoán ở *Cài đặt*) vào *Chấm điểm DN* → **Nạp dữ liệu từ vnstock**; máy chủ đọc đúng file của mã đó và từ chối mã khác với mã đã khai. Repo có sẵn `HPG.json`, `CTD.json` (dữ liệu thật lấy ngày 12/10/2026); công ty thật có mã tương ứng đăng ký sẽ dùng được ngay.
- **Lưu ý dữ liệu (vnstock 4.0.9):** nguồn mặc định KBS trả BCTC năm với **nhãn năm bị đảo** (cột "2025" chứa số liệu 2022 của HPG; quý cũng lệch). Script dùng nguồn **VCI** (nhãn đúng, đã đối chiếu: tổng 4 quý 2025 của HPG = doanh thu năm 2025 = 156,1 nghìn tỷ) và dừng nếu thứ tự năm bất thường.
- Bản Cộng đồng: 60 lượt/phút, tối đa 8 kỳ BCTC. Ý kiến kiểm toán và diện cảnh báo không có trong vnstock — đang để mặc định, cần đối chiếu nguồn công bố thông tin.
- Quyền riêng tư: vnai đăng ký thiết bị với vnstocks.com (mặc định băm hostname) và có telemetry tùy chọn — đặt `VNSTOCK_DEVICE_ID` trung tính và `VNSTOCK_TELEMETRY=off`. Bản 4.0.9 không còn tự ghi vào file hướng dẫn của trợ lý AI (`~/.claude/CLAUDE.md`…) khi import; vẫn đặt `VNSTOCK_DISABLE_AGENT_SETUP=1` để chặn.

## Danh mục sản phẩm công khai

Tab *Marketplace → Tất cả sản phẩm* có 4 mục tham khảo thu thập từ trang chính thức của BIDV, Techcombank và MB, đối chiếu ngày 12/10/2026. Dữ liệu và liên kết nguồn nằm ở `web-legacy/src/data/publicProducts.ts`. Trang nguồn thường không công bố lãi suất, phí, điều kiện đầy đủ hoặc ngày hết hiệu lực; ứng dụng để các mục đó ở trạng thái chưa công bố. Danh mục tham khảo không đi vào bộ khớp sản phẩm hay RFQ. Chỉ sản phẩm do tổ chức tài chính đã xác minh đăng và FCC duyệt mới được gửi yêu cầu báo giá trên FCC. Khi cập nhật danh mục, cần mở lại từng URL nguồn và sửa ngày đối chiếu của mục tương ứng.

## Giới hạn hiện tại

- **Chưa có đối chiếu với cơ quan nhà nước:** MST, hóa đơn, CIC, thuế, BHXH đều do người dùng khai/tải lên; MST chưa tra cứu với cơ quan thuế; chưa có crawl dữ liệu doanh nghiệp từ nguồn công khai.
- **Chưa có kết nối phần mềm kế toán hay ngân hàng:** công nợ nhập bằng CSV; giải ngân/thanh toán do các bên tự xác nhận hoặc webhook. Muốn tích hợp MISA AMIS cần đăng ký đối tác tích hợp với MISA để có `app_id`.
- **Không có đăng nhập:** mỗi vai trò dùng một tổ chức cố định, chỉ chạy trên localhost. API đăng ký/đăng nhập (`/api/auth/*`) vẫn còn ở backend và được kiểm thử, nhưng giao diện không dùng. Chưa có cấp hạn mức tín dụng cho doanh nghiệp.
- **Tham số mô hình chấm điểm là giá trị khởi tạo** (bảng rủi ro ngành, trung vị biên lợi nhuận, hệ số phát thải lưới điện) — cần hiệu chỉnh và thẩm định trước khi dùng cho quyết định thật.
- Bộ chấm điểm chạy ở trình duyệt trên dữ liệu máy chủ đã lọc; khoản phải thu của tổ chức khác được gửi ở dạng rút gọn (không số/ký hiệu hóa đơn, mô tả, chứng từ) để tính điểm. Bước tiếp theo là chuyển chấm điểm sang máy chủ.
- SQLite một tiến trình; nhiều bản sao cần PostgreSQL. Chạy ngoài localhost cần đặt sau HTTPS.
- `web-legacy/public/samples/` là ảnh chứng từ giả lập chỉ dùng để thử tính năng AI đọc tài liệu; ứng dụng không nạp chúng.
- Gói `vnstock` trên PyPI ở trạng thái *quarantined*; cài từ chỉ mục chính thức vnstocks.com (`requirements.txt`).
