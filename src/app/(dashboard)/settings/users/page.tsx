'use client';

import { useState, useMemo } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  location?: { id: string; name: string };
}

interface Location { id: string; name: string; }

const ROLE_OPTS = [
  { value: 'SALES_REP',   label: 'Sales Rep'   },
  { value: 'MANAGER',     label: 'Manager'      },
  { value: 'FINANCE',     label: 'Finance'      },
  { value: 'ADMIN',       label: 'Admin'        },
  { value: 'SUPER_ADMIN', label: 'Super Admin'  },
];

const ROLE_FILTER_OPTS = [{ value: '', label: 'All Roles' }, ...ROLE_OPTS];
const STATUS_OPTS = [
  { value: '',     label: 'All Status' },
  { value: 'true', label: 'Active'     },
  { value: 'false',label: 'Inactive'   },
];

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'badge badge-danger',
  ADMIN:       'badge badge-orange',
  FINANCE:     'badge badge-purple',
  MANAGER:     'badge badge-warning',
  SALES_REP:   'badge badge-info',
  CUSTOMER:    'badge badge-neutral',
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  FINANCE:     'Finance',
  MANAGER:     'Manager',
  SALES_REP:   'Sales Rep',
  CUSTOMER:    'Customer',
};

// Module → permission list for Roles & Permissions tab
const PERMISSION_MATRIX = [
  {
    module: 'Inventory',
    permissions: [
      { key: 'vehicle:view',        label: 'View Vehicles'        },
      { key: 'vehicle:create',      label: 'Add Vehicles'         },
      { key: 'vehicle:edit',        label: 'Edit Vehicles'        },
      { key: 'vehicle:delete',      label: 'Delete Vehicles'      },
      { key: 'vehicle:view-cost',   label: 'View Vehicle Cost'    },
    ],
  },
  {
    module: 'Deals',
    permissions: [
      { key: 'deal:view',           label: 'View Deals'           },
      { key: 'deal:create',         label: 'Create Deals'         },
      { key: 'deal:finalize',       label: 'Finalize Deals'       },
      { key: 'deal:view-all-loc',   label: 'View All Locations'   },
    ],
  },
  {
    module: 'CRM',
    permissions: [
      { key: 'crm:view',            label: 'View Leads'           },
      { key: 'crm:create',          label: 'Create Leads'         },
      { key: 'crm:assign',          label: 'Assign Leads'         },
    ],
  },
  {
    module: 'Finance',
    permissions: [
      { key: 'finance:view',        label: 'View Finance'         },
      { key: 'finance:post',        label: 'Post GL Entries'      },
      { key: 'finance:lock-period', label: 'Lock Fiscal Period'   },
      { key: 'finance:view-invoice','label': 'View Invoice Status'},
    ],
  },
  {
    module: 'Settings',
    permissions: [
      { key: 'settings:view',       label: 'View Settings'        },
      { key: 'settings:edit',       label: 'Edit Settings'        },
      { key: 'users:manage',        label: 'Manage Users'         },
    ],
  },
];

// Which roles have which permissions by default
const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  SUPER_ADMIN: new Set(PERMISSION_MATRIX.flatMap((m) => m.permissions.map((p) => p.key))),
  ADMIN:       new Set(PERMISSION_MATRIX.flatMap((m) => m.permissions.map((p) => p.key))),
  FINANCE:     new Set(['vehicle:view','deal:view','deal:view-all-loc','crm:view','finance:view','finance:post','finance:view-invoice','settings:view']),
  MANAGER:     new Set(['vehicle:view','vehicle:create','vehicle:edit','vehicle:view-cost','deal:view','deal:create','deal:finalize','deal:view-all-loc','crm:view','crm:create','crm:assign','finance:view','settings:view']),
  SALES_REP:   new Set(['vehicle:view','deal:view','deal:create','crm:view','crm:create']),
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
}

