'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FiAlertCircle, FiArrowLeft, FiClock, FiDollarSign, FiHome, FiPhone, FiTruck, FiUser } from 'react-icons/fi';
import IceBlockSpinner from '../../../../components/IceBlockSpinner';
import Modal from '../../../../components/Modal';
import api, { PAYMENT_MODES, formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../../lib/api';
import { formatTime } from '../../../../lib/salesUtils';

const referenceId = (value: any) => String(value?._id || value || '');
const indiaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const emptyPaymentForm = () => ({ date: indiaToday(), amount: '', paymentMode: 'cash', notes: '' });
const saleSource = (sale: any) => sale.truck
  ? { label: sale.truck.truckName || 'Truck sale', helper: sale.truck.truckNumber || '', tone: 'bg-iceblue-50 text-iceblue-700', icon: FiTruck }
  : { label: 'Shop sale', helper: 'Branch counter', tone: 'bg-violet-50 text-violet-700', icon: FiHome };

export default function DriverCustomerHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentTarget, setPaymentTarget] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [customerResult, salesResult] = await Promise.all([api.get(`/customers/${id}`), api.get('/sales', { params: { customer: id } })]);
      setCustomer(customerResult.data);
      setSales(Array.isArray(salesResult.data) ? salesResult.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not load customer history.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const openPayment = (sale: any) => {
    setPaymentError('');
    setPaymentTarget(sale);
    setPaymentForm({ ...emptyPaymentForm(), amount: String(sale.balanceAmount || '') });
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentTarget) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setPaymentError('Enter an amount greater than zero.'); return; }
    if (amount > Number(paymentTarget.balanceAmount || 0)) { setPaymentError('Amount cannot exceed the pending bill amount.'); return; }
    setSavingPayment(true);
    setPaymentError('');
    try {
      await api.post(`/sales/${paymentTarget._id}/payments`, { ...paymentForm, amount });
      const customerName = customer?.name || 'Customer';
      setPaymentTarget(null);
      setPaymentForm(emptyPaymentForm());
      setPaymentSuccess(`${formatCurrency(amount)} collected from ${customerName}.`);
      await load();
    } catch (requestError: any) {
      setPaymentError(requestError?.response?.data?.message || 'Could not collect this payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  const totals = useMemo(() => sales.reduce((result, sale) => ({
    bars: result.bars + (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0),
    total: result.total + Number(sale.totalAmount || 0),
    paid: result.paid + Number(sale.paidAmount || 0),
    pending: result.pending + Number(sale.balanceAmount || 0),
  }), { bars: 0, total: 0, paid: 0, pending: 0 }), [sales]);
  const pendingSales = useMemo(() => sales.filter((sale) => Number(sale.balanceAmount || 0) > 0), [sales]);
  const shopSalesCount = useMemo(() => sales.filter((sale) => !sale.truck).length, [sales]);
  const truckSalesCount = sales.length - shopSalesCount;

  if (loading) return <div className="grid min-h-[55vh] place-items-center"><IceBlockSpinner label="Loading customer history..." /></div>;

  if (error || !customer) return (
    <section className="card">
      <p className="font-semibold text-red-600">{error || 'Customer not found.'}</p>
      <Link href="/truck/dashboard" className="btn-secondary mt-4 inline-flex items-center gap-2"><FiArrowLeft /> Driver Dashboard</Link>
    </section>
  );

  const truck = typeof customer.truck === 'object' && customer.truck ? customer.truck : null;

  return (
    <div className="min-w-0 space-y-4 pb-6 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/truck/dashboard" className="btn-secondary inline-flex items-center gap-2"><FiArrowLeft /> Dashboard</Link>
        <span className="pill bg-iceblue-50 text-iceblue-700">Complete customer account</span>
      </div>

      <section className="min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-iceblue-700 p-4 text-white shadow-lg min-[390px]:p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-iceblue-200">Customer</p>
        <h1 className="mt-2 break-words font-display text-2xl font-black sm:text-3xl">{customer.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
          <span className="inline-flex items-center gap-1.5"><FiPhone /> {customer.phoneNumber || 'No phone'}</span>
          <span className="inline-flex items-center gap-1.5"><FiUser /> {truck?.truckName ? `Assigned to ${truck.truckName}` : 'Branch customer'}</span>
          <span className="inline-flex items-center gap-1.5"><FiHome /> {shopSalesCount} shop bill{shopSalesCount === 1 ? '' : 's'}</span>
          <span className="inline-flex items-center gap-1.5"><FiTruck /> {truckSalesCount} truck bill{truckSalesCount === 1 ? '' : 's'}</span>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Pending Amount" value={formatCurrency(totals.pending)} danger={totals.pending > 0} />
        <Summary label="Bars Purchased" value={formatBarQuantity(totals.bars) || '0'} />
        <Summary label="Total Amount" value={formatCurrency(totals.total)} />
        <Summary label="Paid Amount" value={formatCurrency(totals.paid)} />
      </div>

      {paymentSuccess && <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><FiDollarSign className="shrink-0" />{paymentSuccess}</p>}

      <section className="overflow-hidden rounded-3xl border border-red-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50/60 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-red-600 shadow-sm"><FiAlertCircle /></span><div><h2 className="font-display text-lg font-bold text-navy-900">All Pending Bills</h2><p className="text-xs text-slate-500">Includes shop purchases and every truck purchase in this branch.</p></div></div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-red-600 shadow-sm">{pendingSales.length} bills · {formatCurrency(totals.pending)}</span>
        </div>
        <div className="space-y-3 p-3 sm:hidden">
          {pendingSales.map((sale) => <SaleCard key={sale._id} sale={sale} onCollect={openPayment} />)}
          {!pendingSales.length && <p className="py-10 text-center text-sm font-semibold text-emerald-600">No pending bills. This customer is fully paid.</p>}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="table-base min-w-[860px]">
            <thead><tr><th>Date / Time</th><th>Sale Source</th><th>Bars</th><th>Total</th><th>Paid</th><th>Pending</th><th>Payment</th><th>Action</th></tr></thead>
            <tbody>
              {pendingSales.map((sale) => <SaleRow key={sale._id} sale={sale} onCollect={openPayment} />)}
              {!pendingSales.length && <tr><td colSpan={8} className="py-10 text-center font-semibold text-emerald-600">No pending bills. This customer is fully paid.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-iceblue-100 px-4 py-4 sm:px-5">
          <FiClock className="text-iceblue-600" />
          <div><h2 className="font-display text-lg font-bold text-navy-900">Complete Purchase History</h2><p className="text-xs text-slate-500">Shop and truck bills together.</p></div>
        </div>
        <div className="space-y-3 p-3 sm:hidden">
          {sales.map((sale) => <SaleCard key={sale._id} sale={sale} />)}
          {!sales.length && <p className="py-10 text-center text-sm text-navy-800/50">No purchase history found.</p>}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="table-base min-w-[860px]">
            <thead><tr><th>Date / Time</th><th>Sale Source</th><th>Bars</th><th>Total</th><th>Paid</th><th>Pending</th><th>Payment</th></tr></thead>
            <tbody>
              {sales.map((sale) => <SaleRow key={sale._id} sale={sale} />)}
              {!sales.length && <tr><td colSpan={7} className="py-10 text-center text-navy-800/50">No purchase history found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {paymentTarget && (
        <Modal title={`Collect Payment: ${customer.name}`} onClose={() => setPaymentTarget(null)}>
          <form onSubmit={savePayment} className="space-y-4">
            <div className="rounded-2xl bg-iceblue-50 p-4 text-sm">
              <div className="flex justify-between gap-3"><span className="text-navy-800/60">Bill source</span><strong>{saleSource(paymentTarget).label}</strong></div>
              <div className="mt-2 flex justify-between gap-3"><span className="text-navy-800/60">Bill date</span><strong>{formatDate(paymentTarget.date)}</strong></div>
              <div className="mt-2 flex justify-between gap-3"><span className="text-navy-800/60">Pending amount</span><strong className="text-red-600">{formatCurrency(paymentTarget.balanceAmount)}</strong></div>
            </div>
            <div><label className="label-text">Collection Date</label><input type="date" required className="input-field h-12" value={paymentForm.date} onChange={(event) => setPaymentForm({ ...paymentForm, date: event.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><label className="label-text">Amount Collected</label><input type="number" min={0.01} max={paymentTarget.balanceAmount} step="0.01" required className="input-field h-12" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></div><div><label className="label-text">Payment Mode</label><select className="input-field h-12" value={paymentForm.paymentMode} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMode: event.target.value })}>{PAYMENT_MODES.filter((mode) => mode.value !== 'credit').map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></div></div>
            <div><label className="label-text">Notes</label><textarea rows={2} className="input-field" placeholder="Optional collection note" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} /></div>
            {paymentError && <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{paymentError}</p>}
            <button disabled={savingPayment} className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60"><FiDollarSign />{savingPayment ? 'Collecting...' : 'Collect Payment'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Summary({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-2 break-words font-display text-xl font-black ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div>;
}

function SaleCard({ sale, onCollect }: { sale: any; onCollect?: (sale: any) => void }) {
  const bars = (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0);
  const source = saleSource(sale);
  const SourceIcon = source.icon;
  return <div className="rounded-2xl border border-iceblue-100 p-4"><div className="flex justify-between gap-3"><div><p className="font-bold text-navy-900">{formatDate(sale.date)}</p><p className="mt-0.5 text-xs text-navy-800/50">{formatTime(sale.date)}</p></div><span className={`inline-flex h-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${source.tone}`}><SourceIcon />{source.label}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><Detail label="Bars" value={formatBarQuantity(bars) || '0'} /><Detail label="Total" value={formatCurrency(sale.totalAmount)} /><Detail label="Paid" value={formatCurrency(sale.paidAmount)} paid /><Detail label="Pending" value={formatCurrency(sale.balanceAmount)} danger={Number(sale.balanceAmount || 0) > 0} /></div>{onCollect && Number(sale.balanceAmount || 0) > 0 && <button type="button" onClick={() => onCollect(sale)} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"><FiDollarSign /> Collect payment</button>}</div>;
}

function SaleRow({ sale, onCollect }: { sale: any; onCollect?: (sale: any) => void }) {
  const bars = (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0);
  const source = saleSource(sale);
  const SourceIcon = source.icon;
  return <tr><td>{formatDate(sale.date)} · {formatTime(sale.date)}</td><td><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${source.tone}`}><SourceIcon />{source.label}</span>{source.helper && <p className="mt-1 text-[9px] text-slate-400">{source.helper}</p>}</td><td>{formatBarQuantity(bars) || '0'}</td><td>{formatCurrency(sale.totalAmount)}</td><td className="text-emerald-600">{formatCurrency(sale.paidAmount)}</td><td className={Number(sale.balanceAmount || 0) > 0 ? 'font-bold text-red-600' : ''}>{formatCurrency(sale.balanceAmount)}</td><td className="capitalize">{sale.paymentMode || '-'}</td>{onCollect && <td><button type="button" onClick={() => onCollect(sale)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-emerald-700"><FiDollarSign /> Collect</button></td>}</tr>;
}

function Detail({ label, value, paid = false, danger = false }: { label: string; value: string; paid?: boolean; danger?: boolean }) {
  return <div><p className="text-[10px] font-bold uppercase text-navy-800/40">{label}</p><p className={`mt-1 font-semibold ${danger ? 'text-red-600' : paid ? 'text-emerald-600' : 'text-navy-900'}`}>{value}</p></div>;
}
