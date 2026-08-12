'use client';

import { useEffect, useRef, useState } from 'react';
import { FiDownload, FiFileText } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import api from '../../../lib/api';
import { formatCurrency, todayISO } from '../../../lib/api';

const REPORT_TABS = [
  { key: 'monthly-sales', label: 'Monthly Sales' },
  { key: 'profit-loss', label: 'Profit / Loss' },
  { key: 'truck-wise', label: 'Truck-wise' },
  { key: 'customer-wise', label: 'Customer-wise' },
  { key: 'size-wise', label: 'Size-wise' },
  { key: 'wastage', label: 'Wastage' },
  { key: 'expense', label: 'Expense' },
  { key: 'retail-vs-wholesale', label: 'Retail vs Wholesale' },
];

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [tab, setTab] = useState('profit-loss');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const [truck, setTruck] = useState('');
  const [trucks, setTrucks] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [topSizes, setTopSizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportMonth, setReportMonth] = useState(todayISO().slice(0, 7));
  const reportRequest = useRef(0);

  useEffect(() => {
    api.get('/trucks').then((r) => setTrucks(r.data));
    if (new URLSearchParams(window.location.search).get('view') === 'monthly-sales') setTab('monthly-sales');
  }, []);

  const load = async () => {
    const requestId = ++reportRequest.current;
    setLoading(true);
    const params: any = { from, to };
    if (truck) params.truck = truck;
    const [res, tc, ts] = await Promise.all([
      tab === 'monthly-sales' ? api.get('/reports/monthly-sales', { params: { month: reportMonth } }) : api.get(`/reports/${tab}`, { params }),
      api.get('/reports/top-customers', { params: { from, to } }),
      api.get('/reports/top-sizes', { params: { from, to } }),
    ]);
    if (requestId !== reportRequest.current) return;
    setData(res.data);
    setTopCustomers(Array.isArray(tc.data) ? tc.data : []);
    setTopSizes(Array.isArray(ts.data) ? ts.data : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const exportExcel = async () => {
    const rows = flattenForExport();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab);
    XLSX.writeFile(wb, `${tab}-report-${from}-to-${to}.xlsx`);
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Tiruppur Ice Since 2000', 14, 15);
    doc.setFontSize(10);
    doc.text(`${REPORT_TABS.find((t) => t.key === tab)?.label} Report (${from} to ${to})`, 14, 22);
    const rows = flattenForExport();
    const headers = rows.length ? Object.keys(rows[0]) : [];
    (doc as any).autoTable({
      startY: 28,
      head: [headers],
      body: rows.map((r) => headers.map((h) => (r as any)[h])),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [28, 166, 209] },
    });
    doc.save(`${tab}-report-${from}-to-${to}.pdf`);
  };

  const flattenForExport = (): any[] => {
    if (!data) return [];
    if (tab === 'profit-loss') return [data];
    if (Array.isArray(data)) return data;
    return Object.entries(data).map(([key, v]: any) =>
      typeof v === 'object' ? { key, ...v } : { key, value: v },
    );
  };

  return (
    <div className="-mt-4 space-y-1 sm:-mt-5">
      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-white to-iceblue-50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-iceblue-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
          <h1 className="shrink-0 font-display text-base font-bold text-navy-900">Reports &amp; Exports</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={exportExcel} className="btn-secondary flex h-10 shrink-0 items-center justify-center gap-2 px-4"><FiDownload /> Excel</button>
            <button onClick={exportPdf} className="btn-secondary flex h-10 shrink-0 items-center justify-center gap-2 px-4"><FiFileText /> PDF</button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-b border-iceblue-100 px-4 py-3">
          {tab === 'monthly-sales' && <div><label className="label-text">Report Month</label><input type="month" className="input-field" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></div>}
          {tab !== 'monthly-sales' && <>
          <div>
            <label className="label-text">From</label>
            <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          </>}
          <div>
            <label className="label-text">To</label>
            <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Truck</label>
            <select className="input-field" value={truck} onChange={(e) => setTruck(e.target.value)}>
              <option value="">All</option>
              {trucks.map((t) => <option key={t._id} value={t._id}>{t.truckName}</option>)}
            </select>
          </div>
          <button onClick={load} className="btn-secondary">Apply</button>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setData(null); setTab(t.key); }}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-iceblue-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-navy-900 hover:bg-iceblue-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-white to-iceblue-50 shadow-sm">
        <div className="border-b border-iceblue-100 bg-white px-4 py-3">
          <h2 className="font-display text-base font-bold text-navy-900">{REPORT_TABS.find((item) => item.key === tab)?.label}</h2>
        </div>
        <div className="p-4">
          {loading ? (
            <p className="text-navy-800/50">Loading report...</p>
          ) : (
            <ReportBody tab={tab} data={data} />
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-white shadow-sm">
          <div className="border-b border-iceblue-100 bg-white px-4 py-3">
            <h2 className="font-display text-sm font-bold text-navy-900">Top Customers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] table-fixed border-collapse text-xs">
              <thead className="bg-slate-100 text-navy-900">
                <tr>
                  <th className="w-[10%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
                  <th className="border border-slate-300 px-3 py-3 text-left text-[10px] font-bold uppercase leading-tight">Customer</th>
                  <th className="border border-slate-300 px-3 py-3 text-right text-[10px] font-bold uppercase leading-tight">Bar Used</th>
                  <th className="border border-slate-300 px-3 py-3 text-right text-[10px] font-bold uppercase leading-tight">Amount</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, index) => (
                  <tr key={c.customerId} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                    <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                    <td className="border border-slate-300 px-3 py-3 text-navy-900">{c.customerName}</td>
                    <td className="border border-slate-300 px-3 py-3 text-right text-navy-900">{c.quantity}</td>
                    <td className="border border-slate-300 px-3 py-3 text-right font-semibold text-navy-900">{formatCurrency(c.totalAmount)}</td>
                  </tr>
                ))}
                {topCustomers.length === 0 && <tr><td colSpan={4} className="border border-slate-300 py-6 text-center text-navy-800/50">No data</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-white shadow-sm">
          <div className="border-b border-iceblue-100 bg-white px-4 py-3">
            <h2 className="font-display text-sm font-bold text-navy-900">Top Selling Sizes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[340px] table-fixed border-collapse text-xs">
              <thead className="bg-slate-100 text-navy-900">
                <tr>
                  <th className="w-[14%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
                  <th className="border border-slate-300 px-3 py-3 text-left text-[10px] font-bold uppercase leading-tight">Size</th>
                  <th className="border border-slate-300 px-3 py-3 text-right text-[10px] font-bold uppercase leading-tight">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {topSizes.map((s, index) => (
                  <tr key={s.size} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                    <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                    <td className="border border-slate-300 px-3 py-3 text-navy-900">{s.size} bar</td>
                    <td className="border border-slate-300 px-3 py-3 text-right font-semibold text-navy-900">{s.quantity}</td>
                  </tr>
                ))}
                {topSizes.length === 0 && <tr><td colSpan={3} className="border border-slate-300 py-6 text-center text-navy-800/50">No data</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function ReportBody({ tab, data }: { tab: string; data: any }) {
  if (!data) return <p className="text-navy-800/50">No data.</p>;

  if (tab === 'profit-loss' || tab === 'monthly-sales') {
    return (
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8">
        {Object.entries(data).filter(([k]) => k !== 'from' && k !== 'to').map(([k, v]: any, index) => {
          const currency = typeof v === 'number' && ['sale', 'profit', 'loss', 'expense', 'collect', 'outstanding', 'cost'].some((word) => k.toLowerCase().includes(word));
          const trend: 'up' | 'down' = ['loss', 'expense', 'outstanding', 'cost', 'wastage'].some((word) => k.toLowerCase().includes(word)) ? 'down' : 'up';
          return <ReportMetric key={k} index={index} label={k.replace(/([A-Z])/g, ' $1')} value={currency ? formatCurrency(v) : String(v)} trend={trend} />;
        })}
      </div>
    );
  }

  // truck-wise / customer-wise: object keyed by id with { *Name, totalAmount, quantity }
  if (tab === 'truck-wise' || tab === 'customer-wise') {
    const rows = Object.entries(data);
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] table-fixed border-collapse text-xs">
          <thead className="bg-slate-100 text-navy-900">
            <tr>
              <th className="w-[8%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
              <th className="border border-slate-300 px-3 py-3 text-left text-[10px] font-bold uppercase leading-tight">Name</th>
              <th className="border border-slate-300 px-3 py-3 text-right text-[10px] font-bold uppercase leading-tight">Bar Used</th>
              <th className="border border-slate-300 px-3 py-3 text-right text-[10px] font-bold uppercase leading-tight">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, v]: any, index) => (
              <tr key={id} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                <td className="border border-slate-300 px-3 py-3 text-navy-900">{v.truckName || v.customerName}</td>
                <td className="border border-slate-300 px-3 py-3 text-right text-navy-900">{v.quantity}</td>
                <td className="border border-slate-300 px-3 py-3 text-right font-semibold text-navy-900">{formatCurrency(v.totalAmount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="border border-slate-300 py-6 text-center text-navy-800/50">No data</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'size-wise' || tab === 'wastage') {
    const rows = Object.entries(data);
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] table-fixed border-collapse text-xs">
          <thead className="bg-slate-100 text-navy-900">
            <tr>
              <th className="w-[10%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
              <th className="border border-slate-300 px-3 py-3 text-left text-[10px] font-bold uppercase leading-tight">Size</th>
              <th className="border border-slate-300 px-3 py-3 text-right text-[10px] font-bold uppercase leading-tight">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([size, rawValue]: any, index) => {
              const row = rawValue && typeof rawValue === 'object' ? rawValue : null;
              const label = row?.size || size;
              const quantity = row ? Number(row.quantity ?? row.wastage ?? row.total ?? 0) : Number(rawValue || 0);
              return (
                <tr key={size} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                  <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                  <td className="border border-slate-300 px-3 py-3 text-navy-900">{label} bar</td>
                  <td className="border border-slate-300 px-3 py-3 text-right font-semibold text-navy-900">{quantity}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={3} className="border border-slate-300 py-6 text-center text-navy-800/50">No data</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'expense') {
    const rows = Object.entries(data);
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] table-fixed border-collapse text-xs">
          <thead className="bg-slate-100 text-navy-900">
            <tr>
              <th className="w-[10%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
              <th className="border border-slate-300 px-3 py-3 text-left text-[10px] font-bold uppercase leading-tight">Cost Type</th>
              <th className="border border-slate-300 px-3 py-3 text-right text-[10px] font-bold uppercase leading-tight">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([type, amt]: any, index) => (
              <tr key={type} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                <td className="border border-slate-300 px-3 py-3 capitalize text-navy-900">{type.replace('_', ' ')}</td>
                <td className="border border-slate-300 px-3 py-3 text-right font-semibold text-navy-900">{formatCurrency(amt)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="border border-slate-300 py-6 text-center text-navy-800/50">No data</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'retail-vs-wholesale') {
    return (
      <div className="grid grid-cols-2 gap-1.5 sm:max-w-xl">
        <ReportMetric index={0} label="Retail" value={formatCurrency(data.retail)} trend="up" />
        <ReportMetric index={1} label="Wholesale" value={formatCurrency(data.wholesale)} trend="up" />
      </div>
    );
  }

  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
}

function ReportMetric({ label, value, trend, index = 0 }: { label: string; value: string; trend: 'up' | 'down'; index?: number }) {
  const tones = ['blue', 'cyan', 'violet', 'amber'] as const;
  const tone = tones[index % tones.length];
  const styles = {
    blue: { card: 'from-blue-50 to-white', icon: 'bg-blue-600', accent: 'bg-blue-500' },
    cyan: { card: 'from-cyan-50 to-white', icon: 'bg-cyan-600', accent: 'bg-cyan-500' },
    violet: { card: 'from-violet-50 to-white', icon: 'bg-violet-600', accent: 'bg-violet-500' },
    amber: { card: 'from-amber-50 to-white', icon: 'bg-amber-500', accent: 'bg-amber-500' },
  }[tone];
  const danger = trend === 'down';

  return (
    <div className={`flex min-h-[66px] min-w-0 items-center gap-2 overflow-hidden rounded-lg border bg-gradient-to-br px-2.5 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${styles.card} ${danger ? 'border-red-100' : 'border-iceblue-100'}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs text-white shadow-sm ${danger ? 'bg-red-500' : styles.icon}`}>
        <FiFileText />
      </span>

      <div className="min-w-0">
        <p className="truncate text-[9px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p>
        <p className={`truncate font-display text-sm font-bold leading-tight ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
      </div>
    </div>
  );
}
