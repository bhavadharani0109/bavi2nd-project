import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { EnrichedDocument } from '../types/document';
import { formatDisplayDate } from '../utils/expiry';

interface DeleteConfirmModalProps {
  document: EnrichedDocument | null;
  onClose: () => void;
  onConfirm: (doc: EnrichedDocument) => Promise<void>;
}

export function DeleteConfirmModal({
  document: doc,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteInFlightRef = React.useRef(false);

  useEffect(() => {
    setDeleting(false);
    setError(null);
    deleteInFlightRef.current = false;
  }, [doc?.id]);

  useEffect(() => {
    if (!doc) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteInFlightRef.current) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [doc, onClose]);

  if (!doc) return null;

  const handleDelete = async () => {
    if (deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setError(null);
    setDeleting(true);
    try {
      await onConfirm(doc);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete document.'
      );
    } finally {
      setDeleting(false);
      deleteInFlightRef.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0" />
            <h2
              id="delete-modal-title"
              className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Delete Document Permanently
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            aria-label="Cancel deletion"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{doc.name}</span>?
            This will permanently remove the document record from Cloud
            Firestore.
          </p>

          <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <span>{doc.category}</span>
            <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
              Expires {formatDisplayDate(doc.expiryDate)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{deleting ? 'Deleting...' : 'Delete Permanently'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
