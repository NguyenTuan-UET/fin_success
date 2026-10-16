# sim-bank — ngân hàng giả lập cho FCC

Phase hiện tại không kết nối ngân hàng thật. `sim-bank` đóng vai 3 tổ chức tài chính **hư cấu** (SimBank An Khang, SimFinance Bình Minh, SimFund Cửu Long). Nó chỉ nói chuyện với FCC qua **API đối tác `/v1/partner/*` và webhook có chữ ký** — đúng bề mặt tích hợp mà ngân hàng thật sẽ dùng — và không đọc CSDL của FCC. Thay một tổ chức giả lập bằng ngân hàng thật về sau chỉ là cấp khóa tích hợp và đặt địa chỉ webhook của họ.

## Chạy

```bash
# 1. Cấp phát (máy chủ FCC đang tắt) — tạo 3 tổ chức đã xác minh, khóa tích hợp, khóa ký, địa chỉ webhook
cd server && npx tsx scripts/provision-sim-bank.ts          # ghi ../sim-bank/config.local.json (gitignore)
#    hoặc khi FCC đang chạy: quản trị FCC (có MFA) gọi POST /v1/operations/sim-banks/provision {"endpoint":"http://127.0.0.1:8790"}

# 2. Chạy FCC rồi chạy sim-bank
cd server && npm start
cd sim-bank && npm install && npm start                     # http://127.0.0.1:8790 — bảng điều khiển kịch bản
```

Khi khởi động, mỗi tổ chức đăng các sản phẩm còn thiếu (chờ FCC duyệt; ở `FCC_ENV=dev` tự công bố).

## Hành vi

| Sự kiện từ FCC | Phản ứng |
| --- | --- |
| `rfq.created` | Đọc gói tóm tắt (khoản phải thu + điểm hồ sơ), báo giá theo hạng: lãi = sàn sản phẩm + chênh lệch theo hạng; từ chối nếu hạng thấp hơn khẩu vị |
| `application.submitted` | Bắt đầu thẩm định; hạng đạt khẩu vị → đề nghị chính thức (ứng theo báo giá, kỳ hạn tới ngày đến hạn, hạn chấp thuận 5 ngày); không đạt → từ chối kèm lý do |
| `offer.accepted` | Giải ngân sau T+1 thu gọn (mặc định 30 giây, `SIM_DISBURSE_DELAY_SEC`), báo FCC bằng sự kiện `application.funded` có chữ ký |

Hồ sơ hành vi (khẩu vị, chênh lệch lãi, sản phẩm, ưu đãi xanh 0,3–0,5%) ở `src/profiles.ts` — là cấu hình của ngân hàng giả lập, không phải biểu giá của tổ chức có thật.

## Bảng điều khiển (`/`)

- Bật/tắt tự động từng tổ chức — tắt để người thật thao tác vai tổ chức tài chính qua `/lender` trên FCC.
- Ép kịch bản cho một hồ sơ/RFQ: duyệt, từ chối, từ chối báo giá, trễ giải ngân ×10, giữ lại.
- Gửi lại sự kiện giải ngân trùng (FCC phải bỏ qua) hoặc sai chữ ký (FCC phải từ chối).

## Kiểm thử

`npm test` dựng FCC (CSDL kiểm thử) và sim-bank trên cổng thật, chạy trọn vòng RFQ → báo giá → chọn → đề nghị → chấp thuận → giải ngân, cùng các nhánh từ chối, tắt tự động, phát lại, webhook giả mạo. Cần cụm PostgreSQL kiểm thử (`server/scripts/pg-local.sh start`) hoặc `TEST_DATABASE_URL`.
