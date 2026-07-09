'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import { API_BASE as API } from '@/lib/config';
const token = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

interface Deal {
  id: string; dealNumber?: string;
  customer: { name: string };
  vehicle: { make: string; model: string; year: number };
  salesRep?: { name: string };
  salePrice: number; adminFee?: number; insuranceFee?: number;
  paymentMethod: string; purchaseMethod?: string;
  status: string; createdAt: string;
}

interface SalesRep { id: string; name: string; }

const STATUS_TABS = [
  { key: '',                label: 'All Deals' },
  { key: 'DRAFT',          label: 'Draft' },
  { key: 'PENDING_FINANCE',label: 'Pending Finance' },
  { key: 'APPROVED',       label: 'Approved' },
  { key: 'FINALIZED',      label: 'Finalized' },
  { key: 'CANCELLED',      label: 'Cancelled' },
];

function statusBadgeClass(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'badge-neutral', PENDING_FINANCE: 'badge-warning',
    APPROVED: 'badge-success', FINALIZED: 'badge-success',
    CANCELLED: 'badge-danger',
  };
  return map[s] ?? 'badge-neutral';
}

function methodBadgeClass(m: string): string {
  const map: Record<string, string> = {
    BANK_FINANCING: 'badge-info', CASH: 'badge-success',
    DEALERSHIP_INSTALLMENT: 'badge-purple',
  };
  return map[m] ?? 'badge-neutral';
}

function methodLabel(m: string): string {
  const map: Record<string, string> = {
    BANK_FINANCING: 'Bank Financing', CASH: 'Cash', DEALERSHIP_INSTALLMENT: 'Installment',
  };
  return map[m] ?? m.replace(/_/g, ' ');
}

