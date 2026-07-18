'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/useApi';
import { useLang } from '@/lib/lang-context';
import { translateSource } from '@/lib/source-labels';

/* ── types ──────────────────────────────────────────────────────────────── */
interface Lead {
  id: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt?: string;
  assignedTo?: { id: string; name: string };
}

/* ── funnel config ───────────────────────────────────────────────────────── */
const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'CLOSED_WON'] as const;

// light → dark blue progression
const STAGE_COLORS: Record<string, string> = {
  NEW:          'hsl(213,80%,70%)',
  CONTACTED:    'hsl(213,80%,60%)',
  QUALIFIED:    'hsl(213,80%,50%)',
  NEGOTIATING:  'hsl(213,80%,40%)',
  CLOSED_WON:   'hsl(213,80%,30%)',
};



const STAGE_AR: Record<string, string> = {
  NEW:          'جديد',
  CONTACTED:    'تم التواصل',
  QUALIFIED:    'مؤهل',
  NEGOTIATING:  'قيد التفاوض',
  CLOSED_WON:   'صفقة مكتملة',
  CLOSED_LOST:  'صفقة خسارة',
};

/* ── FunnelRow ───────────────────────────────────────────────────────────── */
function FunnelRow({ stage, count, baseCount }: { stage: string; count: number; baseCount: number }) {
  const { isAr } = useLang();
  const barPct  = baseCount > 0 ? (count / baseCount) * 100 : 0;
  const convPct = baseCount > 0 ? Math.round((count / baseCount) * 100) : 0;
  const color   = STAGE_COLORS[stage] ?? 'var(--primary)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.625rem 0' }}>
      {/* stage label */}
      <span style={{
        width: 110, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)',
        textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
      }}>
        {isAr ? (STAGE_AR[stage] ?? stage) : stage.replace('_', ' ')}
      </span>

      {/* bar */}
      <div style={{ flex: 1, height: 20, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', width: `${barPct}%`, background: color,
          borderRadius: 4, transition: 'width 600ms ease',
          display: 'flex', alignItems: 'center', paddingLeft: barPct > 8 ? 8 : 0,
        }}>
          {barPct > 12 && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              {count}
            </span>
          )}
        </div>
      </div>

      {/* count + pct */}
      <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0, width: 100, justifyContent: 'flex-end' }}>
        {barPct <= 12 && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
            {count}
          </span>
        )}
        <span style={{
          fontSize: '0.75rem', fontWeight: 600,
          color: stage === 'CLOSED_WON' ? 'var(--success-fg)' : 'var(--text-3)',
          fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right',
        }}>
          {convPct}%
        </span>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────────────────── */
