'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
const token = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

interface Lead {
  id: string; name: string; email?: string; phone?: string;
  status: string; source?: string; interestedIn?: string;
  assignedTo?: { name: string };
  vehicle?: { make: string; model: string; year: number };
  daysInStage?: number; createdAt: string;
  stageChangedAt?: string;
  location?: { name: string };
}

const COLUMNS = [
  { status: 'NEW',          label: 'New',          dotColor: 'var(--primary)',   badgeClass: 'badge-info'    },
  { status: 'CONTACTED',    label: 'Contacted',     dotColor: 'var(--purple)',    badgeClass: 'badge-purple'  },
  { status: 'QUALIFIED',    label: 'Qualified',     dotColor: 'var(--success)',   badgeClass: 'badge-success' },
  { status: 'NEGOTIATING',  label: 'Negotiating',   dotColor: 'var(--orange)',    badgeClass: 'badge-orange'  },
  { status: 'CLOSED_WON',   label: 'Closed Won',    dotColor: 'var(--success)',   badgeClass: 'badge-success' },
  { status: 'CLOSED_LOST',  label: 'Closed Lost',   dotColor: 'var(--text-3)',    badgeClass: 'badge-neutral' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'WALK_IN', label: 'Walk-In' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'MARKETPLACE', label: 'Marketplace' },
  { value: 'OTHER', label: 'Other' },
];

const AVATAR_COLORS = [
  'var(--primary)', 'var(--success)', 'var(--warning)',
  'var(--purple)', 'var(--orange)', 'var(--danger)',
];

function avatarColor(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function sourceIcon(source?: string): string {
  const map: Record<string, string> = {
    WEBSITE: '🌐', PHONE: '📞', FACEBOOK: '📘', WALK_IN: '🚶', REFERRAL: '🤝', MARKETPLACE: '🛒', OTHER: '💬',
  };
  return map[source ?? ''] ?? '📋';
}

function daysInStage(lead: Lead): number {
  const base = lead.stageChangedAt ?? lead.createdAt;
  return Math.floor((Date.now() - new Date(base).getTime()) / 86_400_000);
}

function LeadCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const days = daysInStage(lead);
  const repName = lead.assignedTo?.name ?? '';
  const bg = repName ? avatarColor(repName) : 'var(--text-3)';
  const vehicleLabel = lead.vehicle
    ? `${lead.vehicle.make} ${lead.vehicle.model} ${lead.vehicle.year}`
    : lead.interestedIn ?? '';

  return (
    <div
      onClick={() => router.push(`/crm/${lead.id}`)}
      className="card"
      style={{ padding: '0.875rem', cursor: 'pointer', marginBottom: '0.5rem', boxShadow: '0 1px 4px oklch(0 0 0 / 0.06)', transition: 'box-shadow 150ms, border-color 150ms' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px oklch(0 0 0 / 0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px oklch(0 0 0 / 0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
    >
      {/* Top row: name + avatar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-1)', lineHeight: 1.3 }}>{lead.name}</span>
        {repName && (
          <span className="avatar" style={{ width: '1.75rem', height: '1.75rem', background: bg, color: '#fff', fontSize: '0.625rem', flexShrink: 0 }}>
            {initials(repName)}
          </span>
        )}
      </div>
      {/* Vehicle */}
      {vehicleLabel && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '0.35rem' }}>
          🚗 {vehicleLabel}
        </p>
      )}
      {/* Source */}
      {lead.source && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.35rem' }}>
          {sourceIcon(lead.source)} {lead.source.replace(/_/g, ' ')}
        </p>
      )}
      {/* Days in stage */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: days > 7 ? 'var(--danger-fg)' : 'var(--text-3)', marginTop: '0.5rem' }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        {days} {days === 1 ? 'day' : 'days'} in stage
      </div>
    </div>
  );
}

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [branch, setBranch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '200' });
      const res = await fetch(`${API}/leads?${qs}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setLeads(Array.isArray(json) ? json : (json.data ?? []));
    } catch { setLeads([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = leads.filter((l) => {
    if (search) {
      const q = search.toLowerCase();
      if (![l.name, l.phone, l.email].some((f) => f?.toLowerCase().includes(q))) return false;
    }
    if (source && l.source !== source) return false;
    if (branch && l.location?.name !== branch) return false;
    return true;
  });

  const byStatus = COLUMNS.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col.status] = filtered.filter((l) => l.status === col.status);
    return acc;
  }, {});

  const branchOptions = [
    { value: '', label: 'All Branches' },
    ...Array.from(new Set(leads.map((l) => l.location?.name).filter(Boolean) as string[])).map((n) => ({ value: n, label: n })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="page-title">Leads &amp; CRM</h1>
          <p className="page-subtitle">{leads.length} active leads · Auto-assigned by branch</p>
        </div>
        <Link href="/crm/new" className="btn btn-primary">
          + New Lead
        </Link>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: '0.625rem', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            className="input"
            style={{ paddingLeft: '2rem' }}
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SearchableCombobox
          options={SOURCE_OPTIONS}
          value={source}
          onChange={setSource}
          placeholder="Source ▾"
          clearable
          clearLabel="All Sources"
          className="w-36"
        />
        <SearchableCombobox
          options={branchOptions}
          value={branch}
          onChange={setBranch}
          placeholder="Branch ▾"
          clearable
          clearLabel="All Branches"
          className="w-36"
        />
      </div>

      {/* Kanban board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '1rem 1.5rem' }}>
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', gap: '0.875rem', height: '100%', minWidth: 'max-content' }}>
            {COLUMNS.map((col) => {
              const cards = byStatus[col.status] ?? [];
              return (
                <div
                  key={col.status}
                  style={{
                    width: '240px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--bg)',
                    borderRadius: '0.625rem',
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Column header */}
                  <div style={{ padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.dotColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-1)', flex: 1 }}>{col.label}</span>
                    <span className={`badge ${col.badgeClass}`} style={{ fontSize: '0.625rem', padding: '0.1rem 0.45rem' }}>
                      {cards.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                    {cards.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
                    {cards.length === 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center', marginTop: '1.5rem' }}>No leads</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
