'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface VendorBill {
  id: string;
  number?: string;
  date: string;
  dueDate?: string;
  vendor?: { id: string; name: string };
  reference?: string;
  status: 'DRAFT' | 'POSTED' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  totalAmount?: number;
  balanceDue?: number;
  currency?: string;
  location?: { id: string; name: string };
}

interface Vendor { id: string; name: string; }
interface Location { id: string; name: string; }

const fmtMoney = (n: number, currency = 'EGP') =>
  `${currency} ${n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'badge badge-neutral',
  POSTED:    'badge badge-info',
  PARTIAL:   'badge badge-warning',
  PAID:      'badge badge-success',
  CANCELLED: 'badge badge-danger',
};

const STATUS_LABEL_EN: Record<string, string> = {
  DRAFT: 'Draft', POSTED: 'Posted', PARTIAL: 'Partial', PAID: 'Paid', CANCELLED: 'Cancelled',
};
const STATUS_LABEL_AR: Record<string, string> = {
  DRAFT: 'مسودة', POSTED: 'مرحّل', PARTIAL: 'جزئي', PAID: 'مدفوع', CANCELLED: 'ملغى',
};

export default function VendorBillsPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const STATUS_FILTER_OPTS = [
    { value: '', label: isAr ? 'كل الحالات' : 'All Statuses' },
    { value: 'DRAFT',     label: isAr ? 'مسودة' : 'Draft' },
    { value: 'POSTED',    label: isAr ? 'مرحّل' : 'Posted' },
    { value: 'PARTIAL',   label: isAr ? 'جزئي' : 'Partial' },
    { value: 'PAID',      label: isAr ? 'مدفوع' : 'Paid' },
    { value: 'CANCELLED', label: isAr ? 'ملغى' : 'Cancelled' },
  ];

  const qs = new URLSearchParams({
    limit: '50',
    ...(statusFilter && { status: statusFilter }),
    ...(vendorFilter && { vendorId: vendorFilter }),
    ...(locationFilter && { locationId: locationFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }).toString();

  const { data, loading, error, reload } = useQuery<{ data: VendorBill[]; total: number }>(
    `/finance/invoices?type=VENDOR_BILL&${qs}`,
    [qs],
  );

  const { data: vendorsRaw } = useQuery<{ data: Vendor[] }>('/partners?type=VENDOR&limit=200');
  const { data: locationsRaw } = useQuery<{ items: Location[] }>('/locations?limit=50');

  const bills = data?.data ?? [];
  const vendorOpts = [
    { value: '', label: isAr ? 'كل الموردين' : 'All Vendors' },
    ...(vendorsRaw?.data ?? []).map((v) => ({ value: v.id, label: v.name })),
  ];
  const locationOpts = [
    { value: '', label: isAr ? 'كل الفروع' : 'All Locations' },
    ...(locationsRaw?.items ?? []).map((l) => ({ value: l.id, label: l.name })),
  ];

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === bills.length ? new Set() : new Set(bills.map((b) => b.id)),
    );
  }

  async function bulkPost() {
    const ids = [...selected].filter((id) =>
      bills.find((b) => b.id === id)?.status === 'DRAFT',
    );
    if (!ids.length) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        ids.map((id) => apiFetch(`/finance/invoices/${id}/post`, { method: 'POST' })),
      );
      setSelected(new Set());
      reload();
    } catch {
      // ponytail: surface error via reload; toast TBD
    } finally {
      setBulkLoading(false);
    }
  }

  async function postBill(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await apiFetch(`/finance/invoices/${id}/post`, { method: 'POST' });
      reload();
    } catch { /* ignore — real error handling TBD */ }
  }

  async function cancelBill(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(isAr ? 'إلغاء هذه الفاتورة؟' : 'Cancel this vendor bill?')) return;
    try {
      await apiFetch(`/finance/invoices/${id}/cancel`, { method: 'POST' });
      reload();
    } catch { /* ignore */ }
  }

  const draftSelected = [...selected].some(
    (id) => bills.find((b) => b.id === id)?.status === 'DRAFT',
  );

  const statusLabel = (s: string) => isAr ? (STATUS_LABEL_AR[s] ?? s) : (STATUS_LABEL_EN[s] ?? s);

  return (
    <div className="page-body space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'فواتير الموردين' : 'Vendor Bills'}</h1>
          <p className="page-subtitle">
            {isAr ? 'الذمم الدائنة — فواتير الموردين' : 'Accounts Payable — Supplier Invoices'}
          </p>
        </div>
        <button onClick={() => router.push('/finance/vendor-bills/new')} className="btn btn-primary">
          {isAr ? '+ فاتورة جديدة' : '+ New Bill'}
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-6">
        <div className="card p-3 flex flex-wrap gap-3 items-end">
          <div className="w-40">
            <label className="input-label">{isAr ? 'الحالة' : 'Status'}</label>
            <SearchableCombobox
              options={STATUS_FILTER_OPTS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          <div className="w-52">
            <label className="input-label">{isAr ? 'المورد' : 'Vendor'}</label>
            <SearchableCombobox
              options={vendorOpts}
              value={vendorFilter}
              onChange={setVendorFilter}
            />
          </div>
          <div className="w-44">
            <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
            <SearchableCombobox
              options={locationOpts}
              value={locationFilter}
              onChange={setLocationFilter}
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
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="px-6">
          <div className="rounded-lg bg-[--surface-2] border border-[--border] px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs text-[--text-2]">
              {selected.size} {isAr ? 'محدد' : 'selected'}
            </span>
            <button
              onClick={bulkPost}
              disabled={bulkLoading || !draftSelected}
              className="btn btn-secondary btn-sm"
            >
              {bulkLoading ? (isAr ? 'جاري الترحيل…' : 'Posting…') : (isAr ? 'ترحيل المحدد' : 'Post Selected')}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="btn btn-ghost btn-sm"
            >
              {isAr ? 'إلغاء التحديد' : 'Clear'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="px-6 pb-6">
        <div className="card overflow-hidden">
          {loading && (
            <div className="flex items-center gap-3 p-6 text-[--text-3] text-sm">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {isAr ? 'جاري تحميل الفواتير…' : 'Loading vendor bills…'}
            </div>
          )}
          {error && <p className="p-6 text-danger-fg text-sm">{error}</p>}
          {!loading && (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input
                      type="checkbox"
                      checked={bills.length > 0 && selected.size === bills.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th>{isAr ? 'رقم الفاتورة' : 'Bill #'}</th>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                  <th>{isAr ? 'المورد' : 'Vendor'}</th>
                  <th>{isAr ? 'المرجع' : 'Reference'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="text-right">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="text-right">{isAr ? 'الرصيد المستحق' : 'Balance Due'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => router.push(`/finance/vendor-bills/${b.id}`)}
                    className="cursor-pointer"
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggleRow(b.id)}
                        className="rounded"
                      />
                    </td>
                    <td>
                      <span className="font-mono text-xs text-[--text-2]">
                        {b.number ?? b.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="text-[--text-2] text-xs">{fmtDate(b.date, isAr)}</td>
                    <td className="text-[--text-2] text-xs">
                      {b.dueDate ? fmtDate(b.dueDate, isAr) : '—'}
                    </td>
                    <td className="text-[--text-1]">{b.vendor?.name ?? '—'}</td>
                    <td className="text-[--text-2] text-xs">{b.reference ?? '—'}</td>
                    <td>
                      <span className={STATUS_BADGE[b.status] ?? 'badge badge-neutral'}>
                        {statusLabel(b.status)}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-[--text-1]">
                      {b.totalAmount != null ? fmtMoney(b.totalAmount, b.currency) : '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {b.balanceDue != null && b.balanceDue > 0 ? (
                        <span className="text-danger-fg font-medium">
                          {fmtMoney(b.balanceDue, b.currency)}
                        </span>
                      ) : (
                        <span className="text-[--text-3]">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/finance/vendor-bills/${b.id}`); }}
                          className="btn btn-ghost btn-sm"
                        >
                          {isAr ? 'عرض' : 'View'}
                        </button>
                        {b.status === 'DRAFT' && (
                          <button
                            onClick={(e) => postBill(b.id, e)}
                            className="btn btn-ghost btn-sm text-[--primary]"
                          >
                            {isAr ? 'ترحيل' : 'Post'}
                          </button>
                        )}
                        {(b.status === 'POSTED' || b.status === 'PARTIAL') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/finance/payments/new?billId=${b.id}`); }}
                            className="btn btn-ghost btn-sm"
                          >
                            {isAr ? 'دفع' : 'Pay'}
                          </button>
                        )}
                        {b.status === 'DRAFT' && (
                          <button
                            onClick={(e) => cancelBill(b.id, e)}
                            className="btn btn-ghost btn-sm text-danger-fg"
                          >
                            {isAr ? 'إلغاء' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[--text-3]">
                      {isAr ? 'لا توجد فواتير موردين.' : 'No vendor bills found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {data && (
            <div className="px-4 py-2 border-t border-[--border] bg-[--surface-2] flex justify-between items-center">
              <p className="text-xs text-[--text-3]">
                {data.total} {isAr ? 'فاتورة إجمالاً' : 'total bills'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
