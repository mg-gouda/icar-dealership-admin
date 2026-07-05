'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ServiceLine {
  id: string;
  lineType: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface ServiceOrder {
  id: string;
  orderNumber?: string;
  status: string;
  serviceType: string;
  vehicle?: { make: string; model: string; year: number; licensePlate?: string; vin?: string };
  customer?: { name: string; phone?: string; email?: string };
  technician?: { name: string };
  location?: { name: string };
  description?: string;
  internalNotes?: string;
  createdAt: string;
  completedAt?: string;
  lines: ServiceLine[];
  laborTotal: number;
  partsTotal: number;
  total: number;
}

const LINE_TYPE_OPTS = [
  { value: 'LABOR', label: 'Labor' },
  { value: 'PART', label: 'Part' },
  { value: 'OTHER', label: 'Other' },
];

function lineTypeBadge(t: string): string {
  if (t === 'LABOR') return 'badge-info';
  if (t === 'PART') return 'badge-success';
  return 'badge-neutral';
}

function statusBadgeClass(s: string): string {
  const map: Record<string, string> = {
    INTAKE: 'badge-info', IN_PROGRESS: 'badge-warning',
    COMPLETED: 'badge-success', INVOICED: 'badge-neutral', CANCELLED: 'badge-danger',
  };
  return map[s] ?? 'badge-neutral';
}

const FIELD_LABEL: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '0.2rem',
};

