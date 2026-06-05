import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Mic, 
  Search, 
  Check, 
  Trash2, 
  Filter, 
  X, 
  Clock,
  Zap,
  Type,
  Keyboard,
  Lightbulb,
  FileText,
  AlertCircle,
  Archive,
  MoreVertical,
  Calendar,
  ChevronDown,
  Bell,
  ChevronLeft,
  Folder,
  Tag as TagLucideIcon,
  PanelLeft,
  RotateCcw,
  Square,
  CheckSquare,
  Palette,
  LayoutGrid,
  LayoutList,
  Edit2,
  LogIn,
  LogOut,
  Settings,
  User as UserIcon,
  Image as ImageIcon,
  Video,
  Paperclip,
  XCircle,
  PlayCircle,
  MessageSquare,
  BarChart3,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  RefreshCw,
  Pin,
  Star,
  Sparkles,
  Mail, 
  Lock, 
  CheckCircle2, 
  CloudOff,
  ArrowRight, 
  UserPlus, 
  Apple, 
  ExternalLink, 
  Share2,
  Layers,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Quote,
  List,
  ListOrdered,
  ListChecks,
  Undo,
  Inbox,
  Check
} from 'lucide-react';
import { Capsule, FilterType, ReminderConfig, ReminderType, UserProfile } from './types';
import { PRESET_COLORS } from './constants';
import { categorizeThought } from './services/nlpRouter';
import { 
  getDb, 
  getAuth, 
  getGoogleProvider, 
  getAppleProvider,
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  deleteField,
  onAuthStateChanged,
  setDoc,
  getDocs,
  writeBatch,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  ensureFirebaseReady,
} from './lib/firebase';
import type { User } from 'firebase/auth';

// 启动后台静默异步预加载 Firebase SDK，提升后续数据交互速度
void ensureFirebaseReady();

import { showSystemNotification } from './lib/notifications';
import { cn } from './lib/utils';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

import { LandingPage } from './components/LandingPage';
import { AppLogo } from './components/AppLogo';
import { PremiumModal } from './components/PremiumModal';
import { SettingsModal } from './components/SettingsModal';
import { hasPremiumAccess, PAYWALL_ACTIVE } from './featureFlags';

import { CapsuleEditor } from './components/CapsuleEditor';
import { ClarificationPill } from './components/ClarificationPill';

const ONBOARDING_STORAGE_KEY = 'onboarding_v4_complete';

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Embedded preview / disabled storage must not white-screen the app */
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: getAuth().currentUser?.uid,
      email: getAuth().currentUser?.email,
      emailVerified: getAuth().currentUser?.emailVerified,
      isAnonymous: getAuth().currentUser?.isAnonymous,
      tenantId: getAuth().currentUser?.tenantId,
      providerInfo: getAuth().currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error (Gracefully handled): ', JSON.stringify(errInfo));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('luminote-db-error', { detail: errorMsg }));
  }
}

function hasActiveReminder(c: Capsule): boolean {
  return !!(c.reminder && c.reminder.type !== 'none');
}

/** Repeating reminder (not none / once). */
function hasRepeatReminder(c: Capsule): boolean {
  const t = c.reminder?.type;
  if (!t || t === 'none' || t === 'once') return false;
  return true;
}

/** One-shot reminder whose scheduled time has passed. */
function hasFinishedOneShotReminder(c: Capsule): boolean {
  const r = c.reminder;
  if (!r || r.type === 'none') return false;
  if (r.type !== 'once') return false;
  return r.date != null && r.date <= Date.now();
}

/** Toggling to-do done alone must not change list order (no updatedAt bump). */
function shouldBumpUpdatedAt(updates: Partial<Capsule>): boolean {
  const keys = (Object.keys(updates) as (keyof Capsule)[]).filter(
    (k) => updates[k] !== undefined,
  );
  if (keys.length === 1 && keys[0] === 'completed') return false;
  if (keys.length === 1 && keys[0] === 'isPinned') return false;
  return true;
}

