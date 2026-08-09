'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '@/lib/useApi';
import { useLang } from '@/lib/lang-context';

interface PartMake     { id: string; name: string; _count: { models: number } }
interface PartModel    { id: string; name: string }
interface PartCategory { id: string; name: string; slug: string; _count: { parts: number } }

type Tab = 'fitment' | 'categories';

export default function CarCatalogPage() {
  const { isAr } = useLang();
  const [tab, setTab] = useState<Tab>('fitment');

  // ── Fitment state ──────────────────────────────────────────────────────────
  const [selectedMake, setSelectedMake] = useState<PartMake | null>(null);
  const [addMakeName, setAddMakeName]   = useState('');
  const [addModelName, setAddModelName] = useState('');

  // ── Categories state ────────────────────────────────────────────────────────
  const [addCatName, setAddCatName] = useState('');

  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const { data: makesRaw, loading: makesLoading, reload: reloadMakes } =
    useQuery<PartMake[]>('/part-catalog/makes');

  const { data: modelsRaw, loading: modelsLoading, reload: reloadModels } =
    useQuery<PartModel[]>(
      selectedMake ? `/part-catalog/makes/${selectedMake.id}/models` : null,
      [selectedMake?.id],
    );

  const { data: catsRaw, loading: catsLoading, reload: reloadCats } =
    useQuery<PartCategory[]>('/part-catalog/categories');

  const makes      = Array.isArray(makesRaw)  ? makesRaw  : [];
  const models     = Array.isArray(modelsRaw) ? modelsRaw : [];
  const categories = Array.isArray(catsRaw)   ? catsRaw   : [];

  // ── Fitment handlers ────────────────────────────────────────────────────────
  async function addMake(e: React.FormEvent) {
    e.preventDefault();
    if (!addMakeName.trim()) return;
    setBusy(true); setErr('');
    try {
      await apiFetch('/part-catalog/makes', { method: 'POST', body: JSON.stringify({ name: addMakeName.trim() }) });
      setAddMakeName(''); reloadMakes();
    } catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Error'); }
    finally { setBusy(false); }
  }

  async function deleteMake(make: PartMake) {
    if (make._count.models > 0) return;
    if (!confirm(isAr ? `حذف "${make.name}"؟` : `Delete "${make.name}"?`)) return;
    setBusy(true); setErr('');
    try {
      await apiFetch(`/part-catalog/makes/${make.id}`, { method: 'DELETE' });
      if (selectedMake?.id === make.id) setSelectedMake(null);
      reloadMakes();
    } catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Error'); }
    finally { setBusy(false); }
  }

  async function addModel(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMake || !addModelName.trim()) return;
    setBusy(true); setErr('');
    try {
      await apiFetch(`/part-catalog/makes/${selectedMake.id}/models`, {
        method: 'POST', body: JSON.stringify({ name: addModelName.trim() }),
      });
      setAddModelName(''); reloadModels(); reloadMakes();
    } catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Error'); }
    finally { setBusy(false); }
  }

  async function deleteModel(model: PartModel) {
    if (!selectedMake) return;
    if (!confirm(isAr ? `حذف "${model.name}"؟` : `Delete "${model.name}"?`)) return;
    setBusy(true); setErr('');
    try {
      await apiFetch(`/part-catalog/makes/${selectedMake.id}/models/${model.id}`, { method: 'DELETE' });
      reloadModels(); reloadMakes();
    } catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Error'); }
    finally { setBusy(false); }
  }

  // ── Category handlers ───────────────────────────────────────────────────────
  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!addCatName.trim()) return;
    setBusy(true); setErr('');
    try {
      await apiFetch('/part-catalog/categories', { method: 'POST', body: JSON.stringify({ name: addCatName.trim() }) });
      setAddCatName(''); reloadCats();
    } catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Error'); }
    finally { setBusy(false); }
  }

  async function deleteCategory(cat: PartCategory) {
    if (cat._count.parts > 0) return;
    if (!confirm(isAr ? `حذف "${cat.name}"؟` : `Delete "${cat.name}"?`)) return;
    setBusy(true); setErr('');
    try {
      await apiFetch(`/part-catalog/categories/${cat.id}`, { method: 'DELETE' });
      reloadCats();
    } catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Error'); }
    finally { setBusy(false); }
  }

  // ── Shared chip style ───────────────────────────────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 1rem', borderRadius: '0.375rem', border: 'none',
    cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-2)',
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/settings" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.875rem' }}>
              {isAr ? '← الإعدادات' : '← Settings'}
            </Link>
          </div>
          <h1 className="page-title">{isAr ? 'كتالوج السيارات والقطع' : 'Car Catalog & Part Categories'}</h1>
          <p className="page-subtitle">
            {isAr
              ? 'إدارة الماركات والطرازات لتوافق القطع، وفئات القطع'
              : 'Manage makes & models for parts fitment, and part categories'}
          </p>
        </div>
      </div>

      <div className="page-body">
        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: '0.25rem', marginBottom: '1.25rem',
          background: 'var(--surface-2)', padding: '0.25rem', borderRadius: '0.5rem',
          width: 'fit-content', border: '1px solid var(--border)',
        }}>
          <button style={tabStyle(tab === 'fitment')} onClick={() => setTab('fitment')}>
            {isAr ? '🚗 الماركات والطرازات' : '🚗 Makes & Models'}
          </button>
          <button style={tabStyle(tab === 'categories')} onClick={() => setTab('categories')}>
            {isAr ? '🏷️ فئات القطع' : '🏷️ Part Categories'}
            <span style={{
              marginLeft: '0.4rem', background: tab === 'categories' ? 'rgba(255,255,255,0.2)' : 'var(--surface-3)',
              borderRadius: '9999px', padding: '0 0.4rem', fontSize: '0.7rem',
            }}>
              {categories.length}
            </span>
          </button>
        </div>

        {err && (
          <p style={{ color: 'var(--danger-fg)', fontSize: '0.8125rem', marginBottom: '1rem' }}>{err}</p>
        )}

        {/* ── FITMENT TAB ─────────────────────────────────────────────────── */}
        {tab === 'fitment' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedMake ? '1fr 1fr' : '440px', gap: '1.25rem' }}>

            {/* Makes panel */}
            <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{isAr ? 'الماركات' : 'Makes'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{makes.length}</span>
              </div>

              {makesLoading && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                  {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 500 }}>
                {makes.map((make) => {
                  const canDelete = make._count.models === 0;
                  const isSelected = selectedMake?.id === make.id;
                  return (
                    <div
                      key={make.id}
                      onClick={() => setSelectedMake(isSelected ? null : make)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.55rem 1rem', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: isSelected
                          ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                          : undefined,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-1)' }}>{make.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 1 }}>
                          {make._count.models} {isAr ? 'طراز' : 'models'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteMake(make); }}
                        disabled={!canDelete || busy}
                        title={canDelete
                          ? (isAr ? 'حذف الماركة' : 'Delete make')
                          : (isAr ? 'يحتوي على طرازات' : 'Has models — remove them first')}
                        style={{
                          background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
                          padding: '0.2rem 0.45rem', cursor: canDelete ? 'pointer' : 'not-allowed',
                          color: canDelete ? 'var(--danger-fg)' : 'var(--text-3)',
                          opacity: canDelete ? 1 : 0.3, fontSize: '0.85rem', lineHeight: 1,
                        }}
                      >×</button>
                    </div>
                  );
                })}
                {makes.length === 0 && !makesLoading && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                    {isAr ? 'لا توجد ماركات بعد.' : 'No makes yet.'}
                  </div>
                )}
              </div>

              <form onSubmit={addMake} style={{
                display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem',
                borderTop: '1px solid var(--border)', background: 'var(--surface-2)',
              }}>
                <input
                  className="input"
                  style={{ flex: 1, fontSize: '0.8125rem', padding: '0.4rem 0.6rem' }}
                  placeholder={isAr ? 'اسم الماركة…' : 'Make name…'}
                  value={addMakeName}
                  onChange={(e) => setAddMakeName(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !addMakeName.trim()}>
                  {isAr ? '+ إضافة' : '+ Add'}
                </button>
              </form>
            </div>

            {/* Models panel */}
            {selectedMake && (
              <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
                  fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{selectedMake.name} — {isAr ? 'الطرازات' : 'Models'}</span>
                  <span>{models.length}</span>
                </div>

                {modelsLoading && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                    {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                  </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 500 }}>
                  {models.map((model) => (
                    <div
                      key={model.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-1)' }}>{model.name}</span>
                      <button
                        type="button"
                        onClick={() => deleteModel(model)}
                        disabled={busy}
                        style={{
                          background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
                          padding: '0.2rem 0.45rem', cursor: 'pointer',
                          color: 'var(--danger-fg)', fontSize: '0.85rem', lineHeight: 1,
                        }}
                      >×</button>
                    </div>
                  ))}
                  {models.length === 0 && !modelsLoading && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                      {isAr ? `لا توجد طرازات لـ ${selectedMake.name}.` : `No models for ${selectedMake.name}.`}
                    </div>
                  )}
                </div>

                <form onSubmit={addModel} style={{
                  display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem',
                  borderTop: '1px solid var(--border)', background: 'var(--surface-2)',
                }}>
                  <input
                    className="input"
                    style={{ flex: 1, fontSize: '0.8125rem', padding: '0.4rem 0.6rem' }}
                    placeholder={isAr ? 'اسم الطراز…' : 'Model name…'}
                    value={addModelName}
                    onChange={(e) => setAddModelName(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !addModelName.trim()}>
                    {isAr ? '+ إضافة' : '+ Add'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ── CATEGORIES TAB ──────────────────────────────────────────────── */}
        {tab === 'categories' && (
          <div style={{ maxWidth: 520 }}>
            <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{isAr ? 'فئات القطع' : 'Part Categories'}</span>
                <span>{categories.length}</span>
              </div>

              {catsLoading && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                  {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 520 }}>
                {categories.map((cat) => {
                  const canDelete = cat._count.parts === 0;
                  return (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-1)' }}>{cat.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 1 }}>
                          {cat._count.parts} {isAr ? 'قطعة' : 'parts assigned'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCategory(cat)}
                        disabled={!canDelete || busy}
                        title={canDelete
                          ? (isAr ? 'حذف الفئة' : 'Delete category')
                          : (isAr ? 'لا يمكن الحذف — مرتبطة بقطع' : 'Has parts assigned')}
                        style={{
                          background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
                          padding: '0.2rem 0.45rem', cursor: canDelete ? 'pointer' : 'not-allowed',
                          color: canDelete ? 'var(--danger-fg)' : 'var(--text-3)',
                          opacity: canDelete ? 1 : 0.3, fontSize: '0.85rem', lineHeight: 1,
                        }}
                      >×</button>
                    </div>
                  );
                })}
                {categories.length === 0 && !catsLoading && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                    {isAr ? 'لا توجد فئات بعد.' : 'No categories yet.'}
                  </div>
                )}
              </div>

              <form onSubmit={addCategory} style={{
                display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem',
                borderTop: '1px solid var(--border)', background: 'var(--surface-2)',
              }}>
                <input
                  className="input"
                  style={{ flex: 1, fontSize: '0.8125rem', padding: '0.4rem 0.6rem' }}
                  placeholder={isAr ? 'اسم الفئة…' : 'Category name…'}
                  value={addCatName}
                  onChange={(e) => setAddCatName(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !addCatName.trim()}>
                  {isAr ? '+ إضافة' : '+ Add'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
