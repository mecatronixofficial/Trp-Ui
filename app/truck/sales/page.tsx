'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import SaleForm from '../../../components/SaleForm';

export default function TruckSalePage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div className="card">
      <SaleForm fixedTruckId={user?.truck || ''} onSaved={() => router.push('/truck/dashboard')} />
    </div>
  );
}
