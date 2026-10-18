# Phiếu nghiệm thu — đợt cập nhật 19/10/2026

**Dành cho:** tester. Tài liệu liệt kê những gì đã thay đổi, cách kiểm tra lại và kết quả mong đợi. Cột "Đạt?" để tester đánh dấu.

## 0. Trước khi bắt đầu

- **Tài khoản:** 4 tài khoản dùng thử (FCC, nhà cung cấp, bên mua, tổ chức tài chính), mật khẩu do ban tổ chức gửi riêng. Hướng dẫn chung: `README_SU_DUNG.md`.
- **MFA:** môi trường có đăng nhập bắt buộc bật xác thực 2 bước trước khi làm thao tác nhạy cảm (xác nhận hóa đơn, chấp thuận đề nghị, duyệt/xác minh của FCC, mời thành viên, đổi vai trò, tạo biểu phí). Quá 10 phút sẽ được hỏi lại mã.
- **Dùng hai tab/hai trình duyệt** (hoặc cửa sổ ẩn danh) cho các mục cần hai bên cùng thao tác, **không tải lại trang** trừ khi bước kiểm tra nói rõ.
- **Dữ liệu chỉ là thử nghiệm.** Phía ngân hàng là giả lập; không có giao dịch tiền thật.
- **Mã F trong tài liệu này** trùng với mã trong file phản hồi người dùng thử (`Kqua Test FCC.docx`), trừ mục 1 dùng mã T/F của báo cáo đánh giá — mỗi mục ghi rõ nguồn.

## 1. Phản hồi người dùng thử — lỗi nghiệp vụ

