# FCC — đặc tả triển khai MVP vận hành thật

**Phiên bản:** 2.0 · **Ngày:** 12/10/2026 · **Trạng thái:** Bản để thiết kế, ước lượng và triển khai thử nghiệm có kiểm soát

**Thay đổi so với 1.0:** mở rộng phạm vi theo bản demo (báo cáo trang 26–41, `DEMO_FINSUCCESS.html`): nền tảng ba bên (bên mua, bên bán, tổ chức tài chính); bổ sung **chấm điểm doanh nghiệp**, **chấm điểm ESG bằng AI**, **Marketplace tài chính**, **Tổng quan theo vai trò** và **dự báo dòng tiền qua kết nối phần mềm kế toán**; bổ sung lớp thu thập dữ liệu (vnstock cho bên mua niêm yết, crawl có kiểm soát cho SME). Giữ nguyên các nguyên tắc an toàn của 1.0: FCC không giữ tiền, không cho vay, không tự quyết định tín dụng và không hiển thị số liệu giả lập như số liệu thật.

Tài liệu nguồn trong `document/`: `REPPORT_FINSUCCESS.md` (mô tả sản phẩm và cơ chế giải ngân/thu hồi), `DEMO_FINSUCCESS.html` (giao diện tham chiếu), `Phương pháp đánh giá tín dụng SME theo mô hình 5C.md`, `Khung chấm điểm ESG cho SMEs vay vốn FCC.md`.

## 1. Mục tiêu, phạm vi và nguyên tắc

FCC (Fast Cash Connect) là nền tảng số kết nối **bên mua** (doanh nghiệp đầu chuỗi, gồm doanh nghiệp niêm yết), **bên bán** (nhà cung cấp/gia công SME) và **tổ chức tài chính** (ngân hàng, công ty tài chính, quỹ). FCC biến khoản phải thu B2B đã được bên mua xác nhận thành hồ sơ tài trợ có **điểm tín dụng** và **điểm ESG** để tổ chức tài chính chào sản phẩm qua **Marketplace**. Tổ chức tài chính tự thẩm định, ra quyết định, ký hợp đồng, giải ngân và thu hồi.

### 1.1. Các phân hệ và mức ưu tiên

| Ưu tiên | Phân hệ (menu demo) | Nội dung MVP |
| --- | --- | --- |
| **P1** | Chấm điểm doanh nghiệp (hiển thị trong Tổng quan, Hóa đơn, Marketplace) | Điểm tín dụng tham khảo cho bên bán, bên mua và từng khoản phải thu theo 5C + dữ liệu thay thế; có giải thích (Mục 4) |
| **P1** | ESG & Xanh | Chấm 18 chỉ tiêu ESG; AI trích xuất bằng chứng và đề xuất mức điểm, người thẩm định xác nhận; liên kết ưu đãi xanh do đối tác công bố (Mục 5) |
| **P1** | Marketplace | Danh mục sản phẩm tài trợ do tổ chức tài chính công bố, khớp sản phẩm theo khoản phải thu/điểm/ESG, yêu cầu báo giá cạnh tranh, chương trình thanh toán sớm của bên mua (Mục 6) |
| **P1** | Tổng quan | Dashboard riêng cho từng vai trò, số liệu tính từ dữ liệu thật (Mục 7.1) |
| **P2** | Tổng quan → Dự báo dòng tiền; Kế toán | Kết nối phần mềm kế toán/hóa đơn điện tử của doanh nghiệp (chỉ đọc) để lấy phải thu/phải trả, số dư, BCTC và dự báo dòng tiền 7/30/90 ngày (Mục 7.2–7.4) |
| Nền tảng | Hóa đơn, Cài đặt | Hóa đơn/khoản phải thu, xác nhận bên mua, chia sẻ dữ liệu, gửi hồ sơ, đối soát (Mục 8); cấu hình tài khoản, kết nối, MFA, quản lý đồng ý |
| Nền tảng | Thu thập dữ liệu | vnstock cho bên mua niêm yết; crawl nguồn công khai cho SME; nhập dữ liệu do doanh nghiệp đồng ý chia sẻ (Mục 9) |

**Ngoài phạm vi MVP:** giữ tiền hoặc luồng tiền qua tài khoản FCC; blockchain; LC; bảo hiểm; FCC làm phần mềm kế toán tổng hợp (FCC chỉ đọc dữ liệu kế toán); ghi ngược vào ERP; định giá tài sản bảo đảm có giá trị pháp lý; ứng dụng di động; chatbot. Các mục này để sau pilot.

### 1.2. Nguyên tắc bắt buộc

1. **Điểm của FCC là tham khảo.** Điểm tín dụng và ESG là đầu vào cho tổ chức tài chính, không phải phê duyệt, hạn mức hay cam kết giá. Mọi màn hình ghi rõ “Xếp hạng tham khảo FCC — không phải quyết định tín dụng”.
2. **Giá do đối tác công bố.** Lãi suất, phí và tỷ lệ ứng trước trên Marketplace chỉ lấy từ sản phẩm do tổ chức tài chính đăng và còn hiệu lực. Ưu đãi xanh (ví dụ “–0,7%”) và SLA (ví dụ “phê duyệt 24 giờ”) chỉ hiển thị khi đối tác cấu hình. Không có thì ghi “Chưa có báo giá”.
3. **AI đề xuất, con người quyết định, công thức tính điểm cố định.** LLM/OCR trích xuất dữ liệu, gợi ý mức điểm và giải thích. Điểm cuối cùng do bộ chấm điểm có phiên bản tính ra theo quy tắc xác định; chạy lại trên cùng đầu vào phải ra cùng kết quả.
4. **Thiếu dữ liệu không phải điểm 0 và không phải điểm trung bình.** Ghi “Chưa xác minh”, báo độ bao phủ dữ liệu và khoảng điểm thấp nhất–cao nhất; cờ rủi ro nghiêm trọng không bị điểm bình quân che lấp.
5. **Mọi số liệu có nguồn.** Mỗi giá trị hiển thị lưu được nguồn (doanh nghiệp tải lên, phần mềm kế toán, vnstock, nguồn crawl, đối tác), thời điểm lấy và trạng thái xác minh. Dữ liệu demo hard-code không tồn tại trong môi trường thật.
6. **Chia sẻ theo đồng ý.** Tổ chức tài chính chỉ thấy điểm, hồ sơ và chứng từ của doanh nghiệp khi doanh nghiệp đã đồng ý chia sẻ cho đúng bên nhận, mục đích và thời hạn.

### 1.3. Kết quả cần chứng minh trong pilot

1. Hệ thống chấm được điểm tín dụng tham khảo cho bên bán SME, bên mua (niêm yết và chưa niêm yết) và khoản phải thu. Mỗi điểm có lý do tăng/giảm, độ bao phủ dữ liệu và nguồn. Cán bộ tổ chức tài chính đánh giá điểm này là hữu ích khi thẩm định.
2. Từ bộ chứng từ doanh nghiệp tải lên, AI đề xuất mức 0–4 cho 18 chỉ tiêu ESG kèm trích dẫn bằng chứng; người thẩm định xác nhận/sửa; hệ thống tính lại đúng ví dụ chuẩn của khung (66,67/100).
3. Tổ chức tài chính tự đăng sản phẩm; nhà cung cấp thấy sản phẩm phù hợp với khoản phải thu đã được xác nhận, kèm chi phí ước tính từ biểu giá công bố; gửi yêu cầu báo giá tới tối đa 3 đối tác, chọn 1, và **không thể có hai hồ sơ tài trợ đang hoạt động cho cùng một khoản phải thu**.
4. Tổng quan của ba vai trò chỉ hiển thị số liệu thật; dự báo dòng tiền chạy được trên dữ liệu kế toán đã kết nối của ít nhất một doanh nghiệp pilot.
5. Các kết quả của 1.0 vẫn đạt: tạo hồ sơ từ hóa đơn, bên mua xác nhận/tranh chấp, không gửi trùng, mọi thay đổi có dấu vết, đối soát giải ngân/thanh toán theo dữ liệu đối tác.

## 2. Chủ thể và quyền

| Vai trò | Quyền chính | Giới hạn |
| --- | --- | --- |
| Bên bán: owner | Quản lý tổ chức, mời nhân sự, tạo/sửa hồ sơ nháp, khai ESG, xem điểm của mình, gửi yêu cầu báo giá, chọn đối tác, cấp/thu hồi quyền chia sẻ | Không tự xác nhận nghĩa vụ của bên mua, không sửa điểm hoặc hồ sơ đã gửi |
| Bên bán: operator | Tải chứng từ/bằng chứng ESG, lập hồ sơ, xem tiến độ | Không chấp thuận chia sẻ dữ liệu, điều khoản hoặc báo giá |
| Bên mua: owner/approver | Xác nhận số tiền, nghĩa vụ, hạn thanh toán hoặc nêu tranh chấp; tạo chương trình thanh toán sớm; xem ESG chuỗi cung ứng (dữ liệu nhà cung cấp đã đồng ý chia sẻ) | Không sửa hóa đơn, không phê duyệt tín dụng, không xem điểm tín dụng chi tiết của nhà cung cấp nếu chưa được chia sẻ |
| Tổ chức tài chính: product manager | Tạo/sửa/ngừng sản phẩm trên Marketplace, cấu hình tiêu chí, biểu giá, ưu đãi xanh, SLA | Sản phẩm qua FCC operations kiểm tra trình bày trước khi công khai |
| Tổ chức tài chính: analyst | Xem hồ sơ/điểm được chia sẻ, trả báo giá, yêu cầu bổ sung, ghi quyết định và điều kiện, ghi nhận xét về điểm | Chỉ thấy hồ sơ gửi tới tổ chức mình |
| FCC: credit/ESG reviewer | Rà soát đề xuất của AI, xác nhận mức chỉ tiêu ESG, xử lý cờ dữ liệu, phát hành điểm chính thức | Không chấm hồ sơ có xung đột lợi ích; mọi sửa đổi phải có lý do |
| FCC: model owner | Quản lý phiên bản bộ chấm điểm, ngưỡng, bảng ngành, prompt/mô hình AI | Thay đổi có hiệu lực sau phê duyệt hai người; không sửa kết quả đã phát hành |
| FCC: operations | Xử lý ngoại lệ, đối soát, duyệt sản phẩm Marketplace, quản lý nguồn dữ liệu, khóa hồ sơ nghi ngờ | Không thay bên mua xác nhận, không thay đối tác quyết định tín dụng |
| FCC: auditor | Xem nhật ký và bằng chứng theo phạm vi được cấp | Chỉ đọc; mọi lần truy cập có lý do và được ghi log |

Một người có thể thuộc nhiều tổ chức, nhưng mỗi phiên thao tác có `active_org_id`. Mọi truy vấn lọc theo tổ chức và quyền trên từng bản ghi. Hành động nhạy cảm (chia sẻ dữ liệu, chọn báo giá, phát hành điểm, đổi phiên bản bộ chấm điểm) cần xác thực lại hoặc MFA. Bộ chuyển vai trò trên topbar của demo được thay bằng **chuyển tổ chức đang hoạt động**: người dùng chỉ thấy giao diện của vai trò mà tổ chức đó có.

## 3. Bản đồ màn hình theo demo

