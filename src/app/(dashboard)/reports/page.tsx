'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch, useQuery } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import { useLang } from '../../../lib/lang-context';
import { translateSource } from '../../../lib/source-labels';
import { ErrorBanner } from '@/components/ui/error-banner';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'sales-pipeline' | 'inventory-aging' | 'lead-conversion' | 'appointment-analytics';

const TABS: { key: Tab; label: string }[] = [
  { key: 'sales-pipeline',         label: 'Sales Pipeline'        },
  { key: 'inventory-aging',        label: 'Inventory Aging'       },
  { key: 'lead-conversion',        label: 'Lead Conversion'       },
  { key: 'appointment-analytics',  label: 'Appointment Analytics' },
];

interface SalesPipelineData {
  totalDeals:      number;
  finalized:       number;
  conversionRate:  number;
  avgDaysToClose:  number;
  totalValue:      number;
  byStage:         { stage: string; count: number; pct: number }[];
  byMethod:        { cash: number; installment: number; bankFinancing: number };
}

interface InventoryAgingData {
  avgDaysInStock: number;
  buckets: {
    d0_30:   { count: number; value: number; pct: number };
    d31_60:  { count: number; value: number; pct: number };
    d61_90:  { count: number; value: number; pct: number };
    d90plus: { count: number; value: number; pct: number };
  };
  stale: { id: string; make: string; model: string; year: number; vin: string; daysInStock: number; price: number }[];
}

interface LeadConversionData {
  totalLeads:       number;
  converted:        number;
  conversionRate:   number;
  avgDaysToConvert: number;
  bySource: { source: string; count: number; converted: number; rate: number }[];
  byRep:    { repName: string; leads: number; converted: number; rate: number }[];
}

interface AppointmentAnalyticsData {
  total:    number;
  showRate: number;
  upcoming: number;
  byType:     { type: string; count: number; showed: number; noShow: number; rate: number }[];
  byLocation: { location: string; total: number; showRate: number }[];
}

interface Location { id: string; name: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const pct = (n: number) => `${n.toFixed(1)}%`;

function Spinner({ isAr }: { isAr: boolean }) {
  return (
    <div className="flex items-center gap-3 p-12 justify-center text-sm" style={{ color: 'var(--text-3)' }}>
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      {isAr ? 'جارٍ إنشاء التقرير…' : 'Generating report…'}
    </div>
  );
}


function EmptyState({ onGenerate, isAr }: { onGenerate: () => void; isAr: boolean }) {
  return (
    <div className="px-6 py-16 text-center">
      <svg className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border-strong)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>{isAr ? 'اضبط الفلاتر واضغط إنشاء التقرير لتحميل البيانات.' : 'Set filters and click Generate Report to load data.'}</p>
      <button onClick={onGenerate} className="btn btn-primary btn-sm">{isAr ? 'إنشاء التقرير' : 'Generate Report'}</button>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4 flex-1 min-w-[140px]">
      <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  );
}

// ── Tab: Sales Pipeline ───────────────────────────────────────────────────────

