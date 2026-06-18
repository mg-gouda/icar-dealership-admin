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

export default function DashboardHome() {
  const { data: finalizedRes } = useQuery<unknown>('/deals?status=FINALIZED&limit=1');
  const { data: vehiclesRes } = useQuery<unknown>('/vehicles?status=AVAILABLE&limit=1');
  const { data: appointmentsRes } = useQuery<unknown>('/appointments?status=SCHEDULED&limit=200');
  const { data: pendingFinanceRes } = useQuery<unknown>('/deals?status=PENDING_FINANCE&limit=100');

  // Active deals for the table at bottom
  const { data: activeDeals } = useQuery<unknown>('/deals?status=DRAFT&status=PENDING_FINANCE&limit=100');

  const totalFinalized = kpiCount(finalizedRes);
  const availableInventory = kpiCount(vehiclesRes);
  const pendingFinance = kpiCount(pendingFinanceRes);

  // Filter appointments to today
  const allAppts = Array.isArray(appointmentsRes)
    ? appointmentsRes
    : Array.isArray((appointmentsRes as any)?.items)
      ? (appointmentsRes as any).items
      : Array.isArray((appointmentsRes as any)?.data)
        ? (appointmentsRes as any).data
        : [];

  const todayAppts = (allAppts as { date?: string; scheduledAt?: string }[]).filter((a) => {
    const d = a.date ?? a.scheduledAt ?? '';
    return d.slice(0, 10) === TODAY;
  }).length;

  const dealsArr: any[] = Array.isArray(activeDeals)
    ? activeDeals
    : Array.isArray((activeDeals as any)?.items)
      ? (activeDeals as any).items
      : Array.isArray((activeDeals as any)?.data)
        ? (activeDeals as any).data
        : [];

  const kpis = [
    {
      label: 'Available Inventory',
      value: availableInventory,
      icon: '🚗',
      color: 'text-green-400',
      href: '/vehicles',
    },
    {
      label: 'Deals Finalized',
      value: totalFinalized,
      icon: '✅',
      color: 'text-blue-400',
      href: '/deals',
    },
    {
      label: 'Pending Finance',
      value: pendingFinance,
      icon: '⏳',
      color: 'text-amber-400',
      href: '/deals',
    },
    {
      label: "Today's Appointments",
      value: todayAppts,
      icon: '📅',
      color: 'text-purple-400',
      href: '/appointments',
    },
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
      {dealsArr.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active Deals</p>
            <Link href="/deals" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              {dealsArr.slice(0, 5).map((d: any) => (
                <tr key={d.id} className="hover:bg-white/2 transition">
                  <td className="py-2.5 text-white font-medium">
                    {d.customer?.name ?? '—'}
                  </td>
                  <td className="py-2.5 text-gray-400 text-xs">
                    {d.vehicle ? `${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}` : '—'}
                  </td>
                  <td className="py-2.5 text-right text-white text-xs">
                    {Number(d.salePrice).toLocaleString()} EGP
                  </td>
                  <td className="py-2.5 pl-3">
                    <Link href={`/deals/${d.id}`} className="text-blue-400 hover:text-blue-300 text-xs">→</Link>
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
