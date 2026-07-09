'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { ErrorBanner } from '@/components/ui/error-banner';

interface Account {
  id: string; code: string; name: string; type: string;
  normalBalance: string; isActive: boolean;
  balance?: number;
  parent?: { code: string; name: string };
  subGroup?: string;
}


const TYPE_ORDER = ['Asset','ContraAsset','Liability','ContraLiability','Equity','Revenue','ContraRevenue','Expense','ContraExpense'];

const TYPE_SECTION: Record<string, string> = {
  Asset: 'ASSETS', ContraAsset: 'ASSETS',
  Liability: 'LIABILITIES', ContraLiability: 'LIABILITIES',
  Equity: 'EQUITY',
  Revenue: 'INCOME', ContraRevenue: 'COST OF REVENUE',
  Expense: 'EXPENSES', ContraExpense: 'EXPENSES',
};

const TYPE_BADGE: Record<string, string> = {
  Asset: 'badge-info',
  ContraAsset: 'badge-neutral',
  Liability: 'badge-orange',
  ContraLiability: 'badge-neutral',
  Equity: 'badge-purple',
  Revenue: 'badge-success',
  ContraRevenue: 'badge-purple',
  Expense: 'badge-neutral',
  ContraExpense: 'badge-neutral',
};

const TYPE_LABEL: Record<string, string> = {
  Asset: 'Asset', ContraAsset: 'Contra', Liability: 'Liability',
  ContraLiability: 'Contra', Equity: 'Equity', Revenue: 'Income',
  ContraRevenue: 'Cost', Expense: 'Expense', ContraExpense: 'Contra',
};

const TYPE_LABEL_AR: Record<string, string> = {
  Asset: 'أصول', ContraAsset: 'مقابل', Liability: 'خصوم',
  ContraLiability: 'مقابل', Equity: 'حقوق الملكية', Revenue: 'إيرادات',
  ContraRevenue: 'تكلفة', Expense: 'مصروفات', ContraExpense: 'مقابل',
};

