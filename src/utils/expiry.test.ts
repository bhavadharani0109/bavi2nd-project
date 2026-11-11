import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentRecord } from '../types/document';
import {
  calculateDaysRemaining,
  calculateExpiryStatus,
  enrichDocument,
  formatCountdownLabel,
  formatDisplayDate,
  getExpiryNotifications,
  getNotificationEventKey,
  getTodayIsoLocal,
  normalizeDocumentUrl,
  parseIsoDateLocal,
  validateDocumentForm,
} from './expiry';

test('parseIsoDateLocal parses valid calendar dates and rejects invalid ones', () => {
  const valid = parseIsoDateLocal('2026-11-06');
  assert.equal(valid.getFullYear(), 2026);
  assert.equal(valid.getMonth(), 10);
  assert.equal(valid.getDate(), 6);

  const leapDay = parseIsoDateLocal('2024-02-29');
  assert.equal(Number.isNaN(leapDay.getTime()), false);

  // Non-leap Feb 29, Feb 31, April 31, and invalid formats must be rejected
  assert.equal(Number.isNaN(parseIsoDateLocal('2026-02-29').getTime()), true);
  assert.equal(Number.isNaN(parseIsoDateLocal('2026-02-31').getTime()), true);
  assert.equal(Number.isNaN(parseIsoDateLocal('2026-04-31').getTime()), true);
  assert.equal(Number.isNaN(parseIsoDateLocal('2026-13-01').getTime()), true);
  assert.equal(Number.isNaN(parseIsoDateLocal('11/06/2026').getTime()), true);
  assert.equal(Number.isNaN(parseIsoDateLocal('').getTime()), true);
});

test('calculateDaysRemaining computes exact calendar days across boundaries and DST', () => {
  const refMorning = new Date(2026, 10, 6, 0, 15, 0); // Nov 6, 2026 00:15
  const refNight = new Date(2026, 10, 6, 23, 59, 59); // Nov 6, 2026 23:59

  assert.equal(calculateDaysRemaining('2026-11-06', refMorning), 0);
  assert.equal(calculateDaysRemaining('2026-11-06', refNight), 0);

  assert.equal(calculateDaysRemaining('2026-11-07', refMorning), 1);
  assert.equal(calculateDaysRemaining('2026-11-07', refNight), 1);

  assert.equal(calculateDaysRemaining('2026-12-06', refMorning), 30);
  assert.equal(calculateDaysRemaining('2026-12-07', refMorning), 31);

  assert.equal(calculateDaysRemaining('2026-11-05', refMorning), -1);
  assert.equal(calculateDaysRemaining('2026-10-27', refMorning), -10);

  // Across March DST spring-forward boundary
  const marchBeforeDst = new Date(2026, 2, 7, 12, 0, 0);
  assert.equal(calculateDaysRemaining('2026-03-09', marchBeforeDst), 2);
});

test('calculateExpiryStatus classifies Active (>30), Expiring Soon (0..30), and Expired (<0)', () => {
  const today = new Date(2026, 10, 6, 9, 30, 0); // Nov 6, 2026

  // More than 30 days remaining -> Active
  assert.equal(calculateExpiryStatus('2026-12-07', today), 'Active'); // 31 days
  assert.equal(calculateExpiryStatus('2027-05-01', today), 'Active'); // 176 days

  // 1 to 30 days remaining (and 0 = expires today) -> Expiring Soon
  assert.equal(calculateExpiryStatus('2026-12-06', today), 'Expiring Soon'); // 30 days
  assert.equal(calculateExpiryStatus('2026-11-20', today), 'Expiring Soon'); // 14 days
  assert.equal(calculateExpiryStatus('2026-11-07', today), 'Expiring Soon'); // 1 day
  assert.equal(calculateExpiryStatus('2026-11-06', today), 'Expiring Soon'); // 0 days (today)

  // Expiry date has passed -> Expired
  assert.equal(calculateExpiryStatus('2026-11-05', today), 'Expired'); // -1 day
  assert.equal(calculateExpiryStatus('2026-01-01', today), 'Expired'); // -309 days
});

