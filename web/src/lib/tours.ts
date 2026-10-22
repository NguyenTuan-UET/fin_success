import type { Role } from "@/lib/roles";

/**
 * Một bước hướng dẫn: mở trang `path` (nếu có), làm nổi bật phần tử đầu tiên tìm thấy và đang hiển thị
 * trong `target` (theo thứ tự ưu tiên), rồi giải thích. Không tìm thấy → hiện giữa màn hình.
 */
export type TourStep = {
  path?: string;
  target?: string[];
  title: string;
  body: string;
  /** Thao tác cụ thể trên màn hình này. */
  tips?: string[];
};

const HEADER = [".ph", "#main h1"];
const NAV = [".side .nav", ".menu-btn"];
const KPI = [".grid-kpi"];
const TODO = ['section[aria-labelledby="todo-title"]', "#main section.card.empty"];

const welcome = (who: string, n: number): TourStep => ({
  title: `Chào mừng đến với FCC · ${who}`,
  body: `Hướng dẫn này đưa bạn đi qua ${n} bước: các màn hình chính, mỗi màn hình dùng để làm gì và thao tác thế nào. Hệ thống tự chuyển trang cho bạn.`,
  tips: ["Bấm “Tiếp” hoặc phím → để sang bước sau, phím ← để quay lại.", "Bấm “Bỏ qua” hoặc Esc để thoát bất cứ lúc nào."],
});

const nav = (extra: string): TourStep => ({
  target: NAV,
  title: "Menu chức năng",
  body: `Mọi chức năng nằm ở menu bên trái. ${extra}`,
  tips: ["Số trên một mục menu là số việc đang chờ bạn xử lý ở mục đó.", "Trên điện thoại: bấm nút ☰ ở góc trái để mở menu."],
});

const common = (home: string): TourStep[] => [
  {
    path: home,
    target: ['[data-tour="bell"]'],
    title: "Thông báo",
    body: "Chuông báo khi có việc mới: hóa đơn cần xác nhận, báo giá về, hồ sơ được duyệt, tiền về…",
    tips: ["Chấm cam trên chuông = có thông báo chưa đọc.", "Bấm vào một thông báo để tới thẳng màn hình liên quan."],
  },
  {
    target: ['[data-tour="assistant"]', '[data-tour="help"]'],
    title: "Trợ lý FCC",
    body: "Trợ lý đọc số liệu của chính bạn để trả lời: dòng tiền, hạn mức, lãi suất, tình trạng hóa đơn, giải thích thuật ngữ.",
    tips: ["Bấm “Hỏi trợ lý” rồi gõ câu hỏi hoặc chọn câu hỏi gợi ý.", "Câu trả lời có đường dẫn tới đúng màn hình cần thao tác."],
  },
  {
    target: ['[data-tour="security"]', '[data-tour="user"]'],
    title: "Bảo mật tài khoản (MFA)",
    body: "Các thao tác quan trọng (xác nhận hóa đơn, chọn báo giá, chấp thuận đề nghị, giải ngân, chia sẻ dữ liệu…) yêu cầu mã xác thực hai lớp.",
    tips: ["Vào “Bảo mật” → bật MFA → quét mã QR bằng ứng dụng Authenticator.", "Trên điện thoại: vào Cài đặt → “Bảo mật tài khoản (MFA)”."],
  },
  {
    target: ['[data-tour="help"]'],
    title: "Hoàn tất hướng dẫn",
    body: "Bạn đã đi qua các chức năng chính. Muốn xem lại lúc nào, bấm nút “Hướng dẫn sử dụng” này.",
  },
];

