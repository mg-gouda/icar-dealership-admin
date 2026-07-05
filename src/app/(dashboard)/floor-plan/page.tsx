'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';

interface FloorPlanNote {
  id: string;
  lender: string;
  vehicleId: string;
  vehicle?: { make: string; model: string; year: number; vin: string };
  principalAmount: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
  status: 'ACTIVE' | 'PAID_OFF' | 'OVERDUE' | 'CURTAILED';
  paidOffDate?: string;
  paidOffAmount?: number;
  locationId: string;
  location?: { name: string };
}

interface SummaryItem { lender: string; count: number; totalPrincipal: number }

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-success',
  PAID_OFF: 'badge-neutral',
  OVERDUE: 'badge-danger',
  CURTAILED: 'badge-warning',
};

const fmt = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function FloorPlanPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [payOffId, setPayOffId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [form, setForm] = useState({
    lender: '', vehicleId: '', principalAmount: '', interestRate: '',
    startDate: '', maturityDate: '', locationId: '',
  });

  const { data: notes, reload } = useQuery<{ data: FloorPlanNote[] }>('/floor-plan');
  const { data: summary } = useQuery<{ data: SummaryItem[] }>('/floor-plan/summary');

  const list = notes?.data ?? [];
  const summaryRows = summary?.data ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setActing(true);
    try {
      await apiFetch('/floor-plan', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          principalAmount: Number(form.principalAmount),
          interestRate: Number(form.interestRate),
        }),
      });
      setAddOpen(false);
      setForm({ lender: '', vehicleId: '', principalAmount: '', interestRate: '', startDate: '', maturityDate: '', locationId: '' });
      reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const handlePayOff = async (id: string) => {
    setActing(true);
    try {
      await apiFetch(`/floor-plan/${id}/pay-off`, { method: 'POST', body: JSON.stringify({}) });
      setPayOffId(null);
      reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Floor Plan Financing</h1>
          <p className="page-subtitle">Vehicle financing notes by lender</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ New Note</button>
      </div>

      {/* Summary strip */}
      {summaryRows.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {summaryRows.map(s => (
            <div key={s.lender} className="card" style={{ flex: '1 1 200px', padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>{s.lender}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{fmt(s.totalPrincipal)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{s.count} active note{s.count !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Lender</th>
                <th>Principal</th>
                <th>Rate</th>
                <th>Start</th>
                <th>Maturity</th>
                <th>Status</th>
                <th>Location</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-2)' }}>No floor plan notes</td></tr>
              )}
              {list.map(n => (
                <tr key={n.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{n.vehicle ? `${n.vehicle.year} ${n.vehicle.make} ${n.vehicle.model}` : n.vehicleId}</div>
                    {n.vehicle?.vin && <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{n.vehicle.vin}</div>}
                  </td>
                  <td>{n.lender}</td>
                  <td>{fmt(n.principalAmount)}</td>
                  <td>{n.interestRate}%</td>
                  <td>{new Date(n.startDate).toLocaleDateString('en-EG')}</td>
                  <td style={{ color: new Date(n.maturityDate) < new Date() && n.status === 'ACTIVE' ? 'var(--danger)' : 'inherit' }}>
                    {new Date(n.maturityDate).toLocaleDateString('en-EG')}
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[n.status] ?? 'badge-neutral'}`}>{n.status.replace('_', ' ')}</span></td>
                  <td>{n.location?.name ?? '—'}</td>
                  <td>
                    {n.status === 'ACTIVE' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => setPayOffId(n.id)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        Pay Off
                      </button>
                    )}
                    {n.status === 'PAID_OFF' && n.paidOffAmount && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{fmt(n.paidOffAmount)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay-off confirm modal */}
      {payOffId && (
        <div className="modal-backdrop" onClick={() => setPayOffId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Pay-Off</h3></div>
            <div className="modal-body">
              <p>Post the GL entry (DR Floor Plan Payable / CR Bank) and mark this note as Paid Off?</p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setPayOffId(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={acting} onClick={() => handlePayOff(payOffId)}>
                {acting ? 'Posting…' : 'Confirm Pay-Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New note modal */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleAdd}>
            <div className="modal-header"><h3>New Floor Plan Note</h3></div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                { label: 'Lender', key: 'lender', type: 'text', full: true },
                { label: 'Vehicle ID', key: 'vehicleId', type: 'text', full: true },
                { label: 'Principal (EGP)', key: 'principalAmount', type: 'number' },
                { label: 'Interest Rate (%)', key: 'interestRate', type: 'number' },
                { label: 'Start Date', key: 'startDate', type: 'date' },
                { label: 'Maturity Date', key: 'maturityDate', type: 'date' },
                { label: 'Location ID', key: 'locationId', type: 'text', full: true },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1 / -1' : undefined }}>
                  <label className="field-label">{f.label}</label>
                  <input
                    className="input"
                    type={f.type}
                    step={f.type === 'number' ? '0.01' : undefined}
                    required
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={acting}>
                {acting ? 'Saving…' : 'Create Note'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
