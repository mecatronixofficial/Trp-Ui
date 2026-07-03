'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../../../lib/api';
import { COST_TYPES, formatCurrency, formatDate, todayISO } from '../../../lib/api';
import Modal from '../../../components/Modal';

export default function MakingCostPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), costType: 'electricity', amount: '', notes: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/making-cost');
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/making-cost', { ...form, amount: Number(form.amount) });
    setModalOpen(false);
    setForm({ date: todayISO(), costType: 'electricity', amount: '', notes: '' });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this cost entry?')) return;
    await api.delete(`/making-cost/${id}`);
    load();
  };

  const total = records.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-navy-800/60 text-sm">Total recorded: <span className="font-semibold text-navy-900">{formatCurrency(total)}</span></p>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <FiPlus /> Add Cost
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-navy-800/50">Loading...</p>
        ) : (
          <table className="table-base min-w-[600px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{COST_TYPES.find((c) => c.value === r.costType)?.label || r.costType}</td>
                  <td className="font-semibold">{formatCurrency(r.amount)}</td>
                  <td className="text-xs text-navy-800/60">{r.notes}</td>
                  <td>
                    <button onClick={() => remove(r._id)} className="text-red-500"><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title="Add Making Cost" onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label-text">Date</label>
              <input type="date" className="input-field" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Cost Type</label>
              <select className="input-field" value={form.costType} onChange={(e) => setForm({ ...form, costType: e.target.value })}>
                {COST_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Amount (₹)</label>
              <input type="number" min={0} step="0.01" required className="input-field" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button className="btn-primary w-full">Save Cost</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
