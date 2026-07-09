'use client';

import { useState, useCallback } from 'react';
import { useQuery, apiFetch } from '../../../lib/useApi';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';
import ScannerModal, { PART_FORMATS } from '../../../components/ScannerModal';
import { useLang } from '../../../lib/lang-context';

const fmt = (n: number) =>
  'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Part {
  id: string;
  partNumber: string;
  oemNumber?: string;
  name: string;
  category?: string;
  onHand: number;
  reorderLevel: number;
  costPrice: number;
  salePrice: number;
  status?: string;
  location?: { name: string };
}

const EMPTY_PART_FORM = {
  partNumber: '', oemNumber: '', name: '', description: '',
  category: '', unitOfMeasure: 'EA', costPrice: '', salePrice: '',
  reorderLevel: '5', locationId: '', supplierId: '',
};

export default function PartsPage() {
  const { isAr } = useLang();
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  /* Stock adjust modal */
  const [adjustPart, setAdjustPart] = useState<Part | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustErr, setAdjustErr] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  /* Add part modal */
  const [showAddPart, setShowAddPart] = useState(false);
  const [partForm, setPartForm] = useState({ ...EMPTY_PART_FORM });
  const [partErr, setPartErr] = useState('');
  const [partSaving, setPartSaving] = useState(false);
  const [scanTarget, setScanTarget] = useState<'addPart' | 'adjust' | null>(null);

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(locationFilter && { locationId: locationFilter }),
    ...(categoryFilter && { category: categoryFilter }),
    ...(lowStockOnly && { lowStock: 'true' }),
    ...(search && { q: search }),
  });

  const { data, loading, error, reload } = useQuery<{ data: Part[]; total: number }>(
    `/parts?${qs}`,
    [locationFilter, categoryFilter, lowStockOnly, search, page],
  );

  const { data: locationsRaw } = useQuery<any[]>('/locations');
  const { data: suppliersRaw } = useQuery<any[]>('/partners?type=SUPPLIER&limit=100');

  const parts = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const locationFilterOpts = [
    { value: '', label: 'All locations' },
    ...((Array.isArray(locationsRaw) ? locationsRaw : []).map((l: any) => ({ value: l.id, label: l.name }))),
  ];
  const locationSelectOpts = (Array.isArray(locationsRaw) ? locationsRaw : []).map((l: any) => ({ value: l.id, label: l.name }));
  const supplierOpts = [
    { value: '', label: 'No supplier' },
    ...((Array.isArray(suppliersRaw) ? suppliersRaw : []).map((s: any) => ({ value: s.id, label: s.name }))),
  ];

  /* Stock adjust submit */
  const submitAdjust = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustPart || !adjustQty) { setAdjustErr('Quantity required.'); return; }
    setAdjustSaving(true); setAdjustErr('');
    try {
      await apiFetch(`/parts/${adjustPart.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ qty: Number(adjustQty), reason: adjustReason }),
      });
      setAdjustPart(null);
      setAdjustQty('');
      setAdjustReason('');
      reload();
    } catch (e: unknown) {
      setAdjustErr(e instanceof Error ? e.message : 'Adjustment failed');
    } finally {
      setAdjustSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustPart, adjustQty, adjustReason, reload]);

  function setPF(k: string, v: string) {
    setPartForm((prev) => ({ ...prev, [k]: v }));
  }

  /* Add part submit */
  const submitAddPart = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partForm.partNumber || !partForm.name || !partForm.locationId) {
      setPartErr('Part number, name, and location are required.');
      return;
    }
    setPartSaving(true); setPartErr('');
    try {
      await apiFetch('/parts', {
        method: 'POST',
        body: JSON.stringify({
          partNumber: partForm.partNumber,
          ...(partForm.oemNumber && { oemNumber: partForm.oemNumber }),
          name: partForm.name,
          ...(partForm.description && { description: partForm.description }),
          ...(partForm.category && { category: partForm.category }),
          unitOfMeasure: partForm.unitOfMeasure || 'EA',
          costPrice: Number(partForm.costPrice) || 0,
          salePrice: Number(partForm.salePrice) || 0,
          reorderLevel: Number(partForm.reorderLevel) || 5,
          locationId: partForm.locationId,
          ...(partForm.supplierId && { supplierId: partForm.supplierId }),
        }),
      });
      setShowAddPart(false);
      setPartForm({ ...EMPTY_PART_FORM });
      reload();
    } catch (e: unknown) {
      setPartErr(e instanceof Error ? e.message : 'Error adding part');
    } finally {
      setPartSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partForm, reload]);

  return (
    <>
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'قطع الغيار والإكسسوارات' : 'Parts & Accessories'}</h1>
          <p className="page-subtitle">{total} {isAr ? 'قطعة' : 'parts'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setScanTarget('adjust')}
            title={isAr ? 'امسح الباركود للبحث عن قطعة وتعديل مخزونها' : 'Scan barcode to find and adjust a part'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <CameraIcon /> {isAr ? 'مسح للتعديل' : 'Scan to Adjust'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddPart(true)}>{isAr ? '+ إضافة قطعة' : '+ Add Part'}</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '0 1.5rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder={isAr ? 'بحث برقم القطعة أو الاسم…' : 'Search part # or name…'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div style={{ width: 170 }}>
          <SearchableCombobox
            options={locationFilterOpts}
            value={locationFilter}
            onChange={(v) => { setLocationFilter(v); setPage(1); }}
            placeholder="All locations"
            clearable
            clearLabel="All locations"
          />
        </div>
        <input
          className="input"
          style={{ maxWidth: 160 }}
          placeholder={isAr ? 'الفئة…' : 'Category…'}
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }}
            style={{ cursor: 'pointer' }}
          />
          {isAr ? 'مخزون منخفض فقط' : 'Low stock only'}
        </label>
      </div>

      {/* Table */}
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
                  <th style={{ textAlign: 'right' }}>{isAr ? 'المخزن' : 'On Hand'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'مستوى إعادة الطلب' : 'Reorder Level'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'تكلفة الوحدة' : 'Cost Price'}</th>
                  <th style={{ textAlign: 'right' }}>{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => {
                  const isLow = p.onHand <= p.reorderLevel;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        cursor: 'pointer',
                        background: isLow
                          ? 'color-mix(in srgb, var(--warning) 8%, transparent)'
                          : undefined,
                      }}
                      onClick={() => {
                        setAdjustPart(p);
                        setAdjustQty('');
                        setAdjustReason('');
                        setAdjustErr('');
                      }}
                    >
                      <td>
                        <span style={{ color: 'var(--primary)', fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {p.partNumber}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {p.oemNumber ?? '—'}
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{p.category ?? '—'}</td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: isLow ? 700 : 400,
                          color: isLow ? 'var(--warning)' : undefined,
                        }}
                      >
                        {p.onHand}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{p.reorderLevel}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmt(Number(p.costPrice))}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(Number(p.salePrice))}</td>
                      <td>
                        <span className={`badge ${(p.status ?? 'ACTIVE') === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
                          {p.status ?? 'ACTIVE'}
                        </span>
                        {isLow && (
                          <span className="badge badge-warning" style={{ marginLeft: '0.3rem' }}>{isAr ? 'منخفض' : 'Low'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {parts.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      {isAr ? 'لا توجد قطع غيار.' : 'No parts found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {isAr ? 'السابق →' : '← Prev'}
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  {isAr ? '← التالي' : 'Next →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stock Adjust Modal ──────────────────────────────────────── */}
      {adjustPart && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ padding: '1rem' }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setAdjustPart(null)}
          />
          <div
            className="relative card"
            style={{ maxWidth: 440, width: '100%', padding: '1.5rem', background: 'var(--surface)', zIndex: 10 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>{isAr ? 'تعديل المخزن' : 'Adjust Stock'}</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
                  {adjustPart.name}
                  <span style={{ marginLeft: '0.5rem' }}>·</span>
                  <span style={{ marginLeft: '0.5rem' }}>{isAr ? 'الحالي:' : 'Current:'} <strong>{adjustPart.onHand}</strong></span>
                </p>
              </div>
              <button
                onClick={() => setAdjustPart(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.2rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <form onSubmit={submitAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'الكمية (موجب للإضافة، سالب للخصم)' : 'Quantity (positive to add, negative to remove)'}</label>
                <input
                  type="number"
                  step="1"
                  className="input"
                  placeholder="e.g. 5 or -2"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">{isAr ? 'السبب' : 'Reason'}</label>
                <input
                  className="input"
                  placeholder={isAr ? 'مثال: استلام أمر شراء، تالف، جرد…' : 'e.g. Received PO, damaged, cycle count…'}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
              {adjustErr && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{adjustErr}</p>}
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1rem',
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustPart(null)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" disabled={adjustSaving}>
                  {adjustSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'تطبيق التعديل' : 'Apply Adjustment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Part Modal ──────────────────────────────────────────── */}
      {showAddPart && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
          style={{ padding: '2rem 1rem' }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowAddPart(false)}
          />
          <div
            className="relative card"
            style={{ maxWidth: 700, width: '100%', background: 'var(--surface)', zIndex: 10 }}
          >
            {/* Modal header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>{isAr ? 'إضافة قطعة جديدة' : 'Add New Part'}</h2>
              <button
                onClick={() => setShowAddPart(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.2rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={submitAddPart}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Part # + OEM # + Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'رقم القطعة *' : 'Part Number *'}</label>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <input
                        className="input"
                        value={partForm.partNumber}
                        onChange={(e) => setPF('partNumber', e.target.value)}
                        required
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        title="Scan barcode"
                        onClick={() => setScanTarget('addPart')}
                        style={{
                          flexShrink: 0, width: 36, height: 38, borderRadius: 8,
                          border: '1px solid var(--border)', background: 'var(--surface-2)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-2)',
                        }}
                      >
                        <CameraIcon />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'رقم OEM' : 'OEM Number'}</label>
                    <input
                      className="input"
                      value={partForm.oemNumber}
                      onChange={(e) => setPF('oemNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'الاسم *' : 'Name *'}</label>
                    <input
                      className="input"
                      placeholder={isAr ? 'اسم القطعة…' : 'Part name…'}
                      value={partForm.name}
                      onChange={(e) => setPF('name', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Category + UOM + Reorder Level */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'الفئة' : 'Category'}</label>
                    <input
                      className="input"
                      placeholder={isAr ? 'مثال: فلاتر، فرامل…' : 'e.g. Filters, Brakes…'}
                      value={partForm.category}
                      onChange={(e) => setPF('category', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'وحدة القياس' : 'Unit of Measure'}</label>
                    <input
                      className="input"
                      placeholder="EA"
                      value={partForm.unitOfMeasure}
                      onChange={(e) => setPF('unitOfMeasure', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'مستوى إعادة الطلب' : 'Reorder Level'}</label>
                    <input
                      type="number"
                      min="0"
                      className="input"
                      value={partForm.reorderLevel}
                      onChange={(e) => setPF('reorderLevel', e.target.value)}
                    />
                  </div>
                </div>

                {/* Cost Price + Sale Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'تكلفة الوحدة' : 'Cost Price'}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="0.00"
                      value={partForm.costPrice}
                      onChange={(e) => setPF('costPrice', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'سعر البيع' : 'Sale Price'}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="0.00"
                      value={partForm.salePrice}
                      onChange={(e) => setPF('salePrice', e.target.value)}
                    />
                  </div>
                </div>

                {/* Location + Supplier */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'الفرع *' : 'Location *'}</label>
                    <SearchableCombobox
                      options={locationSelectOpts}
                      value={partForm.locationId}
                      onChange={(v) => setPF('locationId', v)}
                      placeholder="Select location…"
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'المورد' : 'Supplier'}</label>
                    <SearchableCombobox
                      options={supplierOpts}
                      value={partForm.supplierId}
                      onChange={(v) => setPF('supplierId', v)}
                      placeholder="Select supplier…"
                      clearable
                      clearLabel="No supplier"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="input-label">{isAr ? 'الوصف' : 'Description'}</label>
                  <textarea
                    className="input"
                    style={{ resize: 'vertical', minHeight: '60px' }}
                    placeholder={isAr ? 'وصف القطعة أو ملاحظات…' : 'Part description or notes…'}
                    value={partForm.description}
                    onChange={(e) => setPF('description', e.target.value)}
                  />
                </div>

                {partErr && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{partErr}</p>}

                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'flex-end',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '1rem',
                  }}
                >
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddPart(false)}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={partSaving}>
                    {partSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إضافة القطعة' : 'Add Part')}
                  </button>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {/* Scanner — addPart: fills part number field; adjust: finds part and opens adjust modal */}
    {scanTarget && (
      <ScannerModal
        formats={PART_FORMATS}
        title={scanTarget === 'addPart' ? 'Scan Part Barcode' : 'Scan to Adjust Stock'}
        hint="Point camera at the barcode or QR code on the part or packaging"
        onScan={async (value) => {
          setScanTarget(null);
          if (scanTarget === 'addPart') {
            setPF('partNumber', value);
          } else {
            // Lookup part by scanned code, open adjust modal
            try {
              const part = await apiFetch<Part | null>(`/parts/by-scan?code=${encodeURIComponent(value)}`);
              if (part) {
                setAdjustPart(part);
                setAdjustQty('');
                setAdjustReason('');
              } else {
                alert(`No part found for code: ${value}\nEnter manually.`);
              }
            } catch {
              alert('Lookup failed — enter part number manually.');
            }
          }
        }}
        onClose={() => setScanTarget(null)}
      />
    )}
    </>
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
