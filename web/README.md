# FCC · Fast Cash Connect — bản mock giao diện (Next.js)

Bản mock tương tác cho dự án **FCC (Fast Cash Connect)** của nhóm Fin Success. Giao diện bám theo bộ 16 màn hình gợi ý trong `FINSUCCESS · FCC Fast Cash Connect.html`, nội dung lấy từ `document/REPPORT_FINSUCCESS.md` và `document/SPEC_FCC_MVP.md`.

> Mọi số liệu là **dữ liệu minh họa**, chưa có backend: không có đăng nhập, cơ sở dữ liệu hay kết nối ngân hàng thật.

## Chạy thử

Cần Node.js ≥ 20.9.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Bản build production:

```bash
npm run build && npm start
```

Mở `http://localhost:3000`, chọn vai trò ở trang đầu, hoặc chuyển vai trò ngay trên thanh trên cùng.

## Bản đồ màn hình

| Vai trò | Đường dẫn | Nội dung chính |
| --- | --- | --- |
| Giới thiệu | `/` | Chọn vai trò, quy trình 6 bước, cam kết an toàn |
| Nhà cung cấp | `/supplier` | Vốn lưu động hôm nay, cảnh báo thanh khoản, dự báo số dư 7/30 ngày, AI đề xuất tài trợ, việc cần làm |
| | `/supplier/invoices` | Vòng đời hóa đơn (lọc theo giai đoạn), tìm kiếm, chi tiết + timeline |
| | `/supplier/invoices/upload` | Kéo thả tệp, OCR/AI, trường độ tin cậy thấp phải xác nhận, kiểm tra chống gian lận |
| | `/supplier/funding` | Hồ sơ tài trợ: TSBĐ (có/không), chấm điểm 5C, phân loại (i)/(ii)/(iii), ước tính hạn mức |
| | `/supplier/marketplace` | So sánh 6 gói, tính thực nhận/chi phí theo từng hóa đơn, gói “chưa phù hợp” kèm lý do, lấy báo giá ≤ 3 tổ chức, đồng ý chia sẻ |
| | `/supplier/disbursement` | Vòng tuần hoàn 11 bước, phân bổ 2 tỷ, các lớp bảo vệ thu hồi, EWS |
| Người mua | `/buyer` | Phải trả, lịch thanh toán 8 tuần, đề xuất trả sớm, nhà cung cấp chiến lược |
| | `/buyer/invoices` | Xác nhận hóa đơn (đối chiếu 3 chiều, hoàn tác), chiết khấu thanh toán sớm |
| | `/buyer/marketplace`, `/buyer/esg` | Chương trình tài trợ nhà cung cấp; ESG chuỗi cung ứng |
| Tổ chức tài chính | `/lender` | Danh mục, luồng hồ sơ, dư nợ theo ngành, hạng tín dụng & ESG |
| | `/lender/appraisal` | Hàng đợi thẩm định, 5C, ESG + độ bao phủ + cờ, quyết định (sửa được, hoàn tác) |
| | `/lender/monitoring` | Cảnh báo sớm theo mức độ, đề xuất xử lý, lịch thu hồi |
| | `/lender/marketplace` | Mặt bằng lãi suất, gói của mình (tạm dừng/mở), chính sách ưu đãi ESG |
| Quản trị | `/admin` | KPI nền tảng, doanh thu 6 nguồn, bảo mật & gian lận, người dùng, ma trận RBAC |
| Dùng chung | `/{vai-trò}/esg`, `/accounting`, `/settings` | ESG 18 chỉ tiêu (có mô phỏng), kế toán & CCC, cài đặt/chia sẻ dữ liệu/Audit Trail |

## Điểm “thông minh & gần gũi” so với bản gợi ý