/** Merge updates into a capsule and drop `category` / `tags` / `attachments` when cleared (Firestore deleteField). */
function mergeCapsulePatch(c: Capsule, updates: Partial<Capsule>): Capsule {
  let n: Capsule = { ...c, ...updates };
  if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
    const v = updates.category;
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      const { category: _omit, ...rest } = n;
      n = rest as Capsule;
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
    const t = updates.tags;
    if (t === undefined || t === null || (Array.isArray(t) && t.length === 0)) {
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

/** Firestore `update()` fields for batch writes (aligned with `updateCapsule` cleaning). */
function partialCapsuleToFirestore(updates: Partial<Capsule>): Record<string, unknown> {
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
    if (key === 'tags') {
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
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

function tagsSignature(tags: string[] | undefined): string {
  return [...(tags || [])].map((t) => t.trim()).filter(Boolean).sort().join('\0');
}

function CrownJewel({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Shadow Side (Left half subtle shade) */}
        <path d="M50 85H15V75H85V85H50Z" fill="#E67E22" />
        
        {/* Red Velvet Cushion */}
        <path d="M20 70C20 40 80 40 80 70H20Z" fill="#C0392B" />
        
        {/* Main Golden Body */}
        <path d="M10 40C15 45 20 55 20 75H80C80 55 85 45 90 40L80 55C75 45 80 30 70 25L75 40C70 45 60 45 50 40C40 45 30 45 25 40L30 25C20 30 25 45 20 55L10 40Z" fill="#F1C40F" stroke="#D35400" strokeWidth="1" />
        
        {/* Center Golden Pillar */}
        <path d="M42 45C42 35 45 25 50 15C55 25 58 35 58 45H42Z" fill="#F1C40F" stroke="#D35400" strokeWidth="1" />
        <circle cx="50" cy="18" r="6" fill="#F1C40F" stroke="#D35400" strokeWidth="1" />

        {/* Center Red Gem */}
        <ellipse cx="50" cy="58" rx="6" ry="9" fill="#E74C3C" stroke="#C0392B" strokeWidth="1" />
        
        {/* Bottom Base with Blue Gems */}
        <rect x="15" y="75" width="70" height="12" rx="2" fill="#F39C12" />
        <circle cx="22" cy="81" r="3" fill="#00A8E8" />
        <circle cx="36" cy="81" r="3" fill="#00A8E8" />
        <circle cx="50" cy="81" r="3" fill="#00A8E8" />
        <circle cx="64" cy="81" r="3" fill="#00A8E8" />
        <circle cx="78" cy="81" r="3" fill="#00A8E8" />

        {/* Highlight details */}
        <path d="M50 15L53 18L50 21L47 18L50 15Z" fill="white" opacity="0.3" />
      </svg>
    </div>
  );
}

/** Open width when sidebar is expanded (mobile narrower). */
const SIDEBAR_W = { mobile: 140, desktop: 240 } as const;

/**
 * Helper to extract plain text from Tiptap JSON or plain string
 */
const plainTextFromContent = (content: any): string => {
  if (!content) return '';
  if (typeof content === 'string') {
    let trimmed = content.trim();
    if (!trimmed.startsWith('{')) {
      // Strip HTML tags (纯文本模式以 HTML 源码持久化) then markdown syntax for card display
      trimmed = trimmed
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
      trimmed = trimmed
        .replace(/^#{1,6}\s+/gm, '')          // headings
        .replace(/\*\*(.+?)\*\*/g, '$1')      // bold
        .replace(/\*(.+?)\*/g, '$1')          // italic
        .replace(/~~(.+?)~~/g, '$1')          // strikethrough
        .replace(/^>\s+/gm, '')               // blockquote
        .replace(/^[-*+]\s+/gm, '')           // list items
        .replace(/^\d+\.\s+/gm, '')          // ordered list
        .replace(/`([^`]+)`/g, '$1')          // inline code
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // links
      return trimmed;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return plainTextFromContent(parsed);
    } catch (e) {
      return trimmed;
    }
  }
  
  // If it's a Tiptap node
  if (content.type === 'text') return content.text || '';
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(plainTextFromContent).filter(Boolean).join(' ').trim();
  }
  // If it's a Tiptap array
  if (Array.isArray(content)) {
    return content.map(plainTextFromContent).filter(Boolean).join(' ').trim();
  }
  // Fallback for weird objects
  if (typeof content === 'object') {
    if (content.text) return content.text;
    if (content.value) return content.value;
  }
};

// Play a high-end, premium double-ping chime using Web Audio API
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Pleasant high-end double chime sound (electronic bell)
    const playTone = (freq: number, startDelay: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + startDelay + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startDelay + duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(ctx.currentTime + startDelay);
      osc.stop(ctx.currentTime + startDelay + duration);
    };
    
    // Play B5 tone (approx 988Hz) followed by E6 tone (approx 1319Hz)
    playTone(987.77, 0, 0.25, 0.12);
    playTone(1318.51, 0.08, 0.35, 0.10);
  } catch (e) {
    console.warn('Failed to play notification sound:', e);
  }
}

export default function App() {
  // 【终极防刷风暴卫兵 / Anti-Storm Sandbox Sentry】
  // 如果检测到当前 React 实例处于 iframe 嵌套容器中（例如 Firebase 鉴权内部 iframe 或错误的重定向路由中），
  // 物理切断一切后续 UI 挂载和 Firebase 数据库快照监听，彻底杜绝任何递归加载风暴和配额恶意刷满隐患！
  if (typeof window !== 'undefined' && window !== window.top) {
    return null;
  }

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const raw = safeLocalStorageGet('luminote_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const hasSeenTutorial = React.useMemo(() => {
    if (!user) return false;
    return safeLocalStorageGet(ONBOARDING_STORAGE_KEY) === 'true' || user.onboarded === true;
  }, [user]);
  const [isCaptureCollapsed, setIsCaptureCollapsed] = useState(true);
  const [quickCaptureMode, setQuickCaptureMode] = useState<'buttons' | 'text' | 'voice'>('buttons');
  const [quickText, setQuickText] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [capsules, setCapsules] = useState<Capsule[]>([
    {
      id: 'mock-1', 
      content: 'Brainstorming for the new Lumi Note design language. Focusing on glassmorphism and capsule shapes.', 
      category: 'WORK', 
      tags: ['design', 'app'], 
      color: '#007AFF', 
      createdAt: Date.now() - 3600000, 
      updatedAt: Date.now() - 3600000, 
      userId: 'mock-user', 
      isArchived: false, 
      isDeleted: false,
      isTodo: false,
      completed: false
    },
    { 
      id: 'mock-2', 
      content: 'Buy milk and eggs on the way home.', 
      category: 'LIFE', 
      tags: ['grocery'], 
      color: '#FF2D55', 
      createdAt: Date.now() - 7200000, 
      updatedAt: Date.now() - 7200000, 
      userId: 'mock-user', 
      isArchived: false, 
      isDeleted: false,
      isTodo: true,
      completed: false
    },
    { 
      id: 'mock-3', 
      content: 'Researching Gemini Pro API capabilities for smart categorization.', 
      category: 'TECH', 
      tags: ['ai', 'api'], 
      color: '#AF52DE', 
      createdAt: Date.now() - 10800000, 
      updatedAt: Date.now() - 10800000, 
      userId: 'mock-user', 
      isArchived: false, 
      isDeleted: false,
      isTodo: false,
      completed: false
    }
  ]);
  const [demoCapsules, setDemoCapsules] = useState<Capsule[]>([]);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const allCapsules = React.useMemo(() => {
    return [...demoCapsules, ...capsules].sort((a, b) => {
      const ap = a.isPinned ? 1 : 0;
      const bp = b.isPinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      const valA = a[sortBy] || a.createdAt || 0;
      const valB = b[sortBy] || b.createdAt || 0;
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [demoCapsules, capsules, sortBy, sortOrder]);

  const hasSeededOrCreated = React.useMemo(() => {
    if (!user) return false;
    const seededKey = `luminote_has_notes_seeded_${user.uid}`;
    return (
      safeLocalStorageGet(seededKey) === 'true' ||
      user.hasNotesCreatedOrSeeded === true ||
      capsules.length > 0 ||
      demoCapsules.length > 0
    );
  }, [user, capsules.length, demoCapsules.length]);

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > 768,
  );
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768,
  );
  
  useEffect(() => {
    (window as any)._setIsSidebarOpen = setIsSidebarOpen;
  }, [setIsSidebarOpen]);
  // 未登录状态下，实时缓存用户创建的新便签至通用本地缓存，防止页面重定向刷新导致便签丢失
  useEffect(() => {
    if (!user) {
      const userCreatedCapsules = capsules.filter(c => c && c.id && typeof c.id === 'string' && !c.id.startsWith('mock-'));
      if (userCreatedCapsules.length > 0) {
        safeLocalStorageSet('luminote_anonymous_cached_notes', JSON.stringify(userCreatedCapsules));
      } else {
        safeLocalStorageRemove('luminote_anonymous_cached_notes');
      }
    }
  }, [capsules, user]);

  const [isListening, setIsListening] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProFeaturesModal, setShowProFeaturesModal] = useState(false);
  const [firedReminders, setFiredReminders] = useState<Capsule[]>([]);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const appStartTime = useRef(Date.now());
  const recentColorsRef = useRef<number[]>([]); // track last used color indices

  // Dynamically update document title based on fired (unread) reminders count
  useEffect(() => {
    const count = firedReminders.length;
    if (count > 0) {
      document.title = `(${count}) Lumi Note`;
    } else {
      document.title = 'Lumi Note';
    }
  }, [firedReminders]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [dataLoading, setDataLoading] = useState(true);
  const [isSyncFinished, setIsSyncFinished] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingClarificationCapsuleId, setPendingClarificationCapsuleId] = useState<string | null>(null);
  const [temporaryPendingCapsule, setTemporaryPendingCapsule] = useState<Capsule | null>(null);
  const wasCaptureCollapsedBeforeClarification = useRef(true);

  // Pull-to-refresh & Toast state
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'success' | 'error'>('info');
  const touchStartY = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isListening) {
      setQuickCaptureMode('buttons');
    }
  }, [isListening]);

  useEffect(() => {
    if (isCaptureCollapsed) {
      setQuickCaptureMode('buttons');
      setQuickText('');
    }
  }, [isCaptureCollapsed]);

  // 点击澄清面板外部自动消失并保存定型为普通便签
  useEffect(() => {
    if (!pendingClarificationCapsuleId) return;

    const handleClarificationOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // 如果点击的是澄清面板内部，不能关闭
      const pillEl = document.querySelector('.clarification-pill-outer');
      if (pillEl && pillEl.contains(target)) return;

      // 如果点击的是底部的输入控制台（输入框、麦克风等），不关闭，允许用户继续输入
      if (
        target.closest('footer') ||
        target.closest('[id^="quick-capture"]') ||
        target.closest('.fixed.bottom-6')
      ) {
        return;
      }
      
      // 点击外面其他地方：将 isAmbiguous 置为 false，让面板消失定型
      console.log('[OutsideClick] Clicking outside ClarificationPill, resolving as plain note.');
      updateCapsule(pendingClarificationCapsuleId, { isAmbiguous: false });
      setPendingClarificationCapsuleId(null);
      setTemporaryPendingCapsule(null);
    };

    document.addEventListener('mousedown', handleClarificationOutsideClick);
    document.addEventListener('touchstart', handleClarificationOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClarificationOutsideClick);
      document.removeEventListener('touchstart', handleClarificationOutsideClick);
    };
  }, [pendingClarificationCapsuleId]);

  const showToast = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    setToastType(type);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    const handleDbError = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      showToast(`DB Error: ${msg}`, 'error');
    };
    window.addEventListener('luminote-db-error', handleDbError);
    return () => window.removeEventListener('luminote-db-error', handleDbError);
  }, [showToast]);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    showToast("Syncing notes...", "info");
    
    // Artificial delay to show animation and "simulate" a refresh, 
    // though Firestore is real-time. This also clears any local staleness.
    await new Promise(r => setTimeout(r, 1000));
    setLastSyncTime(Date.now());
    setIsSyncing(false);
    showToast("Sync complete!", "success");
  }, [isSyncing, showToast]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const container = document.getElementById('scroll-container');
    if (!container) return;
    if (container.scrollTop === 0) {
      setIsPulling(true);
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    
    if (diff > 0) {
      const pullDistance = Math.min(diff * 0.4, 80);
      setPullY(pullDistance);
      if (diff > 10) {
        if (e.cancelable) e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullY >= 50 && !isSyncing) {
      void handleSync();
    }
    setPullY(0);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      handleSync();
    }, 1000 * 60 * 60); // 1 hour
    return () => clearInterval(interval);
  }, [handleSync]);
  
  const [isFilterNavExpanded, setIsFilterNavExpanded] = useState(false);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const seedDemoData = async () => {
    if (!user) return;
    setAuthProcessing(true);
    try {
      const generatedDemoCapsules: Capsule[] = [
        {
          id: 'demo-1',
          content: "🚀 Welcome to Lumi Note! This is a thought note to record your inspiration. It displays perfectly in both list and grid views.",
          category: "Technology",
          tags: ["intro", "welcome"],
          color: PRESET_COLORS[0],
          isTodo: false,
          completed: false,
          isArchived: false,
          isDeleted: false,
          attachments: [
            { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2664&auto=format&fit=crop", type: 'image' as const }
          ],
          createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
        },
        {
          id: 'demo-2',
          content: "🛒 Remember to buy milk and bread",
          category: "Personal",
          tags: ["shopping", "home"],
          color: PRESET_COLORS[1],
          isTodo: true,
          completed: false,
          isArchived: false,
          isDeleted: false,
          createdAt: Date.now() - 1000 * 60 * 60,
        },
        {
          id: 'demo-3',
          content: "🎯 Finish project presentation PPT",
          category: "Work",
          tags: ["important", "deadline"],
          color: PRESET_COLORS[2],
          isTodo: true,
          completed: true,
          isArchived: true,
          isDeleted: false,
          createdAt: Date.now() - 1000 * 60 * 60 * 5,
          updatedAt: Date.now() - 1000 * 60 * 30,
        },
        {
          id: 'demo-4',
          content: "💡 A crazy idea for a new App: AI-driven dream analyzer.",
          category: "Idea",
          tags: ["creative", "startup", "ai"],
          color: PRESET_COLORS[3],
          isTodo: false,
          completed: false,
          isArchived: false,
          isDeleted: false,
          createdAt: Date.now() - 1000 * 60 * 2,
        },
        {
          id: 'demo-5',
          content: "🗑️ This is an expired abandoned note, currently in the trash.",
          category: "Uncategorized",
          color: PRESET_COLORS[4],
          isTodo: false,
          completed: false,
          isArchived: false,
          isDeleted: true,
          createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
        },
        {
          id: 'demo-6',
          content: "⏰ Book tomorrow's dentist appointment",
          category: "Health",
          tags: ["appointment"],
          color: PRESET_COLORS[5],
          isTodo: true,
          completed: false,
          isArchived: false,
          isDeleted: false,
          reminder: { type: 'custom' as ReminderType, date: Date.now() + 86400000 },
          createdAt: Date.now(),
        },
        {
          id: 'demo-7',
          content: 'This is a completed todo item demo, visible in the "Completed To-do" view.',
          category: 'Personal',
          tags: ['demo', 'done'],
          color: '#434343',
          isTodo: true,
          completed: true,
          isArchived: false,
          isDeleted: false,
          createdAt: Date.now() - 172800000,
        },
        {
          id: 'demo-8',
          content: "📚 Read 'The Design of Everyday Things' Chapters 1-3",
          category: "Study",
          tags: ["reading", "design"],
          color: PRESET_COLORS[6] || '#AF52DE',
          isTodo: true,
          completed: false,
          isArchived: false,
          isDeleted: false,
          createdAt: Date.now() - 43200000,
        },
        {
          id: 'demo-9',
          content: "📞 Confirm next week's online meeting time with investors",
          category: "Work",
          tags: ["meeting", "important"],
          color: PRESET_COLORS[2],
          isTodo: true,
          completed: false,
          isArchived: false,
          isDeleted: false,
          reminder: { type: 'custom' as ReminderType, date: Date.now() + 86400000 * 2 },
          createdAt: Date.now() - 86400000,
        },
        {
          id: 'demo-10',
          content: "🎬 Recommended movies: Interstellar, Inception",
          category: "Entertainment",
          tags: ["movie", "weekend"],
          color: PRESET_COLORS[3],
          isTodo: false,
          completed: false,
          isArchived: false,
          isDeleted: false,
          createdAt: Date.now() - 172800000,
        },
        {
          id: 'demo-11',
          content: "✈️ Make travel plans for Kyoto, Japan at the end of the year: flights, hotels, visas",
          category: "Personal",
          tags: ["travel", "japan"],
          color: PRESET_COLORS[1],
          isTodo: true,
          completed: false,
          isArchived: false,
          isDeleted: false,
          createdAt: Date.now() - 259200000,
        },
        {
          id: 'demo-12',
          content: "💻 Optimize frontend first-screen loading speed, check Vite config and lazy loading",
          category: "Technology",
          tags: ["dev", "performance"],
          color: PRESET_COLORS[0],
          isTodo: true,
          completed: false,
          isArchived: false,
          isDeleted: false,
          createdAt: Date.now() - 1800000,
        }
      ];

      console.log('--- SEEDING DEMO DATA ---', generatedDemoCapsules);
      setDemoCapsules(generatedDemoCapsules);
      if (user) {
        safeLocalStorageSet(`luminote_has_notes_seeded_${user.uid}`, 'true');
        updateDoc(doc(getDb(), 'users', user.uid), { hasNotesCreatedOrSeeded: true }).catch(() => {});
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAuthProcessing(false);
    }
  };

  const [authError, setAuthError] = useState<string | null>(null);
  const [authProcessing, setAuthProcessing] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthProcessing(true);
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(getAuth(), email, password);
        await updateProfile(userCredential.user, {
          displayName: email.split('@')[0]
        });
      } else {
        await signInWithEmailAndPassword(getAuth(), email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('Email already in use.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('Password is too weak.');
      } else {
        setAuthError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setAuthProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError('Please enter your email first.');
      return;
    }
    setAuthProcessing(true);
    try {
      await sendPasswordResetEmail(getAuth(), email);
      setResetSent(true);
      setAuthError(null);
    } catch (err: any) {
      setAuthError('Could not send reset email.');
    } finally {
      setAuthProcessing(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthProcessing(true);
    try {
      const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile) {
        console.log("[GoogleSignIn] Mobile device detected, initiating signInWithRedirect...");
        await signInWithRedirect(getAuth(), getGoogleProvider());
      } else {
        console.log("[GoogleSignIn] Desktop device detected, initiating signInWithPopup...");
        await signInWithPopup(getAuth(), getGoogleProvider());
      }
    } catch (err: any) {
      console.error("Google Sign-In Error Captured:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setAuthError(
          `Unauthorized Domain: Current host "${window.location.hostname}" is not authorized for Google Sign-In in Firebase Console. Please add it under Authentication -> Settings.`
        );
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError("Google Sign-In pop-up was blocked by your browser. Please allow popups for this site, or try using a mobile browser.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        console.log("[GoogleSignIn] Popup closed by user.");
      } else {
        setAuthError(`Google Sign-In failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setAuthProcessing(false);
    }
  };

  // Auth Listener
  useEffect(() => {
    let userDocUnsubscribe: () => void;

    // Active extraction of redirect authentication credentials (critical for mobile browser compatibility)
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(getAuth());
        if (result && result.user) {
          console.log("[GoogleSignIn] Google Redirect sign-in success:", result.user.email);
        }
      } catch (err: any) {
        console.error("[GoogleSignIn] Error retrieving Redirect result:", err);
        if (err.code === 'auth/unauthorized-domain') {
          setAuthError(
            `Unauthorized Domain: Current host "${window.location.hostname}" is not authorized for Google Sign-In in Firebase Console. Please add it under Authentication -> Settings.`
          );
        } else if (err.code !== 'auth/web-storage-unsupported') {
          setAuthError(`Google Redirect Login failed: ${err.message}`);
        }
      }
    };
    handleRedirectResult();

    const unsubscribe = onAuthStateChanged(getAuth(), (firebaseUser: User | null) => {
      if (firebaseUser) {
        // 1. 快速通道：使用缓存的用户数据或基础 Firebase 身份在 1ms 内登入主界面，绝不 pending 卡死！
        const cachedRaw = safeLocalStorageGet('luminote_auth_user');
        let quickUser = null;
        if (cachedRaw) {
          try {
            quickUser = JSON.parse(cachedRaw);
          } catch { /* ignore */ }
        }
        if (!quickUser || quickUser.uid !== firebaseUser.uid) {
          quickUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Lumi User',
            photoURL: firebaseUser.photoURL,
            isPremium: false,
            onboarded: true // 默认为 true 避开 tour 干扰
          };
        }
        setUser(quickUser);
        setAuthLoading(false);

        // 2. 启动后台静默实时监听，网络慢用户也完全无感！
        const userDocRef = doc(getDb(), 'users', firebaseUser.uid);
        userDocUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              isPremium: docSnap.data().isPremium || false,
              onboarded: docSnap.data().onboarded || false,
              hasNotesCreatedOrSeeded: docSnap.data().hasNotesCreatedOrSeeded || false
            };
            setUser(userData);
            safeLocalStorageSet('luminote_auth_user', JSON.stringify(userData));
          } else {
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              isPremium: false,
              onboarded: false,
              hasNotesCreatedOrSeeded: false
            };
            setUser(userData);
            safeLocalStorageSet('luminote_auth_user', JSON.stringify(userData));
            setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              isPremium: false,
              onboarded: false,
              hasNotesCreatedOrSeeded: false,
              updatedAt: Date.now()
            }, { merge: true }).catch((e) => {
              console.error('Firestore setDoc user error (silenced):', e);
            });
          }
        }, (error) => {
          console.error("user doc snapshot background error (silenced):", error);
        });
      } else {
        if (userDocUnsubscribe) {
          userDocUnsubscribe();
        }
        setUser(null);
        safeLocalStorageRemove('luminote_auth_user');
        setCapsules([]);
        setDemoCapsules([]);
        setAuthLoading(false);
        setDataLoading(true);
        setIsSyncFinished(false);
      }
    });
    return () => {
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }
      unsubscribe();
    }
  }, []);

  // Firestore Sync Listener
  useEffect(() => {
    if (!user) return;

    // 开启 3.5秒安全同步超时降级机制。如果网络慢/波动导致 3.5秒内仍未拉取成功，
    // 强制将 dataLoading 设为 false 以进入主界面，不至于让用户卡死在 Syncing 画面。
    const syncTimeoutId = setTimeout(() => {
      console.warn('[Sync Timeout] Database sync took over 3.5s. Forcing UI entry via fallback.');
      setDataLoading(false);
    }, 3500);

    // 1. Instant loading of user-specific cached notes from localStorage
    const cacheKey = `luminote_cached_notes_${user.uid}`;
    const cached = safeLocalStorageGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          console.log("[OfflineCache] Loaded", parsed.length, "notes instantly from localStorage.");
          setCapsules(parsed);
          setDataLoading(false); // Cancel loading state immediately for instant feedback
          setIsSyncFinished(true); // 本地已有卡片缓存，直接标志同步完成，规避新手引导
        }
      } catch (e) {
        console.error("[OfflineCache] Failed to parse cached notes:", e);
      }
    }

    const q = query(
      collection(getDb(), 'capsules'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ 
        ...(d.data() as Capsule),
        id: d.id 
      }));
      const sortedDocs = docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      const isFromCache = snapshot.metadata.fromCache;
      
      // 【关键修复】如果此快照来自缓存且数据为空，可能是 Firestore 首帧在网络建连前的过渡空状态。
      // 我们在此拦截，决不能清空在 LocalStorage 已经秒开呈现出来的历史卡片，避免引发白屏与误触发新手引导。
      if (isFromCache && sortedDocs.length === 0) {
        console.log('[Firestore] Received empty snapshot from Cache. Keeping local cache capsules untouched.');
        return;
      }

      console.log('--- FIRESTORE DATA LOADED ---', sortedDocs.length, 'items');
      setSyncError(null);
      setCapsules(sortedDocs);
      
      // Update cache in background
      safeLocalStorageSet(cacheKey, JSON.stringify(sortedDocs));
      if (sortedDocs.length > 0) {
        safeLocalStorageSet(`luminote_has_notes_seeded_${user.uid}`, 'true');
        updateDoc(doc(getDb(), 'users', user.uid), { hasNotesCreatedOrSeeded: true }).catch(() => {});
      }

      if (!isFromCache || sortedDocs.length > 0) {
        clearTimeout(syncTimeoutId); // 服务器 data 成功拉回，清除超时控制器
        setDataLoading(false);
        setIsSyncFinished(true); // 标记网络数据真实拉回成功
      }
    }, (error) => {
      clearTimeout(syncTimeoutId);
      setSyncError(error instanceof Error ? error.message : String(error));
      handleFirestoreError(error, OperationType.LIST, 'capsules');
      setDataLoading(false); // 关键！配额超限报错时强制停止 Loading 转圈，让用户完美看到离线缓存的便签！
    });

    return () => {
      clearTimeout(syncTimeoutId);
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    let wasMobile = window.innerWidth <= 768;
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && !wasMobile) {
        setIsSidebarOpen(false);
      } else if (!mobile && wasMobile) {
        setIsSidebarOpen(true);
      }
      wasMobile = mobile;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tourActive = useRef(false);

  useEffect(() => {
    if (!user || authLoading) return;
    
    (window as any).startTour = async () => {
      if (tourActive.current) return;
      tourActive.current = true;
      
      safeLocalStorageSet(ONBOARDING_STORAGE_KEY, 'true');
      const updatedUser = { ...user, onboarded: true };
      setUser(updatedUser);
      safeLocalStorageSet('luminote_auth_user', JSON.stringify(updatedUser));
      updateDoc(doc(getDb(), 'users', user.uid), { onboarded: true }).catch((e) => {
        console.error('Firestore updateDoc onboarded auto-save error (silenced):', e);
      });
      
      // Force filter to 'all' to ensure elements are visible
      setFilter('all');

      setTimeout(() => {
        const driverObj = driver({
          showProgress: true,
          overlayColor: 'rgba(0,0,0,0.5)',
          steps: [
            { 
              element: '#generate-demo-btn', 
              popover: { 
                title: '1. Generate Demo Data', 
                description: 'Click here to generate example notes and explore the app instantly.', 
                side: "bottom", 
                align: 'center' 
              } 
            },
            { 
              element: '#quick-capture-area', 
              popover: { 
                title: '2. Quick Capture', 
                description: 'Capture thoughts instantly. Use the text field or the mic button.', 
                side: "top", 
                align: 'center' 
              } 
            },
            { 
              element: '#capsule-options-btn-0', 
              popover: { 
                title: '3. Note Menu', 
                description: 'Click here to manage your note - change color, set reminders, or delete.', 
                side: "left", 
                align: 'center' 
              } 
            },
            { 
              element: '#capsule-item-0', 
              popover: { 
                title: '4. Bulk Select', 
                description: 'Long press any note to enter selection mode for bulk operations.', 
                side: "bottom", 
                align: 'center' 
              } 
            },
            { 
              element: '#view-mode-toggle', 
              popover: { 
                title: '5. Toggle Layout', 
                description: 'Switch between list and grid views to find your favorite layout.', 
                side: "bottom", 
                align: 'center' 
              } 
            }
          ],
          onDestroyed: () => {
            tourActive.current = false;
            safeLocalStorageSet(ONBOARDING_STORAGE_KEY, 'true');
            if (user) {
              updateDoc(doc(getDb(), 'users', user.uid), { onboarded: true }).catch((e) => {
                // Silently degrade — onboarded flag is also cached locally
                console.error('Firestore updateDoc onboarded error (silenced):', e);
              });
            }
          }
        });

        driverObj.drive();
      }, 800); // Give enough time for DOM to update after seeding
    };

    // Auto-repair onboarding status for old users who already have notes
    if (user && (allCapsules.length > 0 || hasSeededOrCreated) && !hasSeenTutorial) {
      safeLocalStorageSet(ONBOARDING_STORAGE_KEY, 'true');
      const updatedUser = { ...user, onboarded: true };
      setUser(updatedUser);
      safeLocalStorageSet('luminote_auth_user', JSON.stringify(updatedUser));
      updateDoc(doc(getDb(), 'users', user.uid), { onboarded: true }).catch((e) => {
        // Silently degrade
        console.error('Firestore updateDoc onboarded auto-repair error (silenced):', e);
      });
    }

    // Only trigger tour if fully loaded, user is logged in, has not seen tutorial, has 0 notes, and cloud sync finished
    // 额外增加 !hasSeededOrCreated 检查：老用户即使暂时 capsules 为空也不触发 tour
    if (!authLoading && !dataLoading && user && !hasSeenTutorial && !hasSeededOrCreated && !tourActive.current && allCapsules.length === 0 && isSyncFinished) {
       setTimeout(() => {
         if ((window as any).startTour && !tourActive.current) {
           (window as any).startTour();
         }
       }, 1500); // 1.5s delay for stable trigger
    }
  }, [user, authLoading, dataLoading, allCapsules.length, hasSeenTutorial, hasSeededOrCreated, isSyncFinished]);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognition = useRef<any>(null);
  
  const allTags = Array.from(new Set(allCapsules.flatMap(c => c.tags || []))).sort();
  const allCategories = Array.from(new Set(allCapsules.map(c => c.category).filter(Boolean) as string[])).sort();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 批量「分类 & 标签」面板（批量场景下的唯一弹层，颜色/提醒已从批量中移除）
  const [batchTagCatOpen, setBatchTagCatOpen] = useState(false);
  const [batchCat, setBatchCat] = useState('');
  const [batchTags, setBatchTags] = useState('');

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const batchUpdate = async (updates: Partial<Capsule>) => {
    if (!user) return;
    try {
      const demoIds = Array.from<string>(selectedIds).filter((id: string) => id.startsWith('demo-'));
      const realIds = Array.from<string>(selectedIds).filter((id: string) => !id.startsWith('demo-'));

      if (demoIds.length > 0) {
        const bump = shouldBumpUpdatedAt(updates);
        const ts = Date.now();
        setDemoCapsules((prev) =>
          prev.map((c) => {
            if (!demoIds.includes(c.id)) return c;
            const merged = mergeCapsulePatch(c, updates);
            return bump ? { ...merged, updatedAt: ts } : merged;
          }),
        );
      }

      if (realIds.length > 0) {
        const bump = shouldBumpUpdatedAt(updates);
        const ts = Date.now();

        // Optimistic batch local update
        setCapsules((prev) =>
          prev.map((c) => {
            if (!realIds.includes(c.id)) return c;
            const merged = mergeCapsulePatch(c, updates);
            return bump ? { ...merged, updatedAt: ts } : merged;
          })
        );

        const batch = writeBatch(getDb());
        const now = Date.now();
        const clean = partialCapsuleToFirestore(updates);
        if (bump) {
          clean.updatedAt = now;
        }
        realIds.forEach((id: string) => {
          const docRef = doc(getDb(), 'capsules', id);
          batch.update(docRef, clean as Record<string, unknown>);
        });
        await batch.commit();
      }
      setSelectedIds(new Set());
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'capsules/batch');
    }
  };

  const batchRemovePermanently = async () => {
    if (!user) return;
    try {
      const demoIds = Array.from<string>(selectedIds).filter((id: string) => id.startsWith('demo-'));
      const realIds = Array.from<string>(selectedIds).filter((id: string) => !id.startsWith('demo-'));

      if (demoIds.length > 0) {
        setDemoCapsules(prev => prev.filter(c => !demoIds.includes(c.id)));
      }

      if (realIds.length > 0) {
        const batch = writeBatch(getDb());
        realIds.forEach((id: string) => {
          const docRef = doc(getDb(), 'capsules', id);
          batch.delete(docRef);
        });
        await batch.commit();
      }
      setSelectedIds(new Set());
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'capsules/batch');
    }
  };

  const transcriptRef = useRef('');

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognition.current = new (window as any).webkitSpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.lang = 'zh-CN';

      recognition.current.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += t;
          } else {
            interim += t;
          }
        }
        if (final) {
          transcriptRef.current += final;
        }
        setInputText(transcriptRef.current + interim);
      };

      recognition.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.current.onstart = () => {
        console.log('Speech recognition started');
      };

      recognition.current.onend = () => {
        setIsListening(false);
        const text = transcriptRef.current.trim();
        if (text) {
          handleCreateCapsule(text);
          transcriptRef.current = '';
        }
      };
    }
  }, []);

  const [editingCapsule, setEditingCapsule] = useState<Capsule | null>(null);
  /** Local draft for detail editor — avoids Firestore write on every keystroke. */
  const [editContentDraft, setEditContentDraft] = useState('');
  const editContentDraftRef = useRef('');
  const [editSubjectDraft, setEditSubjectDraft] = useState('');
  const editSubjectDraftRef = useRef('');
  const editSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editDetailCategory, setEditDetailCategory] = useState('');
  const [editDetailTags, setEditDetailTags] = useState('');
  const editDetailCategoryRef = useRef('');
  const editDetailTagsRef = useRef('');
  const editDetailCapsuleIdRef = useRef<string | null>(null);
  const editingCapsuleRef = useRef<Capsule | null>(null);
  editingCapsuleRef.current = editingCapsule;
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [editMode, setEditMode] = useState<'plain' | 'markdown'>('markdown');
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isUploadingMediaRef = useRef(false);

  useEffect(() => {
    if (!editingCapsule) {
      editDetailCapsuleIdRef.current = null;
      return;
    }
    if (editDetailCapsuleIdRef.current !== editingCapsule.id) {
      editDetailCapsuleIdRef.current = editingCapsule.id;
      const c = editingCapsule.category || '';
      const t = (editingCapsule.tags || []).join(', ');
      setEditDetailCategory(c);
      setEditDetailTags(t);
      editDetailCategoryRef.current = c;
      editDetailTagsRef.current = t;
      setIsMarkdownPreview(false);
    }
  }, [editingCapsule]);

  const clearAllData = async () => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) return;
    
    setAuthProcessing(true);
    try {
      const q = query(collection(getDb(), 'capsules'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(getDb());
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      setCapsules([]);
      setDemoCapsules([]);
      alert('All data has been cleared.');
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data.');
    } finally {
      setAuthProcessing(false);
      setShowSettingsModal(false);
    }
  };

  const handleCreateCapsule = async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setInputText('');
    
    // Immediately focus back to input for potential next input
    inputRef.current?.focus();
    
    try {
      // Use NLP router (DeepSeek -> Local fallback)
      const parsed = await categorizeThought(text);
      console.log('[handleCreate] parsed result:', JSON.stringify(parsed));
      const { category, tags, refinedContent, isTodo, reminder, isStarred, isPinned } = parsed;
      
      // Select a color ensuring differentiation within last 8 notes
      const recent = recentColorsRef.current;
      const avoidSet = new Set(recent.slice(-7)); // avoid last 7 used colors
      const available = PRESET_COLORS.map((_, i) => i).filter((i) => !avoidSet.has(i));
      const colorIndex = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : Math.floor(Math.random() * PRESET_COLORS.length);
      recent.push(colorIndex);
      if (recent.length > 7) recent.shift(); // keep last 7
      const randomColor = PRESET_COLORS[colorIndex];
      
      const hasReminder = Boolean(reminder && typeof reminder === 'object' && reminder.type && reminder.type !== 'none');
      const hasStar = Boolean(isStarred);
      const hasPin = Boolean(isPinned);
      const hasClearIntent = (isTodo && hasReminder) || hasStar || hasPin;
      const shouldShowPill = !hasClearIntent;

      const newCapsuleData: Record<string, unknown> = {
        userId: user?.uid,
        content: '',
        subject: refinedContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completed: false,
        isTodo: Boolean(
          isTodo ||
            (reminder &&
              typeof reminder === 'object' &&
              (reminder as { type?: string }).type &&
              (reminder as { type?: string }).type !== 'none'),
        ),
        isArchived: false,
        isDeleted: false,
        reminder: reminder || null,
        color: randomColor,
        isAmbiguous: shouldShowPill,
        clarificationPrompt: shouldShowPill ? 'Quickly set a reminder, star, pin, or keep as note?' : null
      };
      if (category) newCapsuleData.category = category;
      if (tags && tags.length > 0) newCapsuleData.tags = tags;
      if (isStarred) newCapsuleData.isStarred = true;
      if (isPinned) newCapsuleData.isPinned = true;
      
      console.log('[handleCreate] saving to Firestore:', JSON.stringify({ content: newCapsuleData.content, subject: newCapsuleData.subject, isTodo: newCapsuleData.isTodo, hasReminder: !!newCapsuleData.reminder, isAmbiguous: newCapsuleData.isAmbiguous }));
      
      const docRef = await addDoc(collection(getDb(), 'capsules'), newCapsuleData);
      console.log('[handleCreate] saved doc id:', docRef.id);

      // Automatically request browser notification permission if a new reminder was created
      if (hasReminder && window.Notification && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      const createdCapsule: Capsule = {
        id: docRef.id,
        userId: user?.uid || '',
        content: '',
        subject: refinedContent,
        createdAt: newCapsuleData.createdAt as number,
        updatedAt: newCapsuleData.updatedAt as number,
        completed: false,
        isTodo: newCapsuleData.isTodo as boolean,
        isArchived: false,
        isDeleted: false,
        reminder: (newCapsuleData.reminder || null) as any,
        color: randomColor,
        isAmbiguous: shouldShowPill,
        clarificationPrompt: shouldShowPill ? 'Quickly set a reminder, star, pin, or keep as note?' : null,
        category: (newCapsuleData.category || undefined) as string,
        tags: (newCapsuleData.tags || undefined) as string[],
        isStarred: (newCapsuleData.isStarred || undefined) as boolean,
        isPinned: (newCapsuleData.isPinned || undefined) as boolean
      };

      // Optimistic local state update (Instant Response)
      setCapsules(prev => {
        if (prev.some(c => c.id === docRef.id)) return prev;
        return [createdCapsule, ...prev];
      });
      
      // Manage ClarificationPill state
      if (shouldShowPill) {
        wasCaptureCollapsedBeforeClarification.current = isCaptureCollapsed;
        setTemporaryPendingCapsule(createdCapsule);
        setPendingClarificationCapsuleId(docRef.id);
        // ClarificationPill 已改为 portal 浮层，无需展开 footer
      } else {
        setTemporaryPendingCapsule(null);
        setPendingClarificationCapsuleId(null);
      }

      if (user) {
        safeLocalStorageSet(`luminote_has_notes_seeded_${user.uid}`, 'true');
        updateDoc(doc(getDb(), 'users', user.uid), { hasNotesCreatedOrSeeded: true }).catch(() => {});
      }
    } catch (error) {
      console.error('[handleCreate] ERROR in try block:', error);
      const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      const fallbackDoc = {
        userId: user?.uid,
        content: '',
        subject: text,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completed: false,
        isTodo: false,
        isArchived: false,
        isDeleted: false,
        color: randomColor
      };
      try {
        const docRef = await addDoc(collection(getDb(), 'capsules'), fallbackDoc);
        console.log('[handleCreate] fallback saved (raw text)');
        
        // Optimistic local state update for fallback flow
        setCapsules(prev => {
          if (prev.some(c => c.id === docRef.id)) return prev;
          return [{ id: docRef.id, ...fallbackDoc } as Capsule, ...prev];
        });
        
        if (user) {
          safeLocalStorageSet(`luminote_has_notes_seeded_${user.uid}`, 'true');
          updateDoc(doc(getDb(), 'users', user.uid), { hasNotesCreatedOrSeeded: true }).catch(() => {});
        }
      } catch (innerError) {
        console.error('[handleCreate] fallback ERROR:', innerError);
        handleFirestoreError(innerError, OperationType.CREATE, 'capsules');
      }
    } finally {
      setIsProcessing(false);
      // Ensure focus again just in case
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const updateCapsule = useCallback(
    async (id: string, updates: Partial<Capsule>) => {
      if (!user) return;
      const now = Date.now();
      const original = allCapsules.find(c => c.id === id);
      let bump = shouldBumpUpdatedAt(updates);
      
      // If content is being updated, only bump if it actually changed
      if (updates.content !== undefined && original && original.content === updates.content) {
        // Content didn't change, so don't bump for THIS update if only content was provided
        const otherKeys = Object.keys(updates).filter(k => k !== 'content' && k !== 'updatedAt');
        if (otherKeys.length === 0) bump = false;
      }

      setEditingCapsule((prev) => {
        if (!prev || prev.id !== id) return prev;
        const merged = mergeCapsulePatch(prev, updates);
        return bump ? { ...merged, updatedAt: now } : merged;
      });

      if (id.startsWith('demo-')) {
        setDemoCapsules((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const merged = mergeCapsulePatch(c, updates);
            return bump ? { ...merged, updatedAt: now } : merged;
          }),
        );
        return;
      }

      // Optimistic Local State Update (Instant Response)
      setCapsules((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const merged = mergeCapsulePatch(c, updates);
          return bump ? { ...merged, updatedAt: now } : merged;
        })
      );

      try {
        const docRef = doc(getDb(), 'capsules', id);
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
          if (key === 'tags') {
            if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
              cleanUpdates[key] = deleteField();
            } else {
              cleanUpdates[key] = value;
            }
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
          if (key === 'isPinned') {
            if (!value) {
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
        if (bump) {
          cleanUpdates.updatedAt = now;
        }
        await updateDoc(docRef, cleanUpdates as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `capsules/${id}`);
      }
    },
    [user, allCapsules],
  );

  const updateCapsuleRef = useRef(updateCapsule);
  updateCapsuleRef.current = updateCapsule;

  const patchCapsule = useCallback((id: string, updates: Partial<Capsule>) => {
    return updateCapsuleRef.current(id, updates);
  }, []);

  useEffect(() => {
    if (editingCapsule) {
      const t = editingCapsule.content;
      setEditContentDraft(t);
      editContentDraftRef.current = t;
      const s = editingCapsule.subject || '';
      setEditSubjectDraft(s);
      editSubjectDraftRef.current = s;
    }
    const id = editingCapsule?.id;
    if (!id) {
      return () => {
        if (editSaveTimerRef.current) {
          clearTimeout(editSaveTimerRef.current);
          editSaveTimerRef.current = null;
        }
      };
    }
    return () => {
      if (editSaveTimerRef.current) {
        clearTimeout(editSaveTimerRef.current);
        editSaveTimerRef.current = null;
      }
      void updateCapsuleRef.current(id, { 
        content: editContentDraftRef.current,
        subject: editSubjectDraftRef.current ? editSubjectDraftRef.current : undefined
      });
    };
  }, [editingCapsule?.id]);

  const queueEditContentSave = useCallback(() => {
    if (!editingCapsule) return;
    const id = editingCapsule.id;
    if (editSaveTimerRef.current) clearTimeout(editSaveTimerRef.current);
    editSaveTimerRef.current = setTimeout(() => {
      editSaveTimerRef.current = null;
      const draft = editContentDraftRef.current;
      void updateCapsuleRef.current(id, { content: draft });
      setEditingCapsule((prev) =>
        prev?.id === id ? { ...prev, content: draft } : prev,
      );
    }, 450);
  }, [editingCapsule?.id]);

  const queueEditSubjectSave = useCallback(() => {
    if (!editingCapsule) return;
    const id = editingCapsule.id;
    if (editSaveTimerRef.current) clearTimeout(editSaveTimerRef.current);
    editSaveTimerRef.current = setTimeout(() => {
      editSaveTimerRef.current = null;
      const draft = editSubjectDraftRef.current;
      void updateCapsuleRef.current(id, { subject: draft ? draft : undefined });
      setEditingCapsule((prev) =>
        prev?.id === id ? { ...prev, subject: draft ? draft : undefined } : prev,
      );
    }, 450);
  }, [editingCapsule?.id]);

  const closeEditingModal = useCallback(() => {
    if (editSaveTimerRef.current) {
      clearTimeout(editSaveTimerRef.current);
      editSaveTimerRef.current = null;
    }
    const cap = editingCapsuleRef.current;
    if (cap) {
      const cat = editDetailCategoryRef.current.trim();
      const tagParts = editDetailTagsRef.current.split(',').map((t) => t.trim()).filter(Boolean);
      const prevCat = (cap.category || '').trim();
      const patch: Partial<Capsule> = {};
      if (prevCat !== cat) {
        patch.category = cat ? cat : undefined;
      }
      if (tagsSignature(cap.tags) !== tagsSignature(tagParts)) {
        patch.tags = tagParts.length ? tagParts : undefined;
      }
      if (cap.content !== editContentDraftRef.current) {
        patch.content = editContentDraftRef.current;
      }
      if ((cap.subject || '') !== editSubjectDraftRef.current) {
        patch.subject = editSubjectDraftRef.current ? editSubjectDraftRef.current : undefined;
      }
      if (Object.keys(patch).length > 0) {
        void updateCapsuleRef.current(cap.id, patch);
      }
    }
    setEditingCapsule(null);
    setIsMarkdownPreview(true);
  }, []);

  // --- Markdown helpers ---
  function renderMarkdown(md: string): string {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Custom underline support: ++text++ -> <u>text</u>
    html = html.replace(/\+\+([^\+]+)\+\+/g, '<u>$1</u>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-[#F2F2F7] dark:bg-[#1C1C1E] p-3 rounded-xl text-xs font-mono overflow-x-auto my-2"><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-[#F2F2F7] dark:bg-[#1C1C1E] px-1 py-0.5 rounded text-xs font-mono">$1</code>');
    // Bold
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Strikethrough
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    // Headings
    html = html.replace(/^###### (.*$)/gim, '<h6 class="text-sm font-bold mt-2 mb-1">$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5 class="text-sm font-bold mt-2 mb-1">$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-base font-bold mt-2 mb-1">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-2 mb-1">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-3 mb-1">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black mt-3 mb-2">$1</h1>');
    // Blockquote
    html = html.replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-4 border-[#007AFF] pl-3 italic text-[#636366] my-2">$1</blockquote>');
    // Images
    html = html.replace(/!\[([^\]]*)\]\s*\(([\s\S]+?)\)/g, (match, alt, src) => {
      const cleanSrc = src.replace(/[\r\n\s]/g, '');
      return `<img src="${cleanSrc}" alt="${alt}" class="rounded-xl my-2 max-w-full" />`;
    });
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" class="text-[#007AFF] underline">$1</a>');
    // Horizontal rule
    html = html.replace(/^(-{3,}|\*{3,})$/gim, '<hr class="border-t border-[#E5E5EA] my-3" />');
    // Unordered list
    html = html.replace(/^(\s*)[-\*\+] (.*$)/gim, '<li class="ml-4 list-disc">$2</li>');
    // Ordered list
    html = html.replace(/^(\s*)\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$2</li>');
    // Checkbox - [ ] / [x]
    html = html.replace(/^\s*[-\*\+] \[ \] (.*$)/gim, '<div class="flex items-center gap-2 ml-4 my-1"><span class="w-3.5 h-3.5 border-2 border-[#8E8E93] rounded-sm inline-block"></span><span>$1</span></div>');
    html = html.replace(/^\s*[-\*\+] \[x\] (.*$)/gim, '<div class="flex items-center gap-2 ml-4 my-1"><span class="w-3.5 h-3.5 bg-[#34C759] rounded-sm inline-block flex items-center justify-center text-white text-[8px]">&#10003;</span><span>$1</span></div>');

    // Line breaks
    html = html.replace(/\n/g, '<br />');

    return html;
  }

  function insertMarkdown(syntaxBefore: string, syntaxAfter: string = '') {
    const ta = editTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = editContentDraftRef.current;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    const newText = before + syntaxBefore + selected + syntaxAfter + after;
    editContentDraftRef.current = newText;
    setEditContentDraft(newText);
    queueEditContentSave();
    requestAnimationFrame(() => {
      ta.focus();
      const newCursor = start + syntaxBefore.length + selected.length;
      ta.setSelectionRange(newCursor, newCursor);
    });
  }

  const insertImageUrlToDraft = (url: string) => {
    const cleanUrl = url.replace(/[\r\n\s]/g, '');
    const ta = editTextareaRef.current;
    if (ta) {
      insertMarkdown('![Image](' + cleanUrl + ')', '');
    } else {
      const draft = editContentDraftRef.current;
      const separator = draft.endsWith('\n') || draft === '' ? '' : '\n';
      const newText = draft + separator + `![Image](${cleanUrl})`;
      editContentDraftRef.current = newText;
      setEditContentDraft(newText);
      queueEditContentSave();
    }
  };

  const handleAttachMedia = (e: React.ChangeEvent<HTMLInputElement>, capsule: Capsule) => {
    isUploadingMediaRef.current = false;
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    if (editingCapsule?.id === capsule.id) {
      const draft = editContentDraftRef.current;
      void updateCapsule(capsule.id, { content: draft });
      setEditingCapsule((prev) =>
        prev?.id === capsule.id ? { ...prev, content: draft } : prev,
      );
      if (editSaveTimerRef.current) {
        clearTimeout(editSaveTimerRef.current);
        editSaveTimerRef.current = null;
      }
    }
    
    if (!hasPremiumAccess(user) && (file.size > 5 * 1024 * 1024 || isVideo)) {
       alert("Large images (>5MB) and video uploads require Lumi Note Pro.");
       setShowPremiumModal(true);
       return;
    }
    
    if (file.size > 800 * 1024 || isVideo) {
      const url = URL.createObjectURL(file);
      if (isVideo) {
        const newAttachments = [...(capsule.attachments || []), { url, type: 'video' as const }];
        updateCapsule(capsule.id, { attachments: newAttachments });
        setEditingCapsule((prev) =>
          prev?.id === capsule.id ? { ...prev, attachments: newAttachments } : prev,
        );
      } else {
        insertImageUrlToDraft(url);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (ee) => {
      const dataUrl = ee.target?.result as string;
      insertImageUrlToDraft(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (capsule: Capsule, index: number) => {
    if (editSaveTimerRef.current) {
      clearTimeout(editSaveTimerRef.current);
      editSaveTimerRef.current = null;
    }
    const draft = editContentDraftRef.current;
    const newAttachments = [...(capsule.attachments || [])];
    newAttachments.splice(index, 1);
    const patch: Partial<Capsule> = {
      attachments: newAttachments.length ? newAttachments : undefined,
    };
    if (editingCapsule?.id === capsule.id) {
      patch.content = draft;
    }
    void updateCapsule(capsule.id, patch);
    setEditingCapsule((prev) =>
      prev?.id === capsule.id
        ? mergeCapsulePatch(
            { ...prev, content: draft },
            { attachments: newAttachments.length ? newAttachments : undefined },
          )
        : prev,
    );
  };

  const removeCapsuleForever = async (id: string) => {
    if (!user) return;
    if (id.startsWith('demo-')) {
      setDemoCapsules(prev => prev.filter(c => c.id !== id));
      return;
    }
    setCapsules(prev => prev.filter(c => c.id !== id));
    try {
      const docRef = doc(getDb(), 'capsules', id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `capsules/${id}`);
    }
  };

  const startListening = () => {
    if (!hasPremiumAccess(user)) {
       alert("Unlimited Voice Transcription requires Lumi Note Pro.");
       setShowPremiumModal(true);
       return;
    }
    if (recognition.current) {
      try {
        transcriptRef.current = '';
        setInputText('');
        setIsListening(true);
        recognition.current.start();
      } catch (e) {
        // Already started or other error; try restart
        try {
          recognition.current.stop();
          setTimeout(() => {
            transcriptRef.current = '';
            setInputText('');
            setIsListening(true);
            recognition.current?.start();
          }, 100);
        } catch (inner) {
          console.log('Speech recognition restart failed', inner);
        }
      }
    } else {
      alert('Your browser does not support speech recognition.');
    }
  };

  const stopListening = () => {
    if (recognition.current && isListening) {
      try {
        recognition.current.stop();
      } catch (e) {
        console.log('Speech recognition stop error', e);
      }
    }
  };

  const renameCategory = (oldCat: string) => {
    const newCat = prompt('Rename category:', oldCat);
    if (newCat && newCat.trim() && newCat !== oldCat) {
      allCapsules.forEach(c => {
        if (c.category === oldCat) {
          updateCapsule(c.id, { category: newCat.trim() });
        }
      });
      if (categoryFilter === oldCat) setCategoryFilter(newCat.trim());
    }
  };

  const renameTag = (oldTag: string) => {
    const newTag = prompt('Rename tag:', oldTag);
    if (newTag && newTag.trim() && newTag !== oldTag) {
      const trimmed = newTag.trim().replace('#', '');
      allCapsules.forEach(c => {
        if (c.tags?.includes(oldTag)) {
          updateCapsule(c.id, { tags: c.tags.map(t => t === oldTag ? trimmed : t) });
        }
      });
      if (tagFilter === oldTag) setTagFilter(trimmed);
    }
  };

  const removeCategory = (catToRemove: string) => {
    if (confirm(`This will delete all notes in this category.`)) {
      allCapsules.forEach(c => {
        if (c.category === catToRemove) {
          removeCapsuleForever(c.id);
        }
      });
      if (categoryFilter === catToRemove) setCategoryFilter('all');
    }
  };

  const removeTag = (tagToRemove: string) => {
    if (confirm(`This will delete all notes with this tag.`)) {
      allCapsules.forEach(c => {
        if (c.tags?.includes(tagToRemove)) {
          removeCapsuleForever(c.id);
        }
      });
      if (tagFilter === tagToRemove) setTagFilter(null);
    }
  };

  // Real Reminder Engine
  useEffect(() => {
    const syncRemindersToSW = () => {
      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        const now = Date.now();
        const futureReminders = allCapsules
          .filter(cap => cap.reminder?.date && cap.reminder.date > now && !cap.completed && !cap.isDeleted && !cap.isArchived)
          .map(cap => {
            const contentText = typeof cap.content === 'string' ? cap.content : plainTextFromContent(cap.content);
            return {
              id: cap.id,
              title: 'Lumi Note Reminder',
              body: contentText,
              date: cap.reminder.date
            };
          });

        navigator.serviceWorker.ready.then(registration => {
          if (registration.active) {
            registration.active.postMessage({
              type: 'SET_REMINDERS',
              reminders: futureReminders
            });
          }
        }).catch(err => {
          console.warn('Failed to sync reminders to Service Worker:', err);
        });
      }
    };

    if (hasPremiumAccess(user) && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          syncRemindersToSW();
        }
      });
    }
    
    const checkReminders = () => {
      const now = Date.now();
      let hasNewFired = false;
      
      allCapsules.forEach(cap => {
        if (!cap.reminder?.date || cap.completed || cap.isDeleted || cap.isArchived) return;
        
        const reminderTime = Number(cap.reminder.date);
        if (isNaN(reminderTime)) return;

        // If it's a future reminder, ignore for now
        if (reminderTime > now) return;

        // For past reminders (reminderTime <= now):
        // If it's a historical reminder (expired more than 60 seconds ago),
        // we silently mark it as notified and update its status without popping any alert.
        const isHistorical = now - reminderTime > 60000;
        
        if (isHistorical) {
          if (!notifiedIdsRef.current.has(cap.id)) {
            notifiedIdsRef.current.add(cap.id);
            
            // Silently update to next interval or set to none
            let shouldUpdate = false;
            const nextReminder = { ...cap.reminder };
            if (cap.reminder.type === 'custom' && cap.reminder.customInterval) {
              const mult = cap.reminder.customUnit === 'day' ? 86400000 : cap.reminder.customUnit === 'week' ? 604800000 : 2592000000;
              nextReminder.date = now + cap.reminder.customInterval * mult;
              shouldUpdate = true;
            } else if (cap.reminder.type === 'daily') {
              nextReminder.date = now + 86400000;
              shouldUpdate = true;
            } else if (cap.reminder.type === 'weekly') {
              nextReminder.date = now + 604800000;
              shouldUpdate = true;
            } else if (cap.reminder.type === 'monthly') {
              const nextDate = new Date(now);
              nextDate.setMonth(nextDate.getMonth() + 1);
              nextReminder.date = nextDate.getTime();
              shouldUpdate = true;
            } else if (cap.reminder.type === 'yearly') {
              const nextDate = new Date(now);
              nextDate.setFullYear(nextDate.getFullYear() + 1);
              nextReminder.date = nextDate.getTime();
              shouldUpdate = true;
            } else if (cap.reminder.type !== 'none') {
              nextReminder.type = 'none';
              shouldUpdate = true;
            }
            
            if (shouldUpdate) {
              updateCapsule(cap.id, { reminder: nextReminder as any });
            }
          }
          return;
        }

        // If it's active (expired within last 60 seconds) and hasn't been fired yet:
        if (notifiedIdsRef.current.has(cap.id)) return;

        // Trigger notifications
        showSystemNotification('Lumi Note Reminder', { body: plainTextFromContent(cap.content) });

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([150, 80, 150]);
        }

        notifiedIdsRef.current.add(cap.id);
        hasNewFired = true;
        
        setFiredReminders(prev => {
          if (prev.some(p => p.id === cap.id)) return prev;
          return [...prev, cap];
        });

        // Update capsule state to future date or clear once reminder
        let shouldUpdate = false;
        const nextReminder = { ...cap.reminder };
        if (cap.reminder.type === 'custom' && cap.reminder.customInterval) {
          const mult = cap.reminder.customUnit === 'day' ? 86400000 : cap.reminder.customUnit === 'week' ? 604800000 : 2592000000;
          nextReminder.date = now + cap.reminder.customInterval * mult;
          shouldUpdate = true;
        } else if (cap.reminder.type === 'daily') {
          nextReminder.date = now + 86400000;
          shouldUpdate = true;
        } else if (cap.reminder.type === 'weekly') {
          nextReminder.date = now + 604800000;
          shouldUpdate = true;
        } else if (cap.reminder.type === 'monthly') {
          const nextDate = new Date(now);
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextReminder.date = nextDate.getTime();
          shouldUpdate = true;
        } else if (cap.reminder.type === 'yearly') {
          const nextDate = new Date(now);
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          nextReminder.date = nextDate.getTime();
          shouldUpdate = true;
        } else {
          nextReminder.type = 'none';
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          updateCapsule(cap.id, { reminder: nextReminder as any });
        }
      });

      if (hasNewFired) {
        playNotificationSound();
      }
    };

    // Run instantly on initialization
    checkReminders();
    syncRemindersToSW();

    const interval = setInterval(checkReminders, 8000);
    
    // Listen to foreground/visibility focus transitions to instantly trigger reminders (no background lag)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkReminders();
        syncRemindersToSW();
      }
    };
    
    window.addEventListener('focus', checkReminders);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkReminders);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [allCapsules, updateCapsule, user]);

  // FCM Web Push Token Registration
  useEffect(() => {
    if (!user || Notification.permission !== 'granted') return;

    const setupWebPush = async () => {
      try {
        const { getMessaging, getToken, onMessage } = await import('firebase/messaging');
        const messaging = getMessaging();
        
        // 申请 Token
        const token = await getToken(messaging, {
          vapidKey: 'BDlxFuR4ld3myeiKHhc9njffQK-OUX-01klkDwsJwhnuuKyXwGdGS4e8dcEUbNiNDfsGTHHIWjaa3gtRxsaPcnU'
        });

        if (token) {
          console.log('[FCM] Successfully fetched registration token:', token);
          
          // 将 Token 用 arrayUnion 安全地合并记录至用户的 Firestore 个人账号里
          const { arrayUnion } = await import('firebase/firestore');
          const userDocRef = doc(getDb(), 'users', user.uid);
          await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(token)
          });
          console.log('[FCM] Token successfully uploaded to Firestore.');
        } else {
          console.warn('[FCM] No registration token available.');
        }

        // 监听前台到达的消息
        onMessage(messaging, (payload) => {
          console.log('[FCM Foreground] Message received: ', payload);
          showToast(`Reminder: ${payload.notification?.body || ''}`, 'info');
          playNotificationSound();
        });

      } catch (err) {
        console.warn('[FCM] Failed to initialize Cloud Messaging or fetch token:', err);
      }
    };

    // 延时 2 秒进行 FCM 握手，规避首屏数据加载竞争
    const timer = setTimeout(setupWebPush, 2000);
    return () => clearTimeout(timer);
  }, [user, showToast]);

  const sortedCapsules = allCapsules;
  
  const filteredCapsules = sortedCapsules.filter(c => {
    const contentText = typeof c.content === 'string' ? c.content : plainTextFromContent(c.content);
    const matchesSearch = (contentText || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (c.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
    const matchesTag = !tagFilter || (c.tags && c.tags.includes(tagFilter));
    
    // Hard state filters (Archive/Trash)
    if (filter === 'starred') return matchesSearch && matchesCategory && matchesTag && c.isStarred && !c.isArchived && !c.isDeleted;
    if (filter === 'archived') return matchesSearch && matchesCategory && matchesTag && c.isArchived && !c.isDeleted;
    if (filter === 'trash') return matchesSearch && matchesCategory && matchesTag && c.isDeleted;
    
    // Normal view: don't show archived or deleted
    if (c.isArchived || c.isDeleted) return false;

    // Advanced filters
    const matchesAdvanced = (() => {
      switch (filter) {
        case 'pending-todo': return c.isTodo && !c.completed;
        case 'without-todo': return !c.isTodo;
        case 'completed-todo': return c.isTodo && c.completed;
        case 'repeat-reminder': return hasRepeatReminder(c);
        case 'without-reminder': return !hasActiveReminder(c);
        case 'finished-reminder': return hasFinishedOneShotReminder(c);
        case 'pure-note': return !c.isTodo && !hasActiveReminder(c);
        default: return true;
      }
    })();

    return matchesSearch && matchesCategory && matchesTag && matchesAdvanced;
  });

  const countForFilterType = (f: FilterType): number =>
    allCapsules.filter((c) => {
      if (f === 'starred') return c.isStarred && !c.isArchived && !c.isDeleted;
      if (f === 'archived') return c.isArchived && !c.isDeleted;
      if (f === 'trash') return c.isDeleted;
      if (c.isArchived || c.isDeleted) return false;
      switch (f) {
        case 'all':
          return true;
        case 'pending-todo':
          return c.isTodo && !c.completed;
        case 'completed-todo':
          return c.isTodo && !!c.completed;
        case 'repeat-reminder':
          return hasRepeatReminder(c);
        case 'finished-reminder':
          return hasFinishedOneShotReminder(c);
        case 'pure-note':
          return !c.isTodo && !hasActiveReminder(c);
        default:
          return true;
      }
    }).length;

  const filterOptions: { value: FilterType, label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pure-note', label: 'Only Notes' },
    { value: 'pending-todo', label: 'Pending to-do' },
    { value: 'completed-todo', label: 'Finished to-do' },
    { value: 'repeat-reminder', label: 'Repeat reminder' },
    { value: 'finished-reminder', label: 'Finished reminder' },
    { value: 'archived', label: 'Archived' },
    { value: 'trash', label: 'Trash' },
  ];

  useEffect(() => {
    const allowed: FilterType[] = [
      'all',
      'pure-note',
      'pending-todo',
      'completed-todo',
      'repeat-reminder',
      'finished-reminder',
      'archived',
      'trash',
      'starred',
    ];
    if (!allowed.includes(filter)) setFilter('all');
  }, [filter]);

  /** Category, tag, or Starred narrowing (top pill shows N/A in some cases). */
  const isSidebarListScopeActive = categoryFilter !== 'all' || tagFilter !== null || filter === 'starred';
  /** Any active list filter: type, category, or tag (red dot on sidebar controls). */
  const isSidebarScopeFilterActive =
    categoryFilter !== 'all' || tagFilter !== null || filter !== 'all';
  /** Top pill shows N/A when sidebar drives scope; Archived/Trash stay explicit. */
  const topFilterTriggerLabel =
    isSidebarListScopeActive && filter !== 'archived' && filter !== 'trash'
      ? 'N/A'
      : (filterOptions.find((o) => o.value === filter)?.label ?? 'Filter');
  const topFilterTitle = isSidebarListScopeActive
    ? 'List is narrowed by sidebar (category or tag). Type filters still apply on top of that scope.'
    : undefined;

  // 等待 Firebase Auth 初始化完成，避免 localStorage 缓存导致的闪烁跳转
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-[#F8F9FA] dark:bg-[#1C1C1E] transition-colors duration-300">
        <div className="flex flex-col items-center gap-6 max-w-xs text-center animate-in fade-in duration-700">
          <div className="w-[216px] h-[216px] flex items-center justify-center animate-pulse">
            <AppLogo className="w-full h-full" />
          </div>
          <div className="space-y-2 mt-2">
            <h2 className="text-lg font-bold text-[#1D1D1F] dark:text-[#F2F2F7] tracking-tight">Initializing Lumi Note</h2>
            <p className="text-xs font-semibold text-[#8E8E93] leading-relaxed px-4">
              Connecting to secure sync services. This may take a moment depending on your network.
            </p>
          </div>
          <div className="w-5 h-5 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mt-2" />
        </div>
      </div>
    );
  }


  if (!user) {
    if (!showAuthScreen) {
      return <LandingPage onLogin={(isRegistering) => { setShowAuthScreen(true); setIsRegistering(isRegistering || false); }} />;
    }

    return (
      <div id="login-screen" className="min-h-[100dvh] md:h-[100dvh] w-screen flex flex-col md:flex-row bg-white overflow-y-auto md:overflow-hidden py-8 md:py-0 relative">
        {/* 全屏磨砂模糊登录 Toast / Fullscreen backdrop-blur Auth Toast */}
        {authProcessing && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F8F9FA]/40 dark:bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1C1C1E] p-8 rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 flex flex-col items-center max-w-sm mx-4 text-center gap-5 animate-in zoom-in-95 duration-200">
              <div className="flex-shrink-0 w-36 h-36 flex items-center justify-center">
                <AppLogo className="w-full h-full animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F2F2F7]">Signing You In</h3>
                <p className="text-xs font-semibold text-[#8E8E93] leading-relaxed">
                  Securely authenticating and syncing your notes. This can take a few seconds. Thanks for your patience.
                </p>
              </div>
              <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mt-1" />
              <button 
                type="button"
                onClick={() => setAuthProcessing(false)}
                className="mt-2 text-xs font-bold text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white transition-colors underline cursor-pointer"
              >
                Cancel & Go Back
              </button>
            </div>
          </div>
        )}

        {/* 全屏聚焦模态错误 Toast / Fullscreen backdrop-blur Error Toast */}
        {authError && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-300 cursor-pointer"
            onClick={() => setAuthError(null)}
          >
            <div 
              className="bg-white dark:bg-[#1C1C1E] p-8 rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 flex flex-col items-center max-w-sm mx-4 text-center gap-5 animate-in zoom-in-95 duration-200 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center bg-red-500/10 text-red-500 rounded-full">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F2F2F7]">Authentication Error</h3>
                <p className="text-xs font-semibold text-[#8E8E93] leading-relaxed">
                  {authError}
                </p>
              </div>
              <button 
                onClick={() => setAuthError(null)}
                className="w-full bg-[#007AFF] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-[#007AFF]/90 active:scale-95 transition-all outline-none cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}

        {/* Back button */}
        <button 
          onClick={() => setShowAuthScreen(false)}
          className="absolute top-6 left-6 z-50 w-10 h-10 bg-white shadow-md rounded-full flex items-center justify-center text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors"
        >
          <ArrowRight size={20} className="rotate-180" />
        </button>
        {/* Left Design Section */}
        <div className="hidden md:flex flex-1 bg-[#F2F2F7] flex-col items-center justify-center p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#007AFF] opacity-5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#00C6FF] opacity-5 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2"></div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-sm"
          >
            <div className="w-[216px] h-[216px] mb-12 transform -rotate-6">
              <AppLogo className="w-full h-full" />
            </div>
            <h2 className="text-5xl font-black tracking-tight text-[#1D1D1F] leading-tight mb-6">
              Capturing<br />
              <span className="text-[#007AFF]">Genius</span><br />
              Thoughts.
            </h2>
            <div className="space-y-4">
               {['AI Powered Intelligence', 'Idea Sync', 'Swiss Aesthetics'].map((feat) => (
                 <div key={feat} className="flex items-center gap-3 text-[#8E8E93] font-bold">
                   <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                     <div className="w-2 h-2 bg-[#007AFF] rounded-full"></div>
                   </div>
                   {feat}
                 </div>
               ))}
            </div>
          </motion.div>
        </div>

        {/* Right Auth Section */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-sm">
            <div className="md:hidden flex flex-col items-center mb-6">
              <AppLogo className="w-[216px] h-[216px] mb-4" />
              <h1 className="text-3xl font-extrabold tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-[#1D1D1F] to-[#434343]">Lumi Note</h1>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-2xl font-bold text-[#1D1D1F] mb-2">{isRegistering ? 'Create Account' : 'Welcome Back'}</h3>
              <p className="text-[#8E8E93] text-sm font-semibold mb-4 md:mb-8">
                {isRegistering ? 'Create an account to instantly capture and sync your notes, to-dos & reminders.' : 'Sign in to instantly capture and sync your notes, to-dos & reminders.'}
              </p>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-[#8E8E93] uppercase tracking-widest mb-2 ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={18} />
                    <input 
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[#F2F2F7] border-2 border-transparent focus:border-[#007AFF] focus:bg-white rounded-2xl text-sm font-semibold transition-all outline-none placeholder:text-[#8E8E93]/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#8E8E93] uppercase tracking-widest mb-2 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={18} />
                    <input 
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[#F2F2F7] border-2 border-transparent focus:border-[#007AFF] focus:bg-white rounded-2xl text-sm font-semibold transition-all outline-none placeholder:text-[#8E8E93]/40"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={authProcessing}
                  className="w-full bg-[#007AFF] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-[#007AFF]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {authProcessing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (isRegistering ? 'Create Account' : 'Sign In')}
                </button>
              </form>

              <div className="relative my-5 md:my-10">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E5EA]"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-[#8E8E93]"><span className="bg-white px-4 tracking-widest lowercase">or sign in with</span></div>
              </div>

              <div className="flex justify-center">
                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 bg-white py-3 rounded-xl border border-[#E5E5EA] hover:bg-[#F2F2F7] transition-all active:scale-95 shadow-sm font-bold text-sm text-[#1D1D1F]"
                  title="Sign in with Google"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                  <span>Google</span>
                </button>
              </div>

              <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="w-full text-center mt-6 md:mt-12 text-xs font-bold text-[#8E8E93]"
              >
                {isRegistering ? 'Already have an account?' : "Don't have an account?"} <span className="text-[#007AFF]">{isRegistering ? 'Sign In' : 'Sign Up'}</span>
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="app-container" className="flex h-[100dvh] bg-[#F8F9FA] text-[#1D1D1F] font-sans overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.button
            type="button"
            aria-label="Close sidebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[90] bg-black/35 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Category Filter */}
      <motion.aside 
        id="sidebar"
        initial={isMobile ? { x: -SIDEBAR_W.mobile } : false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? SIDEBAR_W.mobile : SIDEBAR_W.desktop) : (isMobile ? 0 : 0),
          x: isMobile && !isSidebarOpen ? -SIDEBAR_W.mobile : 0,
          opacity: isSidebarOpen ? 1 : 0
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={`bg-white border-r border-[#E5E5EA] flex flex-col items-stretch shadow-xl md:shadow-none z-[100] fixed md:relative h-full ${!isSidebarOpen ? 'invisible border-none overflow-hidden' : 'visible'}`}
      >
        <div className="p-4 flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-[56px] h-[56px] flex items-center justify-center drop-shadow-md">
              <AppLogo className="w-full h-full" />
            </div>
            {isSidebarOpen && !isMobile && (
              <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#1D1D1F] to-[#434343] whitespace-nowrap">
                Lumi Note
              </span>
            )}
          </div>
          {isSidebarOpen && (
            <button 
              id="sidebar-toggle"
              onClick={() => setIsSidebarOpen(false)}
              className="relative p-1.5 hover:bg-[#F2F2F7] rounded-lg transition-colors text-[#8E8E93] group"
            >
              <ChevronLeft size={20} className="group-hover:text-[#007AFF] transition-colors" />
              {isSidebarScopeFilterActive && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF3B30] ring-1 ring-white pointer-events-none" />
              )}
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {!isSidebarOpen && (
            <>
              <button
                type="button"
                id="nav-compact-all"
                onClick={() => {
                  setFilter('all');
                  setCategoryFilter('all');
                  setTagFilter(null);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className={cn(
                  'w-full mb-1 flex items-center justify-center p-3 rounded-xl border transition-all',
                  filter === 'all' && categoryFilter === 'all' && !tagFilter
                    ? 'bg-[#007AFF] border-[#007AFF] shadow-lg'
                    : 'bg-[#F2F2F7] border-[#E5E5EA] hover:bg-[#ECECEC]',
                )}
                aria-label="All notes"
              >
                <Layers
                  size={18}
                  strokeWidth={2.2}
                  className={cn(
                    filter === 'all' && categoryFilter === 'all' && !tagFilter
                      ? 'text-white'
                      : 'text-[#007AFF]',
                  )}
                />
              </button>
              <button
                type="button"
                id="cat-starred-compact"
                onClick={() => {
                  setFilter('starred');
                  setCategoryFilter('all');
                  setTagFilter(null);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className={cn(
                  'w-full mb-1 flex items-center justify-center p-3 rounded-xl border transition-all',
                  filter === 'starred'
                    ? 'bg-[#007AFF] border-[#007AFF] shadow-lg'
                    : 'bg-[#F2F2F7] border-[#E5E5EA] hover:bg-[#ECECEC]',
                )}
                aria-label="Starred"
              >
                <Star
                  size={18}
                  strokeWidth={2.2}
                  className={cn(
                    'fill-none',
                    filter === 'starred' ? 'text-white' : 'text-[#007AFF]',
                  )}
                />
              </button>
            </>
          )}

          {isSidebarOpen && (
            <>
              <button
                type="button"
                id="nav-all-expanded"
                onClick={() => {
                  setFilter('all');
                  setCategoryFilter('all');
                  setTagFilter(null);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className={cn(
                  'w-full mb-1 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all text-left',
                  filter === 'all' && categoryFilter === 'all' && !tagFilter
                    ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-lg'
                    : 'bg-[#F2F2F7] border-[#E5E5EA] hover:bg-[#ECECEC]',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers
                    size={18}
                    strokeWidth={2.2}
                    className={cn(
                      'flex-shrink-0',
                      filter === 'all' && categoryFilter === 'all' && !tagFilter
                        ? 'text-white'
                        : 'text-[#007AFF]',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-bold tracking-normal',
                      filter === 'all' && categoryFilter === 'all' && !tagFilter
                        ? 'text-white'
                        : 'text-[#1D1D1F]',
                    )}
                  >
                    All
                  </span>
                </div>
                {countForFilterType('all') > 0 ? (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                      filter === 'all' && categoryFilter === 'all' && !tagFilter
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E5E5EA] text-[#8E8E93]',
                    )}
                  >
                    {countForFilterType('all')}
                  </span>
                ) : null}
              </button>
              <div
                className="mt-1 mb-1 w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors bg-[#F2F2F7] border border-[#E5E5EA] hover:bg-[#ECECEC]"
                onClick={() => setIsFilterNavExpanded(!isFilterNavExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-[#007AFF]" strokeWidth={2.2} />
                  <span className="text-[#1D1D1F] normal-case text-xs font-bold tracking-normal">
                    Filter
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform flex-shrink-0 text-[#8E8E93] ${isFilterNavExpanded ? 'rotate-180' : ''}`}
                />
              </div>
              <div
                className={`overflow-hidden transition-all duration-200 space-y-1 ${isFilterNavExpanded ? 'max-h-[900px] opacity-100 mb-2' : 'max-h-0 opacity-0'}`}
              >
                {filterOptions
                  .filter((o) => o.value !== 'all')
                  .map((opt) => (
                    <SidebarItem
                      key={`filter-${opt.value}`}
                      id={`filter-${opt.value}`}
                      icon={null}
                      label={opt.label}
                      isActive={filter === opt.value && categoryFilter === 'all' && !tagFilter}
                      count={countForFilterType(opt.value)}
                      onClick={() => {
                        setFilter(opt.value);
                        setCategoryFilter('all');
                        setTagFilter(null);
                        if (isMobile) setIsSidebarOpen(false);
                      }}
                      isSidebarOpen={isSidebarOpen}
                    />
                  ))}
              </div>

              <button
                type="button"
                id="cat-starred-expanded"
                onClick={() => {
                  setFilter('starred');
                  setCategoryFilter('all');
                  setTagFilter(null);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className={cn(
                  'w-full mb-1 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all text-left',
                  filter === 'starred'
                    ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-lg'
                    : 'bg-[#F2F2F7] border-[#E5E5EA] hover:bg-[#ECECEC]',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Star
                    size={18}
                    strokeWidth={2.2}
                    className={cn(
                      'flex-shrink-0 fill-none',
                      filter === 'starred' ? 'text-white' : 'text-[#007AFF]',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-bold tracking-normal',
                      filter === 'starred' ? 'text-white' : 'text-[#1D1D1F]',
                    )}
                  >
                    Starred
                  </span>
                </div>
                {countForFilterType('starred') > 0 ? (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                      filter === 'starred'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E5E5EA] text-[#8E8E93]',
                    )}
                  >
                    {countForFilterType('starred')}
                  </span>
                ) : null}
              </button>

              {allCategories.length > 0 && (
                <>
                  <div
                    className="mt-4 mb-1 w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors bg-[#F2F2F7] border border-[#E5E5EA] hover:bg-[#ECECEC]"
                    onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <Folder size={16} className="text-[#007AFF]" strokeWidth={2.2} />
                      <span className="text-[#1D1D1F] normal-case text-xs font-bold tracking-normal">
                        Categories
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`transition-transform flex-shrink-0 text-[#8E8E93] ${isCategoriesExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                  <div
                    className={`overflow-hidden transition-all duration-200 ${isCategoriesExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    {allCategories.map((cat) => {
                      return (
                        <SidebarItem
                          key={`cat-${cat}`}
                          id={`cat-${cat}`}
                          icon={null}
                          label={cat}
                          isActive={categoryFilter === cat}
                          count={allCapsules.filter((c) => c.category === cat && !c.isArchived && !c.isDeleted).length}
                          onClick={() => {
                            setCategoryFilter(categoryFilter === cat ? 'all' : cat);
                            setTagFilter(null);
                            if (isMobile) setIsSidebarOpen(false);
                          }}
                          onRename={(newName) => {
                            setCapsules((prev) => prev.map((c) => (c.category === cat ? { ...c, category: newName } : c)));
                            if (categoryFilter === cat) setCategoryFilter(newName);
                          }}
                          onDelete={() => {
                            setCapsules((prev) => prev.filter((c) => c.category !== cat));
                            if (categoryFilter === cat) setCategoryFilter('all');
                          }}
                          isSidebarOpen={isSidebarOpen}
                          isCustom={true}
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {allTags.length > 0 && (
                <>
                  <div
                    className="mt-4 mb-1 w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors bg-[#F2F2F7] border border-[#E5E5EA] hover:bg-[#ECECEC]"
                    onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <TagLucideIcon size={16} className="text-[#007AFF]" strokeWidth={2.2} />
                      <span className="text-[#1D1D1F] normal-case text-xs font-bold tracking-normal">Tags</span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`transition-transform flex-shrink-0 text-[#8E8E93] ${isTagsExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                  <div
                    className={`overflow-hidden transition-all duration-200 space-y-1 ${isTagsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    {allTags.map((tag) => {
                      return (
                        <TagItem
                          key={tag}
                          tag={tag}
                          tagFilter={tagFilter}
                          setTagFilter={setTagFilter}
                          setCategoryFilter={setCategoryFilter}
                          removeTag={removeTag}
                          isMobile={isMobile}
                          setIsSidebarOpen={setIsSidebarOpen}
                          count={allCapsules.filter((c) => c.tags?.includes(tag) && !c.isArchived && !c.isDeleted).length}
                          onRename={(oldTag: string, newTag: string) => {
                            setCapsules((prev) =>
                              prev.map((c) => {
                                if (c.tags?.includes(oldTag)) {
                                  return { ...c, tags: c.tags.map((t) => (t === oldTag ? newTag : t)) };
                                }
                                return c;
                              }),
                            );
                            if (tagFilter === oldTag) setTagFilter(newTag);
                          }}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </nav>

        {isSidebarOpen && !hasSeenTutorial && (
          <div className="px-3 pb-3">
             <button 
                onClick={() => {
                   safeLocalStorageRemove(ONBOARDING_STORAGE_KEY);
                   if ((window as any).startTour) {
                     (window as any).startTour();
                   } else {
                     window.location.reload();
                   }
                }}
                className="w-full flex items-center justify-start gap-2 p-2.5 px-4 text-xs font-bold text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/10 rounded-xl transition-all"
             >
                <Lightbulb size={14} />
                Onboarding
             </button>
          </div>
        )}

        {/* User Card */}
        <div className="mt-auto p-3 border-t border-[#E5E5EA] flex flex-col gap-2">
           {/* 手动同步：PC 没有下拉刷新手势，这里提供桌面端的同步入口 */}
           <button
             type="button"
             onClick={async () => {
                void handleSync();
              }}
              disabled={isSyncing}
             aria-label="Manual sync"
             title="Manual sync"
             className={cn(
               "w-full flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all disabled:opacity-60",
               isSidebarOpen ? "px-4 justify-start" : "px-0 justify-center"
             )}
           >
             <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#007AFF]" : ""} />
             {isSidebarOpen && <span>{isSyncing ? 'Syncing…' : 'Manual Sync'}</span>}
           </button>
           {/* <button
             type="button"
             onClick={() => setShowSettingsModal(true)}
             aria-label="Settings"
             title="Settings"
             className={cn(
               "w-full flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all",
               isSidebarOpen ? "px-4 justify-start" : "px-0 justify-center"
             )}
           >
             <Settings size={14} />
             {isSidebarOpen && <span>Settings</span>}
           </button> */}
           <div 
              className="bg-[#F2F2F7] rounded-2xl p-3 flex items-center gap-3 group"
              title={`UID: ${user.uid}\nEmail: ${user.email || 'None'}`}
           >
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-xl shadow-sm" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 bg-[#007AFF] text-white rounded-xl flex items-center justify-center">
                   <UserIcon size={20} />
                </div>
              )}
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-bold truncate">{user.displayName || 'User'}</p>
                    {PAYWALL_ACTIVE && user.isPremium && (
                       <span className="flex items-center gap-0.5 bg-gradient-to-r from-[#AF52DE] to-[#FF2D55] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shadow-sm">
                         <CrownJewel size={11} /> Pro
                       </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button 
                      onClick={() => signOut(getAuth())}
                      className="text-[10px] font-bold text-red-500 uppercase tracking-wider hover:opacity-70 transition-opacity flex items-center gap-1"
                    >
                      <LogOut size={10} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
           </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main 
        id="main-content" 
        className="flex-1 flex flex-col relative h-full min-w-0 min-h-0 overflow-x-hidden"
        onClick={() => {
          if (selectedIds.size > 0) {
            setSelectedIds(new Set());
          }
        }}
      >
        {/* Header / Search & Adv Filter */}
        <header className="h-16 px-4 md:px-8 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-[#E5E5EA] gap-4 z-40 sticky top-0">
          <div className="flex items-center gap-3 flex-1 min-w-0 max-w-2xl">
            {!isSidebarOpen && (
              <button 
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="relative p-2 hover:bg-[#F2F2F7] border border-[#E5E5EA] shadow-sm bg-white rounded-xl text-[#007AFF] transition-all flex items-center justify-center shrink-0 active:scale-95"
                aria-label={
                  isSidebarScopeFilterActive
                    ? 'Open sidebar — a filter is active'
                    : 'Open sidebar'
                }
              >
                <PanelLeft size={22} strokeWidth={2.25} />
                {isSidebarScopeFilterActive ? (
                  <span
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FF3B30] ring-2 ring-white pointer-events-none"
                    aria-hidden
                  />
                ) : null}
              </button>
            )}
            <div className="flex-1 relative">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim() !== '') {
                    setSearchQuery('');
                  }
                }}
                className={cn(
                  "absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center shrink-0 z-10 select-none",
                  searchQuery.trim() !== '' 
                    ? "cursor-pointer active:scale-90" 
                    : "pointer-events-none"
                )}
                title={searchQuery.trim() !== '' ? "Click to clear search" : undefined}
              >
                <Search className="text-[#8E8E93]" size={18} />
                {searchQuery.trim() !== '' && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#FF3B30] ring-1 ring-white animate-pulse" />
                )}
              </button>
              <input 
                id="search-input"
                type="text" 
                placeholder="Search all ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F2F2F7] border-2 border-transparent rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:bg-white focus:border-[#007AFF]/20 focus:ring-4 focus:ring-[#007AFF]/5 transition-all"
              />
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center gap-2 relative">
            {dataLoading && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20 rounded-full text-xs font-bold animate-pulse shadow-sm shrink-0">
                <RefreshCw size={12} className="animate-spin text-[#007AFF]" />
                <span className="hidden sm:inline text-[11px] tracking-tight">Syncing Notes</span>
              </div>
            )}
            {PAYWALL_ACTIVE && !hasPremiumAccess(user) && (
               <button 
                  onClick={() => setShowPremiumModal(true)} 
                  className="flex bg-gradient-to-r from-[#AF52DE] to-[#FF2D55] text-white px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl text-[13px] font-bold shadow-sm hover:shadow-md transition-all active:scale-95 uppercase items-center gap-1.5"
               >
                 <CrownJewel size={17} className="md:scale-90" /> <span className="hidden md:inline">Upgrade</span>
               </button>
            )}
            {PAYWALL_ACTIVE && (
              <button
                id="pro-features-btn"
                onClick={() => setShowProFeaturesModal(true)}
                className={cn(
                  "flex w-10 h-10 items-center justify-center rounded-xl transition-all active:scale-95",
                  user.isPremium 
                    ? "bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white shadow-lg shadow-[#AF52DE]/20" 
                    : "bg-[#F2F2F7] text-[#8E8E93] hover:bg-[#E5E5EA]"
                )}
                aria-label="Pro Features"
              >
                <CrownJewel size={22} />
              </button>
            )}
            <button
              id="view-mode-toggle"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="flex w-10 h-10 items-center justify-center bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F2F2F7] rounded-xl hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] transition-colors"
            >
              {viewMode === 'grid' ? <LayoutList size={20} /> : <LayoutGrid size={20} />}
            </button>

            <div className="relative">
              <button
                id="sort-dropdown-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSortMenuOpen(!isSortMenuOpen);
                  setIsFilterMenuOpen(false);
                }}
                className={cn(
                  "flex w-10 h-10 items-center justify-center rounded-xl transition-all active:scale-95",
                  isSortMenuOpen ? "bg-[#E5E5EA] text-[#007AFF]" : "bg-[#F2F2F7] text-[#8E8E93] hover:bg-[#E5E5EA]"
                )}
                title="Sort notes"
              >
                {sortOrder === 'desc' ? <ArrowDownNarrowWide size={20} /> : <ArrowUpNarrowWide size={20} />}
              </button>

              <AnimatePresence>
                {isSortMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSortMenuOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 min-w-[220px] w-max max-w-[90vw] bg-white dark:bg-[#1C1C1E] border border-[#E5E5EA] dark:border-white/10 rounded-[18px] shadow-[0_8px_30px_rgba(0,0,0,0.15)] z-50 p-2"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest">Sort By</div>
                      {[
                        { label: 'Modification Time', value: 'updatedAt' },
                        { label: 'Creation Time', value: 'createdAt' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            if (sortBy === opt.value) {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortBy(opt.value as any);
                              setSortOrder('desc');
                            }
                            setIsSortMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${
                            sortBy === opt.value 
                              ? 'bg-[#E5E5EA] text-[#1D1D1F]' 
                              : 'hover:bg-[#F2F2F7] text-[#1D1D1F]'
                          }`}
                        >
                          <span className="whitespace-nowrap flex-1 min-w-0 text-left">{opt.label}</span>
                          {sortBy === opt.value && (
                            sortOrder === 'desc' ? <ArrowDownNarrowWide size={14} className="text-[#007AFF] shrink-0" /> : <ArrowUpNarrowWide size={14} className="text-[#007AFF] shrink-0" />
                          )}
                        </button>
                      ))}
                      <div className="h-px bg-[#F2F2F7] my-1 mx-2" />
                      <div className="px-3 py-1.5 text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest">Order</div>
                      {[
                        { label: 'Newest First', value: 'desc' },
                        { label: 'Oldest First', value: 'asc' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setSortOrder(opt.value as any);
                            setIsSortMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${
                            sortOrder === opt.value 
                              ? 'bg-[#E5E5EA] text-[#1D1D1F]' 
                              : 'hover:bg-[#F2F2F7] text-[#1D1D1F]'
                          }`}
                        >
                          <span className="whitespace-nowrap flex-1 min-w-0 text-left">{opt.label}</span>
                          {sortOrder === opt.value && <Check size={14} className="text-[#007AFF] shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Capsule List */}
        <div 
          id="scroll-container" 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-x-hidden overflow-y-auto p-3 md:p-6 custom-scrollbar scroll-smooth relative"
        >
          {/* Pull to refresh indicator */}
          {pullY > 0 && (
            <div 
              style={{ height: `${pullY}px` }} 
              className="w-full flex items-center justify-center overflow-hidden transition-all duration-75 text-xs text-[#8E8E93] dark:text-[#AEAEB2] font-bold gap-2 select-none"
            >
              <RefreshCw size={14} className={pullY >= 50 ? "animate-spin text-[#007AFF]" : "text-[#8E8E93]"} />
              <span>{pullY >= 50 ? "Release to sync notes..." : "Pull down to sync..."}</span>
            </div>
          )}
          <div className={`w-full pb-36 transition-all duration-300 ${
            selectedIds.size > 0 ? 'mt-3' : ''
          } ${
            viewMode === 'grid' 
              ? 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3 md:gap-5' 
              : 'w-full max-w-[1200px] flex flex-col space-y-2.5 md:space-y-3.5'
          } ${isSidebarOpen ? 'ml-0' : 'mx-auto'}`}>
            <AnimatePresence initial={false}>
              {filteredCapsules.map((capsule, index) => (
                <div key={capsule.id} className="flex items-center gap-3 md:gap-5 group/list">
                  {selectedIds.size > 0 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleSelection(capsule.id); }}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
                        selectedIds.has(capsule.id) 
                          ? "bg-[#007AFF] border-[#007AFF]" 
                          : "border-[#C7C7CC] hover:border-[#8E8E93]"
                      )}
                    >
                      {selectedIds.has(capsule.id) && <Check size={14} className="text-white" strokeWidth={3} />}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <CapsuleItem 
                      capsule={capsule}
                      index={index}
                      viewMode={viewMode}
                      patchCapsule={patchCapsule}
                      onRemovePermanently={() => removeCapsuleForever(capsule.id)}
                      allCategories={allCategories}
                      allTags={allTags}
                      isSelectionMode={selectedIds.size > 0}
                      isSelected={selectedIds.has(capsule.id)}
                      onToggleSelection={() => toggleSelection(capsule.id)}
                      onViewDetail={() => setEditingCapsule(capsule)}
                      isPremium={hasPremiumAccess(user)}
                      showToast={showToast}
                      onSelectAll={() => setSelectedIds(new Set(filteredCapsules.map(c => c.id)))}
                    />
                  </div>
                </div>
              ))}
            </AnimatePresence>
            
            {filteredCapsules.length === 0 && (
              (!isSyncFinished && !syncError) ? (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-[#8E8E93] gap-4">
                  <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-[#8E8E93] animate-pulse">Syncing your notes...</p>
                </div>
              ) : syncError ? (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-[#8E8E93] gap-4 px-6 text-center max-w-md mx-auto">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-1">
                    <CloudOff size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">Sync Paused (Offline Mode)</h3>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">
                    Cloud sync is paused due to Firebase quota limits. You can still view, edit and create notes locally. They will sync automatically once limits reset.
                  </p>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-[#8E8E93] col-span-full">
                  <div className="w-16 h-16 bg-[#E5E5EA] rounded-full flex items-center justify-center mb-4">
                    <Plus size={32} />
                  </div>
                  <p className="text-sm font-medium mb-4">No capsules found in this view.</p>
                  <div className="flex gap-3">
                    {/* 仅在数据同步完成、确认该用户从未创建过笔记时才显示 Generate Demo */}
                    {!hasSeededOrCreated && isSyncFinished && !dataLoading && (
                      <button 
                        id="generate-demo-btn"
                        onClick={seedDemoData}
                        disabled={authProcessing}
                        className="px-6 py-3 bg-[#007AFF] text-white rounded-2xl font-bold text-sm hover:shadow-lg active:scale-95 transition-all flex items-center gap-2 group"
                      >
                        <Zap size={16} className={authProcessing ? 'animate-spin' : 'group-hover:animate-pulse'} />
                        {authProcessing ? 'Generating...' : 'Generate Demo Data'}
                      </button>
                    )}
                    {filter !== 'all' && (
                       <button 
                        onClick={() => setFilter('all')}
                        className="px-6 py-3 bg-[#F2F2F7] text-[#1D1D1F] rounded-2xl font-bold text-sm hover:bg-[#E5E5EA] transition-all"
                      >
                        Show All
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <AnimatePresence>
          {editingCapsule && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeEditingModal}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full max-w-3xl bg-white rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col h-[90vh] md:h-[85vh]"
              >
                <div 
                  className="h-14 w-full flex items-center justify-between px-5 md:px-6 gap-3"
                  style={{ backgroundColor: 'white', borderBottom: '1px solid #F2F2F7' }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: editingCapsule.color || '#F2F2F7' }} />
                    <input
                      type="text"
                      value={editSubjectDraft}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditSubjectDraft(val);
                        editSubjectDraftRef.current = val;
                        queueEditSubjectSave();
                      }}
                      placeholder="Note Title"
                      className="font-black tracking-tight text-lg md:text-xl text-[#1D1D1F] bg-transparent border-none outline-none w-full p-0 placeholder-[#C7C7CC] focus:ring-0"
                    />
                  </div>
                  {/* 详情页聚焦编辑：分类/标签/颜色/置顶/星标/待办/分享均下沉到列表卡片的 ⋮ 菜单，
                      由 AI 解析意图自动归类，这里仅保留关闭按钮。 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      type="button"
                      onClick={closeEditingModal}
                      className="w-8 h-8 flex items-center justify-center bg-[#F2F2F7] hover:bg-[#E5E5EA] rounded-full transition-colors"
                    >
                      <X size={16} className="text-[#8E8E93]" />
                    </button>
                  </div>
                </div>

                <div className="px-4 py-2 md:px-5 md:py-2 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
                  {editingCapsule.attachments && editingCapsule.attachments.filter(att => att.type === 'video').length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {editingCapsule.attachments.filter(att => att.type === 'video').map((att, idx) => (
                        <div key={idx} className="relative group rounded-2xl overflow-hidden border border-[#E5E5EA] bg-black/5 aspect-video flex-shrink-0">
                          {att.type === 'video' ? (
                            <video src={att.url} className="w-full h-full object-cover" controls />
                          ) : (
                            <img src={att.url} alt="Attachment" className="w-full h-full object-cover" />
                          )}
                          <button 
                            onClick={() => removeAttachment(editingCapsule, idx)}
                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex-1 flex flex-col w-full pt-0 pb-2 md:pb-3">
                    {/* Pill Switcher outside the lined paper background */}
                    <div className="flex justify-end mb-1.5 shrink-0">
                      <div className="flex bg-[#F2F2F7] dark:bg-[#2C2C2E] p-0.5 rounded-xl border border-black/5 dark:border-white/5 relative z-10">
                        <button
                          type="button"
                          onClick={() => setEditMode('plain')}
                          className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${editMode === 'plain' ? 'bg-white dark:bg-[#3A3A3C] text-[#007AFF] shadow-sm' : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'}`}
                        >
                          Plain
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditMode('markdown')}
                          className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${editMode === 'markdown' ? 'bg-white dark:bg-[#3A3A3C] text-[#007AFF] shadow-sm' : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'}`}
                        >
                          Markdown
                        </button>
                      </div>
                    </div>

                    <div className="w-full flex-1 min-h-[220px] flex flex-col relative">
                      <CapsuleEditor
                        content={editContentDraft}
                        onChange={(json, text) => {
                          editContentDraftRef.current = json;
                          setEditContentDraft(json);
                          queueEditContentSave();
                        }}
                        editMode={editMode}
                        onModeChange={setEditMode}
                        placeholder="Start typing your brilliance..."
                        readOnly={false}
                        autoFocus={true}
                      />
                    </div>

                    {/* 分类与标签输入框：双向绑定已有的 editDetailCategory & editDetailTags */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-2.5 shrink-0">
                      <div className="flex-1">
                        <label className="block text-[10px] font-black text-[#8E8E93] uppercase tracking-widest mb-1 ml-1">Category</label>
                        <input
                          type="text"
                          placeholder="e.g. Work, Ideas"
                          value={editDetailCategory}
                          onChange={(e) => {
                            setEditDetailCategory(e.target.value);
                            editDetailCategoryRef.current = e.target.value;
                          }}
                          className="w-full px-3.5 py-2 bg-[#F2F2F7] border border-transparent focus:border-[#007AFF] focus:bg-white rounded-2xl text-xs font-bold transition-all outline-none text-[#1D1D1F] dark:text-white dark:bg-[#2C2C2E] dark:focus:bg-[#1C1C1E]"
                        />
                      </div>
                      <div className="flex-[2]">
                        <label className="block text-[10px] font-black text-[#8E8E93] uppercase tracking-widest mb-1 ml-1">Tags (comma separated)</label>
                        <input
                          type="text"
                          placeholder="e.g. design, slide, coding"
                          value={editDetailTags}
                          onChange={(e) => {
                            setEditDetailTags(e.target.value);
                            editDetailTagsRef.current = e.target.value;
                          }}
                          className="w-full px-3.5 py-2 bg-[#F2F2F7] border border-transparent focus:border-[#007AFF] focus:bg-white rounded-2xl text-xs font-bold transition-all outline-none text-[#1D1D1F] dark:text-white dark:bg-[#2C2C2E] dark:focus:bg-[#1C1C1E]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-2.5 md:p-3.5 bg-[#F8F9FA] border-t border-[#E5E5EA] flex justify-between items-center gap-3">
                  <div className="flex flex-col min-w-0 gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Clock size={10} className="text-[#C7C7CC] shrink-0" />
                      <span className="text-[10px] font-bold text-[#C7C7CC] uppercase tracking-wider truncate">
                        Created: {new Date(editingCapsule.createdAt).toLocaleDateString()} {new Date(editingCapsule.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {editingCapsule.reminder?.date && (
                      <div className="flex items-center gap-1.5">
                        <Bell size={10} className="text-[#007AFF] shrink-0" />
                        <span className="text-[10px] font-black text-[#007AFF] uppercase tracking-widest truncate">
                          Reminder: {new Date(editingCapsule.reminder.date).toLocaleDateString()} {new Date(editingCapsule.reminder.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({repeatLabelForMenu(editingCapsule.reminder)})
                        </span>
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={closeEditingModal}
                    className="px-5 py-2 shrink-0 bg-[#1D1D1F] text-white rounded-xl text-sm font-bold shadow-md hover:bg-black hover:scale-[1.02] transition-all"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* In-App Reminders (Pro feature) */}
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:bottom-8 md:right-8 z-[200] flex flex-col gap-2 pointer-events-none w-auto md:w-full md:max-w-sm">
          <AnimatePresence>
            {firedReminders.map(rem => (
              <motion.div 
                key={rem.id}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-3xl rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-6 border-2 border-[#007AFF]/20 flex items-start gap-4 pointer-events-auto w-full mb-2"
              >
                 <div className="bg-[#007AFF] text-white p-3.5 rounded-2xl shadow-lg shadow-[#007AFF]/30 mt-0.5">
                   <Bell className="animate-bounce" size={26} />
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-[10px] font-black text-[#007AFF] uppercase tracking-widest">System Alert</span>
                     <div className="w-1 h-1 rounded-full bg-[#8E8E93]"></div>
                     <span className="text-[10px] font-bold text-[#8E8E93]">Just now</span>
                   </div>
                   <h4 className="font-black text-lg text-[#1D1D1F] dark:text-[#F2F2F7] leading-tight mb-2">Reminder: Lumi Note</h4>
                   <p className="text-sm font-medium text-[#48484A] dark:text-[#8E8E93] line-clamp-3 leading-relaxed mb-4">{plainTextFromContent(rem.content)}</p>
                   
                   <div className="flex gap-2">
                     <button 
                        onClick={() => setFiredReminders(prev => prev.filter(p => p.id !== rem.id))}
                        className="flex-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F2F2F7] py-3 rounded-xl text-xs font-bold hover:bg-[#E5E5EA] transition-colors"
                     >
                        Dismiss
                     </button>
                     <button 
                        onClick={() => {
                           setFilter('all');
                           setSearchQuery(plainTextFromContent(rem.content));
                           setFiredReminders(prev => prev.filter(p => p.id !== rem.id));
                        }}
                        className="flex-1 bg-[#007AFF] text-white py-3 rounded-xl text-xs font-bold hover:bg-[#0062CC] transition-colors shadow-lg shadow-[#007AFF]/20"
                     >
                        View Note
                     </button>
                   </div>
                 </div>
                 <button onClick={() => setFiredReminders(prev => prev.filter(p => p.id !== rem.id))} className="text-[#8E8E93] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] p-2 rounded-full transition-colors shrink-0">
                   <X size={20} />
                 </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Batch Actions Overlay */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="fixed right-4 md:right-8 top-24 z-[100] pointer-events-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-stretch py-2 bg-white/90 backdrop-blur-3xl border border-[#E5E5EA] shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl pointer-events-auto w-32 md:w-40 overflow-hidden">
                <span className="font-black text-[#1D1D1F] text-xs px-3 pb-2 border-b border-[#E5E5EA] w-full">{selectedIds.size} Selected</span>
                
                <button onClick={() => {
                  if (selectedIds.size === filteredCapsules.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(filteredCapsules.map(c => c.id)));
                  }
                }} className="flex items-center gap-2 px-3 py-2.5 text-[#007AFF] hover:bg-[#F2F2F7] transition-colors mt-1 w-full text-left">
                  <CheckSquare size={16} className="shrink-0" />
                  <span className="text-xs font-medium truncate">{selectedIds.size === filteredCapsules.length ? 'Deselect All' : 'Select All'}</span>
                </button>

                {filter !== 'archived' && filter !== 'trash' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const first = allCapsules.find((c) => selectedIds.has(c.id));
                      setBatchCat(first?.category || '');
                      setBatchTags((first?.tags || []).join(', '));
                      setBatchTagCatOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 text-[#007AFF] hover:bg-[#F2F2F7] transition-colors w-full text-left"
                  >
                    <TagLucideIcon size={16} className="shrink-0" />
                    <span className="text-xs font-medium truncate">Category &amp; Tag</span>
                  </button>
                ) : null}

                {filter === 'archived' ? (
                  <>
                    <button onClick={() => batchUpdate({ isArchived: false })} className="flex items-center gap-2 px-3 py-2.5 text-[#4CAF50] hover:bg-[#F2F2F7] transition-colors w-full text-left"><RotateCcw size={16} className="shrink-0" /><span className="text-xs font-medium">Restore</span></button>
                    <button onClick={() => batchUpdate({ isDeleted: true })} className="flex items-center gap-2 px-3 py-2.5 text-[#FF3B30] hover:bg-[#F2F2F7] transition-colors w-full text-left"><Trash2 size={16} className="shrink-0" /><span className="text-xs font-medium">Delete</span></button>
                  </>
                ) : filter === 'trash' ? (
                  <>
                    <button onClick={() => batchUpdate({ isDeleted: false })} className="flex items-center gap-2 px-3 py-2.5 text-[#4CAF50] hover:bg-[#F2F2F7] transition-colors w-full text-left"><RotateCcw size={16} className="shrink-0" /><span className="text-xs font-medium">Restore</span></button>
                    <button onClick={() => {
                      if (confirm('Are you sure you want to permanently delete the selected notes? This cannot be undone.')) {
                        batchRemovePermanently();
                      }
                    }} className="flex items-center gap-2 px-3 py-2.5 text-[#FF3B30] hover:bg-[#F2F2F7] transition-colors w-full text-left"><Trash2 size={16} className="shrink-0" /><span className="text-xs font-medium">Delete Forever</span></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => batchUpdate({ isArchived: true })} className="flex items-center gap-2 px-3 py-2.5 text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors w-full text-left"><Archive size={16} className="shrink-0" /><span className="text-xs font-medium">Archive</span></button>
                    <button onClick={() => batchUpdate({ isDeleted: true })} className="flex items-center gap-2 px-3 py-2.5 text-[#FF3B30] hover:bg-[#F2F2F7] transition-colors w-full text-left"><Trash2 size={16} className="shrink-0" /><span className="text-xs font-medium">Delete</span></button>
                    <button onClick={async () => {
                      const selectedNotes = allCapsules.filter(c => selectedIds.has(c.id));
                      const text = selectedNotes.map(c => `[${c.category || 'Note'}] ${plainTextFromContent(c.content)}`).join('\n\n---\n\n');
                      if (navigator.share) {
                        try { await navigator.share({ title: 'Shared Lumi Notes', text }); } catch (err) { console.log('Share error', err); }
                      } else {
                        navigator.clipboard.writeText(text);
                        alert('Copied all selected notes to clipboard!');
                      }
                    }} className="flex items-center gap-2 px-3 py-2.5 text-[#007AFF] hover:bg-[#F2F2F7] transition-colors w-full text-left"><Share2 size={16} className="shrink-0" /><span className="text-xs font-medium">Share</span></button>
                  </>
                )}

                <div className="h-px bg-[#E5E5EA] w-full my-1" />
                <button onClick={() => setSelectedIds(new Set())} className="flex items-center gap-2 px-3 py-2.5 text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors w-full text-left"><X size={16} className="shrink-0" /><span className="text-xs font-medium">Cancel</span></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {batchTagCatOpen && selectedIds.size > 0 ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-auto">
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-black/40"
              onClick={() => setBatchTagCatOpen(false)}
            />
            <div
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#E5E5EA] space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-black text-[#1D1D1F]">
                Category &amp; Tag ({selectedIds.size} notes)
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">Category</div>
                <input
                  type="text"
                  value={batchCat}
                  onChange={(e) => setBatchCat(e.target.value)}
                  placeholder="e.g. Work"
                  className="w-full px-3 py-2 bg-[#F2F2F7] rounded-xl text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">Tags (comma separated)</div>
                <input
                  type="text"
                  value={batchTags}
                  onChange={(e) => setBatchTags(e.target.value)}
                  placeholder="idea, follow-up"
                  className="w-full px-3 py-2 bg-[#F2F2F7] rounded-xl text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBatchTagCatOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#F2F2F7] text-xs font-bold text-[#1D1D1F]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cat = batchCat.trim();
                    const tags = batchTags.split(',').map((t) => t.trim()).filter(Boolean);
                    void batchUpdate({ category: cat || undefined, tags: tags.length ? tags : undefined });
                    setBatchTagCatOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#007AFF] text-xs font-bold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}


        <footer 
          id="input-area" 
          className={`shrink-0 transition-all duration-500 ease-in-out relative z-[80] bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border-t border-[#E5E5EA] dark:border-white/10 flex flex-col items-center justify-center ${
            isCaptureCollapsed 
              ? 'h-0 min-h-0 py-0 opacity-0 pointer-events-none translate-y-full overflow-hidden' 
              : 'min-h-[96px] px-4 md:px-8 pt-3 pb-[calc(32px+env(safe-area-inset-bottom))] md:pb-4 md:pt-3 opacity-100 translate-y-0'
          } ${selectedIds.size > 0 ? 'opacity-30 pointer-events-none' : ''}`}
        >
          {/* iOS-style Drag/Collapse Handle */}
          {!isCaptureCollapsed && (
            <button
              type="button"
              title="Collapse input area"
              onClick={() => setIsCaptureCollapsed(true)}
              className="absolute top-2.5 left-1/2 -translate-x-1/2 w-14 h-1.5 rounded-full bg-black/10 dark:bg-white/20 hover:bg-black/25 dark:hover:bg-white/35 transition-all cursor-pointer z-50 flex items-center justify-center active:scale-95"
            >
              <span className="sr-only">Collapse</span>
            </button>
          )}

          {/* Clarification Pill 已提取为 portal 浮层，不再放在 footer 内部 */}

          <div 
            id="quick-capture-area"
            className="flex items-center w-full max-w-3xl gap-2 md:gap-4 flex-nowrap bg-white/50 dark:bg-black/20 p-2 rounded-[32px] border border-white/20 shadow-sm mt-1.5 md:mt-0"
          >
             <div className={`flex-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[24px] min-h-[56px] flex items-center px-5 transition-all border-2 border-transparent ${isListening ? 'border-red-400 ring-8 ring-red-50' : 'focus-within:border-[#007AFF]/20 focus-within:bg-white dark:focus-within:bg-[#3A3A3C] focus-within:shadow-2xl'}`}>
                <div className="text-[#007AFF] mr-3 shrink-0">
                   <Zap size={22} strokeWidth={2.5} />
                </div>
                <input 
                  id="thought-input"
                  ref={inputRef}
                  type="text" 
                  placeholder={isListening ? "Listening..." : "Record your thoughts..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (!inputText.trim()) {
                        alert(
                          '请输入文字，然后点击右侧按钮创建便签；或按住右侧麦克风录制语音，系统会自动识别并创建便签。',
                        );
                        return;
                      }
                      handleCreateCapsule(inputText);
                      setInputText('');
                    }
                  }}
                  disabled={isProcessing}
                  className="bg-transparent border-none focus:ring-0 flex-1 text-base md:text-lg placeholder-[#8E8E93] dark:text-[#F2F2F7] outline-none py-3"
                />
                <button 
                  type="button"
                  title="创建便签"
                  onClick={() => {
                    if (!inputText.trim() && !isProcessing) {
                      alert(
                        '请输入文字，然后点击本按钮创建便签；或按住右侧麦克风录制语音，系统会自动识别并创建便签。',
                      );
                      return;
                    }
                    handleCreateCapsule(inputText);
                    setInputText('');
                  }}
                  disabled={isProcessing}
                  className="text-[#007AFF] p-2 hover:scale-110 active:scale-90 transition-all font-bold disabled:opacity-50"
                >
                  {isProcessing ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><RotateCcw size={20} /></motion.div> : <Check size={26} strokeWidth={3} />}
                </button>
             </div>

             <motion.button 
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onMouseDown={startListening}
               onMouseUp={stopListening}
               onTouchStart={startListening}
               onTouchEnd={stopListening}
               className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-2xl shrink-0 ${isListening ? 'bg-red-500 ring-8 ring-red-100' : 'bg-gradient-to-br from-[#007AFF] to-[#00C6FF]'}`}
             >
               {isListening ? (
                 <div className="flex gap-1 items-center">
                   <motion.div animate={{ height: [8, 20, 8] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-white rounded-full" />
                   <motion.div animate={{ height: [12, 30, 12] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-1 bg-white rounded-full" />
                   <motion.div animate={{ height: [8, 20, 8] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-1 bg-white rounded-full" />
                 </div>
               ) : (
                 <Mic size={28} className="text-white" />
               )}
             </motion.button>
          </div>
        </footer>

        {/* Floating Quick Capture Trigger */}
        <AnimatePresence>
          {isCaptureCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="fixed bottom-6 -translate-x-1/2 z-[80] flex items-center shadow-2xl border border-white/20 select-none"
              style={{
                left: isSidebarOpen && !isMobile ? 'calc(50% + 120px)' : '50%',
                borderRadius: '9999px',
                padding: '2px',
                background: quickCaptureMode === 'voice' ? '#EF4444' : 'linear-gradient(135deg, #007AFF 0%, #00C6FF 100%)'
              }}
            >
              {quickCaptureMode === 'buttons' && (
                <div className="flex items-center gap-1 px-1 py-1 text-white font-bold text-xs">
                  <button
                    type="button"
                    title="Quick text capture"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickCaptureMode('text');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-white font-black tracking-tight"
                  >
                    <Keyboard size={14} />
                    <span>Text</span>
                  </button>
                  
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white shrink-0 mx-1 shadow-sm border border-white/10">
                    <Plus size={12} className="stroke-[3]" />
                  </div>
                  
                  <button
                    type="button"
                    title="Quick voice capture"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!hasPremiumAccess(user)) {
                        alert("Unlimited Voice Transcription requires Lumi Note Pro.");
                        setShowPremiumModal(true);
                        return;
                      }
                      setQuickCaptureMode('voice');
                      startListening();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-white font-black tracking-tight"
                  >
                    <Mic size={14} />
                    <span>Voice</span>
                  </button>
                </div>
              )}

              {quickCaptureMode === 'text' && (
                <div className="flex items-center gap-2 pl-4 pr-2 py-1 text-white text-xs">
                  <Keyboard size={14} className="text-white/75 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Quick note..."
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (quickText.trim()) {
                          handleCreateCapsule(quickText);
                          setQuickText('');
                          setQuickCaptureMode('buttons');
                        }
                      } else if (e.key === 'Escape') {
                        setQuickCaptureMode('buttons');
                      }
                    }}
                    className="bg-transparent border-none text-white text-xs placeholder-white/50 focus:ring-0 outline-none w-36 md:w-52 py-1 px-0 shrink"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (quickText.trim()) {
                        handleCreateCapsule(quickText);
                        setQuickText('');
                        setQuickCaptureMode('buttons');
                      }
                    }}
                    className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-90 transition-all cursor-pointer"
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickCaptureMode('buttons');
                    }}
                    className="p-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 active:scale-90 transition-all cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {quickCaptureMode === 'voice' && (
                <div className="flex items-center gap-3 pl-4 pr-2 py-1.5 text-white text-xs">
                  <div className="flex gap-1 items-center shrink-0">
                    <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-[2.5px] bg-white rounded-full" />
                    <motion.div animate={{ height: [6, 18, 6] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-[2.5px] bg-white rounded-full" />
                    <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-[2.5px] bg-white rounded-full" />
                  </div>
                  <span className="font-black tracking-tight shrink-0 mr-1">Listening...</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      stopListening();
                      setQuickCaptureMode('buttons');
                    }}
                    className="p-1.5 rounded-full bg-white/25 text-white hover:bg-white/35 active:scale-90 transition-all cursor-pointer"
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clarification Pill — 在 main 容器内 absolute 定位，不受 footer 折叠影响，居中更美观 */}
        {pendingClarificationCapsuleId && (
          <AnimatePresence>
            {(() => {
              const pendingCapsule = 
                (temporaryPendingCapsule && temporaryPendingCapsule.id === pendingClarificationCapsuleId)
                  ? temporaryPendingCapsule
                  : [...capsules, ...demoCapsules].find(c => c.id === pendingClarificationCapsuleId);
              
              if (!pendingCapsule || !pendingCapsule.isAmbiguous) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 30, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="absolute z-[200] left-1/2 -translate-x-1/2 w-full max-w-[580px] px-4 pointer-events-auto shadow-[0_12px_40px_rgba(0,0,0,0.15)] clarification-pill-outer"
                  style={{
                    bottom: isCaptureCollapsed ? '96px' : '156px'
                  }}
                >
                  <ClarificationPill
                    capsule={pendingCapsule}
                    onResolve={(updates) => {
                      updateCapsule(pendingCapsule.id, updates);
                      setPendingClarificationCapsuleId(null);
                      setTemporaryPendingCapsule(null);
                    }}
                    onUpdate={(updates) => {
                      updateCapsule(pendingCapsule.id, updates);
                    }}
                  />
                </motion.div>
              );
            })()}
          </AnimatePresence>
        )}
      </main>
      
      <PremiumModal 
        isOpen={showPremiumModal} 
        onClose={() => setShowPremiumModal(false)}
        user={user}
        hideFeatures={showProFeaturesModal}
        onSuccess={() => {
           setShowPremiumModal(false);
           alert("Payment successful! You are now an Lumi Note Pro member.");
           setDoc(doc(getDb(), 'users', user?.uid), { isPremium: true }, { merge: true });
        }}
      />
      
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        user={user}
        onUpgradeClick={() => {
           setShowSettingsModal(false);
           setShowPremiumModal(true);
        }}
        onDowngradeClick={() => {
           if (user?.uid) {
             setDoc(doc(getDb(), 'users', user.uid), { isPremium: false }, { merge: true });
             alert('You have successfully downgraded from Pro mode.');
             setShowSettingsModal(false);
           }
        }}
      />

      <ProFeaturesModal
        isOpen={showProFeaturesModal}
        onClose={() => setShowProFeaturesModal(false)}
        user={user}
        onUpgrade={() => setShowPremiumModal(true)}
      />

      {/* Edge Swipe Panel Trigger (Mock Implementation for Edge Panel) */}
      {user && hasPremiumAccess(user) && (
         <div 
           className="fixed right-0 top-1/2 -translate-y-1/2 w-2 h-24 bg-[#007AFF]/20 hover:bg-[#007AFF] hover:w-6 hover:h-48 group transition-all duration-300 rounded-l-2xl z-50 flex items-center justify-start cursor-pointer shadow-lg backdrop-blur-md"
           onClick={() => {
              // Trigger quick input focus and open sidebar or directly trigger listening
              if (!isListening) startListening();
           }}
           title="Edge Swipe (Pro) - Quick Recording"
         >
           <Mic size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
         </div>
      )}
      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-full bg-black/85 dark:bg-white/95 backdrop-blur-md text-white dark:text-black text-xs font-bold shadow-2xl flex items-center gap-2 border border-white/10 dark:border-black/5"
          >
            {toastType === 'info' && <RefreshCw size={14} className="animate-spin text-[#007AFF]" />}
            {toastType === 'success' && <Check size={14} className="text-[#34C759]" strokeWidth={3} />}
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D1D1D6; border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #AEAEB2; }
      `}</style>
    </div>
  );
}

function SidebarItem({ 
  id, 
  icon, 
  label, 
  isActive, 
  onClick, 
  onRename,
  onDelete,
  isSidebarOpen,
  isCustom = false,
  count
}: { 
  key?: string | number;
  id?: string;
  icon?: React.ReactNode; 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  isSidebarOpen: boolean;
  isCustom?: boolean;
  count?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = () => {
    if (editValue.trim() && editValue !== label) {
      onRename?.(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setEditValue(label);
      setIsEditing(false);
    }
  };

  if (isConfirmingDelete) {
    return (
      <div className="px-3 py-2 mb-1 bg-red-50 rounded-2xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-right-2 z-50 border border-red-100">
        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider leading-tight">Delete category and its notes?</span>
        <div className="flex items-center justify-end gap-1.5">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
            className="p-1 px-2.5 bg-white text-[#8E8E93] text-[10px] rounded-lg font-bold border border-[#E5E5EA] hover:bg-[#F2F2F7]"
          >
            Cancel
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); setIsConfirmingDelete(false); }}
            className="p-1 px-3 bg-red-500 text-white text-[10px] rounded-lg font-bold hover:bg-red-600 shadow-sm"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative group w-full mb-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        onClick={() => !isEditing && onClick()}
        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none group/item ${
          isActive 
            ? 'bg-[#007AFF] text-white shadow-lg' 
            : 'text-[#8E8E93] hover:bg-[#F2F2F7] hover:text-[#1D1D1F]'
        }`}
      >
        {icon ? (
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {icon}
          </div>
        ) : (
          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-[#C7C7CC]'} ml-1.5`} />
        )}
        {isSidebarOpen && (
          isEditing ? (
            <input
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className={`bg-black/5 border-none focus:ring-2 focus:ring-[#007AFF]/20 text-sm font-medium w-full rounded px-2 py-0.5 outline-none ${isActive ? 'text-white placeholder-white/60 bg-white/20' : 'text-[#1D1D1F] placeholder-[#8E8E93]'}`}
            />
          ) : (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className={`${isActive ? 'font-bold' : 'font-medium'} text-sm truncate`}>{label}</span>
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2 ${isActive ? 'bg-white/20 text-white' : 'bg-[#E5E5EA] text-[#8E8E93]'}`}>
                  {count}
                </span>
              )}
            </div>
          )
        )}
      </div>

      {isCustom && isSidebarOpen && !isEditing && (
        <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button 
            type="button"
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              setIsEditing(true); 
            }}
            className={`p-1.5 rounded-lg transition-all shadow-sm active:scale-90 ${isActive ? 'bg-white text-[#007AFF] hover:bg-white/90' : 'bg-white border border-[#E5E5EA] text-[#8E8E93] hover:text-[#007AFF]'}`}
          >
            <Edit2 size={12} />
          </button>
          <button 
            type="button"
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              setIsConfirmingDelete(true);
            }}
            className={`p-1.5 rounded-lg transition-all shadow-sm active:scale-90 ${isActive ? 'bg-white text-red-500 hover:bg-white/90' : 'bg-white border border-[#E5E5EA] text-red-500 hover:bg-red-600'}`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

interface CapsuleItemProps {
  index: number;
  key?: string | number;
  capsule: Capsule;
  patchCapsule: (id: string, updates: Partial<Capsule>) => void;
  onRemovePermanently: () => void;
  allCategories: string[];
  allTags: string[];
  viewMode: 'grid' | 'list';
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  onViewDetail: () => void;
  isPremium: boolean;
  showToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onSelectAll?: () => void;
}

const formatNoteDateTime = (ts: number) => new Date(ts).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const repeatLabelForMenu = (r: any) => {
  if (!r || r.type === 'none') return 'None';
  if (r.type === 'once') return 'Once';
  if (r.type === 'custom') return `Every ${r.customInterval} ${r.customUnit}(s)`;
  return r.type.charAt(0).toUpperCase() + r.type.slice(1);
};

function reminderBellTitle(capsule: Capsule): string {
  const r = capsule.reminder;
  if (!r || r.type === 'none' || r.date == null) return 'Reminder';
  const when = new Date(r.date).toLocaleString();
  const schedule = repeatLabelForMenu(r);
  return [`When: ${when}`, `Schedule: ${schedule}`].join('\n');
}

const CapsuleItem = memo(function CapsuleItem({
  capsule,
  index,
  viewMode,
  patchCapsule,
  onRemovePermanently,
  allCategories,
  allTags,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  onViewDetail,
  isPremium,
  showToast,
  onSelectAll,
}: CapsuleItemProps) {
  const capsuleColor = capsule.color || PRESET_COLORS[index % PRESET_COLORS.length] || '#E65100';
  const [showOptions, setShowOptions] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [isConfiguringCustom, setIsConfiguringCustom] = useState(false);
  const [showTagCat, setShowTagCat] = useState(false);
  // 自定义颜色（HEX）：恢复「色板 + 自定义取色」能力。
  const [customColor, setCustomColor] = useState(capsule.color || '#FFD60A');
  // Which menu the portal renders: 'actions' (left-click ⋮ → per-note quick
  // actions) or 'batch' (desktop right-click → multi-select / management).
  const [menuMode, setMenuMode] = useState<'actions' | 'batch'>('actions');

  const [tempCategory, setTempCategory] = useState(capsule.category || '');
  const [tempTags, setTempTags] = useState((capsule.tags || []).join(', '));
  const [tempReminderDate, setTempReminderDate] = useState<number | null>(capsule.reminder?.date || null);
  const [tempReminderType, setTempReminderType] = useState<ReminderType>(capsule.reminder?.type || 'none');

  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);

  // Floating options menu (portal-rendered so it is never clipped by the
  // card's `overflow-hidden`). Anchored to the kebab button on click, or to
  // the cursor on desktop right-click.
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const suppressNextClickRef = useRef(false);

  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  // 长按进入多选：与右键等价的「批量管理」入口（移动端触屏 + 桌面按住左键）。
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const cardRootRef = useRef<HTMLDivElement>(null);
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const MENU_WIDTH = 200;
  const closeMenu = useCallback(() => {
    setShowOptions(false);
    setShowReminderPicker(false);
    setIsConfiguringCustom(false);
    setShowColorPicker(false);
    setShowTagCat(false);
    setMenuMode('actions');
    setMenuPos(null);
  }, []);

  const openMenuAt = useCallback((x: number, y: number, mode: 'actions' | 'batch' = 'actions') => {
    // Reserve enough vertical room for the tallest panel (reminder picker) so
    // the menu flips above the anchor when near the bottom edge.
    const budgetH = 360;
    let left = x;
    let top = y;
    if (left + MENU_WIDTH > window.innerWidth - 8) left = window.innerWidth - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + budgetH > window.innerHeight - 8) top = Math.max(8, y - budgetH);
    if (top < 8) top = 8;
    setShowReminderPicker(false);
    setIsConfiguringCustom(false);
    setShowColorPicker(false);
    setShowTagCat(false);
    setMenuMode(mode);
    setMenuPos({ left, top });
    setShowOptions(true);
  }, []);

  const openMenuFromButton = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      openMenuAt(r.right - MENU_WIDTH, r.bottom + 6);
    } else {
      openMenuAt(window.innerWidth / 2 - MENU_WIDTH / 2, window.innerHeight / 2);
    }
  }, [openMenuAt]);

  const handleTouchStartSwipe = (e: React.TouchEvent) => {
    if (showOptions || showColorPicker || showReminderPicker) return;
    if (e.touches.length === 0) return;
    if (isSelectionMode) return;

    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isHorizontalSwipe.current = null;
    setIsSwiping(true);

    // 长按 ~480ms 进入多选模式（移动端「批量管理」入口，等价于桌面右键）。
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      onToggleSelection();
      // 吞掉长按后紧随的 click，避免立刻又被切回（取消选中）或打开详情。
      suppressNextClickRef.current = true;
      setIsSwiping(false);
      setSwipeX(0);
      touchStartPos.current = null;
    }, 480);
  };

  const handleTouchMoveSwipe = (e: React.TouchEvent) => {
    if (!touchStartPos.current || e.touches.length === 0) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartPos.current.x;
    const dy = currentY - touchStartPos.current.y;

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
      }
    }

    // 一旦发生明显移动（滑动/滚动），取消长按计时，避免误触发多选。
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPress();

    if (isHorizontalSwipe.current === true) {
      if (e.cancelable) e.preventDefault();
      let targetX = dx;
      // 阻尼反馈：滑动超过一定距离后增加物理拉伸感阻尼，提升高级触感
      if (targetX > 160) {
        targetX = 160 + (targetX - 160) * 0.15;
      } else if (targetX < -160) {
        targetX = -160 + (targetX + 160) * 0.15;
      }
      setSwipeX(targetX);
    }
  };

  const handleTouchEndSwipe = () => {
    clearLongPress();
    setIsSwiping(false);
    if (!touchStartPos.current) return;
    touchStartPos.current = null;

    if (isHorizontalSwipe.current === true) {
      // 触发阈值设定为 100px
      if (swipeX > 100) {
        // 右滑：完成/激活待办（如果原本不是 Todo，也转化为 Todo）
        const nextCompletedStatus = !capsule.completed;
        void onUpdate({ completed: nextCompletedStatus, isTodo: true });
        if (showToast) {
          showToast(nextCompletedStatus ? 'Task completed!' : 'Task active!', 'success');
        }
      } else if (swipeX < -100) {
        // 左滑：归档/撤销归档
        const nextArchivedStatus = !capsule.isArchived;
        void onUpdate({ isArchived: nextArchivedStatus });
        if (showToast) {
          showToast(nextArchivedStatus ? 'Note archived!' : 'Note unarchived!', 'success');
        }
      }
    }
    setSwipeX(0);
    isHorizontalSwipe.current = null;
  };

  // 桌面端：按住左键 ~480ms 进入多选（与右键等价）。移动超过阈值或提前松开则取消。
  const handleMouseDownCard = (e: React.MouseEvent) => {
    if (e.button !== 0) return;                 // 仅左键
    if (isSelectionMode) return;
    if (showOptions || showColorPicker || showReminderPicker) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, label, [data-no-longpress]')) return;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      onToggleSelection();
      suppressNextClickRef.current = true;
      mouseDownPos.current = null;
    }, 480);
  };
  const handleMouseMoveCard = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;
    if (
      Math.abs(e.clientX - mouseDownPos.current.x) > 6 ||
      Math.abs(e.clientY - mouseDownPos.current.y) > 6
    ) {
      clearLongPress();
      mouseDownPos.current = null;
    }
  };
  const handleMouseUpLeaveCard = () => {
    clearLongPress();
    mouseDownPos.current = null;
  };

  useEffect(() => {
    setTempCategory(capsule.category || '');
    setTempTags((capsule.tags || []).join(', '));
    setTempReminderDate(capsule.reminder?.date || null);
    setTempReminderType(capsule.reminder?.type || 'none');
  }, [capsule]);

  const onUpdate = useCallback(
    (updates: Partial<Capsule>) => {
      return patchCapsule(capsule.id, updates);
    },
    [capsule.id, patchCapsule],
  );

  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (portalMenuRef.current && portalMenuRef.current.contains(target)) return;
      // Swallow the dismiss click ONLY when it lands on this card, so the same
      // click doesn't also open the detail view. If the dismiss click is
      // outside the card, the card's onClick never fires — suppressing it then
      // would wrongly eat the NEXT genuine click (the old "two clicks to open"
      // bug). So we scope suppression to clicks inside this card.
      const insideThisCard = !!(cardRootRef.current && cardRootRef.current.contains(target));
      if ((showOptions || showReminderPicker) && insideThisCard) {
        suppressNextClickRef.current = true;
      }
      setShowOptions(false);
      setShowColorPicker(false);
      setShowReminderPicker(false);
      setIsConfiguringCustom(false);
      setShowTagCat(false);
      setMenuMode('actions');
      setMenuPos(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showOptions, showColorPicker, showReminderPicker]);

  const [customInterval, setCustomInterval] = useState(capsule.reminder?.customInterval || 1);
  const [customUnit, setCustomUnit] = useState<'day' | 'week' | 'month'>(capsule.reminder?.customUnit || 'day');

  const handleReminderSelect = (type: ReminderType) => {
    if (type === 'custom') {
      setIsConfiguringCustom(true);
    } else {
      setTempReminderType(type);
    }
  };

  const saveReminder = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    if (tempReminderType === 'none' && !tempReminderDate) {
      void onUpdate({ reminder: undefined });
    } else {
      const type = tempReminderType === 'none' ? 'once' : tempReminderType;
      const date = tempReminderDate || (Date.now() + 3600000);
      void onUpdate({
        reminder: {
          type,
          date,
          customInterval: type === 'custom' ? customInterval : undefined,
          customUnit: type === 'custom' ? customUnit : undefined
        }
      });
    }
    setShowReminderPicker(false);
    setIsConfiguringCustom(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setTempReminderDate(null);
    } else {
      setTempReminderDate(new Date(val).getTime());
    }
  };

  return (
    <div 
      id={`capsule-item-${index}`}
      className="relative overflow-hidden w-full rounded-2xl md:rounded-[24px]"
    >
      {window.innerWidth <= 768 && isSwiping && Math.abs(swipeX) > 10 && (
        <div 
          className="absolute inset-0 flex items-center justify-between px-6 z-0 rounded-2xl md:rounded-[24px]"
          style={{
            backgroundColor: swipeX > 0 
              ? '#30D158' 
              : (swipeX < 0 ? '#007AFF' : 'transparent'),
          }}
        >
          {/* 左侧提示（右滑触发完成待办） */}
          <div 
            className={cn(
              "flex items-center gap-2 text-white transition-all duration-150",
              swipeX > 30 ? "opacity-100 translate-x-0 scale-100" : "opacity-0 -translate-x-4 scale-90",
              swipeX > 100 ? "scale-110 font-black text-white" : ""
            )}
          >
            {capsule.completed ? <Undo size={18} className="shrink-0" /> : <Check size={18} className="shrink-0" />}
            <span className="text-[10px] font-black uppercase tracking-wider">
              {capsule.completed ? 'Activate' : 'Complete'}
            </span>
          </div>

          {/* 右侧提示（左滑触发归档） */}
          <div 
            className={cn(
              "flex items-center gap-2 text-white transition-all duration-150",
              swipeX < -30 ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-4 scale-90",
              swipeX < -100 ? "scale-110 font-black text-white" : ""
            )}
          >
            <span className="text-[10px] font-black uppercase tracking-wider">
              {capsule.isArchived ? 'Unarchive' : 'Archive'}
            </span>
            {capsule.isArchived ? <Inbox size={18} className="shrink-0" /> : <Archive size={18} className="shrink-0" />}
          </div>
        </div>
      )}

      <div
        ref={cardRootRef}
        className={cn(
          "group w-full shrink-0 flex relative select-none border-b border-black/5",
          viewMode === 'grid'
            ? "flex-col justify-between min-h-[160px] md:min-h-[220px]"
            : "items-center gap-1.5 p-2.5 md:gap-3 md:p-6",
          isSelected ? "border-[#007AFF] shadow-xl ring-4 ring-[#007AFF]/10" : "border-black/5 hover:border-black/10 hover:shadow-lg",
          capsule.isTodo &&
          capsule.completed &&
          !(showOptions || showColorPicker || showReminderPicker)
            ? "opacity-60"
            : "",
          (showOptions || showColorPicker || showReminderPicker) ? "z-[70]" : "z-10",
          isSwiping ? "transition-none" : "transition-transform duration-200 ease-out"
        )}
        style={{ 
          backgroundColor: capsuleColor,
          transform: window.innerWidth <= 768 ? `translateX(${swipeX}px)` : 'none',
          // Suppress the iOS long-press "callout" (copy / share / look up) so it
          // never overlaps our swipe gesture or options menu on touch devices.
          WebkitTouchCallout: 'none',
        }}
        onTouchStart={handleTouchStartSwipe}
        onTouchMove={handleTouchMoveSwipe}
        onTouchEnd={handleTouchEndSwipe}
        onTouchCancel={handleTouchEndSwipe}
        onMouseDown={handleMouseDownCard}
        onMouseMove={handleMouseMoveCard}
        onMouseUp={handleMouseUpLeaveCard}
        onMouseLeave={handleMouseUpLeaveCard}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, a, input, textarea, label, [data-no-longpress]')) {
            return;
          }
          // Always suppress the browser's native long-press / right-click menu.
          // Desktop right-click enters multi-select for THIS note, surfacing the
          // single consolidated batch toolbar (Select All / Archive / Delete /
          // Category & Tag / Share) — same entry point as mobile long-press.
          e.preventDefault();
          e.stopPropagation();
          onToggleSelection();
          suppressNextClickRef.current = true;
        }}
        onClick={(e) => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            e.stopPropagation();
            return;
          }
          if (isSelectionMode) {
            e.stopPropagation();
            onToggleSelection();
          } else {
            onViewDetail();
          }
        }}
      >
        {capsule.isAmbiguous && (
          <div className="absolute inset-0 bg-black/5 dark:bg-white/5 backdrop-blur-[3.5px] z-10 flex flex-col items-center justify-center rounded-2xl md:rounded-[24px] pointer-events-none transition-all duration-300">
            <div className="bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-black/5 dark:border-white/10 shadow-lg flex items-center gap-1.5 animate-pulse">
              <Sparkles size={11} className="text-[#007AFF] fill-[#007AFF]/25" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#007AFF]">Intent Pending</span>
            </div>
          </div>
        )}
        {(capsule.isPinned || capsule.isStarred || (capsule.reminder && capsule.reminder.type !== 'none' && capsule.reminder.date)) && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
            {/* 置顶 / 星标：常显，无悬浮动效 */}
            {capsule.isPinned && (
              <Pin size={13} className="text-white/80 fill-white/80 rotate-45 shrink-0 transition-opacity" />
            )}
            {capsule.isStarred && (
              <Star size={13} className="text-[#FFCC00] fill-[#FFCC00] shrink-0 transition-opacity" />
            )}
            {capsule.reminder && capsule.reminder.type !== 'none' && capsule.reminder.date && (
              <span 
                title={`Reminder: ${new Date(capsule.reminder.date).toLocaleString('en-US')} (${capsule.reminder.type.charAt(0).toUpperCase() + capsule.reminder.type.slice(1)})`}
                className="inline-flex shrink-0 cursor-help"
              >
                <Bell 
                  size={13} 
                  className={cn(capsule.reminder.date <= Date.now() ? "text-red-200 animate-pulse" : "text-white/80")} 
                />
              </span>
            )}
          </div>
        )}

        <div className={cn(
          "flex flex-col items-center gap-2 z-[20] shrink-0 transition-all",
          viewMode === 'grid' ? "absolute top-4 left-4" : "pl-1"
        )}>
          {capsule.isTodo && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (isSelectionMode) {
                  onToggleSelection();
                } else {
                  onUpdate({ completed: !capsule.completed });
                }
              }}
              className={cn(
                "flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all bg-white/20 border-white/40 hover:bg-white/40 hover:border-white/60",
                capsule.completed ? "bg-white/90 border-transparent text-[#007AFF]" : "text-transparent"
              )}
            >
              {capsule.completed && <Check size={16} strokeWidth={4} />}
            </button>
          )}
        </div>

        <div className={cn(
          "flex-1 min-w-0 flex flex-col h-full",
          viewMode === 'grid' ? "pt-0.5 justify-center text-center px-1 pb-4 md:pb-6" : "justify-center text-left"
        )}>
          <div className={cn(
            "text-base sm:text-lg md:text-xl font-bold leading-tight transition-all break-words select-none flex items-center gap-1.5 flex-wrap",
            capsule.isTodo && capsule.completed ? "line-through opacity-50 text-white/70" : "text-white",
            viewMode === 'grid' ? "whitespace-pre-wrap line-clamp-4" : "line-clamp-1"
          )}>
            <span>{capsule.subject || plainTextFromContent(capsule.content) || 'Untitled Note'}</span>
          </div>
          
          <div className={cn(
            "flex flex-col gap-2 shrink-0 w-full mt-3 opacity-100 pointer-events-auto",
            viewMode === 'grid' ? "items-center" : ""
          )}>
            <div
              className={cn(
                "flex flex-wrap gap-1 md:gap-1.5",
                viewMode === 'grid' ? "justify-center" : ""
              )}
            >
              {capsule.category && (
                <span className="text-[9px] font-black uppercase bg-white/25 px-2 py-0.5 rounded-md tracking-wider text-white/90">
                  {capsule.category}
                </span>
              )}
              {capsule.tags &&
                capsule.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="text-[9px] font-black bg-black/10 px-2 py-0.5 rounded-md text-white/80"
                  >
                    #{t}
                  </span>
                ))}
              {capsule.tags && capsule.tags.length > 3 && (
                <span className="text-[9px] font-black bg-black/15 px-1.5 py-0.5 rounded-md text-white/60">
                  +{capsule.tags.length - 3}
                </span>
              )}
            </div>

            <div className={cn(
              "flex flex-wrap items-center gap-2 text-[10px] text-white/60 select-none font-bold",
              viewMode === 'grid' ? "justify-center" : ""
            )}>
              <span className="inline-flex items-center gap-1">
                <Clock size={10} className="shrink-0" />
                <span className="uppercase tracking-wider">
                  {new Date(capsule.createdAt || Date.now()).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </span>
            </div>
          </div>

          <div className={cn(
            "flex flex-wrap items-center gap-2",
            viewMode === 'grid' ? "justify-center" : ""
          )}>
            {capsule.attachments && capsule.attachments.length > 0 && (
              <div className="flex items-center gap-1 text-white/60">
                <Paperclip size={12} />
                <span className="text-[10px] font-bold">{capsule.attachments.length}</span>
              </div>
            )}
          </div>
        </div>

        <div ref={menuRef} className={cn(
          "flex items-center gap-1 transition-opacity relative",
          showOptions || showReminderPicker ? "z-[110]" : "z-40",
          viewMode === 'grid' ? "absolute bottom-4 right-4" : "flex-shrink-0",
          "opacity-100"
        )}>
          <button
            id={`capsule-options-btn-${index}`}
            ref={triggerRef}
            type="button"
            aria-label="Note options"
            onClick={(e) => {
              e.stopPropagation();
              if (showOptions || showReminderPicker) { closeMenu(); } else { openMenuFromButton(); }
            }}
            className="p-2 text-white/70 hover:bg-white/25 hover:text-white rounded-full transition-colors flex items-center justify-center"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        {showOptions && menuPos && createPortal(
          <motion.div
            ref={portalMenuRef}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed z-[2000] w-[200px] max-w-[calc(100vw-16px)] bg-white border border-[#E5E5EA] rounded-xl shadow-2xl overflow-hidden text-[#1D1D1F]"
            style={{ left: menuPos.left, top: menuPos.top }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {showTagCat ? (
              /* 子面板：设置标签 & 分类（右键批量菜单进入） */
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-1 mb-1">
                  <button onClick={(e) => { e.stopPropagation(); setShowTagCat(false); }} className="p-1 hover:bg-[#F2F2F7] rounded-md">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-tight">Tags &amp; Category</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-[#8E8E93] uppercase block mb-1">Category</label>
                    <input
                      type="text"
                      value={tempCategory}
                      onChange={(e) => setTempCategory(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="e.g. Work"
                      className="w-full px-2 py-1.5 bg-[#F2F2F7] rounded-md text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-[#8E8E93] uppercase block mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={tempTags}
                      onChange={(e) => setTempTags(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="idea, follow-up"
                      className="w-full px-2 py-1.5 bg-[#F2F2F7] rounded-md text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const cat = tempCategory.trim();
                      const tags = tempTags.split(',').map((t) => t.trim()).filter(Boolean);
                      void onUpdate({ category: cat || undefined, tags: tags.length ? tags : undefined });
                      closeMenu();
                    }}
                    className="w-full py-2 bg-[#007AFF] text-white rounded-lg text-xs font-bold shadow-md hover:bg-[#0051FF] transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : showColorPicker ? (
              /* 子面板：更换颜色（左键 ⋮ 菜单进入） */
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-1 mb-1">
                  <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(false); }} className="p-1 hover:bg-[#F2F2F7] rounded-md">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-tight">Change Color</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Set color ${c}`}
                      onClick={(e) => { e.stopPropagation(); void onUpdate({ color: c }); closeMenu(); }}
                      className="w-7 h-7 rounded-full shadow-sm transition-transform hover:scale-110 flex items-center justify-center"
                      style={{
                        backgroundColor: c,
                        outline: (capsule.color || '') === c ? '2px solid #007AFF' : '2px solid transparent',
                        outlineOffset: '2px',
                      }}
                    >
                      {(capsule.color || '') === c && <Check size={12} className="text-white drop-shadow" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Reset color"
                    onClick={(e) => { e.stopPropagation(); void onUpdate({ color: null as unknown as string }); closeMenu(); }}
                    className="w-7 h-7 rounded-full border-2 border-dashed border-[#D1D1D6] bg-[#F2F2F7] text-[#8E8E93] flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                    title="Reset color"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
                <label
                  className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] rounded-xl cursor-pointer transition-colors relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-lg select-none shrink-0 leading-none">🎨</span>
                  <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F2F2F7]">Custom color</span>

                  {/* 当前自定义颜色的圆形预览块，替代原生取色器外观 */}
                  <span
                    className="w-5 h-5 rounded-full border border-black/10 shadow-sm ml-auto shrink-0 transition-transform hover:scale-105"
                    style={{ backgroundColor: capsule.color || '#FFD60A' }}
                  />

                  {/* 隐藏的真实 input：点击 label 时浏览器会自动调用其 click 动作 */}
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(customColor) ? customColor : '#FFD60A'}
                    onChange={(e) => { setCustomColor(e.target.value); void onUpdate({ color: e.target.value }); }}
                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                  />
                </label>
              </div>
            ) : !showReminderPicker ? (
              /* 单条快捷操作菜单（左键 ⋮）：
                 设为待办 / 设提醒 / 改颜色 / 归档 / 星标 / 置顶 / 分享。
                 删除属于管理动作，仅放在右键批量菜单中。 */
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); void onUpdate({ isTodo: !capsule.isTodo }); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  {capsule.isTodo ? <CheckSquare size={16} className="text-[#007AFF]" /> : <Square size={16} className="text-[#8E8E93]" />}
                  {capsule.isTodo ? 'Cancel To-do' : 'Set To-do'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReminderPicker(true); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Calendar size={16} className="text-[#8E8E93]" />
                  Set Reminder
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowColorPicker(true); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Palette size={16} className="text-[#8E8E93]" />
                  Change Color
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void onUpdate({ isArchived: true }); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Archive size={16} className="text-[#8E8E93]" />
                  Archive
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void onUpdate({ isStarred: !capsule.isStarred }); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Star size={16} className={capsule.isStarred ? "text-[#FFCC00] fill-[#FFCC00]" : "text-[#8E8E93]"} />
                  {capsule.isStarred ? 'Unstar' : 'Star'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void onUpdate({ isPinned: !capsule.isPinned }); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Pin size={16} className={capsule.isPinned ? "text-[#007AFF] fill-[#007AFF] rotate-45" : "text-[#8E8E93]"} />
                  {capsule.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const shareText = plainTextFromContent(capsule.content);
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      try { await navigator.share({ title: 'Lumi Note Share', text: shareText }); } catch (err) { console.log('Share failed or aborted', err); }
                    } else {
                      try { await navigator.clipboard.writeText(shareText); showToast('Note content copied to clipboard!', 'success'); } catch (err) { console.error('Copy to clipboard failed: ', err); }
                    }
                    closeMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Share2 size={16} className="text-[#8E8E93]" />
                  Share
                </button>
              </div>
            ) : !isConfiguringCustom ? (
              <div className="p-1">
                <div className="px-3 py-2 border-b border-[#F2F2F7]">
                  <div className="text-[9px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1.5">Specific Time</div>
                  <input
                    type="datetime-local"
                    value={tempReminderDate ? new Date(tempReminderDate - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={handleTimeChange}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 bg-[#F2F2F7] rounded-md text-[10px] sm:text-[11px] border-none focus:ring-2 focus:ring-[#007AFF] outline-none"
                  />
                </div>
                <div className="px-3 py-1.5 text-[9px] font-bold text-[#8E8E93] uppercase tracking-wider">Repeat</div>
                {(['once', 'daily', 'weekly', 'monthly', 'yearly', 'custom'] as ReminderType[]).map(type => (
                  <button
                    key={type}
                    onClick={(e) => { e.stopPropagation(); handleReminderSelect(type); }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-[#F2F2F7] capitalize font-medium rounded-lg transition-colors ${(tempReminderType === type || (tempReminderType === 'none' && type === 'once')) ? 'text-[#007AFF] bg-[#007AFF]/5' : 'text-[#1D1D1F]'}`}
                  >
                    <span>{type === 'once' ? 'No repeat' : type}</span>
                    {(tempReminderType === type || (tempReminderType === 'none' && type === 'once')) && <Check size={12} />}
                  </button>
                ))}
                <div className="p-2 border-t border-[#F2F2F7] mt-1 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onUpdate({ reminder: undefined }); closeMenu(); }}
                    className="flex-1 py-1.5 bg-[#F2F2F7] text-[#FF3B30] rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={(e) => { saveReminder(e); closeMenu(); }}
                    className="flex-1 py-1.5 bg-[#007AFF] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-[#0051FF] transition-all"
                  >
                    Save
                  </button>
                </div>
                <div className="h-px bg-[#F2F2F7] mx-2 mt-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReminderPicker(false); setIsConfiguringCustom(false); }}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-[11px] hover:bg-[#F2F2F7] text-[#8E8E93] font-bold rounded-lg transition-colors"
                >
                  <ChevronLeft size={12} />
                  Back
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-1 mb-1">
                  <button onClick={(e) => { e.stopPropagation(); setIsConfiguringCustom(false); }} className="p-1 hover:bg-[#F2F2F7] rounded-md">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-tight">Custom Repeat</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-[#8E8E93] uppercase block mb-1">Every</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={customInterval}
                        onChange={(e) => setCustomInterval(parseInt(e.target.value) || 1)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 px-2 py-1.5 bg-[#F2F2F7] rounded-md text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF] text-center"
                      />
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1.5 bg-[#F2F2F7] rounded-md text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF]"
                      >
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { saveReminder(e); closeMenu(); }}
                    className="w-full py-2 bg-[#007AFF] text-white rounded-lg text-xs font-bold shadow-md hover:bg-[#0051FF] transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </motion.div>,
          document.body
        )}
      </div>
    </div>
  );
});

function TagItem({ tag, tagFilter, setTagFilter, setCategoryFilter, removeTag, onRename, isMobile, setIsSidebarOpen, count }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tag);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = () => {
    if (editValue.trim() && editValue !== tag) {
      onRename?.(tag, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setEditValue(tag);
      setIsEditing(false);
    }
  };

  if (isConfirmingDelete) {
    return (
      <div className="px-3 py-2 mb-1 bg-red-50 rounded-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-right-2 z-50 border border-red-100">
        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider leading-tight">Delete tag and its notes?</span>
        <div className="flex items-center justify-end gap-1.5">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
            className="p-1 px-2.5 bg-white text-[#8E8E93] text-[10px] rounded-lg font-bold border border-[#E5E5EA] hover:bg-[#F2F2F7]"
          >
            Cancel
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); removeTag(tag); setIsConfirmingDelete(false); }}
            className="p-1 px-3 bg-red-500 text-white text-[10px] rounded-lg font-bold hover:bg-red-600 shadow-sm"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative group w-full mb-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        onClick={() => {
          if (isEditing) return;
          setTagFilter(tag === tagFilter ? null : tag);
          setCategoryFilter('all');
          if (isMobile) setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all cursor-pointer select-none ${
          tagFilter === tag 
            ? 'bg-[#007AFF] text-white shadow-lg' 
            : 'text-[#8E8E93] hover:bg-[#F2F2F7] hover:text-[#1D1D1F]'
        }`}
      >
        <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${tagFilter === tag ? 'bg-white' : 'bg-current opacity-40'}`} />
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={`bg-black/5 border-none focus:ring-2 focus:ring-[#007AFF]/20 text-sm font-medium w-full rounded px-2 py-0.5 outline-none ${tagFilter === tag ? 'text-white placeholder-white/60 bg-white/20' : 'text-[#1D1D1F] placeholder-[#8E8E93]'}`}
          />
        ) : (
          <div className="flex items-center justify-between flex-1 min-w-0">
            <span className={`${tagFilter === tag ? 'font-bold' : 'font-medium'} truncate`}>{tag}</span>
            {count !== undefined && count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2 ${tagFilter === tag ? 'bg-white/20 text-white' : 'bg-[#E5E5EA] text-[#8E8E93]'}`}>
                {count}
              </span>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditing(true); }}
            className={`p-1.5 rounded-lg shadow-sm active:scale-90 transition-all ${tagFilter === tag ? 'bg-white text-[#007AFF] hover:bg-white/90' : 'bg-white border border-[#E5E5EA] text-[#8E8E93] hover:text-[#007AFF]'}`}
            title="Rename"
          >
            <Edit2 size={12} />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsConfirmingDelete(true); }}
            className={`p-1.5 rounded-lg shadow-sm active:scale-90 transition-all ${tagFilter === tag ? 'bg-white text-red-500 hover:bg-white/90' : 'bg-white border border-[#E5E5EA] text-red-500 hover:bg-red-600'}`}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
function ProFeaturesModal({ isOpen, onClose, user, onUpgrade }: { 
  isOpen: boolean; 
  onClose: () => void; 
  user: any;
  onUpgrade: () => void;
}) {
  const features = [
    { id: 'ai', icon: '🤖', title: 'AI Smart Categorization', desc: 'Auto-detect categories.' },
    { id: 'rich', icon: '📝', title: 'Rich Text', desc: 'Advanced Tiptap editor.' },
    { id: 'voice', icon: '🎙️', title: 'Voice Capture', desc: 'Instant transcription.' },
    { id: 'native', icon: '🚀', title: 'Native App', desc: 'Android capture bar.' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[28px] w-full max-w-[320px] overflow-hidden shadow-2xl relative z-10"
      >
        <div className="bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] p-5 text-white text-center relative">
           <button onClick={onClose} className="absolute right-3 top-3 w-7 h-7 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition-colors">
             <X size={16} />
           </button>
           <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
             <CrownJewel size={28} />
           </div>
           <h2 className="text-xl font-black italic tracking-tight uppercase">Pro Features</h2>
        </div>

        <div className="p-4 space-y-3">
          {features.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-[#F2F2F7] transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <h3 className="text-[13px] font-bold text-[#1D1D1F]">{f.title}</h3>
                  <p className="text-[10px] text-[#8E8E93] font-medium leading-none mt-0.5">{f.desc}</p>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!user.isPremium) {
                    onUpgrade();
                  }
                }}
                className={cn(
                  "w-10 h-5 rounded-full relative transition-colors duration-200 p-0.5 flex-shrink-0",
                  user.isPremium ? "bg-[#34C759]" : "bg-[#C7C7CC]"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
                  user.isPremium ? "translate-x-5" : "translate-x-0"
                )} />
              </button>
            </div>
          ))}
          
          {!user.isPremium && (
            <button 
              onClick={onUpgrade}
              className="w-full bg-[#1D1D1F] text-white py-3 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all mt-2 uppercase tracking-widest"
            >
              Get Pro Access
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
