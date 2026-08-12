import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const branch = window.localStorage.getItem('tii_selected_branch');
    const isAuthRequest = String(config.url || '').startsWith('/auth/');
    if (branch && !isAuthRequest) config.headers['X-Branch-Id'] = branch;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('tii_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;

// Reuse identical GET requests that are already in flight. This prevents React
// development remounts and quick navigation from sending duplicate bursts to
// rate-limited backend endpoints.
const pendingGets = new Map<string, Promise<AxiosResponse<any>>>();

export function dedupedGet<T = any>(url: string, config?: AxiosRequestConfig) {
  const key = `${url}:${JSON.stringify(config?.params || {})}`;
  const existing = pendingGets.get(key);
  if (existing) return existing as Promise<AxiosResponse<T>>;

  const request = api.get<T>(url, config).finally(() => pendingGets.delete(key));
  pendingGets.set(key, request);
  return request;
}

// A full ice bar is size 1. Smaller sizes are split from full bars when selling.
export const ICE_BAR_SIZES = ['1/4', '1/2', '3/4', '1'] as const;
export const PRODUCTION_ICE_BAR_SIZES = ['1'] as const;

export const COST_TYPES = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'labour', label: 'Labour' },
  { value: 'petrol_diesel', label: 'Petrol / Diesel' },
  { value: 'machine_maintenance', label: 'Machine Maintenance' },
  { value: 'salt_chemical', label: 'Salt / Chemical' },
  { value: 'packing', label: 'Packing' },
  { value: 'truck_expense', label: 'Truck Expense' },
  { value: 'snacks_expenses', label: 'Snacks Expenses' },
  { value: 'advance_for_employee', label: 'Advance for Employee' },
  { value: 'chat_expenses', label: 'Other Expenses' },
  { value: 'other_expenses', label: 'Other Expenses' },
  { value: 'other', label: 'Other' },
];

export const WASTAGE_REASONS = [
  { value: 'broken', label: 'Broken' },
  { value: 'melted', label: 'Melted' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'unsold', label: 'Unsold' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit', label: 'Credit' },
];

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(
    amount || 0,
  );
}

export function parseBarQuantity(value: string | number) {
  const text = String(value).trim();
  if (text.includes('/')) {
    const [top, bottom] = text.split('/').map(Number);
    return bottom ? top / bottom : 0;
  }
  return Number(text) || 0;
}

export function formatBarQuantity(value: string | number) {
  const quantity = parseBarQuantity(value);
  if (!quantity) return '';
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
}

export function getItemBarUsed(item: { size?: string | number; quantity?: string | number }) {
  return (Number(item.quantity) || 0) * (parseBarQuantity(item.size || '1') || 1);
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
