'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';
import { useLang } from '../../../lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface Transfer {
  id: string;
  fromLocationId: string;
  fromLocation?: { name: string };
  toLocationId: string;
  toLocation?: { name: string };
  vehicleId: string;
  vehicle?: { make: string; model: string; year: number; vin: string };
  amount: number;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-warning',
  APPROVED: 'badge-success',
  CANCELLED: 'badge-neutral',
};

const fmt = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function TransfersPage() {
  const { isAr } = useLang();
  const [addOpen, setAddOpen] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [form, setForm] = useState({
    fromLocationId: '', toLocationId: '', vehicleId: '', amount: '', notes: '',
  });

  const { data, reload } = useQuery<{ data: Transfer[] }>('/transfers');
  const list = data?.data ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setActing('add');
    try {
      await apiFetch('/transfers', {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setAddOpen(false);
      setForm({ fromLocationId: '', toLocationId: '', vehicleId: '', amount: '', notes: '' });
      reload();
    } catch (err: any) { alert(err.message); }
    finally { setActing(null); }
  };

  // ponytail: approve/cancel not yet implemented on API — buttons disabled
  const handleApprove = (_id: string) => {};
  const handleCancel = (_id: string) => {};

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'تحويلات السيارات' : 'Inter-Location Transfers'}</h1>
          <p className="page-subtitle">{isAr ? 'تحويل السيارات بين الفروع' : 'Vehicle and fund movements between branches'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>{isAr ? '+ تحويل جديد' : '+ New Transfer'}</button>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                <th>{isAr ? 'من' : 'From'}</th>
                <th>{isAr ? 'إلى' : 'To'}</th>
                <th>{isAr ? 'المبلغ' : 'Amount'}</th>
                <th>{isAr ? 'ملاحظات' : 'Notes'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'التاريخ' : 'Date'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-2)' }}>{isAr ? 'لا توجد تحويلات' : 'No transfers found'}</td></tr>
              )}
              {list.map(t => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {t.vehicle ? `${t.vehicle.year} ${t.vehicle.make} ${t.vehicle.model}` : t.vehicleId}
                    </div>
                    {t.vehicle?.vin && <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{t.vehicle.vin}</div>}
                  </td>
                  <td>{t.fromLocation?.name ?? t.fromLocationId}</td>
                  <td>{t.toLocation?.name ?? t.toLocationId}</td>
                  <td>{fmt(t.amount)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.notes ?? '—'}
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-neutral'}`}>{t.status}</span></td>
                  <td>{fmtDate(t.createdAt, isAr)}</td>
                  <td>
                    {t.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          disabled
                          title={isAr ? 'غير متاح بعد' : 'Not yet available'}
                        >
                          {isAr ? 'اعتماد' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-sm"
                          disabled
                          title={isAr ? 'غير متاح بعد' : 'Not yet available'}
                          style={{ color: 'var(--danger)' }}
                        >
                          {isAr ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleAdd}>
            <div className="modal-header"><h3>{isAr ? 'تحويل جديد' : 'New Transfer'}</h3></div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                { label: isAr ? 'معرف الفرع المُرسِل' : 'From Location ID', key: 'fromLocationId', full: false },
                { label: isAr ? 'معرف الفرع المُستقبِل' : 'To Location ID', key: 'toLocationId', full: false },
                { label: isAr ? 'معرف السيارة' : 'Vehicle ID', key: 'vehicleId', full: true },
                { label: isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)', key: 'amount', type: 'number', full: false },
                { label: isAr ? 'ملاحظات' : 'Notes', key: 'notes', full: true },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1 / -1' : undefined }}>
                  <label className="field-label">{f.label}</label>
                  <input
                    className="input"
                    type={f.type ?? 'text'}
                    step={f.type === 'number' ? '0.01' : undefined}
                    required={f.key !== 'notes'}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setAddOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" className="btn btn-primary" disabled={acting === 'add'}>
                {acting === 'add' ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إنشاء التحويل' : 'Create Transfer')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
