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

  const updateField = (field: string, value: string | number) => setForm({ ...form, [field]: value });

  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase text-iceblue-600">Admin profile</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-navy-900">Business and reset contacts</h2>
        <p className="mt-1 text-sm text-navy-800/60">
          Password reset OTPs are sent automatically to the email, mobile, or WhatsApp number saved here.
        </p>
      </div>
      <div>
        <label className="label-text">Business Name</label>
        <input className="input-field" value={form.businessName || ''} onChange={(e) => updateField('businessName', e.target.value)} />
      </div>
      <div>
        <label className="label-text">Address</label>
        <input className="input-field" value={form.address || ''} onChange={(e) => updateField('address', e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label-text">Mobile Number</label>
          <input className="input-field" value={form.phoneNumber || ''} onChange={(e) => updateField('phoneNumber', e.target.value)} />
        </div>
        <div>
          <label className="label-text">WhatsApp Number</label>
          <input className="input-field" value={form.whatsappNumber || ''} onChange={(e) => updateField('whatsappNumber', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label-text">Mail ID</label>
        <input type="email" className="input-field" value={form.email || ''} onChange={(e) => updateField('email', e.target.value)} />
      </div>
      <div>
        <label className="label-text">GST Number</label>
        <input className="input-field" value={form.gstNumber || ''} onChange={(e) => updateField('gstNumber', e.target.value)} />
      </div>
      <div>
        <label className="label-text">Low Stock Alert Threshold (bars)</label>
        <input type="number" min={0} className="input-field" value={form.lowStockThreshold || 0} onChange={(e) => updateField('lowStockThreshold', Number(e.target.value))} />
      </div>
      {saved && <p className="text-emerald-600 text-sm">Settings saved.</p>}
      <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
    </form>
  );
}
