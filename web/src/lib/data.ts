/**
 * Dữ liệu minh họa cho bản mock — lấy theo bộ màn hình gợi ý và báo cáo FCC.
 * Không phải số liệu thật.
 */

/* ------------------------------------------------------------------ */
/* Nhà cung cấp: dự báo số dư tiền mặt 30 ngày (triệu đồng)            */
/* ------------------------------------------------------------------ */
export const SAFE_BALANCE = 800;
export const CASH_FORECAST = [
  1260, 1310, 1180, 1150, 1420, 1390, 1240, 1100, 1060, 980, 940, 880, 380, 450, 520, 610, 1480, 1460,
  1390, 1350, 1280, 1720, 1690, 1610, 1580, 1540, 1490, 1880, 1850, 1820,
];
export const forecastDates = CASH_FORECAST.map((_, i) => {
  // 16/10/2026 + i ngày
  const d = new Date(Date.UTC(2026, 9, 16 + i));
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
});

/* ------------------------------------------------------------------ */
/* Hóa đơn của nhà cung cấp                                            */
/* ------------------------------------------------------------------ */
export type InvoiceStage = "draft" | "wait" | "ver" | "elig" | "fund" | "paid" | "over";

export const STAGES: Record<InvoiceStage, { label: string; short: string; chip: string; done: number }> = {
  draft: { label: "Nháp", short: "Nháp", chip: "c-neu", done: 0 },
  wait: { label: "Chờ người mua xác nhận", short: "Chờ xác nhận", chip: "c-warn", done: 1 },
  ver: { label: "Đã xác thực", short: "Đã xác thực", chip: "c-ok", done: 3 },
  elig: { label: "Đủ điều kiện tài trợ", short: "Có thể tài trợ", chip: "c-info", done: 4 },
  fund: { label: "Đang tài trợ", short: "Đang tài trợ", chip: "c-ok", done: 5 },
  paid: { label: "Đã thanh toán", short: "Đã thanh toán", chip: "c-neu", done: 7 },
  over: { label: "Quá hạn", short: "Quá hạn 7 ngày", chip: "c-bad", done: 3 },
};

/** Bỏ tiền tố loại hình (CTCP, TNHH) cho gọn khi hiển thị trong bảng hẹp. */
export const shortName = (n: string) => n.replace(/^(CTCP|TNHH|Công ty TNHH|Công ty CP) /, "");

export type Invoice = {
  id: string;
  buyer: string;
  amount: number;
  issued: string;
  due: string;
  daysLeft: number | null;
  esg: number;
  risk: string;
  stage: InvoiceStage;
  ai?: boolean;
};

