import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase/firestore';
import { DocumentCategory, DocumentRecord } from '../types/document';
import {
  extractSearchTokens,
  filterAndSortDocuments,
  matchesDocumentFilters,
  matchesDocumentSearch,
} from './documentFilter';
import { enrichDocument } from './expiry';

function makeDoc(
  id: string,
  name: string,
  category: DocumentCategory,
  expiryDate: string,
  notes = '',
  fileUrl = '',
  fileType: '' | 'application/pdf' = '',
  updatedMillis = 1000
) {
  const record: DocumentRecord = {
    id,
    ownerId: 'user-1',
    name,
    category,
    issueDate: '2024-01-01',
    expiryDate,
    reminderDaysBefore: 30,
    status: 'Active',
    fileName: fileType ? `${name.toLowerCase().replace(/\s+/g, '_')}.pdf` : '',
    fileType,
    fileSize: fileType ? 2048 : 0,
    storagePath: '',
    fileUrl,
    notes,
    reminderDismissed: false,
    createdAt: Timestamp.fromMillis(1000),
    updatedAt: Timestamp.fromMillis(updatedMillis),
  };
  // Reference date: Nov 07, 2026
  return enrichDocument(record, new Date(2026, 10, 7));
}

test('extractSearchTokens trims, lowercases, and splits by spaces', () => {
  assert.deepEqual(extractSearchTokens('  Passport   2026  '), [
    'passport',
    '2026',
  ]);
  assert.deepEqual(extractSearchTokens(''), []);
  assert.deepEqual(extractSearchTokens('   '), []);
});

test('matchesDocumentSearch matches document name and other metadata', () => {
  const doc = makeDoc('1', 'US Passport', 'Identity & Travel', '2030-01-01', 'Renew early');

  // Name search
  assert.equal(matchesDocumentSearch(doc, ['passport']), true);
  assert.equal(matchesDocumentSearch(doc, ['us', 'passport']), true);
  assert.equal(matchesDocumentSearch(doc, ['pass']), true);
  // Case insensitive
  assert.equal(matchesDocumentSearch(doc, ['PASSPORT']), true);
  // Notes search
  assert.equal(matchesDocumentSearch(doc, ['renew']), true);
  // Non-matching
  assert.equal(matchesDocumentSearch(doc, ['insurance']), false);
});

test('matchesDocumentFilters respects status, category and format filters', () => {
  // Nov 07, 2026 reference date
  // 2028-01-01 -> Active (>30 days)
  const activeDoc = makeDoc('1', 'Passport', 'Identity & Travel', '2028-01-01');
  // 2026-11-20 -> Expiring Soon (13 days)
  const soonDoc = makeDoc('2', 'Car Insurance', 'Insurance', '2026-11-20');
  // 2026-10-01 -> Expired (-37 days)
  const expiredDoc = makeDoc('3', 'Old Contract', 'Contracts & Legal', '2026-10-01');

  // Status checks
  assert.equal(
    matchesDocumentFilters(activeDoc, { statusFilter: 'Active', categoryFilter: 'All' }),
    true
  );
  assert.equal(
    matchesDocumentFilters(soonDoc, { statusFilter: 'Active', categoryFilter: 'All' }),
    false
  );
  assert.equal(
    matchesDocumentFilters(soonDoc, { statusFilter: 'Expiring Soon', categoryFilter: 'All' }),
    true
  );
  assert.equal(
    matchesDocumentFilters(expiredDoc, { statusFilter: 'Expired', categoryFilter: 'All' }),
    true
  );

  // Category checks
  assert.equal(
    matchesDocumentFilters(activeDoc, { statusFilter: 'All', categoryFilter: 'Identity & Travel' }),
    true
  );
  assert.equal(
    matchesDocumentFilters(activeDoc, { statusFilter: 'All', categoryFilter: 'Insurance' }),
    false
  );
});

test('filterAndSortDocuments combines search and filters together seamlessly', () => {
  const docs = [
    makeDoc('1', 'US Passport', 'Identity & Travel', '2028-01-01'), // Active, Identity & Travel
    makeDoc('2', 'State Farm Car Insurance', 'Insurance', '2026-11-20'), // Expiring Soon, Insurance
    makeDoc('3', 'Home Insurance Policy', 'Insurance', '2028-06-01'), // Active, Insurance
    makeDoc('4', 'Driver License', 'Licenses & Permits', '2026-10-15'), // Expired, Licenses & Permits
  ];

  // 1. Search by name alone
  const nameSearch = filterAndSortDocuments(docs, { searchQuery: 'Insurance' });
  assert.equal(nameSearch.length, 2);
  assert.deepEqual(
    nameSearch.map((d) => d.id),
    ['2', '3'] // Sorted by expiry soonest first
  );

  // 2. Filter by status alone
  const activeOnly = filterAndSortDocuments(docs, { statusFilter: 'Active' });
  assert.equal(activeOnly.length, 2);
  assert.deepEqual(
    activeOnly.map((d) => d.id),
    ['1', '3']
  );

  // 3. Filter by category alone
  const insuranceOnly = filterAndSortDocuments(docs, { categoryFilter: 'Insurance' });
  assert.equal(insuranceOnly.length, 2);

  // 4. Combined: Search "Insurance" + Status "Active" + Category "Insurance"
  const combined = filterAndSortDocuments(docs, {
    searchQuery: 'Home',
    statusFilter: 'Active',
    categoryFilter: 'Insurance',
  });
  assert.equal(combined.length, 1);
  assert.equal(combined[0].id, '3');

  // 5. No match returns empty array for friendly empty state
  const noMatch = filterAndSortDocuments(docs, {
    searchQuery: 'nonexistent document',
  });
  assert.equal(noMatch.length, 0);

  // 6. Conflicting filter returns empty array
  const conflict = filterAndSortDocuments(docs, {
    searchQuery: 'Passport',
    categoryFilter: 'Insurance',
  });
  assert.equal(conflict.length, 0);
});
