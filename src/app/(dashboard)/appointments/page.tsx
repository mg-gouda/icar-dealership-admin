'use client';

import { useQuery, apiFetch } from '../../../lib/useApi';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import StatusBadge from '../../../components/StatusBadge';

interface Appointment {
  id: string;
  scheduledAt: string;
  type: string;
  status: string;
  notes?: string;
  lead?: { name: string };
  customer?: { name: string };
  assignedTo?: { name: string };
  vehicle?: { make: string; model: string; year: number };
}

// ponytail: status→pill color
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  COMPLETED:  'bg-green-500/20 text-green-300 border-green-500/30',
  CANCELLED:  'bg-gray-500/20 text-gray-400 border-gray-500/30',
  NO_SHOW:    'bg-red-500/20 text-red-300 border-red-500/30',
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Build 6-week grid starting from Monday before/on 1st of month
function buildCalendarGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  // Monday=0..Sunday=6 offset
  const dow = (first.getDay() + 6) % 7; // Mon-based
  const start = new Date(first);
  start.setDate(first.getDate() - dow);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function CalendarView({ calendarDate, onNavigate }: {
  calendarDate: Date;
  onNavigate: (d: Date) => void;
}) {
  const router = useRouter();
  const from = isoDate(startOfMonth(calendarDate));
  const to = isoDate(endOfMonth(calendarDate));

  const { data, loading } = useQuery<{ items: Appointment[]; total: number } | Appointment[]>(
    `/appointments?dateFrom=${from}&dateTo=${to}&limit=200`,
    [from],
  );

  const appts: Appointment[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if ('items' in data) return data.items;
    return [];
  }, [data]);

  // Map ISO date → appointments
  const byDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appts.forEach((a) => {
      const d = a.scheduledAt.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(a);
    });
    return map;
  }, [appts]);

  const cells = buildCalendarGrid(calendarDate);
  const today = isoDate(new Date());
  const monthStr = calendarDate.toLocaleDateString('en-EG', { month: 'long', year: 'numeric' });

  function prevMonth() {
    onNavigate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  }
  function nextMonth() {
    onNavigate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  }
  function goToday() {
    onNavigate(new Date());
  }

  return (
    <div>
      {/* Calendar nav */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="px-2 py-1 text-gray-400 hover:text-white border border-white/10 rounded-lg text-sm transition">
          &lt;
        </button>
        <span className="text-sm font-semibold text-white min-w-[140px] text-center">{monthStr}</span>
        <button onClick={nextMonth} className="px-2 py-1 text-gray-400 hover:text-white border border-white/10 rounded-lg text-sm transition">
          &gt;
        </button>
        <button onClick={goToday} className="px-2 py-1 text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg transition">
          Today
        </button>
        {loading && <span className="text-xs text-gray-600">Loading…</span>}
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-500 py-1.5 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/5">
        {cells.map((cell) => {
          const key = isoDate(cell);
          const isCurrentMonth = cell.getMonth() === calendarDate.getMonth();
          const isToday = key === today;
          const dayAppts = byDate[key] ?? [];
          return (
            <div
              key={key}
              className={`min-h-[90px] p-1.5 ${isCurrentMonth ? 'bg-gray-900' : 'bg-gray-950'} ${isToday ? 'ring-1 ring-inset ring-blue-500/40' : ''}`}
            >
              <span className={`text-xs font-medium block mb-1 w-5 h-5 flex items-center justify-center rounded-full
                ${isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}`}>
                {cell.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayAppts.slice(0, 3).map((a) => {
                  const name = a.lead?.name ?? a.customer?.name ?? '—';
                  const time = new Date(a.scheduledAt).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit', hour12: false });
                  return (
                    <button
                      key={a.id}
                      onClick={() => router.push(`/appointments/${a.id}`)}
                      className={`w-full text-left text-[10px] px-1 py-0.5 rounded border truncate ${STATUS_COLOR[a.status] ?? STATUS_COLOR.SCHEDULED}`}
                    >
                      {time} {name}
                    </button>
                  );
                })}
                {dayAppts.length > 3 && (
                  <span className="text-[10px] text-gray-600 pl-1">+{dayAppts.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());

  const { data, loading, error, reload } = useQuery<{ items: Appointment[]; total: number }>(
    '/appointments?limit=30',
  );

  const [acting, setActing] = useState<Record<string, boolean>>({});

  async function updateStatus(apptId: string, status: string) {
    setActing((p) => ({ ...p, [apptId]: true }));
    try {
      await apiFetch(`/appointments/${apptId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      reload();
    } finally {
      setActing((p) => ({ ...p, [apptId]: false }));
    }
  }

  const appts = data?.items ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Appointments</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data?.total ?? 0} scheduled</p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Calendar
          </button>
        </div>
      </div>

      {viewMode === 'calendar' && (
        <CalendarView calendarDate={calendarDate} onNavigate={setCalendarDate} />
      )}

      {viewMode === 'list' && (
        <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
          {loading && <p className="p-6 text-gray-500 text-sm">Loading…</p>}
          {error && <p className="p-6 text-red-400 text-sm">{error}</p>}
          {!loading && (
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 text-gray-400 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Lead</th>
                  <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium">Assigned To</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {appts.map((a) => (
                  <tr key={a.id} onClick={() => router.push(`/appointments/${a.id}`)} className="hover:bg-white/5 cursor-pointer transition">
                    <td className="px-4 py-2.5 text-gray-300 text-xs">
                      {new Date(a.scheduledAt).toLocaleString('en-EG', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{a.type}</td>
                    <td className="px-4 py-2.5 text-white">{a.lead?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-300 text-xs">
                      {a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{a.assignedTo?.name ?? '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {a.status === 'SCHEDULED' && (
                          <button
                            disabled={!!acting[a.id]}
                            onClick={() => updateStatus(a.id, 'CONFIRMED')}
                            className="px-2 py-0.5 text-xs font-medium rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 disabled:opacity-50 transition">
                            {acting[a.id] ? '…' : 'Confirm'}
                          </button>
                        )}
                        {a.status === 'CONFIRMED' && (
                          <>
                            <button
                              disabled={!!acting[a.id]}
                              onClick={() => updateStatus(a.id, 'COMPLETED')}
                              className="px-2 py-0.5 text-xs font-medium rounded bg-green-600/20 text-green-300 hover:bg-green-600/40 disabled:opacity-50 transition">
                              {acting[a.id] ? '…' : 'Complete'}
                            </button>
                            <button
                              disabled={!!acting[a.id]}
                              onClick={() => updateStatus(a.id, 'CANCELLED')}
                              className="px-2 py-0.5 text-xs font-medium rounded bg-red-600/20 text-red-300 hover:bg-red-600/40 disabled:opacity-50 transition">
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {appts.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">No appointments.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
