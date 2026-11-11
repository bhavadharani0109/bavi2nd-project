import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentRecord, EnrichedDocument } from '../types/document';
import {
  calculateDaysRemaining,
  calculateExpiryStatus,
  enrichDocument,
  formatCountdownLabel,
  formatDisplayDate,
  getExpiryNotifications,
} from './expiry';

function createMockDoc(
  id: string,
  name: string,
  expiryDate: string,
  reminderDismissed = false
): DocumentRecord {
  return {
    id,
    ownerId: 'user-test-uid',
    name,
    category: 'Identity & Travel',
    issueDate: '2020-01-01',
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
  };
}

test('Requirement 1 & 2: Show notifications for documents expiring within 30 days and alerts for expired documents', () => {
  const referenceDate = new Date(2026, 10, 8); // Nov 8, 2026

  const docActive = enrichDocument(
    createMockDoc('doc-active', 'Active Health Card', '2026-12-25'), // 47 days left
    referenceDate
  );
  const docExpiringSoon30 = enrichDocument(
    createMockDoc('doc-30d', 'Driver License Renewal', '2026-12-08'), // exactly 30 days left
    referenceDate
  );
  const docExpiringSoon10 = enrichDocument(
    createMockDoc('doc-10d', 'Passport', '2026-11-18'), // 10 days left
    referenceDate
  );
  const docExpiringToday = enrichDocument(
    createMockDoc('doc-today', 'Visitor Visa', '2026-11-08'), // 0 days left
    referenceDate
  );
  const docExpired1d = enrichDocument(
    createMockDoc('doc-exp-1d', 'Work Authorization', '2026-11-07'), // -1 day (yesterday)
    referenceDate
  );
  const docExpired30d = enrichDocument(
    createMockDoc('doc-exp-30d', 'Vehicle Insurance', '2026-10-09'), // -30 days
    referenceDate
  );

  const docs: EnrichedDocument[] = [
    docActive,
    docExpiringSoon30,
    docExpiringSoon10,
    docExpiringToday,
    docExpired1d,
    docExpired30d,
  ];

  const notifications = getExpiryNotifications(docs);

  // Active document (>30 days) is excluded from expiry alerts
  assert.equal(
    notifications.allAlerts.some((d) => d.id === 'doc-active'),
    false,
    'Active documents with >30 days remaining must not appear in expiry alerts'
  );

  // Documents expiring within 30 days (including today) must appear in expiringSoonAlerts
  assert.equal(notifications.expiringSoonAlerts.length, 3);
  assert.ok(notifications.expiringSoonAlerts.some((d) => d.id === 'doc-30d'));
  assert.ok(notifications.expiringSoonAlerts.some((d) => d.id === 'doc-10d'));
  assert.ok(notifications.expiringSoonAlerts.some((d) => d.id === 'doc-today'));

  // Expired documents must appear in expiredAlerts
  assert.equal(notifications.expiredAlerts.length, 2);
  assert.ok(notifications.expiredAlerts.some((d) => d.id === 'doc-exp-1d'));
  assert.ok(notifications.expiredAlerts.some((d) => d.id === 'doc-exp-30d'));

  // allAlerts includes both Expired and Expiring Soon
  assert.equal(notifications.allAlerts.length, 5);
});

test('Requirement 3: Display document name, expiry date, and remaining days with correct labels', () => {
  const referenceDate = new Date(2026, 10, 8); // Nov 8, 2026

  const doc = enrichDocument(
    createMockDoc('doc-test-labels', 'Singapore Employment Pass', '2026-11-20'),
    referenceDate
  );

  assert.equal(doc.name, 'Singapore Employment Pass');
  assert.equal(doc.expiryDate, '2026-11-20');
  assert.equal(formatDisplayDate(doc.expiryDate), 'Nov 20, 2026');
  assert.equal(doc.daysRemaining, 12);
  assert.equal(formatCountdownLabel(doc.daysRemaining), '12 days remaining');

  // Today
  assert.equal(formatCountdownLabel(0), '0 days remaining (Expires today)');

  // Expired
  assert.equal(formatCountdownLabel(-1), 'Expired 1 day ago');
  assert.equal(formatCountdownLabel(-5), 'Expired 5 days ago');
});

