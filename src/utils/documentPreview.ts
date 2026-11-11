export type PreviewFormatType = 'pdf' | 'image' | 'external-link' | 'none';

export interface DocumentPreviewInfo {
  formatType: PreviewFormatType;
  previewUrl: string;
  directDownloadUrl: string;
  isDirectPreviewable: boolean;
  formatBadge: 'PDF' | 'JPG' | 'PNG' | 'IMAGE' | 'LINK' | 'NONE';
  unsupportedMessage?: string;
}

/**
 * Normalizes an external document URL into an embeddable preview URL if possible.
 * Specifically converts Google Drive view links to their native embed preview endpoint.
 */
export function normalizePreviewUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\/.+$/i.test(trimmed)) return '';

  // Google Drive conversion: /file/d/{id}/view -> /file/d/{id}/preview
  const driveMatch = trimmed.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:\/.*)?/i
  );
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // Google Drive open?id={id}
  const driveIdParam = trimmed.match(
    /drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]+)/i
  );
  if (driveIdParam && driveIdParam[1]) {
    return `https://drive.google.com/file/d/${driveIdParam[1]}/preview`;
  }

  // Dropbox dl=0 -> raw=1
  if (/dropbox\.com\/.+/i.test(trimmed) && trimmed.includes('dl=0')) {
    return trimmed.replace('dl=0', 'raw=1');
  }

  return trimmed;
}

/**
 * Extracts the file path portion of a URL, ignoring query params and hash fragments.
 */
export function extractUrlPathname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase();
  } catch {
    const withoutQuery = url.split('?')[0].split('#')[0];
    return withoutQuery.toLowerCase();
  }
}

/**
 * Inspects document metadata, MIME type, file name, and external URL
 * to determine if the document can be previewed as a PDF, JPG, PNG, or external link.
 */
export function getDocumentPreviewInfo(doc: {
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
}): DocumentPreviewInfo {
  const rawUrl = (doc.fileUrl || '').trim();
  const fileType = (doc.fileType || '').toLowerCase();
  const fileName = (doc.fileName || '').toLowerCase();

  if (!rawUrl && !fileType && !fileName) {
    return {
      formatType: 'none',
      previewUrl: '',
      directDownloadUrl: '',
      isDirectPreviewable: false,
      formatBadge: 'NONE',
      unsupportedMessage: 'No external file link or attachment is attached to this document record.',
    };
  }

  const effectiveUrl = normalizePreviewUrl(rawUrl);
  const pathname = rawUrl ? extractUrlPathname(rawUrl) : '';

  // Check for PDF
  const isPdf =
    fileType === 'application/pdf' ||
    fileName.endsWith('.pdf') ||
    pathname.endsWith('.pdf') ||
    effectiveUrl.includes('drive.google.com/file/d/');

  if (isPdf) {
    return {
      formatType: 'pdf',
      previewUrl: effectiveUrl,
      directDownloadUrl: rawUrl,
      isDirectPreviewable: Boolean(effectiveUrl),
      formatBadge: 'PDF',
    };
  }

  // Check for JPG / JPEG
  const isJpg =
    fileType === 'image/jpeg' ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg');

  if (isJpg) {
    return {
      formatType: 'image',
      previewUrl: effectiveUrl,
      directDownloadUrl: rawUrl,
      isDirectPreviewable: Boolean(effectiveUrl),
      formatBadge: 'JPG',
    };
  }

  // Check for PNG
  const isPng =
    fileType === 'image/png' ||
    fileName.endsWith('.png') ||
    pathname.endsWith('.png');

  if (isPng) {
    return {
      formatType: 'image',
      previewUrl: effectiveUrl,
      directDownloadUrl: rawUrl,
      isDirectPreviewable: Boolean(effectiveUrl),
      formatBadge: 'PNG',
    };
  }

  // Check for other web images (WebP, GIF, SVG)
  const isOtherImage =
    fileType.startsWith('image/') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg');

  if (isOtherImage) {
    return {
      formatType: 'image',
      previewUrl: effectiveUrl,
      directDownloadUrl: rawUrl,
      isDirectPreviewable: Boolean(effectiveUrl),
      formatBadge: 'IMAGE',
    };
  }

  // If there is an external URL but it is not a direct PDF or image format
  if (effectiveUrl) {
    return {
      formatType: 'external-link',
      previewUrl: effectiveUrl,
      directDownloadUrl: rawUrl,
      isDirectPreviewable: false,
      formatBadge: 'LINK',
      unsupportedMessage:
        'This external document link is not a direct PDF, JPG, or PNG file. It can be opened directly in a secure new tab.',
    };
  }

  return {
    formatType: 'none',
    previewUrl: '',
    directDownloadUrl: '',
    isDirectPreviewable: false,
    formatBadge: 'NONE',
    unsupportedMessage: 'No direct previewable file link is associated with this document.',
  };
}
