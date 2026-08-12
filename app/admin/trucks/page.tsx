'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiPlus, FiEdit2, FiTrash2, FiKey, FiPower, FiBox, FiCheck } from 'react-icons/fi';
import api from '../../../lib/api';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrency, formatDate, getItemBarUsed, todayISO } from '../../../lib/api';

interface Truck {
  _id: string;
  truckName: string;
  truckNumber: string;
  driverName: string;
  phoneNumber: string;
  loginId: string;
  status: boolean;
  branch?: { _id: string; name: string; code: string } | string;
}

interface Worker {
  _id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  truck?: { _id: string } | string;
}

const emptyForm = { branch: '', truckName: '', truckNumber: '', driverName: '', phoneNumber: '', loginId: '', password: '' };

function last30Days() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return date.toISOString().slice(0, 10);
}

export default function TrucksPage() {
  const { user } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Truck | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [resetTarget, setResetTarget] = useState<Truck | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [truckStock, setTruckStock] = useState<Record<string, number>>({});
  const [loadTarget, setLoadTarget] = useState<Truck | null>(null);
  const [loadForm, setLoadForm] = useState({ date: new Date().toISOString().slice(0, 10), quantity: '', notes: '' });
  const [tripCheck, setTripCheck] = useState<any>(null);
  const [dailyTotals, setDailyTotals] = useState({ taken: 0, sold: 0, remaining: 0, salesAmount: 0, pendingAmount: 0 });
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [assignInputs, setAssignInputs] = useState<Record<string, string>>({});
  const [totalInputs, setTotalInputs] = useState<Record<string, string>>({});
  const [savingAssign, setSavingAssign] = useState<string>('');
  const [assignTarget, setAssignTarget] = useState<Truck | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Truck | null>(null);
  const [historyRange, setHistoryRange] = useState({ from: last30Days(), to: todayISO() });
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/trucks');
    setTrucks(data);
    api.get('/workers').then(({ data: workerRows }) => setWorkers(workerRows)).catch(() => setWorkers([]));
    const stockRows = await Promise.all(data.map((truck: Truck) => api.get(`/stock/truck/${truck._id}`).catch(() => ({ data: { totalStock: 0 } }))));
    setTruckStock(Object.fromEntries(data.map((truck: Truck, index: number) => [truck._id, Number(stockRows[index].data.totalStock || 0)])));
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const [dailyRows, todaySales, assignRows] = await Promise.all([
      api.get('/truck-loads/reconciliation', { params: { date: today } }).catch(() => ({ data: [] })),
      api.get('/sales', { params: { from: today, to: tomorrow } }).catch(() => ({ data: [] })),
      api.get('/truck-assignments', { params: { date: today } }).catch(() => ({ data: [] })),
    ]);
    const barTotals = dailyRows.data.reduce((totals: any, row: any) => ({
      taken: totals.taken + Number(row.taken || 0),
      sold: totals.sold + Number(row.sold || 0),
      remaining: totals.remaining + Number(row.remaining || 0),
    }), { taken: 0, sold: 0, remaining: 0, salesAmount: 0, pendingAmount: 0 });
    const moneyTotals = todaySales.data.reduce((totals: any, sale: any) => ({
      salesAmount: totals.salesAmount + Number(sale.totalAmount || 0),
      pendingAmount: totals.pendingAmount + Number(sale.balanceAmount || 0),
    }), { salesAmount: 0, pendingAmount: 0 });
    setDailyTotals({ ...barTotals, ...moneyTotals });
    setAssignments(Object.fromEntries(assignRows.data.map((row: any) => [String(row.truck?._id || row.truck), Number(row.quantity || 0)])));
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (user?.role === 'super_admin') api.get('/branches').then(({ data }) => setBranches(data.filter((branch: any) => branch.isActive)));
  }, [user?.role]);

  const driverWorkers = useMemo(() => workers.filter((w) => w.role === 'Driver').sort((a, b) => a.name.localeCompare(b.name)), [workers]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, branch: branches[0]?._id || '' });
    setError('');
    setModalOpen(true);
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') !== 'truck') return;
    openCreate();
    window.history.replaceState({}, '', window.location.pathname);
  }, [branches]);

  const openEdit = (t: Truck) => {
    setEditing(t);
    setForm({
      truckName: t.truckName,
      truckNumber: t.truckNumber,
      driverName: t.driverName,
      phoneNumber: t.phoneNumber,
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
    const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
    const duplicate = trucks.find((truck) => truck._id !== editing?._id && (
      text(truck.truckName) === text(form.truckName) || text(truck.truckNumber) === text(form.truckNumber) ||
      (form.phoneNumber && phone(truck.phoneNumber) === phone(form.phoneNumber)) ||
      (form.loginId && text(truck.loginId) === text(form.loginId))
    ));
    if (duplicate) { setError('Truck name, vehicle number, phone number, and login ID must be unique.'); return; }
    try {
      if (editing) {
        await api.patch(`/trucks/${editing._id}`, form);
      } else {
        await api.post('/trucks', form);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong');
    }
  };

  const toggleStatus = async (t: Truck) => {
    await api.patch(`/trucks/${t._id}/${t.status ? 'deactivate' : 'activate'}`);
    load();
  };

  const remove = async (t: Truck) => {
    if (!confirm(`Delete truck "${t.truckName}"? This also removes its login.`)) return;
    await api.delete(`/trucks/${t._id}`);
    load();
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    await api.patch(`/trucks/${resetTarget._id}/reset-password`, { newPassword });
    setResetTarget(null);
    setNewPassword('');
    alert('Password reset successfully.');
  };

  const saveAssignment = async (t: Truck) => {
    const raw = assignInputs[t._id];
    const addQty = Number(raw || 0);
    if (!addQty || addQty <= 0) return;
    const quantity = Number(assignments[t._id] || 0) + addQty;
    setSavingAssign(t._id);
    try {
      await api.post('/truck-assignments', { truck: t._id, date: todayISO(), quantity });
      setAssignments({ ...assignments, [t._id]: quantity });
      setAssignInputs({ ...assignInputs, [t._id]: '' });
    } finally {
      setSavingAssign('');
    }
  };

  const saveTotalEdit = async (t: Truck) => {
    const raw = totalInputs[t._id];
    const current = Number(assignments[t._id] || 0);
    const quantity = raw === undefined ? current : Number(raw) || 0;
    if (quantity !== current) {
      setSavingAssign(t._id);
      try {
        await api.post('/truck-assignments', { truck: t._id, date: todayISO(), quantity });
        setAssignments({ ...assignments, [t._id]: quantity });
      } finally {
        setSavingAssign('');
      }
    }
    closeAssignModal(t._id);
  };

  const clearAssignment = async (t: Truck) => {
    if (!Number(assignments[t._id] || 0)) return;
    if (!confirm(`Clear today's assigned bars for "${t.truckName}"?`)) return;
    setSavingAssign(t._id);
    try {
      await api.post('/truck-assignments', { truck: t._id, date: todayISO(), quantity: 0 });
      setAssignments({ ...assignments, [t._id]: 0 });
      setTotalInputs((prev) => { const next = { ...prev }; delete next[t._id]; return next; });
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
    if (!loadTarget || !tripCheck) return;
    await api.post('/truck-loads/reconciliation/check', { truck: loadTarget._id, date: loadForm.date });
    setTripCheck({ ...tripCheck, checked: true, checkedAt: new Date().toISOString() });
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
      for (const row of loadRows.data) ensure(String(row.date).slice(0, 10)).taken += Number(row.quantity || 0);
      for (const sale of saleRows.data) {
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

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy-800/45">Today&apos;s Truck Summary</p>
          <span className="pill bg-iceblue-50 text-iceblue-700">{new Date().toLocaleDateString('en-IN')}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <DailyCard label="Bars Taken" value={dailyTotals.taken} />
          <DailyCard label="Bars Sold" value={dailyTotals.sold} />
          <DailyCard label="Remaining" value={dailyTotals.remaining} danger={dailyTotals.remaining < 0} />
          <DailyCard label="Selling Amount" value={formatCurrency(dailyTotals.salesAmount)} />
          <DailyCard label="Pending Amount" value={formatCurrency(dailyTotals.pendingAmount)} danger={dailyTotals.pendingAmount > 0} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-navy-900">Registered Trucks</h2>
          <p className="mt-0.5 text-sm text-navy-800/55">{trucks.length} truck(s) registered</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <FiPlus /> Add Truck
        </button>
      </div>

      <div className="overflow-x-auto border border-black bg-white">
        {loading ? (
          <p className="p-5 text-navy-800/50">Loading...</p>
        ) : (
          <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-xs text-black sm:text-sm">
            <thead className="bg-slate-100 text-black">
              <tr>
                <th className="w-[5%] border border-black px-1 py-2 text-center text-[10px] font-bold uppercase leading-tight">S.No</th>
                {user?.role === 'super_admin' && <th className="w-[10%] break-words border border-black px-2 py-2 text-[10px] font-bold uppercase leading-tight">Branch</th>}
                <th className="w-[13%] break-words border border-black px-2 py-2 text-[10px] font-bold uppercase leading-tight">Truck Name</th>
                <th className="w-[12%] break-words border border-black px-2 py-2 text-[10px] font-bold uppercase leading-tight">Truck Number</th>
                <th className="w-[13%] break-words border border-black px-2 py-2 text-[10px] font-bold uppercase leading-tight">Driver Name</th>
                <th className="w-[13%] break-words border border-black px-2 py-2 text-[10px] font-bold uppercase leading-tight">Phone Number</th>
                <th className="w-[11%] break-words border border-black px-2 py-2 text-[10px] font-bold uppercase leading-tight">Login ID</th>
                <th className="w-[8%] border border-black px-1 py-2 text-center text-[10px] font-bold uppercase leading-tight">Ice Bars</th>
                <th className="w-[8%] border border-black px-1 py-2 text-center text-[10px] font-bold uppercase leading-tight">Status</th>
                <th className="w-[17%] border border-black px-1 py-2 text-center text-[10px] font-bold uppercase leading-tight">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trucks.map((t, index) => (
                <tr key={t._id} className="bg-white text-black hover:bg-slate-100">
                  <td className="border border-black px-3 py-2 text-center font-medium text-black">{index + 1}</td>
                  {user?.role === 'super_admin' && <td className="break-words border border-black px-2 py-2 text-black">{typeof t.branch === 'object' ? `${t.branch.name} (${t.branch.code})` : '-'}</td>}
                  <td className="break-words border border-black px-2 py-2 text-black">
                    <Link href={`/admin/trucks/${t._id}`} className="font-medium text-black underline-offset-2 hover:underline">
                      {t.truckName}
                    </Link>
                  </td>
                  <td className="break-words border border-black px-2 py-2 font-medium text-black">{t.truckNumber}</td>
                  <td className="break-words border border-black px-2 py-2 text-black">{t.driverName || '-'}</td>
                  <td className="break-all border border-black px-2 py-2 text-black">{t.phoneNumber || '-'}</td>
                  <td className="break-all border border-black px-2 py-2 font-mono text-xs text-black">{t.loginId || '-'}</td>
                  <td className="border border-black px-1 py-2 text-center font-bold text-black">{truckStock[t._id] || 0}</td>
                  <td className="border border-black px-1 py-2 text-center">
                    <span className="font-medium text-black">
                      {t.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="border border-black px-1 py-2 text-black">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button title="Check daily truck account" onClick={() => openTripCheck(t)} className="text-black hover:text-slate-600"><FiBox /></button>
                      <button title="Edit" onClick={() => openEdit(t)} className="text-black hover:text-slate-600">
                        <FiEdit2 />
                      </button>
                      <button title="Reset password" onClick={() => setResetTarget(t)} className="text-black hover:text-slate-600">
                        <FiKey />
                      </button>
                      <button title="Toggle status" onClick={() => toggleStatus(t)} className="text-black hover:text-slate-600">
                        <FiPower />
                      </button>
                      <button title="Delete" onClick={() => remove(t)} className="text-black hover:text-slate-600">
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {trucks.length === 0 && (
                <tr><td colSpan={user?.role === 'super_admin' ? 10 : 9} className="border border-black px-4 py-10 text-center text-black">No trucks registered.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
              <label className="label-text">Driver</label>
              <select
                className="input-field"
                value=""
                onChange={(e) => {
                  const selected = driverWorkers.find((w) => w._id === e.target.value);
                  if (selected) setForm({ ...form, driverName: selected.name, phoneNumber: selected.phoneNumber || '' });
                }}
              >
                <option value="">Select driver</option>
                {driverWorkers.map((w) => (
                  <option key={w._id} value={w._id}>{w.name}{w.phoneNumber ? ` (${w.phoneNumber})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">Driver Name</label>
              <input className="input-field" required value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Phone Number</label>
              <input className="input-field" required value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button className="btn-primary w-full">{editing ? 'Save Changes' : 'Create Truck'}</button>
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
            <button className="btn-primary w-full">Reset Password</button>
          </form>
        </Modal>
      )}

      {assignTarget && (
        <Modal title={`Today's Bars: ${assignTarget.truckName}`} onClose={() => closeAssignModal(assignTarget._id)}>
          <div className="space-y-5">
            <div className="rounded-2xl bg-iceblue-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase text-navy-800/45">Assigned Today</p>
              <p className="mt-1 font-display text-3xl font-bold text-navy-900">{assignments[assignTarget._id] || 0} bars</p>
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
            <div className="overflow-x-auto">
              {historyLoading ? (
                <p className="text-navy-800/50">Loading...</p>
              ) : (
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
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DailyCard({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
    <p className="text-[11px] font-semibold uppercase text-navy-800/45">{label}</p>
    <p className={`mt-2 font-display text-xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
  </div>;
}
