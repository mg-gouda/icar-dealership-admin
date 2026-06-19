'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface Invoice {
  id: string; type: string; status: string; paymentStatus: string;
  date: string; dueDate?: string; amountTotal: number; amountResidual: number;
  partner?: { name: string }; journal?: { code: string };
}

interface InvLine { accountId: string; description: string; quantity: string; unitPrice: string; }
const EMPTY_LINE = (): InvLine => ({ accountId: '', description: '', quantity: '1', unitPrice: '' });

const INV_TYPES = [
  { value: 'CUSTOMER_INVOICE', label: 'Customer Invoice' },
  { value: 'VENDOR_BILL', label: 'Vendor Bill' },
  { value: 'CREDIT_NOTE', label: 'Credit Note' },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [type, setType] = useState('CUSTOMER_INVOICE');
  const { data, loading, error, reload } = useQuery<{ items: Invoice[]; total: number }>(
    `/finance/invoices?type=${type}&limit=30`,
    [type],
  );

  const { data: journalsRaw } = useQuery<any[]>('/finance/gl/journals');
  const { data: accountsRaw } = useQuery<{ items: any[] }>('/finance/gl/accounts?limit=200');
  const { data: partnersRaw } = useQuery<any[]>('/partners?limit=100');

  const invoices = data?.items ?? [];
  const journals = (Array.isArray(journalsRaw) ? journalsRaw : []).map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));
  const accounts = (accountsRaw?.items ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));
  const partners = (Array.isArray(partnersRaw) ? partnersRaw : []).map((p) => ({ value: p.id, label: p.name }));

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ type: 'CUSTOMER_INVOICE', journalId: '', partnerId: '', date: new Date().toISOString().split('T')[0], dueDate: '' });
  const [lines, setLines] = useState<InvLine[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  function setLine(i: number, k: keyof InvLine, v: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }

  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.journalId || !form.partnerId) { setSaveErr('Journal and partner required.'); return; }
    const valid = lines.filter((l) => l.accountId && l.description && Number(l.unitPrice) > 0);
    if (!valid.length) { setSaveErr('At least 1 valid line required.'); return; }
    setSaving(true); setSaveErr('');
    try {
      const inv = await apiFetch<{ id: string }>('/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          dueDate: form.dueDate || undefined,
          lines: valid.map((l) => ({
            accountId: l.accountId,
            description: l.description,
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice),
          })),
        }),
      });
      setShowNew(false);
      setForm({ type: 'CUSTOMER_INVOICE', journalId: '', partnerId: '', date: new Date().toISOString().split('T')[0], dueDate: '' });
      setLines([EMPTY_LINE()]);
      router.push(`/finance/invoices/${inv.id}`);
    } catch (err: unknown) { setSaveErr(err instanceof Error ? err.message : 'Error'); }
    finally { setSaving(false); }
  }

  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length;

  return (
    <div className="p-6">
      {draftCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <p className="text-sm text-amber-300 font-medium">
            {draftCount} invoice{draftCount !== 1 ? 's' : ''} pending review
          </p>
          <button onClick={() => {}} className="text-xs text-amber-400 hover:text-amber-300 underline">
            Filter to Draft
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Invoices</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            ← Finance
          </Link>
          <button onClick={() => setShowNew(true)}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium">
            + New Invoice
          </button>
        </div>
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
                <tr key={inv.id} onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                  className="hover:bg-white/5 transition cursor-pointer">
                  <td className="px-4 py-2.5 text-gray-300 text-xs">{new Date(inv.date).toLocaleDateString('en-EG')}</td>
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

      {/* New Invoice Dialog */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-gray-900 border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-sm font-semibold text-white">New Invoice</h2>
              <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <SearchableCombobox label="Type" options={INV_TYPES} value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })} />
                <SearchableCombobox label="Journal *" options={journals} value={form.journalId}
                  onChange={(v) => setForm({ ...form, journalId: v })} placeholder="Select journal" />
                <SearchableCombobox label="Partner *" options={partners} value={form.partnerId}
                  onChange={(v) => setForm({ ...form, partnerId: v })} placeholder="Select partner" />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Lines</p>
                <div className="grid grid-cols-[1fr_1fr_80px_90px_24px] gap-1.5 text-xs text-gray-500 mb-1.5 px-1">
                  <span>Account</span><span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit Price</span><span />
                </div>
                <div className="space-y-1.5">
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_80px_90px_24px] gap-1.5 items-center">
                      <SearchableCombobox options={accounts} value={line.accountId}
                        onChange={(v) => setLine(i, 'accountId', v)} placeholder="Account…" />
                      <input value={line.description} onChange={(e) => setLine(i, 'description', e.target.value)}
                        placeholder="Description"
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
                      <input type="number" min="1" step="1" value={line.quantity}
                        onChange={(e) => setLine(i, 'quantity', e.target.value)}
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-right tabular-nums text-white focus:outline-none focus:border-blue-500" />
                      <input type="number" min="0" step="0.01" value={line.unitPrice}
                        onChange={(e) => setLine(i, 'unitPrice', e.target.value)}
                        placeholder="0.00"
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-right tabular-nums text-white focus:outline-none focus:border-blue-500" />
                      <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        disabled={lines.length <= 1}
                        className="text-gray-600 hover:text-red-400 disabled:opacity-30 text-sm leading-none">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button type="button" onClick={() => setLines((prev) => [...prev, EMPTY_LINE()])}
                    className="text-xs text-blue-400 hover:text-blue-300 transition">+ Add line</button>
                  <span className="text-xs text-gray-400 tabular-nums">
                    Subtotal: <span className="text-white font-medium">{subtotal.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP</span>
                  </span>
                </div>
              </div>

              {saveErr && <p className="text-red-400 text-xs">{saveErr}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
