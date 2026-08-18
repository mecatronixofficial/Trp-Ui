'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiGrid, FiTruck, FiUsers, FiBox, FiShoppingCart,
  FiBarChart2, FiLogOut, FiUserCheck, FiGitBranch, FiDollarSign, FiMonitor, FiShield, FiUser, FiBriefcase,
} from 'react-icons/fi';
import { TbSnowflake } from 'react-icons/tb';
import { useAuth } from '../context/AuthContext';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: FiGrid },
  { href: '/admin/trucks', label: 'Trucks', icon: FiTruck },
  { href: '/admin/customers', label: 'Customers', icon: FiUsers },
  { href: '/admin/workers', label: 'Workers', icon: FiUserCheck },
  { href: '/admin/production', label: 'Production', icon: FiBox },
  { href: '/admin/sales', label: 'Sales', icon: FiShoppingCart },
  { href: '/admin/expenses', label: 'Expenses', icon: FiDollarSign },
  { href: '/admin/reports', label: 'Reports', icon: FiBarChart2 },
  { href: '/admin/sample', label: 'Entry', icon: FiMonitor },
  { href: '/admin/settings/profile', label: 'Admin Profile', icon: FiUser },
  { href: '/admin/settings/company', label: 'Company Profile', icon: FiBriefcase },
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
  const isSuperAdmin = user?.role === 'super_admin';
  const userName = user?.displayName || user?.username || 'User';
  const initial = userName.charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-navy-900 via-sky-900 to-iceblue-700 text-white md:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
          <TbSnowflake className="text-xl" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold leading-tight">Tiruppur Ice</p>
          <p className="text-xs text-iceblue-100/80">Since 2000</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {(user?.role === 'super_admin' ? superAdminLinks : links).map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? 'bg-white text-iceblue-700' : 'text-iceblue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="shrink-0 text-lg" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-2 flex items-center gap-3 px-1">
          <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isSuperAdmin ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-white/15'}`}>
            {initial}
            {isSuperAdmin && (
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white text-amber-600 ring-1 ring-amber-200">
                <FiShield size={9} />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{userName}</p>
            <p className={`truncate text-xs ${isSuperAdmin ? 'font-bold text-amber-200' : 'capitalize text-iceblue-100/80'}`}>{isSuperAdmin ? 'Super Admin' : (user?.role || 'account')}</p>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-iceblue-100/80 transition hover:bg-white/10 hover:text-white"
        >
          <FiLogOut /> Logout
        </button>
      </div>
    </aside>
  );
}
