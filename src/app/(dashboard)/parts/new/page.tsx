'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import ScannerModal, { PART_FORMATS } from '../../../../components/ScannerModal';
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

interface FitmentEntry {
  makeId: string; makeName: string;
  modelId: string; modelName: string;
  yearFrom: string; yearTo: string;
  section: string;
}

export default function NewPartPage() {
  const { isAr } = useLang();
  const router = useRouter();

  // Basic info
  const [partNumber, setPartNumber] = useState('');
  const [oemNumber, setOemNumber]   = useState('');
  const [name, setName]             = useState('');
  const [description, setDescription] = useState('');
  const [unitOfMeasure, setUom]     = useState('EA');
  const [isUniversal, setIsUniversal] = useState(false);
  const [costPrice, setCostPrice]   = useState('');
  const [salePrice, setSalePrice]   = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [locationId, setLocationId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [initialStock, setInitialStock] = useState('0');

  // Fitment pending list (added before save)
  const [fitments, setFitments] = useState<FitmentEntry[]>([]);
  const [fitMakeId, setFitMakeId]     = useState('');
  const [fitModelId, setFitModelId]   = useState('');
  const [fitYearFrom, setFitYearFrom] = useState('');
  const [fitYearTo, setFitYearTo]     = useState('');
  const [fitSection, setFitSection]   = useState('');
  const [fitErr, setFitErr]           = useState('');

  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const [showScan, setShowScan] = useState(false);

  const { data: locationsRaw }  = useQuery<any[]>('/locations');
  const { data: suppliersRaw }  = useQuery<any[]>('/partners?type=VENDOR&limit=100');
  const { data: categoriesRaw } = useQuery<any[]>('/part-catalog/categories');
  const { data: makesRaw }      = useQuery<any[]>('/part-catalog/makes');
  const { data: modelsRaw }     = useQuery<any[]>(
    fitMakeId ? `/part-catalog/makes/${fitMakeId}/models` : null, [fitMakeId],
  );

  const locationOpts   = (Array.isArray(locationsRaw)  ? locationsRaw  : []).map((l: any) => ({ value: l.id, label: l.name }));
  const supplierOpts   = [
    { value: '', label: isAr ? 'بدون مورد' : 'No supplier' },
    ...(Array.isArray(suppliersRaw)  ? suppliersRaw  : []).map((s: any) => ({ value: s.id, label: s.name })),
  ];
  const categoryOpts   = [
    { value: '', label: isAr ? 'بدون فئة' : 'No category' },
    ...(Array.isArray(categoriesRaw) ? categoriesRaw : []).map((c: any) => ({ value: c.id, label: c.name })),
  ];
  const makeOpts   = (Array.isArray(makesRaw)  ? makesRaw  : []).map((m: any) => ({ value: m.id, label: m.name }));
  const modelOpts  = (Array.isArray(modelsRaw) ? modelsRaw : []).map((m: any) => ({ value: m.id, label: m.name }));
  const sectionOpts = CAR_SECTIONS.map((s) => ({ value: s.value, label: isAr ? s.labelAr : s.labelEn }));

  function addFitment() {
    if (!fitMakeId || !fitModelId || !fitYearFrom || !fitYearTo || !fitSection) {
      setFitErr(isAr ? 'جميع حقول الملاءمة مطلوبة.' : 'All fitment fields are required.');
      return;
    }
    const make  = makeOpts.find((m) => m.value === fitMakeId);
    const model = modelOpts.find((m) => m.value === fitModelId);
    setFitments((prev) => [...prev, {
      makeId: fitMakeId, makeName: make?.label ?? '',
      modelId: fitModelId, modelName: model?.label ?? '',
      yearFrom: fitYearFrom, yearTo: fitYearTo, section: fitSection,
    }]);
    setFitMakeId(''); setFitModelId(''); setFitYearFrom(''); setFitYearTo(''); setFitSection('');
    setFitErr('');
  }

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partNumber.trim() || !name.trim() || !locationId) {
      setErr(isAr ? 'رقم القطعة والاسم والفرع مطلوبة.' : 'Part number, name, and location are required.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const part = await apiFetch<{ id: string }>('/parts', {
        method: 'POST',
        body: JSON.stringify({
          partNumber: partNumber.trim(),
          ...(oemNumber  && { oemNumber: oemNumber.trim() }),
          name: name.trim(),
          ...(description && { description }),
          isUniversal,
          unitOfMeasure: unitOfMeasure || 'EA',
          costPrice:    Number(costPrice)    || 0,
          salePrice:    Number(salePrice)    || 0,
          reorderLevel: Number(reorderLevel) || 5,
          onHand:       Number(initialStock) || 0,
          locationId,
          ...(supplierId  && { supplierId }),
          ...(categoryId  && { categoryId }),
        }),
      });

      // post fitment applications sequentially
      for (const f of fitments) {
        await apiFetch(`/parts/${part.id}/applications`, {
          method: 'POST',
          body: JSON.stringify({
            makeId: f.makeId, modelId: f.modelId,
            yearFrom: Number(f.yearFrom), yearTo: Number(f.yearTo),
            section: f.section,
          }),
        });
      }

      router.push(`/parts/${part.id}`);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error saving part'); }
    finally { setSaving(false); }
  }, [partNumber, oemNumber, name, description, isUniversal, unitOfMeasure, costPrice, salePrice, reorderLevel, initialStock, locationId, supplierId, categoryId, fitments, router, isAr]);

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
            <h1 className="page-title">{isAr ? 'إضافة قطعة جديدة' : 'Add New Part'}</h1>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div style={{ padding: '1.5rem', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Basic Info ── */}
          <section className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
              {isAr ? 'المعلومات الأساسية' : 'Basic Information'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'رقم القطعة *' : 'Part Number *'}</label>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <input
                    className="input" required style={{ flex: 1 }}
                    value={partNumber} onChange={(e) => setPartNumber(e.target.value)}
                  />
                  <button
                    type="button" title="Scan barcode" onClick={() => setShowScan(true)}
                    style={{ flexShrink: 0, width: 36, height: 38, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}
                  >
                    <CameraIcon />
                  </button>
                </div>
              </div>
              <div>
                <label className="input-label">{isAr ? 'رقم OEM' : 'OEM Number'}</label>
                <input className="input" value={oemNumber} onChange={(e) => setOemNumber(e.target.value)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'الاسم *' : 'Name *'}</label>
                <input
                  className="input" required
                  placeholder={isAr ? 'اسم القطعة…' : 'Part name…'}
                  value={name} onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'وحدة القياس' : 'Unit of Measure'}</label>
                <input className="input" placeholder="EA" value={unitOfMeasure} onChange={(e) => setUom(e.target.value)} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'مستوى إعادة الطلب' : 'Reorder Level'}</label>
                <NumericInput min="0" className="input" value={reorderLevel} onChange={setReorderLevel} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'تكلفة الوحدة' : 'Cost Price'}</label>
                <NumericInput min="0" step="0.01" className="input" placeholder="0.00" value={costPrice} onChange={setCostPrice} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'سعر البيع' : 'Sale Price'}</label>
                <NumericInput min="0" step="0.01" className="input" placeholder="0.00" value={salePrice} onChange={setSalePrice} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'الفرع *' : 'Location *'}</label>
                <SearchableCombobox options={locationOpts} value={locationId} onChange={setLocationId} placeholder={isAr ? 'اختر الفرع…' : 'Select location…'} />
              </div>
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
              <textarea
                className="input" style={{ resize: 'vertical', minHeight: 64 }}
                placeholder={isAr ? 'وصف أو ملاحظات…' : 'Description or notes…'}
                value={description} onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={isUniversal} onChange={(e) => setIsUniversal(e.target.checked)} />
              <span style={{ fontWeight: 500 }}>{isAr ? 'قطعة شاملة — تناسب جميع السيارات' : 'Universal Part — fits all vehicles'}</span>
            </label>
          </section>

          {/* ── Initial Stock ── */}
          <section className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
              {isAr ? 'المخزون الأولي' : 'Initial Stock'}
            </h2>
            <div style={{ maxWidth: 240 }}>
              <label className="input-label">{isAr ? 'الكمية في المخزن' : 'Quantity on Hand'}</label>
              <NumericInput min="0" step="1" className="input" value={initialStock} onChange={setInitialStock} />
            </div>
          </section>

          {/* ── Fitment ── */}
          {!isUniversal && (
            <section className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
                {isAr ? 'ملاءمة السيارات' : 'Vehicle Fitment'}
              </h2>

              {/* Pending fitment chips */}
              {fitments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {fitments.map((f, i) => {
                    const sec = CAR_SECTIONS.find((s) => s.value === f.section);
                    return (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.25rem 0.6rem', borderRadius: 20,
                        background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                        fontSize: '0.8rem', color: 'var(--text-1)',
                      }}>
                        {f.makeName} · {f.modelName} · {f.yearFrom}–{f.yearTo} · {sec ? (isAr ? sec.labelAr : sec.labelEn) : f.section}
                        <button
                          type="button"
                          onClick={() => setFitments((prev) => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1, padding: '0 0 0 0.125rem', fontSize: '1rem' }}
                        >×</button>
                      </span>
                    );
                  })}
                </div>
              )}

              {fitments.length === 0 && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', margin: 0 }}>
                  {isAr ? 'لم تُضف أي ملاءمة بعد.' : 'No fitment added yet.'}
                </p>
              )}

              {/* Add fitment row */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-1)', margin: '0 0 0.75rem 0' }}>
                  {isAr ? '+ إضافة ملاءمة' : '+ Add Fitment'}
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
                    <SearchableCombobox
                      options={modelOpts} value={fitModelId} onChange={setFitModelId}
                      placeholder={isAr ? 'الموديل…' : 'Model…'}
                    />
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
                    <SearchableCombobox
                      options={sectionOpts} value={fitSection} onChange={setFitSection}
                      placeholder={isAr ? 'القسم…' : 'Section…'}
                    />
                  </div>
                  <div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={addFitment} style={{ whiteSpace: 'nowrap' }}>
                      {isAr ? '+ إضافة' : '+ Add'}
                    </button>
                  </div>
                </div>
                {fitErr && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{fitErr}</p>}
              </div>
            </section>
          )}

          {/* ── Actions ── */}
          {err && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', margin: 0 }}>{err}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إضافة القطعة' : 'Add Part')}
            </button>
          </div>
        </div>
      </form>

      {showScan && (
        <ScannerModal
          formats={PART_FORMATS}
          title="Scan Part Barcode"
          hint="Point camera at the barcode or QR code on the part"
          onScan={(value) => { setShowScan(false); setPartNumber(value); }}
          onClose={() => setShowScan(false)}
        />
      )}
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