const AVATAR_COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--purple)', 'var(--orange)', 'var(--danger)'];
function avatarColor(name: string) { const c = name.charCodeAt(0) + (name.charCodeAt(1) || 0); return AVATAR_COLORS[c % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

const KANBAN_STAGES = [
  { key: 'DRAFT',          label: 'Draft',          color: 'var(--text-3)' },
  { key: 'PENDING_FINANCE',label: 'Pending Finance', color: 'var(--warning)' },
  { key: 'APPROVED',       label: 'Approved',        color: 'var(--success)' },
  { key: 'FINALIZED',      label: 'Finalized',       color: 'var(--primary)' },
  { key: 'CANCELLED',      label: 'Cancelled',       color: 'var(--danger)' },
];

// Transitions allowed via Kanban drag — FINALIZED/CANCELLED need dedicated actions
const DRAG_ALLOWED: Record<string, string[]> = {
  DRAFT:           ['PENDING_FINANCE'],
  PENDING_FINANCE: ['DRAFT', 'APPROVED'],
  APPROVED:        ['PENDING_FINANCE'],
};

function DealCard({ deal, onDragStart, onDragEnd }: {
  deal: Deal;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  const router = useRouter();
  const { isAr } = useLang();
  const dragged = useRef(false);
  const custName = deal.customer?.name ?? '—';
  const m = deal.paymentMethod ?? deal.purchaseMethod ?? '';
  return (
    <div
      draggable="true"
      onDragStart={(e) => { dragged.current = true; onDragStart(e, deal.id); }}
      onDragEnd={() => { onDragEnd(); setTimeout(() => { dragged.current = false; }, 50); }}
      onClick={() => { if (dragged.current) return; router.push(`/deals/${deal.id}`); }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', cursor: 'grab', marginBottom: '0.5rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
        <span className="avatar" style={{ width: '1.5rem', height: '1.5rem', background: avatarColor(custName), color: '#fff', fontSize: '0.5625rem', flexShrink: 0 }}>
          {initials(custName)}
        </span>
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{custName}</span>
        {m && <span className={`badge ${deal.purchaseMethod === 'BANK_FINANCING' ? 'badge-info' : deal.purchaseMethod === 'CASH' ? 'badge-success' : 'badge-purple'}`} style={{ fontSize: '0.625rem' }}>
          {m === 'BANK_FINANCING' ? (isAr ? 'بنكي' : 'Bank') : m === 'CASH' ? (isAr ? 'كاش' : 'Cash') : (isAr ? 'تقسيط' : 'Install')}
        </span>}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', margin: '0 0 0.375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : '—'}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--primary)' }}>
          {fmt(Number(deal.salePrice ?? 0))}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>
          {fmtDate(deal.createdAt, isAr, { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  );
}

function KanbanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="3" height="9" rx="1" fill="currentColor"/>
      <rect x="5.5" y="1" width="3" height="6" rx="1" fill="currentColor"/>
      <rect x="10" y="1" width="3" height="11" rx="1" fill="currentColor"/>
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2" width="12" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor"/>
    </svg>
  );
}

export default function DealsPage() {
  const router = useRouter();
  const { isAr } = useLang();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeTab, setActiveTab] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '200' });
      // kanban always loads all statuses; list mode filters by active tab
      if (activeTab && viewMode === 'list') qs.set('status', activeTab);
      const res = await fetch(`${API}/deals?${qs}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setDeals(Array.isArray(json) ? json : (json.data ?? []));
    } catch { setDeals([]); }
    finally { setLoading(false); }
  }, [activeTab]);

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/deals?limit=500`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      const all: Deal[] = Array.isArray(json) ? json : (json.data ?? []);
      const c: Record<string, number> = {};
      all.forEach((d) => { c[d.status] = (c[d.status] ?? 0) + 1; });
      setCounts(c);
    } catch { /* non-critical */ }
  }, []);

  const loadReps = useCallback(async () => {
    if (salesReps.length > 0) return;
    try {
      const res = await fetch(`${API}/users?role=SALES_REP`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setSalesReps(Array.isArray(json) ? json : (json.data ?? []));
    } catch { /* non-critical */ }
  }, [salesReps.length]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { if (selectedIds.size > 0) loadReps(); }, [selectedIds.size, loadReps]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  const executeBulk = useCallback(async (action: string, value?: string) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    try {
      const res = await fetch(`${API}/deals/bulk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ids, action, ...(value !== undefined ? { value } : {}) }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(isAr ? `تم تحديث ${ids.length} سجل` : `Updated ${ids.length} record${ids.length > 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      load();
      loadCounts();
    } catch {
      showToast(isAr ? 'فشل الإجراء الجماعي' : 'Bulk action failed');
    }
  // ponytail: showToast is stable (no deps), load/loadCounts are callbacks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, load, loadCounts, isAr]);

  const allSelected = deals.length > 0 && deals.every((d) => selectedIds.has(d.id));
  const someSelected = !allSelected && deals.some((d) => selectedIds.has(d.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deals.map((d) => d.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    draggingId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnd = () => { draggingId.current = null; setDragOverStatus(null); };
  const handleDrop = async (targetStatus: string) => {
    const id = draggingId.current;
    setDragOverStatus(null);
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.status === targetStatus) return;
    const allowed = DRAG_ALLOWED[deal.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      showToast(targetStatus === 'FINALIZED' || targetStatus === 'CANCELLED'
        ? (isAr ? 'استخدم صفحة تفاصيل الصفقة لهذا الإجراء' : 'Use the Deal detail page for this action')
        : (isAr ? `لا يمكن الانتقال من ${deal.status.replace(/_/g,' ')} إلى ${targetStatus.replace(/_/g,' ')}` : `Cannot move from ${deal.status.replace(/_/g,' ')} to ${targetStatus.replace(/_/g,' ')}`));
      return;
    }
    setDeals((prev) => prev.map((d) => d.id === id ? { ...d, status: targetStatus } : d));
    try {
      const res = await fetch(`${API}/deals/${id}`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(isAr ? 'تم تحديث الحالة' : 'Status updated');
      loadCounts();
    } catch {
      showToast(isAr ? 'فشل تحديث الحالة' : 'Status update failed');
      load();
    }
  };

  const totalValue = deals.reduce((s, d) => s + Number(d.salePrice ?? 0), 0);

  function dealNumber(d: Deal): string {
    if (d.dealNumber) return `#${d.dealNumber}`;
    return `#${d.id.slice(-4).toUpperCase()}`;
  }

  const method = (d: Deal) => d.paymentMethod ?? d.purchaseMethod ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: viewMode === 'kanban' ? 'calc(100vh - 4rem)' : 'auto' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'خط صفقات المبيعات' : 'Deals Pipeline'}</h1>
          <p className="page-subtitle">
            {Object.values(counts).reduce((a, b) => a + b, 0)} {isAr ? 'صفقة' : 'deals'} · {fmt(totalValue)} {isAr ? 'إجمالي القيمة' : 'total value'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('list')} title={isAr ? 'عرض جدول' : 'Table view'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-2)', transition: 'background 150ms, color 150ms' }}>
              <ListIcon /> {isAr ? 'جدول' : 'Table'}
            </button>
            <button onClick={() => setViewMode('kanban')} title={isAr ? 'عرض كانبان' : 'Kanban view'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent', color: viewMode === 'kanban' ? '#fff' : 'var(--text-2)', transition: 'background 150ms, color 150ms' }}>
              <KanbanIcon /> {isAr ? 'كانبان' : 'Kanban'}
            </button>
          </div>
          <Link href="/deals/new" className="btn btn-primary">{isAr ? '+ صفقة جديدة' : '+ New Deal'}</Link>
        </div>
      </div>

      {/* Kanban board */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', flex: 1, padding: '0.75rem 1.5rem 1.5rem' }}>
          {KANBAN_STAGES.map((stage) => {
            const colDeals = deals.filter((d) => d.status === stage.key);
            const colValue = colDeals.reduce((s, d) => s + Number(d.salePrice ?? 0), 0);
            const isDragOver = dragOverStatus === stage.key;
            return (
              <div key={stage.key}
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(stage.key); }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={() => handleDrop(stage.key)}
                style={{ minWidth: '220px', flex: '1', display: 'flex', flexDirection: 'column', background: isDragOver ? 'color-mix(in srgb, var(--primary) 6%, var(--surface-2))' : 'var(--surface-2)', border: `2px solid ${isDragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden', transition: 'border-color 150ms, background 150ms' }}
              >
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{isAr ? ({ DRAFT: 'مسودة', PENDING_FINANCE: 'قيد المراجعة', APPROVED: 'موافق عليها', FINALIZED: 'مكتملة', CANCELLED: 'ملغاة' } as Record<string,string>)[stage.key] ?? stage.label : stage.label}</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.1rem 0.4rem', color: 'var(--text-2)' }}>{colDeals.length}</span>
                </div>
                {colDeals.length > 0 && (
                  <div style={{ padding: '0.375rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{fmt(colValue)}</span>
                  </div>
                )}
                <div style={{ padding: '0.625rem', flex: 1, overflowY: 'auto' }}>
                  {colDeals.length === 0 ? (
                    <div style={{ border: '1.5px dashed var(--border)', borderRadius: '6px', padding: '1.5rem 0.75rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.75rem', opacity: isDragOver ? 0.7 : 0.5 }}>
                      {isDragOver ? (isAr ? 'أفلت هنا' : 'Drop here') : (isAr ? 'لا صفقات' : 'No deals')}
                    </div>
                  ) : colDeals.map((deal) => (
                    <DealCard key={deal.id} deal={deal} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter tabs + Table (list mode only) */}
      {viewMode === 'list' && <>
      <div style={{ padding: '0 1.5rem' }}>
        <div className="tabs" style={{ marginTop: '1rem' }}>
          {STATUS_TABS.map((t) => {
            const count = t.key ? (counts[t.key] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
            return (
              <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => { setActiveTab(t.key); setSelectedIds(new Set()); }}>
                {isAr ? ({ '': 'كل الصفقات', DRAFT: 'مسودة', PENDING_FINANCE: 'قيد المراجعة', APPROVED: 'موافق عليها', FINALIZED: 'مكتملة', CANCELLED: 'ملغاة' } as Record<string,string>)[t.key] ?? t.label : t.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="page-body">
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '2.5rem', paddingLeft: '1rem' }}>
                    {/* ponytail: indeterminate must be set via DOM ref */}
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>{isAr ? 'رقم الصفقة' : 'Deal #'}</th>
                  <th>{isAr ? 'العميل' : 'Customer'}</th>
                  <th>{isAr ? 'السيارة' : 'Vehicle'}</th>
                  <th>{isAr ? 'مندوب المبيعات' : 'Sales Rep'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                  <th>{isAr ? 'طريقة الدفع' : 'Payment Method'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th>{isAr ? 'التاريخ' : 'Created'}</th>
                  <th>{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const custName = d.customer?.name ?? '—';
                  const m = method(d);
                  const isSelected = selectedIds.has(d.id);
                  return (
                    <tr
                      key={d.id}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : undefined,
                      }}
                      onClick={() => router.push(`/deals/${d.id}`)}
                    >
                      <td
                        style={{ paddingLeft: '1rem' }}
                        onClick={(e) => { e.stopPropagation(); toggleOne(d.id); }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(d.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{dealNumber(d)}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="avatar" style={{ width: '1.75rem', height: '1.75rem', background: avatarColor(custName), color: '#fff', fontSize: '0.625rem', flexShrink: 0 }}>
                            {initials(custName)}
                          </span>
                          <span style={{ fontWeight: 500 }}>{custName}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>
                        {d.vehicle ? `${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}` : '—'}
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{d.salesRep?.name ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                        {fmt(Number(d.salePrice ?? 0))}
                      </td>
                      <td>
                        {m ? <span className={`badge ${methodBadgeClass(m)}`}>{isAr ? ({ BANK_FINANCING: 'تمويل بنكي', CASH: 'كاش', DEALERSHIP_INSTALLMENT: 'تقسيط' } as Record<string,string>)[m] ?? m : methodLabel(m)}</span> : '—'}
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeClass(d.status)}`}>
                          {isAr ? ({ DRAFT: 'مسودة', PENDING_FINANCE: 'قيد المراجعة', APPROVED: 'موافق عليها', FINALIZED: 'مكتملة', CANCELLED: 'ملغاة' } as Record<string,string>)[d.status] ?? d.status : d.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {fmtDate(d.createdAt, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <Link
                          href={`/deals/${d.id}`}
                          style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '0.75rem', textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isAr ? 'عرض' : 'Open →'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {deals.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      {isAr ? `لا توجد صفقات${activeTab ? ` في "${activeTab.replace(/_/g, ' ')}"` : ''}` : `No deals found${activeTab ? ` in "${activeTab.replace(/_/g, ' ')}"` : ''}.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>}

      {/* Floating bulk action bar (list mode only) */}
      {selectedIds.size > 0 && viewMode === 'list' && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface-2)', border: '1px solid var(--border-2)',
          borderRadius: '8px', padding: '0.75rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          boxShadow: '0 4px 24px oklch(0 0 0 / 0.3)', zIndex: 100,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>
            {selectedIds.size} {isAr ? 'محدد' : 'selected'}
          </span>
          <div style={{ width: '1px', height: '1.25rem', background: 'var(--border)' }} />
          {/* Assign Rep */}
          <SearchableCombobox
            options={salesReps.map((r) => ({ value: r.id, label: r.name }))}
            value=""
            onChange={(v) => { if (v) executeBulk('ASSIGN_REP', v); }}
            placeholder={isAr ? 'تعيين مندوب…' : 'Assign Rep…'}
            className="w-44"
          />
          {/* Cancel */}
          <button
            className="btn btn-danger"
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => {
              if (window.confirm(isAr ? `إلغاء ${selectedIds.size} صفقة؟` : `Cancel ${selectedIds.size} deal${selectedIds.size > 1 ? 's' : ''}?`)) {
                executeBulk('CANCEL');
              }
            }}
          >
            {isAr ? 'إلغاء الصفقات' : 'Cancel Deals'}
          </button>
          {/* Clear */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1rem', lineHeight: 1, padding: '0.2rem 0.3rem' }}
            onClick={() => setSelectedIds(new Set())}
            title={isAr ? 'إلغاء التحديد' : 'Clear selection'}
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: selectedIds.size > 0 ? '5.5rem' : '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--success)', color: '#fff',
          borderRadius: '6px', padding: '0.5rem 1rem',
          fontSize: '0.875rem', fontWeight: 500,
          boxShadow: '0 2px 12px oklch(0 0 0 / 0.2)', zIndex: 101,
          transition: 'bottom 150ms',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
