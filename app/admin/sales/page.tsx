'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiDollarSign,
  FiEdit2,
  FiFilter,
  FiGitBranch,
  FiGrid,
  FiList,
  FiLock,
  FiPlus,
  FiPrinter,
  FiRefreshCcw,
  FiSearch,
  FiShield,
  FiShoppingCart,
  FiTrash2,
  FiTrendingUp,
} from 'react-icons/fi';
import api from '../../../lib/api';
import { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../lib/api';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';
import PrintBill from '../../../components/PrintBill';
import PaymentModal from '../../../components/PaymentModal';
import { useAuth } from '../../../context/AuthContext';
import { errorMessage, endOfIndiaDay, formatTime, indiaDateISO, startOfIndiaDay, type Sale, type TruckOption } from '../../../lib/salesUtils';

interface BranchOption {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export default function AdminSalesPage() {
  const { user, loading: authLoading } = useAuth();
  const today = indiaDateISO();
  const [sales, setSales] = useState<Sale[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Sale | null>(null);
  const [paymentList, setPaymentList] = useState<'paid' | 'balance' | null>(null);
  const [deletingId, setDeletingId] = useState('');
  const [pageError, setPageError] = useState('');
  const [filters, setFilters] = useState({ from: today, to: today, saleType: '', search: '' });
  const [appliedFilters, setAppliedFilters] = useState({ from: today, to: today, saleType: '', search: '' });
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageSales = !isSuperAdmin || Boolean(selectedBranch);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const showingToday = appliedFilters.from === today && appliedFilters.to === today;
  const overallView = Boolean(isSuperAdmin && !selectedBranch);
  const scopeName = overallView ? 'All branches' : activeBranch?.name || 'Assigned branch';

  const load = async (activeFilters = appliedFilters) => {
    setLoading(true);
    setPageError('');
    try {
      const params: Record<string, string> = {
        from: startOfIndiaDay(activeFilters.from || today),
        to: endOfIndiaDay(activeFilters.to || today),
      };
      if (activeFilters.saleType) params.saleType = activeFilters.saleType;
      const { data } = await api.get('/sales', { params });
      setSales(Array.isArray(data) ? data : []);
      setAppliedFilters(activeFilters);
    } catch (error: any) {
      setSales([]);
      setPageError(errorMessage(error, 'Could not load sales.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const storedBranch = window.localStorage.getItem('tii_selected_branch') || '';
    setSelectedBranch(isSuperAdmin ? storedBranch : (user?.branch || ''));
    if (isSuperAdmin) {
      api.get('/branches')
        .then(({ data }) => setBranches(Array.isArray(data) ? data : []))
        .catch((error) => setPageError(errorMessage(error, 'Could not load branches.')));
    }
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    if (canManageSales) {
      api.get('/trucks')
        .then((truckRows) => setTrucks(Array.isArray(truckRows.data) ? truckRows.data : []))
        .catch((error) => setPageError(errorMessage(error, 'Could not load sales filters.')));
    } else {
      setTrucks([]);
    }
    void load({ from: today, to: today, saleType: '', search: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManageSales, selectedBranch]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  const visibleSales = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter((sale) => [sale.customer?.name, sale.customer?.phoneNumber, sale.truck?.truckName]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [filters.search, sales]);

  const summary = useMemo(() => visibleSales.reduce((total, sale) => ({
    bars: total.bars + (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0),
    amount: total.amount + Number(sale.totalAmount || 0),
    paid: total.paid + Number(sale.paidAmount || 0),
    balance: total.balance + Number(sale.balanceAmount || 0),
  }), { bars: 0, amount: 0, paid: 0, balance: 0 }), [visibleSales]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) {
      setPageError('From date cannot be after To date.');
      return;
    }
    void load(filters);
  };

  const resetFilters = () => {
    const reset = { from: today, to: today, saleType: '', search: '' };
    setFilters(reset);
    void load(reset);
  };

  const closeSaleModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const openAddSale = () => {
    if (!canManageSales) return;
    setEditing(null);
    setModalOpen(true);
  };

  useEffect(() => {
    if (authLoading || !canManageSales || new URLSearchParams(window.location.search).get('add') !== 'sale') return;
    setEditing(null);
    setModalOpen(true);
    window.history.replaceState({}, '', window.location.pathname);
  }, [authLoading, canManageSales]);

  const remove = async (id: string) => {
    if (!canManageSales) return;
    if (!confirm('Delete this sale entry?')) return;
    setDeletingId(id);
    setPageError('');
    try {
      await api.delete(`/sales/${id}`);
      await load();
    } catch (error: any) {
      setPageError(errorMessage(error, 'Could not delete the sale.'));
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-iceblue-100">
              {isSuperAdmin ? <FiShield /> : <FiLock />}
              {isSuperAdmin ? 'Super admin sales centre' : 'Branch sales workspace'}
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Sales management</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {overallView
                ? `Review consolidated sales, collections, and outstanding balances across ${branches.length} branches.`
                : `Create bills, collect payments, and review customer sales for ${scopeName}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiGitBranch className="text-iceblue-300" />{scopeName}</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiCalendar className="text-emerald-300" />{showingToday ? 'Today' : `${formatDate(startOfIndiaDay(appliedFilters.from))} – ${formatDate(startOfIndiaDay(appliedFilters.to))}`}</span>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50"><FiRefreshCcw /> Refresh</button>
            {canManageSales && <button type="button" onClick={openAddSale} className="inline-flex items-center gap-2 rounded-xl bg-iceblue-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-iceblue-400"><FiPlus /> Add sale</button>}
          </div>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-white/80 bg-white/90 p-2.5 shadow-[0_14px_40px_-30px_rgba(15,43,61,0.4)] backdrop-blur-sm">
          <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => changeBranch('')} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${overallView ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><FiGrid /> All branches <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${overallView ? 'bg-white/10' : 'bg-slate-100'}`}>{branches.length}</span></button>
            <span className="h-6 w-px shrink-0 bg-slate-200" />
            {branches.filter((branch) => branch.isActive).map((branch) => (
              <button key={branch._id} type="button" onClick={() => changeBranch(branch._id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${selectedBranch === branch._id ? 'bg-iceblue-50 text-iceblue-700 ring-1 ring-inset ring-iceblue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><span className="h-2 w-2 rounded-full bg-emerald-500" />{branch.name}<span className="text-[9px] font-semibold text-slate-400">{branch.code}</span></button>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><FiCheckCircle /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Assigned branch active</p><p className="mt-0.5 text-[10px] text-slate-500">Bills and collections are automatically recorded under your branch.</p></div>
        </section>
      )}

      {overallView && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><FiLock /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Network sales view is read-only</p><p className="mt-1 text-[10px] leading-4 text-slate-600">You can filter, print, and review consolidated bills. Select a branch before adding, editing, deleting, or collecting a payment.</p></div>
        </section>
      )}

      {!loading && !pageError && (
        <section>
          <div className="mb-4 flex items-center gap-3 px-1"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><FiTrendingUp /></span><div><h2 className="font-extrabold text-navy-900">Sales snapshot</h2><p className="text-xs text-slate-500">Performance for the selected date range.</p></div></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SalesSummaryCard
            icon={FiList}
            label="Ice Bars Sold"
            value={formatBarQuantity(summary.bars) || '0'}
            helper="Total bars in view"
            tone="blue"
          />
          <SalesSummaryCard
            icon={FiDollarSign}
            label={showingToday ? "Today's Total Sale" : 'Total Sale'}
            value={formatCurrency(summary.amount)}
            helper={activeBranch ? `${activeBranch.name} sales` : isSuperAdmin ? 'All branches combined' : 'Total billed'}
            tone="cyan"
          />
          <SalesSummaryCard
            icon={FiCheckCircle}
            label="Amount Paid"
            value={formatCurrency(summary.paid)}
            helper="Collected so far"
            tone="violet"
            onClick={() => setPaymentList('paid')}
          />
          <SalesSummaryCard
            icon={FiAlertCircle}
            label="Balance Due"
            value={formatCurrency(summary.balance)}
            helper="Pending collection"
            danger={summary.balance > 0}
            tone="amber"
            onClick={() => setPaymentList('balance')}
          />
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="mr-auto flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-iceblue-50 text-iceblue-600"><FiShoppingCart /></span>
            <div><h2 className="font-extrabold text-navy-900">{showingToday ? "Today's sales" : 'Sales records'}</h2><p className="mt-0.5 text-[10px] text-slate-500">{visibleSales.length} bills · {scopeName}</p></div>
          </div>
          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs font-semibold text-navy-900 outline-none transition placeholder:text-slate-400 focus:border-iceblue-300 focus:bg-white focus:ring-4 focus:ring-iceblue-50" placeholder="Search customer, phone, or truck..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <Link href="/admin/sales/all" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-navy-900">
            <FiList /> Sales archive
          </Link>
          {canManageSales && <button type="button" onClick={openAddSale} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-xs font-bold text-white transition hover:bg-iceblue-800"><FiPlus /> Add sale</button>}
        </div>

        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3 lg:px-5">
          <div className="w-full sm:w-[145px]">
            <label className="label-text text-[11px]">From</label>
            <input type="date" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-iceblue-300" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="w-full sm:w-[145px]">
            <label className="label-text text-[11px]">To</label>
            <input type="date" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-iceblue-300" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="w-full sm:w-[130px]">
            <label className="label-text text-[11px]">Sale Type</label>
            <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-iceblue-300" value={filters.saleType} onChange={(e) => setFilters({ ...filters, saleType: e.target.value })}>
              <option value="">All</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
          <button type="submit" className="flex h-10 items-center gap-1.5 rounded-xl bg-navy-900 px-3 text-xs font-bold text-white transition hover:bg-iceblue-800"><FiFilter /> Apply</button>
          <button type="button" onClick={resetFilters} className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-navy-900">
            <FiRefreshCcw /> Reset
          </button>
        </form>

        {pageError && (
          <div className="m-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            <FiAlertCircle className="mt-0.5 shrink-0" />
            <span>{pageError}</span>
          </div>
        )}

        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <>
          <div className="sm:hidden">
            {visibleSales.map((s, index) => (
              <div key={s._id} className="border-b border-slate-100 px-4 py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-navy-800/45">{index + 1}</span>
                      <p className="font-medium text-navy-900">{formatDate(s.date)}</p>
                      <span className="text-xs text-navy-800/45">{formatTime(s.date)}</span>
                    </div>
                    {s.customer?._id ? (
                      <Link
                        href={`/admin/customers/${s.customer._id}`}
                        className="mt-1 block truncate font-medium text-navy-900 underline-offset-2 hover:underline"
                      >
                        {s.customer.name}
                      </Link>
                    ) : (
                      <p className="mt-1 font-medium text-navy-800/60">Unknown customer</p>
                    )}
                    <p className="text-[10px] text-navy-800/45">{s.customer?.phoneNumber || 'No phone'}</p>
                  </div>
                  <p className="shrink-0 font-extrabold tabular-nums text-emerald-700">{formatCurrency(s.totalAmount)}</p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-navy-800/45">Bars</p>
                    <p className="font-semibold tabular-nums text-navy-900">{formatBarQuantity((s.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0)) || '0'}</p>
                  </div>
                  <div>
                    <p className="text-navy-800/45">Paid</p>
                    <p className="font-semibold tabular-nums text-navy-900">{formatCurrency(s.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-navy-800/45">Balance</p>
                    <p className={`font-semibold tabular-nums ${s.balanceAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(s.balanceAmount)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <button type="button" onClick={() => setPrintSale(s)} className="flex items-center gap-1 text-xs font-semibold text-navy-900 hover:text-black" title="Print sale" aria-label="Print sale"><FiPrinter /> Print</button>
                  {canManageSales && s.balanceAmount > 0 && (
                    <button type="button" onClick={() => setPaymentTarget(s)} className="flex items-center gap-1 text-xs font-semibold text-navy-900 hover:text-black" title="Collect payment" aria-label="Collect payment">
                      <FiDollarSign /> Collect
                    </button>
                  )}
                  {canManageSales && <>
                    <button type="button" onClick={() => { setEditing(s); setModalOpen(true); }} className="flex items-center gap-1 text-xs font-semibold text-navy-900 hover:text-black" title="Edit sale" aria-label="Edit sale"><FiEdit2 /> Edit</button>
                    <button type="button" onClick={() => remove(s._id)} disabled={deletingId === s._id} className="flex items-center gap-1 text-xs font-semibold text-navy-900 hover:text-black disabled:opacity-40" title="Delete sale" aria-label="Delete sale"><FiTrash2 /> Delete</button>
                  </>}
                </div>
              </div>
            ))}
            {visibleSales.length === 0 && (
              <p className="px-4 py-8 text-center text-navy-800/50">No sales found for the selected filters.</p>
            )}
            {visibleSales.length > 0 && (
              <div className="border-t border-slate-300 bg-slate-100 px-4 py-3 text-xs font-bold text-navy-900">
                <div className="flex items-center justify-between"><span>TOTAL BARS</span><span>{formatBarQuantity(summary.bars) || '0'}</span></div>
                <div className="mt-1 flex items-center justify-between"><span>TOTAL AMOUNT</span><span>{formatCurrency(summary.amount)}</span></div>
                <div className="mt-1 flex items-center justify-between"><span>TOTAL PAID</span><span>{formatCurrency(summary.paid)}</span></div>
                <div className="mt-1 flex items-center justify-between"><span>TOTAL BALANCE</span><span>{formatCurrency(summary.balance)}</span></div>
              </div>
            )}
          </div>
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-[11px] sm:text-xs lg:text-sm">
            <thead className="bg-slate-50/80 text-slate-400">
              <tr>
                <th className="w-[4%] border-b border-slate-100 px-1 py-3 text-center text-[9px] font-black uppercase tracking-wider">#</th>
                <th className="w-[14%] border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Date</th>
                <th className="w-[24%] border-b border-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wider">Customer</th>
                <th className="w-[8%] border-b border-slate-100 px-3 py-3 text-right text-[9px] font-black uppercase tracking-wider">Bars</th>
                <th className="w-[14%] border-b border-slate-100 px-3 py-3 text-right text-[9px] font-black uppercase tracking-wider">Total</th>
                <th className="hidden w-[12%] border-b border-slate-100 px-3 py-3 text-right text-[9px] font-black uppercase tracking-wider sm:table-cell">Paid</th>
                <th className="w-[12%] border-b border-slate-100 px-3 py-3 text-right text-[9px] font-black uppercase tracking-wider">Balance</th>
                <th className="w-[12%] border-b border-slate-100 px-3 py-3 text-center text-[9px] font-black uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSales.map((s, index) => (
                <tr key={s._id} className="transition hover:bg-iceblue-50/40">
                  <td className="px-2 py-4 text-center text-slate-400">{index + 1}</td>
                  <td className="px-3 py-4">
                    <p className="font-medium text-navy-900">{formatDate(s.date)}</p>
                    <p className="mt-0.5 text-xs text-navy-800/45">{formatTime(s.date)}</p>
                  </td>
                  <td className="break-words px-3 py-4">
                    {s.customer?._id ? (
                      <Link
                        href={`/admin/customers/${s.customer._id}`}
                        className="font-medium text-navy-900 underline-offset-2 hover:underline"
                      >
                        {s.customer.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-navy-800/60">Unknown customer</p>
                    )}
                    <p className="mt-0.5 hidden text-[10px] text-navy-800/45 sm:block">{s.customer?.phoneNumber || 'No phone'}</p>
                  </td>
                  <td className="px-3 py-4 text-right font-semibold tabular-nums text-navy-900">{formatBarQuantity((s.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0)) || '0'}</td>
                  <td className="px-3 py-4 text-right font-extrabold tabular-nums text-navy-900">{formatCurrency(s.totalAmount)}</td>
                  <td className="hidden px-3 py-4 text-right font-semibold tabular-nums text-emerald-700 sm:table-cell">{formatCurrency(s.paidAmount)}</td>
                  <td className={`px-3 py-4 text-right font-extrabold tabular-nums ${s.balanceAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(s.balanceAmount)}</td>
                  <td className="px-2 py-4">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button type="button" onClick={() => setPrintSale(s)} className="text-navy-900 hover:text-black" title="Print sale" aria-label="Print sale"><FiPrinter /></button>
                      {canManageSales && s.balanceAmount > 0 && (
                        <button type="button" onClick={() => setPaymentTarget(s)} className="text-navy-900 hover:text-black" title="Collect payment" aria-label="Collect payment">
                          <FiDollarSign />
                        </button>
                      )}
                      {canManageSales && <>
                      <button type="button" onClick={() => { setEditing(s); setModalOpen(true); }} className="text-navy-900 hover:text-black" title="Edit sale" aria-label="Edit sale"><FiEdit2 /></button>
                      <button type="button" onClick={() => remove(s._id)} disabled={deletingId === s._id} className="text-navy-900 hover:text-black disabled:opacity-40" title="Delete sale" aria-label="Delete sale"><FiTrash2 /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleSales.length === 0 && <tr><td colSpan={8} className="py-14 text-center text-navy-800/50">No sales found for the selected filters.</td></tr>}
            </tbody>
            <tfoot className="border-t border-slate-100 bg-slate-50/80 font-bold text-navy-900"><tr><td colSpan={3} className="px-3 py-4 text-right text-[9px] uppercase tracking-wider text-slate-500">Total</td><td className="px-3 py-4 text-right">{formatBarQuantity(summary.bars) || '0'}</td><td className="px-3 py-4 text-right">{formatCurrency(summary.amount)}</td><td className="hidden px-3 py-4 text-right text-emerald-700 sm:table-cell">{formatCurrency(summary.paid)}</td><td className="px-3 py-4 text-right text-red-600">{formatCurrency(summary.balance)}</td><td /></tr></tfoot>
          </table>
          </div>
          </>
        )}
      </section>

      {modalOpen && (
        <Modal title={editing ? 'Edit Sale' : 'Add Sale'} onClose={closeSaleModal} wide>
          <SaleForm trucks={trucks} initial={editing} onSaved={() => { closeSaleModal(); void load(); }} />
        </Modal>
      )}

      {printSale && <PrintBill sale={printSale} onClose={() => setPrintSale(null)} />}

      {paymentTarget && (
        <PaymentModal
          sale={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={() => { setPaymentTarget(null); void load(); }}
        />
      )}

      {paymentList && (
        <Modal
          title={paymentList === 'paid' ? 'Paid Customers' : 'Customers with Balance Due'}
          onClose={() => setPaymentList(null)}
          wide
        >
          <CustomerPaymentTable
            sales={visibleSales.filter((sale) => paymentList === 'paid' ? Number(sale.paidAmount || 0) > 0 : Number(sale.balanceAmount || 0) > 0)}
            mode={paymentList}
          />
        </Modal>
      )}

      {canManageSales && <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 sm:bottom-7 sm:right-7">
        <button
          type="button"
          onClick={openAddSale}
          aria-label="Add sale"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-iceblue-600 text-white shadow-lg shadow-iceblue-900/20 transition hover:-translate-y-0.5 hover:bg-iceblue-700 focus:outline-none focus:ring-4 focus:ring-iceblue-200 sm:h-14 sm:w-14"
        >
          <FiPlus className="text-xl" />
        </button>
      </div>}
    </div>
  );
}

function SalesSummaryCard({ icon: Icon, label, value, helper, danger = false, tone = 'blue', onClick }: { icon: any; label: string; value: string | number; helper?: string; danger?: boolean; tone?: 'blue' | 'cyan' | 'violet' | 'amber'; onClick?: () => void }) {
  const styles = {
    blue: { soft: 'bg-blue-50', icon: 'bg-blue-500', border: 'border-blue-100' },
    cyan: { soft: 'bg-cyan-50', icon: 'bg-cyan-500', border: 'border-cyan-100' },
    violet: { soft: 'bg-violet-50', icon: 'bg-violet-500', border: 'border-violet-100' },
    amber: { soft: 'bg-amber-50', icon: 'bg-amber-500', border: 'border-amber-100' },
  }[tone];
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`relative min-h-[120px] min-w-0 overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_14px_35px_-28px_rgba(15,43,61,0.45)] transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default ${danger ? 'border-red-100' : styles.border}`}>
      <span className={`absolute -right-7 -top-7 h-20 w-20 rounded-full ${danger ? 'bg-red-50' : styles.soft}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p><p className={`mt-2 break-words text-xl font-black leading-tight tracking-tight ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>{helper && <p className={`mt-2 text-[10px] ${danger ? 'text-red-500' : 'text-slate-500'}`}>{helper}</p>}</div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm ${danger ? 'bg-red-500' : styles.icon}`}><Icon /></span>
      </div>
    </button>
  );
}

function CustomerPaymentTable({ sales, mode }: { sales: Sale[]; mode: 'paid' | 'balance' }) {
  const total = sales.reduce((sum, sale) => sum + Number(mode === 'paid' ? sale.paidAmount : sale.balanceAmount), 0);
  return (
    <div className="border border-slate-300 bg-white">
      <div className="sm:hidden">
        {sales.map((sale, index) => (
          <div key={sale._id} className="border-b border-slate-200 px-4 py-3 last:border-b-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-navy-800/45">{index + 1}</span>
              <p className="text-sm font-medium text-navy-900">{formatDate(sale.date)}</p>
            </div>
            <div className="mt-1 pl-6">
              {sale.customer?._id ? <Link href={`/admin/customers/${sale.customer._id}`} className="font-semibold hover:underline">{sale.customer.name}</Link> : 'Unknown customer'}
              <p className="text-[10px] text-slate-500">{sale.customer?.phoneNumber || 'No phone'}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 pl-6 text-xs">
              <span className="text-navy-800/60">Bill Total: <span className="font-semibold text-navy-900">{formatCurrency(sale.totalAmount)}</span></span>
              <span className="font-bold text-navy-900">{mode === 'paid' ? 'Amount Paid' : 'Balance Due'}: {formatCurrency(mode === 'paid' ? sale.paidAmount : sale.balanceAmount)}</span>
            </div>
          </div>
        ))}
        {sales.length === 0 && (
          <p className="px-4 py-8 text-center text-slate-500">No matching customer payments.</p>
        )}
        {sales.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-300 bg-slate-100 px-4 py-3 text-xs font-bold">
            <span>TOTAL</span><span>{formatCurrency(total)}</span>
          </div>
        )}
      </div>
      <div className="hidden max-w-full overflow-x-auto sm:block">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-xs text-navy-900">
        <thead className="bg-slate-100">
          <tr>
            <th className="w-[7%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">S.No</th>
            <th className="w-[17%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Bill Date</th>
            <th className="border border-slate-300 px-3 py-3 text-left font-bold uppercase">Customer</th>
            <th className="w-[17%] border border-slate-300 px-3 py-3 text-right font-bold uppercase">Bill Total</th>
            <th className="w-[17%] border border-slate-300 px-3 py-3 text-right font-bold uppercase">{mode === 'paid' ? 'Amount Paid' : 'Balance Due'}</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale, index) => (
            <tr key={sale._id} className="even:bg-slate-50">
              <td className="border border-slate-300 px-2 py-3 text-center">{index + 1}</td>
              <td className="border border-slate-300 px-3 py-3">{formatDate(sale.date)}</td>
              <td className="border border-slate-300 px-3 py-3">
                {sale.customer?._id ? <Link href={`/admin/customers/${sale.customer._id}`} className="font-semibold hover:underline">{sale.customer.name}</Link> : 'Unknown customer'}
                <p className="mt-0.5 text-[10px] text-slate-500">{sale.customer?.phoneNumber || 'No phone'}</p>
              </td>
              <td className="border border-slate-300 px-3 py-3 text-right">{formatCurrency(sale.totalAmount)}</td>
              <td className="border border-slate-300 px-3 py-3 text-right font-bold">{formatCurrency(mode === 'paid' ? sale.paidAmount : sale.balanceAmount)}</td>
            </tr>
          ))}
          {sales.length === 0 && <tr><td colSpan={5} className="border border-slate-300 py-8 text-center text-slate-500">No matching customer payments.</td></tr>}
        </tbody>
        <tfoot className="bg-slate-100 font-bold"><tr><td colSpan={4} className="border border-slate-300 px-3 py-3 text-center">TOTAL</td><td className="border border-slate-300 px-3 py-3 text-right">{formatCurrency(total)}</td></tr></tfoot>
      </table>
      </div>
    </div>
  );
}
