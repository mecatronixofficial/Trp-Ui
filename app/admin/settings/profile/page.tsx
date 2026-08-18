'use client';

import { useEffect, useState } from 'react';
import { FiKey, FiMail, FiPhone, FiShield, FiUser } from 'react-icons/fi';
import api from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { CardFooter, Field, ProfileRow, SettingsCard } from '../../../../components/SettingsCardKit';

export default function AdminProfilePage() {
  const { user, refreshUser } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [profileForm, setProfileForm] = useState({ displayName: '', phoneNumber: '', email: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      displayName: user.displayName || '',
      phoneNumber: user.phoneNumber || '',
      email: user.email || '',
    });
  }, [user]);

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
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-28 lg:self-start">
          <div className="border-b border-slate-100 bg-slate-50/70 p-6 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-indigo-600 text-2xl font-black text-white shadow-lg shadow-indigo-600/20">
              {(user?.displayName || user?.username || 'A').charAt(0).toUpperCase()}
            </span>
            <h2 className="mt-4 break-words font-display text-lg font-bold text-navy-900">{user?.displayName || user?.username || 'Account'}</h2>
            <p className="text-sm text-slate-500">@{user?.username}</p>
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${isSuperAdmin ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
              <FiShield className="text-[13px]" /> {isSuperAdmin ? 'Super Admin' : 'Branch Admin'}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            <ProfileRow icon={FiMail} label="Email" value={user?.email || 'Not configured'} />
            <ProfileRow icon={FiPhone} label="Phone" value={user?.phoneNumber || 'Not configured'} />
          </div>
        </aside>

        <div className="space-y-4">
          <form onSubmit={saveProfile}>
            <SettingsCard step="01" icon={FiUser} title="My Account" subtitle="Your own name, phone and email">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Name" icon={FiUser}><input className="input-field" value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} /></Field>
                <Field label="Phone Number" icon={FiPhone}><input className="input-field" value={profileForm.phoneNumber} onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })} /></Field>
                <Field label="Email" icon={FiMail}><input type="email" className="input-field" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} /></Field>
              </div>
              <CardFooter saved={profileSaved} savedText="Account details saved." error={profileError} saving={profileSaving} label="Save My Details" />
            </SettingsCard>
          </form>

          <form onSubmit={changePassword}>
            <SettingsCard step="02" icon={FiKey} title="Change Password" subtitle="Requires your current password">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Current Password" icon={FiKey}><input type="password" required className="input-field" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></Field>
                <Field label="New Password" icon={FiKey}><input type="password" required minLength={6} className="input-field" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} /></Field>
                <Field label="Confirm New Password" icon={FiKey}><input type="password" required minLength={6} className="input-field" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} /></Field>
              </div>
              <CardFooter saved={passwordSaved} savedText="Password changed." error={passwordError} saving={passwordSaving} label="Change Password" savingLabel="Changing..." />
            </SettingsCard>
          </form>
        </div>
      </div>
    </div>
  );
}
