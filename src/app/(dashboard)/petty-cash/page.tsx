'use client';

import { useState } from 'react';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import { useQuery, apiFetch } from '../../../lib/useApi';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Fund {
  id: string;
  name: string;
  location?: { id: string; name: string };
  custodian?: string;
  balance: number;
  status: string;
}

interface Voucher {
  id: string;
  date: string;
  fund?: { id: string; name: string };
  submittedBy?: { name: string };
  category: string;
  description: string;
  amount: number;
  status: string;
}

interface Location {
  id: string;
  name: string;
}

const VOUCHER_TABS = [
  { key: 'PENDING', label: 'Pending' },
  { key: '',        label: 'All' },
];

const fmt = (n: number | undefined | null) =>
  'EGP ' + Number(n ?? 0).toLocaleString('en-EG', { maximumFractionDigits: 0 });

function voucherBadgeCls(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-danger',
    POSTED: 'badge-neutral',
  };
  return `badge ${map[s] ?? 'badge-neutral'}`;
}

// ── New Fund Modal ────────────────────────────────────────────────────────────
function FundModal({ locations, onClose, onSuccess }: {
  locations: Location[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ name: '', locationId: '', initialBalance: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setErr('Name required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/petty-cash/funds', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          locationId: form.locationId || undefined,
          initialBalance: form.initialBalance ? Number(form.initialBalance) : 0,
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-md card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>New Fund</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">Fund Name *</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>
          <div>
            <label className="input-label">Location</label>
            <SearchableCombobox
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              value={form.locationId}
              onChange={(v) => set('locationId', v)}
              placeholder="Select location…"
              clearable
            />
          </div>
          <div>
            <label className="input-label">Initial Balance (EGP)</label>
            <input className="input" type="number" min="0" value={form.initialBalance}
              onChange={(e) => set('initialBalance', e.target.value)} />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create Fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Replenish Modal ───────────────────────────────────────────────────────────
function ReplenishModal({ fund, onClose, onSuccess }: {
  fund: Fund;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setErr('Enter a positive amount.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch(`/petty-cash/funds/${fund.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ replenishAmount: Number(amount) }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>
            Replenish — {fund.name}
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">Current Balance</label>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: Number(fund.balance) < 500 ? 'var(--warning)' : 'var(--primary)', marginTop: '0.25rem' }}>
              {fmt(fund.balance)}
            </p>
          </div>
          <div>
            <label className="input-label">Replenish Amount (EGP) *</label>
            <input className="input" type="number" min="1" value={amount}
              onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Replenish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Submit Voucher Modal ──────────────────────────────────────────────────────
function VoucherModal({ funds, onClose, onSuccess }: {
  funds: Fund[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ fundId: '', amount: '', description: '', category: '', receiptUrl: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fundId || !form.amount || !form.description) {
      setErr('Fund, amount, and description are required.'); return;
    }
    setSaving(true); setErr('');
    try {
      await apiFetch('/petty-cash/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          fundId: form.fundId,
          amount: Number(form.amount),
          description: form.description,
          category: form.category || undefined,
          receiptUrl: form.receiptUrl || undefined,
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-lg card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>Submit Voucher</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">Fund *</label>
            <SearchableCombobox
              options={funds.map((f) => ({ value: f.id, label: f.name }))}
              value={form.fundId}
              onChange={(v) => set('fundId', v)}
              placeholder="Select fund…"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="input-label">Amount (EGP) *</label>
              <input className="input" type="number" min="1" value={form.amount}
                onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Category</label>
              <input className="input" value={form.category} placeholder="e.g. Office Supplies"
                onChange={(e) => set('category', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="input-label">Description *</label>
            <textarea className="textarea" rows={2} value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className="input-label">Receipt URL</label>
            <input className="input" value={form.receiptUrl} placeholder="https://…"
              onChange={(e) => set('receiptUrl', e.target.value)} />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Submit Voucher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PettyCashPage() {
  const [voucherTab, setVoucherTab] = useState('PENDING');
  const [showFundModal, setShowFundModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [replenishFund, setReplenishFund] = useState<Fund | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: rawFunds,    loading: fundsLoading,    reload: reloadFunds    } =
    useQuery<Fund[] | { data: Fund[] }>('/petty-cash/funds');
  const { data: rawLocs } =
    useQuery<Location[] | { data: Location[] }>('/locations');

  // ponytail: voucherTab in deps array so useQuery re-fetches on tab change
  const voucherPath = voucherTab
    ? `/petty-cash/vouchers?status=${voucherTab}`
    : '/petty-cash/vouchers';
  const { data: rawVouchers, loading: vouchersLoading, reload: reloadVouchers } =
    useQuery<Voucher[] | { data: Voucher[] }>(voucherPath, [voucherTab]);

  const funds:    Fund[]     = Array.isArray(rawFunds)    ? rawFunds    : (rawFunds?.data    ?? []);
  const locations: Location[] = Array.isArray(rawLocs)    ? rawLocs     : (rawLocs?.data     ?? []);
  const vouchers: Voucher[]  = Array.isArray(rawVouchers) ? rawVouchers : (rawVouchers?.data ?? []);

  async function approveVoucher(id: string) {
    setActionLoading(`${id}_approve`);
    try {
      await apiFetch(`/petty-cash/vouchers/${id}/approve`, { method: 'POST' });
      reloadVouchers();
    } catch { /* non-critical */ }
    finally { setActionLoading(null); }
  }

  async function rejectVoucher(id: string) {
    if (!window.confirm('Reject this voucher?')) return;
    setActionLoading(`${id}_reject`);
    try {
      await apiFetch(`/petty-cash/vouchers/${id}/reject`, { method: 'POST' });
      reloadVouchers();
    } catch { /* non-critical */ }
    finally { setActionLoading(null); }
  }

  const pendingCount = funds.reduce((s, f) => s + (Number(f.balance) < 500 ? 1 : 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Petty Cash</h1>
          <p className="page-subtitle">
            {funds.length} fund{funds.length !== 1 ? 's' : ''}
            {pendingCount > 0 ? ` · ${pendingCount} low balance` : ''}
          </p>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Section A: Funds ─────────────────────────────────── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
          }}>
            <span className="section-label" style={{ margin: 0 }}>Funds</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowFundModal(true)}>
              + New Fund
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fund Name</th>
                <th>Location</th>
                <th>Custodian</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fundsLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                    Loading…
                  </td>
                </tr>
              ) : funds.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                    No funds found.
                  </td>
                </tr>
              ) : (
                funds.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 500 }}>{f.name}</td>
                    <td style={{ color: 'var(--text-2)' }}>{f.location?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{f.custodian ?? '—'}</td>
                    <td style={{
                      textAlign: 'right', fontWeight: 600,
                      color: Number(f.balance) < 500 ? 'var(--warning)' : 'var(--text-1)',
                    }}>
                      {fmt(f.balance)}
                      {Number(f.balance) < 500 && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.6875rem' }}>⚠</span>
                      )}
                    </td>
                    <td>
                      <span className={f.status === 'ACTIVE' ? 'badge badge-success' : 'badge badge-neutral'}>
                        {f.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setReplenishFund(f)}>
                        Replenish
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Section B: Vouchers ──────────────────────────────── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
          }}>
            <span className="section-label" style={{ margin: 0 }}>Vouchers</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowVoucherModal(true)}>
              + Submit Voucher
            </button>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ paddingLeft: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            {VOUCHER_TABS.map((t) => (
              <button
                key={t.key}
                className={`tab ${voucherTab === t.key ? 'active' : ''}`}
                onClick={() => setVoucherTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Fund</th>
                <th>Submitted By</th>
                <th>Category</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vouchersLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                    Loading…
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                    No vouchers found.
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={v.id}>
                    <td style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {new Date(v.date).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 500 }}>{v.fund?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{v.submittedBy?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{v.category || '—'}</td>
                    <td style={{
                      color: 'var(--text-2)', maxWidth: '14rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {v.description}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(v.amount)}</td>
                    <td>
                      <span className={voucherBadgeCls(v.status)}>
                        {v.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {v.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--success-bg)', color: 'var(--success-fg)', border: 'none' }}
                            disabled={actionLoading === `${v.id}_approve`}
                            onClick={() => approveVoucher(v.id)}
                          >
                            {actionLoading === `${v.id}_approve` ? '…' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)', border: 'none' }}
                            disabled={actionLoading === `${v.id}_reject`}
                            onClick={() => rejectVoucher(v.id)}
                          >
                            {actionLoading === `${v.id}_reject` ? '…' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showFundModal && (
        <FundModal
          locations={locations}
          onClose={() => setShowFundModal(false)}
          onSuccess={() => { setShowFundModal(false); reloadFunds(); }}
        />
      )}
      {replenishFund && (
        <ReplenishModal
          fund={replenishFund}
          onClose={() => setReplenishFund(null)}
          onSuccess={() => { setReplenishFund(null); reloadFunds(); }}
        />
      )}
      {showVoucherModal && (
        <VoucherModal
          funds={funds}
          onClose={() => setShowVoucherModal(false)}
          onSuccess={() => { setShowVoucherModal(false); reloadVouchers(); }}
        />
      )}
    </div>
  );
}
