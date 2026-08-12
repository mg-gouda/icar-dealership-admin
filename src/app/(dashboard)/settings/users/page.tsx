'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '../../../../lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface UserPermission { permissionKey: string; granted: boolean; }
interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  location?: { id: string; name: string };
  permissions?: UserPermission[];
}

interface Location { id: string; name: string; }

const ROLE_OPTS = [
  { value: 'SALES_REP',          label: 'Sales Rep'          },
  { value: 'TECHNICIAN',         label: 'Technician'         },
  { value: 'PARTS_STORE_KEEPER', label: 'Parts Store Keeper' },
  { value: 'SERVICE_RECEPTION',  label: 'Service Reception'  },
  { value: 'SERVICE_MANAGER',    label: 'Service Manager'    },
  { value: 'MANAGER',            label: 'Manager'            },
  { value: 'FINANCE',            label: 'Finance'            },
  { value: 'ADMIN',              label: 'Admin'              },
  { value: 'SUPER_ADMIN',        label: 'Super Admin'        },
];

const ROLE_OPTS_AR = [
  { value: 'SALES_REP',          label: 'مندوب مبيعات'        },
  { value: 'TECHNICIAN',         label: 'فني'                  },
  { value: 'PARTS_STORE_KEEPER', label: 'أمين مخزن قطع الغيار'},
  { value: 'SERVICE_RECEPTION',  label: 'استقبال الصيانة'      },
  { value: 'SERVICE_MANAGER',    label: 'مدير الصيانة'         },
  { value: 'MANAGER',            label: 'مدير'                 },
  { value: 'FINANCE',            label: 'مالية'                },
  { value: 'ADMIN',              label: 'مسؤول'                },
  { value: 'SUPER_ADMIN',        label: 'المسؤول الأعلى'       },
];

const ROLE_FILTER_OPTS    = [{ value: '', label: 'All Roles'    }, ...ROLE_OPTS];
const ROLE_FILTER_OPTS_AR = [{ value: '', label: 'كل الأدوار'  }, ...ROLE_OPTS_AR];

const STATUS_OPTS = [
  { value: '',     label: 'All Status' },
  { value: 'true', label: 'Active'     },
  { value: 'false',label: 'Inactive'   },
];
const STATUS_OPTS_AR = [
  { value: '',     label: 'كل الحالات' },
  { value: 'true', label: 'نشط'        },
  { value: 'false',label: 'غير نشط'    },
];

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN:        'badge badge-danger',
  ADMIN:              'badge badge-orange',
  FINANCE:            'badge badge-purple',
  MANAGER:            'badge badge-warning',
  SALES_REP:          'badge badge-info',
  TECHNICIAN:         'badge badge-info',
  PARTS_STORE_KEEPER: 'badge badge-warning',
  SERVICE_RECEPTION:  'badge badge-neutral',
  SERVICE_MANAGER:    'badge badge-success',
  CUSTOMER:           'badge badge-neutral',
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:        'Super Admin',
  ADMIN:              'Admin',
  FINANCE:            'Finance',
  MANAGER:            'Manager',
  SALES_REP:          'Sales Rep',
  TECHNICIAN:         'Technician',
  PARTS_STORE_KEEPER: 'Parts Keeper',
  SERVICE_RECEPTION:  'Svc Reception',
  SERVICE_MANAGER:    'Svc Manager',
  CUSTOMER:           'Customer',
};

const ROLE_LABEL_AR: Record<string, string> = {
  SUPER_ADMIN:        'المسؤول الأعلى',
  ADMIN:              'مسؤول',
  FINANCE:            'مالية',
  MANAGER:            'مدير',
  SALES_REP:          'مندوب مبيعات',
  TECHNICIAN:         'فني',
  PARTS_STORE_KEEPER: 'أمين مخزن',
  SERVICE_RECEPTION:  'استقبال الصيانة',
  SERVICE_MANAGER:    'مدير الصيانة',
  CUSTOMER:           'عميل',
};

