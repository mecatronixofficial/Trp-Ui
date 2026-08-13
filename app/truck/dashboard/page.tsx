'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiCompass,
  FiDollarSign,
  FiPackage,
  FiPhone,
  FiPlus,
  FiRefreshCcw,
  FiShoppingCart,
  FiTrash2,
  FiTrendingUp,
  FiTruck,
  FiXCircle,
} from 'react-icons/fi';
import Modal from '../../../components/Modal';
import SaleForm from '../../../components/SaleForm';
import IceBlockSpinner from '../../../components/IceBlockSpinner';
import { useAuth } from '../../../context/AuthContext';
import api, { PAYMENT_MODES, WASTAGE_REASONS, formatBarQuantity, formatCurrency, formatDate, getItemBarUsed } from '../../../lib/api';
import { formatTime } from '../../../lib/salesUtils';

const indiaDateISO = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const createPaymentForm = () => ({ date: indiaDateISO(), amount: '', paymentMode: 'cash', notes: '' });
const createExpenseForm = () => ({ date: indiaDateISO(), amount: '', purpose: '', notes: '' });
const createWastageForm = () => ({ date: indiaDateISO(), size: '1', quantity: '', reason: 'broken', notes: '' });

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  if (typeof response?.data?.message === 'string') return response.data.message;
  if (Array.isArray(response?.data?.message)) return response.data.message.join(' ');
  return fallback;
};

const getCustomerName = (sale: any) => sale.customer?.name || sale.customerName || 'Customer';
const getQuantity = (sale: any) => sale.items?.reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0) || 0;

type AssignmentAction = 'accept' | 'reject';
type DashboardTab = 'overview' | 'sales' | 'trip';

const DASHBOARD_TABS: Array<{ key: DashboardTab; label: string; icon: typeof FiCompass }> = [
  { key: 'overview', label: 'Overview', icon: FiCompass },
  { key: 'sales', label: 'Sales', icon: FiShoppingCart },
  { key: 'trip', label: 'Trip', icon: FiTruck },
];

