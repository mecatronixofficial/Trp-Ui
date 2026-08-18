'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from 'react-icons/fi';
import api, { COST_TYPES, formatBarQuantity, formatCurrency, getItemBarUsed, todayISO } from '../../../lib/api';
import { selectedBranchHeaders } from '../../../lib/branch-fetch';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';
import { useAuth } from '../../../context/AuthContext';

type BranchOption = { _id: string; name: string; code: string; isActive?: boolean };

const expenseName = (record: any) => COST_TYPES.find((type) => type.value === record.costType)?.label || record.categoryName || record.description || record.costType || 'Expense';
const indiaDateKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));

export default function AdminEntryPage() {
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [closingStock, setClosingStock] = useState<number | null>(null);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [saleModalOpen, setSaleModalOpen] = useState(false);
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
        const [salesResult, productionResult, stockResult, closingResult, truckResult, assignmentResult, expenseResult] = await Promise.all([
          api.get('/sales', { params: { from: `${today}T00:00:00.000+05:30`, to: `${today}T23:59:59.999+05:30` } }),
          api.get('/production'),
          api.get('/stock-entries'),
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
        setProductionData((Array.isArray(productionResult.data) ? productionResult.data : []).filter((record: any) => record.date && indiaDateKey(record.date) === today));
        setStockData((Array.isArray(stockResult.data) ? stockResult.data : []).filter((record: any) => record.date && indiaDateKey(record.date) === today));
        const closedRows = (Array.isArray(closingResult.data) ? closingResult.data : []).filter((record: any) => record.status === 'closed');
        setClosingStock(closedRows.length
          ? closedRows.reduce((sum: number, record: any) => sum + Number(record.returnedTotal ?? record.returned ?? 0), 0)
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
    bars: (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0),
    amount: Number(sale.totalAmount || 0),
    collected: Number(sale.paidAmount || 0),
  })), [salesData]);
  const expenses = useMemo(() => expensesData.map((record) => ({ id: record._id, name: expenseName(record), amount: Number(record.amount || 0) })), [expensesData]);
  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const collectionAmount = sales.reduce((sum, sale) => sum + sale.collected, 0);
  const totalBars = sales.reduce((sum, sale) => sum + sale.bars, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const finalTotal = collectionAmount - totalExpenses;
  const sortedProduction = [...productionData].sort((a, b) => String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id)));
  const openBox = sortedProduction[0]?.boxOpen;
  const closeBox = sortedProduction[sortedProduction.length - 1]?.boxClose;
  const totalStock = closingStock ?? stockData.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const overallView = isSuperAdmin && !selectedBranch;

  if (loading) return <div className="card py-16 text-center text-sm text-navy-800/50">Loading today&apos;s entries...</div>;

  return (
    <div className="space-y-5 pb-8">
      {isSuperAdmin && (
        <section className="flex flex-col gap-3 rounded-2xl border border-iceblue-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><FiGitBranch /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Entry view</p>
              <p className="font-semibold text-navy-900">{activeBranch ? `${activeBranch.name} (${activeBranch.code})` : 'Overall — all branches'}</p>
              {overallView && <p className="mt-0.5 text-xs text-navy-800/45">Combined entries are read-only. Select a branch to add a sale or assign a truck.</p>}
            </div>
          </div>
          <select className="input-field h-10 sm:max-w-xs" aria-label="Change entry branch" value={selectedBranch || ''} onChange={(event) => changeBranch(event.target.value)}>
            <option value="">Overall — all branches</option>
            {branches.filter((branch) => branch.isActive !== false).map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
          </select>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-iceblue-700 text-white shadow-sm">
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
              <FiGitBranch /> Entry report
            </div>
            <h1 className="mt-1 font-display text-xl font-bold sm:text-2xl">Today&apos;s Business Summary</h1>
            <p className="mt-1 text-xs text-white/70 sm:text-sm">Sales, expenses, production and final collection balance entries.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={overallView} title={overallView ? 'Select a branch first' : undefined} onClick={() => setSaleModalOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-iceblue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"><FiPlus /> Add Sale</button>
            <button type="button" disabled={overallView} title={overallView ? 'Select a branch first' : undefined} onClick={() => { setActionError(''); setAssignModalOpen(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"><FiTruck /> Assign Truck</button>
            <span className="inline-flex h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-bold text-white ring-1 ring-white/20">Today</span>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

      {saleModalOpen && (
        <Modal title="Add Sale" onClose={() => setSaleModalOpen(false)}>
          <SaleForm trucks={trucks} onSaved={() => { setSaleModalOpen(false); setRefreshKey((key) => key + 1); }} />
        </Modal>
      )}

      {assignModalOpen && (
        <Modal title="Assign Bars to Truck" onClose={() => setAssignModalOpen(false)}>
          <form onSubmit={saveAssignment} className="space-y-4">
            <div>
              <label className="label-text">Truck</label>
              <select required className="input-field h-12" value={selectedTruck} onChange={(event) => setSelectedTruck(event.target.value)}>
                <option value="">Select truck</option>
                {trucks.filter((truck) => truck.status !== false).map((truck) => <option key={truck._id} value={truck._id}>{truck.truckName}{truck.truckNumber ? ` (${truck.truckNumber})` : ''}</option>)}
              </select>
            </div>
            {selectedTruck && <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm"><span className="text-navy-800/55">Already assigned today</span><strong className="float-right text-navy-900">{formatBarQuantity(assignments[selectedTruck] || 0) || '0'} bars</strong></div>}
            <div>
              <label className="label-text">Bars to Add</label>
              <input type="number" min={0.25} step={0.25} required className="input-field h-12" placeholder="0.25, 0.5, 1..." value={assignQuantity} onChange={(event) => setAssignQuantity(event.target.value)} />
            </div>
            {actionError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{actionError}</p>}
            <button type="submit" disabled={savingAssignment} className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:opacity-50"><FiCheck /> {savingAssignment ? 'Assigning...' : 'Assign Bars'}</button>
          </form>
        </Modal>
      )}

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:row-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-iceblue-700"><FiShoppingCart /></span>
              <div>
                <h2 className="font-display text-base font-bold text-navy-900">Today&apos;s Sales Report</h2>
                <p className="text-xs text-slate-400">Customer-wise sales recorded today</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-400">{sales.length} sales</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="w-12 px-4 py-2.5 text-center">#</th>
                  <th className="px-4 py-2.5 text-left">Customer Name</th>
                  <th className="px-4 py-2.5 text-right">Bars</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale, index) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-navy-900">{sale.customer}</td>
                    <td className="px-4 py-3 text-right font-semibold text-navy-900">{sale.bars}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(sale.amount)}</td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No sales recorded today.</td></tr>}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-bold">
                  <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase tracking-wide text-slate-500">Today Total</td>
                  <td className="px-4 py-3 text-right text-navy-900">{totalBars}</td>
                  <td className="px-4 py-3 text-right bg-gradient-to-br from-navy-900 via-navy-800 to-iceblue-700 bg-clip-text text-transparent">{formatCurrency(totalSales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-600"><FiDollarSign /></span>
            <div>
              <h2 className="font-display text-base font-bold text-navy-900">Today&apos;s Expense Report</h2>
              <p className="text-xs text-slate-400">Expense name and amount</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 px-4">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="font-medium text-navy-900">{expense.name}</span>
                <span className="font-semibold text-red-600">{formatCurrency(expense.amount)}</span>
              </div>
            ))}
            {expenses.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No expenses recorded today.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm font-bold">
            <span className="text-navy-900">Total Expenses</span>
            <span className="text-red-600">{formatCurrency(totalExpenses)}</span>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-iceblue-700"><FiBox /></span>
            <div>
              <h2 className="font-display text-base font-bold text-navy-900">Today&apos;s Production</h2>
              <p className="text-xs text-slate-400">Current box-counter report</p>
            </div>
          </div>
          <div className={`grid gap-3 p-4 ${totalStock > 0 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Open Box</p>
              <p className="mt-2 font-display text-2xl font-bold text-navy-900">{openBox ?? '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Close Box</p>
              <p className="mt-2 font-display text-2xl font-bold text-navy-900">{closeBox ?? '-'}</p>
            </div>
            {totalStock > 0 && (
              <div className="col-span-2 rounded-xl bg-slate-50 p-4 text-center sm:col-span-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stock</p>
                <p className="mt-2 font-display text-2xl font-bold bg-gradient-to-br from-navy-900 via-navy-800 to-iceblue-700 bg-clip-text text-transparent">{formatBarQuantity(totalStock) || '0'}</p>
                <p className="mt-1 text-[10px] font-medium uppercase text-slate-400">bars</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Today Total Sales</p>
            <p className="mt-2 font-display text-2xl font-bold text-navy-900">{formatCurrency(totalSales)}</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Collection Amount</p>
            <p className="mt-2 font-display text-2xl font-bold text-emerald-600">{formatCurrency(collectionAmount)}</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Expenses</p>
            <p className="mt-2 font-display text-2xl font-bold text-red-600">− {formatCurrency(totalExpenses)}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-gradient-to-br from-navy-900 via-navy-800 to-iceblue-700 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-lg"><FiTrendingUp /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Final Total</p>
              <p className="mt-1 text-xs text-blue-100/80">Collection Amount − Total Expenses</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-display text-2xl font-bold">{formatCurrency(finalTotal)}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-100 sm:justify-end"><FiCheckCircle /> Today&apos;s net collection</p>
          </div>
        </div>
      </section>
    </div>
  );
}
