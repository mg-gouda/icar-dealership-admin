'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface JournalEntry {
  id: string;
  date: string;
  ref?: string;
  status: string;
  journal?: { name: string; code: string };
  lines?: { debit: number; credit: number }[];
  reversedEntryId?: string;
  reversalEntry?: { id: string } | null;
}

interface EntryLine { accountId: string; debit: string; credit: string; label: string; }

const EMPTY_LINE = (): EntryLine => ({ accountId: '', debit: '', credit: '', label: '' });

export default function GlPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useQuery<{ items: JournalEntry[]; total: number }>(
    '/finance/gl?limit=30',
  );
  const { data: journalsRaw } = useQuery<any[]>('/finance/gl/journals');
  const { data: accountsRaw } = useQuery<{ items: any[] }>('/finance/gl/accounts?limit=200');

  const entries = data?.items ?? [];
  const journals = Array.isArray(journalsRaw) ? journalsRaw : [];
  const accounts = accountsRaw?.items ?? [];

  const journalOpts = journals.map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));
  const accountOpts = accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  // New entry dialog
  const [showNew, setShowNew] = useState(false);
  const [generatingRecurring, setGeneratingRecurring] = useState(false);

  async function generateRecurring() {
    setGeneratingRecurring(true);
    try {
      const res = await apiFetch<{ generated: number }>('/finance/gl/generate-recurring', { method: 'POST' });
      alert(`Generated ${(res as any).generated} recurring journal entries.`);
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setGeneratingRecurring(false); }
  }
  const [form, setForm] = useState({ journalId: '', date: new Date().toISOString().split('T')[0], ref: '', notes: '' });
  const [lines, setLines] = useState<EntryLine[]>([EMPTY_LINE(), EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  function setLine(i: number, k: keyof EntryLine, v: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }

  function addLine() { setLines((prev) => [...prev, EMPTY_LINE()]); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  // Balance check
  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.005;

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!form.journalId) { setSaveErr('Select a journal.'); return; }
    if (!balanced) { setSaveErr('Entry must balance (debits = credits).'); return; }
    const validLines = lines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { setSaveErr('At least 2 lines required.'); return; }

    setSaving(true); setSaveErr('');
    try {
      await apiFetch('/finance/gl/entries', {
        method: 'POST',
        body: JSON.stringify({
          journalId: form.journalId,
          date: form.date,
          ref: form.ref || undefined,
          notes: form.notes || undefined,
          lines: validLines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            label: l.label || undefined,
          })),
        }),
      });
      setShowNew(false);
      setForm({ journalId: '', date: new Date().toISOString().split('T')[0], ref: '', notes: '' });
      setLines([EMPTY_LINE(), EMPTY_LINE()]);
      reload();
    } catch (err: any) { setSaveErr(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Journal Entries</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            ← Finance
          </Link>
          <Link href="/finance/reports" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            Reports
          </Link>
          <button onClick={generateRecurring} disabled={generatingRecurring}
            className="px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg transition">
            {generatingRecurring ? '…' : 'Generate Recurring'}
          </button>
          <button onClick={() => setShowNew(true)}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium">
            + New Entry
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        {loading && <p className="p-6 text-gray-500 text-sm">Loading…</p>}
        {error && <p className="p-6 text-red-400 text-sm">{error}</p>}
        {!loading && (
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 text-gray-400 text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Ref</th>
                <th className="px-4 py-3 text-left font-medium">Journal</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e) => {
                const totalDebit = e.lines?.reduce((s, l) => s + Number(l.debit), 0) ?? 0;
                const totalCredit = e.lines?.reduce((s, l) => s + Number(l.credit), 0) ?? 0;
                return (
                  <tr key={e.id} onClick={() => router.push(`/finance/gl/${e.id}`)}
                    className="hover:bg-white/5 transition cursor-pointer">
                    <td className="px-4 py-2.5 text-gray-300 text-xs">{new Date(e.date).toLocaleDateString('en-EG')}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="font-mono text-gray-300">{e.ref ?? '—'}</span>
                      {e.reversedEntryId && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700 text-gray-300">
                          REV OF …{e.reversedEntryId.slice(-6)}
                        </span>
                      )}
                      {e.reversalEntry && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">
                          REVERSED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{e.journal?.code ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-white tabular-nums">
                      {totalDebit > 0 ? totalDebit.toLocaleString('en-EG', { maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-white tabular-nums">
                      {totalCredit > 0 ? totalCredit.toLocaleString('en-EG', { maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No journal entries yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New Entry Dialog */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-gray-900 border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-sm font-semibold text-white">New Journal Entry</h2>
              <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>

            <form onSubmit={submitEntry} className="p-5 space-y-4">
              {/* Header fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <SearchableCombobox label="Journal *" options={journalOpts} value={form.journalId}
                    onChange={(v) => setForm({ ...form, journalId: v })} placeholder="Select journal" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ref #</label>
                  <input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="grid grid-cols-[1fr_1fr_100px_100px_24px] gap-1.5 text-xs text-gray-500 mb-1.5 px-1">
                  <span>Account</span><span>Label</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span />
                </div>
                <div className="space-y-1.5">
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_100px_100px_24px] gap-1.5 items-center">
                      <SearchableCombobox options={accountOpts} value={line.accountId}
                        onChange={(v) => setLine(i, 'accountId', v)} placeholder="Account…" />
                      <input value={line.label} onChange={(e) => setLine(i, 'label', e.target.value)}
                        placeholder="Description"
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
                      <input type="number" min="0" step="0.01" value={line.debit}
                        onChange={(e) => { setLine(i, 'debit', e.target.value); if (e.target.value) setLine(i, 'credit', ''); }}
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-right text-white tabular-nums focus:outline-none focus:border-blue-500" />
                      <input type="number" min="0" step="0.01" value={line.credit}
                        onChange={(e) => { setLine(i, 'credit', e.target.value); if (e.target.value) setLine(i, 'debit', ''); }}
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-right text-white tabular-nums focus:outline-none focus:border-blue-500" />
                      <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2}
                        className="text-gray-600 hover:text-red-400 disabled:opacity-30 text-sm leading-none">×</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addLine}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition">+ Add line</button>

                {/* Balance indicator */}
                <div className={`mt-3 flex items-center justify-between text-xs p-2 rounded-lg ${balanced ? 'bg-green-900/20 border border-green-500/20' : 'bg-amber-900/20 border border-amber-500/20'}`}>
                  <span className={balanced ? 'text-green-400' : 'text-amber-400'}>
                    {balanced ? 'Balanced' : 'Not balanced'}
                  </span>
                  <span className="tabular-nums text-gray-400">
                    DR {totalDr.toLocaleString('en-EG', { maximumFractionDigits: 2 })} &nbsp;/&nbsp; CR {totalCr.toLocaleString('en-EG', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {saveErr && <p className="text-red-400 text-xs">{saveErr}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving || !balanced}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? 'Posting…' : 'Post Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
