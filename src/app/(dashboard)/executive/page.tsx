'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/useApi';
import { useLang } from '@/lib/lang-context';

/* ── types ──────────────────────────────────────────────────────────────── */
interface BranchRow {
  branch: string;
  revenueMTD: number;
  grossProfit: number;
  unitsSold: number;
  topModel: string;
}

interface RecentDeal {
  id: string;
  vehicle?: { make: string; model: string };
  customer?: { name: string };
  salePrice: number;
  purchaseMethod: string;
  finalizedAt?: string;
  createdAt: string;
  user?: { name: string };
}

interface OverdueInstallment {
  id: string;
  amount: number;
}

/* ── zero-state KPIs (shown until API responds) ──────────────────────────── */
const ZERO_KPIS = {
  totalRevenueMTD:  0,
  unitsSoldMTD:     0,
  grossMarginPct:   0,
  avgDaysToSale:    0,
  leadConvRate:     0,
  overdueAmount:    0,
  overdueCount:     0,
  revTrend:     null as number | null,
  unitsTrend:   null as number | null,
  marginTrend:  null as number | null,
  daysTrend:    null as number | null,
  convTrend:    null as number | null,
  overdTrend:   null as number | null,
};

/* ── formatters ─────────────────────────────────────────────────────────── */
function fmtEGP(n: number | undefined | null) {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `EGP ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `EGP ${(v / 1_000).toFixed(0)}K`;
  return `EGP ${v.toLocaleString()}`;
}
function fmtPct(n: number | undefined | null) { return `${(Number(n ?? 0)).toFixed(1)}%`; }
function fmtDate(s: string, ar: boolean) {
  return new Date(s).toLocaleDateString(ar ? 'ar-EG' : 'en-EG', { month: 'short', day: 'numeric' });
}
function methodLabel(m: string, ar: boolean) {
  if (m === 'CASH') return ar ? 'نقداً' : 'Cash';
  if (m === 'BANK_FINANCING') return ar ? 'بنك' : 'Bank';
  return ar ? 'تقسيط' : 'Install.';
}

/* ── TrendArrow ─────────────────────────────────────────────────────────── */
function TrendArrow({ trend, invert = false }: { trend?: number | null; invert?: boolean }) {
  const v = Number(trend ?? 0);
  const positive = invert ? v < 0 : v > 0;
  const color = positive ? 'var(--success-fg)' : 'var(--danger-fg)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.6875rem', fontWeight: 500, color }}>
      <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"
        style={{ transform: v < 0 ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
      </svg>
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

/* ── KpiCell ────────────────────────────────────────────────────────────── */
interface KpiCellProps {
  label: string; value: string; trend?: number | null; invertTrend?: boolean;
}
function KpiCell({ label, value, trend, invertTrend }: KpiCellProps) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0, padding: '0.875rem 1rem',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
        {value}
      </p>
      {trend != null && <TrendArrow trend={trend} invert={invertTrend} />}
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────────────────── */
export default function ExecutivePage() {
  const { isAr } = useLang();
  const [kpis,      setKpis]      = useState(ZERO_KPIS);
  const [branches,  setBranches]  = useState<BranchRow[]>([]);
  const [recent,    setRecent]    = useState<RecentDeal[]>([]);
  const [overdue,   setOverdue]   = useState<OverdueInstallment[]>([]);

  useEffect(() => {
    // revenue by month — current total + month-over-month trend
    apiFetch<{ months?: Array<{ revenue: number; expenses: number; month: string }> }>('/finance/reports/revenue-by-month')
      .then(d => {
        if (d?.months?.length) {
          const ms = d.months;
          const last = ms[ms.length - 1];
          const prev = ms.length >= 2 ? ms[ms.length - 2] : null;
          const revTrend = prev && Number(prev.revenue) > 0
            ? Math.round(((Number(last.revenue) - Number(prev.revenue)) / Number(prev.revenue)) * 1000) / 10
            : null;
          if (last) setKpis(k => ({ ...k, totalRevenueMTD: Number(last.revenue), revTrend }));
        }
      })
      .catch(() => {});

    // income statement — gross margin %
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    apiFetch<{ totalIncome?: string | number; netProfit?: string | number }>(`/finance/reports/income-statement?dateFrom=${monthStart}`)
      .then(d => {
        const income = Number(d?.totalIncome ?? 0);
        const profit = Number(d?.netProfit ?? 0);
        if (income > 0) setKpis(k => ({ ...k, grossMarginPct: Math.round((profit / income) * 1000) / 10 }));
      })
      .catch(() => {});

    // branch profit
    apiFetch<{ branches?: BranchRow[] }>('/finance/reports/branch-profit')
      .then(d => { if (d?.branches) setBranches(d.branches); })
      .catch(() => {});

    // recent finalized deals
    apiFetch<{ items?: RecentDeal[] } | RecentDeal[]>('/deals?status=FINALIZED&limit=5')
      .then(d => {
        const list = Array.isArray(d) ? d : (d as { items?: RecentDeal[] }).items ?? [];
        if (list.length) setRecent(list);
      })
      .catch(() => {});

    // leads for conversion rate
    apiFetch<{ items?: Array<{ status: string; createdAt: string }> } | Array<{ status: string; createdAt: string }>>('/leads?limit=200')
      .then(d => {
        const list = Array.isArray(d) ? d : (d as { items?: Array<{ status: string; createdAt: string }> }).items ?? [];
        if (!list.length) return;
        const won   = list.filter(l => l.status === 'CLOSED_WON').length;
        const rate  = Math.round((won / list.length) * 1000) / 10;
        setKpis(k => ({ ...k, leadConvRate: rate, unitsSoldMTD: won > 0 ? won : k.unitsSoldMTD }));
      })
      .catch(() => {});

    // overdue installments
    apiFetch<{ items?: OverdueInstallment[] } | OverdueInstallment[]>('/deals/installments/overdue')
      .then(d => {
        const list = Array.isArray(d) ? d : (d as { items?: OverdueInstallment[] }).items ?? [];
        setOverdue(list);
        if (list.length) {
          const total = list.reduce((s, x) => s + Number(x.amount ?? 0), 0);
          setKpis(k => ({ ...k, overdueCount: list.length, overdueAmount: total }));
        }
      })
      .catch(() => {});
  }, []);

  const locale   = isAr ? 'ar-EG' : 'en-EG';
  const nowLabel = new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'عرض المديرين' : 'Executive View'}</h1>
          <p className="page-subtitle">
            {nowLabel} · {isAr ? 'جميع الفروع · نظرة شاملة' : 'All Locations · Command Overview'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/reports" className="btn btn-secondary btn-sm">{isAr ? 'التقارير' : 'Reports'}</Link>
          <Link href="/finance" className="btn btn-secondary btn-sm">{isAr ? 'المالية' : 'Finance'}</Link>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* overdue alert */}
        {(overdue.length > 0 || kpis.overdueCount > 0) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem', borderRadius: '0.5rem',
            background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--warning-fg)', flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--warning-fg)' }}>
                {isAr
                  ? `${kpis.overdueCount} قسط${kpis.overdueCount !== 1 ? ' متأخرة' : ' متأخر'} بإجمالي ${fmtEGP(kpis.overdueAmount)}`
                  : `${kpis.overdueCount} overdue installment${kpis.overdueCount !== 1 ? 's' : ''} totaling ${fmtEGP(kpis.overdueAmount)}`}
              </span>
            </div>
            <Link href="/deals?filter=overdue_installments" style={{ fontSize: '0.8rem', color: 'var(--warning-fg)', fontWeight: 600, textDecoration: 'none' }}>
              {isAr ? 'عرض →' : 'View →'}
            </Link>
          </div>
        )}

        {/* KPI strip */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <KpiCell label={isAr ? 'الإيرادات (الشهر)' : 'Revenue MTD'}      value={fmtEGP(kpis.totalRevenueMTD)} trend={kpis.revTrend}   />
            <KpiCell label={isAr ? 'وحدات مباعة (الشهر)' : 'Units Sold MTD'} value={String(kpis.unitsSoldMTD)}    trend={kpis.unitsTrend} />
            <KpiCell label={isAr ? 'هامش الربح' : 'Gross Margin'}            value={fmtPct(kpis.grossMarginPct)}  trend={kpis.marginTrend}/>
            <KpiCell label={isAr ? 'متوسط أيام البيع' : 'Avg Days to Sale'}  value={isAr ? `${Number(kpis.avgDaysToSale ?? 0)} يوم` : `${Number(kpis.avgDaysToSale ?? 0)} days`} trend={kpis.daysTrend} invertTrend />
            <KpiCell label={isAr ? 'معدل التحويل' : 'Lead Conv. Rate'}       value={fmtPct(kpis.leadConvRate)}    trend={kpis.convTrend}  />
            <div style={{ flex: '1 1 0', minWidth: 0, padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
                {isAr ? 'الأقساط المتأخرة' : 'Overdue Exposure'}
              </p>
              <p style={{ fontSize: '1.375rem', fontWeight: 600, color: kpis.overdueCount > 0 ? 'var(--warning-fg)' : 'var(--text-1)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
                {fmtEGP(kpis.overdueAmount)}
              </p>
              <TrendArrow trend={kpis.overdTrend} invert />
            </div>
          </div>
        </div>

        {/* branch performance + recent deals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.875rem' }}>

          {/* branch table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>
                {isAr ? 'أداء الفروع' : 'Branch Performance'}
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'الفرع' : 'Location'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'الإيرادات (الشهر)' : 'Revenue MTD'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'إجمالي الربح' : 'Gross Profit'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'الوحدات' : 'Units'}</th>
                  <th>{isAr ? 'أكثر طراز مباعاً' : 'Top Model'}</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(b => (
                  <tr key={b.branch}>
                    <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{b.branch}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEGP(b.revenueMTD)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--success-fg)', fontWeight: 600 }}>{fmtEGP(b.grossProfit)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-1)' }}>{Number(b.unitsSold ?? 0)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{b.topModel}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '0.8125rem' }}>{isAr ? 'الإجمالي' : 'Total'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtEGP(branches.reduce((s, b) => s + Number(b.revenueMTD ?? 0), 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-fg)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtEGP(branches.reduce((s, b) => s + Number(b.grossProfit ?? 0), 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-1)' }}>
                    {branches.reduce((s, b) => s + Number(b.unitsSold ?? 0), 0)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* recent deals */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>
                {isAr ? 'الصفقات المنجزة مؤخراً' : 'Recent Finalized Deals'}
              </p>
              <Link href="/deals?status=FINALIZED" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
                {isAr ? 'عرض الكل →' : 'View all →'}
              </Link>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                  <th>{isAr ? 'العميل' : 'Customer'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th>{isAr ? 'طريقة الدفع' : 'Method'}</th>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'المندوب' : 'Rep'}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-1)' }}>
                      {d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}` : d.id.slice(-6).toUpperCase()}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{d.customer?.name ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-1)' }}>
                      {fmtEGP(Number(d.salePrice))}
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: d.purchaseMethod === 'CASH' ? 'var(--success-bg)' : d.purchaseMethod === 'BANK_FINANCING' ? 'var(--info-bg)' : 'var(--warning-bg)',
                        color:      d.purchaseMethod === 'CASH' ? 'var(--success-fg)' : d.purchaseMethod === 'BANK_FINANCING' ? 'var(--info-fg)'    : 'var(--warning-fg)',
                      }}>
                        {methodLabel(d.purchaseMethod, isAr)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{fmtDate(d.finalizedAt ?? d.createdAt, isAr)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{d.user?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
