import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  History,
  Sparkles,
  X,
} from 'lucide-react';
import { EnrichedDocument } from '../types/document';
import { formatDisplayDate, getTodayIsoLocal } from '../utils/expiry';
import { calculateQuickExtensionDate } from '../utils/renewalHistory';

interface RecordRenewalModalProps {
  document: EnrichedDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onRecordRenewal: (
    doc: EnrichedDocument,
    newExpiryDate: string,
    renewalDate: string,
    renewalNotes?: string
  ) => Promise<void>;
}

export function RecordRenewalModal({
  document: doc,
  isOpen,
  onClose,
  onRecordRenewal,
}: RecordRenewalModalProps) {
  const today = getTodayIsoLocal();

  const [renewalDate, setRenewalDate] = useState(today);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [renewalNotes, setRenewalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize dates when modal opens or document changes
  useEffect(() => {
    if (doc) {
      setRenewalDate(today);
      // Default new expiry date to +1 year from current expiry date or today, whichever is later
      const baseDate = doc.expiryDate > today ? doc.expiryDate : today;
      const defaultNewExpiry = calculateQuickExtensionDate(baseDate, 12);
      setNewExpiryDate(defaultNewExpiry);
      setRenewalNotes('');
      setError(null);
    }
  }, [doc, isOpen, today]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !doc) return null;

  const handleApplyPreset = (months: number) => {
    const baseDate = doc.expiryDate > renewalDate ? doc.expiryDate : renewalDate;
    const extended = calculateQuickExtensionDate(baseDate, months);
    setNewExpiryDate(extended);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!newExpiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(newExpiryDate)) {
      setError('Please select a valid new expiry date (YYYY-MM-DD).');
      return;
    }

    if (!renewalDate || !/^\d{4}-\d{2}-\d{2}$/.test(renewalDate)) {
      setError('Please enter a valid renewal date (YYYY-MM-DD).');
      return;
    }

    if (newExpiryDate <= doc.expiryDate) {
      setError(
        `New expiry date (${formatDisplayDate(newExpiryDate)}) must be after previous expiry date (${formatDisplayDate(doc.expiryDate)}).`
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onRecordRenewal(doc, newExpiryDate, renewalDate, renewalNotes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record renewal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-[2px] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="renewal-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <h2
                id="renewal-modal-title"
                className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Record Document Renewal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {doc.name} · {doc.category}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {/* Previous Expiry Notice Card */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium uppercase tracking-wider">
                Current / Previous Expiry
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatDisplayDate(doc.expiryDate)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium uppercase tracking-wider">
                Current Status
              </span>
              <span
                className={`font-semibold ${
                  doc.computedStatus === 'Expired'
                    ? 'text-red-700 dark:text-red-400'
                    : doc.computedStatus === 'Expiring Soon'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {doc.computedStatus}
              </span>
            </div>
          </div>

          {/* Renewal Date */}
          <div>
            <label
              htmlFor="renewal-date"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Renewal Date (Date Renewal was Processed)
            </label>
            <input
              id="renewal-date"
              type="date"
              required
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              disabled={submitting}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {/* New Expiry Date */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="new-expiry-date"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                New Expiry Date
              </label>
              <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Quick presets:
              </span>
            </div>

            {/* Quick Extension Presets */}
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => handleApplyPreset(6)}
                className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                +6 Months
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(12)}
                className="h-7 px-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[11px] font-semibold text-blue-800 dark:text-blue-300 transition-colors cursor-pointer"
              >
                +1 Year
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(24)}
                className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                +2 Years
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(60)}
                className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                +5 Years
              </button>
            </div>

            <input
              id="new-expiry-date"
              type="date"
              required
              value={newExpiryDate}
              onChange={(e) => {
                setNewExpiryDate(e.target.value);
                setError(null);
              }}
              disabled={submitting}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
            {newExpiryDate && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Extended to: {formatDisplayDate(newExpiryDate)}
              </p>
            )}
          </div>

          {/* Optional Renewal Notes */}
          <div>
            <label
              htmlFor="renewal-notes"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Renewal Filing Notes (Optional)
            </label>
            <textarea
              id="renewal-notes"
              rows={2}
              maxLength={200}
              placeholder="e.g. Renewed online via portal; payment receipt #REC-98214"
              value={renewalNotes}
              onChange={(e) => setRenewalNotes(e.target.value)}
              disabled={submitting}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 resize-none"
            />
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 text-right">
              {renewalNotes.length}/200 characters
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Renewal...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Renewal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
