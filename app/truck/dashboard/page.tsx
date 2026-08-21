'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  FiSearch,
  FiShoppingCart,
  FiTrash2,
  FiTrendingUp,
  FiTruck,
  FiUserPlus,
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
const createExpenseForm = () => ({ date: indiaDateISO(), costType: '', customCategory: '', amount: '', fuelQuantity: '', notes: '' });
const createWastageForm = () => ({ date: indiaDateISO(), size: '1', quantity: '', reason: 'broken', notes: '' });
const createCustomerForm = () => ({ name: '', phoneNumber: '', address: '', defaultSaleType: 'retail', price: '', notes: '' });

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  if (typeof response?.data?.message === 'string') return response.data.message;
  if (Array.isArray(response?.data?.message)) return response.data.message.join(' ');
  return fallback;
};

const getCustomerName = (sale: any) => sale.customer?.name || sale.customerName || 'Customer';
const getQuantity = (sale: any) => sale.items?.reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0) || 0;
const referenceId = (value: any) => String(value?._id || value || '');
const saleTruckId = (sale: any) => referenceId(sale?.truck || sale?.truckId);

type AssignmentAction = 'accept' | 'reject';
type DashboardTab = 'overview' | 'trip' | 'customers';

const DASHBOARD_TABS: Array<{ key: DashboardTab; label: string; icon: typeof FiCompass }> = [
  { key: 'overview', label: 'Overview', icon: FiCompass },
  { key: 'trip', label: 'Report', icon: FiTruck },
  { key: 'customers', label: 'Customer History', icon: FiClock },
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
  const router = useRouter();
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
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [wastageForm, setWastageForm] = useState(createWastageForm);
  const [expenseForm, setExpenseForm] = useState(createExpenseForm);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [customerHistoryError, setCustomerHistoryError] = useState('');
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerListLoading, setCustomerListLoading] = useState(false);
  const [customerForm, setCustomerForm] = useState(createCustomerForm);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const customerSearchBoxRef = useRef<HTMLDivElement>(null);
  const customerSearchRequestRef = useRef(0);
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

  const loadCustomers = useCallback(async (search = '') => {
    const requestId = ++customerSearchRequestRef.current;
    setCustomerListLoading(true);
    setCustomerError('');
    try {
      const { data: rows } = await api.get('/customers', { params: search.trim() ? { search: search.trim() } : {} });
      if (requestId === customerSearchRequestRef.current) setCustomerList(Array.isArray(rows) ? rows : []);
    } catch (err: unknown) {
      if (requestId === customerSearchRequestRef.current) {
        setCustomerList([]);
        setCustomerError(getErrorMessage(err, 'Could not load customers.'));
      }
    } finally {
      if (requestId === customerSearchRequestRef.current) setCustomerListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!customerListOpen) return;
    const timer = window.setTimeout(() => void loadCustomers(customerSearch), 250);
    return () => window.clearTimeout(timer);
  }, [customerListOpen, customerSearch, loadCustomers]);

  useEffect(() => {
    const closeCustomerResults = (event: PointerEvent) => {
      if (!customerSearchBoxRef.current?.contains(event.target as Node)) setCustomerListOpen(false);
    };
    document.addEventListener('pointerdown', closeCustomerResults);
    return () => document.removeEventListener('pointerdown', closeCustomerResults);
  }, []);

  const saveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(customerForm.price);
    if (!Number.isFinite(price) || price <= 0) {
      setCustomerError('Enter a price greater than zero.');
      return;
    }
    setCustomerSaving(true);
    setCustomerError('');
    try {
      const createdCustomerName = customerForm.name.trim();
      const driverName = data?.truck?.driverName || user?.displayName || user?.username || 'Driver';
      const { price: _price, ...customerFields } = customerForm;
      await api.post('/customers', {
        ...customerFields,
        customerType: 'truck',
        truck: data?.truck?._id || user?.truck,
        isActive: true,
        ...(customerForm.defaultSaleType === 'wholesale' ? { wholesalePrice: price } : { retailPrice: price }),
        notes: `[Created by: ${driverName}]\n[Customer price: ${customerForm.defaultSaleType}=${price}]${customerForm.notes ? `\n${customerForm.notes}` : ''}`,
      });
      setCustomerForm(createCustomerForm());
      setCustomerCreateOpen(false);
      setCustomerListOpen(true);
      setCustomerSearch(createdCustomerName);
      await loadCustomers(createdCustomerName);
    } catch (err: unknown) {
      setCustomerError(getErrorMessage(err, err instanceof Error ? err.message : 'Could not create customer.'));
    } finally {
      setCustomerSaving(false);
    }
  };

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
  const customerHistoryRows = useMemo(() => customerHistory.map((sale) => ({
    sale,
    name: getCustomerName(sale),
    bar: getQuantity(sale),
  })), [customerHistory]);
  const pendingCustomerRows = useMemo(
    () => customerHistoryRows.filter((row) => Number(row.sale.balanceAmount || 0) > 0),
    [customerHistoryRows],
  );

  const loadCustomerHistory = useCallback(async () => {
    const truckId = referenceId(data?.truck?._id || user?.truck);
    if (!truckId) return;
    setCustomerHistoryLoading(true);
    setCustomerHistoryError('');
    try {
      const { data: rows } = await api.get('/sales');
      const salesRows = Array.isArray(rows) ? rows : [];
      setCustomerHistory(salesRows
        .filter((sale) => saleTruckId(sale) === truckId)
        .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()));
    } catch (err: unknown) {
      setCustomerHistory([]);
      setCustomerHistoryError(getErrorMessage(err, 'Could not load customer history.'));
    } finally {
      setCustomerHistoryLoading(false);
    }
  }, [data?.truck?._id, user?.truck]);

  useEffect(() => {
    if (activeTab === 'customers') void loadCustomerHistory();
  }, [activeTab, loadCustomerHistory]);

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
  const driverAmount = useMemo(() => expenses
    .filter((row) => ['advance_for_employee', 'advance_for_emp', 'advance_employee', 'employee_advance', 'worker_amount'].includes(String(row.costType || row.purpose || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0), [expenses]);
  const expenseAmount = useMemo(() => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0) - driverAmount, [driverAmount, expenses]);
  const totalExpense = expenseAmount + driverAmount;
  const totalCollection = Number(data?.todayCollection ?? sales.reduce((sum, sale) => sum + Number(sale.paidAmount || 0), 0));
  const driverBalanceAmount = useMemo(
    () => totalCollection - expenseAmount - driverAmount,
    [driverAmount, expenseAmount, totalCollection],
  );

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
      if (activeTab === 'customers') await loadCustomerHistory();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not update payment.'));
    } finally {
      setSavingPayment(false);
    }
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = expenseForm.costType === 'custom' ? expenseForm.customCategory.trim() : expenseForm.costType;
    if (!category) { setError('Select or enter an expense category.'); return; }
    const fuelQuantity = Number(expenseForm.fuelQuantity);
    if (expenseForm.costType === 'petrol_diesel' && (!Number.isFinite(fuelQuantity) || fuelQuantity <= 0)) {
      setError('Enter fuel consumed in litres.');
      return;
    }
    setSavingExpense(true);
    setError('');
    try {
      await api.post('/driver-expenses', {
        date: expenseForm.date,
        amount: Number(expenseForm.amount),
        purpose: category === 'advance_for_employee' ? 'Worker Amount' : category === 'petrol_diesel' ? 'Petrol / Diesel' : category === 'other_expenses' ? 'Other Expenses' : category === 'food' ? 'Food' : category,
        costType: category,
        fuelQuantity: expenseForm.costType === 'petrol_diesel' ? fuelQuantity : 0,
        notes: expenseForm.notes,
        truck: data?.truck?._id || user?.truck,
        truckName: data?.truck?.truckName || '',
        driverName: data?.truck?.driverName || user?.displayName || user?.username || 'Driver',
        workerName: category === 'advance_for_employee' ? data?.truck?.driverName || user?.displayName || user?.username || 'Driver' : '',
      });
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
    <div className="min-w-0 space-y-4 pb-24 sm:space-y-5 sm:pb-20 xl:space-y-6">
      <section className="overflow-hidden rounded-2xl border border-iceblue-100 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 p-3.5 sm:p-4 lg:flex-row lg:items-center lg:gap-4 lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-iceblue-400 to-navy-900 text-base text-white shadow-sm"><FiTruck /></span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.16em] text-iceblue-600">{getGreeting()}, {data?.truck?.driverName || user?.displayName || user?.username || 'Driver'}</p>
              <p className="truncate font-display text-lg font-black leading-tight text-navy-900 sm:text-xl">{data?.truck?.truckName || 'Truck'}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-medium text-navy-800/50">
                {data?.truck?.truckNumber && <span className="font-semibold text-navy-800/70">{data.truck.truckNumber}</span>}
                {data?.truck?.phoneNumber && <span className="inline-flex items-center gap-1"><FiPhone /> {data.truck.phoneNumber}</span>}
                <span>{formatDate(indiaDateISO())}</span>
              </div>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-iceblue-100 lg:block" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-navy-800/45">Bars Sold / Taken</p>
              <span className="shrink-0 rounded-full bg-iceblue-50 px-2 py-0.5 text-[10px] font-bold text-iceblue-700">{progress}% sold</span>
            </div>
            <p className="font-display text-2xl font-black leading-tight text-navy-900 sm:text-3xl">{formatBarQuantity(barsSold) || 0}<span className="text-navy-800/30"> / {formatBarQuantity(barsTaken) || 0}</span></p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-iceblue-50"><div className="h-full rounded-full bg-gradient-to-r from-iceblue-400 to-navy-900 transition-all" style={{ width: `${progress}%` }} /></div>
          </div>

          <div className="hidden h-10 w-px bg-iceblue-100 lg:block" />

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:shrink-0 lg:flex-col lg:items-end lg:gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${awaitingAdminApproval ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${awaitingAdminApproval ? 'bg-amber-500' : 'bg-emerald-500'}`} />{truckOffline ? 'Waiting for Bars' : awaitingAdminApproval ? 'Awaiting Admin' : 'Online'}</span>
            <button type="button" onClick={() => void load()} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-navy-900 px-3.5 text-[11px] font-bold text-white transition hover:bg-iceblue-700"><FiRefreshCcw /> Refresh</button>
          </div>
        </div>

        <div className="mx-3.5 h-px bg-iceblue-100 sm:mx-4 lg:mx-5" />

        <div className="p-3.5 sm:p-4 lg:p-5">
          <div className="grid grid-cols-2 gap-1.5 min-[360px]:gap-2 sm:grid-cols-6">
            <button
              type="button"
              onClick={() => { if (canRecordTrip) { setError(''); setAmountModalOpen(true); } }}
              disabled={!canRecordTrip}
              className="min-w-0 rounded-xl border border-iceblue-100 bg-iceblue-50/50 px-2 py-2 text-left transition hover:border-iceblue-200 hover:bg-iceblue-50 disabled:cursor-default disabled:hover:border-iceblue-100 disabled:hover:bg-iceblue-50/50 min-[360px]:px-3"
            >
              <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-navy-800/45"><FiPlus /> Expense</p>
              <p className="mt-0.5 truncate font-display text-base font-bold text-navy-900">{formatCurrency(expenseAmount)}</p>
            </button>
            <div className="min-w-0 rounded-xl border border-violet-100 bg-violet-50/60 px-2 py-2 min-[360px]:px-3"><p className="text-[9px] font-bold uppercase tracking-wide text-violet-700/70">Driver Amount</p><p className="mt-0.5 truncate font-display text-base font-bold text-violet-700">{formatCurrency(driverAmount)}</p></div>
            <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/60 px-2 py-2 min-[360px]:px-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700/70">Balance Amount</p>
              <p className={`mt-0.5 truncate font-display text-base font-bold ${driverBalanceAmount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(driverBalanceAmount)}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-iceblue-100 bg-iceblue-50/50 px-2 py-2 min-[360px]:px-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-navy-800/45">Returned</p>
              <p className="mt-0.5 font-display text-base font-bold text-navy-900">{formatBarQuantity(data?.todayReturned || 0) || 0}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-iceblue-100 bg-iceblue-50/50 px-2 py-2 min-[360px]:px-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-navy-800/45">Wastage</p>
              <p className="mt-0.5 font-display text-base font-bold text-navy-900">{formatBarQuantity(data?.todayWastage || 0) || 0}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-cyan-100 bg-cyan-50/70 px-2 py-2 min-[360px]:px-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-cyan-700/70">Remaining</p>
              <p className="mt-0.5 font-display text-base font-bold text-cyan-800">{formatBarQuantity(Math.max(0, Number(tripClosing?.remaining || 0))) || 0}</p>
            </div>
          </div>

          {canRecordTrip && (
            <button
              type="button"
              onClick={() => { setError(''); setWastageModalOpen(true); }}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
            >
              <FiTrash2 /> Add Wastage
            </button>
          )}
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
            <AmountBox label="Expenses Amount" value={tripClosing.expenseAmount} />
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

      {tripClosing?.driverClosed && !truckOffline && (
        <section className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(135deg,#fffbeb,#e0f2fe)] px-5 py-10 text-center shadow-sm sm:px-8 sm:py-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-3xl text-amber-600">
            <FiClock />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-navy-900 sm:text-3xl">
            Closing submitted — waiting for Admin
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-navy-800/65 sm:text-base">
            Remaining bars were recorded as returns. Sales and entries are locked, but the truck stays online until the admin verifies and accepts the closing.
          </p>
          <button type="button" onClick={() => void load()} className="btn-secondary mx-auto mt-5 inline-flex items-center justify-center gap-2">
            <FiRefreshCcw /> Check Approval Status
          </button>
        </section>
      )}

        <>
          {/* Section tabs — same iceblue/navy palette, split into focused screens instead of one long scroll */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl bg-iceblue-50/70 p-1 min-[360px]:gap-1.5 min-[360px]:p-1.5 lg:w-fit">
              {DASHBOARD_TABS.map(({ key, label, icon: TabIcon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition min-[390px]:px-4 min-[390px]:text-sm ${
                    activeTab === key ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-800/60 hover:bg-white hover:text-navy-900'
                  }`}
                >
                  <TabIcon className={activeTab === key ? 'text-iceblue-300' : 'text-navy-800/40'} /> {label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:flex lg:items-start">
              <div ref={customerSearchBoxRef} className="relative min-w-0 lg:w-80">
                <FiSearch className="pointer-events-none absolute left-3 top-3.5 text-navy-800/40" />
                <input
                  className="input-field h-11 pl-9"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onFocus={() => setCustomerListOpen(true)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCustomerSearch(value);
                    setCustomerListOpen(true);
                  }}
                />
                {customerListOpen && (
                  <div className="absolute right-0 top-12 z-50 max-h-[50dvh] w-full min-w-0 overflow-y-auto rounded-2xl border border-iceblue-100 bg-white p-2 shadow-xl sm:max-h-72">
                    <div className="mb-1 flex items-center justify-between px-2 py-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-navy-800/45">Customers</p>
                      <button type="button" onClick={() => setCustomerListOpen(false)} aria-label="Close customer results" className="text-navy-800/45 hover:text-navy-900"><FiXCircle /></button>
                    </div>
                    {customerListLoading ? <p className="px-3 py-6 text-center text-sm text-navy-800/50">Searching...</p> : customerError ? <p className="px-3 py-4 text-sm font-medium text-red-600">{customerError}</p> : customerList.length ? customerList.map((customer) => (
                      <button type="button" key={customer._id} onClick={() => router.push(`/truck/customers/${customer._id}`)} className="block w-full min-w-0 rounded-xl px-3 py-2 text-left hover:bg-iceblue-50">
                        <p className="break-words text-sm font-bold text-navy-900">{customer.name}</p>
                        <p className="mt-0.5 break-words text-xs text-navy-800/50">{customer.phoneNumber || 'No phone'}{customer.address ? ` · ${customer.address}` : ''}</p>
                      </button>
                    )) : <p className="px-3 py-6 text-center text-sm text-navy-800/50">No customers found.</p>}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { setCustomerError(''); setCustomerForm(createCustomerForm()); setCustomerCreateOpen(true); }} className="btn-primary flex h-11 items-center justify-center gap-2">
                <FiUserPlus /> Create Customer
              </button>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <OverviewTab
                data={data}
                expenseAmount={expenseAmount}
                driverAmount={driverAmount}
                truckOffline={truckOffline}
                recentSales={saleRows.slice(0, 5)}
                onPay={openPayment}
              />
              <ExpenseHistory rows={expenses} />
            </div>
          )}

          {activeTab === 'trip' && (
            <div className="space-y-5">
              <SalesTable title="Today's Sales" rows={saleRows} onPay={openPayment} empty="No sales recorded today." />
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
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-5">
              {customerHistoryLoading ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-iceblue-100 bg-white">
                  <IceBlockSpinner label="Loading customer history..." />
                </div>
              ) : customerHistoryError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
                  <p>{customerHistoryError}</p>
                  <button type="button" onClick={() => void loadCustomerHistory()} className="mt-3 inline-flex items-center gap-2 font-bold underline underline-offset-4"><FiRefreshCcw /> Retry</button>
                </div>
              ) : (
                <>
                  <SalesTable title="Daily Customer Buying History" rows={customerHistoryRows} onPay={openPayment} empty="No customer buying history for this truck." showPay={false} />
                  <SalesTable title="Pending Customer History" rows={pendingCustomerRows} onPay={openPayment} empty="No pending customer payments for this truck." showPay={canRecordTrip} />
                </>
              )}
            </div>
          )}
        </>

      {canRecordTrip && (
        <>
          {addMenuOpen && <button type="button" aria-label="Close add menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setAddMenuOpen(false)} />}
          <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-2 sm:bottom-7 sm:right-7">
            {addMenuOpen && (
              <div className="w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(7,27,43,0.22)]" role="menu">
                <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); setSaleModalOpen(true); }} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-navy-900 transition hover:bg-iceblue-50"><FiShoppingCart className="text-iceblue-600" /> Sales</button>
                <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); setError(''); setAmountModalOpen(true); }} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-navy-900 transition hover:bg-iceblue-50"><FiDollarSign className="text-red-500" /> Expense</button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setAddMenuOpen((open) => !open)}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-navy-900 px-4 text-sm font-bold text-white shadow-[0_14px_35px_rgba(7,27,43,0.3)] transition hover:-translate-y-0.5 hover:bg-iceblue-700 sm:px-5"
              aria-label="Add sales or expense"
              aria-haspopup="menu"
              aria-expanded={addMenuOpen}
            >
              <FiPlus className={`text-lg transition-transform ${addMenuOpen ? 'rotate-45' : ''}`} /> Add
            </button>
          </div>
        </>
      )}

      {saleModalOpen && (
        <Modal title="Add Sale" onClose={() => setSaleModalOpen(false)}>
          <SaleForm
            key={saleFormKey}
            fixedTruckId={user?.truck || ''}
            onSaved={async () => {
              await load();
              setSaleFormKey((key) => key + 1);
              setSaleModalOpen(false);
            }}
          />
        </Modal>
      )}

      {customerCreateOpen && (
        <Modal title="Create Customer" onClose={() => setCustomerCreateOpen(false)}>
          <form onSubmit={saveCustomer} className="space-y-3">
            <div><label className="label-text">Customer Name</label><input required className="input-field" value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} /></div>
            <div><label className="label-text">Phone Number</label><input className="input-field" value={customerForm.phoneNumber} onChange={(event) => setCustomerForm({ ...customerForm, phoneNumber: event.target.value })} /></div>
            <div><label className="label-text">Address</label><input className="input-field" value={customerForm.address} onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })} /></div>
            <div><label className="label-text">Default Sale Type</label><select className="input-field" value={customerForm.defaultSaleType} onChange={(event) => setCustomerForm({ ...customerForm, defaultSaleType: event.target.value })}><option value="retail">Retail</option><option value="wholesale">Wholesale</option></select></div>
            <div><label className="label-text">Price Per Bar</label><input required type="number" min="0.01" step="0.01" inputMode="decimal" className="input-field" placeholder="Enter customer price" value={customerForm.price} onChange={(event) => setCustomerForm({ ...customerForm, price: event.target.value })} /></div>
            <div><label className="label-text">Notes</label><textarea rows={2} className="input-field" value={customerForm.notes} onChange={(event) => setCustomerForm({ ...customerForm, notes: event.target.value })} /></div>
            {customerError && <ErrorAlert message={customerError} />}
            <button disabled={customerSaving} className="btn-primary flex h-11 w-full items-center justify-center gap-2 disabled:opacity-60"><FiUserPlus /> {customerSaving ? 'Creating...' : 'Create Customer'}</button>
          </form>
        </Modal>
      )}

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
        <Modal title="Add Expense" onClose={() => setAmountModalOpen(false)}>
          <form onSubmit={saveExpense} className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div><label className="label-text">Date</label><input type="date" required className="input-field" value={expenseForm.date} onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} /></div>
            <div><label className="label-text">Expense Category</label><select required className="input-field" value={expenseForm.costType} onChange={(e) => setExpenseForm({ ...expenseForm, costType: e.target.value, customCategory: '', fuelQuantity: '' })}><option value="">Select category</option><option value="food">Food</option><option value="petrol_diesel">Petrol / Diesel</option><option value="advance_for_employee">Worker Amount</option><option value="other_expenses">Other Expenses</option><option value="custom">Custom category</option></select>{expenseForm.costType === 'custom' && <input required maxLength={100} className="input-field mt-2" placeholder="Type custom category" value={expenseForm.customCategory} onChange={(e) => setExpenseForm({ ...expenseForm, customCategory: e.target.value })} />}</div>
            {expenseForm.costType === 'advance_for_employee' && <div><label className="label-text">Worker / Driver Name</label><input readOnly className="input-field bg-slate-50" value={data?.truck?.driverName || user?.displayName || user?.username || 'Driver'} /></div>}
            {expenseForm.costType === 'petrol_diesel' && <div className="grid gap-3 sm:grid-cols-2"><div><label className="label-text">Truck</label><input readOnly className="input-field bg-slate-50" value={data?.truck?.truckName || 'Truck'} /></div><div><label className="label-text">Fuel Used (Litres)</label><input required type="number" min="0.01" step="0.01" inputMode="decimal" className="input-field" value={expenseForm.fuelQuantity} onChange={(e) => setExpenseForm({ ...expenseForm, fuelQuantity: e.target.value })} /></div></div>}
            <div><label className="label-text">Amount (₹)</label><input type="number" min="0.01" step="0.01" inputMode="decimal" required className="input-field" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} /></div>
            <div><label className="label-text">Notes</label><textarea className="input-field" rows={3} maxLength={500} placeholder="Invoice, supplier, or reason for expense" value={expenseForm.notes} onChange={(e) => setExpenseForm({...expenseForm, notes: e.target.value})} /></div>
            <button type="submit" className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:opacity-50" disabled={savingExpense}>
              <FiDollarSign /> {savingExpense ? 'Saving...' : 'Save Expense'}
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

function SalesTable({ title, rows, onPay, empty, showPay = true }: { title: string; rows: { sale: any; name: string; bar: number }[]; onPay: (sale: any) => void; empty: string; showPay?: boolean }) {
  const totalBars = rows.reduce((sum, row) => sum + row.bar, 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.sale.totalAmount || 0), 0);
  const totalPaid = rows.reduce((sum, row) => sum + Number(row.sale.paidAmount || 0), 0);
  const totalBalance = rows.reduce((sum, row) => sum + Number(row.sale.balanceAmount || 0), 0);

  return (
    <TableCard title={title} icon={FiShoppingCart} count={rows.length} empty={empty} hasRows={rows.length > 0}>
      <div className="sm:hidden">
        {rows.map(({ sale, name, bar }, index) => {
          const balance = Number(sale.balanceAmount || 0);
          return (
            <div key={sale._id} className="border-b border-slate-100 px-1 py-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy-900">{name}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-navy-800/45">{formatDate(sale.date)} · {formatTime(sale.createdAt || sale.date)}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-navy-800/45">#{index + 1}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-right">
                <div>
                  <p className="text-[10px] font-medium text-navy-800/45">Bars</p>
                  <p className="text-xs font-semibold text-navy-900">{formatBarQuantity(bar)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-navy-800/45">Total</p>
                  <p className="text-xs font-semibold text-navy-900">{formatCurrency(sale.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-navy-800/45">Paid</p>
                  <p className="text-xs font-semibold text-emerald-700">{formatCurrency(sale.paidAmount)}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold ${balance > 0 ? 'text-red-600' : 'text-navy-800/55'}`}>Balance: {formatCurrency(balance)}</p>
                {balance > 0 && showPay ? (
                  <button
                    type="button"
                    onClick={() => onPay(sale)}
                    className="rounded-lg bg-navy-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-iceblue-700"
                  >
                    Pay
                  </button>
                ) : balance > 0 ? (
                  <span className="pill bg-amber-50 text-amber-700">Pending</span>
                ) : (
                  <span className="pill bg-emerald-50 text-emerald-600">Paid</span>
                )}
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-100 px-1 py-3">
          <p className="text-xs font-bold uppercase text-navy-900">Total</p>
          <div className="text-right">
            <p className="text-xs font-bold text-navy-900">{formatBarQuantity(totalBars)} bars</p>
            <p className="text-xs font-bold text-navy-900">{formatCurrency(totalAmount)}</p>
            <p className="text-xs font-bold text-emerald-700">{formatCurrency(totalPaid)}</p>
            <p className={`text-xs font-bold ${totalBalance > 0 ? 'text-red-600' : 'text-navy-900'}`}>{formatCurrency(totalBalance)}</p>
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
      <table className="w-full min-w-[820px] table-fixed border-collapse text-[11px] sm:text-xs lg:text-sm">
        <thead className="bg-slate-100 text-navy-900">
          <tr>
            <th className="w-[5%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase">#</th>
            <th className="w-[15%] border border-slate-300 px-2 py-3 text-left text-[10px] font-bold uppercase">Date</th>
            <th className="w-[22%] border border-slate-300 px-2 py-3 text-left text-[10px] font-bold uppercase">Customer Name</th>
            <th className="w-[9%] border border-slate-300 px-2 py-3 text-right text-[10px] font-bold uppercase">Bars</th>
            <th className="w-[14%] border border-slate-300 px-2 py-3 text-right text-[10px] font-bold uppercase">Total Amount</th>
            <th className="w-[12%] border border-slate-300 px-2 py-3 text-right text-[10px] font-bold uppercase">Paid</th>
            <th className="w-[12%] border border-slate-300 px-2 py-3 text-right text-[10px] font-bold uppercase">Balance</th>
            <th className="w-[11%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sale, name, bar }, index) => {
            const balance = Number(sale.balanceAmount || 0);
            return (
              <tr key={sale._id} className="even:bg-slate-50 hover:bg-iceblue-50/70">
                <td className="border border-slate-300 px-1 py-2.5 text-center font-medium text-navy-900">{index + 1}</td>
                <td className="border border-slate-300 px-2 py-2.5"><p className="font-medium text-navy-900">{formatDate(sale.date)}</p><p className="mt-0.5 text-[10px] text-navy-800/45">{formatTime(sale.createdAt || sale.date)}</p></td>
                <td className="break-words border border-slate-300 px-2 py-2.5 font-semibold text-navy-900">{name}</td>
                <td className="border border-slate-300 px-2 py-2.5 text-right text-navy-900">{formatBarQuantity(bar)}</td>
                <td className="border border-slate-300 px-2 py-2.5 text-right font-semibold text-navy-900">{formatCurrency(sale.totalAmount)}</td>
                <td className="border border-slate-300 px-2 py-2.5 text-right font-medium text-emerald-700">{formatCurrency(sale.paidAmount)}</td>
                <td className={`border border-slate-300 px-2 py-2.5 text-right font-semibold ${balance > 0 ? 'text-red-600' : 'text-navy-800/55'}`}>{formatCurrency(balance)}</td>
                <td className="border border-slate-300 px-1 py-2.5 text-center">
                  {balance > 0 && showPay ? (
                    <button
                      type="button"
                      onClick={() => onPay(sale)}
                      className="rounded-lg bg-navy-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-iceblue-700"
                    >
                      Pay
                    </button>
                  ) : balance > 0 ? (
                    <span className="pill bg-amber-50 text-amber-700">Pending</span>
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
            <td className="border border-slate-300 px-2 py-3 text-right" colSpan={3}>TOTAL</td>
            <td className="border border-slate-300 px-2 py-3 text-right">{formatBarQuantity(totalBars)}</td>
            <td className="border border-slate-300 px-2 py-3 text-right">{formatCurrency(totalAmount)}</td>
            <td className="border border-slate-300 px-2 py-3 text-right text-emerald-700">{formatCurrency(totalPaid)}</td>
            <td className={`border border-slate-300 px-2 py-3 text-right ${totalBalance > 0 ? 'text-red-600' : ''}`}>{formatCurrency(totalBalance)}</td>
            <td className="border border-slate-300 px-2 py-3"></td>
          </tr>
        </tfoot>
      </table>
      </div>
    </TableCard>
  );
}

function ExpenseHistory({ rows }: { rows: any[] }) {
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return (
    <TableCard title="Today's Expense History" icon={FiDollarSign} count={rows.length} empty="No expenses recorded today." hasRows={rows.length > 0}>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={row._id} className="rounded-xl border border-iceblue-100 p-3">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-bold text-navy-900">{row.purpose || row.costType || 'Expense'}</p><p className="mt-1 text-xs text-navy-800/50">{formatDate(row.date)} · {formatTime(row.createdAt || row.date)}</p></div><p className="shrink-0 font-bold text-red-600">-{formatCurrency(row.amount)}</p></div>
            {row.notes && <p className="mt-2 break-words text-xs text-navy-800/55">{row.notes}</p>}
          </div>
        ))}
        <div className="flex justify-between rounded-xl bg-red-50 px-3 py-3 text-sm font-bold"><span>Total Expenses</span><span className="text-red-600">-{formatCurrency(total)}</span></div>
      </div>
      <div className="hidden sm:block">
        <table className="table-base min-w-[640px]"><thead><tr><th>Date / Time</th><th>Category</th><th>Notes</th><th className="text-right">Expense Amount</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{formatDate(row.date)} · {formatTime(row.createdAt || row.date)}</td><td>{row.purpose || row.costType || 'Expense'}</td><td className="break-words">{row.notes || '-'}</td><td className="text-right font-bold text-red-600">-{formatCurrency(row.amount)}</td></tr>)}</tbody><tfoot><tr className="font-bold"><td colSpan={3} className="text-right">Total Expenses</td><td className="text-right text-red-600">-{formatCurrency(total)}</td></tr></tfoot></table>
      </div>
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
  expenseAmount,
  driverAmount,
  truckOffline,
  recentSales,
  onPay,
}: {
  data: any;
  expenseAmount: number;
  driverAmount: number;
  truckOffline: boolean;
  recentSales: { sale: any; name: string; bar: number }[];
  onPay: (sale: any) => void;
}) {
  const balanceDue = Number(data?.todayBalance || 0);
  const stats: Array<{ label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'violet' | 'cyan'; danger?: boolean }> = [
    { label: "Today's Sales", value: formatCurrency(data?.todaySales || 0), icon: FiDollarSign, tone: 'blue' },
    { label: 'Collected', value: formatCurrency(data?.todayCollection || 0), icon: FiCheckCircle, tone: 'emerald' },
    { label: 'Balance Due', value: formatCurrency(balanceDue), icon: FiClock, tone: 'amber', danger: balanceDue > 0 },
    { label: 'Wastage', value: `${formatBarQuantity(data?.todayWastage || 0) || 0} bar`, icon: FiTrash2, tone: 'red' },
    { label: 'Expenses Amount', value: formatCurrency(expenseAmount), icon: FiDollarSign, tone: 'red' },
    { label: 'Driver Amount', value: formatCurrency(driverAmount), icon: FiDollarSign, tone: 'violet' },
    { label: 'Bars Remaining', value: `${formatBarQuantity(Math.max(0, Number(data?.remainingBars || 0))) || 0} bar`, icon: FiPackage, tone: 'cyan' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 min-[390px]:gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <SalesTable title="Latest Sales" rows={recentSales} onPay={onPay} empty="No sales recorded today yet." />
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
    expenseAmount: 0,
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
                <p className="break-words font-display text-xs font-bold text-navy-900 min-[390px]:text-sm">{formatCurrency(trend.totalAmount)}</p>
                <p className="text-[10px] font-semibold uppercase text-navy-800/45">7-day sales</p>
              </div>
              <div className="rounded-xl bg-iceblue-50 px-2 py-2.5">
                <p className="font-display text-sm font-bold text-navy-900">{trend.totalSales}</p>
                <p className="text-[10px] font-semibold uppercase text-navy-800/45">Bills</p>
              </div>
              <div className="rounded-xl bg-iceblue-50 px-2 py-2.5">
                <p className="break-words font-display text-xs font-bold text-navy-900 min-[390px]:text-sm">{formatCurrency(trend.averagePerDay)}</p>
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
                ['Expenses Amount', formatCurrency(report.expenseAmount)],
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
