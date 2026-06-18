'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import StatusBadge from '../../../../../components/StatusBadge';
import SearchableCombobox from '../../../../../components/ui/SearchableCombobox';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  category?: string;
  account?: { code: string; name: string };
  tax?: { name: string; rate: number };
}

interface PaymentAllocation {
  id: string;
  amount: number;
  payment: {
    id: string;
    date: string;
    amount: number;
    method: string;
    status: string;
  };
}

interface Invoice {
  id: string;
  type: string;
  status: string;
  paymentStatus: string;
  date: string;
  dueDate?: string;
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
  amountResidual: number;
  partner?: { id: string; name: string };
  deal?: { id: string; ref?: string };
  journal?: { code: string; name: string };
  lines: InvoiceLine[];
  paymentAllocations: PaymentAllocation[];
  journalEntry?: {
    id: string;
    ref?: string;
    lines: { id: string; debit: number; credit: number; account?: { code: string; name: string } }[];
  };
}

const fmt = (n: number) =>
  Number(n).toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });

// ── Register Payment Dialog ──────────────────────────────────────────────────
function RegisterPaymentDialog({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    amount: Number(invoice.amountResidual).toFixed(2),
    date: new Date().toISOString().split('T')[0],
    method: 'TRANSFER',
    memo: '',
    journalId: '',
  });
  const { data: journals } = useQuery<{ items: { id: string; code: string; name: string }[] }>(
    '/finance/journals?type=BANK&limit=50',
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const journalOpts = (journals?.items ?? []).map((j) => ({
    value: j.id,
    label: `${j.code} — ${j.name}`,
  }));

  const METHODS = [
    { value: 'TRANSFER', label: 'Bank Transfer' },
    { value: 'CHECK', label: 'Check' },
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.journalId) { setErr('Select a journal.'); return; }
    setSaving(true);
    setErr('');
    try {
      await apiFetch('/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          type: invoice.type === 'CUSTOMER_INVOICE' ? 'INBOUND' : 'OUTBOUND',
          partnerId: invoice.partner?.id,
          journalId: form.journalId,
          date: form.date,
          amount: Number(form.amount),
          method: form.method,
          memo: form.memo || undefined,
          invoiceIds: [invoice.id],
        }),
      });
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Register Payment</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition text-lg leading-none">×</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount (EGP) *</label>
              <input
                type="number" step="0.01" required
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date *</label>
              <input
                type="date" required
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <SearchableCombobox
            label="Journal *"
            options={journalOpts}
            value={form.journalId}
            onChange={(v) => setForm((p) => ({ ...p, journalId: v }))}
            placeholder="Select journal…"
          />

          <SearchableCombobox
            label="Method"
            options={METHODS}
            value={form.method}
            onChange={(v) => setForm((p) => ({ ...p, method: v }))}
          />

          <div>
            <label className="block text-xs text-gray-500 mb-1">Memo</label>
            <input
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              placeholder="Optional reference…"
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {err && <p className="text-red-400 text-xs">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
              {saving ? 'Saving…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Line Form ─────────────────────────────────────────────────────────────
function AddLineForm({
  invoiceId,
  onSuccess,
  onCancel,
}: {
  invoiceId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { data: accountsRaw } = useQuery<{ items?: { id: string; code: string; name: string }[] } | { id: string; code: string; name: string }[]>(
    '/finance/accounts?limit=200',
  );
  const { data: taxesRaw } = useQuery<{ items?: { id: string; name: string }[] } | { id: string; name: string }[]>(
    '/finance/taxes?limit=50',
  );

  const accountOpts = (() => {
    const arr = Array.isArray(accountsRaw) ? accountsRaw : (accountsRaw as any)?.items ?? [];
    return (arr as { id: string; code: string; name: string }[]).map((a) => ({
      value: a.id,
      label: `${a.code} — ${a.name}`,
    }));
  })();

  const taxOpts = (() => {
    const arr = Array.isArray(taxesRaw) ? taxesRaw : (taxesRaw as any)?.items ?? [];
    return [
      { value: '', label: 'No tax' },
      ...(arr as { id: string; name: string }[]).map((t) => ({ value: t.id, label: t.name })),
    ];
  })();

  const [form, setForm] = useState({
    description: '',
    quantity: '1',
    unitPrice: '',
    accountId: '',
    taxId: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountId) { setErr('Select an account.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch(`/finance/invoices/${invoiceId}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          description: form.description,
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
          accountId: form.accountId,
          ...(form.taxId ? { taxId: form.taxId } : {}),
        }),
      });
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-blue-500/20 bg-blue-900/10">
      <td colSpan={6} className="px-5 py-4">
        <form onSubmit={submit}>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Description *</label>
              <input required value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Line item description"
                className="w-full px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Qty *</label>
              <input required type="number" min="0.01" step="0.01" value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit Price *</label>
              <input required type="number" min="0" step="0.01" value={form.unitPrice}
                onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Subtotal</p>
              <p className="px-3 py-1.5 text-xs text-white tabular-nums">
                {form.quantity && form.unitPrice
                  ? fmt(Number(form.quantity) * Number(form.unitPrice))
                  : '—'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <SearchableCombobox
              label="Account *"
              options={accountOpts}
              value={form.accountId}
              onChange={(v) => setForm((p) => ({ ...p, accountId: v }))}
              placeholder="Select account…"
            />
            <SearchableCombobox
              label="Tax"
              options={taxOpts}
              value={form.taxId}
              onChange={(v) => setForm((p) => ({ ...p, taxId: v }))}
              placeholder="No tax"
            />
          </div>
          {err && <p className="text-red-400 text-xs mb-2">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="px-3 py-1.5 text-xs text-gray-400 border border-white/10 rounded-lg hover:text-white transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
              {saving ? 'Adding…' : 'Add Line'}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

interface PurchaseOrder {
  id: string;
  amountTotal: number;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: invoice, loading, error, reload } = useQuery<Invoice>(`/finance/invoices/${id}`, [id]);

  // 3-way match: fetch PO only for VENDOR_BILL with a linked deal
  const dealId = invoice?.type === 'VENDOR_BILL' && invoice?.deal?.id ? invoice.deal.id : null;
  const { data: poData } = useQuery<{ data: PurchaseOrder[] }>(
    dealId ? `/purchase-orders?dealId=${dealId}&limit=1` : null,
    [dealId],
  );
  const po = poData?.data?.[0] ?? null;
  const poVariance = po && invoice
    ? Number(invoice.amountTotal) - Number(po.amountTotal)
    : null;
  const showPoWarning =
    invoice?.status === 'DRAFT' &&
    po !== null &&
    poVariance !== null &&
    (Math.abs(poVariance) / Math.max(Number(po.amountTotal), 1) > 0.01 || Math.abs(poVariance) > 500);

  const [posting, setPosting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [actionErr, setActionErr] = useState('');

  async function post() {
    setPosting(true);
    setActionErr('');
    try {
      await apiFetch(`/finance/invoices/${id}/post`, { method: 'PATCH' });
      await reload();
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setPosting(false);
    }
  }

  async function cancel() {
    if (!confirm('Cancel this invoice? This cannot be undone.')) return;
    setCancelling(true);
    setActionErr('');
    try {
      await apiFetch(`/finance/invoices/${id}/cancel`, { method: 'PATCH' });
      await reload();
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return (
    <div className="p-6 text-gray-500 text-sm">Loading invoice…</div>
  );
  if (error || !invoice) return (
    <div className="p-6">
      <p className="text-red-400 text-sm mb-3">{error ?? 'Invoice not found'}</p>
      <Link href="/finance/invoices" className="text-blue-400 text-sm hover:text-blue-300">← Back to invoices</Link>
    </div>
  );

  const isDraft = invoice.status === 'DRAFT';
  const isPosted = invoice.status === 'POSTED';
  const canPay = isPosted && invoice.amountResidual > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/finance/invoices" className="text-xs text-gray-500 hover:text-white transition mb-2 inline-block">
            ← Invoices
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">
              {invoice.type.replace(/_/g, ' ')}
            </h1>
            <StatusBadge status={invoice.status} />
            <StatusBadge status={invoice.paymentStatus} />
          </div>
          {invoice.partner && (
            <p className="text-gray-400 text-sm mt-1">{invoice.partner.name}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {isDraft && (
            <button onClick={post} disabled={posting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
              {posting ? 'Posting…' : 'Post Invoice'}
            </button>
          )}
          {canPay && (
            <button onClick={() => setShowPayDialog(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition">
              Register Payment
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

      {/* 3-way match PO variance warning */}
      {showPoWarning && po && poVariance !== null && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <span className="text-amber-400 text-sm shrink-0">&#9888;</span>
          <p className="text-amber-300 text-xs">
            <span className="font-semibold">PO variance detected</span>
            {' '}&mdash;{' '}
            PO total: {fmt(Number(po.amountTotal))} &middot; Invoice total: {fmt(Number(invoice!.amountTotal))} &middot; Variance: {fmt(Math.abs(poVariance))}
          </p>
        </div>
      )}

      {/* Meta cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Invoice Date', value: new Date(invoice.date).toLocaleDateString('en-EG') },
          { label: 'Due Date', value: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-EG') : '—' },
          { label: 'Journal', value: invoice.journal ? `${invoice.journal.code} — ${invoice.journal.name}` : '—' },
          { label: 'Deal', value: invoice.deal?.ref ?? invoice.deal?.id?.slice(0, 8) ?? '—' },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-white/5 bg-gray-900 p-4">
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <p className="text-sm text-white font-medium">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Amount summary */}
        <div className="lg:col-span-1 rounded-xl border border-white/5 bg-gray-900 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Amounts</p>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white tabular-nums">{fmt(invoice.amountUntaxed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tax</span>
              <span className="text-white tabular-nums">{fmt(invoice.amountTax)}</span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-2.5 font-semibold">
              <span className="text-gray-200">Total</span>
              <span className="text-white tabular-nums">{fmt(invoice.amountTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Amount Due</span>
              <span className={`tabular-nums font-semibold ${Number(invoice.amountResidual) > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {fmt(invoice.amountResidual)}
              </span>
            </div>
          </div>
        </div>

        {/* Payments received */}
        <div className="lg:col-span-2 rounded-xl border border-white/5 bg-gray-900 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Payments Applied</p>
          {invoice.paymentAllocations.length === 0 ? (
            <p className="text-gray-600 text-sm">No payments recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-left pb-2 font-medium">Method</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-right pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoice.paymentAllocations.map((pa) => (
                  <tr key={pa.id}>
                    <td className="py-2 text-gray-300">{new Date(pa.payment.date).toLocaleDateString('en-EG')}</td>
                    <td className="py-2 text-gray-400">{pa.payment.method}</td>
                    <td className="py-2"><StatusBadge status={pa.payment.status} /></td>
                    <td className="py-2 text-right text-white tabular-nums">{fmt(pa.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Invoice lines */}
      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invoice Lines</p>
          {isDraft && !showAddLine && (
            <button onClick={() => setShowAddLine(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition border border-blue-500/30 px-2 py-0.5 rounded">
              + Add Line
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 border-b border-white/5">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Description</th>
              <th className="px-5 py-3 text-left font-medium">Account</th>
              <th className="px-5 py-3 text-right font-medium">Qty</th>
              <th className="px-5 py-3 text-right font-medium">Unit Price</th>
              <th className="px-5 py-3 text-right font-medium">Tax</th>
              <th className="px-5 py-3 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3 text-white">
                  {l.description}
                  {l.category && <span className="ml-2 text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{l.category}</span>}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {l.account ? `${l.account.code} ${l.account.name}` : '—'}
                </td>
                <td className="px-5 py-3 text-right text-gray-300 tabular-nums">{l.quantity}</td>
                <td className="px-5 py-3 text-right text-gray-300 tabular-nums">{fmt(l.unitPrice)}</td>
                <td className="px-5 py-3 text-right text-gray-500 text-xs">
                  {l.tax ? `${l.tax.name} ${l.tax.rate}%` : '—'}
                </td>
                <td className="px-5 py-3 text-right text-white tabular-nums">{fmt(l.subtotal)}</td>
              </tr>
            ))}
            {showAddLine && (
              <AddLineForm
                invoiceId={id}
                onSuccess={() => { setShowAddLine(false); reload(); }}
                onCancel={() => setShowAddLine(false)}
              />
            )}
          </tbody>
        </table>
        {isDraft && !showAddLine && (
          <div className="px-5 py-3 border-t border-white/5">
            <button onClick={() => setShowAddLine(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition">
              + Add another line
            </button>
          </div>
        )}
      </div>

      {/* GL entries (after post) */}
      {invoice.journalEntry && (
        <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Journal Entry</p>
            <span className="text-xs text-gray-600">{invoice.journalEntry.ref}</span>
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
              {invoice.journalEntry.lines.map((l) => (
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

      {showPayDialog && (
        <RegisterPaymentDialog
          invoice={invoice}
          onClose={() => setShowPayDialog(false)}
          onSuccess={() => { setShowPayDialog(false); reload(); }}
        />
      )}
    </div>
  );
}
