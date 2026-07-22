'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import { canViewField, canWriteField } from '../../../../lib/fieldPermissions';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '../../../../lib/lang-context';
import { fmtDateTime } from '@/lib/fmt';

interface VehicleImage { id: string; url: string; order: number; isPrimary?: boolean; }
interface AuditEntry { id: string; action: string; createdAt: string; user?: { name: string }; metadata?: Record<string, unknown>; }

interface Vehicle {
  id: string; make: string; model: string; trim?: string; year: number;
  vin: string; status: string; condition?: string;
  bodyType?: string; color?: string; mileage?: number; engineSize?: string;
  fuelType?: string; transmission?: string; seats?: number; doors?: number;
  hp?: number; torque?: number; driveType?: string; gearType?: string;
  price: number; salePrice?: number; cost?: number; acquisitionCost?: number;
  overprice?: number; ourProfit?: number;
  customerAskingPrice?: number; minimumAskingPrice?: number;
  adminFeeOverride?: number; insuranceFeeOverride?: number;
  description?: string;
  locationId?: string;
  location?: { id: string; name: string; city?: string };
  accreditedDealer?: { id: string; name: string };
  accreditedDealerId?: string;
  images?: VehicleImage[];
  features?: { feature: string }[];
  daysInStock?: number;
  createdAt?: string;
  updatedAt?: string;
  regLicenseNumber?: string;
  licenseExpiryDate?: string;
  engineChanged?: boolean;
  newEngineNumber?: string;
  accidentHistory?: boolean;
  affectedParts?: string;
  engineConditionPct?: number;
  transmissionConditionPct?: number;
}

interface PriceLogEntry {
  id: string;
  oldPrice: number;
  newPrice: number;
  note?: string;
  changedByName?: string;
  changedAt: string;
}

const FEATURES_LIST = ['Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Blind Spot Monitor', 'Lane Departure Warning', 'Sunroof', 'Heated Seats', 'Keyless Entry', 'Push Start', 'Navigation', 'Parking Sensors'];

const EDIT_SECTIONS = [
  { id: 'basic',   icon: '📋', label: 'Basic Info',            labelAr: 'البيانات الأساسية', desc: 'Color, trim, mileage, description', descAr: 'اللون، الإصدار، الكيلومترات، الوصف' },
  { id: 'specs',   icon: '⚙️', label: 'Specifications',        labelAr: 'المواصفات الفنية',   desc: 'Engine, fuel, transmission, features', descAr: 'المحرك، الوقود، ناقل الحركة، المميزات' },
  { id: 'pricing', icon: '💰', label: 'Pricing',               labelAr: 'التسعير',             desc: 'Sale price, cost, fees', descAr: 'سعر البيع، التكلفة، الرسوم' },
  { id: 'used',    icon: '🔍', label: 'Used Vehicle Details',  labelAr: 'تفاصيل المستعمل',    desc: 'Registration, history, condition %', descAr: 'التسجيل، التاريخ، نسب الحالة', usedOnly: true },
  { id: 'status',  icon: '🔄', label: 'Status & Location',     labelAr: 'الحالة والفرع',       desc: 'Status, branch, dealer', descAr: 'الحالة، الفرع، الوكيل المعتمد' },
] as const;

const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'AVAILABLE': return 'badge badge-success';
    case 'RESERVED': return 'badge badge-info';
    case 'SOLD': return 'badge badge-neutral';
    case 'IN_TRANSIT': return 'badge badge-warning';
    case 'PENDING_INSPECTION': return 'badge badge-orange';
    default: return 'badge badge-neutral';
  }
}

