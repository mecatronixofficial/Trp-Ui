'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiDollarSign } from 'react-icons/fi';
import api from '../lib/api';
import { PAYMENT_MODES, formatCurrency, formatDate } from '../lib/api';
import Modal from './Modal';
import { indiaDateISO, type Sale } from '../lib/salesUtils';

interface PaymentModalProps {
  sale: Sale;
  onClose: () => void;
  onSaved: () => void;
}

export default function PaymentModal({ sale, onClose, onSaved }: PaymentModalProps) {
  const [form, setForm] = useState({ date: indiaDateISO(), amount: String(sale.balanceAmount || ''), paymentMode: 'cash', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (amount > sale.balanceAmount) {
      setError('Amount cannot exceed the balance due');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/sales/${sale._id}/payments`, { ...form, amount });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Collect Payment: ${sale.customer?.name || 'Customer'}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="rounded-2xl bg-iceblue-50 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-navy-800/60">Bill Date</span>
            <strong>{formatDate(sale.date)}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-navy-800/60">Customer</span>
            {sale.customer?._id ? (
              <Link href={`/admin/customers/${sale.customer._id}`} className="font-bold text-iceblue-700 underline-offset-2 hover:underline">
                {sale.customer.name}
              </Link>
            ) : <strong>Unknown customer</strong>}
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-navy-800/60">Balance</span>
            <strong className="text-red-600">{formatCurrency(sale.balanceAmount)}</strong>
          </div>
        </div>

        <div>
          <label className="label-text">Payment Date</label>
          <input
            type="date"
            className="input-field h-12"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-text">Amount Paid</label>
            <input
              type="number"
              min={1}
              max={sale.balanceAmount}
              step="0.01"
              className="input-field h-12"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label-text">Mode</label>
            <select
              className="input-field h-12"
              value={form.paymentMode}
              onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
            >
              {PAYMENT_MODES.filter((mode) => mode.value !== 'credit').map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label-text">Notes</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button className="btn-primary flex h-12 w-full items-center justify-center gap-2" disabled={saving}>
          <FiDollarSign /> {saving ? 'Updating...' : 'Update Payment'}
        </button>
      </form>
    </Modal>
  );
}
