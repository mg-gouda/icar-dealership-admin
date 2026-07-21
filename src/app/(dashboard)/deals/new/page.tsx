'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';

interface User { id: string; name: string; phone?: string; role: string; }
interface Vehicle { id: string; make: string; model: string; year: number; price: number; vin: string; }
interface Location { id: string; name: string; city?: string; defaultAdminFee?: number; defaultInsuranceFee?: number; }

const fmt = (n: number) =>
  n.toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });

function NewDealContent() {
  const { isAr } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get('leadId');

  const METHODS = [
    { value: 'CASH', label: isAr ? 'نقداً' : 'Cash' },
    { value: 'DEALERSHIP_INSTALLMENT', label: isAr ? 'تقسيط المعرض' : 'Dealership Installment' },
    { value: 'BANK_FINANCING', label: isAr ? 'تمويل بنكي' : 'Bank Financing' },
  ];

  const { data: usersRaw } = useQuery<User[]>('/users');
  const { data: vehiclesRes } = useQuery<{ items: Vehicle[] }>('/vehicles?status=AVAILABLE&limit=200');
  const { data: locationsRaw } = useQuery<Location[]>('/locations');
  const { data: lead } = useQuery<any>(leadId ? `/leads/${leadId}` : null);

  const customers = useMemo(() => (usersRaw ?? []).filter((u) => u.role === 'CUSTOMER'), [usersRaw]);
  const salesReps = useMemo(() => (usersRaw ?? []).filter((u) => ['SALES_REP', 'MANAGER'].includes(u.role)), [usersRaw]);
  const vehicles = vehiclesRes?.items ?? [];
  const locations = Array.isArray(locationsRaw) ? locationsRaw : [];

  const [form, setForm] = useState({
    customerId: '', vehicleId: '', salesRepId: '', locationId: '',
    purchaseMethod: 'CASH',
    salePrice: '', adminFee: '', insuranceFee: '',
  });
  const [prefilled, setPrefilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Pre-populate form from lead when data loads
  useEffect(() => {
    if (!lead || prefilled) return;
    const v = lead.vehicle;
    setForm((p) => ({
      ...p,
      customerId: lead.customerId ?? p.customerId,
      vehicleId: lead.vehicleId ?? p.vehicleId,
      salesRepId: lead.assignedToUserId ?? p.salesRepId,
      locationId: lead.locationId ?? p.locationId,
      salePrice: v?.price ? String(v.price) : p.salePrice,
    }));
    // Fill location fees once locations load
    if (lead.locationId && locations.length > 0) {
      const l = locations.find((loc) => loc.id === lead.locationId);
      if (l) {
        setForm((p) => ({
          ...p,
          adminFee: l.defaultAdminFee ? String(l.defaultAdminFee) : p.adminFee,
          insuranceFee: l.defaultInsuranceFee ? String(l.defaultInsuranceFee) : p.insuranceFee,
        }));
      }
      setPrefilled(true);
    }
  }, [lead, locations, prefilled]);

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  // Auto-fill price and fees when vehicle or location changes
  function selectVehicle(vehicleId: string) {
    const v = vehicles.find((v) => v.id === vehicleId);
    set('vehicleId', vehicleId);
    if (v) setForm((p) => ({ ...p, vehicleId, salePrice: String(v.price) }));
  }

  function selectLocation(locationId: string) {
    const l = locations.find((l) => l.id === locationId);
    setForm((p) => ({
      ...p,
      locationId,
      adminFee: l?.defaultAdminFee ? String(l.defaultAdminFee) : p.adminFee,
      insuranceFee: l?.defaultInsuranceFee ? String(l.defaultInsuranceFee) : p.insuranceFee,
    }));
  }

  const subtotal = (Number(form.salePrice) || 0) + (Number(form.adminFee) || 0) + (Number(form.insuranceFee) || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.vehicleId || !form.salesRepId || !form.locationId || !form.salePrice) {
      setErr(isAr ? 'العميل والسيارة والمندوب والفرع والسعر مطلوبة.' : 'Customer, vehicle, sales rep, location, and sale price are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const deal = await apiFetch<{ id: string }>('/deals', {
        method: 'POST',
        body: JSON.stringify({
          customerId: form.customerId,
          vehicleId: form.vehicleId,
          salesRepId: form.salesRepId,
          locationId: form.locationId,
          purchaseMethod: form.purchaseMethod,
          salePrice: Number(form.salePrice),
          adminFee: form.adminFee ? Number(form.adminFee) : undefined,
          insuranceFee: form.insuranceFee ? Number(form.insuranceFee) : undefined,
          ...(leadId && { leadId }),
        }),
      });
      router.push(`/deals/${deal.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const customerOpts = customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }));
  const salesRepOpts = salesReps.map((s) => ({ value: s.id, label: s.name }));
  const vehicleOpts = vehicles.map((v) => ({
    value: v.id,
    label: `${v.year} ${v.make} ${v.model} — ${fmt(v.price)}`,
    description: isAr ? `الشاسيه: ${v.vin}` : `VIN: ${v.vin}`,
  }));
  const locationOpts = locations.map((l) => ({
    value: l.id,
    label: `${l.name}${l.city ? ` — ${l.city}` : ''}`,
  }));

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/deals" className="text-gray-500 hover:text-white text-xs transition">
          {isAr ? 'العودة إلى الصفقات' : '← Deals'}
        </Link>
        <h1 className="text-xl font-semibold text-white">{isAr ? 'صفقة جديدة' : 'New Deal'}</h1>
      </div>

      {leadId && lead && (
        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm flex items-center gap-2">
          <span>{isAr ? 'تم الملء من الاستفسار:' : 'Pre-filled from lead:'}</span>
          <span className="font-medium text-white">{lead.name}</span>
          {lead.vehicle && <span className="text-gray-400">· {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}</span>}
        </div>
      )}
      {err && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* Parties */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{isAr ? 'الأطراف' : 'Parties'}</p>
          <SearchableCombobox
            label={isAr ? 'العميل *' : 'Customer *'}
            options={customerOpts}
            value={form.customerId}
            onChange={(v) => set('customerId', v)}
            placeholder={isAr ? 'بحث عن عميل…' : 'Search customer…'}
          />
          <SearchableCombobox
            label={isAr ? 'مندوب المبيعات *' : 'Sales Representative *'}
            options={salesRepOpts}
            value={form.salesRepId}
            onChange={(v) => set('salesRepId', v)}
            placeholder={isAr ? 'بحث عن مندوب…' : 'Search sales rep…'}
          />
          <SearchableCombobox
            label={isAr ? 'الفرع *' : 'Location *'}
            options={locationOpts}
            value={form.locationId}
            onChange={selectLocation}
            placeholder={isAr ? 'اختر فرعاً…' : 'Select location…'}
          />
        </div>

        {/* Vehicle */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{isAr ? 'السيارة' : 'Vehicle'}</p>
          <SearchableCombobox
            label={isAr ? 'السيارة المتاحة *' : 'Available Vehicle *'}
            options={vehicleOpts}
            value={form.vehicleId}
            onChange={selectVehicle}
            placeholder={isAr ? 'بحث عن مركبة…' : 'Search available vehicles…'}
          />
        </div>

        {/* Financials */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{isAr ? 'التفاصيل المالية' : 'Financials'}</p>
          <SearchableCombobox
            label={isAr ? 'طريقة الشراء' : 'Purchase Method'}
            options={METHODS}
            value={form.purchaseMethod}
            onChange={(v) => set('purchaseMethod', v)}
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{isAr ? 'سعر البيع (ج.م) *' : 'Sale Price (EGP) *'}</label>
              <NumericInput value={form.salePrice}
                onChange={(val) => set('salePrice', val)}
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{isAr ? 'الرسوم الإدارية (ج.م)' : 'Admin Fee (EGP)'}</label>
              <NumericInput value={form.adminFee}
                onChange={(val) => set('adminFee', val)}
                placeholder={isAr ? 'من إعداد الفرع' : 'From location default'}
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{isAr ? 'رسوم التأمين (ج.م)' : 'Insurance Fee (EGP)'}</label>
              <NumericInput value={form.insuranceFee}
                onChange={(val) => set('insuranceFee', val)}
                placeholder={isAr ? 'من إعداد الفرع' : 'From location default'}
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Subtotal preview */}
          {subtotal > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-blue-500/5 border border-blue-500/10 px-4 py-3">
              <span className="text-xs text-gray-400">{isAr ? 'الإجمالي التقديري' : 'Estimated Total'}</span>
              <span className="text-white font-bold">{fmt(subtotal)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/deals"
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            {isAr ? 'إلغاء' : 'Cancel'}
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
            {saving ? (isAr ? 'جاري الإنشاء…' : 'Creating…') : (isAr ? 'إنشاء صفقة' : 'Create Deal')}
          </button>
        </div>
      </form>
    </div>
  );
}

// BUG-001: useSearchParams() requires Suspense boundary in Next.js App Router
export default function NewDealPage() {
  const { isAr } = useLang();
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">{isAr ? 'جاري التحميل…' : 'Loading…'}</div>}>
      <NewDealContent />
    </Suspense>
  );
}
