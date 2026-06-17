'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';

interface Deal {
  id: string; status: string; purchaseMethod: string; salePrice: number;
  adminFee?: number; insuranceFee?: number; createdAt: string;
  vehicle?: { make: string; model: string; year: number; vin?: string };
  customer?: { name: string; phone?: string; email?: string };
  salesRep?: { name: string };
  location?: { name: string };
  installmentPlan?: {
    downPayment: number; installmentAmount: number; numberOfInstallments: number;
    installments: { id: string; dueDate: string; amount: number; status: string; sequence: number }[];
  };
  financeApplication?: { status?: string; bankName?: string; approvedAmount?: number };
  invoices?: { id: string; status: string; amountTotal: number; dueDate?: string }[];
  commissions?: { user: { name: string }; amount: number; status: string }[];
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: deal, loading, error, reload } = useQuery<Deal>(`/deals/${id}`);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  async function finalize() {
    if (!confirm('Finalize this deal? This will post GL entries and mark the vehicle SOLD.')) return;
    setActionLoading(true);
    setActionError('');
    try {
      await apiFetch(`/deals/${id}/finalize`, { method: 'POST' });
      reload();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">{error}</div>;
  if (!deal) return null;

  const subtotal = deal.salePrice + (deal.adminFee ?? 0) + (deal.insuranceFee ?? 0);
  const vat = deal.salePrice * 0.14;
  const total = subtotal + vat;

  const canFinalize = deal.status === 'DRAFT' || deal.status === 'PENDING_FINANCE';

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-xs mb-5 transition">← Back</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Deal #{id.slice(-8).toUpperCase()}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{deal.purchaseMethod?.replace(/_/g, ' ')} · {deal.location?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={deal.status} />
          {canFinalize && (
            <button
              onClick={finalize}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm rounded-lg transition"
            >
              {actionLoading ? 'Finalizing…' : 'Finalize Deal'}
            </button>
          )}
        </div>
      </div>

      {actionError && <p className="mb-4 text-red-400 text-sm">{actionError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Customer */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Customer</p>
          <p className="text-white font-medium">{deal.customer?.name ?? '—'}</p>
          <p className="text-gray-400 text-sm">{deal.customer?.phone}</p>
          <p className="text-gray-400 text-sm">{deal.customer?.email}</p>
        </div>
        {/* Vehicle */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Vehicle</p>
          <p className="text-white font-medium">{deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : '—'}</p>
          {deal.vehicle?.vin && <p className="text-gray-400 text-sm font-mono">VIN: {deal.vehicle.vin}</p>}
        </div>
        {/* Pricing */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Pricing (EGP)</p>
          {[
            ['Sale Price', deal.salePrice],
            ['Admin Fee', deal.adminFee],
            ['Insurance Fee', deal.insuranceFee],
            ['VAT (14%)', vat],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
              <span className="text-gray-400">{label as string}</span>
              <span className="text-white">{Number(val).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm py-2 font-semibold text-white mt-1">
            <span>Total</span>
            <span>{total.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })}</span>
          </div>
        </div>
        {/* Sales Rep */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Sales Rep</p>
          <p className="text-white font-medium">{deal.salesRep?.name ?? '—'}</p>
          {deal.commissions?.map((c, i) => (
            <div key={i} className="mt-2 text-sm text-gray-400 flex items-center gap-2">
              {c.user?.name} · {Number(c.amount).toLocaleString()} EGP · <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Installment Plan */}
      {deal.installmentPlan && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4 mb-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Installment Plan</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div><p className="text-xs text-gray-500">Down Payment</p><p className="text-white font-medium">{Number(deal.installmentPlan.downPayment).toLocaleString()} EGP</p></div>
            <div><p className="text-xs text-gray-500">Monthly</p><p className="text-white font-medium">{Number(deal.installmentPlan.installmentAmount).toLocaleString()} EGP</p></div>
            <div><p className="text-xs text-gray-500">Installments</p><p className="text-white font-medium">{deal.installmentPlan.numberOfInstallments}</p></div>
          </div>
          <table className="w-full text-xs">
            <thead className="text-gray-400">
              <tr>
                <th className="text-left pb-2">#</th>
                <th className="text-left pb-2">Due</th>
                <th className="text-right pb-2">Amount</th>
                <th className="text-left pb-2 pl-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deal.installmentPlan.installments.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 text-gray-400">{l.sequence}</td>
                  <td className="py-1.5 text-gray-300">{new Date(l.dueDate).toLocaleDateString()}</td>
                  <td className="py-1.5 text-right text-white">{Number(l.amount).toLocaleString()} EGP</td>
                  <td className="py-1.5 pl-3"><StatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices */}
      {(deal.invoices?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Invoices</p>
          <table className="w-full text-xs">
            <thead className="text-gray-400"><tr>
              <th className="text-right pb-2">Total</th>
              <th className="text-left pb-2 pl-3">Due Date</th>
              <th className="text-left pb-2 pl-3">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {deal.invoices!.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/5 cursor-pointer transition"
                  onClick={() => router.push(`/finance/invoices/${inv.id}`)}>
                  <td className="py-1.5 text-right text-white">{Number(inv.amountTotal).toLocaleString()} EGP</td>
                  <td className="py-1.5 pl-3 text-gray-400">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-EG') : '—'}</td>
                  <td className="py-1.5 pl-3"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