Giao diện giữ bố cục demo: topbar (logo, tổ chức đang hoạt động, ngày, người dùng), sidebar *Tổng quan · Hóa đơn · Marketplace · ESG & Xanh · Kế toán · Cài đặt*, vùng nội dung theo vai trò. Mỗi chỉ số của demo được định nghĩa lại như sau. Khi chưa có dữ liệu thì hiển thị trạng thái rỗng kèm hướng dẫn (ví dụ “Kết nối phần mềm kế toán để xem dự báo”), không hiển thị số mẫu.

| Vai trò · trang | Thành phần trong demo | Định nghĩa trong hệ thống thật |
| --- | --- | --- |
| Bên mua · Tổng quan | Tổng phải trả, số hóa đơn đến hạn | Tổng nghĩa vụ đã xác nhận chưa thanh toán; nếu đã kết nối kế toán thì đối chiếu với số dư TK phải trả |
| | Chiết khấu sớm | Tổng chiết khấu có thể nhận từ các đề nghị thanh toán sớm còn hiệu lực (Mục 6.6) |
| | Vòng quay phải trả | DPO tính từ dữ liệu kế toán; chưa kết nối thì tính trên hóa đơn trong FCC và ghi rõ phạm vi |
| | Nhà cung cấp đang hoạt động | Số nhà cung cấp có giao dịch trong 90 ngày |
| | Đề xuất AI | Gợi ý theo quy tắc (ví dụ thanh toán sớm hóa đơn có chiết khấu khi dự báo tiền dư), có lý do và nút bỏ qua |
| | ESG – Chuỗi cung ứng | Điểm ESG bình quân của nhà cung cấp có điểm chính thức, gia quyền theo giá trị mua 12 tháng; tỷ lệ “nhà cung cấp xanh” (Mục 5.5) |
| Bên bán · Tổng quan | Khoản phải thu, số hóa đơn chưa thanh toán | Tổng khoản phải thu mở; tách đã/chưa được bên mua xác nhận |
| | Thanh toán sớm | Tổng tiền đã nhận sớm trong tháng từ sự kiện giải ngân của đối tác và thanh toán sớm của bên mua |
| | Hạn mức tài trợ | Tổng hạn mức **do tổ chức tài chính cấp và gửi về**; không có thì ghi “Chưa có hạn mức” |
| | Điểm tín dụng (AA, +1 bậc) | Xếp hạng tham khảo FCC mới nhất và thay đổi so với kỳ trước (Mục 4) |
| | Đề xuất AI / Cơ hội tài trợ | Top sản phẩm khớp trên Marketplace cho khoản phải thu đủ điều kiện, sắp theo chi phí ước tính |
| | Dự báo dòng tiền 7/30 ngày | Mục 7.3; chỉ hiển thị khi đã kết nối kế toán hoặc nhập file |
| TCTC · Tổng quan | Tổng dư nợ, số khoản đang hoạt động | Tổng dư nợ tính từ sự kiện giải ngân/thu hồi của chính tổ chức đó |
| | Lãi suất bình quân | Bình quân gia quyền theo dư nợ của các đề nghị đã giải ngân |
| | Thời gian thẩm định | Trung vị (và p90) từ lúc nhận hồ sơ đến lúc có quyết định |
| | SME được tài trợ | Số doanh nghiệp có giải ngân trong kỳ |
| | Hồ sơ chờ duyệt | Hàng đợi hồ sơ/yêu cầu báo giá kèm xếp hạng FCC, điểm ESG, bên mua |
| | Phân tích AI / Hồ sơ được AI đề xuất | Hồ sơ khớp khẩu vị rủi ro mà tổ chức đã cấu hình trong sản phẩm, có lý do khớp |
| | Phân phối rủi ro theo ngành | Cơ cấu dư nợ theo nhóm ngành VSIC của bên bán |
| Mọi vai trò · Hóa đơn | Bảng mã, NCC, người mua, số tiền, ngày, hạn, ESG, trạng thái | Khoản phải thu theo quyền; cột ESG là điểm chính thức của đối tác giao dịch (hoặc “Chưa có”); trạng thái theo vòng đời ở Mục 8.2 |
| Mọi vai trò · Marketplace | Danh sách tổ chức và lãi suất | Mục 6 |
| Mọi vai trò · ESG & Xanh | Điểm tổng, xếp hạng, E/S/G, tác động ESG | Mục 5 |
| Mọi vai trò · Kế toán | Hóa đơn số, tự động nhập liệu, dự báo dòng tiền, tích hợp | Trạng thái kết nối, đồng bộ, phải thu/phải trả, BCTC đã nhập, dự báo (Mục 7) |
| Mọi vai trò · Cài đặt | Ngôn ngữ, email, ngân hàng, ERP, 2FA | Hồ sơ tổ chức, thành viên, MFA, thông báo, kết nối kế toán/hóa đơn điện tử, tài khoản nhận tiền (chỉ lưu thông tin), quản lý đồng ý chia sẻ |

## 4. Phân hệ A — Chấm điểm doanh nghiệp (P1)

### 4.1. Đối tượng chấm

| Điểm | Áp dụng | Mục đích |
| --- | --- | --- |
| **Điểm bên bán** (SME) | Nhà cung cấp/gia công | Sức khỏe tài chính, uy tín, khả năng thực hiện nghĩa vụ |
| **Điểm bên mua** (anchor) | Bên mua niêm yết (dữ liệu vnstock) hoặc chưa niêm yết (dùng bộ chấm SME) | Khả năng thanh toán đúng hạn khoản phải thu, là nguồn trả nợ thứ nhất trong SCF |
| **Điểm hồ sơ tài trợ** | Từng khoản phải thu | Kết hợp bên mua, bên bán và chất lượng giao dịch để xếp hàng đợi và khớp sản phẩm |

### 4.2. Bộ chấm điểm bên bán v1 — 5C và dữ liệu thay thế

Bộ chấm v1 là **scorecard chuyên gia** (quy tắc và trọng số), không phải mô hình học máy, vì chưa có dữ liệu vỡ nợ để huấn luyện. Tỷ trọng theo thông lệ chấm điểm SME: biến tài chính 40–50%, biến phi tài chính 20–30%, lịch sử tín dụng 20–30%. Mỗi chỉ tiêu quy về 0–100 theo các ngưỡng bên dưới. Đây là **ngưỡng khởi tạo**, cấu hình theo phiên bản và hiệu chỉnh cùng đối tác tài trợ trước pilot.

| Thành phần (trọng số) | Chỉ tiêu | Nguồn chính | Ngưỡng khởi tạo → điểm |
| --- | --- | --- | --- |
| **Character – Uy tín (20%)** | C1. Lịch sử tín dụng 12–36 tháng | Báo cáo CIC do doanh nghiệp tự tra cứu và tải lên, hoặc do đối tác cung cấp | Nhóm 1, không quá hạn: 100 · có quá hạn < 10 ngày: 70 · nhóm 2: 40 · nhóm 3–5: 0 + **cờ** |
| | C2. Tuân thủ thuế | Trạng thái MST (tra cứu công khai), tờ khai/chứng từ nộp thuế | Đang hoạt động, không nợ đọng: 100 · nợ trong hạn/đang gia hạn: 50 · bị cưỡng chế, ngừng hoạt động, bỏ địa chỉ: 0 + **cờ** |
| | C3. Thời gian hoạt động | Đăng ký doanh nghiệp | ≥ 5 năm: 100 · 3–5: 70 · 1–3: 40 · < 1: 10 |
| | C4. Sự kiện pháp lý, xử phạt | Nguồn công khai (Mục 9.2) | Không có: 100 · vi phạm nhỏ đã khắc phục: 60 · vi phạm trọng yếu/tranh chấp lớn đang diễn ra: 0 + **cờ** |
| | C5. Hành vi trên FCC | Tranh chấp, hồ sơ bị trả, chứng từ sai lệch | Chưa có lịch sử: N/A (không phạt) |
| **Capacity – Năng lực trả nợ (35%)** | P1. DSCR | BCTC 2 năm gần nhất/dữ liệu kế toán | ≥ 1,5: 100 · 1,3–1,5: 75 · 1,0–1,3: 40 · < 1,0: 0 |
| | P2. Dòng tiền HĐKD | LCTT/dữ liệu kế toán | Dương 2/2 năm: 100 · 1/2: 50 · âm cả hai: 0 |
| | P3. Tăng trưởng doanh thu | BCTC, hóa đơn điện tử | ≥ 10%: 100 · 0–10%: 70 · –10–0%: 40 · < –10%: 10 |
| | P4. Biên lợi nhuận ròng, ROA | BCTC | So với trung vị ngành trong bảng ngành: trên: 100 · xấp xỉ: 60 · dưới: 30 · lỗ: 0 |
| | P5. Kỳ thu tiền bình quân (DSO) | Kế toán/hóa đơn | So với kỳ hạn thanh toán hợp đồng: ≤ +15 ngày: 100 · +15–45: 60 · > +45: 20 |
| | P6. Đối chiếu doanh thu | Hóa đơn điện tử ↔ BCTC ↔ tờ khai GTGT | Lệch ≤ 10%: 100 · 10–25%: 50 · > 25%: 0 + **cờ bất thường** |
| **Capital – Vốn (15%)** | K1. Nợ phải trả/VCSH | BCTC | ≤ 1: 100 · 1–3: 70 · 3–5: 30 · > 5: 0 (tham chiếu ngưỡng ≤ 3, riêng doanh nghiệp siêu nhỏ ≤ 5) |
| | K2. Hệ số thanh toán hiện hành | BCTC | ≥ 1,5: 100 · 1,2–1,5: 70 · 1,0–1,2: 40 · < 1,0: 10 |
| | K3. Vốn tự có tham gia nhu cầu vốn | Phương án kinh doanh | ≥ 30%: 100 · 15–30%: 60 (nông nghiệp ≥ 10% được coi đạt) · < 15%: 20 |
| **Collateral – Bảo đảm và hỗ trợ tín dụng (15%)** | B1. Chất lượng danh mục phải thu | FCC | Tỷ lệ phải thu đã được bên mua xác nhận × điểm bình quân bên mua |
| | B2. Tài sản bảo đảm khai báo | Doanh nghiệp khai và tải chứng từ sở hữu | Độ phủ = Σ(giá trị khai báo × tỷ lệ tham chiếu: BĐS 70%, máy móc 50%, tồn kho 40%) / nhu cầu vốn. ≥ 100%: 100 · 50–100%: 60 · < 50%: 30 · không có: N/A. **Không phải định giá**; tổ chức tài chính tự định giá |
| | B3. Hợp đồng khung với bên mua lớn | Hợp đồng tải lên | Còn hiệu lực ≥ 12 tháng: 100 · < 12 tháng: 60 · không có: 30 |
| **Conditions – Ngành và thị trường (15%)** | D1. Rủi ro ngành | Bảng xếp hạng ngành nội bộ theo VSIC (cấu hình, có nguồn) | Thấp: 100 · trung bình: 60 · cao: 30 |
| | D2. Tập trung khách hàng | Kế toán/hóa đơn | Bên mua lớn nhất < 40% doanh thu: 100 · 40–70%: 60 · > 70%: 30. Nếu bên mua đó có điểm ≥ A thì cộng 20, tối đa 100 |
| | D3. Rủi ro khí hậu/địa điểm | Chỉ tiêu E6 của ESG | Theo mức E6 × 25 |

