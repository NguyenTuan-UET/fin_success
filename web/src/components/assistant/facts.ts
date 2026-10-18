// Dữ kiện đưa cho trợ lý: chỉ số liệu có trên màn hình của người dùng (đã lọc theo quyền), tính bằng cùng công thức
// với giao diện. Mô hình AI chỉ được diễn giải các dữ kiện này; không có số nào do mô hình tự suy ra.
import { ewsAlerts } from "@fcc/domain/ews";
import { forecastCash } from "@fcc/domain/cashflow";
import { applicationScoreOf, buyerScoreOf, supplierScoreOf } from "@fcc/domain/engine";
import type { Org, Receivable } from "@fcc/domain/types";
import { APP_STATE_LABEL, RECEIVABLE_STAGE } from "@/lib/model";
import { date, vnd } from "@/lib/format";
import type { FccState } from "@/lib/session";
import { ROLES, type Role } from "@/lib/roles";

const name = (d: FccState, id: string) => d.orgs.find((o) => o.id === id)?.shortName ?? id;
const ACTIVE_APP = (s: string) => !["REJECTED", "WITHDRAWN"].includes(s);

/** Điều kiện gửi tài trợ — cùng quy tắc với nút "So sánh gói & yêu cầu tài trợ": bên mua đã xác nhận, chưa có hồ sơ đang hoạt động. */
export function fundingStatus(d: FccState, r: Receivable): { ok: boolean; reason: string } {
  if (d.applications.some((a) => a.receivableId === r.id && ACTIVE_APP(a.state))) return { ok: false, reason: "đã có hồ sơ tài trợ" };
  switch (r.state) {
    case "BUYER_CONFIRMED": return { ok: true, reason: "người mua đã xác nhận" };
    case "DRAFT": return { ok: false, reason: "còn là nháp — chưa gửi người mua xác nhận" };
    case "BUYER_PENDING": return { ok: false, reason: "đang chờ người mua xác nhận" };
    case "BUYER_DISPUTED": return { ok: false, reason: "người mua đang hỏi lại — cần điều chỉnh hoặc giải trình" };
    case "SETTLED": case "EARLY_PAID": return { ok: false, reason: "đã thanh toán" };
    case "OVERDUE": return { ok: false, reason: "đã quá hạn" };
    case "CANCELLED": return { ok: false, reason: "đã hủy" };
    default: return { ok: false, reason: "đang trong quy trình tài trợ" };
  }
}

/**
 * Trả lời "nên tài trợ hóa đơn nào" bằng quy tắc, không qua mô hình: lọc tập đủ điều kiện trước rồi mới xếp ưu tiên
 * (người mua xếp hạng cao, còn nhiều ngày đến hạn). Bảo đảm cùng câu trả lời với Marketplace dù hỏi theo cách nào.
 */
export function fundingAdvice(d: FccState, org: Org) {
  const mine = d.receivables.filter((r) => r.sellerId === org.id && r.state !== "CANCELLED");
  const rated = (id: string) => { const b = buyerScoreOf(d, id); return !b.official && b.coverage < 0.5 ? null : b; };
  const ok = mine.filter((r) => fundingStatus(d, r).ok).sort((a, b) => (rated(b.buyerId)?.score ?? 0) - (rated(a.buyerId)?.score ?? 0) || b.dueDate.localeCompare(a.dueDate));
  if (!ok.length) {
    const lines = mine.slice(0, 6).map((r) => `• ${r.code} (${vnd(r.amount)} đ): chưa tài trợ được vì ${fundingStatus(d, r).reason}.`);
    return {
      text: [`Hiện chưa có hóa đơn nào đủ điều kiện tài trợ — chỉ hóa đơn đã được người mua xác nhận mới gửi tổ chức tài chính được.`, ...lines, mine.some((r) => r.state === "DRAFT") ? "Bước tiếp theo: gửi hóa đơn nháp cho người mua xác nhận." : mine.some((r) => r.state === "BUYER_PENDING") ? "Bước tiếp theo: nhắc người mua xác nhận hóa đơn đang chờ." : ""].filter(Boolean).join("\n"),
      links: [{ href: "/supplier/invoices", label: "Hóa đơn" }],
    };
  }
  const top = ok.slice(0, 3).map((r, i) => { const b = rated(r.buyerId); return `${i + 1}. ${r.code} — ${name(d, r.buyerId)}, ${vnd(r.amount)} đ, hạn ${date(r.dueDate)}${b ? `, người mua xếp hạng tham khảo ${b.rating}` : ", xếp hạng người mua chưa đủ dữ liệu"}.`; });
  return {
    text: [`Có ${ok.length} hóa đơn đủ điều kiện tài trợ (người mua đã xác nhận, chưa có hồ sơ). Thứ tự gợi ý theo xếp hạng người mua và số ngày còn lại:`, ...top, "Chi phí thực tế phụ thuộc gói của từng tổ chức tài chính — so sánh ở Marketplace trước khi gửi."].join("\n"),
    links: [{ href: "/supplier/marketplace", label: "Marketplace" }],
  };
}

export const isFundingQuestion = (q: string) => /tai tro/.test(q) && /(nen|hoa don nao|cai nao|chon|uu tien|kha dung)/.test(q);

