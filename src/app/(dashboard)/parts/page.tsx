'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import NumericInput from '../../../components/ui/NumericInput';
import ScannerModal, { PART_FORMATS } from '../../../components/ScannerModal';
import { useLang } from '../../../lib/lang-context';

const fmt = (n: number | string) =>
  'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Types ──────────────────────────────────────────────────────────────────

interface PartApplication {
  id: string;
  make: { id: string; name: string };
  model: { id: string; name: string };
  yearFrom: number;
  yearTo: number;
  section: string;
}

interface Part {
  id: string;
  partNumber: string;
  oemNumber?: string;
  name: string;
  isUniversal: boolean;
  onHand: number;
  reorderLevel: number;
  costPrice: number;
  salePrice: number;
  status?: string;
  location?: { name: string };
  supplier?: { id: string; name: string };
  applications?: PartApplication[];
}

interface PartReturn {
  id: string;
  returnNumber: string;
  part: { id: string; partNumber: string; name: string };
  qty: number;
  reason: string;
  refundMethod: string;
  status: string;
  inventoryStatus?: string;
  customerName?: string;
  customerPhone?: string;
  saleRef?: string;
  originalAmount: number;
  notes?: string;
  approvedBy?: { name: string };
  approvedAt?: string;
  rejectionReason?: string;
  location?: { name: string };
  createdAt: string;
}

interface RMALine {
  id: string;
  partReturn?: { returnNumber: string };
  part: { partNumber: string; name: string };
  qty: number;
  unitCost: number;
}

interface ManufacturerRMA {
  id: string;
  rmaNumber: string;
  supplier: { id: string; name: string };
  status: string;
  lines?: RMALine[];
  _count?: { lines: number };
  resolutionType?: string;
  resolutionAmount?: number;
  creditNoteRef?: string;
  notes?: string;
  submittedAt?: string;
  sentAt?: string;
  resolvedAt?: string;
  createdAt: string;
}

interface SupplierCredit {
  id: string;
  creditNoteNumber: string;
  supplier: { id: string; name: string };
  rma: { rmaNumber: string };
  totalAmount: number;
  usedAmount: number;
  expiryDate?: string;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const RETURN_REASONS = [
  { value: 'WARRANTY',           labelEn: 'Warranty Claim',         labelAr: 'مطالبة ضمان' },
  { value: 'DEFECTIVE',          labelEn: 'Defective Part',         labelAr: 'قطعة معيبة' },
  { value: 'WRONG_PART',         labelEn: 'Wrong Part Supplied',    labelAr: 'قطعة خاطئة' },
  { value: 'CHANGE_OF_MIND',     labelEn: 'Customer Changed Mind',  labelAr: 'تغيير رأي العميل' },
  { value: 'DAMAGED_IN_TRANSIT', labelEn: 'Damaged in Transit',     labelAr: 'تلف أثناء الشحن' },
  { value: 'OTHER',              labelEn: 'Other',                  labelAr: 'أخرى' },
];

const REFUND_METHODS = [
  { value: 'CASH',         labelEn: 'Cash Refund',          labelAr: 'استرداد نقدي' },
  { value: 'REPLACEMENT',  labelEn: 'Replacement Part',     labelAr: 'قطعة بديلة' },
  { value: 'CC_REFUND',    labelEn: 'Credit Card Refund',   labelAr: 'استرداد بطاقة ائتمان' },
  { value: 'CREDIT_NOTE',  labelEn: 'Store Credit Note',    labelAr: 'رصيد في المتجر' },
];

const RETURN_STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: 'badge-warning',
  APPROVED:         'badge-info',
  REJECTED:         'badge-danger',
  COMPLETED:        'badge-success',
};

const RETURN_STATUS_LABEL: Record<string, [string, string]> = {
  PENDING_APPROVAL: ['Pending Approval', 'بانتظار الموافقة'],
  APPROVED:         ['Approved', 'موافق عليه'],
  REJECTED:         ['Rejected', 'مرفوض'],
  COMPLETED:        ['Completed', 'مكتمل'],
};

const REASON_LABEL: Record<string, [string, string]> = {
  WARRANTY:           ['Warranty', 'ضمان'],
  DEFECTIVE:          ['Defective', 'معيب'],
  WRONG_PART:         ['Wrong Part', 'قطعة خاطئة'],
  CHANGE_OF_MIND:     ['Changed Mind', 'تغيير رأي'],
  DAMAGED_IN_TRANSIT: ['Transit Damage', 'تلف شحن'],
  OTHER:              ['Other', 'أخرى'],
};

const REFUND_LABEL: Record<string, [string, string]> = {
  CASH:        ['Cash', 'نقدي'],
  REPLACEMENT: ['Replacement', 'إستبدال'],
  CC_REFUND:   ['CC Refund', 'استرداد بطاقة'],
  CREDIT_NOTE: ['Credit Note', 'إشعار دائن'],
};

const RMA_STATUS_BADGE: Record<string, string> = {
  DRAFT:           'badge-neutral',
  SUBMITTED:       'badge-info',
  SENT_WITH_ORDER: 'badge-warning',
  RESOLVED:        'badge-success',
};

const RMA_STATUS_LABEL: Record<string, [string, string]> = {
  DRAFT:           ['Draft', 'مسودة'],
  SUBMITTED:       ['Submitted', 'مُقدَّم'],
  SENT_WITH_ORDER: ['Sent with Order', 'أُرسل مع الطلب'],
  RESOLVED:        ['Resolved', 'تم الحل'],
};

const CAR_SECTIONS = [
  { value: 'ENGINE',       labelEn: 'Engine',       labelAr: 'المحرك' },
  { value: 'BRAKES',       labelEn: 'Brakes',       labelAr: 'الفرامل' },
  { value: 'SUSPENSION',   labelEn: 'Suspension',   labelAr: 'التعليق' },
  { value: 'TRANSMISSION', labelEn: 'Transmission', labelAr: 'ناقل الحركة' },
  { value: 'AC',           labelEn: 'A/C',          labelAr: 'تكييف' },
  { value: 'ELECTRICAL',   labelEn: 'Electrical',   labelAr: 'كهرباء' },
  { value: 'STEERING',     labelEn: 'Steering',     labelAr: 'توجيه' },
  { value: 'FUEL_SYSTEM',  labelEn: 'Fuel System',  labelAr: 'وقود' },
  { value: 'EXHAUST',      labelEn: 'Exhaust',      labelAr: 'عادم' },
  { value: 'COOLING',      labelEn: 'Cooling',      labelAr: 'تبريد' },
  { value: 'FILTERS',      labelEn: 'Filters',      labelAr: 'فلاتر' },
  { value: 'LIGHTING',     labelEn: 'Lighting',     labelAr: 'إضاءة' },
  { value: 'INTERIOR',     labelEn: 'Interior',     labelAr: 'داخلية' },
  { value: 'BODY',         labelEn: 'Body',         labelAr: 'هيكل' },
];


