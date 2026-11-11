import React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { ExpiryStatus } from '../types/document';

export function StatusIndicator({ status }: { status: ExpiryStatus }) {
  if (status === 'Active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
        <CheckCircle2
          className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
          aria-hidden="true"
        />
        <span>Active</span>
      </span>
    );
  }

  if (status === 'Expiring Soon') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold text-amber-800 dark:text-amber-300 whitespace-nowrap shrink-0">
        <Clock
          className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0"
          aria-hidden="true"
        />
        <span>Expiring Soon</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 text-xs font-semibold text-red-700 dark:text-red-300 whitespace-nowrap shrink-0">
      <AlertTriangle
        className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0"
        aria-hidden="true"
      />
      <span>Expired</span>
    </span>
  );
}
