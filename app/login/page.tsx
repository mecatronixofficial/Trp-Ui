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
import BrandLogo from '../../components/BrandLogo';
import AppLoadingScreen from '../../components/AppLoadingScreen';
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

function IceCrystal({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="none">
      <path
        d="M12 1 L15 9 L23 12 L15 15 L12 23 L9 15 L1 12 L9 9 Z"
        fill="white"
        fillOpacity="0.85"
        stroke="#bae6fd"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A literal stockpile of ice blocks, like the cold-store yard, anchoring the hero panel. */
function IceBlockStack({ className = '' }: { className?: string }) {
  const blocks = [
    { size: 64, bottom: 0, left: '2%', rotate: -8, delay: '0s', opacity: 0.95 },
    { size: 84, bottom: 0, left: '16%', rotate: 4, delay: '.3s', opacity: 1 },
    { size: 56, bottom: 6, left: '34%', rotate: -12, delay: '.6s', opacity: 0.9 },
    { size: 96, bottom: 0, left: '46%', rotate: 6, delay: '.15s', opacity: 1 },
    { size: 60, bottom: 4, left: '65%', rotate: -6, delay: '.45s', opacity: 0.92 },
    { size: 72, bottom: 0, left: '78%', rotate: 10, delay: '.75s', opacity: 0.96 },
  ];

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-x-0 bottom-0 h-16 rounded-[100%] bg-cyan-950/25 blur-2xl" />
      {blocks.map((block, index) => (
        <LoginIceBlock
          key={index}
          className="absolute animate-ice-float drop-shadow-xl"
          style={{
            width: block.size,
            height: block.size,
            left: block.left,
            bottom: block.bottom,
            opacity: block.opacity,
            animationDelay: block.delay,
            ['--ice-rotate' as any]: `${block.rotate}deg`,
            transform: `rotate(${block.rotate}deg)`,
          }}
        />
      ))}
    </div>
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
    return <AppLoadingScreen message="Opening your dashboard" role={user?.role || null} />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_12%,#ffffff_0,#dff7ff_24%,#75d2eb_45%,#17617b_74%,#071620_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute left-8 top-10 h-32 w-32 rounded-full border border-white/25" />
      <div className="absolute bottom-10 right-10 h-44 w-44 rounded-full border border-cyan-100/20" />
      <div className="absolute right-[12%] top-[16%] hidden h-24 w-24 rotate-12 rounded-[28px] border border-white/20 bg-white/10 shadow-2xl shadow-cyan-950/30 backdrop-blur md:block" />
      <div className="absolute bottom-[14%] left-[10%] hidden h-20 w-20 -rotate-12 rounded-[24px] border border-white/20 bg-white/10 shadow-2xl shadow-cyan-950/30 backdrop-blur md:block" />

      {/* Big ice-block watermarks */}
      <LoginIceBlock className="pointer-events-none absolute -left-14 bottom-[-6%] hidden h-[24rem] w-[24rem] -rotate-12 opacity-[0.16] lg:block" />
      <LoginIceBlock className="pointer-events-none absolute -right-10 -top-10 hidden h-56 w-56 rotate-[18deg] opacity-[0.12] md:block" />

      {/* Floating ice crystals */}
      <IceCrystal className="absolute left-[6%] top-[22%] h-6 w-6 animate-[spin_9s_linear_infinite] opacity-70" />
      <IceCrystal className="absolute right-[8%] top-[38%] hidden h-4 w-4 animate-[spin_7s_linear_infinite] opacity-60 sm:block" />
      <IceCrystal className="absolute bottom-[18%] left-[22%] hidden h-5 w-5 animate-[spin_11s_linear_infinite] opacity-50 md:block" />
      <IceCrystal className="absolute bottom-[30%] right-[16%] h-3.5 w-3.5 animate-[spin_6s_linear_infinite] opacity-70" />

      {/* Falling frost specks */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          { left: '4%', size: 3, duration: '7s', delay: '0s' },
          { left: '14%', size: 2, duration: '9s', delay: '1.4s' },
          { left: '27%', size: 4, duration: '8s', delay: '.4s' },
          { left: '41%', size: 2, duration: '10s', delay: '2.2s' },
          { left: '55%', size: 3, duration: '7.5s', delay: '.9s' },
          { left: '68%', size: 2, duration: '9.5s', delay: '3s' },
          { left: '79%', size: 4, duration: '8.5s', delay: '1.8s' },
          { left: '90%', size: 3, duration: '11s', delay: '.2s' },
        ].map((flake, index) => (
          <span
            key={index}
            className="absolute top-0 animate-frost-fall rounded-full bg-white/70"
            style={{ left: flake.left, width: flake.size, height: flake.size, animationDuration: flake.duration, animationDelay: flake.delay }}
          />
        ))}
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <section className="grid w-full items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div className="hidden lg:block">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-cyan-50 backdrop-blur">
              <BrandLogo alt="" className="h-6 w-6 rounded-md object-cover" />
              Since 2000
            </div>

            <h1 className="max-w-xl font-display text-5xl font-bold leading-tight">
              Tiruppur Ice Admin Desk
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-cyan-50/85">
              Manage stock, trucks, production, customers, billing, and daily reports from one secure workspace.
            </p>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {[
                ['Fresh stock', 'Live entries'],
                ['Truck sales', 'Fast billing'],
                ['Admin control', 'Secure access'],
              ].map(([title, subtitle]) => (
                <div key={title} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-xs text-cyan-50/70">{subtitle}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/25 bg-white/15 shadow-xl shadow-cyan-950/20 backdrop-blur">
                <LoginIceBlock className="h-12 w-12 drop-shadow-md" />
              </div>
              <h1 className="font-display text-3xl font-bold">Tiruppur Ice</h1>
              <p className="mt-1 text-sm text-cyan-50/80">Since 2000 &middot; Admin Desk</p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/35 bg-white/95 p-6 text-navy-900 shadow-2xl shadow-cyan-950/35 backdrop-blur-xl sm:p-8"
            >
              <div className="mb-8">
                <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-iceblue-50 to-iceblue-100 shadow-lg shadow-iceblue-500/20">
                  <LoginIceBlock className="h-14 w-14 drop-shadow-md" />
                  <IceCrystal className="absolute -right-1.5 -top-1.5 h-4 w-4 animate-[spin_5s_linear_infinite]" />
                </div>
                <p className="text-sm font-semibold uppercase text-iceblue-600">Welcome back</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-navy-900">Sign in securely</h2>
                <p className="mt-2 text-sm leading-6 text-navy-800/65">
                  Enter your admin username or truck login ID to continue.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="label-text" htmlFor="username">
                    Username
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-iceblue-500" />
                    <input
                      id="username"
                      className="input-field h-12 rounded-2xl border-iceblue-100 bg-iceblue-50/60 pl-11 text-base"
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
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-iceblue-500" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="input-field h-12 rounded-2xl border-iceblue-100 bg-iceblue-50/60 pl-11 pr-11 text-base"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-navy-800/55 transition hover:bg-white hover:text-iceblue-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  <FiAlertCircle className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-navy-900 px-4 font-semibold text-white shadow-lg shadow-navy-900/25 transition hover:bg-iceblue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <FiLoader className="animate-spin" /> : <FiArrowRight />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-navy-800/65">
                <div className="flex items-center gap-2 rounded-2xl bg-iceblue-50 px-3 py-3">
                  <FiShield className="shrink-0 text-iceblue-600" />
                  <span>Admin access</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-iceblue-50 px-3 py-3">
                  <FiDroplet className="shrink-0 text-iceblue-600" />
                  <span>Truck login</span>
                </div>
              </div>
            </form>

            <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center text-xs text-cyan-50/80 backdrop-blur">
              Admin password reset is available with OTP verification. Truck passwords are reset by admin.
            </div>
          </div>
        </section>
      </div>

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
