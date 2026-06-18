'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface InstallmentLine { id: string; dueDate: string; amount: number; status: string; sequence: number; }
interface Document { id: string; documentType: string; status: string; fileUrl?: string; notes?: string; }
interface BankApproval { approvalReferenceNumber: string; approvedAmount: number; approvalDate: string; expiryDate?: string; notes?: string; }
interface FinanceApp {
  id: string; status: string; bankFinancingStatus: string;
  bankName?: string; bankBranch?: string; lenderName?: string;
  termMonths?: number; apr?: number; monthlyPayment?: number;
  creditScoreRange?: string; rejectionReason?: string;
  applicantInfo: Record<string, unknown>;
  requiredDocuments: Document[];
  bankApproval?: BankApproval;
}
interface DealCommission {
  id: string;
  userId: string;
  user: { id: string; name: string };
  roleInDeal: string;
  commissionPlan?: { name: string } | null;
  baseAmount: number;
  splitPercentage: number;
  calculatedAmount: number;
  status: string;
}
interface Deal {
  id: string; status: string; purchaseMethod: string; salePrice: number;
  adminFee?: number; insuranceFee?: number; createdAt: string;
  vehicle?: { id: string; make: string; model: string; year: number; vin?: string };
  customer?: { name: string; phone?: string; email?: string };
  salesRep?: { name: string };
  location?: { name: string };
  installmentPlan?: { downPayment: number; installmentAmount: number; numberOfInstallments: number; installments: InstallmentLine[]; };
  financeApplication?: FinanceApp;
  invoices?: { id: string; status: string; amountTotal: number; dueDate?: string }[];
  commissions?: DealCommission[];
}

const DOC_TYPES = [
  'NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'PROOF_OF_INCOME',
  'BANK_STATEMENT_6M', 'EMPLOYER_LETTER', 'CAR_LICENSE_BAYAN',
  'INSURANCE_CERTIFICATE', 'DOWN_PAYMENT_RECEIPT', 'OTHER',
].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));

const DOC_STATUS_OPTS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
];

