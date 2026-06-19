'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface VehicleImage { id: string; url: string; order: number; }

interface Vehicle {
  id: string; make: string; model: string; trim?: string; year: number;
  vin: string; status: string; condition?: string;
  bodyType?: string; color?: string; mileage?: number; engineSize?: string;
  fuelType?: string; transmission?: string; seats?: number; doors?: number;
  price: number; cost?: number;
  adminFeeOverride?: number; insuranceFeeOverride?: number;
  description?: string;
  location?: { name: string; city?: string };
  images?: VehicleImage[];
  features?: { feature: string }[];
}

const STATUSES = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG'].map((v) => ({ value: v, label: v }));
const TRANSMISSIONS = ['Manual', 'Automatic', 'CVT'].map((v) => ({ value: v, label: v }));
const CONDITIONS = ['NEW', 'USED', 'CERTIFIED'].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() }));
const BODY_TYPES = ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Coupe', 'Wagon', 'Convertible'].map((v) => ({ value: v, label: v }));

const fmt = (n: number) =>
  Number(n).toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: v, loading, error, reload } = useQuery<Vehicle>(`/vehicles/${id}`, [id]);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [form, setForm] = useState<Partial<Vehicle>>({});
  const [activeImg, setActiveImg] = useState(0);
  const [addImgUrl, setAddImgUrl] = useState('');
  const [addingImg, setAddingImg] = useState(false);

  useEffect(() => {
    if (v) setForm({
      status: v.status, price: v.price, cost: v.cost,
      color: v.color, mileage: v.mileage,
      fuelType: v.fuelType, transmission: v.transmission,
      seats: v.seats, doors: v.doors, description: v.description,
      bodyType: v.bodyType, trim: v.trim,
      adminFeeOverride: v.adminFeeOverride, insuranceFeeOverride: v.insuranceFeeOverride,
    });
  }, [v]);

  function set(k: keyof Vehicle, val: any) {
    setForm((p) => ({ ...p, [k]: val }));
  }

  async function save() {
    setSaving(true);
    setSaveErr('');
    try {
      await apiFetch(`/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      await reload();
      setEditing(false);
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (error || !v) return (
    <div className="p-6">
      <p className="text-red-400 text-sm mb-3">{error ?? 'Not found'}</p>
      <button onClick={() => router.back()} className="text-blue-400 text-sm">← Back</button>
    </div>
  );

  const images = [...(v.images ?? [])].sort((a, b) => a.order - b.order);

  async function addImage(e: React.FormEvent) {
    e.preventDefault();
    if (!addImgUrl) return;
    setAddingImg(true);
    try {
      await apiFetch(`/vehicles/${id}/images`, { method: 'POST', body: JSON.stringify({ url: addImgUrl, order: images.length }) });
      setAddImgUrl('');
      await reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setAddingImg(false); }
  }

  async function deleteImage(imageId: string) {
    if (!confirm('Delete this image?')) return;
    await apiFetch(`/vehicles/${id}/images/${imageId}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    await reload();
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-xs mb-2 transition block">
            ← Vehicles
          </button>
          <h1 className="text-xl font-semibold text-white">
            {v.year} {v.make} {v.model} {v.trim ?? ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            VIN: {v.vin} · {v.location?.name ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={v.status} />
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 text-sm rounded-lg transition">
              Edit
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setSaveErr(''); }}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-white/10 transition">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveErr && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {saveErr}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: image + specs */}
        <div className="lg:col-span-3 space-y-4">
          {/* Image gallery */}
          <div className="rounded-xl overflow-hidden border border-white/5 bg-gray-900 h-60">
            {images.length > 0 ? (
              <img src={images[activeImg]?.url} alt={`${v.make} ${v.model}`}
                className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1.293 1.293A1 1 0 005 17h1m8 0h5l-1.405-4.215A2 2 0 0016.68 11H14a1 1 0 00-1 1v4z"/>
                </svg>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImg(i)}
                  className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition ${i === activeImg ? 'border-blue-500' : 'border-white/5 hover:border-white/20'}`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Image management */}
          <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Images</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {images.map((img, i) => (
                <div key={img.id} className={`relative group w-20 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition ${i === activeImg ? 'border-blue-500' : 'border-white/10'}`}
                  onClick={() => setActiveImg(i)}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }}
                    className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center text-white text-xs">✕</button>
                </div>
              ))}
            </div>
            <form onSubmit={addImage} className="flex gap-2">
              <input value={addImgUrl} onChange={(e) => setAddImgUrl(e.target.value)} placeholder="Image URL…"
                className="flex-1 px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500" />
              <button type="submit" disabled={addingImg || !addImgUrl}
                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition">
                {addingImg ? '…' : 'Add'}
              </button>
            </form>
          </div>

          {/* Specs grid */}
          <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Specifications</p>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <SearchableCombobox label="Condition" options={CONDITIONS}
                  value={form.condition ?? ''} onChange={(v) => set('condition', v)} />
                <SearchableCombobox label="Body Type" options={BODY_TYPES}
                  value={form.bodyType ?? ''} onChange={(v) => set('bodyType', v)} />
                <SearchableCombobox label="Fuel Type" options={FUEL_TYPES}
                  value={form.fuelType ?? ''} onChange={(v) => set('fuelType', v)} clearable />
                <SearchableCombobox label="Transmission" options={TRANSMISSIONS}
                  value={form.transmission ?? ''} onChange={(v) => set('transmission', v)} clearable />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Color</label>
                  <input value={form.color ?? ''} onChange={(e) => set('color', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Engine Size</label>
                  <input value={form.engineSize ?? ''} onChange={(e) => set('engineSize', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mileage (km)</label>
                  <input type="number" value={form.mileage ?? ''} onChange={(e) => set('mileage', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Trim</label>
                  <input value={form.trim ?? ''} onChange={(e) => set('trim', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Seats</label>
                  <input type="number" value={form.seats ?? ''} onChange={(e) => set('seats', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Doors</label>
                  <input type="number" value={form.doors ?? ''} onChange={(e) => set('doors', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {[
                  ['Condition', v.condition],
                  ['Body Type', v.bodyType],
                  ['Color', v.color],
                  ['Fuel Type', v.fuelType],
                  ['Transmission', v.transmission],
                  ['Mileage', v.mileage ? `${v.mileage.toLocaleString()} km` : undefined],
                  ['Seats', v.seats],
                  ['Doors', v.doors],
                  ['VIN', v.vin],
                ].filter(([, val]) => val !== undefined && val !== null).map(([label, val]) => (
                  <div key={label as string}>
                    <p className="text-xs text-gray-500">{label as string}</p>
                    <p className="text-sm text-white font-medium mt-0.5">{String(val)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Description</p>
            {editing ? (
              <textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)}
                rows={4} placeholder="Vehicle description…"
                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none" />
            ) : (
              <p className="text-sm text-gray-300 leading-relaxed">{v.description ?? '—'}</p>
            )}
          </div>
        </div>

        {/* Right: pricing + status */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-white/5 bg-gray-900 p-5 sticky top-20">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Pricing & Status</p>

            {editing ? (
              <div className="space-y-3">
                <SearchableCombobox label="Status" options={STATUSES}
                  value={form.status ?? ''} onChange={(v) => set('status', v)} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Price (EGP)</label>
                  <input type="number" value={form.price ?? ''} onChange={(e) => set('price', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cost (EGP)</label>
                  <input type="number" value={form.cost ?? ''} onChange={(e) => set('cost', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Admin Fee Override (EGP)</label>
                  <input type="number" value={form.adminFeeOverride ?? ''} onChange={(e) => set('adminFeeOverride', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Insurance Override (EGP)</label>
                  <input type="number" value={form.insuranceFeeOverride ?? ''} onChange={(e) => set('insuranceFeeOverride', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-gray-400">Price</span>
                  <span className="text-white font-bold text-lg">{fmt(v.price)}</span>
                </div>
                {v.cost != null && (
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-gray-400">Cost</span>
                    <span className="text-white">{fmt(v.cost)}</span>
                  </div>
                )}
                {v.cost != null && (
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-gray-400">Gross Margin</span>
                    <span className="text-green-400">
                      {fmt(v.price - v.cost)}
                      <span className="text-gray-500 text-xs ml-1">
                        ({((v.price - v.cost) / v.price * 100).toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                )}
                {v.adminFeeOverride != null && (
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-gray-400">Admin Fee Override</span>
                    <span className="text-gray-300">{fmt(v.adminFeeOverride)}</span>
                  </div>
                )}
                {v.insuranceFeeOverride != null && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Insurance Override</span>
                    <span className="text-gray-300">{fmt(v.insuranceFeeOverride)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Features */}
          {(v.features?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-white/5 bg-gray-900 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Features</p>
              <div className="flex flex-wrap gap-2">
                {v.features!.map((f) => (
                  <span key={f.feature}
                    className="px-2.5 py-1 bg-gray-800 text-gray-300 text-xs rounded-full border border-white/5">
                    {f.feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
