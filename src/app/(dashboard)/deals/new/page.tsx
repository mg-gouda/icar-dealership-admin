'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface User { id: string; name: string; phone?: string; role: string; }
interface Vehicle { id: string; make: string; model: string; year: number; price: number; vin: string; }
interface Location { id: string; name: string; city?: string; defaultAdminFee?: number; defaultInsuranceFee?: number; }

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'DEALERSHIP_INSTALLMENT', label: 'Dealership Installment' },
  { value: 'BANK_FINANCING', label: 'Bank Financing' },
];

const fmt = (n: number) =>
  n.toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });

export default function NewDealPage() {
  const router = useRouter();

  const { data: usersRaw } = useQuery<User[]>('/users');
  const { data: vehiclesRes } = useQuery<{ data: Vehicle[] }>('/vehicles?status=AVAILABLE&limit=200');
  const { data: locationsRaw } = useQuery<Location[]>('/locations');

  const customers = useMemo(() => (usersRaw ?? []).filter((u) => u.role === 'CUSTOMER'), [usersRaw]);
  const salesReps = useMemo(() => (usersRaw ?? []).filter((u) => ['SALES_REP', 'MANAGER'].includes(u.role)), [usersRaw]);
  const vehicles = vehiclesRes?.data ?? [];
  const locations = Array.isArray(locationsRaw) ? locationsRaw : [];

  const [form, setForm] = useState({
    customerId: '', vehicleId: '', salesRepId: '', locationId: '',
    purchaseMethod: 'CASH',
    salePrice: '', adminFee: '', insuranceFee: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

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
      setErr('Customer, vehicle, sales rep, location, and sale price are required.');
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
        }),
      });
      router.push(`/deals/${deal.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const customerOpts = customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }));
  const salesRepOpts = salesReps.map((s) => ({ value: s.id, label: s.name }));
  const vehicleOpts = vehicles.map((v) => ({
    value: v.id,
    label: `${v.year} ${v.make} ${v.model} — ${fmt(v.price)}`,
    description: `VIN: ${v.vin}`,
  }));
  const locationOpts = locations.map((l) => ({
    value: l.id,
    label: `${l.name}${l.city ? ` — ${l.city}` : ''}`,
  }));

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/deals" className="text-gray-500 hover:text-white text-xs transition">← Deals</Link>
        <h1 className="text-xl font-semibold text-white">New Deal</h1>
      </div>

      {err && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* Parties */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Parties</p>
          <SearchableCombobox
            label="Customer *"
            options={customerOpts}
            value={form.customerId}
            onChange={(v) => set('customerId', v)}
            placeholder="Search customer…"
          />
          <SearchableCombobox
            label="Sales Representative *"
            options={salesRepOpts}
            value={form.salesRepId}
            onChange={(v) => set('salesRepId', v)}
            placeholder="Search sales rep…"
          />
          <SearchableCombobox
            label="Location *"
            options={locationOpts}
            value={form.locationId}
            onChange={selectLocation}
            placeholder="Select location…"
          />
        </div>

        {/* Vehicle */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle</p>
          <SearchableCombobox
            label="Available Vehicle *"
            options={vehicleOpts}
            value={form.vehicleId}
            onChange={selectVehicle}
            placeholder="Search available vehicles…"
          />
        </div>

        {/* Financials */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Financials</p>
          <SearchableCombobox
            label="Purchase Method"
            options={METHODS}
            value={form.purchaseMethod}
            onChange={(v) => set('purchaseMethod', v)}
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sale Price (EGP) *</label>
              <input type="number" required value={form.salePrice}
                onChange={(e) => set('salePrice', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Admin Fee (EGP)</label>
              <input type="number" value={form.adminFee}
                onChange={(e) => set('adminFee', e.target.value)}
                placeholder="From location default"
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Insurance Fee (EGP)</label>
              <input type="number" value={form.insuranceFee}
                onChange={(e) => set('insuranceFee', e.target.value)}
                placeholder="From location default"
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Subtotal preview */}
          {subtotal > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-blue-500/5 border border-blue-500/10 px-4 py-3">
              <span className="text-xs text-gray-400">Estimated Total</span>
              <span className="text-white font-bold">{fmt(subtotal)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/deals"
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
            {saving ? 'Creating…' : 'Create Deal'}
          </button>
        </div>
      </form>
    </div>
  );
}