const BFS_OPTS = [
  { value: 'DOCUMENTS_PENDING', label: 'Documents Pending' },
  { value: 'SUBMITTED', label: 'Submitted to Bank' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const CALC_METHOD_OPTS = [
  { value: 'FLAT_RATE', label: 'Flat Rate' },
  { value: 'REDUCING_BALANCE', label: 'Reducing Balance' },
];

const ROLE_OPTS = ['PRIMARY_SALES_REP', 'CLOSER', 'FINANCE_MANAGER', 'SALES_MANAGER'].map((r) => ({
  value: r,
  label: r.replace(/_/g, ' '),
}));

// ponytail: default startDate = today + 1 month
function defaultStartDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: deal, loading, error, reload } = useQuery<Deal>(`/deals/${id}`);

  // Finalize wizard
  const [showFinalize, setShowFinalize] = useState(false);
  const [finalizeStep, setFinalizeStep] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  // Installment collection
  const [collectingLine, setCollectingLine] = useState<string | null>(null);

  // ── Task A: Installment plan generate form ─────────────────────────────
  const [ipForm, setIpForm] = useState({
    downPayment: 0,
    durationMonths: 24,
    interestRate: 0,
    startDate: defaultStartDate(),
    calculationMethod: 'FLAT_RATE',
  });
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // recompute when deal loads so downPayment default is valid
  useEffect(() => {
    if (deal) setIpForm((f) => ({ ...f, startDate: defaultStartDate() }));
  }, [deal?.id]);

  const principalAmount = Math.max(0, Number(deal?.salePrice ?? 0) - ipForm.downPayment);
  const totalInterest = principalAmount * (ipForm.interestRate / 100) * (ipForm.durationMonths / 12);
  const totalPayable = principalAmount + totalInterest;
  const monthlyInstallment = ipForm.durationMonths > 0 ? totalPayable / ipForm.durationMonths : 0;

  async function generateInstallmentPlan(e: React.FormEvent) {
    e.preventDefault();
    setGeneratingPlan(true);
    try {
      await apiFetch(`/deals/${id}/installment-plan`, {
        method: 'POST',
        body: JSON.stringify({
          principalAmount,
          downPayment: ipForm.downPayment,
          interestRate: ipForm.interestRate,
          durationMonths: ipForm.durationMonths,
          calculationMethod: ipForm.calculationMethod,
          totalPayable,
          monthlyInstallment,
          startDate: ipForm.startDate,
        }),
      });
      reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error generating plan');
    } finally {
      setGeneratingPlan(false);
    }
  }

  // ── Task B: Commission add/remove ──────────────────────────────────────
  const [staffOptions, setStaffOptions] = useState<{ value: string; label: string }[]>([]);
  const [planOptions, setPlanOptions] = useState<{ value: string; label: string }[]>([]);
  const [commForm, setCommForm] = useState({
    userId: '',
    roleInDeal: '',
    commissionPlanId: '',
    baseAmount: 0,
    splitPercentage: 100,
  });
  const [addingComm, setAddingComm] = useState(false);
  const [removingComm, setRemovingComm] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/auth/users?limit=100')
      .then((res: unknown) => {
        const list = Array.isArray(res) ? res : (res as { data?: unknown[] }).data ?? [];
        setStaffOptions((list as { id: string; name: string }[]).map((u) => ({ value: u.id, label: u.name })));
      })
      .catch(() => {});
    apiFetch('/commission-plans?limit=50')
      .then((res: unknown) => {
        const list = Array.isArray(res) ? res : (res as { data?: unknown[] }).data ?? [];
        setPlanOptions((list as { id: string; name: string }[]).map((p) => ({ value: p.id, label: p.name })));
      })
      .catch(() => {});
  }, []);

  const commPreview = commForm.baseAmount > 0 && commForm.splitPercentage > 0
    ? (commForm.baseAmount * commForm.splitPercentage / 100).toLocaleString('en-EG')
    : null;

  async function addCommission(e: React.FormEvent) {
    e.preventDefault();
    setAddingComm(true);
    try {
      await apiFetch(`/deals/${id}/commissions`, {
        method: 'POST',
        body: JSON.stringify({
          userId: commForm.userId,
          roleInDeal: commForm.roleInDeal,
          ...(commForm.commissionPlanId ? { commissionPlanId: commForm.commissionPlanId } : {}),
          baseAmount: commForm.baseAmount,
          splitPercentage: commForm.splitPercentage,
        }),
      });
      setCommForm({ userId: '', roleInDeal: '', commissionPlanId: '', baseAmount: 0, splitPercentage: 100 });
      reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error adding commission');
    } finally {
      setAddingComm(false);
    }
  }

  async function removeCommission(commId: string) {
    if (!confirm('Remove this commission split?')) return;
    setRemovingComm(commId);
    try {
      await apiFetch(`/deals/${id}/commissions/${commId}`, { method: 'DELETE' });
      reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error removing commission');
    } finally {
      setRemovingComm(null);
    }
  }

  // ── Installment collection ────────────────────────────────────────────
  async function collectInstallment(lineId: string) {
    if (!confirm('Mark this installment as collected and post GL entry?')) return;
    setCollectingLine(lineId);
    try { await apiFetch(`/deals/${id}/installment-plan/lines/${lineId}/collect`, { method: 'POST' }); reload(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setCollectingLine(null); }
  }

  // ── Bank disbursement ──────────────────────────────────────────────────
  const [disbursingBank, setDisbursingBank] = useState(false);

  async function postBankDisbursement() {
    if (!confirm('Post bank disbursement GL entry? This records the bank transfer against the AR and cannot be undone.')) return;
    setDisbursingBank(true);
    try { await apiFetch(`/deals/${id}/bank-disbursement`, { method: 'POST' }); reload(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setDisbursingBank(false); }
  }

  // ── Finance app ────────────────────────────────────────────────────────
  const [showFACreate, setShowFACreate] = useState(false);
  const [faForm, setFaForm] = useState({ bankName: '', bankBranch: '', termMonths: '', apr: '', applicantInfo: '{}' });
  const [savingFA, setSavingFA] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [approvalForm, setApprovalForm] = useState({ approvalReferenceNumber: '', approvedAmount: '', approvalDate: '', expiryDate: '', notes: '' });
  const [savingApproval, setSavingApproval] = useState(false);
  const [newDocType, setNewDocType] = useState('');
  const [addingDoc, setAddingDoc] = useState(false);

  async function action(path: string, method = 'POST', body?: object) {
    await apiFetch(`/deals/${id}/${path}`, { method, body: body ? JSON.stringify(body) : undefined });
    reload();
  }

  async function runFinalize() {
    setFinalizing(true); setFinalizeError('');
    try { await apiFetch(`/deals/${id}/finalize`, { method: 'POST' }); reload(); setShowFinalize(false); setFinalizeStep(0); }
    catch (e: unknown) { setFinalizeError(e instanceof Error ? e.message : 'Error'); }
    finally { setFinalizing(false); }
  }

  async function createFA(e: React.FormEvent) {
    e.preventDefault(); setSavingFA(true);
    try {
      let applicantInfo = {};
      try { applicantInfo = JSON.parse(faForm.applicantInfo); } catch {}
      await apiFetch(`/deals/${id}/finance-application`, { method: 'POST', body: JSON.stringify({ ...faForm, applicantInfo, termMonths: Number(faForm.termMonths) || undefined, apr: Number(faForm.apr) || undefined }) });
      setShowFACreate(false); reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingFA(false); }
  }

  async function updateBFS(bankFinancingStatus: string) {
    await apiFetch(`/deals/${id}/finance-application`, { method: 'PATCH', body: JSON.stringify({ bankFinancingStatus }) }).catch((e) => alert(e instanceof Error ? e.message : 'Error'));
    reload();
  }

  async function addDoc() {
    if (!newDocType) return;
    setAddingDoc(true);
    try { await apiFetch(`/deals/${id}/finance-application/documents`, { method: 'POST', body: JSON.stringify({ documentType: newDocType }) }); setNewDocType(''); reload(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setAddingDoc(false); }
  }

  async function updateDoc(docId: string, updates: object) {
    await apiFetch(`/deals/${id}/finance-application/documents/${docId}`, { method: 'PATCH', body: JSON.stringify(updates) }).catch((e) => alert(e instanceof Error ? e.message : 'Error'));
    reload();
  }

  async function recordApproval(e: React.FormEvent) {
    e.preventDefault(); setSavingApproval(true);
    try {
      await apiFetch(`/deals/${id}/finance-application/bank-approval`, { method: 'POST', body: JSON.stringify({ ...approvalForm, approvedAmount: Number(approvalForm.approvedAmount) }) });
      setShowApproval(false); reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingApproval(false); }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">{error}</div>;
  if (!deal) return null;

  const subtotal = Number(deal.salePrice) + Number(deal.adminFee ?? 0) + Number(deal.insuranceFee ?? 0);
  const vat = Number(deal.salePrice) * 0.14;
  const total = subtotal + vat;
  const canFinalize = ['DRAFT', 'PENDING_FINANCE'].includes(deal.status);
  const canCancel = ['DRAFT', 'PENDING_FINANCE'].includes(deal.status);
  const fa = deal.financeApplication;
  const isBankFinancing = deal.purchaseMethod === 'BANK_FINANCING';
  const isInstallment = deal.purchaseMethod === 'DEALERSHIP_INSTALLMENT';

  const STEPS = isBankFinancing
    ? ['Review', 'Bank Financing', 'Confirm']
    : isInstallment
    ? ['Review', 'Installment Plan', 'Confirm']
    : ['Review', 'Confirm'];

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-xs mb-5 transition">← Deals</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Deal #{id.slice(-8).toUpperCase()}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{deal.purchaseMethod?.replace(/_/g, ' ')} · {deal.location?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={deal.status} />
          {canFinalize && (
            <button onClick={() => { setShowFinalize(true); setFinalizeStep(0); setFinalizeError(''); }}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg transition">
              Finalize Deal
            </button>
          )}
          {canCancel && (
            <button onClick={() => { if (confirm('Cancel this deal?')) action('cancel'); }}
              className="px-3 py-1.5 text-red-400 border border-red-400/30 hover:bg-red-400/10 text-sm rounded-lg transition">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Customer */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Customer</p>
          <p className="text-white font-medium">{deal.customer?.name ?? '—'}</p>
          <p className="text-gray-400 text-sm">{deal.customer?.phone}</p>
          <p className="text-gray-400 text-sm">{deal.customer?.email}</p>
        </div>
        {/* Vehicle */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Vehicle</p>
          <p className="text-white font-medium">{deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : '—'}</p>
          {deal.vehicle?.vin && <p className="text-gray-400 text-sm font-mono">VIN: {deal.vehicle.vin}</p>}
          {deal.vehicle && <Link href={`/vehicles/${deal.vehicle.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition">View vehicle →</Link>}
        </div>
        {/* Pricing */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Pricing (EGP)</p>
          {[['Sale Price', deal.salePrice], ['Admin Fee', deal.adminFee ?? 0], ['Insurance Fee', deal.insuranceFee ?? 0], ['VAT 14%', vat]].map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
              <span className="text-gray-400">{label as string}</span>
              <span className="text-white tabular-nums">{Number(val).toLocaleString()} EGP</span>
            </div>
          ))}
          <div className="flex justify-between text-sm py-2 font-semibold text-white mt-1">
            <span>Total</span><span className="tabular-nums">{total.toLocaleString()} EGP</span>
          </div>
        </div>

        {/* ── Task B: Sales Rep + Commissions ─────────────────────────── */}
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Sales Rep</p>
          <p className="text-white font-medium mb-3">{deal.salesRep?.name ?? '—'}</p>

          {/* Commission table */}
          {(deal.commissions?.length ?? 0) > 0 && (
            <table className="w-full text-xs mb-3">
              <thead className="text-gray-500 border-b border-white/5">
                <tr>
                  <th className="text-left pb-1.5">Staff</th>
                  <th className="text-left pb-1.5">Role</th>
                  <th className="text-right pb-1.5">Base</th>
                  <th className="text-right pb-1.5">Split%</th>
                  <th className="text-right pb-1.5">Amount</th>
                  <th className="text-left pb-1.5 pl-2">Status</th>
                  <th className="pb-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deal.commissions!.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 text-gray-300">{c.user?.name}</td>
                    <td className="py-1.5 text-gray-400">{c.roleInDeal?.replace(/_/g, ' ')}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-400">{Number(c.baseAmount).toLocaleString()}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-400">{c.splitPercentage}%</td>
                    <td className="py-1.5 text-right tabular-nums text-white">{Number(c.calculatedAmount).toLocaleString()} EGP</td>
                    <td className="py-1.5 pl-2"><StatusBadge status={c.status} /></td>
                    <td className="py-1.5 pl-1">
                      {c.status === 'ACCRUED' && deal.status !== 'FINALIZED' && (
                        <button
                          onClick={() => removeCommission(c.id)}
                          disabled={removingComm === c.id}
                          className="text-red-400 hover:text-red-300 disabled:opacity-40 transition"
                          title="Remove split"
                        >
                          {removingComm === c.id ? '…' : '✕'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Add Split form */}
          {deal.status !== 'FINALIZED' && (
            <form onSubmit={addCommission} className="space-y-2 pt-2 border-t border-white/5">
              <p className="text-xs text-gray-500 font-medium mb-1">Add Split</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Staff</label>
                  <SearchableCombobox
                    options={staffOptions}
                    value={commForm.userId}
                    onChange={(v) => setCommForm({ ...commForm, userId: v })}
                    placeholder="Select staff…"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <SearchableCombobox
                    options={ROLE_OPTS}
                    value={commForm.roleInDeal}
                    onChange={(v) => setCommForm({ ...commForm, roleInDeal: v })}
                    placeholder="Role…"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Commission Plan (optional)</label>
                <SearchableCombobox
                  options={planOptions}
                  value={commForm.commissionPlanId}
                  onChange={(v) => setCommForm({ ...commForm, commissionPlanId: v })}
                  placeholder="Plan…"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Base Amount (EGP)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={commForm.baseAmount}
                    onChange={(e) => setCommForm({ ...commForm, baseAmount: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Split %</label>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    value={commForm.splitPercentage}
                    onChange={(e) => setCommForm({ ...commForm, splitPercentage: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              {commPreview && (
                <p className="text-xs text-gray-500">Computed: {commPreview} EGP</p>
              )}
              <button
                type="submit"
                disabled={addingComm || !commForm.userId || !commForm.roleInDeal}
                className="w-full py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition"
              >
                {addingComm ? '…' : '+ Add Split'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Task A: Installment Plan Generate Form ───────────────────────── */}
      {isInstallment && !deal.installmentPlan && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4 mb-4">
          <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wide">Generate Installment Plan</p>
          <form onSubmit={generateInstallmentPlan} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Down Payment (EGP)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={ipForm.downPayment}
                  onChange={(e) => setIpForm({ ...ipForm, downPayment: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duration (months)</label>
                <input
                  type="number" min="1" step="1"
                  value={ipForm.durationMonths}
                  onChange={(e) => setIpForm({ ...ipForm, durationMonths: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  list="duration-options"
                />
                <datalist id="duration-options">
                  {[6, 12, 18, 24, 36, 48, 60].map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Annual Interest Rate (%)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={ipForm.interestRate}
                  onChange={(e) => setIpForm({ ...ipForm, interestRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">First Payment Date</label>
                <input
                  type="date"
                  value={ipForm.startDate}
                  onChange={(e) => setIpForm({ ...ipForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Calculation Method</label>
                <SearchableCombobox
                  options={CALC_METHOD_OPTS}
                  value={ipForm.calculationMethod}
                  onChange={(v) => setIpForm({ ...ipForm, calculationMethod: v })}
                  placeholder="Select method…"
                />
              </div>
            </div>

            {/* Preview stats */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="rounded-lg bg-gray-800 p-3">
                <p className="text-xs text-gray-500 mb-1">Principal</p>
                <p className="text-white text-sm font-medium tabular-nums">{principalAmount.toLocaleString('en-EG')} EGP</p>
              </div>
              <div className="rounded-lg bg-gray-800 p-3">
                <p className="text-xs text-gray-500 mb-1">Total Payable</p>
                <p className="text-white text-sm font-medium tabular-nums">{totalPayable.toLocaleString('en-EG')} EGP</p>
              </div>
              <div className="rounded-lg bg-gray-800 p-3">
                <p className="text-xs text-gray-500 mb-1">Monthly</p>
                <p className="text-white text-sm font-medium tabular-nums">{monthlyInstallment.toLocaleString('en-EG')} EGP</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={generatingPlan}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition"
              >
                {generatingPlan ? '…' : 'Generate Schedule'}
              </button>
              <p className="text-xs text-amber-400">Plan required before finalizing</p>
            </div>
          </form>
        </div>
      )}

      {/* Installment Plan (existing) */}
      {deal.installmentPlan && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4 mb-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Installment Plan</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="Down Payment" value={`${Number(deal.installmentPlan.downPayment).toLocaleString()} EGP`} />
            <Stat label="Monthly" value={`${Number(deal.installmentPlan.installmentAmount).toLocaleString()} EGP`} />
            <Stat label="Installments" value={String(deal.installmentPlan.numberOfInstallments)} />
          </div>
          <table className="w-full text-xs">
            <thead className="text-gray-400 border-b border-white/5">
              <tr><th className="text-left pb-2">#</th><th className="text-left pb-2">Due</th><th className="text-right pb-2">Amount</th><th className="text-left pb-2 pl-3">Status</th><th className="pb-2" /></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deal.installmentPlan.installments.slice(0, 6).map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 text-gray-400">{l.sequence}</td>
                  <td className="py-1.5 text-gray-300">{new Date(l.dueDate).toLocaleDateString('en-EG')}</td>
                  <td className="py-1.5 text-right text-white tabular-nums">{Number(l.amount).toLocaleString()} EGP</td>
                  <td className="py-1.5 pl-3"><StatusBadge status={l.status} /></td>
                  <td className="py-1.5 pl-2">
                    {l.status === 'PENDING' && deal.status === 'FINALIZED' && (
                      <button onClick={() => collectInstallment(l.id)} disabled={collectingLine === l.id}
                        className="px-2 py-0.5 text-xs text-green-400 border border-green-400/30 hover:bg-green-400/10 rounded disabled:opacity-40 transition">
                        {collectingLine === l.id ? '…' : 'Collect'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {deal.installmentPlan.installments.length > 6 && (
                <tr><td colSpan={4} className="py-2 text-center text-gray-600 text-xs">+{deal.installmentPlan.installments.length - 6} more…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bank Financing Application */}
      {isBankFinancing && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bank Financing</p>
            {!fa && <button onClick={() => setShowFACreate(true)} className="text-xs text-blue-400 hover:text-blue-300 transition">+ Create Application</button>}
          </div>
          {!fa ? (
            <p className="text-gray-600 text-sm">No finance application yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Stat label="Bank" value={fa.bankName ?? '—'} />
                <Stat label="Branch" value={fa.bankBranch ?? '—'} />
                <Stat label="Term" value={fa.termMonths ? `${fa.termMonths} months` : '—'} />
                <Stat label="APR" value={fa.apr ? `${fa.apr}%` : '—'} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500">Bank Status:</span>
                <div className="w-52">
                  <SearchableCombobox options={BFS_OPTS} value={fa.bankFinancingStatus} onChange={updateBFS} placeholder="Update status" />
                </div>
                <StatusBadge status={fa.status} />
              </div>

              {/* Documents */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2 font-medium">Documents</p>
                <div className="space-y-1.5">
                  {fa.requiredDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-300 flex-1">{doc.documentType.replace(/_/g, ' ')}</span>
                      <div className="w-32">
                        <SearchableCombobox options={DOC_STATUS_OPTS} value={doc.status}
                          onChange={(s) => updateDoc(doc.id, { status: s })} placeholder="Status" />
                      </div>
                      {doc.fileUrl
                        ? <a href={doc.fileUrl} target="_blank" className="text-blue-400 hover:text-blue-300">View</a>
                        : <span className="text-gray-600">No file</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <SearchableCombobox options={DOC_TYPES} value={newDocType} onChange={setNewDocType} placeholder="Add document…" />
                  </div>
                  <button onClick={addDoc} disabled={addingDoc || !newDocType}
                    className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                    {addingDoc ? '…' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Bank Approval */}
              {fa.bankApproval ? (
                <div className="rounded-lg bg-green-900/20 border border-green-500/20 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-green-400 mb-1">Bank Approved</p>
                      <p className="text-xs text-gray-300">Ref: {fa.bankApproval.approvalReferenceNumber} · Amount: {Number(fa.bankApproval.approvedAmount).toLocaleString()} EGP</p>
                      <p className="text-xs text-gray-500">{new Date(fa.bankApproval.approvalDate).toLocaleDateString('en-EG')}</p>
                    </div>
                    {deal.status === 'FINALIZED' && (
                      <button onClick={postBankDisbursement} disabled={disbursingBank}
                        className="ml-3 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-lg transition whitespace-nowrap">
                        {disbursingBank ? '…' : 'Post Disbursement'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowApproval(true)}
                  className="text-xs text-green-400 hover:text-green-300 transition">+ Record Bank Approval</button>
              )}
            </>
          )}
        </div>
      )}

      {/* Invoices */}
      {(deal.invoices?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Invoices</p>
          <table className="w-full text-xs">
            <thead className="text-gray-400 border-b border-white/5"><tr>
              <th className="text-right pb-2">Total</th>
              <th className="text-left pb-2 pl-3">Due Date</th>
              <th className="text-left pb-2 pl-3">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {deal.invoices!.map((inv) => (
                <tr key={inv.id} onClick={() => router.push(`/finance/invoices/${inv.id}`)} className="hover:bg-white/5 cursor-pointer transition">
                  <td className="py-1.5 text-right text-white tabular-nums">{Number(inv.amountTotal).toLocaleString()} EGP</td>
                  <td className="py-1.5 pl-3 text-gray-400">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-EG') : '—'}</td>
                  <td className="py-1.5 pl-3"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Finalize Wizard ─────────────────────────────────────────────── */}
      {showFinalize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFinalize(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-6">

            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-5">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${i < finalizeStep ? 'bg-green-600 text-white' : i === finalizeStep ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                    {i < finalizeStep ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs ${i === finalizeStep ? 'text-white' : 'text-gray-500'}`}>{s}</span>
                  {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10" />}
                </div>
              ))}
            </div>

            {/* Step 0: Review */}
            {finalizeStep === 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white mb-3">Review Deal Summary</h2>
                <div className="space-y-2 mb-4">
                  <Row2 label="Customer" value={deal.customer?.name ?? '—'} />
                  <Row2 label="Vehicle" value={deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : '—'} />
                  <Row2 label="Method" value={deal.purchaseMethod.replace(/_/g, ' ')} />
                  <Row2 label="Sale Price" value={`${Number(deal.salePrice).toLocaleString()} EGP`} />
                  <Row2 label="Admin Fee" value={`${Number(deal.adminFee ?? 0).toLocaleString()} EGP`} />
                  <Row2 label="VAT 14%" value={`${vat.toLocaleString()} EGP`} />
                  <div className="border-t border-white/10 pt-2">
                    <Row2 label="Total" value={`${total.toLocaleString()} EGP`} bold />
                  </div>
                </div>
                {isInstallment && !deal.installmentPlan && (
                  <div className="mb-3 p-3 rounded-lg bg-amber-900/20 border border-amber-500/20 text-xs text-amber-400">
                    No installment plan configured. Add one before finalizing.
                  </div>
                )}
                {isBankFinancing && !fa?.bankApproval && (
                  <div className="mb-3 p-3 rounded-lg bg-amber-900/20 border border-amber-500/20 text-xs text-amber-400">
                    No bank approval recorded. Record bank approval before finalizing.
                  </div>
                )}
                <button onClick={() => setFinalizeStep(1)}
                  className="w-full py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition">
                  Looks good →
                </button>
              </div>
            )}

            {/* Step 1: Method-specific */}
            {finalizeStep === 1 && STEPS.length > 2 && (
              <div>
                <h2 className="text-sm font-semibold text-white mb-3">{STEPS[1]}</h2>
                {isBankFinancing && (
                  <div className="space-y-2 mb-4">
                    <Row2 label="Bank" value={fa?.bankName ?? '—'} />
                    <Row2 label="Status" value={fa?.bankFinancingStatus?.replace(/_/g, ' ') ?? '—'} />
                    <Row2 label="Approved Amount" value={fa?.bankApproval ? `${Number(fa.bankApproval.approvedAmount).toLocaleString()} EGP` : '—'} />
                    <Row2 label="Ref #" value={fa?.bankApproval?.approvalReferenceNumber ?? '—'} />
                    <Row2 label="Docs verified" value={`${fa?.requiredDocuments.filter((d) => d.status === 'VERIFIED').length ?? 0} / ${fa?.requiredDocuments.length ?? 0}`} />
                  </div>
                )}
                {isInstallment && deal.installmentPlan && (
                  <div className="space-y-2 mb-4">
                    <Row2 label="Down Payment" value={`${Number(deal.installmentPlan.downPayment).toLocaleString()} EGP`} />
                    <Row2 label="Installments" value={String(deal.installmentPlan.numberOfInstallments)} />
                    <Row2 label="Monthly" value={`${Number(deal.installmentPlan.installmentAmount).toLocaleString()} EGP`} />
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setFinalizeStep(0)} className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">← Back</button>
                  <button onClick={() => setFinalizeStep(2)} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition">Next →</button>
                </div>
              </div>
            )}

            {/* Final confirm step */}
            {finalizeStep === STEPS.length - 1 && (
              <div>
                <h2 className="text-sm font-semibold text-white mb-2">Confirm & Finalize</h2>
                <p className="text-xs text-gray-400 mb-4">This will post GL journal entries, mark the vehicle SOLD, and accrue sales commissions. This action cannot be undone.</p>
                {finalizeError && <p className="mb-3 text-xs text-red-400">{finalizeError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setFinalizeStep(finalizeStep - 1)} className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">← Back</button>
                  <button onClick={runFinalize} disabled={finalizing}
                    className="flex-1 py-2 text-sm font-medium text-white bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg transition">
                    {finalizing ? 'Finalizing…' : 'Confirm Finalize'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Finance Application dialog */}
      {showFACreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFACreate(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">New Finance Application</h2>
            <form onSubmit={createFA} className="space-y-3">
              <Field label="Bank Name *" value={faForm.bankName} onChange={(v) => setFaForm({ ...faForm, bankName: v })} required />
              <Field label="Branch" value={faForm.bankBranch} onChange={(v) => setFaForm({ ...faForm, bankBranch: v })} />
              <Field label="Term (months)" type="number" value={faForm.termMonths} onChange={(v) => setFaForm({ ...faForm, termMonths: v })} />
              <Field label="APR (%)" type="number" value={faForm.apr} onChange={(v) => setFaForm({ ...faForm, apr: v })} />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowFACreate(false)} className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={savingFA} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">{savingFA ? '…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Approval dialog */}
      {showApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowApproval(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Record Bank Approval</h2>
            <form onSubmit={recordApproval} className="space-y-3">
              <Field label="Approval Reference # *" value={approvalForm.approvalReferenceNumber} onChange={(v) => setApprovalForm({ ...approvalForm, approvalReferenceNumber: v })} required />
              <Field label="Approved Amount (EGP) *" type="number" value={approvalForm.approvedAmount} onChange={(v) => setApprovalForm({ ...approvalForm, approvedAmount: v })} required />
              <Field label="Approval Date *" type="date" value={approvalForm.approvalDate} onChange={(v) => setApprovalForm({ ...approvalForm, approvalDate: v })} required />
              <Field label="Expiry Date" type="date" value={approvalForm.expiryDate} onChange={(v) => setApprovalForm({ ...approvalForm, expiryDate: v })} />
              <Field label="Notes" value={approvalForm.notes} onChange={(v) => setApprovalForm({ ...approvalForm, notes: v })} />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowApproval(false)} className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={savingApproval} className="flex-1 py-2 text-sm font-medium text-white bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg transition">{savingApproval ? '…' : 'Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-gray-500">{label}</p><p className="text-white text-sm font-medium">{value}</p></div>;
}

function Row2({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs py-1 border-b border-white/5 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'text-white font-semibold' : 'text-gray-300'}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
    </div>
  );
}
