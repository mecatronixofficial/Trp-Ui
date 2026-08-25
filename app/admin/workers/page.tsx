'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiDollarSign,
  FiEdit2,
  FiGitBranch,
  FiGrid,
  FiLock,
  FiPhone,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiTruck,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/api';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../context/AuthContext';
import { selectedBranchHeaders } from '../../../lib/branch-fetch';

type Branch = {
  _id: string;
  name: string;
  code: string;
  isActive?: boolean;
};

type Worker = {
  _id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  notes?: string;
  truck?: string | { _id: string; truckName?: string };
  branch?: string | Branch;
  isActive?: boolean;
};

const emptyWorkerForm = { name: '', phoneNumber: '', role: '', notes: '' };
const WORKER_ROLE_OPTIONS = ['Driver', 'Cleaner', 'Manager'];
const indiaToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const emptyBuyingForm = { worker: '', date: indiaToday(), buyingAmount: '', notes: '' };

const formatEntryDateTime = (value: string | Date) => new Date(value).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function currentMonth() {
  return indiaToday().slice(0, 7);
}

function monthRange(month: string) {
  const start = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const finalDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const end = `${month}-${String(finalDay).padStart(2, '0')}`;
  return { from: start, to: end };
}

const isAdvanceExpense = (record: any) => {
  const category = String(record?.costType || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return ['advance', 'employee_advance', 'advance_employee', 'advance_for_employee'].includes(category);
};

const referenceId = (value: unknown) => {
  if (value && typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id || '');
  return String(value || '');
};
const workerIdentity = (worker?: Pick<Worker, 'name' | 'role'> | null) =>
  worker ? `${worker.name}${worker.role ? ` (${worker.role})` : ''}` : '';
const isTodayAmount = (value: string | Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value)) === indiaToday();

async function fetchExpenseRecords(query = '') {
  try {
    const response = await fetch(`/api/expenses${query ? `?${query}` : ''}`, { cache: 'no-store', headers: selectedBranchHeaders() });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.records) ? payload.records : [];
  } catch {
    return [];
  }
}

