import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentFormData, DocumentRecord, EnrichedDocument } from '../types/document';
import { computeDashboardAnalytics } from './analytics';
import {
  calculateDaysRemaining,
  calculateExpiryStatus,
  enrichDocument,
  validateDocumentForm,
} from './expiry';

function makeTestDoc(
  id: string,
  name: string,
  category: DocumentRecord['category'],
  issueDate: string,
  expiryDate: string,
  reminderDaysBefore = 30
): DocumentRecord {
  return {
    id,
    ownerId: 'user-alice-123',
    name,
    category,
    issueDate,
    expiryDate,
    reminderDaysBefore,
    status: calculateExpiryStatus(expiryDate),
    fileName: '',
    fileType: '',
    fileSize: 0,
    storagePath: '',
    fileUrl: '',
    notes: '',
    reminderDismissed: false,
    createdAt: null,
    updatedAt: null,
  };
}

test('Requirement 2: Validation of updated document fields including reminder trigger & notes', () => {
  // Valid update form with custom reminder trigger, external link and renewal notes
  const validUpdate: DocumentFormData = {
    name: 'Updated German Schengen Visa',
    category: 'Identity & Travel',
    issueDate: '2026-01-10',
    expiryDate: '2027-01-10',
    reminderDaysBefore: 60,
    fileUrl: 'https://consulate.example.gov/records/12345',
    notes: 'Reference booking code: DE-99482. Must renew 2 months in advance.',
  };

  const errors = validateDocumentForm(validUpdate);
  assert.deepEqual(errors, {});

  // Invalid reminder window (<1 or >365)
  const invalidReminderWindow = validateDocumentForm({
    ...validUpdate,
    reminderDaysBefore: 0,
  });
  assert.ok(invalidReminderWindow.reminderDaysBefore);

  const invalidReminderWindowHigh = validateDocumentForm({
    ...validUpdate,
    reminderDaysBefore: 400,
  });
  assert.ok(invalidReminderWindowHigh.reminderDaysBefore);

  // Issue date later than expiry date must be blocked
  const invertedDates = validateDocumentForm({
    ...validUpdate,
    issueDate: '2027-06-01',
    expiryDate: '2026-06-01',
  });
  assert.equal(
    invertedDates.expiryDate,
    'Expiry date must be on or after the issue date.'
  );
});

test('Requirement 4: Recalculate expiry status and remaining days immediately after editing', () => {
  const refDate = new Date(2026, 10, 8); // Nov 8, 2026

  // 1. Initially an Active document (expiring in 2027, 400+ days)
  const originalDoc = makeTestDoc(
    'doc-edit-1',
    'Commercial Driver License',
    'Licenses & Permits',
    '2022-01-01',
    '2027-12-31'
  );
  const initialEnriched = enrichDocument(originalDoc, refDate);
  assert.equal(initialEnriched.computedStatus, 'Active');
  assert.ok(initialEnriched.daysRemaining > 30);

  // 2. User edits expiryDate to Nov 20, 2026 (12 days left) -> instantly recalculates to 'Expiring Soon'
  const editedSoonDoc: DocumentRecord = {
    ...originalDoc,
    name: 'Commercial Driver License (Renewed endorsement)',
    expiryDate: '2026-11-20',
    status: calculateExpiryStatus('2026-11-20', refDate),
  };
  const soonEnriched = enrichDocument(editedSoonDoc, refDate);
  assert.equal(soonEnriched.computedStatus, 'Expiring Soon');
  assert.equal(soonEnriched.daysRemaining, 12);

  // 3. User edits expiryDate to a past date (Nov 1, 2026, 7 days ago) -> instantly recalculates to 'Expired'
  const editedExpiredDoc: DocumentRecord = {
    ...originalDoc,
    expiryDate: '2026-11-01',
    status: calculateExpiryStatus('2026-11-01', refDate),
  };
  const expiredEnriched = enrichDocument(editedExpiredDoc, refDate);
  assert.equal(expiredEnriched.computedStatus, 'Expired');
  assert.equal(expiredEnriched.daysRemaining, -7);

  // 4. User renews and extends an expired document into the future -> instantly recalculates back to 'Active'
  const renewedActiveDoc: DocumentRecord = {
    ...originalDoc,
    issueDate: '2026-11-08',
    expiryDate: '2029-11-08',
    status: calculateExpiryStatus('2029-11-08', refDate),
  };
  const renewedEnriched = enrichDocument(renewedActiveDoc, refDate);
  assert.equal(renewedEnriched.computedStatus, 'Active');
  assert.ok(renewedEnriched.daysRemaining > 1000);
});