export const SUPPLIER_INVOICES: Invoice[] = [
  { id: "HD-0423", buyer: "CTCP Xây dựng Đông Á", amount: 430_000_000, issued: "15/10/2026", due: "13/12/2026", daysLeft: 59, esg: 78, risk: "A", stage: "draft" },
  { id: "HD-0422", buyer: "TNHH Kết cấu Thép Miền Trung", amount: 275_000_000, issued: "14/10/2026", due: "12/12/2026", daysLeft: 58, esg: 71, risk: "A-", stage: "draft" },
  { id: "HD-0421", buyer: "CTCP Xây dựng Đông Á", amount: 1_120_000_000, issued: "12/10/2026", due: "25/01/2027", daysLeft: 102, esg: 78, risk: "A", stage: "wait" },
  { id: "HD-0420", buyer: "CTCP Hạ tầng Bình Minh", amount: 690_000_000, issued: "10/10/2026", due: "08/01/2027", daysLeft: 85, esg: 62, risk: "B", stage: "wait" },
  { id: "HD-0419", buyer: "CTCP Logistics Cảng Xanh", amount: 210_000_000, issued: "09/10/2026", due: "07/12/2026", daysLeft: 53, esg: 66, risk: "B+", stage: "wait" },
  { id: "HD-0418", buyer: "CTCP Xây dựng Đông Á", amount: 2_000_000_000, issued: "15/10/2026", due: "13/01/2027", daysLeft: 90, esg: 78, risk: "A", stage: "elig", ai: true },
  { id: "HD-0412", buyer: "TNHH Kết cấu Thép Miền Trung", amount: 860_000_000, issued: "06/10/2026", due: "05/12/2026", daysLeft: 51, esg: 71, risk: "A-", stage: "elig", ai: true },
  { id: "HD-0410", buyer: "CTCP Hạ tầng Bình Minh", amount: 395_000_000, issued: "02/10/2026", due: "31/12/2026", daysLeft: 77, esg: 62, risk: "B", stage: "elig", ai: true },
  { id: "HD-0409", buyer: "TNHH Nội thất Phố Hội", amount: 180_000_000, issued: "01/10/2026", due: "30/11/2026", daysLeft: 46, esg: 58, risk: "C+", stage: "ver" },
  { id: "HD-0407", buyer: "CTCP Logistics Cảng Xanh", amount: 320_000_000, issued: "28/09/2026", due: "27/11/2026", daysLeft: 43, esg: 66, risk: "B+", stage: "ver" },
  { id: "HD-0406", buyer: "CTCP Xây dựng Đông Á", amount: 455_000_000, issued: "25/09/2026", due: "24/11/2026", daysLeft: 40, esg: 78, risk: "A", stage: "ver" },
  { id: "HD-0403", buyer: "TNHH Kết cấu Thép Miền Trung", amount: 260_000_000, issued: "22/09/2026", due: "21/11/2026", daysLeft: 37, esg: 71, risk: "A-", stage: "ver" },
  { id: "HD-0405", buyer: "CTCP Logistics Cảng Xanh", amount: 540_000_000, issued: "20/09/2026", due: "20/11/2026", daysLeft: 36, esg: 66, risk: "B+", stage: "fund" },
  { id: "HD-0401", buyer: "CTCP Xây dựng Đông Á", amount: 1_350_000_000, issued: "15/09/2026", due: "14/12/2026", daysLeft: 60, esg: 78, risk: "A", stage: "fund" },
  { id: "HD-0398", buyer: "TNHH Nội thất Phố Hội", amount: 315_000_000, issued: "09/08/2026", due: "08/10/2026", daysLeft: -7, esg: 58, risk: "C+", stage: "over" },
  { id: "HD-0392", buyer: "CTCP Xây dựng Đông Á", amount: 780_000_000, issued: "01/08/2026", due: "30/09/2026", daysLeft: null, esg: 78, risk: "A", stage: "paid" },
  { id: "HD-0388", buyer: "TNHH Kết cấu Thép Miền Trung", amount: 410_000_000, issued: "27/07/2026", due: "25/09/2026", daysLeft: null, esg: 71, risk: "A-", stage: "paid" },
  { id: "HD-0385", buyer: "CTCP Logistics Cảng Xanh", amount: 295_000_000, issued: "20/07/2026", due: "18/09/2026", daysLeft: null, esg: 66, risk: "B+", stage: "paid" },
];

/* ------------------------------------------------------------------ */
/* Marketplace: gói tài trợ do tổ chức tài chính công bố               */
/* ------------------------------------------------------------------ */
export type Offer = {
  id: string;
  ini: string;
  name: string;
  type: string;
  rate: number; // %/năm sau ưu đãi ESG (nếu có)
  ratio: number; // tỷ lệ ứng trước
  days: number; // 0 = trong ngày
  fee: number; // phí xử lý trên số tiền ứng
  esg: string;
  green: boolean;
  collat: string;
  minEsg?: number;
  tone: "ok" | "info" | "violet" | "warn";
};

