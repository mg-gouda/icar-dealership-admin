'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';

interface Activity {
  id: string; type: string; notes: string; outcome?: string;
  createdAt: string; nextFollowUp?: string;
}

interface Lead {
  id: string; name: string; phone?: string; email?: string;
  status: string; source?: string; notes?: string; createdAt: string;
  vehicle?: { make: string; model: string; year: number };
  assignedTo?: { name: string; email?: string };
  location?: { name: string };
  activities?: Activity[];
}

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'VISIT', 'TEST_DRIVE', 'FOLLOW_UP', 'NOTE'];

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: lead, loading, error, reload } = useQuery<Lead>(`/leads/${id}`);
  const [activityForm, setActivityForm] = useState({ type: 'CALL', notes: '', outcome: '' });
  const [saving, setSaving] = useState(false);

  async function addActivity() {
    if (!activityForm.notes.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/leads/${id}/activities`, {
        method: 'POST',
        body: JSON.stringify(activityForm),
      });
      setActivityForm({ type: 'CALL', notes: '', outcome: '' });
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: string) {
    await apiFetch(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    reload();
  }

  async function convertToDeal() {
    if (!confirm('Convert this lead to a deal? This will mark the lead CLOSED_WON and create a draft deal.')) return;
    setConverting(true);
    try {
      const deal = await apiFetch<{ id: string }>(`/leads/${id}/convert`, { method: 'PATCH' });
      router.push(`/deals/${deal.id}`);
    } catch (e: any) { alert(e.message); }
    finally { setConverting(false); }
  }

  const [converting, setConverting] = useState(false);

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">{error}</div>;
  if (!lead) return null;

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-xs mb-5 transition">← Back</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{lead.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{lead.phone} {lead.email && `· ${lead.email}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={lead.status} />
          {['QUALIFIED', 'NEGOTIATING'].includes(lead.status) && (
            <button onClick={convertToDeal} disabled={converting}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg transition">
              {converting ? '…' : 'Convert to Deal →'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-2">Interest</p>
          <p className="text-white text-sm">{lead.vehicle ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}` : '—'}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-2">Source</p>
          <p className="text-white text-sm">{lead.source ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-2">Assigned To</p>
          <p className="text-white text-sm">{lead.assignedTo?.name ?? '—'}</p>
        </div>
      </div>

      {/* Quick status buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'CLOSED_WON', 'CLOSED_LOST'].map((s) => (
          <button key={s} onClick={() => updateStatus(s)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition ${
              lead.status === s
                ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
            }`}>{s.replace(/_/g, ' ')}</button>
        ))}
      </div>

      {/* Log activity */}
      <div className="rounded-xl border border-white/5 bg-gray-900 p-4 mb-6">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Log Activity</p>
        <div className="flex gap-3 mb-3">
          <SearchableCombobox
            options={ACTIVITY_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
            value={activityForm.type}
            onChange={(v) => setActivityForm((p) => ({ ...p, type: v }))}
            className="w-44"
          />
          <input value={activityForm.outcome} onChange={(e) => setActivityForm((p) => ({ ...p, outcome: e.target.value }))}
            placeholder="Outcome (optional)"
            className="flex-1 px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex gap-3">
          <textarea value={activityForm.notes} onChange={(e) => setActivityForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Notes…" rows={2}
            className="flex-1 px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none" />
          <button onClick={addActivity} disabled={saving || !activityForm.notes.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition self-end">
            {saving ? '…' : 'Log'}
          </button>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="rounded-xl border border-white/5 bg-gray-900 p-4">
        <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wide">Activity Timeline</p>
        {(lead.activities?.length ?? 0) === 0 && <p className="text-gray-600 text-sm">No activities yet.</p>}
        <div className="space-y-4">
          {(lead.activities ?? []).map((a) => (
            <div key={a.id} className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-white">{a.type}</span>
                  {a.outcome && <span className="text-xs text-gray-400">· {a.outcome}</span>}
                  <span className="text-xs text-gray-600">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-300">{a.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
