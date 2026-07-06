'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import NotificationBell from '@/components/NotificationBell';
import CommandPalette from '@/components/CommandPalette';
import { LocationProvider, useLocation } from '@/lib/location-context';
import SearchableCombobox from '@/components/ui/SearchableCombobox';

/* ─── Nav items ──────────────────────────────────────────────────────────── */
const NAV: { href: string; label: string; icon: React.ReactNode; roles?: string[] }[] = [
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
    href: '/import',
    label: 'Imports',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1.5 11h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M2.5 11V7.5L4 4.5h8l1.5 3V11" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M6 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="5" cy="12.5" r="1" fill="currentColor"/>
        <circle cx="11" cy="12.5" r="1" fill="currentColor"/>
        <path d="M8 1v3.5M6.5 3l1.5-1.5 1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
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
    href: '/whatsapp',
    label: 'WhatsApp',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M4 13.5l1-2h6l1 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4.5 7h7M4.5 9.5h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
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
    href: '/service',
    label: 'Service Center',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10.5 2.5a4 4 0 0 1 0 5.657L5.657 13.1a2 2 0 1 1-2.828-2.828L7.672 5.43A4 4 0 0 1 10.5 2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="4.5" cy="11.5" r="1" fill="currentColor"/>
        <path d="M12 2l2 2-1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/parts',
    label: 'Parts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5L14.5 5v6L8 14.5 1.5 11V5L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M8 1.5v13M1.5 5l6.5 3.5L14.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/transfers',
    label: 'Transfers',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8h12M10 5l4 3-4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 5H2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".4"/>
      </svg>
    ),
  },
  {
    href: '/floor-plan',
    label: 'Floor Plan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="5" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M4 5V3.5a1.5 1.5 0 013 0V5M9 5V3.5a1.5 1.5 0 013 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M4.5 9.5h7M4.5 11.5h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/petty-cash',
    label: 'Petty Cash',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="4" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 7.5h6M5 10h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="11.5" cy="2.5" r="1" fill="currentColor" opacity=".6"/>
        <path d="M11.5 3.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
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
    href: '/reports/my-commissions',
    label: 'My Commissions',
    roles: ['SALES_REP', 'MANAGER', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L9.8 6H14l-3.4 2.5 1.3 4L8 10l-3.9 2.5 1.3-4L2 6h4.2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/executive',
    label: 'Executive View',
    roles: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3C4.5 3 1.5 8 1.5 8s3 5 6.5 5 6.5-5 6.5-5-3-5-6.5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
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

/* ─── Location dropdown ──────────────────────────────────────────────────── */
function LocationDropdown() {
  const { locationId, setLocationId, locations } = useLocation();
  const opts = [
    { value: '', label: 'All Locations' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];
  return (
    <SearchableCombobox
      options={opts}
      value={locationId}
      onChange={setLocationId}
      placeholder="All Locations"
      className="w-44"
    />
  );
}

/* ─── Static topbar selector (date period) ───────────────────────────────── */
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

/* ─── Inner shell (uses hooks + location context) ────────────────────────── */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
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
          {NAV.filter(n => !n.roles || (user && n.roles.includes(user.role))).map(({ href, label, icon }) => {
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

        {/* User info */}
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
            <LocationDropdown />
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

      {/* Global command palette */}
      <CommandPalette />
    </div>
  );
}

/* ─── Root layout export ─────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocationProvider>
      <DashboardShell>{children}</DashboardShell>
    </LocationProvider>
  );
}
