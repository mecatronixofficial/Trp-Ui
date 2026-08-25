'use client';

import { useEffect, useState } from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import { mutationToast, showToast, TOAST_EVENT, type ToastDetail, type ToastTone } from '../lib/toast';

type ToastItem = ToastDetail & { id: number; duration: number };

const accents: Record<ToastTone, {
  title: string;
  icon: string;
  bar: string;
  glow: string;
  surface: string;
  eyebrow: string;
}> = {
  success: {
    title: 'Success',
    icon: 'bg-emerald-500 text-white shadow-emerald-500/30',
    bar: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400',
    glow: 'bg-emerald-400/20',
    surface: 'border-emerald-100/90 bg-gradient-to-br from-white via-white to-emerald-50/90',
    eyebrow: 'text-emerald-700',
  },
  update: {
    title: 'Updated',
    icon: 'bg-iceblue-600 text-white shadow-iceblue-500/30',
    bar: 'bg-gradient-to-r from-iceblue-600 via-sky-400 to-cyan-300',
    glow: 'bg-sky-400/20',
    surface: 'border-sky-100/90 bg-gradient-to-br from-white via-white to-sky-50/90',
    eyebrow: 'text-iceblue-700',
  },
  danger: {
    title: 'Action failed',
    icon: 'bg-red-500 text-white shadow-red-500/30',
    bar: 'bg-gradient-to-r from-red-600 via-rose-500 to-orange-400',
    glow: 'bg-red-400/20',
    surface: 'border-red-100/90 bg-gradient-to-br from-white via-white to-red-50/90',
    eyebrow: 'text-red-700',
  },
  warning: {
    title: 'Attention',
    icon: 'bg-amber-500 text-white shadow-amber-500/30',
    bar: 'bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300',
    glow: 'bg-amber-400/20',
    surface: 'border-amber-100/90 bg-gradient-to-br from-white via-white to-amber-50/90',
    eyebrow: 'text-amber-700',
  },
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      const id = Date.now() + Math.random();
      const duration = Math.max(1800, detail.duration || 4000);
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
    <div className="pointer-events-none fixed inset-x-2.5 top-2.5 z-[9999] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[20rem]" aria-live="polite" aria-atomic="false">
      {items.map((item) => {
        const Icon = item.tone === 'success'
          ? FiCheckCircle
          : item.tone === 'update'
            ? FiInfo
            : item.tone === 'warning'
              ? FiAlertTriangle
              : FiAlertCircle;
        const accent = accents[item.tone];
        return <div
          key={item.id}
          role={item.tone === 'danger' || item.tone === 'warning' ? 'alert' : 'status'}
          className={`toast-enter pointer-events-auto relative w-full overflow-hidden rounded-2xl border p-0.5 shadow-[0_16px_40px_-22px_rgba(8,35,52,0.42)] backdrop-blur-xl ${accent.surface}`}
        >
          <span className={`absolute -right-6 -top-8 h-16 w-16 rounded-full blur-xl ${accent.glow}`} aria-hidden="true" />
          <div className="relative flex items-start gap-2 rounded-[0.85rem] px-2.5 py-2">
            <span className={`toast-icon-pop mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.65rem] shadow-md ${accent.icon}`}>
              <Icon className="h-4 w-4 stroke-[2.5]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[8px] font-black uppercase tracking-[0.14em] ${accent.eyebrow}`}>{accent.title}</p>
              <p className="mt-px break-words text-xs font-semibold leading-4 text-slate-700">{item.message}</p>
            </div>
            <button type="button" onClick={() => remove(item.id)} className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/90 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-iceblue-300" aria-label="Close notification"><FiX className="h-3.5 w-3.5 stroke-[2.5]" /></button>
          </div>
          <span className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-slate-900/[0.04]" aria-hidden="true">
            <span className={`toast-bar block h-full origin-left ${accent.bar}`} style={{ animationDuration: `${item.duration}ms` }} />
          </span>
        </div>;
      })}
    </div>
  </>;
}
