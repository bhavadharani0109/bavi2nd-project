import {
  DOCUMENT_CATEGORIES,
  EnrichedDocument,
  ExpiryStatus,
} from '../types/document';

export interface StatusSegmentSummary {
  status: ExpiryStatus;
  count: number;
  percentage: number;
}

export interface CategorySummaryRow {
  category: string;
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  urgent: number;
  percentage: number;
}

export interface DashboardAnalyticsData {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  statusSegments: StatusSegmentSummary[];
  allCategories: CategorySummaryRow[];
  populatedCategories: CategorySummaryRow[];
  maxCategoryCount: number;
}

/**
 * Computes integer percentages summing to 100% using the Largest Remainder Method
 * when total > 0, or all zeros when total === 0.
 */
export function computeApportionedPercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, n) => sum + Math.max(0, n), 0);
  if (total === 0) {
    return counts.map(() => 0);
  }

  const exact = counts.map((c) => (Math.max(0, c) / total) * 100);
  const floored = exact.map((v) => Math.floor(v));
  let remainder = 100 - floored.reduce((sum, v) => sum + v, 0);

  const ranked = exact
    .map((val, idx) => ({ idx, frac: val - floored[idx] }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx);

  for (let i = 0; i < remainder && i < ranked.length; i++) {
    floored[ranked[i].idx] += 1;
  }

  return floored;
}

/**
 * Computes all real-time dashboard KPI totals, status chart proportions,
 * and category-wise breakdown metrics from the user's enriched documents.
 */
export function computeDashboardAnalytics(
  documents: EnrichedDocument[]
): DashboardAnalyticsData {
  let active = 0;
  let expiringSoon = 0;
  let expired = 0;

  const categoryMap = new Map<
    string,
    { active: number; expiringSoon: number; expired: number }
  >();

  for (const cat of DOCUMENT_CATEGORIES) {
    categoryMap.set(cat, { active: 0, expiringSoon: 0, expired: 0 });
  }

  for (const doc of documents) {
    let bucket = categoryMap.get(doc.category);
    if (!bucket) {
      bucket = { active: 0, expiringSoon: 0, expired: 0 };
      categoryMap.set(doc.category, bucket);
    }

    if (doc.computedStatus === 'Active') {
      active += 1;
      bucket.active += 1;
    } else if (doc.computedStatus === 'Expiring Soon') {
      expiringSoon += 1;
      bucket.expiringSoon += 1;
    } else {
      expired += 1;
      bucket.expired += 1;
    }
  }

  const total = documents.length;
  const [activePct, soonPct, expiredPct] = computeApportionedPercentages([
    active,
    expiringSoon,
    expired,
  ]);

  const statusSegments: StatusSegmentSummary[] = [
    { status: 'Active', count: active, percentage: activePct },
    { status: 'Expiring Soon', count: expiringSoon, percentage: soonPct },
    { status: 'Expired', count: expired, percentage: expiredPct },
  ];

  const rawCategories = Array.from(categoryMap.entries()).map(
    ([category, counts]) => {
      const catTotal = counts.active + counts.expiringSoon + counts.expired;
      return {
        category,
        total: catTotal,
        active: counts.active,
        expiringSoon: counts.expiringSoon,
        expired: counts.expired,
        urgent: counts.expiringSoon + counts.expired,
      };
    }
  );

  const catPercentages = computeApportionedPercentages(
    rawCategories.map((c) => c.total)
  );

  const allCategories: CategorySummaryRow[] = rawCategories
    .map((row, idx) => ({
      ...row,
      percentage: catPercentages[idx],
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.urgent - a.urgent ||
        a.category.localeCompare(b.category)
    );

  const populatedCategories = allCategories.filter((c) => c.total > 0);
  const maxCategoryCount = Math.max(
    1,
    ...allCategories.map((c) => c.total)
  );

  return {
    total,
    active,
    expiringSoon,
    expired,
    statusSegments,
    allCategories,
    populatedCategories,
    maxCategoryCount,
  };
}

/**
 * Returns upcoming non-expired documents sorted chronologically by soonest expiry date.
 */
export function getUpcomingExpirySchedule(
  documents: EnrichedDocument[],
  limit = 5
): EnrichedDocument[] {
  return documents
    .filter((d) => d.daysRemaining >= 0)
    .sort(
      (a, b) =>
        a.daysRemaining - b.daysRemaining ||
        a.expiryDate.localeCompare(b.expiryDate) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}

/**
 * Returns the most recently added documents, pinning locally pending serverTimestamp() writes first.
 */
export function getRecentlyAddedDocuments(
  documents: EnrichedDocument[],
  limit = 4
): EnrichedDocument[] {
  return [...documents]
    .sort((a, b) => {
      const aTime =
        a.createdAt?.toMillis() ??
        a.updatedAt?.toMillis() ??
        Number.MAX_SAFE_INTEGER;
      const bTime =
        b.createdAt?.toMillis() ??
        b.updatedAt?.toMillis() ??
        Number.MAX_SAFE_INTEGER;
      return bTime - aTime || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
