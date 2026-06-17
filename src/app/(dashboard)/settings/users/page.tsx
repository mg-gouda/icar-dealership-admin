'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface User {
  id: string; name: string; email: string; phone?: string;
  role: string; createdAt: string;
  location?: { id: string; name: string };
}
interface Location { id: string; name: string; }

const ROLE_OPTS = [
  { value: 'SALES_REP', label: 'Sales Rep' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

const ROLE_FILTER_OPTS = [{ value: '', label: 'All roles' }, ...ROLE_OPTS];

export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const qs = roleFilter ? `?role=${roleFilter}&limit=50` : '?limit=50';
  const { data: res, loading, reload } = useQuery<{ items?: User[]; data?: User[] } | User[]>(`/users${qs}`);
  const { data: locations } = useQuery<Location[]>('/locations');

  const users: User[] = Array.isArray(res) ? res
    : (res as any)?.items ?? (res as any)?.data ?? [];

  const locationOpts = (Array.isArray(locations) ? locations : [])
    .map((l) => ({ value: l.id, label: l.name }));

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SALES_REP', locationId: '', phone: '' });
  const [editForm, setEditForm] = useState({ name: '', role: '', locationId: '', phone: '' });

  function openCreate() { setForm({ name: '', email: '', password: '', role: 'SALES_REP', locationId: locationOpts[0]?.value ?? '', phone: '' }); setShowCreate(true); }
  function openEdit(u: User) { setEditForm({ name: u.name, role: u.role, locationId: u.location?.id ?? '', phone: u.phone ?? '' }); setShowEdit(u); }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(form) });
      setShowCreate(false); reload();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function updateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!showEdit) return;
    setSaving(true);
    try {
      await apiFetch(`/users/${showEdit.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setShowEdit(null); reload();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Staff Users</h1>
          <p className="text-xs text-gray-500 mt-0.5">{users.length} users</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition">
          + New User
        </button>
      </div>

      <div className="mb-4 w-44">
        <SearchableCombobox options={ROLE_FILTER_OPTS} value={roleFilter} onChange={setRoleFilter} placeholder="Filter by role" />
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Location</th>
              <th className="px-4 py-3 text-left font-medium">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.filter((u) => u.role !== 'CUSTOMER').map((u) => (
              <tr key={u.id} className="hover:bg-white/5 transition">
                <td className="px-4 py-2.5 text-white font-medium">{u.name}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{u.email}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{u.phone ?? '—'}</td>
                <td className="px-4 py-2.5"><StatusBadge status={u.role} /></td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{u.location?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('en-EG')}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => openEdit(u)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition">Edit</button>
                </td>
              </tr>
            ))}
            {users.filter((u) => u.role !== 'CUSTOMER').length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">No staff users.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Create Staff User</h2>
            <form onSubmit={createUser} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Password *</label>
                <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <SearchableCombobox label="Role *" options={ROLE_OPTS} value={form.role} onChange={(v) => setForm({ ...form, role: v })} placeholder="Select role" />
              <SearchableCombobox label="Location *" options={locationOpts} value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v })} placeholder="Select location" />
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

      {/* Edit dialog */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEdit(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Edit {showEdit.name}</h2>
            <p className="text-xs text-gray-500 mb-4">{showEdit.email}</p>
            <form onSubmit={updateUser} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <SearchableCombobox label="Role" options={ROLE_OPTS} value={editForm.role} onChange={(v) => setEditForm({ ...editForm, role: v })} placeholder="Select role" />
              <SearchableCombobox label="Location" options={locationOpts} value={editForm.locationId} onChange={(v) => setEditForm({ ...editForm, locationId: v })} placeholder="Select location" />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowEdit(null)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
