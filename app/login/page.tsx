'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiLock,
  FiMail,
  FiMessageCircle,
  FiPackage,
  FiPhone,
  FiShield,
  FiTruck,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';

type ResetMethod = 'email' | 'mobile' | 'whatsapp';
type ResetStep = 'request' | 'verify';

const resetMethods: Array<{
  value: ResetMethod;
  label: string;
  helper: string;
  icon: typeof FiMail;
}> = [
  { value: 'email', label: 'Mail ID', helper: 'OTP to admin email', icon: FiMail },
  { value: 'mobile', label: 'Mobile', helper: 'OTP by SMS', icon: FiPhone },
  { value: 'whatsapp', label: 'WhatsApp', helper: 'OTP on WhatsApp', icon: FiMessageCircle },
];

const brandHighlights: Array<{ icon: typeof FiShield; title: string; helper: string }> = [
  { icon: FiShield, title: 'OTP-secured recovery', helper: 'Admin passwords reset only via verified email, SMS or WhatsApp' },
  { icon: FiTruck, title: 'Built for the fleet', helper: 'Separate, role-based access for admins and truck logins' },
  { icon: FiPackage, title: 'Live production data', helper: 'Sales, stock and dispatch stay in sync across every branch' },
];

// Fixed positions/timings (not random) so server and client markup match on hydration.
const frostParticles = [
  { left: '6%', size: 5, delay: '0s', duration: '10s' },
  { left: '16%', size: 3, delay: '2.4s', duration: '8s' },
  { left: '27%', size: 6, delay: '1.1s', duration: '12s' },
  { left: '38%', size: 4, delay: '3.6s', duration: '9s' },
  { left: '49%', size: 3, delay: '0.6s', duration: '11s' },
  { left: '61%', size: 5, delay: '2.9s', duration: '9.5s' },
  { left: '72%', size: 4, delay: '1.8s', duration: '10.5s' },
  { left: '83%', size: 6, delay: '4.2s', duration: '13s' },
  { left: '91%', size: 3, delay: '0.9s', duration: '8.5s' },
];

function getApiMessage(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback;
}