export function buildFacts(role: Role, d: FccState, org: Org) {
  const base = { vai_tro: role, to_chuc: org.name, hom_nay: new Date().toISOString().slice(0, 10) };
  if (role === "supplier") {
    const mine = d.receivables.filter((r) => r.sellerId === org.id);
    const conn = d.connections.find((c) => c.orgId === org.id);
    const fc = conn ? forecastCash(conn, d.ledger.filter((l) => l.orgId === org.id), d.applications, 30, new Date(), 0) : null;
    const sc = supplierScoreOf(d, org.id);
    return {
      ...base,
      hoa_don: mine.slice(0, 40).map((r) => { const f = fundingStatus(d, r); return { ma: r.code, nguoi_mua: name(d, r.buyerId), so_tien: r.amount, han: r.dueDate, trang_thai: RECEIVABLE_STAGE[r.state].label, du_dieu_kien_tai_tro: f.ok, ly_do: f.reason }; }),
      hoa_don_du_dieu_kien_tai_tro: mine.filter((r) => fundingStatus(d, r).ok).map((r) => r.code),
      ho_so_tai_tro: d.applications.filter((a) => mine.some((r) => r.id === a.receivableId)).map((a) => ({ ma: a.id, to_chuc: name(d, a.lenderId), trang_thai: APP_STATE_LABEL[a.state].label, de_nghi: a.offer })),
      rfq: d.rfqs.filter((q) => q.sellerId === org.id).map((q) => ({ ma: q.id, trang_thai: q.state, bao_gia: q.responses.map((x) => ({ to_chuc: name(d, x.lenderId), loai: x.kind, lai: x.ratePct, ung_truoc: x.advancePct })) })),
      du_bao_dong_tien_30_ngay: fc ? {
        so_du_dau_tu_khai: conn!.openingCash, thieu_hut: fc.shortfall ?? null, thap_nhat: fc.minBase, thu_30_ngay: fc.inflow.d30, chi_30_ngay: fc.outflow.d30,
        so_khoan_chi_dinh_ky_da_khai: conn!.recurringMonthlyOut?.length ?? 0,
        gioi_han: "Chỉ gồm số dư doanh nghiệp tự khai (chưa đối chiếu ngân hàng), công nợ đã nhập và chi định kỳ đã khai; chi phí chưa khai (lương, thuê, thuế…) không có trong dự báo.",
      } : "chưa khai số dư/công nợ",
      diem_tin_dung_tham_khao: { hang: sc.rating, diem: Math.round(sc.score), do_bao_phu: Math.round(sc.coverage * 100) + "%", chinh_thuc: sc.official, thieu: sc.missingMandatory },
      san_pham_dang_cong_bo: d.products.filter((p) => p.status === "published").map((p) => ({ to_chuc: name(d, p.lenderId), ten: p.name, lai: `${p.pricing.rateMin}-${p.pricing.rateMax}%`, ung_truoc: p.pricing.advancePct })),
    };
  }
  if (role === "buyer") {
    const mine = d.receivables.filter((r) => r.buyerId === org.id && r.state !== "DRAFT");
    return {
      ...base,
      hoa_don: mine.slice(0, 40).map((r) => ({ ma: r.code, phien_ban: r.version, nha_cung_cap: name(d, r.sellerId), so_tien: r.amount, han: r.dueDate, trang_thai: RECEIVABLE_STAGE[r.state].label })),
      de_nghi_tra_som: d.earlyOffers.filter((o) => o.buyerId === org.id).map((o) => ({ ma: o.id, chiet_khau_pct: o.discountPct, tra_truoc: o.payBy, trang_thai: o.state })),
      xep_hang_cua_ban: buyerScoreOf(d, org.id).rating,
      chi_phi_co_hoi_tien_mat_pct_nam: 4.5,
    };
  }
  if (role === "lender") {
    const apps = d.applications.filter((a) => a.lenderId === org.id);
    return {
      ...base,
      ho_so: apps.map((a) => { const r = d.receivables.find((x) => x.id === a.receivableId); return { ma: a.id, trang_thai: APP_STATE_LABEL[a.state].label, doanh_nghiep: r ? name(d, r.sellerId) : null, gia_tri: r?.amount, han: r?.dueDate, hang_ho_so: r ? applicationScoreOf(d, r.id).rating : null, de_nghi: a.offer }; }),
      canh_bao_ews: ewsAlerts(d, apps, new Date()).slice(0, 15).map((a) => ({ muc: a.severity, tieu_de: a.title, chi_tiet: a.detail, de_xuat: a.suggestion })),
      san_pham_cua_ban: d.products.filter((p) => p.lenderId === org.id).map((p) => ({ ten: p.name, trang_thai: p.status })),
    };
  }
  return {
    ...base,
    to_chuc_cho_xac_minh: d.orgs.filter((o) => o.type === "lender" && !o.verified).map((o) => o.name),
    kyc_cho_duyet: d.orgs.filter((o) => o.kyc?.status === "pending").map((o) => o.name),
    san_pham_cho_duyet: d.products.filter((p) => p.status === "pending_review").map((p) => p.name),
    esg_chua_phat_hanh: d.esg.filter((e) => e.source === "assessed" && e.status !== "official").length,
  };
}

/** Liên kết cho phép trả về (đường dẫn trong ứng dụng của vai trò). */
export const allowedLinks = (role: Role) => [...ROLES[role].nav.flatMap((n) => [{ href: n.href, label: n.label }, ...(n.children ?? [])])].filter((l) => !l.href.includes("#"));
