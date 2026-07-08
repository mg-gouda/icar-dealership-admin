'use client';

import { useState, useEffect, useMemo } from 'react';
import SearchableCombobox from '@/components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? (localStorage.getItem('accessToken') ?? '') : ''}`,
});

/* ─── Types ───────────────────────────────────────────────────────────────── */
type ApptType = 'TEST_DRIVE' | 'CONSULTATION' | 'SERVICE';
type ApptStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

interface Appointment {
  id: string;
  type: ApptType;
  scheduledAt: string;
  customer?: { name: string };
  lead?: { name: string };
  vehicle?: { make: string; model: string; year: number };
  salesRep?: { name: string };
  status: ApptStatus;
  location?: { name: string };
  notes?: string;
}

/* ─── Demo fallback data ──────────────────────────────────────────────────── */
const DEMO: Appointment[] = [
  { id: '1', type: 'TEST_DRIVE',   scheduledAt: '2026-06-02T11:00:00', customer: { name: 'Sara Khalil' },     vehicle: { make: 'Toyota', model: 'Camry', year: 2024 }, salesRep: { name: 'Ahmed M.' }, status: 'SCHEDULED' },
  { id: '2', type: 'CONSULTATION', scheduledAt: '2026-06-02T14:30:00', customer: { name: 'Omar Hassan' },     salesRep: { name: 'Dina S.' }, status: 'SCHEDULED' },
  { id: '3', type: 'TEST_DRIVE',   scheduledAt: '2026-06-05T10:00:00', customer: { name: 'Nour Ibrahim' },    vehicle: { make: 'Kia', model: 'Sportage', year: 2025 }, salesRep: { name: 'Ahmed M.' }, status: 'COMPLETED' },
  { id: '4', type: 'SERVICE',      scheduledAt: '2026-06-05T09:00:00', customer: { name: 'Youssef Adel' },   salesRep: { name: 'Tarek R.' }, status: 'SCHEDULED' },
  { id: '5', type: 'CONSULTATION', scheduledAt: '2026-06-09T11:30:00', customer: { name: 'Hana Mostafa' },   salesRep: { name: 'Dina S.' }, status: 'SCHEDULED' },
  { id: '6', type: 'TEST_DRIVE',   scheduledAt: '2026-06-10T15:00:00', customer: { name: 'Kareem Fawzy' },   vehicle: { make: 'Hyundai', model: 'Tucson', year: 2024 }, salesRep: { name: 'Ahmed M.' }, status: 'SCHEDULED' },
  { id: '7', type: 'SERVICE',      scheduledAt: '2026-06-12T08:30:00', customer: { name: 'Laila Samir' },    salesRep: { name: 'Tarek R.' }, status: 'SCHEDULED' },
  { id: '8', type: 'TEST_DRIVE',   scheduledAt: '2026-06-16T13:00:00', customer: { name: 'Mohamed Rashad' }, vehicle: { make: 'Nissan', model: 'X-Trail', year: 2025 }, salesRep: { name: 'Ahmed M.' }, status: 'NO_SHOW' },
  { id: '9', type: 'CONSULTATION', scheduledAt: '2026-06-19T10:00:00', customer: { name: 'Rana Emad' },      salesRep: { name: 'Dina S.' }, status: 'SCHEDULED' },
  { id: '10', type: 'TEST_DRIVE',  scheduledAt: '2026-06-19T14:00:00', customer: { name: 'Tamer Gouda' },    vehicle: { make: 'BMW', model: 'X3', year: 2024 }, salesRep: { name: 'Ahmed M.' }, status: 'SCHEDULED' },
  { id: '11', type: 'SERVICE',     scheduledAt: '2026-06-23T09:30:00', customer: { name: 'Samar Wael' },     salesRep: { name: 'Tarek R.' }, status: 'SCHEDULED' },
  { id: '12', type: 'CONSULTATION',scheduledAt: '2026-06-25T12:00:00', customer: { name: 'Adel Fahmy' },     salesRep: { name: 'Dina S.' }, status: 'SCHEDULED' },
  { id: '13', type: 'TEST_DRIVE',  scheduledAt: '2026-06-26T11:00:00', customer: { name: 'Mariam Atef' },    vehicle: { make: 'Toyota', model: 'RAV4', year: 2025 }, salesRep: { name: 'Ahmed M.' }, status: 'SCHEDULED' },
  { id: '14', type: 'SERVICE',     scheduledAt: '2026-06-30T10:00:00', customer: { name: 'Sherif Nour' },    salesRep: { name: 'Tarek R.' }, status: 'SCHEDULED' },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const TYPE_COLOR: Record<ApptType, { bg: string; text: string }> = {
  TEST_DRIVE:   { bg: 'var(--primary)',  text: '#fff' },
  CONSULTATION: { bg: 'var(--success)',  text: '#fff' },
  SERVICE:      { bg: 'var(--orange)',   text: '#fff' },
};

const TYPE_LABEL: Record<ApptType, string> = {
  TEST_DRIVE:   'Test Drive',
  CONSULTATION: 'Consultation',
  SERVICE:      'Service',
};

const TYPE_LABEL_AR: Record<ApptType, string> = {
  TEST_DRIVE:   'اختبار قيادة',
  CONSULTATION: 'زيارة المعرض',
  SERVICE:      'صيانة',
};

type FilterType = 'all' | 'TEST_DRIVE' | 'CONSULTATION' | 'SERVICE';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_HEADERS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const STATUS_AR: Record<string, string> = {
  SCHEDULED: 'مجدول',
  CONFIRMED: 'مؤكد',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
  NO_SHOW: 'لم يحضر',
};

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function calendarCells(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startDow = first.getDay();
  const cells: Date[] = [];
  const start = new Date(first);
  start.setDate(first.getDate() - startDow);
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/* ─── Side panel for selected day ────────────────────────────────────────── */
function DayPanel({ date, appts, onClose }: { date: Date; appts: Appointment[]; onClose: () => void }) {
  const { isAr } = useLang();
  const label = date.toLocaleDateString(isAr ? 'ar-EG' : 'en-EG', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 360,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.9375rem' }}>{label}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
              {isAr ? `${appts.length} موعد` : `${appts.length} appointment${appts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ fontSize: '1rem', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {appts.length === 0 && (
            <p style={{ color: 'var(--text-3)', fontSize: '0.8125rem', textAlign: 'center', marginTop: '2rem' }}>
              {isAr ? 'لا توجد مواعيد هذا اليوم.' : 'No appointments this day.'}
            </p>
          )}
          {appts.map((a) => {
            const name = a.customer?.name ?? a.lead?.name ?? '—';
            const col = TYPE_COLOR[a.type];
            return (
              <div key={a.id} className="card" style={{ padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 9999, background: col.bg, color: col.text }}>
                    {isAr ? TYPE_LABEL_AR[a.type] : TYPE_LABEL[a.type]}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{fmtTime(a.scheduledAt)}</span>
                </div>
                <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>{name}</p>
                {a.vehicle && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: 2 }}>
                    {a.vehicle.year} {a.vehicle.make} {a.vehicle.model}
                  </p>
                )}
                {a.salesRep && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
                    {isAr ? `مندوب: ${a.salesRep.name}` : `Rep: ${a.salesRep.name}`}
                  </p>
                )}
                {a.notes && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>{a.notes}</p>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  <span className={`badge ${
                    a.status === 'COMPLETED' ? 'badge-success' :
                    a.status === 'CANCELLED' ? 'badge-danger' :
                    a.status === 'NO_SHOW'   ? 'badge-warning' : 'badge-info'
                  }`}>{isAr ? (STATUS_AR[a.status] ?? a.status.replace('_', ' ')) : a.status.replace('_', ' ')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── New Appointment slide-over ──────────────────────────────────────────── */
interface NewApptForm {
  type: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  vehicleDesc: string;
  repName: string;
  notes: string;
}

const BLANK_FORM: NewApptForm = {
  type: 'TEST_DRIVE', date: '', time: '', customerName: '',
  customerPhone: '', vehicleDesc: '', repName: '', notes: '',
};

const REP_OPTIONS = [
  { value: 'Ahmed M.', label: 'Ahmed M.' },
  { value: 'Dina S.',  label: 'Dina S.' },
  { value: 'Tarek R.', label: 'Tarek R.' },
];

const TYPE_OPTIONS = [
  { value: 'TEST_DRIVE',   label: 'Test Drive' },
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'SERVICE',      label: 'Service' },
];

function NewAppointmentPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { isAr } = useLang();
  const [form, setForm] = useState<NewApptForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function setField(k: keyof NewApptForm, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    if (!form.date || !form.time || !form.customerName) {
      setErr(isAr ? 'التاريخ والوقت واسم العميل مطلوبة.' : 'Date, time, and customer name are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await fetch(`${API}/appointments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          type: form.type,
          scheduledAt: new Date(`${form.date}T${form.time}`).toISOString(),
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          vehicleDesc: form.vehicleDesc,
          repName: form.repName,
          notes: form.notes,
        }),
      });
      onSaved();
      onClose();
    } catch {
      // ponytail: demo mode — just close
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 420,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.9375rem' }}>
            {isAr ? 'موعد جديد' : 'New Appointment'}
          </p>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {err && (
            <div style={{ padding: '0.625rem 0.875rem', background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: '0.4rem', fontSize: '0.8125rem' }}>
              {err}
            </div>
          )}

          {/* Type */}
          <div>
            <label className="input-label">{isAr ? 'نوع الموعد' : 'Appointment Type'}</label>
            <SearchableCombobox
              options={TYPE_OPTIONS}
              value={form.type}
              onChange={(v) => setField('type', v)}
              placeholder={isAr ? 'اختر النوع…' : 'Select type…'}
            />
          </div>

          {/* Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="input-label">{isAr ? 'التاريخ' : 'Date'}</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setField('date', e.target.value)} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'الوقت' : 'Time'}</label>
              <input type="time" className="input" value={form.time} onChange={(e) => setField('time', e.target.value)} />
            </div>
          </div>

          {/* Customer */}
          <div>
            <label className="input-label">{isAr ? 'اسم العميل' : 'Customer Name'}</label>
            <input className="input" placeholder="e.g. Sara Khalil" value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} />
          </div>
          <div>
            <label className="input-label">{isAr ? 'هاتف العميل' : 'Customer Phone'}</label>
            <input className="input" placeholder="+20 1XX XXX XXXX" value={form.customerPhone} onChange={(e) => setField('customerPhone', e.target.value)} />
          </div>

          {/* Vehicle — only for test drive */}
          {form.type === 'TEST_DRIVE' && (
            <div>
              <label className="input-label">{isAr ? 'السيارة' : 'Vehicle'}</label>
              <input className="input" placeholder="e.g. 2024 Toyota Camry" value={form.vehicleDesc} onChange={(e) => setField('vehicleDesc', e.target.value)} />
            </div>
          )}

          {/* Sales rep */}
          <div>
            <label className="input-label">{isAr ? 'مندوب المبيعات' : 'Sales Rep'}</label>
            <SearchableCombobox
              options={REP_OPTIONS}
              value={form.repName}
              onChange={(v) => setField('repName', v)}
              placeholder={isAr ? 'اختر مندوباً…' : 'Select rep…'}
              clearable
            />
          </div>

          {/* Notes */}
          <div>
            <label className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
            <textarea
              className="input"
              rows={3}
              style={{ resize: 'vertical' }}
              placeholder={isAr ? 'ملاحظات اختيارية…' : 'Optional notes…'}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ الموعد' : 'Save Appointment')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function AppointmentsPage() {
  const { isAr } = useLang();
  const [currentMonth, setCurrentMonth] = useState(() => new Date(2026, 5, 1)); // June 2026
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [appts, setAppts] = useState<Appointment[]>(DEMO);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showNewPanel, setShowNewPanel] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
    setLoading(true);
    fetch(`${API}/appointments?month=${y}-${m}&limit=200`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          const items: Appointment[] = Array.isArray(d) ? d : (d.items ?? []);
          if (items.length > 0) setAppts(items);
        }
      })
      .catch(() => {/* use demo */})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, refreshKey]);

  const filteredAppts = useMemo(() => {
    if (filterType === 'all') return appts;
    return appts.filter((a) => a.type === filterType);
  }, [appts, filterType]);

  const byDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    filteredAppts.forEach((a) => {
      const d = a.scheduledAt.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(a);
    });
    return map;
  }, [filteredAppts]);

  const cells = calendarCells(currentMonth);
  const today = isoDate(new Date());
  const monthLabel = `${isAr ? MONTHS_AR[currentMonth.getMonth()] : MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  function prevMonth() { setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }

  const dayAppts = selectedDay ? (byDate[isoDate(selectedDay)] ?? []) : [];

  const FILTER_PILLS: { key: FilterType; label: string }[] = [
    { key: 'all',          label: isAr ? 'كل الأنواع' : 'All Types' },
    { key: 'TEST_DRIVE',   label: isAr ? 'اختبار قيادة' : 'Test Drive' },
    { key: 'CONSULTATION', label: isAr ? 'زيارة المعرض' : 'Consultation' },
    { key: 'SERVICE',      label: isAr ? 'صيانة' : 'Service' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'المواعيد' : 'Appointments'}</h1>
          <p className="page-subtitle">June 2026 · Cairo Branch</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewPanel(true)}>
          {isAr ? '+ موعد جديد' : '+ New Appointment'}
        </button>
      </div>

      <div className="page-body">
        {/* Top bar: nav + view tabs + filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={prevMonth} className="btn btn-secondary btn-sm">{isAr ? 'السابق →' : '← Prev'}</button>
            <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.9375rem', minWidth: 110, textAlign: 'center' }}>{monthLabel}</span>
            <button onClick={nextMonth} className="btn btn-secondary btn-sm">{isAr ? '← التالي' : 'Next →'}</button>
          </div>

          {/* View mode tabs */}
          <div className="tabs" style={{ border: '1px solid var(--border)', borderRadius: '0.45rem', overflow: 'hidden', marginBottom: 0 }}>
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                className={`tab${viewMode === v ? ' active' : ''}`}
                style={{ borderBottom: 'none', padding: '0.4rem 0.875rem', textTransform: 'capitalize', fontSize: '0.8125rem' }}
                onClick={() => setViewMode(v)}
              >
                {isAr ? ({ day: 'يوم', week: 'أسبوع', month: 'شهر' })[v] : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {FILTER_PILLS.map((p) => (
              <button
                key={p.key}
                onClick={() => setFilterType(p.key)}
                style={{
                  padding: '0.3rem 0.8rem',
                  borderRadius: 9999,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  transition: 'all 150ms',
                  background: filterType === p.key ? 'var(--primary)' : 'var(--surface)',
                  color: filterType === p.key ? '#fff' : 'var(--text-2)',
                  borderColor: filterType === p.key ? 'var(--primary)' : 'var(--border)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <p style={{ color: 'var(--text-3)', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            {isAr ? 'جاري تحميل المواعيد…' : 'Loading appointments…'}
          </p>
        )}

        {/* Calendar month grid */}
        {viewMode === 'month' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Day-of-week headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
              {(isAr ? DAY_HEADERS_AR : DAY_HEADERS).map((d) => (
                <div key={d} style={{
                  textAlign: 'center', padding: '0.625rem 0',
                  fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--text-3)',
                  background: 'var(--surface-2)',
                  borderRight: '1px solid var(--border)',
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((cell, idx) => {
                const key = isoDate(cell);
                const inMonth = cell.getMonth() === currentMonth.getMonth();
                const isToday = key === today;
                const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;
                const dayApptList = byDate[key] ?? [];

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDay(cell)}
                    style={{
                      minHeight: 108,
                      padding: '0.5rem',
                      background: isToday ? 'oklch(0.95 0.055 265 / 0.5)' : isWeekend && inMonth ? 'var(--surface-2)' : 'var(--surface)',
                      borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={(e) => { if (!isToday) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = isToday
                        ? 'oklch(0.95 0.055 265 / 0.5)'
                        : isWeekend && inMonth ? 'var(--surface-2)' : 'var(--surface)';
                    }}
                  >
                    {/* Date number */}
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 4 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: isToday ? 700 : 500,
                        background: isToday ? 'var(--primary)' : 'transparent',
                        color: isToday ? '#fff' : inMonth ? 'var(--text-1)' : 'var(--text-3)',
                      }}>
                        {cell.getDate()}
                      </span>
                    </div>

                    {/* Appointment pills */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayApptList.slice(0, 3).map((a) => {
                        const col = TYPE_COLOR[a.type];
                        const personName = a.customer?.name ?? a.lead?.name ?? '—';
                        const firstName = personName.split(' ')[0];
                        return (
                          <div
                            key={a.id}
                            title={`${fmtTime(a.scheduledAt)} · ${isAr ? TYPE_LABEL_AR[a.type] : TYPE_LABEL[a.type]} — ${personName}`}
                            style={{
                              background: col.bg, color: col.text,
                              fontSize: '0.6rem', fontWeight: 600,
                              padding: '1px 5px', borderRadius: 4,
                              lineHeight: '1.5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              opacity: a.status === 'CANCELLED' ? 0.45 : 1,
                            }}
                          >
                            {fmtTime(a.scheduledAt)} {isAr ? TYPE_LABEL_AR[a.type] : TYPE_LABEL[a.type]} — {firstName}
                          </div>
                        );
                      })}
                      {dayApptList.length > 3 && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', paddingLeft: 2 }}>
                          {isAr ? `+${dayApptList.length - 3} أكثر` : `+${dayApptList.length - 3} more`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week view */}
        {viewMode === 'week' && (
          <WeekView currentMonth={currentMonth} byDate={byDate} today={today} onDayClick={setSelectedDay} />
        )}

        {/* Day view */}
        {viewMode === 'day' && (
          <DayListView date={new Date()} byDate={byDate} onDayClick={setSelectedDay} />
        )}
      </div>

      {selectedDay && (
        <DayPanel date={selectedDay} appts={dayAppts} onClose={() => setSelectedDay(null)} />
      )}

      {showNewPanel && (
        <NewAppointmentPanel
          onClose={() => setShowNewPanel(false)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

/* ─── Week view ───────────────────────────────────────────────────────────── */
function WeekView({ currentMonth, byDate, today, onDayClick }: {
  currentMonth: Date; byDate: Record<string, Appointment[]>; today: string; onDayClick: (d: Date) => void;
}) {
  const { isAr } = useLang();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(currentMonth);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
  const prevWeek = () => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
  const nextWeek = () => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <button onClick={prevWeek} className="btn btn-secondary btn-sm">{isAr ? '→ الأسبوع السابق' : '← Prev Week'}</button>
        <button onClick={nextWeek} className="btn btn-secondary btn-sm">{isAr ? 'الأسبوع التالي ←' : 'Next Week →'}</button>
      </div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', overflow: 'hidden' }}>
        {days.map((day, idx) => {
          const key = isoDate(day);
          const isToday = key === today;
          const apptList = byDate[key] ?? [];
          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              style={{
                minHeight: 140, padding: '0.75rem 0.625rem',
                borderRight: idx < 6 ? '1px solid var(--border)' : 'none',
                background: isToday ? 'oklch(0.95 0.055 265 / 0.4)' : 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-3)', display: 'block', textTransform: 'uppercase' }}>
                  {(isAr ? DAY_HEADERS_AR : DAY_HEADERS)[day.getDay()]}
                </span>
                <span style={{ fontSize: '1.125rem', fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text-1)' }}>
                  {day.getDate()}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {apptList.slice(0, 4).map((a) => {
                  const col = TYPE_COLOR[a.type];
                  return (
                    <div key={a.id} style={{
                      background: col.bg, color: col.text,
                      fontSize: '0.6rem', fontWeight: 600, padding: '2px 5px', borderRadius: 3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {fmtTime(a.scheduledAt)} {a.customer?.name?.split(' ')[0] ?? '—'}
                    </div>
                  );
                })}
                {apptList.length > 4 && <span style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>{isAr ? `+${apptList.length - 4} أكثر` : `+${apptList.length - 4} more`}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Day list view ───────────────────────────────────────────────────────── */
function DayListView({ date, byDate, onDayClick }: {
  date: Date; byDate: Record<string, Appointment[]>; onDayClick: (d: Date) => void;
}) {
  const { isAr } = useLang();
  const key = isoDate(date);
  const apptList = byDate[key] ?? [];
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>
          {date.toLocaleDateString(isAr ? 'ar-EG' : 'en-EG', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
          {isAr ? `${apptList.length} موعد` : `${apptList.length} appointment${apptList.length !== 1 ? 's' : ''}`}
        </span>
      </div>
      {apptList.length === 0 && (
        <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.875rem' }}>
          {isAr ? 'لا توجد مواعيد اليوم.' : 'No appointments today.'}
        </p>
      )}
      {apptList.map((a) => {
        const col = TYPE_COLOR[a.type];
        return (
          <div key={a.id} onClick={() => onDayClick(date)} style={{
            padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
          }}>
            <div style={{ width: 3, height: 40, borderRadius: 9999, background: col.bg, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>
                  {a.customer?.name ?? a.lead?.name ?? '—'}
                </span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: 9999, background: col.bg, color: col.text }}>
                  {isAr ? TYPE_LABEL_AR[a.type] : TYPE_LABEL[a.type]}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                {fmtTime(a.scheduledAt)}{a.vehicle ? ` · ${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : ''}{a.salesRep ? ` · ${a.salesRep.name}` : ''}
              </p>
            </div>
            <span className={`badge ${a.status === 'COMPLETED' ? 'badge-success' : a.status === 'CANCELLED' ? 'badge-danger' : a.status === 'NO_SHOW' ? 'badge-warning' : 'badge-info'}`}>
              {isAr ? (STATUS_AR[a.status] ?? a.status.replace('_', ' ')) : a.status.replace('_', ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
