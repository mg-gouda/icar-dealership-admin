'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '../../../../lib/useApi';
import SearchableCombobox from '../../../../components/ui/SearchableCombobox';
import ExcelJS from 'exceljs';

type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'aged-receivables' | 'aged-payables' | 'cash-flow' | 'tax-report';

const REPORTS = [
  { key: 'trial-balance' as const, label: 'Trial Balance', needsRange: true },
  { key: 'income-statement' as const, label: 'Income Statement', needsRange: true },
  { key: 'balance-sheet' as const, label: 'Balance Sheet', needsRange: false },
  { key: 'aged-receivables' as const, label: 'Aged Receivables', needsRange: false },
  { key: 'aged-payables' as const, label: 'Aged Payables', needsRange: false },
  { key: 'cash-flow' as const, label: 'Cash Flow', needsRange: true },
  { key: 'tax-report' as const, label: 'Tax Report', needsRange: true },
];

const fmt = (n: number | string | object) =>
  Number(n).toLocaleString('en-EG', { maximumFractionDigits: 2 });

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadXlsx(rows: Record<string, unknown>[], sheetName: string, filename: string) {
  if (!rows.length) return;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'iCar Dealership';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);

  const headers = Object.keys(rows[0]);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rows.forEach((r) => ws.addRow(headers.map((h) => {
    const v = r[h];
    return (typeof v === 'string' && !isNaN(Number(v)) && v !== '') ? Number(v) : v;
  })));

  headers.forEach((_, i) => { ws.getColumn(i + 1).width = 18; });

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ReportsPage() {
  const now = new Date();
  const y = now.getFullYear();
  const [report, setReport] = useState<ReportType>('trial-balance');
  const [dateFrom, setDateFrom] = useState(`${y}-01-01`);
  const [dateTo, setDateTo] = useState(`${y}-12-31`);
  const [asOf, setAsOf] = useState(now.toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // GL drill-down slide-over
  const [drillAccount, setDrillAccount] = useState<{ id: string; code: string; name: string } | null>(null);
  const [drillData, setDrillData] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const active = REPORTS.find((r) => r.key === report)!;

  async function drillDown(accountId: string, code: string, name: string) {
    setDrillAccount({ id: accountId, code, name });
    setDrillLoading(true);
    try {
      const qs = active.needsRange ? `dateFrom=${dateFrom}&dateTo=${dateTo}` : `asOf=${asOf}`;
      const res = await apiFetch<{ items: any[] }>(`/finance/reports/gl-by-account?accountId=${accountId}&${qs}`);
      setDrillData(Array.isArray(res) ? res : (res as any).items ?? []);
    } catch { setDrillData([]); }
    finally { setDrillLoading(false); }
  }

  function flatRows(): Record<string, unknown>[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return (Object.values(data) as unknown[]).flatMap((v) => Array.isArray(v) ? v : []);
  }

  function exportCsv() {
    downloadCsv(flatRows(), `${report}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportXlsx() {
    const label = REPORTS.find((r) => r.key === report)?.label ?? report;
    downloadXlsx(flatRows(), label, `${report}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function run() {
    setLoading(true);
    setError('');
    try {
      const qs = active.needsRange
        ? `dateFrom=${dateFrom}&dateTo=${dateTo}`
        : `asOf=${asOf}`;
      const result = await apiFetch<any>(`/finance/reports/${report}?${qs}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Report failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Financial Reports</h1>
        </div>
        <Link href="/finance" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition">
          ← Finance
        </Link>
      </div>

      {/* Report selector + date inputs */}
      <div className="rounded-xl border border-white/5 bg-gray-900 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <SearchableCombobox
          label="Report"
          options={REPORTS.map((r) => ({ value: r.key, label: r.label }))}
          value={report}
          onChange={(v) => { setReport(v as ReportType); setData(null); }}
          className="w-52"
        />
        {active.needsRange ? (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs text-gray-500 mb-1">As of</label>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
              className="bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        )}
        <button onClick={run} disabled={loading}
          className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition">
          {loading ? 'Running…' : 'Run Report'}
        </button>
        {data && (
          <>
            <button onClick={exportCsv}
              className="px-4 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              CSV
            </button>
            <button onClick={exportXlsx}
              className="px-4 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition">
              Excel
            </button>
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {data && (
        <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
          {/* Trial Balance */}
          {report === 'trial-balance' && (
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 text-gray-400 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Code</th>
                  <th className="px-4 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((r: any) => (
                  <tr key={r.accountId} onClick={() => drillDown(r.accountId, r.code, r.name)}
                    className="hover:bg-white/5 cursor-pointer transition">
                    <td className="px-4 py-2 font-mono text-gray-400 text-xs">{r.code}</td>
                    <td className="px-4 py-2 text-white">{r.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-white">{fmt(r.debit)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-white">{fmt(r.credit)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${Number(r.balance) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Income Statement */}
          {report === 'income-statement' && (
            <div className="p-4 space-y-4">
              <Section title="Income" rows={data.income} field="net" positive />
              <div className="border-t border-white/5 pt-3 flex justify-between text-sm">
                <span className="text-gray-400 font-medium">Total Income</span>
                <span className="text-green-400 font-semibold">{fmt(data.totalIncome)}</span>
              </div>
              <Section title="Expenses" rows={data.expenses} field="net" />
              <div className="border-t border-white/5 pt-3 flex justify-between text-sm">
                <span className="text-gray-400 font-medium">Total Expenses</span>
                <span className="text-red-400 font-semibold">{fmt(data.totalExpense)}</span>
              </div>
              <div className="border-t-2 border-white/20 pt-3 flex justify-between text-base">
                <span className="text-white font-semibold">Net Profit / Loss</span>
                <span className={`font-bold ${Number(data.netProfit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(data.netProfit)}
                </span>
              </div>
            </div>
          )}

          {/* Balance Sheet */}
          {report === 'balance-sheet' && (
            <div className="p-4 space-y-4">
              <Section title="Assets" rows={data.assets} field="balance" positive />
              <div className="border-t border-white/5 pt-3 flex justify-between text-sm">
                <span className="text-gray-400 font-medium">Total Assets</span>
                <span className="text-white font-semibold">{fmt(data.totalAssets)}</span>
              </div>
              <Section title="Liabilities" rows={data.liabilities} field="balance" />
              <Section title="Equity" rows={data.equity} field="balance" />
              <div className="border-t-2 border-white/20 pt-3 flex justify-between text-base">
                <span className="text-white font-semibold">Liabilities + Equity</span>
                <span className="text-white font-bold">{fmt(data.totalLiabilitiesAndEquity)}</span>
              </div>
            </div>
          )}

          {/* Aged Reports */}
          {(report === 'aged-receivables' || report === 'aged-payables') && (
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 text-gray-400 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Partner</th>
                  <th className="px-4 py-3 text-right font-medium">Current</th>
                  <th className="px-4 py-3 text-right font-medium">1–30</th>
                  <th className="px-4 py-3 text-right font-medium">31–60</th>
                  <th className="px-4 py-3 text-right font-medium">61–90</th>
                  <th className="px-4 py-3 text-right font-medium">90+</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((r: any) => (
                  <tr key={r.partnerId} className="hover:bg-white/2">
                    <td className="px-4 py-2 text-white">{r.partnerName}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-300">{fmt(r.current)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-300">{fmt(r.b30)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-400">{fmt(r.b60)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-orange-400">{fmt(r.b90)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-400">{fmt(r.b120)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-white font-medium">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Cash Flow */}
          {report === 'cash-flow' && (
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-300">Net Profit</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${Number(data.netProfit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(data.netProfit)}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-300">+ Depreciation</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">{fmt(data.depreciation)}</td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-300">AR Change</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${Number(data.arChange) <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(data.arChange)}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-300">AP Change</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${Number(data.apChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(data.apChange)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-white/20 bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-semibold">Operating Cash Flow</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-bold ${Number(data.operatingCashFlow) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(data.operatingCashFlow)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-600 mt-3 px-4">{data.note}</p>
            </div>
          )}

          {/* Tax Report */}
          {report === 'tax-report' && (
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 text-gray-400 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tax Group</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Collected</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Net Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {Array.isArray(data) && data.map((r: any) => (
                  <tr key={r.taxGroupId} className="hover:bg-white/5">
                    <td className="px-4 py-2 text-white">{r.taxGroupName}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-300">{fmt(r.rate)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-400">{fmt(r.taxCollected)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-400">{fmt(r.taxPaid)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${Number(r.netPayable) >= 0 ? 'text-amber-400' : 'text-green-400'}`}>
                      {fmt(r.netPayable)}
                    </td>
                  </tr>
                ))}
                {(!Array.isArray(data) || data.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">No tax data found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* GL Drill-down slide-over */}
      {drillAccount && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrillAccount(null)} />
          <div className="relative w-[480px] h-full bg-gray-900 border-l border-white/10 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <p className="text-xs text-gray-500 font-mono">{drillAccount.code}</p>
                <p className="text-sm font-semibold text-white">{drillAccount.name}</p>
              </div>
              <button onClick={() => setDrillAccount(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {drillLoading && <p className="p-4 text-gray-500 text-sm">Loading…</p>}
              {!drillLoading && drillData.length === 0 && <p className="p-4 text-gray-600 text-sm">No GL lines in this period.</p>}
              {!drillLoading && drillData.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="border-b border-white/5 text-gray-500 sticky top-0 bg-gray-900">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">Ref</th>
                      <th className="px-4 py-2 text-right font-medium">Debit</th>
                      <th className="px-4 py-2 text-right font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {drillData.map((l: any) => (
                      <tr key={l.id} className="hover:bg-white/5">
                        <td className="px-4 py-1.5 text-gray-400">{new Date(l.journalEntry.date).toLocaleDateString()}</td>
                        <td className="px-4 py-1.5 text-gray-300 font-mono">{l.journalEntry.ref ?? '—'}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-white">{Number(l.debit) ? fmt(l.debit) : '—'}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-white">{Number(l.credit) ? fmt(l.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, rows, field, positive }: { title: string; rows: any[]; field: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-0.5">
        {rows.map((r: any) => (
          <div key={r.accountId} className="flex justify-between text-sm px-2 py-1 rounded hover:bg-white/5">
            <span className="text-gray-300">
              <span className="font-mono text-xs text-gray-500 mr-2">{r.code}</span>
              {r.name}
            </span>
            <span className={positive ? 'text-green-400 tabular-nums' : 'text-white tabular-nums'}>
              {Number(r[field]).toLocaleString('en-EG', { maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-gray-600 text-xs px-2">No data</p>}
      </div>
    </div>
  );
}
