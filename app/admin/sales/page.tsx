'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiAlertCircle, FiDollarSign, FiEdit2, FiFilter, FiPlus, FiPrinter, FiRefreshCcw, FiTrash2 } from 'react-icons/fi';
import api from '../../../lib/api';
import { PAYMENT_MODES, formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../lib/api';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';

interface TruckOption { _id: string; truckName: string }
interface SaleItem { size?: string; quantity?: number; pricePerBar?: number; total?: number }
interface Sale {
  _id: string;
  date: string;
  truck?: { _id: string; truckName: string } | null;
  customer?: { _id: string; name: string; phoneNumber?: string } | null;
  saleType: string;
  items?: SaleItem[];
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: string;
}
interface Filters { from: string; to: string; saleType: string }

const emptyFilters: Filters = { from: '', to: '', saleType: '' };
const indiaDateISO = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const startOfIndiaDay = (date: string) => `${date}T00:00:00.000+05:30`;
const endOfIndiaDay = (date: string) => `${date}T23:59:59.999+05:30`;
const errorMessage = (error: any, fallback: string) => error?.response?.data?.message || error?.message || fallback;

const formatDateTime = (date: string | Date) => new Date(date).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const formatTime = (date: string | Date) => new Date(date).toLocaleTimeString('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
});

