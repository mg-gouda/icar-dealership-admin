'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface DepScheduleLine {
  period: string;
  openingNBV: number;
  depreciation: number;
  closingNBV: number;
  posted: boolean;
}

interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLife: number; // years
  method: string;
  status: string;
  accumDepreciation: number;
  netBookValue: number;
  schedule?: DepScheduleLine[];
}

interface Account { id: string; code: string; name: string; }

const METHODS = [
  { value: 'STRAIGHT_LINE', label: 'Straight Line' },
  { value: 'DECLINING_BALANCE', label: 'Declining Balance' },
  { value: 'SUM_OF_YEARS_DIGITS', label: 'Sum of Years Digits' },
];

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'IT', label: 'IT & Tech' },
  { value: 'BUILDING', label: 'Building' },
  { value: 'OTHER', label: 'Other' },
];

const CATEGORY_OPTS = CATEGORIES.slice(1);

const STATUS_OPTS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISPOSED', label: 'Disposed' },
  { value: 'FULLY_DEPRECIATED', label: 'Fully Depreciated' },
];

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusBadge(status: string) {
  if (status === 'ACTIVE') return <span className="badge badge-success">Active</span>;
  if (status === 'DISPOSED') return <span className="badge badge-neutral">Disposed</span>;
  if (status === 'FULLY_DEPRECIATED') return <span className="badge badge-warning">Fully Depr.</span>;
  return <span className="badge badge-neutral">{status}</span>;
}

