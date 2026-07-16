'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2, FiUserCheck } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency, formatDate, todayISO } from '../../../lib/api';
import Modal from '../../../components/Modal';

type Worker = {
  _id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  monthlySalary: number;
  notes?: string;
};

const emptyWorkerForm = { name: '', phoneNumber: '', role: '', monthlySalary: '', notes: '' };
const emptyBuyingForm = { worker: '', date: todayISO(), buyingAmount: '', notes: '' };

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
  const [buyingRecords, setBuyingRecords] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<any[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [buyingModalOpen, setBuyingModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editingBuying, setEditingBuying] = useState<any | null>(null);
  const [workerForm, setWorkerForm] = useState<any>(emptyWorkerForm);
  const [buyingForm, setBuyingForm] = useState<any>(emptyBuyingForm);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = monthRange(month);
    const [workerRows, summaryRows, buyingRows, driverRows, expenseRows] = await Promise.all([
      api.get('/workers'),
      api.get('/workers/summary', { params: { month } }),
      api.get('/workers/buying', { params: { from, to } }),
      api.get('/trucks'),
      api.get('/driver-expenses', { params: { from, to } }),
      ]);
      setWorkers(workerRows.data);
      setSummary(summaryRows.data);
      setBuyingRecords(buyingRows.data);
      setDrivers(driverRows.data);
      setDriverExpenses(expenseRows.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load workers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [month]);

  const totals = useMemo(() => summary.reduce((acc, row) => ({
    salary: acc.salary + Number(row.monthlySalary || 0),
    buying: acc.buying + Number(row.buyingAmount || 0),
    balance: acc.balance + Number(row.balanceAmount || 0),
  }), { salary: 0, buying: 0, balance: 0 }), [summary]);

  const driverSummary = useMemo(() => drivers.map((driver) => {
    const rows = driverExpenses.filter((expense) => String(expense.truck?._id || expense.truck) === driver._id);
    const amount = rows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const salary = Number(driver.monthlySalary || 0);
    return { ...driver, amount, salary, balance: salary - amount, entries: rows.length };
  }), [drivers, driverExpenses]);
  const totalDriverAmount = useMemo(() => driverExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [driverExpenses]);
  const totalDriverSalary = useMemo(() => drivers.reduce((sum, driver) => sum + Number(driver.monthlySalary || 0), 0), [drivers]);

  const openCreateWorker = () => {
    setEditingWorker(null);
    setWorkerForm(emptyWorkerForm);
    setError('');
    setWorkerModalOpen(true);
  };

  const openEditWorker = (worker: Worker) => {
    setEditingWorker(worker);
    setWorkerForm({
      name: worker.name,
      phoneNumber: worker.phoneNumber || '',
      role: worker.role || '',
      monthlySalary: String(worker.monthlySalary || ''),
      notes: worker.notes || '',
    });
    setError('');
    setWorkerModalOpen(true);
  };

  const saveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { ...workerForm, monthlySalary: Number(workerForm.monthlySalary) || 0 };
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
    setEditingBuying(null);
    setBuyingForm({ ...emptyBuyingForm, worker: workerId || workers[0]?._id || '' });
    setError('');
    setBuyingModalOpen(true);
  };

  const openEditBuying = (record: any) => {
    setEditingBuying(record);
    setBuyingForm({
      worker: record.worker?._id || record.worker,
      date: String(record.date).slice(0, 10),
      buyingAmount: String(record.buyingAmount || ''),
      notes: record.notes || '',
    });
    setError('');
    setBuyingModalOpen(true);
  };

  const saveBuying = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { ...buyingForm, buyingAmount: Number(buyingForm.buyingAmount) || 0 };
    try {
      if (editingBuying) await api.patch(`/workers/buying/${editingBuying._id}`, payload);
      else await api.post('/workers/buying', payload);
      setBuyingModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save buying amount');
    }
  };

  const removeBuying = async (id: string) => {
    if (!confirm('Delete this buying record?')) return;
    await api.delete(`/workers/buying/${id}`);
    load();
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="min-w-0 space-y-3">
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <SummaryPill label="Total Workers" value={String(workers.length + drivers.length)} />
          <SummaryPill label="Monthly Salary" value={formatCurrency(totals.salary + totalDriverSalary)} />
          <SummaryPill label="Total Buying" value={formatCurrency(totals.buying + totalDriverAmount)} />
          <SummaryPill label="Total Drivers" value={String(drivers.length)} />
          <SummaryPill label="Driver Amount" value={formatCurrency(totalDriverAmount)} danger={totalDriverAmount > 0} />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:w-fit sm:grid-cols-3">
          <input type="month" className="input-field col-span-2 h-11 sm:col-span-1 sm:w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button onClick={() => openCreateBuying()} className="btn-secondary flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap px-2 sm:px-4">
            <FiUserCheck /> Daily Buying
          </button>
          <button onClick={openCreateWorker} className="btn-primary flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap px-2 sm:px-4">
            <FiPlus /> Add Worker
          </button>
        </div>
      </div>

      {error && !workerModalOpen && !buyingModalOpen && (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>
      )}

      <div className="card min-w-0 overflow-hidden p-3 sm:p-5">
        {loading ? (
          <p className="text-navy-800/50">Loading...</p>
        ) : (
          <div className="w-full overflow-x-auto pb-1"><table className="table-base min-w-[820px]">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Role</th>
                <th>Monthly Salary</th>
                <th>Buying Amount</th>
                <th>Balance</th>
                <th>Buying Days</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => {
                const worker = workers.find((item) => item._id === row.workerId);
                return (
                  <tr key={row.workerId}>
                    <td className="font-semibold">{row.name}</td>
                    <td>{row.role || '-'}</td>
                    <td>{formatCurrency(row.monthlySalary)}</td>
                    <td className="font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td>
                    <td className={Number(row.balanceAmount) < 0 ? 'font-semibold text-red-500' : 'font-semibold text-emerald-600'}>
                      {formatCurrency(row.balanceAmount)}
                    </td>
                    <td>{row.buyingDays || 0}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button title="Add buying" onClick={() => openCreateBuying(row.workerId)} className="text-emerald-600"><FiUserCheck /></button>
                        {worker && <button title="Edit worker" onClick={() => openEditWorker(worker)} className="text-iceblue-600"><FiEdit2 /></button>}
                        {worker && <button title="Remove worker" onClick={() => removeWorker(worker)} className="text-red-500"><FiTrash2 /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {summary.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-navy-800/50">No workers added yet.</td></tr>
              )}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card min-w-0 overflow-hidden p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display font-semibold text-navy-900">Driver Amount Summary</p>
          <p className="text-xs text-navy-800/50">{month}</p>
        </div>
        <div className="w-full overflow-x-auto pb-1"><table className="table-base min-w-[650px]">
          <thead><tr><th>Driver</th><th>Truck</th><th>Monthly Salary</th><th>Buying / Advance</th><th>Balance Salary</th></tr></thead>
          <tbody>
            {driverSummary.map((driver) => <tr key={driver._id}>
              <td className="font-semibold">{driver.driverName}</td>
              <td>{driver.truckName} ({driver.truckNumber})</td>
              <td>{formatCurrency(driver.salary)}</td>
              <td className={driver.amount > 0 ? 'font-semibold text-amber-600' : ''}>{formatCurrency(driver.amount)}</td>
              <td className={driver.balance < 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>{formatCurrency(driver.balance)}</td>
            </tr>)}
            {!driverSummary.length && <tr><td colSpan={5} className="py-4 text-center text-navy-800/50">No drivers available.</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="card min-w-0 overflow-hidden p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display font-semibold text-navy-900">Daily Worker Buying</p>
          <p className="text-xs text-navy-800/50">{buyingRecords.length} record(s)</p>
        </div>
        <div className="w-full overflow-x-auto pb-1"><table className="table-base min-w-[700px]">
          <thead>
            <tr>
              <th>Date</th>
              <th>Worker</th>
              <th>Buying Amount</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {buyingRecords.map((record) => (
              <tr key={record._id}>
                <td>{formatDate(record.date)}</td>
                <td className="font-medium">{record.worker?.name || 'Worker'}</td>
                <td className="font-semibold">{formatCurrency(record.buyingAmount)}</td>
                <td className="text-xs text-navy-800/60">{record.notes}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditBuying(record)} className="text-iceblue-600"><FiEdit2 /></button>
                    <button onClick={() => removeBuying(record._id)} className="text-red-500"><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
            {buyingRecords.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-navy-800/50">No buying records for this month.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>

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
                <input className="input-field" placeholder="Loader, cleaner..." value={workerForm.role} onChange={(e) => setWorkerForm({ ...workerForm, role: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label-text">Monthly Salary</label>
              <input type="number" min={0} step="0.01" required className="input-field" value={workerForm.monthlySalary} onChange={(e) => setWorkerForm({ ...workerForm, monthlySalary: e.target.value })} />
            </div>
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
        <Modal title={editingBuying ? 'Edit Daily Buying' : 'Daily Worker Buying'} onClose={() => setBuyingModalOpen(false)}>
          <form onSubmit={saveBuying} className="space-y-3">
            <div>
              <label className="label-text">Worker</label>
              <select required className="input-field" value={buyingForm.worker} onChange={(e) => setBuyingForm({ ...buyingForm, worker: e.target.value })}>
                <option value="">Select worker</option>
                {workers.map((worker) => <option key={worker._id} value={worker._id}>{worker.name}</option>)}
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
    </div>
  );
}

function SummaryPill({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white px-3 py-2 shadow-sm sm:px-4 sm:py-3">
      <p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold sm:text-base ${danger ? 'text-red-500' : 'text-navy-900'}`}>{value}</p>
    </div>
  );
}
