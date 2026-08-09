'use client';

import Link from 'next/link';
import { useQuery } from '../../../lib/useApi';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

const fmtAmt = (n: number | string | null | undefined) => {
  const v = Number(n);
  return isNaN(v) || v === 0 ? '—' : 'EGP ' + v.toLocaleString('en-EG', { maximumFractionDigits: 0 });
};

const TODAY = new Date().toISOString().slice(0, 10);
const THIS_MONTH = new Date().toISOString().slice(0, 7);

interface ServiceOrder {
  id: string;
  orderNumber?: string;
  status: string;
  type?: string;
  serviceType?: string;
  totalAmount?: number;
  total?: number;
  createdAt: string;
  technician?: { name: string };
  location?: { name: string };
  vehicle?: { make: string; model: string; year: number };
  externalVehicle?: { make: string; model: string; licensePlate: string };
  walkInCustomerName?: string;
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    INTAKE: 'var(--info)',
    IN_PROGRESS: 'var(--warning)',
    COMPLETED: 'var(--success)',
    INVOICED: 'var(--text-2)',
    CANCELLED: 'var(--danger)',
  };
  return map[s] ?? 'var(--text-3)';
}
function statusBadgeClass(s: string) {
  const map: Record<string, string> = {
    INTAKE: 'badge-info',
    IN_PROGRESS: 'badge-warning',
    COMPLETED: 'badge-success',
    INVOICED: 'badge-neutral',
    CANCELLED: 'badge-danger',
  };
  return map[s] ?? 'badge-neutral';
}
function vehicleLabel(o: ServiceOrder) {
  if (o.vehicle) return `${o.vehicle.year} ${o.vehicle.make} ${o.vehicle.model}`;
  if (o.externalVehicle) return `${o.externalVehicle.make} ${o.externalVehicle.model}`;
  return o.walkInCustomerName ?? '—';
}

function StatCard({
  label, value, sub, color, href, icon,
}: {
  label: string; value: number | string; sub?: string;
  color: string; href: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: 'pointer', transition: 'border-color 120ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
          <span style={{ padding: '0.35rem', borderRadius: 8, background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{icon}</span>
        </div>
        <span style={{ fontSize: '2rem', fontWeight: 700, color, lineHeight: 1, tabularNums: 'tabular-nums' } as React.CSSProperties}>{value}</span>
        {sub && <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{sub}</span>}
      </div>
    </Link>
  );
}

function QuickLink({ href, labelEn, labelAr, subEn, subAr, color, icon, isAr }: {
  href: string; labelEn: string; labelAr: string; subEn: string; subAr: string;
  color: string; icon: React.ReactNode; isAr: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'border-color 120ms' }}>
        <span style={{ padding: '0.6rem', borderRadius: 10, background: `color-mix(in srgb, ${color} 14%, transparent)`, color, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>{isAr ? labelAr : labelEn}</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>{isAr ? subAr : subEn}</p>
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: '1rem' }}>→</span>
      </div>
    </Link>
  );
}

