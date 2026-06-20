'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

// ── Types ────────────────────────────────────────────────────────────────────

interface POLine {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  receivedQty?: number;
  billedQty?: number;
  billedPrice?: number;
}

interface VendorBill {
  id: string;
  number?: string;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'CANCELLED';
  date: string;
  dueDate?: string;
  amountTotal: number;
  matchStatus?: 'MATCHED' | 'PARTIAL' | 'UNMATCHED';
  poRef?: string;
  receiptRef?: string;
  partner?: { id: string; name: string };
  lines?: POLine[];
  poLines?: POLine[];
  receiptLines?: POLine[];
}

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const MATCH_OPTS = [
  { value: '', label: 'All match status' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'UNMATCHED', label: 'Unmatched' },
];

const BLANK_LINE = { description: '', quantity: '1', unitCost: '' };

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-info',
    PAID: 'badge badge-success',
    CANCELLED: 'badge badge-danger',
  };
  return map[status] ?? 'badge badge-neutral';
}

function matchBadge(match?: string) {
  if (!match) return <span className="badge badge-neutral">Unknown</span>;
  const map: Record<string, string> = {
    MATCHED: 'badge badge-success',
    PARTIAL: 'badge badge-warning',
    UNMATCHED: 'badge badge-danger',
  };
  return <span className={map[match] ?? 'badge badge-neutral'}>{match}</span>;
}

const egp = (n: number) =>
  'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── 3-Way Match Panel ─────────────────────────────────────────────────────────