| # | Cách kiểm tra | Kết quả mong đợi | Đạt? |
|---|---|---|---|
| **F01** Bên mua giữ dữ liệu cũ | Bên mua mở *Xác nhận hóa đơn*. NCC tạo hóa đơn 10.000.000 và gửi. NCC chọn hóa đơn → *Điều chỉnh hóa đơn…* → 12.000.000, ghi lý do. | Trong ≤ ~10 giây, tab bên mua tự hiện hóa đơn mới rồi đổi thành 12.000.000, gắn "v2", "Đã điều chỉnh", có thời điểm cập nhật. Không cần tải lại. | ☐ |
| **F01** Xác nhận phiên bản cũ | Bên mua mở sẵn hóa đơn v1, NCC điều chỉnh lên v2, bên mua bấm xác nhận ngay khi chưa thấy cập nhật. | Hệ thống từ chối, báo hóa đơn vừa điều chỉnh lên v2 và yêu cầu xem lại. Nút ghi rõ phiên bản ("Xác nhận v2"). | ☐ |
| **F02** Bản nháp lộ cho bên mua | NCC lưu hóa đơn **bỏ chọn** "Gửi người mua xác nhận ngay" (Nháp). Bên mua mở *Xác nhận hóa đơn*, *Cài đặt* (nhật ký), *Marketplace*. | Bên mua không thấy hóa đơn nháp ở bất kỳ đâu: danh sách, nhật ký, số đếm. Sau khi NCC bấm *Gửi người mua xác nhận* thì mới xuất hiện. Hủy nháp trước khi gửi cũng không lộ. | ☐ |
| **F03** Số đếm Marketplace | NCC có 1 hóa đơn Chờ xác nhận + 1 Nháp. Xem số "hóa đơn tới bạn" của bên mua. | Chỉ đếm hóa đơn đã gửi (1), không đếm nháp. | ☐ |
| **F04** OCR sai MST | Tải ảnh/PDF có "Buyer tax code: 9980000002" (hoặc XML có MST thừa một chữ số). | Ô MST hiện lỗi đỏ ("MST có 11 chữ số…" nếu đọc thừa). Hệ thống **không tự đổi** sang doanh nghiệp khác; chỉ gợi ý nút "Bên mua … MST chỉ khác 1 chữ số" để người dùng bấm chọn. | ☐ |
| **F05** OCR sai hạn thanh toán | Tải hóa đơn có hạn in trên chứng từ; tải hóa đơn không có hạn (hoặc XML). | Có hạn in → điền đúng ngày in. Không có → ô **để trống**; có nút "+30/+45/+60/+90 ngày" và ô được gắn nhãn "Đề xuất — kiểm tra lại". Không còn tự cộng 60 ngày âm thầm. | ☐ |
| **F06** Nhãn tin cậy 100% | Xem kết quả OCR. | Không còn nhãn phần trăm. Mỗi trường có nhãn nguồn: "AI đọc — đối chiếu", "AI không chắc", "Đề xuất", "Bạn đã sửa" (XML: "Từ XML"). Phải tích xác nhận mới lưu được. | ☐ |
| **F07** AI khuyến nghị sai | NCC có hóa đơn Nháp + Chờ xác nhận. Mở trợ lý, hỏi "Nên tài trợ hóa đơn nào?" và thử diễn đạt khác ("hóa đơn nào có thể tài trợ?"). Sau đó cho bên mua xác nhận và hỏi lại. | Khi chưa có hóa đơn đã xác nhận: trả lời **chưa có hóa đơn đủ điều kiện** kèm lý do từng hóa đơn (nháp / chờ xác nhận…), nhất quán dù hỏi thế nào. Sau khi bên mua xác nhận: gợi ý đúng hóa đơn đó. Không xuất hiện mã kỹ thuật (BUYER_PENDING, DRAFT). | ☐ |
| **F08** Khẳng định đã đối chiếu | Đọc phần mô tả trang *Xác nhận hóa đơn* và *Tải hóa đơn*; xem chi tiết hóa đơn chưa có chứng từ. | Không còn câu "FCC đã đối chiếu sẵn…". Chứng từ hiện "Chưa có" hoặc "Đã tải lên — chưa đối chiếu nội dung"; ghi rõ đối chiếu thuế tự động chưa bật. | ☐ |
| **F14** Xem chứng từ gốc | Hóa đơn có tệp đính kèm → bấm *Xem bản gốc* (NCC; bên mua với hóa đơn **đã gửi**). | Mở được tệp. Bên mua không xem được tệp của hóa đơn nháp. FCC không xem được chứng từ hóa đơn. | ☐ |
| **F15** Bổ sung chứng từ | NCC mở hóa đơn đang chờ xác nhận, thiếu hợp đồng → *Chọn tệp* ở dòng "Hợp đồng". | Tải lên thành công, trạng thái đổi sang "Đã tải lên", bên mua nhận thông báo. Hóa đơn đã có hồ sơ tài trợ thì không bổ sung ở đây. | ☐ |
| **F16** Lịch sử điều chỉnh | Sau F01, xem chi tiết hóa đơn (cả hai bên). | Có mục "Lịch sử điều chỉnh": phiên bản, số tiền/hạn trước → sau, lý do, thời điểm, và ghi nếu xác nhận cũ mất hiệu lực. | ☐ |
| **F13** Tiến trình sai | Xem hóa đơn Nháp. | Bước hiện tại là "Gửi người mua xác nhận" ("Đang ở bước này"); bước "Người mua xác nhận" là "Chưa bắt đầu". Mỗi bước có Hoàn tất / Đang ở bước này / Chưa bắt đầu và mốc thời gian. | ☐ |
| **F29** Dự báo dòng tiền | Khai số dư nhưng chưa khai chi định kỳ; xem dashboard NCC và hỏi trợ lý "Khi nào tôi thiếu tiền?". | Có cảnh báo "chưa khai chi định kỳ…". Câu trả lời dùng "theo các khoản đã khai", không khẳng định chắc chắn không thiếu tiền. Có nút đặt **mức dự trữ tối thiểu** (lưu trên trình duyệt đó). | ☐ |
| **F17** Nút trợ lý tự hỏi | Dashboard NCC → nút *Hỏi trợ lý (chọn câu hỏi)*. | Chỉ mở khung trợ lý, không tự gửi câu hỏi. | ☐ |

## 2. Phản hồi người dùng thử — thao tác và giao diện

