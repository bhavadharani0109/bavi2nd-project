/**
 * Security Rules Adversarial Test Specification ("Dirty Dozen" + Valid Flows)
 * Designed for @firebase/rules-unit-testing against firestore.rules.
 */
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'docuping-security-test';

function makeValidDocPayload(uid: string, docId: string) {
  return {
    ownerId: uid,
    name: 'US Passport Renewal',
    category: 'Identity & Travel',
    issueDate: '2022-04-15',
    expiryDate: '2032-04-14',
    reminderDaysBefore: 30,
    status: 'Active',
    fileName: 'passport.pdf',
    fileType: 'application/pdf',
    fileSize: 245760,
    storagePath: `users/${uid}/documents/${docId}/passport.pdf`,
    fileUrl: 'https://firebasestorage.googleapis.com/v0/b/test/o/passport.pdf',
    notes: 'Primary travel passport',
    reminderDismissed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function runDirtyDozenSecuritySuite() {
  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    const userAContext = testEnv.authenticatedContext('userA', {
      email: 'alice@example.com',
      email_verified: true,
    });
    const userBContext = testEnv.authenticatedContext('userB', {
      email: 'bob@example.com',
      email_verified: true,
    });
    const unverifiedContext = testEnv.authenticatedContext('userUnverified', {
      email: 'unverified@example.com',
      email_verified: false,
    });
    const unauthContext = testEnv.unauthenticatedContext();

    const dbA = userAContext.firestore();
    const dbB = userBContext.firestore();
    const dbUnverified = unverifiedContext.firestore();
    const dbUnauth = unauthContext.firestore();

    // Seed valid user profiles for userA and userB
    await assertSucceeds(
      setDoc(doc(dbA, 'users', 'userA'), {
        uid: 'userA',
        displayName: 'Alice',
        defaultReminderDays: 30,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      setDoc(doc(dbB, 'users', 'userB'), {
        uid: 'userB',
        displayName: 'Bob',
        defaultReminderDays: 30,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Valid metadata-only document creation on Spark free plan
    await assertSucceeds(
      setDoc(doc(dbA, 'documents', 'doc_spark_1'), {
        ...makeValidDocPayload('userA', 'doc_spark_1'),
        fileName: '',
        fileType: '',
        fileSize: 0,
        storagePath: '',
        fileUrl: '',
      })
    );

    // Valid document creation with external link by owner
    await assertSucceeds(
      setDoc(doc(dbA, 'documents', 'doc_valid_1'), makeValidDocPayload('userA', 'doc_valid_1'))
    );

    // 1. Unauthenticated Write
    await assertFails(
      setDoc(doc(dbUnauth, 'documents', 'doc_1'), makeValidDocPayload('userA', 'doc_1'))
    );

    // 2. Unverified Email Spoof
    await assertFails(
      setDoc(
        doc(dbUnverified, 'documents', 'doc_2'),
        makeValidDocPayload('userUnverified', 'doc_2')
      )
    );

    // 3. Cross-Tenant Ownership Spoof
    await assertFails(
      setDoc(doc(dbA, 'documents', 'doc_3'), makeValidDocPayload('userB', 'doc_3'))
    );

    // 4. Cross-Tenant Read & Unscoped List Scrape
    await assertFails(getDoc(doc(dbB, 'documents', 'doc_valid_1')));
    await assertFails(getDocs(collection(dbB, 'documents')));
    await assertSucceeds(
      getDocs(query(collection(dbA, 'documents'), where('ownerId', '==', 'userA')))
    );

    // 5. Shadow / Ghost Field Injection
    await assertFails(
      setDoc(doc(dbA, 'documents', 'doc_5'), {
        ...makeValidDocPayload('userA', 'doc_5'),
        ghostAdminFlag: true,
      })
    );

    // 6. Ownership Hijack on Update
    await assertFails(
      updateDoc(doc(dbA, 'documents', 'doc_valid_1'), {
        ownerId: 'userB',
        updatedAt: serverTimestamp(),
      })
    );

    // 7. Timestamp Forgery (Client-supplied timestamp instead of request.time)
    await assertFails(
      setDoc(doc(dbA, 'documents', 'doc_7'), {
        ...makeValidDocPayload('userA', 'doc_7'),
        createdAt: Timestamp.fromMillis(1600000000000),
      })
    );

    // 8. Immortal Field Tampering (createdAt modified on update)
    await assertFails(
      updateDoc(doc(dbA, 'documents', 'doc_valid_1'), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 9. Disallowed File MIME Type
    await assertFails(
      setDoc(doc(dbA, 'documents', 'doc_9'), {
        ...makeValidDocPayload('userA', 'doc_9'),
        fileType: 'text/html',
      })
    );

    // 10. Oversized File Metadata Exhaustion (>10MB)
    await assertFails(
      setDoc(doc(dbA, 'documents', 'doc_10'), {
        ...makeValidDocPayload('userA', 'doc_10'),
        fileSize: 52428800,
      })
    );

    // 11. Cross-Tenant Storage Path Binding
    await assertFails(
      setDoc(doc(dbA, 'documents', 'doc_11'), {
        ...makeValidDocPayload('userA', 'doc_11'),
        storagePath: 'users/userB/documents/doc_11/passport.pdf',
      })
    );

    // 12. Resource ID Poisoning & Chronologically Inverted Dates
    await assertFails(
      setDoc(doc(dbA, 'documents', 'invalid id with spaces!'), {
        ...makeValidDocPayload('userA', 'doc_12'),
      })
    );
    await assertFails(
      setDoc(doc(dbA, 'documents', 'doc_12'), {
        ...makeValidDocPayload('userA', 'doc_12'),
        issueDate: '2028-01-01',
        expiryDate: '2025-01-01',
      })
    );

    // Valid Update & Delete by Owner
    await assertSucceeds(
      updateDoc(doc(dbA, 'documents', 'doc_valid_1'), {
        name: 'US Passport Renewed',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(dbB, 'documents', 'doc_valid_1')));
    await assertSucceeds(deleteDoc(doc(dbA, 'documents', 'doc_valid_1')));
  } finally {
    await testEnv.cleanup();
  }
}
