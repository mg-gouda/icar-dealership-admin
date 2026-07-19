'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface Invoice {
  id: string;
  number: string;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'PARTIAL' | 'CANCELLED';
  date: string;
  dueDate?: string;
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
  partner?: { name: string; email?: string; phone?: string };
  deal?: { ref?: string };
}

interface InvLine {
  description: string;
  qty: string;
  unitPrice: string;
  taxRate: string;
}

const EMPTY_LINE = (): InvLine => ({ description: '', qty: '1', unitPrice: '', taxRate: '14' });


function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-info',
    PAID: 'badge badge-success',
    PARTIAL: 'badge badge-warning',
    CANCELLED: 'badge badge-danger',
  };
  return map[status] ?? 'badge badge-neutral';
}

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ApPaymentRunModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { isAr } = useLang();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [journalId, setJournalId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ processed: number; errors: number } | null>(null);

  const { data: vendorBills } = useQuery<{ items: Invoice[] }>(
    '/finance/invoices?type=VENDOR_BILL&status=POSTED&limit=100',
  );
  const { data: journalsRaw } = useQuery<any[]>('/finance/journals?type=BANK&limit=50');
  const bills = vendorBills?.items ?? [];
  const journalOpts = (Array.isArray(journalsRaw) ? journalsRaw : []).map((j: any) => ({ value: j.id, label: `${j.code} — ${j.name}` }));

  const toggle = (id: string) =>
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () =>
    setSelectedIds(p => p.length === bills.length ? [] : bills.map(b => b.id));

  const run = async () => {
    if (!selectedIds.length || !journalId) return;
    setRunning(true);
    try {
      const r = await apiFetch<any>('/finance/invoices/ap-payment-run', {
        method: 'POST',
        body: JSON.stringify({ invoiceIds: selectedIds, paymentDate, journalId }),
      });
      setResult({ processed: r.processed ?? selectedIds.length, errors: r.errors ?? 0 });
      onSuccess();
    } catch (e: any) {
      setResult({ processed: 0, errors: selectedIds.length });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isAr ? 'تشغيل مدفوعات الموردين' : 'AP Payment Run'}</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginTop: '0.25rem' }}>
            {isAr ? 'اختر فواتير الموردين المرحلة للدفع الجماعي' : 'Select posted vendor bills to pay in batch'}
          </p>
        </div>
        <div className="modal-body">
          {result ? (
            <div style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{result.errors === 0 ? '✓' : '⚠'}</div>
              <p style={{ fontWeight: 600 }}>
                {result.processed} {isAr ? (result.processed !== 1 ? 'فواتير مدفوعة' : 'فاتورة مدفوعة') : `bill${result.processed !== 1 ? 's' : ''} paid`}
              </p>
              {result.errors > 0 && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{result.errors} {isAr ? 'أخطاء' : 'errors'}</p>}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label">{isAr ? 'تاريخ الدفع' : 'Payment Date'}</label>
                  <input className="input" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>
                <div style={{ flex: 2 }}>
                  <label className="field-label">{isAr ? 'دفتر البنك' : 'Bank Journal'}</label>
                  <SearchableCombobox options={journalOpts} value={journalId} onChange={setJournalId} placeholder={isAr ? 'اختر البنك' : 'Select bank'} />
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" checked={selectedIds.length === bills.length && bills.length > 0}
                          onChange={toggleAll} />
                      </th>
                      <th>{isAr ? 'المورد' : 'Vendor'}</th>
                      <th>{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                      <th>{isAr ? 'الاستحقاق' : 'Due'}</th>
                      <th>{isAr ? 'المبلغ' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-2)' }}>{isAr ? 'لا توجد فواتير موردين مرحلة' : 'No posted vendor bills'}</td></tr>
                    )}
                    {bills.map(b => (
                      <tr key={b.id} style={{ background: selectedIds.includes(b.id) ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : undefined }}>
                        <td><input type="checkbox" checked={selectedIds.includes(b.id)} onChange={() => toggle(b.id)} /></td>
                        <td>{b.partner?.name ?? '—'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{b.number ?? b.id.slice(0,8)}</td>
                        <td style={{ color: b.dueDate && new Date(b.dueDate) < new Date() ? 'var(--danger)' : undefined }}>
                          {b.dueDate ? fmtDate(b.dueDate, isAr) : '—'}
                        </td>
                        <td>{egp(Number(b.amountTotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedIds.length > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-2)' }}>
                  {selectedIds.length} {isAr ? (selectedIds.length !== 1 ? 'فواتير محددة' : 'فاتورة محددة') : `bill${selectedIds.length !== 1 ? 's' : ''} selected`} · {isAr ? 'الإجمالي:' : 'Total:'}{' '}
                  <strong>{egp(bills.filter(b => selectedIds.includes(b.id)).reduce((s, b) => s + Number(b.amountTotal), 0))}</strong>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{result ? (isAr ? 'إغلاق' : 'Close') : (isAr ? 'إلغاء' : 'Cancel')}</button>
          {!result && (
            <button className="btn btn-primary" disabled={running || !selectedIds.length || !journalId} onClick={run}>
              {running
                ? (isAr ? 'جارٍ المعالجة…' : 'Processing…')
                : isAr
                  ? `دفع ${selectedIds.length} ${selectedIds.length !== 1 ? 'فواتير' : 'فاتورة'}`
                  : `Pay ${selectedIds.length} Bill${selectedIds.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerInvoicesPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const PAYMENT_TERM_OPTS = [
    { value: 'NET_30', label: isAr ? 'صافي 30 يوم' : 'Net 30' },
    { value: 'NET_60', label: isAr ? 'صافي 60 يوم' : 'Net 60' },
    { value: 'DUE_ON_RECEIPT', label: isAr ? 'عند الاستلام' : 'Due on Receipt' },
    { value: 'CUSTOM', label: isAr ? 'مخصص' : 'Custom' },
  ];

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showApRun, setShowApRun] = useState(false);

  const STATUS_OPTS = [
    { value: '', label: isAr ? 'كل الحالات' : 'All statuses' },
    { value: 'DRAFT', label: isAr ? 'مسودة' : 'Draft' },
    { value: 'POSTED', label: isAr ? 'مرحلة' : 'Posted' },
    { value: 'PAID', label: isAr ? 'مدفوعة' : 'Paid' },
    { value: 'PARTIAL', label: isAr ? 'جزئية' : 'Partial' },
    { value: 'CANCELLED', label: isAr ? 'ملغاة' : 'Cancelled' },
  ];

  const statusLabel: Record<string, string> = {
    DRAFT: isAr ? 'مسودة' : 'DRAFT',
    POSTED: isAr ? 'مرحلة' : 'POSTED',
    PAID: isAr ? 'مدفوعة' : 'PAID',
    PARTIAL: isAr ? 'جزئية' : 'PARTIAL',
    CANCELLED: isAr ? 'ملغاة' : 'CANCELLED',
  };

  const qs = new URLSearchParams({ limit: '30', ...(statusFilter && { status: statusFilter }), ...(search && { q: search }) });
  const { data, loading, error, reload } = useQuery<{ items: Invoice[]; total: number }>(
    `/finance/invoices?type=CUSTOMER_INVOICE&${qs}`,
    [statusFilter, search],
  );

  const { data: partnersRaw } = useQuery<any[]>('/partners?limit=200&type=CUSTOMER');
  const { data: journalsRaw } = useQuery<any[]>('/finance/journals?type=SALE&limit=50');
  const { data: dealsRaw } = useQuery<{ items: any[] }>('/deals?limit=100');

  const invoices = data?.items ?? [];
  const partnerOpts = (Array.isArray(partnersRaw) ? partnersRaw : []).map((p) => ({ value: p.id, label: p.name }));
  const journalOpts = (Array.isArray(journalsRaw) ? journalsRaw : []).map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));
  const dealOpts = [
    { value: '', label: isAr ? 'بدون مرجع صفقة' : 'No deal reference' },
    ...((dealsRaw?.items ?? []).map((d) => ({ value: d.id, label: d.ref ?? d.id.slice(0, 8) }))),
  ];

  const [form, setForm] = useState({
    partnerId: '', journalId: '', dealId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentTerms: 'NET_30',
    notes: '',
  });
  const [lines, setLines] = useState<InvLine[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  function setLine(i: number, k: keyof InvLine, v: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  }

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const tax = lines.reduce((s, l) => {
    const lineAmt = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
    return s + lineAmt * ((Number(l.taxRate) || 0) / 100);
  }, 0);
  const total = subtotal + tax;

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    await submitInvoice('DRAFT');
  }

  async function postInvoice(e: React.FormEvent) {
    e.preventDefault();
    await submitInvoice('POSTED');
  }

  async function submitInvoice(targetStatus: string) {
    if (!form.partnerId || !form.journalId) { setSaveErr(isAr ? 'العميل والدفتر مطلوبان.' : 'Customer and journal required.'); return; }
    const valid = lines.filter((l) => l.description && Number(l.unitPrice) > 0);
    if (!valid.length) { setSaveErr(isAr ? 'مطلوب بند صالح واحد على الأقل.' : 'At least one valid line required.'); return; }
    setSaving(true); setSaveErr('');
    try {
      const inv = await apiFetch<{ id: string }>('/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({
          type: 'CUSTOMER_INVOICE',
          partnerId: form.partnerId,
          journalId: form.journalId,
          ...(form.dealId && { dealId: form.dealId }),
          date: form.date,
          ...(form.dueDate && { dueDate: form.dueDate }),
          paymentTerms: form.paymentTerms,
          notes: form.notes || undefined,
          lines: valid.map((l) => ({
            description: l.description,
            quantity: Number(l.qty) || 1,
            unitPrice: Number(l.unitPrice),
            taxRate: Number(l.taxRate) || 0,
          })),
          status: targetStatus,
        }),
      });
      setShowForm(false);
      setForm({ partnerId: '', journalId: '', dealId: '', date: new Date().toISOString().split('T')[0], dueDate: '', paymentTerms: 'NET_30', notes: '' });
      setLines([EMPTY_LINE()]);
      reload();
      router.push(`/finance/invoices/${inv.id}`);
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : isAr ? 'خطأ' : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-body" style={{ maxWidth: '100%' }}>
      {/* Page header */}
      <div className="page-header" style={{ padding: '1.25rem 0 1rem' }}>
        <div>
          <h1 className="page-title">{isAr ? 'فواتير العملاء' : 'Customer Invoices'}</h1>
          <p className="page-subtitle">{data?.total ?? 0} {isAr ? 'فاتورة إجمالي' : 'invoices total'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={() => setShowApRun(true)}>{isAr ? 'تشغيل مدفوعات الموردين' : 'AP Payment Run'}</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>{isAr ? '+ فاتورة جديدة' : '+ New Invoice'}</button>
        </div>
      </div>
      {showApRun && (
        <ApPaymentRunModal
          onClose={() => setShowApRun(false)}
          onSuccess={() => { setShowApRun(false); reload(); }}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder={isAr ? 'بحث في الفواتير…' : 'Search invoices…'}
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
                <th>{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                <th>{isAr ? 'العميل' : 'Customer'}</th>
                <th>{isAr ? 'التاريخ' : 'Date'}</th>
                <th>{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                <th className="text-right">{isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'}</th>
                <th className="text-right">{isAr ? 'الضريبة' : 'Tax'}</th>
                <th className="text-right">{isAr ? 'الإجمالي' : 'Total'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                >
                  <td>
                    <span style={{ color: 'var(--primary)', fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {inv.number || inv.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{inv.partner?.name ?? '—'}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                    {fmtDate(inv.date, isAr)}
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                    {inv.dueDate ? fmtDate(inv.dueDate, isAr) : '—'}
                  </td>
                  <td className="text-right tabular-nums">{egp(Number(inv.amountUntaxed))}</td>
                  <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>
                    {egp(Number(inv.amountTax))}
                  </td>
                  <td className="text-right tabular-nums" style={{ fontWeight: 600 }}>
                    {egp(Number(inv.amountTotal))}
                  </td>
                  <td>
                    <span className={statusBadge(inv.status)}>{statusLabel[inv.status] ?? inv.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); router.push(`/finance/invoices/${inv.id}`); }}
                    >
                      {isAr ? 'عرض' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2.5rem' }}>
                    {isAr ? 'لا توجد فواتير.' : 'No invoices found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New Invoice Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ paddingTop: '2rem' }}>
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowForm(false)}
          />
          <div
            className="relative w-full card shadow-2xl"
            style={{ maxWidth: 900, background: 'var(--surface)', zIndex: 10 }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>
                  {isAr ? 'فاتورة عميل جديدة' : 'New Customer Invoice'}
                </h2>
                <p className="page-subtitle">{isAr ? 'يُولَّد الرقم تلقائياً عند الحفظ' : 'Auto-generated number on save'}</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '1.2rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                <div className="col-span-2" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">{isAr ? 'فاتورة إلى — العميل *' : 'Bill To — Customer *'}</label>
                  <SearchableCombobox
                    options={partnerOpts}
                    value={form.partnerId}
                    onChange={(v) => setForm({ ...form, partnerId: v })}
                    placeholder={isAr ? 'بحث في العملاء…' : 'Search customers…'}
                  />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'تاريخ الفاتورة *' : 'Invoice Date *'}</label>
                  <input
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                  <input
                    type="date"
                    className="input"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <label className="input-label">{isAr ? 'دفتر المبيعات *' : 'Sales Journal *'}</label>
                  <SearchableCombobox
                    options={journalOpts}
                    value={form.journalId}
                    onChange={(v) => setForm({ ...form, journalId: v })}
                    placeholder={isAr ? 'اختر دفتراً…' : 'Select journal…'}
                  />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'مرجع الصفقة (اختياري)' : 'Deal Reference (optional)'}</label>
                  <SearchableCombobox
                    options={dealOpts}
                    value={form.dealId}
                    onChange={(v) => setForm({ ...form, dealId: v })}
                    placeholder={isAr ? 'بدون صفقة' : 'No deal'}
                    clearable
                    clearLabel={isAr ? 'بدون مرجع صفقة' : 'No deal reference'}
                  />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'شروط الدفع' : 'Payment Terms'}</label>
                  <SearchableCombobox
                    options={PAYMENT_TERM_OPTS}
                    value={form.paymentTerms}
                    onChange={(v) => setForm({ ...form, paymentTerms: v })}
                  />
                </div>
              </div>

              {/* Invoice lines */}
              <div>
                <p className="section-label">{isAr ? 'بنود الفاتورة' : 'Invoice Lines'}</p>
                <div
                  className="card"
                  style={{ overflow: 'hidden', border: '1px solid var(--border)' }}
                >
                  <table className="data-table" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 32 }} />
                      <col style={{ width: 'auto' }} />
                      <col style={{ width: 72 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 28 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{isAr ? 'الوصف' : 'Description'}</th>
                        <th className="text-right">{isAr ? 'الكمية' : 'Qty'}</th>
                        <th className="text-right">{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                        <th className="text-right">{isAr ? 'الضريبة %' : 'Tax %'}</th>
                        <th className="text-right">{isAr ? 'المبلغ' : 'Amount'}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => {
                        const amt = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
                        return (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{i + 1}</td>
                            <td>
                              <input
                                className="input"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                placeholder={isAr ? 'الوصف…' : 'Description…'}
                                value={line.description}
                                onChange={(e) => setLine(i, 'description', e.target.value)}
                              />
                            </td>
                            <td>
                              <NumericInput
                                min="0.01"
                                step="0.01"
                                className="input text-right"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                value={line.qty}
                                onChange={(val) => setLine(i, 'qty', val)}
                              />
                            </td>
                            <td>
                              <NumericInput
                                min="0"
                                step="0.01"
                                className="input text-right tabular-nums"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                placeholder="0.00"
                                value={line.unitPrice}
                                onChange={(val) => setLine(i, 'unitPrice', val)}
                              />
                            </td>
                            <td>
                              <NumericInput
                                min="0"
                                max="100"
                                step="0.01"
                                className="input text-right"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                value={line.taxRate}
                                onChange={(val) => setLine(i, 'taxRate', val)}
                              />
                            </td>
                            <td className="text-right tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                              {egp(amt)}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                                disabled={lines.length <= 1}
                                style={{ color: 'var(--danger)', opacity: lines.length <= 1 ? 0.3 : 1, fontSize: '1rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setLines((prev) => [...prev, EMPTY_LINE()])}
                    >
                      {isAr ? '+ إضافة بند' : '+ Add Line'}
                    </button>
                    <div className="space-y-1 text-right" style={{ minWidth: 220 }}>
                      <div className="flex justify-between gap-8 text-sm" style={{ color: 'var(--text-2)' }}>
                        <span>{isAr ? 'المجموع الجزئي' : 'Subtotal'}</span>
                        <span className="tabular-nums">{egp(subtotal)}</span>
                      </div>
                      <div className="flex justify-between gap-8 text-sm" style={{ color: 'var(--text-2)' }}>
                        <span>{isAr ? 'الضريبة' : 'Tax'}</span>
                        <span className="tabular-nums">{egp(tax)}</span>
                      </div>
                      <div
                        className="flex justify-between gap-8"
                        style={{ fontWeight: 700, fontSize: '0.9375rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}
                      >
                        <span>{isAr ? 'الإجمالي' : 'Total'}</span>
                        <span className="tabular-nums" style={{ color: 'var(--primary)' }}>{egp(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <textarea
                  className="textarea input"
                  rows={3}
                  placeholder={isAr ? 'ملاحظات داخلية أو تعليقات للعميل…' : 'Internal notes or customer-facing comments…'}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {saveErr && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{saveErr}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={saveDraft}
                >
                  {isAr ? 'حفظ كمسودة' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={postInvoice}
                >
                  {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'التحقق والترحيل' : 'Validate & Post')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
