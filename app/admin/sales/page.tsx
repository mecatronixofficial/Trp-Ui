'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiAlertCircle, FiCheckCircle, FiDollarSign, FiEdit2, FiFilter, FiGitBranch, FiList, FiPlus, FiPrinter, FiRefreshCcw, FiSearch, FiTrash2 } from 'react-icons/fi';
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
    openAddSale();
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
    <div className="-mt-4 space-y-1 pb-24 sm:-mt-5">
      {isSuperAdmin && (
        <section className="mb-3 flex flex-col gap-3 rounded-2xl border border-iceblue-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><FiGitBranch /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Sales view</p>
              <p className="font-semibold text-navy-900">{activeBranch ? `${activeBranch.name} (${activeBranch.code})` : 'Overall — all branches'}</p>
            </div>
          </div>
          <select className="input-field h-10 sm:max-w-xs" aria-label="Change sales branch" value={selectedBranch || ''} onChange={(event) => changeBranch(event.target.value)}>
            <option value="">Overall — all branches</option>
            {branches.filter((branch) => branch.isActive).map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
          </select>
        </section>
      )}
      {!loading && !pageError && (
        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-white to-iceblue-50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-iceblue-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
          <h1 className="shrink-0 font-display text-base font-bold text-navy-900">{showingToday ? "Today's Sales" : 'Sales'}{activeBranch ? ` — ${activeBranch.name}` : ''}</h1>
          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-iceblue-400" />
            <input className="input-field h-10 pl-9" placeholder="Search by customer, phone or truck..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <Link href="/admin/sales/all" className="btn-secondary flex h-10 shrink-0 items-center justify-center gap-2 px-4">
            <FiList /> All Sales
          </Link>
        </div>

        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-2 border-b border-iceblue-100 px-4 py-3">
          <div className="w-full sm:w-[145px]">
            <label className="label-text text-[11px]">From</label>
            <input type="date" className="input-field h-9 bg-white px-2 text-xs" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="w-full sm:w-[145px]">
            <label className="label-text text-[11px]">To</label>
            <input type="date" className="input-field h-9 bg-white px-2 text-xs" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="w-full sm:w-[130px]">
            <label className="label-text text-[11px]">Sale Type</label>
            <select className="input-field h-9 bg-white px-2 text-xs" value={filters.saleType} onChange={(e) => setFilters({ ...filters, saleType: e.target.value })}>
              <option value="">All</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
          <button type="submit" className="flex h-9 items-center gap-1.5 rounded-xl border border-navy-900/20 bg-white px-3 text-xs font-bold text-navy-900 shadow-sm transition hover:bg-iceblue-50"><FiFilter /> Apply</button>
          <button type="button" onClick={resetFilters} className="flex h-9 items-center gap-1.5 rounded-xl border border-navy-900/20 bg-white px-3 text-xs font-bold text-navy-900 shadow-sm transition hover:bg-iceblue-50">
            <FiRefreshCcw /> Reset
          </button>
        </form>

        {pageError && (
          <div className="m-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            <FiAlertCircle className="mt-0.5 shrink-0" />
            <span>{pageError}</span>
          </div>
        )}

        <div className="overflow-x-auto">
        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <table className="w-full min-w-[900px] table-fixed border-collapse text-[11px] sm:text-xs lg:text-sm">
            <thead className="bg-slate-100 text-navy-900">
              <tr>
                <th className="w-[4%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">#</th>
                <th className="w-[14%] border border-slate-300 px-1.5 py-3 text-left text-[10px] font-bold uppercase leading-tight">Date</th>
                <th className="w-[24%] border border-slate-300 px-1.5 py-3 text-left text-[10px] font-bold uppercase leading-tight">Customer Name</th>
                <th className="w-[8%] border border-slate-300 px-1.5 py-3 text-right text-[10px] font-bold uppercase leading-tight">Bars</th>
                <th className="w-[14%] border border-slate-300 px-1.5 py-3 text-right text-[10px] font-bold uppercase leading-tight">Total Amount</th>
                <th className="hidden w-[12%] border border-slate-300 px-1.5 py-3 text-right text-[10px] font-bold uppercase leading-tight sm:table-cell">Paid</th>
                <th className="w-[12%] border border-slate-300 px-1.5 py-3 text-right text-[10px] font-bold uppercase leading-tight">Balance</th>
                <th className="w-[12%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((s, index) => (
                <tr key={s._id} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                  <td className="border border-slate-300 px-1 py-2.5 text-center font-medium text-navy-900">{index + 1}</td>
                  <td className="border border-slate-300 px-1.5 py-2.5">
                    <p className="font-medium text-navy-900">{formatDate(s.date)}</p>
                    <p className="mt-0.5 text-xs text-navy-800/45">{formatTime(s.date)}</p>
                  </td>
                  <td className="border border-slate-300 px-1.5 py-2.5 break-words">
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
                  <td className="border border-slate-300 px-1.5 py-2.5 text-right font-semibold tabular-nums text-navy-900">{formatBarQuantity((s.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0)) || '0'}</td>
                  <td className="border border-slate-300 px-1.5 py-2.5 text-right font-semibold tabular-nums text-navy-900">{formatCurrency(s.totalAmount)}</td>
                  <td className="hidden border border-slate-300 px-1.5 py-2.5 text-right tabular-nums text-navy-900 sm:table-cell">{formatCurrency(s.paidAmount)}</td>
                  <td className={`border border-slate-300 px-1.5 py-2.5 text-right tabular-nums text-navy-900 ${s.balanceAmount > 0 ? 'font-semibold' : ''}`}>{formatCurrency(s.balanceAmount)}</td>
                  <td className="border border-slate-300 px-1 py-2.5">
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
              {visibleSales.length === 0 && <tr><td colSpan={8} className="border border-slate-300 py-8 text-center text-navy-800/50">No sales found for the selected filters.</td></tr>}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-navy-900"><tr><td colSpan={3} className="border border-slate-300 px-3 py-3 text-center">TOTAL</td><td className="border border-slate-300 px-2 py-3 text-right">{formatBarQuantity(summary.bars) || '0'}</td><td className="border border-slate-300 px-2 py-3 text-right">{formatCurrency(summary.amount)}</td><td className="hidden border border-slate-300 px-2 py-3 text-right sm:table-cell">{formatCurrency(summary.paid)}</td><td className="border border-slate-300 px-2 py-3 text-right">{formatCurrency(summary.balance)}</td><td className="border border-slate-300" /></tr></tfoot>
          </table>
        )}
        </div>
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
    blue: { card: 'from-blue-50 to-white', icon: 'bg-blue-600', accent: 'bg-blue-500' },
    cyan: { card: 'from-cyan-50 to-white', icon: 'bg-cyan-600', accent: 'bg-cyan-500' },
    violet: { card: 'from-violet-50 to-white', icon: 'bg-violet-600', accent: 'bg-violet-500' },
    amber: { card: 'from-amber-50 to-white', icon: 'bg-amber-500', accent: 'bg-amber-500' },
  }[tone];
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`relative flex min-h-[108px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default ${styles.card} ${danger ? 'border-red-100' : 'border-iceblue-100'}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${danger ? 'bg-red-500' : styles.accent}`} />
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg text-white shadow-sm ${danger ? 'bg-red-500' : styles.icon}`}>
        <Icon />
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/45">{label}</p>
        <p className={`mt-1 break-words font-display text-lg font-bold leading-tight ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
        {helper && (
          <p className={`mt-0.5 text-xs font-semibold ${danger ? 'text-red-600' : 'text-navy-800/55'}`}>
            {helper}
          </p>
        )}
      </div>
    </button>
  );
}

function CustomerPaymentTable({ sales, mode }: { sales: Sale[]; mode: 'paid' | 'balance' }) {
  const total = sales.reduce((sum, sale) => sum + Number(mode === 'paid' ? sale.paidAmount : sale.balanceAmount), 0);
  return (
    <div className="overflow-x-auto border border-slate-300 bg-white">
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
  );
}
