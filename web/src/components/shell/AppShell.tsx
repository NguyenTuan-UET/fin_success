"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Bell, CalendarDays, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { ROLES, roleOfOrgType, type Role } from "@/lib/roles";
import { useFcc } from "@/lib/session";
import { AuthGate } from "@/components/auth/AuthGate";
import { Logo, NavIcon } from "@/components/ui/basic";
import { useAssistant } from "@/components/assistant/Assistant";

const subscribeNever = () => () => {};
const subscribeHash = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
  };
};
const currentHash = () => window.location.hash;
const isNavActive = (href: string, pathname: string, hash: string) => {
  const [path, anchor = ""] = href.split("#");
  return pathname === path && hash === (anchor ? `#${anchor}` : "");
};
const dateFmt = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
/** Ngày hôm nay theo giờ Việt Nam, lấy từ đồng hồ trình duyệt (server render để trống rồi điền khi hydrate). */
function todayVi() {
  const d = dateFmt.format(new Date());
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** Vỏ ứng dụng: chặn khi chưa đăng nhập, đưa về đúng vai trò theo loại tổ chức đang hoạt động. */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { status, error, org } = useFcc();
  const router = useRouter();
  const actual = org ? roleOfOrgType(org.type) : null;
  useEffect(() => {
    if (status === "ready" && actual && actual !== role) router.replace(ROLES[actual].home);
  }, [status, actual, role, router]);
  if (status === "loading") return <div className="auth-wrap muted">Đang tải…</div>;
  if (status === "error") return <div className="auth-wrap"><div className="card auth-card err">{error}</div></div>;
  if (status === "anon") return <AuthGate role={role} />;
  if (!actual || actual !== role) return <div className="auth-wrap muted">Đang chuyển tới đúng vai trò…</div>;
  return <Shell role={role}>{children}</Shell>;
}

