'use client';

import { useState, useEffect } from 'react';
import SearchableCombobox from '@/components/ui/SearchableCombobox';
import NumericInput from '@/components/ui/NumericInput';
import { apiFetch } from '@/lib/useApi';
import { useLang } from '@/lib/lang-context';

/* ── types ──────────────────────────────────────────────────────────────── */
interface AttainmentRow {
  repId: string;
  repName: string;
  targetUnits: number;
  actualUnits: number;
  targetRevenue: number;
  actualRevenue: number;
}

interface SalesTarget {
  id: string;
  userId: string;
  user?: { name: string };
  locationId: string;
  location?: { name: string };
  period: string;
  targetUnits: number;
  targetRevenue: number;
}

interface User     { id: string; name: string; }
interface Location { id: string; name: string; }


/* ── helpers ────────────────────────────────────────────────────────────── */
function fmtEGP(n: number) {
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `EGP ${(n / 1_000).toFixed(0)}K`;
  return `EGP ${n.toLocaleString()}`;
}
function pct(actual: number, target: number) {
  return target > 0 ? Math.round((actual / target) * 100) : 0;
}
function rowBg(up: number, rp: number): string {
  if (up >= 100 && rp >= 100) return 'rgba(34,197,94,0.06)';
  if (up < 50    || rp < 50 ) return 'rgba(245,158,11,0.06)';
  return 'transparent';
}

/* ── ProgressBar ────────────────────────────────────────────────────────── */
function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ width: 100, height: 6, background: 'var(--border)', borderRadius: 9999, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{
        height: '100%', width: `${Math.min(value, 100)}%`,
        background: 'var(--primary)', borderRadius: 9999,
        transition: 'width 400ms ease',
      }} />
    </div>
  );
}

/* ── AttainBadge ────────────────────────────────────────────────────────── */
function AttainBadge({ up, rp }: { up: number; rp: number }) {
  const { isAr } = useLang();
  if (up >= 100 && rp >= 100) return <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success-fg)' }}>{isAr ? 'في المسار' : 'On Target'}</span>;
  if (up < 50    || rp < 50 ) return <span className="badge badge-warning">{isAr ? 'في خطر' : 'At Risk'}</span>;
  return <span className="badge badge-info">{isAr ? 'قيد التنفيذ' : 'In Progress'}</span>;
}

/* ── SetTargetModal ──────────────────────────────────────────────────────── */
interface ModalProps {
  reps: User[]; locations: Location[]; defaultPeriod: string;
  onClose: () => void; onCreated: () => void;
}

