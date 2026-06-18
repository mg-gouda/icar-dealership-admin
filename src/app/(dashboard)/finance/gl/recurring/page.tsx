'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import SearchableCombobox from '../../../../../components/ui/SearchableCombobox';

interface TemplateLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  label?: string;
  account?: { code: string; name: string };
}

interface Template {
  id: string;
  name: string;
  recurrence: string;
  nextRunDate: string;
  active: boolean;
  journal?: { code: string; name: string };
  lines: TemplateLine[];
}

interface FormLine {
  accountId: string;
  debit: string;
  credit: string;
  label: string;
}

const EMPTY_LINE = (): FormLine => ({ accountId: '', debit: '', credit: '', label: '' });

const RECURRENCE_OPTS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

export default function RecurringTemplatePage() {
  const { data: templates, loading, error, reload } = useQuery<Template[]>('/finance/gl/recurring');
  const { data: journalsRaw } = useQuery<any[]>('/finance/gl/journals');
  const { data: accountsRaw } = useQuery<any>('/finance/gl/accounts?limit=200');

  const rows = templates ?? [];
  const journals = Array.isArray(journalsRaw) ? journalsRaw : [];
  const accountsArr: any[] = Array.isArray(accountsRaw)
    ? accountsRaw
    : (accountsRaw?.items ?? []);
  const journalOpts = journals.map((j: any) => ({ value: j.id, label: `${j.code} — ${j.name}` }));
  const accountOpts = accountsArr.map((a: any) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '',
    journalId: '',
    recurrence: 'MONTHLY',
    nextRunDate: new Date().toISOString().split('T')[0],
  });
  const [lines, setLines] = useState<FormLine[]>([EMPTY_LINE(), EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function setLine(i: number, k: keyof FormLine, v: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }
  function addLine() { setLines((prev) => [...prev, EMPTY_LINE()]); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.005 && totalDr > 0;

  function resetForm() {
    setForm({ name: '', journalId: '', recurrence: 'MONTHLY', nextRunDate: new Date().toISOString().split('T')[0] });
    setLines([EMPTY_LINE(), EMPTY_LINE()]);
    setSaveErr('');
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setSaveErr('Name required.'); return; }
    if (!form.journalId) { setSaveErr('Select a journal.'); return; }
    if (!balanced) { setSaveErr('Lines must balance (debits = credits, both > 0).'); return; }
    const validLines = lines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { setSaveErr('At least 2 lines required.'); return; }

    setSaving(true); setSaveErr('');
    try {
      await apiFetch('/finance/gl/recurring', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          journalId: form.journalId,
          recurrence: form.recurrence,
          nextRunDate: form.nextRunDate,
          lines: validLines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            label: l.label || undefined,
          })),
        }),
      });
      setShowNew(false);
      resetForm();
      reload();
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : 'Error creating template');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/finance/gl/recurring/${confirmDeleteId}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      reload();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Recurring Journal Templates</h1>
          <p className="text-xs text-gray-500 mt-0.5">{rows.length} template{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance/gl"
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            &larr; GL
          </Link>
          <button onClick={() => { resetForm(); setShowNew(true); }}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium">
            + New Template
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        {loading && <p className="p-6 text-gray-500 text-sm">Loading...</p>}
        {error && <p className="p-6 text-red-400 text-sm">{error}</p>}
        {!loading && (
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 text-gray-400 text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Journal</th>
                <th className="px-4 py-3 text-left font-medium">Recurrence</th>
                <th className="px-4 py-3 text-left font-medium">Next Run</th>
                <th className="px-4 py-3 text-right font-medium">Lines</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-2.5 text-white text-xs font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {t.journal ? `${t.journal.code} — ${t.journal.name}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                      {t.recurrence}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {new Date(t.nextRunDate).toLocaleDateString('en-EG')}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300 text-xs tabular-nums">
                    {t.lines.length}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => setConfirmDeleteId(t.id)}
                      className="text-xs text-gray-600 hover:text-red-400 transition px-2 py-0.5 rounded">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">
                    No recurring templates yet. Create one to automate journal generation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New Template Dialog */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-gray-900 border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-sm font-semibold text-white">New Recurring Template</h2>
              <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white text-lg leading-none">x</button>
            </div>

            <form onSubmit={submitCreate} className="p-5 space-y-4">
              {/* Header fields */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Monthly Depreciation"
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <SearchableCombobox
                  label="Journal *"
                  options={journalOpts}
                  value={form.journalId}
                  onChange={(v) => setForm({ ...form, journalId: v })}
                  placeholder="Select journal"
                />
                <SearchableCombobox
                  label="Recurrence *"
                  options={RECURRENCE_OPTS}
                  value={form.recurrence}
                  onChange={(v) => setForm({ ...form, recurrence: v })}
                />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Next Run Date *</label>
                  <input
                    type="date"
                    value={form.nextRunDate}
                    onChange={(e) => setForm({ ...form, nextRunDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="grid grid-cols-[1fr_1fr_100px_100px_24px] gap-1.5 text-xs text-gray-500 mb-1.5 px-1">
                  <span>Account</span>
                  <span>Label</span>
                  <span className="text-right">Debit</span>
                  <span className="text-right">Credit</span>
                  <span />
                </div>
                <div className="space-y-1.5">
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_100px_100px_24px] gap-1.5 items-center">
                      <SearchableCombobox
                        options={accountOpts}
                        value={line.accountId}
                        onChange={(v) => setLine(i, 'accountId', v)}
                        placeholder="Account..."
                      />
                      <input
                        value={line.label}
                        onChange={(e) => setLine(i, 'label', e.target.value)}
                        placeholder="Description"
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number" min="0" step="0.01" value={line.debit}
                        onChange={(e) => { setLine(i, 'debit', e.target.value); if (e.target.value) setLine(i, 'credit', ''); }}
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-right text-white tabular-nums focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number" min="0" step="0.01" value={line.credit}
                        onChange={(e) => { setLine(i, 'credit', e.target.value); if (e.target.value) setLine(i, 'debit', ''); }}
                        className="px-2.5 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-right text-white tabular-nums focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        disabled={lines.length <= 2}
                        className="text-gray-600 hover:text-red-400 disabled:opacity-30 text-sm leading-none">
                        x
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addLine}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition">
                  + Add line
                </button>

                {/* Balance indicator */}
                <div className={`mt-3 flex items-center justify-between text-xs p-2 rounded-lg ${balanced ? 'bg-green-900/20 border border-green-500/20' : 'bg-amber-900/20 border border-amber-500/20'}`}>
                  <span className={balanced ? 'text-green-400' : 'text-amber-400'}>
                    {balanced ? 'Balanced' : totalDr === 0 && totalCr === 0 ? 'Enter amounts' : 'Not balanced'}
                  </span>
                  <span className="tabular-nums text-gray-400">
                    DR {totalDr.toLocaleString('en-EG', { maximumFractionDigits: 2 })} / CR {totalCr.toLocaleString('en-EG', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {saveErr && <p className="text-red-400 text-xs">{saveErr}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !balanced}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? 'Creating...' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-2">Delete Template?</h2>
            <p className="text-xs text-gray-400 mb-5">
              This will permanently delete the template and all its lines. Previously generated journal entries are unaffected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg transition">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
