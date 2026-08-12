import { getItemBarUsed } from './api';

export interface TruckOption { _id: string; truckName: string }
export interface SaleItem { size?: string; quantity?: number; pricePerBar?: number; total?: number }
export interface Sale {
  _id: string;
  date: string;
  truck?: { _id: string; truckName: string } | null;
  customer?: { _id: string; name: string; phoneNumber?: string } | null;
  saleType: string;
  items?: SaleItem[];
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: string;
}

export const indiaDateISO = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export const startOfIndiaDay = (date: string) => `${date}T00:00:00.000+05:30`;
export const endOfIndiaDay = (date: string) => `${date}T23:59:59.999+05:30`;

export const errorMessage = (error: any, fallback: string) => error?.response?.data?.message || error?.message || fallback;

export const formatDateTime = (date: string | Date) => new Date(date).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatTime = (date: string | Date) => new Date(date).toLocaleTimeString('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
});

export const saleBars = (sale: Sale) => (sale.items || []).reduce((sum, item) => sum + getItemBarUsed(item), 0);
