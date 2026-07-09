'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import { useLang } from '@/lib/lang-context';
import { ErrorBanner } from '@/components/ui/error-banner';

interface Journal {
  id: string;
  name: string;
  code: string;
  type: string;
  location?: { name: string };
  defaultDebitAccount?: { code: string; name: string };
  defaultCreditAccount?: { code: string; name: string };
}

interface Location { id: string; name: string; }
interface Account { id: string; code: string; name: string; }

const TYPE_OPTS = [
  { value: 'SALE',     label: 'Sales' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'CASH',     label: 'Cash' },
  { value: 'BANK',     label: 'Bank' },
  { value: 'GENERAL',  label: 'General' },
];

const TYPE_OPTS_AR = [
  { value: 'SALE',     label: 'مبيعات' },
  { value: 'PURCHASE', label: 'مشتريات' },
  { value: 'CASH',     label: 'نقدي' },
  { value: 'BANK',     label: 'بنكي' },
  { value: 'GENERAL',  label: 'عام' },
];

const BLANK = { name: '', code: '', type: 'GENERAL', locationId: '', defaultDebitAccountId: '', defaultCreditAccountId: '' };

export default function JournalsPage() {
  const { isAr } = useLang();
  const { data: journalData, loading, error, reload } = useQuery<Journal[]>('/finance/journals');
  const { data: locationData } = useQuery<Location[]>('/locations');
  const { data: accountData } = useQuery<{ items: Account[] }>('/finance/accounts?limit=200');

  const journals = Array.isArray(journalData) ? journalData : [];
  const locations = Array.isArray(locationData) ? locationData : [];
  const accounts = accountData?.items ?? [];

  const locationOpts = [
    { value: '', label: isAr ? 'كل الفروع' : 'All locations' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];
  const accountOpts = accounts.map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` }));
  const typeOpts = isAr ? TYPE_OPTS_AR : TYPE_OPTS;

  const [editing, setEditing] = useState<null | 'new' | Journal>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof BLANK>(BLANK);

  function openCreate() {
    setForm(BLANK);
    setEditing('new');
  }

  function openEdit(j: Journal) {
    setForm({
      name: j.name,
      code: j.code,
      type: j.type,
      locationId: '',          // ponytail: location id not in list response, leave blank
      defaultDebitAccountId: '',
      defaultCreditAccountId: '',
    });
    setEditing(j);
  }

  function close() { setEditing(null); }

  function set(k: keyof typeof BLANK, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, unknown> = {
      name: form.name,
      code: form.code,
      type: form.type,
    };
    if (form.locationId) body.locationId = form.locationId;
    if (form.defaultDebitAccountId) body.defaultDebitAccountId = form.defaultDebitAccountId;
    if (form.defaultCreditAccountId) body.defaultCreditAccountId = form.defaultCreditAccountId;

    try {
      if (editing === 'new') {
        await apiFetch('/finance/journals', { method: 'POST', body: JSON.stringify(body) });
      } else if (editing) {
        await apiFetch(`/finance/journals/${(editing as Journal).id}`, { method: 'PATCH', body: JSON.stringify(body) });
      }
      close();
      reload();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : (isAr ? 'خطأ في حفظ الدفتر' : 'Error saving journal'));
    } finally {
      setSaving(false);
    }
  }

  const typeLabel = (t: string) => {
    const opts = isAr ? TYPE_OPTS_AR : TYPE_OPTS;
    return opts.find((o) => o.value === t)?.label ?? t;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <Link href="/finance" className="text-xs text-gray-500 hover:text-gray-300 transition">
              {isAr ? '→ المالية' : '← Finance'}
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-white">
            {isAr ? 'الدفاتر المحاسبية' : 'Journals'}
          </h1>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition"
        >
          {isAr ? '+ دفتر' : '+ Journal'}
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">{isAr ? 'جاري التحميل…' : 'Loading…'}</p>}
      {error && <div className="mb-4"><ErrorBanner error={error} retry={reload} /></div>}

      {/* Table */}
      {!loading && (
        <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs text-gray-500">
                <th className="text-left px-4 py-3 font-medium">{isAr ? 'الكود' : 'Code'}</th>
                <th className="text-left px-4 py-3 font-medium">{isAr ? 'الاسم' : 'Name'}</th>
                <th className="text-left px-4 py-3 font-medium">{isAr ? 'النوع' : 'Type'}</th>
                <th className="text-left px-4 py-3 font-medium">{isAr ? 'الفرع' : 'Location'}</th>
                <th className="text-left px-4 py-3 font-medium">{isAr ? 'مدين افتراضي' : 'Default Debit'}</th>
                <th className="text-left px-4 py-3 font-medium">{isAr ? 'دائن افتراضي' : 'Default Credit'}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {journals.map((j, i) => (
                <tr
                  key={j.id}
                  className={`border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition ${i % 2 === 0 ? '' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{j.code}</td>
                  <td className="px-4 py-3 text-white">{j.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-800 border border-white/5 rounded px-2 py-0.5 text-gray-400">
                      {typeLabel(j.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{j.location?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                    {j.defaultDebitAccount ? `${j.defaultDebitAccount.code}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                    {j.defaultCreditAccount ? `${j.defaultCreditAccount.code}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(j)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                  </td>
                </tr>
              ))}
              {journals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-600">
                    {isAr ? 'لا توجد دفاتر بعد.' : 'No journals yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              {editing === 'new'
                ? (isAr ? 'دفتر جديد' : 'New Journal')
                : `${isAr ? 'تعديل' : 'Edit'}: ${(editing as Journal).name}`}
            </h2>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{isAr ? 'الاسم *' : 'Name *'}</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{isAr ? 'الكود *' : 'Code *'}</label>
                <input
                  required
                  value={form.code}
                  onChange={(e) => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. SALE-CAI"
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <SearchableCombobox
                label={isAr ? 'النوع *' : 'Type *'}
                options={typeOpts}
                value={form.type}
                onChange={(v) => set('type', v)}
                placeholder={isAr ? 'اختر النوع' : 'Select type'}
              />
              <SearchableCombobox
                label={isAr ? 'الفرع (اختياري)' : 'Location (optional)'}
                options={locationOpts}
                value={form.locationId}
                onChange={(v) => set('locationId', v)}
                placeholder={isAr ? 'كل الفروع' : 'All locations'}
                clearable
                clearLabel={isAr ? 'بدون' : 'None'}
              />
              <SearchableCombobox
                label={isAr ? 'الحساب المدين الافتراضي (اختياري)' : 'Default Debit Account (optional)'}
                options={accountOpts}
                value={form.defaultDebitAccountId}
                onChange={(v) => set('defaultDebitAccountId', v)}
                placeholder={isAr ? 'بدون' : 'None'}
                clearable
                clearLabel={isAr ? 'بدون' : 'None'}
              />
              <SearchableCombobox
                label={isAr ? 'الحساب الدائن الافتراضي (اختياري)' : 'Default Credit Account (optional)'}
                options={accountOpts}
                value={form.defaultCreditAccountId}
                onChange={(v) => set('defaultCreditAccountId', v)}
                placeholder={isAr ? 'بدون' : 'None'}
                clearable
                clearLabel={isAr ? 'بدون' : 'None'}
              />
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:text-white transition"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition"
                >
                  {saving ? '…' : editing === 'new' ? (isAr ? 'إنشاء' : 'Create') : (isAr ? 'حفظ' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
