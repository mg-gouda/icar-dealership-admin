'use client';

import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import NumericInput from '../../../../components/ui/NumericInput';
import { useLang } from '../../../../lib/lang-context';
import { fmtDate } from '@/lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

type Direction = 'OUTGOING' | 'INCOMING';
type Status = 'ISSUED' | 'CLEARED' | 'BOUNCED' | 'CANCELLED';

interface ChequeAllocation {
  id: string;
  amount: number;
  memo?: string;
  purchaseOrderId?: string;
  purchaseOrder?: { id: string; orderDate: string; partner: { name: string } };
  invoiceId?: string;
  invoice?: { id: string; number?: string };
}

interface Cheque {
  id: string;
  chequeNumber: string;
  direction: Direction;
  status: Status;
  amount: number;
  currency: string;
  payeePayor: string;
  issueDate: string;
  dueDate?: string;
  clearedDate?: string;
  memo?: string;
  partner?: { id: string; name: string };
  location: { id: string; name: string };
  bankAccount: { id: string; name: string; bankName?: string };
  allocations: ChequeAllocation[];
  _count?: { allocations: number };
}

interface Partner { id: string; name: string; }
interface BankAccount { id: string; name: string; bankName?: string; }
interface PurchaseOrder { id: string; orderDate: string; total: number; depositRequired?: number; partner: { name: string }; }
interface Location { id: string; name: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const egp = (n: number) => `EGP ${Number(n).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusBadge(s: Status) {
  const m: Record<Status, string> = {
    ISSUED: 'badge badge-info',
    CLEARED: 'badge badge-success',
    BOUNCED: 'badge badge-danger',
    CANCELLED: 'badge badge-neutral',
  };
  return m[s] ?? 'badge badge-neutral';
}

function statusLabel(s: Status, isAr: boolean) {
  const en: Record<Status, string> = { ISSUED: 'Issued', CLEARED: 'Cleared', BOUNCED: 'Bounced', CANCELLED: 'Cancelled' };
  const ar: Record<Status, string> = { ISSUED: 'صادر', CLEARED: 'مُقاص', BOUNCED: 'مرتجع', CANCELLED: 'ملغى' };
  return isAr ? ar[s] : en[s];
}

function dirLabel(d: Direction, isAr: boolean) {
  return d === 'OUTGOING'
    ? (isAr ? 'صادر (ندفع)' : 'Outgoing (we pay)')
    : (isAr ? 'وارد (نستلم)' : 'Incoming (we receive)');
}

const BLANK_ALLOC = { amount: '', purchaseOrderId: '', invoiceId: '', memo: '' };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChequesPage() {
  const { isAr } = useLang();

  // filters
  const [tab, setTab] = useState<'ALL' | 'OUTGOING' | 'INCOMING'>('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // detail drawer
  const [selected, setSelected] = useState<Cheque | null>(null);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createDir, setCreateDir] = useState<Direction>('OUTGOING');
  const [form, setForm] = useState({
    locationId: '', chequeNumber: '', amount: '', currency: 'EGP',
    bankAccountId: '', partnerId: '', payeePayor: '', issueDate: '', dueDate: '', memo: '',
  });
  const [allocs, setAllocs] = useState<typeof BLANK_ALLOC[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // status update modal
  const [showStatus, setShowStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<Status>('CLEARED');
  const [clearedDate, setClearedDate] = useState('');

  // add allocation modal
  const [showAddAlloc, setShowAddAlloc] = useState(false);
  const [newAlloc, setNewAlloc] = useState({ amount: '', purchaseOrderId: '', invoiceId: '', memo: '' });

  // ── Queries ──
  const qStr = [
    tab !== 'ALL' ? `direction=${tab}` : '',
    statusFilter ? `status=${statusFilter}` : '',
    search ? `q=${encodeURIComponent(search)}` : '',
    'limit=100',
  ].filter(Boolean).join('&');
  const { data: raw, loading, reload } = useQuery<{ items: Cheque[]; total: number }>(`/v1/cheques?${qStr}`, [tab, statusFilter, search]);
  const cheques = raw?.items ?? [];

  const { data: partners } = useQuery<Partner[]>('/partners?limit=200');
  const { data: bankAccounts } = useQuery<BankAccount[]>('/finance/bank-statements/bank-accounts');
  const { data: locations } = useQuery<Location[]>('/locations');
  const { data: purchaseOrders } = useQuery<{ items: PurchaseOrder[] }>('/v1/purchase-orders?limit=200');

  const partnerOpts = (partners ?? []).map(p => ({ value: p.id, label: p.name }));
  const bankOpts = (bankAccounts ?? []).map(b => ({ value: b.id, label: `${b.name}${b.bankName ? ` — ${b.bankName}` : ''}` }));
  const locOpts = (locations ?? []).map(l => ({ value: l.id, label: l.name }));
  const poOpts = (purchaseOrders?.items ?? []).map(po => ({
    value: po.id,
    label: `PO ${po.id.slice(-6).toUpperCase()} — ${po.partner.name} — ${egp(po.total)}`,
  }));

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  // ── Create ──
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.locationId || !form.chequeNumber || !form.amount || !form.bankAccountId || !form.payeePayor || !form.issueDate) {
      setErr(isAr ? 'يرجى تعبئة جميع الحقول الإلزامية' : 'Fill all required fields'); return;
    }
    setSaving(true); setErr('');
    try {
      const validAllocs = allocs.filter(a => a.amount && Number(a.amount) > 0);
      await apiFetch('/v1/cheques', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          direction: createDir,
          amount: Number(form.amount),
          dueDate: form.dueDate || undefined,
          partnerId: form.partnerId || undefined,
          allocations: validAllocs.map(a => ({
            amount: Number(a.amount),
            purchaseOrderId: a.purchaseOrderId || undefined,
            invoiceId: a.invoiceId || undefined,
            memo: a.memo || undefined,
          })),
        }),
      });
      setShowCreate(false);
      resetCreate();
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  function resetCreate() {
    setForm({ locationId: '', chequeNumber: '', amount: '', currency: 'EGP', bankAccountId: '', partnerId: '', payeePayor: '', issueDate: '', dueDate: '', memo: '' });
    setAllocs([]); setErr('');
  }

  // ── Status update ──
  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true); setErr('');
    try {
      const updated = await apiFetch(`/v1/cheques/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, clearedDate: clearedDate || undefined }),
      });
      setSelected({ ...selected, ...(updated as Partial<Cheque>) });
      setShowStatus(false);
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  // ── Add allocation ──
  async function handleAddAlloc(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newAlloc.amount) return;
    setSaving(true); setErr('');
    try {
      await apiFetch(`/v1/cheques/${selected.id}/allocations`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(newAlloc.amount),
          purchaseOrderId: newAlloc.purchaseOrderId || undefined,
          invoiceId: newAlloc.invoiceId || undefined,
          memo: newAlloc.memo || undefined,
        }),
      });
      setShowAddAlloc(false);
      setNewAlloc({ amount: '', purchaseOrderId: '', invoiceId: '', memo: '' });
      // refresh selected
      const refreshed = await apiFetch(`/v1/cheques/${selected.id}`) as Cheque;
      setSelected(refreshed);
      reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function removeAlloc(allocId: string) {
    if (!selected) return;
    await apiFetch(`/v1/cheques/allocations/${allocId}`, { method: 'DELETE' });
    const refreshed = await apiFetch(`/v1/cheques/${selected.id}`) as Cheque;
    setSelected(refreshed);
    reload();
  }

  const allocated = (c: Cheque) => c.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const remaining = (c: Cheque) => Number(c.amount) - allocated(c);

  // ── Next allowed statuses ──
  const nextStatuses: Record<Status, Status[]> = {
    ISSUED: ['CLEARED', 'BOUNCED', 'CANCELLED'],
    CLEARED: [],
    BOUNCED: ['CANCELLED'],
    CANCELLED: [],
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-1)' }}>{isAr ? 'سجل الشيكات' : 'Cheque Register'}</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>
            {isAr ? 'تتبع الشيكات الصادرة والواردة وربطها بأوامر الشراء أو الفواتير' : 'Track outgoing & incoming cheques and allocate them to Purchase Orders or Invoices'}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(true); resetCreate(); }}>
          {isAr ? '+ شيك جديد' : '+ New Cheque'}
        </button>
      </div>

      {/* Tabs + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Direction tabs */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['ALL', 'OUTGOING', 'INCOMING'] as const).map(d => (
            <button key={d} onClick={() => setTab(d)}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: tab === d ? 600 : 400,
                background: tab === d ? 'var(--surface)' : 'transparent', color: tab === d ? 'var(--text-1)' : 'var(--text-3)',
                boxShadow: tab === d ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
              {d === 'ALL' ? (isAr ? 'الكل' : 'All') : d === 'OUTGOING' ? (isAr ? 'صادر' : 'Outgoing') : (isAr ? 'وارد' : 'Incoming')}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select className="input" style={{ width: 140, fontSize: '0.8rem', height: '2rem', padding: '0 0.5rem' }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="ISSUED">{isAr ? 'صادر' : 'Issued'}</option>
          <option value="CLEARED">{isAr ? 'مُقاص' : 'Cleared'}</option>
          <option value="BOUNCED">{isAr ? 'مرتجع' : 'Bounced'}</option>
          <option value="CANCELLED">{isAr ? 'ملغى' : 'Cancelled'}</option>
        </select>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <svg style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input className="input" style={{ paddingLeft: '2rem', fontSize: '0.8rem', height: '2rem' }}
            placeholder={isAr ? 'بحث رقم شيك أو مستفيد…' : 'Search cheque # or payee…'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
          {loading ? '…' : `${cheques.length} ${isAr ? 'شيك' : 'cheques'}`}
        </span>
      </div>

      {/* Main layout: list + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: '1.25rem', flex: 1, minHeight: 0 }}>

        {/* Cheques list */}
        <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>Loading…</div>
            )}
            {!loading && cheques.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>
                {isAr ? 'لا توجد شيكات' : 'No cheques found'}
              </div>
            )}
            {cheques.map(c => {
              const alloc = allocated(c);
              const rem = Number(c.amount) - alloc;
              const isSelected = selected?.id === c.id;
              return (
                <div key={c.id} onClick={() => setSelected(isSelected ? null : c)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: isSelected ? 'color-mix(in srgb, var(--primary) 7%, transparent)' : undefined }}>

                  {/* Direction indicator */}
                  <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: c.direction === 'OUTGOING' ? 'color-mix(in srgb,var(--danger) 12%,transparent)' : 'color-mix(in srgb,var(--success) 12%,transparent)',
                    color: c.direction === 'OUTGOING' ? 'var(--danger)' : 'var(--success)', fontSize: '1rem' }}>
                    {c.direction === 'OUTGOING' ? '↑' : '↓'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-1)' }}>
                        {isAr ? 'شيك#' : 'CHQ#'}{c.chequeNumber}
                      </span>
                      <span className={statusBadge(c.status)}>{statusLabel(c.status, isAr)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.15rem' }}>
                      {c.payeePayor} · {c.bankAccount.name}{c.bankAccount.bankName ? ` (${c.bankAccount.bankName})` : ''} · {fmtDate(c.issueDate, isAr)}
                    </div>
                    {c.allocations.length > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>
                        {isAr ? `مخصص: ${egp(alloc)} من ${egp(Number(c.amount))}` : `Allocated: ${egp(alloc)} of ${egp(Number(c.amount))}`}
                        {rem > 0.005 && <span style={{ color: 'var(--warning)', marginLeft: 6 }}>· {isAr ? `متبقي ${egp(rem)}` : `${egp(rem)} unallocated`}</span>}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: c.direction === 'OUTGOING' ? 'var(--danger)' : 'var(--success)' }}>
                      {c.direction === 'OUTGOING' ? '-' : '+'}{egp(Number(c.amount))}
                    </div>
                    {c.dueDate && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>
                        {isAr ? 'استحقاق' : 'Due'}: {fmtDate(c.dueDate, isAr)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-1)' }}>
                  {isAr ? 'شيك#' : 'CHQ#'}{selected.chequeNumber}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{dirLabel(selected.direction, isAr)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.25rem' }}>×</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Status + action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={statusBadge(selected.status)}>{statusLabel(selected.status, isAr)}</span>
                {nextStatuses[selected.status].length > 0 && (
                  <button className="btn btn-sm" style={{ fontSize: '0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                    onClick={() => { setNewStatus(nextStatuses[selected.status][0]); setClearedDate(''); setErr(''); setShowStatus(true); }}>
                    {isAr ? 'تحديث الحالة' : 'Update Status'}
                  </button>
                )}
              </div>

              {/* Info rows */}
              {[
                [isAr ? 'المبلغ' : 'Amount', <span style={{ fontWeight: 700, color: selected.direction === 'OUTGOING' ? 'var(--danger)' : 'var(--success)' }}>{egp(Number(selected.amount))} {selected.currency}</span>],
                [isAr ? 'المستفيد / الدافع' : 'Payee / Payor', selected.payeePayor],
                [isAr ? 'الشريك' : 'Partner', selected.partner?.name ?? '—'],
                [isAr ? 'الحساب البنكي' : 'Bank Account', `${selected.bankAccount.name}${selected.bankAccount.bankName ? ` (${selected.bankAccount.bankName})` : ''}`],
                [isAr ? 'الموقع' : 'Location', selected.location.name],
                [isAr ? 'تاريخ الإصدار' : 'Issue Date', fmtDate(selected.issueDate, isAr)],
                [isAr ? 'تاريخ الاستحقاق' : 'Due Date', selected.dueDate ? fmtDate(selected.dueDate, isAr) : '—'],
                [isAr ? 'تاريخ المقاصة' : 'Cleared Date', selected.clearedDate ? fmtDate(selected.clearedDate, isAr) : '—'],
                [isAr ? 'ملاحظات' : 'Memo', selected.memo ?? '—'],
              ].map(([label, value], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{label as string}</span>
                  <span style={{ color: 'var(--text-1)', textAlign: 'right' }}>{value as React.ReactNode}</span>
                </div>
              ))}

              {/* Allocation summary bar */}
              {(() => {
                const alloc = allocated(selected);
                const rem = Number(selected.amount) - alloc;
                const pct = Math.min(100, (alloc / Number(selected.amount)) * 100);
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 4 }}>
                      <span>{isAr ? 'المخصص' : 'Allocated'}: {egp(alloc)}</span>
                      <span>{isAr ? 'متبقي' : 'Remaining'}: {egp(Math.max(0, rem))}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: pct >= 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })()}

              {/* Allocations list */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isAr ? 'التخصيصات' : 'Allocations'}
                  </span>
                  {selected.status === 'ISSUED' && (
                    <button className="btn btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      onClick={() => { setNewAlloc({ amount: '', purchaseOrderId: '', invoiceId: '', memo: '' }); setErr(''); setShowAddAlloc(true); }}>
                      {isAr ? '+ تخصيص' : '+ Allocate'}
                    </button>
                  )}
                </div>
                {selected.allocations.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem', background: 'var(--surface-2)', borderRadius: 6 }}>
                    {isAr ? 'لا توجد تخصيصات بعد' : 'No allocations yet'}
                  </div>
                )}
                {selected.allocations.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0.5rem 0.625rem', background: 'var(--surface-2)', borderRadius: 6, marginBottom: '0.375rem', gap: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {a.purchaseOrder && (
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-1)' }}>
                          {isAr ? 'أمر شراء' : 'PO'} — {a.purchaseOrder.partner.name}
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginLeft: 4 }}>{fmtDate(a.purchaseOrder.orderDate, isAr)}</span>
                        </div>
                      )}
                      {a.invoice && (
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-1)' }}>
                          {isAr ? 'فاتورة' : 'Invoice'} #{a.invoice.number ?? a.invoice.id.slice(-6)}
                        </div>
                      )}
                      {!a.purchaseOrder && !a.invoice && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{isAr ? 'تخصيص عام' : 'General allocation'}</div>
                      )}
                      {a.memo && <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{a.memo}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-1)' }}>{egp(Number(a.amount))}</span>
                      {selected.status === 'ISSUED' && (
                        <button onClick={() => removeAlloc(a.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.9rem', lineHeight: 1, padding: '0.1rem 0.25rem' }}>×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Cheque Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setShowCreate(false)} />
          <div className="relative card shadow-2xl" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{isAr ? 'شيك جديد' : 'New Cheque'}</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '1.4rem' }}>×</button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Direction toggle */}
              <div>
                <label className="input-label">{isAr ? 'نوع الشيك *' : 'Direction *'}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['OUTGOING', 'INCOMING'] as Direction[]).map(d => (
                    <button key={d} type="button" onClick={() => setCreateDir(d)}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: `2px solid ${createDir === d ? (d === 'OUTGOING' ? 'var(--danger)' : 'var(--success)') : 'var(--border)'}`,
                        background: createDir === d ? (d === 'OUTGOING' ? 'color-mix(in srgb,var(--danger) 10%,transparent)' : 'color-mix(in srgb,var(--success) 10%,transparent)') : 'var(--surface-2)',
                        color: createDir === d ? (d === 'OUTGOING' ? 'var(--danger)' : 'var(--success)') : 'var(--text-2)',
                        fontWeight: createDir === d ? 600 : 400, fontSize: '0.8rem', cursor: 'pointer' }}>
                      {d === 'OUTGOING' ? (isAr ? '↑ صادر (ندفع)' : '↑ Outgoing (we pay)') : (isAr ? '↓ وارد (نستلم)' : '↓ Incoming (we receive)')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Two-col grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="input-label">{isAr ? 'رقم الشيك *' : 'Cheque Number *'}</label>
                  <input className="input" required value={form.chequeNumber} onChange={e => setF('chequeNumber', e.target.value)} placeholder="e.g. 001234" />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'المبلغ *' : 'Amount *'}</label>
                  <NumericInput className="input" min="0.01" step="0.01" value={form.amount} onChange={val => setF('amount', val)} placeholder="0.00" />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'تاريخ الإصدار *' : 'Issue Date *'}</label>
                  <input className="input" type="date" required value={form.issueDate} onChange={e => setF('issueDate', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                  <input className="input" type="date" value={form.dueDate} onChange={e => setF('dueDate', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="input-label">{isAr ? 'الحساب البنكي *' : 'Bank Account *'}</label>
                <SearchableCombobox options={bankOpts} value={form.bankAccountId} onChange={v => setF('bankAccountId', v)}
                  placeholder={isAr ? 'اختر حساباً بنكياً…' : 'Select bank account…'} />
              </div>

              <div>
                <label className="input-label">{isAr ? 'الموقع *' : 'Location *'}</label>
                <SearchableCombobox options={locOpts} value={form.locationId} onChange={v => setF('locationId', v)}
                  placeholder={isAr ? 'اختر موقعاً…' : 'Select location…'} />
              </div>

              <div>
                <label className="input-label">{isAr ? (createDir === 'OUTGOING' ? 'المستفيد *' : 'الدافع *') : (createDir === 'OUTGOING' ? 'Payee *' : 'Payor *')}</label>
                <input className="input" required value={form.payeePayor} onChange={e => setF('payeePayor', e.target.value)}
                  placeholder={isAr ? 'الاسم كما هو مكتوب على الشيك' : 'Name as written on cheque'} />
              </div>

              <div>
                <label className="input-label">{isAr ? 'الشريك (اختياري)' : 'Partner (optional)'}</label>
                <SearchableCombobox options={partnerOpts} value={form.partnerId} onChange={v => setF('partnerId', v)}
                  placeholder={isAr ? 'ربط بمورد أو عميل…' : 'Link to supplier or customer…'} />
              </div>

              <div>
                <label className="input-label">{isAr ? 'ملاحظات' : 'Memo'}</label>
                <input className="input" value={form.memo} onChange={e => setF('memo', e.target.value)} placeholder={isAr ? 'ملاحظة اختيارية…' : 'Optional note…'} />
              </div>

              {/* Allocations (outgoing → POs) */}
              {createDir === 'OUTGOING' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="input-label" style={{ marginBottom: 0 }}>{isAr ? 'تخصيص لأوامر الشراء (اختياري)' : 'Allocate to Purchase Orders (optional)'}</label>
                    <button type="button" className="btn btn-sm" style={{ fontSize: '0.7rem', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      onClick={() => setAllocs(a => [...a, { ...BLANK_ALLOC }])}>
                      {isAr ? '+ إضافة' : '+ Add'}
                    </button>
                  </div>
                  {allocs.map((a, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'start' }}>
                      <SearchableCombobox options={poOpts} value={a.purchaseOrderId}
                        onChange={v => setAllocs(arr => arr.map((x, j) => j === i ? { ...x, purchaseOrderId: v } : x))}
                        placeholder={isAr ? 'اختر أمر شراء…' : 'Select PO…'} />
                      <NumericInput className="input" min="0.01" step="0.01" style={{ width: 110 }}
                        value={a.amount} placeholder={isAr ? 'المبلغ' : 'Amount'}
                        onChange={val => setAllocs(arr => arr.map((x, j) => j === i ? { ...x, amount: val } : x))} />
                      <button type="button" onClick={() => setAllocs(arr => arr.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1.1rem', padding: '0.35rem' }}>×</button>
                    </div>
                  ))}
                  {allocs.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                      {isAr ? `إجمالي التخصيص: ${egp(allocs.reduce((s, a) => s + (Number(a.amount) || 0), 0))}` : `Total allocated: ${egp(allocs.reduce((s, a) => s + (Number(a.amount) || 0), 0))}`}
                    </div>
                  )}
                </div>
              )}

              {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : isAr ? 'حفظ الشيك' : 'Save Cheque'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Update Status Modal ── */}
      {showStatus && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setShowStatus(false)} />
          <div className="relative card shadow-2xl" style={{ maxWidth: 400, width: '100%', background: 'var(--surface)', zIndex: 10 }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{isAr ? 'تحديث حالة الشيك' : 'Update Cheque Status'}</h3>
            </div>
            <form onSubmit={handleStatusUpdate} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'الحالة الجديدة *' : 'New Status *'}</label>
                <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value as Status)}>
                  {nextStatuses[selected.status].map(s => (
                    <option key={s} value={s}>{statusLabel(s, isAr)}</option>
                  ))}
                </select>
              </div>
              {newStatus === 'CLEARED' && (
                <div>
                  <label className="input-label">{isAr ? 'تاريخ المقاصة' : 'Cleared Date'}</label>
                  <input className="input" type="date" value={clearedDate} onChange={e => setClearedDate(e.target.value)} />
                </div>
              )}
              {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStatus(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : isAr ? 'تحديث' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Allocation Modal ── */}
      {showAddAlloc && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddAlloc(false)} />
          <div className="relative card shadow-2xl" style={{ maxWidth: 440, width: '100%', background: 'var(--surface)', zIndex: 10 }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                {isAr ? `تخصيص جزء من الشيك#${selected.chequeNumber}` : `Allocate from CHQ#${selected.chequeNumber}`}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
                {isAr ? `متاح: ${egp(Math.max(0, Number(selected.amount) - allocated(selected)))}` : `Available: ${egp(Math.max(0, Number(selected.amount) - allocated(selected)))}`}
              </p>
            </div>
            <form onSubmit={handleAddAlloc} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="input-label">{isAr ? 'المبلغ *' : 'Amount *'}</label>
                <NumericInput className="input" min="0.01" step="0.01" value={newAlloc.amount}
                  onChange={val => setNewAlloc(a => ({ ...a, amount: val }))} placeholder="0.00" />
              </div>
              <div>
                <label className="input-label">{isAr ? 'أمر شراء (اختياري)' : 'Purchase Order (optional)'}</label>
                <SearchableCombobox options={poOpts} value={newAlloc.purchaseOrderId}
                  onChange={v => setNewAlloc(a => ({ ...a, purchaseOrderId: v }))}
                  placeholder={isAr ? 'اختر أمر شراء…' : 'Select PO…'} />
              </div>
              <div>
                <label className="input-label">{isAr ? 'ملاحظة' : 'Memo'}</label>
                <input className="input" value={newAlloc.memo}
                  onChange={e => setNewAlloc(a => ({ ...a, memo: e.target.value }))}
                  placeholder={isAr ? 'وصف اختياري…' : 'Optional description…'} />
              </div>
              {err && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddAlloc(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : isAr ? 'تخصيص' : 'Allocate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
