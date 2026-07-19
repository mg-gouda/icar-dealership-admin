'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import NotificationBell from '@/components/NotificationBell';
import CommandPalette from '@/components/CommandPalette';
import { LocationProvider, useLocation } from '@/lib/location-context';
import { DateRangeProvider, useDateRange } from '@/lib/date-range-context';
import { LangProvider, useLang } from '@/lib/lang-context';
import { BrandProvider, useBrand } from '@/lib/brand-context';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import SearchableCombobox from '@/components/ui/SearchableCombobox';
import { API_BASE } from '@/lib/config';

/* ─── Nav items ──────────────────────────────────────────────────────────── */
const NAV: { href: string; key: string; icon: React.ReactNode; roles?: string[] }[] = [
  {
    href: '/', key: 'nav.dashboard',
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
    href: '/vehicles', key: 'nav.inventory',
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
    href: '/import', key: 'nav.imports',
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
    href: '/crm', key: 'nav.crm',
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
    href: '/reports', key: 'nav.reports',
    roles: ['MANAGER', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 12.5l3-4 2.5 2 3-5L13 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M1.5 14h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/whatsapp', key: 'nav.whatsapp',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M4 13.5l1-2h6l1 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4.5 7h7M4.5 9.5h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/deals', key: 'nav.deals',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 7.5h6M5 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    href: '/appointments', key: 'nav.appointments',
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
    href: '/service', key: 'nav.service',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10.5 2.5a4 4 0 0 1 0 5.657L5.657 13.1a2 2 0 1 1-2.828-2.828L7.672 5.43A4 4 0 0 1 10.5 2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="4.5" cy="11.5" r="1" fill="currentColor"/>
        <path d="M12 2l2 2-1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/parts', key: 'nav.parts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5L14.5 5v6L8 14.5 1.5 11V5L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M8 1.5v13M1.5 5l6.5 3.5L14.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/transfers', key: 'nav.transfers',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8h12M10 5l4 3-4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 5H2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".4"/>
      </svg>
    ),
  },
  {
    href: '/floor-plan', key: 'nav.floorplan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="5" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M4 5V3.5a1.5 1.5 0 013 0V5M9 5V3.5a1.5 1.5 0 013 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M4.5 9.5h7M4.5 11.5h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/petty-cash', key: 'nav.pettycash',
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
    href: '/finance', key: 'nav.finance',
    roles: ['FINANCE', 'ADMIN', 'SUPER_ADMIN'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 5v1.5M8 9.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M6 7.2c0-.66.9-1.2 2-1.2s2 .54 2 1.2-1 1.1-2 1.2c-1.1.1-2 .6-2 1.4 0 .77.9 1.4 2 1.4s2-.63 2-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/reports/my-commissions', key: 'nav.commissions',
    roles: ['SALES_REP', 'MANAGER', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L9.8 6H14l-3.4 2.5 1.3 4L8 10l-3.9 2.5 1.3-4L2 6h4.2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/executive', key: 'nav.executive',
    roles: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3C4.5 3 1.5 8 1.5 8s3 5 6.5 5 6.5-5 6.5-5-3-5-6.5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    href: '/settings/users', key: 'nav.users',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M2 12.5c0-1.933 1.567-3.5 3.5-3.5s3.5 1.567 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M12 4.5v5M9.5 7H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/audit-log', key: 'nav.auditlog',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 4h11M2.5 7.5h11M2.5 11h6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M13.8 13.8l1.2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/settings', key: 'nav.settings',
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
  const { t } = useLang();
  const opts = [
    { value: '', label: t('lbl.allLocations') },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];
  return (
    <SearchableCombobox
      options={opts}
      value={locationId}
      onChange={setLocationId}
      placeholder={t('lbl.allLocations')}
      className="w-44"
    />
  );
}

/* ─── Date range picker ──────────────────────────────────────────────────── */
function fmtMonthLabel(ym: string, lang: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { month: lang === 'ar' ? 'long' : 'short', year: 'numeric' }
  );
}

function DateRangePicker() {
  const { dateRange, setDateRange } = useDateRange();
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = dateRange.from === dateRange.to
    ? fmtMonthLabel(dateRange.from, lang)
    : `${fmtMonthLabel(dateRange.from, lang)} – ${fmtMonthLabel(dateRange.to, lang)}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition hover:bg-[var(--surface-2)]"
        style={{ borderColor: open ? 'var(--primary)' : 'var(--border)', color: 'var(--text-2)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M5 1v4M9 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
          <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 top-full mt-1.5 rounded-xl shadow-xl shadow-black/30 p-4 space-y-3"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 220,
            insetInlineStart: 0,
          }}
        >
          <div>
            <label className="input-label">{t('date.from')}</label>
            <input type="month" value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="input w-full" />
          </div>
          <div>
            <label className="input-label">{t('date.to')}</label>
            <input type="month" value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="input w-full" />
          </div>
          <button onClick={() => setOpen(false)} className="btn btn-primary btn-sm w-full">
            {t('date.apply')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Dark / light toggle ────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-1.5 rounded-lg transition"
      style={{ color: 'var(--text-2)', background: 'transparent' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {isDark ? (
        /* Sun icon */
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" strokeWidth="1.8" strokeLinecap="round"/>
          <path strokeWidth="1.8" strokeLinecap="round"
            d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>
        </svg>
      )}
    </button>
  );
}

/* ─── Sidebar brand / logo ───────────────────────────────────────────────── */
function SidebarBrand() {
  const { logoUrl, displayName } = useBrand();
  const { t } = useLang();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="logo" style={{ height: 28, maxWidth: 100, objectFit: 'contain' }} />
      ) : (
        <>
          <span style={{ fontSize: '1rem' }} aria-hidden>🚗</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1, color: 'var(--sidebar-active-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName || t('app.name')}
            </p>
            <p style={{ fontSize: '0.625rem', marginTop: 2, color: 'var(--sidebar-text)', margin: '2px 0 0' }}>
              {t('app.subtitle')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Pathname → page title map ──────────────────────────────────────────── */
const SUFFIX = ' | iCar Management System';
function resolveTitle(pathname: string): string {
  if (pathname === '/')                             return 'Dashboard' + SUFFIX;
  if (pathname.startsWith('/vehicles/new'))         return 'New Vehicle' + SUFFIX;
  if (pathname.match(/^\/vehicles\/[^/]+$/))        return 'Vehicle Detail' + SUFFIX;
  if (pathname.startsWith('/vehicles'))             return 'Inventory' + SUFFIX;
  if (pathname.startsWith('/import'))               return 'Imports' + SUFFIX;
  if (pathname.startsWith('/crm/new'))              return 'New Lead' + SUFFIX;
  if (pathname.match(/^\/crm\/[^/]+$/))             return 'Lead Detail' + SUFFIX;
  if (pathname.startsWith('/crm'))                  return 'CRM' + SUFFIX;
  if (pathname.startsWith('/deals/new'))            return 'New Deal' + SUFFIX;
  if (pathname.match(/^\/deals\/[^/]+$/))           return 'Deal Detail' + SUFFIX;
  if (pathname.startsWith('/deals'))                return 'Deals' + SUFFIX;
  if (pathname.startsWith('/appointments'))         return 'Appointments' + SUFFIX;
  if (pathname.startsWith('/service/new'))          return 'New Service Order' + SUFFIX;
  if (pathname.startsWith('/service/part-picks'))   return 'Part Picks' + SUFFIX;
  if (pathname.match(/^\/service\/[^/]+$/))         return 'Service Order' + SUFFIX;
  if (pathname.startsWith('/service'))              return 'Service Center' + SUFFIX;
  if (pathname.startsWith('/parts'))                return 'Parts' + SUFFIX;
  if (pathname.startsWith('/transfers'))            return 'Transfers' + SUFFIX;
  if (pathname.startsWith('/floor-plan'))           return 'Floor Plan' + SUFFIX;
  if (pathname.startsWith('/petty-cash'))           return 'Petty Cash' + SUFFIX;
  if (pathname.startsWith('/purchase-orders'))      return 'Purchase Orders' + SUFFIX;
  if (pathname.startsWith('/partners'))             return 'Partners' + SUFFIX;
  if (pathname.startsWith('/finance/invoices'))     return 'Invoices' + SUFFIX;
  if (pathname.startsWith('/finance/vendor-bills')) return 'Vendor Bills' + SUFFIX;
  if (pathname.startsWith('/finance/payments'))     return 'Payments' + SUFFIX;
  if (pathname.startsWith('/finance/gl/recurring')) return 'Recurring Entries' + SUFFIX;
  if (pathname.startsWith('/finance/gl'))           return 'General Ledger' + SUFFIX;
  if (pathname.startsWith('/finance/journals'))     return 'Journals' + SUFFIX;
  if (pathname.startsWith('/finance/accounts'))     return 'Chart of Accounts' + SUFFIX;
  if (pathname.startsWith('/finance/bank-statements')) return 'Bank Statements' + SUFFIX;
  if (pathname.startsWith('/finance/reconciliation')) return 'Reconciliation' + SUFFIX;
  if (pathname.startsWith('/finance/assets'))       return 'Fixed Assets' + SUFFIX;
  if (pathname.startsWith('/finance/fiscal-years')) return 'Fiscal Years' + SUFFIX;
  if (pathname.startsWith('/finance/currencies'))   return 'Currencies' + SUFFIX;
  if (pathname.startsWith('/finance/taxes'))        return 'Taxes' + SUFFIX;
  if (pathname.startsWith('/finance/cheques'))      return 'Cheques' + SUFFIX;
  if (pathname.startsWith('/finance/commissions'))  return 'Commissions' + SUFFIX;
  if (pathname.startsWith('/finance/vendors'))      return 'Vendors' + SUFFIX;
  if (pathname.startsWith('/finance/reports'))      return 'Financial Reports' + SUFFIX;
  if (pathname.startsWith('/finance'))              return 'Finance' + SUFFIX;
  if (pathname.startsWith('/reports/my-commissions')) return 'My Commissions' + SUFFIX;
  if (pathname.startsWith('/reports/targets'))      return 'Sales Targets' + SUFFIX;
  if (pathname.startsWith('/reports/funnel'))       return 'Sales Funnel' + SUFFIX;
  if (pathname.startsWith('/reports'))              return 'Reports' + SUFFIX;
  if (pathname.startsWith('/executive'))            return 'Executive Dashboard' + SUFFIX;
  if (pathname.startsWith('/whatsapp'))             return 'WhatsApp' + SUFFIX;
  if (pathname.startsWith('/audit-log'))            return 'Audit Log' + SUFFIX;
  if (pathname.startsWith('/settings/users'))       return 'Users' + SUFFIX;
  if (pathname.startsWith('/settings'))             return 'Settings' + SUFFIX;
  if (pathname.startsWith('/profile'))              return 'Profile' + SUFFIX;
  return 'iCar Management System';
}

/* ─── Inner shell ────────────────────────────────────────────────────────── */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('sidebar_open') !== 'false';
  });

  useEffect(() => { document.title = resolveTitle(pathname); }, [pathname]);

  useEffect(() => {
    localStorage.setItem('sidebar_open', String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    const tk = localStorage.getItem('accessToken');
    if (!tk) { router.replace('/login'); return; }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${tk}` } })
      .then(r => r.ok ? r.json() : Promise.reject('not ok'))
      .then(data => setUser({ name: data.name ?? data.email ?? 'Admin', role: data.role ?? 'ADMIN' }))
      .catch(() => {
        const roleCookie = document.cookie.split('; ').find(c => c.startsWith('admin_role='));
        const role = roleCookie ? roleCookie.split('=')[1] : 'ADMIN';
        setUser({ name: '—', role });
      });
  }, [router]);

  function logout() {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetch(`${API_BASE}/auth/logout`, {
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
      <aside
        style={{
          width: sidebarOpen ? 208 : 52,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--sidebar-bg)',
          borderInlineEnd: '1px solid var(--sidebar-border)',
          transition: 'width 200ms ease',
          overflow: 'hidden',
        }}
      >
        {/* Logo + collapse toggle */}
        <div style={{ borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
          {sidebarOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 16px', height: 56 }}>
              <SidebarBrand />
              <button
                onClick={() => setSidebarOpen(false)}
                title={t('nav.collapse') || 'Collapse'}
                style={{ padding: 6, borderRadius: 6, color: 'var(--sidebar-text)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-active-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2L5 7l4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56 }}>
              <button
                onClick={() => setSidebarOpen(true)}
                title={t('nav.expand') || 'Expand'}
                style={{ padding: 6, borderRadius: 6, color: 'var(--sidebar-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-active-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2l4 5-4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 6px', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV.filter(n => !n.roles || (user && n.roles.includes(user.role))).map(({ href, key, icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                title={!sidebarOpen ? t(key) : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: sidebarOpen ? '8px 10px' : '8px',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                  textDecoration: 'none',
                  marginBottom: 2,
                  transition: 'background 120ms',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }}>{icon}</span>
                {sidebarOpen && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(key)}</span>}
                {sidebarOpen && active && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: 'var(--sidebar-active-dot)', marginInlineStart: 'auto' }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
          {sidebarOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="avatar w-7 h-7 text-[0.625rem]"
                style={{ background: 'var(--primary)', color: '#fff', flexShrink: 0 }}>
                {initials}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-active-text)', margin: 0 }}>
                  {user?.name ?? '—'}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--sidebar-text)', margin: 0 }}>
                  {user?.role ?? '—'}
                </p>
              </div>
              <button onClick={logout} title={t('btn.signout')}
                style={{ padding: 4, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sidebar-text)', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 7h7M9 5l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 3H3a1 1 0 00-1 1v6a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span className="avatar w-7 h-7 text-[0.625rem]"
                title={user?.name ?? '—'}
                style={{ background: 'var(--primary)', color: '#fff' }}>
                {initials}
              </span>
              <button onClick={logout} title={t('btn.signout')}
                style={{ padding: 4, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sidebar-text)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 7h7M9 5l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 3H3a1 1 0 00-1 1v6a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
          style={{ background: 'var(--topbar-bg)', borderBottom: '1px solid var(--topbar-border)' }}>
          <div className="flex items-center gap-2">
            <LocationDropdown />
            <DateRangePicker />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <Link href="/profile"
              className="avatar w-7 h-7 text-[0.625rem] hover:opacity-80 transition ms-1"
              style={{ background: 'var(--primary)', color: '#fff', textDecoration: 'none' }}>
              {initials}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}

/* ─── Root layout export ─────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider>
        <BrandProvider>
          <LocationProvider>
            <DateRangeProvider>
              <DashboardShell>{children}</DashboardShell>
            </DateRangeProvider>
          </LocationProvider>
        </BrandProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
