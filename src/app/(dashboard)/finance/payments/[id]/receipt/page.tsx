'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '../../../../../../lib/useApi';

// ── Types ────────────────────────────────────────────────────────────────────

interface Company {
  name: string;
  address?: string;
  phone?: string;
  taxId?: string;
}

interface Location {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
}

interface Journal {
  code: string;
  name: string;
  company?: Company;
  location?: Location;
}

interface InstallmentLine {
  installmentNumber: number;
  dueDate: string;
  totalDue: number;
  principalPortion?: number;
  interestPortion?: number;
  installmentPlan?: {
    deal?: {
      customer?: { name: string; phone?: string };
      vehicle?: { make: string; model: string; year: number; vin?: string };
    };
  };
}

interface Deal {
  customer?: { name: string; phone?: string };
  vehicle?: { make: string; model: string; year: number; vin?: string };
}

interface Payment {
  id: string;
  number?: string;
  type: string;
  status: string;
  date: string;
  amount: number;
  method: string;
  memo?: string;
  partner?: { name: string; phone?: string; email?: string; taxId?: string };
  journal?: Journal;
  installmentLine?: InstallmentLine;
  deal?: Deal;
}

interface BrandState {
  logoUrl: string;
  displayName: string;
  displayNameAr: string;
  primaryColor: string;
}

const FONT_AR_HEADING = '"Cairo", sans-serif';
const FONT_AR_BODY = '"Times New Roman", Times, serif';

// ── Arabic number-to-words ───────────────────────────────────────────────────

const AR_ONES = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر',
  'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = [
  '', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة',
];

function convertGroup(n: number): string {
  if (n === 0) return '';
  if (n < 20) return AR_ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10;
    return o === 0 ? AR_TENS[t] : AR_ONES[o] + ' و' + AR_TENS[t];
  }
  const h = Math.floor(n / 100), rest = n % 100;
  return AR_HUNDREDS[h] + (rest > 0 ? ' و' + convertGroup(rest) : '');
}

function amountToArabicWords(amount: number): string {
  const int = Math.floor(amount);
  const frac = Math.round((amount - int) * 100);
  if (int === 0 && frac === 0) return 'صفر جنيه مصري فقط لا غير';

  const millions = Math.floor(int / 1_000_000);
  const thousands = Math.floor((int % 1_000_000) / 1_000);
  const remainder = int % 1_000;

  const parts: string[] = [];

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions <= 10) parts.push(convertGroup(millions) + ' ملايين');
    else parts.push(convertGroup(millions) + ' مليون');
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands <= 10) parts.push(convertGroup(thousands) + ' آلاف');
    else parts.push(convertGroup(thousands) + ' ألف');
  }
  if (remainder > 0) parts.push(convertGroup(remainder));

  let words = parts.join(' و') + ' جنيه مصري';
  if (frac > 0) words += ' و' + convertGroup(frac) + ' قرشاً';
  return words + ' فقط لا غير';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const METHODS: Record<string, { ar: string; en: string }> = {
  CASH:     { ar: 'نقداً',        en: 'Cash' },
  TRANSFER: { ar: 'تحويل بنكي',   en: 'Bank Transfer' },
  CHEQUE:   { ar: 'شيك',          en: 'Cheque' },
  CARD:     { ar: 'بطاقة ائتمان', en: 'Credit / Debit Card' },
};

function receiptNumber(p: Payment): string {
  if (p.number) return p.number;
  const d = new Date(p.date);
  const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `REC-${datePart}-${p.id.slice(-6).toUpperCase()}`;
}

function fmtDateBilingual(iso: string) {
  const d = new Date(iso);
  const ar = d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  const en = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return { ar, en };
}

