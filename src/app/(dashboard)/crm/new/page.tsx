'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface User { id: string; name: string; role: string; }
interface Location { id: string; name: string; city?: string; }
interface Vehicle { id: string; make: string; model: string; year: number; price: number; }

const SOURCES = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'MARKETPLACE', label: 'Marketplace' },
  { value: 'OTHER', label: 'Other' },
];

export default function NewLeadPage() {
  const router = useRouter();
  const { data: usersRaw } = useQuery<User[]>('/users');
  const { data: locationsRaw } = useQuery<Location[]>('/locations');
  const { data: vehiclesRes } = useQuery<{ data: Vehicle[] }>('/vehicles?status=AVAILABLE&limit=200');

  const salesReps = (usersRaw ?? []).filter((u) => ['SALES_REP', 'MANAGER', 'ADMIN'].includes(u.role));
  const locations = Array.isArray(locationsRaw) ? locationsRaw : [];
  const vehicles = vehiclesRes?.data ?? [];

  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    source: 'WALK_IN',
    locationId: '',
    vehicleId: '',
    assignedToUserId: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.locationId) { setErr('Name and location are required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const lead = await apiFetch<{ id: string }>('/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          source: form.source,
          locationId: form.locationId,
          vehicleId: form.vehicleId || undefined,
          assignedToUserId: form.assignedToUserId || undefined,
          notes: form.notes || undefined,
        }),
      });
      router.push(`/crm/${lead.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const repOpts = salesReps.map((u) => ({ value: u.id, label: u.name }));
  const locationOpts = locations.map((l) => ({
    value: l.id,
    label: `${l.name}${l.city ? ` — ${l.city}` : ''}`,
  }));
  const vehicleOpts = [
    { value: '', label: 'No specific vehicle' },
    ...vehicles.map((v) => ({ value: v.id, label: `${v.year} ${v.make} ${v.model}` })),
  ];

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/crm" className="text-gray-500 hover:text-white text-xs transition">← CRM</Link>
        <h1 className="text-xl font-semibold text-white">New Lead</h1>
      </div>

      {err && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* Contact */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                placeholder="01X XXXX XXXX"
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>

        {/* Lead details */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lead Details</p>
          <SearchableCombobox label="Source" options={SOURCES} value={form.source} onChange={(v) => set('source', v)} />
          <SearchableCombobox label="Location *" options={locationOpts} value={form.locationId}
            onChange={(v) => set('locationId', v)} placeholder="Select location…" />
          <SearchableCombobox label="Vehicle Interest" options={vehicleOpts}
            value={form.vehicleId} onChange={(v) => set('vehicleId', v)} clearable />
          <SearchableCombobox label="Assign To" options={repOpts}
            value={form.assignedToUserId} onChange={(v) => set('assignedToUserId', v)}
            placeholder="Unassigned" clearable />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={3} placeholder="Initial notes…"
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/crm"
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
            {saving ? 'Creating…' : 'Create Lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
