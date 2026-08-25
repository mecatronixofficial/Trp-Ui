'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertCircle,
  FiBarChart2,
  FiCalendar,
  FiDownload,
  FiFileText,
  FiGitBranch,
  FiGrid,
  FiLock,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import api from '../../../lib/api';
import { formatCurrency } from '../../../lib/api';
import { selectedBranchHeaders } from '../../../lib/branch-fetch';
import { endOfIndiaDay, errorMessage, indiaDateISO, startOfIndiaDay } from '../../../lib/salesUtils';
import { useAuth } from '../../../context/AuthContext';

type Branch = { _id: string; name: string; code: string; isActive?: boolean };

const REPORT_TABS = [
  { key: 'monthly-sales', label: 'Sales Summary' },
  { key: 'profit-loss', label: 'Profit / Loss' },
  { key: 'truck-wise', label: 'Truck-wise' },
  { key: 'customer-wise', label: 'Customer-wise' },
  { key: 'size-wise', label: 'Size-wise' },
  { key: 'wastage', label: 'Wastage' },
  { key: 'expense', label: 'Expense' },
  { key: 'retail-vs-wholesale', label: 'Retail vs Wholesale' },
];

// Reports whose backend endpoint actually reads the `truck` query param
// (see reports.controller.ts / reports.service.ts). Showing the Truck
// filter for the others is a dead control — it looks interactive but
// silently changes nothing, which is worse than not having it.
const TRUCK_FILTER_TABS = new Set(['profit-loss', 'size-wise', 'wastage']);

type ReportPeriod = 'day' | 'week' | 'month' | 'year';

