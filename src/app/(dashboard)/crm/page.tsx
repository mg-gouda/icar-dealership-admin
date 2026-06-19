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
  stageChangedAt?: string;
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

const KANBAN_COLUMNS: { status: string; label: string; color: string; bg: string; border: string }[] = [
  { status: 'NEW',         label: 'New',         color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  { status: 'CONTACTED',   label: 'Contacted',   color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  { status: 'QUALIFIED',   label: 'Qualified',   color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { status: 'NEGOTIATING', label: 'Negotiating', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  { status: 'CLOSED_WON',  label: 'Won',         color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  { status: 'CLOSED_LOST', label: 'Lost',        color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/30' },
];

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const colors: Record<string, string> = {
    WEBSITE: 'bg-blue-500/20 text-blue-300',
    PHONE: 'bg-green-500/20 text-green-300',
    WALK_IN: 'bg-purple-500/20 text-purple-300',
    FACEBOOK: 'bg-indigo-500/20 text-indigo-300',
    MARKETPLACE: 'bg-orange-500/20 text-orange-300',
    OTHER: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[source] ?? colors.OTHER}`}>
      {source.replace(/_/g, ' ')}
    </span>
  );
}

function KanbanCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const days = daysAgo(lead.stageChangedAt ?? lead.createdAt);
  return (
    <div
      onClick={() => router.push(`/crm/${lead.id}`)}
      className="bg-gray-900 border border-white/5 rounded-lg p-3 cursor-pointer hover:border-white/20 hover:bg-gray-800/80 transition space-y-2"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium text-white leading-tight">{lead.name}</p>
        <span className={`text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded ${days > 7 ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-gray-500'}`}>
          {days}d
        </span>
      </div>
      {lead.phone && <p className="text-xs text-gray-500">{lead.phone}</p>}
      <div className="flex flex-wrap gap-1 items-center">
        <SourceBadge source={lead.source} />
      </div>
      {lead.vehicle && (
        <p className="text-[11px] text-gray-400">
          {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
        </p>
      )}
      {lead.assignedTo && (
        <p className="text-[11px] text-gray-500">{lead.assignedTo.name}</p>
      )}
    </div>
  );
}

export default function CrmPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  const { data: leads, loading, error } = useQuery<Lead[]>(
    `/leads?${new URLSearchParams({ ...(status && { status }), limit: '200' })}`,
    [status],
  );

  const router = useRouter();
  const filtered = (leads ?? []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [l.name, l.phone, l.email].some((f) => f?.toLowerCase().includes(q));
  });

  // Group by status for kanban
  const byStatus = KANBAN_COLUMNS.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col.status] = filtered.filter((l) => l.status === col.status);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">CRM / Leads</h1>
          <p className="text-xs text-gray-500 mt-0.5">Customer pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'kanban' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Kanban
            </button>
          </div>
          <Link href="/crm/new" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition">
            + New Lead
          </Link>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone…"
          className="flex-1 px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        {viewMode === 'table' && (
          <SearchableCombobox
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            placeholder="All Statuses"
            clearable
            clearLabel="All Statuses"
            className="w-44"
          />
        )}
      </div>

      {viewMode === 'table' && (
        <>
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
        </>
      )}

      {viewMode === 'kanban' && (
        <>
          {loading && <p className="text-gray-500 text-sm">Loading…</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {!loading && !error && (
            <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
              {KANBAN_COLUMNS.map((col) => {
                const cards = byStatus[col.status] ?? [];
                return (
                  <div key={col.status} className={`flex-shrink-0 w-64 rounded-xl border ${col.border} ${col.bg} flex flex-col`}>
                    {/* Column header */}
                    <div className={`flex items-center justify-between px-3 py-2.5 border-b ${col.border}`}>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${col.bg} ${col.color}`}>{cards.length}</span>
                    </div>
                    {/* Cards */}
                    <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
                      {cards.map((lead) => <KanbanCard key={lead.id} lead={lead} />)}
                      {cards.length === 0 && (
                        <p className="text-xs text-gray-600 text-center mt-4">No leads</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
