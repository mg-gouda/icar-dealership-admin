'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../lib/useApi';
import { canViewField } from '../../../lib/fieldPermissions';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import { useLang } from '../../../lib/lang-context';

interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string;
  salePrice: number;
  price: number;
  acquisitionCost?: number;
  cost?: number;
  overprice?: number;
  bodyType: string;
  condition: string;
  status: string;
  mileage: number;
  fuelType?: string;
  daysInStock?: number;
  createdAt?: string;
  thumbnailUrl?: string;
  stockNumber?: string;
  location?: { name: string };
  accreditedDealer?: { name: string };
  images?: { url: string }[];
}


const fmt = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'AVAILABLE': return 'badge badge-success';
    case 'RESERVED': return 'badge badge-info';
    case 'SOLD': return 'badge badge-neutral';
    case 'IN_TRANSIT': return 'badge badge-warning';
    case 'PENDING_INSPECTION': return 'badge badge-orange';
    default: return 'badge badge-neutral';
  }
}

function statusLabel(status: string, isAr: boolean): string {
  if (isAr) {
    const map: Record<string, string> = {
      AVAILABLE: 'متوفر', RESERVED: 'محجوز', SOLD: 'مباع',
      IN_TRANSIT: 'في الطريق', PENDING_INSPECTION: 'قيد الفحص', INACTIVE: 'غير نشط',
    };
    return map[status] ?? status.replace(/_/g, ' ');
  }
  return status.replace(/_/g, ' ');
}

// ponytail: daysInStock from API field first, fallback to createdAt diff
function computeDaysInStock(v: Vehicle): number | null {
  if (v.daysInStock != null) return v.daysInStock;
  if (v.createdAt) {
    const ms = Date.now() - new Date(v.createdAt).getTime();
    return Math.floor(ms / 86_400_000);
  }
  return null;
}

function agingBadge(days: number | null, isAr: boolean): React.ReactNode {
  if (days == null || days <= 60) return null;
  const cls = days > 90 ? 'badge badge-danger' : 'badge badge-warning';
  const label = days > 90 ? `${days}d ${isAr ? '(متقادم)' : '(aged)'}` : `${days}d`;
  return <span className={cls} style={{ fontSize: '0.625rem', marginLeft: '0.25rem' }}>{label}</span>;
}

const PAGE_SIZE = 25;

