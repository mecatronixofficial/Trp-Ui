'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiPackage,
  FiPlus,
  FiRefreshCcw,
  FiShoppingCart,
  FiTrash2,
  FiUserPlus,
} from 'react-icons/fi';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';
import { useAuth } from '../../../context/AuthContext';
import api, { PAYMENT_MODES, WASTAGE_REASONS, formatBarQuantity, formatCurrency, formatDate, getItemBarUsed, todayISO } from '../../../lib/api';

type ViewMode = 'take' | 'sale' | 'wastage' | 'return' | 'amount';

const emptyPaymentForm = { date: todayISO(), amount: '', paymentMode: 'cash', notes: '' };

const tomorrowISO = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const getCustomerId = (sale: any) => sale.customer?._id || sale.customer || 'unknown';
const getCustomerName = (sale: any) => sale.customer?.name || 'Customer';
const getQuantity = (sale: any) => sale.items?.reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0) || 0;

export default function TruckDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [wastage, setWastage] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tripClosing, setTripClosing] = useState<any>(null);
  const [closePreviewOpen, setClosePreviewOpen] = useState(false);
  const [mode, setMode] = useState<ViewMode>('sale');
  const [loading, setLoading] = useState(true);
  const [savingWastage, setSavingWastage] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<any>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [saleFormKey, setSaleFormKey] = useState(0);
  const [error, setError] = useState('');
  const [wastageForm, setWastageForm] = useState({
    date: todayISO(),
    size: '1',
    quantity: '',
    reason: 'broken',
    notes: '',
  });
  const [expenseForm, setExpenseForm] = useState({ date: todayISO(), amount: '', purpose: '', notes: '' });
  const [takeForm, setTakeForm] = useState({ date: todayISO(), quantity: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { from: todayISO(), to: tomorrowISO() };
      const [dash, saleRows, wastageRows, customerRows, expenseRows, tripRows] = await Promise.all([
        api.get('/dashboard/truck'),
        api.get('/sales', { params }),
        api.get('/wastage', { params }),
        api.get('/customers'),
        api.get('/driver-expenses', { params }),
        api.get('/truck-loads/reconciliation', { params: { date: todayISO() } }),
      ]);
      const allSaleRows = await api.get('/sales');
      setData(dash.data);
      setSales(saleRows.data);
      setAllSales(allSaleRows.data);
      setWastage(wastageRows.data);
      setCustomers(customerRows.data);
      setExpenses(expenseRows.data);
      setTripClosing(tripRows.data[0] || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load driver dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const paymentStats = useMemo(() => {
    const paid = new Set<string>();
    const notPaid = new Set<string>();

    allSales.forEach((sale) => {
      const id = getCustomerId(sale);
      if (Number(sale.balanceAmount || 0) > 0) notPaid.add(id);
      else paid.add(id);
    });

    notPaid.forEach((id) => paid.delete(id));

    const today = todayISO();
    const newUsers = customers.filter((customer) => String(customer.createdAt || '').slice(0, 10) === today).length;
    const partial = allSales.filter((sale) => Number(sale.paidAmount || 0) > 0 && Number(sale.balanceAmount || 0) > 0).length;

    return { paid: paid.size, notPaid: notPaid.size, partial, newUsers };
  }, [allSales, customers]);

  const customerRows = useMemo(() => {
    const rows: Record<string, { name: string; quantity: number; amount: number; paid: number; balance: number }> = {};
    sales.forEach((sale) => {
      const id = getCustomerId(sale);
      if (!rows[id]) rows[id] = { name: getCustomerName(sale), quantity: 0, amount: 0, paid: 0, balance: 0 };
      rows[id].quantity += getQuantity(sale);
      rows[id].amount += Number(sale.totalAmount || 0);
      rows[id].paid += Number(sale.paidAmount || 0);
      rows[id].balance += Number(sale.balanceAmount || 0);
    });
    return Object.entries(rows);
  }, [sales]);

  const returnRows = wastage.filter((row) => row.reason === 'unsold');
  const wastageRows = wastage.filter((row) => row.reason !== 'unsold');
  const activeWastageRows = mode === 'return' ? returnRows : wastageRows;
  const dueSales = allSales.filter((sale) => Number(sale.balanceAmount || 0) > 0);

  const saveWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWastage(true);
    setError('');
    try {
      await api.post('/wastage', {
        ...wastageForm,
        size: '1',
        reason: mode === 'return' ? 'unsold' : wastageForm.reason,
        quantity: Number(wastageForm.quantity),
      });
      setWastageForm({ date: todayISO(), size: '1', quantity: '', reason: 'broken', notes: '' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || `Could not save ${mode === 'return' ? 'return' : 'wastage'}.`);
    } finally {
      setSavingWastage(false);
    }
  };

  const openPayment = (sale: any) => {
    setPaymentTarget(sale);
    setPaymentForm({ ...emptyPaymentForm, amount: String(sale.balanceAmount || '') });
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;
    setSavingPayment(true);
    setError('');
    try {
      await api.post(`/sales/${paymentTarget._id}/payments`, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
      });
      setPaymentTarget(null);
      setPaymentForm(emptyPaymentForm);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/driver-expenses', { ...expenseForm, amount: Number(expenseForm.amount) });
      setExpenseForm({ date: todayISO(), amount: '', purpose: '', notes: '' }); await load();
    } catch (err: any) { setError(err?.response?.data?.message || 'Could not save driver amount'); }
  };

  const saveTakenBars = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/truck-loads', { date: takeForm.date, size: '1', quantity: Number(takeForm.quantity), notes: takeForm.notes });
      setTakeForm({ date: todayISO(), quantity: '', notes: '' }); await load();
    } catch (err: any) { setError(err?.response?.data?.message || 'Could not save bars taken'); }
  };

  const closeTruckDay = async () => {
    if (!tripClosing) return;
    setError('');
    try { await api.post('/truck-loads/reconciliation/driver-close', { date: todayISO() }); setClosePreviewOpen(false); await load(); }
    catch (err: any) { setError(err?.response?.data?.message || 'Could not close truck day'); }
  };

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-2xl border-4 border-iceblue-100 border-t-iceblue-500" />
          <p className="font-medium text-navy-800/70">Loading driver dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 xl:space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_top_left,#dff5fd_0,#43c1e6_38%,#175872_100%)] p-5 text-white shadow-2xl shadow-iceblue-900/15 sm:p-6 xl:p-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-50/80">Driver Console</p>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Today&apos;s Route</h1>
            <p className="mt-2 text-sm text-cyan-50/85">{user?.displayName || user?.username} · {formatDate(todayISO())}</p>
          </div>
          <button
            onClick={load}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-iceblue-700 shadow-lg shadow-cyan-950/15 transition hover:bg-cyan-50 sm:w-auto"
          >
            <FiRefreshCcw /> Refresh
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-4">
          <HeroStat icon={FiPackage} label="Bars Taken" value={data?.todayPicked || 0} suffix="bars" />
          <HeroStat icon={FiShoppingCart} label="Sales" value={formatCurrency(data?.todaySales)} />
          <HeroStat icon={FiPackage} label="Bars Sold" value={data?.todayQuantitySold || 0} suffix="bars" />
          <HeroStat icon={FiRefreshCcw} label="Returned" value={data?.todayReturned || 0} suffix="bars" />
          <HeroStat icon={FiTrash2} label="Wastage" value={data?.todayWastage || 0} suffix="bars" />
          <HeroStat icon={FiCheckCircle} label="Remaining" value={data?.remainingBars || 0} suffix="bars" />
        </div>
      </section>

      {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      {tripClosing && <section className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${tripClosing.driverClosed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-white'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold text-navy-900">End-of-Day Truck Closing</h2><p className="mt-1 text-xs text-navy-800/55">Confirm all sold, returned, wasted, pending, and driver amounts.</p></div><span className={`pill ${tripClosing.driverClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{tripClosing.driverClosed ? 'Closed' : 'Not Closed'}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{[
          ['Taken', tripClosing.taken], ['Sold', tripClosing.sold], ['Returned', tripClosing.returned], ['Wastage', tripClosing.wastage], ['Balance', tripClosing.remaining], ['Sales', formatCurrency(tripClosing.salesAmount)], ['Pending', formatCurrency(tripClosing.pendingAmount)], ['Driver Amount', formatCurrency(tripClosing.driverAmount)],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className="mt-1 break-words font-bold text-navy-900">{value}</p></div>)}</div>
        {!tripClosing.driverClosed && Number(tripClosing.remaining || 0) > 0 && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{tripClosing.remaining} remaining bar(s) will automatically move to Unsold Returns when you close.</p>}
        {!tripClosing.driverClosed && Number(tripClosing.remaining || 0) < 0 && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Balance is negative. Correct the taken, sales, return, or wastage entries before closing.</p>}
        {tripClosing.driverClosed ? <p className="mt-4 flex items-center gap-2 font-semibold text-emerald-700"><FiCheckCircle /> Truck day closed successfully</p> : <button onClick={() => setClosePreviewOpen(true)} disabled={Number(tripClosing.remaining || 0) < 0} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-50"><FiCheckCircle /> Confirm & Close Truck Day</button>}
      </section>}

      {closePreviewOpen && tripClosing && <Modal title="Confirm Truck Day Closing" onClose={() => setClosePreviewOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            Check every value carefully. After closing, no more sales, collections, pickups, returns, wastage, or driver amounts can be entered today.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['Bars Taken', tripClosing.taken], ['Bars Sold', tripClosing.sold], ['Already Returned', tripClosing.returned], ['Wastage', tripClosing.wastage], ['Current Balance', tripClosing.remaining], ['Auto Return', Math.max(Number(tripClosing.remaining || 0), 0)]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-iceblue-50 p-3"><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className="mt-1 text-lg font-bold text-navy-900">{value}</p></div>)}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <AmountBox label="Total Sales" value={tripClosing.salesAmount} />
            <AmountBox label="Pending" value={tripClosing.pendingAmount} danger={tripClosing.pendingAmount > 0} />
            <AmountBox label="Driver Amount" value={tripClosing.driverAmount} />
          </div>
          {Number(tripClosing.remaining || 0) > 0 && <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">{tripClosing.remaining} remaining bar(s) will automatically move to Unsold Returns.</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setClosePreviewOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={closeTruckDay} className="btn-primary">Yes, Close Day</button>
          </div>
        </div>
      </Modal>}

      {tripClosing?.driverClosed ? (
        <section className="rounded-[2rem] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#dff7ff)] px-5 py-10 text-center shadow-sm sm:px-8 sm:py-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-3xl text-emerald-600"><FiCheckCircle /></div>
          <h2 className="mt-5 font-display text-2xl font-bold text-navy-900 sm:text-3xl">Today&apos;s truck work is complete</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-navy-800/65 sm:text-base">All remaining bars were moved to returns and the truck day is closed. Sales, payments, returns, wastage, pickups, and amount entries are now hidden.</p>
          <p className="mt-5 font-semibold text-emerald-700">See you tomorrow or on the next production day.</p>
        </section>
      ) : <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:gap-4">
        <MiniStat icon={FiCheckCircle} label="Paid Users" value={paymentStats.paid} tone="green" />
        <MiniStat icon={FiClock} label="Not Paid" value={paymentStats.notPaid} tone="red" />
        <MiniStat icon={FiDollarSign} label="Partial Bills" value={paymentStats.partial} tone="amber" />
        <MiniStat icon={FiUserPlus} label="New Users" value={paymentStats.newUsers} tone="blue" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.95fr)_minmax(0,1.35fr)] xl:items-start">
        <section className="card p-3 sm:p-5 xl:sticky xl:top-24">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-iceblue-50 p-1 sm:grid-cols-5">
            {[
              { key: 'take', label: 'Take Bars', icon: FiPackage },
              { key: 'sale', label: 'Sale', icon: FiShoppingCart },
              { key: 'wastage', label: 'Wastage', icon: FiTrash2 },
              { key: 'return', label: 'Return', icon: FiRefreshCcw },
              { key: 'amount', label: 'Amount', icon: FiDollarSign },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key as ViewMode)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
                  mode === key ? 'bg-white text-iceblue-700 shadow-sm' : 'text-navy-800/60 hover:text-iceblue-700'
                }`}
              >
                <Icon className="shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            {mode === 'take' ? (
              <form onSubmit={saveTakenBars} className="space-y-4">
                <div><label className="label-text">Pickup Date</label><input type="date" required className="input-field" value={takeForm.date} onChange={(e) => setTakeForm({...takeForm, date: e.target.value})} /></div>
                <div><label className="label-text">How Many Full Bars Taken</label><input type="number" min="0.01" step="0.01" required className="input-field" placeholder="Enter bars taken" value={takeForm.quantity} onChange={(e) => setTakeForm({...takeForm, quantity: e.target.value})} /></div>
                <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={takeForm.notes} onChange={(e) => setTakeForm({...takeForm, notes: e.target.value})} /></div>
                <button className="btn-primary flex h-12 w-full items-center justify-center gap-2"><FiPackage /> Save Bars Taken</button>
              </form>
            ) : mode === 'sale' ? (
              <SaleForm
                key={saleFormKey}
                fixedTruckId={user?.truck || ''}
                onSaved={async () => {
                  await load();
                  setSaleFormKey((key) => key + 1);
                }}
              />
            ) : mode === 'amount' ? (
              <form onSubmit={saveExpense} className="space-y-4">
                <div><label className="label-text">Date</label><input type="date" required className="input-field" value={expenseForm.date} onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} /></div>
                <div><label className="label-text">Amount Needed / Spent</label><input type="number" min="0.01" step="0.01" required className="input-field" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} /></div>
                <div><label className="label-text">Purpose</label><input required className="input-field" placeholder="Diesel, food, repair..." value={expenseForm.purpose} onChange={(e) => setExpenseForm({...expenseForm, purpose: e.target.value})} /></div>
                <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={expenseForm.notes} onChange={(e) => setExpenseForm({...expenseForm, notes: e.target.value})} /></div>
                <button className="btn-primary flex h-12 w-full items-center justify-center gap-2"><FiDollarSign /> Save Amount</button>
              </form>
            ) : (
              <form onSubmit={saveWastage} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div>
                    <label className="label-text">Date</label>
                    <input
                      type="date"
                      className="input-field h-12"
                      required
                      value={wastageForm.date}
                      onChange={(e) => setWastageForm({ ...wastageForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label-text">Bar Used</label>
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      className="input-field h-12"
                      required
                      placeholder="Bar Used e.g. 0.25, 1.25"
                      value={wastageForm.quantity}
                      onChange={(e) => setWastageForm({ ...wastageForm, quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div>
                    <label className="label-text">{mode === 'return' ? 'Return Type' : 'Reason'}</label>
                    <select
                      className="input-field h-12"
                      value={mode === 'return' ? 'unsold' : wastageForm.reason}
                      disabled={mode === 'return'}
                      onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                    >
                      {mode === 'return' ? (
                        <option value="unsold">Unsold return</option>
                      ) : (
                        WASTAGE_REASONS.filter((reason) => reason.value !== 'unsold').map((reason) => (
                          <option key={reason.value} value={reason.value}>{reason.label}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-text">Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={wastageForm.notes}
                    onChange={(e) => setWastageForm({ ...wastageForm, notes: e.target.value })}
                  />
                </div>

                <button className="btn-primary flex h-12 w-full items-center justify-center gap-2" disabled={savingWastage}>
                  <FiPlus /> {savingWastage ? 'Saving...' : mode === 'return' ? 'Save Return' : 'Save Wastage'}
                </button>
              </form>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <Details title="Selling Details" empty="No sales recorded today.">
            {sales.map((sale) => (
              <SaleRow key={sale._id} sale={sale} onPay={openPayment} />
            ))}
          </Details>

          <Details title="Customer Payment Details" empty="No customer sales yet.">
            {customerRows.map(([id, row]) => (
              <div key={id} className="rounded-2xl border border-iceblue-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{row.name}</p>
                    <p className="mt-1 text-xs text-navy-800/55">{formatBarQuantity(row.quantity)} bar used · {formatCurrency(row.amount)}</p>
                  </div>
                  <span className={`pill shrink-0 ${row.balance > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {row.balance > 0 ? 'Not Paid' : 'Paid'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <AmountBox label="Paid" value={row.paid} />
                  <AmountBox label="Balance" value={row.balance} danger={row.balance > 0} />
                </div>
              </div>
            ))}
          </Details>
        </div>
      </div>

      <Details title="Payment Tracker" empty="No bills found for this truck.">
        {allSales.map((sale) => (
          <PaymentRow key={sale._id} sale={sale} onPay={openPayment} />
        ))}
      </Details>

      <Details title="Pending Collections" empty="No pending payments.">
        {dueSales.map((sale) => (
          <PaymentRow key={sale._id} sale={sale} onPay={openPayment} compact />
        ))}
      </Details>

      <Details title="Driver Amount / Expense" empty="No driver amount entered today.">
        {expenses.map((row) => <div key={row._id} className="rounded-2xl border border-iceblue-100 bg-white p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-navy-900">{row.purpose}</p><p className="mt-1 text-xs text-navy-800/55">{row.notes || formatDate(row.date)}</p></div><strong className="text-amber-600">{formatCurrency(row.amount)}</strong></div></div>)}
      </Details>

      <div className="grid gap-5 lg:grid-cols-2">
        <Details title="Wastage Details" empty="No wastage recorded today.">
          {wastageRows.map((row) => (
            <WastageRow key={row._id} row={row} />
          ))}
        </Details>

        <Details title="Return Details" empty="No returns recorded today.">
          {returnRows.map((row) => (
            <WastageRow key={row._id} row={row} />
          ))}
        </Details>
      </div>

      {activeWastageRows.length > 0 && (
        <p className="text-center text-xs text-navy-800/45">
          Showing {activeWastageRows.length} {mode === 'return' ? 'return' : 'wastage'} entries for today.
        </p>
      )}
      </>}

      {!tripClosing?.driverClosed && paymentTarget && (
        <Modal title={`Update Payment: ${getCustomerName(paymentTarget)}`} onClose={() => setPaymentTarget(null)}>
          <form onSubmit={savePayment} className="space-y-4">
            <div className="rounded-2xl bg-iceblue-50 p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-navy-800/60">Bill Date</span>
                <strong>{formatDate(paymentTarget.date)}</strong>
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

            <button className="btn-primary flex h-12 w-full items-center justify-center gap-2" disabled={savingPayment}>
              <FiDollarSign /> {savingPayment ? 'Updating...' : 'Update Payment'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, suffix }: any) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/20 bg-white/15 p-3 backdrop-blur xl:p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-iceblue-600">
        <Icon />
      </div>
      <p className="text-xs font-medium text-cyan-50/75">{label}</p>
      <p className="mt-1 break-words font-display text-lg font-bold sm:text-xl xl:text-2xl">
        {value}
        {suffix && <span className="ml-1 text-xs font-medium text-cyan-50/75">{suffix}</span>}
      </p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: any) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-iceblue-50 text-iceblue-600',
  };

  return (
    <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white p-3 shadow-ice sm:p-4">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon />
      </div>
      <p className="text-xs font-semibold uppercase text-navy-800/50">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-navy-900">{value}</p>
    </div>
  );
}

