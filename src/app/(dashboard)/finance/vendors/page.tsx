'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { ErrorBanner } from '@/components/ui/error-banner';

interface Vendor {
  id: string;
  name: string;
  taxId?: string;
  phone?: string;
  email?: string;
  defaultCurrency: string;
  balance?: number;
}

const CURRENCY_FILTER_OPTS = [
  { value: '', label: 'All Currencies' },
  { value: 'EGP', label: 'EGP' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

const CURRENCY_OPTS = [
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const fmtMoney = (n: number, currency = 'EGP') =>
  `${currency} ${n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EMPTY_FORM = {
  name: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  defaultCurrency: 'EGP',
};

export default function VendorsPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const qs = new URLSearchParams({
    limit: '50',
    ...(search && { search }),
    ...(currencyFilter && { currency: currencyFilter }),
  }).toString();

  const { data, loading, error, reload } = useQuery<{ data: Vendor[]; total: number }>(
    `/partners?type=VENDOR&${qs}`,
    [qs],
  );

  const vendors = data?.data ?? [];

  function openModal() {
    setForm(EMPTY_FORM);
    setSaveErr('');
    setShowModal(true);
  }

  async function saveVendor() {
    if (!form.name.trim()) { setSaveErr(isAr ? 'الاسم مطلوب.' : 'Name is required.'); return; }
    setSaving(true);
    setSaveErr('');
    try {
      await apiFetch('/partners', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          partnerType: 'VENDOR',
          taxId: form.taxId || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          defaultCurrency: form.defaultCurrency,
        }),
      });
      setShowModal(false);
      reload();
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : (isAr ? 'خطأ في حفظ المورد' : 'Error saving vendor'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-body space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'الموردون' : 'Vendors'}</h1>
          <p className="page-subtitle">
            {isAr ? 'الذمم الدائنة — دليل الموردين' : 'Accounts Payable — Supplier Directory'}
          </p>
        </div>
        <button onClick={openModal} className="btn btn-primary">
          {isAr ? '+ مورد جديد' : '+ New Vendor'}
        </button>
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
              placeholder={isAr ? 'بحث بالاسم أو الرقم الضريبي…' : 'Search by name or tax ID…'}
              className="input pl-9"
            />
          </div>
          <div className="w-40">
            <label className="input-label">{isAr ? 'العملة' : 'Currency'}</label>
            <SearchableCombobox
              options={CURRENCY_FILTER_OPTS}
              value={currencyFilter}
              onChange={setCurrencyFilter}
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
              {isAr ? 'جاري تحميل الموردين…' : 'Loading vendors…'}
            </div>
          )}
          {error && <div className="p-4"><ErrorBanner error={error} retry={reload} /></div>}
          {!loading && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'الاسم' : 'Name'}</th>
                  <th>{isAr ? 'الرقم الضريبي' : 'Tax ID'}</th>
                  <th>{isAr ? 'الهاتف' : 'Phone'}</th>
                  <th>{isAr ? 'البريد' : 'Email'}</th>
                  <th>{isAr ? 'العملة' : 'Currency'}</th>
                  <th className="text-right">{isAr ? 'الرصيد المستحق' : 'Balance (AP)'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => router.push(`/finance/vendors/${v.id}`)}
                    className="cursor-pointer"
                  >
                    <td className="font-medium text-[--text-1]">{v.name}</td>
                    <td className="font-mono text-xs text-[--text-2]">{v.taxId ?? '—'}</td>
                    <td className="text-[--text-2] text-xs">{v.phone ?? '—'}</td>
                    <td className="text-[--text-2] text-xs">{v.email ?? '—'}</td>
                    <td>
                      <span className="text-xs font-mono text-[--text-2]">{v.defaultCurrency}</span>
                    </td>
                    <td className="text-right tabular-nums">
                      {v.balance != null && v.balance > 0 ? (
                        <span className="text-danger-fg font-medium text-sm">
                          {fmtMoney(v.balance, v.defaultCurrency)}
                        </span>
                      ) : (
                        <span className="text-[--text-3] text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/finance/vendors/${v.id}`); }}
                        className="btn btn-ghost btn-sm"
                      >
                        {isAr ? 'عرض' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[--text-3]">
                      {isAr ? 'لا يوجد موردون.' : 'No vendors found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {data && (
            <div className="px-4 py-2 border-t border-[--border] bg-[--surface-2] flex justify-between items-center">
              <p className="text-xs text-[--text-3]">
                {data.total} {isAr ? 'مورد إجمالاً' : 'total vendors'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="card w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[--text-1]">
                  {isAr ? 'مورد جديد' : 'New Vendor'}
                </h2>
                <p className="text-xs text-[--text-3] mt-0.5">
                  {isAr ? 'إضافة مورد إلى الذمم الدائنة' : 'Add a supplier to Accounts Payable'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[--text-3] hover:text-[--text-1] transition text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="input-label">{isAr ? 'الاسم *' : 'Name *'}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={isAr ? 'اسم المورد أو الشركة' : 'Vendor or company name'}
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">{isAr ? 'الرقم الضريبي' : 'Tax ID'}</label>
                <input
                  type="text"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  placeholder="e.g. 123-456-789"
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">{isAr ? 'الهاتف' : 'Phone'}</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+20 1xx xxxx xxxx"
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="vendor@example.com"
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">{isAr ? 'العملة الافتراضية' : 'Default Currency'}</label>
                <SearchableCombobox
                  options={CURRENCY_OPTS}
                  value={form.defaultCurrency}
                  onChange={(v) => setForm({ ...form, defaultCurrency: v })}
                />
              </div>
              <div className="col-span-2">
                <label className="input-label">{isAr ? 'العنوان' : 'Address'}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder={isAr ? 'الشارع، المدينة، مصر' : 'Street, City, Egypt'}
                  className="input"
                />
              </div>
            </div>

            {saveErr && (
              <div className="rounded-lg bg-danger-bg border border-danger px-4 py-3">
                <p className="text-xs text-danger-fg">{saveErr}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveVendor}
                disabled={saving}
                className="btn btn-primary flex-1"
              >
                {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ المورد' : 'Save Vendor')}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-ghost"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
