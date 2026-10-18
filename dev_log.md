# Dev log — 19/10/2026

Tóm tắt công việc trong ngày: (A) xử lý báo cáo đánh giá `document/Bao_cao_danh_gia_FCC_Fin_Success.docx`, (B) bổ sung kiểm thử theo mục 16 của báo cáo, (C) khắc phục phản hồi của người dùng thử trong `document/test/`.

## Trạng thái commit

| Commit | Nội dung |
|---|---|
| `3a2f52c` | Hoàn thiện demo theo báo cáo đánh giá (điểm thiếu dữ liệu, landing, MFA, nhật ký, quản trị) |
| `8505537` | Cập nhật README_SU_DUNG theo menu quản trị mới |
| `133bd68` | Kiểm thử T02/T06/T09/T11/T12 và sửa lỗi phát hiện |
| (commit này) | Phần C: khắc phục phản hồi người dùng thử |

Chưa push. Các thay đổi có từ trước, không thuộc phần việc này: `server/.env.production`, `document/SPEC_FCC_MVP.md` (đang bị xóa), `document/test/`, tệp báo cáo `.docx`.

---

## A. Xử lý báo cáo đánh giá (commit `3a2f52c`, `8505537`)

- **F04 – điểm khi thiếu dữ liệu:** ESG, xếp hạng người mua không gán điểm/mức khi chưa có chỉ tiêu xác minh hoặc bao phủ thấp ("Chưa đủ dữ liệu").
- **F04 – landing:** T+1, "1–2 ngày", ví dụ 5,9% gắn nhãn mục tiêu/minh họa kèm giả định; bỏ các tuyên bố chưa có (eKYC, chữ ký số, huy hiệu AES-256).
- **F05 – MFA:** bắt buộc cho xác minh tổ chức, duyệt sản phẩm, mời thành viên, đổi vai trò; thêm test.
- **F05 – nhật ký:** màn hình nhật ký của FCC ẩn số tiền, lãi suất, kết quả chấm điểm của tổ chức khác (bản ghi gốc và chuỗi băm không đổi).
- **F08 – quản trị tách trang:** Việc cần xử lý, Thành viên & quyền (ma trận quyền theo loại tổ chức + vai trò + giới hạn), Tổ chức, Doanh thu & biểu phí, Nhật ký kiểm toán (lọc, phân trang).
- **KPI vận hành:** hiển thị tử số/mẫu số; dưới 5 mẫu ghi "Không đủ dữ liệu".
- **So sánh gói:** tách lãi/phí, nêu cơ sở tính (365 ngày, lãi cuối kỳ) và nguyên tắc xếp hạng không theo hoa hồng.
- **Nguồn dữ liệu:** trạng thái "chưa cấu hình nguồn", khóa biểu mẫu tra cứu khi chưa có nguồn.
- Nhãn "Ngân hàng giả lập · không có giao dịch tiền thật" trên thanh bên.

## B. Kiểm thử theo mục 16 báo cáo (commit `133bd68`)

| Mã | Nội dung | Kết quả |
|---|---|---|
| T02 | Truy cập chéo giữa tổ chức (đọc/sửa/hủy/gửi tài trợ, tải tệp) | Đạt sau khi sửa lỗi bên dưới |
| T06 | Đồng thời: gửi hồ sơ, chọn báo giá, giải ngân | Đạt (không tạo trùng) |
| T09 | Sự kiện tiền lặp, sai thứ tự, ký sai, tiền không về đúng tài khoản | Đạt |
| T11 | Sao lưu rồi khôi phục vào CSDL tạm; `restore-check.sh` báo tuổi bản sao lưu và cảnh báo thiếu kho tệp | Đạt |
| T12 | Mobile 360/430px, axe WCAG 2 A/AA, bàn phím, lỗi form | Đạt sau khi sửa |

Lỗi thật đã sửa:
1. FCC lấy được URL tải chứng từ hóa đơn nếu biết khóa tệp → chỉ còn KYC và bằng chứng ESG.
2. Mọi trang tràn ngang 73–168px ở 360px; 34 bảng cuộn ngang không dùng được bằng bàn phím; ô chọn tháng phí thiếu nhãn.

Test mới: `server/tests/concurrency.test.ts`, `web/e2e/a11y.spec.ts`, bổ sung `identity.test.ts`, `e2e.test.ts`.

## C. Khắc phục phản hồi người dùng thử (`document/test/`) — chưa commit