function currentIsoWeek(dateKey = indiaDateISO()) {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodRange(period: ReportPeriod, day: string, week: string, month: string, year: string) {
  const today = indiaDateISO();
  if (period === 'day') {
    const safeDay = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;
    return { from: safeDay, to: safeDay };
  }
  if (period === 'month') {
    const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
    const [monthYear, monthNumber] = safeMonth.split('-').map(Number);
    const finalDay = new Date(Date.UTC(monthYear, monthNumber, 0)).getUTCDate();
    return { from: `${safeMonth}-01`, to: `${safeMonth}-${String(finalDay).padStart(2, '0')}` };
  }
  if (period === 'year') {
    const safeYear = /^\d{4}$/.test(year) ? year : today.slice(0, 4);
    return { from: `${safeYear}-01-01`, to: `${safeYear}-12-31` };
  }

  const safeWeek = /^\d{4}-W\d{2}$/.test(week) ? week : currentIsoWeek(today);
  const [weekYear, weekNumber] = safeWeek.split('-W').map(Number);
  const januaryFourth = new Date(Date.UTC(weekYear, 0, 4));
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() || 7) - 1));
  const monday = new Date(firstMonday);
  monday.setUTCDate(firstMonday.getUTCDate() + ((weekNumber - 1) * 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

const expenseCategoryLabel = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (['food', 'food_expenses', 'snack', 'snacks', 'snacks_expenses'].includes(normalized)) return 'Food';
  if (['advance', 'advance_for_emp', 'advance_for_employee', 'employee_advance'].includes(normalized)) return 'Worker Amount';
  if (['petrol', 'diesel', 'petrol_diesel'].includes(normalized)) return 'Petrol / Diesel';
  if (['chat', 'chat_expense', 'chat_expenses', 'communication', 'other_expense', 'other_expenses'].includes(normalized)) return 'Other Expenses';
  return String(value || 'Other').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const storedExpenseCategory = (notes = '') => {
  const match = String(notes).split('\n')[0].match(/^\[\[expense-category:(.+)\]\]$/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
};

async function loadExpenseReport(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`/api/expenses?${query.toString()}`, {
    cache: 'no-store',
    headers: selectedBranchHeaders(),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Could not load expenses for this report.');
  const records = Array.isArray(payload?.records) ? payload.records : [];
  const totalExpenses = records.reduce((sum: number, record: any) => sum + Number(record.amount || 0), 0);
  const categories = records.reduce((grouped: Record<string, number>, record: any) => {
    const label = expenseCategoryLabel(storedExpenseCategory(record.notes) || record.costType);
    grouped[label] = (grouped[label] || 0) + Number(record.amount || 0);
    return grouped;
  }, {});
  return { records, totalExpenses, categories };
}

const referenceId = (value: any) => String(value?._id || value || '');

async function loadCollectionAmount(from: string, to: string, truck = '') {
  const { data } = await api.get('/sales', {
    params: { from: startOfIndiaDay(from), to: endOfIndiaDay(to) },
  });
  const sales = (Array.isArray(data) ? data : []).filter(
    (sale: any) => !truck || referenceId(sale.truck) === truck,
  );
  return sales.reduce(
    (sum: number, sale: any) => sum + Number(sale.paidAmount || 0),
    0,
  );
}

function mergeProfitExpenses(reportData: any, totalExpenses: number, collectionAmount: number) {
  const merged: Record<string, any> = { ...(reportData || {}), totalExpenses };
  const profit = collectionAmount - totalExpenses;
  const collectionKeys = ['collectionAmount', 'totalCollection', 'totalCollected', 'collectedAmount'];
  const profitKeys = ['profit', 'netProfit', 'totalProfit'];
  const lossKeys = ['loss', 'totalLoss'];

  const existingCollectionKeys = collectionKeys.filter((key) => key in merged);
  (existingCollectionKeys.length ? existingCollectionKeys : ['collectionAmount'])
    .forEach((key) => { merged[key] = collectionAmount; });

  const existingProfitKeys = profitKeys.filter((key) => key in merged);
  (existingProfitKeys.length ? existingProfitKeys : ['profit'])
    .forEach((key) => { merged[key] = profit; });

  lossKeys.filter((key) => key in merged)
    .forEach((key) => { merged[key] = Math.max(-profit, 0); });
  return merged;
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('profit-loss');
  const today = indiaDateISO();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [reportDay, setReportDay] = useState(today);
  const [reportWeek, setReportWeek] = useState(currentIsoWeek(today));
  const [reportMonth, setReportMonth] = useState(today.slice(0, 7));
  const [reportYear, setReportYear] = useState(today.slice(0, 4));
  const [truck, setTruck] = useState('');
  const [trucks, setTrucks] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [topSizes, setTopSizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reportRequest = useRef(0);
  const isSuperAdmin = user?.role === 'super_admin';
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const overallView = Boolean(isSuperAdmin && !selectedBranch);
  const scopeName = overallView ? 'All branches' : activeBranch?.name || 'Assigned branch';
  const showTruckFilter = TRUCK_FILTER_TABS.has(tab);
  const { from, to } = useMemo(
    () => periodRange(period, reportDay, reportWeek, reportMonth, reportYear),
    [period, reportDay, reportWeek, reportMonth, reportYear],
  );

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'monthly-sales') setTab('monthly-sales');
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const storedBranch = window.localStorage.getItem('tii_selected_branch') || '';
    setSelectedBranch(isSuperAdmin ? storedBranch : user?.branch || '');
    if (isSuperAdmin) {
      api.get('/branches')
        .then(({ data }) => setBranches(Array.isArray(data) ? data : []))
        .catch(() => setBranches([]));
    }
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    api.get('/trucks')
      .then(({ data }) => setTrucks(Array.isArray(data) ? data : []))
      .catch(() => setTrucks([]));
  }, [authLoading, selectedBranch]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  const load = async () => {
    const requestId = ++reportRequest.current;
    setLoading(true);
    setError('');
    const params: any = { from, to };
    if (truck && showTruckFilter) params.truck = truck;
    try {
      const reportRequestPromise = tab === 'monthly-sales'
        ? api.get('/sales', { params: { from: startOfIndiaDay(from), to: endOfIndiaDay(to) } }).then(({ data: saleData }) => {
          const rows = Array.isArray(saleData) ? saleData : [];
          return { data: rows.reduce((total: any, sale: any) => ({
            salesCount: total.salesCount + 1,
            totalSale: total.totalSale + Number(sale.totalAmount || 0),
            collectionAmount: total.collectionAmount + Number(sale.paidAmount || 0),
            pendingAmount: total.pendingAmount + Number(sale.balanceAmount || 0),
          }), { totalSale: 0, collectionAmount: 0, pendingAmount: 0, salesCount: 0 }) };
        })
        : tab === 'expense'
          ? loadExpenseReport(from, to).then((expenseData) => ({ data: expenseData.categories }))
          : tab === 'profit-loss'
            ? Promise.all([
                api.get('/reports/profit-loss', { params }),
                loadExpenseReport(from, to),
                loadCollectionAmount(from, to, truck),
              ]).then(([reportResponse, expenseData, collectionAmount]) => ({
                data: mergeProfitExpenses(reportResponse.data, expenseData.totalExpenses, collectionAmount),
              }))
            : api.get(`/reports/${tab}`, { params });
      const [res, tc, ts] = await Promise.all([
        reportRequestPromise,
        api.get('/reports/top-customers', { params: { from, to } }),
        api.get('/reports/top-sizes', { params: { from, to } }),
      ]);
      if (requestId !== reportRequest.current) return;
      setData(res.data);
      setTopCustomers(Array.isArray(tc.data) ? tc.data : []);
      setTopSizes(Array.isArray(ts.data) ? ts.data : []);
    } catch (err: any) {
      if (requestId !== reportRequest.current) return;
      setData(null);
      setTopCustomers([]);
      setTopSizes([]);
      setError(errorMessage(err, 'Could not load this report.'));
    } finally {
      if (requestId === reportRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, selectedBranch, tab, period, reportDay, reportWeek, reportMonth, reportYear, truck]);

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
    <div className="min-w-0 space-y-6 overflow-x-hidden pb-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-iceblue-100">
              {isSuperAdmin ? <FiShield /> : <FiLock />}
              {isSuperAdmin ? 'Super admin analytics centre' : 'Branch analytics workspace'}
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Reports &amp; analytics</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {overallView
                ? `Consolidated sales, profitability, customers, trucks, wastage, and expenses across ${branches.length} branches.`
                : `Performance reports and business exports for ${scopeName}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiGitBranch className="text-iceblue-300" />{scopeName}</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiCalendar className="text-emerald-300" />{from} – {to}</span>
            <button onClick={exportExcel} disabled={!data} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-40"><FiDownload /> Excel</button>
            <button onClick={exportPdf} disabled={!data} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50 disabled:opacity-40"><FiFileText /> PDF</button>
          </div>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-white/80 bg-white/90 p-2.5 shadow-[0_14px_40px_-30px_rgba(15,43,61,0.4)] backdrop-blur-sm">
          <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => changeBranch('')} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${overallView ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><FiGrid /> All branches <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${overallView ? 'bg-white/10' : 'bg-slate-100'}`}>{branches.length}</span></button>
            <span className="h-6 w-px shrink-0 bg-slate-200" />
            {branches.filter((branch) => branch.isActive !== false).map((branch) => (
              <button key={branch._id} type="button" onClick={() => changeBranch(branch._id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${selectedBranch === branch._id ? 'bg-iceblue-50 text-iceblue-700 ring-1 ring-inset ring-iceblue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><span className="h-2 w-2 rounded-full bg-emerald-500" />{branch.name}<span className="text-[9px] font-semibold text-slate-400">{branch.code}</span></button>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><FiTrendingUp /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Assigned branch reporting</p><p className="mt-0.5 text-[10px] text-slate-500">All reports and exports are automatically limited to your branch.</p></div>
        </section>
      )}

      <section className="min-w-0 overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4 sm:p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-iceblue-50 text-iceblue-600"><FiCalendar /></span><div><h2 className="font-extrabold text-navy-900">Report period</h2><p className="mt-0.5 text-[10px] text-slate-500">Choose the reporting window and optional truck scope.</p></div></div>
        <div className="grid grid-cols-4 gap-1.5 border-b border-slate-100 bg-slate-50/50 px-3 pt-3 sm:flex sm:flex-wrap sm:gap-2 sm:px-5">
          {(['day', 'week', 'month', 'year'] as ReportPeriod[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={`min-h-11 rounded-t-xl px-2 py-2 text-xs font-bold capitalize transition sm:min-h-0 sm:px-4 sm:text-sm ${period === item ? 'bg-navy-900 text-white shadow-sm' : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-100 hover:text-navy-900'}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="grid min-w-0 grid-cols-1 items-end gap-3 px-3 py-4 sm:flex sm:flex-wrap sm:px-5">
          {period === 'day' && <div className="w-full sm:w-[170px]"><label className="label-text">Report Day</label><input type="date" className="input-field h-11 sm:h-10" value={reportDay} onChange={(event) => setReportDay(event.target.value)} /></div>}
          {period === 'week' && <div className="w-full sm:w-[180px]"><label className="label-text">Report Week</label><input type="week" className="input-field h-11 sm:h-10" value={reportWeek} onChange={(event) => setReportWeek(event.target.value)} /></div>}
          {period === 'month' && <div className="w-full sm:w-[170px]"><label className="label-text">Report Month</label><input type="month" className="input-field h-11 sm:h-10" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></div>}
          {period === 'year' && <div className="w-full sm:w-[150px]"><label className="label-text">Report Year</label><input type="number" min="2000" max="9999" step="1" className="input-field h-11 sm:h-10" value={reportYear} onChange={(event) => setReportYear(event.target.value.replace(/\D/g, '').slice(0, 4))} /></div>}
          <div className="min-w-0 rounded-xl border border-iceblue-100 bg-iceblue-50 px-3 py-2.5 text-xs text-navy-800/70 sm:w-auto">
            <span className="font-semibold text-navy-900">{from}</span> to <span className="font-semibold text-navy-900">{to}</span>
          </div>
          {showTruckFilter && (
            <div className="w-full sm:w-[180px]">
              <label className="label-text">Truck</label>
              <select className="input-field h-11 sm:h-10" value={truck} onChange={(e) => setTruck(e.target.value)}>
                <option value="">All</option>
                {trucks.map((t) => <option key={t._id} value={t._id}>{t.truckName}</option>)}
              </select>
            </div>
          )}
          <button onClick={load} disabled={loading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-xs font-bold text-white transition hover:bg-iceblue-800 disabled:opacity-50 sm:min-h-10 sm:w-auto"><FiRefreshCw className={loading ? 'animate-spin' : ''} />Refresh report</button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3 px-1"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><FiBarChart2 /></span><div><h2 className="font-extrabold text-navy-900">Report type</h2><p className="text-xs text-slate-500">Switch between operational and financial analysis.</p></div></div>
        <div className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 touch-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
          {REPORT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setData(null); setError(''); setTab(t.key); }}
              className={`min-h-11 shrink-0 snap-start whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition ${
                tab === t.key ? 'bg-navy-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-navy-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div><h2 className="font-extrabold text-navy-900">{REPORT_TABS.find((item) => item.key === tab)?.label}</h2><p className="mt-0.5 text-[10px] text-slate-500">{scopeName} · {from} to {to}</p></div>
          <span className="rounded-full bg-iceblue-50 px-2.5 py-1 text-[9px] font-bold text-iceblue-700">Live report</span>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          {loading ? (
            <div className="grid min-h-48 place-items-center text-center"><div><FiRefreshCw className="mx-auto animate-spin text-xl text-iceblue-600" /><p className="mt-3 text-xs font-semibold text-slate-500">Loading report...</p></div></div>
          ) : error ? (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : (
            <ReportBody tab={tab} data={data} />
          )}
        </div>
      </section>

      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><FiTrendingUp /></span><div><h2 className="font-extrabold text-navy-900">Top customers</h2><p className="mt-0.5 text-[10px] text-slate-500">Highest sales value in this period.</p></div>
          </div>
          <div className="sm:hidden">
            {topCustomers.map((c, index) => (
              <div key={c.customerId} className="border-b border-slate-100 px-3 py-3 last:border-b-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-navy-800/45">{String(index + 1).padStart(2, '0')}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-navy-900">{c.customerName}</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 pl-9">
                  <p className="text-xs font-semibold text-navy-800/60"><span className="font-bold text-navy-900">{c.quantity}</span> Bars</p>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-iceblue-700">{formatCurrency(c.totalAmount)}</p>
                </div>
              </div>
            ))}
            {topCustomers.length === 0 && <p className="px-3 py-6 text-center text-sm text-navy-800/50">No data</p>}
          </div>
          <div className="hidden max-w-full overflow-x-auto sm:block">
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
        <section className="min-w-0 overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><FiBarChart2 /></span><div><h2 className="font-extrabold text-navy-900">Top-selling sizes</h2><p className="mt-0.5 text-[10px] text-slate-500">Most requested ice-bar sizes.</p></div>
          </div>
          <div className="sm:hidden">
            {topSizes.map((s, index) => (
              <div key={s.size} className="border-b border-slate-100 px-3 py-3 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-navy-800/45">{String(index + 1).padStart(2, '0')}</span>
                  <p className="text-sm font-bold text-navy-900">{s.size} bar</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 pl-9">
                  <p className="text-xs font-medium text-navy-800/50">Quantity</p>
                  <p className="text-sm font-bold tabular-nums text-navy-900">{s.quantity}</p>
                </div>
              </div>
            ))}
            {topSizes.length === 0 && <p className="px-3 py-6 text-center text-sm text-navy-800/50">No data</p>}
          </div>
          <div className="hidden max-w-full overflow-x-auto sm:block">
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

  if (tab === 'monthly-sales') {
    const metrics = [
      { key: 'totalSale', label: 'Total Sale', value: formatCurrency(Number(data.totalSale || 0)), trend: 'up' as const },
      { key: 'collectionAmount', label: 'Collection Amount', value: formatCurrency(Number(data.collectionAmount || 0)), trend: 'up' as const },
      { key: 'pendingAmount', label: 'Pending Amount', value: formatCurrency(Number(data.pendingAmount || 0)), trend: 'down' as const },
      { key: 'salesCount', label: 'Sales Count', value: String(Number(data.salesCount || 0)), trend: 'up' as const },
    ];
    return (
      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => <ReportMetric key={metric.key} index={index} label={metric.label} value={metric.value} trend={metric.trend} />)}
      </div>
    );
  }

  if (tab === 'profit-loss') {
    return (
      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
        {Object.entries(data).filter(([k]) => k !== 'from' && k !== 'to').map(([k, v]: any, index) => {
          const normalizedKey = k.toLowerCase();
          const isCount = ['count', 'quantity', 'bars', 'units', 'records'].some((word) => normalizedKey.includes(word));
          const currency = typeof v === 'number' && !isCount
            && ['sale', 'profit', 'loss', 'expense', 'collect', 'pending', 'outstanding', 'cost', 'amount'].some((word) => normalizedKey.includes(word));
          const trend: 'up' | 'down' = ['loss', 'expense', 'outstanding', 'pending', 'cost', 'wastage'].some((word) => normalizedKey.includes(word)) ? 'down' : 'up';
          const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
          return <ReportMetric key={k} index={index} label={label} value={currency ? formatCurrency(v) : String(v)} trend={trend} />;
        })}
      </div>
    );
  }

  // truck-wise / customer-wise: object keyed by id with { *Name, totalAmount, quantity }
  if (tab === 'truck-wise' || tab === 'customer-wise') {
    const rows = Object.entries(data);
    return (
      <>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:hidden">
          {rows.map(([id, v]: any, index) => (
            <div key={id} className="border-b border-slate-100 px-3 py-3 last:border-b-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-navy-800/45">{String(index + 1).padStart(2, '0')}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-navy-900">{v.truckName || v.customerName}</p>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 pl-9">
                <p className="text-xs font-semibold text-navy-800/60"><span className="font-bold text-navy-900">{v.quantity}</span> Bars</p>
                <p className="shrink-0 text-sm font-bold tabular-nums text-iceblue-700">{formatCurrency(v.totalAmount)}</p>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-navy-800/50">No data</p>}
        </div>
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-slate-200 sm:block">
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
      </>
    );
  }

  if (tab === 'size-wise' || tab === 'wastage') {
    const rows = Object.entries(data);
    return (
      <>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:hidden">
          {rows.map(([size, rawValue]: any, index) => {
            const row = rawValue && typeof rawValue === 'object' ? rawValue : null;
            const label = row?.size || size;
            const quantity = row ? Number(row.quantity ?? row.wastage ?? row.total ?? 0) : Number(rawValue || 0);
            return (
              <div key={size} className="border-b border-slate-100 px-3 py-3 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-navy-800/45">{String(index + 1).padStart(2, '0')}</span>
                  <p className="text-sm font-bold text-navy-900">{label} bar</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 pl-9">
                  <p className="text-xs font-medium text-navy-800/50">Quantity</p>
                  <p className="text-sm font-bold tabular-nums text-navy-900">{quantity}</p>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-navy-800/50">No data</p>}
        </div>
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-slate-200 sm:block">
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
      </>
    );
  }

  if (tab === 'expense') {
    const rows = Object.entries(data);
    return (
      <>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:hidden">
          {rows.map(([type, amt]: any, index) => (
            <div key={type} className="border-b border-slate-100 px-3 py-3 last:border-b-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-navy-800/45">{String(index + 1).padStart(2, '0')}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-bold capitalize text-navy-900">{type.replace('_', ' ')}</p>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 pl-9">
                <p className="text-xs font-medium text-navy-800/50">Amount</p>
                <p className="shrink-0 text-sm font-bold tabular-nums text-iceblue-700">{formatCurrency(amt)}</p>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-navy-800/50">No data</p>}
        </div>
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-slate-200 sm:block">
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
      </>
    );
  }

  if (tab === 'retail-vs-wholesale') {
    return (
      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:max-w-xl">
        <ReportMetric index={0} label="Retail" value={formatCurrency(data.retail)} trend="up" />
        <ReportMetric index={1} label="Wholesale" value={formatCurrency(data.wholesale)} trend="up" />
      </div>
    );
  }

  return <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(data, null, 2)}</pre>;
}

function ReportMetric({ label, value, trend, index = 0 }: { label: string; value: string; trend: 'up' | 'down'; index?: number }) {
  const tones = ['blue', 'cyan', 'violet', 'amber'] as const;
  const tone = tones[index % tones.length];
  const styles = {
    blue: { soft: 'bg-blue-50', icon: 'bg-blue-500', border: 'border-blue-100' },
    cyan: { soft: 'bg-cyan-50', icon: 'bg-cyan-500', border: 'border-cyan-100' },
    violet: { soft: 'bg-violet-50', icon: 'bg-violet-500', border: 'border-violet-100' },
    amber: { soft: 'bg-amber-50', icon: 'bg-amber-500', border: 'border-amber-100' },
  }[tone];
  const danger = trend === 'down';

  return (
    <div className={`relative min-h-[105px] min-w-0 overflow-hidden rounded-2xl border bg-white p-3.5 shadow-[0_14px_35px_-28px_rgba(15,43,61,0.45)] transition hover:-translate-y-0.5 hover:shadow-md ${danger ? 'border-red-100' : styles.border}`}>
      <span className={`absolute -right-6 -top-6 h-16 w-16 rounded-full ${danger ? 'bg-red-50' : styles.soft}`} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className={`mt-2 break-words text-base font-black leading-tight ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs text-white shadow-sm ${danger ? 'bg-red-500' : styles.icon}`}><FiFileText /></span>
      </div>
    </div>
  );
}