const supplier: TourStep[] = [
  {
    path: "/supplier",
    target: NAV,
    title: "Menu chức năng",
    body: "Mọi chức năng nằm ở menu bên trái. Quy trình chính: Hóa đơn → Marketplace (chọn gói tài trợ) → Hồ sơ tài trợ → Giải ngân & thu hồi.",
    tips: ["Số trên một mục menu là số việc đang chờ bạn xử lý ở mục đó.", "Trên điện thoại: bấm nút ☰ ở góc trái để mở menu."],
  },
  {
    target: KPI,
    title: "Chỉ tiêu vốn lưu động",
    body: "Tóm tắt nhanh: khoản phải thu đang mở, công nợ phải trả, số tiền đang được tài trợ và tiền mặt bạn khai báo.",
  },
  {
    target: TODO,
    title: "Việc cần làm hôm nay",
    body: "FCC gom các việc cần bạn xử lý: hóa đơn nháp chưa gửi, hóa đơn bị tranh chấp, báo giá mới, đề nghị tài trợ sắp hết hạn…",
    tips: ["Bấm vào một ô để mở thẳng màn hình xử lý việc đó."],
  },
  {
    path: "/supplier/settings",
    target: HEADER,
    title: "Bước 1 · Hoàn thiện hồ sơ tổ chức",
    body: "Nên làm đầu tiên: hồ sơ đầy đủ giúp điểm tín dụng chính xác hơn và tổ chức tài chính tin cậy hơn.",
    tips: [
      "Khai năm thành lập, số lao động, ngành nghề; nhập website nếu muốn FCC đọc chứng nhận công bố.",
      "Nộp KYC để FCC xác minh doanh nghiệp.",
      "Mời đồng nghiệp: nhập email và chọn vai trò (Người lập hồ sơ không được phê duyệt).",
      "Xem dữ liệu công khai FCC có về bạn; nếu sai, bấm “Khiếu nại”.",
    ],
  },
  {
    path: "/supplier/invoices",
    target: HEADER,
    title: "Bước 2 · Quản lý hóa đơn",
    body: "Theo dõi vòng đời từng hóa đơn: nháp → chờ bên nhập khẩu xác nhận → đã xác nhận → tài trợ → thanh toán.",
    tips: [
      "Bấm vào một hóa đơn để xem chi tiết và chứng từ.",
      "Gửi hóa đơn cho bên nhập khẩu xác nhận; chỉ hóa đơn đã xác nhận mới được đem đi tài trợ.",
      "Nếu bên nhập khẩu tranh chấp: sửa thông tin rồi gửi lại.",
      "Mở chi tiết hóa đơn để thêm chứng từ hải quan (tờ khai, vận đơn…) — cần để gửi yêu cầu báo giá.",
    ],
  },
  {
    path: "/supplier/invoices/upload",
    target: HEADER,
    title: "Tải hóa đơn bằng OCR/AI",
    body: "Thay vì nhập tay, tải file hóa đơn để hệ thống tự đọc các trường.",
    tips: [
      "Chọn file XML, ảnh hoặc PDF hóa đơn.",
      "Kiểm tra lại số liệu AI đọc được, sửa nếu sai, rồi mới lưu.",
      "Đính kèm chứng từ gốc: hợp đồng ngoại thương, chứng từ giao hàng. Hệ thống tự chặn hóa đơn trùng.",
    ],
  },
  {
    path: "/supplier/marketplace",
    target: HEADER,
    title: "Bước 3 · Marketplace: chọn gói tài trợ",
    body: "So sánh các gói do tổ chức tài chính công bố. FCC tính sẵn số tiền thực nhận và tổng chi phí của từng gói.",
    tips: [
      "Chọn một hóa đơn đã được bên nhập khẩu xác nhận.",
      "Chọn tối đa 3 gói phù hợp và gửi yêu cầu báo giá (RFQ).",
      "Khi báo giá về, so sánh và bấm “Chọn báo giá” (cần MFA).",
    ],
  },
  {
    path: "/supplier/funding",
    target: HEADER,
    title: "Bước 4 · Hồ sơ tài trợ",
    body: "Xem điểm tín dụng 5C, xếp hạng và lý do; theo dõi quá trình thẩm định của tổ chức tài chính.",
    tips: [
      "Khi có đề nghị chính thức: kiểm tra điều khoản rồi “Chấp thuận” trước hạn (cần MFA).",
      "Không đồng ý với điểm: gửi “Yêu cầu xem xét lại”.",
      "Thiếu dữ liệu hiển thị “Chưa xác minh”, không phải điểm 0.",
    ],
  },
  {
    path: "/supplier/disbursement",
    target: HEADER,
    title: "Bước 5 · Giải ngân & thu hồi",
    body: "Theo dõi vòng đời từng khoản tài trợ và xem tiền sẽ được phân bổ thế nào khi bên nhập khẩu thanh toán.",
    tips: ["Chấp thuận đề nghị chính thức ngay tại đây nếu chưa làm ở Hồ sơ tài trợ.", "Khi bên nhập khẩu trả tiền: thu theo thứ tự phí → lãi → gốc, phần dư được hoàn lại cho bạn."],
  },
  {
    path: "/supplier/esg",
    target: HEADER,
    title: "ESG & Xanh",
    body: "Điểm ESG tốt có thể giúp nhận ưu đãi lãi suất xanh.",
    tips: ["Khai hồ sơ ESG và tải bằng chứng lên.", "Điểm chính thức do FCC thẩm định và phát hành."],
  },
  {
    path: "/supplier/accounting",
    target: HEADER,
    title: "Kế toán & dòng tiền",
    body: "Theo dõi công nợ, bút toán đề xuất và dự báo dòng tiền các tuần tới.",
    tips: ["Bấm “Nhập từ tệp CSV” (xuất từ phần mềm kế toán) hoặc “Thêm từng khoản”.", "Khai số dư tiền và chi định kỳ để dự báo dòng tiền chính xác hơn."],
  },
  ...common("/supplier"),
];

