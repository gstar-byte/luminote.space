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
  Inbox
} from 'lucide-react';
import { Capsule, FilterType, ReminderConfig, ReminderType, UserProfile } from './types';
import { PRESET_COLORS } from './constants';
import { categorizeThought } from './services/nlpRouter';
import {
  getDb,
  getAuth,
  getGoogleProvider,
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
  ensureReady,
} from './lib/supabaseAdapter';
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  onboarded?: boolean;
  hasNotesCreatedOrSeeded?: boolean;
}

void ensureReady();

import { showSystemNotification } from './lib/notifications';
import { subscribeToPush } from './lib/webPush';
import { cn } from './lib/utils';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

import { LandingPage } from './components/LandingPage';
import { AppLogo } from './components/AppLogo';
import { CustomColorPicker } from './components/CustomColorPicker';
import { SettingsModal } from './components/SettingsModal';
import { CapsuleItem } from './components/CapsuleItem';
import { SidebarItem } from './components/SidebarItem';
import { TagItem } from './components/TagItem';

import { CapsuleEditor } from './components/CapsuleEditor';
import { ClarificationPill } from './components/ClarificationPill';
import {
  OperationType,
  handleDbError,
  hasActiveReminder,
  hasRepeatReminder,
  hasFinishedOneShotReminder,
  shouldBumpUpdatedAt,
  mergeCapsulePatch,
  partialCapsuleToDb,
  tagSignature,
  SIDEBAR_W,
  plainTextFromContent,
  repeatLabelForMenu,
} from './lib/capsuleUtils';

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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });
  // PWA 安装提示和开机启动引导
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isPWA] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [showStartupBanner, setShowStartupBanner] = useState(() =>
    isPWA && safeLocalStorageGet('luminote_startup_banner_dismissed') !== 'true'
  );
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [firedReminders, setFiredReminders] = useState<Capsule[]>([]);
  const notifiedIdsRef = useRef<Set<string>>(null as any);
  if (notifiedIdsRef.current === null) {
    let initialSet = new Set<string>();
    try {
      const raw = safeLocalStorageGet('luminote_notified_reminder_ids');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          initialSet = new Set(arr);
        }
      }
    } catch { /* ignore */ }
    notifiedIdsRef.current = initialSet;
  }

  const addNotifiedId = (id: string) => {
    notifiedIdsRef.current.add(id);
    try {
      safeLocalStorageSet('luminote_notified_reminder_ids', JSON.stringify(Array.from(notifiedIdsRef.current)));
    } catch { /* ignore */ }
  };

  const [isDbReady, setIsDbReady] = useState(false);
  useEffect(() => {
    ensureReady().then(() => {
      setIsDbReady(true);
    });
  }, []);

  const appStartTime = useRef(Date.now());
  const recentColorsRef = useRef<number[]>([]); // track last used color indices

  // 12-color shuffle queue: 打乱顺序循环取色，12个内永不重复，localStorage 持久化
  const colorQueueRef = useRef<number[]>((() => {
    try {
      const saved = localStorage.getItem('luminote_color_queue');
      if (saved) {
        const parsed = JSON.parse(saved) as number[];
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(n => n >= 0 && n < PRESET_COLORS.length)) {
          return parsed;
        }
      }
    } catch {}
    // 初始化：Fisher-Yates 洗牌
    const arr = PRESET_COLORS.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  })());

  const pickNextColor = (): string => {
    if (colorQueueRef.current.length === 0) {
      // 队列用完，重新洗牌
      const arr = PRESET_COLORS.map((_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      colorQueueRef.current = arr;
    }
    const idx = colorQueueRef.current.shift()!;
    try { localStorage.setItem('luminote_color_queue', JSON.stringify(colorQueueRef.current)); } catch {}
    return PRESET_COLORS[idx];
  };

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

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullY >= 50 && !isSyncing) {
      setPullY(50);
      await handleSync();
      setPullY(0);
    } else {
      setPullY(0);
    }
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
          tag: "intro",
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
          tag: "shopping",
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
          tag: "important",
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
          tag: "creative",
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
          tag: "appointment",
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
          tag: 'demo',
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
          tag: "reading",
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
          tag: "meeting",
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
          tag: "movie",
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
          tag: "travel",
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
          tag: "dev",
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
          `Unauthorized Domain: Current host "${window.location.hostname}" is not authorized for Google Sign-In in Supabase Dashboard. Please add it under Authentication -> Settings.`
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
    let userDocUnsubscribe: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;
    let isCancelled = false;

    // 1. 快速检查本地是否有缓存的已登录用户
    const cachedRaw = safeLocalStorageGet('luminote_auth_user');
    let hasLocalUser = false;
    if (cachedRaw) {
      try {
        const cachedUser = JSON.parse(cachedRaw);
        if (cachedUser && cachedUser.uid) {
          // 使用本地登录缓存快速渲染主界面，绝不 pending 卡死在 Loading！
          setUser(cachedUser);
          setAuthLoading(false);
          hasLocalUser = true;
        }
      } catch (e) {
        // ignore
      }
    }

    // 如果本地没有登录缓存，说明未登录，直接渲染 LandingPage，完全不用等 Firebase 初始化！
    if (!hasLocalUser) {
      setAuthLoading(false);
    }

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
            `Unauthorized Domain: Current host "${window.location.hostname}" is not authorized for Google Sign-In in Supabase Dashboard. Please add it under Authentication -> Settings.`
          );
        } else if (err.code !== 'auth/web-storage-unsupported') {
          setAuthError(`Google Redirect Login failed: ${err.message}`);
        }
      }
    };

    // 2. 异步后台启动 Firebase 初始化，不阻塞首屏渲染
    ensureReady().then(() => {
      if (isCancelled) return;

      // 处理 redirect 结果（如果发生过 redirect）
      handleRedirectResult();

      unsubscribe = onAuthStateChanged(getAuth(), (authUser: User | null) => {
        if (authUser) {
          // 已经登录：更新用户信息与静默长连接监听
          const cachedRaw = safeLocalStorageGet('luminote_auth_user');
          let quickUser = null;
          if (cachedRaw) {
            try {
              quickUser = JSON.parse(cachedRaw);
            } catch { /* ignore */ }
          }
          if (!quickUser || quickUser.uid !== authUser.uid) {
            quickUser = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName || authUser.email?.split('@')[0] || 'Lumi User',
              photoURL: authUser.photoURL,
              onboarded: true
            };
          }
          setUser(quickUser);
          setAuthLoading(false);

          // 启动后台静默实时监听
          const userDocRef = doc(getDb(), 'users', authUser.uid);
          userDocUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const userData = {
                uid: authUser.uid,
                email: authUser.email,
                displayName: docSnap.data().displayName || authUser.displayName,
                photoURL: docSnap.data().photoURL || authUser.photoURL,
                onboarded: docSnap.data().onboarded || false,
                hasNotesCreatedOrSeeded: docSnap.data().hasNotesCreatedOrSeeded || false
              };
              setUser(userData);
              safeLocalStorageSet('luminote_auth_user', JSON.stringify(userData));
            } else {
              const userData = {
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
                onboarded: false,
                hasNotesCreatedOrSeeded: false
              };
              setUser(userData);
              safeLocalStorageSet('luminote_auth_user', JSON.stringify(userData));
              setDoc(userDocRef, {
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
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
          // 未登录
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
    }).catch((err) => {
      console.warn("Firebase lazy init failed (offline/no vpn):", err);
      setAuthLoading(false);
    });

    return () => {
      isCancelled = true;
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
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

    if (!isDbReady) {
      return () => {
        clearTimeout(syncTimeoutId);
      };
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
      handleDbError(error, OperationType.LIST, 'capsules');
      setDataLoading(false); // 关键！配额超限报错时强制停止 Loading 转圈，让用户完美看到离线缓存的便签！
    });

    return () => {
      clearTimeout(syncTimeoutId);
      unsubscribe();
    };
  }, [user, isDbReady]);

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

  // 拦截 PWA 安装事件，用于自定义安装按鈕
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      if (!isPWA) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, [isPWA]);

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
      setIsCaptureCollapsed(false);

      setTimeout(() => {
        const desktopSteps: any[] = [
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
              title: '4. Note Interactions', 
              description: 'Right-click or long-press any note to open the context menu for quick actions.', 
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
        ];

        const mobileSteps: any[] = [
          { 
            element: '#generate-demo-btn', 
            popover: { 
              title: '1. Generate Demo Data', 
              description: 'Tap here to generate example notes and explore the app instantly.', 
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
            element: '#capsule-item-0', 
            popover: { 
              title: '3. Swipe Right (State 1)', 
              description: 'Swipe right once on a note card to turn it into a Todo task.', 
              side: "bottom", 
              align: 'center' 
            } 
          },
          { 
            element: '#capsule-item-0', 
            popover: { 
              title: '4. Complete & Reactivate (State 2 & 3)', 
              description: 'Swipe right again to mark the task completed. Swipe a third time to reactivate it.', 
              side: "bottom", 
              align: 'center' 
            } 
          },
          { 
            element: '#capsule-item-0', 
            popover: { 
              title: '5. Swipe Left', 
              description: 'Swipe left on any note to Archive it. If it is already archived, swipe left to Delete.', 
              side: "bottom", 
              align: 'center' 
            } 
          },
          { 
            element: '#capsule-item-0', 
            popover: { 
              title: '6. Long Press & Settings', 
              description: 'Long press a note or tap its options button to access full settings.', 
              side: "bottom", 
              align: 'center' 
            } 
          },
          { 
            element: '#view-mode-toggle', 
            popover: { 
              title: '7. Toggle Layout', 
              description: 'Switch between list and grid views to find your favorite layout.', 
              side: "bottom", 
              align: 'center' 
            } 
          }
        ];

        const driverObj = driver({
          showProgress: true,
          overlayColor: 'rgba(0,0,0,0.5)',
          steps: isMobile ? mobileSteps : desktopSteps,
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
    // isSyncFinished 后才执行，确保数据已加载，避免 0 条 notes 的误判窗口期
    if (user && isSyncFinished && (allCapsules.length > 0 || hasSeededOrCreated) && !hasSeenTutorial && isDbReady) {
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
    // 追加 !dataLoading 双重保险：确保数据加载完毕再判断
    if (!authLoading && !dataLoading && isSyncFinished && user && !hasSeenTutorial && !hasSeededOrCreated && !tourActive.current && allCapsules.length === 0) {
       setTimeout(() => {
         // 再次检查，防止延迟期间状态已变化
         if ((window as any).startTour && !tourActive.current && !hasSeenTutorial) {
           (window as any).startTour();
         }
       }, 2000); // 延长到 2s，等待 Supabase 数据完全稳定
    }
  }, [user, authLoading, dataLoading, allCapsules.length, hasSeenTutorial, hasSeededOrCreated, isSyncFinished, isDbReady]);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognition = useRef<any>(null);
  
  const allTags = Array.from(new Set(allCapsules.map(c => c.tag || (c.tags && c.tags.length > 0 ? c.tags[0] : undefined)).filter(Boolean) as string[])).sort();
  const allCategories = Array.from(new Set(allCapsules.map(c => c.category).filter(Boolean) as string[])).sort();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMenuPos, setBatchMenuPos] = useState<{ left: number; top: number } | null>(null);
  
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (document.getElementById('portal-batch-menu')?.contains(target)) return;
      setBatchMenuPos(null);
    };
    if (batchMenuPos) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [batchMenuPos]);

  // 批量「分类 & 标签」面板（批量场景下的唯一弹层，颜色/提醒已从批量中移除）
  const [batchTagCatOpen, setBatchTagCatOpen] = useState(false);
  const [batchCat, setBatchCat] = useState('');
  const [batchTag, setBatchTag] = useState('');

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
        const clean = partialCapsuleToDb(updates);
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
      handleDbError(error, OperationType.UPDATE, 'capsules/batch');
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
      handleDbError(error, OperationType.DELETE, 'capsules/batch');
    }
  };

  const transcriptRef = useRef('');

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognition.current = new (window as any).webkitSpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.lang = navigator.language || 'zh-CN';

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
  const [editDetailTag, setEditDetailTag] = useState('');
  const editDetailCategoryRef = useRef('');
  const editDetailTagRef = useRef('');
  const editDetailCapsuleIdRef = useRef<string | null>(null);
  const editingCapsuleRef = useRef<Capsule | null>(null);
  editingCapsuleRef.current = editingCapsule;
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [editMode, setEditMode] = useState<'plain' | 'markdown' | 'rich'>('markdown');
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
      const t = editingCapsule.tag || (editingCapsule.tags && editingCapsule.tags.length > 0 ? editingCapsule.tags[0] : '');
      setEditDetailCategory(c);
      setEditDetailTag(t);
      editDetailCategoryRef.current = c;
      editDetailTagRef.current = t;
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
    
    // Request notification permission IMMEDIATELY, while still in the synchronous
    // call stack of the user's click gesture. Modern browsers silently block
    // requestPermission() calls that happen after an await, because they're no
    // longer considered a direct response to user interaction.
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    }
    
    setIsProcessing(true);
    setInputText('');
    
    // Immediately focus back to input for potential next input
    inputRef.current?.focus();
    
    try {
      // Use NLP router (DeepSeek -> Local fallback)
      const parsed = await categorizeThought(text);
      console.log('[handleCreate] parsed result:', JSON.stringify(parsed));
      const { title, category, tags, refinedContent, isTodo, reminder, isStarred, isPinned } = parsed;
      
      // 从洗牌队列中取下一个颜色，12个内不重复
      const randomColor = pickNextColor();
      
      const hasReminder = Boolean(reminder && typeof reminder === 'object' && reminder.type && reminder.type !== 'none');
      const hasStar = Boolean(isStarred);
      const hasPin = Boolean(isPinned);
      const hasClearIntent = (isTodo && hasReminder) || hasStar || hasPin;
      const shouldShowPill = !hasClearIntent;

      // isAmbiguous / clarificationPrompt 是纯前端 UI 状态，不存在于 Supabase capsules 表中，
      // 仅保存在 createdCapsule 本地对象中，不发送到数据库。
      const newCapsuleData: Record<string, unknown> = {
        userId: user?.uid,
        content: refinedContent,
        subject: title || '',
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
        color: randomColor
      };
      if (tags && tags.length > 0) newCapsuleData.tag = tags[0];
      if (isStarred) newCapsuleData.isStarred = true;
      if (isPinned) newCapsuleData.isPinned = true;
      
      console.log('[handleCreate] saving to Firestore:', JSON.stringify({ content: newCapsuleData.content, subject: newCapsuleData.subject, isTodo: newCapsuleData.isTodo, hasReminder: !!newCapsuleData.reminder, isAmbiguous: newCapsuleData.isAmbiguous }));
      
      // 同步生成唯一的文档 ID，消除 addDoc 的异步挂起阻塞
      const docRef = doc(collection(getDb(), 'capsules'));
      
      const createdCapsule: Capsule = {
        id: docRef.id,
        userId: user?.uid || '',
        content: refinedContent,
        subject: title || '',
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
        tag: (newCapsuleData.tag || undefined) as string,
        isStarred: (newCapsuleData.isStarred || undefined) as boolean,
        isPinned: (newCapsuleData.isPinned || undefined) as boolean
      };

      // 立即在本地状态中加入此笔记（瞬时响应，避免断网时 UI 卡死或延迟）
      setCapsules(prev => {
        if (prev.some(c => c.id === docRef.id)) return prev;
        return [createdCapsule, ...prev];
      });

      // 在后台静默运行保存，即使离线，Firestore localCache 也会安全接管数据并在重连时自动推送
      setDoc(docRef, newCapsuleData).then(() => {
        console.log('[handleCreate] saved successfully to Firestore:', docRef.id);
      }).catch(err => {
        console.error('[handleCreate] Firestore setDoc failed:', err);
        handleDbError(err, OperationType.CREATE, 'capsules');
      });
      
      // Manage ClarificationPill state
      if (shouldShowPill) {
        wasCaptureCollapsedBeforeClarification.current = isCaptureCollapsed;
        setTemporaryPendingCapsule(createdCapsule);
        setPendingClarificationCapsuleId(docRef.id);
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
        userId: user?.uid || '',
        content: text,
        subject: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completed: false,
        isTodo: false,
        isArchived: false,
        isDeleted: false,
        color: randomColor
      };

      // 同步生成 ID 并乐观更新 fallback 流程
      const docRef = doc(collection(getDb(), 'capsules'));
      setCapsules(prev => {
        if (prev.some(c => c.id === docRef.id)) return prev;
        return [{ id: docRef.id, ...fallbackDoc } as Capsule, ...prev];
      });

      // 后台静默发送 fallback
      setDoc(docRef, fallbackDoc).then(() => {
        console.log('[handleCreate] fallback saved successfully');
      }).catch(innerError => {
        console.error('[handleCreate] fallback setDoc ERROR:', innerError);
        handleDbError(innerError, OperationType.CREATE, 'capsules');
      });

      if (user) {
        safeLocalStorageSet(`luminote_has_notes_seeded_${user.uid}`, 'true');
        updateDoc(doc(getDb(), 'users', user.uid), { hasNotesCreatedOrSeeded: true }).catch(() => {});
      }
    } finally {
      setIsProcessing(false);
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
        // 纯前端 UI 状态字段，不存在于 Supabase capsules 表中，发送前过滤掉
        const FRONTEND_ONLY_KEYS = new Set(['isAmbiguous', 'clarificationPrompt', 'id']);
        const cleanUpdates: Record<string, unknown> = {};
        Object.entries(updates).forEach(([key, value]) => {
          if (FRONTEND_ONLY_KEYS.has(key)) return;
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
        handleDbError(error, OperationType.UPDATE, `capsules/${id}`);
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
      const newTag = editDetailTagRef.current.replace(/,/g, '').trim();
      const prevCat = (cap.category || '').trim();
      const prevTag = cap.tag || (cap.tags && cap.tags.length > 0 ? cap.tags[0] : '');
      const patch: Partial<Capsule> = {};
      if (prevCat !== cat) {
        patch.category = cat ? cat : undefined;
      }
      if (prevTag !== newTag) {
        patch.tag = newTag ? newTag : undefined;
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
    
    if (file.size > 5 * 1024 * 1024 || isVideo) {
       alert("Large images (>5MB) and video uploads are not supported.");
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
      handleDbError(error, OperationType.DELETE, `capsules/${id}`);
    }
  };

  const startListening = () => {
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
      const trimmed = newTag.trim().replace('#', '').replace(/,/g, '');
      allCapsules.forEach(c => {
        const currentTag = c.tag || (c.tags && c.tags.length > 0 ? c.tags[0] : undefined);
        if (currentTag === oldTag) {
          updateCapsule(c.id, { tag: trimmed });
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
        const currentTag = c.tag || (c.tags && c.tags.length > 0 ? c.tags[0] : undefined);
        if (currentTag === tagToRemove) {
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
            const bodyText = cap.subject || contentText;
            return {
              id: cap.id,
              title: 'Lumi Note Reminder',
              body: bodyText,
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

    if ('Notification' in window && Notification.permission === 'granted') {
      syncRemindersToSW();
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
            addNotifiedId(cap.id);
            
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

        // 前台时仅展示应用内白色卡片（下方 setFiredReminders）。
        // 原生系统通知（黑色OS弹窗）由 notification-sw.js 在后台独立处理，
        // 避免前台同时出现两套通知。
        const reminderText = cap.subject || plainTextFromContent(cap.content) || 'You have an active reminder.';
        void reminderText; // 保留变量供未来使用，防止 lint unused 警告

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([150, 80, 150]);
        }

        addNotifiedId(cap.id);
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

    // 防抖锁：切回标签时 visibilitychange + focus 会同时触发，
    // 用时间戳保证 2 秒内只执行一次，避免弹出两张提醒卡片
    let lastForegroundCheck = 0;
    const debouncedForegroundCheck = () => {
      const now = Date.now();
      if (now - lastForegroundCheck < 2000) return;
      lastForegroundCheck = now;
      checkReminders();
      syncRemindersToSW();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debouncedForegroundCheck();
      }
    };

    window.addEventListener('focus', debouncedForegroundCheck);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', debouncedForegroundCheck);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [allCapsules, updateCapsule, user]);

  // Web Push 订阅 — 用户登录且授权通知后自动订阅，实现关闭页面也能收到提醒
  useEffect(() => {
    if (!user || notificationPermission !== 'granted') return;
    // 延迟 2 秒等 SW 就绪
    const timer = setTimeout(() => {
      subscribeToPush(user.uid).catch(err =>
        console.warn('[WebPush] 自动订阅失败:', err)
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [user, notificationPermission]);

  const sortedCapsules = allCapsules;
  
  const filteredCapsules = sortedCapsules.filter(c => {
    const currentTag = c.tag || (c.tags && c.tags.length > 0 ? c.tags[0] : undefined);
    const contentText = typeof c.content === 'string' ? c.content : plainTextFromContent(c.content);
    const matchesSearch = (c.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (contentText || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (currentTag && currentTag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
    const matchesTag = !tagFilter || (currentTag === tagFilter);
    
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
        case 'completed-todo': return (c.isTodo && c.completed) || hasFinishedOneShotReminder(c);
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
          return (c.isTodo && !!c.completed) || hasFinishedOneShotReminder(c);
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
    { value: 'pure-note', label: 'Note(s)' },
    { value: 'pending-todo', label: 'To-do' },
    { value: 'completed-todo', label: 'Completed' },
    { value: 'repeat-reminder', label: 'Recurring' },
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
      <div id="login-screen" className="min-h-[100dvh] md:h-[100dvh] w-screen flex flex-col md:flex-row bg-white overflow-y-auto md:overflow-hidden py-4 md:py-0 relative">
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
        <div className="flex-1 flex flex-col items-center justify-center py-4 px-6 md:p-12">
          <div className="w-full max-w-sm">
            <div className="md:hidden flex flex-col items-center mb-4">
              <AppLogo className="w-14 h-14 mb-2" />
              <h1 className="text-2xl font-extrabold tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-[#1D1D1F] to-[#434343]">Lumi Note</h1>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-xl font-bold text-[#1D1D1F] mb-1">{isRegistering ? 'Create Account' : 'Welcome Back'}</h3>
              <p className="text-[#8E8E93] text-xs font-semibold mb-3">
                {isRegistering ? 'Create an account to instantly capture and sync your notes, to-dos & reminders.' : 'Sign in to instantly capture and sync your notes, to-dos & reminders.'}
              </p>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-[#8E8E93] uppercase tracking-widest mb-1 ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
                    <input 
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-[#F2F2F7] border-2 border-transparent focus:border-[#007AFF] focus:bg-white rounded-xl text-sm font-semibold transition-all outline-none placeholder:text-[#8E8E93]/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#8E8E93] uppercase tracking-widest mb-1 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
                    <input 
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-[#F2F2F7] border-2 border-transparent focus:border-[#007AFF] focus:bg-white rounded-xl text-sm font-semibold transition-all outline-none placeholder:text-[#8E8E93]/40"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={authProcessing}
                  className="w-full bg-[#007AFF] text-white py-2.5 rounded-xl font-black text-sm shadow-xl shadow-[#007AFF]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {authProcessing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (isRegistering ? 'Create Account' : 'Sign In')}
                </button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E5EA]"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-[#8E8E93]"><span className="bg-white px-4 tracking-widest lowercase">or sign in with</span></div>
              </div>

              <div className="flex justify-center">
                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 bg-white py-2.5 rounded-xl border border-[#E5E5EA] hover:bg-[#F2F2F7] transition-all active:scale-95 shadow-sm font-bold text-sm text-[#1D1D1F]"
                  title="Sign in with Google"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                  <span>Google</span>
                </button>
              </div>

              <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="w-full text-center mt-4 text-xs font-bold text-[#8E8E93]"
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

      {/* PWA 安装引导 Banner — 浏览器模式且支持安装时显示 */}
      {showInstallBanner && !isPWA && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '10px 16px',
            fontSize: '13px', boxShadow: '0 2px 12px rgba(99,102,241,0.4)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            📲 <strong>Install Lumi Note</strong> as an app for the best experience &amp; startup reminders
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                if (!installPromptEvent) return;
                installPromptEvent.prompt();
                const result = await installPromptEvent.userChoice;
                if (result.outcome === 'accepted') {
                  setShowInstallBanner(false);
                  setInstallPromptEvent(null);
                }
              }}
              style={{
                background: '#fff', color: '#6366f1', border: 'none',
                borderRadius: 8, padding: '5px 14px', fontWeight: 700,
                cursor: 'pointer', fontSize: 13
              }}
            >
              Install
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 开机启动引导 Banner — PWA 模式下一次性显示 */}
      {showStartupBanner && isPWA && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '10px 16px',
            fontSize: '13px', boxShadow: '0 2px 12px rgba(14,165,233,0.4)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            ⏰ <strong>Never miss a reminder:</strong> Enable “Start at login” in Edge → edge://apps → Lumi Note → ⚙️
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { window.open('edge://apps', '_blank'); }}
              style={{
                background: '#fff', color: '#0ea5e9', border: 'none',
                borderRadius: 8, padding: '5px 14px', fontWeight: 700,
                cursor: 'pointer', fontSize: 13
              }}
            >
              Open Settings
            </button>
            <button
              onClick={() => {
                safeLocalStorageSet('luminote_startup_banner_dismissed', 'true');
                setShowStartupBanner(false);
              }}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

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
          <div className={cn("flex items-center", isMobile ? "gap-2" : "gap-3")}>
            <div className="flex-shrink-0 w-[56px] h-[56px] flex items-center justify-center drop-shadow-md">
              <AppLogo className="w-full h-full" />
            </div>
            {isSidebarOpen && (
              isMobile ? (
                <div className="flex flex-col justify-center select-none leading-none">
                  <span className="font-extrabold text-[16px] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#1D1D1F] to-[#434343] uppercase leading-none">
                    Lumi
                  </span>
                  <span className="font-bold text-[13px] tracking-tight text-[#8E8E93] uppercase leading-none mt-1">
                    Note
                  </span>
                </div>
              ) : (
                <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#1D1D1F] to-[#434343] whitespace-nowrap">
                  Lumi Note
                </span>
              )
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
                  'w-full mb-1 flex items-center justify-between gap-2 pl-2 pr-3 py-2.5 rounded-xl border transition-all text-left',
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
                className="mt-1 mb-1 w-full flex items-center justify-between gap-2 pl-2 pr-3 py-2.5 rounded-xl cursor-pointer transition-colors bg-[#F2F2F7] border border-[#E5E5EA] hover:bg-[#ECECEC]"
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
                  'w-full mb-1 flex items-center justify-between gap-2 pl-2 pr-3 py-2.5 rounded-xl border transition-all text-left',
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
                    className="mt-4 mb-1 w-full flex items-center justify-between gap-2 pl-2 pr-3 py-2.5 rounded-xl cursor-pointer transition-colors bg-[#F2F2F7] border border-[#E5E5EA] hover:bg-[#ECECEC]"
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
                    className="mt-4 mb-1 w-full flex items-center justify-between gap-2 pl-2 pr-3 py-2.5 rounded-xl cursor-pointer transition-colors bg-[#F2F2F7] border border-[#E5E5EA] hover:bg-[#ECECEC]"
                    onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <TagLucideIcon size={16} className="text-[#007AFF]" strokeWidth={2.2} />
                      <span className="text-[#1D1D1F] normal-case text-xs font-bold tracking-normal">Tag</span>
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
                          count={allCapsules.filter((c) => (c.tag === tag || (!c.tag && c.tags?.includes(tag))) && !c.isArchived && !c.isDeleted).length}
                          onRename={(oldTag: string, newTag: string) => {
                            setCapsules((prev) =>
                              prev.map((c) => {
                                const currentTag = c.tag || (c.tags && c.tags.length > 0 ? c.tags[0] : undefined);
                                if (currentTag === oldTag) {
                                  return { ...c, tag: newTag, tags: undefined };
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
           {!isMobile && (
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
                 isSidebarOpen ? "pl-2.5 pr-4 justify-start" : "px-0 justify-center"
               )}
             >
               <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#007AFF]" : ""} />
               {isSidebarOpen && <span>{isSyncing ? 'Syncing…' : 'Manual Sync'}</span>}
             </button>
           )}
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
        <header className="min-h-[64px] h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] pb-0 px-4 md:px-8 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-[#E5E5EA] gap-4 z-40 sticky top-0">
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
          {(pullY > 0 || isSyncing) && (
            <div 
              style={{ height: `${isSyncing ? 50 : pullY}px` }}
              className="w-full overflow-hidden transition-all duration-75 select-none relative"
            >
              <div 
                style={{ height: '50px', position: 'absolute', bottom: 0, left: 0, right: 0 }}
                className="w-full flex items-center justify-center text-xs text-[#8E8E93] dark:text-[#AEAEB2] font-bold gap-2"
              >
                <RefreshCw size={14} className={(pullY >= 50 || isSyncing) ? "animate-spin text-[#007AFF]" : "text-[#8E8E93]"} />
                <span>{isSyncing ? "Syncing notes..." : pullY >= 50 ? "Release to sync notes..." : "Pull down to sync..."}</span>
              </div>
            </div>
          )}
          <div className={`w-full pb-36 transition-all duration-300 ${
            selectedIds.size > 0 ? 'mt-3' : ''
          } ${
            viewMode === 'grid' 
              ? 'columns-2 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 3xl:columns-6 gap-3 md:gap-5' 
              : 'w-full max-w-[1200px] flex flex-col space-y-2.5 md:space-y-3.5'
          } ${isSidebarOpen ? 'ml-0' : 'mx-auto'}`}>
            <AnimatePresence initial={false}>
              {filteredCapsules.map((capsule, index) => (
                <div key={capsule.id} className={cn("flex items-center gap-3 md:gap-5 group/list", viewMode === 'grid' ? "break-inside-avoid mb-3 md:mb-5" : "")}>
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
                      showToast={showToast}
                      onSelectAll={() => setSelectedIds(new Set(filteredCapsules.map(c => c.id)))}
                      setNotificationPermission={setNotificationPermission}
                      onShowBatchMenu={(x, y) => setBatchMenuPos({ left: x, top: y })}
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
                  <button
                    type="button"
                    title="Create a new capsule"
                    onClick={() => {
                      setIsCaptureCollapsed(false);
                      setQuickCaptureMode('text');
                    }}
                    className="w-16 h-16 bg-[#E5E5EA] hover:bg-[#D1D1D6] dark:bg-[#3A3A3C] dark:hover:bg-[#48484A] rounded-full flex items-center justify-center mb-4 cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus size={32} />
                  </button>
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
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 px-3 md:p-4">
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
                className="relative bg-white rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col h-[93vh] md:h-[85vh]"
                style={{ resize: isMobile ? 'none' : 'horizontal', minWidth: isMobile ? 'auto' : '460px', maxWidth: '95vw', width: isMobile ? '100%' : '768px' }}
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
                    <div className="flex flex-row gap-2.5 mt-2.5 shrink-0">
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-black text-[#8E8E93] dark:text-[#AEAEB2] uppercase tracking-widest mb-1 ml-1 truncate">Category</label>
                        <input
                          type="text"
                          placeholder="e.g. Work, Ideas"
                          value={editDetailCategory}
                          onChange={(e) => {
                            setEditDetailCategory(e.target.value);
                            editDetailCategoryRef.current = e.target.value;
                          }}
                          className="w-full px-3 py-1.5 bg-[#F2F2F7] border border-transparent focus:border-[#007AFF] focus:bg-white rounded-xl text-xs font-bold transition-all outline-none text-[#1D1D1F] dark:text-white dark:bg-[#2C2C2E] dark:focus:bg-[#1C1C1E]"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-black text-[#8E8E93] dark:text-[#AEAEB2] uppercase tracking-widest mb-1 ml-1 truncate">Tag</label>
                        <input
                          type="text"
                          placeholder="e.g. design"
                          value={editDetailTag}
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, '');
                            setEditDetailTag(val);
                            editDetailTagRef.current = val;
                          }}
                          className="w-full px-3 py-1.5 bg-[#F2F2F7] border border-transparent focus:border-[#007AFF] focus:bg-white rounded-xl text-xs font-bold transition-all outline-none text-[#1D1D1F] dark:text-white dark:bg-[#2C2C2E] dark:focus:bg-[#1C1C1E]"
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

        {/* 跟随长按位置的批量操作 Portal 菜单 */}
        {selectedIds.size > 0 && batchMenuPos && createPortal(
          <motion.div
            id="portal-batch-menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed z-[2000] w-[230px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-y-auto bg-white dark:bg-[#1C1C1E] border border-[#E5E5EA] dark:border-white/10 rounded-2xl shadow-2xl text-[#1D1D1F] dark:text-[#F2F2F7] flex flex-col p-1.5"
            style={{ 
              left: (() => {
                let left = batchMenuPos.left;
                if (left + 230 > window.innerWidth - 8) left = window.innerWidth - 230 - 8;
                if (left < 8) left = 8;
                return left;
              })(),
              top: (() => {
                let top = batchMenuPos.top;
                const budgetH = 260;
                if (top + budgetH > window.innerHeight - 8) {
                  top = Math.max(8, top - budgetH);
                }
                if (top < 8) top = 8;
                return top;
              })()
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="p-1.5 space-y-0.5">
              <span className="font-black text-[#1D1D1F] dark:text-[#F2F2F7] text-[10px] px-2.5 py-1.5 uppercase tracking-wider text-[#8E8E93] dark:text-[#AEAEB2] block border-b border-[#F2F2F7] dark:border-white/5 mb-1 text-center">
                {selectedIds.size} Selected
              </span>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedIds.size === filteredCapsules.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(filteredCapsules.map(c => c.id)));
                  }
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F2F2F7] font-medium rounded-lg transition-colors text-left"
              >
                <CheckSquare size={16} className="text-[#007AFF] shrink-0" />
                {selectedIds.size === filteredCapsules.length ? 'Deselect All' : 'Select All'}
              </button>

              {filter !== 'archived' && filter !== 'trash' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const first = allCapsules.find((c) => selectedIds.has(c.id));
                    setBatchCat(first?.category || '');
                    setBatchTag(first ? (first.tag || (first.tags && first.tags.length > 0 ? first.tags[0] : '')) : '');
                    setBatchTagCatOpen(true);
                    setBatchMenuPos(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F2F2F7] font-medium rounded-lg transition-colors text-left"
                >
                  <TagLucideIcon size={16} className="text-[#007AFF] shrink-0" />
                  Category &amp; Tag
                </button>
              )}

              {filter === 'archived' ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); batchUpdate({ isArchived: false }); setBatchMenuPos(null); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#4CAF50] font-medium rounded-lg transition-colors text-left"
                  >
                    <RotateCcw size={16} className="shrink-0" />
                    Restore
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); batchUpdate({ isDeleted: true }); setBatchMenuPos(null); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#FF3B30] font-medium rounded-lg transition-colors text-left"
                  >
                    <Trash2 size={16} className="shrink-0" />
                    Delete
                  </button>
                </>
              ) : filter === 'trash' ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); batchUpdate({ isDeleted: false }); setBatchMenuPos(null); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#4CAF50] font-medium rounded-lg transition-colors text-left"
                  >
                    <RotateCcw size={16} className="shrink-0" />
                    Restore
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to permanently delete the selected notes? This cannot be undone.')) {
                        batchRemovePermanently();
                      }
                      setBatchMenuPos(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#FF3B30] font-medium rounded-lg transition-colors text-left"
                  >
                    <Trash2 size={16} className="shrink-0" />
                    Delete Forever
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); batchUpdate({ isArchived: true }); setBatchMenuPos(null); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#8E8E93] dark:text-[#AEAEB2] font-medium rounded-lg transition-colors text-left"
                  >
                    <Archive size={16} className="shrink-0" />
                    Archive
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); batchUpdate({ isDeleted: true }); setBatchMenuPos(null); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#FF3B30] font-medium rounded-lg transition-colors text-left"
                  >
                    <Trash2 size={16} className="shrink-0" />
                    Delete
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const selectedNotes = allCapsules.filter(c => selectedIds.has(c.id));
                      const text = selectedNotes.map(c => `[${c.category || 'Note'}] ${plainTextFromContent(c.content)}`).join('\n\n---\n\n');
                      if (typeof navigator !== 'undefined' && navigator.share) {
                        try { await navigator.share({ title: 'Shared Lumi Notes', text }); } catch (err) { console.log('Share error', err); }
                      } else {
                        try { await navigator.clipboard.writeText(text); showToast('Copied all selected notes to clipboard!', 'success'); } catch (err) { console.log('Copy error', err); }
                      }
                      setBatchMenuPos(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F2F2F7] font-medium rounded-lg transition-colors text-left"
                  >
                    <Share2 size={16} className="text-[#8E8E93] dark:text-[#AEAEB2] shrink-0" />
                    Share
                  </button>
                </>
              )}

              <div className="h-px bg-[#F2F2F7] dark:bg-white/5 mx-2 my-1" />
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set()); setBatchMenuPos(null); }} 
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-sm font-bold text-[#FF3B30] hover:bg-red-50 dark:hover:bg-red-950/35 rounded-lg transition-colors mt-0.5"
              >
                <X size={16} className="shrink-0 text-[#FF3B30]" />
                Cancel
              </button>
            </div>
          </motion.div>,
          document.body
        )}

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
                <div className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">Tag</div>
                <input
                  type="text"
                  value={batchTag}
                  onChange={(e) => setBatchTag(e.target.value.replace(/,/g, ''))}
                  placeholder="e.g. Work"
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
                    const tag = batchTag.trim();
                    void batchUpdate({ category: cat || undefined, tag: tag || undefined });
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
              : 'min-h-[96px] px-4 md:px-8 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] md:pb-4 md:pt-3 opacity-100 translate-y-0'
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
                    className="bg-transparent border-none text-white text-sm placeholder-white/60 focus:ring-0 outline-none w-52 md:w-80 py-1 px-0 shrink"
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
      
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        user={user}
      />

      {/* Edge Swipe Panel Trigger (Mock Implementation for Edge Panel) */}
      {user && (
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