| # | Cách kiểm tra | Kết quả mong đợi | Đạt? |
|---|---|---|---|
| **F09** Từ chối sản phẩm/ghi chú FCC | Tài khoản FCC: *Việc cần xử lý* → bấm *Từ chối* (KYC), *Đã xem xét* (cờ), *Chấp nhận/Từ chối* (xem xét lại), hoặc *Xem và quyết định* → *Từ chối* (sản phẩm). | Hiện hộp thoại của ứng dụng có nhãn, đếm ký tự, nút Hủy/Gửi (Gửi bị khóa khi nhập < 5 ký tự), Esc để đóng. Không còn hộp thoại trình duyệt. Đối chiếu thuế có 3 lựa chọn (khớp / không khớp / đã hủy). | ☐ |
| **F30** Duyệt sản phẩm | FCC bấm *Xem và quyết định* ở sản phẩm chờ duyệt. | Thấy đủ: mô tả, ứng trước, lãi, phí, hạn mức, kỳ hạn, cam kết thời gian, ưu đãi xanh, hiệu lực — rồi mới Duyệt (cần MFA) hoặc Từ chối (kèm lý do). Tổ chức tài chính nhận được lý do từ chối. | ☐ |
| **F10** Tab vào menu ẩn | Thu hẹp cửa sổ < 1023px (hoặc dùng thiết bị di động). Đặt focus ở *Đăng xuất*, bấm Tab liên tục. | Focus không rơi vào mục menu nằm ngoài màn hình. Bấm nút menu → focus vào mục đầu của menu; Esc đóng menu và trả focus về nút menu. | ☐ |
| **F11** Số âm bị đổi dấu | Tải hóa đơn → nhập tay → "Tổng thanh toán" gõ `-100`. | Giữ nguyên `-100`, hiện lỗi "Số tiền không được âm", nút Lưu bị khóa. Thử thêm: chữ, số thập phân (`100,5`), số quá lớn → mỗi trường hợp có thông báo riêng. | ☐ |
| **F19** Tiền không phân nhóm | Gõ 12345678 vào ô tiền. | Hiện `12.345.678` ngay khi gõ, dòng dưới ghi "12.345.678 đ (12,3 tr)". | ☐ |
| **F21** Định dạng ngày | Chọn hạn 18/11/2026. | Dưới ô ngày có dòng đọc lại "Chủ nhật/…, ngày 18 tháng 11 năm 2026" (ô ngày có thể hiển thị mm/dd tùy trình duyệt, dòng đọc lại luôn rõ). | ☐ |
| **F22** Nút tệp tiếng Anh | Mở ô Hợp đồng/Biên bản giao nhận. | Nút "Chọn tệp", chữ "Chưa chọn tệp", ghi định dạng và dung lượng tối đa; thao tác được bằng bàn phím. | ☐ |
| **F18** Lỗi biểu giá | Tổ chức tài chính: *Tạo gói tài trợ*; nhập tối thiểu 10 triệu / tối đa 1 triệu, ứng trước 150%; bấm *Gửi FCC duyệt*. | Lỗi hiện **dưới từng trường sai** (kèm giá trị cho phép), focus nhảy tới trường sai đầu tiên, dữ liệu đã nhập được giữ nguyên. | ☐ |
| **F20** Khoản chi thiếu nhãn | *Kế toán* → *Thêm khoản chi*. | Có nhãn "Tên khoản chi", "Số tiền mỗi tháng (đ)", "Ngày thanh toán trong tháng" (1–28, có giải thích). Nhập ngày 32 → báo lỗi. Dòng để trống hoàn toàn bị bỏ qua khi lưu. | ☐ |
| **F23** Lời chào cắt tên | Đăng nhập tài khoản có tên dạng "Demo Giám đốc". | Lời chào và trợ lý dùng tên đầy đủ, không còn "Xin chào đốc". Phần đầu trang không lặp chức danh. | ☐ |
| **F24** Mã kỹ thuật | Xem cờ hóa đơn ở màn FCC, nhật ký, trả lời AI, vai trò. | Hiện nhãn tiếng Việt ("Thiếu chứng từ gốc", "Tạm dừng"…). Mã gốc chỉ xuất hiện khi rê chuột (tooltip). | ☐ |
| **F25** Bảng ngang màn hẹp | Bên mua, cửa sổ ~390px, mở *Xác nhận hóa đơn*. | Mỗi hóa đơn là một thẻ xếp dọc: mã, số tiền, hạn và nút Xác nhận/Hỏi lại cùng nằm trong thẻ, không phải cuộn ngang. | ☐ |
| **F26** Kế toán của tổ chức tài chính | Tài khoản tổ chức tài chính → menu *Kế toán được chia sẻ*. | Thấy danh sách doanh nghiệp đã chia sẻ dữ liệu kế toán (số chứng từ, phải thu/phải trả còn lại) và nút *Mở hồ sơ thẩm định*; chưa có thì có hướng dẫn, không phải màn hình trống. | ☐ |
| **F27** Tên "Cài đặt hệ thống" | FCC → menu cuối. | Đổi tên "Hồ sơ FCC & chia sẻ", tiêu đề trang khớp, có chỉ dẫn biểu phí / chấm điểm / thành viên nằm ở đâu. | ☐ |
| **F12** Người dùng và quyền | FCC → *Thành viên & quyền*. | Vào đúng trang: danh sách thành viên (tìm kiếm, lọc vai trò/MFA), mời, đổi vai trò, lịch sử thay đổi, ma trận quyền. | ☐ |
| **F28** Điểm khi chưa có bằng chứng | NCC → *ESG & Xanh* khi chưa tải bằng chứng; bên mua xem xếp hạng khi dữ liệu ít. | Hiện "Chưa đủ dữ liệu" / "Chưa xếp loại", không hiện 50/100 hay hạng BB như đã được đánh giá. | ☐ |

