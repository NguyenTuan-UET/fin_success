import { CASH_FORECAST, forecastDates, OFFERS, SAFE_BALANCE, SUPPLIER_INVOICES, STAGES, esgBand, esgCompute, estimate } from "@/lib/data";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { dec, money, vnd } from "@/lib/format";
import type { Role } from "@/lib/roles";

export type Reply = { text: string; links?: { href: string; label: string }[] };

/** Bỏ dấu tiếng Việt để so khớp từ khóa dễ hơn. */
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

const has = (q: string, ...keys: string[]) => keys.some((k) => q.includes(k));

export const SUGGESTIONS: Record<Role, string[]> = {
  supplier: [
    "Khi nào tôi có thể thiếu tiền?",
    "Nên tài trợ hóa đơn nào?",
    "Lãi suất thấp nhất hiện nay?",
    "Làm sao tăng điểm ESG?",
    "DSO là gì?",
  ],
  buyer: [
    "Hóa đơn nào chờ tôi xác nhận?",
    "Có nên thanh toán sớm không?",
    "Nhà cung cấp nào ESG yếu?",
    "Đối chiếu 3 chiều là gì?",
  ],
  lender: [
    "Hồ sơ nào nên duyệt trước?",
    "Khoản nào đang có cảnh báo?",
    "Mặt bằng lãi suất thị trường?",
    "DSCR là gì?",
  ],
  admin: ["Tình hình gian lận tháng này?", "Doanh thu nền tảng đến từ đâu?", "EWS là gì?"],
};

export function greeting(role: Role, name: string): Reply {
  const intro: Record<Role, string> = {
    supplier: "Mình có thể giúp xem dòng tiền, chọn hóa đơn để nhận tiền sớm, so sánh lãi suất hoặc giải thích thuật ngữ.",
    buyer: "Mình có thể giúp xác nhận hóa đơn, tính lợi ích khi trả sớm và xem ESG nhà cung cấp.",
    lender: "Mình có thể tóm tắt hàng đợi thẩm định, cảnh báo EWS và mặt bằng lãi suất.",
    admin: "Mình có thể tóm tắt hoạt động nền tảng, bảo mật và doanh thu.",
  };
  return { text: `Chào ${name}! ${intro[role]}\nBạn muốn hỏi gì?` };
}

const ALIASES: [string[], GlossaryKey][] = [
  [["dso"], "dso"],
  [["dio"], "dio"],
  [["dpo"], "dpo"],
  [["ccc", "chu ky chuyen doi"], "ccc"],
  [["dscr"], "dscr"],
  [["ltv"], "ltv"],
  [["tsbd", "tai san bao dam", "the chap"], "tsbd"],
  [["5c"], "fiveC"],
  [["cic"], "cic"],
  [["coverage", "do bao phu"], "coverage"],
  [["ews", "canh bao som"], "ews"],
  [["t+1", "t+2"], "tPlus"],
  [["risk score"], "riskScore"],
  [["ung truoc"], "advance"],
  [["chiet khau thanh toan som", "dynamic discount"], "earlyPay"],
  [["loi suat quy nam"], "annualYield"],
  [["3 chieu", "ba chieu"], "threeWay"],
  [["ocr"], "ocr"],
  [["esg"], "esg"],
];

function glossaryHit(q: string): Reply | null {
  const hit = ALIASES.find(([keys]) => keys.some((k) => q.includes(k)));
  if (!hit) return null;
  const g = GLOSSARY[hit[1]];
  return { text: `${g.term} (${g.full})\n${g.text}` };
}

