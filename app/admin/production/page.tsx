'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../../../lib/api';
import { PRODUCTION_ICE_BAR_SIZES, formatDate, todayISO } from '../../../lib/api';
import Modal from '../../../components/Modal';

export default function ProductionPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState('full_day');
  const [notes, setNotes] = useState('');
  const [sizeWise, setSizeWise] = useState<Record<string, string>>(
    Object.fromEntries(PRODUCTION_ICE_BAR_SIZES.map((s) => [s, ''])),
  );

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/production');
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const total = Object.values(sizeWise).reduce((s, v) => s + (Number(v) || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      date,
      shift,
      notes,
      sizeWise: PRODUCTION_ICE_BAR_SIZES.map((size) => ({ size, quantity: Number(sizeWise[size]) || 0 })).filter((s) => s.quantity > 0),
    };
    await api.post('/production', payload);
    setModalOpen(false);
    setSizeWise(Object.fromEntries(PRODUCTION_ICE_BAR_SIZES.map((s) => [s, ''])));
    setNotes('');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this production record?')) return;
    await api.delete(`/production/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-navy-800/60 text-sm">Daily production is usually 130–200 bars</p>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <FiPlus /> Add Production
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
                <th>Shift</th>
                <th>Size-wise</th>
                <th>Total Bars</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>{formatDate(r.date)}</td>
                  <td className="capitalize">{r.shift.replace('_', ' ')}</td>
                  <td className="text-xs text-navy-800/70">
                    {r.sizeWise.map((s: any) => `${s.size}: ${s.quantity}`).join(', ')}
                  </td>
                  <td className="font-semibold">{r.totalBars}</td>
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
        <Modal title="Add Daily Production" onClose={() => setModalOpen(false)} wide>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Date</label>
                <input type="date" className="input-field" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label-text">Shift</label>
                <select className="input-field" value={shift} onChange={(e) => setShift(e.target.value)}>
                  <option value="full_day">Full Day</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label-text">Full Bar Production</label>
              <div className="grid grid-cols-3 gap-3">
                {PRODUCTION_ICE_BAR_SIZES.map((size) => (
                  <div key={size}>
                    <span className="text-xs text-navy-800/60">{size} bar</span>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={sizeWise[size]}
                      onChange={(e) => setSizeWise({ ...sizeWise, [size]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-iceblue-600 font-semibold mt-2">Total: {total} bars</p>
            </div>

            <div>
              <label className="label-text">Notes</label>
              <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button className="btn-primary w-full">Save Production</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
