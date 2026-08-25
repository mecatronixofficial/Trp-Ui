'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiClock, FiPackage, FiRefreshCcw, FiTruck } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api, { formatBarQuantity, formatCurrency } from '../lib/api';
import Modal from './Modal';

type LogoutSummary = {
  taken: number;
  sold: number;
  collectedAmount: number;
  pendingAmount: number;
  wastage: number;
  returned: number;
  remaining: number;
  driverClosed?: boolean;
  checked?: boolean;
  requiresAdminApproval?: boolean;
};

type LogoutPrompt = {
  mode: 'return' | 'review' | 'close' | 'waiting' | 'error';
  remaining?: number;
  message?: string;
  summary?: LogoutSummary;
};

const indiaDateISO = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const summaryFromClosing = (closing: any): LogoutSummary => ({
  taken: Number(closing?.taken || 0),
  sold: Number(closing?.sold || 0),
  collectedAmount: Number(closing?.collectedAmount || 0),
  pendingAmount: Number(closing?.pendingAmount || 0),
  wastage: Number(closing?.wastage || 0),
  returned: Number(closing?.returned || 0),
  remaining: Number(closing?.remaining || 0),
  driverClosed: Boolean(closing?.driverClosed),
  checked: Boolean(closing?.checked),
  requiresAdminApproval: Boolean(closing?.requiresAdminApproval),
});

