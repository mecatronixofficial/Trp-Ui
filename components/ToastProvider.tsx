'use client';

import { useEffect, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import { mutationToast, showToast, TOAST_EVENT, type ToastDetail, type ToastTone } from '../lib/toast';

type ToastItem = ToastDetail & { id: number; duration: number };

const accents: Record<ToastTone, { icon: string; bar: string; color: string }> = {
  success: { icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500', color: '#10b981' },
  update: { icon: 'bg-blue-50 text-iceblue-700', bar: 'bg-blue-500', color: '#2563eb' },
  danger: { icon: 'bg-red-50 text-red-600', bar: 'bg-red-500', color: '#ef4444' },
  warning: { icon: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500', color: '#d97706' },
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
    <div className="pointer-events-none fixed right-3 top-3 z-[9999] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2.5 sm:right-6 sm:top-6" aria-live="polite" aria-atomic="true">
      {items.map((item) => {
        const Icon = item.tone === 'success' ? FiCheckCircle : item.tone === 'update' ? FiInfo : FiAlertCircle;
        const accent = accents[item.tone];
        return <div key={item.id} role="status" className="toast-enter pointer-events-auto relative flex w-fit min-w-[240px] max-w-full self-end items-start gap-3 overflow-hidden rounded-2xl bg-white py-3 pl-4 pr-3 text-gray-900 shadow-xl shadow-black/10 ring-1 ring-black/5 sm:max-w-sm">
          <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent.color }} aria-hidden="true" />
          <span className={`relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${accent.icon}`}>
            <Icon className="h-4 w-4 stroke-[2.5]" />
          </span>
          <p className="min-w-0 flex-1 pt-1 text-sm font-medium leading-5 text-gray-800">{item.message}</p>
          <button type="button" onClick={() => remove(item.id)} className="-mr-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Close notification"><FiX className="h-4 w-4 stroke-[2.5]" /></button>
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100">
            <span className={`toast-bar block h-full ${accent.bar}`} style={{ animationDuration: `${item.duration}ms` }} />
          </span>
        </div>;
      })}
    </div>
  </>;
}
