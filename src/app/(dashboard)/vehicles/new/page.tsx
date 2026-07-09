'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import ScannerModal, { VIN_FORMATS } from '../../../../components/ScannerModal';
import { useLang } from '@/lib/lang-context';
import { API_BASE } from '@/lib/config';

interface Location {
  id: string;
  name: string;
  city?: string;
  defaultAdminFee?: number;
  defaultInsuranceFee?: number;
}

const YEARS = Array.from({ length: 17 }, (_, i) => {
  const y = 2026 - i;
  return { value: String(y), label: String(y) };
});

const FEATURES_LIST = [
  'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera',
  'Blind Spot Monitor', 'Lane Departure Warning', 'Sunroof', 'Heated Seats',
  'Keyless Entry', 'Push Start', 'Navigation', 'Parking Sensors',
];

const STEPS_NEW = [
  { n: 1, label: 'Basic Info' },
  { n: 2, label: 'Specs & Features' },
  { n: 3, label: 'Pricing & Location' },
  { n: 4, label: 'Upload Photos' },
  { n: 5, label: 'Documents' },
  { n: 6, label: 'Review & Publish' },
];

const STEPS_USED = [
  { n: 1, label: 'Basic Info' },
  { n: 2, label: 'Used Vehicle Details' },
  { n: 3, label: 'Specs & Features' },
  { n: 4, label: 'Pricing & Location' },
  { n: 5, label: 'Upload Photos' },
  { n: 6, label: 'Documents' },
  { n: 7, label: 'Review & Publish' },
];

const DOC_SLOTS_BASE: { key: string; label: string; required: boolean }[] = [
  { key: 'vehicle_title', label: 'Vehicle Title / Ownership Certificate', required: true },
  { key: 'inspection_report', label: 'Inspection Report', required: false },
  { key: 'import_customs', label: 'Import Customs Certificate', required: false },
  { key: 'prev_registration', label: 'Previous Registration', required: false },
];

const DOC_LABELS_AR: Record<string, string> = {
  'Vehicle Title / Ownership Certificate': 'عقد الملكية / شهادة الملكية',
  'Inspection Report': 'تقرير المعاينة',
  'Import Customs Certificate': 'شهادة الجمارك',
  'Previous Registration': 'التسجيل السابق',
};

const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

function initForm() {
  return {
    vin: '', make: '', model: '', year: '2025', trim: '', mileage: '', color: '',
    bodyType: '', condition: '' as '' | 'NEW' | 'USED',
    engineType: '', transmission: '', fuelType: '', doors: '', seats: '',
    hp: '', torque: '', driveType: '', gearType: '',
    features: [] as string[],
    acquisitionCost: '', salePrice: '', adminFeeOverride: '', insuranceFeeOverride: '',
    locationId: '', status: 'AVAILABLE',
    accreditedDealerId: '',
  };
}

function initUsedForm() {
  return {
    regLicenseNumber: '',
    licenseExpiryDate: '',
    accidentHistory: '',
    affectedParts: '',
    engineChanged: false,
    newEngineNumber: '',
    customerAskingPrice: '',
    minimumAskingPrice: '',
    overprice: '',
    engineConditionPct: '',
    transmissionConditionPct: '',
  };
}

function monthsFromNow(dateStr: string): number | null {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const now = new Date();
  const ms = expiry.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / (1000 * 60 * 60 * 24 * 30.44));
}