## 3. Phản hồi phần Kế toán (`Phần mục kế toán.docx`)

| Nhận xét | Cách kiểm tra | Kết quả mong đợi | Đạt? |
|---|---|---|---|
| Thanh đo tuổi nợ chưa trực quan | *Kế toán* → phần "Tuổi nợ" (cần có công nợ). | Một thanh xếp chồng theo tỷ trọng 4 nhóm (màu khác nhau) + bảng: số chứng từ, số tiền, %; có dòng cảnh báo khi có khoản quá hạn. | ☐ |
| Làm tròn tiền, có sai số không | Xem thẻ Tiền mặt / Phải thu / Phải trả. | Hiện số chính xác (ví dụ 5.555.555 đ); dạng rút gọn ("≈ 5,6 tr") chỉ ở dòng phụ. | ☐ |
| Bắt buộc khai theo mẫu | *Nhập từ tệp CSV* với file xuất từ phần mềm kế toán (cột tên khác, ngày dd/mm/yyyy, số có dấu chấm). | Hệ thống tự nhận cột, cho chọn lại nếu sai, xem trước 5 dòng, báo dòng lỗi và bỏ qua; nhập được. Không cần đúng file mẫu. Có thêm *Thêm từng khoản* để nhập tay. | ☐ |
| Bố cục chưa tối ưu | Xem trang Kế toán sau khi có dữ liệu. | "Khoản lớn nhất 90 ngày tới" và "Ngân hàng & dự báo đã lưu" nằm cạnh nhau (hai ô cùng hàng); màn hẹp tự xếp dọc. | ☐ |

## 4. Kiểm tra theo báo cáo đánh giá

| Mã | Cách kiểm tra | Kết quả mong đợi | Đạt? |
|---|---|---|---|
| **Điểm thiếu dữ liệu** | NCC/bên mua/FCC xem ESG, xếp hạng khi bao phủ 0%. | "Chưa đủ dữ liệu", không gán mức; nút phát hành chính thức khóa khi bao phủ < 80%. | ☐ |
| **Landing** | Mở trang chủ. | T+1, "1–2 ngày", ví dụ 2 tỷ/5,9% đều ghi là mục tiêu/minh họa kèm giả định (365 ngày, lãi cuối kỳ, chưa gồm phí/thuế). Không còn "AES-256", "eKYC", "chữ ký số" như đã có. | ☐ |
| **MFA phía máy chủ** | Tài khoản FCC chưa bật MFA hoặc quá 10 phút → thử xác minh tổ chức, duyệt sản phẩm, mời thành viên, đổi vai trò. | Bị từ chối, yêu cầu bật/nhập lại MFA. | ☐ |
| **Nhật ký ẩn dữ liệu** | FCC → *Nhật ký kiểm toán*. | Số tiền, lãi suất, điểm của tổ chức khác hiện "[số tiền]", "[lãi suất]", "[kết quả chấm điểm đã ẩn]". Có tìm kiếm, lọc, phân trang, nút *Kiểm tra chuỗi băm* (hợp lệ). | ☐ |
| **Quản trị tách trang** | FCC → các mục menu. | *Việc cần xử lý*, *Thành viên & quyền*, *Tổ chức*, *Thẩm định ESG*, *Nguồn dữ liệu công khai*, *Doanh thu & biểu phí*, *Nhật ký kiểm toán*, *Hồ sơ FCC & chia sẻ* đều mở đúng trang. | ☐ |
| **KPI vận hành** | *Việc cần xử lý* → "Chỉ số vận hành" với ít dữ liệu. | Tỷ lệ phê duyệt/tranh chấp hiện "—" kèm "Không đủ dữ liệu (cần ≥ 5 mẫu)" và tử/mẫu số; thời gian từng bước ghi số mẫu. | ☐ |
| **So sánh gói** | NCC có hóa đơn đã xác nhận → *Marketplace*. | Mỗi gói có thực nhận, lãi + phí tách riêng, tổng chi phí, chi phí hiệu dụng/năm; có dòng cơ sở tính và nêu thứ tự chỉ theo tiêu chí người dùng chọn. | ☐ |
| **Nguồn dữ liệu** | FCC → *Nguồn dữ liệu công khai* khi chưa có nguồn / chưa có nguồn tra cứu thủ công. | Có thông báo "chưa cấu hình nguồn" và hướng dẫn; biểu mẫu tra cứu bị khóa kèm lý do. | ☐ |
| **Nhãn giả lập** | Xem thanh bên mọi vai trò. | Có dòng "Ngân hàng giả lập · không có giao dịch tiền thật". | ☐ |
| **Phân quyền chéo (T02)** | NCC B thử mở/sửa/hủy hóa đơn của NCC A khi biết mã; tổ chức tài chính khác thử thao tác trên hồ sơ không thuộc mình; FCC thử tải chứng từ hóa đơn. | Bị từ chối / không thấy dữ liệu. | ☐ |
| **Đồng thời (T06)** | Hai tab cùng gửi một hóa đơn tới hai tổ chức tài chính; hoặc chọn hai báo giá cùng lúc. | Chỉ một hồ sơ được tạo, tab còn lại báo xung đột. | ☐ |
| **Mobile 360–430px (T12)** | Duyệt các trang chính ở khổ hẹp. | Không tràn ngang; bảng cuộn ngang được và focus được bằng Tab; ô chọn tháng phí có nhãn. | ☐ |

