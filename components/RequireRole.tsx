'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import AppLoadingScreen from './AppLoadingScreen';

export default function RequireRole({
  role,
  children,
}: {
  role: 'super_admin' | 'admin' | 'truck' | Array<'super_admin' | 'admin' | 'truck'>;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (!(Array.isArray(role) ? role.includes(user.role) : user.role === role)) {
      router.replace(user.role === 'truck' ? '/truck/dashboard' : '/admin/dashboard');
    }
  }, [user, loading, role, router]);

  const allowed = !!user && (Array.isArray(role) ? role.includes(user.role) : user.role === role);
  if (loading || !allowed) {
    const message = loading ? 'Checking secure access' : user ? 'Opening your dashboard' : 'Opening sign in';
    return <AppLoadingScreen message={message} role={user?.role || (Array.isArray(role) ? role[0] : role)} />;
  }

  return <>{children}</>;
}