export default function WorkersPage() {
  const { user, loading: authLoading } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<any[]>([]);
  const [advanceExpenses, setAdvanceExpenses] = useState<any[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [buyingModalOpen, setBuyingModalOpen] = useState(false);
  const [editingBuying, setEditingBuying] = useState<any | null>(null);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [driverDetailTarget, setDriverDetailTarget] = useState<any | null>(null);
  const [workerDetailTarget, setWorkerDetailTarget] = useState<any | null>(null);
  const [workerDetailRange, setWorkerDetailRange] = useState(monthRange(currentMonth()));
  const [workerDetailRows, setWorkerDetailRows] = useState<any[]>([]);
  const [workerDetailLoading, setWorkerDetailLoading] = useState(false);
  const [workerForm, setWorkerForm] = useState<any>(emptyWorkerForm);
  const [roleMode, setRoleMode] = useState('');
  const [buyingForm, setBuyingForm] = useState<any>(emptyBuyingForm);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [recentBuying, setRecentBuying] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'available'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageWorkers = Boolean(selectedBranch);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);
  const assignedBranch = workers.find((worker) => worker.branch && typeof worker.branch === 'object')?.branch as Branch | undefined;
  const overallView = Boolean(isSuperAdmin && !selectedBranch);
  const scopeBranch = activeBranch || assignedBranch;
  const scopeName = scopeBranch ? `${scopeBranch.name} (${scopeBranch.code})` : isSuperAdmin ? 'All branches' : 'Assigned branch';

  const load = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const { from, to } = monthRange(month);
      const [year, monthNumber] = month.split('-');
      const [workerRows, summaryRows, driverRows, expenseRows, recentRows, advanceRows, todayAdvanceRows] = await Promise.all([
        api.get('/workers'),
        api.get('/workers/summary', { params: { month } }),
        api.get('/trucks'),
        api.get('/driver-expenses', { params: { from, to } }),
        api.get('/workers/buying', { params: { from: indiaToday(), to: indiaToday() } }),
        fetchExpenseRecords(`month=${Number(monthNumber)}&year=${year}`),
        fetchExpenseRecords('today=true'),
      ]);
      const workerData = Array.isArray(workerRows.data) ? workerRows.data : [];
      const todayAmounts = (Array.isArray(recentRows.data) ? recentRows.data : []).map((row: any) => ({
        ...row,
        entryType: 'Amount',
        isExpenseAdvance: false,
      }));
      const todayAdvances = todayAdvanceRows
        .filter(isAdvanceExpense)
        .filter((row: any) => String(row.worker || ''))
        .map((row: any) => {
          const worker = workerData.find((item: Worker) => item._id === String(row.worker));
          return {
            ...row,
            worker: {
              _id: String(row.worker),
              name: workerIdentity(worker) || row.workerName || 'Worker',
            },
            buyingAmount: Number(row.amount || 0),
            entryDateTime: row.updatedAt || row.createdAt || row.date,
            entryType: 'Worker Amount',
            isExpenseAdvance: true,
          };
        });
      setWorkers(workerData);
      setSummary(Array.isArray(summaryRows.data) ? summaryRows.data : []);
      setDrivers(Array.isArray(driverRows.data) ? driverRows.data : []);
      setDriverExpenses(Array.isArray(expenseRows.data) ? expenseRows.data : []);
      setRecentBuying([...todayAmounts, ...todayAdvances]
        .sort((a, b) => new Date(b.entryDateTime || b.date).getTime() - new Date(a.entryDateTime || a.date).getTime()));
      setAdvanceExpenses(advanceRows.filter(isAdvanceExpense));
    } catch (err: any) {
      setPageError(err?.response?.data?.message || 'Could not load workers');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (authLoading) return;
    if (isSuperAdmin) {
      api.get('/branches')
        .then(({ data }) => {
          const activeBranches = (Array.isArray(data) ? data : []).filter((branch: Branch) => branch.isActive !== false);
          const storedBranch = window.localStorage.getItem('tii_selected_branch') || '';
          const validBranch = activeBranches.some((branch: Branch) => branch._id === storedBranch) ? storedBranch : '';
          if (storedBranch && !validBranch) window.localStorage.removeItem('tii_selected_branch');
          setBranches(activeBranches);
          setSelectedBranch(validBranch);
        })
        .catch(() => {
          setBranches([]);
          setSelectedBranch('');
        });
    } else {
      setSelectedBranch(user?.branch || '');
    }
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    void load();
  }, [authLoading, selectedBranch, load]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    window.location.reload();
  };

  const loadWorkerDetail = async (worker: Worker, range: { from: string; to: string }) => {
    setWorkerDetailLoading(true);
    setError('');
    try {
      const [res, expenseRows] = await Promise.all([
        api.get('/workers/buying', { params: { from: range.from, to: range.to, worker: worker._id } }),
        fetchExpenseRecords(),
      ]);
      const buyingRows = (Array.isArray(res.data) ? res.data : []).map((row: any) => ({ ...row, entryType: 'Amount' }));
      const advances = expenseRows
        .filter((row: any) => {
          const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.date));
          return isAdvanceExpense(row) && String(row.worker || '') === worker._id
            && (!range.from || date >= range.from) && (!range.to || date <= range.to);
        })
        .map((row: any) => ({ ...row, buyingAmount: Number(row.amount || 0), entryType: 'Worker Amount' }));
      setWorkerDetailRows([...buyingRows, ...advances].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load worker history');
    } finally {
      setWorkerDetailLoading(false);
    }
  };

  const openWorkerDetail = (row: any) => {
    if (!row?.worker) return;
    const range = monthRange(month);
    setWorkerDetailTarget(row);
    setWorkerDetailRange(range);
    setWorkerDetailRows([]);
    loadWorkerDetail(row.worker, range);
  };

  const peopleSummary = useMemo(() => {
    const workerRows = workers.map((worker) => {
      const truckId = referenceId(worker.truck);
      const driver = truckId ? drivers.find((item) => item._id === truckId) || null : null;
      const summaryRow = summary.find((row) => row.workerId === worker._id);
      const advances = worker ? advanceExpenses.filter((expense) => String(expense.worker || '') === worker._id) : [];
      const driverRows = driver
        ? driverExpenses.filter((expense) => String(expense.truck?._id || expense.truck) === driver._id)
        : [];
      // A driver can now receive both truck fuel/expense entries (driverRows)
      // and regular Worker Amount entries (summaryRow) — count both, not
      // just one or the other, so an amount entered for a driver still
      // shows up here.
      const buyingAmount = (driver ? driverRows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) : 0)
        + Number(summaryRow?.buyingAmount || 0);
      return {
        id: worker._id,
        name: worker.name,
        role: worker.role || 'Worker',
        buyingAmount: buyingAmount + advances.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
        buyingDays: (driver ? driverRows.length : 0) + (summaryRow?.buyingDays || 0),
        isDriver: Boolean(driver),
        worker,
        driver,
        branch: worker.branch || driver?.branch,
      };
    });
    return workerRows.sort((a, b) => a.name.localeCompare(b.name));
  }, [summary, workers, drivers, driverExpenses, advanceExpenses]);

  const workerTotal = useMemo(
    () => peopleSummary.reduce((total, row) => total + Number(row.buyingAmount || 0), 0),
    [peopleSummary],
  );

  const todayWorkerAmount = useMemo(
    () => recentBuying.reduce((total, row) => total + Number(row.buyingAmount || row.amount || 0), 0),
    [recentBuying],
  );

  const assignedWorkerCount = useMemo(() => peopleSummary.filter((row) => row.isDriver).length, [peopleSummary]);
  const availableWorkerCount = peopleSummary.length - assignedWorkerCount;
  const visiblePeople = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return peopleSummary.filter((row) => {
      if (assignmentFilter === 'assigned' && !row.isDriver) return false;
      if (assignmentFilter === 'available' && row.isDriver) return false;
      if (!query) return true;
      const branchLabel = typeof row.branch === 'object' && row.branch ? `${row.branch.name} ${row.branch.code}` : '';
      return [row.name, row.role, row.worker?.phoneNumber, row.driver?.truckName, row.driver?.truckNumber, branchLabel]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    });
  }, [assignmentFilter, peopleSummary, search]);

  const driverDetailRows = useMemo(() => {
    if (!driverDetailTarget) return [];
    return driverExpenses
      .filter((expense) => String(expense.truck?._id || expense.truck) === driverDetailTarget._id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [driverDetailTarget, driverExpenses]);

  const driverDetailTotal = useMemo(
    () => driverDetailRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [driverDetailRows],
  );

  const openCreateWorker = () => {
    if (!canManageWorkers) return;
    setEditingWorker(null);
    setWorkerForm(emptyWorkerForm);
    setRoleMode('');
    setError('');
    setWorkerModalOpen(true);
  };

  const openEditWorker = (worker: Worker) => {
    if (!canManageWorkers) return;
    setEditingWorker(worker);
    setWorkerForm({
      name: worker.name,
      phoneNumber: worker.phoneNumber || '',
      role: worker.role || '',
      notes: worker.notes || '',
    });
    setRoleMode(worker.role ? (WORKER_ROLE_OPTIONS.includes(worker.role) ? worker.role : 'Others') : '');
    setError('');
    setWorkerModalOpen(true);
  };

  const saveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageWorkers) return;
    setError('');
    const normalizedName = String(workerForm.name || '').trim().toLocaleLowerCase();
    const normalizedPhone = String(workerForm.phoneNumber || '').replace(/\D/g, '');
    if (!normalizedName) { setError('Enter the worker name.'); return; }
    if (normalizedPhone && normalizedPhone.length !== 10) { setError('Enter a valid 10-digit phone number.'); return; }
    if (editingWorker?.truck && String(workerForm.role || '').trim().toLocaleLowerCase() !== 'driver') {
      setError('This worker is assigned to a truck, so the role must remain Driver. Change the truck assignment first.');
      return;
    }
    const duplicate = workers.find((worker) => worker._id !== editingWorker?._id && (worker.name.trim().toLocaleLowerCase() === normalizedName || (normalizedPhone && String(worker.phoneNumber || '').replace(/\D/g, '') === normalizedPhone)));
    if (duplicate) { setError(duplicate.name.trim().toLocaleLowerCase() === normalizedName ? 'Worker name already exists' : 'Worker phone number already exists'); return; }
    const payload = { ...workerForm };
    setSubmitting(true);
    try {
      if (editingWorker) await api.patch(`/workers/${editingWorker._id}`, payload);
      else await api.post('/workers', payload);
      setWorkerModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save worker');
    } finally {
      setSubmitting(false);
    }
  };

  const removeWorker = async (worker: Worker) => {
    if (!canManageWorkers) return;
    if (referenceId(worker.truck)) {
      setPageError(`${worker.name} is assigned to a truck. Change or remove the driver assignment on the Trucks page first.`);
      return;
    }
    if (!confirm(`Remove worker "${worker.name}"?`)) return;
    setPageError('');
    setRemovingId(worker._id);
    try {
      await api.delete(`/workers/${worker._id}`);
      await load();
    } catch (actionError: any) {
      setPageError(actionError?.response?.data?.message || 'Could not remove the worker.');
    } finally {
      setRemovingId('');
    }
  };

  const openCreateBuying = (workerId = '') => {
    if (!canManageWorkers) return;
    setEditingBuying(null);
    setBuyingForm({ ...emptyBuyingForm, worker: workerId || workers[0]?._id || '' });
    setError('');
    setBuyingModalOpen(true);
  };

  const openEditBuying = (row: any) => {
    if (!canManageWorkers || !isTodayAmount(row.date)) return;
    setEditingBuying(row);
    setBuyingForm({
      worker: referenceId(row.worker),
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.date)),
      buyingAmount: String(row.buyingAmount ?? ''),
      notes: row.notes || '',
    });
    setError('');
    setBuyingModalOpen(true);
  };

  const saveBuying = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageWorkers) return;
    if (editingBuying && !isTodayAmount(editingBuying.date)) {
      setError("Only today's amounts can be edited.");
      return;
    }
    setError('');
    const amount = Number(buyingForm.buyingAmount) || 0;
    if (!buyingForm.worker) { setError('Select a worker.'); return; }
    if (amount <= 0) { setError('Enter an amount greater than zero.'); return; }
    const payload = { ...buyingForm, buyingAmount: amount };
    setSubmitting(true);
    try {
      if (editingBuying?.isExpenseAdvance) {
        const worker = workers.find((row) => row._id === buyingForm.worker);
        const response = await fetch(`/api/expenses?id=${encodeURIComponent(editingBuying._id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...selectedBranchHeaders() },
          body: JSON.stringify({
            date: buyingForm.date,
            costType: 'advance_for_employee',
            amount,
            notes: buyingForm.notes,
            worker: buyingForm.worker,
            workerName: workerIdentity(worker) || editingBuying.worker?.name || '',
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.message || 'Could not save worker amount');
      } else if (editingBuying) {
        await api.patch(`/workers/buying/${editingBuying._id}`, payload);
      } else {
        const worker = workers.find((row) => row._id === buyingForm.worker);
        const response = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...selectedBranchHeaders() },
          body: JSON.stringify({
            date: buyingForm.date,
            costType: 'advance_for_employee',
            amount,
            notes: buyingForm.notes,
            worker: buyingForm.worker,
            workerName: workerIdentity(worker),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.message || 'Could not save worker amount');
      }
      setBuyingModalOpen(false);
      setEditingBuying(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not save buying amount');
    } finally {
      setSubmitting(false);
    }
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
              {isSuperAdmin ? 'Super admin workforce centre' : 'Branch workforce workspace'}
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Workers &amp; assignments</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {overallView
                ? `Review people, truck assignments, and worker amounts across ${branches.length} branches.`
                : `Manage worker details and daily amounts for ${scopeName}. Driver assignments stay connected to the Trucks page.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiGitBranch className="text-iceblue-300" />{scopeName}</span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiUsers className="text-emerald-300" />{peopleSummary.length} workers</span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-slate-200"><FiTruck className="text-cyan-300" />{assignedWorkerCount} assigned drivers</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-navy-900 transition hover:bg-iceblue-50 disabled:opacity-60"><FiRefreshCcw className={loading ? 'animate-spin' : ''} /> Refresh</button>
            {canManageWorkers && <>
              <button type="button" onClick={() => openCreateBuying()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"><FiDollarSign /> Add amount</button>
              <button type="button" onClick={openCreateWorker} className="inline-flex items-center gap-2 rounded-xl bg-iceblue-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-iceblue-400"><FiPlus /> Add worker</button>
            </>}
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
        <section className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${canManageWorkers ? 'border-emerald-100 bg-emerald-50/70' : 'border-red-100 bg-red-50/70'}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm ${canManageWorkers ? 'text-emerald-600' : 'text-red-600'}`}>{canManageWorkers ? <FiCheckCircle /> : <FiAlertTriangle />}</span>
          <div><p className="text-xs font-extrabold text-navy-900">{canManageWorkers ? 'Assigned branch ready' : 'No branch assigned'}</p><p className="mt-0.5 text-[10px] text-slate-500">{canManageWorkers ? 'Worker changes and amount entries are automatically recorded under your branch.' : 'Ask a super admin to assign your account to a branch before managing workers.'}</p></div>
        </section>
      )}

      {overallView && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><FiLock /></span>
          <div><p className="text-xs font-extrabold text-navy-900">Network workforce view is read-only</p><p className="mt-1 text-[10px] leading-4 text-slate-600">Review consolidated worker totals and recent amounts here. Select a branch before adding, editing, removing, or recording an amount.</p></div>
        </section>
      )}
      {pageError && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">{pageError}</div>}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-iceblue-600 shadow-sm ring-1 ring-slate-100"><FiUsers /></span><div><h2 className="font-extrabold text-navy-900">Workforce snapshot</h2><p className="text-xs text-slate-500">People and amount totals for {scopeName.toLowerCase()}.</p></div></div>
          <input type="month" aria-label="Worker summary month" className="input-field h-9 w-[145px] text-xs" value={month} onChange={(event) => setMonth(event.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WorkerSummaryCard
          icon={FiUsers}
          label="Total workers"
          value={peopleSummary.length}
          helper="Active people"
          tone="blue"
        />
        <WorkerSummaryCard
          icon={FiTruck}
          label="Assigned drivers"
          value={assignedWorkerCount}
          helper="Linked to trucks"
          tone="cyan"
        />
        <WorkerSummaryCard
          icon={FiUserCheck}
          label="Available workers"
          value={availableWorkerCount}
          helper="Not assigned to a truck"
          tone="violet"
        />
        <WorkerSummaryCard
          icon={FiDollarSign}
          label="Today's amount"
          value={formatCurrency(todayWorkerAmount)}
          helper={`${formatCurrency(workerTotal)} in ${month}`}
          tone="amber"
        />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 xl:flex-row xl:items-center lg:px-5">
          <h1 className="flex shrink-0 items-center gap-2 font-display text-lg font-black text-navy-900">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-iceblue-50 text-iceblue-600"><FiUserCheck /></span>
            <span>Worker directory<span className="mt-0.5 block text-xs font-medium text-slate-500">{peopleSummary.length} people · {assignedWorkerCount} assigned · {availableWorkerCount} available</span></span>
          </h1>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row xl:justify-end">
            <div className="relative min-w-0 sm:w-72"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input-field h-10 pl-9" placeholder="Search name, role, phone, truck..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <div className="flex rounded-xl bg-slate-100 p-1">
              {(['all', 'assigned', 'available'] as const).map((filter) => <button key={filter} type="button" onClick={() => setAssignmentFilter(filter)} className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-bold capitalize transition ${assignmentFilter === filter ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900'}`}>{filter}</button>)}
            </div>
          </div>
        </div>
        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <>
            <div className="grid gap-3 p-4 sm:hidden">
              {visiblePeople.map((row, index) => (
                <article key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold text-iceblue-600 shadow-sm ring-1 ring-slate-100">{index + 1}</span>
                        <Link href={`/admin/workers/${row.id}`} className="min-w-0 truncate text-sm font-extrabold text-navy-900 hover:text-iceblue-700">{row.name}</Link>
                      </div>
                      <p className="mt-1 pl-10 text-xs font-semibold text-slate-500">{row.role}</p>
                      <p className="mt-0.5 pl-10 text-[10px] font-bold text-iceblue-700">Branch: {typeof row.branch === 'object' && row.branch ? `${row.branch.name} · ${row.branch.code}` : scopeName}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${row.isDriver ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.isDriver ? 'Assigned' : 'Available'}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3 text-xs">
                    <div><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Phone</p><p className="mt-1 font-bold text-navy-900">{row.worker?.phoneNumber || 'Not added'}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Truck</p>{row.driver ? <Link href={`/admin/trucks/${row.driver._id}`} className="mt-1 block font-bold text-iceblue-700 hover:underline">{row.driver.truckName}<span className="block text-[10px] text-slate-500">{row.driver.truckNumber}</span></Link> : <p className="mt-1 font-bold text-slate-500">Not assigned</p>}</div>
                    <div><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{month} amount</p><p className="mt-1 font-bold text-red-600">{formatCurrency(row.buyingAmount)}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Entry days</p><p className="mt-1 font-bold text-navy-900">{row.buyingDays}</p></div>
                  </div>
                  {canManageWorkers && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button title="Add worker amount" onClick={() => openCreateBuying(row.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-iceblue-50 px-2.5 py-2 text-[10px] font-bold text-iceblue-700"><FiDollarSign /> Amount</button>
                      <button title="Edit worker" onClick={() => openEditWorker(row.worker)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-2 text-[10px] font-bold text-slate-600"><FiEdit2 /> Edit</button>
                      {!row.isDriver && <button title="Remove worker" disabled={removingId === row.id} onClick={() => removeWorker(row.worker)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[10px] font-bold text-red-600 disabled:opacity-50"><FiTrash2 /> Remove</button>}
                    </div>
                  )}
                </article>
              ))}
              {visiblePeople.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">No workers match this view.</p>}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[1080px] text-left text-xs">
                <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-center">No.</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Worker</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Truck assignment</th>
                    <th className="px-4 py-3 text-right">Month amount</th>
                    <th className="px-4 py-3 text-center">Days</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiblePeople.map((row, index) => (
                    <tr key={row.id} className="transition hover:bg-iceblue-50/40">
                      <td className="px-4 py-4 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="px-4 py-4"><p className="font-bold text-navy-900">{typeof row.branch === 'object' && row.branch ? row.branch.name : scopeBranch?.name || 'Assigned branch'}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-400">{typeof row.branch === 'object' && row.branch ? row.branch.code : scopeBranch?.code || ''}</p></td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/workers/${row.id}`}
                          className="font-extrabold text-navy-900 hover:text-iceblue-700"
                        >
                          {row.name}
                        </Link>
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><FiPhone />{row.worker?.phoneNumber || 'Phone not added'}</p>
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-600">{row.role}</td>
                      <td className="px-4 py-4">{row.driver ? <Link href={`/admin/trucks/${row.driver._id}`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-700"><FiTruck /><span>{row.driver.truckName}<span className="ml-1 text-[9px] text-emerald-600/70">{row.driver.truckNumber}</span></span></Link> : <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 font-bold text-slate-500"><FiUserCheck /> Available</span>}</td>
                      <td className="px-4 py-4 text-right font-extrabold text-red-600">{formatCurrency(row.buyingAmount)}</td>
                      <td className="px-4 py-4 text-center font-bold text-navy-900">{row.buyingDays}</td>
                      <td className="px-4 py-4">
                        {canManageWorkers && (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button title="Add worker amount" onClick={() => openCreateBuying(row.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-iceblue-50 text-iceblue-700 transition hover:bg-iceblue-100"><FiDollarSign /></button>
                            <button title="Edit worker" onClick={() => openEditWorker(row.worker)} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"><FiEdit2 /></button>
                            {!row.isDriver && <button title="Remove worker" disabled={removingId === row.id} onClick={() => removeWorker(row.worker)} className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"><FiTrash2 /></button>}
                          </div>
                        )}
                        {!canManageWorkers && <p className="text-right text-[10px] font-bold text-slate-400">View only</p>}
                      </td>
                    </tr>
                  ))}
                  {visiblePeople.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-slate-500">No workers match this view.</td></tr>
                  )}
                </tbody>
                {visiblePeople.length > 0 && <tfoot className="border-t border-slate-200 bg-slate-50 font-extrabold text-navy-900"><tr><td colSpan={5} className="px-4 py-3 text-right uppercase">Visible total</td><td className="px-4 py-3 text-right text-red-600">{formatCurrency(visiblePeople.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0))}</td><td className="px-4 py-3 text-center">{visiblePeople.reduce((sum, row) => sum + Number(row.buyingDays || 0), 0)}</td><td /></tr></tfoot>}
              </table>
            </div>
          </>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><FiDollarSign /></span>
            <div><h2 className="font-extrabold text-navy-900">Today&apos;s worker amounts</h2><p className="text-xs text-slate-500">Latest entries for {scopeName.toLowerCase()}.</p></div>
          </div>
          <Link href="/admin/workers/buying-history" className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-navy-900 transition hover:bg-slate-200">
            Full history <FiArrowRight />
          </Link>
        </div>
        <div className="grid gap-3 p-4 md:hidden">
          {recentBuying.map((row, index) => (
            <article key={`${row.isExpenseAdvance ? 'worker-amount' : 'amount'}-${row._id}`} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy-900">{row.worker?.name || 'Worker'}</p>
                  <p className="mt-1 text-xs text-navy-800/55">{formatDate(row.date)} &middot; {formatEntryDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-red-500">{formatCurrency(row.buyingAmount)}</p>
              </div>
              <p className="mt-1.5 text-xs text-navy-800/60">{row.entryType === 'Worker Amount' ? `Worker Amount${row.notes ? ` - ${row.notes}` : ''}` : row.notes || '-'}</p>
              <div className="mt-2">
                {canManageWorkers && isTodayAmount(row.date) ? (
                  <button type="button" title="Edit today's amount" aria-label={`Edit ${row.worker?.name || 'worker'} amount`} onClick={() => openEditBuying(row)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-[10px] font-bold text-slate-600 shadow-sm"><FiEdit2 /> Edit amount</button>
                ) : (
                  <span className="text-xs text-navy-800/30">—</span>
                )}
              </div>
            </article>
          ))}
          {recentBuying.length === 0 && <p className="px-4 py-8 text-center text-sm text-navy-800/50">No amount entries for today.</p>}
          {recentBuying.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-navy-900">
              <span>TOTAL</span>
              <span className="text-red-600">{formatCurrency(recentBuying.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0))}</span>
            </div>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] table-fixed border-collapse text-xs sm:text-sm">
            <thead className="bg-slate-100 text-navy-900"><tr><th className="w-[7%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">S.No</th><th className="w-[18%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Worker Name</th><th className="w-[14%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Amount Date</th><th className="w-[21%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Entry Date &amp; Time</th><th className="w-[14%] border border-slate-300 px-3 py-3 text-right font-bold uppercase">Amount</th><th className="w-[18%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Notes</th><th className="w-[8%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">Actions</th></tr></thead>
            <tbody>
              {recentBuying.map((row, index) => <tr key={`${row.isExpenseAdvance ? 'worker-amount' : 'amount'}-${row._id}`} className="even:bg-slate-50 hover:bg-iceblue-50/70"><td className="border border-slate-300 px-2 py-2.5 text-center">{index + 1}</td><td className="border border-slate-300 px-3 py-2.5 font-semibold text-navy-900">{row.worker?.name || 'Worker'}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatDate(row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatEntryDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-right font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td><td className="border border-slate-300 px-3 py-2.5">{row.entryType === 'Worker Amount' ? `Worker Amount${row.notes ? ` - ${row.notes}` : ''}` : row.notes || '-'}</td><td className="border border-slate-300 px-2 py-2.5 text-center">{canManageWorkers && isTodayAmount(row.date) ? <button type="button" title="Edit today's amount" aria-label={`Edit ${row.worker?.name || 'worker'} amount`} onClick={() => openEditBuying(row)} className="text-navy-900 hover:text-black"><FiEdit2 /></button> : <span className="text-navy-800/30">—</span>}</td></tr>)}
              {recentBuying.length === 0 && <tr><td colSpan={7} className="border border-slate-300 py-8 text-center text-navy-800/50">No amount entries for today.</td></tr>}
            </tbody>
            {recentBuying.length > 0 && <tfoot className="bg-slate-100 font-bold text-navy-900"><tr><td colSpan={4} className="border border-slate-300 px-3 py-3 text-right uppercase">Total</td><td className="border border-slate-300 px-3 py-3 text-right text-red-600">{formatCurrency(recentBuying.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0))}</td><td className="border border-slate-300" /><td className="border border-slate-300" /></tr></tfoot>}
          </table>
        </div>
      </section>

      {workerModalOpen && (
        <Modal title={editingWorker ? 'Edit Worker' : 'Add Worker'} onClose={() => setWorkerModalOpen(false)}>
          <form onSubmit={saveWorker} className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-iceblue-100 bg-iceblue-50/70 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-iceblue-700 shadow-sm"><FiGitBranch /></span>
              <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Worker branch</p><p className="mt-0.5 text-sm font-extrabold text-navy-900">{editingWorker && typeof editingWorker.branch === 'object' ? `${editingWorker.branch.name} (${editingWorker.branch.code})` : scopeName}</p></div>
            </div>
            {editingWorker?.truck && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <FiTruck className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-xs leading-5 text-emerald-800">This worker is assigned to a truck. You can update the name, phone, and notes here; change the driver or role from the Trucks page.</p>
              </div>
            )}
            <div>
              <label className="label-text">Worker Name</label>
              <input className="input-field" required value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-text">Phone Number</label>
                <input type="tel" inputMode="numeric" maxLength={10} className="input-field" placeholder="10-digit mobile number" value={workerForm.phoneNumber} onChange={(e) => setWorkerForm({ ...workerForm, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
              </div>
              <div>
                <label className="label-text">Work Role</label>
                <select
                  disabled={Boolean(editingWorker?.truck)}
                  className="input-field disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  value={roleMode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRoleMode(value);
                    setWorkerForm({ ...workerForm, role: value === 'Others' ? '' : value });
                  }}
                >
                  <option value="">Select role</option>
                  {WORKER_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  <option value="Others">Others</option>
                </select>
              </div>
            </div>
            {roleMode === 'Others' && (
              <div>
                <label className="label-text">Enter Role</label>
                <input
                  className="input-field"
                  required
                  autoFocus
                  placeholder="Enter role"
                  value={workerForm.role}
                  onChange={(e) => setWorkerForm({ ...workerForm, role: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={workerForm.notes} onChange={(e) => setWorkerForm({ ...workerForm, notes: e.target.value })} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button disabled={submitting} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60">{submitting ? 'Saving...' : editingWorker ? 'Save Worker' : 'Create Worker'}</button>
          </form>
        </Modal>
      )}

      {buyingModalOpen && (
        <Modal title={editingBuying ? 'Edit Worker Amount' : 'Worker Amount'} onClose={() => { setBuyingModalOpen(false); setEditingBuying(null); }}>
          <form onSubmit={saveBuying} className="space-y-3">
            <div>
              <label className="label-text">Worker</label>
              <select required className="input-field" value={buyingForm.worker} onChange={(e) => setBuyingForm({ ...buyingForm, worker: e.target.value })}>
                <option value="">Select worker</option>
                {workers.map((worker) => <option key={worker._id} value={worker._id}>{workerIdentity(worker)}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Date</label>
              <input type="date" required disabled={Boolean(editingBuying)} className="input-field disabled:cursor-not-allowed disabled:opacity-60" value={buyingForm.date} onChange={(e) => setBuyingForm({ ...buyingForm, date: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Amount</label>
              <input type="number" min={0} step="0.01" required className="input-field" value={buyingForm.buyingAmount} onChange={(e) => setBuyingForm({ ...buyingForm, buyingAmount: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={buyingForm.notes} onChange={(e) => setBuyingForm({ ...buyingForm, notes: e.target.value })} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button disabled={submitting} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60">{submitting ? 'Saving...' : editingBuying ? 'Update Amount' : 'Save Amount'}</button>
          </form>
        </Modal>
      )}

      {workerDetailTarget && (
        <Modal title={`Worker Details: ${workerDetailTarget.name}`} onClose={() => setWorkerDetailTarget(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-iceblue-50 p-4 sm:grid-cols-5">
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Name</p>
                <p className="mt-1 font-bold text-navy-900">{workerDetailTarget.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Role</p>
                <p className="mt-1 font-bold text-navy-900">{workerDetailTarget.role || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Phone</p>
                <p className="mt-1 font-bold text-navy-900">{workerDetailTarget.worker?.phoneNumber || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Branch</p>
                <p className="mt-1 font-bold text-navy-900">{typeof workerDetailTarget.branch === 'object' && workerDetailTarget.branch ? `${workerDetailTarget.branch.name} (${workerDetailTarget.branch.code})` : scopeName}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-navy-800/45">Notes</p>
                <p className="mt-1 font-bold text-navy-900">{workerDetailTarget.worker?.notes || '-'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label-text">From</label>
                <input type="date" className="input-field" value={workerDetailRange.from} onChange={(e) => setWorkerDetailRange({ ...workerDetailRange, from: e.target.value })} />
              </div>
              <div>
                <label className="label-text">To</label>
                <input type="date" className="input-field" value={workerDetailRange.to} onChange={(e) => setWorkerDetailRange({ ...workerDetailRange, to: e.target.value })} />
              </div>
              <button type="button" onClick={() => loadWorkerDetail(workerDetailTarget.worker, workerDetailRange)} className="btn-secondary">Apply</button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div>
              {workerDetailLoading ? (
                <p className="text-navy-800/50">Loading...</p>
              ) : (
                <>
                  <div className="sm:hidden">
                    {workerDetailRows.map((row) => (
                      <div key={row._id} className="border-b border-slate-100 py-3 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-navy-900">{formatDate(row.date)}</p>
                            <p className="mt-1 text-xs text-navy-800/55">{formatEntryDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-red-500">{formatCurrency(row.buyingAmount)}</p>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-3">
                          <span className={`pill ${row.entryType === 'Worker Amount' ? 'bg-amber-50 text-amber-700' : 'bg-iceblue-50 text-iceblue-700'}`}>{row.entryType || 'Amount'}</span>
                          {row.notes && <p className="truncate text-xs text-navy-800/60">{row.notes}</p>}
                        </div>
                      </div>
                    ))}
                    {workerDetailRows.length === 0 && (
                      <p className="py-4 text-center text-sm text-navy-800/50">No worker amount entries for the selected range.</p>
                    )}
                    {workerDetailRows.length > 0 && (
                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm font-semibold text-navy-900">
                        <span>Total</span>
                        <span className="text-red-500">{formatCurrency(workerDetailRows.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0))}</span>
                      </div>
                    )}
                  </div>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="table-base min-w-[650px]">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Current Date &amp; Time</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerDetailRows.map((row) => (
                          <tr key={row._id}>
                            <td>{formatDate(row.date)}</td>
                            <td>{formatEntryDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</td>
                            <td><span className={`pill ${row.entryType === 'Worker Amount' ? 'bg-amber-50 text-amber-700' : 'bg-iceblue-50 text-iceblue-700'}`}>{row.entryType || 'Amount'}</span></td>
                            <td className="font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td>
                            <td className="text-xs text-navy-800/60">{row.notes}</td>
                          </tr>
                        ))}
                        {workerDetailRows.length === 0 && (
                          <tr><td colSpan={5} className="py-4 text-center text-navy-800/50">No worker amount entries for the selected range.</td></tr>
                        )}
                      </tbody>
                      {workerDetailRows.length > 0 && (
                        <tfoot>
                          <tr className="font-semibold">
                            <td>Total</td>
                            <td></td>
                            <td></td>
                            <td className="text-red-500">{formatCurrency(workerDetailRows.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0))}</td>
                            <td></td>
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

      {driverDetailTarget && (
        <Modal title={`Driver Buying: ${driverDetailTarget.driverName}`} onClose={() => setDriverDetailTarget(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryPill label="Driver" value={driverDetailTarget.driverName} />
              <SummaryPill label="Truck" value={`${driverDetailTarget.truckName} (${driverDetailTarget.truckNumber})`} />
              <SummaryPill label="Phone" value={driverDetailTarget.phoneNumber || '-'} />
              <SummaryPill label="Monthly Salary" value={formatCurrency(driverDetailTarget.monthlySalary || 0)} />
              <SummaryPill label={`Total Buying (${month})`} value={formatCurrency(driverDetailTotal)} danger={driverDetailTotal > 0} />
            </div>
            <div>
              <div className="sm:hidden">
                {driverDetailRows.map((row) => (
                  <div key={row._id} className="border-b border-slate-100 py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-navy-900">{formatDate(row.date)}</p>
                      <p className="shrink-0 text-sm font-bold text-red-500">{formatCurrency(row.amount)}</p>
                    </div>
                    <p className="mt-1 text-xs text-navy-800/55">{row.purpose || '-'}</p>
                    {row.notes && <p className="mt-1 text-xs text-navy-800/60">{row.notes}</p>}
                  </div>
                ))}
                {driverDetailRows.length === 0 && (
                  <p className="py-4 text-center text-sm text-navy-800/50">No buying entries for this month.</p>
                )}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="table-base min-w-[500px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Purpose</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverDetailRows.map((row) => (
                      <tr key={row._id}>
                        <td>{formatDate(row.date)}</td>
                        <td className="font-semibold text-red-500">{formatCurrency(row.amount)}</td>
                        <td>{row.purpose || '-'}</td>
                        <td className="text-xs text-navy-800/60">{row.notes}</td>
                      </tr>
                    ))}
                    {driverDetailRows.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-center text-navy-800/50">No buying entries for this month.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function WorkerSummaryCard({ icon: Icon, label, value, helper, danger = false, tone = 'blue' }: { icon: any; label: string; value: string | number; helper?: string; danger?: boolean; tone?: 'blue' | 'cyan' | 'violet' | 'amber' }) {
  const styles = {
    blue: { card: 'from-blue-50 to-white', icon: 'bg-blue-600', accent: 'bg-blue-500' },
    cyan: { card: 'from-cyan-50 to-white', icon: 'bg-cyan-600', accent: 'bg-cyan-500' },
    violet: { card: 'from-violet-50 to-white', icon: 'bg-violet-600', accent: 'bg-violet-500' },
    amber: { card: 'from-amber-50 to-white', icon: 'bg-amber-500', accent: 'bg-amber-500' },
  }[tone];
  return (
    <div className={`relative flex min-h-[108px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${styles.card} ${danger ? 'border-red-100' : 'border-iceblue-100'}`}>
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
    </div>
  );
}

function SummaryPill({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`flex min-h-[112px] min-w-0 items-center gap-4 rounded-2xl border bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${danger ? 'border-red-100' : 'border-iceblue-100'}`}>
      <div className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-full ${danger ? 'bg-[conic-gradient(#ef4444_0deg,#ef4444_260deg,#fee2e2_260deg)]' : 'bg-[conic-gradient(#1ca6d1_0deg,#175872_265deg,#dff5fd_265deg)]'}`}><span className="grid h-11 w-11 place-items-center rounded-full bg-white"><span className={`h-2.5 w-2.5 rounded-full ${danger ? 'bg-red-500' : 'bg-iceblue-600'}`} /></span></div>
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/45">{label}</p><p className={`mt-2 break-words text-base font-bold sm:text-lg ${danger ? 'text-red-500' : 'text-navy-900'}`}>{value}</p></div>
    </div>
  );
}
