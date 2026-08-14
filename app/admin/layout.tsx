'use client';

import Topbar from '../../components/Topbar';
import RequireRole from '../../components/RequireRole';
import { usePathname } from 'next/navigation';
import AdminQuickActions from '../../components/AdminQuickActions';

const titles: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/branches': 'Branch Management',
  '/admin/admins': 'Branch Admin Management',
  '/admin/trucks': 'Truck Management',
  '/admin/customers': 'Customer Management',
  '/admin/workers': 'Worker Management',
  '/admin/production': 'Ice Production',
  '/admin/sales': 'Sales',
  '/admin/expenses': 'Expenses',
  '/admin/reports': 'Reports',
  '/admin/sample': 'Entry',
  '/admin/settings': 'Settings',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pathname?.startsWith('/admin/customers/')
    ? 'Customer Profile'
    : pathname?.startsWith('/admin/trucks/')
      ? 'Truck Profile'
    : pathname?.startsWith('/admin/workers/buying-history')
      ? 'Daily Buying History'
    : pathname?.startsWith('/admin/workers/')
      ? 'Worker Profile'
    : Object.entries(titles).find(([p]) => pathname?.startsWith(p))?.[1] || 'Admin';

  return (
    <RequireRole role={['super_admin', 'admin']}>
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <Topbar title={title} />
          <main className="mx-auto w-full min-w-0 max-w-7xl px-3 py-4 pb-24 sm:px-4 md:p-8 md:pb-24">{children}</main>
          <AdminQuickActions />
        </div>
      </div>
    </RequireRole>
  );
}
