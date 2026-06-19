'use client';

import Link from 'next/link';
import { useQuery } from '../../lib/useApi';

const TODAY = new Date().toISOString().slice(0, 10);

function kpiCount(res: unknown): number {
  if (!res) return 0;
  if (Array.isArray(res)) return res.length;
  const r = res as Record<string, unknown>;
  if (typeof r.total === 'number') return r.total;
  if (Array.isArray(r.items)) return (r.items as unknown[]).length;
  if (Array.isArray(r.data)) return (r.data as unknown[]).length;
  return 0;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// CSS-only horizontal bar chart
const DEAL_STATUS_COLORS: Record<string, string> = {
  FINALIZED:       'bg-green-500',
  APPROVED:        'bg-blue-500',
  PENDING_FINANCE: 'bg-yellow-500',
  DRAFT:           'bg-gray-500',
  CANCELLED:       'bg-red-500',
};

const VEHICLE_STATUS_COLORS: Record<string, string> = {
  AVAILABLE:          'bg-green-500',
  RESERVED:           'bg-blue-500',
  SOLD:               'bg-purple-500',
  IN_TRANSIT:         'bg-orange-500',
  PENDING_INSPECTION: 'bg-yellow-500',
  PENDING:            'bg-gray-500',
};

function HorizontalBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 4;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-32 shrink-0 truncate">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-6 text-right">{count}</span>
    </div>
  );
}

