'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import StatusBadge from '../../../../../components/StatusBadge';

interface PaymentAllocation {
  id: string;
  amount: number;
  invoice?: {
    id: string;
    type: string;
    status: string;
    amountTotal: number;
    partner?: { name: string };
  };
}

interface Payment {
  id: string;
  type: string;
  status: string;
  date: string;
  amount: number;
  method: string;
  memo?: string;
  partner?: { id: string; name: string };
  journal?: { code: string; name: string };
  journalEntry?: {
    id: string;
    ref?: string;
    lines: { id: string; debit: number; credit: number; account?: { code: string; name: string } }[];
  };
  allocations: PaymentAllocation[];
}

const fmt = (n: number) =>
  Number(n).toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: payment, loading, error, reload } = useQuery<Payment>(`/finance/payments/${id}`, [id]);

  const [posting, setPosting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionErr, setActionErr] = useState('');

  async function post() {
    setPosting(true);
    setActionErr('');
    try {
      await apiFetch(`/finance/payments/${id}/post`, { method: 'PATCH' });
      await reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setPosting(false);
    }
  }

  async function cancel() {
    if (!confirm('Cancel this payment? This will reverse allocations.')) return;
    setCancelling(true);
    setActionErr('');
    try {
      await apiFetch(`/finance/payments/${id}/cancel`, { method: 'PATCH' });
      await reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading payment…</div>;
  if (error || !payment) return (
    <div className="p-6">
      <p className="text-red-400 text-sm mb-3">{error ?? 'Payment not found'}</p>
      <Link href="/finance/payments" className="text-blue-400 text-sm hover:text-blue-300">← Back</Link>
    </div>
  );

  const isDraft = payment.status === 'DRAFT';
  const isPosted = payment.status === 'POSTED';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/finance/payments" className="text-xs text-gray-500 hover:text-white transition mb-2 inline-block">
            ← Payments
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">
              {payment.type === 'INBOUND' ? 'Customer Payment' : 'Vendor Payment'}
            </h1>
            <StatusBadge status={payment.status} />
          </div>
          {payment.partner && <p className="text-gray-400 text-sm mt-1">{payment.partner.name}</p>}
        </div>

        <div className="flex gap-2">
          {isDraft && (
            <button onClick={post} disabled={posting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
              {posting ? 'Posting…' : 'Post Payment'}
            </button>
          )}
          {(isDraft || isPosted) && (
            <button onClick={cancel} disabled={cancelling}
              className="px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 text-sm rounded-lg transition">
              {cancelling ? '…' : 'Cancel'}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Date', value: new Date(payment.date).toLocaleDateString('en-EG') },
          { label: 'Method', value: payment.method },
          { label: 'Journal', value: payment.journal ? `${payment.journal.code} — ${payment.journal.name}` : '—' },
          { label: 'Amount', value: fmt(payment.amount) },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-white/5 bg-gray-900 p-4">
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <p className="text-sm text-white font-medium">{m.value}</p>
          </div>
        ))}
      </div>

      {payment.memo && (
        <div className="mb-4 rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-1">Memo</p>
          <p className="text-sm text-white">{payment.memo}</p>
        </div>
      )}

      {/* Allocations */}
      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-white/5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied to Invoices</p>
        </div>
        {payment.allocations.length === 0 ? (
          <p className="p-5 text-gray-600 text-sm">No invoice allocations.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-white/5">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Invoice</th>
                <th className="px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Invoice Total</th>
                <th className="px-5 py-3 text-right font-medium">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payment.allocations.map((al) => (
                <tr key={al.id}>
                  <td className="px-5 py-3">
                    {al.invoice ? (
                      <Link href={`/finance/invoices/${al.invoice.id}`}
                        className="text-blue-400 hover:text-blue-300 text-xs">
                        {al.invoice.id.slice(0, 8)}…
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{al.invoice?.type?.replace(/_/g, ' ') ?? '—'}</td>
                  <td className="px-5 py-3">{al.invoice && <StatusBadge status={al.invoice.status} />}</td>
                  <td className="px-5 py-3 text-right text-gray-300 tabular-nums">
                    {al.invoice ? fmt(al.invoice.amountTotal) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-white tabular-nums">{fmt(al.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* GL entries */}
      {payment.journalEntry && (
        <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Journal Entry</p>
            <span className="text-xs text-gray-600">{payment.journalEntry.ref}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-white/5">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Account</th>
                <th className="px-5 py-3 text-right font-medium">Debit</th>
                <th className="px-5 py-3 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payment.journalEntry.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-3 text-gray-300 text-xs">
                    {l.account ? `${l.account.code} — ${l.account.name}` : l.id}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-green-400">
                    {Number(l.debit) > 0 ? fmt(l.debit) : ''}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-red-400">
                    {Number(l.credit) > 0 ? fmt(l.credit) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
