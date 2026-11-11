import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRenewalHistory,
  serializeRenewalHistory,
  recordDocumentRenewal,
  calculateQuickExtensionDate,
  createRenewalRecord,
} from './renewalHistory';
import { calculateExpiryStatus, enrichDocument } from './expiry';
import type { DocumentRecord } from '../types/document';

function createMockDoc(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-ren-1',
    ownerId: 'user-primary-123',
    name: 'Auto Insurance Policy',
    category: 'Insurance',
    issueDate: '2025-11-01',
    expiryDate: '2026-11-01',
    reminderDaysBefore: 30,
    status: 'Expired',
    fileName: '',
    fileType: '',
    fileSize: 0,
    storagePath: '',
    fileUrl: '',
    notes: 'Existing policy notes for vehicle coverage',
    reminderDismissed: true,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

test('Requirement 2, 3 & 4: Records renewal with previous expiry, new expiry, renewal date, and notes', () => {
  const doc = createMockDoc({
    expiryDate: '2026-11-01',
    notes: 'Comprehensive plan',
  });

  const result = recordDocumentRenewal(
    doc,
    '2027-11-01', // New expiry date (+1 year)
    '2026-11-08', // Renewal date (today)
    'Renewed online with Geico; policy #POL-88219'
  );

  assert.strictEqual(result.newExpiryDate, '2027-11-01');
  assert.strictEqual(result.allRenewals.length, 1);

  const firstRenewal = result.allRenewals[0];
  assert.strictEqual(firstRenewal.previousExpiryDate, '2026-11-01');
  assert.strictEqual(firstRenewal.newExpiryDate, '2027-11-01');
  assert.strictEqual(firstRenewal.renewalDate, '2026-11-08');
  assert.strictEqual(
    firstRenewal.notes,
    'Renewed online with Geico; policy #POL-88219'
  );

  // Check serialization and parsing roundtrip
  const parsed = parseRenewalHistory(result.updatedNotes);
  assert.strictEqual(parsed.cleanNotes, 'Comprehensive plan');
  assert.strictEqual(parsed.renewals.length, 1);
  assert.strictEqual(parsed.renewals[0].newExpiryDate, '2027-11-01');
});

test('Requirement 5: Displays all previous renewals in chronological order', () => {
  const r1 = createRenewalRecord({
    previousExpiryDate: '2024-11-01',
    newExpiryDate: '2025-11-01',
    renewalDate: '2024-10-25',
    renewalNotes: 'First annual renewal',
  });
  const r2 = createRenewalRecord({
    previousExpiryDate: '2025-11-01',
    newExpiryDate: '2026-11-01',
    renewalDate: '2025-10-28',
    renewalNotes: 'Second annual renewal',
  });
  const r3 = createRenewalRecord({
    previousExpiryDate: '2026-11-01',
    newExpiryDate: '2027-11-01',
    renewalDate: '2026-11-08',
    renewalNotes: 'Third annual renewal',
  });

  // Pass out of order to ensure sorting
  const serialized = serializeRenewalHistory('Standard policy', [r3, r1, r2]);
  const parsed = parseRenewalHistory(serialized);

  assert.strictEqual(parsed.renewals.length, 3);
  assert.strictEqual(parsed.renewals[0].renewalDate, '2024-10-25');
  assert.strictEqual(parsed.renewals[1].renewalDate, '2025-10-28');
  assert.strictEqual(parsed.renewals[2].renewalDate, '2026-11-08');
  assert.strictEqual(parsed.renewals[0].newExpiryDate, '2025-11-01');
  assert.strictEqual(parsed.renewals[2].newExpiryDate, '2027-11-01');
});

test('Requirement 6 & 7: Updates expiry status and remaining days immediately after renewal', () => {
  const refDate = new Date(2026, 10, 8); // Nov 8, 2026
  const expiredDoc = createMockDoc({
    expiryDate: '2026-11-01', // Expired 7 days ago relative to Nov 8, 2026
  });

  const beforeEnriched = enrichDocument(expiredDoc, refDate);
  assert.strictEqual(beforeEnriched.computedStatus, 'Expired');
  assert.strictEqual(beforeEnriched.daysRemaining, -7);

  // Record a renewal extending expiry by 1 year to 2027-11-01
  const renewalResult = recordDocumentRenewal(
    expiredDoc,
    '2027-11-01',
    '2026-11-08',
    'Payment processed'
  );

  const updatedDocRecord: DocumentRecord = {
    ...expiredDoc,
    expiryDate: renewalResult.newExpiryDate,
    notes: renewalResult.updatedNotes,
    status: calculateExpiryStatus(renewalResult.newExpiryDate, refDate),
  };

  const afterEnriched = enrichDocument(updatedDocRecord, refDate);
  assert.strictEqual(afterEnriched.expiryDate, '2027-11-01');
  assert.strictEqual(afterEnriched.computedStatus, 'Active');
  assert.ok(afterEnriched.daysRemaining > 300);
  assert.strictEqual(afterEnriched.renewals?.length, 1);
});

test('Quick extension date calculations (+6M, +1Y, +2Y, +5Y)', () => {
  assert.strictEqual(
    calculateQuickExtensionDate('2026-05-15', 6),
    '2026-11-15'
  );
  assert.strictEqual(
    calculateQuickExtensionDate('2026-11-08', 12),
    '2027-11-08'
  );
  assert.strictEqual(
    calculateQuickExtensionDate('2026-11-08', 24),
    '2028-11-08'
  );
  assert.strictEqual(
    calculateQuickExtensionDate('2026-11-08', 60),
    '2031-11-08'
  );
});

test('Requirement 10: Ensures notes length constraint <= 1000 characters is preserved', () => {
  const longNotes = 'A'.repeat(800);
  const r = createRenewalRecord({
    previousExpiryDate: '2026-01-01',
    newExpiryDate: '2027-01-01',
    renewalDate: '2026-01-01',
    renewalNotes: 'Extended',
  });

  const serialized = serializeRenewalHistory(longNotes, [r]);
  assert.ok(
    serialized.length <= 1000,
    `Serialized length ${serialized.length} must be <= 1000`
  );

  const parsed = parseRenewalHistory(serialized);
  assert.strictEqual(parsed.renewals.length, 1);
  assert.strictEqual(parsed.renewals[0].newExpiryDate, '2027-01-01');
});
