'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface Payment {
  id: string;
  number?: string;
  type: string;
  status: string;
  date: string;
  amount: number;
  method: string;
  memo?: string;
  partner?: { name: string };
  journal?: { code: string };
  allocations?: { invoiceId: string; invoiceNumber?: string; amount: number }[];
}

interface Invoice {
  id: string;
  number?: string;
  amountTotal: number;
  amountResidual: number;
  partner?: { name: string };
}


function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-info',
    RECONCILED: 'badge badge-success',
    CANCELLED: 'badge badge-danger',
  };
  return map[status] ?? 'badge badge-neutral';
}

const egp = (n: number) =>
  'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Register Payment Slide-over ──────────────────────────────────────────────
function RegisterPaymentPanel({ onClose, onSuccess, tab }: {
  onClose: () => void; onSuccess: () => void; tab: 'customer' | 'vendor';
}) {
  const { isAr } = useLang();

  const PAYMENT_METHODS = [
    { value: 'CASH', label: isAr ? 'نقداً' : 'Cash' },
    { value: 'TRANSFER', label: isAr ? 'تحويل بنكي' : 'Bank Transfer' },
    { value: 'CHEQUE', label: isAr ? 'شيك' : 'Cheque' },
    { value: 'CARD', label: isAr ? 'بطاقة' : 'Card' },
  ];

  const [form, setForm] = useState({
    partnerId: '',
    journalId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'TRANSFER',
    reference: '',
    note: '',
    whtCategoryId: '',
  });
  const [allocations, setAllocations] = useState<{ invoiceId: string; amount: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const { data: partnersRaw } = useQuery<any[]>(
    tab === 'customer' ? '/partners?limit=200&type=CUSTOMER' : '/partners?limit=200&type=VENDOR',
  );
  const { data: journalsRaw } = useQuery<any[]>('/finance/journals?type=BANK&limit=50');
  const { data: whtCatsRaw } = useQuery<{ data: { id: string; name: string; rate: number }[] }>(
    tab === 'vendor' ? '/finance/wht-categories' : null,
  );
  const { data: openInvoicesRaw } = useQuery<{ items: Invoice[] }>(
    form.partnerId
      ? `/finance/invoices?partnerId=${form.partnerId}&status=POSTED&limit=50&type=${tab === 'customer' ? 'CUSTOMER_INVOICE' : 'VENDOR_BILL'}`
      : null,
    [form.partnerId],
  );

  const partnerOpts = (Array.isArray(partnersRaw) ? partnersRaw : []).map((p) => ({ value: p.id, label: p.name }));
  const journalOpts = (Array.isArray(journalsRaw) ? journalsRaw : []).map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));
  const whtOpts = [
    { value: '', label: isAr ? 'بدون خصم' : 'No WHT' },
    ...((whtCatsRaw?.data ?? []).map((w) => ({ value: w.id, label: `${w.name} (${w.rate}%)` }))),
  ];
  const openInvoices = openInvoicesRaw?.items ?? [];

  function toggleAllocation(inv: Invoice) {
    setAllocations((prev) => {
      const exists = prev.find((a) => a.invoiceId === inv.id);
      if (exists) return prev.filter((a) => a.invoiceId !== inv.id);
      return [...prev, { invoiceId: inv.id, amount: Number(inv.amountResidual).toFixed(2) }];
    });
  }

  function updateAllocAmt(invoiceId: string, val: string) {
    setAllocations((prev) => prev.map((a) => a.invoiceId === invoiceId ? { ...a, amount: val } : a));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partnerId || !form.journalId || !form.amount) {
      setErr(isAr ? 'العميل/المورد والدفتر والمبلغ مطلوبة.' : 'Customer/vendor, journal, and amount required.');
      return;
    }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          type: tab === 'customer' ? 'INBOUND' : 'OUTBOUND',
          partnerId: form.partnerId,
          journalId: form.journalId,
          amount: Number(form.amount),
          date: form.date,
          method: form.method,
          memo: form.note || form.reference || undefined,
          ...(allocations.length > 0 && {
            allocations: allocations.map((a) => ({ invoiceId: a.invoiceId, amount: Number(a.amount) })),
          }),
          ...(form.whtCategoryId && { whtCategoryId: form.whtCategoryId }),
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : isAr ? 'خطأ' : 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1"
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}
      />
      <div
        className="relative flex flex-col"
        style={{ width: 480, background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)' }}>
              {isAr ? 'تسجيل دفعة' : 'Register Payment'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {tab === 'customer'
                ? (isAr ? 'استلام من عميل' : 'Customer receipt')
                : (isAr ? 'دفع لمورد' : 'Vendor payment')}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '1.2rem' }}>×</button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4 flex-1">
          <div>
            <label className="input-label">
              {tab === 'customer' ? (isAr ? 'العميل' : 'Customer') : (isAr ? 'المورد' : 'Vendor')} *
            </label>
            <SearchableCombobox
              options={partnerOpts}
              value={form.partnerId}
              onChange={(v) => { setForm((p) => ({ ...p, partnerId: v })); setAllocations([]); }}
              placeholder={tab === 'customer' ? (isAr ? 'بحث في العملاء…' : 'Search customers…') : (isAr ? 'بحث في الموردين…' : 'Search vendors…')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">{isAr ? 'المبلغ (ج.م) *' : 'Amount (EGP) *'}</label>
              <NumericInput
                step="0.01" min="0.01" className="input"
                value={form.amount}
                onChange={(val) => setForm((p) => ({ ...p, amount: val }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="input-label">{isAr ? 'التاريخ *' : 'Date *'}</label>
              <input
                type="date" required className="input"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="input-label">{isAr ? 'طريقة الدفع' : 'Method'}</label>
            <SearchableCombobox
              options={PAYMENT_METHODS}
              value={form.method}
              onChange={(v) => setForm((p) => ({ ...p, method: v }))}
            />
          </div>

          <div>
            <label className="input-label">{isAr ? 'الدفتر *' : 'Journal *'}</label>
            <SearchableCombobox
              options={journalOpts}
              value={form.journalId}
              onChange={(v) => setForm((p) => ({ ...p, journalId: v }))}
              placeholder={isAr ? 'اختر دفتر بنك/نقدية…' : 'Select bank/cash journal…'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">{isAr ? 'رقم المرجع' : 'Reference #'}</label>
              <input
                className="input" placeholder={isAr ? 'رقم الشيك / الحوالة…' : 'Cheque / transfer ref…'}
                value={form.reference}
                onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">{isAr ? 'ملاحظة' : 'Note'}</label>
              <input
                className="input" placeholder={isAr ? 'ملاحظة اختيارية…' : 'Optional note…'}
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>
          </div>

          {/* WHT — vendor payments only */}
          {tab === 'vendor' && whtOpts.length > 1 && (
            <div>
              <label className="input-label">{isAr ? 'ضريبة الاستقطاع (WHT)' : 'Withholding Tax (WHT)'}</label>
              <SearchableCombobox
                options={whtOpts}
                value={form.whtCategoryId}
                onChange={(v) => setForm((p) => ({ ...p, whtCategoryId: v }))}
                placeholder={isAr ? 'بدون خصم' : 'No WHT'}
                clearable
                clearLabel={isAr ? 'بدون خصم' : 'No WHT'}
              />
              {form.whtCategoryId && form.amount && (() => {
                const cat = (whtCatsRaw?.data ?? []).find(w => w.id === form.whtCategoryId);
                const whtAmt = cat ? Number(form.amount) * cat.rate / 100 : 0;
                return (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.375rem' }}>
                    {isAr ? 'الخصم:' : 'WHT deducted:'} <strong>EGP {whtAmt.toFixed(2)}</strong> · {isAr ? 'صافي البنك:' : 'Net to bank:'} <strong>EGP {(Number(form.amount) - whtAmt).toFixed(2)}</strong>
                  </p>
                );
              })()}
            </div>
          )}

          {/* Allocations */}
          {openInvoices.length > 0 && (
            <div>
              <p className="section-label">{isAr ? 'تخصيص للفواتير' : 'Allocate to Invoices'}</p>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th />
                      <th>{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                      <th className="text-right">{isAr ? 'الأصلي' : 'Original'}</th>
                      <th className="text-right">{isAr ? 'المطبق' : 'Applied'}</th>
                      <th className="text-right">{isAr ? 'المتبقي' : 'Remaining'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openInvoices.map((inv) => {
                      const alloc = allocations.find((a) => a.invoiceId === inv.id);
                      return (
                        <tr key={inv.id}>
                          <td style={{ width: 36 }}>
                            <input
                              type="checkbox"
                              checked={!!alloc}
                              onChange={() => toggleAllocation(inv)}
                            />
                          </td>
                          <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--primary)' }}>
                            {inv.number ?? inv.id.slice(0, 8)}
                          </td>
                          <td className="text-right tabular-nums" style={{ fontSize: '0.8rem' }}>
                            {egp(Number(inv.amountTotal))}
                          </td>
                          <td className="text-right" style={{ width: 110 }}>
                            {alloc ? (
                              <NumericInput
                                step="0.01" min="0"
                                className="input text-right"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: 100 }}
                                value={alloc.amount}
                                onChange={(val) => updateAllocAmt(inv.id, val)}
                              />
                            ) : (
                              <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                          <td className="text-right tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--warning-fg)' }}>
                            {egp(Number(inv.amountResidual))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}

          <div
            className="flex gap-3 pt-2"
            style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: 'auto' }}
          >
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? (isAr ? 'جارٍ التسجيل…' : 'Registering…') : (isAr ? 'تسجيل الدفعة' : 'Register Payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const router = useRouter();
  const { isAr } = useLang();
  const [tab, setTab] = useState<'customer' | 'vendor'>('customer');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showPanel, setShowPanel] = useState(false);

  const STATUS_OPTS = [
    { value: '', label: isAr ? 'كل الحالات' : 'All statuses' },
    { value: 'DRAFT', label: isAr ? 'مسودة' : 'Draft' },
    { value: 'POSTED', label: isAr ? 'مرحل' : 'Posted' },
    { value: 'RECONCILED', label: isAr ? 'متسوي' : 'Reconciled' },
    { value: 'CANCELLED', label: isAr ? 'ملغى' : 'Cancelled' },
  ];

  const statusLabel: Record<string, string> = {
    DRAFT: isAr ? 'مسودة' : 'DRAFT',
    POSTED: isAr ? 'مرحل' : 'POSTED',
    RECONCILED: isAr ? 'متسوي' : 'RECONCILED',
    CANCELLED: isAr ? 'ملغى' : 'CANCELLED',
  };

  const type = tab === 'customer' ? 'INBOUND' : 'OUTBOUND';
  const qs = new URLSearchParams({
    type,
    limit: '30',
    ...(statusFilter && { status: statusFilter }),
    ...(search && { q: search }),
  });
  const { data, loading, error, reload } = useQuery<{ items: Payment[]; total: number }>(
    `/finance/payments?${qs}`,
    [tab, statusFilter, search],
  );

  const payments = data?.items ?? [];

  return (
    <div className="page-body" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '1.25rem 0 1rem' }}>
        <div>
          <h1 className="page-title">{isAr ? 'المدفوعات' : 'Payments'}</h1>
          <p className="page-subtitle">{data?.total ?? 0} {isAr ? 'سجل' : 'records'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowPanel(true)}>
          {isAr ? '+ تسجيل دفعة' : '+ Register Payment'}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs mb-4">
        <button
          className={`tab${tab === 'customer' ? ' active' : ''}`}
          onClick={() => setTab('customer')}
        >
          {isAr ? 'مدفوعات العملاء' : 'Customer Payments'}
        </button>
        <button
          className={`tab${tab === 'vendor' ? ' active' : ''}`}
          onClick={() => setTab('vendor')}
        >
          {isAr ? 'مدفوعات الموردين' : 'Vendor Payments'}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder={isAr ? 'بحث في المدفوعات…' : 'Search payments…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ width: 180 }}>
          <SearchableCombobox
            options={STATUS_OPTS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder={isAr ? 'كل الحالات' : 'All statuses'}
            clearable
            clearLabel={isAr ? 'كل الحالات' : 'All statuses'}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <p className="p-6 text-sm" style={{ color: 'var(--text-3)' }}>{isAr ? 'تحميل…' : 'Loading…'}</p>}
        {error && <p className="p-6 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        {!loading && (
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'رقم الدفعة' : 'Payment #'}</th>
                <th>{tab === 'customer' ? (isAr ? 'العميل' : 'Customer') : (isAr ? 'المورد' : 'Vendor')}</th>
                <th>{isAr ? 'التاريخ' : 'Date'}</th>
                <th>{isAr ? 'طريقة الدفع' : 'Method'}</th>
                <th className="text-right">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th>{isAr ? 'مطبق على' : 'Applied To'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/finance/payments/${p.id}`)}
                >
                  <td>
                    <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 500 }}>
                      {p.number ?? p.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{p.partner?.name ?? '—'}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                    {fmtDate(p.date, isAr)}
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{p.method}</td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 600 }}>{egp(Number(p.amount))}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {p.allocations?.length
                      ? p.allocations.map((a) => a.invoiceNumber ?? a.invoiceId.slice(0, 8)).join(', ')
                      : '—'}
                  </td>
                  <td>
                    <span className={statusBadge(p.status)}>{statusLabel[p.status] ?? p.status}</span>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2.5rem' }}>
                    {isAr ? 'لا توجد مدفوعات.' : 'No payments found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showPanel && (
        <RegisterPaymentPanel
          tab={tab}
          onClose={() => setShowPanel(false)}
          onSuccess={() => { setShowPanel(false); reload(); }}
        />
      )}
    </div>
  );
}
