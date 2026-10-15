import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type Todo = { icon: LucideIcon; bg: string; fg: string; title: string; note: string; href: string; cta: string };

/** "Việc cần làm hôm nay": mỗi ô là một việc cụ thể kèm lối tắt tới màn hình xử lý. */
export function TodoTiles({ items }: { items: Todo[] }) {
  return (
    <section className="stack-sm" aria-labelledby="todo-title">
      <div className="between">
        <h2 id="todo-title" className="ct">
          Việc cần làm hôm nay
        </h2>
        <span className="chip c-neu">{items.length} việc</span>
      </div>
      <div className="todo-grid">
        {items.map((t) => (
          <Link key={t.title} href={t.href} className="todo tile">
            <span className="todo-ic" style={{ background: t.bg, color: t.fg }}>
              <t.icon size={18} aria-hidden="true" />
            </span>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <strong style={{ fontSize: 13.5 }}>{t.title}</strong>
              <span className="muted">{t.note}</span>
            </span>
            <span className="todo-cta strong" style={{ color: "var(--brand)", fontSize: 13 }}>
              {t.cta} →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
