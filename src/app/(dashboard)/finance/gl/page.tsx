'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface JournalEntry {
  id: string; number?: string; date: string; description?: string;
  journal?: { name: string; code: string };
  reference?: string; ref?: string;
  totalDebit?: number; totalCredit?: number;
  lines?: { debit: number; credit: number }[];
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
}

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-EG', { day: '2-digit', month: 'short', year: 'numeric' });

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-info',
    CANCELLED: 'badge badge-danger',
  };
  const labelMap: Record<string, string> = {
    DRAFT: 'Draft', POSTED: 'Posted', CANCELLED: 'Cancelled',
  };
  return <span className={map[status] ?? 'badge badge-neutral'}>{labelMap[status] ?? status}</span>;
}

const JOURNAL_FILTER_OPTS = [
  { value: '', label: 'All Journals' },
  { value: 'SALES', label: 'Sales' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank' },
  { value: 'GENERAL', label: 'General' },
];

const STATUS_FILTER_OPTS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function GlPage() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [journalFilter, setJournalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const qs = new URLSearchParams({
    limit: '50',
    ...(journalFilter && { journalType: journalFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(search && { search }),
  }).toString();

  const { data, loading, error, reload } = useQuery<{ items: JournalEntry[]; total: number }>(
    `/finance/gl?${qs}`,
    [qs],
  );

  const entries = data?.items ?? [];

  const totalDebitOf = (e: JournalEntry) =>
    e.totalDebit ?? e.lines?.reduce((s, l) => s + Number(l.debit), 0) ?? 0;
  const totalCreditOf = (e: JournalEntry) =>
    e.totalCredit ?? e.lines?.reduce((s, l) => s + Number(l.credit), 0) ?? 0;

  return (
    <div className="page-body space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal Entries</h1>
          <p className="page-subtitle">General Ledger — Manual & Automatic Postings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/finance/gl/recurring')}
            className="btn btn-secondary"
          >
            Recurring Templates
          </button>
          <button
            onClick={() => router.push('/finance/gl/new')}
            className="btn btn-primary"
          >
            + New Entry
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6">
        <div className="card p-3 flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-3]"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries…"
              className="input pl-9"
            />
          </div>

          {/* Journal filter */}
          <div className="w-40">
            <label className="input-label">Journal</label>
            <SearchableCombobox
              options={JOURNAL_FILTER_OPTS}
              value={journalFilter}
              onChange={setJournalFilter}
            />
          </div>

          {/* Date range */}
          <div>
            <label className="input-label">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input w-36" />
          </div>
          <div>
            <label className="input-label">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input w-36" />
          </div>

          {/* Status filter */}
          <div className="w-36">
            <label className="input-label">Status</label>
            <SearchableCombobox
              options={STATUS_FILTER_OPTS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 pb-6">
        <div className="card overflow-hidden">
          {loading && (
            <div className="flex items-center gap-3 p-6 text-[--text-3] text-sm">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Loading journal entries…
            </div>
          )}
          {error && <p className="p-6 text-danger-fg text-sm">{error}</p>}
          {!loading && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry #</th>
                  <th>Date</th>
                  <th>Journal</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const dr = totalDebitOf(e);
                  const cr = totalCreditOf(e);
                  return (
                    <tr
                      key={e.id}
                      onClick={() => router.push(`/finance/gl/${e.id}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <span className="font-mono text-xs text-[--text-2]">
                          {e.number ?? (e.reference ?? e.ref) ?? e.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="text-[--text-2] text-xs">{fmtDate(e.date)}</td>
                      <td>
                        <span className="text-xs text-[--text-2]">
                          {e.journal?.name ?? e.journal?.code ?? '—'}
                        </span>
                      </td>
                      <td className="text-[--text-1]">
                        {e.description ?? '—'}
                      </td>
                      <td className="text-right tabular-nums text-[--text-1]">
                        {dr > 0 ? egp(dr) : '—'}
                      </td>
                      <td className="text-right tabular-nums text-[--text-1]">
                        {cr > 0 ? egp(cr) : '—'}
                      </td>
                      <td><StatusBadge status={e.status} /></td>
                      <td>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); router.push(`/finance/gl/${e.id}`); }}
                          className="btn btn-ghost btn-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[--text-3]">
                      No journal entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {data && (
            <div className="px-4 py-2 border-t border-[--border] bg-[--surface-2] flex justify-between items-center">
              <p className="text-xs text-[--text-3]">{data.total} total entries</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
