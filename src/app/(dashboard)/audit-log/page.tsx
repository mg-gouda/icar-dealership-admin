'use client';

import { useState } from 'react';
import { useQuery } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id:          string;
  createdAt:   string;
  user?:       { id: string; name: string; email: string };
  action:      string;
  entityType:  string;
  entityId:    string;
  description: string;
  changes?:    Record<string, { from: unknown; to: unknown }> | null;
  ipAddress?:  string;
  branch?:     string;
}

interface AuditResponse {
  data:  AuditEntry[];
  total: number;
  page:  number;
  limit: number;
}

// ── Options ───────────────────────────────────────────────────────────────────
const ENTITY_OPTS = [
  { value: '',             label: 'All Entities'     },
  { value: 'Vehicle',      label: 'Vehicle'          },
  { value: 'Deal',         label: 'Deal'             },
  { value: 'Invoice',      label: 'Invoice'          },
  { value: 'User',         label: 'User'             },
  { value: 'JournalEntry', label: 'Journal Entry'    },
  { value: 'Payment',      label: 'Payment'          },
  { value: 'FixedAsset',   label: 'Fixed Asset'      },
  { value: 'Setting',      label: 'Setting'          },
  { value: 'Lead',         label: 'Lead'             },
  { value: 'Appointment',  label: 'Appointment'      },
];

