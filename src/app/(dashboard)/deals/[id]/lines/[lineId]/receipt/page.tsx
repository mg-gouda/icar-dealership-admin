'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '../../../../../../../lib/useApi';

interface LineReceipt {
  receiptNumber: string;
  jeRef: string;
  date: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  installmentNumber: number;
  method: string;
  customer: { name: string; phone?: string | null; email?: string | null };
  vehicle?: { make: string; model: string; year: number; vin?: string | null } | null;
  company?: { name: string; address?: string | null; phone?: string | null; taxId?: string | null } | null;
  location?: { name?: string | null; address?: string | null; city?: string | null; phone?: string | null } | null;
  paymentId?: string | null;
}

interface BrandState { logoUrl: string; displayName: string; displayNameAr: string; primaryColor: string }

// ── Arabic words ─────────────────────────────────────────────────────────────

const AR_ONES = ['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
const AR_TENS = ['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
const AR_HUNDREDS = ['','مئة','مئتان','ثلاثمئة','أربعمئة','خمسمئة','ستمئة','سبعمئة','ثمانمئة','تسعمئة'];

function cvtGrp(n: number): string {
  if (!n) return '';
  if (n < 20) return AR_ONES[n];
  if (n < 100) { const t=Math.floor(n/10),o=n%10; return o?AR_ONES[o]+' و'+AR_TENS[t]:AR_TENS[t]; }
  const h=Math.floor(n/100),r=n%100;
  return AR_HUNDREDS[h]+(r?' و'+cvtGrp(r):'');
}

function toAr(amount: number): string {
  const int=Math.floor(amount), frac=Math.round((amount-int)*100);
  if (!int && !frac) return 'صفر جنيه مصري فقط لا غير';
  const mil=Math.floor(int/1e6), thou=Math.floor((int%1e6)/1e3), rem=int%1e3;
  const parts: string[]=[];
  if (mil) parts.push(mil===1?'مليون':mil===2?'مليونان':cvtGrp(mil)+(mil<=10?' ملايين':' مليون'));
  if (thou) parts.push(thou===1?'ألف':thou===2?'ألفان':cvtGrp(thou)+(thou<=10?' آلاف':' ألف'));
  if (rem) parts.push(cvtGrp(rem));
  return parts.join(' و')+' جنيه مصري'+(frac?' و'+cvtGrp(frac)+' قرشاً':'')+' فقط لا غير';
}

const EN_ONES=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const EN_TENS=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function cvtEnGrp(n: number): string {
  if (!n) return '';
  if (n<20) return EN_ONES[n];
  if (n<100) { const t=Math.floor(n/10),o=n%10; return EN_TENS[t]+(o?'-'+EN_ONES[o]:''); }
  const h=Math.floor(n/100),r=n%100;
  return EN_ONES[h]+' Hundred'+(r?' '+cvtEnGrp(r):'');
}

function toEn(amount: number): string {
  const int=Math.floor(amount), frac=Math.round((amount-int)*100);
  const mil=Math.floor(int/1e6), thou=Math.floor((int%1e6)/1e3), rem=int%1e3;
  const parts: string[]=[];
  if (mil) parts.push(cvtEnGrp(mil)+' Million');
  if (thou) parts.push(cvtEnGrp(thou)+' Thousand');
  if (rem) parts.push(cvtEnGrp(rem));
  return (parts.join(' ')||'Zero')+' Egyptian Pounds'+(frac?' and '+cvtEnGrp(frac)+' Piastres':'')+' Only';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const METHODS: Record<string,{ar:string;en:string}> = {
  CASH:         {ar:'نقداً',         en:'Cash'},
  BANK_TRANSFER:{ar:'تحويل بنكي',    en:'Bank Transfer'},
  CHECK:        {ar:'شيك',           en:'Cheque'},
  CARD:         {ar:'بطاقة ائتمان',  en:'Credit / Debit Card'},
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return {
    ar: d.toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}),
    en: d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),
  };
}

