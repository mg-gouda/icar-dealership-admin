'use client';

import { useState } from 'react';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import { useQuery, apiFetch } from '../../../lib/useApi';
import { useLang } from '../../../lib/lang-context';
import { fmtDate } from '@/lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Shipment {
  id: string;
  shipmentNumber: string;
  supplier?: string;
  origin: string;
  status: string;
  vehicleCount?: number;
  vehicles?: ShipmentVehicle[];
  portFees?: number;
  shippingCost?: number;
  clearanceAgentFee?: number;
  otherCosts?: number;
  totalCosts?: number;
  arrivalDate?: string;
  expectedArrivalDate?: string;
  location?: { id: string; name: string };
}

interface ShipmentVehicle {
  id: string;
  vehicleId?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  customsDuty?: number;
  allocatedLandedCost?: number;
  totalLandedCost?: number;
}

interface Location {
  id: string;
  name: string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  IN_TRANSIT:        { label: 'In Transit',        cls: 'badge-info'    },
  AT_PORT:           { label: 'At Port',            cls: 'badge-warning' },
  CUSTOMS_CLEARANCE: { label: 'Customs Clearance',  cls: 'badge-orange'  },
  CLEARED:           { label: 'Cleared',            cls: 'badge-purple'  },
  DELIVERED:         { label: 'Delivered',          cls: 'badge-success' },
};

const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }));

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status];
  return cfg
    ? <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
    : <span className="badge badge-neutral">{status.replace(/_/g, ' ')}</span>;
}

const fmt = (n: number | undefined | null) =>
  n != null ? 'EGP ' + Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 }) : '—';

