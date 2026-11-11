import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileImage,
  Files,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  MailCheck,
  Menu,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  User,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  checkFirestoreConnection,
  getReadableErrorMessage,
  isOfflineFirestoreError,
} from '../lib/firebase';
import {
  createDocumentRecord,
  deleteDocumentRecord,
  markAllNotificationsAsRead,
  setDocumentReminderDismissed,
  subscribeToUserDocuments,
  syncStaleDocumentStatuses,
  updateDocumentRecord,
} from '../services/documentService';
import {
  DocumentFormData,
  DocumentRecord,
  EnrichedDocument,
  FormatFilter,
  NavSection,
  SortField,
  StatusFilter,
} from '../types/document';
import {
  computeDashboardAnalytics,
  getRecentlyAddedDocuments,
  getUpcomingExpirySchedule,
} from '../utils/analytics';
import { filterAndSortDocuments } from '../utils/documentFilter';
import {
  enrichDocument,
  exportDocumentsToCsv,
  formatCountdownLabel,
  formatDisplayDate,
  getExpiryNotifications,
  getShortFormatLabel,
  getTodayIsoLocal,
} from '../utils/expiry';
import { exportDocumentsToPdf } from '../utils/pdfExport';
import { recordDocumentRenewal } from '../utils/renewalHistory';
import { BrandMark } from './BrandMark';
import { DashboardAnalytics } from './DashboardAnalytics';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { DocumentTable } from './DocumentTable';
import { ExpiryCalendarView } from './ExpiryCalendarView';
import { LogoutConfirmModal } from './LogoutConfirmModal';
import { RecordRenewalModal } from './RecordRenewalModal';
import { RemindersPanel } from './RemindersPanel';
import { StatusIndicator } from './StatusIndicator';
import { UploadEditDocumentModal } from './UploadEditDocumentModal';
import { UserProfileSettings } from './UserProfileSettings';