function supplierReply(q: string): Reply | null {
  if (has(q, "thieu tien", "thanh khoan", "dong tien", "du bao", "so du", "het tien")) {
    let minI = 0;
    CASH_FORECAST.forEach((v, i) => v < CASH_FORECAST[minI] && (minI = i));
    const low = CASH_FORECAST[minI];
    const gap = SAFE_BALANCE - low;
    return {
      text: `Theo dự báo 30 ngày, số dư thấp nhất là ${vnd(low)} tr vào ngày ${forecastDates[minI]}, thấp hơn mức an toàn ${vnd(SAFE_BALANCE)} tr khoảng ${vnd(gap)} tr.\n\nCách nhanh nhất: tài trợ hóa đơn HD-0412 (Kết cấu Thép Miền Trung) — nhận trước khoảng 688 tr, đủ bù thiếu hụt.\n\nLưu ý: đây là dự báo, không phải cam kết.`,
      links: [
        { href: "/supplier", label: "Xem biểu đồ dự báo" },
        { href: "/supplier/marketplace", label: "So sánh phương án" },
      ],
    };
  }
  if (has(q, "tai tro hoa don nao", "nen tai tro", "uu tien", "nhan tien som", "ung truoc", "hoa don nao")) {
    const best = OFFERS[0];
    const list = SUPPLIER_INVOICES.filter((i) => i.ai)
      .map((i) => {
        const e = estimate(best, i.amount, i.daysLeft ?? 60);
        return `• ${i.id} · ${i.buyer.replace(/^(CTCP|TNHH) /, "")} · còn ${i.daysLeft} ngày → nhận khoảng ${money(e.net)}, chi phí ≈ ${money(e.cost)}`;
      })
      .join("\n");
    return {
      text: `Có 3 hóa đơn đủ điều kiện (người mua đã xác nhận, xếp hạng A–B, còn ≥ 50 ngày):\n${list}\n\nƯớc tính theo biểu giá ${best.name} (${dec(best.rate)}%/năm), không phải báo giá.`,
      links: [{ href: "/supplier/invoices", label: "Mở danh sách hóa đơn" }],
    };
  }
  if (has(q, "lai suat", "re nhat", "thap nhat", "marketplace", "ngan hang", "quy")) {
    const sorted = [...OFFERS].sort((a, b) => a.rate - b.rate);
    return {
      text: `Hiện có ${OFFERS.length} tổ chức chào gói, lãi suất từ ${dec(sorted[0].rate)}% đến ${dec(sorted.at(-1)!.rate)}%/năm.\nThấp nhất: ${sorted[0].name} ${dec(sorted[0].rate)}% · ứng trước 80% · giải ngân T+1 · cần ESG ≥ 65 (bạn đang có 74).\nNhanh nhất: An Khang giải ngân trong ngày nhưng lãi 8,1%.`,
      links: [{ href: "/supplier/marketplace", label: "So sánh trên Marketplace" }],
    };
  }
  if (has(q, "esg", "xanh", "tang diem", "uu dai")) {
    const { total } = esgCompute(0);
    const b = esgBand(total);
    return {
      text: `Điểm ESG của bạn là ${Math.round(total)}/100 — mức ${b.band} (${b.medal}). Cần thêm khoảng ${dec(80 - total, 2)} điểm để đạt mức Tốt.\n\nViệc tác động lớn nhất:\n• S3 Đào tạo: lập kế hoạch đào tạo có đánh giá năng lực\n• G3 Giao dịch bên liên quan: ghi nhận & phê duyệt\n• E1 Năng lượng: lắp đồng hồ đo theo dây chuyền`,
      links: [{ href: "/supplier/esg", label: "Xem kế hoạch cải thiện" }],
    };
  }
  if (has(q, "qua han", "nhac no", "cham tra", "no xau")) {
    const o = SUPPLIER_INVOICES.find((i) => i.stage === "over")!;
    return {
      text: `Có 1 hóa đơn quá hạn: ${o.id} · ${o.buyer} · ${vnd(o.amount)} đ, quá hạn 7 ngày. FCC đã gửi nhắc nợ tự động cho người mua.`,
      links: [{ href: "/supplier/invoices", label: "Xem hóa đơn" }],
    };
  }
  if (has(q, "trang thai", "cho xac nhan", "bao nhieu hoa don", "hoa don")) {
    const counts = Object.entries(STAGES)
      .map(([k, s]) => [s.label, SUPPLIER_INVOICES.filter((i) => i.stage === k).length] as const)
      .filter(([, n]) => n > 0)
      .map(([l, n]) => `• ${l}: ${n}`)
      .join("\n");
    return { text: `Bạn đang có ${SUPPLIER_INVOICES.length} hóa đơn:\n${counts}`, links: [{ href: "/supplier/invoices", label: "Quản lý hóa đơn" }] };
  }
  if (has(q, "giai ngan", "tt-0418", "ho so", "khi nao nhan")) {
    return {
      text: "Khoản TT-0418 (HD-0418) đã được Quỹ Đầu tư Xanh phê duyệt và đang chờ giải ngân T+1.\nThực nhận dự kiến: 1.596.800.000 đ (sau phí xử lý 0,2%).",
      links: [{ href: "/supplier/disbursement", label: "Theo dõi giải ngân" }],
    };
  }
  return null;
}

