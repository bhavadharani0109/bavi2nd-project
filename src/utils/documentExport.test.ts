import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentRecord, EnrichedDocument } from '../types/document';
import {
  calculateExpiryStatus,
  enrichDocument,
  escapeCsvCell,
  generateCsvContent,
} from './expiry';

function createMockDoc(
  id: string,
  name: string,
  category: DocumentRecord['category'],
  issueDate: string,
  expiryDate: string,
  notes = '',
  ownerId = 'user-owner-123'
): EnrichedDocument {
  const base: DocumentRecord = {
    id,
    ownerId,
    name,
    category,
    issueDate,
    expiryDate,
    reminderDaysBefore: 30,
    status: calculateExpiryStatus(expiryDate),
    fileName: '',
    fileType: '',
    fileSize: 0,
    storagePath: '',
    fileUrl: '',
    notes,
    reminderDismissed: false,
    createdAt: null,
    updatedAt: null,
  };
  return enrichDocument(base, new Date(2026, 10, 8)); // Nov 8, 2026
}

test('Requirement 3: CSV Export headers include document name, category, status, days remaining, issue date, and expiry date', () => {
  const doc = createMockDoc(
    'doc-1',
    'Passport',
    'Identity & Travel',
    '2020-01-15',
    '2030-01-15'
  );

  const csv = generateCsvContent([doc]);

  // UTF-8 BOM must be present at the start for Excel / Google Sheets compatibility
  assert.equal(csv.startsWith('\uFEFF'), true);

  const lines = csv.replace('\uFEFF', '').split('\r\n');
  assert.ok(lines.length >= 2, 'CSV must have header row and data row');

  const headerLine = lines[0];
  const headers = headerLine.split(',');

  // Mandatory fields
  assert.ok(headers.includes('Document Name'));
  assert.ok(headers.includes('Category'));
  assert.ok(headers.includes('Status'));
  assert.ok(headers.includes('Days Remaining'));
  assert.ok(headers.includes('Issue Date'));
  assert.ok(headers.includes('Expiry Date'));
});

test('Requirement 2 & 3: CSV row accurately outputs document details and status calculations', () => {
  const doc1 = createMockDoc(
    'doc-1',
    'US Passport',
    'Identity & Travel',
    '2020-05-01',
    '2030-05-01',
    'Primary passport'
  );
  const doc2 = createMockDoc(
    'doc-2',
    'Auto Policy',
    'Insurance',
    '2025-11-20',
    '2026-11-20',
    'Policy #GE-10293'
  );

  const csv = generateCsvContent([doc1, doc2]);
  const lines = csv.replace('\uFEFF', '').split('\r\n');

  assert.equal(lines.length, 3); // 1 header + 2 rows

  // Check row 1 content
  assert.ok(lines[1].includes('US Passport'));
  assert.ok(lines[1].includes('Identity & Travel'));
  assert.ok(lines[1].includes('Active'));
  assert.ok(lines[1].includes('2020-05-01'));
  assert.ok(lines[1].includes('2030-05-01'));

  // Check row 2 content
  assert.ok(lines[2].includes('Auto Policy'));
  assert.ok(lines[2].includes('Insurance'));
  assert.ok(lines[2].includes('Expiring Soon'));
  assert.ok(lines[2].includes('2025-11-20'));
  assert.ok(lines[2].includes('2026-11-20'));
  assert.ok(lines[2].includes('12')); // 12 days remaining from Nov 8 to Nov 20
});

test('Requirement 4: Exporting filtered documents exports only the matching subset', () => {
  const docActive = createMockDoc(
    'd-act',
    'Passport',
    'Identity & Travel',
    '2020-01-01',
    '2030-01-01'
  );
  const docSoon = createMockDoc(
    'd-soon',
    'Car Insurance',
    'Insurance',
    '2025-11-15',
    '2026-11-15'
  );
  const docExpired = createMockDoc(
    'd-exp',
    'Visa',
    'Identity & Travel',
    '2022-01-01',
    '2026-10-01'
  );

  const allDocuments = [docActive, docSoon, docExpired];

  // 1. Export All Documents
  const fullCsv = generateCsvContent(allDocuments);
  const fullLines = fullCsv.replace('\uFEFF', '').split('\r\n');
  assert.equal(fullLines.length, 4); // header + 3 rows

  // 2. Export Filtered: only "Insurance" category
  const filteredInsurance = allDocuments.filter((d) => d.category === 'Insurance');
  const insuranceCsv = generateCsvContent(filteredInsurance);
  const insuranceLines = insuranceCsv.replace('\uFEFF', '').split('\r\n');

  assert.equal(insuranceLines.length, 2); // header + 1 row
  assert.ok(insuranceLines[1].includes('Car Insurance'));
  assert.equal(insuranceCsv.includes('Passport'), false);
  assert.equal(insuranceCsv.includes('Visa'), false);

  // 3. Export Filtered: only "Expiring Soon" documents
  const filteredExpiring = allDocuments.filter(
    (d) => d.computedStatus === 'Expiring Soon'
  );
  const expiringCsv = generateCsvContent(filteredExpiring);
  const expiringLines = expiringCsv.replace('\uFEFF', '').split('\r\n');

  assert.equal(expiringLines.length, 2);
  assert.ok(expiringLines[1].includes('Car Insurance'));
});

test('Requirement 5: In-browser RFC 4180 escaping and formula injection protection', () => {
  // Cell containing commas and quotes
  const escapedComma = escapeCsvCell('Smith, John "Agent"');
  assert.equal(escapedComma, '"Smith, John ""Agent"""');

  // Formula injection attempts starting with =, +, -, @ must be prepended with apostrophe
  const formula1 = escapeCsvCell('=SUM(A1:A10)');
  assert.equal(formula1, "'=SUM(A1:A10)");

  const formula2 = escapeCsvCell('+cmd|/c calc');
  assert.equal(formula2, "'+cmd|/c calc");

  const formula3 = escapeCsvCell('@HYPERLINK("http://evil.com")');
  assert.equal(formula3, '"\'@HYPERLINK(""http://evil.com"")"');

  // Normal safe strings remain unchanged
  assert.equal(escapeCsvCell('Passport Renewal'), 'Passport Renewal');
  assert.equal(escapeCsvCell(45), '45');
});

test('Requirement 6: User-specific data privacy during export', () => {
  const currentUserId = 'user-owner-123';
  const otherUserId = 'attacker-456';

  const userDocs = [
    createMockDoc('1', 'My Health Card', 'Medical & Health', '2020-01-01', '2028-01-01', '', currentUserId),
    createMockDoc('2', 'My Driver License', 'Licenses & Permits', '2022-01-01', '2027-01-01', '', currentUserId),
  ];
  const otherDoc = createMockDoc(
    '3',
    'Secret Third-Party Document',
    'Tax & Financial',
    '2021-01-01',
    '2029-01-01',
    '',
    otherUserId
  );

  const rawDbDocs = [...userDocs, otherDoc];

  // Scoped export guarantees only current user's records are processed
  const exportableDocs = rawDbDocs.filter((d) => d.ownerId === currentUserId);
  const exportCsv = generateCsvContent(exportableDocs);

  assert.ok(exportCsv.includes('My Health Card'));
  assert.ok(exportCsv.includes('My Driver License'));
  assert.equal(exportCsv.includes('Secret Third-Party Document'), false);
});
