import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileCheck2,
  FilePlus2,
  Pencil,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { EnrichedDocument } from '../types/document';
import {
  CalendarDay,
  DAY_NAMES,
  formatMonthYear,
  getCalendarMonthGrid,
  getNextMonth,
  getPreviousMonth,
} from '../utils/calendar';
import {
  formatCountdownLabel,
  formatDisplayDate,
  getTodayIsoLocal,
} from '../utils/expiry';
import { StatusIndicator } from './StatusIndicator';

interface ExpiryCalendarViewProps {
  documents: EnrichedDocument[];
  onViewDocument: (doc: EnrichedDocument) => void;
  onEditDocument: (doc: EnrichedDocument) => void;
  onRecordRenewal: (doc: EnrichedDocument) => void;
  onAddNewDocument: () => void;
}

export function ExpiryCalendarView({
  documents,
  onViewDocument,
  onEditDocument,
  onRecordRenewal,
  onAddNewDocument,
}: ExpiryCalendarViewProps) {
  const today = getTodayIsoLocal();
  const todayDate = new Date();

  // Current viewed month and year state
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(
    todayDate.getMonth()
  );

  // Selected date on the calendar (defaults to today or first expiring date)
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Compute month cells
  const monthGrid = useMemo(() => {
    return getCalendarMonthGrid(
      currentYear,
      currentMonthIndex,
      documents,
      today
    );
  }, [currentYear, currentMonthIndex, documents, today]);

  // Documents expiring in the currently viewed month
  const viewedMonthDocuments = useMemo(() => {
    const yyyy = currentYear;
    const mm = String(currentMonthIndex + 1).padStart(2, '0');
    const monthPrefix = `${yyyy}-${mm}`;
    return documents.filter((d) => d.expiryDate.startsWith(monthPrefix));
  }, [documents, currentYear, currentMonthIndex]);

  // Documents expiring on the selected date
  const selectedDateDocuments = useMemo(() => {
    return documents.filter((d) => d.expiryDate === selectedDate);
  }, [documents, selectedDate]);

  // Month-wise navigation handlers
  const handlePrevMonth = () => {
    const prev = getPreviousMonth(currentYear, currentMonthIndex);
    setCurrentYear(prev.year);
    setCurrentMonthIndex(prev.monthIndex);
  };

  const handleNextMonth = () => {
    const next = getNextMonth(currentYear, currentMonthIndex);
    setCurrentYear(next.year);
    setCurrentMonthIndex(next.monthIndex);
  };

  const handleJumpToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
    setSelectedDate(today);
  };

  // Month aggregates
  const monthCounts = {
    total: viewedMonthDocuments.length,
    active: viewedMonthDocuments.filter((d) => d.computedStatus === 'Active')
      .length,
    expiringSoon: viewedMonthDocuments.filter(
      (d) => d.computedStatus === 'Expiring Soon'
    ).length,
    expired: viewedMonthDocuments.filter((d) => d.computedStatus === 'Expired')
      .length,
  };

  return (
    <section className="space-y-6">
      {/* Calendar Controls & Month Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatMonthYear(currentYear, currentMonthIndex)}
                </h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {monthCounts.total}{' '}
                  {monthCounts.total === 1 ? 'deadline' : 'deadlines'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track and inspect upcoming document renewals by calendar date
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleJumpToday}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-xs"
            >
              Today
            </button>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs overflow-hidden">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                title="View previous month"
                className="h-9 px-3 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 transition-colors cursor-pointer inline-flex items-center"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs font-medium ml-1 hidden sm:inline">
                  Prev
                </span>
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                title="View next month"
                className="h-9 px-3 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer inline-flex items-center"
              >
                <span className="text-xs font-medium mr-1 hidden sm:inline">
                  Next
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Legend & Month Summary Pills */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 dark:text-slate-500 font-medium mr-1">Status:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Active ({monthCounts.active})</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Expiring Soon ({monthCounts.expiringSoon})</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/80 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Expired ({monthCounts.expired})</span>
            </span>
          </div>

          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Click any calendar day to inspect expiring documents
          </span>
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        {/* Day-of-week header row */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 py-2.5">
          {DAY_NAMES.map((day) => (
            <div key={day} className="tracking-wider uppercase text-[11px]">
              {day}
            </div>
          ))}
        </div>

        {/* 7-column calendar cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800 bg-slate-100/50 dark:bg-slate-800/50">
          {monthGrid.map((cell: CalendarDay) => {
            const isSelected = cell.dateIso === selectedDate;
            const docCount = cell.documents.length;

            return (
              <div
                key={cell.dateIso}
                onClick={() => setSelectedDate(cell.dateIso)}
                className={`min-h-[75px] sm:min-h-[105px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between ${
                  cell.isCurrentMonth
                    ? 'bg-white dark:bg-slate-900 hover:bg-blue-50/40 dark:hover:bg-blue-950/30'
                    : 'bg-slate-50/70 dark:bg-slate-950/60 text-slate-400 dark:text-slate-600 hover:bg-slate-100/60 dark:hover:bg-slate-900/60'
                } ${
                  isSelected
                    ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/60 dark:bg-blue-950/50 z-10'
                    : ''
                }`}
              >
                {/* Cell Top Header (Day number & Badges) */}
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-xs font-bold w-6 h-6 rounded-full inline-flex items-center justify-center tabular-nums ${
                      cell.isToday
                        ? 'bg-blue-700 text-white shadow-xs'
                        : isSelected
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                        : cell.isCurrentMonth
                        ? 'text-slate-800 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {cell.dayOfMonth}
                  </span>

                  {docCount > 0 && (
                    <div className="flex items-center gap-1">
                      {/* Mobile colored status dot indicators */}
                      <div className="flex items-center -space-x-1 sm:hidden">
                        {cell.hasActive && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900" />
                        )}
                        {cell.hasExpiringSoon && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 border border-white dark:border-slate-900" />
                        )}
                        {cell.hasExpired && (
                          <span className="w-2 h-2 rounded-full bg-red-500 border border-white dark:border-slate-900" />
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                        {docCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* Desktop: Document Title Pills */}
                <div className="hidden sm:flex flex-col gap-1 mt-1">
                  {cell.documents.slice(0, 2).map((doc) => {
                    const statusClass =
                      doc.computedStatus === 'Active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : doc.computedStatus === 'Expiring Soon'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';

                    return (
                      <div
                        key={doc.id}
                        title={`${doc.name} (${doc.category}) · ${doc.computedStatus}`}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${statusClass}`}
                      >
                        {doc.name}
                      </div>
                    );
                  })}
                  {docCount > 2 && (
                    <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 font-semibold px-1">
                      +{docCount - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Documents Expiring on {formatDisplayDate(selectedDate)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedDate === today ? 'Today · ' : ''}
                {selectedDateDocuments.length}{' '}
                {selectedDateDocuments.length === 1 ? 'document' : 'documents'}{' '}
                scheduled for expiry
              </p>
            </div>
          </div>

          {selectedDateDocuments.length > 0 && (
            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {selectedDateDocuments.length} Expiry Deadline
              {selectedDateDocuments.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {selectedDateDocuments.length === 0 ? (
          <div className="py-8 text-center max-w-sm mx-auto">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No documents expiring on this date
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              No personal vault documents have an expiry date set for{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                {selectedDate}
              </span>
              . Select a date with colored badges to view expiring files.
            </p>
            <button
              type="button"
              onClick={onAddNewDocument}
              className="mt-4 h-8 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Track New Document</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {selectedDateDocuments.map((doc) => (
              <div
                key={doc.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors rounded-lg px-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewDocument(doc)}
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 truncate text-left cursor-pointer"
                    >
                      {doc.name}
                    </button>
                    <StatusIndicator status={doc.computedStatus} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {doc.category} ·{' '}
                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      Issued {formatDisplayDate(doc.issueDate)}
                    </span>{' '}
                    ·{' '}
                    <span
                      className={`font-mono tabular-nums font-medium ${
                        doc.computedStatus === 'Expired'
                          ? 'text-red-700 dark:text-red-400'
                          : doc.computedStatus === 'Expiring Soon'
                          ? 'text-amber-800 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatCountdownLabel(doc.daysRemaining)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onViewDocument(doc)}
                    aria-label={`Preview ${doc.name}`}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View / Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRecordRenewal(doc)}
                    aria-label={`Record renewal for ${doc.name}`}
                    className="h-8 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-xs font-semibold text-blue-700 dark:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Renew</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditDocument(doc)}
                    aria-label={`Edit ${doc.name}`}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
