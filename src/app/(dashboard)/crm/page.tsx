'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef, type DragEvent } from 'react';
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

interface SalesRep { id: string; name: string; }

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

function statusBadgeClass(s: string): string {
  const col = COLUMNS.find((c) => c.status === s);
  return col?.badgeClass ?? 'badge-neutral';
}

function LeadCard({
  lead,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
}) {
  const router = useRouter();
  const dragged = useRef(false);
  const days = daysInStage(lead);
  const repName = lead.assignedTo?.name ?? '';
  const bg = repName ? avatarColor(repName) : 'var(--text-3)';
  const vehicleLabel = lead.vehicle
    ? `${lead.vehicle.make} ${lead.vehicle.model} ${lead.vehicle.year}`
    : lead.interestedIn ?? '';

  return (
    <div
      draggable="true"
      onDragStart={(e) => { dragged.current = true; onDragStart(e, lead.id); }}
      onDragEnd={() => { onDragEnd(); setTimeout(() => { dragged.current = false; }, 50); }}
      onClick={() => { if (dragged.current) return; router.push(`/crm/${lead.id}`); }}
      className="card"
      style={{ padding: '0.875rem', cursor: 'grab', marginBottom: '0.5rem', boxShadow: '0 1px 4px oklch(0 0 0 / 0.06)', transition: 'box-shadow 150ms, border-color 150ms' }}
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
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [branch, setBranch] = useState('');
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);
  // ponytail: view toggle + bulk selection
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    draggingId.current = id;
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingId.current = null;
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback(async (leadId: string, newStatus: string) => {
    const prev = leads.find((l) => l.id === leadId);
    if (!prev || prev.status === newStatus) return;
    // ponytail: optimistic update — mutate status in flat array immediately
    setLeads((ls) => ls.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    try {
      const res = await fetch(`${API}/leads/${leadId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setLeads((ls) => ls.map((l) => l.id === leadId ? { ...l, status: prev.status } : l));
    }
  }, [leads]);

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

  const loadReps = useCallback(async () => {
    if (salesReps.length > 0) return;
    try {
      const res = await fetch(`${API}/users?role=SALES_REP`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setSalesReps(Array.isArray(json) ? json : (json.data ?? []));
    } catch { /* non-critical */ }
  }, [salesReps.length]);

  useEffect(() => { load(); }, [load]);
  // ponytail: pre-load reps when bulk bar becomes visible
  useEffect(() => { if (selectedIds.size > 0) loadReps(); }, [selectedIds.size, loadReps]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  const executeBulk = useCallback(async (action: string, value?: string) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    try {
      const res = await fetch(`${API}/leads/bulk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ids, action, ...(value !== undefined ? { value } : {}) }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(`Updated ${ids.length} record${ids.length > 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      load();
    } catch {
      showToast('Bulk action failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, load]);

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

  const allSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));
  const someSelected = !allSelected && filtered.some((l) => selectedIds.has(l.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const switchView = (mode: 'kanban' | 'list') => {
    setViewMode(mode);
    setSelectedIds(new Set());
  };

  // ponytail: shared icon for view toggle buttons
  const KanbanIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="3.5" height="12" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="5.25" y="1" width="3.5" height="8" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="9.5" y="1" width="3.5" height="10" rx="1" fill="currentColor" opacity="0.8"/>
    </svg>
  );
  const ListIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2.5" width="12" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="1" y="6.25" width="12" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="1" y="10" width="12" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  );

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
        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => switchView('kanban')}
            title="Kanban view"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.35rem 0.625rem', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 500,
              background: viewMode === 'kanban' ? 'var(--primary)' : 'var(--surface)',
              color: viewMode === 'kanban' ? '#fff' : 'var(--text-2)',
              transition: 'background 120ms, color 120ms',
            }}
          >
            <KanbanIcon /> Kanban
          </button>
          <button
            onClick={() => switchView('list')}
            title="List view"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.35rem 0.625rem', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 500,
              background: viewMode === 'list' ? 'var(--primary)' : 'var(--surface)',
              color: viewMode === 'list' ? '#fff' : 'var(--text-2)',
              transition: 'background 120ms, color 120ms',
            }}
          >
            <ListIcon /> List
          </button>
        </div>
      </div>

      {/* Kanban board */}
      {viewMode === 'kanban' && (
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
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={(e) => { e.preventDefault(); setDragOverStatus(col.status); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStatus(null); }}
                    onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); handleDrop(id, col.status); setDragOverStatus(null); }}
                    style={{
                      width: '240px',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      background: dragOverStatus === col.status
                        ? 'color-mix(in srgb, var(--primary) 8%, var(--bg))'
                        : 'var(--bg)',
                      borderRadius: '0.625rem',
                      border: dragOverStatus === col.status
                        ? '2px dashed var(--primary)'
                        : '1px solid var(--border)',
                      overflow: 'hidden',
                      transition: 'background 120ms, border-color 120ms',
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
                      {cards.map((lead) => <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />)}
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
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="page-body" style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '2.5rem', paddingLeft: '1rem' }}>
                      {/* ponytail: indeterminate via DOM ref */}
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Assigned Rep</th>
                    <th>Vehicle Interest</th>
                    <th>Days in Stage</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const isSelected = selectedIds.has(l.id);
                    const days = daysInStage(l);
                    const repName = l.assignedTo?.name ?? '';
                    const vehicleLabel = l.vehicle
                      ? `${l.vehicle.year} ${l.vehicle.make} ${l.vehicle.model}`
                      : l.interestedIn ?? '—';
                    return (
                      <tr
                        key={l.id}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : undefined,
                        }}
                        onClick={() => router.push(`/crm/${l.id}`)}
                      >
                        <td
                          style={{ paddingLeft: '1rem' }}
                          onClick={(e) => { e.stopPropagation(); toggleOne(l.id); }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(l.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="avatar" style={{ width: '1.75rem', height: '1.75rem', background: avatarColor(l.name), color: '#fff', fontSize: '0.625rem', flexShrink: 0 }}>
                              {initials(l.name)}
                            </span>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{l.name}</div>
                              {l.phone && <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{l.phone}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${statusBadgeClass(l.status)}`}>
                            {l.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>
                          {l.source ? `${sourceIcon(l.source)} ${l.source.replace(/_/g, ' ')}` : '—'}
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>
                          {repName ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span className="avatar" style={{ width: '1.5rem', height: '1.5rem', background: avatarColor(repName), color: '#fff', fontSize: '0.5625rem', flexShrink: 0 }}>
                                {initials(repName)}
                              </span>
                              {repName}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{vehicleLabel}</td>
                        <td style={{ color: days > 7 ? 'var(--danger-fg)' : 'var(--text-3)', fontSize: '0.8125rem' }}>
                          {days}d
                        </td>
                        <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                          {new Date(l.createdAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          <Link
                            href={`/crm/${l.id}`}
                            style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '0.75rem', textDecoration: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                        No leads found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Floating bulk action bar — list view only */}
      {viewMode === 'list' && selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface-2)', border: '1px solid var(--border-2)',
          borderRadius: '8px', padding: '0.75rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          boxShadow: '0 4px 24px oklch(0 0 0 / 0.3)', zIndex: 100,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>
            {selectedIds.size} selected
          </span>
          <div style={{ width: '1px', height: '1.25rem', background: 'var(--border)' }} />
          {/* Assign Rep */}
          <SearchableCombobox
            options={salesReps.map((r) => ({ value: r.id, label: r.name }))}
            value=""
            onChange={(v) => { if (v) executeBulk('ASSIGN_REP', v); }}
            placeholder="Assign Rep…"
            className="w-44"
          />
          {/* Change Status */}
          <SearchableCombobox
            options={COLUMNS.map((c) => ({ value: c.status, label: c.label }))}
            value=""
            onChange={(v) => { if (v) executeBulk('CHANGE_STATUS', v); }}
            placeholder="Change Status…"
            className="w-44"
          />
          {/* Close Lost */}
          <button
            className="btn btn-danger"
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => {
              if (window.confirm(`Mark ${selectedIds.size} lead${selectedIds.size > 1 ? 's' : ''} as Closed Lost?`)) {
                executeBulk('CLOSE_LOST');
              }
            }}
          >
            Close Lost
          </button>
          {/* Clear */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1rem', lineHeight: 1, padding: '0.2rem 0.3rem' }}
            onClick={() => setSelectedIds(new Set())}
            title="Clear selection"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: viewMode === 'list' && selectedIds.size > 0 ? '5.5rem' : '1.5rem',
          left: '50%', transform: 'translateX(-50%)',
          background: 'var(--success)', color: '#fff',
          borderRadius: '6px', padding: '0.5rem 1rem',
          fontSize: '0.875rem', fontWeight: 500,
          boxShadow: '0 2px 12px oklch(0 0 0 / 0.2)', zIndex: 101,
          transition: 'bottom 150ms',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
