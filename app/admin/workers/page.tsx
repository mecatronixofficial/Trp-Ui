'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FiArrowRight, FiDollarSign, FiEdit2, FiPlus, FiTrash2, FiUserCheck, FiUsers } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency, formatDate, todayISO } from '../../../lib/api';
import Modal from '../../../components/Modal';
import useDismissibleMenu from '../../../hooks/useDismissibleMenu';

type Worker = {
  _id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  notes?: string;
  truck?: string;
  isActive?: boolean;
};

const emptyWorkerForm = { name: '', phoneNumber: '', role: '', notes: '' };
const WORKER_ROLE_OPTIONS = ['Driver', 'Cleaner', 'Manager'];
const emptyBuyingForm = { worker: '', date: todayISO(), buyingAmount: '', notes: '' };

const formatEntryDateTime = (value: string | Date) => new Date(value).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function currentMonth() {
  return todayISO().slice(0, 7);
}

function monthRange(month: string) {
  const start = `${month}-01`;
  const date = new Date(`${start}T00:00:00`);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from: start, to: end };
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<any[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [buyingModalOpen, setBuyingModalOpen] = useState(false);
  const [showWorkerActions, setShowWorkerActions] = useState(false);
  const workerActionsRef = useRef<HTMLDivElement>(null);
  const closeWorkerActions = useCallback(() => setShowWorkerActions(false), []);
  useDismissibleMenu(showWorkerActions, workerActionsRef, closeWorkerActions);
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

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = monthRange(month);
      const [workerRows, summaryRows, driverRows, expenseRows, recentRows] = await Promise.all([
        api.get('/workers'),
        api.get('/workers/summary', { params: { month } }),
        api.get('/trucks'),
        api.get('/driver-expenses', { params: { from, to } }),
        api.get('/workers/buying', { params: { limit: 10 } }),
      ]);
      setWorkers(workerRows.data);
      setSummary(summaryRows.data);
      setDrivers(driverRows.data);
      setDriverExpenses(expenseRows.data);
      setRecentBuying(Array.isArray(recentRows.data) ? recentRows.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load workers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [month]);

  const loadWorkerDetail = async (worker: Worker, range: { from: string; to: string }) => {
    setWorkerDetailLoading(true);
    setError('');
    try {
      const res = await api.get('/workers/buying', { params: { from: range.from, to: range.to, worker: worker._id } });
      setWorkerDetailRows(res.data);
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

  const totals = useMemo(() => summary.reduce((acc, row) => ({
    buying: acc.buying + Number(row.buyingAmount || 0),
  }), { buying: 0 }), [summary]);

  const totalDriverAmount = useMemo(() => driverExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [driverExpenses]);
  const activeWorkforce = useMemo(() => {
    const activeTrucks = drivers.filter((truck) => truck.isActive !== false);
    const activeDrivers = activeTrucks.filter((truck) => String(truck.driverName || '').trim()).length;
    const activeEmployees = workers.filter((worker) => worker.isActive !== false && !worker.truck).length;
    return {
      total: activeDrivers + activeEmployees,
      trucks: activeTrucks.length,
      drivers: activeDrivers,
      employees: activeEmployees,
    };
  }, [drivers, workers]);

  const peopleSummary = useMemo(() => {
    const workerRows = summary
      .filter((row) => {
        const worker = workers.find((item) => item._id === row.workerId);
        return !worker?.truck;
      })
      .map((row) => ({
        id: row.workerId,
        name: row.name,
        role: row.role || '-',
        buyingAmount: Number(row.buyingAmount || 0),
        buyingDays: row.buyingDays || 0,
        isDriver: false,
        worker: workers.find((item) => item._id === row.workerId) || null,
        driver: null as any,
      }));
    const driverRows = drivers.map((driver) => {
      const rows = driverExpenses.filter((expense) => String(expense.truck?._id || expense.truck) === driver._id);
      const amount = rows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      return {
        id: driver._id,
        name: driver.driverName,
        role: `Driver - ${driver.truckName} (${driver.truckNumber})`,
        buyingAmount: amount,
        buyingDays: rows.length,
        isDriver: true,
        worker: null,
        driver,
      };
    });
    return [...workerRows, ...driverRows].sort((a, b) => a.name.localeCompare(b.name));
  }, [summary, workers, drivers, driverExpenses]);

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
    setEditingWorker(null);
    setWorkerForm(emptyWorkerForm);
    setRoleMode('');
    setError('');
    setWorkerModalOpen(true);
  };

  const openEditWorker = (worker: Worker) => {
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
    if (!confirm(`Remove worker "${worker.name}"?`)) return;
    await api.delete(`/workers/${worker._id}`);
    load();
  };

  const openCreateBuying = (workerId = '') => {
    setBuyingForm({ ...emptyBuyingForm, worker: workerId || workers.find((worker) => !worker.truck)?._id || '' });
    setError('');
    setBuyingModalOpen(true);
  };

  const saveBuying = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { ...buyingForm, buyingAmount: Number(buyingForm.buyingAmount) || 0 };
    try {
      await api.post('/workers/buying', payload);
      setBuyingModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save buying amount');
    }
  };

  return (
    <div className="-mt-4 space-y-1 sm:-mt-5">
      <section className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <WorkerSummaryCard
          icon={FiUsers}
          label="Total Workers"
          value={workers.length + drivers.length}
          helper={`Including ${drivers.length} driver${drivers.length === 1 ? '' : 's'}`}
          tone="blue"
        />
        <ActiveWorkforceCard counts={activeWorkforce} />
        <WorkerSummaryCard
          icon={FiUserCheck}
          label="Total Buying"
          value={formatCurrency(totals.buying + totalDriverAmount)}
          helper="Spent this month"
          tone="violet"
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
            <div ref={workerActionsRef} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 sm:bottom-6 sm:right-6">
              <button
                type="button"
                onClick={() => setShowWorkerActions((value) => !value)}
                aria-label="Worker actions"
                aria-expanded={showWorkerActions}
                className="btn-primary grid h-14 w-14 shrink-0 place-items-center rounded-full p-0 text-xl shadow-xl"
              >
                <FiPlus className={`transition-transform ${showWorkerActions ? 'rotate-45' : ''}`} />
              </button>
              {showWorkerActions && (
                <div className="absolute bottom-16 right-0 min-w-[180px] space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button type="button" onClick={() => { setShowWorkerActions(false); openCreateBuying(); }} className="btn-secondary flex h-10 w-full items-center justify-center gap-2 px-3">
                    <FiUserCheck /> Daily Buying
                  </button>
                  <button type="button" onClick={() => { setShowWorkerActions(false); openCreateWorker(); }} className="btn-primary flex h-10 w-full items-center justify-center gap-2 px-3">
                    <FiPlus /> Add Worker
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {error && !workerModalOpen && !buyingModalOpen && (
          <div className="m-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</div>
        )}
        <div className="overflow-x-auto">
        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-slate-100 text-navy-900">
              <tr>
                <th className="w-[7%] border border-slate-300 px-1 py-3 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Worker Name</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Role</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Buying Amount</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Buying Days</th>
                <th className="border border-slate-300 px-2 py-3 text-center text-[10px] font-bold uppercase leading-tight">Actions</th>
              </tr>
            </thead>
            <tbody>
              {peopleSummary.map((row, index) => (
                <tr key={row.id} className="text-navy-900 even:bg-slate-50 hover:bg-iceblue-50/70">
                  <td className="border border-slate-300 px-2 py-3 text-center font-medium text-navy-900">{index + 1}</td>
                  <td className="break-words border border-slate-300 px-2 py-3 text-center font-semibold">
                    <Link
                      href={`/admin/workers/${row.isDriver ? row.driver._id : row.worker?._id || row.id}`}
                      className="text-navy-900 underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="break-words border border-slate-300 px-2 py-3 text-center">{row.role}</td>
                  <td className="break-words border border-slate-300 px-2 py-3 text-center font-semibold text-navy-900">{formatCurrency(row.buyingAmount)}</td>
                  <td className="border border-slate-300 px-2 py-3 text-center">{row.buyingDays}</td>
                  <td className="border border-slate-300 px-2 py-3">
                    {!row.isDriver && (
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
                <tr><td colSpan={6} className="border border-slate-300 px-4 py-10 text-center text-navy-800/50">No workers or drivers added yet.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-navy-900"><tr><td colSpan={3} className="border border-slate-300 px-3 py-3 text-center">TOTAL</td><td className="border border-slate-300 px-3 py-3 text-center">{formatCurrency(totals.buying + totalDriverAmount)}</td><td className="border border-slate-300 px-3 py-3 text-center">{peopleSummary.reduce((sum, row) => sum + Number(row.buyingDays || 0), 0)}</td><td className="border border-slate-300 px-3 py-3" /></tr></tfoot>
          </table>
        )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-iceblue-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-iceblue-100 px-4 py-3">
          <div>
            <h2 className="font-display text-base font-bold text-navy-900">Recent Daily Buying</h2>
            <p className="mt-0.5 text-xs text-navy-800/50">Latest 10 worker buying entries</p>
          </div>
          <Link href="/admin/workers/buying-history" className="btn-secondary flex items-center gap-2 text-sm">
            View More <FiArrowRight />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-xs sm:text-sm">
            <thead className="bg-slate-100 text-navy-900"><tr><th className="w-[7%] border border-slate-300 px-2 py-3 text-center font-bold uppercase">S.No</th><th className="w-[20%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Worker Name</th><th className="w-[15%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Buying Date</th><th className="w-[23%] border border-slate-300 px-3 py-3 text-center font-bold uppercase">Entry Date &amp; Time</th><th className="w-[15%] border border-slate-300 px-3 py-3 text-right font-bold uppercase">Amount</th><th className="w-[20%] border border-slate-300 px-3 py-3 text-left font-bold uppercase">Notes</th></tr></thead>
            <tbody>
              {recentBuying.map((row, index) => <tr key={row._id} className="even:bg-slate-50 hover:bg-iceblue-50/70"><td className="border border-slate-300 px-2 py-2.5 text-center">{index + 1}</td><td className="border border-slate-300 px-3 py-2.5 font-semibold text-navy-900">{row.worker?.name || 'Worker'}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatDate(row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-center">{formatEntryDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</td><td className="border border-slate-300 px-3 py-2.5 text-right font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td><td className="border border-slate-300 px-3 py-2.5">{row.notes || '-'}</td></tr>)}
              {recentBuying.length === 0 && <tr><td colSpan={6} className="border border-slate-300 py-8 text-center text-navy-800/50">No daily buying history yet.</td></tr>}
            </tbody>
            {recentBuying.length > 0 && <tfoot className="bg-slate-100 font-bold text-navy-900"><tr><td colSpan={4} className="border border-slate-300 px-3 py-3 text-right uppercase">Total</td><td className="border border-slate-300 px-3 py-3 text-right text-red-600">{formatCurrency(recentBuying.reduce((sum, row) => sum + Number(row.buyingAmount || 0), 0))}</td><td className="border border-slate-300" /></tr></tfoot>}
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
        <Modal title="Daily Worker Buying" onClose={() => setBuyingModalOpen(false)}>
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
              <input type="date" required className="input-field" value={buyingForm.date} onChange={(e) => setBuyingForm({ ...buyingForm, date: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Buying Amount</label>
              <input type="number" min={0} step="0.01" required className="input-field" value={buyingForm.buyingAmount} onChange={(e) => setBuyingForm({ ...buyingForm, buyingAmount: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={buyingForm.notes} onChange={(e) => setBuyingForm({ ...buyingForm, notes: e.target.value })} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button className="btn-primary w-full">Save Daily Buying</button>
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
                      <th>Buying Amount</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerDetailRows.map((row) => (
                      <tr key={row._id}>
                        <td>{formatDate(row.date)}</td>
                        <td>{formatEntryDateTime(row.entryDateTime || row.updatedAt || row.createdAt || row.date)}</td>
                        <td className="font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td>
                        <td className="text-xs text-navy-800/60">{row.notes}</td>
                      </tr>
                    ))}
                    {workerDetailRows.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-center text-navy-800/50">No buying entries for the selected range.</td></tr>
                    )}
                  </tbody>
                  {workerDetailRows.length > 0 && (
                    <tfoot>
                      <tr className="font-semibold">
                        <td>Total</td>
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

function ActiveWorkforceCard({ counts }: { counts: { total: number; trucks: number; drivers: number; employees: number } }) {
  return (
    <div className="relative flex min-h-[108px] min-w-0 flex-col justify-center overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className="absolute inset-y-0 left-0 w-1 bg-cyan-500" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/45">Total Active Workforce</p>
          <p className="font-display text-lg font-bold leading-tight text-navy-900">{counts.total}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-600 text-white shadow-sm"><FiUserCheck /></span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-cyan-200 border-t border-cyan-100 pt-2 text-center">
        <div><p className="text-[9px] font-bold uppercase text-slate-500">Trucks</p><p className="text-base font-black text-cyan-700">{counts.trucks}</p></div>
        <div><p className="text-[9px] font-bold uppercase text-slate-500">Drivers</p><p className="text-base font-black text-cyan-700">{counts.drivers}</p></div>
        <div><p className="text-[9px] font-bold uppercase text-slate-500">Employees</p><p className="text-base font-black text-cyan-700">{counts.employees}</p></div>
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
