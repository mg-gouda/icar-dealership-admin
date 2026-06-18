'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import StatusBadge from '../../../../../components/StatusBadge';
import SearchableCombobox from '../../../../../components/ui/SearchableCombobox';

interface StatementLine {
  id: string;
  date: string;
  description?: string;
  reference?: string;
  amount: number;
  type: string;
  isReconciled: boolean;
}

interface Statement {
  id: string;
  reference: string;
  date: string;
  status: string;
  startingBalance: number;
  endingBalance: number;
  bankAccount?: { name: string; accountNumber?: string; bank?: string };
  lines: StatementLine[];
}

interface GlLine {
  id: string;
  label?: string;
  debit: number;
  credit: number;
  account?: { code: string; name: string };
  journalEntry?: { date: string; ref?: string };
}

const fmt = (n: number) =>
  Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_OPTS = [
  { value: 'DEBIT', label: 'Debit' },
  { value: 'CREDIT', label: 'Credit' },
];

const blank = () => ({
  date: new Date().toISOString().slice(0, 10),
  description: '',
  reference: '',
  amount: '',
  type: 'DEBIT',
});

// ── Match Modal ───────────────────────────────────────────────────────────────
function MatchModal({
  line,
  onClose,
  onSuccess,
}: {
  line: StatementLine;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: glRaw, loading: glLoading } = useQuery<{ items?: GlLine[] } | GlLine[]>(
    '/finance/reconciliation/unreconciled-lines',
  );

  const glLines: GlLine[] = Array.isArray(glRaw)
    ? glRaw
    : (glRaw as any)?.items ?? [];

  const [selected, setSelected] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [err, setErr] = useState('');

  async function confirm() {
    if (!selected) return;
    setMatching(true);
    setErr('');
    try {
      await apiFetch('/finance/reconciliation', {
        method: 'POST',
        body: JSON.stringify({
          pairs: [{ bankStatementLineId: line.id, journalEntryLineId: selected, amount: Math.abs(Number(line.amount)) }],
        }),
      });
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Match failed');
    } finally {
      setMatching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-gray-900 border border-white/10 shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Match GL Line</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Statement line: {line.description ?? '—'} &nbsp;|&nbsp;
              <span className={line.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}>
                {line.type === 'CREDIT' ? '+' : '-'}{fmt(Math.abs(Number(line.amount)))} EGP
              </span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {glLoading && <p className="p-4 text-gray-500 text-sm text-center">Loading GL lines…</p>}
          {!glLoading && glLines.length === 0 && (
            <p className="p-4 text-gray-600 text-sm text-center">No unreconciled GL lines found.</p>
          )}
          {glLines.map((gl) => (
            <div
              key={gl.id}
              onClick={() => setSelected(gl.id)}
              className={`flex items-center justify-between px-4 py-3 rounded-lg mb-1 cursor-pointer transition ${
                selected === gl.id
                  ? 'bg-blue-600/20 border border-blue-500/40'
                  : 'hover:bg-white/5 border border-transparent'
              }`}>
              <div className="min-w-0">
                <p className="text-sm text-white truncate">
                  {gl.account ? `${gl.account.code} — ${gl.account.name}` : gl.id.slice(-8)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {gl.journalEntry?.date ? new Date(gl.journalEntry.date).toLocaleDateString('en-EG') : '—'}
                  {gl.journalEntry?.ref ? ` · ${gl.journalEntry.ref}` : ''}
                  {gl.label ? ` · ${gl.label}` : ''}
                </p>
              </div>
              <div className="text-right text-xs tabular-nums ml-4 flex-shrink-0">
                {Number(gl.debit) > 0 && <span className="text-green-400">DR {fmt(gl.debit)}</span>}
                {Number(gl.credit) > 0 && <span className="text-red-400">CR {fmt(gl.credit)}</span>}
              </div>
            </div>
          ))}
        </div>

        {err && <p className="px-5 py-2 text-red-400 text-xs flex-shrink-0">{err}</p>}

        <div className="flex gap-3 p-5 border-t border-white/5 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">
            Cancel
          </button>
          <button onClick={confirm} disabled={!selected || matching}
            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
            {matching ? 'Matching…' : 'Match'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BankStatementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: statement, loading, error, reload } = useQuery<Statement>(
    `/finance/bank-statements/${id}`,
    [id],
  );

  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [matchingLine, setMatchingLine] = useState<StatementLine | null>(null);

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.amount) { setFormErr('Date and amount required.'); return; }
    setSaving(true); setFormErr('');
    try {
      await apiFetch(`/finance/bank-statements/${id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          date: new Date(form.date).toISOString(),
          description: form.description || undefined,
          reference: form.reference || undefined,
          amount: parseFloat(form.amount),
          type: form.type,
        }),
      });
      setForm(blank());
      reload();
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : 'Failed to add line');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (error || !statement) return (
    <div className="p-6">
      <p className="text-red-400 text-sm mb-3">{error ?? 'Statement not found'}</p>
      <button onClick={() => router.push('/finance/bank-statements')} className="text-blue-400 text-sm hover:text-blue-300">← Bank Statements</button>
    </div>
  );

  const lines = statement.lines ?? [];
  const totalDebits = lines.filter((l) => l.type === 'DEBIT').reduce((s, l) => s + Math.abs(Number(l.amount)), 0);
  const totalCredits = lines.filter((l) => l.type === 'CREDIT').reduce((s, l) => s + Math.abs(Number(l.amount)), 0);
  const net = totalCredits - totalDebits;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.push('/finance/bank-statements')}
            className="text-xs text-gray-500 hover:text-white transition mb-2 inline-block">
            ← Bank Statements
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white font-mono">{statement.reference}</h1>
            <StatusBadge status={statement.status} />
          </div>
          {statement.bankAccount?.bank && (
            <p className="text-gray-400 text-sm mt-1">{statement.bankAccount.bank}</p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Bank Account', value: statement.bankAccount?.name ?? '—' },
          { label: 'Date', value: new Date(statement.date).toLocaleDateString('en-EG') },
          { label: 'Opening Balance', value: `EGP ${fmt(statement.startingBalance)}` },
          { label: 'Closing Balance', value: `EGP ${fmt(statement.endingBalance)}` },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/5 bg-gray-900 p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-sm text-white font-medium">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Lines section */}
      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Statement Lines</p>
          <span className="text-xs text-gray-600">{lines.length} lines</span>
        </div>

        {/* Add line form */}
        <form onSubmit={addLine} className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
          <p className="text-xs text-gray-500 mb-3 font-medium">+ Add Line</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date *</label>
              <input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={(e) => set('description', e.target.value)}
                placeholder="e.g. Wire transfer"
                className="w-full px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reference</label>
              <input value={form.reference} onChange={(e) => set('reference', e.target.value)}
                placeholder="e.g. TXN-001"
                className="w-full px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount *</label>
              <input type="number" step="0.01" required value={form.amount} onChange={(e) => set('amount', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <SearchableCombobox
                label="Type *"
                options={TYPE_OPTS}
                value={form.type}
                onChange={(v) => set('type', v)}
                placeholder="Select type…"
              />
            </div>
          </div>
          {formErr && <p className="text-red-400 text-xs mt-2">{formErr}</p>}
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition">
              {saving ? 'Adding…' : 'Add Line'}
            </button>
          </div>
        </form>

        {/* Lines table */}
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Date</th>
              <th className="px-5 py-3 text-left font-medium">Description</th>
              <th className="px-5 py-3 text-left font-medium">Reference</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
              <th className="px-5 py-3 text-center font-medium">Reconciled</th>
              <th className="px-5 py-3 text-center font-medium">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {lines.map((l) => (
              <tr key={l.id} className="hover:bg-white/[0.03] transition">
                <td className="px-5 py-2.5 text-gray-400 text-xs">
                  {new Date(l.date).toLocaleDateString('en-EG')}
                </td>
                <td className="px-5 py-2.5 text-gray-300 text-xs">{l.description ?? '—'}</td>
                <td className="px-5 py-2.5 text-gray-500 font-mono text-xs">{l.reference ?? '—'}</td>
                <td className={`px-5 py-2.5 text-right tabular-nums text-xs font-medium ${
                  l.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {l.type === 'CREDIT' ? '+' : '-'}{fmt(Math.abs(Number(l.amount)))}
                </td>
                <td className="px-5 py-2.5 text-center text-xs">
                  {l.isReconciled
                    ? <span className="text-green-400">&#10003;</span>
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-5 py-2.5 text-center">
                  {!l.isReconciled && (
                    <button
                      onClick={() => setMatchingLine(l)}
                      className="text-xs px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 hover:text-blue-300 hover:border-blue-400 transition">
                      Match
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-600 text-sm">No lines yet.</td></tr>
            )}
          </tbody>

          {/* Totals row */}
          {lines.length > 0 && (
            <tfoot className="border-t border-white/10 bg-white/[0.02]">
              <tr>
                <td colSpan={3} className="px-5 py-3 text-xs text-gray-500 font-medium">Totals</td>
                <td className="px-5 py-3 text-right text-xs tabular-nums">
                  <span className="text-red-400 mr-3">-{fmt(totalDebits)}</span>
                  <span className="text-green-400">+{fmt(totalCredits)}</span>
                </td>
                <td className="px-5 py-3 text-center text-xs font-semibold">
                  <span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>
                    Net {net >= 0 ? '+' : ''}{fmt(net)}
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {matchingLine && (
        <MatchModal
          line={matchingLine}
          onClose={() => setMatchingLine(null)}
          onSuccess={() => { setMatchingLine(null); reload(); }}
        />
      )}
    </div>
  );
}