const ACTION_OPTS = [
  { value: '',              label: 'All Actions'    },
  { value: 'CREATE',        label: 'CREATE'         },
  { value: 'UPDATE',        label: 'UPDATE'         },
  { value: 'DELETE',        label: 'DELETE'         },
  { value: 'POST',          label: 'POST'           },
  { value: 'REVERSE',       label: 'REVERSE'        },
  { value: 'FINALIZE',      label: 'FINALIZE'       },
  { value: 'CANCEL',        label: 'CANCEL'         },
  { value: 'LOGIN',         label: 'LOGIN'          },
  { value: 'LOGOUT',        label: 'LOGOUT'         },
  { value: 'LOCK_OVERRIDE', label: 'LOCK_OVERRIDE'  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const ACTION_BADGE: Record<string, string> = {
  CREATE:       'badge badge-success',
  UPDATE:       'badge badge-info',
  DELETE:       'badge badge-danger',
  POST:         'badge badge-purple',
  REVERSE:      'badge badge-orange',
  FINALIZE:     'badge badge-warning',
  LOGIN:        'badge badge-neutral',
  LOGOUT:       'badge badge-neutral',
  LOCK_OVERRIDE:'badge badge-danger',
  CANCEL:       'badge badge-warning',
};

function fmtTimestamp(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-EG', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  };
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
}

function exportCsv(entries: AuditEntry[]) {
  const cols = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Description', 'IP Address', 'Branch'];
  const rows = entries.map((e) => [
    new Date(e.createdAt).toISOString(),
    e.user?.name ?? 'System',
    e.action,
    e.entityType,
    e.entityId,
    e.description,
    e.ipAddress ?? '',
    e.branch ?? '',
  ]);
  const csv = [cols, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Expanded row diff ─────────────────────────────────────────────────────────
function ChangeDiff({ changes }: { changes: Record<string, { from: unknown; to: unknown }> }) {
  const entries = Object.entries(changes);
  if (!entries.length) return <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>No change detail available.</p>;

  return (
    <div className="space-y-2">
      {entries.map(([field, { from, to }]) => (
        <div key={field} className="flex items-start gap-3" style={{ fontSize: '0.75rem' }}>
          <span style={{ minWidth: 140, color: 'var(--text-2)', fontWeight: 500 }}>{field}</span>
          <span style={{ color: 'var(--danger-fg)', fontFamily: 'monospace', background: 'var(--danger-bg)', padding: '1px 6px', borderRadius: 4 }}>
            {JSON.stringify(from) ?? 'null'}
          </span>
          <svg className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span style={{ color: 'var(--success-fg)', fontFamily: 'monospace', background: 'var(--success-bg)', padding: '1px 6px', borderRadius: 4 }}>
            {JSON.stringify(to) ?? 'null'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [search,      setSearch]      = useState('');
  const [entityType,  setEntityType]  = useState('');
  const [action,      setAction]      = useState('');
  const [userId,      setUserId]      = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [page,        setPage]        = useState(1);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (entityType) qs.set('entityType', entityType);
  if (action)     qs.set('action',     action);
  if (userId)     qs.set('userId',     userId);
  if (dateFrom)   qs.set('dateFrom',   dateFrom);
  if (dateTo)     qs.set('dateTo',     dateTo);
  if (search)     qs.set('search',     search);
  qs.set('page',  String(page));
  qs.set('limit', '50');

  const { data: res, loading, error } = useQuery<AuditResponse>(
    `/audit-log?${qs}`,
    [entityType, action, userId, dateFrom, dateTo, search, page],
  );

  const entries    = res?.data ?? [];
  const total      = res?.total ?? 0;
  const totalPages = res ? Math.ceil(res.total / res.limit) : 0;

  function resetFilters() {
    setSearch(''); setEntityType(''); setAction('');
    setUserId(''); setDateFrom(''); setDateTo(''); setPage(1);
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">System Activity — every important action is recorded automatically</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => exportCsv(entries)}
          disabled={entries.length === 0}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="page-body space-y-4">
        {/* Filter bar */}
        <div className="card p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 260 }}>
              <svg className="w-4 h-4" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search actions, users, entities…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <div style={{ width: 150 }}>
              <SearchableCombobox
                options={ENTITY_OPTS}
                value={entityType}
                onChange={(v) => { setEntityType(v); setPage(1); }}
                placeholder="Entity Type"
                clearable
                clearLabel="All Entities"
              />
            </div>

            <div style={{ width: 150 }}>
              <SearchableCombobox
                options={ACTION_OPTS}
                value={action}
                onChange={(v) => { setAction(v); setPage(1); }}
                placeholder="Action"
                clearable
                clearLabel="All Actions"
              />
            </div>

            <div style={{ width: 140 }}>
              <label className="input-label">From</label>
              <input type="date" className="input"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            </div>

            <div style={{ width: 140 }}>
              <label className="input-label">To</label>
              <input type="date" className="input"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>

            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>

        {/* Note */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-bg)' }}>
          <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--warning-fg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span style={{ fontSize: '0.75rem', color: 'var(--warning-fg)' }}>
            System Audit Log — cannot be edited or deleted. {total > 0 ? `${total.toLocaleString()} records total.` : ''}
          </span>
        </div>

        {error && (
          <div className="card p-4" style={{ borderColor: 'var(--danger-bg)', background: 'var(--danger-bg)' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--danger-fg)' }}>{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Branch</th>
                <th style={{ minWidth: 260 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-3)' }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-3)' }}>
                    No audit records found matching your filters.
                  </td>
                </tr>
              )}
              {entries.map((entry) => {
                const { date, time } = fmtTimestamp(entry.createdAt);
                const expanded       = expandedId === entry.id;
                const hasChanges     = entry.changes && Object.keys(entry.changes).length > 0;

                return [
                  <tr
                    key={entry.id}
                    onClick={() => hasChanges && setExpandedId(expanded ? null : entry.id)}
                    style={{ cursor: hasChanges ? 'pointer' : 'default', background: expanded ? 'var(--surface-2)' : undefined }}
                  >
                    {/* Timestamp */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-1)' }}>{date}</p>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-3)' }}>{time}</p>
                    </td>

                    {/* User */}
                    <td>
                      {entry.user ? (
                        <div className="flex items-center gap-2">
                          <div className="avatar" style={{
                            width: 28, height: 28, fontSize: '0.6875rem', flexShrink: 0,
                            background: 'var(--info-bg)', color: 'var(--info-fg)',
                          }}>
                            {initials(entry.user.name)}
                          </div>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{entry.user.name}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>System</span>
                      )}
                    </td>

                    {/* Action badge */}
                    <td>
                      <span className={ACTION_BADGE[entry.action] ?? 'badge badge-neutral'}>
                        {entry.action}
                      </span>
                    </td>

                    {/* Entity */}
                    <td>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{entry.entityType}</p>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-3)' }}>
                        …{entry.entityId.slice(-8)}
                      </p>
                    </td>

                    {/* Branch */}
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
                      {entry.branch ?? '—'}
                    </td>

                    {/* Description */}
                    <td>
                      <div className="flex items-start justify-between gap-2">
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontStyle: expanded ? 'normal' : 'normal' }}>
                          {entry.description}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          {entry.ipAddress && (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-3)' }}>
                              {entry.ipAddress}
                            </span>
                          )}
                          {hasChanges && (
                            <svg
                              className="w-4 h-4 shrink-0"
                              style={{ color: 'var(--text-3)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>,

                  // Expanded diff row
                  expanded && entry.changes && (
                    <tr key={`${entry.id}-diff`}>
                      <td colSpan={6} style={{ padding: '0.75rem 1rem 1rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <p className="section-label" style={{ marginBottom: '0.5rem' }}>Changes</p>
                        <ChangeDiff changes={entry.changes as Record<string, { from: unknown; to: unknown }>} />
                      </td>
                    </tr>
                  ),
                ].filter(Boolean);
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              Page {page} of {totalPages} — {total.toLocaleString()} total records
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              {/* Page number pills */}
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = page <= 4 ? i + 1 : page - 3 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    className="btn btn-sm"
                    onClick={() => setPage(p)}
                    style={{
                      background: p === page ? 'var(--primary)' : 'var(--surface)',
                      color:      p === page ? 'var(--primary-fg)' : 'var(--text-2)',
                      border:     `1px solid ${p === page ? 'var(--primary)' : 'var(--border)'}`,
                      minWidth: 32,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
