'use client';

import { useQuery } from '../../../lib/useApi';
import { useRouter } from 'next/navigation';
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
  const { data, loading, error } = useQuery<{ items: Appointment[]; total: number }>(
    '/appointments?limit=30',
  );

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
                </tr>
              ))}
              {appts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No appointments.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
