'use client';

import { useState } from 'react';
import { apiFetch } from '../../../lib/useApi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

const fmt = (n: number | string) =>
  Number(n).toLocaleString('en-EG', { maximumFractionDigits: 2 });

interface Deal {
  id: string;
  purchaseMethod: string;
  salePrice: number | string;
  status: string;
  createdAt: string;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  status: string;
  createdAt: string;
}

interface Lead {
  id: string;
  status: string;
  source: string;
  createdAt: string;
}

interface Appointment {
  id: string;
  status: string;
  createdAt: string;
}

export default function OperationalReportsPage() {
  const y = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${y}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [commReport, setCommReport] = useState<any[] | null>(null);

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let y = 14;
    doc.setFontSize(12);
    doc.text(`iCar Dealership — Operational Reports (${dateFrom} → ${dateTo})`, 14, y);
    y += 8;
    if (deals?.length) {
      doc.setFontSize(9); doc.text('Sales Report', 14, y); y += 4;
      autoTable(doc, { startY: y, head: [['Purchase Method', 'Sale Price', 'Status', 'Date']],
        body: deals.map((d) => [d.purchaseMethod, Number(d.salePrice).toLocaleString(), d.status, new Date(d.createdAt).toLocaleDateString()]),
        styles: { fontSize: 7 }, headStyles: { fillColor: [30, 41, 59], textColor: 255 } });
      y = (doc as any).lastAutoTable?.finalY + 6;
    }
    doc.save(`operational-reports-${dateFrom}.pdf`);
  }

  async function exportXlsx() {
    const wb = new ExcelJS.Workbook();
    if (deals?.length) {
      const ws = wb.addWorksheet('Sales');
      ws.addRow(['Method', 'Sale Price', 'Status', 'Date']).font = { bold: true };
      deals.forEach((d) => ws.addRow([d.purchaseMethod, Number(d.salePrice), d.status, new Date(d.createdAt).toLocaleDateString()]));
      ws.getColumn(2).numFmt = '#,##0.00';
    }
    if (leads?.length) {
      const ws = wb.addWorksheet('Leads');
      ws.addRow(['Name', 'Status', 'Source', 'Created']).font = { bold: true };
      leads.forEach((l) => ws.addRow([(l as any).name, (l as any).status, (l as any).source, new Date((l as any).createdAt).toLocaleDateString()]));
    }
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `operational-reports-${dateFrom}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function run() {
    setLoading(true);
    try {
      const [d, v, l, a, cr] = await Promise.all([
        apiFetch<{ items: Deal[] } | Deal[]>(`/deals?status=FINALIZED&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=200`),
        apiFetch<{ items: Vehicle[] } | Vehicle[]>(`/vehicles?status=AVAILABLE&limit=200`),
        apiFetch<{ items: Lead[] } | Lead[]>(`/leads?limit=200`),
        apiFetch<{ items: Appointment[] } | Appointment[]>(`/appointments?limit=200`),
        apiFetch<any[]>(`/commissions/report?dateFrom=${dateFrom}&dateTo=${dateTo}`),
      ]);
      setDeals(Array.isArray(d) ? d : (d as any).items ?? []);
      setVehicles(Array.isArray(v) ? v : (v as any).items ?? []);
      setLeads(Array.isArray(l) ? l : (l as any).items ?? []);
      setAppointments(Array.isArray(a) ? a : (a as any).items ?? []);
      setCommReport(Array.isArray(cr) ? cr : []);
    } catch {
      // ponytail: silent — individual sections show empty
    } finally {
      setLoading(false);
    }
  }

  // Sales analysis
  const totalDeals = deals?.length ?? 0;
  const totalRevenue = deals?.reduce((s, d) => s + Number(d.salePrice ?? 0), 0) ?? 0;
  const avgDealValue = totalDeals > 0 ? totalRevenue / totalDeals : 0;
  const purchaseMethodBreakdown = deals
    ? deals.reduce<Record<string, { count: number; revenue: number }>>((acc, d) => {
        const m = d.purchaseMethod ?? 'UNKNOWN';
        if (!acc[m]) acc[m] = { count: 0, revenue: 0 };
        acc[m].count++;
        acc[m].revenue += Number(d.salePrice ?? 0);
        return acc;
      }, {})
    : {};

  // Inventory analysis
  const now = Date.now();
  const availableCount = vehicles?.length ?? 0;
  const vehiclesWithAge = (vehicles ?? []).map((v) => ({
    ...v,
    daysInStock: Math.floor((now - new Date(v.createdAt).getTime()) / 86400000),
  }));
  const avgDaysInStock = availableCount > 0
    ? vehiclesWithAge.reduce((s, v) => s + v.daysInStock, 0) / availableCount
    : 0;
  const over60 = vehiclesWithAge.filter((v) => v.daysInStock > 60).length;
  const over90 = vehiclesWithAge.filter((v) => v.daysInStock > 90).length;

  // Leads analysis
  const totalLeads = leads?.length ?? 0;
  const statusCounts = leads
    ? leads.reduce<Record<string, number>>((acc, l) => {
        acc[l.status] = (acc[l.status] ?? 0) + 1;
        return acc;
      }, {})
    : {};
  const wonCount = statusCounts['WON'] ?? 0;
  const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
  const sourceBreakdown = leads
    ? leads.reduce<Record<string, number>>((acc, l) => {
        acc[l.source ?? 'UNKNOWN'] = (acc[l.source ?? 'UNKNOWN'] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  // Appointments analysis
  const totalAppts = appointments?.length ?? 0;
  const apptStatusCounts = appointments
    ? appointments.reduce<Record<string, number>>((acc, a) => {
        acc[a.status] = (acc[a.status] ?? 0) + 1;
        return acc;
      }, {})
    : {};
  const completedCount = apptStatusCounts['COMPLETED'] ?? 0;
  const cancelledCount = apptStatusCounts['CANCELLED'] ?? 0;
  const completionRate = totalAppts - cancelledCount > 0
    ? (completedCount / (totalAppts - cancelledCount)) * 100
    : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Operational Reports</h1>
      </div>

      {/* Date range + run */}
      <div className="rounded-xl border border-white/5 bg-gray-900 p-4 mb-6 flex flex-wrap gap-3 items-end">
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
        <button onClick={run} disabled={loading}
          className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition">
          {loading ? 'Loading...' : 'Run Reports'}
        </button>
        {deals !== null && (
          <>
            <button onClick={exportPdf}
              className="px-4 py-1.5 text-xs bg-rose-700 hover:bg-rose-600 text-white rounded-lg transition">
              PDF
            </button>
            <button onClick={exportXlsx}
              className="px-4 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition">
              Excel
            </button>
          </>
        )}
      </div>

      {deals !== null && (
        <div className="space-y-6">
          {/* Sales Report */}
          <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sales Report</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              <StatCard label="Finalized Deals" value={String(totalDeals)} />
              <StatCard label="Total Revenue" value={`EGP ${fmt(totalRevenue)}`} />
              <StatCard label="Avg Deal Value" value={`EGP ${fmt(avgDealValue)}`} />
            </div>
            {Object.keys(purchaseMethodBreakdown).length > 0 && (
              <table className="w-full text-sm">
                <thead className="border-t border-b border-white/5 text-xs text-gray-500">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Purchase Method</th>
                    <th className="px-5 py-2 text-right font-medium">Count</th>
                    <th className="px-5 py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.entries(purchaseMethodBreakdown).map(([method, data]) => (
                    <tr key={method} className="hover:bg-white/5">
                      <td className="px-5 py-2 text-white text-xs">{method}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-gray-300 text-xs">{data.count}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-white text-xs">{fmt(data.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Inventory Report */}
          <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inventory Report</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5">
              <StatCard label="Available" value={String(availableCount)} />
              <StatCard label="Avg Days in Stock" value={String(Math.round(avgDaysInStock))} />
              <StatCard label="Over 60 Days" value={String(over60)} warn={over60 > 0} />
              <StatCard label="Over 90 Days" value={String(over90)} warn={over90 > 0} />
            </div>
            {vehiclesWithAge.length > 0 && (
              <table className="w-full text-sm">
                <thead className="border-t border-b border-white/5 text-xs text-gray-500">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Vehicle</th>
                    <th className="px-5 py-2 text-right font-medium">Year</th>
                    <th className="px-5 py-2 text-right font-medium">Days in Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {vehiclesWithAge
                    .sort((a, b) => b.daysInStock - a.daysInStock)
                    .slice(0, 20)
                    .map((v) => (
                      <tr key={v.id} className="hover:bg-white/5">
                        <td className="px-5 py-2 text-white text-xs">{v.make} {v.model}</td>
                        <td className="px-5 py-2 text-right text-gray-300 text-xs">{v.year}</td>
                        <td className={`px-5 py-2 text-right tabular-nums text-xs font-medium ${v.daysInStock > 90 ? 'text-red-400' : v.daysInStock > 60 ? 'text-amber-400' : 'text-gray-300'}`}>
                          {v.daysInStock}d
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Lead Conversion Report */}
          <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lead Conversion</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5">
              <StatCard label="Total Leads" value={String(totalLeads)} />
              <StatCard label="Won" value={String(wonCount)} />
              <StatCard label="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} />
              {Object.entries(statusCounts).map(([status, count]) => (
                <StatCard key={status} label={status} value={String(count)} />
              ))}
            </div>
            {Object.keys(sourceBreakdown).length > 0 && (
              <table className="w-full text-sm">
                <thead className="border-t border-b border-white/5 text-xs text-gray-500">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Source</th>
                    <th className="px-5 py-2 text-right font-medium">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.entries(sourceBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([source, count]) => (
                      <tr key={source} className="hover:bg-white/5">
                        <td className="px-5 py-2 text-white text-xs">{source}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-gray-300 text-xs">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Appointment Report */}
          <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Appointments</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5">
              <StatCard label="Total" value={String(totalAppts)} />
              <StatCard label="Completed" value={String(completedCount)} />
              <StatCard label="Completion Rate" value={`${completionRate.toFixed(1)}%`} />
              {Object.entries(apptStatusCounts).map(([status, count]) => (
                <StatCard key={status} label={status} value={String(count)} />
              ))}
            </div>
          </div>
        {/* Commission Report */}
        {commReport && commReport.length > 0 && (
          <div className="rounded-xl border border-white/5 bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Commission Report</p>
              <p className="text-xs text-gray-500">{commReport.length} rep(s)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.02] text-gray-400">
                  <tr>
                    <th className="text-left px-5 py-2">Sales Rep</th>
                    <th className="text-left px-4 py-2">Role</th>
                    <th className="text-right px-4 py-2">Accrued</th>
                    <th className="text-right px-4 py-2">Payable</th>
                    <th className="text-right px-4 py-2">Paid</th>
                    <th className="text-right px-5 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {commReport.map((r) => (
                    <tr key={r.user?.id ?? r} className="hover:bg-white/2">
                      <td className="px-5 py-2 text-white">{r.user?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-400">{r.user?.role?.replace(/_/g, ' ') ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-300">{fmt(r.ACCRUED ?? 0)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-amber-400">{fmt(r.PAYABLE ?? 0)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-green-400">{fmt(r.PAID ?? 0)}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-white font-medium">{fmt(r.total ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-white/10 bg-white/[0.01]">
                  <tr>
                    <td colSpan={2} className="px-5 py-2 text-xs text-gray-500">Total</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-300 text-xs">{fmt(commReport.reduce((s, r) => s + (r.ACCRUED ?? 0), 0))}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-400 text-xs">{fmt(commReport.reduce((s, r) => s + (r.PAYABLE ?? 0), 0))}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-400 text-xs">{fmt(commReport.reduce((s, r) => s + (r.PAID ?? 0), 0))}</td>
                    <td className="px-5 py-2 text-right tabular-nums text-white font-semibold text-xs">{fmt(commReport.reduce((s, r) => s + (r.total ?? 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-semibold ${warn ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
