'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '@/lib/lang-context';

type VehicleSource = 'INVENTORY' | 'EXTERNAL';
type CustomerSource = 'CRM' | 'WALKIN';

interface ExternalVehicle {
  id: string; licensePlate: string; make: string; model: string;
  color?: string; year?: number; regNumber?: string;
  ownerName: string; ownerPhone: string;
  serviceOrders?: { id: string; orderNumber: string; status: string; createdAt: string; totalAmount: number }[];
}

export default function NewServiceOrderPage() {
  const router = useRouter();
  const { isAr } = useLang();

  const SERVICE_TYPE_OPTS = [
    { value: 'MAINTENANCE',    label: isAr ? 'صيانة'              : 'Maintenance'    },
    { value: 'REPAIR',         label: isAr ? 'إصلاح'              : 'Repair'         },
    { value: 'PDI',            label: isAr ? 'فحص ما قبل التسليم' : 'PDI'            },
    { value: 'RECONDITIONING', label: isAr ? 'تجديد'              : 'Reconditioning' },
    { value: 'RECALL',         label: isAr ? 'استدعاء'            : 'Recall'         },
    { value: 'WARRANTY',       label: isAr ? 'ضمان'               : 'Warranty'       },
  ];

  // ── Static data ──
  const { data: vehiclesRaw } = useQuery<any>('/vehicles?limit=200');
  const { data: customersRaw } = useQuery<any[]>('/partners?type=CUSTOMER&limit=200');
  const { data: locationsRaw } = useQuery<any[]>('/locations');
  const { data: usersRaw } = useQuery<any>('/users?limit=100');

  const vehicleOpts = (Array.isArray(vehiclesRaw) ? vehiclesRaw : (vehiclesRaw?.data ?? []))
    .map((v: any) => ({ value: v.id, label: `${v.year ?? ''} ${v.make} ${v.model}${v.regLicenseNumber ? ` — ${v.regLicenseNumber}` : ''}`.trim() }));
  const customerOpts = (Array.isArray(customersRaw) ? customersRaw : [])
    .map((c: any) => ({ value: c.id, label: `${c.name}${c.phone ? ` · ${c.phone}` : ''}` }));
  const locationOpts = (Array.isArray(locationsRaw) ? locationsRaw : [])
    .map((l: any) => ({ value: l.id, label: l.name }));
  const userOpts = (Array.isArray(usersRaw) ? usersRaw : (usersRaw?.data ?? []))
    .map((u: any) => ({ value: u.id, label: u.name }));

  // ── Vehicle source toggle ──
  const [vehicleSource, setVehicleSource] = useState<VehicleSource>('INVENTORY');
  const [customerSource, setCustomerSource] = useState<CustomerSource>('CRM');

  // ── Inventory vehicle ──
  const [vehicleId, setVehicleId] = useState('');

  // ── External vehicle state ──
  type ExternalMode = 'SEARCH' | 'NEW';
  const [externalMode, setExternalMode] = useState<ExternalMode>('SEARCH');
  const [plateSearch, setPlateSearch] = useState('');
  const [plateSearched, setPlateSearched] = useState(false);
  const [foundExternal, setFoundExternal] = useState<ExternalVehicle | null>(null);
  const [selectedExternal, setSelectedExternal] = useState<ExternalVehicle | null>(null);
  const [externalForm, setExternalForm] = useState({ licensePlate: '', make: '', model: '', color: '', year: '', regNumber: '', ownerName: '', ownerPhone: '' });
  const [creatingExternal, setCreatingExternal] = useState(false);
  const [plateSearching, setPlateSearching] = useState(false);

  // ── Customer ──
  const [customerId, setCustomerId] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInLookupLoading, setWalkInLookupLoading] = useState(false);
  const [walkInReturning, setWalkInReturning] = useState(false);

  // ── Order fields ──
  const [locationId, setLocationId] = useState('');
  const [serviceType, setServiceType] = useState('MAINTENANCE');
  const [technicianId, setTechnicianId] = useState('');
  const [mileageIn, setMileageIn] = useState('');
  const [description, setDescription] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // ── Search external by plate ──
  async function searchPlate() {
    if (!plateSearch.trim()) return;
    setPlateSearching(true); setPlateSearched(false); setFoundExternal(null); setSelectedExternal(null);
    try {
      const result = await apiFetch<ExternalVehicle | null>(`/service-orders/external-vehicles/by-plate?plate=${encodeURIComponent(plateSearch.trim())}`);
      setFoundExternal(result ?? null);
      if (result) setSelectedExternal(result);
      setPlateSearched(true);
    } catch {
      setPlateSearched(true);
    } finally { setPlateSearching(false); }
  }

  // ── Create external vehicle ──
  async function createExternal() {
    if (!externalForm.licensePlate || !externalForm.make || !externalForm.model || !externalForm.ownerName || !externalForm.ownerPhone) {
      setErr(isAr ? 'الرجاء تعبئة بيانات السيارة الخارجية' : 'Fill all required external vehicle fields'); return;
    }
    setCreatingExternal(true); setErr('');
    try {
      const created = await apiFetch<ExternalVehicle>('/service-orders/external-vehicles', {
        method: 'POST',
        body: JSON.stringify({ ...externalForm, year: externalForm.year ? Number(externalForm.year) : undefined }),
      });
      setSelectedExternal(created);
      // auto-fill walk-in customer from owner
      if (customerSource === 'WALKIN' && !walkInName) {
        setWalkInName(created.ownerName);
        setWalkInPhone(created.ownerPhone);
      }
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setCreatingExternal(false); }
  }

  // Walk-in customer phone lookup — check if this phone has visited before
  async function lookupWalkInPhone(phone: string) {
    if (!phone.trim() || phone.length < 7) return;
    setWalkInLookupLoading(true); setWalkInReturning(false);
    try {
      const res = await apiFetch<{ data: any[] }>(`/service-orders?q=${encodeURIComponent(phone.trim())}&limit=5`);
      const match = (res?.data ?? []).find((o: any) => o.walkInCustomerPhone === phone.trim() && o.walkInCustomerName);
      if (match && !walkInName) {
        setWalkInName(match.walkInCustomerName);
        setWalkInReturning(true);
      }
    } catch { /* ignore */ }
    finally { setWalkInLookupLoading(false); }
  }

  // When switching to external vehicle source: auto-switch customer to walk-in
  function switchToExternal() {
    setVehicleSource('EXTERNAL');
    setCustomerSource('WALKIN');
    setVehicleId('');
  }

  // When selecting a found external vehicle, auto-fill walk-in customer
  function selectFoundVehicle(v: ExternalVehicle) {
    setSelectedExternal(v);
    if (!walkInName) { setWalkInName(v.ownerName); setWalkInPhone(v.ownerPhone); }
  }

  // ── Submit ──
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) { setErr(isAr ? 'الموقع مطلوب' : 'Location is required'); return; }
    if (vehicleSource === 'INVENTORY' && !vehicleId) { setErr(isAr ? 'يرجى اختيار سيارة من المخزون' : 'Select a vehicle from inventory'); return; }
    if (vehicleSource === 'EXTERNAL' && !selectedExternal) { setErr(isAr ? 'يرجى اختيار أو إنشاء سيارة خارجية' : 'Select or create the external vehicle first'); return; }

    setSaving(true); setErr('');
    try {
      const payload: Record<string, any> = {
        locationId,
        type: serviceType,
        ...(technicianId && { technicianId }),
        ...(mileageIn && { mileageIn: Number(mileageIn) }),
        ...(description && { description }),
        ...(internalNotes && { internalNotes }),
      };
      if (vehicleSource === 'INVENTORY') {
        payload.vehicleId = vehicleId;
      } else {
        payload.externalVehicleId = selectedExternal!.id;
      }
      if (customerSource === 'CRM' && customerId) {
        payload.customerId = customerId;
      } else if (customerSource === 'WALKIN' && walkInName) {
        payload.walkInCustomerName = walkInName;
        payload.walkInCustomerPhone = walkInPhone;
      }

      const order = await apiFetch<{ id: string }>('/service-orders', { method: 'POST', body: JSON.stringify(payload) });
      router.push(`/service/${order.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : (isAr ? 'خطأ في إنشاء الأمر' : 'Error creating order'));
      setSaving(false);
    }
  }

  const egp = (n: number) => `EGP ${Number(n).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/service" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← {isAr ? 'مركز الصيانة' : 'Service Center'}
            </Link>
          </div>
          <h1 className="page-title">{isAr ? 'أمر صيانة جديد' : 'New Service Order'}</h1>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 760 }}>
        <form onSubmit={submit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* ── Vehicle Section ── */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>{isAr ? 'بيانات السيارة' : 'Vehicle'}</h3>
                {/* Source toggle */}
                <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2 }}>
                  {(['INVENTORY', 'EXTERNAL'] as VehicleSource[]).map(s => (
                    <button key={s} type="button"
                      onClick={() => s === 'EXTERNAL' ? switchToExternal() : (setVehicleSource('INVENTORY'), setSelectedExternal(null))}
                      style={{ padding: '0.3rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.775rem', fontWeight: vehicleSource === s ? 600 : 400,
                        background: vehicleSource === s ? 'var(--surface)' : 'transparent',
                        color: vehicleSource === s ? 'var(--text-1)' : 'var(--text-3)',
                        boxShadow: vehicleSource === s ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                      {s === 'INVENTORY' ? (isAr ? 'من المخزون' : 'From Inventory') : (isAr ? 'سيارة خارجية' : 'Walk-in / External')}
                    </button>
                  ))}
                </div>
              </div>

              {vehicleSource === 'INVENTORY' ? (
                <div>
                  <label className="input-label">{isAr ? 'السيارة *' : 'Vehicle *'}</label>
                  <SearchableCombobox options={vehicleOpts} value={vehicleId} onChange={setVehicleId}
                    placeholder={isAr ? 'بحث في المخزون…' : 'Search inventory…'} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {/* Search / New sub-toggle (only when no vehicle selected yet) */}
                  {!selectedExternal && (
                    <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2, width: 'fit-content' }}>
                      {(['SEARCH', 'NEW'] as ExternalMode[]).map(m => (
                        <button key={m} type="button"
                          onClick={() => { setExternalMode(m); setPlateSearched(false); setFoundExternal(null); }}
                          style={{ padding: '0.25rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: externalMode === m ? 600 : 400,
                            background: externalMode === m ? 'var(--surface)' : 'transparent',
                            color: externalMode === m ? 'var(--text-1)' : 'var(--text-3)',
                            boxShadow: externalMode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                          {m === 'SEARCH' ? (isAr ? '🔍 بحث بالرقم' : '🔍 Search by plate') : (isAr ? '+ تسجيل سيارة جديدة' : '+ Register new vehicle')}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Plate search (existing vehicles) */}
                  {!selectedExternal && externalMode === 'SEARCH' && (
                    <div>
                      <label className="input-label">{isAr ? 'رقم اللوحة' : 'License Plate'}</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="input" style={{ flex: 1, textTransform: 'uppercase' }}
                          placeholder={isAr ? 'رقم اللوحة…' : 'e.g. ABC 1234'}
                          value={plateSearch}
                          onChange={e => setPlateSearch(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchPlate())} />
                        <button type="button" className="btn btn-secondary" onClick={searchPlate} disabled={plateSearching} style={{ flexShrink: 0 }}>
                          {plateSearching ? '…' : (isAr ? 'بحث' : 'Search')}
                        </button>
                      </div>

                      {/* Found */}
                      {plateSearched && foundExternal && (
                        <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)', borderRadius: 8 }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--success-fg)', fontWeight: 600, marginBottom: '0.375rem' }}>
                            {isAr ? 'تم العثور على السيارة في السجلات' : 'Vehicle found in records'}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>{foundExternal.licensePlate} — {foundExternal.make} {foundExternal.model} {foundExternal.year ?? ''}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{foundExternal.ownerName} · {foundExternal.ownerPhone}</div>
                          {foundExternal.serviceOrders && foundExternal.serviceOrders.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                              {foundExternal.serviceOrders.length} {isAr ? 'زيارة سابقة' : 'previous service visits'}
                            </div>
                          )}
                          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: '0.625rem' }}
                            onClick={() => selectFoundVehicle(foundExternal)}>
                            {isAr ? 'استخدام هذه السيارة' : 'Use this vehicle'}
                          </button>
                        </div>
                      )}

                      {/* Not found → prompt to switch to register */}
                      {plateSearched && !foundExternal && (
                        <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: 0 }}>
                            {isAr ? `اللوحة "${plateSearch}" غير مسجلة.` : `Plate "${plateSearch}" not found in records.`}
                          </p>
                          <button type="button" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}
                            onClick={() => { setExternalMode('NEW'); setExternalForm(f => ({ ...f, licensePlate: plateSearch })); }}>
                            {isAr ? '+ تسجيلها الآن' : '+ Register it now'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Direct registration form (NEW mode) */}
                  {!selectedExternal && externalMode === 'NEW' && (
                    <div style={{ padding: '0.875rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
                        {isAr ? 'أدخل بيانات السيارة الجديدة:' : 'Enter the vehicle details to register:'}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                        <div>
                          <label className="input-label">{isAr ? 'رقم اللوحة *' : 'License Plate *'}</label>
                          <input className="input" style={{ textTransform: 'uppercase' }}
                            value={externalForm.licensePlate}
                            onChange={e => setExternalForm(f => ({ ...f, licensePlate: e.target.value.toUpperCase() }))} />
                        </div>
                        <div>
                          <label className="input-label">{isAr ? 'رقم الترخيص' : 'Reg. Number'}</label>
                          <input className="input" placeholder={isAr ? 'رقم وثيقة التسجيل…' : 'Registration doc #…'}
                            value={externalForm.regNumber} onChange={e => setExternalForm(f => ({ ...f, regNumber: e.target.value }))} />
                        </div>
                        <div>
                          <label className="input-label">{isAr ? 'الماركة *' : 'Make *'}</label>
                          <input className="input" placeholder="Toyota, BMW…" value={externalForm.make}
                            onChange={e => setExternalForm(f => ({ ...f, make: e.target.value }))} />
                        </div>
                        <div>
                          <label className="input-label">{isAr ? 'الطراز *' : 'Model *'}</label>
                          <input className="input" placeholder="Corolla, X5…" value={externalForm.model}
                            onChange={e => setExternalForm(f => ({ ...f, model: e.target.value }))} />
                        </div>
                        <div>
                          <label className="input-label">{isAr ? 'اللون' : 'Color'}</label>
                          <input className="input" placeholder={isAr ? 'أبيض، أسود…' : 'White, Black…'}
                            value={externalForm.color} onChange={e => setExternalForm(f => ({ ...f, color: e.target.value }))} />
                        </div>
                        <div>
                          <label className="input-label">{isAr ? 'سنة الصنع' : 'Year'}</label>
                          <NumericInput className="input" placeholder="2022" min="1990" max="2030"
                            value={externalForm.year} onChange={val => setExternalForm(f => ({ ...f, year: val }))} />
                        </div>
                        <div>
                          <label className="input-label">{isAr ? 'اسم المالك *' : 'Owner Name *'}</label>
                          <input className="input" value={externalForm.ownerName}
                            onChange={e => setExternalForm(f => ({ ...f, ownerName: e.target.value }))} />
                        </div>
                        <div>
                          <label className="input-label">{isAr ? 'موبايل / واتساب المالك *' : 'Owner Mobile / WhatsApp *'}</label>
                          <input className="input" type="tel" value={externalForm.ownerPhone}
                            onChange={e => setExternalForm(f => ({ ...f, ownerPhone: e.target.value }))} />
                        </div>
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: '0.875rem' }}
                        onClick={createExternal} disabled={creatingExternal}>
                        {creatingExternal ? '…' : (isAr ? 'تسجيل السيارة والمتابعة' : 'Register Vehicle & Continue')}
                      </button>
                    </div>
                  )}

                  {/* Selected external vehicle summary */}
                  {selectedExternal && (
                    <div style={{ padding: '0.875rem', background: 'color-mix(in srgb, var(--primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-1)' }}>
                            {selectedExternal.licensePlate}
                            {selectedExternal.color && <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-3)', marginLeft: 6 }}>· {selectedExternal.color}</span>}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginTop: 2 }}>
                            {selectedExternal.year ? `${selectedExternal.year} ` : ''}{selectedExternal.make} {selectedExternal.model}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 2 }}>
                            {selectedExternal.ownerName} · {selectedExternal.ownerPhone}
                          </div>
                          {selectedExternal.serviceOrders && selectedExternal.serviceOrders.length > 0 && (
                            <details style={{ marginTop: '0.5rem' }}>
                              <summary style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', userSelect: 'none' }}>
                                {selectedExternal.serviceOrders.length} {isAr ? 'زيارة سابقة' : 'previous visits'}
                              </summary>
                              <div style={{ marginTop: '0.375rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {selectedExternal.serviceOrders.slice(0, 5).map(so => (
                                  <div key={so.id} style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', gap: '0.5rem' }}>
                                    <span>{so.orderNumber}</span>
                                    <span>·</span>
                                    <span>{so.status}</span>
                                    <span>·</span>
                                    <span>{egp(so.totalAmount)}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                        <button type="button" onClick={() => { setSelectedExternal(null); setPlateSearched(false); setFoundExternal(null); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.1rem' }}>×</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Customer Section ── */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>{isAr ? 'بيانات العميل' : 'Customer'}</h3>
                <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2 }}>
                  {(['CRM', 'WALKIN'] as CustomerSource[]).map(s => (
                    <button key={s} type="button" onClick={() => setCustomerSource(s)}
                      style={{ padding: '0.3rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.775rem', fontWeight: customerSource === s ? 600 : 400,
                        background: customerSource === s ? 'var(--surface)' : 'transparent',
                        color: customerSource === s ? 'var(--text-1)' : 'var(--text-3)',
                        boxShadow: customerSource === s ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                      {s === 'CRM' ? (isAr ? 'من قاعدة العملاء' : 'From CRM') : (isAr ? 'عميل زيارة' : 'Walk-in')}
                    </button>
                  ))}
                </div>
              </div>

              {customerSource === 'CRM' ? (
                <div>
                  <label className="input-label">{isAr ? 'العميل' : 'Customer'}</label>
                  <SearchableCombobox options={customerOpts} value={customerId} onChange={setCustomerId}
                    placeholder={isAr ? 'بحث في قاعدة العملاء…' : 'Search CRM customers…'} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                    {isAr ? 'اختياري — مطلوب فقط عند إصدار الفاتورة' : 'Optional — required only when invoicing'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'موبايل / واتساب' : 'Mobile / WhatsApp'}</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input className="input" type="tel" style={{ flex: 1 }} value={walkInPhone}
                        onChange={e => { setWalkInPhone(e.target.value); setWalkInReturning(false); }}
                        placeholder="+20 1xx xxx xxxx" />
                      <button type="button" className="btn btn-secondary btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        disabled={walkInLookupLoading || walkInPhone.length < 7}
                        onClick={() => lookupWalkInPhone(walkInPhone)}>
                        {walkInLookupLoading ? '…' : (isAr ? 'بحث' : 'Look up')}
                      </button>
                    </div>
                    {walkInReturning && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--success-fg)', marginTop: '0.25rem' }}>
                        ✓ {isAr ? 'عميل متكرر — تم تعبئة الاسم تلقائياً' : 'Returning customer — name pre-filled'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'اسم العميل' : 'Customer Name'}</label>
                    <input className="input" value={walkInName} onChange={e => setWalkInName(e.target.value)}
                      placeholder={isAr ? 'الاسم كاملاً…' : 'Full name…'} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0 }}>
                    {isAr ? 'اكتب الموبايل واضغط "بحث" للتحقق من الزيارات السابقة، أو أدخل الاسم مباشرة لعميل جديد.' : 'Enter the phone and click "Look up" to check for previous visits, or type the name directly for a new customer.'}
                  </p>
                </div>
              )}
            </div>

            {/* ── Order Details ── */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '1rem' }}>{isAr ? 'تفاصيل الأمر' : 'Order Details'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div>
                    <label className="input-label">{isAr ? 'الموقع *' : 'Location *'}</label>
                    <SearchableCombobox options={locationOpts} value={locationId} onChange={setLocationId}
                      placeholder={isAr ? 'اختر موقعاً…' : 'Select location…'} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'نوع الخدمة' : 'Service Type'}</label>
                    <SearchableCombobox options={SERVICE_TYPE_OPTS} value={serviceType} onChange={setServiceType} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'الميكانيكي' : 'Technician'}</label>
                    <SearchableCombobox options={userOpts} value={technicianId} onChange={setTechnicianId}
                      placeholder={isAr ? 'غير معين' : 'Unassigned'} clearable clearLabel={isAr ? 'غير معين' : 'Unassigned'} />
                  </div>
                  <div>
                    <label className="input-label">{isAr ? 'العداد عند الاستلام (كم)' : 'Mileage In (km)'}</label>
                    <NumericInput className="input" min="0" value={mileageIn} onChange={val => setMileageIn(val)} placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="input-label">{isAr ? 'الوصف' : 'Description'}</label>
                  <textarea className="input" style={{ resize: 'vertical', minHeight: 72 }}
                    placeholder={isAr ? 'وصف العمل المطلوب…' : 'Describe the work to be done…'}
                    value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'ملاحظات داخلية' : 'Internal Notes'}</label>
                  <textarea className="input" style={{ resize: 'vertical', minHeight: 56 }}
                    placeholder={isAr ? 'ملاحظات للموظفين فقط…' : 'Staff-only notes…'}
                    value={internalNotes} onChange={e => setInternalNotes(e.target.value)} />
                </div>
              </div>
            </div>

            {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '0.5rem 0' }}>{err}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingBottom: '1rem' }}>
              <Link href="/service" className="btn btn-secondary">{isAr ? 'إلغاء' : 'Cancel'}</Link>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (isAr ? 'جاري الإنشاء…' : 'Creating…') : (isAr ? 'إنشاء الأمر' : 'Create Order')}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
