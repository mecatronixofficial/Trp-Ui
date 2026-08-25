'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  FiBox,
  FiBriefcase,
  FiCamera,
  FiCheckCircle,
  FiEdit2,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiSettings,
  FiShield,
  FiTrash2,
  FiUpload,
  FiUser,
  FiX,
} from 'react-icons/fi';
import api from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';

const normalizedPhone = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

function SectionCard({
  step,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  step: string;
  icon: any;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
      <div className="flex items-center gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white px-5 py-4 sm:px-6 sm:py-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-iceblue-50 text-lg text-iceblue-700 ring-1 ring-iceblue-100"><Icon /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold tracking-tight text-navy-900">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
        <span className="hidden text-3xl font-black tracking-tight text-slate-100 sm:block">{step}</span>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function SettingField({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><Icon className="text-iceblue-600" />{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 last:border-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-100"><Icon /></span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p title={value} className="mt-0.5 truncate text-sm font-bold text-navy-900">{value}</p>
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, accent = 'slate' }: { icon: any; label: string; value: React.ReactNode; accent?: 'slate' | 'blue' | 'emerald' }) {
  const accents = {
    slate: 'bg-slate-50 text-slate-500 ring-slate-100',
    blue: 'bg-iceblue-50 text-iceblue-700 ring-iceblue-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  };
  return (
    <div className="flex min-h-24 items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${accents[accent]}`}><Icon /></span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div className="mt-1 break-words text-sm font-extrabold leading-6 text-navy-900">{value === null || value === undefined || value === '' ? 'Not configured' : value}</div>
      </div>
    </div>
  );
}

export default function CompanyProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [form, setForm] = useState<any>(null);
  const [persistedForm, setPersistedForm] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const logoReaderRef = useRef<FileReader | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    api.get('/settings')
      .then((response) => {
        if (!active) return;
        setForm(response.data);
        setPersistedForm(response.data);
        if (response.data?.businessLogo) window.localStorage.setItem('tii_business_logo', response.data.businessLogo);
        else window.localStorage.removeItem('tii_business_logo');
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError?.response?.data?.message || 'Could not load the company profile.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => () => logoReaderRef.current?.abort(), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (authLoading || !user) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      if (!String(form.businessName || '').trim()) {
        throw new Error('Enter the business name before saving.');
      }
      const mobile = normalizedPhone(form.phoneNumber);
      if (isSuperAdmin && mobile && mobile.length !== 10) {
        throw new Error('Enter a valid 10-digit mobile number.');
      }
      if (isSuperAdmin && form.email && !/^\S+@\S+\.\S+$/.test(String(form.email).trim())) {
        throw new Error('Enter a valid recovery email address.');
      }
      // Branch admins may update business identity only. Sending the restricted
      // fields would cause the backend to reject an otherwise valid update.
      const payload = isSuperAdmin
        ? {
            businessName: form.businessName,
            businessLogo: form.businessLogo,
            gstNumber: form.gstNumber,
            address: form.address,
            phoneNumber: form.phoneNumber,
            email: form.email,
            lowStockThreshold: form.lowStockThreshold,
            totalBoxes: form.totalBoxes,
            barsPerBox: form.barsPerBox,
          }
        : { businessName: form.businessName, businessLogo: form.businessLogo, gstNumber: form.gstNumber, address: form.address };
      const response = await api.patch('/settings', payload);
      const savedForm = response.data && typeof response.data === 'object'
        ? { ...form, ...response.data }
        : form;
      if (savedForm.businessLogo) window.localStorage.setItem('tii_business_logo', savedForm.businessLogo);
      else window.localStorage.removeItem('tii_business_logo');
      window.dispatchEvent(new Event('tii-logo-change'));
      setForm(savedForm);
      setPersistedForm(savedForm);
      setSaved(true);
      setIsEditing(false);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          'Could not save the company profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string | number) => {
    setSaved(false);
    setForm((current: any) => ({
      ...current,
      [field]: value,
    }));
  };

  const startEditing = () => {
    setSaved(false);
    setError('');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    logoReaderRef.current?.abort();
    logoReaderRef.current = null;
    if (profileImageInputRef.current) profileImageInputRef.current.value = '';
    const restored = persistedForm || form;
    setForm(restored);
    setError('');
    setSaved(false);
    setIsEditing(false);
  };

  const selectLogo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setError('');
    setSaved(false);
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

  const openProfileImagePicker = () => {
    setError('');
    profileImageInputRef.current?.click();
  };

  if (loadError) {
    return (
      <div className="rounded-[2rem] border border-red-100 bg-white px-5 py-16 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-xl text-red-600"><FiSettings /></div>
        <h2 className="mt-4 text-lg font-extrabold text-navy-900">Company profile unavailable</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{loadError}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-5">Try again</button>
      </div>
    );
  }

  if (authLoading || !form) {
    return (
      <div className="space-y-5">
        <div className="h-64 animate-pulse rounded-[2rem] bg-navy-900/90" />
        <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-3xl bg-white/70" />
          <div className="space-y-4"><div className="h-72 animate-pulse rounded-3xl bg-white/70" /><div className="h-52 animate-pulse rounded-3xl bg-white/70" /></div>
        </div>
      </div>
    );
  }

  const defaultLogo = '/tiruppur-ice-logo.png';
  const logo = form.businessLogo || defaultLogo;

  return (
    <form onSubmit={submit} className="w-full space-y-6">
      <input
        ref={profileImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={selectLogo}
        className="hidden"
        aria-label="Upload company profile image"
      />
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute right-10 top-8 hidden h-28 w-28 rounded-full border border-white/10 lg:block" />
        <div className="absolute right-16 top-14 hidden h-20 w-20 rounded-full border border-white/10 lg:block" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-3xl bg-iceblue-300/30 blur-xl" />
            <button
              type="button"
              onClick={openProfileImagePicker}
              disabled={!isEditing}
              title={isEditing ? 'Upload company profile image' : 'Company profile image'}
              className={`group relative block rounded-3xl text-left ${isEditing ? 'cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-iceblue-300/60' : 'cursor-default'}`}
            >
              <Image src={logo} alt="Company profile image" width={112} height={112} unoptimized className="relative h-24 w-24 rounded-3xl border-4 border-white/15 bg-white object-cover shadow-2xl sm:h-28 sm:w-28" />
              {isEditing && <span className="absolute inset-1 grid place-items-center rounded-[1.25rem] bg-navy-950/0 text-xl text-white opacity-0 transition group-hover:bg-navy-950/45 group-hover:opacity-100 group-focus-visible:bg-navy-950/45 group-focus-visible:opacity-100"><FiCamera /></span>}
            </button>
            <span className={`absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl border-4 border-navy-900 text-white ${isEditing ? 'bg-iceblue-500' : 'bg-emerald-500'}`}>{isEditing ? <FiCamera size={15} /> : <FiCheckCircle size={15} />}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-iceblue-100 backdrop-blur-sm"><FiBriefcase /> {isSuperAdmin ? 'Super admin company controls' : 'Branch admin company profile'}</div>
            <h1 className="break-words text-3xl font-black tracking-[-0.04em] sm:text-4xl">{form.businessName || 'Tiruppur Ice'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Keep your business identity, recovery contacts, and production defaults accurate in one central profile.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">{form.gstNumber || 'GST not configured'}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">{isSuperAdmin ? 'Full configuration access' : 'Business identity access'}</span>
            </div>
          </div>
          {isEditing ? (
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <button type="button" onClick={cancelEditing} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-white/15 disabled:opacity-60 sm:flex-none"><FiX /> Cancel</button>
              <button type="submit" disabled={saving} className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-navy-900 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-iceblue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-iceblue-500 text-white"><FiSave /></span>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEditing} className="group flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-navy-900 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-iceblue-50 sm:w-auto">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-iceblue-500 text-white"><FiEdit2 /></span>
              Edit profile
            </button>
          )}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-28">
          <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
            <div className="bg-gradient-to-br from-iceblue-50 via-white to-cyan-50 p-5 text-center">
              <div className="relative mx-auto w-fit">
                <button type="button" onClick={openProfileImagePicker} disabled={!isEditing} className={`group block rounded-3xl focus:outline-none focus-visible:ring-4 focus-visible:ring-iceblue-200 ${isEditing ? 'cursor-pointer' : 'cursor-default'}`} title={isEditing ? 'Upload company profile image' : 'Company profile image'}>
                  <Image src={logo} alt="Company profile image preview" width={96} height={96} unoptimized className="h-24 w-24 rounded-3xl border-4 border-white bg-white object-cover shadow-xl" />
                  {isEditing && <span className="absolute inset-1 grid place-items-center rounded-[1.25rem] bg-navy-950/0 text-lg text-white opacity-0 transition group-hover:bg-navy-950/45 group-hover:opacity-100 group-focus-visible:bg-navy-950/45 group-focus-visible:opacity-100"><FiCamera /></span>}
                </button>
              </div>
              <h2 className="mt-5 break-words text-lg font-extrabold text-navy-900">{form.businessName || 'Tiruppur Ice'}</h2>
              <p className="mt-1 text-xs text-slate-500">Company profile image · PNG, JPEG or WebP · Maximum 2 MB</p>
              {isEditing && <div className="mt-4 flex justify-center gap-2">
                <button type="button" onClick={openProfileImagePicker} className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-navy-800"><FiUpload /> {form.businessLogo ? 'Replace image' : 'Upload image'}</button>
                {form.businessLogo && <button type="button" onClick={() => updateField('businessLogo', '')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-red-50 hover:text-red-600"><FiTrash2 /> Default</button>}
              </div>}
            </div>
            <div>
              <SummaryRow icon={FiMapPin} label="Registered address" value={form.address || 'Not configured'} />
              <SummaryRow icon={FiPhone} label="Recovery mobile" value={form.phoneNumber || 'Not configured'} />
              <SummaryRow icon={FiBox} label="Production setup" value={`${form.totalBoxes ?? 200} boxes · ${form.barsPerBox ?? 2} bars each`} />
            </div>
          </section>

          <div className={`rounded-2xl border p-4 ${isSuperAdmin ? 'border-emerald-100 bg-emerald-50/80' : 'border-amber-100 bg-amber-50/80'}`}>
            <div className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white ${isSuperAdmin ? 'text-emerald-600' : 'text-amber-600'}`}><FiShield /></span>
              <div><p className="text-sm font-extrabold text-navy-900">{isSuperAdmin ? 'Full profile access' : 'Limited profile access'}</p><p className="mt-1 text-xs leading-5 text-slate-600">{isSuperAdmin ? 'You can update company identity, recovery contacts, and production configuration.' : 'You can update company identity. Recovery and production settings are managed by a super admin.'}</p></div>
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          {isEditing ? <>
          <SectionCard step="01" icon={FiBriefcase} title="Business identity" subtitle="The company information shown across your workspace and documents">
            <div className="grid gap-5 sm:grid-cols-2">
              <SettingField label="Business name" icon={FiUser}><input className="input-field" placeholder="Enter your business name" value={form.businessName || ''} onChange={(event) => updateField('businessName', event.target.value)} /></SettingField>
              <SettingField label="GST number" icon={FiBriefcase}><input className="input-field uppercase" placeholder="Enter GST registration number" value={form.gstNumber || ''} onChange={(event) => updateField('gstNumber', event.target.value)} /></SettingField>
              <div className="sm:col-span-2"><SettingField label="Registered business address" icon={FiMapPin}><textarea rows={3} className="input-field min-h-24 resize-none" placeholder="Street, area, city, state and PIN code" value={form.address || ''} onChange={(event) => updateField('address', event.target.value)} /></SettingField></div>
            </div>
          </SectionCard>

          {!isSuperAdmin && <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><FiShield /></span><div><p className="text-xs font-extrabold text-navy-900">Super-admin settings</p><p className="mt-1 text-[10px] leading-4 text-slate-600">Recovery contacts and production defaults are visible for reference but can only be changed by a super admin.</p></div></div>}
          <fieldset disabled={!isSuperAdmin} className="m-0 space-y-5 border-0 p-0 disabled:opacity-60">
            <SectionCard step="02" icon={FiShield} title="Recovery and contact details" subtitle="Verified channels used for account recovery and company communication">
              <div className="grid gap-5 md:grid-cols-2">
                <SettingField label="Mobile number" icon={FiPhone}><input className="input-field" inputMode="tel" placeholder="Recovery phone" value={form.phoneNumber || ''} onChange={(event) => updateField('phoneNumber', event.target.value)} /></SettingField>
                <SettingField label="Email address" icon={FiMail}><input type="email" className="input-field" placeholder="Recovery email" value={form.email || ''} onChange={(event) => updateField('email', event.target.value)} /></SettingField>
              </div>
            </SectionCard>

            <SectionCard step="03" icon={FiSettings} title="Production configuration" subtitle="Default stock thresholds and daily box-counter calculations">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition focus-within:border-iceblue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-iceblue-100/50">
                  <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-500"><span className="flex items-center gap-2"><FiBox className="text-iceblue-600" />Low stock alert</span><span className="rounded-full bg-white px-2 py-1 text-[9px] text-slate-400 ring-1 ring-slate-100">BARS</span></span>
                  <input type="number" min={0} className="mt-4 w-full border-0 bg-transparent p-0 text-3xl font-black text-navy-900 outline-none" value={form.lowStockThreshold || 0} onChange={(event) => updateField('lowStockThreshold', Number(event.target.value))} />
                  <span className="mt-2 block text-xs leading-5 text-slate-500">Alert when available stock falls below this level.</span>
                </label>
                <label className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition focus-within:border-iceblue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-iceblue-100/50">
                  <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-500"><span className="flex items-center gap-2"><FiBox className="text-iceblue-600" />Total boxes</span><span className="rounded-full bg-white px-2 py-1 text-[9px] text-slate-400 ring-1 ring-slate-100">BOXES</span></span>
                  <input type="number" min={1} className="mt-4 w-full border-0 bg-transparent p-0 text-3xl font-black text-navy-900 outline-none" value={form.totalBoxes ?? 200} onChange={(event) => updateField('totalBoxes', Number(event.target.value))} />
                  <span className="mt-2 block text-xs leading-5 text-slate-500">Total boxes available for daily production.</span>
                </label>
                <label className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition focus-within:border-iceblue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-iceblue-100/50">
                  <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-500"><span className="flex items-center gap-2"><FiBox className="text-iceblue-600" />Bars per box</span><span className="rounded-full bg-white px-2 py-1 text-[9px] text-slate-400 ring-1 ring-slate-100">RATIO</span></span>
                  <input type="number" min={1} className="mt-4 w-full border-0 bg-transparent p-0 text-3xl font-black text-navy-900 outline-none" value={form.barsPerBox ?? 2} onChange={(event) => updateField('barsPerBox', Number(event.target.value))} />
                  <span className="mt-2 block text-xs leading-5 text-slate-500">Number of ice bars counted inside each box.</span>
                </label>
              </div>
            </SectionCard>
          </fieldset>

          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-[0_18px_50px_-24px_rgba(15,43,61,0.5)] backdrop-blur-lg sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-h-5 px-1">
              {saved && <p className="flex items-center gap-2 text-sm font-bold text-emerald-600"><FiCheckCircle /> Company profile saved successfully.</p>}
              {error && <p className="text-sm font-bold text-red-600">{error}</p>}
              {!saved && !error && <p className="text-xs leading-5 text-slate-500">Review your changes before updating the company profile.</p>}
            </div>
            <button type="submit" disabled={saving} className="btn-primary flex min-w-48 items-center justify-center gap-2"><FiSave />{saving ? 'Saving changes...' : 'Save company profile'}</button>
          </div>
          </> : <>
            {saved && <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><FiCheckCircle className="shrink-0" /> Company profile saved successfully.</div>}

            <SectionCard step="01" icon={FiBriefcase} title="Business identity" subtitle="Company information shown throughout your workspace and documents">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem icon={FiUser} label="Business name" value={form.businessName} accent="blue" />
                <DetailItem icon={FiBriefcase} label="GST number" value={form.gstNumber} />
                <div className="sm:col-span-2"><DetailItem icon={FiMapPin} label="Registered business address" value={form.address} /></div>
              </div>
            </SectionCard>

            <SectionCard step="02" icon={FiShield} title="Recovery and contact details" subtitle={isSuperAdmin ? 'Verified company recovery and communication channels' : 'Managed by your super administrator'}>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem icon={FiPhone} label="Mobile number" value={form.phoneNumber} accent="blue" />
                <DetailItem icon={FiMail} label="Email address" value={form.email} />
              </div>
            </SectionCard>

            <SectionCard step="03" icon={FiSettings} title="Production configuration" subtitle="Current stock thresholds and daily box-counter defaults">
              <div className="grid gap-4 md:grid-cols-3">
                <DetailItem icon={FiBox} label="Low stock alert" value={`${form.lowStockThreshold ?? 0} bars`} />
                <DetailItem icon={FiBox} label="Total boxes" value={`${form.totalBoxes ?? 200} boxes`} accent="blue" />
                <DetailItem icon={FiBox} label="Bars per box" value={`${form.barsPerBox ?? 2} bars`} />
              </div>
            </SectionCard>

          </>}
        </div>
      </div>
    </form>
  );
}
