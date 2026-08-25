'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertTriangle,
  FiBox,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiDroplet,
  FiEdit2,
  FiGitBranch,
  FiGrid,
  FiKey,
  FiLock,
  FiPlus,
  FiPower,
  FiRefreshCcw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiTruck,
} from 'react-icons/fi';
import api from '../../../lib/api';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrency, formatDate, getItemBarUsed } from '../../../lib/api';
import { selectedBranchHeaders } from '../../../lib/branch-fetch';

interface Truck {
  _id: string;
  truckName: string;
  truckNumber: string;
  driverName: string;
  phoneNumber: string;
  loginId: string;
  status: boolean;
  isOnline?: boolean;
  driverOnline?: boolean;
  online?: boolean;
  branch?: { _id: string; name: string; code: string } | string;
}

type TruckActivity = { filter: 'online' | 'offline'; label: 'On delivery' | 'Awaiting check' | 'Online' | 'Offline'; tone: string };

function getTruckActivity(truck: Truck, reconciliation?: any): TruckActivity {
  const remaining = Number(reconciliation?.remaining || 0);
  const awaitingCheck = Boolean(reconciliation?.driverClosed && !reconciliation?.checked);
  const mustRemainOnline = remaining > 0.0001 || awaitingCheck;
  const livePresence = Boolean(
    truck.isOnline ?? truck.driverOnline ?? truck.online ??
    reconciliation?.isOnline ?? reconciliation?.driverOnline ?? reconciliation?.online ??
    reconciliation?.truck?.isOnline ?? reconciliation?.truck?.driverOnline ?? reconciliation?.truck?.online ?? false,
  );
  const isOnline = mustRemainOnline || livePresence;
  if (!isOnline) return { filter: 'offline', label: 'Offline', tone: 'bg-slate-100 text-slate-600' };
  if (awaitingCheck) return { filter: 'online', label: 'Awaiting check', tone: 'bg-amber-50 text-amber-700' };
  if (Number(reconciliation?.taken || 0) > 0 && !reconciliation?.driverClosed) {
    return { filter: 'online', label: 'On delivery', tone: 'bg-emerald-50 text-emerald-700' };
  }
  return { filter: 'online', label: 'Online', tone: 'bg-iceblue-50 text-iceblue-700' };
}

interface Worker {
  _id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  notes?: string;
  truck?: { _id: string } | string;
  isActive?: boolean;
}

const emptyForm = { branch: '', truckName: '', truckNumber: '', driverName: '', phoneNumber: '', loginId: '', password: '' };

const indiaDateISO = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const saleTruckId = (sale: any) => String(sale?.truck?._id || sale?.truck || sale?.truckId || '');
const workerTruckId = (worker: Worker) => String(typeof worker.truck === 'object' ? worker.truck?._id : worker.truck || '');

function last30Days() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return indiaDateISO(date);
}

