'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

interface Location {
  id: string; name: string; city?: string; phone?: string; address?: string;
  defaultAdminFee?: number; defaultInsuranceFee?: number; isActive: boolean;
  _count?: { users: number; vehicles: number };
}

interface User {
  id: string; name: string; email: string; phone?: string; role: string;
  location?: { name: string };
}

const ROLES = [
  { value: 'SALES_REP', label: 'Sales Rep' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMIN', label: 'Admin' },
];

const TABS = ['Locations', 'Users', 'System'] as const;
type Tab = typeof TABS[number];

// ── Create User Dialog ────────────────────────────────────────────────────────
function CreateUserDialog({
  locations,
  onClose,
  onSuccess,
}: { locations: Location[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'SALES_REP', locationId: '', phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const locationOpts = locations.map((l) => ({
    value: l.id,
    label: `${l.name}${l.city ? ` — ${l.city}` : ''}`,
  }));

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setErr('Name, email, password required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, email: form.email, password: form.password,
          role: form.role, phone: form.phone || undefined,
          locationId: form.locationId || undefined,
        }),
      });
      onSuccess();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Create User</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div><label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Password *</label>
            <input required type="password" value={form.password} onChange={(e) => set('password', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
          <SearchableCombobox label="Role" options={ROLES} value={form.role} onChange={(v) => set('role', v)} />
          <SearchableCombobox label="Location" options={locationOpts} value={form.locationId}
            onChange={(v) => set('locationId', v)} placeholder="No location" clearable />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
              {saving ? '…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('Locations');
  const [showCreateUser, setShowCreateUser] = useState(false);

  const { data: locationsRaw, loading: locLoading, reload: reloadLocations } = useQuery<Location[]>('/locations');
  const { data: usersRaw, loading: usrLoading, reload: reloadUsers } = useQuery<User[]>('/users');

  const locations = Array.isArray(locationsRaw) ? locationsRaw : [];
  const users = Array.isArray(usersRaw) ? usersRaw : [];

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
      <p className="text-xs text-gray-500 mb-6">Company & system configuration</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs rounded-lg transition ${tab === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Locations */}
      {tab === 'Locations' && (
        <section>
          {locLoading && <p className="text-gray-500 text-sm">Loading…</p>}
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.id} className="rounded-xl border border-white/5 bg-gray-900 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium">{loc.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[loc.address, loc.city].filter(Boolean).join(', ')} · {loc.phone ?? 'no phone'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{loc._count?.users ?? 0} users</span>
                    <span>{loc._count?.vehicles ?? 0} vehicles</span>
                    <span className={loc.isActive ? 'text-green-400' : 'text-red-400'}>
                      {loc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-white/5 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Default Admin Fee</p>
                    <p className="text-white">{loc.defaultAdminFee ? `${Number(loc.defaultAdminFee).toLocaleString()} EGP` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Default Insurance Fee</p>
                    <p className="text-white">{loc.defaultInsuranceFee ? `${Number(loc.defaultInsuranceFee).toLocaleString()} EGP` : '—'}</p>
                  </div>
                </div>
              </div>
            ))}
            {locations.length === 0 && !locLoading && (
              <p className="text-gray-600 text-sm">No locations configured.</p>
            )}
          </div>
        </section>
      )}

      {/* Users */}
      {tab === 'Users' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">{users.length} users</p>
            <button onClick={() => setShowCreateUser(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition">
              + Add User
            </button>
          </div>
          {usrLoading && <p className="text-gray-500 text-sm">Loading…</p>}
          <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 text-white font-medium">
                      {u.name}
                      {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{u.email}</td>
                    <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.location?.name ?? '—'}</td>
                  </tr>
                ))}
                {users.length === 0 && !usrLoading && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600 text-sm">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* System */}
      {tab === 'System' && (
        <section>
          <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-3">
            {[
              ['API Endpoint', process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1'],
              ['Currency', 'EGP (Egyptian Pound)'],
              ['VAT Rate', '14% (Egypt standard)'],
              ['Version', '1.0.0'],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm py-2 border-b border-white/5 last:border-0">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-300 font-mono text-xs">{val}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {showCreateUser && (
        <CreateUserDialog
          locations={locations}
          onClose={() => setShowCreateUser(false)}
          onSuccess={() => { setShowCreateUser(false); reloadUsers(); }}
        />
      )}
    </div>
  );
}
