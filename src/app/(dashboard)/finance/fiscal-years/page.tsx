'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';
import { ErrorBanner } from '@/components/ui/error-banner';

interface FiscalYear {
  id: string; name: string; startDate: string; endDate: string;
  lockDate?: string;
  periods?: { id: string; name: string; startDate: string; endDate: string; locked: boolean }[];
}

export default function FiscalYearsPage() {
  const { isAr } = useLang();
  const { data, loading, error, reload } = useQuery<FiscalYear[]>('/finance/fiscal-years');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: 'FY 2027', startDate: '2027-01-01', endDate: '2027-12-31' });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const years = Array.isArray(data) ? data : [];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/finance/fiscal-years', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, startDate: new Date(form.startDate).toISOString(), endDate: new Date(form.endDate).toISOString() }),
      });
      setShowCreate(false); reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function generatePeriods(id: string) {
    setGenerating(id);
    try {
      await apiFetch(`/finance/fiscal-years/${id}/periods/generate`, { method: 'POST' });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setGenerating(null); }
  }

  async function lock(id: string) {
    if (!confirm('Lock this fiscal year? Posting to locked periods requires Finance Admin override.')) return;
    try {
      await apiFetch(`/finance/fiscal-years/${id}/lock`, {
        method: 'PATCH',
        body: JSON.stringify({ lockDate: new Date().toISOString() }),
      });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
  }

  async function unlock(id: string) {
    if (!confirm('Unlock this fiscal year? This allows posting to previously locked periods.')) return;
    try {
      await apiFetch(`/finance/fiscal-years/${id}/unlock`, { method: 'PATCH' });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{isAr ? 'السنوات المالية' : 'Fiscal Years'}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{isAr ? 'إدارة فترات السنوات المالية' : 'Accounting periods & lock dates'}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition">
          {isAr ? '+ سنة مالية جديدة' : '+ Fiscal Year'}
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <div className="mb-4"><ErrorBanner error={error} retry={reload} /></div>}

      <div className="space-y-4">
        {years.map((fy) => (
          <div key={fy.id} className="rounded-xl border border-white/5 bg-gray-900 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white font-medium">{fy.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fmtDate(fy.startDate, isAr)} → {fmtDate(fy.endDate, isAr)}
                </p>
                {fy.lockDate && (
                  <p className="text-xs text-amber-400 mt-0.5">{isAr ? 'مقفل:' : 'Locked:'} {fmtDate(fy.lockDate, isAr)}</p>
                )}
              </div>
              <div className="flex gap-2">
                {fy.lockDate ? (
                  <button onClick={() => unlock(fy.id)}
                    className="px-2.5 py-1 text-xs text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-700 transition">
                    {isAr ? 'إلغاء القفل' : 'Unlock'}
                  </button>
                ) : (
                  <button onClick={() => lock(fy.id)}
                    className="px-2.5 py-1 text-xs text-amber-400 border border-amber-400/30 rounded-lg hover:bg-amber-400/10 transition">
                    {isAr ? 'قفل السنة' : 'Lock'}
                  </button>
                )}
                <button
                  onClick={() => generatePeriods(fy.id)}
                  disabled={generating === fy.id}
                  className="px-2.5 py-1 text-xs text-blue-400 border border-blue-400/30 rounded-lg hover:bg-blue-400/10 disabled:opacity-50 transition">
                  {generating === fy.id ? '…' : (isAr ? 'إنشاء الفترات' : 'Generate Periods')}
                </button>
              </div>
            </div>

            {fy.periods && fy.periods.length > 0 && (
              <div className="grid grid-cols-6 gap-1 mt-3 pt-3 border-t border-white/5">
                {fy.periods.map((p) => (
                  <div key={p.id}
                    className={`text-center py-1.5 rounded text-xs font-medium ${
                      p.locked ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'
                    }`}>
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {years.length === 0 && !loading && (
          <p className="text-gray-600 text-sm">{isAr ? 'لا توجد سنوات مالية.' : 'No fiscal years configured.'}</p>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">{isAr ? 'سنة مالية جديدة' : 'New Fiscal Year'}</h2>
            <form onSubmit={create} className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">{isAr ? 'الاسم' : 'Name'}</label>
                <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">{isAr ? 'تاريخ البداية' : 'Start Date'}</label>
                  <input type="date" required value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">{isAr ? 'تاريخ النهاية' : 'End Date'}</label>
                  <input type="date" required value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" /></div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : (isAr ? 'إنشاء' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