**Tính điểm:** điểm thành phần = bình quân gia quyền (mặc định bằng nhau) của các chỉ tiêu có dữ liệu trong thành phần. Điểm tổng = Σ (trọng số thành phần × điểm thành phần). Chỉ tiêu N/A có lý do thì chuẩn hóa lại trọng số **trong cùng thành phần**, không chuyển trọng số sang thành phần khác.

**Độ bao phủ và điểm chính thức:** Coverage = tổng trọng số của chỉ tiêu có dữ liệu đã xác minh / tổng trọng số chỉ tiêu áp dụng. Điểm chỉ được phát hành **chính thức** khi Coverage ≥ 75% và có đủ chỉ tiêu bắt buộc: P1 hoặc P2, K1, và C1 hoặc C2. Dưới ngưỡng thì gắn nhãn “Điểm tạm tính – chưa đủ cơ sở” và hiển thị khoảng điểm (thiếu dữ liệu tính 0 → tính 100).

**Xếp hạng tham khảo FCC:** AAA ≥ 90 · AA 80–89 · A 70–79 · BBB 60–69 · BB 50–59 · B 40–49 · CCC < 40. Nhãn này không phải xếp hạng CIC, xếp hạng tín nhiệm hay xếp hạng nội bộ của ngân hàng.

**Cờ rủi ro (knock-out):** nợ nhóm 3–5, MST ngừng hoạt động/bị cưỡng chế, doanh thu lệch > 25%, hóa đơn trùng/đã hủy, tranh chấp chưa giải quyết, vi phạm ESG trọng yếu (E5, S1, S2, G1, G2, G4). Có cờ thì hồ sơ chuyển **thẩm định tăng cường** và cờ hiển thị cạnh điểm. Hệ thống không tự từ chối và không để điểm cao che cờ.

### 4.3. Bộ chấm điểm bên mua (anchor)

| Nhóm (trọng số) | Chỉ tiêu | Nguồn |
| --- | --- | --- |
| Tài chính (60%) | Quy mô (doanh thu, tổng tài sản); đòn bẩy (nợ vay/EBITDA, nợ/VCSH); thanh khoản (hệ số hiện hành, tiền/nợ ngắn hạn); khả năng trả lãi (EBIT/chi phí lãi vay); ROA; dòng tiền HĐKD; xu hướng 4–8 quý | Niêm yết: BCTC quý/năm qua vnstock. Chưa niêm yết: BCTC tải lên hoặc kết nối kế toán |
| Thị trường và công bố (15%) | Ý kiến kiểm toán (ngoại trừ/từ chối → **cờ**); diện cảnh báo/kiểm soát/hạn chế giao dịch (→ **cờ**); biến động giá 90 ngày; vốn hóa; tin tức/sự kiện bất lợi | vnstock (hồ sơ công ty, sự kiện, giá), công bố thông tin. Không áp dụng với bên mua chưa niêm yết |
| Hành vi thanh toán (25%) | Tỷ lệ thanh toán đúng hạn khoản đã xác nhận; số ngày trễ bình quân (DBT); tỷ lệ tranh chấp | FCC và dữ liệu kế toán bên bán đã đồng ý chia sẻ. Chưa có lịch sử: N/A |

Bên mua chưa niêm yết dùng bộ chấm bên bán ở Mục 4.2 cộng nhóm hành vi thanh toán. Xếp hạng dùng cùng thang AAA–CCC.

### 4.4. Điểm hồ sơ tài trợ (theo khoản phải thu)

`Điểm hồ sơ = 0,45 × điểm bên mua + 0,30 × điểm bên bán + 0,25 × điểm giao dịch` (trọng số mặc định; sản phẩm của đối tác có thể cấu hình khác). Điểm giao dịch gồm: chứng từ đã xác minh (XML hóa đơn hợp lệ, khớp hợp đồng và biên bản giao nhận/nghiệm thu); lịch sử thanh toán của cặp mua–bán; kỳ hạn còn lại; tỷ lệ pha loãng (hàng trả lại, điều chỉnh giảm, tranh chấp); tỷ trọng khoản phải thu vào bên mua này. **Điều kiện cứng:** khoản phải thu phải có trạng thái `BUYER_CONFIRMED` mới được chấm điểm hồ sơ và đưa lên Marketplace cho sản phẩm yêu cầu xác nhận của bên mua.

Kết quả phân nhóm theo báo cáo (mục 3.3.b) để tổ chức tài chính đọc nhanh: (i) có tài sản bảo đảm và khoản phải thu tốt; (ii) không có tài sản bảo đảm nhưng khoản phải thu chất lượng cao, bên mua uy tín và dòng tiền tốt; (iii) không có tài sản bảo đảm, khoản phải thu yếu, điểm thấp → FCC không gợi ý sản phẩm, chỉ hiển thị sản phẩm mà đối tác đã cấu hình chấp nhận nhóm này.

### 4.5. Vai trò của AI trong chấm điểm

1. **Trích xuất tài liệu:** OCR + LLM đọc BCTC, báo cáo CIC, tờ khai thuế, sao kê, hợp đồng (PDF/ảnh) thành trường có cấu trúc kèm vị trí trang và độ tin cậy. Người dùng hoặc reviewer xác nhận trước khi dùng để tính điểm. Ưu tiên XML/dữ liệu có cấu trúc (hóa đơn điện tử, file xuất từ phần mềm kế toán) hơn OCR.
2. **Phát hiện bất thường:** doanh thu lệch giữa các nguồn, hóa đơn số tròn/đột biến, cùng hóa đơn ở nhiều hồ sơ, bên mua/bên bán có liên quan, chứng từ có dấu hiệu chỉnh sửa. Kết quả là **cờ để người xem xét**, không phải kết luận gian lận.
3. **Giải thích:** mỗi điểm có 3–5 yếu tố tác động mạnh nhất (reason code) và gợi ý cải thiện cụ thể (ví dụ “Bổ sung BCTC 2025 để tăng độ bao phủ”, “DSCR 1,1 dưới ngưỡng 1,3”). Văn bản giải thích sinh từ reason code, không do LLM tự suy luận ra số.
4. **Mô hình học máy (sau pilot):** khi có đủ kết quả trả nợ đã gán nhãn từ đối tác (ngưỡng mẫu chốt cùng đối tác), huấn luyện mô hình xác suất vỡ nợ có thể giải thích (logistic/gradient boosting kèm SHAP). Mô hình chạy song song với scorecard (champion–challenger) và chỉ thay thế khi backtest đạt và đối tác chấp thuận.

### 4.6. Vòng đời điểm

Chấm lại khi: có BCTC/dữ liệu kế toán mới; định kỳ hằng tháng với bên mua niêm yết (sau kỳ công bố BCTC quý); có sự kiện (cờ mới, tranh chấp, quá hạn); doanh nghiệp yêu cầu. Mỗi lần chấm lưu snapshot đầu vào (hash), phiên bản bộ chấm, kết quả từng chỉ tiêu, reason code, người phát hành. Doanh nghiệp xem được điểm của mình và gửi **yêu cầu xem xét lại** kèm bằng chứng. Tổ chức tài chính xem qua UI hoặc API khi có đồng ý chia sẻ.

## 5. Phân hệ B — ESG & Xanh, chấm điểm ESG bằng AI (P1)

### 5.1. Khung chấm điểm

Áp dụng nguyên văn `Khung chấm điểm ESG cho SMEs vay vốn FCC.md`:

- 18 chỉ tiêu E1–E6, S1–S6, G1–G6, mỗi chỉ tiêu chấm `x ∈ {0,1,2,3,4}` theo rubric và quy tắc bằng chứng (mức 4 cần số liệu định lượng hoặc đánh giá độc lập; mức 3 cần quy trình và chứng từ thực thi; …). Chỉ dùng bằng chứng trong 12 tháng gần nhất.
- `P = 25 × x`. 6 vấn đề trọng yếu (E-Tài nguyên, E-Môi trường, S-Lao động, S-Khách hàng, G-Minh bạch, G-Kiểm soát), mỗi vấn đề là bình quân các chỉ tiêu áp dụng.
- Trọng số theo 4 nhóm ngành: sản xuất; thương mại–dịch vụ; nông nghiệp–thực phẩm; công nghệ–số. Doanh nghiệp đa ngành có thể pha trộn trọng số theo cơ cấu doanh thu nhưng không được dùng pha trộn để làm mất cờ rủi ro.
- Coverage = chỉ tiêu áp dụng có bằng chứng đủ kiểm chứng / chỉ tiêu áp dụng. **Coverage ≥ 80%** mới phát hành điểm chính thức; dưới ngưỡng ghi “Thiếu dữ liệu” kèm khoảng điểm.
- N/A chỉ khi không phát sinh hoạt động liên quan và có kiểm tra; chuẩn hóa lại trong cùng vấn đề.
- Cờ trọng yếu E5, S1, S2, G1, G2, G4 kích hoạt thẩm định bất kể Coverage.
- Phân mức: Tốt 80–100 · Khá 65–<80 · Trung bình 50–<65 · Yếu < 50. Huy hiệu trên giao diện ánh xạ 1-1: Tốt = Bạch kim, Khá = Vàng, Trung bình = Bạc, Yếu = Đồng. Ví dụ demo 74 → Khá (Vàng). Thẻ E/S/G trên giao diện là bình quân gia quyền các vấn đề thuộc từng trụ cột.

### 5.2. Quy trình trong hệ thống (9 bước của khung)

1. **Tiếp nhận (B1–B2):** doanh nghiệp khai ngành chính (VSIC → nhóm ngành), số lao động, địa điểm sản xuất, kỳ đánh giá; hệ thống gợi ý nhóm ngành từ mã VSIC trong dữ liệu đăng ký.
2. **Sàng lọc (B3):** đối chiếu sự kiện vi phạm, xử phạt từ nguồn công khai (Mục 9.2) và câu hỏi tự khai bắt buộc.
3. **Thu thập bằng chứng (B4):** checklist theo từng chỉ tiêu với loại chứng từ ở Mục 4 của khung (hóa đơn điện/nước 12 tháng, hợp đồng thu gom chất thải, giấy phép môi trường, danh sách đóng BHXH, nhật ký tai nạn, kế hoạch đào tạo, BCTC, tờ khai thuế, danh sách chủ sở hữu hưởng lợi, quy tắc ứng xử…). Bảng câu hỏi tự đánh giá ngắn giúp doanh nghiệp biết cần nộp gì. Dữ liệu đã có ở phân hệ tín dụng (BCTC, thuế) được dùng lại cho G1, G2, không yêu cầu nộp lại.
4. **AI phân tích (B5):** pipeline ở Mục 5.3 đề xuất mức cho từng chỉ tiêu.
5. **Thẩm định (B5–B8):** reviewer FCC (hoặc analyst của đối tác, theo thỏa thuận) chấp nhận/sửa đề xuất. Sửa thì bắt buộc ghi lý do. Chỉ tiêu thiếu chứng cứ ghi “Chưa xác minh” và hệ thống tự gửi yêu cầu bổ sung cho doanh nghiệp.
6. **Tính điểm (B6–B7):** bộ tính điểm xác định theo công thức của khung, có phiên bản.
7. **Báo cáo và giám sát (B9):** báo cáo ESG gồm điểm, chỉ tiêu yếu, nguồn bằng chứng, ngày xác minh, kế hoạch cải thiện. Điểm có hạn hiệu lực 12 tháng; chấm lại khi có sự cố hoặc bằng chứng mới.

