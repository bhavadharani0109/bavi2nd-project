import { DocumentRecord, EnrichedDocument, RenewalRecord } from '../types/document';
import { parseIsoDateLocal } from './expiry';

const RENEWALS_TAG_REGEX = /<!--DOCUPING_RENEWALS:([\s\S]*?)-->/;

/**
 * Parses user notes and extracts any embedded renewal history records.
 * Leaves clean, human-readable notes intact.
 */
export function parseRenewalHistory(rawNotes: string = ''): {
  cleanNotes: string;
  renewals: RenewalRecord[];
} {
  if (!rawNotes || typeof rawNotes !== 'string') {
    return { cleanNotes: '', renewals: [] };
  }

  const match = rawNotes.match(RENEWALS_TAG_REGEX);
  if (!match) {
    return { cleanNotes: rawNotes.trim(), renewals: [] };
  }

  const cleanNotes = rawNotes.replace(RENEWALS_TAG_REGEX, '').trim();
  let renewals: RenewalRecord[] = [];

  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      renewals = parsed
        .filter((r) => r && typeof r.newExpiryDate === 'string')
        .map((r) => ({
          id: String(r.id || `ren_${Date.now()}`),
          renewalDate: String(r.renewalDate || ''),
          previousExpiryDate: String(r.previousExpiryDate || ''),
          newExpiryDate: String(r.newExpiryDate || ''),
          notes: r.notes ? String(r.notes).slice(0, 200) : '',
          createdAt: r.createdAt || new Date().toISOString(),
        }));

      // Sort in chronological order per Requirement 5
      renewals.sort((a, b) => {
        const dateDiff = a.renewalDate.localeCompare(b.renewalDate);
        if (dateDiff !== 0) return dateDiff;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
    }
  } catch {
    renewals = [];
  }

  return { cleanNotes, renewals };
}

/**
 * Combines freeform user notes with a compact, serialized renewal history block.
 * Keeps total character count strictly <= 1,000 characters to comply with Firestore security rules.
 */
export function serializeRenewalHistory(
  cleanNotes: string = '',
  renewals: RenewalRecord[] = []
): string {
  const trimmedNotes = cleanNotes.trim();
  if (renewals.length === 0) {
    return trimmedNotes.slice(0, 1000);
  }

  // Compact renewals for storage efficiency
  const compacted = renewals.map((r) => ({
    id: r.id,
    renewalDate: r.renewalDate,
    previousExpiryDate: r.previousExpiryDate,
    newExpiryDate: r.newExpiryDate,
    ...(r.notes ? { notes: r.notes.slice(0, 150) } : {}),
    createdAt: r.createdAt,
  }));

  const jsonTag = `<!--DOCUPING_RENEWALS:${JSON.stringify(compacted)}-->`;
  const availableForNotes = Math.max(0, 1000 - jsonTag.length - 1);
  const truncatedNotes = trimmedNotes.slice(0, availableForNotes).trim();

  if (!truncatedNotes) {
    return jsonTag;
  }

  return `${truncatedNotes}\n${jsonTag}`;
}

/**
 * Calculates a new expiry date by adding months to an existing ISO date string.
 * Supports quick presets: +6 months, +1 year (12m), +2 years (24m), +3 years (36m), +5 years (60m).
 */
export function calculateQuickExtensionDate(
  baseDateIso: string,
  monthsToAdd: number
): string {
  const parsed = parseIsoDateLocal(baseDateIso);
  if (Number.isNaN(parsed.getTime())) {
    const today = new Date();
    today.setMonth(today.getMonth() + monthsToAdd);
    return today.toISOString().slice(0, 10);
  }

  const result = new Date(parsed.getTime());
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + monthsToAdd);

  // Handle month boundary clamping (e.g. Jan 31 + 1 month -> Feb 28)
  if (result.getDate() < originalDay) {
    result.setDate(0);
  }

  const yyyy = result.getFullYear();
  const mm = String(result.getMonth() + 1).padStart(2, '0');
  const dd = String(result.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generates a validated renewal record object.
 */
export function createRenewalRecord(params: {
  previousExpiryDate: string;
  newExpiryDate: string;
  renewalDate: string;
  renewalNotes?: string;
}): RenewalRecord {
  return {
    id: `ren_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    renewalDate: params.renewalDate.trim(),
    previousExpiryDate: params.previousExpiryDate.trim(),
    newExpiryDate: params.newExpiryDate.trim(),
    notes: params.renewalNotes ? params.renewalNotes.trim().slice(0, 200) : '',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Prepares the updated document payload when a renewal is recorded:
 * 1. Appends the new renewal to the renewal history.
 * 2. Serializes renewal history into doc notes.
 * 3. Returns the new expiry date and updated notes string ready for Cloud Firestore update.
 */
export function recordDocumentRenewal(
  currentDoc: DocumentRecord | EnrichedDocument,
  newExpiryDate: string,
  renewalDate: string,
  renewalNotes?: string
): {
  newExpiryDate: string;
  updatedNotes: string;
  newRenewal: RenewalRecord;
  allRenewals: RenewalRecord[];
} {
  const { cleanNotes, renewals } = parseRenewalHistory(currentDoc.notes);
  const newRenewal = createRenewalRecord({
    previousExpiryDate: currentDoc.expiryDate,
    newExpiryDate,
    renewalDate,
    renewalNotes,
  });

  const updatedRenewals = [...renewals, newRenewal];
  // Sort in chronological order
  updatedRenewals.sort((a, b) => {
    const dateDiff = a.renewalDate.localeCompare(b.renewalDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  const updatedNotes = serializeRenewalHistory(cleanNotes, updatedRenewals);

  return {
    newExpiryDate,
    updatedNotes,
    newRenewal,
    allRenewals: updatedRenewals,
  };
}
