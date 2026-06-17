'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';

interface Vehicle {
  id: string; make: string; model: string; year: number; stockNumber: string;
  status: string; listPrice: number; condition: string; bodyType: string;
  color?: string; mileage?: number; vin?: string; engineType?: string;
  transmission?: string; fuelType?: string; description?: string;
  location?: { name: string; city?: string };
  images?: { url: string; isPrimary: boolean }[];
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: v, loading, error } = useQuery<Vehicle>(`/vehicles/${id}`);

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">{error}</div>;
  if (!v) return null;

  const primary = v.images?.find((i) => i.isPrimary) ?? v.images?.[0];

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-xs mb-5 transition">
        ← Back
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{v.year} {v.make} {v.model}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Stock #{v.stockNumber} · {v.location?.name ?? '—'}</p>
        </div>
        <StatusBadge status={v.status} />
      </div>

      {primary && (
        <div className="mb-6 rounded-xl overflow-hidden border border-white/5 h-56 bg-gray-900 flex items-center justify-center">
          <img src={primary.url} alt={`${v.make} ${v.model}`} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          ['Condition', v.condition],
          ['Body Type', v.bodyType],
          ['Color', v.color ?? '—'],
          ['Mileage', v.mileage ? `${v.mileage.toLocaleString()} km` : '—'],
          ['Engine', v.engineType ?? '—'],
          ['Transmission', v.transmission ?? '—'],
          ['Fuel', v.fuelType ?? '—'],
          ['VIN', v.vin ?? '—'],
          ['List Price', v.listPrice?.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })],
        ].map(([label, val]) => (
          <div key={label} className="rounded-xl border border-white/5 bg-gray-900 p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-sm text-white font-medium">{val}</p>
          </div>
        ))}
      </div>

      {v.description && (
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-2">Description</p>
          <p className="text-sm text-gray-300">{v.description}</p>
        </div>
      )}
    </div>
  );
}