### 5.3. Pipeline AI đánh giá ESG

| Bước | Việc AI làm | Kiểm soát |
| --- | --- | --- |
| Phân loại tài liệu | Nhận diện loại chứng từ, kỳ, đơn vị phát hành; gán vào chỉ tiêu | Tài liệu ngoài kỳ 12 tháng bị loại khỏi tính điểm và có ghi chú |
| Trích xuất số liệu | Ví dụ: kWh và m³ theo tháng từ hóa đơn điện/nước; số lao động đóng BHXH so với tổng lao động; số vụ tai nạn; khối lượng chất thải; giờ đào tạo | Lưu giá trị, đơn vị, trang, độ tin cậy; người xác nhận trường có độ tin cậy thấp |
| Tính chỉ số định lượng | Cường độ năng lượng (kWh/doanh thu hoặc /sản phẩm); phát thải Scope 2 ước tính = kWh × hệ số phát thải lưới điện; tỷ trọng điện tái tạo (ví dụ điện mặt trời áp mái); xu hướng 12 tháng | Hệ số phát thải lưới điện là **tham số cấu hình theo năm**, lấy từ công bố chính thức của cơ quan nhà nước, không hard-code |
| Đề xuất mức 0–4 | Đối chiếu bằng chứng với rubric từng mức; trả về mức đề xuất, lập luận ngắn, trích dẫn (tài liệu, trang, giá trị), danh sách bằng chứng còn thiếu | Không có trích dẫn thì không được đề xuất mức ≥ 2; thiếu bằng chứng → “Chưa xác minh”, không đề xuất 0 |
| Kiểm tra nhất quán | So bảng tự khai với bằng chứng; phát hiện mâu thuẫn (ví dụ tự khai “có hợp đồng thu gom” nhưng không có chứng từ) | Mâu thuẫn tạo việc cho reviewer |
| Gợi ý cải thiện | Liệt kê hành động nâng mức cho chỉ tiêu yếu, kèm loại bằng chứng cần có | Chỉ là gợi ý; không hứa ưu đãi |

**ESG bên mua niêm yết:** AI trích xuất thông tin phát triển bền vững từ báo cáo thường niên/báo cáo phát triển bền vững do doanh nghiệp công bố (công ty đại chúng phải công bố theo Thông tư 96/2020/TT-BTC). Kết quả gắn nhãn **“ESG theo công bố – chưa thẩm định”**, dùng cùng 18 chỉ tiêu nhưng không phát hành như điểm chính thức nếu chưa có reviewer.

### 5.4. Liên kết tài chính xanh

- **Ưu đãi xanh do đối tác định nghĩa** trong sản phẩm Marketplace dưới dạng quy tắc, ví dụ: “giảm 0,7 điểm %/năm nếu ESG chính thức ≥ 65, Coverage ≥ 80%, không có cờ, điểm còn hiệu lực”. Màn hình “Tác động từ ESG” chỉ liệt kê ưu đãi của các sản phẩm thật mà doanh nghiệp đủ điều kiện, kèm tên đối tác.
- **Mục đích vay xanh:** cho phép gắn thẻ mục đích (năng lượng tái tạo, tiết kiệm năng lượng, xử lý chất thải…) để đối tác có sản phẩm tín dụng xanh lọc hồ sơ. Việc công nhận “xanh” thuộc về đối tác theo quy định hiện hành về phân loại xanh và quản lý rủi ro môi trường trong tín dụng (Mục 13). FCC không tự gán nhãn “dự án xanh”.
- Điểm ESG không tự động suy ra giảm lãi suất hay quyết định vay (đúng mục 7 của khung).

### 5.5. ESG chuỗi cung ứng (góc nhìn bên mua và tổ chức tài chính)

- Bên mua thấy danh sách nhà cung cấp kèm điểm ESG và mức, nếu nhà cung cấp đồng ý chia sẻ ESG với bên mua đó. Có thể lọc theo chỉ tiêu yếu và theo dõi kế hoạch cải thiện.
- **Nhà cung cấp xanh** = điểm ESG chính thức ≥ 65, còn hiệu lực và không có cờ trọng yếu. Hiển thị dạng “12/24 nhà cung cấp”.
- Tổ chức tài chính thấy cơ cấu danh mục theo mức ESG và hồ sơ có ưu đãi xanh.

## 6. Phân hệ C — Marketplace tài chính (P1)

### 6.1. Điểm khác biệt cần đạt

Marketplace không chỉ là bảng so sánh lãi suất. Mỗi khoản phải thu **đã được bên mua xác nhận** đi kèm điểm hồ sơ, điểm bên mua và ESG. Hệ thống tự khớp với tiêu chí do từng tổ chức tài chính công bố, cho phép **lấy báo giá cạnh tranh** từ nhiều đối tác nhưng chỉ **khóa một hồ sơ tài trợ hoạt động** để chống tài trợ trùng. Bên mua cũng tham gia bằng chương trình thanh toán sớm.

### 6.2. Danh mục sản phẩm

Tổ chức tài chính (vai trò product manager) tạo sản phẩm có phiên bản:

| Nhóm thuộc tính | Trường |
| --- | --- |
| Loại sản phẩm | Bao thanh toán có/không truy đòi; tài trợ hóa đơn; SCF do bên mua khởi tạo (reverse factoring); vay vốn lưu động; tín dụng xanh |
| Điều kiện | Ngành (VSIC/nhóm ngành) chấp nhận; khoảng số tiền; kỳ hạn tối đa; xếp hạng FCC tối thiểu cho bên bán, bên mua và hồ sơ; ESG tối thiểu (nếu có); yêu cầu bên mua xác nhận; danh sách bên mua chấp nhận (nếu có); yêu cầu tài sản bảo đảm; nhóm (i)/(ii)/(iii) chấp nhận |
| Biểu giá công bố | Tỷ lệ ứng trước tối đa (%); lãi suất/năm dạng khoảng (min–max) và cơ sở tính (ngày/365); các khoản phí (cố định, %); thời điểm thu phí; phạt quá hạn |
| Ưu đãi xanh | Quy tắc điều kiện → mức giảm (Mục 5.4) |
| Cam kết dịch vụ | SLA phản hồi báo giá, SLA thẩm định (chỉ hiển thị nếu đối tác cam kết) |
| Hiệu lực | Ngày bắt đầu/kết thúc, trạng thái (nháp → chờ FCC kiểm tra → đang công bố → tạm dừng → hết hiệu lực) |

FCC operations chỉ kiểm tra trình bày, tính đầy đủ và tính nhất quán của thông tin công bố, không thẩm định hay bảo đảm sản phẩm. Thay đổi biểu giá tạo phiên bản mới; báo giá đã phát hành giữ phiên bản cũ.

### 6.3. Khớp và xếp hạng sản phẩm

1. **Lọc cứng:** khoản phải thu/doanh nghiệp không thỏa điều kiện thì không hiển thị trong “Phù hợp”. Mục “Chưa phù hợp” hiển thị lý do (ví dụ “Cần ESG ≥ 65 — điểm hiện tại 58”).
2. **Chi phí ước tính từ biểu giá công bố** cho khoản phải thu giá trị `A`, kỳ hạn `d` ngày:
   - Số tiền ứng = tỷ lệ ứng trước × `A`
   - Lãi ước tính = số tiền ứng × lãi suất/năm × `d` / 365 (tính ở mức min và max của khoảng, sau ưu đãi xanh nếu đủ điều kiện)
   - Tổng chi phí = lãi + phí; Thực nhận = số tiền ứng − phí thu trước
   - Chi phí hiệu dụng/năm = tổng chi phí / thực nhận × 365 / `d`

   Hiển thị nhãn “Ước tính theo biểu giá công bố ngày …, không phải báo giá”. Ví dụ báo cáo: hóa đơn 2 tỷ, 90 ngày, ứng 80% → số tiền ứng 1,6 tỷ.
3. **Thứ tự mặc định:** chi phí hiệu dụng tăng dần. Có thể sắp theo tỷ lệ ứng trước, SLA, mức phù hợp. Không xếp theo hoa hồng. Nếu có vị trí tài trợ/quảng cáo thì phải gắn nhãn rõ và tách khỏi danh sách xếp hạng.
4. **Gợi ý AI** trên Tổng quan/Hóa đơn chỉ là kết quả của bước 1–3 cho khoản phải thu đủ điều kiện, kèm lý do. Không đưa ra lời khuyên vay.

### 6.4. Yêu cầu báo giá (RFQ) và chọn đối tác

1. Owner bên bán chọn tối đa **3** sản phẩm phù hợp và đồng ý chia sẻ **gói tóm tắt** (thông tin doanh nghiệp, xếp hạng FCC, ESG, tóm tắt khoản phải thu, trạng thái xác nhận bên mua; chưa gồm chứng từ đầy đủ) cho các đối tác đó.
2. Đối tác trả **báo giá sơ bộ** (tỷ lệ ứng, lãi, phí, điều kiện, hạn hiệu lực) hoặc từ chối trong SLA. Báo giá sơ bộ không ràng buộc cho đến khi có đề nghị chính thức.
3. Bên bán so sánh các báo giá cạnh nhau theo cùng công thức ở 6.3 và chọn một. Hệ thống tạo `funding_application` (luồng Mục 8), khóa khoản phải thu, thu hồi quyền xem của các đối tác còn lại và thông báo “Doanh nghiệp đã chọn đối tác khác”.
4. Trạng thái RFQ: `OPEN → RESPONDED → SELECTED | DECLINED | EXPIRED | CANCELLED`. Một khoản phải thu có tối đa một RFQ mở và tối đa một hồ sơ tài trợ hoạt động. Đối tác trả đề nghị chính thức khác báo giá sơ bộ thì hiển thị chênh lệch, và bên bán phải chấp thuận lại.

### 6.5. Góc nhìn tổ chức tài chính

- Quản lý sản phẩm, hộp RFQ, hàng đợi hồ sơ và “hồ sơ được AI đề xuất” (RFQ/hồ sơ khớp tiêu chí của sản phẩm, xếp theo điểm hồ sơ).
- **Toàn cảnh thị trường:** khoảng lãi suất và tỷ lệ ứng trước của các sản phẩm **đang công bố** theo loại sản phẩm (ví dụ demo 5,9%–8,1%). Không hiển thị báo giá riêng mà đối tác khác gửi cho doanh nghiệp.

### 6.6. Thanh toán sớm từ bên mua (dynamic discounting)

Bên mua tạo chương trình chiết khấu cho khoản phải trả đã xác nhận, ví dụ “2,5% nếu thanh toán trước ngày X” hoặc theo công thức %/năm × số ngày trả sớm. Nhà cung cấp chấp nhận trên FCC. Bên mua **tự chuyển tiền** trực tiếp cho nhà cung cấp; FCC chỉ ghi nhận thỏa thuận, chứng từ thanh toán và đối soát. Khoản phải thu đang có hồ sơ tài trợ hoạt động thì không được nhận chiết khấu sớm (và ngược lại).

## 7. Phân hệ D — Tổng quan, Kế toán và dự báo dòng tiền

### 7.1. Tổng quan (P1)

Định nghĩa chỉ số theo Mục 3. Mỗi thẻ chỉ số có tooltip ghi công thức, phạm vi dữ liệu, nguồn và thời điểm cập nhật. Biến động “+x%” so với kỳ trước chỉ tính khi có đủ dữ liệu cả hai kỳ.

