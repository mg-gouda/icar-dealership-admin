'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import { useLang } from '../../../../lib/lang-context';
import { fmtDate } from '@/lib/fmt';

interface POLine { id: string; description: string; quantity: number; unitCost: number; vehicle?: { make: string; model: string; year: number; vin: string }; }
interface Receipt { id: string; receiptDate: string; lines: { id: string; purchaseOrderLineId: string; quantityReceived: number; }[]; }
interface PO {
  id: string; status: string; orderDate: string; expectedDate?: string; total: number;
  partner: { name: string }; location: { name: string };
  lines: POLine[];
  receipts: Receipt[];
}

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
};

export default function PODetailPage() {
  const { isAr } = useLang();
  const { id } = useParams<{ id: string }>();
  const { data: po, loading, reload } = useQuery<PO>(`/purchase-orders/${id}`);
  const [acting, setActing] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  async function changeStatus(status: string) {
    setActing(true);
    try { await apiFetch(`/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); reload(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setActing(false); }
  }

  async function receive(e: React.FormEvent) {
    e.preventDefault();
    setActing(true);
    try {
      const lines = Object.entries(receiveQty)
        .filter(([, q]) => Number(q) > 0)
        .map(([purchaseOrderLineId, q]) => ({ purchaseOrderLineId, quantityReceived: Number(q) }));
      if (!lines.length) throw new Error('Enter at least one quantity');
      await apiFetch(`/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify({ lines }) });
      setShowReceive(false); setReceiveQty({}); reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setActing(false); }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (!po) return <div className="p-6 text-red-400 text-sm">Not found.</div>;

  const receivedMap = po.receipts.flatMap((r) => r.lines).reduce<Record<string, number>>((m, l) => {
    m[l.purchaseOrderLineId] = (m[l.purchaseOrderLineId] ?? 0) + Number(l.quantityReceived);
    return m;
  }, {});

  const canReceive = ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status);
  const transitions = TRANSITIONS[po.status] ?? [];

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/purchase-orders" className="text-gray-500 hover:text-white text-xs transition">{isAr ? '← أوامر الشراء' : '← Purchase Orders'}</Link>
        <h1 className="text-lg font-semibold text-white">{isAr ? 'أمر الشراء —' : 'PO —'} {po.partner.name}</h1>
        <StatusBadge status={po.status} />
      </div>

      {/* Actions */}
      {(transitions.length > 0 || canReceive) && (
        <div className="flex gap-2 mb-6">
          {transitions.map((s) => (
            <button key={s} disabled={acting} onClick={() => changeStatus(s)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition disabled:opacity-50 ${s === 'CANCELLED' ? 'text-red-400 border border-red-400/30 hover:bg-red-400/10' : 'text-white bg-blue-600 hover:bg-blue-500'}`}>
              Mark {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
          {canReceive && (
            <button onClick={() => setShowReceive(true)}
              className="px-4 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition">
              {isAr ? 'استلام البضائع' : 'Receive Goods'}
            </button>
          )}
        </div>
      )}

      {/* Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{isAr ? 'الأمر' : 'Order'}</p>
          <Row label={isAr ? 'المورد' : 'Vendor'} value={po.partner.name} />
          <Row label={isAr ? 'الفرع' : 'Location'} value={po.location.name} />
          <Row label={isAr ? 'تاريخ الأمر' : 'Order Date'} value={fmtDate(po.orderDate, isAr)} />
          <Row label={isAr ? 'التسليم المتوقع' : 'Expected'} value={po.expectedDate ? fmtDate(po.expectedDate, isAr) : '—'} />
          <Row label={isAr ? 'الإجمالي' : 'Total'} value={`${Number(po.total).toLocaleString()} EGP`} />
        </div>
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{isAr ? `إيصالات الاستلام (${po.receipts.length})` : `Receipts (${po.receipts.length})`}</p>
          {po.receipts.length === 0
            ? <p className="text-gray-600 text-xs">{isAr ? 'لا توجد إيصالات بعد.' : 'No receipts yet.'}</p>
            : po.receipts.map((r) => (
              <div key={r.id} className="text-xs text-gray-400 py-1 border-b border-white/5 last:border-0">
                {fmtDate(r.receiptDate, isAr)} · {r.lines.length} lines
              </div>
            ))
          }
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
        <p className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/5">{isAr ? 'بنود الأمر' : 'Lines'}</p>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 border-b border-white/5">
            <tr>
              <th className="px-4 py-2 text-left font-medium">{isAr ? 'الوصف' : 'Description'}</th>
              <th className="px-4 py-2 text-left font-medium">{isAr ? 'السيارة' : 'Vehicle'}</th>
              <th className="px-4 py-2 text-right font-medium">{isAr ? 'الكمية' : 'Qty'}</th>
              <th className="px-4 py-2 text-right font-medium">{isAr ? 'سعر الوحدة' : 'Unit Cost'}</th>
              <th className="px-4 py-2 text-right font-medium">{isAr ? 'إجمالي البند' : 'Line Total'}</th>
              <th className="px-4 py-2 text-right font-medium">{isAr ? 'المستلم' : 'Received'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {po.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 text-white text-xs">{l.description}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {l.vehicle ? `${l.vehicle.year} ${l.vehicle.make} ${l.vehicle.model}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400 text-xs">{Number(l.quantity)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400 text-xs">{Number(l.unitCost).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white text-xs">{(Number(l.quantity) * Number(l.unitCost)).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                  <span className={(receivedMap[l.id] ?? 0) >= Number(l.quantity) ? 'text-green-400' : 'text-amber-400'}>
                    {receivedMap[l.id] ?? 0} / {Number(l.quantity)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Receive dialog */}
      {showReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReceive(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">{isAr ? 'استلام البضائع' : 'Receive Goods'}</h2>
            <form onSubmit={receive} className="space-y-3">
              {po.lines.map((l) => {
                const alreadyRcvd = receivedMap[l.id] ?? 0;
                const remaining = Number(l.quantity) - alreadyRcvd;
                if (remaining <= 0) return null;
                return (
                  <div key={l.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{l.description}</p>
                      <p className="text-xs text-gray-500">{isAr ? `${remaining} متبقي` : `${remaining} remaining`}</p>
                    </div>
                    <input type="number" min="0" max={remaining} step="0.01"
                      value={receiveQty[l.id] ?? ''} onChange={(e) => setReceiveQty({ ...receiveQty, [l.id]: e.target.value })}
                      placeholder="0"
                      className="w-24 px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white text-right focus:outline-none focus:border-blue-500" />
                  </div>
                );
              })}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowReceive(false)}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={acting}
                  className="flex-1 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg transition">
                  {acting ? '…' : (isAr ? 'تأكيد الاستلام' : 'Confirm Receipt')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-white">{value}</span>
    </div>
  );
}
