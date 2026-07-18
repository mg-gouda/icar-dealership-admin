'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import SearchableCombobox from '../../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  subtotal: number;
  category?: string;
  account?: { code: string; name: string };
  tax?: { name: string; rate: number };
}

interface PaymentAllocation {
  id: string;
  amount: number;
  payment: { id: string; date: string; amount: number; method: string; status: string };
}

interface Invoice {
  id: string;
  number?: string;
  type: string;
  status: string;
  paymentStatus: string;
  date: string;
  dueDate?: string;
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
  amountResidual: number;
  notes?: string;
  partner?: { id: string; name: string; email?: string; phone?: string };
  deal?: { id: string; ref?: string };
  journal?: { code: string; name: string };
  lines: InvoiceLine[];
  paymentAllocations: PaymentAllocation[];
  journalEntry?: {
    id: string;
    ref?: string;
    lines: { id: string; debit: number; credit: number; account?: { code: string; name: string } }[];
  };
}

const egp = (n: number) =>
  'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// ── Register Payment Dialog ──────────────────────────────────────────────────
function RegisterPaymentDialog({ invoice, onClose, onSuccess }: {
  invoice: Invoice; onClose: () => void; onSuccess: () => void;
}) {
  const { isAr } = useLang();
  const [form, setForm] = useState({
    amount: Number(invoice.amountResidual).toFixed(2),
    date: new Date().toISOString().split('T')[0],
    method: 'TRANSFER',
    memo: '',
    journalId: '',
  });
  const { data: journalsRaw } = useQuery<{ items: { id: string; code: string; name: string }[] }>(
    '/finance/journals?type=BANK&limit=50',
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const journalOpts = (journalsRaw?.items ?? []).map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));
  const METHODS = [
    { value: 'TRANSFER', label: isAr ? 'تحويل بنكي' : 'Bank Transfer' },
    { value: 'CHECK', label: isAr ? 'شيك' : 'Cheque' },
    { value: 'CASH', label: isAr ? 'نقداً' : 'Cash' },
    { value: 'CARD', label: isAr ? 'بطاقة' : 'Card' },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.journalId) { setErr(isAr ? 'اختر دفتراً.' : 'Select a journal.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          type: 'INBOUND',
          partnerId: invoice.partner?.id,
          journalId: form.journalId,
          date: form.date,
          amount: Number(form.amount),
          method: form.method,
          memo: form.memo || undefined,
          invoiceIds: [invoice.id],
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="relative w-full card shadow-2xl" style={{ maxWidth: 480, background: 'var(--surface)', zIndex: 10 }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)' }}>
            {isAr ? 'تسجيل دفعة' : 'Register Payment'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ fontSize: '1.2rem' }}>×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">{isAr ? 'المبلغ (ج.م) *' : 'Amount (EGP) *'}</label>
              <NumericInput
                step="0.01" className="input"
                value={form.amount}
                onChange={(val) => setForm((p) => ({ ...p, amount: val }))}
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
            <label className="input-label">{isAr ? 'الدفتر *' : 'Journal *'}</label>
            <SearchableCombobox
              options={journalOpts}
              value={form.journalId}
              onChange={(v) => setForm((p) => ({ ...p, journalId: v }))}
              placeholder={isAr ? 'اختر دفتراً…' : 'Select journal…'}
            />
          </div>
          <div>
            <label className="input-label">{isAr ? 'طريقة الدفع' : 'Method'}</label>
            <SearchableCombobox
              options={METHODS}
              value={form.method}
              onChange={(v) => setForm((p) => ({ ...p, method: v }))}
            />
          </div>
          <div>
            <label className="input-label">{isAr ? 'ملاحظة' : 'Memo'}</label>
            <input
              className="input" placeholder={isAr ? 'مرجع اختياري…' : 'Optional reference…'}
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
            />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}
          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'تسجيل الدفعة' : 'Register Payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Line Row ─────────────────────────────────────────────────────────────
