'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import { useState } from 'react';
import { useLang } from '@/lib/lang-context';

interface Appointment {
  id: string; type: string; status: string; scheduledAt: string;
  customer: { id: string; name: string; phone?: string; email?: string };
  vehicle?: { id: string; make: string; model: string; year: number; vin: string };
  assignedTo: { id: string; name: string };
  location: { id: string; name: string };
  lead?: { id: string; name: string };
}

const TYPE_AR: Record<string, string> = {
  TEST_DRIVE: 'اختبار قيادة',
  CALL: 'مكالمة',
  MEETING: 'اجتماع',
  FOLLOW_UP: 'متابعة',
  SERVICE: 'خدمة',
  OTHER: 'أخرى',
};

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAr } = useLang();
  const { data: appt, loading, reload } = useQuery<Appointment>(`/appointments/${id}`);
  const [acting, setActing] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);

  async function action(path: string, body?: object) {
    setActing(true);
    try {
      await apiFetch(`/appointments/${id}/${path}`, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setActing(false); }
  }

  async function reschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleDate) return;
    setActing(true);
    try {
      await apiFetch(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledAt: new Date(rescheduleDate).toISOString() }),
      });
      setShowReschedule(false);
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setActing(false); }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">{isAr ? 'جاري التحميل…' : 'Loading…'}</div>;
  if (!appt) return <div className="p-6 text-red-400 text-sm">{isAr ? 'الموعد غير موجود.' : 'Appointment not found.'}</div>;

  const isScheduled = appt.status === 'SCHEDULED';

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/appointments" className="text-gray-500 hover:text-white text-xs transition">
          ← {isAr ? 'العودة للمواعيد' : 'Appointments'}
        </Link>
        <h1 className="text-xl font-semibold text-white">{isAr ? (TYPE_AR[appt.type] ?? appt.type) : appt.type.replace(/_/g, ' ')}</h1>
        <StatusBadge status={appt.status} />
      </div>

      {/* Actions */}
      {isScheduled && (
        <div className="flex gap-2 mb-6">
          <button onClick={() => action('complete')} disabled={acting}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg transition">
            {isAr ? 'تعليم كمكتمل' : 'Mark Complete'}
          </button>
          <button onClick={() => setShowReschedule(true)}
            className="px-4 py-2 text-sm text-blue-400 border border-blue-400/30 hover:bg-blue-400/10 rounded-lg transition">
            {isAr ? 'إعادة جدولة' : 'Reschedule'}
          </button>
          <button onClick={() => action('cancel')} disabled={acting}
            className="px-4 py-2 text-sm text-red-400 border border-red-400/30 hover:bg-red-400/10 rounded-lg transition">
            {isAr ? 'إلغاء الموعد' : 'Cancel'}
          </button>
        </div>
      )}

      {showReschedule && (
        <form onSubmit={reschedule} className="mb-6 flex items-end gap-3 p-4 rounded-xl bg-gray-900 border border-white/5">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              {isAr ? 'التاريخ والوقت الجديد' : 'New Date & Time'}
            </label>
            <input type="datetime-local" required value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
          <button type="submit" disabled={acting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
            {acting ? '…' : (isAr ? 'تأكيد' : 'Confirm')}
          </button>
          <button type="button" onClick={() => setShowReschedule(false)}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white transition">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </form>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {isAr ? 'الموعد' : 'Appointment'}
          </p>
          <div>
            <p className="text-xs text-gray-500">{isAr ? 'المجدول' : 'Scheduled'}</p>
            <p className="text-white text-sm">{new Date(appt.scheduledAt).toLocaleString('en-EG', { dateStyle: 'full', timeStyle: 'short' })}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{isAr ? 'النوع' : 'Type'}</p>
            <p className="text-white text-sm">{isAr ? (TYPE_AR[appt.type] ?? appt.type) : appt.type.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{isAr ? 'الموقع' : 'Location'}</p>
            <p className="text-white text-sm">{appt.location.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{isAr ? 'المندوب المعين' : 'Assigned Rep'}</p>
            <p className="text-white text-sm">{appt.assignedTo.name}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-gray-900 p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {isAr ? 'العميل' : 'Customer'}
          </p>
          <div>
            <p className="text-xs text-gray-500">{isAr ? 'الاسم' : 'Name'}</p>
            <p className="text-white text-sm">{appt.customer.name}</p>
          </div>
          {appt.customer.phone && (
            <div>
              <p className="text-xs text-gray-500">{isAr ? 'الهاتف' : 'Phone'}</p>
              <p className="text-white text-sm">{appt.customer.phone}</p>
            </div>
          )}
          {appt.customer.email && (
            <div>
              <p className="text-xs text-gray-500">{isAr ? 'البريد الإلكتروني' : 'Email'}</p>
              <p className="text-white text-sm">{appt.customer.email}</p>
            </div>
          )}
          {appt.lead && (
            <div>
              <p className="text-xs text-gray-500">{isAr ? 'العميل المحتمل' : 'Lead'}</p>
              <Link href={`/crm/${appt.lead.id}`} className="text-blue-400 hover:text-blue-300 text-sm transition">
                {appt.lead.name} →
              </Link>
            </div>
          )}
        </div>
      </div>

      {appt.vehicle && (
        <div className="mt-4 rounded-xl border border-white/5 bg-gray-900 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {isAr ? 'السيارة' : 'Vehicle'}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{appt.vehicle.year} {appt.vehicle.make} {appt.vehicle.model}</p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{isAr ? 'الشاسيه' : 'VIN'}: {appt.vehicle.vin}</p>
            </div>
            <Link href={`/vehicles/${appt.vehicle.id}`}
              className="text-xs text-blue-400 hover:text-blue-300 transition">
              {isAr ? '→ عرض السيارة' : 'View vehicle →'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
