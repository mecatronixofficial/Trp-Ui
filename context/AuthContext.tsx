'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

export interface AuthUser {
  id: string;
  username: string;
  role: 'super_admin' | 'admin' | 'truck';
  branch?: string | null;
  truck?: string | null;
  displayName?: string;
  phoneNumber?: string | null;
  email?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: (options?: { confirmedTruckClose?: boolean }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const indiaDateISO = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

type TruckLogoutSummary = {
  taken: number;
  sold: number;
  collectedAmount: number;
  pendingAmount: number;
  wastage: number;
  returned: number;
  remaining: number;
};

function requestTruckLogout(detail: { mode: 'return' | 'review' | 'close' | 'waiting' | 'error'; remaining?: number; message?: string; summary?: TruckLogoutSummary }) {
  window.dispatchEvent(new CustomEvent('tii:truck-logout-required', { detail }));
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = async (active: () => boolean) => {
    try {
      const { data } = await api.get('/auth/me');
      if (!active()) return;
      const currentUser = {
        id: data.id || data.userId,
        username: data.username,
        role: data.role,
        truck: data.truck,
        displayName: data.displayName,
        phoneNumber: data.phoneNumber,
        email: data.email,
        branch: data.branch,
      };
      if (currentUser.role !== 'super_admin') {
        window.localStorage.removeItem('tii_selected_branch');
      }
      setUser(currentUser);
      Cookies.set('tii_user', JSON.stringify(currentUser), { expires: 1, sameSite: 'lax' });
    } catch {
      if (!active()) return;
      Cookies.remove('tii_user');
      setUser(null);
    }
  };

  useEffect(() => {
    let active = true;
    fetchProfile(() => active).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const refreshUser = () => fetchProfile(() => true);

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password });
    if (data.user.role !== 'super_admin') {
      window.localStorage.removeItem('tii_selected_branch');
    }
    Cookies.set('tii_user', JSON.stringify(data.user), { expires: 1, sameSite: 'lax' });
    setUser(data.user);
    router.push(data.user.role === 'truck' ? '/truck/dashboard' : '/admin/sample');
  };

  const logout = async (options?: { confirmedTruckClose?: boolean }) => {
    if (user?.role === 'truck' && !options?.confirmedTruckClose) {
      try {
        const { data } = await api.get('/truck-loads/reconciliation', { params: { date: indiaDateISO() } });
        const closing = Array.isArray(data) ? data[0] : null;
        const remaining = Number(closing?.remaining || 0);
        const summary: TruckLogoutSummary = {
          taken: Number(closing?.taken || 0),
          sold: Number(closing?.sold || 0),
          collectedAmount: Number(closing?.collectedAmount || 0),
          pendingAmount: Number(closing?.pendingAmount || 0),
          wastage: Number(closing?.wastage || 0),
          returned: Number(closing?.returned || 0),
          remaining,
        };
        if (closing?.driverClosed && !closing?.checked) {
          requestTruckLogout({ mode: 'waiting', remaining, summary, message: 'Returned bars are waiting for admin approval.' });
          return;
        }
        if (!closing?.driverClosed && (remaining > 0.0001 || summary.returned > 0.0001)) {
          requestTruckLogout({ mode: 'return', remaining, summary });
          return;
        }
        if (!closing?.driverClosed && remaining < -0.0001) {
          requestTruckLogout({ mode: 'review', remaining, summary });
          return;
        }
        if (!closing?.driverClosed) {
          requestTruckLogout({ mode: 'close', remaining: 0, summary });
          return;
        }
      } catch (error: any) {
        requestTruckLogout({
          mode: 'error',
          message: error?.response?.data?.message || 'Could not verify the truck balance. Refresh and try logout again.',
        });
        return;
      }
    }
    try {
      await api.post('/auth/logout');
    } catch (error: any) {
      if (user?.role === 'truck') {
        requestTruckLogout({
          mode: 'error',
          message: error?.response?.data?.message || 'Logout was blocked. Refresh the truck balance and try again.',
        });
        return;
      }
      /* Admin local cleanup still runs if the server is temporarily unavailable. */
    }
    Cookies.remove('tii_user');
    window.localStorage.removeItem('tii_selected_branch');
    setUser(null);
    router.push('/login');
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
