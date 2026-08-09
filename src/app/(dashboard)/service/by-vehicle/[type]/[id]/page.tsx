'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, apiFetch } from '../../../../../../lib/useApi';
import { useLang } from '@/lib/lang-context';
import { fmtDate } from '@/lib/fmt';

const fmtAmt = (n: number | string | null | undefined) => {
  const num = Number(n);
  return isNaN(num) || num === 0 ? '—' : 'EGP ' + num.toLocaleString('en-EG', { maximumFractionDigits: 0 });
};

interface ServiceOrder {
  id: string;
  orderNumber?: string;
  status: string;
  serviceType?: string;
  type?: string;
  technician?: { name: string };
  location?: { name: string };
  totalAmount?: number;
  total?: number;
  createdAt: string;
  completedAt?: string;
  lines?: Array<{ description: string; partName?: string; qty: number; unitPrice: number }>;
}

interface VehicleInfo {
  make: string;
  model: string;
  year?: number;
  plate?: string;
  vin?: string;
  color?: string;
  ownerName?: string;
  ownerPhone?: string;
  warrantyMonths?: number;
  saleDate?: string;
  customerName?: string;
}

interface HistoryData {
  orders: ServiceOrder[];
  vehicleInfo: VehicleInfo;
}

interface NextVisit {
  nextVisitDate?: string;
  nextVisitMileage?: number;
  nextVisitNote?: string;
  recommendedService?: string;
}

function statusBadgeClass(s: string) {
  const map: Record<string, string> = {
    INTAKE: 'badge-info', IN_PROGRESS: 'badge-warning',
    COMPLETED: 'badge-success', INVOICED: 'badge-neutral', CANCELLED: 'badge-danger',
  };
  return map[s] ?? 'badge-neutral';
}

function warrantyStatus(info: VehicleInfo): { label: string; color: string; daysLeft: number } | null {
  if (!info.warrantyMonths || !info.saleDate) return null;
  const sold = new Date(info.saleDate);
  const expiry = new Date(sold);
  expiry.setMonth(expiry.getMonth() + info.warrantyMonths);
  const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  if (daysLeft <= 0) return { label: 'Warranty expired', color: 'var(--text-3)', daysLeft };
  if (daysLeft <= 30) return { label: `${daysLeft} days left`, color: 'var(--danger)', daysLeft };
  if (daysLeft <= 90) return { label: `${daysLeft} days left`, color: 'var(--warning)', daysLeft };
  return { label: `${Math.ceil(daysLeft / 30)} months left`, color: 'var(--success)', daysLeft };
}

