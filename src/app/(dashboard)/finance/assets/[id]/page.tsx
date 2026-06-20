'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';

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
  usefulLife: number;
  method: string;
  status: string;
  accumDepreciation: number;
  netBookValue: number;
  description?: string;
  location?: { name: string };
  assetAccount?: { code: string; name: string };
  schedule?: DepScheduleLine[];
}

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHOD_LABELS: Record<string, string> = {
  STRAIGHT_LINE: 'Straight Line',
  DECLINING_BALANCE: 'Declining Balance',
  SUM_OF_YEARS_DIGITS: 'Sum of Years Digits',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: asset, loading, error, reload } = useQuery<FixedAsset>(`/finance/assets/${id}`);
  const [postingMonth, setPostingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [posting, setPosting] = useState(false);

  async function postDepreciation() {
    if (!postingMonth) { alert('Select a month first.'); return; }
    if (!confirm(`Post depreciation for ${postingMonth}?`)) return;
    setPosting(true);
    try {
      await apiFetch(`/finance/assets/${id}/depreciate`, {
        method: 'POST',
        body: JSON.stringify({ month: postingMonth }),
      });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPosting(false); }
  }

  if (loading) {
    return (
      <div className="page-body">
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading asset…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-body">
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }
  if (!asset) return null;

  const schedule = asset.schedule ?? [];
  const postedCount = schedule.filter((l) => l.posted).length;
  const totalMonths = asset.usefulLife * 12;
  const progressPct = totalMonths > 0 ? Math.min(100, Math.round((postedCount / totalMonths) * 100)) : 0;
  const methodLabel = METHOD_LABELS[asset.method] ?? asset.method.replace(/_/g, ' ');

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: '0.5rem', paddingLeft: 0 }}
            onClick={() => router.push('/finance/assets')}
          >
            ← Fixed Assets
          </button>
          <h1 className="page-title">{asset.name}</h1>
          <p className="page-subtitle">
            {asset.code && <span className="font-mono mr-2">{asset.code}</span>}
            {methodLabel} · {asset.usefulLife} years · {asset.category}
            {asset.location && ` · ${asset.location.name}`}
          </p>
        </div>
        <div>
          {asset.status === 'ACTIVE' && <span className="badge badge-success">Active</span>}
          {asset.status === 'DISPOSED' && <span className="badge badge-neutral">Disposed</span>}
          {asset.status === 'FULLY_DEPRECIATED' && <span className="badge badge-warning">Fully Depreciated</span>}
        </div>
      </div>

      <div className="page-body space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="section-label mb-1">Original Cost</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
              {egp(Number(asset.cost))}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              Purchased {fmtDate(asset.purchaseDate)}
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">Accum. Depreciation</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--warning-fg)' }}>
              {egp(Number(asset.accumDepreciation ?? 0))}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {postedCount} of {totalMonths} months posted
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">Net Book Value</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--primary)' }}>
              {egp(Number(asset.netBookValue ?? 0))}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              Salvage: {egp(Number(asset.salvageValue ?? 0))}
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">Depreciation Progress</p>
            <p className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
              {progressPct}%
            </p>
            <div
              style={{
                marginTop: '0.5rem',
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
                  transition: 'width 400ms',
                }}
              />
            </div>
          </div>
        </div>

        {/* Asset details */}
        <div className="card p-5">
          <p className="section-label">Asset Details</p>
          <div className="grid gap-x-8 gap-y-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              ['Asset Name', asset.name],
              ['Category', asset.category],
              ['Purchase Date', fmtDate(asset.purchaseDate)],
              ['Original Cost', egp(Number(asset.cost))],
              ['Salvage Value', egp(Number(asset.salvageValue ?? 0))],
              ['Useful Life', `${asset.usefulLife} years / ${totalMonths} months`],
              ['Method', methodLabel],
              ['Location', asset.location?.name ?? '—'],
              ['GL Account', asset.assetAccount ? `${asset.assetAccount.code} — ${asset.assetAccount.name}` : '—'],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p className="input-label" style={{ marginBottom: 2 }}>{label}</p>
                <p className="text-sm" style={{ color: 'var(--text-1)' }}>{val}</p>
              </div>
            ))}
          </div>
          {asset.description && (
            <div className="mt-4">
              <p className="input-label" style={{ marginBottom: 2 }}>Description</p>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{asset.description}</p>
            </div>
          )}
        </div>

        {/* Depreciation schedule */}
        <div className="card overflow-hidden">
          <div
            className="flex items-center justify-between"
            style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <p className="page-title" style={{ fontSize: '0.9375rem' }}>Depreciation Schedule</p>
              <p className="page-subtitle">{postedCount} months posted of {totalMonths} total</p>
            </div>
            {asset.status === 'ACTIVE' && (
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  className="input"
                  style={{ width: 165 }}
                  value={postingMonth}
                  onChange={(e) => setPostingMonth(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  disabled={posting || !postingMonth}
                  onClick={postDepreciation}
                >
                  {posting ? 'Posting…' : `Post Depreciation for ${postingMonth || '…'}`}
                </button>
              </div>
            )}
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
                    className="text-center text-sm"
                    style={{ color: 'var(--text-3)', padding: '2rem 1rem' }}
                  >
                    No depreciation schedule generated.
                  </td>
                </tr>
              )}
              {schedule.map((line, i) => (
                <tr key={line.period}>
                  <td className="text-xs" style={{ color: 'var(--text-3)' }}>{i + 1}</td>
                  <td className="font-medium text-xs">{line.period}</td>
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
                  <td className="text-xs" style={{ color: 'var(--text-3)' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
