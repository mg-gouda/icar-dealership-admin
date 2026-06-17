'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';

interface Payment {
  id: string;
  type: string;
  status: string;
  date: string;
  amount: number;
  method: string;
  memo?: string;
  partner?: { name: string };
  journal?: { code: string };
}

export default function PaymentsPage() {
  const router = useRouter();
  const [type, setType] = useState('INBOUND');
  const { data, loading, error } = useQuery<{ items: Payment[]; total: number }>(
    `/finance/payments?type=${type}&limit=30`,
    [type],
  );

  const payments = data?.items ?? [];

  const fmt = (n: number) => n.toLocaleString('en-EG', { maximumFractionDigits: 2 });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Payments</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <Link href="/finance" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
          ← Finance
        </Link>
      </div>

      <div className="flex gap-1 mb-4">
        {[
          { key: 'INBOUND', label: 'Received' },
          { key: 'OUTBOUND', label: 'Sent' },
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
                <th className="px-4 py-3 text-left font-medium">Method</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments.map((p) => (
                <tr key={p.id}
                  onClick={() => router.push(`/finance/payments/${p.id}`)}
                  className="hover:bg-white/5 transition cursor-pointer">
                  <td className="px-4 py-2.5 text-gray-300 text-xs">
                    {new Date(p.date).toLocaleDateString('en-EG')}
                  </td>
                  <td className="px-4 py-2.5 text-white">{p.partner?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{p.journal?.code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{p.method}</td>
                  <td className="px-4 py-2.5 text-right text-white tabular-nums">
                    {fmt(Number(p.amount))}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No payments found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
