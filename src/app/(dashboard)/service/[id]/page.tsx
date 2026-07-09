'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import ScannerModal, { PART_FORMATS } from '../../../../components/ScannerModal';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

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
  const { isAr } = useLang();

  const LINE_TYPE_OPTS = [
    { value: 'LABOR', label: isAr ? 'عمالة' : 'Labor' },
    { value: 'PART', label: isAr ? 'قطعة' : 'Part' },
    { value: 'OTHER', label: isAr ? 'أخرى' : 'Other' },
  ];

  const { data: order, loading, error, reload } = useQuery<ServiceOrder>(`/service-orders/${id}`, [id]);

  const [showAddLine, setShowAddLine] = useState(false);
  const [lineForm, setLineForm] = useState({ lineType: 'LABOR', description: '', qty: '1', unitPrice: '' });
  const [showPartScanner, setShowPartScanner] = useState(false);
  const [scanningPart, setScanningPart] = useState(false);
  const [lineErr, setLineErr] = useState('');
  const [lineSaving, setLineSaving] = useState(false);

  const [actionErr, setActionErr] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const submitLine = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineForm.description || !lineForm.unitPrice) {
      setLineErr(isAr ? 'الوصف وسعر الوحدة مطلوبان.' : 'Description and unit price required.');
      return;
    }
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
      setLineErr(err instanceof Error ? err.message : (isAr ? 'خطأ في إضافة البند' : 'Error adding line'));
    } finally {
      setLineSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lineForm, reload, isAr]);

  const doAction = useCallback(async (endpoint: string, label: string) => {
    if (!window.confirm(`${label}?`)) return;
    setActionLoading(true); setActionErr('');
    try {
      await apiFetch(`/service-orders/${id}/${endpoint}`, { method: 'POST' });
      reload();
    } catch (err: unknown) {
      setActionErr(err instanceof Error ? err.message : (isAr ? 'فشل الإجراء' : 'Action failed'));
    } finally {
      setActionLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reload, isAr]);

  if (loading) {
    return (
      <div className="page-body">
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page-body">
        <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error ?? (isAr ? 'الأمر غير موجود' : 'Order not found')}</p>
      </div>
    );
  }

  const canComplete = order.status === 'INTAKE' || order.status === 'IN_PROGRESS';
  const canInvoice = order.status === 'COMPLETED';
  const orderNum = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(-6).toUpperCase()}`;

  return (
    <>
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/service" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← {isAr ? 'مركز الصيانة' : 'Service Center'}
            </Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ color: 'var(--text-1)', fontSize: '0.875rem', fontWeight: 500 }}>{orderNum}</span>
          </div>
          <h1 className="page-title">{isAr ? `أمر الصيانة ${orderNum}` : `Service Order ${orderNum}`}</h1>
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
              <p className="section-label" style={{ marginBottom: '1rem' }}>
                {isAr ? 'معلومات الأمر' : 'Order Information'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 2rem' }}>
                <div>
                  <p style={FIELD_LABEL}>{isAr ? 'السيارة' : 'Vehicle'}</p>
                  <p style={{ fontWeight: 500 }}>
                    {order.vehicle ? `${order.vehicle.year} ${order.vehicle.make} ${order.vehicle.model}` : '—'}
                  </p>
                  {order.vehicle?.licensePlate && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.vehicle.licensePlate}</p>
                  )}
                  {order.vehicle?.vin && (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{isAr ? 'الشاسيه' : 'VIN'}: {order.vehicle.vin}</p>
                  )}
                </div>
                <div>
                  <p style={FIELD_LABEL}>{isAr ? 'العميل' : 'Customer'}</p>
                  <p style={{ fontWeight: 500 }}>{order.customer?.name ?? '—'}</p>
                  {order.customer?.phone && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.customer.phone}</p>
                  )}
                  {order.customer?.email && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.customer.email}</p>
                  )}
                </div>
                <div>
                  <p style={FIELD_LABEL}>{isAr ? 'نوع الخدمة' : 'Service Type'}</p>
                  <p style={{ color: 'var(--text-2)' }}>{order.serviceType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p style={FIELD_LABEL}>{isAr ? 'الميكانيكي' : 'Technician'}</p>
                  <p style={{ color: 'var(--text-2)' }}>{order.technician?.name ?? '—'}</p>
                </div>
                <div>
                  <p style={FIELD_LABEL}>{isAr ? 'الموقع' : 'Location'}</p>
                  <p style={{ color: 'var(--text-2)' }}>{order.location?.name ?? '—'}</p>
                </div>
                <div>
                  <p style={FIELD_LABEL}>{isAr ? 'تاريخ الإنشاء' : 'Date Created'}</p>
                  <p style={{ color: 'var(--text-2)' }}>
                    {fmtDate(order.createdAt, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                {order.completedAt && (
                  <div>
                    <p style={FIELD_LABEL}>{isAr ? 'تاريخ الإكمال' : 'Completed'}</p>
                    <p style={{ color: 'var(--text-2)' }}>
                      {fmtDate(order.completedAt, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
              {order.description && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <p style={FIELD_LABEL}>{isAr ? 'الوصف' : 'Description'}</p>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>{order.description}</p>
                </div>
              )}
              {order.internalNotes && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={FIELD_LABEL}>{isAr ? 'ملاحظات داخلية' : 'Internal Notes'}</p>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>{order.internalNotes}</p>
                </div>
              )}
            </div>

            {/* Service lines */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <p className="section-label" style={{ margin: 0 }}>{isAr ? 'بنود الخدمة' : 'Service Lines'}</p>
                {order.status !== 'INVOICED' && order.status !== 'CANCELLED' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddLine((v) => !v)}>
                    {showAddLine ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? '+ إضافة بند' : '+ Add Line')}
                  </button>
                )}
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'النوع' : 'Type'}</th>
                    <th>{isAr ? 'الوصف' : 'Description'}</th>
                    <th style={{ textAlign: 'right' }}>{isAr ? 'الكمية' : 'Qty'}</th>
                    <th style={{ textAlign: 'right' }}>{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                    <th style={{ textAlign: 'right' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.lines ?? []).map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className={`badge ${lineTypeBadge(l.lineType)}`}>{isAr ? ({ LABOR: 'عمالة', PART: 'قطعة', OTHER: 'أخرى' }[l.lineType] ?? l.lineType) : l.lineType}</span>
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
                        {isAr ? 'لا توجد بنود. أضف عمالة أو قطع أعلاه.' : 'No lines yet. Add labor or parts above.'}
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
                    <label className="input-label">{isAr ? 'النوع' : 'Type'}</label>
                    <SearchableCombobox
                      options={LINE_TYPE_OPTS}
                      value={lineForm.lineType}
                      onChange={(v) => setLineForm({ ...lineForm, lineType: v })}
                    />
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label className="input-label">{isAr ? 'الوصف *' : 'Description *'}</label>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <input
                        className="input"
                        placeholder={isAr ? 'الوصف…' : 'Description…'}
                        value={lineForm.description}
                        onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                        required
                        style={{ flex: 1 }}
                      />
                      {lineForm.lineType === 'PART' && (
                        <button
                          type="button"
                          title={isAr ? 'مسح الباركود' : 'Scan part barcode'}
                          disabled={scanningPart}
                          onClick={() => setShowPartScanner(true)}
                          style={{
                            flexShrink: 0, width: 36, height: 38, borderRadius: 8,
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--primary)',
                          }}
                        >
                          {scanningPart ? '…' : (
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                              <path d="M1.5 5.5A1 1 0 0 1 2.5 4.5h1l1-2h5l1 2h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                              <circle cx="8" cy="9" r="2" stroke="currentColor" strokeWidth="1.2"/>
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 80 }}>
                    <label className="input-label">{isAr ? 'الكمية' : 'Qty'}</label>
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
                    <label className="input-label">{isAr ? 'سعر الوحدة *' : 'Unit Price *'}</label>
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
                    {lineSaving ? (isAr ? 'جاري الإضافة…' : 'Adding…') : (isAr ? 'إضافة' : 'Add')}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ── Right sticky column ──────────────────────────────────── */}
          <div style={{ position: 'sticky', top: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Summary */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'الملخص' : 'Summary'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-2)' }}>{isAr ? 'العمالة' : 'Labor'}</span>
                  <span className="tabular-nums">{fmt(Number(order.laborTotal ?? 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-2)' }}>{isAr ? 'القطع' : 'Parts'}</span>
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
                  <span>{isAr ? 'الإجمالي الكلي' : 'Grand Total'}</span>
                  <span className="tabular-nums" style={{ color: 'var(--primary)' }}>
                    {fmt(Number(order.total ?? 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <p className="section-label" style={{ marginBottom: '0.25rem' }}>{isAr ? 'الإجراءات' : 'Actions'}</p>
              {canComplete && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                  onClick={() => doAction('complete', isAr ? 'تعليم هذا الأمر كمكتمل' : 'Mark this order as complete')}
                >
                  {isAr ? 'تعليم كمكتمل' : 'Mark Complete'}
                </button>
              )}
              {canInvoice && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                  onClick={() => doAction('invoice', isAr ? 'إنشاء فاتورة لهذا الأمر' : 'Create invoice for this order')}
                >
                  {isAr ? 'إنشاء فاتورة' : 'Create Invoice'}
                </button>
              )}
              {!canComplete && !canInvoice && (
                <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                  {isAr ? 'لا توجد إجراءات متاحة للحالة الحالية.' : 'No actions available for current status.'}
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

    {showPartScanner && (
      <ScannerModal
        formats={PART_FORMATS}
        title={isAr ? 'مسح القطعة' : 'Scan Part'}
        hint={isAr ? 'امسح الباركود أو QR على قطعة الغيار أو عبوتها' : 'Scan the barcode or QR on the spare part or its packaging'}
        onScan={async (code) => {
          setShowPartScanner(false);
          setScanningPart(true);
          try {
            const part = await apiFetch<any>(`/parts/by-scan?code=${encodeURIComponent(code)}`);
            if (part) {
              setLineForm(f => ({
                ...f,
                lineType: 'PART',
                description: `${part.partNumber} — ${part.name}`,
                unitPrice: String(Number(part.salePrice ?? 0)),
              }));
            } else {
              setLineForm(f => ({ ...f, lineType: 'PART', description: code }));
              setLineErr(isAr ? `القطعة "${code}" غير موجودة في المخزن — أدخل التفاصيل يدوياً.` : `Part "${code}" not in inventory — enter details manually.`);
            }
          } catch {
            setLineForm(f => ({ ...f, lineType: 'PART', description: code }));
            setLineErr(isAr ? 'فشل البحث — تم ملء الكود، تحقق يدوياً.' : 'Lookup failed — filled code, verify manually.');
          } finally {
            setScanningPart(false);
          }
        }}
        onClose={() => setShowPartScanner(false)}
      />
    )}
    </>
  );
}
