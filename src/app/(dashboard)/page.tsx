'use client';

import Link from 'next/link';
import { useQuery } from '../../lib/useApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
const TODAY = new Date().toISOString().slice(0, 10);

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function toArr(res: unknown): Record<string, unknown>[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = res as Record<string, unknown>;
  if (Array.isArray(r.items)) return r.items as Record<string, unknown>[];
  if (Array.isArray(r.data))  return r.data  as Record<string, unknown>[];
  return [];
}
function toTotal(res: unknown): number {
  if (!res) return 0;
  const arr = toArr(res);
  if (arr.length) return arr.length;
  const r = res as Record<string, unknown>;
  if (typeof r.total === 'number') return r.total;
  return 0;
}
function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const m  = Math.floor(ms / 60_000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
const egp = (n: number | string) =>
  'EGP ' + Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });

/* ─── Mini donut (SVG) ────────────────────────────────────────────────────── */
type Slice = { value: number; color: string };
function MiniDonut({ slices, total }: { slices: Slice[]; total: number }) {
  const R = 44; const cx = 56; const cy = 56; const sw = 22;
  let cursor = -Math.PI / 2;
  const arcs: { d: string; color: string }[] = [];
  slices.forEach(({ value, color }) => {
    if (!value) return;
    const angle = (value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(cursor);
    const y1 = cy + R * Math.sin(cursor);
    cursor += angle;
    const x2 = cx + R * Math.cos(cursor);
    const y2 = cy + R * Math.sin(cursor);
    const large = angle > Math.PI ? 1 : 0;
    arcs.push({ d: `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2}`, color });
  });
  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      {total === 0
        ? <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth={sw} />
        : arcs.map((a, i) => (
          <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={sw} strokeLinecap="butt" />
        ))
      }
      <circle cx={cx} cy={cy} r={R - sw / 2 - 4} fill="var(--surface)" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text-1)">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="var(--text-3)">vehicles</text>
    </svg>
  );
}

/* ─── KPI card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color, href, icon }: {
  label: string; value: number | string; sub?: string;
  color: string; href: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="card p-5 block hover:border-[var(--border-strong)] transition group">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</p>
        <span className="p-1.5 rounded-lg" style={{ background: `${color}18`, color }}>{icon}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </Link>
  );
}

/* ─── Lead sources bar ────────────────────────────────────────────────────── */
function SourceBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(6, Math.round((count / max) * 100)) : 6;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-20 shrink-0 truncate" style={{ color: 'var(--text-2)' }}>{label}</span>
      <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums w-5 text-right" style={{ color: 'var(--text-3)' }}>{count}</span>
    </div>
  );
}

/* ─── Activity item ───────────────────────────────────────────────────────── */
function ActivityItem({ avatar, name, detail, time, color }: {
  avatar: string; name: string; detail: string; time: string; color: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="avatar w-7 h-7 text-[0.6rem] shrink-0" style={{ background: color, color: '#fff' }}>
        {avatar}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[0.8125rem] font-medium leading-snug truncate" style={{ color: 'var(--text-1)' }}>{name}</p>
        <p className="text-xs leading-snug truncate" style={{ color: 'var(--text-3)' }}>{detail}</p>
      </div>
      <span className="text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}>{time}</span>
    </div>
  );
}

