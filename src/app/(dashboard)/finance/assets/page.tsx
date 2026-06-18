'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface Asset {
  id: string; name: string; code?: string; acquisitionDate: string;
  acquisitionCost: number; residualValue: number; usefulLifeMonths: number;
  depreciationMethod: string; status: string;
  accumulatedDepreciation?: number;
  netBookValue?: number;
}

interface Account { id: string; code: string; name: string; }

const METHODS = [
  { value: 'STRAIGHT_LINE', label: 'Straight Line' },
  { value: 'DECLINING_BALANCE', label: 'Declining Balance' },
];

export default function AssetsPage() {
  const router = useRouter();
  const { data: res, loading, reload } = useQuery<{ items: Asset[]; total: number }>('/finance/assets');
  const { data: accounts } = useQuery<{ items: Account[] }>('/finance/accounts?limit=200');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', acquisitionDate: new Date().toISOString().slice(0, 10),
    acquisitionCost: '', residualValue: '0', usefulLifeMonths: '60',
    depreciationMethod: 'STRAIGHT_LINE', assetAccountId: '', depreciationAccountId: '',
    accumulatedAccountId: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const assets = res?.items ?? [];
  const accountOpts = (accounts?.items ?? []).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.acquisitionCost) { setErr('Name and cost required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          acquisitionDate: new Date(form.acquisitionDate).toISOString(),
          acquisitionCost: parseFloat(form.acquisitionCost),
          residualValue: parseFloat(form.residualValue) || 0,
          usefulLifeMonths: parseInt(form.usefulLifeMonths),
          depreciationMethod: form.depreciationMethod,
          assetAccountId: form.assetAccountId || undefined,
          depreciationAccountId: form.depreciationAccountId || undefined,
          accumulatedDepreciationAccountId: form.accumulatedAccountId || undefined,
        }),
      });
      setShowCreate(false); reload();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Fixed Assets</h1>
          <p className="text-xs text-gray-500 mt-0.5">{res?.total ?? 0} assets</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition">
          + Asset
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Method</th>
              <th className="px-4 py-3 text-left font-medium">Acquired</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
              <th className="px-4 py-3 text-right font-medium">Depreciated</th>
              <th className="px-4 py-3 text-right font-medium">NBV</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {assets.map((a) => (
              <tr key={a.id} onClick={() => router.push(`/finance/assets/${a.id}`)} className="hover:bg-white/5 transition cursor-pointer">
                <td className="px-4 py-2.5 text-white font-medium">{a.name}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{a.depreciationMethod.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(a.acquisitionDate).toLocaleDateString('en-EG')}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">
                  {Number(a.acquisitionCost).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-amber-400">
                  {a.accumulatedDepreciation != null ? Number(a.accumulatedDepreciation).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white font-medium">
                  {a.netBookValue != null ? Number(a.netBookValue).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    a.status === 'ACTIVE' ? 'bg-green-900/40 text-green-300' :
                    a.status === 'FULLY_DEPRECIATED' ? 'bg-gray-800 text-gray-400' :
                    'bg-red-900/40 text-red-300'
                  }`}>{a.status}</span>
                </td>
              </tr>
            ))}
            {assets.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">No fixed assets.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">New Fixed Asset</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white text-lg">×</button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div><label className="block text-xs text-gray-500 mb-1">Asset Name *</label>
                <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Showroom Display Screens"
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Acquisition Date</label>
                  <input type="date" value={form.acquisitionDate} onChange={(e) => set('acquisitionDate', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Useful Life (months)</label>
                  <input type="number" value={form.usefulLifeMonths} onChange={(e) => set('usefulLifeMonths', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Cost (EGP) *</label>
                  <input type="number" required value={form.acquisitionCost} onChange={(e) => set('acquisitionCost', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Residual Value</label>
                  <input type="number" value={form.residualValue} onChange={(e) => set('residualValue', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              </div>
              <SearchableCombobox label="Method" options={METHODS} value={form.depreciationMethod} onChange={(v) => set('depreciationMethod', v)} />
              <SearchableCombobox label="Asset Account" options={accountOpts} value={form.assetAccountId} onChange={(v) => set('assetAccountId', v)} placeholder="Select…" clearable />
              <SearchableCombobox label="Depreciation Expense Account" options={accountOpts} value={form.depreciationAccountId} onChange={(v) => set('depreciationAccountId', v)} placeholder="Select…" clearable />
              <SearchableCombobox label="Accumulated Depreciation Account" options={accountOpts} value={form.accumulatedAccountId} onChange={(v) => set('accumulatedAccountId', v)} placeholder="Select…" clearable />
              {err && <p className="text-red-400 text-xs">{err}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : 'Create Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