test('enrichDocument dynamically recalculates status and remaining days as date advances', () => {
  const baseDoc: DocumentRecord = {
    id: 'doc-1',
    ownerId: 'user-1',
    name: 'Passport',
    category: 'Identity & Travel',
    issueDate: '2020-01-01',
    expiryDate: '2026-12-10',
    reminderDaysBefore: 30,
    status: 'Active',
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

  // Nov 6, 2026 -> 34 days left -> Active
  const nov6 = enrichDocument(baseDoc, new Date(2026, 10, 6));
  assert.equal(nov6.daysRemaining, 34);
  assert.equal(nov6.computedStatus, 'Active');

  // Nov 15, 2026 -> 25 days left -> automatically transitions to Expiring Soon
  const nov15 = enrichDocument(baseDoc, new Date(2026, 10, 15));
  assert.equal(nov15.daysRemaining, 25);
  assert.equal(nov15.computedStatus, 'Expiring Soon');

  // Dec 12, 2026 -> -2 days -> automatically transitions to Expired
  const dec12 = enrichDocument(baseDoc, new Date(2026, 11, 12));
  assert.equal(dec12.daysRemaining, -2);
  assert.equal(dec12.computedStatus, 'Expired');
});

test('getExpiryNotifications excludes Active (>30d), sorts by urgency, and separates unread vs read', () => {
  const refDate = new Date(2026, 10, 6); // Nov 6, 2026
  const makeDoc = (
    id: string,
    expiryDate: string,
    reminderDismissed: boolean
  ): DocumentRecord => ({
    id,
    ownerId: 'user-1',
    name: id,
    category: 'Insurance',
    issueDate: '2025-01-01',
    expiryDate,
    reminderDaysBefore: 30,
    status: 'Active',
    fileName: '',
    fileType: '',
    fileSize: 0,
    storagePath: '',
    fileUrl: '',
    notes: '',
    reminderDismissed,
    createdAt: null,
    updatedAt: null,
  });

  const docs = [
    enrichDocument(makeDoc('active-doc', '2026-12-20', false), refDate), // 44 days -> Active (excluded)
    enrichDocument(makeDoc('soon-unread', '2026-11-26', false), refDate), // 20 days -> Expiring Soon (unread)
    enrichDocument(makeDoc('expired-unread', '2026-11-01', false), refDate), // -5 days -> Expired (unread)
    enrichDocument(makeDoc('soon-read', '2026-11-10', true), refDate), // 4 days -> Expiring Soon (read)
  ];

  const summary = getExpiryNotifications(docs);
  assert.equal(summary.allAlerts.length, 3);
  assert.deepEqual(
    summary.allAlerts.map((d) => d.id),
    ['expired-unread', 'soon-read', 'soon-unread']
  );
  assert.deepEqual(
    summary.unreadAlerts.map((d) => d.id),
    ['expired-unread', 'soon-unread']
  );
  assert.deepEqual(
    summary.readAlerts.map((d) => d.id),
    ['soon-read']
  );
  assert.equal(summary.expiringSoonAlerts.length, 2);
  assert.equal(summary.expiredAlerts.length, 1);

  // When only Active documents exist, all notification lists are empty
  const emptySummary = getExpiryNotifications([docs[0]]);
  assert.equal(emptySummary.allAlerts.length, 0);
  assert.equal(emptySummary.unreadAlerts.length, 0);

  // Deduplicates repeated document records by ID and tie-breaks equal days remaining alphabetically
  const tieAlpha = enrichDocument(
    { ...makeDoc('tie-a', '2026-11-16', false), name: 'Alpha Permit' },
    refDate
  );
  const tieBeta = enrichDocument(
    { ...makeDoc('tie-b', '2026-11-16', false), name: 'Beta Permit' },
    refDate
  );
  const dedupedSummary = getExpiryNotifications([
    tieBeta,
    tieAlpha,
    tieBeta, // duplicate entry for same doc ID
  ]);
  assert.deepEqual(
    dedupedSummary.allAlerts.map((d) => d.id),
    ['tie-a', 'tie-b']
  );

  // Notification event keys distinguish document, phase, and expiry date
  assert.equal(
    getNotificationEventKey(tieAlpha),
    'tie-a:Expiring Soon:2026-11-16'
  );
  const escalatedAlpha = enrichDocument(tieAlpha, new Date(2026, 10, 17));
  assert.equal(
    getNotificationEventKey(escalatedAlpha),
    'tie-a:Expired:2026-11-16'
  );
});

test('formatCountdownLabel, formatDisplayDate, and getTodayIsoLocal produce clean output', () => {
  assert.equal(formatCountdownLabel(45), '45 days remaining');
  assert.equal(formatCountdownLabel(1), '1 day remaining');
  assert.equal(formatCountdownLabel(0), '0 days remaining (Expires today)');
  assert.equal(formatCountdownLabel(-1), 'Expired 1 day ago');
  assert.equal(formatCountdownLabel(-14), 'Expired 14 days ago');
  assert.equal(getTodayIsoLocal(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(formatDisplayDate('2026-11-06'), 'Nov 06, 2026');
});

test('normalizeDocumentUrl lowercases http/https scheme and validateDocumentForm enforces rules', () => {
  assert.equal(
    normalizeDocumentUrl('  HTTPS://Drive.Google.Com/file/d/123  '),
    'https://Drive.Google.Com/file/d/123'
  );
  assert.equal(
    normalizeDocumentUrl('HTTP://example.com/doc.pdf'),
    'http://example.com/doc.pdf'
  );

  const validErrors = validateDocumentForm({
    name: 'Passport Renewal',
    category: 'Identity & Travel',
    issueDate: '2024-01-15',
    expiryDate: '2027-01-15',
    reminderDaysBefore: 30,
    fileUrl: 'HTTPS://drive.google.com/file/123',
    notes: 'Primary passport',
  });
  assert.deepEqual(validErrors, {});

  // Same-day issueDate === expiryDate is valid
  const sameDayErrors = validateDocumentForm({
    name: 'One-Day Event Permit',
    category: 'Licenses & Permits',
    issueDate: '2026-11-06',
    expiryDate: '2026-11-06',
    reminderDaysBefore: 30,
    fileUrl: '',
    notes: '',
  });
  assert.deepEqual(sameDayErrors, {});

  // Missing required fields & chronological inversion (issueDate > expiryDate)
  const invalidErrors = validateDocumentForm({
    name: '   ',
    category: '' as DocumentRecord['category'],
    issueDate: '2027-05-01',
    expiryDate: '2026-05-01',
    reminderDaysBefore: 30,
    fileUrl: 'ftp://example.com/file.pdf',
    notes: 'x'.repeat(1001),
  });
  assert.ok(invalidErrors.name);
  assert.ok(invalidErrors.category);
  assert.equal(
    invalidErrors.expiryDate,
    'Expiry date must be on or after the issue date.'
  );
  assert.ok(invalidErrors.fileUrl);
  assert.ok(invalidErrors.notes);

  const missingDatesErrors = validateDocumentForm({
    name: 'Lease Agreement',
    category: 'Contracts & Legal',
    issueDate: '',
    expiryDate: '',
    reminderDaysBefore: 30,
    fileUrl: '',
    notes: '',
  });
  assert.ok(missingDatesErrors.issueDate);
  assert.ok(missingDatesErrors.expiryDate);
});