export default function LoginPage() {
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>('request');
  const [resetMethod, setResetMethod] = useState<ResetMethod>('email');
  const [maskedDestination, setMaskedDestination] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const selectedMethod = resetMethods.find((method) => method.value === resetMethod) || resetMethods[0];

  useEffect(() => {
    if (authLoading || !user) return;
    setRedirecting(true);
    router.replace(user.role === 'truck' ? '/truck/dashboard' : '/admin/sample');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!forgotOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !resetLoading) closeForgotPassword();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [forgotOpen, resetLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setRedirecting(false);
    try {
      await login(username.trim(), password);
      setRedirecting(true);
    } catch (err: any) {
      setError(getApiMessage(err, 'Invalid username or password'));
      setLoading(false);
      setRedirecting(false);
    }
  };

  const openForgotPassword = () => {
    setForgotOpen(true);
    setResetStep('request');
    setResetError('');
    setResetSuccess('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const closeForgotPassword = () => {
    setForgotOpen(false);
    setResetError('');
    setResetSuccess('');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    setResetError('');
    setResetSuccess('');

    setResetLoading(true);
    try {
      const response = await api.post('/auth/admin/forgot-password', {
        method: resetMethod,
      });
      setMaskedDestination(response.data?.maskedDestination || selectedMethod.label.toLowerCase());
      setResetSuccess(`OTP sent to saved admin ${selectedMethod.label.toLowerCase()}.`);
      setResetStep('verify');
    } catch (err: any) {
      setResetError(getApiMessage(err, 'Could not send OTP. Please check the admin profile details.'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();

    setResetError('');
    setResetSuccess('');

    if (!cleanOtp || cleanOtp.length < 4) {
      setResetError('Enter the OTP sent to the admin.');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('New password and confirm password do not match.');
      return;
    }

    setResetLoading(true);
    try {
      await api.post('/auth/admin/reset-password', {
        method: resetMethod,
        otp: cleanOtp,
        newPassword,
      });
      setResetSuccess('Admin password updated. You can sign in now.');
      setPassword('');
      setResetStep('request');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      window.setTimeout(() => {
        setForgotOpen(false);
        setResetSuccess('');
      }, 1600);
    } catch (err: any) {
      setResetError(getApiMessage(err, 'Invalid OTP or reset request expired.'));
    } finally {
      setResetLoading(false);
    }
  };

  if (authLoading || redirecting || user) {
    return (
      <main className="flex h-screen items-center justify-center bg-white" aria-label="Loading">
        <FiLoader className="animate-spin text-2xl text-iceblue-600" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-iceblue-50/40">
      {/* ---------------- Brand panel (lg and up) ---------------- */}
      <div className="relative hidden w-full max-w-xl shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-iceblue-700 px-12 py-12 text-white lg:flex">
        <div className="pointer-events-none absolute -left-28 -top-28 h-96 w-96 rounded-full bg-iceblue-400/30 blur-[100px] animate-aurora-drift" />
        <div className="pointer-events-none absolute -bottom-36 -right-20 h-[30rem] w-[30rem] rounded-full bg-cyan-300/20 blur-[110px] animate-aurora-drift-slow" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {frostParticles.map((p, i) => (
            <span
              key={i}
              className="absolute top-0 rounded-full bg-white/60 animate-frost-fall"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}
        </div>

        <div className="relative flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur-sm">
            <div className="h-full w-full overflow-hidden rounded-xl">
              <BrandLogo alt="Business logo" className="h-full w-full object-cover" />
            </div>
          </div>
          <span className="text-lg font-semibold tracking-tight">Tiruppur Ice</span>
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight">
            Cold chain operations, kept crystal clear.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
            One dashboard for production, sales and dispatch — built for admins and truck teams alike.
          </p>

          <ul className="mt-8 space-y-4">
            {brandHighlights.map(({ icon: Icon, title, helper }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-iceblue-200 ring-1 ring-white/10">
                  <Icon />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs leading-relaxed text-white/60">{helper}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Tiruppur Ice. All rights reserved.</p>
      </div>

      {/* ---------------- Sign-in panel ---------------- */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-iceblue-200/30 blur-[100px] lg:hidden" />

        <div className="relative w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center text-center lg:hidden">
            <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-lg shadow-iceblue-900/10 ring-1 ring-black/5">
              <div className="h-full w-full overflow-hidden rounded-xl">
                <BrandLogo alt="Business logo" className="h-full w-full object-cover" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to Tiruppur Ice</p>
          </div>

          <div className="mb-6 hidden lg:block">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to continue to your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white/90 p-6 shadow-xl shadow-iceblue-900/[0.06] ring-1 ring-black/5 backdrop-blur-sm sm:p-7">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="username"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-iceblue-500 focus:bg-white focus:ring-4 focus:ring-iceblue-500/10"
                  placeholder="Admin or truck login ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-xs font-medium text-iceblue-600 hover:text-iceblue-700"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition focus:border-iceblue-500 focus:bg-white focus:ring-4 focus:ring-iceblue-500/10"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                <FiAlertCircle className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-iceblue-600 to-iceblue-500 text-sm font-semibold text-white shadow-lg shadow-iceblue-600/30 transition hover:from-iceblue-700 hover:to-iceblue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <FiLoader className="animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-400">
            Admin recovery is OTP protected. Truck passwords are reset by admin.
          </p>
        </div>
      </div>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !resetLoading) closeForgotPassword();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-heading"
            className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white text-gray-900 shadow-2xl shadow-iceblue-900/10 ring-1 ring-black/5"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
              <div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-600">
                  <FiShield />
                </div>
                <h3 id="reset-password-heading" className="text-lg font-semibold tracking-tight">Reset password</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Receive an OTP by mail, mobile SMS, or WhatsApp and set a new admin password.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForgotPassword}
                disabled={resetLoading}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close forgot password"
              >
                <FiX />
              </button>
            </div>

            {resetStep === 'request' ? (
              <form onSubmit={handleSendOtp} className="space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Send OTP using</label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {resetMethods.map((method) => {
                      const MethodIcon = method.icon;
                      const active = resetMethod === method.value;

                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => {
                            setResetMethod(method.value);
                            setResetError('');
                            setMaskedDestination('');
                          }}
                          className={`rounded-xl border p-3 text-left text-sm transition ${
                            active
                              ? 'border-iceblue-500 bg-iceblue-50/60 text-gray-900 ring-1 ring-iceblue-500'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <MethodIcon className={active ? 'mb-1.5 text-iceblue-600' : 'mb-1.5 text-gray-400'} />
                          <span className="block font-semibold text-gray-900">{method.label}</span>
                          <span className="mt-0.5 block text-xs text-gray-500">{method.helper}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-sm text-gray-500">
                  OTP will be sent to the saved admin {selectedMethod.label.toLowerCase()} from the profile settings.
                </p>

                {resetError && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                    <FiAlertCircle className="mt-0.5 shrink-0" />
                    {resetError}
                  </p>
                )}

                {resetSuccess && (
                  <p role="status" className="flex items-start gap-2 rounded-xl bg-iceblue-50 px-3.5 py-2.5 text-sm text-iceblue-700">
                    <FiCheckCircle className="mt-0.5 shrink-0" />
                    {resetSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-iceblue-600 to-iceblue-500 text-sm font-semibold text-white shadow-lg shadow-iceblue-600/30 transition hover:from-iceblue-700 hover:to-iceblue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resetLoading ? <FiLoader className="animate-spin" /> : <FiArrowRight />}
                  {resetLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4 p-5">
                <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600">
                  OTP sent to admin {selectedMethod.label.toLowerCase()}:{' '}
                  <span className="font-semibold text-gray-900">{maskedDestination || 'saved contact'}</span>
                </p>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="otp">
                    OTP
                  </label>
                  <input
                    id="otp"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-center text-lg font-semibold tracking-[0.35em] text-gray-900 outline-none transition focus:border-iceblue-500 focus:bg-white focus:ring-4 focus:ring-iceblue-500/10"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="new-password">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-iceblue-500 focus:bg-white focus:ring-4 focus:ring-iceblue-500/10"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="confirm-password">
                      Confirm password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-iceblue-500 focus:bg-white focus:ring-4 focus:ring-iceblue-500/10"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {resetError && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                    <FiAlertCircle className="mt-0.5 shrink-0" />
                    {resetError}
                  </p>
                )}

                {resetSuccess && (
                  <p role="status" className="flex items-start gap-2 rounded-xl bg-iceblue-50 px-3.5 py-2.5 text-sm text-iceblue-700">
                    <FiCheckCircle className="mt-0.5 shrink-0" />
                    {resetSuccess}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep('request');
                      setResetError('');
                    }}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <FiArrowLeft />
                    Change
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-iceblue-600 to-iceblue-500 px-4 text-sm font-semibold text-white shadow-lg shadow-iceblue-600/30 transition hover:from-iceblue-700 hover:to-iceblue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resetLoading ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
                    {resetLoading ? 'Updating password...' : 'Set New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
