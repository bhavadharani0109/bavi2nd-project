import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Checks live connectivity to the Cloud Firestore backend.
 */
export async function checkFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isOfflineFirestoreError(error)) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export function isOfflineFirestoreError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || '';
  const msg = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('the client is offline') ||
    msg.includes('failed to get document because the client is offline') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes('unavailable')
  );
}

checkFirestoreConnection();

/**
 * Translates Firebase Auth error codes into clear, actionable messages for users.
 */
export function translateAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completion.';
    case 'auth/cancelled-popup-request':
      return 'Google sign-in request was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not yet authorized for Firebase Authentication. Add this URL under Firebase Console → Authentication → Settings → Authorized domains.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. Please sign in with that method.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact support for assistance.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in the Firebase Console for this project. Use Continue with Google below or enable Email/Password under Authentication → Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error while connecting to Firebase Authentication. Check your internet connection.';
    default:
      return error instanceof Error
        ? error.message
        : 'Authentication failed. Please try again.';
  }
}

/**
 * Extracts a clean user-readable message from either a structured FirestoreErrorInfo JSON error
 * or a standard Error.
 */
export function getReadableErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred.';
  }
  try {
    const parsed = JSON.parse(error.message) as FirestoreErrorInfo;
    if (parsed && typeof parsed.error === 'string') {
      if (parsed.error.includes('Missing or insufficient permissions')) {
        if (!auth.currentUser?.emailVerified) {
          return 'Please verify your email address before saving or modifying documents in Firestore.';
        }
        return 'Permission denied by Firestore security rules. Please check your account permissions and try again.';
      }
      if (
        parsed.error.includes(
          "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
        )
      ) {
        return `Firestore daily free-tier read quota exceeded. Manage or upgrade your database at https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
      }
      if (parsed.error.includes('Quota exceeded')) {
        return 'Firestore daily free-tier quota exceeded. Quota resets tomorrow or can be upgraded in Firebase Console.';
      }
      return parsed.error;
    }
  } catch {
    // Standard non-JSON Error message
  }
  return error.message;
}
