'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';

interface BankAccount { id: string; name: string; accountNumber?: string; }
interface StatementLine {
  id: string; date: string; description: string; amount: number;
  matched?: boolean; matchedTo?: string;
}
interface BookEntry {
  id: string; date: string; description: string; reference: string;
  amount: number; matched?: boolean;
}

const egp = (n: number) =>
  'EGP ' + Math.abs(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-EG', { day: '2-digit', month: 'short', year: 'numeric' });

// Placeholder data — shown while API loads / no data yet
const PLACEHOLDER_STATEMENT: StatementLine[] = [
  { id: 's1', date: '2026-06-14', description: 'Payment from Sara Rashed', amount: 500220, matched: true, matchedTo: 'b1' },
  { id: 's2', date: '2026-06-13', description: 'Bank Transfer — Cairo Auto Parts', amount: -365000, matched: true, matchedTo: 'b2' },
  { id: 's3', date: '2026-06-12', description: 'Cash Deposit', amount: 95000, matched: true, matchedTo: 'b3' },
  { id: 's4', date: '2026-06-14', description: 'Bank Charges', amount: -450, matched: false },
  { id: 's5', date: '2026-06-13', description: 'Bank Disbursement — Khaled Deal', amount: -388000, matched: false },
  { id: 's6', date: '2026-06-12', description: 'Interest Income', amount: 720, matched: false },
];
const PLACEHOLDER_BOOK: BookEntry[] = [
  { id: 'b1', date: '2026-06-14', description: 'INV-1042 — Sara Rashed Payment', reference: 'INV-1042', amount: 500220, matched: true },
  { id: 'b2', date: '2026-06-13', description: 'PO-0042 — Cairo Auto Parts', reference: 'PO-0042', amount: -365000, matched: true },
  { id: 'b3', date: '2026-06-12', description: 'CASH-DEP-034 — Cash Deposit', reference: 'CASH-DEP-034', amount: 95000, matched: true },
];

export default function ReconciliationPage() {
  const { data: accountsRaw, loading: accLoading } = useQuery<{ items: BankAccount[] }>('/finance/bank-accounts?limit=50');
  const accounts: BankAccount[] = accountsRaw?.items ?? [];

  const [accountId, setAccountId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [endingBalance, setEndingBalance] = useState('');
  const [accSearch, setAccSearch] = useState('');
  const [accOpen, setAccOpen] = useState(false);

  const selectedAcc = accounts.find((a) => a.id === accountId);
  const filteredAccs = accounts.filter((a) =>
    a.name.toLowerCase().includes(accSearch.toLowerCase()) ||
    (a.accountNumber ?? '').includes(accSearch),
  );

  const apiPath = accountId
    ? `/finance/bank-statements?accountId=${accountId}&month=${month}`
    : null;
  const { data: stmtData, loading: stmtLoading } = useQuery<{ statementLines: StatementLine[] }>(apiPath);

  const apiBookPath = accountId
    ? `/finance/reconciliation/unmatched?accountId=${accountId}`
    : null;
  const { data: bookData, loading: bookLoading } = useQuery<{ entries: BookEntry[] }>(apiBookPath);

  // Use placeholder if no accountId selected yet
  const stmtLines: StatementLine[] = accountId
    ? (stmtData?.statementLines ?? PLACEHOLDER_STATEMENT)
    : PLACEHOLDER_STATEMENT;
  const bookEntries: BookEntry[] = accountId
    ? (bookData?.entries ?? PLACEHOLDER_BOOK)
    : PLACEHOLDER_BOOK;

  const [selectedStmt, setSelectedStmt] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [msg, setMsg] = useState('');

  const matchedStmtIds = new Set(stmtLines.filter((l) => l.matched).map((l) => l.id));
  const matchedBookIds = new Set(bookEntries.filter((e) => e.matched).map((e) => e.id));

  const outstandingDeposits = stmtLines
    .filter((l) => !l.matched && l.amount > 0)
    .reduce((s, l) => s + l.amount, 0);
  const outstandingWithdrawals = stmtLines
    .filter((l) => !l.matched && l.amount < 0)
    .reduce((s, l) => s + Math.abs(l.amount), 0);
  const stmtBalance = endingBalance ? Number(endingBalance.replace(/,/g, '')) : 2183150;
  const bookBalance = stmtBalance - outstandingDeposits + outstandingWithdrawals;
  const diff = stmtBalance - bookBalance - outstandingDeposits + outstandingWithdrawals;
  const balanced = Math.abs(diff) < 0.01;

  async function handleMatch() {
    if (!selectedStmt || !selectedBook) return;
    setMatching(true);
    setMsg('');
    try {
      await apiFetch('/finance/reconciliation/match', {
        method: 'POST',
        body: JSON.stringify({ statementLineId: selectedStmt, journalLineId: selectedBook }),
      });
      setSelectedStmt(null);
      setSelectedBook(null);
      setMsg('Matched successfully.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Match failed');
    } finally {
      setMatching(false);
    }
  }

  async function handleComplete() {
    if (!accountId || !month) { setMsg('Select account and month first.'); return; }
    setCompleting(true);
    setMsg('');
    try {
      await apiFetch('/finance/reconciliation/complete', {
        method: 'POST',
        body: JSON.stringify({ accountId, month, endingBalance: Number(endingBalance.replace(/,/g, '')) || stmtBalance }),
      });
      setMsg('Reconciliation completed!');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="page-body space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Reconciliation</h1>
          <p className="page-subtitle">
            {selectedAcc ? `${selectedAcc.name} — ${month}` : 'Match bank statement items to GL entries'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {msg && (
            <span className={`text-xs px-3 py-1.5 rounded-lg ${
              msg.includes('failed') || msg.includes('Failed') || msg.includes('Select')
                ? 'bg-danger-bg text-danger-fg'
                : 'bg-success-bg text-success-fg'
            }`}>{msg}</span>
          )}
          <button
            onClick={handleComplete}
            disabled={completing || !balanced}
            className="btn btn-primary btn-sm"
          >
            {completing ? 'Completing…' : 'Confirm All Matches'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6">
        <div className="card p-4 flex flex-wrap gap-4 items-end">
          {/* Bank account searchable combobox */}
          <div className="w-64 relative">
            <label className="input-label">Bank Account</label>
            <button
              type="button"
              onClick={() => { setAccOpen((v) => !v); setAccSearch(''); }}
              className="input flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className={selectedAcc ? 'text-[--text-1]' : 'text-[--text-3]'}>
                {selectedAcc?.name ?? (accLoading ? 'Loading…' : 'All Bank Account')}
              </span>
              <svg className={`w-4 h-4 text-[--text-3] shrink-0 transition-transform ${accOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {accOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border border-[--border] bg-[--surface] shadow-lg overflow-hidden">
                <div className="p-2 border-b border-[--border]">
                  <input
                    type="text"
                    value={accSearch}
                    onChange={(e) => setAccSearch(e.target.value)}
                    placeholder="Search accounts…"
                    autoFocus
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-[--border] bg-[--surface-2] text-[--text-1] outline-none focus:border-[--primary]"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  <button
                    type="button"
                    onClick={() => { setAccountId(''); setAccOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition hover:bg-[--surface-2] ${!accountId ? 'text-[--primary] font-medium' : 'text-[--text-2]'}`}
                  >
                    — All Accounts —
                  </button>
                  {filteredAccs.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setAccountId(a.id); setAccOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs transition hover:bg-[--surface-2] ${a.id === accountId ? 'text-[--primary] font-medium' : 'text-[--text-1]'}`}
                    >
                      {a.name}
                      {a.accountNumber && <span className="text-[--text-3] ml-1">({a.accountNumber})</span>}
                    </button>
                  ))}
                  {filteredAccs.length === 0 && (
                    <p className="px-3 py-3 text-xs text-[--text-3] text-center">No results</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Month picker */}
          <div>
            <label className="input-label">Statement Period</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input w-44"
            />
          </div>

          {/* Ending balance */}
          <div>
            <label className="input-label">Statement Ending Balance</label>
            <input
              type="text"
              value={endingBalance}
              onChange={(e) => setEndingBalance(e.target.value)}
              placeholder="2,183,150.00"
              className="input w-48 tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Main reconciliation area */}
      <div className="px-6">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">

          {/* LEFT: Bank Statement Items */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[--border] bg-[--surface-2]">
              <p className="section-label mb-0">Bank Statement Lines</p>
            </div>
            {(stmtLoading && accountId) ? (
              <p className="p-6 text-xs text-[--text-3]">Loading…</p>
            ) : (
              <div className="divide-y divide-[--border]">
                {stmtLines.map((line) => {
                  const isMatched = line.matched || matchedStmtIds.has(line.id);
                  const isSelected = selectedStmt === line.id;
                  return (
                    <div
                      key={line.id}
                      onClick={() => !isMatched && setSelectedStmt(isSelected ? null : line.id)}
                      className={`px-4 py-3 flex items-start justify-between gap-3 transition ${
                        isMatched
                          ? 'bg-success-bg cursor-default'
                          : isSelected
                          ? 'bg-info-bg cursor-pointer ring-1 ring-inset ring-[--primary]'
                          : 'hover:bg-[--surface-2] cursor-pointer'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium truncate ${isMatched ? 'text-success-fg' : 'text-[--text-1]'}`}>
                          {line.description}
                        </p>
                        <p className="text-[11px] text-[--text-3] mt-0.5">{fmtDate(line.date)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold tabular-nums ${line.amount >= 0 ? 'text-success-fg' : 'text-danger-fg'}`}>
                          {line.amount >= 0 ? '+' : '−'} {egp(line.amount)}
                        </span>
                        {isMatched ? (
                          <span className="badge badge-success">Matched</span>
                        ) : (
                          <span className="badge badge-warning">Unmatched</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {stmtLines.length === 0 && (
                  <p className="p-6 text-xs text-[--text-3] text-center">No statement lines found.</p>
                )}
              </div>
            )}
          </div>

          {/* CENTER: Match button */}
          <div className="flex flex-col items-center gap-3 pt-16">
            <button
              onClick={handleMatch}
              disabled={!selectedStmt || !selectedBook || matching}
              className="btn btn-primary flex-col gap-1 px-3 py-4"
              title="Match selected pair"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="text-[10px] font-medium leading-tight">Match</span>
            </button>
            {selectedStmt && !selectedBook && (
              <p className="text-[10px] text-[--text-3] text-center w-16">Select a book entry →</p>
            )}
            {!selectedStmt && selectedBook && (
              <p className="text-[10px] text-[--text-3] text-center w-16">← Select a statement line</p>
            )}
          </div>

          {/* RIGHT: Book Transactions */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[--border] bg-[--surface-2]">
              <p className="section-label mb-0">Matched Journal Entries</p>
            </div>
            {(bookLoading && accountId) ? (
              <p className="p-6 text-xs text-[--text-3]">Loading…</p>
            ) : (
              <div className="divide-y divide-[--border]">
                {bookEntries.map((entry) => {
                  const isMatched = entry.matched || matchedBookIds.has(entry.id);
                  const isSelected = selectedBook === entry.id;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => !isMatched && setSelectedBook(isSelected ? null : entry.id)}
                      className={`px-4 py-3 flex items-start justify-between gap-3 transition ${
                        isMatched
                          ? 'bg-success-bg cursor-default'
                          : isSelected
                          ? 'bg-info-bg cursor-pointer ring-1 ring-inset ring-[--primary]'
                          : 'hover:bg-[--surface-2] cursor-pointer'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium truncate ${isMatched ? 'text-success-fg' : 'text-[--text-1]'}`}>
                          {entry.description}
                        </p>
                        <p className="text-[11px] text-[--text-3] mt-0.5">
                          {fmtDate(entry.date)}
                          {entry.reference && <span className="ml-2 font-mono">{entry.reference}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold tabular-nums ${entry.amount >= 0 ? 'text-success-fg' : 'text-danger-fg'}`}>
                          {entry.amount >= 0 ? '+' : '−'} {egp(entry.amount)}
                        </span>
                        {isMatched ? (
                          <span className="badge badge-success">Confirmed</span>
                        ) : (
                          <span className="badge badge-warning">Unmatched</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Unmatched placeholder block */}
                {bookEntries.filter((e) => !e.matched).length === 0 && accountId && (
                  <div className="px-4 py-4 border-2 border-dashed border-[--border-strong] m-3 rounded-lg">
                    <p className="text-xs text-warning-fg font-medium mb-1">Unmatched Statement Line</p>
                    <p className="text-[11px] text-[--text-3]">No matching entry found in GL</p>
                    <div className="flex gap-2 mt-3">
                      <button className="btn btn-sm btn-ghost text-[11px]">Find Entry</button>
                      <button className="btn btn-sm btn-primary text-[11px]">+ Create Entry</button>
                    </div>
                  </div>
                )}

                {bookEntries.length === 0 && !accountId && (
                  <div className="px-4 py-4 border-2 border-dashed border-warning m-3 rounded-lg bg-warning-bg">
                    <p className="text-xs text-warning-fg font-medium mb-1">Unmatched Statement Line</p>
                    <p className="text-[11px] text-warning-fg/70">
                      Bank Charges — EGP 450 — No matching entry
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button className="btn btn-sm btn-ghost text-[11px]">Find Entry</button>
                      <button className="btn btn-sm btn-primary text-[11px]">+ Create Entry</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary footer */}
      <div className="px-6 pb-6">
        <div className="card p-4">
          <div className="grid grid-cols-5 gap-4 items-center">
            <div>
              <p className="text-[11px] text-[--text-3] font-medium uppercase tracking-wider mb-1">Statement Balance</p>
              <p className="text-sm font-semibold text-[--text-1] tabular-nums">{egp(stmtBalance)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[--text-3] font-medium uppercase tracking-wider mb-1">Outstanding Deposits</p>
              <p className="text-sm font-semibold text-success tabular-nums">+ {egp(outstandingDeposits)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[--text-3] font-medium uppercase tracking-wider mb-1">Outstanding Withdrawals</p>
              <p className="text-sm font-semibold text-danger tabular-nums">− {egp(outstandingWithdrawals)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[--text-3] font-medium uppercase tracking-wider mb-1">Book Balance</p>
              <p className="text-sm font-semibold text-[--text-1] tabular-nums">{egp(bookBalance)}</p>
            </div>
            <div className={`rounded-lg px-4 py-3 ${balanced ? 'bg-success-bg' : 'bg-danger-bg'}`}>
              <p className={`text-[11px] font-medium uppercase tracking-wider mb-1 ${balanced ? 'text-success-fg' : 'text-danger-fg'}`}>
                Difference
              </p>
              <p className={`text-lg font-bold tabular-nums ${balanced ? 'text-success-fg' : 'text-danger-fg'}`}>
                {balanced ? 'EGP 0' : egp(diff)}
              </p>
              {balanced && <p className="text-[10px] text-success-fg mt-0.5">Ready to complete</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
