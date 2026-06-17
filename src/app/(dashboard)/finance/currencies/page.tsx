'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';

interface Currency {
  id: string; code: string; symbol: string; decimalPlaces: number; active: boolean;
  rates?: { rate: number; date: string }[];
}

export default function CurrenciesPage() {
  const { data: currencies, loading, reload } = useQuery<Currency[]>('/finance/currencies');
  const [adding, setAdding] = useState<string | null>(null); // currency id being rate-added
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function addRate(currencyId: string) {
    if (!rate) return;
    setSaving(true);
    try {
      await apiFetch(`/finance/currencies/${currencyId}/rates`, {
        method: 'POST',
        body: JSON.stringify({ rate: parseFloat(rate), date: new Date(date).toISOString() }),
      });
      setAdding(null); setRate(''); reload();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function toggle(id: string) {
    try {
      await apiFetch(`/finance/currencies/${id}/toggle-active`, { method: 'PATCH' });
      reload();
    } catch (e: any) { alert(e.message); }
  }

  const list = Array.isArray(currencies) ? currencies : [];

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-white mb-1">Currencies</h1>
      <p className="text-xs text-gray-500 mb-6">Exchange rates — manual entry</p>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/5 bg-gray-900 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-white">{c.symbol}</span>
                <div>
                  <p className="text-sm font-medium text-white">{c.code}</p>
                  <p className="text-xs text-gray-500">{c.decimalPlaces} decimal places</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.code !== 'EGP' && (
                  <button onClick={() => { setAdding(c.id); setRate(''); }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition">+ Rate</button>
                )}
                <button onClick={() => toggle(c.id)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition ${
                    c.active ? 'bg-green-900/40 text-green-300 hover:bg-red-900/40 hover:text-red-300'
                              : 'bg-gray-800 text-gray-500 hover:bg-green-900/40 hover:text-green-300'
                  }`}>
                  {c.active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>

            {adding === c.id && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Rate (EGP per 1 {c.code})</label>
                  <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g. 49.50"
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <button onClick={() => addRate(c.id)} disabled={saving}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : 'Save'}
                </button>
                <button onClick={() => setAdding(null)}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
