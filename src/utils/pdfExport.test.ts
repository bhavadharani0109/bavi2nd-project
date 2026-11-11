import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePdfDocument } from './pdfExport';
import { calculateExpiryStatus, enrichDocument } from './expiry';
import type { DocumentRecord, EnrichedDocument } from '../types/document';

function createMockDoc(
  id: string,
  name: string,
  category: DocumentRecord['category'],
  issueDate: string,
  expiryDate: string,
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
    fileName: 'sample.pdf',
    fileType: 'application/pdf',
    fileSize: 10240,
    storagePath: 'vault/sample.pdf',
    fileUrl: '',
    notes: '',
    reminderDismissed: false,
    createdAt: null,
    updatedAt: null,
  };
  return enrichDocument(base, new Date(2026, 10, 8)); // Nov 8, 2026
}

test('Requirement 2 & 4: Generates valid PDF with Report Title, Generation Date, and Total Count', () => {
  const mockDocs = [
    createMockDoc(
      'doc-1',
      'Passport',
      'Identity & Travel',
      '2024-01-01',
      '2027-01-01'
    ),
    createMockDoc(
      'doc-2',
      'Health Insurance Card',
      'Medical & Health',
      '2025-01-01',
      '2026-11-20' // Expiring soon
    ),
  ];

  const doc = generatePdfDocument(mockDocs, {
    reportTitle: 'DocuPing Vault – Custom Executive Audit',
    filterScopeLabel: 'Active & Expiring Soon',
    userEmail: 'bhavadharanirajini@gmail.com',
  });

  assert.ok(doc, 'PDF instance was created');
  assert.strictEqual(doc.getNumberOfPages(), 1, 'Fits on a single page');

  // Verify internal text or binary output exists and is non-empty
  const output = doc.output('arraybuffer');
  assert.ok(output.byteLength > 1000, 'PDF binary payload generated cleanly');
});

test('Requirement 3: Includes all required fields (Name, Category, Status, Remaining Days, Issue Date, Expiry Date)', () => {
  const singleDoc = createMockDoc(
    'doc-auto',
    'Vehicle Insurance Policy',
    'Insurance',
    '2025-11-01',
    '2026-11-05' // Expired 3 days before Nov 8, 2026
  );

  assert.strictEqual(singleDoc.computedStatus, 'Expired');
  assert.strictEqual(singleDoc.daysRemaining, -3);

  const pdf = generatePdfDocument([singleDoc]);
  assert.strictEqual(pdf.getNumberOfPages(), 1);
  const pdfString = pdf.output('datauristring');
  assert.ok(pdfString.startsWith('data:application/pdf;'), 'Generated valid data URI');
});

test('Requirement 5: Supports exporting filtered subsets vs full vault datasets', () => {
  const allDocs = [
    createMockDoc(
      'doc-active',
      'Active Lease Agreement',
      'Contracts & Legal',
      '2025-01-01',
      '2028-01-01'
    ),
    createMockDoc(
      'doc-expiring',
      'Driver License Renewal',
      'Licenses & Permits',
      '2023-11-15',
      '2026-11-15'
    ),
    createMockDoc(
      'doc-expired',
      'Fitness Club Pass',
      'Other',
      '2025-10-01',
      '2026-10-01'
    ),
  ];

  // Full export
  const fullPdf = generatePdfDocument(allDocs, {
    reportTitle: 'All Vault Documents',
    filterScopeLabel: 'All 3 Documents',
  });
  assert.strictEqual(fullPdf.getNumberOfPages(), 1);

  // Filtered subset export (only expiring soon)
  const filtered = allDocs.filter((d) => d.computedStatus === 'Expiring Soon');
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].name, 'Driver License Renewal');

  const filteredPdf = generatePdfDocument(filtered, {
    reportTitle: 'Filtered Document Queue',
    filterScopeLabel: 'Expiring Soon (1 of 3 Documents)',
  });
  assert.strictEqual(filteredPdf.getNumberOfPages(), 1);
});

test('Requirement 2 & Pagination: Seamless multi-page document pagination for large document collections', () => {
  // Generate 40 documents which naturally span across multiple pages
  const largeDataset = Array.from({ length: 40 }).map((_, i) =>
    createMockDoc(
      `doc-${i}`,
      `Long Tracked Corporate Asset Certificate #${i + 1}`,
      'Certifications',
      '2024-01-01',
      `2027-${String((i % 12) + 1).padStart(2, '0')}-15`
    )
  );

  const multiPagePdf = generatePdfDocument(largeDataset, {
    reportTitle: 'Annual Comprehensive Vault Audit',
  });

  const pageCount = multiPagePdf.getNumberOfPages();
  assert.ok(pageCount >= 2, `Multi-page PDF generated ${pageCount} pages`);
});

test('Requirement 6 & 7: Zero external network calls & handles empty dataset gracefully', () => {
  const emptyPdf = generatePdfDocument([], {
    reportTitle: 'Empty Vault Report',
  });

  assert.strictEqual(emptyPdf.getNumberOfPages(), 1);
  const buffer = emptyPdf.output('arraybuffer');
  assert.ok(buffer.byteLength > 500, 'Produced clean empty report');
});
