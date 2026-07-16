import { FiArrowRight, FiShield, FiTruck } from 'react-icons/fi';
import { TbSnowflake } from 'react-icons/tb';

type LoadingRole = 'super_admin' | 'admin' | 'truck' | null;

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

      <section className="relative w-full max-w-md text-center">
        <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/30 bg-white/15 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-iceblue-600 shadow-lg shadow-cyan-950/20">
            <TbSnowflake className="animate-spin text-4xl [animation-duration:3s]" />
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