type TabId = 'overview' | 'pricing' | 'specifications' | 'history';

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAr } = useLang();

  const STATUSES = [
    { value: 'AVAILABLE', label: isAr ? 'متوفر' : 'Available' },
    { value: 'RESERVED', label: isAr ? 'محجوز' : 'Reserved' },
    { value: 'SOLD', label: isAr ? 'مباع' : 'Sold' },
    { value: 'IN_TRANSIT', label: isAr ? 'في الطريق' : 'In Transit' },
    { value: 'PENDING_INSPECTION', label: isAr ? 'قيد الفحص' : 'Pending Inspection' },
    { value: 'INACTIVE', label: isAr ? 'غير نشط' : 'Inactive' },
  ];
  const CONDITIONS = [
    { value: 'NEW', label: isAr ? 'جديدة' : 'New' },
    { value: 'USED', label: isAr ? 'مستعملة' : 'Used' },
    { value: 'CERTIFIED', label: isAr ? 'معتمدة مسبقاً' : 'Certified Pre-Owned' },
  ];

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [form, setForm] = useState<Partial<Vehicle>>({});
  const [activeImg, setActiveImg] = useState(0);
  const [addImgUrl, setAddImgUrl] = useState('');
  const [addingImg, setAddingImg] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dealers, setDealers] = useState<{id:string;name:string}[]>([]);
  const [locations, setLocations] = useState<{id:string;name:string;city?:string}[]>([]);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [sf, setSf] = useState<Record<string, unknown>>({});
  const [sfSaving, setSfSaving] = useState(false);
  const [sfErr, setSfErr] = useState('');
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceLogEntry[]>([]);
  const [phLoading, setPhLoading] = useState(false);

  useEffect(() => {
    apiFetch<{id:string;name:string}[]>('/accredited-dealers').then(setDealers).catch(() => {});
    apiFetch<{id:string;name:string;city?:string}[]>('/locations').then(setLocations).catch(() => {});
  }, []);

  const { data: v, loading, error, reload } = useQuery<Vehicle>(`/vehicles/${id}`, [id]);
  const { data: auditRaw } = useQuery<{ items: AuditEntry[] } | AuditEntry[]>(
    activeTab === 'history' ? `/audit-log?entityType=Vehicle&entityId=${id}&limit=50` : null,
    [activeTab, id],
  );
  const auditEntries: AuditEntry[] = Array.isArray(auditRaw)
    ? auditRaw
    : (auditRaw as any)?.items ?? [];

  // Dynamic lookup lists
  type LI = { id: string; value: string; label: string };
  const { data: rawFuelTypes }     = useQuery<LI[]>('/lookup-items?category=fuel_type');
  const { data: rawTransmissions } = useQuery<LI[]>('/lookup-items?category=transmission');
  const { data: rawBodyTypes }     = useQuery<LI[]>('/lookup-items?category=body_type');
  const toOpts = (r: LI[] | null | undefined) => (Array.isArray(r) ? r : []).map((i) => ({ value: i.value, label: i.label }));
  const FUEL_TYPES    = toOpts(rawFuelTypes);
  const TRANSMISSIONS = toOpts(rawTransmissions);
  const BODY_TYPES    = toOpts(rawBodyTypes);

  useEffect(() => {
    if (v) {
      setForm({
        status: v.status,
        price: v.salePrice ?? v.price,
        cost: v.acquisitionCost ?? v.cost,
        color: v.color,
        mileage: v.mileage,
        fuelType: v.fuelType,
        transmission: v.transmission,
        seats: v.seats,
        doors: v.doors,
        description: v.description,
        bodyType: v.bodyType,
        trim: v.trim,
        condition: v.condition,
        engineSize: v.engineSize,
        adminFeeOverride: v.adminFeeOverride,
        insuranceFeeOverride: v.insuranceFeeOverride,
        accreditedDealerId: v.accreditedDealer?.id ?? v.accreditedDealerId ?? '',
      });
    }
  }, [v]);

  function set(k: keyof Vehicle, val: unknown) {
    setForm((p) => ({ ...p, [k]: val }));
  }

  async function save() {
    setSaving(true);
    setSaveErr('');
    try {
      await apiFetch(`/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          price: form.price,
          cost: form.cost,
          accreditedDealerId: form.accreditedDealerId || undefined,
        }),
      });
      await reload();
      setEditing(false);
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addImage(e: React.FormEvent) {
    e.preventDefault();
    if (!addImgUrl.trim()) return;
    setAddingImg(true);
    try {
      await apiFetch(`/vehicles/${id}/images`, {
        method: 'POST',
        body: JSON.stringify({ url: addImgUrl.trim(), order: images.length }),
      });
      setAddImgUrl('');
      await reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setAddingImg(false);
    }
  }

  async function deleteImage(imageId: string) {
    if (!window.confirm(isAr ? 'حذف هذه الصورة؟' : 'Delete this image?')) return;
    await apiFetch(`/vehicles/${id}/images/${imageId}`, { method: 'DELETE' })
      .catch((e) => alert(e.message));
    await reload();
  }

  async function deleteVehicle() {
    setDeleting(true);
    try {
      await apiFetch(`/vehicles/${id}`, { method: 'DELETE' });
      router.push('/vehicles');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function openSection(section: string) {
    if (!v) return;
    let init: Record<string, unknown> = {};
    if (section === 'basic') {
      init = { trim: v.trim ?? '', color: v.color ?? '', mileage: v.mileage ?? '', bodyType: v.bodyType ?? '', condition: v.condition ?? '', description: v.description ?? '' };
    } else if (section === 'specs') {
      init = { engineSize: v.engineSize ?? '', fuelType: v.fuelType ?? '', transmission: v.transmission ?? '', driveType: v.driveType ?? '', gearType: v.gearType ?? '', doors: v.doors ?? '', seats: v.seats ?? '', hp: v.hp ?? '', torque: v.torque ?? '', features: v.features?.map(f => f.feature) ?? [] };
    } else if (section === 'pricing') {
      init = { price: v.salePrice ?? v.price ?? 0, cost: v.acquisitionCost ?? v.cost ?? '', overprice: v.overprice ?? '', ourProfit: v.ourProfit ?? '', adminFeeOverride: v.adminFeeOverride ?? '', insuranceFeeOverride: v.insuranceFeeOverride ?? '', priceNote: '' };
    } else if (section === 'used') {
      init = { regLicenseNumber: v.regLicenseNumber ?? '', licenseExpiryDate: v.licenseExpiryDate ? v.licenseExpiryDate.split('T')[0] : '', engineChanged: v.engineChanged ?? false, newEngineNumber: v.newEngineNumber ?? '', accidentHistory: v.accidentHistory ?? false, affectedParts: v.affectedParts ?? '', engineConditionPct: v.engineConditionPct ?? '', transmissionConditionPct: v.transmissionConditionPct ?? '' };
    } else if (section === 'status') {
      init = { status: v.status ?? '', locationId: v.location?.id ?? v.locationId ?? '', accreditedDealerId: v.accreditedDealer?.id ?? v.accreditedDealerId ?? '' };
    }
    setSf(init);
    setEditSection(section);
    setSfErr('');
    setShowSectionPicker(false);
  }

  async function saveSection() {
    setSfSaving(true);
    setSfErr('');
    try {
      const body: Record<string, unknown> = { ...sf };
      if (editSection === 'pricing') {
        body.price = sf.price ? Number(sf.price) : undefined;
        body.cost = sf.cost !== '' ? Number(sf.cost) : undefined;
        body.overprice = sf.overprice !== '' ? Number(sf.overprice) : undefined;
        body.ourProfit = sf.ourProfit !== '' ? Number(sf.ourProfit) : undefined;
        body.adminFeeOverride = sf.adminFeeOverride !== '' ? Number(sf.adminFeeOverride) : undefined;
        body.insuranceFeeOverride = sf.insuranceFeeOverride !== '' ? Number(sf.insuranceFeeOverride) : undefined;
      }
      await apiFetch(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await reload();
      setEditSection(null);
    } catch (e: unknown) {
      setSfErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSfSaving(false);
    }
  }

  async function loadPriceHistory() {
    setPhLoading(true);
    try {
      const data = await apiFetch<PriceLogEntry[]>(`/vehicles/${id}/price-history`);
      setPriceHistory(Array.isArray(data) ? data : []);
    } catch { /* noop */ }
    finally { setPhLoading(false); }
  }

  /* ─── Loading / error ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.875rem' }}>
        {isAr ? 'جارٍ تحميل السيارة…' : 'Loading vehicle…'}
      </div>
    );
  }
  if (error || !v) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          {error ?? (isAr ? 'السيارة غير موجودة' : 'Vehicle not found')}
        </p>
        <button className="btn btn-ghost" onClick={() => router.back()}>{isAr ? '→ العودة للمخزون' : '← Back to Inventory'}</button>
      </div>
    );
  }

  const images = [...(v.images ?? [])].sort((a, b) => a.order - b.order);
  const price = v.salePrice ?? v.price ?? 0;
  const cost = v.acquisitionCost ?? v.cost;
  const margin = cost != null && price > 0 ? price - cost : null;
  const marginPct = margin != null && price > 0 ? (margin / price) * 100 : null;

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: isAr ? 'نظرة عامة' : 'Overview' },
    { id: 'pricing', label: isAr ? 'التسعير' : 'Pricing' },
    { id: 'specifications', label: isAr ? 'المواصفات' : 'Specifications' },
    { id: 'history', label: isAr ? 'السجل' : 'History' },
  ];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <button
              onClick={() => router.push('/vehicles')}
              style={{ color: 'var(--text-3)', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {isAr ? 'السيارات' : 'Vehicles'}
            </button>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>
              {v.year} {v.make} {v.model}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="page-title">
              {v.year} {v.make} {v.model}
              {v.trim ? ` ${v.trim}` : ''}
            </h1>
            <span className={statusBadgeClass(v.status)}>
              {v.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="page-subtitle">
            {isAr ? 'رقم الشاسيه:' : 'VIN:'} <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{v.vin}</span>
            {v.location && ` · ${v.location.name}`}
            {v.daysInStock != null && (isAr ? ` · ${v.daysInStock} يوم في المخزن` : ` · ${v.daysInStock} days in stock`)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          {!editing ? (
            <>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                {isAr ? 'حذف' : 'Delete'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowSectionPicker(true)}>
                {isAr ? 'تعديل السيارة' : 'Edit Vehicle'}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setEditing(false); setSaveErr(''); }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save error */}
      {saveErr && (
        <div style={{
          margin: '0 1.5rem',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger)',
          color: 'var(--danger-fg)',
          fontSize: '0.8125rem',
        }}>
          {saveErr}
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: '0 1.5rem', marginTop: '1rem' }}>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">

        {/* ── TAB: Overview ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>

            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Image gallery */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ height: '280px', background: 'var(--surface-2)', position: 'relative' }}>
                  {images.length > 0 ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={images[activeImg]?.url}
                      alt={`${v.make} ${v.model}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-3)' }}>
                      <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1.293 1.293A1 1 0 005 17h1m8 0h5l-1.405-4.215A2 2 0 0016.68 11H14a1 1 0 00-1 1v4z"/>
                      </svg>
                      <span style={{ fontSize: '0.8125rem' }}>{isAr ? 'لا توجد صور' : 'No photos'}</span>
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', overflowX: 'auto' }}>
                    {images.map((img, i) => (
                      <button
                        key={img.id}
                        onClick={() => setActiveImg(i)}
                        style={{
                          flexShrink: 0, width: '60px', height: '44px',
                          borderRadius: '0.375rem', overflow: 'hidden',
                          border: `2px solid ${i === activeImg ? 'var(--primary)' : 'var(--border)'}`,
                          background: 'none', cursor: 'pointer', padding: 0,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Image management */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <p className="section-label">{isAr ? 'إدارة الصور' : 'Manage Photos'}</p>
                {images.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {images.map((img, i) => (
                      <div
                        key={img.id}
                        style={{
                          position: 'relative', width: '72px', height: '56px',
                          borderRadius: '0.375rem', overflow: 'hidden',
                          border: `2px solid ${i === activeImg ? 'var(--primary)' : 'var(--border)'}`,
                          cursor: 'pointer',
                        }}
                        onClick={() => setActiveImg(i)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }}
                          style={{
                            position: 'absolute', inset: 0, display: 'none',
                            alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.6)', color: '#fff',
                            border: 'none', cursor: 'pointer', fontSize: '13px',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.display = 'flex'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.display = 'none'; }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={addImage} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="input"
                    value={addImgUrl}
                    onChange={(e) => setAddImgUrl(e.target.value)}
                    placeholder={isAr ? 'أضف رابط الصورة…' : 'Add image URL…'}
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary btn-sm"
                    disabled={addingImg || !addImgUrl.trim()}
                    style={{ flexShrink: 0 }}
                  >
                    {addingImg ? '…' : (isAr ? 'إضافة صورة' : 'Add Photo')}
                  </button>
                </form>
              </div>

              {/* Description */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <p className="section-label">{isAr ? 'الوصف' : 'Description'}</p>
                {editing ? (
                  <textarea
                    value={form.description ?? ''}
                    onChange={(e) => set('description', e.target.value)}
                    rows={4}
                    className="textarea"
                    style={{ resize: 'vertical' }}
                    placeholder={isAr ? 'وصف السيارة…' : 'Vehicle description…'}
                  />
                ) : (
                  <p style={{ fontSize: '0.875rem', color: v.description ? 'var(--text-1)' : 'var(--text-3)', lineHeight: 1.6 }}>
                    {v.description ?? (isAr ? 'لا يوجد وصف.' : 'No description provided.')}
                  </p>
                )}
              </div>
            </div>

            {/* Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Vehicle info card */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <p className="section-label">{isAr ? 'بيانات السيارة' : 'Vehicle Info'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {[
                    [isAr ? 'الشركة' : 'Make', v.make],
                    [isAr ? 'الطراز' : 'Model', v.model],
                    [isAr ? 'السنة' : 'Year', v.year],
                    [isAr ? 'الإصدار' : 'Trim', v.trim || '—'],
                    [isAr ? 'الحالة' : 'Condition', v.condition || '—'],
                    [isAr ? 'الفرع' : 'Location', v.location ? `${v.location.name}${v.location.city ? `, ${v.location.city}` : ''}` : '—'],
                    [isAr ? 'الوكيل المعتمد' : 'Accredited Dealer', v.accreditedDealer?.name ?? '—'],
                    [isAr ? 'أيام في المخزن' : 'Days In Stock', v.daysInStock != null ? (isAr ? `${v.daysInStock} يوم` : `${v.daysInStock} days`) : '—'],
                  ].map(([label, val]) => (
                    <div key={String(label)} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '0.4rem 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{label}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontWeight: 500 }}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status card */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <p className="section-label">{isAr ? 'الوضع' : 'Status'}</p>
                {editing ? (
                  <SearchableCombobox
                    options={STATUSES}
                    value={form.status ?? v.status}
                    onChange={(val) => set('status', val)}
                    placeholder={isAr ? 'اختر الحالة…' : 'Select status…'}
                  />
                ) : (
                  <span className={statusBadgeClass(v.status)}>
                    {v.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              {/* Accredited Dealer */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <p className="section-label">{isAr ? 'الوكيل المعتمد' : 'Accredited Dealer'}</p>
                {editing ? (
                  <SearchableCombobox
                    options={[
                      { value: '', label: isAr ? '— بدون وكيل —' : '— No dealer —' },
                      ...dealers.map(d => ({ value: d.id, label: d.name }))
                    ]}
                    value={form.accreditedDealerId ?? ''}
                    onChange={(val) => set('accreditedDealerId', val)}
                    placeholder={isAr ? 'اختر الوكيل…' : 'Select dealer…'}
                  />
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500 }}>
                    {v.accreditedDealer?.name ?? '—'}
                  </p>
                )}
              </div>

              {/* Features */}
              {(v.features?.length ?? 0) > 0 && (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <p className="section-label">{isAr ? 'المميزات' : 'Features'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {v.features!.map((f) => (
                      <span key={f.feature} className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                        {f.feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Pricing ──────────────────────────────────────────────── */}
        {activeTab === 'pricing' && (
          <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <p className="section-label">{isAr ? 'سعر البيع' : 'Sale Pricing'}</p>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'سعر البيع المدرج (ج.م)' : 'Listed Sale Price (EGP)'}</label>
                    <NumericInput
                      className="input"
                      min="0"
                      value={form.price ?? ''}
                      onChange={(val) => set('price', Number(val))}
                    />
                  </div>
                  {canViewField('Vehicle', 'cost') && (
                    <div>
                      <label className="input-label">{isAr ? 'تكلفة الاستحواذ (ج.م)' : 'Acquisition Cost (EGP)'}</label>
                      <NumericInput
                        className="input"
                        min="0"
                        value={form.cost ?? ''}
                        onChange={(val) => set('cost', Number(val))}
                        disabled={!canWriteField('Vehicle', 'cost')}
                        style={{ opacity: canWriteField('Vehicle', 'cost') ? 1 : 0.5, cursor: canWriteField('Vehicle', 'cost') ? undefined : 'not-allowed' }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{isAr ? 'السعر المدرج' : 'Listed Price'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-1)' }}>
                        {fmt(price)}
                      </span>
                      <button
                        title={isAr ? 'سجل تغيرات السعر' : 'Price change history'}
                        onClick={() => { setShowPriceHistory(true); loadPriceHistory(); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1rem', padding: '0.1rem 0.25rem', borderRadius: '0.25rem', lineHeight: 1 }}
                      >
                        ℹ
                      </button>
                    </div>
                  </div>
                  {cost != null && canViewField('Vehicle', 'cost') && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{isAr ? 'تكلفة الاستحواذ' : 'Acquisition Cost'}</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500 }}>
                        {fmt(cost)}
                      </span>
                    </div>
                  )}
                  {margin != null && canViewField('Vehicle', 'cost') && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{isAr ? 'هامش الربح الإجمالي' : 'Gross Margin'}</span>
                      <span style={{ fontSize: '0.875rem', color: margin >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)', fontWeight: 600 }}>
                        {fmt(margin)}
                        {marginPct != null && (
                          <span style={{ fontSize: '0.75rem', marginLeft: '0.4rem', opacity: 0.8 }}>
                            ({marginPct.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
              <p className="section-label">{isAr ? 'الرسوم التنظيمية المصرية' : 'Egypt Regulatory Fees'}</p>
              <div style={{
                padding: '0.625rem 0.875rem',
                borderRadius: '0.4rem',
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning)',
                fontSize: '0.75rem',
                color: 'var(--warning-fg)',
                marginBottom: '1rem',
              }}>
                {isAr ? 'قيم التجاوز تأخذ الأولوية على الإعداد الافتراضي للفرع.' : 'Overrides take precedence over the location default. Leave as-is to use branch defaults.'}
              </div>
              {editing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {canViewField('Vehicle', 'adminFeeOverride') && (
                    <div>
                      <label className="input-label">{isAr ? 'تجاوز رسوم الإدارة (ج.م)' : 'Admin Fee Override (EGP)'}</label>
                      <NumericInput
                        className="input"
                        min="0"
                        value={form.adminFeeOverride ?? ''}
                        onChange={(val) => set('adminFeeOverride', val ? Number(val) : undefined)}
                        disabled={!canWriteField('Vehicle', 'adminFeeOverride')}
                        placeholder={isAr ? 'فارغ = افتراضي الفرع' : 'Blank = location default'}
                      />
                    </div>
                  )}
                  {canViewField('Vehicle', 'insuranceFeeOverride') && (
                    <div>
                      <label className="input-label">{isAr ? 'تجاوز رسوم التأمين (ج.م)' : 'Insurance Override (EGP)'}</label>
                      <NumericInput
                        className="input"
                        min="0"
                        value={form.insuranceFeeOverride ?? ''}
                        onChange={(val) => set('insuranceFeeOverride', val ? Number(val) : undefined)}
                        disabled={!canWriteField('Vehicle', 'insuranceFeeOverride')}
                        placeholder={isAr ? 'فارغ = افتراضي الفرع' : 'Blank = location default'}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {[
                    [isAr ? 'تجاوز رسوم الإدارة' : 'Admin Fee Override', v.adminFeeOverride != null ? fmt(v.adminFeeOverride) : (isAr ? 'يستخدم افتراضي الفرع' : 'Using location default')],
                    [isAr ? 'تجاوز رسوم التأمين' : 'Insurance Override', v.insuranceFeeOverride != null ? fmt(v.insuranceFeeOverride) : (isAr ? 'يستخدم افتراضي الفرع' : 'Using location default')],
                  ].map(([label, val]) => (
                    <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{label}</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500 }}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Specifications ───────────────────────────────────────── */}
        {activeTab === 'specifications' && (
          <div style={{ maxWidth: '640px' }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <p className="section-label">{isAr ? 'المواصفات الفنية' : 'Technical Specifications'}</p>
              {editing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'الحالة' : 'Condition'}</label>
                    <SearchableCombobox
                      options={CONDITIONS}
                      value={form.condition ?? ''}
                      onChange={(val) => set('condition', val)}
                      placeholder={isAr ? 'اختر…' : 'Select…'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'نوع الهيكل' : 'Body Type'}</label>
                    <SearchableCombobox
                      options={BODY_TYPES}
                      value={form.bodyType ?? ''}
                      onChange={(val) => set('bodyType', val)}
                      placeholder={isAr ? 'اختر…' : 'Select…'}
                      clearable
                      clearLabel={isAr ? 'غير محدد' : 'Not specified'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'نوع الوقود' : 'Fuel Type'}</label>
                    <SearchableCombobox
                      options={FUEL_TYPES}
                      value={form.fuelType ?? ''}
                      onChange={(val) => set('fuelType', val)}
                      placeholder={isAr ? 'اختر…' : 'Select…'}
                      clearable
                      clearLabel={isAr ? 'غير محدد' : 'Not specified'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'ناقل الحركة' : 'Transmission'}</label>
                    <SearchableCombobox
                      options={TRANSMISSIONS}
                      value={form.transmission ?? ''}
                      onChange={(val) => set('transmission', val)}
                      placeholder={isAr ? 'اختر…' : 'Select…'}
                      clearable
                      clearLabel={isAr ? 'غير محدد' : 'Not specified'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'اللون' : 'Color'}</label>
                    <input
                      className="input"
                      value={form.color ?? ''}
                      onChange={(e) => set('color', e.target.value)}
                      placeholder={isAr ? 'مثال: أبيض، أسود، فضي…' : 'e.g. White, Black, Silver…'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'حجم المحرك' : 'Engine Size'}</label>
                    <input
                      className="input"
                      value={form.engineSize ?? ''}
                      onChange={(e) => set('engineSize', e.target.value)}
                      placeholder={isAr ? 'مثال: 2.0L، 3.5L V6…' : 'e.g. 2.0L, 3.5L V6…'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'الإصدار' : 'Trim'}</label>
                    <input
                      className="input"
                      value={form.trim ?? ''}
                      onChange={(e) => set('trim', e.target.value)}
                      placeholder={isAr ? 'مثال: SE، Sport، Limited…' : 'e.g. SE, Sport, Limited…'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'المسافة المقطوعة (كم)' : 'Mileage (km)'}</label>
                    <NumericInput
                      className="input"
                      min="0"
                      value={form.mileage ?? ''}
                      onChange={(val) => set('mileage', Number(val))}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'عدد المقاعد' : 'Seats'}</label>
                    <NumericInput
                      className="input"
                      min="2"
                      max="9"
                      value={form.seats ?? ''}
                      onChange={(val) => set('seats', Number(val))}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'عدد الأبواب' : 'Doors'}</label>
                    <NumericInput
                      className="input"
                      min="2"
                      max="6"
                      value={form.doors ?? ''}
                      onChange={(val) => set('doors', Number(val))}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {([
                    [isAr ? 'الحالة' : 'Condition', v.condition],
                    [isAr ? 'نوع الهيكل' : 'Body Type', v.bodyType],
                    [isAr ? 'اللون' : 'Color', v.color],
                    [isAr ? 'نوع الوقود' : 'Fuel Type', v.fuelType],
                    [isAr ? 'ناقل الحركة' : 'Transmission', v.transmission],
                    [isAr ? 'المحرك' : 'Engine', v.engineSize],
                    [isAr ? 'الإصدار' : 'Trim', v.trim],
                    [isAr ? 'المسافة' : 'Mileage', v.mileage != null ? `${v.mileage.toLocaleString()} km` : undefined],
                    [isAr ? 'المقاعد' : 'Seats', v.seats],
                    [isAr ? 'الأبواب' : 'Doors', v.doors],
                    [isAr ? 'رقم الشاسيه' : 'VIN', v.vin],
                  ] as [string, string | number | undefined][])
                    .filter(([, val]) => val !== undefined && val !== null)
                    .map(([label, val]) => (
                      <div key={label}>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {label}
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, marginTop: '0.2rem' }}>
                          {String(val)}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: History ──────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div style={{ maxWidth: '800px' }}>
            <div className="card" style={{ overflow: 'hidden' }}>
              {auditEntries.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
                  {isAr ? 'لا يوجد سجل مراجعة لهذه السيارة.' : 'No audit history found for this vehicle.'}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'الإجراء' : 'Action'}</th>
                      <th>{isAr ? 'المستخدم' : 'User'}</th>
                      <th>{isAr ? 'التاريخ' : 'Date'}</th>
                      <th>{isAr ? 'التفاصيل' : 'Details'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <span className="badge badge-neutral">
                            {entry.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>
                          {entry.user?.name ?? (isAr ? 'النظام' : 'System')}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          {fmtDateTime(entry.createdAt, isAr, {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                          {entry.metadata ? JSON.stringify(entry.metadata).slice(0, 80) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Section Picker Modal ─────────────────────────────────────── */}
      {showSectionPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '1.75rem', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>
                {isAr ? 'ما الذي تريد تعديله؟' : 'What would you like to edit?'}
              </h2>
              <button onClick={() => setShowSectionPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {EDIT_SECTIONS.filter(s => !('usedOnly' in s && s.usedOnly) || ['USED', 'CERTIFIED'].includes(v.condition ?? '')).map(sec => (
                <button
                  key={sec.id}
                  onClick={() => openSection(sec.id)}
                  style={{
                    background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: '0.625rem',
                    padding: '1rem', textAlign: isAr ? 'right' : 'left', cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'; }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{sec.icon}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.2rem' }}>
                    {isAr ? sec.labelAr : sec.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {isAr ? sec.descAr : sec.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Section Edit Modal ────────────────────────────────────────── */}
      {editSection !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '0', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>
                {isAr
                  ? EDIT_SECTIONS.find(s => s.id === editSection)?.labelAr
                  : EDIT_SECTIONS.find(s => s.id === editSection)?.label}
              </h2>
              <button onClick={() => setEditSection(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}>✕</button>
            </div>
            {/* Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* ── BASIC INFO ── */}
              {editSection === 'basic' && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'اللون' : 'Color'}</label>
                    <input className="input" value={sf.color as string ?? ''} onChange={e => setSf(p => ({ ...p, color: e.target.value }))} placeholder={isAr ? 'اللون…' : 'Color…'} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'الإصدار' : 'Trim'}</label>
                    <input className="input" value={sf.trim as string ?? ''} onChange={e => setSf(p => ({ ...p, trim: e.target.value }))} placeholder="SE, Sport, Limited…" />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'المسافة المقطوعة (كم)' : 'Mileage (km)'}</label>
                    <NumericInput className="input" min="0" value={sf.mileage as string ?? ''} onChange={val => setSf(p => ({ ...p, mileage: val ? Number(val) : '' }))} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'الحالة' : 'Condition'}</label>
                    <SearchableCombobox options={CONDITIONS} value={sf.condition as string ?? ''} onChange={val => setSf(p => ({ ...p, condition: val }))} placeholder={isAr ? 'اختر…' : 'Select…'} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'نوع الهيكل' : 'Body Type'}</label>
                    <SearchableCombobox options={BODY_TYPES} value={sf.bodyType as string ?? ''} onChange={val => setSf(p => ({ ...p, bodyType: val }))} placeholder={isAr ? 'اختر…' : 'Select…'} clearable clearLabel={isAr ? 'غير محدد' : 'Not specified'} />
                  </div>
                </div>
                <div>
                  <label className="input-label">{isAr ? 'الوصف' : 'Description'}</label>
                  <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={sf.description as string ?? ''} onChange={e => setSf(p => ({ ...p, description: e.target.value }))} placeholder={isAr ? 'وصف السيارة…' : 'Vehicle description…'} />
                </div>
              </>}

              {/* ── SPECS ── */}
              {editSection === 'specs' && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'نوع الوقود' : 'Fuel Type'}</label>
                    <SearchableCombobox options={FUEL_TYPES} value={sf.fuelType as string ?? ''} onChange={val => setSf(p => ({ ...p, fuelType: val }))} placeholder={isAr ? 'اختر…' : 'Select…'} clearable clearLabel={isAr ? 'غير محدد' : 'Not specified'} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'ناقل الحركة' : 'Transmission'}</label>
                    <SearchableCombobox options={TRANSMISSIONS} value={sf.transmission as string ?? ''} onChange={val => setSf(p => ({ ...p, transmission: val }))} placeholder={isAr ? 'اختر…' : 'Select…'} clearable clearLabel={isAr ? 'غير محدد' : 'Not specified'} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'حجم المحرك' : 'Engine Size'}</label>
                    <input className="input" value={sf.engineSize as string ?? ''} onChange={e => setSf(p => ({ ...p, engineSize: e.target.value }))} placeholder="2.0L, 3.5L V6…" />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'نوع الدفع' : 'Drive Type'}</label>
                    <SearchableCombobox
                      options={[{ value: 'FWD', label: 'FWD' }, { value: 'RWD', label: 'RWD' }, { value: '4WD', label: '4WD' }, { value: 'AWD', label: 'AWD' }]}
                      value={sf.driveType as string ?? ''} onChange={val => setSf(p => ({ ...p, driveType: val }))} placeholder={isAr ? 'اختر…' : 'Select…'} clearable clearLabel={isAr ? 'غير محدد' : 'Not specified'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'عدد المقاعد' : 'Seats'}</label>
                    <NumericInput className="input" min="2" max="9" value={sf.seats as string ?? ''} onChange={val => setSf(p => ({ ...p, seats: val ? Number(val) : '' }))} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'عدد الأبواب' : 'Doors'}</label>
                    <NumericInput className="input" min="2" max="6" value={sf.doors as string ?? ''} onChange={val => setSf(p => ({ ...p, doors: val ? Number(val) : '' }))} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'قوة المحرك (HP)' : 'Horsepower (HP)'}</label>
                    <NumericInput className="input" min="0" value={sf.hp as string ?? ''} onChange={val => setSf(p => ({ ...p, hp: val ? Number(val) : '' }))} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'عزم الدوران (Nm)' : 'Torque (Nm)'}</label>
                    <NumericInput className="input" min="0" value={sf.torque as string ?? ''} onChange={val => setSf(p => ({ ...p, torque: val ? Number(val) : '' }))} />
                  </div>
                </div>
                <div>
                  <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>{isAr ? 'المميزات' : 'Features'}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                    {FEATURES_LIST.map(feat => {
                      const checked = (sf.features as string[] ?? []).includes(feat);
                      return (
                        <label key={feat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.375rem 0.5rem', borderRadius: '0.375rem', background: checked ? 'var(--primary-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={checked} onChange={e => {
                            const cur = sf.features as string[] ?? [];
                            setSf(p => ({ ...p, features: e.target.checked ? [...cur, feat] : cur.filter(f => f !== feat) }));
                          }} />
                          {feat}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>}

              {/* ── PRICING ── */}
              {editSection === 'pricing' && <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'سعر البيع المدرج (ج.م)' : 'Listed Sale Price (EGP)'}</label>
                    <NumericInput className="input" min="0" value={sf.price as string ?? ''} onChange={val => setSf(p => ({ ...p, price: val }))} />
                  </div>
                  {canViewField('Vehicle', 'cost') && (
                    <div>
                      <label className="input-label">{isAr ? 'تكلفة الاستحواذ (ج.م)' : 'Acquisition Cost (EGP)'}</label>
                      <NumericInput className="input" min="0" value={sf.cost as string ?? ''} onChange={val => setSf(p => ({ ...p, cost: val }))} disabled={!canWriteField('Vehicle', 'cost')} />
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'السعر الزائد / Overprice (ج.م)' : 'Overprice (EGP)'}</label>
                      <NumericInput className="input" min="0" value={sf.overprice as string ?? ''} onChange={val => setSf(p => ({ ...p, overprice: val }))} placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'هامش الربح / Our Profit (ج.م)' : 'Our Profit (EGP)'}</label>
                      <NumericInput className="input" min="0" value={sf.ourProfit as string ?? ''} onChange={val => setSf(p => ({ ...p, ourProfit: val }))} placeholder="0" />
                    </div>
                  </div>
                  {canViewField('Vehicle', 'adminFeeOverride') && (
                    <div>
                      <label className="input-label">{isAr ? 'تجاوز رسوم الإدارة (ج.م)' : 'Admin Fee Override (EGP)'}</label>
                      <NumericInput className="input" min="0" value={sf.adminFeeOverride as string ?? ''} onChange={val => setSf(p => ({ ...p, adminFeeOverride: val }))} placeholder={isAr ? 'فارغ = افتراضي الفرع' : 'Blank = location default'} />
                    </div>
                  )}
                  {canViewField('Vehicle', 'insuranceFeeOverride') && (
                    <div>
                      <label className="input-label">{isAr ? 'تجاوز رسوم التأمين (ج.م)' : 'Insurance Override (EGP)'}</label>
                      <NumericInput className="input" min="0" value={sf.insuranceFeeOverride as string ?? ''} onChange={val => setSf(p => ({ ...p, insuranceFeeOverride: val }))} placeholder={isAr ? 'فارغ = افتراضي الفرع' : 'Blank = location default'} />
                    </div>
                  )}
                  <div>
                    <label className="input-label">{isAr ? 'ملاحظة تغيير السعر' : 'Price Change Note'}</label>
                    <input className="input" value={sf.priceNote as string ?? ''} onChange={e => setSf(p => ({ ...p, priceNote: e.target.value }))} placeholder={isAr ? 'سبب تغيير السعر (اختياري)…' : 'Reason for price change (optional)…'} />
                  </div>
                </div>
              </>}

              {/* ── USED VEHICLE DETAILS ── */}
              {editSection === 'used' && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'رقم رخصة التسجيل' : 'Registration License №'}</label>
                    <input className="input" value={sf.regLicenseNumber as string ?? ''} onChange={e => setSf(p => ({ ...p, regLicenseNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'تاريخ انتهاء الرخصة' : 'License Expiry Date'}</label>
                    <input type="date" className="input" value={sf.licenseExpiryDate as string ?? ''} onChange={e => setSf(p => ({ ...p, licenseExpiryDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'نسبة حالة المحرك (%)' : 'Engine Condition %'}</label>
                    <NumericInput className="input" min="0" max="100" value={sf.engineConditionPct as string ?? ''} onChange={val => setSf(p => ({ ...p, engineConditionPct: val ? Number(val) : '' }))} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'نسبة حالة ناقل الحركة (%)' : 'Transmission Condition %'}</label>
                    <NumericInput className="input" min="0" max="100" value={sf.transmissionConditionPct as string ?? ''} onChange={val => setSf(p => ({ ...p, transmissionConditionPct: val ? Number(val) : '' }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={!!sf.engineChanged} onChange={e => setSf(p => ({ ...p, engineChanged: e.target.checked }))} />
                    {isAr ? 'تم استبدال المحرك' : 'Engine Replaced'}
                  </label>
                  {!!sf.engineChanged && (
                    <div>
                      <label className="input-label">{isAr ? 'رقم المحرك الجديد' : 'New Engine Number'}</label>
                      <input className="input" value={sf.newEngineNumber as string ?? ''} onChange={e => setSf(p => ({ ...p, newEngineNumber: e.target.value }))} />
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={!!sf.accidentHistory} onChange={e => setSf(p => ({ ...p, accidentHistory: e.target.checked }))} />
                    {isAr ? 'تاريخ حوادث' : 'Accident History'}
                  </label>
                  {!!sf.accidentHistory && (
                    <div>
                      <label className="input-label">{isAr ? 'الأجزاء المتضررة' : 'Affected Parts'}</label>
                      <input className="input" value={sf.affectedParts as string ?? ''} onChange={e => setSf(p => ({ ...p, affectedParts: e.target.value }))} placeholder={isAr ? 'مثال: باب أمامي، غطاء المحرك…' : 'e.g. Front door, hood…'} />
                    </div>
                  )}
                </div>
              </>}

              {/* ── STATUS & LOCATION ── */}
              {editSection === 'status' && <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'الحالة' : 'Status'}</label>
                    <SearchableCombobox options={STATUSES} value={sf.status as string ?? ''} onChange={val => setSf(p => ({ ...p, status: val }))} placeholder={isAr ? 'اختر الحالة…' : 'Select status…'} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'الفرع' : 'Branch / Location'}</label>
                    <SearchableCombobox
                      options={locations.map(l => ({ value: l.id, label: l.city ? `${l.name} — ${l.city}` : l.name }))}
                      value={sf.locationId as string ?? ''}
                      onChange={val => setSf(p => ({ ...p, locationId: val }))}
                      placeholder={isAr ? 'اختر الفرع…' : 'Select branch…'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'الوكيل المعتمد' : 'Accredited Dealer'}</label>
                    <SearchableCombobox
                      options={[{ value: '', label: isAr ? '— بدون وكيل —' : '— No dealer —' }, ...dealers.map(d => ({ value: d.id, label: d.name }))]}
                      value={sf.accreditedDealerId as string ?? ''}
                      onChange={val => setSf(p => ({ ...p, accreditedDealerId: val }))}
                      placeholder={isAr ? 'اختر الوكيل…' : 'Select dealer…'}
                    />
                  </div>
                </div>
              </>}

              {sfErr && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--danger-fg)', background: 'var(--danger-bg)', padding: '0.625rem 0.875rem', borderRadius: '0.375rem' }}>
                  {sfErr}
                </p>
              )}
            </div>
            {/* Footer */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => { setEditSection(null); setShowSectionPicker(true); }} disabled={sfSaving}>
                {isAr ? 'رجوع' : 'Back'}
              </button>
              <button className="btn btn-primary" onClick={saveSection} disabled={sfSaving}>
                {sfSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Price History Modal ───────────────────────────────────────── */}
      {showPriceHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '0', width: '100%', maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
                  {isAr ? 'سجل تغيرات السعر' : 'Price Change History'}
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
                  {v.year} {v.make} {v.model}
                </p>
              </div>
              <button onClick={() => setShowPriceHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flexGrow: 1 }}>
              {phLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.875rem' }}>
                  {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                </div>
              ) : priceHistory.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.875rem' }}>
                  {isAr ? 'لا يوجد سجل تغيرات للسعر.' : 'No price changes recorded yet.'}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'التاريخ' : 'Date'}</th>
                      <th>{isAr ? 'السعر القديم' : 'Old Price'}</th>
                      <th>{isAr ? 'السعر الجديد' : 'New Price'}</th>
                      <th>{isAr ? 'بواسطة / ملاحظة' : 'By / Note'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.map(entry => {
                      const delta = entry.newPrice - entry.oldPrice;
                      return (
                        <tr key={entry.id}>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {fmtDateTime(entry.changedAt, isAr, { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{fmt(entry.oldPrice)}</td>
                          <td style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                            <span style={{ color: delta >= 0 ? 'var(--danger-fg)' : 'var(--success-fg)' }}>
                              {fmt(entry.newPrice)}
                            </span>
                            <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem', color: delta >= 0 ? 'var(--danger-fg)' : 'var(--success-fg)' }}>
                              ({delta >= 0 ? '+' : ''}{fmt(delta)})
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                            {[entry.changedByName, entry.note].filter(Boolean).join(' · ') || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border)', flexShrink: 0, textAlign: 'right' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPriceHistory(false)}>
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ────────────────────────────────── */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" style={{ padding: '2rem', maxWidth: '420px', width: '90%' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.5rem' }}>
              {isAr ? 'حذف السيارة؟' : 'Delete Vehicle?'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
              {isAr ? 'سيتم حذف' : 'This will permanently delete'}{' '}
              <strong style={{ color: 'var(--text-1)' }}>
                {v.year} {v.make} {v.model}
              </strong>.
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--danger-fg)', marginBottom: '1.5rem' }}>
              {isAr ? 'لا يمكن التراجع عن هذا الإجراء. لا يمكن حذف السيارات المرتبطة بصفقات.' : 'This action cannot be undone. Vehicles with associated deals cannot be deleted.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="btn btn-danger"
                onClick={deleteVehicle}
                disabled={deleting}
              >
                {deleting ? (isAr ? 'جارٍ الحذف…' : 'Deleting…') : (isAr ? 'حذف السيارة' : 'Delete Vehicle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
