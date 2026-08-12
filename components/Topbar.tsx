'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiBarChart2,
  FiBox,
  FiGrid,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiNavigation,
  FiSettings,
  FiShoppingCart,
  FiSun,
  FiTruck,
  FiUserCheck,
  FiUsers,
  FiX,
  FiGitBranch,
  FiDollarSign,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import useDismissibleMenu from '../hooks/useDismissibleMenu';
import BrandLogo from './BrandLogo';

const adminLinks = [
  ['/admin/dashboard', 'Dashboard', FiGrid],
  ['/admin/trucks', 'Trucks', FiTruck],
  ['/admin/customers', 'Customers', FiUsers],
  ['/admin/workers', 'Workers', FiUserCheck],
  ['/admin/production', 'Production', FiBox],
  ['/admin/sales', 'Sales', FiShoppingCart],
  ['/admin/expenses', 'Expenses', FiDollarSign],
  ['/admin/reports', 'Reports', FiBarChart2],
  ['/admin/settings', 'Settings', FiSettings],
];

const truckLinks = [
  ['/truck/dashboard', 'Dashboard', FiTruck],
];

const superAdminLinks = [
  ['/admin/dashboard', 'Dashboard', FiGrid],
  ['/admin/branches', 'Branches', FiGitBranch],
  ['/admin/admins', 'Branch Admins', FiUserCheck],
  ...adminLinks.filter(([href]) => href !== '/admin/dashboard'),
];

export default function Topbar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  useDismissibleMenu(open, menuRef, closeMenu);
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const links = pathname?.startsWith('/admin')
    ? (user?.role === 'super_admin' ? superAdminLinks : adminLinks)
    : truckLinks;
  const isAdminArea = pathname?.startsWith('/admin');
  const menuLinks = isAdminArea ? links.filter(([href]) => href !== '/admin/trucks' && href !== '/admin/settings') : links;
  const activeArea = pathname?.startsWith('/admin') ? 'Admin Desk' : 'Driver App';
  const hour = now?.getHours() ?? 0;
  const TimeIcon = hour >= 18 || hour < 6 ? FiMoon : FiSun;
  const timeLabel = now?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) || '--:--';
  const dateLabel = now?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) || '';

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    setSelectedBranch(window.localStorage.getItem('tii_selected_branch') || '');
    import('../lib/api').then(({ default: api }) => api.get('/branches').then(({ data }) => setBranches(data)));
  }, [user?.role]);

  const changeBranch = (branch: string) => {
    if (branch) window.localStorage.setItem('tii_selected_branch', branch);
    else window.localStorage.removeItem('tii_selected_branch');
    setSelectedBranch(branch);
    window.location.reload();
  };

  return (
    <header ref={menuRef} className="sticky top-0 z-30 bg-iceblue-50/80 px-3 py-3 backdrop-blur-xl sm:px-4 md:px-8">
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/80 bg-white px-3 py-2.5 shadow-lg shadow-iceblue-900/10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy-900 text-white shadow-sm transition hover:bg-iceblue-700"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>

          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-[#071824] shadow-lg shadow-navy-900/20">
            <BrandLogo className="h-full w-full object-cover" />
          </div>

          <div className="min-w-0">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-iceblue-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-navy-800/45">{activeArea}</p>
            </div>
            <h1 className="truncate font-display text-base font-semibold text-navy-900 sm:text-lg">{title}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isAdminArea && (
            <>
              <Link
                href="/admin/trucks"
                title="Trucks"
                aria-label="Trucks"
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${pathname?.startsWith('/admin/trucks') ? 'bg-navy-900 text-white' : 'bg-iceblue-50 text-iceblue-700 hover:bg-iceblue-100'}`}
              >
                <FiTruck />
              </Link>
              <Link
                href="/admin/settings"
                title="Settings"
                aria-label="Settings"
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${pathname?.startsWith('/admin/settings') ? 'bg-navy-900 text-white' : 'bg-iceblue-50 text-iceblue-700 hover:bg-iceblue-100'}`}
              >
                <FiSettings />
              </Link>
            </>
          )}
          {user?.role === 'super_admin' && (
            <select
              aria-label="Select dashboard branch"
              className="hidden h-11 max-w-48 rounded-2xl border border-iceblue-100 bg-iceblue-50 px-3 text-sm font-semibold text-navy-900 outline-none lg:block"
              value={selectedBranch}
              onChange={(event) => changeBranch(event.target.value)}
            >
              <option value="">Overall — all branches</option>
              {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
            </select>
          )}
          <div className="hidden items-center gap-2 rounded-2xl bg-iceblue-50 px-3 py-1.5 text-navy-900 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-iceblue-700 shadow-sm">
              <TimeIcon />
            </span>
            <div>
              <p className="text-sm font-bold leading-none">{timeLabel}</p>
              <p className="mt-1 text-[11px] font-medium text-navy-800/50">{dateLabel}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-500 transition hover:bg-red-100 md:w-auto md:px-4"
            aria-label="Logout"
          >
            <FiLogOut />
            <span className="ml-2 hidden text-sm font-semibold md:inline">Logout</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute left-3 top-[68px] z-50 w-[280px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-iceblue-100 bg-white p-2.5 shadow-2xl shadow-navy-900/20 sm:left-4 md:left-8">
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-[#071824] px-3 py-2 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-iceblue-200/80">{activeArea}</p>
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5 text-right">
              <TimeIcon className="text-iceblue-200" />
              <div>
                <p className="text-xs font-bold leading-none">{timeLabel}</p>
                <p className="mt-0.5 text-[9px] font-medium text-iceblue-100/70">{dateLabel}</p>
              </div>
            </div>
          </div>

          {user?.role === 'super_admin' && (
            <div className="mb-2 rounded-xl border border-iceblue-100 bg-iceblue-50 p-2">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-navy-800/50">View Branch</label>
              <select className="input-field h-9 bg-white text-xs" value={selectedBranch} onChange={(event) => changeBranch(event.target.value)}>
                <option value="">Overall — all branches</option>
                {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
              </select>
            </div>
          )}

          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-navy-800/45">{isAdminArea ? 'Admin Menu' : 'Driver Menu'}</p>
          <div className="max-h-[55vh] space-y-0.5 overflow-y-auto pr-0.5">
            {menuLinks.map(([href, label, Icon]) => {
              const active = pathname?.startsWith(href as string);
              const LinkIcon = Icon as typeof FiGrid;

              return (
                <Link
                  key={href as string}
                  href={href as string}
                  onClick={() => setOpen(false)}
                  className={`flex h-10 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition ${
                    active ? 'bg-[#071824] text-white shadow-lg shadow-navy-900/15' : 'text-navy-800 hover:bg-iceblue-50'
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-white/15' : 'bg-iceblue-50 text-iceblue-700'}`}>
                    <LinkIcon className="text-base" />
                  </span>
                  {label as string}
                  {active && <FiNavigation className="ml-auto text-white/70" />}
                </Link>
              );
            })}
          </div>

          <button
            onClick={logout}
            className="mt-2 flex h-9 w-full items-center gap-2 rounded-xl bg-red-50 px-2.5 text-left text-xs font-semibold text-red-500"
          >
            <FiLogOut className="text-lg" />
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
