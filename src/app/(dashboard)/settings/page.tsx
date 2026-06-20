'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Location {
  id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  defaultAdminFee?: number;
  defaultInsuranceFee?: number;
  isActive?: boolean;
  manager?: string;
  _count?: { users: number; vehicles: number };
}

interface CompanySettings {
  id?: string;
  name?: string;
  taxId?: string;
  address?: string;
  defaultCurrency?: string;
  language?: string;
  fiscalYearStartMonth?: number;
}

const NAV_ITEMS = ['General', 'Locations', 'Branding', 'Notifications', 'Integrations', 'Security'] as const;
type NavItem = typeof NAV_ITEMS[number];

const MONTH_OPTS = [
  { value: '1',  label: 'January'   }, { value: '2',  label: 'February'  },
  { value: '3',  label: 'March'     }, { value: '4',  label: 'April'     },
  { value: '5',  label: 'May'       }, { value: '6',  label: 'June'      },
  { value: '7',  label: 'July'      }, { value: '8',  label: 'August'    },
  { value: '9',  label: 'September' }, { value: '10', label: 'October'   },
  { value: '11', label: 'November'  }, { value: '12', label: 'December'  },
];

const LANG_OPTS = [
  { value: 'ar', label: 'Arabic'  },
  { value: 'en', label: 'English' },
];

