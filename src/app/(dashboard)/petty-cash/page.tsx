'use client';

import { useState } from 'react';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import NumericInput from '../../../components/ui/NumericInput';
import { useQuery, apiFetch } from '../../../lib/useApi';
import { useLang } from '../../../lib/lang-context';
import { fmtDate } from '@/lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Fund {
  id: string;
  name: string;
  location?: { id: string; name: string };
  custodian?: string;
  balance: number;
  status: string;
}

interface Voucher {
  id: string;
  date: string;
  fund?: { id: string; name: string };
  submittedBy?: { name: string };
  category: string;
  description: string;
  amount: number;
  status: string;
}

interface Location {
  id: string;
  name: string;
}

const fmt = (n: number | undefined | null) =>
  'EGP ' + Number(n ?? 0).toLocaleString('en-EG', { maximumFractionDigits: 0 });

function voucherBadgeCls(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-danger',
    POSTED: 'badge-neutral',
  };
  return `badge ${map[s] ?? 'badge-neutral'}`;
}

// ── New Fund Modal ────────────────────────────────────────────────────────────
function FundModal({ locations, onClose, onSuccess }: {
  locations: Location[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { isAr } = useLang();
  const [form, setForm] = useState({ name: '', locationId: '', initialBalance: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setErr(isAr ? 'الاسم مطلوب.' : 'Name required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/petty-cash/funds', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          locationId: form.locationId || undefined,
          initialBalance: form.initialBalance ? Number(form.initialBalance) : 0,
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-md card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>{isAr ? 'صندوق جديد' : 'New Fund'}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">{isAr ? 'اسم الصندوق *' : 'Fund Name *'}</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>
          <div>
            <label className="input-label">{isAr ? 'الفرع' : 'Location'}</label>
            <SearchableCombobox
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              value={form.locationId}
              onChange={(v) => set('locationId', v)}
              placeholder={isAr ? 'اختر الفرع…' : 'Select location…'}
              clearable
            />
          </div>
          <div>
            <label className="input-label">{isAr ? 'الرصيد الأولي (ج.م)' : 'Initial Balance (EGP)'}</label>
            <NumericInput className="input" min="0" value={form.initialBalance}
              onChange={(val) => set('initialBalance', val)} />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إنشاء الصندوق' : 'Create Fund')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Replenish Modal ───────────────────────────────────────────────────────────
function ReplenishModal({ fund, onClose, onSuccess }: {
  fund: Fund;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { isAr } = useLang();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setErr(isAr ? 'أدخل مبلغاً موجباً.' : 'Enter a positive amount.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch(`/petty-cash/funds/${fund.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ replenishAmount: Number(amount) }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>
            {isAr ? 'تعبئة الصندوق —' : 'Replenish —'} {fund.name}
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">{isAr ? 'الرصيد الحالي' : 'Current Balance'}</label>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: Number(fund.balance) < 500 ? 'var(--warning)' : 'var(--primary)', marginTop: '0.25rem' }}>
              {fmt(fund.balance)}
            </p>
          </div>
          <div>
            <label className="input-label">{isAr ? 'مبلغ التعبئة (ج.م) *' : 'Replenish Amount (EGP) *'}</label>
            <NumericInput className="input" min="1" value={amount}
              onChange={(val) => setAmount(val)} />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'تعبئة' : 'Replenish')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Submit Voucher Modal ──────────────────────────────────────────────────────
function VoucherModal({ funds, onClose, onSuccess }: {
  funds: Fund[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { isAr } = useLang();
  const [form, setForm] = useState({ fundId: '', amount: '', description: '', category: '', receiptUrl: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fundId || !form.amount || !form.description) {
      setErr(isAr ? 'الصندوق والمبلغ والوصف مطلوبة.' : 'Fund, amount, and description are required.'); return;
    }
    setSaving(true); setErr('');
    try {
      await apiFetch('/petty-cash/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          fundId: form.fundId,
          amount: Number(form.amount),
          description: form.description,
          category: form.category || undefined,
          receiptUrl: form.receiptUrl || undefined,
        }),
      });
      onSuccess();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative w-full max-w-lg card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-1)' }}>{isAr ? 'تقديم قسيمة' : 'Submit Voucher'}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">{isAr ? 'الصندوق *' : 'Fund *'}</label>
            <SearchableCombobox
              options={funds.map((f) => ({ value: f.id, label: f.name }))}
              value={form.fundId}
              onChange={(v) => set('fundId', v)}
              placeholder={isAr ? 'اختر الصندوق…' : 'Select fund…'}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="input-label">{isAr ? 'المبلغ (ج.م) *' : 'Amount (EGP) *'}</label>
              <NumericInput className="input" min="1" value={form.amount}
                onChange={(val) => set('amount', val)} />
            </div>
            <div>
              <label className="input-label">{isAr ? 'الفئة' : 'Category'}</label>
              <input className="input" value={form.category} placeholder={isAr ? 'مثال: مستلزمات مكتبية' : 'e.g. Office Supplies'}
                onChange={(e) => set('category', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="input-label">{isAr ? 'الوصف *' : 'Description *'}</label>
            <textarea className="textarea" rows={2} value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className="input-label">{isAr ? 'رابط الإيصال' : 'Receipt URL'}</label>
            <input className="input" value={form.receiptUrl} placeholder="https://…"
              onChange={(e) => set('receiptUrl', e.target.value)} />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (isAr ? 'جارٍ الإرسال…' : 'Saving…') : (isAr ? 'تقديم القسيمة' : 'Submit Voucher')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PettyCashPage() {
  const { isAr } = useLang();
  const VOUCHER_TABS = [
    { key: 'PENDING', label: isAr ? 'قيد الانتظار' : 'Pending' },
    { key: '',        label: isAr ? 'الكل' : 'All' },
  ];
  const [voucherTab, setVoucherTab] = useState('PENDING');
  const [showFundModal, setShowFundModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [replenishFund, setReplenishFund] = useState<Fund | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: rawFunds,    loading: fundsLoading,    reload: reloadFunds    } =
    useQuery<Fund[] | { data: Fund[] }>('/petty-cash/funds');
  const { data: rawLocs } =
    useQuery<Location[] | { data: Location[] }>('/locations');

  // ponytail: voucherTab in deps array so useQuery re-fetches on tab change
  const voucherPath = voucherTab
    ? `/petty-cash/vouchers?status=${voucherTab}`
    : '/petty-cash/vouchers';
  const { data: rawVouchers, loading: vouchersLoading, reload: reloadVouchers } =
    useQuery<Voucher[] | { data: Voucher[] }>(voucherPath, [voucherTab]);

  const funds:    Fund[]     = Array.isArray(rawFunds)    ? rawFunds    : (rawFunds?.data    ?? []);
  const locations: Location[] = Array.isArray(rawLocs)    ? rawLocs     : (rawLocs?.data     ?? []);
  const vouchers: Voucher[]  = Array.isArray(rawVouchers) ? rawVouchers : (rawVouchers?.data ?? []);

  async function approveVoucher(id: string) {
    setActionLoading(`${id}_approve`);
    try {
      await apiFetch(`/petty-cash/vouchers/${id}/approve`, { method: 'POST' });
      reloadVouchers();
    } catch { /* non-critical */ }
    finally { setActionLoading(null); }
  }

  async function rejectVoucher(id: string) {
    if (!window.confirm(isAr ? 'رفض هذا السند؟' : 'Reject this voucher?')) return;
    setActionLoading(`${id}_reject`);
    try {
      await apiFetch(`/petty-cash/vouchers/${id}/reject`, { method: 'POST' });
      reloadVouchers();
    } catch { /* non-critical */ }
    finally { setActionLoading(null); }
  }

  const pendingCount = funds.reduce((s, f) => s + (Number(f.balance) < 500 ? 1 : 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'المصروفات النثرية' : 'Petty Cash'}</h1>
          <p className="page-subtitle">
            {funds.length} {isAr ? (funds.length !== 1 ? 'صناديق' : 'صندوق') : (funds.length !== 1 ? 'funds' : 'fund')}
            {pendingCount > 0 ? ` · ${pendingCount} ${isAr ? 'رصيد منخفض' : 'low balance'}` : ''}
          </p>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Section A: Funds ─────────────────────────────────── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
          }}>
            <span className="section-label" style={{ margin: 0 }}>{isAr ? 'الصناديق' : 'Funds'}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowFundModal(true)}>
              {isAr ? '+ صندوق جديد' : '+ New Fund'}
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'اسم الصندوق' : 'Fund Name'}</th>
                <th>{isAr ? 'الفرع' : 'Location'}</th>
                <th>{isAr ? 'المسؤول' : 'Custodian'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'الرصيد' : 'Balance'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {fundsLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                    {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                  </td>
                </tr>
              ) : funds.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                    {isAr ? 'لا توجد صناديق.' : 'No funds found.'}
                  </td>
                </tr>
              ) : (
                funds.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 500 }}>{f.name}</td>
                    <td style={{ color: 'var(--text-2)' }}>{f.location?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{f.custodian ?? '—'}</td>
                    <td style={{
                      textAlign: 'right', fontWeight: 600,
                      color: Number(f.balance) < 500 ? 'var(--warning)' : 'var(--text-1)',
                    }}>
                      {fmt(f.balance)}
                      {Number(f.balance) < 500 && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.6875rem' }}>⚠</span>
                      )}
                    </td>
                    <td>
                      <span className={f.status === 'ACTIVE' ? 'badge badge-success' : 'badge badge-neutral'}>
                        {f.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setReplenishFund(f)}>
                        {isAr ? 'تعبئة' : 'Replenish'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Section B: Vouchers ──────────────────────────────── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
          }}>
            <span className="section-label" style={{ margin: 0 }}>{isAr ? 'القسائم' : 'Vouchers'}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowVoucherModal(true)}>
              {isAr ? '+ تقديم قسيمة' : '+ Submit Voucher'}
            </button>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ paddingLeft: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            {VOUCHER_TABS.map((t) => (
              <button
                key={t.key}
                className={`tab ${voucherTab === t.key ? 'active' : ''}`}
                onClick={() => setVoucherTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'التاريخ' : 'Date'}</th>
                <th>{isAr ? 'الصندوق' : 'Fund'}</th>
                <th>{isAr ? 'مقدم من' : 'Submitted By'}</th>
                <th>{isAr ? 'الفئة' : 'Category'}</th>
                <th>{isAr ? 'الوصف' : 'Description'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'المبلغ' : 'Amount'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {vouchersLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                    {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                    {isAr ? 'لا توجد قسائم.' : 'No vouchers found.'}
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={v.id}>
                    <td style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {fmtDate(v.date, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 500 }}>{v.fund?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{v.submittedBy?.name ?? '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{v.category || '—'}</td>
                    <td style={{
                      color: 'var(--text-2)', maxWidth: '14rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {v.description}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(v.amount)}</td>
                    <td>
                      <span className={voucherBadgeCls(v.status)}>
                        {v.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {v.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--success-bg)', color: 'var(--success-fg)', border: 'none' }}
                            disabled={actionLoading === `${v.id}_approve`}
                            onClick={() => approveVoucher(v.id)}
                          >
                            {actionLoading === `${v.id}_approve` ? '…' : (isAr ? 'اعتماد' : 'Approve')}
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)', border: 'none' }}
                            disabled={actionLoading === `${v.id}_reject`}
                            onClick={() => rejectVoucher(v.id)}
                          >
                            {actionLoading === `${v.id}_reject` ? '…' : (isAr ? 'رفض' : 'Reject')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showFundModal && (
        <FundModal
          locations={locations}
          onClose={() => setShowFundModal(false)}
          onSuccess={() => { setShowFundModal(false); reloadFunds(); }}
        />
      )}
      {replenishFund && (
        <ReplenishModal
          fund={replenishFund}
          onClose={() => setReplenishFund(null)}
          onSuccess={() => { setReplenishFund(null); reloadFunds(); }}
        />
      )}
      {showVoucherModal && (
        <VoucherModal
          funds={funds}
          onClose={() => setShowVoucherModal(false)}
          onSuccess={() => { setShowVoucherModal(false); reloadVouchers(); }}
        />
      )}
    </div>
  );
}