function egp(n: number) {
  return Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PaymentReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data: payment, loading, error } = useQuery<Payment>(`/finance/payments/${id}/receipt`, [id]);
  const [brand, setBrand] = useState<BrandState>({ logoUrl: '', displayName: '', displayNameAr: '', primaryColor: 'var(--rp)' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dealerms_brand');
      if (raw) setBrand({ ...{ logoUrl: '', displayName: '', displayNameAr: '', primaryColor: 'var(--rp)' }, ...JSON.parse(raw) });
    } catch {}
  }, []);

  if (loading) return (
    <div className="p-8 text-center text-gray-400 text-sm">جاري تحميل الإيصال… / Loading receipt…</div>
  );
  if (error || !payment) return (
    <div className="p-8">
      <p className="text-red-400 text-sm mb-3">{error ?? 'Payment not found'}</p>
      <Link href={`/finance/payments/${id}`} className="text-blue-400 text-sm">← Back</Link>
    </div>
  );

  const recNo = receiptNumber(payment);
  const dateBi = fmtDateBilingual(payment.date);
  const method = METHODS[payment.method] ?? { ar: payment.method, en: payment.method };

  // Resolve customer + vehicle from installmentLine or direct deal
  const dealCtx = payment.installmentLine?.installmentPlan?.deal ?? payment.deal;
  const customer = payment.partner
    ? { name: payment.partner.name, phone: payment.partner.phone }
    : dealCtx?.customer;
  const vehicle = dealCtx?.vehicle;
  const installNum = payment.installmentLine?.installmentNumber;

  // Description bilingual
  let descAr = 'دفعة';
  let descEn = 'Payment';
  if (installNum && vehicle) {
    descAr = `قسط رقم ${installNum} — ${vehicle.make} ${vehicle.model} ${vehicle.year}`;
    descEn = `Installment No. ${installNum} — ${vehicle.make} ${vehicle.model} ${vehicle.year}`;
  } else if (vehicle) {
    descAr = `سيارة — ${vehicle.make} ${vehicle.model} ${vehicle.year}`;
    descEn = `Vehicle — ${vehicle.make} ${vehicle.model} ${vehicle.year}`;
  } else if (payment.memo) {
    descAr = payment.memo;
    descEn = payment.memo;
  }

  const company = payment.journal?.company;
  const location = payment.journal?.location;
  const companyName = brand.displayName || company?.name || 'iCar Dealership';
  const companyAddress = location?.address ?? company?.address ?? '';
  const companyPhone = location?.phone ?? company?.phone ?? '';
  const companyTaxId = company?.taxId ?? '';

  const amountWords = amountToArabicWords(Number(payment.amount));

  return (
    <>
      {/* Print styles — hide nav chrome, force white page */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .receipt-page, .receipt-page * { visibility: visible !important; }
          .receipt-page {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page { size: A4; margin: 15mm 12mm; }
        }
        @media screen {
          body { background: #111 !important; }
        }
      `}</style>

      {/* Screen toolbar */}
      <div className="no-print flex items-center gap-3 p-4 border-b border-white/10 bg-gray-950 sticky top-0 z-10">
        <Link href={`/finance/payments/${id}`} className="text-gray-400 hover:text-white text-sm transition">
          ← Back
        </Link>
        <span className="text-gray-600 text-sm">|</span>
        <span className="text-white text-sm font-medium">Receipt — {recNo}</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة / Print
          </button>
        </div>
      </div>

      {/* Receipt */}
      <div className="receipt-page mx-auto my-8 max-w-[210mm] bg-white text-gray-900 shadow-2xl"
        style={{ padding: '12mm 14mm', fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif', '--rp': brand.primaryColor } as React.CSSProperties}>

        {/* ── Letterhead ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '6mm', marginBottom: '6mm', borderBottom: '2px solid var(--rp)', paddingBottom: '4mm' }}>
          {/* EN info — left */}
          <div style={{ direction: 'ltr' }}>
            <div style={{ fontWeight: 700, fontSize: '5mm', color: 'var(--rp)', lineHeight: 1.2 }}>{companyName}</div>
            {companyAddress && <div style={{ fontSize: '3mm', color: '#555', marginTop: '0.5mm' }}>{companyAddress}{location?.city ? `, ${location.city}` : ''}</div>}
            {companyPhone && <div style={{ fontSize: '3mm', color: '#555' }}>Tel: {companyPhone}</div>}
            {companyTaxId && <div style={{ fontSize: '3mm', color: '#555' }}>Tax ID: {companyTaxId}</div>}
          </div>

          {/* Logo — center */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="logo" style={{ height: '16mm', width: 'auto', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '16mm', height: '16mm', borderRadius: '3mm', background: 'var(--rp)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '5mm' }}>iC</span>
              </div>
            )}
          </div>

          {/* AR info — right */}
          <div style={{ textAlign: 'right', direction: 'rtl', fontFamily: FONT_AR_BODY }}>
            <div style={{ fontWeight: 700, fontSize: '5mm', color: 'var(--rp)', lineHeight: 1.2, fontFamily: FONT_AR_HEADING }}>{brand.displayNameAr || companyName}</div>
            {companyAddress && <div style={{ fontSize: '3mm', color: '#555', marginTop: '0.5mm' }}>{companyAddress}</div>}
            {companyPhone && <div style={{ fontSize: '3mm', color: '#555' }}>هاتف: {companyPhone}</div>}
            {companyTaxId && <div style={{ fontSize: '3mm', color: '#555' }}>الرقم الضريبي: {companyTaxId}</div>}
          </div>
        </div>

        {/* ── Title banner ── */}
        <div style={{ background: 'var(--rp)', color: '#fff', textAlign: 'center', padding: '3mm 0', borderRadius: '1.5mm', marginBottom: '5mm' }}>
          <div style={{ fontSize: '6mm', fontWeight: 700, letterSpacing: '0.5mm' }}>إيصال استلام مبلغ</div>
          <div style={{ fontSize: '4mm', fontWeight: 400, letterSpacing: '1mm', marginTop: '1mm', opacity: 0.85 }}>PAYMENT RECEIPT</div>
        </div>

        {/* ── Receipt meta ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: '5mm' }}>
          {/* Left EN */}
          <div style={{ border: '1px solid #d0d8e4', borderRadius: '1.5mm', padding: '3mm 4mm' }}>
            <Row label="Receipt No." value={recNo} bold />
            <Row label="Date" value={dateBi.en} />
            <Row label="Payment Method" value={method.en} />
            <Row label="Journal" value={payment.journal ? `${payment.journal.code} — ${payment.journal.name}` : '—'} />
          </div>
          {/* Right AR */}
          <div style={{ border: '1px solid #d0d8e4', borderRadius: '1.5mm', padding: '3mm 4mm', direction: 'rtl', textAlign: 'right', fontFamily: FONT_AR_BODY }}>
            <Row label="رقم الإيصال" value={recNo} bold rtl />
            <Row label="التاريخ" value={dateBi.ar} rtl />
            <Row label="طريقة الدفع" value={method.ar} rtl />
            <Row label="الدفتر" value={payment.journal ? `${payment.journal.name} — ${payment.journal.code}` : '—'} rtl />
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ borderTop: '1.5px solid var(--rp)', margin: '3mm 0' }} />

        {/* ── Payment body ── */}
        <div style={{ border: '1.5px solid var(--rp)', borderRadius: '1.5mm', overflow: 'hidden', marginBottom: '5mm' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <BodyRow
                labelAr="استُلم من / استُلمت من"
                labelEn="Received From"
                valueAr={customer?.name ?? '—'}
                valueEn={customer?.name ?? '—'}
                highlight
              />
              {customer?.phone && (
                <BodyRow
                  labelAr="رقم الهاتف"
                  labelEn="Phone"
                  valueAr={customer.phone}
                  valueEn={customer.phone}
                />
              )}
              <BodyRow
                labelAr="المبلغ بالأرقام"
                labelEn="Amount (Figures)"
                valueAr={`${egp(payment.amount)} جنيه مصري`}
                valueEn={`EGP ${egp(payment.amount)}`}
                highlight
                amountStyle
              />
              <BodyRow
                labelAr="المبلغ كتابةً"
                labelEn="Amount in Words"
                valueAr={amountWords}
                valueEn={toEnglishWords(Number(payment.amount))}
              />
              <BodyRow
                labelAr="البيان / السبب"
                labelEn="Description"
                valueAr={descAr}
                valueEn={descEn}
              />
              {installNum && (
                <BodyRow
                  labelAr="رقم القسط"
                  labelEn="Installment No."
                  valueAr={`${installNum}`}
                  valueEn={`${installNum}`}
                />
              )}
              {vehicle?.vin && (
                <BodyRow
                  labelAr="رقم الشاسيه"
                  labelEn="VIN"
                  valueAr={vehicle.vin}
                  valueEn={vehicle.vin}
                />
              )}
            </tbody>
          </table>
        </div>

        {/* ── Divider ── */}
        <div style={{ borderTop: '1.5px solid var(--rp)', margin: '3mm 0 5mm' }} />

        {/* ── Signature blocks ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10mm', marginTop: '4mm' }}>
          {/* Issuer */}
          <SigBlock
            titleAr="توقيع المُحصِّل / المُصدِر"
            titleEn="Cashier / Issuer Signature"
            nameAr="الاسم:"
            nameEn="Name:"
            dateAr="التاريخ:"
            dateEn="Date:"
            dateValue={dateBi.en}
          />
          {/* Receiver */}
          <SigBlock
            titleAr="توقيع العميل / المستلم"
            titleEn="Customer / Recipient Signature"
            nameAr="الاسم:"
            nameEn="Name:"
            prefillName={customer?.name}
            dateAr="التاريخ:"
            dateEn="Date:"
            dateValue={dateBi.en}
            rtl
          />
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: '8mm', borderTop: '1px dashed #aab', paddingTop: '3mm', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.5mm', color: '#666' }}>
            <span>هذا الإيصال مستند رسمي — يُرجى الاحتفاظ به</span>
            <span style={{ letterSpacing: '0.3mm', color: 'var(--rp)', fontWeight: 600 }}>{recNo}</span>
            <span>This receipt is an official document — please retain it</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ label, value, bold, rtl }: { label: string; value: string; bold?: boolean; rtl?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', direction: rtl ? 'rtl' : 'ltr', gap: '2mm', marginBottom: '1.5mm', fontSize: '3mm', fontFamily: rtl ? FONT_AR_BODY : undefined }}>
      <span style={{ color: '#555', flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: '#111' }}>{value}</span>
    </div>
  );
}

function BodyRow({ labelAr, labelEn, valueAr, valueEn, highlight, amountStyle }: {
  labelAr: string; labelEn: string;
  valueAr: string; valueEn: string;
  highlight?: boolean; amountStyle?: boolean;
}) {
  const bg = highlight ? '#eef3f9' : 'transparent';
  return (
    <tr style={{ background: bg, borderBottom: '1px solid #d0d8e4' }}>
      {/* EN side */}
      <td style={{ padding: '2.5mm 3mm', width: '22%', fontSize: '2.8mm', color: '#555', borderRight: '1px solid #d0d8e4' }}>{labelEn}</td>
      <td style={{ padding: '2.5mm 3mm', width: '28%', fontSize: amountStyle ? '4mm' : '3mm', fontWeight: amountStyle ? 700 : 500, color: amountStyle ? 'var(--rp)' : '#111', borderRight: '1.5px solid #8aa', fontVariantNumeric: 'tabular-nums' }}>{valueEn}</td>
      {/* AR side */}
      <td style={{ padding: '2.5mm 3mm', width: '28%', direction: 'rtl', textAlign: 'right', fontSize: amountStyle ? '4mm' : '3mm', fontWeight: amountStyle ? 700 : 500, color: amountStyle ? 'var(--rp)' : '#111', borderRight: '1px solid #d0d8e4', fontVariantNumeric: 'tabular-nums', fontFamily: FONT_AR_BODY }}>{valueAr}</td>
      <td style={{ padding: '2.5mm 3mm', width: '22%', direction: 'rtl', textAlign: 'right', fontSize: '2.8mm', color: '#555', fontFamily: FONT_AR_BODY }}>{labelAr}</td>
    </tr>
  );
}

function SigBlock({ titleAr, titleEn, nameAr, nameEn, prefillName, dateAr, dateEn, dateValue, rtl }: {
  titleAr: string; titleEn: string;
  nameAr: string; nameEn: string;
  prefillName?: string;
  dateAr: string; dateEn: string;
  dateValue: string;
  rtl?: boolean;
}) {
  return (
    <div style={{ border: '1px solid #c0cad6', borderRadius: '1.5mm', padding: '3mm 4mm', direction: rtl ? 'rtl' : 'ltr', fontFamily: rtl ? FONT_AR_BODY : undefined }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
        <div style={{ fontSize: '3.2mm', fontWeight: 700, color: 'var(--rp)' }}>{rtl ? titleAr : titleEn}</div>
        <div style={{ fontSize: '2.5mm', color: '#666', marginTop: '0.5mm' }}>{rtl ? titleEn : titleAr}</div>
      </div>

      {/* Signature area */}
      <div style={{ height: '14mm', borderBottom: '1px solid #333', marginBottom: '2mm', position: 'relative' }}>
        <span style={{ position: 'absolute', bottom: '1mm', [rtl ? 'right' : 'left']: '0', fontSize: '2mm', color: '#aaa' }}>{rtl ? 'التوقيع' : 'Signature'}</span>
      </div>

      {/* Name */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.8mm', marginBottom: '1.5mm', gap: '2mm' }}>
        <span style={{ color: '#555', flexShrink: 0 }}>{rtl ? nameAr : nameEn}</span>
        <span style={{ borderBottom: '1px solid #aaa', flexGrow: 1, paddingBottom: '0.5mm', color: '#111' }}>{prefillName ?? ''}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.8mm', marginBottom: '1.5mm', gap: '2mm' }}>
        <span style={{ color: '#555', flexShrink: 0 }}>{rtl ? nameEn : nameAr}</span>
        <span style={{ borderBottom: '1px solid #aaa', flexGrow: 1, paddingBottom: '0.5mm', color: '#111' }}>{prefillName ?? ''}</span>
      </div>

      {/* Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.8mm', gap: '2mm' }}>
        <span style={{ color: '#555', flexShrink: 0 }}>{rtl ? dateAr : dateEn}</span>
        <span style={{ color: '#111' }}>{dateValue}</span>
      </div>
    </div>
  );
}

// ── English amount in words (simplified) ──────────────────────────────────────

function toEnglishWords(amount: number): string {
  const int = Math.floor(amount);
  const frac = Math.round((amount - int) * 100);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function g(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) { const t = Math.floor(n / 10), o = n % 10; return tens[t] + (o > 0 ? '-' + ones[o] : ''); }
    const h = Math.floor(n / 100), rest = n % 100;
    return ones[h] + ' Hundred' + (rest > 0 ? ' ' + g(rest) : '');
  }

  const parts: string[] = [];
  const mil = Math.floor(int / 1_000_000);
  const thou = Math.floor((int % 1_000_000) / 1_000);
  const rem = int % 1_000;
  if (mil > 0) parts.push(g(mil) + ' Million');
  if (thou > 0) parts.push(g(thou) + ' Thousand');
  if (rem > 0) parts.push(g(rem));

  let words = (parts.join(' ') || 'Zero') + ' Egyptian Pounds';
  if (frac > 0) words += ' and ' + g(frac) + ' Piastres';
  return words + ' Only';
}
