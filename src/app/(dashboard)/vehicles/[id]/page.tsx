'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';
import { API_BASE } from '@/lib/config';

interface Location {
  id: string; name: string; city?: string;
  defaultAdminFee?: number; defaultInsuranceFee?: number;
}

interface VehicleImage { id: string; url: string; order: number; }

interface ExistingVehicle {
  id: string; make: string; model: string; trim?: string; year: number;
  vin?: string; status: string; condition: string;
  bodyType?: string; color?: string; mileage?: number; engineSize?: string;
  fuelType?: string; transmission?: string; seats?: number; doors?: number;
  hp?: number; torque?: number; driveType?: string; gearType?: string;
  price: number; salePrice?: number; cost?: number; acquisitionCost?: number;
  overprice?: number; ourProfit?: number;
  adminFeeOverride?: number; insuranceFeeOverride?: number;
  locationId?: string; accreditedDealerId?: string; ownershipType?: string;
  images?: VehicleImage[];
  features?: { feature: string }[] | string[];
  regLicenseNumber?: string; licenseExpiryDate?: string;
  accidentHistory?: string; affectedParts?: string;
  engineChanged?: boolean; newEngineNumber?: string;
  customerAskingPrice?: number; minimumAskingPrice?: number;
  engineConditionPct?: number; transmissionConditionPct?: number;
}

const YEARS = Array.from({ length: 40 }, (_, i) => {
  const y = 2026 - i;
  return { value: String(y), label: String(y) };
});

const FEATURES_LIST = [
  'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera',
  'Blind Spot Monitor', 'Lane Departure Warning', 'Sunroof', 'Heated Seats',
  'Keyless Entry', 'Push Start', 'Navigation', 'Parking Sensors',
];

const CRV_FONT_HEADING = '"Cairo", sans-serif';
const CRV_FONT_BODY    = '"Times New Roman", Times, serif';

function crvDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function crvDateAr(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
}

const CRV_CHECKLIST: { en: string; ar: string; items: { en: string; ar: string }[] }[] = [
  {
    en: 'Exterior', ar: 'المظهر الخارجي',
    items: [
      { en: 'Front bumper — no damage', ar: 'المصد الأمامي — لا أضرار' },
      { en: 'Rear bumper — no damage', ar: 'المصد الخلفي — لا أضرار' },
      { en: 'Hood / Bonnet', ar: 'الغطاء الأمامي (البونيه)' },
      { en: 'Boot / Trunk lid', ar: 'غطاء الصندوق الخلفي' },
      { en: 'Left front door', ar: 'الباب الأمامي الأيسر' },
      { en: 'Right front door', ar: 'الباب الأمامي الأيمن' },
      { en: 'Left rear door', ar: 'الباب الخلفي الأيسر' },
      { en: 'Right rear door', ar: 'الباب الخلفي الأيمن' },
      { en: 'Roof — no damage', ar: 'السقف — لا أضرار' },
      { en: 'Paint finish & color uniformity', ar: 'جودة الدهان وتوحد اللون' },
      { en: 'Side mirrors — intact', ar: 'المرايا الجانبية — سليمة' },
      { en: 'Windshield — no chips or cracks', ar: 'الزجاج الأمامي — خالٍ من الشقوق' },
      { en: 'Rear windshield', ar: 'الزجاج الخلفي' },
      { en: 'Side windows', ar: 'النوافذ الجانبية' },
      { en: 'Door seals & weather strips', ar: 'عوازل الأبواب والحشوات' },
      { en: 'Grille & headlight surrounds', ar: 'الشبكة الأمامية وإطارات المصابيح' },
    ],
  },
  {
    en: 'Interior', ar: 'المظهر الداخلي',
    items: [
      { en: 'Dashboard — no cracks or damage', ar: 'لوحة التحكم — لا تشققات أو أضرار' },
      { en: 'Driver seat — condition OK', ar: 'مقعد السائق — حالة جيدة' },
      { en: 'Front passenger seat', ar: 'مقعد الراكب الأمامي' },
      { en: 'Rear seats — all positions', ar: 'المقاعد الخلفية — جميع المواضع' },
      { en: 'All seat belts — latch & retract', ar: 'جميع أحزمة الأمان — تعمل' },
      { en: 'Interior trim & door panels', ar: 'الإكساءات الداخلية وألواح الأبواب' },
      { en: 'Headliner / roof lining', ar: 'بطانة السقف الداخلية' },
      { en: 'Floor mats — present & clean', ar: 'سجادات الأرضية — موجودة ونظيفة' },
      { en: 'Steering wheel — no damage', ar: 'عجلة القيادة — لا أضرار' },
      { en: 'Gear shift & center console', ar: 'ذراع ناقل الحركة والكونسول الأوسط' },
      { en: 'Glove compartment', ar: 'حاوية المستندات (الدرج)' },
      { en: 'Sun visors', ar: 'واقيات الشمس' },
      { en: 'Interior cleanliness', ar: 'نظافة الداخلية العامة' },
    ],
  },
  {
    en: 'Mechanical', ar: 'الميكانيكا',
    items: [
      { en: 'Engine compartment — clean & dry', ar: 'غرفة المحرك — نظيفة وجافة' },
      { en: 'Engine oil — level & condition', ar: 'زيت المحرك — مستوى وجودة' },
      { en: 'Coolant level', ar: 'مستوى سائل التبريد' },
      { en: 'Brake fluid level', ar: 'مستوى سائل الفرامل' },
      { en: 'Power steering fluid', ar: 'سائل توجيه القوة' },
      { en: 'Windshield washer fluid', ar: 'سائل غسيل الزجاج' },
      { en: 'All four tyres — tread depth OK', ar: 'إطارات الأربع — عمق الفراغ مقبول' },
      { en: 'All four tyres — pressure correct', ar: 'ضغط الإطارات الأربع — صحيح' },
      { en: 'Spare tyre — present & inflated', ar: 'الإطار الاحتياطي — موجود ومضخوخ' },
      { en: 'Jack, wheel wrench & reflective kit', ar: 'كريك وعدة الإطار والملحقات' },
      { en: 'Front brake pads — acceptable wear', ar: 'تيل الفرامل الأمامية — بلى مقبول' },
      { en: 'Rear brakes', ar: 'الفرامل الخلفية' },
      { en: 'Exhaust — no leaks or unusual noise', ar: 'العادم — لا تسريبات أو ضوضاء' },
    ],
  },
  {
    en: 'Electrical', ar: 'الكهرباء',
    items: [
      { en: 'Battery — condition & charge OK', ar: 'البطارية — حالة وشحن جيد' },
      { en: 'Headlights — high & low beam', ar: 'المصابيح الأمامية — عالية ومنخفضة' },
      { en: 'Tail lights & brake lights', ar: 'مصابيح الخلف والفرامل' },
      { en: 'Reverse lights', ar: 'مصابيح الرجوع للخلف' },
      { en: 'Turn indicators — all four', ar: 'إشارات الانعطاف — الأربع' },
      { en: 'Hazard lights', ar: 'أضواء الخطر' },
      { en: 'Interior & dome lights', ar: 'الأضواء الداخلية' },
      { en: 'Horn', ar: 'البوق' },
      { en: 'Wipers — front & rear', ar: 'المساحات الأمامية والخلفية' },
      { en: 'Washer jets — front & rear', ar: 'فوهات غسيل الزجاج' },
      { en: 'Air conditioning — cooling', ar: 'التكييف — تبريد جيد' },
      { en: 'Heater / climate control', ar: 'التدفئة / التحكم المناخي' },
      { en: 'Audio / infotainment system', ar: 'نظام الصوت والترفيه' },
      { en: 'GPS / navigation system', ar: 'نظام الملاحة' },
      { en: 'Electric windows — all', ar: 'النوافذ الكهربائية — جميعها' },
      { en: 'Central locking system', ar: 'نظام القفل المركزي' },
      { en: 'Electric mirrors — adjust & fold', ar: 'المرايا الكهربائية — تعديل وطي' },
      { en: 'Parking sensors / camera', ar: 'حساسات الركن / كاميرا الخلفية' },
    ],
  },
  {
    en: 'Documents & Accessories', ar: 'المستندات والملحقات',
    items: [
      { en: 'Vehicle registration card', ar: 'بطاقة تسجيل السيارة' },
      { en: "Owner's / user manual", ar: 'كتيب المالك / دليل المستخدم' },
      { en: 'Service / maintenance booklet', ar: 'دفتر الصيانة' },
      { en: 'Main key(s)', ar: 'المفتاح الرئيسي' },
      { en: 'Spare key(s)', ar: 'المفتاح الاحتياطي' },
      { en: 'Smart key / remote fob', ar: 'وحدة التحكم عن بُعد' },
      { en: 'Radio / head unit unlock code', ar: 'كود فتح الراديو' },
      { en: 'Warranty card & terms', ar: 'بطاقة الضمان والشروط' },
      { en: 'Number plates — front & rear', ar: 'لوحات الترقيم — أمام وخلف' },
    ],
  },
  {
    en: 'Safety Equipment', ar: 'معدات السلامة',
    items: [
      { en: 'Fire extinguisher — present & valid', ar: 'طفاية الحريق — موجودة وصالحة' },
      { en: 'Warning triangles (×2)', ar: 'مثلثات التحذير (×٢)' },
      { en: 'First aid kit', ar: 'حقيبة الإسعاف الأولي' },
      { en: 'Reflective safety vest', ar: 'السترة العاكسة' },
    ],
  },
];