// Module → permission list for Roles & Permissions tab
// type: 'action' = page/endpoint access; 'field' = field-level data access
const PERMISSION_MATRIX = [
  {
    module: 'Inventory',
    permissions: [
      { key: 'vehicle:view',        label: 'View Vehicles',               type: 'action' as const },
      { key: 'vehicle:create',      label: 'Add Vehicles',                type: 'action' as const },
      { key: 'vehicle:edit',        label: 'Edit Vehicles',               type: 'action' as const },
      { key: 'vehicle:delete',      label: 'Delete Vehicles',             type: 'action' as const },
      { key: 'vehicle:view-cost',   label: 'View Purchase Cost',          type: 'field'  as const },
      { key: 'vehicle:edit-price',  label: 'Edit Listed Price',           type: 'field'  as const },
      { key: 'vehicle:view-fees',   label: 'View Admin & Insurance Fees', type: 'field'  as const },
      { key: 'vehicle:edit-fees',   label: 'Edit Admin & Insurance Fees', type: 'field'  as const },
    ],
  },
  {
    module: 'Deals',
    permissions: [
      { key: 'deal:view',                      label: 'View Deals',                           type: 'action' as const },
      { key: 'deal:create',                    label: 'Create Deals',                         type: 'action' as const },
      { key: 'deal:finalize',                  label: 'Finalize Deals',                       type: 'action' as const },
      { key: 'deal:view-all-loc',              label: 'View All Locations',                   type: 'action' as const },
      { key: 'deal:view-bank-approval',        label: 'View Bank Approval Amount & Docs',     type: 'field'  as const },
      { key: 'deal:override-purchase-method',  label: 'Override Purchase Method (post-Draft)',type: 'field'  as const },
    ],
  },
  {
    module: 'CRM',
    permissions: [
      { key: 'crm:view',       label: 'View Leads',       type: 'action' as const },
      { key: 'crm:create',     label: 'Create Leads',     type: 'action' as const },
      { key: 'crm:assign',     label: 'Assign Leads',     type: 'action' as const },
      { key: 'crm:view-pii',   label: 'View Customer PII (National ID, Income)', type: 'field' as const },
    ],
  },
  {
    module: 'Finance',
    permissions: [
      { key: 'finance:view',            label: 'View Finance',           type: 'action' as const },
      { key: 'finance:post',            label: 'Post GL Entries',        type: 'action' as const },
      { key: 'finance:lock-period',     label: 'Lock Fiscal Period',     type: 'action' as const },
      { key: 'finance:view-invoice',    label: 'View Invoice Status',    type: 'action' as const },
      { key: 'finance:view-gl-detail',  label: 'View GL Line Detail',    type: 'field'  as const },
      { key: 'finance:view-tax-fields', label: 'View Tax & Account IDs', type: 'field'  as const },
    ],
  },
  {
    module: 'Settings',
    permissions: [
      { key: 'settings:view',  label: 'View Settings',  type: 'action' as const },
      { key: 'settings:edit',  label: 'Edit Settings',  type: 'action' as const },
      { key: 'users:manage',   label: 'Manage Users',   type: 'action' as const },
    ],
  },
];

const MODULE_AR: Record<string, string> = {
  'Inventory': 'المخزن',
  'Deals':     'الصفقات',
  'CRM':       'العملاء',
  'Finance':   'المالية',
  'Settings':  'الإعدادات',
};

const PERM_LABEL_AR: Record<string, string> = {
  // Actions
  'View Vehicles':    'عرض السيارات',
  'Add Vehicles':     'إضافة سيارات',
  'Edit Vehicles':    'تعديل السيارات',
  'Delete Vehicles':  'حذف السيارات',
  'View Deals':       'عرض الصفقات',
  'Create Deals':     'إنشاء صفقات',
  'Finalize Deals':   'إتمام الصفقات',
  'View All Locations': 'عرض كل الفروع',
  'View Leads':       'عرض العملاء',
  'Create Leads':     'إنشاء عملاء',
  'Assign Leads':     'تعيين العملاء',
  'View Finance':     'عرض المالية',
  'Post GL Entries':  'ترحيل قيود',
  'Lock Fiscal Period': 'قفل الفترة المالية',
  'View Invoice Status': 'عرض حالة الفاتورة',
  'View Settings':    'عرض الإعدادات',
  'Edit Settings':    'تعديل الإعدادات',
  'Manage Users':     'إدارة المستخدمين',
  // Fields
  'View Purchase Cost':               'عرض تكلفة الشراء',
  'Edit Listed Price':                'تعديل السعر المعلن',
  'View Admin & Insurance Fees':      'عرض رسوم الإدارة والتأمين',
  'Edit Admin & Insurance Fees':      'تعديل رسوم الإدارة والتأمين',
  'View Bank Approval Amount & Docs': 'عرض قيمة الموافقة البنكية والمستندات',
  'Override Purchase Method (post-Draft)': 'تغيير طريقة الشراء بعد المسودة',
  'View Customer PII (National ID, Income)': 'عرض البيانات الشخصية للعميل',
  'View GL Line Detail':   'عرض تفاصيل سطور القيود',
  'View Tax & Account IDs': 'عرض معرّفات الحسابات والضرائب',
};