const buyer: TourStep[] = [
  { path: "/buyer", ...nav("Việc chính của bên nhập khẩu: xác nhận hóa đơn đơn vị xuất khẩu gửi và ghi nhận thanh toán.") },
  {
    target: KPI,
    title: "Chỉ tiêu thanh toán",
    body: "Tóm tắt: khoản phải trả đã xác nhận, hóa đơn chờ bạn xác nhận, số đơn vị xuất khẩu và xếp hạng thanh toán của bạn (tham khảo).",
  },
  {
    target: TODO,
    title: "Việc cần làm hôm nay",
    body: "Các việc đang chờ bạn: hóa đơn cần xác nhận, khoản sắp đến hạn thanh toán…",
    tips: ["Bấm vào một ô để mở thẳng màn hình xử lý việc đó."],
  },
  {
    path: "/buyer/settings",
    target: HEADER,
    title: "Bước 1 · Hoàn thiện hồ sơ tổ chức",
    body: "Khai đủ hồ sơ, nộp KYC và mời đồng nghiệp tham gia.",
    tips: [
      "Mời thành viên: nhập email và chọn vai trò (Người phê duyệt mới được xác nhận hóa đơn).",
      "Doanh nghiệp niêm yết: khai mã chứng khoán; sau khi FCC xác minh, dữ liệu được lấy tự động, bấm “Làm mới ngay” để lấy ngay.",
    ],
  },
  {
    path: "/buyer/invoices",
    target: HEADER,
    title: "Bước 2 · Xác nhận hóa đơn",
    body: "Đơn vị xuất khẩu gửi hóa đơn để bạn xác nhận khoản nợ là đúng. Xác nhận nhanh giúp đơn vị xuất khẩu được tài trợ sớm.",
    tips: [
      "Mở hóa đơn, đối chiếu với chứng từ, rồi “Xác nhận” hoặc “Tranh chấp” kèm lý do (cần MFA).",
      "Bên nhập khẩu cũng có thể thêm tờ khai nhập khẩu và xác nhận nhận hàng ở mục Chứng từ hải quan.",
      "Khi đã trả tiền: “Ghi nhận đã thanh toán” với số tiền, ngày, mã giao dịch.",
      "Lưu ý: hồ sơ chỉ tất toán khi tổ chức tài chính xác nhận tiền về.",
    ],
  },
  {
    path: "/buyer/marketplace",
    target: HEADER,
    title: "Bước 3 · Chương trình thanh toán sớm",
    body: "Hỗ trợ chuỗi cung ứng: đề nghị thanh toán sớm cho đơn vị xuất khẩu để đổi lấy chiết khấu.",
    tips: ["Tạo đề nghị thanh toán sớm cho đơn vị xuất khẩu.", "Khi đơn vị xuất khẩu chấp nhận và bạn đã trả, ghi nhận đã thanh toán."],
  },
  {
    path: "/buyer/esg",
    target: HEADER,
    title: "ESG chuỗi cung ứng",
    body: "Xem mức độ bền vững của các đơn vị xuất khẩu đã đồng ý chia sẻ ESG. Đơn vị xuất khẩu xanh = ESG chính thức ≥ 65, còn hiệu lực, không có cờ trọng yếu.",
  },
  {
    path: "/buyer/accounting",
    target: HEADER,
    title: "Kế toán",
    body: "Theo dõi công nợ và dòng tiền. FCC chỉ đọc dữ liệu, không ghi vào sổ kế toán của bạn.",
    tips: ["Bấm “Nhập từ tệp CSV” (xuất từ phần mềm kế toán) hoặc “Thêm từng khoản”."],
  },
  ...common("/buyer"),
];

