'use client';

import { useState } from 'react';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import NumericInput from '../../../components/ui/NumericInput';
import { useQuery, apiFetch } from '../../../lib/useApi';
import { useLang } from '../../../lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import { API_BASE } from '@/lib/config';

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
  vehicleId: string;
  customsDuty: number;
  allocatedLanded: number;
  totalLandedCost: number;
  receivedAt: string | null;
  condition: string | null;
  odometerAtArrival: number | null;
  inspectionStatus: string;  // PENDING | PASSED | FAILED
  inspectionNotes: string | null;
  inspectedAt: string | null;
  releasedAt: string | null;
  vehicle: {
    id: string;
    vin: string | null;
    make: string;
    model: string;
    year: number;
    price: number | null;
    cost: number | null;
    status: string;  // IN_TRANSIT | PENDING_INSPECTION | AVAILABLE
    color: string | null;
    trim: string | null;
    mileage: number | null;
  };
}

interface Location {
  id: string;
  name: string;
}

interface CarMake  { id: string; name: string; logoUrl?: string; }
interface CarModel { id: string; name: string; }
interface LI       { id: string; value: string; label: string; labelAr?: string; }

const YEARS = Array.from({ length: 40 }, (_, i) => {
  const y = 2026 - i;
  return { value: String(y), label: String(y) };
});

const NHTSA_BODY: Record<string, string> = {
  'sedan/saloon': 'Sedan', 'sedan': 'Sedan',
  'sport utility vehicle (suv)/multi-purpose vehicle (mpv)': 'SUV', 'suv': 'SUV',
  'hatchback/liftback/notchback': 'Hatchback', 'hatchback': 'Hatchback',
  'pickup': 'Pickup', 'truck': 'Pickup',
  'van': 'Van', 'minivan': 'Van',
  'coupe': 'Coupe',
  'convertible/cabriolet': 'Convertible', 'convertible': 'Convertible',
  'wagon': 'Wagon', 'station wagon/estate': 'Wagon',
};
const NHTSA_FUEL: Record<string, string> = {
  'gasoline': 'Petrol', 'petrol': 'Petrol',
  'diesel': 'Diesel',
  'electric': 'Electric',
  'hybrid - unspecified': 'Hybrid', 'hybrid': 'Hybrid',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  IN_TRANSIT:        { label: 'In Transit',        cls: 'badge-info'    },
  AT_PORT:           { label: 'At Port',            cls: 'badge-warning' },
  CUSTOMS_CLEARANCE: { label: 'Customs Clearance',  cls: 'badge-orange'  },
  CLEARED:           { label: 'Cleared',            cls: 'badge-purple'  },
  DELIVERED:         { label: 'Delivered',          cls: 'badge-success' },
  CLOSED:            { label: 'Closed ✓',           cls: 'badge-neutral' },
};
const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }));

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: '#22c55e',
  GOOD:      '#3b82f6',
  FAIR:      '#f59e0b',
  POOR:      '#ef4444',
};
const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];

const RESULT_OPTIONS = [
  { value: 'PASSED', label: '✓ Passed', color: '#22c55e' },
  { value: 'FAILED', label: '✗ Failed', color: '#ef4444' },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status];
  return cfg
    ? <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
    : <span className="badge badge-neutral">{status.replace(/_/g, ' ')}</span>;
}

const fmt = (n: number | undefined | null) =>
  n != null ? 'EGP ' + Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 }) : '—';

function svStep(sv: ShipmentVehicle): number {
  if (sv.vehicle.status === 'AVAILABLE') return 3;
  if (sv.vehicle.status === 'PENDING_INSPECTION') return sv.inspectionStatus !== 'PENDING' ? 2 : 1;
  return 0;
}

// ── Vehicle lifecycle pipeline ────────────────────────────────────────────────
const PIPELINE = ['In Transit', 'Received', 'Inspected', 'In Inventory'];

