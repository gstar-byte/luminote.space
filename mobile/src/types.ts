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
  subject?: string; // Note Title aligned with PC
  category?: string;
  createdAt: number;
  updatedAt?: number;
  completed: boolean;
  isTodo: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  color?: string; // Hex color for custom override
  tags?: string[];
  reminder?: ReminderConfig;
  attachments?: { url: string; type: 'image' | 'video' }[];
  isStarred?: boolean;
  /** Pinned notes sort to the top (after multi-select / sidebar filters). */
  isPinned?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isPremium?: boolean;
  onboarded?: boolean;
}

export type FilterType = 
  | 'all' 
  | 'without-todo' 
  | 'pending-todo'
  | 'completed-todo' 
  | 'without-reminder'
  | 'repeat-reminder'
  | 'finished-reminder'
  | 'pure-note'
  | 'starred'
  | 'archived' 
  | 'trash';

export interface AppSettings {
  swipeEnabled: boolean;
  swipeRightAction: 'archive' | 'delete';
  edgePanelEnabled: boolean;
  ongoingNotificationEnabled: boolean;
  accessibilityWakeEnabled: boolean;
  quickCaptureLimit: number;
}