// Which roles have which permissions by default (actions + field-level)
const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  SUPER_ADMIN:        new Set(PERMISSION_MATRIX.flatMap((m) => m.permissions.map((p) => p.key))),
  ADMIN:              new Set(PERMISSION_MATRIX.flatMap((m) => m.permissions.map((p) => p.key))),
  FINANCE:            new Set([
    'vehicle:view', 'vehicle:view-cost', 'vehicle:view-fees',
    'deal:view', 'deal:view-all-loc', 'deal:view-bank-approval', 'deal:override-purchase-method',
    'crm:view', 'crm:view-pii',
    'finance:view', 'finance:post', 'finance:view-invoice', 'finance:view-gl-detail', 'finance:view-tax-fields',
    'settings:view',
  ]),
  MANAGER:            new Set([
    'vehicle:view', 'vehicle:create', 'vehicle:edit', 'vehicle:view-cost', 'vehicle:edit-price', 'vehicle:view-fees',
    'deal:view', 'deal:create', 'deal:finalize', 'deal:view-all-loc',
    'crm:view', 'crm:create', 'crm:assign', 'crm:view-pii',
    'finance:view', 'finance:view-invoice',
    'settings:view',
  ]),
  SALES_REP:          new Set(['vehicle:view', 'deal:view', 'deal:create', 'crm:view', 'crm:create', 'finance:view-invoice']),
  TECHNICIAN:         new Set(['vehicle:view']),
  PARTS_STORE_KEEPER: new Set(['vehicle:view']),
  SERVICE_RECEPTION:  new Set(['vehicle:view', 'crm:view', 'crm:create']),
  SERVICE_MANAGER:    new Set(['vehicle:view', 'crm:view', 'crm:create', 'crm:assign', 'crm:view-pii', 'finance:view-invoice', 'settings:view']),
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
}

