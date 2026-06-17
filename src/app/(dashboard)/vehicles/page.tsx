'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';

interface Vehicle {
  id: string; make: string; model: string; year: number;
  stockNumber: string; status: string; listPrice: number;
  condition: string; bodyType: string; color?: string;
  location?: { name: string };
}

const STATUSES = ['', 'AVAILABLE', 'RESERVED', 'SOLD', 'IN_TRANSIT', 'PENDING_INSPECTION'];

export default function VehiclesPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data: vehicles, loading, error } = useQuery<Vehicle[]>(
    `/vehicles?${new URLSearchParams({ ...(status && { status }), ...(search && { search }), limit: '50' })}`,
    [status, search],
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Vehicles</h1>
          <p className="text-xs text-gray-500 mt-0.5">Inventory management</p>
        </div>
        <Link
          href="/vehicles/new"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"
        >
          + Add Vehicle
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search make, model, stock #…"
          className="flex-1 px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Stock #</th>
                <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                <th className="text-left px-4 py-3 font-medium">Condition</th>
                <th className="text-left px-4 py-3 font-medium">Location</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(vehicles ?? []).map((v) => (
                <tr key={v.id} className="hover:bg-white/2 transition">
                  <td className="px-4 py-3 font-mono text-gray-300 text-xs">{v.stockNumber}</td>
                  <td className="px-4 py-3 text-white font-medium">
                    {v.year} {v.make} {v.model}
                    {v.color && <span className="ml-1 text-gray-500">· {v.color}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{v.condition}</td>
                  <td className="px-4 py-3 text-gray-400">{v.location?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-white">
                    {v.listPrice?.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/vehicles/${v.id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {vehicles?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">No vehicles found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
