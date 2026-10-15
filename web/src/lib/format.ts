/** Định dạng số theo kiểu Việt Nam: 1.234.567 */
export const vnd = (v: number) => Math.round(v).toLocaleString("vi-VN");

/** Số thập phân kiểu Việt Nam: 5,9 */
export const dec = (v: number, digits = 1) =>
  v.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const pct = (v: number, digits = 1) => `${dec(v * 100, digits)}%`;

/** Rút gọn tiền tệ: 1.600.000.000 → "1,60 tỷ"; 688.000.000 → "688 tr" */
export function money(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${dec(v / 1e9, 2)} tỷ`;
  if (abs >= 1e6) return `${dec(v / 1e6, 1)} tr`;
  return vnd(v);
}

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
