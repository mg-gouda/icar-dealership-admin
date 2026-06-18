'use client';

import { useQuery, apiFetch } from '../../../../lib/useApi';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface BankAccount { id: string; name: string; accountNumber?: string; bank?: string; }
interface BankStatement {
  id: string; reference: string; date: string; startingBalance: number;
  endingBalance: number; status: string; bankAccount?: { name: string };
  _count?: { lines: number };
}

export default function BankStatementsPage() {
  const router = useRouter();
  const { data: statements, loading, reload } = useQuery<BankStatement[]>('/finance/bank-statements');
  const { data: bankAccounts } = useQuery<BankAccount[]>('/finance/bank-statements/bank-accounts');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ bankAccountId: '', reference: '', date: new Date().toISOString().slice(0, 10), startingBalance: '', endingBalance: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const stmts = Array.isArray(statements) ? statements : [];
  const baOpts = (Array.isArray(bankAccounts) ? bankAccounts : []).map((b) => ({ value: b.id, label: `${b.name}${b.bank ? ` — ${b.bank}` : ''}` }));

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bankAccountId || !form.reference) { setErr('Bank account and reference required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/bank-statements', {
        method: 'POST',
        body: JSON.stringify({
          bankAccountId: form.bankAccountId,
          reference: form.reference,
          date: new Date(form.date).toISOString(),
          startingBalance: parseFloat(form.startingBalance) || 0,
          endingBalance: parseFloat(form.endingBalance) || 0,
        }),
      });
      setShowCreate(false); reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Bank Statements</h1>
          <p className="text-xs text-gray-500 mt-0.5">Import & reconcile bank transactions</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition">
          + Statement
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Reference</th>
              <th className="px-4 py-3 text-left font-medium">Bank Account</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Opening</th>
              <th className="px-4 py-3 text-right font-medium">Closing</th>
              <th className="px-4 py-3 text-center font-medium">Lines</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {stmts.map((s) => (
              <tr key={s.id} onClick={() => router.push(`/finance/bank-statements/${s.id}`)} className="hover:bg-white/5 cursor-pointer transition">
                <td className="px-4 py-2.5 text-white font-mono text-xs">{s.reference}</td>
                <td className="px-4 py-2.5 text-gray-300">{s.bankAccount?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(s.date).toLocaleDateString('en-EG')}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">{Number(s.startingBalance).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">{Number(s.endingBalance).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{s._count?.lines ?? 0}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    s.status === 'RECONCILED' ? 'bg-green-900/40 text-green-300' :
                    s.status === 'IN_PROGRESS' ? 'bg-blue-900/40 text-blue-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>{s.status}</span>
                </td>
              </tr>
            ))}
            {stmts.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">No bank statements imported.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">New Bank Statement</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white text-lg">×</button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3">
              <SearchableCombobox label="Bank Account *" options={baOpts} value={form.bankAccountId} onChange={(v) => set('bankAccountId', v)} placeholder="Select bank account…" />
              <div><label className="block text-xs text-gray-500 mb-1">Reference *</label>
                <input required value={form.reference} onChange={(e) => set('reference', e.target.value)}
                  placeholder="e.g. STMT-2026-06"
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Opening Balance</label>
                  <input type="number" value={form.startingBalance} onChange={(e) => set('startingBalance', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Closing Balance</label>
                  <input type="number" value={form.endingBalance} onChange={(e) => set('endingBalance', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              </div>
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
