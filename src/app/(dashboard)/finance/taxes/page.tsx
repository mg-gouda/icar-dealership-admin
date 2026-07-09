'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { ErrorBanner } from '@/components/ui/error-banner';

interface TaxGroup { id: string; name: string; _count?: { taxes: number }; }
interface Tax {
  id: string; name: string; amount: number; computation: string;
  scope: string; includedInPrice: boolean; active?: boolean;
  taxGroup?: { name: string }; account?: { code: string; name: string };
}
interface Account { id: string; code: string; name: string; }


export default function TaxesPage() {
  const { isAr } = useLang();

  const COMPUTATIONS = [
    { value: 'PERCENT', label: isAr ? 'نسبة مئوية' : 'Percentage' },
    { value: 'FIXED', label: isAr ? 'مبلغ ثابت' : 'Fixed Amount' },
  ];
  const SCOPES = [
    { value: 'SALE', label: isAr ? 'مبيعات' : 'Sales' },
    { value: 'PURCHASE', label: isAr ? 'مشتريات' : 'Purchase' },
    { value: 'ALL', label: isAr ? 'كلاهما' : 'Both' },
  ];

  const { data: taxes, loading, error, reload } = useQuery<Tax[]>('/finance/taxes');
  const { data: groups, reload: reloadGroups } = useQuery<TaxGroup[]>('/finance/taxes/groups');
  const { data: accountsRes } = useQuery<{ items: Account[] }>('/finance/accounts?limit=200');

  const [tab, setTab] = useState<'rates' | 'groups'>('rates');
  const [showTax, setShowTax] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [taxForm, setTaxForm] = useState({
    name: '', amount: '', computation: 'PERCENT', scope: 'SALE',
    includedInPrice: false, taxGroupId: '', accountId: '',
  });
  const [groupForm, setGroupForm] = useState({ name: '' });

  const taxList = Array.isArray(taxes) ? taxes : [];
  const groupList = Array.isArray(groups) ? groups : [];
  const accountOpts = (accountsRes?.items ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));
  const groupOpts = groupList.map((g) => ({ value: g.id, label: g.name }));

  function setT(k: string, v: string | boolean) { setTaxForm((p) => ({ ...p, [k]: v })); }

  async function createTax(e: React.FormEvent) {
    e.preventDefault();
    if (!taxForm.name || !taxForm.amount) { setErr(isAr ? 'الاسم والمبلغ مطلوبان.' : 'Name and amount required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/taxes', {
        method: 'POST',
        body: JSON.stringify({
          name: taxForm.name, amount: parseFloat(taxForm.amount),
          computation: taxForm.computation, scope: taxForm.scope,
          includedInPrice: taxForm.includedInPrice,
          taxGroupId: taxForm.taxGroupId || undefined,
          accountId: taxForm.accountId || undefined,
        }),
      });
      setShowTax(false); reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/finance/taxes/groups', { method: 'POST', body: JSON.stringify({ name: groupForm.name }) });
      setShowGroup(false); reloadGroups();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="page-body">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">{isAr ? 'الضرائب' : 'Taxes'}</h1>
          <p className="page-subtitle">{isAr ? 'مجموعات ومعدلات الضرائب' : 'VAT & withholding tax configuration'}</p>
        </div>
        <button onClick={() => tab === 'rates' ? setShowTax(true) : setShowGroup(true)} className="btn btn-primary btn-sm">
          {tab === 'rates' ? (isAr ? '+ معدل ضريبي' : '+ Tax Rate') : (isAr ? '+ مجموعة ضريبية' : '+ Tax Group')}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs mb-5">
        {(['rates', 'groups'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab${tab === t ? ' active' : ''}`}>
            {t === 'rates' ? (isAr ? 'المعدلات' : 'Rates') : (isAr ? 'المجموعات' : 'Groups')}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>}
      {error && <div className="mb-5"><ErrorBanner error={error} retry={reload} /></div>}

      {tab === 'rates' && (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'المبلغ' : 'Amount'}</th>
                <th>{isAr ? 'النوع' : 'Type'}</th>
                <th>{isAr ? 'النطاق' : 'Scope'}</th>
                <th>{isAr ? 'المجموعة' : 'Group'}</th>
                <th>{isAr ? 'حساب المحاسبة' : 'GL Account'}</th>
                <th style={{ textAlign: 'center' }}>{isAr ? 'مضمن بالسعر' : 'In Price'}</th>
              </tr>
            </thead>
            <tbody>
              {taxList.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {t.computation === 'PERCENT' ? `${t.amount}%` : `${Number(t.amount).toLocaleString()} EGP`}
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{t.computation}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{t.scope}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{t.taxGroup?.name ?? '—'}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {t.account ? `${t.account.code} ${t.account.name}` : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: t.includedInPrice ? 'var(--success)' : 'var(--border-strong)',
                    }} />
                  </td>
                </tr>
              ))}
              {taxList.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                  {isAr ? 'لا توجد معدلات ضريبية.' : 'No tax rates configured.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {groupList.map((g) => (
            <div key={g.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{g.name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                {g._count?.taxes ?? 0} {isAr ? 'معدلات' : 'rates'}
              </span>
            </div>
          ))}
          {groupList.length === 0 && !loading && (
            <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'لا توجد مجموعات ضريبية.' : 'No tax groups.'}</p>
          )}
        </div>
      )}

      {/* Create Tax dialog */}
      {showTax && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowTax(false)} />
          <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 440, borderRadius: '1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)' }}>{isAr ? 'معدل ضريبي جديد' : 'New Tax Rate'}</h2>
              <button onClick={() => setShowTax(false)} className="btn btn-ghost btn-sm" style={{ fontSize: '1.2rem', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={createTax} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="input-label">{isAr ? 'الاسم *' : 'Name *'}</label>
                <input required className="input" value={taxForm.name} onChange={(e) => setT('name', e.target.value)}
                  placeholder={isAr ? 'مثال: ضريبة القيمة المضافة 14%' : 'e.g. VAT 14%'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{isAr ? 'المبلغ *' : 'Amount *'}</label>
                  <input required type="number" step="0.01" className="input" value={taxForm.amount}
                    onChange={(e) => setT('amount', e.target.value)} placeholder="14" />
                </div>
                <SearchableCombobox label={isAr ? 'طريقة الحساب' : 'Computation'} options={COMPUTATIONS} value={taxForm.computation} onChange={(v) => setT('computation', v)} />
              </div>
              <SearchableCombobox label={isAr ? 'النطاق' : 'Scope'} options={SCOPES} value={taxForm.scope} onChange={(v) => setT('scope', v)} />
              <SearchableCombobox label={isAr ? 'المجموعة الضريبية' : 'Tax Group'} options={groupOpts} value={taxForm.taxGroupId} onChange={(v) => setT('taxGroupId', v)} placeholder={isAr ? 'بدون' : 'None'} clearable />
              <SearchableCombobox label={isAr ? 'حساب المحاسبة' : 'GL Account'} options={accountOpts} value={taxForm.accountId} onChange={(v) => setT('accountId', v)} placeholder={isAr ? 'اختر…' : 'Select…'} clearable />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={taxForm.includedInPrice} onChange={(e) => setT('includedInPrice', e.target.checked)} />
                {isAr ? 'مضمن في السعر' : 'Included in price'}
              </label>
              {err && <p style={{ color: 'var(--danger-fg)', fontSize: '0.8125rem' }}>{err}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem' }}>
                <button type="button" onClick={() => setShowTax(false)} className="btn btn-secondary" style={{ flex: 1 }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                  {saving ? '…' : (isAr ? 'إنشاء' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group dialog */}
      {showGroup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowGroup(false)} />
          <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 360, borderRadius: '1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: '1.25rem' }}>
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)', marginBottom: '1rem' }}>{isAr ? 'مجموعة ضريبية جديدة' : 'New Tax Group'}</h2>
            <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="input-label">{isAr ? 'الاسم *' : 'Name *'}</label>
                <input required className="input" value={groupForm.name} onChange={(e) => setGroupForm({ name: e.target.value })}
                  placeholder={isAr ? 'مثال: ض.ق.م' : 'e.g. VAT'} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowGroup(false)} className="btn btn-secondary" style={{ flex: 1 }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                  {saving ? '…' : (isAr ? 'إنشاء' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
