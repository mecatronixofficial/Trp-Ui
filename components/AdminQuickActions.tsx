'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { FiPlus, FiShoppingCart, FiTruck } from 'react-icons/fi';
import useDismissibleMenu from '../hooks/useDismissibleMenu';

export default function AdminQuickActions() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  useDismissibleMenu(open, menuRef, closeMenu);

  // Sales has its own add-sale floating action. Hiding the shared menu here
  // prevents two separate "+ / Add Sale" controls from appearing together.
  if (pathname.startsWith('/admin/sales') || pathname === '/admin/production' || pathname === '/admin/workers') return null;

  return (
    <div ref={menuRef} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <div className="absolute bottom-16 right-0 w-48 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <Link href="/admin/sales?add=sale" onClick={() => setOpen(false)} className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-navy-900 hover:bg-iceblue-50">
            <FiShoppingCart className="text-emerald-600" /> Add Sale
          </Link>
          <Link href="/admin/trucks?add=truck" onClick={() => setOpen(false)} className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-navy-900 hover:bg-iceblue-50">
            <FiTruck className="text-iceblue-600" /> Add Truck
          </Link>
        </div>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Open quick actions" aria-expanded={open} className="grid h-14 w-14 place-items-center rounded-full bg-iceblue-600 p-0 text-xl text-white shadow-xl transition hover:bg-iceblue-700">
        <FiPlus className={`transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>
    </div>
  );
}
