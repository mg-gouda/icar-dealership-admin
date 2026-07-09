'use client';

import { useState } from 'react';
import { apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import { ErrorBanner } from '@/components/ui/error-banner';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportTab = 'pl' | 'balance-sheet' | 'trial-balance' | 'cash-flow' | 'ar-aging' | 'ap-aging' | 'tax-report';

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

interface BSSection { label: string; amount: number; }
interface BalanceSheetData {
  assets: BSSection[];
  totalAssets: number;
  liabilities: BSSection[];
  totalLiabilities: number;
  equity: BSSection[];
  totalEquity: number;
}

interface TrialBalanceLine { code: string; name: string; debit: number; credit: number; }
interface TrialBalanceData {
  items: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
}

interface GLDetailLine { date: string; journal: string; entryRef: string; description: string; debit: number; credit: number; }
interface GLDetailData { items: GLDetailLine[]; }

interface AgedLine { party: string; current: number; d30: number; d60: number; d90p: number; total: number; }
interface AgedData { items: AgedLine[]; totals: AgedLine; }

interface TaxLine { taxName: string; taxableAmount: number; taxAmount: number; }
interface TaxReportData { items: TaxLine[]; totalTaxable: number; totalTax: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function variance(curr: number, prev: number) {
  if (!prev) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return { amount: curr - prev, pct };
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ isAr }: { isAr: boolean }) {
  return (
    <div className="flex items-center gap-3 p-10 justify-center text-[--text-3] text-sm">
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      {isAr ? 'جاري توليد التقرير…' : 'Generating report…'}
    </div>
  );
}


function EmptyState({ onGenerate, isAr }: { onGenerate: () => void; isAr: boolean }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[--text-3] text-sm mb-4">
        {isAr ? 'انقر على «توليد التقرير» لتحميل بيانات الفترة المحددة.' : 'Click Generate Report to load data for the selected period.'}
      </p>
      <button onClick={onGenerate} className="btn btn-primary btn-sm">
        {isAr ? 'توليد التقرير' : 'Generate Report'}
      </button>
    </div>
  );
}

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
  const { isAr } = useLang();
  const now = new Date();
  const [tab, setTab] = useState<ReportTab>('pl');
  const [period, setPeriod] = useState('this-year');
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);
  const [locationId, setLocationId] = useState('');
  const [comparePrev, setComparePrev] = useState(true);

  // Bilingual tab + period definitions (inside component to use isAr)
  const TABS: { key: ReportTab; en: string; ar: string }[] = [
    { key: 'balance-sheet',  en: 'Balance Sheet',    ar: 'الميزانية العمومية' },
    { key: 'pl',             en: 'Profit & Loss',    ar: 'قائمة الدخل' },
    { key: 'trial-balance',  en: 'Trial Balance',    ar: 'ميزان المراجعة' },
    { key: 'cash-flow',      en: 'General Ledger',   ar: 'دفتر الأستاذ العام' },
    { key: 'ar-aging',       en: 'Aged AR',          ar: 'الذمم المدينة المتأخرة' },
    { key: 'ap-aging',       en: 'Aged AP',          ar: 'الذمم الدائنة المتأخرة' },
    { key: 'tax-report',     en: 'Tax Report',       ar: 'تقرير الضرائب' },
  ];

  const PERIOD_OPTS = [
    { value: 'this-month',   label: isAr ? 'هذا الشهر'    : 'This Month' },
    { value: 'last-month',   label: isAr ? 'الشهر الماضي' : 'Last Month' },
    { value: 'this-quarter', label: isAr ? 'هذا الربع'    : 'This Quarter' },
    { value: 'this-year',    label: isAr ? 'هذه السنة'    : 'This Year' },
    { value: 'custom',       label: isAr ? 'نطاق مخصص'   : 'Custom Range' },
  ];

  // P&L state
  const [plData, setPlData] = useState<PLData | null>(null);
  const [plLoading, setPlLoading] = useState(false);
  const [plError, setPlError] = useState('');

  // Balance Sheet state
  const [bsData, setBsData] = useState<BalanceSheetData | null>(null);
  const [bsLoading, setBsLoading] = useState(false);
  const [bsError, setBsError] = useState('');

  // Trial Balance state
  const [tbData, setTbData] = useState<TrialBalanceData | null>(null);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbError, setTbError] = useState('');

  // GL Detail state
  const [glData, setGlData] = useState<GLDetailData | null>(null);
  const [glLoading, setGlLoading] = useState(false);
  const [glError, setGlError] = useState('');

  // Aged AR state
  const [arData, setArData] = useState<AgedData | null>(null);
  const [arLoading, setArLoading] = useState(false);
  const [arError, setArError] = useState('');

  // Aged AP state
  const [apData, setApData] = useState<AgedData | null>(null);
  const [apLoading, setApLoading] = useState(false);
  const [apError, setApError] = useState('');

  // Tax Report state
  const [taxData, setTaxData] = useState<TaxReportData | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState('');

  function periodRange(): { from: string; to: string } {
    const y = now.getFullYear();
    const m = now.getMonth();
    if (period === 'this-month') {
      return {
        from: new Date(y, m, 1).toISOString().split('T')[0],
        to:   new Date(y, m + 1, 0).toISOString().split('T')[0],
      };
    }
    if (period === 'last-month') {
      return {
        from: new Date(y, m - 1, 1).toISOString().split('T')[0],
        to:   new Date(y, m, 0).toISOString().split('T')[0],
      };
    }
    if (period === 'this-quarter') {
      const qStart = Math.floor(m / 3) * 3;
      return {
        from: new Date(y, qStart, 1).toISOString().split('T')[0],
        to:   new Date(y, qStart + 3, 0).toISOString().split('T')[0],
      };
    }
    if (period === 'this-year') {
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    return { from: dateFrom, to: dateTo };
  }

  const locQs = locationId ? `&locationId=${locationId}` : '';

  async function generate() {
    const { from, to } = periodRange();

    if (tab === 'pl') {
      setPlLoading(true); setPlError('');
      try {
        const data = await apiFetch<PLData>(`/finance/reports/profit-loss?from=${from}&to=${to}${locQs}`);
        setPlData(data);
      } catch (e: unknown) {
        setPlError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل تقرير الدخل.' : 'Failed to load P&L report.'));
      } finally { setPlLoading(false); }

    } else if (tab === 'balance-sheet') {
      setBsLoading(true); setBsError('');
      try {
        const data = await apiFetch<BalanceSheetData>(`/finance/reports/balance-sheet?dateFrom=${from}&dateTo=${to}${locQs}`);
        setBsData(data);
      } catch (e: unknown) {
        setBsError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل الميزانية العمومية.' : 'Failed to load Balance Sheet.'));
      } finally { setBsLoading(false); }

    } else if (tab === 'trial-balance') {
      setTbLoading(true); setTbError('');
      try {
        const data = await apiFetch<TrialBalanceData>(`/finance/reports/trial-balance?dateFrom=${from}&dateTo=${to}${locQs}`);
        setTbData(data);
      } catch (e: unknown) {
        setTbError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل ميزان المراجعة.' : 'Failed to load Trial Balance.'));
      } finally { setTbLoading(false); }

    } else if (tab === 'cash-flow') {
      setGlLoading(true); setGlError('');
      try {
        const data = await apiFetch<GLDetailData>(`/finance/reports/gl-by-account?dateFrom=${from}&dateTo=${to}${locQs}`);
        setGlData(data);
      } catch (e: unknown) {
        setGlError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل دفتر الأستاذ.' : 'Failed to load GL Detail.'));
      } finally { setGlLoading(false); }

    } else if (tab === 'ar-aging') {
      setArLoading(true); setArError('');
      try {
        const data = await apiFetch<AgedData>(`/finance/reports/aged-receivables?asOf=${to}${locQs}`);
        setArData(data);
      } catch (e: unknown) {
        setArError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل تقرير الذمم المدينة.' : 'Failed to load Aged AR report.'));
      } finally { setArLoading(false); }

    } else if (tab === 'ap-aging') {
      setApLoading(true); setApError('');
      try {
        const data = await apiFetch<AgedData>(`/finance/reports/aged-ap?locationId=${locationId}&asOf=${to}`);
        setApData(data);
      } catch (e: unknown) {
        setApError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل تقرير الذمم الدائنة.' : 'Failed to load Aged AP report.'));
      } finally { setApLoading(false); }

    } else if (tab === 'tax-report') {
      setTaxLoading(true); setTaxError('');
      try {
        const data = await apiFetch<TaxReportData>(`/finance/reports/tax-report?dateFrom=${from}&dateTo=${to}${locQs}`);
        setTaxData(data);
      } catch (e: unknown) {
        setTaxError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل تقرير الضرائب.' : 'Failed to load Tax Report.'));
      } finally { setTaxLoading(false); }
    }
  }

  function exportPdf() { window.print(); }

  function exportExcel() {
    if (!plData) return;
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

  const anyLoading = plLoading || bsLoading || tbLoading || glLoading || arLoading || apLoading || taxLoading;

  return (
    <div className="min-h-screen bg-[--bg]">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'التقارير المالية' : 'Financial Reports'}</h1>
          <p className="page-subtitle">{isAr ? 'اختر نوع التقرير وولّده' : 'Select a report type and generate'}</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={exportPdf} className="btn btn-secondary btn-sm">
            {isAr ? 'تصدير PDF' : 'Export PDF'}
          </button>
          {tab === 'pl' && plData && (
            <button onClick={exportExcel} className="btn btn-secondary btn-sm">
              {isAr ? 'تصدير Excel' : 'Export Excel'}
            </button>
          )}
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
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-end border-b border-[--border] bg-[--surface]">
        {/* Period */}
        <div>
          <label className="input-label">{isAr ? 'الفترة' : 'Period'}</label>
          <SearchableCombobox
            options={PERIOD_OPTS}
            value={period}
            onChange={setPeriod}
            className="w-44"
          />
        </div>

        {period === 'custom' && (
          <>
            <div>
              <label className="input-label">{isAr ? 'من تاريخ' : 'From'}</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input w-36" />
            </div>
            <div>
              <label className="input-label">{isAr ? 'إلى تاريخ' : 'To'}</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input w-36" />
            </div>
          </>
        )}

        {/* Location */}
        <div>
          <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
          <SearchableCombobox
            options={[{ value: '', label: isAr ? 'كل الفروع' : 'All Locations' }]}
            value={locationId}
            onChange={setLocationId}
            placeholder={isAr ? 'كل الفروع' : 'All Locations'}
            className="w-40"
          />
        </div>

        {/* Compare toggle — P&L only */}
        {tab === 'pl' && (
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
            <span className="text-xs text-[--text-2]">
              {isAr ? 'مقارنة بالفترة السابقة' : 'Compare to Previous Period'}
            </span>
          </label>
        )}

        <button
          onClick={generate}
          disabled={anyLoading}
          className="btn btn-primary btn-sm ml-auto"
        >
          {anyLoading ? (isAr ? 'جاري التوليد…' : 'Generating…') : (isAr ? 'توليد التقرير' : 'Generate Report')}
        </button>
      </div>

      {/* ── P&L Report ─────────────────────────────────────────────────── */}
      {tab === 'pl' && (
        <div className="px-6 py-5">
          {plLoading && <Spinner isAr={isAr} />}
          {plError && <ErrorBanner error={plError} retry={generate} />}
          {!plLoading && !plError && !plData && <EmptyState onGenerate={generate} isAr={isAr} />}
          {!plLoading && plData && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-strong] bg-[--surface-2]">
                    <th className="px-5 py-3 text-left font-semibold text-[--text-1] text-sm">
                      {isAr ? 'الحساب' : 'Account'}
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[--text-1] text-sm">
                      {isAr ? 'الفترة الحالية' : 'Current Period'}
                    </th>
                    {comparePrev && (
                      <>
                        <th className="px-5 py-3 text-right font-semibold text-[--text-2] text-sm">
                          {isAr ? 'الفترة السابقة' : 'Previous Period'}
                        </th>
                        <th className="px-5 py-3 text-right font-semibold text-[--text-2] text-sm">
                          {isAr ? 'الفرق' : 'Variance'}
                        </th>
                        <th className="px-5 py-3 text-right font-semibold text-[--text-2] text-sm">%</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[--border]">
                    <td colSpan={colCount} className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[--text-3] bg-[--surface-2]">
                      {isAr ? 'الإيرادات' : 'Revenue'}
                    </td>
                  </tr>
                  {plData.revenue.map((r) => (
                    <PLRow key={r.label} {...r} comparePrev={comparePrev} indent />
                  ))}
                  <PLRow label={isAr ? 'إجمالي الإيرادات' : 'TOTAL REVENUE'} current={plData.totalRevenue} previous={plData.previousRevenue} subtotal bold comparePrev={comparePrev} />
                  <tr className="border-b border-[--border]">
                    <td colSpan={colCount} className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[--text-3] bg-[--surface-2]">
                      {isAr ? 'تكلفة الإيرادات' : 'Cost of Revenue'}
                    </td>
                  </tr>
                  {plData.cogs.map((r) => (
                    <PLRow key={r.label} {...r} comparePrev={comparePrev} indent />
                  ))}
                  <PLRow label={isAr ? 'إجمالي التكلفة' : 'Total COGS'} current={plData.totalCogs} previous={plData.previousCogs} subtotal bold comparePrev={comparePrev} />
                  <PLRow label={isAr ? 'مجمل الربح' : 'GROSS PROFIT'} current={plData.grossProfit} previous={plData.previousGrossProfit} bold highlight="blue" comparePrev={comparePrev} />
                  <tr className="border-b border-[--border]">
                    <td colSpan={colCount} className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[--text-3] bg-[--surface-2]">
                      {isAr ? 'مصروفات التشغيل' : 'Operating Expenses'}
                    </td>
                  </tr>
                  {plData.opex.map((r) => (
                    <PLRow key={r.label} {...r} comparePrev={comparePrev} indent />
                  ))}
                  <PLRow label={isAr ? 'إجمالي المصروفات' : 'TOTAL EXPENSES'} current={plData.totalOpex} previous={plData.previousOpex} subtotal bold comparePrev={comparePrev} />
                  <PLRow label={isAr ? 'صافي الربح' : 'NET PROFIT'} current={plData.netIncome} previous={plData.previousNetIncome} bold highlight={plData.netIncome >= 0 ? 'profit' : 'loss'} comparePrev={comparePrev} />
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Balance Sheet ───────────────────────────────────────────────── */}
      {tab === 'balance-sheet' && (
        <div className="px-6 py-5">
          {bsLoading && <Spinner isAr={isAr} />}
          {bsError && <ErrorBanner error={bsError} retry={generate} />}
          {!bsLoading && !bsError && !bsData && <EmptyState onGenerate={generate} isAr={isAr} />}
          {!bsLoading && bsData && (
            <div className="grid grid-cols-2 gap-5">
              {/* Assets */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 bg-[--surface-2] border-b border-[--border]">
                  <p className="text-xs font-bold uppercase tracking-widest text-[--text-3]">
                    {isAr ? 'الأصول' : 'Assets'}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {bsData.assets.map((a) => (
                      <tr key={a.label} className="border-b border-[--border] hover:bg-[--surface-2]">
                        <td className="px-5 py-2.5 text-[--text-2] pl-8">{a.label}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-[--text-1]">{egp(a.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[--surface-2]">
                      <td className="px-5 py-3 font-semibold text-[--text-1]">
                        {isAr ? 'إجمالي الأصول' : 'TOTAL ASSETS'}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-bold text-[--primary]">{egp(bsData.totalAssets)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Liabilities + Equity */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 bg-[--surface-2] border-b border-[--border]">
                  <p className="text-xs font-bold uppercase tracking-widest text-[--text-3]">
                    {isAr ? 'الالتزامات وحقوق الملكية' : 'Liabilities & Equity'}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-[--border]">
                      <td colSpan={2} className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[--text-3] bg-[--surface-2]">
                        {isAr ? 'الالتزامات' : 'Liabilities'}
                      </td>
                    </tr>
                    {bsData.liabilities.map((l) => (
                      <tr key={l.label} className="border-b border-[--border] hover:bg-[--surface-2]">
                        <td className="px-5 py-2.5 text-[--text-2] pl-8">{l.label}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-[--text-1]">{egp(l.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[--surface-2]">
                      <td className="px-5 py-2.5 font-semibold text-[--text-1]">
                        {isAr ? 'إجمالي الالتزامات' : 'Total Liabilities'}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-[--primary]">{egp(bsData.totalLiabilities)}</td>
                    </tr>
                    <tr className="border-b border-[--border]">
                      <td colSpan={2} className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[--text-3] bg-[--surface-2]">
                        {isAr ? 'حقوق الملكية' : 'Equity'}
                      </td>
                    </tr>
                    {bsData.equity.map((e) => (
                      <tr key={e.label} className="border-b border-[--border] hover:bg-[--surface-2]">
                        <td className="px-5 py-2.5 text-[--text-2] pl-8">{e.label}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-[--text-1]">{egp(e.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[--surface-2]">
                      <td className="px-5 py-2.5 font-semibold text-[--text-1]">
                        {isAr ? 'إجمالي حقوق الملكية' : 'Total Equity'}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-[--primary]">{egp(bsData.totalEquity)}</td>
                    </tr>
                    <tr className="bg-info-bg">
                      <td className="px-5 py-3 font-bold text-[--text-1]">
                        {isAr ? 'إجمالي الالتزامات + حقوق الملكية' : 'TOTAL LIABILITIES + EQUITY'}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-bold text-[--primary] text-base">
                        {egp(bsData.totalLiabilities + bsData.totalEquity)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Trial Balance ───────────────────────────────────────────────── */}
      {tab === 'trial-balance' && (
        <div className="px-6 py-5">
          {tbLoading && <Spinner isAr={isAr} />}
          {tbError && <ErrorBanner error={tbError} retry={generate} />}
          {!tbLoading && !tbError && !tbData && <EmptyState onGenerate={generate} isAr={isAr} />}
          {!tbLoading && tbData && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'الكود' : 'Code'}</th>
                    <th>{isAr ? 'اسم الحساب' : 'Account Name'}</th>
                    <th className="text-right">{isAr ? 'مدين' : 'Debit'}</th>
                    <th className="text-right">{isAr ? 'دائن' : 'Credit'}</th>
                  </tr>
                </thead>
                <tbody>
                  {tbData.items.map((row) => (
                    <tr key={row.code}>
                      <td className="font-mono text-xs text-[--text-3]">{row.code}</td>
                      <td className="text-[--text-1]">{row.name}</td>
                      <td className="text-right tabular-nums">{row.debit > 0 ? egp(row.debit) : '—'}</td>
                      <td className="text-right tabular-nums">{row.credit > 0 ? egp(row.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[--surface-2] font-semibold">
                    <td colSpan={2} className="px-4 py-3 text-[--text-1]">
                      {isAr ? 'الإجماليات' : 'TOTALS'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(tbData.totalDebit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(tbData.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── General Ledger Detail ───────────────────────────────────────── */}
      {tab === 'cash-flow' && (
        <div className="px-6 py-5">
          {glLoading && <Spinner isAr={isAr} />}
          {glError && <ErrorBanner error={glError} retry={generate} />}
          {!glLoading && !glError && !glData && <EmptyState onGenerate={generate} isAr={isAr} />}
          {!glLoading && glData && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'التاريخ' : 'Date'}</th>
                    <th>{isAr ? 'الدفتر' : 'Journal'}</th>
                    <th>{isAr ? 'مرجع القيد' : 'Entry Ref'}</th>
                    <th>{isAr ? 'البيان' : 'Description'}</th>
                    <th className="text-right">{isAr ? 'مدين' : 'Debit'}</th>
                    <th className="text-right">{isAr ? 'دائن' : 'Credit'}</th>
                  </tr>
                </thead>
                <tbody>
                  {glData.items.map((row, i) => (
                    <tr key={i}>
                      <td className="text-[--text-3] whitespace-nowrap">{fmtDate(row.date, isAr, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="text-[--text-2]">{row.journal}</td>
                      <td className="font-mono text-xs text-[--text-3]">{row.entryRef}</td>
                      <td className="text-[--text-1]">{row.description || '—'}</td>
                      <td className="text-right tabular-nums">{row.debit > 0 ? egp(row.debit) : '—'}</td>
                      <td className="text-right tabular-nums">{row.credit > 0 ? egp(row.credit) : '—'}</td>
                    </tr>
                  ))}
                  {glData.items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[--text-3]">
                        {isAr ? 'لا توجد قيود لهذه الفترة.' : 'No entries for this period.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aged Receivables ────────────────────────────────────────────── */}
      {tab === 'ar-aging' && (
        <div className="px-6 py-5">
          {arLoading && <Spinner isAr={isAr} />}
          {arError && <ErrorBanner error={arError} retry={generate} />}
          {!arLoading && !arError && !arData && <EmptyState onGenerate={generate} isAr={isAr} />}
          {!arLoading && arData && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'العميل' : 'Customer'}</th>
                    <th className="text-right">{isAr ? 'حالي' : 'Current'}</th>
                    <th className="text-right">{isAr ? '0–30 يوم' : '0–30 days'}</th>
                    <th className="text-right">{isAr ? '31–60 يوم' : '31–60 days'}</th>
                    <th className="text-right" style={{ color: 'var(--danger-fg)' }}>{isAr ? '61–90+ يوم' : '61–90+ days'}</th>
                    <th className="text-right">{isAr ? 'الإجمالي' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {arData.items.map((row) => (
                    <tr key={row.party}>
                      <td className="text-[--text-1] font-medium">{row.party}</td>
                      <td className="text-right tabular-nums">{egp(row.current)}</td>
                      <td className="text-right tabular-nums">{egp(row.d30)}</td>
                      <td className="text-right tabular-nums">{egp(row.d60)}</td>
                      <td className="text-right tabular-nums text-danger-fg font-medium">{egp(row.d90p)}</td>
                      <td className="text-right tabular-nums font-semibold text-[--text-1]">{egp(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[--surface-2] font-semibold">
                    <td className="px-4 py-3 text-[--text-1]">{isAr ? 'الإجماليات' : 'TOTALS'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(arData.totals.current)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(arData.totals.d30)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(arData.totals.d60)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-danger-fg">{egp(arData.totals.d90p)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(arData.totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aged Payables ───────────────────────────────────────────────── */}
      {tab === 'ap-aging' && (
        <div className="px-6 py-5">
          {apLoading && <Spinner isAr={isAr} />}
          {apError && <ErrorBanner error={apError} retry={generate} />}
          {!apLoading && !apError && !apData && <EmptyState onGenerate={generate} isAr={isAr} />}
          {!apLoading && apData && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'المورد' : 'Vendor'}</th>
                    <th className="text-right">{isAr ? 'الإجمالي' : 'Total'}</th>
                    <th className="text-right">{isAr ? '0–30 يوم' : '0–30 days'}</th>
                    <th className="text-right">{isAr ? '31–60 يوم' : '31–60 days'}</th>
                    <th className="text-right">{isAr ? '61–90 يوم' : '61–90 days'}</th>
                    <th className="text-right" style={{ color: 'var(--danger-fg)' }}>{isAr ? '90+ يوم' : '90+ days'}</th>
                  </tr>
                </thead>
                <tbody>
                  {apData.items.map((row) => (
                    <tr key={row.party}>
                      <td className="text-[--text-1] font-medium">{row.party}</td>
                      <td className="text-right tabular-nums font-semibold text-[--text-1]">{egp(row.total)}</td>
                      <td className="text-right tabular-nums">{egp(row.current)}</td>
                      <td className="text-right tabular-nums">{egp(row.d30)}</td>
                      <td className="text-right tabular-nums">{egp(row.d60)}</td>
                      <td className="text-right tabular-nums text-danger-fg font-medium">{egp(row.d90p)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[--surface-2] font-semibold">
                    <td className="px-4 py-3 text-[--text-1]">{isAr ? 'الإجماليات' : 'TOTALS'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(apData.totals.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(apData.totals.current)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(apData.totals.d30)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(apData.totals.d60)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-danger-fg">{egp(apData.totals.d90p)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tax Report ──────────────────────────────────────────────────── */}
      {tab === 'tax-report' && (
        <div className="px-6 py-5">
          {taxLoading && <Spinner isAr={isAr} />}
          {taxError && <ErrorBanner error={taxError} retry={generate} />}
          {!taxLoading && !taxError && !taxData && <EmptyState onGenerate={generate} isAr={isAr} />}
          {!taxLoading && taxData && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'اسم الضريبة' : 'Tax Name'}</th>
                    <th className="text-right">{isAr ? 'المبلغ الخاضع للضريبة' : 'Taxable Amount'}</th>
                    <th className="text-right">{isAr ? 'مبلغ الضريبة' : 'Tax Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  {taxData.items.map((row) => (
                    <tr key={row.taxName}>
                      <td className="text-[--text-1] font-medium">{row.taxName}</td>
                      <td className="text-right tabular-nums">{egp(row.taxableAmount)}</td>
                      <td className="text-right tabular-nums font-semibold text-[--text-1]">{egp(row.taxAmount)}</td>
                    </tr>
                  ))}
                  {taxData.items.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-[--text-3]">
                        {isAr ? 'لا توجد بيانات ضريبية لهذه الفترة.' : 'No tax data for this period.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[--surface-2] font-semibold">
                    <td className="px-4 py-3 text-[--text-1]">{isAr ? 'الإجماليات' : 'TOTALS'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(taxData.totalTaxable)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--primary]">{egp(taxData.totalTax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
