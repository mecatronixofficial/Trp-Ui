'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiDroplet,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiLock,
  FiMail,
  FiMessageCircle,
  FiPhone,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

type ResetMethod = 'email' | 'mobile' | 'whatsapp';
type ResetStep = 'request' | 'verify';

const resetMethods: Array<{
  value: ResetMethod;
  label: string;
  helper: string;
  placeholder: string;
  icon: typeof FiMail;
}> = [
  {
    value: 'email',
    label: 'Mail ID',
    helper: 'Send OTP to admin email',
    placeholder: 'admin@example.com',
    icon: FiMail,
  },
  {
    value: 'mobile',
    label: 'Mobile No',
    helper: 'Send OTP by SMS',
    placeholder: '9876543210',
    icon: FiPhone,
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    helper: 'Send OTP on WhatsApp',
    placeholder: '9876543210',
    icon: FiMessageCircle,
  },
];

function getApiMessage(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback;
}

function IceCrystal({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} xmlns="http://www.w3.org/2000/svg" fill="none">
      <path
        d="M12 1 L15 9 L23 12 L15 15 L12 23 L9 15 L1 12 L9 9 Z"
        fill="currentColor"
        fillOpacity="0.9"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Living ice backdrop: drifting aurora-blue light, slow-floating crystals,
 * and falling frost specks — purely decorative (pointer-events-none) so it
 * never competes with the content on top. Same iceblue/navy/white palette
 * already used on the page; `variant` only swaps which of those existing
 * tones fits the panel it sits behind (light card vs. navy panel).
 */
function IceMotionBackdrop({ className = '', variant = 'light' }: { className?: string; variant?: 'light' | 'dark' }) {
  const crystals = [
    { top: '10%', left: '12%', size: 22, duration: '7s', delay: '0s', opacity: 0.5 },
    { top: '18%', left: '82%', size: 16, duration: '9s', delay: '1.2s', opacity: 0.4 },
    { top: '68%', left: '8%', size: 18, duration: '8s', delay: '2.4s', opacity: 0.35 },
    { top: '78%', left: '86%', size: 24, duration: '10s', delay: '.6s', opacity: 0.45 },
    { top: '42%', left: '92%', size: 14, duration: '6.5s', delay: '1.8s', opacity: 0.4 },
  ];

  const flakes = [
    { left: '6%', size: 3, duration: '11s', delay: '0s' },
    { left: '18%', size: 2, duration: '9s', delay: '2.1s' },
    { left: '31%', size: 3, duration: '13s', delay: '.7s' },
    { left: '47%', size: 2, duration: '10s', delay: '3.4s' },
    { left: '58%', size: 3, duration: '12s', delay: '1.5s' },
    { left: '71%', size: 2, duration: '9.5s', delay: '4s' },
    { left: '84%', size: 3, duration: '11.5s', delay: '2.8s' },
    { left: '94%', size: 2, duration: '10.5s', delay: '.3s' },
  ];

  const isDark = variant === 'dark';

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Slow-drifting aurora light pools */}
      <div className={`absolute -left-24 -top-24 h-80 w-80 animate-aurora-drift rounded-full blur-3xl ${isDark ? 'bg-iceblue-500/25' : 'bg-iceblue-200/50'}`} />
      <div className={`absolute -bottom-32 -right-20 h-96 w-96 animate-aurora-drift-slow rounded-full blur-3xl ${isDark ? 'bg-iceblue-400/20' : 'bg-iceblue-300/40'}`} />
      <div
        className={`absolute left-1/3 top-1/2 h-72 w-72 -translate-y-1/2 animate-aurora-drift rounded-full blur-3xl [animation-delay:-6s] ${isDark ? 'bg-cyan-100/10' : 'bg-cyan-100/60'}`}
      />

      {/* Faint grid, like frost etched on glass */}
      <div
        className={`absolute inset-0 [background-size:40px_40px] ${
          isDark
            ? 'opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)]'
            : 'opacity-[0.05] [background-image:linear-gradient(rgba(18,132,172,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(18,132,172,.6)_1px,transparent_1px)]'
        }`}
      />

      {/* Large watermark ice block, slowly floating */}
      <LoginIceBlock
        className={`absolute -bottom-10 -right-12 h-56 w-56 rotate-[14deg] animate-ice-float ${isDark ? 'text-white opacity-[0.05]' : 'text-iceblue-500 opacity-[0.07]'}`}
      />

      {/* Drifting ice crystals */}
      {crystals.map((c, i) => (
        <IceCrystal
          key={i}
          className={`absolute animate-crystal-drift ${isDark ? 'text-white' : 'text-iceblue-400'}`}
          style={{
            top: c.top,
            left: c.left,
            width: c.size,
            height: c.size,
            opacity: isDark ? c.opacity * 0.7 : c.opacity,
            animationDuration: c.duration,
            animationDelay: c.delay,
          }}
        />
      ))}

      {/* Falling frost specks */}
      {flakes.map((f, i) => (
        <span
          key={i}
          className={`absolute top-0 animate-frost-fall rounded-full ${isDark ? 'bg-white/30' : 'bg-iceblue-400/50'}`}
          style={{ left: f.left, width: f.size, height: f.size, animationDuration: f.duration, animationDelay: f.delay }}
        />
      ))}
    </div>
  );
}

