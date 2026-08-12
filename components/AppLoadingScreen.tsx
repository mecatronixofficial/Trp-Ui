import { FiArrowRight, FiShield, FiTruck } from 'react-icons/fi';

type LoadingRole = 'super_admin' | 'admin' | 'truck' | null;

function IceBlockGraphic({ className = '', gradientId }: { className?: string; gradientId: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
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
      <rect x="6" y="8" width="30" height="30" rx="4" fill={`url(#${gradientId})`} stroke="#0284c7" strokeWidth="1.5" />
      {/* crack lines */}
      <path d="M13 8 L19 20 L12 27" stroke="#f0fbff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      {/* shine */}
      <rect x="10" y="12" width="5" height="14" rx="2.5" fill="white" opacity="0.55" />
    </svg>
  );
}

export default function AppLoadingScreen({
  message = 'Checking secure access',
  role = null,
}: {
  message?: string;
  role?: LoadingRole;
}) {
  const DestinationIcon = role === 'truck' ? FiTruck : FiShield;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_15%,#ffffff_0,#dff5fd_28%,#82d9f2_48%,#175872_82%,#071620_100%)] px-4 py-10 text-white">
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute left-[10%] top-[14%] hidden h-24 w-24 rotate-12 rounded-[28px] border border-white/25 bg-white/10 shadow-2xl shadow-cyan-950/30 backdrop-blur md:block" />
      <div className="absolute bottom-[13%] right-[12%] hidden h-32 w-32 -rotate-12 rounded-[32px] border border-white/20 bg-white/10 shadow-2xl shadow-cyan-950/30 backdrop-blur md:block" />
      <div className="absolute right-[18%] top-[20%] h-2 w-2 rounded-full bg-white/80 shadow-[0_0_26px_8px_rgba(255,255,255,.32)]" />
      <div className="absolute bottom-[22%] left-[18%] h-2 w-2 rounded-full bg-cyan-50/80 shadow-[0_0_24px_7px_rgba(207,250,254,.28)]" />

      {/* Floating decorative ice blocks */}
      <IceBlockGraphic
        gradientId="floatIceA"
        className="absolute left-[8%] top-[62%] hidden h-10 w-10 -rotate-6 opacity-70 drop-shadow-lg [animation-duration:3.4s] animate-bounce sm:block"
      />
      <IceBlockGraphic
        gradientId="floatIceB"
        className="absolute right-[10%] top-[10%] hidden h-8 w-8 rotate-12 opacity-60 drop-shadow-lg [animation-delay:.6s] [animation-duration:3s] animate-bounce md:block"
      />
      <IceBlockGraphic
        gradientId="floatIceC"
        className="absolute bottom-[8%] right-[24%] hidden h-7 w-7 -rotate-12 opacity-50 drop-shadow-lg [animation-delay:1.1s] [animation-duration:3.8s] animate-bounce lg:block"
      />

      <section className="relative w-full max-w-md text-center">
        <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/30 bg-white/15 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-lg shadow-cyan-950/20">
            <IceBlockGraphic gradientId="mainLoaderIce" className="h-11 w-11 animate-bounce [animation-duration:1.4s]" />
          </div>
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-50/80">Since 2000</p>
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">Tiruppur Ice</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-cyan-50/85 sm:text-base">
          Preparing your cold storage command center with stock, sales, and truck updates.
        </p>

        <div className="mt-9 rounded-[2rem] border border-white/25 bg-white/15 p-4 shadow-2xl shadow-cyan-950/25 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 rounded-3xl bg-white/95 px-4 py-3 text-navy-900 shadow-lg shadow-cyan-950/15">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-iceblue-50 text-iceblue-600">
                <DestinationIcon className="text-xl" />
              </span>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold">{message}</p>
                <p className="text-xs text-navy-800/55">Please wait a moment</p>
              </div>
            </div>
            <FiArrowRight className="shrink-0 text-xl text-iceblue-500" />
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.55)]" />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {['Production', 'Sales', 'Trucks'].map((label, index) => (
              <div
                key={label}
                className="rounded-2xl border border-white/15 bg-white/10 px-2 py-3 text-xs font-medium text-cyan-50/85"
                style={{ animationDelay: `${index * 140}ms` }}
              >
                <span className="mx-auto mb-2 block h-1.5 w-8 animate-pulse rounded-full bg-cyan-50/80" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
