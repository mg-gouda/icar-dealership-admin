'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../lib/useApi';
import { canViewField } from '../../../lib/fieldPermissions';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string;
  salePrice: number;
  price: number; // API may return either field name
  acquisitionCost?: number;
  cost?: number;
  bodyType: string;
  condition: string;
  status: string;
  mileage: number;
  daysInStock?: number;
  location?: { name: string };
}

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'PENDING_INSPECTION', label: 'Pending Inspection' },
];

const MAKE_OPTIONS = [
  'Toyota', 'Hyundai', 'Kia', 'Chevrolet', 'Mercedes-Benz',
  'BMW', 'Volkswagen', 'Nissan', 'Honda', 'Ford',
].map((m) => ({ value: m, label: m }));

const BODY_TYPE_OPTIONS = [
  'Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Coupe', 'Convertible', 'Wagon',
].map((b) => ({ value: b, label: b }));

const PRICE_RANGE_OPTIONS = [
  { value: '0-500000', label: 'Under EGP 500K' },
  { value: '500000-1000000', label: 'EGP 500K – 1M' },
  { value: '1000000-2000000', label: 'EGP 1M – 2M' },
  { value: '2000000-', label: 'Above EGP 2M' },
];

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

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

const PAGE_SIZE = 25;

export default function VehiclesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [makeFilter, setMakeFilter] = useState('');
  const [bodyTypeFilter, setBodyTypeFilter] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    ...(makeFilter && { make: makeFilter }),
    ...(bodyTypeFilter && { bodyType: bodyTypeFilter }),
    page: String(page),
    limit: String(PAGE_SIZE),
  });

  const { data: res, loading, error, reload } = useQuery<{
    data: Vehicle[];
    total: number;
    page: number;
    limit: number;
  }>(`/vehicles?${params}`, [search, statusFilter, makeFilter, bodyTypeFilter, page]);

  const { data: locationsRaw } = useQuery<{ id: string; name: string }[]>('/locations');
  const locationOptions = (Array.isArray(locationsRaw) ? locationsRaw : []).map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const vehicles = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  const canSeeCost = canViewField('Vehicle', 'cost');

  // Bulk import
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
    setPage(1);
  }

  const hasFilters = search || locationFilter || statusFilter || makeFilter || bodyTypeFilter || priceRange;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">Manage all vehicles in stock</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            {importing ? 'Importing…' : 'Bulk Import'}
          </button>
          <Link href="/vehicles/new" className="btn btn-primary btn-sm">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Add Vehicle
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
              {importResult.created} vehicle{importResult.created !== 1 ? 's' : ''} imported
              {importResult.errors.length ? ` · ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : ' successfully.'}
            </p>
            {importResult.errors.map((e) => (
              <p key={e.row} style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                Row {e.row}: {e.error}
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
              placeholder="Search VIN, make, model…"
              className="input"
              style={{ paddingLeft: '2rem' }}
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <SearchableCombobox
              options={locationOptions}
              value={locationFilter}
              onChange={(v) => { setLocationFilter(v); setPage(1); }}
              placeholder="All Locations"
              clearable
              clearLabel="All Locations"
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <SearchableCombobox
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              placeholder="All Statuses"
              clearable
              clearLabel="All Statuses"
            />
          </div>

          <div style={{ minWidth: '130px' }}>
            <SearchableCombobox
              options={MAKE_OPTIONS}
              value={makeFilter}
              onChange={(v) => { setMakeFilter(v); setPage(1); }}
              placeholder="All Makes"
              clearable
              clearLabel="All Makes"
            />
          </div>

          <div style={{ minWidth: '130px' }}>
            <SearchableCombobox
              options={BODY_TYPE_OPTIONS}
              value={bodyTypeFilter}
              onChange={(v) => { setBodyTypeFilter(v); setPage(1); }}
              placeholder="Body Type"
              clearable
              clearLabel="All Types"
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <SearchableCombobox
              options={PRICE_RANGE_OPTIONS}
              value={priceRange}
              onChange={(v) => { setPriceRange(v); setPage(1); }}
              placeholder="Price Range"
              clearable
              clearLabel="Any Price"
            />
          </div>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Clear filters
            </button>
          )}
        </div>

        {/* Table card */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
              Loading vehicles…
            </div>
          )}

          {error && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)', fontSize: '0.8125rem' }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>VIN</th>
                  <th>Vehicle</th>
                  <th>Year</th>
                  <th>Color</th>
                  <th style={{ textAlign: 'right' }}>Price (EGP)</th>
                  <th style={{ textAlign: 'right' }}>
                    {canSeeCost ? 'Cost (EGP)' : 'Cost'}
                  </th>
                  <th style={{ textAlign: 'right' }}>Days In Stock</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      {hasFilters
                        ? 'No vehicles match the current filters.'
                        : 'No vehicles found. Add your first vehicle.'}
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => {
                    const price = v.salePrice ?? v.price ?? 0;
                    const cost = v.acquisitionCost ?? v.cost;
                    return (
                      <tr
                        key={v.id}
                        onClick={() => router.push(`/vehicles/${v.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
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
                          {fmt(price)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                          {canSeeCost
                            ? (cost != null ? fmt(cost) : '—')
                            : <span style={{ letterSpacing: '0.15em', color: 'var(--text-3)' }}>···</span>}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                          {v.daysInStock != null ? v.daysInStock : '—'}
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>
                          {v.location?.name ?? '—'}
                        </td>
                        <td>
                          <span className={statusBadgeClass(v.status)}>
                            {statusLabel(v.status)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link
                            href={`/vehicles/${v.id}`}
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'var(--primary)' }}
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {!loading && !error && total > 0 && (
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
                Showing {showingFrom}–{showingTo} of {total} vehicles
              </span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
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
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