function methodLabel(m: string) {
  return METHODS.find((x) => x.value === m)?.label ?? m.replace(/_/g, ' ');
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AssetsPage() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [postingMonth, setPostingMonth] = useState('');
  const [posting, setPosting] = useState(false);

  const qs = new URLSearchParams();
  if (categoryFilter) qs.set('category', categoryFilter);
  if (statusFilter) qs.set('status', statusFilter);
  const { data: res, loading, reload } = useQuery<{ items: FixedAsset[]; total: number }>(
    `/finance/assets?${qs.toString()}`
  );
  const { data: accounts } = useQuery<{ items: Account[] }>('/finance/accounts?limit=200');
  const { data: expandedAsset, loading: loadingDetail } = useQuery<FixedAsset>(
    expandedId ? `/finance/assets/${expandedId}` : null
  );

  const assets = (res?.items ?? []).filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code?.toLowerCase().includes(search.toLowerCase())
  );

  const accountOpts = (accounts?.items ?? []).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));

  const totalValue = assets.reduce((s, a) => s + Number(a.cost), 0);
  const totalNBV = assets.reduce((s, a) => s + Number(a.netBookValue ?? 0), 0);
  const activeCount = assets.filter((a) => a.status === 'ACTIVE').length;
  const thisMonthDepr = assets.reduce((s, a) => {
    if (!a.schedule) return s;
    const now = new Date().toISOString().slice(0, 7);
    const line = a.schedule.find((l) => l.period === now);
    return s + (line?.depreciation ?? 0);
  }, 0);

  const [form, setForm] = useState({
    name: '', category: 'EQUIPMENT', purchaseDate: new Date().toISOString().slice(0, 10),
    cost: '', salvageValue: '0', usefulLife: '5', method: 'STRAIGHT_LINE',
    description: '', locationId: '', assetAccountId: '',
  });

  function setF(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.cost) { setErr('Name and cost required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          purchaseDate: new Date(form.purchaseDate).toISOString(),
          cost: parseFloat(form.cost),
          salvageValue: parseFloat(form.salvageValue) || 0,
          usefulLife: parseInt(form.usefulLife),
          method: form.method,
          description: form.description || undefined,
          locationId: form.locationId || undefined,
          assetAccountId: form.assetAccountId || undefined,
        }),
      });
      setShowCreate(false);
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function postDepreciation(assetId: string) {
    if (!postingMonth) { alert('Select a month first.'); return; }
    setPosting(true);
    try {
      await apiFetch(`/finance/assets/${assetId}/depreciate`, {
        method: 'POST',
        body: JSON.stringify({ month: postingMonth }),
      });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPosting(false); }
  }

  const schedule = expandedAsset?.schedule ?? [];
  const postedCount = schedule.filter((l) => l.posted).length;
  const totalMonths = expandedAsset ? expandedAsset.usefulLife * 12 : 0;
  const progressPct = totalMonths > 0 ? Math.round((postedCount / totalMonths) * 100) : 0;

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fixed Assets Register</h1>
          <p className="page-subtitle">Asset Register &amp; Depreciation Schedule</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Register New Asset
        </button>
      </div>

      <div className="page-body space-y-5">
        {/* KPI stat cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="section-label mb-1">Total Asset Value</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
              {egp(totalValue)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>+ Original Cost</p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">Net Book Value</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {egp(totalNBV)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>After depreciation</p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">This Month Depreciation</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--warning-fg)' }}>
              {egp(thisMonthDepr)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Auto-posted monthly</p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">Assets Running</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--success-fg)' }}>
              {activeCount}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {assets.filter((a) => a.status === 'FULLY_DEPRECIATED').length} fully deprecated
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Search assets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ width: 180 }}>
            <SearchableCombobox
              options={CATEGORIES}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="All Categories"
            />
          </div>
          <div style={{ width: 180 }}>
            <SearchableCombobox
              options={STATUS_OPTS}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Statuses"
            />
          </div>
        </div>

        {/* Assets table */}
        <div className="card overflow-hidden">
          {loading && (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading…</div>
          )}
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset #</th>
                <th>Asset Name</th>
                <th>Category</th>
                <th>Purchase Date</th>
                <th style={{ textAlign: 'right' }}>Cost (EGP)</th>
                <th>Useful Life</th>
                <th>Method</th>
                <th style={{ textAlign: 'right' }}>Accum. Depr</th>
                <th style={{ textAlign: 'right' }}>Net Book Value</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <>
                  <tr
                    key={a.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  >
                    <td>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                        {a.code || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium" style={{ color: 'var(--text-1)' }}>{a.name}</span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{a.category}</td>
                    <td style={{ color: 'var(--text-2)' }}>{fmtDate(a.purchaseDate)}</td>
                    <td style={{ textAlign: 'right' }} className="tabular-nums font-medium">
                      {egp(Number(a.cost))}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {a.usefulLife} yr / {a.usefulLife * 12} mo
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{methodLabel(a.method)}</td>
                    <td
                      style={{ textAlign: 'right', color: 'var(--warning-fg)' }}
                      className="tabular-nums"
                    >
                      {egp(Number(a.accumDepreciation ?? 0))}
                    </td>
                    <td
                      style={{ textAlign: 'right', color: 'var(--primary)' }}
                      className="tabular-nums font-medium"
                    >
                      {egp(Number(a.netBookValue ?? 0))}
                    </td>
                    <td>{statusBadge(a.status)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/finance/assets/${a.id}`); }}
                      >
                        View Schedule
                      </button>
                    </td>
                  </tr>

                  {/* Inline depreciation schedule panel */}
                  {expandedId === a.id && (
                    <tr key={`${a.id}-detail`}>
                      <td colSpan={11} style={{ padding: 0, background: 'var(--surface-2)' }}>
                        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                          {loadingDetail ? (
                            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Loading schedule…</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-3">
                                <p
                                  className="section-label"
                                  style={{ marginBottom: 0 }}
                                >
                                  Depreciation Schedule — {a.name}
                                  {a.status === 'ACTIVE' && (
                                    <span
                                      className="badge badge-info"
                                      style={{ marginLeft: 8 }}
                                    >
                                      Auto-posted Monthly
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="month"
                                    className="input"
                                    style={{ width: 160 }}
                                    value={postingMonth}
                                    onChange={(e) => setPostingMonth(e.target.value)}
                                  />
                                  <button
                                    className="btn btn-primary btn-sm"
                                    disabled={posting || !postingMonth}
                                    onClick={() => postDepreciation(a.id)}
                                  >
                                    {posting ? 'Posting…' : `Post Depreciation${postingMonth ? ` for ${postingMonth}` : ''}`}
                                  </button>
                                </div>
                              </div>

                              {/* Progress bar */}
                              {totalMonths > 0 && (
                                <div className="mb-3">
                                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                                    <span>{postedCount} months of {totalMonths} depreciated</span>
                                    <span>{progressPct}%</span>
                                  </div>
                                  <div
                                    style={{
                                      height: 6,
                                      background: 'var(--border)',
                                      borderRadius: 9999,
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${progressPct}%`,
                                        height: '100%',
                                        background: 'var(--primary)',
                                        borderRadius: 9999,
                                        transition: 'width 300ms',
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Asset detail row */}
                              <div
                                className="grid gap-4 mb-4 text-xs"
                                style={{ gridTemplateColumns: 'repeat(6, 1fr)', color: 'var(--text-2)' }}
                              >
                                {[
                                  ['Cost', egp(Number(a.cost))],
                                  ['Salvage Value', egp(Number(a.salvageValue ?? 0))],
                                  ['Useful Life', `${a.usefulLife} years`],
                                  ['Method', methodLabel(a.method)],
                                  ['Purchased', fmtDate(a.purchaseDate)],
                                  ['Status', a.status],
                                ].map(([label, val]) => (
                                  <div key={label as string}>
                                    <p style={{ color: 'var(--text-3)', marginBottom: 2 }}>{label}</p>
                                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>{val}</p>
                                  </div>
                                ))}
                              </div>

                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>Period</th>
                                    <th style={{ textAlign: 'right' }}>Opening NBV</th>
                                    <th style={{ textAlign: 'right' }}>Depreciation</th>
                                    <th style={{ textAlign: 'right' }}>Closing NBV</th>
                                    <th>Status</th>
                                    <th>Journal Entry</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {schedule.length === 0 && (
                                    <tr>
                                      <td
                                        colSpan={7}
                                        className="text-center text-xs"
                                        style={{ color: 'var(--text-3)', padding: '1rem' }}
                                      >
                                        No schedule generated yet.
                                      </td>
                                    </tr>
                                  )}
                                  {schedule.map((line, i) => (
                                    <tr key={line.period}>
                                      <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                                        {i + 1}
                                      </td>
                                      <td className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>
                                        {line.period}
                                      </td>
                                      <td
                                        className="tabular-nums text-xs"
                                        style={{ textAlign: 'right', color: 'var(--text-2)' }}
                                      >
                                        {egp(Number(line.openingNBV))}
                                      </td>
                                      <td
                                        className="tabular-nums text-xs font-medium"
                                        style={{ textAlign: 'right', color: 'var(--warning-fg)' }}
                                      >
                                        {egp(Number(line.depreciation))}
                                      </td>
                                      <td
                                        className="tabular-nums text-xs"
                                        style={{ textAlign: 'right', color: 'var(--text-1)' }}
                                      >
                                        {egp(Number(line.closingNBV))}
                                      </td>
                                      <td>
                                        {line.posted ? (
                                          <span className="badge badge-success">Posted</span>
                                        ) : (
                                          <span className="badge badge-neutral">Scheduled</span>
                                        )}
                                      </td>
                                      <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                                        {line.posted ? '—' : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {assets.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center text-sm"
                    style={{ color: 'var(--text-3)', padding: '2.5rem 1rem' }}
                  >
                    No fixed assets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowCreate(false)}
          />
          <div
            className="card relative w-full shadow-2xl"
            style={{ maxWidth: 560, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div
              className="flex items-center justify-between"
              style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h2 className="page-title" style={{ fontSize: '1rem' }}>Register New Asset</h2>
                <p className="page-subtitle">Add asset to the fixed assets register</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '1.25rem', lineHeight: 1 }}
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={createAsset}
              style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}
            >
              <div className="space-y-3">
                <div>
                  <label className="input-label">Asset Name *</label>
                  <input
                    required
                    className="input"
                    placeholder="e.g. Cairo Service Vehicle — Toyota Hilux"
                    value={form.name}
                    onChange={(e) => setF('name', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <SearchableCombobox
                      label="Category *"
                      options={CATEGORY_OPTS}
                      value={form.category}
                      onChange={(v) => setF('category', v)}
                      placeholder="Select category"
                    />
                  </div>
                  <div>
                    <label className="input-label">Purchase Date *</label>
                    <input
                      type="date"
                      required
                      className="input"
                      value={form.purchaseDate}
                      onChange={(e) => setF('purchaseDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Cost (EGP) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="450,000"
                      value={form.cost}
                      onChange={(e) => setF('cost', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Salvage Value (EGP)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="0"
                      value={form.salvageValue}
                      onChange={(e) => setF('salvageValue', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Useful Life (years) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="50"
                      className="input"
                      placeholder="5"
                      value={form.usefulLife}
                      onChange={(e) => setF('usefulLife', e.target.value)}
                    />
                  </div>
                  <div>
                    <SearchableCombobox
                      label="Depreciation Method"
                      options={METHODS}
                      value={form.method}
                      onChange={(v) => setF('method', v)}
                      placeholder="Select method"
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Description</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Optional notes…"
                    value={form.description}
                    onChange={(e) => setF('description', e.target.value)}
                  />
                </div>

                <div>
                  <SearchableCombobox
                    label="Fixed Asset Account"
                    options={accountOpts}
                    value={form.assetAccountId}
                    onChange={(v) => setF('assetAccountId', v)}
                    placeholder="Select GL account…"
                    clearable
                  />
                </div>

                {err && (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>{err}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Register Asset'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
