'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

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

function StatusBadge({ status }: { status: string }) {
  const { isAr } = useLang();
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-info',
    CANCELLED: 'badge badge-danger',
  };
  const labelMap: Record<string, string> = {
    DRAFT: isAr ? 'مسودة' : 'Draft',
    POSTED: isAr ? 'مرحل' : 'Posted',
    CANCELLED: isAr ? 'ملغى' : 'Cancelled',
  };
  return <span className={map[status] ?? 'badge badge-neutral'}>{labelMap[status] ?? status}</span>;
}

export default function GlPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const [search, setSearch] = useState('');
  const [journalFilter, setJournalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const JOURNAL_FILTER_OPTS = [
    { value: '', label: isAr ? 'كل الدفاتر' : 'All Journals' },
    { value: 'SALES', label: isAr ? 'مبيعات' : 'Sales' },
    { value: 'PURCHASE', label: isAr ? 'مشتريات' : 'Purchase' },
    { value: 'CASH', label: isAr ? 'نقدية' : 'Cash' },
    { value: 'BANK', label: isAr ? 'بنك' : 'Bank' },
    { value: 'GENERAL', label: isAr ? 'عام' : 'General' },
  ];

  const STATUS_FILTER_OPTS = [
    { value: '', label: isAr ? 'كل الحالات' : 'All Statuses' },
    { value: 'DRAFT', label: isAr ? 'مسودة' : 'Draft' },
    { value: 'POSTED', label: isAr ? 'مرحل' : 'Posted' },
    { value: 'CANCELLED', label: isAr ? 'ملغى' : 'Cancelled' },
  ];

  const qs = new URLSearchParams({
    limit: '50',
    ...(journalFilter && { journalType: journalFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(search && { search }),
  }).toString();

  const { data, loading, error } = useQuery<{ items: JournalEntry[]; total: number }>(
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
          <h1 className="page-title">{isAr ? 'القيود المحاسبية' : 'Journal Entries'}</h1>
          <p className="page-subtitle">{isAr ? 'دفتر الأستاذ العام — القيود اليدوية والتلقائية' : 'General Ledger — Manual & Automatic Postings'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/finance/gl/recurring')}
            className="btn btn-secondary"
          >
            {isAr ? 'القوالب المتكررة' : 'Recurring Templates'}
          </button>
          <button
            onClick={() => router.push('/finance/gl/new')}
            className="btn btn-primary"
          >
            {isAr ? '+ قيد جديد' : '+ New Entry'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6">
        <div className="card p-3 flex flex-wrap gap-3 items-end">
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
              placeholder={isAr ? 'بحث في القيود…' : 'Search entries…'}
              className="input pl-9"
            />
          </div>

          <div className="w-40">
            <label className="input-label">{isAr ? 'الدفتر' : 'Journal'}</label>
            <SearchableCombobox
              options={JOURNAL_FILTER_OPTS}
              value={journalFilter}
              onChange={setJournalFilter}
            />
          </div>

          <div>
            <label className="input-label">{isAr ? 'من' : 'From'}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input w-36" />
          </div>
          <div>
            <label className="input-label">{isAr ? 'إلى' : 'To'}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input w-36" />
          </div>

          <div className="w-36">
            <label className="input-label">{isAr ? 'الحالة' : 'Status'}</label>
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
              {isAr ? 'تحميل القيود المحاسبية…' : 'Loading journal entries…'}
            </div>
          )}
          {error && <p className="p-6 text-danger-fg text-sm">{error}</p>}
          {!loading && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'رقم القيد' : 'Entry #'}</th>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'الدفتر' : 'Journal'}</th>
                  <th>{isAr ? 'الوصف' : 'Description'}</th>
                  <th className="text-right">{isAr ? 'مدين' : 'Debit'}</th>
                  <th className="text-right">{isAr ? 'دائن' : 'Credit'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
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
                      <td className="text-[--text-2] text-xs">{fmtDate(e.date, isAr, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
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
                          {isAr ? 'عرض' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[--text-3]">
                      {isAr ? 'لا توجد قيود محاسبية.' : 'No journal entries found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {data && (
            <div className="px-4 py-2 border-t border-[--border] bg-[--surface-2] flex justify-between items-center">
              <p className="text-xs text-[--text-3]">
                {isAr ? `${data.total} قيد إجمالي` : `${data.total} total entries`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
