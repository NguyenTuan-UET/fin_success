import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, Building2, Calculator, ChevronDown, Database, FileText, Gauge, LayoutDashboard, Leaf, Menu, Settings, Store, X } from 'lucide-react'
import { useActiveOrg, useStore } from '../store'
import { PERSONAS } from '../data/seed'
import { dateTime } from '../lib/format'
import type { OrgType } from '../domain/types'

const ROLE_LABEL: Record<OrgType, string> = { buyer: 'Bên mua', supplier: 'Nhà cung cấp', lender: 'Tổ chức tài chính' }

export function Layout() {
  const org = useActiveOrg()
  const [mobileOpen, setMobileOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setMobileOpen(false), [loc.pathname])
  const nav = [
    { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
    { to: '/invoices', label: org.type === 'lender' ? 'Hồ sơ tài trợ' : 'Hóa đơn', icon: FileText },
    { to: '/credit', label: 'Chấm điểm DN', icon: Gauge },
    { to: '/marketplace', label: 'Marketplace', icon: Store },
    { to: '/esg', label: 'ESG & Xanh', icon: Leaf },
    { to: '/accounting', label: 'Kế toán & dòng tiền', icon: Calculator },
    { to: '/data', label: 'Dữ liệu doanh nghiệp', icon: Database },
    { to: '/settings', label: 'Cài đặt & nhật ký', icon: Settings },
  ]
  return (
    <div className="flex h-full">
      <aside className={clsx('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform lg:static lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <div className="grid size-9 place-items-center rounded-lg bg-ink text-sm font-extrabold text-white">FCC</div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold">Fast Cash Connect</div>
            <div className="text-[11px] text-ink-3">Tài trợ chuỗi cung ứng · ESG</div>
          </div>
          <button className="ml-auto cursor-pointer rounded p-1 lg:hidden" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}>
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Điều hướng chính">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-brand-soft text-brand-dark' : 'text-ink-2 hover:bg-muted')}>
              <n.icon className="size-[18px]" aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-4 text-[11px] leading-relaxed text-ink-3">
          Bản demo thi — dữ liệu mô phỏng, lưu trên máy chủ FCC. Điểm FCC là tham khảo, không phải quyết định tín dụng.
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6">
          <button className="cursor-pointer rounded-lg p-2 hover:bg-muted lg:hidden" aria-label="Mở menu" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </button>
          <OrgSwitcher />
          <div className="ml-auto flex items-center gap-2">
            <AiStatus />
            <Notifications />
            <div className="hidden items-center gap-2.5 border-l border-line pl-3 md:flex">
              <div className="grid size-9 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-dark">
                {PERSONAS[org.id]?.name.split(' ').slice(-2).map((w) => w[0]).join('')}
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold">{PERSONAS[org.id]?.name}</div>
                <div className="text-[11px] text-ink-3">{PERSONAS[org.id]?.title}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
            <ErrorBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function OrgSwitcher() {
  const org = useActiveOrg()
  const orgs = useStore((s) => s.orgs)
  const setActive = useStore((s) => s.setActiveOrg)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-1.5 text-left hover:bg-muted">
        <Building2 className="size-4 text-ink-3" aria-hidden />
        <div className="leading-tight">
          <div className="text-[11px] font-medium uppercase tracking-wide text-brand-dark">{ROLE_LABEL[org.type]}</div>
          <div className="max-w-[46vw] truncate text-[13px] font-semibold sm:max-w-xs">{org.name}</div>
        </div>
        <ChevronDown className="size-4 text-ink-3" aria-hidden />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-full z-50 mt-1 w-[min(92vw,380px)] rounded-xl border border-line bg-white p-2 shadow-lg">
          <p className="px-2 pb-1 text-[11px] text-ink-3">Chuyển tổ chức đang hoạt động (demo: mỗi tổ chức có một người dùng mẫu)</p>
          {(['supplier', 'buyer', 'lender'] as OrgType[]).map((t) => (
            <div key={t} className="py-1">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{ROLE_LABEL[t]}</div>
              {orgs.filter((o) => o.type === t).map((o) => (
                <button
                  key={o.id}
                  role="option"
                  aria-selected={o.id === org.id}
                  onClick={() => {
                    setActive(o.id)
                    setOpen(false)
                  }}
                  className={clsx('flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] hover:bg-muted', o.id === org.id && 'bg-brand-soft')}
                >
                  <span className="truncate">{o.name}</span>
                  {o.listedSymbol && <span className="ml-2 text-[11px] text-ink-3">{o.listedSymbol}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AiStatus() {
  const mode = useStore((s) => s.aiMode)
  const nav = useNavigate()
  return (
    <button onClick={() => nav('/settings')} className="hidden cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-muted sm:flex" title="Cấu hình AI">
      <span className={clsx('size-2 rounded-full', mode === 'auto' ? 'bg-good' : 'bg-warn')} aria-hidden />
      AI: {mode === 'auto' ? 'ollama.com (qua máy chủ)' : 'mô phỏng'}
    </button>
  )
}

function Notifications() {
  const org = useActiveOrg()
  const all = useStore((s) => s.notifications)
  const markRead = useStore((s) => s.markNotificationsRead)
  const items = all.filter((n) => n.orgId === org.id)
  const unread = items.filter((n) => !n.read).length
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Thông báo, ${unread} chưa đọc`} onClick={() => setOpen(!open)} className="relative grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-muted">
        <Bell className="size-5 text-ink-2" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[min(92vw,360px)] rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold">Thông báo</span>
            <button className="cursor-pointer text-xs text-brand-dark hover:underline" onClick={() => markRead(org.id)}>
              Đánh dấu đã đọc
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-center text-[13px] text-ink-3">Không có thông báo</p>}
            {items.slice(0, 20).map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false)
                  if (n.link) nav(n.link)
                }}
                className={clsx('block w-full cursor-pointer border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-muted', !n.read && 'bg-brand-soft/50')}
              >
                <div className="text-[13px] font-semibold">{n.title}</div>
                <div className="text-xs text-ink-2">{n.body}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">{dateTime(n.at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ErrorBanner() {
  const error = useStore((s) => s.error)
  const clear = useStore((s) => s.clearError)
  if (!error) return null
  return (
    <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-critical/30 bg-critical-soft px-4 py-3 text-[13px] text-critical-ink">
      <span>{error}</span>
      <button aria-label="Đóng" className="cursor-pointer" onClick={clear}>
        <X className="size-4" />
      </button>
    </div>
  )
}
