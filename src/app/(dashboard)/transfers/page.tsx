'use client';

import { useState, useEffect } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';
import { useLang } from '../../../lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

interface Transfer {
  id: string;
  fromLocationId: string;
  fromLocation: { id: string; name: string };
  toLocationId: string;
  toLocation: { id: string; name: string };
  vehicleId: string;
  vehicle: { id: string; make: string; model: string; year: number; vin: string };
  amount: number | string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  createdAt: string;
}

interface Location { id: string; name: string; }
interface Vehicle  { id: string; make: string; model: string; year: number; vin: string; price: number | string; salePrice: number | string | null; }

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'badge-warning',
  APPROVED:  'badge-success',
  CANCELLED: 'badge-neutral',
};

const fmt = (n: number | string | null | undefined) => {
  const v = Number(n);
  return isNaN(v) ? '—' : 'EGP ' + v.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export default function TransfersPage() {
  const { isAr } = useLang();
  const [addOpen, setAddOpen] = useState(false);
  const [acting, setActing]   = useState<string | null>(null);
  const [form, setForm] = useState({
    fromLocationId: '', toLocationId: '', vehicleId: '', amount: '', notes: '',
  });

  const { data, reload } = useQuery<{ data: Transfer[] }>('/transfers');
  const list = data?.data ?? [];

  // Locations for dropdowns
  const { data: locRaw } = useQuery<Location[]>('/locations');
  const locations = Array.isArray(locRaw) ? locRaw : [];
  const locOpts   = locations.map((l) => ({ value: l.id, label: l.name }));

  // Vehicles for VIN search
  const { data: vehRaw } = useQuery<{ items: Vehicle[] }>('/vehicles?limit=2000&status=AVAILABLE');
  const vehicles = vehRaw?.items ?? [];
  const vehicleOpts = vehicles.map((v) => ({
    value: v.id,
    label: `${v.vin ?? '—'}  ·  ${v.year} ${v.make} ${v.model}`,
  }));

  // Auto-fill amount when vehicle changes
  useEffect(() => {
    if (!form.vehicleId) return;
    const v = vehicles.find((x) => x.id === form.vehicleId);
    if (v) setForm((p) => ({ ...p, amount: String(v.salePrice ?? v.price) }));
  }, [form.vehicleId]); // ponytail: vehicles dep intentionally omitted

  const selectedVehicle = vehicles.find((v) => v.id === form.vehicleId);

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

  const handleApprove = async (id: string) => {
    if (!confirm(isAr ? 'تأكيد اعتماد التحويل؟' : 'Approve this transfer?')) return;
    setActing(id + ':approve');
    try { await apiFetch(`/transfers/${id}/approve`, { method: 'PATCH' }); reload(); }
    catch (err: any) { alert(err.message); }
    finally { setActing(null); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(isAr ? 'تأكيد إلغاء التحويل؟' : 'Cancel this transfer?')) return;
    setActing(id + ':cancel');
    try { await apiFetch(`/transfers/${id}/cancel`, { method: 'PATCH' }); reload(); }
    catch (err: any) { alert(err.message); }
    finally { setActing(null); }
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'تحويلات السيارات' : 'Inter-Location Transfers'}</h1>
          <p className="page-subtitle">{isAr ? 'تحويل السيارات بين الفروع' : 'Vehicle movements between branches'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>{isAr ? '+ تحويل جديد' : '+ New Transfer'}</button>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                <th>{isAr ? 'شاسيه VIN' : 'VIN'}</th>
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
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-2)' }}>
                    {isAr ? 'لا توجد تحويلات' : 'No transfers found'}
                  </td>
                </tr>
              )}
              {list.map(t => (
                <tr key={t.id}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                      {t.vehicle ? `${t.vehicle.year} ${t.vehicle.make} ${t.vehicle.model}` : '—'}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                      {t.vehicle?.vin ?? '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{t.fromLocation?.name ?? '—'}</td>
                  <td style={{ color: 'var(--text-2)' }}>{t.toLocation?.name  ?? '—'}</td>
                  <td style={{ tabularNums: true } as any}>{fmt(t.amount)}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-3)' }}>
                    {t.notes ?? '—'}
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-neutral'}`}>{t.status}</span></td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{fmtDate(t.createdAt, isAr)}</td>
                  <td>
                    {t.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={acting === t.id + ':approve'}
                          onClick={() => handleApprove(t.id)}
                        >
                          {acting === t.id + ':approve' ? '…' : (isAr ? 'اعتماد' : 'Approve')}
                        </button>
                        <button
                          className="btn btn-sm"
                          disabled={acting === t.id + ':cancel'}
                          onClick={() => handleCancel(t.id)}
                          style={{ color: 'var(--danger)' }}
                        >
                          {acting === t.id + ':cancel' ? '…' : (isAr ? 'إلغاء' : 'Cancel')}
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
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleAdd} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>{isAr ? 'تحويل جديد' : 'New Transfer'}</h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Locations row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label">{isAr ? 'الفرع المُرسِل' : 'From Location'}</label>
                  <SearchableCombobox
                    options={locOpts}
                    value={form.fromLocationId}
                    onChange={(v) => setForm(p => ({ ...p, fromLocationId: v }))}
                    placeholder={isAr ? 'اختر الفرع' : 'Select branch'}
                  />
                </div>
                <div>
                  <label className="field-label">{isAr ? 'الفرع المُستقبِل' : 'To Location'}</label>
                  <SearchableCombobox
                    options={locOpts.filter(o => o.value !== form.fromLocationId)}
                    value={form.toLocationId}
                    onChange={(v) => setForm(p => ({ ...p, toLocationId: v }))}
                    placeholder={isAr ? 'اختر الفرع' : 'Select branch'}
                  />
                </div>
              </div>

              {/* Vehicle VIN search */}
              <div>
                <label className="field-label">{isAr ? 'السيارة (بحث بالشاسيه VIN)' : 'Vehicle (search by VIN)'}</label>
                <SearchableCombobox
                  options={vehicleOpts}
                  value={form.vehicleId}
                  onChange={(v) => setForm(p => ({ ...p, vehicleId: v }))}
                  placeholder={isAr ? 'ابحث بالشاسيه أو الموديل…' : 'Search VIN or model…'}
                />
                {selectedVehicle && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>
                    {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    {selectedVehicle.vin ? ` · VIN: ${selectedVehicle.vin}` : ''}
                  </p>
                )}
              </div>

              {/* Amount — auto-filled from official price */}
              <div>
                <label className="field-label">
                  {isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'}
                  {selectedVehicle && (
                    <span style={{ fontWeight: 400, color: 'var(--text-3)', marginInlineStart: 6 }}>
                      {isAr ? '← السعر الرسمي' : '← auto-filled from official price'}
                    </span>
                  )}
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="field-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <input
                  className="input"
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder={isAr ? 'اختياري' : 'Optional'}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setAddOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={acting === 'add' || !form.fromLocationId || !form.toLocationId || !form.vehicleId || !form.amount}
              >
                {acting === 'add' ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إنشاء التحويل' : 'Create Transfer')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
