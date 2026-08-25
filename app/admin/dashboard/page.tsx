'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FiAlertCircle,
  FiArrowRight,
  FiBarChart2,
  FiBox,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiGitBranch,
  FiGrid,
  FiPackage,
  FiSettings,
  FiShield,
  FiShoppingCart,
  FiTrendingUp,
  FiTruck,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import api, { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed, todayISO } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import DashboardLoader from '../../../components/DashboardLoader';

type Branch = {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  admin?: { displayName?: string; username?: string; isActive?: boolean } | null;
};

type BranchSnapshot = {
  branch: Branch;
  production: number;
  sales: number;
  expenses: number;
  stock: number;
  collection: number;
  pending: number;
};

type ComparisonMetric = 'sales' | 'production' | 'expenses';

type ActivityItem = {
  id: string;
  type: 'sale' | 'expense' | 'production';
  title: string;
  detail: string;
  value: string;
  date: string;
  branch?: string;
};

const indiaDateKey = (date: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(date));

const compactCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value || 0));

const branchIdOf = (row: any) => String(row?.branch?._id || row?.branch || row?.branchId || '');

function dashboardStock(payload: any) {
  const opening = Number(payload?.barStock?.openingStock || 0);
  const produced = Number(payload?.barStock?.newProduction ?? payload?.today?.production ?? 0);
  const sold = Number(payload?.barStock?.sold || 0);
  return Math.max(0, Number(payload?.barStock?.balance ?? opening + produced - sold));
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchSnapshots, setBranchSnapshots] = useState<BranchSnapshot[]>([]);
  const [expenseRows, setExpenseRows] = useState<any[]>([]);
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [closingRows, setClosingRows] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [comparisonMetric, setComparisonMetric] = useState<ComparisonMetric>('sales');

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      const today = todayISO();
      const storedBranch = isSuperAdmin ? window.localStorage.getItem('tii_selected_branch') || '' : '';
      setSelectedBranch(storedBranch);
      const requestHeaders = storedBranch ? { 'X-Branch-Id': storedBranch } : {};

      try {
        const [dashboardResult, branchResult, expenseResult, salesResult, closingResult, truckResult, workerResult, settingsResult] = await Promise.allSettled([
          api.get('/dashboard/admin', { headers: requestHeaders }),
          api.get('/branches'),
          fetch('/api/expenses', { cache: 'no-store', headers: requestHeaders }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.message || 'Could not load expenses.');
            return payload;
          }),
          api.get('/sales', {
            headers: requestHeaders,
            params: { from: `${today}T00:00:00.000+05:30`, to: `${today}T23:59:59.999+05:30` },
          }),
          api.get('/daily-closing', { headers: requestHeaders, params: { date: today } }),
          api.get('/trucks', { headers: requestHeaders }),
          api.get('/workers', { headers: requestHeaders }),
          api.get('/settings'),
        ]);

        if (dashboardResult.status === 'rejected') throw dashboardResult.reason;
        if (!active) return;

        const dashboardData = dashboardResult.value.data || {};
        const branchData: Branch[] = branchResult.status === 'fulfilled' && Array.isArray(branchResult.value.data) ? branchResult.value.data : [];
        const expenses = expenseResult.status === 'fulfilled' && Array.isArray(expenseResult.value?.records) ? expenseResult.value.records : [];
        const sales = salesResult.status === 'fulfilled' && Array.isArray(salesResult.value.data) ? salesResult.value.data : [];
        const closings = closingResult.status === 'fulfilled' && Array.isArray(closingResult.value.data) ? closingResult.value.data : [];

        setData(dashboardData);
        setBranches(branchData);
        setExpenseRows(expenses);
        setSalesRows(sales);
        setClosingRows(closings);
        setTrucks(truckResult.status === 'fulfilled' && Array.isArray(truckResult.value.data) ? truckResult.value.data : []);
        setWorkers(workerResult.status === 'fulfilled' && Array.isArray(workerResult.value.data) ? workerResult.value.data : []);
        setSettings(settingsResult.status === 'fulfilled' ? settingsResult.value.data || {} : {});

        if (isSuperAdmin && !storedBranch && branchData.length) {
          const snapshots = await Promise.all(branchData.map(async (branch) => {
            let branchDashboard: any = null;
            try {
              branchDashboard = (await api.get('/dashboard/admin', { headers: { 'X-Branch-Id': branch._id } })).data;
            } catch {
              branchDashboard = null;
            }
            const branchExpenses = expenses
              .filter((row: any) => branchIdOf(row) === branch._id && row.date && indiaDateKey(row.date) === today)
              .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
            return {
              branch,
              production: Number(branchDashboard?.today?.production || 0),
              sales: Number(branchDashboard?.today?.sales || 0),
              expenses: branchExpenses,
              stock: dashboardStock(branchDashboard),
              collection: Number(branchDashboard?.today?.collection || 0),
              pending: Number(branchDashboard?.today?.balance || 0),
            } satisfies BranchSnapshot;
          }));
          if (active) setBranchSnapshots(snapshots);
        } else {
          setBranchSnapshots([]);
        }
      } catch (error: any) {
        if (active) setLoadError(error?.response?.data?.message || error?.message || 'Could not load dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [authLoading, isSuperAdmin, user]);

  const selectBranch = (branchId: string) => {
    if (!isSuperAdmin) return;
    if (branchId) window.localStorage.setItem('tii_selected_branch', branchId);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const overallView = Boolean(isSuperAdmin && selectedBranch === '');
  const today = todayISO();
  const todayExpenses = useMemo(() => expenseRows
    .filter((row) => row.date && indiaDateKey(row.date) === today)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0), [expenseRows, today]);
  const soldBars = useMemo(() => salesRows.reduce((total, sale) => total + (Array.isArray(sale.items)
    ? sale.items.reduce((itemTotal: number, item: any) => itemTotal + getItemBarUsed(item), 0)
    : 0), 0), [salesRows]);

  const production = Number(data?.today?.production || 0);
  const sales = Number(data?.today?.sales || 0);
  const collection = Number(data?.today?.collection || 0);
  const pendingPaymentCollection = Number(data?.today?.pendingPaymentCollection || 0);
  const pendingBalance = Number(data?.today?.balance || 0);
  const availableStock = dashboardStock(data);
  const netBalance = collection - todayExpenses;
  const activeTrucks = trucks.filter((truck) => truck.isActive !== false).length;
  const activeWorkers = workers.filter((worker) => worker.isActive !== false).length;
  const lowStockThreshold = Number(settings?.lowStockThreshold || 0);

  const salesTrend = useMemo(() => (data?.last7DaysSales || []).map((row: any) => ({
    ...row,
    label: formatDate(row.date).replace(/ 202\d/, ''),
    total: Number(row.total || 0),
  })), [data]);

  const alerts = useMemo(() => {
    const rows: { id: string; title: string; detail: string; tone: 'danger' | 'warning' | 'info'; href: string }[] = [];

    if (overallView) {
      branchSnapshots.forEach((snapshot) => {
        if (!snapshot.branch.isActive) rows.push({ id: `inactive-${snapshot.branch._id}`, title: `${snapshot.branch.name} is inactive`, detail: 'Enable the branch before daily operations resume.', tone: 'danger', href: '/admin/branches' });
        if (!snapshot.branch.admin || snapshot.branch.admin.isActive === false) rows.push({ id: `admin-${snapshot.branch._id}`, title: `${snapshot.branch.name} needs an active admin`, detail: 'Review administrator access for this location.', tone: 'warning', href: '/admin/admins' });
        if (snapshot.branch.isActive && snapshot.production <= 0) rows.push({ id: `production-${snapshot.branch._id}`, title: `No production at ${snapshot.branch.name}`, detail: 'Today’s production entry has not been recorded.', tone: 'warning', href: '/admin/production' });
        if (lowStockThreshold > 0 && snapshot.stock <= lowStockThreshold) rows.push({ id: `stock-${snapshot.branch._id}`, title: `Low stock at ${snapshot.branch.name}`, detail: `${formatBarQuantity(snapshot.stock) || 0} bars currently available.`, tone: 'danger', href: '/admin/production' });
        if (snapshot.expenses > snapshot.sales && snapshot.expenses > 0) rows.push({ id: `expense-${snapshot.branch._id}`, title: `Expenses exceed sales at ${snapshot.branch.name}`, detail: `${formatCurrency(snapshot.expenses)} spent against ${formatCurrency(snapshot.sales)} sales.`, tone: 'danger', href: '/admin/expenses' });
      });
    } else {
      if (production <= 0) rows.push({ id: 'production', title: 'Production not entered today', detail: 'Add today’s production to keep stock accurate.', tone: 'warning', href: '/admin/production' });
      if (lowStockThreshold > 0 && availableStock <= lowStockThreshold) rows.push({ id: 'stock', title: 'Stock is below the alert level', detail: `${formatBarQuantity(availableStock) || 0} bars remain.`, tone: 'danger', href: '/admin/production' });
      if (todayExpenses > sales && todayExpenses > 0) rows.push({ id: 'expense', title: 'Today’s expenses exceed sales', detail: `${formatCurrency(todayExpenses)} spent against ${formatCurrency(sales)} sales.`, tone: 'danger', href: '/admin/expenses' });
    }

    if (pendingBalance > 0) rows.push({ id: 'pending', title: 'Customer payments pending', detail: `${formatCurrency(pendingBalance)} remains uncollected today.`, tone: 'info', href: '/admin/customers' });
    if (!closingRows.length) rows.push({ id: 'closing', title: 'Daily closing is pending', detail: 'No closing record has been submitted for today.', tone: 'info', href: '/admin/production' });
    return rows.slice(0, 6);
  }, [overallView, branchSnapshots, lowStockThreshold, production, availableStock, todayExpenses, sales, pendingBalance, closingRows]);

  const activities = useMemo<ActivityItem[]>(() => {
    const saleItems = salesRows.map((sale: any, index: number) => ({
      id: `sale-${sale._id || index}`,
      type: 'sale' as const,
      title: sale.customer?.name || sale.customerName || 'Customer sale',
      detail: `${(sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0)} bars sold`,
      value: formatCurrency(Number(sale.totalAmount || 0)),
      date: sale.createdAt || sale.date,
      branch: sale.branch?.name,
    }));
    const expenses = expenseRows
      .filter((row: any) => row.date && indiaDateKey(row.date) === today)
      .map((row: any, index: number) => ({
        id: `expense-${row._id || index}`,
        type: 'expense' as const,
        title: row.workerName || row.truckName || String(row.costType || 'Business expense').replace(/_/g, ' '),
        detail: String(row.costType || 'Expense').replace(/_/g, ' '),
        value: `-${formatCurrency(Number(row.amount || 0))}`,
        date: row.createdAt || row.date,
        branch: row.branch?.name,
      }));
    const productions = closingRows.map((row: any, index: number) => ({
      id: `production-${row._id || index}`,
      type: 'production' as const,
      title: row.branch?.name ? `${row.branch.name} production` : 'Production update',
      detail: `${Number(row.produced || 0)} produced · ${row.status || 'open'}`,
      value: `${Number(row.sold || 0)} sold`,
      date: row.updatedAt || row.date || new Date().toISOString(),
      branch: row.branch?.name,
    }));
    return [...saleItems, ...expenses, ...productions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [salesRows, expenseRows, closingRows, today]);

  if (authLoading || loading || selectedBranch === null) {
    return <div className="grid min-h-[55vh] place-items-center"><DashboardLoader label="Building your dashboard..." /></div>;
  }

  if (!data) {
    return (
      <div className="rounded-[2rem] border border-red-100 bg-white px-5 py-16 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-xl text-red-600"><FiAlertCircle /></div>
        <h2 className="mt-4 text-lg font-extrabold text-navy-900">Dashboard unavailable</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{loadError || 'Could not load dashboard data.'}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-5">Try again</button>
      </div>
    );
  }

  const scopeName = overallView ? 'All branches' : activeBranch?.name || (isSuperAdmin ? 'Selected branch' : 'Your branch');
  const summary = [
    { label: 'Today production', value: formatBarQuantity(production) || '0', suffix: 'bars', icon: FiPackage, tone: 'blue', href: '/admin/production', helper: `${formatBarQuantity(soldBars) || '0'} bars sold` },
    { label: 'Today sales', value: formatCurrency(sales), icon: FiTrendingUp, tone: 'emerald', href: '/admin/sales', helper: `${salesRows.length} bills today` },
    { label: "Today's collection", value: formatCurrency(collection), icon: FiCheckCircle, tone: 'emerald', href: '/admin/sales', helper: 'Sales and pending-bill payments' },
    { label: 'Pending bills collected', value: formatCurrency(pendingPaymentCollection), icon: FiClock, tone: 'violet', href: '/admin/customers', helper: 'Outstanding payments received today' },
    { label: 'Total expenses', value: formatCurrency(todayExpenses), icon: FiDollarSign, tone: 'red', href: '/admin/expenses', helper: `${expenseRows.filter((row) => row.date && indiaDateKey(row.date) === today).length} entries` },
    { label: 'Net balance', value: formatCurrency(netBalance), icon: FiBarChart2, tone: netBalance >= 0 ? 'violet' : 'red', href: '/admin/reports', helper: 'Collection after expenses' },
    { label: 'Available stock', value: formatBarQuantity(availableStock) || '0', suffix: 'bars', icon: FiBox, tone: availableStock <= lowStockThreshold && lowStockThreshold > 0 ? 'amber' : 'cyan', href: '/admin/production', helper: lowStockThreshold ? `Alert level: ${lowStockThreshold}` : 'Current ready stock' },
    { label: 'Active team', value: `${activeTrucks} / ${activeWorkers}`, icon: FiUsers, tone: 'indigo', href: '/admin/workers', helper: 'Trucks / workers' },
  ];

  const comparisonData = branchSnapshots.map((snapshot) => ({
    name: snapshot.branch.code || snapshot.branch.name,
    value: snapshot[comparisonMetric],
  }));

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute right-10 top-8 hidden h-28 w-28 rounded-full border border-white/10 lg:block" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-iceblue-100 backdrop-blur-sm">
              {isSuperAdmin ? <FiShield /> : <FiBriefcase />}
              {isSuperAdmin ? 'Super admin command centre' : 'Branch operations'}
            </div>
            <h1 className="max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {overallView ? 'Your entire network, in one view.' : `${scopeName}, today.`}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {overallView ? `Combined performance across ${branches.length} branches with live operational attention points.` : 'Production, sales, cash, stock, people, and action items for the selected branch.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiGitBranch className="text-iceblue-300" />{scopeName}</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiClock className="text-emerald-300" />{formatDate(`${today}T12:00:00+05:30`)}</span>
          </div>
        </div>
      </section>

      {isSuperAdmin && (
        <section className="rounded-2xl border border-white/80 bg-white/90 p-2.5 shadow-[0_14px_40px_-30px_rgba(15,43,61,0.4)] backdrop-blur-sm">
          <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => selectBranch('')} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${overallView ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><FiGrid /> All branches <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${overallView ? 'bg-white/10' : 'bg-slate-100'}`}>{branches.length}</span></button>
            <span className="h-6 w-px shrink-0 bg-slate-200" />
            {branches.map((branch) => (
              <button key={branch._id} type="button" onClick={() => selectBranch(branch._id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${selectedBranch === branch._id ? 'bg-iceblue-50 text-iceblue-700 ring-1 ring-inset ring-iceblue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><span className={`h-2 w-2 rounded-full ${branch.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{branch.name}<span className="text-[9px] font-semibold text-slate-400">{branch.code}</span></button>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((item) => <SummaryCard key={item.label} {...item} />)}
      </section>

      {overallView && (
        <section>
          <SectionHeading icon={FiGitBranch} title="Branch comparison" subtitle="Today’s location-by-location performance" action={<Link href="/admin/branches" className="inline-flex items-center gap-1.5 text-xs font-bold text-iceblue-700 hover:text-iceblue-900">Manage branches <FiArrowRight /></Link>} />
          {branchSnapshots.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {branchSnapshots.map((snapshot) => <BranchCard key={snapshot.branch._id} snapshot={snapshot} onView={() => selectBranch(snapshot.branch._id)} lowStockThreshold={lowStockThreshold} />)}
            </div>
          ) : <EmptyState icon={FiGitBranch} title="No branch snapshots" text="Branch comparison data is not available yet." />}
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <Panel>
          {overallView ? (
            <>
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-extrabold text-navy-900">Compare branches</h2><p className="mt-1 text-xs text-slate-500">Switch the metric to compare every location.</p></div>
                <div className="flex rounded-xl bg-slate-100 p-1">
                  {(['sales', 'production', 'expenses'] as ComparisonMetric[]).map((metric) => <button key={metric} type="button" onClick={() => setComparisonMetric(metric)} className={`rounded-lg px-3 py-2 text-[10px] font-bold capitalize transition ${comparisonMetric === metric ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}>{metric}</button>)}
                </div>
              </div>
              <div className="p-4 sm:p-5">
                {comparisonData.some((row) => row.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(value) => comparisonMetric === 'production' ? `${value}` : compactCurrency(value)} width={46} />
                      <Tooltip cursor={{ fill: '#f0fbff' }} formatter={(value: any) => comparisonMetric === 'production' ? [`${Number(value)} bars`, 'Production'] : [formatCurrency(Number(value)), comparisonMetric === 'sales' ? 'Sales' : 'Expenses']} />
                      <Bar dataKey="value" fill={comparisonMetric === 'sales' ? '#10b981' : comparisonMetric === 'production' ? '#1ca6d1' : '#ef4444'} radius={[8, 8, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState icon={FiBarChart2} title="No comparison activity" text="Data will appear as branches record today’s activity." />}
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-slate-100 p-5"><h2 className="font-extrabold text-navy-900">Sales trend</h2><p className="mt-1 text-xs text-slate-500">Last seven days for {scopeName}.</p></div>
              <div className="p-4 sm:p-5">
                {salesTrend.some((row: any) => row.total > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="dashboardSalesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1ca6d1" stopOpacity={0.35} /><stop offset="95%" stopColor="#1ca6d1" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={compactCurrency} width={46} />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Sales']} />
                      <Area type="monotone" dataKey="total" stroke="#1284ac" strokeWidth={3} fill="url(#dashboardSalesFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyState icon={FiTrendingUp} title="No sales trend yet" text="Sales activity will appear here as bills are created." />}
              </div>
            </>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-extrabold text-navy-900">Attention required</h2><p className="mt-1 text-xs text-slate-500">Items that may need action today.</p></div><span className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-xs font-black ${alerts.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{alerts.length}</span></div>
          <div className="space-y-2 p-3">
            {alerts.length ? alerts.map((alert) => <AlertRow key={alert.id} {...alert} />) : (
              <div className="grid min-h-[250px] place-items-center px-5 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-xl text-emerald-600"><FiCheckCircle /></span><h3 className="mt-4 font-extrabold text-navy-900">Everything looks good</h3><p className="mt-1 text-xs leading-5 text-slate-500">No operational alerts require attention.</p></div></div>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <Panel>
          <div className="border-b border-slate-100 p-5"><h2 className="font-extrabold text-navy-900">Stock position</h2><p className="mt-1 text-xs text-slate-500">Today’s production-to-stock movement.</p></div>
          <div className="p-5">
            <div className="rounded-2xl bg-gradient-to-br from-navy-900 to-iceblue-800 p-5 text-white">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-iceblue-200">Available now</p>
              <p className="mt-2 text-4xl font-black tracking-tight">{formatBarQuantity(availableStock) || '0'} <span className="text-sm font-semibold text-slate-300">bars</span></p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-iceblue-300" style={{ width: `${Math.min(100, Math.max(0, production ? (soldBars / production) * 100 : 0))}%` }} /></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StockMini label="Produced" value={production} tone="blue" />
              <StockMini label="Sold" value={soldBars} tone="emerald" />
              <StockMini label="Remaining" value={availableStock} tone="amber" />
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-extrabold text-navy-900">Recent activity</h2><p className="mt-1 text-xs text-slate-500">Latest sales, expenses, and production updates.</p></div><FiClock className="text-slate-400" /></div>
          <div className="divide-y divide-slate-100 px-4">
            {activities.length ? activities.map((activity) => <ActivityRow key={activity.id} activity={activity} />) : <div className="py-14"><EmptyState icon={FiClock} title="No activity today" text="New activity will appear here automatically." compact /></div>}
          </div>
        </Panel>
      </section>

      <section>
        <SectionHeading icon={isSuperAdmin ? FiShield : FiGrid} title={isSuperAdmin ? 'Super admin controls' : 'Branch shortcuts'} subtitle={isSuperAdmin ? 'Manage the network and review company-wide reporting.' : 'Open the tools used for daily branch operations.'} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(isSuperAdmin ? [
            { href: '/admin/branches', label: 'Manage branches', detail: `${branches.length} locations`, icon: FiGitBranch, tone: 'blue' },
            { href: '/admin/admins', label: 'Branch admins', detail: 'Access and credentials', icon: FiUserCheck, tone: 'violet' },
            { href: '/admin/reports', label: 'Network reports', detail: 'Compare performance', icon: FiBarChart2, tone: 'emerald' },
            { href: '/admin/settings/company', label: 'Company settings', detail: 'Business configuration', icon: FiSettings, tone: 'amber' },
          ] : [
            { href: '/admin/production', label: 'Production', detail: 'Record daily output', icon: FiPackage, tone: 'blue' },
            { href: '/admin/sales', label: 'Sales', detail: 'Create and review bills', icon: FiShoppingCart, tone: 'emerald' },
            { href: '/admin/expenses', label: 'Expenses', detail: 'Record branch costs', icon: FiDollarSign, tone: 'red' },
            { href: '/admin/trucks', label: 'Trucks', detail: 'Manage distribution', icon: FiTruck, tone: 'amber' },
          ]).map((action) => <QuickAction key={action.href} {...action} />)}
        </div>
      </section>
    </div>
  );
}

const toneStyles: Record<string, { icon: string; text: string; border: string; soft: string }> = {
  blue: { icon: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-100', soft: 'bg-blue-50' },
  emerald: { icon: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-100', soft: 'bg-emerald-50' },
  red: { icon: 'bg-red-500', text: 'text-red-700', border: 'border-red-100', soft: 'bg-red-50' },
  violet: { icon: 'bg-violet-500', text: 'text-violet-700', border: 'border-violet-100', soft: 'bg-violet-50' },
  cyan: { icon: 'bg-cyan-500', text: 'text-cyan-700', border: 'border-cyan-100', soft: 'bg-cyan-50' },
  indigo: { icon: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-indigo-100', soft: 'bg-indigo-50' },
  amber: { icon: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-100', soft: 'bg-amber-50' },
};

function SummaryCard({ label, value, suffix, icon: Icon, tone, href, helper }: any) {
  const palette = toneStyles[tone] || toneStyles.blue;
  return (
    <Link href={href} className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,43,61,0.45)] transition hover:-translate-y-0.5 hover:shadow-md ${palette.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className={`mt-2 truncate text-2xl font-black tracking-tight ${palette.text}`}>{value}{suffix && <span className="ml-1 text-[10px] font-bold text-slate-400">{suffix}</span>}</p><p className="mt-1 truncate text-[10px] text-slate-500">{helper}</p></div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm ${palette.icon}`}><Icon size={15} /></span>
      </div>
      <FiArrowRight className="absolute bottom-4 right-4 translate-x-2 text-slate-300 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
    </Link>
  );
}

function BranchCard({ snapshot, onView, lowStockThreshold }: { snapshot: BranchSnapshot; onView: () => void; lowStockThreshold: number }) {
  const { branch } = snapshot;
  const stockLow = lowStockThreshold > 0 && snapshot.stock <= lowStockThreshold;
  return (
    <article className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)] transition hover:-translate-y-1 hover:border-iceblue-200 hover:shadow-md">
      <div className={`h-1.5 ${branch.isActive ? 'bg-gradient-to-r from-emerald-400 to-iceblue-400' : 'bg-slate-300'}`} />
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-iceblue-50 text-xs font-black text-iceblue-700 ring-1 ring-iceblue-100">{branch.code.slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{branch.code}</p><h3 className="truncate text-base font-extrabold text-navy-900">{branch.name}</h3></div></div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-black uppercase ${branch.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${branch.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{branch.isActive ? 'Live' : 'Offline'}</span>
      </div>
      <div className="grid grid-cols-2 border-y border-slate-100 bg-slate-50/60 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
        <BranchMetric label="Production" value={`${formatBarQuantity(snapshot.production) || 0}`} />
        <BranchMetric label="Sales" value={formatCurrency(snapshot.sales)} positive />
        <BranchMetric label="Expenses" value={formatCurrency(snapshot.expenses)} danger={snapshot.expenses > snapshot.sales && snapshot.expenses > 0} />
        <BranchMetric label="Stock" value={`${formatBarQuantity(snapshot.stock) || 0}`} danger={stockLow} />
      </div>
      <div className="flex items-center gap-3 p-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-white"><FiUserCheck size={13} /></span>
        <div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Administrator</p><p className="truncate text-xs font-bold text-navy-900">{branch.admin?.displayName || 'Not assigned'}</p></div>
        <button type="button" onClick={onView} className="inline-flex items-center gap-1.5 rounded-xl bg-iceblue-50 px-3 py-2 text-[10px] font-bold text-iceblue-700 transition hover:bg-iceblue-100">View branch <FiArrowRight /></button>
      </div>
    </article>
  );
}

function BranchMetric({ label, value, positive, danger }: { label: string; value: string; positive?: boolean; danger?: boolean }) {
  return <div className="border-b border-r border-slate-100 px-2 py-3 text-center last:border-r-0 sm:border-b-0 md:border-b xl:border-b-0"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 truncate text-[11px] font-extrabold ${danger ? 'text-red-600' : positive ? 'text-emerald-700' : 'text-navy-900'}`}>{value}</p></div>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">{children}</div>;
}

function SectionHeading({ icon: Icon, title, subtitle, action }: { icon: any; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-center justify-between gap-4 px-1"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><Icon /></span><div><h2 className="font-extrabold text-navy-900">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div></div>{action}</div>;
}

function AlertRow({ title, detail, tone, href }: { title: string; detail: string; tone: 'danger' | 'warning' | 'info'; href: string }) {
  const palette = tone === 'danger' ? 'bg-red-50 text-red-600 ring-red-100' : tone === 'warning' ? 'bg-amber-50 text-amber-600 ring-amber-100' : 'bg-iceblue-50 text-iceblue-600 ring-iceblue-100';
  return <Link href={href} className="group flex items-start gap-3 rounded-2xl p-3 transition hover:bg-slate-50"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${palette}`}><FiAlertCircle /></span><div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-navy-900">{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p></div><FiArrowRight className="mt-2 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-iceblue-600" /></Link>;
}

function StockMini({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'emerald' | 'amber' }) {
  const classes = tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
  return <div className={`rounded-xl px-2 py-3 text-center ${classes}`}><p className="text-[8px] font-black uppercase tracking-wider opacity-70">{label}</p><p className="mt-1 text-lg font-black">{formatBarQuantity(value) || '0'}</p></div>;
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const icon = activity.type === 'sale' ? FiShoppingCart : activity.type === 'expense' ? FiDollarSign : FiPackage;
  const Icon = icon;
  const palette = activity.type === 'sale' ? 'bg-emerald-50 text-emerald-600' : activity.type === 'expense' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600';
  const valueColor = activity.type === 'expense' ? 'text-red-600' : activity.type === 'sale' ? 'text-emerald-700' : 'text-blue-700';
  return (
    <div className="flex items-center gap-3 py-3.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${palette}`}><Icon size={14} /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-navy-900">{activity.title}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{activity.detail}{activity.branch ? ` · ${activity.branch}` : ''}</p></div>
      <div className="shrink-0 text-right"><p className={`text-[11px] font-extrabold ${valueColor}`}>{activity.value}</p><p className="mt-0.5 text-[9px] text-slate-400">{new Date(activity.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</p></div>
    </div>
  );
}

function QuickAction({ href, label, detail, icon: Icon, tone }: any) {
  const palette = toneStyles[tone] || toneStyles.blue;
  return <Link href={href} className={`group flex items-center gap-3 rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md ${palette.border}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${palette.icon}`}><Icon /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-navy-900">{label}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{detail}</span></span><FiArrowRight className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-iceblue-600" /></Link>;
}

function EmptyState({ icon: Icon, title, text, compact = false }: { icon: any; title: string; text: string; compact?: boolean }) {
  return <div className={`grid place-items-center px-5 text-center ${compact ? 'min-h-32' : 'min-h-[280px]'}`}><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-iceblue-50 text-xl text-iceblue-500"><Icon /></span><h3 className="mt-3 text-sm font-extrabold text-navy-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>;
}
