'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import StatusBadge from '../../../components/StatusBadge';

interface Partner {
  id: string; name: string; type: string; email?: string; phone?: string;
  taxId?: string; address?: string; city?: string;
  balance?: number;
}

const TYPES = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'BANK', label: 'Bank' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'OTHER', label: 'Other' },
];

export default function PartnersPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'CUSTOMER', email: '', phone: '', taxId: '', address: '', city: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const { data: res, loading, reload } = useQuery<Partner[]>(
    `/partners?limit=200${typeFilter ? `&type=${typeFilter}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
    [typeFilter, search],
  );

  const partners = Array.isArray(res) ? res : [];

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setErr('Name required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/partners', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, type: form.type,
          email: form.email || undefined, phone: form.phone || undefined,
          taxId: form.taxId || undefined, address: form.address || undefined,
          city: form.city || undefined,
        }),
      });
      setShowCreate(false);
      setForm({ name: '', type: 'CUSTOMER', email: '', phone: '', taxId: '', address: '', city: '' });
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Partners</h1>
          <p className="text-xs text-gray-500 mt-0.5">{partners.length} total</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition">
          + Partner
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 px-3 py-2 bg-gray-900 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <div className="w-48">
          <SearchableCombobox
            options={[{ value: '', label: 'All types' }, ...TYPES]}
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All types"
          />
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Tax ID</th>
              <th className="px-4 py-3 text-left font-medium">City</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {partners.map((p) => (
              <tr key={p.id} className="hover:bg-white/5 transition">
                <td className="px-4 py-2.5 text-white font-medium">{p.name}</td>
                <td className="px-4 py-2.5"><StatusBadge status={p.type} /></td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{p.email ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{p.phone ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">{p.taxId ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{p.city ?? '—'}</td>
              </tr>
            ))}
            {partners.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No partners found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">New Partner</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <SearchableCombobox label="Type" options={TYPES} value={form.type} onChange={(v) => set('type', v)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tax ID</label>
                  <input value={form.taxId} onChange={(e) => set('taxId', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">City</label>
                  <input value={form.city} onChange={(e) => set('city', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Address</label>
                <input value={form.address} onChange={(e) => set('address', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              {err && <p className="text-red-400 text-xs">{err}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
