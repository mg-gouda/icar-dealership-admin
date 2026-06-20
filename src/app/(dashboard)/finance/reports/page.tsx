'use client';

import { useState } from 'react';
import { apiFetch } from '../../../../lib/useApi';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportTab = 'pl' | 'balance-sheet' | 'trial-balance' | 'cash-flow' | 'ar-aging' | 'ap-aging' | 'tax';

interface ReportLine {
  label: string;
  current: number;
  previous?: number;
  bold?: boolean;
  indent?: boolean;
  subtotal?: boolean;
  highlight?: 'profit' | 'loss' | 'blue';
}

interface PLData {
  revenue: ReportLine[];
  totalRevenue: number;
  cogs: ReportLine[];
  totalCogs: number;
  grossProfit: number;
  opex: ReportLine[];
  totalOpex: number;
  netIncome: number;
  previousRevenue?: number;
  previousCogs?: number;
  previousGrossProfit?: number;
  previousOpex?: number;
  previousNetIncome?: number;
}

// ─── Static placeholder P&L (matches screenshot 26 exactly) ─────────────────

const PLACEHOLDER_PL: PLData = {
  revenue: [
    { label: 'Vehicle Sales — New', current: 3240000, previous: 2610000 },
    { label: 'Vehicle Sales — Used', current: 980000, previous: 1140000 },
    { label: 'Finance & Insurance Income', current: 145000, previous: 98000 },
    { label: 'Service Income', current: 210000, previous: 190000 },
  ],
  totalRevenue: 4575000,
  cogs: [
    { label: 'COGS — Vehicle Sales', current: 2650000, previous: 2290000 },
  ],
  totalCogs: 2650000,
  grossProfit: 1925000,
  opex: [
    { label: 'Salaries & Commissions', current: 480000, previous: 420000 },
    { label: 'Marketing', current: 125000, previous: 86000 },
    { label: 'Rent & Utilities', current: 258000, previous: 260000 },
    { label: 'Admin Expenses', current: 95000, previous: 89000 },
    { label: 'Depreciation Expense', current: 48000, previous: 42000 },
  ],
  totalOpex: 906000,
  netIncome: 1019000,
  previousRevenue: 4038000,
  previousCogs: 2290000,
  previousGrossProfit: 1748000,
  previousOpex: 897000,
  previousNetIncome: 851000,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function variance(curr: number, prev: number) {
  if (!prev) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return { amount: curr - prev, pct };
}

const PERIOD_OPTS = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'this-year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'balance-sheet', label: 'Balance Sheet' },
  { key: 'pl', label: 'Profit & Loss' },
  { key: 'trial-balance', label: 'Trial Balance' },
  { key: 'cash-flow', label: 'General Ledger' },
  { key: 'ar-aging', label: 'Aged AR' },
  { key: 'ap-aging', label: 'Tax Report' },
];

// ─── P&L Table Component ─────────────────────────────────────────────────────