export default function VehicleServiceDetailPage() {
  const params = useParams<{ type: string; id: string }>();
  const { isAr } = useLang();
  const [activeTab, setActiveTab] = useState<'history' | 'next-visit'>('history');

  const { data: historyData, loading: histLoading } = useQuery<HistoryData>(
    `/service-orders/vehicles/${params.type}/${params.id}/history`,
  );

  const { data: nextVisitData, loading: nvLoading } = useQuery<NextVisit>(
    `/service-orders/vehicles/${params.type}/${params.id}/next-visit`,
  );

  const [nvDate, setNvDate] = useState('');
  const [nvMileage, setNvMileage] = useState('');
  const [nvNote, setNvNote] = useState('');
  const [nvRecommended, setNvRecommended] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (nextVisitData) {
      setNvDate(nextVisitData.nextVisitDate ? nextVisitData.nextVisitDate.slice(0, 10) : '');
      setNvMileage(nextVisitData.nextVisitMileage ? String(nextVisitData.nextVisitMileage) : '');
      setNvNote(nextVisitData.nextVisitNote ?? '');
      setNvRecommended(nextVisitData.recommendedService ?? '');
    }
  }, [nextVisitData]);

  async function saveNextVisit() {
    setSaving(true);
    setSaveMsg('');
    try {
      await apiFetch(`/service-orders/vehicles/${params.type}/${params.id}/next-visit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nextVisitDate: nvDate || null,
          nextVisitMileage: nvMileage ? Number(nvMileage) : null,
          nextVisitNote: nvNote || null,
          recommendedService: nvRecommended || null,
        }),
      });
      setSaveMsg(isAr ? 'تم الحفظ بنجاح' : 'Saved successfully');
    } catch (e: any) {
      setSaveMsg(e?.message ?? (isAr ? 'خطأ في الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  const orders = historyData?.orders ?? [];
  const info = historyData?.vehicleInfo;
  const warranty = info ? warrantyStatus(info) : null;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/service/by-vehicle" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.8rem' }}>
            ← {isAr ? 'السيارات' : 'Vehicles'}
          </Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              {histLoading ? '…' : info ? `${info.year ? `${info.year} ` : ''}${info.make} ${info.model}` : (isAr ? 'سجل السيارة' : 'Vehicle Record')}
            </h1>
            {info && (
              <p className="page-subtitle" style={{ marginTop: 2 }}>
                {info.plate && <span style={{ marginRight: '0.5rem' }}>{info.plate}</span>}
                {info.vin && <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>VIN: {info.vin}</span>}
                {info.ownerName && <span style={{ marginLeft: '0.5rem', color: 'var(--text-2)' }}> · {info.ownerName}</span>}
                {info.customerName && !info.ownerName && <span style={{ marginLeft: '0.5rem', color: 'var(--text-2)' }}> · {info.customerName}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Warranty chip */}
        {warranty && (
          <div style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 8,
            background: `color-mix(in srgb, ${warranty.color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${warranty.color} 30%, transparent)`,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: warranty.color,
          }}>
            🛡 {warranty.label}
          </div>
        )}
        {info?.warrantyMonths && !info.saleDate && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
            {info.warrantyMonths}mo warranty (not yet sold)
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 1.5rem', display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'history' as const,    labelEn: `History (${orders.length})`, labelAr: `السجل (${orders.length})` },
          { key: 'next-visit' as const, labelEn: 'Next Visit',                 labelAr: 'الزيارة القادمة'           },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: activeTab === t.key ? 600 : 400,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--text-2)',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 120ms, border-color 120ms',
            }}
          >
            {isAr ? t.labelAr : t.labelEn}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="page-body">
        {activeTab === 'history' && (
          <>
            {histLoading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>}
            {!histLoading && (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isAr ? 'رقم الأمر' : 'Order #'}</th>
                      <th>{isAr ? 'التاريخ' : 'Date'}</th>
                      <th>{isAr ? 'النوع' : 'Type'}</th>
                      <th>{isAr ? 'الحالة' : 'Status'}</th>
                      <th>{isAr ? 'الفني' : 'Technician'}</th>
                      <th>{isAr ? 'الموقع' : 'Location'}</th>
                      <th style={{ textAlign: 'right' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = `/service/${o.id}`; }}>
                        <td>
                          <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
                            {o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-6).toUpperCase()}`}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {fmtDate(o.createdAt, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                          {(o.type ?? o.serviceType ?? '').replace(/_/g, ' ')}
                        </td>
                        <td>
                          <span className={`badge ${statusBadgeClass(o.status)}`}>
                            {o.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{o.technician?.name ?? '—'}</td>
                        <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{o.location?.name ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                          {fmtAmt(o.totalAmount ?? o.total)}
                        </td>
                        <td>
                          <Link
                            href={`/service/${o.id}`}
                            style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 500, textDecoration: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isAr ? '→ فتح' : 'Open →'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                          {isAr ? 'لا توجد أوامر صيانة لهذه السيارة.' : 'No service orders for this vehicle.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'next-visit' && (
          <div style={{ maxWidth: 560 }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-1)' }}>
                {isAr ? 'الزيارة القادمة المتوقعة' : 'Schedule Next Visit'}
              </h3>

              {nvLoading && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>}
              {!nvLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: '0.375rem' }}>
                      {isAr ? 'تاريخ الزيارة القادمة' : 'Expected Visit Date'}
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={nvDate}
                      onChange={(e) => setNvDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: '0.375rem' }}>
                      {isAr ? 'العداد المتوقع (كم)' : 'Expected Mileage (km)'}
                    </label>
                    <input
                      type="number"
                      className="input"
                      placeholder={isAr ? 'مثال: 15000' : 'e.g. 15000'}
                      value={nvMileage}
                      onChange={(e) => setNvMileage(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: '0.375rem' }}>
                      {isAr ? 'الخدمة الموصى بها' : 'Recommended Service'}
                    </label>
                    <input
                      className="input"
                      placeholder={isAr ? 'مثال: تغيير زيت + فلتر' : 'e.g. Oil change + filter replacement'}
                      value={nvRecommended}
                      onChange={(e) => setNvRecommended(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: '0.375rem' }}>
                      {isAr ? 'ملاحظات' : 'Notes'}
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder={isAr ? 'ملاحظات إضافية…' : 'Any additional notes…'}
                      value={nvNote}
                      onChange={(e) => setNvNote(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
                    <button
                      className="btn btn-primary"
                      onClick={saveNextVisit}
                      disabled={saving}
                    >
                      {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
                    </button>
                    {saveMsg && (
                      <span style={{ fontSize: '0.8125rem', color: saveMsg.includes('fail') || saveMsg.includes('خطأ') ? 'var(--danger)' : 'var(--success)' }}>
                        {saveMsg}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Warranty info card for inventory vehicles */}
            {warranty && (
              <div className="card" style={{ padding: '1rem 1.25rem', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🛡</span>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: warranty.color }}>{warranty.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {isAr ? `ضمان الوكالة: ${info?.warrantyMonths} شهرًا` : `Dealership warranty: ${info?.warrantyMonths} months`}
                    {info?.saleDate && <span> · {isAr ? 'تاريخ البيع' : 'Sold'} {fmtDate(info.saleDate, isAr, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