// ── New Shipment Modal ────────────────────────────────────────────────────────
function NewShipmentModal({ locations, onClose, onSuccess }: {
  locations: Location[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { isAr } = useLang();
  const [form, setForm] = useState({
    shipmentNumber: '', supplier: '', origin: '',
    shipDate: '', arrivalDate: '',
    portFees: '', shippingCost: '', clearanceAgentFee: '', otherCosts: '',
    locationId: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.shipmentNumber || !form.origin) {
      setErr(isAr ? 'رقم الشحنة والمصدر مطلوبان.' : 'Shipment number and origin are required.'); return;
    }
    setSaving(true); setErr('');
    try {
      await apiFetch('/import-shipments', {
        method: 'POST',
        body: JSON.stringify({
          shipmentNumber: form.shipmentNumber,
          supplier:          form.supplier          || undefined,
          origin:            form.origin,
          shipDate:          form.shipDate          || undefined,
          arrivalDate:       form.arrivalDate       || undefined,
          portFees:          form.portFees          ? Number(form.portFees)          : undefined,
          shippingCost:      form.shippingCost      ? Number(form.shippingCost)      : undefined,
          clearanceAgentFee: form.clearanceAgentFee ? Number(form.clearanceAgentFee) : undefined,
          otherCosts:        form.otherCosts        ? Number(form.otherCosts)        : undefined,
          locationId:        form.locationId        || undefined,
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div className="relative w-full max-w-2xl card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>{isAr ? 'شحنة جديدة' : 'New Shipment'}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{
          padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
          maxHeight: '80vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="input-label">{isAr ? 'رقم الشحنة *' : 'Shipment Number *'}</label>
              <input className="input" value={form.shipmentNumber} onChange={(e) => set('shipmentNumber', e.target.value)} autoFocus />
            </div>
            <div>
              <label className="input-label">{isAr ? 'المورد' : 'Supplier'}</label>
              <input className="input" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="input-label">{isAr ? 'بلد المنشأ *' : 'Origin (Country) *'}</label>
              <input className="input" value={form.origin} onChange={(e) => set('origin', e.target.value)} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
              <SearchableCombobox
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
                value={form.locationId}
                onChange={(v) => set('locationId', v)}
                placeholder={isAr ? 'اختر الفرع…' : 'Select location…'}
                clearable
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="input-label">{isAr ? 'تاريخ الشحن' : 'Ship Date'}</label>
              <input className="input" type="date" value={form.shipDate} onChange={(e) => set('shipDate', e.target.value)} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'تاريخ الوصول المتوقع' : 'Expected Arrival Date'}</label>
              <input className="input" type="date" value={form.arrivalDate} onChange={(e) => set('arrivalDate', e.target.value)} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <p className="section-label">{isAr ? 'التكاليف (ج.م)' : 'Costs (EGP)'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="input-label">{isAr ? 'رسوم الميناء' : 'Port Fees'}</label>
                <input className="input" type="number" min="0" value={form.portFees} onChange={(e) => set('portFees', e.target.value)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'تكلفة الشحن' : 'Shipping Cost'}</label>
                <input className="input" type="number" min="0" value={form.shippingCost} onChange={(e) => set('shippingCost', e.target.value)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'رسوم وكيل الجمارك' : 'Clearance Agent Fee'}</label>
                <input className="input" type="number" min="0" value={form.clearanceAgentFee} onChange={(e) => set('clearanceAgentFee', e.target.value)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'تكاليف أخرى' : 'Other Costs'}</label>
                <input className="input" type="number" min="0" value={form.otherCosts} onChange={(e) => set('otherCosts', e.target.value)} />
              </div>
            </div>
          </div>

          {err && <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إنشاء الشحنة' : 'Create Shipment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shipment Detail Modal ─────────────────────────────────────────────────────
function ShipmentDetailModal({ shipmentId, onClose, onChanged }: {
  shipmentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { isAr } = useLang();
  const { data: ship, loading, reload } =
    useQuery<Shipment>(`/import-shipments/${shipmentId}`, [shipmentId]);

  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [editDuty, setEditDuty] = useState('');
  const [savingDuty, setSavingDuty] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const vehicles: ShipmentVehicle[] = ship?.vehicles ?? [];

  const totalShared = [ship?.portFees, ship?.shippingCost, ship?.clearanceAgentFee, ship?.otherCosts]
    .reduce<number>((s, n) => s + Number(n ?? 0), 0);

  async function saveDuty(vehicleId: string) {
    if (!editDuty) return;
    setSavingDuty(true);
    try {
      await apiFetch(`/import-shipments/${shipmentId}/vehicles/${vehicleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ customsDuty: Number(editDuty) }),
      });
      setEditVehicleId(null);
      reload();
      onChanged();
    } catch { /* non-critical */ }
    finally { setSavingDuty(false); }
  }

  async function allocate() {
    setAllocating(true);
    try {
      await apiFetch(`/import-shipments/${shipmentId}/allocate`, { method: 'POST' });
      reload();
      onChanged();
    } catch { /* non-critical */ }
    finally { setAllocating(false); }
  }

  async function updateStatus(newStatus: string) {
    if (!ship || newStatus === ship.status) return;
    setStatusSaving(true);
    try {
      await apiFetch(`/import-shipments/${shipmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      reload();
      onChanged();
    } catch { /* non-critical */ }
    finally { setStatusSaving(false); }
  }

  const costCards = [
    { label: isAr ? 'رسوم الميناء'     : 'Port Fees',      val: ship?.portFees },
    { label: isAr ? 'تكلفة الشحن'      : 'Shipping',       val: ship?.shippingCost },
    { label: isAr ? 'رسوم الجمارك'     : 'Clearance Fee',  val: ship?.clearanceAgentFee },
    { label: isAr ? 'تكاليف أخرى'      : 'Other Costs',    val: ship?.otherCosts },
    { label: isAr ? 'إجمالي مشترك'     : 'Total Shared',   val: totalShared,   bold: true },
    { label: isAr ? 'متوسط / مركبة'    : 'Avg / Vehicle',  val: vehicles.length ? totalShared / vehicles.length : undefined, bold: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ padding: '1.5rem' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} />
      <div className="relative flex flex-col" style={{
        width: '100%', maxWidth: '1024px', maxHeight: '92vh',
        background: 'var(--surface)', borderRadius: '0.75rem',
        boxShadow: '0 8px 48px oklch(0 0 0 / 0.35)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-1)', lineHeight: 1.2 }}>
                {ship?.shipmentNumber ?? '—'}
              </h3>
              {ship && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>
                  {ship.origin}
                  {ship.supplier ? ` · ${ship.supplier}` : ''}
                  {(ship.arrivalDate || ship.expectedArrivalDate)
                    ? ` ${isAr ? '· الوصول:' : '· Arrival:'} ${fmtDate(ship.arrivalDate ?? ship.expectedArrivalDate, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ''}
                </p>
              )}
            </div>
            {ship && <StatusBadge status={ship.status} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {ship && (
              <SearchableCombobox
                options={STATUS_OPTIONS}
                value={ship.status}
                onChange={updateStatus}
                disabled={statusSaving}
                className="w-44"
              />
            )}
            <button onClick={onClose} className="btn btn-ghost btn-sm"
              style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جارٍ تحميل الشحنة…' : 'Loading shipment…'}</p>
          ) : !ship ? (
            <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{isAr ? 'الشحنة غير موجودة.' : 'Shipment not found.'}</p>
          ) : (
            <>
              {/* Cost summary cards */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {costCards.map(({ label, val, bold }) => (
                  <div key={label} className="card" style={{ padding: '0.75rem 1rem', minWidth: '9rem', flex: '1 1 9rem' }}>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: '1rem', fontWeight: bold ? 700 : 500, color: bold ? 'var(--primary)' : 'var(--text-1)', marginTop: '0.25rem' }}>
                      {fmt(val)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Vehicles table */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)',
                }}>
                  <span className="section-label" style={{ margin: 0 }}>
                    {isAr ? `السيارات (${vehicles.length})` : `Vehicles (${vehicles.length})`}
                  </span>
                  <button className="btn btn-secondary btn-sm" disabled={allocating} onClick={allocate}>
                    {allocating ? (isAr ? 'جارٍ التوزيع…' : 'Allocating…') : (isAr ? 'توزيع التكاليف' : 'Allocate Costs')}
                  </button>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'رقم الشاسيه / السيارة' : 'VIN / Vehicle'}</th>
                      <th style={{ textAlign: 'right' }}>{isAr ? 'رسوم الجمارك' : 'Customs Duty'}</th>
                      <th style={{ textAlign: 'right' }}>{isAr ? 'التكلفة المخصصة' : 'Allocated Landed'}</th>
                      <th style={{ textAlign: 'right' }}>{isAr ? 'إجمالي التكلفة' : 'Total Landed Cost'}</th>
                      <th style={{ width: '7rem' }}>{isAr ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                          {isAr ? 'لا توجد مركبات في هذه الشحنة.' : 'No vehicles in this shipment.'}
                        </td>
                      </tr>
                    ) : (
                      vehicles.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <p style={{ fontWeight: 500 }}>
                              {[v.year, v.make, v.model].filter(Boolean).join(' ') || '—'}
                            </p>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{v.vin ?? '—'}</p>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {editVehicleId === v.id ? (
                              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <input
                                  className="input"
                                  type="number"
                                  min="0"
                                  value={editDuty}
                                  onChange={(e) => setEditDuty(e.target.value)}
                                  style={{ width: '7rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveDuty(v.id); if (e.key === 'Escape') setEditVehicleId(null); }}
                                />
                                <button className="btn btn-primary btn-sm" disabled={savingDuty} onClick={() => saveDuty(v.id)}>
                                  {savingDuty ? '…' : (isAr ? 'حفظ' : 'Save')}
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditVehicleId(null)}>✕</button>
                              </div>
                            ) : (
                              <span style={{ fontWeight: 500 }}>{fmt(v.customsDuty)}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                            {fmt(v.allocatedLandedCost)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                            {fmt(v.totalLandedCost)}
                          </td>
                          <td>
                            {editVehicleId !== v.id && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => { setEditVehicleId(v.id); setEditDuty(String(v.customsDuty ?? '')); }}
                              >
                                {isAr ? 'تعديل الجمارك' : 'Edit Duty'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ImportPage() {
  const { isAr } = useLang();
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rawShipments, loading, reload } =
    useQuery<Shipment[] | { data: Shipment[] }>('/import-shipments');
  const { data: rawLocs } =
    useQuery<Location[] | { data: Location[] }>('/locations');

  const shipments: Shipment[] = Array.isArray(rawShipments) ? rawShipments : (rawShipments?.data ?? []);
  const locations: Location[] = Array.isArray(rawLocs)      ? rawLocs      : (rawLocs?.data      ?? []);

  const totalCosts = shipments.reduce((s, sh) => s + Number(sh.totalCosts ?? 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'شحنات الاستيراد والجمارك' : 'Vehicle Imports & Customs'}</h1>
          <p className="page-subtitle">
            {shipments.length} {isAr ? (shipments.length !== 1 ? 'شحنات' : 'شحنة') : (shipments.length !== 1 ? 'shipments' : 'shipment')} · {fmt(totalCosts)} {isAr ? 'إجمالي التكاليف' : 'total costs'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
          {isAr ? '+ شحنة جديدة' : '+ New Shipment'}
        </button>
      </div>

      <div className="page-body">
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'رقم الشحنة' : 'Shipment #'}</th>
                  <th>{isAr ? 'بلد المنشأ' : 'Origin'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'السيارات' : 'Vehicles'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'رسوم الميناء' : 'Port Fees'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'الشحن' : 'Shipping'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'الجمارك' : 'Clearance'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'إجمالي التكاليف' : 'Total Costs'}</th>
                  <th>{isAr ? 'تاريخ الوصول' : 'Arrival Date'}</th>
                </tr>
              </thead>
              <tbody>
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      {isAr ? 'لا توجد شحنات.' : 'No shipments found.'}
                    </td>
                  </tr>
                ) : (
                  shipments.map((s) => (
                    <tr
                      key={s.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.shipmentNumber}</td>
                      <td style={{ color: 'var(--text-2)' }}>{s.origin}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                        {s.vehicleCount ?? s.vehicles?.length ?? 0}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmt(s.portFees)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmt(s.shippingCost)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmt(s.clearanceAgentFee)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(s.totalCosts)}</td>
                      <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {fmtDate(s.arrivalDate ?? s.expectedArrivalDate, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewShipmentModal
          locations={locations}
          onClose={() => setShowNewModal(false)}
          onSuccess={() => { setShowNewModal(false); reload(); }}
        />
      )}
      {selectedId && (
        <ShipmentDetailModal
          shipmentId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
