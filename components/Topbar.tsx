'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiMenu, FiX, FiLogOut } from 'react-icons/fi';
import { TbSnowflake } from 'react-icons/tb';
import { useAuth } from '../context/AuthContext';

const adminLinks = [
  ['/admin/dashboard', 'Dashboard'],
  ['/admin/trucks', 'Trucks'],
  ['/admin/customers', 'Customers'],
  ['/admin/production', 'Production'],
  ['/admin/making-cost', 'Making Cost'],
  ['/admin/sales', 'Sales'],
  ['/admin/wastage', 'Wastage'],
  ['/admin/reports', 'Reports'],
  ['/admin/settings', 'Settings'],
];

const truckLinks = [
  ['/truck/dashboard', 'Dashboard'],
  ['/truck/sales', 'Add Sale'],
  ['/truck/wastage', 'Add Wastage'],
];

export default function Topbar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const links = pathname?.startsWith('/admin') ? adminLinks : truckLinks;

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-iceblue-100">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-navy-800" onClick={() => setOpen(!open)}>
            {open ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
          <div className="md:hidden flex items-center gap-2">
            <TbSnowflake className="text-iceblue-500 text-xl" />
          </div>
          <h1 className="font-display font-semibold text-lg text-navy-900">{title}</h1>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm text-navy-800/70">
          <span>{user?.displayName || user?.username}</span>
          <button onClick={logout} className="text-red-500 flex items-center gap-1 hover:underline">
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-iceblue-100 px-4 py-3 space-y-1">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 rounded-xl text-sm font-medium ${
                pathname?.startsWith(href) ? 'bg-iceblue-500 text-white' : 'text-navy-800 hover:bg-iceblue-50'
              }`}
            >
              {label}
            </Link>
          ))}
          <button onClick={logout} className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-red-500">
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
