import React, { useEffect } from 'react';
import { AlertCircle, Loader2, LogOut, ShieldAlert, X } from 'lucide-react';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  userEmail?: string | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmModal({
  isOpen,
  userEmail,
  loading,
  onClose,
  onConfirm,
}: LogoutConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      aria-describedby="logout-confirm-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="logout-confirm-title"
                className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Sign Out of DocuPing
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                End active session on this device
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cancel and close dialog"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-2 space-y-3">
          <p
            id="logout-confirm-description"
            className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
          >
            Are you sure you want to sign out? You will need to sign back in to
            access your document vault and manage expiration deadlines.
          </p>

          {userEmail && (
            <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Active Account:</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate">
                {userEmail}
              </span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-200 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              All your tracked documents, categories, and renewal records remain
              safely stored in Cloud Firestore.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 mt-2 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Signing out...</span>
              </>
            ) : (
              <>
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
