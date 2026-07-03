'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function RequireRole({
  role,
  children,
}: {
  role: 'admin' | 'truck';
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role !== role) {
      router.replace(user.role === 'admin' ? '/admin/dashboard' : '/truck/dashboard');
    }
  }, [user, loading, role, router]);

  if (loading || !user || user.role !== role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-iceblue-600 font-medium">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
