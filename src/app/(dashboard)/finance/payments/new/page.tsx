'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, useQuery } from '../../../../../lib/useApi';
import SearchableCombobox from '../../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';

interface Partner { id: string; name: string; }

const PAYMENT_METHODS = [
  { value: 'TRANSFER', label: 'Bank Transfer' },
  { value: 'CASH',     label: 'Cash' },
  { value: 'CHEQUE',   label: 'Cheque' },
  { value: 'CARD',     label: 'Card' },
];

const PAYMENT_METHODS_AR = [
  { value: 'TRANSFER', label: 'تحويل بنكي' },
  { value: 'CASH',     label: 'نقداً' },
  { value: 'CHEQUE',   label: 'شيك' },
  { value: 'CARD',     label: 'بطاقة' },
];

export default function NewPaymentPage() {
  const router = useRouter();
  const { isAr } = useLang();
  const searchParams = useSearchParams();

  // ponytail: billId from query param pre-sets outbound context
  const billId = searchParams.get('billId');

  const [form, setForm] = useState({
    type: billId ? 'OUTBOUND' : 'INBOUND',
    partnerId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'TRANSFER',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // load partners based on type
  const partnerType = form.type === 'INBOUND' ? 'CUSTOMER' : 'VENDOR';
  const { data: partnersRaw } = useQuery<Partner[]>(
    `/partners?limit=200&type=${partnerType}`,
    [partnerType],
  );
  const partners = Array.isArray(partnersRaw) ? partnersRaw : [];
  const partnerOpts = partners.map((p) => ({ value: p.id, label: p.name }));

  const typeOpts = [
    { value: 'INBOUND',  label: isAr ? 'وارد (من عميل)' : 'Inbound (from customer)' },
    { value: 'OUTBOUND', label: isAr ? 'صادر (لمورد)' : 'Outbound (to vendor)' },
  ];

  const methodOpts = isAr ? PAYMENT_METHODS_AR : PAYMENT_METHODS;

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({
      ...f,
      [k]: v,
      // reset partner when type changes
      ...(k === 'type' ? { partnerId: '' } : {}),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partnerId || !form.amount) {
      setErr(isAr ? 'الشريك والمبلغ مطلوبان.' : 'Partner and amount are required.');
      return;
    }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          type: form.type,
          partnerId: form.partnerId,
          amount: Number(form.amount),
          date: form.date,
          method: form.method,
          memo: form.description || undefined,
          ...(billId ? { allocations: [{ invoiceId: billId, amount: Number(form.amount) }] } : {}),
        }),
      });
      router.push('/finance/payments');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : (isAr ? 'خطأ في الحفظ' : 'Error saving payment'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-body max-w-lg mx-auto py-8">
      <div className="mb-5">
        <button
          onClick={() => router.push('/finance/payments')}
          className="text-xs text-[--text-3] hover:text-[--text-1] mb-1"
        >
          ← {isAr ? 'المدفوعات' : 'Payments'}
        </button>
        <h1 className="page-title">{isAr ? 'دفعة جديدة' : 'New Payment'}</h1>
      </div>

      <div className="card p-5">
        <form onSubmit={submit} className="space-y-4">
          {err && (
            <p className="text-xs text-danger-fg bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {err}
            </p>
          )}

          <SearchableCombobox
            label={isAr ? 'النوع *' : 'Type *'}
            options={typeOpts}
            value={form.type}
            onChange={(v) => set('type', v)}
            placeholder={isAr ? 'اختر النوع' : 'Select type'}
          />

          <SearchableCombobox
            label={isAr ? (form.type === 'INBOUND' ? 'العميل *' : 'المورد *') : (form.type === 'INBOUND' ? 'Customer *' : 'Vendor *')}
            options={partnerOpts}
            value={form.partnerId}
            onChange={(v) => set('partnerId', v)}
            placeholder={isAr ? 'اختر…' : 'Search…'}
          />

          <div>
            <label className="form-label">{isAr ? 'المبلغ *' : 'Amount *'}</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[--text-3] font-mono">EGP</span>
              <NumericInput
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(val) => set('amount', val)}
                placeholder="0.00"
                className="form-input flex-1 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="form-label">{isAr ? 'التاريخ *' : 'Date *'}</label>
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className="form-input"
            />
          </div>

          <SearchableCombobox
            label={isAr ? 'طريقة الدفع' : 'Payment Method'}
            options={methodOpts}
            value={form.method}
            onChange={(v) => set('method', v)}
            placeholder={isAr ? 'اختر…' : 'Select…'}
          />

          <div>
            <label className="form-label">{isAr ? 'البيان' : 'Description'}</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={isAr ? 'ملاحظات اختيارية…' : 'Optional notes…'}
              className="form-input resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/finance/payments')}
              className="btn btn-secondary flex-1"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? '…' : (isAr ? 'حفظ الدفعة' : 'Save Payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
