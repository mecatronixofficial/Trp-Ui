'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiBarChart2,
  FiBox,
  FiDollarSign,
  FiGrid,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiSettings,
  FiShoppingCart,
  FiSun,
  FiTruck,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { TbSnowflake } from 'react-icons/tb';
import { useAuth } from '../context/AuthContext';

const adminLinks = [
  ['/admin/dashboard', 'Dashboard', FiGrid],
  ['/admin/trucks', 'Trucks', FiTruck],
  ['/admin/customers', 'Customers', FiUsers],
  ['/admin/production', 'Production', FiBox],
  ['/admin/making-cost', 'Making Cost', FiDollarSign],
  ['/admin/sales', 'Sales', FiShoppingCart],
  ['/admin/wastage', 'Wastage', FiX],
  ['/admin/reports', 'Reports', FiBarChart2],
  ['/admin/settings', 'Settings', FiSettings],
];

const truckLinks = [
  ['/truck/dashboard', 'Dashboard', FiTruck],
];

export default function Topbar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const links = pathname?.startsWith('/admin') ? adminLinks : truckLinks;
  const activeArea = pathname?.startsWith('/admin') ? 'Admin Desk' : 'Driver App';
  const userName = user?.displayName || user?.username || 'User';
  const initial = userName.charAt(0).toUpperCase();
  const hour = now?.getHours() ?? 0;
  const greeting = !now ? 'Welcome' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const TimeIcon = hour >= 18 || hour < 6 ? FiMoon : FiSun;
  const timeLabel = now?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) || '--:--';
  const dateLabel = now?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) || '';

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-iceblue-100/80 bg-[linear-gradient(135deg,#ffffff_0%,#f0fbff_48%,#dff5fd_100%)] shadow-lg shadow-iceblue-900/5">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-iceblue-200/0 via-iceblue-400/70 to-iceblue-200/0" />
      <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] border border-iceblue-200 bg-white text-navy-800 shadow-sm transition hover:bg-iceblue-50 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-navy-900 text-white shadow-xl shadow-navy-900/20 ring-4 ring-white">
            <TbSnowflake className="text-2xl" />
          </div>

          <div className="min-w-0">
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-iceblue-700 sm:block">{activeArea}</p>
            <h1 className="truncate font-display text-base font-bold text-navy-900 sm:text-lg">{title}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-[1.15rem] border border-iceblue-100 bg-white/75 px-3 py-2 text-navy-900 shadow-sm backdrop-blur sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-iceblue-50 text-iceblue-700">
              <TimeIcon />
            </span>
            <div>
              <p className="text-sm font-bold leading-none">{timeLabel}</p>
              <p className="mt-1 text-[11px] font-medium text-navy-800/50">{dateLabel}</p>
            </div>
          </div>

          <div className="hidden items-center gap-3 rounded-[1.15rem] border border-iceblue-100 bg-white/85 px-3 py-2 shadow-sm backdrop-blur md:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-sm font-bold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="max-w-40 truncate text-sm font-semibold text-navy-900">{greeting}, {userName}</p>
              <p className="text-xs capitalize text-navy-800/50">{user?.role || 'account'}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] border border-red-100 bg-white text-red-500 shadow-sm transition hover:bg-red-50 md:w-auto md:px-4"
            aria-label="Logout"
          >
            <FiLogOut />
            <span className="ml-2 hidden text-sm font-semibold md:inline">Logout</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-iceblue-100 bg-white/95 px-3 py-3 shadow-xl shadow-iceblue-900/10 md:hidden">
          <div className="mb-3 grid grid-cols-[1fr_auto] gap-3 rounded-[1.25rem] bg-[linear-gradient(135deg,#f0fbff,#ffffff)] px-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-sm font-bold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy-900">{greeting}, {userName}</p>
              <p className="text-xs capitalize text-navy-800/55">{activeArea}</p>
            </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-right shadow-sm">
              <TimeIcon className="text-iceblue-600" />
              <div>
                <p className="text-sm font-bold leading-none text-navy-900">{timeLabel}</p>
                <p className="mt-1 text-[10px] font-medium text-navy-800/50">{dateLabel}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            {links.map(([href, label, Icon]) => {
              const active = pathname?.startsWith(href as string);
              const LinkIcon = Icon as typeof FiGrid;

              return (
                <Link
                  key={href as string}
                  href={href as string}
                  onClick={() => setOpen(false)}
                  className={`flex h-12 items-center gap-3 rounded-[1.1rem] px-3 text-sm font-semibold ${
                    active ? 'bg-navy-900 text-white shadow-lg shadow-navy-900/15' : 'text-navy-800 hover:bg-iceblue-50'
                  }`}
                >
                  <LinkIcon className="text-lg" />
                  {label as string}
                </Link>
              );
            })}
          </div>

          <button
            onClick={logout}
            className="mt-3 flex h-12 w-full items-center gap-3 rounded-[1.1rem] bg-red-50 px-3 text-left text-sm font-semibold text-red-500"
          >
            <FiLogOut className="text-lg" />
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