const lender: TourStep[] = [
  { path: "/lender", ...nav("Quy trình chính: đăng sản phẩm → trả báo giá → thẩm định hồ sơ → giải ngân → thu hồi → giám sát.") },
  {
    target: KPI,
    title: "Chỉ tiêu danh mục",
    body: "Tóm tắt: dư nợ đang tài trợ, hồ sơ chờ xử lý, hồ sơ đã tất toán và số sản phẩm đang công bố.",
  },
  {
    target: TODO,
    title: "Việc cần làm hôm nay",
    body: "Các việc đang chờ: RFQ cần báo giá, hồ sơ cần thẩm định, khoản cần giải ngân…",
    tips: ["Bấm vào một ô để mở thẳng màn hình xử lý việc đó."],
  },
  {
    path: "/lender/settings",
    target: HEADER,
    title: "Bước 1 · Hồ sơ tổ chức & xác minh",
    body: "Tổ chức tài chính cần được FCC xác minh trước khi đăng sản phẩm hoặc trả báo giá.",
    tips: [
      "Khai đủ hồ sơ, nộp KYC và chờ FCC xác minh.",
      "Mời thành viên: Chuyên viên thẩm định, Quản lý sản phẩm.",
      "Tích hợp hệ thống: tạo khóa tích hợp (API) và đặt địa chỉ nhận webhook.",
    ],
  },
  {
    path: "/lender/marketplace",
    target: HEADER,
    title: "Bước 2 · Sản phẩm tài trợ",
    body: "Tạo sản phẩm để xuất hiện trên Marketplace của doanh nghiệp.",
    tips: [
      "Khai điều kiện, biểu giá, thời gian phản hồi (SLA) và ưu đãi xanh.",
      "Sản phẩm mới hoặc sửa đổi phải được FCC duyệt mới hiển thị.",
    ],
  },
  {
    path: "/lender/appraisal",
    target: HEADER,
    title: "Bước 3 · Thẩm định, giải ngân & thu hồi",
    body: "Nơi xử lý toàn bộ hồ sơ doanh nghiệp gửi tới.",
    tips: [
      "RFQ chờ báo giá: trả báo giá (lãi suất, % ứng trước) hoặc từ chối.",
      "Hàng đợi hồ sơ: bắt đầu thẩm định, xem điểm, chứng từ gốc, tài sản bảo đảm → ra đề nghị chính thức hoặc từ chối.",
      "Sau khi doanh nghiệp chấp thuận: “Ghi nhận giải ngân” (cần MFA).",
      "Khi tiền về: nhập số tiền thu hồi; có phần dư thì ghi nhận đã hoàn.",
    ],
  },
  {
    path: "/lender/monitoring",
    target: HEADER,
    title: "Giám sát & cảnh báo sớm (EWS)",
    body: "Sau giải ngân, hệ thống theo dõi tình trạng hóa đơn, lịch sử thanh toán của bên nhập khẩu và mức tập trung rủi ro; cảnh báo kèm giải thích và đề xuất, bạn quyết định biện pháp.",
  },
  {
    path: "/lender/esg",
    target: HEADER,
    title: "ESG & Xanh",
    body: "ESG của doanh nghiệp trong hồ sơ bạn nhận, theo quyền chia sẻ. ESG là đầu vào bổ trợ, không thay thế phân tích dòng tiền.",
  },
  {
    path: "/lender/accounting",
    target: HEADER,
    title: "Kế toán được chia sẻ",
    body: "Công nợ và dòng tiền doanh nghiệp chia sẻ khi gửi hồ sơ. Quyền xem kết thúc khi doanh nghiệp thu hồi hoặc hết hạn.",
  },
  ...common("/lender"),
];