export default function ServiceDashboard() {
  const { isAr } = useLang();

  const { data: intakeRes }    = useQuery<{ total: number }>('/service-orders?status=INTAKE&limit=1');
  const { data: inProgRes }    = useQuery<{ total: number }>('/service-orders?status=IN_PROGRESS&limit=1');
  const { data: completedRes } = useQuery<{ total: number; data: ServiceOrder[] }>('/service-orders?status=COMPLETED&limit=50');
  const { data: invoicedRes }  = useQuery<{ total: number; data: ServiceOrder[] }>('/service-orders?status=INVOICED&limit=100');
  const { data: activeRes }    = useQuery<{ data: ServiceOrder[] }>('/service-orders?status=INTAKE&limit=8');
  const { data: picksRes }     = useQuery<{ pending: number }>('/service-orders/part-picks/count');

  const intakeCount    = (intakeRes as any)?.total ?? 0;
  const inProgCount    = (inProgRes as any)?.total ?? 0;
  const completedAll   = (completedRes as any)?.data ?? [];
  const invoicedAll    = (invoicedRes as any)?.data ?? [];
  const activeOrders   = (activeRes as any)?.data ?? [];
  const pendingPicks   = picksRes?.pending ?? 0;

  const completedToday = completedAll.filter((o: ServiceOrder) =>
    o.createdAt?.slice(0, 10) === TODAY
  ).length;

  const revenueMonth = invoicedAll
    .filter((o: ServiceOrder) => o.createdAt?.slice(0, 7) === THIS_MONTH)
    .reduce((sum: number, o: ServiceOrder) => sum + Number(o.totalAmount ?? o.total ?? 0), 0);

  const totalCompleted = (completedRes as any)?.total ?? 0;
  const totalInvoiced  = (invoicedRes as any)?.total ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'مركز الصيانة' : 'Service Center'}</h1>
          <p className="page-subtitle">
            {isAr ? 'نظرة عامة على الأداء والأوامر الجارية' : 'Operations overview & active order status'}
          </p>
        </div>
        <Link href="/service/new" className="btn btn-primary">
          {isAr ? '+ أمر جديد' : '+ New Order'}
        </Link>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── Stat cards ────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem' }}>
          <StatCard
            label={isAr ? 'في الانتظار' : 'Awaiting Start'}
            value={intakeCount}
            sub={isAr ? 'أوامر مفتوحة – لم تبدأ' : 'Open — not yet started'}
            color="var(--info)" href="/service/orders?status=INTAKE"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <StatCard
            label={isAr ? 'جاري العمل' : 'In Progress'}
            value={inProgCount}
            sub={isAr ? 'أوامر قيد التنفيذ الآن' : 'Currently being worked on'}
            color="var(--warning)" href="/service/orders?status=IN_PROGRESS"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
          />
          <StatCard
            label={isAr ? 'مكتمل اليوم' : 'Completed Today'}
            value={completedToday}
            sub={isAr ? `${totalCompleted} مكتمل الإجمالي` : `${totalCompleted} total completed`}
            color="var(--success)" href="/service/orders?status=COMPLETED"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
          />
          <StatCard
            label={isAr ? 'إيرادات هذا الشهر' : 'Revenue This Month'}
            value={revenueMonth > 0 ? `EGP ${(revenueMonth / 1000).toFixed(0)}K` : '—'}
            sub={isAr ? `${totalInvoiced} فاتورة صادرة` : `From ${totalInvoiced} invoiced orders`}
            color="var(--primary)" href="/service/orders?status=INVOICED"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          />
          <StatCard
            label={isAr ? 'قطع تحتاج للسحب' : 'Parts to Fetch'}
            value={pendingPicks}
            sub={isAr ? 'طلبات سحب معلقة من المستودع' : 'Pending warehouse picks'}
            color={pendingPicks > 0 ? 'var(--danger)' : 'var(--text-3)'} href="/service/part-picks"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}
          />
        </div>

        {/* ── Active orders + Quick links ────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '0.875rem', alignItems: 'start' }}>

          {/* Active orders */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>
                {isAr ? 'الأوامر المفتوحة' : 'Open Orders'}
              </p>
              <Link href="/service/orders" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>
                {isAr ? 'عرض الكل →' : 'View all →'}
              </Link>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'رقم' : 'Order'}</th>
                  <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th>{isAr ? 'الفني' : 'Tech'}</th>
                  <th>{isAr ? 'الموقع' : 'Location'}</th>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((o: ServiceOrder) => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = `/service/${o.id}`; }}>
                    <td style={{ color: 'var(--primary)', fontWeight: 500 }}>
                      {o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-6).toUpperCase()}`}
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{vehicleLabel(o)}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(o.status)}`} style={{ fontSize: '0.7rem' }}>
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{o.technician?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{o.location?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {fmtDate(o.createdAt, isAr, { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
                {activeOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-3)', fontSize: '0.875rem' }}>
                      {isAr ? '🎉 لا توجد أوامر مفتوحة' : '🎉 No open orders right now'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <QuickLink
              href="/service/orders" isAr={isAr}
              labelEn="Service Orders" labelAr="أوامر الصيانة"
              subEn="Full list with filters & pagination" subAr="القائمة الكاملة مع الفلاتر"
              color="var(--primary)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
            />
            <QuickLink
              href="/service/by-vehicle" isAr={isAr}
              labelEn="By Vehicle" labelAr="حسب السيارة"
              subEn="History, warranty & next visit" subAr="السجل والضمان والزيارة القادمة"
              color="var(--purple)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 10L3 6h10l1.5 4v2h-13v-2z"/><circle cx="4.5" cy="11" r="1"/><circle cx="11.5" cy="11" r="1"/></svg>}
            />
            <QuickLink
              href="/service/part-picks" isAr={isAr}
              labelEn="Part Picks" labelAr="سحب القطع"
              subEn="Pending warehouse fetch requests" subAr="طلبات السحب من المستودع"
              color={pendingPicks > 0 ? 'var(--danger)' : 'var(--warning)'}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}
            />
            <QuickLink
              href="/service/new" isAr={isAr}
              labelEn="New Service Order" labelAr="أمر صيانة جديد"
              subEn="Create a new work order" subAr="إنشاء أمر عمل جديد"
              color="var(--success)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
            />
          </div>
        </div>

        {/* ── Status breakdown ──────────────────────────────────────── */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ margin: '0 0 1rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>
            {isAr ? 'توزيع الحالات' : 'Status Breakdown'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { status: 'INTAKE',      count: intakeCount,    labelEn: 'Intake',      labelAr: 'مفتوح'    },
              { status: 'IN_PROGRESS', count: inProgCount,    labelEn: 'In Progress', labelAr: 'جاري'     },
              { status: 'COMPLETED',   count: totalCompleted, labelEn: 'Completed',   labelAr: 'مكتمل'    },
              { status: 'INVOICED',    count: totalInvoiced,  labelEn: 'Invoiced',    labelAr: 'مُفوتَر'   },
            ].map(({ status, count, labelEn, labelAr }) => {
              const grandTotal = intakeCount + inProgCount + totalCompleted + totalInvoiced;
              const pct = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0;
              const color = statusColor(status);
              return (
                <Link key={status} href={`/service/orders?status=${status}`} style={{ textDecoration: 'none', flex: '1 1 140px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{isAr ? labelAr : labelEn}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{count}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                      <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{pct}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
