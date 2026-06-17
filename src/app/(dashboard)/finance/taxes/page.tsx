'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface TaxGroup { id: string; name: string; _count?: { taxes: number }; }
interface Tax {
  id: string; name: string; amount: number; computation: string;
  scope: string; includedInPrice: boolean; active?: boolean;
  taxGroup?: { name: string }; account?: { code: string; name: string };
}
interface Account { id: string; code: string; name: string; }

const COMPUTATIONS = [
  { value: 'PERCENT', label: 'Percentage' },
  { value: 'FIXED', label: 'Fixed Amount' },
];
const SCOPES = [
  { value: 'SALE', label: 'Sales' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'ALL', label: 'Both' },
];

export default function TaxesPage() {
  const { data: taxes, loading, reload } = useQuery<Tax[]>('/finance/taxes');
  const { data: groups, reload: reloadGroups } = useQuery<TaxGroup[]>('/finance/taxes/groups');
  const { data: accountsRes } = useQuery<{ items: Account[] }>('/finance/accounts?limit=200');

  const [tab, setTab] = useState<'rates' | 'groups'>('rates');
  const [showTax, setShowTax] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [taxForm, setTaxForm] = useState({
    name: '', amount: '', computation: 'PERCENT', scope: 'SALE',
    includedInPrice: false, taxGroupId: '', accountId: '',
  });
  const [groupForm, setGroupForm] = useState({ name: '' });

  const taxList = Array.isArray(taxes) ? taxes : [];
  const groupList = Array.isArray(groups) ? groups : [];
  const accountOpts = (accountsRes?.items ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));
  const groupOpts = groupList.map((g) => ({ value: g.id, label: g.name }));

  function setT(k: string, v: string | boolean) { setTaxForm((p) => ({ ...p, [k]: v })); }

  async function createTax(e: React.FormEvent) {
    e.preventDefault();
    if (!taxForm.name || !taxForm.amount) { setErr('Name and amount required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/taxes', {
        method: 'POST',
        body: JSON.stringify({
          name: taxForm.name, amount: parseFloat(taxForm.amount),
          computation: taxForm.computation, scope: taxForm.scope,
          includedInPrice: taxForm.includedInPrice,
          taxGroupId: taxForm.taxGroupId || undefined,
          accountId: taxForm.accountId || undefined,
        }),
      });
      setShowTax(false); reload();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/finance/taxes/groups', { method: 'POST', body: JSON.stringify({ name: groupForm.name }) });
      setShowGroup(false); reloadGroups();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Taxes</h1>
          <p className="text-xs text-gray-500 mt-0.5">VAT & withholding tax configuration</p>
        </div>
        <button onClick={() => tab === 'rates' ? setShowTax(true) : setShowGroup(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition">
          {tab === 'rates' ? '+ Tax Rate' : '+ Tax Group'}
        </button>
      </div>

      <div className="flex gap-1 mb-5">
        {(['rates', 'groups'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs rounded-lg transition capitalize ${tab === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {tab === 'rates' && (
        <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Scope</th>
                <th className="px-4 py-3 text-left font-medium">Group</th>
                <th className="px-4 py-3 text-left font-medium">GL Account</th>
                <th className="px-4 py-3 text-center font-medium">In Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {taxList.map((t) => (
                <tr key={t.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-2.5 text-white font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-blue-300 font-mono text-xs">
                    {t.computation === 'PERCENT' ? `${t.amount}%` : `${Number(t.amount).toLocaleString()} EGP`}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{t.computation}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{t.scope}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{t.taxGroup?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">
                    {t.account ? `${t.account.code} ${t.account.name}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${t.includedInPrice ? 'bg-green-400' : 'bg-gray-600'}`} />
                  </td>
                </tr>
              ))}
              {taxList.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">No tax rates configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'groups' && (
        <div className="space-y-2">
          {groupList.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-gray-900 px-5 py-4">
              <span className="text-white font-medium">{g.name}</span>
              <span className="text-xs text-gray-500">{g._count?.taxes ?? 0} rates</span>
            </div>
          ))}
          {groupList.length === 0 && !loading && (
            <p className="text-gray-600 text-sm">No tax groups.</p>
          )}
        </div>
      )}

      {/* Create Tax dialog */}
      {showTax && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTax(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">New Tax Rate</h2>
              <button onClick={() => setShowTax(false)} className="text-gray-500 hover:text-white text-lg">×</button>
            </div>
            <form onSubmit={createTax} className="p-5 space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input required value={taxForm.name} onChange={(e) => setT('name', e.target.value)}
                  placeholder="e.g. VAT 14%"
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Amount *</label>
                  <input required type="number" step="0.01" value={taxForm.amount} onChange={(e) => setT('amount', e.target.value)}
                    placeholder="14"
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
                <SearchableCombobox label="Computation" options={COMPUTATIONS} value={taxForm.computation} onChange={(v) => setT('computation', v)} />
              </div>
              <SearchableCombobox label="Scope" options={SCOPES} value={taxForm.scope} onChange={(v) => setT('scope', v)} />
              <SearchableCombobox label="Tax Group" options={groupOpts} value={taxForm.taxGroupId} onChange={(v) => setT('taxGroupId', v)} placeholder="None" clearable />
              <SearchableCombobox label="GL Account" options={accountOpts} value={taxForm.accountId} onChange={(v) => setT('accountId', v)} placeholder="Select…" clearable />
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={taxForm.includedInPrice} onChange={(e) => setT('includedInPrice', e.target.checked)}
                  className="rounded border-white/20" />
                Included in price
              </label>
              {err && <p className="text-red-400 text-xs">{err}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowTax(false)}
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

      {/* Create Group dialog */}
      {showGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGroup(false)} />
          <div className="relative w-full max-w-xs rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">New Tax Group</h2>
            <form onSubmit={createGroup} className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input required value={groupForm.name} onChange={(e) => setGroupForm({ name: e.target.value })}
                  placeholder="e.g. VAT"
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowGroup(false)}
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
