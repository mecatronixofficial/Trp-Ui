'use client';

import { useEffect, useRef, useState } from 'react';
import { FiBox, FiBriefcase, FiCheckCircle, FiMail, FiMapPin, FiPhone, FiSave, FiSettings, FiShield, FiUser, FiMessageCircle, FiUpload, FiTrash2 } from 'react-icons/fi';
import api from '../../../lib/api';

export default function SettingsPage() {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const logoReaderRef = useRef<FileReader | null>(null);

  useEffect(() => {
    api.get('/settings').then((r) => {
      setForm(r.data);
      if (r.data?.businessLogo) window.localStorage.setItem('tii_business_logo', r.data.businessLogo);
    });
  }, []);

  useEffect(() => () => logoReaderRef.current?.abort(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api.patch('/settings', form);
      if (form.businessLogo) window.localStorage.setItem('tii_business_logo', form.businessLogo);
      else window.localStorage.removeItem('tii_business_logo');
      window.dispatchEvent(new Event('tii-logo-change'));
      setSaved(true);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not save the admin profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <p className="text-navy-800/50">Loading...</p>;

  const updateField = (field: string, value: string | number) => setForm({ ...form, [field]: value });

  const selectLogo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP logo.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be smaller than 2 MB.');
      return;
    }
    logoReaderRef.current?.abort();
    const reader = new FileReader();
    logoReaderRef.current = reader;
    reader.onload = () => updateField('businessLogo', String(reader.result || ''));
    reader.onloadend = () => { if (logoReaderRef.current === reader) logoReaderRef.current = null; };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-7xl">
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-3xl bg-[#071824] text-white shadow-xl shadow-navy-900/15 lg:sticky lg:top-28 lg:self-start">
          <div className="relative overflow-hidden p-6">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/20 blur-2xl" />
            <div className="absolute -bottom-20 -left-14 h-44 w-44 rounded-full bg-blue-500/20 blur-2xl" />
            <img src={form.businessLogo || '/tiruppur-ice-logo.png'} alt="Tiruppur Ice" className="relative h-20 w-20 rounded-3xl border border-white/15 object-cover shadow-2xl" />
            <p className="relative mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">Admin Profile</p>
            <h2 className="relative mt-2 break-words font-display text-2xl font-black">{form.businessName || 'Tiruppur Ice'}</h2>
            <p className="relative mt-2 text-sm leading-6 text-slate-300">Manage business identity, recovery contacts, and production preferences.</p>
          </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-3 lg:grid-cols-1">
            <ProfileSummary icon={FiMail} label="Recovery email" value={form.email || 'Not configured'} tone="cyan" />
            <ProfileSummary icon={FiPhone} label="Mobile contact" value={form.phoneNumber || 'Not configured'} tone="blue" />
            <ProfileSummary icon={FiShield} label="Account security" value="OTP recovery enabled" tone="emerald" />
          </div>
        </aside>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-4 sm:px-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><FiBriefcase /></span>
              <div><p className="font-display font-bold text-navy-900">Business information</p><p className="text-xs text-slate-500">Details shown across administration and billing</p></div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><FiUpload className="text-iceblue-600" />Business Logo</label>
                <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4 sm:flex-row sm:items-center">
                  <img src={form.businessLogo || '/tiruppur-ice-logo.png'} alt="Logo preview" className="h-20 w-20 shrink-0 rounded-2xl border border-white object-cover shadow-md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy-900">Change business logo</p>
                    <p className="mt-1 text-xs text-slate-500">PNG, JPEG, or WebP. Maximum file size 2 MB.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="btn-primary inline-flex cursor-pointer items-center gap-2 text-xs"><FiUpload /> Choose Image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectLogo} className="hidden" /></label>
                      {form.businessLogo && <button type="button" onClick={() => updateField('businessLogo', '')} className="btn-secondary inline-flex items-center gap-2 text-xs"><FiTrash2 /> Use Default</button>}
                    </div>
                  </div>
                </div>
              </div>
              <Field label="Business Name" icon={FiUser}><input className="input-field bg-slate-50" value={form.businessName || ''} onChange={(e) => updateField('businessName', e.target.value)} /></Field>
              <Field label="GST Number" icon={FiBriefcase}><input className="input-field bg-slate-50" value={form.gstNumber || ''} onChange={(e) => updateField('gstNumber', e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Business Address" icon={FiMapPin}><input className="input-field bg-slate-50" value={form.address || ''} onChange={(e) => updateField('address', e.target.value)} /></Field></div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-teal-50 px-5 py-4 sm:px-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-600 text-white"><FiShield /></span>
              <div><p className="font-display font-bold text-navy-900">Reset and contact details</p><p className="text-xs text-slate-500">OTP recovery uses these verified contact channels</p></div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3 sm:p-6">
              <Field label="Mobile Number" icon={FiPhone}><input className="input-field bg-slate-50" value={form.phoneNumber || ''} onChange={(e) => updateField('phoneNumber', e.target.value)} /></Field>
              <Field label="WhatsApp Number" icon={FiMessageCircle}><input className="input-field bg-slate-50" value={form.whatsappNumber || ''} onChange={(e) => updateField('whatsappNumber', e.target.value)} /></Field>
              <Field label="Mail ID" icon={FiMail}><input type="email" className="input-field bg-slate-50" value={form.email || ''} onChange={(e) => updateField('email', e.target.value)} /></Field>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-4 sm:px-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white"><FiSettings /></span>
              <div><p className="font-display font-bold text-navy-900">Production configuration</p><p className="text-xs text-slate-500">Stock alerts and daily box-counter calculation</p></div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3 sm:p-6">
              <Field label="Low Stock Alert (bars)" icon={FiBox}><input type="number" min={0} className="input-field bg-slate-50" value={form.lowStockThreshold || 0} onChange={(e) => updateField('lowStockThreshold', Number(e.target.value))} /></Field>
              <Field label="Total Boxes" icon={FiBox}><input type="number" min={1} className="input-field bg-slate-50" value={form.totalBoxes ?? 200} onChange={(e) => updateField('totalBoxes', Number(e.target.value))} /></Field>
              <Field label="Bars per Box" icon={FiBox}><input type="number" min={1} className="input-field bg-slate-50" value={form.barsPerBox ?? 2} onChange={(e) => updateField('barsPerBox', Number(e.target.value))} /></Field>
            </div>
          </section>

          <div className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
            <div>
              {saved && <p className="flex items-center gap-2 px-2 text-sm font-semibold text-emerald-600"><FiCheckCircle /> Settings saved successfully.</p>}
              {error && <p className="px-2 text-sm font-semibold text-red-600">{error}</p>}
            </div>
            <button className="btn-primary flex min-w-44 items-center justify-center gap-2" disabled={saving}><FiSave />{saving ? 'Saving...' : 'Save Profile'}</button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ProfileSummary({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: 'cyan' | 'blue' | 'emerald' }) {
  const colors = { cyan: 'bg-cyan-400/15 text-cyan-200', blue: 'bg-blue-400/15 text-blue-200', emerald: 'bg-emerald-400/15 text-emerald-200' };
  return <div className="flex min-w-0 items-center gap-3 bg-white/[0.04] px-5 py-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${colors[tone]}`}><Icon /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-semibold text-white">{value}</p></div></div>;
}

function Field({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return <div><label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Icon className="text-iceblue-600" />{label}</label>{children}</div>;
}