const egp = (n: number) => Number(n).toLocaleString('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2});

// ── Component ─────────────────────────────────────────────────────────────────

export default function LineReceiptPage() {
  const { id: dealId, lineId } = useParams<{ id: string; lineId: string }>();
  const { data: rec, loading, error } = useQuery<LineReceipt>(`/deals/${dealId}/installment-plan/lines/${lineId}/receipt`,[dealId,lineId]);
  const [brand, setBrand] = useState<BrandState>({logoUrl:'',displayName:'',displayNameAr:'',primaryColor:'var(--rp)'});

  useEffect(() => {
    try { const r=localStorage.getItem('dealerms_brand'); if(r) setBrand({...{logoUrl:'',displayName:'',displayNameAr:'',primaryColor:'var(--rp)'},...JSON.parse(r)}); } catch {}
  },[]);

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">جاري التحميل… / Loading…</div>;
  if (error||!rec) return (
    <div className="p-8">
      <p className="text-red-400 text-sm mb-3">{error??'Receipt data not found'}</p>
      <Link href={`/deals/${dealId}`} className="text-blue-400 text-sm">← Back to Deal</Link>
    </div>
  );

  const dateBi = fmtDate(rec.date);
  const method = METHODS[rec.method]??{ar:rec.method,en:rec.method};
  const companyName = brand.displayName || rec.company?.name || 'iCar Dealership';
  const companyAddr = rec.location?.address ?? rec.company?.address ?? '';
  const companyCity = rec.location?.city ?? '';
  const companyPhone = rec.location?.phone ?? rec.company?.phone ?? '';
  const companyTaxId = rec.company?.taxId ?? '';

  const vehicleStr = rec.vehicle ? `${rec.vehicle.make} ${rec.vehicle.model} ${rec.vehicle.year}` : '';
  const descAr = `قسط رقم ${rec.installmentNumber}${vehicleStr?' — '+vehicleStr:''}`;
  const descEn = `Installment No. ${rec.installmentNumber}${vehicleStr?' — '+vehicleStr:''}`;

  return (
    <>
      <style>{`
        @media print {
          body{background:white!important;color:black!important;}
          .no-print{display:none!important;}
          .receipt-page{box-shadow:none!important;border:none!important;margin:0!important;max-width:100%!important;padding:0!important;}
          @page{size:A4;margin:15mm 12mm;}
        }
        @media screen { body{background:#111!important;} }
      `}</style>

      {/* Toolbar */}
      <div className="no-print flex items-center gap-3 p-4 border-b border-white/10 bg-gray-950 sticky top-0 z-10">
        <Link href={`/deals/${dealId}`} className="text-gray-400 hover:text-white text-sm transition">← Back to Deal</Link>
        <span className="text-gray-600">|</span>
        <span className="text-white text-sm font-medium">Receipt — {rec.receiptNumber}</span>
        <span className="text-gray-600 text-xs ml-2">{rec.jeRef}</span>
        {rec.paymentId && (
          <Link href={`/finance/payments/${rec.paymentId}/receipt`} className="text-blue-400 text-xs hover:text-blue-300 ml-2">
            View in Finance → Payments
          </Link>
        )}
        <div className="ml-auto">
          <button onClick={()=>window.print()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة / Print
          </button>
        </div>
      </div>

      {/* Receipt */}
      <div className="receipt-page mx-auto my-8 max-w-[210mm] bg-white text-gray-900 shadow-2xl"
        style={{padding:'12mm 14mm',fontFamily:'"Segoe UI",Tahoma,Arial,sans-serif','--rp':brand.primaryColor} as React.CSSProperties}>

        {/* Letterhead */}
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:'6mm',marginBottom:'6mm',borderBottom:'2px solid var(--rp)',paddingBottom:'4mm'}}>
          {/* EN info — left */}
          <div style={{direction:'ltr'}}>
            <div style={{fontWeight:700,fontSize:'5mm',color:'var(--rp)',lineHeight:1.2}}>{companyName}</div>
            {companyAddr&&<div style={{fontSize:'3mm',color:'#555',marginTop:'0.5mm'}}>{companyAddr}{companyCity?`, ${companyCity}`:''}</div>}
            {companyPhone&&<div style={{fontSize:'3mm',color:'#555'}}>Tel: {companyPhone}</div>}
            {companyTaxId&&<div style={{fontSize:'3mm',color:'#555'}}>Tax ID: {companyTaxId}</div>}
          </div>
          {/* Logo — center */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            {brand.logoUrl
              ? <img src={brand.logoUrl} alt="logo" style={{height:'16mm',width:'auto',objectFit:'contain'}}/>
              : <div style={{width:'16mm',height:'16mm',borderRadius:'3mm',background:'var(--rp)',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'#fff',fontWeight:700,fontSize:'5mm'}}>iC</span></div>
            }
          </div>
          {/* AR info — right */}
          <div style={{textAlign:'right',direction:'rtl'}}>
            <div style={{fontWeight:700,fontSize:'5mm',color:'var(--rp)',lineHeight:1.2}}>{brand.displayNameAr||companyName}</div>
            {companyAddr&&<div style={{fontSize:'3mm',color:'#555',marginTop:'0.5mm'}}>{companyAddr}{companyCity?`، ${companyCity}`:''}</div>}
            {companyPhone&&<div style={{fontSize:'3mm',color:'#555'}}>هاتف: {companyPhone}</div>}
            {companyTaxId&&<div style={{fontSize:'3mm',color:'#555'}}>الرقم الضريبي: {companyTaxId}</div>}
          </div>
        </div>

        {/* Title */}
        <div style={{background:'var(--rp)',color:'#fff',textAlign:'center',padding:'3mm 0',borderRadius:'1.5mm',marginBottom:'5mm'}}>
          <div style={{fontSize:'6mm',fontWeight:700,letterSpacing:'0.5mm'}}>إيصال استلام قسط</div>
          <div style={{fontSize:'4mm',fontWeight:400,letterSpacing:'1mm',marginTop:'1mm',opacity:0.85}}>INSTALLMENT PAYMENT RECEIPT</div>
        </div>

        {/* Meta grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3mm',marginBottom:'5mm'}}>
          <div style={{border:'1px solid #d0d8e4',borderRadius:'1.5mm',padding:'3mm 4mm'}}>
            <MRow label="Receipt No." value={rec.receiptNumber} bold/>
            <MRow label="GL Reference" value={rec.jeRef}/>
            <MRow label="Date" value={dateBi.en}/>
            <MRow label="Payment Method" value={method.en}/>
          </div>
          <div style={{border:'1px solid #d0d8e4',borderRadius:'1.5mm',padding:'3mm 4mm',direction:'rtl',textAlign:'right'}}>
            <MRow label="رقم الإيصال" value={rec.receiptNumber} bold rtl/>
            <MRow label="المرجع المحاسبي" value={rec.jeRef} rtl/>
            <MRow label="التاريخ" value={dateBi.ar} rtl/>
            <MRow label="طريقة الدفع" value={method.ar} rtl/>
          </div>
        </div>

        {/* Divider */}
        <div style={{borderTop:'1.5px solid var(--rp)',margin:'3mm 0'}}/>

        {/* Body table */}
        <div style={{border:'1.5px solid var(--rp)',borderRadius:'1.5mm',overflow:'hidden',marginBottom:'5mm'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <tbody>
              <BRow labelEn="Received From" labelAr="استُلم من" valueEn={rec.customer.name} valueAr={rec.customer.name} highlight/>
              {rec.customer.phone&&<BRow labelEn="Phone" labelAr="هاتف" valueEn={rec.customer.phone!} valueAr={rec.customer.phone!}/>}
              <BRow labelEn="Amount (Figures)" labelAr="المبلغ بالأرقام" valueEn={`EGP ${egp(rec.amount)}`} valueAr={`${egp(rec.amount)} جنيه مصري`} highlight amountStyle/>
              <BRow labelEn="Amount in Words" labelAr="المبلغ كتابةً" valueEn={toEn(rec.amount)} valueAr={toAr(rec.amount)}/>
              <BRow labelEn="Description" labelAr="البيان" valueEn={descEn} valueAr={descAr}/>
              <BRow labelEn="Installment No." labelAr="رقم القسط" valueEn={String(rec.installmentNumber)} valueAr={String(rec.installmentNumber)}/>
              {rec.vehicle?.vin&&<BRow labelEn="VIN" labelAr="رقم الهيكل" valueEn={rec.vehicle.vin!} valueAr={rec.vehicle.vin!}/>}
            </tbody>
          </table>
        </div>

        {/* Divider */}
        <div style={{borderTop:'1.5px solid var(--rp)',margin:'3mm 0 5mm'}}/>

        {/* Signatures */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10mm',marginTop:'4mm'}}>
          <SigBlock titleEn="Cashier / Issuer Signature" titleAr="توقيع المُحصِّل / المُصدِر" dateEn="Date:" dateAr="التاريخ:" dateValue={dateBi.en}/>
          <SigBlock titleEn="Customer / Recipient Signature" titleAr="توقيع العميل / المستلم" prefillName={rec.customer.name} dateEn="Date:" dateAr="التاريخ:" dateValue={dateBi.en} rtl/>
        </div>

        {/* Footer */}
        <div style={{marginTop:'8mm',borderTop:'1px dashed #aab',paddingTop:'3mm',textAlign:'center'}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'2.5mm',color:'#666'}}>
            <span>هذا الإيصال مستند رسمي — يُرجى الاحتفاظ به</span>
            <span style={{letterSpacing:'0.3mm',color:'var(--rp)',fontWeight:600}}>{rec.receiptNumber}</span>
            <span>This receipt is an official document — please retain it</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MRow({label,value,bold,rtl}:{label:string;value:string;bold?:boolean;rtl?:boolean}) {
  return (
    <div style={{display:'flex',justifyContent:rtl?'flex-end':'space-between',gap:'2mm',marginBottom:'1.5mm',fontSize:'3mm'}}>
      <span style={{color:'#555',flexShrink:0}}>{label}:</span>
      <span style={{fontWeight:bold?700:500,color:'#111',textAlign:rtl?'left':'right'}}>{value}</span>
    </div>
  );
}

function BRow({labelEn,labelAr,valueEn,valueAr,highlight,amountStyle}:{
  labelEn:string;labelAr:string;valueEn:string;valueAr:string;highlight?:boolean;amountStyle?:boolean;
}) {
  return (
    <tr style={{background:highlight?'#eef3f9':'transparent',borderBottom:'1px solid #d0d8e4'}}>
      <td style={{padding:'2.5mm 3mm',width:'22%',fontSize:'2.8mm',color:'#555',borderRight:'1px solid #d0d8e4'}}>{labelEn}</td>
      <td style={{padding:'2.5mm 3mm',width:'28%',fontSize:amountStyle?'4mm':'3mm',fontWeight:amountStyle?700:500,color:amountStyle?'var(--rp)':'#111',borderRight:'1.5px solid #8aa',fontVariantNumeric:'tabular-nums'}}>{valueEn}</td>
      <td style={{padding:'2.5mm 3mm',width:'28%',direction:'rtl',textAlign:'right',fontSize:amountStyle?'4mm':'3mm',fontWeight:amountStyle?700:500,color:amountStyle?'var(--rp)':'#111',borderRight:'1px solid #d0d8e4',fontVariantNumeric:'tabular-nums'}}>{valueAr}</td>
      <td style={{padding:'2.5mm 3mm',width:'22%',direction:'rtl',textAlign:'right',fontSize:'2.8mm',color:'#555'}}>{labelAr}</td>
    </tr>
  );
}

function SigBlock({titleEn,titleAr,prefillName,dateEn,dateAr,dateValue,rtl}:{
  titleEn:string;titleAr:string;prefillName?:string;dateEn:string;dateAr:string;dateValue:string;rtl?:boolean;
}) {
  return (
    <div style={{border:'1px solid #c0cad6',borderRadius:'1.5mm',padding:'3mm 4mm',direction:rtl?'rtl':'ltr'}}>
      <div style={{textAlign:'center',marginBottom:'3mm'}}>
        <div style={{fontSize:'3.2mm',fontWeight:700,color:'var(--rp)'}}>{rtl?titleAr:titleEn}</div>
        <div style={{fontSize:'2.5mm',color:'#666',marginTop:'0.5mm'}}>{rtl?titleEn:titleAr}</div>
      </div>
      <div style={{height:'14mm',borderBottom:'1px solid #333',marginBottom:'2mm',position:'relative'}}>
        <span style={{position:'absolute',bottom:'1mm',[rtl?'right':'left']:'0',fontSize:'2mm',color:'#aaa'}}>{rtl?'التوقيع':'Signature'}</span>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:'2.8mm',marginBottom:'1.5mm',gap:'2mm'}}>
        <span style={{color:'#555',flexShrink:0}}>{rtl?'الاسم:':'Name:'}</span>
        <span style={{borderBottom:'1px solid #aaa',flexGrow:1,paddingBottom:'0.5mm'}}>{prefillName??''}</span>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:'2.8mm',gap:'2mm'}}>
        <span style={{color:'#555',flexShrink:0}}>{rtl?dateAr:dateEn}</span>
        <span style={{color:'#111'}}>{dateValue}</span>
      </div>
    </div>
  );
}