const STEPS_NEW = [
  { n: 1, label: 'Basic Info' },
  { n: 2, label: 'Specs & Features' },
  { n: 3, label: 'Pricing & Location' },
  { n: 4, label: 'Upload Photos' },
  { n: 5, label: 'Documents' },
  { n: 6, label: 'Receiving Checklist' },
  { n: 7, label: 'Review & Save' },
];

const STEPS_USED = [
  { n: 1, label: 'Basic Info' },
  { n: 2, label: 'Used Vehicle Details' },
  { n: 3, label: 'Specs & Features' },
  { n: 4, label: 'Pricing & Location' },
  { n: 5, label: 'Upload Photos' },
  { n: 6, label: 'Documents' },
  { n: 7, label: 'Receiving Checklist' },
  { n: 8, label: 'Review & Save' },
];

const DOC_SLOTS_BASE: { key: string; label: string; required: boolean }[] = [
  { key: 'vehicle_title',       label: 'Vehicle Title / Ownership Certificate', required: false },
  { key: 'inspection_report',   label: 'Inspection Report',                     required: false },
  { key: 'import_customs',      label: 'Import Customs Certificate',            required: false },
  { key: 'circular_book',       label: 'Circular Book / Publication',           required: false },
  { key: 'ministerial_decree',  label: 'Ministerial Decree',                   required: false },
  { key: 'commercial_register', label: 'Commercial Register',                   required: false },
  { key: 'tax_card',            label: 'Tax Card',                              required: false },
];

const DOC_LABELS_AR: Record<string, string> = {
  'Vehicle Title / Ownership Certificate': 'المبايعة',
  'Inspection Report': 'تقرير المعاينة',
  'Import Customs Certificate': 'الإفراج الجمركي',
  'Circular Book / Publication': 'الكتاب / المنشور الدوري',
  'Ministerial Decree': 'القرار الوزاري',
  'Commercial Register': 'السجل التجاري',
  'Tax Card': 'البطاقة الضريبية',
};

const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

function initForm() {
  return {
    vin: '', make: '', model: '', year: '2025', trim: '', mileage: '', color: '',
    bodyType: '', condition: '' as '' | 'NEW' | 'USED',
    engineType: '', transmission: '', fuelType: '', doors: '', seats: '',
    hp: '', torque: '', driveType: '', gearType: '',
    features: [] as string[],
    acquisitionCost: '', ourProfit: '', newOverprice: '', salePrice: '',
    adminFeeOverride: '', insuranceFeeOverride: '',
    locationId: '', status: 'AVAILABLE',
    accreditedDealerId: '',
    ownershipType: 'OWNED' as 'OWNED' | 'CONSIGNMENT' | 'THIRD_PARTY_SALE',
  };
}

