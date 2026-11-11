import {
  ALLOWED_MIME_TYPES,
  AllowedMimeType,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  DocumentFormData,
  DocumentRecord,
  EnrichedDocument,
  ExpiryStatus,
  MAX_FILE_SIZE_BYTES,
} from '../types/document';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/**
 * Number of days before expiry when a document transitions from Active to Expiring Soon.
 */
export const EXPIRY_WARNING_THRESHOLD_DAYS = 30;

/**
 * Parses a YYYY-MM-DD string into a local calendar midnight Date and rejects invalid calendar dates
 * (such as Feb 30 or month 13).
 */
export function parseIsoDateLocal(isoDate: string): Date {
  if (!ISO_DATE_REGEX.test(isoDate)) {
    return new Date(NaN);
  }
  const [year, month, day] = isoDate.split('-').map(Number);
  const candidate = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return new Date(NaN);
  }
  return candidate;
}

/**
 * Returns today's local date formatted as YYYY-MM-DD.
 */
export function getTodayIsoLocal(referenceDate: Date = new Date()): string {
  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const d = String(referenceDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes exact integer calendar days from today until expiryDate using UTC calendar midnight
 * so Daylight Saving Time transitions never introduce off-by-one errors.
 * Positive = days remaining, 0 = expires today, negative = days overdue.
 */
export function calculateDaysRemaining(
  expiryDateIso: string,
  referenceDate: Date = new Date()
): number {
  const expiry = parseIsoDateLocal(expiryDateIso);
  if (Number.isNaN(expiry.getTime())) {
    return 0;
  }
  const expiryUtc = Date.UTC(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  );
  const todayUtc = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  return Math.round((expiryUtc - todayUtc) / MS_PER_DAY);
}

/**
 * Automatically calculates expiry status from expiryDate:
 * - Active: More than 30 days remaining
 * - Expiring Soon: 1 to 30 days remaining (or 0 days remaining when expiring today)
 * - Expired: Expiry date has passed (< 0 days remaining)
 */
export function calculateExpiryStatus(
  expiryDateIso: string,
  referenceDate: Date = new Date()
): ExpiryStatus {
  const daysRemaining = calculateDaysRemaining(expiryDateIso, referenceDate);
  if (daysRemaining < 0) {
    return 'Expired';
  }
  if (daysRemaining <= EXPIRY_WARNING_THRESHOLD_DAYS) {
    return 'Expiring Soon';
  }
  return 'Active';
}

import { parseRenewalHistory } from './renewalHistory';

/**
 * Enriches raw Firestore DocumentRecord with real-time computed status & days remaining,
 * plus parsed chronological renewal history.
 */
export function enrichDocument(
  doc: DocumentRecord,
  referenceDate: Date = new Date()
): EnrichedDocument {
  const daysRemaining = calculateDaysRemaining(doc.expiryDate, referenceDate);
  const computedStatus = calculateExpiryStatus(doc.expiryDate, referenceDate);
  const { renewals } = parseRenewalHistory(doc.notes);
  return {
    ...doc,
    daysRemaining,
    computedStatus,
    renewals,
  };
}

export interface NotificationSummary {
  allAlerts: EnrichedDocument[];
  unreadAlerts: EnrichedDocument[];
  readAlerts: EnrichedDocument[];
  expiringSoonAlerts: EnrichedDocument[];
  expiredAlerts: EnrichedDocument[];
}

/**
 * Generates a deterministic identifier for a document's active expiry notification state.
 */
export function getNotificationEventKey(
  doc: Pick<EnrichedDocument, 'id' | 'computedStatus' | 'expiryDate'>
): string {
  return `${doc.id}:${doc.computedStatus}:${doc.expiryDate}`;
}

/**
 * Classifies and sorts expiry notifications (Expired and Expiring Soon) by urgency
 * (most overdue / fewest days remaining first), deduplicated by document ID.
 */
export function getExpiryNotifications(
  documents: EnrichedDocument[]
): NotificationSummary {
  const uniqueById = new Map<string, EnrichedDocument>();
  for (const doc of documents) {
    if (
      doc.computedStatus === 'Expired' ||
      doc.computedStatus === 'Expiring Soon'
    ) {
      uniqueById.set(doc.id, doc);
    }
  }

  const allAlerts = Array.from(uniqueById.values()).sort(
    (a, b) =>
      a.daysRemaining - b.daysRemaining ||
      a.expiryDate.localeCompare(b.expiryDate) ||
      a.name.localeCompare(b.name)
  );

  const unreadAlerts = allAlerts.filter((d) => !d.reminderDismissed);
  const readAlerts = allAlerts.filter((d) => d.reminderDismissed);
  const expiringSoonAlerts = allAlerts.filter(
    (d) => d.computedStatus === 'Expiring Soon'
  );
  const expiredAlerts = allAlerts.filter(
    (d) => d.computedStatus === 'Expired'
  );

  return {
    allAlerts,
    unreadAlerts,
    readAlerts,
    expiringSoonAlerts,
    expiredAlerts,
  };
}

/**
 * Human-readable remaining days label for tables, preview modals, and notification cards.
 */
export function formatCountdownLabel(daysRemaining: number): string {
  if (daysRemaining < -1) {
    return `Expired ${Math.abs(daysRemaining)} days ago`;
  }
  if (daysRemaining === -1) {
    return 'Expired 1 day ago';
  }
  if (daysRemaining === 0) {
    return '0 days remaining (Expires today)';
  }
  if (daysRemaining === 1) {
    return '1 day remaining';
  }
  return `${daysRemaining} days remaining`;
}

/**
 * Formats YYYY-MM-DD into a crisp readable date string (e.g., "Nov 06, 2026").
 */
export function formatDisplayDate(isoDate: string): string {
  const parsed = parseIsoDateLocal(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

/**
 * Formats file byte size into KB or MB.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(0)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Returns short format tag from MIME type or empty string.
 */
export function getShortFormatLabel(
  mimeType: AllowedMimeType | ''
): 'PDF' | 'JPG' | 'PNG' | 'Record' {
  switch (mimeType) {
    case 'application/pdf':
      return 'PDF';
    case 'image/jpeg':
      return 'JPG';
    case 'image/png':
      return 'PNG';
    default:
      return 'Record';
  }
}

/**
 * Normalizes and validates an uploaded file for PDF, JPG, or PNG format and <= 10 MB size.
 */
export function validateUploadFile(file: File | null | undefined): {
  valid: boolean;
  resolvedMime?: AllowedMimeType;
  error?: string;
} {
  if (!file) {
    return { valid: false, error: 'Please select a PDF, JPG, or PNG document file.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'The selected file is empty (0 bytes).' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 10 MB maximum limit.`,
    };
  }

  const lowerName = file.name.toLowerCase();
  let resolvedMime: AllowedMimeType | undefined;

  if (ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    resolvedMime = file.type as AllowedMimeType;
  } else if (lowerName.endsWith('.pdf')) {
    resolvedMime = 'application/pdf';
  } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    resolvedMime = 'image/jpeg';
  } else if (lowerName.endsWith('.png')) {
    resolvedMime = 'image/png';
  }

  if (!resolvedMime) {
    return {
      valid: false,
      error: 'Unsupported file format. Only PDF, JPG, and PNG files are allowed.',
    };
  }

  const extValid =
    (resolvedMime === 'application/pdf' && lowerName.endsWith('.pdf')) ||
    (resolvedMime === 'image/jpeg' &&
      (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg'))) ||
    (resolvedMime === 'image/png' && lowerName.endsWith('.png'));

  if (!extValid) {
    return {
      valid: false,
      error: 'File extension does not match its detected PDF, JPG, or PNG format.',
    };
  }

  return { valid: true, resolvedMime };
}

const HTTP_URL_REGEX = /^https?:\/\/.+$/i;

/**
 * Trims an optional external document URL and normalizes its http/https scheme to lowercase
 * so it matches Firestore security rules' case-sensitive '^https?://.+$' check.
 */
export function normalizeDocumentUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/^https?:\/\//i, (scheme) => scheme.toLowerCase())
    .slice(0, 2048);
}

/**
 * Validates document form inputs strictly matching Firestore rules & blueprint schema.
 */
export function validateDocumentForm(
  form: DocumentFormData
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmedName = form.name.trim();

  if (!trimmedName) {
    errors.name = 'Document name is required.';
  } else if (trimmedName.length > 140) {
    errors.name = 'Document name must be 140 characters or fewer.';
  }

  if (!DOCUMENT_CATEGORIES.includes(form.category as DocumentCategory)) {
    errors.category = 'Please choose a valid document category.';
  }

  if (!ISO_DATE_REGEX.test(form.issueDate)) {
    errors.issueDate = 'Enter a valid issue date (YYYY-MM-DD).';
  } else {
    const parsedIssue = parseIsoDateLocal(form.issueDate);
    if (Number.isNaN(parsedIssue.getTime())) {
      errors.issueDate = 'Issue date is invalid.';
    }
  }

  if (!ISO_DATE_REGEX.test(form.expiryDate)) {
    errors.expiryDate = 'Enter a valid expiry date (YYYY-MM-DD).';
  } else {
    const parsedExpiry = parseIsoDateLocal(form.expiryDate);
    if (Number.isNaN(parsedExpiry.getTime())) {
      errors.expiryDate = 'Expiry date is invalid.';
    }
  }

  if (
    !errors.issueDate &&
    !errors.expiryDate &&
    form.issueDate > form.expiryDate
  ) {
    errors.expiryDate = 'Expiry date must be on or after the issue date.';
  }

  const lead = Number(form.reminderDaysBefore);
  if (!Number.isInteger(lead) || lead < 1 || lead > 365) {
    errors.reminderDaysBefore = 'Reminder window must be between 1 and 365 days.';
  }

  const rawTrimmedUrl = form.fileUrl.trim();
  const normalizedUrl = normalizeDocumentUrl(form.fileUrl);
  if (rawTrimmedUrl.length > 2048) {
    errors.fileUrl = 'Document URL must be 2,048 characters or fewer.';
  } else if (normalizedUrl.length > 0 && !HTTP_URL_REGEX.test(normalizedUrl)) {
    errors.fileUrl = 'Document URL must start with https:// or http://.';
  }

  if (form.notes.length > 1000) {
    errors.notes = 'Notes cannot exceed 1,000 characters.';
  }

  return errors;
}

/**
 * Sanitizes a filename for path safety.
 */
export function sanitizeStorageFileName(originalName: string): string {
  const cleaned = originalName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_');
  const truncated = cleaned.slice(-120);
  return truncated || `document_${Date.now()}`;
}

/**
 * Escapes a single CSV cell value per RFC 4180 and neutralizes CSV formula injection.
 */
export function escapeCsvCell(value: string | number): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-4180 compliant CSV string with UTF-8 BOM containing:
 * Document Name, Category, Status, Days Remaining, Issue Date, Expiry Date,
 * Reminder Lead, File details, Notes, and File URL.
 */
export function generateCsvContent(documents: EnrichedDocument[]): string {
  const headers = [
    'Document Name',
    'Category',
    'Status',
    'Days Remaining',
    'Issue Date',
    'Expiry Date',
    'Reminder Lead (Days)',
    'File Name',
    'File Format',
    'File Size (KB)',
    'Notes',
    'File URL',
  ];

  const rows = documents.map((doc) => [
    doc.name,
    doc.category,
    doc.computedStatus,
    doc.daysRemaining,
    doc.issueDate,
    doc.expiryDate,
    doc.reminderDaysBefore,
    doc.fileName || '',
    doc.fileType
      ? getShortFormatLabel(doc.fileType)
      : doc.fileUrl
      ? 'External Link'
      : 'Metadata',
    doc.fileSize > 0 ? Math.max(1, Math.round(doc.fileSize / 1024)) : 0,
    doc.notes || '',
    doc.fileUrl || '',
  ]);

  return (
    '\uFEFF' +
    [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\r\n')
  );
}

/**
 * Generates and downloads an RFC-4180 CSV export of the provided documents directly in the browser.
 * Free in-browser Blob download, zero paid services.
 */
export function exportDocumentsToCsv(
  documents: EnrichedDocument[],
  fileNamePrefix: string = 'docuping-documents'
): void {
  if (documents.length === 0) return;

  const csvContent = generateCsvContent(documents);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = getTodayIsoLocal();
  link.href = url;
  link.setAttribute('download', `${fileNamePrefix}-${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { generatePdfDocument, exportDocumentsToPdf } from './pdfExport';
export type { PdfExportOptions } from './pdfExport';

