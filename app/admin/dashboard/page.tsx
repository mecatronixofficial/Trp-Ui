'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FiBox,
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiPackage,
  FiShoppingCart,
  FiTrendingUp,
  FiTrash2,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency, formatDate, todayISO } from '../../../lib/api';

const chartColors = ['#1ca6d1', '#16a34a', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'];

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [profitChart, setProfitChart] = useState<any[]>([]);
  const [dailyClosings, setDailyClosings] = useState<any[]>([]);
  const [todayClosings, setTodayClosings] = useState<any[]>([]);
  const [reportDate, setReportDate] = useState(todayISO());
  const [closingLoading, setClosingLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [closingError, setClosingError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoadError('');
        const [dashResult, profitResult, closingResult] = await Promise.allSettled([
          api.get('/dashboard/admin'),
          api.get('/dashboard/monthly-profit'),
          api.get('/daily-closing', { params: { date: todayISO() } }),
        ]);
        if (dashResult.status === 'rejected') throw dashResult.reason;
        setData(dashResult.value.data);
        setProfitChart(profitResult.status === 'fulfilled' ? profitResult.value.data : []);
        setTodayClosings(closingResult.status === 'fulfilled' ? closingResult.value.data || [] : []);
      } catch (error: any) {
        setLoadError(error?.response?.data?.message || (error?.message === 'Network Error' ? 'Cannot connect to the API at http://localhost:4000. Please start or restart the backend server.' : error?.message) || 'Could not load dashboard data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setClosingLoading(true);
    setClosingError('');
    api.get('/daily-closing', { params: { date: reportDate } })
      .then((response) => setDailyClosings(response.data || []))
      .catch((error: any) => {
        setDailyClosings([]);
        setClosingError(error?.response?.data?.message || (error?.message === 'Network Error' ? 'Cannot connect to the API.' : error?.message) || 'Could not load the daily closing report.');
      })
      .finally(() => setClosingLoading(false));
  }, [reportDate]);

  const dailyReport = useMemo(() => dailyClosings.reduce((total, row) => ({
    opening: total.opening + Number(row.openingBalance || 0),
    made: total.made + Number(row.produced || 0),
    sold: total.sold + Number(row.sold || 0),
    returned: total.returned + Number(row.returned || 0),
    wastage: total.wastage + Number(row.wastage || 0),
    sales: total.sales + Number(row.sellingAmount || 0),
    cost: total.cost + Number(row.makingCost || 0),
    profit: total.profit + Number(row.profit || 0),
    closed: total.closed + (row.status === 'closed' ? 1 : 0),
  }), { opening: 0, made: 0, sold: 0, returned: 0, wastage: 0, sales: 0, cost: 0, profit: 0, closed: 0 }), [dailyClosings]);

  const todayClosingTotals = useMemo(() => todayClosings.reduce((total, row) => ({
    returned: total.returned + Number(row.returned || 0),
    wastage: total.wastage + Number(row.wastage || 0),
  }), { returned: 0, wastage: 0 }), [todayClosings]);

  const dashboard = useMemo(() => {
    if (!data) return null;

    const truckRows = Object.entries(data.truckWiseSalesToday || {}).map(([id, row]: any) => ({
      id,
      truckName: row.truckName || 'Truck',
      quantity: Number(row.quantity || 0),
      totalAmount: Number(row.totalAmount || 0),
    }));
    const soldBars = truckRows.reduce((sum, row) => sum + row.quantity, 0);
    const stockRows = data.pendingStock?.sizeWise || [];
    const stockChart = stockRows.map((row: any) => ({
      size: `${row.size} bar`,
      quantity: Number(row.quantity || 0),
    }));
    const paymentMix = [
      { name: 'Collected', value: Number(data.today.collection || 0), color: '#16a34a' },
      { name: 'Balance', value: Number(data.today.balance || 0), color: '#ef4444' },
      { name: 'Old Payments', value: Number(data.payments?.todayCollectedLater || 0), color: '#1ca6d1' },
    ].filter((row) => row.value > 0);
    const last7DaysSales = (data.last7DaysSales || []).map((row: any) => ({
      ...row,
      label: formatDate(row.date).replace(/ 202\d/, ''),
    }));
    const monthlyProfit = profitChart.map((row) => ({
      ...row,
      label: String(row.month || '').slice(5) || row.month,
    }));

    return {
      truckRows,
      soldBars,
      stockChart,
      paymentMix,
      last7DaysSales,
      monthlyProfit,
      pendingPayments: data.payments?.pendingBills || [],
      recentPayments: data.payments?.recentToday || [],
      truckCustomerRows: Object.entries(data.customers?.truckWise || {}),
      recentCustomers: data.customers?.recent || [],
    };
  }, [data, profitChart]);

  if (loading) {
    return (
      <div className="grid min-h-[45vh] place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-2xl border-4 border-iceblue-100 border-t-iceblue-500" />
          <p className="font-medium text-navy-800/70">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  if (!data || !dashboard) return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700"><p className="font-semibold">Dashboard unavailable</p><p className="mt-2 text-sm">{loadError || 'Could not load dashboard data.'}</p><button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-4">Retry</button></div>;

  const stockTotal = Number(data.pendingStock?.totalClosingStock || 0);
  const pendingAmount = Number(data.payments?.pendingAmount || 0);
  const todayProfit = Number(data.today.profit || 0);
  const workerBuying = Number(data.today.workerBuying || 0);

  return (
    <div className="space-y-5 pb-8 xl:space-y-6">
      <section className="overflow-hidden rounded-[1.5rem] bg-white shadow-ice border border-iceblue-100">
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] xl:items-stretch">
          <div className="min-w-0 rounded-[1.25rem] bg-[linear-gradient(135deg,#0a1c2a_0%,#136a8b_52%,#1ca6d1_100%)] p-5 text-white sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50/75">Admin Dashboard</p>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Tiruppur Ice Control</h1>
            <p className="mt-2 max-w-2xl text-sm text-cyan-50/80">
              Production, sales, collection, stock, and customer dues in one view.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <HeroMetric label="Production" value={data.today.production} suffix="bars" />
              <HeroMetric label="Bar Used" value={dashboard.soldBars} suffix="bar used" />
              <HeroMetric label="Collection" value={formatCurrency(data.today.collection)} />
              <HeroMetric label="Profit" value={formatCurrency(todayProfit)} tone={todayProfit >= 0 ? 'good' : 'bad'} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
            <KpiCard icon={FiShoppingCart} label="Today Sales" value={formatCurrency(data.today.sales)} tone="green" />
            <KpiCard icon={FiTrash2} label="Today Wastage" value={todayClosingTotals.wastage} suffix="bars" tone="red" />
            <KpiCard icon={FiPackage} label="Today Returns" value={todayClosingTotals.returned} suffix="bars" tone="amber" />
            <KpiCard icon={FiPackage} label="Pending Stock" value={stockTotal} suffix="bars" tone="blue" />
            <KpiCard icon={FiClock} label="Pending Bills" value={formatCurrency(pendingAmount)} tone="amber" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={FiDollarSign} label="Making Cost" value={formatCurrency(data.today.makingCost)} tone="amber" />
        <KpiCard icon={FiUserCheck} label="Worker Buying" value={formatCurrency(workerBuying)} tone="red" />
        <KpiCard icon={FiTrendingUp} label="Monthly Sales" value={formatCurrency(data.monthlySales)} tone="green" />
        <KpiCard icon={FiShoppingCart} label="Yearly Sales" value={formatCurrency(data.yearlySales)} tone="blue" />
        <KpiCard icon={FiDollarSign} label="Old Payments Today" value={formatCurrency(data.payments?.todayCollectedLater || 0)} tone="navy" />
      </section>

      <section className="rounded-[1.25rem] border border-iceblue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-display text-lg font-semibold text-navy-900">Daily Closing Report</h2><p className="mt-1 text-xs text-navy-800/50">Branch status and final bar tally for the selected day</p></div>
          <label className="flex items-center gap-2 rounded-xl bg-iceblue-50 px-3 py-2 text-iceblue-700"><FiCalendar /><input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="bg-transparent text-sm font-semibold outline-none" /></label>
        </div>
        {closingLoading ? <p className="py-8 text-center text-sm text-navy-800/50">Loading daily report...</p> : closingError ? <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">{closingError}</div> : <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            <DailyMetric label="Made" value={dailyReport.made} />
            <DailyMetric label="Sold" value={dailyReport.sold} />
            <DailyMetric label="Returned" value={dailyReport.returned} />
            <DailyMetric label="Wastage" value={dailyReport.wastage} danger={dailyReport.wastage > 0} />
            <DailyMetric label="Sales" value={formatCurrency(dailyReport.sales)} />
            <DailyMetric label="Making Cost" value={formatCurrency(dailyReport.cost)} />
            <DailyMetric label={dailyReport.profit >= 0 ? 'Profit' : 'Loss'} value={formatCurrency(dailyReport.profit)} danger={dailyReport.profit < 0} />
            <DailyMetric label="Branches Closed" value={`${dailyReport.closed}/${dailyClosings.length}`} danger={dailyReport.closed !== dailyClosings.length} />
          </div>
          <div className={`mt-4 rounded-xl border px-4 py-3 ${dailyReport.opening + dailyReport.made === dailyReport.sold + dailyReport.returned + dailyReport.wastage ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <p className="text-sm font-semibold">Final tally: {dailyReport.opening + dailyReport.made} available = {dailyReport.sold} sold + {dailyReport.returned} returned + {dailyReport.wastage} wastage</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dailyClosings.map((row) => <div key={row._id} className={`rounded-xl border p-3 ${row.status === 'closed' ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-100 bg-amber-50/60'}`}><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-navy-900">{row.branch?.name || 'Branch'}</p><p className="mt-1 text-xs text-navy-800/50">Made {row.produced} · Sold {row.sold} · Return {row.returned} · Wastage {row.wastage}</p></div><span className={`flex items-center gap-1 text-xs font-semibold ${row.status === 'closed' ? 'text-emerald-700' : 'text-amber-700'}`}>{row.status === 'closed' ? <FiCheckCircle /> : <FiAlertCircle />}{row.status === 'closed' ? 'Closed' : 'Not Closed'}</span></div></div>)}
            {dailyClosings.length === 0 && <p className="text-sm text-navy-800/50">No branch report available for this date.</p>}
          </div>
        </>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Panel title="Last 7 Days Sales" icon={FiTrendingUp}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dashboard.last7DaysSales}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1ca6d1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#1ca6d1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#dff5fd" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Number(v) / 1000}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              <Area type="monotone" dataKey="total" stroke="#1284ac" strokeWidth={3} fill="url(#salesFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Today Collection" icon={FiDollarSign}>
          {dashboard.paymentMix.length === 0 ? (
            <EmptyState text="No collection data today." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={dashboard.paymentMix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={4}>
                  {dashboard.paymentMix.map((entry, index) => (
                    <Cell key={entry.name} fill={entry.color || chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Monthly Sales, Cost, Profit" icon={FiTrendingUp}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={dashboard.monthlyProfit}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dff5fd" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Number(v) / 1000}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#1ca6d1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Truck-wise Sales Today" icon={FiBox}>
          {dashboard.truckRows.length === 0 ? (
            <EmptyState text="No truck sales recorded today." />
          ) : (
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={dashboard.truckRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dff5fd" />
                <XAxis dataKey="truckName" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Number(v) / 1000}k`} />
                <Tooltip formatter={(v: any, name: any) => (name === 'Sales' ? formatCurrency(Number(v)) : v)} />
                <Legend />
                <Bar yAxisId="left" dataKey="quantity" name="Bar Used" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="totalAmount" name="Sales" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <Panel title="Pending Stock Size-wise" icon={FiPackage}>
          {dashboard.stockChart.length === 0 ? (
            <EmptyState text="No stock data available." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dashboard.stockChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dff5fd" />
                <XAxis dataKey="size" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="quantity" name="Bars" fill="#1ca6d1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Pending Customer Payments" icon={FiClock}>
          {dashboard.pendingPayments.length === 0 ? (
            <EmptyState text="No pending payments." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[720px]">
                <thead>
                  <tr>
                    <th>Bill Date</th>
                    <th>Customer</th>
                    <th>Truck</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.pendingPayments.map((sale: any) => (
                    <tr key={sale._id}>
                      <td>{formatDate(sale.date)}</td>
                      <td>
                        <p className="font-medium">{sale.customer?.name}</p>
                        <p className="text-xs text-navy-800/45">{sale.customer?.phoneNumber || 'No phone'}</p>
                      </td>
                      <td>{sale.truck?.truckName || '-'}</td>
                      <td>{formatCurrency(sale.totalAmount)}</td>
                      <td>{formatCurrency(sale.paidAmount)}</td>
                      <td className="font-semibold text-red-500">{formatCurrency(sale.balanceAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Payments Collected Today" icon={FiDollarSign}>
          {dashboard.recentPayments.length === 0 ? (
            <EmptyState text="No old payments collected today." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[620px]">
                <thead>
                  <tr>
                    <th>Payment Date</th>
                    <th>Customer</th>
                    <th>Truck</th>
                    <th>Mode</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentPayments.map((payment: any, index: number) => (
                    <tr key={`${payment.saleId}-${index}`}>
                      <td>{formatDate(payment.date)}</td>
                      <td>
                        <p className="font-medium">{payment.customer?.name}</p>
                        <p className="text-xs text-navy-800/45">Bill: {formatDate(payment.billDate)}</p>
                      </td>
                      <td>{payment.truck?.truckName || '-'}</td>
                      <td className="capitalize">{payment.paymentMode}</td>
                      <td className="font-semibold text-emerald-600">{formatCurrency(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Recent Customers" icon={FiUsers}>
          {dashboard.recentCustomers.length === 0 ? (
            <EmptyState text="No customers yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {dashboard.recentCustomers.map((customer: any) => (
                <div key={customer._id} className="rounded-xl border border-iceblue-100 bg-iceblue-50/60 p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-iceblue-600">
                      <FiUsers />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-900">{customer.name}</p>
                      <p className="mt-1 text-xs text-navy-800/55">{customer.phoneNumber || 'No phone'}</p>
                      <p className="mt-1 text-xs text-navy-800/45">
                        {customer.truck?.truckName || 'Local'} · {formatDate(customer.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function HeroMetric({ label, value, suffix, tone = 'normal' }: { label: string; value: string | number; suffix?: string; tone?: 'normal' | 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-white/12 p-3 ring-1 ring-white/15 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase text-cyan-50/70">{label}</p>
      <p className={`mt-2 truncate font-display text-2xl font-bold ${tone === 'bad' ? 'text-red-100' : tone === 'good' ? 'text-emerald-100' : 'text-white'}`}>
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-cyan-50/65">{suffix}</span>}
      </p>
    </div>
  );
}

function DailyMetric({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className={`min-w-0 rounded-xl p-3 ${danger ? 'bg-red-50' : 'bg-iceblue-50'}`}><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className={`mt-1 truncate font-display text-lg font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  suffix?: string;
  tone: 'blue' | 'green' | 'red' | 'amber' | 'navy';
}) {
  const tones: Record<string, string> = {
    blue: 'bg-iceblue-50 text-iceblue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-700',
    navy: 'bg-navy-900/5 text-navy-800',
  };

  return (
    <div className="rounded-[1.25rem] border border-iceblue-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-navy-800/55">{label}</p>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 truncate font-display text-2xl font-bold text-navy-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-navy-800/45">{suffix}</span>}
      </p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-iceblue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-display text-lg font-semibold text-navy-900">{title}</p>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700">
          <Icon size={18} />
        </span>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-iceblue-100 bg-iceblue-50/50 px-4 text-center">
      <p className="text-sm font-medium text-navy-800/50">{text}</p>
    </div>
  );
}
