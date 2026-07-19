'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import { translateSource } from '@/lib/source-labels';
import { API_BASE as API } from '@/lib/config';
import { apiFetch } from '@/lib/useApi';
const token = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

interface Activity {
  id: string; type: string; note: string; outcome?: string; createdAt: string;
}
interface Lead {
  id: string; name: string; phone?: string; email?: string;
  status: string; source?: string; notes?: string; createdAt: string;
  leadScore?: number;
  vehicle?: { make: string; model: string; year: number };
  assignedTo?: { name: string; email?: string };
  location?: { name: string };
  activities?: Activity[];
  nextAppointment?: { date: string; type: string; notes?: string };
}

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'CLOSED_WON', 'CLOSED_LOST'];
const STAGE_LABELS: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
  NEGOTIATING: 'Negotiating', CLOSED_WON: 'Closed Won', CLOSED_LOST: 'Closed Lost',
};

const AVATAR_COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--purple)', 'var(--orange)', 'var(--danger)'];
function avatarColor(name: string) { const c = name.charCodeAt(0) + (name.charCodeAt(1) || 0); return AVATAR_COLORS[c % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

function timeAgo(iso: string, isAr: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return isAr ? 'الآن' : 'just now';
  if (m < 60) return isAr ? `منذ ${m} د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isAr ? `منذ ${h} س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return isAr ? `منذ ${d} ي` : `${d}d ago`;
}

const ACTIVITY_TYPE_OPTS = ['CALL', 'EMAIL', 'VISIT', 'TEST_DRIVE', 'FOLLOW_UP', 'NOTE'].map((t) => ({ value: t, label: t.replace(/_/g, ' ') }));

const TYPE_AR: Record<string, string> = {
  TEST_DRIVE: 'اختبار قيادة', CALL: 'مكالمة', EMAIL: 'بريد',
  MEETING: 'اجتماع', FOLLOW_UP: 'متابعة', OTHER: 'أخرى',
};

const ACTIVITY_DOT: Record<string, string> = {
  CALL: 'var(--warning)', EMAIL: 'var(--primary)', VISIT: 'var(--purple)',
  TEST_DRIVE: 'var(--orange)', FOLLOW_UP: 'var(--info)', NOTE: 'var(--success)', SYSTEM: 'var(--text-3)',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAr } = useLang();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [callNote, setCallNote] = useState('');
  const [activeType, setActiveType] = useState<'NOTE' | 'CALL'>('NOTE');

  const load = useCallback(async () => {
    setLoading(true);
    try { setLead(await apiFetch<Lead>(`/leads/${id}`)); setError(''); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(status: string) {
    try { await apiFetch(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
  }

  async function logActivity(type: string, note: string) {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/leads/${id}/activities`, { method: 'POST', body: JSON.stringify({ type, note }) });
      setNoteText(''); setCallNote(''); load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function convertToDeal() {
    if (!confirm(isAr ? 'تحويل هذا العميل إلى صفقة؟' : 'Convert this lead to a deal?')) return;
    setConverting(true);
    try {
      const result = await apiFetch<{ id: string | null }>(`/leads/${id}/convert`, { method: 'PATCH' });
      if (result.id) router.push(`/deals/${result.id}`);
      else router.push(`/deals/new?leadId=${id}`);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setConverting(false); }
  }

  const arStageLabels: Record<string, string> = {
    NEW: 'جديد', CONTACTED: 'تم التواصل', QUALIFIED: 'مؤهل',
    NEGOTIATING: 'تفاوض', CLOSED_WON: 'فوز', CLOSED_LOST: 'خسارة',
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</div>;
  if (error) return <div style={{ padding: '2rem', color: 'var(--danger-fg)', fontSize: '0.875rem' }}>{error}</div>;
  if (!lead) return null;

  const repName = lead.assignedTo?.name ?? '';

  return (
    <div style={{ padding: '1.25rem 1.5rem' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
        <Link href="/crm" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>{isAr ? 'العملاء المحتملون' : 'Leads & CRM'}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-1)' }}>{lead.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">{lead.name}</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-2)' }}>
            {lead.phone && <span>📞 {lead.phone}</span>}
            {lead.email && <span>✉ {lead.email}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => alert(isAr ? 'جدولة موعد — قريباً' : 'Schedule appointment — coming soon')}>
            {isAr ? '📅 جدولة موعد' : '📅 Schedule Appointment'}
          </button>
          {['QUALIFIED', 'NEGOTIATING', 'NEW', 'CONTACTED'].includes(lead.status) && (
            <button className="btn btn-primary btn-sm" onClick={convertToDeal} disabled={converting}>
              {converting ? '…' : isAr ? 'تحويل إلى صفقة' : 'Convert to Deal'}
            </button>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-2)', flexWrap: 'wrap' }}>
        {lead.vehicle && (
          <span>{isAr ? 'مهتم بـ:' : 'Interested in:'} <strong style={{ color: 'var(--text-1)' }}>{lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}</strong></span>
        )}
        {repName && (
          <span>{isAr ? 'مسؤول:' : 'Assigned to:'} <strong style={{ color: 'var(--text-1)' }}>{repName}</strong></span>
        )}
        {lead.leadScore !== undefined && (
          <span>{isAr ? 'نقاط العميل:' : 'Lead Score:'} <strong style={{ color: 'var(--primary)' }}>{lead.leadScore}</strong></span>
        )}
      </div>

      {/* 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1.25rem', alignItems: 'start' }}>

        {/* LEFT: Activity timeline */}
        <div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isAr ? 'سجل النشاط' : 'Activity Timeline'}</h2>
            </div>

            {/* Timeline entries */}
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              {/* System: created */}
              <TimelineEntry
                dot="var(--text-3)" title={isAr ? 'تم إنشاء العميل' : 'Lead Created'} time={timeAgo(lead.createdAt, isAr)}
                description={isAr ? `تم إنشاء العميل من ${translateSource(lead.source, true)}` : `Lead was created from ${translateSource(lead.source, false)}`}
              />
              {/* System: auto-assigned */}
              {repName && (
                <TimelineEntry
                  dot="var(--primary)" title={isAr ? 'تعيين تلقائي' : 'Auto-Assigned'} time={timeAgo(lead.createdAt, isAr)}
                  description={isAr ? `تم التعيين لـ ${repName} في ${lead.location?.name ?? 'الفرع'}` : `Assigned to ${repName} at ${lead.location?.name ?? 'branch'}`}
                />
              )}
              {/* Activities */}
              {(lead.activities ?? []).slice().reverse().map((a) => (
                <TimelineEntry
                  key={a.id}
                  dot={ACTIVITY_DOT[a.type] ?? 'var(--text-3)'}
                  title={isAr ? (TYPE_AR[a.type] ?? a.type) : a.type.replace(/_/g, ' ')}
                  time={timeAgo(a.createdAt, isAr)}
                  description={a.note}
                  outcome={a.outcome}
                />
              ))}
            </div>

            {/* Add activity */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  className={`btn btn-sm ${activeType === 'NOTE' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveType('NOTE')}
                >{isAr ? 'إضافة ملاحظة' : 'Add Note'}</button>
                <button
                  className={`btn btn-sm ${activeType === 'CALL' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveType('CALL')}
                >{isAr ? 'تسجيل مكالمة' : 'Log Call'}</button>
              </div>
              <textarea
                className="textarea"
                style={{ resize: 'vertical', marginBottom: '0.5rem' }}
                rows={3}
                placeholder={activeType === 'NOTE' ? (isAr ? 'اكتب ملاحظة…' : 'Write a note…') : (isAr ? 'نتيجة المكالمة وملاحظات…' : 'Call outcome and notes…')}
                value={activeType === 'NOTE' ? noteText : callNote}
                onChange={(e) => activeType === 'NOTE' ? setNoteText(e.target.value) : setCallNote(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={saving || !(activeType === 'NOTE' ? noteText.trim() : callNote.trim())}
                  onClick={() => logActivity(activeType, activeType === 'NOTE' ? noteText : callNote)}
                >
                  {saving ? '…' : activeType === 'NOTE' ? (isAr ? 'إضافة ملاحظة' : 'Add Note') : (isAr ? 'تسجيل مكالمة' : 'Log Call')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Stage selector */}
          <div className="card" style={{ padding: '1rem' }}>
            <p className="section-label">{isAr ? 'المرحلة' : 'Stage'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {STAGES.map((s) => {
                const active = lead.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '0.45rem 0.75rem', borderRadius: '0.375rem',
                      fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
                      cursor: 'pointer', transition: 'all 150ms', border: 'none',
                      background: active ? 'var(--surface-2)' : 'transparent',
                      color: active ? 'var(--tab-active)' : 'var(--text-2)',
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {isAr ? (arStageLabels[s] ?? STAGE_LABELS[s]) : STAGE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upcoming appointment */}
          {lead.nextAppointment && (
            <div className="card" style={{ padding: '1rem' }}>
              <p className="section-label">{isAr ? 'الموعد القادم' : 'Upcoming Appointment'}</p>
              <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-1)' }}>
                {isAr ? (TYPE_AR[lead.nextAppointment.type] ?? lead.nextAppointment.type) : lead.nextAppointment.type.replace(/_/g, ' ')}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>
                {fmtDate(lead.nextAppointment.date, isAr, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
              {lead.nextAppointment.notes && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.35rem' }}>{lead.nextAppointment.notes}</p>
              )}
            </div>
          )}

          {/* Assigned rep */}
          <div className="card" style={{ padding: '1rem' }}>
            <p className="section-label">{isAr ? 'المندوب المعين' : 'Assigned Rep'}</p>
            {repName ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
                  <span className="avatar" style={{ width: '2.25rem', height: '2.25rem', background: avatarColor(repName), color: '#fff', fontSize: '0.75rem' }}>
                    {initials(repName)}
                  </span>
                  <div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-1)' }}>{repName}</p>
                    {lead.location?.name && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{lead.location.name}</p>
                    )}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ padding: 0, fontSize: '0.75rem', color: 'var(--primary)' }}>
                  {isAr ? 'إعادة التعيين →' : '← Reassign Lead'}
                </button>
              </>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{isAr ? 'غير معين' : 'Unassigned'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineEntry({ dot, title, description, time, outcome }: {
  dot: string; title: string; description: string; time: string; outcome?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: dot, flexShrink: 0, marginTop: '3px' }} />
        <span style={{ width: '1px', flex: 1, background: 'var(--border)', minHeight: '1rem', marginTop: '4px' }} />
      </div>
      <div style={{ flex: 1, paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.15rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-1)' }}>{title}</span>
          {outcome && <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>· {outcome}</span>}
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginLeft: 'auto' }}>{time}</span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', lineHeight: 1.45 }}>{description}</p>
      </div>
    </div>
  );
}
