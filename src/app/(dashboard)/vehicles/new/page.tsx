'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import Link from 'next/link';

interface Location { id: string; name: string; city?: string; }

const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG'].map((v) => ({ value: v, label: v }));
const TRANSMISSIONS = ['Manual', 'Automatic', 'CVT'].map((v) => ({ value: v, label: v }));
const BODY_TYPES = ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Coupe', 'Wagon', 'Convertible'].map((v) => ({ value: v, label: v }));
const STATUSES = [
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'PENDING_INSPECTION', label: 'Pending Inspection' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
];
const YEARS = Array.from({ length: 20 }, (_, i) => {
  const y = new Date().getFullYear() + 1 - i;
  return { value: String(y), label: String(y) };
});

export default function NewVehiclePage() {
  const router = useRouter();
  const { data: locations } = useQuery<Location[]>('/locations');

  const [form, setForm] = useState({
    vin: '', make: '', model: '', trim: '',
    year: String(new Date().getFullYear()),
    price: '', cost: '',
    locationId: '', status: 'AVAILABLE',
    bodyType: '', fuelType: '', transmission: '',
    color: '', mileage: '', seats: '', doors: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const locationOpts = (Array.isArray(locations) ? locations : []).map((l) => ({
    value: l.id,
    label: `${l.name}${l.city ? ` — ${l.city}` : ''}`,
  }));

  function set(k: string, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vin || !form.make || !form.model || !form.price || !form.locationId) {
      setErr('VIN, make, model, price, and location are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const body: any = {
        vin: form.vin,
        make: form.make,
        model: form.model,
        year: Number(form.year),
        price: Number(form.price),
        locationId: form.locationId,
        status: form.status,
        ...(form.trim && { trim: form.trim }),
        ...(form.cost && { cost: Number(form.cost) }),
        ...(form.bodyType && { bodyType: form.bodyType }),
        ...(form.fuelType && { fuelType: form.fuelType }),
        ...(form.transmission && { transmission: form.transmission }),
        ...(form.color && { color: form.color }),
        ...(form.mileage && { mileage: Number(form.mileage) }),
        ...(form.seats && { seats: Number(form.seats) }),
        ...(form.doors && { doors: Number(form.doors) }),
        ...(form.description && { description: form.description }),
      };
      const v = await apiFetch<{ id: string }>('/vehicles', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      router.push(`/vehicles/${v.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: string, type = 'text', required = false) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}{required ? ' *' : ''}</label>
      <input
        type={type} required={required}
        value={(form as any)[key]}
        onChange={(e) => set(key, e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/vehicles" className="text-gray-500 hover:text-white text-xs transition">← Vehicles</Link>
        <h1 className="text-xl font-semibold text-white">Add Vehicle</h1>
      </div>

      {err && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* Identity */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Identity</p>
          <div className="grid grid-cols-2 gap-3">
            {field('VIN *', 'vin', 'text', true)}
            {field('Make *', 'make', 'text', true)}
            {field('Model *', 'model', 'text', true)}
            {field('Trim', 'trim')}
            <SearchableCombobox label="Year" options={YEARS} value={form.year} onChange={(v) => set('year', v)} />
            <SearchableCombobox label="Status" options={STATUSES} value={form.status} onChange={(v) => set('status', v)} />
          </div>
          <SearchableCombobox
            label="Location *"
            options={locationOpts}
            value={form.locationId}
            onChange={(v) => set('locationId', v)}
            placeholder="Select location…"
          />
        </div>

        {/* Specs */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Specifications</p>
          <div className="grid grid-cols-2 gap-3">
            <SearchableCombobox label="Body Type" options={BODY_TYPES} value={form.bodyType} onChange={(v) => set('bodyType', v)} clearable />
            <SearchableCombobox label="Fuel Type" options={FUEL_TYPES} value={form.fuelType} onChange={(v) => set('fuelType', v)} clearable />
            <SearchableCombobox label="Transmission" options={TRANSMISSIONS} value={form.transmission} onChange={(v) => set('transmission', v)} clearable />
            {field('Color', 'color')}
            {field('Mileage (km)', 'mileage', 'number')}
            {field('Seats', 'seats', 'number')}
            {field('Doors', 'doors', 'number')}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pricing</p>
          <div className="grid grid-cols-2 gap-3">
            {field('Price (EGP) *', 'price', 'number', true)}
            {field('Cost (EGP)', 'cost', 'number')}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/vehicles"
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
            {saving ? 'Creating…' : 'Create Vehicle'}
          </button>
        </div>
      </form>
    </div>
  );
}