/* ─── Todo item ───────────────────────────────────────────────────────────── */
function TodoItem({ text, tag, tagColor }: { text: string; tag: string; tagColor: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="w-4 h-4 rounded border mt-0.5 shrink-0" style={{ borderColor: 'var(--border-strong)' }} />
      <p className="flex-1 text-xs leading-snug" style={{ color: 'var(--text-1)' }}>{text}</p>
      <span className="badge text-[10px] shrink-0" style={{ background: tagColor + '18', color: tagColor }}>
        {tag}
      </span>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function DashboardHome() {
  const { data: vehiclesAvail }  = useQuery<unknown>('/vehicles?status=AVAILABLE&limit=1');
  const { data: vehiclesReserv } = useQuery<unknown>('/vehicles?status=RESERVED&limit=1');
  const { data: vehiclesSold }   = useQuery<unknown>('/vehicles?status=SOLD&limit=1');
  const { data: vehiclesTransit }= useQuery<unknown>('/vehicles?status=IN_TRANSIT&limit=1');
  const { data: leadsRes }       = useQuery<unknown>('/leads?limit=5');
  const { data: dealsRes }       = useQuery<unknown>('/deals?limit=100');
  const { data: appointRes }     = useQuery<unknown>('/appointments?limit=200');
  const { data: pendingFinRes }  = useQuery<unknown>('/deals?status=PENDING_FINANCE&limit=1');

  const available = toTotal(vehiclesAvail);
  const reserved  = toTotal(vehiclesReserv);
  const sold      = toTotal(vehiclesSold);
  const inTransit = toTotal(vehiclesTransit);
  const invTotal  = available + reserved + sold + inTransit;

  const leads       = toArr(leadsRes);
  const deals       = toArr(dealsRes);
  const appts       = toArr(appointRes);
  const pendingFin  = toTotal(pendingFinRes);

  const todayAppts = appts.filter(a => {
    const d = String(a.date ?? a.scheduledAt ?? '');
    return d.slice(0, 10) === TODAY;
  }).length;

  const dealsThisMonth = deals.filter(d => {
    const c = String(d.createdAt ?? '');
    return c.startsWith(TODAY.slice(0, 7));
  });

  const monthRevenue = dealsThisMonth
    .filter(d => d.status === 'FINALIZED')
    .reduce((s, d) => s + Number(d.salePrice ?? 0), 0);

  // Lead sources
  const sourceMap = leads.reduce<Record<string, number>>((acc, l) => {
    const s = String(l.source ?? 'Other');
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const sourceMax = Math.max(1, ...Object.values(sourceMap));

  const sourceColors: Record<string, string> = {
    WEBSITE:  'var(--primary)',
    PHONE:    'var(--success)',
    WALK_IN:  'var(--warning)',
    FACEBOOK: 'var(--purple)',
    REFERRAL: 'var(--orange)',
    Other:    'var(--text-3)',
  };

  const inventorySlices: Slice[] = [
    { value: available,  color: 'var(--success)' },
    { value: reserved,   color: 'var(--primary)' },
    { value: sold,       color: 'var(--purple)' },
    { value: inTransit,  color: 'var(--warning)' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">All Locations · {new Date().toLocaleDateString('en-EG', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="page-body space-y-5">

        {/* ── KPI Row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Vehicles in Stock" value={available} sub={`↑ ${inTransit} in transit`}
            color="var(--primary)" href="/vehicles"
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 10L3 6h10l1.5 4v2h-13v-2z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity=".15"/><circle cx="4.5" cy="11" r="1" fill="currentColor"/><circle cx="11.5" cy="11" r="1" fill="currentColor"/></svg>}
          />
          <KpiCard label="Active Leads" value={leads.length} sub={`↑ ${leads.filter(l=>l.createdAt && String(l.createdAt).slice(0,10)===TODAY).length} new today`}
            color="var(--purple)" href="/crm"
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
          />
          <KpiCard label="Deals This Month" value={dealsThisMonth.length}
            sub={monthRevenue > 0 ? `EGP ${(monthRevenue/1_000_000).toFixed(1)}M revenue` : 'No revenue yet'}
            color="var(--success)" href="/deals"
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 7h12" stroke="currentColor" strokeWidth="1.2"/></svg>}
          />
          <KpiCard label="Appointments Today" value={todayAppts} sub={`${pendingFin} pending finance`}
            color="var(--warning)" href="/appointments"
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2 7h12" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
          />
        </div>

        {/* ── Charts row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Monthly revenue sparkline (CSS-only) */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Monthly Revenue (EGP 000s)</p>
              <span className="badge badge-info">This year</span>
            </div>
            {/* Simple CSS bar chart */}
            <div className="flex items-end gap-1.5 h-24">
              {['Jan','Feb','Mar','Apr','May','Jun'].map((m, i) => {
                const h = [45, 60, 38, 72, 55, 80][i];
                return (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm" style={{ height: `${h}%`, background: 'var(--primary)', opacity: i === 5 ? 1 : 0.35 }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{m}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inventory status donut */}
          <div className="card p-5">
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>Inventory Status</p>
            <div className="flex items-center gap-4">
              <MiniDonut slices={inventorySlices} total={invTotal} />
              <div className="space-y-2 flex-1">
                {[
                  { label: 'Available',  count: available,  color: 'var(--success)' },
                  { label: 'Reserved',   count: reserved,   color: 'var(--primary)' },
                  { label: 'Sold',       count: sold,       color: 'var(--purple)' },
                  { label: 'In Transit', count: inTransit,  color: 'var(--warning)' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                    <span className="text-xs flex-1" style={{ color: 'var(--text-2)' }}>{label}</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Activity + Lead Sources + To-Do ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent activity */}
          <div className="card p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Recent Activity</p>
            </div>
            <div>
              {leads.slice(0, 5).map((l) => (
                <ActivityItem
                  key={String(l.id)}
                  avatar={String(l.name ?? '?').slice(0, 2).toUpperCase()}
                  name={String(l.name ?? '—')}
                  detail={`New lead • ${String(l.source ?? '').replace('_', ' ')}`}
                  time={l.createdAt ? timeAgo(String(l.createdAt)) : ''}
                  color={l.status === 'CLOSED_WON' ? 'var(--success)' : l.status === 'NEGOTIATING' ? 'var(--orange)' : 'var(--primary)'}
                />
              ))}
              {leads.length === 0 && (
                <p className="text-xs py-6 text-center" style={{ color: 'var(--text-3)' }}>No recent activity</p>
              )}
            </div>
            <Link href="/crm" className="block mt-3 text-xs" style={{ color: 'var(--primary)' }}>View all leads →</Link>
          </div>

          {/* Lead sources */}
          <div className="card p-5">
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>Lead Sources</p>
            <div className="space-y-3">
              {Object.entries(sourceMap).length === 0
                ? <p className="text-xs" style={{ color: 'var(--text-3)' }}>No data yet</p>
                : Object.entries(sourceMap).map(([src, cnt]) => (
                  <SourceBar key={src} label={src.replace('_', ' ')} count={cnt} max={sourceMax}
                    color={sourceColors[src] ?? 'var(--text-3)'} />
                ))
              }
            </div>
          </div>

          {/* To-do today */}
          <div className="card p-5">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>✅ To Do Today</p>
            <div>
              {deals.slice(0, 5).map((d) => (
                <TodoItem
                  key={String(d.id)}
                  text={`Review deal #${String(d.id ?? '').slice(-4)} — ${String((d.vehicle as Record<string,unknown>)?.make ?? '')} ${String((d.vehicle as Record<string,unknown>)?.model ?? '')}`}
                  tag={String(d.status ?? '').replace('_', ' ')}
                  tagColor={d.status === 'PENDING_FINANCE' ? 'var(--warning)' : d.status === 'APPROVED' ? 'var(--success)' : 'var(--text-3)'}
                />
              ))}
              {deals.length === 0 && (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--text-3)' }}>All caught up!</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Per-branch gross profit bars ──────────────────────────── */}
        {deals.length > 0 && (() => {
          const byLoc: Record<string, number> = {};
          deals.filter(d => d.status === 'FINALIZED').forEach(d => {
            const loc = String((d as Record<string, Record<string,unknown>>).location?.name ?? d.locationId ?? 'Branch');
            byLoc[loc] = (byLoc[loc] ?? 0) + Number(d.salePrice ?? 0);
          });
          const entries = Object.entries(byLoc);
          if (!entries.length) return null;
          const maxVal = Math.max(...entries.map(e => e[1]));
          return (
            <div className="card p-5">
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>Per-Branch Gross Profit (EGP 000s)</p>
              <div className="flex items-end gap-4 h-28">
                {entries.map(([loc, val]) => (
                  <div key={loc} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>{egp(val / 1000)}</span>
                    <div className="w-full rounded-t" style={{ height: `${Math.max(10, (val / maxVal) * 80)}px`, background: 'var(--primary)', opacity: 0.7 }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{loc}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      </div>
    </>
  );
}
