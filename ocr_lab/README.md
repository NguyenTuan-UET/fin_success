# fcc-ocr-lab

Thử nghiệm OCR hóa đơn cho FCC: RapidOCR tìm vùng chữ, VietOCR (https://github.com/pbcquoc/vietocr, Apache-2.0) nhận dạng, bộ trích trường bằng quy tắc ghi ra XML, rồi so với đáp án nhập tay.

Kết quả ngày 12/10/2026 trên 10 hóa đơn: 107/110 trường đúng (68/71 nếu chỉ tính trường có giá trị trong đáp án). Con số này đã qua tinh chỉnh trên chính bộ thử nên chưa phản ánh khả năng tổng quát hóa. Chi tiết: `RUNNING_LOG.md`, `docs/BAO_CAO_THU_NGHIEM_OCR.docx`.

## Cấu trúc
- `invoices/`: 10 hóa đơn thử. inv01, inv02 do người dùng cung cấp; inv03-inv10 là mẫu công khai tải từ web (nguồn trong RUNNING_LOG.md). Không chứa dữ liệu khách hàng FCC.
- `expected_output/`: đáp án nhập tay (XML, thẻ rỗng = trường để trống trên hóa đơn).
- `output/`: văn bản OCR (.txt), XML trích trường (.xml), `_compare.json` (kết quả cuối), `_compare_v1.json` (bản đầu), `_run_stats.json`.
- `scripts/run_ocr.py`, `scripts/compare.py`.

## Chạy lại (Windows)
```
python -m venv venv
venv\Scripts\python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
set PYTHONUTF8=1
venv\Scripts\python -m pip install -r requirements.txt
mkdir cache
venv\Scripts\python -I scripts\run_ocr.py      # lần đầu tự tải trọng số vgg_transformer.pth vào cache/
python -I scripts\compare.py
```
`PYTHONUTF8=1` cần thiết để cài vietocr trên Windows (setup.py đọc README tiếng Việt).

## Hạn chế
Đáp án do một người đọc từ ảnh; 5/10 ảnh là mẫu trống; chưa thử ảnh chụp nghiêng/mờ, PDF scan, GPU, engine OCR thứ hai. Dấu NHÁP/MẪU đè chữ chưa nhận diện ổn định.
"# ocrtest" 
