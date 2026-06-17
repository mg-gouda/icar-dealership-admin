'use client';

import Link from 'next/link';
import { useQuery } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';

interface JournalEntry {
  id: string;
  date: string;
  ref?: string;
  status: string;
  journal?: { name: string; code: string };
  lines?: { debit: number; credit: number }[];
}

export default function GlPage() {
  const { data, loading, error } = useQuery<{ items: JournalEntry[]; total: number }>(
    '/finance/gl?limit=30',
  );

  const entries = data?.items ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Journal Entries</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            ← Finance
          </Link>
          <Link href="/finance/reports" className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition">
            Reports
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        {loading && <p className="p-6 text-gray-500 text-sm">Loading…</p>}
        {error && <p className="p-6 text-red-400 text-sm">{error}</p>}
        {!loading && (
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 text-gray-400 text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Ref</th>
                <th className="px-4 py-3 text-left font-medium">Journal</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e) => {
                const totalDebit = e.lines?.reduce((s, l) => s + Number(l.debit), 0) ?? 0;
                const totalCredit = e.lines?.reduce((s, l) => s + Number(l.credit), 0) ?? 0;
                return (
                  <tr key={e.id} className="hover:bg-white/2 transition">
                    <td className="px-4 py-2.5 text-gray-300 text-xs">
                      {new Date(e.date).toLocaleDateString('en-EG')}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-300 text-xs">{e.ref ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{e.journal?.code ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-white tabular-nums">
                      {totalDebit > 0 ? totalDebit.toLocaleString('en-EG', { maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-white tabular-nums">
                      {totalCredit > 0 ? totalCredit.toLocaleString('en-EG', { maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No journal entries yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
