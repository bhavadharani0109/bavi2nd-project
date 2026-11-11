import React from 'react';
import {
  Download,
  Eye,
  FileCheck2,
  FileImage,
  FilePlus2,
  FileText,
  Link2,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  EnrichedDocument,
  FormatFilter,
  SortField,
  StatusFilter,
} from '../types/document';
import {
  formatCountdownLabel,
  formatDisplayDate,
  formatFileSize,
  getShortFormatLabel,
} from '../utils/expiry';
import { StatusIndicator } from './StatusIndicator';

interface DocumentTableProps {
  title: string;
  allDocuments: EnrichedDocument[];
  filteredDocuments: EnrichedDocument[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (s: StatusFilter) => void;
  hideStatusTabs?: boolean;
  categoryFilter: string;
  onCategoryFilterChange: (c: string) => void;
  formatFilter: FormatFilter;
  onFormatFilterChange: (f: FormatFilter) => void;
  sortField: SortField;
  onSortFieldChange: (s: SortField) => void;
  onResetFilters: () => void;
  onExportCsv: (scope?: 'all' | 'filtered') => void;
  onExportPdf?: (scope?: 'all' | 'filtered') => void;
  onUploadClick: () => void;
  onViewDocument: (doc: EnrichedDocument) => void;
  onEditDocument: (doc: EnrichedDocument) => void;
  onDeleteDocument: (doc: EnrichedDocument) => void;
  onRecordRenewal?: (doc: EnrichedDocument) => void;
}

export function DocumentTable({
  title,
  allDocuments,
  filteredDocuments,
  loading,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  hideStatusTabs = false,
  categoryFilter,
  onCategoryFilterChange,
  formatFilter,
  onFormatFilterChange,
  sortField,
  onSortFieldChange,
  onResetFilters,
  onExportCsv,
  onExportPdf,
  onUploadClick,
  onViewDocument,
  onEditDocument,
  onDeleteDocument,
  onRecordRenewal,
}: DocumentTableProps) {
  const counts = {
    All: allDocuments.length,
    Active: allDocuments.filter((d) => d.computedStatus === 'Active').length,
    'Expiring Soon': allDocuments.filter(
      (d) => d.computedStatus === 'Expiring Soon'
    ).length,
    Expired: allDocuments.filter((d) => d.computedStatus === 'Expired').length,
  };

  const hasSearch = searchQuery.trim().length > 0;
  const hasStatusFilter = !hideStatusTabs && statusFilter !== 'All';
  const hasCategoryFilter = categoryFilter !== 'All';
  const hasFormatFilter = formatFilter !== 'All';
  const hasActiveFilters =
    hasSearch || hasStatusFilter || hasCategoryFilter || hasFormatFilter;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header & Controls */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {filteredDocuments.length}{' '}
              {filteredDocuments.length === 1 ? 'document' : 'documents'}
              {hasActiveFilters && allDocuments.length > 0 && (
                <span className="text-slate-400 dark:text-slate-500 font-sans ml-1">
                  (filtered from {allDocuments.length})
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear filters</span>
              </button>
            )}
            {/* Export CSV Button (supports all documents or filtered documents) */}
            {hasActiveFilters &&
            allDocuments.length > filteredDocuments.length ? (
              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => onExportCsv('filtered')}
                  disabled={filteredDocuments.length === 0 || loading}
                  title={`Download ${filteredDocuments.length} filtered document(s) as CSV`}
                  className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer border-r border-slate-200 dark:border-slate-700 disabled:opacity-45"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span>Export CSV ({filteredDocuments.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExportCsv('all')}
                  disabled={allDocuments.length === 0 || loading}
                  title={`Download all ${allDocuments.length} document(s) in personal vault as CSV`}
                  className="h-9 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
                >
                  <span>All ({allDocuments.length})</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onExportCsv('all')}
                disabled={allDocuments.length === 0 || loading}
                title="Download all documents as a CSV file"
                className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-45 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span>Export CSV ({allDocuments.length})</span>
              </button>
            )}

            {/* Export PDF Button (supports all documents or filtered documents) */}
            {onExportPdf &&
              (hasActiveFilters &&
              allDocuments.length > filteredDocuments.length ? (
                <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onExportPdf('filtered')}
                    disabled={filteredDocuments.length === 0 || loading}
                    title={`Download ${filteredDocuments.length} filtered document(s) as PDF report`}
                    className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer border-r border-slate-200 dark:border-slate-700 disabled:opacity-45"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Export PDF ({filteredDocuments.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onExportPdf('all')}
                    disabled={allDocuments.length === 0 || loading}
                    title={`Download all ${allDocuments.length} document(s) in personal vault as PDF report`}
                    className="h-9 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
                  >
                    <span>All ({allDocuments.length})</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onExportPdf('all')}
                  disabled={allDocuments.length === 0 || loading}
                  title="Download executive PDF audit report"
                  className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-45 cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Export PDF ({allDocuments.length})</span>
                </button>
              ))}
          </div>
        </div>

        {/* Status Segmented Filter Tabs: All, Active, Expiring Soon, Expired */}
        {!hideStatusTabs && (
          <div
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg"
            role="tablist"
            aria-label="Filter documents by expiry status"
          >
            {(['All', 'Active', 'Expiring Soon', 'Expired'] as StatusFilter[]).map(
              (tab) => {
                const active = statusFilter === tab;
                const dotColor =
                  tab === 'Active'
                    ? 'bg-emerald-500'
                    : tab === 'Expiring Soon'
                    ? 'bg-amber-500'
                    : tab === 'Expired'
                    ? 'bg-red-500'
                    : null;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onStatusFilterChange(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {dotColor && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
                        aria-hidden="true"
                      />
                    )}
                    <span>{tab}</span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        active ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {counts[tab]}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        )}

        {/* Search, Category, Format & Sort Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Document Search Bar */}
          <div className="lg:col-span-5 relative">
            <Search
              className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  onSearchChange('');
                }
              }}
              placeholder="Search by document name..."
              aria-label="Search documents by name"
              className={`w-full h-9 pl-9 pr-8 rounded-lg border bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                hasSearch
                  ? 'border-blue-400 dark:border-blue-500 focus:border-blue-600'
                  : 'border-slate-200 dark:border-slate-700 focus:border-blue-600'
              }`}
            />
            {hasSearch && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear document search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              aria-label="Filter documents by category"
              className={`w-full h-9 px-3 rounded-lg border bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 ${
                hasCategoryFilter
                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 font-medium text-blue-900 dark:text-blue-200'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <option value="All">All Categories</option>
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Format Filter */}
          <div className="lg:col-span-2">
            <select
              value={formatFilter}
              onChange={(e) =>
                onFormatFilterChange(e.target.value as FormatFilter)
              }
              aria-label="Filter documents by file type"
              className={`w-full h-9 px-3 rounded-lg border bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 ${
                hasFormatFilter
                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 font-medium text-blue-900 dark:text-blue-200'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <option value="All">All Types</option>
              <option value="Metadata">Metadata Only</option>
              <option value="Link">External Link</option>
              <option value="PDF">PDF</option>
              <option value="JPG">JPG</option>
              <option value="PNG">PNG</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="lg:col-span-2">
            <select
              value={sortField}
              onChange={(e) => onSortFieldChange(e.target.value as SortField)}
              aria-label="Sort documents"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
            >
              <option value="expiryAsc">Expiry: Soonest</option>
              <option value="expiryDesc">Expiry: Latest</option>
              <option value="nameAsc">Name: A to Z</option>
              <option value="recentDesc">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips Bar (Visual feedback that search and filters work together) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-1">
              Active filters:
            </span>
            {hasSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-[11px] font-medium">
                <span>Name: &ldquo;{searchQuery.trim()}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear name search filter"
                  className="hover:text-blue-950 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {hasStatusFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-[11px] font-medium">
                <span>Status: {statusFilter}</span>
                <button
                  type="button"
                  onClick={() => onStatusFilterChange('All')}
                  aria-label="Clear status filter"
                  className="hover:text-blue-950 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {hasCategoryFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-[11px] font-medium">
                <span>Category: {categoryFilter}</span>
                <button
                  type="button"
                  onClick={() => onCategoryFilterChange('All')}
                  aria-label="Clear category filter"
                  className="hover:text-blue-950 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {hasFormatFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-[11px] font-medium">
                <span>Type: {formatFilter}</span>
                <button
                  type="button"
                  onClick={() => onFormatFilterChange('All')}
                  aria-label="Clear file format filter"
                  className="hover:text-blue-950 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:underline cursor-pointer ml-1"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Loading Skeleton State */}
      {loading ? (
        <div className="divide-y divide-slate-200 dark:divide-slate-800" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="px-6 h-14 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="h-3.5 w-48 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3.5 w-28 rounded bg-slate-100 dark:bg-slate-800 hidden sm:block" />
              <div className="h-3.5 w-24 rounded bg-slate-100 dark:bg-slate-800 hidden md:block" />
              <div className="h-3.5 w-24 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3.5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : allDocuments.length === 0 ? (
        /* Empty Vault State */
        <div className="px-6 py-14 text-center">
          <FilePlus2 className="w-9 h-9 text-blue-700 dark:text-blue-400 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            No documents in your vault yet
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Add your first document record to automatically calculate its expiry
            status and receive upcoming renewal alerts.
          </p>
          <button
            type="button"
            onClick={onUploadClick}
            className="mt-5 h-10 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Add First Document</span>
          </button>
        </div>
      ) : filteredDocuments.length === 0 ? (
        /* Friendly Empty State When No Documents Match Search/Filter */
        <div className="px-6 py-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            No matching documents found
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {hasSearch ? (
              <>
                No documents found matching &ldquo;
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {searchQuery.trim()}
                </span>
                &rdquo;
                {hasCategoryFilter ? ` in ${categoryFilter}` : ''}
                {hasStatusFilter ? ` with status ${statusFilter}` : ''}.
              </>
            ) : hasCategoryFilter || hasStatusFilter || hasFormatFilter ? (
              <>
                No documents match your active filters
                {hasCategoryFilter ? ` (${categoryFilter})` : ''}
                {hasStatusFilter ? ` (${statusFilter})` : ''}
                {hasFormatFilter ? ` (${formatFilter})` : ''}.
              </>
            ) : (
              'Try checking for typos or searching with different keywords.'
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="h-9 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Search &amp; Filters</span>
              </button>
            )}
            {hasActiveFilters && allDocuments.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => onExportCsv('all')}
                  className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span>Export All CSV ({allDocuments.length})</span>
                </button>
                {onExportPdf && (
                  <button
                    type="button"
                    onClick={() => onExportPdf('all')}
                    className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Export All PDF ({allDocuments.length})</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onUploadClick}
              className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Add New Document</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop High-Density Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pl-6 pr-3">Document</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Issue Date</th>
                  <th className="py-2.5 px-3">Expiry &amp; Remaining Days</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filteredDocuments.map((doc) => {
                  const isPdf = doc.fileType === 'application/pdf';
                  const isImage =
                    doc.fileType === 'image/jpeg' ||
                    doc.fileType === 'image/png';
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors group"
                    >
                      <td className="py-3 pl-6 pr-3 max-w-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {isPdf ? (
                            <FileText
                              className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0"
                              aria-hidden="true"
                            />
                          ) : isImage ? (
                            <FileImage
                              className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0"
                              aria-hidden="true"
                            />
                          ) : doc.fileUrl ? (
                            <Link2
                              className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <FileCheck2
                              className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onViewDocument(doc)}
                              className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 truncate block text-left max-w-full cursor-pointer"
                            >
                              {doc.name}
                            </button>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
                              {doc.fileType
                                ? `${getShortFormatLabel(doc.fileType)} · ${formatFileSize(doc.fileSize)} · ${doc.fileName}`
                                : doc.fileUrl
                                ? `External Link · ${doc.fileUrl}`
                                : 'Firestore Record · Tracked metadata'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {doc.category}
                      </td>

                      <td className="py-3 px-3 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDisplayDate(doc.issueDate)}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100">
                          {formatDisplayDate(doc.expiryDate)}
                        </div>
                        <div
                          className={`font-mono text-[11px] tabular-nums ${
                            doc.computedStatus === 'Expired'
                              ? 'text-red-700 dark:text-red-400'
                              : doc.computedStatus === 'Expiring Soon'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {formatCountdownLabel(doc.daysRemaining)}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusIndicator status={doc.computedStatus} />
                      </td>

                      <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {Boolean(doc.fileUrl?.trim()) ? (
                            <button
                              type="button"
                              onClick={() => onViewDocument(doc)}
                              title="Preview external document"
                              aria-label={`Preview ${doc.name}`}
                              className="h-8 px-2.5 rounded-md text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-900 dark:hover:text-blue-200 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onViewDocument(doc)}
                              title="View document details"
                              aria-label={`View ${doc.name}`}
                              className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50/70 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          )}
                          {onRecordRenewal && (
                            <button
                              type="button"
                              onClick={() => onRecordRenewal(doc)}
                              title="Record renewal"
                              aria-label={`Record renewal for ${doc.name}`}
                              className="h-8 px-2.5 rounded-md text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 hover:text-emerald-900 dark:hover:text-emerald-200 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Renew</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditDocument(doc)}
                            title="Edit document"
                            aria-label={`Edit ${doc.name}`}
                            className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50/70 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteDocument(doc)}
                            title="Delete document"
                            aria-label={`Delete ${doc.name}`}
                            className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Small Tablet Stacked List */}
          <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="p-4 space-y-2.5 bg-white dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onViewDocument(doc)}
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 text-left truncate block max-w-full cursor-pointer"
                    >
                      {doc.name}
                    </button>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {doc.category} ·{' '}
                      {doc.fileType
                        ? `${getShortFormatLabel(doc.fileType)} (${formatFileSize(doc.fileSize)})`
                        : doc.fileUrl
                        ? 'External Link'
                        : 'Firestore Record'}
                    </p>
                  </div>
                  <StatusIndicator status={doc.computedStatus} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  <span>Issued {formatDisplayDate(doc.issueDate)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Expires {formatDisplayDate(doc.expiryDate)}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      doc.computedStatus === 'Expired'
                        ? 'text-red-700 dark:text-red-400 font-medium'
                        : doc.computedStatus === 'Expiring Soon'
                        ? 'text-amber-700 dark:text-amber-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400'
                    }
                  >
                    {formatCountdownLabel(doc.daysRemaining)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {Boolean(doc.fileUrl?.trim()) ? (
                    <button
                      type="button"
                      onClick={() => onViewDocument(doc)}
                      className="h-9 px-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-900 dark:hover:text-blue-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onViewDocument(doc)}
                      className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  )}
                  {onRecordRenewal && (
                    <button
                      type="button"
                      onClick={() => onRecordRenewal(doc)}
                      className="h-9 px-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/50 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 hover:text-emerald-900 dark:hover:text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Renew</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onEditDocument(doc)}
                    className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDocument(doc)}
                    className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