function timeAgo(iso?: string, isAr = false) {
  if (!iso) return isAr ? 'أبداً' : 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return isAr ? 'الآن' : 'Just now';
  if (m < 60)  return isAr ? `منذ ${m} د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return isAr ? `منذ ${h} س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return isAr ? `منذ ${d} ي` : `${d}d ago`;
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

// ── Per-user Permissions Tab ──────────────────────────────────────────────────
function UserPermissionsTab({ user }: { user: User }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { isAr } = useLang();

  const fetchPerms = useCallback(async () => {
    try {
      const u = await apiFetch<User>(`/users/${user.id}`);
      const map: Record<string, boolean> = {};
      (u.permissions ?? []).forEach((p) => { map[p.permissionKey] = p.granted; });
      setOverrides(map);
    } catch { /* silent */ }
  }, [user.id]);

  useEffect(() => { fetchPerms(); }, [fetchPerms]);

  async function toggle(key: string) {
    setBusy(key);
    try {
      if (key in overrides) {
        await apiFetch(`/users/${user.id}/permissions/${key}`, { method: 'DELETE' });
        setOverrides((p) => { const n = { ...p }; delete n[key]; return n; });
      } else {
        const defaultGranted = ROLE_PERMISSIONS[user.role]?.has(key) ?? false;
        const newGranted = !defaultGranted;
        await apiFetch(`/users/${user.id}/permissions`, {
          method: 'POST',
          body: JSON.stringify({ permissionKey: key, granted: newGranted }),
        });
        setOverrides((p) => ({ ...p, [key]: newGranted }));
      }
    } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(null); }
  }

  function PermRow({ perm }: { perm: typeof PERMISSION_MATRIX[0]['permissions'][0] }) {
    const roleDefault = ROLE_PERMISSIONS[user.role]?.has(perm.key) ?? false;
    const hasOverride = perm.key in overrides;
    const effective = hasOverride ? overrides[perm.key] : roleDefault;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontWeight: 500 }}>{isAr ? (PERM_LABEL_AR[perm.label] ?? perm.label) : perm.label}</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 1 }}>
            {hasOverride
              ? <span style={{ color: effective ? 'var(--success-fg)' : 'var(--danger-fg)', fontWeight: 600 }}>
                  {isAr ? (effective ? 'تجاوز: ممنوح' : 'تجاوز: مرفوض') : (effective ? 'Override: Granted' : 'Override: Denied')}
                </span>
              : <span>{isAr ? (roleDefault ? 'افتراضي: ممنوح' : 'افتراضي: مرفوض') : (roleDefault ? 'Role default: Granted' : 'Role default: Denied')}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <button
            disabled={busy === perm.key}
            onClick={() => toggle(perm.key)}
            style={{
              width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: effective ? 'var(--success)' : 'var(--border-strong)',
              position: 'relative', transition: 'background 0.15s', opacity: busy === perm.key ? 0.5 : 1,
            }}
            title={isAr
              ? (hasOverride ? 'انقر لإزالة التجاوز' : 'انقر لإضافة تجاوز')
              : (hasOverride ? 'Click to remove override (revert to role default)' : 'Click to add override')}
          >
            <span style={{
              position: 'absolute', top: 3, left: effective ? 18 : 3,
              width: 14, height: 14, borderRadius: '50%', background: '#fff',
              transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }} />
          </button>
          {hasOverride && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 5px', borderRadius: 4 }}>
              {isAr ? 'تجاوز' : 'OVERRIDE'}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem 0', maxHeight: 460, overflowY: 'auto' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem', padding: '0 1.25rem' }}>
        {isAr
          ? 'التجاوزات تُطبَّق فوق إعدادات الدور. الصلاحيات مقسّمة إلى إجراءات (وصول للصفحات) وحقول (وصول للبيانات).'
          : 'Overrides apply on top of role defaults. Permissions split into Actions (page/endpoint access) and Fields (data-level access).'}
      </p>
      {PERMISSION_MATRIX.map((mod) => {
        const actions = mod.permissions.filter((p) => p.type === 'action');
        const fields  = mod.permissions.filter((p) => p.type === 'field');
        return (
          <div key={mod.module} style={{ marginBottom: '0.75rem' }}>
            {/* Module header */}
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase', padding: '0.35rem 1.25rem', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {isAr ? (MODULE_AR[mod.module] ?? mod.module) : mod.module}
            </p>

            {/* Actions sub-group */}
            {actions.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 1.25rem 0.2rem', background: 'var(--surface)' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--primary)', opacity: 0.7 }}>
                    {isAr ? 'الإجراءات' : 'Actions'}
                  </span>
                </div>
                {actions.map((perm) => <PermRow key={perm.key} perm={perm} />)}
              </>
            )}

            {/* Field-level sub-group */}
            {fields.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 1.25rem 0.2rem', background: 'var(--surface)' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'oklch(0.65 0.16 72)', opacity: 0.85 }}>
                    {isAr ? 'حقول البيانات' : 'Field Access'}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>
                    {isAr ? '— ما يمكن رؤيته/تعديله داخل الصفحة' : '— what data is visible/editable within the page'}
                  </span>
                </div>
                {fields.map((perm) => (
                  <div key={perm.key} style={{ background: 'oklch(0.65 0.16 72 / 0.03)' }}>
                    <PermRow perm={perm} />
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Working Hours (Schedule) Tab ─────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
interface WorkingHoursRow { dayOfWeek: number; startTime: string; endTime: string; }

function UserScheduleTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<WorkingHoursRow[]>(
    DAYS.map((_, i) => ({ dayOfWeek: i, startTime: '09:00', endTime: '17:00' }))
  );
  const [enabled, setEnabled] = useState<boolean[]>(Array(7).fill(false));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { isAr } = useLang();

  useEffect(() => {
    apiFetch<WorkingHoursRow[]>(`/users/${userId}/working-hours`)
      .then((data) => {
        if (data && data.length) {
          const map = Object.fromEntries(data.map((r) => [r.dayOfWeek, r]));
          setRows(DAYS.map((_, i) => map[i] ?? { dayOfWeek: i, startTime: '09:00', endTime: '17:00' }));
          const flags = Array(7).fill(false);
          data.forEach((r) => { flags[r.dayOfWeek] = true; });
          setEnabled(flags);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      await apiFetch(`/users/${userId}/working-hours`, {
        method: 'PATCH',
        body: JSON.stringify({ hours: rows.filter((_, i) => enabled[i]) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silent */ } finally { setSaving(false); }
  }

  if (loading) return <div className="p-5" style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>;

  return (
    <div className="p-5">
      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
        {isAr
          ? 'حدد أيام عمل هذا المستخدم وساعاته. تُستخدم لتحديد مواعيد المقابلات المتاحة.'
          : 'Set which days this user is available and their hours. Used for appointment slot availability.'}
      </p>
      <div className="space-y-2">
        {DAYS.map((day, i) => (
          <div key={i} className="flex items-center gap-3">
            <label className="flex items-center gap-2 w-14 shrink-0 cursor-pointer">
              <input type="checkbox" checked={enabled[i]}
                onChange={(e) => setEnabled((p) => p.map((v, j) => j === i ? e.target.checked : v))} />
              <span style={{ fontSize: '0.8125rem', color: enabled[i] ? 'var(--text-1)' : 'var(--text-3)' }}>{isAr ? DAYS_AR[i] : day}</span>
            </label>
            <input type="time" className="input" disabled={!enabled[i]}
              value={rows[i].startTime}
              onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, startTime: e.target.value } : r))}
              style={{ width: '7.5rem', opacity: enabled[i] ? 1 : 0.4 }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{isAr ? 'إلى' : 'to'}</span>
            <input type="time" className="input" disabled={!enabled[i]}
              value={rows[i].endTime}
              onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, endTime: e.target.value } : r))}
              style={{ width: '7.5rem', opacity: enabled[i] ? 1 : 0.4 }} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ minWidth: '8rem' }}>
          {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ الجدول' : 'Save Schedule')}
        </button>
        {saved && <span style={{ fontSize: '0.75rem', color: 'var(--success-fg)' }}>{isAr ? 'تم الحفظ ✓' : 'Saved ✓'}</span>}
      </div>
    </div>
  );
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
  const { isAr } = useLang();
  const [modalTab, setModalTab] = useState<'details' | 'permissions' | 'schedule' | 'security'>('details');
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
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

  const needs2fa = ['FINANCE', 'ADMIN', 'SUPER_ADMIN', 'SERVICE_MANAGER'].includes(form.role);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.password !== pwForm.confirm) { setPwMsg(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'); return; }
    if (pwForm.password.length < 8) { setPwMsg(isAr ? '8 أحرف على الأقل' : 'Minimum 8 characters'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      await apiFetch(`/users/${user!.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: pwForm.password }) });
      setPwMsg(isAr ? 'تم تغيير كلمة المرور ✓' : 'Password changed ✓');
      setPwForm({ password: '', confirm: '' });
    } catch (e: unknown) { setPwMsg(e instanceof Error ? e.message : String(e)); }
    finally { setPwSaving(false); }
  }

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

  const modalTabLabels = {
    details:     isAr ? 'الملف والدور'  : 'Profile & Role',
    permissions: isAr ? 'الصلاحيات'    : 'Permissions',
    schedule:    isAr ? 'الجدول'        : 'Schedule',
    security:    isAr ? 'الأمان'        : 'Security',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl card shadow-2xl" style={{ overflow: 'visible' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '0.9375rem' }}>
              {editing
                ? (isAr ? `تعديل ${user!.name}` : `Edit ${user!.name}`)
                : (isAr ? 'دعوة مستخدم جديد' : 'Invite New User')}
            </h2>
            {editing && <p className="page-subtitle">{user!.email}</p>}
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        {/* Modal tabs — only when editing */}
        {editing && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {(['details', 'permissions', 'schedule', 'security'] as const).map((t) => (
              <button key={t} onClick={() => setModalTab(t)}
                style={{
                  flex: 1, padding: '0.6rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: modalTab === t ? 'var(--surface)' : 'transparent',
                  color: modalTab === t ? 'var(--text-1)' : 'var(--text-3)',
                  borderBottom: modalTab === t ? '2px solid var(--primary)' : '2px solid transparent',
                  whiteSpace: 'nowrap',
                }}>
                {modalTabLabels[t]}
              </button>
            ))}
          </div>
        )}

        {(!editing || modalTab === 'details') && (
          <form onSubmit={submit} className="p-5 space-y-3">
            <div>
              <label className="input-label">{isAr ? 'الاسم الكامل *' : 'Full Name *'}</label>
              <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            {!editing && (
              <>
                <div>
                  <label className="input-label">{isAr ? 'البريد الإلكتروني *' : 'Email *'}</label>
                  <input required type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'كلمة المرور *' : 'Password *'}</label>
                  <input required type="password" minLength={8} className="input" value={form.password} onChange={(e) => set('password', e.target.value)} />
                </div>
              </>
            )}
            <div>
              <label className="input-label">{isAr ? 'الهاتف' : 'Phone'}</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <SearchableCombobox
              label={isAr ? 'الدور *' : 'Role *'}
              options={isAr ? ROLE_OPTS_AR : ROLE_OPTS}
              value={form.role}
              onChange={(v) => set('role', v)}
              placeholder={isAr ? 'اختر الدور' : 'Select role'}
            />
            <SearchableCombobox
              label={isAr ? 'الفرع *' : 'Location *'}
              options={locationOpts}
              value={form.locationId}
              onChange={(v) => set('locationId', v)}
              placeholder={isAr ? 'اختر الفرع' : 'Select location'}
              clearable
              clearLabel={isAr ? 'بدون فرع' : 'No location'}
            />
            {needs2fa && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--info-bg)', border: '1px solid var(--info-bg)' }}>
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--info-fg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span style={{ fontSize: '0.75rem', color: 'var(--info-fg)' }}>
                  {isAr
                    ? `المصادقة الثنائية مطلوبة لدور ${ROLE_LABEL_AR[form.role] ?? form.role} — ${editing && user?.role === form.role ? 'يجب على المستخدم التسجيل عبر الإعدادات' : 'سيُطلب منه عند أول تسجيل دخول'}`
                    : `2FA required for ${ROLE_LABEL[form.role]} role — ${editing && user?.role === form.role ? ' user must enrol via Settings' : ' will be prompted on first login'}`}
                </span>
              </div>
            )}
            {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{err}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                {saving ? '…' : editing ? (isAr ? 'حفظ التغييرات' : 'Save Changes') : (isAr ? 'إرسال الدعوة' : 'Send Invite')}
              </button>
            </div>
          </form>
        )}

        {editing && modalTab === 'permissions' && (
          <UserPermissionsTab user={user!} />
        )}
        {editing && modalTab === 'schedule' && (
          <UserScheduleTab userId={user!.id} />
        )}
        {editing && modalTab === 'security' && (
          <form onSubmit={changePassword} className="p-5 space-y-3">
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {isAr ? 'تغيير كلمة مرور هذا المستخدم. يجب أن تكون 8 أحرف على الأقل.' : "Change this user's password. Minimum 8 characters."}
            </p>
            <div>
              <label className="input-label">{isAr ? 'كلمة المرور الجديدة' : 'New Password'}</label>
              <input required type="password" minLength={8} className="input" value={pwForm.password}
                onChange={(e) => setPwForm((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
              <input required type="password" minLength={8} className="input" value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
            {pwMsg && (
              <p style={{ fontSize: '0.75rem', color: pwMsg.includes('✓') ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{pwMsg}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button type="submit" disabled={pwSaving} className="btn btn-primary" style={{ flex: 1 }}>
                {pwSaving ? '…' : (isAr ? 'تغيير كلمة المرور' : 'Change Password')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Roles & Permissions Tab ───────────────────────────────────────────────────
function RolesPermissionsTab() {
  const { isAr } = useLang();

  function CheckCell({ granted }: { granted: boolean }) {
    return (
      <td style={{ textAlign: 'center' }}>
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
  }

  return (
    <div className="space-y-4">
      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
        {isAr
          ? 'مصفوفة الصلاحيات الافتراضية حسب الدور. يمكن ضبط تجاوزات فردية لكل مستخدم عبر تبويب حسابات الموظفين.'
          : 'Default permission matrix by role. Individual overrides can be set per user via the Staff Accounts tab.'}
      </p>
      {PERMISSION_MATRIX.map((mod) => {
        const actions = mod.permissions.filter((p) => p.type === 'action');
        const fields  = mod.permissions.filter((p) => p.type === 'field');
        return (
          <div key={mod.module} className="card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <span className="section-label" style={{ marginBottom: 0 }}>{isAr ? (MODULE_AR[mod.module] ?? mod.module) : mod.module}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>{isAr ? 'الصلاحية' : 'Permission'}</th>
                  {(isAr ? ROLE_OPTS_AR : ROLE_OPTS).map((r) => (
                    <th key={r.value} style={{ textAlign: 'center' }}>
                      <span className={ROLE_BADGE[r.value] ?? 'badge badge-neutral'}>{r.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Actions section */}
                <tr>
                  <td colSpan={ROLE_OPTS.length + 1} style={{ padding: '0.25rem 1rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--primary)', background: 'var(--surface-2)', opacity: 0.8 }}>
                    {isAr ? 'الإجراءات' : 'Actions'}
                  </td>
                </tr>
                {actions.map((perm) => (
                  <tr key={perm.key}>
                    <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{isAr ? (PERM_LABEL_AR[perm.label] ?? perm.label) : perm.label}</td>
                    {ROLE_OPTS.map((r) => <CheckCell key={r.value} granted={ROLE_PERMISSIONS[r.value]?.has(perm.key) ?? false} />)}
                  </tr>
                ))}
                {/* Field access section */}
                {fields.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={ROLE_OPTS.length + 1} style={{ padding: '0.25rem 1rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'oklch(0.65 0.16 72)', background: 'oklch(0.65 0.16 72 / 0.05)', opacity: 0.9 }}>
                        {isAr ? 'حقول البيانات' : 'Field Access'}
                      </td>
                    </tr>
                    {fields.map((perm) => (
                      <tr key={perm.key} style={{ background: 'oklch(0.65 0.16 72 / 0.02)' }}>
                        <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{isAr ? (PERM_LABEL_AR[perm.label] ?? perm.label) : perm.label}</td>
                        {ROLE_OPTS.map((r) => <CheckCell key={r.value} granted={ROLE_PERMISSIONS[r.value]?.has(perm.key) ?? false} />)}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { isAr } = useLang();
  const [activeTab,    setActiveTab]    = useState<'users' | 'customers' | 'roles'>('users');
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [locFilter,    setLocFilter]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [custSearch,   setCustSearch]   = useState('');
  const [modalUser,    setModalUser]    = useState<User | null | 'new'>(null);
  const [toggling,     setToggling]     = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (roleFilter)   qs.set('role',       roleFilter);
  if (statusFilter) qs.set('isActive',   statusFilter);
  qs.set('limit', '200');

  const { data: res,       loading,   reload   } = useQuery<{ items?: User[]; data?: User[] } | User[]>(`/users?${qs}`);
  const { data: custRes,   loading: custLoading } = useQuery<{ items?: User[]; data?: User[] } | User[]>('/users?role=CUSTOMER&limit=500');
  const { data: locationsRaw }                    = useQuery<Location[]>('/locations');

  const allUsers: User[] = Array.isArray(res) ? res : (res as any)?.items ?? (res as any)?.data ?? [];
  const allCustomers: User[] = Array.isArray(custRes) ? custRes : (custRes as any)?.items ?? (custRes as any)?.data ?? [];

  // Client-side search + location filter (API filters role/status)
  const users = useMemo(() => {
    let list = allUsers.filter((u) => u.role !== 'CUSTOMER');
    if (search)    list = list.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
    if (locFilter) list = list.filter((u) => u.location?.id === locFilter);
    return list;
  }, [allUsers, search, locFilter]);

  const customers = useMemo(() => {
    if (!custSearch) return allCustomers;
    const q = custSearch.toLowerCase();
    return allCustomers.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone?.includes(q));
  }, [allCustomers, custSearch]);

  const locations = Array.isArray(locationsRaw) ? locationsRaw : [];
  const locationOpts = locations.map((l) => ({ value: l.id, label: l.name }));
  const locFilterOpts = [{ value: '', label: isAr ? 'كل الفروع' : 'All Locations' }, ...locationOpts];

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
          <h1 className="page-title">{isAr ? 'المستخدمون والصلاحيات' : 'Users & Permissions'}</h1>
          <p className="page-subtitle">{isAr ? 'إدارة الحسابات والأدوار وساعات العمل والصلاحيات' : 'Manage accounts, roles, working hours & permissions'}</p>
        </div>
        {activeTab === 'users' && (
          <button className="btn btn-primary" onClick={() => setModalUser('new')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {isAr ? 'دعوة مستخدم' : 'Invite User'}
          </button>
        )}
      </div>

      <div className="page-body space-y-4">
        {/* Tab strip */}
        <div className="tabs">
          <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            {isAr ? 'حسابات الموظفين' : 'Staff Accounts'}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
              {users.length}
            </span>
          </button>
          <button className={`tab ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
            {isAr ? 'العملاء' : 'Customers'}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
              {allCustomers.length}
            </span>
          </button>
          <button className={`tab ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
            {isAr ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
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
                  placeholder={isAr ? 'بحث بالاسم أو البريد…' : 'Search by name or email…'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ width: 160 }}>
                <SearchableCombobox
                  options={isAr ? ROLE_FILTER_OPTS_AR : ROLE_FILTER_OPTS}
                  value={roleFilter}
                  onChange={setRoleFilter}
                  placeholder={isAr ? 'كل الأدوار' : 'All Roles'}
                  clearable
                  clearLabel={isAr ? 'كل الأدوار' : 'All Roles'}
                />
              </div>
              <div style={{ width: 160 }}>
                <SearchableCombobox
                  options={locFilterOpts}
                  value={locFilter}
                  onChange={setLocFilter}
                  placeholder={isAr ? 'كل الفروع' : 'All Locations'}
                  clearable
                  clearLabel={isAr ? 'كل الفروع' : 'All Locations'}
                />
              </div>
              <div style={{ width: 140 }}>
                <SearchableCombobox
                  options={isAr ? STATUS_OPTS_AR : STATUS_OPTS}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder={isAr ? 'كل الحالات' : 'All Status'}
                  clearable
                  clearLabel={isAr ? 'كل الحالات' : 'All Status'}
                />
              </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
              {loading && !allUsers.length ? (
                <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-3)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'الموظف' : 'Staff Member'}</th>
                      <th>{isAr ? 'الدور' : 'Role'}</th>
                      <th>{isAr ? 'الفرع' : 'Branch'}</th>
                      <th>{isAr ? 'آخر تسجيل دخول' : 'Last Login'}</th>
                      <th>{isAr ? 'الحالة' : 'Status'}</th>
                      <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
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
                            {(isAr ? ROLE_LABEL_AR : ROLE_LABEL)[u.role] ?? u.role}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>
                          {u.location?.name ?? (isAr ? 'كل الفروع' : 'All Locations')}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{timeAgo(u.lastLogin, isAr)}</td>
                        <td>
                          {u.isActive !== false
                            ? <span className="badge badge-success">{isAr ? 'نشط' : 'Active'}</span>
                            : <span className="badge badge-neutral">{isAr ? 'غير نشط' : 'Inactive'}</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setModalUser(u)}
                            >
                              {isAr ? 'تعديل' : 'Edit'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={toggling === u.id}
                              onClick={() => deactivate(u)}
                              style={{ color: u.isActive !== false ? 'var(--danger-fg)' : 'var(--success-fg)' }}
                            >
                              {toggling === u.id
                                ? '…'
                                : u.isActive !== false
                                  ? (isAr ? 'تعطيل' : 'Deactivate')
                                  : (isAr ? 'تفعيل' : 'Activate')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-3)' }}>
                          {isAr ? 'لا يوجد مستخدمون مطابقون للفلاتر الحالية.' : 'No users match the current filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === 'customers' && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
                <svg className="w-4 h-4" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input className="input" style={{ paddingLeft: '2.25rem' }}
                  placeholder={isAr ? 'بحث بالاسم أو البريد أو الهاتف…' : 'Search by name, email or phone…'}
                  value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
              </div>
            </div>
            <div className="card overflow-hidden">
              {custLoading && !allCustomers.length ? (
                <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-3)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'العميل' : 'Customer'}</th>
                      <th>{isAr ? 'الهاتف' : 'Phone'}</th>
                      <th>{isAr ? 'تاريخ التسجيل' : 'Registered'}</th>
                      <th>{isAr ? 'آخر تسجيل دخول' : 'Last Login'}</th>
                      <th>{isAr ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar" style={{
                              width: 34, height: 34, fontSize: '0.75rem',
                              ...Object.fromEntries(avatarStyle(u.name).split(';').filter(Boolean).map((s) => s.split(':').map((p) => p.trim()) as [string, string])),
                            }}>
                              {initials(u.name)}
                            </div>
                            <div>
                              <p style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: '0.8125rem' }}>{u.name}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{u.phone ?? '—'}</td>
                        <td style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>
                          {(u as any).createdAt ? fmtDate((u as any).createdAt, isAr, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{timeAgo(u.lastLogin, isAr)}</td>
                        <td>
                          {u.isActive !== false
                            ? <span className="badge badge-success">{isAr ? 'نشط' : 'Active'}</span>
                            : <span className="badge badge-neutral">{isAr ? 'غير نشط' : 'Inactive'}</span>}
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 && !custLoading && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-3)' }}>
                          {custSearch
                            ? (isAr ? 'لا يوجد عملاء مطابقون لبحثك.' : 'No customers match your search.')
                            : (isAr ? 'لا يوجد عملاء مسجلون بعد.' : 'No registered customers yet.')}
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