function Details({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-navy-900">{title}</h2>
        <span className="rounded-full bg-iceblue-50 px-3 py-1 text-xs font-semibold text-iceblue-700">{children.length}</span>
      </div>
      {children.length === 0 ? (
        <p className="rounded-2xl border border-iceblue-100 bg-white px-4 py-5 text-sm text-navy-800/50">{empty}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

function SaleRow({ sale, onPay }: { sale: any; onPay: (sale: any) => void }) {
  const balance = Number(sale.balanceAmount || 0);
  const items = sale.items?.map((item: any) => `${formatBarQuantity(getItemBarUsed(item))} bar used`).join(', ');

  return (
    <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-900">{getCustomerName(sale)}</p>
          <p className="mt-1 text-xs text-navy-800/55">{items || `${formatBarQuantity(getQuantity(sale))} bar used`}</p>
        </div>
        <span className={`pill shrink-0 ${balance > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {balance > 0 ? 'Due' : 'Paid'}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-3">
        <AmountBox label="Total" value={sale.totalAmount} />
        <AmountBox label="Paid" value={sale.paidAmount} />
        <AmountBox label="Balance" value={balance} danger={balance > 0} />
      </div>
      {balance > 0 && (
        <button
          type="button"
          onClick={() => onPay(sale)}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 text-sm font-semibold text-white transition hover:bg-iceblue-700"
        >
          <FiDollarSign /> Update Payment
        </button>
      )}
    </div>
  );
}

function PaymentRow({ sale, onPay, compact = false }: { sale: any; onPay: (sale: any) => void; compact?: boolean }) {
  const balance = Number(sale.balanceAmount || 0);
  const payments = sale.payments || [];

  return (
    <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-900">{getCustomerName(sale)}</p>
          <p className="mt-1 text-xs text-navy-800/55">Bill date: {formatDate(sale.date)}</p>
        </div>
        <span className={`pill shrink-0 ${balance > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {balance > 0 ? 'Not Paid' : 'Paid'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-3">
        <AmountBox label="Total" value={sale.totalAmount} />
        <AmountBox label="Paid" value={sale.paidAmount} />
        <AmountBox label="Balance" value={balance} danger={balance > 0} />
      </div>

      {!compact && (
        <div className="mt-3 rounded-xl bg-iceblue-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-navy-800/45">Payment Dates</p>
          {payments.length === 0 ? (
            <p className="mt-1 text-xs text-navy-800/50">No later payments recorded.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {payments.map((payment: any, index: number) => (
                <div key={`${payment.date}-${index}`} className="flex justify-between gap-3 text-xs">
                  <span className="text-navy-800/60">{formatDate(payment.date)} · {payment.paymentMode}</span>
                  <strong className="text-navy-900">{formatCurrency(payment.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {balance > 0 && (
        <button
          type="button"
          onClick={() => onPay(sale)}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-iceblue-500 text-sm font-semibold text-white transition hover:bg-iceblue-600"
        >
          <FiDollarSign /> Collect Payment
        </button>
      )}
    </div>
  );
}

function WastageRow({ row }: { row: any }) {
  const reason = WASTAGE_REASONS.find((item) => item.value === row.reason)?.label || row.reason;
  const barUsed = formatBarQuantity(getItemBarUsed(row));

  return (
    <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy-900">{barUsed} bar used</p>
          <p className="mt-1 text-xs text-navy-800/55">{reason}</p>
        </div>
        <span className="pill bg-iceblue-50 text-iceblue-700">{formatDate(row.date)}</span>
      </div>
      {row.notes && <p className="mt-3 rounded-xl bg-iceblue-50 px-3 py-2 text-xs text-navy-800/60">{row.notes}</p>}
    </div>
  );
}

function AmountBox({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-iceblue-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-navy-800/45">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{formatCurrency(value)}</p>
    </div>
  );
}
