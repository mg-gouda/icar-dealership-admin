'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface CommissionPlan {
  id: string; name: string; basisType: string; active: boolean;
  flatAmount?: number; percentage?: number;
  applicableRole?: string; vehicleCategory?: string;
  location?: { name: string };
  tiers: { id: string; minValue: number; maxValue?: number; rateType: string; rateValue: number }[];
}

const BASIS_OPTS = [
  { value: 'FLAT_AMOUNT', label: 'Flat Amount' },
  { value: 'PERCENT_OF_SALE_PRICE', label: '% of Sale Price' },
  { value: 'PERCENT_OF_GROSS_PROFIT', label: '% of Gross Profit' },
  { value: 'TIERED', label: 'Tiered' },
];

const ROLE_OPTS = [
  { value: '', label: 'Any role' },
  { value: 'PRIMARY_SALES_REP', label: 'Primary Sales Rep' },
  { value: 'CLOSER', label: 'Closer' },
  { value: 'FINANCE_MANAGER', label: 'Finance Manager' },
];

const BLANK = { name: '', basisType: 'PERCENT_OF_SALE_PRICE', percentage: '', flatAmount: '', applicableRole: '', vehicleCategory: '', active: true };

export default function CommissionPlansPage() {
  const { data, loading, reload } = useQuery<CommissionPlan[]>('/commission-plans');
  const plans = Array.isArray(data) ? data : [];

  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<CommissionPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(BLANK);

  function openCreate() { setForm(BLANK); setShowCreate(true); }
  function openEdit(p: CommissionPlan) {
    setForm({ name: p.name, basisType: p.basisType, percentage: p.percentage ?? '', flatAmount: p.flatAmount ?? '', applicableRole: p.applicableRole ?? '', vehicleCategory: p.vehicleCategory ?? '', active: p.active });
    setEditPlan(p);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: any = { name: form.name, basisType: form.basisType, active: form.active };
    if (form.applicableRole) body.applicableRole = form.applicableRole;
    if (form.vehicleCategory) body.vehicleCategory = form.vehicleCategory;
    if (form.basisType === 'FLAT_AMOUNT') body.flatAmount = Number(form.flatAmount);
    else if (form.basisType !== 'TIERED') body.percentage = Number(form.percentage);
    try {
      if (editPlan) {
        await apiFetch(`/commission-plans/${editPlan.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        setEditPlan(null);
      } else {
        await apiFetch('/commission-plans', { method: 'POST', body: JSON.stringify(body) });
        setShowCreate(false);
      }
      reload();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(p: CommissionPlan) {
    await apiFetch(`/commission-plans/${p.id}`, { method: 'PATCH', body: JSON.stringify({ active: !p.active }) }).catch((e) => alert(e.message));
    reload();
  }

  const dialog = showCreate || editPlan;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Commission Plans</h1>
          <p className="text-xs text-gray-500 mt-0.5">{plans.length} plans</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition">
          + New Plan
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/5 bg-gray-900 p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">{p.name}</span>
                {!p.active && <span className="text-xs text-gray-500 border border-white/10 rounded px-1.5 py-0.5">Inactive</span>}
              </div>
              <p className="text-xs text-gray-500">
                {p.basisType.replace(/_/g, ' ')}
                {p.percentage ? ` · ${p.percentage}%` : ''}
                {p.flatAmount ? ` · ${Number(p.flatAmount).toLocaleString()} EGP` : ''}
                {p.applicableRole ? ` · ${p.applicableRole.replace(/_/g, ' ')}` : ''}
                {p.vehicleCategory ? ` · ${p.vehicleCategory}` : ''}
                {p.location ? ` · ${p.location.name}` : ''}
              </p>
              {p.tiers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.tiers.map((t) => (
                    <span key={t.id} className="text-xs bg-gray-800 border border-white/5 rounded px-2 py-0.5 text-gray-400">
                      {Number(t.minValue).toLocaleString()}{t.maxValue ? `–${Number(t.maxValue).toLocaleString()}` : '+'}: {t.rateValue}{t.rateType === 'FLAT_AMOUNT' ? ' EGP' : '%'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(p)} className="text-xs text-blue-400 hover:text-blue-300 transition">Edit</button>
              <button onClick={() => toggleActive(p)} className="text-xs text-gray-500 hover:text-white transition">
                {p.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && !loading && (
          <div className="rounded-xl border border-white/5 bg-gray-900 p-8 text-center text-gray-600 text-sm">No commission plans yet.</div>
        )}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreate(false); setEditPlan(null); }} />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">{editPlan ? 'Edit Plan' : 'New Commission Plan'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <SearchableCombobox label="Basis Type *" options={BASIS_OPTS} value={form.basisType} onChange={(v) => setForm({ ...form, basisType: v })} placeholder="Select type" />
              {(form.basisType === 'PERCENT_OF_SALE_PRICE' || form.basisType === 'PERCENT_OF_GROSS_PROFIT') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Percentage *</label>
                  <input type="number" step="0.01" min="0" max="100" required value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              )}
              {form.basisType === 'FLAT_AMOUNT' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Flat Amount (EGP) *</label>
                  <input type="number" step="0.01" min="0" required value={form.flatAmount} onChange={(e) => setForm({ ...form, flatAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              )}
              {form.basisType === 'TIERED' && (
                <p className="text-xs text-amber-400">Tiers can be added via API after creating the plan.</p>
              )}
              <SearchableCombobox label="Applicable Role" options={ROLE_OPTS} value={form.applicableRole} onChange={(v) => setForm({ ...form, applicableRole: v })} placeholder="Any role" />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vehicle Category (optional)</label>
                <input value={form.vehicleCategory} onChange={(e) => setForm({ ...form, vehicleCategory: e.target.value })}
                  placeholder="e.g. SUV, SEDAN, NEW, USED"
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-white/20 bg-gray-800" />
                Active
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowCreate(false); setEditPlan(null); }}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : editPlan ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
