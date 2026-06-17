'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import StatusBadge from '../../../../../components/StatusBadge';

interface JELine {
  id: string;
  debit: number;
  credit: number;
  description?: string;
  account?: { code: string; name: string };
  partner?: { name: string };
}

interface JournalEntry {
  id: string;
  date: string;
  ref?: string;
  status: string;
  journal?: { code: string; name: string };
  currency?: { code: string };
  lines: JELine[];
  createdBy?: { firstName: string; lastName: string };
}

const fmt = (n: number) =>
  Number(n).toLocaleString('en-EG', { maximumFractionDigits: 2 });

export default function GlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: entry, loading, error, reload } = useQuery<JournalEntry>(
    `/finance/gl/entries/${id}`,
    [id],
  );

  const [posting, setPosting] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [actionErr, setActionErr] = useState('');

  async function post() {
    setPosting(true);
    setActionErr('');
    try {
      await apiFetch(`/finance/gl/entries/${id}/post`, { method: 'PATCH' });
      await reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setPosting(false);
    }
  }

  async function reverse() {
    if (!confirm('Create a reversal entry for this journal entry?')) return;
    setReversing(true);
    setActionErr('');
    try {
      await apiFetch(`/finance/gl/entries/${id}/reverse`, { method: 'POST' });
      await reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setReversing(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (error || !entry) return (
    <div className="p-6">
      <p className="text-red-400 text-sm mb-3">{error ?? 'Entry not found'}</p>
      <Link href="/finance/gl" className="text-blue-400 text-sm hover:text-blue-300">← Back</Link>
    </div>
  );

  const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/finance/gl" className="text-xs text-gray-500 hover:text-white transition mb-2 inline-block">
            ← Journal Entries
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white font-mono">{entry.ref ?? entry.id.slice(0, 8)}</h1>
            <StatusBadge status={entry.status} />
            {!balanced && (
              <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded">
                Unbalanced
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1">
            {entry.journal?.code} — {entry.journal?.name}
          </p>
        </div>

        <div className="flex gap-2">
          {entry.status === 'DRAFT' && (
            <button onClick={post} disabled={posting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
              {posting ? 'Posting…' : 'Post'}
            </button>
          )}
          {entry.status === 'POSTED' && (
            <button onClick={reverse} disabled={reversing}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 text-sm rounded-lg transition">
              {reversing ? '…' : 'Reverse'}
            </button>
          )}
        </div>
      </div>

      {actionErr && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {actionErr}
        </div>
      )}

      {/* Meta */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-1">Date</p>
          <p className="text-sm text-white font-medium">{new Date(entry.date).toLocaleDateString('en-EG')}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-1">Currency</p>
          <p className="text-sm text-white font-medium">{entry.currency?.code ?? 'EGP'}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-1">Balance</p>
          <p className={`text-sm font-medium ${balanced ? 'text-green-400' : 'text-red-400'}`}>
            {balanced ? '✓ Balanced' : `Diff: ${fmt(Math.abs(totalDebit - totalCredit))}`}
          </p>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 border-b border-white/5">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Account</th>
              <th className="px-5 py-3 text-left font-medium">Partner</th>
              <th className="px-5 py-3 text-left font-medium">Description</th>
              <th className="px-5 py-3 text-right font-medium">Debit</th>
              <th className="px-5 py-3 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {entry.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3 text-gray-300 text-xs">
                  {l.account ? `${l.account.code} — ${l.account.name}` : '—'}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">{l.partner?.name ?? '—'}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">{l.description ?? ''}</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {Number(l.debit) > 0 ? (
                    <span className="text-green-400">{fmt(l.debit)}</span>
                  ) : ''}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {Number(l.credit) > 0 ? (
                    <span className="text-red-400">{fmt(l.credit)}</span>
                  ) : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-white/10 text-xs font-semibold">
            <tr>
              <td colSpan={3} className="px-5 py-3 text-gray-400">Totals</td>
              <td className="px-5 py-3 text-right text-green-400 tabular-nums">{fmt(totalDebit)}</td>
              <td className="px-5 py-3 text-right text-red-400 tabular-nums">{fmt(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
