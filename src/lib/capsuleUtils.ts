import { Capsule } from '../types';
import { deleteField } from './supabaseAdapter';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface DbErrorInfo {
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
      providerId: string;
      email?: string | null;
    }[];
  };
}

export function handleDbError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error
    ? error.message
    : (error && typeof error === 'object' && 'message' in error)
      ? String((error as any).message)
      : String(error);

  const errInfo: DbErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: undefined,
    },
    operationType,
    path
  };
  console.error('DB Error (Gracefully handled): ', JSON.stringify(errInfo));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('luminote-db-error', { detail: errorMsg }));
  }
}

export function hasActiveReminder(c: Capsule): boolean {
  return !!(c.reminder && c.reminder.type !== 'none');
}

export function hasRepeatReminder(c: Capsule): boolean {
  if (!c.reminder || c.reminder.type === 'none' || c.reminder.type === 'once') return false;
  return true;
}

export function hasFinishedOneShotReminder(c: Capsule): boolean {
  const r = c.reminder;
  if (!r || r.type === 'none') return false;
  if (r.type !== 'once') return false;
  return r.date != null && r.date <= Date.now();
}

export function shouldBumpUpdatedAt(updates: Partial<Capsule>): boolean {
  return 'subject' in updates || 'content' in updates || 'attachments' in updates;
}

export function mergeCapsulePatch(c: Capsule, updates: Partial<Capsule>): Capsule {
  let n: Capsule = { ...c, ...updates };
  if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
    const v = updates.category;
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      const { category: _omit, ...rest } = n;
      n = rest as Capsule;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'tag')) {
    const v = updates.tag;
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      const { tag: _omit, ...rest } = n;
      n = rest as Capsule;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
    const v = updates.tags;
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
      const { tags: _omit, ...rest } = n;
      n = rest as Capsule;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'attachments')) {
    const a = updates.attachments;
    if (a === undefined || a === null || (Array.isArray(a) && a.length === 0)) {
      const { attachments: _omit, ...rest } = n;
      n = rest as Capsule;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'color')) {
    const col = updates.color;
    if (col === undefined || col === null || (typeof col === 'string' && col.trim() === '')) {
      const { color: _omit, ...rest } = n;
      n = rest as Capsule;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'isPinned')) {
    if (updates.isPinned !== true) {
      const { isPinned: _omit, ...rest } = n;
      n = rest as Capsule;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'reminder')) {
    const r = updates.reminder;
    if (r === undefined || r === null) {
      const { reminder: _omit, ...rest } = n;
      n = rest as Capsule;
    }
  }
  return n;
}

export function partialCapsuleToDb(updates: Partial<Capsule>): Record<string, unknown> {
  const cleanUpdates: Record<string, unknown> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (key === 'category') {
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
      return;
    }
    if (key === 'tag') {
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
      cleanUpdates['tags'] = deleteField();
      return;
    }
    if (key === 'attachments') {
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
      return;
    }
    if (key === 'color') {
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
      return;
    }
    if (key === 'isPinned') {
      if (!value) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
      return;
    }
    if (key === 'tags') {
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
      return;
    }
    if (key === 'reminder') {
      if (value === undefined || value === null) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
      return;
    }
    if (value !== undefined) {
      cleanUpdates[key] = value;
    } else {
      cleanUpdates[key] = null;
    }
  });
  return cleanUpdates;
}

export function tagSignature(tag: string | undefined): string {
  return (tag || '').trim();
}

export const SIDEBAR_W = { mobile: 160, desktop: 240 } as const;

export const plainTextFromContent = (content: any): string => {
  if (!content) return '';
  if (typeof content === 'string') {
    let trimmed = content.trim();
    if (!trimmed.startsWith('{')) {
      trimmed = trimmed
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
      trimmed = trimmed
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/^>\s+/gm, '')
        .replace(/^[-*+]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      return trimmed;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return plainTextFromContent(parsed);
    } catch {
      return trimmed;
    }
  }

  if (content.type === 'text') return content.text || '';
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(plainTextFromContent).filter(Boolean).join(' ').trim();
  }
  if (Array.isArray(content)) {
    return content.map(plainTextFromContent).filter(Boolean).join(' ').trim();
  }
  if (typeof content === 'object') {
    if (content.text) return content.text;
    if (content.value) return content.value;
  }
  return '';
};

export const formatNoteDateTime = (ts: number) => new Date(ts).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const repeatLabelForMenu = (r: any) => {
  if (!r || r.type === 'none') return 'None';
  if (r.type === 'once') return 'Once';
  if (r.type === 'custom') return `Every ${r.customInterval} ${r.customUnit}(s)`;
  return r.type.charAt(0).toUpperCase() + r.type.slice(1);
};

export function reminderBellTitle(capsule: Capsule): string {
  const r = capsule.reminder;
  if (!r || r.type === 'none' || r.date == null) return 'Reminder';
  const when = new Date(r.date).toLocaleString();
  const schedule = repeatLabelForMenu(r);
  return [`When: ${when}`, `Schedule: ${schedule}`].join('\n');
}
