'use client';

import { useRef, useState, useEffect } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import NumericInput from '../../../components/ui/NumericInput';
import { useLang, type Lang } from '../../../lib/lang-context';
import { useBrand } from '../../../lib/brand-context';

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

const NAV_ITEMS = ['General', 'Locations', 'Branding', 'Notifications', 'Email Templates', 'Integrations', 'Security', 'Parameters', 'Car Makes & Models', 'Accredited Dealers'] as const;
type NavItem = typeof NAV_ITEMS[number];

const MONTH_OPTS = [
  { value: '1',  label: 'January'   }, { value: '2',  label: 'February'  },
  { value: '3',  label: 'March'     }, { value: '4',  label: 'April'     },
  { value: '5',  label: 'May'       }, { value: '6',  label: 'June'      },
  { value: '7',  label: 'July'      }, { value: '8',  label: 'August'    },
  { value: '9',  label: 'September' }, { value: '10', label: 'October'   },
  { value: '11', label: 'November'  }, { value: '12', label: 'December'  },
];

const MONTH_OPTS_AR = [
  { value: '1',  label: 'يناير'   }, { value: '2',  label: 'فبراير'  },
  { value: '3',  label: 'مارس'    }, { value: '4',  label: 'أبريل'   },
  { value: '5',  label: 'مايو'    }, { value: '6',  label: 'يونيو'   },
  { value: '7',  label: 'يوليو'   }, { value: '8',  label: 'أغسطس'   },
  { value: '9',  label: 'سبتمبر'  }, { value: '10', label: 'أكتوبر'  },
  { value: '11', label: 'نوفمبر'  }, { value: '12', label: 'ديسمبر'  },
];

const LANG_OPTS = [
  { value: 'ar', label: 'Arabic'  },
  { value: 'en', label: 'English' },
];

// ── Parameters Tab ────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  car_color:    'Colors',
  body_type:    'Body Types',
  fuel_type:    'Fuel Types',
  transmission: 'Transmissions',
  gear_type:    'Gear Types',
};

const CATEGORY_LABELS_AR: Record<string, string> = {
  car_color:    'الألوان',
  body_type:    'أنواع الهيكل',
  fuel_type:    'أنواع الوقود',
  transmission: 'أنواع ناقل الحركة',
  gear_type:    'أنواع العتلة',
};

const NAV_AR: Record<string, string> = {
  'General':            'عام',
  'Locations':          'الفروع',
  'Branding':           'العلامة التجارية',
  'Notifications':      'الإشعارات',
  'Email Templates':    'قوالب البريد',
  'Integrations':       'التكاملات',
  'Security':           'الأمان',
  'Parameters':         'المعاملات',
  'Car Makes & Models': 'الشركات المصنعة والطرازات',
  'Accredited Dealers': 'الوكلاء المعتمدون',
};

