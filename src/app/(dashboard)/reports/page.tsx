'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch, useQuery } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import { useLang } from '../../../lib/lang-context';
import { translateSource } from '../../../lib/source-labels';
import { ErrorBanner } from '@/components/ui/error-banner';
import { exportToExcel, exportToPdf, type KpiItem, type TableSheet } from '../../../lib/export-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab =
  | 'sales-pipeline'
  | 'inventory-aging'
  | 'lead-conversion'
  | 'appointment-analytics'
  | 'revenue-by-location'
  | 'service-performance'
  | 'commissions-summary'
  | 'installment-collections';

const TABS: { key: Tab; label: string; labelAr: string }[] = [
  { key: 'sales-pipeline',          label: 'Sales Pipeline',          labelAr: 'مسار المبيعات'        },
  { key: 'inventory-aging',         label: 'Inventory Aging',         labelAr: 'تقادم المخزن'          },
  { key: 'lead-conversion',         label: 'Lead Conversion',         labelAr: 'تحويل العملاء'         },
  { key: 'appointment-analytics',   label: 'Appointment Analytics',   labelAr: 'تحليل المواعيد'        },
  { key: 'revenue-by-location',     label: 'Revenue by Location',     labelAr: 'الإيرادات بالفرع'      },
  { key: 'service-performance',     label: 'Service Performance',     labelAr: 'أداء الصيانة'          },
  { key: 'commissions-summary',     label: 'Commissions',             labelAr: 'العمولات'              },
  { key: 'installment-collections', label: 'Installment Collections', labelAr: 'تحصيل الأقساط'         },
];

interface SalesPipelineData {
  totalDeals: number; finalized: number; conversionRate: number;
  avgDaysToClose: number; totalValue: number;
  byStage:  { stage: string; count: number; pct: number }[];
  byMethod: { cash: number; installment: number; bankFinancing: number };
}
interface InventoryAgingData {
  avgDaysInStock: number;
  buckets: { d0_30: B; d31_60: B; d61_90: B; d90plus: B };
  stale: { id: string; make: string; model: string; year: number; vin: string; daysInStock: number; price: number }[];
}
type B = { count: number; value: number; pct: number };

interface LeadConversionData {
  totalLeads: number; converted: number; conversionRate: number; avgDaysToConvert: number;
  bySource: { source: string; count: number; converted: number; rate: number }[];
  byRep:    { repName: string; leads: number; converted: number; rate: number }[];
}
interface AppointmentAnalyticsData {
  total: number; showRate: number; upcoming: number;
  byType:     { type: string; count: number; showed: number; noShow: number; rate: number }[];
  byLocation: { location: string; total: number; showRate: number }[];
}
interface RevenueByLocationData {
  totalRevenue: number; totalDeals: number; avgDealValue: number; topLocation: string;
  byLocation: { location: string; dealCount: number; totalRevenue: number; avgDealValue: number; cash: number; installment: number; bankFinancing: number }[];
}
interface ServicePerformanceData {
  total: number; completed: number; totalRevenue: number; avgTurnaroundDays: number;
  byStatus:     { status: string; count: number; revenue: number }[];
  byTechnician: { technician: string; orders: number; revenue: number; labor: number }[];
}
interface CommissionsSummaryData {
  totalAccrued: number; totalPayable: number; totalPaid: number; pendingCount: number;
  byRep: { repName: string; accrued: number; payable: number; paid: number; total: number }[];
}
interface InstallmentCollectionsData {
  totalScheduled: number; totalCollected: number; overdueCount: number; overdueAmount: number; collectionRate: number;
  overdue: { id: string; installmentNumber: number; dueDate: string; totalDue: number; paidAmount: number; outstanding: number; daysOverdue: number; customer: string; vehicle: string }[];
}

