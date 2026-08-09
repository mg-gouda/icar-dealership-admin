'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '../../../../lib/lang-context';

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

const fmt = (n: number | string) =>
  'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PartApplication {
  id: string;
  make: { id: string; name: string };
  model: { id: string; name: string };
  yearFrom: number;
  yearTo: number;
  section: string;
}

interface PartDetail {
  id: string;
  partNumber: string;
  oemNumber?: string;
  name: string;
  description?: string;
  isUniversal: boolean;
  unitOfMeasure: string;
  costPrice: number;
  salePrice: number;
  onHand: number;
  reorderLevel: number;
  status?: string;
  locationId?: string;
  location?: { id: string; name: string };
  supplierId?: string;
  supplier?: { id: string; name: string };
  categoryId?: string;
  category?: { id: string; name: string };
  applications?: PartApplication[];
}

export default function PartDetailPage() {
  const { isAr } = useLang();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: part, loading, error, reload } = useQuery<PartDetail>(`/parts/${id}`, [id]);

  // Edit form state — populated once part loads
  const [oemNumber, setOemNumber]       = useState('');
  const [name, setName]                 = useState('');
  const [description, setDescription]   = useState('');
  const [unitOfMeasure, setUom]         = useState('EA');
  const [isUniversal, setIsUniversal]   = useState(false);
  const [costPrice, setCostPrice]       = useState('');
  const [salePrice, setSalePrice]       = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [supplierId, setSupplierId]     = useState('');
  const [categoryId, setCategoryId]     = useState('');

  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr]       = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  // Stock adjust
  const [adjustQty, setAdjustQty]       = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustErr, setAdjustErr]       = useState('');
  const [adjustSuccess, setAdjustSuccess] = useState(false);

  // Fitment add
  const [fitMakeId, setFitMakeId]     = useState('');
  const [fitModelId, setFitModelId]   = useState('');
  const [fitYearFrom, setFitYearFrom] = useState('');
  const [fitYearTo, setFitYearTo]     = useState('');
  const [fitSection, setFitSection]   = useState('');
  const [fitSaving, setFitSaving]     = useState(false);
  const [fitErr, setFitErr]           = useState('');

  const { data: suppliersRaw }  = useQuery<any[]>('/partners?type=VENDOR&limit=100');
  const { data: categoriesRaw } = useQuery<any[]>('/part-catalog/categories');
  const { data: makesRaw }      = useQuery<any[]>('/part-catalog/makes');
  const { data: modelsRaw }     = useQuery<any[]>(
    fitMakeId ? `/part-catalog/makes/${fitMakeId}/models` : null, [fitMakeId],
  );

  // Populate form when part loads
  useEffect(() => {
    if (!part) return;
    setOemNumber(part.oemNumber ?? '');
    setName(part.name);
    setDescription(part.description ?? '');
    setUom(part.unitOfMeasure);
    setIsUniversal(part.isUniversal);
    setCostPrice(String(part.costPrice));
    setSalePrice(String(part.salePrice));
    setReorderLevel(String(part.reorderLevel));
    setSupplierId(part.supplierId ?? '');
    setCategoryId(part.categoryId ?? '');
  }, [part]);

  const supplierOpts = [
    { value: '', label: isAr ? 'بدون مورد' : 'No supplier' },
    ...(Array.isArray(suppliersRaw) ? suppliersRaw : []).map((s: any) => ({ value: s.id, label: s.name })),
  ];
  const categoryOpts = [
    { value: '', label: isAr ? 'بدون فئة' : 'No category' },
    ...(Array.isArray(categoriesRaw) ? categoriesRaw : []).map((c: any) => ({ value: c.id, label: c.name })),
  ];
  const makeOpts   = (Array.isArray(makesRaw)  ? makesRaw  : []).map((m: any) => ({ value: m.id, label: m.name }));
  const modelOpts  = (Array.isArray(modelsRaw) ? modelsRaw : []).map((m: any) => ({ value: m.id, label: m.name }));
  const sectionOpts = CAR_SECTIONS.map((s) => ({ value: s.value, label: isAr ? s.labelAr : s.labelEn }));

  const submitEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setEditErr(isAr ? 'الاسم مطلوب.' : 'Name is required.'); return; }
    setEditSaving(true); setEditErr(''); setEditSuccess(false);
    try {
      await apiFetch(`/parts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          ...(oemNumber && { oemNumber: oemNumber.trim() }),
          description,
          isUniversal,
          unitOfMeasure: unitOfMeasure || 'EA',
          costPrice:    Number(costPrice)    || 0,
          salePrice:    Number(salePrice)    || 0,
          reorderLevel: Number(reorderLevel) || 0,
          ...(supplierId ? { supplierId } : { supplierId: null }),
          ...(categoryId ? { categoryId } : { categoryId: null }),
        }),
      });
      setEditSuccess(true);
      reload();
      setTimeout(() => setEditSuccess(false), 3000);
    } catch (e: unknown) { setEditErr(e instanceof Error ? e.message : 'Error saving'); }
    finally { setEditSaving(false); }
  }, [id, name, oemNumber, description, isUniversal, unitOfMeasure, costPrice, salePrice, reorderLevel, supplierId, categoryId, reload, isAr]);

  const submitAdjust = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustQty || !adjustReason) { setAdjustErr(isAr ? 'الكمية والسبب مطلوبان.' : 'Quantity and reason are required.'); return; }
    setAdjustSaving(true); setAdjustErr(''); setAdjustSuccess(false);
    try {
      await apiFetch(`/parts/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ qty: Number(adjustQty), reason: adjustReason }),
      });
      setAdjustQty(''); setAdjustReason(''); setAdjustSuccess(true);
      reload();
      setTimeout(() => setAdjustSuccess(false), 3000);
    } catch (e: unknown) { setAdjustErr(e instanceof Error ? e.message : 'Adjustment failed'); }
    finally { setAdjustSaving(false); }
  }, [id, adjustQty, adjustReason, reload, isAr]);

  async function addFitment() {
    if (!fitMakeId || !fitModelId || !fitYearFrom || !fitYearTo || !fitSection) {
      setFitErr(isAr ? 'جميع الحقول مطلوبة.' : 'All fields required.');
      return;
    }
    setFitSaving(true); setFitErr('');
    try {
      await apiFetch(`/parts/${id}/applications`, {
        method: 'POST',
        body: JSON.stringify({
          makeId: fitMakeId, modelId: fitModelId,
          yearFrom: Number(fitYearFrom), yearTo: Number(fitYearTo),
          section: fitSection,
        }),
      });
      setFitMakeId(''); setFitModelId(''); setFitYearFrom(''); setFitYearTo(''); setFitSection('');
      reload();
    } catch (e: unknown) { setFitErr(e instanceof Error ? e.message : 'Failed to add fitment'); }
    finally { setFitSaving(false); }
  }

  async function removeFitment(appId: string) {
    await apiFetch(`/parts/${id}/applications/${appId}`, { method: 'DELETE' });
    reload();
  }

  if (loading) return (
    <div style={{ padding: '2rem', color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</div>
  );
  if (error || !part) return (
    <div style={{ padding: '2rem', color: 'var(--danger)', fontSize: '0.875rem' }}>{error ?? 'Part not found'}</div>
  );

  const isLow = part.onHand <= part.reorderLevel;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}
            title={isAr ? 'رجوع' : 'Back'}
          >
            ←
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{part.name}</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: '0.15rem 0 0 0', fontFamily: 'monospace' }}>
              {part.partNumber}
              {part.isUniversal && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>{isAr ? 'شامل' : 'Universal'}</span>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{isAr ? 'المخزون' : 'In Stock'}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isLow ? 'var(--warning)' : 'var(--text-1)' }}>
              {part.onHand}
              {isLow && <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--warning)', marginLeft: '0.4rem' }}>{isAr ? '⚠ منخفض' : '⚠ Low'}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{isAr ? 'سعر البيع' : 'Sale Price'}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)' }}>{fmt(part.salePrice)}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.5rem', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Edit Info ── */}
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 1rem 0' }}>
            {isAr ? 'تعديل المعلومات' : 'Edit Information'}
          </h2>
          <form onSubmit={submitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'رقم القطعة' : 'Part Number'}</label>
                <input className="input" value={part.partNumber} disabled style={{ opacity: 0.6 }} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'رقم OEM' : 'OEM Number'}</label>
                <input className="input" value={oemNumber} onChange={(e) => setOemNumber(e.target.value)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'الاسم *' : 'Name *'}</label>
                <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'وحدة القياس' : 'Unit of Measure'}</label>
                <input className="input" value={unitOfMeasure} onChange={(e) => setUom(e.target.value)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'مستوى إعادة الطلب' : 'Reorder Level'}</label>
                <NumericInput min="0" className="input" value={reorderLevel} onChange={setReorderLevel} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'تكلفة الوحدة' : 'Cost Price'}</label>
                <NumericInput min="0" step="0.01" className="input" value={costPrice} onChange={setCostPrice} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'سعر البيع' : 'Sale Price'}</label>
                <NumericInput min="0" step="0.01" className="input" value={salePrice} onChange={setSalePrice} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'الفئة' : 'Category'}</label>
                <SearchableCombobox options={categoryOpts} value={categoryId} onChange={setCategoryId} placeholder={isAr ? 'اختر الفئة…' : 'Select category…'} clearable clearLabel={isAr ? 'بدون فئة' : 'No category'} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'المورد' : 'Supplier'}</label>
                <SearchableCombobox options={supplierOpts} value={supplierId} onChange={setSupplierId} placeholder={isAr ? 'اختر المورد…' : 'Select supplier…'} clearable clearLabel={isAr ? 'بدون مورد' : 'No supplier'} />
              </div>
            </div>

            <div>
              <label className="input-label">{isAr ? 'الوصف' : 'Description'}</label>
              <textarea className="input" style={{ resize: 'vertical', minHeight: 60 }}
                value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={isUniversal} onChange={(e) => setIsUniversal(e.target.checked)} />
              <span style={{ fontWeight: 500 }}>{isAr ? 'قطعة شاملة' : 'Universal Part'}</span>
            </label>

            {editErr && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{editErr}</p>}
            {editSuccess && <p style={{ color: 'var(--success)', fontSize: '0.8rem', margin: 0 }}>{isAr ? 'تم الحفظ.' : 'Saved.'}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={editSaving}>
                {editSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
              </button>
            </div>
          </form>
        </section>

        {/* ── Stock ── */}
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 1rem 0' }}>
            {isAr ? 'تعديل المخزون' : 'Adjust Stock'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', margin: '0 0 1rem 0' }}>
            {isAr ? 'الكمية الحالية:' : 'Current quantity:'}{' '}
            <strong style={{ color: isLow ? 'var(--warning)' : 'var(--text-1)' }}>{part.onHand}</strong>
            {isLow && <span style={{ color: 'var(--warning)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({isAr ? 'أقل من مستوى إعادة الطلب' : 'below reorder level'})</span>}
          </p>
          <form onSubmit={submitAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'الكمية (+ للإضافة، − للخصم)' : 'Quantity (+ to add, − to remove)'}</label>
                <NumericInput step="1" className="input" placeholder="e.g. 5 or -2" value={adjustQty} onChange={setAdjustQty} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'السبب' : 'Reason'}</label>
                <input className="input"
                  placeholder={isAr ? 'مثال: استلام طلب، تالف، جرد…' : 'e.g. Received PO, damaged, cycle count…'}
                  value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              </div>
            </div>
            {adjustErr && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{adjustErr}</p>}
            {adjustSuccess && <p style={{ color: 'var(--success)', fontSize: '0.8rem', margin: 0 }}>{isAr ? 'تم تطبيق التعديل.' : 'Adjustment applied.'}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={adjustSaving}>
                {adjustSaving ? '…' : (isAr ? 'تطبيق التعديل' : 'Apply Adjustment')}
              </button>
            </div>
          </form>
        </section>

        {/* ── Fitment ── */}
        <section className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
            {isAr ? 'ملاءمة السيارات' : 'Vehicle Fitment'}
          </h2>

          {part.isUniversal ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', padding: '0.75rem', background: 'color-mix(in srgb, var(--primary) 8%, transparent)', borderRadius: 8, margin: 0 }}>
              {isAr ? 'هذه القطعة شاملة — تناسب جميع السيارات.' : 'This is a universal part — fits all vehicles.'}
            </p>
          ) : (
            <>
              {(part.applications ?? []).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {part.applications!.map((app) => {
                    const sec = CAR_SECTIONS.find((s) => s.value === app.section);
                    return (
                      <span key={app.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.25rem 0.6rem', borderRadius: 20,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        fontSize: '0.8rem', color: 'var(--text-1)',
                      }}>
                        {app.make.name} · {app.model.name} · {app.yearFrom}–{app.yearTo} · {sec ? (isAr ? sec.labelAr : sec.labelEn) : app.section}
                        <button
                          type="button"
                          onClick={() => removeFitment(app.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1, padding: '0 0 0 0.125rem', fontSize: '1rem' }}
                        >×</button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', margin: 0 }}>
                  {isAr ? 'لا توجد تطبيقات بعد.' : 'No fitment applications yet.'}
                </p>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.75rem 0', color: 'var(--text-1)' }}>
                  {isAr ? '+ إضافة تطبيق' : '+ Add Fitment'}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <div>
                    <label className="input-label">{isAr ? 'الماركة' : 'Make'}</label>
                    <SearchableCombobox
                      options={makeOpts} value={fitMakeId}
                      onChange={(v) => { setFitMakeId(v); setFitModelId(''); }}
                      placeholder={isAr ? 'الماركة…' : 'Make…'}
                    />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'الموديل' : 'Model'}</label>
                    <SearchableCombobox options={modelOpts} value={fitModelId} onChange={setFitModelId} placeholder={isAr ? 'الموديل…' : 'Model…'} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'من سنة' : 'Year From'}</label>
                    <input className="input" type="number" min="1980" max="2099" placeholder="2018"
                      value={fitYearFrom} onChange={(e) => setFitYearFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'إلى سنة' : 'Year To'}</label>
                    <input className="input" type="number" min="1980" max="2099" placeholder="2024"
                      value={fitYearTo} onChange={(e) => setFitYearTo(e.target.value)} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'قسم السيارة' : 'Car Section'}</label>
                    <SearchableCombobox options={sectionOpts} value={fitSection} onChange={setFitSection} placeholder={isAr ? 'القسم…' : 'Section…'} />
                  </div>
                  <div>
                    <button type="button" className="btn btn-outline btn-sm" disabled={fitSaving} onClick={addFitment} style={{ whiteSpace: 'nowrap' }}>
                      {fitSaving ? '…' : (isAr ? '+ إضافة' : '+ Add')}
                    </button>
                  </div>
                </div>
                {fitErr && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{fitErr}</p>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
