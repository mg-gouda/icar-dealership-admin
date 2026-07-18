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

const POLL_MS = 60_000;

export default function NotificationBell() {
  const { isAr } = useLang();
  const [counts, setCounts] = useState<Counts>({ draftInvoices: 0, payableCommissions: 0, overdueInstallments: 0, newLeads: 0, pendingPartPicks: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCounts = useCallback(async () => {
    try {
      // ponytail: invoices returns raw array → use limit=200 for count; commissions returns {items,total}
      const [invoices, commissions, installments, leads, partPicks] = await Promise.all([
        apiFetch<unknown[]>('/finance/invoices?status=DRAFT&limit=200').then(
          (r) => (Array.isArray(r) ? r.length : 0),
          () => 0,
        ),
        apiFetch<{ total?: number }>('/finance/commissions?status=PAYABLE&limit=1').then(
          (r) => r?.total ?? 0,
          () => 0,
        ),
        apiFetch<{ count?: number }>('/deals/installments/overdue-count').then(
          (r) => r?.count ?? 0,
          () => 0,
        ),
        apiFetch<{ total?: number }>('/leads?status=NEW&limit=1').then(
          (r) => (r as any)?.total ?? 0,
          () => 0,
        ),
        apiFetch<{ pending: number }>('/service-orders/part-picks/count').then(
          (r) => r?.pending ?? 0,
          () => 0,
        ),
      ]);

      setCounts({
        draftInvoices: invoices as number,
        payableCommissions: commissions as number,
        overdueInstallments: installments as number,
        newLeads: leads as number,
        pendingPartPicks: partPicks as number,
      });
    } catch {
      // silent — notification badge is best-effort
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, POLL_MS);
    return () => clearInterval(id);
  }, [fetchCounts]);

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const total = counts.draftInvoices + counts.payableCommissions + counts.overdueInstallments + counts.newLeads + counts.pendingPartPicks;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
        aria-label="Notifications"
      >
        {/* Bell SVG */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-white/10 bg-gray-900 shadow-xl z-50">
          <div className="px-4 py-2.5 border-b border-white/5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {isAr ? 'الإجراءات المطلوبة' : 'Action Items'}
          </div>
          <ul className="py-1">
            <li>
              <Link
                href="/finance/invoices?status=DRAFT"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
              >
                <span>{isAr ? 'فواتير مسودة' : 'Draft Invoices'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${counts.draftInvoices > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-gray-500'}`}>
                  {counts.draftInvoices}
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/finance/commissions"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
              >
                <span>{isAr ? 'عمولات مستحقة' : 'Payable Commissions'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${counts.payableCommissions > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-gray-500'}`}>
                  {counts.payableCommissions}
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/deals?tab=installments"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
              >
                <span>{isAr ? 'أقساط متأخرة' : 'Overdue Installments'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${counts.overdueInstallments > 0 ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-500'}`}>
                  {counts.overdueInstallments}
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/crm?status=NEW"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
              >
                <span>{isAr ? 'عملاء محتملون جدد' : 'New B2C Leads'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${counts.newLeads > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500'}`}>
                  {counts.newLeads}
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/service/part-picks"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
              >
                <span>{isAr ? 'قطع غيار للسحب من المستودع' : 'Parts to Fetch'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${counts.pendingPartPicks > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-500'}`}>
                  {counts.pendingPartPicks}
                </span>
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