export function DashboardWorkspace() {
  const {
    user,
    emailVerified,
    profile,
    authError,
    logout,
    resendVerificationEmail,
    refreshVerificationStatus,
    signInWithGoogle,
  } = useAuth();

  const { resolvedTheme, toggleTheme } = useTheme();

  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [rawDocuments, setRawDocuments] = useState<DocumentRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [connectionOffline, setConnectionOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [retryingConnection, setRetryingConnection] = useState(false);
  const [listenerRetryKey, setListenerRetryKey] = useState(0);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('All');
  const [sortField, setSortField] = useState<SortField>('expiryAsc');

  // Modals State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] =
    useState<EnrichedDocument | null>(null);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null
  );
  const [deletingDocument, setDeletingDocument] =
    useState<EnrichedDocument | null>(null);
  const [renewalModalDoc, setRenewalModalDoc] =
    useState<EnrichedDocument | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Verification, Sign-Out & Toast States
  const [verifyingCheck, setVerifyingCheck] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [bannerGoogleLoading, setBannerGoogleLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Browser network listeners for Firebase connectivity state
  useEffect(() => {
    const handleOnline = async () => {
      const ok = await checkFirestoreConnection();
      setConnectionOffline(!ok);
      if (ok) {
        setListenerRetryKey((k) => k + 1);
      }
    };
    const handleOffline = () => {
      setConnectionOffline(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time Firestore listener scoped to authenticated user
  useEffect(() => {
    if (!user) {
      setRawDocuments([]);
      setDocsLoading(false);
      return;
    }

    setDocsLoading(true);
    setDocsError(null);

    const unsubscribe = subscribeToUserDocuments(
      user.uid,
      (docs) => {
        setRawDocuments(docs);
        setDocsLoading(false);
        setDocsError(null);
        setConnectionOffline(false);
      },
      (err) => {
        if (isOfflineFirestoreError(err)) {
          setConnectionOffline(true);
        }
        setDocsError(getReadableErrorMessage(err));
        setDocsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, listenerRetryKey]);

  // Live calendar day tracking for automatic status updates
  const [todayKey, setTodayKey] = useState<string>(() => getTodayIsoLocal());
  const syncedStatusesRef = useRef<Set<string>>(new Set());

  // Notification Centre Popover & Bulk Read States
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const [popoverTab, setPopoverTab] = useState<'unread' | 'all'>('unread');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [busyNotifDocIds, setBusyNotifDocIds] = useState<Set<string>>(
    () => new Set()
  );
  const inFlightNotifIdsRef = useRef<Set<string>>(new Set());
  const notifPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refreshTodayKey = () => {
      const latest = getTodayIsoLocal();
      setTodayKey((prev) => (prev === latest ? prev : latest));
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshTodayKey();
      }
    };
    window.addEventListener('focus', refreshTodayKey);
    document.addEventListener('visibilitychange', handleVisibility);
    const intervalId = window.setInterval(refreshTodayKey, 60_000);
    return () => {
      window.removeEventListener('focus', refreshTodayKey);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!notifPopoverOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notifPopoverRef.current &&
        !notifPopoverRef.current.contains(event.target as Node)
      ) {
        setNotifPopoverOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotifPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifPopoverOpen]);

  const enrichedDocuments = useMemo(() => {
    if (!user) return [];
    return rawDocuments
      .filter((doc) => doc.ownerId === user.uid)
      .map((doc) => enrichDocument(doc));
  }, [rawDocuments, user, todayKey]);

  // Automatically persist updated document statuses to Cloud Firestore when current date crosses threshold
  useEffect(() => {
    if (
      !user ||
      !emailVerified ||
      docsLoading ||
      enrichedDocuments.length === 0
    ) {
      return;
    }

    const staleDocs = enrichedDocuments.filter((d) => {
      if (d.status === d.computedStatus) return false;
      const syncKey = `${d.id}:${d.computedStatus}:${todayKey}`;
      return !syncedStatusesRef.current.has(syncKey);
    });

    if (staleDocs.length === 0) return;

    const addedKeys = staleDocs.map(
      (d) => `${d.id}:${d.computedStatus}:${todayKey}`
    );
    addedKeys.forEach((k) => syncedStatusesRef.current.add(k));

    syncStaleDocumentStatuses(staleDocs).catch(() => {
      addedKeys.forEach((k) => syncedStatusesRef.current.delete(k));
    });
  }, [user, emailVerified, docsLoading, enrichedDocuments, todayKey]);

  const notificationSummary = useMemo(
    () => getExpiryNotifications(enrichedDocuments),
    [enrichedDocuments]
  );

  const popoverAlerts = useMemo(() => {
    return popoverTab === 'unread'
      ? notificationSummary.unreadAlerts
      : notificationSummary.allAlerts;
  }, [popoverTab, notificationSummary.unreadAlerts, notificationSummary.allAlerts]);

  const dashboardAnalytics = useMemo(
    () => computeDashboardAnalytics(enrichedDocuments),
    [enrichedDocuments]
  );

  const upcomingExpiryDocuments = useMemo(
    () => getUpcomingExpirySchedule(enrichedDocuments, 5),
    [enrichedDocuments]
  );

  const recentlyUploadedDocuments = useMemo(
    () => getRecentlyAddedDocuments(enrichedDocuments, 4),
    [enrichedDocuments]
  );

  const summaryCounts = useMemo(
    () => ({
      total: dashboardAnalytics.total,
      active: dashboardAnalytics.active,
      expiringSoon: dashboardAnalytics.expiringSoon,
      expired: dashboardAnalytics.expired,
      urgentAlerts: notificationSummary.unreadAlerts.length,
    }),
    [dashboardAnalytics, notificationSummary.unreadAlerts.length]
  );

  // Base dataset for current nav view
  const baseSectionDocs = useMemo(() => {
    if (activeNav === 'expiring') {
      return enrichedDocuments.filter(
        (d) =>
          d.computedStatus === 'Expiring Soon' ||
          d.computedStatus === 'Expired'
      );
    }
    return enrichedDocuments;
  }, [activeNav, enrichedDocuments]);

  // Filtered & sorted documents computed instantly when search or filters change
  const filteredDocuments = useMemo(() => {
    return filterAndSortDocuments(baseSectionDocs, {
      searchQuery,
      statusFilter: activeNav === 'expiring' ? 'All' : statusFilter,
      categoryFilter,
      formatFilter,
      sortField,
    });
  }, [
    baseSectionDocs,
    activeNav,
    statusFilter,
    categoryFilter,
    formatFilter,
    searchQuery,
    sortField,
  ]);

  const previewDocument = useMemo(
    () => enrichedDocuments.find((d) => d.id === previewDocumentId) || null,
    [enrichedDocuments, previewDocumentId]
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setCategoryFilter('All');
    setFormatFilter('All');
    setSortField('expiryAsc');
  };

  const handleSaveDocument = async (form: DocumentFormData) => {
    if (!user) throw new Error('You must be signed in.');
    if (!emailVerified) {
      throw new Error(
        'Please verify your email address before adding or modifying documents.'
      );
    }

    try {
      if (editingDocument) {
        await updateDocumentRecord({
          existingDoc: editingDocument,
          form,
        });
        showToast('success', `"${form.name.trim()}" updated.`);
      } else {
        await createDocumentRecord({
          user,
          form,
        });
        showToast(
          'success',
          `"${form.name.trim()}" saved to your Cloud Firestore vault.`
        );
      }
    } catch (err) {
      const msg = getReadableErrorMessage(err);
      throw new Error(msg);
    }
  };

  const handleConfirmDelete = async (doc: EnrichedDocument) => {
    if (!emailVerified) {
      throw new Error(
        'Please verify your email address before deleting documents.'
      );
    }
    try {
      await deleteDocumentRecord(doc);
      showToast('success', `"${doc.name}" deleted.`);
    } catch (err) {
      const msg = getReadableErrorMessage(err);
      throw new Error(msg);
    }
  };

  const handleRecordRenewal = async (
    doc: EnrichedDocument,
    newExpiryDate: string,
    renewalDate: string,
    renewalNotes?: string
  ) => {
    if (!emailVerified) {
      throw new Error(
        'Please verify your email address before recording document renewals.'
      );
    }
    const renewalUpdate = recordDocumentRenewal(
      doc,
      newExpiryDate,
      renewalDate,
      renewalNotes
    );
    await updateDocumentRecord({
      existingDoc: doc,
      form: {
        name: doc.name,
        category: doc.category,
        issueDate: doc.issueDate,
        expiryDate: renewalUpdate.newExpiryDate,
        reminderDaysBefore: doc.reminderDaysBefore,
        fileUrl: doc.fileUrl,
        notes: renewalUpdate.updatedNotes,
      },
    });
    showToast(
      'success',
      `Renewal recorded for "${doc.name}". New expiry: ${formatDisplayDate(newExpiryDate)}`
    );
  };

  const handleToggleAcknowledge = async (docId: string, dismissed: boolean) => {
    if (!emailVerified) {
      showToast(
        'error',
        'Please verify your email address before updating notifications.'
      );
      return;
    }
    if (inFlightNotifIdsRef.current.has(docId)) return;
    inFlightNotifIdsRef.current.add(docId);
    setBusyNotifDocIds((prev) => new Set(prev).add(docId));
    try {
      await setDocumentReminderDismissed(docId, dismissed);
      showToast(
        'success',
        dismissed
          ? 'Notification marked as read.'
          : 'Notification marked as unread.'
      );
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
    } finally {
      inFlightNotifIdsRef.current.delete(docId);
      setBusyNotifDocIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!emailVerified) {
      showToast(
        'error',
        'Please verify your email address before updating notifications.'
      );
      return;
    }
    const unreadIds = notificationSummary.unreadAlerts.map((d) => d.id);
    if (unreadIds.length === 0 || markingAllRead) return;

    setMarkingAllRead(true);
    try {
      await markAllNotificationsAsRead(unreadIds);
      showToast(
        'success',
        `Marked ${unreadIds.length} notification${unreadIds.length === 1 ? '' : 's'} as read.`
      );
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleExportCsv = (scope: 'all' | 'filtered' = 'filtered') => {
    const docsToExport =
      scope === 'all' ? enrichedDocuments : filteredDocuments;
    if (docsToExport.length === 0) {
      showToast('error', 'No documents available to export.');
      return;
    }
    const prefix =
      scope === 'all'
        ? 'docuping-documents-all'
        : 'docuping-documents-filtered';
    exportDocumentsToCsv(docsToExport, prefix);
    showToast(
      'success',
      `Exported ${docsToExport.length} ${
        scope === 'all' ? 'total' : 'filtered'
      } document(s) as CSV.`
    );
  };

  const handleExportPdf = (scope: 'all' | 'filtered' = 'filtered') => {
    const docsToExport =
      scope === 'all' ? enrichedDocuments : filteredDocuments;
    if (docsToExport.length === 0) {
      showToast('error', 'No documents available to export.');
      return;
    }
    const prefix =
      scope === 'all'
        ? 'docuping-vault-report-all'
        : 'docuping-vault-report-filtered';
    const reportTitle =
      scope === 'all'
        ? 'DocuPing Document Vault – All Tracked Records'
        : 'DocuPing Document Vault – Filtered Records Report';
    const filterScopeLabel =
      scope === 'all'
        ? `All ${enrichedDocuments.length} Documents`
        : `Filtered (${filteredDocuments.length} of ${enrichedDocuments.length} Documents)`;

    exportDocumentsToPdf(docsToExport, {
      fileNamePrefix: prefix,
      reportTitle,
      filterScopeLabel,
      userEmail: user?.email || undefined,
    });

    showToast(
      'success',
      `Exported ${docsToExport.length} ${
        scope === 'all' ? 'total' : 'filtered'
      } document(s) as PDF report.`
    );
  };

  const handleCheckVerification = async () => {
    setVerifyingCheck(true);
    try {
      const verified = await refreshVerificationStatus();
      if (verified) {
        showToast('success', 'Email verified. Full vault access unlocked.');
      } else {
        showToast(
          'error',
          'Email is not verified yet. Please click the verification link sent to your inbox.'
        );
      }
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
    } finally {
      setVerifyingCheck(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      await resendVerificationEmail();
      showToast(
        'success',
        `Verification link sent to ${user?.email || 'your email'}.`
      );
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleBannerGoogleSignIn = async () => {
    if (bannerGoogleLoading) return;
    setBannerGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
    } finally {
      setBannerGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
      setSigningOut(false);
    }
  };

  const openNewUploadModal = () => {
    setEditingDocument(null);
    setUploadModalOpen(true);
  };

  const openEditModal = (doc: EnrichedDocument) => {
    setEditingDocument(doc);
    setUploadModalOpen(true);
  };

  const handleSummaryCardClick = (status: StatusFilter) => {
    setStatusFilter(status);
    setCategoryFilter('All');
    setActiveNav('documents');
  };

  const handleCategorySummaryClick = (category: string) => {
    setCategoryFilter(category);
    setStatusFilter('All');
    setActiveNav('documents');
  };

  const displayName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Account';
  const userInitials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const navItems: {
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'documents',
      label: 'All Documents',
      icon: FolderOpen,
      count: summaryCounts.total,
    },
    {
      id: 'expiring',
      label: 'Expiring & Overdue',
      icon: Clock,
      count: summaryCounts.expiringSoon + summaryCounts.expired,
    },
    {
      id: 'calendar',
      label: 'Expiry Calendar',
      icon: CalendarDays,
    },
    {
      id: 'reminders',
      label: 'Notification Centre',
      icon: Bell,
      count: summaryCounts.urgentAlerts,
    },
    {
      id: 'profile',
      label: 'Profile & Settings',
      icon: User,
    },
  ];

  const sectionBreadcrumbs: Record<NavSection, string> = {
    overview: 'Overview',
    documents: 'All Documents',
    expiring: 'Expiring & Overdue',
    calendar: 'Expiry Calendar',
    reminders: 'Notification Centre',
    profile: 'Profile & Account Settings',
  };

  const handleRetryConnection = async () => {
    setRetryingConnection(true);
    try {
      const online = await checkFirestoreConnection();
      setConnectionOffline(!online);
      if (online) {
        setDocsError(null);
        setListenerRetryKey((k) => k + 1);
        showToast('success', 'Connected to Cloud Firestore.');
      } else {
        showToast(
          'error',
          'Still unable to reach Cloud Firestore. Check your network connection.'
        );
      }
    } finally {
      setRetryingConnection(false);
    }
  };

  const emailUnverified = Boolean(user && !emailVerified);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-slate-950/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Navigation (256px Desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-150 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <BrandMark />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-4 space-y-1" aria-label="Workspace navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveNav(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full h-10 px-3.5 rounded-lg text-sm font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Logout Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button
            type="button"
            onClick={() => {
              setActiveNav('profile');
              setMobileMenuOpen(false);
            }}
            title="View Profile & Account Settings"
            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left cursor-pointer group ${
              activeNav === 'profile'
                ? 'bg-blue-50/80 dark:bg-blue-950/50 ring-1 ring-blue-300 dark:ring-blue-700'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white font-display text-xs font-bold flex items-center justify-center shrink-0 group-hover:bg-blue-800 transition-colors">
              {userInitials || 'DP'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                  {displayName}
                </p>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                    emailVerified
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {emailVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user?.email || ''}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            disabled={signingOut}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 dark:text-slate-400" />
            ) : (
              <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            )}
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Header Bar */}
        <header className="h-16 px-4 sm:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">DocuPing</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
                {sectionBreadcrumbs[activeNav]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* In-App Notification Centre Bell & Quick Drawer */}
            <div className="relative" ref={notifPopoverRef}>
              <button
                type="button"
                onClick={() => setNotifPopoverOpen((prev) => !prev)}
                aria-label={`Notification Centre, ${notificationSummary.unreadAlerts.length} unread expiry reminder${notificationSummary.unreadAlerts.length === 1 ? '' : 's'}`}
                aria-expanded={notifPopoverOpen}
                className={`relative h-10 px-3 rounded-lg border transition-colors cursor-pointer inline-flex items-center gap-2 text-xs font-medium ${
                  notifPopoverOpen
                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Bell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  {notificationSummary.unreadAlerts.length > 0 && (
                    <span
                      title={`${notificationSummary.unreadAlerts.length} unread expiry reminders`}
                      className="absolute -top-1.5 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-white font-mono text-[10px] font-bold tabular-nums leading-none shadow-xs"
                    >
                      {notificationSummary.unreadAlerts.length > 99
                        ? '99+'
                        : notificationSummary.unreadAlerts.length}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline">Notifications</span>
              </button>

              {notifPopoverOpen && (
                <div
                  role="region"
                  aria-label="Notification Centre drawer"
                  className="fixed left-4 right-4 top-16 mt-2 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[440px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden"
                >
                  {/* Popover Header */}
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-850/60">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Expiry Reminders
                      </span>
                      {notificationSummary.unreadAlerts.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-mono text-[11px] font-semibold tabular-nums">
                          {notificationSummary.unreadAlerts.length} unread
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono text-[11px] font-medium tabular-nums">
                          0 unread
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {notificationSummary.unreadAlerts.length > 0 && (
                        <button
                          type="button"
                          disabled={markingAllRead}
                          onClick={handleMarkAllNotificationsRead}
                          className="h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {markingAllRead ? (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-700" />
                          ) : (
                            <CheckCheck className="w-3 h-3 text-blue-700" />
                          )}
                          <span>Mark All Read</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotifPopoverOpen(false)}
                        aria-label="Close notifications"
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Popover Sub-Navigation Tabs */}
                  {notificationSummary.allAlerts.length > 0 && (
                    <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setPopoverTab('unread')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                            popoverTab === 'unread'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Unread ({notificationSummary.unreadAlerts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPopoverTab('all')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                            popoverTab === 'all'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          All Alerts ({notificationSummary.allAlerts.length})
                        </button>
                      </div>

                      <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {notificationSummary.expiredAlerts.length} expired ·{' '}
                        {notificationSummary.expiringSoonAlerts.length} soon
                      </span>
                    </div>
                  )}

                  {/* Popover Notification List or Empty State */}
                  {notificationSummary.allAlerts.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-900">
                        No upcoming expirations
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        All tracked documents have more than 30 days remaining.
                        Alerts appear automatically when documents enter the
                        0–30 day window or expire.
                      </p>
                    </div>
                  ) : popoverAlerts.length === 0 ? (
                    <div className="px-5 py-7 text-center">
                      <CheckCheck className="w-6 h-6 text-blue-700 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-slate-900">
                        All notifications marked as read
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        You have {notificationSummary.readAlerts.length} read
                        notification(s).
                      </p>
                      <button
                        type="button"
                        onClick={() => setPopoverTab('all')}
                        className="mt-3 h-7 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          View All ({notificationSummary.allAlerts.length})
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {popoverAlerts.slice(0, 8).map((doc) => {
                        const isBusy = busyNotifDocIds.has(doc.id);
                        const isUnread = !doc.reminderDismissed;
                        return (
                          <div
                            key={doc.id}
                            className={`p-3.5 transition-colors flex items-start justify-between gap-3 ${
                              isUnread
                                ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850'
                                : 'bg-slate-50/60 dark:bg-slate-900/50 opacity-80 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-850'
                            }`}
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isUnread ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-300 dark:bg-slate-600'
                                  }`}
                                  title={
                                    isUnread
                                      ? 'Unread notification'
                                      : 'Read notification'
                                  }
                                  aria-hidden="true"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNotifPopoverOpen(false);
                                    setPreviewDocumentId(doc.id);
                                  }}
                                  className="text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 truncate text-left cursor-pointer"
                                >
                                  {doc.name}
                                </button>
                                <StatusIndicator status={doc.computedStatus} />
                              </div>

                              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-4 truncate">
                                <span className="font-medium text-slate-600 dark:text-slate-300">
                                  {doc.category}
                                </span>{' '}
                                · Expires {formatDisplayDate(doc.expiryDate)}
                              </p>

                              <p
                                className={`font-mono text-[11px] tabular-nums font-semibold pl-4 ${
                                  doc.daysRemaining < 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-amber-800 dark:text-amber-400'
                                }`}
                              >
                                {formatCountdownLabel(doc.daysRemaining)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setNotifPopoverOpen(false);
                                  setPreviewDocumentId(doc.id);
                                }}
                                title="View document details"
                                className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center justify-center cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleToggleAcknowledge(
                                    doc.id,
                                    !doc.reminderDismissed
                                  )
                                }
                                title={
                                  isUnread
                                    ? 'Mark notification as read'
                                    : 'Mark notification as unread'
                                }
                                className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-700 dark:text-blue-400" />
                                ) : isUnread ? (
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <RotateCcw className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                )}
                                <span>{isUnread ? 'Read' : 'Unread'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Popover Footer */}
                  <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifPopoverOpen(false);
                        setActiveNav('reminders');
                      }}
                      className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      Open Full Notification Centre (
                      {notificationSummary.allAlerts.length})
                    </button>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {popoverAlerts.length > 8
                        ? `+${popoverAlerts.length - 8} more`
                        : '0–30 day rule'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Theme Toggle Button (Requirement 1 & 2) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* User Profile Header Trigger */}
            <button
              type="button"
              onClick={() => setActiveNav('profile')}
              title={`Signed in as ${displayName}`}
              aria-label="Profile and Settings"
              className={`h-10 px-3 rounded-lg border transition-colors cursor-pointer inline-flex items-center gap-2 text-xs font-medium shrink-0 ${
                activeNav === 'profile'
                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="w-5 h-5 rounded-md bg-blue-700 text-white font-display text-[10px] font-bold flex items-center justify-center shrink-0">
                {userInitials || 'DP'}
              </div>
              <span className="hidden md:inline truncate max-w-[120px] text-slate-900 dark:text-slate-200">
                {displayName}
              </span>
            </button>

            <button
              type="button"
              onClick={openNewUploadModal}
              disabled={emailUnverified}
              title={
                emailUnverified
                  ? 'Verify your email address first to add documents'
                  : 'Add a new document to track expiry'
              }
              className="h-10 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Document</span>
            </button>
          </div>
        </header>

        {/* Main Scrollable Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1360px] w-full mx-auto space-y-6">
          {/* Email Verification Banner (shown only if signed up via email/password and not yet verified) */}
          {emailUnverified && (
            <div
              role="alert"
              className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <MailCheck className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-sm font-semibold text-amber-950 dark:text-amber-200">
                    Verify your email address to add and manage documents
                  </h2>
                  <p className="mt-1 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                    We sent a verification email to{' '}
                    <span className="font-medium">{user?.email}</span>. Click
                    the link in your inbox, then select{' '}
                    <span className="font-medium">Refresh Status</span>—or sign
                    in immediately with Google.
                  </p>
                  {authError && (
                    <p className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                      {authError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCheckVerification}
                  disabled={verifyingCheck}
                  className="h-9 px-3.5 rounded-lg bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-700 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {verifyingCheck ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Refresh Status</span>
                </button>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendingEmail}
                  className="h-9 px-3.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 hover:bg-amber-100/50 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-300 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {resendingEmail ? 'Sending...' : 'Resend Link'}
                </button>
                <button
                  type="button"
                  onClick={handleBannerGoogleSignIn}
                  disabled={bannerGoogleLoading}
                  className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {bannerGoogleLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700 dark:text-blue-400" />
                  )}
                  <span>
                    {bannerGoogleLoading
                      ? 'Connecting...'
                      : 'Continue with Google'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Firebase Offline / Connection Error Banner */}
          {connectionOffline && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900 dark:text-red-200"
            >
              <div className="flex items-start gap-2.5">
                <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Firebase connection interrupted
                  </p>
                  <p className="mt-0.5 text-red-800 dark:text-red-300">
                    Unable to reach Cloud Firestore. Saving and editing
                    documents require an active connection.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetryConnection}
                disabled={retryingConnection}
                className="h-8 px-3 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-800 hover:bg-red-100/50 dark:hover:bg-slate-700 text-red-900 dark:text-red-200 font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {retryingConnection ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Retry Connection</span>
              </button>
            </div>
          )}

          {/* Firestore Error Banner */}
          {docsError && !connectionOffline && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3 text-xs text-red-800 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-200">
                  Unable to load documents
                </p>
                <p className="mt-0.5">{docsError}</p>
              </div>
            </div>
          )}

          {/* Active Expiry & Overdue Alert Banner on Overview */}
          {activeNav === 'overview' &&
            !docsLoading &&
            notificationSummary.unreadAlerts.length > 0 && (
              <div
                role="alert"
                className={`rounded-xl border p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  notificationSummary.expiredAlerts.some(
                    (d) => !d.reminderDismissed
                  )
                    ? 'border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/30 text-red-950 dark:text-red-200'
                    : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <AlertTriangle
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      notificationSummary.expiredAlerts.some(
                        (d) => !d.reminderDismissed
                      )
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold">
                      Expiry Alert: {notificationSummary.unreadAlerts.length}{' '}
                      document
                      {notificationSummary.unreadAlerts.length === 1 ? '' : 's'}{' '}
                      require attention
                    </p>
                    <p className="mt-0.5 text-xs opacity-90 truncate">
                      Next urgent:{' '}
                      <span className="font-medium">
                        {notificationSummary.unreadAlerts[0].name}
                      </span>{' '}
                      ({notificationSummary.unreadAlerts[0].category}) · Expires{' '}
                      {formatDisplayDate(
                        notificationSummary.unreadAlerts[0].expiryDate
                      )}{' '}
                      ·{' '}
                      {formatCountdownLabel(
                        notificationSummary.unreadAlerts[0].daysRemaining
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveNav('reminders')}
                    className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Notification Centre
                  </button>
                  <button
                    type="button"
                    disabled={markingAllRead}
                    onClick={handleMarkAllNotificationsRead}
                    className="h-8 px-3 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {markingAllRead ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Mark All Read</span>
                  </button>
                </div>
              </div>
            )}

          {/* 4-Column Summary KPI Strip (Overview) */}
          {activeNav === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => handleSummaryCardClick('All')}
                className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-500 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total Tracked Documents
                  </span>
                  <Files
                    className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2.5 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {docsLoading ? '—' : summaryCounts.total}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {docsLoading
                    ? 'Loading vault...'
                    : `${dashboardAnalytics.populatedCategories.length} active ${
                        dashboardAnalytics.populatedCategories.length === 1
                          ? 'category'
                          : 'categories'
                      }`}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSummaryCardClick('Active')}
                className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Active
                  </span>
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2.5 font-display text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {docsLoading ? '—' : summaryCounts.active}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  &gt; 30 days remaining
                  {!docsLoading && summaryCounts.total > 0
                    ? ` · ${dashboardAnalytics.statusSegments[0].percentage}%`
                    : ''}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSummaryCardClick('Expiring Soon')}
                className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-500 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Expiring Soon
                  </span>
                  <Clock
                    className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2.5 font-display text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {docsLoading ? '—' : summaryCounts.expiringSoon}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  0–30 days remaining
                  {!docsLoading && summaryCounts.total > 0
                    ? ` · ${dashboardAnalytics.statusSegments[1].percentage}%`
                    : ''}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSummaryCardClick('Expired')}
                className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-300 dark:hover:border-red-500 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Expired
                  </span>
                  <FileCheck2
                    className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2.5 font-display text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
                  {docsLoading ? '—' : summaryCounts.expired}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Expiry date passed
                  {!docsLoading && summaryCounts.total > 0
                    ? ` · ${dashboardAnalytics.statusSegments[2].percentage}%`
                    : ''}
                </p>
              </button>
            </div>
          )}

          {/* Overview: Analytics Chart + Category Summary + Notifications + Upcoming + Recent + Vault Table */}
          {activeNav === 'overview' && (
            <>
              <DashboardAnalytics
                analytics={dashboardAnalytics}
                loading={docsLoading}
                onSelectStatus={(status) => handleSummaryCardClick(status)}
                onSelectCategory={handleCategorySummaryClick}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-6">
                  <RemindersPanel
                    documents={enrichedDocuments}
                    compact
                    markingAllRead={markingAllRead}
                    busyDocIds={busyNotifDocIds}
                    onViewDocument={(doc) => setPreviewDocumentId(doc.id)}
                    onEditDocument={openEditModal}
                    onToggleAcknowledge={handleToggleAcknowledge}
                    onMarkAllRead={handleMarkAllNotificationsRead}
                    onNavigateAllReminders={() => setActiveNav('reminders')}
                  />
                </div>

                {/* Upcoming Expiry Dates Schedule */}
                <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 flex items-center justify-center shrink-0">
                        <CalendarClock
                          className="w-4 h-4 text-amber-700 dark:text-amber-400"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                          Upcoming Expiry Dates
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Next upcoming deadlines sorted chronologically
                        </p>
                      </div>
                    </div>
                    {upcomingExpiryDocuments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSortField('expiryAsc');
                          setStatusFilter('All');
                          setCategoryFilter('All');
                          setActiveNav('documents');
                        }}
                        className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Full Schedule
                      </button>
                    )}
                  </div>

                  {docsLoading ? (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {[1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className="px-6 py-3.5 flex items-center justify-between gap-3 animate-pulse"
                        >
                          <div className="h-3.5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                          <div className="h-3.5 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                        </div>
                      ))}
                    </div>
                  ) : upcomingExpiryDocuments.length === 0 ? (
                    <div className="px-6 py-9 text-center">
                      <CalendarClock
                        className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2.5"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {summaryCounts.total === 0
                          ? 'No upcoming expiry dates yet'
                          : 'No upcoming future expiry dates'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                        {summaryCounts.total === 0
                          ? 'Add your first document with an issue and expiry date to see upcoming renewal deadlines here.'
                          : `All ${summaryCounts.expired} tracked document(s) have already passed their expiry date. Renew them in Notification Centre.`}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {upcomingExpiryDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentId(doc.id)}
                                className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 truncate text-left cursor-pointer"
                              >
                                {doc.name}
                              </button>
                              <StatusIndicator status={doc.computedStatus} />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {doc.category} ·{' '}
                              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                {formatDisplayDate(doc.expiryDate)}
                              </span>{' '}
                              ·{' '}
                              <span
                                className={`font-mono tabular-nums ${
                                  doc.computedStatus === 'Expiring Soon'
                                    ? 'text-amber-800 dark:text-amber-400 font-medium'
                                    : 'text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {formatCountdownLabel(doc.daysRemaining)}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {Boolean(doc.fileUrl?.trim()) ? (
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentId(doc.id)}
                                aria-label={`Preview ${doc.name}`}
                                className="h-8 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-xs font-medium text-blue-700 dark:text-blue-300 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Preview</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentId(doc.id)}
                                aria-label={`Inspect ${doc.name}`}
                                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">View</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(doc)}
                              aria-label={`Edit ${doc.name}`}
                              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDocument(doc)}
                              aria-label={`Delete ${doc.name}`}
                              className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 inline-flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Recently Added Documents Strip */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                      Recently Added
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Latest documents saved to your personal vault
                    </p>
                  </div>
                  {enrichedDocuments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSortField('recentDesc');
                        setStatusFilter('All');
                        setCategoryFilter('All');
                        setActiveNav('documents');
                      }}
                      className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      View All
                    </button>
                  )}
                </div>

                {docsLoading ? (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {[1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className="px-6 py-3.5 flex items-center justify-between gap-3 animate-pulse"
                      >
                        <div className="h-3.5 w-36 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-3.5 w-16 rounded bg-slate-100 dark:bg-slate-800" />
                      </div>
                    ))}
                  </div>
                ) : recentlyUploadedDocuments.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      No documents saved yet
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Your most recently added documents will appear here as soon
                      as you save a record in Cloud Firestore.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {recentlyUploadedDocuments.map((doc) => {
                      const isPdf = doc.fileType === 'application/pdf';
                      const isImage =
                        doc.fileType === 'image/jpeg' ||
                        doc.fileType === 'image/png';
                      return (
                        <div
                          key={doc.id}
                          className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors"
                        >
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
                                onClick={() => setPreviewDocumentId(doc.id)}
                                className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 truncate block text-left max-w-full cursor-pointer"
                              >
                                {doc.name}
                              </button>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {doc.category} ·{' '}
                                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                  Issued {formatDisplayDate(doc.issueDate)}
                                </span>{' '}
                                ·{' '}
                                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                  Exp {formatDisplayDate(doc.expiryDate)} (
                                  {formatCountdownLabel(doc.daysRemaining)})
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                            <StatusIndicator status={doc.computedStatus} />
                            {Boolean(doc.fileUrl?.trim()) ? (
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentId(doc.id)}
                                aria-label={`Preview ${doc.name}`}
                                className="h-8 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-xs font-medium text-blue-700 dark:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Preview</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentId(doc.id)}
                                aria-label={`Inspect ${doc.name}`}
                                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">View</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(doc)}
                              aria-label={`Edit ${doc.name}`}
                              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDocument(doc)}
                              aria-label={`Delete ${doc.name}`}
                              className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 inline-flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <DocumentTable
                title="Document Vault"
                allDocuments={enrichedDocuments}
                filteredDocuments={filteredDocuments}
                loading={docsLoading}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
                formatFilter={formatFilter}
                onFormatFilterChange={setFormatFilter}
                sortField={sortField}
                onSortFieldChange={setSortField}
                onResetFilters={handleResetFilters}
                onExportCsv={handleExportCsv}
                onExportPdf={handleExportPdf}
                onUploadClick={openNewUploadModal}
                onViewDocument={(doc) => setPreviewDocumentId(doc.id)}
                onEditDocument={openEditModal}
                onDeleteDocument={(doc) => setDeletingDocument(doc)}
                onRecordRenewal={(doc) => setRenewalModalDoc(doc)}
              />
            </>
          )}

          {/* All Documents View */}
          {activeNav === 'documents' && (
            <DocumentTable
              title="All Tracked Documents"
              allDocuments={enrichedDocuments}
              filteredDocuments={filteredDocuments}
              loading={docsLoading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              formatFilter={formatFilter}
              onFormatFilterChange={setFormatFilter}
              sortField={sortField}
              onSortFieldChange={setSortField}
              onResetFilters={handleResetFilters}
              onExportCsv={handleExportCsv}
              onExportPdf={handleExportPdf}
              onUploadClick={openNewUploadModal}
              onViewDocument={(doc) => setPreviewDocumentId(doc.id)}
              onEditDocument={openEditModal}
              onDeleteDocument={(doc) => setDeletingDocument(doc)}
              onRecordRenewal={(doc) => setRenewalModalDoc(doc)}
            />
          )}

          {/* Expiring Soon & Expired Renewal Queue View */}
          {activeNav === 'expiring' && (
            <DocumentTable
              title="Expiring Soon & Overdue Renewals"
              allDocuments={baseSectionDocs}
              filteredDocuments={filteredDocuments}
              loading={docsLoading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              hideStatusTabs
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              formatFilter={formatFilter}
              onFormatFilterChange={setFormatFilter}
              sortField={sortField}
              onSortFieldChange={setSortField}
              onResetFilters={handleResetFilters}
              onExportCsv={handleExportCsv}
              onExportPdf={handleExportPdf}
              onUploadClick={openNewUploadModal}
              onViewDocument={(doc) => setPreviewDocumentId(doc.id)}
              onEditDocument={openEditModal}
              onDeleteDocument={(doc) => setDeletingDocument(doc)}
              onRecordRenewal={(doc) => setRenewalModalDoc(doc)}
            />
          )}

          {/* Expiry Calendar View */}
          {activeNav === 'calendar' && (
            <ExpiryCalendarView
              documents={enrichedDocuments}
              onViewDocument={(doc) => setPreviewDocumentId(doc.id)}
              onEditDocument={openEditModal}
              onRecordRenewal={(doc) => setRenewalModalDoc(doc)}
              onAddNewDocument={openNewUploadModal}
            />
          )}

          {/* Notification Centre View */}
          {activeNav === 'reminders' && (
            <RemindersPanel
              documents={enrichedDocuments}
              markingAllRead={markingAllRead}
              busyDocIds={busyNotifDocIds}
              onViewDocument={(doc) => setPreviewDocumentId(doc.id)}
              onEditDocument={openEditModal}
              onToggleAcknowledge={handleToggleAcknowledge}
              onMarkAllRead={handleMarkAllNotificationsRead}
            />
          )}

          {/* User Profile & Account Settings View */}
          {activeNav === 'profile' && (
            <UserProfileSettings
              onOpenLogoutModal={() => setLogoutConfirmOpen(true)}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Add / Edit Modal */}
      <UploadEditDocumentModal
        isOpen={uploadModalOpen}
        editingDocument={editingDocument}
        defaultReminderDays={profile?.defaultReminderDays ?? 30}
        onClose={() => {
          setUploadModalOpen(false);
          setEditingDocument(null);
        }}
        onSubmit={handleSaveDocument}
      />

      {/* View / Preview Modal */}
      <DocumentPreviewModal
        document={previewDocument}
        onClose={() => setPreviewDocumentId(null)}
        onEdit={openEditModal}
        onDelete={(doc) => setDeletingDocument(doc)}
        onRecordRenewal={(doc) => setRenewalModalDoc(doc)}
      />

      {/* Record Renewal Modal */}
      <RecordRenewalModal
        document={renewalModalDoc}
        isOpen={Boolean(renewalModalDoc)}
        onClose={() => setRenewalModalDoc(null)}
        onRecordRenewal={handleRecordRenewal}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        document={deletingDocument}
        onClose={() => setDeletingDocument(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Secure Sign Out Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={logoutConfirmOpen}
        userEmail={user?.email}
        loading={signingOut}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
      />

      {/* Status Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl border shadow-lg text-xs font-medium flex items-center gap-2.5 ${
            toast.type === 'success'
              ? 'bg-white border-emerald-200 text-slate-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
