'use client';

import Link from 'next/link';
import { useQuery } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';

interface Invoice {
  id: string; status: string;
  dueDate?: string; amountTotal: number; amountResidual: number;
  partner?: { name: string };
}

const MODULES = [
  { label: 'Journal Entries', href: '/finance/gl', desc: 'Post & review GL' },
  { label: 'Invoices', href: '/finance/invoices', desc: 'Customer invoices & bills' },
  { label: 'Payments', href: '/finance/payments', desc: 'Cash & bank payments' },
  { label: 'Reports', href: '/finance/reports', desc: 'Trial balance, P&L, BS' },
  { label: 'Chart of Accounts', href: '/finance/accounts', desc: 'COA — view & create accounts' },
  { label: 'Journals', href: '/finance/journals', desc: 'Sales, purchase, cash & bank journals' },
  { label: 'Bank Statements', href: '/finance/bank-statements', desc: 'Import & reconcile' },
  { label: 'Fixed Assets', href: '/finance/assets', desc: 'Depreciation schedules' },
  { label: 'Currencies', href: '/finance/currencies', desc: 'Exchange rates' },
  { label: 'Fiscal Years', href: '/finance/fiscal-years', desc: 'Periods & lock dates' },
  { label: 'Taxes', href: '/finance/taxes', desc: 'VAT rates & groups' },
  { label: 'Reconciliation', href: '/finance/reconciliation', desc: 'Match GL to bank lines' },
  { label: 'Commissions', href: '/finance/commissions', desc: 'Accrued → payable → paid' },
  { label: 'Commission Plans', href: '/finance/commission-plans', desc: 'Plans, percentages & tiers' },
  { label: 'Recurring Templates', href: '/finance/gl/recurring', desc: 'Auto-generate journal entries' },
];

export default function FinancePage() {
  const { data, loading } = useQuery<Invoice[]>('/finance/invoices?type=CUSTOMER_INVOICE&limit=5');
  const invoices = Array.isArray(data) ? data : [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Finance</h1>
        <p className="text-xs text-gray-500 mt-0.5">Accounting & reporting</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {MODULES.map((c) => (
          <Link key={c.href} href={c.href}
            className="rounded-xl border border-white/5 bg-gray-900 p-4 hover:border-white/20 transition group">
            <p className="text-sm font-medium text-white group-hover:text-blue-300 transition mb-0.5">{c.label}</p>
            <p className="text-xs text-gray-500">{c.desc}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-white">Recent Invoices</p>
          <Link href="/finance/invoices" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs">
            <tr>
              <th className="text-left pb-3 font-medium">Partner</th>
              <th className="text-left pb-3 font-medium">Due Date</th>
              <th className="text-right pb-3 font-medium">Total</th>
              <th className="text-right pb-3 font-medium">Due</th>
              <th className="text-left pb-3 pl-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-white/2 transition">
                <td className="py-2.5 text-white">{inv.partner?.name ?? '—'}</td>
                <td className="py-2.5 text-gray-500 text-xs">
                  {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-EG') : '—'}
                </td>
                <td className="py-2.5 text-right text-white tabular-nums">
                  {Number(inv.amountTotal).toLocaleString()}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  <span className={Number(inv.amountResidual) > 0 ? 'text-amber-400' : 'text-gray-500'}>
                    {Number(inv.amountResidual).toLocaleString()}
                  </span>
                </td>
                <td className="py-2.5 pl-3"><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
            {invoices.length === 0 && !loading && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-600 text-sm">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