const admin: TourStep[] = [
  { path: "/admin", ...nav("Trang đầu tiên “Việc cần xử lý” gom mọi hàng đợi của nhân sự FCC.") },
  {
    target: KPI,
    title: "Chỉ số vận hành",
    body: "Số việc đang chờ (tổ chức chờ xác minh, sản phẩm chờ duyệt, hóa đơn có cờ, hồ sơ ESG chưa phát hành) và chỉ số nền tảng: người dùng, khoản phải thu, giá trị giải ngân, tỷ lệ phê duyệt, tỷ lệ tranh chấp.",
    tips: [
      "Bên dưới là các hàng đợi: xác minh tổ chức tài chính, duyệt KYC, duyệt sản phẩm, cờ hóa đơn bất thường.",
      "Chấm điểm: phát hành điểm chính thức (cần MFA), xử lý yêu cầu xem xét lại.",
    ],
  },
  {
    path: "/admin/members",
    target: HEADER,
    title: "Thành viên & quyền",
    body: "Quản lý tài khoản nhân sự FCC: Quản trị, Thẩm định tín dụng/ESG, Vận hành, Chủ mô hình chấm điểm, Kiểm toán (chỉ đọc).",
  },
  {
    path: "/admin/orgs",
    target: HEADER,
    title: "Tổ chức",
    body: "Tổ chức đã đăng ký, trạng thái xác minh pháp nhân và KYC người đại diện. Việc xác minh thực hiện ở mục Việc cần xử lý.",
  },
  {
    path: "/admin/esg",
    target: HEADER,
    title: "Thẩm định ESG",
    body: "Thẩm định bằng chứng ESG doanh nghiệp nộp và phát hành điểm ESG chính thức.",
  },
  {
    path: "/admin/sources",
    target: HEADER,
    title: "Nguồn dữ liệu công khai",
    body: "Nguồn chưa được duyệt thì không chạy.",
    tips: [
      "Duyệt hoặc chặn từng nguồn (cần MFA và ghi căn cứ).",
      "Ghi kết quả tra cứu thủ công kèm URL; xử lý khiếu nại của doanh nghiệp.",
      "Xác minh mã chứng khoán bên nhập khẩu khai báo.",
    ],
  },
  {
    path: "/admin/revenue",
    target: HEADER,
    title: "Doanh thu & biểu phí",
    body: "Tạo biểu phí mới có ngày hiệu lực (không sửa biểu cũ), xem doanh thu theo nguồn, chạy tính phí hằng tháng.",
  },
  {
    path: "/admin/audit",
    target: HEADER,
    title: "Nhật ký kiểm toán",
    body: "Mọi thao tác đều được ghi lại. Lọc theo thời gian và kiểm tra toàn vẹn chuỗi băm.",
  },
  {
    path: "/admin/settings",
    target: HEADER,
    title: "Hồ sơ FCC & chia sẻ",
    body: "Hồ sơ tổ chức FCC, quyền chia sẻ dữ liệu và nhật ký hoạt động.",
  },
  ...common("/admin"),
];

const withWelcome = (who: string, steps: TourStep[]): TourStep[] => [{ path: steps[0].path, ...welcome(who, steps.length + 1) }, ...steps];

export const TOURS: Record<Role, TourStep[]> = {
  supplier: withWelcome("Đơn vị xuất khẩu", supplier),
  buyer: withWelcome("Bên nhập khẩu", buyer),
  lender: withWelcome("Tổ chức tài chính", lender),
  admin: withWelcome("Quản trị FCC", admin),
};
