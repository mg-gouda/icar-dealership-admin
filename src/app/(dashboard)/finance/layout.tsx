'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/lang-context';

const NAV_ITEMS = [
  { href: '/finance',                  en: 'Overview',         ar: 'نظرة عامة' },
  { href: '/finance/invoices',         en: 'Invoices',         ar: 'الفواتير' },
  { href: '/finance/vendors',          en: 'Vendors',          ar: 'الموردون' },
  { href: '/finance/vendor-bills',     en: 'Vendor Bills',     ar: 'فواتير الموردين' },
  { href: '/finance/gl',               en: 'GL Journal',       ar: 'يومية الأستاذ' },
  { href: '/finance/payments',         en: 'Payments',         ar: 'المدفوعات' },
  { href: '/finance/reconciliation',   en: 'Reconciliation',   ar: 'التسوية' },
  { href: '/finance/bank-statements',  en: 'Bank Statements',  ar: 'كشوف البنك' },
  { href: '/finance/assets',           en: 'Assets',           ar: 'الأصول' },
  { href: '/finance/reports',          en: 'Reports',          ar: 'التقارير' },
  { href: '/finance/commissions',      en: 'Commissions',      ar: 'العمولات' },
  { href: '/finance/accounts',         en: 'Accounts',         ar: 'الحسابات' },
  { href: '/finance/journals',         en: 'Journals',         ar: 'الدفاتر المحاسبية' },
  { href: '/finance/taxes',            en: 'Taxes',            ar: 'الضرائب' },
  { href: '/finance/currencies',       en: 'Currencies',       ar: 'العملات' },
  { href: '/finance/fiscal-years',     en: 'Fiscal Years',     ar: 'السنوات المالية' },
  { href: '/finance/commission-plans', en: 'Commission Plans', ar: 'خطط العمولات' },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAr } = useLang();

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
        {NAV_ITEMS.map(({ href, en, ar }) => {
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
                color: active ? 'var(--tab-active)' : 'var(--text-2)',
                borderBottom: active ? '2px solid var(--tab-active)' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {isAr ? ar : en}
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
