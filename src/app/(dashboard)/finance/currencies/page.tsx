'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import { ErrorBanner } from '@/components/ui/error-banner';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExchangeRate {
  rate: number | string;
  date: string;
}

interface Currency {
  id:            string;
  code:          string;
  name?:         string;
  symbol:        string;
  decimalPlaces: number;
  active:        boolean;
  rates?:        ExchangeRate[];
}

const fmt = (n: number | string) =>
  Number(n).toLocaleString('en-EG', { minimumFractionDigits: 4, maximumFractionDigits: 6 });

function timeAgo(iso: string, isAr: boolean) {
  const diff = Date.now() - new Date(iso).getTime();
  const h    = Math.floor(diff / 3600000);
  if (h < 1)   return isAr ? 'الآن' : 'Just now';
  if (h < 24)  return isAr ? `منذ ${h} س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return isAr ? `منذ ${d} ي` : `${d}d ago`;
}

// ── Add Currency Modal ────────────────────────────────────────────────────────
function AddCurrencyModal({ onClose, onSuccess, isAr }: { onClose: () => void; onSuccess: () => void; isAr: boolean }) {
  const [form, setForm] = useState({ code: '', name: '', symbol: '', decimalPlaces: '2' });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code || !form.symbol) { setErr(isAr ? 'الرمز مطلوب.' : 'Code and symbol are required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/currencies', {
        method: 'POST',
        body: JSON.stringify({
          code:          form.code.toUpperCase(),
          name:          form.name || undefined,
          symbol:        form.symbol,
          decimalPlaces: Number(form.decimalPlaces) || 2,
        }),
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
          <h2 className="page-title" style={{ fontSize: '0.9375rem' }}>
            {isAr ? 'إضافة عملة' : 'Add Currency'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="input-label">{isAr ? 'رمز العملة *' : 'Currency Code *'}</label>
            <input required className="input" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="USD" maxLength={3} />
          </div>
          <div>
            <label className="input-label">{isAr ? 'الاسم' : 'Name'}</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="US Dollar" />
          </div>
          <div>
            <label className="input-label">{isAr ? 'الرمز *' : 'Symbol *'}</label>
            <input required className="input" value={form.symbol} onChange={(e) => set('symbol', e.target.value)} placeholder="$" maxLength={4} />
          </div>
          <div>
            <label className="input-label">{isAr ? 'المنازل العشرية' : 'Decimal Places'}</label>
            <input type="number" min="0" max="6" className="input" value={form.decimalPlaces} onChange={(e) => set('decimalPlaces', e.target.value)} />
          </div>
          {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? '…' : (isAr ? 'إضافة عملة' : 'Add Currency')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rate History Mini Chart ───────────────────────────────────────────────────
function RateHistoryChart({ rates }: { rates: ExchangeRate[] }) {
  if (rates.length < 2) return null;
  const values = rates.slice(-12).map((r) => Number(r.rate));
  const min    = Math.min(...values);
  const max    = Math.max(...values, min + 0.001);
  const W      = 160;
  const H      = 36;
  const pts    = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / (max - min)) * H;
    return `${x},${y}`;
  });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={pts[pts.length - 1]?.split(',')[0]} cy={pts[pts.length - 1]?.split(',')[1]} r={2.5} fill="var(--primary)" />
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CurrenciesPage() {
  const { isAr } = useLang();
  const { data: raw, loading, error, reload } = useQuery<Currency[]>('/finance/currencies');
  const [addingId,    setAddingId]    = useState<string | null>(null);
  const [rateInput,   setRateInput]   = useState('');
  const [dateInput,   setDateInput]   = useState(new Date().toISOString().slice(0, 10));
  const [saving,      setSaving]      = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [revaluing,   setRevaluing]   = useState(false);
  const [revalResult, setRevalResult] = useState<{ revaluedCount: number; totalVariance: number } | null>(null);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);

  const currencies = Array.isArray(raw) ? raw : [];
  const selected   = currencies.find((c) => c.id === selectedId) ?? currencies[0];

  async function addRate(currencyId: string) {
    if (!rateInput) return;
    setSaving(true);
    try {
      await apiFetch(`/finance/currencies/${currencyId}/rates`, {
        method: 'POST',
        body: JSON.stringify({ rate: parseFloat(rateInput), date: new Date(dateInput).toISOString() }),
      });
      setAddingId(null);
      setRateInput('');
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function toggleActive(id: string) {
    try {
      await apiFetch(`/finance/currencies/${id}/toggle-active`, { method: 'PATCH' });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
  }

  async function runRevaluation() {
    if (!confirm(isAr
      ? 'تشغيل إعادة تقييم العملات الأجنبية في نهاية الفترة؟ سيتم ترحيل قيود للأرصدة المفتوحة.'
      : 'Run period-end FX revaluation? This will post GL entries for all open foreign-currency balances.')) return;
    setRevaluing(true);
    setRevalResult(null);
    try {
      const res = await apiFetch<{ revaluedCount: number; totalVariance: number }>('/finance/currencies/revaluate', { method: 'POST' });
      setRevalResult(res);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : (isAr ? 'فشل إعادة التقييم' : 'Revaluation failed')); }
    finally { setRevaluing(false); }
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isAr ? 'العملات وأسعار الصرف' : 'Currencies & Exchange Rates'}
          </h1>
          <p className="page-subtitle">
            {isAr ? 'إدخال يدوي لأسعار الصرف — الجنيه المصري هو العملة الأساسية' : 'Manual exchange rate entry — EGP is the base currency'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={runRevaluation} disabled={revaluing}>
            {revaluing ? (isAr ? 'جاري التشغيل…' : 'Running…') : (isAr ? 'إعادة تقييم العملات' : 'Run FX Revaluation')}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            {isAr ? '+ إضافة عملة' : '+ Add Currency'}
          </button>
        </div>
      </div>

      <div className="page-body space-y-4">
        {/* Revaluation result */}
        {revalResult && (
          <div className="card p-4 flex items-center gap-3" style={{ borderColor: 'var(--success-bg)', background: 'var(--success-bg)' }}>
            <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--success-fg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ fontSize: '0.8125rem', color: 'var(--success-fg)' }}>
              {isAr
                ? `اكتملت إعادة التقييم — ${revalResult.revaluedCount} سطر معدّل، صافي الفرق `
                : `Revaluation complete — ${revalResult.revaluedCount} lines adjusted, net variance `}
              <strong>{revalResult.totalVariance.toLocaleString('en-EG')} EGP</strong>
            </p>
            <button onClick={() => setRevalResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success-fg)', fontSize: '1.1rem' }}>×</button>
          </div>
        )}

        {loading && (
          <div className="card py-12 text-center" style={{ color: 'var(--text-3)' }}>
            {isAr ? 'جاري تحميل العملات…' : 'Loading currencies…'}
          </div>
        )}
        {error && <ErrorBanner error={error} retry={reload} />}

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr auto' }}>
          {/* Currency table */}
          <div className="card overflow-hidden" style={{ alignSelf: 'start' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'رمز العملة' : 'Currency Code'}</th>
                  <th>{isAr ? 'الاسم' : 'Name'}</th>
                  <th>{isAr ? 'الرمز' : 'Symbol'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'السعر مقابل الجنيه' : 'Rate to EGP'}</th>
                  <th>{isAr ? 'آخر تحديث' : 'Last Updated'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((c) => {
                  const latestRate = c.rates?.[c.rates.length - 1];
                  const isBase     = c.code === 'EGP';

                  return [
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{ cursor: 'pointer', background: selectedId === c.id ? 'var(--surface-2)' : undefined }}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex items-center justify-center rounded-md"
                            style={{ width: 32, height: 32, background: 'var(--surface-2)', flexShrink: 0 }}
                          >
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-1)' }}>{c.symbol}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-1)', fontFamily: 'monospace' }}>{c.code}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{c.name ?? '—'}</td>
                      <td style={{ color: 'var(--text-2)' }}>{c.symbol}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>
                        {isBase ? '1.000000' : latestRate ? fmt(latestRate.rate) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--text-3)' }}>
                        {latestRate ? timeAgo(latestRate.date, isAr) : isBase ? (isAr ? 'أساسية' : 'Base') : '—'}
                      </td>
                      <td>
                        <span className={`badge ${c.active ? 'badge-success' : 'badge-neutral'}`}>
                          {c.active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {!isBase && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => { setAddingId(addingId === c.id ? null : c.id); setRateInput(''); }}
                            >
                              {isAr ? 'تحديث السعر' : 'Update Rate'}
                            </button>
                          )}
                          {!isBase && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleActive(c.id)}
                              style={{ color: c.active ? 'var(--danger-fg)' : 'var(--success-fg)' }}
                            >
                              {c.active ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,

                    // Inline rate update row
                    addingId === c.id && (
                      <tr key={`${c.id}-rate`}>
                        <td colSpan={8} style={{ padding: '0.75rem 1rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                          <div className="flex items-end gap-3">
                            <div>
                              <label className="input-label">
                                {isAr ? `السعر (ج.م. مقابل 1 ${c.code})` : `Rate (EGP per 1 ${c.code})`}
                              </label>
                              <input
                                type="number"
                                step="0.000001"
                                className="input"
                                style={{ width: 180 }}
                                value={rateInput}
                                onChange={(e) => setRateInput(e.target.value)}
                                placeholder="e.g. 49.500000"
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="input-label">{isAr ? 'تاريخ السريان' : 'Effective Date'}</label>
                              <input
                                type="date"
                                className="input"
                                style={{ width: 160 }}
                                value={dateInput}
                                onChange={(e) => setDateInput(e.target.value)}
                              />
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={saving || !rateInput}
                              onClick={() => addRate(c.id)}
                            >
                              {saving ? '…' : (isAr ? 'حفظ السعر' : 'Save Rate')}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setAddingId(null)}
                            >
                              {isAr ? 'إلغاء' : 'Cancel'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean);
                })}

                {currencies.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-3)' }}>
                      {isAr ? 'لا توجد عملات. انقر على "+ إضافة عملة" للبدء.' : 'No currencies configured. Click "+ Add Currency" to start.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rate history panel */}
          {selected && (
            <div className="card p-5" style={{ width: 240, alignSelf: 'start' }}>
              <p className="section-label">{isAr ? 'سجل الأسعار' : 'Rate History'}</p>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-1)' }}>{selected.symbol}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-1)', fontFamily: 'monospace' }}>{selected.code}</span>
              </div>
              {selected.code === 'EGP' ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  {isAr ? 'العملة الأساسية — دائماً 1.000000' : 'Base currency — always 1.000000'}
                </p>
              ) : selected.rates && selected.rates.length > 0 ? (
                <>
                  <RateHistoryChart rates={selected.rates} />
                  <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                    {[...selected.rates].reverse().slice(0, 10).map((r, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>
                          {fmtDate(r.date, isAr, { day: '2-digit', month: 'short' })}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(r.rate)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  {isAr ? 'لا يوجد سجل أسعار. انقر على «تحديث السعر» لإضافة واحد.' : 'No rate history. Click "Update Rate" to add one.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Currency Modal */}
      {showAdd && (
        <AddCurrencyModal
          isAr={isAr}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); reload(); }}
        />
      )}
    </div>
  );
}
