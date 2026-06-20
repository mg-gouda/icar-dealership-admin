'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface Invoice {
  id: string;
  number: string;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'PARTIAL' | 'CANCELLED';
  date: string;
  dueDate?: string;
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
  partner?: { name: string; email?: string; phone?: string };
  deal?: { ref?: string };
}

interface InvLine {
  description: string;
  qty: string;
  unitPrice: string;
  taxRate: string;
}

const EMPTY_LINE = (): InvLine => ({ description: '', qty: '1', unitPrice: '', taxRate: '14' });

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PAYMENT_TERM_OPTS = [
  { value: 'NET_30', label: 'Net 30' },
  { value: 'NET_60', label: 'Net 60' },
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
  { value: 'CUSTOM', label: 'Custom' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-info',
    PAID: 'badge badge-success',
    PARTIAL: 'badge badge-warning',
    CANCELLED: 'badge badge-danger',
  };
  return map[status] ?? 'badge badge-neutral';
}

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CustomerInvoicesPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const qs = new URLSearchParams({ limit: '30', ...(statusFilter && { status: statusFilter }), ...(search && { q: search }) });
  const { data, loading, error, reload } = useQuery<{ items: Invoice[]; total: number }>(
    `/finance/invoices?type=CUSTOMER_INVOICE&${qs}`,
    [statusFilter, search],
  );

  const { data: partnersRaw } = useQuery<any[]>('/partners?limit=200&type=CUSTOMER');
  const { data: journalsRaw } = useQuery<any[]>('/finance/journals?type=SALES&limit=50');
  const { data: dealsRaw } = useQuery<{ items: any[] }>('/deals?limit=100&status=ACTIVE');

  const invoices = data?.items ?? [];
  const partnerOpts = (Array.isArray(partnersRaw) ? partnersRaw : []).map((p) => ({ value: p.id, label: p.name }));
  const journalOpts = (Array.isArray(journalsRaw) ? journalsRaw : []).map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));
  const dealOpts = [
    { value: '', label: 'No deal reference' },
    ...((dealsRaw?.items ?? []).map((d) => ({ value: d.id, label: d.ref ?? d.id.slice(0, 8) }))),
  ];

  // Form state
  const [form, setForm] = useState({
    partnerId: '', journalId: '', dealId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentTerms: 'NET_30',
    notes: '',
  });
  const [lines, setLines] = useState<InvLine[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  function setLine(i: number, k: keyof InvLine, v: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  }

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const tax = lines.reduce((s, l) => {
    const lineAmt = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
    return s + lineAmt * ((Number(l.taxRate) || 0) / 100);
  }, 0);
  const total = subtotal + tax;

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    await submitInvoice('DRAFT');
  }

  async function postInvoice(e: React.FormEvent) {
    e.preventDefault();
    await submitInvoice('POSTED');
  }

  async function submitInvoice(targetStatus: string) {
    if (!form.partnerId || !form.journalId) { setSaveErr('Customer and journal required.'); return; }
    const valid = lines.filter((l) => l.description && Number(l.unitPrice) > 0);
    if (!valid.length) { setSaveErr('At least one valid line required.'); return; }
    setSaving(true); setSaveErr('');
    try {
      const inv = await apiFetch<{ id: string }>('/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({
          type: 'CUSTOMER_INVOICE',
          partnerId: form.partnerId,
          journalId: form.journalId,
          ...(form.dealId && { dealId: form.dealId }),
          date: form.date,
          ...(form.dueDate && { dueDate: form.dueDate }),
          paymentTerms: form.paymentTerms,
          notes: form.notes || undefined,
          lines: valid.map((l) => ({
            description: l.description,
            quantity: Number(l.qty) || 1,
            unitPrice: Number(l.unitPrice),
            taxRate: Number(l.taxRate) || 0,
          })),
          status: targetStatus,
        }),
      });
      setShowForm(false);
      setForm({ partnerId: '', journalId: '', dealId: '', date: new Date().toISOString().split('T')[0], dueDate: '', paymentTerms: 'NET_30', notes: '' });
      setLines([EMPTY_LINE()]);
      reload();
      router.push(`/finance/invoices/${inv.id}`);
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-body" style={{ maxWidth: '100%' }}>
      {/* Page header */}
      <div className="page-header" style={{ padding: '1.25rem 0 1rem' }}>
        <div>
          <h1 className="page-title">Customer Invoices</h1>
          <p className="page-subtitle">{data?.total ?? 0} invoices total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + New Invoice
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="Search invoices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ width: 180 }}>
          <SearchableCombobox
            options={STATUS_OPTS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
            clearable
            clearLabel="All statuses"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <p className="p-6 text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p>}
        {error && <p className="p-6 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        {!loading && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Due Date</th>
                <th className="text-right">Amount (EGP)</th>
                <th className="text-right">Tax</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                >
                  <td>
                    <span style={{ color: 'var(--primary)', fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {inv.number || inv.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{inv.partner?.name ?? '—'}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                    {new Date(inv.date).toLocaleDateString('en-EG')}
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-EG') : '—'}
                  </td>
                  <td className="text-right tabular-nums">{egp(Number(inv.amountUntaxed))}</td>
                  <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>
                    {egp(Number(inv.amountTax))}
                  </td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 600 }}>
                    {egp(Number(inv.amountTotal))}
                  </td>
                  <td>
                    <span className={statusBadge(inv.status)}>{inv.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); router.push(`/finance/invoices/${inv.id}`); }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2.5rem' }}>
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New Invoice Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ paddingTop: '2rem' }}>
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowForm(false)}
          />
          <div
            className="relative w-full card shadow-2xl"
            style={{ maxWidth: 900, background: 'var(--surface)', zIndex: 10 }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>New Customer Invoice</h2>
                <p className="page-subtitle">Auto-generated number on save</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '1.2rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Top row: customer + dates */}
              <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                <div className="col-span-2" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Bill To — Customer *</label>
                  <SearchableCombobox
                    options={partnerOpts}
                    value={form.partnerId}
                    onChange={(v) => setForm({ ...form, partnerId: v })}
                    placeholder="Search customers…"
                  />
                </div>
                <div>
                  <label className="input-label">Invoice Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Due Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <label className="input-label">Sales Journal *</label>
                  <SearchableCombobox
                    options={journalOpts}
                    value={form.journalId}
                    onChange={(v) => setForm({ ...form, journalId: v })}
                    placeholder="Select journal…"
                  />
                </div>
                <div>
                  <label className="input-label">Deal Reference (optional)</label>
                  <SearchableCombobox
                    options={dealOpts}
                    value={form.dealId}
                    onChange={(v) => setForm({ ...form, dealId: v })}
                    placeholder="No deal"
                    clearable
                    clearLabel="No deal reference"
                  />
                </div>
                <div>
                  <label className="input-label">Payment Terms</label>
                  <SearchableCombobox
                    options={PAYMENT_TERM_OPTS}
                    value={form.paymentTerms}
                    onChange={(v) => setForm({ ...form, paymentTerms: v })}
                  />
                </div>
              </div>

              {/* Invoice lines */}
              <div>
                <p className="section-label">Invoice Lines</p>
                <div
                  className="card"
                  style={{ overflow: 'hidden', border: '1px solid var(--border)' }}
                >
                  <table className="data-table" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 32 }} />
                      <col style={{ width: 'auto' }} />
                      <col style={{ width: 72 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 28 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Unit Price</th>
                        <th className="text-right">Tax %</th>
                        <th className="text-right">Amount</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => {
                        const amt = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
                        return (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{i + 1}</td>
                            <td>
                              <input
                                className="input"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                placeholder="Description…"
                                value={line.description}
                                onChange={(e) => setLine(i, 'description', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="input text-right"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                value={line.qty}
                                onChange={(e) => setLine(i, 'qty', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input text-right tabular-nums"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                placeholder="0.00"
                                value={line.unitPrice}
                                onChange={(e) => setLine(i, 'unitPrice', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className="input text-right"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                value={line.taxRate}
                                onChange={(e) => setLine(i, 'taxRate', e.target.value)}
                              />
                            </td>
                            <td className="text-right tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                              {egp(amt)}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                                disabled={lines.length <= 1}
                                style={{ color: 'var(--danger)', opacity: lines.length <= 1 ? 0.3 : 1, fontSize: '1rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setLines((prev) => [...prev, EMPTY_LINE()])}
                    >
                      + Add Line
                    </button>
                    <div className="space-y-1 text-right" style={{ minWidth: 220 }}>
                      <div className="flex justify-between gap-8 text-sm" style={{ color: 'var(--text-2)' }}>
                        <span>Subtotal</span>
                        <span className="tabular-nums">{egp(subtotal)}</span>
                      </div>
                      <div className="flex justify-between gap-8 text-sm" style={{ color: 'var(--text-2)' }}>
                        <span>Tax</span>
                        <span className="tabular-nums">{egp(tax)}</span>
                      </div>
                      <div
                        className="flex justify-between gap-8"
                        style={{ fontWeight: 700, fontSize: '0.9375rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}
                      >
                        <span>Total</span>
                        <span className="tabular-nums" style={{ color: 'var(--primary)' }}>{egp(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="input-label">Notes</label>
                <textarea
                  className="textarea input"
                  rows={3}
                  placeholder="Internal notes or customer-facing comments…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {saveErr && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{saveErr}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={saveDraft}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={postInvoice}
                >
                  {saving ? 'Saving…' : 'Validate & Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
