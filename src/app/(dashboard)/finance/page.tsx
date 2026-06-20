'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? (localStorage.getItem('accessToken') ?? '') : ''}`,
});

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface FinanceSummary {
  arOutstanding: number;
  arInvoiceCount: number;
  apOutstanding: number;
  apBillCount: number;
  cashBalance: number;
  bankAccountCount: number;
  overdueInstallmentCount: number;
  overdueInstallmentAmount: number;
}

interface TodoItem {
  id: string;
  description: string;
  type: 'Invoice' | 'Shift' | 'Assets' | 'Payroll';
  href: string;
}

interface MonthlyPoint {
  month: string; // e.g. "Jan"
  revenue: number;
  expenses: number;
}

interface BranchProfit {
  branch: string;
  gross: number;
}

/* ─── Demo data ───────────────────────────────────────────────────────────── */
const DEMO_SUMMARY: FinanceSummary = {
  arOutstanding: 1_240_000,
  arInvoiceCount: 12,
  apOutstanding: 680_000,
  apBillCount: 3,
  cashBalance: 2_180_000,
  bankAccountCount: 3,
  overdueInstallmentCount: 7,
  overdueInstallmentAmount: 27_800,
};

const DEMO_TODOS: TodoItem[] = [
  { id: '1', description: 'Post invoice INV-2026-0041 for Omar Hassan', type: 'Invoice', href: '/finance/invoices' },
  { id: '2', description: 'Close daily shift — Cairo Branch 18 Jun', type: 'Shift',   href: '/finance/gl' },
  { id: '3', description: 'Register monthly depreciation — Jun 2026', type: 'Assets',  href: '/finance/assets' },
  { id: '4', description: 'Process June payroll commission payouts', type: 'Payroll',  href: '/finance/commissions' },
  { id: '5', description: 'Post invoice INV-2026-0042 for Nour Ibrahim', type: 'Invoice', href: '/finance/invoices' },
  { id: '6', description: 'Reconcile Bank Al-Ahli — Jun 2026', type: 'Shift',   href: '/finance/reconciliation' },
];

const DEMO_MONTHLY: MonthlyPoint[] = [
  { month: 'Jan', revenue: 3_200_000, expenses: 2_150_000 },
  { month: 'Feb', revenue: 2_800_000, expenses: 1_980_000 },
  { month: 'Mar', revenue: 4_100_000, expenses: 2_700_000 },
  { month: 'Apr', revenue: 3_600_000, expenses: 2_400_000 },
  { month: 'May', revenue: 3_900_000, expenses: 2_550_000 },
  { month: 'Jun', revenue: 4_400_000, expenses: 2_820_000 },
];

const DEMO_BRANCHES: BranchProfit[] = [
  { branch: 'Cairo', gross: 1_580_000 },
  { branch: 'Alexandria', gross: 960_000 },
  { branch: 'Giza', gross: 720_000 },
  { branch: 'Sharm El Sheikh', gross: 340_000 },
];

/* ─── Formatters ──────────────────────────────────────────────────────────── */
function fmtEGP(n: number): string {
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `EGP ${(n / 1_000).toFixed(0)}K`;
  return `EGP ${n.toLocaleString()}`;
}

/* ─── SVG Line Chart ──────────────────────────────────────────────────────── */
function LineChart({ data }: { data: MonthlyPoint[] }) {
  const W = 480, H = 180, pad = { top: 16, right: 16, bottom: 32, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const allVals = data.flatMap((d) => [d.revenue, d.expenses]);
  const maxVal = Math.max(...allVals);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const xScale = (i: number) => pad.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - minVal) / range) * innerH;

  const revenuePoints = data.map((d, i) => `${xScale(i)},${yScale(d.revenue)}`).join(' ');
  const expensePoints = data.map((d, i) => `${xScale(i)},${yScale(d.expenses)}`).join(' ');

  // Y axis ticks
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minVal + (range / ticks) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={pad.left} y1={yScale(v)} x2={W - pad.right} y2={yScale(v)}
            stroke="var(--border)" strokeWidth={1}
          />
          <text x={pad.left - 6} y={yScale(v)} textAnchor="end" dominantBaseline="middle"
            style={{ fontSize: 9, fill: 'var(--text-3)' }}>
            {v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
          </text>
        </g>
      ))}

      {/* Revenue area fill */}
      <polygon
        points={`${xScale(0)},${pad.top + innerH} ${revenuePoints} ${xScale(data.length - 1)},${pad.top + innerH}`}
        fill="var(--primary)" fillOpacity={0.08}
      />
      {/* Expense area fill */}
      <polygon
        points={`${xScale(0)},${pad.top + innerH} ${expensePoints} ${xScale(data.length - 1)},${pad.top + innerH}`}
        fill="var(--orange)" fillOpacity={0.08}
      />

      {/* Lines */}
      <polyline points={revenuePoints} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
      <polyline points={expensePoints} fill="none" stroke="var(--orange)" strokeWidth={2} strokeLinejoin="round" />

      {/* Dots */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xScale(i)} cy={yScale(d.revenue)} r={3} fill="var(--primary)" />
          <circle cx={xScale(i)} cy={yScale(d.expenses)} r={3} fill="var(--orange)" />
        </g>
      ))}

      {/* X axis labels */}
      {data.map((d, i) => (
        <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle"
          style={{ fontSize: 9, fill: 'var(--text-3)' }}>
          {d.month}
        </text>
      ))}
    </svg>
  );
}

