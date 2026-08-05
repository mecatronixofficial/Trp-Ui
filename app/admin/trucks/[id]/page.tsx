'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { FiArrowLeft, FiCalendar, FiCreditCard, FiHash, FiPhone, FiTruck, FiUser } from 'react-icons/fi';
import api from '../../../../lib/api';
import { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../../lib/api';

interface Truck {
  _id: string;
  truckName: string;
  truckNumber: string;
  driverName: string;
  phoneNumber: string;
  loginId: string;
  monthlySalary?: number;
  status: boolean;
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
  const [truck, setTruck] = useState<Truck | null>(null);
  const [stock, setStock] = useState(0);
  const [todayAssigned, setTodayAssigned] = useState(0);
  const [history, setHistory] = useState<DailyHistory[]>([]);
  const [range, setRange] = useState({ from: last30Days(), to: indiaDate() });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async (activeRange: { from: string; to: string }) => {
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
  };

  useEffect(() => {
    setLoadingProfile(true);
    setError('');
    const today = indiaDate();
    Promise.all([
      api.get(`/trucks/${truckId}`),
      api.get(`/stock/truck/${truckId}`).catch(() => ({ data: { totalStock: 0 } })),
      api.get('/truck-assignments', { params: { truck: truckId, date: today } }).catch(() => ({ data: [] })),
    ])
      .then(([truckResponse, stockResponse, assignmentResponse]) => {
        setTruck(truckResponse.data);
        setStock(Number(stockResponse.data?.totalStock || 0));
        const assignments = Array.isArray(assignmentResponse.data) ? assignmentResponse.data : [];
        setTodayAssigned(assignments.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0));
      })
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Could not load truck profile.'))
      .finally(() => setLoadingProfile(false));
    void loadHistory(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckId]);

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

  if (loadingProfile) return <div className="card text-sm text-navy-800/50">Loading truck profile...</div>;
  if (!truck) return <div className="card text-center"><p className="font-semibold text-red-600">{error || 'Truck not found.'}</p><Link href="/admin/trucks" className="btn-secondary mt-4 inline-flex items-center gap-2"><FiArrowLeft /> Back to Trucks</Link></div>;

  const branchName = typeof truck.branch === 'object' && truck.branch ? `${truck.branch.name}${truck.branch.code ? ` (${truck.branch.code})` : ''}` : 'Not available';

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/trucks" className="btn-secondary inline-flex items-center gap-2"><FiArrowLeft /> Trucks</Link>
        <span className={`pill ${truck.status ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{truck.status ? 'Active Truck' : 'Inactive Truck'}</span>
      </div>

      <section className="overflow-hidden rounded-3xl border border-iceblue-100 bg-white shadow-ice">
        <div className="bg-navy-900 px-4 py-6 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl text-iceblue-200"><FiTruck /></span>
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-iceblue-200/70">Truck Profile</p><h2 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl">{truck.truckName}</h2><p className="mt-2 text-sm text-white/65">{truck.truckNumber} · {truck.driverName}</p></div>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <ProfileDetail icon={FiHash} label="Truck Number" value={truck.truckNumber} />
          <ProfileDetail icon={FiUser} label="Driver" value={truck.driverName} />
          <ProfileDetail icon={FiPhone} label="Phone" value={truck.phoneNumber || 'Not provided'} />
          <ProfileDetail icon={FiCreditCard} label="Monthly Salary" value={formatCurrency(truck.monthlySalary || 0)} />
          <ProfileDetail icon={FiUser} label="Login ID" value={truck.loginId || 'Not available'} />
          <ProfileDetail icon={FiTruck} label="Branch" value={branchName} />
          <ProfileDetail icon={FiCalendar} label="Registered On" value={truck.createdAt ? formatDate(truck.createdAt) : 'Not available'} />
          <ProfileDetail icon={FiTruck} label="Ice Bars In Truck" value={`${formatBarQuantity(stock) || '0'} bars`} danger={stock < 0} />
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Selected Period Summary</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryCard label="Today Assigned" value={`${formatBarQuantity(todayAssigned) || '0'} bars`} />
          <SummaryCard label="Bars Taken" value={formatBarQuantity(totals.taken) || '0'} />
          <SummaryCard label="Bars Sold" value={formatBarQuantity(totals.sold) || '0'} />
          <SummaryCard label="Sales Amount" value={formatCurrency(totals.salesAmount)} />
          <SummaryCard label="Pending Amount" value={formatCurrency(totals.pendingAmount)} danger={totals.pendingAmount > 0} />
          <SummaryCard label="Returned" value={formatBarQuantity(totals.returned) || '0'} />
          <SummaryCard label="Wastage" value={formatBarQuantity(totals.wastage) || '0'} danger={totals.wastage > 0} />
          <SummaryCard label="Amount Collected" value={formatCurrency(totals.paidAmount)} />
          <SummaryCard label="Driver Amount" value={formatCurrency(totals.driverAmount)} />
          <SummaryCard label="Total Sales" value={totals.salesCount} />
        </div>
      </section>

      <section className="card min-w-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h3 className="font-display text-xl font-bold text-navy-900">Daily Truck History</h3><p className="mt-1 text-sm text-navy-800/50">Bars, sales, collections, returns, wastage, and expenses for each day.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_9rem_auto_auto] lg:items-end">
            <div><label className="label-text">From</label><input type="date" className="input-field" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></div>
            <div><label className="label-text">To</label><input type="date" className="input-field" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></div>
            <button type="button" onClick={() => void loadHistory(range)} className="btn-secondary">Apply</button>
            <button type="button" onClick={() => { const all = { from: '', to: '' }; setRange(all); void loadHistory(all); }} className="btn-secondary">All Time</button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
        {loadingHistory ? <p className="mt-5 text-sm text-navy-800/50">Loading truck history...</p> : <DailyCards rows={history} />}
      </section>
    </div>
  );
}

function DailyCards({ rows }: { rows: DailyHistory[] }) {
  if (!rows.length) return <p className="mt-5 rounded-2xl bg-iceblue-50 px-4 py-8 text-center text-sm text-navy-800/50">No truck records for the selected range.</p>;
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      {rows.map((row) => (
        <article key={row.date} className="overflow-hidden rounded-2xl border border-iceblue-100 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-iceblue-50 px-4 py-3"><div><p className="font-bold text-navy-900">{formatDate(`${row.date}T12:00:00+05:30`)}</p><p className="mt-0.5 text-xs text-navy-800/45">{row.salesCount} sale{row.salesCount === 1 ? '' : 's'}</p></div><span className={`pill ${row.remaining < 0 ? 'bg-red-50 text-red-600' : 'bg-white text-navy-900'}`}>Balance: {formatBarQuantity(row.remaining) || '0'} bars</span></div>
          <div className="grid grid-cols-2 gap-px bg-iceblue-100 sm:grid-cols-4">
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

function SummaryCard({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-2 break-words font-display text-xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="min-w-0 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-1 break-words text-sm font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>;
}
