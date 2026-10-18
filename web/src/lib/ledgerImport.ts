// Nhập công nợ từ CSV xuất ra từ phần mềm kế toán: tự nhận cột theo nhiều cách đặt tên (không bắt buộc đúng file mẫu),
// cho người dùng ghép cột khi không nhận ra, chấp nhận ngày dd/mm/yyyy và số có dấu phân cách.
import type { LedgerItem } from "@fcc/domain/types";

export type LedgerField = "kind" | "name" | "tax" | "doc" | "amount" | "paid" | "due";

export const LEDGER_FIELDS: { key: LedgerField; label: string; required: boolean; aliases: string[] }[] = [
  { key: "kind", label: "Loại (phải thu/phải trả)", required: false, aliases: ["loai", "loai cong no", "kind", "type", "tk", "tai khoan"] },
  { key: "name", label: "Đối tác", required: true, aliases: ["doi tac", "doi_tac", "ten doi tac", "ten khach hang", "khach hang", "ten nha cung cap", "nha cung cap", "ten doi tuong", "doi tuong", "counterparty", "partner"] },
  { key: "tax", label: "MST đối tác", required: false, aliases: ["mst", "mst doi tac", "mst_doi_tac", "ma so thue", "tax code", "taxcode"] },
  { key: "doc", label: "Số chứng từ", required: true, aliases: ["so chung tu", "so_chung_tu", "chung tu", "so hoa don", "so hd", "so ct", "invoice no", "document no", "doc no"] },
  { key: "amount", label: "Số tiền", required: true, aliases: ["so tien", "so_tien", "tong tien", "gia tri", "tien", "phai thu", "phai tra", "amount", "total"] },
  { key: "paid", label: "Đã thanh toán", required: false, aliases: ["da thanh toan", "da_thanh_toan", "da tra", "da thu", "paid"] },
  { key: "due", label: "Hạn thanh toán", required: true, aliases: ["han thanh toan", "han_thanh_toan", "han tt", "ngay den han", "den han", "han", "due date", "due"] },
];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

/** CSV đơn giản (dấu phẩy hoặc chấm phẩy, có hỗ trợ ngoặc kép). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const t = text.replace(/^﻿/, "");
  const sep = (t.split("\n")[0].match(/;/g)?.length ?? 0) > (t.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cur); if (row.some((x) => x.trim())) rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Đoán cột cho từng trường từ dòng tiêu đề; -1 nếu không nhận ra. */
export function detectColumns(header: string[]): Record<LedgerField, number> {
  const h = header.map(norm);
  const used = new Set<number>();
  const out = {} as Record<LedgerField, number>;
  for (const f of LEDGER_FIELDS) {
    let idx = h.findIndex((x, i) => !used.has(i) && f.aliases.includes(x));
    if (idx < 0) idx = h.findIndex((x, i) => !used.has(i) && f.aliases.some((a) => a.length > 3 && x.includes(a)));
    out[f.key] = idx;
    if (idx >= 0) used.add(idx);
  }
  return out;
}

export function parseMoney(s: string): number | null {
  const t = (s ?? "").trim().replace(/\s|đ|vnd/gi, "");
  if (!t) return 0;
  if (/^-|\(.*\)/.test(t)) return null;
  // 1.234.567 hoặc 1,234,567 (phân nhóm) — không chấp nhận phần thập phân cho VND
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

export function parseDate(s: string): string | null {
  const t = (s ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t); // ngày/tháng/năm kiểu Việt Nam
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}
function iso(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseKind(s: string): "AR" | "AP" | null {
  const t = norm(s ?? "");
  if (!t) return null;
  if (["ar", "phai thu", "thu", "131", "khach hang"].includes(t) || t.startsWith("131")) return "AR";
  if (["ap", "phai tra", "tra", "331", "nha cung cap"].includes(t) || t.startsWith("331")) return "AP";
  return null;
}

export type ParsedLedger = { items: Omit<LedgerItem, "id" | "orgId">[]; errors: string[] };

/** Đọc các dòng theo cách ghép cột; `defaultKind` dùng khi tệp không có cột loại (VD: sổ chi tiết phải thu). */
export function readRows(body: string[][], map: Record<LedgerField, number>, defaultKind: "AR" | "AP" | ""): ParsedLedger {
  const items: ParsedLedger["items"] = [];
  const errors: string[] = [];
  const at = (r: string[], k: LedgerField) => (map[k] >= 0 ? (r[map[k]] ?? "").trim() : "");
  body.forEach((r, n) => {
    const line = n + 2;
    const kind = map.kind >= 0 ? parseKind(at(r, "kind")) ?? (defaultKind || null) : defaultKind || null;
    const amount = parseMoney(at(r, "amount"));
    const paid = parseMoney(at(r, "paid"));
    const due = parseDate(at(r, "due"));
    const problems = [
      !kind && "không rõ phải thu hay phải trả",
      !at(r, "doc") && "thiếu số chứng từ",
      (amount === null || amount <= 0) && "số tiền không hợp lệ",
      paid === null && "số đã thanh toán không hợp lệ",
      !due && `hạn thanh toán “${at(r, "due")}” không đọc được (dùng dd/mm/yyyy hoặc yyyy-mm-dd)`,
    ].filter(Boolean);
    if (problems.length) errors.push(`Dòng ${line}: ${problems.join("; ")}`);
    else items.push({ kind: kind!, counterpartyName: at(r, "name"), counterpartyTaxCode: at(r, "tax") || undefined, docNo: at(r, "doc"), amount: amount!, paid: paid ?? 0, dueDate: due! });
  });
  return { items, errors };
}
