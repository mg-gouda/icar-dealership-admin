'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/useApi';
import { useLang } from '@/lib/lang-context';

interface Counts {
  draftInvoices: number;
  payableCommissions: number;
  overdueInstallments: number;
  newLeads: number;
  pendingPartPicks: number;
}

const ZERO: Counts = { draftInvoices: 0, payableCommissions: 0, overdueInstallments: 0, newLeads: 0, pendingPartPicks: 0 };
const POLL_MS = 60_000;
const LS_KEY = 'notif_seen';

function loadSeen(): Counts {
  try { return { ...ZERO, ...JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') }; } catch { return { ...ZERO }; }
}
function saveSeen(c: Counts) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch { /* */ }
}

export default function NotificationBell() {
  const { isAr } = useLang();
  const [counts, setCounts]   = useState<Counts>({ ...ZERO });
  const [seen, setSeen]       = useState<Counts>({ ...ZERO });
  const [open, setOpen]       = useState(false);
  const [pos, setPos]         = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const [invoices, commissions, installments, leads, partPicks] = await Promise.all([
        apiFetch<unknown[]>('/finance/invoices?status=DRAFT&limit=200').then(
          (r) => (Array.isArray(r) ? r.length : 0), () => 0,
        ),
        apiFetch<{ total?: number }>('/finance/commissions?status=PAYABLE&limit=1').then(
          (r) => r?.total ?? 0, () => 0,
        ),
        apiFetch<{ count?: number }>('/deals/installments/overdue-count').then(
          (r) => r?.count ?? 0, () => 0,
        ),
        apiFetch<{ total?: number }>('/leads?status=NEW&limit=1').then(
          (r) => (r as { total?: number })?.total ?? 0, () => 0,
        ),
        apiFetch<{ pending: number }>('/service-orders/part-picks/count').then(
          (r) => r?.pending ?? 0, () => 0,
        ),
      ]);
      setCounts({ draftInvoices: invoices as number, payableCommissions: commissions as number, overdueInstallments: installments as number, newLeads: leads as number, pendingPartPicks: partPicks as number });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setSeen(loadSeen());
    fetchCounts();
    const id = setInterval(fetchCounts, POLL_MS);
    return () => clearInterval(id);
  }, [fetchCounts]);

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function openPanel() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  }

  function markAllRead() {
    saveSeen(counts);
    setSeen({ ...counts });
    setOpen(false);
  }

  function newCount(key: keyof Counts) {
    return Math.max(0, counts[key] - (seen[key] ?? 0));
  }

  const totalNew =
    newCount('draftInvoices') +
    newCount('payableCommissions') +
    newCount('overdueInstallments') +
    newCount('newLeads') +
    newCount('pendingPartPicks');

  const ITEMS: { key: keyof Counts; labelEn: string; labelAr: string; href: string; color: string }[] = [
    { key: 'draftInvoices',      labelEn: 'Draft Invoices',          labelAr: 'فواتير مسودة',                    href: '/finance/invoices?status=DRAFT', color: 'var(--warning)' },
    { key: 'payableCommissions', labelEn: 'Payable Commissions',     labelAr: 'عمولات مستحقة',                   href: '/finance/commissions',           color: 'var(--warning)' },
    { key: 'overdueInstallments',labelEn: 'Overdue Installments',    labelAr: 'أقساط متأخرة',                    href: '/deals?tab=installments',        color: 'var(--danger)'  },
    { key: 'newLeads',           labelEn: 'New B2C Leads',           labelAr: 'عملاء محتملون جدد',               href: '/crm?status=NEW',                color: 'var(--info)'    },
    { key: 'pendingPartPicks',   labelEn: 'Parts to Fetch',          labelAr: 'قطع غيار للسحب من المستودع',     href: '/service/part-picks',            color: 'var(--warning)' },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={openPanel}
        aria-label="Notifications"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: open ? 'var(--surface-2)' : 'transparent',
          color: 'var(--text-2)', transition: 'background 120ms, color 120ms',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-1)'; }}
        onMouseLeave={e => { if (!open) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; } }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {totalNew > 0 && (
          <span style={{
            position: 'absolute', top: 1, right: 1,
            minWidth: 16, height: 16, borderRadius: 8,
            background: 'var(--danger)', color: '#fff',
            fontSize: '0.625rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1, pointerEvents: 'none',
          }}>
            {totalNew > 99 ? '99+' : totalNew}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            width: 300,
            borderRadius: '0.625rem',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isAr ? 'الإجراءات المطلوبة' : 'Action Items'}
            </span>
            <button
              onClick={markAllRead}
              style={{ fontSize: '0.6875rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem 0.25rem', borderRadius: 4 }}
            >
              {isAr ? 'تعليم الكل كمقروء' : 'Mark all as read'}
            </button>
          </div>

          {/* Items */}
          <ul style={{ margin: 0, padding: '0.375rem 0', listStyle: 'none' }}>
            {ITEMS.map(({ key, labelEn, labelAr, href, color }) => {
              const total = counts[key];
              const fresh = newCount(key);
              return (
                <li key={key}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.625rem 1rem', textDecoration: 'none',
                      background: fresh > 0 ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'transparent',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = fresh > 0 ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      {fresh > 0 && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      )}
                      {fresh === 0 && (
                        <span style={{ width: 6, height: 6, flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: '0.8125rem', color: fresh > 0 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: fresh > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isAr ? labelAr : labelEn}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                      {fresh > 0 && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color, background: `color-mix(in srgb, ${color} 15%, transparent)`, borderRadius: 4, padding: '0.1rem 0.35rem' }}>
                          +{fresh} {isAr ? 'جديد' : 'new'}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: total > 0 ? 'var(--text-2)' : 'var(--text-3)', minWidth: '1.5rem', textAlign: 'right' }}>
                        {total}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Footer */}
          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setOpen(false)}
              style={{ fontSize: '0.75rem', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem 0' }}
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
