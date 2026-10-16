// Dữ kiện đưa cho trợ lý: chỉ số liệu có trên màn hình của người dùng (đã lọc theo quyền), tính bằng cùng công thức
// với giao diện. Mô hình AI chỉ được diễn giải các dữ kiện này; không có số nào do mô hình tự suy ra.
import { ewsAlerts } from "@fcc/domain/ews";
import { forecastCash } from "@fcc/domain/cashflow";
import { applicationScoreOf, buyerScoreOf, supplierScoreOf } from "@fcc/domain/engine";
import type { Org } from "@fcc/domain/types";
import type { FccState } from "@/lib/session";
import { ROLES, type Role } from "@/lib/roles";

const name = (d: FccState, id: string) => d.orgs.find((o) => o.id === id)?.shortName ?? id;

export function buildFacts(role: Role, d: FccState, org: Org) {
  const base = { vai_tro: role, to_chuc: org.name, hom_nay: new Date().toISOString().slice(0, 10) };
  if (role === "supplier") {
    const mine = d.receivables.filter((r) => r.sellerId === org.id);
    const conn = d.connections.find((c) => c.orgId === org.id);
    const fc = conn ? forecastCash(conn, d.ledger.filter((l) => l.orgId === org.id), d.applications, 30, new Date(), 0) : null;
    const sc = supplierScoreOf(d, org.id);
    return {
      ...base,
      hoa_don: mine.slice(0, 40).map((r) => ({ ma: r.code, nguoi_mua: name(d, r.buyerId), so_tien: r.amount, han: r.dueDate, trang_thai: r.state, xep_hang_nguoi_mua: buyerScoreOf(d, r.buyerId).rating })),
      ho_so_tai_tro: d.applications.filter((a) => mine.some((r) => r.id === a.receivableId)).map((a) => ({ ma: a.id, to_chuc: name(d, a.lenderId), trang_thai: a.state, de_nghi: a.offer })),
      rfq: d.rfqs.filter((q) => q.sellerId === org.id).map((q) => ({ ma: q.id, trang_thai: q.state, bao_gia: q.responses.map((x) => ({ to_chuc: name(d, x.lenderId), loai: x.kind, lai: x.ratePct, ung_truoc: x.advancePct })) })),
      du_bao_dong_tien_30_ngay: fc ? { so_du_dau: conn!.openingCash, thieu_hut: fc.shortfall ?? null, thap_nhat: fc.minBase, thu_30_ngay: fc.inflow.d30, chi_30_ngay: fc.outflow.d30 } : "chưa khai số dư/công nợ",
      diem_tin_dung_tham_khao: { hang: sc.rating, diem: Math.round(sc.score), do_bao_phu: Math.round(sc.coverage * 100) + "%", chinh_thuc: sc.official, thieu: sc.missingMandatory },
      san_pham_dang_cong_bo: d.products.filter((p) => p.status === "published").map((p) => ({ to_chuc: name(d, p.lenderId), ten: p.name, lai: `${p.pricing.rateMin}-${p.pricing.rateMax}%`, ung_truoc: p.pricing.advancePct })),
    };
  }
  if (role === "buyer") {
    const mine = d.receivables.filter((r) => r.buyerId === org.id && r.state !== "DRAFT");
    return {
      ...base,
      hoa_don: mine.slice(0, 40).map((r) => ({ ma: r.code, nha_cung_cap: name(d, r.sellerId), so_tien: r.amount, han: r.dueDate, trang_thai: r.state })),
      de_nghi_tra_som: d.earlyOffers.filter((o) => o.buyerId === org.id).map((o) => ({ ma: o.id, chiet_khau_pct: o.discountPct, tra_truoc: o.payBy, trang_thai: o.state })),
      xep_hang_cua_ban: buyerScoreOf(d, org.id).rating,
      chi_phi_co_hoi_tien_mat_pct_nam: 4.5,
    };
  }
  if (role === "lender") {
    const apps = d.applications.filter((a) => a.lenderId === org.id);
    return {
      ...base,
      ho_so: apps.map((a) => { const r = d.receivables.find((x) => x.id === a.receivableId); return { ma: a.id, trang_thai: a.state, doanh_nghiep: r ? name(d, r.sellerId) : null, gia_tri: r?.amount, han: r?.dueDate, hang_ho_so: r ? applicationScoreOf(d, r.id).rating : null, de_nghi: a.offer }; }),
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
