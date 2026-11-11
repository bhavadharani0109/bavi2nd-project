import { jsPDF } from 'jspdf';
import type { EnrichedDocument } from '../types/document';
import { getTodayIsoLocal } from './expiry';

export interface PdfExportOptions {
  fileNamePrefix?: string;
  reportTitle?: string;
  filterScopeLabel?: string;
  userEmail?: string;
}

/**
 * Builds a professional, multi-page vector PDF report containing documents,
 * metadata header, status breakdown badges, and clean tabular rows.
 * Entirely client-side and zero-dependency besides jsPDF.
 */
export function generatePdfDocument(
  documents: EnrichedDocument[],
  options: PdfExportOptions = {}
): jsPDF {
  // A4 dimensions in mm: 210 x 297
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 14;
  const rightMargin = 14;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 182 mm
  const bottomThreshold = 276; // mm before new page trigger

  const reportTitle = options.reportTitle || 'DocuPing Document Expiry & Status Report';
  const today = getTodayIsoLocal();

  // Compute status aggregates
  const totalCount = documents.length;
  const activeCount = documents.filter((d) => d.computedStatus === 'Active').length;
  const expiringSoonCount = documents.filter((d) => d.computedStatus === 'Expiring Soon').length;
  const expiredCount = documents.filter((d) => d.computedStatus === 'Expired').length;

  // Column definitions (total width = 182 mm)
  const columns = [
    { id: 'name', label: 'Document Name', width: 52, align: 'left' as const },
    { id: 'category', label: 'Category', width: 34, align: 'left' as const },
    { id: 'status', label: 'Status', width: 28, align: 'center' as const },
    { id: 'days', label: 'Remaining Days', width: 28, align: 'left' as const },
    { id: 'issue', label: 'Issue Date', width: 20, align: 'left' as const },
    { id: 'expiry', label: 'Expiry Date', width: 20, align: 'left' as const },
  ];

  let currentY = 0;

  // Helper: Draw top primary accent bar
  function drawTopAccentBar() {
    doc.setFillColor(29, 78, 216); // Royal Blue #1d4ed8
    doc.rect(0, 0, pageWidth, 4, 'F');
  }

  // Helper: Draw table headers
  function drawTableHeader(y: number): number {
    const headerHeight = 8;
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(leftMargin, y, contentWidth, headerHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let colX = leftMargin;
    columns.forEach((col) => {
      const textX =
        col.align === 'center'
          ? colX + col.width / 2
          : colX + 2.5;
      doc.text(col.label, textX, y + 5.2, {
        align: col.align === 'center' ? 'center' : 'left',
      });
      colX += col.width;
    });

    return y + headerHeight;
  }

  // Draw Page 1 Branding & Header Block
  drawTopAccentBar();
  currentY = 14;

  // Brand Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('DocuPing', leftMargin, currentY);

  doc.setFontSize(8);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text('SMART DOCUMENT EXPIRY TRACKER', leftMargin + 31, currentY - 0.5);

  // Right-aligned header metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  const genDateText = `Report Date: ${today}`;
  doc.text(genDateText, pageWidth - rightMargin, currentY - 1, { align: 'right' });
  if (options.userEmail) {
    doc.text(`Account: ${options.userEmail}`, pageWidth - rightMargin, currentY + 3.5, {
      align: 'right',
    });
  }

  currentY += 8;

  // Report Summary Card
  const cardHeight = 22;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, currentY, contentWidth, cardHeight, 2, 2, 'FD');

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, leftMargin + 4, currentY + 6.5);

  // Scope label & Counts
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const scopeText = options.filterScopeLabel
    ? `Scope: ${options.filterScopeLabel}  |  Total: ${totalCount} Document${totalCount === 1 ? '' : 's'}`
    : `Total Documents Tracked: ${totalCount}`;
  doc.text(scopeText, leftMargin + 4, currentY + 12);

  // Status Badges in Summary Card (Right aligned / pill breakdown)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  const statsY = currentY + 17;
  let statX = leftMargin + 4;

  // Active pill
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(statX, statsY - 3.5, 24, 5, 1, 1, 'FD');
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text(`Active: ${activeCount}`, statX + 12, statsY, { align: 'center' });
  statX += 28;

  // Expiring Soon pill
  doc.setFillColor(254, 243, 199); // amber-50
  doc.setDrawColor(253, 230, 138); // amber-200
  doc.roundedRect(statX, statsY - 3.5, 34, 5, 1, 1, 'FD');
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`Expiring Soon: ${expiringSoonCount}`, statX + 17, statsY, { align: 'center' });
  statX += 38;

  // Expired pill
  doc.setFillColor(254, 226, 226); // red-50
  doc.setDrawColor(254, 202, 202); // red-200
  doc.roundedRect(statX, statsY - 3.5, 25, 5, 1, 1, 'FD');
  doc.setTextColor(185, 28, 28); // red-700
  doc.text(`Expired: ${expiredCount}`, statX + 12.5, statsY, { align: 'center' });

  currentY += cardHeight + 6;

  // Draw Initial Table Header
  currentY = drawTableHeader(currentY);

  // If empty documents list
  if (documents.length === 0) {
    const emptyBoxHeight = 24;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(leftMargin, currentY, contentWidth, emptyBoxHeight, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'No documents available for the selected export criteria.',
      leftMargin + contentWidth / 2,
      currentY + 13,
      { align: 'center' }
    );
  } else {
    // Render document rows
    documents.forEach((docItem, index) => {
      // Split name if too long
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const nameLines = doc.splitTextToSize(docItem.name, 48);
      const rowHeight = Math.max(8.5, 4.5 + nameLines.length * 3.5);

      // Check for page break
      if (currentY + rowHeight > bottomThreshold) {
        doc.addPage();
        drawTopAccentBar();
        currentY = 12;
        currentY = drawTableHeader(currentY);
      }

      // Alternating row background
      const isEven = index % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(leftMargin, currentY, contentWidth, rowHeight, 'FD');

      let colX = leftMargin;

      // Col 1: Document Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(nameLines, colX + 2.5, currentY + 4.8);
      colX += columns[0].width;

      // Col 2: Category
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const catText = doc.splitTextToSize(docItem.category, 31);
      doc.text(catText, colX + 2, currentY + 4.8);
      colX += columns[1].width;

      // Col 3: Status Badge
      const statusPillW = 24;
      const statusPillH = 4.8;
      const pillX = colX + (columns[2].width - statusPillW) / 2;
      const pillY = currentY + (rowHeight - statusPillH) / 2;

      if (docItem.computedStatus === 'Active') {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(167, 243, 208);
        doc.setTextColor(4, 120, 87);
      } else if (docItem.computedStatus === 'Expiring Soon') {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(253, 230, 138);
        doc.setTextColor(180, 83, 9);
      } else {
        doc.setFillColor(254, 226, 226);
        doc.setDrawColor(254, 202, 202);
        doc.setTextColor(185, 28, 28);
      }
      doc.roundedRect(pillX, pillY, statusPillW, statusPillH, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.text(docItem.computedStatus, pillX + statusPillW / 2, pillY + 3.4, {
        align: 'center',
      });
      colX += columns[2].width;

      // Col 4: Remaining Days
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      if (docItem.daysRemaining < 0) {
        doc.setTextColor(185, 28, 28);
        doc.text(
          Math.abs(docItem.daysRemaining) === 1
            ? 'Expired 1d ago'
            : `Expired ${Math.abs(docItem.daysRemaining)}d ago`,
          colX + 2,
          currentY + 4.8
        );
      } else if (docItem.daysRemaining === 0) {
        doc.setTextColor(180, 83, 9);
        doc.text('0 days (Today)', colX + 2, currentY + 4.8);
      } else {
        doc.setTextColor(51, 65, 85);
        doc.text(
          `${docItem.daysRemaining} day${docItem.daysRemaining === 1 ? '' : 's'}`,
          colX + 2,
          currentY + 4.8
        );
      }
      colX += columns[3].width;

      // Col 5: Issue Date
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(docItem.issueDate, colX + 2, currentY + 4.8);
      colX += columns[4].width;

      // Col 6: Expiry Date
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(docItem.expiryDate, colX + 2, currentY + 4.8);

      currentY += rowHeight;
    });
  }

  // Draw Footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Subtle divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(leftMargin, pageHeight - 14, pageWidth - rightMargin, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400

    doc.text('DocuPing – Confidential Document Expiry Vault', leftMargin, pageHeight - 9);
    doc.text(
      `Generated on ${today} · Client-Side Secure Export`,
      pageWidth / 2,
      pageHeight - 9,
      { align: 'center' }
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - rightMargin, pageHeight - 9, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Downloads a generated PDF document directly in the user's browser.
 * Free, client-side, zero paid services, and zero network data transfer.
 */
export function exportDocumentsToPdf(
  documents: EnrichedDocument[],
  options: PdfExportOptions = {}
): void {
  const doc = generatePdfDocument(documents, options);
  const prefix = options.fileNamePrefix || 'docuping-report';
  const today = getTodayIsoLocal();
  const fileName = `${prefix}-${today}.pdf`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    doc.save(fileName);
  }
}