### 7.2. Kết nối phần mềm kế toán (P2)

| Ưu tiên | Phương thức | Ghi chú |
| --- | --- | --- |
| 1 | API chính thức/đối tác của phần mềm kế toán (MISA, FAST, Bravo, Odoo, SAP Business One…) | Cần thỏa thuận đối tác hoặc doanh nghiệp tự cấp khóa API; OAuth nếu có; quyền **chỉ đọc** |
| 2 | API nhà cung cấp hóa đơn điện tử | Lấy hóa đơn đầu ra/đầu vào khi doanh nghiệp ủy quyền |
| 3 | Nhập file định kỳ theo mẫu FCC (Excel/CSV/XML xuất từ phần mềm kế toán) | Có validator, báo lỗi theo dòng, lưu file gốc |
| 4 | Tải lên thủ công BCTC, sổ chi tiết công nợ | Dữ liệu ghi nhãn “doanh nghiệp tự khai” |

Dữ liệu cần lấy: danh mục khách hàng/nhà cung cấp (theo MST); công nợ mở phải thu (TK 131) và phải trả (TK 331) theo chứng từ, kèm ngày đến hạn; số dư tiền (TK 111, 112); tồn kho; BCTC năm/quý; lịch sử thu/chi 12–24 tháng. Bảng ánh xạ tài khoản hỗ trợ chế độ kế toán doanh nghiệp nhỏ và vừa (Thông tư 133/2016/TT-BTC) và chế độ kế toán doanh nghiệp (Thông tư 200/2014/TT-BTC hoặc văn bản thay thế đang có hiệu lực; cần đối chiếu trước khi xây dựng). Đồng bộ tăng dần, có `last_synced_at` và nhãn độ tươi dữ liệu trên giao diện. Ngắt kết nối thì dừng đồng bộ ngay và áp dụng chính sách lưu/xóa đã công bố.

### 7.3. Dự báo dòng tiền (P2)

**v1 — dự báo theo lịch, giải thích được:**

`Tiền dự kiến ngày t = số dư đầu kỳ + Σ thu dự kiến − Σ chi dự kiến`

- Thu dự kiến: khoản phải thu mở. Ngày thu = hạn thanh toán + độ trễ lịch sử của **từng bên mua** (trung vị và p80 từ dữ liệu thanh toán trước). Khoản đã được bên mua xác nhận có độ chắc chắn cao hơn. Cộng giải ngân đã được đối tác xác nhận và thanh toán sớm đã chấp nhận.
- Chi dự kiến: khoản phải trả mở theo hạn; các khoản chi định kỳ (lương, thuê, thuế, trả nợ) ước lượng từ lịch sử 6–12 tháng; trả nợ tài trợ theo lịch của đối tác.
- Kết quả 7/30/90 ngày với ba kịch bản: cơ sở (trung vị), thận trọng (p80 trễ), lạc quan. Hiển thị các khoản đóng góp lớn nhất.

**Cảnh báo:** số dư dự kiến âm hoặc dưới ngưỡng doanh nghiệp tự đặt → cảnh báo kèm khoản phải thu đủ điều kiện có thể dùng trên Marketplace. Bên mua có tiền dư dự kiến → gợi ý chương trình thanh toán sớm.

**v2 — mô hình học máy** cho chuỗi thời gian khi doanh nghiệp có ≥ 12 tháng lịch sử. Chỉ dùng khi sai số đo trên dữ liệu kiểm thử tốt hơn v1.

Đo chất lượng: sai số tuyệt đối trung bình theo % giữa dự báo và thực tế cho từng horizon, công bố cho người dùng. Dự báo luôn ghi nhãn “Dự báo – không phải cam kết”.

### 7.4. Trang Kế toán

Không xây phần mềm kế toán. Trang này gồm: trạng thái kết nối và lịch sử đồng bộ; công nợ phải thu/phải trả theo tuổi nợ; BCTC đã nhập (dùng cho chấm điểm); hàng đợi tài liệu OCR chờ xác nhận; dự báo dòng tiền chi tiết. Tổ chức tài chính chỉ xem các mục này của doanh nghiệp khi được đồng ý chia sẻ.

## 8. Luồng tài trợ khoản phải thu (nền tảng, giữ từ 1.0)

### 8.1. Luồng chuẩn

1. **Onboarding:** kiểm tra pháp nhân, MST, người đại diện/ủy quyền, email, điện thoại. Hệ thống tự điền từ dữ liệu đăng ký công khai (Mục 9.2); nhân sự FCC xác minh thủ công trước khi mở quyền gửi hồ sơ. Kết quả xác minh có hạn hiệu lực.
2. **Tạo khoản phải thu:** tải XML hóa đơn gốc, kèm PDF, hợp đồng, biên bản giao nhận/nghiệm thu, hoặc nhận từ kết nối kế toán/hóa đơn điện tử. Đọc XML, tính dấu vân tay, kiểm tra định dạng/trùng. Không có XML thì chuyển kiểm tra thủ công; OCR không được coi là xác thực pháp lý.
3. **Xác minh giao dịch:** đối chiếu người bán, người mua, MST, ký hiệu/số hóa đơn, số tiền, ngày, hạn, chứng từ giao nhận. Chỉ ghi `verified` khi có kết nối với nguồn xác thực và bằng chứng trả về thật; không có thì ghi `unverified`.
4. **Xác nhận của bên mua:** lời mời có thời hạn tới người có thẩm quyền; lưu phiên bản nội dung đã xác nhận, danh tính, thời điểm, phương thức xác thực, bằng chứng. Mẫu xác nhận do đối tác/pháp chế duyệt.
5. **Chấm điểm và Marketplace:** sau `BUYER_CONFIRMED`, hệ thống tính điểm hồ sơ (Mục 4.4), khớp sản phẩm (6.3), bên bán gửi RFQ (6.4) hoặc chọn thẳng một sản phẩm.
6. **Đề nghị tài trợ:** owner chọn một đối tác, đồng ý phạm vi chia sẻ đầy đủ; FCC khóa phiên bản hồ sơ và gửi qua API đối tác hoặc cổng nhận hồ sơ an toàn.
7. **Thẩm định:** đối tác yêu cầu bổ sung, từ chối hoặc đưa đề nghị chính thức. FCC hiển thị nguyên văn điều kiện và hạn chấp thuận.
8. **Ký, giải ngân, thu hồi:** trên kênh/hợp đồng của đối tác. FCC nhận mã giao dịch, số tiền, thời gian, chứng từ và trạng thái qua tích hợp, hoặc nhập liệu có đối soát hai người. Sau giải ngân, cảnh báo sớm (EWS) theo dõi quá hạn, thay đổi điểm bên mua/bên bán, cờ mới và gửi tới đối tác.

### 8.2. Vòng đời và quy tắc chuyển trạng thái

`DRAFT → DOCS_PENDING → BUYER_PENDING → BUYER_CONFIRMED → READY_TO_SUBMIT → SUBMITTED → UNDER_REVIEW → OFFERED → ACCEPTED → FUNDED → SETTLED`

Nhánh hợp lệ: `BUYER_DISPUTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`, `OVERDUE`, `CANCELLED`, và trạng thái phụ `EARLY_PAID` (thanh toán sớm từ bên mua). RFQ (6.4) chạy khi khoản phải thu ở `BUYER_CONFIRMED`/`READY_TO_SUBMIT`, không đổi trạng thái khoản phải thu. Không chuyển trực tiếp từ `DRAFT` sang `FUNDED`. `BUYER_DISPUTED` chặn RFQ và gửi hồ sơ cho đến khi bên mua xác nhận phiên bản mới. Sau `SUBMITTED`, thay đổi dữ liệu trọng yếu tạo phiên bản mới và cần đối tác chấp nhận lại. `FUNDED` và `SETTLED` chỉ được xác lập từ bằng chứng của đối tác.

**Ngoại lệ:** hóa đơn bị hủy/điều chỉnh, bên mua từ chối, sai số tiền, tài trợ đã tồn tại, webhook lặp hoặc sai thứ tự, đối tác mất kết nối, thanh toán một phần, quá hạn, nguồn dữ liệu ngoài lỗi hoặc thay đổi định dạng. Mỗi ngoại lệ có mã lý do, người xử lý và hướng khôi phục; hệ thống không âm thầm đổi trạng thái.

## 9. Thu thập dữ liệu doanh nghiệp

### 9.1. Bên mua niêm yết — vnstock

- **Ánh xạ:** bảng `listed_companies` nối MST ↔ mã chứng khoán ↔ sàn. Lần đầu xác minh thủ công; định kỳ cập nhật danh sách niêm yết.
- **Dữ liệu lấy:** BCTC năm/quý (cân đối kế toán, kết quả kinh doanh, lưu chuyển tiền tệ), chỉ số tài chính, hồ sơ công ty, cổ đông lớn, ban lãnh đạo, sự kiện, tin tức, giá lịch sử. Thư viện vnstock (bản 4.x) cung cấp các nhóm này qua giao diện `Market`, `Reference`, `Fundamental`, với nguồn dữ liệu như KBS, VCI, MSN.
- **Lịch:** giá hằng ngày; BCTC quét hằng ngày trong mùa công bố, ngoài mùa thì hằng tuần; tự chấm lại điểm bên mua khi có kỳ BCTC mới.
- **Lưu trữ:** snapshot thô (nguồn, thời điểm, hash) và bảng chuẩn hóa; giao diện hiển thị “Nguồn: … · cập nhật …”.
- **Thiết kế thay thế được:** mọi truy cập qua interface `MarketDataProvider`; vnstock là adapter đầu tiên. Có thể thay bằng nhà cung cấp dữ liệu có giấy phép thương mại hoặc dữ liệu công bố thông tin của Sở GDCK mà không đổi bộ chấm điểm.
- **Giấy phép:** vnstock là phần mềm *source-available*. Dùng cá nhân, học tập, nghiên cứu được miễn phí; dùng trong sản phẩm thương mại phải nằm trong phạm vi gói/số người dùng/thiết bị. Nếu sản phẩm phân phối lại phần mềm, hoặc giá trị chính là cung cấp dữ liệu thị trường cho bên thứ ba, cần thỏa thuận bằng văn bản. Dự án cũng ghi rõ vnstock không phải nhà cung cấp dữ liệu. Có giới hạn tần suất gọi (Guest 20, Community 60, Sponsor 180–600 lượt/phút). **Trước môi trường production phải chốt giấy phép vnstock và quyền sử dụng dữ liệu của nguồn gốc.** Trong lúc chưa chốt, chỉ dùng trên dev/staging và trong nghiên cứu.

### 9.2. Bên bán SME/gia công chưa niêm yết — crawl có kiểm soát và dữ liệu được đồng ý

**Thứ tự ưu tiên nguồn:** (1) dữ liệu doanh nghiệp đồng ý chia sẻ (hóa đơn điện tử, phần mềm kế toán, sao kê, báo cáo CIC tự tra cứu, BCTC); (2) API/thỏa thuận dữ liệu chính thức; (3) crawl nguồn công khai.

**Danh mục nguồn công khai dự kiến** (mỗi nguồn phải qua rà soát trước khi bật):