interface TruckAssignment {
  _id: string;
  quantity: number;
  pendingQuantity: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected';
  responseReason?: string;
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
  const { user, logout } = useAuth();
  const [data, setData] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tripClosing, setTripClosing] = useState<any>(null);
  const [pendingAssignment, setPendingAssignment] = useState<TruckAssignment | null>(null);
  const [assignmentAction, setAssignmentAction] = useState<AssignmentAction | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assignmentCancelReason, setAssignmentCancelReason] = useState('');
  const [assignmentCancelOpen, setAssignmentCancelOpen] = useState(false);
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [trend, setTrend] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState('');
  const [logoutPrompt, setLogoutPrompt] = useState<{
    mode: 'return' | 'review' | 'close' | 'waiting' | 'error';
    remaining?: number;
    message?: string;
    summary?: {
      taken: number;
      sold: number;
      collectedAmount: number;
      pendingAmount: number;
      wastage: number;
      returned: number;
      remaining: number;
    };
  } | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const today = indiaDateISO();
      const params = { from: today, to: today };
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
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let loadedDay = indiaDateISO();
    const moveToNewDay = () => {
      const currentDay = indiaDateISO();
      if (currentDay === loadedDay) return;
      loadedDay = currentDay;
      setTrend(null);
      setPaymentForm(createPaymentForm());
      setExpenseForm(createExpenseForm());
      setWastageForm(createWastageForm());
      setAssignmentMessage('');
      void load(true);
    };
    const timer = window.setInterval(moveToNewDay, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (user?.role !== 'truck') return;
    const sendPresence = () => {
      if (document.visibilityState === 'visible') {
        void api.post('/auth/presence').catch(() => undefined);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sendPresence();
    };
    sendPresence();
    const timer = window.setInterval(sendPresence, 30_000);
    window.addEventListener('focus', sendPresence);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sendPresence);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.role]);

  useEffect(() => {
    const handleLogoutRequired = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        mode: 'return' | 'review' | 'close' | 'waiting' | 'error';
        remaining?: number;
        message?: string;
        summary?: {
          taken: number;
          sold: number;
          collectedAmount: number;
          pendingAmount: number;
          wastage: number;
          returned: number;
          remaining: number;
        };
      };
      setError('');
      setLogoutPrompt(detail);
      if (detail.mode === 'waiting') {
        window.sessionStorage.setItem('tii_logout_after_return', 'true');
        setLogoutPending(true);
      }
    };
    window.addEventListener('tii:truck-logout-required', handleLogoutRequired);
    if (window.sessionStorage.getItem('tii_logout_after_return') === 'true') setLogoutPending(true);
    return () => window.removeEventListener('tii:truck-logout-required', handleLogoutRequired);
  }, []);

  useEffect(() => {
    if (!logoutPending) return;
    let active = true;
    const checkApproval = async () => {
      try {
        const { data: rows } = await api.get('/truck-loads/reconciliation', { params: { date: indiaDateISO() } });
        if (!active) return;
        const closing = Array.isArray(rows) ? rows[0] || null : null;
        setTripClosing(closing);
        if (closing?.driverClosed && closing?.checked) {
          window.sessionStorage.removeItem('tii_logout_after_return');
          setLogoutPending(false);
          setLogoutPrompt(null);
          await logout();
        }
      } catch {
        // Keep the driver online and retry while admin approval is pending.
      }
    };
    void checkApproval();
    const timer = window.setInterval(() => void checkApproval(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
    // `logout` intentionally stays outside dependencies so polling is not restarted on every provider render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoutPending]);

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError('');
    try {
      const res = await api.get('/dashboard/truck/trend', { params: { range: 'weekly' } });
      setTrend(res.data);
    } catch (err: unknown) {
      setTrendError(getErrorMessage(err, 'Could not load the sales trend.'));
    } finally {
      setTrendLoading(false);
    }
  }, []);

  // Lazy-load the trend chart only when the driver actually opens the Trip
  // tab, so a routine dashboard refresh doesn't fetch a week of history.
  useEffect(() => {
    if (activeTab === 'trip' && !trend && !trendLoading) {
      void loadTrend();
    }
  }, [activeTab, trend, trendLoading, loadTrend]);

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
  const barsTaken = Number(data?.todayPicked || 0);
  const barsSold = Number(data?.todayQuantitySold || 0);
  const canRecordTrip = Boolean(tripClosing && !tripClosing.driverClosed && Number(tripClosing.taken || 0) > 0);

  useEffect(() => {
    if (pendingAssignment) return;
    const refreshForNewAssignment = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    const timer = window.setInterval(refreshForNewAssignment, 10_000);
    return () => window.clearInterval(timer);
  }, [pendingAssignment, load]);
  const progress = barsTaken > 0 ? Math.max(0, Math.min(100, Math.round((barsSold / barsTaken) * 100))) : 0;
  const totalExpense = useMemo(() => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0), [expenses]);

  const respondToAssignment = async (action: AssignmentAction) => {
    if (!pendingAssignment || assignmentAction) return;
    if (action === 'reject' && assignmentCancelReason.trim().length < 3) {
      setError('Enter a reason before cancelling the assigned bars.');
      return;
    }
    setAssignmentAction(action);
    setAssignmentMessage('');
    setError('');
    try {
      await api.post(`/truck-assignments/${pendingAssignment._id}/${action}`, action === 'reject' ? { reason: assignmentCancelReason.trim() } : {});
      const quantity = formatBarQuantity(pendingAssignment.pendingQuantity) || '0';
      setAssignmentMessage(
        action === 'accept'
          ? `${quantity} ice bar(s) accepted and added to your truck.`
          : `${quantity} ice bar(s) cancelled. The admin can see your reason.`,
      );
      setAssignmentCancelReason('');
      setAssignmentCancelOpen(false);
      if (action === 'reject') {
        setPendingAssignment(null);
        await logout({ confirmedTruckClose: true });
        return;
      }
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, action === 'reject' ? 'Could not cancel the ice bar assignment.' : 'Could not accept the ice bar assignment.'));
    } finally {
      setAssignmentAction(null);
    }
  };

  const saveWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = Number(wastageForm.quantity);
    if (!Number.isFinite(quantity) || quantity < 0.25 || Math.round(quantity * 4) !== quantity * 4) {
      setError('Enter wastage in 0.25 bar increments.');
      return;
    }
    if (quantity > remainingBars) {
      setError(`Wastage cannot be more than the current balance of ${formatBarQuantity(remainingBars) || '0'} bar(s).`);
      return;
    }
    setSavingWastage(true);
    setError('');
    try {
      await api.post('/wastage', {
        ...wastageForm,
        truck: user?.truck || undefined,
        size: '1',
        quantity,
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

  const closeTruckDay = async (logoutRequest = false) => {
    if (!tripClosing || closingDay) return;
    setClosingDay(true);
    setError('');
    try {
      const { data: closing } = await api.post('/truck-loads/reconciliation/driver-close', { date: indiaDateISO() });
      if (logoutRequest) {
        if (closing?.requiresAdminApproval) {
          window.sessionStorage.setItem('tii_logout_after_return', 'true');
          setLogoutPending(true);
          setLogoutPrompt({ mode: 'waiting', remaining: 0, summary: closing, message: 'Return submitted. Waiting for admin approval.' });
        } else {
          setLogoutPrompt(null);
          await logout({ confirmedTruckClose: true });
          return;
        }
      }
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
      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#071b2b] via-[#0e405a] to-[#22b8dd] p-4 text-white shadow-[0_18px_45px_rgba(7,27,43,0.22)] sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[45fr_55fr] lg:gap-0">
          <div className="min-w-0 rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm lg:rounded-r-none lg:border-r-0 sm:p-5">
            <div className="flex items-start gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl text-cyan-200 ring-1 ring-white/20"><FiTruck /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/75">{getGreeting()}, {data?.truck?.driverName || user?.displayName || user?.username || 'Driver'}</p>
                <p className="mt-1 truncate font-display text-2xl font-bold">{data?.truck?.truckName || 'Truck'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {data?.truck?.truckNumber && <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/80">{data.truck.truckNumber}</span>}
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 ${awaitingAdminApproval ? 'bg-amber-400/20 text-amber-100' : 'bg-emerald-400/20 text-emerald-100'}`}><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />{truckOffline ? 'Online · Waiting for Bars' : awaitingAdminApproval ? 'Online · Awaiting Admin' : 'Online'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/65">
                  {data?.truck?.phoneNumber && <span className="inline-flex items-center gap-1.5"><FiPhone /> {data.truck.phoneNumber}</span>}
                  <span>{formatDate(indiaDateISO())}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm lg:rounded-l-none sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/75">Bars Sold / Taken</p><p className="mt-1 font-display text-4xl font-black sm:text-5xl">{formatBarQuantity(barsSold) || 0}<span className="text-cyan-100/55"> / {formatBarQuantity(barsTaken) || 0}</span></p></div>
              <div className="flex flex-wrap gap-2">
                {canRecordTrip && <button type="button" onClick={() => { setError(''); setAmountModalOpen(true); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold transition hover:bg-white/20"><FiDollarSign /> {formatCurrency(totalExpense)}</button>}
                <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold transition hover:bg-white/20"><FiRefreshCcw /> Refresh</button>
                {canRecordTrip && <button type="button" onClick={() => { setError(''); setWastageModalOpen(true); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold transition hover:bg-white/20"><FiTrash2 /> Wastage</button>}
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-cyan-100 transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-white/10 px-2.5 py-1">Returned {formatBarQuantity(data?.todayReturned || 0) || 0}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">Wastage {formatBarQuantity(data?.todayWastage || 0) || 0}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">Remaining {formatBarQuantity(Math.max(0, Number(tripClosing?.remaining || 0))) || 0}</span>
            </div>
          </div>
        </div>
      </section>

      {pendingAssignment && (
        <Modal title={assignmentCancelOpen ? "Cancel Assigned Bars" : "New Ice Bar Assignment"} onClose={() => undefined}>
          <div className="space-y-5">
            <div className="flex min-w-0 items-start gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-600">
                <FiPackage />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">New assignment</p>
                <h2 className="mt-1 font-display text-xl font-bold text-navy-900">Ice bars assigned to your truck</h2>
                <p className="mt-2 text-sm leading-6 text-navy-800/65">Please check the quantity and accept it only after receiving the bars.</p>
                {pendingAssignment.notes && <p className="mt-2 text-sm font-medium text-navy-800/70">Note: {pendingAssignment.notes}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-800/45">Assigned Quantity</p>
              <p className="mt-1 font-display text-4xl font-bold text-emerald-600">
                {formatBarQuantity(pendingAssignment.pendingQuantity) || 0}
                <span className="ml-2 text-base font-semibold text-navy-800/55">bars</span>
              </p>
            </div>

            {assignmentCancelOpen ? (
              <div className="space-y-3">
                <div>
                  <label className="label-text">Reason for Cancellation</label>
                  <textarea
                    autoFocus
                    rows={3}
                    maxLength={250}
                    value={assignmentCancelReason}
                    onChange={(event) => setAssignmentCancelReason(event.target.value)}
                    placeholder="Tell Admin why you cannot accept these bars"
                    className="input-field text-sm"
                  />
                </div>
                {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { setAssignmentCancelOpen(false); setAssignmentCancelReason(''); setError(''); }} disabled={assignmentAction !== null} className="btn-secondary">Back</button>
                  <button type="button" onClick={() => void respondToAssignment('reject')} disabled={assignmentAction !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                    <FiXCircle /> {assignmentAction === 'reject' ? 'Cancelling...' : 'Confirm Cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setAssignmentCancelOpen(true); setError(''); }} disabled={assignmentAction !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50">
                  <FiXCircle /> Cancel
                </button>
                <button type="button" onClick={() => void respondToAssignment('accept')} disabled={assignmentAction !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
                  <FiCheckCircle /> {assignmentAction === 'accept' ? 'Accepting...' : 'Accept'}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {assignmentMessage && (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <FiCheckCircle className="shrink-0" /> {assignmentMessage}
        </p>
      )}

      {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      {logoutPrompt && (
        <Modal
          title={logoutPrompt.mode === 'return' ? 'Return Ice Bars Before Logout' : logoutPrompt.mode === 'review' ? 'Admin Verification Required' : logoutPrompt.mode === 'close' ? 'Check All & Close' : logoutPrompt.mode === 'waiting' ? 'Waiting for Admin Approval' : 'Logout Check Failed'}
          onClose={() => {
            setLogoutPrompt(null);
            if (logoutPrompt.mode === 'waiting') {
              window.sessionStorage.removeItem('tii_logout_after_return');
              setLogoutPending(false);
            }
          }}
        >
          <div className="space-y-4">
            {logoutPrompt.summary && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ['Taken', formatBarQuantity(logoutPrompt.summary.taken) || '0'],
                  ['Sold', formatBarQuantity(logoutPrompt.summary.sold) || '0'],
                  ['Collection', formatCurrency(logoutPrompt.summary.collectedAmount)],
                  ['Pending', formatCurrency(logoutPrompt.summary.pendingAmount)],
                  ['Wastage', formatBarQuantity(logoutPrompt.summary.wastage) || '0'],
                  ['Balance', formatBarQuantity(Math.max(0, logoutPrompt.summary.remaining)) || '0'],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-iceblue-100 bg-iceblue-50/50 p-3">
                    <p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p>
                    <p className="mt-1 font-bold text-navy-900">{value}</p>
                  </div>
                ))}
              </div>
            )}
            {logoutPrompt.mode === 'return' ? (
              <>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="flex items-center gap-2 font-semibold"><FiPackage /> {Number(logoutPrompt.remaining || 0) > 0 ? 'Ice bars are still with this truck' : 'Returned bars need Admin approval'}</p>
                  <p className="mt-2 text-sm leading-6">
                    {Number(logoutPrompt.remaining || 0) > 0
                      ? <>You cannot logout or go Offline while carrying <strong>{formatBarQuantity(logoutPrompt.remaining || 0)} bar(s)</strong>. Return all remaining bars and wait for Admin acceptance.</>
                      : <>Admin must verify and accept <strong>{formatBarQuantity(logoutPrompt.summary?.returned || 0)} returned bar(s)</strong> before this truck can go Offline.</>}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setLogoutPrompt(null)} disabled={closingDay} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={() => void closeTruckDay(true)} disabled={closingDay} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                    <FiTruck /> {closingDay ? 'Submitting...' : Number(logoutPrompt.remaining || 0) > 0 ? `Return ${formatBarQuantity(logoutPrompt.remaining || 0)} Bars` : 'Submit Return'}
                  </button>
                </div>
              </>
            ) : logoutPrompt.mode === 'review' ? (
              <>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="flex items-center gap-2 font-semibold"><FiAlertCircle /> Entry difference needs Admin verification</p>
                  <p className="mt-2 text-sm leading-6 text-amber-800/80">
                    Sold, returned or wastage is {formatBarQuantity(Math.abs(logoutPrompt.remaining || 0))} bar(s) higher than Taken. Submit the closing without deleting any records. The truck remains Online until Admin accepts it.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setLogoutPrompt(null)} disabled={closingDay} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={() => void closeTruckDay(true)} disabled={closingDay} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                    <FiCheckCircle /> {closingDay ? 'Submitting...' : 'Submit to Admin'}
                  </button>
                </div>
              </>
            ) : logoutPrompt.mode === 'close' ? (
              <>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <p className="flex items-center gap-2 font-semibold"><FiCheckCircle /> No ice bars remain in this truck</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-800/80">
                    Check Taken, Sold, Collection, Pending and Wastage. Because the balance is zero, Admin return approval is not required.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setLogoutPrompt(null)} disabled={closingDay} className="btn-secondary">Cancel</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (Number(logoutPrompt.summary?.taken || 0) > 0 && tripClosing) void closeTruckDay(true);
                      else void logout({ confirmedTruckClose: true });
                    }}
                    disabled={closingDay}
                    className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FiCheckCircle /> {closingDay ? 'Closing...' : 'Check All & Close'}
                  </button>
                </div>
              </>
            ) : logoutPrompt.mode === 'waiting' ? (
              <>
                <div className="rounded-2xl border border-iceblue-200 bg-iceblue-50 p-4 text-navy-900">
                  <p className="flex items-center gap-2 font-semibold"><FiClock /> Return request sent to Admin</p>
                  <p className="mt-2 text-sm leading-6 text-navy-800/65">
                    The truck remains Online until Admin verifies and accepts the returned bars. This screen checks approval automatically.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => {
                    window.sessionStorage.removeItem('tii_logout_after_return');
                    setLogoutPending(false);
                    setLogoutPrompt(null);
                  }} className="btn-secondary">Stay Online</button>
                  <button type="button" onClick={() => void load()} className="btn-primary flex items-center justify-center gap-2"><FiRefreshCcw /> Check Approval</button>
                </div>
              </>
            ) : (
              <>
                <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {logoutPrompt.message || 'Could not verify the truck balance. Logout was cancelled for safety.'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setLogoutPrompt(null)} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={() => { setLogoutPrompt(null); void logout(); }} className="btn-primary">Try Again</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

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
            ['Taken', tripClosing.taken], ['Sold', tripClosing.sold], ['Returned', tripClosing.returned], ['Wastage', tripClosing.wastage], ['Balance', tripClosing.remaining], ['Collection', formatCurrency(tripClosing.collectedAmount)], ['Pending', formatCurrency(tripClosing.pendingAmount)], ['Total Sales', formatCurrency(tripClosing.salesAmount)],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-iceblue-100/70 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p><p className="mt-1 break-words font-bold text-navy-900">{value}</p></div>)}</div>
          {!tripClosing.driverClosed && remainingBars > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Click Return Bars &amp; Close to move {formatBarQuantity(remainingBars)} remaining bar(s) to Unsold Returns.</p>}
          {!tripClosing.driverClosed && remainingBars < 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">There is a {formatBarQuantity(Math.abs(remainingBars))}-bar difference in today&apos;s entries. Submit the closing for Admin verification; the truck remains Online until Admin accepts it.</p>}
          {truckOffline ? (
            <p className="flex items-center gap-2 font-semibold text-slate-600"><FiCheckCircle /> Admin accepted the closing. Truck is offline.</p>
          ) : awaitingAdminApproval ? (
            <p className="flex items-center gap-2 font-semibold text-amber-700"><FiClock /> Closing sent to admin. Truck remains online until approval.</p>
          ) : (
            <button type="button" onClick={() => { setCloseStatusOpen(false); setClosePreviewOpen(true); }} className="btn-primary flex w-full items-center justify-center gap-2">
              <FiCheckCircle /> {remainingBars > 0 ? `Return ${formatBarQuantity(remainingBars)} Bars & Close` : remainingBars < 0 ? 'Submit Difference to Admin' : 'Check All & Close'}
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <AmountBox label="Total Sales" value={tripClosing.salesAmount} />
            <AmountBox label="Collection" value={tripClosing.collectedAmount} />
            <AmountBox label="Pending" value={tripClosing.pendingAmount} danger={tripClosing.pendingAmount > 0} />
            <AmountBox label="Driver Amount" value={tripClosing.driverAmount} />
          </div>
          {remainingBars > 0 && <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">When you confirm, {formatBarQuantity(remainingBars)} remaining bar(s) will be recorded as Unsold Returns and the closing will be sent to admin.</p>}
          {remainingBars < 0 && <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800">The {formatBarQuantity(Math.abs(remainingBars))}-bar difference will be sent to Admin for verification. No sale or wastage record will be deleted automatically.</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setClosePreviewOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => void closeTruckDay(true)} disabled={closingDay} className="btn-primary disabled:opacity-50">
              {closingDay ? 'Closing...' : remainingBars > 0 ? `Return ${formatBarQuantity(remainingBars)} & Close` : remainingBars < 0 ? 'Submit to Admin' : 'Check All & Close'}
            </button>
          </div>
        </div>
      </Modal>}

      {tripClosing?.driverClosed && (
        <section className={`rounded-[2rem] border px-5 py-10 text-center shadow-sm sm:px-8 sm:py-14 ${truckOffline ? 'border-iceblue-200 bg-[linear-gradient(135deg,#f0f9ff,#ecfeff)]' : 'border-amber-200 bg-[linear-gradient(135deg,#fffbeb,#e0f2fe)]'}`}>
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl text-3xl ${truckOffline ? 'bg-iceblue-100 text-iceblue-700' : 'bg-amber-100 text-amber-600'}`}>
            {truckOffline ? <FiPackage /> : <FiClock />}
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-navy-900 sm:text-3xl">
            {truckOffline ? 'Online — waiting for Admin to assign bars' : 'Closing submitted — waiting for Admin'}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-navy-800/65 sm:text-base">
            {truckOffline
              ? 'The previous trip is complete. This truck is Online, and a new trip starts automatically when Admin assigns ice bars.'
              : 'Remaining bars were recorded as returns. Sales and entries are locked, but the truck stays online until the admin verifies and accepts the closing.'}
          </p>
          <button type="button" onClick={() => void load()} className="btn-secondary mx-auto mt-5 inline-flex items-center justify-center gap-2">
            <FiRefreshCcw /> {awaitingAdminApproval ? 'Check Approval Status' : 'Check for Assigned Bars'}
          </button>
          {truckOffline && <p className="mt-3 text-xs font-medium text-navy-800/45">This page also checks automatically every 10 seconds.</p>}
        </section>
      )}

        <>
          {/* Section tabs — same iceblue/navy palette, split into focused screens instead of one long scroll */}
          <div className="flex gap-1.5 rounded-2xl bg-iceblue-50/70 p-1.5">
            {DASHBOARD_TABS.map(({ key, label, icon: TabIcon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  activeTab === key ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-800/60 hover:bg-white hover:text-navy-900'
                }`}
              >
                <TabIcon className={activeTab === key ? 'text-iceblue-300' : 'text-navy-800/40'} /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <OverviewTab
              data={data}
              totalExpense={totalExpense}
              truckOffline={truckOffline}
              recentSales={saleRows.slice(0, 5)}
            />
          )}

          {activeTab === 'sales' && (
            <div className={`grid gap-5 ${canRecordTrip ? 'xl:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]' : 'grid-cols-1'} xl:items-start`}>
              {canRecordTrip && <section className="card p-3 transition-shadow hover:shadow-md sm:p-5 xl:sticky xl:top-24">
                <SaleForm
                  key={saleFormKey}
                  fixedTruckId={user?.truck || ''}
                  onSaved={async () => {
                    await load();
                    setSaleFormKey((key) => key + 1);
                  }}
                />
              </section>}

              {!canRecordTrip && (
                <p className="rounded-2xl border border-iceblue-100 bg-iceblue-50 px-4 py-3 text-sm font-medium text-navy-800/65">
                  Today&apos;s report is read-only. Admin must assign ice bars to start a new trip and enable sales.
                </p>
              )}

              <SalesTable title="Today's Sales" rows={saleRows} onPay={openPayment} empty="No sales recorded today." />
            </div>
          )}

          {activeTab === 'trip' && (
            <TripTab
              tripClosing={tripClosing}
              remainingBars={remainingBars}
              truckOffline={truckOffline}
              awaitingAdminApproval={awaitingAdminApproval}
              trend={trend}
              trendLoading={trendLoading}
              trendError={trendError}
              onRetryTrend={() => void loadTrend()}
            />
          )}
        </>

      {canRecordTrip && paymentTarget && (
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
  const totalBars = rows.reduce((sum, row) => sum + row.bar, 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.sale.totalAmount || 0), 0);

  return (
    <TableCard title={title} icon={FiShoppingCart} count={rows.length} empty={empty} hasRows={rows.length > 0}>
      {/* Excel-style ledger grid: bordered cells + a totals footer, like a printed sales sheet */}
      <table className="w-full min-w-[560px] table-fixed border-collapse text-xs">
        <thead className="bg-slate-100 text-navy-900">
          <tr>
            <th className="w-[8%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
            <th className="border border-slate-300 px-3 py-3 text-left text-[10px] font-bold uppercase leading-tight">Customer Name</th>
            <th className="w-[15%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Time</th>
            <th className="w-[13%] border border-slate-300 px-2 py-3 text-right text-[10px] font-bold uppercase leading-tight">Bar</th>
            <th className="w-[20%] border border-slate-300 px-3 py-3 text-right text-[10px] font-bold uppercase leading-tight">Amount</th>
            <th className="w-[14%] border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sale, name, bar }, index) => {
            const balance = Number(sale.balanceAmount || 0);
            return (
              <tr key={sale._id} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                <td className="border border-slate-300 px-3 py-3 font-semibold text-navy-900">{name}</td>
                <td className="border border-slate-300 px-2 py-3 text-center text-navy-800/60">{formatTime(sale.createdAt || sale.date)}</td>
                <td className="border border-slate-300 px-2 py-3 text-right text-navy-900">{formatBarQuantity(bar)}</td>
                <td className="border border-slate-300 px-3 py-3 text-right">
                  <div className="font-semibold text-navy-900">{formatCurrency(sale.totalAmount)}</div>
                  {balance > 0 && <div className="text-[10px] font-semibold text-red-600">Due {formatCurrency(balance)}</div>}
                </td>
                <td className="border border-slate-300 px-2 py-3 text-center">
                  {balance > 0 ? (
                    <button
                      type="button"
                      onClick={() => onPay(sale)}
                      className="rounded-lg bg-navy-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-iceblue-700"
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
        <tfoot>
          <tr className="bg-slate-100 font-bold text-navy-900">
            <td className="border border-slate-300 px-2 py-3 text-center" colSpan={3}>Total</td>
            <td className="border border-slate-300 px-2 py-3 text-right">{formatBarQuantity(totalBars)}</td>
            <td className="border border-slate-300 px-3 py-3 text-right">{formatCurrency(totalAmount)}</td>
            <td className="border border-slate-300 px-2 py-3"></td>
          </tr>
        </tfoot>
      </table>
    </TableCard>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
  danger = false,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'blue' | 'emerald' | 'amber' | 'red' | 'violet' | 'cyan';
  danger?: boolean;
}) {
  const tones: Record<string, { card: string; icon: string }> = {
    blue: { card: 'border-blue-100 from-blue-50 to-white', icon: 'bg-blue-600' },
    emerald: { card: 'border-emerald-100 from-emerald-50 to-white', icon: 'bg-emerald-600' },
    amber: { card: 'border-amber-100 from-amber-50 to-white', icon: 'bg-amber-500' },
    red: { card: 'border-red-100 from-red-50 to-white', icon: 'bg-red-500' },
    violet: { card: 'border-violet-100 from-violet-50 to-white', icon: 'bg-violet-600' },
    cyan: { card: 'border-iceblue-100 from-iceblue-50 to-white', icon: 'bg-iceblue-600' },
  };
  const style = tones[tone] || tones.blue;

  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-gradient-to-br p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${style.card}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${danger ? 'bg-red-500' : style.icon}`}>
        <Icon className="text-base" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-navy-800/45">{label}</p>
        <p className={`truncate font-display text-base font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
      </div>
    </div>
  );
}

function OverviewTab({
  data,
  totalExpense,
  truckOffline,
  recentSales,
}: {
  data: any;
  totalExpense: number;
  truckOffline: boolean;
  recentSales: { sale: any; name: string; bar: number }[];
}) {
  const balanceDue = Number(data?.todayBalance || 0);
  const stats: Array<{ label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'violet' | 'cyan'; danger?: boolean }> = [
    { label: "Today's Sales", value: formatCurrency(data?.todaySales || 0), icon: FiDollarSign, tone: 'blue' },
    { label: 'Collected', value: formatCurrency(data?.todayCollection || 0), icon: FiCheckCircle, tone: 'emerald' },
    { label: 'Balance Due', value: formatCurrency(balanceDue), icon: FiClock, tone: 'amber', danger: balanceDue > 0 },
    { label: 'Wastage', value: `${formatBarQuantity(data?.todayWastage || 0) || 0} bar`, icon: FiTrash2, tone: 'red' },
    { label: 'Driver Amount', value: formatCurrency(totalExpense), icon: FiDollarSign, tone: 'violet' },
    { label: 'Bars Remaining', value: `${formatBarQuantity(Math.max(0, Number(data?.remainingBars || 0))) || 0} bar`, icon: FiPackage, tone: 'cyan' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-navy-900">
          <FiShoppingCart className="text-iceblue-500" /> Latest Sales
        </h2>
        {recentSales.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-iceblue-50/60 px-4 py-8 text-center text-sm text-navy-800/50">No sales recorded today yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border-2 border-slate-400 bg-white">
            <table className="w-full min-w-[560px] table-fixed border-collapse text-xs text-black">
              <thead className="bg-slate-100"><tr><th className="w-[9%] border border-slate-400 px-2 py-2.5 text-center font-bold uppercase">S.No</th><th className="w-[18%] border border-slate-400 px-3 py-2.5 text-left font-bold uppercase">Time</th><th className="w-[31%] border border-slate-400 px-3 py-2.5 text-left font-bold uppercase">Customer</th><th className="w-[17%] border border-slate-400 px-3 py-2.5 text-right font-bold uppercase">Bars</th><th className="w-[25%] border border-slate-400 px-3 py-2.5 text-right font-bold uppercase">Amount</th></tr></thead>
              <tbody>{recentSales.map(({ sale, name, bar }, index) => <tr key={sale._id} className="even:bg-slate-50 hover:bg-iceblue-50/70"><td className="border border-slate-400 px-2 py-2.5 text-center">{index + 1}</td><td className="border border-slate-400 px-3 py-2.5">{formatTime(sale.createdAt || sale.date)}</td><td className="border border-slate-400 px-3 py-2.5 font-semibold">{name}</td><td className="border border-slate-400 px-3 py-2.5 text-right font-semibold">{formatBarQuantity(bar)}</td><td className="border border-slate-400 px-3 py-2.5 text-right font-semibold">{formatCurrency(sale.totalAmount)}</td></tr>)}</tbody>
              <tfoot className="bg-slate-100 font-bold"><tr><td colSpan={3} className="border border-slate-400 px-3 py-2.5 text-right">TOTAL</td><td className="border border-slate-400 px-3 py-2.5 text-right">{formatBarQuantity(recentSales.reduce((sum, row) => sum + row.bar, 0))}</td><td className="border border-slate-400 px-3 py-2.5 text-right">{formatCurrency(recentSales.reduce((sum, row) => sum + Number(row.sale.totalAmount || 0), 0))}</td></tr></tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function TrendChart({ days }: { days: Array<{ date: string; total: number }> }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const chartHeight = 110;

  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height: chartHeight + 40 }}>
      {days.map((day) => {
        const barHeight = Math.max(4, Math.round((day.total / max) * chartHeight));
        const label = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
        return (
          <div key={day.date} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[9px] font-semibold text-navy-800/50">{day.total > 0 ? formatCurrency(day.total) : ''}</span>
            <div className="w-full rounded-t-lg bg-gradient-to-t from-iceblue-600 to-iceblue-300" style={{ height: barHeight }} />
            <span className="text-[10px] font-semibold uppercase text-navy-800/40">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TripTab({
  tripClosing,
  remainingBars,
  truckOffline,
  awaitingAdminApproval,
  trend,
  trendLoading,
  trendError,
  onRetryTrend,
}: {
  tripClosing: any;
  remainingBars: number;
  truckOffline: boolean;
  awaitingAdminApproval: boolean;
  trend: any;
  trendLoading: boolean;
  trendError: string;
  onRetryTrend: () => void;
}) {
  const report = tripClosing || {
    taken: 0,
    sold: 0,
    returned: 0,
    wastage: 0,
    remaining: 0,
    collectedAmount: 0,
    pendingAmount: 0,
    driverAmount: 0,
  };
  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-navy-900">
            <FiTrendingUp className="text-iceblue-500" /> This Week&apos;s Sales
          </h2>
          <button type="button" onClick={onRetryTrend} className="inline-flex items-center gap-1.5 text-xs font-semibold text-iceblue-700 transition hover:text-navy-900">
            <FiRefreshCcw /> Refresh
          </button>
        </div>

        {trendLoading ? (
          <p className="mt-4 text-sm text-navy-800/50">Loading trend...</p>
        ) : trendError ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{trendError}</p>
        ) : trend?.days?.length ? (
          <>
            <div className="mt-4">
              <TrendChart days={trend.days} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-iceblue-50 px-2 py-2.5">
                <p className="font-display text-sm font-bold text-navy-900">{formatCurrency(trend.totalAmount)}</p>
                <p className="text-[10px] font-semibold uppercase text-navy-800/45">7-day sales</p>
              </div>
              <div className="rounded-xl bg-iceblue-50 px-2 py-2.5">
                <p className="font-display text-sm font-bold text-navy-900">{trend.totalSales}</p>
                <p className="text-[10px] font-semibold uppercase text-navy-800/45">Bills</p>
              </div>
              <div className="rounded-xl bg-iceblue-50 px-2 py-2.5">
                <p className="font-display text-sm font-bold text-navy-900">{formatCurrency(trend.averagePerDay)}</p>
                <p className="text-[10px] font-semibold uppercase text-navy-800/45">Avg / day</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-navy-800/50">No sales trend yet.</p>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-navy-900">
          <FiTruck className="text-iceblue-500" /> Today&apos;s Trip
        </h2>
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Taken', report.taken],
                ['Sold', report.sold],
                ['Returned', report.returned],
                ['Wastage', report.wastage],
                ['Balance', Math.max(0, Number(report.remaining || 0))],
                ['Collection', formatCurrency(report.collectedAmount)],
                ['Pending', formatCurrency(report.pendingAmount)],
                ['Driver Amount', formatCurrency(report.driverAmount)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-iceblue-100/70 bg-iceblue-50/40 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p>
                  <p className="mt-1 break-words font-bold text-navy-900">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-xl bg-iceblue-50 px-3 py-2 text-center text-xs font-medium text-navy-800/60">
              Truck closing is checked automatically when you Logout.
            </p>
          </>
      </section>
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

function ErrorAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
      {message}
    </p>
  );
}