export default function ServiceOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: order, loading, error, reload } = useQuery<ServiceOrder>(`/service-orders/${id}`, [id]);

  const [showAddLine, setShowAddLine] = useState(false);
  const [lineForm, setLineForm] = useState({ lineType: 'LABOR', description: '', qty: '1', unitPrice: '' });
  const [lineErr, setLineErr] = useState('');
  const [lineSaving, setLineSaving] = useState(false);

  const [actionErr, setActionErr] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const submitLine = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineForm.description || !lineForm.unitPrice) { setLineErr('Description and unit price required.'); return; }
    setLineSaving(true); setLineErr('');
    try {
      await apiFetch(`/service-orders/${id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          lineType: lineForm.lineType,
          description: lineForm.description,
          qty: Number(lineForm.qty) || 1,
          unitPrice: Number(lineForm.unitPrice),
        }),
      });
      setLineForm({ lineType: 'LABOR', description: '', qty: '1', unitPrice: '' });
      setShowAddLine(false);
      reload();
    } catch (err: unknown) {
      setLineErr(err instanceof Error ? err.message : 'Error adding line');
    } finally {
      setLineSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lineForm, reload]);

  const doAction = useCallback(async (endpoint: string, label: string) => {
    if (!window.confirm(`${label}?`)) return;
    setActionLoading(true); setActionErr('');
    try {
      await apiFetch(`/service-orders/${id}/${endpoint}`, { method: 'POST' });
      reload();
    } catch (err: unknown) {
      setActionErr(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reload]);

  if (loading) {
    return (
      <div className="page-body">
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page-body">
        <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error ?? 'Order not found'}</p>
      </div>
    );
  }

  const canComplete = order.status === 'INTAKE' || order.status === 'IN_PROGRESS';
  const canInvoice = order.status === 'COMPLETED';
  const orderNum = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(-6).toUpperCase()}`;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/service" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← Service Center
            </Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ color: 'var(--text-1)', fontSize: '0.875rem', fontWeight: 500 }}>{orderNum}</span>
          </div>
          <h1 className="page-title">Service Order {orderNum}</h1>
        </div>
        <span
          className={`badge ${statusBadgeClass(order.status)}`}
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
        >
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── Left column ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Order info */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '1rem' }}>Order Information</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 2rem' }}>
                <div>
                  <p style={FIELD_LABEL}>Vehicle</p>
                  <p style={{ fontWeight: 500 }}>
                    {order.vehicle ? `${order.vehicle.year} ${order.vehicle.make} ${order.vehicle.model}` : '—'}
                  </p>
                  {order.vehicle?.licensePlate && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.vehicle.licensePlate}</p>
                  )}
                  {order.vehicle?.vin && (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>VIN: {order.vehicle.vin}</p>
                  )}
                </div>
                <div>
                  <p style={FIELD_LABEL}>Customer</p>
                  <p style={{ fontWeight: 500 }}>{order.customer?.name ?? '—'}</p>
                  {order.customer?.phone && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.customer.phone}</p>
                  )}
                  {order.customer?.email && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.customer.email}</p>
                  )}
                </div>
                <div>
                  <p style={FIELD_LABEL}>Service Type</p>
                  <p style={{ color: 'var(--text-2)' }}>{order.serviceType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p style={FIELD_LABEL}>Technician</p>
                  <p style={{ color: 'var(--text-2)' }}>{order.technician?.name ?? '—'}</p>
                </div>
                <div>
                  <p style={FIELD_LABEL}>Location</p>
                  <p style={{ color: 'var(--text-2)' }}>{order.location?.name ?? '—'}</p>
                </div>
                <div>
                  <p style={FIELD_LABEL}>Date Created</p>
                  <p style={{ color: 'var(--text-2)' }}>
                    {new Date(order.createdAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                {order.completedAt && (
                  <div>
                    <p style={FIELD_LABEL}>Completed</p>
                    <p style={{ color: 'var(--text-2)' }}>
                      {new Date(order.completedAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
              {order.description && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <p style={FIELD_LABEL}>Description</p>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>{order.description}</p>
                </div>
              )}
              {order.internalNotes && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={FIELD_LABEL}>Internal Notes</p>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>{order.internalNotes}</p>
                </div>
              )}
            </div>

            {/* Service lines */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <p className="section-label" style={{ margin: 0 }}>Service Lines</p>
                {order.status !== 'INVOICED' && order.status !== 'CANCELLED' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddLine((v) => !v)}>
                    {showAddLine ? 'Cancel' : '+ Add Line'}
                  </button>
                )}
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.lines ?? []).map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className={`badge ${lineTypeBadge(l.lineType)}`}>{l.lineType}</span>
                      </td>
                      <td style={{ color: 'var(--text-1)' }}>{l.description}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{l.qty}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmt(Number(l.unitPrice))}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(Number(l.total))}</td>
                    </tr>
                  ))}
                  {(order.lines ?? []).length === 0 && !showAddLine && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                        No lines yet. Add labor or parts above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add Line inline form */}
              {showAddLine && (
                <form
                  onSubmit={submitLine}
                  style={{
                    padding: '1rem 1.25rem',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    alignItems: 'flex-end',
                  }}
                >
                  <div style={{ width: 130 }}>
                    <label className="input-label">Type</label>
                    <SearchableCombobox
                      options={LINE_TYPE_OPTS}
                      value={lineForm.lineType}
                      onChange={(v) => setLineForm({ ...lineForm, lineType: v })}
                    />
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label className="input-label">Description *</label>
                    <input
                      className="input"
                      placeholder="Description…"
                      value={lineForm.description}
                      onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <label className="input-label">Qty</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="input"
                      value={lineForm.qty}
                      onChange={(e) => setLineForm({ ...lineForm, qty: e.target.value })}
                    />
                  </div>
                  <div style={{ width: 130 }}>
                    <label className="input-label">Unit Price *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="0.00"
                      value={lineForm.unitPrice}
                      onChange={(e) => setLineForm({ ...lineForm, unitPrice: e.target.value })}
                      required
                    />
                  </div>
                  {lineErr && (
                    <p style={{ width: '100%', color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{lineErr}</p>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={lineSaving}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {lineSaving ? 'Adding…' : 'Add'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ── Right sticky column ──────────────────────────────────── */}
          <div style={{ position: 'sticky', top: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Summary */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '1rem' }}>Summary</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-2)' }}>Labor</span>
                  <span className="tabular-nums">{fmt(Number(order.laborTotal ?? 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-2)' }}>Parts</span>
                  <span className="tabular-nums">{fmt(Number(order.partsTotal ?? 0))}</span>
                </div>
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: '0.6rem',
                    marginTop: '0.2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                  }}
                >
                  <span>Grand Total</span>
                  <span className="tabular-nums" style={{ color: 'var(--primary)' }}>
                    {fmt(Number(order.total ?? 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <p className="section-label" style={{ marginBottom: '0.25rem' }}>Actions</p>
              {canComplete && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                  onClick={() => doAction('complete', 'Mark this order as complete')}
                >
                  Mark Complete
                </button>
              )}
              {canInvoice && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                  onClick={() => doAction('invoice', 'Create invoice for this order')}
                >
                  Create Invoice
                </button>
              )}
              {!canComplete && !canInvoice && (
                <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                  No actions available for current status.
                </p>
              )}
              {actionErr && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{actionErr}</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
