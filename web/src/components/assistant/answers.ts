import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import type { Role } from "@/lib/roles";

export type Reply = { text: string; links?: { href: string; label: string }[] };

/** Bỏ dấu tiếng Việt để so khớp từ khóa dễ hơn. */
export const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();

export const SUGGESTIONS: Record<Role, string[]> = {
  supplier: [
    "Khi nào tôi có thể thiếu tiền?",
    "Nên tài trợ hóa đơn nào?",
    "Lãi suất thấp nhất hiện nay?",
    "Làm sao tăng điểm ESG?",
    "Hóa đơn này thiếu chứng từ hải quan nào?",
    "DSO là gì?",
  ],
  buyer: [
    "Hóa đơn nào chờ tôi xác nhận?",
    "Có nên thanh toán sớm không?",
    "Đơn vị xuất khẩu nào ESG yếu?",
    "Đối chiếu 3 chiều là gì?",
  ],
  lender: [
    "Hồ sơ nào nên duyệt trước?",
    "Khoản nào đang có cảnh báo?",
    "Mặt bằng lãi suất thị trường?",
    "DSCR là gì?",
  ],
  admin: ["Việc nào đang chờ xử lý?", "Có tổ chức nào chờ xác minh?", "EWS là gì?"],
};

export function greeting(role: Role, name: string): Reply {
  const intro: Record<Role, string> = {
    supplier: "Mình giải thích số liệu và gợi ý bước tiếp theo từ dữ liệu của bạn trên FCC: hóa đơn, dòng tiền, hồ sơ tài trợ, thuật ngữ.",
    buyer: "Mình giúp xem hóa đơn chờ xác nhận, lịch thanh toán, đề nghị trả sớm và thuật ngữ.",
    lender: "Mình tóm tắt hàng đợi thẩm định, cảnh báo EWS và danh mục, dựa trên dữ liệu được chia sẻ cho bạn.",
    admin: "Mình tóm tắt các việc chờ xử lý trên nền tảng.",
  };
  return { text: `Chào ${name}! ${intro[role]} Mình chỉ diễn giải số liệu có trên màn hình, không tự suy ra số.\nBạn muốn hỏi gì?` };
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
  [["to khai hai quan"], "customsDeclaration"],
  [["thong quan"], "clearance"],
  [["van don"], "billOfLading"],
  [["c/o", "xuat xu"], "certificateOfOrigin"],
  [["incoterms"], "incoterms"],
  [["esg"], "esg"],
];

export function glossaryHit(q: string): Reply | null {
  const hit = ALIASES.find(([keys]) => keys.some((k) => q.includes(k)));
  if (!hit) return null;
  const g = GLOSSARY[hit[1]];
  return { text: `${g.term} (${g.full})\n${g.text}` };
}

