'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiGrid, FiTruck, FiUsers, FiBox, FiDollarSign, FiShoppingCart,
  FiTrash2, FiBarChart2, FiTrendingUp, FiSettings, FiLogOut,
} from 'react-icons/fi';
import { TbSnowflake } from 'react-icons/tb';
import { useAuth } from '../context/AuthContext';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: FiGrid },
  { href: '/admin/trucks', label: 'Trucks', icon: FiTruck },
  { href: '/admin/customers', label: 'Customers', icon: FiUsers },
  { href: '/admin/production', label: 'Production', icon: FiBox },
  { href: '/admin/making-cost', label: 'Making Cost', icon: FiDollarSign },
  { href: '/admin/sales', label: 'Sales', icon: FiShoppingCart },
  { href: '/admin/wastage', label: 'Wastage', icon: FiTrash2 },
  { href: '/admin/reports', label: 'Reports', icon: FiBarChart2 },
  { href: '/admin/settings', label: 'Settings', icon: FiSettings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-navy-900 text-white min-h-screen flex flex-col hidden md:flex">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-iceblue-500 flex items-center justify-center">
          <TbSnowflake className="text-white text-xl" />
        </div>
        <div>
          <p className="font-display font-semibold leading-tight">Tiruppur Ice</p>
          <p className="text-xs text-iceblue-200">Since 2000</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-iceblue-500 text-white shadow-ice' : 'text-iceblue-100 hover:bg-white/5'
              }`}
            >
              <Icon className="text-lg" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-iceblue-200 px-2 mb-2">Signed in as {user?.displayName || user?.username}</p>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-red-200 hover:bg-white/5"
        >
          <FiLogOut /> Logout
        </button>
      </div>
    </aside>
  );
}
