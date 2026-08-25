'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowLeft,
  FiBox,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiGitBranch,
  FiHash,
  FiLock,
  FiPhone,
  FiRefreshCcw,
  FiShield,
  FiShoppingCart,
  FiTrendingUp,
  FiTruck,
  FiUser,
} from 'react-icons/fi';
import api from '../../../../lib/api';
import { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';

interface Truck {
  _id: string;
  truckName: string;
  truckNumber: string;
  driverName: string;
  phoneNumber: string;
  loginId: string;
  monthlySalary?: number;
  status: boolean;
  isOnline?: boolean;
  lastSeenAt?: string;
  branch?: { _id: string; name: string; code?: string } | string;
  createdAt?: string;
}

interface DailyHistory {
  date: string;
  taken: number;
  sold: number;
  returned: number;
  wastage: number;
  remaining: number;
  salesAmount: number;
  paidAmount: number;
  pendingAmount: number;
  driverAmount: number;
  salesCount: number;
}

const indiaDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

function last30Days() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return indiaDate(date);
}

const startOfIndiaDay = (date: string) => `${date}T00:00:00.000+05:30`;
const endOfIndiaDay = (date: string) => `${date}T23:59:59.999+05:30`;

export default function TruckProfilePage() {
  const params = useParams<{ id: string }>();
  const truckId = params.id;
  const { user, loading: authLoading } = useAuth();
  const [truck, setTruck] = useState<Truck | null>(null);
  const [stock, setStock] = useState(0);
  const [todayAssigned, setTodayAssigned] = useState(0);
  const [history, setHistory] = useState<DailyHistory[]>([]);
  const [range, setRange] = useState({ from: last30Days(), to: indiaDate() });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async (activeRange: { from: string; to: string }) => {
    if (activeRange.from && activeRange.to && activeRange.from > activeRange.to) {
      setError('From date cannot be after To date.');
      return;
    }
    setLoadingHistory(true);
    setError('');
    try {
      const dateOnlyParams: Record<string, string> = { truck: truckId };
      const preciseParams: Record<string, string> = { truck: truckId };
      if (activeRange.from) {
        dateOnlyParams.from = activeRange.from;
        preciseParams.from = startOfIndiaDay(activeRange.from);
      }
      if (activeRange.to) {
        dateOnlyParams.to = activeRange.to;
        preciseParams.to = endOfIndiaDay(activeRange.to);
      }
      const [loadResponse, saleResponse, wastageResponse, expenseResponse] = await Promise.all([
        api.get('/truck-loads', { params: dateOnlyParams }),
        api.get('/sales', { params: preciseParams }),
        api.get('/wastage', { params: preciseParams }),
        api.get('/driver-expenses', { params: dateOnlyParams }),
      ]);
      const byDate: Record<string, DailyHistory> = {};
      const ensure = (value: string | Date) => {
        const date = indiaDate(new Date(value));
        return byDate[date] ||= {
          date, taken: 0, sold: 0, returned: 0, wastage: 0, remaining: 0,
          salesAmount: 0, paidAmount: 0, pendingAmount: 0, driverAmount: 0, salesCount: 0,
        };
      };
      for (const load of Array.isArray(loadResponse.data) ? loadResponse.data : []) {
        ensure(load.date).taken += Number(load.quantity || 0);
      }
      for (const sale of Array.isArray(saleResponse.data) ? saleResponse.data : []) {
        const row = ensure(sale.date);
        row.sold += (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0);
        row.salesAmount += Number(sale.totalAmount || 0);
        row.paidAmount += Number(sale.paidAmount || 0);
        row.pendingAmount += Number(sale.balanceAmount || 0);
        row.salesCount += 1;
      }
      for (const wastage of Array.isArray(wastageResponse.data) ? wastageResponse.data : []) {
        const row = ensure(wastage.date);
        if (wastage.reason === 'unsold') row.returned += Number(wastage.quantity || 0);
        else row.wastage += Number(wastage.quantity || 0);
      }
      for (const expense of Array.isArray(expenseResponse.data) ? expenseResponse.data : []) {
        ensure(expense.date).driverAmount += Number(expense.amount || 0);
      }
      setHistory(Object.values(byDate)
        .map((row) => ({ ...row, remaining: row.taken - row.sold - row.returned - row.wastage }))
        .sort((a, b) => b.date.localeCompare(a.date)));
    } catch (requestError: any) {
      setHistory([]);
      setError(requestError?.response?.data?.message || 'Could not load truck history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [truckId]);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    setError('');
    try {
      const today = indiaDate();
      const [truckResponse, stockResponse, assignmentResponse] = await Promise.all([
        api.get(`/trucks/${truckId}`),
        api.get(`/stock/truck/${truckId}`).catch(() => ({ data: { totalStock: 0 } })),
        api.get('/truck-assignments', { params: { truck: truckId, date: today } }).catch(() => ({ data: [] })),
      ]);
      setTruck(truckResponse.data);
      setStock(Number(stockResponse.data?.totalStock || 0));
      const assignments = Array.isArray(assignmentResponse.data) ? assignmentResponse.data : [];
      setTodayAssigned(assignments.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0));
    } catch (requestError: any) {
      setTruck(null);
      setError(requestError?.response?.data?.message || 'Could not load truck profile.');
    } finally {
      setLoadingProfile(false);
    }
  }, [truckId]);

  useEffect(() => {
    void loadProfile();
    void loadHistory({ from: last30Days(), to: indiaDate() });
  }, [loadHistory, loadProfile]);

  const totals = useMemo(() => history.reduce((result, row) => ({
    days: result.days + 1,
    taken: result.taken + row.taken,
    sold: result.sold + row.sold,
    returned: result.returned + row.returned,
    wastage: result.wastage + row.wastage,
    salesAmount: result.salesAmount + row.salesAmount,
    paidAmount: result.paidAmount + row.paidAmount,
    pendingAmount: result.pendingAmount + row.pendingAmount,
    driverAmount: result.driverAmount + row.driverAmount,
    salesCount: result.salesCount + row.salesCount,
  }), { days: 0, taken: 0, sold: 0, returned: 0, wastage: 0, salesAmount: 0, paidAmount: 0, pendingAmount: 0, driverAmount: 0, salesCount: 0 }), [history]);

  const isSuperAdmin = user?.role === 'super_admin';
  const soldRate = totals.taken > 0 ? Math.min(100, Math.round((totals.sold / totals.taken) * 100)) : 0;
  const collectionRate = totals.salesAmount > 0 ? Math.min(100, Math.round((totals.paidAmount / totals.salesAmount) * 100)) : 0;
  const refreshAll = async () => {
    await Promise.all([loadProfile(), loadHistory(range)]);
  };

  if (authLoading || loadingProfile) return <div className="space-y-5"><div className="h-64 animate-pulse rounded-[2rem] bg-navy-900/90" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/70" />)}</div><div className="h-96 animate-pulse rounded-3xl bg-white/70" /></div>;
  if (!truck) return <div className="rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-xl text-red-600"><FiAlertTriangle /></span><p className="mt-4 font-extrabold text-red-600">{error || 'Truck not found or outside your branch.'}</p><p className="mt-2 text-sm text-slate-500">Branch admins can only open trucks assigned to their branch.</p><Link href="/admin/trucks" className="btn-secondary mt-5 inline-flex items-center gap-2"><FiArrowLeft /> Back to trucks</Link></div>;

  const branchName = typeof truck.branch === 'object' && truck.branch ? `${truck.branch.name}${truck.branch.code ? ` (${truck.branch.code})` : ''}` : 'Not available';

  return (
    <div className="min-w-0 space-y-6 pb-24">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-iceblue-100">{isSuperAdmin ? <FiShield /> : <FiLock />}{isSuperAdmin ? 'Super admin truck intelligence' : 'Branch truck workspace'}</div>
            <div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl text-iceblue-200 ring-1 ring-white/10"><FiTruck /></span><div className="min-w-0"><h1 className="break-words text-3xl font-black tracking-[-0.04em] sm:text-4xl">{truck.truckName}</h1><p className="mt-1 font-mono text-sm font-bold text-iceblue-200">{truck.truckNumber}</p></div></div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{isSuperAdmin ? 'Monitor this truck’s dispatch, sales, collections, returns, and driver activity across the network.' : 'Review and manage the operational performance of this truck inside your assigned branch.'}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiGitBranch className="text-iceblue-300" />{branchName}</span>
              <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${truck.isOnline ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.07] text-slate-300'}`}><FiActivity />{truck.isOnline ? 'Online now' : 'Offline'}</span>
              <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${truck.status ? 'border-iceblue-400/20 bg-iceblue-400/10 text-iceblue-200' : 'border-red-400/20 bg-red-400/10 text-red-200'}`}>{truck.status ? <FiCheckCircle /> : <FiAlertTriangle />}{truck.status ? 'Login enabled' : 'Login disabled'}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/admin/trucks" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"><FiArrowLeft /> All trucks</Link><button type="button" onClick={() => void refreshAll()} disabled={loadingHistory || loadingProfile} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50 disabled:opacity-60"><FiRefreshCcw className={loadingHistory ? 'animate-spin' : ''} /> Refresh</button></div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)] lg:col-span-2"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-iceblue-50 text-iceblue-600"><FiTruck /></span><div><h2 className="font-extrabold text-navy-900">Truck identity</h2><p className="text-xs text-slate-500">Vehicle, access, and registration details.</p></div></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"><ProfileDetail icon={FiHash} label="Vehicle number" value={truck.truckNumber} /><ProfileDetail icon={FiUser} label="Assigned driver" value={truck.driverName || 'Not assigned'} /><ProfileDetail icon={FiPhone} label="Driver phone" value={truck.phoneNumber || 'Not provided'} /><ProfileDetail icon={FiUser} label="Login ID" value={truck.loginId || 'Not available'} /><ProfileDetail icon={FiGitBranch} label="Branch" value={branchName} /><ProfileDetail icon={FiCalendar} label="Registered on" value={truck.createdAt ? formatDate(truck.createdAt) : 'Not available'} /></div></div>
        <div className="rounded-3xl bg-gradient-to-br from-iceblue-600 to-navy-900 p-5 text-white shadow-[0_18px_45px_-30px_rgba(15,88,114,0.8)]"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-iceblue-100"><FiBox /></span><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${stock > 0 ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>{stock > 0 ? 'Stock on truck' : 'No stock'}</span></div><p className="mt-7 text-[10px] font-black uppercase tracking-[0.16em] text-iceblue-100/70">Current ice bars</p><p className="mt-1 text-4xl font-black tracking-tight">{formatBarQuantity(stock) || '0'}<span className="ml-2 text-sm font-bold text-iceblue-100/70">bars</span></p><div className="mt-5 border-t border-white/10 pt-4"><p className="text-[10px] font-bold uppercase tracking-wide text-iceblue-100/60">Last seen</p><p className="mt-1 text-xs font-bold text-white/90">{truck.lastSeenAt ? new Date(truck.lastSeenAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'No recent driver activity'}</p></div></div>
      </section>

      <section><div className="mb-4 flex items-center justify-between gap-3 px-1"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><FiTrendingUp /></span><div><h2 className="font-extrabold text-navy-900">Selected-period performance</h2><p className="text-xs text-slate-500">{range.from || 'First record'} to {range.to || 'today'} · {totals.days} active day{totals.days === 1 ? '' : 's'}</p></div></div><span className="rounded-full bg-iceblue-50 px-3 py-1.5 text-[10px] font-bold text-iceblue-700">{soldRate}% dispatched sold · {collectionRate}% collected</span></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><SummaryCard icon={FiBox} label="Today assigned" value={`${formatBarQuantity(todayAssigned) || '0'} bars`} tone="blue" /><SummaryCard icon={FiTruck} label="Bars taken" value={formatBarQuantity(totals.taken) || '0'} tone="cyan" /><SummaryCard icon={FiShoppingCart} label="Bars sold" value={formatBarQuantity(totals.sold) || '0'} tone="emerald" /><SummaryCard icon={FiDollarSign} label="Sales amount" value={formatCurrency(totals.salesAmount)} tone="violet" /><SummaryCard icon={FiClock} label="Pending amount" value={formatCurrency(totals.pendingAmount)} danger={totals.pendingAmount > 0} tone="amber" /><SummaryCard icon={FiRefreshCcw} label="Returned" value={formatBarQuantity(totals.returned) || '0'} tone="cyan" /><SummaryCard icon={FiAlertTriangle} label="Wastage" value={formatBarQuantity(totals.wastage) || '0'} danger={totals.wastage > 0} tone="red" /><SummaryCard icon={FiCheckCircle} label="Amount collected" value={formatCurrency(totals.paidAmount)} tone="emerald" /><SummaryCard icon={FiCreditCard} label="Driver expenses" value={formatCurrency(totals.driverAmount)} tone="violet" /><SummaryCard icon={FiShoppingCart} label="Total bills" value={totals.salesCount} tone="blue" /></div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-end lg:justify-between lg:p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-iceblue-50 text-iceblue-600"><FiCalendar /></span><div><h3 className="font-extrabold text-navy-900">Daily truck history</h3><p className="text-xs text-slate-500">Dispatch, sales, collections, returns, wastage, and expenses by day.</p></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[9rem_9rem_auto_auto] lg:items-end"><div><label className="label-text">From</label><input type="date" className="input-field h-10 text-xs" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></div><div><label className="label-text">To</label><input type="date" className="input-field h-10 text-xs" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></div><button type="button" onClick={() => void loadHistory(range)} className="btn-secondary h-10">Apply</button><button type="button" onClick={() => { const all = { from: '', to: '' }; setRange(all); void loadHistory(all); }} className="btn-secondary h-10">All time</button></div></div>
        {error && <p className="m-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
        {loadingHistory ? <div className="space-y-3 p-5"><div className="h-32 animate-pulse rounded-2xl bg-slate-100" /><div className="h-32 animate-pulse rounded-2xl bg-slate-100" /></div> : <DailyCards rows={history} />}
      </section>
    </div>
  );
}

function DailyCards({ rows }: { rows: DailyHistory[] }) {
  if (!rows.length) return <div className="p-5"><p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center text-sm text-slate-500">No truck records for the selected range.</p></div>;
  return (
    <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-2">
      {rows.map((row) => (
        <article key={row.date} className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 transition hover:border-iceblue-100 hover:shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-iceblue-50 text-iceblue-600"><FiCalendar /></span><div><p className="font-extrabold text-navy-900">{formatDate(`${row.date}T12:00:00+05:30`)}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{row.salesCount} bill{row.salesCount === 1 ? '' : 's'} · {formatCurrency(row.salesAmount)} sales</p></div></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${row.remaining < 0 ? 'bg-red-50 text-red-600' : row.remaining > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>Balance {formatBarQuantity(row.remaining) || '0'} bars</span></div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
            <Metric label="Taken" value={formatBarQuantity(row.taken) || '0'} />
            <Metric label="Sold" value={formatBarQuantity(row.sold) || '0'} />
            <Metric label="Returned" value={formatBarQuantity(row.returned) || '0'} />
            <Metric label="Wastage" value={formatBarQuantity(row.wastage) || '0'} danger={row.wastage > 0} />
            <Metric label="Sales" value={formatCurrency(row.salesAmount)} />
            <Metric label="Collected" value={formatCurrency(row.paidAmount)} />
            <Metric label="Pending" value={formatCurrency(row.pendingAmount)} danger={row.pendingAmount > 0} />
            <Metric label="Driver Amount" value={formatCurrency(row.driverAmount)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ProfileDetail({ icon: Icon, label, value, danger = false }: { icon: typeof FiTruck; label: string; value: string; danger?: boolean }) {
  return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><Icon /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-1 break-words font-semibold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div></div>;
}

function SummaryCard({ icon: Icon, label, value, danger = false, tone = 'blue' }: { icon: typeof FiTruck; label: string; value: string | number; danger?: boolean; tone?: 'blue' | 'cyan' | 'emerald' | 'violet' | 'amber' | 'red' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  }[tone];
  return <div className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${danger ? 'border-red-100' : 'border-white/80'}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? 'bg-red-50 text-red-600' : tones}`}><Icon /></span><div className="min-w-0"><p className="truncate text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 break-words font-display text-base font-extrabold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div></div>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="min-w-0 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 break-words text-sm font-extrabold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>;
}
