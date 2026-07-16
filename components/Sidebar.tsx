'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiGrid, FiTruck, FiUsers, FiBox, FiDollarSign, FiShoppingCart,
  FiTrash2, FiBarChart2, FiSettings, FiLogOut, FiUserCheck, FiGitBranch,
} from 'react-icons/fi';
import { TbSnowflake } from 'react-icons/tb';
import { useAuth } from '../context/AuthContext';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: FiGrid },
  { href: '/admin/trucks', label: 'Trucks', icon: FiTruck },
  { href: '/admin/customers', label: 'Customers', icon: FiUsers },
  { href: '/admin/workers', label: 'Workers', icon: FiUserCheck },
  { href: '/admin/production', label: 'Production', icon: FiBox },
  { href: '/admin/making-cost', label: 'Making Cost', icon: FiDollarSign },
  { href: '/admin/sales', label: 'Sales', icon: FiShoppingCart },
  { href: '/admin/wastage', label: 'Wastage', icon: FiTrash2 },
  { href: '/admin/reports', label: 'Reports', icon: FiBarChart2 },
  { href: '/admin/settings', label: 'Settings', icon: FiSettings },
];

const superAdminLinks = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: FiGrid },
  { href: '/admin/branches', label: 'Branches', icon: FiGitBranch },
  { href: '/admin/admins', label: 'Branch Admins', icon: FiUserCheck },
  ...links.filter((link) => link.href !== '/admin/dashboard'),
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const userName = user?.displayName || user?.username || 'User';
  const initial = userName.charAt(0).toUpperCase();

  return (
    <aside className="hidden min-h-screen w-[17rem] shrink-0 bg-[#071824] text-white shadow-2xl shadow-navy-900/20 md:flex md:flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-iceblue-700 shadow-lg shadow-black/20">
            <TbSnowflake className="text-2xl" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display font-semibold leading-tight">Tiruppur Ice</p>
            <p className="text-xs font-medium text-iceblue-200">Since 2000</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-iceblue-200/70">Admin Menu</p>
        {(user?.role === 'super_admin' ? superAdminLinks : links).map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition ${
                active
                  ? 'bg-white text-navy-900 shadow-xl shadow-black/20'
                  : 'text-iceblue-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              {active && <span className="absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-iceblue-300" />}
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                active ? 'bg-iceblue-50 text-iceblue-700' : 'bg-white/10 text-iceblue-200 group-hover:bg-white/15 group-hover:text-white'
              }`}>
                <Icon className="text-lg" />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-navy-900">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="text-xs capitalize text-iceblue-200/80">{user?.role || 'account'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
        >
          <FiLogOut /> Logout
        </button>
      </div>
    </aside>
  );
}
