'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiKey, FiPower } from 'react-icons/fi';
import api from '../../../lib/api';
import Modal from '../../../components/Modal';

interface Truck {
  _id: string;
  truckName: string;
  truckNumber: string;
  driverName: string;
  phoneNumber: string;
  loginId: string;
  status: boolean;
}

const emptyForm = { truckName: '', truckNumber: '', driverName: '', phoneNumber: '', loginId: '', password: '' };

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Truck | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [resetTarget, setResetTarget] = useState<Truck | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/trucks');
    setTrucks(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (t: Truck) => {
    setEditing(t);
    setForm({ truckName: t.truckName, truckNumber: t.truckNumber, driverName: t.driverName, phoneNumber: t.phoneNumber });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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

  return (
    <div className="space-y-4">
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
                <th>Truck</th>
                <th>Number</th>
                <th>Driver</th>
                <th>Phone</th>
                <th>Login ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trucks.map((t) => (
                <tr key={t._id}>
                  <td className="font-medium">{t.truckName}</td>
                  <td>{t.truckNumber}</td>
                  <td>{t.driverName}</td>
                  <td>{t.phoneNumber}</td>
                  <td>{t.loginId}</td>
                  <td>
                    <span className={`pill ${t.status ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {t.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
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
    </div>
  );
}
