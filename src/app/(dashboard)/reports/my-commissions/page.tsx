'use client';

import { useState, useEffect } from 'react';
import SearchableCombobox from '@/components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import { API_BASE as API } from '@/lib/config';
const egp = (n: number) => 'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Commission {
  id: string;
  status: string;
  calculatedAmount: string;
  paidAmount: string | null;
  createdAt: string;
  deal: {
    id: string;
    status: string;
    salePrice: string;
    vehicle: { make: string; model: string; year: number } | null;
    location: { name: string } | null;
  } | null;
  commissionPlan: { name: string } | null;
}

interface Summary { status: string; count: number; total: number; }

const STATUS_COLORS: Record<string, string> = {
  ACCRUED:  'var(--warning-fg)',
  PAYABLE:  'var(--primary)',
  PAID:     'var(--success-fg)',
  REVERSED: 'var(--danger-fg)',
};

function authHeader(): Record<string, string> {
  const t = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function MyCommissionsPage() {
  const { isAr } = useLang();

  const STATUS_OPTS = [
    { value: '', label: isAr ? 'جميع الحالات' : 'All Statuses' },
    { value: 'ACCRUED', label: isAr ? 'مستحق' : 'Accrued' },
    { value: 'PAYABLE', label: isAr ? 'واجب الدفع' : 'Payable' },
    { value: 'PAID', label: isAr ? 'مدفوع' : 'Paid' },
    { value: 'REVERSED', label: isAr ? 'معكوس' : 'Reversed' },
  ];

  const [items, setItems] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const LIMIT = 25;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (statusFilter) qs.set('status', statusFilter);
      const [listRes, summaryRes] = await Promise.all([
        fetch(`${API}/finance/commissions?${qs}`, { headers: authHeader() }),
        fetch(`${API}/finance/commissions/summary`, { headers: authHeader() }),
      ]);
      if (listRes.ok) {
        const d = await listRes.json();
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
      }
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page, statusFilter]);

  const totalPages = Math.ceil(total / LIMIT);
  const summaryTotal = summary.reduce((s, r) => s + r.total, 0);
  const paidTotal = summary.find(r => r.status === 'PAID')?.total ?? 0;
  const payableTotal = summary.find(r => r.status === 'PAYABLE')?.total ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'عمولاتي' : 'My Commissions'}</h1>
          <p className="page-subtitle">{isAr ? 'أرباحك من العمولات عبر جميع الصفقات' : 'Your earned commissions across all deals'}</p>
        </div>
      </div>

      <div className="page-body space-y-5">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: isAr ? 'إجمالي المكتسب' : 'Total Earned', value: egp(summaryTotal), color: 'var(--text-1)' },
            { label: isAr ? 'مستحق الآن' : 'Payable Now',     value: egp(payableTotal), color: 'var(--primary)' },
            { label: isAr ? 'مدفوع' : 'Paid Out',              value: egp(paidTotal),    color: 'var(--success-fg)' },
          ].map(k => (
            <div key={k.label} className="card p-4">
              <p className="section-label mb-1">{k.label}</p>
              <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Status breakdown */}
        {summary.length > 0 && (
          <div className="card p-4">
            <p className="section-label mb-3">{isAr ? 'توزيع الحالات' : 'Status Breakdown'}</p>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {summary.map(r => (
                <div key={r.status} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[r.status] ?? 'var(--text-3)' }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{r.status}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-1)' }}>{egp(r.total)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>({r.count})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter + table */}
        <div className="card overflow-hidden">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ width: 180 }}>
              <SearchableCombobox
                label=""
                options={STATUS_OPTS}
                value={statusFilter}
                onChange={v => { setStatusFilter(v); setPage(1); }}
                placeholder={isAr ? 'تصفية حسب الحالة' : 'Filter by status'}
              />
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginLeft: 'auto' }}>
              {isAr ? `${total} سجل` : `${total} record${total !== 1 ? 's' : ''}`}
            </span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'الصفقة' : 'Deal'}</th>
                  <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                  <th>{isAr ? 'الفرع' : 'Location'}</th>
                  <th>{isAr ? 'الخطة' : 'Plan'}</th>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'المحسوبة' : 'Calculated'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'المدفوعة' : 'Paid'}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>{isAr ? 'لا توجد عمولات.' : 'No commissions found.'}</td></tr>
                ) : items.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs">{c.deal?.id?.slice(-8) ?? '—'}</td>
                    <td>{c.deal?.vehicle ? `${c.deal.vehicle.year} ${c.deal.vehicle.make} ${c.deal.vehicle.model}` : '—'}</td>
                    <td>{c.deal?.location?.name ?? '—'}</td>
                    <td>{c.commissionPlan?.name ?? '—'}</td>
                    <td>{fmtDate(c.createdAt, isAr)}</td>
                    <td>
                      <span className="badge" style={{ background: STATUS_COLORS[c.status] + '1a', color: STATUS_COLORS[c.status] ?? 'var(--text-2)' }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{egp(Number(c.calculatedAmount))}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success-fg)' }}>
                      {c.paidAmount ? egp(Number(c.paidAmount)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{isAr ? 'السابق ›' : '‹ Prev'}</button>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{isAr ? `صفحة ${page} / ${totalPages}` : `Page ${page} / ${totalPages}`}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{isAr ? '‹ التالي' : 'Next ›'}</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
