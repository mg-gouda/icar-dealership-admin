'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
const token = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
const fmt = (n: number) => 'EGP ' + n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

interface Deal {
  id: string; dealNumber?: string;
  customer: { name: string };
  vehicle: { make: string; model: string; year: number };
  salesRep?: { name: string };
  salePrice: number; adminFee?: number; insuranceFee?: number;
  paymentMethod: string; purchaseMethod?: string;
  status: string; createdAt: string;
}

const STATUS_TABS = [
  { key: '',                label: 'All Deals' },
  { key: 'DRAFT',          label: 'Draft' },
  { key: 'PENDING_FINANCE',label: 'Pending Finance' },
  { key: 'APPROVED',       label: 'Approved' },
  { key: 'FINALIZED',      label: 'Finalized' },
  { key: 'CANCELLED',      label: 'Cancelled' },
];

function statusBadgeClass(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'badge-neutral', PENDING_FINANCE: 'badge-warning',
    APPROVED: 'badge-success', FINALIZED: 'badge-success',
    CANCELLED: 'badge-danger',
  };
  return map[s] ?? 'badge-neutral';
}

function methodBadgeClass(m: string): string {
  const map: Record<string, string> = {
    BANK_FINANCING: 'badge-info', CASH: 'badge-success',
    DEALERSHIP_INSTALLMENT: 'badge-purple',
  };
  return map[m] ?? 'badge-neutral';
}

function methodLabel(m: string): string {
  const map: Record<string, string> = {
    BANK_FINANCING: 'Bank Financing', CASH: 'Cash', DEALERSHIP_INSTALLMENT: 'Installment',
  };
  return map[m] ?? m.replace(/_/g, ' ');
}

const AVATAR_COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--purple)', 'var(--orange)', 'var(--danger)'];
function avatarColor(name: string) { const c = name.charCodeAt(0) + (name.charCodeAt(1) || 0); return AVATAR_COLORS[c % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

export default function DealsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '200' });
      if (activeTab) qs.set('status', activeTab);
      const res = await fetch(`${API}/deals?${qs}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setDeals(Array.isArray(json) ? json : (json.data ?? []));
    } catch { setDeals([]); }
    finally { setLoading(false); }
  }, [activeTab]);

  // Load all to get counts
  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/deals?limit=500`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      const all: Deal[] = Array.isArray(json) ? json : (json.data ?? []);
      const c: Record<string, number> = {};
      all.forEach((d) => { c[d.status] = (c[d.status] ?? 0) + 1; });
      setCounts(c);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const totalValue = deals.reduce((s, d) => s + Number(d.salePrice ?? 0), 0);
  const thisMonth = new Date().toLocaleString('en-EG', { month: 'long', year: 'numeric' });

  function dealNumber(d: Deal): string {
    if (d.dealNumber) return `#${d.dealNumber}`;
    return `#${d.id.slice(-4).toUpperCase()}`;
  }

  const method = (d: Deal) => d.paymentMethod ?? d.purchaseMethod ?? '';

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Deals Pipeline</h1>
          <p className="page-subtitle">
            {Object.values(counts).reduce((a, b) => a + b, 0)} deals this month · {fmt(totalValue)} total value
          </p>
        </div>
        <Link href="/deals/new" className="btn btn-primary">+ New Deal</Link>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '0 1.5rem' }}>
        <div className="tabs" style={{ marginTop: '1rem' }}>
          {STATUS_TABS.map((t) => {
            const count = t.key ? (counts[t.key] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
            return (
              <button
                key={t.key}
                className={`tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="page-body">
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Deal #</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Sales Rep</th>
                  <th style={{ textAlign: 'right' }}>Sale Price</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const custName = d.customer?.name ?? '—';
                  const m = method(d);
                  return (
                    <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/deals/${d.id}`)}>
                      <td>
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{dealNumber(d)}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="avatar" style={{ width: '1.75rem', height: '1.75rem', background: avatarColor(custName), color: '#fff', fontSize: '0.625rem', flexShrink: 0 }}>
                            {initials(custName)}
                          </span>
                          <span style={{ fontWeight: 500 }}>{custName}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>
                        {d.vehicle ? `${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}` : '—'}
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{d.salesRep?.name ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                        {fmt(Number(d.salePrice ?? 0))}
                      </td>
                      <td>
                        {m ? <span className={`badge ${methodBadgeClass(m)}`}>{methodLabel(m)}</span> : '—'}
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeClass(d.status)}`}>
                          {d.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {new Date(d.createdAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <Link
                          href={`/deals/${d.id}`}
                          style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '0.75rem', textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {deals.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                      No deals found{activeTab ? ` in "${activeTab.replace(/_/g, ' ')}"` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
