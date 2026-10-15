"use client";

import { useId, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * Thuật ngữ có gạch chân chấm: rê chuột hoặc focus bàn phím để xem giải thích bằng lời thường.
 */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const g = GLOSSARY[k];
  return (
    <button
      type="button"
      className="term"
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      {children ?? g.term}
      {open && (
        <span role="tooltip" id={id} className="term-tip">
          <strong>
            {g.term} · {g.full}
          </strong>
          {g.text}
        </span>
      )}
    </button>
  );
}
