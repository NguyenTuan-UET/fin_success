/**
 * Từ điển thuật ngữ: giải thích ngắn bằng lời thường cho kế toán/CFO doanh nghiệp xuất khẩu.
 * Dùng chung cho <Term> và Trợ lý FCC.
 */
export const GLOSSARY = {
  dso: {
    term: "DSO",
    full: "Số ngày thu tiền bình quân",
    text: "Trung bình mất bao nhiêu ngày từ lúc xuất hóa đơn đến lúc nhận được tiền. Càng thấp, tiền về càng nhanh.",
  },
  dio: {
    term: "DIO",
    full: "Số ngày tồn kho bình quân",
    text: "Hàng nằm trong kho trung bình bao nhiêu ngày trước khi bán được.",
  },
  dpo: {
    term: "DPO",
    full: "Số ngày trả tiền bình quân",
    text: "Trung bình doanh nghiệp mất bao nhiêu ngày để trả tiền cho đơn vị xuất khẩu.",
  },
  ccc: {
    term: "Chu kỳ chuyển đổi tiền mặt",
    full: "CCC = DSO + DIO − DPO",
    text: "Số ngày tiền của bạn bị “kẹt” trong hàng tồn kho và công nợ trước khi quay về tài khoản.",
  },
  dscr: {
    term: "DSCR",
    full: "Hệ số khả năng trả nợ",
    text: "Dòng tiền tạo ra chia cho nghĩa vụ trả nợ trong kỳ. Từ 1,3 trở lên được coi là an toàn.",
  },
  ltv: {
    term: "LTV",
    full: "Tỷ lệ cho vay trên giá trị tài sản",
    text: "Phần trăm giá trị tài sản bảo đảm mà tổ chức tài chính chấp nhận tính vào hạn mức. Ví dụ nhà xưởng thường 70%.",
  },
  tsbd: {
    term: "TSBĐ",
    full: "Tài sản bảo đảm",
    text: "Tài sản (nhà xưởng, máy móc, hàng tồn kho…) dùng làm lớp bảo vệ thêm. Trên FCC, không có TSBĐ vẫn có thể được tài trợ nếu khoản phải thu tốt.",
  },
  fiveC: {
    term: "Mô hình 5C",
    full: "Character · Capacity · Capital · Collateral · Conditions",
    text: "Năm góc nhìn khi đánh giá tín dụng: uy tín, khả năng trả nợ, vốn, tài sản bảo đảm và điều kiện ngành/thị trường.",
  },
  cic: {
    term: "CIC",
    full: "Trung tâm Thông tin tín dụng",
    text: "Lịch sử vay và trả nợ của doanh nghiệp tại các ngân hàng. Nhóm 1 là tốt nhất (không nợ quá hạn).",
  },
  esg: {
    term: "ESG",
    full: "Môi trường · Xã hội · Quản trị",
    text: "Đo mức độ phát triển bền vững. Trên FCC, ESG từ 65 trở lên có thể được hưởng ưu đãi xanh do đối tác công bố.",
  },
  coverage: {
    term: "Độ bao phủ (Coverage)",
    full: "Tỷ lệ chỉ tiêu có bằng chứng",
    text: "Bao nhiêu phần trăm chỉ tiêu đã có chứng từ kiểm chứng. Điểm chỉ được coi là chính thức khi đủ ngưỡng (ESG ≥ 80%).",
  },
  ews: {
    term: "EWS",
    full: "Hệ thống cảnh báo sớm",
    text: "Theo dõi liên tục sau giải ngân: bên nhập khẩu trả chậm, doanh thu giảm, dữ liệu bất thường… để xử lý trước khi thành nợ xấu.",
  },
  tPlus: {
    term: "T+1 / T+2",
    full: "Thời gian giải ngân",
    text: "Tiền về tài khoản sau 1 hoặc 2 ngày làm việc kể từ khi được phê duyệt.",
  },
  riskScore: {
    term: "Risk Score",
    full: "Xếp hạng tham khảo FCC",
    text: "Điểm do FCC tính từ dữ liệu hóa đơn, tài chính và giao dịch. Chỉ là tham khảo, không phải quyết định tín dụng.",
  },
  advance: {
    term: "Tỷ lệ ứng trước",
    full: "Advance rate",
    text: "Phần trăm giá trị hóa đơn bạn nhận trước. Ví dụ hóa đơn 2 tỷ, ứng 80% → nhận 1,6 tỷ ngay.",
  },
  earlyPay: {
    term: "Chiết khấu thanh toán sớm",
    full: "Dynamic discounting",
    text: "Bên nhập khẩu trả tiền sớm hơn hạn, đơn vị xuất khẩu giảm một ít giá trị hóa đơn. Cả hai cùng có lợi.",
  },
  annualYield: {
    term: "Lợi suất quy năm",
    full: "= chiết khấu ÷ số ngày trả sớm × 365",
    text: "Quy đổi khoản tiết kiệm từ trả sớm về %/năm để so với lãi tiền gửi hoặc chi phí vốn.",
  },
  threeWay: {
    term: "Đối chiếu 3 chiều",
    full: "Hóa đơn · Đơn đặt hàng · Chứng từ giao hàng",
    text: "Ba chứng từ phải khớp nhau về số lượng, đơn giá, giá trị trước khi xác nhận khoản phải trả.",
  },
  ocr: {
    term: "OCR/AI",
    full: "Nhận dạng ký tự + trí tuệ nhân tạo",
    text: "Tự đọc thông tin trên hóa đơn PDF/ảnh. Trường có độ tin cậy thấp sẽ được tô màu để bạn kiểm tra lại.",
  },
  customsDeclaration: {
    term: "Tờ khai hải quan",
    full: "Tờ khai xuất khẩu / nhập khẩu",
    text: "Chứng từ khai báo hàng hóa với cơ quan hải quan. Mọi giao dịch xuất khẩu đều có tờ khai; đây là bằng chứng chính cho thấy hóa đơn là thật.",
  },
  clearance: {
    term: "Thông quan",
    full: "Hàng đã được hải quan cho phép xuất/nhập",
    text: "Tờ khai đã được cơ quan hải quan chấp nhận và hàng được phép đi. FCC chỉ ghi nhận thông tin bạn khai, chưa tự đối chiếu với hải quan.",
  },
  billOfLading: {
    term: "Vận đơn",
    full: "B/L, AWB, CMR…",
    text: "Chứng từ do hãng vận chuyển cấp, xác nhận hàng đã được giao cho họ vận chuyển.",
  },
  certificateOfOrigin: {
    term: "C/O",
    full: "Giấy chứng nhận xuất xứ",
    text: "Chứng nhận hàng hóa được sản xuất ở đâu, thường dùng để hưởng ưu đãi thuế quan.",
  },
  incoterms: {
    term: "Incoterms",
    full: "Điều kiện thương mại quốc tế (FOB, CIF…)",
    text: "Quy định bên nào chịu chi phí và rủi ro vận chuyển ở từng chặng của lô hàng.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
