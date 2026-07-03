'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import AppLoadingScreen from './AppLoadingScreen';

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
    const message = loading ? 'Checking secure access' : user ? 'Opening your dashboard' : 'Opening sign in';
    return <AppLoadingScreen message={message} role={user?.role || role} />;
  }

  return <>{children}</>;
}
