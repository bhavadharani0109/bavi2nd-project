import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react';
import authVaultVisual from '../assets/images/auth_vault_visual_1793959093147.jpg';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BrandMark } from './BrandMark';

type AuthMode = 'login' | 'signup' | 'reset';

export function AuthScreen() {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    authError,
    clearAuthError,
  } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const authInFlightRef = React.useRef(false);

  const switchMode = (nextMode: AuthMode) => {
    if (authInFlightRef.current) return;
    setMode(nextMode);
    setLocalError(null);
    setSuccessMessage(null);
    clearAuthError();
  };

  const handleGoogleSignIn = async () => {
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;
    setLocalError(null);
    setSuccessMessage(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      // Error surfaced via authError
    } finally {
      setGoogleLoading(false);
      authInFlightRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authInFlightRef.current) return;
    setLocalError(null);
    setSuccessMessage(null);
    clearAuthError();

    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (mode === 'reset') {
      authInFlightRef.current = true;
      setSubmitting(true);
      try {
        await sendPasswordReset(trimmedEmail);
        setSuccessMessage(
          `Password reset instructions sent to ${trimmedEmail}. Check your inbox.`
        );
      } catch {
        // Error surfaced via authError
      } finally {
        setSubmitting(false);
        authInFlightRef.current = false;
      }
      return;
    }

    if (mode === 'signup') {
      if (!displayName.trim()) {
        setLocalError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }

      authInFlightRef.current = true;
      setSubmitting(true);
      try {
        await registerWithEmail(displayName, trimmedEmail, password);
      } catch {
        // Error surfaced via authError
      } finally {
        setSubmitting(false);
        authInFlightRef.current = false;
      }
      return;
    }

    // Login mode
    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    authInFlightRef.current = true;
    setSubmitting(true);
    try {
      await signInWithEmail(trimmedEmail, password);
    } catch {
      // Error surfaced via authError
    } finally {
      setSubmitting(false);
      authInFlightRef.current = false;
    }
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 grid lg:grid-cols-12 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Left Editorial & Product Context Column (second on mobile so form appears first) */}
      <div className="order-2 lg:order-1 lg:col-span-6 flex flex-col justify-between p-6 sm:p-12 lg:p-14 bg-slate-50 dark:bg-slate-950 border-t lg:border-t-0 border-slate-200 dark:border-slate-800">
        <div>
          <div className="hidden lg:block">
            <BrandMark />
          </div>

          <div className="lg:mt-10 max-w-xl">
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.15] [text-wrap:balance]">
              Track every critical document deadline before it lapses.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              DocuPing stores your passports, insurance policies, contracts, and
              professional licenses in an isolated personal Cloud Firestore vault
              with automatic expiry status calculation and early renewal
              reminders.
            </p>
          </div>

          <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6 grid sm:grid-cols-3 gap-6 max-w-xl">
            <div>
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Isolated Cloud Vault
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Document records and optional links secured per verified account.
              </p>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live Status Engine
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Automatic Active, Expiring Soon, and Expired classification.
              </p>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Instant CSV Export
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Search, filter by category or format, and export records anytime.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 lg:mt-10 max-w-xl">
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {!imageFailed ? (
              <img
                src={authVaultVisual}
                alt="Organized cobalt-blue and white document folders on an architectural slate desk"
                onError={() => setImageFailed(true)}
                className="w-full h-56 sm:h-72 object-cover block"
              />
            ) : (
              <div className="w-full h-56 sm:h-72 bg-gradient-to-br from-slate-100 dark:from-slate-900 via-blue-50 dark:via-blue-950/40 to-slate-100 dark:to-slate-900 flex flex-col items-center justify-center p-6 text-center">
                <FileCheck2 className="w-10 h-10 text-blue-700 dark:text-blue-400 mb-3" />
                <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  DocuPing Personal Document Vault
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Passports · Insurance · Contracts · Licenses · Certifications
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Authentication Form Column (first on mobile for immediate access) */}
      <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col justify-center items-center p-6 sm:p-12 bg-white dark:bg-slate-900 lg:border-l lg:border-slate-200 dark:lg:border-slate-800 relative">
        {/* Top-right Theme Switcher on Auth Screen */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center transition-colors cursor-pointer"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <BrandMark />
          </div>

          <div className="mb-7">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {mode === 'login' && 'Sign in to your vault'}
              {mode === 'signup' && 'Create your DocuPing account'}
              {mode === 'reset' && 'Reset your password'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {mode === 'login' &&
                'Access your tracked documents and upcoming expiry alerts.'}
              {mode === 'signup' &&
                'Start tracking expiry dates across all your personal and business files.'}
              {mode === 'reset' &&
                'Enter your registered email address to receive a password reset link.'}
            </p>
          </div>

          {/* Segmented Mode Switch */}
          {mode !== 'reset' && (
            <div
              className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6"
              role="tablist"
              aria-label="Authentication mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => switchMode('login')}
                className={`py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => switchMode('signup')}
                className={`py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Google Sign-In Button */}
          {mode !== 'reset' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || submitting}
                className="w-full h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-sm font-medium inline-flex items-center justify-center gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 cursor-pointer"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                )}
                <span>
                  {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
                </span>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-slate-900 px-3 text-slate-500 dark:text-slate-400">
                    or continue with email
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Error & Success Feedback */}
          {activeError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs leading-relaxed flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="mb-5 p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs leading-relaxed flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                maxLength={160}
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    placeholder={
                      mode === 'signup'
                        ? 'Minimum 6 characters'
                        : 'Enter your password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-3.5 pr-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || googleLoading}
              className="w-full h-11 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {mode === 'login' &&
                  (submitting ? 'Signing in...' : 'Sign In')}
                {mode === 'signup' &&
                  (submitting ? 'Creating account...' : 'Create Account')}
                {mode === 'reset' &&
                  (submitting ? 'Sending link...' : 'Send Reset Link')}
              </span>
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full h-10 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                Back to Sign In
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
