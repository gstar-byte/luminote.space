export type ReminderType = 'none' | 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface ReminderConfig {
  type: ReminderType;
  date?: number; // Timestamp for specific reminder time
  customInterval?: number; // e.g. every 2
  customUnit?: 'day' | 'week' | 'month'; // Days, weeks, or months
}

export interface Capsule {
  id: string;
  userId?: string; // Owner ID
  content: string;
  /** Optional subject / title line displayed above the note body. */
  subject?: string;
  category?: string;
  createdAt: number;
  updatedAt?: number;
  completed: boolean;
  isTodo: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  color?: string; // Hex color for custom override
  tag?: string;
  /** @deprecated Use tag instead. Only kept for backward compatibility and data migration. */
  tags?: string[];
  reminder?: ReminderConfig;
  attachments?: { url: string; type: 'image' | 'video' }[];
  isStarred?: boolean;
  /** Pinned notes sort to the top within the current sort key. */
  isPinned?: boolean;
  isAmbiguous?: boolean;
  clarificationPrompt?: string | null;
  countdownTarget?: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  onboarded?: boolean;
  hasNotesCreatedOrSeeded?: boolean;
}

export type FilterType = 
  | 'all' 
  | 'without-todo' 
  | 'pending-todo'
  | 'completed-todo' 
  | 'countdown'
  | 'without-reminder' 
  | 'repeat-reminder'
  | 'finished-reminder'
  | 'pure-note'
  | 'starred'
  | 'archived' 
  | 'trash';
