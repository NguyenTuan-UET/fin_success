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

/** Ngày dd/mm/yyyy theo giờ Việt Nam từ chuỗi ISO. */
export function date(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
}

export function dateTime(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

/** Số ngày từ hôm nay (theo ngày UTC) tới ngày s; âm nếu đã qua. */
export function daysFromNow(s: string) {
  return Math.round((new Date(s).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86_400_000);
}

export const today = () => new Date().toISOString().slice(0, 10);

export async function sha256(text: string | ArrayBuffer) {
  const buf = typeof text === "string" ? new TextEncoder().encode(text) : new Uint8Array(text);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
