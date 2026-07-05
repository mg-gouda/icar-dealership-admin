'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';

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

  const handleApprove = async (id: string) => {
    setActing(id);
    try {
      await apiFetch(`/transfers/${id}/approve`, { method: 'POST', body: JSON.stringify({}) });
      reload();
    } catch (err: any) { alert(err.message); }
    finally { setActing(null); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this transfer?')) return;
    setActing(id + '_cancel');
    try {
      await apiFetch(`/transfers/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) });
      reload();
    } catch (err: any) { alert(err.message); }
    finally { setActing(null); }
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inter-Location Transfers</h1>
          <p className="page-subtitle">Vehicle and fund movements between branches</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ New Transfer</button>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-2)' }}>No transfers found</td></tr>
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
                  <td>{new Date(t.createdAt).toLocaleDateString('en-EG')}</td>
                  <td>
                    {t.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={acting === t.id}
                          onClick={() => handleApprove(t.id)}
                        >
                          {acting === t.id ? '…' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-sm"
                          disabled={acting === t.id + '_cancel'}
                          onClick={() => handleCancel(t.id)}
                          style={{ color: 'var(--danger)' }}
                        >
                          Cancel
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
            <div className="modal-header"><h3>New Transfer</h3></div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                { label: 'From Location ID', key: 'fromLocationId', full: false },
                { label: 'To Location ID', key: 'toLocationId', full: false },
                { label: 'Vehicle ID', key: 'vehicleId', full: true },
                { label: 'Amount (EGP)', key: 'amount', type: 'number', full: false },
                { label: 'Notes', key: 'notes', full: true },
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
              <button type="button" className="btn" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={acting === 'add'}>
                {acting === 'add' ? 'Saving…' : 'Create Transfer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
