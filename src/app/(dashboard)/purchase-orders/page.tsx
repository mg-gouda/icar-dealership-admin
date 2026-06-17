'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../lib/useApi';
import StatusBadge from '../../../components/StatusBadge';
import SearchableCombobox from '../../../components/ui/SearchableCombobox';

interface PO {
  id: string; status: string; orderDate: string; expectedDate?: string; total: number;
  partner: { id: string; name: string };
  location: { id: string; name: string };
  lines: { id: string; description: string; quantity: number; unitCost: number }[];
  _count: { receipts: number };
}
interface Partner { id: string; name: string; type: string; }
interface Location { id: string; name: string; }

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const BLANK_LINE = { description: '', quantity: '1', unitCost: '' };

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ partnerId: '', locationId: '', expectedDate: '', lines: [{ ...BLANK_LINE }] });

  const qs = statusFilter ? `?status=${statusFilter}&limit=30` : '?limit=30';
  const { data: res, loading, reload } = useQuery<{ items: PO[]; total: number }>(`/purchase-orders${qs}`);
  const { data: partners } = useQuery<Partner[]>('/partners?limit=100');
  const { data: locations } = useQuery<Location[]>('/locations');

  const pos = res?.items ?? [];
  const vendorOpts = (Array.isArray(partners) ? partners : [])
    .filter((p) => ['VENDOR', 'EMPLOYEE'].includes(p.type))
    .map((p) => ({ value: p.id, label: p.name }));
  const locationOpts = (Array.isArray(locations) ? locations : [])
    .map((l) => ({ value: l.id, label: l.name }));

  function addLine() { setForm((f) => ({ ...f, lines: [...f.lines, { ...BLANK_LINE }] })); }
  function removeLine(i: number) { setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) })); }
  function updateLine(i: number, key: string, val: string) {
    setForm((f) => { const lines = [...f.lines]; lines[i] = { ...lines[i], [key]: val }; return { ...f, lines }; });
  }

  const lineTotal = form.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  async function createPO(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          partnerId: form.partnerId,
          locationId: form.locationId,
          expectedDate: form.expectedDate || undefined,
          lines: form.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
        }),
      });
      setShowCreate(false);
      setForm({ partnerId: '', locationId: '', expectedDate: '', lines: [{ ...BLANK_LINE }] });
      reload();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Purchase Orders</h1>
          <p className="text-xs text-gray-500 mt-0.5">{res?.total ?? 0} orders</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition">
          + New PO
        </button>
      </div>

      <div className="mb-4 w-52">
        <SearchableCombobox options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} placeholder="Filter by status" />
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Vendor</th>
              <th className="px-4 py-3 text-left font-medium">Location</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Expected</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-center font-medium">Lines</th>
              <th className="px-4 py-3 text-center font-medium">Receipts</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pos.map((po) => (
              <tr key={po.id} onClick={() => router.push(`/purchase-orders/${po.id}`)}
                className="hover:bg-white/5 cursor-pointer transition">
                <td className="px-4 py-2.5 text-white font-medium">{po.partner.name}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{po.location.name}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(po.orderDate).toLocaleDateString('en-EG')}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('en-EG') : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-white tabular-nums">{Number(po.total).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{po.lines.length}</td>
                <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{po._count.receipts}</td>
                <td className="px-4 py-2.5"><StatusBadge status={po.status} /></td>
              </tr>
            ))}
            {pos.length === 0 && !loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600 text-sm">No purchase orders.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-white mb-4">New Purchase Order</h2>
            <form onSubmit={createPO} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <SearchableCombobox label="Vendor *" options={vendorOpts} value={form.partnerId}
                  onChange={(v) => setForm({ ...form, partnerId: v })} placeholder="Select vendor" />
                <SearchableCombobox label="Location *" options={locationOpts} value={form.locationId}
                  onChange={(v) => setForm({ ...form, locationId: v })} placeholder="Select location" />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Expected Date</label>
                  <input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-400">Lines</p>
                  <button type="button" onClick={addLine} className="text-xs text-blue-400 hover:text-blue-300 transition">+ Add line</button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-6">
                        <input value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                          placeholder="Description *" required
                          className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0.01" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                          placeholder="Qty *" required
                          className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="0.01" value={l.unitCost} onChange={(e) => updateLine(i, 'unitCost', e.target.value)}
                          placeholder="Unit cost *" required
                          className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-1 flex items-center justify-center pt-2">
                        {form.lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(i)} className="text-gray-600 hover:text-red-400 text-xs transition">✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-right">Total: {lineTotal.toLocaleString()} EGP</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving || !form.partnerId || !form.locationId}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                  {saving ? '…' : 'Create PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
