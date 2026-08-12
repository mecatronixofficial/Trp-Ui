'use client';

import Modal from './Modal';
import { formatBarQuantity, formatCurrency, getItemBarUsed } from '../lib/api';
import { formatDateTime, type Sale } from '../lib/salesUtils';

export default function PrintBill({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <Modal title="Bill" onClose={onClose}>
      <div id="bill-print" className="text-sm space-y-3">
        <div className="text-center">
          <p className="font-display font-bold text-lg">Tiruppur Ice Since 2000</p>
          <p className="text-navy-800/60">Ice Bar Sales Receipt</p>
        </div>
        <div className="flex justify-between text-xs text-navy-800/70">
          <span>Date: {formatDateTime(sale.date)}</span>
        </div>
        <p className="text-xs">Customer: <strong>{sale.customer?.name || 'Unknown customer'}</strong></p>
        <table className="table-base">
          <thead><tr><th>Bar Used</th><th>Total</th></tr></thead>
          <tbody>
            {(sale.items || []).map((item, index) => (
              <tr key={index}>
                <td>{formatBarQuantity(getItemBarUsed(item)) || '0'}</td>
                <td>{formatCurrency(Number(item.total ?? (Number(item.quantity || 0) * Number(item.pricePerBar || 0))))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(sale.totalAmount)}</span></div>
        <div className="flex justify-between"><span>Paid ({sale.paymentMode})</span><span>{formatCurrency(sale.paidAmount)}</span></div>
        <div className="flex justify-between text-red-500 font-semibold"><span>Balance</span><span>{formatCurrency(sale.balanceAmount)}</span></div>
        <button type="button" onClick={() => window.print()} className="btn-primary print-hide w-full">Print</button>
      </div>
    </Modal>
  );
}
