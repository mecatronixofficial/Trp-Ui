'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiKey, FiPower, FiBox } from 'react-icons/fi';
import api from '../../../lib/api';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrency } from '../../../lib/api';

interface Truck {
  _id: string;
  truckName: string;
  truckNumber: string;
  driverName: string;
  phoneNumber: string;
  monthlySalary?: number;
  loginId: string;
  status: boolean;
  branch?: { _id: string; name: string; code: string } | string;
}

const emptyForm = { branch: '', truckName: '', truckNumber: '', driverName: '', phoneNumber: '', monthlySalary: '', loginId: '', password: '' };

export default function TrucksPage() {
  const { user } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
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

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/trucks');
    setTrucks(data);
    const stockRows = await Promise.all(data.map((truck: Truck) => api.get(`/stock/truck/${truck._id}`).catch(() => ({ data: { totalStock: 0 } }))));
    setTruckStock(Object.fromEntries(data.map((truck: Truck, index: number) => [truck._id, Number(stockRows[index].data.totalStock || 0)])));
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const [dailyRows, todaySales] = await Promise.all([
      api.get('/truck-loads/reconciliation', { params: { date: today } }).catch(() => ({ data: [] })),
      api.get('/sales', { params: { from: today, to: tomorrow } }).catch(() => ({ data: [] })),
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
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (user?.role === 'super_admin') api.get('/branches').then(({ data }) => setBranches(data.filter((branch: any) => branch.isActive)));
  }, [user?.role]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, branch: branches[0]?._id || '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (t: Truck) => {
    setEditing(t);
    setForm({ truckName: t.truckName, truckNumber: t.truckNumber, driverName: t.driverName, phoneNumber: t.phoneNumber, monthlySalary: String(t.monthlySalary || '') });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.patch(`/trucks/${editing._id}`, { ...form, monthlySalary: Number(form.monthlySalary) || 0 });
      } else {
        await api.post('/trucks', { ...form, monthlySalary: Number(form.monthlySalary) || 0 });
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
      <div className="flex items-center justify-between">
        <p className="text-navy-800/60 text-sm">{trucks.length} truck(s) registered</p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <FiPlus /> Add Truck
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-navy-800/50">Loading...</p>
        ) : (
          <table className="table-base min-w-[700px]">
            <thead>
              <tr>
                {user?.role === 'super_admin' && <th>Branch</th>}
                <th>Truck</th>
                <th>Number</th>
                <th>Driver</th>
                <th>Phone</th>
                <th>Login ID</th>
                <th>Ice Bars In Truck</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trucks.map((t) => (
                <tr key={t._id}>
                  {user?.role === 'super_admin' && <td>{typeof t.branch === 'object' ? `${t.branch.name} (${t.branch.code})` : '-'}</td>}
                  <td className="font-medium">{t.truckName}</td>
                  <td>{t.truckNumber}</td>
                  <td>{t.driverName}</td>
                  <td>{t.phoneNumber}</td>
                  <td>{t.loginId}</td>
                  <td><span className={`font-bold ${truckStock[t._id] < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{truckStock[t._id] || 0}</span></td>
                  <td>
                    <span className={`pill ${t.status ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {t.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button title="Check daily truck account" onClick={() => openTripCheck(t)} className="text-emerald-600 hover:text-emerald-700"><FiBox /></button>
                      <button title="Edit" onClick={() => openEdit(t)} className="text-iceblue-600 hover:text-iceblue-700">
                        <FiEdit2 />
                      </button>
                      <button title="Reset password" onClick={() => setResetTarget(t)} className="text-amber-600 hover:text-amber-700">
                        <FiKey />
                      </button>
                      <button title="Toggle status" onClick={() => toggleStatus(t)} className="text-navy-700 hover:text-navy-900">
                        <FiPower />
                      </button>
                      <button title="Delete" onClick={() => remove(t)} className="text-red-500 hover:text-red-600">
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
            <div>
              <label className="label-text">Driver Name</label>
              <input className="input-field" required value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Phone Number</label>
              <input className="input-field" required value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Driver Monthly Salary</label>
              <input type="number" min={0} step="0.01" className="input-field" required value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} />
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
    </div>
  );
}

function DailyCard({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-2xl border border-iceblue-100 bg-white p-4 shadow-sm">
    <p className="text-[11px] font-semibold uppercase text-navy-800/45">{label}</p>
    <p className={`mt-2 font-display text-xl font-bold ${danger ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
  </div>;
}
