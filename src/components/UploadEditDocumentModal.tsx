import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  FileImage,
  FileText,
  Link2,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  DocumentFormData,
  EnrichedDocument,
} from '../types/document';
import {
  calculateDaysRemaining,
  calculateExpiryStatus,
  formatCountdownLabel,
  formatFileSize,
  getShortFormatLabel,
  getTodayIsoLocal,
  parseIsoDateLocal,
  validateDocumentForm,
} from '../utils/expiry';
import { StatusIndicator } from './StatusIndicator';

interface UploadEditDocumentModalProps {
  isOpen: boolean;
  editingDocument: EnrichedDocument | null;
  defaultReminderDays: number;
  onClose: () => void;
  onSubmit: (form: DocumentFormData) => Promise<void>;
}

export function UploadEditDocumentModal({
  isOpen,
  editingDocument,
  defaultReminderDays,
  onClose,
  onSubmit,
}: UploadEditDocumentModalProps) {
  const isEditMode = Boolean(editingDocument);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Identity & Travel');
  const [issueDate, setIssueDate] = useState(getTodayIsoLocal());
  const [expiryDate, setExpiryDate] = useState('');
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(
    defaultReminderDays || 30
  );
  const [fileUrl, setFileUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const wasOpenRef = useRef(false);
  const lastEditIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      lastEditIdRef.current = null;
      return;
    }

    const currentEditId = editingDocument?.id ?? null;
    const shouldInitialize =
      !wasOpenRef.current || lastEditIdRef.current !== currentEditId;

    if (!shouldInitialize) return;

    wasOpenRef.current = true;
    lastEditIdRef.current = currentEditId;
    submitInFlightRef.current = false;
    setFieldErrors({});
    setSubmitError(null);
    setSubmitting(false);

    if (editingDocument) {
      setName(editingDocument.name);
      setCategory(editingDocument.category);
      setIssueDate(editingDocument.issueDate);
      setExpiryDate(editingDocument.expiryDate);
      setReminderDaysBefore(editingDocument.reminderDaysBefore);
      setFileUrl(editingDocument.fileUrl || '');
      setNotes(editingDocument.notes || '');
    } else {
      const today = getTodayIsoLocal();
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setName('');
      setCategory('Identity & Travel');
      setIssueDate(today);
      setExpiryDate(getTodayIsoLocal(nextYear));
      setReminderDaysBefore(defaultReminderDays || 30);
      setFileUrl('');
      setNotes('');
    }
  }, [isOpen, editingDocument, defaultReminderDays]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitInFlightRef.current) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    setSubmitError(null);

    const formPayload: DocumentFormData = {
      name,
      category,
      issueDate,
      expiryDate,
      reminderDaysBefore: Number(reminderDaysBefore),
      fileUrl,
      notes,
    };

    const errors = validateDocumentForm(formPayload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    submitInFlightRef.current = true;
    setFieldErrors({});
    setSubmitting(true);

    try {
      await onSubmit(formPayload);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to save document.'
      );
    } finally {
      setSubmitting(false);
      submitInFlightRef.current = false;
    }
  };

  const previewIssueValid = !Number.isNaN(
    parseIsoDateLocal(issueDate).getTime()
  );
  const previewExpiryValid = !Number.isNaN(
    parseIsoDateLocal(expiryDate).getTime()
  );
  const previewDateInverted =
    previewIssueValid && previewExpiryValid && issueDate > expiryDate;
  const previewStatus =
    previewExpiryValid && !previewDateInverted
      ? calculateExpiryStatus(expiryDate)
      : null;
  const previewDays =
    previewExpiryValid && !previewDateInverted
      ? calculateDaysRemaining(expiryDate)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-[1px] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2
              id="doc-modal-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              {isEditMode ? 'Edit Document Details' : 'Add New Document'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isEditMode
                ? 'Update expiry dates, notes, or external document link.'
                : 'Save document metadata in Cloud Firestore for automatic expiry tracking.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
          {submitError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs leading-relaxed flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Document Name & Category */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="doc-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Document Name{' '}
                <span className="text-red-600 dark:text-red-400" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="doc-name"
                type="text"
                required
                maxLength={140}
                placeholder="e.g., US Passport, Auto Insurance Policy"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: '' }));
                  }
                }}
                disabled={submitting}
                className={`w-full h-10 px-3.5 rounded-lg border bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                  fieldErrors.name
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-300 dark:border-slate-700 focus:border-blue-600'
                }`}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="doc-category"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Category{' '}
                <span className="text-red-600 dark:text-red-400" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="doc-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as DocumentCategory);
                  if (fieldErrors.category) {
                    setFieldErrors((prev) => ({ ...prev, category: '' }));
                  }
                }}
                disabled={submitting}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {fieldErrors.category && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.category}
                </p>
              )}
            </div>
          </div>

          {/* Issue Date, Expiry Date, Reminder Rule */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="doc-issue-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Issue Date{' '}
                <span className="text-red-600 dark:text-red-400" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="doc-issue-date"
                type="date"
                required
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  if (fieldErrors.issueDate || fieldErrors.expiryDate) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      issueDate: '',
                      expiryDate: '',
                    }));
                  }
                }}
                disabled={submitting}
                className={`w-full h-10 px-3 rounded-lg border bg-white dark:bg-slate-800 font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                  fieldErrors.issueDate
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-300 dark:border-slate-700 focus:border-blue-600'
                }`}
              />
              {fieldErrors.issueDate && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.issueDate}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="doc-expiry-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Expiry Date{' '}
                <span className="text-red-600 dark:text-red-400" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="doc-expiry-date"
                type="date"
                required
                min={previewIssueValid ? issueDate : undefined}
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  if (fieldErrors.expiryDate) {
                    setFieldErrors((prev) => ({ ...prev, expiryDate: '' }));
                  }
                }}
                disabled={submitting}
                className={`w-full h-10 px-3 rounded-lg border bg-white dark:bg-slate-800 font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                  fieldErrors.expiryDate || previewDateInverted
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-300 dark:border-slate-700 focus:border-blue-600'
                }`}
              />
              {fieldErrors.expiryDate && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.expiryDate}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="doc-reminder-days"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Reminder Trigger
              </label>
              <select
                id="doc-reminder-days"
                value={
                  [7, 15, 30, 45, 60, 90, 180].includes(
                    Number(reminderDaysBefore)
                  )
                    ? String(reminderDaysBefore)
                    : 'custom'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    if (
                      [7, 15, 30, 45, 60, 90, 180].includes(
                        Number(reminderDaysBefore)
                      )
                    ) {
                      setReminderDaysBefore(25);
                    }
                  } else {
                    setReminderDaysBefore(Number(val));
                  }
                  if (fieldErrors.reminderDaysBefore) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      reminderDaysBefore: '',
                    }));
                  }
                }}
                disabled={submitting}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="7">7 days before expiry (1 week)</option>
                <option value="15">15 days before expiry (2 weeks)</option>
                <option value="30">
                  30 days before expiry (1 month - Default)
                </option>
                <option value="45">45 days before expiry (1.5 months)</option>
                <option value="60">60 days before expiry (2 months)</option>
                <option value="90">90 days before expiry (3 months)</option>
                <option value="180">180 days before expiry (6 months)</option>
                <option value="custom">Custom lead days...</option>
              </select>
              {![7, 15, 30, 45, 60, 90, 180].includes(
                Number(reminderDaysBefore)
              ) && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={reminderDaysBefore}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      setReminderDaysBefore(
                        Number.isNaN(num) ? 1 : Math.max(1, Math.min(365, num))
                      );
                    }}
                    aria-label="Custom reminder lead days"
                    className="w-24 h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    days lead (1–365)
                  </span>
                </div>
              )}
              {fieldErrors.reminderDaysBefore && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.reminderDaysBefore}
                </p>
              )}
            </div>
          </div>

          {/* Automatic Status Calculation Preview or Chronological Date Warning */}
          {previewDateInverted ? (
            <div
              role="alert"
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>
                Expiry date must be on or after the issue date before saving.
              </span>
            </div>
          ) : (
            previewStatus &&
            previewDays !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>Calculated Expiry Status:</span>
                  <StatusIndicator status={previewStatus} />
                </div>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-700 dark:text-slate-300">
                  {formatCountdownLabel(previewDays)}
                </span>
              </div>
            )
          )}

          {/* Optional External File Link & Temporarily Disabled Binary Upload Notice */}
          <div className="space-y-3">
            <div>
              <label
                htmlFor="doc-file-url"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                External Document Link (Optional – PDF, JPG, PNG, Google Drive)
              </label>
              <div className="relative">
                <Link2
                  className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="doc-file-url"
                  type="url"
                  maxLength={2048}
                  placeholder="https://... (direct PDF, JPG, PNG, or Google Drive / Dropbox link)"
                  value={fileUrl}
                  onChange={(e) => {
                    setFileUrl(e.target.value);
                    if (fieldErrors.fileUrl) {
                      setFieldErrors((prev) => ({ ...prev, fileUrl: '' }));
                    }
                  }}
                  disabled={submitting}
                  className={`w-full h-10 pl-10 pr-3.5 rounded-lg border bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                    fieldErrors.fileUrl
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-300 dark:border-slate-700 focus:border-blue-600'
                  }`}
                />
              </div>
              {fieldErrors.fileUrl && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.fileUrl}
                </p>
              )}
            </div>

            <div
              aria-disabled="true"
              className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 px-4 py-3 text-left opacity-80 select-none"
            >
              <div className="flex items-start gap-3">
                <UploadCloud className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Direct file upload temporarily disabled (Spark free plan)
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Firebase Storage uploads are paused to stay on the free Spark
                    plan. All document metadata, expiry calculations, and
                    reminders are stored in Cloud Firestore.
                  </p>
                </div>
              </div>

              {isEditMode && editingDocument && editingDocument.fileName && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  {editingDocument.fileType === 'application/pdf' ? (
                    <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  ) : (
                    <FileImage className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  )}
                  <span className="truncate font-mono text-[11px]">
                    Saved attachment: {editingDocument.fileName} (
                    {getShortFormatLabel(editingDocument.fileType)} ·{' '}
                    {formatFileSize(editingDocument.fileSize)})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="doc-notes"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Renewal Notes or Reference Number (Optional)
              </label>
              <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                {notes.length}/1000
              </span>
            </div>
            <textarea
              id="doc-notes"
              rows={3}
              maxLength={1000}
              placeholder="Policy number, issuing agency URL, or renewal checklist..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (fieldErrors.notes) {
                  setFieldErrors((prev) => ({ ...prev, notes: '' }));
                }
              }}
              disabled={submitting}
              className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 resize-y"
            />
            {fieldErrors.notes && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.notes}</p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {submitting
                  ? 'Saving Document...'
                  : isEditMode
                  ? 'Save Changes'
                  : 'Save Document'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
