'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface Payment {
  id: string; type: string; status: string; date: string;
  amount: number; method: string; memo?: string;
  partner?: { name: string }; journal?: { code: string };
}

const PAYMENT_TYPES = [
  { value: 'INBOUND', label: 'Received (Inbound)' },
  { value: 'OUTBOUND', label: 'Sent (Outbound)' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Card' },
];

export default function PaymentsPage() {
  const router = useRouter();
  const [type, setType] = useState('INBOUND');
  const { data, loading, error, reload } = useQuery<{ items: Payment[]; total: number }>(
    `/finance/payments?type=${type}&limit=30`,
    [type],
  );

  const { data: journalsRaw } = useQuery<any[]>('/finance/gl/journals');
  const { data: partnersRaw } = useQuery<any[]>('/partners?limit=100');

  const payments = data?.items ?? [];
  const journals = (Array.isArray(journalsRaw) ? journalsRaw : []).map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));
  const partners = (Array.isArray(partnersRaw) ? partnersRaw : []).map((p) => ({ value: p.id, label: p.name }));

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    type: 'INBOUND', partnerId: '', journalId: '',
    amount: '', date: new Date().toISOString().split('T')[0],
    method: 'BANK_TRANSFER', memo: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partnerId || !form.journalId || !form.amount) { setSaveErr('Partner, journal, and amount required.'); return; }
    setSaving(true); setSaveErr('');
    try {
      const pmt = await apiFetch<{ id: string }>('/finance/payments', {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setShowNew(false);
      setForm({ type: 'INBOUND', partnerId: '', journalId: '', amount: '', date: new Date().toISOString().split('T')[0], method: 'BANK_TRANSFER', memo: '' });
      router.push(`/finance/payments/${pmt.id}`);
    } catch (err: unknown) { setSaveErr(err instanceof Error ? err.message : String(err)); }
    finally { setSaving(false); }
  }

  const fmt = (n: number) => n.toLocaleString('en-EG', { maximumFractionDigits: 2 });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Payments</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            ← Finance
          </Link>
          <button onClick={() => setShowNew(true)}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium">
            + New Payment
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {[{ key: 'INBOUND', label: 'Received' }, { key: 'OUTBOUND', label: 'Sent' }].map((t) => (
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
                <tr key={p.id} onClick={() => router.push(`/finance/payments/${p.id}`)}
                  className="hover:bg-white/5 transition cursor-pointer">
                  <td className="px-4 py-2.5 text-gray-300 text-xs">{new Date(p.date).toLocaleDateString('en-EG')}</td>
                  <td className="px-4 py-2.5 text-white">{p.partner?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{p.journal?.code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{p.method}</td>
                  <td className="px-4 py-2.5 text-right text-white tabular-nums">{fmt(Number(p.amount))}</td>
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

      {/* New Payment Dialog */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">New Payment</h2>
              <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3">
              <SearchableCombobox label="Type" options={PAYMENT_TYPES} value={form.type} onChange={(v) => set('type', v)} />
              <SearchableCombobox label="Partner *" options={partners} value={form.partnerId}
                onChange={(v) => set('partnerId', v)} placeholder="Select partner" />
              <SearchableCombobox label="Journal *" options={journals} value={form.journalId}
                onChange={(v) => set('journalId', v)} placeholder="Select journal" />
              <SearchableCombobox label="Method" options={PAYMENT_METHODS} value={form.method} onChange={(v) => set('method', v)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount (EGP) *</label>
                  <input type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={(e) => set('amount', e.target.value)} required
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Memo</label>
                <input value={form.memo} onChange={(e) => set('memo', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              {saveErr && <p className="text-red-400 text-xs">{saveErr}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
