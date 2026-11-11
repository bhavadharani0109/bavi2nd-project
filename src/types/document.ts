import { Timestamp } from 'firebase/firestore';

export const DOCUMENT_CATEGORIES = [
  'Identity & Travel',
  'Insurance',
  'Contracts & Legal',
  'Licenses & Permits',
  'Certifications',
  'Tax & Financial',
  'Medical & Health',
  'Warranty & Property',
  'Other',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type ExpiryStatus = 'Active' | 'Expiring Soon' | 'Expired';

export type AllowedMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

export const ALLOWED_MIME_TYPES: readonly AllowedMimeType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface DocumentRecord {
  id: string;
  ownerId: string;
  name: string;
  category: DocumentCategory;
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  reminderDaysBefore: number;
  status: ExpiryStatus;
  fileName: string;
  fileType: AllowedMimeType | '';
  fileSize: number;
  storagePath: string;
  fileUrl: string;
  notes: string;
  reminderDismissed: boolean;
  renewals?: RenewalRecord[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface RenewalRecord {
  id: string;
  renewalDate: string; // YYYY-MM-DD
  previousExpiryDate: string; // YYYY-MM-DD
  newExpiryDate: string; // YYYY-MM-DD
  notes?: string;
  createdAt?: string; // ISO string
}

export interface EnrichedDocument extends DocumentRecord {
  computedStatus: ExpiryStatus;
  daysRemaining: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  defaultReminderDays: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DocumentFormData {
  name: string;
  category: DocumentCategory;
  issueDate: string;
  expiryDate: string;
  reminderDaysBefore: number;
  fileUrl: string;
  notes: string;
}

export type NavSection =
  | 'overview'
  | 'documents'
  | 'expiring'
  | 'reminders'
  | 'calendar'
  | 'profile';
export type StatusFilter = 'All' | ExpiryStatus;
export type FormatFilter = 'All' | 'Metadata' | 'Link' | 'PDF' | 'JPG' | 'PNG';
export type SortField = 'expiryAsc' | 'expiryDesc' | 'nameAsc' | 'recentDesc';
