'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

interface Lead {
  id: string; name: string; phone?: string; email?: string;
  status: string; source?: string; createdAt: string; notes?: string;
  vehicle?: { make: string; model: string; year: number };
  assignedTo?: { name: string };
  location?: { name: string };
}

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'NEGOTIATING', label: 'Negotiating' },
  { value: 'CLOSED_WON', label: 'Closed Won' },
  { value: 'CLOSED_LOST', label: 'Closed Lost' },
];

export default function CrmPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data: leads, loading, error } = useQuery<Lead[]>(
    `/leads?${new URLSearchParams({ ...(status && { status }), limit: '50' })}`,
    [status],
  );

  const router = useRouter();
  const filtered = (leads ?? []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [l.name, l.phone, l.email].some((f) => f?.toLowerCase().includes(q));
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">CRM / Leads</h1>
          <p className="text-xs text-gray-500 mt-0.5">Customer pipeline</p>
        </div>
        <Link href="/crm/new" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition">
          + New Lead
        </Link>
      </div>

      <div className="flex gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone…"
          className="flex-1 px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
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

      <div className="grid grid-cols-4 gap-3 mb-6">
        {(['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? '' : s)}
            className={`rounded-xl border p-3 text-left transition ${status === s ? 'border-blue-500 bg-blue-900/20' : 'border-white/5 bg-gray-900'}`}>
            <p className="text-xs text-gray-400">{s.replace(/_/g, ' ')}</p>
            <p className="text-lg font-semibold text-white mt-0.5">
              {(leads ?? []).filter((l) => l.status === s).length}
            </p>
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Interest</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((l) => (
                <tr key={l.id}
                  onClick={() => router.push(`/crm/${l.id}`)}
                  className="hover:bg-white/5 transition cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{l.name}</p>
                    <p className="text-xs text-gray-500">{l.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {l.vehicle ? `${l.vehicle.year} ${l.vehicle.make} ${l.vehicle.model}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{l.source ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{l.assignedTo?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No leads found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
