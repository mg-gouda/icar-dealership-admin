'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import { ErrorBanner } from '@/components/ui/error-banner';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Commission {
  id: string;
  dealId: string;
  deal?: {
    id: string;
    vehicle?: { make: string; model: string; year: number };
    location?: { name: string };
  };
  salesRep?: { id: string; name: string; email?: string };
  roleInDeal?: string;
  salePrice: number;
  base: number;
  amount: number;
  commissionPlan?: { name: string; type?: string };
  status: 'ACCRUED' | 'PAYABLE' | 'PAID';
  accrualDate: string;
  paidDate?: string;
}

interface CommissionPlan {
  id: string;
  name: string;
  type: string; // FLAT_AMOUNT | PERCENT_OF_SALE_PRICE | PERCENT_OF_GROSS_PROFIT | TIERED
  basisType?: string;
  rate?: number;
  percentage?: number;
  flatAmount?: number;
  appliesTo?: string;
  applicableRole?: string;
  isActive: boolean;
  active?: boolean;
  tiers?: unknown[];
}

interface PayHistory {
  id: string;
  paymentDate: string;
  salesRep: { name: string };
  dealsCovered: number;
  totalAmount: number;
  reference: string;
  glEntry?: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
const egp = (n: number) =>
  'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function planTypeBadge(type: string, isAr: boolean) {
  const t = (type ?? '').toUpperCase();
  if (t.includes('FLAT'))  return <span className="badge badge-info">{isAr ? 'مبلغ ثابت' : 'Flat Amount'}</span>;
  if (t.includes('GROSS')) return <span className="badge badge-purple">{isAr ? '% من الربح' : '% of Gross Profit'}</span>;
  if (t.includes('SALE'))  return <span className="badge badge-orange">{isAr ? '% من السعر' : '% of Sale Price'}</span>;
  if (t.includes('TIER'))  return <span className="badge badge-warning">{isAr ? 'متدرج' : 'Tiered by Volume'}</span>;
  return <span className="badge badge-neutral">{type}</span>;
}

function planTypeDisplay(type: string, isAr: boolean) {
  const t = (type ?? '').toUpperCase();
  if (t.includes('FLAT'))  return isAr ? 'مبلغ ثابت' : 'Flat Amount';
  if (t.includes('GROSS')) return isAr ? '% من الربح' : '% of Gross Profit';
  if (t.includes('SALE'))  return isAr ? '% من السعر' : '% of Sale Price';
  if (t.includes('TIER'))  return isAr ? 'متدرج' : 'Tiered';
  return type;
}

function repInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

// ponytail: deterministic avatar bg from name
const AVATAR_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6',
];
function avatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const TABS = ['Commission Plans', 'Accruals', 'Payable', 'Paid History'] as const;
type Tab = (typeof TABS)[number];

// Bilingual tab labels — values kept as-is for state comparison
const TAB_LABELS_AR: Record<Tab, string> = {
  'Commission Plans': 'خطط العمولات',
  'Accruals':         'المستحقات',
  'Payable':          'واجبة الدفع',
  'Paid History':     'سجل المدفوعات',
};

const BASIS_OPTS_EN = [
  { value: 'FLAT_AMOUNT',             label: 'Flat Amount' },
  { value: 'PERCENT_OF_SALE_PRICE',   label: '% of Sale Price' },
  { value: 'PERCENT_OF_GROSS_PROFIT', label: '% of Gross Profit' },
  { value: 'TIERED',                  label: 'Tiered' },
];
const BASIS_OPTS_AR = [
  { value: 'FLAT_AMOUNT',             label: 'مبلغ ثابت' },
  { value: 'PERCENT_OF_SALE_PRICE',   label: '% من السعر' },
  { value: 'PERCENT_OF_GROSS_PROFIT', label: '% من الربح' },
  { value: 'TIERED',                  label: 'متدرج' },
];

const ROLE_OPTS_EN = [
  { value: '',                    label: 'All Locations' },
  { value: 'PRIMARY_SALES_REP',   label: 'Primary Sales Rep' },
  { value: 'CLOSER',              label: 'Closer' },
  { value: 'FINANCE_MANAGER',     label: 'Finance Manager' },
];
const ROLE_OPTS_AR = [
  { value: '',                    label: 'كل الفروع' },
  { value: 'PRIMARY_SALES_REP',   label: 'مندوب المبيعات الرئيسي' },
  { value: 'CLOSER',              label: 'مسؤول الإغلاق' },
  { value: 'FINANCE_MANAGER',     label: 'مدير مالي' },
];

