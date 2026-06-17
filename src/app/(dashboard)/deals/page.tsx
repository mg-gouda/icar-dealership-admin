'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';

interface Deal {
  id: string; status: string; purchaseMethod: string; salePrice: number;
  adminFee: number; insuranceFee: number; createdAt: string;
  vehicle?: { make: string; model: string; year: number; stockNumber: string };
  customer?: { firstName: string; lastName: string; phone: string };
  salesRep?: { firstName: string; lastName: string };
  location?: { name: string };
}

const STATUSES = ['', 'DRAFT', 'PENDING_FINANCE', 'APPROVED', 'FINALIZED', 'CANCELLED'];
const METHODS = ['', 'CASH', 'DEALERSHIP_INSTALLMENT', 'BANK_FINANCING'];

export default function DealsPage() {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
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
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500">
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)}
          className="px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500">
          {METHODS.map((m) => <option key={m} value={m}>{m || 'All Methods'}</option>)}
        </select>
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
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(deals ?? []).map((d) => (
                <tr key={d.id} className="hover:bg-white/2 transition">
                  <td className="px-4 py-3 text-white font-medium">
                    {d.customer ? `${d.customer.firstName} ${d.customer.lastName}` : '—'}
                    {d.customer?.phone && <div className="text-xs text-gray-500">{d.customer.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {d.vehicle ? `${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}` : '—'}
                    {d.vehicle?.stockNumber && <div className="text-xs text-gray-500 font-mono">{d.vehicle.stockNumber}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{d.purchaseMethod?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {d.salesRep ? `${d.salesRep.firstName} ${d.salesRep.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {total(d).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/deals/${d.id}`} className="text-blue-400 hover:text-blue-300 text-xs">View →</Link>
                  </td>
                </tr>
              ))}
              {deals?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">No deals found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
