'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const message = loading ? 'Checking secure access' : user ? 'Opening your dashboard' : 'Opening sign in';

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else router.replace(user.role === 'admin' ? '/admin/dashboard' : '/truck/dashboard');
  }, [user, loading, router]);

  return <AppLoadingScreen message={message} role={user?.role || null} />;
}
