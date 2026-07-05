'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../../../lib/api';
import { WASTAGE_REASONS, formatBarQuantity, formatDate, getItemBarUsed, todayISO } from '../../../lib/api';
import Modal from '../../../components/Modal';

export default function WastagePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), truck: '', size: '1', quantity: '', reason: 'broken', notes: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/wastage');
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    api.get('/trucks').then((r) => setTrucks(r.data));
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/wastage', { ...form, truck: form.truck || undefined, size: '1', quantity: Number(form.quantity) });
    setModalOpen(false);
    setForm({ date: todayISO(), truck: '', size: '1', quantity: '', reason: 'broken', notes: '' });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this wastage entry?')) return;
    await api.delete(`/wastage/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-navy-800/60 text-sm">Track broken, melted, damaged, or unsold ice bars</p>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <FiPlus /> Add Wastage
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-navy-800/50">Loading...</p>
        ) : (
          <table className="table-base min-w-[700px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Truck</th>
                <th>Bar Used</th>
                <th>Reason</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.truck?.truckName || 'Factory'}</td>
                  <td>{formatBarQuantity(getItemBarUsed(r))}</td>
                  <td className="capitalize">{r.reason}</td>
                  <td className="text-xs text-navy-800/60">{r.notes}</td>
                  <td><button onClick={() => remove(r._id)} className="text-red-500"><FiTrash2 /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title="Add Wastage" onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label-text">Date</label>
              <input type="date" className="input-field" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Truck (optional — leave blank for factory wastage)</label>
              <select className="input-field" value={form.truck} onChange={(e) => setForm({ ...form, truck: e.target.value })}>
                <option value="">Factory</option>
                {trucks.map((t) => <option key={t._id} value={t._id}>{t.truckName}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Bar Used</label>
              <input
                type="number"
                min={0.25}
                step={0.25}
                required
                placeholder="Bar Used e.g. 0.25, 1.25"
                className="input-field"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">Reason</label>
              <select className="input-field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {WASTAGE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button className="btn-primary w-full">Save Wastage</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
