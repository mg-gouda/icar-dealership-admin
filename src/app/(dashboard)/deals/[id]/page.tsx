'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';
import { fmtDate, fmtDateTime } from '@/lib/fmt';
import jsPDF from 'jspdf';
import { API_BASE as API } from '@/lib/config';
import { apiFetch } from '@/lib/useApi';
const token = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
const fmt = (n: number) => 'EGP ' + Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Note { id: string; type: 'NOTE' | 'CALL' | 'EMAIL'; body: string; author?: { name: string }; createdAt: string; }
interface InstallmentLine { id: string; dueDate: string; totalDue: number; principalPortion?: number; interestPortion?: number; status: string; installmentNumber: number; paidAmount?: number; payment?: { id: string } | null; }
interface Document { id: string; documentType: string; status: string; fileUrl?: string; }
interface BankApproval { approvalReferenceNumber: string; approvedAmount: number; approvalDate: string; expiryDate?: string; notes?: string; }
interface FinanceApp {
  id: string; status: string; bankFinancingStatus: string;
  bankName?: string; bankBranch?: string;
  termMonths?: number; apr?: number; interestType?: string;
  requiredDocuments: Document[]; bankApproval?: BankApproval;
}
interface DealCommission {
  id: string; user: { name: string }; roleInDeal: string;
  baseAmount: number; splitPercentage: number; calculatedAmount: number; status: string;
}
interface TradeIn { vin?: string; make?: string; model?: string; year?: number; mileage?: number; condition?: string; agreedValue?: number; }
interface Deal {
  id: string; status: string; purchaseMethod: string;
  salePrice: number; adminFee?: number; insuranceFee?: number;
  tradeInCredit?: number; dealNumber?: string; createdAt: string;
  vehicle?: { id: string; make: string; model: string; year: number; vin?: string; status?: string };
  customer?: { name: string; phone?: string; email?: string };
  salesRep?: { name: string };
  location?: { name: string };
  tradeIn?: TradeIn;
  installmentPlan?: { downPayment: number; interestRate?: number; durationMonths?: number; installmentAmount: number; numberOfInstallments: number; installments: InstallmentLine[]; };
  financeApplication?: FinanceApp;
  invoices?: { id: string; status: string; amountTotal: number; dueDate?: string }[];
  commissions?: DealCommission[];
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
const STATUS_STEPS = ['DRAFT', 'PENDING_FINANCE', 'APPROVED', 'FINALIZED'];
const STEP_LABEL: Record<string, string> = {
  DRAFT: 'Draft', PENDING_FINANCE: 'Pending Finance', APPROVED: 'Approved', FINALIZED: 'Finalized', CANCELLED: 'Cancelled',
};

function statusBadgeClass(s: string) {
  const m: Record<string, string> = { DRAFT: 'badge-neutral', PENDING_FINANCE: 'badge-warning', APPROVED: 'badge-success', FINALIZED: 'badge-success', CANCELLED: 'badge-danger' };
  return m[s] ?? 'badge-neutral';
}
function installmentStatusClass(s: string) {
  const m: Record<string, string> = { PAID: 'badge-success', PARTIAL: 'badge-warning', PENDING: 'badge-neutral', UPCOMING: 'badge-info', OVERDUE: 'badge-danger' };
  return m[s] ?? 'badge-neutral';
}
function docStatusClass(s: string) {
  const m: Record<string, string> = { VERIFIED: 'badge-success', SUBMITTED: 'badge-info', PENDING: 'badge-neutral', REJECTED: 'badge-danger', UPLOADED: 'badge-purple' };
  return m[s] ?? 'badge-neutral';
}

const AVATAR_COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--purple)', 'var(--orange)', 'var(--danger)'];
function avatarColor(name: string) { const c = name.charCodeAt(0) + (name.charCodeAt(1) || 0); return AVATAR_COLORS[c % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

const DOC_TYPES = [
  'NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'PROOF_OF_INCOME', 'BANK_STATEMENT_6M',
  'EMPLOYER_LETTER', 'CAR_LICENSE_BAYAN', 'INSURANCE_CERTIFICATE', 'DOWN_PAYMENT_RECEIPT', 'OTHER',
].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));

const DURATION_OPTIONS = [12, 24, 36, 48, 60];
const NOTE_BADGE: Record<string, string> = { NOTE: 'badge-neutral', CALL: 'badge-success', EMAIL: 'badge-info' };

function defaultStartDate(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10);
}

