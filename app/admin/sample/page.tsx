'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiAlertCircle,
  FiArrowRight,
  FiBarChart2,
  FiBox,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiDollarSign,
  FiGitBranch,
  FiGrid,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiShoppingCart,
  FiTrendingUp,
  FiTruck,
} from 'react-icons/fi';
import api, {
  COST_TYPES,
  formatBarQuantity,
  formatCurrency,
  formatDate,
  getItemBarUsed,
  todayISO,
} from '../../../lib/api';
import { selectedBranchHeaders } from '../../../lib/branch-fetch';
import { getOpeningProductionStock } from '../../../lib/production-stock';
import { useAuth } from '../../../context/AuthContext';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';
import ExpenseForm from '../../../components/ExpenseForm';

type BranchOption = {
  _id: string;
  name: string;
  code: string;
  isActive?: boolean;
};

type Tone = 'blue' | 'emerald' | 'red' | 'violet' | 'cyan' | 'amber';

const expenseName = (record: any) => {
  const costType = String(record.costType || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (['advance_for_employee', 'advance_for_emp', 'advance_employee', 'advance', 'employee_advance'].includes(costType) && record.workerName) {
    return record.workerName;
  }
  return COST_TYPES.find((type) => type.value === record.costType)?.label
    || record.categoryName
    || record.description
    || record.costType
    || 'Expense';
};

const indiaDateKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(value));

