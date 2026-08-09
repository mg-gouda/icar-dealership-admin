'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '../../../../lib/useApi';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface VehicleRow {
  id: string;
  type: 'INVENTORY' | 'EXTERNAL';
  make: string;
  model: string;
  year?: number;
  plate?: string;
  vin?: string;
  ownerName?: string;
  totalOrders: number;
  lastVisit?: string;
  nextVisitDate?: string;
  warrantyMonths?: number;
  saleDate?: string;
}

function warrantyStatus(row: VehicleRow): { label: string; color: string } | null {
  if (row.type !== 'INVENTORY' || !row.warrantyMonths || !row.saleDate) return null;
  const sold = new Date(row.saleDate);
  const expiry = new Date(sold);
  expiry.setMonth(expiry.getMonth() + row.warrantyMonths);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  if (daysLeft <= 0) return { label: 'Expired', color: 'var(--text-3)' };
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: 'var(--danger)' };
  if (daysLeft <= 90) return { label: `${daysLeft}d left`, color: 'var(--warning)' };
  return { label: `${Math.ceil(daysLeft / 30)}mo left`, color: 'var(--success)' };
}

export default function ByVehiclePage() {
  const pathname = usePathname();
  const { isAr } = useLang();
  const [search, setSearch] = useState('');

  const qs = new URLSearchParams({ ...(search && { q: search }) });
  const { data, loading, error } = useQuery<VehicleRow[]>(
    `/service-orders/vehicles?${qs}`,
    [search],
  );

  const vehicles = Array.isArray(data) ? data : [];

  const SERVICE_TABS = [
    { href: '/service',            labelEn: 'Service Orders', labelAr: 'أوامر الصيانة', exact: true  },
    { href: '/service/by-vehicle', labelEn: 'By Vehicle',     labelAr: 'حسب السيارة',   exact: false },
    { href: '/service/part-picks', labelEn: 'Part Picks',     labelAr: 'سحب القطع',      exact: false },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'مركز الصيانة' : 'Service Center'}</h1>
          <p className="page-subtitle">
            {isAr ? `${vehicles.length} سيارة بسجل صيانة` : `${vehicles.length} vehicles with service history`}
          </p>
        </div>
        <Link href="/service/new" className="btn btn-primary">
          {isAr ? '+ أمر جديد' : '+ New Order'}
        </Link>
      </div>

      {/* Tab nav */}
      <div style={{ padding: '0 1.5rem', display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
        {SERVICE_TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                color: active ? 'var(--primary)' : 'var(--text-2)',
                marginBottom: -1,
                transition: 'color 120ms, border-color 120ms',
              }}
            >
              {isAr ? t.labelAr : t.labelEn}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ padding: '1rem 1.5rem 0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <input
          className="input"
          style={{ maxWidth: 300 }}
          placeholder={isAr ? 'بحث بالطراز أو لوحة الترخيص أو اسم المالك…' : 'Search make, plate, or owner…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="page-body">
        {loading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', padding: '0 1.5rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>}
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', padding: '0 1.5rem' }}>{error}</p>}
        {!loading && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                  <th>{isAr ? 'النوع' : 'Type'}</th>
                  <th>{isAr ? 'المالك / العميل' : 'Owner / Customer'}</th>
                  <th style={{ textAlign: 'center' }}>{isAr ? 'عدد الأوامر' : 'Orders'}</th>
                  <th>{isAr ? 'آخر زيارة' : 'Last Visit'}</th>
                  <th>{isAr ? 'الزيارة القادمة' : 'Next Visit'}</th>
                  <th>{isAr ? 'الضمان' : 'Warranty'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const warranty = warrantyStatus(v);
                  return (
                    <tr
                      key={`${v.type}-${v.id}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.location.href = `/service/by-vehicle/${v.type}/${v.id}`}
                    >
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {v.year ? `${v.year} ` : ''}{v.make} {v.model}
                        </div>
                        {v.plate && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', background: 'var(--surface-2)', padding: '0.05rem 0.35rem', borderRadius: 4 }}>
                            {v.plate}
                          </span>
                        )}
                        {v.vin && !v.plate && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>VIN: {v.vin.slice(-6)}</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: 4,
                          background: v.type === 'INVENTORY' ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'color-mix(in srgb, var(--text-2) 12%, transparent)',
                          color: v.type === 'INVENTORY' ? 'var(--primary)' : 'var(--text-2)',
                        }}>
                          {v.type === 'INVENTORY' ? (isAr ? 'مخزون' : 'Inventory') : (isAr ? 'خارجي' : 'External')}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{v.ownerName ?? '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: v.totalOrders > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                        {v.totalOrders}
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                        {v.lastVisit ? fmtDate(v.lastVisit, isAr, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {v.nextVisitDate ? (
                          <span style={{ color: new Date(v.nextVisitDate) < new Date() ? 'var(--danger)' : 'var(--text-2)' }}>
                            {fmtDate(v.nextVisitDate, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {warranty ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: 4, color: warranty.color, background: `color-mix(in srgb, ${warranty.color} 12%, transparent)` }}>
                            {warranty.label}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/service/by-vehicle/${v.type}/${v.id}`}
                          style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '0.75rem', textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isAr ? '→ فتح' : 'Open →'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {vehicles.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      {isAr ? 'لا توجد سيارات بسجل صيانة.' : 'No vehicles with service history.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