/* ─── Horizontal bar chart for branch gross profit ───────────────────────── */
function BranchBarChart({ data }: { data: BranchProfit[] }) {
  const max = Math.max(...data.map((d) => d.gross));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {data.map((b) => (
        <div key={b.branch}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 500 }}>{b.branch}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-1)', fontWeight: 600 }}>{fmtEGP(b.gross)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 9999, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 9999,
              width: `${(b.gross / max) * 100}%`,
              background: 'var(--primary)',
              transition: 'width 600ms ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Type badge helper ───────────────────────────────────────────────────── */
function TodoBadge({ type }: { type: TodoItem['type'] }) {
  const map: Record<TodoItem['type'], string> = {
    Invoice: 'badge-info',
    Shift:   'badge-warning',
    Assets:  'badge-orange',
    Payroll: 'badge-purple',
  };
  return <span className={`badge ${map[type]}`}>{type}</span>;
}

/* ─── AR/AP Aging table ───────────────────────────────────────────────────── */
function AgingTable() {
  const rows = [
    { label: 'Receivables', current: 620_000, d30: 340_000, d60: 180_000, d60p: 100_000, total: 1_240_000 },
    { label: 'Payables',    current: 200_000, d30: 180_000, d60: 200_000, d60p: 100_000, total:   680_000 },
  ];
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th></th>
          <th>Current</th>
          <th>1–30 days</th>
          <th>31–60 days</th>
          <th style={{ color: 'var(--danger-fg)' }}>60+ days</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.label}</td>
            <td>{fmtEGP(r.current)}</td>
            <td>{fmtEGP(r.d30)}</td>
            <td>{fmtEGP(r.d60)}</td>
            <td style={{ color: 'var(--danger-fg)', fontWeight: 600 }}>{fmtEGP(r.d60p)}</td>
            <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{fmtEGP(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function FinanceDashboardPage() {
  const [summary, setSummary] = useState<FinanceSummary>(DEMO_SUMMARY);
  const [todos] = useState<TodoItem[]>(DEMO_TODOS);
  const [monthly] = useState<MonthlyPoint[]>(DEMO_MONTHLY);
  const [branches] = useState<BranchProfit[]>(DEMO_BRANCHES);

  // Attempt real API fetch; fall back to demo on error
  useEffect(() => {
    fetch(`${API}/finance/summary`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSummary(d); })
      .catch(() => {/* use demo */});
  }, []);

  /* KPI cards */
  const KPI_CARDS = [
    {
      label: 'AR OUTSTANDING',
      value: fmtEGP(summary.arOutstanding),
      sub: `${summary.arInvoiceCount} invoices`,
      color: 'var(--success-fg)',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        </svg>
      ),
    },
    {
      label: 'AP OUTSTANDING',
      value: fmtEGP(summary.apOutstanding),
      sub: `${summary.apBillCount} bills, due`,
      color: 'var(--danger-fg)',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2h-4m-4 4l-4-4 4-4m0 8V10" />
        </svg>
      ),
    },
    {
      label: 'CASH & BANK BALANCE',
      value: fmtEGP(summary.cashBalance),
      sub: `Across ${summary.bankAccountCount} accounts`,
      color: 'var(--info-fg)',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'OVERDUE INSTALLMENTS',
      value: String(summary.overdueInstallmentCount),
      sub: `${fmtEGP(summary.overdueInstallmentAmount)} overdue`,
      color: 'var(--warning-fg)',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Dashboard</h1>
          <p className="page-subtitle">June 2026 · All Locations · Company Overview</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/finance/reports" className="btn btn-secondary btn-sm">View Reports</Link>
          <Link href="/finance/gl?action=new" className="btn btn-primary btn-sm">+ New Journal Entry</Link>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── KPI Row ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
          {KPI_CARDS.map((k) => (
            <div key={k.label} className="card" style={{ padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '0.5rem', flexShrink: 0,
                background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: k.color,
              }}>
                {k.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 4 }}>
                  {k.label}
                </p>
                <p style={{ fontSize: '1.3rem', fontWeight: 700, color: k.color, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                  {k.value}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 3 }}>{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 2: To-Do Queue + AR/AP Aging ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.875rem' }}>

          {/* To-Do Queue */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>To-Do Queue</p>
              <span className="badge badge-warning">{todos.length} pending</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {todos.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-1)' }}>{t.description}</td>
                    <td><TodoBadge type={t.type} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={t.href} style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 500, textDecoration: 'none' }}>
                        Load →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AR / AP Aging */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>AR / AP Aging Summary</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>As of Jun 2026</span>
            </div>
            <AgingTable />
          </div>
        </div>

        {/* ── Row 3: Revenue vs Expenses Chart + Branch Profit + Quick Actions ─ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr 0.8fr', gap: '0.875rem' }}>

          {/* Monthly Revenue vs Expenses */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>Monthly Revenue vs Expenses</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--text-3)' }}>
                  <span style={{ width: 12, height: 3, background: 'var(--primary)', borderRadius: 9999, display: 'inline-block' }} />
                  Revenue
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--text-3)' }}>
                  <span style={{ width: 12, height: 3, background: 'var(--orange)', borderRadius: 9999, display: 'inline-block' }} />
                  Expenses
                </span>
              </div>
            </div>
            <LineChart data={monthly} />
          </div>

          {/* Per-Branch Gross Profit */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem', marginBottom: '1rem' }}>Per-Branch Gross Profit</p>
            <BranchBarChart data={branches} />

            <div style={{ marginTop: '1.25rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Total Gross</span>
                <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>
                  {fmtEGP(branches.reduce((s, b) => s + b.gross, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem', marginBottom: '1.125rem' }}>Quick Actions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {[
                { label: '+ New Customer Invoice', href: '/finance/invoices?action=new' },
                { label: '+ Register Payment',     href: '/finance/payments?action=new' },
                { label: '+ New Journal Entry',    href: '/finance/gl?action=new' },
                { label: '↳ New Vendor Bill',      href: '/finance/invoices?type=VENDOR_BILL&action=new' },
                { label: 'Import Bank Statement',  href: '/finance/bank-statements?action=import' },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  style={{
                    color: 'var(--primary)', fontSize: '0.8125rem', fontWeight: 500,
                    textDecoration: 'none', padding: '0.4rem 0.625rem', borderRadius: '0.4rem',
                    transition: 'background 150ms',
                    display: 'block',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--info-bg)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                >
                  {a.label}
                </Link>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '0.625rem' }}>
                Finance Modules
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {[
                  { label: 'Chart of Accounts', href: '/finance/accounts' },
                  { label: 'Journals',           href: '/finance/journals' },
                  { label: 'Currencies',         href: '/finance/currencies' },
                  { label: 'Fiscal Years',       href: '/finance/fiscal-years' },
                  { label: 'Fixed Assets',       href: '/finance/assets' },
                  { label: 'Taxes',              href: '/finance/taxes' },
                  { label: 'Reconciliation',     href: '/finance/reconciliation' },
                  { label: 'Commissions',        href: '/finance/commissions' },
                ].map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    style={{
                      color: 'var(--text-2)', fontSize: '0.75rem',
                      textDecoration: 'none', padding: '0.25rem 0.5rem',
                      borderRadius: '0.35rem', transition: 'all 120ms', display: 'block',
                    }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = 'var(--surface-2)'; el.style.color = 'var(--primary)'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = 'transparent'; el.style.color = 'var(--text-2)'; }}
                  >
                    {m.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
