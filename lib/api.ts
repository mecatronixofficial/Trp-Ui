import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('tii_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('tii_token');
      Cookies.remove('tii_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;

// Ice bar sizes shared across forms
export const ICE_BAR_SIZES = ['1/4', '1/2', '3/4', '1', '2', '3'] as const;

export const COST_TYPES = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'labour', label: 'Labour' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'machine_maintenance', label: 'Machine Maintenance' },
  { value: 'salt_chemical', label: 'Salt / Chemical' },
  { value: 'packing', label: 'Packing' },
  { value: 'truck_expense', label: 'Truck Expense' },
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

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