export default function VehiclesPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const STATUS_OPTIONS = [
    { value: 'AVAILABLE', label: isAr ? 'متوفر' : 'Available' },
    { value: 'RESERVED', label: isAr ? 'محجوز' : 'Reserved' },
    { value: 'SOLD', label: isAr ? 'مباع' : 'Sold' },
    { value: 'IN_TRANSIT', label: isAr ? 'في الطريق' : 'In Transit' },
    { value: 'PENDING_INSPECTION', label: isAr ? 'قيد الفحص' : 'Pending Inspection' },
  ];
  const PRICE_RANGE_OPTIONS = [
    { value: '0-500000', label: isAr ? 'أقل من 500 ألف' : 'Under EGP 500K' },
    { value: '500000-1000000', label: isAr ? '500 ألف – مليون' : 'EGP 500K – 1M' },
    { value: '1000000-2000000', label: isAr ? 'مليون – 2 مليون' : 'EGP 1M – 2M' },
    { value: '2000000-', label: isAr ? 'أكثر من 2 مليون' : 'Above EGP 2M' },
  ];
  const AGING_OPTIONS = [
    { value: '30', label: isAr ? 'أكثر من 30 يوم' : '> 30 days' },
    { value: '60', label: isAr ? 'أكثر من 60 يوم' : '> 60 days' },
    { value: '90', label: isAr ? 'أكثر من 90 يوم' : '> 90 days' },
  ];

  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dealerFilter, setDealerFilter] = useState('');
  const [makeFilter, setMakeFilter] = useState('');
  const [bodyTypeFilter, setBodyTypeFilter] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [fuelTypeFilter, setFuelTypeFilter] = useState('');
  const [agingFilter, setAgingFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    ...(makeFilter && { make: makeFilter }),
    ...(bodyTypeFilter && { bodyType: bodyTypeFilter }),
    ...(fuelTypeFilter && { fuelType: fuelTypeFilter }),
    ...(dealerFilter && { accreditedDealerId: dealerFilter }),
    page: String(page),
    limit: String(PAGE_SIZE),
  });

  const { data: res, loading, error, reload } = useQuery<{
    items: Vehicle[];
    total: number;
    page: number;
    limit: number;
  }>(`/vehicles?${params}`, [search, statusFilter, makeFilter, bodyTypeFilter, fuelTypeFilter, dealerFilter, page]);

  const { data: locationsRaw } = useQuery<{ id: string; name: string }[]>('/locations');
  const locationOptions = (Array.isArray(locationsRaw) ? locationsRaw : []).map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const { data: rawDealers } = useQuery<{id:string;name:string}[]>('/accredited-dealers');
  const dealers = Array.isArray(rawDealers) ? rawDealers : [];

  type LI = { id: string; value: string; label: string; labelAr?: string };
  const { data: rawMakeOpts }     = useQuery<LI[]>('/lookup-items?category=car_make');
  const { data: rawBodyOpts }     = useQuery<LI[]>('/lookup-items?category=body_type');
  const { data: rawFuelOpts }     = useQuery<LI[]>('/lookup-items?category=fuel_type');
  const toLookupOpts = (r: LI[] | null | undefined) => (Array.isArray(r) ? r : []).map((i) => ({ value: i.value, label: isAr ? (i.labelAr || i.label) : i.label }));
  const MAKE_OPTIONS      = toLookupOpts(rawMakeOpts);
  const BODY_TYPE_OPTIONS = toLookupOpts(rawBodyOpts);
  const FUEL_TYPE_OPTIONS = toLookupOpts(rawFuelOpts);

  const rawVehicles = res?.items ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  // ponytail: aging filter is client-side (API doesn't expose daysInStock filter)
  const vehicles = agingFilter
    ? rawVehicles.filter((v) => {
        const days = computeDaysInStock(v);
        return days != null && days > Number(agingFilter);
      })
    : rawVehicles;

  const canSeeCost = canViewField('Vehicle', 'cost');

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImporting(true);
    setImportResult(null);
    try {
      const r = await apiFetch<{ created: number; errors: { row: number; error: string }[] }>(
        '/vehicles/bulk-import',
        { method: 'POST', body: JSON.stringify({ csv: text }) },
      );
      setImportResult(r);
      if (r.created > 0) reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function resetFilters() {
    setSearch('');
    setLocationFilter('');
    setStatusFilter('');
    setMakeFilter('');
    setBodyTypeFilter('');
    setPriceRange('');
    setFuelTypeFilter('');
    setAgingFilter('');
    setDealerFilter('');
    setPage(1);
  }

  const hasFilters = search || locationFilter || statusFilter || makeFilter || bodyTypeFilter || priceRange || fuelTypeFilter || agingFilter || dealerFilter;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'إدارة المخزن' : 'Inventory Management'}</h1>
          <p className="page-subtitle">{isAr ? 'إدارة جميع السيارات في المخزن' : 'Manage all vehicles in stock'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* View mode toggle */}
          <div style={{
            display: 'flex',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            overflow: 'hidden',
          }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setViewMode('table')}
              title={isAr ? 'عرض جدول' : 'Table view'}
              style={{
                borderRadius: 0,
                background: viewMode === 'table' ? 'var(--primary)' : undefined,
                color: viewMode === 'table' ? 'var(--primary-fg)' : undefined,
                border: 'none',
                padding: '0.35rem 0.6rem',
              }}
            >
              <TableIcon />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setViewMode('grid')}
              title={isAr ? 'عرض شبكة' : 'Grid view'}
              style={{
                borderRadius: 0,
                background: viewMode === 'grid' ? 'var(--primary)' : undefined,
                color: viewMode === 'grid' ? 'var(--primary-fg)' : undefined,
                border: 'none',
                padding: '0.35rem 0.6rem',
              }}
            >
              <GridIcon />
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {importing ? (isAr ? 'جارٍ الاستيراد…' : 'Importing…') : (isAr ? 'استيراد مجمّع' : 'Bulk Import')}
          </button>
          <Link href="/vehicles/new" className="btn btn-primary btn-sm">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {isAr ? 'إضافة مركبة' : 'Add Vehicle'}
          </Link>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Import result banner */}
        {importResult && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            background: importResult.errors.length ? 'var(--warning-bg)' : 'var(--success-bg)',
            color: importResult.errors.length ? 'var(--warning-fg)' : 'var(--success-fg)',
            border: `1px solid ${importResult.errors.length ? 'var(--warning)' : 'var(--success)'}`,
            opacity: 0.9,
          }}>
            <p style={{ fontWeight: 600, marginBottom: importResult.errors.length ? '0.25rem' : 0 }}>
              {isAr
                ? `تم استيراد ${importResult.created} ${importResult.created !== 1 ? 'سيارات' : 'سيارة'}${importResult.errors.length ? ` · فشل ${importResult.errors.length} ${importResult.errors.length !== 1 ? 'صفوف' : 'صف'}` : ' بنجاح.'}`
                : `${importResult.created} vehicle${importResult.created !== 1 ? 's' : ''} imported${importResult.errors.length ? ` · ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : ' successfully.'}`}
            </p>
            {importResult.errors.map((e) => (
              <p key={e.row} style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                {isAr ? 'الصف' : 'Row'} {e.row}: {e.error}
              </p>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
            <svg
              width="14" height="14" viewBox="0 0 16 16" fill="none"
              style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={isAr ? 'بحث برقم الشاسيه، الشركة، الطراز…' : 'Search VIN, make, model…'}
              className="input"
              style={{ paddingLeft: '2rem' }}
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <SearchableCombobox
              options={locationOptions}
              value={locationFilter}
              onChange={(v) => { setLocationFilter(v); setPage(1); }}
              placeholder={isAr ? 'كل الفروع' : 'All Locations'}
              clearable
              clearLabel={isAr ? 'كل الفروع' : 'All Locations'}
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <SearchableCombobox
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              placeholder={isAr ? 'كل الحالات' : 'All Statuses'}
              clearable
              clearLabel={isAr ? 'كل الحالات' : 'All Statuses'}
            />
          </div>

          <div style={{ minWidth: '130px' }}>
            <SearchableCombobox
              options={MAKE_OPTIONS}
              value={makeFilter}
              onChange={(v) => { setMakeFilter(v); setPage(1); }}
              placeholder={isAr ? 'كل الشركات' : 'All Makes'}
              clearable
              clearLabel={isAr ? 'كل الشركات' : 'All Makes'}
            />
          </div>

          <div style={{ minWidth: '130px' }}>
            <SearchableCombobox
              options={BODY_TYPE_OPTIONS}
              value={bodyTypeFilter}
              onChange={(v) => { setBodyTypeFilter(v); setPage(1); }}
              placeholder={isAr ? 'نوع الشاسيه' : 'Body Type'}
              clearable
              clearLabel={isAr ? 'كل الأنواع' : 'All Types'}
            />
          </div>

          <div style={{ minWidth: '130px' }}>
            <SearchableCombobox
              options={FUEL_TYPE_OPTIONS}
              value={fuelTypeFilter}
              onChange={(v) => { setFuelTypeFilter(v); setPage(1); }}
              placeholder={isAr ? 'نوع الوقود' : 'Fuel Type'}
              clearable
              clearLabel={isAr ? 'كل أنواع الوقود' : 'All Fuels'}
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <SearchableCombobox
              options={AGING_OPTIONS}
              value={agingFilter}
              onChange={(v) => { setAgingFilter(v); setPage(1); }}
              placeholder={isAr ? 'أيام في المخزن' : 'Days in Stock'}
              clearable
              clearLabel={isAr ? 'كل الفترات' : 'All Ages'}
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <SearchableCombobox
              options={PRICE_RANGE_OPTIONS}
              value={priceRange}
              onChange={(v) => { setPriceRange(v); setPage(1); }}
              placeholder={isAr ? 'نطاق السعر' : 'Price Range'}
              clearable
              clearLabel={isAr ? 'أي سعر' : 'Any Price'}
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <SearchableCombobox
              options={[
                { value: '', label: isAr ? 'جميع الوكلاء' : 'All Dealers' },
                ...dealers.map(d => ({ value: d.id, label: d.name }))
              ]}
              value={dealerFilter}
              onChange={(v) => { setDealerFilter(v); setPage(1); }}
              placeholder={isAr ? 'الوكيل' : 'Dealer'}
              clearable
              clearLabel={isAr ? 'جميع الوكلاء' : 'All Dealers'}
            />
          </div>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              {isAr ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
        </div>

        {/* Loading / error */}
        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
            {isAr ? 'جارٍ تحميل السيارات…' : 'Loading vehicles…'}
          </div>
        )}

        {error && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)', fontSize: '0.8125rem' }}>
            {error}
          </div>
        )}

        {/* ── Table view ─────────────────────────────────────────────── */}
        {!loading && !error && viewMode === 'table' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '3.5rem' }}></th>
                  <th>{isAr ? 'رقم الشاسيه' : 'VIN'}</th>
                  <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                  <th>{isAr ? 'السنة' : 'Year'}</th>
                  <th>{isAr ? 'اللون' : 'Color'}</th>
                  <th style={{ textAlign: 'right' }}>
                    {canSeeCost ? (isAr ? 'السعر الرسمي للوكيل (ج.م)' : 'Official Price (EGP)') : (isAr ? 'السعر الرسمي' : 'Official Price')}
                  </th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'أوفر برايس (ج.م)' : 'Overprice (EGP)'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'أيام في المخزن' : 'Days In Stock'}</th>
                  <th>{isAr ? 'الفرع' : 'Location'}</th>
                  <th>{isAr ? 'الوكيل' : 'Dealer'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      {hasFilters
                        ? (isAr ? 'لا توجد مركبات تطابق الفلاتر الحالية.' : 'No vehicles match the current filters.')
                        : (isAr ? 'لا توجد مركبات. أضف أول مركبة.' : 'No vehicles found. Add your first vehicle.')}
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => {
                    const price = v.salePrice ?? v.price ?? 0;
                    const cost = v.acquisitionCost ?? v.cost;
                    const days = computeDaysInStock(v);
                    return (
                      <tr
                        key={v.id}
                        onClick={() => router.push(`/vehicles/${v.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ padding: '0.375rem 0.75rem' }}>
                          {v.images?.[0]?.url ? (
                            <img
                              src={v.images[0].url}
                              alt=""
                              style={{ width: '2.75rem', height: '2.25rem', objectFit: 'cover', borderRadius: '0.25rem', display: 'block', background: 'var(--surface-2)' }}
                            />
                          ) : (
                            <div style={{ width: '2.75rem', height: '2.25rem', borderRadius: '0.25rem', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-3)' }}>
                                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                              </svg>
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-2)' }}>
                            {v.vin
                              ? (v.vin.length > 12 ? v.vin.slice(0, 12) + '…' : v.vin)
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>
                            {v.year} {v.make} {v.model}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{v.year}</td>
                        <td style={{ color: 'var(--text-2)' }}>{v.color || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--text-1)' }}>
                          {canSeeCost
                            ? (cost != null ? fmt(cost) : '—')
                            : <span style={{ letterSpacing: '0.15em', color: 'var(--text-3)' }}>···</span>}
                        </td>
                        <td style={{ textAlign: 'right', color: v.overprice ? 'var(--success-fg)' : 'var(--text-3)' }}>
                          {v.overprice ? fmt(Number(v.overprice)) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {days != null ? days : '—'}
                            {agingBadge(days, isAr)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>
                          {v.location?.name ?? '—'}
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>
                          {v.accreditedDealer?.name ?? '—'}
                        </td>
                        <td>
                          <span className={statusBadgeClass(v.status)}>
                            {statusLabel(v.status, isAr)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link
                            href={`/vehicles/${v.id}`}
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'var(--primary)' }}
                          >
                            {isAr ? 'تعديل' : 'Edit'}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {total > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderTop: '1px solid var(--border)',
                fontSize: '0.8125rem',
                color: 'var(--text-3)',
              }}>
                <span>
                  {isAr ? `عرض ${showingFrom}–${showingTo} من ${total} مركبة` : `Showing ${showingFrom}–${showingTo} of ${total} vehicles`}
                </span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {isAr ? 'السابق' : 'Previous'}
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 7) {
                      p = i + 1;
                    } else if (page <= 4) {
                      p = i + 1;
                    } else if (page >= totalPages - 3) {
                      p = totalPages - 6 + i;
                    } else {
                      p = page - 3 + i;
                    }
                    return (
                      <button
                        key={p}
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPage(p)}
                        style={{
                          minWidth: '2rem',
                          background: p === page ? 'var(--primary)' : undefined,
                          color: p === page ? 'var(--primary-fg)' : undefined,
                          fontWeight: p === page ? 600 : undefined,
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {isAr ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Grid view ──────────────────────────────────────────────── */}
        {!loading && !error && viewMode === 'grid' && (
          <>
            {vehicles.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
                {hasFilters ? (isAr ? 'لا توجد مركبات تطابق الفلاتر الحالية.' : 'No vehicles match the current filters.') : (isAr ? 'لا توجد مركبات. أضف أول مركبة.' : 'No vehicles found. Add your first vehicle.')}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
              }}
                className="vehicles-grid"
              >
                {vehicles.map((v) => {
                  const price = v.salePrice ?? v.price ?? 0;
                  const days = computeDaysInStock(v);
                  return (
                    <VehicleCard
                      key={v.id}
                      vehicle={v}
                      price={price}
                      days={days}
                      onView={() => router.push(`/vehicles/${v.id}`)}
                      onEdit={() => router.push(`/vehicles/${v.id}`)}
                      onQuickSell={() => router.push(`/deals/new?vehicleId=${v.id}`)}
                    />
                  );
                })}
              </div>
            )}

            {/* Grid pagination */}
            {total > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0',
                fontSize: '0.8125rem',
                color: 'var(--text-3)',
              }}>
                <span>{isAr ? `عرض ${showingFrom}–${showingTo} من ${total} مركبة` : `Showing ${showingFrom}–${showingTo} of ${total} vehicles`}</span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {isAr ? 'السابق' : 'Previous'}
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    {isAr ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media (min-width: 1024px) { .vehicles-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (min-width: 1280px) { .vehicles-grid { grid-template-columns: repeat(4, 1fr) !important; } }
        .vehicle-card-actions { opacity: 0; pointer-events: none; transition: opacity 150ms; }
        .vehicle-card:hover .vehicle-card-actions { opacity: 1; pointer-events: auto; }
      `}</style>
    </div>
  );
}

/* ── Vehicle grid card ──────────────────────────────────────────────────── */
function VehicleCard({
  vehicle: v, price, days, onView, onEdit, onQuickSell,
}: {
  vehicle: Vehicle;
  price: number;
  days: number | null;
  onView: () => void;
  onEdit: () => void;
  onQuickSell: () => void;
}) {
  const { isAr } = useLang();
  return (
    <div
      className="card vehicle-card"
      onClick={onView}
      style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative' }}
    >
      {/* Thumbnail */}
      <div style={{
        aspectRatio: '16/9',
        background: 'var(--surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {v.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.thumbnailUrl}
            alt={`${v.make} ${v.model}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <CarIcon />
        )}

        {/* Status badge overlay */}
        <span
          className={statusBadgeClass(v.status)}
          style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', fontSize: '0.625rem' }}
        >
          {statusLabel(v.status, isAr)}
        </span>

        {/* Aging badge overlay */}
        {days != null && days > 60 && (
          <span
            className={days > 90 ? 'badge badge-danger' : 'badge badge-warning'}
            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', fontSize: '0.625rem' }}
          >
            {days}d
          </span>
        )}

        {/* Hover quick-action overlay */}
        <div
          className="vehicle-card-actions"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn btn-sm"
            onClick={onView}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)' }}
          >
            {isAr ? 'عرض' : 'View'}
          </button>
          <button
            className="btn btn-sm"
            onClick={onEdit}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)' }}
          >
            {isAr ? 'تعديل' : 'Edit'}
          </button>
          <button
            className="btn btn-sm"
            onClick={onQuickSell}
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none' }}
          >
            {isAr ? 'بيع سريع' : 'Quick-sell'}
          </button>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '0.75rem 1rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '0.2rem', lineHeight: 1.3 }}>
          {v.year} {v.make} {v.model}
        </p>
        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.4rem' }}>
          {v.price != null || v.salePrice != null ? `EGP ${price.toLocaleString('en-EG', { maximumFractionDigits: 0 })}` : '—'}
        </p>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
          {v.stockNumber ? `#${v.stockNumber} · ` : ''}{v.vin ? v.vin.slice(0, 12) + '…' : '—'}
        </p>
        {v.accreditedDealer && (
          <span className="text-xs" style={{ color: 'var(--text-3)', fontSize: '0.6875rem' }}>
            {isAr ? 'الوكيل:' : 'Dealer:'} {v.accreditedDealer.name}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────── */
function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="1" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="6" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="11" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

function CarIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ color: 'var(--text-3)' }}>
      <path d="M8 30V22l4-10h24l4 10v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="6" y="28" width="36" height="10" rx="3" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="13" cy="38" r="3" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="35" cy="38" r="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 22h24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
