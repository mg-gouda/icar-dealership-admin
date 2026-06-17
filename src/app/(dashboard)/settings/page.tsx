'use client';

import { useQuery } from '../../../lib/useApi';

interface Location {
  id: string; name: string; city?: string; phone?: string;
  defaultAdminFee?: number; defaultInsuranceFee?: number; isActive: boolean;
  _count?: { users: number; vehicles: number };
}

export default function SettingsPage() {
  const { data: locations, loading } = useQuery<Location[]>('/locations');

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
      <p className="text-xs text-gray-500 mb-8">Company & location configuration</p>

      <section className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Locations</p>
        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        <div className="space-y-3">
          {(locations ?? []).map((loc) => (
            <div key={loc.id} className="rounded-xl border border-white/5 bg-gray-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{loc.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{loc.city ?? '—'} · {loc.phone ?? 'no phone'}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{loc._count?.users ?? 0} users</span>
                  <span>{loc._count?.vehicles ?? 0} vehicles</span>
                  <span className={loc.isActive ? 'text-green-400' : 'text-red-400'}>
                    {loc.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                <div>
                  <p className="text-xs text-gray-500">Default Admin Fee</p>
                  <p className="text-sm text-white">{loc.defaultAdminFee ? `${Number(loc.defaultAdminFee).toLocaleString()} EGP` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Default Insurance Fee</p>
                  <p className="text-sm text-white">{loc.defaultInsuranceFee ? `${Number(loc.defaultInsuranceFee).toLocaleString()} EGP` : '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">System</p>
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4 space-y-3">
          {[
            ['API Endpoint', process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'],
            ['Currency', 'EGP (Egyptian Pound)'],
            ['VAT Rate', '14% (Egypt standard)'],
            ['Version', '1.0.0'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-300 font-mono text-xs">{val}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
