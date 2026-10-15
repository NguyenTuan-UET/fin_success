import { Check } from "lucide-react";

export type Step = { title: string; note: string; state: "done" | "cur" | "todo" };

export function Stepper({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <nav aria-label={label} className="card" style={{ padding: "14px 16px" }}>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.title} className="step" aria-current={s.state === "cur" ? "step" : undefined}>
            <span className={`step-dot ${s.state}`}>{s.state === "done" ? <Check size={15} aria-hidden="true" /> : i + 1}</span>
            <span>
              <strong style={{ fontSize: 13, color: s.state === "todo" ? "var(--ink-2)" : undefined }}>
                {i + 1}. {s.title}
              </strong>
              <br />
              <span className="muted">{s.note}</span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