function SalesPipelineTab() {
  const { isAr } = useLang();

  const STAGE_LABELS: Record<string, string> = isAr ? {
    DRAFT:           'مسودة',
    PENDING_FINANCE: 'قيد التمويل',
    APPROVED:        'موافق عليها',
    FINALIZED:       'مكتملة',
    CANCELLED:       'ملغاة',
  } : {
    DRAFT:            'Draft',
    PENDING_FINANCE:  'Pending Finance',
    APPROVED:         'Approved',
    FINALIZED:        'Finalized',
    CANCELLED:        'Cancelled',
  };
  const [locationId, setLocationId] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [data,       setData]       = useState<SalesPipelineData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const { data: locRaw } = useQuery<Location[]>('/locations');
  const locations = Array.isArray(locRaw) ? locRaw : [];
  const locOpts   = [{ value: '', label: isAr ? 'جميع الفروع' : 'All Locations' }, ...locations.map((l) => ({ value: l.id, label: l.name }))];

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo',   dateTo);
      const result = await apiFetch<SalesPipelineData>(`/reports/sales-pipeline?${qs}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل التقرير.' : 'Failed to load Sales Pipeline report.'));
    } finally { setLoading(false); }
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-end border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div>
          <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
          <SearchableCombobox options={locOpts} value={locationId} onChange={setLocationId} placeholder={isAr ? 'جميع الفروع' : 'All Locations'} className="w-44" />
        </div>
        <div>
          <label className="input-label">{isAr ? 'من تاريخ' : 'Date From'}</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input w-36" />
        </div>
        <div>
          <label className="input-label">{isAr ? 'إلى تاريخ' : 'Date To'}</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input w-36" />
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-primary btn-sm">
          {loading ? (isAr ? 'جارٍ الإنشاء…' : 'Generating…') : (isAr ? 'إنشاء التقرير' : 'Generate Report')}
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <div className="mx-6 mt-4"><ErrorBanner error={error} retry={generate} /></div>}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            {/* KPI row */}
            <div className="flex flex-wrap gap-3">
              <KpiCard label={isAr ? 'إجمالي الصفقات' : 'Total Deals'}      value={String(data.totalDeals)} />
              <KpiCard label={isAr ? 'مكتملة' : 'Finalized'}                value={String(data.finalized)} />
              <KpiCard label={isAr ? 'معدل التحويل' : 'Conversion Rate'}    value={pct(data.conversionRate)} />
              <KpiCard label={isAr ? 'متوسط أيام الإغلاق' : 'Avg Days to Close'} value={data.avgDaysToClose.toFixed(1)} sub={isAr ? 'يوم' : 'days'} />
              <KpiCard label={isAr ? 'القيمة الإجمالية' : 'Total Value'}    value={egp(data.totalValue)} />
            </div>

            {/* Stage breakdown */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{isAr ? 'توزيع الصفقات حسب المرحلة' : 'Deal Stage Breakdown'}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{isAr ? 'الحالة' : 'Stage'}</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{isAr ? 'العدد' : 'Count'}</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-2)' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStage.map((row) => (
                    <tr key={row.stage} className="border-b transition" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-5 py-2.5" style={{ color: 'var(--text-1)' }}>{STAGE_LABELS[row.stage] ?? row.stage}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-1)' }}>{row.count}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-3)' }}>{pct(row.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Purchase method row */}
            <div className="flex gap-3 flex-wrap">
              <div className="card p-4 flex-1 min-w-[160px]">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{isAr ? 'نقداً' : 'Cash'}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{data.byMethod.cash}</p>
              </div>
              <div className="card p-4 flex-1 min-w-[160px]">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{isAr ? 'تقسيط' : 'Installment'}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{data.byMethod.installment}</p>
              </div>
              <div className="card p-4 flex-1 min-w-[160px]">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{isAr ? 'تمويل بنكي' : 'Bank Financing'}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{data.byMethod.bankFinancing}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: Inventory Aging ──────────────────────────────────────────────────────

function InventoryAgingTab() {
  const { isAr } = useLang();
  const [locationId, setLocationId] = useState('');
  const [data,       setData]       = useState<InventoryAgingData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const { data: locRaw } = useQuery<Location[]>('/locations');
  const locations = Array.isArray(locRaw) ? locRaw : [];
  const locOpts   = [{ value: '', label: isAr ? 'جميع الفروع' : 'All Locations' }, ...locations.map((l) => ({ value: l.id, label: l.name }))];

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      const result = await apiFetch<InventoryAgingData>(`/reports/inventory-aging?${qs}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل التقرير.' : 'Failed to load Inventory Aging report.'));
    } finally { setLoading(false); }
  }

  const BUCKETS = data ? [
    { label: isAr ? '0–30 يوم'    : '0–30 days',    ...data.buckets.d0_30,   color: 'var(--success)' },
    { label: isAr ? '31–60 يوم'   : '31–60 days',   ...data.buckets.d31_60,  color: 'var(--primary)' },
    { label: isAr ? '61–90 يوم'   : '61–90 days',   ...data.buckets.d61_90,  color: 'var(--warning)' },
    { label: isAr ? 'أكثر من 90'  : 'Over 90 days', ...data.buckets.d90plus, color: 'var(--danger)'  },
  ] : [];

  return (
    <div>
      {/* Filter bar */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-end border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div>
          <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
          <SearchableCombobox options={locOpts} value={locationId} onChange={setLocationId} placeholder={isAr ? 'جميع الفروع' : 'All Locations'} className="w-44" />
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-primary btn-sm">
          {loading ? (isAr ? 'جارٍ الإنشاء…' : 'Generating…') : (isAr ? 'إنشاء التقرير' : 'Generate Report')}
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <div className="mx-6 mt-4"><ErrorBanner error={error} retry={generate} /></div>}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            {/* Avg KPI + bucket cards */}
            <div className="flex flex-wrap gap-3">
              {BUCKETS.map((b) => (
                <div key={b.label} className="card p-4 flex-1 min-w-[150px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>{b.label}</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{b.count}</p>
                  <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-3)' }}>{egp(b.value)} · {pct(b.pct)}</p>
                </div>
              ))}
              <KpiCard label={isAr ? 'متوسط أيام المخزن' : 'Avg Days in Stock'} value={data.avgDaysInStock.toFixed(1)} sub={isAr ? 'يوم' : 'days'} />
            </div>

            {/* Stale vehicles table */}
            {data.stale.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--danger-fg)' }}>{isAr ? 'مركبات تجاوزت 90 يوم' : 'Vehicles Over 90 Days'}</p>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'الماركة' : 'Make'}</th>
                      <th>{isAr ? 'الموديل' : 'Model'}</th>
                      <th>{isAr ? 'السنة' : 'Year'}</th>
                      <th>{isAr ? 'الشاسيه' : 'VIN'}</th>
                      <th className="text-right">{isAr ? 'أيام في المخزن' : 'Days in Stock'}</th>
                      <th className="text-right">{isAr ? 'السعر' : 'Price'}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stale.map((v) => (
                      <tr key={v.id}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{v.make}</td>
                        <td style={{ color: 'var(--text-2)' }}>{v.model}</td>
                        <td style={{ color: 'var(--text-3)' }}>{v.year}</td>
                        <td className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>{v.vin}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--danger-fg)', fontWeight: 600 }}>{v.daysInStock}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-1)' }}>{egp(v.price)}</td>
                        <td>
                          <Link href={`/vehicles/${v.id}`} className="btn btn-ghost btn-sm">{isAr ? 'عرض' : 'View'}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: Lead Conversion ──────────────────────────────────────────────────────

