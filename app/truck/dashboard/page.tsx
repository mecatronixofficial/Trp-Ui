'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiPackage,
  FiPhone,
  FiPlus,
  FiRefreshCcw,
  FiShoppingCart,
  FiTrash2,
  FiTruck,
  FiUser,
  FiXCircle,
} from 'react-icons/fi';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';
import IceBlockSpinner from '../../../components/IceBlockSpinner';
import { useAuth } from '../../../context/AuthContext';
import api, { PAYMENT_MODES, WASTAGE_REASONS, formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../lib/api';

const indiaDateISO = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const nextIndiaDateISO = () => {
  const [year, month, day] = indiaDateISO().split('-').map(Number);
  return indiaDateISO(new Date(Date.UTC(year, month - 1, day + 1, 12)));
};

const createPaymentForm = () => ({ date: indiaDateISO(), amount: '', paymentMode: 'cash', notes: '' });
const createExpenseForm = () => ({ date: indiaDateISO(), amount: '', purpose: '', notes: '' });
const createWastageForm = () => ({ date: indiaDateISO(), size: '1', quantity: '', reason: 'broken', notes: '' });

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  return typeof response?.data?.message === 'string' ? response.data.message : fallback;
};

const getCustomerName = (sale: any) => sale.customer?.name || sale.customerName || 'Customer';
const getQuantity = (sale: any) => sale.items?.reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0) || 0;

type AssignmentAction = 'accept' | 'reject';

