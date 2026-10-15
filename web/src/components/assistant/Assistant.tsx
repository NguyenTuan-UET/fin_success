"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { ROLES, type Role } from "@/lib/roles";
import { answer, greeting, SUGGESTIONS, type Reply } from "./answers";

type Msg = { from: "me" | "bot"; reply: Reply };
type Ctx = { open: (question?: string) => void };

const AssistantCtx = createContext<Ctx>({ open: () => {} });
export const useAssistant = () => useContext(AssistantCtx);

function roleFromPath(path: string): Role | null {
  const seg = path.split("/")[1];
  return seg === "supplier" || seg === "buyer" || seg === "lender" || seg === "admin" ? seg : null;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role = roleFromPath(pathname) ?? "supplier";
  const [isOpen, setOpen] = useState(false);
  const [log, setLog] = useState<Record<Role, Msg[]>>({ supplier: [], buyer: [], lender: [], admin: [] });
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useCallback(
    (q: string) => {
      const text = q.trim();
      if (!text) return;
      setLog((l) => ({ ...l, [role]: [...l[role], { from: "me", reply: { text } }] }));
      setDraft("");
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setLog((l) => ({ ...l, [role]: [...l[role], { from: "bot", reply: answer(role, text) }] }));
      }, 550);
    },
    [role],
  );

  const open = useCallback(
    (question?: string) => {
      setOpen(true);
      if (question) ask(question);
    },
    [ask],
  );

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [log, typing, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const messages: Msg[] = [{ from: "bot", reply: greeting(role, ROLES[role].user.greetingName) }, ...log[role]];
  const showAssistant = isOpen && roleFromPath(pathname) !== null;

  return (
    <AssistantCtx.Provider value={{ open }}>
      {children}
      {showAssistant && (
        <section className="assistant" role="dialog" aria-label="Trợ lý FCC">
          <div className="as-head">
            <Sparkles size={20} color="#DDF1C4" aria-hidden="true" />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <strong>Trợ lý FCC</strong>
              <span style={{ fontSize: 12, color: "var(--on-forest-2)" }}>Trả lời theo dữ liệu trên màn hình</span>
            </div>
            <span className="spacer" />
            <button className="ibtn" onClick={() => setOpen(false)} aria-label="Đóng trợ lý">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="as-log" ref={logRef} aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.from}`}>
                {m.reply.text}
                {m.reply.links && (
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                    {m.reply.links.map((l) => (
                      <Link key={l.href} href={l.href}>
                        {l.label} →
                      </Link>
                    ))}
                  </span>
                )}
              </div>
            ))}
            {typing && (
              <div className="msg bot" aria-label="Trợ lý đang trả lời">
                <span className="typing">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </div>
          <div className="as-suggest">
            {SUGGESTIONS[role].map((s) => (
              <button key={s} onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
          <form
            className="as-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <label className="sr-only" htmlFor="as-input">
              Câu hỏi cho trợ lý
            </label>
            <input
              id="as-input"
              ref={inputRef}
              className="input"
              placeholder="Hỏi về dòng tiền, hóa đơn, lãi suất…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
            />
            <button className="btn bp" type="submit" aria-label="Gửi câu hỏi" disabled={!draft.trim()}>
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </AssistantCtx.Provider>
  );
}

/** Nút mở trợ lý, có thể kèm câu hỏi sẵn. */
export function AskButton({ question, className = "btn bl", children }: { question?: string; className?: string; children: ReactNode }) {
  const { open } = useAssistant();
  return (
    <button type="button" className={className} onClick={() => open(question)}>
      {children}
    </button>
  );
}
