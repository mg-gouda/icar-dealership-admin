'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

interface ServiceOrder {
  id: string;
  orderNumber?: string;
  vehicle?: { make: string; model: string; year: number; licensePlate?: string };
  customer?: { name: string };
  serviceType: string;
  status: string;
  technician?: { name: string };
  total: number;
  createdAt: string;
}

function statusBadgeClass(s: string): string {
  const map: Record<string, string> = {
    INTAKE: 'badge-info',
    IN_PROGRESS: 'badge-warning',
    COMPLETED: 'badge-success',
    INVOICED: 'badge-neutral',
    CANCELLED: 'badge-danger',
  };
  return map[s] ?? 'badge-neutral';
}

export default function ServiceOrdersPage() {
  const router = useRouter();
  const { isAr } = useLang();
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const STATUS_OPTS = [
    { value: '', label: isAr ? 'كل الحالات' : 'All statuses' },
    { value: 'INTAKE', label: isAr ? 'مفتوح' : 'Intake' },
    { value: 'IN_PROGRESS', label: isAr ? 'جاري' : 'In Progress' },
    { value: 'COMPLETED', label: isAr ? 'مكتمل' : 'Completed' },
    { value: 'INVOICED', label: isAr ? 'مُفوتَر' : 'Invoiced' },
    { value: 'CANCELLED', label: isAr ? 'ملغي' : 'Cancelled' },
  ];

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(statusFilter && { status: statusFilter }),
    ...(locationFilter && { locationId: locationFilter }),
    ...(techFilter && { technicianId: techFilter }),
    ...(search && { q: search }),
  });

  const { data, loading, error } = useQuery<{ data: ServiceOrder[]; total: number }>(
    `/service-orders?${qs}`,
    [statusFilter, locationFilter, techFilter, search, page],
  );

  const { data: locationsRaw } = useQuery<any[]>('/locations');
  const { data: usersRaw } = useQuery<any>('/users?limit=100');

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const locationOpts = [
    { value: '', label: isAr ? 'كل المواقع' : 'All locations' },
    ...((Array.isArray(locationsRaw) ? locationsRaw : []).map((l: any) => ({ value: l.id, label: l.name }))),
  ];

  const techOpts = [
    { value: '', label: isAr ? 'كل الفنيين' : 'All technicians' },
    ...((Array.isArray(usersRaw) ? usersRaw : (usersRaw as any)?.data ?? []).map((u: any) => ({ value: u.id, label: u.name }))),
  ];

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'مركز الصيانة' : 'Service Center'}</h1>
          <p className="page-subtitle">
            {isAr ? `${total} أمر صيانة` : `${total} service orders`}
          </p>
        </div>
        <Link href="/service/new" className="btn btn-primary">
          {isAr ? '+ أمر جديد' : '+ New Order'}
        </Link>
      </div>

      {/* Filters */}
      <div style={{ padding: '0 1.5rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder={isAr ? 'بحث عن رقم الأمر أو السيارة…' : 'Search order # or vehicle…'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div style={{ width: 170 }}>
          <SearchableCombobox
            options={STATUS_OPTS}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            placeholder={isAr ? 'كل الحالات' : 'All statuses'}
            clearable
            clearLabel={isAr ? 'كل الحالات' : 'All statuses'}
          />
        </div>
        <div style={{ width: 170 }}>
          <SearchableCombobox
            options={locationOpts}
            value={locationFilter}
            onChange={(v) => { setLocationFilter(v); setPage(1); }}
            placeholder={isAr ? 'كل المواقع' : 'All locations'}
            clearable
            clearLabel={isAr ? 'كل المواقع' : 'All locations'}
          />
        </div>
        <div style={{ width: 180 }}>
          <SearchableCombobox
            options={techOpts}
            value={techFilter}
            onChange={(v) => { setTechFilter(v); setPage(1); }}
            placeholder={isAr ? 'كل الفنيين' : 'All technicians'}
            clearable
            clearLabel={isAr ? 'كل الفنيين' : 'All technicians'}
          />
        </div>
      </div>

      {/* Table */}
      <div className="page-body">
        {loading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>}
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}
        {!loading && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'رقم الأمر' : 'Order #'}</th>
                  <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                  <th>{isAr ? 'العميل' : 'Customer'}</th>
                  <th>{isAr ? 'النوع' : 'Type'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th>{isAr ? 'الميكانيكي' : 'Technician'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/service/${o.id}`)}>
                    <td>
                      <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
                        {o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {o.vehicle ? `${o.vehicle.year} ${o.vehicle.make} ${o.vehicle.model}` : '—'}
                      {o.vehicle?.licensePlate && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                          {o.vehicle.licensePlate}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{o.customer?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{o.serviceType.replace(/_/g, ' ')}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(o.status)}`}>{o.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{o.technician?.name ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                      {fmt(Number(o.total ?? 0))}
                    </td>
                    <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {fmtDate(o.createdAt, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <Link
                        href={`/service/${o.id}`}
                        style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '0.75rem', textDecoration: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isAr ? '→ فتح' : 'Open →'}
                      </Link>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      {isAr ? 'لا توجد أوامر صيانة.' : 'No service orders found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← {isAr ? 'السابق' : 'Prev'}
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                  {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {isAr ? 'التالي' : 'Next'} →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
