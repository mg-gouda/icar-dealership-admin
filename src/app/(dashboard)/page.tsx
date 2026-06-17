'use client';

import Link from 'next/link';
import { useQuery } from '../../lib/useApi';

interface DashStats {
  activeDeals: number;
  availableVehicles: number;
  openLeads: number;
  todayAppointments: number;
}

export default function DashboardHome() {
  const { data: deals } = useQuery<any[]>('/deals?status=DRAFT&status=PENDING_FINANCE&limit=100');
  const { data: vehicles } = useQuery<any[]>('/vehicles?status=AVAILABLE&limit=100');
  const { data: leads } = useQuery<any[]>('/leads?status=NEW&limit=100');

  const stats = [
    { label: 'Active Deals', value: deals?.length ?? '—', color: 'text-blue-400', href: '/deals' },
    { label: 'Available Vehicles', value: vehicles?.length ?? '—', color: 'text-green-400', href: '/vehicles' },
    { label: 'New Leads', value: leads?.length ?? '—', color: 'text-yellow-400', href: '/crm' },
    { label: 'Finance', value: 'GL →', color: 'text-purple-400', href: '/finance' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white mb-1">Dashboard</h1>
      <p className="text-xs text-gray-500 mb-6">iCar Dealership — Admin Portal</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}
            className="rounded-xl border border-white/5 bg-gray-900 p-5 hover:border-white/20 transition group">
            <p className="text-xs text-gray-500 mb-1 group-hover:text-gray-400 transition">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
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

      {/* Recent deals */}
      {(deals?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active Deals</p>
            <Link href="/deals" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              {(deals ?? []).slice(0, 5).map((d: any) => (
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