export default function TruckLogoutManager() {
  const { user, logout } = useAuth();
  const [prompt, setPrompt] = useState<LogoutPrompt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [approvalPending, setApprovalPending] = useState(false);
  const checkingRef = useRef(false);

  const checkApproval = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setError('');
    try {
      const { data: rows } = await api.get('/truck-loads/reconciliation', { params: { date: indiaDateISO() } });
      const closing = Array.isArray(rows) ? rows[0] || null : null;
      if (closing?.driverClosed && closing?.checked) {
        window.sessionStorage.removeItem('tii_logout_after_return');
        setApprovalPending(false);
        setPrompt(null);
        await logout({ confirmedTruckClose: true });
        return;
      }
      if (closing?.driverClosed) {
        setPrompt({ mode: 'waiting', remaining: Number(closing.remaining || 0), summary: summaryFromClosing(closing) });
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not check the return approval status.');
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [logout]);

  useEffect(() => {
    if (user?.role !== 'truck') return;
    const handleLogoutRequired = (event: Event) => {
      const detail = (event as CustomEvent<LogoutPrompt>).detail;
      setError('');
      setPrompt(detail);
      if (detail.mode === 'waiting') {
        window.sessionStorage.setItem('tii_logout_after_return', 'true');
        setApprovalPending(true);
      }
    };
    window.addEventListener('tii:truck-logout-required', handleLogoutRequired);
    if (window.sessionStorage.getItem('tii_logout_after_return') === 'true') {
      setApprovalPending(true);
      void checkApproval();
    }
    return () => window.removeEventListener('tii:truck-logout-required', handleLogoutRequired);
  }, [checkApproval, user?.role]);

  useEffect(() => {
    if (!approvalPending) return;
    const timer = window.setInterval(() => void checkApproval(), 15_000);
    return () => window.clearInterval(timer);
  }, [approvalPending, checkApproval]);

  const submitClosing = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data: closing } = await api.post('/truck-loads/reconciliation/driver-close', { date: indiaDateISO() });
      if (closing?.requiresAdminApproval) {
        window.sessionStorage.setItem('tii_logout_after_return', 'true');
        setApprovalPending(true);
        setPrompt({ mode: 'waiting', remaining: 0, summary: summaryFromClosing(closing), message: 'Return submitted. Waiting for admin approval.' });
      } else {
        setPrompt(null);
        await logout({ confirmedTruckClose: true });
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not close the truck day.');
    } finally {
      setSubmitting(false);
    }
  };

  const closePrompt = () => {
    if (prompt?.mode === 'waiting') {
      window.sessionStorage.removeItem('tii_logout_after_return');
      setApprovalPending(false);
    }
    setError('');
    setPrompt(null);
  };

  if (!prompt) return null;

  const title = prompt.mode === 'return'
    ? 'Return Ice Bars Before Logout'
    : prompt.mode === 'review'
      ? 'Admin Verification Required'
      : prompt.mode === 'close'
        ? 'Check All & Close'
        : prompt.mode === 'waiting'
          ? 'Waiting for Admin Approval'
          : 'Logout Check Failed';

  return (
    <Modal title={title} onClose={closePrompt}>
      <div className="space-y-4">
        {prompt.summary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ['Taken', formatBarQuantity(prompt.summary.taken) || '0'],
              ['Sold', formatBarQuantity(prompt.summary.sold) || '0'],
              ['Collection', formatCurrency(prompt.summary.collectedAmount)],
              ['Pending', formatCurrency(prompt.summary.pendingAmount)],
              ['Wastage', formatBarQuantity(prompt.summary.wastage) || '0'],
              ['Balance', formatBarQuantity(Math.max(0, prompt.summary.remaining)) || '0'],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-iceblue-100 bg-iceblue-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase text-navy-800/45">{label}</p>
                <p className="mt-1 font-bold text-navy-900">{value}</p>
              </div>
            ))}
          </div>
        )}

        {error && <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        {prompt.mode === 'return' && (
          <>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="flex items-center gap-2 font-semibold"><FiPackage /> Ice bars are still with this truck</p>
              <p className="mt-2 text-sm leading-6">Return <strong>{formatBarQuantity(prompt.remaining || 0)} bar(s)</strong> before going offline. The truck stays online until an administrator accepts the return.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={closePrompt} disabled={submitting} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => void submitClosing()} disabled={submitting} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"><FiTruck />{submitting ? 'Submitting...' : `Return ${formatBarQuantity(prompt.remaining || 0)} Bars`}</button>
            </div>
          </>
        )}

        {prompt.mode === 'review' && (
          <>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="flex items-center gap-2 font-semibold"><FiAlertCircle /> Entry difference needs Admin verification</p>
              <p className="mt-2 text-sm leading-6">Today&apos;s entries differ by {formatBarQuantity(Math.abs(prompt.remaining || 0))} bar(s). Submit the closing for administrator review.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={closePrompt} disabled={submitting} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => void submitClosing()} disabled={submitting} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"><FiCheckCircle />{submitting ? 'Submitting...' : 'Submit to Admin'}</button>
            </div>
          </>
        )}

        {prompt.mode === 'close' && (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="flex items-center gap-2 font-semibold"><FiCheckCircle /> No ice bars remain in this truck</p>
              <p className="mt-2 text-sm leading-6">Confirm today&apos;s figures and close the truck before logging out.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={closePrompt} disabled={submitting} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => Number(prompt.summary?.taken || 0) > 0 ? void submitClosing() : void logout({ confirmedTruckClose: true })} disabled={submitting} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"><FiCheckCircle />{submitting ? 'Closing...' : 'Check All & Close'}</button>
            </div>
          </>
        )}

        {prompt.mode === 'waiting' && (
          <>
            <div className="rounded-2xl border border-iceblue-200 bg-iceblue-50 p-4 text-navy-900">
              <p className="flex items-center gap-2 font-semibold"><FiClock /> Return request sent to Admin</p>
              <p className="mt-2 text-sm leading-6">The truck remains online until an administrator accepts the returned bars. Approval is checked automatically.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={closePrompt} className="btn-secondary">Stay Online</button>
              <button type="button" onClick={() => void checkApproval()} disabled={checking} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"><FiRefreshCcw />{checking ? 'Checking...' : 'Check Approval'}</button>
            </div>
          </>
        )}

        {prompt.mode === 'error' && (
          <>
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{prompt.message || 'Could not verify the truck balance. Logout was cancelled for safety.'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={closePrompt} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => { setPrompt(null); void logout(); }} className="btn-primary">Try Again</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
