# DocuPing Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Owner Isolation**: Every `/documents/{documentId}` record belongs to a single verified Firebase Auth user (`ownerId == request.auth.uid`). No user can read, list, create, update, or delete another user's document.
2. **Verified Identity Requirement**: All write operations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Creation Timestamp**: On `/documents/{documentId}` and `/users/{userId}`, `ownerId`/`uid` and `createdAt` are immutable after creation (`incoming().ownerId == existing().ownerId`, `incoming().createdAt == existing().createdAt`).
4. **Server-Enforced Timestamps**: `createdAt` on create and `updatedAt` on create/update must strictly equal `request.time`.
5. **Strict Schema & Key Whitelisting**: Every document write must pass `isValidDocument(incoming())` / `isValidUserProfile(incoming())`, enforcing `keys().hasAll(...)` and `keys().hasOnly(...)` as well as action-scoped `affectedKeys().hasOnly(...)` on update.
6. **File Metadata, URL & Path Binding**: Binary Storage uploads are disabled on the Spark plan (`fileName: ""`, `fileType: ""`, `fileSize: 0`, `storagePath: ""`). Whenever provided, `fileUrl` must match `^https?://.+$` (`<= 2048` chars), `fileType` must be `application/pdf`, `image/jpeg`, or `image/png`, `fileSize` must be `<= 10485760` bytes, and `storagePath` must be strictly prefixed with `users/{request.auth.uid}/documents/`.
7. **Chronological Date Validity**: `issueDate` and `expiryDate` must match `^\d{4}-\d{2}-\d{2}$` and `issueDate <= expiryDate`.
8. **PII Isolation**: User email is isolated in `/users/{userId}/private/{infoId}` with strict owner-only `get` access and `allow list: if false` across all user collections.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Create `/documents/doc_1` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: Create `/documents/doc_2` with `request.auth.uid == "userA"` and `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Ownership Spoof**: Authenticated as `userA`, create `/documents/doc_3` with `ownerId: "userB"` -> `PERMISSION_DENIED`.
4. **Cross-Tenant Read / List Scrape**: Authenticated as `userA`, list `/documents` without `where('ownerId', '==', 'userA')` or get `/documents/userB_doc` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Create or update `/documents/doc_4` with an extra key `isAdmin: true` or `verifiedOverride: true` -> `PERMISSION_DENIED`.
6. **Ownership Hijack on Update**: Authenticated as `userA`, update `/documents/doc_4` changing `ownerId` from `"userA"` to `"userB"` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery (Backdating)**: Create `/documents/doc_5` with client-supplied `createdAt` != `request.time` -> `PERMISSION_DENIED`.
8. **Immortal Field Tampering**: Update `/documents/doc_4` modifying `createdAt` -> `PERMISSION_DENIED`.
9. **Disallowed File MIME Type**: Create `/documents/doc_6` with `fileType: "application/x-msdownload"` or `"text/html"` -> `PERMISSION_DENIED`.
10. **Oversized File Metadata Exhaustion**: Create `/documents/doc_7` with `fileSize: 52428800` (50 MB > 10 MB limit) -> `PERMISSION_DENIED`.
11. **Storage Path Traversal / Cross-Tenant Path Binding**: Authenticated as `userA`, create `/documents/doc_8` with `storagePath: "users/userB/documents/doc_8/secret.pdf"` -> `PERMISSION_DENIED`.
12. **Resource ID Poisoning / Invalid Dates**: Create `/documents/../../evil` or `/documents/doc_9` with `issueDate: "2027-01-01"`, `expiryDate: "2025-01-01"` -> `PERMISSION_DENIED`.
