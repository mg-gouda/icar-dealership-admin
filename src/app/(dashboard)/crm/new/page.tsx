'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';

interface User { id: string; name: string; role: string; }
interface Location { id: string; name: string; city?: string; }
interface Vehicle { id: string; make: string; model: string; year: number; }

const SOURCES = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'WALK_IN', label: 'Walk-In' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'MARKETPLACE', label: 'Marketplace' },
  { value: 'OTHER', label: 'Other' },
];

const MAKES = ['Toyota', 'Hyundai', 'Kia', 'Suzuki', 'Nissan', 'BMW', 'Mercedes', 'Volkswagen', 'Mitsubishi', 'Renault', 'Peugeot', 'Chevrolet'].map((m) => ({ value: m, label: m }));

export default function NewLeadPage() {
  const router = useRouter();
  const { isAr } = useLang();
  const { data: usersRaw } = useQuery<User[]>('/users');
  const { data: locationsRaw } = useQuery<Location[]>('/locations');
  const { data: vehiclesRes } = useQuery<{ data: Vehicle[] }>('/vehicles?status=AVAILABLE&limit=200');

  const salesReps = (usersRaw ?? []).filter((u) => ['SALES_REP', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(u.role));
  const locations = Array.isArray(locationsRaw) ? locationsRaw : [];
  const vehicles = vehiclesRes?.data ?? [];

  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    source: 'WALK_IN', locationId: '',
    vehicleId: '', assignedToUserId: '',
    budget: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr(isAr ? 'الاسم الكامل مطلوب.' : 'Full name is required.'); return; }
    if (!form.phone.trim()) { setErr(isAr ? 'رقم الهاتف مطلوب.' : 'Phone is required.'); return; }
    if (!form.locationId) { setErr(isAr ? 'الفرع / الموقع مطلوب.' : 'Branch / Location is required.'); return; }
    setSaving(true); setErr('');
    try {
      const lead = await apiFetch<{ id: string }>('/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          source: form.source,
          locationId: form.locationId,
          vehicleId: form.vehicleId || undefined,
          assignedToUserId: form.assignedToUserId || undefined,
          notes: form.notes.trim() || undefined,
          budget: form.budget ? Number(form.budget) : undefined,
        }),
      });
      router.push(`/crm/${lead.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  const sourcesI18n = isAr ? [
    { value: 'WEBSITE', label: 'الموقع اللإليكتروني' },
    { value: 'PHONE', label: 'هاتف' },
    { value: 'WALK_IN', label: 'زيارة مباشرة' },
    { value: 'FACEBOOK', label: 'فيسبوك' },
    { value: 'REFERRAL', label: 'إحالة' },
    { value: 'MARKETPLACE', label: 'سوق إلكتروني' },
    { value: 'OTHER', label: 'أخرى' },
  ] : SOURCES;
  const repOpts = salesReps.map((u) => ({ value: u.id, label: u.name }));
  const locationOpts = locations.map((l) => ({ value: l.id, label: l.city ? `${l.name} — ${l.city}` : l.name }));
  const vehicleOpts = [
    { value: '', label: isAr ? 'لا مركبة محددة' : 'No specific vehicle' },
    ...vehicles.map((v) => ({ value: v.id, label: `${v.year} ${v.make} ${v.model}` })),
  ];

  return (
    <div style={{ padding: '1.25rem 1.5rem', maxWidth: '640px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Link href="/crm" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.75rem' }}>{isAr ? 'العملاء ←' : '← CRM'}</Link>
        <span style={{ color: 'var(--border-strong)' }}>›</span>
        <h1 className="page-title" style={{ margin: 0 }}>{isAr ? 'عميل محتمل جديد' : 'New Lead'}</h1>
      </div>

      {err && (
        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'var(--danger-bg)', borderColor: 'var(--danger)', color: 'var(--danger-fg)', fontSize: '0.8125rem' }}>
          {err}
        </div>
      )}

      <form onSubmit={submit}>
        {/* Contact info */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'معلومات التواصل' : 'Contact Information'}</p>
          <div style={{ marginBottom: '0.875rem' }}>
            <label className="input-label">{isAr ? 'الاسم الكامل *' : 'Full Name *'}</label>
            <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ahmed Hassan" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
            <div>
              <label className="input-label">{isAr ? 'الهاتف *' : 'Phone *'}</label>
              <input required className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="01X XXXX XXXX" />
            </div>
            <div>
              <label className="input-label">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={isAr ? 'اختياري' : 'optional'} />
            </div>
          </div>
        </div>

        {/* Lead details */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'تفاصيل العميل' : 'Lead Details'}</p>
          <div style={{ marginBottom: '0.875rem' }}>
            <label className="input-label">{isAr ? 'المصدر *' : 'Source *'}</label>
            <SearchableCombobox options={sourcesI18n} value={form.source} onChange={(v) => set('source', v)} />
          </div>
          <div style={{ marginBottom: '0.875rem' }}>
            <label className="input-label">{isAr ? 'الفرع / الموقع *' : 'Branch / Location *'}</label>
            <SearchableCombobox options={locationOpts} value={form.locationId} onChange={(v) => set('locationId', v)} placeholder={isAr ? 'اختر الفرع…' : 'Select branch…'} />
          </div>
          <div style={{ marginBottom: '0.875rem' }}>
            <label className="input-label">{isAr ? 'السيارة المطلوبة' : 'Vehicle Interested In'}</label>
            <SearchableCombobox options={vehicleOpts} value={form.vehicleId} onChange={(v) => set('vehicleId', v)} clearable clearLabel={isAr ? 'لا مركبة محددة' : 'No specific vehicle'} />
          </div>
          <div style={{ marginBottom: '0.875rem' }}>
            <label className="input-label">{isAr ? 'تعيين للمندوب' : 'Assign to Rep'}</label>
            <SearchableCombobox options={repOpts} value={form.assignedToUserId} onChange={(v) => set('assignedToUserId', v)} placeholder={isAr ? 'غير معين' : 'Unassigned'} clearable clearLabel={isAr ? 'غير معين' : 'Unassigned'} />
          </div>
          <div style={{ marginBottom: '0.875rem' }}>
            <label className="input-label">{isAr ? 'الميزانية (جنيه)' : 'Budget (EGP)'}</label>
            <input type="number" min="0" step="1000" className="input" value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="e.g. 500000" />
          </div>
          <div>
            <label className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
            <textarea className="textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={isAr ? 'ملاحظات أولية عن هذا العميل…' : 'Initial notes about this lead…'} style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
          <Link href="/crm" className="btn btn-secondary">{isAr ? 'إلغاء' : 'Cancel'}</Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ العميل' : 'Save Lead')}
          </button>
        </div>
      </form>
    </div>
  );
}