interface TruckAssignment {
  _id: string;
  quantity: number;
  pendingQuantity: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

const getGreeting = () => {
  const hour = Number(new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function TruckDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tripClosing, setTripClosing] = useState<any>(null);
  const [pendingAssignment, setPendingAssignment] = useState<TruckAssignment | null>(null);
  const [assignmentAction, setAssignmentAction] = useState<AssignmentAction | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [closePreviewOpen, setClosePreviewOpen] = useState(false);
  const [closeStatusOpen, setCloseStatusOpen] = useState(false);
  const [amountModalOpen, setAmountModalOpen] = useState(false);
  const [wastageModalOpen, setWastageModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingWastage, setSavingWastage] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<any>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState(createPaymentForm);
  const [saleFormKey, setSaleFormKey] = useState(0);
  const [error, setError] = useState('');
  const [wastageForm, setWastageForm] = useState(createWastageForm);
  const [expenseForm, setExpenseForm] = useState(createExpenseForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const today = indiaDateISO();
      const params = { from: today, to: nextIndiaDateISO() };
      const [dash, saleRows, expenseRows, tripRows, assignmentRows] = await Promise.all([
        api.get('/dashboard/truck'),
        api.get('/sales', { params }),
        api.get('/driver-expenses', { params }),
        api.get('/truck-loads/reconciliation', { params: { date: today } }),
        api.get('/truck-assignments', { params: { date: today } }),
      ]);
      setData(dash.data);
      setSales(Array.isArray(saleRows.data) ? saleRows.data : []);
      setExpenses(Array.isArray(expenseRows.data) ? expenseRows.data : []);
      setTripClosing(Array.isArray(tripRows.data) ? tripRows.data[0] || null : null);
      const assignments = Array.isArray(assignmentRows.data) ? assignmentRows.data : [];
      setPendingAssignment(assignments.find((row: TruckAssignment) => Number(row.pendingQuantity || 0) > 0) || null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load driver dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saleRows = useMemo(
    () =>
      sales.map((sale) => ({
        sale,
        name: getCustomerName(sale),
        bar: getQuantity(sale),
      })),
    [sales],
  );

  const remainingBars = Number(tripClosing?.remaining || 0);
  const awaitingAdminApproval = Boolean(tripClosing?.driverClosed && !tripClosing?.checked);
  const truckOffline = Boolean(tripClosing?.driverClosed && tripClosing?.checked);
  const barsTaken = truckOffline ? 0 : Number(data?.todayPicked || 0);
  const barsSold = truckOffline ? 0 : Number(data?.todayQuantitySold || 0);
  const progress = barsTaken > 0 ? Math.max(0, Math.min(100, Math.round((barsSold / barsTaken) * 100))) : 0;
  const totalExpense = useMemo(() => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0), [expenses]);

  const respondToAssignment = async (action: AssignmentAction) => {
    if (!pendingAssignment || assignmentAction) return;
    setAssignmentAction(action);
    setAssignmentMessage('');
    setError('');
    try {
      await api.post(`/truck-assignments/${pendingAssignment._id}/${action}`);
      const quantity = formatBarQuantity(pendingAssignment.pendingQuantity) || '0';
      setAssignmentMessage(
        action === 'accept'
          ? `${quantity} ice bar(s) accepted and added to your truck.`
          : `${quantity} ice bar(s) rejected. The admin can see your response.`,
      );
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Could not ${action} the ice bar assignment.`));
    } finally {
      setAssignmentAction(null);
    }
  };

  const saveWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWastage(true);
    setError('');
    try {
      await api.post('/wastage', {
        ...wastageForm,
        size: '1',
        quantity: Number(wastageForm.quantity),
      });
      setWastageForm(createWastageForm());
      setWastageModalOpen(false);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not save wastage.'));
    } finally {
      setSavingWastage(false);
    }
  };

  const openPayment = (sale: any) => {
    setError('');
    setPaymentTarget(sale);
    setPaymentForm({ ...createPaymentForm(), amount: String(sale.balanceAmount || '') });
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
      setPaymentForm(createPaymentForm());
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not update payment.'));
    } finally {
      setSavingPayment(false);
    }
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExpense(true);
    setError('');
    try {
      await api.post('/driver-expenses', { ...expenseForm, amount: Number(expenseForm.amount) });
      setExpenseForm(createExpenseForm());
      setAmountModalOpen(false);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not save driver amount.'));
    } finally {
      setSavingExpense(false);
    }
  };

  const closeTruckDay = async () => {
    if (!tripClosing || closingDay) return;
    setClosingDay(true);
    setError('');
    try {
      await api.post('/truck-loads/reconciliation/driver-close', { date: indiaDateISO() });
      setClosePreviewOpen(false);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not close truck day.'));
    } finally {
      setClosingDay(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <IceBlockSpinner label="Loading driver dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 xl:space-y-6">
      {pendingAssignment && (
        <section className="overflow-hidden rounded-[2rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_right,#d1fae5_0,#ecfdf5_40%,#ffffff_100%)] p-5 shadow-lg shadow-emerald-900/10 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-600 ring-4 ring-emerald-50">
                <FiPackage />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-700">
                  {getGreeting()}, {data?.truck?.driverName || user?.displayName || user?.username || 'Driver'}!
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold text-navy-900 sm:text-3xl">New ice bars assigned to your truck</h1>
                <p className="mt-2 text-sm leading-6 text-navy-800/65">Please check the quantity and accept it only after receiving the bars.</p>
                {pendingAssignment.notes && <p className="mt-2 text-sm font-medium text-navy-800/70">Note: {pendingAssignment.notes}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white/90 p-4 text-center shadow-sm sm:min-w-72">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-800/45">Assigned Quantity</p>
              <p className="mt-1 font-display text-4xl font-bold text-emerald-600">
                {formatBarQuantity(pendingAssignment.pendingQuantity) || 0}
                <span className="ml-2 text-base font-semibold text-navy-800/55">bars</span>
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void respondToAssignment('reject')}
                  disabled={assignmentAction !== null}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <FiXCircle /> {assignmentAction === 'reject' ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  type="button"
                  onClick={() => void respondToAssignment('accept')}
                  disabled={assignmentAction !== null}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <FiCheckCircle /> {assignmentAction === 'accept' ? 'Accepting...' : 'Accept'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {assignmentMessage && (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <FiCheckCircle className="shrink-0" /> {assignmentMessage}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="card flex flex-col justify-between gap-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-iceblue-50 text-2xl text-iceblue-600 ring-4 ring-iceblue-50/60">
              <FiTruck />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-bold text-navy-900">{data?.truck?.truckName || 'Truck'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy-800/60">
                {data?.truck?.truckNumber && <span className="pill bg-iceblue-50 text-iceblue-700">{data.truck.truckNumber}</span>}
                <span className={`pill ${truckOffline ? 'bg-slate-100 text-slate-600' : awaitingAdminApproval ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${truckOffline ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                  {truckOffline ? 'Offline' : awaitingAdminApproval ? 'Online · Awaiting Admin' : 'Online'}
                </span>
                <span className="inline-flex items-center gap-1"><FiUser className="text-navy-800/40" /> {data?.truck?.driverName || user?.displayName || user?.username}</span>
                {data?.truck?.phoneNumber && <span className="inline-flex items-center gap-1"><FiPhone className="text-navy-800/40" /> {data.truck.phoneNumber}</span>}
              </div>
              <p className="mt-1 text-xs text-navy-800/45">{formatDate(indiaDateISO())}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!tripClosing?.driverClosed && (
              <button
                type="button"
                onClick={() => { setError(''); setAmountModalOpen(true); }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-iceblue-50 px-4 text-sm font-semibold text-iceblue-700 transition hover:bg-iceblue-100"
              >
                <FiDollarSign />
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-iceblue-700/60">Amount</span>
                  <span className="text-sm font-bold">{formatCurrency(totalExpense)}</span>
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-iceblue-50 px-4 text-sm font-semibold text-iceblue-700 transition hover:bg-iceblue-100"
            >
              <FiRefreshCcw /> Refresh
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top_right,#dff5fd_0,#43c1e6_38%,#175872_100%)] p-5 text-white shadow-lg shadow-iceblue-900/15 transition-shadow hover:shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-50/80"><FiPackage /> Bars Sold / Taken</p>
            <div className="flex shrink-0 items-center gap-1.5">
              {tripClosing && (
                <button
                  type="button"
                  onClick={() => { setError(''); setCloseStatusOpen(true); }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/25"
                >
                  <FiClock /> {truckOffline ? 'Offline' : awaitingAdminApproval ? 'Awaiting Admin' : 'Close Day'}
                </button>
              )}
              {!tripClosing?.driverClosed && (
                <button
                  type="button"
                  onClick={() => { setError(''); setWastageModalOpen(true); }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/25"
                >
                  <FiTrash2 /> Wastage
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 font-display text-4xl font-bold sm:text-5xl">
            {formatBarQuantity(barsSold) || 0}<span className="text-cyan-50/60">/{formatBarQuantity(barsTaken) || 0}</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1"><FiRefreshCcw className="text-[11px]" /> Returned {truckOffline ? 0 : formatBarQuantity(data?.todayReturned || 0) || 0}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1"><FiTrash2 className="text-[11px]" /> Wastage {truckOffline ? 0 : formatBarQuantity(data?.todayWastage || 0) || 0}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1"><FiCheckCircle className="text-[11px]" /> Remaining {truckOffline ? 0 : formatBarQuantity(data?.remainingBars || 0) || 0}</span>
          </div>
        </section>
      </div>

      {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      {closeStatusOpen && tripClosing && <Modal title="End-of-Day Truck Closing" onClose={() => setCloseStatusOpen(false)}>
        <div className="space-y-4">
          {error && <ErrorAlert message={error} />}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-navy-800/55">Confirm all sold, returned, wasted, pending, and driver amounts.</p>
            <span className={`pill shrink-0 ${truckOffline ? 'bg-slate-100 text-slate-600' : awaitingAdminApproval ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {truckOffline ? 'Admin Accepted · Offline' : awaitingAdminApproval ? 'Awaiting Admin · Online' : 'Online'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
            ['Taken', tripClosing.taken], ['Sold', tripClosing.sold], ['Returned', tripClosing.returned], ['Wastage', tripClosing.wastage], ['Balance', tripClosing.remaining], ['Sales', formatCurrency(tripClosing.salesAmount)], ['Pending', formatCurrency(tripClosing.pendingAmount)], ['Driver Amount', formatCurrency(tripClosing.driverAmount)],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-iceblue-100/70 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className="mt-1 break-words font-bold text-navy-900">{value}</p></div>)}</div>
          {!tripClosing.driverClosed && remainingBars > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Click Return Bars &amp; Close to move {formatBarQuantity(remainingBars)} remaining bar(s) to Unsold Returns.</p>}
          {!tripClosing.driverClosed && remainingBars < 0 && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Balance is negative. Correct the taken, sales, return, or wastage entries before closing.</p>}
          {truckOffline ? (
            <p className="flex items-center gap-2 font-semibold text-slate-600"><FiCheckCircle /> Admin accepted the closing. Truck is offline.</p>
          ) : awaitingAdminApproval ? (
            <p className="flex items-center gap-2 font-semibold text-amber-700"><FiClock /> Closing sent to admin. Truck remains online until approval.</p>
          ) : (
            <button type="button" onClick={() => { setCloseStatusOpen(false); setClosePreviewOpen(true); }} disabled={remainingBars < 0} className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50">
              <FiCheckCircle /> {remainingBars > 0 ? `Return ${formatBarQuantity(remainingBars)} Bars & Close` : 'Close Truck Day'}
            </button>
          )}
        </div>
      </Modal>}

      {closePreviewOpen && tripClosing && <Modal title="Confirm Truck Day Closing" onClose={() => setClosePreviewOpen(false)}>
        <div className="space-y-4">
          {error && <ErrorAlert message={error} />}
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
          {remainingBars > 0 && <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">When you confirm, {formatBarQuantity(remainingBars)} remaining bar(s) will be recorded as Unsold Returns and the closing will be sent to admin.</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setClosePreviewOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => void closeTruckDay()} disabled={closingDay} className="btn-primary disabled:opacity-50">
              {closingDay ? 'Closing...' : remainingBars > 0 ? `Return ${formatBarQuantity(remainingBars)} & Close` : 'Close Day'}
            </button>
          </div>
        </div>
      </Modal>}

      {tripClosing?.driverClosed ? (
        <section className={`rounded-[2rem] border px-5 py-10 text-center shadow-sm sm:px-8 sm:py-14 ${truckOffline ? 'border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)]' : 'border-amber-200 bg-[linear-gradient(135deg,#fffbeb,#e0f2fe)]'}`}>
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl text-3xl ${truckOffline ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-600'}`}>
            {truckOffline ? <FiCheckCircle /> : <FiClock />}
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-navy-900 sm:text-3xl">
            {truckOffline ? 'Admin accepted — truck is offline' : 'Closing submitted — waiting for admin'}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-navy-800/65 sm:text-base">
            {truckOffline
              ? 'The admin verified the returned bars and accepted the closing. Today’s truck work is complete.'
              : 'Remaining bars were recorded as returns. Sales and entries are locked, but the truck stays online until the admin verifies and accepts the closing.'}
          </p>
          {awaitingAdminApproval ? (
            <button type="button" onClick={() => void load()} className="btn-secondary mx-auto mt-5 inline-flex items-center justify-center gap-2"><FiRefreshCcw /> Check Approval Status</button>
          ) : (
            <p className="mt-5 font-semibold text-slate-600">See you tomorrow or on the next production day.</p>
          )}
        </section>
      ) : <>
      <div className="grid gap-5 xl:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <section className="card p-3 transition-shadow hover:shadow-md sm:p-5 xl:sticky xl:top-24">
          <SaleForm
            key={saleFormKey}
            fixedTruckId={user?.truck || ''}
            onSaved={async () => {
              await load();
              setSaleFormKey((key) => key + 1);
            }}
          />
        </section>

        <SalesTable title="Today's Sales" rows={saleRows} onPay={openPayment} empty="No sales recorded today." />
      </div>
      </>}

      {!tripClosing?.driverClosed && paymentTarget && (
        <Modal title={`Update Payment: ${getCustomerName(paymentTarget)}`} onClose={() => setPaymentTarget(null)}>
          <form onSubmit={savePayment} className="space-y-4">
            {error && <ErrorAlert message={error} />}
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
                  min={0.01}
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

            <button type="submit" className="btn-primary flex h-12 w-full items-center justify-center gap-2" disabled={savingPayment}>
              <FiDollarSign /> {savingPayment ? 'Updating...' : 'Update Payment'}
            </button>
          </form>
        </Modal>
      )}

      {amountModalOpen && (
        <Modal title="Driver Amount / Expense" onClose={() => setAmountModalOpen(false)}>
          <form onSubmit={saveExpense} className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div><label className="label-text">Date</label><input type="date" required className="input-field" value={expenseForm.date} onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} /></div>
            <div><label className="label-text">Amount Needed / Spent</label><input type="number" min="0.01" step="0.01" required className="input-field" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} /></div>
            <div><label className="label-text">Purpose</label><input required className="input-field" placeholder="Diesel, food, repair..." value={expenseForm.purpose} onChange={(e) => setExpenseForm({...expenseForm, purpose: e.target.value})} /></div>
            <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={expenseForm.notes} onChange={(e) => setExpenseForm({...expenseForm, notes: e.target.value})} /></div>
            <button type="submit" className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:opacity-50" disabled={savingExpense}>
              <FiDollarSign /> {savingExpense ? 'Saving...' : 'Save Amount'}
            </button>
          </form>
        </Modal>
      )}

      {wastageModalOpen && (
        <Modal title="Add Wastage" onClose={() => setWastageModalOpen(false)}>
          <form onSubmit={saveWastage} className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div className="grid gap-3 sm:grid-cols-2">
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

            <div>
              <label className="label-text">Reason</label>
              <select
                className="input-field h-12"
                value={wastageForm.reason}
                onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
              >
                {WASTAGE_REASONS.filter((reason) => reason.value !== 'unsold').map((reason) => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
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

            <button type="submit" className="btn-primary flex h-12 w-full items-center justify-center gap-2" disabled={savingWastage}>
              <FiPlus /> {savingWastage ? 'Saving...' : 'Save Wastage'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TableCard({ title, icon: Icon, count, empty, hasRows, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; count: number; empty: string; hasRows: boolean; children: React.ReactNode }) {
  return (
    <section className="card min-w-0 p-3 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-navy-900">
          {Icon && <Icon className="text-iceblue-500" />} {title}
        </h2>
        <span className="rounded-full bg-iceblue-50 px-3 py-1 text-xs font-semibold text-iceblue-700">{count}</span>
      </div>
      {!hasRows ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl bg-iceblue-50/60 px-4 py-8 text-center">
          {Icon && <Icon className="text-2xl text-iceblue-300" />}
          <p className="text-sm text-navy-800/50">{empty}</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">{children}</div>
      )}
    </section>
  );
}

function SalesTable({ title, rows, onPay, empty }: { title: string; rows: { sale: any; name: string; bar: number }[]; onPay: (sale: any) => void; empty: string }) {
  return (
    <TableCard title={title} icon={FiShoppingCart} count={rows.length} empty={empty} hasRows={rows.length > 0}>
      <table className="table-base">
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Bar</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sale, name, bar }) => {
            const balance = Number(sale.balanceAmount || 0);
            return (
              <tr key={sale._id} className="transition-colors hover:bg-iceblue-50/50">
                <td className="font-semibold text-navy-900">{name}</td>
                <td>{formatBarQuantity(bar)} bar</td>
                <td>
                  <div className="font-semibold text-navy-900">{formatCurrency(sale.totalAmount)}</div>
                  {balance > 0 && <div className="text-xs font-semibold text-red-600">Due {formatCurrency(balance)}</div>}
                </td>
                <td>
                  {balance > 0 ? (
                    <button
                      type="button"
                      onClick={() => onPay(sale)}
                      className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-iceblue-700"
                    >
                      Pay
                    </button>
                  ) : (
                    <span className="pill bg-emerald-50 text-emerald-600">Paid</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
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

function ErrorAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
      {message}
    </p>
  );
}
