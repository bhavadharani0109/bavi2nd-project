import { EnrichedDocument } from '../types/document';
import { getTodayIsoLocal } from './expiry';

export interface CalendarDay {
  dateIso: string; // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  documents: EnrichedDocument[];
  hasActive: boolean;
  hasExpiringSoon: boolean;
  hasExpired: boolean;
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Groups documents by their exact expiry date (YYYY-MM-DD).
 */
export function groupDocumentsByExpiryDate(
  documents: EnrichedDocument[]
): Map<string, EnrichedDocument[]> {
  const map = new Map<string, EnrichedDocument[]>();
  for (const doc of documents) {
    if (!doc.expiryDate) continue;
    const existing = map.get(doc.expiryDate) || [];
    existing.push(doc);
    map.set(doc.expiryDate, existing);
  }
  return map;
}

/**
 * Returns a formatted Month & Year string (e.g. "November 2026").
 */
export function formatMonthYear(year: number, monthIndex: number): string {
  const safeMonth = Math.max(0, Math.min(11, monthIndex));
  return `${MONTH_NAMES[safeMonth]} ${year}`;
}

/**
 * Computes previous month and year.
 */
export function getPreviousMonth(
  year: number,
  monthIndex: number
): { year: number; monthIndex: number } {
  if (monthIndex === 0) {
    return { year: year - 1, monthIndex: 11 };
  }
  return { year, monthIndex: monthIndex - 1 };
}

/**
 * Computes next month and year.
 */
export function getNextMonth(
  year: number,
  monthIndex: number
): { year: number; monthIndex: number } {
  if (monthIndex === 11) {
    return { year: year + 1, monthIndex: 0 };
  }
  return { year, monthIndex: monthIndex + 1 };
}

/**
 * Generates the full 35 or 42 grid cells for a given month and year,
 * mapping documents expiring on each date and highlighting Active, Expiring Soon, and Expired states.
 */
export function getCalendarMonthGrid(
  year: number,
  monthIndex: number,
  documents: EnrichedDocument[],
  todayIso: string = getTodayIsoLocal()
): CalendarDay[] {
  const docMap = groupDocumentsByExpiryDate(documents);

  // First day of current month (0-indexed month)
  const firstDay = new Date(year, monthIndex, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Total days in current month
  const daysInCurrentMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Total days in previous month
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarDay[] = [];

  // Helper to format YYYY-MM-DD
  const toIso = (y: number, m: number, d: number) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // 1. Fill previous month's trailing days
  const prevMonthInfo = getPreviousMonth(year, monthIndex);
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateIso = toIso(prevMonthInfo.year, prevMonthInfo.monthIndex, dayNum);
    const dayDocs = docMap.get(dateIso) || [];

    cells.push({
      dateIso,
      dayOfMonth: dayNum,
      isCurrentMonth: false,
      isToday: dateIso === todayIso,
      documents: dayDocs,
      hasActive: dayDocs.some((d) => d.computedStatus === 'Active'),
      hasExpiringSoon: dayDocs.some((d) => d.computedStatus === 'Expiring Soon'),
      hasExpired: dayDocs.some((d) => d.computedStatus === 'Expired'),
    });
  }

  // 2. Fill current month days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dateIso = toIso(year, monthIndex, d);
    const dayDocs = docMap.get(dateIso) || [];

    cells.push({
      dateIso,
      dayOfMonth: d,
      isCurrentMonth: true,
      isToday: dateIso === todayIso,
      documents: dayDocs,
      hasActive: dayDocs.some((d) => d.computedStatus === 'Active'),
      hasExpiringSoon: dayDocs.some((d) => d.computedStatus === 'Expiring Soon'),
      hasExpired: dayDocs.some((d) => d.computedStatus === 'Expired'),
    });
  }

  // 3. Fill next month's leading days to complete full weeks (multiples of 7: 35 or 42)
  const nextMonthInfo = getNextMonth(year, monthIndex);
  const remainingCells = (7 - (cells.length % 7)) % 7;
  // If we only have 28 or 35 cells, keep it neat
  const targetTotal = cells.length + remainingCells < 35 ? 35 : cells.length + remainingCells;
  const extraNeeded = targetTotal - cells.length;

  for (let d = 1; d <= extraNeeded; d++) {
    const dateIso = toIso(nextMonthInfo.year, nextMonthInfo.monthIndex, d);
    const dayDocs = docMap.get(dateIso) || [];

    cells.push({
      dateIso,
      dayOfMonth: d,
      isCurrentMonth: false,
      isToday: dateIso === todayIso,
      documents: dayDocs,
      hasActive: dayDocs.some((d) => d.computedStatus === 'Active'),
      hasExpiringSoon: dayDocs.some((d) => d.computedStatus === 'Expiring Soon'),
      hasExpired: dayDocs.some((d) => d.computedStatus === 'Expired'),
    });
  }

  return cells;
}