- **Trợ lý FCC** (nút ở sidebar và các nút “Giải thích”, “Vì sao…?”): trả lời theo vai trò bằng dữ liệu trên màn hình, có câu hỏi gợi ý và liên kết tới màn hình liên quan. Trong bản mock, trợ lý trả lời theo quy tắc, chưa gọi mô hình AI.
- **Giải thích thuật ngữ**: các chữ gạch chân chấm (DSO, DSCR, LTV, TSBĐ, 5C, CIC, Coverage, EWS…) hiện lời giải thích ngắn khi rê chuột hoặc focus bàn phím.
- **Việc cần làm hôm nay**: mỗi việc có lối tắt tới đúng màn hình xử lý.
- **Marketplace tính ngay**: đổi hóa đơn thì số tiền thực nhận, lãi, phí và chi phí hiệu dụng của mọi gói cập nhật theo công thức SPEC mục 6.3.
- **Mô phỏng ESG**: bấm vào mức của từng chỉ tiêu để xem điểm, hạng và ưu đãi thay đổi ra sao (không đổi điểm chính thức).
- **Rào chắn an toàn**: trường OCR độ tin cậy thấp phải được xác nhận; gửi hồ sơ cần đồng ý chia sẻ; hồ sơ nhóm (iii) không có nút phê duyệt; mọi quyết định có hoàn tác.
- **Tuân thủ nguyên tắc SPEC 1.2**: ghi chú “Xếp hạng tham khảo FCC — không phải quyết định tín dụng”, “Ước tính theo biểu giá công bố, không phải báo giá”, “Dự báo – không phải cam kết”.
- **Responsive**: sidebar thành ngăn kéo trên di động, bảng cuộn ngang trong khung, không cuộn ngang cả trang. Có focus ring, skip link, `prefers-reduced-motion`.

## Design system

Lấy nguyên tông màu và kiểu chữ của bản gợi ý; token nằm trong `src/app/globals.css`.

| Nhóm | Giá trị |
| --- | --- |
| Thương hiệu | `--brand #0B6B53`, `--forest #0E2A23` (sidebar, thẻ AI), `--lime #DDF1C4` (điểm nhấn) |
| Nền / chữ | `--bg #EEF2EF`, `--surface #FFF`, `--ink #10201B`, `--ink-3 #5E6E67` |
| Trạng thái | ok `#0A5A45`, warn `#7A4300`, bad `#9A1C13`, info `#1A4F96`, gold `#5E4700` |
| Font | Be Vietnam Pro (chữ), IBM Plex Mono (số, mã hóa đơn) |
| Bo góc | thẻ 14px, nút/ô nhập 10px |

## Cấu trúc mã

```
src/
  app/                 # Route theo vai trò (App Router, Next.js 16)
  components/
    shell/AppShell     # Topbar, chuyển vai trò, thông báo, sidebar/drawer
    assistant/         # Trợ lý FCC (ngữ cảnh + luật trả lời)
    screens/           # Các màn hình tương tác (client components)
    charts/            # Biểu đồ dự báo dòng tiền (SVG, không thư viện)
    ui/                # Thành phần nhỏ: Kpi, Term, Stepper, TodoTiles…
  lib/
    data.ts            # Dữ liệu minh họa + công thức ước tính chi phí, ESG
    glossary.ts        # Từ điển thuật ngữ
    roles.ts           # Vai trò, người dùng mẫu, menu
```

## Để tiến tới MVP thật (theo SPEC)

1. Thay `lib/data.ts` bằng API thật (Route Handlers hoặc backend riêng) và xác thực theo tổ chức (`active_org_id`, MFA).
2. Vòng đời khoản phải thu theo SPEC 8.2 (`DRAFT → … → SETTLED`) với Audit Trail và khóa chống tài trợ trùng.
3. Bộ chấm điểm 5C và ESG có phiên bản, độ bao phủ, cờ knock-out (SPEC mục 4–5).
4. Kết nối hóa đơn điện tử / phần mềm kế toán ở chế độ chỉ đọc (SPEC 7.2) cho dự báo dòng tiền.
5. Trợ lý FCC: chuyển sang mô hình AI chỉ diễn giải reason code và số liệu có nguồn, không tự suy ra số.
