'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface DepScheduleLine {
  period: string;
  openingNBV: number;
  depreciation: number;
  closingNBV: number;
  posted: boolean;
}

interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLife: number; // years
  method: string;
  status: string;
  accumDepreciation: number;
  netBookValue: number;
  schedule?: DepScheduleLine[];
}

interface Account { id: string; code: string; name: string; }


const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AssetsPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const METHODS = [
    { value: 'STRAIGHT_LINE', label: isAr ? 'القسط الثابت' : 'Straight Line' },
    { value: 'DECLINING_BALANCE', label: isAr ? 'الرصيد المتناقص' : 'Declining Balance' },
    { value: 'SUM_OF_YEARS_DIGITS', label: isAr ? 'مجموع أرقام السنوات' : 'Sum of Years Digits' },
  ];
  const CATEGORIES = [
    { value: '', label: isAr ? 'جميع الفئات' : 'All Categories' },
    { value: 'VEHICLE', label: isAr ? 'مركبة' : 'Vehicle' },
    { value: 'EQUIPMENT', label: isAr ? 'معدات' : 'Equipment' },
    { value: 'FURNITURE', label: isAr ? 'أثاث' : 'Furniture' },
    { value: 'IT', label: isAr ? 'تقنية المعلومات' : 'IT & Tech' },
    { value: 'BUILDING', label: isAr ? 'مبنى' : 'Building' },
    { value: 'OTHER', label: isAr ? 'أخرى' : 'Other' },
  ];
  const CATEGORY_OPTS = CATEGORIES.slice(1);
  const STATUS_OPTS = [
    { value: '', label: isAr ? 'جميع الحالات' : 'All Statuses' },
    { value: 'ACTIVE', label: isAr ? 'نشط' : 'Active' },
    { value: 'DISPOSED', label: isAr ? 'مستبعد' : 'Disposed' },
    { value: 'FULLY_DEPRECIATED', label: isAr ? 'مستهلك بالكامل' : 'Fully Depreciated' },
  ];
  function methodLabel(m: string) {
    return METHODS.find((x) => x.value === m)?.label ?? m.replace(/_/g, ' ');
  }

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [postingMonth, setPostingMonth] = useState('');
  const [posting, setPosting] = useState(false);
  const [runningDepr, setRunningDepr] = useState(false);
  const [deprMsg, setDeprMsg] = useState('');

  const qs = new URLSearchParams();
  if (categoryFilter) qs.set('category', categoryFilter);
  if (statusFilter) qs.set('status', statusFilter);
  const { data: res, loading, reload } = useQuery<{ items: FixedAsset[]; total: number }>(
    `/finance/assets?${qs.toString()}`
  );
  const { data: accounts } = useQuery<{ items: Account[] }>('/finance/accounts?limit=200');
  const { data: expandedAsset, loading: loadingDetail } = useQuery<FixedAsset>(
    expandedId ? `/finance/assets/${expandedId}` : null
  );

  const assets = (res?.items ?? []).filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code?.toLowerCase().includes(search.toLowerCase())
  );

  const accountOpts = (accounts?.items ?? []).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));

  const totalValue = assets.reduce((s, a) => s + Number(a.cost), 0);
  const totalNBV = assets.reduce((s, a) => s + Number(a.netBookValue ?? 0), 0);
  const activeCount = assets.filter((a) => a.status === 'ACTIVE').length;
  const thisMonthDepr = assets.reduce((s, a) => {
    if (!a.schedule) return s;
    const now = new Date().toISOString().slice(0, 7);
    const line = a.schedule.find((l) => l.period === now);
    return s + (line?.depreciation ?? 0);
  }, 0);

  const [form, setForm] = useState({
    name: '', category: 'EQUIPMENT', purchaseDate: new Date().toISOString().slice(0, 10),
    cost: '', salvageValue: '0', usefulLife: '5', method: 'STRAIGHT_LINE',
    description: '', locationId: '', assetAccountId: '',
  });

  function setF(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.cost) { setErr(isAr ? 'الاسم والتكلفة مطلوبان.' : 'Name and cost required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/finance/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          purchaseDate: new Date(form.purchaseDate).toISOString(),
          cost: parseFloat(form.cost),
          salvageValue: parseFloat(form.salvageValue) || 0,
          usefulLife: parseInt(form.usefulLife),
          method: form.method,
          description: form.description || undefined,
          locationId: form.locationId || undefined,
          assetAccountId: form.assetAccountId || undefined,
        }),
      });
      setShowCreate(false);
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function postDepreciation(assetId: string) {
    if (!postingMonth) { alert(isAr ? 'اختر شهراً أولاً.' : 'Select a month first.'); return; }
    setPosting(true);
    try {
      await apiFetch(`/finance/assets/${assetId}/depreciate`, {
        method: 'POST',
        body: JSON.stringify({ month: postingMonth }),
      });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPosting(false); }
  }

  const schedule = expandedAsset?.schedule ?? [];
  const postedCount = schedule.filter((l) => l.posted).length;
  const totalMonths = expandedAsset ? expandedAsset.usefulLife * 12 : 0;
  const progressPct = totalMonths > 0 ? Math.round((postedCount / totalMonths) * 100) : 0;

  function statusBadge(status: string) {
    if (status === 'ACTIVE') return <span className="badge badge-success">{isAr ? 'نشط' : 'Active'}</span>;
    if (status === 'DISPOSED') return <span className="badge badge-neutral">{isAr ? 'مُستبعد' : 'Disposed'}</span>;
    if (status === 'FULLY_DEPRECIATED') return <span className="badge badge-warning">{isAr ? 'مستهلك كليًا' : 'Fully Depr.'}</span>;
    return <span className="badge badge-neutral">{status}</span>;
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'الأصول الثابتة' : 'Fixed Assets Register'}</h1>
          <p className="page-subtitle">{isAr ? 'إدارة الأصول الثابتة والاستهلاك' : 'Asset Register & Depreciation Schedule'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          {deprMsg && <span style={{ fontSize: '0.8125rem', color: 'var(--success-fg)', fontWeight: 600 }}>{deprMsg}</span>}
          <button
            className="btn btn-outline btn-sm"
            disabled={runningDepr}
            onClick={async () => {
              setRunningDepr(true); setDeprMsg('');
              try {
                await apiFetch('/tasks/run-depreciation', { method: 'POST' });
                setDeprMsg(isAr ? 'اكتمل تشغيل الاستهلاك ✓' : 'Depreciation run complete ✓');
                reload();
              } catch (e: unknown) { setDeprMsg(e instanceof Error ? e.message : 'Error'); }
              finally { setRunningDepr(false); }
            }}
          >
            {runningDepr ? (isAr ? 'جاري التشغيل…' : 'Running…') : (isAr ? '⟳ تشغيل الاستهلاك' : '⟳ Run Depreciation')}
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            {isAr ? '+ أصل جديد' : '+ Register New Asset'}
          </button>
        </div>
      </div>

      <div className="page-body space-y-5">
        {/* KPI stat cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'إجمالي قيمة الأصول' : 'Total Asset Value'}</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
              {egp(totalValue)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{isAr ? '+ التكلفة الأصلية' : '+ Original Cost'}</p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'القيمة الدفترية الصافية' : 'Net Book Value'}</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {egp(totalNBV)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{isAr ? 'بعد الاستهلاك' : 'After depreciation'}</p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'استهلاك هذا الشهر' : 'This Month Depreciation'}</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--warning-fg)' }}>
              {egp(thisMonthDepr)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{isAr ? 'يُرحَّل تلقائيًا شهريًا' : 'Auto-posted monthly'}</p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'الأصول النشطة' : 'Assets Running'}</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--success-fg)' }}>
              {activeCount}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {assets.filter((a) => a.status === 'FULLY_DEPRECIATED').length} {isAr ? 'مستهلك كليًا' : 'fully deprecated'}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder={isAr ? 'بحث…' : 'Search assets…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ width: 180 }}>
            <SearchableCombobox
              options={CATEGORIES}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder={isAr ? 'كل الفئات' : 'All Categories'}
            />
          </div>
          <div style={{ width: 180 }}>
            <SearchableCombobox
              options={STATUS_OPTS}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder={isAr ? 'كل الحالات' : 'All Statuses'}
            />
          </div>
        </div>

        {/* Assets table */}
        <div className="card overflow-hidden">
          {loading && (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>
          )}
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'رقم الأصل' : 'Asset #'}</th>
                <th>{isAr ? 'اسم الأصل' : 'Asset Name'}</th>
                <th>{isAr ? 'الفئة' : 'Category'}</th>
                <th>{isAr ? 'تاريخ الشراء' : 'Purchase Date'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'التكلفة (ج.م)' : 'Cost (EGP)'}</th>
                <th>{isAr ? 'العمر الإنتاجي' : 'Useful Life'}</th>
                <th>{isAr ? 'الطريقة' : 'Method'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'الاستهلاك المتراكم' : 'Accum. Depr'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'القيمة الدفترية' : 'Net Book Value'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <>
                  <tr
                    key={a.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  >
                    <td>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                        {a.code || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium" style={{ color: 'var(--text-1)' }}>{a.name}</span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{a.category}</td>
                    <td style={{ color: 'var(--text-2)' }}>{fmtDate(a.purchaseDate, isAr)}</td>
                    <td style={{ textAlign: 'right' }} className="tabular-nums font-medium">
                      {egp(Number(a.cost))}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {a.usefulLife} {isAr ? 'س' : 'yr'} / {a.usefulLife * 12} {isAr ? 'ش' : 'mo'}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{methodLabel(a.method)}</td>
                    <td
                      style={{ textAlign: 'right', color: 'var(--warning-fg)' }}
                      className="tabular-nums"
                    >
                      {egp(Number(a.accumDepreciation ?? 0))}
                    </td>
                    <td
                      style={{ textAlign: 'right', color: 'var(--primary)' }}
                      className="tabular-nums font-medium"
                    >
                      {egp(Number(a.netBookValue ?? 0))}
                    </td>
                    <td>{statusBadge(a.status)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/finance/assets/${a.id}`); }}
                      >
                        {isAr ? 'عرض الجدول' : 'View Schedule'}
                      </button>
                    </td>
                  </tr>

                  {/* Inline depreciation schedule panel */}
                  {expandedId === a.id && (
                    <tr key={`${a.id}-detail`}>
                      <td colSpan={11} style={{ padding: 0, background: 'var(--surface-2)' }}>
                        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                          {loadingDetail ? (
                            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{isAr ? 'جاري التحميل…' : 'Loading schedule…'}</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-3">
                                <p
                                  className="section-label"
                                  style={{ marginBottom: 0 }}
                                >
                                  {isAr ? `جدول الاستهلاك — ${a.name}` : `Depreciation Schedule — ${a.name}`}
                                  {a.status === 'ACTIVE' && (
                                    <span
                                      className="badge badge-info"
                                      style={{ marginLeft: 8 }}
                                    >
                                      {isAr ? 'يُرحَّل تلقائيًا شهريًا' : 'Auto-posted Monthly'}
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="month"
                                    className="input"
                                    style={{ width: 160 }}
                                    value={postingMonth}
                                    onChange={(e) => setPostingMonth(e.target.value)}
                                  />
                                  <button
                                    className="btn btn-primary btn-sm"
                                    disabled={posting || !postingMonth}
                                    onClick={() => postDepreciation(a.id)}
                                  >
                                    {posting
                                      ? (isAr ? 'جاري الترحيل…' : 'Posting…')
                                      : `${isAr ? 'ترحيل الاستهلاك' : 'Post Depreciation'}${postingMonth ? ` ${isAr ? 'لـ' : 'for'} ${postingMonth}` : ''}`}
                                  </button>
                                </div>
                              </div>

                              {/* Progress bar */}
                              {totalMonths > 0 && (
                                <div className="mb-3">
                                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                                    <span>{postedCount} {isAr ? 'شهر من' : 'months of'} {totalMonths} {isAr ? 'مستهلك' : 'depreciated'}</span>
                                    <span>{progressPct}%</span>
                                  </div>
                                  <div
                                    style={{
                                      height: 6,
                                      background: 'var(--border)',
                                      borderRadius: 9999,
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${progressPct}%`,
                                        height: '100%',
                                        background: 'var(--primary)',
                                        borderRadius: 9999,
                                        transition: 'width 300ms',
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Asset detail row */}
                              <div
                                className="grid gap-4 mb-4 text-xs"
                                style={{ gridTemplateColumns: 'repeat(6, 1fr)', color: 'var(--text-2)' }}
                              >
                                {[
                                  [isAr ? 'التكلفة' : 'Cost', egp(Number(a.cost))],
                                  [isAr ? 'قيمة الخردة' : 'Salvage Value', egp(Number(a.salvageValue ?? 0))],
                                  [isAr ? 'العمر الإنتاجي' : 'Useful Life', `${a.usefulLife} ${isAr ? 'سنوات' : 'years'}`],
                                  [isAr ? 'الطريقة' : 'Method', methodLabel(a.method)],
                                  [isAr ? 'تاريخ الشراء' : 'Purchased', fmtDate(a.purchaseDate, isAr)],
                                  [isAr ? 'الحالة' : 'Status', a.status],
                                ].map(([label, val]) => (
                                  <div key={label as string}>
                                    <p style={{ color: 'var(--text-3)', marginBottom: 2 }}>{label}</p>
                                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>{val}</p>
                                  </div>
                                ))}
                              </div>

                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>{isAr ? 'الفترة' : 'Period'}</th>
                                    <th style={{ textAlign: 'right' }}>{isAr ? 'القيمة الافتتاحية' : 'Opening NBV'}</th>
                                    <th style={{ textAlign: 'right' }}>{isAr ? 'الاستهلاك' : 'Depreciation'}</th>
                                    <th style={{ textAlign: 'right' }}>{isAr ? 'القيمة الختامية' : 'Closing NBV'}</th>
                                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                                    <th>{isAr ? 'قيد اليومية' : 'Journal Entry'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {schedule.length === 0 && (
                                    <tr>
                                      <td
                                        colSpan={7}
                                        className="text-center text-xs"
                                        style={{ color: 'var(--text-3)', padding: '1rem' }}
                                      >
                                        {isAr ? 'لم يُنشأ جدول بعد.' : 'No schedule generated yet.'}
                                      </td>
                                    </tr>
                                  )}
                                  {schedule.map((line, i) => (
                                    <tr key={line.period}>
                                      <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                                        {i + 1}
                                      </td>
                                      <td className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>
                                        {line.period}
                                      </td>
                                      <td
                                        className="tabular-nums text-xs"
                                        style={{ textAlign: 'right', color: 'var(--text-2)' }}
                                      >
                                        {egp(Number(line.openingNBV))}
                                      </td>
                                      <td
                                        className="tabular-nums text-xs font-medium"
                                        style={{ textAlign: 'right', color: 'var(--warning-fg)' }}
                                      >
                                        {egp(Number(line.depreciation))}
                                      </td>
                                      <td
                                        className="tabular-nums text-xs"
                                        style={{ textAlign: 'right', color: 'var(--text-1)' }}
                                      >
                                        {egp(Number(line.closingNBV))}
                                      </td>
                                      <td>
                                        {line.posted ? (
                                          <span className="badge badge-success">{isAr ? 'مرحَّل' : 'Posted'}</span>
                                        ) : (
                                          <span className="badge badge-neutral">{isAr ? 'مجدول' : 'Scheduled'}</span>
                                        )}
                                      </td>
                                      <td className="text-xs" style={{ color: 'var(--text-3)' }}>
                                        {line.posted ? '—' : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {assets.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center text-sm"
                    style={{ color: 'var(--text-3)', padding: '2.5rem 1rem' }}
                  >
                    {isAr ? 'لا توجد أصول ثابتة.' : 'No fixed assets found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowCreate(false)}
          />
          <div
            className="card relative w-full shadow-2xl"
            style={{ maxWidth: 560, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div
              className="flex items-center justify-between"
              style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h2 className="page-title" style={{ fontSize: '1rem' }}>{isAr ? 'تسجيل أصل جديد' : 'Register New Asset'}</h2>
                <p className="page-subtitle">{isAr ? 'إضافة أصل لسجل الأصول الثابتة' : 'Add asset to the fixed assets register'}</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '1.25rem', lineHeight: 1 }}
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={createAsset}
              style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}
            >
              <div className="space-y-3">
                <div>
                  <label className="input-label">{isAr ? 'اسم الأصل *' : 'Asset Name *'}</label>
                  <input
                    required
                    className="input"
                    placeholder="e.g. Cairo Service Vehicle — Toyota Hilux"
                    value={form.name}
                    onChange={(e) => setF('name', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <SearchableCombobox
                      label={isAr ? 'الفئة *' : 'Category *'}
                      options={CATEGORY_OPTS}
                      value={form.category}
                      onChange={(v) => setF('category', v)}
                      placeholder={isAr ? 'اختر الفئة' : 'Select category'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'تاريخ الشراء *' : 'Purchase Date *'}</label>
                    <input
                      type="date"
                      required
                      className="input"
                      value={form.purchaseDate}
                      onChange={(e) => setF('purchaseDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">{isAr ? 'التكلفة (ج.م) *' : 'Cost (EGP) *'}</label>
                    <NumericInput
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="450,000"
                      value={form.cost}
                      onChange={(val) => setF('cost', val)}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'قيمة الخردة (ج.م)' : 'Salvage Value (EGP)'}</label>
                    <NumericInput
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="0"
                      value={form.salvageValue}
                      onChange={(val) => setF('salvageValue', val)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">{isAr ? 'العمر الإنتاجي (سنوات) *' : 'Useful Life (years) *'}</label>
                    <NumericInput
                      min="1"
                      max="50"
                      className="input"
                      placeholder="5"
                      value={form.usefulLife}
                      onChange={(val) => setF('usefulLife', val)}
                    />
                  </div>
                  <div>
                    <SearchableCombobox
                      label={isAr ? 'طريقة الاستهلاك' : 'Depreciation Method'}
                      options={METHODS}
                      value={form.method}
                      onChange={(v) => setF('method', v)}
                      placeholder={isAr ? 'اختر الطريقة' : 'Select method'}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">{isAr ? 'الوصف' : 'Description'}</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder={isAr ? 'ملاحظات اختيارية…' : 'Optional notes…'}
                    value={form.description}
                    onChange={(e) => setF('description', e.target.value)}
                  />
                </div>

                <div>
                  <SearchableCombobox
                    label={isAr ? 'حساب الأصل الثابت' : 'Fixed Asset Account'}
                    options={accountOpts}
                    value={form.assetAccountId}
                    onChange={(v) => setF('assetAccountId', v)}
                    placeholder={isAr ? 'اختر حساب الأستاذ…' : 'Select GL account…'}
                    clearable
                  />
                </div>

                {err && (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>{err}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowCreate(false)}
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={saving}
                  >
                    {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'تسجيل الأصل' : 'Register Asset')}
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