function VehiclePipeline({ step, failed }: { step: number; failed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {PIPELINE.map((label, i) => {
        const done   = i < step;
        const active = i === step;
        const red    = active && i === 2 && failed;
        const dotBg  = red ? '#ef4444' : done ? '#22c55e' : active ? 'var(--primary)' : 'var(--border)';
        const lineBg = done ? '#22c55e' : 'var(--border)';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', flex: i < PIPELINE.length - 1 ? '1 1 auto' : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', minWidth: '3rem' }}>
              <div style={{
                width: '1.5rem', height: '1.5rem', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700,
                background: dotBg, color: (done || active) ? '#fff' : 'var(--text-3)',
              }}>
                {done ? '✓' : red ? '✗' : i + 1}
              </div>
              <span style={{
                fontSize: '0.55rem', textAlign: 'center', lineHeight: 1.2, maxWidth: '3.5rem',
                color: (done || active) ? 'var(--text-2)' : 'var(--text-3)',
              }}>{label}</span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div style={{ height: '2px', flex: 1, marginTop: '0.75rem', background: lineBg }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const [err, setErr]       = useState('');
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.shipmentNumber || !form.origin) {
      setErr(isAr ? 'رقم الشحنة والمصدر مطلوبان.' : 'Shipment number and origin are required.');
      return;
    }
    setSaving(true); setErr('');
    try {
      await apiFetch('/import-shipments', {
        method: 'POST',
        body: JSON.stringify({
          shipmentNumber:    form.shipmentNumber,
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
          <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>
            {isAr ? 'شحنة جديدة' : 'New Shipment'}
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
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
                <NumericInput className="input" min="0" value={form.portFees} onChange={(val) => set('portFees', val)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'تكلفة الشحن' : 'Shipping Cost'}</label>
                <NumericInput className="input" min="0" value={form.shippingCost} onChange={(val) => set('shippingCost', val)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'رسوم وكيل الجمارك' : 'Clearance Agent Fee'}</label>
                <NumericInput className="input" min="0" value={form.clearanceAgentFee} onChange={(val) => set('clearanceAgentFee', val)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'تكاليف أخرى' : 'Other Costs'}</label>
                <NumericInput className="input" min="0" value={form.otherCosts} onChange={(val) => set('otherCosts', val)} />
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

  // Lookup data for add vehicle form
  const { data: rawCarMakes }      = useQuery<CarMake[]>('/settings/car-makes');
  const { data: rawColors }        = useQuery<LI[]>('/lookup-items?category=car_color');
  const { data: rawBodyTypes }     = useQuery<LI[]>('/lookup-items?category=body_type');
  const { data: rawFuelTypes }     = useQuery<LI[]>('/lookup-items?category=fuel_type');
  const { data: rawTransmissions } = useQuery<LI[]>('/lookup-items?category=transmission');

  const carMakes = Array.isArray(rawCarMakes) ? rawCarMakes : [];
  const toOpts   = (r: LI[] | null | undefined) => (Array.isArray(r) ? r : []).map(i => ({ value: i.value, label: i.label }));
  const MAKE_OPTS         = carMakes.map(m => ({ value: m.name, label: m.name }));
  const COLOR_OPTS        = toOpts(rawColors);
  const BODY_TYPE_OPTS    = toOpts(rawBodyTypes);
  const FUEL_TYPE_OPTS    = toOpts(rawFuelTypes);
  const TRANSMISSION_OPTS = toOpts(rawTransmissions);

  // Cascaded models — depends on selected make name
  const [addMakeName, setAddMakeName] = useState('');
  const addMake = carMakes.find(m => m.name === addMakeName) ?? null;
  const { data: rawAddModels } = useQuery<CarModel[]>(
    addMake ? `/settings/car-makes/${addMake.id}/models` : null,
    [addMake?.id],
  );
  const MODEL_OPTS = (Array.isArray(rawAddModels) ? rawAddModels : []).map(m => ({ value: m.name, label: m.name }));

  // Add vehicle
  const BLANK_ADD = {
    make: '', model: '', year: '2024', vin: '', trim: '', color: '', bodyType: '',
    fuelType: '', transmission: '', engineSize: '', hp: '', doors: '', seats: '',
    mileage: '', price: '', cost: '', customsDuty: '',
  };
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_ADD);
  const [addingSv, setAddingSv]   = useState(false);
  const [addErr, setAddErr]       = useState('');
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinMsg, setVinMsg]       = useState('');


  // Inline duty edit
  const [editDutyId, setEditDutyId] = useState<string | null>(null);
  const [editDuty, setEditDuty]     = useState('');
  const [savingDuty, setSavingDuty] = useState(false);

  // Inline inspection form
  const [inspectId, setInspectId]   = useState<string | null>(null);
  const [inspForm, setInspForm]     = useState({ condition: 'GOOD', odometer: '', result: 'PASSED', notes: '' });
  const [savingInsp, setSavingInsp] = useState(false);

  // Action loading states
  const [actionId, setActionId]       = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState<string | null>(null);
  const [allocating, setAllocating]   = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const vehicles: ShipmentVehicle[] = ship?.vehicles ?? [];
  const totalShared = [ship?.portFees, ship?.shippingCost, ship?.clearanceAgentFee, ship?.otherCosts]
    .reduce<number>((s, n) => s + Number(n ?? 0), 0);

  const setAdd  = (k: string, v: string) => setAddForm((p)  => ({ ...p, [k]: v }));
  const setInsp = (k: string, v: string) => setInspForm((p) => ({ ...p, [k]: v }));

  // ── Actions ────────────────────────────────────────────────────────────────
  async function decodeVin() {
    if (addForm.vin.length !== 17) return;
    setVinDecoding(true); setVinMsg('');
    try {
      const data = await apiFetch<any>(`/vehicles/decode-vin?vin=${addForm.vin}`);
      const d = data?.decoded;
      if (!d) { setVinMsg('VIN not recognised'); return; }
      const matchedMake = carMakes.find(m => m.name.toLowerCase() === (d.make || '').toLowerCase());
      const mappedBody  = NHTSA_BODY[(d.bodyType || '').toLowerCase()];
      const mappedFuel  = NHTSA_FUEL[(d.fuelType || '').toLowerCase()];
      const newMake = matchedMake?.name || d.make || addForm.make;
      setAddMakeName(newMake);
      setAddForm(p => ({
        ...p,
        make:         newMake,
        model:        d.model        || p.model,
        year:         d.year         ? String(d.year) : p.year,
        trim:         d.trim         || p.trim,
        bodyType:     mappedBody     || d.bodyType || p.bodyType,
        engineSize:   d.engineSize   || p.engineSize,
        fuelType:     mappedFuel     || d.fuelType || p.fuelType,
        transmission: d.transmission || p.transmission,
        doors:        d.doors        ? String(d.doors) : p.doors,
      }));
      const filled = [d.make, d.model, d.year, d.bodyType].filter(Boolean).length;
      setVinMsg(filled === 0 ? 'VIN not found in NHTSA database' : '✓ Fields filled from VIN');
    } catch {
      setVinMsg('Error reaching VIN decode API');
    } finally {
      setVinDecoding(false);
    }
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.make || !addForm.model || !addForm.year || !addForm.price) {
      setAddErr('Make, model, year, and price are required.'); return;
    }
    setAddingSv(true); setAddErr('');
    try {
      await apiFetch(`/import-shipments/${shipmentId}/vehicles/new`, {
        method: 'POST',
        body: JSON.stringify({
          make:         addForm.make,
          model:        addForm.model,
          year:         Number(addForm.year),
          vin:          addForm.vin         || undefined,
          trim:         addForm.trim        || undefined,
          color:        addForm.color       || undefined,
          bodyType:     addForm.bodyType    || undefined,
          fuelType:     addForm.fuelType    || undefined,
          transmission: addForm.transmission || undefined,
          engineSize:   addForm.engineSize  || undefined,
          hp:           addForm.hp          ? Number(addForm.hp)          : undefined,
          doors:        addForm.doors       ? Number(addForm.doors)       : undefined,
          seats:        addForm.seats       ? Number(addForm.seats)       : undefined,
          mileage:      addForm.mileage     ? Number(addForm.mileage)     : undefined,
          price:        Number(addForm.price),
          cost:         addForm.cost        ? Number(addForm.cost)        : undefined,
          customsDuty:  addForm.customsDuty ? Number(addForm.customsDuty) : undefined,
        }),
      });
      setAddForm(BLANK_ADD); setAddMakeName(''); setShowAdd(false); setVinMsg('');
      reload(); onChanged();
    } catch (e: unknown) { setAddErr(e instanceof Error ? e.message : String(e)); }
    finally { setAddingSv(false); }
  }

  async function saveDuty(svId: string) {
    if (!editDuty) return;
    setSavingDuty(true);
    try {
      await apiFetch(`/import-shipments/${shipmentId}/vehicles/${svId}`, {
        method: 'PATCH', body: JSON.stringify({ customsDuty: Number(editDuty) }),
      });
      setEditDutyId(null); reload(); onChanged();
    } catch { /* non-critical */ }
    finally { setSavingDuty(false); }
  }

  async function receive(svId: string) {
    setActionId(svId);
    try {
      await apiFetch(`/import-shipments/${shipmentId}/vehicles/${svId}/receive`, { method: 'POST' });
      reload(); onChanged();
    } catch { /* non-critical */ }
    finally { setActionId(null); }
  }

  async function saveInspection(svId: string) {
    setSavingInsp(true);
    try {
      await apiFetch(`/import-shipments/${shipmentId}/vehicles/${svId}/inspect`, {
        method: 'PATCH',
        body: JSON.stringify({
          condition:        inspForm.condition || undefined,
          odometerAtArrival: inspForm.odometer ? Number(inspForm.odometer) : undefined,
          inspectionStatus:  inspForm.result,
          inspectionNotes:   inspForm.notes   || undefined,
        }),
      });
      setInspectId(null); reload(); onChanged();
    } catch { /* non-critical */ }
    finally { setSavingInsp(false); }
  }

  async function release(svId: string) {
    setActionId(svId);
    try {
      await apiFetch(`/import-shipments/${shipmentId}/vehicles/${svId}/release`, { method: 'POST' });
      reload(); onChanged();
    } catch { /* non-critical */ }
    finally { setActionId(null); }
  }

  async function receiveAll() {
    setBatchLoading('receive');
    try {
      await apiFetch(`/import-shipments/${shipmentId}/receive-all`, { method: 'POST' });
      reload(); onChanged();
    } catch { /* non-critical */ }
    finally { setBatchLoading(null); }
  }

  async function releaseAll() {
    setBatchLoading('release');
    try {
      await apiFetch(`/import-shipments/${shipmentId}/release-all`, { method: 'POST' });
      reload(); onChanged();
    } catch { /* non-critical */ }
    finally { setBatchLoading(null); }
  }

  async function allocate() {
    setAllocating(true);
    try {
      await apiFetch(`/import-shipments/${shipmentId}/allocate`, { method: 'POST' });
      reload(); onChanged();
    } catch { /* non-critical */ }
    finally { setAllocating(false); }
  }

  async function updateStatus(newStatus: string) {
    if (!ship || newStatus === ship.status) return;
    setStatusSaving(true);
    try {
      await apiFetch(`/import-shipments/${shipmentId}`, {
        method: 'PATCH', body: JSON.stringify({ status: newStatus }),
      });
      reload(); onChanged();
    } catch { /* non-critical */ }
    finally { setStatusSaving(false); }
  }

  function openInspect(sv: ShipmentVehicle) {
    setInspForm({
      condition: sv.condition ?? 'GOOD',
      odometer:  sv.odometerAtArrival ? String(sv.odometerAtArrival) : '',
      result:    sv.inspectionStatus === 'FAILED' ? 'FAILED' : 'PASSED',
      notes:     sv.inspectionNotes ?? '',
    });
    setInspectId(sv.id);
  }

  const costCards = [
    { label: 'Port Fees',     val: ship?.portFees },
    { label: 'Shipping',      val: ship?.shippingCost },
    { label: 'Clearance Fee', val: ship?.clearanceAgentFee },
    { label: 'Other Costs',   val: ship?.otherCosts },
    { label: 'Total Shared',  val: totalShared,  bold: true },
    { label: 'Avg / Vehicle', val: vehicles.length ? totalShared / vehicles.length : undefined, bold: true },
  ];

  const inTransitCount = vehicles.filter((sv) => sv.vehicle.status === 'IN_TRANSIT').length;
  const passedCount    = vehicles.filter((sv) => sv.inspectionStatus === 'PASSED' && !sv.releasedAt).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ padding: '1.5rem' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} />
      <div className="relative flex flex-col" style={{
        width: '100%', maxWidth: '1100px', maxHeight: '92vh',
        background: 'var(--surface)', borderRadius: '0.75rem',
        boxShadow: '0 8px 48px oklch(0 0 0 / 0.35)', overflow: 'hidden',
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
                  {ship.location ? ` · ${ship.location.name}` : ''}
                  {(ship.arrivalDate || ship.expectedArrivalDate)
                    ? ` · Arrival: ${fmtDate(ship.arrivalDate ?? ship.expectedArrivalDate, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ''}
                </p>
              )}
            </div>
            {ship && <StatusBadge status={ship.status} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {ship && ship.status !== 'CLOSED' && (
              <SearchableCombobox
                options={STATUS_OPTIONS.filter(o => o.value !== 'CLOSED')}
                value={ship.status}
                onChange={updateStatus}
                disabled={statusSaving}
                className="w-44"
              />
            )}
            {ship?.status === 'CLOSED' && (
              <span style={{
                fontSize: '0.75rem', fontWeight: 600, color: '#fff',
                background: '#374151', padding: '0.25rem 0.75rem', borderRadius: '0.375rem',
              }}>
                Shipment Closed
              </span>
            )}
            <button onClick={onClose} className="btn btn-ghost btn-sm"
              style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading shipment…</p>
          ) : !ship ? (
            <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>Shipment not found.</p>
          ) : (
            <>
              {/* Cost summary cards */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {costCards.map(({ label, val, bold }) => (
                  <div key={label} className="card" style={{ padding: '0.75rem 1rem', minWidth: '8.5rem', flex: '1 1 8.5rem' }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                    <p style={{ fontSize: '0.9375rem', fontWeight: bold ? 700 : 500, color: bold ? 'var(--primary)' : 'var(--text-1)', marginTop: '0.2rem' }}>
                      {fmt(val)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Vehicles section */}
              <div className="card">
                {/* Section header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                  padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)',
                }}>
                  <span className="section-label" style={{ margin: 0, flex: 1 }}>
                    Vehicles ({vehicles.length})
                  </span>
                  {inTransitCount > 0 && (
                    <button className="btn btn-secondary btn-sm" disabled={batchLoading === 'receive'} onClick={receiveAll}>
                      {batchLoading === 'receive' ? '…' : `Receive All (${inTransitCount})`}
                    </button>
                  )}
                  {passedCount > 0 && (
                    <button className="btn btn-secondary btn-sm" disabled={batchLoading === 'release'} onClick={releaseAll}>
                      {batchLoading === 'release' ? '…' : `Release All (${passedCount})`}
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" disabled={allocating} onClick={allocate}>
                    {allocating ? '…' : 'Allocate Costs'}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd((p) => !p); setAddErr(''); }}>
                    {showAdd ? 'Cancel Add' : '+ Add Vehicle'}
                  </button>
                </div>

                {/* Add vehicle inline form — mirrors the New Vehicle wizard fields */}
                {showAdd && (
                  <form onSubmit={addVehicle} style={{
                    padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
                    background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: '1rem',
                  }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '-0.25rem' }}>
                      Add Vehicle to Shipment
                    </p>

                    {/* VIN row */}
                    <div>
                      <label className="input-label">
                        VIN <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional — enter to auto-fill specs)</span>
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          className="input"
                          value={addForm.vin}
                          onChange={(e) => setAdd('vin', e.target.value.toUpperCase().slice(0, 17))}
                          placeholder="17-character VIN"
                          maxLength={17}
                          style={{ fontFamily: 'monospace', letterSpacing: '0.05em', flex: 1 }}
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={addForm.vin.length !== 17 || vinDecoding}
                          onClick={decodeVin}
                          style={{
                            flexShrink: 0, padding: '0 0.875rem', height: 38,
                            borderRadius: 8, border: '1px solid var(--primary)',
                            background: addForm.vin.length === 17 ? 'var(--primary)' : 'var(--surface)',
                            cursor: addForm.vin.length === 17 ? 'pointer' : 'not-allowed',
                            fontSize: '0.8125rem', fontWeight: 600,
                            color: addForm.vin.length === 17 ? '#fff' : 'var(--text-3)',
                            opacity: addForm.vin.length === 17 ? 1 : 0.5, whiteSpace: 'nowrap',
                          }}
                        >
                          {vinDecoding ? '…' : 'Decode VIN'}
                        </button>
                      </div>
                      {vinMsg && (
                        <p style={{ fontSize: '0.6875rem', marginTop: '0.2rem', color: vinMsg.startsWith('✓') ? 'var(--success-fg)' : 'var(--danger)' }}>
                          {vinMsg}
                        </p>
                      )}
                      <p style={{ fontSize: '0.6rem', color: addForm.vin.length === 17 ? 'var(--success-fg)' : 'var(--text-3)', marginTop: '0.15rem' }}>
                        {addForm.vin.length}/17 characters
                      </p>
                    </div>

                    {/* Basic Info grid */}
                    <div>
                      <p className="section-label" style={{ fontSize: '0.6875rem', marginBottom: '0.5rem' }}>Basic Info</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                        <div>
                          <label className="input-label">Make <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <SearchableCombobox
                            options={MAKE_OPTS}
                            value={addForm.make}
                            onChange={(v) => { setAdd('make', v); setAdd('model', ''); setAddMakeName(v); }}
                            placeholder="Select make…"
                          />
                        </div>
                        <div>
                          <label className="input-label">Model <span style={{ color: 'var(--danger)' }}>*</span></label>
                          {addForm.make && MODEL_OPTS.length > 0
                            ? <SearchableCombobox options={MODEL_OPTS} value={addForm.model} onChange={(v) => setAdd('model', v)} placeholder="Select model…" />
                            : <input className="input" value={addForm.model} onChange={(e) => setAdd('model', e.target.value)}
                                placeholder={addForm.make ? 'Type model name…' : 'Select a make first…'}
                                disabled={!addForm.make} />
                          }
                        </div>
                        <div>
                          <label className="input-label">Year <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <SearchableCombobox options={YEARS} value={addForm.year} onChange={(v) => setAdd('year', v)} placeholder="Select year…" />
                        </div>
                        <div>
                          <label className="input-label">Trim / Variant</label>
                          <input className="input" value={addForm.trim} onChange={(e) => setAdd('trim', e.target.value)} placeholder="SE, XLE, Sport…" />
                        </div>
                        <div>
                          <label className="input-label">Color</label>
                          <SearchableCombobox options={COLOR_OPTS} value={addForm.color} onChange={(v) => setAdd('color', v)} placeholder="Select color…" clearable />
                        </div>
                        <div>
                          <label className="input-label">Body Type</label>
                          <SearchableCombobox options={BODY_TYPE_OPTS} value={addForm.bodyType} onChange={(v) => setAdd('bodyType', v)} placeholder="Sedan, SUV…" clearable />
                        </div>
                        <div>
                          <label className="input-label">Mileage (km)</label>
                          <NumericInput className="input" min="0" value={addForm.mileage} onChange={(v) => setAdd('mileage', v)} placeholder="0 for new" />
                        </div>
                      </div>
                    </div>

                    {/* Specs grid */}
                    <div>
                      <p className="section-label" style={{ fontSize: '0.6875rem', marginBottom: '0.5rem' }}>Specs</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                        <div>
                          <label className="input-label">Fuel Type</label>
                          <SearchableCombobox options={FUEL_TYPE_OPTS} value={addForm.fuelType} onChange={(v) => setAdd('fuelType', v)} placeholder="Petrol, Diesel…" clearable />
                        </div>
                        <div>
                          <label className="input-label">Transmission</label>
                          <SearchableCombobox options={TRANSMISSION_OPTS} value={addForm.transmission} onChange={(v) => setAdd('transmission', v)} placeholder="Auto, Manual…" clearable />
                        </div>
                        <div>
                          <label className="input-label">Engine Size</label>
                          <input className="input" value={addForm.engineSize} onChange={(e) => setAdd('engineSize', e.target.value)} placeholder="2.0L Inline-4…" />
                        </div>
                        <div>
                          <label className="input-label">Horsepower (HP)</label>
                          <NumericInput className="input" min="0" value={addForm.hp} onChange={(v) => setAdd('hp', v)} placeholder="180" />
                        </div>
                        <div>
                          <label className="input-label">Doors</label>
                          <NumericInput className="input" min="2" max="6" value={addForm.doors} onChange={(v) => setAdd('doors', v)} placeholder="4" />
                        </div>
                        <div>
                          <label className="input-label">Seats</label>
                          <NumericInput className="input" min="1" max="9" value={addForm.seats} onChange={(v) => setAdd('seats', v)} placeholder="5" />
                        </div>
                      </div>
                    </div>

                    {/* Pricing grid */}
                    <div>
                      <p className="section-label" style={{ fontSize: '0.6875rem', marginBottom: '0.5rem' }}>Pricing</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                        <div>
                          <label className="input-label">Listed Price (EGP) <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <NumericInput className="input" min="0" value={addForm.price} onChange={(v) => setAdd('price', v)} placeholder="1,500,000" />
                        </div>
                        <div>
                          <label className="input-label">Acquisition Cost (EGP)</label>
                          <NumericInput className="input" min="0" value={addForm.cost} onChange={(v) => setAdd('cost', v)} placeholder="Optional" />
                        </div>
                        <div>
                          <label className="input-label">Customs Duty (EGP)</label>
                          <NumericInput className="input" min="0" value={addForm.customsDuty} onChange={(v) => setAdd('customsDuty', v)} placeholder="0" />
                        </div>
                      </div>
                    </div>

                    {addErr && <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{addErr}</p>}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowAdd(false); setAddErr(''); setVinMsg(''); }}>Cancel</button>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={addingSv}>
                        {addingSv ? 'Adding…' : 'Add to Shipment'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Vehicle list */}
                {vehicles.length === 0 && !showAdd ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.875rem' }}>
                    No vehicles yet — click &ldquo;+ Add Vehicle&rdquo; to add cars to this shipment.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {vehicles.map((sv, idx) => {
                      const step         = svStep(sv);
                      const isFailed     = sv.inspectionStatus === 'FAILED';
                      const isInspecting = inspectId === sv.id;
                      const isActing     = actionId === sv.id;

                      return (
                        <div key={sv.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined }}>
                          {/* Vehicle card row */}
                          <div style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            {/* Top: name + action button */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>
                                  {sv.vehicle.year} {sv.vehicle.make} {sv.vehicle.model}
                                  {sv.vehicle.trim ? ` ${sv.vehicle.trim}` : ''}
                                  {sv.vehicle.color
                                    ? <span style={{ fontWeight: 400, color: 'var(--text-3)' }}> · {sv.vehicle.color}</span>
                                    : null}
                                </p>
                                <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>
                                  {sv.vehicle.vin ? `VIN: ${sv.vehicle.vin}` : 'No VIN'}
                                  {sv.vehicle.mileage != null && sv.vehicle.mileage > 0
                                    ? ` · ${sv.vehicle.mileage.toLocaleString()} km`
                                    : ''}
                                  {sv.vehicle.price != null ? ` · ${fmt(sv.vehicle.price)}` : ''}
                                </p>
                              </div>

                              {/* Action buttons */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                {step === 0 && (
                                  <button className="btn btn-secondary btn-sm" disabled={isActing} onClick={() => receive(sv.id)}>
                                    {isActing ? '…' : 'Mark Received'}
                                  </button>
                                )}
                                {step === 1 && (
                                  <button className="btn btn-secondary btn-sm"
                                    onClick={() => isInspecting ? setInspectId(null) : openInspect(sv)}>
                                    {isInspecting ? 'Close Form' : 'Record Inspection'}
                                  </button>
                                )}
                                {step === 2 && isFailed && (
                                  <>
                                    <span className="badge badge-danger">Failed</span>
                                    <button className="btn btn-secondary btn-sm"
                                      onClick={() => isInspecting ? setInspectId(null) : openInspect(sv)}>
                                      {isInspecting ? 'Close Form' : 'Re-inspect'}
                                    </button>
                                  </>
                                )}
                                {step === 2 && !isFailed && (
                                  <button className="btn btn-primary btn-sm" disabled={isActing} onClick={() => release(sv.id)}>
                                    {isActing ? '…' : '→ Release to Inventory'}
                                  </button>
                                )}
                                {step === 3 && (
                                  <span className="badge badge-success">In Inventory ✓</span>
                                )}
                              </div>
                            </div>

                            {/* Status pipeline */}
                            <VehiclePipeline step={step} failed={isFailed} />

                            {/* Inspection summary row (if inspected) */}
                            {sv.inspectedAt && (
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.6875rem', color: 'var(--text-2)' }}>
                                {sv.condition && (
                                  <span style={{ fontWeight: 600, color: CONDITION_COLORS[sv.condition] ?? 'var(--text-2)' }}>
                                    {sv.condition.charAt(0) + sv.condition.slice(1).toLowerCase()}
                                  </span>
                                )}
                                {sv.odometerAtArrival != null && (
                                  <span>Odometer: {sv.odometerAtArrival.toLocaleString()} km</span>
                                )}
                                {sv.inspectionNotes && (
                                  <span style={{ color: 'var(--text-3)' }} title={sv.inspectionNotes}>
                                    {sv.inspectionNotes.length > 70
                                      ? sv.inspectionNotes.slice(0, 67) + '…'
                                      : sv.inspectionNotes}
                                  </span>
                                )}
                                <span style={{ color: 'var(--text-3)' }}>
                                  Inspected {fmtDate(sv.inspectedAt, isAr, { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                            )}

                            {/* Cost row + edit duty */}
                            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>
                                Customs:{' '}
                                {editDutyId === sv.id ? (
                                  <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                                    <NumericInput
                                      className="input"
                                      min="0"
                                      value={editDuty}
                                      onChange={(val) => setEditDuty(val)}
                                      style={{ width: '6rem', padding: '0.15rem 0.35rem', fontSize: '0.6875rem', height: 'auto' }}
                                    />
                                    <button className="btn btn-primary btn-sm"
                                      style={{ fontSize: '0.625rem', padding: '0.15rem 0.4rem' }}
                                      disabled={savingDuty}
                                      onClick={() => saveDuty(sv.id)}>
                                      {savingDuty ? '…' : 'Save'}
                                    </button>
                                    <button className="btn btn-ghost btn-sm"
                                      style={{ fontSize: '0.625rem', padding: '0.1rem 0.25rem' }}
                                      onClick={() => setEditDutyId(null)}>✕</button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => { setEditDutyId(sv.id); setEditDuty(String(sv.customsDuty ?? 0)); }}
                                    style={{
                                      fontWeight: 500, color: 'var(--text-1)', cursor: 'pointer',
                                      background: 'none', border: 'none', fontSize: '0.6875rem', padding: 0,
                                      textDecoration: 'underline', textDecorationStyle: 'dotted',
                                    }}
                                  >
                                    {fmt(sv.customsDuty)}
                                  </button>
                                )}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>
                                Allocated:{' '}
                                <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{fmt(sv.allocatedLanded)}</span>
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>
                                Total Landed:{' '}
                                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{fmt(sv.totalLandedCost)}</span>
                              </span>
                            </div>
                          </div>

                          {/* Inline inspection form (expandable) */}
                          {isInspecting && (
                            <div style={{
                              padding: '1rem 1rem 1rem 1rem',
                              borderTop: '1px solid var(--border)',
                              background: 'var(--surface-2)',
                              display: 'flex', flexDirection: 'column', gap: '0.75rem',
                            }}>
                              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-1)' }}>
                                Inspection Report — {sv.vehicle.year} {sv.vehicle.make} {sv.vehicle.model}
                              </p>
                              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                {/* Condition */}
                                <div>
                                  <label className="input-label">Condition</label>
                                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    {CONDITIONS.map((c) => (
                                      <button key={c} type="button" onClick={() => setInsp('condition', c)} style={{
                                        padding: '0.2rem 0.65rem', borderRadius: '1rem', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                                        border: `2px solid ${inspForm.condition === c ? CONDITION_COLORS[c] : 'var(--border)'}`,
                                        background: inspForm.condition === c ? (CONDITION_COLORS[c] + '22') : 'transparent',
                                        color: inspForm.condition === c ? CONDITION_COLORS[c] : 'var(--text-3)',
                                      }}>
                                        {c.charAt(0) + c.slice(1).toLowerCase()}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {/* Odometer */}
                                <div>
                                  <label className="input-label">Odometer (km)</label>
                                  <NumericInput
                                    className="input"
                                    min="0"
                                    value={inspForm.odometer}
                                    onChange={(v) => setInsp('odometer', v)}
                                    placeholder="0"
                                    style={{ width: '8rem' }}
                                  />
                                </div>
                                {/* Pass / Fail */}
                                <div>
                                  <label className="input-label">Result</label>
                                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    {RESULT_OPTIONS.map(({ value, label, color }) => (
                                      <button key={value} type="button" onClick={() => setInsp('result', value)} style={{
                                        padding: '0.2rem 0.75rem', borderRadius: '1rem', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                                        border: `2px solid ${inspForm.result === value ? color : 'var(--border)'}`,
                                        background: inspForm.result === value ? (color + '22') : 'transparent',
                                        color: inspForm.result === value ? color : 'var(--text-3)',
                                      }}>
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              {/* Notes */}
                              <div>
                                <label className="input-label">Notes</label>
                                <textarea
                                  className="input"
                                  rows={2}
                                  value={inspForm.notes}
                                  onChange={(e) => setInsp('notes', e.target.value)}
                                  placeholder="Any observations, damage notes, missing items…"
                                  style={{ resize: 'vertical', width: '100%' }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInspectId(null)}>Cancel</button>
                                <button type="button" className="btn btn-primary btn-sm" disabled={savingInsp}
                                  onClick={() => saveInspection(sv.id)}>
                                  {savingInsp ? 'Saving…' : 'Save Inspection'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
  const [selectedId, setSelectedId]    = useState<string | null>(null);

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
            {shipments.length} {isAr ? (shipments.length !== 1 ? 'شحنات' : 'شحنة') : (shipments.length !== 1 ? 'shipments' : 'shipment')}
            {' · '}{fmt(totalCosts)} {isAr ? 'إجمالي التكاليف' : 'total costs'}
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
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(s.id)}>
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
