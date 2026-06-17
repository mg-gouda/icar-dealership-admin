'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';

interface Invoice {
  id: string;
  type: string;
  status: string;
  paymentStatus: string;
  date: string;
  dueDate?: string;
  amountTotal: number;
  amountResidual: number;
  partner?: { name: string };
  journal?: { code: string };
}

export default function InvoicesPage() {
  const router = useRouter();
  const [type, setType] = useState('CUSTOMER_INVOICE');
  const { data, loading, error } = useQuery<{ items: Invoice[]; total: number }>(
    `/finance/invoices?type=${type}&limit=30`,
    [type],
  );

  const invoices = data?.items ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Invoices</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <Link href="/finance" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
          ← Finance
        </Link>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { key: 'CUSTOMER_INVOICE', label: 'Customer Invoices' },
          { key: 'VENDOR_BILL', label: 'Vendor Bills' },
          { key: 'CREDIT_NOTE', label: 'Credit Notes' },
        ].map((t) => (
          <button key={t.key} onClick={() => setType(t.key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${type === t.key ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        {loading && <p className="p-6 text-gray-500 text-sm">Loading…</p>}
        {error && <p className="p-6 text-red-400 text-sm">{error}</p>}
        {!loading && (
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 text-gray-400 text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Partner</th>
                <th className="px-4 py-3 text-left font-medium">Journal</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Due</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((inv) => (
                <tr key={inv.id}
                  onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                  className="hover:bg-white/5 transition cursor-pointer">
                  <td className="px-4 py-2.5 text-gray-300 text-xs">
                    {new Date(inv.date).toLocaleDateString('en-EG')}
                  </td>
                  <td className="px-4 py-2.5 text-white">{inv.partner?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{inv.journal?.code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-white tabular-nums">
                    {Number(inv.amountTotal).toLocaleString('en-EG', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className={Number(inv.amountResidual) > 0 ? 'text-amber-400' : 'text-gray-500'}>
                      {Number(inv.amountResidual).toLocaleString('en-EG', { maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={inv.paymentStatus} /></td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">No invoices found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
