# Vận hành FCC — staging và production

Tài liệu cho người triển khai. Cấu hình mẫu ở `server/.env.example`.

## 1. Biến môi trường bắt buộc (staging/production)

| Biến | Ý nghĩa |
| --- | --- |
| `FCC_ENV` | `staging` hoặc `production` (bắt buộc đăng nhập, tắt `/api/dev/*`) |
| `DATABASE_URL` | PostgreSQL (khuyến nghị bản quản lý có sao lưu tự động) |
| `FCC_DATA_KEY` | 64 ký tự hex. Mã hóa tệp chứng từ và secret MFA. **Cất riêng khỏi bản sao lưu**; mất khóa là mất tệp |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tài khoản quản trị FCC đầu tiên (mật khẩu ≥ 12 ký tự); bật MFA ngay lần đăng nhập đầu |
| `APP_URL` | Địa chỉ giao diện, dùng trong liên kết email |
| `SMTP_URL`, `MAIL_FROM` | Gửi email (mời thành viên, đặt lại mật khẩu, thông báo). Bỏ trống thì chỉ ghi log |
| `OLLAMA_API_KEY` | Khóa AI. Chỉ đặt ở máy chủ, không bao giờ vào mã hoặc giao diện |
| `RATE_LIMIT_PER_MIN`, `RATE_LIMIT_AUTH_PER_MIN` | Mặc định 600 và 30 yêu cầu/phút/địa chỉ |
| `TRUST_PROXY=1` | Chỉ bật khi máy chủ đứng sau proxy tin cậy, để giới hạn tần suất theo địa chỉ thật (X-Forwarded-For). Nếu không bật, mọi người dùng sau proxy dùng chung một hạn mức |
| `CRAWL_USER_AGENT` | Tùy chọn. Mặc định tự định danh `FCC-Bot` kèm địa chỉ liên hệ |

Khóa bí mật đặt bằng secret manager của nền tảng (hoặc biến môi trường của dịch vụ), không đưa vào kho mã. `server/.env` đã gitignore.

## 2. Mạng và TLS

- Máy chủ Fastify nghe `HOST` (mặc định `127.0.0.1`). Đặt một reverse proxy (nginx, Caddy, cổng của nền tảng) làm điểm TLS; chỉ proxy được truy cập cổng 8787.
- Giao diện Next.js chuyển tiếp `/api` và `/v1` tới backend qua `FCC_API_URL`. Triển khai tách (giao diện ở nơi khác) cần backend có tên miền HTTPS riêng và `FCC_API_URL` trỏ tới đó.
- Phản hồi API có `cache-control: no-store`, `x-content-type-options: nosniff`, `x-frame-options: DENY`.
- Webhook gửi tới tổ chức tài chính chỉ nên dùng địa chỉ HTTPS; chữ ký HMAC-SHA256 có timestamp, sai lệch quá ±5 phút bị từ chối.

## 3. Sao lưu và khôi phục

```bash
cd server
scripts/backup.sh                       # pg_dump + kho tệp mã hóa, giữ 14 bản
scripts/restore-check.sh                # diễn tập khôi phục vào CSDL tạm, kiểm tra checksum, số bản ghi, chuỗi băm nhật ký
npx tsx scripts/verify-db.ts [URL]      # mã thoát 2 nếu nhật ký bị sửa
```

Chạy `backup.sh` hằng ngày (cron/lịch của nền tảng) và `restore-check.sh` hằng tuần. Mục tiêu khôi phục ≤ 4 giờ.

## 4. Nhật ký kiểm toán

- `audit_events` chỉ thêm; mỗi sự kiện chứa băm của sự kiện trước. `GET /v1/audit-events/integrity` (FCC) và `verify-db.ts` kiểm tra chuỗi; sửa một dòng bất kỳ thì báo đúng vị trí.
- Xuất theo khoảng thời gian: `GET /v1/audit-events?from=&to=` (cursor).
- Tài khoản `fcc_auditor` chỉ đọc; mọi lần truy cập của họ được ghi "Kiểm toán viên truy cập".
- Khuyến nghị: mỗi ngày gửi băm cuối chuỗi tới một nơi lưu độc lập (hộp thư kiểm toán hoặc kho khóa ghi) để chống sửa toàn bộ chuỗi.

## 5. Theo dõi và cảnh báo

Điểm cần cảnh báo (kiểm tra bằng API hoặc nhật ký ứng dụng, mã yêu cầu `x-request-id` có trong mọi phản hồi và nhật ký):

| Dấu hiệu | Nơi xem |
| --- | --- |
| Webhook đi quá 12 lần vẫn lỗi (trạng thái dead) | `GET /v1/partner-endpoint/deliveries` của từng tổ chức |
| Email trong hàng đợi lỗi | Nhật ký ứng dụng "email"; thông báo vẫn có trong ứng dụng |
| Việc crawl lỗi hoặc cần tra cứu thủ công | `/admin/sources` hoặc `GET /v1/operations/crawl-jobs` |
| Nhật ký chuỗi băm sai | `/v1/audit-events/integrity` |
| Ngoại lệ mở (cờ hóa đơn, hoàn tiền chưa trả, khiếu nại dữ liệu công khai) | `GET /v1/operations/kpis` → `exceptions` |
| Tỷ lệ 429, 5xx | Nhật ký của proxy và của ứng dụng |

KPI vận hành (người dùng, hóa đơn, giá trị tài trợ, tỷ lệ phê duyệt, thời gian từng bước, tỷ lệ tranh chấp) hiển thị ở `/admin`, nguồn `GET /v1/operations/kpis`.

## 6. Dữ liệu công khai (crawl)

- Nguồn chỉ chạy khi `approved` (quản trị FCC, MFA, có ghi chú căn cứ). Nguồn loại C không phê duyệt được.
- Tự động hóa: tôn trọng robots.txt, 1 yêu cầu/5 giây/máy chủ, UA định danh, chặn địa chỉ nội bộ (SSRF), dừng 24 giờ và chuyển tra cứu thủ công khi gặp CAPTCHA/đăng nhập/403.
- Bản chụp thô lưu trong kho tệp mã hóa (SHA-256), kèm URL, thời điểm, phiên bản parser. Đề xuất lưu 24 tháng; chưa có tác vụ xóa tự động.
- Dữ liệu công khai không đi vào điểm; doanh nghiệp xem được và khiếu nại được.

## 7. Quyết định cần chốt trước pilot

1. **AI nội bộ hay dịch vụ ngoài.** Hiện gọi `ollama.com` (mô hình văn bản và thị giác). Chứng từ doanh nghiệp (BCTC, hóa đơn, CIC) đi ra ngoài khi dùng AI đọc chứng từ. Cần ý kiến pháp chế theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15: hoặc tự vận hành mô hình, hoặc giữ dịch vụ ngoài kèm hợp đồng xử lý dữ liệu và thông báo rõ cho người dùng. Trong lúc chờ, AI luôn cần người xác nhận trước khi dùng số liệu.
2. **Giấy phép vnstock** cho mục đích thương mại; song song khảo sát nguồn công bố thông tin của sở giao dịch.
3. **Pháp chế duyệt từng nguồn crawl**, thời gian lưu bản chụp.
4. **Nhà cung cấp chữ ký số từ xa và eKYC**; **SMTP** của tên miền công ty.
5. **Biểu phí ban đầu** (hệ thống chạy được với biểu phí 0 đồng).
6. **Hiệu chỉnh tham số chấm điểm** bởi chuyên gia tín dụng; đổi tham số cần hai người duyệt.