test('Requirement 5 & 6: Track unread notification count and allow marking notifications as read', () => {
  const referenceDate = new Date(2026, 10, 8);

  const doc1 = enrichDocument(
    createMockDoc('doc-1', 'Passport', '2026-11-15', false), // unread
    referenceDate
  );
  const doc2 = enrichDocument(
    createMockDoc('doc-2', 'Car Insurance', '2026-11-05', false), // unread
    referenceDate
  );
  const doc3 = enrichDocument(
    createMockDoc('doc-3', 'Medical License', '2026-11-12', true), // read
    referenceDate
  );

  const summary = getExpiryNotifications([doc1, doc2, doc3]);

  // Unread notification count is 2
  assert.equal(summary.unreadAlerts.length, 2);
  assert.equal(summary.readAlerts.length, 1);
  assert.equal(summary.allAlerts.length, 3);

  // When doc1 is marked as read
  const updatedDoc1 = { ...doc1, reminderDismissed: true };
  const updatedSummary = getExpiryNotifications([updatedDoc1, doc2, doc3]);

  // Unread count decreases to 1
  assert.equal(updatedSummary.unreadAlerts.length, 1);
  assert.equal(updatedSummary.readAlerts.length, 2);
  assert.equal(updatedSummary.unreadAlerts[0].id, 'doc-2');
});

test('Requirement 7: Update notifications based on latest document expiry status as time advances', () => {
  const baseDoc = createMockDoc('doc-lifecycle', 'Tenancy Contract', '2026-11-15');

  // 1. On Oct 1, 2026: 45 days remaining -> Active (no notification)
  const oct1 = enrichDocument(baseDoc, new Date(2026, 9, 1));
  assert.equal(oct1.computedStatus, 'Active');
  assert.equal(oct1.daysRemaining, 45);
  let notifs = getExpiryNotifications([oct1]);
  assert.equal(notifs.allAlerts.length, 0);

  // 2. On Oct 25, 2026: 21 days remaining -> automatically transitions to Expiring Soon
  const oct25 = enrichDocument(baseDoc, new Date(2026, 9, 25));
  assert.equal(oct25.computedStatus, 'Expiring Soon');
  assert.equal(oct25.daysRemaining, 21);
  notifs = getExpiryNotifications([oct25]);
  assert.equal(notifs.allAlerts.length, 1);
  assert.equal(notifs.expiringSoonAlerts.length, 1);
  assert.equal(notifs.expiredAlerts.length, 0);

  // 3. On Nov 16, 2026: -1 days remaining -> automatically transitions to Expired
  const nov16 = enrichDocument(baseDoc, new Date(2026, 10, 16));
  assert.equal(nov16.computedStatus, 'Expired');
  assert.equal(nov16.daysRemaining, -1);
  notifs = getExpiryNotifications([nov16]);
  assert.equal(notifs.allAlerts.length, 1);
  assert.equal(notifs.expiringSoonAlerts.length, 0);
  assert.equal(notifs.expiredAlerts.length, 1);
});

test('Urgency Sorting: Expired documents and soonest expiring documents appear first', () => {
  const refDate = new Date(2026, 10, 8);

  const doc1 = enrichDocument(createMockDoc('d1', 'Soon 20d', '2026-11-28'), refDate); // 20d
  const doc2 = enrichDocument(createMockDoc('d2', 'Expired 10d ago', '2026-10-29'), refDate); // -10d
  const doc3 = enrichDocument(createMockDoc('d3', 'Soon 2d', '2026-11-10'), refDate); // 2d
  const doc4 = enrichDocument(createMockDoc('d4', 'Expired 2d ago', '2026-11-06'), refDate); // -2d

  const summary = getExpiryNotifications([doc1, doc2, doc3, doc4]);

  // Order must be: -10d, -2d, 2d, 20d
  assert.deepEqual(
    summary.allAlerts.map((d) => d.id),
    ['d2', 'd4', 'd3', 'd1']
  );
});