export const OFFERS: Offer[] = [
  { id: "xanh", ini: "XA", name: "Quỹ Đầu tư Xanh", type: "Quỹ đầu tư", rate: 5.9, ratio: 0.8, days: 1, fee: 0.002, esg: "Đã áp dụng", green: true, collat: "Không bắt buộc TSBĐ", minEsg: 65, tone: "ok" },
  { id: "thinhan", ini: "TA", name: "Ngân hàng TMCP Thịnh An", type: "Ngân hàng", rate: 6.5, ratio: 0.8, days: 2, fee: 0.003, esg: "−0,7%", green: true, collat: "Ưu tiên có TSBĐ", minEsg: 65, tone: "info" },
  { id: "haidang", ini: "HĐ", name: "Ngân hàng Hải Đăng", type: "Ngân hàng", rate: 6.8, ratio: 0.85, days: 2, fee: 0.003, esg: "−0,5%", green: true, collat: "TSBĐ khi trên 1,5 tỷ", minEsg: 65, tone: "info" },
  { id: "phusa", ini: "PS", name: "Quỹ Tín dụng Phù Sa", type: "Quỹ đầu tư", rate: 7.1, ratio: 0.7, days: 3, fee: 0.0025, esg: "Không", green: false, collat: "Không bắt buộc TSBĐ", tone: "violet" },
  { id: "vanloc", ini: "VL", name: "Công ty Tài chính Vạn Lộc", type: "Công ty tài chính", rate: 7.4, ratio: 0.75, days: 1, fee: 0.004, esg: "Không", green: false, collat: "Không bắt buộc TSBĐ", tone: "warn" },
  { id: "ankhang", ini: "AK", name: "Công ty Tài chính An Khang", type: "Công ty tài chính", rate: 8.1, ratio: 0.9, days: 0, fee: 0.005, esg: "Không", green: false, collat: "Không bắt buộc TSBĐ", tone: "warn" },
];

/** Tính chi phí ước tính theo biểu giá công bố (SPEC mục 6.3). */
export function estimate(offer: Offer, amount: number, days: number) {
  const adv = amount * offer.ratio;
  const fee = adv * offer.fee;
  const interest = (adv * offer.rate) / 100 * (days / 365);
  const net = adv - fee;
  const cost = fee + interest;
  const effective = net > 0 ? (cost / net) * (365 / days) : 0;
  return { adv, fee, interest, net, cost, back: amount - adv - interest, effective };
}

/* ------------------------------------------------------------------ */
/* ESG: 18 chỉ tiêu (Khung chấm điểm ESG cho SMEs vay vốn FCC)          */
/* ------------------------------------------------------------------ */
export type EsgItem = { code: string; name: string; score: number; evidence: string; next: string };

