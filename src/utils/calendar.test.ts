import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCalendarMonthGrid,
  groupDocumentsByExpiryDate,
  formatMonthYear,
  getNextMonth,
  getPreviousMonth,
} from './calendar';
import { calculateExpiryStatus, enrichDocument } from './expiry';
import type { DocumentRecord } from '../types/document';

function createMockDoc(
  id: string,
  name: string,
  expiryDate: string,
  refDate: Date = new Date(2026, 10, 8)
) {
  const base: DocumentRecord = {
    id,
    ownerId: 'user-cal-1',
    name,
    category: 'Insurance',
    issueDate: '2025-01-01',
    expiryDate,
    reminderDaysBefore: 30,
    status: calculateExpiryStatus(expiryDate, refDate),
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
  return enrichDocument(base, refDate);
}

test('Requirement 2 & 3: Groups documents by expiry date and distinguishes Active, Expiring Soon, and Expired', () => {
  const refDate = new Date(2026, 10, 8); // Nov 8, 2026
  const docs = [
    createMockDoc('d1', 'Active Passport', '2026-11-25', refDate), // 17 days -> Expiring Soon
    createMockDoc('d2', 'Expired License', '2026-11-05', refDate), // -3 days -> Expired
    createMockDoc('d3', 'Future Lease', '2026-11-25', refDate), // Also expiring on 2026-11-25
    createMockDoc('d4', 'Long term Insurance', '2027-05-10', refDate), // Active
  ];

  const grouped = groupDocumentsByExpiryDate(docs);
  assert.strictEqual(grouped.get('2026-11-25')?.length, 2);
  assert.strictEqual(grouped.get('2026-11-05')?.length, 1);
  assert.strictEqual(grouped.get('2027-05-10')?.length, 1);

  // Month grid for November 2026 (month index 10)
  const grid = getCalendarMonthGrid(2026, 10, docs, '2026-11-08');

  // Verify full weeks
  assert.ok(grid.length % 7 === 0);
  assert.ok(grid.length === 35 || grid.length === 42);

  // Find 2026-11-05 (Expired)
  const cellNov5 = grid.find((c) => c.dateIso === '2026-11-05');
  assert.ok(cellNov5);
  assert.strictEqual(cellNov5.documents.length, 1);
  assert.strictEqual(cellNov5.hasExpired, true);
  assert.strictEqual(cellNov5.hasActive, false);

  // Find 2026-11-25 (Expiring Soon)
  const cellNov25 = grid.find((c) => c.dateIso === '2026-11-25');
  assert.ok(cellNov25);
  assert.strictEqual(cellNov25.documents.length, 2);
  assert.strictEqual(cellNov25.hasExpiringSoon, true);

  // Find today (2026-11-08)
  const cellToday = grid.find((c) => c.dateIso === '2026-11-08');
  assert.ok(cellToday);
  assert.strictEqual(cellToday.isToday, true);
});

test('Requirement 4: Month navigation computes previous and next months correctly across year boundaries', () => {
  // Normal month transition
  assert.deepStrictEqual(getNextMonth(2026, 5), { year: 2026, monthIndex: 6 });
  assert.deepStrictEqual(getPreviousMonth(2026, 5), { year: 2026, monthIndex: 4 });

  // Year forward boundary: Dec 2026 -> Jan 2027
  assert.deepStrictEqual(getNextMonth(2026, 11), { year: 2027, monthIndex: 0 });

  // Year backward boundary: Jan 2026 -> Dec 2025
  assert.deepStrictEqual(getPreviousMonth(2026, 0), { year: 2025, monthIndex: 11 });

  // Month year formatting
  assert.strictEqual(formatMonthYear(2026, 10), 'November 2026');
  assert.strictEqual(formatMonthYear(2027, 0), 'January 2027');
});