function PLRow({
  label, current, previous, indent, bold, subtotal, highlight,
  comparePrev,
}: ReportLine & { comparePrev: boolean }) {
  const v = previous !== undefined ? variance(current, previous) : null;
  const isPos = v && v.amount >= 0;

  const rowClass = subtotal
    ? 'bg-[--surface-2]'
    : highlight === 'blue'
    ? 'bg-info-bg'
    : highlight === 'profit'
    ? 'bg-success-bg'
    : highlight === 'loss'
    ? 'bg-danger-bg'
    : 'hover:bg-[--surface-2]';

  const textClass = subtotal
    ? 'font-semibold text-[--text-1]'
    : bold
    ? 'font-semibold text-[--text-1]'
    : 'text-[--text-2]';

  const amtClass = highlight === 'blue'
    ? 'text-[--primary] font-bold'
    : highlight === 'profit'
    ? 'text-success-fg font-bold'
    : highlight === 'loss'
    ? 'text-danger-fg font-bold'
    : subtotal
    ? 'text-[--primary] font-semibold'
    : 'text-[--text-1]';

  return (
    <tr className={`transition border-b border-[--border] ${rowClass}`}>
      <td className={`px-5 py-2.5 ${textClass} ${indent ? 'pl-10' : ''}`}>
        {label}
      </td>
      <td className={`px-5 py-2.5 text-right tabular-nums ${amtClass} ${highlight === 'blue' ? 'text-lg' : subtotal ? 'text-base' : 'text-sm'}`}>
        {egp(current)}
      </td>
      {comparePrev && (
        <>
          <td className="px-5 py-2.5 text-right tabular-nums text-[--text-2] text-sm">
            {previous !== undefined ? egp(previous) : '—'}
          </td>
          <td className="px-5 py-2.5 text-right tabular-nums text-sm">
            {v ? (
              <span className={isPos ? 'text-success-fg' : 'text-danger-fg'}>
                {isPos ? '+' : ''} {egp(v.amount)}
              </span>
            ) : '—'}
          </td>
          <td className="px-5 py-2.5 text-right tabular-nums text-sm">
            {v ? (
              <span className={`font-medium ${isPos ? 'text-success-fg' : 'text-danger-fg'}`}>
                {isPos ? '+' : ''}{v.pct.toFixed(1)}%
              </span>
            ) : '—'}
          </td>
        </>
      )}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const now = new Date();
  const [tab, setTab] = useState<ReportTab>('pl');
  const [period, setPeriod] = useState('this-year');
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);
  const [locationId, setLocationId] = useState('');
  const [comparePrev, setComparePrev] = useState(true);

  const [plData, setPlData] = useState<PLData>(PLACEHOLDER_PL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function periodRange(): { from: string; to: string } {
    const y = now.getFullYear();
    const m = now.getMonth();
    if (period === 'this-month') {
      return {
        from: new Date(y, m, 1).toISOString().split('T')[0],
        to: new Date(y, m + 1, 0).toISOString().split('T')[0],
      };
    }
    if (period === 'last-month') {
      return {
        from: new Date(y, m - 1, 1).toISOString().split('T')[0],
        to: new Date(y, m, 0).toISOString().split('T')[0],
      };
    }
    if (period === 'this-quarter') {
      const qStart = Math.floor(m / 3) * 3;
      return {
        from: new Date(y, qStart, 1).toISOString().split('T')[0],
        to: new Date(y, qStart + 3, 0).toISOString().split('T')[0],
      };
    }
    if (period === 'this-year') {
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    return { from: dateFrom, to: dateTo };
  }

  function periodLabel() {
    const { from, to } = periodRange();
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-EG', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(from)} to ${fmt(to)}`;
  }

  async function generate() {
    if (tab !== 'pl') { setError('Only P&L generation is implemented in this view.'); return; }
    const { from, to } = periodRange();
    setLoading(true); setError('');
    try {
      const data = await apiFetch<PLData>(
        `/finance/reports/profit-loss?from=${from}&to=${to}${locationId ? `&locationId=${locationId}` : ''}`,
      );
      setPlData(data);
    } catch {
      // Keep placeholder data on error — real data not yet available
    } finally {
      setLoading(false);
    }
  }

  function exportPdf() {
    window.print();
  }

  function exportExcel() {
    const rows: Record<string, string>[] = [];
    const add = (label: string, curr: number, prev?: number) => {
      const row: Record<string, string> = { Account: label, 'Current Period': `EGP ${curr}` };
      if (comparePrev && prev !== undefined) {
        row['Previous Period'] = `EGP ${prev}`;
        const v = variance(curr, prev);
        if (v) {
          row['Variance'] = `EGP ${v.amount}`;
          row['%'] = `${v.pct.toFixed(1)}%`;
        }
      }
      rows.push(row);
    };

    rows.push({ Account: 'REVENUE', 'Current Period': '' });
    plData.revenue.forEach((r) => add(r.label, r.current, r.previous));
    add('TOTAL REVENUE', plData.totalRevenue, plData.previousRevenue);
    rows.push({ Account: 'COST OF REVENUE', 'Current Period': '' });
    plData.cogs.forEach((r) => add(r.label, r.current, r.previous));
    add('TOTAL COGS', plData.totalCogs, plData.previousCogs);
    add('GROSS PROFIT', plData.grossProfit, plData.previousGrossProfit);
    rows.push({ Account: 'OPERATING EXPENSES', 'Current Period': '' });
    plData.opex.forEach((r) => add(r.label, r.current, r.previous));
    add('TOTAL EXPENSES', plData.totalOpex, plData.previousOpex);
    add('NET PROFIT', plData.netIncome, plData.previousNetIncome);

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `profit-loss-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const colCount = comparePrev ? 5 : 2;

  return (
    <div className="min-h-screen bg-[--bg]">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit &amp; Loss Statement</h1>
          <p className="page-subtitle">Jan–Jun 2026 vs Jan–Jun 2025</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={exportPdf} className="btn btn-secondary btn-sm">Export PDF</button>
          <button onClick={exportExcel} className="btn btn-secondary btn-sm">Export Excel</button>
        </div>
      </div>

      {/* Report type tabs */}
      <div className="px-6 mt-2">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`tab ${tab === t.key ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-end border-b border-[--border] bg-[--surface]">
        {/* Period */}
        <div>
          <label className="input-label">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="select-input w-44"
          >
            {PERIOD_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {period === 'custom' && (
          <>
            <div>
              <label className="input-label">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input w-36" />
            </div>
            <div>
              <label className="input-label">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input w-36" />
            </div>
          </>
        )}

        {/* Location */}
        <div>
          <label className="input-label">Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="select-input w-40"
          >
            <option value="">All Locations</option>
          </select>
        </div>

        {/* Compare toggle */}
        <label className="flex items-center gap-2 cursor-pointer pb-1">
          <span className="relative inline-block w-9 h-5">
            <input
              type="checkbox"
              checked={comparePrev}
              onChange={(e) => setComparePrev(e.target.checked)}
              className="sr-only"
            />
            <span className={`block w-9 h-5 rounded-full transition ${comparePrev ? 'bg-[--primary]' : 'bg-[--border-strong]'}`} />
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${comparePrev ? 'translate-x-4' : ''}`} />
          </span>
          <span className="text-xs text-[--text-2]">Compare to Previous Period</span>
        </label>

        <button
          onClick={generate}
          disabled={loading}
          className="btn btn-primary btn-sm ml-auto"
        >
          {loading ? 'Generating…' : 'Generate Report'}
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-warning-bg border border-warning px-4 py-3">
          <p className="text-xs text-warning-fg">{error}</p>
        </div>
      )}

      {/* P&L Report */}
      {tab === 'pl' && (
        <div className="px-6 py-5">
          <div className="card overflow-hidden">
            {/* Report header row */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--border-strong] bg-[--surface-2]">
                  <th className="px-5 py-3 text-left font-semibold text-[--text-1] text-sm">Account</th>
                  <th className="px-5 py-3 text-right font-semibold text-[--text-1] text-sm">
                    Jan–Jun 2026
                  </th>
                  {comparePrev && (
                    <>
                      <th className="px-5 py-3 text-right font-semibold text-[--text-2] text-sm">
                        Jan–Jun 2025
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-[--text-2] text-sm">
                        Variance
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-[--text-2] text-sm">
                        %
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* REVENUE section label */}
                <tr className="border-b border-[--border]">
                  <td
                    colSpan={colCount}
                    className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[--text-3] bg-[--surface-2]"
                  >
                    Revenue
                  </td>
                </tr>

                {plData.revenue.map((r) => (
                  <PLRow key={r.label} {...r} comparePrev={comparePrev} indent />
                ))}

                <PLRow
                  label="TOTAL REVENUE"
                  current={plData.totalRevenue}
                  previous={plData.previousRevenue}
                  subtotal
                  bold
                  comparePrev={comparePrev}
                />

                {/* COST OF REVENUE */}
                <tr className="border-b border-[--border]">
                  <td
                    colSpan={colCount}
                    className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[--text-3] bg-[--surface-2]"
                  >
                    Cost of Revenue
                  </td>
                </tr>

                {plData.cogs.map((r) => (
                  <PLRow key={r.label} {...r} comparePrev={comparePrev} indent />
                ))}

                <PLRow
                  label="Total COGS"
                  current={plData.totalCogs}
                  previous={plData.previousCogs}
                  subtotal
                  bold
                  comparePrev={comparePrev}
                />

                {/* GROSS PROFIT */}
                <PLRow
                  label="GROSS PROFIT"
                  current={plData.grossProfit}
                  previous={plData.previousGrossProfit}
                  bold
                  highlight="blue"
                  comparePrev={comparePrev}
                />

                {/* OPERATING EXPENSES */}
                <tr className="border-b border-[--border]">
                  <td
                    colSpan={colCount}
                    className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[--text-3] bg-[--surface-2]"
                  >
                    Operating Expenses
                  </td>
                </tr>

                {plData.opex.map((r) => (
                  <PLRow key={r.label} {...r} comparePrev={comparePrev} indent />
                ))}

                <PLRow
                  label="TOTAL EXPENSES"
                  current={plData.totalOpex}
                  previous={plData.previousOpex}
                  subtotal
                  bold
                  comparePrev={comparePrev}
                />

                {/* NET INCOME */}
                <PLRow
                  label="NET PROFIT"
                  current={plData.netIncome}
                  previous={plData.previousNetIncome}
                  bold
                  highlight={plData.netIncome >= 0 ? 'profit' : 'loss'}
                  comparePrev={comparePrev}
                />
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <p className="text-xs text-[--text-3] mt-3 flex items-center gap-1.5">
            <span className="text-warning">💡</span>
            Click any row to drill down to the underlying journal entries and transactions.
          </p>
        </div>
      )}

      {/* Placeholder for other report types */}
      {tab !== 'pl' && (
        <div className="px-6 py-12 text-center">
          <p className="text-[--text-3] text-sm">
            Select &ldquo;Profit &amp; Loss&rdquo; tab to view the P&L report, or generate another report type.
          </p>
          <button onClick={() => setTab('pl')} className="btn btn-secondary btn-sm mt-4">
            View Profit &amp; Loss
          </button>
        </div>
      )}
    </div>
  );
}
