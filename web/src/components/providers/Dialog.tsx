"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// Hộp thoại nhập liệu của ứng dụng — thay window.prompt() (bị chặn trong trình duyệt nhúng, không có nhãn, không kiểm tra).
type Ask = {
  title: string;
  label: string;
  placeholder?: string;
  submit?: string;
  /** Bắt buộc nhập tối thiểu bao nhiêu ký tự (mặc định 3) */
  minLength?: number;
  maxLength?: number;
  /** Lựa chọn kèm theo (VD: kết quả đối chiếu); trả về trong `choice` */
  choices?: { value: string; label: string }[];
};
type Answer = { text: string; choice?: string } | null;
const Ctx = createContext<(q: Ask) => Promise<Answer>>(async () => null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [q, setQ] = useState<(Ask & { resolve: (a: Answer) => void }) | null>(null);
  const ask = useCallback((a: Ask) => new Promise<Answer>((resolve) => setQ({ ...a, resolve })), []);
  // ổn định để hộp thoại không gắn lại sự kiện mỗi lần gõ; resolve chạy hai lần (strict mode) không ảnh hưởng
  const finish = useCallback((a: Answer) => setQ((cur) => (cur?.resolve(a), null)), []);
  return (
    <Ctx.Provider value={ask}>
      {children}
      {q && <AskDialog key={q.title + q.label} q={q} done={finish} />}
    </Ctx.Provider>
  );
}

function AskDialog({ q, done }: { q: Ask; done: (a: Answer) => void }) {
  const [text, setText] = useState("");
  const [choice, setChoice] = useState(q.choices?.[0]?.value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const back = useRef<Element | null>(null);
  const min = q.minLength ?? 3;
  const max = q.maxLength ?? 500;
  useEffect(() => {
    back.current = document.activeElement;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && done(null);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
      (back.current as HTMLElement | null)?.focus?.();
    };
  }, [done]);
  const ok = text.trim().length >= min && text.length <= max;
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <form className="card modal" onSubmit={(e) => { e.preventDefault(); if (ok) done({ text: text.trim(), choice }); }}>
        <h2 className="ct" id="ask-title">{q.title}</h2>
        {q.choices && (
          <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-note" style={{ marginBottom: 4 }}>Kết quả</legend>
            {q.choices.map((c) => (
              <label key={c.value} className="row" style={{ gap: 8, alignItems: "center" }}>
                <input type="radio" name="ask-choice" value={c.value} checked={choice === c.value} onChange={() => setChoice(c.value)} /> {c.label}
              </label>
            ))}
          </fieldset>
        )}
        <label className="field"><span>{q.label}</span>
          <textarea ref={ref} className="input" rows={3} maxLength={max} placeholder={q.placeholder} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="ask-note" />
          <span id="ask-note" className="field-note">{text.trim().length < min ? `Tối thiểu ${min} ký tự` : `${text.length}/${max} ký tự`}</span>
        </label>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn bs" onClick={() => done(null)}>Hủy</button>
          <button type="submit" className="btn bp" disabled={!ok}>{q.submit ?? "Gửi"}</button>
        </div>
      </form>
    </div>
  );
}

/** Hỏi người dùng một nội dung (lý do, ghi chú); null khi hủy. */
export const useAsk = () => useContext(Ctx);