// ── Location Modal ────────────────────────────────────────────────────────────
function LocationModal({
  loc,
  onClose,
  onSuccess,
}: { loc?: Location; onClose: () => void; onSuccess: () => void }) {
  const editing = !!loc;
  const [form, setForm] = useState({
    name:               loc?.name               ?? '',
    city:               loc?.city               ?? '',
    address:            loc?.address            ?? '',
    phone:              loc?.phone              ?? '',
    email:              loc?.email              ?? '',
    manager:            loc?.manager            ?? '',
    defaultAdminFee:    loc?.defaultAdminFee    != null ? String(loc.defaultAdminFee)    : '',
    defaultInsuranceFee:loc?.defaultInsuranceFee != null ? String(loc.defaultInsuranceFee) : '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setErr('Location name is required.'); return; }
    setSaving(true); setErr('');
    const body = {
      name:               form.name,
      city:               form.city               || undefined,
      address:            form.address            || undefined,
      phone:              form.phone              || undefined,
      email:              form.email              || undefined,
      manager:            form.manager            || undefined,
      defaultAdminFee:    form.defaultAdminFee    ? Number(form.defaultAdminFee)    : undefined,
      defaultInsuranceFee:form.defaultInsuranceFee? Number(form.defaultInsuranceFee): undefined,
    };
    try {
      if (editing) {
        await apiFetch(`/locations/${loc!.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/locations', { method: 'POST', body: JSON.stringify(body) });
      }
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-lg card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="page-title" style={{ fontSize: '0.9375rem' }}>
            {editing ? `Edit — ${loc!.name}` : 'Add Location'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Display Name *</label>
              <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="AutoDealer — Cairo" />
            </div>
            <div>
              <label className="input-label">City</label>
              <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Cairo" />
            </div>
          </div>
          <div>
            <label className="input-label">Address</label>
            <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="45 Abbas El Akkad St, Nasr City" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+20 2 2345 6789" />
            </div>
            <div>
              <label className="input-label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="cairo@dealership.com" />
            </div>
          </div>
          <div>
            <label className="input-label">Branch Manager</label>
            <input className="input" value={form.manager} onChange={(e) => set('manager', e.target.value)} placeholder="Name of branch manager" />
          </div>
          <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="section-label" style={{ marginTop: '0.75rem' }}>Egypt Regulatory Defaults</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Default Admin Fee (EGP)</label>
                <input type="number" min="0" className="input" value={form.defaultAdminFee} onChange={(e) => set('defaultAdminFee', e.target.value)} placeholder="3,500" />
              </div>
              <div>
                <label className="input-label">Default Insurance Fee (EGP)</label>
                <input type="number" min="0" className="input" value={form.defaultInsuranceFee} onChange={(e) => set('defaultInsuranceFee', e.target.value)} placeholder="4,000" />
              </div>
            </div>
          </div>
          {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? '…' : editing ? 'Save Changes' : 'Create Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── General Tab ───────────────────────────────────────────────────────────────
function GeneralTab() {
  const { data: company, loading, reload } = useQuery<CompanySettings>('/settings/company');
  const [form, setForm]   = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState('');

  if (!form && company) setForm({ ...company });
  if (loading) return <div className="py-8 text-center" style={{ color: 'var(--text-3)' }}>Loading…</div>;
  if (!form)   return <div className="py-8 text-center" style={{ color: 'var(--text-3)' }}>No company data found.</div>;

  function set(k: keyof CompanySettings, v: string | number) { setForm((p) => p ? { ...p, [k]: v } : p); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(''); setSaved(false);
    try {
      await apiFetch('/settings/company', { method: 'PATCH', body: JSON.stringify(form) });
      setSaved(true); reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div className="card p-5 space-y-4">
        <p className="section-label">Company Details</p>
        <div>
          <label className="input-label">Company Name</label>
          <input className="input" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Tax Registration # (EGP)</label>
          <input className="input" value={form.taxId ?? ''} onChange={(e) => set('taxId', e.target.value)} placeholder="200-123-456" />
        </div>
        <div>
          <label className="input-label">Address</label>
          <input className="input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </div>
      </div>
      <div className="card p-5 space-y-4">
        <p className="section-label">Regional Settings</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Default Currency</label>
            <input className="input" value="EGP — Egyptian Pound" disabled style={{ opacity: 0.7 }} />
          </div>
          <div>
            <SearchableCombobox
              label="Default Language"
              options={LANG_OPTS}
              value={form.language ?? 'ar'}
              onChange={(v) => set('language', v)}
            />
          </div>
          <div>
            <SearchableCombobox
              label="Fiscal Year Start"
              options={MONTH_OPTS}
              value={String(form.fiscalYearStartMonth ?? 1)}
              onChange={(v) => set('fiscalYearStartMonth', Number(v))}
            />
          </div>
        </div>
      </div>
      {err   && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{err}</p>}
      {saved && <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)' }}>Settings saved successfully.</p>}
      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  );
}

// ── Locations Tab ─────────────────────────────────────────────────────────────
function LocationsTab() {
  const { data: raw, loading, reload } = useQuery<Location[]>('/locations');
  const [editLoc, setEditLoc] = useState<Location | 'new' | null>(null);

  const locations = Array.isArray(raw) ? raw : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
          {locations.length} branch{locations.length !== 1 ? 'es' : ''} configured
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setEditLoc('new')}>
          + Add Location
        </button>
      </div>

      {loading && <div className="py-8 text-center" style={{ color: 'var(--text-3)' }}>Loading…</div>}

      <div className="space-y-3">
        {locations.map((loc) => (
          <div key={loc.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.9rem' }}>{loc.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
                  {[loc.city, loc.address].filter(Boolean).join(' · ')}
                </p>
                <div className="flex gap-4 mt-2" style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                  {loc.phone && <span>{loc.phone}</span>}
                  {loc.email && <span>{loc.email}</span>}
                  {loc.manager && <span>Manager: {loc.manager}</span>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  <span>{loc._count?.users ?? 0} staff</span>
                  <span>{loc._count?.vehicles ?? 0} vehicles</span>
                </div>
                <span className={`badge ${loc.isActive !== false ? 'badge-success' : 'badge-neutral'}`}>
                  {loc.isActive !== false ? 'Active' : 'Inactive'}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditLoc(loc)}>Edit</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: 2 }}>Default Admin Fee (EGP)</p>
                <p style={{ fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {loc.defaultAdminFee ? Number(loc.defaultAdminFee).toLocaleString('en-EG') : '—'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: 2 }}>Default Insurance Fee (EGP)</p>
                <p style={{ fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {loc.defaultInsuranceFee ? Number(loc.defaultInsuranceFee).toLocaleString('en-EG') : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
        {locations.length === 0 && !loading && (
          <div className="card py-12 text-center" style={{ color: 'var(--text-3)' }}>
            No locations configured. Click "+ Add Location" to get started.
          </div>
        )}
      </div>

      {editLoc !== null && (
        <LocationModal
          loc={editLoc === 'new' ? undefined : editLoc}
          onClose={() => setEditLoc(null)}
          onSuccess={() => { setEditLoc(null); reload(); }}
        />
      )}
    </div>
  );
}

// ── Branding Tab ──────────────────────────────────────────────────────────────
function BrandingTab() {
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [displayName,  setDisplayName]  = useState('AutoDealer');
  const [saved,        setSaved]        = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-xl">
      <div className="card p-5 space-y-4">
        <p className="section-label">Company Logo</p>
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg"
          style={{ border: '2px dashed var(--border-strong)', padding: '2rem', background: 'var(--surface-2)', cursor: 'pointer' }}
        >
          <svg className="w-8 h-8" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>Upload Branch Logo</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>PNG, SVG or JPG · max 2 MB</p>
        </div>
      </div>
      <div className="card p-5 space-y-4">
        <p className="section-label">Brand Colors &amp; Identity</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Primary Color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 38, height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              <input className="input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
          <div>
            <label className="input-label">Website Display Name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>Preview</p>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: primaryColor, display: 'inline-flex' }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>{displayName}</span>
          </div>
        </div>
      </div>
      {saved && <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)' }}>Branding settings saved.</p>}
      <button type="submit" className="btn btn-primary">Save Branding</button>
    </form>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────
function NotificationsTab() {
  const [toggles, setToggles] = useState({
    newLead:           true,
    dealFinalized:     true,
    overduePayments:   true,
    bankReconciliation:false,
    dailySummary:      true,
  });

  function toggle(k: keyof typeof toggles) {
    setToggles((p) => ({ ...p, [k]: !p[k] }));
  }

  const items: { key: keyof typeof toggles; label: string; desc: string }[] = [
    { key: 'newLead',           label: 'New Lead Notification',        desc: 'Notify sales reps when a new lead is assigned'             },
    { key: 'dealFinalized',     label: 'Deal Finalized Alert',         desc: 'Notify finance and manager when a deal is finalized'       },
    { key: 'overduePayments',   label: 'Overdue Payment Alerts',       desc: 'Daily alerts for installment payments past due date'        },
    { key: 'bankReconciliation',label: 'Bank Reconciliation Reminder', desc: 'Weekly reminder to reconcile bank statement'               },
    { key: 'dailySummary',      label: 'Daily Summary Email',          desc: 'Morning summary of previous day\'s deals, leads and KPIs'  },
  ];

  return (
    <div className="space-y-3 max-w-xl">
      {items.map((item) => (
        <div key={item.key} className="card flex items-center justify-between p-4">
          <div>
            <p style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: '0.875rem' }}>{item.label}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>{item.desc}</p>
          </div>
          <button
            type="button"
            onClick={() => toggle(item.key)}
            role="switch"
            aria-checked={toggles[item.key]}
            style={{
              width: 40, height: 22, borderRadius: 9999,
              background: toggles[item.key] ? 'var(--primary)' : 'var(--border-strong)',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: toggles[item.key] ? 20 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 200ms',
            }} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Integrations Tab ──────────────────────────────────────────────────────────
function IntegrationsTab() {
  const integrations = [
    { name: 'DocuSign E-Signature',  desc: 'E-sign vehicle agency from your dealership agreements', connected: true  },
    { name: 'VIN Decoder API',       desc: 'Auto-fill vehicle specs from VIN number',                connected: true  },
    { name: 'Facebook Lead Ads',     desc: 'Capture leads directly from Facebook campaigns',         connected: false },
    { name: 'Hatla2ee Marketplace',  desc: 'Sync inventory with hatla2ee.com listings',              connected: false },
    { name: 'Al-Ahly Bank Portal',   desc: 'Direct bank financing document submission',              connected: false },
  ];

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="section-label">Third-Party Integrations</p>
      {integrations.map((intg) => (
        <div key={intg.name} className="card flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 38, height: 38, background: intg.connected ? 'var(--success-bg)' : 'var(--surface-2)', flexShrink: 0 }}
            >
              {intg.connected ? (
                <svg className="w-5 h-5" style={{ color: 'var(--success-fg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
            </div>
            <div>
              <p style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: '0.875rem' }}>{intg.name}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>{intg.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${intg.connected ? 'badge-success' : 'badge-neutral'}`}>
              {intg.connected ? 'Connected' : 'Disconnected'}
            </span>
            <button className="btn btn-secondary btn-sm">
              {intg.connected ? 'Configure' : 'Connect'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────
function SecurityTab() {
  const [policy, setPolicy] = useState({
    minLength:        8,
    requireUppercase: true,
    requireNumbers:   true,
    requireSymbols:   false,
    sessionTimeout:   60,
  });
  const [twoFA, setTwoFA] = useState({
    FINANCE:true, ADMIN: true, MANAGER: false,
  });
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div className="card p-5 space-y-4">
        <p className="section-label">Password Policy</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Minimum Length</label>
            <input type="number" min="6" max="32" className="input"
              value={policy.minLength}
              onChange={(e) => setPolicy((p) => ({ ...p, minLength: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="input-label">Session Timeout (minutes)</label>
            <input type="number" min="5" max="1440" className="input"
              value={policy.sessionTimeout}
              onChange={(e) => setPolicy((p) => ({ ...p, sessionTimeout: Number(e.target.value) }))} />
          </div>
        </div>
        {([
          { k: 'requireUppercase', label: 'Require uppercase letters'   },
          { k: 'requireNumbers',   label: 'Require numbers'             },
          { k: 'requireSymbols',   label: 'Require symbols (!@#$…)'     },
        ] as { k: keyof typeof policy; label: string }[]).map(({ k, label }) => (
          <label key={k} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!policy[k]}
              onChange={(e) => setPolicy((p) => ({ ...p, [k]: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{label}</span>
          </label>
        ))}
      </div>

      <div className="card p-5 space-y-3">
        <p className="section-label">2FA Enforcement by Role</p>
        {(['FINANCE', 'ADMIN', 'MANAGER'] as const).map((role) => (
          <div key={role} className="flex items-center justify-between">
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{role.charAt(0) + role.slice(1).toLowerCase().replace('_', ' ')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={twoFA[role]}
              onClick={() => setTwoFA((p) => ({ ...p, [role]: !p[role] }))}
              style={{
                width: 40, height: 22, borderRadius: 9999,
                background: twoFA[role] ? 'var(--primary)' : 'var(--border-strong)',
                border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: twoFA[role] ? 20 : 3,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 200ms',
              }} />
            </button>
          </div>
        ))}
      </div>

      {saved && <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)' }}>Security settings saved.</p>}
      <button type="submit" className="btn btn-primary">Save Security Settings</button>
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeNav, setActiveNav] = useState<NavItem>('General');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">Company configuration, email templates &amp; integrations</p>
        </div>
      </div>

      <div className="page-body">
        <div className="flex gap-6">
          {/* Left nav */}
          <aside style={{ width: 180, flexShrink: 0 }}>
            <nav className="card overflow-hidden">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActiveNav(item)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '0.65rem 1rem', fontSize: '0.8125rem',
                    fontWeight: activeNav === item ? 500 : 400,
                    background: activeNav === item ? 'var(--info-bg)' : 'transparent',
                    color: activeNav === item ? 'var(--primary)' : 'var(--text-2)',
                    borderLeft: activeNav === item ? '3px solid var(--primary)' : '3px solid transparent',
                    borderTop: 'none', borderRight: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'background 150ms, color 150ms',
                  }}
                >
                  {item}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main style={{ flex: 1, minWidth: 0 }}>
            {activeNav === 'General'       && <GeneralTab />}
            {activeNav === 'Locations'     && <LocationsTab />}
            {activeNav === 'Branding'      && <BrandingTab />}
            {activeNav === 'Notifications' && <NotificationsTab />}
            {activeNav === 'Integrations'  && <IntegrationsTab />}
            {activeNav === 'Security'      && <SecurityTab />}
          </main>
        </div>
      </div>
    </div>
  );
}
