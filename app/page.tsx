'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else router.replace(user.role === 'truck' ? '/truck/dashboard' : '/admin/sample');
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white" aria-label="Loading">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-iceblue-100 border-t-iceblue-600" />
    </main>
  );
}
