'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

interface Vehicle {
  id: string; make: string; model: string; year: number;
  vin: string; status: string; price: number;
  condition?: string; bodyType?: string; color?: string;
  location?: { name: string };
}

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'PENDING_INSPECTION', label: 'Pending Inspection' },
];

export default function VehiclesPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data: vehiclesRes, loading, error } = useQuery<{ data: Vehicle[]; meta: { total: number } }>(
    `/vehicles?${new URLSearchParams({ ...(status && { status }), ...(search && { search }), limit: '50' })}`,
    [status, search],
  );
  const vehicles = vehiclesRes?.data ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Vehicles</h1>
          <p className="text-xs text-gray-500 mt-0.5">{vehiclesRes?.meta?.total ?? 0} vehicles</p>
        </div>
        <Link
          href="/vehicles/new"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"
        >
          + Add Vehicle
        </Link>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search make, model, stock #…"
          className="flex-1 px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <SearchableCombobox
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          placeholder="All Statuses"
          clearable
          clearLabel="All Statuses"
          className="w-44"
        />
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs">
              <tr>
                <th className="text-left px-4 py-3 font-medium">VIN (last 8)</th>
                <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                <th className="text-left px-4 py-3 font-medium">Condition</th>
                <th className="text-left px-4 py-3 font-medium">Location</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {vehicles.map((v) => (
                <tr key={v.id}
                  onClick={() => router.push(`/vehicles/${v.id}`)}
                  className="hover:bg-white/5 transition cursor-pointer">
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">{v.vin?.slice(-8) ?? '—'}</td>
                  <td className="px-4 py-3 text-white font-medium">
                    {v.year} {v.make} {v.model}
                    {v.color && <span className="ml-1 text-gray-500">· {v.color}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{v.condition}</td>
                  <td className="px-4 py-3 text-gray-400">{v.location?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-white">
                    {Number(v.price).toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No vehicles found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