function ThreeWayMatchPanel({ bill, onClose }: { bill: VendorBill; onClose: () => void }) {
  // Merge all line items: PO lines are the source of truth
  const poLines = bill.poLines ?? bill.lines ?? [];
  const receiptLines = bill.receiptLines ?? [];
  const billLines = bill.lines ?? [];

  // Build a unified row per item description
  const items = poLines.map((po) => {
    const receipt = receiptLines.find((r) => r.description === po.description) ?? null;
    const billLine = billLines.find((b) => b.description === po.description) ?? null;

    const priceMatch = billLine ? Math.abs(Number(billLine.billedPrice ?? billLine.unitCost) - Number(po.unitCost)) < 0.01 : null;
    const qtyMatch = billLine && receipt ? Number(billLine.billedQty ?? billLine.quantity) === Number(receipt.receivedQty ?? receipt.quantity) : null;

    let variance: React.ReactNode = null;
    if (billLine) {
      const priceDiff = Number(billLine.billedPrice ?? billLine.unitCost) - Number(po.unitCost);
      const qtyDiff = Number(billLine.billedQty ?? billLine.quantity) - Number(receipt?.receivedQty ?? receipt?.quantity ?? po.quantity);
      if (priceMatch && qtyMatch) {
        variance = <span style={{ color: 'var(--success-fg)', fontWeight: 600 }}>Match</span>;
      } else {
        const parts: string[] = [];
        if (!priceMatch && priceDiff !== 0) parts.push(`${priceDiff > 0 ? '+' : ''}${egp(priceDiff)}`);
        if (!qtyMatch && qtyDiff !== 0) parts.push(`Qty ${qtyDiff > 0 ? '+' : ''}${qtyDiff}`);
        variance = (
          <span style={{ color: 'var(--warning-fg)', fontWeight: 600 }}>
            {parts.join(' · ')}
          </span>
        );
      }
    }

    return { po, receipt, billLine, priceMatch, qtyMatch, variance };
  });

  const hasVariances = items.some((i) => i.billLine && (i.priceMatch === false || i.qtyMatch === false));
  const varianceCount = items.filter((i) => i.billLine && (i.priceMatch === false || i.qtyMatch === false)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6" style={{ paddingTop: '3rem' }}>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="relative w-full card shadow-2xl" style={{ maxWidth: 900, background: 'var(--surface)', zIndex: 10 }}>
        {/* Header */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-1)' }}>
                Vendor Bill — {bill.partner?.name ?? ''}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>
                {bill.number ?? bill.id.slice(0, 8)}
                {bill.poRef && ` · PO #${bill.poRef}`}
                {' · 3-Way Match'}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '1.2rem' }}>×</button>
          </div>
          {/* Status pipeline */}
          <div className="flex items-center gap-2 mt-3">
            {['Draft', 'Posted', 'Paid'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div style={{ width: 24, height: 2, background: 'var(--border)' }} />}
                <span
                  className={bill.status === s.toUpperCase()
                    ? (s === 'Paid' ? 'badge badge-success' : 'badge badge-info')
                    : 'badge badge-neutral'}
                >
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* 3-way match header */}
          <div
            className="flex items-center gap-2 mb-4 px-4 py-3 rounded-lg"
            style={{ background: hasVariances ? 'var(--warning-bg)' : 'var(--success-bg)', border: `1px solid ${hasVariances ? 'var(--warning)' : 'var(--success)'}` }}
          >
            <span style={{ fontSize: '1.1rem' }}>{hasVariances ? 'Warning' : 'OK'}</span>
            <span style={{ fontWeight: 700, color: hasVariances ? 'var(--warning-fg)' : 'var(--success-fg)' }}>
              {hasVariances
                ? `3-WAY MATCH — VARIANCE DETECTED`
                : '3-WAY MATCH — ALL LINES MATCHED'}
            </span>
          </div>

          {/* Match table */}
          <div className="card" style={{ overflow: 'hidden', marginBottom: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">PO Qty</th>
                  <th className="text-right">PO Price</th>
                  <th className="text-right">Received Qty</th>
                  <th className="text-right">Bill Qty</th>
                  <th className="text-right">Bill Price</th>
                  <th className="text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ po, receipt, billLine, priceMatch, qtyMatch, variance }, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{po.description}</td>
                    <td className="text-right tabular-nums">{po.quantity}</td>
                    <td className="text-right tabular-nums">{egp(po.unitCost)}</td>
                    <td
                      className="text-right tabular-nums"
                      style={{ color: receipt ? 'var(--text-1)' : 'var(--danger-fg)', fontWeight: receipt ? undefined : 600 }}
                    >
                      {receipt ? (receipt.receivedQty ?? receipt.quantity) : '—'}
                    </td>
                    <td
                      className="text-right tabular-nums"
                      style={{ color: qtyMatch === false ? 'var(--danger-fg)' : 'var(--text-1)', fontWeight: qtyMatch === false ? 600 : undefined }}
                    >
                      {billLine ? (billLine.billedQty ?? billLine.quantity) : '—'}
                    </td>
                    <td
                      className="text-right tabular-nums"
                      style={{ color: priceMatch === false ? 'var(--danger-fg)' : 'var(--text-1)', fontWeight: priceMatch === false ? 600 : undefined }}
                    >
                      {billLine ? egp(Number(billLine.billedPrice ?? billLine.unitCost)) : '—'}
                    </td>
                    <td className="text-right">{variance ?? <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Variance warning */}
          {hasVariances && (
            <div
              className="px-4 py-3 rounded-lg mb-4"
              style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning-fg)', fontSize: '0.85rem' }}
            >
              {varianceCount} variance{varianceCount !== 1 ? 's' : ''} found. Finance must approve these discrepancies before this bill can be posted.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={onClose}>
              Return to Supplier
            </button>
            {hasVariances && (
              <button
                className="btn"
                style={{ background: 'var(--orange)', color: '#fff', border: 'none' }}
                onClick={async () => {
                  try {
                    await apiFetch(`/finance/invoices/${bill.id}/approve-variances`, { method: 'POST' });
                    onClose();
                  } catch { /* non-blocking */ }
                }}
              >
                Override &amp; Approve Variances
              </button>
            )}
            {!hasVariances && bill.status === 'DRAFT' && (
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await apiFetch(`/finance/invoices/${bill.id}/post`, { method: 'PATCH' });
                    onClose();
                  } catch { /* non-blocking */ }
                }}
              >
                Validate &amp; Post
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── New Bill Form ─────────────────────────────────────────────────────────────
function NewBillForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: partnersRaw } = useQuery<any[]>('/partners?limit=200&type=VENDOR');
  const { data: journalsRaw } = useQuery<any[]>('/finance/journals?type=PURCHASE&limit=50');

  const vendorOpts = (Array.isArray(partnersRaw) ? partnersRaw : []).map((p) => ({ value: p.id, label: p.name }));
  const journalOpts = (Array.isArray(journalsRaw) ? journalsRaw : []).map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));

  const [form, setForm] = useState({
    partnerId: '',
    journalId: '',
    poRef: '',
    receiptRef: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
  });
  const [lines, setLines] = useState([{ ...BLANK_LINE }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function addLine() { setLines((l) => [...l, { ...BLANK_LINE }]); }
  function removeLine(i: number) { setLines((l) => l.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, key: string, val: string) {
    setLines((l) => { const n = [...l]; n[i] = { ...n[i], [key]: val }; return n; });
  }

  const lineTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partnerId || !form.journalId) { setErr('Vendor and journal required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({
          type: 'VENDOR_BILL',
          partnerId: form.partnerId,
          journalId: form.journalId,
          date: form.date,
          ...(form.dueDate && { dueDate: form.dueDate }),
          ...(form.poRef && { poRef: form.poRef }),
          ...(form.receiptRef && { receiptRef: form.receiptRef }),
          lines: lines.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitCost),
          })),
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ paddingTop: '2rem' }}>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="relative w-full card shadow-2xl p-6" style={{ maxWidth: 760, background: 'var(--surface)', zIndex: 10 }}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>New Vendor Bill</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '1.2rem' }}>×</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Vendor *</label>
              <SearchableCombobox options={vendorOpts} value={form.partnerId}
                onChange={(v) => setForm((p) => ({ ...p, partnerId: v }))} placeholder="Search vendors…" />
            </div>
            <div>
              <label className="input-label">Purchase Journal *</label>
              <SearchableCombobox options={journalOpts} value={form.journalId}
                onChange={(v) => setForm((p) => ({ ...p, journalId: v }))} placeholder="Select journal…" />
            </div>
            <div>
              <label className="input-label">PO Reference</label>
              <input className="input" placeholder="PO-2026-####" value={form.poRef}
                onChange={(e) => setForm((p) => ({ ...p, poRef: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Receipt Reference</label>
              <input className="input" placeholder="REC-2026-####" value={form.receiptRef}
                onChange={(e) => setForm((p) => ({ ...p, receiptRef: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Bill Date *</label>
              <input type="date" required className="input" value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Due Date</label>
              <input type="date" className="input" value={form.dueDate}
                onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="section-label" style={{ margin: 0 }}>Bill Lines</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addLine}>+ Add Line</button>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="text-right" style={{ width: 80 }}>Qty</th>
                    <th className="text-right" style={{ width: 130 }}>Unit Cost</th>
                    <th className="text-right" style={{ width: 130 }}>Subtotal</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <input required className="input" style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                          placeholder="Item description…" value={l.description}
                          onChange={(e) => updateLine(i, 'description', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="0.01" step="0.01" required className="input text-right"
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                          value={l.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="0" step="0.01" required className="input text-right tabular-nums"
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                          placeholder="0.00" value={l.unitCost}
                          onChange={(e) => updateLine(i, 'unitCost', e.target.value)} />
                      </td>
                      <td className="text-right tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-2)' }}>
                        {egp((Number(l.quantity) || 0) * (Number(l.unitCost) || 0))}
                      </td>
                      <td>
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(i)}
                            style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  Total: <span className="tabular-nums" style={{ color: 'var(--primary)' }}>{egp(lineTotal)}</span>
                </span>
              </div>
            </div>
          </div>

          {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}

          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Creating…' : 'Create Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VendorBillsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selectedBill, setSelectedBill] = useState<VendorBill | null>(null);

  const qs = new URLSearchParams({
    type: 'VENDOR_BILL',
    limit: '30',
    ...(statusFilter && { status: statusFilter }),
    ...(matchFilter && { matchStatus: matchFilter }),
    ...(search && { q: search }),
  });
  const { data, loading, error, reload } = useQuery<{ items: VendorBill[]; total: number }>(
    `/finance/invoices?${qs}`,
    [statusFilter, matchFilter, search],
  );

  const bills = data?.items ?? [];

  return (
    <div className="page-body" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '1.25rem 0 1rem' }}>
        <div>
          <h1 className="page-title">Vendor Bills</h1>
          <p className="page-subtitle">
            {data?.total ?? 0} bills · 3-Way Match: PO → Receipt → Bill
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          + New Bill
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="Search bills…"
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
        <div style={{ width: 200 }}>
          <SearchableCombobox
            options={MATCH_OPTS}
            value={matchFilter}
            onChange={setMatchFilter}
            placeholder="All match status"
            clearable
            clearLabel="All match status"
          />
        </div>
      </div>

      {/* Match legend */}
      <div className="flex items-center gap-4 mb-4" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
        <span className="badge badge-success">MATCHED</span>
        <span style={{ color: 'var(--text-3)' }}>PO + Receipt both confirmed</span>
        <span className="badge badge-warning">PARTIAL</span>
        <span style={{ color: 'var(--text-3)' }}>Missing one match</span>
        <span className="badge badge-danger">UNMATCHED</span>
        <span style={{ color: 'var(--text-3)' }}>No PO or receipt</span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <p className="p-6 text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p>}
        {error && <p className="p-6 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        {!loading && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Vendor</th>
                <th>PO Ref</th>
                <th>Receipt Ref</th>
                <th>Date</th>
                <th>Due</th>
                <th className="text-right">Amount</th>
                <th>Match</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr
                  key={bill.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/finance/invoices/${bill.id}`)}
                >
                  <td>
                    <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 500 }}>
                      {bill.number ?? bill.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{bill.partner?.name ?? '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontFamily: 'monospace' }}>
                    {bill.poRef ?? '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontFamily: 'monospace' }}>
                    {bill.receiptRef ?? '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                    {new Date(bill.date).toLocaleDateString('en-EG')}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                    {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString('en-EG') : '—'}
                  </td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 600 }}>
                    {egp(Number(bill.amountTotal))}
                  </td>
                  <td>{matchBadge(bill.matchStatus)}</td>
                  <td>
                    <span className={statusBadge(bill.status)}>{bill.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBill(bill);
                      }}
                    >
                      3-Way Match
                    </button>
                  </td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2.5rem' }}>
                    No vendor bills found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NewBillForm
          onClose={() => setShowNew(false)}
          onSuccess={() => { setShowNew(false); reload(); }}
        />
      )}

      {selectedBill && (
        <ThreeWayMatchPanel
          bill={selectedBill}
          onClose={() => { setSelectedBill(null); reload(); }}
        />
      )}
    </div>
  );
}
