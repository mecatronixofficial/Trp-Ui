'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiBox,
  FiCheckCircle,
  FiDollarSign,
  FiGitBranch,
  FiShoppingCart,
  FiTrendingUp,
  FiPlus,
  FiTruck,
  FiCheck,
  FiCalendar,
  FiRefreshCw,
  FiArrowUpRight,
  FiArrowDownRight,
  FiBarChart2,
} from 'react-icons/fi';
import api, { COST_TYPES, formatBarQuantity, formatCurrency, formatDate, getItemBarUsed, todayISO } from '../../../lib/api';
import { selectedBranchHeaders } from '../../../lib/branch-fetch';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';
import ExpenseForm from '../../../components/ExpenseForm';
import { useAuth } from '../../../context/AuthContext';
import { getOpeningProductionStock } from '../../../lib/production-stock';

type BranchOption = { _id: string; name: string; code: string; isActive?: boolean };

const expenseName = (record: any) => {
  const costType = String(record.costType || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (['advance_for_employee', 'advance_for_emp', 'advance_employee', 'advance', 'employee_advance'].includes(costType) && record.workerName) {
    return record.workerName;
  }
  return COST_TYPES.find((type) => type.value === record.costType)?.label || record.categoryName || record.description || record.costType || 'Expense';
};
const indiaDateKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
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
    if (authLoading) return;
    const storedBranch = window.localStorage.getItem('tii_selected_branch') || '';
    setSelectedBranch(isSuperAdmin ? storedBranch : user?.branch || '');
    if (isSuperAdmin) {
      api.get('/branches')
        .then(({ data }) => setBranches(Array.isArray(data) ? data : []))
        .catch(() => setBranches([]));
    }
  }, [authLoading, isSuperAdmin, user?.branch]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      const today = todayISO();
      try {
        const [salesResult, productionResult, stockResult, wastageResult, outsourceResult, truckLoadResult, closingResult, truckResult, assignmentResult, expenseResult] = await Promise.all([
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
        setSalesData(Array.isArray(salesResult.data) ? salesResult.data : []);
        const productionRows = Array.isArray(productionResult.data) ? productionResult.data : [];
        const stockRows = Array.isArray(stockResult.data) ? stockResult.data : [];
        const closingRows = Array.isArray(closingResult.data) ? closingResult.data : [];
        setAllProductionData(productionRows);
        setProductionData(productionRows.filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setStockData(stockRows);
        setWastageData((Array.isArray(wastageResult.data) ? wastageResult.data : []).filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setOutsourceData((Array.isArray(outsourceResult.data) ? outsourceResult.data : []).filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setTruckLoadData((Array.isArray(truckLoadResult.data) ? truckLoadResult.data : []).filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setOpeningStock(closingRows.length ? Math.max(0, Number(closingRows[0].openingBalance || 0)) : null);
        setClosingStock(closingRows.length
          ? closingRows.reduce((sum: number, record: any) => sum + Number(
            record.status === 'closed'
              ? record.returnedTotal ?? record.returned ?? 0
              : record.closingBalance ?? 0,
          ), 0)
          : null);
        const truckRows = Array.isArray(truckResult.data) ? truckResult.data : [];
        setTrucks(truckRows);
        setSelectedTruck((current) => current || truckRows.find((truck: any) => truck.status !== false)?._id || '');
        setAssignments(Object.fromEntries((Array.isArray(assignmentResult.data) ? assignmentResult.data : []).map((row: any) => [String(row.truck?._id || row.truck), Number(row.quantity || 0) + Number(row.pendingQuantity || 0)])));
        setExpensesData(Array.isArray(expenseResult.records) ? expenseResult.records : []);
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || requestError?.message || 'Could not load entry data.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [refreshKey]);

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
      driverName: record.driverName || record.workerName || '',
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
  const sortedProduction = [...productionData].sort((a, b) => String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id)));
  const openBox = sortedProduction[0]?.boxOpen;
  const closeBox = sortedProduction[sortedProduction.length - 1]?.boxClose;
  const producedToday = productionData.reduce((sum, record) => sum + Number(record.totalBars || 0), 0);
  const movedToStock = stockData
    .filter((record) => record.date && indiaDateKey(record.date) === todayISO())
    .reduce((sum, record) => sum + Number(record.quantity || 0), 0);
  // Live shop balance: what's been produced today, minus what was moved to
  // stock, assigned to trucks, or sold — so adding a sale (or production)
  // immediately reflects here. Once the day is closed, daily-closing's
  // returned total is the authoritative figure instead.
  const carriedStock = openingStock ?? getOpeningProductionStock(stockData, todayISO(), indiaDateKey, undefined, allProductionData);
  const outsourcedBars = outsourceData.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
  const wastedBars = wastageData
    .filter((record) => record.reason !== 'unsold' && !record.truck)
    .reduce((sum, record) => sum + getItemBarUsed(record), 0);
  const acceptedTruckBars = truckLoadData.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
  const liveStock = Math.max(0, producedToday + (producedToday > 0 ? carriedStock : 0) + outsourcedBars - wastedBars - movedToStock - acceptedTruckBars - totalBars);
  const totalStock = closingStock ?? liveStock;
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const overallView = isSuperAdmin && !selectedBranch;

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#d7edf5] bg-white">
        <div className="text-center">
          <FiRefreshCw className="mx-auto mb-3 animate-spin text-2xl text-[#187f9d]" />
          <p className="text-sm font-semibold text-[#64808f]">Loading today&apos;s entries...</p>
        </div>
      </div>
    );
  }

  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const pendingCollection = Math.max(totalSales - collectionAmount, 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top toolbar */}
        <section className="rounded-2xl border border-[#1a6d8d]/20 bg-gradient-to-r from-[#0a1d2b] via-[#0c4a6e] to-[#13698a] px-3 py-4 text-white shadow-[0_18px_45px_-28px_rgba(10,29,43,0.75)] sm:rounded-[28px] sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">
                <FiGitBranch className="text-cyan-100" />
                Entry Report
              </div>
              <h1 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-2xl">
                Today&apos;s Business Summary
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-white/75 sm:text-sm">
                Sales, collection, expenses, production and truck entries.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <div className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white backdrop-blur-sm sm:col-auto sm:h-11 sm:text-sm">
                <FiCalendar />
                {todayLabel}
              </div>

              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-[#0c4a6e] shadow-sm transition hover:bg-[#eaf9fd] sm:h-11 sm:w-auto sm:px-4 sm:text-sm"
              >
                Refresh
                <FiRefreshCw />
              </button>

              <button
                type="button"
                disabled={overallView}
                title={overallView ? 'Select a branch first' : undefined}
                onClick={() => setSaleModalOpen(true)}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto sm:px-4 sm:text-sm"
              >
                <FiPlus />
                Add Sale
              </button>

              <button
                type="button"
                disabled={overallView}
                title={overallView ? 'Select a branch first' : undefined}
                onClick={() => setExpenseModalOpen(true)}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto sm:px-4 sm:text-sm"
              >
                <FiPlus />
                Add Expense
              </button>

              <button
                type="button"
                disabled={overallView}
                title={overallView ? 'Select a branch first' : undefined}
                onClick={() => {
                  setActionError('');
                  setAssignModalOpen(true);
                }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto sm:px-4 sm:text-sm"
              >
                <FiTruck />
                Assign Truck
              </button>

              <button
                type="button"
                disabled={overallView}
                title={overallView ? 'Select a branch first' : undefined}
                onClick={() => router.push('/admin/production?openProduction=1')}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto sm:px-4 sm:text-sm"
              >
                <FiBox />
                Add Production
              </button>
            </div>
          </div>
        </section>

        {/* Branch selector */}
        {isSuperAdmin && (
          <section className="flex flex-col gap-3 rounded-2xl border border-[#d7edf5] bg-white/95 px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf8fc] text-[#0f6d8c]">
                <FiGitBranch />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8aa3af]">Entry View</p>
                <p className="font-semibold text-[#0a2436]">
                  {activeBranch ? `${activeBranch.name} (${activeBranch.code})` : 'Overall — all branches'}
                </p>
                {overallView && (
                  <p className="mt-0.5 text-xs text-white/65">
                    Combined entries are read-only. Select a branch to add a sale or assign a truck.
                  </p>
                )}
              </div>
            </div>

            <select
              className="h-11 w-full rounded-xl border border-[#d7edf5] bg-white px-3 text-sm font-semibold text-[#29495c] outline-none transition focus:border-[#2d9fba] focus:ring-4 focus:ring-[#d7f1f7] sm:max-w-xs"
              aria-label="Change entry branch"
              value={selectedBranch || ''}
              onChange={(event) => changeBranch(event.target.value)}
            >
              <option value="">Overall — all branches</option>
              {branches
                .filter((branch) => branch.isActive !== false)
                .map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
            </select>
          </section>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
          >
            {error}
          </p>
        )}

        {/* Compact summary cards */}
        <section className="mx-auto grid w-full max-w-[1450px] gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Sale */}
         <article className="relative min-h-[185px] overflow-hidden rounded-2xl border border-[#cfe5ee] bg-white shadow-[0_14px_35px_-26px_rgba(10,74,110,0.55)] sm:h-[185px]">
  {/* Left Accent */}
  <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-[#0a1d2b] via-[#0c4a6e] to-[#1f90ad]" />

  <div className="flex h-full flex-col justify-between p-3 pl-4 sm:p-4 sm:pl-5">
    {/* Top */}
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-[#123247]">
          Sale
        </p>

        <p className="mt-4 text-xs font-medium text-[#64808f]">
          {todayLabel}
        </p>

        <p className="mt-1 text-xl font-extrabold leading-none text-[#091f2f] sm:text-2xl">
          {formatCurrency(totalSales)}
        </p>
      </div>

      {/* Bigger Sale Icon */}
      <div className="relative">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0c4a6e] to-[#1f90ad] text-white shadow-[0_8px_20px_-8px_rgba(12,74,110,0.75)] sm:h-12 sm:w-12 sm:rounded-2xl">
          <FiShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>

        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-[#39b8d2]" />
      </div>
    </div>

    {/* Bottom */}
    <div className="flex items-center justify-between gap-2 sm:gap-3">
      {/* Bars Sold */}
      <div className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-[#dcecf2] bg-[#f7fcfe] px-2.5 py-2 sm:min-w-[125px] sm:px-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8aa3af]">
            Bars Sold
          </p>

          <p className="mt-0.5 text-base font-extrabold text-[#123247]">
            {formatBarQuantity(totalBars) || '0'}
          </p>
        </div>

        <span className="h-7 w-1 rounded-full bg-[#1f90ad]" />
      </div>

      {/* Mini Chart */}
      <div className="flex h-10 shrink-0 items-end gap-1 rounded-xl border border-[#dcecf2] bg-[#f7fcfe] px-2 py-2 sm:gap-1.5 sm:px-3">
        {[12, 18, 15, 22, 19, 26, 23].map((height, index) => (
          <span
            key={index}
            className="w-2 rounded-t-sm bg-gradient-to-t from-[#0c4a6e] to-[#2f9fba] sm:w-2.5"
            style={{ height: `${height}px` }}
          />
        ))}
      </div>
    </div>
  </div>
</article>

          {/* Production */}
          <article className="relative min-h-[185px] overflow-hidden rounded-2xl border border-[#cfe5ee] bg-white shadow-[0_14px_35px_-26px_rgba(10,74,110,0.55)] sm:h-[185px]">
  {/* Left Accent */}
  <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-[#0a1d2b] via-[#0c4a6e] to-[#1f90ad]" />

  <div className="flex h-full flex-col justify-between p-3 pl-4 sm:p-4 sm:pl-5">
    {/* Top */}
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-[#123247]">
          Production
        </p>

        <p className="mt-4 text-xs font-medium text-[#64808f]">
          {todayLabel}
        </p>

        <div className="mt-1 flex items-end gap-1.5">
          <p className="text-2xl font-extrabold leading-none text-[#091f2f]">
            {formatBarQuantity(producedToday) || '0'}
          </p>

          <span className="pb-0.5 text-xs font-semibold text-[#8aa3af]">
            bars
          </span>
        </div>
      </div>

      {/* Bigger FiBox */}
      <div className="relative">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0c4a6e] to-[#1f90ad] text-white shadow-[0_8px_20px_-8px_rgba(12,74,110,0.75)] sm:h-12 sm:w-12 sm:rounded-2xl">
          <FiBox className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>

        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-[#39b8d2]" />
      </div>
    </div>

    {/* Bottom */}
    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
      {/* Open Box */}
      <div className="flex items-center justify-between rounded-xl border border-[#dcecf2] bg-[#f7fcfe] px-2.5 py-2 sm:px-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8aa3af]">
            Open Box
          </p>

          <p className="mt-0.5 text-base font-extrabold text-[#123247]">
            {openBox ?? '-'}
          </p>
        </div>

        <span className="h-7 w-1 rounded-full bg-[#1f90ad]" />
      </div>

      {/* Close Box */}
      <div className="flex items-center justify-between rounded-xl border border-[#dcecf2] bg-[#f7fcfe] px-2.5 py-2 sm:px-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8aa3af]">
            Close Box
          </p>

          <p className="mt-0.5 text-base font-extrabold text-[#123247]">
            {closeBox ?? '-'}
          </p>
        </div>

        <span className="h-7 w-1 rounded-full bg-[#0c4a6e]" />
      </div>
    </div>
  </div>
</article>

          {/* Expense / Collection */}
        <article className="relative min-h-[185px] overflow-hidden rounded-2xl border border-[#cfe5ee] bg-white shadow-[0_14px_35px_-26px_rgba(10,74,110,0.55)] sm:h-[185px] md:col-span-2 xl:col-span-1">
  {/* Left Accent */}
  <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-[#0a1d2b] via-[#0c4a6e] to-[#1f90ad]" />

  <div className="flex h-full flex-col justify-between p-3 pl-4 sm:p-4 sm:pl-5">
    {/* Top */}
    <div className="flex items-start justify-between gap-3">
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <p className="text-sm font-bold text-[#123247]">
            Expense
          </p>

          <div className="mt-4 flex items-end gap-1.5">
            <p className="text-2xl font-extrabold leading-none text-[#091f2f]">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-[#123247]">
            Collection
          </p>

          <div className="mt-4 flex items-end gap-1.5">
            <p className="text-2xl font-extrabold leading-none text-[#091f2f]">
              {formatCurrency(collectionAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Bigger Chart Icon */}
      <div className="relative">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0c4a6e] to-[#1f90ad] text-white shadow-[0_8px_20px_-8px_rgba(12,74,110,0.75)] sm:h-12 sm:w-12 sm:rounded-2xl">
          <FiBarChart2 className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>

        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-[#39b8d2]" />
      </div>
    </div>

    {/* Bottom */}
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
      {/* Expense */}
      <div className="flex items-center justify-between rounded-xl border border-[#dcecf2] bg-[#f7fcfe] px-2.5 py-2 sm:px-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8aa3af]">
            Expense
          </p>

          <div className="mt-0.5 flex items-center gap-1.5">
            <FiArrowDownRight className="text-sm text-red-500" />

            <p className="text-base font-extrabold text-[#123247]">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
        </div>

        <span className="h-7 w-1 rounded-full bg-red-400" />
      </div>

      {/* Collection */}
      <div className="flex items-center justify-between rounded-xl border border-[#dcecf2] bg-[#f7fcfe] px-2.5 py-2 sm:px-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8aa3af]">
            Collection
          </p>

          <div className="mt-0.5 flex items-center gap-1.5">
            <FiArrowUpRight className="text-sm text-[#187f9d]" />

            <p className="text-base font-extrabold text-[#123247]">
              {formatCurrency(collectionAmount)}
            </p>
          </div>
        </div>

        <span className="h-7 w-1 rounded-full bg-[#0c4a6e]" />
      </div>
    </div>
  </div>
</article>
        </section>

        {/* Secondary summary - matching the screenshot's wide cards */}
        <section className="grid gap-3 sm:gap-4 xl:grid-cols-2">
  {/* Sales Collection */}
  <article className="relative overflow-hidden rounded-2xl border border-[#cfe5ee] bg-white shadow-[0_14px_35px_-26px_rgba(10,74,110,0.55)]">
    {/* Left Accent */}
    <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-[#0a1d2b] via-[#0c4a6e] to-[#1f90ad]" />

    <div className="p-4 pl-5 sm:p-5 sm:pl-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base font-bold text-[#123247]">
            Sales Collection
          </h2>

          <p className="mt-1 text-xs font-medium text-[#8aa3af]">
            Today&apos;s receivable summary
          </p>
        </div>

        {/* Bigger Icon */}
        <div className="relative">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0c4a6e] to-[#1f90ad] text-white shadow-[0_8px_20px_-8px_rgba(12,74,110,0.75)] sm:h-12 sm:w-12 sm:rounded-2xl">
            <FiTrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>

          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-[#39b8d2]" />
        </div>
      </div>

      {/* Total Sales */}
      <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8aa3af]">
            Total Sales
          </p>

          <p className="mt-1 text-xl font-extrabold leading-none text-[#091f2f] sm:text-2xl">
            {formatCurrency(totalSales)}
          </p>
        </div>

        <div className="w-full rounded-xl bg-[#f4fbfe] px-3 py-2 text-left sm:w-auto sm:text-right">
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#8aa3af]">
            Sales Count
          </p>

          <p className="mt-0.5 text-lg font-extrabold text-[#123247]">
            {sales.length}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold">
          <span className="text-[#64808f]">
            Collection Progress
          </span>

          <span className="text-[#13698a]">
            {totalSales > 0
              ? `${Math.min(
                  Math.round((collectionAmount / totalSales) * 100),
                  100
                )}%`
              : '0%'}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-[#e7f3f8]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0c4a6e] to-[#2f9fba] transition-all duration-300"
            style={{
              width:
                totalSales > 0
                  ? `${Math.min(
                      (collectionAmount / totalSales) * 100,
                      100
                    )}%`
                  : '0%',
            }}
          />
        </div>
      </div>

      {/* Bottom */}
      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        {/* Collected */}
        <div className="flex items-center justify-between rounded-xl border border-[#dcecf2] bg-[#f7fcfe] px-3 py-2.5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#187f9d]">
              Collected
            </p>

            <p className="mt-1 text-base font-extrabold text-[#123247]">
              {formatCurrency(collectionAmount)}
            </p>
          </div>

          <span className="h-8 w-1 rounded-full bg-[#1f90ad]" />
        </div>

        {/* Pending */}
        <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-600">
              Pending
            </p>

            <p className="mt-1 text-base font-extrabold text-[#123247]">
              {formatCurrency(pendingCollection)}
            </p>
          </div>

          <span className="h-8 w-1 rounded-full bg-amber-400" />
        </div>
      </div>
    </div>
  </article>

 {/* Net total */}
        <section className="rounded-2xl border border-[#1a6d8d]/20 bg-gradient-to-r from-[#0a1d2b] via-[#0c4a6e] to-[#13698a] p-4 text-white shadow-[0_20px_48px_-30px_rgba(10,29,43,0.75)] sm:rounded-3xl sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-lg text-white sm:h-12 sm:w-12 sm:rounded-2xl sm:text-xl">
                <FiTrendingUp />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100/85">Final Total</p>
                <h3 className="mt-1 text-base font-bold text-white sm:text-lg">Today&apos;s net collection</h3>
                <p className="mt-0.5 text-xs text-[#8aa3af]">Collection Amount − Total Expenses</p>
              </div>
            </div>

            <div className="sm:text-right">
              <p className={`text-2xl font-bold tracking-tight sm:text-3xl ${finalTotal < 0 ? 'text-rose-200' : 'text-white'}`}>
                {formatCurrency(finalTotal)}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-white/65">
                <FiCheckCircle />
                Updated for today
              </p>
            </div>
          </div>
        </section>

  {/* Operations Overview */}
  <article className="relative overflow-hidden rounded-2xl border border-[#cfe5ee] bg-white shadow-[0_14px_35px_-26px_rgba(10,74,110,0.55)]">
    {/* Left Accent */}
    <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-[#0a1d2b] via-[#0c4a6e] to-[#1f90ad]" />

    <div className="p-4 pl-5 sm:p-5 sm:pl-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base font-bold text-[#123247]">
            Operations Overview
          </h2>

          <p className="mt-1 text-xs font-medium text-[#8aa3af]">
            Production, expense and net collection
          </p>
        </div>

        {/* Bigger Icon */}
        <div className="relative">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0c4a6e] to-[#1f90ad] text-white shadow-[0_8px_20px_-8px_rgba(12,74,110,0.75)] sm:h-12 sm:w-12 sm:rounded-2xl">
            <FiBox className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>

          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-[#39b8d2]" />
        </div>
      </div>

      {/* Main visual bar */}
      <div className="mt-4 rounded-xl border border-[#dcecf2] bg-[#f7fcfe] p-3 sm:mt-6">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8aa3af]">
            Today Overview
          </p>

          <p
            className={`text-sm font-extrabold ${
              finalTotal < 0 ? 'text-red-600' : 'text-[#13698a]'
            }`}
          >
            {formatCurrency(finalTotal)}
          </p>
        </div>

        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#e7f3f8]">
          <div className="h-full flex-1 bg-[#1f90ad]" />
          <div className="h-full flex-1 bg-amber-400" />
          <div className="h-full flex-1 bg-orange-400" />
          <div className="h-full flex-1 bg-red-400" />
        </div>
      </div>

      {/* Bottom Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
        {/* Stock */}
        <div className="rounded-xl border border-[#dcecf2] bg-[#f7fcfe] px-3 py-3">
          <div className="mb-2 h-2.5 w-2.5 rounded-full bg-[#1f90ad]" />

          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8aa3af]">
            Stock
          </p>

          <p className="mt-1 text-sm font-extrabold text-[#123247]">
            {formatBarQuantity(totalStock) || '0'} bars
          </p>
        </div>

        {/* Expenses */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-3">
          <div className="mb-2 h-2.5 w-2.5 rounded-full bg-amber-400" />

          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8aa3af]">
            Expenses
          </p>

          <p className="mt-1 text-sm font-extrabold text-[#123247]">
            {formatCurrency(totalExpenses)}
          </p>
        </div>

        {/* Assigned */}
        <div className="rounded-xl border border-orange-100 bg-orange-50/50 px-3 py-3">
          <div className="mb-2 h-2.5 w-2.5 rounded-full bg-orange-400" />

          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8aa3af]">
            Assigned
          </p>

          <p className="mt-1 text-sm font-extrabold text-[#123247]">
            {formatBarQuantity(
              Object.values(assignments).reduce(
                (sum, value) => sum + Number(value || 0),
                0
              )
            ) || '0'}{' '}
            bars
          </p>
        </div>

        {/* Net */}
        <div
          className={`rounded-xl border px-3 py-3 ${
            finalTotal < 0
              ? 'border-red-100 bg-red-50/60'
              : 'border-[#dcecf2] bg-[#f7fcfe]'
          }`}
        >
          <div
            className={`mb-2 h-2.5 w-2.5 rounded-full ${
              finalTotal < 0 ? 'bg-red-500' : 'bg-[#0c4a6e]'
            }`}
          />

          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8aa3af]">
            Net
          </p>

          <p
            className={`mt-1 text-sm font-extrabold ${
              finalTotal < 0 ? 'text-red-600' : 'text-[#123247]'
            }`}
          >
            {formatCurrency(finalTotal)}
          </p>
        </div>
      </div>
    </div>
  </article>
</section>

        {/* Detailed reports */}
        <section className="grid items-start gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.7fr)]">
          <article className="overflow-hidden rounded-2xl border border-[#d7edf5] bg-white shadow-[0_16px_45px_-32px_rgba(12,74,110,0.42)] sm:rounded-3xl">
            <div className="flex flex-col items-start gap-3 border-b border-[#e4f2f7] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf8fc] text-[#0f6d8c]">
                  <FiShoppingCart />
                </span>
                <div>
                  <h2 className="font-bold text-[#0a2436]">Today&apos;s Sales Report</h2>
                  <p className="text-xs text-[#8aa3af]">Customer-wise sales recorded today</p>
                </div>
              </div>
              <span className="rounded-full bg-[#e7f3f8] px-3 py-1 text-xs font-bold text-[#64808f]">
                {sales.length} sales
              </span>
            </div>

            <div className="hidden">
              {sales.map((sale, index) => (
                <div key={sale.id} className="border-b border-[#e4f2f7] px-3 py-3 last:border-b-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-[#8aa3af]">{index + 1}</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#123247]">{sale.customer}</p>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 pl-8">
                    <p className="text-xs font-semibold text-[#64808f]">
                      <span className="font-bold text-[#29495c]">{formatBarQuantity(sale.bars) || '0'}</span> bars
                    </p>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-[#0f6d8c]">{formatCurrency(sale.amount)}</p>
                  </div>
                </div>
              ))}
              {sales.length === 0 && (
                <p className="px-3 py-10 text-center text-sm text-[#8aa3af]">No sales recorded today.</p>
              )}
              {sales.length > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-[#d7edf5] bg-[#f4fbfe] px-3 py-3 text-xs font-bold uppercase tracking-[0.1em] text-[#64808f]">
                  <span>Today Total · {formatBarQuantity(totalBars) || '0'} bars</span>
                  <span className="text-[#0f6d8c]">{formatCurrency(totalSales)}</span>
                </div>
              )}
            </div>

            <div className="max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-[#e4f2f7] bg-[#f4fbfe] text-[11px] font-bold uppercase tracking-[0.12em] text-[#8aa3af]">
                    <th className="w-12 px-3 py-3 text-center sm:w-14 sm:px-5">#</th>
                    <th className="px-3 py-3 text-left sm:px-5">Customer</th>
                    <th className="px-3 py-3 text-left sm:px-5">Shop / Driver</th>
                    <th className="px-3 py-3 text-right sm:px-5">Bars</th>
                    <th className="px-3 py-3 text-right sm:px-5">Amount</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#e4f2f7]">
                  {sales.map((sale, index) => (
                    <tr key={sale.id} className="transition hover:bg-[#f4fbfe]/80">
                      <td className="px-3 py-4 text-center text-[#8aa3af] sm:px-5">{index + 1}</td>
                      <td className="px-3 py-4 font-semibold text-[#123247] sm:px-5">{sale.customer}</td>
                      <td className="px-3 py-4 sm:px-5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${sale.source === 'Driver' ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>{sale.source}</span><p className="mt-1 text-xs text-[#64808f]">{sale.sourceName}</p></td>
                      <td className="px-3 py-4 text-right font-bold text-[#29495c] sm:px-5">
                        {formatBarQuantity(sale.bars) || '0'}
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-[#0f6d8c] sm:px-5">
                        {formatCurrency(sale.amount)}
                      </td>
                    </tr>
                  ))}

                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-[#8aa3af] sm:px-5 sm:py-12">
                        No sales recorded today.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot>
                  <tr className="border-t border-[#d7edf5] bg-[#f4fbfe] font-bold">
                    <td colSpan={3} className="px-3 py-4 text-right text-xs uppercase tracking-[0.12em] text-[#64808f] sm:px-5">
                      Today Total
                    </td>
                    <td className="px-3 py-4 text-right text-[#0a2436] sm:px-5">{formatBarQuantity(totalBars) || '0'}</td>
                    <td className="px-3 py-4 text-right text-[#0f6d8c] sm:px-5">{formatCurrency(totalSales)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-[#d7edf5] bg-white shadow-[0_16px_45px_-32px_rgba(12,74,110,0.42)] sm:rounded-3xl">
            <div className="flex items-center gap-3 border-b border-[#e4f2f7] px-4 py-3.5 sm:px-5 sm:py-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-500">
                <FiDollarSign />
              </span>
              <div>
                <h2 className="font-bold text-[#0a2436]">Today&apos;s Expense Report</h2>
                <p className="text-xs text-[#8aa3af]">Expense name and amount</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-[#f4fbfe] text-[#29495c]"><tr><th className="w-14 border-b border-[#d7edf5] px-3 py-3 text-center text-[10px] font-bold uppercase sm:px-5">S.No</th><th className="border-b border-[#d7edf5] px-3 py-3 text-[10px] font-bold uppercase sm:px-5">Expense Name</th><th className="border-b border-[#d7edf5] px-3 py-3 text-[10px] font-bold uppercase sm:px-5">Category</th><th className="border-b border-[#d7edf5] px-3 py-3 text-[10px] font-bold uppercase sm:px-5">Source</th><th className="border-b border-[#d7edf5] px-3 py-3 text-[10px] font-bold uppercase sm:px-5">Date</th><th className="border-b border-[#d7edf5] px-3 py-3 text-right text-[10px] font-bold uppercase sm:px-5">Amount</th></tr></thead>
                <tbody className="divide-y divide-[#e4f2f7]">
                  {expenses.map((expense, index) => <tr key={expense.id} className="transition hover:bg-[#f4fbfe]/80"><td className="px-3 py-3 text-center text-[#8aa3af] sm:px-5">{index + 1}</td><td className="px-3 py-3 sm:px-5"><p className="font-semibold text-[#29495c]">{expense.driverName || expense.name}</p>{expense.notes && <p className="mt-1 max-w-xs break-words text-xs text-[#64808f]">{expense.notes}</p>}</td><td className="px-3 py-3 font-medium text-[#29495c] sm:px-5">{expense.category}</td><td className="px-3 py-3 sm:px-5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${expense.source === 'Driver' ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>{expense.source}</span></td><td className="whitespace-nowrap px-3 py-3 text-[#64808f] sm:px-5">{expense.date ? formatDate(expense.createdAt || expense.date) : '-'}</td><td className="whitespace-nowrap px-3 py-3 text-right font-bold text-red-500 sm:px-5">{formatCurrency(expense.amount)}</td></tr>)}
                  {expenses.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#8aa3af]">No expenses recorded today.</td></tr>}
                </tbody>
                <tfoot><tr className="border-t border-[#d7edf5] bg-[#f4fbfe] font-bold"><td colSpan={5} className="px-3 py-4 text-right text-xs uppercase tracking-[0.12em] text-[#123247] sm:px-5">Total Expenses</td><td className="whitespace-nowrap px-3 py-4 text-right text-red-500 sm:px-5">{formatCurrency(totalExpenses)}</td></tr></tfoot>
              </table>
            </div>
          </article>
        </section>

       

        {/* Existing modals - functionality unchanged */}
        {saleModalOpen && (
          <Modal title="Add Sale" onClose={() => setSaleModalOpen(false)}>
            <SaleForm
              trucks={trucks}
              onSaved={() => {
                setSaleModalOpen(false);
                setRefreshKey((key) => key + 1);
              }}
            />
          </Modal>
        )}

        {expenseModalOpen && (
          <Modal title="Add Expense" onClose={() => setExpenseModalOpen(false)}>
            <ExpenseForm
              onSaved={() => {
                setExpenseModalOpen(false);
                setRefreshKey((key) => key + 1);
              }}
            />
          </Modal>
        )}

        {assignModalOpen && (
          <Modal title="Assign Bars to Truck" onClose={() => setAssignModalOpen(false)}>
            <form onSubmit={saveAssignment} className="space-y-4">
              <div>
                <label className="label-text">Truck</label>
                <select
                  required
                  className="input-field h-12"
                  value={selectedTruck}
                  onChange={(event) => setSelectedTruck(event.target.value)}
                >
                  <option value="">Select truck</option>
                  {trucks
                    .filter((truck) => truck.status !== false)
                    .map((truck) => (
                      <option key={truck._id} value={truck._id}>
                        {truck.truckName}
                        {truck.truckNumber ? ` (${truck.truckNumber})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {selectedTruck && (
                <div className="rounded-xl border border-[#d7edf5] bg-[#eefafe] px-4 py-3 text-sm">
                  <span className="text-[#64808f]">Already assigned today</span>
                  <strong className="float-right text-[#0a2436]">
                    {formatBarQuantity(assignments[selectedTruck] || 0) || '0'} bars
                  </strong>
                </div>
              )}

              <div>
                <label className="label-text">Bars to Add</label>
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  required
                  className="input-field h-12"
                  placeholder="0.25, 0.5, 1..."
                  value={assignQuantity}
                  onChange={(event) => setAssignQuantity(event.target.value)}
                />
              </div>

              {actionError && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                  {actionError}
                </p>
              )}

              <button
                type="submit"
                disabled={savingAssignment}
                className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:opacity-50"
              >
                <FiCheck />
                {savingAssignment ? 'Assigning...' : 'Assign Bars'}
              </button>
            </form>
          </Modal>
        )}

      </div>
  );
}
