import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { EnrichedDocument } from '../types/document';
import {
  formatCountdownLabel,
  formatDisplayDate,
  getExpiryNotifications,
} from '../utils/expiry';
import { StatusIndicator } from './StatusIndicator';

type NotificationFilterTab = 'unread' | 'expiring' | 'expired' | 'read' | 'all';

interface RemindersPanelProps {
  documents: EnrichedDocument[];
  compact?: boolean;
  markingAllRead?: boolean;
  busyDocIds?: Set<string>;
  defaultReminderDays?: number;
  onSaveDefaultReminderDays?: (days: number) => Promise<void>;
  onViewDocument: (doc: EnrichedDocument) => void;
  onEditDocument: (doc: EnrichedDocument) => void;
  onToggleAcknowledge: (docId: string, dismissed: boolean) => Promise<void>;
  onMarkAllRead?: () => Promise<void>;
  onNavigateAllReminders?: () => void;
}

export function RemindersPanel({
  documents,
  compact = false,
  markingAllRead = false,
  busyDocIds,
  onViewDocument,
  onEditDocument,
  onToggleAcknowledge,
  onMarkAllRead,
  onNavigateAllReminders,
}: RemindersPanelProps) {
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('unread');
  const [localBusyDocIds, setLocalBusyDocIds] = useState<Set<string>>(
    () => new Set()
  );

  const {
    allAlerts,
    unreadAlerts,
    readAlerts,
    expiringSoonAlerts,
    expiredAlerts,
  } = getExpiryNotifications(documents);

  const displayedAlerts = compact
    ? unreadAlerts.slice(0, 5)
    : activeTab === 'unread'
    ? unreadAlerts
    : activeTab === 'expiring'
    ? expiringSoonAlerts
    : activeTab === 'expired'
    ? expiredAlerts
    : activeTab === 'read'
    ? readAlerts
    : allAlerts;

  const handleToggleRead = async (doc: EnrichedDocument) => {
    if (busyDocIds?.has(doc.id) || localBusyDocIds.has(doc.id)) return;
    setLocalBusyDocIds((prev) => new Set(prev).add(doc.id));
    try {
      await onToggleAcknowledge(doc.id, !doc.reminderDismissed);
    } finally {
      setLocalBusyDocIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const tabs: { id: NotificationFilterTab; label: string; count: number }[] = [
    { id: 'unread', label: 'Unread', count: unreadAlerts.length },
    {
      id: 'expiring',
      label: 'Expiring Soon',
      count: expiringSoonAlerts.length,
    },
    { id: 'expired', label: 'Expired', count: expiredAlerts.length },
    { id: 'read', label: 'Read', count: readAlerts.length },
    { id: 'all', label: 'All Alerts', count: allAlerts.length },
  ];

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {compact
                    ? 'Upcoming Expiry Notifications'
                    : 'Notification Centre'}
                </h2>
                {unreadAlerts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-mono text-[11px] font-semibold tabular-nums">
                    {unreadAlerts.length} unread
                  </span>
                )}
              </div>
              {!compact && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time alerts for documents expiring within 30 days or past
                  due in Cloud Firestore.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {unreadAlerts.length > 0 && onMarkAllRead && (
              <button
                type="button"
                disabled={markingAllRead}
                onClick={onMarkAllRead}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {markingAllRead ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700 dark:text-blue-400" />
                ) : (
                  <CheckCheck className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                )}
                <span>Mark All Read</span>
              </button>
            )}

            {compact && onNavigateAllReminders && allAlerts.length > 0 && (
              <button
                type="button"
                onClick={onNavigateAllReminders}
                className="h-8 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 text-xs font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Notification Centre ({allAlerts.length})
              </button>
            )}
          </div>
        </div>

        {/* Full Notification Centre Filter Tabs */}
        {!compact && (
          <div
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg"
            role="tablist"
            aria-label="Filter notifications"
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selected
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty States or Notification Rows */}
      {allAlerts.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No upcoming expirations
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            All of your tracked documents have more than 30 days remaining.
            Notifications appear automatically when a document enters the 0–30
            day expiry window or expires.
          </p>
        </div>
      ) : displayedAlerts.length === 0 ? (
        <div className="px-6 py-9 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <BellOff className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {activeTab === 'unread' || compact
              ? 'All notifications marked as read'
              : activeTab === 'expiring'
              ? 'No documents expiring within 30 days'
              : activeTab === 'expired'
              ? 'No expired documents'
              : 'No read notifications yet'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'unread' || compact
              ? `You have ${readAlerts.length} read notification(s) in your Notification Centre.`
              : 'Switch tabs above to inspect other notification categories.'}
          </p>
          {compact && onNavigateAllReminders && readAlerts.length > 0 && (
            <button
              type="button"
              onClick={onNavigateAllReminders}
              className="mt-4 h-8 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Read Notifications</span>
            </button>
          )}
          {!compact && activeTab === 'unread' && readAlerts.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('read')}
              className="mt-4 h-8 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Read Notifications ({readAlerts.length})</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {displayedAlerts.map((doc) => {
            const isBusy = Boolean(
              busyDocIds?.has(doc.id) || localBusyDocIds.has(doc.id)
            );
            const isUnread = !doc.reminderDismissed;
            return (
              <div
                key={doc.id}
                className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isUnread
                    ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-850/60'
                    : 'bg-slate-50/70 dark:bg-slate-900/60 opacity-80'
                }`}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isUnread ? 'bg-blue-600 dark:bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      title={isUnread ? 'Unread notification' : 'Read'}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => onViewDocument(doc)}
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 truncate text-left cursor-pointer"
                    >
                      {doc.name}
                    </button>
                    <StatusIndicator status={doc.computedStatus} />
                    {!compact && (
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                          isUnread
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                            : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isUnread ? 'Unread' : 'Read'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pl-4">
                    <span>
                      <span className="text-slate-400 dark:text-slate-500">Category:</span>{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {doc.category}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                      ·
                    </span>
                    <span className="font-mono tabular-nums">
                      <span className="font-sans text-slate-400 dark:text-slate-500">Expires:</span>{' '}
                      {formatDisplayDate(doc.expiryDate)}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                      ·
                    </span>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        doc.daysRemaining < 0
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-amber-800 dark:text-amber-400'
                      }`}
                    >
                      {formatCountdownLabel(doc.daysRemaining)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-4 sm:pl-0">
                  {Boolean(doc.fileUrl?.trim()) ? (
                    <button
                      type="button"
                      onClick={() => onViewDocument(doc)}
                      className="h-8 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800/80 bg-blue-50/90 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-medium text-blue-700 dark:text-blue-400 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onViewDocument(doc)}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onEditDocument(doc)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-blue-700 dark:text-blue-400 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Renew</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleToggleRead(doc)}
                    title={
                      isUnread
                        ? 'Mark notification as read'
                        : 'Mark notification as unread'
                    }
                    className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isUnread ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    )}
                    <span>{isUnread ? 'Mark as Read' : 'Mark Unread'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
