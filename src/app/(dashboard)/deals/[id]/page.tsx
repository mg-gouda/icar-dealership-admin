'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
const token = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
const fmt = (n: number) => 'EGP ' + Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers ?? {}) } });
  if (!res.ok) { const e = await res.json().catch(() => ({ message: res.statusText })); throw new Error(e.message ?? res.statusText); }
  return res.json();
}

/* ── Types ─────────────────────────────────────────────────────────────── */
interface InstallmentLine { id: string; dueDate: string; amount: number; principalPart?: number; interestPart?: number; status: string; sequence: number; }
interface Document { id: string; documentType: string; status: string; fileUrl?: string; }
interface BankApproval { approvalReferenceNumber: string; approvedAmount: number; approvalDate: string; expiryDate?: string; notes?: string; }
interface FinanceApp {
  id: string; status: string; bankFinancingStatus: string;
  bankName?: string; bankBranch?: string;
  termMonths?: number; apr?: number;
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

const DOC_STATUS_OPTS = [
  { value: 'PENDING', label: 'Pending' }, { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'VERIFIED', label: 'Verified' }, { value: 'REJECTED', label: 'Rejected' },
];

const BFS_OPTS = [
  { value: 'DOCUMENTS_PENDING', label: 'Documents Pending' },
  { value: 'SUBMITTED', label: 'Submitted to Bank' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const CALC_METHOD_OPTS = [{ value: 'FLAT_RATE', label: 'Flat Rate' }, { value: 'REDUCING_BALANCE', label: 'Amortizing' }];
const DURATION_OPTIONS = [12, 24, 36, 48, 60];

function defaultStartDate(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10);
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payTab, setPayTab] = useState<'CASH' | 'BANK_FINANCING' | 'DEALERSHIP_INSTALLMENT'>('CASH');

  const [ipForm, setIpForm] = useState({ downPayment: 0, durationMonths: 24, interestRate: 0, calcMethod: 'FLAT_RATE', startDate: defaultStartDate() });
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const [showFACreate, setShowFACreate] = useState(false);
  const [faForm, setFaForm] = useState({ bankName: '', bankBranch: '', termMonths: '', apr: '' });
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

  useEffect(() => { load(); }, [load]);

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
  // ponytail: PMT formula for reducing balance; flat simple-interest for flat rate
  let monthly = 0;
  let totalPayable = 0;
  if (ipForm.calcMethod === 'REDUCING_BALANCE' && ipForm.durationMonths > 0 && ipForm.interestRate > 0) {
    const r = ipForm.interestRate / 100 / 12;
    monthly = principal * r * Math.pow(1 + r, ipForm.durationMonths) / (Math.pow(1 + r, ipForm.durationMonths) - 1);
    totalPayable = monthly * ipForm.durationMonths;
  } else {
    const totalInterest = principal * (ipForm.interestRate / 100) * (ipForm.durationMonths / 12);
    totalPayable = principal + totalInterest;
    monthly = ipForm.durationMonths > 0 ? totalPayable / ipForm.durationMonths : 0;
  }

  async function generatePlan(e: React.FormEvent) {
    e.preventDefault(); setGeneratingPlan(true);
    try {
      await apiFetch(`/deals/${id}/installment-plan`, {
        method: 'POST',
        body: JSON.stringify({ principalAmount: principal, downPayment: ipForm.downPayment, interestRate: ipForm.interestRate, durationMonths: ipForm.durationMonths, calculationMethod: ipForm.calcMethod, totalPayable, monthlyInstallment: monthly, startDate: ipForm.startDate }),
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
      await updateDoc(pendingDocId, { fileUrl: res.url, status: 'UPLOADED' });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploadingDocId(null); setPendingDocId(null); if (docFileRef.current) docFileRef.current.value = ''; }
  }

  async function collectInstallment(lineId: string) {
    if (!confirm('Mark as collected and post GL entry?')) return;
    setCollectingLine(lineId);
    try { await apiFetch(`/deals/${id}/installment-plan/lines/${lineId}/collect`, { method: 'POST' }); load(); }
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
    if (!confirm('Post bank disbursement GL entry?')) return;
    setDisbursingBank(true);
    try { await apiFetch(`/deals/${id}/bank-disbursement`, { method: 'POST' }); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setDisbursingBank(false); }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-3)' }}>Loading…</div>;
  if (error) return <div style={{ padding: '2rem', color: 'var(--danger-fg)' }}>{error}</div>;
  if (!deal) return null;

  const fa = deal.financeApplication;
  const canFinalize = ['DRAFT', 'PENDING_FINANCE', 'APPROVED'].includes(deal.status);
  const canCancel = ['DRAFT', 'PENDING_FINANCE'].includes(deal.status);
  const custName = deal.customer?.name ?? '—';
  const repName = deal.salesRep?.name ?? '';
  const dealNum = deal.dealNumber ? `#${deal.dealNumber}` : `#${deal.id.slice(-4).toUpperCase()}`;

  const BFS_STEPS = ['Documents Sent', 'Under Review', 'Bank Approved', 'Disbursed'];
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
        <Link href="/deals" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Deals</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-1)' }}>Deal {dealNum}</span>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Deal {dealNum} — {custName}</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span>{deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : '—'}</span>
            {deal.location?.name && <span>· {deal.location.name}</span>}
            <span>·</span>
            <span className={`badge ${statusBadgeClass(deal.status)}`} style={{ fontSize: '0.625rem' }}>
              {STEP_LABEL[deal.status] ?? deal.status}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {canFinalize && (
            <button className="btn btn-primary btn-sm" onClick={() => { setShowFinalize(true); setFinalizeError(''); }}>
              Finalize Deal
            </button>
          )}
          {canCancel && (
            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger-fg)', borderColor: 'var(--danger)' }}
              onClick={() => { if (confirm('Cancel this deal?')) action('cancel'); }}>
              Cancel
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
                  <span className={`step-label${isActive ? ' active' : ''}`}>{STEP_LABEL[s]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment method tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'CASH' as const, label: '💵 Cash' },
          { key: 'BANK_FINANCING' as const, label: '🏦 Bank Financing' },
          { key: 'DEALERSHIP_INSTALLMENT' as const, label: '📋 Installment Plan' },
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
            <p className="section-label" style={{ marginBottom: '0.875rem' }}>Pricing Breakdown</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <PricingRow label="Vehicle Sale Price" value={fmt(salePrice)} />
                {tradeInCredit > 0 && <PricingRow label="Trade-In Credit" value={`- ${fmt(tradeInCredit)}`} valueColor="var(--success-fg)" />}
                {adminFee > 0 && <PricingRow label="Administration Fee" value={fmt(adminFee)} />}
                {insurance > 0 && <PricingRow label="Compulsory Insurance" value={fmt(insurance)} />}
                <PricingRow label="Sales Tax (14%)" value={fmt(vat)} />
                <tr>
                  <td style={{ padding: '0.75rem 0 0', borderTop: '2px solid var(--border-strong)', fontWeight: 700, color: 'var(--text-1)', fontSize: '1rem' }}>Total Due</td>
                  <td style={{ padding: '0.75rem 0 0', borderTop: '2px solid var(--border-strong)', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{fmt(totalDue)}</td>
                </tr>
              </tbody>
            </table>

            {payTab === 'CASH' && canFinalize && (
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', padding: '0.7rem', fontSize: '0.9375rem' }}
                onClick={() => { setShowFinalize(true); setFinalizeError(''); }}>
                💵 Record Full Payment &amp; Finalize Deal
              </button>
            )}
          </div>

          {/* Trade-In */}
          {deal.tradeIn && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '0.875rem' }}>Trade-In Vehicle</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {deal.tradeIn.vin && <InfoField label="VIN" value={deal.tradeIn.vin} />}
                {(deal.tradeIn.make || deal.tradeIn.model) && <InfoField label="Make / Model" value={`${deal.tradeIn.make ?? ''} ${deal.tradeIn.model ?? ''} ${deal.tradeIn.year ?? ''}`} />}
                {deal.tradeIn.mileage !== undefined && <InfoField label="Mileage" value={`${Number(deal.tradeIn.mileage).toLocaleString('en-EG')} km`} />}
                {deal.tradeIn.condition && <InfoField label="Condition" value={deal.tradeIn.condition} />}
                {deal.tradeIn.agreedValue !== undefined && <InfoField label="Agreed Trade-In Value" value={fmt(Number(deal.tradeIn.agreedValue))} />}
              </div>
            </div>
          )}

          {/* ── BANK FINANCING TAB ───────────────────────────────────────── */}
          <div style={{ display: payTab === 'BANK_FINANCING' ? 'block' : 'none' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <p className="section-label" style={{ margin: 0 }}>🏦 Bank Financing Application</p>
                {!fa && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowFACreate(true)}>+ Create Application</button>
                )}
              </div>

              {!fa ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>No finance application yet.</p>
              ) : (
                <>
                  {/* Bank + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{fa.bankName ?? 'Bank'}</span>
                    <div style={{ width: '200px' }}>
                      <SearchableCombobox options={BFS_OPTS} value={fa.bankFinancingStatus} onChange={updateBFS} placeholder="Update status…" />
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

                  {/* Documents */}
                  <p className="section-label" style={{ marginBottom: '0.75rem' }}>Required Documents</p>
                  <input ref={docFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleDocFileChange} />
                  <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '0.875rem' }}>
                    <table className="data-table">
                      <thead><tr><th>Document</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {fa.requiredDocuments.map((doc) => (
                          <tr key={doc.id}>
                            <td>{doc.documentType.replace(/_/g, ' ')}</td>
                            <td><span className={`badge ${docStatusClass(doc.status)}`}>{doc.status}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <div style={{ width: '130px' }}>
                                  <SearchableCombobox options={DOC_STATUS_OPTS} value={doc.status}
                                    onChange={(s) => updateDoc(doc.id, { status: s })} placeholder="Status" />
                                </div>
                                {doc.fileUrl && (
                                  <a href={doc.fileUrl} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">View ↗</a>
                                )}
                                <button className="btn btn-secondary btn-sm" disabled={uploadingDocId === doc.id}
                                  onClick={() => triggerDocUpload(doc.id)}>
                                  {uploadingDocId === doc.id ? '…' : doc.fileUrl ? 'Replace' : 'Upload'}
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
                      <SearchableCombobox options={DOC_TYPES} value={newDocType} onChange={setNewDocType} placeholder="Add document type…" />
                    </div>
                    <button className="btn btn-secondary btn-sm" disabled={addingDoc || !newDocType} onClick={addDoc}>
                      {addingDoc ? '…' : 'Add'}
                    </button>
                  </div>

                  {/* Bank approval */}
                  <div style={{ marginTop: '1.25rem' }}>
                    {fa.bankApproval ? (
                      <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '0.5rem', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                          <div>
                            <p style={{ fontWeight: 600, color: 'var(--success-fg)', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>Bank Approval Received</p>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>Ref: <strong>{fa.bankApproval.approvalReferenceNumber}</strong></p>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>Approved: <strong>{fmt(Number(fa.bankApproval.approvedAmount))}</strong></p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                              {new Date(fa.bankApproval.approvalDate).toLocaleDateString('en-EG')}
                              {fa.bankApproval.expiryDate ? ` · Expires ${new Date(fa.bankApproval.expiryDate).toLocaleDateString('en-EG')}` : ''}
                            </p>
                          </div>
                          {deal.status === 'FINALIZED' && (
                            <button className="btn btn-primary btn-sm" disabled={disbursingBank} onClick={postBankDisbursement} style={{ flexShrink: 0 }}>
                              {disbursingBank ? '…' : 'Post Disbursement'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowApproval(true)}>+ Record Bank Approval</button>
                    )}
                  </div>

                  {canFinalize && fa.bankApproval && (
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.7rem', fontSize: '0.875rem' }}
                      onClick={() => { setShowFinalize(true); setFinalizeError(''); }}>
                      🏦 Record Bank Disbursement &amp; Finalize
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
              <p className="section-label" style={{ marginBottom: '1rem' }}>Installment Plan Setup</p>
              <form onSubmit={generatePlan}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label className="input-label">Down Payment (EGP)</label>
                    <input type="number" min="0" step="1000" className="input"
                      value={ipForm.downPayment}
                      onChange={(e) => setIpForm((p) => ({ ...p, downPayment: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="input-label">Annual Interest Rate (%)</label>
                    <input type="number" min="0" step="0.1" className="input"
                      value={ipForm.interestRate}
                      onChange={(e) => setIpForm((p) => ({ ...p, interestRate: Number(e.target.value) }))} />
                  </div>
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="input-label">Duration</label>
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
                        {m}mo
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="input-label">Calculation Method</label>
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
                  {[['Principal', fmt(principal)], ['Total Payable', fmt(totalPayable)], ['Monthly', fmt(monthly)]].map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--surface-2)', borderRadius: '0.375rem', padding: '0.625rem 0.875rem', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.2rem' }}>{l}</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{v}</p>
                    </div>
                  ))}
                </div>
                <button type="submit" disabled={generatingPlan} className="btn btn-primary">
                  {generatingPlan ? '…' : 'Generate Schedule'}
                </button>
              </form>
            </div>
          )}

          {deal.installmentPlan && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <p className="section-label" style={{ marginBottom: '0.875rem' }}>Payment Schedule</p>
              <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Due Date</th>
                      <th style={{ textAlign: 'right' }}>Principal</th>
                      <th style={{ textAlign: 'right' }}>Interest</th>
                      <th style={{ textAlign: 'right' }}>Total Due</th>
                      <th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((l) => (
                      <tr key={l.id} style={{ background: l.status === 'OVERDUE' ? 'var(--danger-bg)' : undefined }}>
                        <td>{l.sequence}</td>
                        <td style={{ color: l.status === 'OVERDUE' ? 'var(--danger-fg)' : undefined, fontWeight: l.status === 'OVERDUE' ? 600 : undefined }}>
                          {new Date(l.dueDate).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>{l.principalPart !== undefined ? fmt(l.principalPart) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{l.interestPart !== undefined ? fmt(l.interestPart) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(Number(l.amount))}</td>
                        <td><span className={`badge ${installmentStatusClass(l.status)}`}>{l.status}</span></td>
                        <td>
                          {['PENDING', 'OVERDUE', 'UPCOMING'].includes(l.status) && deal.status === 'FINALIZED' && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success-fg)', fontSize: '0.75rem' }}
                              disabled={collectingLine === l.id} onClick={() => collectInstallment(l.id)}>
                              {collectingLine === l.id ? '…' : 'Record Payment'}
                            </button>
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
            <p className="section-label">Customer</p>
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
            <p className="section-label">Vehicle</p>
            <div style={{ width: '100%', height: '88px', background: 'var(--surface-2)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '2.5rem' }}>🚗</span>
            </div>
            {deal.vehicle && (
              <>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '0.2rem' }}>
                  {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
                </p>
                {deal.vehicle.vin && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>VIN: {deal.vehicle.vin}</p>}
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="badge badge-warning" style={{ fontSize: '0.625rem' }}>
                    {deal.vehicle.status === 'SOLD' ? 'Sold' : 'Available → Reserved'}
                  </span>
                  <Link href={`/vehicles/${deal.vehicle.id}`} style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>
                    View →
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Documents */}
          <div className="card" style={{ padding: '1rem' }}>
            <p className="section-label">Documents</p>
            {[{ label: 'Purchase Agreement', status: 'Pending E-Signature' }, { label: 'Bill of Sale', status: 'Not Generated' }].map((doc) => (
              <div key={doc.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-1)' }}>{doc.label}</p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{doc.status}</p>
                </div>
                <button className="btn btn-secondary btn-sm">Generate</button>
              </div>
            ))}
          </div>

          {/* Sales rep */}
          {repName && (
            <div className="card" style={{ padding: '1rem' }}>
              <p className="section-label">Sales Rep</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span className="avatar" style={{ width: '2rem', height: '2rem', background: avatarColor(repName), color: '#fff', fontSize: '0.625rem' }}>
                  {initials(repName)}
                </span>
                <div>
                  <p style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-1)' }}>{repName}</p>
                  {(deal.commissions?.length ?? 0) > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)', fontWeight: 600 }}>
                      Commission: {fmt(deal.commissions!.reduce((s, c) => s + Number(c.calculatedAmount), 0))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment progress (installment) */}
          {payTab === 'DEALERSHIP_INSTALLMENT' && deal.installmentPlan && totalCount > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <p className="section-label">Payment Progress</p>
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '0.35rem' }}>
                  <span>{paidCount} of {totalCount} paid</span>
                  <span>{Math.round((paidCount / totalCount) * 100)}%</span>
                </div>
                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(paidCount / totalCount) * 100}%`, background: 'var(--success)', borderRadius: '9999px', transition: 'width 300ms' }} />
                </div>
              </div>
              {nextDue && (
                <div style={{ marginTop: '0.875rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '0.375rem', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Next Due</p>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: nextDue.status === 'OVERDUE' ? 'var(--danger-fg)' : 'var(--text-1)' }}>
                    {fmt(Number(nextDue.amount))}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.1rem' }}>
                    {new Date(nextDue.dueDate).toLocaleDateString('en-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  {deal.status === 'FINALIZED' && (
                    <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem', width: '100%' }}
                      disabled={collectingLine === nextDue.id} onClick={() => collectInstallment(nextDue.id)}>
                      {collectingLine === nextDue.id ? '…' : 'Record Payment'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Finalize modal ──────────────────────────────────────────────── */}
      {showFinalize && (
        <Modal onClose={() => setShowFinalize(false)}>
          <h2 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)', marginBottom: '1rem' }}>Confirm &amp; Finalize Deal</h2>
          <SummaryRow label="Customer" value={custName} />
          <SummaryRow label="Vehicle" value={deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : '—'} />
          <SummaryRow label="Payment Method" value={deal.purchaseMethod.replace(/_/g, ' ')} />
          <SummaryRow label="Sale Price" value={fmt(salePrice)} />
          <SummaryRow label="Admin Fee" value={fmt(adminFee)} />
          <SummaryRow label="Insurance" value={fmt(insurance)} />
          <SummaryRow label="VAT 14%" value={fmt(vat)} />
          <SummaryRow label="Total Due" value={fmt(totalDue)} bold />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '1rem 0' }}>
            This posts GL journal entries, marks the vehicle SOLD, and accrues sales commissions. Cannot be undone.
          </p>
          {finalizeError && <p style={{ fontSize: '0.8125rem', color: 'var(--danger-fg)', marginBottom: '0.75rem' }}>{finalizeError}</p>}
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowFinalize(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)', borderColor: 'var(--success)' }}
              disabled={finalizing} onClick={runFinalize}>
              {finalizing ? 'Finalizing…' : 'Confirm Finalize'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Create Finance Application modal ─────────────────────────── */}
      {showFACreate && (
        <Modal onClose={() => setShowFACreate(false)}>
          <h2 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)', marginBottom: '1rem' }}>New Finance Application</h2>
          <form onSubmit={createFA} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <ModalField label="Bank Name *" value={faForm.bankName} onChange={(v) => setFaForm((p) => ({ ...p, bankName: v }))} required />
            <ModalField label="Branch" value={faForm.bankBranch} onChange={(v) => setFaForm((p) => ({ ...p, bankBranch: v }))} />
            <ModalField label="Term (months)" type="number" value={faForm.termMonths} onChange={(v) => setFaForm((p) => ({ ...p, termMonths: v }))} />
            <ModalField label="APR (%)" type="number" value={faForm.apr} onChange={(v) => setFaForm((p) => ({ ...p, apr: v }))} />
            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowFACreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingFA}>{savingFA ? '…' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Record Bank Approval modal ────────────────────────────────── */}
      {showApproval && (
        <Modal onClose={() => setShowApproval(false)}>
          <h2 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)', marginBottom: '1rem' }}>Record Bank Approval</h2>
          <form onSubmit={recordApproval} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <ModalField label="Approval Reference # *" value={approvalForm.approvalReferenceNumber} onChange={(v) => setApprovalForm((p) => ({ ...p, approvalReferenceNumber: v }))} required />
            <ModalField label="Approved Amount (EGP) *" type="number" value={approvalForm.approvedAmount} onChange={(v) => setApprovalForm((p) => ({ ...p, approvedAmount: v }))} required />
            <ModalField label="Approval Date *" type="date" value={approvalForm.approvalDate} onChange={(v) => setApprovalForm((p) => ({ ...p, approvalDate: v }))} required />
            <ModalField label="Expiry Date" type="date" value={approvalForm.expiryDate} onChange={(v) => setApprovalForm((p) => ({ ...p, expiryDate: v }))} />
            <ModalField label="Notes" value={approvalForm.notes} onChange={(v) => setApprovalForm((p) => ({ ...p, notes: v }))} />
            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowApproval(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, background: 'var(--success)', borderColor: 'var(--success)' }}
                disabled={savingApproval}>{savingApproval ? '…' : 'Record'}</button>
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
      <input type={type} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