## 5. Dữ liệu niêm yết (bên mua là công ty đại chúng)

Đã cập nhật nhưng **chưa thử trên trình duyệt với máy chủ đang chạy** — tester cần kiểm tra kỹ phần này.

| # | Cách kiểm tra | Kết quả mong đợi | Đạt? |
|---|---|---|---|
| Làm mới theo yêu cầu | Bên mua đã khai mã chứng khoán và được FCC xác minh MST ↔ mã → *Cài đặt* → *Làm mới ngay*. | Cập nhật dữ liệu; lỗi (mã chưa xác minh, nguồn lỗi) hiện lý do, dữ liệu cũ được giữ. | ☐ |
| FCC lấy dữ liệu | FCC → *Nguồn dữ liệu công khai* → khối bên mua niêm yết → *Lấy dữ liệu ngay*. | Thấy thời điểm lấy, cảnh báo dữ liệu (ước tính, BCTC cũ, lệch cân đối), lỗi lần gần nhất. | ☐ |
| Đối chiếu ý kiến kiểm toán / diện giao dịch | Dữ liệu vừa nạp, FCC chưa đối chiếu. | Hai trường để **trống**, điểm bên mua ở mức **tạm tính** và có cờ — không mặc định là tốt. Sau khi FCC bấm *Xác nhận đã đối chiếu* (ghi nguồn ≥ 10 ký tự) thì tính điểm bình thường. | ☐ |
| Tự động nền | Không cần thao tác; để máy chủ chạy. | Trong giờ giao dịch (T2–T6, 9–15h) dữ liệu lấy lại sau khi cũ hơn 15 phút; ngoài giờ mỗi 6 giờ. | ☐ |

## 6. Phạm vi chưa nghiệm thu được / đã biết

- **OCR ảnh thật:** chưa thử với ảnh hóa đơn thật (phải gửi ra dịch vụ AI ngoài); mới kiểm bằng XML và bộ kiểm tra tự động. Tester nên thử bộ ảnh F04/F05 cũ và ghi lại kết quả. OCR dùng mô hình `gemma4:31b` qua Ollama.
- **Trình đọc màn hình thật** (NVDA, VoiceOver, TalkBack): chưa kiểm; mới có kiểm tra nhãn/vai trò tự động. Cần người thử tay.
- **Không có cập nhật realtime thật với dữ liệu niêm yết:** nhanh nhất ~15 phút trong giờ giao dịch, giá theo ngày. Vốn hóa và `debtService` vẫn là ước tính (có gắn nhãn).
- **Bù trừ công nợ (T08):** hệ thống chưa có nghiệp vụ riêng, chỉ phản ánh qua lệch đối soát.
- **Nhập ngày:** định dạng hiển thị trong ô ngày phụ thuộc trình duyệt (có thể mm/dd/yyyy); đã có dòng đọc lại bằng tiếng Việt để tránh nhầm.
- **F0 "giao diện còn AI, khó dùng":** nhận xét chung chưa có màn hình cụ thể nên chưa xử lý riêng; mời tester chỉ ra màn hình/thao tác cần cải thiện.
- **Mức dự trữ tối thiểu** lưu trên từng trình duyệt, không đồng bộ giữa thiết bị.
- **Ngoài phạm vi phần mềm** (nhóm dự án xử lý riêng): chỉnh nội dung hồ sơ dự thi, mô hình tài chính, rà soát pháp lý, giấy phép bên tài trợ, LOI từ khách hàng/đối tác.

## 7. Cách ghi nhận kết quả

Với mỗi mục không đạt, ghi: mã mục, tài khoản/vai trò, các bước đã làm, kết quả thực tế, ảnh chụp màn hình (và thời điểm nếu có thông báo lỗi). Mục chưa kiểm được ghi rõ lý do.
