'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiEdit2, FiPlus, FiTrash2, FiUserCheck } from 'react-icons/fi';
import api from '../../../lib/api';
import { formatCurrency, formatDate, todayISO } from '../../../lib/api';
import Modal from '../../../components/Modal';

type Worker = {
  _id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  notes?: string;
  truck?: string;
};

const emptyWorkerForm = { name: '', phoneNumber: '', role: '', notes: '' };
const WORKER_ROLE_OPTIONS = ['Driver', 'Cleaner', 'Manager'];
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
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<any[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [buyingModalOpen, setBuyingModalOpen] = useState(false);
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

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = monthRange(month);
      const [workerRows, summaryRows, driverRows, expenseRows] = await Promise.all([
        api.get('/workers'),
        api.get('/workers/summary', { params: { month } }),
        api.get('/trucks'),
        api.get('/driver-expenses', { params: { from, to } }),
      ]);
      setWorkers(workerRows.data);
      setSummary(summaryRows.data);
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
  const totalDriverSalary = useMemo(() => drivers.reduce((sum, driver) => sum + Number(driver.monthlySalary || 0), 0), [drivers]);

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
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="min-w-0 space-y-3">
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <SummaryPill label="Total Workers" value={String(workers.length + drivers.length)} />
          <SummaryPill label="Monthly Salary" value={formatCurrency(totalDriverSalary)} />
          <SummaryPill label="Total Buying" value={formatCurrency(totals.buying + totalDriverAmount)} />
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
                <th>Name</th>
                <th>Role</th>
                <th>Buying Amount</th>
                <th>Buying Days</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {peopleSummary.map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold">
                    <Link
                      href={`/admin/workers/${row.isDriver ? row.driver._id : row.worker?._id || row.id}`}
                      className="text-iceblue-700 underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td>{row.role}</td>
                  <td className="font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td>
                  <td>{row.buyingDays}</td>
                  <td>
                    {!row.isDriver && (
                      <div className="flex items-center gap-2">
                        <button title="Add buying" onClick={() => openCreateBuying(row.id)} className="text-emerald-600"><FiUserCheck /></button>
                        {row.worker && <button title="Edit worker" onClick={() => openEditWorker(row.worker)} className="text-iceblue-600"><FiEdit2 /></button>}
                        {row.worker && <button title="Remove worker" onClick={() => removeWorker(row.worker)} className="text-red-500"><FiTrash2 /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {peopleSummary.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-navy-800/50">No workers or drivers added yet.</td></tr>
              )}
            </tbody>
          </table></div>
        )}
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
                <table className="table-base min-w-[500px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Buying Amount</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerDetailRows.map((row) => (
                      <tr key={row._id}>
                        <td>{formatDate(row.date)}</td>
                        <td className="font-semibold text-red-500">{formatCurrency(row.buyingAmount)}</td>
                        <td className="text-xs text-navy-800/60">{row.notes}</td>
                      </tr>
                    ))}
                    {workerDetailRows.length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-navy-800/50">No buying entries for the selected range.</td></tr>
                    )}
                  </tbody>
                  {workerDetailRows.length > 0 && (
                    <tfoot>
                      <tr className="font-semibold">
                        <td>Total</td>
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

function SummaryPill({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-iceblue-100 bg-white px-3 py-2 shadow-sm sm:px-4 sm:py-3">
      <p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold sm:text-base ${danger ? 'text-red-500' : 'text-navy-900'}`}>{value}</p>
    </div>
  );
}
