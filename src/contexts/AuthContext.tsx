import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  auth,
  getReadableErrorMessage,
  googleProvider,
  translateAuthError,
} from '../lib/firebase';
import {
  ensureUserProfile,
  updateUserPreferences,
} from '../services/documentService';
import { UserProfile } from '../types/document';

interface AuthContextValue {
  user: User | null;
  userRevision: number;
  emailVerified: boolean;
  profile: UserProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  savePreferences: (updates: {
    displayName?: string;
    defaultReminderDays: number;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRevision, setUserRevision] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let latestAuthEventId = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const eventId = ++latestAuthEventId;
      setUser(firebaseUser);
      setEmailVerified(Boolean(firebaseUser?.emailVerified));
      setAuthReady(true);

      if (firebaseUser && firebaseUser.emailVerified) {
        setProfileLoading(true);
        try {
          const loadedProfile = await ensureUserProfile(firebaseUser);
          if (eventId === latestAuthEventId) {
            setProfile(loadedProfile);
          }
        } catch (err) {
          if (eventId === latestAuthEventId) {
            setAuthError(getReadableErrorMessage(err));
          }
        } finally {
          if (eventId === latestAuthEventId) {
            setProfileLoading(false);
          }
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });

    return () => {
      latestAuthEventId += 1;
      unsubscribe();
    };
  }, []);

  const clearAuthError = () => setAuthError(null);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = translateAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const msg = translateAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const registerWithEmail = async (
    displayName: string,
    email: string,
    password: string
  ) => {
    setAuthError(null);
    const trimmedName = displayName.trim().slice(0, 80);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      if (trimmedName) {
        try {
          await updateProfile(cred.user, {
            displayName: trimmedName,
          });
        } catch {
          // Non-fatal: user account was created; profile can still be updated later
        }
      }
      try {
        await sendEmailVerification(cred.user);
      } catch (verifyErr) {
        const msg = translateAuthError(verifyErr);
        setAuthError(
          `Account created, but we could not send the verification email yet: ${msg}`
        );
      }
      await cred.user.reload();
      setUser(auth.currentUser);
      setEmailVerified(Boolean(auth.currentUser?.emailVerified));
      setUserRevision((rev) => rev + 1);
    } catch (err) {
      const msg = translateAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('No signed-in user found.');
    }
    try {
      await sendEmailVerification(auth.currentUser);
      setAuthError(null);
    } catch (err) {
      throw new Error(translateAuthError(err));
    }
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const refreshed = auth.currentUser;
    const isNowVerified = Boolean(refreshed.emailVerified);
    setUser(refreshed);
    setEmailVerified(isNowVerified);
    setUserRevision((rev) => rev + 1);
    if (isNowVerified) {
      setAuthError(null);
      setProfileLoading(true);
      try {
        const loadedProfile = await ensureUserProfile(refreshed);
        setProfile(loadedProfile);
      } finally {
        setProfileLoading(false);
      }
      return true;
    }
    return false;
  };

  const sendPasswordReset = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const msg = translateAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    setAuthError(null);
    await signOut(auth);
    setEmailVerified(false);
    setProfile(null);
  };

  const savePreferences = async (updates: {
    displayName?: string;
    defaultReminderDays: number;
  }) => {
    if (!user) throw new Error('You must be signed in to save preferences.');
    await updateUserPreferences(user.uid, updates);

    const cleanDisplayName = updates.displayName?.trim().slice(0, 80);
    if (cleanDisplayName && auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, {
          displayName: cleanDisplayName,
        });
        await auth.currentUser.reload();
        setUser(auth.currentUser);
        setUserRevision((rev) => rev + 1);
      } catch {
        // Firestore was successfully updated; auth reload is non-fatal
      }
    }

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            defaultReminderDays: updates.defaultReminderDays,
            displayName: cleanDisplayName || prev.displayName,
          }
        : null
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userRevision,
        emailVerified,
        profile,
        authReady,
        profileLoading,
        authError,
        clearAuthError,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerificationEmail,
        refreshVerificationStatus,
        sendPasswordReset,
        logout,
        savePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
