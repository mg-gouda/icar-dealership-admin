'use client';

import { useQuery, apiFetch } from '../../../lib/useApi';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import StatusBadge from '../../../components/StatusBadge';

interface Appointment {
  id: string;
  scheduledAt: string;
  type: string;
  status: string;
  notes?: string;
  lead?: { name: string };
  assignedTo?: { name: string };
  vehicle?: { make: string; model: string; year: number };
}

export default function AppointmentsPage() {
  const router = useRouter();
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
      </div>

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
    </div>
  );
}
