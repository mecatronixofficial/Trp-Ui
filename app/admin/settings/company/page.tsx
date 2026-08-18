'use client';

import { useEffect, useRef, useState } from 'react';
import { FiBox, FiBriefcase, FiCheckCircle, FiMail, FiMapPin, FiMessageCircle, FiPhone, FiSave, FiSettings, FiShield, FiTrash2, FiUpload, FiUser } from 'react-icons/fi';
import api from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { CardFooter, Field, ProfileRow, SettingsCard } from '../../../../components/SettingsCardKit';

export default function CompanyProfilePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

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
      // A branch admin may only touch business identity — send just those
      // fields rather than the whole form, or the backend rejects the
      // request outright for still carrying the disabled, super-admin-only
      // fields (recovery contacts, box config) even though they're unchanged.
      const payload = isSuperAdmin
        ? form
        : { businessName: form.businessName, businessLogo: form.businessLogo, gstNumber: form.gstNumber, address: form.address };
      await api.patch('/settings', payload);
      if (form.businessLogo) window.localStorage.setItem('tii_business_logo', form.businessLogo);
      else window.localStorage.removeItem('tii_business_logo');
      window.dispatchEvent(new Event('tii-logo-change'));
      setSaved(true);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not save the company profile.');
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
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-28 lg:self-start">
          <div className="border-b border-slate-100 bg-slate-50/70 p-6 text-center">
            <img src={form.businessLogo || '/tiruppur-ice-logo.png'} alt="Business logo" className="mx-auto h-16 w-16 rounded-full border border-white object-cover shadow-lg" />
            <h2 className="mt-4 break-words font-display text-lg font-bold text-navy-900">{form.businessName || 'Tiruppur Ice'}</h2>
            <p className="text-sm text-slate-500">{form.gstNumber || 'GST not configured'}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
              <FiBriefcase className="text-[13px]" /> Company Profile
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            <ProfileRow icon={FiMapPin} label="Address" value={form.address || 'Not configured'} />
            <ProfileRow icon={FiPhone} label="Recovery Mobile" value={form.phoneNumber || 'Not configured'} />
          </div>
        </aside>

        <form onSubmit={submit} className="space-y-4">
          <SettingsCard step="01" icon={FiBriefcase} title="Business Information" subtitle="Your shop's identity — name, logo, GST and address">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><FiUpload className="text-indigo-600" />Business Logo</label>
                <div className="flex flex-col gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center">
                  <img src={form.businessLogo || '/tiruppur-ice-logo.png'} alt="Logo preview" className="h-20 w-20 shrink-0 rounded-xl border border-white object-cover shadow-md" />
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
              <Field label="Business Name" icon={FiUser}><input className="input-field" value={form.businessName || ''} onChange={(e) => updateField('businessName', e.target.value)} /></Field>
              <Field label="GST Number" icon={FiBriefcase}><input className="input-field" value={form.gstNumber || ''} onChange={(e) => updateField('gstNumber', e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Business Address" icon={FiMapPin}><input className="input-field" value={form.address || ''} onChange={(e) => updateField('address', e.target.value)} /></Field></div>
            </div>
            {!isSuperAdmin && <CardFooter saved={saved} savedText="Settings saved successfully." error={error} saving={saving} label="Save Business Info" />}
          </SettingsCard>

          <fieldset disabled={!isSuperAdmin} className="m-0 space-y-4 border-0 p-0 disabled:opacity-60">
            <SettingsCard step="02" icon={FiShield} title="Recovery & Contact Details" subtitle="OTP recovery uses these verified contact channels">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Mobile Number" icon={FiPhone}><input className="input-field" value={form.phoneNumber || ''} onChange={(e) => updateField('phoneNumber', e.target.value)} /></Field>
                <Field label="WhatsApp Number" icon={FiMessageCircle}><input className="input-field" value={form.whatsappNumber || ''} onChange={(e) => updateField('whatsappNumber', e.target.value)} /></Field>
                <Field label="Mail ID" icon={FiMail}><input type="email" className="input-field" value={form.email || ''} onChange={(e) => updateField('email', e.target.value)} /></Field>
              </div>
            </SettingsCard>

            <SettingsCard step="03" icon={FiSettings} title="Production Configuration" subtitle="Stock alerts and daily box-counter calculation">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Low Stock Alert (bars)" icon={FiBox}><input type="number" min={0} className="input-field" value={form.lowStockThreshold || 0} onChange={(e) => updateField('lowStockThreshold', Number(e.target.value))} /></Field>
                <Field label="Total Boxes" icon={FiBox}><input type="number" min={1} className="input-field" value={form.totalBoxes ?? 200} onChange={(e) => updateField('totalBoxes', Number(e.target.value))} /></Field>
                <Field label="Bars per Box" icon={FiBox}><input type="number" min={1} className="input-field" value={form.barsPerBox ?? 2} onChange={(e) => updateField('barsPerBox', Number(e.target.value))} /></Field>
              </div>
            </SettingsCard>
          </fieldset>

          {isSuperAdmin && (
            <div className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
              <div>
                {saved && <p className="flex items-center gap-2 px-2 text-sm font-semibold text-emerald-600"><FiCheckCircle /> Settings saved successfully.</p>}
                {error && <p className="px-2 text-sm font-semibold text-red-600">{error}</p>}
              </div>
              <button className="btn-primary flex min-w-44 items-center justify-center gap-2" disabled={saving}><FiSave />{saving ? 'Saving...' : 'Save Profile'}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
