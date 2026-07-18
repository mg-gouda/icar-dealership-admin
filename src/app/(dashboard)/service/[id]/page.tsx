'use client';

import Link from 'next/link';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import ScannerModal, { PART_FORMATS } from '../../../../components/ScannerModal';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface PartResult {
  id: string; partNumber: string; name: string;
  salePrice: number; onHand: number; unitOfMeasure: string;
}

function PartPicker({ onSelect, isAr }: {
  onSelect: (part: PartResult) => void;
  isAr: boolean;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PartResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function search(val: string) {
    setQ(val); setSelected(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ data: PartResult[] }>(`/parts?q=${encodeURIComponent(val)}&limit=20`);
        setResults(res?.data ?? []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 280);
  }

  function pick(part: PartResult) {
    setSelected(part); setOpen(false); setQ('');
    onSelect(part);
  }

  function clear() { setSelected(null); setQ(''); setResults([]); }

  if (selected) {
    return (
      <div style={{ padding: '0.625rem 0.75rem', background: 'color-mix(in srgb, var(--primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-1)', margin: 0 }}>{selected.name}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.1rem 0 0' }}>
            {selected.partNumber} · {isAr ? 'المتاح' : 'Stock'}: {Number(selected.onHand)} {selected.unitOfMeasure}
          </p>
        </div>
        <button type="button" onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1rem', lineHeight: 1, padding: '0.125rem' }}>×</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.4rem', padding: '0.4rem 0.625rem' }}>
        <svg style={{ width: '0.875rem', height: '0.875rem', color: 'var(--text-3)', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8125rem', color: 'var(--text-1)', width: '100%' }}
          placeholder={isAr ? 'بحث عن القطعة بالاسم أو الكود…' : 'Search by name, part #, OEM…'}
          value={q}
          onChange={e => search(e.target.value)}
        />
        {loading && <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', flexShrink: 0 }}>…</span>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px oklch(0 0 0 / 0.14)', overflow: 'hidden' }}>
          <div style={{ maxHeight: '13rem', overflowY: 'auto' }}>
            {results.map(p => (
              <button key={p.id} type="button" onClick={() => pick(p)}
                style={{ width: '100%', textAlign: 'start', padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontWeight: 500, fontSize: '0.825rem', color: 'var(--text-1)' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', gap: '0.5rem', marginTop: '0.1rem' }}>
                  <span>{p.partNumber}</span>
                  <span>·</span>
                  <span style={{ color: Number(p.onHand) > 0 ? 'var(--success-fg)' : 'var(--danger)' }}>
                    {isAr ? 'متاح' : 'Stock'}: {Number(p.onHand)} {p.unitOfMeasure}
                  </span>
                  <span>·</span>
                  <span>EGP {Number(p.salePrice).toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {open && results.length === 0 && !loading && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-3)' }}>
          {isAr ? 'لا توجد قطع مطابقة' : 'No parts found'}
        </div>
      )}
    </div>
  );
}

const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ServiceLine {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ServiceOrder {
  id: string;
  orderNumber?: string;
  status: string;
  type: string;
  vehicle?: { make: string; model: string; year: number; regLicenseNumber?: string; vin?: string };
  externalVehicle?: { licensePlate: string; make: string; model: string; year?: number; color?: string; regNumber?: string; ownerName: string; ownerPhone: string; serviceOrders?: { id: string; orderNumber: string; status: string; createdAt: string; totalAmount: number }[] };
  customer?: { name: string; phone?: string; email?: string };
  walkInCustomerName?: string;
  walkInCustomerPhone?: string;
  technician?: { name: string };
  location?: { name: string };
  description?: string;
  internalNotes?: string;
  createdAt: string;
  completedAt?: string;
  lines: ServiceLine[];
  laborTotal: number;
  partsTotal: number;
  totalAmount: number;
}

function lineTypeBadge(t: string): string {
  if (t === 'LABOR')      return 'badge-info';
  if (t === 'PART')       return 'badge-success';
  if (t === 'CONSUMABLE') return 'badge-warning';
  if (t === 'SUBLET')     return 'badge-neutral';
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
    { value: 'LABOR',      label: isAr ? 'عمالة'      : 'Labor'       },
    { value: 'PART',       label: isAr ? 'قطعة غيار'  : 'Spare Part'  },
    { value: 'CONSUMABLE', label: isAr ? 'مستهلكات'   : 'Consumable'  },
    { value: 'SUBLET',     label: isAr ? 'عمل خارجي'  : 'Sublet Work' },
  ];

  const { data: order, loading, error, reload } = useQuery<ServiceOrder>(`/service-orders/${id}`, [id]);

  const [showAddLine, setShowAddLine] = useState(false);
  const [lineForm, setLineForm] = useState({ type: 'LABOR', description: '', quantity: '1', unitPrice: '', partId: '' });
  const [showPartScanner, setShowPartScanner] = useState(false);
  const [scanningPart, setScanningPart] = useState(false);
  const [lineErr, setLineErr] = useState('');
  const [lineSaving, setLineSaving] = useState(false);
  const [lineFormKey, setLineFormKey] = useState(0); // forces PartPicker remount on reset

  const [actionErr, setActionErr] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const submitLine = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineForm.type === 'PART' && !lineForm.partId) {
      setLineErr(isAr ? 'يرجى اختيار القطعة من قائمة المخزون.' : 'Select a part from inventory.');
      return;
    }
    if (!lineForm.description || !lineForm.unitPrice) {
      setLineErr(isAr ? 'الوصف وسعر الوحدة مطلوبان.' : 'Description and unit price required.');
      return;
    }
    setLineSaving(true); setLineErr('');
    try {
      await apiFetch(`/service-orders/${id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          type: lineForm.type,
          description: lineForm.description,
          quantity: Number(lineForm.quantity) || 1,
          unitPrice: Number(lineForm.unitPrice),
          ...(lineForm.partId && { partId: lineForm.partId }),
        }),
      });
      setLineForm({ type: 'LABOR', description: '', quantity: '1', unitPrice: '', partId: '' });
      setLineFormKey(k => k + 1);
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
                  {order.vehicle ? (
                    <>
                      <p style={{ fontWeight: 500 }}>{order.vehicle.year} {order.vehicle.make} {order.vehicle.model}</p>
                      {order.vehicle.regLicenseNumber && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.vehicle.regLicenseNumber}</p>}
                      {order.vehicle.vin && <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>VIN: {order.vehicle.vin}</p>}
                    </>
                  ) : order.externalVehicle ? (
                    <>
                      <p style={{ fontWeight: 500 }}>{order.externalVehicle.year ? `${order.externalVehicle.year} ` : ''}{order.externalVehicle.make} {order.externalVehicle.model}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.externalVehicle.licensePlate}{order.externalVehicle.color ? ` · ${order.externalVehicle.color}` : ''}</p>
                      {order.externalVehicle.regNumber && <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{isAr ? 'ترخيص' : 'Reg'}: {order.externalVehicle.regNumber}</p>}
                      {order.externalVehicle.serviceOrders && order.externalVehicle.serviceOrders.length > 1 && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: 2 }}>
                          {order.externalVehicle.serviceOrders.length - 1} {isAr ? 'زيارة سابقة لهذه السيارة' : 'previous visits for this vehicle'}
                        </p>
                      )}
                    </>
                  ) : <p>—</p>}
                </div>
                <div>
                  <p style={FIELD_LABEL}>{isAr ? 'العميل' : 'Customer'}</p>
                  {order.customer ? (
                    <>
                      <p style={{ fontWeight: 500 }}>{order.customer.name}</p>
                      {order.customer.phone && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.customer.phone}</p>}
                      {order.customer.email && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.customer.email}</p>}
                    </>
                  ) : order.walkInCustomerName ? (
                    <>
                      <p style={{ fontWeight: 500 }}>{order.walkInCustomerName} <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>({isAr ? 'زيارة' : 'walk-in'})</span></p>
                      {order.walkInCustomerPhone && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{order.walkInCustomerPhone}</p>}
                    </>
                  ) : <p style={{ color: 'var(--text-3)' }}>—</p>}
                </div>
                <div>
                  <p style={FIELD_LABEL}>{isAr ? 'نوع الخدمة' : 'Service Type'}</p>
                  <p style={{ color: 'var(--text-2)' }}>{(order.type ?? '').replace(/_/g, ' ')}</p>
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
                        <span className={`badge ${lineTypeBadge(l.type)}`}>{isAr ? ({ LABOR: 'عمالة', PART: 'قطعة غيار', CONSUMABLE: 'مستهلكات', SUBLET: 'عمل خارجي' } as Record<string,string>)[l.type] ?? l.type : l.type.replace(/_/g, ' ')}</span>
                      </td>
                      <td style={{ color: 'var(--text-1)' }}>{l.description}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{l.quantity}</td>
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
                      value={lineForm.type}
                      onChange={(v) => {
                        setLineForm({ ...lineForm, type: v, partId: '', description: '', unitPrice: '' });
                        setLineFormKey(k => k + 1);
                      }}
                    />
                  </div>
                  <div style={{ flex: '1 1 240px' }}>
                    {lineForm.type === 'PART' ? (
                      <>
                        <label className="input-label">{isAr ? 'القطعة *' : 'Part *'}</label>
                        <PartPicker key={lineFormKey} isAr={isAr} onSelect={(part) => {
                          setLineForm(f => ({
                            ...f,
                            partId: part.id,
                            description: `${part.name} (${part.partNumber})`,
                            unitPrice: String(Number(part.salePrice)),
                          }));
                        }} />
                        {lineForm.partId && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                            {isAr ? 'سيتم خصم الكمية من المخزون وإرسال طلب للمستودع' : 'Quantity will be deducted from stock and a pick request sent to warehouse'}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <label className="input-label">{isAr ? 'الوصف *' : 'Description *'}</label>
                        <input
                          className="input"
                          placeholder={isAr ? 'الوصف…' : 'Description…'}
                          value={lineForm.description}
                          onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                          required
                        />
                      </>
                    )}
                  </div>
                  <div style={{ width: 80 }}>
                    <label className="input-label">{isAr ? 'الكمية' : 'Qty'}</label>
                    <NumericInput
                      min="0.01"
                      step="0.01"
                      className="input"
                      value={lineForm.quantity}
                      onChange={(val) => setLineForm({ ...lineForm, quantity: val })}
                    />
                  </div>
                  <div style={{ width: 130 }}>
                    <label className="input-label">{isAr ? 'سعر الوحدة *' : 'Unit Price *'}</label>
                    <NumericInput
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="0.00"
                      value={lineForm.unitPrice}
                      onChange={(val) => setLineForm({ ...lineForm, unitPrice: val })}
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
                    {fmt(Number(order.totalAmount ?? 0))}
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
                type: 'PART',
                partId: part.id ?? '',
                description: `${part.name} (${part.partNumber})`,
                unitPrice: String(Number(part.salePrice ?? 0)),
              }));
              setLineFormKey(k => k + 1);
            } else {
              setLineForm(f => ({ ...f, type: 'PART', partId: '', description: code }));
              setLineErr(isAr ? `القطعة "${code}" غير موجودة في المخزن — أدخل التفاصيل يدوياً.` : `Part "${code}" not in inventory — enter details manually.`);
            }
          } catch {
            setLineForm(f => ({ ...f, type: 'PART', partId: '', description: code }));
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
