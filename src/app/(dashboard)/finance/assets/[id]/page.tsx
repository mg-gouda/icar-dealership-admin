'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../../lib/useApi';
import StatusBadge from '../../../../../components/StatusBadge';
import SearchableCombobox from '../../../../../components/ui/SearchableCombobox';

interface DepLine {
  id: string; sequence: number; date: string; amount: number;
  accumulatedDepreciation: number; bookValue: number; status: string;
}

interface Asset {
  id: string; name: string; state: string;
  originalValue: number; currentValue: number; salvageValue?: number;
  depreciationMethod: string; durationMonths: number; startDate: string;
  assetAccount?: { code: string; name: string };
  depreciationExpenseAccount?: { code: string; name: string };
  accumulatedDepAccount?: { code: string; name: string };
  depreciationLines: DepLine[];
  _count?: { depreciationLines: number };
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: asset, loading, error, reload } = useQuery<Asset>(`/finance/assets/${id}`);
  const { data: journalsRaw } = useQuery<any[]>('/finance/gl/journals');

  const journals = (Array.isArray(journalsRaw) ? journalsRaw : []).map((j) => ({
    value: j.id, label: `${j.code} — ${j.name}`,
  }));

  const [journalId, setJournalId] = useState('');
  const [posting, setPosting] = useState<string | null>(null);
  const [postAll, setPostAll] = useState(false);

  async function postLine(lineId: string) {
    if (!journalId) { alert('Select a journal first.'); return; }
    setPosting(lineId);
    try {
      await apiFetch(`/finance/assets/${id}/depreciation-lines/${lineId}/post`, {
        method: 'POST',
        body: JSON.stringify({ journalId }),
      });
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPosting(null); }
  }

  async function postAllDue() {
    if (!journalId) { alert('Select a journal first.'); return; }
    const due = asset?.depreciationLines.filter(
      (l) => l.status === 'DRAFT' && new Date(l.date) <= new Date(),
    ) ?? [];
    if (!due.length) { alert('No due depreciation lines to post.'); return; }
    if (!confirm(`Post ${due.length} due depreciation line(s)?`)) return;
    setPostAll(true);
    try {
      for (const l of due) {
        await apiFetch(`/finance/assets/${id}/depreciation-lines/${l.id}/post`, {
          method: 'POST',
          body: JSON.stringify({ journalId }),
        });
      }
      reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPostAll(false); }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">{error}</div>;
  if (!asset) return null;

  const posted = asset.depreciationLines.filter((l) => l.status === 'POSTED').length;
  const due = asset.depreciationLines.filter((l) => l.status === 'DRAFT' && new Date(l.date) <= new Date()).length;
  const total = asset.depreciationLines.length;
  const fmt = (n: number) => Number(n).toLocaleString('en-EG', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-xs mb-5 transition">← Assets</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{asset.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {asset.depreciationMethod.replace(/_/g, ' ')} · {asset.durationMonths} months · from {new Date(asset.startDate).toLocaleDateString('en-EG')}
          </p>
        </div>
        <StatusBadge status={asset.state} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          ['Original Value', `${fmt(asset.originalValue)} EGP`],
          ['Current Book Value', `${fmt(asset.currentValue)} EGP`],
          ['Salvage Value', asset.salvageValue ? `${fmt(asset.salvageValue)} EGP` : '—'],
          ['Progress', `${posted} / ${total} posted`],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-xl border border-white/5 bg-gray-900 p-3">
            <p className="text-xs text-gray-500 mb-1">{label as string}</p>
            <p className="text-white font-medium text-sm">{val as string}</p>
          </div>
        ))}
      </div>

      {/* Accounts */}
      <div className="rounded-xl border border-white/5 bg-gray-900 p-4 mb-4">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">GL Accounts</p>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            ['Asset Account', asset.assetAccount],
            ['Depreciation Expense', asset.depreciationExpenseAccount],
            ['Accumulated Dep.', asset.accumulatedDepAccount],
          ].map(([label, acct]: any) => (
            <div key={label}>
              <p className="text-gray-500 mb-0.5">{label}</p>
              <p className="text-white font-mono">{acct ? `${acct.code} — ${acct.name}` : '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Depreciation schedule + post controls */}
      <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Depreciation Schedule
            {due > 0 && <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">{due} due</span>}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-52">
              <SearchableCombobox options={journals} value={journalId} onChange={setJournalId} placeholder="Select journal…" />
            </div>
            {due > 0 && (
              <button onClick={postAllDue} disabled={postAll || !journalId}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition whitespace-nowrap">
                {postAll ? 'Posting…' : `Post ${due} due`}
              </button>
            )}
          </div>
        </div>

        <table className="w-full text-xs">
          <thead className="text-gray-400 border-b border-white/5">
            <tr>
              <th className="text-left pb-2">#</th>
              <th className="text-left pb-2">Date</th>
              <th className="text-right pb-2">Depreciation</th>
              <th className="text-right pb-2">Accumulated</th>
              <th className="text-right pb-2">Book Value</th>
              <th className="text-left pb-2 pl-3">Status</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {asset.depreciationLines.map((l) => {
              const isDue = l.status === 'DRAFT' && new Date(l.date) <= new Date();
              return (
                <tr key={l.id} className={isDue ? 'bg-amber-900/10' : ''}>
                  <td className="py-1.5 text-gray-400">{l.sequence}</td>
                  <td className="py-1.5 text-gray-300">{new Date(l.date).toLocaleDateString('en-EG')}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{fmt(l.amount)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-300">{fmt(l.accumulatedDepreciation)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-300">{fmt(l.bookValue)}</td>
                  <td className="py-1.5 pl-3"><StatusBadge status={l.status} /></td>
                  <td className="py-1.5 pl-2">
                    {l.status === 'DRAFT' && (
                      <button onClick={() => postLine(l.id)} disabled={posting === l.id || !journalId}
                        className="px-2 py-0.5 text-green-400 border border-green-400/30 hover:bg-green-400/10 rounded disabled:opacity-40 transition">
                        {posting === l.id ? '…' : 'Post'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {asset.depreciationLines.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-gray-600">No schedule generated.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