function buyerReply(q: string): Reply | null {
  if (has(q, "xac nhan", "cho toi", "doi chieu")) {
    return {
      text: "Có 3 hóa đơn chờ bạn xác nhận (tổng 2,13 tỷ):\n• HD-0421 · Vật liệu Sao Mai · 1,12 tỷ · khớp 3/3\n• HD-2209 · Điện cơ Nam Việt · 860 tr · khớp 3/3\n• HD-0631 · Vận tải Hưng Phát · 145 tr · lệch số chuyến (24 vs 22) — nên yêu cầu giải trình.",
      links: [{ href: "/buyer/invoices", label: "Mở màn hình xác nhận" }],
    };
  }
  if (has(q, "tra som", "thanh toan som", "chiet khau")) {
    return {
      text: "Nên trả sớm 2 hóa đơn vì lợi suất cao hơn chi phí cơ hội tiền mặt 4,5%/năm:\n• HD-0406 · chiết khấu 1,2% · trả sớm 40 ngày · ≈ 11,0%/năm · tiết kiệm 5,46 tr\n• HD-1187 · chiết khấu 0,8% · trả sớm 35 ngày · ≈ 8,3%/năm · tiết kiệm 4,96 tr\nHD-2174 chỉ ≈ 4,1%/năm nên chưa đáng trả sớm.",
      links: [{ href: "/buyer/invoices", label: "Duyệt thanh toán sớm" }],
    };
  }
  if (has(q, "esg", "nha cung cap", "ncc")) {
    return {
      text: "Gỗ ván Tân Lập có ESG 48 (Yếu) — nên rà soát. Vận tải Hưng Phát 63 (Trung bình). Các nhà cung cấp còn lại từ mức Khá trở lên.",
      links: [{ href: "/buyer/esg", label: "Xem ESG chuỗi cung ứng" }],
    };
  }
  return null;
}

function lenderReply(q: string): Reply | null {
  if (has(q, "duyet", "tham dinh", "ho so", "uu tien")) {
    return {
      text: "Hàng đợi có 4 hồ sơ:\n• TT-0418 · Vật liệu Sao Mai · 5C 76 · ESG 74 → khuyến nghị phê duyệt\n• TT-0533 · Điện cơ Nam Việt · 5C 81 · ESG 81 → khuyến nghị phê duyệt (dựa trên phải thu)\n• TT-0529 · Bao bì Hòa Khánh · 5C 68 → phê duyệt có điều kiện, ESG thiếu 3 chỉ tiêu\n• TT-0521 · Gỗ ván Tân Lập · 5C 54, cờ đỏ thuế → không đề xuất\nĐây là xếp hạng tham khảo, quyết định thuộc về tổ chức của bạn.",
      links: [{ href: "/lender/appraisal", label: "Mở hàng đợi thẩm định" }],
    };
  }
  if (has(q, "canh bao", "ews", "qua han", "rui ro")) {
    return {
      text: "7 khoản cần chú ý. Nghiêm trọng nhất: TT-0362 · Thủy sản Cửu Long · quá hạn 12 ngày, 620 tr — đã nhắc 3 lần, có TSBĐ là kho lạnh (giá trị công nhận 1,33 tỷ).",
      links: [{ href: "/lender/monitoring", label: "Xem giám sát & EWS" }],
    };
  }
  if (has(q, "lai suat", "thi truong", "canh tranh")) {
    return {
      text: "Mặt bằng tài trợ hóa đơn 90 ngày: 5,9% – 8,1%/năm. Gói của bạn (5,9%) đang thấp nhất; trung vị lãi suất được doanh nghiệp chọn là 6,4%.",
      links: [{ href: "/lender/marketplace", label: "Xem Marketplace" }],
    };
  }
  return null;
}

function adminReply(q: string): Reply | null {
  if (has(q, "gian lan", "bao mat", "trung lap")) {
    return {
      text: "Tháng 10: chặn 14 hóa đơn trùng lặp, phát hiện 6 giao dịch bất thường và 3 đăng nhập bất thường. 1 tài khoản đang tạm khóa vì nghi trùng lặp hóa đơn.",
      links: [{ href: "/admin#security", label: "Xem bảo mật" }],
    };
  }
  if (has(q, "doanh thu", "nguon thu")) {
    return {
      text: "Doanh thu tháng 10 khoảng 1,08 tỷ, lớn nhất từ phí giao dịch tài trợ hóa đơn (612 tr), tiếp theo là phí SaaS (214 tr) và phí chấm điểm (98 tr).",
      links: [{ href: "/admin", label: "Bảng điều khiển" }],
    };
  }
  return null;
}

export function answer(role: Role, raw: string): Reply {
  const q = norm(raw);
  if (has(q, "la gi", "nghia la", "giai thich", "y nghia") || q.trim().split(/\s+/).length <= 2) {
    const g = glossaryHit(q);
    if (g) return g;
  }
  const byRole =
    role === "supplier" ? supplierReply(q) : role === "buyer" ? buyerReply(q) : role === "lender" ? lenderReply(q) : adminReply(q);
  if (byRole) return byRole;
  const g = glossaryHit(q);
  if (g) return g;
  if (has(q, "chao", "hello", "hi ")) return { text: "Chào bạn! Bạn có thể chọn một câu hỏi gợi ý bên dưới nhé." };
  return {
    text: "Mình chưa hiểu rõ câu hỏi này. Bạn thử hỏi về dòng tiền, hóa đơn, lãi suất, ESG, hoặc hỏi nghĩa của một thuật ngữ như “DSCR là gì?”.",
  };
}
