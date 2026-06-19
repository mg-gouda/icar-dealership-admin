'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

interface Deal {
  id: string; status: string; purchaseMethod: string; salePrice: number;
  adminFee?: number; insuranceFee?: number; createdAt: string;
  vehicle?: { make: string; model: string; year: number; price: number };
  customer?: { name: string; phone?: string };
  salesRep?: { name: string };
  location?: { name: string };
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_FINANCE', label: 'Pending Finance' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'FINALIZED', label: 'Finalized' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'DEALERSHIP_INSTALLMENT', label: 'Dealership Installment' },
  { value: 'BANK_FINANCING', label: 'Bank Financing' },
];

const KANBAN_COLUMNS: { status: string; label: string; color: string; bg: string; border: string }[] = [
  { status: 'DRAFT',           label: 'Draft',           color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/30' },
  { status: 'PENDING_FINANCE', label: 'Pending Finance', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  { status: 'APPROVED',        label: 'Approved',        color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  { status: 'FINALIZED',       label: 'Finalized',       color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  { status: 'CANCELLED',       label: 'Cancelled',       color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
];

const METHOD_COLOR: Record<string, string> = {
  CASH: 'bg-green-500/20 text-green-300',
  DEALERSHIP_INSTALLMENT: 'bg-blue-500/20 text-blue-300',
  BANK_FINANCING: 'bg-purple-500/20 text-purple-300',
};

function MethodBadge({ method }: { method: string }) {
  const label = method === 'DEALERSHIP_INSTALLMENT' ? 'Installment'
    : method === 'BANK_FINANCING' ? 'Bank' : 'Cash';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${METHOD_COLOR[method] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {label}
    </span>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const total = deal.salePrice + (deal.adminFee ?? 0) + (deal.insuranceFee ?? 0);
  return (
    <div
      onClick={() => router.push(`/deals/${deal.id}`)}
      className="bg-gray-900 border border-white/5 rounded-lg p-3 cursor-pointer hover:border-white/20 hover:bg-gray-800/80 transition space-y-2"
    >
      <p className="text-sm font-medium text-white leading-tight">{deal.customer?.name ?? '—'}</p>
      {deal.vehicle && (
        <p className="text-[11px] text-gray-400">
          {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
        </p>
      )}
      <div className="flex items-center justify-between gap-1">
        <MethodBadge method={deal.purchaseMethod} />
        <span className="text-xs font-semibold text-white tabular-nums">
          {total.toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}
        </span>
      </div>
      {deal.salesRep && (
        <p className="text-[11px] text-gray-500">{deal.salesRep.name}</p>
      )}
      <p className="text-[10px] text-gray-600">
        {new Date(deal.createdAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </div>
  );
}

export default function DealsPage() {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const router = useRouter();

  const { data: deals, loading, error } = useQuery<Deal[]>(
    `/deals?${new URLSearchParams({ ...(status && { status }), ...(method && { purchaseMethod: method }), limit: '200' })}`,
    [status, method],
  );

  const total = (d: Deal) => d.salePrice + (d.adminFee ?? 0) + (d.insuranceFee ?? 0);

  // Group by status for kanban (uses all deals, ignores status filter)
  const { data: allDeals } = useQuery<Deal[]>(`/deals?limit=200`, []);
  const byStatus = KANBAN_COLUMNS.reduce<Record<string, Deal[]>>((acc, col) => {
    acc[col.status] = (allDeals ?? []).filter((d) => d.status === col.status);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Deals</h1>
          <p className="text-xs text-gray-500 mt-0.5">Sales pipeline</p>
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
          <Link href="/deals/new" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition">
            + New Deal
          </Link>
        </div>
      </div>

      {viewMode === 'table' && (
        <>
          <div className="flex gap-3 mb-5">
            <SearchableCombobox
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              placeholder="All Statuses"
              clearable
              clearLabel="All Statuses"
              className="w-44"
            />
            <SearchableCombobox
              options={METHOD_OPTIONS}
              value={method}
              onChange={setMethod}
              placeholder="All Methods"
              clearable
              clearLabel="All Methods"
              className="w-52"
            />
          </div>

          {loading && <p className="text-gray-500 text-sm">Loading…</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {!loading && !error && (
            <div className="rounded-xl border border-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400 text-xs">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                    <th className="text-left px-4 py-3 font-medium">Method</th>
                    <th className="text-left px-4 py-3 font-medium">Sales Rep</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(deals ?? []).map((d) => (
                    <tr key={d.id}
                      onClick={() => router.push(`/deals/${d.id}`)}
                      className="hover:bg-white/5 transition cursor-pointer">
                      <td className="px-4 py-3 text-white font-medium">
                        {d.customer?.name ?? '—'}
                        {d.customer?.phone && <div className="text-xs text-gray-500">{d.customer.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {d.vehicle ? `${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.purchaseMethod?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-gray-400">{d.salesRep?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-white">
                        {total(d).toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                  {deals?.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No deals found.</td></tr>
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
                    <div className={`flex items-center justify-between px-3 py-2.5 border-b ${col.border}`}>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${col.bg} ${col.color}`}>{cards.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
                      {cards.map((deal) => <DealCard key={deal.id} deal={deal} />)}
                      {cards.length === 0 && (
                        <p className="text-xs text-gray-600 text-center mt-4">No deals</p>
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
