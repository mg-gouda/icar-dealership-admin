'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface InvoiceLine {
  id: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Invoice {
  id: string;
  number?: string;
  type: string;
  status: string;
  date: string;
  dueDate?: string;
  amountTotal: number;
  amountPaid?: number;
  currency?: string;
  reference?: string;
  partner?: { id: string; name: string };
  location?: { id: string; name: string };
  lines?: InvoiceLine[];
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge badge-neutral',
  POSTED: 'badge badge-info',
  PARTIAL: 'badge badge-warning',
  PAID: 'badge badge-success',
  CANCELLED: 'badge badge-danger',
};

const fmtMoney = (n: number, currency = 'EGP') =>
  `${currency} ${Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VendorBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAr } = useLang();

  const { data: invoice, loading, error, reload } = useQuery<Invoice>(
    `/finance/invoices/${id}`,
    [id],
  );

  async function postBill() {
    if (!confirm(isAr ? 'ترحيل هذه الفاتورة؟' : 'Post this vendor bill?')) return;
    try {
      await apiFetch(`/finance/invoices/${id}/post`, { method: 'POST' });
      reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error posting bill');
    }
  }

  async function cancelBill() {
    if (!confirm(isAr ? 'إلغاء هذه الفاتورة؟' : 'Cancel this vendor bill?')) return;
    try {
      await apiFetch(`/finance/invoices/${id}/cancel`, { method: 'POST' });
      reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error cancelling bill');
    }
  }

  if (loading) {
    return (
      <div className="page-body flex items-center gap-3 p-10 text-[--text-3] text-sm">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        {isAr ? 'جاري التحميل…' : 'Loading…'}
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="page-body p-10 text-center">
        <p className="text-danger-fg text-sm">{error ?? (isAr ? 'فاتورة غير موجودة' : 'Bill not found')}</p>
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm mt-4">
          {isAr ? '← رجوع' : '← Back'}
        </button>
      </div>
    );
  }

  const balanceDue = invoice.amountTotal - (invoice.amountPaid ?? 0);

  return (
    <div className="page-body space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <button onClick={() => router.back()} className="text-xs text-[--text-3] hover:text-[--text-1] mb-1 flex items-center gap-1">
            ← {isAr ? 'فواتير الموردين' : 'Vendor Bills'}
          </button>
          <h1 className="page-title">
            {invoice.number ?? `BILL-${invoice.id.slice(0, 8).toUpperCase()}`}
          </h1>
          <p className="page-subtitle">
            {invoice.partner?.name ?? '—'} · {fmtDate(invoice.date, isAr)}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'DRAFT' && (
            <>
              <button onClick={postBill} className="btn btn-primary">
                {isAr ? 'ترحيل الفاتورة' : 'Post Bill'}
              </button>
              <button onClick={cancelBill} className="btn btn-secondary text-danger-fg">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </>
          )}
          {(invoice.status === 'POSTED' || invoice.status === 'PARTIAL') && (
            <button
              onClick={() => router.push(`/finance/payments/new?billId=${id}`)}
              className="btn btn-primary"
            >
              {isAr ? 'تسجيل دفعة' : 'Record Payment'}
            </button>
          )}
        </div>
      </div>

      {/* Main card */}
      <div className="px-6 grid grid-cols-[1fr_auto] gap-5">
        {/* Left: line items */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[--border] bg-[--surface-2]">
            <p className="section-label mb-0">{isAr ? 'بنود الفاتورة' : 'Bill Lines'}</p>
          </div>
          {invoice.lines && invoice.lines.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'البيان' : 'Description'}</th>
                  <th className="text-right">{isAr ? 'الكمية' : 'Qty'}</th>
                  <th className="text-right">{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                  <th className="text-right">{isAr ? 'الإجمالي' : 'Subtotal'}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="text-[--text-1]">{line.description ?? '—'}</td>
                    <td className="text-right tabular-nums">{line.quantity}</td>
                    <td className="text-right tabular-nums">{fmtMoney(line.unitPrice, invoice.currency)}</td>
                    <td className="text-right tabular-nums font-medium">{fmtMoney(line.subtotal, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[--surface-2] font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-right text-[--text-1]">
                    {isAr ? 'الإجمالي' : 'Total'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[--primary]">
                    {fmtMoney(invoice.amountTotal, invoice.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="p-6 text-xs text-[--text-3] text-center">
              {isAr ? 'لا توجد بنود.' : 'No line items.'}
            </p>
          )}
        </div>

        {/* Right: details */}
        <div className="w-64 space-y-4">
          <div className="card p-4 space-y-3">
            <p className="section-label">{isAr ? 'الحالة' : 'Status'}</p>
            <span className={STATUS_BADGE[invoice.status] ?? 'badge badge-neutral'}>
              {invoice.status}
            </span>

            <div className="pt-2 space-y-2 border-t border-[--border]">
              <div className="flex justify-between text-xs">
                <span className="text-[--text-3]">{isAr ? 'المورد' : 'Vendor'}</span>
                <span className="text-[--text-1] font-medium">{invoice.partner?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[--text-3]">{isAr ? 'تاريخ الفاتورة' : 'Bill Date'}</span>
                <span className="text-[--text-2]">{fmtDate(invoice.date, isAr)}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-[--text-3]">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</span>
                  <span className="text-[--text-2]">{fmtDate(invoice.dueDate, isAr)}</span>
                </div>
              )}
              {invoice.reference && (
                <div className="flex justify-between text-xs">
                  <span className="text-[--text-3]">{isAr ? 'المرجع' : 'Reference'}</span>
                  <span className="font-mono text-[--text-2]">{invoice.reference}</span>
                </div>
              )}
              {invoice.location && (
                <div className="flex justify-between text-xs">
                  <span className="text-[--text-3]">{isAr ? 'الفرع' : 'Location'}</span>
                  <span className="text-[--text-2]">{invoice.location.name}</span>
                </div>
              )}
            </div>

            <div className="pt-2 space-y-2 border-t border-[--border]">
              <div className="flex justify-between text-sm">
                <span className="text-[--text-2]">{isAr ? 'الإجمالي' : 'Total'}</span>
                <span className="tabular-nums font-semibold text-[--text-1]">
                  {fmtMoney(invoice.amountTotal, invoice.currency)}
                </span>
              </div>
              {(invoice.amountPaid ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[--text-2]">{isAr ? 'مدفوع' : 'Paid'}</span>
                  <span className="tabular-nums text-success-fg">
                    {fmtMoney(invoice.amountPaid ?? 0, invoice.currency)}
                  </span>
                </div>
              )}
              {balanceDue > 0 && (
                <div className="flex justify-between text-sm font-bold border-t border-[--border] pt-2">
                  <span className="text-[--text-1]">{isAr ? 'الرصيد المستحق' : 'Balance Due'}</span>
                  <span className="tabular-nums text-danger-fg">
                    {fmtMoney(balanceDue, invoice.currency)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
