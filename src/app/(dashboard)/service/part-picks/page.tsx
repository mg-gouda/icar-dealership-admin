'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

const fmt = (n: number) => 'EGP ' + Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });

interface PickRequest {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  partPickStatus: string;
  partPickedAt?: string;
  createdAt: string;
  part?: { id: string; partNumber: string; name: string; onHand: number };
  serviceOrder: {
    id: string;
    orderNumber?: string;
    status: string;
    location?: { name: string };
    vehicle?: { make: string; model: string; year: number };
    externalVehicle?: { make: string; model: string; licensePlate: string };
    walkInCustomerName?: string;
  };
}

function statusBadge(s: string) {
  if (s === 'PENDING') return 'badge-warning';
  if (s === 'PICKED')  return 'badge-success';
  return 'badge-neutral';
}

export default function PartPicksPage() {
  const { isAr } = useLang();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [marking, setMarking] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const qs = new URLSearchParams({ ...(statusFilter && { status: statusFilter }) });
  const { data, loading, error, reload } = useQuery<PickRequest[]>(`/service-orders/part-picks?${qs}`, [statusFilter]);
  const picks = data ?? [];

  async function markPicked(lineId: string) {
    setMarking(lineId); setErr('');
    try {
      await apiFetch(`/service-orders/part-picks/${lineId}/picked`, { method: 'PATCH' });
      reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : (isAr ? 'خطأ' : 'Error'));
    } finally { setMarking(null); }
  }

  const STATUS_TABS = [
    { value: 'PENDING',   label: isAr ? 'بانتظار السحب' : 'Pending' },
    { value: 'PICKED',    label: isAr ? 'تم السحب'       : 'Picked'  },
    { value: '',          label: isAr ? 'الكل'            : 'All'     },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/service" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← {isAr ? 'مركز الصيانة' : 'Service Center'}
            </Link>
          </div>
          <h1 className="page-title">{isAr ? 'طلبات سحب قطع الغيار' : 'Parts Fetch Requests'}</h1>
          <p className="page-subtitle">
            {isAr
              ? 'القطع المطلوب سحبها من المستودع وإيصالها للميكانيكي'
              : 'Parts that need to be pulled from shelves and delivered to the mechanic'}
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ padding: '0 1.5rem 1rem', display: 'flex', gap: '0.5rem' }}>
        {STATUS_TABS.map(t => (
          <button key={t.value} type="button"
            onClick={() => setStatusFilter(t.value)}
            style={{
              padding: '0.35rem 1rem', borderRadius: 20, border: '1px solid var(--border)',
              fontSize: '0.8rem', cursor: 'pointer', fontWeight: statusFilter === t.value ? 600 : 400,
              background: statusFilter === t.value ? 'var(--primary)' : 'var(--surface)',
              color: statusFilter === t.value ? '#fff' : 'var(--text-2)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-body">
        {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{err}</p>}
        {loading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>}
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}

        {!loading && picks.length === 0 && (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
            {isAr
              ? (statusFilter === 'PENDING' ? 'لا توجد طلبات سحب معلقة 🎉' : 'لا توجد طلبات.')
              : (statusFilter === 'PENDING' ? 'No pending fetch requests 🎉' : 'No requests found.')}
          </div>
        )}

        {!loading && picks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {picks.map(pick => {
              const so = pick.serviceOrder;
              const vehicle = so.vehicle
                ? `${so.vehicle.year} ${so.vehicle.make} ${so.vehicle.model}`
                : so.externalVehicle
                ? `${so.externalVehicle.make} ${so.externalVehicle.model} — ${so.externalVehicle.licensePlate}`
                : so.walkInCustomerName ?? '—';
              const orderNum = so.orderNumber ? `#${so.orderNumber}` : `#${so.id.slice(-6).toUpperCase()}`;

              return (
                <div key={pick.id} className="card" style={{ padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.75rem 1.5rem', alignItems: 'start' }}>
                    {/* Part info */}
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', margin: 0 }}>
                        {pick.part?.name ?? pick.description}
                      </p>
                      {pick.part && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.2rem 0 0' }}>
                          {pick.part.partNumber}
                        </p>
                      )}
                    </div>
                    {/* Quantity */}
                    <div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.2rem' }}>
                        {isAr ? 'الكمية' : 'Qty'}
                      </p>
                      <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)', margin: 0 }}>
                        {Number(pick.quantity)}
                      </p>
                    </div>
                    {/* Service order */}
                    <div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.2rem' }}>
                        {isAr ? 'أمر الصيانة' : 'Service Order'}
                      </p>
                      <Link href={`/service/${so.id}`}
                        style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
                        {orderNum}
                      </Link>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', margin: '0.15rem 0 0' }}>{vehicle}</p>
                      {so.location && <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', margin: 0 }}>{so.location.name}</p>}
                    </div>
                    {/* Requested at */}
                    <div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.2rem' }}>
                        {isAr ? 'وقت الطلب' : 'Requested'}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: 0 }}>
                        {fmtDate(pick.createdAt, isAr, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {pick.partPickedAt && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--success-fg)', margin: '0.15rem 0 0' }}>
                          ✓ {fmtDate(pick.partPickedAt, isAr, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <span className={`badge ${statusBadge(pick.partPickStatus)}`}>
                      {pick.partPickStatus === 'PENDING' ? (isAr ? 'بانتظار السحب' : 'Pending') : (isAr ? 'تم السحب' : 'Picked')}
                    </span>
                    {pick.partPickStatus === 'PENDING' && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={marking === pick.id}
                        onClick={() => markPicked(pick.id)}
                      >
                        {marking === pick.id ? '…' : (isAr ? '✓ تم السحب' : '✓ Mark Picked')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
