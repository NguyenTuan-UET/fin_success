# OCR Lab — Running log

Ngày chạy: 12/10/2026. Máy: Windows 11, Python 3.13, CPU (RTX 3050 có nhưng dùng torch bản CPU). Mục tiêu: kiểm tra pipeline OCR (RapidOCR tìm vùng chữ + VietOCR nhận dạng) → trích trường bằng quy tắc → so với đáp án nhập tay.

## Cấu trúc thư mục

```
ocr_lab/
  vietocr/            bản clone https://github.com/pbcquoc/vietocr (bỏ .git)
  venv/               môi trường Python cô lập (torch CPU, vietocr, rapidocr, onnxruntime)
  cache/              trọng số (vgg_transformer.pth), TORCH_HOME, log cài đặt
  invoices/           10 hóa đơn thử (2 do Giang cung cấp + 8 tải thêm)
  expected_output/    đáp án nhập tay (*.expected.xml)
  output/             kết quả chạy: <tên>.txt (OCR), <tên>.xml (trường trích), _compare*.json, _run_stats.json
  scripts/            run_ocr.py, compare.py
  RUNNING_LOG.md      file này
```

Chạy lại: `venv\Scripts\python -I scripts\run_ocr.py` rồi `python -I scripts\compare.py`.

## Lần 0 — Dựng môi trường cô lập
- Clone vietocr vào `ocr_lab/vietocr`; tạo `venv` riêng; cài `torch`/`torchvision` (CPU), `vietocr` (cần `PYTHONUTF8=1` trên Windows), `rapidocr`, `onnxruntime`.
- Trọng số `vgg_transformer.pth` (152 MB) sao chép từ lần thử trước vào `cache/`; `TORCH_HOME` trỏ vào `cache/torch`.
- Hóa đơn của Giang: 2 file sao chép vào `invoices/` (`inv01_goldengate`, `inv02_fpt_dieuchinh`).

## Lần 1 — Tải thêm 8 hóa đơn
- Dùng Chrome qua browser-harness: tìm ảnh Bing Images "hóa đơn điện tử giá trị gia tăng mẫu ảnh", lấy URL ảnh gốc, tải bằng curl vào `invoices/` (ảnh công khai, không cần đăng nhập). Tab Chrome đã đóng sau khi xong.
- Tải 8 file, rồi **thay 2 file** (một ảnh chụp chồng giấy, một ảnh cắt dở) bằng 2 mẫu của Viettel/sinvoice có dữ liệu, vì ảnh đầu không phải một trang hóa đơn đọc được.
- Lưu ý chất lượng bộ mẫu: phần lớn là **mẫu hiển thị trống** của các nhà cung cấp phần mềm, chỉ 5/10 có số liệu thật (inv01, 02, 08, 09, 10; inv02 là hóa đơn điều chỉnh số tiền 0, inv09/10 có dấu MẪU). Nguồn: ubot.vn, thuvienphapluat.vn, luatminhkhue.vn, easyinvoice.vn, giaiphapsohanoi.mobifone.vn, ketoanthienung.net, blogspot của Viettel/sinvoice.

| File | Kích thước ảnh | Nội dung |
| --- | --- | --- |
| inv01_goldengate | 820×1165 | Hóa đơn GTGT từ máy tính tiền, 7 dòng hàng |
| inv02_fpt_dieuchinh | 1080×1590 | Hóa đơn điều chỉnh FPT, dấu NHÁP/MẪU, tiền 0 |
| inv03_ubot_1c21taa | 712×755 | Mẫu trống |
| inv04_tvpl_2022 | 483×759 | Mẫu trống, ảnh nhỏ |
| inv05_luatminhkhue | 721×748 | Mẫu trống ngoại tệ, watermark |
| inv06_easyinvoice_songngu | 763×1200 | Mẫu trống song ngữ, nền hoa văn, QR |
| inv07_mobifone | 597×532 | Mẫu trống, ảnh rất nhỏ |
| inv08_ketoanthienung | 857×1044 | Hóa đơn VNPT có dữ liệu, watermark đỏ đè bảng |
| inv09_viettel_068W023 | 1182×1660 | Có dữ liệu, dấu MẪU, nền họa tiết |
| inv10_viettel_051W000 | 1182×1660 | Cùng nội dung inv09, bố cục có bảng thuế tổng hợp |

## Lần 2 — Đáp án (expected_output)
- Nhập tay từ ảnh, mỗi hóa đơn một file XML: ký hiệu, số, ngày lập, tên và MST bên bán/bên mua, tiền chưa thuế, tiền thuế, tổng thanh toán, tiền bằng chữ, cờ (NHAP, MAU, DIEUCHINH, TRANG = mẫu trống), ghi chú.
- Thẻ rỗng nghĩa là hóa đơn để trống trường đó; kết quả đúng khi hệ thống cũng trả rỗng.
- Hạn chế: đáp án do một người (AI) đọc từ ảnh, chưa có người thứ hai kiểm tra chéo.

## Lần 3 — Chạy OCR
Thời gian trên CPU: 5,9–28,9 giây/ảnh (32–203 vùng chữ); nạp model 1,1 giây (trọng số đã có).

| File | Số vùng | Giây |
| --- | --- | --- |
| inv01 | 203 | 28,9 |
| inv02 | 82 | 19,8 |
| inv03 | 57 | 9,9 |
| inv04 | 32 | 5,9 |
| inv05 | 64 | 8,5 |
| inv06 | 66 | 15,2 |
| inv07 | 52 | 7,4 |
| inv08 | 65 | 20,9 |
| inv09 | 76 | 23,7 |
| inv10 | 115 | 28,8 |

