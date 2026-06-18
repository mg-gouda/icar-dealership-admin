'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface Tier {
  id: string;
  minValue: number;
  maxValue?: number | null;
  rateType: string;
  rateValue: number;
}

interface CommissionPlan {
  id: string; name: string; basisType: string; active: boolean;
  flatAmount?: number; percentage?: number;
  applicableRole?: string; vehicleCategory?: string;
  location?: { name: string };
  tiers: Tier[];
}

const RATE_TYPE_OPTS = [
  { value: 'FLAT_AMOUNT', label: 'Flat Amount (EGP)' },
  { value: 'PERCENT_OF_SALE_PRICE', label: '% of Sale Price' },
  { value: 'PERCENT_OF_GROSS_PROFIT', label: '% of Gross Profit' },
];

const BLANK_TIER = { minValue: '', maxValue: '', rateType: 'PERCENT_OF_SALE_PRICE', rateValue: '' };

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
  const [form, setForm] = useState<typeof BLANK>(BLANK);

  // Tier section state
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [tierForms, setTierForms] = useState<Record<string, typeof BLANK_TIER>>({});
  const [savingTierId, setSavingTierId] = useState<string | null>(null);

  function toggleTiers(planId: string) {
    setExpandedPlanId((prev) => (prev === planId ? null : planId));
    setTierForms((prev) => ({ ...prev, [planId]: prev[planId] ?? { ...BLANK_TIER } }));
  }

  function setTierField(planId: string, k: keyof typeof BLANK_TIER, v: string) {
    setTierForms((prev) => ({ ...prev, [planId]: { ...(prev[planId] ?? BLANK_TIER), [k]: v } }));
  }

  async function addTier(plan: CommissionPlan) {
    const tf = tierForms[plan.id];
    if (!tf?.minValue || !tf?.rateType || !tf?.rateValue) return;
    const newTier = {
      minValue: Number(tf.minValue),
      maxValue: tf.maxValue ? Number(tf.maxValue) : null,
      rateType: tf.rateType,
      rateValue: Number(tf.rateValue),
    };
    const updatedTiers = [
      ...plan.tiers.map(({ minValue, maxValue, rateType, rateValue }) => ({ minValue, maxValue, rateType, rateValue })),
      newTier,
    ];
    setSavingTierId(plan.id);
    try {
      await apiFetch(`/commission-plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ tiers: updatedTiers }) });
      setTierForms((prev) => ({ ...prev, [plan.id]: { ...BLANK_TIER } }));
      reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error saving tier');
    } finally {
      setSavingTierId(null);
    }
  }

  async function removeTier(plan: CommissionPlan, tierIndex: number) {
    const updatedTiers = plan.tiers
      .filter((_, i) => i !== tierIndex)
      .map(({ minValue, maxValue, rateType, rateValue }) => ({ minValue, maxValue, rateType, rateValue }));
    setSavingTierId(plan.id);
    try {
      await apiFetch(`/commission-plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ tiers: updatedTiers }) });
      reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error removing tier');
    } finally {
      setSavingTierId(null);
    }
  }

  function openCreate() { setForm(BLANK); setShowCreate(true); }
  function openEdit(p: CommissionPlan) {
    setForm({
      name: p.name,
      basisType: p.basisType,
      percentage: String(p.percentage ?? ''),
      flatAmount: String(p.flatAmount ?? ''),
      applicableRole: p.applicableRole ?? '',
      vehicleCategory: p.vehicleCategory ?? '',
      active: p.active,
    });
    setEditPlan(p);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, unknown> = { name: form.name, basisType: form.basisType, active: form.active };
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
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function toggleActive(p: CommissionPlan) {
    await apiFetch(`/commission-plans/${p.id}`, { method: 'PATCH', body: JSON.stringify({ active: !p.active }) }).catch((e: unknown) => alert(e instanceof Error ? e.message : 'Error'));
    reload();
  }

  const rateTypeLabel = (rt: string) => RATE_TYPE_OPTS.find((o) => o.value === rt)?.label ?? rt;

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
        {plans.map((p) => {
          const isExpanded = expandedPlanId === p.id;
          const tf = tierForms[p.id] ?? BLANK_TIER;
          const isSavingTier = savingTierId === p.id;

          return (
            <div key={p.id} className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
              {/* Plan header row */}
              <div className="p-4 flex items-start justify-between gap-4">
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
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => toggleTiers(p.id)}
                    className="text-xs text-gray-400 hover:text-white border border-white/10 rounded px-2 py-1 transition flex items-center gap-1"
                  >
                    Tiers {p.tiers.length > 0 && <span className="text-gray-500">({p.tiers.length})</span>}
                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button onClick={() => openEdit(p)} className="text-xs text-blue-400 hover:text-blue-300 transition">Edit</button>
                  <button onClick={() => toggleActive(p)} className="text-xs text-gray-500 hover:text-white transition">
                    {p.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>

              {/* Tiers collapsible section */}
              {isExpanded && (
                <div className="border-t border-white/5 px-4 pb-4 pt-3">
                  <p className="text-xs font-medium text-gray-400 mb-2">Tiers</p>

                  {/* Tier table */}
                  {p.tiers.length > 0 ? (
                    <table className="w-full text-xs mb-3">
                      <thead>
                        <tr className="text-gray-600 border-b border-white/5">
                          <th className="text-left pb-1.5 font-medium">From</th>
                          <th className="text-left pb-1.5 font-medium">To</th>
                          <th className="text-left pb-1.5 font-medium">Type</th>
                          <th className="text-left pb-1.5 font-medium">Rate</th>
                          <th className="pb-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {p.tiers.map((t, i) => (
                          <tr key={t.id} className="border-b border-white/5 last:border-0">
                            <td className="py-1.5 text-gray-300 font-mono">{Number(t.minValue).toLocaleString()}</td>
                            <td className="py-1.5 text-gray-300 font-mono">{t.maxValue != null ? Number(t.maxValue).toLocaleString() : '∞'}</td>
                            <td className="py-1.5 text-gray-400">{rateTypeLabel(t.rateType)}</td>
                            <td className="py-1.5 text-gray-300">
                              {t.rateType === 'FLAT_AMOUNT' ? `${Number(t.rateValue).toLocaleString()} EGP` : `${t.rateValue}%`}
                            </td>
                            <td className="py-1.5 text-right">
                              <button
                                disabled={isSavingTier}
                                onClick={() => removeTier(p, i)}
                                className="text-gray-600 hover:text-red-400 disabled:opacity-40 transition text-xs"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-gray-600 mb-3">No tiers yet.</p>
                  )}

                  {/* Add tier mini-form */}
                  <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-white/5">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">From</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={tf.minValue}
                        onChange={(e) => setTierField(p.id, 'minValue', e.target.value)}
                        placeholder="0"
                        className="w-24 px-2 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">To (optional)</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={tf.maxValue}
                        onChange={(e) => setTierField(p.id, 'maxValue', e.target.value)}
                        placeholder="∞"
                        className="w-24 px-2 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="w-48">
                      <SearchableCombobox
                        label="Type"
                        options={RATE_TYPE_OPTS}
                        value={tf.rateType}
                        onChange={(v) => setTierField(p.id, 'rateType', v)}
                        placeholder="Type"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Rate</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={tf.rateValue}
                        onChange={(e) => setTierField(p.id, 'rateValue', e.target.value)}
                        placeholder="0"
                        className="w-24 px-2 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSavingTier || !tf.minValue || !tf.rateValue}
                      onClick={() => addTier(p)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition"
                    >
                      {isSavingTier ? '…' : '+ Add tier'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
