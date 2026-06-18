'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../lib/useApi';
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
  const { data: vehiclesRes, loading, error, reload } = useQuery<{ data: Vehicle[]; meta: { total: number } }>(
    `/vehicles?${new URLSearchParams({ ...(status && { status }), ...(search && { search }), limit: '50' })}`,
    [status, search],
  );
  const vehicles = vehiclesRes?.data ?? [];

  // Bulk import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImporting(true); setImportResult(null);
    try {
      const res = await apiFetch<{ created: number; errors: { row: number; error: string }[] }>(
        '/vehicles/bulk-import', { method: 'POST', body: JSON.stringify({ csv: text }) },
      );
      setImportResult(res);
      if ((res as any).created > 0) reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Import failed'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Vehicles</h1>
          <p className="text-xs text-gray-500 mt-0.5">{vehiclesRes?.meta?.total ?? 0} vehicles</p>
        </div>
        <div className="flex gap-2 items-center">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition">
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <Link href="/vehicles/new"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition">
            + Add Vehicle
          </Link>
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 p-3 rounded-lg text-xs border ${importResult.errors.length ? 'bg-amber-900/20 border-amber-500/20 text-amber-300' : 'bg-green-900/20 border-green-500/20 text-green-300'}`}>
          <p className="font-medium mb-1">{importResult.created} vehicle{importResult.created !== 1 ? 's' : ''} imported successfully{importResult.errors.length ? ` · ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : '.'}</p>
          {importResult.errors.map((e) => (
            <p key={e.row} className="text-amber-400">Row {e.row}: {e.error}</p>
          ))}
          <p className="mt-1 text-gray-500">Expected columns: make, model, year, price, locationId — optional: trim, vin, condition, status, bodyType, color, fuelType, transmission, mileage, description</p>
        </div>
      )}

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
