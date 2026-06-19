'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface Commission {
  id: string; status: string; roleInDeal: string;
  baseAmount: number; splitPercentage: number; calculatedAmount: number;
  accruedAt?: string; payableAt?: string; paidAt?: string;
  user: { id: string; name: string; email: string };
  deal: {
    id: string; status: string; salePrice: number;
    vehicle?: { make: string; model: string; year: number };
    location?: { name: string };
  };
  commissionPlan?: { name: string };
}

interface Summary { status: string; count: number; total: number; }
interface Journal { id: string; name: string; code: string; type: string; }

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  { value: 'ACCRUED', label: 'Accrued' },
  { value: 'PAYABLE', label: 'Payable' },
  { value: 'PAID', label: 'Paid' },
];

export default function CommissionsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPay, setShowPay] = useState(false);
  const [journalId, setJournalId] = useState('');
  const [paying, setPaying] = useState(false);

  const qs = statusFilter ? `?status=${statusFilter}&limit=50` : '?limit=50';
  const { data: res, loading, reload } = useQuery<{ items: Commission[]; total: number }>(`/commissions${qs}`);
  const { data: summary } = useQuery<Summary[]>('/commissions/summary');
  const { data: journals } = useQuery<Journal[]>('/finance/journals');

  const items = res?.items ?? [];
  const summaryMap = Object.fromEntries((summary ?? []).map((s) => [s.status, s]));

  const journalOpts = (Array.isArray(journals) ? journals : [])
    .filter((j) => ['BANK', 'CASH'].includes(j.type))
    .map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));

  const payableSelected = items.filter((c) => selected.has(c.id) && c.status === 'PAYABLE');
  const payableTotal = payableSelected.reduce((s, c) => s + Number(c.calculatedAmount), 0);

  function toggle(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function markPayable() {
    const accrued = items.filter((c) => selected.has(c.id) && c.status === 'ACCRUED');
    for (const c of accrued) {
      await apiFetch(`/commissions/${c.id}/mark-payable`, { method: 'PATCH' }).catch(() => {});
    }
    setSelected(new Set()); reload();
  }

  async function batchPay(e: React.FormEvent) {
    e.preventDefault();
    if (!journalId) return;
    setPaying(true);
    try {
      await apiFetch('/commissions/batch-pay', {
        method: 'POST',
        body: JSON.stringify({ commissionIds: payableSelected.map((c) => c.id), journalId }),
      });
      setShowPay(false); setSelected(new Set()); reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPaying(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Sales Commissions</h1>
          <p className="text-xs text-gray-500 mt-0.5">{res?.total ?? 0} records</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && items.some((c) => selected.has(c.id) && c.status === 'ACCRUED') && (
            <button onClick={markPayable}
              className="px-3 py-1.5 text-xs text-amber-400 border border-amber-400/30 hover:bg-amber-400/10 rounded-lg transition">
              Mark Payable ({Array.from(selected).filter((id) => items.find((c) => c.id === id)?.status === 'ACCRUED').length})
            </button>
          )}
          {payableSelected.length > 0 && (
            <button onClick={() => setShowPay(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition">
              Pay {payableSelected.length} ({payableTotal.toLocaleString()} EGP)
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {['ACCRUED', 'PAYABLE', 'PAID'].map((s) => (
          <div key={s} className={`rounded-xl border p-4 cursor-pointer transition ${
            statusFilter === s ? 'border-blue-500/50 bg-blue-900/20' : 'border-white/5 bg-gray-900 hover:border-white/10'
          }`} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}>
            <p className="text-xs text-gray-500 mb-1">{s}</p>
            <p className="text-xl font-semibold text-white tabular-nums">
              {(summaryMap[s]?.total ?? 0).toLocaleString()}
              <span className="text-xs text-gray-500 ml-1">EGP</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{summaryMap[s]?.count ?? 0} commissions</p>
          </div>
        ))}
      </div>

      <div className="mb-4 w-48">
        <SearchableCombobox options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} placeholder="Filter by status" />
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 w-8" />
              <th className="px-4 py-3 text-left font-medium">Rep</th>
              <th className="px-4 py-3 text-left font-medium">Deal / Vehicle</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-right font-medium">Split</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((c) => (
              <tr key={c.id} onClick={() => toggle(c.id)}
                className={`cursor-pointer transition ${selected.has(c.id) ? 'bg-blue-900/20' : 'hover:bg-white/5'}`}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-white/20 bg-gray-800" />
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-white text-xs font-medium">{c.user.name}</p>
                  <p className="text-gray-500 text-xs">{c.user.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-gray-300 text-xs">
                    {c.deal.vehicle ? `${c.deal.vehicle.year} ${c.deal.vehicle.make} ${c.deal.vehicle.model}` : c.deal.id.slice(-8)}
                  </p>
                  <p className="text-gray-500 text-xs">{c.deal.location?.name}</p>
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{c.roleInDeal.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{c.commissionPlan?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-right text-gray-400 text-xs tabular-nums">{c.splitPercentage}%</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-white">
                  {Number(c.calculatedAmount).toLocaleString()}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {(c.paidAt ?? c.payableAt ?? c.accruedAt)
                    ? new Date(c.paidAt ?? c.payableAt ?? c.accruedAt!).toLocaleDateString('en-EG')
                    : '—'}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-600 text-sm">No commissions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Batch Pay dialog */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPay(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Pay Commissions</h2>
            <p className="text-xs text-gray-400 mb-4">
              {payableSelected.length} commissions · {payableTotal.toLocaleString()} EGP total
            </p>
            <form onSubmit={batchPay} className="space-y-3">
              <SearchableCombobox
                label="Payment Journal *"
                options={journalOpts}
                value={journalId}
                onChange={setJournalId}
                placeholder="Select bank/cash journal…"
              />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPay(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={paying || !journalId}
                  className="flex-1 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg transition">
                  {paying ? '…' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
