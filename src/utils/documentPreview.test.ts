import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDocumentPreviewInfo,
  normalizePreviewUrl,
  extractUrlPathname,
} from './documentPreview';

test('Requirement 1 & 2: Identifies PDF documents from URL, filename, or MIME type', () => {
  // Test PDF via external link URL
  const pdfFromUrl = getDocumentPreviewInfo({
    fileUrl: 'https://example.com/vault/invoice-2026.pdf',
  });
  assert.strictEqual(pdfFromUrl.formatType, 'pdf');
  assert.strictEqual(pdfFromUrl.isDirectPreviewable, true);
  assert.strictEqual(pdfFromUrl.formatBadge, 'PDF');

  // Test PDF with query parameters in URL
  const pdfWithQuery = getDocumentPreviewInfo({
    fileUrl: 'https://files.company.com/contracts/NDA.PDF?auth=token123&expiry=2026',
  });
  assert.strictEqual(pdfWithQuery.formatType, 'pdf');
  assert.strictEqual(pdfWithQuery.isDirectPreviewable, true);

  // Test PDF via Google Drive link
  const drivePdf = getDocumentPreviewInfo({
    fileUrl: 'https://drive.google.com/file/d/1A2B3C4D5E/view?usp=sharing',
  });
  assert.strictEqual(drivePdf.formatType, 'pdf');
  assert.strictEqual(drivePdf.isDirectPreviewable, true);
  assert.strictEqual(
    drivePdf.previewUrl,
    'https://drive.google.com/file/d/1A2B3C4D5E/preview'
  );
});

test('Requirement 2: Identifies JPG and PNG documents from URL or MIME type', () => {
  // Test JPG via URL
  const jpgDoc = getDocumentPreviewInfo({
    fileUrl: 'https://assets.storage.org/passports/photo.jpg',
  });
  assert.strictEqual(jpgDoc.formatType, 'image');
  assert.strictEqual(jpgDoc.isDirectPreviewable, true);
  assert.strictEqual(jpgDoc.formatBadge, 'JPG');

  // Test JPEG with query
  const jpegDoc = getDocumentPreviewInfo({
    fileUrl: 'https://images.site.com/license.jpeg?size=large',
  });
  assert.strictEqual(jpegDoc.formatType, 'image');
  assert.strictEqual(jpegDoc.isDirectPreviewable, true);

  // Test PNG via URL
  const pngDoc = getDocumentPreviewInfo({
    fileUrl: 'https://cdn.example.org/id_cards/badge.png',
  });
  assert.strictEqual(pngDoc.formatType, 'image');
  assert.strictEqual(pngDoc.isDirectPreviewable, true);
  assert.strictEqual(pngDoc.formatBadge, 'PNG');

  // Test PNG via MIME type
  const pngFromMime = getDocumentPreviewInfo({
    fileUrl: 'https://cdn.example.org/download-handler?id=99',
    fileType: 'image/png',
  });
  assert.strictEqual(pngFromMime.formatType, 'image');
  assert.strictEqual(pngFromMime.isDirectPreviewable, true);
});

test('Requirement 5: Shows friendly message when file cannot be previewed directly', () => {
  // Generic portal / webpage link (not direct PDF or image)
  const portalDoc = getDocumentPreviewInfo({
    fileUrl: 'https://services.gov.in/portal/dashboard/profile',
  });
  assert.strictEqual(portalDoc.formatType, 'external-link');
  assert.strictEqual(portalDoc.isDirectPreviewable, false);
  assert.ok(portalDoc.unsupportedMessage, 'Friendly unsupported message provided');
  assert.ok(
    portalDoc.unsupportedMessage.includes('not a direct PDF, JPG, or PNG'),
    'Explains why direct preview is unavailable'
  );

  // No URL provided (Metadata only record)
  const noUrlDoc = getDocumentPreviewInfo({});
  assert.strictEqual(noUrlDoc.formatType, 'none');
  assert.strictEqual(noUrlDoc.isDirectPreviewable, false);
  assert.ok(noUrlDoc.unsupportedMessage);
});

test('Requirement 6 & 7: URL normalization preserves privacy and direct access without cloud storage', () => {
  const rawDropbox = 'https://www.dropbox.com/s/12345/document.pdf?dl=0';
  const normalizedDropbox = normalizePreviewUrl(rawDropbox);
  assert.strictEqual(
    normalizedDropbox,
    'https://www.dropbox.com/s/12345/document.pdf?raw=1'
  );

  const parsedPath = extractUrlPathname('https://example.com/path/to/my%20file.pdf?v=2');
  assert.strictEqual(parsedPath, '/path/to/my%20file.pdf');
});