export default function AdminEntryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<any[]>([]);
  const [allProductionData, setAllProductionData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [wastageData, setWastageData] = useState<any[]>([]);
  const [outsourceData, setOutsourceData] = useState<any[]>([]);
  const [truckLoadData, setTruckLoadData] = useState<any[]>([]);
  const [closingStock, setClosingStock] = useState<number | null>(null);
  const [openingStock, setOpeningStock] = useState<number | null>(null);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState('');
  const [assignQuantity, setAssignQuantity] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [actionError, setActionError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    const storedBranch = window.localStorage.getItem('tii_selected_branch') || '';
    setSelectedBranch(isSuperAdmin ? storedBranch : user.branch || '');
    if (isSuperAdmin) {
      api.get('/branches')
        .then(({ data }) => setBranches(Array.isArray(data) ? data : []))
        .catch(() => setBranches([]));
    }
  }, [authLoading, isSuperAdmin, user]);

  const changeBranch = (branch: string) => {
    if (!isSuperAdmin) return;
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      const today = todayISO();
      try {
        const results = await Promise.allSettled([
          api.get('/sales', { params: { from: `${today}T00:00:00.000+05:30`, to: `${today}T23:59:59.999+05:30` } }),
          api.get('/production'),
          api.get('/stock-entries'),
          api.get('/wastage'),
          api.get('/outsource-entries'),
          api.get('/truck-loads'),
          api.get('/daily-closing', { params: { date: today } }),
          api.get('/trucks'),
          api.get('/truck-assignments', { params: { date: today } }),
          fetch('/api/expenses?today=true', { cache: 'no-store', headers: selectedBranchHeaders() }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.message || 'Could not load expenses.');
            return payload;
          }),
        ]);

        if (!active) return;
        const fulfilled = (index: number) => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<any>).value : null;
        const salesResponse = fulfilled(0);
        const productionResponse = fulfilled(1);
        const stockResponse = fulfilled(2);
        const wastageResponse = fulfilled(3);
        const outsourceResponse = fulfilled(4);
        const truckLoadResponse = fulfilled(5);
        const closingResponse = fulfilled(6);
        const truckResponse = fulfilled(7);
        const assignmentResponse = fulfilled(8);
        const expenseResponse = fulfilled(9);

        if (!salesResponse && !productionResponse && !expenseResponse) {
          const firstFailure = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
          throw firstFailure?.reason || new Error('Could not load entry data.');
        }

        const productionRows = Array.isArray(productionResponse?.data) ? productionResponse.data : [];
        const stockRows = Array.isArray(stockResponse?.data) ? stockResponse.data : [];
        const closingRows = Array.isArray(closingResponse?.data) ? closingResponse.data : [];
        const truckRows = Array.isArray(truckResponse?.data) ? truckResponse.data : [];

        setSalesData(Array.isArray(salesResponse?.data) ? salesResponse.data : []);
        setAllProductionData(productionRows);
        setProductionData(productionRows.filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setStockData(stockRows);
        setWastageData((Array.isArray(wastageResponse?.data) ? wastageResponse.data : []).filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setOutsourceData((Array.isArray(outsourceResponse?.data) ? outsourceResponse.data : []).filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setTruckLoadData((Array.isArray(truckLoadResponse?.data) ? truckLoadResponse.data : []).filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setOpeningStock(closingRows.length ? Math.max(0, Number(closingRows[0].openingBalance || 0)) : null);
        setClosingStock(closingRows.length
          ? closingRows.reduce((sum: number, record: any) => sum + Number(
            record.status === 'closed'
              ? record.returnedTotal ?? record.returned ?? 0
              : record.closingBalance ?? 0,
          ), 0)
          : null);
        setTrucks(truckRows);
        setSelectedTruck((current) => current || truckRows.find((truck: any) => truck.status !== false)?._id || '');
        setAssignments(Object.fromEntries((Array.isArray(assignmentResponse?.data) ? assignmentResponse.data : []).map((row: any) => [
          String(row.truck?._id || row.truck),
          Number(row.quantity || 0) + Number(row.pendingQuantity || 0),
        ])));
        setExpensesData(Array.isArray(expenseResponse?.records) ? expenseResponse.records : []);

        const failedCount = results.filter((result) => result.status === 'rejected').length;
        if (failedCount) setError(`${failedCount} section${failedCount > 1 ? 's' : ''} could not be refreshed. Available data is shown.`);
      } catch (requestError: any) {
        if (active) setError(requestError?.response?.data?.message || requestError?.message || 'Could not load entry data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [authLoading, refreshKey, selectedBranch]);

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    const addQuantity = Number(assignQuantity || 0);
    if (!selectedTruck || addQuantity <= 0 || Math.round(addQuantity * 4) !== addQuantity * 4) {
      setActionError('Select a truck and enter bars in 0.25 increments.');
      return;
    }
    setSavingAssignment(true);
    setActionError('');
    try {
      await api.post('/truck-assignments', {
        truck: selectedTruck,
        date: todayISO(),
        quantity: Number(assignments[selectedTruck] || 0) + addQuantity,
      });
      setAssignModalOpen(false);
      setAssignQuantity('');
      setRefreshKey((key) => key + 1);
    } catch (requestError: any) {
      setActionError(requestError?.response?.data?.message || 'Could not assign bars to the truck.');
    } finally {
      setSavingAssignment(false);
    }
  };

  const sales = useMemo(() => salesData.map((sale) => ({
    id: sale._id,
    customer: sale.customer?.name || sale.customerName || 'Customer',
    source: sale.truck ? 'Driver' : 'Shop',
    sourceName: sale.truck
      ? `${sale.truck?.driverName || 'Driver'}${sale.truck?.truckName ? ` · ${sale.truck.truckName}` : ''}`
      : 'Shop',
    bars: (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0),
    amount: Number(sale.totalAmount || 0),
    collected: Number(sale.paidAmount || 0),
  })), [salesData]);

  const expenses = useMemo(() => [...expensesData]
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
    .map((record) => ({
      id: record._id,
      name: expenseName(record),
      category: COST_TYPES.find((type) => type.value === record.costType)?.label || record.description || record.costType || 'Expense',
      personName: record.driverName || record.workerName || '',
      source: String(record.createdByType || 'ADMIN').toUpperCase() === 'DRIVER' ? 'Driver' : 'Admin',
      notes: record.notes || record.description || '',
      date: record.date,
      createdAt: record.createdAt,
      amount: Number(record.amount || 0),
    })), [expensesData]);

  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const collectionAmount = sales.reduce((sum, sale) => sum + sale.collected, 0);
  const totalBars = sales.reduce((sum, sale) => sum + sale.bars, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const finalTotal = collectionAmount - totalExpenses;
  const pendingCollection = Math.max(totalSales - collectionAmount, 0);
  const sortedProduction = [...productionData].sort((a, b) => String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id)));
  const openBox = sortedProduction[0]?.boxOpen;
  const closeBox = sortedProduction[sortedProduction.length - 1]?.boxClose;
  const producedToday = productionData.reduce((sum, record) => sum + Number(record.totalBars || 0), 0);
  const movedToStock = stockData
    .filter((record) => record.date && indiaDateKey(record.date) === todayISO())
    .reduce((sum, record) => sum + Number(record.quantity || 0), 0);
  const carriedStock = openingStock ?? getOpeningProductionStock(stockData, todayISO(), indiaDateKey, undefined, allProductionData);
  const outsourcedBars = outsourceData.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
  const wastedBars = wastageData
    .filter((record) => record.reason !== 'unsold' && !record.truck)
    .reduce((sum, record) => sum + getItemBarUsed(record), 0);
  const acceptedTruckBars = truckLoadData.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
  const assignedBars = Object.values(assignments).reduce((sum, value) => sum + Number(value || 0), 0);
  const liveStock = Math.max(0, producedToday + carriedStock + outsourcedBars - wastedBars - movedToStock - acceptedTruckBars - totalBars);
  const totalStock = closingStock ?? liveStock;
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const overallView = Boolean(isSuperAdmin && !selectedBranch);
  const canCreateEntries = !overallView && Boolean(selectedBranch);
  const scopeName = overallView ? 'All branches' : activeBranch?.name || 'Assigned branch';
  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  if (authLoading || selectedBranch === null || loading) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-3xl border border-slate-100 bg-white">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-iceblue-50 text-xl text-iceblue-600">
            <FiRefreshCw className="animate-spin" />
          </span>
          <p className="mt-4 text-sm font-bold text-navy-900">Preparing today&apos;s workspace</p>
          <p className="mt-1 text-xs text-slate-500">Loading sales, production, expenses, and trucks.</p>
        </div>
      </div>
    );
  }

  const summary = [
    { label: 'Today sales', value: formatCurrency(totalSales), helper: `${sales.length} entries · ${formatBarQuantity(totalBars) || '0'} bars`, icon: FiShoppingCart, tone: 'blue' as Tone },
    { label: 'Collected', value: formatCurrency(collectionAmount), helper: `${formatCurrency(pendingCollection)} pending`, icon: FiTrendingUp, tone: 'emerald' as Tone },
    { label: 'Expenses', value: formatCurrency(totalExpenses), helper: `${expenses.length} entries today`, icon: FiDollarSign, tone: 'red' as Tone },
    { label: 'Net collection', value: formatCurrency(finalTotal), helper: 'Collection minus expenses', icon: FiBarChart2, tone: (finalTotal < 0 ? 'red' : 'violet') as Tone },
    { label: 'Production', value: formatBarQuantity(producedToday) || '0', suffix: 'bars', helper: `Boxes ${openBox ?? '–'} to ${closeBox ?? '–'}`, icon: FiBox, tone: 'cyan' as Tone },
    { label: 'Available stock', value: formatBarQuantity(totalStock) || '0', suffix: 'bars', helper: `${formatBarQuantity(assignedBars) || '0'} assigned to trucks`, icon: FiTruck, tone: 'amber' as Tone },
  ];

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-iceblue-100">
              {isSuperAdmin ? <FiShield /> : <FiLock />}
              {isSuperAdmin ? 'Super admin entry centre' : 'Branch entry workspace'}
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Today&apos;s business entries</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {overallView
                ? `Combined, read-only activity across ${branches.length} branches. Select a branch before creating an entry.`
                : `Record and review sales, expenses, production, and truck movement for ${scopeName}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ScopePill icon={FiGitBranch} text={scopeName} />
            <ScopePill icon={FiCalendar} text={todayLabel} />
            <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50">
              <FiRefreshCw /> Refresh
            </button>
          </div>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-white/80 bg-white/90 p-2.5 shadow-[0_14px_40px_-30px_rgba(15,43,61,0.4)] backdrop-blur-sm">
          <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => changeBranch('')} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${overallView ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}>
              <FiGrid /> All branches <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${overallView ? 'bg-white/10' : 'bg-slate-100'}`}>{branches.length}</span>
            </button>
            <span className="h-6 w-px shrink-0 bg-slate-200" />
            {branches.filter((branch) => branch.isActive !== false).map((branch) => (
              <button key={branch._id} type="button" onClick={() => changeBranch(branch._id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${selectedBranch === branch._id ? 'bg-iceblue-50 text-iceblue-700 ring-1 ring-inset ring-iceblue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {branch.name} <span className="text-[9px] font-semibold text-slate-400">{branch.code}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><FiCheckCircle /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Assigned branch active</p><p className="mt-0.5 text-[10px] text-slate-500">All entries are automatically saved under your branch.</p></div>
        </section>
      )}

      {overallView && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><FiLock /></span>
            <div><p className="text-xs font-extrabold text-navy-900">Network view is read-only</p><p className="mt-1 text-[10px] leading-4 text-slate-600">Combined figures are available for review. Select one branch above to add or change operational entries.</p></div>
          </div>
          <button type="button" onClick={() => branches[0] && changeBranch(branches[0]._id)} disabled={!branches.length} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-[10px] font-bold text-white transition hover:bg-iceblue-800 disabled:opacity-40">Select a branch <FiArrowRight /></button>
        </section>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          <FiAlertCircle className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {canCreateEntries && (
        <section>
          <SectionHeading icon={FiPlus} title="Quick entry" subtitle={`Create today's records for ${scopeName}.`} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <EntryAction icon={FiShoppingCart} label="Add sale" detail="Create a customer bill" tone="blue" onClick={() => setSaleModalOpen(true)} />
            <EntryAction icon={FiDollarSign} label="Add expense" detail="Record branch spending" tone="red" onClick={() => setExpenseModalOpen(true)} />
            <EntryAction icon={FiBox} label="Add production" detail="Record boxes and bars" tone="cyan" onClick={() => router.push('/admin/production?openProduction=1')} />
            <EntryAction icon={FiTruck} label="Assign truck" detail="Move bars for delivery" tone="amber" onClick={() => { setActionError(''); setAssignModalOpen(true); }} />
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((item) => <SummaryCard key={item.label} {...item} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Panel>
          <PanelHeader icon={FiShoppingCart} title="Today's sales" subtitle={`${scopeName} customer and driver entries`} badge={`${sales.length} sales`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50/80 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400"><th className="w-14 px-5 py-3 text-center">#</th><th className="px-5 py-3 text-left">Customer</th><th className="px-5 py-3 text-left">Source</th><th className="px-5 py-3 text-right">Bars</th><th className="px-5 py-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale, index) => (
                  <tr key={sale.id || index} className="transition hover:bg-iceblue-50/40">
                    <td className="px-5 py-4 text-center text-xs text-slate-400">{index + 1}</td>
                    <td className="px-5 py-4"><p className="font-bold text-navy-900">{sale.customer}</p></td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${sale.source === 'Driver' ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>{sale.source}</span><p className="mt-1 text-[10px] text-slate-500">{sale.sourceName}</p></td>
                    <td className="px-5 py-4 text-right text-xs font-extrabold text-navy-900">{formatBarQuantity(sale.bars) || '0'}</td>
                    <td className="px-5 py-4 text-right text-xs font-extrabold text-emerald-700">{formatCurrency(sale.amount)}</td>
                  </tr>
                ))}
                {!sales.length && <tr><td colSpan={5}><EmptyState icon={FiShoppingCart} title="No sales recorded" text="Sales entered today will appear here." /></td></tr>}
              </tbody>
              {!!sales.length && <tfoot><tr className="border-t border-slate-100 bg-slate-50/80 font-bold"><td colSpan={3} className="px-5 py-4 text-right text-[9px] uppercase tracking-wider text-slate-500">Today total</td><td className="px-5 py-4 text-right text-xs text-navy-900">{formatBarQuantity(totalBars) || '0'}</td><td className="px-5 py-4 text-right text-xs text-emerald-700">{formatCurrency(totalSales)}</td></tr></tfoot>}
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader icon={FiBarChart2} title="Daily position" subtitle="Collection and stock movement" />
          <div className="p-5">
            <div className="rounded-2xl bg-gradient-to-br from-navy-900 to-iceblue-800 p-5 text-white">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-iceblue-200">Net collection</p>
              <p className={`mt-2 text-3xl font-black tracking-tight ${finalTotal < 0 ? 'text-red-200' : 'text-white'}`}>{formatCurrency(finalTotal)}</p>
              <p className="mt-2 text-[10px] text-slate-300">Collected amount after today&apos;s expenses</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${totalSales ? Math.min(100, (collectionAmount / totalSales) * 100) : 0}%` }} /></div>
              <div className="mt-2 flex justify-between text-[9px] text-slate-300"><span>Collection progress</span><span>{totalSales ? Math.min(100, Math.round((collectionAmount / totalSales) * 100)) : 0}%</span></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniMetric label="Opening stock" value={`${formatBarQuantity(carriedStock) || '0'} bars`} />
              <MiniMetric label="Produced" value={`${formatBarQuantity(producedToday) || '0'} bars`} />
              <MiniMetric label="Truck assigned" value={`${formatBarQuantity(assignedBars) || '0'} bars`} />
              <MiniMetric label="Available" value={`${formatBarQuantity(totalStock) || '0'} bars`} />
            </div>
          </div>
        </Panel>
      </section>

      <Panel>
        <PanelHeader icon={FiDollarSign} title="Today's expenses" subtitle={`${scopeName} spending entries`} badge={`${expenses.length} expenses`} danger />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50/80 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400"><th className="w-14 px-5 py-3 text-center">#</th><th className="px-5 py-3 text-left">Expense</th><th className="px-5 py-3 text-left">Category</th><th className="px-5 py-3 text-left">Source</th><th className="px-5 py-3 text-left">Date</th><th className="px-5 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((expense, index) => (
                <tr key={expense.id || index} className="transition hover:bg-red-50/30">
                  <td className="px-5 py-4 text-center text-xs text-slate-400">{index + 1}</td>
                  <td className="px-5 py-4"><p className="font-bold text-navy-900">{expense.personName || expense.name}</p>{expense.notes && <p className="mt-1 max-w-sm truncate text-[10px] text-slate-500">{expense.notes}</p>}</td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-600">{expense.category}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${expense.source === 'Driver' ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>{expense.source}</span></td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{expense.date ? formatDate(expense.createdAt || expense.date) : '–'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right text-xs font-extrabold text-red-600">{formatCurrency(expense.amount)}</td>
                </tr>
              ))}
              {!expenses.length && <tr><td colSpan={6}><EmptyState icon={FiDollarSign} title="No expenses recorded" text="Expenses entered today will appear here." /></td></tr>}
            </tbody>
            {!!expenses.length && <tfoot><tr className="border-t border-slate-100 bg-slate-50/80 font-bold"><td colSpan={5} className="px-5 py-4 text-right text-[9px] uppercase tracking-wider text-slate-500">Total expenses</td><td className="px-5 py-4 text-right text-xs text-red-600">{formatCurrency(totalExpenses)}</td></tr></tfoot>}
          </table>
        </div>
      </Panel>

      {saleModalOpen && (
        <Modal title="Add Sale" onClose={() => setSaleModalOpen(false)}>
          <SaleForm trucks={trucks} onSaved={() => { setSaleModalOpen(false); setRefreshKey((key) => key + 1); }} />
        </Modal>
      )}

      {expenseModalOpen && (
        <Modal title="Add Expense" onClose={() => setExpenseModalOpen(false)}>
          <ExpenseForm onSaved={() => { setExpenseModalOpen(false); setRefreshKey((key) => key + 1); }} />
        </Modal>
      )}

      {assignModalOpen && (
        <Modal title="Assign Bars to Truck" onClose={() => setAssignModalOpen(false)}>
          <form onSubmit={saveAssignment} className="space-y-4">
            <div>
              <label className="label-text">Truck</label>
              <select required className="input-field h-12" value={selectedTruck} onChange={(event) => setSelectedTruck(event.target.value)}>
                <option value="">Select truck</option>
                {trucks.filter((truck) => truck.status !== false).map((truck) => (
                  <option key={truck._id} value={truck._id}>{truck.truckName}{truck.truckNumber ? ` (${truck.truckNumber})` : ''}</option>
                ))}
              </select>
            </div>
            {selectedTruck && (
              <div className="flex items-center justify-between rounded-xl border border-iceblue-100 bg-iceblue-50 px-4 py-3 text-sm">
                <span className="text-slate-500">Already assigned today</span>
                <strong className="text-navy-900">{formatBarQuantity(assignments[selectedTruck] || 0) || '0'} bars</strong>
              </div>
            )}
            <div>
              <label className="label-text">Bars to add</label>
              <input type="number" min={0.25} step={0.25} required className="input-field h-12" placeholder="0.25, 0.5, 1..." value={assignQuantity} onChange={(event) => setAssignQuantity(event.target.value)} />
            </div>
            {actionError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{actionError}</p>}
            <button type="submit" disabled={savingAssignment} className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:opacity-50">
              <FiCheck /> {savingAssignment ? 'Assigning...' : 'Assign bars'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

const toneStyles: Record<Tone, { icon: string; border: string; soft: string; text: string }> = {
  blue: { icon: 'bg-blue-500', border: 'border-blue-100', soft: 'bg-blue-50', text: 'text-blue-700' },
  emerald: { icon: 'bg-emerald-500', border: 'border-emerald-100', soft: 'bg-emerald-50', text: 'text-emerald-700' },
  red: { icon: 'bg-red-500', border: 'border-red-100', soft: 'bg-red-50', text: 'text-red-700' },
  violet: { icon: 'bg-violet-500', border: 'border-violet-100', soft: 'bg-violet-50', text: 'text-violet-700' },
  cyan: { icon: 'bg-cyan-500', border: 'border-cyan-100', soft: 'bg-cyan-50', text: 'text-cyan-700' },
  amber: { icon: 'bg-amber-500', border: 'border-amber-100', soft: 'bg-amber-50', text: 'text-amber-700' },
};

function ScopePill({ icon: Icon, text }: { icon: any; text: string }) {
  return <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><Icon className="text-iceblue-300" />{text}</span>;
}

function SectionHeading({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return <div className="mb-4 flex items-center gap-3 px-1"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><Icon /></span><div><h2 className="font-extrabold text-navy-900">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div></div>;
}

function EntryAction({ icon: Icon, label, detail, tone, onClick }: { icon: any; label: string; detail: string; tone: Tone; onClick: () => void }) {
  const palette = toneStyles[tone];
  return <button type="button" onClick={onClick} className={`group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${palette.border}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm ${palette.icon}`}><Icon /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold text-navy-900">{label}</span><span className="mt-1 block text-[10px] text-slate-500">{detail}</span></span><FiPlus className={`shrink-0 ${palette.text}`} /></button>;
}

function SummaryCard({ label, value, suffix, helper, icon: Icon, tone }: { label: string; value: string; suffix?: string; helper: string; icon: any; tone: Tone }) {
  const palette = toneStyles[tone];
  return <article className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,43,61,0.45)] ${palette.border}`}><div className={`absolute -right-7 -top-7 h-20 w-20 rounded-full opacity-60 ${palette.soft}`} /><div className="relative flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p><p className="mt-2 truncate text-2xl font-black tracking-tight text-navy-900">{value}{suffix && <span className="ml-1 text-[10px] font-bold text-slate-400">{suffix}</span>}</p><p className="mt-2 truncate text-[10px] text-slate-500">{helper}</p></div><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm ${palette.icon}`}><Icon /></span></div></article>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <article className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">{children}</article>;
}

function PanelHeader({ icon: Icon, title, subtitle, badge, danger = false }: { icon: any; title: string; subtitle: string; badge?: string; danger?: boolean }) {
  return <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5"><div className="flex items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? 'bg-red-50 text-red-600' : 'bg-iceblue-50 text-iceblue-600'}`}><Icon /></span><div><h2 className="font-extrabold text-navy-900">{title}</h2><p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p></div></div>{badge && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-500">{badge}</span>}</div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-extrabold text-navy-900">{value}</p></div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return <div className="grid min-h-48 place-items-center px-5 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-slate-400"><Icon /></span><h3 className="mt-3 text-xs font-extrabold text-navy-900">{title}</h3><p className="mt-1 text-[10px] text-slate-500">{text}</p></div></div>;
}