// ── Location Modal ────────────────────────────────────────────────────────────
function LocationModal({
  loc,
  onClose,
  onSuccess,
}: { loc?: Location; onClose: () => void; onSuccess: () => void }) {
  const editing = !!loc;
  const { isAr } = useLang();
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
    if (!form.name) { setErr(isAr ? 'اسم الفرع مطلوب.' : 'Location name is required.'); return; }
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
            {editing
              ? (isAr ? `تعديل — ${loc!.name}` : `Edit — ${loc!.name}`)
              : (isAr ? 'إضافة فرع جديد' : 'Add Location')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">{isAr ? 'اسم الفرع *' : 'Display Name *'}</label>
              <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="AutoDealer — Cairo" />
            </div>
            <div>
              <label className="input-label">{isAr ? 'المدينة' : 'City'}</label>
              <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Cairo" />
            </div>
          </div>
          <div>
            <label className="input-label">{isAr ? 'العنوان' : 'Address'}</label>
            <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="45 Abbas El Akkad St, Nasr City" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">{isAr ? 'الهاتف' : 'Phone'}</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+20 2 2345 6789" />
            </div>
            <div>
              <label className="input-label">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="cairo@dealership.com" />
            </div>
          </div>
          <div>
            <label className="input-label">{isAr ? 'مدير الفرع' : 'Branch Manager'}</label>
            <input className="input" value={form.manager} onChange={(e) => set('manager', e.target.value)} placeholder="Name of branch manager" />
          </div>
          <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="section-label" style={{ marginTop: '0.75rem' }}>
              {isAr ? 'الإعدادات الافتراضية المصرية' : 'Egypt Regulatory Defaults'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">{isAr ? 'الرسوم الإدارية الافتراضية (جنيه)' : 'Default Admin Fee (EGP)'}</label>
                <NumericInput min="0" className="input" value={form.defaultAdminFee} onChange={(val) => set('defaultAdminFee', val)} placeholder="3,500" />
              </div>
              <div>
                <label className="input-label">{isAr ? 'رسوم التأمين الافتراضية (جنيه)' : 'Default Insurance Fee (EGP)'}</label>
                <NumericInput min="0" className="input" value={form.defaultInsuranceFee} onChange={(val) => set('defaultInsuranceFee', val)} placeholder="4,000" />
              </div>
            </div>
          </div>
          {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? '…' : editing ? (isAr ? 'حفظ التغييرات' : 'Save Changes') : (isAr ? 'إنشاء الفرع' : 'Create Location')}
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
  const { setLang, isAr } = useLang();

  if (!form && company) setForm({ ...company });
  if (loading) return <div className="py-8 text-center" style={{ color: 'var(--text-3)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>;
  if (!form)   return <div className="py-8 text-center" style={{ color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات للشركة.' : 'No company data found.'}</div>;

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
        <p className="section-label">{isAr ? 'تفاصيل الشركة' : 'Company Details'}</p>
        <div>
          <label className="input-label">{isAr ? 'اسم الشركة' : 'Company Name'}</label>
          <input className="input" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="input-label">{isAr ? 'رقم التسجيل الضريبي' : 'Tax Registration # (EGP)'}</label>
          <input className="input" value={form.taxId ?? ''} onChange={(e) => set('taxId', e.target.value)} placeholder="200-123-456" />
        </div>
        <div>
          <label className="input-label">{isAr ? 'العنوان' : 'Address'}</label>
          <input className="input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </div>
      </div>
      <div className="card p-5 space-y-4">
        <p className="section-label">{isAr ? 'الإعدادات الإقليمية' : 'Regional Settings'}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">{isAr ? 'العملة الافتراضية' : 'Default Currency'}</label>
            <input className="input" value="EGP — Egyptian Pound" disabled style={{ opacity: 0.7 }} />
          </div>
          <div>
            <SearchableCombobox
              label={isAr ? 'اللغة الافتراضية' : 'Default Language'}
              options={isAr
                ? [{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'الإنجليزية' }]
                : LANG_OPTS}
              value={form.language ?? 'ar'}
              onChange={(v) => { set('language', v); setLang(v as Lang); }}
            />
          </div>
          <div>
            <SearchableCombobox
              label={isAr ? 'بداية السنة المالية' : 'Fiscal Year Start'}
              options={isAr ? MONTH_OPTS_AR : MONTH_OPTS}
              value={String(form.fiscalYearStartMonth ?? 1)}
              onChange={(v) => set('fiscalYearStartMonth', Number(v))}
            />
          </div>
        </div>
      </div>
      {err   && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{err}</p>}
      {saved && <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)' }}>{isAr ? 'تم حفظ الإعدادات بنجاح.' : 'Settings saved successfully.'}</p>}
      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ الإعدادات' : 'Save Changes')}
      </button>
    </form>
  );
}

// ── Locations Tab ─────────────────────────────────────────────────────────────
function LocationsTab() {
  const { data: raw, loading, reload } = useQuery<Location[]>('/locations');
  const [editLoc, setEditLoc] = useState<Location | 'new' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [delErr, setDelErr] = useState('');
  const { isAr } = useLang();

  const locations = Array.isArray(raw) ? raw : [];

  async function confirmDelete(loc: Location) {
    const hasData = (loc._count?.vehicles ?? 0) > 0 || (loc._count?.users ?? 0) > 0;
    const msg = hasData
      ? isAr
        ? `"${loc.name}" يحتوي على ${loc._count?.vehicles ?? 0} مركبة و${loc._count?.users ?? 0} موظف. سيتم تعطيله (لن يُحذف نهائيًا) للحفاظ على السجلات الحالية. هل تريد المتابعة؟`
        : `"${loc.name}" has ${loc._count?.vehicles ?? 0} vehicle(s) and ${loc._count?.users ?? 0} staff. It will be deactivated (not permanently deleted) to preserve existing records. Continue?`
      : isAr
        ? `تعطيل "${loc.name}"؟ يمكن إعادة تفعيله لاحقًا.`
        : `Deactivate "${loc.name}"? It can be reactivated by editing it.`;
    if (!confirm(msg)) return;
    setDeleting(loc.id);
    setDelErr('');
    try {
      await apiFetch(`/locations/${loc.id}`, { method: 'DELETE' });
      reload();
    } catch (e: unknown) {
      setDelErr(e instanceof Error ? e.message : (isAr ? 'فشل تعطيل الفرع' : 'Failed to deactivate location'));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
          {isAr
            ? `${locations.length} فرع مُعدَّل`
            : `${locations.length} branch${locations.length !== 1 ? 'es' : ''} configured`}
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setEditLoc('new')}>
          {isAr ? '+ إضافة فرع' : '+ Add Location'}
        </button>
      </div>

      {loading && <div className="py-8 text-center" style={{ color: 'var(--text-3)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>}

      {delErr && (
        <div style={{ padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger-fg)', fontSize: '0.8125rem' }}>
          {delErr}
        </div>
      )}

      <div className="space-y-3">
        {locations.map((loc) => (
          <div key={loc.id} className="card p-5" style={{ opacity: loc.isActive === false ? 0.6 : 1 }}>
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.9rem' }}>{loc.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
                  {[loc.city, loc.address].filter(Boolean).join(' · ')}
                </p>
                <div className="flex gap-4 mt-2" style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                  {loc.phone && <span>{loc.phone}</span>}
                  {loc.email && <span>{loc.email}</span>}
                  {loc.manager && <span>{isAr ? 'المدير:' : 'Manager:'} {loc.manager}</span>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  <span>{loc._count?.users ?? 0} {isAr ? 'موظف' : 'staff'}</span>
                  <span>{loc._count?.vehicles ?? 0} {isAr ? 'مركبة' : 'vehicles'}</span>
                </div>
                <span className={`badge ${loc.isActive !== false ? 'badge-success' : 'badge-neutral'}`}>
                  {loc.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditLoc(loc)}>
                  {isAr ? 'تعديل' : 'Edit'}
                </button>
                {loc.isActive !== false && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => confirmDelete(loc)}
                    disabled={deleting === loc.id}
                    style={{ color: 'var(--danger)', padding: '0.3rem 0.5rem' }}
                    title={isAr ? 'تعطيل الفرع' : 'Deactivate location'}
                  >
                    {deleting === loc.id ? '…' : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
                        <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: 2 }}>
                  {isAr ? 'الرسوم الإدارية الافتراضية (جنيه)' : 'Default Admin Fee (EGP)'}
                </p>
                <p style={{ fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {loc.defaultAdminFee ? Number(loc.defaultAdminFee).toLocaleString('en-EG') : '—'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: 2 }}>
                  {isAr ? 'رسوم التأمين الافتراضية (جنيه)' : 'Default Insurance Fee (EGP)'}
                </p>
                <p style={{ fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {loc.defaultInsuranceFee ? Number(loc.defaultInsuranceFee).toLocaleString('en-EG') : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
        {locations.length === 0 && !loading && (
          <div className="card py-12 text-center" style={{ color: 'var(--text-3)' }}>
            {isAr ? 'لا توجد فروع. انقر على "+ إضافة فرع" للبدء.' : 'No locations configured. Click "+ Add Location" to get started.'}
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
  const { logoUrl, displayName, primaryColor, faviconUrl, setLogo, setDisplayName, setPrimaryColor, setFavicon, saveBrand } = useBrand();
  const [saved, setSaved] = useState(false);
  const { isAr } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  function handleLogoFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setLogo(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleFaviconFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setFavicon(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    saveBrand();
    // persist logo + favicon to DB so B2C public endpoint can read them
    try {
      await apiFetch('/settings/company', {
        method: 'PATCH',
        body: JSON.stringify({ logoUrl: logoUrl || null, faviconUrl: faviconUrl || null }),
      });
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-xl">
      <div className="card p-5 space-y-4">
        <p className="section-label">{isAr ? 'شعار الشركة' : 'Company Logo'}</p>
        <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp"
          style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleLogoFile(e.target.files[0]); }} />
        <input ref={faviconRef} type="file" accept="image/png,image/x-icon,image/svg+xml,image/jpeg,image/webp"
          style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleFaviconFile(e.target.files[0]); }} />
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg"
          style={{ border: '2px dashed var(--border-strong)', padding: '2rem', background: 'var(--surface-2)', cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoFile(f); }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo preview" style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }} />
          ) : (
            <svg className="w-8 h-8" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
            {logoUrl ? (isAr ? 'انقر لتغيير الشعار' : 'Click to change logo') : (isAr ? 'انقر أو اسحب لرفع الشعار' : 'Click or drag to upload logo')}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{isAr ? 'PNG، SVG أو JPG · الحد الأقصى 2 ميجا' : 'PNG, SVG or JPG · max 2 MB'}</p>
          {logoUrl && (
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); setLogo(''); }}
              style={{ color: 'var(--danger-fg)' }}>
              {isAr ? 'إزالة الشعار' : 'Remove logo'}
            </button>
          )}
        </div>

        {/* Favicon */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <p className="input-label" style={{ marginBottom: '0.5rem' }}>{isAr ? 'أيقونة الموقع (Favicon)' : 'Browser Favicon'}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
            {isAr ? 'تظهر في علامة تبويب المتصفح. يُفضّل PNG أو ICO بحجم 32×32 أو 64×64.' : 'Shown in the browser tab. Recommend 32×32 or 64×64 PNG / ICO.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: 52, height: 52, borderRadius: 8, flexShrink: 0,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
              {faviconUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={faviconUrl} alt="favicon preview" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-3)' }}>
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => faviconRef.current?.click()}>
                {faviconUrl ? (isAr ? 'تغيير الأيقونة' : 'Change favicon') : (isAr ? 'رفع أيقونة' : 'Upload favicon')}
              </button>
              {faviconUrl && (
                <button type="button" className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger-fg)' }}
                  onClick={() => setFavicon('')}>
                  {isAr ? 'إزالة' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="card p-5 space-y-4">
        <p className="section-label">{isAr ? 'ألوان العلامة التجارية والهوية' : 'Brand Colors & Identity'}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">{isAr ? 'اللون الرئيسي' : 'Primary Color'}</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 38, height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              <input className="input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
          <div>
            <label className="input-label">{isAr ? 'اسم العرض' : 'Display Name'}</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder={isAr ? 'اسم الشركة أو المعرض' : 'Company or dealership name'} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>{isAr ? 'معاينة' : 'Preview'}</p>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: primaryColor, display: 'inline-flex' }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>{displayName || (isAr ? 'اسم المعرض' : 'Dealership Name')}</span>
          </div>
        </div>
      </div>
      {saved && <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)' }}>{isAr ? 'تم حفظ إعدادات العلامة التجارية.' : 'Branding settings saved.'}</p>}
      <button type="submit" className="btn btn-primary">{isAr ? 'حفظ العلامة التجارية' : 'Save Branding'}</button>
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
  const { isAr } = useLang();

  function toggle(k: keyof typeof toggles) {
    setToggles((p) => ({ ...p, [k]: !p[k] }));
  }

  const items: { key: keyof typeof toggles; label: string; labelAr: string; desc: string; descAr: string }[] = [
    { key: 'newLead',           label: 'New Lead Notification',        labelAr: 'إشعار عميل جديد',          desc: 'Notify sales reps when a new lead is assigned',             descAr: 'إشعار مندوبي المبيعات عند تعيين عميل جديد'          },
    { key: 'dealFinalized',     label: 'Deal Finalized Alert',         labelAr: 'تنبيه إتمام الصفقة',        desc: 'Notify finance and manager when a deal is finalized',       descAr: 'إشعار المالية والمدير عند إتمام صفقة'               },
    { key: 'overduePayments',   label: 'Overdue Payment Alerts',       labelAr: 'تنبيهات الدفعات المتأخرة',  desc: 'Daily alerts for installment payments past due date',        descAr: 'تنبيهات يومية للدفعات المتأخرة عن موعدها'           },
    { key: 'bankReconciliation',label: 'Bank Reconciliation Reminder', labelAr: 'تذكير مطابقة البنك',         desc: 'Weekly reminder to reconcile bank statement',               descAr: 'تذكير أسبوعي بمطابقة كشف الحساب البنكي'             },
    { key: 'dailySummary',      label: 'Daily Summary Email',          labelAr: 'ملخص يومي بالبريد',          desc: "Morning summary of previous day's deals, leads and KPIs",   descAr: 'ملخص صباحي بصفقات وعملاء ومؤشرات اليوم السابق'     },
  ];

  return (
    <div className="space-y-3 max-w-xl">
      {items.map((item) => (
        <div key={item.key} className="card flex items-center justify-between p-4">
          <div>
            <p style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: '0.875rem' }}>{isAr ? item.labelAr : item.label}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>{isAr ? item.descAr : item.desc}</p>
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
function WhatsAppConfigPanel({ isAr }: { isAr: boolean }) {
  const [cfg, setCfg] = useState({
    phoneNumberId:  '',
    accessToken:    '',
    verifyToken:    '',
  });
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(false);

  const WEBHOOK = typeof window !== 'undefined'
    ? `${window.location.origin}/api/whatsapp/webhook`
    : 'https://your-domain.com/api/whatsapp/webhook';

  function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = cfg.phoneNumberId.trim() && cfg.accessToken.trim() && cfg.verifyToken.trim();
    if (!ok) return;
    // ponytail: persist to localStorage as stand-in for real API settings endpoint
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_cfg', JSON.stringify(cfg));
    }
    setConnected(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function disconnect() {
    if (!confirm(isAr ? 'قطع الاتصال بواتساب؟' : 'Disconnect WhatsApp integration?')) return;
    setCfg({ phoneNumberId: '', accessToken: '', verifyToken: '' });
    if (typeof window !== 'undefined') localStorage.removeItem('wa_cfg');
    setConnected(false);
    setShow(false);
  }

  // restore from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('wa_cfg');
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      setCfg(p);
      setConnected(!!(p.phoneNumberId && p.accessToken));
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="card" style={{ maxWidth: '42rem', overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          {/* WhatsApp logo mark */}
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: connected ? '#25D36622' : 'var(--surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill={connected ? '#25D366' : 'var(--text-3)'}/>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.979-1.302A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 01-4.049-1.107l-.29-.172-3.007.786.806-2.934-.189-.3A7.95 7.95 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" fill={connected ? '#25D366' : 'var(--text-3)'}/>
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)' }}>
              {isAr ? 'واتساب بيزنس API' : 'WhatsApp Business API'}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
              {isAr
                ? 'إرسال واستقبال رسائل العملاء مباشرة من الداشبورد'
                : 'Send and receive customer messages directly from the dashboard'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
          <span className={`badge ${connected ? 'badge-success' : 'badge-neutral'}`}>
            {connected ? (isAr ? 'متصل' : 'Connected') : (isAr ? 'غير متصل' : 'Not Connected')}
          </span>
          {connected ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setShow((p) => !p)}>
                {isAr ? 'إعداد' : 'Configure'}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-fg)' }} onClick={disconnect}>
                {isAr ? 'قطع' : 'Disconnect'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setShow((p) => !p)}>
              {isAr ? 'توصيل' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable config panel */}
      {show && (
        <form onSubmit={save} style={{ borderTop: '1px solid var(--border)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--surface-2)' }}>
          <div>
            <p className="section-label">{isAr ? 'بيانات اعتماد Meta Business' : 'Meta Business Credentials'}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
              {isAr
                ? 'احصل عليها من Meta for Developers ← WhatsApp ← API Setup'
                : 'Get these from Meta for Developers → WhatsApp → API Setup'}
            </p>
          </div>

          <div>
            <label className="input-label">{isAr ? 'معرّف رقم الهاتف (Phone Number ID)' : 'Phone Number ID'}</label>
            <input
              className="input"
              value={cfg.phoneNumberId}
              onChange={(e) => setCfg((p) => ({ ...p, phoneNumberId: e.target.value }))}
              placeholder="123456789012345"
              dir="ltr"
            />
          </div>

          <div>
            <label className="input-label">{isAr ? 'رمز الوصول الدائم (Permanent Access Token)' : 'Permanent Access Token'}</label>
            <input
              className="input"
              type="password"
              value={cfg.accessToken}
              onChange={(e) => setCfg((p) => ({ ...p, accessToken: e.target.value }))}
              placeholder="EAAxxxxxxxxxxxxxxxx…"
              dir="ltr"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="input-label">{isAr ? 'رمز التحقق من Webhook (Verify Token)' : 'Webhook Verify Token'}</label>
            <input
              className="input"
              value={cfg.verifyToken}
              onChange={(e) => setCfg((p) => ({ ...p, verifyToken: e.target.value }))}
              placeholder={isAr ? 'كلمة سرية من اختيارك…' : 'A secret string you choose…'}
              dir="ltr"
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
              {isAr ? 'اضبطه في Meta ليطابق هذه القيمة عند التحقق من الـ Webhook.' : 'Must match what you enter in the Meta webhook verification step.'}
            </p>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.375rem' }}>
              {isAr ? 'رابط Webhook الخاص بك' : 'Your Webhook URL'}
            </p>
            <code style={{ fontSize: '0.75rem', color: 'var(--primary)', wordBreak: 'break-all', display: 'block' }}>
              {typeof window !== 'undefined'
                ? `${window.location.protocol}//${window.location.host}/api/whatsapp/webhook`
                : WEBHOOK}
            </code>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.375rem' }}>
              {isAr
                ? 'أضف هذا الرابط في Meta تحت إعدادات Webhook ← WhatsApp ← Configuration'
                : 'Paste this into Meta → WhatsApp → Configuration → Webhook URL'}
            </p>
          </div>

          {saved && <p style={{ fontSize: '0.8125rem', color: 'var(--success-fg)' }}>✓ {isAr ? 'تم حفظ إعدادات واتساب' : 'WhatsApp settings saved'}</p>}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              {isAr ? 'حفظ وتفعيل' : 'Save & Activate'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShow(false)}>
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── per-integration config forms ─────────────────────────────────────────────
const INTG_FIELDS: Record<string, { key: string; label: string; labelAr: string; placeholder: string; type?: string }[]> = {
  docusign: [
    { key: 'integrationKey', label: 'Integration Key (Client ID)', labelAr: 'مفتاح التكامل (Client ID)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { key: 'secretKey',      label: 'Secret Key',                  labelAr: 'المفتاح السري',              placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'password' },
    { key: 'accountId',      label: 'Account ID',                  labelAr: 'معرّف الحساب',              placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { key: 'userId',         label: 'API Username (User ID)',       labelAr: 'اسم مستخدم API (User ID)',  placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
  ],
  vin: [
    { key: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', placeholder: 'Your VIN decoder API key', type: 'password' },
    { key: 'provider', label: 'Provider base URL', labelAr: 'رابط مزود الخدمة', placeholder: 'https://api.vindecoder.com/v2' },
  ],
  facebook: [
    { key: 'appId',          label: 'App ID',                labelAr: 'معرّف التطبيق',      placeholder: '1234567890' },
    { key: 'appSecret',      label: 'App Secret',            labelAr: 'السر الخاص بالتطبيق', placeholder: 'abcdef1234…', type: 'password' },
    { key: 'pageToken',      label: 'Page Access Token',     labelAr: 'رمز الصفحة',          placeholder: 'EAAxxxxxxxx…', type: 'password' },
  ],
  hatla2ee: [
    { key: 'apiKey',   label: 'API Key',   labelAr: 'مفتاح API',  placeholder: 'Your Hatla2ee API key', type: 'password' },
    { key: 'dealerId', label: 'Dealer ID', labelAr: 'معرّف الوكيل', placeholder: 'DLR-XXXXX' },
  ],
  ahly: [
    { key: 'portalUser',  label: 'Portal Username',  labelAr: 'اسم المستخدم',   placeholder: 'dealer@ahlybank.com' },
    { key: 'portalPass',  label: 'Portal Password',  labelAr: 'كلمة المرور',     placeholder: '••••••••', type: 'password' },
    { key: 'corporateId', label: 'Corporate ID',     labelAr: 'رقم الشركة',     placeholder: 'CORP-XXXXX' },
  ],
};

const ENV_OPTS = [
  { value: 'sandbox',    label: 'Sandbox (demo/test)' },
  { value: 'production', label: 'Production' },
];
const ENV_OPTS_AR = [
  { value: 'sandbox',    label: 'بيئة التجربة (Sandbox)' },
  { value: 'production', label: 'الإنتاج الفعلي' },
];

function IntegrationConfigPanel({
  intgKey, isAr, onClose,
}: { intgKey: string; isAr: boolean; onClose: () => void }) {
  const fields = INTG_FIELDS[intgKey] ?? [];
  const lsKey = `intg_${intgKey}`;

  const [vals, setVals] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(lsKey) ?? '{}'); } catch { return {}; }
  });
  const [env, setEnv] = useState<string>(() => {
    if (typeof window === 'undefined') return 'sandbox';
    try { return JSON.parse(localStorage.getItem(lsKey) ?? '{}')._env ?? 'sandbox'; } catch { return 'sandbox'; }
  });
  const [saved, setSaved] = useState(false);

  function set(k: string, v: string) { setVals((p) => ({ ...p, [k]: v })); }

  function save(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(lsKey, JSON.stringify({ ...vals, _env: env }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={save} style={{ borderTop: '1px solid var(--border)', padding: '1.25rem', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      {intgKey === 'docusign' && (
        <div>
          <label className="input-label">{isAr ? 'البيئة' : 'Environment'}</label>
          <SearchableCombobox
            options={isAr ? ENV_OPTS_AR : ENV_OPTS}
            value={env}
            onChange={setEnv}
          />
        </div>
      )}
      {fields.map((f) => (
        <div key={f.key}>
          <label className="input-label">{isAr ? f.labelAr : f.label}</label>
          <input
            className="input"
            type={f.type ?? 'text'}
            value={vals[f.key] ?? ''}
            onChange={(e) => set(f.key, e.target.value)}
            placeholder={f.placeholder}
            dir="ltr"
            autoComplete="off"
          />
        </div>
      ))}
      {saved && <p style={{ fontSize: '0.8125rem', color: 'var(--success-fg)' }}>✓ {isAr ? 'تم الحفظ' : 'Settings saved'}</p>}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" className="btn btn-primary btn-sm">{isAr ? 'حفظ' : 'Save'}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>{isAr ? 'إغلاق' : 'Close'}</button>
      </div>
    </form>
  );
}

function IntegrationsTab() {
  const { isAr } = useLang();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const integrations = [
    { key: 'docusign', name: 'DocuSign E-Signature', nameAr: 'توقيع إلكتروني DocuSign', desc: 'E-sign vehicle agency from your dealership agreements', descAr: 'توقيع إلكتروني على عقود وكالة السيارات',        connected: true  },
    { key: 'vin',      name: 'VIN Decoder API',       nameAr: 'API فك رموز VIN',          desc: 'Auto-fill vehicle specs from VIN number',               descAr: 'تعبئة تلقائية لمواصفات السيارة من رقم الشاسيه', connected: true  },
    { key: 'facebook', name: 'Facebook Lead Ads',     nameAr: 'إعلانات عملاء فيسبوك',     desc: 'Capture leads directly from Facebook campaigns',        descAr: 'التقاط العملاء مباشرة من حملات فيسبوك',        connected: false },
    { key: 'hatla2ee', name: 'Hatla2ee Marketplace',  nameAr: 'سوق حظ يعدي',              desc: 'Sync inventory with hatla2ee.com listings',             descAr: 'مزامنة المخزن مع إعلانات حظ يعدي',            connected: false },
    { key: 'ahly',     name: 'Al-Ahly Bank Portal',   nameAr: 'بوابة بنك الأهلي',         desc: 'Direct bank financing document submission',             descAr: 'إرسال مستندات التمويل البنكي مباشرة',          connected: false },
  ];

  function toggle(key: string) {
    setExpandedKey((prev) => prev === key ? null : key);
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="section-label">{isAr ? 'المراسلة' : 'Messaging'}</p>
      <WhatsAppConfigPanel isAr={isAr} />

      <p className="section-label" style={{ marginTop: '1.25rem' }}>{isAr ? 'التكاملات مع الجهات الخارجية' : 'Third-Party Integrations'}</p>
      {integrations.map((intg) => (
        <div key={intg.key} className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
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
                <p style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: '0.875rem' }}>{isAr ? intg.nameAr : intg.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>{isAr ? intg.descAr : intg.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge ${intg.connected ? 'badge-success' : 'badge-neutral'}`}>
                {intg.connected ? (isAr ? 'متصل' : 'Connected') : (isAr ? 'غير متصل' : 'Disconnected')}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => toggle(intg.key)}
              >
                {expandedKey === intg.key
                  ? (isAr ? 'إغلاق' : 'Close')
                  : intg.connected
                    ? (isAr ? 'إعداد' : 'Configure')
                    : (isAr ? 'توصيل' : 'Connect')}
              </button>
            </div>
          </div>
          {expandedKey === intg.key && (
            <IntegrationConfigPanel
              intgKey={intg.key}
              isAr={isAr}
              onClose={() => setExpandedKey(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Email Templates Tab ───────────────────────────────────────────────────────
const EMAIL_TEMPLATES = [
  { key: 'lead_notify',    label: 'Lead Assigned Notification',   labelAr: 'إشعار تعيين عميل',         desc: 'Sent to sales rep when a new lead is assigned to them',     descAr: 'يُرسل لمندوب المبيعات عند تعيين عميل جديد له',   vars: ['{{rep_name}}','{{customer_name}}','{{lead_source}}','{{lead_date}}'] },
  { key: 'appt_reminder',  label: 'Appointment Reminder (24h)',   labelAr: 'تذكير موعد (24 ساعة)',      desc: 'Sent to customer 24 hours before a scheduled test drive',   descAr: 'يُرسل للعميل قبل 24 ساعة من موعد تجربة القيادة', vars: ['{{customer_name}}','{{vehicle}}','{{date}}','{{time}}','{{location}}','{{rep_name}}'] },
  { key: 'appt_reminder1h',label: 'Appointment Reminder (1h)',    labelAr: 'تذكير موعد (ساعة)',         desc: 'Sent to customer 1 hour before the appointment',           descAr: 'يُرسل للعميل قبل ساعة من الموعد',                vars: ['{{customer_name}}','{{vehicle}}','{{time}}','{{location}}'] },
  { key: 'deal_finalized', label: 'Deal Finalized',               labelAr: 'إتمام الصفقة',             desc: 'Sent to customer when their deal is finalized',            descAr: 'يُرسل للعميل عند إتمام صفقته',                   vars: ['{{customer_name}}','{{vehicle}}','{{deal_number}}','{{sale_price}}','{{purchase_method}}'] },
  { key: 'invoice_sent',   label: 'Invoice Sent',                 labelAr: 'إرسال الفاتورة',           desc: 'Sent when a customer invoice is created and ready',        descAr: 'يُرسل عند إنشاء فاتورة العميل وجاهزيتها',        vars: ['{{customer_name}}','{{invoice_number}}','{{amount}}','{{due_date}}'] },
  { key: 'payment_receipt',label: 'Payment Received',             labelAr: 'استلام الدفعة',            desc: 'Sent to customer when a payment is recorded',              descAr: 'يُرسل للعميل عند تسجيل دفعة',                    vars: ['{{customer_name}}','{{amount}}','{{payment_date}}','{{remaining_balance}}'] },
  { key: 'password_reset', label: 'Password Reset',               labelAr: 'إعادة تعيين كلمة المرور',  desc: 'Sent when a staff member or customer requests a reset',     descAr: 'يُرسل عند طلب إعادة تعيين كلمة المرور',          vars: ['{{user_name}}','{{reset_code}}','{{expiry_time}}'] },
];

const DEFAULT_SUBJECTS: Record<string, string> = {
  lead_notify:     'New lead assigned to you — {{customer_name}}',
  appt_reminder:   'Reminder: Your test drive tomorrow at {{time}} — {{vehicle}}',
  appt_reminder1h: 'Your test drive starts in 1 hour — {{vehicle}}',
  deal_finalized:  'Congratulations! Your deal is finalized — {{deal_number}}',
  invoice_sent:    'Invoice #{{invoice_number}} is ready — EGP {{amount}}',
  payment_receipt: 'Payment received — EGP {{amount}} | {{payment_date}}',
  password_reset:  'Your password reset code: {{reset_code}}',
};

const DEFAULT_BODY: Record<string, string> = {
  lead_notify:     'Hi {{rep_name}},\n\nA new lead has been assigned to you.\n\nCustomer: {{customer_name}}\nSource: {{lead_source}}\nDate: {{lead_date}}\n\nLog in to the dashboard to follow up.',
  appt_reminder:   'Hi {{customer_name}},\n\nThis is a reminder that your test drive is scheduled for:\n\nVehicle: {{vehicle}}\nDate: {{date}} at {{time}}\nLocation: {{location}}\nSales Rep: {{rep_name}}\n\nWe look forward to seeing you!',
  appt_reminder1h: 'Hi {{customer_name}},\n\nYour test drive for {{vehicle}} starts in 1 hour at {{time}} — {{location}}.\n\nSee you soon!',
  deal_finalized:  'Hi {{customer_name}},\n\nCongratulations! Your deal for the {{vehicle}} has been finalized.\n\nDeal #: {{deal_number}}\nPurchase Method: {{purchase_method}}\nSale Price: EGP {{sale_price}}\n\nOur team will be in touch with next steps.',
  invoice_sent:    'Hi {{customer_name}},\n\nYour invoice is ready.\n\nInvoice #: {{invoice_number}}\nAmount Due: EGP {{amount}}\nDue Date: {{due_date}}\n\nPlease contact us if you have any questions.',
  payment_receipt: 'Hi {{customer_name}},\n\nWe have received your payment.\n\nAmount: EGP {{amount}}\nDate: {{payment_date}}\nRemaining Balance: EGP {{remaining_balance}}\n\nThank you!',
  password_reset:  'Hi {{user_name}},\n\nYour password reset code is:\n\n{{reset_code}}\n\nThis code expires in {{expiry_time}}.\n\nIf you did not request this, please contact support immediately.',
};

function EmailTemplatesTab() {
  const [selected, setSelected] = useState<string>(EMAIL_TEMPLATES[0].key);
  const [subjects, setSubjects] = useState<Record<string, string>>({ ...DEFAULT_SUBJECTS });
  const [bodies, setBodies] = useState<Record<string, string>>({ ...DEFAULT_BODY });
  const [saved, setSaved] = useState(false);
  const { isAr } = useLang();

  const tmpl = EMAIL_TEMPLATES.find((t) => t.key === selected)!;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
      {/* Template list */}
      <div style={{ width: '240px', flexShrink: 0 }}>
        <p className="section-label" style={{ marginBottom: '0.5rem' }}>{isAr ? 'القوالب' : 'Templates'}</p>
        {EMAIL_TEMPLATES.map((t) => (
          <button
            key={t.key}
            onClick={() => setSelected(t.key)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none',
              cursor: 'pointer', fontSize: '0.8125rem',
              background: selected === t.key ? 'color-mix(in srgb, var(--primary) 12%, var(--surface-2))' : 'transparent',
              color: selected === t.key ? 'var(--primary)' : 'var(--text-2)',
              fontWeight: selected === t.key ? 600 : 400,
              marginBottom: '0.125rem',
            }}
          >
            {isAr ? t.labelAr : t.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <form onSubmit={save} style={{ flex: 1 }}>
        <div className="card p-5" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)' }}>{isAr ? tmpl.labelAr : tmpl.label}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>{isAr ? tmpl.descAr : tmpl.desc}</p>
          </div>

          <div>
            <label className="input-label">{isAr ? 'سطر الموضوع' : 'Subject Line'}</label>
            <input
              className="input"
              value={subjects[selected] ?? ''}
              onChange={(e) => setSubjects((p) => ({ ...p, [selected]: e.target.value }))}
              placeholder={isAr ? 'موضوع الرسالة…' : 'Email subject…'}
            />
          </div>

          <div>
            <label className="input-label">{isAr ? 'نص الرسالة' : 'Body'}</label>
            <textarea
              className="input"
              rows={10}
              style={{ fontFamily: 'monospace', fontSize: '0.8125rem', resize: 'vertical' }}
              value={bodies[selected] ?? ''}
              onChange={(e) => setBodies((p) => ({ ...p, [selected]: e.target.value }))}
              placeholder={isAr ? 'نص الرسالة…' : 'Email body…'}
            />
          </div>

          {/* Variable palette */}
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.375rem' }}>{isAr ? 'المتغيرات المتاحة:' : 'Available variables:'}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {tmpl.vars.map((v) => (
                <code
                  key={v}
                  onClick={() => {
                    setBodies((p) => ({ ...p, [selected]: (p[selected] ?? '') + v }));
                  }}
                  style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--primary)', userSelect: 'none' }}
                  title={isAr ? 'انقر للإضافة' : 'Click to append'}
                >
                  {v}
                </code>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary">{isAr ? 'حفظ القالب' : 'Save Template'}</button>
            <button type="button" className="btn btn-secondary"
              onClick={() => {
                setSubjects((p) => ({ ...p, [selected]: DEFAULT_SUBJECTS[selected] }));
                setBodies((p) => ({ ...p, [selected]: DEFAULT_BODY[selected] }));
              }}
            >
              {isAr ? 'إعادة للافتراضي' : 'Reset to Default'}
            </button>
            {saved && <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>{isAr ? '✓ تم الحفظ' : '✓ Saved'}</span>}
          </div>
        </div>
      </form>
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
  const { isAr } = useLang();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div className="card p-5 space-y-4">
        <p className="section-label">{isAr ? 'سياسة كلمة المرور' : 'Password Policy'}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">{isAr ? 'الحد الأدنى للطول' : 'Minimum Length'}</label>
            <NumericInput min="6" max="32" className="input"
              value={policy.minLength}
              onChange={(val) => setPolicy((p) => ({ ...p, minLength: Number(val) }))} />
          </div>
          <div>
            <label className="input-label">{isAr ? 'مهلة الجلسة (دقيقة)' : 'Session Timeout (minutes)'}</label>
            <NumericInput min="5" max="1440" className="input"
              value={policy.sessionTimeout}
              onChange={(val) => setPolicy((p) => ({ ...p, sessionTimeout: Number(val) }))} />
          </div>
        </div>
        {([
          { k: 'requireUppercase', label: 'Require uppercase letters',  labelAr: 'يتطلب أحرفًا كبيرة'    },
          { k: 'requireNumbers',   label: 'Require numbers',            labelAr: 'يتطلب أرقامًا'          },
          { k: 'requireSymbols',   label: 'Require symbols (!@#$…)',    labelAr: 'يتطلب رموزًا (!@#$…)'  },
        ] as { k: keyof typeof policy; label: string; labelAr: string }[]).map(({ k, label, labelAr }) => (
          <label key={k} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!policy[k]}
              onChange={(e) => setPolicy((p) => ({ ...p, [k]: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{isAr ? labelAr : label}</span>
          </label>
        ))}
      </div>

      <div className="card p-5 space-y-3">
        <p className="section-label">{isAr ? 'إلزامية المصادقة الثنائية حسب الدور' : '2FA Enforcement by Role'}</p>
        {(['FINANCE', 'ADMIN', 'MANAGER'] as const).map((role) => (
          <div key={role} className="flex items-center justify-between">
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>
              {isAr
                ? (role === 'FINANCE' ? 'مالية' : role === 'ADMIN' ? 'مسؤول' : 'مدير')
                : role.charAt(0) + role.slice(1).toLowerCase().replace('_', ' ')}
            </span>
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

      {saved && <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)' }}>{isAr ? 'تم حفظ إعدادات الأمان.' : 'Security settings saved.'}</p>}
      <button type="submit" className="btn btn-primary">{isAr ? 'حفظ إعدادات الأمان' : 'Save Security Settings'}</button>
    </form>
  );
}

// ── Parameters Tab ────────────────────────────────────────────────────────
interface LookupItem { id: string; category: string; value: string; label: string; sortOrder: number; active: boolean; }

function DropdownListsTab() {
  const { data: raw, reload } = useQuery<LookupItem[]>('/lookup-items');
  const items: LookupItem[] = Array.isArray(raw) ? raw : [];
  const { isAr } = useLang();

  const [adding, setAdding] = useState<Record<string, string>>({}); // category → new label input
  const [editing, setEditing] = useState<Record<string, string>>({}); // id → label input
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const byCategory = Object.keys(CATEGORY_LABELS).reduce<Record<string, LookupItem[]>>((acc, cat) => {
    acc[cat] = items.filter((i) => i.category === cat && i.active).sort((a, b) => a.sortOrder - b.sortOrder);
    return acc;
  }, {});

  async function addItem(cat: string) {
    const label = (adding[cat] ?? '').trim();
    if (!label) return;
    setBusy(true); setErr('');
    try {
      await apiFetch('/lookup-items', { method: 'POST', body: JSON.stringify({ category: cat, value: label, label }) });
      setAdding((p) => ({ ...p, [cat]: '' }));
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }

  async function saveEdit(id: string) {
    const label = (editing[id] ?? '').trim();
    if (!label) return;
    setBusy(true); setErr('');
    try {
      await apiFetch(`/lookup-items/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) });
      setEditing((p) => { const n = { ...p }; delete n[id]; return n; });
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }

  async function removeItem(id: string) {
    if (!confirm(isAr ? 'حذف هذا العنصر؟' : 'Remove this item?')) return;
    setBusy(true); setErr('');
    try {
      await apiFetch(`/lookup-items/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)' }}>{isAr ? 'معاملات القوائم' : 'Parameters'}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
          {isAr ? 'إدارة قيم القوائم المنسدلة في نماذج السيارات عبر النظام.' : 'Manage the options available in vehicle form dropdowns across the system.'}
        </p>
      </div>

      {err && <p style={{ fontSize: '0.8125rem', color: 'var(--danger-fg)' }}>{err}</p>}

      {Object.entries(CATEGORY_LABELS).map(([cat, title]) => {
        const titleDisplay = isAr ? (CATEGORY_LABELS_AR[cat] ?? title) : title;
        return (
          <div key={cat} className="card" style={{ padding: '1rem 1.25rem' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '0.75rem' }}>{titleDisplay}</p>

            {/* Item rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
              {byCategory[cat]?.length === 0 && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', fontStyle: 'italic' }}>{isAr ? 'لا توجد عناصر.' : 'No items yet.'}</p>
              )}
              {byCategory[cat]?.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {editing[item.id] !== undefined ? (
                    <>
                      <input
                        className="input"
                        style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.8125rem' }}
                        value={editing[item.id]}
                        onChange={(e) => setEditing((p) => ({ ...p, [item.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') setEditing((p) => { const n={...p}; delete n[item.id]; return n; }); }}
                        autoFocus
                      />
                      <button className="btn btn-primary" style={{ padding: '0.3rem 0.625rem', fontSize: '0.75rem' }} disabled={busy} onClick={() => saveEdit(item.id)}>
                        {isAr ? 'حفظ' : 'Save'}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setEditing((p) => { const n={...p}; delete n[item.id]; return n; })}>
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-1)', padding: '0.3rem 0' }}>{item.label}</span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => setEditing((p) => ({ ...p, [item.id]: item.label }))}
                      >{isAr ? 'تعديل' : 'Edit'}</button>
                      <button
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem', cursor: 'pointer', color: 'var(--danger-fg)' }}
                        disabled={busy}
                        onClick={() => removeItem(item.id)}
                      >✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add row */}
            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.625rem', borderTop: '1px solid var(--border)' }}>
              <input
                className="input"
                style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.8125rem' }}
                placeholder={isAr ? 'عنصر جديد…' : `Add ${title.slice(0, -1).toLowerCase()}…`}
                value={adding[cat] ?? ''}
                onChange={(e) => setAdding((p) => ({ ...p, [cat]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem(cat); }}
              />
              <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8125rem' }} disabled={busy || !(adding[cat] ?? '').trim()} onClick={() => addItem(cat)}>
                {isAr ? '+ إضافة' : '+ Add'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Car Makes & Models Tab ────────────────────────────────────────────────────
interface CarMake {
  id: string; name: string; slug: string; logoUrl?: string; isActive: boolean;
  _count?: { models: number };
}
interface CarModel { id: string; name: string; isActive: boolean; }

function CarMakesModelsTab() {
  const { isAr } = useLang();
  const [selectedMake, setSelectedMake] = useState<CarMake | null>(null);
  const [showAddMake, setShowAddMake] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [editingMake, setEditingMake] = useState<CarMake | null>(null);
  const [makeName, setMakeName] = useState('');
  const [makeSlug, setMakeSlug] = useState('');
  const [makeLogoUrl, setMakeLogoUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [makeSearch, setMakeSearch] = useState('');

  const { data: makesRaw, loading: makesLoading, reload: reloadMakes } = useQuery<CarMake[]>('/settings/car-makes');
  const { data: modelsRaw, reload: reloadModels } = useQuery<CarModel[]>(
    selectedMake ? `/settings/car-makes/${selectedMake.id}/models` : null,
    [selectedMake?.id],
  );
  const makes = Array.isArray(makesRaw) ? makesRaw : [];
  const filteredMakes = makeSearch.trim()
    ? makes.filter(m => m.name.toLowerCase().includes(makeSearch.toLowerCase()))
    : makes;
  const models = Array.isArray(modelsRaw) ? modelsRaw : [];

  function slugify(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async function saveMake(e: React.FormEvent) {
    e.preventDefault();
    if (!makeName.trim()) return;
    setSaving(true); setErr('');
    try {
      const slug = makeSlug || slugify(makeName);
      const logoUrl = makeLogoUrl || `https://cdn.jsdelivr.net/npm/car-logos-dataset@2.2.0/src/${slug}/logo.png`;
      if (editingMake) {
        await apiFetch(`/settings/car-makes/${editingMake.id}`, { method: 'PATCH', body: JSON.stringify({ name: makeName, slug, logoUrl }) });
      } else {
        await apiFetch('/settings/car-makes', { method: 'POST', body: JSON.stringify({ name: makeName, slug, logoUrl }) });
      }
      setShowAddMake(false); setEditingMake(null); setMakeName(''); setMakeSlug(''); setMakeLogoUrl('');
      reloadMakes();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function toggleMake(make: CarMake) {
    await apiFetch(`/settings/car-makes/${make.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !make.isActive }) });
    reloadMakes();
  }

  async function saveModel(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMake || !modelName.trim()) return;
    setSaving(true); setErr('');
    try {
      await apiFetch(`/settings/car-makes/${selectedMake.id}/models`, { method: 'POST', body: JSON.stringify({ name: modelName }) });
      setShowAddModel(false); setModelName('');
      reloadModels();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function toggleModel(model: CarModel) {
    await apiFetch(`/settings/car-makes/models/${model.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !model.isActive }) });
    reloadModels();
  }

  function openEditMake(make: CarMake) {
    setEditingMake(make); setMakeName(make.name); setMakeSlug(make.slug); setMakeLogoUrl(make.logoUrl ?? '');
    setShowAddMake(true);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-1)' }}>{isAr ? 'الشركات المصنعة والطرازات' : 'Car Makes & Models'}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
            {isAr ? 'إدارة قوائم الماركات والطرازات المتاحة في نماذج إضافة السيارات.' : 'Manage the makes and models available in vehicle add forms.'}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingMake(null); setMakeName(''); setMakeSlug(''); setMakeLogoUrl(''); setShowAddMake(true); }}>
          {isAr ? '+ إضافة ماركة' : '+ Add Make'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedMake ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
        {/* Makes list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isAr ? 'الشركات المصنعة' : 'Makes'} ({makes.filter(m => m.isActive).length})
          </div>
          <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="input"
                style={{ paddingLeft: '2rem', fontSize: '0.8rem', height: '2rem' }}
                placeholder={isAr ? 'بحث عن ماركة…' : 'Search makes…'}
                value={makeSearch}
                onChange={e => setMakeSearch(e.target.value)}
              />
            </div>
          </div>
          {makesLoading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>Loading…</div>}
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {filteredMakes.map((make) => (
              <div key={make.id}
                onClick={() => setSelectedMake(selectedMake?.id === make.id ? null : make)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: selectedMake?.id === make.id ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : undefined,
                  opacity: make.isActive ? 1 : 0.45,
                }}>
                {/* Logo */}
                <div style={{ width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  {make.logoUrl
                    ? <img src={make.logoUrl} alt={make.name} style={{ width: 28, height: 28, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)' }}>{make.name[0]}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-1)' }}>{make.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{make._count?.models ?? 0} {isAr ? 'طراز' : 'models'}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button className="btn btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 5 }}
                    onClick={(e) => { e.stopPropagation(); openEditMake(make); }}>
                    {isAr ? 'تعديل' : 'Edit'}
                  </button>
                  <button className="btn btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: make.isActive ? 'color-mix(in srgb,var(--danger) 10%,transparent)' : 'color-mix(in srgb,var(--success) 10%,transparent)', border: `1px solid ${make.isActive ? 'color-mix(in srgb,var(--danger) 30%,transparent)' : 'color-mix(in srgb,var(--success) 30%,transparent)'}`, color: make.isActive ? 'var(--danger)' : 'var(--success)', borderRadius: 5 }}
                    onClick={(e) => { e.stopPropagation(); toggleMake(make); }}>
                    {make.isActive ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                  </button>
                </div>
              </div>
            ))}
            {filteredMakes.length === 0 && !makesLoading && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                {makeSearch.trim()
                  ? (isAr ? `لا توجد نتائج لـ "${makeSearch}"` : `No makes matching "${makeSearch}"`)
                  : (isAr ? 'لا توجد ماركات. ابدأ بإضافة ماركة.' : 'No makes yet. Add one to get started.')}
              </div>
            )}
          </div>
        </div>

        {/* Models list — shown when a make is selected */}
        {selectedMake && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {selectedMake.logoUrl && (
                  <img src={selectedMake.logoUrl} alt={selectedMake.name} style={{ width: 20, height: 20, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedMake.name} — {isAr ? 'الطرازات' : 'Models'} ({models.filter(m => m.isActive).length})
                </span>
              </div>
              <button className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem' }}
                onClick={() => { setModelName(''); setShowAddModel(true); }}>
                {isAr ? '+ طراز' : '+ Model'}
              </button>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {models.map((model) => (
                <div key={model.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', opacity: model.isActive ? 1 : 0.45 }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{model.name}</span>
                  <button className="btn btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: model.isActive ? 'color-mix(in srgb,var(--danger) 10%,transparent)' : 'color-mix(in srgb,var(--success) 10%,transparent)', border: `1px solid ${model.isActive ? 'color-mix(in srgb,var(--danger) 30%,transparent)' : 'color-mix(in srgb,var(--success) 30%,transparent)'}`, color: model.isActive ? 'var(--danger)' : 'var(--success)', borderRadius: 5 }}
                    onClick={() => toggleModel(model)}>
                    {model.isActive ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                  </button>
                </div>
              ))}
              {models.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                  {isAr ? 'لا توجد طرازات لهذه الماركة.' : 'No models for this make.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Make Modal */}
      {showAddMake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddMake(false)} />
          <div className="relative card shadow-2xl" style={{ maxWidth: 440, width: '100%', background: 'var(--surface)', zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{editingMake ? (isAr ? 'تعديل الماركة' : 'Edit Make') : (isAr ? 'إضافة ماركة جديدة' : 'Add New Make')}</h3>
              <button onClick={() => setShowAddMake(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem' }}>×</button>
            </div>
            <form onSubmit={saveMake} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'اسم الماركة *' : 'Make Name *'}</label>
                <input className="input" required value={makeName}
                  onChange={(e) => { setMakeName(e.target.value); if (!editingMake) setMakeSlug(slugify(e.target.value)); }}
                  placeholder="e.g. Toyota" autoFocus />
              </div>
              <div>
                <label className="input-label">{isAr ? 'الرابط المختصر (للشعار)' : 'Slug (for logo)'}</label>
                <input className="input" value={makeSlug} onChange={(e) => setMakeSlug(e.target.value)} placeholder="e.g. toyota, mercedes-benz" />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                  {isAr ? 'يُستخدم لجلب الشعار تلقائياً من CDN.' : 'Used to auto-fetch logo from CDN.'}
                </p>
              </div>
              {/* Logo preview */}
              {(makeSlug || makeLogoUrl) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={makeLogoUrl || `https://cdn.jsdelivr.net/npm/car-logos-dataset@2.2.0/src/${makeSlug}/logo.png`}
                      alt="logo preview" style={{ width: 40, height: 40, objectFit: 'contain' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{isAr ? 'معاينة الشعار' : 'Logo preview'}</div>
                </div>
              )}
              <div>
                <label className="input-label">{isAr ? 'رابط الشعار (اختياري)' : 'Logo URL (optional)'}</label>
                <input className="input" value={makeLogoUrl} onChange={(e) => setMakeLogoUrl(e.target.value)} placeholder="https://…" />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                  {isAr ? 'اتركه فارغاً لاستخدام الشعار التلقائي من CDN.' : 'Leave blank to use auto CDN logo.'}
                </p>
              </div>
              {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMake(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : editingMake ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إضافة' : 'Add Make')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Model Modal */}
      {showAddModel && selectedMake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddModel(false)} />
          <div className="relative card shadow-2xl" style={{ maxWidth: 380, width: '100%', background: 'var(--surface)', zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{isAr ? `إضافة طراز لـ ${selectedMake.name}` : `Add Model to ${selectedMake.name}`}</h3>
              <button onClick={() => setShowAddModel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem' }}>×</button>
            </div>
            <form onSubmit={saveModel} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'اسم الطراز *' : 'Model Name *'}</label>
                <input className="input" required value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. Corolla, Camry…" autoFocus />
              </div>
              {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModel(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : (isAr ? 'إضافة' : 'Add Model')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Accredited Dealers Tab ────────────────────────────────────────────────────
interface AccDealer {
  id: string; name: string; contactName?: string; contactPhone?: string; contactEmail?: string;
  carMakes: string[]; gracePeriodDays: number;
  monthlyTarget: number; minimumMonthly: number; targetBonus: number; kickbackPercent: number;
  agentCommissionOverride?: number | null;
  active: boolean;
}

const BLANK_DEALER: Omit<AccDealer, 'id' | 'active'> = {
  name: '', contactName: '', contactPhone: '', contactEmail: '',
  carMakes: [], gracePeriodDays: 30,
  monthlyTarget: 0, minimumMonthly: 0, targetBonus: 0, kickbackPercent: 0,
  agentCommissionOverride: null,
};

function AccreditedDealersTab() {
  const { data: rawDealers, reload: reloadDealers } = useQuery<AccDealer[]>('/accredited-dealers');
  const dealers: AccDealer[] = Array.isArray(rawDealers) ? rawDealers : [];
  const { isAr } = useLang();

  type LI = { id: string; value: string; label: string };
  const { data: rawMakes } = useQuery<LI[]>('/lookup-items?category=car_make');
  const makeOptions = (Array.isArray(rawMakes) ? rawMakes : []).map((m) => ({ value: m.value, label: m.label }));

  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK_DEALER>({ ...BLANK_DEALER });
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  function openNew() { setForm({ ...BLANK_DEALER }); setSelected(null); setIsNew(true); setErr(''); setSaved(false); }
  function openEdit(d: AccDealer) { setForm({ name: d.name, contactName: d.contactName ?? '', contactPhone: d.contactPhone ?? '', contactEmail: d.contactEmail ?? '', carMakes: d.carMakes ?? [], gracePeriodDays: d.gracePeriodDays, monthlyTarget: d.monthlyTarget, minimumMonthly: d.minimumMonthly, targetBonus: d.targetBonus, kickbackPercent: d.kickbackPercent, agentCommissionOverride: d.agentCommissionOverride ?? null }); setSelected(d.id); setIsNew(false); setErr(''); setSaved(false); }
  function setF(k: string, v: unknown) { setForm((p) => ({ ...p, [k]: v })); }

  async function save() {
    if (!form.name.trim()) { setErr(isAr ? 'اسم الوكيل مطلوب' : 'Dealer name required'); return; }
    setBusy(true); setErr('');
    try {
      if (isNew) {
        await apiFetch('/accredited-dealers', { method: 'POST', body: JSON.stringify(form) });
      } else {
        await apiFetch(`/accredited-dealers/${selected}`, { method: 'PATCH', body: JSON.stringify(form) });
      }
      setSaved(true); reloadDealers();
      if (isNew) { setSelected(null); setIsNew(false); setForm({ ...BLANK_DEALER }); }
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }

  async function deactivate(id: string) {
    if (!confirm(isAr ? 'تعطيل هذا الوكيل؟' : 'Deactivate this dealer?')) return;
    setBusy(true);
    try { await apiFetch(`/accredited-dealers/${id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }); reloadDealers(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }

  const editing = isNew || selected !== null;

  return (
    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

      {/* ── Dealer list ── */}
      <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.25rem' }} onClick={openNew}>
          {isAr ? '+ وكيل جديد' : '+ New Dealer'}
        </button>
        {dealers.filter((d) => d.active).length === 0 && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', padding: '0.5rem 0' }}>
            {isAr ? 'لا يوجد وكلاء معتمدون.' : 'No accredited dealers yet.'}
          </p>
        )}
        {dealers.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => openEdit(d)}
            style={{
              width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem',
              background: selected === d.id ? 'var(--info-bg)' : 'var(--surface-2)',
              border: `1px solid ${selected === d.id ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '0.5rem', cursor: 'pointer',
              opacity: d.active ? 1 : 0.45,
            }}
          >
            <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-1)' }}>{d.name}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>
              {d.carMakes.length ? d.carMakes.slice(0, 3).join(', ') + (d.carMakes.length > 3 ? ` +${d.carMakes.length - 3}` : '') : (isAr ? 'لا توجد شركات' : 'No makes set')}
            </p>
          </button>
        ))}
      </div>

      {/* ── Form panel ── */}
      {editing ? (
        <div className="card" style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-1)' }}>
            {isNew
              ? (isAr ? 'وكيل معتمد جديد' : 'New Accredited Dealer')
              : (isAr ? `تعديل — ${dealers.find((d) => d.id === selected)?.name ?? ''}` : `Edit — ${dealers.find((d) => d.id === selected)?.name ?? ''}`)}
          </p>

          {/* Basic info */}
          <div>
            <p className="section-label">{isAr ? 'معلومات الوكيل' : 'Dealer Info'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">{isAr ? 'اسم الوكيل / الشركة *' : 'Dealer / Company Name *'}</label>
                <input className="input" value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="Toyota Egypt S.A.E." />
              </div>
              <div>
                <label className="input-label">{isAr ? 'اسم الشخص المسؤول' : 'Contact Name'}</label>
                <input className="input" value={form.contactName} onChange={(e) => setF('contactName', e.target.value)} placeholder="Ahmed Hassan" />
              </div>
              <div>
                <label className="input-label">{isAr ? 'هاتف الشخص المسؤول' : 'Contact Phone'}</label>
                <input className="input" value={form.contactPhone} onChange={(e) => setF('contactPhone', e.target.value)} placeholder="+20 2 xxxx xxxx" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">{isAr ? 'بريد الشخص المسؤول' : 'Contact Email'}</label>
                <input type="email" className="input" value={form.contactEmail} onChange={(e) => setF('contactEmail', e.target.value)} placeholder="contact@dealer.com" />
              </div>
            </div>
          </div>

          {/* Car makes */}
          <div>
            <p className="section-label">{isAr ? 'شركات السيارات المزودة' : 'Car Makes Supplied'}</p>
            <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
              {form.carMakes.map((m) => (
                <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', background: 'var(--info-bg)', border: '1px solid var(--primary)', borderRadius: '999px', fontSize: '0.75rem', color: 'var(--primary)' }}>
                  {m}
                  <button type="button" onClick={() => setF('carMakes', form.carMakes.filter((x) => x !== m))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <SearchableCombobox
              options={makeOptions.filter((o) => !form.carMakes.includes(o.value))}
              value=""
              onChange={(v) => { if (v && !form.carMakes.includes(v)) setF('carMakes', [...form.carMakes, v]); }}
              placeholder={isAr ? 'إضافة شركة سيارات…' : 'Add a car make…'}
            />
          </div>

          {/* Commercial terms */}
          <div>
            <p className="section-label">{isAr ? 'الشروط التجارية' : 'Commercial Terms'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div>
                <label className="input-label">{isAr ? 'فترة السماح (أيام)' : 'Grace Period (days)'}</label>
                <NumericInput min="0" className="input" value={form.gracePeriodDays} onChange={(val) => setF('gracePeriodDays', Number(val))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>{isAr ? 'أيام قبل طلب الدفع الكامل' : 'Days before dealer requires full payment'}</p>
              </div>
              <div>
                <label className="input-label">{isAr ? 'نسبة العمولة (%)' : 'Kickback Commission (%)'}</label>
                <NumericInput min="0" step="0.01" className="input" value={form.kickbackPercent} onChange={(val) => setF('kickbackPercent', Number(val))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>{isAr ? '% من سعر الوكيل لكل سيارة مباعة' : '% of dealer price per car sold'}</p>
              </div>
            </div>
          </div>

          {/* Targets */}
          <div>
            <p className="section-label">{isAr ? 'الأهداف الشهرية' : 'Monthly Targets'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div>
                <label className="input-label">{isAr ? 'الهدف الشهري (سيارة)' : 'Monthly Target (cars)'}</label>
                <NumericInput min="0" className="input" value={form.monthlyTarget} onChange={(val) => setF('monthlyTarget', Number(val))} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'الحد الأدنى الشهري (سيارة)' : 'Minimum Monthly (cars)'}</label>
                <NumericInput min="0" className="input" value={form.minimumMonthly} onChange={(val) => setF('minimumMonthly', Number(val))} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'مكافأة الهدف (جنيه)' : 'Target Bonus (EGP)'}</label>
                <NumericInput min="0" className="input" value={form.targetBonus} onChange={(val) => setF('targetBonus', Number(val))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>{isAr ? 'مكافأة تُدفع عند تحقيق الهدف الشهري' : 'Bonus paid when monthly target met'}</p>
              </div>
              <div>
                <label className="input-label">{isAr ? 'تجاوز عمولة المندوب (جنيه) — اختياري' : 'Agent Commission Override (EGP) — optional'}</label>
                <NumericInput min="0" className="input" value={form.agentCommissionOverride ?? ''} onChange={(val) => setF('agentCommissionOverride', val === '' ? null : Number(val))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>{isAr ? 'إذا تم تحديده، يُستبدل مبلغ العمولة الأساسي لجميع صفقات سيارات هذا الوكيل' : 'If set, overrides the global base commission amount for all deals on this dealer\'s cars'}</p>
              </div>
            </div>
          </div>

          {err && <p style={{ fontSize: '0.8125rem', color: 'var(--danger-fg)' }}>{err}</p>}
          {saved && <p style={{ fontSize: '0.8125rem', color: 'var(--success-fg)' }}>✓ {isAr ? 'تم الحفظ' : 'Saved'}</p>}

          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? '…' : isNew ? (isAr ? 'إنشاء الوكيل' : 'Create Dealer') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
            </button>
            <button className="btn btn-secondary" onClick={() => { setSelected(null); setIsNew(false); }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            {!isNew && selected && (
              <button style={{ marginLeft: 'auto', fontSize: '0.8125rem', background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--danger-fg)' }} disabled={busy} onClick={() => deactivate(selected)}>
                {isAr ? 'تعطيل' : 'Deactivate'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ flex: 1, padding: '2.5rem', textAlign: 'center', color: 'var(--text-3)' }}>
          <p style={{ fontSize: '0.875rem' }}>
            {isAr
              ? <>اختر وكيلاً للتعديل، أو انقر على <strong>+ وكيل جديد</strong> لإضافة وكيل.</>
              : <>Select a dealer to edit, or click <strong>+ New Dealer</strong> to add one.</>}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeNav, setActiveNav] = useState<NavItem>('General');
  const { isAr } = useLang();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'إعدادات النظام' : 'System Settings'}</h1>
          <p className="page-subtitle">{isAr ? 'إعداد الشركة وقوالب البريد والتكاملات' : 'Company configuration, email templates & integrations'}</p>
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
                    background: activeNav === item ? 'var(--surface-2)' : 'transparent',
                    color: activeNav === item ? 'var(--tab-active)' : 'var(--text-2)',
                    borderInlineStart: activeNav === item ? '3px solid var(--tab-active)' : '3px solid transparent',
                    borderTop: 'none', borderRight: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'background 150ms, color 150ms',
                  }}
                >
                  {isAr ? (NAV_AR[item] ?? item) : item}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main style={{ flex: 1, minWidth: 0 }}>
            {activeNav === 'General'         && <GeneralTab />}
            {activeNav === 'Locations'       && <LocationsTab />}
            {activeNav === 'Branding'        && <BrandingTab />}
            {activeNav === 'Notifications'   && <NotificationsTab />}
            {activeNav === 'Email Templates' && <EmailTemplatesTab />}
            {activeNav === 'Integrations'    && <IntegrationsTab />}
            {activeNav === 'Security'        && <SecurityTab />}
            {activeNav === 'Parameters'         && <DropdownListsTab />}
            {activeNav === 'Car Makes & Models' && <CarMakesModelsTab />}
            {activeNav === 'Accredited Dealers' && <AccreditedDealersTab />}
          </main>
        </div>
      </div>
    </div>
  );
}