function AddLineRow({ invoiceId, onSuccess, onCancel }: {
  invoiceId: string; onSuccess: () => void; onCancel: () => void;
}) {
  const { isAr } = useLang();
  const { data: accountsRaw } = useQuery<{ items?: { id: string; code: string; name: string }[] } | { id: string; code: string; name: string }[]>('/finance/accounts?limit=200');
  const { data: taxesRaw } = useQuery<{ items?: { id: string; name: string }[] } | { id: string; name: string }[]>('/finance/taxes?limit=50');

  const accountOpts = (() => {
    const arr = Array.isArray(accountsRaw) ? accountsRaw : (accountsRaw as any)?.items ?? [];
    return (arr as { id: string; code: string; name: string }[]).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));
  })();
  const taxOpts = (() => {
    const arr = Array.isArray(taxesRaw) ? taxesRaw : (taxesRaw as any)?.items ?? [];
    return [{ value: '', label: isAr ? 'بدون ضريبة' : 'No tax' }, ...(arr as { id: string; name: string }[]).map((t) => ({ value: t.id, label: t.name }))];
  })();

  const [form, setForm] = useState({ description: '', quantity: '1', unitPrice: '', accountId: '', taxId: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountId) { setErr(isAr ? 'اختر حساباً.' : 'Select an account.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch(`/finance/invoices/${invoiceId}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          description: form.description,
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
          accountId: form.accountId,
          ...(form.taxId ? { taxId: form.taxId } : {}),
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  const previewAmt = (Number(form.quantity) || 0) * (Number(form.unitPrice) || 0);

  return (
    <tr style={{ background: 'var(--info-bg)' }}>
      <td colSpan={7} style={{ padding: '1rem 1.25rem' }}>
        <form onSubmit={submit}>
          <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
            <div>
              <label className="input-label">{isAr ? 'الوصف *' : 'Description *'}</label>
              <input required className="input" style={{ fontSize: '0.8rem' }}
                value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={isAr ? 'بند…' : 'Line item…'} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'الكمية *' : 'Qty *'}</label>
              <NumericInput min="0.01" step="0.01" className="input" style={{ fontSize: '0.8rem' }}
                value={form.quantity} onChange={(val) => setForm((p) => ({ ...p, quantity: val }))} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'سعر الوحدة *' : 'Unit Price *'}</label>
              <NumericInput min="0" step="0.01" className="input" style={{ fontSize: '0.8rem' }}
                value={form.unitPrice} onChange={(val) => setForm((p) => ({ ...p, unitPrice: val }))} placeholder="0.00" />
            </div>
            <div>
              <label className="input-label">{isAr ? 'الحساب *' : 'Account *'}</label>
              <SearchableCombobox options={accountOpts} value={form.accountId}
                onChange={(v) => setForm((p) => ({ ...p, accountId: v }))} placeholder={isAr ? 'الحساب…' : 'Account…'} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'الضريبة' : 'Tax'}</label>
              <SearchableCombobox options={taxOpts} value={form.taxId}
                onChange={(v) => setForm((p) => ({ ...p, taxId: v }))} placeholder={isAr ? 'بدون ضريبة' : 'No tax'} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                {saving ? (isAr ? 'جارٍ الإضافة…' : 'Adding…') : (isAr ? 'إضافة بند' : 'Add Line')}
              </button>
            </div>
            {previewAmt > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                {isAr ? 'المجموع الجزئي:' : 'Subtotal:'} <strong style={{ color: 'var(--text-1)' }}>{egp(previewAmt)}</strong>
              </span>
            )}
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{err}</p>}
        </form>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAr } = useLang();
  const { data: invoice, loading, error, reload } = useQuery<Invoice>(`/finance/invoices/${id}`, [id]);

  const [posting, setPosting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [submittingEta, setSubmittingEta] = useState(false);
  const [etaResult, setEtaResult] = useState<{ status: string; submissionId?: string } | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [actionErr, setActionErr] = useState('');

  async function post() {
    setPosting(true); setActionErr('');
    try { await apiFetch(`/finance/invoices/${id}/post`, { method: 'PATCH' }); await reload(); }
    catch (e: unknown) { setActionErr(e instanceof Error ? e.message : 'Error'); }
    finally { setPosting(false); }
  }

  async function cancel() {
    if (!confirm(isAr ? 'إلغاء هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.' : 'Cancel this invoice? This cannot be undone.')) return;
    setCancelling(true); setActionErr('');
    try { await apiFetch(`/finance/invoices/${id}/cancel`, { method: 'PATCH' }); await reload(); }
    catch (e: unknown) { setActionErr(e instanceof Error ? e.message : 'Error'); }
    finally { setCancelling(false); }
  }

  async function reverse() {
    if (!confirm(isAr ? 'عكس هذه الفاتورة؟ سيُنشأ قيد عكسي وتُلغى الفاتورة.' : 'Reverse this invoice? A reversing journal entry will be created and the invoice marked Cancelled.')) return;
    setReversing(true); setActionErr('');
    try { await apiFetch(`/finance/invoices/${id}/reverse`, { method: 'PATCH' }); await reload(); }
    catch (e: unknown) { setActionErr(e instanceof Error ? e.message : 'Error'); }
    finally { setReversing(false); }
  }

  async function submitToEta() {
    setSubmittingEta(true); setActionErr('');
    try {
      const r = await apiFetch<{ status: string; submissionId?: string }>(`/finance/eta/invoices/${id}/submit`, { method: 'POST' });
      setEtaResult(r);
    } catch (e: unknown) { setActionErr(e instanceof Error ? e.message : 'ETA submission failed'); }
    finally { setSubmittingEta(false); }
  }

  function printPdf() {
    if (!invoice) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFontSize(16); doc.text('iCar Dealership', 14, 18);
    doc.setFontSize(10); doc.setTextColor(100); doc.text('Customer Invoice', 14, 25);
    doc.setTextColor(0); doc.setFontSize(9);
    doc.text(`Ref: ${invoice.number ?? invoice.id.slice(0, 8)}`, 14, 32);
    doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-EG')}`, 14, 38);
    if (invoice.dueDate) doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString('en-EG')}`, 14, 44);
    if (invoice.partner) doc.text(`Customer: ${invoice.partner.name}`, 100, 32);
    doc.text(`Status: ${invoice.status}`, 100, 38);
    autoTable(doc, {
      startY: 52,
      head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Subtotal']],
      body: invoice.lines.map((l) => [
        l.description ?? '',
        String(l.quantity),
        egp(Number(l.unitPrice)),
        l.tax ? `${l.tax.rate}%` : '—',
        egp(Number(l.subtotal)),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
    doc.setFontSize(9);
    doc.text(`Subtotal: ${egp(Number(invoice.amountUntaxed))}`, 140, finalY + 8);
    doc.text(`Tax: ${egp(Number(invoice.amountTax))}`, 140, finalY + 14);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${egp(Number(invoice.amountTotal))}`, 140, finalY + 22);
    doc.save(`invoice-${invoice.number ?? invoice.id.slice(0, 8)}.pdf`);
  }

  if (loading) return <div className="page-body" style={{ color: 'var(--text-3)' }}>{isAr ? 'تحميل الفاتورة…' : 'Loading invoice…'}</div>;
  if (error || !invoice) return (
    <div className="page-body">
      <p style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error ?? (isAr ? 'الفاتورة غير موجودة' : 'Invoice not found')}</p>
      <Link href="/finance/invoices" style={{ color: 'var(--primary)', fontSize: '0.875rem' }}>
        {isAr ? '← العودة للفواتير' : '← Back to invoices'}
      </Link>
    </div>
  );

  const isDraft = invoice.status === 'DRAFT';
  const isPosted = invoice.status === 'POSTED';
  const canPay = isPosted && Number(invoice.amountResidual) > 0;
  const isCustomerInvoice = invoice.type === 'CUSTOMER_INVOICE' || invoice.type === 'out_invoice';
  const etaSubmissionId = (invoice as any).etaSubmissionId as string | undefined;

  return (
    <div className="page-body" style={{ maxWidth: 1100 }}>
      {/* Breadcrumb + title row */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/finance/invoices" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {isAr ? '← فواتير العملاء' : '← Customer Invoices'}
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="page-title">
              {isAr ? 'فاتورة عميل' : 'Customer Invoice'} — {invoice.number ?? invoice.id.slice(0, 8).toUpperCase()}
            </h1>
            <span className={statusBadge(invoice.status)}>{invoice.status}</span>
          </div>
          {invoice.partner && (
            <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
              {invoice.partner.name}
              {invoice.partner.email && ` · ${invoice.partner.email}`}
              {invoice.deal?.ref && ` · ${isAr ? 'صفقة' : 'Deal'} ${invoice.deal.ref}`}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button className="btn btn-secondary btn-sm" onClick={printPdf}>{isAr ? 'طباعة PDF' : 'Print PDF'}</button>
          {isDraft && (
            <button className="btn btn-primary" onClick={post} disabled={posting}>
              {posting ? (isAr ? 'جارٍ الترحيل…' : 'Posting…') : (isAr ? 'التحقق والترحيل' : 'Validate & Post')}
            </button>
          )}
          {canPay && (
            <button className="btn btn-primary" onClick={() => setShowPayDialog(true)}
              style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
              {isAr ? '+ تسجيل دفعة' : '+ Register Payment'}
            </button>
          )}
          {isDraft && (
            <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={cancelling}
              style={{ color: 'var(--danger)' }}>
              {cancelling ? '…' : (isAr ? 'إلغاء' : 'Cancel')}
            </button>
          )}
          {isPosted && isCustomerInvoice && (
            <button
              className="btn btn-sm"
              onClick={submitToEta}
              disabled={submittingEta}
              title={etaSubmissionId ? `ETA ID: ${etaSubmissionId}` : 'Submit to ETA e-invoicing'}
              style={{ borderColor: etaSubmissionId ? 'var(--success)' : 'var(--border)', color: etaSubmissionId ? 'var(--success)' : 'var(--text-2)' }}
            >
              {submittingEta ? (isAr ? 'جارٍ الإرسال…' : 'Submitting…') : etaSubmissionId ? '✓ ETA Submitted' : '⇪ Submit to ETA'}
            </button>
          )}
          {isPosted && (
            <button className="btn btn-ghost btn-sm" onClick={reverse} disabled={reversing}
              style={{ color: 'var(--danger)' }}>
              {reversing ? '…' : (isAr ? 'عكس' : 'Reverse')}
            </button>
          )}
        </div>
      </div>
      {etaResult && (
        <div className="mb-4 px-4 py-3 card" style={{
          background: etaResult.status === 'SUBMITTED' ? 'var(--success-bg, #f0fdf4)' : 'var(--surface-2)',
          borderColor: etaResult.status === 'SUBMITTED' ? 'var(--success)' : 'var(--border)',
          fontSize: '0.875rem',
        }}>
          ETA: <strong>{etaResult.status}</strong>
          {etaResult.submissionId && <> — ID: <code>{etaResult.submissionId}</code></>}
          {etaResult.status === 'CREDENTIALS_NOT_CONFIGURED' && ' — Set ETA_CLIENT_ID + ETA_CLIENT_SECRET env vars to enable live submission.'}
        </div>
      )}

      {actionErr && (
        <div className="mb-4 px-4 py-3 card" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger)', color: 'var(--danger-fg)', fontSize: '0.875rem' }}>
          {actionErr}
        </div>
      )}

      {/* Status pipeline */}
      <div className="card mb-5 px-6 py-4" style={{ background: 'var(--surface-2)' }}>
        <div className="flex items-center gap-1">
          {['DRAFT', 'POSTED', 'PAID'].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && (
                <div style={{ width: 32, height: 2, background: ['POSTED', 'PAID'].includes(invoice.status) && i === 1
                  ? 'var(--primary)' : invoice.status === 'PAID' && i === 2 ? 'var(--success)' : 'var(--border)' }} />
              )}
              <span className={s === invoice.status ? (s === 'PAID' ? 'badge badge-success' : 'badge badge-info') : 'badge badge-neutral'}>
                {s}
              </span>
            </div>
          ))}
          {invoice.status === 'CANCELLED' && <span className="badge badge-danger ml-2">CANCELLED</span>}
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* Left column: form fields + lines */}
        <div className="space-y-5">
          {/* Meta */}
          <div className="card p-5">
            <p className="section-label">{isAr ? 'تفاصيل الفاتورة' : 'Invoice Details'}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="input-label">{isAr ? 'العميل' : 'Customer'}</p>
                <p style={{ fontWeight: 600, color: 'var(--text-1)' }}>{invoice.partner?.name ?? '—'}</p>
                {invoice.partner?.email && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{invoice.partner.email}</p>}
                {invoice.partner?.phone && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{invoice.partner.phone}</p>}
              </div>
              <div>
                <p className="input-label">{isAr ? 'مرجع الصفقة' : 'Deal Reference'}</p>
                <p style={{ color: 'var(--text-1)' }}>{invoice.deal?.ref ?? '—'}</p>
              </div>
              <div>
                <p className="input-label">{isAr ? 'تاريخ الفاتورة' : 'Invoice Date'}</p>
                <p style={{ color: 'var(--text-1)' }}>{fmtDate(invoice.date, isAr)}</p>
              </div>
              <div>
                <p className="input-label">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</p>
                <p style={{ color: 'var(--text-1)' }}>
                  {invoice.dueDate ? fmtDate(invoice.dueDate, isAr) : '—'}
                </p>
              </div>
              <div>
                <p className="input-label">{isAr ? 'دفتر المبيعات' : 'Sales Journal'}</p>
                <p style={{ color: 'var(--text-1)' }}>
                  {invoice.journal ? `${invoice.journal.code} — ${invoice.journal.name}` : '—'}
                </p>
              </div>
              {invoice.notes && (
                <div className="col-span-2">
                  <p className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</p>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice lines */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="section-label" style={{ margin: 0 }}>{isAr ? 'بنود الفاتورة' : 'Invoice Lines'}</p>
              {isDraft && !showAddLine && (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddLine(true)}>
                  {isAr ? '+ إضافة بند' : '+ Add Line'}
                </button>
              )}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'الوصف' : 'Description'}</th>
                  <th>{isAr ? 'الفئة' : 'Category'}</th>
                  <th className="text-right">{isAr ? 'الكمية' : 'Qty'}</th>
                  <th className="text-right">{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                  <th className="text-right">{isAr ? 'الضريبة' : 'Tax'}</th>
                  <th className="text-right">{isAr ? 'المجموع الجزئي' : 'Subtotal'}</th>
                  {isDraft && <th />}
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500 }}>{l.description}</td>
                    <td>
                      {l.category && (
                        <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{l.category}</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums" style={{ color: 'var(--text-2)' }}>{l.quantity}</td>
                    <td className="text-right tabular-nums">{egp(l.unitPrice)}</td>
                    <td className="text-right" style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>
                      {l.tax ? `${l.tax.name} ${l.tax.rate}%` : (isAr ? 'معفاة' : 'Exempt')}
                    </td>
                    <td className="text-right tabular-nums" style={{ fontWeight: 600 }}>{egp(l.subtotal)}</td>
                    {isDraft && <td />}
                  </tr>
                ))}
                {showAddLine && (
                  <AddLineRow
                    invoiceId={id}
                    onSuccess={() => { setShowAddLine(false); reload(); }}
                    onCancel={() => setShowAddLine(false)}
                  />
                )}
              </tbody>
            </table>
            {/* Totals footer */}
            <div className="flex justify-end px-5 py-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ minWidth: 260 }} className="space-y-2">
                <div className="flex justify-between text-sm" style={{ color: 'var(--text-2)' }}>
                  <span>{isAr ? 'المجموع الجزئي' : 'Subtotal'}</span>
                  <span className="tabular-nums">{egp(Number(invoice.amountUntaxed))}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ color: 'var(--text-2)' }}>
                  <span>{isAr ? 'ضريبة المبيعات (14%)' : 'Sales Tax (14%)'}</span>
                  <span className="tabular-nums">{egp(Number(invoice.amountTax))}</span>
                </div>
                <div className="flex justify-between" style={{ fontWeight: 700, fontSize: '1rem', borderTop: '2px solid var(--border-strong)', paddingTop: '0.5rem' }}>
                  <span>{isAr ? 'الإجمالي' : 'Total'}</span>
                  <span className="tabular-nums">{egp(Number(invoice.amountTotal))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* GL entries */}
          {invoice.journalEntry && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="section-label" style={{ margin: 0 }}>
                  {isAr ? 'القيد المحاسبي' : 'Journal Entry'}
                  <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: 'var(--text-3)' }}>
                    {invoice.journalEntry.ref}
                  </span>
                </p>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'الحساب' : 'Account'}</th>
                    <th className="text-right">{isAr ? 'مدين' : 'Debit'}</th>
                    <th className="text-right">{isAr ? 'دائن' : 'Credit'}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.journalEntry.lines.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                        {l.account ? `${l.account.code} — ${l.account.name}` : l.id}
                      </td>
                      <td className="text-right tabular-nums" style={{ color: Number(l.debit) > 0 ? 'var(--success)' : 'transparent' }}>
                        {Number(l.debit) > 0 ? egp(l.debit) : ''}
                      </td>
                      <td className="text-right tabular-nums" style={{ color: Number(l.credit) > 0 ? 'var(--danger)' : 'transparent' }}>
                        {Number(l.credit) > 0 ? egp(l.credit) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: totals + payments */}
        <div className="space-y-4">
          {/* Invoice totals card */}
          <div className="card p-5">
            <p className="section-label">{isAr ? 'إجماليات الفاتورة' : 'Invoice Totals'}</p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-2)' }}>{isAr ? 'المبلغ قبل الضريبة' : 'Untaxed Amount'}</span>
                <span className="tabular-nums" style={{ fontWeight: 500 }}>{egp(Number(invoice.amountUntaxed))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-2)' }}>{isAr ? 'ضريبة المبيعات (14%)' : 'Sales Tax (14%)'}</span>
                <span className="tabular-nums" style={{ fontWeight: 500 }}>{egp(Number(invoice.amountTax))}</span>
              </div>
              <div className="flex justify-between" style={{ borderTop: '2px solid var(--border-strong)', paddingTop: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>
                <span>{isAr ? 'الإجمالي' : 'Total'}</span>
                <span className="tabular-nums">{egp(Number(invoice.amountTotal))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-2)' }}>{isAr ? 'المبلغ المدفوع' : 'Amount Paid'}</span>
                <span className="tabular-nums" style={{ color: 'var(--success-fg)', fontWeight: 500 }}>
                  {egp(Number(invoice.amountTotal) - Number(invoice.amountResidual))}
                </span>
              </div>
              <div
                className="flex justify-between rounded-lg px-3 py-2"
                style={{
                  background: Number(invoice.amountResidual) > 0 ? 'var(--danger-bg)' : 'var(--success-bg)',
                  fontWeight: 700,
                }}
              >
                <span style={{ color: Number(invoice.amountResidual) > 0 ? 'var(--danger-fg)' : 'var(--success-fg)' }}>
                  {isAr ? 'المبلغ المستحق' : 'Amount Due'}
                </span>
                <span
                  className="tabular-nums"
                  style={{ color: Number(invoice.amountResidual) > 0 ? 'var(--danger-fg)' : 'var(--success-fg)' }}
                >
                  {egp(Number(invoice.amountResidual))}
                </span>
              </div>
            </div>
          </div>

          {/* Payments applied */}
          <div className="card p-5">
            <p className="section-label">{isAr ? 'المدفوعات المطبقة' : 'Payments Applied'}</p>
            {invoice.paymentAllocations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                {isAr ? 'لا توجد مدفوعات بعد.' : 'No payments yet.'}
              </div>
            ) : (
              <div className="space-y-2">
                {invoice.paymentAllocations.map((pa) => (
                  <div key={pa.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p style={{ fontWeight: 500, color: 'var(--text-1)' }}>
                        {fmtDate(pa.payment.date, isAr)}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{pa.payment.method}</p>
                    </div>
                    <span className="tabular-nums" style={{ color: 'var(--success-fg)', fontWeight: 600 }}>
                      {egp(pa.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {canPay && (
              <button
                className="btn btn-primary w-full mt-4"
                onClick={() => setShowPayDialog(true)}
              >
                {isAr ? '+ تسجيل دفعة' : '+ Register Payment'}
              </button>
            )}
          </div>

          {/* Tax breakdown */}
          <div className="card p-5">
            <p className="section-label">{isAr ? 'تفاصيل الضريبة' : 'Tax Breakdown'}</p>
            <div className="space-y-2 text-sm">
              {/* ponytail: group lines by tax rate */}
              {(() => {
                const taxable = invoice.lines.filter((l) => l.tax && l.tax.rate > 0);
                const exempt = invoice.lines.filter((l) => !l.tax || l.tax.rate === 0);
                const taxableTotal = taxable.reduce((s, l) => s + Number(l.subtotal), 0);
                const exemptTotal = exempt.reduce((s, l) => s + Number(l.subtotal), 0);
                return (
                  <>
                    {taxableTotal > 0 && (
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-2)' }}>{isAr ? 'ضريبة القيمة المضافة 14% — سيارة وضمان' : 'VAT 14% — Vehicle & Warranty'}</span>
                        <span className="tabular-nums" style={{ fontWeight: 500 }}>{egp(Number(invoice.amountTax))}</span>
                      </div>
                    )}
                    {exemptTotal > 0 && (
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-2)' }}>{isAr ? 'معفاة — رسوم وتأمين' : 'Exempt — Fees & Insurance'}</span>
                        <span className="tabular-nums" style={{ color: 'var(--text-3)' }}>EGP 0</span>
                      </div>
                    )}
                    {taxableTotal === 0 && exemptTotal === 0 && (
                      <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{isAr ? 'لا توجد بنود ضريبية.' : 'No tax lines.'}</p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {showPayDialog && (
        <RegisterPaymentDialog
          invoice={invoice}
          onClose={() => setShowPayDialog(false)}
          onSuccess={() => { setShowPayDialog(false); reload(); }}
        />
      )}
    </div>
  );
}
