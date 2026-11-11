import React, { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Download,
  ExternalLink,
  FileCheck2,
  FileImage,
  FileText,
  History,
  Link2,
  Pencil,
  RotateCcw,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  AlertCircle,
} from 'lucide-react';
import { EnrichedDocument } from '../types/document';
import {
  formatCountdownLabel,
  formatDisplayDate,
  formatFileSize,
  getShortFormatLabel,
} from '../utils/expiry';
import {
  getDocumentPreviewInfo,
  DocumentPreviewInfo,
} from '../utils/documentPreview';
import { parseRenewalHistory } from '../utils/renewalHistory';
import { StatusIndicator } from './StatusIndicator';

interface DocumentPreviewModalProps {
  document: EnrichedDocument | null;
  onClose: () => void;
  onEdit: (doc: EnrichedDocument) => void;
  onDelete: (doc: EnrichedDocument) => void;
  onRecordRenewal?: (doc: EnrichedDocument) => void;
}

export function DocumentPreviewModal({
  document: doc,
  onClose,
  onEdit,
  onDelete,
  onRecordRenewal,
}: DocumentPreviewModalProps) {
  const [zoomed, setZoomed] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setZoomed(false);
    setPreviewError(false);
  }, [doc?.id, doc?.fileUrl]);

  useEffect(() => {
    if (!doc) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [doc, onClose]);

  if (!doc) return null;

  const previewInfo: DocumentPreviewInfo = getDocumentPreviewInfo({
    fileUrl: doc.fileUrl,
    fileType: doc.fileType,
    fileName: doc.fileName,
  });

  const isPdf = previewInfo.formatType === 'pdf';
  const isImage = previewInfo.formatType === 'image';
  const isExternalLinkOnly = previewInfo.formatType === 'external-link';
  const hasNoLink = previewInfo.formatType === 'none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-[2px] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                id="preview-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                {doc.name}
              </h2>
              <StatusIndicator status={doc.computedStatus} />
              {previewInfo.formatBadge !== 'NONE' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold uppercase tracking-wider">
                  {previewInfo.formatBadge}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">{doc.category}</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="font-mono tabular-nums">
                {doc.fileType
                  ? `${getShortFormatLabel(doc.fileType)} (${formatFileSize(doc.fileSize)})`
                  : doc.fileUrl
                  ? 'External Link'
                  : 'Firestore Metadata'}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  doc.computedStatus === 'Expired'
                    ? 'text-red-700 dark:text-red-400'
                    : doc.computedStatus === 'Expiring Soon'
                    ? 'text-amber-800 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {formatCountdownLabel(doc.daysRemaining)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {previewInfo.directDownloadUrl && (
              <a
                href={previewInfo.directDownloadUrl}
                download={doc.fileName || doc.name}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                title="Download or open original document"
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            {previewInfo.previewUrl && (
              <a
                href={previewInfo.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                title="Open external document in secure new tab"
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span className="hidden sm:inline">Open in Tab</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview modal"
              title="Close (Esc)"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata Details Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 shrink-0">
          <div className="px-5 py-2.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Issue Date
            </p>
            <p className="mt-0.5 font-mono text-xs font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {formatDisplayDate(doc.issueDate)}
            </p>
          </div>
          <div className="px-5 py-2.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Expiry Date
            </p>
            <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatDisplayDate(doc.expiryDate)}
            </p>
          </div>
          <div className="px-5 py-2.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Reminder Lead
            </p>
            <p className="mt-0.5 font-mono text-xs font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {doc.reminderDaysBefore} days before expiry
            </p>
          </div>
          <div className="px-5 py-2.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Document Source
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
              {doc.fileUrl ? 'External Link' : 'Firestore Metadata'}
            </p>
          </div>
        </div>

        {/* Renewal Notes & Renewal History Section */}
        {(() => {
          const { cleanNotes, renewals } = parseRenewalHistory(doc.notes);
          return (
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 divide-y divide-slate-100 dark:divide-slate-800">
              {/* User Notes */}
              {cleanNotes && (
                <div className="px-6 py-2.5">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Filing Notes
                  </p>
                  <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap max-h-20 overflow-y-auto">
                    {cleanNotes}
                  </p>
                </div>
              )}

              {/* Renewal History Timeline Section */}
              <div className="px-6 py-3 bg-slate-50/60 dark:bg-slate-850/60">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Renewal History
                    </span>
                    <span className="font-mono text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {renewals.length}{' '}
                      {renewals.length === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                  {onRecordRenewal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onRecordRenewal(doc);
                      }}
                      className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Record Renewal</span>
                    </button>
                  )}
                </div>

                {renewals.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    No previous renewals recorded yet. Click &ldquo;Record
                    Renewal&rdquo; to extend this document&rsquo;s expiry date
                    and track its renewal history.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {renewals.map((ren, idx) => (
                      <div
                        key={ren.id || idx}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                Renewed on {formatDisplayDate(ren.renewalDate)}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                {formatDisplayDate(ren.previousExpiryDate)} →{' '}
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {formatDisplayDate(ren.newExpiryDate)}
                                </strong>
                              </span>
                            </div>
                            {ren.notes && (
                              <p className="mt-0.5 text-slate-600 dark:text-slate-400 italic">
                                &ldquo;{ren.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-medium whitespace-nowrap pl-7 sm:pl-0">
                          Extended
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Scrollable Document Visual Preview Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/70">
          {isImage && previewInfo.previewUrl && !previewError && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Image Preview (JPG / PNG)
              </span>
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {zoomed ? (
                  <>
                    <ZoomOut className="w-3.5 h-3.5" />
                    <span>Fit to Window</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Inspect Full Resolution</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Condition 1: No external document link attached */}
          {hasNoLink ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center text-center max-w-md mx-auto my-6">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center mb-3">
                <FileCheck2 className="w-6 h-6 text-blue-700 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Tracked as Metadata Record
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This document is safely tracked in your personal Cloud Firestore
                vault. No external file link has been attached to this record yet.
              </p>
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                You can link a Google Drive, OneDrive, or document URL by
                clicking <span className="font-semibold text-slate-600 dark:text-slate-300">Edit / Renew</span> below.
              </p>
            </div>
          ) : previewError ? (
            /* Condition 2: Embed / CORS / Load error */
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-8 flex flex-col items-center justify-center text-center max-w-lg mx-auto my-6">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Direct Inline Preview Unavailable
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                The external document server does not allow embedding this file
                inside a web application frame due to cross-origin security
                policies (such as <code className="text-amber-900 dark:text-amber-300 font-mono text-[11px]">X-Frame-Options</code> or authentication requirements).
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Your file is secure. You can open or download it directly using the
                button below.
              </p>
              <a
                href={previewInfo.previewUrl || doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="mt-4 h-9 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Document in Secure New Tab</span>
              </a>
            </div>
          ) : isExternalLinkOnly ? (
            /* Condition 3: External non-direct PDF/image link (e.g. portal, Google Docs, intranet) */
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center text-center max-w-lg mx-auto my-6">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center mb-3">
                <Link2 className="w-6 h-6 text-blue-700 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                External Document Link Attached
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                This document points to an external link rather than a direct PDF,
                JPG, or PNG file.
              </p>
              <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-md font-mono text-xs text-slate-700 dark:text-slate-300 break-all select-all">
                {doc.fileUrl}
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="mt-4 h-9 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open External Link in New Tab</span>
              </a>
            </div>
          ) : isPdf ? (
            /* Condition 4: Supported PDF preview */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>PDF Document Preview</span>
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                  Client-side embedded viewer
                </span>
              </div>
              <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                <iframe
                  src={previewInfo.previewUrl}
                  title={`Preview of ${doc.name}`}
                  onError={() => setPreviewError(true)}
                  className="w-full h-[520px] bg-slate-50 dark:bg-slate-900 border-0"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center pt-1">
                If the PDF does not render inside the frame, click{' '}
                <a
                  href={previewInfo.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="text-blue-700 dark:text-blue-400 underline font-medium hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Open in Tab
                </a>{' '}
                above to view it in full screen.
              </p>
            </div>
          ) : (
            /* Condition 5: Supported JPG or PNG image preview */
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-center min-h-[360px] shadow-xs overflow-auto">
              <img
                src={previewInfo.previewUrl}
                alt={doc.name}
                referrerPolicy="no-referrer"
                onError={() => setPreviewError(true)}
                className={
                  zoomed
                    ? 'max-w-none h-auto rounded shadow-sm'
                    : 'max-h-[500px] w-auto max-w-full object-contain rounded shadow-sm'
                }
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete(doc);
            }}
            className="h-9 px-3.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-medium text-red-700 dark:text-red-400 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Document</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer transition-colors shadow-xs"
            >
              Close
            </button>
            {onRecordRenewal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRecordRenewal(doc);
                }}
                className="h-9 px-3.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-xs font-semibold text-blue-700 dark:text-blue-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors shadow-xs"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Record Renewal</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(doc);
              }}
              className="h-9 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
