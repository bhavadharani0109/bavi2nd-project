import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderKanban,
  PieChart,
} from 'lucide-react';
import { ExpiryStatus } from '../types/document';
import { DashboardAnalyticsData } from '../utils/analytics';

interface DashboardAnalyticsProps {
  analytics: DashboardAnalyticsData;
  loading: boolean;
  onSelectStatus: (status: ExpiryStatus) => void;
  onSelectCategory: (category: string) => void;
}

const STATUS_CHART_STYLES: Record<
  ExpiryStatus,
  {
    stroke: string;
    hoverStroke: string;
    barClass: string;
    textClass: string;
    rangeLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  Active: {
    stroke: '#16a34a',
    hoverStroke: '#15803d',
    barClass: 'bg-emerald-600',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    rangeLabel: '> 30 days left',
    icon: CheckCircle2,
  },
  'Expiring Soon': {
    stroke: '#d97706',
    hoverStroke: '#b45309',
    barClass: 'bg-amber-500',
    textClass: 'text-amber-800 dark:text-amber-400',
    rangeLabel: '0–30 days left',
    icon: Clock,
  },
  Expired: {
    stroke: '#dc2626',
    hoverStroke: '#b91c1c',
    barClass: 'bg-red-600',
    textClass: 'text-red-700 dark:text-red-400',
    rangeLabel: 'Past expiry',
    icon: AlertTriangle,
  },
};