| Nguồn | Dữ liệu | Dùng cho |
| --- | --- | --- |
| Cổng thông tin quốc gia về đăng ký doanh nghiệp | Tình trạng pháp lý, ngày thành lập, ngành nghề, địa chỉ, người đại diện | Onboarding, C3, nhóm ngành ESG |
| Tra cứu người nộp thuế của cơ quan thuế | Trạng thái MST | C2 |
| Hệ thống mạng đấu thầu quốc gia | Lịch sử tham gia/trúng thầu (đặc biệt xây dựng, vật liệu) | Năng lực thực hiện, D1/D2 |
| Cổng công bố bản án, quyết định của tòa án | Tranh chấp, phá sản | C4, cờ rủi ro |
| Thông báo xử phạt môi trường/lao động của cơ quan quản lý | Vi phạm | C4, E5, S1, S2 |
| Website doanh nghiệp, báo chí | Chứng nhận, sự kiện | Gợi ý bằng chứng ESG, tin bất lợi |

**Quy tắc crawl bắt buộc:**

- Mỗi nguồn có hồ sơ trong `data_sources`: chủ quản, điều khoản sử dụng, robots.txt, căn cứ pháp lý, dữ liệu cá nhân có liên quan, tần suất, người phê duyệt. Chưa phê duyệt thì không chạy.
- **Không vượt CAPTCHA, đăng nhập, paywall hay biện pháp chặn kỹ thuật.** Nguồn có CAPTCHA thì dùng tra cứu thủ công có hỗ trợ (nhân sự FCC nhập), API chính thức hoặc dữ liệu doanh nghiệp tự cung cấp.
- Giới hạn tần suất, user-agent định danh có liên hệ, crawl theo MST cần tra cứu (không quét toàn bộ cơ sở dữ liệu), có cache và tôn trọng thời gian chờ.
- Lưu provenance: URL, thời điểm, hash nội dung, phiên bản parser. Parser lỗi do nguồn đổi định dạng → cảnh báo và đưa vào hàng đợi ngoại lệ, không ghi dữ liệu sai.
- Dữ liệu crawl luôn có trạng thái “nguồn công khai – tham khảo”. Doanh nghiệp xem được dữ liệu ngoài về mình và gửi khiếu nại sai lệch; tranh chấp được xử lý trước khi dùng cho cờ knock-out.
- Dữ liệu cá nhân (ví dụ tên người đại diện) chỉ thu khi cần cho mục đích đã đăng ký, theo Luật Bảo vệ dữ liệu cá nhân.
- Khớp thực thể chủ yếu theo MST; tên/địa chỉ chỉ dùng hỗ trợ, khớp mờ thì cần người xác nhận.

## 10. Kiến trúc AI và quản trị mô hình

| Thành phần | Công nghệ gợi ý | Đầu ra |
| --- | --- | --- |
| Document AI | OCR tiếng Việt + LLM trích xuất có schema | Trường có cấu trúc, vị trí trang, độ tin cậy |
| ESG assessor | LLM với rubric 18 chỉ tiêu + truy xuất bằng chứng | Mức đề xuất, lập luận, trích dẫn, bằng chứng thiếu |
| Credit feature pipeline | Python (pandas) — chung runtime với vnstock | Bộ đặc trưng có phiên bản |
| Scorecard engine | Quy tắc cấu hình (YAML/JSON có phiên bản), mã xác định | Điểm, xếp hạng, reason code |
| Anomaly detection | Quy tắc + thống kê; ML sau pilot | Cờ bất thường |
| Matching engine | Bộ lọc + công thức chi phí (6.3) | Danh sách sản phẩm phù hợp và lý do |
| Cashflow forecast | Mô hình lịch (v1), chuỗi thời gian (v2) | Dự báo 3 kịch bản |

**Quy tắc quản trị:**

- **Nơi chạy và dữ liệu:** ưu tiên mô hình OCR/LLM tự vận hành trên hạ tầng FCC. Nếu dùng dịch vụ AI bên thứ ba thì cần: hợp đồng xử lý dữ liệu, cam kết không dùng dữ liệu để huấn luyện, rà soát chuyển dữ liệu ra nước ngoài, che dữ liệu cá nhân trước khi gửi, và doanh nghiệp được thông báo/đồng ý. Không gửi dữ liệu khách hàng vào môi trường demo.
- **Registry:** lưu phiên bản mô hình, prompt, scorecard, bảng ngành, hệ số phát thải; mỗi kết quả lưu các phiên bản đã dùng và hash đầu vào để tái lập.
- **Đánh giá trước khi bật:** bộ dữ liệu kiểm thử có nhãn cho trích xuất (độ chính xác theo trường quan trọng) và cho đề xuất ESG (tỷ lệ reviewer giữ nguyên mức). Ngưỡng đạt chốt trong giai đoạn 0 và đo lại mỗi khi đổi mô hình/prompt.
- **Công bằng:** không dùng đặc điểm cá nhân của chủ doanh nghiệp (giới tính, tuổi, quê quán, dân tộc…) làm biến chấm điểm. Rà soát định kỳ chênh lệch kết quả theo ngành/quy mô/vùng.
- **Giám sát:** phân phối điểm, tỷ lệ cờ, tỷ lệ reviewer sửa đề xuất AI, độ lệch dữ liệu. Vượt ngưỡng thì cảnh báo model owner.

## 11. Yêu cầu chức năng và tiêu chí chấp nhận

| ID | Yêu cầu | Tiêu chí chấp nhận |
| --- | --- | --- |
| F01 | Tổ chức, người dùng, mời thành viên, phân quyền, MFA | Tài khoản khác tổ chức không đọc được dữ liệu; thu hồi quyền có hiệu lực tức thời |
| F02 | Tải XML/PDF và chứng từ bổ trợ | Quét mã độc, giới hạn loại/kích thước, lưu bản gốc bất biến và SHA-256, lỗi tải có thể thử lại |
| F03 | Trích xuất, kiểm tra hóa đơn | Lưu giá trị gốc và giá trị sửa; không đánh dấu đã xác minh chỉ dựa trên OCR |
| F04 | Phát hiện trùng và khóa khoản phải thu | Khóa nghiệp vụ: MST người bán + mẫu/ký hiệu + số + ngày + mã tra cứu; xung đột đưa vào review |
| F05 | Bên mua xác nhận/tranh chấp | Chỉ người được ủy quyền; lưu snapshot, phương thức xác thực, thời điểm, IP, phiên bản chứng từ |
| F06 | Quyền chia sẻ dữ liệu | Hiển thị bên nhận, mục đích, loại dữ liệu, thời hạn; mọi truy cập kiểm tra consent hiện hành; thu hồi có hiệu lực tức thời với truy cập mới |
| F07 | Gửi và theo dõi hồ sơ tài trợ | Một hồ sơ hoạt động mỗi khoản phải thu; idempotency key; trạng thái khớp phản hồi đối tác |
| F08 | Báo giá và chấp thuận | Hiển thị thực nhận, phí/lãi, tổng phải trả, giả định; không có giá đối tác thì “Chưa có báo giá” |
| F09 | Giải ngân, thanh toán, tất toán | Chỉ cập nhật từ sự kiện/chứng từ đối tác; hỗ trợ thanh toán một phần và đối soát số dư |
| F10 | Nhật ký và ngoại lệ | Mọi sự kiện có actor, thời gian, đối tượng, trước/sau, correlation ID; log không thể sửa/xóa |
| F11 | Thông báo | Gửi thất bại có hàng đợi thử lại |
| **F12** | Chấm điểm bên bán (4.2) | Tính đúng trên bộ ca kiểm thử có kết quả tính tay; thiếu dữ liệu không thành 0; Coverage < 75% → “tạm tính” kèm khoảng; cờ knock-out luôn hiển thị; chạy lại cùng đầu vào cho cùng kết quả |
| **F13** | Chấm điểm bên mua (4.3) qua vnstock | Ánh xạ MST ↔ mã CK; mỗi chỉ tiêu ghi nguồn và kỳ BCTC; nguồn lỗi thì giữ điểm cũ, gắn nhãn “dữ liệu cũ”, không tính bằng dữ liệu rỗng |
| **F14** | Điểm hồ sơ tài trợ (4.4) và giải thích | Chỉ chấm khi `BUYER_CONFIRMED`; có 3–5 reason code; doanh nghiệp gửi được yêu cầu xem xét lại |
| **F15** | AI trích xuất BCTC/CIC/thuế | Trường có vị trí trang và độ tin cậy; phải có người xác nhận trước khi dùng; đạt ngưỡng chính xác đã chốt trên bộ kiểm thử |
| **F16** | Hồ sơ ESG và bằng chứng (5.2) | Checklist theo 18 chỉ tiêu; loại tài liệu ngoài 12 tháng; dùng lại dữ liệu G1/G2 từ phân hệ tín dụng |
| **F17** | AI đề xuất mức ESG (5.3) | Mỗi đề xuất có trích dẫn; không trích dẫn thì không đề xuất ≥ 2; thiếu bằng chứng → “Chưa xác minh”; reviewer sửa phải ghi lý do |
| **F18** | Tính điểm ESG | Tái lập đúng ví dụ của khung (66,67; Coverage 100%); đúng trọng số 4 nhóm ngành; N/A chuẩn hóa trong nhóm; Coverage < 80% không phát hành chính thức; cờ E5/S1/S2/G1/G2/G4 kích hoạt thẩm định |
| **F19** | ESG chuỗi cung ứng (5.5) | Chỉ gồm nhà cung cấp đã đồng ý chia sẻ; công thức gia quyền và định nghĩa “nhà cung cấp xanh” đúng 5.5 |
| **F20** | Sản phẩm Marketplace (6.2) | Đối tác tạo/sửa/tạm dừng; có phiên bản; chỉ công bố sau FCC kiểm tra; hết hiệu lực thì tự ẩn |
| **F21** | Khớp và chi phí ước tính (6.3) | Lọc đúng điều kiện; danh sách “chưa phù hợp” có lý do; chi phí khớp công thức trên bộ ca kiểm thử; mặc định sắp theo chi phí; ưu đãi xanh chỉ áp khi đủ điều kiện |
| **F22** | RFQ (6.4) | Tối đa 3 đối tác; chỉ chia sẻ gói tóm tắt; chọn một thì thu hồi quyền của đối tác còn lại; kiểm thử race condition không tạo được hai hồ sơ hoạt động |
| **F23** | Thanh toán sớm từ bên mua (6.6) | Không áp dụng cho khoản đang tài trợ; ghi nhận chứng từ thanh toán; đối soát số tiền sau chiết khấu |
| **F24** | Tổng quan theo vai trò (3, 7.1) | Mọi chỉ số tính từ dữ liệu thật và có tooltip công thức/nguồn; trạng thái rỗng khi thiếu dữ liệu; không có hằng số demo |
| **F25** | Kết nối kế toán (7.2) | Ít nhất một kết nối API hoặc nhập file chạy được trên dữ liệu pilot; chỉ đọc; đồng bộ tăng dần; ngắt kết nối có hiệu lực ngay |
| **F26** | Dự báo dòng tiền (7.3) | Ba kịch bản 7/30/90 ngày; đo và hiển thị sai số; cảnh báo thiếu hụt có liên kết tới Marketplace |
| **F27** | Nguồn dữ liệu và crawl (9.2) | Nguồn chưa phê duyệt không chạy; không vượt CAPTCHA/đăng nhập; mỗi bản ghi có provenance; doanh nghiệp khiếu nại được sai lệch |

