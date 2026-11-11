import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase/firestore';
import { DocumentCategory, DocumentRecord } from '../types/document';
import {
  computeApportionedPercentages,
  computeDashboardAnalytics,
  getRecentlyAddedDocuments,
  getUpcomingExpirySchedule,
} from './analytics';
import { enrichDocument } from './expiry';

function makeRecord(
  id: string,
  name: string,
  category: DocumentCategory,
  expiryDate: string,
  createdMillis: number | null = null
): DocumentRecord {
  return {
    id,
    ownerId: 'user-1',
    name,
    category,
    issueDate: '2024-01-01',
    expiryDate,
    reminderDaysBefore: 30,
    status: 'Active',
    fileName: '',
    fileType: '',
    fileSize: 0,
    storagePath: '',
    fileUrl: '',
    notes: '',
    reminderDismissed: false,
    createdAt: createdMillis !== null ? Timestamp.fromMillis(createdMillis) : null,
    updatedAt: createdMillis !== null ? Timestamp.fromMillis(createdMillis) : null,
  };
}

test('computeApportionedPercentages sums to 100% for non-empty sets and 0% for empty sets', () => {
  assert.deepEqual(computeApportionedPercentages([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(computeApportionedPercentages([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(computeApportionedPercentages([3, 1, 0]), [75, 25, 0]);
});

test('computeDashboardAnalytics aggregates totals, status breakdown, and category summary accurately', () => {
  const refDate = new Date(2026, 10, 6); // Nov 6, 2026
  const empty = computeDashboardAnalytics([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.active, 0);
  assert.equal(empty.expiringSoon, 0);
  assert.equal(empty.expired, 0);
  assert.equal(empty.populatedCategories.length, 0);
  assert.equal(empty.allCategories.length, 9);

  const enriched = [
    enrichDocument(
      makeRecord('d1', 'US Passport', 'Identity & Travel', '2028-05-01', 1000), // Active
      refDate
    ),
    enrichDocument(
      makeRecord('d2', 'Global Entry', 'Identity & Travel', '2026-11-20', 2000), // Expiring Soon
      refDate
    ),
    enrichDocument(
      makeRecord('d3', 'Auto Insurance', 'Insurance', '2026-10-15', 3000), // Expired
      refDate
    ),
  ];

  const stats = computeDashboardAnalytics(enriched);
  assert.equal(stats.total, 3);
  assert.equal(stats.active, 1);
  assert.equal(stats.expiringSoon, 1);
  assert.equal(stats.expired, 1);
  assert.deepEqual(
    stats.statusSegments.map((s) => ({ status: s.status, count: s.count })),
    [
      { status: 'Active', count: 1 },
      { status: 'Expiring Soon', count: 1 },
      { status: 'Expired', count: 1 },
    ]
  );

  assert.equal(stats.populatedCategories.length, 2);
  assert.equal(stats.populatedCategories[0].category, 'Identity & Travel');
  assert.equal(stats.populatedCategories[0].total, 2);
  assert.equal(stats.populatedCategories[0].active, 1);
  assert.equal(stats.populatedCategories[0].expiringSoon, 1);
  assert.equal(stats.populatedCategories[0].expired, 0);

  assert.equal(stats.populatedCategories[1].category, 'Insurance');
  assert.equal(stats.populatedCategories[1].total, 1);
  assert.equal(stats.populatedCategories[1].expired, 1);
  assert.equal(stats.maxCategoryCount, 2);
});

test('getUpcomingExpirySchedule and getRecentlyAddedDocuments sort chronologically and pin pending writes', () => {
  const refDate = new Date(2026, 10, 6); // Nov 6, 2026
  const docs = [
    enrichDocument(
      makeRecord('d1', 'Old Lease', 'Contracts & Legal', '2026-10-01', 1000), // Expired (excluded from upcoming schedule)
      refDate
    ),
    enrichDocument(
      makeRecord('d2', 'Health Policy', 'Medical & Health', '2027-06-01', 2000), // Active (>30d)
      refDate
    ),
    enrichDocument(
      makeRecord('d3', 'Business License', 'Licenses & Permits', '2026-11-12', 3000), // Expiring Soon (6d)
      refDate
    ),
    enrichDocument(
      makeRecord('d4', 'Pending Save', 'Tax & Financial', '2026-11-06', null), // Today (0d), pending timestamp
      refDate
    ),
  ];

  const schedule = getUpcomingExpirySchedule(docs, 5);
  assert.deepEqual(
    schedule.map((d) => d.id),
    ['d4', 'd3', 'd2']
  );

  const recent = getRecentlyAddedDocuments(docs, 4);
  assert.deepEqual(
    recent.map((d) => d.id),
    ['d4', 'd3', 'd2', 'd1']
  );
});
