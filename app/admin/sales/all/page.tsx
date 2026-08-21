'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiAlertCircle, FiArrowLeft, FiDollarSign, FiDownload, FiEdit2, FiFilter, FiPrinter, FiRefreshCcw, FiSearch, FiTrash2 } from 'react-icons/fi';
import api from '../../../../lib/api';
import { formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../../lib/api';
import Modal from '../../../../components/Modal';
import SaleForm from '../../../../components/SaleForm';
import PrintBill from '../../../../components/PrintBill';
import PaymentModal from '../../../../components/PaymentModal';
import SalesSummaryTile from '../../../../components/SalesSummaryTile';
import { errorMessage, endOfIndiaDay, formatTime, startOfIndiaDay, type Sale, type TruckOption } from '../../../../lib/salesUtils';

interface Filters { from: string; to: string; saleType: string; search: string }
const emptyFilters: Filters = { from: '', to: '', saleType: '', search: '' };

export default function AllSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Sale | null>(null);
  const [deletingId, setDeletingId] = useState('');
  const [pageError, setPageError] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const load = async (activeFilters: Filters = filters) => {
    setLoading(true);
    setPageError('');
    try {
      // The sales API defaults requests without dates to today's records, so an
      // explicit unbounded business range is used when no From/To is picked.
      const params: Record<string, string> = {
        from: startOfIndiaDay(activeFilters.from || '2000-01-01'),
        to: endOfIndiaDay(activeFilters.to || '2100-12-31'),
      };
      if (activeFilters.saleType) params.saleType = activeFilters.saleType;
      const { data } = await api.get('/sales', { params });
      setSales(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setSales([]);
      setPageError(errorMessage(error, 'Could not load sales.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/trucks')
      .then((truckRows) => setTrucks(Array.isArray(truckRows.data) ? truckRows.data : []))
      .catch((error) => setPageError(errorMessage(error, 'Could not load sales filters.')));
    void load(emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleSales = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter((s) => (
      (s.customer?.name || '').toLowerCase().includes(term)
      || (s.customer?.phoneNumber || '').toLowerCase().includes(term)
      || (s.truck?.truckName || '').toLowerCase().includes(term)
    ));
  }, [sales, filters.search]);

  const summary = useMemo(() => visibleSales.reduce((total, sale) => ({
    bars: total.bars + (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0),
    amount: total.amount + Number(sale.totalAmount || 0),
    paid: total.paid + Number(sale.paidAmount || 0),
    balance: total.balance + Number(sale.balanceAmount || 0),
  }), { bars: 0, amount: 0, paid: 0, balance: 0 }), [visibleSales]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) {
      setPageError('From date cannot be after To date.');
      return;
    }
    void load(filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    void load(emptyFilters);
  };

  const closeSaleModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this sale entry?')) return;
    setDeletingId(id);
    setPageError('');
    try {
      await api.delete(`/sales/${id}`);
      await load(filters);
    } catch (error: any) {
      setPageError(errorMessage(error, 'Could not delete the sale.'));
    } finally {
      setDeletingId('');
    }
  };

  const exportExcel = async () => {
    if (!visibleSales.length) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = visibleSales.map((s, index) => ({
        '#': index + 1,
        Date: formatDate(s.date),
        Time: formatTime(s.date),
        Customer: s.customer?.name || 'Unknown customer',
        Phone: s.customer?.phoneNumber || '',
        Truck: s.truck?.truckName || '',
        Bars: formatBarQuantity((s.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0)) || '0',
        'Total Amount': Number(s.totalAmount || 0),
        Paid: Number(s.paidAmount || 0),
        Balance: Number(s.balanceAmount || 0),
        'Payment Mode': s.paymentMode,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'All Sales');
      XLSX.writeFile(wb, `sales-${filters.from || 'all'}-to-${filters.to || 'all'}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Sales Summary</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-navy-900">All Sales Records</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/sales" className="btn-secondary flex items-center gap-2"><FiArrowLeft /> Today&apos;s Sales</Link>
          <button
            type="button"
            onClick={exportExcel}
            disabled={exporting || !visibleSales.length}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <FiDownload /> {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>

      <form onSubmit={applyFilters} className="card flex flex-wrap items-end gap-2 p-3">
        <div className="w-full sm:w-[145px]">
          <label className="label-text text-[11px]">From</label>
          <input type="date" className="input-field h-9 px-2 text-xs" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div className="w-full sm:w-[145px]">
          <label className="label-text text-[11px]">To</label>
          <input type="date" className="input-field h-9 px-2 text-xs" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div className="w-full sm:w-[120px]">
          <label className="label-text text-[11px]">Sale Type</label>
          <select className="input-field h-9 px-2 text-xs" value={filters.saleType} onChange={(e) => setFilters({ ...filters, saleType: e.target.value })}>
            <option value="">All</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
        <div className="w-full sm:w-[250px]">
          <label className="label-text text-[11px]">Search Customer / Truck</label>
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-800/35" />
            <input
              type="search"
              className="input-field h-9 pl-9 pr-2 text-xs"
              placeholder="Search by name, phone or truck"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
        </div>
        <button type="submit" className="btn-secondary flex h-9 items-center gap-1.5 px-3 text-xs"><FiFilter /> Apply</button>
        <button type="button" onClick={resetFilters} className="btn-secondary flex h-9 items-center gap-1.5 px-3 text-xs">
          <FiRefreshCcw /> Reset
        </button>
      </form>

      {pageError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {!loading && !pageError && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SalesSummaryTile label="Ice Bars Sold" value={formatBarQuantity(summary.bars) || '0'} />
          <SalesSummaryTile label="Sales Amount" value={formatCurrency(summary.amount)} />
          <SalesSummaryTile label="Amount Paid" value={formatCurrency(summary.paid)} />
          <SalesSummaryTile label="Balance Due" value={formatCurrency(summary.balance)} danger={summary.balance > 0} trend="down" />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <>
          <div className="sm:hidden">
            {visibleSales.map((s, index) => (
              <div key={s._id} className="border-b border-slate-200 px-4 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-slate-500">{index + 1}</span>
                      <p className="font-medium text-navy-900">{formatDate(s.date)}</p>
                    </div>
                    {s.customer?._id ? (
                      <Link href={`/admin/customers/${s.customer._id}`} className="mt-1 block truncate font-medium text-iceblue-700 underline-offset-2 hover:underline">
                        {s.customer.name}
                      </Link>
                    ) : (
                      <span className="mt-1 block text-navy-800/60">Unknown customer</span>
                    )}
                    <p className="text-xs text-navy-800/60">
                      {s.customer?.phoneNumber || '-'}
                      {s.truck?.truckName ? ` · ${s.truck.truckName}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold tabular-nums text-navy-900">{formatCurrency(s.totalAmount)}</p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Bars</p>
                    <p className="font-semibold tabular-nums text-navy-900">{formatBarQuantity((s.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0)) || '0'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Paid</p>
                    <p className="font-semibold tabular-nums text-navy-900">{formatCurrency(s.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Balance</p>
                    <p className={`font-semibold tabular-nums ${s.balanceAmount > 0 ? 'text-red-500' : 'text-emerald-700'}`}>{formatCurrency(s.balanceAmount)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <button type="button" onClick={() => setPrintSale(s)} className="flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-navy-900" title="Print sale" aria-label="Print sale"><FiPrinter /> Print</button>
                  {s.balanceAmount > 0 && (
                    <button type="button" onClick={() => setPaymentTarget(s)} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700" title="Collect payment" aria-label="Collect payment">
                      <FiDollarSign /> Collect
                    </button>
                  )}
                  <button type="button" onClick={() => { setEditing(s); setModalOpen(true); }} className="flex items-center gap-1 text-xs font-semibold text-iceblue-600 hover:text-iceblue-700" title="Edit sale" aria-label="Edit sale"><FiEdit2 /> Edit</button>
                  <button type="button" onClick={() => remove(s._id)} disabled={deletingId === s._id} className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-40" title="Delete sale" aria-label="Delete sale"><FiTrash2 /> Delete</button>
                </div>
              </div>
            ))}
            {visibleSales.length === 0 && (
              <p className="px-4 py-8 text-center text-navy-800/50">No sales found for the selected filters.</p>
            )}
          </div>
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-[11px] sm:text-xs">
            <thead className="sticky top-0 z-10 bg-emerald-700 text-white">
              <tr>
                <th className="w-[4%] border border-slate-500 px-1 py-2.5 text-center">#</th>
                <th className="w-[13%] border border-slate-500 px-1.5 py-2.5 text-left">Date</th>
                <th className="w-[22%] border border-slate-500 px-1.5 py-2.5 text-left">Customer</th>
                <th className="hidden w-[13%] border border-slate-500 px-1.5 py-2.5 text-left md:table-cell">Phone</th>
                <th className="hidden w-[12%] border border-slate-500 px-1.5 py-2.5 text-left lg:table-cell">Truck</th>
                <th className="w-[8%] border border-slate-500 px-1 py-2.5 text-right">Bars</th>
                <th className="w-[13%] border border-slate-500 px-1 py-2.5 text-right">Total</th>
                <th className="w-[11%] border border-slate-500 px-1 py-2.5 text-right">Paid</th>
                <th className="w-[11%] border border-slate-500 px-1 py-2.5 text-right">Balance</th>
                <th className="w-[9%] border border-slate-500 px-1 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((s, index) => (
                <tr key={s._id} className="even:bg-slate-50/70 hover:bg-iceblue-50">
                  <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-500">{index + 1}</td>
                  <td className="border border-slate-300 px-2 py-1.5 font-medium text-navy-900">{formatDate(s.date)}</td>
                  <td className="border border-slate-300 px-2 py-1.5">
                    {s.customer?._id ? (
                      <Link href={`/admin/customers/${s.customer._id}`} className="font-medium text-iceblue-700 underline-offset-2 hover:underline">
                        {s.customer.name}
                      </Link>
                    ) : <span className="text-navy-800/60">Unknown customer</span>}
                  </td>
                  <td className="hidden border border-slate-300 px-1.5 py-1.5 text-navy-800/60 md:table-cell">{s.customer?.phoneNumber || '-'}</td>
                  <td className="hidden border border-slate-300 px-1.5 py-1.5 lg:table-cell">{s.truck?.truckName || '-'}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold tabular-nums">{formatBarQuantity((s.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0)) || '0'}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold tabular-nums">{formatCurrency(s.totalAmount)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{formatCurrency(s.paidAmount)}</td>
                  <td className={`border border-slate-300 px-2 py-1.5 text-right tabular-nums ${s.balanceAmount > 0 ? 'text-red-500 font-semibold' : 'text-emerald-700'}`}>{formatCurrency(s.balanceAmount)}</td>
                  <td className="border border-slate-300 px-2 py-1.5">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <button type="button" onClick={() => setPrintSale(s)} className="text-navy-700 hover:text-navy-900" title="Print sale" aria-label="Print sale"><FiPrinter /></button>
                      {s.balanceAmount > 0 && (
                        <button type="button" onClick={() => setPaymentTarget(s)} className="text-emerald-600 hover:text-emerald-700" title="Collect payment" aria-label="Collect payment">
                          <FiDollarSign />
                        </button>
                      )}
                      <button type="button" onClick={() => { setEditing(s); setModalOpen(true); }} className="text-iceblue-600 hover:text-iceblue-700" title="Edit sale" aria-label="Edit sale"><FiEdit2 /></button>
                      <button type="button" onClick={() => remove(s._id)} disabled={deletingId === s._id} className="text-red-500 hover:text-red-600 disabled:opacity-40" title="Delete sale" aria-label="Delete sale"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleSales.length === 0 && <tr><td colSpan={10} className="border border-slate-300 py-8 text-center text-navy-800/50">No sales found for the selected filters.</td></tr>}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Edit Sale' : 'Add Sale'} onClose={closeSaleModal} wide>
          <SaleForm trucks={trucks} initial={editing} onSaved={() => { closeSaleModal(); void load(filters); }} />
        </Modal>
      )}

      {printSale && <PrintBill sale={printSale} onClose={() => setPrintSale(null)} />}

      {paymentTarget && (
        <PaymentModal
          sale={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={() => { setPaymentTarget(null); void load(filters); }}
        />
      )}
    </div>
  );
}
