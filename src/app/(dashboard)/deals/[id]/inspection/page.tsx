'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '../../../../../lib/useApi';

// ── Font constants (match receipt pages) ──────────────────────────────────────
const FONT_AR_HEADING = '"Cairo", sans-serif';
const FONT_AR_BODY    = '"Times New Roman", Times, serif';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BrandState {
  logoUrl:       string;
  displayName:   string;
  displayNameAr: string;
  primaryColor:  string;
}

interface InspectionDeal {
  id: string;
  status: string;
  dealNumber?: string;
  createdAt: string;
  purchaseMethod: string;
  vehicle?: { make: string; model: string; year: number; vin?: string; color?: string };
  customer?: { name: string; phone?: string };
  salesRep?: { name: string };
  location?: { name: string; address?: string; city?: string; phone?: string };
}

// ── Checklist data ────────────────────────────────────────────────────────────
const CHECKLIST: { en: string; ar: string; items: { en: string; ar: string }[] }[] = [
  {
    en: 'Exterior',
    ar: 'المظهر الخارجي',
    items: [
      { en: 'Front bumper — no damage',              ar: 'المصد الأمامي — لا أضرار' },
      { en: 'Rear bumper — no damage',               ar: 'المصد الخلفي — لا أضرار' },
      { en: 'Hood / Bonnet',                         ar: 'الغطاء الأمامي (البونيه)' },
      { en: 'Boot / Trunk lid',                      ar: 'غطاء الصندوق الخلفي' },
      { en: 'Left front door',                       ar: 'الباب الأمامي الأيسر' },
      { en: 'Right front door',                      ar: 'الباب الأمامي الأيمن' },
      { en: 'Left rear door',                        ar: 'الباب الخلفي الأيسر' },
      { en: 'Right rear door',                       ar: 'الباب الخلفي الأيمن' },
      { en: 'Roof — no damage',                      ar: 'السقف — لا أضرار' },
      { en: 'Paint finish & color uniformity',       ar: 'جودة الدهان وتوحد اللون' },
      { en: 'Side mirrors — intact',                 ar: 'المرايا الجانبية — سليمة' },
      { en: 'Windshield — no chips or cracks',       ar: 'الزجاج الأمامي — خالٍ من الشقوق' },
      { en: 'Rear windshield',                       ar: 'الزجاج الخلفي' },
      { en: 'Side windows',                          ar: 'النوافذ الجانبية' },
      { en: 'Door seals & weather strips',           ar: 'عوازل الأبواب والحشوات' },
      { en: 'Grille & headlight surrounds',          ar: 'الشبكة الأمامية وإطارات المصابيح' },
    ],
  },
  {
    en: 'Interior',
    ar: 'المظهر الداخلي',
    items: [
      { en: 'Dashboard — no cracks or damage',       ar: 'لوحة التحكم — لا تشققات أو أضرار' },
      { en: 'Driver seat — condition OK',            ar: 'مقعد السائق — حالة جيدة' },
      { en: 'Front passenger seat',                  ar: 'مقعد الراكب الأمامي' },
      { en: 'Rear seats — all positions',            ar: 'المقاعد الخلفية — جميع المواضع' },
      { en: 'All seat belts — latch & retract',      ar: 'جميع أحزمة الأمان — تعمل' },
      { en: 'Interior trim & door panels',           ar: 'الإكساءات الداخلية وألواح الأبواب' },
      { en: 'Headliner / roof lining',               ar: 'بطانة السقف الداخلية' },
      { en: 'Floor mats — present & clean',          ar: 'سجادات الأرضية — موجودة ونظيفة' },
      { en: 'Steering wheel — no damage',            ar: 'عجلة القيادة — لا أضرار' },
      { en: 'Gear shift & center console',           ar: 'ذراع ناقل الحركة والكونسول الأوسط' },
      { en: 'Glove compartment',                     ar: 'حاوية المستندات (الدرج)' },
      { en: 'Sun visors',                            ar: 'واقيات الشمس' },
      { en: 'Interior cleanliness',                  ar: 'نظافة الداخلية العامة' },
    ],
  },
  {
    en: 'Mechanical',
    ar: 'الميكانيكا',
    items: [
      { en: 'Engine compartment — clean & dry',      ar: 'غرفة المحرك — نظيفة وجافة' },
      { en: 'Engine oil — level & condition',        ar: 'زيت المحرك — مستوى وجودة' },
      { en: 'Coolant level',                         ar: 'مستوى سائل التبريد' },
      { en: 'Brake fluid level',                     ar: 'مستوى سائل الفرامل' },
      { en: 'Power steering fluid',                  ar: 'سائل توجيه القوة' },
      { en: 'Windshield washer fluid',               ar: 'سائل غسيل الزجاج' },
      { en: 'All four tyres — tread depth OK',       ar: 'إطارات الأربع — عمق الفراغ مقبول' },
      { en: 'All four tyres — pressure correct',     ar: 'ضغط الإطارات الأربع — صحيح' },
      { en: 'Spare tyre — present & inflated',       ar: 'الإطار الاحتياطي — موجود ومضخوخ' },
      { en: 'Jack, wheel wrench & reflective kit',   ar: 'كريك وعدة الإطار والملحقات' },
      { en: 'Front brake pads — acceptable wear',    ar: 'تيل الفرامل الأمامية — بلى مقبول' },
      { en: 'Rear brakes',                           ar: 'الفرامل الخلفية' },
      { en: 'Exhaust — no leaks or unusual noise',   ar: 'العادم — لا تسريبات أو ضوضاء' },
    ],
  },
  {
    en: 'Electrical',
    ar: 'الكهرباء',
    items: [
      { en: 'Battery — condition & charge OK',       ar: 'البطارية — حالة وشحن جيد' },
      { en: 'Headlights — high & low beam',          ar: 'المصابيح الأمامية — عالية ومنخفضة' },
      { en: 'Tail lights & brake lights',            ar: 'مصابيح الخلف والفرامل' },
      { en: 'Reverse lights',                        ar: 'مصابيح الرجوع للخلف' },
      { en: 'Turn indicators — all four',            ar: 'إشارات الانعطاف — الأربع' },
      { en: 'Hazard lights',                         ar: 'أضواء الخطر' },
      { en: 'Interior & dome lights',                ar: 'الأضواء الداخلية' },
      { en: 'Horn',                                  ar: 'البوق' },
      { en: 'Wipers — front & rear',                 ar: 'المساحات الأمامية والخلفية' },
      { en: 'Washer jets — front & rear',            ar: 'فوهات غسيل الزجاج' },
      { en: 'Air conditioning — cooling',            ar: 'التكييف — تبريد جيد' },
      { en: 'Heater / climate control',              ar: 'التدفئة / التحكم المناخي' },
      { en: 'Audio / infotainment system',           ar: 'نظام الصوت والترفيه' },
      { en: 'GPS / navigation system',               ar: 'نظام الملاحة' },
      { en: 'Electric windows — all',                ar: 'النوافذ الكهربائية — جميعها' },
      { en: 'Central locking system',                ar: 'نظام القفل المركزي' },
      { en: 'Electric mirrors — adjust & fold',      ar: 'المرايا الكهربائية — تعديل وطي' },
      { en: 'Parking sensors / camera',              ar: 'حساسات الركن / كاميرا الخلفية' },
    ],
  },
  {
    en: 'Documents & Accessories',
    ar: 'المستندات والملحقات',
    items: [
      { en: 'Vehicle registration card',             ar: 'بطاقة تسجيل السيارة' },
      { en: "Owner's / user manual",                 ar: 'كتيب المالك / دليل المستخدم' },
      { en: 'Service / maintenance booklet',         ar: 'دفتر الصيانة' },
      { en: 'Main key(s)',                            ar: 'المفتاح الرئيسي' },
      { en: 'Spare key(s)',                           ar: 'المفتاح الاحتياطي' },
      { en: 'Smart key / remote fob',                ar: 'وحدة التحكم عن بُعد' },
      { en: 'Radio / head unit unlock code',         ar: 'كود فتح الراديو' },
      { en: 'Warranty card & terms',                 ar: 'بطاقة الضمان والشروط' },
      { en: 'Number plates — front & rear',          ar: 'لوحات الترقيم — أمام وخلف' },
    ],
  },
  {
    en: 'Safety Equipment',
    ar: 'معدات السلامة',
    items: [
      { en: 'Fire extinguisher — present & valid',   ar: 'طفاية الحريق — موجودة وصالحة' },
      { en: 'Warning triangles (×2)',                ar: 'مثلثات التحذير (×٢)' },
      { en: 'First aid kit',                         ar: 'حقيبة الإسعاف الأولي' },
      { en: 'Reflective safety vest',                ar: 'السترة العاكسة' },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateAr(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FinalInspectionPage() {
  const params  = useParams<{ id: string }>();
  const dealId  = params?.id ?? '';

  const { data: deal, loading, error } = useQuery<InspectionDeal>(`/deals/${dealId}`, [dealId]);

  const [brand, setBrand] = useState<BrandState>({
    logoUrl: '', displayName: '', displayNameAr: '', primaryColor: '#1a3a5c',
  });

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dealerms_brand');
      if (raw) setBrand({ ...{ logoUrl: '', displayName: '', displayNameAr: '', primaryColor: '#1a3a5c' }, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function toggle(key: string) {
    setChecked(p => ({ ...p, [key]: !p[key] }));
  }

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">جاري تحميل البيانات… / Loading…</div>;
  if (error || !deal) return <div className="p-8 text-center text-red-400 text-sm">خطأ في تحميل بيانات الصفقة. / Could not load deal.</div>;

  const companyName   = brand.displayName   || 'iCar Dealership';
  const companyNameAr = brand.displayNameAr || companyName;
  const today         = new Date().toISOString();
  const dealDateEn    = deal.createdAt ? fmtDate(deal.createdAt)   : fmtDate(today);
  const dealDateAr    = deal.createdAt ? fmtDateAr(deal.createdAt) : fmtDateAr(today);
  const vehicle       = deal.vehicle;
  const vehicleStr    = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '—';
  const vehicleStrAr  = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '—';
  const vinStr        = vehicle?.vin ?? '—';
  const custName      = deal.customer?.name ?? '—';
  const custPhone     = deal.customer?.phone ?? '';
  const salesRepName  = deal.salesRep?.name ?? '';
  const dealNo        = deal.dealNumber ?? deal.id.slice(-8).toUpperCase();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .inspection-page, .inspection-page * { visibility: visible !important; }
          .inspection-page {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          input[type="checkbox"] { -webkit-appearance: checkbox !important; appearance: checkbox !important; }
          @page { size: A4; margin: 12mm 10mm; }
        }
        @media screen { body { background: #111 !important; } }
      `}</style>

      {/* ── Toolbar (screen only) ── */}
      <div className="no-print flex items-center gap-3 p-4 border-b border-white/10 bg-gray-950 sticky top-0 z-10">
        <Link href={`/deals/${dealId}`} className="text-gray-400 hover:text-white text-sm transition">← Back to Deal</Link>
        <span className="text-gray-600 text-sm">|</span>
        <span className="text-white text-sm font-medium">Final Inspection — {dealNo}</span>
        <span className="flex-1" />
        <button
          onClick={() => window.print()}
          className="btn btn-primary btn-sm"
          style={{ background: brand.primaryColor, borderColor: brand.primaryColor }}
        >
          🖨 Print / طباعة
        </button>
      </div>

      {/* ── Inspection sheet ── */}
      <div
        className="inspection-page mx-auto my-8 max-w-[210mm] bg-white text-gray-900 shadow-2xl"
        style={{ padding: '10mm 12mm', fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif', '--rp': brand.primaryColor } as React.CSSProperties}
      >

        {/* ── Letterhead ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '5mm', marginBottom: '5mm', borderBottom: '2px solid var(--rp)', paddingBottom: '4mm' }}>
          {/* EN info */}
          <div style={{ direction: 'ltr' }}>
            <div style={{ fontWeight: 700, fontSize: '4.5mm', color: 'var(--rp)', lineHeight: 1.2 }}>{companyName}</div>
            {deal.location?.address && <div style={{ fontSize: '2.8mm', color: '#555', marginTop: '0.5mm' }}>{deal.location.address}{deal.location.city ? `, ${deal.location.city}` : ''}</div>}
            {deal.location?.phone   && <div style={{ fontSize: '2.8mm', color: '#555' }}>Tel: {deal.location.phone}</div>}
          </div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {brand.logoUrl
              ? <img src={brand.logoUrl} alt="logo" style={{ height: '16mm', width: 'auto', objectFit: 'contain' }} />
              : <div style={{ width: '16mm', height: '16mm', borderRadius: '3mm', background: 'var(--rp)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontWeight: 700, fontSize: '5mm' }}>iC</span></div>
            }
          </div>
          {/* AR info */}
          <div style={{ textAlign: 'right', direction: 'rtl', fontFamily: FONT_AR_BODY }}>
            <div style={{ fontWeight: 700, fontSize: '4.5mm', color: 'var(--rp)', lineHeight: 1.2, fontFamily: FONT_AR_HEADING }}>{companyNameAr}</div>
            {deal.location?.address && <div style={{ fontSize: '2.8mm', color: '#555', marginTop: '0.5mm' }}>{deal.location.address}{deal.location.city ? `، ${deal.location.city}` : ''}</div>}
            {deal.location?.phone   && <div style={{ fontSize: '2.8mm', color: '#555' }}>هاتف: {deal.location.phone}</div>}
          </div>
        </div>

        {/* ── Title banner ── */}
        <div style={{ background: 'var(--rp)', color: '#fff', textAlign: 'center', padding: '2.5mm 0', borderRadius: '1.5mm', marginBottom: '4mm' }}>
          <div style={{ fontSize: '5.5mm', fontWeight: 700, letterSpacing: '0.5mm', fontFamily: FONT_AR_HEADING }}>استمارة الفحص النهائي للسيارة</div>
          <div style={{ fontSize: '3.5mm', fontWeight: 400, letterSpacing: '1mm', marginTop: '0.8mm', opacity: 0.85 }}>VEHICLE FINAL INSPECTION REPORT</div>
        </div>

        {/* ── Vehicle & deal info ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: '4mm', border: '1px solid #d0d8e4', borderRadius: '1.5mm', overflow: 'hidden' }}>
          {/* EN side */}
          <div style={{ padding: '3mm 4mm', borderRight: '1px solid #d0d8e4' }}>
            <InfoRow label="Deal No."       value={dealNo} />
            <InfoRow label="Date"           value={dealDateEn} />
            <InfoRow label="Vehicle"        value={vehicleStr} />
            <InfoRow label="VIN"            value={vinStr} />
            <InfoRow label="Customer"       value={custName} />
            {custPhone && <InfoRow label="Phone" value={custPhone} />}
            {salesRepName && <InfoRow label="Sales Rep" value={salesRepName} />}
          </div>
          {/* AR side */}
          <div style={{ padding: '3mm 4mm', direction: 'rtl', textAlign: 'right', fontFamily: FONT_AR_BODY }}>
            <InfoRow label="رقم الصفقة"    value={dealNo}       rtl />
            <InfoRow label="التاريخ"        value={dealDateAr}   rtl />
            <InfoRow label="السيارة"        value={vehicleStrAr} rtl />
            <InfoRow label="رقم الهيكل"    value={vinStr}       rtl />
            <InfoRow label="العميل"         value={custName}     rtl />
            {custPhone    && <InfoRow label="الهاتف"        value={custPhone}    rtl />}
            {salesRepName && <InfoRow label="مندوب المبيعات" value={salesRepName} rtl />}
          </div>
        </div>

        {/* ── Instructions banner ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm', marginBottom: '4mm', padding: '2mm 3mm', background: '#f0f4f9', borderRadius: '1.5mm', border: '1px solid #d0d8e4' }}>
          <div style={{ fontSize: '2.5mm', color: '#444' }}>
            ✓ = OK / Passed &nbsp;&nbsp; ✗ = Issue Found &nbsp;&nbsp; N/A = Not Applicable
          </div>
          <div style={{ fontSize: '2.5mm', color: '#444', direction: 'rtl', textAlign: 'right', fontFamily: FONT_AR_BODY }}>
            ✓ = مقبول / جيد &nbsp;&nbsp; ✗ = يوجد عيب &nbsp;&nbsp; N/A = لا ينطبق
          </div>
        </div>

        {/* ── Checklist ── */}
        {CHECKLIST.map((cat, ci) => (
          <div key={ci} style={{ marginBottom: '3.5mm' }}>
            {/* Category header */}
            <div style={{ background: 'var(--rp)', color: '#fff', display: 'grid', gridTemplateColumns: '1fr 10mm 1fr', padding: '1.5mm 3mm', borderRadius: '1mm 1mm 0 0' }}>
              <div style={{ fontSize: '3.2mm', fontWeight: 700 }}>{cat.en}</div>
              <div />
              <div style={{ fontSize: '3.2mm', fontWeight: 700, textAlign: 'right', direction: 'rtl', fontFamily: FONT_AR_HEADING }}>{cat.ar}</div>
            </div>
            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d0d8e4', borderTop: 'none' }}>
              <tbody>
                {cat.items.map((item, ii) => {
                  const key = `${ci}-${ii}`;
                  const isChecked = checked[key] ?? false;
                  const bg = ii % 2 === 0 ? '#fff' : '#f7f9fc';
                  return (
                    <tr key={ii} style={{ background: bg, borderBottom: '1px solid #e5eaf0' }}>
                      {/* EN label */}
                      <td style={{ padding: '2mm 3mm', width: '42%', fontSize: '2.9mm', color: '#222' }}>{item.en}</td>
                      {/* Checkbox */}
                      <td style={{ padding: '2mm', width: '10mm', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(key)}
                          style={{ width: '4mm', height: '4mm', cursor: 'pointer', accentColor: brand.primaryColor }}
                        />
                      </td>
                      {/* AR label */}
                      <td style={{ padding: '2mm 3mm', width: '48%', fontSize: '2.9mm', color: '#222', textAlign: 'right', direction: 'rtl', fontFamily: FONT_AR_BODY }}>{item.ar}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {/* ── Notes / Remarks ── */}
        <div style={{ marginBottom: '5mm', border: '1px solid #d0d8e4', borderRadius: '1.5mm', overflow: 'hidden' }}>
          <div style={{ background: 'var(--rp)', color: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '1.5mm 3mm' }}>
            <div style={{ fontSize: '3.2mm', fontWeight: 700 }}>Remarks / Notes</div>
            <div style={{ fontSize: '3.2mm', fontWeight: 700, textAlign: 'right', direction: 'rtl', fontFamily: FONT_AR_HEADING }}>ملاحظات</div>
          </div>
          <div style={{ padding: '3mm', height: '18mm' }}>
            {[1,2,3].map(n => (
              <div key={n} style={{ borderBottom: '1px solid #ccc', marginBottom: '3.5mm', height: '3.5mm' }} />
            ))}
          </div>
        </div>

        {/* ── Signature blocks ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5mm' }}>
          {/* Sales Rep / Manager — LTR */}
          <SigBlock
            titleEn="Sales Rep / Showroom Manager"
            titleAr="مندوب المبيعات / مدير الصالة"
            nameEn={salesRepName || ''}
            rtl={false}
            primaryColor={brand.primaryColor}
          />
          {/* Customer — RTL */}
          <SigBlock
            titleEn="Customer Signature"
            titleAr="توقيع العميل"
            nameEn={custName}
            rtl={true}
            primaryColor={brand.primaryColor}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: '4mm', paddingTop: '2mm', borderTop: '1px solid #d0d8e4', display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '2mm', color: '#888' }}>
          <div>Printed: {fmtDate(today)} — Deal #{dealNo}</div>
          <div style={{ textAlign: 'right', direction: 'rtl', fontFamily: FONT_AR_BODY }}>طُبع: {fmtDateAr(today)} — صفقة رقم {dealNo}</div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, value, rtl }: { label: string; value: string; rtl?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', direction: rtl ? 'rtl' : 'ltr', gap: '2mm', marginBottom: '1.2mm', fontSize: '2.8mm', fontFamily: rtl ? FONT_AR_BODY : undefined }}>
      <span style={{ color: '#666', flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: 600, color: '#111' }}>{value}</span>
    </div>
  );
}

function SigBlock({ titleEn, titleAr, nameEn, rtl, primaryColor }: {
  titleEn: string; titleAr: string; nameEn: string; rtl: boolean; primaryColor: string;
}) {
  return (
    <div style={{ border: '1px solid #c0cad6', borderRadius: '1.5mm', padding: '3mm 4mm', direction: rtl ? 'rtl' : 'ltr', fontFamily: rtl ? FONT_AR_BODY : undefined }}>
      <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
        <div style={{ fontSize: '3.2mm', fontWeight: 700, color: primaryColor }}>{rtl ? titleAr : titleEn}</div>
        <div style={{ fontSize: '2.5mm', color: '#666', marginTop: '0.5mm' }}>{rtl ? titleEn : titleAr}</div>
      </div>
      <div style={{ height: '16mm', borderBottom: '1px solid #333', marginBottom: '2mm', position: 'relative' }}>
        <span style={{ position: 'absolute', bottom: '1mm', [rtl ? 'right' : 'left']: '0', fontSize: '2mm', color: '#aaa' }}>
          {rtl ? 'التوقيع' : 'Signature'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.8mm', marginBottom: '1.5mm', gap: '2mm' }}>
        <span style={{ color: '#555', flexShrink: 0 }}>{rtl ? 'الاسم:' : 'Name:'}</span>
        <span style={{ borderBottom: '1px solid #aaa', flexGrow: 1, paddingBottom: '0.5mm', color: '#111' }}>{nameEn}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.8mm', gap: '2mm' }}>
        <span style={{ color: '#555', flexShrink: 0 }}>{rtl ? 'التاريخ:' : 'Date:'}</span>
        <span style={{ borderBottom: '1px solid #aaa', flexGrow: 1, paddingBottom: '0.5mm' }} />
      </div>
    </div>
  );
}
