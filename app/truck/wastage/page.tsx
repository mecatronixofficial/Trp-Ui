'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ICE_BAR_SIZES, WASTAGE_REASONS, todayISO } from '../../../lib/api';

export default function TruckWastagePage() {
  const router = useRouter();
  const [form, setForm] = useState({ date: todayISO(), size: '1', quantity: '', reason: 'unsold', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/wastage', { ...form, quantity: Number(form.quantity) });
      router.push('/truck/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save wastage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-text">Date</label>
          <input type="date" className="input-field" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">Size</label>
            <select className="input-field" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
              {ICE_BAR_SIZES.map((s) => <option key={s} value={s}>{s} bar</option>)}
            </select>
          </div>
          <div>
            <label className="label-text">Quantity</label>
            <input type="number" min={1} required className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
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
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving...' : 'Save Wastage'}</button>
      </form>
    </div>
  );
}