// ── Main Component ─────────────────────────────────────────────────────────

export default function PartsPage() {
  const { isAr } = useLang();
  const [tab, setTab] = useState<'inventory' | 'returns' | 'rmas' | 'credits'>('inventory');

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'قطع الغيار والإكسسوارات' : 'Parts & Accessories'}</h1>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '0 1.5rem', display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
        {([
          ['inventory', isAr ? 'المخزون' : 'Inventory'],
          ['returns',   isAr ? 'المرتجعات' : 'Returns'],
          ['rmas',      isAr ? 'إرجاع للموردين' : 'Manufacturer RMAs'],
          ['credits',   isAr ? 'أرصدة الموردين' : 'Supplier Credits'],
        ] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            style={{
              padding: '0.625rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: tab === key ? 600 : 400,
              color: tab === key ? 'var(--primary)' : 'var(--text-2)',
              background: 'none',
              border: 'none',
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && <InventoryTab isAr={isAr} />}
      {tab === 'returns'   && <ReturnsTab   isAr={isAr} />}
      {tab === 'rmas'      && <RMAsTab       isAr={isAr} />}
      {tab === 'credits'   && <CreditsTab    isAr={isAr} />}
    </>
  );
}

const DELETE_ROLES = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'];

function useUserRole(): string {
  const cookie = typeof document !== 'undefined'
    ? document.cookie.split('; ').find((c) => c.startsWith('admin_role='))
    : undefined;
  return cookie ? cookie.split('=')[1] : '';
}

// ── Inventory Tab (existing) ───────────────────────────────────────────────

function InventoryTab({ isAr }: { isAr: boolean }) {
  const router = useRouter();
  const userRole = useUserRole();
  const canDelete = DELETE_ROLES.includes(userRole);

  const [locationFilter, setLocationFilter] = useState('');
  const [makeFilter, setMakeFilter]     = useState('');
  const [modelFilter, setModelFilter]   = useState('');
  const [yearFilter, setYearFilter]     = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const [scanTarget, setScanTarget] = useState<'adjust' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const qs = new URLSearchParams({
    page: String(page), limit: String(limit),
    ...(locationFilter && { locationId: locationFilter }),
    ...(makeFilter   && { makeId: makeFilter }),
    ...(modelFilter  && { modelId: modelFilter }),
    ...(yearFilter   && { year: yearFilter }),
    ...(sectionFilter && { section: sectionFilter }),
    ...(lowStockOnly && { lowStock: 'true' }),
    ...(search && { q: search }),
  });

  const { data, loading, error, reload } = useQuery<{ items: Part[]; total: number }>(
    `/parts?${qs}`,
    [locationFilter, makeFilter, modelFilter, yearFilter, sectionFilter, lowStockOnly, search, page],
  );

  const { data: locationsRaw }    = useQuery<any[]>('/locations');
  const { data: makesRaw }        = useQuery<any[]>('/part-catalog/makes');
  const { data: modelsRaw }       = useQuery<any[]>(makeFilter ? `/part-catalog/makes/${makeFilter}/models` : null, [makeFilter]);

  const parts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const locationFilterOpts = [
    { value: '', label: isAr ? 'كل الفروع' : 'All locations' },
    ...((Array.isArray(locationsRaw) ? locationsRaw : []).map((l: any) => ({ value: l.id, label: l.name }))),
  ];
  const makeOpts = [
    { value: '', label: isAr ? 'كل الماركات' : 'All makes' },
    ...((Array.isArray(makesRaw) ? makesRaw : []).map((m: any) => ({ value: m.id, label: m.name }))),
  ];
  const modelOpts = [
    { value: '', label: isAr ? 'كل الموديلات' : 'All models' },
    ...((Array.isArray(modelsRaw) ? modelsRaw : []).map((m: any) => ({ value: m.id, label: m.name }))),
  ];
  const sectionOpts = [
    { value: '', label: isAr ? 'كل الأقسام' : 'All sections' },
    ...CAR_SECTIONS.map((s) => ({ value: s.value, label: isAr ? s.labelAr : s.labelEn })),
  ];

  async function deletePart(id: string) {
    const confirmed = window.confirm(isAr ? 'هل أنت متأكد من حذف هذه القطعة؟ لا يمكن التراجع عن هذا الإجراء.' : 'Delete this part? This cannot be undone.');
    if (!confirmed) return;
    try {
      await apiFetch(`/parts/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed'); }
  }

  return (
    <div>
      <div style={{ padding: '1rem 1.5rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{total} {isAr ? 'قطعة' : 'parts'}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setScanTarget('adjust')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <CameraIcon /> {isAr ? 'مسح للتعديل' : 'Scan to Adjust'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/parts/new')}>
            {isAr ? '+ إضافة قطعة' : '+ Add Part'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '0 1.5rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 240 }}
          placeholder={isAr ? 'بحث برقم القطعة أو الاسم…' : 'Search part # or name…'}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <div style={{ width: 160 }}>
          <SearchableCombobox options={locationFilterOpts} value={locationFilter}
            onChange={(v) => { setLocationFilter(v); setPage(1); }}
            placeholder={isAr ? 'كل الفروع' : 'All locations'} clearable clearLabel={isAr ? 'كل الفروع' : 'All locations'} />
        </div>
        <div style={{ width: 140 }}>
          <SearchableCombobox options={makeOpts} value={makeFilter}
            onChange={(v) => { setMakeFilter(v); setModelFilter(''); setPage(1); }}
            placeholder={isAr ? 'الماركة' : 'Make'} clearable clearLabel={isAr ? 'كل الماركات' : 'All makes'} />
        </div>
        <div style={{ width: 140 }}>
          <SearchableCombobox options={modelOpts} value={modelFilter}
            onChange={(v) => { setModelFilter(v); setPage(1); }}
            placeholder={isAr ? 'الموديل' : 'Model'} clearable clearLabel={isAr ? 'كل الموديلات' : 'All models'} />
        </div>
        <input className="input" style={{ maxWidth: 80 }}
          placeholder={isAr ? 'السنة' : 'Year'} type="number" min="1980" max="2099"
          value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }} />
        <div style={{ width: 140 }}>
          <SearchableCombobox options={sectionOpts} value={sectionFilter}
            onChange={(v) => { setSectionFilter(v); setPage(1); }}
            placeholder={isAr ? 'القسم' : 'Section'} clearable clearLabel={isAr ? 'كل الأقسام' : 'All sections'} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={lowStockOnly}
            onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }} />
          {isAr ? 'مخزون منخفض فقط' : 'Low stock only'}
        </label>
      </div>

      <div className="page-body">
        {loading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}
        {!loading && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isAr ? 'رقم القطعة' : 'Part #'}</th>
                  <th>{isAr ? 'رقم OEM' : 'OEM #'}</th>
                  <th>{isAr ? 'الاسم' : 'Name'}</th>
                  <th>{isAr ? 'الفئة' : 'Category'}</th>
                  <th>{isAr ? 'الملاءمة' : 'Fitment'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'المخزن' : 'In Stock'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'مستوى إعادة الطلب' : 'Reorder'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'تكلفة الوحدة' : 'Cost'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th style={{ width: canDelete ? 120 : 72 }}></th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => {
                  const isLow = p.onHand <= p.reorderLevel;
                  const isDel = deleting === p.id;
                  return (
                    <tr key={p.id} style={{ background: isLow ? 'color-mix(in srgb, var(--warning) 8%, transparent)' : undefined }}>
                      <td><span style={{ color: 'var(--primary)', fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.partNumber}</span></td>
                      <td style={{ color: 'var(--text-3)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{p.oemNumber ?? '—'}</td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                        {(p as any).category?.name
                          ? <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '0.3rem', padding: '0.1rem 0.4rem', whiteSpace: 'nowrap' }}>
                              {(p as any).category.name}
                            </span>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {p.isUniversal
                          ? <span className="badge badge-info">{isAr ? 'شامل' : 'Universal'}</span>
                          : (p.applications?.length ?? 0) > 0
                            ? <span style={{ color: 'var(--text-2)' }}>{p.applications!.length} {isAr ? 'تطبيق' : 'app(s)'}</span>
                            : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: isLow ? 700 : 400, color: isLow ? 'var(--warning)' : undefined }}>{p.onHand}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{p.reorderLevel}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmt(p.costPrice)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(p.salePrice)}</td>
                      <td>
                        <span className={`badge ${(p.status ?? 'ACTIVE') === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>{p.status ?? 'ACTIVE'}</span>
                        {isLow && <span className="badge badge-warning" style={{ marginLeft: '0.3rem' }}>{isAr ? 'منخفض' : 'Low'}</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => router.push(`/parts/${p.id}`)}>
                            <EditIcon /> {isAr ? 'تعديل' : 'Edit'}
                          </button>
                          {canDelete && (
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={isDel}
                              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={async () => { setDeleting(p.id); await deletePart(p.id); setDeleting(null); }}>
                              <TrashIcon /> {isDel ? '…' : (isAr ? 'حذف' : 'Delete')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {parts.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                    {isAr ? 'لا توجد قطع غيار.' : 'No parts found.'}
                  </td></tr>
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{isAr ? 'السابق →' : '← Prev'}</button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{isAr ? '← التالي' : 'Next →'}</button>
              </div>
            )}
          </div>
        )}
      </div>

      {scanTarget && (
        <ScannerModal formats={PART_FORMATS}
          title="Scan to Adjust Stock"
          hint="Point camera at the barcode or QR code on the part or packaging"
          onScan={async (value) => {
            setScanTarget(null);
            try {
              const part = await apiFetch<Part | null>(`/parts/by-scan?code=${encodeURIComponent(value)}`);
              if (part) router.push(`/parts/${part.id}`);
              else alert(`No part found for code: ${value}\nEnter manually.`);
            } catch { alert('Lookup failed — enter part number manually.'); }
          }}
          onClose={() => setScanTarget(null)} />
      )}
    </div>
  );
}

// ── Returns Tab ────────────────────────────────────────────────────────────

function ReturnsTab({ isAr }: { isAr: boolean }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const [showNew, setShowNew] = useState(false);
  const [viewReturn, setViewReturn] = useState<PartReturn | null>(null);
  const [rejecting, setRejecting] = useState<PartReturn | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    partId: '', qty: '', reason: 'DEFECTIVE', refundMethod: 'CASH',
    customerName: '', customerPhone: '', saleRef: '', originalAmount: '', notes: '',
    locationId: '',
  });

  const qs = new URLSearchParams({
    page: String(page), limit: String(limit),
    ...(statusFilter && { status: statusFilter }),
    ...(search && { q: search }),
  });

  const { data, loading, error, reload } = useQuery<{ data: PartReturn[]; total: number }>(
    `/parts/returns?${qs}`, [statusFilter, search, page],
  );

  const { data: partsRaw } = useQuery<{ data: Part[] }>('/parts?limit=500');
  const { data: locationsRaw } = useQuery<any[]>('/locations');

  const returns = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const partOpts = (partsRaw?.data ?? []).map((p) => ({ value: p.id, label: `${p.partNumber} — ${p.name}` }));
  const locationOpts = (Array.isArray(locationsRaw) ? locationsRaw : []).map((l: any) => ({ value: l.id, label: l.name }));

  const STATUS_OPTS = [
    { value: '', label: isAr ? 'كل الحالات' : 'All Statuses' },
    { value: 'PENDING_APPROVAL', label: isAr ? 'بانتظار الموافقة' : 'Pending Approval' },
    { value: 'APPROVED',         label: isAr ? 'موافق عليه' : 'Approved' },
    { value: 'REJECTED',         label: isAr ? 'مرفوض' : 'Rejected' },
    { value: 'COMPLETED',        label: isAr ? 'مكتمل' : 'Completed' },
  ];

  function setF(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partId || !form.qty || !form.locationId) return;
    setSaving(true);
    try {
      await apiFetch('/parts/returns', {
        method: 'POST',
        body: JSON.stringify({
          partId: form.partId,
          qty: Number(form.qty),
          reason: form.reason,
          refundMethod: form.refundMethod,
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
          saleRef: form.saleRef || undefined,
          originalAmount: Number(form.originalAmount) || 0,
          notes: form.notes || undefined,
          locationId: form.locationId,
        }),
      });
      setShowNew(false);
      setForm({ partId: '', qty: '', reason: 'DEFECTIVE', refundMethod: 'CASH', customerName: '', customerPhone: '', saleRef: '', originalAmount: '', notes: '', locationId: '' });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function approveReturn(id: string) {
    setSaving(true);
    try { await apiFetch(`/parts/returns/${id}/approve`, { method: 'PATCH' }); setViewReturn(null); reload(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function submitReject() {
    if (!rejecting) return;
    setSaving(true);
    try {
      await apiFetch(`/parts/returns/${rejecting.id}/reject`, { method: 'PATCH', body: JSON.stringify({ rejectionReason: rejectReason }) });
      setRejecting(null); setRejectReason(''); setViewReturn(null); reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function completeReturn(id: string) {
    setSaving(true);
    try { await apiFetch(`/parts/returns/${id}/complete`, { method: 'PATCH' }); setViewReturn(null); reload(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="page-body">
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 220 }}
          placeholder={isAr ? 'بحث برقم المرتجع أو اسم القطعة…' : 'Search by return # or part…'}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <div style={{ width: 200 }}>
          <SearchableCombobox options={STATUS_OPTS} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            placeholder={isAr ? 'كل الحالات' : 'All Statuses'} clearable clearLabel={isAr ? 'كل الحالات' : 'All Statuses'} />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            {isAr ? '+ مرتجع جديد' : '+ New Return'}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: 'color-mix(in srgb, var(--info) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)', fontSize: '0.8rem', color: 'var(--text-2)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--info)', flexShrink: 0 }}>ℹ</span>
        {isAr
          ? 'القطع المعيبة تذهب إلى مخزن المرتجع بعد الموافقة وتُجمَّع لإرسالها إلى المورد عند الطلب التالي.'
          : 'Defective parts go to Quarantine after approval and are batched for manufacturer RMA with the next order delivery.'}
      </div>

      {loading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}

      {!loading && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'رقم المرتجع' : 'Return #'}</th>
                <th>{isAr ? 'القطعة' : 'Part'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'الكمية' : 'Qty'}</th>
                <th>{isAr ? 'السبب' : 'Reason'}</th>
                <th>{isAr ? 'طريقة الاسترداد' : 'Refund Method'}</th>
                <th>{isAr ? 'العميل' : 'Customer'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'المبلغ' : 'Amount'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'المخزون' : 'Inventory'}</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setViewReturn(r)}>
                  <td><span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 500 }}>{r.returnNumber}</span></td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.part.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{r.part.partNumber}</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{r.qty}</td>
                  <td>
                    <span className={`badge ${r.reason === 'DEFECTIVE' ? 'badge-danger' : r.reason === 'WARRANTY' ? 'badge-warning' : 'badge-neutral'}`}>
                      {isAr ? (REASON_LABEL[r.reason]?.[1] ?? r.reason) : (REASON_LABEL[r.reason]?.[0] ?? r.reason)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                    {isAr ? (REFUND_LABEL[r.refundMethod]?.[1] ?? r.refundMethod) : (REFUND_LABEL[r.refundMethod]?.[0] ?? r.refundMethod)}
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{r.customerName ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmt(r.originalAmount)}</td>
                  <td>
                    <span className={`badge ${RETURN_STATUS_BADGE[r.status] ?? 'badge-neutral'}`}>
                      {isAr ? (RETURN_STATUS_LABEL[r.status]?.[1] ?? r.status) : (RETURN_STATUS_LABEL[r.status]?.[0] ?? r.status)}
                    </span>
                  </td>
                  <td>
                    {r.inventoryStatus === 'QUARANTINE' && (
                      <span className="badge badge-danger">{isAr ? 'حجر صحي' : 'Quarantine'}</span>
                    )}
                    {r.inventoryStatus === 'IN_RMA' && (
                      <span className="badge badge-warning">{isAr ? 'في طلب إرجاع' : 'In RMA'}</span>
                    )}
                    {r.inventoryStatus === 'RETURNED_TO_STOCK' && (
                      <span className="badge badge-success">{isAr ? 'أُعيد للمخزن' : 'In Stock'}</span>
                    )}
                    {!r.inventoryStatus && <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>—</span>}
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                  {isAr ? 'لا توجد مرتجعات.' : 'No returns found.'}
                </td></tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{isAr ? 'السابق' : '← Prev'}</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{isAr ? 'التالي' : 'Next →'}</button>
            </div>
          )}
        </div>
      )}

      {/* New Return Modal */}
      {showNew && (
        <Modal onClose={() => setShowNew(false)} wide>
          <ModalHeader title={isAr ? 'تسجيل مرتجع قطعة' : 'Register Part Return'} onClose={() => setShowNew(false)} />
          <form onSubmit={submitReturn}>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">{isAr ? 'القطعة *' : 'Part *'}</label>
                  <SearchableCombobox options={partOpts} value={form.partId} onChange={(v) => setF('partId', v)} placeholder={isAr ? 'اختر القطعة…' : 'Select part…'} />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'الكمية *' : 'Quantity *'}</label>
                  <NumericInput min="1" step="1" className="input" placeholder="1" value={form.qty} onChange={(val) => setF('qty', val)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">{isAr ? 'سبب الإرجاع *' : 'Return Reason *'}</label>
                  <SearchableCombobox
                    options={RETURN_REASONS.map((r) => ({ value: r.value, label: isAr ? r.labelAr : r.labelEn }))}
                    value={form.reason} onChange={(v) => setF('reason', v)} placeholder="" />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'طريقة الاسترداد *' : 'Refund Method *'}</label>
                  <SearchableCombobox
                    options={REFUND_METHODS.map((r) => ({ value: r.value, label: isAr ? r.labelAr : r.labelEn }))}
                    value={form.refundMethod} onChange={(v) => setF('refundMethod', v)} placeholder="" />
                </div>
              </div>

              {/* Defective notice */}
              {form.reason === 'DEFECTIVE' && (
                <div style={{ padding: '0.625rem 0.875rem', borderRadius: 6, background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', fontSize: '0.8rem', color: 'var(--danger)' }}>
                  {isAr
                    ? 'ستذهب هذه القطعة إلى مخزن المرتجع بعد الموافقة، وستُضاف لدُفعة الإرجاع القادمة للمورد.'
                    : 'This part will be placed in Quarantine after approval and added to the next manufacturer RMA batch.'}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">{isAr ? 'اسم العميل' : 'Customer Name'}</label>
                  <input className="input" value={form.customerName} onChange={(e) => setF('customerName', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'رقم الهاتف' : 'Phone'}</label>
                  <input className="input" value={form.customerPhone} onChange={(e) => setF('customerPhone', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'رقم الفاتورة الأصلية' : 'Original Sale Ref'}</label>
                  <input className="input" placeholder="INV-..." value={form.saleRef} onChange={(e) => setF('saleRef', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">{isAr ? 'المبلغ الأصلي (ج.م)' : 'Original Amount (EGP)'}</label>
                  <NumericInput min="0" step="0.01" className="input" placeholder="0.00" value={form.originalAmount} onChange={(val) => setF('originalAmount', val)} />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'الفرع *' : 'Location *'}</label>
                  <SearchableCombobox options={locationOpts} value={form.locationId} onChange={(v) => setF('locationId', v)} placeholder={isAr ? 'اختر الفرع…' : 'Select location…'} />
                </div>
              </div>

              <div>
                <label className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <textarea className="input" style={{ resize: 'vertical', minHeight: '60px' }}
                  placeholder={isAr ? 'تفاصيل إضافية عن سبب الإرجاع…' : 'Additional details about the return reason…'}
                  value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
              </div>

              <div style={{ padding: '0.625rem 0.875rem', borderRadius: 6, background: 'color-mix(in srgb, var(--warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                {isAr
                  ? 'تتطلب المرتجعات موافقة مدير مركز الخدمة قبل إعادة القطعة للمخزون أو معالجة الاسترداد.'
                  : 'Returns require approval from the Service Center Manager before the part is returned to stock or refund is processed.'}
              </div>

              <ModalFooter onCancel={() => setShowNew(false)} saveLabel={isAr ? 'تسجيل المرتجع' : 'Register Return'} saving={saving} isAr={isAr} />
            </div>
          </form>
        </Modal>
      )}

      {/* View/Action Return Modal */}
      {viewReturn && (
        <Modal onClose={() => setViewReturn(null)}>
          <ModalHeader title={viewReturn.returnNumber} subtitle={viewReturn.part.name} onClose={() => setViewReturn(null)} />
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
              <InfoRow label={isAr ? 'الكمية' : 'Qty'} value={String(viewReturn.qty)} />
              <InfoRow label={isAr ? 'السبب' : 'Reason'} value={isAr ? (REASON_LABEL[viewReturn.reason]?.[1] ?? viewReturn.reason) : (REASON_LABEL[viewReturn.reason]?.[0] ?? viewReturn.reason)} />
              <InfoRow label={isAr ? 'طريقة الاسترداد' : 'Refund'} value={isAr ? (REFUND_LABEL[viewReturn.refundMethod]?.[1] ?? viewReturn.refundMethod) : (REFUND_LABEL[viewReturn.refundMethod]?.[0] ?? viewReturn.refundMethod)} />
              <InfoRow label={isAr ? 'المبلغ' : 'Amount'} value={fmt(viewReturn.originalAmount)} />
              {viewReturn.customerName && <InfoRow label={isAr ? 'العميل' : 'Customer'} value={viewReturn.customerName} />}
              {viewReturn.saleRef && <InfoRow label={isAr ? 'مرجع الفاتورة' : 'Sale Ref'} value={viewReturn.saleRef} />}
              {viewReturn.approvedBy && <InfoRow label={isAr ? 'اعتمد من' : 'Approved By'} value={viewReturn.approvedBy.name} />}
              {viewReturn.rejectionReason && <InfoRow label={isAr ? 'سبب الرفض' : 'Rejection Reason'} value={viewReturn.rejectionReason} />}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
              {viewReturn.status === 'PENDING_APPROVAL' && (
                <>
                  <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => approveReturn(viewReturn.id)}>
                    {isAr ? 'موافقة ✓' : 'Approve ✓'}
                  </button>
                  <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
                    onClick={() => { setRejecting(viewReturn); setRejectReason(''); }}>
                    {isAr ? 'رفض ✕' : 'Reject ✕'}
                  </button>
                </>
              )}
              {viewReturn.status === 'APPROVED' && (
                <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => completeReturn(viewReturn.id)}>
                  {isAr ? 'إتمام الاسترداد' : 'Mark Completed'}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setViewReturn(null)}>{isAr ? 'إغلاق' : 'Close'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Reason Modal */}
      {rejecting && (
        <Modal onClose={() => setRejecting(null)}>
          <ModalHeader title={isAr ? 'سبب الرفض' : 'Rejection Reason'} onClose={() => setRejecting(null)} />
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="input-label">{isAr ? 'سبب الرفض *' : 'Reason for rejection *'}</label>
              <textarea className="input" style={{ resize: 'vertical', minHeight: '80px' }}
                placeholder={isAr ? 'اكتب سبب الرفض…' : 'Enter rejection reason…'}
                value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus />
            </div>
            <ModalFooter onCancel={() => setRejecting(null)} saveLabel={isAr ? 'تأكيد الرفض' : 'Confirm Rejection'}
              saving={saving} isAr={isAr} onSave={submitReject} dangerous />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── RMAs Tab ───────────────────────────────────────────────────────────────

function RMAsTab({ isAr }: { isAr: boolean }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [showNew, setShowNew] = useState(false);
  const [viewRMA, setViewRMA] = useState<ManufacturerRMA | null>(null);
  const [showResolve, setShowResolve] = useState<ManufacturerRMA | null>(null);
  const [saving, setSaving] = useState(false);

  const [rmaForm, setRmaForm] = useState({ supplierId: '', locationId: '', notes: '', selectedReturnIds: [] as string[] });
  const [resolveForm, setResolveForm] = useState({ resolutionType: 'CREDIT_NOTE', resolutionAmount: '', creditNoteRef: '', notes: '', expiryDate: '' });

  const qs = new URLSearchParams({
    page: String(page), limit: String(limit),
    ...(statusFilter && { status: statusFilter }),
  });

  const { data, loading, error, reload } = useQuery<{ data: ManufacturerRMA[]; total: number }>(
    `/parts/rmas?${qs}`, [statusFilter, page],
  );

  const { data: suppliersRaw } = useQuery<any[]>('/partners?type=VENDOR&limit=100');
  const { data: locationsRaw } = useQuery<any[]>('/locations');
  // Quarantined returns available for RMA
  const { data: quarantineRaw } = useQuery<{ data: PartReturn[] }>('/parts/returns?status=APPROVED&inventoryStatus=QUARANTINE&limit=100');

  const rmas = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const supplierOpts = (Array.isArray(suppliersRaw) ? suppliersRaw : []).map((s: any) => ({ value: s.id, label: s.name }));
  const locationOpts = (Array.isArray(locationsRaw) ? locationsRaw : []).map((l: any) => ({ value: l.id, label: l.name }));
  const quarantinedReturns = quarantineRaw?.data ?? [];

  const STATUS_OPTS = [
    { value: '', label: isAr ? 'كل الحالات' : 'All Statuses' },
    { value: 'DRAFT',           label: isAr ? 'مسودة' : 'Draft' },
    { value: 'SUBMITTED',       label: isAr ? 'مُقدَّم' : 'Submitted' },
    { value: 'SENT_WITH_ORDER', label: isAr ? 'أُرسل مع الطلب' : 'Sent with Order' },
    { value: 'RESOLVED',        label: isAr ? 'تم الحل' : 'Resolved' },
  ];

  function setRF(k: string, v: string) { setRmaForm((p) => ({ ...p, [k]: v })); }
  function toggleReturn(id: string) {
    setRmaForm((p) => ({
      ...p,
      selectedReturnIds: p.selectedReturnIds.includes(id)
        ? p.selectedReturnIds.filter((x) => x !== id)
        : [...p.selectedReturnIds, id],
    }));
  }

  async function submitRMA(e: React.FormEvent) {
    e.preventDefault();
    if (!rmaForm.supplierId || !rmaForm.locationId || rmaForm.selectedReturnIds.length === 0) {
      alert(isAr ? 'اختر المورد والفرع وقطعة واحدة على الأقل.' : 'Select supplier, location, and at least one return.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/parts/rmas', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: rmaForm.supplierId,
          locationId: rmaForm.locationId,
          partReturnIds: rmaForm.selectedReturnIds,
          notes: rmaForm.notes || undefined,
        }),
      });
      setShowNew(false);
      setRmaForm({ supplierId: '', locationId: '', notes: '', selectedReturnIds: [] });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function advanceStatus(rma: ManufacturerRMA, newStatus: string) {
    const endpoint = newStatus === 'SUBMITTED' ? 'submit' : 'sent';
    setSaving(true);
    try { await apiFetch(`/parts/rmas/${rma.id}/${endpoint}`, { method: 'PATCH' }); setViewRMA(null); reload(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function resolveRMA(e: React.FormEvent) {
    e.preventDefault();
    if (!showResolve) return;
    setSaving(true);
    try {
      await apiFetch(`/parts/rmas/${showResolve.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          resolutionType: resolveForm.resolutionType,
          resolutionAmount: Number(resolveForm.resolutionAmount) || 0,
          creditNoteRef: resolveForm.creditNoteRef || undefined,
          notes: resolveForm.notes || undefined,
          expiryDate: resolveForm.expiryDate || undefined,
        }),
      });
      setShowResolve(null);
      setResolveForm({ resolutionType: 'CREDIT_NOTE', resolutionAmount: '', creditNoteRef: '', notes: '', expiryDate: '' });
      setViewRMA(null);
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="page-body">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ width: 200 }}>
          <SearchableCombobox options={STATUS_OPTS} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            placeholder={isAr ? 'كل الحالات' : 'All Statuses'} clearable clearLabel={isAr ? 'كل الحالات' : 'All Statuses'} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {quarantinedReturns.length > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
              {quarantinedReturns.length} {isAr ? 'قطعة في مخزن المرتجع' : 'parts in quarantine'}
            </span>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            {isAr ? '+ إنشاء طلب إرجاع' : '+ Create RMA'}
          </button>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}

      {!loading && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'رقم الإرجاع' : 'RMA #'}</th>
                <th>{isAr ? 'المورد' : 'Supplier'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'عدد القطع' : 'Lines'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'نوع الحل' : 'Resolution'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'المبلغ' : 'Amount'}</th>
                <th>{isAr ? 'تاريخ الإنشاء' : 'Created'}</th>
              </tr>
            </thead>
            <tbody>
              {rmas.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setViewRMA(r)}>
                  <td><span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 500 }}>{r.rmaNumber}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.supplier.name}</td>
                  <td style={{ textAlign: 'right' }}>{r._count?.lines ?? r.lines?.length ?? 0}</td>
                  <td>
                    <span className={`badge ${RMA_STATUS_BADGE[r.status] ?? 'badge-neutral'}`}>
                      {isAr ? (RMA_STATUS_LABEL[r.status]?.[1] ?? r.status) : (RMA_STATUS_LABEL[r.status]?.[0] ?? r.status)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                    {r.resolutionType === 'CASH_REFUND' ? (isAr ? 'استرداد نقدي' : 'Cash Refund')
                      : r.resolutionType === 'CREDIT_NOTE' ? (isAr ? 'إشعار دائن' : 'Credit Note')
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{r.resolutionAmount ? fmt(r.resolutionAmount) : '—'}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{new Date(r.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-EG')}</td>
                </tr>
              ))}
              {rmas.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                  {isAr ? 'لا توجد طلبات إرجاع.' : 'No RMAs found.'}
                </td></tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{isAr ? 'السابق' : '← Prev'}</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{isAr ? 'التالي' : 'Next →'}</button>
            </div>
          )}
        </div>
      )}

      {/* New RMA Modal */}
      {showNew && (
        <Modal onClose={() => setShowNew(false)} wide>
          <ModalHeader title={isAr ? 'إنشاء طلب إرجاع للمورد' : 'Create Manufacturer RMA'} onClose={() => setShowNew(false)} />
          <form onSubmit={submitRMA}>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">{isAr ? 'المورد *' : 'Supplier *'}</label>
                  <SearchableCombobox options={supplierOpts} value={rmaForm.supplierId} onChange={(v) => setRF('supplierId', v)} placeholder={isAr ? 'اختر المورد…' : 'Select supplier…'} />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'الفرع *' : 'Location *'}</label>
                  <SearchableCombobox options={locationOpts} value={rmaForm.locationId} onChange={(v) => setRF('locationId', v)} placeholder={isAr ? 'اختر الفرع…' : 'Select location…'} />
                </div>
              </div>

              {/* Quarantined parts selection */}
              <div>
                <label className="input-label" style={{ marginBottom: '0.5rem' }}>
                  {isAr ? 'القطع في مخزن المرتجع *' : 'Quarantined Parts to Include *'}
                </label>
                {quarantinedReturns.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem', border: '1px dashed var(--border)', borderRadius: 8 }}>
                    {isAr ? 'لا توجد قطع في مخزن المرتجع حالياً.' : 'No quarantined parts available.'}
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {quarantinedReturns.map((r, i) => (
                      <label key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem',
                        borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                        cursor: 'pointer', fontSize: '0.8125rem',
                        background: rmaForm.selectedReturnIds.includes(r.id) ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : undefined,
                      }}>
                        <input type="checkbox" checked={rmaForm.selectedReturnIds.includes(r.id)} onChange={() => toggleReturn(r.id)} />
                        <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.75rem' }}>{r.returnNumber}</span>
                        <span style={{ flex: 1 }}>{r.part.name}</span>
                        <span style={{ color: 'var(--text-3)' }}>×{r.qty}</span>
                        {r.customerName && <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{r.customerName}</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <textarea className="input" style={{ resize: 'vertical', minHeight: '60px' }}
                  placeholder={isAr ? 'تعليمات خاصة بالإرجاع…' : 'Special instructions for the return…'}
                  value={rmaForm.notes} onChange={(e) => setRF('notes', e.target.value)} />
              </div>

              <ModalFooter onCancel={() => setShowNew(false)} saveLabel={isAr ? 'إنشاء طلب الإرجاع' : 'Create RMA'} saving={saving} isAr={isAr} />
            </div>
          </form>
        </Modal>
      )}

      {/* View RMA Modal */}
      {viewRMA && (
        <Modal onClose={() => setViewRMA(null)}>
          <ModalHeader title={viewRMA.rmaNumber} subtitle={viewRMA.supplier.name} onClose={() => setViewRMA(null)} />
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
              <InfoRow label={isAr ? 'الحالة' : 'Status'} value={isAr ? (RMA_STATUS_LABEL[viewRMA.status]?.[1] ?? viewRMA.status) : (RMA_STATUS_LABEL[viewRMA.status]?.[0] ?? viewRMA.status)} />
              {viewRMA.resolutionType && (
                <InfoRow label={isAr ? 'نوع الحل' : 'Resolution'} value={viewRMA.resolutionType === 'CASH_REFUND' ? (isAr ? 'استرداد نقدي' : 'Cash Refund') : (isAr ? 'إشعار دائن' : 'Credit Note')} />
              )}
              {viewRMA.resolutionAmount && (
                <InfoRow label={isAr ? 'المبلغ' : 'Amount'} value={fmt(viewRMA.resolutionAmount)} />
              )}
              {viewRMA.creditNoteRef && (
                <InfoRow label={isAr ? 'رقم الإشعار' : 'Credit Note Ref'} value={viewRMA.creditNoteRef} />
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
              {viewRMA.status === 'DRAFT' && (
                <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => advanceStatus(viewRMA, 'SUBMITTED')}>
                  {isAr ? 'تقديم الطلب' : 'Submit RMA'}
                </button>
              )}
              {viewRMA.status === 'SUBMITTED' && (
                <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => advanceStatus(viewRMA, 'SENT_WITH_ORDER')}>
                  {isAr ? 'تأكيد الإرسال مع الطلب' : 'Mark Sent with Order'}
                </button>
              )}
              {viewRMA.status === 'SENT_WITH_ORDER' && (
                <button className="btn btn-primary btn-sm" onClick={() => { setShowResolve(viewRMA); setViewRMA(null); }}>
                  {isAr ? 'تسجيل الحل' : 'Record Resolution'}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setViewRMA(null)}>{isAr ? 'إغلاق' : 'Close'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Resolve RMA Modal */}
      {showResolve && (
        <Modal onClose={() => setShowResolve(null)}>
          <ModalHeader title={isAr ? 'تسجيل نتيجة طلب الإرجاع' : 'Record RMA Resolution'} subtitle={showResolve.rmaNumber} onClose={() => setShowResolve(null)} />
          <form onSubmit={resolveRMA}>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'نوع الحل *' : 'Resolution Type *'}</label>
                <SearchableCombobox
                  options={[
                    { value: 'CREDIT_NOTE', label: isAr ? 'إشعار دائن (رصيد للمشتريات المستقبلية)' : 'Credit Note (balance for future purchases)' },
                    { value: 'CASH_REFUND',  label: isAr ? 'استرداد نقدي مباشر' : 'Direct Cash Refund' },
                  ]}
                  value={resolveForm.resolutionType}
                  onChange={(v) => setResolveForm((p) => ({ ...p, resolutionType: v }))}
                  placeholder="" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">{isAr ? 'المبلغ (ج.م) *' : 'Amount (EGP) *'}</label>
                  <NumericInput min="0" step="0.01" className="input" placeholder="0.00"
                    value={resolveForm.resolutionAmount} onChange={(val) => setResolveForm((p) => ({ ...p, resolutionAmount: val }))} />
                </div>
                {resolveForm.resolutionType === 'CREDIT_NOTE' && (
                  <div>
                    <label className="input-label">{isAr ? 'رقم إشعار المورد' : 'Supplier Credit Note Ref'}</label>
                    <input className="input" placeholder="CN-..." value={resolveForm.creditNoteRef}
                      onChange={(e) => setResolveForm((p) => ({ ...p, creditNoteRef: e.target.value }))} />
                  </div>
                )}
              </div>
              {resolveForm.resolutionType === 'CREDIT_NOTE' && (
                <div>
                  <label className="input-label">{isAr ? 'تاريخ الانتهاء (اختياري)' : 'Expiry Date (optional)'}</label>
                  <input type="date" className="input" value={resolveForm.expiryDate}
                    onChange={(e) => setResolveForm((p) => ({ ...p, expiryDate: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <textarea className="input" style={{ resize: 'vertical', minHeight: '60px' }}
                  value={resolveForm.notes} onChange={(e) => setResolveForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <ModalFooter onCancel={() => setShowResolve(null)} saveLabel={isAr ? 'تسجيل الحل' : 'Record Resolution'} saving={saving} isAr={isAr} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Supplier Credits Tab ───────────────────────────────────────────────────

function CreditsTab({ isAr }: { isAr: boolean }) {
  const [supplierFilter, setSupplierFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [applyCredit, setApplyCredit] = useState<SupplierCredit | null>(null);
  const [applyForm, setApplyForm] = useState({ amountUsed: '', purchaseOrderRef: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const qs = new URLSearchParams({
    page: String(page), limit: String(limit),
    ...(supplierFilter && { supplierId: supplierFilter }),
  });

  const { data, loading, error, reload } = useQuery<{ data: SupplierCredit[]; total: number }>(
    `/parts/supplier-credits?${qs}`, [supplierFilter, page],
  );

  const { data: suppliersRaw } = useQuery<any[]>('/partners?type=VENDOR&limit=100');

  const credits = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const supplierOpts = [
    { value: '', label: isAr ? 'كل الموردين' : 'All Suppliers' },
    ...((Array.isArray(suppliersRaw) ? suppliersRaw : []).map((s: any) => ({ value: s.id, label: s.name }))),
  ];

  async function submitApply(e: React.FormEvent) {
    e.preventDefault();
    if (!applyCredit) return;
    const amt = Number(applyForm.amountUsed);
    const avail = Number(applyCredit.totalAmount) - Number(applyCredit.usedAmount);
    if (amt <= 0 || amt > avail) {
      alert(isAr ? `المبلغ يجب أن يكون بين 1 و ${fmt(avail)}` : `Amount must be between 1 and ${fmt(avail)}`);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/parts/supplier-credits/${applyCredit.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ amountUsed: amt, purchaseOrderRef: applyForm.purchaseOrderRef || undefined, notes: applyForm.notes || undefined }),
      });
      setApplyCredit(null);
      setApplyForm({ amountUsed: '', purchaseOrderRef: '', notes: '' });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  // Totals
  const totalAvailable = credits.reduce((sum, c) => sum + (Number(c.totalAmount) - Number(c.usedAmount)), 0);

  return (
    <div className="page-body">
      {/* Summary card */}
      {credits.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>{isAr ? 'إجمالي الرصيد المتاح' : 'Total Available Balance'}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{fmt(totalAvailable)}</div>
          </div>
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>{isAr ? 'عدد أرصدة الموردين' : 'Active Credit Notes'}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)' }}>{credits.filter((c) => Number(c.totalAmount) > Number(c.usedAmount)).length}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ width: 220 }}>
          <SearchableCombobox options={supplierOpts} value={supplierFilter} onChange={(v) => { setSupplierFilter(v); setPage(1); }}
            placeholder={isAr ? 'كل الموردين' : 'All Suppliers'} clearable clearLabel={isAr ? 'كل الموردين' : 'All Suppliers'} />
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}

      {!loading && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isAr ? 'رقم الإشعار' : 'Credit Note #'}</th>
                <th>{isAr ? 'المورد' : 'Supplier'}</th>
                <th>{isAr ? 'مرجع طلب الإرجاع' : 'RMA Ref'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'إجمالي الإشعار' : 'Total'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'المُستخدَم' : 'Used'}</th>
                <th style={{ textAlign: 'right' }}>{isAr ? 'الرصيد المتاح' : 'Available'}</th>
                <th>{isAr ? 'انتهاء الصلاحية' : 'Expiry'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => {
                const available = Number(c.totalAmount) - Number(c.usedAmount);
                const isExpired = c.expiryDate ? new Date(c.expiryDate) < new Date() : false;
                return (
                  <tr key={c.id}>
                    <td><span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 500 }}>{c.creditNoteNumber}</span></td>
                    <td style={{ fontWeight: 500 }}>{c.supplier.name}</td>
                    <td style={{ color: 'var(--text-3)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.rma.rmaNumber}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(c.totalAmount)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmt(c.usedAmount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: available > 0 ? 'var(--success)' : 'var(--text-3)' }}>{fmt(available)}</td>
                    <td>
                      {c.expiryDate
                        ? <span style={{ color: isExpired ? 'var(--danger)' : 'var(--text-2)', fontSize: '0.8rem' }}>
                            {new Date(c.expiryDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-EG')}
                            {isExpired && <span className="badge badge-danger" style={{ marginLeft: '0.4rem' }}>{isAr ? 'منتهي' : 'Expired'}</span>}
                          </span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td>
                      {available > 0 && !isExpired && (
                        <button className="btn btn-sm btn-outline" onClick={() => { setApplyCredit(c); setApplyForm({ amountUsed: '', purchaseOrderRef: '', notes: '' }); }}>
                          {isAr ? 'استخدام' : 'Apply'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {credits.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                  {isAr ? 'لا توجد أرصدة من الموردين.' : 'No supplier credit notes.'}
                </td></tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{isAr ? 'السابق' : '← Prev'}</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{isAr ? 'التالي' : 'Next →'}</button>
            </div>
          )}
        </div>
      )}

      {/* Apply Credit Modal */}
      {applyCredit && (
        <Modal onClose={() => setApplyCredit(null)}>
          <ModalHeader
            title={isAr ? 'استخدام رصيد المورد' : 'Apply Supplier Credit'}
            subtitle={`${applyCredit.creditNoteNumber} · ${applyCredit.supplier.name}`}
            onClose={() => setApplyCredit(null)} />
          <form onSubmit={submitApply}>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: 'color-mix(in srgb, var(--success) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)', fontSize: '0.8rem' }}>
                {isAr ? 'الرصيد المتاح: ' : 'Available balance: '}
                <strong>{fmt(Number(applyCredit.totalAmount) - Number(applyCredit.usedAmount))}</strong>
              </div>
              <div>
                <label className="input-label">{isAr ? 'المبلغ المُستخدَم (ج.م) *' : 'Amount to Apply (EGP) *'}</label>
                <NumericInput min="0.01" step="0.01" className="input" placeholder="0.00"
                  value={applyForm.amountUsed} onChange={(val) => setApplyForm((p) => ({ ...p, amountUsed: val }))} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'رقم أمر الشراء' : 'Purchase Order Ref'}</label>
                <input className="input" placeholder="PO-..." value={applyForm.purchaseOrderRef}
                  onChange={(e) => setApplyForm((p) => ({ ...p, purchaseOrderRef: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <textarea className="input" style={{ resize: 'vertical', minHeight: '60px' }}
                  value={applyForm.notes} onChange={(e) => setApplyForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <ModalFooter onCancel={() => setApplyCredit(null)} saveLabel={isAr ? 'تطبيق الرصيد' : 'Apply Credit'} saving={saving} isAr={isAr} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Shared UI Components ───────────────────────────────────────────────────

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ padding: '2rem 1rem' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative card shadow-2xl" style={{ maxWidth: wide ? 680 : 480, width: '100%', background: 'var(--surface)', zIndex: 10 }}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
      <div>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-1)' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>{subtitle}</p>}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem', lineHeight: 1, flexShrink: 0, marginLeft: '1rem' }}>×</button>
    </div>
  );
}

function ModalFooter({ onCancel, saveLabel, saving, isAr, onSave, dangerous }: {
  onCancel: () => void; saveLabel: string; saving: boolean; isAr: boolean; onSave?: () => void; dangerous?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</button>
      <button type={onSave ? 'button' : 'submit'} onClick={onSave}
        className="btn" disabled={saving}
        style={{ background: dangerous ? 'var(--danger)' : 'var(--primary)', color: '#fff', border: 'none' }}>
        {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : saveLabel}
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: '0.15rem' }}>{label}</div>
      <div style={{ fontWeight: 500, color: 'var(--text-1)' }}>{value}</div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 5.5A1 1 0 0 1 2.5 4.5h1l1-2h5l1 2h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="8" cy="9" r="2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}
