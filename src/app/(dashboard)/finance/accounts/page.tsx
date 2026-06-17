'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';

interface Account {
  id: string; code: string; name: string; type: string;
  normalBalance: string; active: boolean;
  parent?: { code: string; name: string };
  _count?: { debitLines: number; creditLines: number };
}

const ACCOUNT_TYPES = ['Asset','Liability','Equity','Revenue','Expense','ContraAsset','ContraLiability','ContraEquity','ContraRevenue','ContraExpense'];

export default function AccountsPage() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'Asset', normalBalance: 'DEBIT', parentId: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const { data: res, loading, reload } = useQuery<{ items: Account[]; total: number }>(
    `/finance/accounts?limit=200`,
  );

  const accounts = res?.items ?? [];
  const filtered = search
    ? accounts.filter((a) => a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase()))
    : accounts;

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code || !form.name) { setErr('Code and name required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/accounts', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code, name: form.name, type: form.type,
          normalBalance: form.normalBalance,
          parentId: form.parentId || undefined,
        }),
      });
      setShowCreate(false);
      setForm({ code: '', name: '', type: 'Asset', normalBalance: 'DEBIT', parentId: '' });
      reload();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Chart of Accounts</h1>
          <p className="text-xs text-gray-500 mt-0.5">{res?.total ?? 0} accounts</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition">
          + Account
        </button>
      </div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by code or name…"
        className="w-full mb-4 px-3 py-2 bg-gray-900 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
      />

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium w-24">Code</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Normal</th>
              <th className="px-4 py-3 text-left font-medium">Parent</th>
              <th className="px-4 py-3 text-center font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((a) => (
              <tr key={a.id} className="hover:bg-white/5 transition">
                <td className="px-4 py-2.5 font-mono text-blue-400 text-xs">{a.code}</td>
                <td className="px-4 py-2.5 text-white">{a.name}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{a.type}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{a.normalBalance}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {a.parent ? `${a.parent.code} ${a.parent.name}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${a.active ? 'bg-green-400' : 'bg-gray-600'}`} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No accounts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">New Account</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Code *</label>
                  <input required value={form.code} onChange={(e) => set('code', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => set('type', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
                    {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Normal Balance</label>
                <select value={form.normalBalance} onChange={(e) => set('normalBalance', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </select></div>
              {err && <p className="text-red-400 text-xs">{err}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
