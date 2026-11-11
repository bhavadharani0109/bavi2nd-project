import {
  EnrichedDocument,
  FormatFilter,
  SortField,
  StatusFilter,
} from '../types/document';
import { getShortFormatLabel } from './expiry';

export interface DocumentFilterOptions {
  searchQuery?: string;
  statusFilter?: StatusFilter;
  categoryFilter?: string;
  formatFilter?: FormatFilter;
  sortField?: SortField;
}

/**
 * Normalizes search text by trimming, lowercasing, and splitting into individual keywords.
 */
export function extractSearchTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Checks if an enriched document matches a set of search tokens.
 * Matches document name prominently, as well as category, notes, and file information.
 */
export function matchesDocumentSearch(
  doc: EnrichedDocument,
  tokens: string[]
): boolean {
  if (tokens.length === 0) return true;

  const docName = doc.name.toLowerCase();
  const docCategory = doc.category.toLowerCase();
  const docNotes = doc.notes.toLowerCase();
  const docFileName = doc.fileName.toLowerCase();
  const docFileUrl = doc.fileUrl.toLowerCase();

  // Every token must match at least one field of the document
  return tokens.every((token) => {
    const term = token.toLowerCase();
    return (
      docName.includes(term) ||
      docCategory.includes(term) ||
      docNotes.includes(term) ||
      docFileName.includes(term) ||
      docFileUrl.includes(term)
    );
  });
}

/**
 * Checks if a document matches the given status, category, and format filter criteria.
 */
export function matchesDocumentFilters(
  doc: EnrichedDocument,
  options: Pick<
    DocumentFilterOptions,
    'statusFilter' | 'categoryFilter' | 'formatFilter'
  >
): boolean {
  const { statusFilter = 'All', categoryFilter = 'All', formatFilter = 'All' } =
    options;

  // Status Filter
  if (statusFilter !== 'All' && doc.computedStatus !== statusFilter) {
    return false;
  }

  // Category Filter
  if (categoryFilter !== 'All' && doc.category !== categoryFilter) {
    return false;
  }

  // Record/Format Filter
  if (formatFilter !== 'All') {
    if (
      formatFilter === 'Metadata' &&
      (doc.fileType !== '' || doc.fileUrl !== '')
    ) {
      return false;
    }
    if (formatFilter === 'Link' && (doc.fileType !== '' || !doc.fileUrl)) {
      return false;
    }
    if (
      (formatFilter === 'PDF' ||
        formatFilter === 'JPG' ||
        formatFilter === 'PNG') &&
      getShortFormatLabel(doc.fileType) !== formatFilter
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Sorts documents based on the specified sort criterion.
 */
export function sortDocuments(
  docs: EnrichedDocument[],
  sortField: SortField = 'expiryAsc'
): EnrichedDocument[] {
  const sorted = [...docs];

  sorted.sort((a, b) => {
    if (sortField === 'expiryAsc') {
      return (
        a.expiryDate.localeCompare(b.expiryDate) ||
        a.name.localeCompare(b.name)
      );
    }
    if (sortField === 'expiryDesc') {
      return (
        b.expiryDate.localeCompare(a.expiryDate) ||
        a.name.localeCompare(b.name)
      );
    }
    if (sortField === 'nameAsc') {
      return (
        a.name.localeCompare(b.name) ||
        a.expiryDate.localeCompare(b.expiryDate)
      );
    }
    // recentDesc: newest updated/created first
    const aTime =
      a.updatedAt?.toMillis() ??
      a.createdAt?.toMillis() ??
      Number.MAX_SAFE_INTEGER;
    const bTime =
      b.updatedAt?.toMillis() ??
      b.createdAt?.toMillis() ??
      Number.MAX_SAFE_INTEGER;
    return bTime - aTime || a.name.localeCompare(b.name);
  });

  return sorted;
}

/**
 * Filters and sorts documents simultaneously with instant reactivity.
 * Search, status, and category work together seamlessly.
 */
export function filterAndSortDocuments(
  documents: EnrichedDocument[],
  options: DocumentFilterOptions
): EnrichedDocument[] {
  const {
    searchQuery = '',
    statusFilter = 'All',
    categoryFilter = 'All',
    formatFilter = 'All',
    sortField = 'expiryAsc',
  } = options;

  const tokens = extractSearchTokens(searchQuery);

  const matched = documents.filter((doc) => {
    if (!matchesDocumentFilters(doc, { statusFilter, categoryFilter, formatFilter })) {
      return false;
    }
    if (!matchesDocumentSearch(doc, tokens)) {
      return false;
    }
    return true;
  });

  return sortDocuments(matched, sortField);
}
