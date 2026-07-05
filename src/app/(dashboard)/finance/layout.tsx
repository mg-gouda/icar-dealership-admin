'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Overview',        href: '/finance' },
  { label: 'Invoices',        href: '/finance/invoices' },
  { label: 'GL Journal',      href: '/finance/gl' },
  { label: 'Payments',        href: '/finance/payments' },
  { label: 'Reconciliation',  href: '/finance/reconciliation' },
  { label: 'Assets',          href: '/finance/assets' },
  { label: 'Reports',         href: '/finance/reports' },
  { label: 'Commissions',     href: '/finance/commissions' },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-nav strip */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--topbar-bg)',
          borderBottom: '1px solid var(--topbar-border)',
          display: 'flex',
          gap: 0,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}
      >
        {TABS.map(({ label, href }) => {
          // ponytail: Overview is exact; others are prefix
          const active = href === '/finance' ? pathname === '/finance' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'inline-block',
                padding: '0.5rem 0.875rem',
                fontSize: '0.8125rem',
                fontWeight: active ? 600 : 500,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                color: active ? 'var(--primary)' : 'var(--text-2)',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
