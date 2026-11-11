import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  AllowedMimeType,
  DocumentFormData,
  DocumentRecord,
  EnrichedDocument,
  UserProfile,
} from '../types/document';
import {
  calculateExpiryStatus,
  EXPIRY_WARNING_THRESHOLD_DAYS,
  getTodayIsoLocal,
  normalizeDocumentUrl,
  parseIsoDateLocal,
} from '../utils/expiry';

/**
 * Ensures the authenticated, email-verified user has a profile document in /users/{uid}
 * and isolated PII record in /users/{uid}/private/profile.
 */
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (existingSnap.exists()) {
    const data = existingSnap.data() as UserProfile;
    return data;
  }

  const cleanName =
    (user.displayName || user.email?.split('@')[0] || 'DocuPing User')
      .trim()
      .slice(0, 80) || 'DocuPing User';

  const profilePayload = {
    uid: user.uid,
    displayName: cleanName,
    defaultReminderDays: EXPIRY_WARNING_THRESHOLD_DAYS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, profilePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  if (user.email) {
    const privatePath = `users/${user.uid}/private/profile`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'private', 'profile'), {
        uid: user.uid,
        email: user.email.slice(0, 160),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, privatePath);
    }
  }

  return {
    uid: user.uid,
    displayName: cleanName,
    defaultReminderDays: EXPIRY_WARNING_THRESHOLD_DAYS,
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Updates user display name or default reminder lead days in /users/{uid}.
 */
export async function updateUserPreferences(
  uid: string,
  updates: { displayName?: string; defaultReminderDays: number }
): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const payload: Record<string, unknown> = {
    defaultReminderDays: Math.min(
      365,
      Math.max(1, Math.round(updates.defaultReminderDays))
    ),
    updatedAt: serverTimestamp(),
  };

  if (
    typeof updates.displayName === 'string' &&
    updates.displayName.trim().length > 0
  ) {
    payload.displayName = updates.displayName.trim().slice(0, 80);
  }

  try {
    await updateDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

/**
 * Subscribes to the current user's documents in real time via Firestore onSnapshot.
 */
export function subscribeToUserDocuments(
  uid: string,
  onDocuments: (docs: DocumentRecord[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const docsQuery = query(
    collection(db, 'documents'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    docsQuery,
    (snapshot) => {
      const records: DocumentRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: data.ownerId,
          name: data.name,
          category: data.category,
          issueDate: data.issueDate,
          expiryDate: data.expiryDate,
          reminderDaysBefore: Number(
            data.reminderDaysBefore ?? EXPIRY_WARNING_THRESHOLD_DAYS
          ),
          status: data.status,
          fileName: data.fileName ?? '',
          fileType: (data.fileType ?? '') as AllowedMimeType | '',
          fileSize: Number(data.fileSize ?? 0),
          storagePath: data.storagePath ?? '',
          fileUrl: data.fileUrl ?? '',
          notes: data.notes ?? '',
          reminderDismissed: Boolean(data.reminderDismissed),
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        };
      });

      records.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      onDocuments(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'documents');
      } catch (wrappedErr) {
        onError(
          wrappedErr instanceof Error ? wrappedErr : new Error(String(wrappedErr))
        );
      }
    }
  );
}

/**
 * Saves a new document metadata record (and optional external document link) to Cloud Firestore.
 * Firebase Storage upload is temporarily disabled on the Spark free plan.
 */
export async function createDocumentRecord(params: {
  user: User;
  form: DocumentFormData;
}): Promise<string> {
  await ensureUserProfile(params.user);

  const newDocRef = doc(collection(db, 'documents'));
  const docId = newDocRef.id;

  const computedStatus = calculateExpiryStatus(params.form.expiryDate);
  const cleanFileUrl = normalizeDocumentUrl(params.form.fileUrl);

  const docPayload = {
    ownerId: params.user.uid,
    name: params.form.name.trim().slice(0, 140),
    category: params.form.category,
    issueDate: params.form.issueDate,
    expiryDate: params.form.expiryDate,
    reminderDaysBefore:
      Number(params.form.reminderDaysBefore) || EXPIRY_WARNING_THRESHOLD_DAYS,
    status: computedStatus,
    fileName: '',
    fileType: '',
    fileSize: 0,
    storagePath: '',
    fileUrl: cleanFileUrl,
    notes: params.form.notes.trim().slice(0, 1000),
    reminderDismissed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newDocRef, docPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `documents/${docId}`);
  }

  return docId;
}