export const ESG_ITEMS: EsgItem[] = [
  { code: "E1", name: "Tiêu thụ điện, nhiên liệu", score: 3, evidence: "Hóa đơn năng lượng 12 tháng; có mục tiêu tiết kiệm 5%", next: "Lắp đồng hồ đo theo dây chuyền để chứng minh giảm cường độ" },
  { code: "E2", name: "Quản lý sử dụng nước", score: 3, evidence: "Nhật ký nước theo tháng, mục tiêu tuần hoàn", next: "Kiểm tra độc lập kết quả tuần hoàn" },
  { code: "E3", name: "Phát thải & hiệu quả tài nguyên", score: 3, evidence: "Kiểm kê nguồn phát thải chính, kế hoạch giảm", next: "Đo và công bố mức giảm phát thải" },
  { code: "E4", name: "Chất thải & nước thải", score: 4, evidence: "Hợp đồng thu gom, tỷ lệ tái chế phôi thép 62%", next: "" },
  { code: "E5", name: "Giấy phép & tuân thủ môi trường", score: 3, evidence: "Giấy phép môi trường; tự kiểm tra định kỳ", next: "Kiểm tra độc lập hằng năm" },
  { code: "E6", name: "Rủi ro khí hậu & chuỗi vật tư", score: 3, evidence: "Phương án ngập lụt cho kho, cập nhật 2026", next: "Diễn tập và đo chỉ số gián đoạn" },
  { code: "S1", name: "Hợp đồng & bảo hiểm lao động", score: 3, evidence: "100% hợp đồng, BHXH đầy đủ, rà soát quý", next: "Kiểm toán tỷ lệ tuân thủ" },
  { code: "S2", name: "An toàn & sức khỏe nghề nghiệp", score: 3, evidence: "Đánh giá nguy cơ, huấn luyện ATLĐ, nhật ký tai nạn", next: "Đối chiếu dữ liệu giảm sự cố" },
  { code: "S3", name: "Đào tạo & giữ chân nhân sự", score: 2, evidence: "Đào tạo cơ bản 8 giờ/người/năm", next: "Lập kế hoạch đào tạo có đánh giá năng lực" },
  { code: "S4", name: "Chất lượng, an toàn sản phẩm", score: 3, evidence: "ISO 9001, sổ khiếu nại có khắc phục", next: "Theo dõi tỷ lệ lỗi giảm theo quý" },
  { code: "S5", name: "Bảo vệ dữ liệu khách hàng", score: 3, evidence: "Phân quyền truy cập, sao lưu, đào tạo nhân viên", next: "Theo dõi sự cố và kiểm thử định kỳ" },
  { code: "S6", name: "Đối xử với khách hàng & NCC", score: 3, evidence: "Quy trình khiếu nại, theo dõi thời hạn giải quyết", next: "Đặt KPI thời hạn thanh toán NCC" },
  { code: "G1", name: "Minh bạch báo cáo tài chính", score: 3, evidence: "BCTC theo TT 200, đối soát hằng tháng", next: "Soát xét hoặc kiểm toán BCTC" },
  { code: "G2", name: "Thuế & nghĩa vụ công bố", score: 3, evidence: "Không nợ thuế, kiểm tra chéo hằng quý", next: "Kiểm soát nội bộ không sai lệch trọng yếu" },
  { code: "G3", name: "Sở hữu & giao dịch bên liên quan", score: 2, evidence: "Có danh sách chủ sở hữu hưởng lợi", next: "Ghi nhận và phê duyệt giao dịch bên liên quan" },
  { code: "G4", name: "Phòng chống tham nhũng", score: 3, evidence: "Quy tắc ứng xử, kênh tố cáo, đào tạo", next: "Kiểm tra hiệu lực định kỳ" },
  { code: "G5", name: "Phân quyền & quản trị rủi ro", score: 3, evidence: "Ma trận phê duyệt, hạn mức, kiểm tra chéo", next: "Kiểm tra định kỳ có kết quả" },
  { code: "G6", name: "Quản trị khiếu nại & khắc phục", score: 3, evidence: "Sổ phản ánh nội bộ, theo dõi đóng việc", next: "Thống kê và giảm tái diễn" },
];

export const ESG_ISSUES = ["E-Tài nguyên", "E-Môi trường", "S-Lao động", "S-Khách hàng", "G-Minh bạch", "G-Kiểm soát"];
export const ESG_INDUSTRIES = ["Sản xuất", "TM – dịch vụ", "Nông nghiệp – TP", "Công nghệ – số"];
/** Trọng số 6 vấn đề theo 4 nhóm ngành (%). */
export const ESG_WEIGHTS = [
  [20, 20, 15, 10, 20, 15],
  [10, 10, 15, 25, 20, 20],
  [15, 20, 15, 15, 20, 15],
  [5, 5, 15, 40, 20, 15],
];

export function esgBand(total: number) {
  if (total >= 80) return { band: "Tốt", medal: "Hạng Bạch kim", chip: "c-ok" };
  if (total >= 65) return { band: "Khá", medal: "Hạng Vàng", chip: "c-gold" };
  if (total >= 50) return { band: "Trung bình", medal: "Hạng Bạc", chip: "c-warn" };
  return { band: "Yếu", medal: "Hạng Đồng", chip: "c-bad" };
}

export function esgCompute(industry: number) {
  const w = ESG_WEIGHTS[industry];
  const K = [0, 1, 2, 3, 4, 5].map(
    (k) => (25 * (ESG_ITEMS[k * 3].score + ESG_ITEMS[k * 3 + 1].score + ESG_ITEMS[k * 3 + 2].score)) / 3,
  );
  const total = K.reduce((a, v, i) => a + (v * w[i]) / 100, 0);
  return { K, w, total };
}