### Lỗi nghiệp vụ
- **F01:** thêm hỏi lại định kỳ 5 giây làm dự phòng SSE; bên mua thấy phiên bản và thời điểm cập nhật; server trả 409 nếu xác nhận phiên bản đã bị thay thế (`buyerDecision` nhận `version`).
- **F02/F03:** `viewFor` không trả bản nháp (`DRAFT`, hủy trước khi gửi) cho ai ngoài bên bán; thêm `Receivable.sentAt`.
- **F04:** `packages/domain/src/taxcode.ts` — kiểm tra định dạng MST, gợi ý (không tự gán) tổ chức gần khớp.
- **F05/F06:** OCR đọc hạn thanh toán in trên chứng từ, không tự cộng 60 ngày; nhãn nguồn từng trường thay cho "tin cậy 100%".
- **F07/F17:** câu hỏi "nên tài trợ hóa đơn nào" trả lời bằng quy tắc (`fundingAdvice`), cùng điều kiện với nút gửi tài trợ; nút ở dashboard không tự gửi câu hỏi.
- **F08/F14/F15/F16:** chứng từ hiển thị "Chưa có / Đã tải lên — chưa đối chiếu nội dung"; xem bản gốc; bổ sung chứng từ (`attachDocuments`, `POST /v1/receivables/{id}/documents`); lịch sử điều chỉnh (`Receivable.revisions`); bên mua xem được chứng từ của hóa đơn đã gửi.

### Giao diện và thao tác
- **F09/F30:** thay `prompt()` bằng hộp thoại ứng dụng (`providers/Dialog.tsx`); FCC xem đầy đủ sản phẩm trước khi duyệt.
- **F10:** menu đóng không nhận Tab; focus vào menu khi mở, về nút mở khi đóng.
- **F11/F19/F21/F22:** `ui/Fields.tsx` — ô tiền (báo lỗi số âm, phân nhóm), ô ngày (dòng đọc lại), chọn tệp tiếng Việt.
- **F13:** tiến trình hóa đơn theo sự kiện thật (Hoàn tất / Đang ở bước này / Chưa bắt đầu).
- **F18:** biểu mẫu sản phẩm báo lỗi tại từng trường, giữ dữ liệu, focus trường sai đầu tiên.
- **F20/F29:** khoản chi định kỳ có nhãn đầy đủ; dự báo ghi "theo các khoản đã khai", cảnh báo chưa khai chi định kỳ, cho đặt mức dự trữ.
- **F23/F24:** lời chào dùng tên đầy đủ; mã kỹ thuật đổi sang nhãn tiếng Việt.
- **F25:** bảng bên mua dạng thẻ trên màn hẹp.
- **F26/F27:** menu "Kế toán được chia sẻ" (kèm danh sách thật), "Hồ sơ FCC & chia sẻ".

### Kế toán (`Phần mục kế toán.docx`)
- Thanh tuổi nợ → thanh xếp chồng theo tỷ trọng kèm bảng số chứng từ, số tiền, %.
- KPI tiền hiển thị số chính xác, dạng rút gọn ở dòng phụ.
- Nhập công nợ không bắt buộc đúng file mẫu: tự nhận cột (`lib/ledgerImport.ts`), ghép cột, xem trước, báo lỗi theo dòng, ngày dd/mm/yyyy; thêm nút "Thêm từng khoản".
- Bố cục: khoản lớn nhất 90 ngày và ngân hàng & dự báo xếp hai ô cùng hàng.

### Kiểm thử
- Mới: `server/tests/feedback.test.ts`, `packages/domain/tests/taxcode.test.ts`, `web/e2e/feedback.spec.ts`; sửa `flow.spec.ts` (nút "Xác nhận v1"), `a11y.spec.ts`.
- Kết quả: server 92, domain 42, sim-bank 5, e2e 2 + 5 + 4 đều qua; `tsc` và `eslint` web sạch.
- Chạy trên CSDL tạm `fcc_review` (đã xóa), cổng 8797/3010; server cổng 8787 của người dùng không bị đụng tới.

## Chưa làm

- **Hồ sơ dự thi và pháp lý (không thuộc mã nguồn):** F01–F03, F06, F09, F10 của báo cáo (đổi nội dung trang 40/63/65, hợp nhất mô hình tài chính, rà soát pháp lý, xác minh giấy phép bên tài trợ, gắn nhãn thật/giả lập, LOI từ anchor và bên tài trợ). Hồ sơ PDF 79 trang chưa có trong repo.
- **F0 (người dùng thử):** "giao diện còn AI, khó dùng" — nhận xét chung, cần ví dụ màn hình cụ thể.
- **OCR ảnh thật:** chưa thử vì phải gửi ảnh ra dịch vụ AI ngoài; mới có test XML và unit test.
- **Trình đọc màn hình thật (NVDA/VoiceOver)** và thời gian tải trên production: chưa đo (mới đo trên server dev).
- **Sao lưu:** bản duy nhất trong `backups/` cũ 56 giờ và thiếu kho tệp; cần lên lịch `backup.sh` hằng ngày.
