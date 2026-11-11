import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  Moon,
  RefreshCw,
  Save,
  Send,
  Shield,
  ShieldCheck,
  Sun,
  User,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getReadableErrorMessage } from '../lib/firebase';

const REMINDER_PRESETS = [7, 15, 30, 45, 60, 90] as const;

interface UserProfileSettingsProps {
  onOpenLogoutModal: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export function UserProfileSettings({
  onOpenLogoutModal,
  showToast,
}: UserProfileSettingsProps) {
  const {
    user,
    emailVerified,
    profile,
    savePreferences,
    sendPasswordReset,
    resendVerificationEmail,
    refreshVerificationStatus,
  } = useAuth();

  const { theme, setTheme } = useTheme();

  // Form State
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [reminderDaysInput, setReminderDaysInput] = useState<number>(30);
  const [isCustomDays, setIsCustomDays] = useState(false);

  // Operation States
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize form from current profile & user state
  useEffect(() => {
    const currentName =
      profile?.displayName ||
      user?.displayName ||
      user?.email?.split('@')[0] ||
      '';
    setDisplayNameInput(currentName);

    const defaultDays = profile?.defaultReminderDays ?? 30;
    setReminderDaysInput(defaultDays);
    setIsCustomDays(
      !REMINDER_PRESETS.includes(defaultDays as (typeof REMINDER_PRESETS)[number])
    );
  }, [profile, user]);

  const authProvider = user?.providerData?.[0]?.providerId || 'password';
  const isGoogleAccount = authProvider === 'google.com';
  const accountCreated = user?.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';
  const lastSignIn = user?.metadata.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recent';

  const userInitials = (displayNameInput.trim() || user?.email || 'DP')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanName = displayNameInput.trim();
    if (!cleanName) {
      setValidationError('Display name cannot be empty.');
      return;
    }
    if (cleanName.length > 80) {
      setValidationError('Display name must not exceed 80 characters.');
      return;
    }

    const daysNum = Math.round(Number(reminderDaysInput));
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      setValidationError(
        'Default reminder trigger must be between 1 and 365 days.'
      );
      return;
    }

