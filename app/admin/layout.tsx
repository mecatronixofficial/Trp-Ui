'use client';

import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import RequireRole from '../../components/RequireRole';
import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/trucks': 'Truck Management',
  '/admin/customers': 'Customer Management',
  '/admin/production': 'Ice Production',
  '/admin/making-cost': 'Making Cost',
  '/admin/sales': 'Sales',
  '/admin/wastage': 'Wastage',
  '/admin/reports': 'Reports',
  '/admin/settings': 'Settings',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = Object.entries(titles).find(([p]) => pathname?.startsWith(p))?.[1] || 'Admin';

  return (
    <RequireRole role="admin">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <Topbar title={title} />
          <main className="p-4 md:p-8 max-w-7xl mx-auto">{children}</main>
        </div>
      </div>
    </RequireRole>
  );
}
