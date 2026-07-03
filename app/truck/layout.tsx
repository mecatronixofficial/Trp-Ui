'use client';

import Topbar from '../../components/Topbar';
import RequireRole from '../../components/RequireRole';
import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/truck/dashboard': 'My Dashboard',
  '/truck/sales': 'Add Sale',
  '/truck/wastage': 'Add Wastage',
};

export default function TruckLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = Object.entries(titles).find(([p]) => pathname?.startsWith(p))?.[1] || 'Truck';

  return (
    <RequireRole role="truck">
      <div className="min-h-screen">
        <Topbar title={title} />
        <main className="p-4 md:p-8 max-w-3xl mx-auto">{children}</main>
      </div>
    </RequireRole>
  );
}
