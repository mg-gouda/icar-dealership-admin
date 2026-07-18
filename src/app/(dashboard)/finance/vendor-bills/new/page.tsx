'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import SearchableCombobox from '../../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';
import { ErrorBanner } from '@/components/ui/error-banner';

interface Vendor { id: string; name: string; }
interface Journal { id: string; code: string; name: string; type?: string; }
interface Location { id: string; name: string; }
interface Account { id: string; code: string; name: string; }
interface TaxRate { id: string; name: string; rate: number; }

interface BillLine {
  accountId: string;
  description: string;
  qty: string;
  unitPrice: string;
  taxRateId: string;
}

const EMPTY_LINE = (): BillLine => ({
  accountId: '', description: '', qty: '1', unitPrice: '', taxRateId: '',
});

const CURRENCY_OPTS = [
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const today = () => new Date().toISOString().split('T')[0];

const fmtMoney = (n: number, currency = 'EGP') =>
  `${currency} ${n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ponytail: inline account picker reused from GL new page pattern
function AccountSelect({
  accounts,
  value,
  onChange,
  isAr,
}: {
  accounts: Account[];
  value: string;
  onChange: (v: string) => void;
  isAr: boolean;
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
          {selected ? `${selected.code} — ${selected.name}` : (isAr ? 'اختر حساباً…' : 'Select account…')}
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
                className={`w-full text-left px-3 py-2 text-xs transition hover:bg-[--surface-2] ${
                  a.id === value ? 'text-[--primary] font-medium' : 'text-[--text-1]'
                }`}
              >
                <span className="font-mono text-[--text-3] mr-2">{a.code}</span>
                {a.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-[--text-3] text-center">
                {isAr ? 'لا نتائج' : 'No results'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewVendorBillPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const { data: vendorsRaw, error: vendorsError } = useQuery<{ data: Vendor[] }>('/partners?type=VENDOR&limit=200');
  const { data: journalsRaw } = useQuery<{ items: Journal[] }>('/finance/journals?limit=50&type=PURCHASE');
  const { data: locationsRaw } = useQuery<{ items: Location[] }>('/locations?limit=50');
  const { data: accountsRaw, error: accountsError } = useQuery<{ items: Account[] }>('/finance/accounts?limit=300');
  const { data: taxesRaw } = useQuery<{ items: TaxRate[] }>('/finance/taxes?limit=50');

  const vendors = vendorsRaw?.data ?? [];
  const journals = journalsRaw?.items ?? [];
  const locations = locationsRaw?.items ?? [];
  const accounts = accountsRaw?.items ?? [];
  const taxes = taxesRaw?.items ?? [];

  const vendorOpts = vendors.map((v) => ({ value: v.id, label: v.name }));
  const journalOpts = journals.map((j) => ({ value: j.id, label: j.name }));
  const locationOpts = locations.map((l) => ({ value: l.id, label: l.name }));
  const taxOpts = [
    { value: '', label: isAr ? 'بدون ضريبة' : 'No Tax' },
    ...taxes.map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` })),
  ];

  const [form, setForm] = useState({
    vendorId: '',
    billDate: today(),
    dueDate: '',
    reference: '',
    journalId: '',
    locationId: '',
    currency: 'EGP',
    notes: '',
  });
  const [lines, setLines] = useState<BillLine[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  function setLine(i: number, k: keyof BillLine, v: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }

  function lineSubtotal(line: BillLine): number {
    return (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
  }

  function lineTax(line: BillLine): number {
    const tax = taxes.find((t) => t.id === line.taxRateId);
    if (!tax) return 0;
    return lineSubtotal(line) * (tax.rate / 100);
  }

  const subtotal = lines.reduce((s, l) => s + lineSubtotal(l), 0);
  const taxTotal = lines.reduce((s, l) => s + lineTax(l), 0);
  const total = subtotal + taxTotal;

  function validate(): string {
    if (!form.vendorId) return isAr ? 'اختر مورداً.' : 'Select a vendor.';
    if (!form.billDate) return isAr ? 'تاريخ الفاتورة مطلوب.' : 'Bill date is required.';
    const validLines = lines.filter((l) => l.accountId && Number(l.unitPrice) > 0);
    if (validLines.length === 0) return isAr ? 'مطلوب سطر واحد على الأقل.' : 'At least one line item is required.';
    return '';
  }

  async function submit(andPost: boolean) {
    const err = validate();
    if (err) { setSaveErr(err); return; }

    const action = andPost ? setPosting : setSaving;
    action(true);
    setSaveErr('');

    const validLines = lines.filter((l) => l.accountId && Number(l.unitPrice) > 0);
    const payload = {
      vendorId: form.vendorId,
      billDate: form.billDate,
      dueDate: form.dueDate || undefined,
      reference: form.reference || undefined,
      journalId: form.journalId || undefined,
      locationId: form.locationId || undefined,
      currency: form.currency,
      notes: form.notes || undefined,
      status: andPost ? 'POSTED' : 'DRAFT',
      lines: validLines.map((l) => ({
        accountId: l.accountId,
        description: l.description || undefined,
        qty: Number(l.qty) || 1,
        unitPrice: Number(l.unitPrice),
        taxRateId: l.taxRateId || undefined,
      })),
    };

    try {
      // ponytail: mock — toast until real endpoint available
      await new Promise((r) => setTimeout(r, 400)); // ponytail: simulated latency

      if (typeof window !== 'undefined') {
        // ponytail: inline toast via alert until toast component wired
        alert(andPost
          ? (isAr ? 'تم ترحيل الفاتورة.' : 'Bill posted successfully.')
          : (isAr ? 'تم حفظ الفاتورة كمسودة.' : 'Bill saved as draft.'));
      }
      router.push('/finance/vendor-bills');
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : (isAr ? 'خطأ في حفظ الفاتورة' : 'Error saving bill'));
    } finally {
      setSaving(false);
      setPosting(false);
    }
  }

  return (
    <div className="flex gap-5 p-6 min-h-screen bg-[--bg]">
      {/* Main form */}
      <div className="flex-1 space-y-5 min-w-0">
        {/* Back + title */}
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs text-[--text-3] hover:text-[--text-1] transition mb-2 inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isAr ? 'فواتير الموردين' : 'Vendor Bills'}
          </button>
          <h1 className="page-title">{isAr ? 'فاتورة مورد جديدة' : 'New Vendor Bill'}</h1>
          <p className="page-subtitle">
            {isAr ? 'الذمم الدائنة — إنشاء فاتورة مورد' : 'Accounts Payable — Create Supplier Invoice'}
          </p>
          {(vendorsError || accountsError) && (
            <div className="mt-3">
              <ErrorBanner error={vendorsError ?? accountsError} retry={() => window.location.reload()} />
            </div>
          )}
        </div>

        {/* Header fields */}
        <div className="card p-5 space-y-4">
          <p className="section-label">{isAr ? 'تفاصيل الفاتورة' : 'Bill Details'}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="input-label">{isAr ? 'المورد *' : 'Vendor *'}</label>
              <SearchableCombobox
                options={vendorOpts}
                value={form.vendorId}
                onChange={(v) => setForm({ ...form, vendorId: v })}
                placeholder={isAr ? 'اختر مورداً…' : 'Select vendor…'}
              />
            </div>
            <div>
              <label className="input-label">{isAr ? 'تاريخ الفاتورة *' : 'Bill Date *'}</label>
              <input
                type="date"
                value={form.billDate}
                onChange={(e) => setForm({ ...form, billDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">{isAr ? 'المرجع / رقم فاتورة المورد' : 'Reference / Vendor Invoice #'}</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder={isAr ? 'رقم فاتورة المورد' : "Vendor's invoice number"}
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
            <div>
              <label className="input-label">{isAr ? 'الدفتر المحاسبي' : 'Journal'}</label>
              <SearchableCombobox
                options={journalOpts}
                value={form.journalId}
                onChange={(v) => setForm({ ...form, journalId: v })}
                placeholder={isAr ? 'دفتر المشتريات…' : 'Purchase journal…'}
              />
            </div>
            <div>
              <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
              <SearchableCombobox
                options={locationOpts}
                value={form.locationId}
                onChange={(v) => setForm({ ...form, locationId: v })}
                placeholder={isAr ? 'اختر الفرع…' : 'Select location…'}
              />
            </div>
            <div className="col-span-2">
              <label className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={isAr ? 'ملاحظات داخلية أو تعليمات الدفع…' : 'Internal notes or payment instructions…'}
                rows={2}
                className="input resize-none"
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[--border] bg-[--surface-2]">
            <p className="section-label mb-0">{isAr ? 'بنود الفاتورة' : 'Line Items'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--border] bg-[--surface-2] text-[11px] font-semibold uppercase tracking-wider text-[--text-3]">
                  <td className="px-4 py-2.5 w-8 text-center">#</td>
                  <td className="px-3 py-2.5">{isAr ? 'الحساب' : 'Account'}</td>
                  <td className="px-3 py-2.5">{isAr ? 'البيان' : 'Description'}</td>
                  <td className="px-3 py-2.5 w-20 text-right">{isAr ? 'الكمية' : 'Qty'}</td>
                  <td className="px-3 py-2.5 w-28 text-right">{isAr ? 'سعر الوحدة' : 'Unit Price'}</td>
                  <td className="px-3 py-2.5 w-36">{isAr ? 'الضريبة' : 'Tax'}</td>
                  <td className="px-3 py-2.5 w-28 text-right">{isAr ? 'الإجمالي' : 'Subtotal'}</td>
                  <td className="px-3 py-2.5 w-8"></td>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {lines.map((line, i) => {
                  const sub = lineSubtotal(line);
                  return (
                    <tr key={i} className="hover:bg-[--surface-2] transition">
                      <td className="px-4 py-2 text-center text-xs text-[--text-3]">{i + 1}</td>
                      <td className="px-3 py-2">
                        <AccountSelect
                          accounts={accounts}
                          value={line.accountId}
                          onChange={(v) => setLine(i, 'accountId', v)}
                          isAr={isAr}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => setLine(i, 'description', e.target.value)}
                          placeholder={isAr ? 'البيان…' : 'Description…'}
                          className="input text-xs py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumericInput
                          min="0"
                          step="1"
                          value={line.qty}
                          onChange={(val) => setLine(i, 'qty', val)}
                          className="input text-xs py-1.5 text-right tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumericInput
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(val) => setLine(i, 'unitPrice', val)}
                          placeholder="0.00"
                          className="input text-xs py-1.5 text-right tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <SearchableCombobox
                          options={taxOpts}
                          value={line.taxRateId}
                          onChange={(v) => setLine(i, 'taxRateId', v)}
                          placeholder={isAr ? 'بدون ضريبة' : 'No tax'}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-[--text-1]">
                        {sub > 0 ? fmtMoney(sub, form.currency) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => lines.length > 1 && setLines((prev) => prev.filter((_, idx) => idx !== i))}
                          disabled={lines.length <= 1}
                          className="text-[--text-3] hover:text-danger-fg disabled:opacity-30 transition text-base leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[--border] bg-[--surface-2]">
                  <td colSpan={6} className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => [...prev, EMPTY_LINE()])}
                      className="text-xs text-[--primary] hover:underline font-medium"
                    >
                      {isAr ? '+ إضافة بند' : '+ Add Line'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right" colSpan={2}></td>
                </tr>
                {/* Totals */}
                <tr className="border-t border-[--border]">
                  <td colSpan={6} className="px-4 py-2 text-right text-xs text-[--text-3]">
                    {isAr ? 'الإجمالي قبل الضريبة' : 'Subtotal'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-[--text-1]">
                    {fmtMoney(subtotal, form.currency)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-4 py-2 text-right text-xs text-[--text-3]">
                    {isAr ? 'الضريبة' : 'Tax'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-[--text-1]">
                    {fmtMoney(taxTotal, form.currency)}
                  </td>
                  <td></td>
                </tr>
                <tr className="border-t border-[--border-strong]">
                  <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-[--text-1]">
                    {isAr ? 'الإجمالي' : 'Total'}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-[--primary]">
                    {fmtMoney(total, form.currency)}
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
        {/* Totals summary */}
        <div className="card p-5 space-y-3">
          <p className="section-label">{isAr ? 'الملخص' : 'Summary'}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[--text-2]">
              <span>{isAr ? 'الإجمالي قبل الضريبة' : 'Subtotal'}</span>
              <span className="tabular-nums">{fmtMoney(subtotal, form.currency)}</span>
            </div>
            <div className="flex justify-between text-xs text-[--text-2]">
              <span>{isAr ? 'الضريبة' : 'Tax'}</span>
              <span className="tabular-nums">{fmtMoney(taxTotal, form.currency)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-[--text-1] pt-1.5 border-t border-[--border]">
              <span>{isAr ? 'الإجمالي' : 'Total'}</span>
              <span className="tabular-nums text-[--primary]">{fmtMoney(total, form.currency)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="card p-4 space-y-2">
          <p className="section-label">{isAr ? 'الإجراءات' : 'Actions'}</p>
          <button
            onClick={() => submit(true)}
            disabled={posting || saving}
            className="btn btn-primary w-full"
          >
            {posting ? (isAr ? 'جاري الترحيل…' : 'Posting…') : (isAr ? 'ترحيل الفاتورة' : 'Post Bill')}
          </button>
          <button
            onClick={() => submit(false)}
            disabled={saving || posting}
            className="btn btn-secondary w-full"
          >
            {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ كمسودة' : 'Save as Draft')}
          </button>
          <button
            onClick={() => router.back()}
            className="btn btn-ghost w-full"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </div>

        {/* Vendor info hint */}
        {form.vendorId && (
          <div className="card p-4">
            <div className="flex items-start gap-2">
              <span className="text-sm">i</span>
              <div>
                <p className="text-xs font-semibold text-[--text-1] mb-1">
                  {isAr ? 'المورد المحدد' : 'Vendor Selected'}
                </p>
                <p className="text-xs text-[--text-2]">
                  {vendors.find((v) => v.id === form.vendorId)?.name}
                </p>
                <p className="text-xs text-[--text-3] mt-0.5">
                  {isAr ? 'سيتم إنشاء قيد الذمم الدائنة عند الترحيل.' : 'AP entry will be created on post.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
