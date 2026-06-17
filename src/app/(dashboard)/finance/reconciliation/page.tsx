'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';

interface RecLine {
  id: string; amount: number; date: string; label?: string; type: string;
  journalEntry?: { reference?: string; description?: string };
  bankStatementLine?: { description?: string; reference?: string };
}

export default function ReconciliationPage() {
  const { data: res, loading, reload } = useQuery<{ items: RecLine[]; total: number }>(
    '/finance/reconciliation/unreconciled-lines?limit=50',
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const lines = res?.items ?? [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(lines.length === selected.size ? new Set() : new Set(lines.map((l) => l.id)));
  }

  async function reconcile() {
    if (selected.size < 2) { alert('Select at least 2 lines to reconcile.'); return; }
    setSaving(true);
    try {
      await apiFetch('/finance/reconciliation', {
        method: 'POST',
        body: JSON.stringify({ lineIds: Array.from(selected) }),
      });
      setSelected(new Set());
      reload();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  const selectedAmt = lines
    .filter((l) => selected.has(l.id))
    .reduce((s, l) => s + Number(l.amount), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Bank Reconciliation</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {res?.total ?? 0} unreconciled lines
          </p>
        </div>
        {selected.size >= 2 && (
          <div className="flex items-center gap-3">
            <span className={`text-sm font-mono ${Math.abs(selectedAmt) < 0.01 ? 'text-green-400' : 'text-amber-400'}`}>
              Net: {selectedAmt >= 0 ? '+' : ''}{selectedAmt.toFixed(2)}
            </span>
            <button onClick={reconcile} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg transition">
              {saving ? '…' : `Reconcile ${selected.size} lines`}
            </button>
          </div>
        )}
      </div>

      {selected.size > 0 && Math.abs(selectedAmt) > 0.01 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          Selected lines don't balance (net {selectedAmt.toFixed(2)}). Reconciliation requires a zero net.
        </div>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">
                <input type="checkbox"
                  checked={lines.length > 0 && selected.size === lines.length}
                  onChange={selectAll}
                  className="rounded border-white/20 bg-gray-800" />
              </th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Label / Reference</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {lines.map((l) => (
              <tr key={l.id}
                onClick={() => toggle(l.id)}
                className={`cursor-pointer transition ${selected.has(l.id) ? 'bg-blue-900/20' : 'hover:bg-white/5'}`}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)}
                    className="rounded border-white/20 bg-gray-800" onClick={(e) => e.stopPropagation()} />
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">
                  {new Date(l.date).toLocaleDateString('en-EG')}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    l.type === 'GL' ? 'bg-purple-900/40 text-purple-300' : 'bg-blue-900/40 text-blue-300'
                  }`}>{l.type}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-300">
                  {l.label ?? l.journalEntry?.description ?? l.bankStatementLine?.description ?? '—'}
                  {(l.journalEntry?.reference ?? l.bankStatementLine?.reference) && (
                    <span className="ml-2 text-xs text-gray-500 font-mono">
                      {l.journalEntry?.reference ?? l.bankStatementLine?.reference}
                    </span>
                  )}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${Number(l.amount) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {Number(l.amount) >= 0 ? '+' : ''}{Number(l.amount).toLocaleString()}
                </td>
              </tr>
            ))}
            {lines.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600 text-sm">
                All lines reconciled.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