## 12. Mô hình dữ liệu

| Bảng/thực thể | Trường quan trọng | Quy tắc |
| --- | --- | --- |
| `organizations` | id, tax_code, legal_name, type (buyer/supplier/lender/fcc), vsic_codes, industry_group, verification_status, listed_symbol | `tax_code` duy nhất theo pháp nhân; một tổ chức có thể vừa mua vừa bán |
| `users`, `memberships` | id, org_id, role, mfa_status, status | Không gắn quyền chỉ bằng vai trò UI |
| `receivables` | id, seller_org_id, buyer_org_id, amount_vnd, due_date, state, version | Tiền là số nguyên VND; thay đổi trọng yếu tăng version |
| `invoices` | id, receivable_id, seller_tax_code, buyer_tax_code, series, number, issue_date, total_vnd, lookup_code, source_status, fingerprint | Unique theo khóa nghiệp vụ; xung đột đưa vào review |
| `documents` | id, owner_org_id, type, object_key, sha256, mime, size, period_from, period_to, version | Bản gốc bất biến; metadata theo quyền |
| `buyer_confirmations` | id, receivable_id, version, decision, amount_vnd, due_date, actor_id, evidence_id, decided_at | Chỉ xác nhận phiên bản đang hiển thị |
| `consents` | id, owner_org_id, recipient_org_id, purpose, scope (credit_score, esg, documents, accounting…), version, granted_at, expires_at, revoked_at, evidence_id | Mọi lần chia sẻ kiểm tra consent hiện hành |
| `data_sources` | id, name, kind (vnstock/crawl/api/upload/accounting), terms_url, legal_basis, personal_data, rate_limit, approved_by, status | Chưa `approved` thì không chạy |
| `source_snapshots` | id, source_id, subject_tax_code, fetched_at, url_or_endpoint, content_hash, object_key, parser_version | Bất biến; cơ sở cho provenance |
| `listed_companies` | tax_code, symbol, exchange, verified_by, verified_at | Ánh xạ xác minh thủ công lần đầu |
| `financial_statements`, `financial_lines` | id, org_id, period, statement_type, source_snapshot_id, status (self_declared/extracted/verified), line_code, value_vnd | Mỗi dòng truy về nguồn |
| `extractions` | id, document_id, model_version, field, value, page, confidence, confirmed_by, confirmed_value | Giữ cả giá trị AI và giá trị người xác nhận |
| `scorecard_versions` | id, kind (supplier/buyer/application), config_json, approved_by[2], effective_from | Không sửa sau khi có hiệu lực |
| `credit_assessments` | id, org_id hoặc receivable_id, scorecard_version_id, input_hash, score, rating, coverage, status (provisional/official/superseded), flags, issued_by, issued_at, valid_until | Kết quả đã phát hành bất biến; chấm lại tạo bản ghi mới |
| `credit_factor_results` | assessment_id, factor_code, raw_value, points, weight, source_ref, reason_code | Phục vụ giải thích |
| `esg_assessments` | id, org_id, industry_group, weights_version, period, score, level, coverage, status, flags, valid_until, reviewer_id | Như trên |
| `esg_indicator_results` | assessment_id, code (E1…G6), ai_level, ai_rationale, final_level, na_reason, verification_status, reviewer_note | `final_level` khác `ai_level` thì bắt buộc có note |
| `esg_evidence_links` | indicator_result_id, document_id, page, extracted_value, unit | Mỗi mức ≥ 2 có ít nhất một liên kết |
| `emission_factors` | year, grid_factor_kgco2_per_kwh, source_url | Tham số cấu hình có nguồn |
| `financing_products`, `product_versions` | id, lender_org_id, type, eligibility_json, pricing_json, green_rule_json, sla_json, status, effective_from/to | Báo giá tham chiếu `product_version_id` |
| `rfqs`, `rfq_responses` | id, receivable_id, seller_org_id, product_version_ids, state, expires_at; response: lender_org_id, advance_pct, rate, fees_vnd, conditions, valid_until | Tối đa một RFQ `OPEN` cho mỗi khoản phải thu |
| `funding_applications` | id, receivable_id, lender_org_id, rfq_id, state, idempotency_key, external_ref | Unique partial index: một hồ sơ hoạt động cho mỗi khoản phải thu |
| `offers` | id, application_id, advance_vnd, fees_vnd, rate_basis, maturity, expires_at, terms_version | Giá do đối tác cung cấp |
| `credit_limits` | id, lender_org_id, borrower_org_id, amount_vnd, valid_until, source_event_id | Chỉ tạo từ dữ liệu đối tác |
| `early_payment_offers` | id, buyer_org_id, receivable_id, discount_rule, pay_by, state, payment_evidence_id | Loại trừ với hồ sơ tài trợ hoạt động |
| `settlement_events` | id, application_id, event_type, amount_vnd, occurred_at, external_event_id | `external_event_id` duy nhất theo đối tác |
| `accounting_connections`, `ledger_open_items` | connection: org_id, provider, method, status, last_synced_at; item: type (AR/AP), counterparty_tax_code, doc_no, amount_vnd, due_date, paid_vnd | Chỉ đọc; xóa theo chính sách khi ngắt kết nối |
| `cashflow_forecasts` | id, org_id, as_of, horizon, scenario, daily_series_json, model_version, inputs_hash | Lưu sai số khi có dữ liệu thực tế |
| `audit_events`, `outbox_events` | id, actor, action, entity, before_hash, after_hash, created_at, correlation_id | Append-only; không lưu bí mật |

Số dư khoản tài trợ tính từ sự kiện đối tác và có bảng đối soát. Chứng từ lưu trong object storage riêng tư; DB chỉ giữ khóa đối tượng. Chính sách lưu/xóa thiết kế theo từng loại dữ liệu.

## 13. API và tích hợp

API JSON `/v1`, OpenAPI là hợp đồng nguồn. Mọi POST tạo nghiệp vụ nhận `Idempotency-Key` và trả `request_id`. Thời gian lưu UTC, hiển thị `Asia/Ho_Chi_Minh`; tiền là số nguyên VND. Phân trang bằng cursor; `409` cho xung đột trạng thái/phiên bản; `422` cho dữ liệu không hợp lệ.

| Nhóm | Endpoint tiêu biểu |
| --- | --- |
| Phiên và tổ chức | `POST /v1/sessions`, `GET /v1/me`, `POST /v1/organizations`, `POST /v1/organizations/{id}/members` |
| Hồ sơ/chứng từ | `POST /v1/receivables`, `GET /v1/receivables`, `POST /v1/receivables/{id}/documents`, `POST /v1/receivables/{id}/validate` |
| Bên mua | `POST /v1/receivables/{id}/buyer-invitation`, `POST /v1/receivables/{id}/buyer-decision`, `POST /v1/early-payment-offers`, `POST /v1/early-payment-offers/{id}/accept` |
| Chấm điểm | `POST /v1/organizations/{id}/credit-assessments`, `GET /v1/credit-assessments/{id}`, `POST /v1/credit-assessments/{id}/issue`, `POST /v1/credit-assessments/{id}/appeals`, `GET /v1/receivables/{id}/application-score` |
| ESG | `POST /v1/esg-assessments`, `POST /v1/esg-assessments/{id}/evidence`, `GET /v1/esg-assessments/{id}/suggestions`, `PUT /v1/esg-assessments/{id}/indicators/{code}`, `POST /v1/esg-assessments/{id}/issue`, `GET /v1/buyers/{id}/supply-chain-esg` |
| Marketplace | `GET/POST /v1/financing-products`, `POST /v1/financing-products/{id}/publish`, `GET /v1/receivables/{id}/matches`, `POST /v1/rfqs`, `POST /v1/rfqs/{id}/responses`, `POST /v1/rfqs/{id}/select`, `GET /v1/market-overview` |
| Chia sẻ và tài trợ | `POST /v1/consents`, `DELETE /v1/consents/{id}`, `POST /v1/funding-applications`, `GET /v1/funding-applications/{id}`, `POST /v1/offers/{id}/accept` |
| Tổng quan và kế toán | `GET /v1/dashboard`, `POST /v1/accounting-connections`, `POST /v1/accounting-connections/{id}/sync`, `POST /v1/accounting-imports`, `GET /v1/cashflow-forecasts/latest` |
| Dữ liệu ngoài | `GET /v1/organizations/{id}/external-profile`, `POST /v1/organizations/{id}/external-profile/disputes`, `GET/POST /v1/operations/data-sources` |
| Đối tác | `POST /v1/partner/events`, `GET /v1/partner/applications/{id}/package`, `GET /v1/partner/credit-assessments/{id}` (cần consent) |
| Vận hành | `GET /v1/operations/exceptions`, `POST /v1/operations/exceptions/{id}/resolve`, `GET /v1/audit-events`, `POST /v1/operations/scorecard-versions` |

**Webhook đối tác:** ký HMAC hoặc mTLS; có timestamp, nonce, event ID, schema version; từ chối replay. Lưu raw payload đã mã hóa trước khi xử lý; trả 2xx sau khi ghi bền vào inbox; worker xử lý idempotent, có retry và dead-letter queue. Đối soát hằng ngày với file/API đối tác. Đối tác chưa có API thì dùng cổng thao tác và file đối soát có kiểm soát hai người; không giả lập tích hợp.

**Job nền:** đồng bộ vnstock, crawl theo lịch và theo yêu cầu, đồng bộ kế toán, chấm lại điểm, tính dự báo, hết hạn RFQ/sản phẩm/điểm, EWS. Mọi job idempotent, có metric và cảnh báo lỗi.

## 14. Kiến trúc và vận hành

**Đề xuất triển khai:** frontend web (giữ thiết kế demo) + backend modular monolith + **dịch vụ Python cho dữ liệu/AI** (vnstock, crawler, trích xuất, scorecard, dự báo) giao tiếp qua queue + PostgreSQL + object storage riêng tư + queue/worker + email/SMS. Các module backend: Identity, Organization, Receivables, Documents, Buyer Confirmation, Consent, Credit Scoring, ESG, Marketplace, Funding, Partner Adapter, Settlement, Accounting Connector, Data Ingestion, Dashboard, Audit, Notifications. Bắt đầu với một codebase backend và một CSDL; chỉ tách thêm dịch vụ khi có nhu cầu đo được. Môi trường `dev`, `staging`, `production` tách dữ liệu và khóa bí mật. Dữ liệu demo chỉ tồn tại trong `dev`.

- Auth: OIDC hoặc tương đương; MFA cho owner, approver, analyst, product manager, reviewer, admin. RBAC kết hợp kiểm tra quyền theo bản ghi. Phiên có thời hạn, thu hồi token, rate limit, khóa tạm khi đăng nhập bất thường.
- TLS; mã hóa ổ đĩa/object storage; khóa trong secret manager; khóa API kế toán/đối tác mã hóa riêng; sao lưu có kiểm tra khôi phục; quét mã độc khi upload; URL chứng từ có hạn ngắn.
- Logs, metrics, tracing với `correlation_id`. Cảnh báo cho: backlog, webhook lỗi, đối soát lệch, truy cập bất thường, nguồn dữ liệu lỗi, drift điểm.
- Kiểm thử bắt buộc trước pilot: truy cập xuyên tổ chức, phân quyền theo consent, replay webhook, race condition (gửi trùng, chọn RFQ đồng thời), thay đổi hóa đơn sau xác nhận, tái lập điểm, khôi phục backup, đối soát tiền.

