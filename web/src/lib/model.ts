// Ánh xạ dữ liệu máy chủ sang cách hiển thị: giai đoạn hóa đơn, nhãn trạng thái, tên tổ chức.
import type { FundingApplication, Org, Receivable, ReceivableState } from "@fcc/domain/types";
import { daysFromNow } from "./format";

export interface StageInfo {
  label: string;
  short: string;
  chip: string;
}

export const RECEIVABLE_STAGE: Record<ReceivableState, StageInfo> = {
  DRAFT: { label: "Nháp", short: "Nháp", chip: "c-neu" },
  BUYER_PENDING: { label: "Chờ người mua xác nhận", short: "Chờ xác nhận", chip: "c-warn" },
  BUYER_CONFIRMED: { label: "Người mua đã xác nhận", short: "Có thể tài trợ", chip: "c-info" },
  BUYER_DISPUTED: { label: "Người mua tranh chấp", short: "Tranh chấp", chip: "c-bad" },
  SUBMITTED: { label: "Đã gửi hồ sơ tài trợ", short: "Đã gửi hồ sơ", chip: "c-info" },
  UNDER_REVIEW: { label: "Đang thẩm định", short: "Thẩm định", chip: "c-info" },
  OFFERED: { label: "Có đề nghị tài trợ", short: "Có đề nghị", chip: "c-ai" },
  ACCEPTED: { label: "Đã chấp thuận, chờ giải ngân", short: "Chờ giải ngân", chip: "c-ok" },
  FUNDED: { label: "Đang tài trợ", short: "Đang tài trợ", chip: "c-ok" },
  SETTLED: { label: "Đã tất toán", short: "Đã tất toán", chip: "c-neu" },
  EARLY_PAID: { label: "Bên mua trả sớm", short: "Trả sớm", chip: "c-neu" },
  REJECTED: { label: "Bị từ chối", short: "Bị từ chối", chip: "c-bad" },
  OVERDUE: { label: "Quá hạn", short: "Quá hạn", chip: "c-bad" },
  CANCELLED: { label: "Đã hủy", short: "Đã hủy", chip: "c-neu" },
} as Record<ReceivableState, StageInfo>;

/** Nhóm trạng thái để lọc ở màn Hóa đơn. */
export const STAGE_GROUPS: { key: string; label: string; states: ReceivableState[] }[] = [
  { key: "draft", label: "Nháp", states: ["DRAFT"] },
  { key: "wait", label: "Chờ xác nhận", states: ["BUYER_PENDING", "BUYER_DISPUTED"] },
  { key: "elig", label: "Có thể tài trợ", states: ["BUYER_CONFIRMED", "REJECTED"] },
  { key: "fund", label: "Đang tài trợ", states: ["SUBMITTED", "UNDER_REVIEW", "OFFERED", "ACCEPTED", "FUNDED"] },
  { key: "paid", label: "Đã thanh toán", states: ["SETTLED", "EARLY_PAID"] },
  { key: "over", label: "Quá hạn", states: ["OVERDUE"] },
];

export const APP_STATE_LABEL: Record<FundingApplication["state"], { label: string; chip: string }> = {
  SUBMITTED: { label: "Chờ thẩm định", chip: "c-warn" },
  UNDER_REVIEW: { label: "Đang thẩm định", chip: "c-info" },
  OFFERED: { label: "Đã có đề nghị", chip: "c-ai" },
  ACCEPTED: { label: "Đã chấp thuận", chip: "c-ok" },
  FUNDED: { label: "Đã giải ngân", chip: "c-ok" },
  SETTLED: { label: "Đã tất toán", chip: "c-neu" },
  REJECTED: { label: "Bị từ chối", chip: "c-bad" },
  WITHDRAWN: { label: "Đã rút", chip: "c-neu" },
};

export const orgName = (orgs: Org[], id: string) => orgs.find((o) => o.id === id)?.shortName ?? id;
export const daysLeft = (r: Receivable) => (["SETTLED", "EARLY_PAID", "CANCELLED"] as string[]).includes(r.state) ? null : daysFromNow(r.dueDate);

/** Tổng số tiền một danh sách khoản phải thu. */
export const sumAmount = (rs: Receivable[]) => rs.reduce((a, r) => a + r.amount, 0);

export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  factoring_recourse: "Bao thanh toán có truy đòi",
  factoring_nonrecourse: "Bao thanh toán miễn truy đòi",
  invoice_finance: "Tài trợ hóa đơn",
  reverse_factoring: "Tài trợ chuỗi cung ứng",
  green_loan: "Tín dụng xanh",
};

export const ratingTone = (r?: string) => (!r ? "c-neu" : ["AAA", "AA", "A"].includes(r) ? "c-ok" : ["BBB", "BB"].includes(r) ? "c-info" : "c-warn");

/** Nhãn tiếng Việt cho mã cờ hóa đơn; mã gốc chỉ hiện ở chi tiết kỹ thuật (title). */
export const FLAG_LABEL: Record<string, string> = {
  NO_SOURCE_DOCUMENT: "Thiếu chứng từ gốc",
  AMOUNT_ANOMALY: "Số tiền bất thường",
  BURST_SAME_BUYER: "Nhiều hóa đơn dồn dập cho cùng bên mua",
  NEW_BUYER_LARGE: "Hóa đơn lớn với bên mua mới",
  ROUND_LARGE_MANUAL: "Số tròn lớn nhập tay",
  FUTURE_ISSUE_DATE: "Ngày lập ở tương lai",
  CONCENTRATION: "Tập trung vào một bên mua",
  BUYER_LATE_HISTORY: "Bên mua có lịch sử trả chậm",
  BUYER_RATING_LOW: "Bên mua xếp hạng thấp",
  DISPUTE_ON_FUNDED: "Tranh chấp sau khi đã tài trợ",
  DUP: "Nghi trùng hóa đơn",
};
export const flagLabel = (code: string) => FLAG_LABEL[code] ?? "Cờ bất thường";

export const ASSESSMENT_KIND_LABEL: Record<string, string> = { supplier: "Nhà cung cấp", buyer: "Bên mua", application: "Hồ sơ tài trợ" };