function timeAgo(iso?: string) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const AVATAR_COLORS = [
  'background:oklch(0.52 0.22 265);color:#fff',
  'background:oklch(0.54 0.2 295);color:#fff',
  'background:oklch(0.52 0.17 145);color:#fff',
  'background:oklch(0.65 0.19 52);color:#fff',
  'background:oklch(0.68 0.16 72);color:#fff',
  'background:oklch(0.51 0.21 25);color:#fff',
];

function avatarStyle(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ── Invite / Edit Modal ───────────────────────────────────────────────────────
function UserModal({
  user,
  locationOpts,
  onClose,
  onSuccess,
}: {
  user: User | null;
  locationOpts: { value: string; label: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const editing = !!user;
  const [form, setForm] = useState({
    name:       user?.name       ?? '',
    email:      user?.email      ?? '',
    phone:      user?.phone      ?? '',
    role:       user?.role       ?? 'SALES_REP',
    locationId: user?.location?.id ?? '',
    password:   '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  const needs2fa = ['FINANCE', 'ADMIN', 'SUPER_ADMIN'].includes(form.role);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      if (editing) {
        await apiFetch(`/users/${user!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            phone: form.phone || undefined,
            role: form.role,
            locationId: form.locationId || undefined,
          }),
        });
      } else {
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            name:       form.name,
            email:      form.email,
            password:   form.password,
            phone:      form.phone || undefined,
            role:       form.role,
            locationId: form.locationId || undefined,
          }),
        });
      }
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '0.9375rem' }}>
              {editing ? `Edit ${user!.name}` : 'Invite New User'}
            </h2>
            {editing && <p className="page-subtitle">{user!.email}</p>}
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="input-label">Full Name *</label>
            <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          {!editing && (
            <>
              <div>
                <label className="input-label">Email *</label>
                <input required type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Password *</label>
                <input required type="password" minLength={8} className="input" value={form.password} onChange={(e) => set('password', e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="input-label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <SearchableCombobox
            label="Role *"
            options={ROLE_OPTS}
            value={form.role}
            onChange={(v) => set('role', v)}
            placeholder="Select role"
          />
          <SearchableCombobox
            label="Location *"
            options={locationOpts}
            value={form.locationId}
            onChange={(v) => set('locationId', v)}
            placeholder="Select location"
            clearable
            clearLabel="No location"
          />
          {needs2fa && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--info-bg)', border: '1px solid var(--info-bg)' }}>
              <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--info-fg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span style={{ fontSize: '0.75rem', color: 'var(--info-fg)' }}>
                2FA required for {ROLE_LABEL[form.role]} role —
                {editing && user?.role === form.role ? ' user must enrol via Settings' : ' will be prompted on first login'}
              </span>
            </div>
          )}
          {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? '…' : editing ? 'Save Changes' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Roles & Permissions Tab ───────────────────────────────────────────────────
function RolesPermissionsTab() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
        Default permission matrix by role. Individual overrides can be set per user via the Staff Accounts tab.
      </p>
      {PERMISSION_MATRIX.map((module) => (
        <div key={module.module} className="card overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <span className="section-label" style={{ marginBottom: 0 }}>{module.module}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Permission</th>
                {ROLE_OPTS.map((r) => (
                  <th key={r.value} style={{ textAlign: 'center' }}>
                    <span className={ROLE_BADGE[r.value] ?? 'badge badge-neutral'}>{r.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {module.permissions.map((perm) => (
                <tr key={perm.key}>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{perm.label}</td>
                  {ROLE_OPTS.map((r) => {
                    const granted = ROLE_PERMISSIONS[r.value]?.has(perm.key) ?? false;
                    return (
                      <td key={r.value} style={{ textAlign: 'center' }}>
                        {granted ? (
                          <svg className="inline w-4 h-4" style={{ color: 'var(--success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="inline w-4 h-4" style={{ color: 'var(--border-strong)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [activeTab,    setActiveTab]    = useState<'users' | 'roles'>('users');
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [locFilter,    setLocFilter]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalUser,    setModalUser]    = useState<User | null | 'new'>(null);
  const [toggling,     setToggling]     = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (roleFilter)   qs.set('role',       roleFilter);
  if (statusFilter) qs.set('isActive',   statusFilter);
  qs.set('limit', '200');

  const { data: res,       loading,   reload   } = useQuery<{ items?: User[]; data?: User[] } | User[]>(`/users?${qs}`);
  const { data: locationsRaw }                   = useQuery<Location[]>('/locations');

  const allUsers: User[] = Array.isArray(res) ? res : (res as any)?.items ?? (res as any)?.data ?? [];

  // Client-side search + location filter (API filters role/status)
  const users = useMemo(() => {
    let list = allUsers.filter((u) => u.role !== 'CUSTOMER');
    if (search)    list = list.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
    if (locFilter) list = list.filter((u) => u.location?.id === locFilter);
    return list;
  }, [allUsers, search, locFilter]);

  const locations = Array.isArray(locationsRaw) ? locationsRaw : [];
  const locationOpts = locations.map((l) => ({ value: l.id, label: l.name }));
  const locFilterOpts = [{ value: '', label: 'All Locations' }, ...locationOpts];

  async function deactivate(u: User) {
    setToggling(u.id);
    const endpoint = u.isActive === false ? 'activate' : 'deactivate';
    try {
      await apiFetch(`/users/${u.id}/${endpoint}`, { method: 'PATCH' });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setToggling(null); }
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Users &amp; Permissions</h1>
          <p className="page-subtitle">Manage accounts, roles, working hours &amp; permissions</p>
        </div>
        {activeTab === 'users' && (
          <button className="btn btn-primary" onClick={() => setModalUser('new')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite User
          </button>
        )}
      </div>

      <div className="page-body space-y-4">
        {/* Tab strip */}
        <div className="tabs">
          <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            Staff Accounts
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
              {users.length}
            </span>
          </button>
          <button className={`tab ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
            Roles &amp; Permissions
          </button>
        </div>

        {activeTab === 'users' && (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-end gap-3">
              <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
                <svg className="w-4 h-4" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  className="input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ width: 160 }}>
                <SearchableCombobox options={ROLE_FILTER_OPTS} value={roleFilter} onChange={setRoleFilter} placeholder="All Roles" clearable clearLabel="All Roles" />
              </div>
              <div style={{ width: 160 }}>
                <SearchableCombobox options={locFilterOpts} value={locFilter} onChange={setLocFilter} placeholder="All Locations" clearable clearLabel="All Locations" />
              </div>
              <div style={{ width: 140 }}>
                <SearchableCombobox options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} placeholder="All Status" clearable clearLabel="All Status" />
              </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
              {loading && !allUsers.length ? (
                <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-3)' }}>Loading…</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Role</th>
                      <th>Branch</th>
                      <th>Last Login</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ opacity: u.isActive === false ? 0.65 : 1 }}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="avatar"
                              style={{
                                width: 34, height: 34, fontSize: '0.75rem',
                                ...Object.fromEntries(avatarStyle(u.name).split(';').filter(Boolean).map((s) => s.split(':').map((p) => p.trim()) as [string, string])),
                              }}
                            >
                              {initials(u.name)}
                            </div>
                            <div>
                              <p style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: '0.8125rem' }}>{u.name}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={ROLE_BADGE[u.role] ?? 'badge badge-neutral'}>
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{u.location?.name ?? 'All Locations'}</td>
                        <td style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{timeAgo(u.lastLogin)}</td>
                        <td>
                          {u.isActive !== false
                            ? <span className="badge badge-success">Active</span>
                            : <span className="badge badge-neutral">Inactive</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setModalUser(u)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={toggling === u.id}
                              onClick={() => deactivate(u)}
                              style={{ color: u.isActive !== false ? 'var(--danger-fg)' : 'var(--success-fg)' }}
                            >
                              {toggling === u.id ? '…' : u.isActive !== false ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-3)' }}>
                          No users match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === 'roles' && <RolesPermissionsTab />}
      </div>

      {/* Modal */}
      {modalUser !== null && (
        <UserModal
          user={modalUser === 'new' ? null : modalUser}
          locationOpts={locationOpts}
          onClose={() => setModalUser(null)}
          onSuccess={() => { setModalUser(null); reload(); }}
        />
      )}
    </div>
  );
}
