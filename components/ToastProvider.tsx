'use client';

import { useEffect, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import { mutationToast, showToast, TOAST_EVENT, type ToastDetail, type ToastTone } from '../lib/toast';

type ToastItem = ToastDetail & { id: number; duration: number };

const accents: Record<ToastTone, { icon: string; close: string; color: string }> = {
  success: { icon: 'bg-emerald-400 text-[#06265d]', close: 'text-emerald-400 hover:bg-emerald-400/10', color: '#34d399' },
  update: { icon: 'bg-sky-400 text-[#06265d]', close: 'text-sky-400 hover:bg-sky-400/10', color: '#38bdf8' },
  danger: { icon: 'bg-red-500 text-[#06265d]', close: 'text-red-400 hover:bg-red-400/10', color: '#ef4444' },
  warning: { icon: 'bg-amber-400 text-[#06265d]', close: 'text-amber-400 hover:bg-amber-400/10', color: '#fbbf24' },
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      const id = Date.now() + Math.random();
      const duration = detail.duration || 3500;
      setItems((current) => [...current.slice(-3), { ...detail, id, duration }]);
      timers.set(id, setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
        timers.delete(id);
      }, duration));
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      try {
        const response = await originalFetch(input, init);
        const notification = mutationToast(url, method);
        if (notification && response.ok) showToast(notification.message, notification.tone);
        else if (notification && !response.ok) showToast('Action failed. Please try again.', 'danger');
        return response;
      } catch (error) {
        if (mutationToast(url, method)) showToast('Network error. Please try again.', 'danger');
        throw error;
      }
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  const remove = (id: number) => setItems((current) => current.filter((item) => item.id !== id));

  return <>
    {children}
    <div className="pointer-events-none fixed right-3 top-3 z-[9999] flex w-[calc(100%-1.5rem)] max-w-md flex-col gap-3 sm:right-6 sm:top-6" aria-live="polite" aria-atomic="true">
      {items.map((item) => {
        const Icon = item.tone === 'success' ? FiCheckCircle : item.tone === 'update' ? FiInfo : FiAlertCircle;
        const accent = accents[item.tone];
        return <div key={item.id} role="status" className="toast-enter pointer-events-auto relative flex min-h-[56px] w-fit min-w-[220px] max-w-full self-end items-center gap-3 overflow-hidden rounded-lg border border-white/10 bg-[#06265d] px-4 py-2.5 text-white shadow-[0_14px_35px_rgba(2,23,62,0.25)] sm:max-w-md">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
              <circle className="toast-clock" cx="20" cy="20" r="18" pathLength="100" fill="none" stroke={accent.color} strokeWidth="2.5" strokeLinecap="round" style={{ animationDuration: `${item.duration}ms` }} />
            </svg>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${accent.icon}`}>
              <Icon className="h-4 w-4 stroke-[3]" />
            </span>
          </span>
          <p className="min-w-0 flex-1 text-[15px] font-medium leading-6 tracking-[0.01em] sm:text-base">{item.message}</p>
          <button type="button" onClick={() => remove(item.id)} className={`-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${accent.close}`} aria-label="Close notification"><FiX className="h-6 w-6 stroke-[2.25]" /></button>
        </div>;
      })}
    </div>
  </>;
}