const BLANK_PLAN = {
  name: '', basisType: 'PERCENT_OF_SALE_PRICE', percentage: '', flatAmount: '',
  applicableRole: '', active: true,
};

const BLANK_TIER = { minValue: '', maxValue: '', rateType: 'PERCENT', rateValue: '' };
type TierRow = typeof BLANK_TIER;

export default function CommissionsPage() {
  const { isAr } = useLang();

  const [tab, setTab] = useState<Tab>('Commission Plans');
  const [repFilter, setRepFilter] = useState('');
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [planForm, setPlanForm] = useState(BLANK_PLAN);
  const [tierRows, setTierRows] = useState<TierRow[]>([{ ...BLANK_TIER }]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planErr, setPlanErr] = useState('');

  // Pay commission modal
  const [showPay, setShowPay] = useState<{ repId: string; repName: string; amount: number; ids: string[] } | null>(null);
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  const BASIS_OPTS = isAr ? BASIS_OPTS_AR : BASIS_OPTS_EN;
  const ROLE_OPTS  = isAr ? ROLE_OPTS_AR  : ROLE_OPTS_EN;

  /* ── Queries ─────────────────────────────────────────────────────────── */
  const { data: plansRaw, loading: loadingPlans, error: plansError, reload: reloadPlans } =
    useQuery<CommissionPlan[] | { items: CommissionPlan[] }>('/finance/commission-plans');
  const plans: CommissionPlan[] = Array.isArray(plansRaw)
    ? plansRaw
    : (plansRaw as { items?: CommissionPlan[] } | null)?.items ?? [];

  const commQs = new URLSearchParams();
  if (repFilter) commQs.set('repId', repFilter);
  const { data: commRes, loading: loadingComm, error: commError, reload: reloadComm } =
    useQuery<{ items: Commission[]; total: number }>(`/finance/commissions?${commQs.toString()}`);
  const commissions = commRes?.items ?? [];

  const { data: historyRaw, loading: loadingHistory, error: historyError } =
    useQuery<{ items: PayHistory[] }>('/finance/commissions/report');
  const history = historyRaw?.items ?? [];

  /* ── Summary stats ──────────────────────────────────────────────────── */
  const accrued = commissions.filter((c) => c.status === 'ACCRUED');
  const payable = commissions.filter((c) => c.status === 'PAYABLE');
  const paid    = commissions.filter((c) => c.status === 'PAID');
  const accruedTotal = accrued.reduce((s, c) => s + Number(c.amount), 0);
  const payableTotal = payable.reduce((s, c) => s + Number(c.amount), 0);
  const paidTotal    = paid.reduce((s, c) => s + Number(c.amount), 0);
  const activePlans  = plans.filter((p) => p.isActive || p.active).length;

  /* Group payable by rep */
  const payableByRep = payable.reduce<Record<string, { name: string; total: number; ids: string[] }>>(
    (acc, c) => {
      const rid   = c.salesRep?.id ?? 'unknown';
      const rname = c.salesRep?.name ?? 'Unknown Rep';
      if (!acc[rid]) acc[rid] = { name: rname, total: 0, ids: [] };
      acc[rid].total += Number(c.amount);
      acc[rid].ids.push(c.id);
      return acc;
    },
    {}
  );

  /* ── Rep filter options ─────────────────────────────────────────────── */
  const repOpts = [
    { value: '', label: isAr ? 'كل المندوبين' : 'All Sales Reps' },
    ...Array.from(
      new Map(
        commissions
          .filter((c) => c.salesRep)
          .map((c) => [c.salesRep!.id, { value: c.salesRep!.id, label: c.salesRep!.name }])
      ).values()
    ),
  ];

  /* ── Plan actions ───────────────────────────────────────────────────── */
  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planForm.name) { setPlanErr(isAr ? 'الاسم مطلوب.' : 'Name required.'); return; }
    setSavingPlan(true); setPlanErr('');
    try {
      const body: Record<string, unknown> = {
        name: planForm.name,
        basisType: planForm.basisType,
        active: planForm.active,
        applicableRole: planForm.applicableRole || undefined,
      };
      if (planForm.basisType === 'FLAT_AMOUNT') body.flatAmount = Number(planForm.flatAmount);
      else if (planForm.basisType === 'TIERED') {
        if (tierRows.some(t => !t.minValue || !t.rateValue)) {
          setPlanErr(isAr ? 'جميع صفوف الشرائح يجب أن تحتوي على قيمة دنيا ومعدل.' : 'All tier rows must have Min Value and Rate.');
          return;
        }
        body.tiers = tierRows.map(t => ({
          minValue:  Number(t.minValue),
          maxValue:  t.maxValue ? Number(t.maxValue) : null,
          rateType:  t.rateType,
          rateValue: Number(t.rateValue),
        }));
      } else body.percentage = Number(planForm.percentage);
      await apiFetch('/finance/commission-plans', { method: 'POST', body: JSON.stringify(body) });
      setShowNewPlan(false); setPlanForm(BLANK_PLAN); setTierRows([{ ...BLANK_TIER }]); reloadPlans();
    } catch (e: unknown) { setPlanErr(e instanceof Error ? e.message : String(e)); }
    finally { setSavingPlan(false); }
  }

  async function togglePlan(p: CommissionPlan) {
    const active = !(p.isActive || p.active);
    await apiFetch(`/finance/commission-plans/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }).catch(() => {});
    reloadPlans();
  }

  /* ── Commission actions ──────────────────────────────────────────────── */
  async function markPayable(id: string) {
    await apiFetch(`/finance/commissions/${id}/mark-payable`, { method: 'PATCH' }).catch(() => {});
    reloadComm();
  }

  async function payCommission(e: React.FormEvent) {
    e.preventDefault();
    if (!showPay) return;
    setPaying(true);
    try {
      await apiFetch('/finance/commissions/pay', {
        method: 'POST',
        body: JSON.stringify({
          repId:         showPay.repId,
          commissionIds: showPay.ids,
          paymentMethod: payMethod,
          reference:     payRef,
        }),
      });
      setShowPay(null); setPayRef(''); reloadComm();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPaying(false); }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'عمولات المبيعات' : 'Sales Commissions'}</h1>
          <p className="page-subtitle">
            {isAr ? 'خطط العمولات والمتابعة وإدارة المدفوعات' : 'Commission plans, tracking & payout management'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setTab('Commission Plans'); setShowNewPlan(true); }}>
          {isAr ? '+ خطة جديدة' : '+ New Plan'}
        </button>
      </div>

      <div className="page-body space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'مستحقة هذا الشهر' : 'Accrued This Month'}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--warning-fg)' }}>
              {egp(accruedTotal)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {isAr ? `من ${accrued.length} صفقات مكتملة` : `From ${accrued.length} finalized deals`}
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'واجبة الدفع — بانتظار الصرف' : 'Payable — Awaiting Payout'}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--danger-fg)' }}>
              {egp(payableTotal)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {isAr ? `${payable.length} مندوب مؤهل` : `${payable.length} reps eligible`}
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'مدفوعة هذا الشهر' : 'Paid This Month'}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--success-fg)' }}>
              {egp(paidTotal)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {isAr ? `${paid.length} صفقة` : `${paid.length} deals paid Jun 1`}
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'الخطط النشطة' : 'Active Plans'}</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
              {activePlans}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {plans.filter((p) => !(p.isActive || p.active)).length} {isAr ? 'ثابت' : 'Flat'} ·{' '}
              {plans.filter((p) => (p.type ?? p.basisType ?? '').includes('TIER')).length} {isAr ? 'متدرج' : 'Tiered'}
            </p>
          </div>
        </div>

        {/* Tab strip + filters */}
        <div className="card overflow-hidden">
          <div
            style={{
              padding: '0 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="tabs" style={{ borderBottom: 'none' }}>
              {TABS.map((t) => (
                <button
                  key={t}
                  className={`tab${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {isAr ? TAB_LABELS_AR[t] : t}
                  {t === 'Accruals' && accrued.length > 0 && (
                    <span
                      className="badge badge-info"
                      style={{ marginLeft: 6, padding: '0.1rem 0.4rem', fontSize: '0.625rem' }}
                    >
                      {accrued.length}
                    </span>
                  )}
                  {t === 'Payable' && payable.length > 0 && (
                    <span
                      className="badge badge-warning"
                      style={{ marginLeft: 6, padding: '0.1rem 0.4rem', fontSize: '0.625rem' }}
                    >
                      {payable.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Filters for non-plans tabs */}
            {tab !== 'Commission Plans' && tab !== 'Paid History' && (
              <div className="flex items-center gap-2">
                <div style={{ width: 180 }}>
                  <SearchableCombobox
                    options={repOpts}
                    value={repFilter}
                    onChange={setRepFilter}
                    placeholder={isAr ? 'كل المندوبين' : 'All Sales Reps'}
                  />
                </div>
              </div>
            )}

            {tab === 'Paid History' && (
              <div className="flex items-center gap-2">
                <div style={{ width: 180 }}>
                  <SearchableCombobox
                    options={repOpts}
                    value={repFilter}
                    onChange={setRepFilter}
                    placeholder={isAr ? 'كل المندوبين' : 'All Sales Reps'}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Commission Plans tab ─────────────────────────────────────── */}
          {tab === 'Commission Plans' && (
            <>
              {loadingPlans && (
                <div className="p-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>
                  {isAr ? 'جاري التحميل…' : 'Loading plans…'}
                </div>
              )}
              {plansError && <div className="p-4"><ErrorBanner error={plansError} retry={reloadPlans} /></div>}
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'اسم الخطة' : 'Plan Name'}</th>
                    <th>{isAr ? 'النوع' : 'Type'}</th>
                    <th>{isAr ? 'المعدل' : 'Rate'}</th>
                    <th>{isAr ? 'النطاق' : 'Scope'}</th>
                    <th>{isAr ? 'ينطبق على' : 'Applies To'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const active = p.isActive || p.active;
                    const type   = p.type ?? p.basisType ?? '';
                    const rate   = p.percentage ?? p.rate;
                    const flat   = p.flatAmount;
                    return (
                      <tr key={p.id}>
                        <td className="font-medium" style={{ color: 'var(--text-1)' }}>
                          {p.name}
                        </td>
                        <td>{planTypeBadge(type, isAr)}</td>
                        <td className="tabular-nums text-sm" style={{ color: 'var(--text-2)' }}>
                          {type.includes('TIER') ? '2% – 3% – 4%' :
                           flat ? egp(Number(flat)) :
                           rate ? `${rate}% ${isAr ? 'من السعر' : 'of sale'}` : '—'}
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{isAr ? 'كل الفروع' : 'All Locations'}</td>
                        <td style={{ color: 'var(--text-2)' }}>
                          {p.applicableRole?.replace(/_/g, ' ') || (isAr ? 'كل الأدوار' : 'All Roles')}
                        </td>
                        <td>
                          {active
                            ? <span className="badge badge-success">{isAr ? 'نشط' : 'Active'}</span>
                            : <span className="badge badge-neutral">{isAr ? 'غير نشط' : 'Inactive'}</span>}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => togglePlan(p)}
                          >
                            {active ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {plans.length === 0 && !loadingPlans && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center text-sm"
                        style={{ color: 'var(--text-3)', padding: '2.5rem 1rem' }}
                      >
                        {isAr ? 'لا توجد خطط عمولات. انقر على "+ خطة جديدة" لإنشاء واحدة.' : 'No commission plans. Click "+ New Plan" to create one.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* ── Accruals tab ─────────────────────────────────────────────── */}
          {tab === 'Accruals' && (
            <>
              {loadingComm && (
                <div className="p-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>
                  {isAr ? 'جاري التحميل…' : 'Loading…'}
                </div>
              )}
              {commError && <div className="p-4"><ErrorBanner error={commError} retry={reloadComm} /></div>}
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'رقم الصفقة' : 'Deal #'}</th>
                    <th>{isAr ? 'مندوب المبيعات' : 'Sales Rep'}</th>
                    <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                    <th>{isAr ? 'الدور' : 'Role'}</th>
                    <th>{isAr ? 'الخطة المستخدمة' : 'Plan Used'}</th>
                    <th style={{ textAlign: 'right' }}>{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                    <th style={{ textAlign: 'right' }}>{isAr ? 'أساس العمولة' : 'Commission Base'}</th>
                    <th style={{ textAlign: 'right' }}>{isAr ? 'العمولة' : 'Commission'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span
                          className="font-mono text-xs font-medium"
                          style={{ color: 'var(--primary)' }}
                        >
                          #{c.dealId.slice(-4).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className="avatar"
                            style={{
                              width: 28, height: 28,
                              background: avatarBg(c.salesRep?.name ?? '?'),
                              color: '#fff', fontSize: '0.6875rem',
                            }}
                          >
                            {repInitials(c.salesRep?.name ?? '?')}
                          </span>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                            {c.salesRep?.name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>
                        {c.deal?.vehicle ? `${c.deal.vehicle.make} ${c.deal.vehicle.model}` : '—'}
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>
                        {(c.roleInDeal ?? (isAr ? 'مندوب رئيسي' : 'Primary Rep')).replace(/_/g, ' ')}
                      </td>
                      <td style={{ color: 'var(--text-3)' }}>
                        {c.commissionPlan?.name ?? '—'}
                      </td>
                      <td className="tabular-nums text-sm" style={{ textAlign: 'right', color: 'var(--text-1)' }}>
                        {egp(Number(c.salePrice))}
                      </td>
                      <td className="tabular-nums text-sm" style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                        {egp(Number(c.base))}
                      </td>
                      <td
                        className="tabular-nums text-sm font-medium"
                        style={{ textAlign: 'right', color: 'var(--text-1)' }}
                      >
                        {egp(Number(c.amount))}
                      </td>
                      <td>
                        {c.status === 'ACCRUED' && <span className="badge badge-info">{isAr ? 'مستحقة' : 'Accrued'}</span>}
                        {c.status === 'PAYABLE' && <span className="badge badge-warning">{isAr ? 'واجبة الدفع' : 'Payable'}</span>}
                        {c.status === 'PAID'    && <span className="badge badge-success">{isAr ? 'مدفوعة' : 'Paid'}</span>}
                      </td>
                      <td>
                        {c.status === 'ACCRUED' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => markPayable(c.id)}
                          >
                            {isAr ? 'تحديد واجبة الدفع' : 'Mark Payable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {commissions.length === 0 && !loadingComm && (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-center text-sm"
                        style={{ color: 'var(--text-3)', padding: '2.5rem 1rem' }}
                      >
                        {isAr ? 'لا توجد سجلات عمولات.' : 'No commission records found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* ── Payable tab ──────────────────────────────────────────────── */}
          {tab === 'Payable' && (
            <div style={{ padding: '1rem 1.25rem' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="section-label" style={{ marginBottom: 0 }}>
                  {isAr ? 'قائمة انتظار العمولات واجبة الدفع' : 'Commissions Payable Queue'}
                </p>
                {payable.length > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const first = Object.entries(payableByRep)[0];
                      if (first) {
                        const [rid, data] = first;
                        setShowPay({ repId: rid, repName: data.name, amount: data.total, ids: data.ids });
                      }
                    }}
                  >
                    {isAr ? 'معالجة دفعة جماعية' : 'Process Batch Payout'}
                  </button>
                )}
              </div>

              {Object.keys(payableByRep).length === 0 ? (
                <div className="text-center text-sm py-10" style={{ color: 'var(--text-3)' }}>
                  {isAr ? 'لا توجد عمولات واجبة الدفع حالياً.' : 'No payable commissions at this time.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(payableByRep).map(([rid, data]) => {
                    const repComms = payable.filter((c) => c.salesRep?.id === rid);
                    return (
                      <div
                        key={rid}
                        className="card p-4 flex items-center justify-between"
                        style={{ background: 'var(--surface)' }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="avatar"
                            style={{
                              width: 40, height: 40,
                              background: avatarBg(data.name),
                              color: '#fff', fontSize: '0.875rem',
                            }}
                          >
                            {repInitials(data.name)}
                          </span>
                          <div>
                            <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{data.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                              {repComms.length} {isAr ? 'صفقات' : 'deals'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-base tabular-nums" style={{ color: 'var(--text-1)' }}>
                              {egp(data.total)}
                            </p>
                            <span className="badge badge-warning">{isAr ? 'واجبة الدفع' : 'Payable'}</span>
                          </div>
                          <button
                            className="btn btn-primary"
                            onClick={() => setShowPay({ repId: rid, repName: data.name, amount: data.total, ids: data.ids })}
                          >
                            {isAr ? 'صرف العمولة' : 'Pay Commission'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Paid History tab ─────────────────────────────────────────── */}
          {tab === 'Paid History' && (
            <>
              {loadingHistory && (
                <div className="p-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>
                  {isAr ? 'جاري التحميل…' : 'Loading…'}
                </div>
              )}
              {historyError && <div className="p-4"><ErrorBanner error={historyError} retry={() => window.location.reload()} /></div>}
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'تاريخ الدفع' : 'Payment Date'}</th>
                    <th>{isAr ? 'مندوب المبيعات' : 'Sales Rep'}</th>
                    <th style={{ textAlign: 'center' }}>{isAr ? 'الصفقات المشمولة' : 'Deals Covered'}</th>
                    <th style={{ textAlign: 'right' }}>{isAr ? 'المبلغ الإجمالي' : 'Total Amount'}</th>
                    <th>{isAr ? 'المرجع' : 'Reference'}</th>
                    <th>{isAr ? 'قيد المحاسبة' : 'GL Entry #'}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="text-sm" style={{ color: 'var(--text-2)' }}>
                        {fmtDate(h.paymentDate, isAr, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className="avatar"
                            style={{
                              width: 28, height: 28,
                              background: avatarBg(h.salesRep.name),
                              color: '#fff', fontSize: '0.6875rem',
                            }}
                          >
                            {repInitials(h.salesRep.name)}
                          </span>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                            {h.salesRep.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-sm tabular-nums" style={{ textAlign: 'center', color: 'var(--text-2)' }}>
                        {h.dealsCovered}
                      </td>
                      <td className="tabular-nums text-sm font-medium" style={{ textAlign: 'right', color: 'var(--text-1)' }}>
                        {egp(Number(h.totalAmount))}
                      </td>
                      <td className="text-sm font-mono" style={{ color: 'var(--text-2)' }}>
                        {h.reference || '—'}
                      </td>
                      <td className="text-sm font-mono" style={{ color: 'var(--primary)' }}>
                        {h.glEntry || '—'}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && !loadingHistory && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center text-sm"
                        style={{ color: 'var(--text-3)', padding: '2.5rem 1rem' }}
                      >
                        {isAr ? 'لا يوجد سجل مدفوعات.' : 'No paid commission history.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Commission History — Deal Level (shown under Accruals) */}
        {tab === 'Accruals' && (
          <div className="card overflow-hidden">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <p className="page-title" style={{ fontSize: '0.9375rem' }}>
                {isAr ? 'سجل العمولات — مستوى الصفقة' : 'Commission History — Deal Level'}
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'الصفقة' : 'Deal'}</th>
                  <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                  <th>{isAr ? 'مندوب المبيعات' : 'Sales Rep'}</th>
                  <th>{isAr ? 'الدور' : 'Role'}</th>
                  <th>{isAr ? 'الخطة' : 'Plan Used'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'العمولة' : 'Commission'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={`hist-${c.id}`}>
                    <td>
                      <span className="font-mono text-xs font-medium" style={{ color: 'var(--primary)' }}>
                        #{c.dealId.slice(-4).toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {c.deal?.vehicle
                        ? `${c.deal.vehicle.year} ${c.deal.vehicle.make} ${c.deal.vehicle.model}`
                        : '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className="avatar"
                          style={{
                            width: 24, height: 24,
                            background: avatarBg(c.salesRep?.name ?? '?'),
                            color: '#fff', fontSize: '0.625rem',
                          }}
                        >
                          {repInitials(c.salesRep?.name ?? '?')}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-1)' }}>
                          {c.salesRep?.name ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-2)' }}>
                      {(c.roleInDeal ?? (isAr ? 'مندوب رئيسي' : 'Primary Rep')).replace(/_/g, ' ')}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {c.commissionPlan ? planTypeDisplay(c.commissionPlan.type ?? '', isAr) : '—'}
                    </td>
                    <td
                      className="tabular-nums text-sm font-medium"
                      style={{ textAlign: 'right', color: 'var(--text-1)' }}
                    >
                      {egp(Number(c.amount))}
                    </td>
                    <td>
                      {c.status === 'ACCRUED' && <span className="badge badge-info">{isAr ? 'مستحقة' : 'Accrued'}</span>}
                      {c.status === 'PAYABLE' && <span className="badge badge-warning">{isAr ? 'واجبة الدفع' : 'Payable'}</span>}
                      {c.status === 'PAID'    && <span className="badge badge-success">{isAr ? 'مدفوعة' : 'Paid'}</span>}
                    </td>
                  </tr>
                ))}
                {commissions.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center text-sm"
                      style={{ color: 'var(--text-3)', padding: '2rem 1rem' }}
                    >
                      {isAr ? 'لا توجد صفقات.' : 'No deals found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New Plan Modal ────────────────────────────────────────────────── */}
      {showNewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => { setShowNewPlan(false); setPlanForm(BLANK_PLAN); setTierRows([{ ...BLANK_TIER }]); setPlanErr(''); }}
          />
          <div className="card relative w-full shadow-2xl" style={{ maxWidth: 480 }}>
            <div
              className="flex items-center justify-between"
              style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}
            >
              <h2 className="page-title" style={{ fontSize: '1rem' }}>
                {isAr ? 'خطة عمولة جديدة' : 'New Commission Plan'}
              </h2>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '1.25rem', lineHeight: 1 }}
                onClick={() => { setShowNewPlan(false); setPlanForm(BLANK_PLAN); setTierRows([{ ...BLANK_TIER }]); setPlanErr(''); }}
              >
                ×
              </button>
            </div>

            <form onSubmit={createPlan} style={{ padding: '1.25rem' }}>
              <div className="space-y-3">
                <div>
                  <label className="input-label">{isAr ? 'اسم الخطة *' : 'Plan Name *'}</label>
                  <input
                    required
                    className="input"
                    placeholder={isAr ? 'مثال: ثابت قياسي' : 'e.g. Standard Flat'}
                    value={planForm.name}
                    onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <SearchableCombobox
                  label={isAr ? 'نوع الخطة *' : 'Plan Type *'}
                  options={BASIS_OPTS}
                  value={planForm.basisType}
                  onChange={(v) => setPlanForm((p) => ({ ...p, basisType: v }))}
                  placeholder={isAr ? 'اختر النوع' : 'Select type'}
                />

                {planForm.basisType === 'FLAT_AMOUNT' && (
                  <div>
                    <label className="input-label">{isAr ? 'المبلغ الثابت (ج.م.) *' : 'Flat Amount (EGP) *'}</label>
                    <input
                      type="number" required min="0" step="0.01" className="input"
                      placeholder="2,500"
                      value={planForm.flatAmount}
                      onChange={(e) => setPlanForm((p) => ({ ...p, flatAmount: e.target.value }))}
                    />
                  </div>
                )}

                {(planForm.basisType === 'PERCENT_OF_SALE_PRICE' ||
                  planForm.basisType === 'PERCENT_OF_GROSS_PROFIT') && (
                  <div>
                    <label className="input-label">{isAr ? 'المعدل (%) *' : 'Rate (%) *'}</label>
                    <input
                      type="number" required min="0" max="100" step="0.01" className="input"
                      placeholder="2.5"
                      value={planForm.percentage}
                      onChange={(e) => setPlanForm((p) => ({ ...p, percentage: e.target.value }))}
                    />
                  </div>
                )}

                {planForm.basisType === 'TIERED' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="input-label mb-0">{isAr ? 'الشرائح *' : 'Tiers *'}</label>
                      <button type="button" className="btn btn-ghost btn-sm text-xs"
                        onClick={() => setTierRows(r => [...r, { ...BLANK_TIER }])}>
                        {isAr ? '+ إضافة صف' : '+ Add Row'}
                      </button>
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                            <th className="text-left px-2 py-1.5">{isAr ? 'من (ج.م.)' : 'Min (EGP)'}</th>
                            <th className="text-left px-2 py-1.5">{isAr ? 'إلى (ج.م.)' : 'Max (EGP)'}</th>
                            <th className="text-left px-2 py-1.5">{isAr ? 'النوع' : 'Type'}</th>
                            <th className="text-left px-2 py-1.5">{isAr ? 'المعدل' : 'Rate'}</th>
                            <th className="px-2 py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {tierRows.map((tier, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                              <td className="px-2 py-1">
                                <input type="number" min="0" step="1" className="input py-0.5 px-1 text-xs" style={{ minWidth: 70 }}
                                  placeholder="0" value={tier.minValue}
                                  onChange={e => setTierRows(r => r.map((t, j) => j === i ? { ...t, minValue: e.target.value } : t))} />
                              </td>
                              <td className="px-2 py-1">
                                <input type="number" min="0" step="1" className="input py-0.5 px-1 text-xs" style={{ minWidth: 70 }}
                                  placeholder="∞" value={tier.maxValue}
                                  onChange={e => setTierRows(r => r.map((t, j) => j === i ? { ...t, maxValue: e.target.value } : t))} />
                              </td>
                              <td className="px-2 py-1">
                                <SearchableCombobox
                                  options={[
                                    { value: 'PERCENT', label: isAr ? 'نسبة %' : '%' },
                                    { value: 'FLAT',    label: isAr ? 'ثابت' : 'Flat' },
                                  ]}
                                  value={tier.rateType}
                                  onChange={(v) => setTierRows(r => r.map((t, j) => j === i ? { ...t, rateType: v } : t))}
                                />
                              </td>
                              <td className="px-2 py-1">
                                <input type="number" min="0" step="0.01" className="input py-0.5 px-1 text-xs" style={{ minWidth: 60 }}
                                  placeholder="2.5" value={tier.rateValue}
                                  onChange={e => setTierRows(r => r.map((t, j) => j === i ? { ...t, rateValue: e.target.value } : t))} />
                              </td>
                              <td className="px-2 py-1">
                                {tierRows.length > 1 && (
                                  <button type="button" style={{ color: 'var(--danger)', fontSize: '1rem', lineHeight: 1 }}
                                    onClick={() => setTierRows(r => r.filter((_, j) => j !== i))}>×</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <SearchableCombobox
                  label={isAr ? 'ينطبق على (الدور)' : 'Applies To (Role)'}
                  options={ROLE_OPTS}
                  value={planForm.applicableRole}
                  onChange={(v) => setPlanForm((p) => ({ ...p, applicableRole: v }))}
                  placeholder={isAr ? 'كل الأدوار' : 'All Roles'}
                  clearable
                />

                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-1)' }}>
                  <input
                    type="checkbox"
                    checked={planForm.active}
                    onChange={(e) => setPlanForm((p) => ({ ...p, active: e.target.checked }))}
                    className="rounded"
                  />
                  {isAr ? 'نشط فوراً' : 'Active immediately'}
                </label>

                {planErr && (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>{planErr}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setShowNewPlan(false); setPlanForm(BLANK_PLAN); setTierRows([{ ...BLANK_TIER }]); setPlanErr(''); }}
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={savingPlan}
                  >
                    {savingPlan ? (isAr ? 'جاري الإنشاء…' : 'Creating…') : (isAr ? 'إنشاء الخطة' : 'Create Plan')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Pay Commission Modal ──────────────────────────────────────────── */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => { if (!paying) { setShowPay(null); setPayRef(''); } }}
          />
          <div className="card relative w-full shadow-2xl" style={{ maxWidth: 420 }}>
            <div
              className="flex items-center justify-between"
              style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}
            >
              <h2 className="page-title" style={{ fontSize: '1rem' }}>
                {isAr ? 'صرف العمولة' : 'Pay Commission'}
              </h2>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '1.25rem', lineHeight: 1 }}
                onClick={() => { if (!paying) { setShowPay(null); setPayRef(''); } }}
              >
                ×
              </button>
            </div>

            <form onSubmit={payCommission} style={{ padding: '1.25rem' }}>
              <div className="space-y-4">
                {/* Rep summary */}
                <div
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <span
                    className="avatar"
                    style={{
                      width: 44, height: 44,
                      background: avatarBg(showPay.repName),
                      color: '#fff', fontSize: '0.875rem',
                    }}
                  >
                    {repInitials(showPay.repName)}
                  </span>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                      {showPay.repName}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {showPay.ids.length} {isAr ? 'عمولة' : `commission${showPay.ids.length !== 1 ? 's' : ''}`} · {egp(showPay.amount)}
                    </p>
                  </div>
                  <p className="ml-auto text-lg font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
                    {egp(showPay.amount)}
                  </p>
                </div>

                <div>
                  <label className="input-label">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                  <SearchableCombobox
                    options={[
                      { value: 'BANK_TRANSFER', label: isAr ? 'تحويل بنكي' : 'Bank Transfer' },
                      { value: 'CASH',          label: isAr ? 'نقداً' : 'Cash' },
                      { value: 'CHEQUE',        label: isAr ? 'شيك' : 'Cheque' },
                    ]}
                    value={payMethod}
                    onChange={setPayMethod}
                    placeholder={isAr ? 'اختر الطريقة' : 'Select method'}
                  />
                </div>

                <div>
                  <label className="input-label">{isAr ? 'المرجع / رقم القسيمة' : 'Reference / Voucher #'}</label>
                  <input
                    className="input"
                    placeholder="e.g. TXN-20260619-001"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={paying}
                    onClick={() => { setShowPay(null); setPayRef(''); }}
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={paying}
                  >
                    {paying ? (isAr ? 'جاري المعالجة…' : 'Processing…') : (isAr ? 'تأكيد الدفع' : 'Confirm Payment')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
