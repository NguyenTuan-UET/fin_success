import type { ReactNode } from "react";
import {
  Calculator,
  FileText,
  LayoutGrid,
  Leaf,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Users,
  Activity,
  Info,
  Building2,
  Receipt,
  ScrollText,
} from "lucide-react";
import type { IconKey } from "@/lib/roles";
import { cx } from "@/lib/format";

const ICONS = {
  overview: LayoutGrid,
  org: Building2,
  revenue: Receipt,
  log: ScrollText,
  invoice: FileText,
  market: Store,
  esg: Leaf,
  accounting: Calculator,
  settings: SlidersHorizontal,
  users: Users,
  shield: ShieldCheck,
  monitor: Activity,
} satisfies Record<IconKey, unknown>;

export function NavIcon({ name, size = 18 }: { name: IconKey; size?: number }) {
  const Cmp = ICONS[name];
  return <Cmp size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="10" fill="#0B6B53" />
      <path d="M10 18.5a7 7 0 0 1 12.2-5.2" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22.6 9.6v4h-4" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 15.5a7 7 0 0 1-12.2 5.2" fill="none" stroke="#DDF1C4" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11.4 24.4v-4h4" fill="none" stroke="#DDF1C4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  back,
  as: Heading = "h1",
}: {
  as?: "h1" | "h2";
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="ph">
      <div className="ph-text">
        {back}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <Heading className="h1">{title}</Heading>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  note,
  tone,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  tone?: "bad" | "ok";
  children?: ReactNode;
}) {
  return (
    <div className="card kpi">
      <span className="muted">{label}</span>
      <span className={cx("kv num", tone === "bad" && "t-bad", tone === "ok" && "t-ok")}>{value}</span>
      {note && <span className="muted">{note}</span>}
      {children}
    </div>
  );
}

export function Bar({ value, color, lg }: { value: number; color?: string; lg?: boolean }) {
  return (
    <div className={cx("bar", lg && "lg")}>
      <span className="fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

/** Ghi chú bắt buộc theo SPEC: điểm/giá/dự báo chỉ là tham khảo. */
export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="muted" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
      <Info size={14} style={{ flex: "0 0 auto", marginTop: 2 }} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
