'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  FiGrid,
  FiPackage,
  FiTrendingUp,
  FiTruck,
  FiUsers,
  FiArrowUpRight,
  FiArrowDownRight,
} from 'react-icons/fi';
import api from '../../../lib/api';
import { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed, todayISO } from '../../../lib/api';
import { selectedBranchHeaders } from '../../../lib/branch-fetch';
import DashboardLoader from '../../../components/DashboardLoader';

const chartColors = ['#1ca6d1', '#16a34a', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'];

// Expense records store a full timestamp; comparing it to "today" must go
// through the India calendar day (like the /api/expenses backend does),
// not a raw slice of the ISO string, or entries near midnight IST land on
// the wrong day.
const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(date));

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [profitChart, setProfitChart] = useState<any[]>([]);
  const [dailyClosings, setDailyClosings] = useState<any[]>([]);
  const [reportDate, setReportDate] = useState(todayISO());
  const [closingLoading, setClosingLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [closingError, setClosingError] = useState('');
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [employeeExpenseRows, setEmployeeExpenseRows] = useState<any[]>([]);
  const [salesTrendRange, setSalesTrendRange] = useState<'weekly' | 'monthly'>('weekly');
  const [salesTrend, setSalesTrend] = useState<{ date: string; label: string; total: number; count: number }[]>([]);
  const [salesTrendSummary, setSalesTrendSummary] = useState<{ totalAmount: number; totalSales: number; averagePerDay: number } | null>(null);
  const [salesTrendLoading, setSalesTrendLoading] = useState(true);
  const [salesTrendError, setSalesTrendError] = useState('');
  const [selectedPerformanceName, setSelectedPerformanceName] = useState('Today Sales');
  const [todaySalesBars, setTodaySalesBars] = useState<number | null>(null);
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [todayTruckReturns, setTodayTruckReturns] = useState(0);
  const [managementCounts, setManagementCounts] = useState({
    totalCustomers: 0,
    localCustomers: 0,
    truckCustomers: 0,
    totalWorkers: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoadError('');
        const today = todayISO();
        const [dashResult, profitResult, customerResult, workerResult, truckResult, reconciliationResult, salesResult, expenseResult] = await Promise.allSettled([
          api.get('/dashboard/admin'),
          api.get('/dashboard/monthly-profit'),
          api.get('/customers'),
          api.get('/workers'),
          api.get('/trucks'),
          api.get('/truck-loads/reconciliation', { params: { date: today } }),
          api.get('/sales', {
            params: {
              from: `${today}T00:00:00.000+05:30`,
              to: `${today}T23:59:59.999+05:30`,
            },
          }),
          fetch('/api/expenses?today=true', {
            cache: 'no-store',
            headers: selectedBranchHeaders(),
          }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.message || 'Could not load today expenses.');
            return payload;
          }),
        ]);
        if (dashResult.status === 'rejected') throw dashResult.reason;
        setData(dashResult.value.data);
        setProfitChart(profitResult.status === 'fulfilled' ? profitResult.value.data : []);
        // Use the same branch-scoped expense source as Expenses, Reports and
        // Production so every page reconciles to one daily total.
        setTodayExpenses(expenseResult.status === 'fulfilled'
          ? Number(expenseResult.value?.summary?.totalExpenses || 0)
          : 0);
        setEmployeeExpenseRows([]);
        const customers = customerResult.status === 'fulfilled' && Array.isArray(customerResult.value.data) ? customerResult.value.data : [];
        const workers = workerResult.status === 'fulfilled' && Array.isArray(workerResult.value.data) ? workerResult.value.data : [];
        const trucks = truckResult.status === 'fulfilled' && Array.isArray(truckResult.value.data) ? truckResult.value.data : [];
        const reconciliations = reconciliationResult.status === 'fulfilled' && Array.isArray(reconciliationResult.value.data) ? reconciliationResult.value.data : [];
        const truckIds = new Set(trucks.map((truck: any) => String(truck._id || '')));
        setTodayTruckReturns(reconciliations.reduce((total: number, row: any) => {
          const truckId = String(row.truckId || row.truck?._id || row.truck || '');
          if (!truckId || !truckIds.has(truckId) || Number(row.taken || 0) <= 0) return total;
          return total + Math.max(0, Number(row.returned || 0));
        }, 0));
        const customerType = (customer: any) => String(customer.customerType || (customer.truck ? 'truck' : 'local')).toLowerCase();
        setManagementCounts({
          totalCustomers: customers.length,
          localCustomers: customers.filter((customer: any) => customerType(customer) === 'local').length,
          truckCustomers: customers.filter((customer: any) => customerType(customer) === 'truck').length,
          totalWorkers: workers.length,
        });
        if (salesResult.status === 'fulfilled' && Array.isArray(salesResult.value.data)) {
          setTodaySales(salesResult.value.data);
          const bars = salesResult.value.data.reduce((saleTotal: number, sale: any) => (
            saleTotal + (Array.isArray(sale.items) ? sale.items.reduce((itemTotal: number, item: any) => itemTotal + getItemBarUsed(item), 0) : 0)
          ), 0);
          setTodaySalesBars(bars);
        }
      } catch (error: any) {
        setLoadError(error?.response?.data?.message || (error?.message === 'Network Error' ? 'Cannot connect to the application service. Please try again.' : error?.message) || 'Could not load dashboard data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setSalesTrendLoading(true);
    setSalesTrendError('');
    api.get('/dashboard/sales-trend', { params: { range: salesTrendRange } })
      .then((response) => {
        const days = Array.isArray(response.data?.days) ? response.data.days : [];
        setSalesTrend(days.map((row: any) => ({
          ...row,
          label: formatDate(`${row.date}T12:00:00+05:30`).replace(/ 202\d/, ''),
        })));
        setSalesTrendSummary({
          totalAmount: Number(response.data?.totalAmount || 0),
          totalSales: Number(response.data?.totalSales || 0),
          averagePerDay: Number(response.data?.averagePerDay || 0),
        });
      })
      .catch((error: any) => {
        setSalesTrend([]);
        setSalesTrendSummary(null);
        setSalesTrendError(error?.response?.data?.message || error?.message || 'Could not load the sales report.');
      })
      .finally(() => setSalesTrendLoading(false));
  }, [salesTrendRange]);

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

  const dashboard = useMemo(() => {
    if (!data) return null;

    const truckRows = Object.entries(data.truckWiseSalesToday || {}).map(([id, row]: any) => ({
      id,
      truckName: row.truckName || 'Truck',
      quantity: Number(row.quantity || 0),
      totalAmount: Number(row.totalAmount || 0),
    }));
    // Sales items are the source of truth. The dashboard aggregate remains a
    // fallback for older backend responses or a failed sales request.
    const soldBars = todaySalesBars ?? truckRows.reduce((sum, row) => sum + row.quantity, 0);
    const stockRows = data.pendingStock?.sizeWise || [];
    const stockChart = stockRows
      .filter((row: any) => !['2', '3'].includes(String(row.size).trim()))
      .map((row: any) => ({
        size: `${row.size} bar`,
        quantity: Math.max(0, Number(row.quantity || 0)),
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
    const employeeByMonth = employeeExpenseRows.reduce((months: Record<string, { advance: number; petrolDiesel: number }>, row: any) => {
      const month = row.date ? indiaDateKey(row.date).slice(0, 7) : '';
      if (!month) return months;
      months[month] ||= { advance: 0, petrolDiesel: 0 };
      if (row.costType === 'advance_for_employee') months[month].advance += Number(row.amount || 0);
      if (['petrol_diesel', 'petrol', 'diesel'].includes(String(row.costType))) months[month].petrolDiesel += Number(row.amount || 0);
      return months;
    }, {});
    const monthlyProfit = profitChart.map((row) => {
      const month = String(row.month || '');
      return { ...row, label: month.slice(5) || month, sales: Math.abs(Number(row.sales || 0)), cost: Math.abs(Number(row.cost || 0)), profit: Math.abs(Number(row.profit || 0)), advance: Math.abs(employeeByMonth[month]?.advance || 0), petrolDiesel: Math.abs(employeeByMonth[month]?.petrolDiesel || 0) };
    });

    return {
      truckRows,
      soldBars,
      stockChart,
      paymentMix,
      last7DaysSales,
      monthlyProfit,
      pendingPayments: (data.payments?.pendingBills || []).filter((sale: any) => sale?.date && indiaDateKey(sale.date) === todayISO()),
      recentPayments: data.payments?.recentToday || [],
      truckCustomerRows: Object.entries(data.customers?.truckWise || {}),
      recentCustomers: data.customers?.recent || [],
    };
  }, [data, profitChart, employeeExpenseRows, todaySalesBars]);

  if (loading) {
    return (
      <div className="grid min-h-[45vh] place-items-center">
        <DashboardLoader label="Loading dashboard..." />
      </div>
    );
  }
  if (!data || !dashboard) return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700"><p className="font-semibold">Dashboard unavailable</p><p className="mt-2 text-sm">{loadError || 'Could not load dashboard data.'}</p><button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-4">Retry</button></div>;

  const todayPendingBills = Number(data.today.balance || 0);
  const todayInHand = Number(data.today.collection || 0) - Number(todayExpenses || 0);
  const todayProfit = todayInHand;
  const indiaDayOfMonth = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric' }).format(new Date())) || 1;
  const monthlyDailyAverage = Number(data.monthlySales || 0) / indiaDayOfMonth;
  const salesHighlight: 'high' | 'low' = Number(data.today.sales || 0) > 0 && Number(data.today.sales || 0) >= monthlyDailyAverage ? 'high' : 'low';
  const performanceMix = [
    { name: 'Production', value: Math.max(0, Number(data.today.production || 0)), displayValue: `${Number(data.today.production || 0)} bars`, color: '#3b82f6' },
    { name: 'Today Sales', value: Math.max(0, Number(data.today.sales || 0)), displayValue: formatCurrency(data.today.sales), color: '#10b981' },
    { name: 'Collection', value: Math.max(0, Number(data.today.collection || 0)), displayValue: formatCurrency(data.today.collection), color: '#06b6d4' },
    { name: 'Profit', value: Math.abs(todayProfit), displayValue: formatCurrency(todayProfit), color: todayProfit < 0 ? '#f43f5e' : '#8b5cf6' },
    { name: 'Bar Used', value: Math.max(0, dashboard.soldBars), displayValue: `${dashboard.soldBars} bars`, color: '#6366f1' },
    { name: 'Today Expenses', value: Math.max(0, todayExpenses), displayValue: formatCurrency(todayExpenses), color: '#ef4444' },
    { name: 'Today In Hand', value: Math.abs(todayInHand), displayValue: formatCurrency(todayInHand), color: todayInHand < 0 ? '#e11d48' : '#0d9488' },
    { name: 'Today Returns', value: Math.max(0, todayTruckReturns), displayValue: `${todayTruckReturns} bars`, color: '#f59e0b' },
    { name: 'Today Pending Bills', value: Math.max(0, todayPendingBills), displayValue: formatCurrency(todayPendingBills), color: '#f97316' },
  ];
  const visiblePerformanceMix = performanceMix.filter((row) => row.value > 0);
  const selectedPerformance = performanceMix.find((row) => row.name === selectedPerformanceName) || performanceMix[1];
  const openingStockBars = Math.max(0, Number(data.barStock?.openingStock || 0));
  const newProductionBars = Math.max(0, Number(data.barStock?.newProduction ?? data.today.production ?? 0));
  const stockTotalBars = Math.max(0, Number(data.barStock?.totalAvailable ?? openingStockBars + newProductionBars));
  const stockSoldBars = Math.max(0, Number(data.barStock?.sold ?? dashboard.soldBars));
  const stockBalanceBars = Math.max(0, Number(data.barStock?.balance ?? stockTotalBars - stockSoldBars));
  const todayBarChart = [
    { name: 'Sold Bars', value: stockSoldBars, color: '#16a34a' },
    { name: 'Balance Bars', value: stockBalanceBars, color: '#f59e0b' },
  ].filter((row) => row.value > 0);

  return (
    <div className="space-y-4 pb-8">
      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-r from-navy-900 via-sky-900 to-iceblue-700 text-white shadow-lg shadow-iceblue-900/10">
        <div className="flex items-center gap-3 px-4 py-5 sm:px-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl ring-1 ring-white/15"><FiGrid /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-iceblue-100/80">Overview</p>
            <h1 className="mt-0.5 font-display text-xl font-bold sm:text-2xl">Dashboard</h1>
            <p className="mt-1 text-sm text-iceblue-50/80">Today&apos;s production, sales, collection and stock at a glance.</p>
          </div>
        </div>
      </section>

      <section>

    {/* Today Overview - one card, summary grid on the left, donut on the right, equal widths */}
    <div className="relative overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-iceblue-50 via-white to-sky-50 shadow-sm">
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-iceblue-400 via-sky-400 to-teal-400" />
      <div className="flex items-center justify-between gap-3 border-b border-iceblue-100 bg-white/70 px-4 py-3">
        <div>
          <p className="font-display text-sm font-bold text-navy-900">Today Overview</p>
          <p className="mt-1 text-[10px] font-medium text-navy-800/45">Tap a slice to see the breakdown</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-iceblue-500 text-white shadow-sm">
          <FiTrendingUp size={14} />
        </span>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)] lg:items-center">

        {/* Right: donut chart */}
        <div className="flex min-h-[230px] items-center justify-center overflow-visible sm:min-h-[280px] lg:order-2">
          {visiblePerformanceMix.length === 0 ? (
            <p className="text-center text-xs font-medium text-slate-400">No activity recorded today.</p>
          ) : (
            <div className="relative h-[220px] w-[220px] max-w-full sm:h-[270px] sm:w-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visiblePerformanceMix}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="88%"
                    paddingAngle={3}
                    stroke="none"
                    onClick={(entry: any) => setSelectedPerformanceName(entry.name)}
                  >
                    {visiblePerformanceMix.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        cursor="pointer"
                        opacity={selectedPerformance.name === entry.name ? 1 : 0.72}
                        stroke={selectedPerformance.name === entry.name ? '#ffffff' : 'none'}
                        strokeWidth={selectedPerformance.name === entry.name ? 4 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<SummaryChartTooltip />}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-[116px] w-[116px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner sm:h-[142px] sm:w-[142px]">
                <p className="max-w-[100px] text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:max-w-[122px] sm:text-[9px]">{selectedPerformance.name}</p>
                <p className="mt-1 max-w-[104px] truncate font-display text-sm font-black text-navy-900 sm:max-w-[126px] sm:text-base">{selectedPerformance.displayValue}</p>
              </div>
            </div>
          )}
        </div>

        {/* Left: summary grid */}
        <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-4 lg:order-1">

          <DashboardSummaryCard
            icon={FiPackage}
            label="Production"
            value={data.today.production}
            suffix="bars"
            tone="blue"
            href="/admin/production"
          />

          <DashboardSummaryCard
            icon={FiBox}
            label="Bar Used"
            value={dashboard.soldBars}
            suffix="bars"
            tone="indigo"
            href="/admin/production"
          />

          <DashboardSummaryCard
            icon={FiTrendingUp}
            label="Today Sales"
            value={formatCurrency(data.today.sales)}
            highlight={salesHighlight}
            tone="emerald"
            href="/admin/sales"
          />

          <DashboardSummaryCard
            icon={FiDollarSign}
            label="Collection"
            value={formatCurrency(data.today.collection)}
            tone="cyan"
            href="/admin/sales"
          />

          <DashboardSummaryCard
            icon={FiArrowUpRight}
            label="Profit"
            value={formatCurrency(todayProfit)}
            danger={todayProfit < 0}
            positive={todayProfit >= 0}
            tone="violet"
            href="/admin/reports"
          />

          <DashboardSummaryCard
            icon={FiDollarSign}
            label="Today Expenses"
            value={formatCurrency(todayExpenses)}
            danger={todayExpenses > 0}
            tone="red"
            href="/admin/expenses"
          />

          <DashboardSummaryCard
            icon={FiDollarSign}
            label="Today In Hand"
            value={formatCurrency(todayInHand)}
            danger={todayInHand < 0}
            positive={todayInHand >= 0}
            tone="emerald"
            href="/admin/reports"
          />

          <DashboardSummaryCard
            icon={FiArrowDownRight}
            label="Today Returns"
            value={todayTruckReturns}
            suffix="bars"
            tone="amber"
            href="/admin/reports"
          />

          <DashboardSummaryCard
            icon={FiClock}
            label="Today Pending Bills"
            value={formatCurrency(todayPendingBills)}
            danger={todayPendingBills > 0}
            tone="orange"
            href="/admin/customers"
          />

          <CustomerCountCard counts={managementCounts} />

          <Link
            href="/admin/workers"
            className="relative flex min-h-[112px] min-w-0 flex-col justify-center gap-2 overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-sky-500" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Total Workers</p>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm"><FiUsers size={13} /></span>
            </div>
            <p className="font-display text-2xl font-black text-sky-700">{managementCounts.totalWorkers}</p>
          </Link>

        </div>

      </div>
    </div>

</section>

      <section>
        <div className="hidden">
        <Panel title="Last 7 Days Sales" icon={FiTrendingUp}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {dashboard.last7DaysSales.map((day: any, index: number) => (
              <div key={`${day.label}-${index}`} className="rounded-lg border border-iceblue-100 bg-gradient-to-b from-white to-iceblue-50 p-2.5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{day.label}</p>
                <p className="mt-1 break-words text-xs font-bold text-iceblue-700">{formatCurrency(Number(day.total || 0))}</p>
              </div>
            ))}
          </div>
          {/*
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
              <YAxis tick={{ fontSize: 9, fill: '#a5f3fc', fontFamily: 'monospace' }} tickFormatter={(v) => `${Number(v) < 0 ? '-' : ''}₹${Math.abs(Number(v)) / 1000}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              <Area type="monotone" dataKey="total" stroke="#1284ac" strokeWidth={3} fill="url(#salesFill)" />
            </AreaChart>
          </ResponsiveContainer>
          */}
        </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-white to-iceblue-50 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4">
            <div><p className="font-display text-sm font-bold text-navy-900">Today Sales Report</p><p className="mt-1 text-[10px] font-medium text-navy-800/45">{salesTrendRange === 'weekly' ? 'Last 7 days trend' : 'This month, day by day'}</p></div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => setSalesTrendRange('weekly')} className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition ${salesTrendRange === 'weekly' ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-900 hover:bg-white'}`}>Weekly</button>
                <button type="button" onClick={() => setSalesTrendRange('monthly')} className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition ${salesTrendRange === 'monthly' ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-900 hover:bg-white'}`}>Monthly</button>
              </div>
              <Link href="/admin/sales/all" className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-[10px] font-bold text-navy-900 transition hover:bg-white">View Details</Link>
            </div>
          </div>
          {salesTrendLoading ? <p className="py-12 text-center text-xs font-medium text-slate-400">Loading sales report...</p> : salesTrendError ? <div className="m-4 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">{salesTrendError}</div> : salesTrend.length === 0 ? <div className="p-4"><EmptyState text="No sales recorded for this period." /></div> : (
            <div className="p-4">
              {salesTrendSummary && (
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-iceblue-50 px-2 py-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-navy-800/45">Total Sales</p>
                    <p className="mt-0.5 truncate font-display text-sm font-bold text-navy-900">{formatCurrency(salesTrendSummary.totalAmount)}</p>
                  </div>
                  <div className="rounded-xl bg-iceblue-50 px-2 py-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-navy-800/45">Bills</p>
                    <p className="mt-0.5 truncate font-display text-sm font-bold text-navy-900">{salesTrendSummary.totalSales}</p>
                  </div>
                  <div className="rounded-xl bg-iceblue-50 px-2 py-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-navy-800/45">Avg / Day</p>
                    <p className="mt-0.5 truncate font-display text-sm font-bold text-navy-900">{formatCurrency(salesTrendSummary.averagePerDay)}</p>
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1ca6d1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#1ca6d1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dff5fd" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={salesTrendRange === 'monthly' ? 'preserveStartEnd' : 0} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${Number(v) / 1000}k`} axisLine={false} tickLine={false} width={42} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="total" name="Sales" stroke="#1284ac" strokeWidth={3} fill="url(#salesTrendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-white to-iceblue-50 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
            <div><p className="font-display text-sm font-bold text-navy-900">Today Collection</p><p className="mt-1 text-[10px] font-medium text-navy-800/45">Payment method breakdown</p></div>
            <Link href="/admin/sales/all" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold text-navy-900 transition hover:bg-white">View Details</Link>
          </div>
          {dashboard.paymentMix.length === 0 ? (
            <div className="p-4"><EmptyState text="No collection data today." /></div>
          ) : (
            <div className="px-4 pb-5">
              <div className="relative mx-auto h-[250px] max-w-md">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={3} stroke="none" labelLine={false} label={renderCollectionLabel}>
                      {dashboard.paymentMix.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color || chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Total</p>
                  <p className="mt-1 max-w-[84px] truncate font-display text-sm font-black text-navy-900">{formatCurrency(data.today.collection)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
              {dashboard.paymentMix.map((entry, index) => (
                <div key={entry.name} className="min-w-0 text-center">
                  <div className="flex items-center justify-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color || chartColors[index % chartColors.length] }} /><p className="truncate text-[9px] font-semibold text-slate-500">{entry.name}</p></div>
                  <p className="mt-1 truncate text-xs font-bold text-navy-900">{formatCurrency(Number(entry.value || 0))}</p>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </section>

      <section>
        {false && <Panel title="Today Report" icon={FiTrendingUp}>
          <div className="overflow-hidden rounded-xl border border-cyan-400/30 bg-[radial-gradient(circle_at_top,#123b5a_0%,#071824_58%,#031019_100%)] p-3 shadow-inner shadow-cyan-500/10">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-cyan-300/15 pb-2"><div><div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" /><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">Neon Market Trend</p></div><p className="mt-1 font-mono text-[9px] text-cyan-100/50">Monthly Sales, Cost &amp; Profit</p></div><Link href="/admin/reports?view=monthly-sales" className="shrink-0 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase text-cyan-100 transition hover:bg-cyan-300/20">Monthly Sales Report</Link></div>
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={dashboard.monthlyProfit} barGap={2} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="2 5" stroke="#67e8f9" strokeOpacity={0.18} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#a5f3fc', fontFamily: 'monospace' }} axisLine={{ stroke: '#22d3ee', strokeOpacity: 0.35 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Number(v) / 1000}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(Math.abs(Number(v)))} />
              <Legend wrapperStyle={{ fontSize: 9, color: '#cffafe', fontFamily: 'monospace' }} />
              <Bar dataKey="sales" name="Sales" fill="#22d3ee" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="cost" name="Cost" fill="#fbbf24" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="profit" name="Profit" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="advance" name="Employee Advance" fill="#a78bfa" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="petrolDiesel" name="Petrol / Diesel" fill="#fb7185" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </Panel>}

        <Panel title="Truck-wise Sales Today" icon={FiBox}>
          {dashboard.truckRows.length === 0 ? (
            <EmptyState icon={FiTruck} text="No truck sales recorded today." />
          ) : (
            <>
            <div className="overflow-x-auto rounded-lg border border-slate-300">
              <table className="w-full min-w-[650px] table-fixed border-collapse text-xs">
                <thead className="bg-emerald-700 text-white"><tr><th className="w-[70px] border border-emerald-800 px-3 py-3 text-center text-[10px] font-bold uppercase">S.No</th><th className="border border-emerald-800 px-3 py-3 text-left text-[10px] font-bold uppercase">Truck Name</th><th className="w-[130px] border border-emerald-800 px-3 py-3 text-center text-[10px] font-bold uppercase">Bars Used</th><th className="w-[150px] border border-emerald-800 px-3 py-3 text-right text-[10px] font-bold uppercase">Sales Amount</th><th className="w-[130px] border border-emerald-800 px-3 py-3 text-right text-[10px] font-bold uppercase">Average / Bar</th></tr></thead>
                <tbody>
                  {dashboard.truckRows.map((row: any, index: number) => <tr key={`${row.truckName}-${index}`} className="even:bg-slate-50 hover:bg-emerald-50/70"><td className="border border-slate-300 px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="border border-slate-300 px-3 py-3 font-semibold text-navy-900">{row.truckName}</td><td className="border border-slate-300 px-3 py-3 text-center font-semibold">{row.quantity}</td><td className="border border-slate-300 px-3 py-3 text-right font-bold text-emerald-700">{formatCurrency(row.totalAmount)}</td><td className="border border-slate-300 px-3 py-3 text-right font-semibold text-slate-600">{formatCurrency(row.quantity > 0 ? row.totalAmount / row.quantity : 0)}</td></tr>)}
                </tbody>
                <tfoot className="bg-emerald-50 font-bold text-navy-900"><tr><td className="border border-slate-300 px-3 py-3 text-center" colSpan={2}>TOTAL</td><td className="border border-slate-300 px-3 py-3 text-center">{dashboard.truckRows.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0)}</td><td className="border border-slate-300 px-3 py-3 text-right text-emerald-700">{formatCurrency(dashboard.truckRows.reduce((sum: number, row: any) => sum + Number(row.totalAmount || 0), 0))}</td><td className="border border-slate-300 px-3 py-3 text-right text-slate-600">{formatCurrency(dashboard.truckRows.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0) > 0 ? dashboard.truckRows.reduce((sum: number, row: any) => sum + Number(row.totalAmount || 0), 0) / dashboard.truckRows.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0) : 0)}</td></tr></tfoot>
              </table>
            </div>
            {false && <ResponsiveContainer width="100%" height={310}>
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
            </ResponsiveContainer>}
            </>
          )}
        </Panel>
      </section>

      <section className="space-y-4">
        <div className="overflow-hidden rounded-[20px] border border-sky-200 bg-white shadow-[0_8px_30px_rgba(15,55,80,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 px-4 py-3 sm:px-5">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-600">Today Overview</p><h2 className="font-display text-lg font-bold text-navy-900">Sales Report &amp; Bar Stock</h2></div>
            <Link href="/admin/sales/all" className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-[10px] font-bold text-navy-900 transition hover:bg-white">View Details</Link>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
        <div className="min-w-0 border-b border-sky-100 p-4 lg:border-b-0 lg:border-r sm:p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-navy-900"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50"><FiDollarSign className="text-emerald-600" /></span> Daily Sales Report</h3>
          <p className="mb-3 mt-1 pl-10 text-[11px] font-medium text-slate-400">Latest 10 sales recorded today</p>
          {todaySales.length === 0 ? <EmptyState text="No sales recorded today." /> : <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[560px] table-fixed border-collapse text-xs"><thead className="bg-sky-50/80 text-navy-900"><tr><th className="w-[19%] border-b border-slate-200 px-3 py-2.5 text-left font-bold uppercase">Date</th><th className="w-[27%] border-b border-slate-200 px-3 py-2.5 text-left font-bold uppercase">Customer</th><th className="w-[13%] border-b border-slate-200 px-3 py-2.5 text-center font-bold uppercase">Bars</th><th className="w-[21%] border-b border-slate-200 px-3 py-2.5 text-right font-bold uppercase">Amount</th><th className="w-[20%] border-b border-slate-200 px-3 py-2.5 text-right font-bold uppercase">Balance</th></tr></thead><tbody>{todaySales.slice(0, 10).map((sale) => { const bars = (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0); return <tr key={sale._id} className="border-b border-slate-100 last:border-0 even:bg-slate-50/60 hover:bg-sky-50/70"><td className="px-3 py-2.5 text-slate-600">{formatDate(sale.date)}</td><td className="truncate px-3 py-2.5 font-semibold text-navy-900">{sale.customer?.name || sale.customerName || 'Customer'}</td><td className="px-3 py-2.5 text-center font-semibold">{bars}</td><td className="px-3 py-2.5 text-right font-semibold text-emerald-700">{formatCurrency(sale.totalAmount)}</td><td className="px-3 py-2.5 text-right font-semibold text-red-500">{formatCurrency(sale.balanceAmount)}</td></tr>; })}</tbody><tfoot className="border-t border-sky-200 bg-sky-50 font-bold text-navy-900"><tr><td colSpan={2} className="px-3 py-2.5 text-right">TOTAL</td><td className="px-3 py-2.5 text-center">{todaySales.reduce((sum, sale) => sum + (sale.items || []).reduce((itemSum: number, item: any) => itemSum + getItemBarUsed(item), 0), 0)}</td><td className="px-3 py-2.5 text-right text-emerald-700">{formatCurrency(todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0))}</td><td className="px-3 py-2.5 text-right text-red-500">{formatCurrency(todaySales.reduce((sum, sale) => sum + Number(sale.balanceAmount || 0), 0))}</td></tr></tfoot></table></div>}
        </div>

        <div className="min-w-0 bg-sky-50/25 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-navy-900"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100"><FiPackage className="text-sky-600" /></span> Bar Stock Summary</h3>
          <p className="mb-3 mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Opening stock + new production, sold and remaining bars</p>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-navy-900 via-sky-900 to-iceblue-700 p-4 text-white shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-100">Total Available Bars</p>
              <p className="mt-2 font-display text-3xl font-black">{formatBarQuantity(stockTotalBars) || '0'}</p>
              <p className="mt-1 text-[10px] font-semibold text-sky-100">
                Opening {formatBarQuantity(openingStockBars) || '0'} + New production {formatBarQuantity(newProductionBars) || '0'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Sold Bars</p>
                <p className="mt-2 font-display text-2xl font-black text-emerald-700">{formatBarQuantity(stockSoldBars) || '0'}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Balance Bars</p>
                <p className="mt-2 font-display text-2xl font-black text-amber-700">{formatBarQuantity(stockBalanceBars) || '0'}</p>
              </div>
            </div>
            <div className="relative h-[190px] rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {todayBarChart.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={todayBarChart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={3} stroke="transparent">
                        {todayBarChart.map((row) => <Cell key={row.name} fill={row.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`${value} bars`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Total Bars</p>
                    <p className="font-display text-2xl font-black text-navy-900">{formatBarQuantity(stockTotalBars) || '0'}</p>
                  </div>
                </>
              ) : <EmptyState text="No production recorded today." />}
            </div>
          </div>
        </div>
          </div>
        </div>

        <div>
        <Panel title="Today's Pending Customer Payments" icon={FiClock}>
          {dashboard.pendingPayments.length === 0 ? (
            <EmptyState text="No pending payments." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-xs text-navy-900">
                <thead className="bg-sky-50 text-navy-900">
                  <tr>
                    <th className="w-[7%] border-b border-r border-slate-200 px-2 py-3 text-center text-[10px] font-bold uppercase">S.No</th>
                    {['Bill Date', 'Customer', 'Truck', 'Total', 'Paid', 'Balance'].map((heading) => <th key={heading} className={`border-b border-r border-slate-200 px-2 py-3 text-[10px] font-bold uppercase last:border-r-0 ${['Total', 'Paid', 'Balance'].includes(heading) ? 'text-right' : 'text-left'}`}>{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dashboard.pendingPayments.map((sale: any, index: number) => (
                    <tr key={sale._id} className="bg-white even:bg-slate-50/70 hover:bg-sky-50/70">
                      <td className="border-b border-r border-slate-200 px-2 py-3 text-center font-medium text-slate-500">{index + 1}</td>
                      <td className="border-b border-r border-slate-200 px-2 py-3 text-slate-600">{formatDate(sale.date)}</td>
                      <td className="break-words border-b border-r border-slate-200 px-2 py-3">
                        <p className="font-semibold text-navy-900">{sale.customer?.name}</p>
                        <p className="text-[10px] text-slate-400">{sale.customer?.phoneNumber || 'No phone'}</p>
                      </td>
                      <td className="break-words border-b border-r border-slate-200 px-2 py-3 text-slate-600">{sale.truck?.truckName || '-'}</td>
                      <td className="border-b border-r border-slate-200 px-2 py-3 text-right font-semibold">{formatCurrency(sale.totalAmount)}</td>
                      <td className="border-b border-r border-slate-200 px-2 py-3 text-right font-semibold text-emerald-600">{formatCurrency(sale.paidAmount)}</td>
                      <td className="border-b border-slate-200 px-2 py-3 text-right font-bold text-red-600">{formatCurrency(sale.balanceAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-sky-50 font-bold text-navy-900"><tr><td colSpan={4} className="border-r border-slate-200 px-3 py-3 text-right">TOTAL</td><td className="border-r border-slate-200 px-2 py-3 text-right">{formatCurrency(dashboard.pendingPayments.reduce((sum: number, sale: any) => sum + Number(sale.totalAmount || 0), 0))}</td><td className="border-r border-slate-200 px-2 py-3 text-right text-emerald-600">{formatCurrency(dashboard.pendingPayments.reduce((sum: number, sale: any) => sum + Number(sale.paidAmount || 0), 0))}</td><td className="px-2 py-3 text-right text-red-600">{formatCurrency(dashboard.pendingPayments.reduce((sum: number, sale: any) => sum + Number(sale.balanceAmount || 0), 0))}</td></tr></tfoot>
              </table>
            </div>
          )}
        </Panel>
        </div>
      </section>

      <section className="hidden">
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

function CustomerCountCard({ counts }: { counts: { totalCustomers: number; localCustomers: number; truckCustomers: number } }) {
  return (
    <Link
      href="/admin/customers"
      className="relative flex min-h-[112px] min-w-0 flex-col justify-center overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-400"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-teal-500" />
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Total Customers</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500 text-white shadow-sm"><FiUsers size={13} /></span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-teal-200">
        <div className="pr-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Total</p>
          <p className="font-display text-2xl font-black text-teal-700">{counts.totalCustomers}</p>
        </div>
        <div className="px-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Local</p>
          <p className="font-display text-2xl font-black text-navy-900">{counts.localCustomers}</p>
        </div>
        <div className="pl-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Truck</p>
          <p className="font-display text-2xl font-black text-navy-900">{counts.truckCustomers}</p>
        </div>
      </div>
    </Link>
  );
}

function DashboardSummaryCard({ label, value, suffix, danger = false, positive = false, icon: Icon, highlight, tone = 'blue', href }: { label: string; value: string | number; suffix?: string; danger?: boolean; positive?: boolean; icon?: any; highlight?: 'high' | 'low'; tone?: 'blue' | 'emerald' | 'cyan' | 'violet' | 'indigo' | 'red' | 'amber' | 'orange'; href: string }) {
  const toneColors = {
    blue: { icon: 'bg-blue-500', text: 'text-blue-700', card: 'border-blue-200 from-blue-50 to-white', accent: 'bg-blue-500' },
    emerald: { icon: 'bg-emerald-500', text: 'text-emerald-700', card: 'border-emerald-200 from-emerald-50 to-white', accent: 'bg-emerald-500' },
    cyan: { icon: 'bg-cyan-500', text: 'text-cyan-700', card: 'border-cyan-200 from-cyan-50 to-white', accent: 'bg-cyan-500' },
    violet: { icon: 'bg-violet-500', text: 'text-violet-700', card: 'border-violet-200 from-violet-50 to-white', accent: 'bg-violet-500' },
    indigo: { icon: 'bg-indigo-500', text: 'text-indigo-700', card: 'border-indigo-200 from-indigo-50 to-white', accent: 'bg-indigo-500' },
    red: { icon: 'bg-red-500', text: 'text-red-700', card: 'border-red-200 from-red-50 to-white', accent: 'bg-red-500' },
    amber: { icon: 'bg-amber-500', text: 'text-amber-700', card: 'border-amber-200 from-amber-50 to-white', accent: 'bg-amber-500' },
    orange: { icon: 'bg-orange-500', text: 'text-orange-700', card: 'border-orange-200 from-orange-50 to-white', accent: 'bg-orange-500' },
  };
  const palette = toneColors[tone];

  return (
    <Link href={href} className={`relative flex min-h-[112px] min-w-0 flex-col justify-center gap-2 overflow-hidden rounded-2xl border bg-gradient-to-br px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-current ${palette.card}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${danger ? 'bg-red-500' : positive ? 'bg-emerald-500' : palette.accent}`} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p>
        {Icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${palette.icon}`}>
            <Icon size={13} />
          </span>
        )}
      </div>

      <div>
        <p className={`truncate font-display text-2xl font-black ${danger ? 'text-red-600' : positive ? 'text-emerald-600' : palette.text}`}>
          {value}
          {suffix && <span className="ml-1 text-xs font-medium text-navy-800/40">{suffix}</span>}
        </p>
        {highlight && (
          <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white ${palette.icon}`}>
            {highlight} sales
          </span>
        )}
      </div>
    </Link>
  );
}

function metricPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(value || 0) / Number(total)) * 100)));
}

function SummaryChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="min-w-[170px] whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        <p className="text-xs font-bold text-slate-600">{item.name}</p>
      </div>
      <p className="mt-1.5 font-display text-base font-black text-navy-900">{item.displayValue}</p>
    </div>
  );
}

function renderCollectionLabel({ x, y, percent }: { x: number; y: number; percent: number }) {
  if (!percent) return null;
  return <g><circle cx={x} cy={y} r="18" fill="white" stroke="#e2e8f0" strokeWidth="1" /><text x={x} y={y} dy="0.35em" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="800">{`${Math.round(percent * 100)}%`}</text></g>;
}

function TallyValue({ value, label, emphasis = false, danger = false }: { value: string | number; label: string; emphasis?: boolean; danger?: boolean }) {
  return <div className={`flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-3 py-2 text-center sm:min-w-[105px] ${danger ? 'border-red-200 bg-red-50' : emphasis ? 'border-iceblue-200 bg-white shadow-sm' : 'border-white/80 bg-white/70'}`}><span className={`font-display text-xl font-black ${danger ? 'text-red-600' : emphasis ? 'text-iceblue-700' : 'text-navy-900'}`}>{value}</span><span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-navy-800/45">{label}</span></div>;
}

function TallyOperator({ symbol }: { symbol: '=' | '+' }) {
  return <span className="grid min-h-[64px] w-7 shrink-0 place-items-center font-display text-lg font-black text-navy-800/35">{symbol}</span>;
}

function BranchMetric({ label, value, tone }: { label: string; value: string | number; tone?: 'success' | 'warning' | 'danger' }) {
  const valueColor = tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-red-600' : 'text-navy-900';
  return <div className="min-w-0 bg-white px-3 py-3 text-center"><p className="text-[9px] font-bold uppercase tracking-wider text-navy-800/40">{label}</p><p className={`mt-1 truncate font-display text-base font-black ${valueColor}`}>{value}</p></div>;
}

function DailyMetric({ label, value, progress, trend, danger = false, helper }: { label: string; value: string | number; progress: number; trend: 'up' | 'down'; danger?: boolean; helper?: string }) {
  const accent = danger ? '#ef4444' : trend === 'up' ? '#10b981' : '#f59e0b';
  const TrendIcon = trend === 'up' ? FiArrowUpRight : FiArrowDownRight;

  return (
    <div className="flex h-full min-h-[132px] items-center gap-3 overflow-hidden rounded-2xl border border-iceblue-100 bg-gradient-to-br from-white to-iceblue-50/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${accent} ${progress * 3.6}deg, #e2e8f0 0deg)` }}>
        <span className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-white text-sm font-black text-navy-900">{progress}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="min-h-[28px] text-[10px] font-semibold uppercase leading-3.5 tracking-[0.12em] text-slate-500">{label}</p>
            <p className={`mt-2 break-words text-xl font-semibold leading-none ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
          </div>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${trend === 'up' && !danger ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            <TrendIcon size={17} />
          </span>
        </div>
        {helper && <p className="mt-1 text-xs leading-4 text-slate-500">{helper}</p>}
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="-mx-4 -mt-4 mb-4 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-display text-sm font-semibold text-navy-900">{title}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-navy-700">
          <Icon size={15} />
        </span>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text, icon: Icon }: { text?: string; icon?: any }) {
  return (
    <div className="grid min-h-[220px] place-items-center gap-3 rounded-xl border border-dashed border-iceblue-100 bg-iceblue-50/50 px-4 text-center">
      {Icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-iceblue-100/70 text-2xl text-iceblue-400">
          <Icon />
        </span>
      )}
      {text && <p className="text-sm font-medium text-navy-800/50">{text}</p>}
    </div>
  );
}

function IceBlockIcon({ gradientId, className }: { gradientId: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fbff" />
          <stop offset="45%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* top face (pseudo-3D) */}
      <path d="M11 8 L18 3 L42 3 L36 8 Z" fill="#e0f7ff" stroke="#0284c7" strokeWidth="1" strokeLinejoin="round" />
      {/* right face (pseudo-3D) */}
      <path d="M36 8 L42 3 L42 30 L36 36 Z" fill="#7dd3fc" stroke="#0284c7" strokeWidth="1" strokeLinejoin="round" />
      {/* block body (front face) */}
      <rect x="6" y="8" width="30" height="30" rx="4" fill={`url(#${gradientId})`} stroke="#0284c7" strokeWidth="1.5" />
      {/* crack lines */}
      <path d="M13 8 L19 20 L12 27" stroke="#0ea5e9" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <path d="M29 12 L24 23 L31 30" stroke="#0ea5e9" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      {/* shine */}
      <rect x="10" y="12" width="5" height="14" rx="2.5" fill="white" opacity="0.5" />
    </svg>
  );
}