## Lần 4 — So sánh, bản đầu (extractor v1)
Trích trường bằng quy tắc (regex trên văn bản đã bỏ dấu), so từng trường với đáp án. Kết quả: 92 PASS, 2 CLOSE, 9 FAIL, 7 FP trên 110 trường (FP = đáp án để trống nhưng hệ thống trích ra giá trị).

Sau khi xem chi tiết, phần lớn lỗi là **lỗi bộ trích trường, không phải lỗi OCR**:
- Nhãn kế tiếp bị lấy làm giá trị (ví dụ "Tên đơn vị (Company)." thành tên người mua).
- Nhầm "Số 125 đường…" trong địa chỉ với số hóa đơn.
- Ô số bị tách bằng ký tự `|`; chú thích `(year)` bị OCR đọc thành `(vear)`; MST in cách chữ số có ký tự ngăn cách hai ký tự; số 0 bị OCR đọc thành chữ `o`; tên người mua nhầm với "Họ tên người mua" (người đại diện) thay vì tên đơn vị.

## Lần 5 — Sửa extractor (v2) và chạy lại
Các sửa: lọc giá trị rỗng/giống nhãn; ưu tiên "Tên đơn vị" trước "Tên người mua"; số hóa đơn yêu cầu dấu `:`/`.`/`(No)` đi kèm; chấp nhận ngăn cách `|`; chú thích ngoặc bất kỳ ở ngày; MST cho phép nhiều ký tự ngăn cách; `o` đứng riêng trong hàng tổng tiền hiểu là 0.

**Kết quả cuối (v2): 107 PASS, 1 CLOSE, 2 FAIL, 0 FP trên 110 trường.**
- Chỉ xét 71 trường có giá trị trong đáp án: 68 PASS, 1 CLOSE, 2 FAIL (96%). 39 trường đáp án để trống đều trả rỗng đúng.
- Chỉ xét 5 hóa đơn có dữ liệu: 51/52 trường đúng.
- Theo trường (số trường đúng/số trường có đáp án): KyHieu 10/10, NgayLap 9/9, NBan_MST 6/6, NMua_MST 4/4, NMua_Ten 4/4, TgTCThue 5/5, TgTThue 5/5, TgTTTBSo 5/5, TgTTTBChu 5/5, NBan_Ten 8/9, So 7/9.
- Cờ (NHAP/MAU/DIEUCHINH/TRANG): đúng 7/10 hóa đơn.

### Lỗi còn lại và nguyên nhân (đều là lỗi OCR hoặc phát hiện dấu, không phải trích trường)
| Hóa đơn | Trường | Đáp án | Kết quả | Nguyên nhân |
| --- | --- | --- | --- | --- |
| inv06 | So | 0000000 | 00000000 | OCR đọc thừa một chữ số 0 |
| inv10 | So | 0000000 | 00000000 | OCR đọc thừa một chữ số 0 |
| inv07 | NBan_Ten | CÔNG TY TNHH A | CONG TY TNH A | OCR đọc thiếu chữ H (ảnh 597×532, chữ nhỏ) |
| inv02 | Cờ | NHAP, MAU, DIEUCHINH | DIEUCHINH, MAU | Dấu "HÓA ĐƠN NHÁP" không được đọc ra |
| inv06 | Cờ | MAU, TRANG | MAU | Khối "Mẫu" ở phần ký nhận ra, nhưng bộ phát hiện mẫu trống không kích hoạt vì đọc được MST |
| inv09 | Cờ | MAU | (không có) | Dấu MẪU đỏ đè lên bảng không được đọc ra |

Lỗi cũ từ lần thử trước vẫn còn: inv02 tên người mua ở một dòng bị đọc "HOÀNG CHIẾU" (dòng thứ hai đúng nên bộ trích lấy được "HOÀNG MINH"); dòng điều chỉnh "ký hiệu C26MHB … năm 2026" bị OCR vỡ do con dấu đè (không nằm trong 11 trường đang chấm).

## Kết luận và giới hạn
1. Với ảnh sạch, pipeline đọc đúng các trường định danh và số tiền trên 5 hóa đơn có dữ liệu (51/52). Lỗi còn lại là chữ số thừa/thiếu và dấu/con dấu đè chữ.
2. **Kết quả không phản ánh khả năng tổng quát hóa:** bộ trích trường được sửa sau khi đã thấy lỗi trên chính 10 ảnh này, nên 96% là con số *sau khi tinh chỉnh trên bộ thử*. Cần bộ ảnh mới chưa dùng để chỉnh để đo thật.
3. 5/10 ảnh là mẫu trống nên trường để trống chiếm 39/110 ô; điểm "PASS" ở các ô này dễ. Số liệu đáng tin hơn là 68/71 (trường có giá trị).
4. Cột `in_ocr` (đáp án có nằm trong văn bản OCR không) là 70/71 nhưng **bị thổi phồng** với trường `So` (chuỗi 0000000 nằm trong 00000000) nên không dùng làm bằng chứng.
5. Chưa đo: ảnh chụp nghiêng/nhăn/mờ, ảnh thật từ doanh nghiệp, PDF scan, XML, GPU, engine OCR thứ hai, LLM đọc lại, tính nhạy với mẫu hóa đơn khác bố cục.
6. Dấu NHÁP/MẪU/ĐIỀU CHỈNH đè chữ chưa được nhận diện ổn định → cần bước riêng (phát hiện dấu bằng màu/hình dạng hoặc LLM vision) như đã nêu ở `ADVISE_LOG.md`.
7. Hóa đơn mẫu tải về chỉ dùng để thử kỹ thuật, không phải hóa đơn thật; không chứa dữ liệu khách hàng của FCC.