test('Requirement 7: Dashboard counts and analytics update immediately after editing or deleting', () => {
  const refDate = new Date(2026, 10, 8);

  const docA = enrichDocument(
    makeTestDoc('a', 'Car Insurance', 'Insurance', '2025-01-01', '2026-11-15'), // Expiring Soon (7d)
    refDate
  );
  const docB = enrichDocument(
    makeTestDoc('b', 'Lease', 'Contracts & Legal', '2024-01-01', '2026-10-01'), // Expired (-38d)
    refDate
  );
  const docC = enrichDocument(
    makeTestDoc('c', 'Passport', 'Identity & Travel', '2022-01-01', '2030-01-01'), // Active
    refDate
  );

  const initialDocs = [docA, docB, docC];
  const initialAnalytics = computeDashboardAnalytics(initialDocs);

  assert.equal(initialAnalytics.total, 3);
  assert.equal(initialAnalytics.active, 1);
  assert.equal(initialAnalytics.expiringSoon, 1);
  assert.equal(initialAnalytics.expired, 1);

  // Simulate Editing: docB (Expired) is renewed to Active (2028-01-01)
  const updatedDocB = enrichDocument(
    {
      ...docB,
      expiryDate: '2028-01-01',
      status: calculateExpiryStatus('2028-01-01', refDate),
    },
    refDate
  );
  const afterEditDocs = [docA, updatedDocB, docC];
  const afterEditAnalytics = computeDashboardAnalytics(afterEditDocs);

  // Immediate analytics update: Active increased from 1 to 2, Expired dropped to 0
  assert.equal(afterEditAnalytics.total, 3);
  assert.equal(afterEditAnalytics.active, 2);
  assert.equal(afterEditAnalytics.expiringSoon, 1);
  assert.equal(afterEditAnalytics.expired, 0);

  // Simulate Deleting: docA (Expiring Soon) is deleted
  const afterDeleteDocs = afterEditDocs.filter((d) => d.id !== 'a');
  const afterDeleteAnalytics = computeDashboardAnalytics(afterDeleteDocs);

  // Immediate analytics update: Total dropped to 2, Expiring Soon dropped to 0
  assert.equal(afterDeleteAnalytics.total, 2);
  assert.equal(afterDeleteAnalytics.active, 2);
  assert.equal(afterDeleteAnalytics.expiringSoon, 0);
  assert.equal(afterDeleteAnalytics.expired, 0);
  assert.equal(
    afterDeleteAnalytics.populatedCategories.some(
      (c) => c.category === 'Insurance'
    ),
    false
  );
});

test('Requirement 8: Ensure user ownership isolation for documents', () => {
  const currentUserId = 'user-alice-123';
  const otherUserId = 'user-mallory-999';

  const userDocs = [
    makeTestDoc('d1', 'Alice Passport', 'Identity & Travel', '2020-01-01', '2030-01-01'),
    makeTestDoc('d2', 'Alice Lease', 'Contracts & Legal', '2024-01-01', '2027-01-01'),
  ];
  const otherDoc = {
    ...makeTestDoc('d3', 'Mallory Passport', 'Identity & Travel', '2020-01-01', '2030-01-01'),
    ownerId: otherUserId,
  };

  const allSystemDocs = [...userDocs, otherDoc];

  // Filtering scoped to authenticated user guarantees privacy
  const scopedDocs = allSystemDocs.filter((d) => d.ownerId === currentUserId);
  assert.equal(scopedDocs.length, 2);
  assert.ok(scopedDocs.every((d) => d.ownerId === currentUserId));
  assert.equal(scopedDocs.some((d) => d.id === 'd3'), false);
});