export default function TrucksPage() {
  const { user, loading: authLoading } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Truck | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [resetTarget, setResetTarget] = useState<Truck | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [truckStock, setTruckStock] = useState<Record<string, number>>({});
  const [reconciliationByTruck, setReconciliationByTruck] = useState<Record<string, any>>({});
  const [loadTarget, setLoadTarget] = useState<Truck | null>(null);
  const [loadForm, setLoadForm] = useState({ date: indiaDateISO(), quantity: '', notes: '' });
  const [tripCheck, setTripCheck] = useState<any>(null);
  const [dailyTotals, setDailyTotals] = useState({ taken: 0, sold: 0, remaining: 0, salesAmount: 0, pendingAmount: 0, fuelLitres: 0, fuelCost: 0 });
  const [fuelByTruck, setFuelByTruck] = useState<Record<string, { litres: number; cost: number }>>({});
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [assignmentDetails, setAssignmentDetails] = useState<Record<string, any>>({});
  const [assignInputs, setAssignInputs] = useState<Record<string, string>>({});
  const [totalInputs, setTotalInputs] = useState<Record<string, string>>({});
  const [savingAssign, setSavingAssign] = useState<string>('');
  const [assignTarget, setAssignTarget] = useState<Truck | null>(null);
  const [assignChooserOpen, setAssignChooserOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Truck | null>(null);
  const [historyRange, setHistoryRange] = useState({ from: last30Days(), to: indiaDateISO() });
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [pageError, setPageError] = useState('');
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageTrucks = Boolean(selectedBranch);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const overallView = Boolean(isSuperAdmin && !selectedBranch);
  const scopeName = activeBranch ? `${activeBranch.name} (${activeBranch.code})` : isSuperAdmin ? 'All branches' : 'Assigned branch';

  const load = async () => {
    setLoading(true);
    setPageError('');
    try {
    const { data: truckData } = await api.get('/trucks');
    const data = Array.isArray(truckData) ? truckData : [];
    setTrucks(data);
    api.get('/workers', { params: { includeInactive: 'true' } }).then(({ data: workerRows }) => setWorkers(Array.isArray(workerRows) ? workerRows : [])).catch(() => setWorkers([]));
    const stockRows = await Promise.all(data.map((truck: Truck) => api.get(`/stock/truck/${truck._id}`).catch(() => ({ data: { totalStock: 0 } }))));
    setTruckStock(Object.fromEntries(data.map((truck: Truck, index: number) => [truck._id, Number(stockRows[index].data.totalStock || 0)])));
    const today = indiaDateISO();
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = indiaDateISO(tomorrowDate);
    const [dailyRows, todaySales, assignRows, expenseResult] = await Promise.all([
      api.get('/truck-loads/reconciliation', { params: { date: today } }).catch(() => ({ data: [] })),
      api.get('/sales', { params: { from: today, to: tomorrow } }).catch(() => ({ data: [] })),
      api.get('/truck-assignments', { params: { date: today } }).catch(() => ({ data: [] })),
      fetch('/api/expenses?today=true', { cache: 'no-store', headers: selectedBranchHeaders() })
        .then(async (response) => response.ok ? response.json() : { records: [] })
        .catch(() => ({ records: [] })),
    ]);
    const reconciliationRows = Array.isArray(dailyRows.data) ? dailyRows.data : [];
    const saleRows = Array.isArray(todaySales.data) ? todaySales.data : [];
    const assignmentRows = Array.isArray(assignRows.data) ? assignRows.data : [];
    setReconciliationByTruck(Object.fromEntries(reconciliationRows.map((row: any) => [String(row.truck?._id || row.truck || row.truckId || ''), row])));
    const barTotals = reconciliationRows.reduce((totals: any, row: any) => ({
      taken: totals.taken + Number(row.taken || 0),
      sold: totals.sold + Number(row.sold || 0),
      remaining: totals.remaining + Number(row.remaining || 0),
    }), { taken: 0, sold: 0, remaining: 0, salesAmount: 0, pendingAmount: 0 });
    const visibleTruckIds = new Set(data.map((truck: Truck) => String(truck._id)));
    const moneyTotals = saleRows.reduce((totals: any, sale: any) => {
      if (!visibleTruckIds.has(saleTruckId(sale))) return totals;
      return {
        salesAmount: totals.salesAmount + Number(sale.totalAmount || 0),
        pendingAmount: totals.pendingAmount + Number(sale.balanceAmount || 0),
      };
    }, { salesAmount: 0, pendingAmount: 0 });
    const fuelRows = (Array.isArray(expenseResult?.records) ? expenseResult.records : []).filter((record: any) => {
      const category = String(record.costType || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const truckId = String(record.truck?._id || record.truck || '');
      return ['petrol', 'diesel', 'petrol_diesel'].includes(category) && visibleTruckIds.has(truckId);
    });
    const truckFuel: Record<string, { litres: number; cost: number }> = fuelRows.reduce((result: Record<string, { litres: number; cost: number }>, record: any) => {
      const truckId = String(record.truck?._id || record.truck || '');
      if (!truckId) return result;
      const current = result[truckId] || { litres: 0, cost: 0 };
      result[truckId] = {
        litres: current.litres + Number(record.fuelQuantity || 0),
        cost: current.cost + Number(record.amount || 0),
      };
      return result;
    }, {} as Record<string, { litres: number; cost: number }>);
    const fuelTotals = Object.values(truckFuel).reduce((total, fuel) => ({
      fuelLitres: total.fuelLitres + fuel.litres,
      fuelCost: total.fuelCost + fuel.cost,
    }), { fuelLitres: 0, fuelCost: 0 });
    setFuelByTruck(truckFuel);
    setDailyTotals({ ...barTotals, ...moneyTotals, ...fuelTotals });
    setAssignments(Object.fromEntries(assignmentRows.map((row: any) => [String(row.truck?._id || row.truck), Number(row.quantity || 0) + Number(row.pendingQuantity || 0)])));
    setAssignmentDetails(Object.fromEntries(assignmentRows.map((row: any) => [String(row.truck?._id || row.truck), row])));
    } catch (loadError: any) {
      setTrucks([]);
      setTruckStock({});
      setFuelByTruck({});
      setReconciliationByTruck({});
      setPageError(loadError?.response?.data?.message || loadError?.message || 'Could not load trucks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const storedBranch = window.localStorage.getItem('tii_selected_branch') || '';
    setSelectedBranch(isSuperAdmin ? storedBranch : (user?.branch || ''));
    if (isSuperAdmin) api.get('/branches')
      .then(({ data }) => {
        const activeBranches = (Array.isArray(data) ? data : []).filter((branch: any) => branch.isActive);
        setBranches(activeBranches);
        if (storedBranch && !activeBranches.some((branch: any) => branch._id === storedBranch)) {
          window.localStorage.removeItem('tii_selected_branch');
          setSelectedBranch('');
        }
      })
      .catch(() => setBranches([]));
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    void load();
  }, [authLoading, selectedBranch]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  const driverWorkers = useMemo(() => workers
    .filter((worker) => (worker.isActive !== false || workerTruckId(worker) === editing?._id)
      && (!workerTruckId(worker) || workerTruckId(worker) === editing?._id))
    .sort((a, b) => a.name.localeCompare(b.name)), [editing?._id, workers]);
  const activityByTruck = useMemo(() => Object.fromEntries(
    trucks.map((truck) => [truck._id, getTruckActivity(truck, reconciliationByTruck[truck._id])]),
  ) as Record<string, TruckActivity>, [reconciliationByTruck, trucks]);

  const visibleTrucks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return trucks.filter((truck) => {
      if (statusFilter !== 'all' && activityByTruck[truck._id]?.filter !== statusFilter) return false;
      if (!term) return true;
      const branch = typeof truck.branch === 'object' && truck.branch ? `${truck.branch.name} ${truck.branch.code}` : '';
      return [truck.truckName, truck.truckNumber, truck.driverName, truck.phoneNumber, truck.loginId, branch]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [activityByTruck, search, statusFilter, trucks]);

  const onlineTruckCount = trucks.filter((truck) => activityByTruck[truck._id]?.filter === 'online').length;
  const offlineTruckCount = trucks.length - onlineTruckCount;
  const totalTruckStock = Object.values(truckStock).reduce((total, quantity) => total + Number(quantity || 0), 0);

  const openCreate = () => {
    if (!canManageTrucks) return;
    setEditing(null);
    setForm({ ...emptyForm, branch: selectedBranch || '' });
    setSelectedDriverId('');
    setError('');
    setModalOpen(true);
  };

  const openAssignment = (truck: Truck) => {
    if (!canManageTrucks || !truck.status) return;
    setError('');
    setAssignTarget(truck);
  };

  const openPasswordReset = (truck: Truck) => {
    if (!canManageTrucks) return;
    setError('');
    setNewPassword('');
    setResetTarget(truck);
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') !== 'truck' || !canManageTrucks) return;
    setEditing(null);
    setForm({ ...emptyForm, branch: selectedBranch || '' });
    setSelectedDriverId('');
    setError('');
    setModalOpen(true);
    window.history.replaceState({}, '', window.location.pathname);
  }, [canManageTrucks, selectedBranch]);

  useEffect(() => {
    if (loading || !canManageTrucks || new URLSearchParams(window.location.search).get('assign') !== 'truck') return;
    setAssignChooserOpen(true);
    window.history.replaceState({}, '', window.location.pathname);
  }, [canManageTrucks, loading]);

  const openEdit = (t: Truck) => {
    const assignedWorker = workers.find((worker) => workerTruckId(worker) === t._id) || null;
    setEditing(t);
    setSelectedDriverId(assignedWorker?._id || '');
    setForm({
      truckName: t.truckName,
      truckNumber: t.truckNumber,
      driverName: assignedWorker?.name || t.driverName,
      phoneNumber: assignedWorker?.phoneNumber || t.phoneNumber,
      worker: assignedWorker?._id || '',
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTrucks) return;
    setError('');
    const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
    const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
    const selectedWorker = driverWorkers.find((worker) => worker._id === selectedDriverId);
    if (!selectedWorker) { setError('Select an available worker to drive this truck.'); return; }
    const driverPhone = phone(selectedWorker.phoneNumber);
    if (!text(form.truckName) || !text(form.truckNumber)) { setError('Enter the truck name and vehicle number.'); return; }
    if (driverPhone.length !== 10) { setError('The selected worker must have a valid 10-digit phone number. Update it on the Workers page first.'); return; }
    if (!editing && isSuperAdmin && !form.branch) { setError('Select the branch for this truck.'); return; }
    const truckPayload = {
      ...form,
      worker: selectedWorker._id,
      driverName: selectedWorker.name,
      phoneNumber: selectedWorker.phoneNumber || '',
    };
    const duplicate = trucks.find((truck) => truck._id !== editing?._id && (
      text(truck.truckName) === text(truckPayload.truckName) || text(truck.truckNumber) === text(truckPayload.truckNumber) ||
      (truckPayload.phoneNumber && phone(truck.phoneNumber) === phone(truckPayload.phoneNumber)) ||
      (truckPayload.loginId && text(truck.loginId) === text(truckPayload.loginId))
    ));
    if (duplicate) { setError('Truck name, vehicle number, phone number, and login ID must be unique.'); return; }
    setSubmitting(true);
    try {
      if (editing) {
        await api.patch(`/trucks/${editing._id}`, truckPayload);
      } else {
        await api.post('/trucks', truckPayload);
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not save the truck.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (t: Truck) => {
    if (!canManageTrucks) return;
    setPageError('');
    try {
      await api.patch(`/trucks/${t._id}/${t.status ? 'deactivate' : 'activate'}`);
      await load();
    } catch (actionError: any) {
      setPageError(actionError?.response?.data?.message || 'Could not update the truck status.');
    }
  };

  const remove = async (t: Truck) => {
    if (!canManageTrucks) return;
    if (!confirm(`Delete truck "${t.truckName}"? This also removes its login.`)) return;
    setPageError('');
    try {
      await api.delete(`/trucks/${t._id}`);
      await load();
    } catch (actionError: any) {
      setPageError(actionError?.response?.data?.message || 'Could not delete the truck.');
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !canManageTrucks) return;
    setError('');
    try {
      await api.patch(`/trucks/${resetTarget._id}/reset-password`, { newPassword });
      setResetTarget(null);
      setNewPassword('');
    } catch (actionError: any) {
      setError(actionError?.response?.data?.message || 'Could not reset the truck password.');
    }
  };

  const saveAssignment = async (t: Truck) => {
    if (!canManageTrucks) return;
    const raw = assignInputs[t._id];
    const addQty = Number(raw || 0);
    if (!addQty || addQty <= 0) return;
    const quantity = Number(assignments[t._id] || 0) + addQty;
    setSavingAssign(t._id);
    try {
      await api.post('/truck-assignments', { truck: t._id, date: indiaDateISO(), quantity });
      setAssignments({ ...assignments, [t._id]: quantity });
      setAssignInputs({ ...assignInputs, [t._id]: '' });
    } catch (actionError: any) {
      setError(actionError?.response?.data?.message || 'Could not assign bars to the truck.');
    } finally {
      setSavingAssign('');
    }
  };

  const saveTotalEdit = async (t: Truck) => {
    if (!canManageTrucks) return;
    const raw = totalInputs[t._id];
    const current = Number(assignments[t._id] || 0);
    const quantity = raw === undefined ? current : Number(raw) || 0;
    if (quantity !== current) {
      setSavingAssign(t._id);
      try {
        await api.post('/truck-assignments', { truck: t._id, date: indiaDateISO(), quantity });
        setAssignments({ ...assignments, [t._id]: quantity });
      } catch (actionError: any) {
        setError(actionError?.response?.data?.message || 'Could not update the truck assignment.');
        return;
      } finally {
        setSavingAssign('');
      }
    }
    closeAssignModal(t._id);
  };

  const clearAssignment = async (t: Truck) => {
    if (!canManageTrucks) return;
    if (!Number(assignments[t._id] || 0)) return;
    if (!confirm(`Clear today's assigned bars for "${t.truckName}"?`)) return;
    setSavingAssign(t._id);
    try {
      await api.post('/truck-assignments', { truck: t._id, date: indiaDateISO(), quantity: 0 });
      setAssignments({ ...assignments, [t._id]: 0 });
      setTotalInputs((prev) => { const next = { ...prev }; delete next[t._id]; return next; });
    } catch (actionError: any) {
      setError(actionError?.response?.data?.message || 'Could not clear the truck assignment.');
    } finally {
      setSavingAssign('');
    }
  };

  const cancelAssignmentRequest = async (t: Truck) => {
    if (!canManageTrucks) return;
    const assignment = assignmentDetails[t._id];
    if (!assignment?._id || Number(assignment.pendingQuantity || 0) <= 0) return;
    setSavingAssign(t._id);
    try {
      const { data } = await api.post(`/truck-assignments/${assignment._id}/cancel`);
      setAssignmentDetails({ ...assignmentDetails, [t._id]: data });
      setAssignments({ ...assignments, [t._id]: Number(data.quantity || 0) });
    } catch (actionError: any) {
      setError(actionError?.response?.data?.message || 'Could not cancel the assignment request.');
    } finally {
      setSavingAssign('');
    }
  };

  const closeAssignModal = (truckId: string) => {
    setAssignTarget(null);
    setAssignInputs((prev) => { const next = { ...prev }; delete next[truckId]; return next; });
    setTotalInputs((prev) => { const next = { ...prev }; delete next[truckId]; return next; });
  };

  const openTripCheck = async (truck: Truck) => {
    setLoadTarget(truck); setTripCheck(null); setError('');
    try { const { data } = await api.get('/truck-loads/reconciliation', { params: { truck: truck._id, date: loadForm.date } }); setTripCheck(data[0] || { truckId: truck._id, date: loadForm.date, taken: 0, sold: 0, returned: 0, wastage: 0, remaining: 0, checked: false }); }
    catch (err: any) { setError(err?.response?.data?.message || 'Could not load truck check'); }
  };
  const approveTrip = async () => {
    if (!loadTarget || !tripCheck || !canManageTrucks) return;
    setError('');
    try {
      await api.post('/truck-loads/reconciliation/check', { truck: loadTarget._id, date: loadForm.date });
      setTripCheck({ ...tripCheck, checked: true, checkedAt: new Date().toISOString() });
    } catch (actionError: any) {
      setError(actionError?.response?.data?.message || 'Could not approve the daily truck account.');
    }
  };

  const loadHistory = async (truck: Truck, range: { from: string; to: string }) => {
    setHistoryLoading(true);
    setError('');
    try {
      const params = { truck: truck._id, from: range.from, to: range.to };
      const [loadRows, saleRows] = await Promise.all([
        api.get('/truck-loads', { params }),
        api.get('/sales', { params }),
      ]);
      const byDate: Record<string, { date: string; taken: number; sold: number; salesAmount: number; pendingAmount: number }> = {};
      const ensure = (date: string) => byDate[date] ||= { date, taken: 0, sold: 0, salesAmount: 0, pendingAmount: 0 };
      for (const row of (Array.isArray(loadRows.data) ? loadRows.data : [])) ensure(String(row.date).slice(0, 10)).taken += Number(row.quantity || 0);
      for (const sale of (Array.isArray(saleRows.data) ? saleRows.data : [])) {
        if (saleTruckId(sale) !== truck._id) continue;
        const row = ensure(String(sale.date).slice(0, 10));
        row.sold += (sale.items || []).reduce((sum: number, item: any) => sum + getItemBarUsed(item), 0);
        row.salesAmount += Number(sale.totalAmount || 0);
        row.pendingAmount += Number(sale.balanceAmount || 0);
      }
      setHistoryRows(Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load truck history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = (truck: Truck) => {
    setHistoryTarget(truck);
    setHistoryRows([]);
    loadHistory(truck, historyRange);
  };

  if (authLoading || selectedBranch === null) {
    return (
      <div className="space-y-5">
        <div className="h-56 animate-pulse rounded-[2rem] bg-navy-900/90" />
        <div className="h-14 animate-pulse rounded-2xl bg-white/70" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/70" />)}
        </div>
        <div className="h-96 animate-pulse rounded-3xl bg-white/70" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-iceblue-100">
              {isSuperAdmin ? <FiShield /> : <FiLock />}
              {isSuperAdmin ? 'Super admin fleet centre' : 'Branch fleet workspace'}
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Truck operations</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {overallView
                ? `Monitor fleet activity, stock, fuel, and collections across ${branches.length} branches.`
                : `Manage truck access, drivers, daily bar assignments, and account checks for ${scopeName}.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiGitBranch className="text-iceblue-300" />{scopeName}</span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiTruck className="text-emerald-300" />{onlineTruckCount} online of {trucks.length}</span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiBox className="text-cyan-300" />{totalTruckStock.toLocaleString('en-IN')} bars on trucks</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50 disabled:opacity-60"><FiRefreshCcw className={loading ? 'animate-spin' : ''} /> Refresh</button>
            {canManageTrucks && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-iceblue-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-iceblue-400"><FiPlus /> Add truck</button>}
          </div>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-white/80 bg-white/90 p-2.5 shadow-[0_14px_40px_-30px_rgba(15,43,61,0.4)] backdrop-blur-sm">
          <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => changeBranch('')} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${overallView ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><FiGrid /> All branches <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${overallView ? 'bg-white/10' : 'bg-slate-100'}`}>{branches.length}</span></button>
            <span className="h-6 w-px shrink-0 bg-slate-200" />
            {branches.map((branch) => (
              <button key={branch._id} type="button" onClick={() => changeBranch(branch._id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${selectedBranch === branch._id ? 'bg-iceblue-50 text-iceblue-700 ring-1 ring-inset ring-iceblue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'}`}><span className="h-2 w-2 rounded-full bg-emerald-500" />{branch.name}<span className="text-[9px] font-semibold text-slate-400">{branch.code}</span></button>
            ))}
          </div>
        </section>
      ) : (
        <section className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${canManageTrucks ? 'border-emerald-100 bg-emerald-50/70' : 'border-red-100 bg-red-50/70'}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm ${canManageTrucks ? 'text-emerald-600' : 'text-red-600'}`}>{canManageTrucks ? <FiCheckCircle /> : <FiAlertTriangle />}</span>
          <div><p className="text-xs font-extrabold text-navy-900">{canManageTrucks ? 'Assigned branch ready' : 'No branch assigned'}</p><p className="mt-0.5 text-[10px] text-slate-500">{canManageTrucks ? 'Truck changes and daily operations are automatically recorded under your branch.' : 'Ask a super admin to assign your account to a branch before managing trucks.'}</p></div>
        </section>
      )}

      {overallView && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><FiLock /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Network fleet view is read-only</p><p className="mt-1 text-[10px] leading-4 text-slate-600">Review consolidated fleet performance and history here. Select a branch before adding trucks, assigning bars, approving accounts, or changing access.</p></div>
        </section>
      )}

      {pageError && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">{pageError}</div>}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><FiTruck /></span><div><h2 className="font-extrabold text-navy-900">Today&apos;s fleet snapshot</h2><p className="text-xs text-slate-500">Operational totals for {scopeName.toLowerCase()}.</p></div></div>
          <span className="shrink-0 rounded-full bg-iceblue-50 px-3 py-1.5 text-[10px] font-bold text-iceblue-700">{new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <DailyCard icon={FiBox} label="Bars dispatched" value={dailyTotals.taken} helper="Loaded today" tone="blue" />
          <DailyCard icon={FiCheckCircle} label="Bars sold" value={dailyTotals.sold} helper="Delivered today" tone="emerald" />
          <DailyCard icon={FiTruck} label="Remaining" value={dailyTotals.remaining} helper="Expected on trucks" tone="cyan" danger={dailyTotals.remaining < 0} />
          <DailyCard icon={FiDollarSign} label="Sales amount" value={formatCurrency(dailyTotals.salesAmount)} helper="Billed today" tone="violet" />
          <DailyCard icon={FiAlertTriangle} label="Pending amount" value={formatCurrency(dailyTotals.pendingAmount)} helper="Collection due" tone="amber" danger={dailyTotals.pendingAmount > 0} />
          <DailyCard icon={FiDroplet} label="Fuel used" value={`${dailyTotals.fuelLitres.toLocaleString('en-IN')} L`} helper="Recorded today" tone="cyan" />
          <DailyCard icon={FiDollarSign} label="Fuel cost" value={formatCurrency(dailyTotals.fuelCost)} helper="Recorded today" tone="slate" />
        </div>
      </section>
      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="border-b border-slate-100 p-4 lg:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="mr-auto flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-iceblue-50 text-iceblue-600"><FiTruck /></span>
              <div><h2 className="font-extrabold text-navy-900">Registered trucks</h2><p className="text-xs text-slate-500">{trucks.length} total · {onlineTruckCount} online · {offlineTruckCount} offline</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-80">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input-field h-10 pl-9" placeholder="Search truck, driver, phone..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1">
                {(['all', 'online', 'offline'] as const).map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-lg px-3 py-2 text-[10px] font-bold capitalize transition ${statusFilter === status ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900'}`}>{status}</button>)}
              </div>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 p-5"><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /></div>
        ) : (
          <>
            <div className="grid gap-3 p-4 sm:hidden">
              {visibleTrucks.map((t, index) => (
                <article key={t._id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold tabular-nums text-iceblue-600 shadow-sm ring-1 ring-slate-100">{index + 1}</span>
                        <Link href={`/admin/trucks/${t._id}`} className="min-w-0 truncate font-extrabold text-navy-900 hover:text-iceblue-700">
                          {t.truckName}
                        </Link>
                      </div>
                      <p className="mt-1 pl-10 text-xs font-semibold text-slate-500">{t.truckNumber}</p>
                      <p className="mt-0.5 pl-10 font-mono text-[10px] font-semibold text-slate-400">Login: {t.loginId || 'Not configured'}</p>
                      {overallView && <p className="mt-0.5 pl-10 text-[10px] font-bold text-iceblue-700">{typeof t.branch === 'object' ? `${t.branch.name} · ${t.branch.code}` : 'Branch not available'}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${activityByTruck[t._id]?.tone || 'bg-slate-100 text-slate-600'}`}>
                      {activityByTruck[t._id]?.label || 'Offline'}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-y border-slate-100 py-3 text-xs">
                    <div className="col-span-2"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Driver</p><p className="mt-1 font-bold text-navy-900">{t.driverName || 'Not assigned'}</p><p className="mt-0.5 break-all text-[11px] font-semibold text-slate-500">{t.phoneNumber || 'Phone not configured'}</p></div>
                    <p className="text-navy-800/55">Ice Bars: <span className="font-bold text-navy-900">{truckStock[t._id] || 0}</span></p>
                    <p className="text-navy-800/55">Fuel: <span className="font-bold text-navy-900">{(fuelByTruck[t._id]?.litres || 0).toLocaleString('en-IN')} L</span></p>
                    <p className="text-navy-800/55">Fuel Cost: <span className="font-bold text-navy-900">{formatCurrency(fuelByTruck[t._id]?.cost || 0)}</span></p>
                  </div>
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openHistory(t)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-extrabold text-slate-600 shadow-sm transition hover:border-iceblue-200 hover:text-iceblue-700"><FiClock /> History</button>
                      {canManageTrucks && <>
                        <button type="button" disabled={!t.status} onClick={() => openAssignment(t)} className="inline-flex items-center gap-1.5 rounded-xl bg-iceblue-600 px-3 py-2 text-[10px] font-extrabold text-white shadow-sm transition hover:bg-iceblue-700 disabled:cursor-not-allowed disabled:opacity-40"><FiBox /> Assign</button>
                        <button type="button" onClick={() => openTripCheck(t)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-extrabold text-white shadow-sm transition hover:bg-emerald-700"><FiCheckCircle /> Daily check</button>
                      </>}
                    </div>
                    {canManageTrucks && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <span className="mr-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Manage</span>
                      <button type="button" title="Edit truck" aria-label={`Edit ${t.truckName}`} onClick={() => openEdit(t)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-200"><FiEdit2 /> Edit</button>
                      <button type="button" title="Reset password" aria-label={`Reset ${t.truckName} password`} onClick={() => openPasswordReset(t)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-2 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100"><FiKey /> Password</button>
                      <button type="button" title={t.status ? 'Disable truck login' : 'Enable truck login'} aria-label={t.status ? `Disable ${t.truckName} login` : `Enable ${t.truckName} login`} onClick={() => void toggleStatus(t)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-bold transition ${t.status ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}><FiPower /> Login</button>
                      <button type="button" title="Delete truck" aria-label={`Delete ${t.truckName}`} onClick={() => void remove(t)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-100"><FiTrash2 /> Delete</button>
                    </div>}
                  </div>
                </article>
              ))}
              {visibleTrucks.length === 0 && (
                <div className="px-4 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm"><FiTruck /></span><p className="mt-3 text-sm font-bold text-navy-900">{search || statusFilter !== 'all' ? 'No matching trucks' : 'No trucks registered'}</p><p className="mt-1 text-xs text-slate-500">{search || statusFilter !== 'all' ? 'Try changing the search or status filter.' : 'Add a truck to begin fleet operations.'}</p></div>
              )}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[1050px] table-fixed border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-navy-900">
                  <tr>
                    <th className="w-[5%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
                    {overallView && <th className="w-[10%] break-words border border-slate-200 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Branch</th>}
                    <th className="w-[16%] break-words border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Truck</th>
                    <th className="w-[17%] break-words border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Driver</th>
                    <th className="w-[8%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Ice Bars</th>
                    <th className="w-[12%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Fuel Cost / Status</th>
                    <th className="w-[25%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTrucks.map((t, index) => (
                    <tr key={t._id} className="transition even:bg-slate-50/60 hover:bg-iceblue-50/70">
                      <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                      {overallView && <td className="break-words border border-slate-200 px-2 py-3 text-center text-navy-900">{typeof t.branch === 'object' ? `${t.branch.name} (${t.branch.code})` : '-'}</td>}
                      <td className="break-words border border-slate-300 px-2 py-3">
                        <Link href={`/admin/trucks/${t._id}`} className="font-bold text-navy-900 underline-offset-2 hover:text-iceblue-700 hover:underline">
                          {t.truckName}
                        </Link>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t.truckNumber || 'Number not configured'}</p>
                        <p className="mt-1 break-all font-mono text-[10px] font-semibold text-slate-400">Login: {t.loginId || 'Not configured'}</p>
                      </td>
                      <td className="break-words border border-slate-300 px-2 py-3"><p className="font-bold text-navy-900">{t.driverName || 'Not assigned'}</p><p className="mt-1 break-all text-[10px] font-semibold text-slate-500">{t.phoneNumber || 'Phone not configured'}</p></td>
                      <td className="border border-slate-300 px-1 py-3 text-center font-bold text-navy-900">{truckStock[t._id] || 0}</td>
                      <td className="border border-slate-300 px-2 py-3 text-center">
                        <p className="font-bold text-navy-900">{formatCurrency(fuelByTruck[t._id]?.cost || 0)}</p>
                        <span className={`mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${activityByTruck[t._id]?.tone || 'bg-slate-100 text-slate-600'}`}>
                          {activityByTruck[t._id]?.label || 'Offline'}
                        </span>
                      </td>
                      <td className="border border-slate-300 px-2 py-3">
                        <div className="flex flex-wrap justify-center gap-1.5">
                          <button type="button" onClick={() => openHistory(t)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-extrabold text-slate-600 shadow-sm transition hover:text-iceblue-700"><FiClock /> History</button>
                          {canManageTrucks && <>
                            <button type="button" disabled={!t.status} onClick={() => openAssignment(t)} className="inline-flex items-center gap-1 rounded-lg bg-iceblue-600 px-2 py-1.5 text-[9px] font-extrabold text-white transition hover:bg-iceblue-700 disabled:opacity-40"><FiBox /> Assign</button>
                            <button type="button" onClick={() => openTripCheck(t)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[9px] font-extrabold text-white transition hover:bg-emerald-700"><FiCheckCircle /> Check</button>
                          </>}
                        </div>
                        {canManageTrucks && <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-100 pt-2">
                          <button type="button" title="Edit truck" aria-label={`Edit ${t.truckName}`} onClick={() => openEdit(t)} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"><FiEdit2 /></button>
                          <button type="button" title="Reset password" aria-label={`Reset ${t.truckName} password`} onClick={() => openPasswordReset(t)} className="grid h-7 w-7 place-items-center rounded-lg bg-violet-50 text-violet-700 transition hover:bg-violet-100"><FiKey /></button>
                          <button type="button" title={t.status ? 'Disable truck login' : 'Enable truck login'} aria-label={t.status ? `Disable ${t.truckName} login` : `Enable ${t.truckName} login`} onClick={() => void toggleStatus(t)} className={`grid h-7 w-7 place-items-center rounded-lg transition ${t.status ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}><FiPower /></button>
                          <button type="button" title="Delete truck" aria-label={`Delete ${t.truckName}`} onClick={() => void remove(t)} className="grid h-7 w-7 place-items-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"><FiTrash2 /></button>
                        </div>}
                      </td>
                    </tr>
                  ))}
                  {visibleTrucks.length === 0 && (
                    <tr><td colSpan={overallView ? 7 : 6} className="border border-slate-200 px-4 py-12 text-center text-navy-800/50">{search || statusFilter !== 'all' ? 'No trucks match the current filters.' : 'No trucks registered.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <Modal title={editing ? 'Edit Truck' : 'Add Truck'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            {!editing && user?.role === 'super_admin' && <div>
              <label className="label-text">Branch</label>
              <select className="input-field" required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                <option value="">Select branch</option>
                {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
              </select>
            </div>}
            <div>
              <label className="label-text">Truck Name</label>
              <input className="input-field" required value={form.truckName} onChange={(e) => setForm({ ...form, truckName: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Truck Number</label>
              <input className="input-field" required value={form.truckNumber} onChange={(e) => setForm({ ...form, truckNumber: e.target.value })} />
            </div>
            {!editing && (
              <>
                <div>
                  <label className="label-text">Login ID</label>
                  <input className="input-field" required value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} />
                </div>
                <div>
                  <label className="label-text">Password</label>
                  <input type="password" className="input-field" required minLength={4} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            <div>
              <label className="label-text">{editing ? 'Assigned Driver' : 'Assign Driver'}</label>
              <select
                className="input-field"
                required
                value={selectedDriverId}
                onChange={(e) => {
                  setSelectedDriverId(e.target.value);
                  const selected = driverWorkers.find((worker) => worker._id === e.target.value);
                  setForm({ ...form, worker: selected?._id || '', driverName: selected?.name || '', phoneNumber: selected?.phoneNumber || '' });
                }}
              >
                <option value="">Select an available worker</option>
                {driverWorkers.map((worker) => (
                  <option key={worker._id} value={worker._id}>{worker.name}{worker.role ? ` (${worker.role})` : ''}{worker.phoneNumber ? ` - ${worker.phoneNumber}` : ''}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                {editing ? 'Selecting another worker unassigns the current driver; it does not delete or deactivate them.' : 'Only existing, unassigned workers are listed. Truck creation never creates a worker.'}
              </p>
              {driverWorkers.length === 0 && <p className="mt-2 text-xs font-semibold text-amber-700">No available workers. <Link href="/admin/workers" className="underline">Create a worker</Link> first.</p>}
            </div>
            {selectedDriverId && <div className="rounded-2xl border border-iceblue-100 bg-iceblue-50/60 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-iceblue-600">Selected worker</p>
              <p className="mt-1 font-extrabold text-navy-900">{form.driverName}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{form.phoneNumber || 'Phone number not configured'}</p>
            </div>}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button disabled={submitting} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Saving truck...' : editing ? 'Save Changes' : 'Create Truck'}</button>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset Password: ${resetTarget.truckName}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={submitReset} className="space-y-3">
            <div>
              <label className="label-text">New Password</label>
              <input type="password" className="input-field" required minLength={4} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <button className="btn-primary w-full">Reset Password</button>
          </form>
        </Modal>
      )}

      {assignChooserOpen && (
        <Modal title="Assign Truck" onClose={() => setAssignChooserOpen(false)}>
          <div className="space-y-2">
            <p className="pb-2 text-sm text-navy-800/55">Select a truck to assign today&apos;s bars.</p>
            {trucks.filter((truck) => truck.status !== false).map((truck) => (
              <button
                key={truck._id}
                type="button"
                 onClick={() => { setAssignChooserOpen(false); openAssignment(truck); }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-iceblue-300 hover:bg-iceblue-50"
              >
                <span>
                  <span className="block font-semibold text-navy-900">{truck.truckName}</span>
                  <span className="mt-0.5 block text-xs text-navy-800/45">{truck.truckNumber || truck.driverName || 'Truck'}</span>
                </span>
                <span className="text-xs font-bold text-iceblue-700">{assignments[truck._id] || 0} bars</span>
              </button>
            ))}
            {trucks.filter((truck) => truck.status !== false).length === 0 && (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-navy-800/45">No online trucks available.</p>
            )}
          </div>
        </Modal>
      )}

      {assignTarget && (
        <Modal title={`Today's Bars: ${assignTarget.truckName}`} onClose={() => closeAssignModal(assignTarget._id)}>
          <div className="space-y-5">
            <div className="rounded-2xl bg-iceblue-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase text-navy-800/45">Assigned Today</p>
              <p className="mt-1 font-display text-3xl font-bold text-navy-900">{assignments[assignTarget._id] || 0} bars</p>
              {Number(assignmentDetails[assignTarget._id]?.pendingQuantity || 0) > 0 && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-800">
                  <p className="font-semibold">Waiting for driver acceptance</p>
                  <p className="mt-1 text-sm">Pending: {assignmentDetails[assignTarget._id].pendingQuantity} bars</p>
                  <button type="button" onClick={() => void cancelAssignmentRequest(assignTarget)} disabled={savingAssign === assignTarget._id} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">
                    <FiTrash2 /> {savingAssign === assignTarget._id ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="label-text">Add Bars</label>
              <div className="flex flex-wrap gap-2">
                {['0.25', '0.50', '0.75', '1'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAssignInputs({ ...assignInputs, [assignTarget._id]: val })}
                    className={`pill ${assignInputs[assignTarget._id] === val ? 'bg-iceblue-600 text-white' : 'bg-iceblue-50 text-iceblue-700 hover:bg-iceblue-100'}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  placeholder="Quantity"
                  className="input-field h-11 flex-1"
                  value={assignInputs[assignTarget._id] ?? ''}
                  onChange={(e) => setAssignInputs({ ...assignInputs, [assignTarget._id]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => saveAssignment(assignTarget)}
                  disabled={savingAssign === assignTarget._id}
                  className="btn-primary flex shrink-0 items-center gap-2 px-5 disabled:opacity-50"
                >
                  <FiCheck /> Add
                </button>
              </div>
            </div>

            <div>
              <label className="label-text">Set Exact Total</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  className="input-field h-11 flex-1"
                  value={totalInputs[assignTarget._id] ?? String(assignments[assignTarget._id] || 0)}
                  onChange={(e) => setTotalInputs({ ...totalInputs, [assignTarget._id]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => saveTotalEdit(assignTarget)}
                  disabled={savingAssign === assignTarget._id}
                  className="btn-secondary shrink-0 px-5 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="button"
              onClick={() => clearAssignment(assignTarget)}
              disabled={savingAssign === assignTarget._id || !assignments[assignTarget._id]}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <FiTrash2 /> Clear Today&apos;s Assignment
            </button>
          </div>
        </Modal>
      )}

      {loadTarget && (
        <Modal title={`Daily Check: ${loadTarget.truckName}`} onClose={() => setLoadTarget(null)}>
          <div className="space-y-4">
            <div><label className="label-text">Date</label><input type="date" className="input-field" value={loadForm.date} onChange={async (e) => { const date = e.target.value; setLoadForm({...loadForm, date}); setTripCheck(null); const { data } = await api.get('/truck-loads/reconciliation', { params: { truck: loadTarget._id, date } }); setTripCheck(data[0] || { truckId: loadTarget._id, date, taken: 0, sold: 0, returned: 0, wastage: 0, remaining: 0, checked: false }); }} /></div>
            {tripCheck && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[['Taken', tripCheck.taken], ['Sold', tripCheck.sold], ['Returned', tripCheck.returned], ['Wastage', tripCheck.wastage], ['Remaining', tripCheck.remaining]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-iceblue-50 p-3"><p className="text-xs font-semibold uppercase text-navy-800/45">{label}</p><p className="mt-1 text-xl font-bold text-navy-900">{value}</p></div>)}
            </div>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {tripCheck?.checked ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-center font-semibold text-emerald-700">Checked by admin</p> : <button onClick={approveTrip} disabled={!tripCheck || !tripCheck.taken} className="btn-primary w-full disabled:opacity-50">Check & Approve Daily Account</button>}
          </div>
        </Modal>
      )}

      {historyTarget && (
        <Modal title={`Daily History: ${historyTarget.truckName}`} onClose={() => setHistoryTarget(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-iceblue-50 p-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Truck</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.truckName}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Truck Number</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.truckNumber}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Driver</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.driverName}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Phone</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.phoneNumber}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Login ID</p>
                <p className="mt-1 font-bold text-navy-900">{historyTarget.loginId}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Ice Bars In Truck</p>
                <p className={`mt-1 font-bold ${(truckStock[historyTarget._id] || 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{truckStock[historyTarget._id] || 0}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label-text">From</label>
                <input type="date" className="input-field" value={historyRange.from} onChange={(e) => setHistoryRange({ ...historyRange, from: e.target.value })} />
              </div>
              <div>
                <label className="label-text">To</label>
                <input type="date" className="input-field" value={historyRange.to} onChange={(e) => setHistoryRange({ ...historyRange, to: e.target.value })} />
              </div>
              <button type="button" onClick={() => loadHistory(historyTarget, historyRange)} className="btn-secondary">Apply</button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div>
              {historyLoading ? (
                <p className="text-navy-800/50">Loading...</p>
              ) : (
                <>
                  <div className="sm:hidden">
                    {historyRows.map((row) => (
                      <div key={row.date} className="border-b border-slate-100 py-3 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-navy-900">{formatDate(row.date)}</p>
                          <p className="shrink-0 text-sm font-semibold text-navy-900">{formatCurrency(row.salesAmount)}</p>
                        </div>
                        <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                          <p className="text-navy-800/55">Taken: <span className="font-semibold text-navy-900">{row.taken}</span></p>
                          <p className="text-navy-800/55">Sold: <span className="font-semibold text-navy-900">{row.sold}</span></p>
                          <p className="text-navy-800/55">Pending: <span className={row.pendingAmount > 0 ? 'font-semibold text-red-500' : 'font-semibold text-navy-900'}>{formatCurrency(row.pendingAmount)}</span></p>
                        </div>
                      </div>
                    ))}
                    {historyRows.length === 0 && (
                      <p className="py-4 text-center text-sm text-navy-800/50">No records for the selected range.</p>
                    )}
                    {historyRows.length > 0 && (
                      <div className="border-t border-slate-200 pt-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-navy-900">Total</p>
                          <p className="shrink-0 text-sm font-semibold text-navy-900">{formatCurrency(historyRows.reduce((sum, row) => sum + row.salesAmount, 0))}</p>
                        </div>
                        <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                          <p className="text-navy-800/55">Taken: <span className="font-semibold text-navy-900">{historyRows.reduce((sum, row) => sum + row.taken, 0)}</span></p>
                          <p className="text-navy-800/55">Sold: <span className="font-semibold text-navy-900">{historyRows.reduce((sum, row) => sum + row.sold, 0)}</span></p>
                          <p className="text-navy-800/55">Pending: <span className="font-semibold text-navy-900">{formatCurrency(historyRows.reduce((sum, row) => sum + row.pendingAmount, 0))}</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="table-base min-w-[600px]">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Bars Taken</th>
                          <th>Bars Sold</th>
                          <th>Selling Amount</th>
                          <th>Pending Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((row) => (
                          <tr key={row.date}>
                            <td>{formatDate(row.date)}</td>
                            <td>{row.taken}</td>
                            <td>{row.sold}</td>
                            <td className="font-semibold">{formatCurrency(row.salesAmount)}</td>
                            <td className={row.pendingAmount > 0 ? 'font-semibold text-red-500' : ''}>{formatCurrency(row.pendingAmount)}</td>
                          </tr>
                        ))}
                        {historyRows.length === 0 && (
                          <tr><td colSpan={5} className="py-4 text-center text-navy-800/50">No records for the selected range.</td></tr>
                        )}
                      </tbody>
                      {historyRows.length > 0 && (
                        <tfoot>
                          <tr className="font-semibold">
                            <td>Total</td>
                            <td>{historyRows.reduce((sum, row) => sum + row.taken, 0)}</td>
                            <td>{historyRows.reduce((sum, row) => sum + row.sold, 0)}</td>
                            <td>{formatCurrency(historyRows.reduce((sum, row) => sum + row.salesAmount, 0))}</td>
                            <td>{formatCurrency(historyRows.reduce((sum, row) => sum + row.pendingAmount, 0))}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DailyCard({ icon: Icon, label, value, helper, tone, danger = false }: { icon: any; label: string; value: string | number; helper: string; tone: 'blue' | 'cyan' | 'emerald' | 'violet' | 'amber' | 'slate'; danger?: boolean }) {
  const tones = {
    blue: 'bg-iceblue-50 text-iceblue-600 ring-iceblue-100',
    cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    slate: 'bg-slate-50 text-slate-500 ring-slate-100',
  };
  return <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,43,61,0.5)]">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p><p className={`mt-2 break-words text-lg font-black tracking-tight ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p></div><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}><Icon /></span></div>
    <p className="mt-2 text-[10px] font-medium text-slate-400">{helper}</p>
  </div>;
}