export function DashboardAnalytics({
  analytics,
  loading,
  onSelectStatus,
  onSelectCategory,
}: DashboardAnalyticsProps) {
  const [hoveredStatus, setHoveredStatus] = useState<ExpiryStatus | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  const activeSegment = hoveredStatus
    ? analytics.statusSegments.find((s) => s.status === hoveredStatus) || null
    : null;

  const visibleCategories = showAllCategories
    ? analytics.allCategories
    : analytics.populatedCategories;

  // Precompute cumulative arc offsets for SVG donut segments
  let cumulativeFraction = 0;
  const chartArcs = analytics.statusSegments
    .filter((seg) => seg.count > 0 && analytics.total > 0)
    .map((seg) => {
      const fraction = seg.count / analytics.total;
      const dashLength = fraction * circumference;
      const dashOffset = -cumulativeFraction * circumference;
      cumulativeFraction += fraction;
      return {
        ...seg,
        dashLength,
        dashOffset,
      };
    });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
      {/* Document Status Visual Chart */}
      <section
        aria-label="Document status analytics"
        className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center shrink-0">
              <PieChart className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                Document Status Chart
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live proportion across expiry states
              </p>
            </div>
          </div>
          {!loading && analytics.total > 0 && (
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
              {analytics.total} total
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-6 flex-1 flex flex-col justify-center gap-5 animate-pulse">
            <div className="w-40 h-40 rounded-full border-[18px] border-slate-100 dark:border-slate-800 mx-auto" />
            <div className="space-y-2.5">
              <div className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        ) : analytics.total === 0 ? (
          <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
            <svg
              viewBox="0 0 160 160"
              className="w-36 h-36 mb-3 text-slate-200 dark:text-slate-700"
              aria-hidden="true"
            >
              <circle
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                strokeDasharray="6 6"
              />
              <text
                x="80"
                y="77"
                textAnchor="middle"
                className="fill-slate-400 dark:fill-slate-500 font-display text-xl font-bold"
              >
                0
              </text>
              <text
                x="80"
                y="95"
                textAnchor="middle"
                className="fill-slate-400 dark:fill-slate-500 text-[11px]"
              >
                Documents
              </text>
            </svg>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No status chart data yet
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
              Add documents to visualize your Active, Expiring Soon, and Expired
              breakdown in real time.
            </p>
          </div>
        ) : (
          <div className="p-6 flex-1 flex flex-col justify-between gap-5">
            <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-6">
              {/* Interactive SVG Donut Chart */}
              <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                <svg
                  viewBox="0 0 180 180"
                  className="w-full h-full"
                  role="img"
                  aria-label={`Document status chart: ${analytics.active} Active, ${analytics.expiringSoon} Expiring Soon, ${analytics.expired} Expired out of ${analytics.total} total documents.`}
                >
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    className="dark:stroke-slate-800"
                    strokeWidth="20"
                  />
                  <g transform="rotate(-90 90 90)">
                    {chartArcs.map((arc) => {
                      const style = STATUS_CHART_STYLES[arc.status];
                      const isHovered = hoveredStatus === arc.status;
                      return (
                        <circle
                          key={arc.status}
                          cx="90"
                          cy="90"
                          r={radius}
                          fill="none"
                          stroke={isHovered ? style.hoverStroke : style.stroke}
                          strokeWidth={isHovered ? 23 : 20}
                          strokeDasharray={`${arc.dashLength} ${circumference}`}
                          strokeDashoffset={arc.dashOffset}
                          className="transition-all duration-150 cursor-pointer"
                          onMouseEnter={() => setHoveredStatus(arc.status)}
                          onMouseLeave={() => setHoveredStatus(null)}
                          onClick={() => onSelectStatus(arc.status)}
                        >
                          <title>
                            {`${arc.status}: ${arc.count} (${arc.percentage}%) — Click to filter`}
                          </title>
                        </circle>
                      );
                    })}
                  </g>
                </svg>

                {/* Center Metric Readout */}
                <div className="inset-0 absolute flex flex-col items-center justify-center pointer-events-none px-4 text-center">
                  <span className="font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none">
                    {activeSegment ? activeSegment.count : analytics.total}
                  </span>
                  <span className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight max-w-[92px] truncate">
                    {activeSegment
                      ? `${activeSegment.status} · ${activeSegment.percentage}%`
                      : analytics.total === 1
                      ? 'Document'
                      : 'Documents'}
                  </span>
                </div>
              </div>

              {/* Interactive Status Legend */}
              <div className="w-full flex-1 space-y-1.5">
                {analytics.statusSegments.map((seg) => {
                  const cfg = STATUS_CHART_STYLES[seg.status];
                  const Icon = cfg.icon;
                  const isHighlighted = hoveredStatus === seg.status;
                  return (
                    <button
                      key={seg.status}
                      type="button"
                      onMouseEnter={() => setHoveredStatus(seg.status)}
                      onMouseLeave={() => setHoveredStatus(null)}
                      onFocus={() => setHoveredStatus(seg.status)}
                      onBlur={() => setHoveredStatus(null)}
                      onClick={() => onSelectStatus(seg.status)}
                      className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isHighlighted ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${cfg.textClass}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {seg.status}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {cfg.rangeLabel}
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs tabular-nums shrink-0">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {seg.count}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 ml-1.5">
                          ({seg.percentage}%)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linear Segmented Proportion Bar */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div
                className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex"
                aria-hidden="true"
              >
                {analytics.statusSegments.map((seg) => {
                  if (seg.count === 0) return null;
                  const cfg = STATUS_CHART_STYLES[seg.status];
                  return (
                    <div
                      key={seg.status}
                      style={{
                        width: `${(seg.count / analytics.total) * 100}%`,
                      }}
                      className={`${cfg.barClass} h-full transition-all duration-200`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select any status segment to filter your Document Vault.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Category-Wise Document Summary */}
      <section
        aria-label="Category-wise document summary"
        className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center shrink-0">
              <FolderKanban
                className="w-4 h-4 text-blue-700 dark:text-blue-400"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                Category-Wise Summary
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Document counts and status health by category
              </p>
            </div>
          </div>

          {!loading && analytics.total > 0 && (
            <div
              className="inline-flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg"
              role="group"
              aria-label="Category display scope"
            >
              <button
                type="button"
                onClick={() => setShowAllCategories(false)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  !showAllCategories
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Active ({analytics.populatedCategories.length})
              </button>
              <button
                type="button"
                onClick={() => setShowAllCategories(true)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  showAllCategories
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({analytics.allCategories.length})
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 animate-pulse flex-1">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="px-6 py-4 space-y-2">
                <div className="flex justify-between">
                  <div className="h-3.5 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3.5 w-16 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : analytics.total === 0 ? (
          <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
            <FolderKanban
              className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2.5"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No category breakdown available
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Categorize documents under Identity &amp; Travel, Insurance,
              Contracts &amp; Legal, Certifications, and more to compare counts
              and expiry readiness across categories.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 flex-1 max-h-[340px] overflow-y-auto">
            {visibleCategories.map((row) => {
              const barScalePercent =
                row.total > 0
                  ? Math.max(
                      4,
                      Math.round((row.total / analytics.maxCategoryCount) * 100)
                    )
                  : 0;

              return (
                <button
                  key={row.category}
                  type="button"
                  onClick={() => onSelectCategory(row.category)}
                  className="w-full px-6 py-3.5 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer block"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {row.category}
                    </span>
                    <div className="font-mono text-xs tabular-nums shrink-0">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.total}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 ml-1">
                        {row.total === 1 ? 'doc' : 'docs'}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 ml-1.5">
                        ({row.percentage}%)
                      </span>
                    </div>
                  </div>

                  {/* Proportional Stacked Status Bar */}
                  <div
                    className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                    aria-hidden="true"
                  >
                    {row.total > 0 && (
                      <div
                        style={{ width: `${barScalePercent}%` }}
                        className="h-full flex rounded-full overflow-hidden transition-all duration-200"
                      >
                        {row.active > 0 && (
                          <div
                            style={{
                              width: `${(row.active / row.total) * 100}%`,
                            }}
                            className="bg-emerald-600 h-full"
                          />
                        )}
                        {row.expiringSoon > 0 && (
                          <div
                            style={{
                              width: `${(row.expiringSoon / row.total) * 100}%`,
                            }}
                            className="bg-amber-500 h-full"
                          />
                        )}
                        {row.expired > 0 && (
                          <div
                            style={{
                              width: `${(row.expired / row.total) * 100}%`,
                            }}
                            className="bg-red-600 h-full"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Unboxed Tabular Status Counts */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    <span
                      className={
                        row.active > 0 ? 'text-emerald-700 dark:text-emerald-400 font-medium' : ''
                      }
                    >
                      {row.active} Active
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span
                      className={
                        row.expiringSoon > 0
                          ? 'text-amber-800 dark:text-amber-400 font-medium'
                          : ''
                      }
                    >
                      {row.expiringSoon} Expiring Soon
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span
                      className={
                        row.expired > 0 ? 'text-red-700 dark:text-red-400 font-medium' : ''
                      }
                    >
                      {row.expired} Expired
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