function ColorDot({ color }: { color: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />;
}

export default function DashboardHome() {
  const { data: finalizedRes } = useQuery<unknown>('/deals?status=FINALIZED&limit=1');
  const { data: vehiclesRes } = useQuery<unknown>('/vehicles?status=AVAILABLE&limit=1');
  const { data: appointmentsRes } = useQuery<unknown>('/appointments?status=SCHEDULED&limit=200');
  const { data: pendingFinanceRes } = useQuery<unknown>('/deals?status=PENDING_FINANCE&limit=100');

  // Active deals for quick-table
  const { data: activeDeals } = useQuery<unknown>('/deals?status=DRAFT&status=PENDING_FINANCE&limit=100');

  // Chart data
  const { data: allDeals } = useQuery<unknown>('/deals?limit=200');
  const { data: recentLeads } = useQuery<unknown>('/leads?limit=10');

  // Vehicle counts per status
  const { data: availableVeh } = useQuery<unknown>('/vehicles?status=AVAILABLE&limit=1');
  const { data: reservedVeh }  = useQuery<unknown>('/vehicles?status=RESERVED&limit=1');
  const { data: soldVeh }      = useQuery<unknown>('/vehicles?status=SOLD&limit=1');
  const { data: transitVeh }   = useQuery<unknown>('/vehicles?status=IN_TRANSIT&limit=1');

  const totalFinalized = kpiCount(finalizedRes);
  const availableInventory = kpiCount(vehiclesRes);
  const pendingFinance = kpiCount(pendingFinanceRes);

  const allAppts = Array.isArray(appointmentsRes)
    ? appointmentsRes
    : Array.isArray((appointmentsRes as Record<string, unknown>)?.items)
      ? (appointmentsRes as Record<string, unknown[]>).items
      : Array.isArray((appointmentsRes as Record<string, unknown>)?.data)
        ? (appointmentsRes as Record<string, unknown[]>).data
        : [];

  const todayAppts = (allAppts as { date?: string; scheduledAt?: string }[]).filter((a) => {
    const d = a.date ?? a.scheduledAt ?? '';
    return d.slice(0, 10) === TODAY;
  }).length;

  const dealsArr = Array.isArray(allDeals)
    ? (allDeals as Record<string, unknown>[])
    : Array.isArray((allDeals as Record<string, unknown>)?.items)
      ? ((allDeals as Record<string, unknown[]>).items as Record<string, unknown>[])
      : Array.isArray((allDeals as Record<string, unknown>)?.data)
        ? ((allDeals as Record<string, unknown[]>).data as Record<string, unknown>[])
        : [];

  const activeDealsArr = Array.isArray(activeDeals)
    ? (activeDeals as Record<string, unknown>[])
    : Array.isArray((activeDeals as Record<string, unknown>)?.items)
      ? ((activeDeals as Record<string, unknown[]>).items as Record<string, unknown>[])
      : Array.isArray((activeDeals as Record<string, unknown>)?.data)
        ? ((activeDeals as Record<string, unknown[]>).data as Record<string, unknown>[])
        : [];

  // Group deals by status
  const dealsByStatus = dealsArr.reduce<Record<string, number>>((acc, d) => {
    const s = String(d.status ?? 'UNKNOWN');
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const dealStatusOrder = ['FINALIZED', 'APPROVED', 'PENDING_FINANCE', 'DRAFT', 'CANCELLED'];
  const dealMax = Math.max(1, ...Object.values(dealsByStatus));

  // Vehicle inventory counts
  const vehicleCounts: { label: string; count: number; color: string }[] = [
    { label: 'AVAILABLE',          count: kpiCount(availableVeh), color: VEHICLE_STATUS_COLORS.AVAILABLE },
    { label: 'RESERVED',           count: kpiCount(reservedVeh),  color: VEHICLE_STATUS_COLORS.RESERVED },
    { label: 'SOLD',               count: kpiCount(soldVeh),       color: VEHICLE_STATUS_COLORS.SOLD },
    { label: 'IN_TRANSIT',         count: kpiCount(transitVeh),    color: VEHICLE_STATUS_COLORS.IN_TRANSIT },
  ];

  // Recent leads as activity feed (no audit-log endpoint)
  const leadsArr = Array.isArray(recentLeads)
    ? (recentLeads as Record<string, unknown>[])
    : Array.isArray((recentLeads as Record<string, unknown>)?.items)
      ? ((recentLeads as Record<string, unknown[]>).items as Record<string, unknown>[])
      : Array.isArray((recentLeads as Record<string, unknown>)?.data)
        ? ((recentLeads as Record<string, unknown[]>).data as Record<string, unknown>[])
        : [];

  const kpis = [
    { label: 'Available Inventory', value: availableInventory, icon: '🚗', color: 'text-green-400', href: '/vehicles' },
    { label: 'Deals Finalized',     value: totalFinalized,      icon: '✅', color: 'text-blue-400',  href: '/deals' },
    { label: 'Pending Finance',      value: pendingFinance,      icon: '⏳', color: 'text-amber-400', href: '/deals' },
    { label: "Today's Appointments", value: todayAppts,          icon: '📅', color: 'text-purple-400', href: '/appointments' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white mb-1">Dashboard</h1>
      <p className="text-xs text-gray-500 mb-6">iCar Dealership — Admin Portal</p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}
            className="rounded-xl border border-white/5 bg-gray-900 p-5 hover:border-white/20 transition group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 group-hover:text-gray-400 transition">{k.label}</p>
              <span className="text-base leading-none">{k.icon}</span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Chart 1: Deals by Status — horizontal bars */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-4">Deals by Status</p>
          {dealsArr.length === 0
            ? <p className="text-xs text-gray-600">No deal data</p>
            : (
              <div className="space-y-2.5">
                {dealStatusOrder.map((s) => {
                  const count = dealsByStatus[s] ?? 0;
                  return (
                    <HorizontalBar
                      key={s}
                      label={s}
                      count={count}
                      max={dealMax}
                      color={DEAL_STATUS_COLORS[s] ?? 'bg-gray-500'}
                    />
                  );
                })}
              </div>
            )
          }
        </div>

        {/* Chart 2: Inventory by Status — legend squares */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-4">Inventory by Status</p>
          <div className="space-y-3">
            {vehicleCounts.map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ColorDot color={color} />
                  <span className="text-xs text-gray-400">{label.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-sm font-semibold text-white tabular-nums">{count}</span>
              </div>
            ))}
            {/* Simple stacked bar */}
            {(() => {
              const total = vehicleCounts.reduce((s, v) => s + v.count, 0);
              if (total === 0) return null;
              return (
                <div className="flex h-2 rounded-full overflow-hidden mt-3 gap-px">
                  {vehicleCounts.filter((v) => v.count > 0).map(({ label, count, color }) => (
                    <div
                      key={label}
                      className={`${color}`}
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Chart 3: Recent Leads (no audit-log endpoint) */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-4">Recent Leads</p>
          {leadsArr.length === 0
            ? <p className="text-xs text-gray-600">No recent leads</p>
            : (
              <div className="space-y-2.5">
                {leadsArr.slice(0, 8).map((l) => {
                  const createdAt = String(l.createdAt ?? '');
                  const status = String(l.status ?? '');
                  const dot = status === 'CLOSED_WON' ? 'bg-green-500'
                    : status === 'CLOSED_LOST' ? 'bg-gray-500'
                    : status === 'QUALIFIED' ? 'bg-purple-500'
                    : status === 'NEGOTIATING' ? 'bg-orange-500'
                    : status === 'CONTACTED' ? 'bg-yellow-500'
                    : 'bg-blue-500';
                  return (
                    <div key={String(l.id)} className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                      <span className="text-xs text-gray-300 flex-1 truncate">{String(l.name ?? '—')}</span>
                      <span className="text-[10px] text-gray-600 shrink-0">{createdAt ? timeAgo(createdAt) : ''}</span>
                    </div>
                  );
                })}
              </div>
            )
          }
          <Link href="/crm" className="block mt-3 text-xs text-blue-400 hover:text-blue-300">View all leads →</Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-white/5 bg-gray-900 p-5 mb-4">
        <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wide">Quick Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Deal', href: '/deals/new', desc: 'Start a sale' },
            { label: 'Add Vehicle', href: '/vehicles/new', desc: 'List inventory' },
            { label: 'New Lead', href: '/crm/new', desc: 'Log customer' },
            { label: 'GL Entry', href: '/finance/gl', desc: 'Journal entry' },
          ].map((a) => (
            <Link key={a.href} href={a.href}
              className="rounded-lg border border-white/5 p-3 hover:border-white/20 hover:bg-white/3 transition">
              <p className="text-sm text-white font-medium">{a.label}</p>
              <p className="text-xs text-gray-500">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent active deals */}
      {activeDealsArr.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active Deals</p>
            <Link href="/deals" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              {activeDealsArr.slice(0, 5).map((d) => (
                <tr key={String(d.id)} className="hover:bg-white/2 transition">
                  <td className="py-2.5 text-white font-medium">
                    {(d.customer as Record<string, unknown>)?.name as string ?? '—'}
                  </td>
                  <td className="py-2.5 text-gray-400 text-xs">
                    {d.vehicle
                      ? `${(d.vehicle as Record<string, unknown>).year} ${(d.vehicle as Record<string, unknown>).make} ${(d.vehicle as Record<string, unknown>).model}`
                      : '—'}
                  </td>
                  <td className="py-2.5 text-right text-white text-xs">
                    {Number(d.salePrice).toLocaleString()} EGP
                  </td>
                  <td className="py-2.5 pl-3">
                    <Link href={`/deals/${String(d.id)}`} className="text-blue-400 hover:text-blue-300 text-xs">→</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