function LoginIceBlock({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="loginIceBlock" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fbff" />
          <stop offset="50%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      {/* top face (pseudo-3D) */}
      <path d="M11 8 L18 3 L42 3 L36 8 Z" fill="#f0fbff" stroke="#0284c7" strokeWidth="1" strokeLinejoin="round" />
      {/* right face (pseudo-3D) */}
      <path d="M36 8 L42 3 L42 30 L36 36 Z" fill="#0ea5e9" stroke="#0284c7" strokeWidth="1" strokeLinejoin="round" />
      {/* block body (front face) */}
      <rect x="6" y="8" width="30" height="30" rx="4" fill="url(#loginIceBlock)" stroke="#0284c7" strokeWidth="1.5" />
      {/* crack line */}
      <path d="M13 8 L19 20 L12 27" stroke="#f0fbff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      {/* shine */}
      <rect x="10" y="12" width="5" height="14" rx="2.5" fill="white" opacity="0.55" />
    </svg>
  );
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
  const SelectedMethodIcon = selectedMethod.icon;

  useEffect(() => {
    if (authLoading || !user) return;
    setRedirecting(true);
    router.replace(user.role === 'truck' ? '/truck/dashboard' : '/admin/dashboard');
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
      <main className="flex min-h-screen items-center justify-center bg-white" aria-label="Loading">
        <FiLoader className="animate-spin text-2xl text-iceblue-600" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-white text-navy-900 lg:flex">
      {/* Left brand panel — solid, high-contrast, no glass/blur so it stays legible everywhere */}
      <section className="relative isolate hidden flex-col justify-between overflow-hidden bg-navy-900 px-6 py-10 text-white sm:px-10 lg:flex lg:w-[46%] lg:px-14 lg:py-14 xl:w-[42%]">
        <IceMotionBackdrop variant="dark" />

        <div className="relative">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/25">
              <LoginIceBlock className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none">Tiruppur Ice</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-iceblue-200/80">Since 2000</p>
            </div>
          </div>

          <h1 className="max-w-md font-display text-4xl font-bold leading-tight xl:text-[2.75rem]">
            Run your ice business from one admin desk
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-7 text-white/70">
            Track stock, truck sales, production, customers, and billing in real time — built for the cold-store floor.
          </p>
        </div>

        <div className="relative mt-12 grid grid-cols-2 gap-3 lg:mt-0">
          {[
            { icon: FiDroplet, title: 'Live stock', subtitle: 'Production & inventory' },
            { icon: FiShield, title: 'Secure access', subtitle: 'Role-based logins' },
            { icon: FiArrowRight, title: 'Truck sales', subtitle: 'Fast field billing' },
            { icon: FiUser, title: 'Customer ledger', subtitle: 'Dues & history' },
          ].map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
              <Icon className="mb-2 text-iceblue-300" />
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-xs text-white/55">{subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Right form panel — living ice backdrop behind a solid card, so the graphic never fights legibility */}
      <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-b from-iceblue-50 via-white to-iceblue-50 px-4 py-10 sm:px-6 lg:px-10">
        <IceMotionBackdrop />

        <div className="relative w-full max-w-md rounded-[2rem] border border-iceblue-100 bg-white/90 p-6 shadow-xl shadow-iceblue-900/5 backdrop-blur-sm sm:p-9">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-900 shadow-lg shadow-navy-900/20">
              <LoginIceBlock className="h-10 w-10" />
            </div>
            <h1 className="font-display text-2xl font-bold text-navy-900">Tiruppur Ice Admin Desk</h1>
            <p className="mt-1 text-sm text-navy-800/60">Since 2000</p>
          </div>

          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-iceblue-600">Welcome back</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-navy-900">Sign in to continue</h2>
            <p className="mt-2 text-sm leading-6 text-navy-800/60">
              Enter your admin username or truck login ID to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-text" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-800/40" />
                <input
                  id="username"
                  className="input-field h-12 rounded-xl border-iceblue-200 pl-11 text-base focus:border-iceblue-400"
                  placeholder="admin or truck login ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="label-text mb-0" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-xs font-semibold text-iceblue-700 transition hover:text-navy-900"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-800/40" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field h-12 rounded-xl border-iceblue-200 pl-11 pr-11 text-base focus:border-iceblue-400"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-navy-800/50 transition hover:bg-iceblue-50 hover:text-iceblue-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                <FiAlertCircle className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-iceblue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <FiLoader className="animate-spin" /> : <FiArrowRight />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-navy-800/65">
            <div className="flex items-center gap-2 rounded-xl border border-iceblue-100 bg-iceblue-50/60 px-3 py-3">
              <FiShield className="shrink-0 text-iceblue-600" />
              <span>Admin access</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-iceblue-100 bg-iceblue-50/60 px-3 py-3">
              <FiDroplet className="shrink-0 text-iceblue-600" />
              <span>Truck login</span>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-navy-800/50">
            Admin password reset is available with OTP verification. Truck passwords are reset by admin.
          </p>
        </div>
      </section>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !resetLoading) closeForgotPassword();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-heading"
            className="w-full max-w-lg rounded-[2rem] border border-white/30 bg-white p-5 text-navy-900 shadow-2xl shadow-cyan-950/40 sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-iceblue-50 text-iceblue-700">
                  <FiShield className="text-2xl" />
                </div>
                <p className="text-xs font-semibold uppercase text-iceblue-600">Admin only</p>
                <h3 id="reset-password-heading" className="mt-1 font-display text-2xl font-bold">Reset password</h3>
                <p className="mt-1 text-sm leading-6 text-navy-800/60">
                  Receive an OTP by mail, mobile SMS, or WhatsApp and set a new admin password.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForgotPassword}
                disabled={resetLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-iceblue-100 text-navy-800/60 transition hover:bg-iceblue-50 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close forgot password"
              >
                <FiArrowLeft />
              </button>
            </div>

            {resetStep === 'request' ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="label-text">Send OTP using</label>
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
                          className={`min-h-24 rounded-2xl border p-3 text-left transition ${
                            active
                              ? 'border-iceblue-400 bg-iceblue-50 text-navy-900 shadow-sm'
                              : 'border-iceblue-100 bg-white text-navy-800/70 hover:bg-iceblue-50'
                          }`}
                        >
                          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-iceblue-700 shadow-sm">
                            <MethodIcon />
                          </span>
                          <span className="block text-sm font-bold">{method.label}</span>
                          <span className="mt-1 block text-xs leading-4 text-navy-800/55">{method.helper}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-iceblue-100 bg-iceblue-50 px-4 py-3 text-sm text-navy-800/70">
                  <SelectedMethodIcon className="mt-0.5 shrink-0 text-iceblue-600" />
                  <span>
                    OTP will be sent to the saved admin {selectedMethod.label.toLowerCase()} from the profile settings.
                  </span>
                </div>

                {resetError && (
                  <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    <FiAlertCircle className="mt-0.5 shrink-0" />
                    {resetError}
                  </p>
                )}

                {resetSuccess && (
                  <p role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    <FiCheckCircle className="mt-0.5 shrink-0" />
                    {resetSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-navy-900 px-4 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-iceblue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resetLoading ? <FiLoader className="animate-spin" /> : <FiArrowRight />}
                  {resetLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="rounded-2xl border border-iceblue-100 bg-iceblue-50 px-4 py-3 text-sm text-navy-800/70">
                  OTP sent to admin {selectedMethod.label.toLowerCase()}:{' '}
                  <span className="font-semibold text-navy-900">{maskedDestination || 'saved contact'}</span>
                </div>

                <div>
                  <label className="label-text" htmlFor="otp">
                    OTP
                  </label>
                  <input
                    id="otp"
                    className="input-field h-12 rounded-2xl border-iceblue-100 bg-iceblue-50/60 text-center text-lg font-semibold tracking-[0.35em]"
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
                    <label className="label-text" htmlFor="new-password">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      className="input-field h-12 rounded-2xl border-iceblue-100 bg-iceblue-50/60 text-base"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-text" htmlFor="confirm-password">
                      Confirm password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      className="input-field h-12 rounded-2xl border-iceblue-100 bg-iceblue-50/60 text-base"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {resetError && (
                  <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    <FiAlertCircle className="mt-0.5 shrink-0" />
                    {resetError}
                  </p>
                )}

                {resetSuccess && (
                  <p role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
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
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-iceblue-200 bg-white px-4 font-semibold text-navy-800 transition hover:bg-iceblue-50"
                  >
                    <FiArrowLeft />
                    Change
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-navy-900 px-4 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-iceblue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