export default function SalesFunnelPage() {
  const { isAr } = useLang();

  const PERIOD_OPTS = [
    { value: '30',  label: isAr ? 'آخر 30 يوم'  : 'Last 30 Days'  },
    { value: '90',  label: isAr ? 'آخر 90 يوم'  : 'Last 90 Days'  },
    { value: '180', label: isAr ? 'آخر 180 يوم' : 'Last 180 Days' },
  ];

  const [days,    setDays]    = useState('30');
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  function load(daysBack: string) {
    setLoading(true);
    const createdAfter = new Date(Date.now() - Number(daysBack) * 86_400_000).toISOString();
    // ponytail: limit=1000 as required by spec
    apiFetch<{ items?: Lead[] } | Lead[]>(`/leads?page=1&limit=1000&createdAfter=${createdAfter}`)
      .then(d => {
        const list = Array.isArray(d) ? d : (d as { items?: Lead[] }).items ?? [];
        setLeads(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── derived counts ────────────────────────────────────────────────────── */
  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads) map[l.status] = (map[l.status] ?? 0) + 1;
    return map;
  }, [leads]);

  // base = max stage count (NEW or largest)
  const baseCount = useMemo(() => Math.max(...STAGES.map(s => stageCounts[s] ?? 0), 1), [stageCounts]);

  /* ── source breakdown ──────────────────────────────────────────────────── */
  const sourceTable = useMemo(() => {
    const map: Record<string, { total: number; won: number }> = {};
    for (const l of leads) {
      const src = l.source ?? 'Unknown';
      if (!map[src]) map[src] = { total: 0, won: 0 };
      map[src].total++;
      if (l.status === 'CLOSED_WON') map[src].won++;
    }
    return Object.entries(map)
      .map(([source, { total, won }]) => ({ source, total, won, convPct: total > 0 ? Math.round((won / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [leads]);

  const maxSource = useMemo(() => Math.max(...sourceTable.map(s => s.total), 1), [sourceTable]);

  /* ── top reps ──────────────────────────────────────────────────────────── */
  const repTable = useMemo(() => {
    const map: Record<string, { name: string; total: number; won: number; totalDays: number; wonCount: number }> = {};
    for (const l of leads) {
      const id   = l.assignedTo?.id   ?? 'unassigned';
      const name = l.assignedTo?.name ?? 'Unassigned';
      if (!map[id]) map[id] = { name, total: 0, won: 0, totalDays: 0, wonCount: 0 };
      map[id].total++;
      if (l.status === 'CLOSED_WON') {
        map[id].won++;
        // approximate days to close: updatedAt - createdAt (or 0)
        const created = new Date(l.createdAt).getTime();
        const closed  = l.updatedAt ? new Date(l.updatedAt).getTime() : created;
        map[id].totalDays += Math.max(0, Math.round((closed - created) / 86_400_000));
        map[id].wonCount++;
      }
    }
    return Object.values(map)
      .map(r => ({
        ...r,
        convPct:   r.total > 0 ? Math.round((r.won / r.total) * 1000) / 10 : 0,
        avgDays:   r.wonCount > 0 ? Math.round(r.totalDays / r.wonCount) : 0,
      }))
      .sort((a, b) => b.won - a.won);
  }, [leads]);

  const totalLeads = leads.length;
  const wonCount   = stageCounts['CLOSED_WON'] ?? 0;
  const lostCount  = stageCounts['CLOSED_LOST'] ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'مسار المبيعات' : 'Sales Funnel'}</h1>
          <p className="page-subtitle">{isAr ? `تحليل تحويل العملاء · ${totalLeads} عميل محتمل · ${wonCount} صفقة مغلقة` : `Lead conversion analytics · ${totalLeads} leads · ${wonCount} closed won`}</p>
        </div>
        {/* period toggle */}
        <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--surface-2)', borderRadius: '0.5rem' }}>
          {PERIOD_OPTS.map(o => (
            <button
              key={o.value}
              onClick={() => setDays(o.value)}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 500,
                background: days === o.value ? 'var(--surface)' : 'transparent',
                color:      days === o.value ? 'var(--text-1)'  : 'var(--text-3)',
                boxShadow:  days === o.value ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 150ms',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* funnel visualization */}
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>{isAr ? 'المسار حسب المرحلة' : 'Funnel by Stage'}</p>
            {loading && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STAGES.map(stage => (
              <FunnelRow
                key={stage}
                stage={stage}
                count={stageCounts[stage] ?? 0}
                baseCount={baseCount}
              />
            ))}
          </div>

          {/* totals summary */}
          <div style={{
            marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)',
            display: 'flex', gap: '2rem',
          }}>
            <div>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>{isAr ? 'إجمالي العملاء المحتملين' : 'Total Leads'}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>{totalLeads}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>{isAr ? 'مكتسب' : 'Won'}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-fg)', fontVariantNumeric: 'tabular-nums' }}>{wonCount}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>{isAr ? 'خسارة' : 'Lost'}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger-fg)', fontVariantNumeric: 'tabular-nums' }}>{lostCount}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>{isAr ? 'معدل التحويل' : 'Conversion Rate'}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                {totalLeads > 0 ? `${Math.round((wonCount / totalLeads) * 1000) / 10}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* source breakdown + top reps */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.875rem' }}>

          {/* source table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>{isAr ? 'التحويل حسب المصدر' : 'Conversion by Source'}</p>
            </div>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {sourceTable.map(row => (
                <div key={row.source}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-2)' }}>{translateSource(row.source, isAr)}</span>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{isAr ? `${row.total} عميل` : `${row.total} leads`}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: row.convPct >= 30 ? 'var(--success-fg)' : 'var(--text-2)', minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.convPct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(row.total / maxSource) * 100}%`,
                      background: 'var(--primary)',
                      borderRadius: 9999,
                    }} />
                  </div>
                </div>
              ))}
              {sourceTable.length === 0 && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</p>
              )}
            </div>
          </div>

          {/* top reps table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>{isAr ? 'أفضل مندوبي المبيعات' : 'Top Performing Reps'}</p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'المندوب' : 'Rep'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'المُسند' : 'Assigned'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'مكتسب' : 'Won'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'نسبة التحويل' : 'Conv %'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'متوسط الأيام' : 'Avg Days'}</th>
                </tr>
              </thead>
              <tbody>
                {repTable.map(rep => (
                  <tr key={rep.name}>
                    <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{rep.name}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rep.total}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success-fg)', fontVariantNumeric: 'tabular-nums' }}>{rep.won}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: rep.convPct >= 30 ? 'var(--success-fg)' : rep.convPct < 15 ? 'var(--danger-fg)' : 'var(--text-1)',
                    }}>
                      {rep.convPct}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {rep.avgDays > 0 ? `${rep.avgDays}d` : '—'}
                    </td>
                  </tr>
                ))}
                {repTable.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)' }}>{isAr ? 'لا توجد بيانات' : 'No data'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