/**
 * Updates an existing document's metadata and optional external link in Cloud Firestore.
 */
export async function updateDocumentRecord(params: {
  existingDoc: DocumentRecord;
  form: DocumentFormData;
}): Promise<void> {
  const docPath = `documents/${params.existingDoc.id}`;
  const docRef = doc(db, 'documents', params.existingDoc.id);

  const computedStatus = calculateExpiryStatus(params.form.expiryDate);

  const expiryChanged =
    params.form.expiryDate !== params.existingDoc.expiryDate;
  const escalatedStatus =
    (params.existingDoc.status === 'Active' && computedStatus !== 'Active') ||
    (params.existingDoc.status === 'Expiring Soon' &&
      computedStatus === 'Expired');
  const nextReminderDismissed =
    expiryChanged || escalatedStatus
      ? false
      : params.existingDoc.reminderDismissed;

  const cleanFileUrl = normalizeDocumentUrl(params.form.fileUrl);

  try {
    await updateDoc(docRef, {
      name: params.form.name.trim().slice(0, 140),
      category: params.form.category,
      issueDate: params.form.issueDate,
      expiryDate: params.form.expiryDate,
      reminderDaysBefore:
        Number(params.form.reminderDaysBefore) || EXPIRY_WARNING_THRESHOLD_DAYS,
      status: computedStatus,
      fileUrl: cleanFileUrl,
      notes: params.form.notes.trim().slice(0, 1000),
      reminderDismissed: nextReminderDismissed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

/**
 * Automatically updates stored document status fields in Cloud Firestore whenever the current date
 * moves a document across the Active (>30d), Expiring Soon (1-30d), or Expired (<0d) boundary.
 */
export async function syncStaleDocumentStatuses(
  docs: EnrichedDocument[]
): Promise<number> {
  const staleDocs = docs.filter((d) => d.status !== d.computedStatus);
  if (staleDocs.length === 0) return 0;

  const startOfTodayMs = parseIsoDateLocal(getTodayIsoLocal()).getTime();
  const CHUNK_SIZE = 450;
  try {
    for (let i = 0; i < staleDocs.length; i += CHUNK_SIZE) {
      const chunk = staleDocs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const updatedBeforeToday =
          !item.updatedAt || item.updatedAt.toMillis() < startOfTodayMs;
        const shouldTriggerUnreadAlert =
          item.status === 'Expiring Soon' &&
          item.computedStatus === 'Expired' &&
          item.reminderDismissed &&
          updatedBeforeToday;

        if (shouldTriggerUnreadAlert) {
          batch.update(doc(db, 'documents', item.id), {
            status: item.computedStatus,
            reminderDismissed: false,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(doc(db, 'documents', item.id), {
            status: item.computedStatus,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    }
    return staleDocs.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'documents');
  }
}

/**
 * Marks a single document notification as read (dismissed = true) or unread (dismissed = false).
 */
export async function setDocumentReminderDismissed(
  docId: string,
  dismissed: boolean
): Promise<void> {
  const docPath = `documents/${docId}`;
  try {
    await updateDoc(doc(db, 'documents', docId), {
      reminderDismissed: dismissed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

/**
 * Marks all provided unread notification documents as read in Cloud Firestore.
 */
export async function markAllNotificationsAsRead(
  docIds: string[]
): Promise<void> {
  if (docIds.length === 0) return;

  const CHUNK_SIZE = 450;
  try {
    for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
      const chunk = docIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.update(doc(db, 'documents', id), {
          reminderDismissed: true,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'documents');
  }
}

/**
 * Deletes a document metadata record from Cloud Firestore.
 */
export async function deleteDocumentRecord(
  existingDoc: DocumentRecord
): Promise<void> {
  const docPath = `documents/${existingDoc.id}`;
  try {
    await deleteDoc(doc(db, 'documents', existingDoc.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
