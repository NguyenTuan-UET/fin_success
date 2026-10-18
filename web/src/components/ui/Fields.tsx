"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Paperclip } from "lucide-react";
import { cx, money } from "@/lib/format";

/**
 * Ô nhập số tiền (VND): hiển thị phân nhóm 1.234.567 khi gõ; không tự đổi dấu hay bỏ ký tự để thành giá trị khác.
 * Giá trị không hợp lệ (âm, chữ, thập phân) giữ nguyên để người dùng sửa và báo lỗi tại trường; onChange nhận null.
 */
export function MoneyInput({ label, value, onChange, hint, required, id: idIn, min = 1, disabled }: {
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  hint?: ReactNode;
  required?: boolean;
  id?: string;
  min?: number;
  disabled?: boolean;
}) {
  const auto = useId();
  const id = idIn ?? auto;
  const [raw, setRaw] = useState(value === null || value === undefined ? "" : group(String(value)));
  const [touched, setTouched] = useState(false);
  // giá trị từ ngoài đổi (VD: OCR điền) thì hiển thị lại; giá trị do chính ô này phát ra thì giữ nguyên chữ người dùng gõ
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if (valid(raw, min) !== value) setRaw(value === null || value === undefined ? "" : group(String(value)));
  }
  const p = parse(raw);
  const err = p.error ?? (p.value !== null && p.value < min ? `Số tiền phải từ ${group(String(min))} đ trở lên` : null) ?? (required && touched && p.value === null ? "Nhập số tiền" : null);
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        className={cx("input num", err && "invalid")}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={raw}
        aria-invalid={!!err}
        aria-describedby={`${id}-note`}
        onBlur={() => setTouched(true)}
        onChange={(e) => {
          const next = e.target.value;
          const q = parse(next);
          setRaw(q.error ? next : q.value === null ? "" : group(String(q.value)));
          onChange(valid(next, min));
        }}
      />
      <span id={`${id}-note`} className={err ? "field-err" : "field-note"} role={err ? "alert" : undefined}>
        {err ?? (p.value ? `${group(String(p.value))} đ (${money(p.value)})` : hint ?? "Đơn vị: đồng, không có phần thập phân")}
      </span>
    </label>
  );
}

function valid(s: string, min: number) {
  const q = parse(s);
  return q.error || q.value === null || q.value < min ? null : q.value;
}
function group(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function parse(s: string): { value: number | null; error?: string } {
  const t = s.trim();
  if (!t) return { value: null };
  if (/^-/.test(t)) return { value: null, error: "Số tiền không được âm — kiểm tra lại dấu trừ" };
  if (/,\d/.test(t)) return { value: null, error: "Số tiền theo đồng, không có phần thập phân" };
  if (/[^\d.\s]/.test(t)) return { value: null, error: "Chỉ nhập chữ số (dấu chấm phân nhóm được bỏ qua)" };
  const digits = t.replace(/[.\s]/g, "");
  if (!digits) return { value: null };
  if (digits.length > 15) return { value: null, error: "Số tiền quá lớn" };
  return { value: Number(digits) };
}

const WEEKDAY = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
/** Đọc lại ngày YYYY-MM-DD bằng tiếng Việt, tránh hiểu nhầm 03/04 khi trình duyệt hiển thị kiểu tháng/ngày. */
export function readDate(v?: string) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const [y, m, d] = v.split("-").map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd}, ngày ${d} tháng ${m} năm ${y}`;
}

/** Ô ngày kèm dòng đọc lại; `suggested` đánh dấu giá trị do hệ thống đề xuất (không có trên chứng từ). */
export function DateInput({ label, value, onChange, min, max, suggested, note, id: idIn }: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  suggested?: boolean;
  note?: ReactNode;
  id?: string;
}) {
  const auto = useId();
  const id = idIn ?? auto;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}{suggested && <span className="chip c-warn" style={{ marginLeft: 6 }}>Đề xuất — kiểm tra lại</span>}</span>
      <input id={id} className={cx("input num", suggested && "suggested")} type="date" lang="vi" min={min} max={max} value={value} aria-describedby={`${id}-note`} onChange={(e) => onChange(e.target.value)} />
      <span id={`${id}-note`} className="field-note">{value ? readDate(value) : note ?? "Chọn ngày"}</span>
    </label>
  );
}

/** Chọn tệp bằng giao diện tiếng Việt; vẫn dùng ô tệp gốc (truy cập được bằng bàn phím). */
export function FileInput({ label, accept, onFile, fileName, hint, busy }: {
  label: ReactNode;
  accept?: string;
  onFile: (f: File | null) => void;
  fileName?: string;
  hint?: ReactNode;
  busy?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span id={`${id}-l`}>{label}</span>
      <div className="file-pick">
        <input ref={ref} id={id} className="sr-only-file" type="file" tabIndex={-1} accept={accept} aria-labelledby={`${id}-l`} aria-describedby={`${id}-n`} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <button type="button" className="btn bs sm" disabled={busy} onClick={() => ref.current?.click()}><Paperclip size={14} aria-hidden="true" /> {fileName ? "Đổi tệp" : "Chọn tệp"}</button>
        <span id={`${id}-n`} className="muted">{busy ? "Đang tải lên…" : fileName ?? "Chưa chọn tệp"}</span>
      </div>
      {hint && <span className="field-note">{hint}</span>}
    </div>
  );
}