export default function AdminSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Sale | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [paymentForm, setPaymentForm] = useState({ date: indiaDateISO(), amount: '', paymentMode: 'cash', notes: '' });
  const [paymentError, setPaymentError] = useState('');
  const [pageError, setPageError] = useState('');

  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const load = async (activeFilters: Filters = filters) => {
    setLoading(true);
    setPageError('');
    try {
      const params: Record<string, string> = {};
      const day = indiaDateISO();
      if (activeFilters.from) params.from = startOfIndiaDay(activeFilters.from);
      if (activeFilters.to) params.to = endOfIndiaDay(activeFilters.to);
      if (!activeFilters.from && !activeFilters.to) {
        params.from = startOfIndiaDay(day);
        params.to = endOfIndiaDay(day);
      }
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
  }, []);

  const summary = useMemo(() => sales.reduce((total, sale) => ({
    bars: total.bars + (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0),
    amount: total.amount + Number(sale.totalAmount || 0),
    paid: total.paid + Number(sale.paidAmount || 0),
    balance: total.balance + Number(sale.balanceAmount || 0),
  }), { bars: 0, amount: 0, paid: 0, balance: 0 }), [sales]);

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

  const openPayment = (sale: Sale) => {
    setPaymentTarget(sale);
    setPaymentForm({ date: indiaDateISO(), amount: String(sale.balanceAmount || ''), paymentMode: 'cash', notes: '' });
    setPaymentError('');
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;
    setPaymentError('');
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      setPaymentError('Enter a valid amount');
      return;
    }
    if (amount > paymentTarget.balanceAmount) {
      setPaymentError('Amount cannot exceed the balance due');
      return;
    }
    setSavingPayment(true);
    try {
      await api.post(`/sales/${paymentTarget._id}/payments`, {
        ...paymentForm,
        amount,
      });
      setPaymentTarget(null);
      await load(filters);
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message || 'Could not update payment');
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={applyFilters} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label-text">From</label>
          <input type="date" className="input-field" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label className="label-text">To</label>
          <input type="date" className="input-field" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div>
          <label className="label-text">Sale Type</label>
          <select className="input-field" value={filters.saleType} onChange={(e) => setFilters({ ...filters, saleType: e.target.value })}>
            <option value="">All</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary flex items-center gap-2"><FiFilter /> Apply</button>
        <button type="button" onClick={resetFilters} className="btn-secondary flex items-center gap-2">
          <FiRefreshCcw /> Today
        </button>
        <button type="button" onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 ml-auto">
          <FiPlus /> Add Sale
        </button>
      </form>

      {pageError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {!loading && !pageError && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Sales Summary</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SalesSummary label="Ice Bars Sold" value={formatBarQuantity(summary.bars) || '0'} />
            <SalesSummary label="Sales Amount" value={formatCurrency(summary.amount)} />
            <SalesSummary label="Amount Paid" value={formatCurrency(summary.paid)} />
            <SalesSummary label="Balance Due" value={formatCurrency(summary.balance)} danger={summary.balance > 0} />
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-navy-800/50">Loading...</p>
        ) : (
          <table className="table-base min-w-[880px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Sale Type</th>
                <th>Bar Used</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s._id}>
                  <td>
                    <p className="whitespace-nowrap font-medium text-navy-900">{formatDate(s.date)}</p>
                    <p className="mt-0.5 text-xs text-navy-800/45">{formatTime(s.date)}</p>
                  </td>
                  <td>
                    {s.customer?._id ? (
                      <Link
                        href={`/admin/customers/${s.customer._id}`}
                        className="font-medium text-iceblue-700 underline-offset-2 hover:underline"
                      >
                        {s.customer.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-navy-800/60">Unknown customer</p>
                    )}
                    <p className="mt-0.5 text-xs text-navy-800/45">{s.customer?.phoneNumber || 'No phone'}</p>
                  </td>
                  <td>
                    <span className={`pill capitalize ${s.saleType === 'wholesale' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {s.saleType}
                    </span>
                  </td>
                  <td>{formatBarQuantity((s.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0)) || '0'}</td>
                  <td className="font-semibold">{formatCurrency(s.totalAmount)}</td>
                  <td>{formatCurrency(s.paidAmount)}</td>
                  <td className={s.balanceAmount > 0 ? 'text-red-500 font-semibold' : ''}>{formatCurrency(s.balanceAmount)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setPrintSale(s)} className="text-navy-700 hover:text-navy-900" title="Print sale" aria-label="Print sale"><FiPrinter /></button>
                      {s.balanceAmount > 0 && (
                        <button type="button" onClick={() => openPayment(s)} className="text-emerald-600 hover:text-emerald-700" title="Collect payment" aria-label="Collect payment">
                          <FiDollarSign />
                        </button>
                      )}
                      <button type="button" onClick={() => { setEditing(s); setModalOpen(true); }} className="text-iceblue-600 hover:text-iceblue-700" title="Edit sale" aria-label="Edit sale"><FiEdit2 /></button>
                      <button type="button" onClick={() => remove(s._id)} disabled={deletingId === s._id} className="text-red-500 hover:text-red-600 disabled:opacity-40" title="Delete sale" aria-label="Delete sale"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-navy-800/50">No sales found for the selected filters.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Edit Sale' : 'Add Sale'} onClose={closeSaleModal} wide>
          <SaleForm trucks={trucks} initial={editing} onSaved={() => { closeSaleModal(); void load(filters); }} />
        </Modal>
      )}

      {printSale && <PrintBill sale={printSale} onClose={() => setPrintSale(null)} />}

      {paymentTarget && (
        <Modal title={`Collect Payment: ${paymentTarget.customer?.name || 'Customer'}`} onClose={() => { setPaymentTarget(null); setPaymentError(''); }}>
          <form onSubmit={savePayment} className="space-y-4">
            <div className="rounded-2xl bg-iceblue-50 p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-navy-800/60">Bill Date</span>
                <strong>{formatDate(paymentTarget.date)}</strong>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-navy-800/60">Customer</span>
                {paymentTarget.customer?._id ? (
                  <Link href={`/admin/customers/${paymentTarget.customer._id}`} className="font-bold text-iceblue-700 underline-offset-2 hover:underline">
                    {paymentTarget.customer.name}
                  </Link>
                ) : <strong>Unknown customer</strong>}
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-navy-800/60">Balance</span>
                <strong className="text-red-600">{formatCurrency(paymentTarget.balanceAmount)}</strong>
              </div>
            </div>

            <div>
              <label className="label-text">Payment Date</label>
              <input
                type="date"
                className="input-field h-12"
                required
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-text">Amount Paid</label>
                <input
                  type="number"
                  min={1}
                  max={paymentTarget.balanceAmount}
                  step="0.01"
                  className="input-field h-12"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="label-text">Mode</label>
                <select
                  className="input-field h-12"
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                >
                  {PAYMENT_MODES.filter((mode) => mode.value !== 'credit').map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-text">Notes</label>
              <textarea
                className="input-field"
                rows={2}
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              />
            </div>

            {paymentError && <p className="text-red-500 text-sm">{paymentError}</p>}

            <button className="btn-primary flex h-12 w-full items-center justify-center gap-2" disabled={savingPayment}>
              <FiDollarSign /> {savingPayment ? 'Updating...' : 'Update Payment'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SalesSummary({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-800/50">{label}</p>
      <p className={`mt-2 text-xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
    </div>
  );
}

function PrintBill({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <Modal title="Bill" onClose={onClose}>
      <div id="bill-print" className="text-sm space-y-3">
        <div className="text-center">
          <p className="font-display font-bold text-lg">Tiruppur Ice Since 2000</p>
          <p className="text-navy-800/60">Ice Bar Sales Receipt</p>
        </div>
        <div className="flex justify-between text-xs text-navy-800/70">
          <span>Date: {formatDateTime(sale.date)}</span>
        </div>
        <p className="text-xs">Customer: <strong>{sale.customer?.name || 'Unknown customer'}</strong></p>
        <table className="table-base">
          <thead><tr><th>Bar Used</th><th>Total</th></tr></thead>
          <tbody>
            {(sale.items || []).map((item, index) => (
              <tr key={index}>
                <td>{formatBarQuantity(getItemBarUsed(item)) || '0'}</td>
                <td>{formatCurrency(Number(item.total ?? (Number(item.quantity || 0) * Number(item.pricePerBar || 0))))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(sale.totalAmount)}</span></div>
        <div className="flex justify-between"><span>Paid ({sale.paymentMode})</span><span>{formatCurrency(sale.paidAmount)}</span></div>
        <div className="flex justify-between text-red-500 font-semibold"><span>Balance</span><span>{formatCurrency(sale.balanceAmount)}</span></div>
        <button type="button" onClick={() => window.print()} className="btn-primary print-hide w-full">Print</button>
      </div>
    </Modal>
  );
}