const egp = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountsPage() {
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState({ code: '', name: '', type: 'Asset', normalBalance: 'DEBIT', parentId: '' });
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState<string | null>(null);
  const [err, setErr]               = useState('');
  const { isAr } = useLang();

  const ACCOUNT_TYPES = [
    { value: 'Asset', label: isAr ? 'أصول' : 'Asset' },
    { value: 'Liability', label: isAr ? 'التزامات' : 'Liability' },
    { value: 'Equity', label: isAr ? 'حقوق ملكية' : 'Equity' },
    { value: 'Revenue', label: isAr ? 'إيرادات' : 'Revenue' },
    { value: 'Expense', label: isAr ? 'مصروفات' : 'Expense' },
    { value: 'ContraAsset', label: isAr ? 'أصول مقابلة' : 'ContraAsset' },
    { value: 'ContraLiability', label: 'ContraLiability' },
    { value: 'ContraEquity', label: 'ContraEquity' },
    { value: 'ContraRevenue', label: 'ContraRevenue' },
    { value: 'ContraExpense', label: 'ContraExpense' },
  ];
  const NORMAL_BALANCE_OPTS = [
    { value: 'DEBIT', label: isAr ? 'مدين' : 'Debit' },
    { value: 'CREDIT', label: isAr ? 'دائن' : 'Credit' },
  ];

  const { data: res, loading, error, reload } = useQuery<{ items: Account[]; total: number }>('/finance/accounts?limit=500');
  const accounts = res?.items ?? [];

  const filtered = accounts.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (!search) return true;
    return a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase());
  });

  // Group by section
  const sections: Record<string, Account[]> = {};
  TYPE_ORDER.forEach(t => {
    const sec = TYPE_SECTION[t];
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(...filtered.filter(a => a.type === t));
  });

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code || !form.name) { setErr(isAr ? 'الكود والاسم مطلوبان.' : 'Code and name required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/accounts', {
        method: 'POST',
        body: JSON.stringify({ code: form.code, name: form.name, type: form.type, normalBalance: form.normalBalance, parentId: form.parentId || undefined }),
      });
      setShowCreate(false);
      setForm({ code: '', name: '', type: 'Asset', normalBalance: 'DEBIT', parentId: '' });
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function toggleActive(a: Account) {
    setToggling(a.id);
    try {
      await apiFetch(`/finance/accounts/${a.id}/${a.isActive ? 'deactivate' : 'activate'}`, { method: 'PATCH' });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setToggling(null); }
  }

  const parentOpts = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'دليل الحسابات' : 'Chart of Accounts'}</h1>
          <p className="page-subtitle">{isAr ? 'دليل الحسابات — التسلسل الهرمي الكامل' : 'DealerMS COA — Full Hierarchy'}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
          {isAr ? '+ حساب جديد' : '+ New Account'}
        </button>
      </div>

      <div className="page-body">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text-3)' }}>
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث…' : 'Search accounts...'}
              className="input pl-8" style={{ fontSize: '0.8125rem' }} />
          </div>
          <SearchableCombobox
            label="" placeholder={isAr ? 'كل الأنواع' : 'All Types'}
            options={[{ value: '', label: isAr ? 'كل الأنواع' : 'All Types' }, ...ACCOUNT_TYPES]}
            value={typeFilter} onChange={v => setTypeFilter(v)}
          />
          {['Asset','Liability'].map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              className="btn btn-secondary btn-sm"
              style={typeFilter === t ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : {}}>
              {t === 'Asset' ? (isAr ? 'الأصول' : 'Assets') : (isAr ? 'الالتزامات' : 'Liabilities')} ›
            </button>
          ))}
        </div>

        {error && <div className="mb-4"><ErrorBanner error={error} retry={reload} /></div>}
        {loading && (
          <div className="card">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-4 px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="w-16 h-4 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
                <div className="flex-1 h-4 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '7rem' }}>{isAr ? 'الكود' : 'Code'}</th>
                  <th>{isAr ? 'الاسم' : 'Account Name'}</th>
                  <th style={{ width: '8rem' }}>{isAr ? 'النوع' : 'Type'}</th>
                  <th style={{ width: '5rem' }}>{isAr ? 'م/د' : 'D/C'}</th>
                  <th style={{ width: '8rem', textAlign: 'right' }}>{isAr ? 'الرصيد' : 'Balance'}</th>
                  <th style={{ width: '5rem', textAlign: 'center' }}>{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(sections).filter(([, accs]) => accs.length > 0).map(([section, accs]) => (
                  <>
                    {/* Section header */}
                    <tr key={`sec-${section}`}>
                      <td colSpan={6} style={{ padding: '0.6rem 1rem 0.35rem', fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        ▾ {section}
                      </td>
                    </tr>
                    {accs.map(a => (
                      <tr key={a.id} style={{ opacity: a.isActive ? 1 : 0.45 }}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.8125rem' }}>{a.code}</td>
                        <td style={{ color: 'var(--text-1)', paddingLeft: a.parent ? '2rem' : '1rem' }}>
                          {a.name}
                        </td>
                        <td>
                          <span className={`badge ${TYPE_BADGE[a.type] ?? 'badge-neutral'}`}>
                            {isAr ? (TYPE_LABEL_AR[a.type] ?? TYPE_LABEL[a.type] ?? a.type) : (TYPE_LABEL[a.type] ?? a.type)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{a.normalBalance}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem', color: 'var(--text-1)' }}>
                          {a.balance != null ? egp(a.balance) : '0.00'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => toggleActive(a)} disabled={toggling === a.id}
                            className={`badge ${a.isActive ? 'badge-success' : 'badge-neutral'}`}
                            style={{ cursor: 'pointer', border: 'none' }}>
                            {toggling === a.id ? '…' : a.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
                      {isAr ? 'لا توجد حسابات' : 'No accounts found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Account modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'oklch(0 0 0 / 0.4)' }} onClick={() => setShowCreate(false)} />
          <div className="relative card shadow-2xl w-full max-w-md" style={{ zIndex: 1 }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{isAr ? 'حساب جديد' : 'New Account'}</h2>
              <button onClick={() => setShowCreate(false)} style={{ color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{isAr ? 'الكود *' : 'Code *'}</label>
                  <input required value={form.code} onChange={e => set('code', e.target.value)}
                    className="input" style={{ fontFamily: 'monospace' }} placeholder="e.g. 100010" />
                </div>
                <SearchableCombobox label={isAr ? 'النوع' : 'Type'} options={ACCOUNT_TYPES} value={form.type} onChange={v => set('type', v)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'اسم الحساب *' : 'Account Name *'}</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} className="input" />
              </div>
              <SearchableCombobox label={isAr ? 'الرصيد الطبيعي' : 'Normal Balance'} options={NORMAL_BALANCE_OPTS} value={form.normalBalance} onChange={v => set('normalBalance', v)} />
              <SearchableCombobox label={isAr ? 'الحساب الأب (اختياري)' : 'Parent Account (optional)'} options={parentOpts} value={form.parentId}
                onChange={v => set('parentId', v)} placeholder={isAr ? 'بدون (مستوى أول)' : 'None (top level)'} clearable />
              {err && <p className="text-xs" style={{ color: 'var(--danger)' }}>{err}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary flex-1">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'إنشاء الحساب' : 'Create Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