/* ── PDF ─────────────────────────────────────────────────────────────────── */
function generatePurchaseAgreementPDF(deal: Deal) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const fmtN = (n: number) => 'EGP ' + Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });
  const today = new Date().toLocaleDateString('en-EG', { year: 'numeric', month: 'long', day: 'numeric' });

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE AGREEMENT', W / 2, 12, { align: 'center' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('iCar Dealership', W / 2, 19, { align: 'center' });
  doc.text(`Date: ${today}`, W / 2, 24, { align: 'center' });

  doc.setTextColor(15, 23, 42);

  // Deal reference
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(`Deal Ref: ${deal.id.toUpperCase()}`, 14, 36);
  doc.text(`Status: ${deal.status.replace(/_/g, ' ')}`, W - 14, 36, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 39, W - 14, 39);

  let y = 46;
  const col2 = W / 2 + 4;
  const labelColor: [number, number, number] = [100, 116, 139];

  function section(title: string) {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y - 4, W - 28, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(title, 16, y + 1);
    y += 10;
    doc.setFont('helvetica', 'normal');
  }

  function row(label: string, value: string, x = 14, colW = W - 28) {
    doc.setFontSize(7.5); doc.setTextColor(...labelColor);
    doc.text(label, x, y);
    doc.setTextColor(15, 23, 42);
    doc.text(value || '—', x + colW * 0.45, y);
    y += 6;
  }

  // Vehicle
  section('VEHICLE DETAILS');
  const v = deal.vehicle;
  row('Make / Model', v ? `${v.make} ${v.model}` : '—');
  row('Year', v?.year?.toString() ?? '—');
  row('VIN', v?.vin ?? '—');

  y += 2;

  // Customer
  section('BUYER INFORMATION');
  row('Name', deal.customer?.name ?? '—');
  row('Phone', deal.customer?.phone ?? '—');
  row('Email', deal.customer?.email ?? '—');

  y += 2;

  // Financial
  section('FINANCIAL TERMS');
  row('Purchase Method', deal.purchaseMethod.replace(/_/g, ' '));
  row('Sale Price', fmtN(Number(deal.salePrice ?? 0)));
  if (deal.adminFee) row('Admin Fee', fmtN(Number(deal.adminFee)));
  if (deal.insuranceFee) row('Compulsory Insurance', fmtN(Number(deal.insuranceFee)));
  const vat = Math.round(Number(deal.salePrice ?? 0) * 0.14 * 100) / 100;
  row('VAT (14%)', fmtN(vat));
  const total = Number(deal.salePrice ?? 0) + vat + Number(deal.adminFee ?? 0) + Number(deal.insuranceFee ?? 0);
  doc.setFont('helvetica', 'bold');
  row('TOTAL DUE', fmtN(total));
  doc.setFont('helvetica', 'normal');

  if (deal.purchaseMethod === 'DEALERSHIP_INSTALLMENT' && deal.installmentPlan) {
    y += 2;
    section('INSTALLMENT PLAN');
    row('Down Payment', fmtN(Number(deal.installmentPlan.downPayment)));
    row('Monthly Installment', fmtN(Number(deal.installmentPlan.installmentAmount)));
    row('Duration', `${deal.installmentPlan.durationMonths} months`);
    row('Interest Rate', `${deal.installmentPlan.interestRate ?? 0}%`);
  }

  if (deal.tradeIn && deal.tradeIn.make) {
    y += 2;
    section('TRADE-IN VEHICLE');
    row('Make / Model', `${deal.tradeIn.make} ${deal.tradeIn.model ?? ''}`);
    row('Year', deal.tradeIn.year?.toString() ?? '—');
    row('Agreed Value', fmtN(Number(deal.tradeIn.agreedValue ?? 0)));
  }

  // Signatures
  y = Math.max(y + 10, 220);
  doc.setDrawColor(200, 213, 225);
  doc.line(14, y, 80, y);
  doc.line(W / 2 + 10, y, W - 14, y);
  doc.setFontSize(7.5); doc.setTextColor(...labelColor);
  doc.text('Buyer Signature & Date', 14, y + 5);
  doc.text('Authorized Dealer Signature & Date', W / 2 + 10, y + 5);

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(241, 245, 249);
  doc.rect(0, pageH - 14, W, 14, 'F');
  doc.setFontSize(7); doc.setTextColor(100, 116, 139);
  doc.text('This document is computer-generated and constitutes a legally binding purchase agreement.', W / 2, pageH - 7, { align: 'center' });

  doc.save(`purchase-agreement-${deal.id}.pdf`);
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAr } = useLang();
  const DOC_STATUS_OPTS = isAr ? [
    { value: 'PENDING', label: 'قيد الانتظار' }, { value: 'SUBMITTED', label: 'مقدم' },
    { value: 'VERIFIED', label: 'موثق' }, { value: 'REJECTED', label: 'مرفوض' },
  ] : [
    { value: 'PENDING', label: 'Pending' }, { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'VERIFIED', label: 'Verified' }, { value: 'REJECTED', label: 'Rejected' },
  ];
  const BFS_OPTS = isAr ? [
    { value: 'DOCUMENTS_PENDING', label: 'وثائق قيد الانتظار' },
    { value: 'SUBMITTED', label: 'مقدم للبنك' },
    { value: 'UNDER_REVIEW', label: 'قيد المراجعة' },
    { value: 'APPROVED', label: 'موافق عليه' },
    { value: 'REJECTED', label: 'مرفوض' },
  ] : [
    { value: 'DOCUMENTS_PENDING', label: 'Documents Pending' },
    { value: 'SUBMITTED', label: 'Submitted to Bank' },
    { value: 'UNDER_REVIEW', label: 'Under Review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];
  const CALC_METHOD_OPTS = isAr ? [
    { value: 'FLAT', label: 'ثابتة' }, { value: 'COMPOUND', label: 'مركبة' }, { value: 'AMORTIZING', label: 'متناقصة' },
  ] : [
    { value: 'FLAT', label: 'Fixed' }, { value: 'COMPOUND', label: 'Compound' }, { value: 'AMORTIZING', label: 'Declining Balance' },
  ];
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payTab, setPayTab] = useState<'CASH' | 'BANK_FINANCING' | 'DEALERSHIP_INSTALLMENT'>('CASH');

  const [ipForm, setIpForm] = useState({ downPayment: 0, durationMonths: 24, interestRate: 0, calcMethod: 'FLAT', firstInstallmentDate: defaultStartDate() });
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const [showFACreate, setShowFACreate] = useState(false);
  const [faForm, setFaForm] = useState({ bankName: '', bankBranch: '', termMonths: '', apr: '', interestType: 'FLAT' });
  const [savingFA, setSavingFA] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [approvalForm, setApprovalForm] = useState({ approvalReferenceNumber: '', approvedAmount: '', approvalDate: '', expiryDate: '', notes: '' });
  const [savingApproval, setSavingApproval] = useState(false);

  const [newDocType, setNewDocType] = useState('');
  const [addingDoc, setAddingDoc] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  const [collectingLine, setCollectingLine] = useState<string | null>(null);
  const [showFinalize, setShowFinalize] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  const [disbursingBank, setDisbursingBank] = useState(false);

  // Activity / notes (read-only display)
  const [notes, setNotes] = useState<Note[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<Deal>(`/deals/${id}`);
      setDeal(d);
      const pm = d.purchaseMethod as 'CASH' | 'BANK_FINANCING' | 'DEALERSHIP_INSTALLMENT';
      if (pm) setPayTab(pm);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [id]);

  const loadNotes = useCallback(async () => {
    try {
      const data = await apiFetch<Note[]>(`/deals/${id}/notes`);
      setNotes(data);
    } catch {
      setNotes([]); // ponytail: mock empty if API not ready
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (id) loadNotes(); }, [loadNotes]);

  async function action(path: string, method = 'POST', body?: object) {
    await apiFetch(`/deals/${id}/${path}`, { method, body: body ? JSON.stringify(body) : undefined });
    load();
  }

  const salePrice = Number(deal?.salePrice ?? 0);
  const adminFee = Number(deal?.adminFee ?? 0);
  const insurance = Number(deal?.insuranceFee ?? 0);
  const tradeInCredit = Number(deal?.tradeInCredit ?? 0);
  const vat = salePrice * 0.14;
  const totalDue = salePrice - tradeInCredit + adminFee + insurance + vat;

  const principal = Math.max(0, salePrice - ipForm.downPayment);
  // ponytail: preview calc mirrors service logic exactly
  let monthly = 0;
  let monthlyLast = 0; // only differs from monthly for AMORTIZING (decreasing)
  let totalPayable = 0;
  if (ipForm.durationMonths > 0) {
    const n = ipForm.durationMonths;
    const annual = ipForm.interestRate / 100;
    if (ipForm.calcMethod === 'AMORTIZING') {
      // متناقصة: fixed principal + interest on remaining balance
      const r = annual / 12;
      const chunk = principal / n;
      monthly = chunk + principal * r;               // first (highest)
      monthlyLast = chunk + chunk * r;               // last (lowest)
      totalPayable = principal * (1 + r * (n + 1) / 2);
    } else if (ipForm.calcMethod === 'COMPOUND') {
      // مركبة (A): compound total ÷ n
      totalPayable = principal * Math.pow(1 + annual, n / 12);
      monthly = totalPayable / n;
      monthlyLast = monthly;
    } else {
      // ثابتة: simple interest spread evenly
      totalPayable = principal + principal * annual * (n / 12);
      monthly = totalPayable / n;
      monthlyLast = monthly;
    }
  }

  async function generatePlan(e: React.FormEvent) {
    e.preventDefault(); setGeneratingPlan(true);
    try {
      await apiFetch(`/deals/${id}/installment-plan`, {
        method: 'POST',
        body: JSON.stringify({ principalAmount: principal, downPayment: ipForm.downPayment, interestRate: ipForm.interestRate, durationMonths: ipForm.durationMonths, calculationMethod: ipForm.calcMethod, totalPayable, monthlyInstallment: ipForm.calcMethod === 'AMORTIZING' ? undefined : monthly, firstInstallmentDate: ipForm.firstInstallmentDate }),
      });
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setGeneratingPlan(false); }
  }

  async function createFA(e: React.FormEvent) {
    e.preventDefault(); setSavingFA(true);
    try {
      await apiFetch(`/deals/${id}/finance-application`, { method: 'POST', body: JSON.stringify({ ...faForm, termMonths: Number(faForm.termMonths) || undefined, apr: Number(faForm.apr) || undefined }) });
      setShowFACreate(false); load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingFA(false); }
  }

  async function recordApproval(e: React.FormEvent) {
    e.preventDefault(); setSavingApproval(true);
    try {
      await apiFetch(`/deals/${id}/finance-application/bank-approval`, { method: 'POST', body: JSON.stringify({ ...approvalForm, approvedAmount: Number(approvalForm.approvedAmount) }) });
      setShowApproval(false); load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingApproval(false); }
  }

  async function updateBFS(bankFinancingStatus: string) {
    await apiFetch(`/deals/${id}/finance-application`, { method: 'PATCH', body: JSON.stringify({ bankFinancingStatus }) }).catch((e) => alert(e instanceof Error ? e.message : 'Error'));
    load();
  }

  async function addDoc() {
    if (!newDocType) return; setAddingDoc(true);
    try { await apiFetch(`/deals/${id}/finance-application/documents`, { method: 'POST', body: JSON.stringify({ documentType: newDocType }) }); setNewDocType(''); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setAddingDoc(false); }
  }

  async function updateDoc(docId: string, updates: object) {
    await apiFetch(`/deals/${id}/finance-application/documents/${docId}`, { method: 'PATCH', body: JSON.stringify(updates) }).catch((e) => alert(e instanceof Error ? e.message : 'Error'));
    load();
  }

  function triggerDocUpload(docId: string) { setPendingDocId(docId); docFileRef.current?.click(); }

  async function handleDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingDocId) return;
    setUploadingDocId(pendingDocId);
    try {
      const fd = new FormData(); fd.append('file', file);
      const tok = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const raw = await fetch(`${API}/upload/file`, { method: 'POST', headers: { Authorization: `Bearer ${tok ?? ''}` }, body: fd });
      if (!raw.ok) throw new Error((await raw.json().catch(() => ({}))).message ?? 'Upload failed');
      const res: { url: string } = await raw.json();
      await updateDoc(pendingDocId, { fileUrl: res.url, status: 'SUBMITTED' });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploadingDocId(null); setPendingDocId(null); if (docFileRef.current) docFileRef.current.value = ''; }
  }

  async function collectInstallment(lineId: string) {
    if (!confirm(isAr ? 'تسجيل القسط كمحصّل وترحيل القيد المحاسبي؟' : 'Mark as collected and post GL entry?')) return;
    setCollectingLine(lineId);
    try {
      const result = await apiFetch<{ installmentPlan?: { installments?: { id: string; paymentId?: string }[] } }>(
        `/deals/${id}/installment-plan/lines/${lineId}/collect`, { method: 'POST' }
      );
      load();
      const collected = result?.installmentPlan?.installments?.find((l) => l.id === lineId);
      const receiptUrl = collected?.paymentId
        ? `/finance/payments/${collected.paymentId}/receipt`
        : `/deals/${id}/lines/${lineId}/receipt`;
      if (confirm(isAr ? 'تم التسجيل. هل تريد طباعة الإيصال؟' : 'Collected. Print receipt?')) {
        window.open(receiptUrl, '_blank');
      }
    }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setCollectingLine(null); }
  }

  async function runFinalize() {
    setFinalizing(true); setFinalizeError('');
    try { await apiFetch(`/deals/${id}/finalize`, { method: 'POST' }); load(); setShowFinalize(false); }
    catch (e: unknown) { setFinalizeError(e instanceof Error ? e.message : 'Error'); }
    finally { setFinalizing(false); }
  }

  async function postBankDisbursement() {
    if (!confirm(isAr ? 'ترحيل قيد صرف البنك؟' : 'Post bank disbursement GL entry?')) return;
    setDisbursingBank(true);
    try { await apiFetch(`/deals/${id}/bank-disbursement`, { method: 'POST' }); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setDisbursingBank(false); }
  }


  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-3)' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</div>;
  if (error) return <div style={{ padding: '2rem', color: 'var(--danger-fg)' }}>{error}</div>;
  if (!deal) return null;

  const fa = deal.financeApplication;
  const canFinalize = ['DRAFT', 'PENDING_FINANCE', 'APPROVED'].includes(deal.status);
  const canCancel = ['DRAFT', 'PENDING_FINANCE'].includes(deal.status);
  const custName = deal.customer?.name ?? '—';
  const repName = deal.salesRep?.name ?? '';
  const dealNum = deal.dealNumber ? `#${deal.dealNumber}` : `#${deal.id.slice(-4).toUpperCase()}`;

  const BFS_STEPS = isAr
    ? ['تم إرسال المستندات', 'قيد المراجعة', 'موافقة البنك', 'تم الصرف']
    : ['Documents Sent', 'Under Review', 'Bank Approved', 'Disbursed'];
  const bfsStepIdx = (() => {
    const s = fa?.bankFinancingStatus ?? '';
    if (s === 'APPROVED') return 2;
    if (s === 'UNDER_REVIEW' || s === 'SUBMITTED') return 1;
    return 0;
  })();

  const installments = deal.installmentPlan?.installments ?? [];
  const paidCount = installments.filter((l) => l.status === 'PAID').length;
  const totalCount = installments.length;
  const nextDue = installments.find((l) => ['PENDING', 'UPCOMING', 'OVERDUE'].includes(l.status));

  return (
    <div style={{ padding: '1.25rem 1.5rem' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
        <Link href="/deals" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>{isAr ? 'الصفقات' : 'Deals'}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-1)' }}>{isAr ? `الصفقة ${dealNum}` : `Deal ${dealNum}`}</span>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">{isAr ? `الصفقة ${dealNum} — ${custName}` : `Deal ${dealNum} — ${custName}`}</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span>{deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : '—'}</span>
            {deal.location?.name && <span>· {deal.location.name}</span>}
            <span>·</span>
            <span className={`badge ${statusBadgeClass(deal.status)}`} style={{ fontSize: '0.625rem' }}>
              {isAr ? ({ DRAFT: 'مسودة', PENDING_FINANCE: 'قيد المراجعة', APPROVED: 'موافق عليها', FINALIZED: 'مكتملة', CANCELLED: 'ملغاة' } as Record<string,string>)[deal.status] ?? deal.status : STEP_LABEL[deal.status] ?? deal.status}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {canFinalize && (
            <button className="btn btn-primary btn-sm" onClick={() => { setShowFinalize(true); setFinalizeError(''); }}>
              {isAr ? 'إتمام الصفقة' : 'Finalize Deal'}
            </button>
          )}
          {canCancel && (
            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger-fg)', borderColor: 'var(--danger)' }}
              onClick={() => { if (confirm(isAr ? 'هل أنت متأكد من إلغاء هذه الصفقة؟' : 'Cancel this deal?')) action('cancel'); }}>
              {isAr ? 'إلغاء الصفقة' : 'Cancel Deal'}
            </button>
          )}
        </div>
      </div>

      {/* Status progress bar */}
      {deal.status !== 'CANCELLED' && (
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex' }}>
            {STATUS_STEPS.map((s, i) => {
              const activeIdx = STATUS_STEPS.indexOf(deal.status);
              const isDone = i < activeIdx;
              const isActive = i === activeIdx;
              return (
                <div key={s} className={`step-item${isDone ? ' done' : ''}`}>
                  <div className={`step-circle${isDone ? ' done' : isActive ? ' active' : ''}`}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className={`step-label${isActive ? ' active' : ''}`}>{isAr ? ({ DRAFT: 'مسودة', PENDING_FINANCE: 'قيد المراجعة', APPROVED: 'موافق عليها', FINALIZED: 'مكتملة', CANCELLED: 'ملغاة' } as Record<string,string>)[s] ?? s : STEP_LABEL[s]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment method tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'CASH' as const, label: isAr ? '💵 كاش' : '💵 Cash' },
          { key: 'BANK_FINANCING' as const, label: isAr ? '🏦 تمويل بنكي' : '🏦 Bank Financing' },
          { key: 'DEALERSHIP_INSTALLMENT' as const, label: isAr ? '📋 خطة التقسيط' : '📋 Installment Plan' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setPayTab(t.key)}
            style={{
              padding: '0.45rem 1rem', borderRadius: '0.45rem', fontSize: '0.8125rem', fontWeight: 500,
              cursor: 'pointer', border: '2px solid', transition: 'all 150ms',
              background: payTab === t.key ? 'transparent' : 'var(--surface)',
              color: payTab === t.key ? 'var(--primary)' : 'var(--text-2)',
              borderColor: payTab === t.key ? 'var(--primary)' : 'var(--border)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem', alignItems: 'start' }}>

        {/* LEFT: tab content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Pricing breakdown */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <p className="section-label" style={{ marginBottom: '0.875rem' }}>{isAr ? 'تفاصيل التسعير' : 'Pricing Breakdown'}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <PricingRow label={isAr ? 'سعر البيع' : 'Vehicle Sale Price'} value={fmt(salePrice)} />
                {tradeInCredit > 0 && <PricingRow label={isAr ? 'خصم المقايضة' : 'Trade-In Credit'} value={`- ${fmt(tradeInCredit)}`} valueColor="var(--success-fg)" />}
                {adminFee > 0 && <PricingRow label={isAr ? 'الرسوم الإدارية' : 'Administration Fee'} value={fmt(adminFee)} />}
                {insurance > 0 && <PricingRow label={isAr ? 'التأمين الإلزامي' : 'Compulsory Insurance'} value={fmt(insurance)} />}
                <PricingRow label={isAr ? 'ضريبة المبيعات (14%)' : 'Sales Tax (14%)'} value={fmt(vat)} />
                <tr>
                  <td style={{ padding: '0.75rem 0 0', borderTop: '2px solid var(--border-strong)', fontWeight: 700, color: 'var(--text-1)', fontSize: '1rem' }}>{isAr ? 'الإجمالي المستحق' : 'Total Due'}</td>
                  <td style={{ padding: '0.75rem 0 0', borderTop: '2px solid var(--border-strong)', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{fmt(totalDue)}</td>
                </tr>
              </tbody>
            </table>

            {payTab === 'CASH' && canFinalize && (
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', padding: '0.7rem', fontSize: '0.9375rem' }}
                onClick={() => { setShowFinalize(true); setFinalizeError(''); }}>
                {isAr ? '💵 تسجيل الدفع الكامل وإتمام الصفقة' : '💵 Record Full Payment & Finalize Deal'}
              </button>
            )}
          </div>

          {/* Trade-In */}
          {deal.tradeIn && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '0.875rem' }}>{isAr ? 'مركبة المقايضة' : 'Trade-In Vehicle'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {deal.tradeIn.vin && <InfoField label="VIN" value={deal.tradeIn.vin} />}
                {(deal.tradeIn.make || deal.tradeIn.model) && <InfoField label={isAr ? 'الماركة / الموديل' : 'Make / Model'} value={`${deal.tradeIn.make ?? ''} ${deal.tradeIn.model ?? ''} ${deal.tradeIn.year ?? ''}`} />}
                {deal.tradeIn.mileage !== undefined && <InfoField label={isAr ? 'عداد الكيلومترات' : 'Mileage'} value={`${Number(deal.tradeIn.mileage).toLocaleString('en-EG')} km`} />}
                {deal.tradeIn.condition && <InfoField label={isAr ? 'الحالة' : 'Condition'} value={deal.tradeIn.condition} />}
                {deal.tradeIn.agreedValue !== undefined && <InfoField label={isAr ? 'قيمة المقايضة المتفق عليها' : 'Agreed Trade-In Value'} value={fmt(Number(deal.tradeIn.agreedValue))} />}
              </div>
            </div>
          )}

          {/* ── BANK FINANCING TAB ───────────────────────────────────────── */}
          <div style={{ display: payTab === 'BANK_FINANCING' ? 'block' : 'none' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <p className="section-label" style={{ margin: 0 }}>{isAr ? '🏦 طلب التمويل البنكي' : '🏦 Bank Financing Application'}</p>
                {!fa && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowFACreate(true)}>{isAr ? '+ إنشاء طلب' : '+ Create Application'}</button>
                )}
              </div>

              {!fa ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{isAr ? 'لا يوجد طلب تمويل بعد.' : 'No finance application yet.'}</p>
              ) : (
                <>
                  {/* Bank + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{fa.bankName ?? 'Bank'}</span>
                    <div style={{ width: '200px' }}>
                      <SearchableCombobox options={BFS_OPTS} value={fa.bankFinancingStatus} onChange={updateBFS} placeholder={isAr ? 'تحديث الحالة…' : 'Update status…'} />
                    </div>
                  </div>

                  {/* BFS progress */}
                  <div style={{ display: 'flex', marginBottom: '1.25rem' }}>
                    {BFS_STEPS.map((s, i) => (
                      <div key={s} className={`step-item${i < bfsStepIdx ? ' done' : ''}`}>
                        <div className={`step-circle${i < bfsStepIdx ? ' done' : i === bfsStepIdx ? ' active' : ''}`}>
                          {i < bfsStepIdx ? '✓' : i + 1}
                        </div>
                        <span className={`step-label${i === bfsStepIdx ? ' active' : ''}`}>{s}</span>
                      </div>
                    ))}
                  </div>

                  {/* Loan summary */}
                  {(fa.termMonths || fa.apr || fa.interestType) && (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '0.5rem' }}>
                      {fa.termMonths && <div><p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600 }}>{isAr ? 'المدة' : 'Term'}</p><p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{fa.termMonths} {isAr ? 'شهر' : 'mo'}</p></div>}
                      {fa.apr && <div><p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600 }}>{isAr ? 'معدل الفائدة' : 'Rate'}</p><p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{Number(fa.apr).toFixed(2)}%</p></div>}
                      {fa.interestType && <div><p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600 }}>{isAr ? 'نوع الفائدة' : 'Interest Type'}</p><p style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {isAr
                          ? ({ FLAT: 'ثابتة', COMPOUND: 'مركبة', AMORTIZING: 'متناقصة' } as Record<string,string>)[fa.interestType] ?? fa.interestType
                          : ({ FLAT: 'Fixed', COMPOUND: 'Compound', AMORTIZING: 'Declining' } as Record<string,string>)[fa.interestType] ?? fa.interestType}
                      </p></div>}
                    </div>
                  )}

                  {/* Documents */}
                  <p className="section-label" style={{ marginBottom: '0.75rem' }}>{isAr ? 'المستندات المطلوبة' : 'Required Documents'}</p>
                  <input ref={docFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleDocFileChange} />
                  <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '0.875rem' }}>
                    <table className="data-table">
                      <thead><tr><th>{isAr ? 'المستند' : 'Document'}</th><th>{isAr ? 'الحالة' : 'Status'}</th><th>{isAr ? 'إجراء' : 'Action'}</th></tr></thead>
                      <tbody>
                        {fa.requiredDocuments.map((doc) => (
                          <tr key={doc.id}>
                            <td>{doc.documentType.replace(/_/g, ' ')}</td>
                            <td><span className={`badge ${docStatusClass(doc.status)}`}>{doc.status}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <div style={{ width: '130px' }}>
                                  <SearchableCombobox options={DOC_STATUS_OPTS} value={doc.status}
                                    onChange={(s) => updateDoc(doc.id, { status: s })} placeholder={isAr ? 'الحالة' : 'Status'} />
                                </div>
                                {doc.fileUrl && (
                                  <a href={doc.fileUrl} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">{isAr ? 'عرض ↗' : 'View ↗'}</a>
                                )}
                                <button className="btn btn-secondary btn-sm" disabled={uploadingDocId === doc.id}
                                  onClick={() => triggerDocUpload(doc.id)}>
                                  {uploadingDocId === doc.id ? '…' : doc.fileUrl ? (isAr ? 'استبدال' : 'Replace') : (isAr ? 'رفع' : 'Upload')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <SearchableCombobox options={DOC_TYPES} value={newDocType} onChange={setNewDocType} placeholder={isAr ? 'إضافة نوع مستند…' : 'Add document type…'} />
                    </div>
                    <button className="btn btn-secondary btn-sm" disabled={addingDoc || !newDocType} onClick={addDoc}>
                      {addingDoc ? '…' : (isAr ? 'إضافة' : 'Add')}
                    </button>
                  </div>

                  {/* Bank approval */}
                  <div style={{ marginTop: '1.25rem' }}>
                    {fa.bankApproval ? (
                      <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '0.5rem', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                          <div>
                            <p style={{ fontWeight: 600, color: 'var(--success-fg)', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>{isAr ? 'تمت الموافقة البنكية' : 'Bank Approval Received'}</p>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{isAr ? 'المرجع:' : 'Ref:'} <strong>{fa.bankApproval.approvalReferenceNumber}</strong></p>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{isAr ? 'المبلغ المعتمد:' : 'Approved:'} <strong>{fmt(Number(fa.bankApproval.approvedAmount))}</strong></p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                              {fmtDate(fa.bankApproval.approvalDate, isAr)}
                              {fa.bankApproval.expiryDate ? (isAr ? ` · تنتهي ${fmtDate(fa.bankApproval.expiryDate, isAr)}` : ` · Expires ${fmtDate(fa.bankApproval.expiryDate, isAr)}`) : ''}
                            </p>
                          </div>
                          {deal.status === 'FINALIZED' && (
                            <button className="btn btn-primary btn-sm" disabled={disbursingBank} onClick={postBankDisbursement} style={{ flexShrink: 0 }}>
                              {disbursingBank ? '…' : (isAr ? 'ترحيل الصرف' : 'Post Disbursement')}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowApproval(true)}>{isAr ? '+ تسجيل موافقة بنكية' : '+ Record Bank Approval'}</button>
                    )}
                  </div>

                  {canFinalize && fa.bankApproval && (
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.7rem', fontSize: '0.875rem' }}
                      onClick={() => { setShowFinalize(true); setFinalizeError(''); }}>
                      {isAr ? '🏦 تسجيل صرف البنك وإتمام الصفقة' : '🏦 Record Bank Disbursement & Finalize'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── INSTALLMENT PLAN TAB ─────────────────────────────────────── */}
          <div style={{ display: payTab === 'DEALERSHIP_INSTALLMENT' ? 'block' : 'none' }}>
          {!deal.installmentPlan && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'إعداد خطة التقسيط' : 'Installment Plan Setup'}</p>
              <form onSubmit={generatePlan}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'الدفعة الأولى (جنيه)' : 'Down Payment (EGP)'}</label>
                    <NumericInput min="0" step="1000" className="input"
                      value={ipForm.downPayment}
                      onChange={(val) => setIpForm((p) => ({ ...p, downPayment: Number(val) }))} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'معدل الفائدة السنوي (%)' : 'Annual Interest Rate (%)'}</label>
                    <NumericInput min="0" step="0.1" className="input"
                      value={ipForm.interestRate}
                      onChange={(val) => setIpForm((p) => ({ ...p, interestRate: Number(val) }))} />
                  </div>
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="input-label">{isAr ? 'المدة' : 'Duration'}</label>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {DURATION_OPTIONS.map((m) => (
                      <button key={m} type="button"
                        style={{
                          padding: '0.35rem 0.7rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 500,
                          cursor: 'pointer', border: '1px solid', transition: 'all 150ms',
                          background: ipForm.durationMonths === m ? 'var(--primary)' : 'var(--surface)',
                          color: ipForm.durationMonths === m ? '#fff' : 'var(--text-2)',
                          borderColor: ipForm.durationMonths === m ? 'var(--primary)' : 'var(--border)',
                        }}
                        onClick={() => setIpForm((p) => ({ ...p, durationMonths: m }))}>
                        {isAr ? `${m} شهر` : `${m}mo`}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="input-label">{isAr ? 'طريقة الاحتساب' : 'Calculation Method'}</label>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {CALC_METHOD_OPTS.map((o) => (
                      <button key={o.value} type="button"
                        style={{
                          padding: '0.35rem 0.8rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 500,
                          cursor: 'pointer', border: '1px solid', transition: 'all 150ms',
                          background: ipForm.calcMethod === o.value ? 'var(--primary)' : 'var(--surface)',
                          color: ipForm.calcMethod === o.value ? '#fff' : 'var(--text-2)',
                          borderColor: ipForm.calcMethod === o.value ? 'var(--primary)' : 'var(--border)',
                        }}
                        onClick={() => setIpForm((p) => ({ ...p, calcMethod: o.value }))}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                  {(isAr
                    ? [['أصل المبلغ', fmt(principal)], ['إجمالي المدفوع', fmt(totalPayable)], ['القسط الشهري', ipForm.calcMethod === 'AMORTIZING' ? `${fmt(monthly)} ← ${fmt(monthlyLast)}` : fmt(monthly)]]
                    : [['Principal', fmt(principal)], ['Total Payable', fmt(totalPayable)], ['Monthly', ipForm.calcMethod === 'AMORTIZING' ? `${fmt(monthly)} → ${fmt(monthlyLast)}` : fmt(monthly)]]
                  ).map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--surface-2)', borderRadius: '0.375rem', padding: '0.625rem 0.875rem', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.2rem' }}>{l}</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{v}</p>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="input-label">{isAr ? 'تاريخ القسط الأول' : 'First Installment Date'}</label>
                  <input type="date" className="input" value={ipForm.firstInstallmentDate}
                    onChange={(e) => setIpForm((p) => ({ ...p, firstInstallmentDate: e.target.value }))} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                    {isAr ? 'يمكن تأجيل القسط الأول (عرض ترحيب، فترة سماح)' : 'Defer the first installment for grace-period or welcome offers'}
                  </p>
                </div>
                <button type="submit" disabled={generatingPlan} className="btn btn-primary">
                  {generatingPlan ? '…' : (isAr ? 'إنشاء الجدول' : 'Generate Schedule')}
                </button>
              </form>
            </div>
          )}

          {deal.installmentPlan && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '0.875rem' }}>{isAr ? 'جدول السداد' : 'Payment Schedule'}</p>
              <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                      <th style={{ textAlign: 'right' }}>{isAr ? 'أصل' : 'Principal'}</th>
                      <th style={{ textAlign: 'right' }}>{isAr ? 'فائدة' : 'Interest'}</th>
                      <th style={{ textAlign: 'right' }}>{isAr ? 'الإجمالي' : 'Total Due'}</th>
                      <th>{isAr ? 'الحالة' : 'Status'}</th><th>{isAr ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((l) => (
                      <tr key={l.id} style={{ background: l.status === 'OVERDUE' ? 'var(--danger-bg)' : undefined }}>
                        <td>{l.installmentNumber}</td>
                        <td style={{ color: l.status === 'OVERDUE' ? 'var(--danger-fg)' : undefined, fontWeight: l.status === 'OVERDUE' ? 600 : undefined }}>
                          {fmtDate(l.dueDate, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>{l.principalPortion !== undefined ? fmt(Number(l.principalPortion)) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{l.interestPortion !== undefined ? fmt(Number(l.interestPortion)) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(Number(l.totalDue))}</td>
                        <td><span className={`badge ${installmentStatusClass(l.status)}`}>{isAr ? ({ PAID: 'مدفوع', PARTIAL: 'جزئي', PENDING: 'قيد الانتظار', OVERDUE: 'متأخر' } as Record<string,string>)[l.status] ?? l.status : l.status}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {['PENDING', 'OVERDUE', 'UPCOMING'].includes(l.status) && deal.status === 'FINALIZED' && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success-fg)', fontSize: '0.75rem' }}
                              disabled={collectingLine === l.id} onClick={() => collectInstallment(l.id)}>
                              {collectingLine === l.id ? '…' : (isAr ? 'تسجيل الدفع' : 'Record Payment')}
                            </button>
                          )}
                          {l.status === 'PAID' && (
                            <a
                              href={l.payment?.id
                                ? `/finance/payments/${l.payment.id}/receipt`
                                : `/deals/${id}/lines/${l.id}/receipt`}
                              target="_blank" rel="noreferrer"
                              className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>
                              {isAr ? '🖨 إيصال' : '🖨 Receipt'}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Customer */}
          <div className="card" style={{ padding: '1rem' }}>
            <p className="section-label">{isAr ? 'العميل' : 'Customer'}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span className="avatar" style={{ width: '2.25rem', height: '2.25rem', background: avatarColor(custName), color: '#fff', fontSize: '0.75rem' }}>
                {initials(custName)}
              </span>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>{custName}</p>
                {deal.customer?.phone && <p style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{deal.customer.phone}</p>}
                {deal.customer?.email && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{deal.customer.email}</p>}
              </div>
            </div>
          </div>

          {/* Vehicle */}
          <div className="card" style={{ padding: '1rem' }}>
            <p className="section-label">{isAr ? 'السيارة' : 'Vehicle'}</p>
            <div style={{ width: '100%', height: '88px', background: 'var(--surface-2)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '2.5rem' }}>🚗</span>
            </div>
            {deal.vehicle && (
              <>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '0.2rem' }}>
                  {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
                </p>
                {deal.vehicle.vin && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{isAr ? 'الشاسيه' : 'VIN'}: {deal.vehicle.vin}</p>}
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="badge badge-warning" style={{ fontSize: '0.625rem' }}>
                    {deal.vehicle.status === 'SOLD' ? (isAr ? 'مباع' : 'Sold') : (isAr ? 'متوفر ← محجوز' : 'Available → Reserved')}
                  </span>
                  <Link href={`/vehicles/${deal.vehicle.id}`} style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>
                    {isAr ? 'عرض' : 'View →'}
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Documents */}
          <div className="card" style={{ padding: '1rem' }}>
            <p className="section-label">{isAr ? 'المستندات' : 'Documents'}</p>
            {[
              { key: 'pa', label: isAr ? 'عقد الشراء' : 'Purchase Agreement', status: isAr ? 'بانتظار التوقيع' : 'Pending E-Signature' },
              { key: 'bs', label: isAr ? 'فاتورة البيع' : 'Bill of Sale', status: isAr ? 'لم يُنشأ بعد' : 'Not Generated' },
            ].map((doc) => (
              <div key={doc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-1)' }}>{doc.label}</p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{doc.status}</p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => deal && generatePurchaseAgreementPDF(deal)}
                >
                  {isAr ? 'إنشاء' : 'Generate'}
                </button>
              </div>
            ))}
          </div>

          {/* Sales rep */}
          {repName && (
            <div className="card" style={{ padding: '1rem' }}>
              <p className="section-label">{isAr ? 'مندوب المبيعات' : 'Sales Rep'}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span className="avatar" style={{ width: '2rem', height: '2rem', background: avatarColor(repName), color: '#fff', fontSize: '0.625rem' }}>
                  {initials(repName)}
                </span>
                <div>
                  <p style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-1)' }}>{repName}</p>
                  {(deal.commissions?.length ?? 0) > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)', fontWeight: 600 }}>
                      {isAr ? 'العمولة:' : 'Commission:'} {fmt(deal.commissions!.reduce((s, c) => s + Number(c.calculatedAmount), 0))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment progress (installment) */}
          {payTab === 'DEALERSHIP_INSTALLMENT' && deal.installmentPlan && totalCount > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <p className="section-label">{isAr ? 'تقدم السداد' : 'Payment Progress'}</p>
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '0.35rem' }}>
                  <span>{isAr ? `${paidCount} من ${totalCount} مسدد` : `${paidCount} of ${totalCount} paid`}</span>
                  <span>{Math.round((paidCount / totalCount) * 100)}%</span>
                </div>
                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(paidCount / totalCount) * 100}%`, background: 'var(--success)', borderRadius: '9999px', transition: 'width 300ms' }} />
                </div>
              </div>
              {nextDue && (
                <div style={{ marginTop: '0.875rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '0.375rem', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{isAr ? 'الاستحقاق القادم' : 'Next Due'}</p>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: nextDue.status === 'OVERDUE' ? 'var(--danger-fg)' : 'var(--text-1)' }}>
                    {fmt(Number(nextDue.totalDue))}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.1rem' }}>
                    {fmtDate(nextDue.dueDate, isAr, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  {deal.status === 'FINALIZED' && (
                    <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem', width: '100%' }}
                      disabled={collectingLine === nextDue.id} onClick={() => collectInstallment(nextDue.id)}>
                      {collectingLine === nextDue.id ? '…' : (isAr ? 'تسجيل الدفع' : 'Record Payment')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity Timeline ───────────────────────────────────────────── */}
      <div style={{ marginTop: '1.5rem' }}>
        <p className="section-label" style={{ marginBottom: '1rem' }}>{isAr ? 'النشاط' : 'Activity'}</p>

        {/* Timeline */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {notes.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.875rem' }}>
              {isAr ? 'لا يوجد نشاط بعد.' : 'No activity yet.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notes.map((note, idx) => (
                <div key={note.id} style={{ padding: '0.875rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', borderBottom: idx < notes.length - 1 ? '1px solid var(--border)' : undefined }}>
                  <span className={`badge ${NOTE_BADGE[note.type] ?? 'badge-neutral'}`} style={{ fontSize: '0.6875rem', flexShrink: 0, marginTop: '0.1rem' }}>
                    {isAr ? ({ NOTE: 'ملاحظة', CALL: 'مكالمة', EMAIL: 'بريد' } as Record<string,string>)[note.type] ?? note.type : note.type}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)', wordBreak: 'break-word' }}>{note.body}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
                      {note.author?.name ?? (isAr ? 'موظف' : 'Staff')} · {fmtDateTime(note.createdAt, isAr, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Finalize modal ──────────────────────────────────────────────── */}
      {showFinalize && (
        <Modal onClose={() => setShowFinalize(false)}>
          <h2 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)', marginBottom: '1rem' }}>{isAr ? 'تأكيد وإتمام الصفقة' : 'Confirm & Finalize Deal'}</h2>
          <SummaryRow label={isAr ? 'العميل' : 'Customer'} value={custName} />
          <SummaryRow label={isAr ? 'السيارة' : 'Vehicle'} value={deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : '—'} />
          <SummaryRow label={isAr ? 'طريقة الدفع' : 'Payment Method'} value={deal.purchaseMethod.replace(/_/g, ' ')} />
          <SummaryRow label={isAr ? 'سعر البيع' : 'Sale Price'} value={fmt(salePrice)} />
          <SummaryRow label={isAr ? 'الرسوم الإدارية' : 'Admin Fee'} value={fmt(adminFee)} />
          <SummaryRow label={isAr ? 'رسوم التأمين' : 'Insurance'} value={fmt(insurance)} />
          <SummaryRow label={isAr ? 'ضريبة 14%' : 'VAT 14%'} value={fmt(vat)} />
          <SummaryRow label={isAr ? 'الإجمالي المستحق' : 'Total Due'} value={fmt(totalDue)} bold />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '1rem 0' }}>
            {isAr ? 'سيتم ترحيل القيود المحاسبية، وتعليم السيارة كمباعة، واستحقاق عمولات المبيعات. لا يمكن التراجع.' : 'This posts GL journal entries, marks the vehicle SOLD, and accrues sales commissions. Cannot be undone.'}
          </p>
          {finalizeError && <p style={{ fontSize: '0.8125rem', color: 'var(--danger-fg)', marginBottom: '0.75rem' }}>{finalizeError}</p>}
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowFinalize(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)', borderColor: 'var(--success)' }}
              disabled={finalizing} onClick={runFinalize}>
              {finalizing ? (isAr ? 'جاري الإتمام…' : 'Finalizing…') : (isAr ? 'تأكيد الإتمام' : 'Confirm Finalize')}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Create Finance Application modal ─────────────────────────── */}
      {showFACreate && (
        <Modal onClose={() => setShowFACreate(false)}>
          <h2 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)', marginBottom: '1rem' }}>{isAr ? 'طلب تمويل جديد' : 'New Finance Application'}</h2>
          <form onSubmit={createFA} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <ModalField label={isAr ? 'اسم البنك *' : 'Bank Name *'} value={faForm.bankName} onChange={(v) => setFaForm((p) => ({ ...p, bankName: v }))} required />
            <ModalField label={isAr ? 'الفرع' : 'Branch'} value={faForm.bankBranch} onChange={(v) => setFaForm((p) => ({ ...p, bankBranch: v }))} />
            <ModalField label={isAr ? 'المدة (شهور)' : 'Term (months)'} type="number" value={faForm.termMonths} onChange={(v) => setFaForm((p) => ({ ...p, termMonths: v }))} />
            <ModalField label={isAr ? 'معدل الفائدة (%)' : 'Interest Rate (%)'} type="number" value={faForm.apr} onChange={(v) => setFaForm((p) => ({ ...p, apr: v }))} />
            <div>
              <p className="input-label">{isAr ? 'نوع الفائدة' : 'Interest Type'}</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(isAr
                  ? [{ value: 'FLAT', label: 'ثابتة' }, { value: 'COMPOUND', label: 'مركبة' }, { value: 'AMORTIZING', label: 'متناقصة' }]
                  : [{ value: 'FLAT', label: 'Fixed' }, { value: 'COMPOUND', label: 'Compound' }, { value: 'AMORTIZING', label: 'Declining' }]
                ).map(o => (
                  <button key={o.value} type="button" onClick={() => setFaForm(p => ({ ...p, interestType: o.value }))}
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', borderRadius: '0.375rem', border: '1px solid', cursor: 'pointer',
                      background: faForm.interestType === o.value ? 'var(--primary)' : 'var(--surface)',
                      color: faForm.interestType === o.value ? '#fff' : 'var(--text-2)',
                      borderColor: faForm.interestType === o.value ? 'var(--primary)' : 'var(--border)' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowFACreate(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingFA}>{savingFA ? '…' : (isAr ? 'إنشاء' : 'Create')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Record Bank Approval modal ────────────────────────────────── */}
      {showApproval && (
        <Modal onClose={() => setShowApproval(false)}>
          <h2 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)', marginBottom: '1rem' }}>{isAr ? 'تسجيل موافقة البنك' : 'Record Bank Approval'}</h2>
          <form onSubmit={recordApproval} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <ModalField label={isAr ? 'مرجع الموافقة *' : 'Approval Reference # *'} value={approvalForm.approvalReferenceNumber} onChange={(v) => setApprovalForm((p) => ({ ...p, approvalReferenceNumber: v }))} required />
            <ModalField label={isAr ? 'المبلغ المعتمد (ج.م) *' : 'Approved Amount (EGP) *'} type="number" value={approvalForm.approvedAmount} onChange={(v) => setApprovalForm((p) => ({ ...p, approvedAmount: v }))} required />
            <ModalField label={isAr ? 'تاريخ الموافقة *' : 'Approval Date *'} type="date" value={approvalForm.approvalDate} onChange={(v) => setApprovalForm((p) => ({ ...p, approvalDate: v }))} required />
            <ModalField label={isAr ? 'تاريخ الانتهاء' : 'Expiry Date'} type="date" value={approvalForm.expiryDate} onChange={(v) => setApprovalForm((p) => ({ ...p, expiryDate: v }))} />
            <ModalField label={isAr ? 'ملاحظات' : 'Notes'} value={approvalForm.notes} onChange={(v) => setApprovalForm((p) => ({ ...p, notes: v }))} />
            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowApproval(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, background: 'var(--success)', borderColor: 'var(--success)' }}
                disabled={savingApproval}>{savingApproval ? '…' : (isAr ? 'تسجيل' : 'Record')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ── Helper sub-components ──────────────────────────────────────────────── */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: '480px', padding: '1.5rem', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        {children}
      </div>
    </div>
  );
}

function PricingRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <tr>
      <td style={{ padding: '0.5rem 0', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>{label}</td>
      <td style={{ padding: '0.5rem 0', textAlign: 'right', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', color: valueColor ?? 'var(--text-1)', fontWeight: 500 }}>{value}</td>
    </tr>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem' }}>{label}</p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span style={{ color: bold ? 'var(--primary)' : 'var(--text-1)', fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

function ModalField({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="input-label">{label}</label>
      {type === 'number'
        ? <NumericInput className="input" value={value} onChange={onChange} />
        : <input type={type} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required} />}
    </div>
  );
}
