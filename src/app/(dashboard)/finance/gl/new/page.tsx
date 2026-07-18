'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import SearchableCombobox from '../../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';
import { ErrorBanner } from '@/components/ui/error-banner';

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
  const { isAr } = useLang();

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
              placeholder={isAr ? 'بحث في الحسابات…' : 'Search accounts…'}
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
              <p className="px-3 py-3 text-xs text-[--text-3] text-center">{isAr ? 'لا توجد نتائج' : 'No results'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const { data: journalsRaw, error: journalsError } = useQuery<{ items: Journal[] }>('/finance/journals?limit=50');
  const { data: accountsRaw, error: accountsError } = useQuery<{ items: Account[] }>('/finance/accounts?limit=300');

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

  async function save(andPost = false) {
    if (!form.journalId) { setSaveErr(isAr ? 'اختر دفتراً.' : 'Select a journal.'); return; }
    const validLines = lines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { setSaveErr(isAr ? 'مطلوب بندان على الأقل.' : 'At least 2 lines required.'); return; }
    if (!balanced) { setSaveErr(isAr ? 'المدين يجب أن يساوي الدائن.' : 'Debits must equal credits.'); return; }

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
        <div>
          <button onClick={() => router.back()} className="text-xs text-[--text-3] hover:text-[--text-1] transition mb-2 inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isAr ? 'القيود المحاسبية' : 'Journal Entries'}
          </button>
          <h1 className="page-title">{isAr ? 'قيد محاسبي جديد' : 'New Journal Entry'}</h1>
          <p className="page-subtitle">{isAr ? 'دفتر الأستاذ العام — إدخال يدوي' : 'General Ledger — Manual Entry'}</p>
          {(journalsError || accountsError) && (
            <div className="mt-3">
              <ErrorBanner error={journalsError ?? accountsError} retry={() => window.location.reload()} />
            </div>
          )}
        </div>

        {/* Entry Details card */}
        <div className="card p-5 space-y-4">
          <p className="section-label">{isAr ? 'تفاصيل القيد' : 'Entry Details'}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">{isAr ? 'الدفتر' : 'Journal'}</label>
              <SearchableCombobox
                options={journals.map((j) => ({ value: j.id, label: j.name }))}
                value={form.journalId}
                onChange={(v) => setForm({ ...form, journalId: v })}
                placeholder={isAr ? 'اختر دفتراً…' : 'Select journal…'}
              />
            </div>

            <div>
              <label className="input-label">{isAr ? 'التاريخ' : 'Date'}</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="input-label">{isAr ? 'المرجع / الوصف' : 'Reference / Description'}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={isAr ? 'استحقاق شهري — مصروف إيجار' : 'Monthly accrual — Rent expense'}
                className="input"
              />
            </div>

            <div>
              <label className="input-label">{isAr ? 'العملة' : 'Currency'}</label>
              <SearchableCombobox
                options={CURRENCY_OPTS}
                value={form.currency}
                onChange={(v) => setForm({ ...form, currency: v })}
              />
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
                  <td className="px-4 py-2.5 w-8 text-center">#</td>
                  <td className="px-3 py-2.5">{isAr ? 'الحساب' : 'Account'}</td>
                  <td className="px-3 py-2.5 w-28">{isAr ? 'الشريك' : 'Partner'}</td>
                  <td className="px-3 py-2.5">{isAr ? 'البيان' : 'Label'}</td>
                  <td className="px-3 py-2.5 w-24">{isAr ? 'الفرع' : 'Branch'}</td>
                  <td className="px-3 py-2.5 w-32 text-right">{isAr ? 'مدين (ج.م)' : 'Debit (EGP)'}</td>
                  <td className="px-3 py-2.5 w-32 text-right">{isAr ? 'دائن (ج.م)' : 'Credit (EGP)'}</td>
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
                        placeholder={isAr ? 'اختر حساباً…' : 'Select account…'}
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
                        placeholder={isAr ? 'بيان…' : 'Label…'}
                        className="input text-xs py-1.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-[--text-3]">—</span>
                    </td>
                    <td className="px-3 py-2">
                      <NumericInput
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={(val) => clearOther(i, 'debit', val)}
                        placeholder="—"
                        className="input text-xs py-1.5 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <NumericInput
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={(val) => clearOther(i, 'credit', val)}
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
                      {isAr ? '+ إضافة بند' : '+ Add Line'}
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
            {balanced ? '✅' : ''} {isAr ? 'فحص التوازن' : 'Balance Check'}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${balanced ? 'text-success-fg' : diff === 0 && totalDr === 0 ? 'text-[--text-3]' : 'text-danger-fg'}`}>
            {balanced ? 'EGP 0' : egp(Math.abs(diff))}
          </p>
          <p className={`text-xs mt-1 ${balanced ? 'text-success-fg' : 'text-[--text-3]'}`}>
            {balanced
              ? (isAr ? 'الفرق — جاهز للترحيل' : 'Difference — Ready to Post')
              : totalDr === 0
              ? (isAr ? 'أضف بنود القيد' : 'Add journal lines')
              : isAr
                ? `فرق: ${diff > 0 ? 'المدين' : 'الدائن'} أكبر`
                : `Difference: ${diff > 0 ? 'Debit' : 'Credit'} exceeds`}
          </p>
        </div>

        {/* Actions */}
        <div className="card p-4 space-y-2">
          <p className="section-label">{isAr ? 'الإجراءات' : 'Actions'}</p>
          <button
            onClick={() => save(true)}
            disabled={posting || !balanced}
            className="btn btn-primary w-full"
          >
            {posting ? (isAr ? 'جارٍ الترحيل…' : 'Posting…') : (isAr ? '✅ ترحيل القيد' : '✅ Post Entry')}
          </button>
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="btn btn-secondary w-full"
          >
            {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? '🗒 حفظ كمسودة' : '🗒 Save as Draft')}
          </button>
          <button
            onClick={() => router.back()}
            className="btn btn-ghost w-full"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </div>

        {/* Fiscal period info */}
        <div className="card p-4">
          <div className="flex items-start gap-2">
            <span className="text-sm">💡</span>
            <div>
              <p className="text-xs font-semibold text-[--text-1] mb-1">{isAr ? 'الفترة المالية' : 'Fiscal Period'}</p>
              <p className="text-xs text-[--text-2]">
                {new Date().toLocaleDateString('en-EG', { month: 'short', year: 'numeric' })} — {isAr ? 'مفتوحة' : 'Open'}
              </p>
              <p className="text-xs text-[--text-3] mt-0.5">
                {isAr ? 'تاريخ القفل:' : 'Lock date:'} {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-EG', { month: 'short', day: 'numeric' })} {isAr ? 'نهاية اليوم' : 'at EOD'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
