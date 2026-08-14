'use client';

export type ToastTone = 'success' | 'update' | 'danger' | 'warning';

export type ToastDetail = {
  message: string;
  tone: ToastTone;
  duration?: number;
};

const TOAST_EVENT = 'tii:toast';

export function showToast(message: string, tone: ToastTone = 'success', duration = 3500) {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, {
    detail: { message, tone, duration },
  }));
}

export const toast = {
  success: (message: string) => showToast(message, 'success'),
  update: (message: string) => showToast(message, 'update'),
  danger: (message: string) => showToast(message, 'danger'),
  warning: (message: string) => showToast(message, 'warning'),
};

function resourceName(url: string) {
  const path = url.split('?')[0].replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api\//, '/');
  const firstPart = path.split('/').filter(Boolean)[0] || 'item';
  const names: Record<string, string> = {
    auth: 'Account', branches: 'Branch', admins: 'Admin', customers: 'Customer',
    workers: 'Worker', trucks: 'Truck', sales: 'Sale', expenses: 'Expense',
    production: 'Production', payments: 'Payment', wastage: 'Wastage',
    settings: 'Settings', 'price-list': 'Price', 'truck-assignments': 'Truck assignment',
    'truck-loads': 'Truck load', purchases: 'Purchase', attendance: 'Attendance',
  };
  return names[firstPart] || firstPart.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export function mutationToast(url: string, method = 'GET') {
  const action = method.toUpperCase();
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('/auth/presence')) return null;
  if (lowerUrl.includes('/auth/login')) return { message: 'Login successful.', tone: 'success' as const };
  if (lowerUrl.includes('/auth/logout')) return { message: 'Logged out successfully.', tone: 'danger' as const };
  if (lowerUrl.includes('forgot-password')) return { message: 'Password reset code sent.', tone: 'update' as const };
  if (lowerUrl.includes('reset-password')) return { message: 'Password updated successfully.', tone: 'update' as const };
  if (/\/(cancel|reject)(\/|$)/.test(lowerUrl)) return { message: 'Action cancelled successfully.', tone: 'danger' as const };
  if (/\/(accept|approve|check|close|reopen|activate|deactivate)(\/|$)/.test(lowerUrl)) return { message: 'Status updated successfully.', tone: 'update' as const };
  const resource = resourceName(url);
  if (action === 'DELETE') return { message: `${resource} deleted successfully.`, tone: 'danger' as const };
  if (action === 'PUT' || action === 'PATCH') return { message: `${resource} updated successfully.`, tone: 'update' as const };
  if (action === 'POST') return { message: `${resource} added successfully.`, tone: 'success' as const };
  return null;
}

export { TOAST_EVENT };