**Chỉ tiêu kỹ thuật ban đầu để đo (không phải cam kết):** API đọc p95 < 500 ms ở tải pilot; tính lại một điểm < 30 giây không kể thời gian AI trích xuất; 99,5% khả dụng hằng tháng sau pilot; RPO ≤ 24 giờ, RTO ≤ 4 giờ.

## 15. Điều kiện pháp lý và hợp đồng trước giao dịch thật

1. Pháp chế xác nhận FCC là bên cung cấp công nghệ/kết nối, và đánh giá hoạt động nào có thể bị coi là trung gian thanh toán, môi giới/tư vấn sản phẩm tài chính hoặc hoạt động có điều kiện. **Không mở luồng tiền qua tài khoản FCC.**
2. **Marketplace:** đánh giá việc hiển thị, so sánh và nhận phí/hoa hồng giới thiệu sản phẩm của nhiều tổ chức tài chính; quy tắc công bố thông tin sản phẩm; nhãn quảng cáo; trách nhiệm khi thông tin đối tác sai.
3. **Chấm điểm tín dụng:** đánh giá việc thu thập, xử lý và cung cấp điểm/xếp hạng doanh nghiệp cho tổ chức tín dụng có thuộc **hoạt động thông tin tín dụng** theo Nghị định 58/2021/NĐ-CP (và văn bản sửa đổi) hay không. Lựa chọn cấu trúc phù hợp: công cụ phân tích do tổ chức tài chính sử dụng, hợp tác với công ty thông tin tín dụng được cấp phép, hoặc xin phép. Báo cáo CIC chỉ dùng khi chủ thể tự cung cấp hoặc đối tác có quyền truy cập.
4. **Dữ liệu:** lập bản đồ dữ liệu cá nhân/doanh nghiệp, mục đích, căn cứ xử lý, bên nhận, thời hạn lưu, quyền chủ thể, quy trình sự cố. Đối chiếu Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP. Rà soát chuyển dữ liệu ra nước ngoài (cloud, dịch vụ AI).
5. **Thu thập dữ liệu ngoài:** điều khoản sử dụng từng nguồn crawl, quyền đối với cơ sở dữ liệu; **giấy phép vnstock và quyền dữ liệu của nguồn gốc** cho mục đích thương mại.
6. **ESG và tài chính xanh:** tránh tuyên bố “xanh” không có căn cứ (greenwashing). Ghi rõ điểm ESG của FCC là đánh giá theo khung nội bộ. Việc công nhận tín dụng/dự án xanh thuộc đối tác theo quy định hiện hành về quản lý rủi ro môi trường trong cấp tín dụng và tiêu chí phân loại xanh (cần xác định văn bản đang có hiệu lực khi ký pilot). Hệ số phát thải lấy từ công bố chính thức.
7. **AI:** rà soát nghĩa vụ minh bạch và quản lý rủi ro của hệ thống AI theo quy định hiện hành. Thông báo cho doanh nghiệp rằng có dùng AI và có quyền yêu cầu người xem xét lại.
8. Hợp đồng đối tác xác định ai xác minh khách hàng, kiểm tra hóa đơn, quyết định tín dụng, công bố giá, ký hợp đồng, giải ngân, thu hồi, xử lý khiếu nại, lưu trữ, báo cáo. Đối tác duyệt mẫu xác nhận bên mua, mẫu chia sẻ dữ liệu, tiêu chí chống tài trợ trùng và cách dùng điểm FCC.
9. Kiểm tra giá trị pháp lý của xác nhận, hợp đồng, chữ ký điện tử theo từng quy trình.

Văn bản tham chiếu: [Thông tư 20/2024/TT-NHNN về bao thanh toán](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=168109), [Luật Giao dịch điện tử 2023](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=165913), [Luật Bảo vệ dữ liệu cá nhân 2025](https://vbpl.vn/tw/Pages/vbpq-thuoctinh.aspx?ItemID=179252), [Nghị định 356/2025/NĐ-CP](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=187276), [Nghị định 52/2024/NĐ-CP về thanh toán không dùng tiền mặt](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=167087), Nghị định 58/2021/NĐ-CP về hoạt động thông tin tín dụng, Thông tư 96/2020/TT-BTC về công bố thông tin trên thị trường chứng khoán, Thông tư 133/2016/TT-BTC và chế độ kế toán doanh nghiệp hiện hành. Tham chiếu phương pháp: tài liệu 5C và khung ESG trong `document/`; [UB – chấm điểm tín dụng SME](https://ub.edu.vn/thu-vien-thuat-ngu/cham-diem-tin-dung-sme/); [CoreFinTech – chấm điểm tín dụng thông minh cho SME](https://corefintech.vn/cham-diem-tin-dung-thong-minh-cho-sme/); [DAT – ESG](https://datsolar.com/esg/); [AITCV – tiêu chuẩn ESG](https://aitcv.ac.vn/tieu-chuan-esg-la-gi-3-trong-tam-doanh-nghiep-can-tim-hieu-truoc-khi-chuyen-doi-theo-xu-the/); [vnstock](https://github.com/thinh-vu/vnstock). Kiểm tra lịch sử sửa đổi và hiệu lực của từng văn bản khi ký hợp đồng pilot.

## 16. Lộ trình triển khai và bàn giao

| Giai đoạn | Bàn giao | Điều kiện qua cổng |
| --- | --- | --- |
| 0 — chốt pilot | 1–2 bên mua đầu chuỗi (ưu tiên có ít nhất một bên niêm yết), 1–2 tổ chức tài chính, 5–10 nhà cung cấp; ngưỡng scorecard khởi tạo được đối tác góp ý; phê duyệt nguồn dữ liệu; giấy phép vnstock; ý kiến pháp lý mục 15.1–15.3 | Có đầu mối nghiệp vụ, bộ dữ liệu kiểm thử có nhãn, sandbox/file tích hợp |
| 1 — nền tảng và dữ liệu | Auth, tổ chức, phân quyền, consent, upload, hóa đơn, audit; adapter vnstock; registry nguồn và 2–3 nguồn crawl đã duyệt; Document AI cơ bản | Test quyền xuyên tổ chức; provenance đầy đủ; khôi phục dữ liệu |
| 2 — **P1: Chấm điểm + ESG** | Scorecard bên bán/bên mua/hồ sơ, giải thích, phát hành và xem xét lại; hồ sơ ESG, AI đề xuất, reviewer, tính điểm, báo cáo; Tổng quan (không dự báo) | F12–F19, F24 đạt trên dữ liệu kiểm thử; đối tác review 10+ báo cáo điểm mẫu |
| 3 — **P1: Marketplace và luồng tài trợ** | Sản phẩm, khớp, chi phí ước tính, RFQ, xác nhận bên mua, gửi hồ sơ, đề nghị, thanh toán sớm từ bên mua, thông báo | F05–F08, F20–F23 end-to-end trên dữ liệu giả lập có đủ nhánh lỗi |
| 4 — **P2: Kế toán và dự báo** | Một kết nối API hoặc nhập file cho phần mềm kế toán phổ biến nhất trong pilot; dự báo dòng tiền v1; EWS | F25–F26 trên dữ liệu thật của ít nhất một doanh nghiệp pilot |
| 5 — đối tác thật và pilot giới hạn | Adapter/webhook hoặc cổng thủ công, giải ngân/thu hồi, đối soát; giao dịch thật với hạn mức do đối tác quyết định; trực vận hành hằng ngày | Đối tác ký UAT; đối soát 100% giao dịch; không còn sai lệch tiền/trạng thái chưa giải quyết |

**Definition of Done cho mỗi chức năng:** có mô tả API/UI, migration, kiểm tra quyền và consent, audit, xử lý lỗi và retry, test nghiệp vụ có ý nghĩa (với điểm: bộ ca tính tay), log/metric, tài liệu vận hành và người chịu trách nhiệm. Không đánh dấu hoàn thành chỉ vì màn hình hiển thị đúng.

### KPI pilot

- **Luồng tài trợ:** số hồ sơ tạo/gửi/được xác nhận/được duyệt/được giải ngân; thời gian trung vị và p90 từng bước; tỷ lệ tranh chấp, trùng, phải bổ sung; tỷ lệ đối soát khớp.
- **Chấm điểm và ESG:** tỷ lệ điểm chính thức (đủ Coverage); thời gian từ nộp đủ chứng từ đến phát hành điểm; tỷ lệ reviewer giữ nguyên đề xuất AI; độ chính xác trích xuất; mức hữu ích do analyst đánh giá; số yêu cầu xem xét lại.
- **Marketplace:** số sản phẩm đang công bố; tỷ lệ khoản phải thu có ≥ 1 sản phẩm phù hợp; tỷ lệ RFQ có ≥ 2 báo giá; chênh lệch chi phí giữa báo giá tốt nhất và báo giá đầu tiên; tỷ lệ chuyển RFQ thành hồ sơ.
- **Dự báo:** sai số theo horizon; số cảnh báo dẫn tới hành động.
- **An toàn:** số sự cố bảo mật; số lần truy cập không có consent bị chặn.

Mục tiêu số cụ thể do các bên chốt **trước pilot** theo baseline. Chỉ mở rộng khi: không có sai lệch tiền chưa giải quyết; không có lỗ hổng truy cập chéo tổ chức nghiêm trọng; đối tác xác nhận chất lượng hồ sơ và điểm; nhà cung cấp chấp nhận chi phí thực tế.

## 17. Quyết định cần chốt để đội bắt đầu xây dựng

1. Ngành pilot và bên mua đầu chuỗi đầu tiên (có niêm yết hay không); loại hóa đơn/chứng từ chấp nhận.
2. Tổ chức tài chính đầu tiên, sản phẩm cụ thể sẽ đăng lên Marketplace, cách họ muốn dùng điểm FCC; API/file trao đổi.
3. Ngưỡng scorecard khởi tạo, bảng rủi ro ngành, trọng số điểm hồ sơ; ai là reviewer ESG/tín dụng (FCC hay đối tác).
4. Cấu trúc pháp lý cho chấm điểm (15.3) và Marketplace (15.2); mô hình doanh thu (phí SaaS, phí chấm điểm, phí giao dịch, hoa hồng) và cách công bố.
5. Giấy phép vnstock hoặc nhà cung cấp dữ liệu thay thế; danh sách nguồn crawl được duyệt.
6. Mô hình AI tự vận hành hay dịch vụ bên thứ ba; nơi lưu trữ dữ liệu; ngưỡng chính xác trích xuất.
7. Phần mềm kế toán ưu tiên kết nối theo khảo sát doanh nghiệp pilot.
8. Chính sách khi hóa đơn điều chỉnh/hủy, tranh chấp, tài trợ trùng, thanh toán một phần; thời hạn lưu dữ liệu; người phụ trách tuân thủ.

Các mục này là **đầu vào bắt buộc của pilot**, không phải lý do trì hoãn xây dựng nền tảng, scorecard, ESG và Marketplace trên staging. Khi chưa có đối tác tài trợ xác nhận, hệ thống chỉ chạy bằng dữ liệu giả lập và sản phẩm mẫu được gắn nhãn “MẪU”, không công bố khả năng giải ngân hay lãi suất thực tế.
