"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Bell, CalendarDays, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { ROLE_ORDER, ROLES, type Role } from "@/lib/roles";
import { Logo, NavIcon } from "@/components/ui/basic";
import { useAssistant } from "@/components/assistant/Assistant";

const NOTIFS: Record<Role, { title: string; note: string; href: string; tone: string }[]> = {
  supplier: [
    { title: "Cảnh báo thanh khoản 28/10", note: "Số dư dự báo 380 tr, dưới mức an toàn 800 tr", href: "/supplier", tone: "var(--warn-strong)" },
    { title: "TT-0418 đã được phê duyệt", note: "Quỹ Đầu tư Xanh · chờ giải ngân T+1", href: "/supplier/disbursement", tone: "var(--brand-fill)" },
    { title: "HD-0398 quá hạn 7 ngày", note: "Đã gửi nhắc nợ cho Nội thất Phố Hội", href: "/supplier/invoices", tone: "var(--bad-strong)" },
  ],
  buyer: [
    { title: "3 hóa đơn chờ xác nhận", note: "Tổng 2,13 tỷ · 1 hóa đơn lệch số chuyến", href: "/buyer/invoices", tone: "var(--warn-strong)" },
    { title: "2 đề nghị trả sớm có lợi", note: "Lợi suất 8,3–11%/năm > chi phí vốn 4,5%", href: "/buyer/invoices", tone: "var(--brand-fill)" },
    { title: "Gỗ ván Tân Lập ESG 48", note: "Nhà cung cấp cần rà soát", href: "/buyer/esg", tone: "var(--bad-strong)" },
  ],
  lender: [
    { title: "4 hồ sơ mới cần thẩm định", note: "2 hồ sơ AI khuyến nghị phê duyệt", href: "/lender/appraisal", tone: "var(--info-strong)" },
    { title: "TT-0362 quá hạn 12 ngày", note: "Thủy sản Cửu Long · 620 tr", href: "/lender/monitoring", tone: "var(--bad-strong)" },
    { title: "Nghi trùng lặp hóa đơn", note: "TT-0470 · Thương mại Bảo Long", href: "/lender/monitoring", tone: "var(--violet)" },
  ],
  admin: [
    { title: "14 hóa đơn trùng lặp bị chặn", note: "Tháng 10/2026", href: "/admin#security", tone: "var(--bad-strong)" },
    { title: "1 tài khoản tạm khóa", note: "Thương mại Bảo Long · chờ tuân thủ xử lý", href: "/admin#users", tone: "var(--warn-strong)" },
    { title: "ISO/IEC 27001", note: "Đang chuẩn bị hồ sơ đánh giá", href: "/admin#security", tone: "var(--info-strong)" },
  ],
};

const subscribeNever = () => () => {};
const dateFmt = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
/** Ngày hôm nay theo giờ Việt Nam, lấy từ đồng hồ trình duyệt (server render để trống rồi điền khi hydrate). */
function todayVi() {
  const d = dateFmt.format(new Date());
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const meta = ROLES[role];
  const today = useSyncExternalStore(subscribeNever, todayVi, () => "");
  const pathname = usePathname();
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

        <nav className="roles-tb" aria-label="Chuyển vai trò">
          {ROLE_ORDER.map((r) => (
            <Link key={r} href={ROLES[r].home} className="role-link" aria-current={r === role} onNavigate={closeAll}>
              {ROLES[r].label}
            </Link>
          ))}
        </nav>
        <label className="sr-only" htmlFor="role-select">
          Chuyển vai trò
        </label>
        <select
          id="role-select"
          className="select role-select"
          value={role}
          onChange={(e) => router.push(ROLES[e.target.value as Role].home)}
        >
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLES[r].label}
            </option>
          ))}
        </select>

        <span className="spacer" />
        <span className="muted tb-date">
          <CalendarDays size={16} aria-hidden="true" />
          {today}
        </span>

        <div ref={bellRef} style={{ position: "relative" }}>
          <button
            className="ibtn"
            aria-label={`Thông báo (${NOTIFS[role].length} mới)`}
            aria-expanded={bellOpen}
            onClick={() => setBellOpen((o) => !o)}
          >
            <Bell size={18} aria-hidden="true" />
            <span className="dot-badge" />
          </button>
          {bellOpen && (
            <div className="pop" role="menu" aria-label="Thông báo">
              <div className="between" style={{ padding: "6px 10px 8px" }}>
                <strong>Thông báo</strong>
                <span className="muted">{NOTIFS[role].length} mới</span>
              </div>
              {NOTIFS[role].map((n) => (
                <Link key={n.title} href={n.href} className="pop-item" role="menuitem" onNavigate={closeAll}>
                  <span
                    style={{ width: 8, height: 8, borderRadius: "50%", background: n.tone, marginTop: 6, flex: "0 0 auto" }}
                  />
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <strong style={{ fontSize: 13 }}>{n.title}</strong>
                    <span className="muted">{n.note}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="tb-user">
          <span className="avatar" aria-hidden="true">
            {meta.user.initials}
          </span>
          <span className="tb-user-text">
            <strong>{meta.user.name}</strong>
            <span className="muted">
              {meta.user.title} · {meta.user.org}
            </span>
          </span>
        </div>
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
                  aria-current={pathname === item.href ? "page" : undefined}
                  onNavigate={closeAll}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                  {item.badge && <span className="chip c-lime nl-badge">{item.badge}</span>}
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
          <span className="side-sec">
            <ShieldCheck size={16} aria-hidden="true" />
            AES-256 · MFA đang bật
          </span>
        </aside>

        <main id="main" className="main">
          {children}
        </main>
      </div>
    </div>
  );
}
