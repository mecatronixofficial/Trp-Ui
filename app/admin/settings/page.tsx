'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';

export default function SettingsPage() {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/settings').then((r) => setForm(r.data));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await api.patch('/settings', form);
    setSaving(false);
    setSaved(true);
  };

  if (!form) return <p className="text-navy-800/50">Loading...</p>;

  return (
    <form onSubmit={submit} className="card max-w-lg space-y-4">
      <div>
        <label className="label-text">Business Name</label>
        <input className="input-field" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
      </div>
      <div>
        <label className="label-text">Address</label>
        <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div>
        <label className="label-text">Phone Number</label>
        <input className="input-field" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
      </div>
      <div>
        <label className="label-text">GST Number</label>
        <input className="input-field" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
      </div>
      <div>
        <label className="label-text">Low Stock Alert Threshold (bars)</label>
        <input type="number" min={0} className="input-field" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} />
      </div>
      {saved && <p className="text-emerald-600 text-sm">Settings saved.</p>}
      <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
    </form>
  );
}
