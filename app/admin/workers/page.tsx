'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiArrowRight, FiDollarSign, FiEdit2, FiGitBranch, FiPlus, FiTrash2, FiUserCheck, FiUsers } from 'react-icons/fi';
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
  const [recentBuying, setRecentBuying] = useState<any[]>([]);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageWorkers = !isSuperAdmin || Boolean(selectedBranch);
  const activeBranch = branches.find((branch) => branch._id === selectedBranch);

  const load = async () => {
    setLoading(true);
    setError('');
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
        .map((row: any) => ({
          ...row,
          worker: {
            _id: String(row.worker),
            name: row.workerName || workerData.find((worker: Worker) => worker._id === String(row.worker))?.name || 'Worker',
          },
          buyingAmount: Number(row.amount || 0),
          entryDateTime: row.updatedAt || row.createdAt || row.date,
          entryType: 'Worker Amount',
          isExpenseAdvance: true,
        }));
      setWorkers(workerData);
      setSummary(Array.isArray(summaryRows.data) ? summaryRows.data : []);
      setDrivers(Array.isArray(driverRows.data) ? driverRows.data : []);
      setDriverExpenses(Array.isArray(expenseRows.data) ? expenseRows.data : []);
      setRecentBuying([...todayAmounts, ...todayAdvances]
        .sort((a, b) => new Date(b.entryDateTime || b.date).getTime() - new Date(a.entryDateTime || a.date).getTime()));
      setAdvanceExpenses(advanceRows.filter(isAdvanceExpense));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load workers');
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
        .catch(() => setBranches([]));
    }
  }, [authLoading, isSuperAdmin, user?.branch]);

  useEffect(() => {
    if (authLoading || selectedBranch === null) return;
    void load();
  }, [authLoading, month, selectedBranch]);

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
      const buyingAmount = driver
        ? driverRows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
        : Number(summaryRow?.buyingAmount || 0);
      return {
        id: worker._id,
        name: worker.name,
        role: driver?.truckName || worker.role || '-',
        buyingAmount: buyingAmount + advances.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
        buyingDays: driver ? driverRows.length : summaryRow?.buyingDays || 0,
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
    const duplicate = workers.find((worker) => worker._id !== editingWorker?._id && (worker.name.trim().toLocaleLowerCase() === normalizedName || (normalizedPhone && String(worker.phoneNumber || '').replace(/\D/g, '') === normalizedPhone)));
    if (duplicate) { setError(duplicate.name.trim().toLocaleLowerCase() === normalizedName ? 'A worker with this name already exists.' : 'A worker with this phone number already exists.'); return; }
    const payload = { ...workerForm };
    try {
      if (editingWorker) await api.patch(`/workers/${editingWorker._id}`, payload);
      else await api.post('/workers', payload);
      setWorkerModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save worker');
    }
  };

  const removeWorker = async (worker: Worker) => {
    if (!canManageWorkers) return;
    if (!confirm(`Remove worker "${worker.name}"?`)) return;
    await api.delete(`/workers/${worker._id}`);
    load();
  };

  const openCreateBuying = (workerId = '') => {
    if (!canManageWorkers) return;
    setEditingBuying(null);
    setBuyingForm({ ...emptyBuyingForm, worker: workerId || workers.find((worker) => !worker.truck)?._id || '' });
    setError('');
    setBuyingModalOpen(true);
  };

  const openEditBuying = (row: any) => {
    if (!canManageWorkers || row.isExpenseAdvance || !isTodayAmount(row.date)) return;
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
    const payload = { ...buyingForm, buyingAmount: Number(buyingForm.buyingAmount) || 0 };
    try {
      if (editingBuying) await api.patch(`/workers/buying/${editingBuying._id}`, payload);
      else await api.post('/workers/buying', payload);
      setBuyingModalOpen(false);
      setEditingBuying(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save buying amount');
    }
  };

  return (
    <div className="-mt-4 space-y-1 sm:-mt-5">
      {isSuperAdmin && (
        <section className="mb-3 flex flex-col gap-3 rounded-2xl border border-iceblue-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700"><FiGitBranch /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Worker view</p><p className="font-semibold text-navy-900">{activeBranch ? `${activeBranch.name} (${activeBranch.code})` : 'Overall — all branches'}</p></div>
          </div>
          <select className="input-field h-10 sm:max-w-xs" aria-label="Change worker branch" value={selectedBranch || ''} onChange={(event) => changeBranch(event.target.value)}>
            <option value="">Overall — all branches</option>
            {branches.filter((branch) => branch.isActive !== false).map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
          </select>
        </section>
      )}
      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <WorkerSummaryCard
          icon={FiUsers}
          label="Total Workers"
          value={peopleSummary.length}
          tone="blue"
        />
        <WorkerSummaryCard
          icon={FiDollarSign}
          label="Amount"
          value={formatCurrency(workerTotal)}
          helper={`For ${month}`}
          tone="amber"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-gradient-to-br from-white to-iceblue-50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-iceblue-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
          <h1 className="flex shrink-0 items-center gap-2 font-display text-lg font-black text-navy-900">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-900 text-white shadow-sm"><FiUserCheck /></span>
            Worker Management
          </h1>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
            <input type="month" className="input-field h-10 w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
            {canManageWorkers && <>
              <button type="button" onClick={() => openCreateBuying()} className="btn-secondary flex h-10 shrink-0 items-center justify-center gap-2 px-4">
                <FiUserCheck /> Amount
              </button>
              <button type="button" onClick={openCreateWorker} className="btn-primary flex h-10 shrink-0 items-center justify-center gap-2 px-4">
                <FiPlus /> Add Worker
              </button>
            </>}
          </div>
        </div>
        {error && !workerModalOpen && !buyingModalOpen && (
          <div className="m-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</div>
        )}
        <div className="overflow-x-auto">
        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <table className={`w-full ${isSuperAdmin ? 'min-w-[900px]' : 'min-w-[760px]'} table-fixed border-collapse text-left text-xs sm:text-sm`}>
            <thead className="bg-slate-100 text-navy-900">
              <tr>
                <th className="w-[7%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
                {isSuperAdmin && <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Branch</th>}
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Worker Name</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Role / Truck</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Amount</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Entry Days</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Actions</th>
              </tr>
            </thead>
            <tbody>
              {peopleSummary.map((row, index) => (
                <tr key={row.id} className="text-navy-900 even:bg-slate-50 hover:bg-iceblue-50/70">
                  <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                  {isSuperAdmin && <td className="break-words border border-slate-300 px-2 py-3 text-center">{typeof row.branch === 'object' && row.branch ? `${row.branch.name} (${row.branch.code})` : '-'}</td>}
                  <td className="break-words border border-slate-300 px-2 py-3 text-center font-semibold">
                    <Link
                      href={`/admin/workers/${row.worker?._id || row.id}`}
                      className="text-navy-900 underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="break-words border border-slate-300 px-2 py-3 text-center">{row.role}</td>
                  <td className="break-words border border-slate-300 px-2 py-3 text-center font-bold text-red-600">{formatCurrency(row.buyingAmount)}</td>
                  <td className="border border-slate-300 px-2 py-3 text-center">{row.buyingDays}</td>
                  <td className="border border-slate-300 px-2 py-3">
                    {canManageWorkers && !row.isDriver && (
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button title="Add buying" onClick={() => openCreateBuying(row.id)} className="text-navy-900 hover:text-black"><FiUserCheck /></button>
                        {row.worker && <button title="Edit worker" onClick={() => openEditWorker(row.worker)} className="text-navy-900 hover:text-black"><FiEdit2 /></button>}
                        {row.worker && <button title="Remove worker" onClick={() => removeWorker(row.worker)} className="text-navy-900 hover:text-black"><FiTrash2 /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {peopleSummary.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} className="border border-slate-300 px-4 py-10 text-center text-navy-800/50">No workers or drivers added yet.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-navy-900"><tr><td colSpan={isSuperAdmin ? 4 : 3} className="border border-slate-300 px-3 py-3 text-center">TOTAL</td><td className="border border-slate-300 px-3 py-3 text-center text-red-600">{formatCurrency(workerTotal)}</td><td className="border border-slate-300 px-3 py-3 text-center">{peopleSummary.reduce((sum, row) => sum + Number(row.buyingDays || 0), 0)}</td><td className="border border-slate-300 px-3 py-3" /></tr></tfoot>
          </table>
        )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-iceblue-100 px-4 py-3">
          <div>
            <h2 className="font-display text-base font-bold text-navy-900">Today&apos;s Amounts</h2>
            <p className="mt-0.5 text-xs text-navy-800/50">All worker amount entries for today</p>
          </div>
          <Link href="/admin/workers/buying-history" className="btn-secondary flex items-center gap-2 text-sm">
            View More <FiArrowRight />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed border-collapse text-xs sm:text-sm">
            <thead className="bg-slate-100 text-navy-900"><tr><th className="w-[7%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">S.No</th><th className="w-[18%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Worker Name</th><th className="w-[14%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Amount Date</th><th className="w-[21%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Entry Date &amp; Time</th><th className="w-[14%] border border-slate-300 px-3 py-3 text-right font-bold uppercase">Amount</th><th className="w-[18%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Notes</th><th className="w-[8%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">Actions</th></tr></thead>
            <tbody>
              {recentBuying.map((row, index) => <tr key={`${row.isExpenseAdvance ? 'worker-amount' : 'amount'}-${row._id}`} className="even:bg-slate-50 hover:bg-iceblue-50/70"><td className="border border-slate-300 px-2 py-2.5 text-center">{index + 1}</td><td className="border border-slate-300 px-3 py-2.5 font-semibold text-navy-900">{row.worker?.name || 'Worker'}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatDate(row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatEntryDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-right font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td><td className="border border-slate-300 px-3 py-2.5">{row.entryType === 'Worker Amount' ? `Worker Amount${row.notes ? ` - ${row.notes}` : ''}` : row.notes || '-'}</td><td className="border border-slate-300 px-2 py-2.5 text-center">{canManageWorkers && !row.isExpenseAdvance && isTodayAmount(row.date) ? <button type="button" title="Edit today's amount" aria-label={`Edit ${row.worker?.name || 'worker'} amount`} onClick={() => openEditBuying(row)} className="text-navy-900 hover:text-black"><FiEdit2 /></button> : <span className="text-navy-800/30">—</span>}</td></tr>)}
              {recentBuying.length === 0 && <tr><td colSpan={7} className="border border-slate-300 py-8 text-center text-navy-800/50">No amount entries for today.</td></tr>}
            </tbody>
            {recentBuying.length > 0 && <tfoot className="bg-slate-100 font-bold text-navy-900"><tr><td colSpan={4} className="border border-slate-300 px-3 py-3 text-right uppercase">Total</td><td className="border border-slate-300 px-3 py-3 text-right text-red-600">{formatCurrency(recentBuying.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0))}</td><td className="border border-slate-300" /><td className="border border-slate-300" /></tr></tfoot>}
          </table>
        </div>
      </section>

      {workerModalOpen && (
        <Modal title={editingWorker ? 'Edit Worker' : 'Add Worker'} onClose={() => setWorkerModalOpen(false)}>
          <form onSubmit={saveWorker} className="space-y-3">
            <div>
              <label className="label-text">Worker Name</label>
              <input className="input-field" required value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-text">Phone Number</label>
                <input className="input-field" value={workerForm.phoneNumber} onChange={(e) => setWorkerForm({ ...workerForm, phoneNumber: e.target.value })} />
              </div>
              <div>
                <label className="label-text">Work Role</label>
                <select
                  className="input-field"
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
            <button className="btn-primary w-full">{editingWorker ? 'Save Worker' : 'Create Worker'}</button>
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
                {workers.filter((worker) => !worker.truck).map((worker) => <option key={worker._id} value={worker._id}>{worker.name}</option>)}
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
            <button className="btn-primary w-full">{editingBuying ? 'Update Amount' : 'Save Amount'}</button>
          </form>
        </Modal>
      )}

      {workerDetailTarget && (
        <Modal title={`Worker Details: ${workerDetailTarget.name}`} onClose={() => setWorkerDetailTarget(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-iceblue-50 p-4 sm:grid-cols-4">
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
            <div className="overflow-x-auto">
              {workerDetailLoading ? (
                <p className="text-navy-800/50">Loading...</p>
              ) : (
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
            <div className="overflow-x-auto">
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
