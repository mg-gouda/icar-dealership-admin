'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
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
  usefulLife: number;
  method: string;
  status: string;
  accumDepreciation: number;
  netBookValue: number;
  description?: string;
  location?: { name: string };
  assetAccount?: { code: string; name: string };
  schedule?: DepScheduleLine[];
}

const egp = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAr } = useLang();

  const METHOD_LABELS: Record<string, string> = {
    STRAIGHT_LINE: isAr ? 'القسط الثابت' : 'Straight Line',
    DECLINING_BALANCE: isAr ? 'الرصيد المتناقص' : 'Declining Balance',
    SUM_OF_YEARS_DIGITS: isAr ? 'مجموع أرقام السنوات' : 'Sum of Years Digits',
  };

  const { data: asset, loading, error, reload } = useQuery<FixedAsset>(`/finance/assets/${id}`);
  const [postingMonth, setPostingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [posting, setPosting] = useState(false);

  async function postDepreciation() {
    if (!postingMonth) { alert(isAr ? 'اختر شهراً أولاً.' : 'Select a month first.'); return; }
    if (!confirm(isAr ? `ترحيل الإهلاك لشهر ${postingMonth}؟` : `Post depreciation for ${postingMonth}?`)) return;
    setPosting(true);
    try {
      await apiFetch(`/finance/assets/${id}/depreciate`, {
        method: 'POST',
        body: JSON.stringify({ month: postingMonth }),
      });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPosting(false); }
  }

  if (loading) {
    return (
      <div className="page-body">
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>{isAr ? 'جارٍ تحميل الأصل…' : 'Loading asset…'}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-body">
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }
  if (!asset) return null;

  const schedule = asset.schedule ?? [];
  const postedCount = schedule.filter((l) => l.posted).length;
  const totalMonths = asset.usefulLife * 12;
  const progressPct = totalMonths > 0 ? Math.min(100, Math.round((postedCount / totalMonths) * 100)) : 0;
  const methodLabel = METHOD_LABELS[asset.method] ?? asset.method.replace(/_/g, ' ');

  const detailFields = [
    [isAr ? 'اسم الأصل' : 'Asset Name', asset.name],
    [isAr ? 'الفئة' : 'Category', asset.category],
    [isAr ? 'تاريخ الشراء' : 'Purchase Date', fmtDate(asset.purchaseDate, isAr)],
    [isAr ? 'التكلفة الأصلية' : 'Original Cost', egp(Number(asset.cost))],
    [isAr ? 'قيمة الخردة' : 'Salvage Value', egp(Number(asset.salvageValue ?? 0))],
    [isAr ? 'العمر الإنتاجي' : 'Useful Life', `${asset.usefulLife} ${isAr ? 'سنوات' : 'years'} / ${totalMonths} ${isAr ? 'شهرًا' : 'months'}`],
    [isAr ? 'طريقة الاستهلاك' : 'Method', methodLabel],
    [isAr ? 'الفرع' : 'Location', asset.location?.name ?? '—'],
    [isAr ? 'حساب الأستاذ' : 'GL Account', asset.assetAccount ? `${asset.assetAccount.code} — ${asset.assetAccount.name}` : '—'],
  ] as [string, string][];

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: '0.5rem', paddingLeft: 0 }}
            onClick={() => router.push('/finance/assets')}
          >
            {isAr ? '← العودة للأصول' : '← Fixed Assets'}
          </button>
          <h1 className="page-title">{asset.name}</h1>
          <p className="page-subtitle">
            {asset.code && <span className="font-mono mr-2">{asset.code}</span>}
            {methodLabel} · {asset.usefulLife} {isAr ? 'سنة' : 'years'} · {asset.category}
            {asset.location && ` · ${asset.location.name}`}
          </p>
        </div>
        <div>
          {asset.status === 'ACTIVE' && <span className="badge badge-success">{isAr ? 'نشط' : 'Active'}</span>}
          {asset.status === 'DISPOSED' && <span className="badge badge-neutral">{isAr ? 'مُستبعد' : 'Disposed'}</span>}
          {asset.status === 'FULLY_DEPRECIATED' && <span className="badge badge-warning">{isAr ? 'مستهلك كليًا' : 'Fully Depreciated'}</span>}
        </div>
      </div>

      <div className="page-body space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'التكلفة الأصلية' : 'Original Cost'}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
              {egp(Number(asset.cost))}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {isAr ? `تاريخ الشراء ${fmtDate(asset.purchaseDate, isAr)}` : `Purchased ${fmtDate(asset.purchaseDate, isAr)}`}
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'الاستهلاك المتراكم' : 'Accum. Depreciation'}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--warning-fg)' }}>
              {egp(Number(asset.accumDepreciation ?? 0))}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {isAr ? `${postedCount} من ${totalMonths} شهرًا مرحَّلًا` : `${postedCount} of ${totalMonths} months posted`}
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'القيمة الدفترية الصافية' : 'Net Book Value'}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--primary)' }}>
              {egp(Number(asset.netBookValue ?? 0))}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {isAr ? `الخردة: ${egp(Number(asset.salvageValue ?? 0))}` : `Salvage: ${egp(Number(asset.salvageValue ?? 0))}`}
            </p>
          </div>
          <div className="card p-4">
            <p className="section-label mb-1">{isAr ? 'تقدم الاستهلاك' : 'Depreciation Progress'}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
              {progressPct}%
            </p>
            <div
              style={{
                marginTop: '0.5rem',
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
                  transition: 'width 400ms',
                }}
              />
            </div>
          </div>
        </div>

        {/* Asset details */}
        <div className="card p-5">
          <p className="section-label">{isAr ? 'تفاصيل الأصل' : 'Asset Details'}</p>
          <div className="grid gap-x-8 gap-y-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {detailFields.map(([label, val]) => (
              <div key={label as string}>
                <p className="input-label" style={{ marginBottom: 2 }}>{label}</p>
                <p className="text-sm" style={{ color: 'var(--text-1)' }}>{val}</p>
              </div>
            ))}
          </div>
          {asset.description && (
            <div className="mt-4">
              <p className="input-label" style={{ marginBottom: 2 }}>{isAr ? 'الوصف' : 'Description'}</p>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{asset.description}</p>
            </div>
          )}
        </div>

        {/* Depreciation schedule */}
        <div className="card overflow-hidden">
          <div
            className="flex items-center justify-between"
            style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <p className="page-title" style={{ fontSize: '0.9375rem' }}>{isAr ? 'جدول الاستهلاك' : 'Depreciation Schedule'}</p>
              <p className="page-subtitle">
                {isAr
                  ? `${postedCount} شهرًا مرحَّلًا من ${totalMonths} إجمالًا`
                  : `${postedCount} months posted of ${totalMonths} total`}
              </p>
            </div>
            {asset.status === 'ACTIVE' && (
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  className="input"
                  style={{ width: 165 }}
                  value={postingMonth}
                  onChange={(e) => setPostingMonth(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  disabled={posting || !postingMonth}
                  onClick={postDepreciation}
                >
                  {posting
                    ? (isAr ? 'جاري الترحيل…' : 'Posting…')
                    : `${isAr ? 'ترحيل الاستهلاك' : 'Post Depreciation'} ${isAr ? 'لـ' : 'for'} ${postingMonth || '…'}`}
                </button>
              </div>
            )}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{isAr ? 'الفترة' : 'Period'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'القيمة الافتتاحية' : 'Opening NBV'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'مبلغ الاستهلاك' : 'Depreciation'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'القيمة الدفترية' : 'Closing NBV'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'قيد اليومية' : 'Journal Entry'}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-sm"
                    style={{ color: 'var(--text-3)', padding: '2rem 1rem' }}
                  >
                    {isAr ? 'لم يُنشأ جدول الاستهلاك بعد.' : 'No depreciation schedule generated.'}
                  </td>
                </tr>
              )}
              {schedule.map((line, i) => (
                <tr key={line.period}>
                  <td className="text-xs" style={{ color: 'var(--text-3)' }}>{i + 1}</td>
                  <td className="font-medium text-xs">{line.period}</td>
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
                  <td className="text-xs" style={{ color: 'var(--text-3)' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
