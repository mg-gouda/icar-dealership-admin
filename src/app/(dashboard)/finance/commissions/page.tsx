'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
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

interface CommissionConfigTier {
  minTargetPct: number;
  amount: number;
  label?: string;
}

interface CommissionConfigData {
  baseAmount: number;
  tiers: CommissionConfigTier[];
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

const TABS = ['Commission Config', 'Accruals', 'Payable', 'Paid History'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS_AR: Record<Tab, string> = {
  'Commission Config': 'إعدادات العمولات',
  'Accruals':          'المستحقات',
  'Payable':           'واجبة الدفع',
  'Paid History':      'سجل المدفوعات',
};

const BLANK_CONFIG: CommissionConfigData = { baseAmount: 0, tiers: [] };
const BLANK_TIER_ROW: CommissionConfigTier = { minTargetPct: 100, amount: 0, label: '' };

export default function CommissionsPage() {
  const { isAr } = useLang();

  const [tab, setTab] = useState<Tab>('Commission Config');
  const [repFilter, setRepFilter] = useState('');

  // Commission config state
  const [configForm, setConfigForm] = useState<CommissionConfigData>(BLANK_CONFIG);
  const [configTiers, setConfigTiers] = useState<CommissionConfigTier[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configErr, setConfigErr] = useState('');
  const [configSaved, setConfigSaved] = useState(false);

  // Pay commission modal
  const [showPay, setShowPay] = useState<{ repId: string; repName: string; amount: number; ids: string[] } | null>(null);
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  /* ── Queries ─────────────────────────────────────────────────────────── */
  const { data: configRaw, loading: loadingConfig, reload: reloadConfig } =
    useQuery<CommissionConfigData | null>('/finance/commission-config');

  const commQs = new URLSearchParams();
  if (repFilter) commQs.set('repId', repFilter);
  const { data: commRes, loading: loadingComm, error: commError, reload: reloadComm } =
    useQuery<{ items: Commission[]; total: number }>(`/finance/commissions?${commQs.toString()}`);
  const commissions = commRes?.items ?? [];

  const { data: historyRaw, loading: loadingHistory, error: historyError } =
    useQuery<{ items: PayHistory[] }>('/finance/commissions/report');
  const history = historyRaw?.items ?? [];

  /* sync config from API */
  const [configInitialized, setConfigInitialized] = useState(false);
  if (configRaw && !configInitialized) {
    setConfigForm({ baseAmount: Number(configRaw.baseAmount ?? 0), tiers: [] });
    setConfigTiers((configRaw.tiers ?? []).map((t) => ({
      minTargetPct: Number(t.minTargetPct),
      amount:       Number(t.amount),
      label:        t.label ?? '',
    })));
    setConfigInitialized(true);
  }

  /* ── Summary stats ──────────────────────────────────────────────────── */
  const accrued = commissions.filter((c) => c.status === 'ACCRUED');
  const payable = commissions.filter((c) => c.status === 'PAYABLE');
  const paid    = commissions.filter((c) => c.status === 'PAID');
  const accruedTotal = accrued.reduce((s, c) => s + Number(c.amount), 0);
  const payableTotal = payable.reduce((s, c) => s + Number(c.amount), 0);
  const paidTotal    = paid.reduce((s, c) => s + Number(c.amount), 0);

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

  /* ── Commission config actions ──────────────────────────────────────── */
  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (configForm.baseAmount < 0) { setConfigErr(isAr ? 'المبلغ الأساسي يجب أن يكون صفراً أو أكثر.' : 'Base amount must be ≥ 0.'); return; }
    setSavingConfig(true); setConfigErr('');
    try {
      await apiFetch('/finance/commission-config', {
        method: 'PUT',
        body: JSON.stringify({
          baseAmount: configForm.baseAmount,
          tiers: configTiers.map((t) => ({
            minTargetPct: Number(t.minTargetPct),
            amount:       Number(t.amount),
            label:        t.label || undefined,
          })),
        }),
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      reloadConfig();
    } catch (e: unknown) { setConfigErr(e instanceof Error ? e.message : String(e)); }
    finally { setSavingConfig(false); }
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
            {isAr ? 'إعدادات العمولات والمتابعة وإدارة المدفوعات' : 'Commission settings, tracking & payout management'}
          </p>
        </div>
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
            <p className="section-label mb-1">{isAr ? 'معدل العمولة الأساسي' : 'Base Commission Rate'}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--primary)' }}>
              {egp(configForm.baseAmount)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {isAr ? `${configTiers.length} شرائح مستهدفة` : `${configTiers.length} target tier${configTiers.length !== 1 ? 's' : ''}`}
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
            {tab !== 'Commission Config' && tab !== 'Paid History' && (
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
          {tab === 'Commission Config' && (
            <div className="p-6" style={{ maxWidth: 680 }}>
              {loadingConfig && (
                <div className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
                  {isAr ? 'جاري التحميل…' : 'Loading config…'}
                </div>
              )}
              <form onSubmit={saveConfig} className="space-y-6">
                {/* Base amount */}
                <div>
                  <label className="form-label">
                    {isAr ? 'مبلغ العمولة الأساسي (جنيه) — لكل صفقة' : 'Base Commission Amount (EGP) — per deal'}
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    {isAr
                      ? 'المبلغ الثابت الذي يحصل عليه مندوب المبيعات عند كل صفقة مكتملة (بغض النظر عن سعر البيع أو الربح). يمكن تجاوز هذا المبلغ لكل وكيل معتمد على حدة.'
                      : 'Fixed EGP amount earned by the sales rep per finalized deal (regardless of sale price or profit). Can be overridden per Accredited Dealer.'}
                  </p>
                  <NumericInput
                    value={configForm.baseAmount}
                    onChange={(v) => setConfigForm((f) => ({ ...f, baseAmount: Number(v) }))}
                    min={0}
                    step={50}
                    placeholder="0"
                  />
                </div>

                {/* Target tiers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label mb-0">
                      {isAr ? 'شرائح المكافأة عند تحقيق الهدف' : 'Target Achievement Bonus Tiers'}
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setConfigTiers((t) => [...t, { ...BLANK_TIER_ROW }])}
                    >
                      {isAr ? '+ شريحة' : '+ Tier'}
                    </button>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
                    {isAr
                      ? 'عند بلوغ المندوب النسبة المحددة من هدفه الشهري، يصبح مبلغ العمولة بدءاً من تلك الصفقة هو مبلغ الشريحة المقابلة.'
                      : 'When a rep reaches the specified % of their monthly unit target, the per-deal commission steps up to the tier amount.'}
                  </p>
                  {configTiers.length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                      {isAr ? 'لا توجد شرائح — المبلغ الأساسي يُطبَّق على جميع الصفقات.' : 'No tiers — base amount applies to all deals.'}
                    </p>
                  )}
                  {configTiers.length > 0 && (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40%' }}>{isAr ? 'الحد الأدنى من الهدف (%)' : 'Min. Target % Achieved'}</th>
                          <th style={{ width: '40%' }}>{isAr ? 'مبلغ العمولة (جنيه)' : 'Commission Amount (EGP)'}</th>
                          <th style={{ width: '20%' }}>{isAr ? 'وصف اختياري' : 'Label (optional)'}</th>
                          <th style={{ width: 40 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {configTiers.map((tier, i) => (
                          <tr key={i}>
                            <td>
                              <NumericInput
                                value={tier.minTargetPct}
                                onChange={(v) => setConfigTiers((rows) => rows.map((r, j) => j === i ? { ...r, minTargetPct: Number(v) } : r))}
                                min={1}
                                max={999}
                                step={5}
                                placeholder="100"
                              />
                            </td>
                            <td>
                              <NumericInput
                                value={tier.amount}
                                onChange={(v) => setConfigTiers((rows) => rows.map((r, j) => j === i ? { ...r, amount: Number(v) } : r))}
                                min={0}
                                step={50}
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                value={tier.label ?? ''}
                                onChange={(e) => setConfigTiers((rows) => rows.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                                placeholder={isAr ? 'مثال: بلغت الهدف' : 'e.g. Target Met'}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--danger-fg)' }}
                                onClick={() => setConfigTiers((rows) => rows.filter((_, j) => j !== i))}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {configErr && <div className="text-sm" style={{ color: 'var(--danger-fg)' }}>{configErr}</div>}
                {configSaved && (
                  <div className="text-sm" style={{ color: 'var(--success-fg)' }}>
                    {isAr ? '✓ تم الحفظ بنجاح' : '✓ Saved successfully'}
                  </div>
                )}

                <div>
                  <button type="submit" className="btn btn-primary" disabled={savingConfig}>
                    {savingConfig ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ الإعدادات' : 'Save Settings')}
                  </button>
                </div>
              </form>
            </div>
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
                    <th style={{ textAlign: 'right' }}>{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                    <th style={{ textAlign: 'right' }}>{isAr ? 'العمولة' : 'Commission'}</th>
                    <th>{isAr ? 'الشريحة' : 'Tier'}</th>
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
                      <td className="tabular-nums text-sm" style={{ textAlign: 'right', color: 'var(--text-1)' }}>
                        {egp(Number(c.salePrice))}
                      </td>
                      <td
                        className="tabular-nums text-sm font-medium"
                        style={{ textAlign: 'right', color: 'var(--text-1)' }}
                      >
                        {egp(Number(c.amount))}
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>
                        {(c as unknown as { tierPctApplied?: number }).tierPctApplied
                          ? <span className="badge badge-purple">{(c as unknown as { tierPctApplied?: number }).tierPctApplied}%</span>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
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
