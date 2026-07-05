'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

const SERVICE_TYPE_OPTS = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'PDI', label: 'PDI' },
  { value: 'RECONDITIONING', label: 'Reconditioning' },
  { value: 'RECALL', label: 'Recall' },
  { value: 'WARRANTY', label: 'Warranty' },
];

export default function NewServiceOrderPage() {
  const router = useRouter();

  const { data: vehiclesRaw } = useQuery<any>('/vehicles?limit=50');
  const { data: customersRaw } = useQuery<any[]>('/partners?type=CUSTOMER&limit=50');
  const { data: locationsRaw } = useQuery<any[]>('/locations');
  const { data: usersRaw } = useQuery<any>('/users?limit=100');

  const vehicleOpts = (Array.isArray(vehiclesRaw) ? vehiclesRaw : (vehiclesRaw?.data ?? []))
    .map((v: any) => ({
      value: v.id,
      label: `${v.year} ${v.make} ${v.model}${v.licensePlate ? ` — ${v.licensePlate}` : ''}`,
    }));
  const customerOpts = (Array.isArray(customersRaw) ? customersRaw : [])
    .map((c: any) => ({ value: c.id, label: c.name }));
  const locationOpts = (Array.isArray(locationsRaw) ? locationsRaw : [])
    .map((l: any) => ({ value: l.id, label: l.name }));
  const userOpts = (Array.isArray(usersRaw) ? usersRaw : (usersRaw?.data ?? []))
    .map((u: any) => ({ value: u.id, label: u.name }));

  const [form, setForm] = useState({
    vehicleId: '',
    customerId: '',
    locationId: '',
    serviceType: 'MAINTENANCE',
    technicianId: '',
    description: '',
    internalNotes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function setF(k: string, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicleId || !form.customerId || !form.locationId) {
      setErr('Vehicle, customer, and location are required.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const order = await apiFetch<{ id: string }>('/service-orders', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: form.vehicleId,
          customerId: form.customerId,
          locationId: form.locationId,
          serviceType: form.serviceType,
          ...(form.technicianId && { technicianId: form.technicianId }),
          ...(form.description && { description: form.description }),
          ...(form.internalNotes && { internalNotes: form.internalNotes }),
        }),
      });
      router.push(`/service/${order.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error creating order');
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/service" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← Service Center
            </Link>
          </div>
          <h1 className="page-title">New Service Order</h1>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 720 }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <form onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Vehicle + Customer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">Vehicle *</label>
                  <SearchableCombobox
                    options={vehicleOpts}
                    value={form.vehicleId}
                    onChange={(v) => setF('vehicleId', v)}
                    placeholder="Search vehicles…"
                  />
                </div>
                <div>
                  <label className="input-label">Customer *</label>
                  <SearchableCombobox
                    options={customerOpts}
                    value={form.customerId}
                    onChange={(v) => setF('customerId', v)}
                    placeholder="Search customers…"
                  />
                </div>
              </div>

              {/* Location + Service Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">Location *</label>
                  <SearchableCombobox
                    options={locationOpts}
                    value={form.locationId}
                    onChange={(v) => setF('locationId', v)}
                    placeholder="Select location…"
                  />
                </div>
                <div>
                  <label className="input-label">Service Type</label>
                  <SearchableCombobox
                    options={SERVICE_TYPE_OPTS}
                    value={form.serviceType}
                    onChange={(v) => setF('serviceType', v)}
                  />
                </div>
              </div>

              {/* Technician */}
              <div style={{ maxWidth: 360 }}>
                <label className="input-label">Technician</label>
                <SearchableCombobox
                  options={userOpts}
                  value={form.technicianId}
                  onChange={(v) => setF('technicianId', v)}
                  placeholder="Unassigned"
                  clearable
                  clearLabel="Unassigned"
                />
              </div>

              {/* Description */}
              <div>
                <label className="input-label">Description</label>
                <textarea
                  className="input"
                  style={{ resize: 'vertical', minHeight: '80px' }}
                  placeholder="Describe the work to be done…"
                  value={form.description}
                  onChange={(e) => setF('description', e.target.value)}
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="input-label">Internal Notes</label>
                <textarea
                  className="input"
                  style={{ resize: 'vertical', minHeight: '60px' }}
                  placeholder="Staff-only notes…"
                  value={form.internalNotes}
                  onChange={(e) => setF('internalNotes', e.target.value)}
                />
              </div>

              {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1rem',
                }}
              >
                <Link href="/service" className="btn btn-secondary">Cancel</Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Order'}
                </button>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
