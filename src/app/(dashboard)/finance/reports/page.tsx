'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '../../../../lib/useApi';
import StatusBadge from '../../../../components/StatusBadge';

type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'aged-receivables' | 'aged-payables';

const REPORTS = [
  { key: 'trial-balance' as const, label: 'Trial Balance', needsRange: true },
  { key: 'income-statement' as const, label: 'Income Statement', needsRange: true },
  { key: 'balance-sheet' as const, label: 'Balance Sheet', needsRange: false },
  { key: 'aged-receivables' as const, label: 'Aged Receivables', needsRange: false },
  { key: 'aged-payables' as const, label: 'Aged Payables', needsRange: false },
];

const fmt = (n: number | string | object) =>
  Number(n).toLocaleString('en-EG', { maximumFractionDigits: 2 });

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

  const active = REPORTS.find((r) => r.key === report)!;

  async function run() {
    setLoading(true);
    setError('');
    try {
      const qs = active.needsRange
        ? `dateFrom=${dateFrom}&dateTo=${dateTo}`
        : `asOf=${asOf}`;
      const result = await apiFetch<any>(`/finance/reports/${report}?${qs}`);
      setData(result);
    } catch (e: any) {
      setError(e.message);
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">Report</label>
          <select value={report} onChange={(e) => { setReport(e.target.value as ReportType); setData(null); }}
            className="bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
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
                  <tr key={r.accountId} className="hover:bg-white/2">
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
