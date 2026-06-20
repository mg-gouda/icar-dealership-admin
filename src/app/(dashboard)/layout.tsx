'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import NotificationBell from '@/components/NotificationBell';

/* ─── Nav items ──────────────────────────────────────────────────────────── */
const NAV = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".55"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".55"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/>
      </svg>
    ),
  },
  {
    href: '/vehicles',
    label: 'Inventory',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 10.5L3.5 6h9l1.5 4.5V12a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5v-1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M3.5 6L4.5 3.5h7L12.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <circle cx="5" cy="11.5" r="1" fill="currentColor"/>
        <circle cx="11" cy="11.5" r="1" fill="currentColor"/>
        <path d="M2 9.5h12" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    href: '/crm',
    label: 'Leads & CRM',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M1.5 13.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="11.5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M13 10c1.1.5 1.5 1.5 1.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/deals',
    label: 'Deals',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 7.5h6M5 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    href: '/appointments',
    label: 'Appointments',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M5 9.5h2v2H5z" fill="currentColor" opacity=".8"/>
      </svg>
    ),
  },
  {
    href: '/finance',
    label: 'Finance',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 5v1.5M8 9.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M6 7.2c0-.66.9-1.2 2-1.2s2 .54 2 1.2-1 1.1-2 1.2c-1.1.1-2 .6-2 1.4 0 .77.9 1.4 2 1.4s2-.63 2-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 12.5l3-4 2.5 2 3-5L13 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M1.5 14h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/settings/users',
    label: 'Users & Locations',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M2 12.5c0-1.933 1.567-3.5 3.5-3.5s3.5 1.567 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M12 4.5v5M9.5 7H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

/* ─── Topbar selectors (location / date) ─────────────────────────────────── */
function TopbarSelector({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition hover:bg-[var(--surface-2)]"
      style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
      {icon}
      {label}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
        <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

/* ─── Notification bell ──────────────────────────────────────────────────── */
function Bell({ count = 0 }: { count?: number }) {
  return (
    <button className="relative p-2 rounded-md hover:bg-[var(--surface-2)] transition"
      style={{ color: 'var(--text-2)' }} aria-label="Notifications">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 2.5-.5 3.5-1.5 4.5h12c-1-1-1.5-2-1.5-4.5A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M6.5 10.5A1.5 1.5 0 009.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      {count > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
          style={{ fontSize: '9px', fontWeight: 700, background: 'var(--danger)', lineHeight: 1 }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

/* ─── Layout ─────────────────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
    // Decode role from cookie (set at login)
    const roleCookie = document.cookie.split('; ').find(c => c.startsWith('admin_role='));
    const role = roleCookie ? roleCookie.split('=')[1] : 'ADMIN';
    setUser({ name: 'Admin User', role });
  }, [router]);

  function logout() {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1'}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    document.cookie = 'admin_session=; path=/; max-age=0';
    document.cookie = 'admin_role=; path=/; max-age=0';
    router.replace('/login');
  }

  // Derive initials from user name
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'AD';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 flex flex-col" style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <span className="text-base" aria-hidden>🚗</span>
          <div>
            <p className="text-sm font-semibold leading-none" style={{ color: 'var(--sidebar-active-text)' }}>DealerMS</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--sidebar-text)' }}>Management Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon }) => {
            // Match active: exact for root, startsWith for others
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.8125rem] font-medium transition-all duration-150 group"
                style={{
                  background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                }}>
                <span className="shrink-0" style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
                <span className="truncate">{label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--sidebar-active-dot)' }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <div className="flex items-center gap-2.5">
            <span className="avatar w-7 h-7 text-[0.625rem]"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              {initials}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-active-text)' }}>
                {user?.name ?? '—'}
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--sidebar-text)' }}>
                {user?.role ?? '—'}
              </p>
            </div>
            <button onClick={logout} title="Sign out"
              className="p-1 rounded hover:bg-white/10 transition" style={{ color: 'var(--sidebar-text)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 7h7M9 5l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 3H3a1 1 0 00-1 1v6a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
          style={{ background: 'var(--topbar-bg)', borderBottom: '1px solid var(--topbar-border)' }}>
          <div className="flex items-center gap-2">
            <TopbarSelector
              icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M9 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              label="All Locations"
            />
            <TopbarSelector
              icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1v4M9 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              label="Jun 2026"
            />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <span className="avatar w-7 h-7 text-[0.625rem] cursor-pointer hover:opacity-80 transition ml-1"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              {initials}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