function LeadConversionTab() {
  const { isAr } = useLang();
  const [locationId, setLocationId] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [data,       setData]       = useState<LeadConversionData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const { data: locRaw } = useQuery<Location[]>('/locations');
  const locations = Array.isArray(locRaw) ? locRaw : [];
  const locOpts   = [{ value: '', label: isAr ? 'جميع الفروع' : 'All Locations' }, ...locations.map((l) => ({ value: l.id, label: l.name }))];

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo',   dateTo);
      const result = await apiFetch<LeadConversionData>(`/reports/lead-conversion?${qs}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل التقرير.' : 'Failed to load Lead Conversion report.'));
    } finally { setLoading(false); }
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-end border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div>
          <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
          <SearchableCombobox options={locOpts} value={locationId} onChange={setLocationId} placeholder={isAr ? 'جميع الفروع' : 'All Locations'} className="w-44" />
        </div>
        <div>
          <label className="input-label">{isAr ? 'من تاريخ' : 'Date From'}</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input w-36" />
        </div>
        <div>
          <label className="input-label">{isAr ? 'إلى تاريخ' : 'Date To'}</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input w-36" />
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-primary btn-sm">
          {loading ? (isAr ? 'جارٍ الإنشاء…' : 'Generating…') : (isAr ? 'إنشاء التقرير' : 'Generate Report')}
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <div className="mx-6 mt-4"><ErrorBanner error={error} retry={generate} /></div>}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            {/* KPI row */}
            <div className="flex flex-wrap gap-3">
              <KpiCard label={isAr ? 'إجمالي العملاء المحتملين' : 'Total Leads'} value={String(data.totalLeads)} />
              <KpiCard label={isAr ? 'تم التحويل' : 'Converted'}               value={String(data.converted)} />
              <KpiCard label={isAr ? 'معدل التحويل' : 'Conversion Rate'}       value={pct(data.conversionRate)} />
              <KpiCard label={isAr ? 'متوسط أيام التحويل' : 'Avg Days to Convert'} value={data.avgDaysToConvert.toFixed(1)} sub={isAr ? 'يوم' : 'days'} />
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* By Source */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{isAr ? 'حسب مصدر العميل' : 'By Lead Source'}</p>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'المصدر' : 'Source'}</th>
                      <th className="text-right">{isAr ? 'العدد' : 'Count'}</th>
                      <th className="text-right">{isAr ? 'محول' : 'Converted'}</th>
                      <th className="text-right">{isAr ? 'النسبة' : 'Rate'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySource.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>
                    )}
                    {data.bySource.map((row) => (
                      <tr key={row.source}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{translateSource(row.source, isAr)}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>{row.count}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>{row.converted}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct(row.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* By Rep */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{isAr ? 'حسب مندوب المبيعات' : 'By Sales Rep'}</p>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'المندوب' : 'Rep Name'}</th>
                      <th className="text-right">{isAr ? 'العملاء' : 'Leads'}</th>
                      <th className="text-right">{isAr ? 'محول' : 'Converted'}</th>
                      <th className="text-right">{isAr ? 'النسبة' : 'Rate'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byRep.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>
                    )}
                    {data.byRep.map((row) => (
                      <tr key={row.repName}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{row.repName}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>{row.leads}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>{row.converted}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct(row.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: Appointment Analytics ────────────────────────────────────────────────

function AppointmentAnalyticsTab() {
  const { isAr } = useLang();
  const [locationId, setLocationId] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [data,       setData]       = useState<AppointmentAnalyticsData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const { data: locRaw } = useQuery<Location[]>('/locations');
  const locations = Array.isArray(locRaw) ? locRaw : [];
  const locOpts   = [{ value: '', label: isAr ? 'جميع الفروع' : 'All Locations' }, ...locations.map((l) => ({ value: l.id, label: l.name }))];

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo',   dateTo);
      const result = await apiFetch<AppointmentAnalyticsData>(`/reports/appointment-analytics?${qs}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (isAr ? 'فشل تحميل التقرير.' : 'Failed to load Appointment Analytics report.'));
    } finally { setLoading(false); }
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-end border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div>
          <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
          <SearchableCombobox options={locOpts} value={locationId} onChange={setLocationId} placeholder={isAr ? 'جميع الفروع' : 'All Locations'} className="w-44" />
        </div>
        <div>
          <label className="input-label">{isAr ? 'من تاريخ' : 'Date From'}</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input w-36" />
        </div>
        <div>
          <label className="input-label">{isAr ? 'إلى تاريخ' : 'Date To'}</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input w-36" />
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-primary btn-sm">
          {loading ? (isAr ? 'جارٍ الإنشاء…' : 'Generating…') : (isAr ? 'إنشاء التقرير' : 'Generate Report')}
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <div className="mx-6 mt-4"><ErrorBanner error={error} retry={generate} /></div>}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            {/* KPI row */}
            <div className="flex flex-wrap gap-3">
              <KpiCard label={isAr ? 'الإجمالي' : 'Total'}          value={String(data.total)} />
              <KpiCard label={isAr ? 'معدل الحضور' : 'Show Rate'}  value={pct(data.showRate)} />
              <KpiCard label={isAr ? 'القادمة' : 'Upcoming'}        value={String(data.upcoming)} />
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* By Type */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{isAr ? 'حسب نوع الموعد' : 'By Appointment Type'}</p>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'النوع' : 'Type'}</th>
                      <th className="text-right">{isAr ? 'العدد' : 'Count'}</th>
                      <th className="text-right">{isAr ? 'حضر' : 'Showed'}</th>
                      <th className="text-right">{isAr ? 'لم يحضر' : 'No-Show'}</th>
                      <th className="text-right">{isAr ? 'نسبة الحضور' : 'Show Rate'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byType.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>
                    )}
                    {data.byType.map((row) => (
                      <tr key={row.type}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{row.type}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>{row.count}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>{row.showed}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--danger-fg)' }}>{row.noShow}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct(row.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* By Location */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{isAr ? 'حسب الفرع' : 'By Location'}</p>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'الفرع' : 'Location'}</th>
                      <th className="text-right">{isAr ? 'الإجمالي' : 'Total'}</th>
                      <th className="text-right">{isAr ? 'نسبة الحضور' : 'Show Rate'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byLocation.length === 0 && (
                      <tr><td colSpan={3} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>
                    )}
                    {data.byLocation.map((row) => (
                      <tr key={row.location}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{row.location}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>{row.total}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct(row.showRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { isAr } = useLang();
  const [tab, setTab] = useState<Tab>('sales-pipeline');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'التقارير التشغيلية' : 'Operational Reports'}</h1>
          <p className="page-subtitle">{isAr ? 'تقارير المبيعات والمخزن والعملاء والمواعيد' : 'Sales, inventory, leads & appointment analytics'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-2">
        <div className="tabs">
          {TABS.map((t) => {
            const arLabels: Record<Tab, string> = {
              'sales-pipeline':        'مسار المبيعات',
              'inventory-aging':       'تقادم المخزن',
              'lead-conversion':       'تحويل العملاء',
              'appointment-analytics': 'تحليل المواعيد',
            };
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`tab ${tab === t.key ? 'active' : ''}`}
              >
                {isAr ? arLabels[t.key] : t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'sales-pipeline'        && <SalesPipelineTab />}
      {tab === 'inventory-aging'        && <InventoryAgingTab />}
      {tab === 'lead-conversion'        && <LeadConversionTab />}
      {tab === 'appointment-analytics'  && <AppointmentAnalyticsTab />}
    </div>
  );
}