export default function NewVehiclePage() {
  const router = useRouter();
  const { isAr } = useLang();

  const INITIAL_STATUSES = [
    { value: 'AVAILABLE', label: isAr ? 'متوفر' : 'Available' },
    { value: 'IN_TRANSIT', label: isAr ? 'في الطريق' : 'In Transit' },
    { value: 'PENDING_INSPECTION', label: isAr ? 'قيد الفحص' : 'Pending Inspection' },
  ];

  const FEATURES_AR: Record<string, string> = {
    'Cruise Control': 'مثبت السرعة',
    'Apple CarPlay': 'Apple CarPlay',
    'Android Auto': 'Android Auto',
    'Reverse Camera': 'كاميرا خلفية',
    'Blind Spot Monitor': 'مراقب النقطة العمياء',
    'Lane Departure Warning': 'تحذير مغادرة المسار',
    'Sunroof': 'فتحة سقف',
    'Heated Seats': 'مقاعد مدفأة',
    'Keyless Entry': 'دخول بدون مفتاح',
    'Push Start': 'تشغيل بلمسة',
    'Navigation': 'نظام ملاحة',
    'Parking Sensors': 'حساسات ركن',
  };

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initForm());
  const [usedForm, setUsedForm] = useState(initUsedForm());
  const [saving, setSaving] = useState(false);
  const [showVinScanner, setShowVinScanner] = useState(false);
  const [err, setErr] = useState('');
  const [photoInput, setPhotoInput] = useState('');
  const [photos, setPhotos] = useState<Array<{ src: string; file?: File }>>([]);
  const [dragOver, setDragOver] = useState(false);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Record<string, File>>({});
  const [dealers, setDealers] = useState<{id:string;name:string}[]>([]);

  useEffect(() => {
    apiFetch<{id:string;name:string}[]>('/accredited-dealers').then(setDealers).catch(() => {});
  }, []);

  const STEP_LABELS_AR: Record<string, string> = {
    'Basic Info': 'المعلومات الأساسية',
    'Used Vehicle Details': 'تفاصيل السيارة المستعملة',
    'Specs & Features': 'المواصفات والمميزات',
    'Pricing & Location': 'التسعير',
    'Upload Photos': 'الصور',
    'Documents': 'المستندات',
    'Review & Publish': 'مراجعة ونشر',
  };
  const sl = (label: string) => isAr ? (STEP_LABELS_AR[label] ?? label) : label;

  const { data: locationsRaw } = useQuery<Location[]>('/locations');
  const locations: Location[] = Array.isArray(locationsRaw) ? locationsRaw : [];
  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name + (l.city ? ` — ${l.city}` : ''),
  }));
  const selectedLocation = locations.find((l) => l.id === form.locationId);

  type LI = { id: string; value: string; label: string };
  const { data: rawMakes }         = useQuery<LI[]>('/lookup-items?category=car_make');
  const { data: rawColors }        = useQuery<LI[]>('/lookup-items?category=car_color');
  const { data: rawBodyTypes }     = useQuery<LI[]>('/lookup-items?category=body_type');
  const { data: rawFuelTypes }     = useQuery<LI[]>('/lookup-items?category=fuel_type');
  const { data: rawTransmissions } = useQuery<LI[]>('/lookup-items?category=transmission');
  const { data: rawGearTypes }     = useQuery<LI[]>('/lookup-items?category=gear_type');
  const toOpts = (r: LI[] | null | undefined) => (Array.isArray(r) ? r : []).map((i) => ({ value: i.value, label: i.label }));
  const MAKES         = toOpts(rawMakes);
  const COLORS        = toOpts(rawColors);
  const BODY_TYPES    = toOpts(rawBodyTypes);
  const FUEL_TYPES    = toOpts(rawFuelTypes);
  const TRANSMISSIONS = toOpts(rawTransmissions);
  const GEAR_TYPES    = toOpts(rawGearTypes);

  const isUsed   = form.condition === 'USED';
  const STEPS    = isUsed ? STEPS_USED : STEPS_NEW;
  const totalSteps = STEPS.length;

  // Step content flags — maps logical content to step number per condition
  const isBasicInfo     = step === 1;
  const isUsedDetails   = isUsed && step === 2;
  const isSpecsFeatures = (isUsed && step === 3) || (!isUsed && step === 2);
  const isPricing       = (isUsed && step === 4) || (!isUsed && step === 3);
  const isPhotos        = (isUsed && step === 5) || (!isUsed && step === 4);
  const isDocs          = (isUsed && step === 6) || (!isUsed && step === 5);
  const isReview        = (isUsed && step === 7) || (!isUsed && step === 6);

  const cost      = Number(form.acquisitionCost) || 0;
  const price     = Number(form.salePrice) || 0;
  const margin    = price > 0 && cost > 0 ? price - cost : 0;
  const marginPct = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : 0;
  const overprice = Number(usedForm.overprice) || 0;
  const months    = monthsFromNow(usedForm.licenseExpiryDate);

  function set(k: string, v: string | string[] | boolean) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function setU(k: string, v: string | boolean) {
    setUsedForm((p) => ({ ...p, [k]: v }));
  }

  function addPhotoFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const entries = arr.map((f) => ({ src: URL.createObjectURL(f), file: f }));
    setPhotos((p) => [...p, ...entries]);
  }

  function removePhoto(i: number) {
    setPhotos((p) => {
      const copy = [...p];
      const removed = copy.splice(i, 1)[0];
      if (removed.file) URL.revokeObjectURL(removed.src);
      return copy;
    });
  }

  function setPrimaryPhoto(i: number) {
    setPhotos((p) => {
      const copy = [...p];
      const [removed] = copy.splice(i, 1);
      return [removed, ...copy];
    });
  }

  function toggleFeature(f: string) {
    setForm((p) => ({
      ...p,
      features: p.features.includes(f) ? p.features.filter((x) => x !== f) : [...p.features, f],
    }));
  }

  function validateStep(s: number): string {
    if (s === 1) {
      if (isUsed) {
        if (form.vin && form.vin.length !== 17) return isAr ? 'رقم الشاسيه يجب أن يكون 17 حرفاً بالضبط (أو اتركه فارغاً).' : 'VIN must be exactly 17 characters (or leave blank).';
      } else {
        if (!form.vin || form.vin.length !== 17) return isAr ? 'رقم الشاسيه يجب أن يكون 17 حرفاً بالضبط.' : 'VIN must be exactly 17 characters.';
      }
      if (!form.make) return isAr ? 'الماركة مطلوبة.' : 'Make is required.';
      if (!form.model) return isAr ? 'الموديل مطلوب.' : 'Model is required.';
      if (!form.color) return isAr ? 'اللون مطلوب.' : 'Color is required.';
      if (!form.bodyType) return isAr ? 'نوع الهيكل مطلوب.' : 'Body Type is required.';
    }
    if (isUsed && s === 2) {
      if (!usedForm.regLicenseNumber) return isAr ? 'رقم رخصة التسجيل مطلوب.' : 'Registration license number is required.';
      if (!usedForm.licenseExpiryDate) return isAr ? 'تاريخ انتهاء الرخصة مطلوب.' : 'License expiry date is required.';
    }
    const pricingStep = isUsed ? 4 : 3;
    if (s === pricingStep) {
      if (!form.salePrice || Number(form.salePrice) <= 0) return isAr ? 'سعر البيع المدرج مطلوب.' : 'Listed Sale Price is required.';
      if (!form.locationId) return isAr ? 'تعيين الفرع مطلوب.' : 'Location assignment is required.';
    }
    return '';
  }

  // ponytail: programmatic file picker avoids hidden input per slot
  function pickDoc(slotKey: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) setDocs((prev) => ({ ...prev, [slotKey]: file }));
    };
    input.click();
  }

  function next() {
    const e = validateStep(step);
    if (e) { setErr(e); return; }
    setErr('');
    // For used cars entering the pricing step: pre-fill from Used Vehicle Details
    if (isUsed && step === 3) {
      setForm((p) => {
        const acq = p.acquisitionCost || usedForm.customerAskingPrice;
        const computedSale = acq && usedForm.overprice
          ? String(Number(acq) + Number(usedForm.overprice))
          : acq || '';
        const sale = p.salePrice || computedSale;
        return { ...p, acquisitionCost: acq, salePrice: sale };
      });
    }
    setStep((s) => s + 1);
  }

  function back() {
    setErr('');
    setStep((s) => s - 1);
  }

  async function publish() {
    setSaving(true);
    setErr('');
    try {
      const body: Record<string, unknown> = {
        vin: form.vin || undefined,
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
        ...(form.hp && { hp: Number(form.hp) }),
        ...(form.torque && { torque: Number(form.torque) }),
        ...(form.driveType && { driveType: form.driveType }),
        ...(form.gearType && { gearType: form.gearType }),
        ...(form.transmission && { transmission: form.transmission }),
        ...(form.fuelType && { fuelType: form.fuelType }),
        ...(form.doors && { doors: Number(form.doors) }),
        ...(form.seats && { seats: Number(form.seats) }),
        ...(form.acquisitionCost && { cost: Number(form.acquisitionCost) }),
        ...(form.adminFeeOverride && { adminFeeOverride: Number(form.adminFeeOverride) }),
        ...(form.insuranceFeeOverride && { insuranceFeeOverride: Number(form.insuranceFeeOverride) }),
        ...(form.features.length && { features: form.features }),
        ...(form.accreditedDealerId && { accreditedDealerId: form.accreditedDealerId }),
        ...(isUsed && {
          regLicenseNumber: usedForm.regLicenseNumber,
          licenseExpiryDate: usedForm.licenseExpiryDate,
          accidentHistory: usedForm.accidentHistory,
          affectedParts: usedForm.affectedParts || undefined,
          engineChanged: usedForm.engineChanged,
          engineConditionPct: usedForm.engineConditionPct ? Number(usedForm.engineConditionPct) : undefined,
          transmissionConditionPct: usedForm.transmissionConditionPct ? Number(usedForm.transmissionConditionPct) : undefined,
          newEngineNumber: usedForm.newEngineNumber || undefined,
          customerAskingPrice: usedForm.customerAskingPrice ? Number(usedForm.customerAskingPrice) : undefined,
          minimumAskingPrice: usedForm.minimumAskingPrice ? Number(usedForm.minimumAskingPrice) : undefined,
          overprice: usedForm.overprice ? Number(usedForm.overprice) : undefined,
        }),
      };
      const v = await apiFetch<{ id: string }>('/vehicles', { method: 'POST', body: JSON.stringify(body) });
      const token = typeof window !== 'undefined' ? (localStorage.getItem('accessToken') ?? '') : '';
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        let url = p.src;
        if (p.file) {
          const fd = new FormData();
          fd.append('file', p.file);
          const res = await fetch(`${API_BASE}/upload/file`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          }).catch(() => null);
          if (res?.ok) {
            const data = await res.json().catch(() => null);
            url = data?.url ?? url;
          }
        }
        await apiFetch(`/vehicles/${v.id}/images`, {
          method: 'POST',
          body: JSON.stringify({ url, order: i }),
        }).catch(() => {});
      }
      router.push(`/vehicles/${v.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  /* ─── Condition pre-selector ──────────────────────────────────────────── */
  if (!form.condition) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Link href="/vehicles" style={{ color: 'var(--text-3)', fontSize: '0.75rem', textDecoration: 'none' }}>{isAr ? 'السيارات' : 'Vehicles'}</Link>
              <span style={{ color: 'var(--text-3)' }}>/</span>
              <span style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{isAr ? 'إضافة مركبة' : 'Add Vehicle'}</span>
            </div>
            <h1 className="page-title">{isAr ? 'إضافة مركبة جديدة' : 'Add New Vehicle'}</h1>
            <p className="page-subtitle">{isAr ? 'ابدأ باختيار حالة السيارة' : 'Start by selecting the vehicle condition'}</p>
          </div>
        </div>
        <div className="page-body">
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div className="card" style={{ padding: '2rem' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.25rem' }}>
                {isAr ? 'ما نوع السيارة التي تضيفها؟' : 'What type of vehicle are you adding?'}
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}>
                {isAr ? 'يحدد هذا الوثائق المطلوبة وحقول التسعير.' : 'This determines the required documentation and pricing fields.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <ConditionCard
                  color="var(--primary)"
                  icon={<CarNewIcon />}
                  title={isAr ? 'مركبة جديدة' : 'New Vehicle'}
                  desc={isAr ? 'جديدة تماماً، لم تسجل من قبل' : 'Brand new, never registered'}
                  onClick={() => set('condition', 'NEW')}
                  hoverBorder="var(--primary)"
                  hoverBg="var(--info-bg)"
                />
                <ConditionCard
                  color="var(--warning)"
                  icon={<CarUsedIcon />}
                  title={isAr ? 'مركبة مستعملة' : 'Used Vehicle'}
                  desc={isAr ? 'مركبة مستعملة مع سجل' : 'Pre-owned vehicle with history'}
                  onClick={() => set('condition', 'USED')}
                  hoverBorder="var(--warning)"
                  hoverBg="var(--warning-bg)"
                />
              </div>
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <Link href="/vehicles" className="btn btn-secondary">{isAr ? 'إلغاء' : 'Cancel'}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Wizard ──────────────────────────────────────────────────────────── */
  const conditionBadge = isUsed
    ? <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff', background: 'var(--warning)', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', letterSpacing: '0.03em' }}>{isAr ? 'مستعملة' : 'USED'}</span>
    : <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff', background: 'var(--primary)', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', letterSpacing: '0.03em' }}>{isAr ? 'جديدة' : 'NEW'}</span>;

  return (
    <>
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href="/vehicles" style={{ color: 'var(--text-3)', fontSize: '0.75rem', textDecoration: 'none' }}>{isAr ? 'السيارات' : 'Vehicles'}</Link>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{isAr ? 'إضافة مركبة' : 'Add Vehicle'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <h1 className="page-title">{isAr ? 'إضافة مركبة جديدة' : 'Add New Vehicle'}</h1>
            {conditionBadge}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <p className="page-subtitle" style={{ margin: 0 }}>{isAr ? 'أكمل جميع الخطوات لإضافة مركبة للمخزون' : 'Complete all steps to add a vehicle to inventory'}</p>
            <button
              type="button"
              onClick={() => { set('condition', ''); setStep(1); setErr(''); }}
              style={{ fontSize: '0.75rem', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              {isAr ? 'تغيير الحالة' : 'Change condition'}
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Step indicator */}
        <div style={{ display: 'flex', marginBottom: '1.5rem', overflowX: 'auto' }}>
          {STEPS.map((s) => (
            <div key={s.n} className={`step-item${step > s.n ? ' done' : ''}`}>
              <div className={`step-circle${step === s.n ? ' active' : step > s.n ? ' done' : ''}`}>
                {step > s.n ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : s.n}
              </div>
              <span className={`step-label${step === s.n ? ' active' : ''}`}>{sl(s.label)}</span>
            </div>
          ))}
        </div>

        {err && (
          <div style={{
            padding: '0.75rem 1rem', borderRadius: '0.5rem',
            background: 'var(--danger-bg)', border: '1px solid var(--danger)',
            color: 'var(--danger-fg)', fontSize: '0.8125rem', marginBottom: '1rem',
          }}>
            {err}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem', alignItems: 'start' }}>

          {/* ── Main content ───────────────────────────────────────── */}
          <div>

            {/* STEP 1 — Basic Info */}
            {isBasicInfo && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{
                  display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem',
                  borderRadius: '0.5rem', background: 'var(--info-bg)', border: '1px solid var(--info)',
                  marginBottom: '1.5rem',
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--info)', flexShrink: 0, marginTop: '1px' }}>
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M8 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="8" cy="5" r="0.6" fill="currentColor"/>
                  </svg>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--info-fg)' }}>
                    <strong>{isAr ? 'فك تشفير VIN تلقائياً' : 'VIN Auto-Decode'}</strong>
                    {isAr
                      ? ' — أدخل رقم الشاسيه وسيقوم النظام تلقائياً بتعبئة الشركة المصنعة والطراز والمواصفات.'
                      : ' — Enter the VIN and the system will auto-fill make, model, and specs.'}
                    {isUsed && <span style={{ color: 'var(--text-3)' }}>{isAr ? ' رقم الشاسيه اختياري للمركبات المستعملة.' : ' VIN is optional for used vehicles.'}</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="input-label">{isAr ? 'الوكيل المعتمد' : 'Accredited Dealer'}</label>
                    <SearchableCombobox
                      options={[
                        { value: '', label: isAr ? '— بدون وكيل —' : '— No dealer —' },
                        ...dealers.map(d => ({ value: d.id, label: d.name }))
                      ]}
                      value={form.accreditedDealerId ?? ''}
                      onChange={v => setForm(f => ({ ...f, accreditedDealerId: v }))}
                      placeholder={isAr ? 'اختر الوكيل…' : 'Select dealer…'}
                      className="w-full"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="input-label">
                      {isAr ? 'رقم الشاسيه' : 'VIN Number'}{' '}
                      {!isUsed
                        ? <span style={{ color: 'var(--danger)' }}>*</span>
                        : <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{isAr ? '(اختياري)' : '(optional)'}</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        className="input"
                        value={form.vin}
                        onChange={(e) => set('vin', e.target.value.toUpperCase().slice(0, 17))}
                        placeholder={isAr ? '17 حرف' : '17-character VIN'}
                        maxLength={17}
                        style={{ fontFamily: 'monospace', letterSpacing: '0.05em', flex: 1 }}
                      />
                      <button
                        type="button"
                        title={isAr ? 'مسح باركود VIN بالكاميرا' : 'Scan VIN barcode with camera'}
                        onClick={() => setShowVinScanner(true)}
                        style={{
                          flexShrink: 0, padding: '0 0.875rem', height: 38,
                          borderRadius: 8, border: '1px solid var(--border)',
                          background: 'var(--surface-2)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.375rem',
                          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap',
                        }}
                      >
                        <CameraIcon /> {isAr ? 'مسح VIN' : 'Scan VIN'}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.6875rem', color: form.vin.length === 17 ? 'var(--success-fg)' : 'var(--text-3)', marginTop: '0.25rem' }}>
                      {form.vin.length}/17 {isAr ? 'حرف' : 'characters'}{isUsed && form.vin.length === 0 ? (isAr ? ' — اتركه فارغاً إن لم يتوفر' : ' — leave blank if unavailable') : ''}
                    </p>
                  </div>

                  <div>
                    <label className="input-label">{isAr ? 'الشركة المصنعة' : 'Make'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableCombobox options={MAKES} value={form.make} onChange={(v) => set('make', v)} placeholder={isAr ? 'اختر الشركة…' : 'Select make…'} />
                  </div>

                  <div>
                    <label className="input-label">{isAr ? 'الطراز' : 'Model'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input className="input" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder={isAr ? 'مثال: كورولا، توسان…' : 'e.g. Corolla, Tucson…'} />
                  </div>

                  <div>
                    <label className="input-label">{isAr ? 'سنة الصنع' : 'Year'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableCombobox options={YEARS} value={form.year} onChange={(v) => set('year', v)} placeholder={isAr ? 'اختر السنة…' : 'Select year…'} />
                  </div>

                  <div>
                    <label className="input-label">{isAr ? 'الفئة / المتغير' : 'Trim / Variant'}</label>
                    <input className="input" value={form.trim} onChange={(e) => set('trim', e.target.value)} placeholder={isAr ? 'مثال: SE، Sport، Limited…' : 'e.g. SE, Sport, Limited…'} />
                  </div>

                  <div>
                    <label className="input-label">
                      {isAr ? 'عداد الكيلومترات' : 'Mileage (km)'}{isUsed && <span style={{ color: 'var(--danger)' }}> *</span>}
                    </label>
                    <input
                      className="input" type="number" min="0"
                      value={form.mileage} onChange={(e) => set('mileage', e.target.value)}
                      placeholder={isUsed ? (isAr ? 'أدخل قراءة العداد' : 'Enter odometer reading') : (isAr ? '0 للمركبات الجديدة' : '0 for new vehicles')}
                    />
                  </div>

                  <div>
                    <label className="input-label">{isAr ? 'اللون' : 'Color'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableCombobox options={COLORS} value={form.color} onChange={(v) => set('color', v)} placeholder={isAr ? 'اختر اللون…' : 'Select color…'} />
                  </div>

                  <div>
                    <label className="input-label">{isAr ? 'نوع الهيكل' : 'Body Type'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableCombobox options={BODY_TYPES} value={form.bodyType} onChange={(v) => set('bodyType', v)} placeholder={isAr ? 'اختر نوع الهيكل…' : 'Select body type…'} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 (USED) — Used Vehicle Details */}
            {isUsedDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Registration */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'التسجيل والرخصة' : 'Registration Details'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">{isAr ? 'رقم رخصة التسجيل' : 'Registration License Number'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        className="input"
                        value={usedForm.regLicenseNumber}
                        onChange={(e) => setU('regLicenseNumber', e.target.value)}
                        placeholder="e.g. أ ب ج 1234 / ABC-1234"
                      />
                    </div>

                    <div>
                      <label className="input-label">{isAr ? 'تاريخ انتهاء الرخصة' : 'License Expiry Date'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        className="input" type="date"
                        value={usedForm.licenseExpiryDate}
                        onChange={(e) => setU('licenseExpiryDate', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="input-label">{isAr ? 'الأشهر المتبقية على التسجيل' : 'Months Remaining on Registration'}</label>
                      <div style={{
                        padding: '0 0.75rem', height: 38, borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface-2)',
                        display: 'flex', alignItems: 'center', fontSize: '0.875rem',
                        color: months !== null ? (months === 0 ? 'var(--danger-fg)' : months < 3 ? 'var(--warning-fg)' : 'var(--success-fg)') : 'var(--text-3)',
                        fontWeight: months !== null ? 600 : 400,
                      }}>
                        {months === null
                          ? (isAr ? 'أدخل تاريخ الانتهاء أعلاه' : 'Enter expiry date above')
                          : months === 0 ? (isAr ? 'منتهية!' : 'Expired!')
                          : isAr ? `${months} أشهر متبقية` : `${months} month${months !== 1 ? 's' : ''}`}
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <DocUploadRow label={isAr ? 'نسخة بطاقة التسجيل' : 'Car Registration ID Copy'} required file={docs['car_registration']} onPick={() => pickDoc('car_registration')} />
                      <DocUploadRow label={isAr ? 'توكيل رسمي' : 'Power of Attorney'} required={false} file={docs['power_of_attorney']} onPick={() => pickDoc('power_of_attorney')} />
                    </div>
                  </div>
                </div>

                {/* Accident / Paint History */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'سجل الحوادث والطلاء' : 'Accident & Paint History'}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'سجل الحوادث / إعادة الطلاء' : 'Accident / Paint Job History'}</label>
                      <textarea
                        className="input" rows={3}
                        value={usedForm.accidentHistory}
                        onChange={(e) => setU('accidentHistory', e.target.value)}
                        placeholder={isAr ? 'صف أي حوادث أو أعمال طلاء أو إصلاح هيكلي معروفة…' : 'Describe any known accidents, paint work, or body repairs…'}
                        style={{ resize: 'vertical', minHeight: '80px' }}
                      />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الأجزاء المتضررة' : 'Affected Parts'}</label>
                      <textarea
                        className="input" rows={2}
                        value={usedForm.affectedParts}
                        onChange={(e) => setU('affectedParts', e.target.value)}
                        placeholder={isAr ? 'مثال: المصد الأمامي، الغطاء، الباب الأيسر…' : 'e.g. Front bumper, hood, left door…'}
                        style={{ resize: 'vertical', minHeight: '60px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Engine */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'حالة المحرك' : 'Engine Status'}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'هل تم تغيير المحرك؟' : 'Engine Changed?'}</label>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem' }}>
                        {([
                          { v: false as const, l: isAr ? 'لا — المحرك الأصلي' : 'No — Original Engine' },
                          { v: true  as const, l: isAr ? 'نعم — تم الاستبدال' : 'Yes — Engine Replaced' },
                        ]).map(({ v, l }) => {
                          const active = usedForm.engineChanged === v;
                          return (
                            <label
                              key={String(v)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-1)',
                                padding: '0.5rem 0.875rem', borderRadius: '0.4rem',
                                border: `1px solid ${active ? (v ? 'var(--danger)' : 'var(--success)') : 'var(--border)'}`,
                                background: active ? (v ? 'var(--danger-bg)' : 'var(--success-bg)') : 'var(--surface)',
                                transition: 'all 150ms',
                              }}
                            >
                              <input
                                type="radio" name="engineChanged" checked={active}
                                onChange={() => setU('engineChanged', v)}
                                style={{ accentColor: v ? 'var(--danger)' : 'var(--success)' }}
                              />
                              {l}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {usedForm.engineChanged && (
                      <>
                        <div>
                          <label className="input-label">{isAr ? 'رقم المحرك الجديد' : 'New Engine Number'}</label>
                          <input
                            className="input"
                            value={usedForm.newEngineNumber}
                            onChange={(e) => setU('newEngineNumber', e.target.value)}
                            placeholder={isAr ? 'رقم تسلسل / ختم المحرك' : 'Engine serial / stamp number'}
                            style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <DocUploadRow label={isAr ? 'وثائق استيراد المحرك' : 'Engine Import Documents'} required={false} file={docs['engine_import_docs']} onPick={() => pickDoc('engine_import_docs')} />
                          <DocUploadRow label={isAr ? 'نسخة الرخصة المعدلة' : 'Reattached License Copy'} required={false} file={docs['engine_license_copy']} onPick={() => pickDoc('engine_license_copy')} />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Customer Pricing */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'سعر طلب العميل' : 'Customer Asking Price'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'سعر الطلب (جنيه)' : 'Customer Asking Price (EGP)'}</label>
                      <input className="input" type="number" min="0" value={usedForm.customerAskingPrice ?? ''} onChange={(e) => setU('customerAskingPrice', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'أدنى سعر مقبول (جنيه)' : 'Minimum Asking Price (EGP)'}</label>
                      <input className="input" type="number" min="0" value={usedForm.minimumAskingPrice ?? ''} onChange={(e) => setU('minimumAskingPrice', e.target.value)} placeholder="0" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">{isAr ? 'هامش الربح (جنيه)' : 'Overprice (EGP)'}</label>
                      <input className="input" type="number" min="0" value={usedForm.overprice ?? ''} onChange={(e) => setU('overprice', e.target.value)} placeholder="0" />
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                        {isAr ? 'المبلغ المضاف فوق سعر الطلب كهامش ربح للمعرض' : 'Amount added on top of asking price as showroom margin'}
                        {overprice > 0 && Number(usedForm.customerAskingPrice) > 0
                          ? ` — ${isAr ? 'سعر البيع الفعلي:' : 'Effective price:'} ${fmt(Number(usedForm.customerAskingPrice) + overprice)}`
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP: Specs & Features */}
            {isSpecsFeatures && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'المحرك ونظام الدفع' : 'Engine & Drivetrain'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">{isAr ? 'سعة المحرك' : 'Engine Type'}</label>
                      <input className="input" value={form.engineType} onChange={(e) => set('engineType', e.target.value)} placeholder={isAr ? 'مثال: 2.0L Inline-4، 3.5L V6…' : 'e.g. 2.0L Inline-4, 3.5L V6…'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'القوة (حصان)' : 'Horsepower (HP)'}</label>
                      <input className="input" type="number" min="0" value={form.hp ?? ''} onChange={(e) => set('hp', e.target.value)} placeholder="e.g. 180" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'عزم الدوران (ن.م)' : 'Torque (N·m)'}</label>
                      <input className="input" type="number" min="0" value={form.torque ?? ''} onChange={(e) => set('torque', e.target.value)} placeholder="e.g. 350" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'ناقل الحركة' : 'Transmission'}</label>
                      <SearchableCombobox options={TRANSMISSIONS} value={form.transmission} onChange={(v) => set('transmission', v)} placeholder={isAr ? 'اختر…' : 'Select…'} clearable clearLabel={isAr ? 'غير محدد' : 'Not specified'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'نوع الناقل' : 'Gear Type'}</label>
                      <SearchableCombobox options={GEAR_TYPES} value={form.gearType} onChange={(v) => set('gearType', v)} placeholder={isAr ? 'اختر…' : 'Select…'} clearable clearLabel={isAr ? 'غير محدد' : 'Not specified'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'نوع الوقود' : 'Fuel Type'}</label>
                      <SearchableCombobox options={FUEL_TYPES} value={form.fuelType} onChange={(v) => set('fuelType', v)} placeholder={isAr ? 'اختر…' : 'Select…'} clearable clearLabel={isAr ? 'غير محدد' : 'Not specified'} />
                    </div>

                    {/* Drive type radio */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">{isAr ? 'نوع الدفع' : 'Drive Type'}</label>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem' }}>
                        {([
                          { v: 'FWD' as const, l: isAr ? 'دفع أمامي' : 'Forward Wheel Drive' },
                          { v: 'RWD' as const, l: isAr ? 'دفع خلفي' : 'Rear Wheel Drive' },
                          { v: 'AWD' as const, l: isAr ? 'دفع رباعي' : 'All Wheel Drive' },
                        ]).map(({ v, l }) => {
                          const active = form.driveType === v;
                          return (
                            <label
                              key={v}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-1)',
                                padding: '0.5rem 0.875rem', borderRadius: '0.4rem',
                                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                                background: active ? 'var(--info-bg)' : 'var(--surface)',
                                transition: 'all 150ms',
                              }}
                            >
                              <input
                                type="radio" name="driveType" checked={active}
                                onChange={() => set('driveType', v)}
                                style={{ accentColor: 'var(--primary)' }}
                              />
                              {l}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {isUsed && (
                      <>
                        <ConditionPctField
                          label={isAr ? 'حالة المحرك (%)' : 'Engine Condition (%)'}
                          value={usedForm.engineConditionPct}
                          onChange={(v) => setU('engineConditionPct', v)}
                        />
                        <ConditionPctField
                          label={isAr ? 'حالة ناقل الحركة (%)' : 'Transmission Condition (%)'}
                          value={usedForm.transmissionConditionPct}
                          onChange={(v) => setU('transmissionConditionPct', v)}
                        />
                      </>
                    )}

                    <div>
                      <label className="input-label">{isAr ? 'الأبواب' : 'Doors'}</label>
                      <input className="input" type="number" min="2" max="6" value={form.doors ?? ''} onChange={(e) => set('doors', e.target.value)} placeholder="e.g. 4" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'المقاعد' : 'Seats'}</label>
                      <input className="input" type="number" min="2" max="9" value={form.seats ?? ''} onChange={(e) => set('seats', e.target.value)} placeholder="e.g. 5" />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'المميزات والإضافات' : 'Features & Options'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {FEATURES_LIST.map((f) => {
                      const checked = form.features.includes(f);
                      return (
                        <label key={f} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-1)',
                          padding: '0.5rem 0.75rem', borderRadius: '0.4rem',
                          border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                          background: checked ? 'var(--info-bg)' : 'var(--surface)',
                          transition: 'all 150ms',
                        }}>
                          <input
                            type="checkbox" checked={checked} onChange={() => toggleFeature(f)}
                            style={{ accentColor: 'var(--primary)', width: '14px', height: '14px' }}
                          />
                          {isAr ? (FEATURES_AR[f] ?? f) : f}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP: Pricing & Location */}
            {isPricing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'التسعير' : 'Pricing'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'التكلفة / سعر الاستحواذ (جنيه)' : 'Purchase / Acquisition Cost (EGP)'}</label>
                      <input
                        className="input" type="number" min="0"
                        value={form.acquisitionCost}
                        onChange={(e) => set('acquisitionCost', e.target.value)}
                        placeholder="0"
                      />
                      {isUsed && usedForm.customerAskingPrice && (
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                          {isAr
                            ? `من سعر طلب العميل: ${fmt(Number(usedForm.customerAskingPrice))}`
                            : `From customer asking price: ${fmt(Number(usedForm.customerAskingPrice))}`}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'سعر البيع المعروض (جنيه)' : 'Listed Sale Price (EGP)'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        className="input" type="number" min="0"
                        value={form.salePrice}
                        onChange={(e) => set('salePrice', e.target.value)}
                        placeholder="0"
                      />
                      {isUsed && form.acquisitionCost && usedForm.overprice && (
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                          {fmt(Number(form.acquisitionCost))} + {fmt(overprice)} overprice = {fmt(Number(form.acquisitionCost) + overprice)}
                        </p>
                      )}
                    </div>
                  </div>
                  {margin > 0 && (
                    <div style={{
                      marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem',
                      background: 'var(--success-bg)', border: '1px solid var(--success)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 500 }}>{isAr ? 'هامش الربح الإجمالي' : 'Gross Profit Margin'}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 700 }}>{fmt(margin)} ({marginPct.toFixed(1)}%)</span>
                    </div>
                  )}
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'الرسوم التنظيمية المصرية' : 'Egypt Regulatory Fees'}</p>
                  <div style={{
                    padding: '0.625rem 0.875rem', borderRadius: '0.4rem',
                    background: 'var(--warning-bg)', border: '1px solid var(--warning)',
                    fontSize: '0.75rem', color: 'var(--warning-fg)', marginBottom: '1rem',
                  }}>
                    {isAr ? 'اتركه فارغاً لاستخدام الإعداد الافتراضي للفرع. تظهر هذه كبنود في فاتورة العميل.' : 'Leave blank to use the branch default. These appear as line items on the customer invoice.'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'الرسوم الإدارية (جنيه)' : 'Administration Fee (EGP)'}</label>
                      <input
                        className="input" type="number" min="0"
                        value={form.adminFeeOverride} onChange={(e) => set('adminFeeOverride', e.target.value)}
                        placeholder={selectedLocation?.defaultAdminFee
                          ? `${Number(selectedLocation.defaultAdminFee).toLocaleString()} (${isAr ? 'افتراضي الفرع' : 'Location Default'})`
                          : `3,500 (${isAr ? 'افتراضي الفرع' : 'Location Default'})`}
                      />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'التأمين الإلزامي (جنيه)' : 'Compulsory Insurance (EGP)'}</label>
                      <input
                        className="input" type="number" min="0"
                        value={form.insuranceFeeOverride} onChange={(e) => set('insuranceFeeOverride', e.target.value)}
                        placeholder={selectedLocation?.defaultInsuranceFee
                          ? `${Number(selectedLocation.defaultInsuranceFee).toLocaleString()} (${isAr ? 'افتراضي الفرع' : 'Location Default'})`
                          : `4,800 (${isAr ? 'افتراضي الفرع' : 'Location Default'})`}
                      />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'تعيين الفرع' : 'Branch Assignment'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'تعيين للفرع' : 'Assign to Location'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <SearchableCombobox options={locationOptions} value={form.locationId} onChange={(v) => set('locationId', v)} placeholder={isAr ? 'اختر الفرع…' : 'Select branch…'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الحالة الابتدائية' : 'Initial Status'}</label>
                      <SearchableCombobox options={INITIAL_STATUSES} value={form.status} onChange={(v) => set('status', v)} placeholder={isAr ? 'اختر الحالة…' : 'Select status…'} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP: Upload Photos */}
            {isPhotos && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <p className="section-label">{isAr ? 'صور السيارة' : 'Vehicle Photos'}</p>

                {/* Hidden file input */}
                <input
                  ref={photoFileRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files?.length) addPhotoFiles(e.target.files); e.target.value = ''; }}
                />

                {/* Drop zone */}
                <div
                  onClick={() => photoFileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files.length) addPhotoFiles(e.dataTransfer.files);
                  }}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border-strong)'}`,
                    borderRadius: '0.75rem',
                    padding: '2.5rem',
                    textAlign: 'center',
                    background: dragOver ? 'var(--info-bg)' : 'var(--surface-2)',
                    marginBottom: '1.25rem',
                    cursor: 'pointer',
                    transition: 'border-color 150ms, background 150ms',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: dragOver ? 'var(--primary)' : 'var(--text-3)' }}>
                      <rect x="4" y="8" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="14" cy="18" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M4 28l8-8 6 6 4-4 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: dragOver ? 'var(--primary)' : 'var(--text-2)', fontWeight: 500, marginBottom: '0.25rem' }}>
                    {dragOver
                      ? (isAr ? 'أفلت الصور هنا' : 'Drop photos here')
                      : (isAr ? 'انقر للرفع أو اسحب وأفلت' : 'Click to upload or drag and drop')}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {isAr
                      ? 'PNG، JPG، WebP حتى 10MB لكل صورة. الصورة الأولى هي الصورة الرئيسية.'
                      : 'PNG, JPG, WebP up to 10MB each. First image is the primary photo.'}
                  </p>
                </div>

                {/* URL paste fallback */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    className="input" value={photoInput} onChange={(e) => setPhotoInput(e.target.value)}
                    placeholder={isAr ? 'أو الصق رابط الصورة…' : 'Or paste image URL…'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && photoInput.trim()) {
                        e.preventDefault();
                        setPhotos((p) => [...p, { src: photoInput.trim() }]);
                        setPhotoInput('');
                      }
                    }}
                  />
                  <button
                    type="button" className="btn btn-secondary" disabled={!photoInput.trim()}
                    onClick={() => {
                      if (!photoInput.trim()) return;
                      setPhotos((p) => [...p, { src: photoInput.trim() }]);
                      setPhotoInput('');
                    }}
                  >{isAr ? 'إضافة' : 'Add'}</button>
                </div>

                {photos.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {photos.map((p, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '4/3' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.src} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', display: 'flex', gap: '0.25rem' }}>
                          {i === 0 && <span className="badge badge-info" style={{ fontSize: '0.625rem', padding: '0.15rem 0.4rem' }}>{isAr ? 'رئيسية' : 'Primary'}</span>}
                          <button
                            type="button" onClick={() => removePhoto(i)}
                            style={{ width: '22px', height: '22px', borderRadius: '9999px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >×</button>
                        </div>
                        {i > 0 && (
                          <button
                            type="button" onClick={() => setPrimaryPhoto(i)}
                            style={{ position: 'absolute', bottom: '0.4rem', left: '0.4rem', fontSize: '0.625rem', padding: '0.15rem 0.4rem', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                          >{isAr ? 'تعيين كرئيسية' : 'Set as Primary'}</button>
                        )}
                        {p.file && (
                          <div style={{ position: 'absolute', bottom: '0.4rem', right: '0.4rem', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} title={isAr ? 'الملف جاهز للرفع' : 'File ready to upload'} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem 0' }}>
                    {isAr ? 'لم تُضف صور بعد. يمكنك إضافة صور بعد النشر أيضاً.' : 'No photos added yet. You can add photos after publishing as well.'}
                  </p>
                )}
              </div>
            )}

            {/* STEP: Documents */}
            {isDocs && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'وثائق السيارة' : 'Vehicle Documents'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {DOC_SLOTS_BASE.map((slot) => {
                    const file = docs[slot.key];
                    const slotLabel = isAr ? (DOC_LABELS_AR[slot.label] ?? slot.label) : slot.label;
                    return (
                      <div
                        key={slot.key}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.875rem 1rem', borderRadius: '0.5rem',
                          border: `1px solid ${file ? 'var(--success)' : 'var(--border)'}`,
                          background: file ? 'var(--success-bg)' : 'var(--surface)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                          {file ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--success-fg)', flexShrink: 0 }}>
                              <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/>
                              <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                              <path d="M4 2h6l4 4v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                              <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                            </svg>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontWeight: 500 }}>{slotLabel}</span>
                              {slot.required && !isUsed && (
                                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#fff', background: 'var(--danger)', padding: '0.1rem 0.375rem', borderRadius: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  {isAr ? 'مطلوب' : 'Required'}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: file ? 'var(--success-fg)' : 'var(--text-3)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                              {file ? file.name : (isAr ? 'لم يُختر ملف' : 'No file selected')}
                            </p>
                          </div>
                        </div>
                        <button type="button" className="btn btn-secondary" onClick={() => pickDoc(slot.key)} style={{ flexShrink: 0, fontSize: '0.8125rem' }}>
                          {file ? (isAr ? 'استبدال' : 'Replace') : (isAr ? 'رفع' : 'Upload')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP: Review & Publish */}
            {isReview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'المعلومات الأساسية' : 'Basic Information'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 1.5rem' }}>
                    {([
                      [isAr ? 'رقم الشاسيه' : 'VIN', form.vin || '—'],
                      [isAr ? 'الحالة' : 'Condition', form.condition],
                      [isAr ? 'الشركة المصنعة' : 'Make', form.make || '—'],
                      [isAr ? 'الطراز' : 'Model', form.model || '—'],
                      [isAr ? 'سنة الصنع' : 'Year', form.year],
                      [isAr ? 'الفئة' : 'Trim', form.trim || '—'],
                      [isAr ? 'اللون' : 'Color', form.color || '—'],
                      [isAr ? 'نوع الهيكل' : 'Body Type', form.bodyType || '—'],
                      [isAr ? 'عداد الكيلومترات' : 'Mileage', form.mileage ? `${Number(form.mileage).toLocaleString()} km` : '0 km'],
                    ] as [string, string][]).map(([label, val]) => (
                      <div key={label}>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, marginTop: '0.15rem' }}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {isUsed && (
                  <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                    <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'تفاصيل السيارة المستعملة' : 'Used Vehicle Details'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 1.5rem' }}>
                      {([
                        [isAr ? 'رقم رخصة التسجيل' : 'Reg. License No.', usedForm.regLicenseNumber || '—'],
                        [isAr ? 'انتهاء الرخصة' : 'License Expiry', usedForm.licenseExpiryDate || '—'],
                        [isAr ? 'الأشهر المتبقية' : 'Months Remaining', months !== null ? `${months} ${isAr ? 'أشهر' : `month${months !== 1 ? 's' : ''}`}` : '—'],
                        [isAr ? 'تغيير المحرك' : 'Engine Changed', usedForm.engineChanged ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')],
                        ...(usedForm.newEngineNumber ? [[isAr ? 'رقم المحرك الجديد' : 'New Engine No.', usedForm.newEngineNumber]] : []),
                        ...(usedForm.customerAskingPrice ? [[isAr ? 'سعر الطلب' : 'Asking Price', fmt(Number(usedForm.customerAskingPrice))]] : []),
                        ...(usedForm.minimumAskingPrice ? [[isAr ? 'أدنى سعر مقبول' : 'Min. Asking Price', fmt(Number(usedForm.minimumAskingPrice))]] : []),
                        ...(overprice > 0 ? [[isAr ? 'هامش السعر' : 'Overprice', fmt(overprice)]] : []),
                      ] as [string, string][]).map(([label, val]) => (
                        <div key={label}>
                          <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, marginTop: '0.15rem' }}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {usedForm.accidentHistory && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{isAr ? 'سجل الحوادث والطلاء' : 'Accident / Paint History'}</p>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{usedForm.accidentHistory}</p>
                        {usedForm.affectedParts && <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{isAr ? 'الأجزاء:' : 'Parts:'} {usedForm.affectedParts}</p>}
                      </div>
                    )}
                  </div>
                )}

                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'المواصفات' : 'Specifications'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 1.5rem' }}>
                    {([
                      [isAr ? 'المحرك' : 'Engine', form.engineType || '—'],
                      [isAr ? 'الحصان' : 'HP', form.hp ? `${form.hp} hp` : '—'],
                      [isAr ? 'عزم الدوران' : 'Torque', form.torque ? `${form.torque} N·m` : '—'],
                      [isAr ? 'نوع الدفع' : 'Drive Type', form.driveType || '—'],
                      [isAr ? 'ناقل الحركة' : 'Transmission', form.transmission || '—'],
                      [isAr ? 'نوع الناقل' : 'Gear Type', form.gearType || '—'],
                      [isAr ? 'نوع الوقود' : 'Fuel Type', form.fuelType || '—'],
                      [isAr ? 'الأبواب' : 'Doors', form.doors || '—'],
                      [isAr ? 'المقاعد' : 'Seats', form.seats || '—'],
                      ...(isUsed ? [
                        [isAr ? 'حالة المحرك' : 'Engine Condition', usedForm.engineConditionPct ? `${usedForm.engineConditionPct}%` : '—'],
                        [isAr ? 'حالة ناقل الحركة' : 'Transmission Condition', usedForm.transmissionConditionPct ? `${usedForm.transmissionConditionPct}%` : '—'],
                      ] : []),
                    ] as [string, string][]).map(([label, val]) => (
                      <div key={label}>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, marginTop: '0.15rem' }}>{val}</p>
                      </div>
                    ))}
                  </div>
                  {form.features.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>{isAr ? 'المميزات' : 'Features'}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {form.features.map((f) => <span key={f} className="badge badge-info">{f}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'التسعير والفرع' : 'Pricing & Location'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {([
                      [isAr ? 'تكلفة الاقتناء' : 'Acquisition Cost', form.acquisitionCost ? fmt(Number(form.acquisitionCost)) : '—'],
                      [isAr ? 'سعر البيع' : 'Sale Price', form.salePrice ? fmt(Number(form.salePrice)) : '—'],
                      [isAr ? 'الرسوم الإدارية' : 'Admin Fee', form.adminFeeOverride ? fmt(Number(form.adminFeeOverride)) : (isAr ? 'افتراضي الفرع' : 'Location Default')],
                      [isAr ? 'التأمين' : 'Insurance', form.insuranceFeeOverride ? fmt(Number(form.insuranceFeeOverride)) : (isAr ? 'افتراضي الفرع' : 'Location Default')],
                      [isAr ? 'الفرع' : 'Location', locationOptions.find((l) => l.value === form.locationId)?.label ?? '—'],
                      [isAr ? 'الحالة الابتدائية' : 'Initial Status', INITIAL_STATUSES.find((s) => s.value === form.status)?.label ?? form.status],
                    ] as [string, string][]).map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{label}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontWeight: 500 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  {margin > 0 && (
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', background: 'var(--success-bg)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 500 }}>{isAr ? 'هامش الربح' : 'Gross Margin'}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 700 }}>{fmt(margin)} ({marginPct.toFixed(1)}%)</span>
                    </div>
                  )}
                </div>

                {photos.length > 0 && (
                  <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                    <p className="section-label" style={{ marginBottom: '0.75rem' }}>{isAr ? 'الصور' : 'Photos'} ({photos.length})</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {photos.slice(0, 6).map((p, i) => (
                        <div key={i} style={{ width: '64px', height: '48px', borderRadius: '0.375rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                      {photos.length > 6 && (
                        <div style={{ width: '64px', height: '48px', borderRadius: '0.375rem', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                          +{photos.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '0.75rem' }}>{isAr ? 'الوثائق' : 'Documents'}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {DOC_SLOTS_BASE.map((slot) => {
                      const file = docs[slot.key];
                      const slotLabel = isAr ? (DOC_LABELS_AR[slot.label] ?? slot.label) : slot.label;
                      return (
                        <div key={slot.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{slotLabel}</span>
                          {file ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--success-fg)' }}>
                                <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/>
                                <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span style={{ fontSize: '0.75rem', color: 'var(--success-fg)', fontWeight: 500, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)',
            }}>
              <div>
                {step > 1 ? (
                  <button className="btn btn-secondary" onClick={back}>{isAr ? '→ رجوع' : '← Back'}</button>
                ) : (
                  <button className="btn btn-secondary" onClick={() => { set('condition', ''); setStep(1); setErr(''); }}>
                    {isAr ? '→ تغيير الحالة' : '← Change Condition'}
                  </button>
                )}
              </div>
              <div>
                {step < totalSteps ? (
                  <button className="btn btn-primary" onClick={next}>
                    {step === totalSteps - 1
                      ? (isAr ? '← مراجعة' : 'Review →')
                      : (isAr ? `← التالي: ${sl(STEPS[step]?.label ?? '')}` : `Next: ${STEPS[step]?.label} →`)}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={publish} disabled={saving} style={{ minWidth: '140px' }}>
                    {saving ? (isAr ? 'جاري النشر…' : 'Publishing…') : (isAr ? 'نشر السيارة' : 'Publish Vehicle')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1rem' }}>
            {/* Progress panel */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label">{isAr ? 'التقدم' : 'Progress'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {STEPS.map((s) => {
                  const done   = step > s.n;
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
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: active ? '#fff' : 'var(--text-3)' }}>{s.n}</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.8125rem',
                        color: active ? 'var(--text-1)' : done ? 'var(--success-fg)' : 'var(--text-3)',
                        fontWeight: active ? 600 : 400,
                      }}>
                        {sl(s.label)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pricing summary */}
            {((isUsed && step >= 4) || (!isUsed && step >= 3)) && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <p className="section-label">{isAr ? 'ملخص التسعير' : 'Pricing Summary'}</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { label: isAr ? 'السعر المعروض' : 'Listed Price', value: form.salePrice ? fmt(Number(form.salePrice)) : '—' },
                    { label: isAr ? 'تكلفة الاقتناء' : 'Acquisition Cost', value: form.acquisitionCost ? fmt(Number(form.acquisitionCost)) : '—' },
                    { label: isAr ? 'الرسوم الإدارية' : 'Admin Fee', value: form.adminFeeOverride ? fmt(Number(form.adminFeeOverride)) : (isAr ? 'افتراضي الفرع' : 'Location Default') },
                    { label: isAr ? 'التأمين الإلزامي' : 'Compulsory Insurance', value: form.insuranceFeeOverride ? fmt(Number(form.insuranceFeeOverride)) : (isAr ? 'افتراضي الفرع' : 'Location Default') },
                    ...(isUsed && usedForm.customerAskingPrice ? [
                      { label: isAr ? 'سعر طلب العميل' : 'Customer Asking Price', value: fmt(Number(usedForm.customerAskingPrice)) },
                    ] : []),
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem',
                    }}>
                      <span style={{ color: 'var(--text-2)' }}>{label}</span>
                      <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                  {margin > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-2)' }}>{isAr ? 'هامش الربح' : 'Gross Margin'}</span>
                      <span style={{ color: 'var(--success-fg)', fontWeight: 700 }}>{fmt(margin)} ({marginPct.toFixed(1)}%)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tips */}
            <div style={{ padding: '1rem', borderRadius: '0.625rem', background: 'var(--info-bg)', border: '1px solid var(--info)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--info-fg)', marginBottom: '0.5rem' }}>{isAr ? 'نصائح' : 'Tips'}</p>
              <ul style={{ fontSize: '0.75rem', color: 'var(--info-fg)', lineHeight: 1.6, paddingLeft: '1rem', margin: 0 }}>
                {isBasicInfo && !isUsed && (isAr
                  ? <><li>يجب أن يكون رقم الشاسيه 17 حرفاً بالضبط.</li><li>أدخل رقم الشاسيه كاملاً لتفعيل التعبئة التلقائية.</li></>
                  : <><li>VIN must be exactly 17 characters.</li><li>Enter full VIN to enable auto-decode.</li></>
                )}
                {isBasicInfo && isUsed && (isAr
                  ? <><li>رقم الشاسيه اختياري للمركبات المستعملة.</li><li>سجّل قراءة العداد بدقة.</li></>
                  : <><li>VIN is optional for used vehicles.</li><li>Record accurate odometer reading.</li></>
                )}
                {isUsedDetails && (isAr
                  ? <><li>رقم الرخصة مطلوب.</li><li>أفصح عن جميع الحوادث — حماية من المسؤولية.</li><li>تغيير المحرك يستلزم وثائق استيراد.</li></>
                  : <><li>Registration number is required.</li><li>Disclose all accidents — liability protection.</li><li>Engine change requires import documentation.</li></>
                )}
                {isSpecsFeatures && (isAr
                  ? <><li>المميزات تساعد العملاء على الفلترة في الموقع.</li><li>المزيد من المواصفات يحسّن قابلية الاكتشاف.</li></>
                  : <><li>Features help customers filter on the B2C site.</li><li>More specs improve discoverability.</li></>
                )}
                {isPricing && (isAr
                  ? <><li>الرسوم الإدارية والتأمين افتراضية حسب الفرع.</li><li>التكلفة مخفية عن مندوبي المبيعات.</li></>
                  : <><li>Admin fee and insurance default per-branch.</li><li>Cost hidden from sales reps.</li></>
                )}
                {isPhotos && (isAr
                  ? <><li>الصورة الأولى هي الصورة الرئيسية في الإعلان.</li><li>يمكن إضافة المزيد من الصور بعد النشر.</li></>
                  : <><li>First photo is the primary listing image.</li><li>More photos can be added after publishing.</li></>
                )}
                {isDocs && (isAr
                  ? <><li>الصيغ المقبولة: PDF، JPG، PNG.</li><li>يمكن تحديث الوثائق لاحقاً.</li></>
                  : <><li>Accepted formats: PDF, JPG, PNG.</li><li>Documents can be updated later.</li></>
                )}
                {isReview && (isAr
                  ? <><li>راجع جميع التفاصيل قبل النشر.</li><li>يمكن تغيير الحالة بعد النشر.</li></>
                  : <><li>Review all details before publishing.</li><li>Status can be changed after publishing.</li></>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    {showVinScanner && (
      <ScannerModal
        formats={VIN_FORMATS}
        title={isAr ? 'مسح باركود VIN' : 'Scan VIN Barcode'}
        hint={isAr ? 'وجّه الكاميرا نحو باركود VIN على الملصق أو إطار باب السائق' : 'Point at the VIN barcode on the chassis sticker or driver-door jamb'}
        onScan={(value) => { set('vin', value.toUpperCase().slice(0, 17)); setShowVinScanner(false); }}
        onClose={() => setShowVinScanner(false)}
      />
    )}
    </>
  );
}

/* ── Condition selector card ──────────────────────────────────────────── */
function ConditionCard({ color, icon, title, desc, onClick, hoverBorder, hoverBg }: {
  color: string; icon: React.ReactNode; title: string; desc: string;
  onClick: () => void; hoverBorder: string; hoverBg: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: '0.75rem', padding: '1.5rem', borderRadius: '0.75rem',
        border: `2px solid ${hovered ? hoverBorder : 'var(--border)'}`,
        background: hovered ? hoverBg : 'var(--surface)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 150ms, background 150ms',
        width: '100%',
      }}
    >
      <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.25rem' }}>{title}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</p>
      </div>
    </button>
  );
}

/* ── Inline doc upload row ────────────────────────────────────────────── */
function DocUploadRow({ label, required, file, onPick }: {
  label: string; required: boolean; file: File | undefined; onPick: () => void;
}) {
  const { isAr } = useLang();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.75rem 0.875rem', borderRadius: '0.5rem',
      border: `1px solid ${file ? 'var(--success)' : 'var(--border)'}`,
      background: file ? 'var(--success-bg)' : 'var(--surface)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontWeight: 500 }}>{label}</span>
          {required && (
            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#fff', background: 'var(--danger)', padding: '0.1rem 0.3rem', borderRadius: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isAr ? 'مطلوب' : 'Required'}
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.75rem', color: file ? 'var(--success-fg)' : 'var(--text-3)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
          {file ? file.name : (isAr ? 'لم يُختر ملف' : 'No file selected')}
        </p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={onPick} style={{ flexShrink: 0, fontSize: '0.75rem', padding: '0.35rem 0.625rem' }}>
        {file ? (isAr ? 'استبدال' : 'Replace') : (isAr ? 'رفع' : 'Upload')}
      </button>
    </div>
  );
}

/* ── Condition % input with colour bar ────────────────────────────────── */
function ConditionPctField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const pct = Number(value) || 0;
  const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <label className="input-label">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input
          className="input" type="number" min="0" max="100"
          value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 80"
          style={{ width: '120px' }}
        />
        {value && (
          <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.min(100, pct)}%`,
              borderRadius: '4px', background: color, transition: 'width 200ms',
            }} />
          </div>
        )}
        {value && (
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color, minWidth: '2.5rem', textAlign: 'right' }}>{pct}%</span>
        )}
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 5.5A1 1 0 0 1 2.5 4.5h1l1-2h5l1 2h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="8" cy="9" r="2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function CarNewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 13l2-6h10l2 6" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="2" y="13" width="16" height="4" rx="1.5" stroke="#fff" strokeWidth="1.5"/>
      <circle cx="6" cy="17" r="1.5" fill="#fff"/>
      <circle cx="14" cy="17" r="1.5" fill="#fff"/>
    </svg>
  );
}

function CarUsedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 13l2-6h10l2 6" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="2" y="13" width="16" height="4" rx="1.5" stroke="#fff" strokeWidth="1.5"/>
      <circle cx="6" cy="17" r="1.5" fill="#fff"/>
      <circle cx="14" cy="17" r="1.5" fill="#fff"/>
      <path d="M10 3v3M8.5 4.5h3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
