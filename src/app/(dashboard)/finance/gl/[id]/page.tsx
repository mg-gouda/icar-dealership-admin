'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface JELine {
  id: string; debit: number; credit: number;
  description?: string;
  account?: { code: string; name: string };
  partner?: { name: string };
  branch?: string;
}

interface JournalEntry {
  id: string; date: string; ref?: string; reference?: string; number?: string;
  description?: string; status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  journal?: { code: string; name: string };
  currency?: { code: string };
  lines: JELine[];
  createdBy?: { name: string };
  totalDebit?: number; totalCredit?: number;
}

const egp = (n: number) =>
  'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusBadge({ status }: { status: string }) {
  const { isAr } = useLang();
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-info',
    CANCELLED: 'badge badge-danger',
  };
  const labels: Record<string, string> = {
    DRAFT: isAr ? 'مسودة' : 'Draft',
    POSTED: isAr ? 'مرحل' : 'Posted',
    CANCELLED: isAr ? 'ملغى' : 'Cancelled',
  };
  return <span className={map[status] ?? 'badge badge-neutral'}>{labels[status] ?? status}</span>;
}

export default function GlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAr } = useLang();
  const { data: entry, loading, error, reload } = useQuery<JournalEntry>(
    `/finance/gl/${id}`,
    [id],
  );

  const [posting, setPosting] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionErr, setActionErr] = useState('');

  async function post() {
    setPosting(true); setActionErr('');
    try {
      await apiFetch(`/finance/gl/${id}/post`, { method: 'POST' });
      await reload();
    } catch (e: unknown) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setPosting(false); }
  }

  async function reverse() {
    if (!confirm(isAr ? 'إنشاء قيد عكسي لهذا القيد المحاسبي؟' : 'Create a reversal entry for this journal entry?')) return;
    setReversing(true); setActionErr('');
    try {
      const rev = await apiFetch<{ id: string }>(`/finance/gl/${id}/reverse`, { method: 'POST' });
      router.push(`/finance/gl/${(rev as any).id}`);
    } catch (e: unknown) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setReversing(false); }
  }

  async function duplicate() {
    setDuplicating(true); setActionErr('');
    try {
      const dup = await apiFetch<{ id: string }>(`/finance/gl/${id}/duplicate`, { method: 'POST' });
      router.push(`/finance/gl/${(dup as any).id}`);
    } catch (e: unknown) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setDuplicating(false); }
  }

  async function del() {
    if (!confirm(isAr ? 'حذف هذا القيد المحاسبي؟ لا يمكن التراجع عن هذا الإجراء.' : 'Delete this journal entry? This cannot be undone.')) return;
    setDeleting(true); setActionErr('');
    try {
      await apiFetch(`/finance/gl/${id}`, { method: 'DELETE' });
      router.push('/finance/gl');
    } catch (e: unknown) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setDeleting(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-8 text-[--text-3] text-sm">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        {isAr ? 'تحميل القيد المحاسبي…' : 'Loading journal entry…'}
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="p-8">
        <p className="text-danger-fg text-sm mb-3">{error ?? (isAr ? 'القيد غير موجود' : 'Entry not found')}</p>
        <Link href="/finance/gl" className="btn btn-secondary btn-sm">
          {isAr ? '← العودة للقيود المحاسبية' : '← Back to Journal Entries'}
        </Link>
      </div>
    );
  }

  const totalDebit = entry.totalDebit ?? entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = entry.totalCredit ?? entry.lines.reduce((s, l) => s + Number(l.credit), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const entryRef = entry.number ?? entry.reference ?? entry.ref ?? entry.id.slice(0, 8).toUpperCase();

  return (
    <div className="flex gap-5 p-6 min-h-screen bg-[--bg]">
      {/* Main content */}
      <div className="flex-1 space-y-5 min-w-0">
        {/* Breadcrumb + title */}
        <div>
          <Link href="/finance/gl" className="text-xs text-[--text-3] hover:text-[--text-1] transition inline-flex items-center gap-1 mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isAr ? 'القيود المحاسبية' : 'Journal Entries'}
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title font-mono">
              {entryRef.startsWith('JE-') ? entryRef : `JE-${entryRef}`}
            </h1>
            <StatusBadge status={entry.status} />
            {!balanced && (
              <span className="badge badge-danger">{isAr ? 'غير متوازن' : 'Unbalanced'}</span>
            )}
          </div>
          <p className="page-subtitle mt-1">
            {entry.journal?.name ?? entry.journal?.code ?? (isAr ? 'دفتر الأستاذ العام' : 'General Ledger')} — {fmtDate(entry.date, isAr, { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {actionErr && (
          <div className="rounded-lg bg-danger-bg border border-danger px-4 py-3">
            <p className="text-xs text-danger-fg">{actionErr}</p>
          </div>
        )}

        {/* Entry Details card */}
        <div className="card p-5">
          <p className="section-label">{isAr ? 'تفاصيل القيد' : 'Entry Details'}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">{isAr ? 'الدفتر' : 'Journal'}</label>
              <p className="text-sm text-[--text-1] font-medium">{entry.journal?.name ?? '—'}</p>
            </div>
            <div>
              <label className="input-label">{isAr ? 'التاريخ' : 'Date'}</label>
              <p className="text-sm text-[--text-1] font-medium">{fmtDate(entry.date, isAr, { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            <div>
              <label className="input-label">{isAr ? 'المرجع / الوصف' : 'Reference / Description'}</label>
              <p className="text-sm text-[--text-1]">{entry.description ?? entry.ref ?? '—'}</p>
            </div>
            <div>
              <label className="input-label">{isAr ? 'العملة' : 'Currency'}</label>
              <p className="text-sm text-[--text-1] font-medium">{entry.currency?.code ?? 'EGP'} — {isAr ? 'جنيه مصري' : 'Egyptian Pound'}</p>
            </div>
          </div>
        </div>

        {/* Journal Lines card */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[--border] bg-[--surface-2]">
            <p className="section-label mb-0">{isAr ? 'بنود القيد' : 'Journal Lines'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--border] bg-[--surface-2] text-[11px] font-semibold uppercase tracking-wider text-[--text-3]">
                  <td className="px-4 py-2.5">{isAr ? 'الحساب' : 'Account'}</td>
                  <td className="px-3 py-2.5">{isAr ? 'الشريك' : 'Partner'}</td>
                  <td className="px-3 py-2.5">{isAr ? 'البيان' : 'Label'}</td>
                  <td className="px-3 py-2.5">{isAr ? 'الفرع' : 'Branch'}</td>
                  <td className="px-3 py-2.5 text-right">{isAr ? 'مدين (ج.م)' : 'Debit (EGP)'}</td>
                  <td className="px-3 py-2.5 text-right">{isAr ? 'دائن (ج.م)' : 'Credit (EGP)'}</td>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {entry.lines.map((l) => (
                  <tr key={l.id} className="hover:bg-[--surface-2] transition">
                    <td className="px-4 py-3">
                      {l.account ? (
                        <span className="text-xs text-[--text-1]">
                          <span className="font-mono text-[--text-3] mr-1.5">{l.account.code}</span>
                          — {l.account.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3 text-xs text-[--text-2]">{l.partner?.name ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-[--text-2]">{l.description ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-[--text-2]">{l.branch ?? '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-sm font-medium text-[--primary]">
                      {Number(l.debit) > 0 ? egp(l.debit) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-sm font-medium text-[--primary]">
                      {Number(l.credit) > 0 ? egp(l.credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[--border-strong] bg-[--surface-2]">
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-[--text-2] uppercase tracking-wider">
                    {isAr ? 'الإجمالي' : 'Total'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-sm font-bold text-[--primary]">
                    {egp(totalDebit)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-sm font-bold text-[--primary]">
                    {egp(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-64 shrink-0 space-y-4 pt-14">
        {/* Balance check */}
        <div className={`card p-5 text-center ${balanced ? 'bg-success-bg border-success' : 'bg-danger-bg border-danger'}`}>
          <p className={`section-label mb-3 ${balanced ? 'text-success-fg' : 'text-danger-fg'}`}>
            {balanced ? '✅' : '⚠'} {isAr ? 'فحص التوازن' : 'Balance Check'}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${balanced ? 'text-success-fg' : 'text-danger-fg'}`}>
            {balanced ? 'EGP 0' : egp(Math.abs(totalDebit - totalCredit))}
          </p>
          <p className={`text-xs mt-1 ${balanced ? 'text-success-fg' : 'text-danger-fg'}`}>
            {balanced
              ? (isAr ? 'الفرق — جاهز للترحيل' : 'Difference — Ready to Post')
              : isAr
                ? `فرق بمقدار ${egp(Math.abs(totalDebit - totalCredit))}`
                : `Unbalanced by ${egp(Math.abs(totalDebit - totalCredit))}`}
          </p>
        </div>

        {/* Actions */}
        <div className="card p-4 space-y-2">
          <p className="section-label">{isAr ? 'الإجراءات' : 'Actions'}</p>
          {entry.status === 'DRAFT' && (
            <button onClick={post} disabled={posting || !balanced} className="btn btn-primary w-full">
              {posting ? (isAr ? 'جارٍ الترحيل…' : 'Posting…') : (isAr ? '✅ ترحيل القيد' : '✅ Post Entry')}
            </button>
          )}
          {entry.status === 'POSTED' && (
            <button onClick={reverse} disabled={reversing} className="btn btn-secondary w-full">
              {reversing ? '…' : (isAr ? '↩ عكس القيد' : '↩ Reverse Entry')}
            </button>
          )}
          <button onClick={duplicate} disabled={duplicating} className="btn btn-secondary w-full">
            {duplicating ? '…' : (isAr ? '⎘ تكرار' : '⎘ Duplicate')}
          </button>
          {entry.status === 'DRAFT' && (
            <button onClick={del} disabled={deleting} className="btn btn-danger w-full">
              {deleting ? (isAr ? 'جارٍ الحذف…' : 'Deleting…') : (isAr ? 'حذف' : 'Delete')}
            </button>
          )}
        </div>

        {/* Fiscal period */}
        <div className="card p-4">
          <div className="flex items-start gap-2">
            <span className="text-sm">💡</span>
            <div>
              <p className="text-xs font-semibold text-[--text-1] mb-1">{isAr ? 'الفترة المالية' : 'Fiscal Period'}</p>
              <p className="text-xs text-[--text-2]">
                {fmtDate(entry.date, isAr, { month: 'short', year: 'numeric' })} — {isAr ? 'مفتوحة' : 'Open'}
              </p>
              <p className="text-xs text-[--text-3] mt-0.5">
                {isAr ? 'تاريخ القفل:' : 'Lock date:'} {entry.date ? new Date(new Date(entry.date).getFullYear(), new Date(entry.date).getMonth() + 1, 0).toLocaleDateString(isAr ? 'ar-EG' : 'en-EG', { month: 'short', day: 'numeric' }) : '—'} {isAr ? 'نهاية اليوم' : 'at EOD'}
              </p>
            </div>
          </div>
        </div>

        {/* Created by */}
        {entry.createdBy && (
          <div className="card p-4">
            <p className="section-label">{isAr ? 'أنشأه' : 'Created By'}</p>
            <p className="text-xs text-[--text-1]">{entry.createdBy.name}</p>
          </div>
        )}
      </div>
    </div>
  );
}
