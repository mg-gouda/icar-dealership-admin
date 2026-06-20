'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../../lib/useApi';

interface Account { id: string; code: string; name: string; }
interface Journal { id: string; code: string; name: string; }
interface JournalLine {
  accountId: string; description: string; debit: string; credit: string;
}

const EMPTY_LINE = (): JournalLine => ({ accountId: '', description: '', debit: '', credit: '' });

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Inline searchable select for light theme
function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = 'Select account…',
}: {
  accounts: Account[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = accounts.find((a) => a.id === value);
  const filtered = accounts.filter(
    (a) =>
      a.code.toLowerCase().includes(q.toLowerCase()) ||
      a.name.toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) { setOpen(false); setQ(''); }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="input flex items-center justify-between gap-2 cursor-pointer text-left"
        style={{ minWidth: 0 }}
      >
        <span className={`truncate text-xs ${selected ? 'text-[--text-1]' : 'text-[--text-3]'}`}>
          {selected ? `${selected.code} — ${selected.name}` : placeholder}
        </span>
        <svg className={`w-3.5 h-3.5 text-[--text-3] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-[--border] bg-[--surface] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[--border]">
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search accounts…"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-[--border] bg-[--surface-2] text-[--text-1] outline-none focus:border-[--primary]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.slice(0, 50).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { onChange(a.id); setOpen(false); setQ(''); }}
                className={`w-full text-left px-3 py-2 text-xs transition hover:bg-[--surface-2] ${a.id === value ? 'text-[--primary] font-medium' : 'text-[--text-1]'}`}
              >
                <span className="font-mono text-[--text-3] mr-2">{a.code}</span>
                {a.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-[--text-3] text-center">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewJournalEntryPage() {
  const router = useRouter();

  const { data: journalsRaw } = useQuery<{ items: Journal[] }>('/finance/journals?limit=50');
  const { data: accountsRaw } = useQuery<{ items: Account[] }>('/finance/accounts?limit=300');

  const journals: Journal[] = journalsRaw?.items ?? [];
  const accounts: Account[] = accountsRaw?.items ?? [];

  const [form, setForm] = useState({
    journalId: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    currency: 'EGP',
  });
  const [lines, setLines] = useState<JournalLine[]>([EMPTY_LINE(), EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  function setLine(i: number, k: keyof JournalLine, v: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }

  function clearOther(i: number, field: 'debit' | 'credit', v: string) {
    if (v) {
      setLines((prev) => prev.map((l, idx) =>
        idx === i ? { ...l, [field]: v, [field === 'debit' ? 'credit' : 'debit']: '' } : l,
      ));
    } else {
      setLine(i, field, v);
    }
  }

  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDr > 0 && Math.abs(totalDr - totalCr) < 0.005;
  const diff = totalDr - totalCr;

  const selectedJournal = journals.find((j) => j.id === form.journalId);

  async function save(andPost = false) {
    if (!form.journalId) { setSaveErr('Select a journal.'); return; }
    const validLines = lines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { setSaveErr('At least 2 lines required.'); return; }
    if (!balanced) { setSaveErr('Debits must equal credits.'); return; }

    const action = andPost ? setPosting : setSaving;
    action(true);
    setSaveErr('');
    try {
      const entry = await apiFetch<{ id: string }>('/finance/gl', {
        method: 'POST',
        body: JSON.stringify({
          journalId: form.journalId,
          date: form.date,
          reference: form.reference || undefined,
          description: form.description || undefined,
          lines: validLines.map((l) => ({
            accountId: l.accountId,
            description: l.description || undefined,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        }),
      });

      if (andPost) {
        await apiFetch(`/finance/gl/${entry.id}/post`, { method: 'POST' });
      }

      router.push(`/finance/gl/${entry.id}`);
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
      setPosting(false);
    }
  }

  const CURRENCY_OPTS = [
    { value: 'EGP', label: 'EGP — Egyptian Pound' },
    { value: 'USD', label: 'USD — US Dollar' },
    { value: 'EUR', label: 'EUR — Euro' },
  ];

  return (
    <div className="flex gap-5 p-6 min-h-screen bg-[--bg]">
      {/* Main form */}
      <div className="flex-1 space-y-5 min-w-0">
        {/* Page title */}
        <div>
          <button onClick={() => router.back()} className="text-xs text-[--text-3] hover:text-[--text-1] transition mb-2 inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Journal Entries
          </button>
          <h1 className="page-title">New Journal Entry</h1>
          <p className="page-subtitle">General Ledger — Manual Entry</p>
        </div>

        {/* Entry Details card */}
        <div className="card p-5 space-y-4">
          <p className="section-label">Entry Details</p>

          <div className="grid grid-cols-2 gap-4">
            {/* Journal */}
            <div>
              <label className="input-label">Journal</label>
              <select
                value={form.journalId}
                onChange={(e) => setForm({ ...form, journalId: e.target.value })}
                className="select-input"
              >
                <option value="">Select journal…</option>
                {journals.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
                {journals.length === 0 && (
                  <option value="" disabled>General / Miscellaneous</option>
                )}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="input-label">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input"
              />
            </div>

            {/* Reference / Description */}
            <div>
              <label className="input-label">Reference / Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Monthly accrual — Rent expense"
                className="input"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="input-label">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="select-input"
              >
                {CURRENCY_OPTS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Journal Lines card */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[--border] bg-[--surface-2]">
            <p className="section-label mb-0">Journal Lines</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--border] bg-[--surface-2] text-[11px] font-semibold uppercase tracking-wider text-[--text-3]">
                  <td className="px-4 py-2.5 w-8 text-center">#</td>
                  <td className="px-3 py-2.5">Account</td>
                  <td className="px-3 py-2.5 w-28">Partner</td>
                  <td className="px-3 py-2.5">Label</td>
                  <td className="px-3 py-2.5 w-24">Branch</td>
                  <td className="px-3 py-2.5 w-32 text-right">Debit (EGP)</td>
                  <td className="px-3 py-2.5 w-32 text-right">Credit (EGP)</td>
                  <td className="px-3 py-2.5 w-8"></td>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-[--surface-2] transition">
                    <td className="px-4 py-2 text-center text-xs text-[--text-3]">{i + 1}</td>
                    <td className="px-3 py-2">
                      <AccountSelect
                        accounts={accounts}
                        value={line.accountId}
                        onChange={(v) => setLine(i, 'accountId', v)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-[--text-3]">—</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => setLine(i, 'description', e.target.value)}
                        placeholder="Label…"
                        className="input text-xs py-1.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-[--text-3]">—</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={(e) => clearOther(i, 'debit', e.target.value)}
                        placeholder="—"
                        className="input text-xs py-1.5 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={(e) => clearOther(i, 'credit', e.target.value)}
                        placeholder="—"
                        className="input text-xs py-1.5 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => lines.length > 2 && setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        disabled={lines.length <= 2}
                        className="text-[--text-3] hover:text-danger-fg disabled:opacity-30 transition text-base leading-none"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[--border-strong] bg-[--surface-2]">
                  <td colSpan={5} className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => [...prev, EMPTY_LINE()])}
                      className="text-xs text-[--primary] hover:underline font-medium"
                    >
                      + Add Line
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-[--primary]">
                    {totalDr > 0 ? egp(totalDr) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-[--primary]">
                    {totalCr > 0 ? egp(totalCr) : '—'}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {saveErr && (
          <div className="rounded-lg bg-danger-bg border border-danger px-4 py-3">
            <p className="text-xs text-danger-fg">{saveErr}</p>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="w-64 shrink-0 space-y-4 pt-14">
        {/* Balance check */}
        <div className={`card p-5 text-center ${balanced ? 'bg-success-bg border-success' : ''}`}>
          <p className="section-label mb-3">
            {balanced ? '✅ Balance Check' : 'Balance Check'}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${balanced ? 'text-success-fg' : diff === 0 && totalDr === 0 ? 'text-[--text-3]' : 'text-danger-fg'}`}>
            {balanced ? 'EGP 0' : egp(Math.abs(diff))}
          </p>
          <p className={`text-xs mt-1 ${balanced ? 'text-success-fg' : 'text-[--text-3]'}`}>
            {balanced
              ? 'Difference — Ready to Post'
              : totalDr === 0
              ? 'Add journal lines'
              : `Difference: ${diff > 0 ? 'Debit' : 'Credit'} exceeds`}
          </p>
        </div>

        {/* Actions */}
        <div className="card p-4 space-y-2">
          <p className="section-label">Actions</p>
          <button
            onClick={() => save(true)}
            disabled={posting || !balanced}
            className="btn btn-primary w-full"
          >
            {posting ? 'Posting…' : '✅ Post Entry'}
          </button>
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="btn btn-secondary w-full"
          >
            {saving ? 'Saving…' : '🗒 Save as Draft'}
          </button>
          <button
            onClick={() => router.back()}
            className="btn btn-ghost w-full"
          >
            Cancel
          </button>
        </div>

        {/* Fiscal period info */}
        <div className="card p-4">
          <div className="flex items-start gap-2">
            <span className="text-sm">💡</span>
            <div>
              <p className="text-xs font-semibold text-[--text-1] mb-1">Fiscal Period</p>
              <p className="text-xs text-[--text-2]">
                {new Date().toLocaleDateString('en-EG', { month: 'short', year: 'numeric' })} — Open
              </p>
              <p className="text-xs text-[--text-3] mt-0.5">
                Lock date: {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-EG', { month: 'short', day: 'numeric' })} at EOD
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
