'use client';

import { useState } from 'react';
import { useQuery } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'POST', label: 'POST' },
  { value: 'REVERSE', label: 'REVERSE' },
  { value: 'FINALIZE', label: 'FINALIZE' },
  { value: 'CANCEL', label: 'CANCEL' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'LOGOUT', label: 'LOGOUT' },
  { value: 'LOCK_OVERRIDE', label: 'LOCK_OVERRIDE' },
  { value: 'REMINDER_SENT', label: 'REMINDER_SENT' },
];

interface AuditEntry {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (entityType) params.set('entityType', entityType);
  if (action) params.set('action', action);
  if (userId) params.set('userId', userId);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  params.set('page', String(page));
  params.set('limit', '50');

  const path = `/audit-log?${params.toString()}`;
  const { data: res, loading, error } = useQuery<AuditResponse>(path, [entityType, action, userId, dateFrom, dateTo, page]);

  const totalPages = res ? Math.ceil(res.total / res.limit) : 0;

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function resetFilters() {
    setEntityType('');
    setAction('');
    setUserId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  function truncateJson(obj: unknown, maxLen = 80): string {
    if (!obj) return '';
    const s = JSON.stringify(obj);
    return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-semibold text-white">Audit Log</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Entity Type</label>
          <input
            type="text"
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            placeholder="e.g. Deal, Invoice"
            className="bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <SearchableCombobox
          label="Action"
          options={ACTION_OPTIONS}
          value={action}
          onChange={(v) => { setAction(v); setPage(1); }}
          clearable
          clearLabel="All"
          className="w-44"
        />

        <div>
          <label className="block text-xs text-gray-500 mb-1">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setPage(1); }}
            placeholder="User ID"
            className="bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={resetFilters}
          className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition"
        >
          Reset
        </button>
      </div>

      {/* Error */}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-900 text-gray-500 border-b border-white/5">
              <th className="text-left px-4 py-2.5 font-medium">Timestamp</th>
              <th className="text-left px-4 py-2.5 font-medium">User</th>
              <th className="text-left px-4 py-2.5 font-medium">Action</th>
              <th className="text-left px-4 py-2.5 font-medium">Entity Type</th>
              <th className="text-left px-4 py-2.5 font-medium">Entity ID</th>
              <th className="text-left px-4 py-2.5 font-medium">Changes</th>
            </tr>
          </thead>
          <tbody>
            {loading && !res && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td>
              </tr>
            )}
            {res?.data.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">No audit records found.</td>
              </tr>
            )}
            {res?.data.map((entry) => (
              <tr key={entry.id} className="group">
                <td colSpan={6} className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleRow(entry.id)}
                    className="w-full text-left grid grid-cols-6 px-4 py-2.5 border-b border-white/5 hover:bg-white/[0.03] transition"
                  >
                    <span className="text-gray-300">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    <span className="text-gray-300" title={entry.user.email}>
                      {entry.user.name}
                    </span>
                    <span>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-300">
                        {entry.action}
                      </span>
                    </span>
                    <span className="text-gray-300">{entry.entityType}</span>
                    <span className="text-gray-500 font-mono truncate" title={entry.entityId}>
                      {entry.entityId.slice(-12)}
                    </span>
                    <span className="text-gray-500 truncate">
                      {truncateJson(entry.changes)}
                    </span>
                  </button>

                  {expandedId === entry.id && entry.changes && (
                    <div className="px-4 py-3 bg-gray-900/50 border-b border-white/5">
                      <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Full Changes</p>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all max-h-64 overflow-y-auto font-mono bg-gray-950/50 rounded-lg p-3">
                        {JSON.stringify(entry.changes, null, 2)}
                      </pre>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Page {page} of {totalPages} ({res?.total} records)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
