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

export default function DealsPage() {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const router = useRouter();
  const { data: deals, loading, error } = useQuery<Deal[]>(
    `/deals?${new URLSearchParams({ ...(status && { status }), ...(method && { purchaseMethod: method }), limit: '50' })}`,
    [status, method],
  );

  const total = (d: Deal) => d.salePrice + (d.adminFee ?? 0) + (d.insuranceFee ?? 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Deals</h1>
          <p className="text-xs text-gray-500 mt-0.5">Sales pipeline</p>
        </div>
        <Link href="/deals/new" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition">
          + New Deal
        </Link>
      </div>

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
    </div>
  );
}
