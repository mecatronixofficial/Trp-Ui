'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'truck';
  truck?: string | null;
  displayName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        const currentUser = {
          id: data.id || data.userId,
          username: data.username,
          role: data.role,
          truck: data.truck,
          displayName: data.displayName,
        };
        setUser(currentUser);
        Cookies.set('tii_user', JSON.stringify(currentUser), { expires: 1, sameSite: 'lax' });
      })
      .catch(() => {
        if (!active) return;
        Cookies.remove('tii_user');
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password });
    Cookies.set('tii_user', JSON.stringify(data.user), { expires: 1, sameSite: 'lax' });
    setUser(data.user);
    router.push(data.user.role === 'admin' ? '/admin/dashboard' : '/truck/dashboard');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* local cleanup still runs */
    }
    Cookies.remove('tii_user');
    setUser(null);
    router.push('/login');
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