function Shell({ role, children }: { role: Role; children: ReactNode }) {
  const meta = ROLES[role];
  const { me, org, data, memberships, logout, switchOrg, act } = useFcc();
  const initials = (me?.name ?? "").split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();
  const notifs = (data?.notifications ?? []).filter((n) => n.orgId === org?.id);
  const unread = notifs.filter((n) => !n.read);
  const badge = (href: string): string | undefined => {
    const rs = data?.receivables ?? [];
    const as = data?.applications ?? [];
    const n =
      role === "supplier" && href === "/supplier/invoices"
        ? rs.filter((r) => r.sellerId === org?.id && ["DRAFT", "BUYER_DISPUTED"].includes(r.state)).length
        : role === "buyer" && href === "/buyer/invoices"
          ? rs.filter((r) => r.buyerId === org?.id && r.state === "BUYER_PENDING").length
          : role === "lender" && href === "/lender/appraisal"
            ? as.filter((a) => a.lenderId === org?.id && ["SUBMITTED", "UNDER_REVIEW"].includes(a.state)).length
            : 0;
    return n ? String(n) : undefined;
  };
  const today = useSyncExternalStore(subscribeNever, todayVi, () => "");
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribeHash, currentHash, () => "");
  const router = useRouter();
  const { open: openAssistant } = useAssistant();
  const [navOpen, setNavOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Activity giữ nguyên state khi rời route → đóng các lớp tạm thời khi bị ẩn.
  useLayoutEffect(
    () => () => {
      setNavOpen(false);
      setBellOpen(false);
    },
    [],
  );

  useEffect(() => {
    if (!bellOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBellOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [bellOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const closeAll = () => {
    setNavOpen(false);
    setBellOpen(false);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Bỏ qua điều hướng
      </a>
      <header className="tb">
        <button
          className="ibtn menu-btn"
          aria-label="Mở menu điều hướng"
          aria-expanded={navOpen}
          aria-controls="side-nav"
          onClick={() => setNavOpen(true)}
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <Link href="/" className="brand" onNavigate={closeAll}>
          <Logo />
          <span className="brand-name">
            <strong>FCC</strong>
            <span>Fast Cash Connect</span>
          </span>
        </Link>

        {memberships.length > 1 && (
          <>
            <label className="sr-only" htmlFor="org-select">
              Tổ chức đang hoạt động
            </label>
            <select
              id="org-select"
              className="select role-select"
              style={{ display: "block" }}
              value={org?.id}
              onChange={(e) => void switchOrg(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.orgId} value={m.orgId}>
                  {m.orgName} · {m.roleLabel}
                </option>
              ))}
            </select>
          </>
        )}

        <span className="spacer" />
        <span className="muted tb-date">
          <CalendarDays size={16} aria-hidden="true" />
          {today}
        </span>

        <div ref={bellRef} style={{ position: "relative" }}>
          <button
            className="ibtn"
            aria-label={`Thông báo (${unread.length} mới)`}
            aria-expanded={bellOpen}
            onClick={() => setBellOpen((o) => !o)}
          >
            <Bell size={18} aria-hidden="true" />
            {unread.length > 0 && <span className="dot-badge" />}
          </button>
          {bellOpen && (
            <div className="pop" role="menu" aria-label="Thông báo">
              <div className="between" style={{ padding: "6px 10px 8px" }}>
                <strong>Thông báo</strong>
                {unread.length > 0 ? (
                  <button className="btn bs sm" onClick={() => void act("POST", "/v1/notifications/read")}>
                    Đánh dấu đã đọc ({unread.length})
                  </button>
                ) : (
                  <span className="muted">Không có thông báo mới</span>
                )}
              </div>
              {notifs.length === 0 && <div className="empty">Chưa có thông báo.</div>}
              {notifs.slice(0, 12).map((n) => (
                <Link key={n.id} href={linkOf(role, n.link)} className="pop-item" role="menuitem" onNavigate={closeAll}>
                  <span
                    style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? "var(--line)" : "var(--brand-fill)", marginTop: 6, flex: "0 0 auto" }}
                  />
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <strong style={{ fontSize: 13 }}>{n.title}</strong>
                    <span className="muted">{n.body}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="tb-user">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="tb-user-text">
            <strong>{me?.name}</strong>
            <span className="muted">
              {me?.title} · {org?.shortName}
            </span>
          </span>
        </div>
        <Link href="/security" className="btn bs sm tb-sec" onNavigate={closeAll}>
          Bảo mật
        </Link>
        <button className="btn bs sm" onClick={() => void logout().then(() => router.push("/"))}>
          Đăng xuất
        </button>
      </header>

      <div className="body">
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <aside id="side-nav" className={`side${navOpen ? " open" : ""}`} aria-label="Điều hướng">
          <div className="between" style={{ paddingRight: 4 }}>
            <span className="slabel">{meta.label}</span>
            {navOpen && (
              <button
                className="ibtn"
                style={{ background: "transparent", color: "#fff", borderColor: "var(--forest-3)" }}
                onClick={() => setNavOpen(false)}
                aria-label="Đóng menu"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          <nav className="nav" aria-label="Điều hướng chính">
            {meta.nav.map((item) => (
              <div key={item.href} style={{ display: "contents" }}>
                <Link
                  href={item.href}
                  className="nl"
                  aria-current={isNavActive(item.href, pathname, hash) ? "page" : undefined}
                  onNavigate={closeAll}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                  {badge(item.href) && <span className="chip c-lime nl-badge">{badge(item.href)}</span>}
                </Link>
                {item.children?.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="nsub"
                    aria-current={pathname === c.href ? "page" : undefined}
                    onNavigate={closeAll}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <span className="spacer" />
          <div className="side-ai">
            <strong>
              <Sparkles size={18} color="#DDF1C4" aria-hidden="true" />
              Trợ lý FCC 24/7
            </strong>
            <span>Hỏi về dòng tiền, hạn mức, lãi suất hay tình trạng hóa đơn.</span>
            <button
              className="btn bl"
              style={{ minHeight: 36 }}
              onClick={() => {
                setNavOpen(false);
                openAssistant();
              }}
            >
              Hỏi trợ lý
            </button>
          </div>
          <span className="side-sec" title="Giai đoạn thử nghiệm: phía ngân hàng/tổ chức tài chính do hệ thống giả lập">
            Ngân hàng giả lập · không có giao dịch tiền thật
          </span>
          <span className="side-sec">
            <ShieldCheck size={16} aria-hidden="true" />
            {me?.mfaEnabled ? "MFA đang bật" : "MFA chưa bật"}
          </span>
        </aside>

        <main id="main" className="main">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Liên kết trong thông báo của máy chủ (dùng đường dẫn của bản cũ) → đường dẫn theo vai trò. */
function linkOf(role: Role, link?: string) {
  const base = ROLES[role].home;
  if (!link) return base;
  if (link.startsWith("/admin")) return link;
  if (link.startsWith("/invoices")) return role === "lender" ? `${base}/appraisal` : `${base}/invoices`;
  if (link.startsWith("/marketplace")) return `${base}/marketplace`;
  if (link.startsWith("/settings")) return `${base}/settings`;
  return base;
}