    setSavingProfile(true);
    try {
      await savePreferences({
        displayName: cleanName,
        defaultReminderDays: daysNum,
      });
      showToast('success', 'Profile and preferences updated successfully.');
    } catch (err) {
      const msg = getReadableErrorMessage(err);
      setValidationError(msg);
      showToast('error', msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      showToast('error', 'No email address registered for this account.');
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordReset(user.email);
      showToast(
        'success',
        `Password reset email sent to ${user.email}. Check your inbox.`
      );
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
    } finally {
      setSendingReset(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      await resendVerificationEmail();
      showToast(
        'success',
        `Verification email dispatched to ${user?.email || 'your email'}.`
      );
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleRefreshVerification = async () => {
    setRefreshingStatus(true);
    try {
      const verified = await refreshVerificationStatus();
      if (verified) {
        showToast('success', 'Email verified successfully. Full access active.');
      } else {
        showToast(
          'error',
          'Email not yet verified. Please click the link sent to your inbox.'
        );
      }
    } catch (err) {
      showToast('error', getReadableErrorMessage(err));
    } finally {
      setRefreshingStatus(false);
    }
  };

  const hasUnsavedChanges =
    displayNameInput.trim() !== (profile?.displayName || user?.displayName || '') ||
    reminderDaysInput !== (profile?.defaultReminderDays ?? 30);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Profile Summary Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-display text-xl font-bold flex items-center justify-center shadow-md shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {displayNameInput.trim() || user?.displayName || 'DocuPing User'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    emailVerified
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80'
                  }`}
                >
                  {emailVerified ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Email Verified</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Unverified Email</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 truncate">
                {user?.email || 'No email associated'}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  Provider:{' '}
                  <strong className="text-slate-700 dark:text-slate-300 font-medium">
                    {isGoogleAccount ? 'Google Account' : 'Email & Password'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Joined:{' '}
                  <strong className="text-slate-700 dark:text-slate-300 font-medium">
                    {accountCreated}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenLogoutModal}
            className="h-9 px-3.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Appearance & Color Theme Settings (Requirement 1 & 2) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sun className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Appearance &amp; Color Theme</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Switch between Light Mode and Dark Mode. Your preference is preserved across page refreshes and browser sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Light Mode Switch */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
              theme === 'light'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Light Mode</p>
                {theme === 'light' && (
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Crisp, bright daylight view</p>
            </div>
          </button>

          {/* Dark Mode Switch */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
              theme === 'dark'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-blue-400 border border-slate-700 flex items-center justify-center shrink-0 shadow-xs">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Dark Mode</p>
                {theme === 'dark' && (
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Reduced glare, high contrast</p>
            </div>
          </button>

          {/* System Default Switch */}
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
              theme === 'system'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">System Default</p>
                {theme === 'system' && (
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Sync with system appearance</p>
            </div>
          </button>
        </div>
      </div>

      {/* Profile & Preference Edit Form */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6 transition-colors"
      >
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Profile &amp; Notification Preferences</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Update your account display identity and default expiry reminder
            triggers.
          </p>
        </div>

        {validationError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Display Name Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="profile-display-name"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 block"
            >
              Display Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="profile-display-name"
                type="text"
                maxLength={80}
                required
                value={displayNameInput}
                onChange={(e) => {
                  setDisplayNameInput(e.target.value);
                  setValidationError(null);
                }}
                placeholder="e.g. Jane Doe"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                {displayNameInput.length}/80
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Shown on your dashboard header, exports, and document reports.
            </p>
          </div>

          {/* Email Address (Read-Only Firebase Auth Record) */}
          <div className="space-y-1.5">
            <label
              htmlFor="profile-email-readonly"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 block"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="profile-email-readonly"
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed font-mono"
              />
              <div className="absolute right-3 top-2.5 text-slate-400 dark:text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Managed securely via Firebase Authentication credentials.
            </p>
          </div>
        </div>

        {/* Default Reminder Lead Days Setting */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              Default Expiry Reminder Lead Days
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              New documents automatically inherit this reminder threshold (can
              be customized per document).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {REMINDER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setReminderDaysInput(preset);
                  setIsCustomDays(false);
                }}
                className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  !isCustomDays && reminderDaysInput === preset
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {preset} days
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsCustomDays(true)}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isCustomDays
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Custom
            </button>
          </div>

          {isCustomDays && (
            <div className="flex items-center gap-2 max-w-xs pt-1">
              <input
                type="number"
                min={1}
                max={365}
                value={reminderDaysInput}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setReminderDaysInput(isNaN(val) ? 30 : val);
                }}
                className="w-24 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">days before expiry</span>
            </div>
          )}
        </div>

        {/* Save Changes Button */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              You have unsaved changes
            </span>
          )}
          <button
            type="submit"
            disabled={savingProfile || !hasUnsavedChanges}
            className="h-9 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            {savingProfile ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Profile &amp; Settings</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Account Security & Verification Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5 transition-colors">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Account Security &amp; Credentials</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your sign-in security, verification state, and credentials.
          </p>
        </div>

        {/* Email Verification Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Email Verification
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    emailVerified
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                  }`}
                >
                  {emailVerified ? 'Verified' : 'Action Required'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {emailVerified
                  ? 'Your email address has been verified. Cloud Firestore document operations are fully enabled.'
                  : 'Please verify your email address to unlock document creation, editing, and deletion.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!emailVerified && (
                <>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingEmail}
                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {resendingEmail ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    )}
                    <span>Resend Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshVerification}
                    disabled={refreshingStatus}
                    className="h-8 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {refreshingStatus ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Check Status</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Password Reset (For Password Accounts) */}
        {!isGoogleAccount && (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                Reset Password
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Send a secure password reset link to{' '}
                <strong className="font-mono text-slate-800 dark:text-slate-200">
                  {user?.email}
                </strong>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendPasswordReset}
              disabled={sendingReset}
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {sendingReset ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              ) : (
                <KeyRound className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              )}
              <span>Send Reset Email</span>
            </button>
          </div>
        )}

        {/* Technical Account Details */}
        <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span>Firebase User ID (UID):</span>
            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded select-all">
              {user?.uid}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last Sign-In:</span>
            <span className="text-slate-700 dark:text-slate-300">{lastSignIn}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Firestore Database:</span>
            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
              ai-studio-7e129900-fed6-4ad2-bf99-cc024935a3b6
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
