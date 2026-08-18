'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiBarChart2,
  FiBox,
  FiDollarSign,
  FiGitBranch,
  FiGrid,
  FiLogOut,
  FiMenu,
  FiMonitor,
  FiMoon,
  FiBriefcase,
  FiShield,
  FiShoppingCart,
  FiSun,
  FiTruck,
  FiUser,
  FiUserCheck,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import useDismissibleMenu from '../hooks/useDismissibleMenu';
import BrandLogo from './BrandLogo';

const adminLinks = [
  ['/admin/sample', 'Entry', FiMonitor],
  ['/admin/dashboard', 'Dashboard', FiGrid],
  ['/admin/trucks', 'Trucks', FiTruck],
  ['/admin/customers', 'Customers', FiUsers],
  ['/admin/workers', 'Workers', FiUserCheck],
  ['/admin/production', 'Production', FiBox],
  ['/admin/sales', 'Sales', FiShoppingCart],
  ['/admin/expenses', 'Expenses', FiDollarSign],
  ['/admin/reports', 'Reports', FiBarChart2],
  ['/admin/settings/profile', 'Admin Profile', FiUser],
  ['/admin/settings/company', 'Company Profile', FiBriefcase],
];

const truckLinks = [
  ['/truck/dashboard', 'Dashboard', FiTruck],
];

const quickLinks = [
  { href: '/admin/production', label: 'Production', icon: FiBox, alwaysVisible: false },
  { href: '/admin/sales', label: 'Sales', icon: FiShoppingCart, alwaysVisible: false },
  { href: '/admin/trucks', label: 'Trucks', icon: FiTruck, alwaysVisible: true },
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
  const isSuperAdmin = user?.role === 'super_admin';
  const links = pathname?.startsWith('/admin')
    ? (user?.role === 'super_admin' ? superAdminLinks : adminLinks)
    : truckLinks;
  const isAdminArea = pathname?.startsWith('/admin');
  // Trucks and Admin Profile already have their own dedicated icon in the
  // header (quickLinks / the account chip), so hide them from the dropdown
  // to avoid a duplicate entry. Company Profile has no such shortcut, so it
  // stays in the list — otherwise it would be unreachable.
  const menuLinks = isAdminArea
    ? links.filter(([href]) => href !== '/admin/trucks' && href !== '/admin/settings/profile')
    : links;
  const activeArea = pathname?.startsWith('/admin') ? 'Admin Desk' : 'Driver App';
  const hour = now?.getHours() ?? 0;
  const TimeIcon = hour >= 18 || hour < 6 ? FiMoon : FiSun;
  const timeLabel = now?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) || '--:--';
  const dateLabel = now?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) || '';
  const userName = user?.displayName || user?.username || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase();
  const roleLabel = String(user?.role || 'account').replace('_', ' ');

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

  const accountChip = (
    <>
      <span className={`relative grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white ${isSuperAdmin ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-blue-600'}`}>
        {userInitial}
        {isSuperAdmin && (
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white text-amber-600 ring-1 ring-amber-200">
            <FiShield size={9} />
          </span>
        )}
      </span>
      <div className="hidden max-w-28 leading-tight 2xl:block">
        <p className="truncate text-xs font-semibold text-slate-900">{userName}</p>
        <p className={`mt-0.5 text-[9px] font-bold uppercase tracking-wide ${isSuperAdmin ? 'text-amber-600' : 'text-slate-400 font-medium'}`}>{isSuperAdmin ? 'Super Admin' : roleLabel}</p>
      </div>
    </>
  );

  return (
    <header ref={menuRef} className="sticky top-0 z-30 px-3 pt-3 sm:px-5 md:px-8 md:pt-4">
      <div className="relative flex h-16 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
              open ? 'bg-blue-600 text-white' : 'bg-blue-50 text-iceblue-700 hover:bg-blue-100'
            }`}
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>

          <div className="hidden h-10 w-10 shrink-0 overflow-hidden rounded-xl sm:block">
            <BrandLogo alt="Business logo" className="h-full w-full object-cover" />
          </div>

          <div className="min-w-0 leading-tight">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide bg-gradient-to-br from-navy-900 via-navy-800 to-iceblue-700 bg-clip-text text-transparent">{activeArea}</p>
            <h1 className="truncate font-display text-sm font-bold text-slate-900 sm:text-base">{title}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {isAdminArea && quickLinks.map(({ href, label, icon: Icon, alwaysVisible }) => (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`${alwaysVisible ? 'flex' : 'hidden md:flex'} h-10 w-10 items-center justify-center rounded-xl transition ${
                pathname?.startsWith(href)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Icon />
            </Link>
          ))}

          {user?.role === 'super_admin' && (
            <select
              aria-label="Select dashboard branch"
              className="hidden h-10 max-w-52 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 xl:block"
              value={selectedBranch}
              onChange={(event) => changeBranch(event.target.value)}
            >
              <option value="">Overall — all branches</option>
              {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
            </select>
          )}

          <div className="hidden items-center gap-1.5 px-2 lg:flex">
            <TimeIcon className="text-blue-500" />
            <div className="leading-none">
              <p className="text-xs font-semibold text-slate-700">{timeLabel}</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">{dateLabel}</p>
            </div>
          </div>

          {isAdminArea ? (
            <Link
              href="/admin/settings/profile"
              title="Account settings"
              aria-label="Account settings"
              className={`hidden items-center gap-2 rounded-xl px-2 py-1 transition md:flex ${
                pathname?.startsWith('/admin/settings') ? 'bg-blue-50' : 'hover:bg-slate-50'
              }`}
            >
              {accountChip}
            </Link>
          ) : (
            <div className="hidden items-center gap-2 rounded-xl px-2 py-1 md:flex">
              {accountChip}
            </div>
          )}

          <button
            type="button"
            onClick={() => void logout()}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            aria-label="Logout"
            title="Logout"
          >
            <FiLogOut />
          </button>
        </div>

        {open && (
          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                  <BrandLogo alt="" className="h-full w-full object-cover" />
                </div>
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide bg-gradient-to-br from-navy-900 via-navy-800 to-iceblue-700 bg-clip-text text-transparent">{activeArea}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500">
                <TimeIcon className="text-blue-500" />
                {timeLabel}
              </div>
            </div>

            {user?.role === 'super_admin' && (
              <div className="border-b border-slate-100 px-4 py-3">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">View Branch</label>
                <select className="input-field h-9 rounded-xl bg-white text-xs" value={selectedBranch} onChange={(event) => changeBranch(event.target.value)}>
                  <option value="">Overall — all branches</option>
                  {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}
                </select>
              </div>
            )}

            <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{isAdminArea ? 'Admin Menu' : 'Driver Menu'}</p>
            <div className="max-h-[55vh] space-y-0.5 overflow-y-auto p-2">
              {menuLinks.map(([href, label, Icon]) => {
                const active = pathname?.startsWith(href as string);
                const LinkIcon = Icon as typeof FiGrid;

                return (
                  <Link
                    key={href as string}
                    href={href as string}
                    onClick={() => setOpen(false)}
                    className={`flex h-11 items-center gap-2.5 rounded-xl px-3 text-xs font-semibold transition ${
                      active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <LinkIcon className="shrink-0 text-base" />
                    {label as string}
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-slate-100 p-2">
              <button
                type="button"
                onClick={() => void logout()}
                className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold text-red-500 transition hover:bg-red-50"
              >
                <FiLogOut className="text-base" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