function SetTargetModal({ reps, locations, defaultPeriod, onClose, onCreated }: ModalProps) {
  const { isAr } = useLang();
  const [form, setForm] = useState({ userId: '', locationId: '', period: defaultPeriod, targetUnits: '', targetRevenue: '' });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const repOpts = reps.map(r => ({ value: r.id, label: r.name }));
  const locOpts = locations.map(l => ({ value: l.id, label: l.name }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.userId || !form.locationId || !form.period) { setErr(isAr ? 'جميع الحقول مطلوبة' : 'All fields required'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/sales-targets', {
        method: 'POST',
        body: JSON.stringify({
          userId: form.userId, locationId: form.locationId, period: form.period,
          targetUnits: Number(form.targetUnits), targetRevenue: Number(form.targetRevenue),
        }),
      });
      onCreated(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem', width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-1)' }}>{isAr ? 'تحديد هدف المبيعات' : 'Set Sales Target'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label className="input-label">{isAr ? 'مندوب المبيعات' : 'Sales Rep'}</label>
            <SearchableCombobox options={repOpts} value={form.userId} onChange={v => setForm(f => ({ ...f, userId: v }))} placeholder={isAr ? 'اختر المندوب…' : 'Select rep…'} />
          </div>
          <div>
            <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
            <SearchableCombobox options={locOpts} value={form.locationId} onChange={v => setForm(f => ({ ...f, locationId: v }))} placeholder={isAr ? 'اختر الفرع…' : 'Select location…'} />
          </div>
          <div>
            <label className="input-label">{isAr ? 'الفترة' : 'Period'}</label>
            <input type="month" className="input" value={form.period}
              onChange={e => setForm(f => ({ ...f, period: e.target.value }))} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="input-label">{isAr ? 'هدف الوحدات' : 'Target Units'}</label>
              <NumericInput className="input" min="0" placeholder="0"
                value={form.targetUnits} onChange={val => setForm(f => ({ ...f, targetUnits: val }))} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'هدف الإيرادات (ج.م)' : 'Target Revenue (EGP)'}</label>
              <NumericInput className="input" min="0" placeholder="0"
                value={form.targetRevenue} onChange={val => setForm(f => ({ ...f, targetRevenue: val }))} />
            </div>
          </div>
          {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'تحديد الهدف' : 'Set Target')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────────────────── */
export default function SalesTargetsPage() {
  const { isAr } = useLang();
  const now = new Date();
  // ponytail: default to current YYYY-MM
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [period,     setPeriod]     = useState(defaultPeriod);
  const [locationId, setLocationId] = useState('');
  const [attainment, setAttainment] = useState<AttainmentRow[]>([]);
  const [targets,    setTargets]    = useState<SalesTarget[]>([]);
  const [reps,       setReps]       = useState<User[]>([]);
  const [locations,  setLocations]  = useState<Location[]>([]);
  const [showModal,  setShowModal]  = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editForm,   setEditForm]   = useState({ targetUnits: 0, targetRevenue: 0 });
  const [savingEdit, setSavingEdit] = useState(false);

  // load lookups once
  useEffect(() => {
    apiFetch<{ items: User[] } | User[]>('/users?role=SALES_REP&limit=100')
      .then(d => setReps(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
    apiFetch<{ items: Location[] } | Location[]>('/locations')
      .then(d => setLocations(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
  }, []);

  function loadAttainment() {
    const qs = new URLSearchParams({ period });
    if (locationId) qs.set('locationId', locationId);
    apiFetch<{ items: AttainmentRow[] } | AttainmentRow[]>(`/sales-targets/attainment?${qs}`)
      .then(d => setAttainment(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
  }

  function loadTargets() {
    const qs = new URLSearchParams({ period });
    if (locationId) qs.set('locationId', locationId);
    apiFetch<{ items: SalesTarget[] } | SalesTarget[]>(`/sales-targets?${qs}`)
      .then(d => setTargets(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
  }

  useEffect(() => { loadAttainment(); loadTargets(); }, [period, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(t: SalesTarget) {
    setEditingId(t.id);
    setEditForm({ targetUnits: t.targetUnits, targetRevenue: t.targetRevenue });
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    try {
      await apiFetch(`/sales-targets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ targetUnits: editForm.targetUnits, targetRevenue: editForm.targetRevenue }),
      });
      setEditingId(null);
      loadTargets(); loadAttainment();
    } catch {/* ignore — ponytail: keep editing open on err */}
    finally { setSavingEdit(false); }
  }

  const locOpts = [{ value: '', label: isAr ? 'جميع الفروع' : 'All Locations' }, ...locations.map(l => ({ value: l.id, label: l.name }))];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'أهداف المبيعات' : 'Sales Targets'}</h1>
          <p className="page-subtitle">{isAr ? 'الإنجاز الشهري حسب مندوب المبيعات' : 'Monthly attainment by sales representative'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* period picker */}
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{
              padding: '0.375rem 0.625rem', borderRadius: '0.375rem', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-1)', fontSize: '0.8125rem', outline: 'none',
            }}
          />
          {/* location filter */}
          <div style={{ width: 180 }}>
            <SearchableCombobox
              options={locOpts}
              value={locationId}
              onChange={setLocationId}
              placeholder={isAr ? 'جميع الفروع' : 'All Locations'}
              clearable
              clearLabel={isAr ? 'جميع الفروع' : 'All Locations'}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            {isAr ? '+ تحديد الأهداف' : '+ Set Targets'}
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* attainment table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>{isAr ? 'الإنجاز —' : 'Attainment —'}{' '}
              <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{period}</span>
            </p>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(34,197,94,0.25)', display: 'inline-block', border: '1px solid rgba(34,197,94,0.4)' }} />
                {isAr ? 'كلاهما ≥100%' : 'Both ≥100%'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(245,158,11,0.25)', display: 'inline-block', border: '1px solid rgba(245,158,11,0.4)' }} />
                {isAr ? 'أحدهما <50%' : 'Either <50%'}
              </span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'اسم المندوب' : 'Rep Name'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'هدف الوحدات' : 'Target Units'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'الوحدات الفعلية' : 'Actual Units'}</th>
                <th>{isAr ? 'نسبة الوحدات' : 'Units %'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'هدف الإيرادات' : 'Target Revenue'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'الإيرادات الفعلية' : 'Actual Revenue'}</th>
                <th>{isAr ? 'نسبة الإيرادات' : 'Revenue %'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {attainment.map(row => {
                const up = pct(row.actualUnits, row.targetUnits);
                const rp = pct(row.actualRevenue, row.targetRevenue);
                return (
                  <tr key={row.repId} style={{ background: rowBg(up, rp) }}>
                    <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{row.repName}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.targetUnits}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-1)' }}>{row.actualUnits}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ProgressBar value={up} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', minWidth: 36 }}>{up}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{fmtEGP(row.targetRevenue)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-1)' }}>{fmtEGP(row.actualRevenue)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ProgressBar value={rp} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', minWidth: 36 }}>{rp}%</span>
                      </div>
                    </td>
                    <td><AttainBadge up={up} rp={rp} /></td>
                  </tr>
                );
              })}
              {attainment.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2rem' }}>
                    {isAr ? `لا توجد بيانات إنجاز لـ ${period}` : `No attainment data for ${period}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* existing targets — edit in place */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>{isAr ? 'الأهداف المحددة' : 'Configured Targets'}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(true)}>{isAr ? '+ جديد' : '+ New'}</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'المندوب' : 'Rep'}</th>
                <th>{isAr ? 'الفرع' : 'Location'}</th>
                <th>{isAr ? 'الفترة' : 'Period'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'هدف الوحدات' : 'Target Units'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'هدف الإيرادات' : 'Target Revenue'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {targets.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{t.user?.name ?? t.userId}</td>
                  <td style={{ color: 'var(--text-2)' }}>{t.location?.name ?? t.locationId}</td>
                  <td style={{ color: 'var(--text-3)' }}>{t.period}</td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === t.id ? (
                      <NumericInput
                        min="0"
                        value={editForm.targetUnits}
                        onChange={val => setEditForm(f => ({ ...f, targetUnits: Number(val) }))}
                        style={{
                          width: 70, padding: '0.25rem 0.5rem', fontSize: '0.8rem',
                          border: '1px solid var(--primary)', borderRadius: '0.35rem',
                          background: 'var(--surface-2)', color: 'var(--text-1)', textAlign: 'right',
                        }}
                      />
                    ) : (
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t.targetUnits}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === t.id ? (
                      <NumericInput
                        min="0"
                        value={editForm.targetRevenue}
                        onChange={val => setEditForm(f => ({ ...f, targetRevenue: Number(val) }))}
                        style={{
                          width: 120, padding: '0.25rem 0.5rem', fontSize: '0.8rem',
                          border: '1px solid var(--primary)', borderRadius: '0.35rem',
                          background: 'var(--surface-2)', color: 'var(--text-1)', textAlign: 'right',
                        }}
                      />
                    ) : (
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEGP(t.targetRevenue)}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === t.id ? (
                      <span style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary btn-sm" disabled={savingEdit} onClick={() => saveEdit(t.id)}>
                          {savingEdit ? '…' : (isAr ? 'حفظ' : 'Save')}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                      </span>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(t)}
                        style={{ color: 'var(--primary)' }}
                      >
                        {isAr ? 'تعديل' : 'Edit'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {targets.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2rem' }}>
                    {isAr ? `لم يتم تعيين أهداف لـ ${period}` : `No targets set for ${period}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal */}
      {showModal && (
        <SetTargetModal
          reps={reps}
          locations={locations}
          defaultPeriod={period}
          onClose={() => setShowModal(false)}
          onCreated={() => { loadTargets(); loadAttainment(); }}
        />
      )}
    </div>
  );
}
