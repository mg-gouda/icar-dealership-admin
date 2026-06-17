'use client';

import Link from 'next/link';
import { useQuery } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';

interface Invoice {
  id: string; number: string; status: string; total: number;
  invoiceDate: string; dueDate?: string;
  partner?: { firstName?: string; lastName?: string; companyName?: string };
}

export default function FinancePage() {
  const { data: invoices, loading } = useQuery<Invoice[]>('/finance/invoices?type=CUSTOMER_INVOICE&limit=20');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Finance</h1>
          <p className="text-xs text-gray-500 mt-0.5">Accounting & reporting</p>
        </div>
      </div>

      {/* Finance module cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Journal Entries', href: '/finance/gl', icon: '📋', desc: 'Post & review GL' },
          { label: 'Invoices', href: '/finance/invoices', icon: '🧾', desc: 'Customer invoices' },
          { label: 'Payments', href: '/finance/payments', icon: '💳', desc: 'Cash & bank' },
          { label: 'Trial Balance', href: '/finance/gl?view=trial-balance', icon: '⚖️', desc: 'Period close' },
        ].map((c) => (
          <Link key={c.href} href={c.href}
            className="rounded-xl border border-white/5 bg-gray-900 p-5 hover:border-white/20 transition group">
            <div className="text-2xl mb-2">{c.icon}</div>
            <p className="text-sm font-medium text-white group-hover:text-blue-300 transition">{c.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent invoices */}
      <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-white">Recent Invoices</p>
          <Link href="/finance/invoices" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        {!loading && (
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs">
              <tr>
                <th className="text-left pb-3 font-medium">Number</th>
                <th className="text-left pb-3 font-medium">Customer</th>
                <th className="text-left pb-3 font-medium">Date</th>
                <th className="text-right pb-3 font-medium">Total</th>
                <th className="text-left pb-3 pl-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(invoices ?? []).map((inv) => {
                const name = inv.partner?.companyName ??
                  [inv.partner?.firstName, inv.partner?.lastName].filter(Boolean).join(' ') ?? '—';
                return (
                  <tr key={inv.id} className="hover:bg-white/2 transition">
                    <td className="py-2.5 font-mono text-gray-300 text-xs">{inv.number}</td>
                    <td className="py-2.5 text-white">{name}</td>
                    <td className="py-2.5 text-gray-500 text-xs">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="py-2.5 text-right text-white">
                      {Number(inv.total).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2.5 pl-3"><StatusBadge status={inv.status} /></td>
                  </tr>
                );
              })}
              {invoices?.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-gray-600 text-sm">No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
