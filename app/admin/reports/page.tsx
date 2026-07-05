'use client';

import { useEffect, useState } from 'react';
import { FiDownload, FiFileText } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency, todayISO } from '../../../lib/api';

const REPORT_TABS = [
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

  useEffect(() => {
    api.get('/trucks').then((r) => setTrucks(r.data));
  }, []);

  const load = async () => {
    setLoading(true);
    const params: any = { from, to };
    if (truck) params.truck = truck;
    const [res, tc, ts] = await Promise.all([
      api.get(`/reports/${tab}`, { params }),
      api.get('/reports/top-customers', { params: { from, to } }),
      api.get('/reports/top-sizes', { params: { from, to } }),
    ]);
    setData(res.data);
    setTopCustomers(tc.data);
    setTopSizes(ts.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
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
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label-text">From</label>
          <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
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
        <div className="ml-auto flex gap-2">
          <button onClick={exportExcel} className="btn-secondary flex items-center gap-2"><FiDownload /> Excel</button>
          <button onClick={exportPdf} className="btn-secondary flex items-center gap-2"><FiFileText /> PDF</button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              tab === t.key ? 'bg-iceblue-500 text-white' : 'bg-white border border-iceblue-100 text-navy-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <p className="text-navy-800/50">Loading report...</p>
        ) : (
          <ReportBody tab={tab} data={data} />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <p className="font-display font-semibold mb-3">Top Customers</p>
          <table className="table-base">
            <thead><tr><th>Customer</th><th>Bar Used</th><th>Amount</th></tr></thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.customerId}><td>{c.customerName}</td><td>{c.quantity}</td><td>{formatCurrency(c.totalAmount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <p className="font-display font-semibold mb-3">Top Selling Sizes</p>
          <table className="table-base">
            <thead><tr><th>Size</th><th>Quantity</th></tr></thead>
            <tbody>
              {topSizes.map((s) => (
                <tr key={s.size}><td>{s.size} bar</td><td>{s.quantity}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportBody({ tab, data }: { tab: string; data: any }) {
  if (!data) return <p className="text-navy-800/50">No data.</p>;

  if (tab === 'profit-loss') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(data).filter(([k]) => k !== 'from' && k !== 'to').map(([k, v]: any) => (
          <div key={k} className="rounded-xl bg-iceblue-50 border border-iceblue-100 p-3">
            <p className="text-xs text-navy-800/60 capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
            <p className="text-lg font-bold text-navy-900">
              {typeof v === 'number' && k.toLowerCase().includes('sale') ? formatCurrency(v) :
               typeof v === 'number' && (k.toLowerCase().includes('profit') || k.toLowerCase().includes('expense') || k.toLowerCase().includes('collect') || k.toLowerCase().includes('outstanding')) ? formatCurrency(v) : v}
            </p>
          </div>
        ))}
      </div>
    );
  }

  // truck-wise / customer-wise: object keyed by id with { *Name, totalAmount, quantity }
  if (tab === 'truck-wise' || tab === 'customer-wise') {
    const rows = Object.entries(data);
    return (
      <table className="table-base">
        <thead><tr><th>Name</th><th>Bar Used</th><th>Amount</th></tr></thead>
        <tbody>
          {rows.map(([id, v]: any) => (
            <tr key={id}><td>{v.truckName || v.customerName}</td><td>{v.quantity}</td><td>{formatCurrency(v.totalAmount)}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="text-center text-navy-800/50 py-4">No data</td></tr>}
        </tbody>
      </table>
    );
  }

  if (tab === 'size-wise' || tab === 'wastage') {
    const rows = Object.entries(data);
    return (
      <table className="table-base">
        <thead><tr><th>Size</th><th>Quantity</th></tr></thead>
        <tbody>
          {rows.map(([size, qty]: any) => <tr key={size}><td>{size} bar</td><td>{qty}</td></tr>)}
          {rows.length === 0 && <tr><td colSpan={2} className="text-center text-navy-800/50 py-4">No data</td></tr>}
        </tbody>
      </table>
    );
  }

  if (tab === 'expense') {
    const rows = Object.entries(data);
    return (
      <table className="table-base">
        <thead><tr><th>Cost Type</th><th>Amount</th></tr></thead>
        <tbody>
          {rows.map(([type, amt]: any) => <tr key={type} className="capitalize"><td>{type.replace('_', ' ')}</td><td>{formatCurrency(amt)}</td></tr>)}
          {rows.length === 0 && <tr><td colSpan={2} className="text-center text-navy-800/50 py-4">No data</td></tr>}
        </tbody>
      </table>
    );
  }

  if (tab === 'retail-vs-wholesale') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-iceblue-50 border border-iceblue-100 p-4 text-center">
          <p className="text-xs text-navy-800/60">Retail</p>
          <p className="text-xl font-bold">{formatCurrency(data.retail)}</p>
        </div>
        <div className="rounded-xl bg-iceblue-50 border border-iceblue-100 p-4 text-center">
          <p className="text-xs text-navy-800/60">Wholesale</p>
          <p className="text-xl font-bold">{formatCurrency(data.wholesale)}</p>
        </div>
      </div>
    );
  }

  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
}
