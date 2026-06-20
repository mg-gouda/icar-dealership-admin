'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface Location {
  id: string;
  name: string;
  city?: string;
  defaultAdminFee?: number;
  defaultInsuranceFee?: number;
}

/* ─── Options ─────────────────────────────────────────────────────────── */
const YEARS = Array.from({ length: 17 }, (_, i) => {
  const y = 2026 - i;
  return { value: String(y), label: String(y) };
});
const MAKES = ['Toyota', 'Hyundai', 'Kia', 'Chevrolet', 'Mercedes-Benz', 'BMW', 'Volkswagen', 'Nissan', 'Honda', 'Ford', 'Mitsubishi', 'Jeep', 'Mazda', 'Suzuki', 'Renault']
  .map((m) => ({ value: m, label: m }));
const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Brown', 'Gold', 'Beige', 'Pearl']
  .map((c) => ({ value: c, label: c }));
const BODY_TYPES = ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Coupe', 'Convertible', 'Wagon']
  .map((b) => ({ value: b, label: b }));
const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'USED', label: 'Used' },
  { value: 'CERTIFIED', label: 'Certified Pre-Owned' },
];
const TRANSMISSIONS = [
  { value: 'Automatic', label: 'Automatic' },
  { value: 'Manual', label: 'Manual' },
  { value: 'CVT', label: 'CVT' },
];
const FUEL_TYPES = [
  { value: 'Petrol', label: 'Petrol' },
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Electric', label: 'Electric' },
];
const INITIAL_STATUSES = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'PENDING_INSPECTION', label: 'Pending Inspection' },
];
const FEATURES_LIST = [
  'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera',
  'Blind Spot Monitor', 'Lane Departure Warning', 'Sunroof', 'Heated Seats',
  'Keyless Entry', 'Push Start', 'Navigation', 'Parking Sensors',
];

const STEPS = [
  { n: 1, label: 'Basic Info' },
  { n: 2, label: 'Specs & Features' },
  { n: 3, label: 'Pricing & Location' },
  { n: 4, label: 'Upload Photos' },
  { n: 5, label: 'Review & Publish' },
];

const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

/* ─── Default form state ──────────────────────────────────────────────── */
function initForm() {
  return {
    // Step 1
    vin: '', make: '', model: '', year: '2025', trim: '', mileage: '', color: '', bodyType: '', condition: 'NEW',
    // Step 2
    engineType: '', transmission: '', fuelType: '', doors: '', seats: '',
    features: [] as string[],
    // Step 3
    acquisitionCost: '', salePrice: '', adminFeeOverride: '', insuranceFeeOverride: '',
    locationId: '', status: 'AVAILABLE',
    // Step 4 — photo URLs (simplified — URL input list)
    photos: [] as string[],
  };
}

