'use client';

import Topbar from '../../components/Topbar';
import RequireRole from '../../components/RequireRole';
import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/truck/dashboard': 'Driver Dashboard',
  '/truck/sales': 'Add Sale',
  '/truck/wastage': 'Add Wastage',
};

export default function TruckLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = Object.entries(titles).find(([p]) => pathname?.startsWith(p))?.[1] || 'Truck';

  return (
    <RequireRole role="truck">
      <div className="min-h-screen w-full max-w-full overflow-x-hidden">
        <Topbar title={title} />
        <main className="mx-auto w-full min-w-0 max-w-7xl p-3 sm:p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    </RequireRole>
  );
}