interface Location { id: string; name: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const egp = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(1)}%`;

// ── Shared UI ─────────────────────────────────────────────────────────────────

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

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card p-4 flex-1 min-w-[140px]" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
      <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  );
}

function TableSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function ExportButtons({ onExcel, onPdf, isAr }: { onExcel: () => void; onPdf: () => void; isAr: boolean }) {
  return (
    <div className="flex gap-2 ml-auto">
      <button onClick={onExcel} className="btn btn-ghost btn-sm flex items-center gap-1.5">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
        </svg>
        {isAr ? 'Excel' : 'Excel'}
      </button>
      <button onClick={onPdf} className="btn btn-ghost btn-sm flex items-center gap-1.5">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        {isAr ? 'PDF' : 'PDF'}
      </button>
    </div>
  );
}

function FilterBar({
  isAr, loading, hasData,
  locationId, onLocation,
  dateFrom, onDateFrom,
  dateTo, onDateTo,
  onGenerate, onExcel, onPdf,
  noLocation, noDate,
}: {
  isAr: boolean; loading: boolean; hasData: boolean;
  locationId: string; onLocation: (v: string) => void;
  dateFrom: string; onDateFrom: (v: string) => void;
  dateTo: string; onDateTo: (v: string) => void;
  onGenerate: () => void; onExcel: () => void; onPdf: () => void;
  noLocation?: boolean; noDate?: boolean;
}) {
  const { data: locRaw } = useQuery<Location[]>('/locations');
  const locations = Array.isArray(locRaw) ? locRaw : [];
  const locOpts   = [{ value: '', label: isAr ? 'جميع الفروع' : 'All Locations' }, ...locations.map((l) => ({ value: l.id, label: l.name }))];

  return (
    <div className="px-6 py-3 flex flex-wrap gap-3 items-end border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {!noLocation && (
        <div>
          <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
          <SearchableCombobox options={locOpts} value={locationId} onChange={onLocation} placeholder={isAr ? 'جميع الفروع' : 'All Locations'} className="w-44" />
        </div>
      )}
      {!noDate && (
        <>
          <div>
            <label className="input-label">{isAr ? 'من تاريخ' : 'Date From'}</label>
            <input type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} className="input w-36" />
          </div>
          <div>
            <label className="input-label">{isAr ? 'إلى تاريخ' : 'Date To'}</label>
            <input type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} className="input w-36" />
          </div>
        </>
      )}
      <button onClick={onGenerate} disabled={loading} className="btn btn-primary btn-sm">
        {loading ? (isAr ? 'جارٍ الإنشاء…' : 'Generating…') : (isAr ? 'إنشاء التقرير' : 'Generate Report')}
      </button>
      {hasData && <ExportButtons onExcel={onExcel} onPdf={onPdf} isAr={isAr} />}
    </div>
  );
}

// ── Tab: Sales Pipeline ───────────────────────────────────────────────────────

function SalesPipelineTab() {
  const { isAr } = useLang();
  const STAGE_LABELS: Record<string, string> = isAr
    ? { DRAFT: 'مسودة', PENDING_FINANCE: 'قيد التمويل', APPROVED: 'موافق', FINALIZED: 'مكتملة', CANCELLED: 'ملغاة' }
    : { DRAFT: 'Draft', PENDING_FINANCE: 'Pending Finance', APPROVED: 'Approved', FINALIZED: 'Finalized', CANCELLED: 'Cancelled' };

  const [locationId, setLocationId] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [data, setData]             = useState<SalesPipelineData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo', dateTo);
      setData(await apiFetch<SalesPipelineData>(`/reports/sales-pipeline?${qs}`));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  function getKpis(): KpiItem[] {
    if (!data) return [];
    return [
      { label: isAr ? 'إجمالي الصفقات' : 'Total Deals',        value: String(data.totalDeals) },
      { label: isAr ? 'مكتملة' : 'Finalized',                  value: String(data.finalized) },
      { label: isAr ? 'معدل التحويل' : 'Conversion Rate',       value: pct(data.conversionRate) },
      { label: isAr ? 'متوسط أيام الإغلاق' : 'Avg Days to Close', value: `${data.avgDaysToClose.toFixed(1)} days` },
      { label: isAr ? 'القيمة الإجمالية' : 'Total Value',       value: egp(data.totalValue) },
    ];
  }
  function getTables(): TableSheet[] {
    if (!data) return [];
    return [
      {
        title:   'Deal Stage Breakdown',
        headers: ['Stage', 'Count', '%'],
        rows:    data.byStage.map((r) => [STAGE_LABELS[r.stage] ?? r.stage, r.count, pct(r.pct)]),
      },
      {
        title:   'Purchase Method',
        headers: ['Method', 'Count'],
        rows:    [['Cash', data.byMethod.cash], ['Installment', data.byMethod.installment], ['Bank Financing', data.byMethod.bankFinancing]],
      },
    ];
  }

  return (
    <div>
      <FilterBar
        isAr={isAr} loading={loading} hasData={!!data}
        locationId={locationId} onLocation={setLocationId}
        dateFrom={dateFrom} onDateFrom={setDateFrom}
        dateTo={dateTo} onDateTo={setDateTo}
        onGenerate={generate}
        onExcel={() => exportToExcel('sales-pipeline', isAr ? 'مسار المبيعات' : 'Sales Pipeline', getKpis(), getTables())}
        onPdf={()   => exportToPdf('sales-pipeline',  isAr ? 'مسار المبيعات' : 'Sales Pipeline', getKpis(), getTables())}
      />
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <ErrorBanner error={error} retry={generate} />}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-3">
              {getKpis().map((k) => <KpiCard key={k.label} label={k.label} value={k.value} />)}
            </div>

            <TableSection title={isAr ? 'توزيع الصفقات حسب المرحلة' : 'Deal Stage Breakdown'}>
              <table className="data-table">
                <thead><tr>
                  <th>{isAr ? 'الحالة' : 'Stage'}</th>
                  <th className="text-right">{isAr ? 'العدد' : 'Count'}</th>
                  <th className="text-right">%</th>
                </tr></thead>
                <tbody>
                  {data.byStage.map((r) => (
                    <tr key={r.stage}>
                      <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{STAGE_LABELS[r.stage] ?? r.stage}</td>
                      <td className="text-right tabular-nums">{r.count}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--text-3)' }}>{pct(r.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableSection>

            <TableSection title={isAr ? 'طريقة الشراء' : 'Purchase Method'}>
              <table className="data-table">
                <thead><tr>
                  <th>{isAr ? 'الطريقة' : 'Method'}</th>
                  <th className="text-right">{isAr ? 'العدد' : 'Count'}</th>
                </tr></thead>
                <tbody>
                  <tr><td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{isAr ? 'نقداً' : 'Cash'}</td><td className="text-right tabular-nums">{data.byMethod.cash}</td></tr>
                  <tr><td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{isAr ? 'تقسيط' : 'Installment'}</td><td className="text-right tabular-nums">{data.byMethod.installment}</td></tr>
                  <tr><td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{isAr ? 'تمويل بنكي' : 'Bank Financing'}</td><td className="text-right tabular-nums">{data.byMethod.bankFinancing}</td></tr>
                </tbody>
              </table>
            </TableSection>
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
  const [data, setData]             = useState<InventoryAgingData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      setData(await apiFetch<InventoryAgingData>(`/reports/inventory-aging?${qs}`));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  const BUCKETS = data ? [
    { label: isAr ? '0–30 يوم' : '0–30 days',   color: 'var(--success)', ...data.buckets.d0_30  },
    { label: isAr ? '31–60 يوم' : '31–60 days',  color: 'var(--primary)', ...data.buckets.d31_60 },
    { label: isAr ? '61–90 يوم' : '61–90 days',  color: 'var(--warning)', ...data.buckets.d61_90 },
    { label: isAr ? 'أكثر من 90' : 'Over 90 days', color: 'var(--danger)', ...data.buckets.d90plus },
  ] : [];

  function getKpis(): KpiItem[] {
    if (!data) return [];
    return [
      ...BUCKETS.map((b) => ({ label: b.label, value: `${b.count} vehicles` })),
      { label: isAr ? 'متوسط أيام المخزن' : 'Avg Days in Stock', value: `${data.avgDaysInStock.toFixed(1)} days` },
    ];
  }
  function getTables(): TableSheet[] {
    if (!data) return [];
    return [
      {
        title:   'Inventory Aging Buckets',
        headers: ['Age Range', 'Vehicles', 'Value (EGP)', '%'],
        rows:    BUCKETS.map((b) => [b.label, b.count, egp(b.value), pct(b.pct)]),
      },
      {
        title:   'Vehicles Over 90 Days (Stale)',
        headers: ['Make', 'Model', 'Year', 'VIN', 'Days in Stock', 'Price (EGP)'],
        rows:    data.stale.map((v) => [v.make, v.model, v.year, v.vin, v.daysInStock, egp(v.price)]),
      },
    ];
  }

  return (
    <div>
      <FilterBar
        isAr={isAr} loading={loading} hasData={!!data}
        locationId={locationId} onLocation={setLocationId}
        dateFrom="" onDateFrom={() => {}} dateTo="" onDateTo={() => {}} noDate
        onGenerate={generate}
        onExcel={() => exportToExcel('inventory-aging', isAr ? 'تقادم المخزن' : 'Inventory Aging', getKpis(), getTables())}
        onPdf={()   => exportToPdf('inventory-aging',  isAr ? 'تقادم المخزن' : 'Inventory Aging', getKpis(), getTables())}
      />
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <ErrorBanner error={error} retry={generate} />}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-3">
              {BUCKETS.map((b) => (
                <div key={b.label} className="card p-4 flex-1 min-w-[150px]" style={{ borderTop: `3px solid ${b.color}` }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>{b.label}</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{b.count}</p>
                  <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-3)' }}>{egp(b.value)} · {pct(b.pct)}</p>
                </div>
              ))}
              <KpiCard label={isAr ? 'متوسط أيام المخزن' : 'Avg Days in Stock'} value={data.avgDaysInStock.toFixed(1)} sub={isAr ? 'يوم' : 'days'} />
            </div>

            <TableSection title={isAr ? 'توزيع فترات التقادم' : 'Aging Bucket Breakdown'}>
              <table className="data-table">
                <thead><tr>
                  <th>{isAr ? 'الفترة' : 'Age Range'}</th>
                  <th className="text-right">{isAr ? 'المركبات' : 'Vehicles'}</th>
                  <th className="text-right">{isAr ? 'القيمة' : 'Value'}</th>
                  <th className="text-right">%</th>
                </tr></thead>
                <tbody>
                  {BUCKETS.map((b) => (
                    <tr key={b.label}>
                      <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{b.label}</td>
                      <td className="text-right tabular-nums">{b.count}</td>
                      <td className="text-right tabular-nums">{egp(b.value)}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--text-3)' }}>{pct(b.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableSection>

            {data.stale.length > 0 && (
              <TableSection title={isAr ? 'مركبات تجاوزت 90 يوم' : 'Vehicles Over 90 Days'}>
                <table className="data-table">
                  <thead><tr>
                    <th>{isAr ? 'الماركة' : 'Make'}</th>
                    <th>{isAr ? 'الموديل' : 'Model'}</th>
                    <th>{isAr ? 'السنة' : 'Year'}</th>
                    <th>{isAr ? 'الشاسيه' : 'VIN'}</th>
                    <th className="text-right">{isAr ? 'أيام' : 'Days'}</th>
                    <th className="text-right">{isAr ? 'السعر' : 'Price'}</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {data.stale.map((v) => (
                      <tr key={v.id}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{v.make}</td>
                        <td style={{ color: 'var(--text-2)' }}>{v.model}</td>
                        <td style={{ color: 'var(--text-3)' }}>{v.year}</td>
                        <td className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>{v.vin}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--danger-fg)', fontWeight: 600 }}>{v.daysInStock}</td>
                        <td className="text-right tabular-nums">{egp(v.price)}</td>
                        <td><Link href={`/vehicles/${v.id}`} className="btn btn-ghost btn-sm">{isAr ? 'عرض' : 'View'}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSection>
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
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [data, setData]             = useState<LeadConversionData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo', dateTo);
      setData(await apiFetch<LeadConversionData>(`/reports/lead-conversion?${qs}`));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  function getKpis(): KpiItem[] {
    if (!data) return [];
    return [
      { label: isAr ? 'إجمالي العملاء' : 'Total Leads',         value: String(data.totalLeads) },
      { label: isAr ? 'تم التحويل' : 'Converted',               value: String(data.converted) },
      { label: isAr ? 'معدل التحويل' : 'Conversion Rate',       value: pct(data.conversionRate) },
      { label: isAr ? 'متوسط أيام التحويل' : 'Avg Days to Convert', value: `${data.avgDaysToConvert.toFixed(1)} days` },
    ];
  }
  function getTables(): TableSheet[] {
    if (!data) return [];
    return [
      { title: 'By Lead Source', headers: ['Source', 'Count', 'Converted', 'Rate'], rows: data.bySource.map((r) => [translateSource(r.source, false), r.count, r.converted, pct(r.rate)]) },
      { title: 'By Sales Rep',   headers: ['Rep', 'Leads', 'Converted', 'Rate'],    rows: data.byRep.map((r) => [r.repName, r.leads, r.converted, pct(r.rate)]) },
    ];
  }

  return (
    <div>
      <FilterBar
        isAr={isAr} loading={loading} hasData={!!data}
        locationId={locationId} onLocation={setLocationId}
        dateFrom={dateFrom} onDateFrom={setDateFrom}
        dateTo={dateTo} onDateTo={setDateTo}
        onGenerate={generate}
        onExcel={() => exportToExcel('lead-conversion', isAr ? 'تحويل العملاء' : 'Lead Conversion', getKpis(), getTables())}
        onPdf={()   => exportToPdf('lead-conversion',  isAr ? 'تحويل العملاء' : 'Lead Conversion', getKpis(), getTables())}
      />
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <ErrorBanner error={error} retry={generate} />}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-3">
              {getKpis().map((k) => <KpiCard key={k.label} label={k.label} value={k.value} />)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TableSection title={isAr ? 'حسب مصدر العميل' : 'By Lead Source'}>
                <table className="data-table">
                  <thead><tr>
                    <th>{isAr ? 'المصدر' : 'Source'}</th>
                    <th className="text-right">{isAr ? 'العدد' : 'Count'}</th>
                    <th className="text-right">{isAr ? 'محول' : 'Converted'}</th>
                    <th className="text-right">{isAr ? 'النسبة' : 'Rate'}</th>
                  </tr></thead>
                  <tbody>
                    {data.bySource.length === 0 && <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                    {data.bySource.map((r) => (
                      <tr key={r.source}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{translateSource(r.source, isAr)}</td>
                        <td className="text-right tabular-nums">{r.count}</td>
                        <td className="text-right tabular-nums">{r.converted}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct(r.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSection>

              <TableSection title={isAr ? 'حسب مندوب المبيعات' : 'By Sales Rep'}>
                <table className="data-table">
                  <thead><tr>
                    <th>{isAr ? 'المندوب' : 'Rep'}</th>
                    <th className="text-right">{isAr ? 'العملاء' : 'Leads'}</th>
                    <th className="text-right">{isAr ? 'محول' : 'Converted'}</th>
                    <th className="text-right">{isAr ? 'النسبة' : 'Rate'}</th>
                  </tr></thead>
                  <tbody>
                    {data.byRep.length === 0 && <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                    {data.byRep.map((r) => (
                      <tr key={r.repName}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.repName}</td>
                        <td className="text-right tabular-nums">{r.leads}</td>
                        <td className="text-right tabular-nums">{r.converted}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct(r.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSection>
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
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [data, setData]             = useState<AppointmentAnalyticsData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo', dateTo);
      setData(await apiFetch<AppointmentAnalyticsData>(`/reports/appointment-analytics?${qs}`));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  function getKpis(): KpiItem[] {
    if (!data) return [];
    return [
      { label: isAr ? 'الإجمالي' : 'Total',         value: String(data.total) },
      { label: isAr ? 'معدل الحضور' : 'Show Rate',  value: pct(data.showRate) },
      { label: isAr ? 'القادمة' : 'Upcoming',        value: String(data.upcoming) },
    ];
  }
  function getTables(): TableSheet[] {
    if (!data) return [];
    return [
      { title: 'By Type',     headers: ['Type', 'Count', 'Showed', 'No-Show', 'Show Rate'], rows: data.byType.map((r) => [r.type, r.count, r.showed, r.noShow, pct(r.rate)]) },
      { title: 'By Location', headers: ['Location', 'Total', 'Show Rate'],                  rows: data.byLocation.map((r) => [r.location, r.total, pct(r.showRate)]) },
    ];
  }

  return (
    <div>
      <FilterBar
        isAr={isAr} loading={loading} hasData={!!data}
        locationId={locationId} onLocation={setLocationId}
        dateFrom={dateFrom} onDateFrom={setDateFrom}
        dateTo={dateTo} onDateTo={setDateTo}
        onGenerate={generate}
        onExcel={() => exportToExcel('appointment-analytics', isAr ? 'تحليل المواعيد' : 'Appointment Analytics', getKpis(), getTables())}
        onPdf={()   => exportToPdf('appointment-analytics',  isAr ? 'تحليل المواعيد' : 'Appointment Analytics', getKpis(), getTables())}
      />
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <ErrorBanner error={error} retry={generate} />}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-3">
              {getKpis().map((k) => <KpiCard key={k.label} label={k.label} value={k.value} />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TableSection title={isAr ? 'حسب نوع الموعد' : 'By Appointment Type'}>
                <table className="data-table">
                  <thead><tr>
                    <th>{isAr ? 'النوع' : 'Type'}</th>
                    <th className="text-right">{isAr ? 'العدد' : 'Count'}</th>
                    <th className="text-right">{isAr ? 'حضر' : 'Showed'}</th>
                    <th className="text-right">{isAr ? 'لم يحضر' : 'No-Show'}</th>
                    <th className="text-right">{isAr ? 'نسبة الحضور' : 'Show Rate'}</th>
                  </tr></thead>
                  <tbody>
                    {data.byType.length === 0 && <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                    {data.byType.map((r) => (
                      <tr key={r.type}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.type}</td>
                        <td className="text-right tabular-nums">{r.count}</td>
                        <td className="text-right tabular-nums">{r.showed}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--danger-fg)' }}>{r.noShow}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct(r.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSection>

              <TableSection title={isAr ? 'حسب الفرع' : 'By Location'}>
                <table className="data-table">
                  <thead><tr>
                    <th>{isAr ? 'الفرع' : 'Location'}</th>
                    <th className="text-right">{isAr ? 'الإجمالي' : 'Total'}</th>
                    <th className="text-right">{isAr ? 'نسبة الحضور' : 'Show Rate'}</th>
                  </tr></thead>
                  <tbody>
                    {data.byLocation.length === 0 && <tr><td colSpan={3} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                    {data.byLocation.map((r) => (
                      <tr key={r.location}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.location}</td>
                        <td className="text-right tabular-nums">{r.total}</td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct(r.showRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSection>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: Revenue by Location ──────────────────────────────────────────────────

function RevenueByLocationTab() {
  const { isAr } = useLang();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [data, setData]         = useState<RevenueByLocationData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo)   qs.set('dateTo', dateTo);
      setData(await apiFetch<RevenueByLocationData>(`/reports/revenue-by-location?${qs}`));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  function getKpis(): KpiItem[] {
    if (!data) return [];
    return [
      { label: isAr ? 'إجمالي الإيرادات' : 'Total Revenue',   value: egp(data.totalRevenue) },
      { label: isAr ? 'إجمالي الصفقات' : 'Total Deals',       value: String(data.totalDeals) },
      { label: isAr ? 'متوسط قيمة الصفقة' : 'Avg Deal Value', value: egp(data.avgDealValue) },
      { label: isAr ? 'أفضل فرع' : 'Top Location',            value: data.topLocation },
    ];
  }
  function getTables(): TableSheet[] {
    if (!data) return [];
    return [{
      title:   'Revenue by Location',
      headers: ['Location', 'Deals', 'Total Revenue (EGP)', 'Avg Deal Value (EGP)', 'Cash', 'Installment', 'Bank Financing'],
      rows:    data.byLocation.map((r) => [r.location, r.dealCount, egp(r.totalRevenue), egp(r.avgDealValue), r.cash, r.installment, r.bankFinancing]),
    }];
  }

  return (
    <div>
      <FilterBar
        isAr={isAr} loading={loading} hasData={!!data}
        locationId="" onLocation={() => {}}
        dateFrom={dateFrom} onDateFrom={setDateFrom}
        dateTo={dateTo} onDateTo={setDateTo}
        onGenerate={generate} noLocation
        onExcel={() => exportToExcel('revenue-by-location', isAr ? 'الإيرادات بالفرع' : 'Revenue by Location', getKpis(), getTables())}
        onPdf={()   => exportToPdf('revenue-by-location',  isAr ? 'الإيرادات بالفرع' : 'Revenue by Location', getKpis(), getTables())}
      />
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <ErrorBanner error={error} retry={generate} />}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-3">
              {getKpis().map((k) => <KpiCard key={k.label} label={k.label} value={k.value} />)}
            </div>
            <TableSection title={isAr ? 'الإيرادات حسب الفرع' : 'Revenue by Location'}>
              <table className="data-table">
                <thead><tr>
                  <th>{isAr ? 'الفرع' : 'Location'}</th>
                  <th className="text-right">{isAr ? 'الصفقات' : 'Deals'}</th>
                  <th className="text-right">{isAr ? 'إجمالي الإيرادات' : 'Total Revenue'}</th>
                  <th className="text-right">{isAr ? 'متوسط الصفقة' : 'Avg Deal'}</th>
                  <th className="text-right">{isAr ? 'نقداً' : 'Cash'}</th>
                  <th className="text-right">{isAr ? 'تقسيط' : 'Installment'}</th>
                  <th className="text-right">{isAr ? 'بنكي' : 'Bank'}</th>
                </tr></thead>
                <tbody>
                  {data.byLocation.length === 0 && <tr><td colSpan={7} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                  {data.byLocation.map((r, i) => (
                    <tr key={r.location}>
                      <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>
                        {i === 0 && <span className="badge badge-success mr-2">#1</span>}
                        {r.location}
                      </td>
                      <td className="text-right tabular-nums">{r.dealCount}</td>
                      <td className="text-right tabular-nums font-semibold" style={{ color: 'var(--primary)' }}>{egp(r.totalRevenue)}</td>
                      <td className="text-right tabular-nums">{egp(r.avgDealValue)}</td>
                      <td className="text-right tabular-nums">{r.cash}</td>
                      <td className="text-right tabular-nums">{r.installment}</td>
                      <td className="text-right tabular-nums">{r.bankFinancing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableSection>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: Service Performance ──────────────────────────────────────────────────

function ServicePerformanceTab() {
  const { isAr } = useLang();
  const [locationId, setLocationId] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [data, setData]             = useState<ServicePerformanceData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo', dateTo);
      setData(await apiFetch<ServicePerformanceData>(`/reports/service-performance?${qs}`));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  function getKpis(): KpiItem[] {
    if (!data) return [];
    return [
      { label: isAr ? 'إجمالي الأوامر' : 'Total Orders',           value: String(data.total) },
      { label: isAr ? 'مكتملة' : 'Completed',                      value: String(data.completed) },
      { label: isAr ? 'إجمالي الإيرادات' : 'Total Revenue',        value: egp(data.totalRevenue) },
      { label: isAr ? 'متوسط وقت التسليم' : 'Avg Turnaround',      value: `${data.avgTurnaroundDays} days` },
    ];
  }
  function getTables(): TableSheet[] {
    if (!data) return [];
    return [
      { title: 'By Status',     headers: ['Status', 'Orders', 'Revenue (EGP)'],          rows: data.byStatus.map((r) => [r.status, r.count, egp(r.revenue)]) },
      { title: 'By Technician', headers: ['Technician', 'Orders', 'Revenue', 'Labor'],   rows: data.byTechnician.map((r) => [r.technician, r.orders, egp(r.revenue), egp(r.labor)]) },
    ];
  }

  return (
    <div>
      <FilterBar
        isAr={isAr} loading={loading} hasData={!!data}
        locationId={locationId} onLocation={setLocationId}
        dateFrom={dateFrom} onDateFrom={setDateFrom}
        dateTo={dateTo} onDateTo={setDateTo}
        onGenerate={generate}
        onExcel={() => exportToExcel('service-performance', isAr ? 'أداء الصيانة' : 'Service Performance', getKpis(), getTables())}
        onPdf={()   => exportToPdf('service-performance',  isAr ? 'أداء الصيانة' : 'Service Performance', getKpis(), getTables())}
      />
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <ErrorBanner error={error} retry={generate} />}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-3">
              {getKpis().map((k) => <KpiCard key={k.label} label={k.label} value={k.value} />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TableSection title={isAr ? 'حسب الحالة' : 'Orders by Status'}>
                <table className="data-table">
                  <thead><tr>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="text-right">{isAr ? 'العدد' : 'Orders'}</th>
                    <th className="text-right">{isAr ? 'الإيرادات' : 'Revenue'}</th>
                  </tr></thead>
                  <tbody>
                    {data.byStatus.length === 0 && <tr><td colSpan={3} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                    {data.byStatus.map((r) => (
                      <tr key={r.status}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.status}</td>
                        <td className="text-right tabular-nums">{r.count}</td>
                        <td className="text-right tabular-nums">{egp(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSection>

              <TableSection title={isAr ? 'حسب الفني' : 'By Technician'}>
                <table className="data-table">
                  <thead><tr>
                    <th>{isAr ? 'الفني' : 'Technician'}</th>
                    <th className="text-right">{isAr ? 'الأوامر' : 'Orders'}</th>
                    <th className="text-right">{isAr ? 'الإيرادات' : 'Revenue'}</th>
                    <th className="text-right">{isAr ? 'العمالة' : 'Labor'}</th>
                  </tr></thead>
                  <tbody>
                    {data.byTechnician.length === 0 && <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                    {data.byTechnician.map((r) => (
                      <tr key={r.technician}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.technician}</td>
                        <td className="text-right tabular-nums">{r.orders}</td>
                        <td className="text-right tabular-nums">{egp(r.revenue)}</td>
                        <td className="text-right tabular-nums">{egp(r.labor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSection>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: Commissions Summary ──────────────────────────────────────────────────

function CommissionsSummaryTab() {
  const { isAr } = useLang();
  const [locationId, setLocationId] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [data, setData]             = useState<CommissionsSummaryData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo', dateTo);
      setData(await apiFetch<CommissionsSummaryData>(`/reports/commissions-summary?${qs}`));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  function getKpis(): KpiItem[] {
    if (!data) return [];
    return [
      { label: isAr ? 'مستحقة (مرحّلة)' : 'Total Accrued',    value: egp(data.totalAccrued) },
      { label: isAr ? 'واجبة الدفع' : 'Total Payable',         value: egp(data.totalPayable) },
      { label: isAr ? 'مدفوعة' : 'Total Paid',                 value: egp(data.totalPaid) },
      { label: isAr ? 'معاملات معلقة' : 'Pending Transactions', value: String(data.pendingCount) },
    ];
  }
  function getTables(): TableSheet[] {
    if (!data) return [];
    return [{
      title:   'Commission by Rep',
      headers: ['Rep', 'Accrued (EGP)', 'Payable (EGP)', 'Paid (EGP)', 'Total (EGP)'],
      rows:    data.byRep.map((r) => [r.repName, egp(r.accrued), egp(r.payable), egp(r.paid), egp(r.total)]),
    }];
  }

  return (
    <div>
      <FilterBar
        isAr={isAr} loading={loading} hasData={!!data}
        locationId={locationId} onLocation={setLocationId}
        dateFrom={dateFrom} onDateFrom={setDateFrom}
        dateTo={dateTo} onDateTo={setDateTo}
        onGenerate={generate}
        onExcel={() => exportToExcel('commissions-summary', isAr ? 'ملخص العمولات' : 'Commissions Summary', getKpis(), getTables())}
        onPdf={()   => exportToPdf('commissions-summary',  isAr ? 'ملخص العمولات' : 'Commissions Summary', getKpis(), getTables())}
      />
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <ErrorBanner error={error} retry={generate} />}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-3">
              <KpiCard label={isAr ? 'مستحقة (مرحّلة)' : 'Total Accrued'} value={egp(data.totalAccrued)} accent="var(--warning)" />
              <KpiCard label={isAr ? 'واجبة الدفع' : 'Total Payable'}     value={egp(data.totalPayable)} accent="var(--primary)" />
              <KpiCard label={isAr ? 'مدفوعة' : 'Total Paid'}             value={egp(data.totalPaid)}    accent="var(--success)" />
              <KpiCard label={isAr ? 'معاملات معلقة' : 'Pending'}          value={String(data.pendingCount)} />
            </div>
            <TableSection title={isAr ? 'العمولات حسب المندوب' : 'Commission by Sales Rep'}>
              <table className="data-table">
                <thead><tr>
                  <th>{isAr ? 'المندوب' : 'Rep'}</th>
                  <th className="text-right">{isAr ? 'مستحقة' : 'Accrued'}</th>
                  <th className="text-right">{isAr ? 'واجبة الدفع' : 'Payable'}</th>
                  <th className="text-right">{isAr ? 'مدفوعة' : 'Paid'}</th>
                  <th className="text-right">{isAr ? 'الإجمالي' : 'Total'}</th>
                </tr></thead>
                <tbody>
                  {data.byRep.length === 0 && <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                  {data.byRep.map((r) => (
                    <tr key={r.repName}>
                      <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.repName}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--warning)' }}>{egp(r.accrued)}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--primary)' }}>{egp(r.payable)}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--success)' }}>{egp(r.paid)}</td>
                      <td className="text-right tabular-nums font-semibold">{egp(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableSection>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: Installment Collections ──────────────────────────────────────────────

function InstallmentCollectionsTab() {
  const { isAr } = useLang();
  const [locationId, setLocationId] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [data, setData]             = useState<InstallmentCollectionsData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function generate() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (locationId) qs.set('locationId', locationId);
      if (dateFrom)   qs.set('dateFrom', dateFrom);
      if (dateTo)     qs.set('dateTo', dateTo);
      setData(await apiFetch<InstallmentCollectionsData>(`/reports/installment-collections?${qs}`));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  function getKpis(): KpiItem[] {
    if (!data) return [];
    return [
      { label: isAr ? 'إجمالي المجدول' : 'Total Scheduled',    value: egp(data.totalScheduled) },
      { label: isAr ? 'إجمالي المحصّل' : 'Total Collected',    value: egp(data.totalCollected) },
      { label: isAr ? 'نسبة التحصيل' : 'Collection Rate',      value: pct(data.collectionRate) },
      { label: isAr ? 'أقساط متأخرة' : 'Overdue Installments', value: String(data.overdueCount) },
      { label: isAr ? 'المبلغ المتأخر' : 'Overdue Amount',     value: egp(data.overdueAmount) },
    ];
  }
  function getTables(): TableSheet[] {
    if (!data) return [];
    return [{
      title:   'Overdue Installments',
      headers: ['Customer', 'Vehicle', 'Installment #', 'Due Date', 'Total Due (EGP)', 'Paid (EGP)', 'Outstanding (EGP)', 'Days Overdue'],
      rows:    data.overdue.map((r) => [r.customer, r.vehicle, `#${r.installmentNumber}`, r.dueDate, egp(r.totalDue), egp(r.paidAmount), egp(r.outstanding), r.daysOverdue]),
    }];
  }

  return (
    <div>
      <FilterBar
        isAr={isAr} loading={loading} hasData={!!data}
        locationId={locationId} onLocation={setLocationId}
        dateFrom={dateFrom} onDateFrom={setDateFrom}
        dateTo={dateTo} onDateTo={setDateTo}
        onGenerate={generate}
        onExcel={() => exportToExcel('installment-collections', isAr ? 'تحصيل الأقساط' : 'Installment Collections', getKpis(), getTables())}
        onPdf={()   => exportToPdf('installment-collections',  isAr ? 'تحصيل الأقساط' : 'Installment Collections', getKpis(), getTables())}
      />
      <div className="px-6 py-5 space-y-5">
        {loading && <Spinner isAr={isAr} />}
        {error   && <ErrorBanner error={error} retry={generate} />}
        {!loading && !error && !data && <EmptyState onGenerate={generate} isAr={isAr} />}
        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-3">
              <KpiCard label={isAr ? 'إجمالي المجدول' : 'Total Scheduled'}    value={egp(data.totalScheduled)} />
              <KpiCard label={isAr ? 'إجمالي المحصّل' : 'Total Collected'}    value={egp(data.totalCollected)} accent="var(--success)" />
              <KpiCard label={isAr ? 'نسبة التحصيل' : 'Collection Rate'}      value={pct(data.collectionRate)} />
              <KpiCard label={isAr ? 'أقساط متأخرة' : 'Overdue Installments'} value={String(data.overdueCount)} accent="var(--danger)" />
              <KpiCard label={isAr ? 'المبلغ المتأخر' : 'Overdue Amount'}     value={egp(data.overdueAmount)} accent="var(--danger)" />
            </div>

            {data.overdue.length === 0 ? (
              <div className="card p-8 text-center" style={{ color: 'var(--success)' }}>
                <p className="font-semibold">{isAr ? 'لا توجد أقساط متأخرة ✓' : 'No overdue installments ✓'}</p>
              </div>
            ) : (
              <TableSection title={isAr ? 'الأقساط المتأخرة' : 'Overdue Installments'}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: 800 }}>
                    <thead><tr>
                      <th>{isAr ? 'العميل' : 'Customer'}</th>
                      <th>{isAr ? 'المركبة' : 'Vehicle'}</th>
                      <th className="text-center">{isAr ? 'رقم القسط' : '#'}</th>
                      <th>{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                      <th className="text-right">{isAr ? 'المبلغ' : 'Total Due'}</th>
                      <th className="text-right">{isAr ? 'المدفوع' : 'Paid'}</th>
                      <th className="text-right">{isAr ? 'المتبقي' : 'Outstanding'}</th>
                      <th className="text-right">{isAr ? 'أيام التأخر' : 'Days'}</th>
                    </tr></thead>
                    <tbody>
                      {data.overdue.map((r) => (
                        <tr key={r.id}>
                          <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.customer}</td>
                          <td style={{ color: 'var(--text-2)' }}>{r.vehicle}</td>
                          <td className="text-center tabular-nums" style={{ color: 'var(--text-3)' }}>#{r.installmentNumber}</td>
                          <td style={{ color: 'var(--text-2)' }}>{r.dueDate}</td>
                          <td className="text-right tabular-nums">{egp(r.totalDue)}</td>
                          <td className="text-right tabular-nums" style={{ color: 'var(--success)' }}>{egp(r.paidAmount)}</td>
                          <td className="text-right tabular-nums font-semibold" style={{ color: 'var(--danger-fg)' }}>{egp(r.outstanding)}</td>
                          <td className="text-right tabular-nums" style={{ color: r.daysOverdue > 30 ? 'var(--danger-fg)' : 'var(--warning)', fontWeight: 600 }}>{r.daysOverdue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableSection>
            )}
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
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'التقارير التشغيلية' : 'Operational Reports'}</h1>
          <p className="page-subtitle">{isAr ? 'مبيعات · مخزن · عملاء · مواعيد · إيرادات · صيانة · عمولات · أقساط' : 'Sales · Inventory · Leads · Appointments · Revenue · Service · Commissions · Installments'}</p>
        </div>
      </div>

      <div className="px-6 mt-2" style={{ overflowX: 'auto' }}>
        <div className="tabs" style={{ flexWrap: 'nowrap', minWidth: 'max-content' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`tab ${tab === t.key ? 'active' : ''}`}>
              {isAr ? t.labelAr : t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'sales-pipeline'          && <SalesPipelineTab />}
      {tab === 'inventory-aging'         && <InventoryAgingTab />}
      {tab === 'lead-conversion'         && <LeadConversionTab />}
      {tab === 'appointment-analytics'   && <AppointmentAnalyticsTab />}
      {tab === 'revenue-by-location'     && <RevenueByLocationTab />}
      {tab === 'service-performance'     && <ServicePerformanceTab />}
      {tab === 'commissions-summary'     && <CommissionsSummaryTab />}
      {tab === 'installment-collections' && <InstallmentCollectionsTab />}
    </div>
  );
}