export default function NewVehiclePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [photoInput, setPhotoInput] = useState('');

  const { data: locationsRaw } = useQuery<Location[]>('/locations');
  const locations: Location[] = Array.isArray(locationsRaw) ? locationsRaw : [];
  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name + (l.city ? ` — ${l.city}` : ''),
  }));

  const selectedLocation = locations.find((l) => l.id === form.locationId);

  function set(k: string, v: string | string[]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function toggleFeature(f: string) {
    setForm((p) => ({
      ...p,
      features: p.features.includes(f) ? p.features.filter((x) => x !== f) : [...p.features, f],
    }));
  }

  /* ─── Computed margin ─────────────────────────────────────────────── */
  const cost = Number(form.acquisitionCost) || 0;
  const price = Number(form.salePrice) || 0;
  const margin = price > 0 && cost > 0 ? price - cost : 0;
  const marginPct = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : 0;

  /* ─── Step validation ─────────────────────────────────────────────── */
  function validateStep(s: number): string {
    if (s === 1) {
      if (!form.vin || form.vin.length !== 17) return 'VIN must be exactly 17 characters.';
      if (!form.make) return 'Make is required.';
      if (!form.model) return 'Model is required.';
      if (!form.mileage && form.condition !== 'NEW') return 'Mileage is required for used vehicles.';
      if (!form.color) return 'Color is required.';
      if (!form.bodyType) return 'Body Type is required.';
    }
    if (s === 3) {
      if (!form.salePrice || Number(form.salePrice) <= 0) return 'Listed Sale Price is required.';
      if (!form.locationId) return 'Location assignment is required.';
    }
    return '';
  }

  function next() {
    const e = validateStep(step);
    if (e) { setErr(e); return; }
    setErr('');
    setStep((s) => s + 1);
  }

  function back() {
    setErr('');
    setStep((s) => s - 1);
  }

  /* ─── Submit ──────────────────────────────────────────────────────── */
  async function publish() {
    const e = validateStep(3);
    if (e) { setErr(e); return; }
    setSaving(true);
    setErr('');
    try {
      const body: Record<string, unknown> = {
        vin: form.vin,
        make: form.make,
        model: form.model,
        year: Number(form.year),
        color: form.color,
        bodyType: form.bodyType,
        condition: form.condition,
        price: Number(form.salePrice),
        locationId: form.locationId,
        status: form.status,
        ...(form.trim && { trim: form.trim }),
        ...(form.mileage && { mileage: Number(form.mileage) }),
        ...(form.engineType && { engineSize: form.engineType }),
        ...(form.transmission && { transmission: form.transmission }),
        ...(form.fuelType && { fuelType: form.fuelType }),
        ...(form.doors && { doors: Number(form.doors) }),
        ...(form.seats && { seats: Number(form.seats) }),
        ...(form.acquisitionCost && { cost: Number(form.acquisitionCost) }),
        ...(form.adminFeeOverride && { adminFeeOverride: Number(form.adminFeeOverride) }),
        ...(form.insuranceFeeOverride && { insuranceFeeOverride: Number(form.insuranceFeeOverride) }),
        ...(form.features.length && { features: form.features }),
      };
      const v = await apiFetch<{ id: string }>('/vehicles', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // Upload images if any
      for (let i = 0; i < form.photos.length; i++) {
        await apiFetch(`/vehicles/${v.id}/images`, {
          method: 'POST',
          body: JSON.stringify({ url: form.photos[i], order: i }),
        }).catch(() => {});
      }
      router.push(`/vehicles/${v.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href="/vehicles" style={{ color: 'var(--text-3)', fontSize: '0.75rem', textDecoration: 'none' }}>
              Vehicles
            </Link>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>Add Vehicle</span>
          </div>
          <h1 className="page-title">Add New Vehicle</h1>
          <p className="page-subtitle">Complete all steps to add a vehicle to inventory</p>
        </div>
      </div>

      <div className="page-body">
        {/* Step indicator */}
        <div style={{ display: 'flex', marginBottom: '1.5rem' }}>
          {STEPS.map((s, idx) => (
            <div key={s.n} className={`step-item${step > s.n ? ' done' : ''}`}>
              <div className={`step-circle${step === s.n ? ' active' : step > s.n ? ' done' : ''}`}>
                {step > s.n ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : s.n}
              </div>
              <span className={`step-label${step === s.n ? ' active' : ''}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {err && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            color: 'var(--danger-fg)',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
          }}>
            {err}
          </div>
        )}

        {/* Two-column layout: main + sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem', alignItems: 'start' }}>

          {/* ── Main content ──────────────────────────────────────── */}
          <div>

            {/* STEP 1 — Basic Info */}
            {step === 1 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                {/* VIN auto-decode banner */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'var(--info-bg)',
                  border: '1px solid var(--info)',
                  marginBottom: '1.5rem',
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--info)', flexShrink: 0, marginTop: '1px' }}>
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M8 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="8" cy="5" r="0.6" fill="currentColor"/>
                  </svg>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--info-fg)' }}>
                    <strong>VIN Auto-Decode</strong> — Enter the VIN and the system will auto-fill make, model, and specs.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* VIN */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="input-label">VIN Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      className="input"
                      value={form.vin}
                      onChange={(e) => set('vin', e.target.value.toUpperCase().slice(0, 17))}
                      placeholder="17-character VIN"
                      maxLength={17}
                      style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                    />
                    <p style={{ fontSize: '0.6875rem', color: form.vin.length === 17 ? 'var(--success-fg)' : 'var(--text-3)', marginTop: '0.25rem' }}>
                      {form.vin.length}/17 characters
                    </p>
                  </div>

                  {/* Make */}
                  <div>
                    <label className="input-label">Make <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableCombobox
                      options={MAKES}
                      value={form.make}
                      onChange={(v) => set('make', v)}
                      placeholder="Select make…"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="input-label">Model <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      className="input"
                      value={form.model}
                      onChange={(e) => set('model', e.target.value)}
                      placeholder="e.g. Corolla, Tucson…"
                    />
                  </div>

                  {/* Year */}
                  <div>
                    <label className="input-label">Year <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableCombobox
                      options={YEARS}
                      value={form.year}
                      onChange={(v) => set('year', v)}
                      placeholder="Select year…"
                    />
                  </div>

                  {/* Trim */}
                  <div>
                    <label className="input-label">Trim / Variant</label>
                    <input
                      className="input"
                      value={form.trim}
                      onChange={(e) => set('trim', e.target.value)}
                      placeholder="e.g. SE, Sport, Limited…"
                    />
                  </div>

                  {/* Mileage */}
                  <div>
                    <label className="input-label">Mileage (km) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={form.mileage}
                      onChange={(e) => set('mileage', e.target.value)}
                      placeholder="0 for new vehicles"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="input-label">Color <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableCombobox
                      options={COLORS}
                      value={form.color}
                      onChange={(v) => set('color', v)}
                      placeholder="Select color…"
                    />
                  </div>

                  {/* Body Type */}
                  <div>
                    <label className="input-label">Body Type <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableCombobox
                      options={BODY_TYPES}
                      value={form.bodyType}
                      onChange={(v) => set('bodyType', v)}
                      placeholder="Select body type…"
                    />
                  </div>

                  {/* Condition */}
                  <div>
                    <label className="input-label">Condition</label>
                    <SearchableCombobox
                      options={CONDITIONS}
                      value={form.condition}
                      onChange={(v) => set('condition', v)}
                      placeholder="Select condition…"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — Specs & Features */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">Engine & Drivetrain</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">Engine Type</label>
                      <input
                        className="input"
                        value={form.engineType}
                        onChange={(e) => set('engineType', e.target.value)}
                        placeholder="e.g. 2.0L Inline-4, 3.5L V6…"
                      />
                    </div>
                    <div>
                      <label className="input-label">Transmission</label>
                      <SearchableCombobox
                        options={TRANSMISSIONS}
                        value={form.transmission}
                        onChange={(v) => set('transmission', v)}
                        placeholder="Select…"
                        clearable
                        clearLabel="Not specified"
                      />
                    </div>
                    <div>
                      <label className="input-label">Fuel Type</label>
                      <SearchableCombobox
                        options={FUEL_TYPES}
                        value={form.fuelType}
                        onChange={(v) => set('fuelType', v)}
                        placeholder="Select…"
                        clearable
                        clearLabel="Not specified"
                      />
                    </div>
                    <div>
                      <label className="input-label">Doors</label>
                      <input
                        className="input"
                        type="number"
                        min="2"
                        max="6"
                        value={form.doors}
                        onChange={(e) => set('doors', e.target.value)}
                        placeholder="e.g. 4"
                      />
                    </div>
                    <div>
                      <label className="input-label">Seats</label>
                      <input
                        className="input"
                        type="number"
                        min="2"
                        max="9"
                        value={form.seats}
                        onChange={(e) => set('seats', e.target.value)}
                        placeholder="e.g. 5"
                      />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">Features & Options</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {FEATURES_LIST.map((f) => {
                      const checked = form.features.includes(f);
                      return (
                        <label
                          key={f}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            color: 'var(--text-1)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.4rem',
                            border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                            background: checked ? 'var(--info-bg)' : 'var(--surface)',
                            transition: 'all 150ms',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFeature(f)}
                            style={{ accentColor: 'var(--primary)', width: '14px', height: '14px' }}
                          />
                          {f}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Pricing & Location */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Pricing */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">Pricing</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">
                        Purchase / Acquisition Cost (EGP) <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={form.acquisitionCost}
                        onChange={(e) => set('acquisitionCost', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="input-label">
                        Listed Sale Price (EGP) <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={form.salePrice}
                        onChange={(e) => set('salePrice', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Gross margin bar */}
                  {margin > 0 && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: 'var(--success-bg)',
                      border: '1px solid var(--success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 500 }}>
                        Gross Profit Margin
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 700 }}>
                        {fmt(margin)} ({marginPct.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Egypt regulatory fees */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">Egypt Regulatory Fees</p>

                  <div style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.4rem',
                    background: 'var(--warning-bg)',
                    border: '1px solid var(--warning)',
                    fontSize: '0.75rem',
                    color: 'var(--warning-fg)',
                    marginBottom: '1rem',
                  }}>
                    Leave blank to use the branch default. These appear as line items on the customer invoice.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">Administration Fee (EGP)</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={form.adminFeeOverride}
                        onChange={(e) => set('adminFeeOverride', e.target.value)}
                        placeholder={
                          selectedLocation?.defaultAdminFee
                            ? `${Number(selectedLocation.defaultAdminFee).toLocaleString()} (Location Default)`
                            : '3,500 (Location Default)'
                        }
                      />
                    </div>
                    <div>
                      <label className="input-label">Compulsory Insurance (EGP)</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={form.insuranceFeeOverride}
                        onChange={(e) => set('insuranceFeeOverride', e.target.value)}
                        placeholder={
                          selectedLocation?.defaultInsuranceFee
                            ? `${Number(selectedLocation.defaultInsuranceFee).toLocaleString()} (Location Default)`
                            : '4,800 (Location Default)'
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Branch assignment */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">Branch Assignment</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">
                        Assign to Location <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <SearchableCombobox
                        options={locationOptions}
                        value={form.locationId}
                        onChange={(v) => set('locationId', v)}
                        placeholder="Select branch…"
                      />
                    </div>
                    <div>
                      <label className="input-label">Initial Status</label>
                      <SearchableCombobox
                        options={INITIAL_STATUSES}
                        value={form.status}
                        onChange={(v) => set('status', v)}
                        placeholder="Select status…"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 — Upload Photos */}
            {step === 4 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <p className="section-label">Vehicle Photos</p>

                {/* Drag-drop area (visual only — actual upload uses URL for now) */}
                <div style={{
                  border: '2px dashed var(--border-strong)',
                  borderRadius: '0.75rem',
                  padding: '2.5rem',
                  textAlign: 'center',
                  background: 'var(--surface-2)',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--text-3)' }}>
                      <rect x="4" y="8" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="14" cy="18" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M4 28l8-8 6 6 4-4 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', fontWeight: 500, marginBottom: '0.25rem' }}>
                    Click to upload or drag and drop
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    PNG, JPG up to 10MB each. First image becomes the primary photo.
                  </p>
                </div>

                {/* URL input (functional fallback) */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    className="input"
                    value={photoInput}
                    onChange={(e) => setPhotoInput(e.target.value)}
                    placeholder="Or paste image URL…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && photoInput.trim()) {
                        e.preventDefault();
                        set('photos', [...form.photos, photoInput.trim()]);
                        setPhotoInput('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!photoInput.trim()}
                    onClick={() => {
                      if (!photoInput.trim()) return;
                      set('photos', [...form.photos, photoInput.trim()]);
                      setPhotoInput('');
                    }}
                  >
                    Add
                  </button>
                </div>

                {/* Photo grid */}
                {form.photos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {form.photos.map((url, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '4/3' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div style={{
                          position: 'absolute', top: '0.4rem', right: '0.4rem',
                          display: 'flex', gap: '0.25rem',
                        }}>
                          {i === 0 && (
                            <span className="badge badge-info" style={{ fontSize: '0.625rem', padding: '0.15rem 0.4rem' }}>
                              Primary
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => set('photos', form.photos.filter((_, j) => j !== i))}
                            style={{
                              width: '22px', height: '22px', borderRadius: '9999px',
                              background: 'rgba(0,0,0,0.6)', color: '#fff',
                              border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            ×
                          </button>
                        </div>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const arr = [...form.photos];
                              const [removed] = arr.splice(i, 1);
                              arr.unshift(removed);
                              set('photos', arr);
                            }}
                            style={{
                              position: 'absolute', bottom: '0.4rem', left: '0.4rem',
                              fontSize: '0.625rem', padding: '0.15rem 0.4rem',
                              background: 'rgba(0,0,0,0.65)', color: '#fff',
                              border: 'none', borderRadius: '0.25rem', cursor: 'pointer',
                            }}
                          >
                            Set as Primary
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {form.photos.length === 0 && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem 0' }}>
                    No photos added yet. You can add photos after publishing as well.
                  </p>
                )}
              </div>
            )}

            {/* STEP 5 — Review & Publish */}
            {step === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Identity review */}
                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '1rem' }}>Basic Information</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 1.5rem' }}>
                    {[
                      ['VIN', form.vin || '—'],
                      ['Make', form.make || '—'],
                      ['Model', form.model || '—'],
                      ['Year', form.year],
                      ['Trim', form.trim || '—'],
                      ['Color', form.color || '—'],
                      ['Body Type', form.bodyType || '—'],
                      ['Condition', form.condition || '—'],
                      ['Mileage', form.mileage ? `${Number(form.mileage).toLocaleString()} km` : '0 km'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, marginTop: '0.15rem' }}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Specs review */}
                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '1rem' }}>Specifications</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 1.5rem' }}>
                    {[
                      ['Engine', form.engineType || '—'],
                      ['Transmission', form.transmission || '—'],
                      ['Fuel Type', form.fuelType || '—'],
                      ['Doors', form.doors || '—'],
                      ['Seats', form.seats || '—'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, marginTop: '0.15rem' }}>{val}</p>
                      </div>
                    ))}
                  </div>
                  {form.features.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Features</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {form.features.map((f) => (
                          <span key={f} className="badge badge-info">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pricing review */}
                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '1rem' }}>Pricing & Location</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      ['Acquisition Cost', form.acquisitionCost ? fmt(Number(form.acquisitionCost)) : '—'],
                      ['Sale Price', form.salePrice ? fmt(Number(form.salePrice)) : '—'],
                      ['Admin Fee', form.adminFeeOverride ? fmt(Number(form.adminFeeOverride)) : 'Location Default'],
                      ['Insurance', form.insuranceFeeOverride ? fmt(Number(form.insuranceFeeOverride)) : 'Location Default'],
                      ['Location', locationOptions.find((l) => l.value === form.locationId)?.label ?? '—'],
                      ['Initial Status', INITIAL_STATUSES.find((s) => s.value === form.status)?.label ?? form.status],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{label}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontWeight: 500 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  {margin > 0 && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.4rem',
                      background: 'var(--success-bg)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 500 }}>Gross Margin</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 700 }}>
                        {fmt(margin)} ({marginPct.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Photos review */}
                {form.photos.length > 0 && (
                  <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                    <p className="section-label" style={{ marginBottom: '0.75rem' }}>Photos ({form.photos.length})</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {form.photos.slice(0, 6).map((url, i) => (
                        <div key={i} style={{ width: '64px', height: '48px', borderRadius: '0.375rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                      {form.photos.length > 6 && (
                        <div style={{ width: '64px', height: '48px', borderRadius: '0.375rem', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                          +{form.photos.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nav buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border)',
            }}>
              <div>
                {step > 1 ? (
                  <button className="btn btn-secondary" onClick={back}>
                    ← Back
                  </button>
                ) : (
                  <Link href="/vehicles" className="btn btn-secondary">
                    Cancel
                  </Link>
                )}
              </div>
              <div>
                {step < 5 ? (
                  <button className="btn btn-primary" onClick={next}>
                    {step === 4 ? 'Review →' : `Next: ${STEPS[step]?.label} →`}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={publish}
                    disabled={saving}
                    style={{ minWidth: '140px' }}
                  >
                    {saving ? 'Publishing…' : 'Publish Vehicle'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Right sidebar ─────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1rem' }}>

            {/* Progress panel */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label">Progress</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {STEPS.map((s) => {
                  const done = step > s.n;
                  const active = step === s.n;
                  return (
                    <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '9999px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--surface-2)',
                        border: `2px solid ${done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--border)'}`,
                      }}>
                        {done ? (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: active ? '#fff' : 'var(--text-3)' }}>
                            {s.n}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.8125rem',
                        color: active ? 'var(--text-1)' : done ? 'var(--success-fg)' : 'var(--text-3)',
                        fontWeight: active ? 600 : 400,
                      }}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pricing summary card (visible on step 3+) */}
            {step >= 3 && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <p className="section-label">Pricing Summary</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {[
                    { label: 'Listed Price', value: form.salePrice ? fmt(Number(form.salePrice)) : '—' },
                    { label: 'Acquisition Cost', value: form.acquisitionCost ? fmt(Number(form.acquisitionCost)) : '—' },
                    {
                      label: 'Admin Fee',
                      value: form.adminFeeOverride ? fmt(Number(form.adminFeeOverride)) : 'Location Default',
                    },
                    {
                      label: 'Compulsory Insurance',
                      value: form.insuranceFeeOverride ? fmt(Number(form.insuranceFeeOverride)) : 'Location Default',
                    },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '0.5rem 0', borderBottom: '1px solid var(--border)',
                      fontSize: '0.8125rem',
                    }}>
                      <span style={{ color: 'var(--text-2)' }}>{label}</span>
                      <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                  {margin > 0 && (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      fontSize: '0.8125rem',
                    }}>
                      <span style={{ color: 'var(--text-2)' }}>Gross Margin</span>
                      <span style={{ color: 'var(--success-fg)', fontWeight: 700 }}>
                        {fmt(margin)} ({marginPct.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tips card */}
            <div style={{
              padding: '1rem',
              borderRadius: '0.625rem',
              background: 'var(--info-bg)',
              border: '1px solid var(--info)',
            }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--info-fg)', marginBottom: '0.5rem' }}>
                Tips
              </p>
              <ul style={{ fontSize: '0.75rem', color: 'var(--info-fg)', lineHeight: 1.6, paddingLeft: '1rem', margin: 0 }}>
                {step === 1 && (
                  <>
                    <li>VIN must be exactly 17 characters.</li>
                    <li>Enter the full VIN to enable auto-decode.</li>
                    <li>Select condition carefully — affects tax calculations.</li>
                  </>
                )}
                {step === 2 && (
                  <>
                    <li>Features help customers filter on the B2C site.</li>
                    <li>More specs improve vehicle discoverability.</li>
                  </>
                )}
                {step === 3 && (
                  <>
                    <li>Admin fee and insurance defaults are set per-branch.</li>
                    <li>Cost is hidden from sales reps — finance only.</li>
                    <li>Price must be higher than acquisition cost.</li>
                  </>
                )}
                {step === 4 && (
                  <>
                    <li>First photo becomes the primary listing image.</li>
                    <li>Drag to reorder — or click "Set as Primary".</li>
                    <li>You can add more photos after publishing.</li>
                  </>
                )}
                {step === 5 && (
                  <>
                    <li>Review all details before publishing.</li>
                    <li>Vehicle status can be changed after publishing.</li>
                    <li>You can edit any field from the vehicle detail page.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
