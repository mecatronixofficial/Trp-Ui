'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { FiCamera, FiCheckCircle, FiGitBranch, FiKey, FiLock, FiMail, FiPhone, FiShield, FiTrash2, FiTruck, FiUpload, FiUser } from 'react-icons/fi';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CardFooter, Field, ProfileRow, SettingsCard } from './SettingsCardKit';

export function AccountSettingsPage({ mode = 'admin' }: { mode?: 'admin' | 'truck' }) {
  const { user, refreshUser } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isTruck = mode === 'truck';
  const profileLabel = isTruck ? 'Driver profile image' : 'Admin profile image';
  const accountBadge = isTruck ? 'Truck driver account' : isSuperAdmin ? 'Super admin account' : 'Branch admin account';
  const accessLabel = isTruck ? 'Assigned truck access' : isSuperAdmin ? 'Network access' : 'Assigned branch access';
  const roleLabel = isTruck ? 'Truck driver' : isSuperAdmin ? 'Super admin' : 'Branch admin';

  const [profileForm, setProfileForm] = useState({ displayName: '', phoneNumber: '', email: '', profileImage: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [assignedTruck, setAssignedTruck] = useState<any>(null);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const profileImageReaderRef = useRef<FileReader | null>(null);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      displayName: user.displayName || '',
      phoneNumber: user.phoneNumber || '',
      email: user.email || '',
      profileImage: user.profileImage || '',
    });
  }, [user]);

  useEffect(() => () => profileImageReaderRef.current?.abort(), []);

  useEffect(() => {
    if (!isTruck) return;
    let active = true;
    api.get('/dashboard/truck')
      .then(({ data }) => {
        if (active) setAssignedTruck(data?.truck || null);
      })
      .catch(() => {
        if (active) setAssignedTruck(null);
      });
    return () => { active = false; };
  }, [isTruck]);

  const selectProfileImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setProfileSaved(false);
    setProfileError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setProfileError('Choose a PNG, JPEG, or WebP profile image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Profile image must be smaller than 2 MB.');
      return;
    }
    profileImageReaderRef.current?.abort();
    const reader = new FileReader();
    profileImageReaderRef.current = reader;
    reader.onload = () => {
      const source = String(reader.result || '');
      const image = new window.Image();
      image.onload = () => {
        const maxDimension = 512;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          setProfileError('Could not prepare the selected profile image.');
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setProfileForm((current) => ({ ...current, profileImage: canvas.toDataURL('image/webp', 0.88) }));
      };
      image.onerror = () => setProfileError('Could not read the selected profile image.');
      image.src = source;
    };
    reader.onloadend = () => {
      if (profileImageReaderRef.current === reader) profileImageReaderRef.current = null;
    };
    reader.readAsDataURL(file);
  };

  const openProfileImagePicker = () => {
    setProfileError('');
    profileImageInputRef.current?.click();
  };

  const removeProfileImage = () => {
    setProfileSaved(false);
    setProfileError('');
    setProfileForm((current) => ({ ...current, profileImage: '' }));
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSaved(false);
    setProfileError('');
    try {
      await api.patch('/auth/me', profileForm);
      await refreshUser();
      setProfileSaved(true);
    } catch (requestError: any) {
      setProfileError(requestError?.response?.data?.message || 'Could not save your account details.');
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaved(false);
    setPasswordError('');
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post('/auth/me/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSaved(true);
    } catch (requestError: any) {
      setPasswordError(requestError?.response?.data?.message || 'Could not change your password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <input
        ref={profileImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={selectProfileImage}
        className="hidden"
        aria-label={`Upload ${profileLabel.toLowerCase()}`}
      />
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(10,28,42,0.85)] sm:px-7 sm:py-8 lg:px-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-iceblue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-3xl bg-iceblue-300/30 blur-xl" />
            <button type="button" onClick={openProfileImagePicker} title={`Upload ${profileLabel.toLowerCase()}`} className="group relative block rounded-3xl focus:outline-none focus-visible:ring-4 focus-visible:ring-iceblue-300/60">
              {profileForm.profileImage ? (
                <Image src={profileForm.profileImage} alt={profileLabel} width={112} height={112} unoptimized className="h-24 w-24 rounded-3xl border-4 border-white/15 bg-white object-cover shadow-2xl sm:h-28 sm:w-28" />
              ) : (
                <span className={`grid h-24 w-24 place-items-center rounded-3xl border-4 border-white/15 text-4xl font-black text-white shadow-2xl sm:h-28 sm:w-28 ${isSuperAdmin ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-iceblue-500 to-iceblue-700'}`}>
                  {(profileForm.displayName || user?.username || 'A').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute inset-1 grid place-items-center rounded-[1.25rem] bg-navy-950/0 text-xl text-white opacity-0 transition group-hover:bg-navy-950/45 group-hover:opacity-100 group-focus-visible:bg-navy-950/45 group-focus-visible:opacity-100"><FiCamera /></span>
            </button>
            <span className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl border-4 border-navy-900 bg-iceblue-500 text-white"><FiCamera size={15} /></span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-iceblue-100">{isTruck ? <FiTruck /> : <FiShield />}{accountBadge}</div>
            <h1 className="break-words text-3xl font-black tracking-[-0.04em] sm:text-4xl">{user?.displayName || user?.username || 'My profile'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Manage your personal contact details, account identity, and password security.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">@{user?.username}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">{isTruck ? <FiTruck /> : isSuperAdmin ? <FiShield /> : <FiGitBranch />}{accessLabel}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-28">
          <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,43,61,0.45)]">
            <div className="bg-gradient-to-br from-iceblue-50 via-white to-cyan-50 p-6 text-center">
              <button type="button" onClick={openProfileImagePicker} title={`Upload ${profileLabel.toLowerCase()}`} className="group relative mx-auto block rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-iceblue-200">
                {profileForm.profileImage ? (
                  <Image src={profileForm.profileImage} alt={`${profileLabel} preview`} width={64} height={64} unoptimized className="h-16 w-16 rounded-2xl bg-white object-cover shadow-lg" />
                ) : (
                  <span className={`grid h-16 w-16 place-items-center rounded-2xl text-2xl font-black text-white shadow-lg ${isSuperAdmin ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-600/20' : 'bg-gradient-to-br from-iceblue-500 to-iceblue-700 shadow-iceblue-600/20'}`}>{(profileForm.displayName || user?.username || 'A').charAt(0).toUpperCase()}</span>
                )}
                <span className="absolute inset-0 grid place-items-center rounded-2xl bg-navy-950/0 text-white opacity-0 transition group-hover:bg-navy-950/45 group-hover:opacity-100 group-focus-visible:bg-navy-950/45 group-focus-visible:opacity-100"><FiCamera /></span>
              </button>
              <h2 className="mt-4 break-words text-lg font-extrabold text-navy-900">{user?.displayName || user?.username || 'Account'}</h2>
              <p className="text-sm text-slate-500">@{user?.username}</p>
              <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${isSuperAdmin ? 'bg-amber-50 text-amber-700' : 'bg-iceblue-50 text-iceblue-700'}`}>{isTruck ? <FiTruck /> : <FiShield />}{roleLabel}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {isTruck && <ProfileRow icon={FiTruck} label="Assigned truck" value={assignedTruck?.truckName || 'Not assigned'} />}
              {isTruck && <ProfileRow icon={FiTruck} label="Vehicle number" value={assignedTruck?.truckNumber || 'Not configured'} />}
              <ProfileRow icon={FiMail} label="Email" value={user?.email || 'Not configured'} />
              <ProfileRow icon={FiPhone} label="Phone" value={user?.phoneNumber || 'Not configured'} />
            </div>
          </section>

          <section className={`rounded-2xl border p-4 ${isSuperAdmin ? 'border-emerald-100 bg-emerald-50/80' : 'border-iceblue-100 bg-iceblue-50/80'}`}>
            <div className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white ${isSuperAdmin ? 'text-emerald-600' : 'text-iceblue-600'}`}>{isTruck ? <FiTruck /> : isSuperAdmin ? <FiShield /> : <FiLock />}</span>
              <div><p className="text-sm font-extrabold text-navy-900">{isTruck ? 'Truck-scoped account' : isSuperAdmin ? 'Network-level account' : 'Branch-scoped account'}</p><p className="mt-1 text-xs leading-5 text-slate-600">{isTruck ? 'Your operational access is limited to the truck assigned by an administrator.' : isSuperAdmin ? 'Your role can access and manage company-wide administrative features.' : 'Your operational access is limited to the branch assigned by a super admin.'}</p></div>
            </div>
          </section>
        </aside>

        <div className="space-y-5">
          <form onSubmit={saveProfile}>
            <SettingsCard step="01" icon={FiUser} title={isTruck ? 'Driver details' : 'Personal details'} subtitle={`The contact information associated with your ${isTruck ? 'driver' : 'administrator'} account`}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
                    {profileForm.profileImage ? (
                      <Image src={profileForm.profileImage} alt={`Selected ${profileLabel.toLowerCase()}`} width={72} height={72} unoptimized className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl bg-white object-cover shadow-sm ring-4 ring-white" />
                    ) : (
                      <span className={`grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-2xl text-2xl font-black text-white shadow-sm ring-4 ring-white ${isSuperAdmin ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-iceblue-500 to-iceblue-700'}`}>{(profileForm.displayName || user?.username || 'A').charAt(0).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-navy-900">{profileLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">PNG, JPEG or WebP · Maximum 2 MB. The image appears in your profile and account menu.</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button type="button" onClick={openProfileImagePicker} className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-navy-800"><FiUpload /> {profileForm.profileImage ? 'Replace image' : 'Upload image'}</button>
                      {profileForm.profileImage && <button type="button" onClick={removeProfileImage} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"><FiTrash2 /> Remove</button>}
                    </div>
                  </div>
                </div>
                <Field label="Display name" icon={FiUser}><input className="input-field" placeholder="Your full name" value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} /></Field>
                <Field label="Phone number" icon={FiPhone}><input className="input-field" inputMode="tel" placeholder="Your mobile number" value={profileForm.phoneNumber} onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })} /></Field>
                <div className="sm:col-span-2"><Field label="Email address" icon={FiMail}><input type="email" className="input-field" placeholder="Your email address" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} /></Field></div>
              </div>
              <CardFooter saved={profileSaved} savedText="Account details saved." error={profileError} saving={profileSaving} label="Save my details" />
            </SettingsCard>
          </form>

          <form onSubmit={changePassword}>
            <SettingsCard step="02" icon={FiKey} title="Password security" subtitle="Confirm your current password before choosing a new one">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Current password" icon={FiLock}><input type="password" required autoComplete="current-password" className="input-field" placeholder="Enter current password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></Field></div>
                <Field label="New password" icon={FiKey}><input type="password" required minLength={6} autoComplete="new-password" className="input-field" placeholder="Minimum 6 characters" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} /></Field>
                <Field label="Confirm new password" icon={FiCheckCircle}><input type="password" required minLength={6} autoComplete="new-password" className="input-field" placeholder="Repeat new password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} /></Field>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] leading-4 text-amber-700"><FiKey className="mt-0.5 shrink-0" />Use a password that is not shared with another account.</div>
              <CardFooter saved={passwordSaved} savedText="Password changed." error={passwordError} saving={passwordSaving} label="Change password" savingLabel="Changing..." />
            </SettingsCard>
          </form>
        </div>
      </div>
    </div>
  );
}