function initUsedForm() {
  return {
    regLicenseNumber: '', licenseExpiryDate: '', accidentHistory: '',
    affectedParts: '', engineChanged: false, newEngineNumber: '',
    customerAskingPrice: '', minimumAskingPrice: '', overprice: '',
    engineConditionPct: '', transmissionConditionPct: '',
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

const DELETE_ROLES = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'];
function useUserRole(): string {
  const cookie = typeof document !== 'undefined'
    ? document.cookie.split('; ').find((c) => c.startsWith('admin_role='))
    : undefined;
  return cookie ? cookie.split('=')[1] : '';
}

export default function EditVehiclePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAr } = useLang();

  const { data: vehicle, loading: vehicleLoading, error: vehicleError } = useQuery<ExistingVehicle>(`/vehicles/${id}`);

  const INITIAL_STATUSES = [
    { value: 'AVAILABLE',          label: isAr ? 'متوفر'       : 'Available' },
    { value: 'RESERVED',           label: isAr ? 'محجوز'        : 'Reserved' },
    { value: 'SOLD',               label: isAr ? 'مباع'         : 'Sold' },
    { value: 'IN_TRANSIT',         label: isAr ? 'في الطريق'    : 'In Transit' },
    { value: 'PENDING_INSPECTION', label: isAr ? 'قيد الفحص'   : 'Pending Inspection' },
    { value: 'INACTIVE',           label: isAr ? 'غير نشط'     : 'Inactive' },
  ];

  const FEATURES_AR: Record<string, string> = {
    'Cruise Control': 'مثبت السرعة', 'Apple CarPlay': 'Apple CarPlay',
    'Android Auto': 'Android Auto', 'Reverse Camera': 'كاميرا خلفية',
    'Blind Spot Monitor': 'مراقب النقطة العمياء', 'Lane Departure Warning': 'تحذير مغادرة المسار',
    'Sunroof': 'فتحة سقف', 'Heated Seats': 'مقاعد مدفأة',
    'Keyless Entry': 'دخول بدون مفتاح', 'Push Start': 'تشغيل بلمسة',
    'Navigation': 'نظام ملاحة', 'Parking Sensors': 'حساسات ركن',
  };

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initForm());
  const [usedForm, setUsedForm] = useState(initUsedForm());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [photoInput, setPhotoInput] = useState('');
  const [photos, setPhotos] = useState<Array<{ src: string; file?: File }>>([]);
  const [dragOver, setDragOver] = useState(false);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Record<string, File>>({});
  const [dealers, setDealers] = useState<{ id: string; name: string; gracePeriodDays: number }[]>([]);
  const [rcptBrand, setRcptBrand] = useState<{ nameEn?: string; nameAr?: string; logoUrl?: string }>({});
  const [rcptChecked, setRcptChecked] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);

  const userRole = useUserRole();
  const canDelete = DELETE_ROLES.includes(userRole);

  useEffect(() => {
    apiFetch<{ id: string; name: string; gracePeriodDays: number }[]>('/accredited-dealers').then(setDealers).catch(() => {});
    try {
      const b = JSON.parse(localStorage.getItem('dealerms_brand') || '{}');
      if (b && typeof b === 'object') setRcptBrand(b);
    } catch { /* no brand */ }
  }, []);

  // Populate form from loaded vehicle
  useEffect(() => {
    if (!vehicle || loaded) return;
    setLoaded(true);
    const feats = Array.isArray(vehicle.features)
      ? vehicle.features.map((f) => (typeof f === 'string' ? f : f.feature))
      : [];
    setForm({
      vin: vehicle.vin || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: String(vehicle.year || 2025),
      trim: vehicle.trim || '',
      mileage: vehicle.mileage ? String(vehicle.mileage) : '',
      color: vehicle.color || '',
      bodyType: vehicle.bodyType || '',
      condition: (vehicle.condition as '' | 'NEW' | 'USED') || 'NEW',
      engineType: vehicle.engineSize || '',
      transmission: vehicle.transmission || '',
      fuelType: vehicle.fuelType || '',
      doors: vehicle.doors ? String(vehicle.doors) : '',
      seats: vehicle.seats ? String(vehicle.seats) : '',
      hp: vehicle.hp ? String(vehicle.hp) : '',
      torque: vehicle.torque ? String(vehicle.torque) : '',
      driveType: vehicle.driveType || '',
      gearType: vehicle.gearType || '',
      features: feats,
      acquisitionCost: (vehicle.cost ?? vehicle.acquisitionCost) != null ? String(vehicle.cost ?? vehicle.acquisitionCost) : '',
      ourProfit: vehicle.ourProfit ? String(vehicle.ourProfit) : '',
      newOverprice: vehicle.overprice ? String(vehicle.overprice) : '',
      salePrice: (vehicle.salePrice ?? vehicle.price) != null ? String(vehicle.salePrice ?? vehicle.price) : '',
      adminFeeOverride: vehicle.adminFeeOverride ? String(vehicle.adminFeeOverride) : '',
      insuranceFeeOverride: vehicle.insuranceFeeOverride ? String(vehicle.insuranceFeeOverride) : '',
      locationId: vehicle.locationId || '',
      status: vehicle.status || 'AVAILABLE',
      accreditedDealerId: vehicle.accreditedDealerId || '',
      ownershipType: (vehicle.ownershipType as 'OWNED' | 'CONSIGNMENT' | 'THIRD_PARTY_SALE') || 'OWNED',
    });
    if (vehicle.condition === 'USED') {
      setUsedForm({
        regLicenseNumber: vehicle.regLicenseNumber || '',
        licenseExpiryDate: vehicle.licenseExpiryDate
          ? vehicle.licenseExpiryDate.slice(0, 10)
          : '',
        accidentHistory: typeof vehicle.accidentHistory === 'string' ? vehicle.accidentHistory : '',
        affectedParts: vehicle.affectedParts || '',
        engineChanged: vehicle.engineChanged || false,
        newEngineNumber: vehicle.newEngineNumber || '',
        customerAskingPrice: vehicle.customerAskingPrice ? String(vehicle.customerAskingPrice) : '',
        minimumAskingPrice: vehicle.minimumAskingPrice ? String(vehicle.minimumAskingPrice) : '',
        overprice: vehicle.overprice ? String(vehicle.overprice) : '',
        engineConditionPct: vehicle.engineConditionPct ? String(vehicle.engineConditionPct) : '',
        transmissionConditionPct: vehicle.transmissionConditionPct ? String(vehicle.transmissionConditionPct) : '',
      });
    }
    if (vehicle.images?.length) {
      const sorted = [...vehicle.images].sort((a, b) => a.order - b.order);
      setPhotos(sorted.map((img) => ({ src: img.url })));
    }
  }, [vehicle, loaded]);

  const STEP_LABELS_AR: Record<string, string> = {
    'Basic Info': 'المعلومات الأساسية',
    'Used Vehicle Details': 'تفاصيل السيارة المستعملة',
    'Specs & Features': 'المواصفات والمميزات',
    'Pricing & Location': 'التسعير',
    'Upload Photos': 'الصور',
    'Documents': 'المستندات',
    'Receiving Checklist': 'استلام السيارة',
    'Review & Save': 'مراجعة وحفظ',
  };
  const sl = (label: string) => isAr ? (STEP_LABELS_AR[label] ?? label) : label;

  const { data: locationsRaw } = useQuery<Location[]>('/locations');
  const locations: Location[] = Array.isArray(locationsRaw) ? locationsRaw : [];
  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name + (l.city ? ` — ${l.city}` : ''),
  }));
  const selectedLocation = locations.find((l) => l.id === form.locationId);

  type LI = { id: string; value: string; label: string; labelAr?: string };
  const { data: rawColors }          = useQuery<LI[]>('/lookup-items?category=car_color');
  const { data: rawBodyTypes }       = useQuery<LI[]>('/lookup-items?category=body_type');
  const { data: rawFuelTypes }       = useQuery<LI[]>('/lookup-items?category=fuel_type');
  const { data: rawTransmissions }   = useQuery<LI[]>('/lookup-items?category=transmission');
  const { data: rawGearTypes }       = useQuery<LI[]>('/lookup-items?category=gear_type');
  const { data: rawVehicleFeatures } = useQuery<LI[]>('/lookup-items?category=vehicle_feature');
  const toOpts = (r: LI[] | null | undefined) =>
    (Array.isArray(r) ? r : []).map((i) => ({ value: i.value, label: isAr ? (i.labelAr || i.label) : i.label }));
  const COLORS        = toOpts(rawColors);
  const BODY_TYPES    = toOpts(rawBodyTypes);
  const FUEL_TYPES    = toOpts(rawFuelTypes);
  const TRANSMISSIONS = toOpts(rawTransmissions);
  const GEAR_TYPES    = toOpts(rawGearTypes);
  const DYNAMIC_FEATURES = Array.isArray(rawVehicleFeatures) ? rawVehicleFeatures : [];

  interface CMake { id: string; name: string; }
  interface CModel { id: string; name: string; }
  const { data: rawCarMakes } = useQuery<CMake[]>('/settings/car-makes');
  const carMakes = Array.isArray(rawCarMakes) ? rawCarMakes : [];
  const selectedCarMake = carMakes.find((m) => m.name === form.make) ?? null;
  const { data: rawCarModels } = useQuery<CModel[]>(
    selectedCarMake ? `/settings/car-makes/${selectedCarMake.id}/models` : null,
    [selectedCarMake?.id],
  );
  const carModels = Array.isArray(rawCarModels) ? rawCarModels : [];
  const MAKE_OPTS  = carMakes.map((m) => ({ value: m.name, label: m.name }));
  const MODEL_OPTS = carModels.map((m) => ({ value: m.name, label: m.name }));

  const isUsed      = form.condition === 'USED';
  const STEPS       = isUsed ? STEPS_USED : STEPS_NEW;
  const totalSteps  = STEPS.length;

  const isBasicInfo     = step === 1;
  const isUsedDetails   = isUsed && step === 2;
  const isSpecsFeatures = (isUsed && step === 3) || (!isUsed && step === 2);
  const isPricing       = (isUsed && step === 4) || (!isUsed && step === 3);
  const isPhotos        = (isUsed && step === 5) || (!isUsed && step === 4);
  const isDocs          = (isUsed && step === 6) || (!isUsed && step === 5);
  const isCarReceiving  = (isUsed && step === 7) || (!isUsed && step === 6);
  const isReview        = (isUsed && step === 8) || (!isUsed && step === 7);

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

  function validateStep(s: number): string {
    if (s === 1) {
      if (!form.make) return isAr ? 'الماركة مطلوبة.' : 'Make is required.';
      if (!form.model) return isAr ? 'الموديل مطلوب.' : 'Model is required.';
      if (!form.color) return isAr ? 'اللون مطلوب.' : 'Color is required.';
      if (!form.bodyType) return isAr ? 'نوع الشاسيه مطلوب.' : 'Body Type is required.';
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

  function next() {
    const e = validateStep(step);
    if (e) { setErr(e); return; }
    setErr('');
    if (isUsed && step === 3) {
      setForm((p) => {
        const acq = p.acquisitionCost || usedForm.customerAskingPrice;
        const computedSale = acq && usedForm.overprice ? String(Number(acq) + Number(usedForm.overprice)) : acq || '';
        const sale = p.salePrice || computedSale;
        return { ...p, acquisitionCost: acq, salePrice: sale };
      });
    }
    setStep((s) => s + 1);
  }

  function back() { setErr(''); setStep((s) => s - 1); }

  async function save() {
    setSaving(true);
    setErr('');
    try {
      const body: Record<string, unknown> = {
        make: form.make, model: form.model, year: Number(form.year),
        color: form.color, bodyType: form.bodyType, condition: form.condition,
        price: Number(form.salePrice), locationId: form.locationId, status: form.status,
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
        ...(!isUsed && form.newOverprice && { overprice: Number(form.newOverprice) }),
        ...(!isUsed && form.ourProfit && { ourProfit: Number(form.ourProfit) }),
        ...(form.adminFeeOverride && { adminFeeOverride: Number(form.adminFeeOverride) }),
        ...(form.insuranceFeeOverride && { insuranceFeeOverride: Number(form.insuranceFeeOverride) }),
        ...(form.features.length && { features: form.features }),
        ...(form.accreditedDealerId && { accreditedDealerId: form.accreditedDealerId }),
        ownershipType: form.ownershipType,
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
      await apiFetch(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

      // Upload only new photos (those with a file object)
      const token = typeof window !== 'undefined' ? (localStorage.getItem('accessToken') ?? '') : '';
      const newPhotos = photos.filter((p) => p.file);
      for (let i = 0; i < newPhotos.length; i++) {
        const p = newPhotos[i];
        let url = p.src;
        const fd = new FormData();
        fd.append('file', p.file!);
        const res = await fetch(`${API_BASE}/upload/file`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        }).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => null);
          url = data?.url ?? url;
        }
        await apiFetch(`/vehicles/${id}/images`, {
          method: 'POST',
          body: JSON.stringify({ url, order: photos.length - newPhotos.length + i }),
        }).catch(() => {});
      }

      router.push('/vehicles');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle() {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذه المركبة؟ لا يمكن التراجع.' : 'Delete this vehicle? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await apiFetch(`/vehicles/${id}`, { method: 'DELETE' });
      router.push('/vehicles');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
    }
  }

  // Loading / error states
  if (vehicleLoading) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Link href="/vehicles" style={{ color: 'var(--text-3)', fontSize: '0.75rem', textDecoration: 'none' }}>{isAr ? 'السيارات' : 'Vehicles'}</Link>
              <span style={{ color: 'var(--text-3)' }}>/</span>
              <span style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{isAr ? 'تحميل…' : 'Loading…'}</span>
            </div>
            <h1 className="page-title">{isAr ? 'تعديل المركبة' : 'Edit Vehicle'}</h1>
          </div>
        </div>
        <div className="page-body">
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
            {isAr ? 'جارٍ تحميل بيانات المركبة…' : 'Loading vehicle data…'}
          </div>
        </div>
      </div>
    );
  }

  if (vehicleError || !vehicle) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
        <div className="page-header">
          <div>
            <Link href="/vehicles" style={{ color: 'var(--text-3)', fontSize: '0.75rem', textDecoration: 'none' }}>← {isAr ? 'العودة' : 'Back'}</Link>
            <h1 className="page-title">{isAr ? 'مركبة غير موجودة' : 'Vehicle Not Found'}</h1>
          </div>
        </div>
        <div className="page-body">
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)', fontSize: '0.8125rem' }}>
            {vehicleError || (isAr ? 'لم يتم العثور على المركبة.' : 'Vehicle not found.')}
          </div>
        </div>
      </div>
    );
  }

  const vehicleTitle = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');

  return (
    <>
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href="/vehicles" style={{ color: 'var(--text-3)', fontSize: '0.75rem', textDecoration: 'none' }}>{isAr ? 'السيارات' : 'Vehicles'}</Link>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{vehicleTitle || id}</span>
          </div>
          <h1 className="page-title">{isAr ? `تعديل: ${vehicleTitle}` : `Edit: ${vehicleTitle}`}</h1>
          <p className="page-subtitle">
            {isAr ? 'عدّل بيانات المركبة في الخطوات أدناه' : 'Update vehicle details across the steps below'}
          </p>
        </div>
        {canDelete && (
          <button
            className="btn btn-danger btn-sm"
            onClick={deleteVehicle}
            disabled={deleting}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            {deleting ? (isAr ? 'جارٍ الحذف…' : 'Deleting…') : (isAr ? 'حذف المركبة' : 'Delete Vehicle')}
          </button>
        )}
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem', alignItems: 'start' }}>
          {/* Main content */}
          <div>
            {/* Step header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '1rem', padding: '0.875rem 1.25rem',
              background: 'var(--surface)', borderRadius: '0.625rem', border: '1px solid var(--border)',
            }}>
              <div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                  {isAr ? `الخطوة ${step} من ${totalSteps}` : `Step ${step} of ${totalSteps}`}
                </p>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)' }}>
                  {sl(STEPS[step - 1]?.label ?? '')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {STEPS.map((s) => (
                  <div key={s.n} style={{
                    width: '28px', height: '4px', borderRadius: '2px',
                    background: s.n <= step ? 'var(--primary)' : 'var(--surface-2)',
                    transition: 'background 200ms',
                  }} />
                ))}
              </div>
            </div>

            {err && (
              <div style={{
                padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem',
                background: 'var(--danger-bg)', border: '1px solid var(--danger)',
                color: 'var(--danger-fg)', fontSize: '0.8125rem',
              }}>
                {err}
              </div>
            )}

            {/* ── STEP: Basic Info ───────────────────────────────────────── */}
            {isBasicInfo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'معلومات التعريف' : 'Identification'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">{isAr ? 'رقم الشاسيه (VIN)' : 'VIN'}</label>
                      <input
                        className="input"
                        value={form.vin}
                        readOnly
                        style={{ fontFamily: 'monospace', opacity: 0.7, cursor: 'not-allowed', background: 'var(--surface-2)' }}
                      />
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                        {isAr ? 'رقم الشاسيه لا يمكن تغييره بعد الإضافة.' : 'VIN cannot be changed after creation.'}
                      </p>
                    </div>

                    <div>
                      <label className="input-label">{isAr ? 'الشركة المصنعة' : 'Make'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <SearchableCombobox options={MAKE_OPTS} value={form.make} onChange={(v) => { set('make', v); set('model', ''); }} placeholder={isAr ? 'اختر الشركة…' : 'Select make…'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الطراز' : 'Model'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <SearchableCombobox options={MODEL_OPTS} value={form.model} onChange={(v) => set('model', v)} placeholder={isAr ? 'اختر الطراز…' : 'Select model…'} disabled={!form.make} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'سنة الصنع' : 'Year'}</label>
                      <SearchableCombobox options={YEARS} value={form.year} onChange={(v) => set('year', v)} placeholder={isAr ? 'اختر السنة…' : 'Select year…'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الفئة / الإصدار' : 'Trim / Variant'}</label>
                      <input className="input" value={form.trim} onChange={(e) => set('trim', e.target.value)} placeholder="e.g. Sport, Limited, Luxury" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'اللون' : 'Color'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <SearchableCombobox options={COLORS} value={form.color} onChange={(v) => set('color', v)} placeholder={isAr ? 'اختر اللون…' : 'Select color…'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'نوع الهيكل' : 'Body Type'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <SearchableCombobox options={BODY_TYPES} value={form.bodyType} onChange={(v) => set('bodyType', v)} placeholder={isAr ? 'اختر…' : 'Select…'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'عداد الكيلومترات' : 'Mileage (km)'}</label>
                      <NumericInput className="input" value={form.mileage} onChange={(v) => set('mileage', v)} placeholder="0" min={0} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الحالة' : 'Condition'}</label>
                      <input
                        className="input"
                        value={isAr ? (form.condition === 'NEW' ? 'جديدة' : form.condition === 'USED' ? 'مستعملة' : form.condition) : (form.condition || '—')}
                        readOnly
                        style={{ opacity: 0.7, cursor: 'not-allowed', background: 'var(--surface-2)' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'الملكية والوكيل' : 'Ownership & Dealer'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'نوع الملكية' : 'Ownership Type'}</label>
                      <SearchableCombobox
                        options={[
                          { value: 'OWNED', label: isAr ? 'مملوكة للوكالة' : 'Owned by Dealership' },
                          { value: 'CONSIGNMENT', label: isAr ? 'أمانة' : 'Consignment' },
                          { value: 'THIRD_PARTY_SALE', label: isAr ? 'بيع لصالح طرف ثالث' : 'Third-Party Sale' },
                        ]}
                        value={form.ownershipType}
                        onChange={(v) => set('ownershipType', v)}
                        placeholder={isAr ? 'اختر…' : 'Select…'}
                      />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الوكيل المعتمد' : 'Accredited Dealer'}</label>
                      <SearchableCombobox
                        options={[
                          { value: '', label: isAr ? 'بدون وكيل' : 'No Dealer' },
                          ...dealers.map((d) => ({ value: d.id, label: d.name })),
                        ]}
                        value={form.accreditedDealerId}
                        onChange={(v) => set('accreditedDealerId', v)}
                        placeholder={isAr ? 'اختر الوكيل…' : 'Select dealer…'}
                        clearable
                        clearLabel={isAr ? 'بدون وكيل' : 'No Dealer'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: Used Vehicle Details ─────────────────────────────── */}
            {isUsedDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'بيانات الترخيص' : 'Registration Details'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'رقم رخصة التسجيل' : 'Reg. License Number'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input className="input" value={usedForm.regLicenseNumber} onChange={(e) => setU('regLicenseNumber', e.target.value)} placeholder="e.g. 12345 / ق ص م" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'تاريخ انتهاء الرخصة' : 'License Expiry Date'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input className="input" type="date" value={usedForm.licenseExpiryDate} onChange={(e) => setU('licenseExpiryDate', e.target.value)} />
                      {months !== null && (
                        <p style={{ fontSize: '0.6875rem', color: months <= 3 ? 'var(--danger-fg)' : 'var(--text-3)', marginTop: '0.25rem' }}>
                          {isAr ? `${months} أشهر متبقية` : `${months} month${months !== 1 ? 's' : ''} remaining`}
                        </p>
                      )}
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">{isAr ? 'تاريخ الحوادث والطلاء' : 'Accident / Paint History'}</label>
                      <textarea
                        className="input"
                        value={usedForm.accidentHistory}
                        onChange={(e) => setU('accidentHistory', e.target.value)}
                        placeholder={isAr ? 'صِف أي حوادث أو أعمال طلاء سابقة…' : 'Describe any prior accidents or paint work…'}
                        rows={3}
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الأجزاء المتضررة' : 'Affected Parts'}</label>
                      <input className="input" value={usedForm.affectedParts} onChange={(e) => setU('affectedParts', e.target.value)} placeholder={isAr ? 'مثال: الباب الأمامي الأيسر، الكابوت' : 'e.g. Left front door, hood'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'سعر طلب العميل (جنيه)' : 'Customer Asking Price (EGP)'}</label>
                      <NumericInput className="input" value={usedForm.customerAskingPrice} onChange={(v) => setU('customerAskingPrice', v)} placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الحد الأدنى للسعر (جنيه)' : 'Minimum Asking Price (EGP)'}</label>
                      <NumericInput className="input" value={usedForm.minimumAskingPrice} onChange={(v) => setU('minimumAskingPrice', v)} placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'أوفر برايس (جنيه)' : 'Overprice (EGP)'}</label>
                      <NumericInput className="input" value={usedForm.overprice} onChange={(v) => setU('overprice', v)} placeholder="0" />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'تاريخ المحرك' : 'Engine History'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={usedForm.engineChanged}
                          onChange={(e) => setU('engineChanged', e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-1)' }}>{isAr ? 'تم تغيير المحرك' : 'Engine has been changed'}</span>
                      </label>
                    </div>
                    {usedForm.engineChanged && (
                      <div>
                        <label className="input-label">{isAr ? 'رقم المحرك الجديد' : 'New Engine Number'}</label>
                        <input className="input" value={usedForm.newEngineNumber} onChange={(e) => setU('newEngineNumber', e.target.value)} placeholder="Engine serial number" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: Specs & Features ──────────────────────────────────── */}
            {isSpecsFeatures && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'المواصفات الفنية' : 'Technical Specifications'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'نوع المحرك / السعة' : 'Engine Type / Size'}</label>
                      <input className="input" value={form.engineType} onChange={(e) => set('engineType', e.target.value)} placeholder="e.g. 2.0L Turbo, V6" />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'القوة (حصان)' : 'Horsepower (HP)'}</label>
                      <NumericInput className="input" value={form.hp} onChange={(v) => set('hp', v)} placeholder="e.g. 180" min={1} max={2000} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'عزم الدوران (نيوتن/متر)' : 'Torque (N·m)'}</label>
                      <NumericInput className="input" value={form.torque} onChange={(v) => set('torque', v)} placeholder="e.g. 250" min={1} max={2000} />
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
                            <label key={v} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                              fontSize: '0.8125rem', color: 'var(--text-1)', padding: '0.5rem 0.875rem',
                              borderRadius: '0.4rem',
                              border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                              background: active ? 'var(--info-bg)' : 'var(--surface)', transition: 'all 150ms',
                            }}>
                              <input type="radio" name="driveType" checked={active} onChange={() => set('driveType', v)} style={{ accentColor: 'var(--primary)' }} />
                              {l}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {isUsed && (
                      <>
                        <ConditionPctField label={isAr ? 'حالة المحرك (%)' : 'Engine Condition (%)'} value={usedForm.engineConditionPct} onChange={(v) => setU('engineConditionPct', v)} />
                        <ConditionPctField label={isAr ? 'حالة ناقل الحركة (%)' : 'Transmission Condition (%)'} value={usedForm.transmissionConditionPct} onChange={(v) => setU('transmissionConditionPct', v)} />
                      </>
                    )}

                    <div>
                      <label className="input-label">{isAr ? 'الأبواب' : 'Doors'}</label>
                      <NumericInput className="input" value={form.doors ?? ''} onChange={(val) => set('doors', val)} placeholder="e.g. 4" min={2} max={6} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'المقاعد' : 'Seats'}</label>
                      <NumericInput className="input" value={form.seats ?? ''} onChange={(val) => set('seats', val)} placeholder="e.g. 5" min={2} max={9} />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'المميزات والإضافات' : 'Features & Options'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {(DYNAMIC_FEATURES.length > 0
                      ? DYNAMIC_FEATURES
                      : FEATURES_LIST.map((f) => ({ value: f, label: f, labelAr: undefined as string | undefined }))
                    ).map((f) => {
                      const fVal = typeof f === 'string' ? f : f.value;
                      const fLabel = typeof f === 'string' ? f : f.label;
                      const fLabelAr = (f as { labelAr?: string }).labelAr;
                      const checked = form.features.includes(fVal);
                      return (
                        <label key={fVal} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                          fontSize: '0.8125rem', color: 'var(--text-1)', padding: '0.5rem 0.75rem',
                          borderRadius: '0.4rem',
                          border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                          background: checked ? 'var(--info-bg)' : 'var(--surface)', transition: 'all 150ms',
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleFeature(fVal)} style={{ accentColor: 'var(--primary)', width: '14px', height: '14px' }} />
                          {isAr ? (fLabelAr || FEATURES_AR[fLabel] || fLabel) : fLabel}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: Pricing & Location ───────────────────────────────── */}
            {isPricing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'التسعير' : 'Pricing'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'تكلفة الاقتناء (جنيه)' : 'Acquisition Cost (EGP)'}</label>
                      <NumericInput className="input" value={form.acquisitionCost}
                        onChange={(acq) => {
                          const op = form.newOverprice; const pr = form.ourProfit;
                          setForm((f) => ({ ...f, acquisitionCost: acq, ...(!isUsed && acq ? { salePrice: String((Number(acq) || 0) + (Number(pr) || 0) + (Number(op) || 0)) } : {}) }));
                        }}
                        placeholder="0"
                      />
                    </div>

                    {!isUsed && (
                      <>
                        <div>
                          <label className="input-label">{isAr ? 'ربحنا (جنيه)' : 'Our Profit (EGP)'}</label>
                          <NumericInput className="input" value={form.ourProfit}
                            onChange={(pr) => {
                              const acq = form.acquisitionCost; const op = form.newOverprice;
                              setForm((f) => ({ ...f, ourProfit: pr, ...(acq ? { salePrice: String((Number(acq) || 0) + (Number(pr) || 0) + (Number(op) || 0)) } : {}) }));
                            }}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="input-label">{isAr ? 'أوفر برايس (جنيه)' : 'Overprice (EGP)'}</label>
                          <NumericInput className="input" value={form.newOverprice}
                            onChange={(op) => {
                              const acq = form.acquisitionCost; const pr = form.ourProfit;
                              setForm((f) => ({ ...f, newOverprice: op, ...(acq ? { salePrice: String((Number(acq) || 0) + (Number(pr) || 0) + (Number(op) || 0)) } : {}) }));
                            }}
                            placeholder="0"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="input-label">{isAr ? 'سعر البيع (جنيه)' : 'Listed Sale Price (EGP)'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <NumericInput className="input" value={form.salePrice} onChange={(val) => set('salePrice', val)} placeholder="0"
                        readOnly={!isUsed && !!(form.acquisitionCost)}
                        style={!isUsed && form.acquisitionCost ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                      />
                      {!isUsed && form.acquisitionCost && (
                        <p style={{ fontSize: '0.6875rem', color: 'var(--success-fg)', marginTop: '0.25rem' }}>{isAr ? 'محسوب تلقائياً' : 'Auto-calculated'}</p>
                      )}
                    </div>
                  </div>
                  {margin > 0 && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'var(--success-bg)', border: '1px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 500 }}>{isAr ? 'هامش الربح الإجمالي' : 'Gross Profit Margin'}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 700 }}>{fmt(margin)} ({marginPct.toFixed(1)}%)</span>
                    </div>
                  )}
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'الرسوم التنظيمية المصرية' : 'Egypt Regulatory Fees'}</p>
                  <div style={{ padding: '0.625rem 0.875rem', borderRadius: '0.4rem', background: 'var(--warning-bg)', border: '1px solid var(--warning)', fontSize: '0.75rem', color: 'var(--warning-fg)', marginBottom: '1rem' }}>
                    {isAr ? 'اتركه فارغاً لاستخدام الإعداد الافتراضي للفرع.' : 'Leave blank to use the branch default.'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'الرسوم الإدارية (جنيه)' : 'Administration Fee (EGP)'}</label>
                      <NumericInput className="input" value={form.adminFeeOverride} onChange={(val) => set('adminFeeOverride', val)}
                        placeholder={selectedLocation?.defaultAdminFee ? `${Number(selectedLocation.defaultAdminFee).toLocaleString()} (${isAr ? 'افتراضي' : 'Default'})` : `3,500 (${isAr ? 'افتراضي' : 'Default'})`}
                      />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'التأمين الإلزامي (جنيه)' : 'Compulsory Insurance (EGP)'}</label>
                      <NumericInput className="input" value={form.insuranceFeeOverride} onChange={(val) => set('insuranceFeeOverride', val)}
                        placeholder={selectedLocation?.defaultInsuranceFee ? `${Number(selectedLocation.defaultInsuranceFee).toLocaleString()} (${isAr ? 'افتراضي' : 'Default'})` : `4,800 (${isAr ? 'افتراضي' : 'Default'})`}
                      />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <p className="section-label">{isAr ? 'تعيين الفرع' : 'Branch Assignment'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="input-label">{isAr ? 'الفرع' : 'Location'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <SearchableCombobox options={locationOptions} value={form.locationId} onChange={(v) => set('locationId', v)} placeholder={isAr ? 'اختر الفرع…' : 'Select branch…'} />
                    </div>
                    <div>
                      <label className="input-label">{isAr ? 'الحالة' : 'Status'}</label>
                      <SearchableCombobox options={INITIAL_STATUSES} value={form.status} onChange={(v) => set('status', v)} placeholder={isAr ? 'اختر الحالة…' : 'Select status…'} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: Upload Photos ─────────────────────────────────────── */}
            {isPhotos && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <p className="section-label">{isAr ? 'صور السيارة' : 'Vehicle Photos'}</p>
                <input ref={photoFileRef} type="file" multiple accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files?.length) addPhotoFiles(e.target.files); e.target.value = ''; }}
                />
                <div
                  onClick={() => photoFileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addPhotoFiles(e.dataTransfer.files); }}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border-strong)'}`,
                    borderRadius: '0.75rem', padding: '2.5rem', textAlign: 'center',
                    background: dragOver ? 'var(--info-bg)' : 'var(--surface-2)', marginBottom: '1.25rem',
                    cursor: 'pointer', transition: 'border-color 150ms, background 150ms',
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
                    {dragOver ? (isAr ? 'أفلت الصور هنا' : 'Drop photos here') : (isAr ? 'انقر للرفع أو اسحب وأفلت' : 'Click to upload or drag and drop')}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {isAr ? 'PNG، JPG، WebP — الصورة الأولى هي الصورة الرئيسية.' : 'PNG, JPG, WebP — First image is the primary photo.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input className="input" value={photoInput} onChange={(e) => setPhotoInput(e.target.value)}
                    placeholder={isAr ? 'أو الصق رابط الصورة…' : 'Or paste image URL…'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && photoInput.trim()) {
                        e.preventDefault();
                        setPhotos((p) => [...p, { src: photoInput.trim() }]);
                        setPhotoInput('');
                      }
                    }}
                  />
                  <button type="button" className="btn btn-secondary" disabled={!photoInput.trim()}
                    onClick={() => { if (!photoInput.trim()) return; setPhotos((p) => [...p, { src: photoInput.trim() }]); setPhotoInput(''); }}
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
                          <button type="button" onClick={() => removePhoto(i)}
                            style={{ width: '22px', height: '22px', borderRadius: '9999px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >×</button>
                        </div>
                        {i > 0 && (
                          <button type="button" onClick={() => setPrimaryPhoto(i)}
                            style={{ position: 'absolute', bottom: '0.4rem', left: '0.4rem', fontSize: '0.625rem', padding: '0.15rem 0.4rem', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                          >{isAr ? 'تعيين كرئيسية' : 'Set as Primary'}</button>
                        )}
                        {p.file && (
                          <div style={{ position: 'absolute', bottom: '0.4rem', right: '0.4rem', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} title={isAr ? 'صورة جديدة — سيتم رفعها' : 'New photo — will be uploaded'} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem 0' }}>
                    {isAr ? 'لا توجد صور حالياً. أضف صوراً جديدة.' : 'No photos currently. Add new photos.'}
                  </p>
                )}
              </div>
            )}

            {/* ── STEP: Documents ─────────────────────────────────────────── */}
            {isDocs && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'وثائق السيارة' : 'Vehicle Documents'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {DOC_SLOTS_BASE.map((slot) => {
                    const file = docs[slot.key];
                    const slotLabel = isAr ? (DOC_LABELS_AR[slot.label] ?? slot.label) : slot.label;
                    return (
                      <div key={slot.key} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.875rem 1rem', borderRadius: '0.5rem',
                        border: `1px solid ${file ? 'var(--success)' : 'var(--border)'}`,
                        background: file ? 'var(--success-bg)' : 'var(--surface)',
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontWeight: 500 }}>{slotLabel}</span>
                          <p style={{ fontSize: '0.75rem', color: file ? 'var(--success-fg)' : 'var(--text-3)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                            {file ? file.name : (isAr ? 'لم يُختر ملف' : 'No file selected')}
                          </p>
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

            {/* ── STEP: Car Receiving Checklist ───────────────────────────── */}
            {isCarReceiving && (() => {
              const today = new Date().toISOString();
              const vehicleDesc = [form.year, form.make, form.model, form.trim].filter(Boolean).join(' ');
              const totalItems = CRV_CHECKLIST.reduce((s, c) => s + c.items.length, 0);
              const checkedItems = CRV_CHECKLIST.reduce((s, c) => s + c.items.filter((_, i) => rcptChecked[`${c.en}-${i}`]).length, 0);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{isAr ? 'استمارة استلام السيارة' : 'Car Receiving Checklist'}</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
                        {isAr ? `تفحّص ${checkedItems} من ${totalItems} بند` : `${checkedItems} of ${totalItems} items checked`}
                      </p>
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      {isAr ? 'طباعة' : 'Print'}
                    </button>
                  </div>

                  <div className="car-recv-print card" style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', fontSize: '0.875rem', color: '#111' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '1rem', borderBottom: '2px solid #1a1a2e', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                      <div>
                        {rcptBrand.nameEn && <p style={{ fontWeight: 700, fontSize: '1rem' }}>{rcptBrand.nameEn}</p>}
                        <p style={{ fontSize: '0.8rem', color: '#555' }}>Car Receiving Checklist</p>
                        <p style={{ fontSize: '0.75rem', color: '#888' }}>Date / التاريخ: {crvDate(today)}</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {rcptBrand.logoUrl
                          ? <img src={rcptBrand.logoUrl} alt="logo" style={{ maxHeight: 60, maxWidth: 120, objectFit: 'contain' }} />
                          : <div style={{ width: 80, height: 48, border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#aaa' }}>LOGO</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {rcptBrand.nameAr && <p style={{ fontWeight: 700, fontSize: '1rem', fontFamily: CRV_FONT_HEADING, direction: 'rtl' }}>{rcptBrand.nameAr}</p>}
                        <p style={{ fontSize: '0.8rem', color: '#555', fontFamily: CRV_FONT_BODY, direction: 'rtl' }}>استمارة استلام السيارة</p>
                        <p style={{ fontSize: '0.75rem', color: '#888', fontFamily: CRV_FONT_BODY, direction: 'rtl' }}>{crvDateAr(today)}</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem 1.5rem', background: '#f8f8f8', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.25rem', border: '1px solid #e5e7eb' }}>
                      <RcptInfoRow label="Vehicle" labelAr="السيارة" value={vehicleDesc || '—'} />
                      <RcptInfoRow label="VIN" labelAr="رقم الشاسيه" value={form.vin || '—'} />
                      <RcptInfoRow label="Color" labelAr="اللون" value={form.color || '—'} />
                      <RcptInfoRow label="Year" labelAr="سنة الصنع" value={form.year ? String(form.year) : '—'} />
                      <RcptInfoRow label="Condition" labelAr="الحالة" value={form.condition || '—'} />
                      <RcptInfoRow label="Location" labelAr="الموقع" value={selectedLocation?.name || '—'} />
                    </div>

                    {CRV_CHECKLIST.map((cat) => (
                      <div key={cat.en} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: '#1a1a2e', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: '4px 4px 0 0' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{cat.en}</span>
                          <span style={{ fontFamily: CRV_FONT_HEADING, fontSize: '0.8125rem', direction: 'rtl' }}>{cat.ar}</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <tbody>
                            {cat.items.map((item, i) => {
                              const key = `${cat.en}-${i}`;
                              const checked = !!rcptChecked[key];
                              return (
                                <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ width: 32, textAlign: 'center', padding: '0.3rem 0.5rem' }}>
                                    <input type="checkbox" checked={checked} onChange={(e) => setRcptChecked((p) => ({ ...p, [key]: e.target.checked }))} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                                  </td>
                                  <td style={{ padding: '0.3rem 0.5rem', color: checked ? '#16a34a' : '#111' }}>{item.en}</td>
                                  <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontFamily: CRV_FONT_BODY, direction: 'rtl', color: checked ? '#16a34a' : '#111' }}>{item.ar}</td>
                                  <td style={{ width: 22, textAlign: 'center', fontSize: '0.9rem' }}>{checked ? '✓' : ''}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                      <p style={{ fontWeight: 600, marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Notes / Remarks</span>
                        <span style={{ fontFamily: CRV_FONT_BODY, direction: 'rtl', fontWeight: 600 }}>ملاحظات</span>
                      </p>
                      <div style={{ border: '1px solid #d1d5db', borderRadius: 4, height: 56 }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '0.5rem' }}>
                      <RcptSigBlock title="Receiving Officer" titleAr="ضابط الاستلام / موظف الصالة" fields={['Name / الاسم', 'Signature / التوقيع', 'Date / التاريخ']} />
                      <RcptSigBlock title="Supplier Representative" titleAr="مندوب المورد / جهة التسليم" fields={['Name / الاسم', 'Signature / التوقيع', 'Date / التاريخ']} />
                    </div>
                  </div>

                  <div className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{isAr ? 'تحديد / إلغاء الكل' : 'Select / deselect all'}</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                        onClick={() => { const all: Record<string, boolean> = {}; CRV_CHECKLIST.forEach((c) => c.items.forEach((_, i) => { all[`${c.en}-${i}`] = true; })); setRcptChecked(all); }}>
                        {isAr ? 'تحديد الكل' : 'Check all'}
                      </button>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }} onClick={() => setRcptChecked({})}>
                        {isAr ? 'إلغاء الكل' : 'Uncheck all'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── STEP: Review & Save ─────────────────────────────────────── */}
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

                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                  <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'التسعير والفرع' : 'Pricing & Location'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {([
                      [isAr ? 'تكلفة الاقتناء' : 'Acquisition Cost', form.acquisitionCost ? fmt(Number(form.acquisitionCost)) : '—'],
                      [isAr ? 'سعر البيع' : 'Sale Price', form.salePrice ? fmt(Number(form.salePrice)) : '—'],
                      [isAr ? 'الرسوم الإدارية' : 'Admin Fee', form.adminFeeOverride ? fmt(Number(form.adminFeeOverride)) : (isAr ? 'افتراضي الفرع' : 'Location Default')],
                      [isAr ? 'التأمين' : 'Insurance', form.insuranceFeeOverride ? fmt(Number(form.insuranceFeeOverride)) : (isAr ? 'افتراضي الفرع' : 'Location Default')],
                      [isAr ? 'الفرع' : 'Location', locationOptions.find((l) => l.value === form.locationId)?.label ?? '—'],
                      [isAr ? 'الحالة' : 'Status', INITIAL_STATUSES.find((s) => s.value === form.status)?.label ?? form.status],
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
                        <div style={{ width: '64px', height: '48px', borderRadius: '0.375rem', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-3)' }}>+{photos.length - 6}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nav buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div>
                {step > 1 ? (
                  <button className="btn btn-secondary" onClick={back}>{isAr ? '→ رجوع' : '← Back'}</button>
                ) : (
                  <Link href="/vehicles" className="btn btn-secondary">{isAr ? '→ قائمة السيارات' : '← Vehicle List'}</Link>
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
                  <button className="btn btn-primary" onClick={save} disabled={saving} style={{ minWidth: '140px' }}>
                    {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label">{isAr ? 'التقدم' : 'Progress'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {STEPS.map((s) => {
                  const done = step > s.n;
                  const active = step === s.n;
                  return (
                    <button key={s.n} onClick={() => { setErr(''); setStep(s.n); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'none', border: 'none', padding: '0.25rem 0', cursor: 'pointer', textAlign: 'left', width: '100%', borderRadius: '0.375rem' }}
                    >
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '9999px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--surface-2)',
                        border: `2px solid ${done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--border)'}`,
                      }}>
                        {done ? (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ) : (
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: active ? '#fff' : 'var(--text-3)' }}>{s.n}</span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8125rem', color: active ? 'var(--text-1)' : done ? 'var(--success-fg)' : 'var(--text-3)', fontWeight: active ? 600 : 400 }}>
                        {sl(s.label)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {((isUsed && step >= 4) || (!isUsed && step >= 3)) && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <p className="section-label">{isAr ? 'ملخص التسعير' : 'Pricing Summary'}</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { label: isAr ? 'السعر المعروض' : 'Listed Price', value: form.salePrice ? fmt(Number(form.salePrice)) : '—' },
                    { label: isAr ? 'تكلفة الاقتناء' : 'Acquisition Cost', value: form.acquisitionCost ? fmt(Number(form.acquisitionCost)) : '—' },
                    { label: isAr ? 'الرسوم الإدارية' : 'Admin Fee', value: form.adminFeeOverride ? fmt(Number(form.adminFeeOverride)) : (isAr ? 'افتراضي' : 'Default') },
                    { label: isAr ? 'التأمين الإلزامي' : 'Compulsory Insurance', value: form.insuranceFeeOverride ? fmt(Number(form.insuranceFeeOverride)) : (isAr ? 'افتراضي' : 'Default') },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
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

            <div style={{ padding: '1rem', borderRadius: '0.625rem', background: 'var(--info-bg)', border: '1px solid var(--info)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--info-fg)', marginBottom: '0.5rem' }}>{isAr ? 'نصائح' : 'Tips'}</p>
              <ul style={{ fontSize: '0.75rem', color: 'var(--info-fg)', lineHeight: 1.6, paddingLeft: '1rem', margin: 0 }}>
                {isBasicInfo && (isAr
                  ? <><li>الماركة والموديل واللون مطلوبون.</li><li>رقم الشاسيه لا يمكن تغييره.</li></>
                  : <><li>Make, model, and color are required.</li><li>VIN cannot be changed.</li></>
                )}
                {isUsedDetails && (isAr
                  ? <><li>رقم الرخصة مطلوب.</li><li>أفصح عن جميع الحوادث.</li></>
                  : <><li>Registration number is required.</li><li>Disclose all accidents.</li></>
                )}
                {isSpecsFeatures && (isAr
                  ? <><li>المميزات تساعد العملاء على الفلترة.</li></>
                  : <><li>Features help customers filter on the B2C site.</li></>
                )}
                {isPricing && (isAr
                  ? <><li>الرسوم الإدارية والتأمين افتراضية حسب الفرع.</li></>
                  : <><li>Admin fee and insurance default per-branch.</li></>
                )}
                {isPhotos && (isAr
                  ? <><li>الصور الجديدة (النقطة الزرقاء) سيتم رفعها عند الحفظ.</li><li>الصورة الأولى هي الصورة الرئيسية.</li></>
                  : <><li>New photos (blue dot) will be uploaded on save.</li><li>First photo is the primary listing image.</li></>
                )}
                {isReview && (isAr
                  ? <><li>راجع جميع التفاصيل قبل الحفظ.</li><li>يمكن تعديل البيانات مجدداً بعد الحفظ.</li></>
                  : <><li>Review all details before saving.</li><li>You can edit again after saving.</li></>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function ConditionPctField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const pct = Number(value) || 0;
  const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <label className="input-label">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <NumericInput className="input" min={0} max={100} value={value ?? ''} onChange={(val) => onChange(val)} placeholder="e.g. 80" style={{ width: '120px' }} />
        {value && (
          <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: '4px', background: color, transition: 'width 200ms' }} />
          </div>
        )}
        {value && <span style={{ fontSize: '0.8125rem', fontWeight: 600, color, minWidth: '2.5rem', textAlign: 'right' }}>{pct}%</span>}
      </div>
    </div>
  );
}

function RcptInfoRow({ label, labelAr, value }: { label: string; labelAr: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '0.68rem', color: '#888', marginBottom: 1, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span><span style={{ fontFamily: '"Cairo", sans-serif', direction: 'rtl' }}>{labelAr}</span>
      </p>
      <p style={{ fontWeight: 600, fontSize: '0.8rem', color: '#111' }}>{value}</p>
    </div>
  );
}

function RcptSigBlock({ title, titleAr, fields }: { title: string; titleAr: string; fields: string[] }) {
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{title}</span>
        <span style={{ fontFamily: '"Cairo", sans-serif', fontSize: '0.8rem', direction: 'rtl', fontWeight: 700 }}>{titleAr}</span>
      </div>
      {fields.map((f) => (
        <div key={f} style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#888', marginBottom: 2 }}>{f}</p>
          <div style={{ borderBottom: '1px solid #9ca3af', height: 24 }} />
        </div>
      ))}
    </div>
  );
}
