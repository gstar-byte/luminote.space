import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Svg, Rect, Circle, Ellipse, Path, Defs, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Keyboard as RNKeyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import {
  Archive,
  Bell,
  Check,
  ArrowDown,
  ArrowUp,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Calendar,
  Filter,
  Folder,
  Image as ImageIcon,
  LayoutGrid,
  LayoutList,
  Layers,
  Lock,
  LogOut,
  Mail,
  Mic,
  MoreVertical,
  Palette,
  PanelLeft,
  Pin,
  Plus,
  RotateCcw,
  Rocket,
  Search,
  Square,
  Star,
  Share as ShareIcon,
  Tag as TagIcon,
  Trash,
  Trash2,
  User as UserIcon,
  X,
  Zap,
  Settings as SettingsIcon,
  Keyboard,
  Clock,
} from 'lucide-react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { Capsule, FilterType, ReminderConfig, ReminderType, UserProfile, AppSettings } from './types';
import { PRESET_COLORS } from './constants';
import { categorizeThought, categorizeThoughtFromAudio } from './services/geminiService';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { CapsuleColorSheet } from './components/CapsuleColorSheet';
import { CapsuleReminderSheet } from './components/CapsuleReminderSheet';
import { CapsuleEditorMobile } from './components/CapsuleEditorMobile';
import { AppLogo } from './components/AppLogo';
import { LandingScreen } from './components/LandingScreen';
import { PremiumModalMobile } from './components/PremiumModalMobile';
import { SettingsModalMobile } from './components/SettingsModalMobile';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { EdgeMiniPanel } from './components/EdgeMiniPanel';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import {
  AUTO_DEMO_CAPSULES,
  autoDemoSeedStorageKey,
} from './data/autoDemoCapsules';
import {
  auth,
  db,
  addDoc,
  collection,
  createUserWithEmailAndPassword,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  sendPasswordResetEmail,
  setDoc,
  signInWithEmailAndPassword,
  signOut,
  updateDoc,
  updateProfile,
  where,
  writeBatch,
} from './lib/firebaseMobile';
import {
  getVoiceCaptureCount,
  incrementVoiceCaptureCount,
  VOICE_FREE_LIMIT,
} from './lib/voiceQuota';
import { hasPremiumAccess, PAYWALL_ACTIVE } from './featureFlags';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  initNotifications,
  requestNotificationPermissions,
  syncAllCapsuleNotifications,
} from './lib/notificationsMobile';

function CrownJewel({ size = 36 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Shadow Side (Bottom base shade) */}
        <Path d="M50 85H15V75H85V85H50Z" fill="#E67E22" />
        
        {/* Red Velvet Cushion */}
        <Path d="M20 70C20 40 80 40 80 70H20Z" fill="#C0392B" />
        
        {/* Main Golden Body */}
        <Path d="M10 40C15 45 20 55 20 75H80C80 55 85 45 90 40L80 55C75 45 80 30 70 25L75 40C70 45 60 45 50 40C40 45 30 45 25 40L30 25C20 30 25 45 20 55L10 40Z" fill="#F1C40F" />
        
        {/* Center Golden Pillar */}
        <Path d="M42 45C42 35 45 25 50 15C55 25 58 35 58 45H42Z" fill="#F1C40F" />
        <Circle cx="50" cy="18" r="6" fill="#F1C40F" />

        {/* Center Red Gem */}
        <Ellipse cx="50" cy="58" rx="6" ry="9" fill="#E74C3C" />
        
        {/* Bottom Base with Blue Gems */}
        <Rect x="15" y="75" width="70" height="12" rx="2" fill="#F39C12" />
        <Circle cx="22" cy="81" r="3" fill="#00A8E8" />
        <Circle cx="36" cy="81" r="3" fill="#00A8E8" />
        <Circle cx="50" cy="81" r="3" fill="#00A8E8" />
        <Circle cx="64" cy="81" r="3" fill="#00A8E8" />
        <Circle cx="78" cy="81" r="3" fill="#00A8E8" />
      </Svg>
    </View>
  );
}

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pure-note', label: 'Note(s)' },
  { value: 'pending-todo', label: 'To-do' },
  { value: 'completed-todo', label: 'Completed' },
  { value: 'repeat-reminder', label: 'Recurring' },
  { value: 'archived', label: 'Archived' },
  { value: 'trash', label: 'Trash' },
];

function normalizeReminder(raw: unknown): ReminderConfig | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const type = (typeof r.type === 'string' ? r.type : 'once') as ReminderType;
  const date = typeof r.date === 'number' ? r.date : undefined;
  return { type, date };
}

function hasActiveReminder(c: Capsule): boolean {
  return !!(c.reminder && c.reminder.type !== 'none');
}

/** Active reminder that repeats (not none / once). */
function hasRepeatReminder(c: Capsule): boolean {
  const t = c.reminder?.type;
  if (!t || t === 'none' || t === 'once') return false;
  return true;
}

/** One-shot reminder whose scheduled time has passed (not repeating). */
function hasFinishedOneShotReminder(c: Capsule): boolean {
  const r = c.reminder;
  if (!r || r.type === 'none') return false;
  if (r.type !== 'once') return false;
  return r.date != null && r.date <= Date.now();
}

/** Toggling to-do done or pin alone must not change list order (no updatedAt bump). */
function shouldBumpUpdatedAt(updates: Partial<Capsule>): boolean {
  return 'subject' in updates || 'content' in updates;
}

function formatNoteDateTime(ms?: number): string {
  if (ms == null || ms === 0) return '—';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short repeat label for the overflow menu. */
function repeatLabelForMenu(r: ReminderConfig | undefined): string {
  if (!r || r.type === 'none') return 'None';
  switch (r.type) {
    case 'once':
      return 'Once';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'custom': {
      const u =
        r.customUnit === 'day'
          ? 'day(s)'
          : r.customUnit === 'week'
            ? 'week(s)'
            : r.customUnit === 'month'
              ? 'month(s)'
              : '';
      const iv = r.customInterval;
      if (iv != null && u) return `Every ${iv} ${u}`;
      return 'Custom';
    }
    default:
      return '—';
  }
}

function capsuleMenuMeta(c: Capsule) {
  const created = formatNoteDateTime(c.createdAt);
  const r = c.reminder;
  const reminderAt =
    r && r.type !== 'none' ? formatNoteDateTime(r.date) : 'Not set';
  const repeat = repeatLabelForMenu(r);
  return { created, reminderAt, repeat };
}

function plainTextFromContent(raw: string): string {
  if (!raw) return '';
  let result = '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type !== 'doc' || !Array.isArray(parsed.content)) {
      throw new Error('Not tiptap JSON');
    }
    const lines: string[] = [];
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'text') { lines.push(node.text || ''); }
        else if (node.type === 'hardBreak') { lines.push(' '); }
        else if (node.content) { walk(node.content); }
        else if (['paragraph','heading','blockquote','listItem','bulletList','orderedList'].includes(node.type)) { lines.push(' '); }
      }
    };
    walk(parsed.content);
    result = lines.join('').trim();
  } catch {
    result = raw.trim();
  }

  // 强力清洗 HTML 标签，保证绝无源码残留
  result = result
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ');

  // 剥除 Markdown 格式语法标记以呈现最纯净的列表预览文字
  result = result
    .replace(/^#{1,6}\s+/gm, '')          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')      // bold
    .replace(/\*(.+?)\*/g, '$1')          // italic
    .replace(/~~(.+?)~~/g, '$1')          // strikethrough
    .replace(/^>\s+/gm, '')               // blockquote
    .replace(/^[-*+]\s+/gm, '')           // list items
    .replace(/^\d+\.\s+/gm, '')           // ordered list
    .replace(/`([^`]+)`/g, '$1')          // inline code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // links

  return result.trim();
}

function alertCaptureEmpty() {
  const title = 'Nothing to save';
  const body =
    'Type a note and tap the checkmark, or tap the mic to record and transcribe.';
  if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
    try {
      (globalThis as unknown as Window).alert(`${title}\n\n${body}`);
      return;
    } catch {
      /* fall through */
    }
  }
  Alert.alert(title, body, [{ text: 'OK' }]);
}

/** Maps a partial capsule update to Firestore `update()` / batch fields (incl. deleteField). */
function capsulePartialToFirestoreData(updates: Partial<Capsule>): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.entries(updates).forEach(([k, v]) => {
    if (k === 'category') {
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        clean[k] = deleteField();
      } else {
        clean[k] = v;
      }
      return;
    }
    if (k === 'tag') {
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        clean[k] = deleteField();
      } else {
        clean[k] = v;
      }
      clean['tags'] = deleteField();
      return;
    }
    if (k === 'attachments') {
      if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
        clean[k] = deleteField();
      } else {
        clean[k] = v;
      }
      return;
    }
    if (k === 'color') {
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        clean[k] = deleteField();
      } else {
        clean[k] = v;
      }
      return;
    }
    if (k === 'isPinned') {
      if (!v) {
        clean[k] = deleteField();
      } else {
        clean[k] = v;
      }
      return;
    }
    if (k === 'reminder') {
      if (v === undefined || v === null) {
        clean[k] = deleteField();
      } else {
        clean[k] = v;
      }
      return;
    }
    clean[k] = v === undefined ? null : v;
  });
  return clean;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  swipeEnabled: true,
  swipeRightAction: 'archive',
  edgePanelEnabled: false,
  ongoingNotificationEnabled: false,
  accessibilityWakeEnabled: false,
  quickCaptureLimit: 5,
};

export default function IdeaCapsuleApp() {
  const searchInputRef = useRef<TextInput>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isMetaFocused, setIsMetaFocused] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'success' | 'error'>('info');
  const toastTimerRef = useRef<any>(null);

  const showToast = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    setToastType(type);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = RNKeyboard.addListener(showEvent, () => setIsKeyboardActive(true));
    const hideSub = RNKeyboard.addListener(hideEvent, () => setIsKeyboardActive(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        let stored: string | null = null;
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.localStorage) {
            stored = window.localStorage.getItem('lumi_app_settings');
          }
        } else {
          stored = await AsyncStorage.getItem('lumi_app_settings');
        }

        if (stored) {
          const trimmed = stored.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const parsed = JSON.parse(trimmed) as Partial<AppSettings>;
            setSettings({ ...DEFAULT_APP_SETTINGS, ...parsed });
          }
        }
      } catch (e) {
        // Use console.warn to avoid popping red error boxes in Expo Go
        console.warn('Failed to load settings silently:', e);
      }
    };
    void loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      const serialized = JSON.stringify(updated);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('lumi_app_settings', serialized);
        }
      } else {
        await AsyncStorage.setItem('lumi_app_settings', serialized);
      }
    } catch (e) {
      console.warn('Failed to save settings silently:', e);
    }
  };

  // Ongoing Notification service manager for Android PWA/Native alignment
  const updateOngoingNotification = async (enabled: boolean) => {
    if (Platform.OS !== 'android') return;
    const ONGOING_NOTIF_ID = 'lumi-ongoing-quick-capture';
    if (enabled) {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.warn('[Ongoing Notification] Permission denied');
          return;
        }

        await Notifications.setNotificationChannelAsync('ongoing-channel', {
          name: 'Lumi Quick Capture',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0],
          lightColor: '#007AFF',
          showBadge: false,
        });

        await Notifications.scheduleNotificationAsync({
          identifier: ONGOING_NOTIF_ID,
          content: {
            title: 'Lumi Note 🚀',
            body: 'Tap here to capture your thought instantly',
            sticky: true,
            autoDismiss: false,
            color: '#007AFF',
            data: { action: 'open_quick_capture' },
          },
          trigger: null,
        });
      } catch (err) {
        console.warn('[Ongoing Notification] Error scheduling:', err);
      }
    } else {
      try {
        await Notifications.dismissNotificationAsync(ONGOING_NOTIF_ID);
      } catch (err) {
        console.warn('[Ongoing Notification] Error dismissing:', err);
      }
    }
  };

  useEffect(() => {
    void updateOngoingNotification(settings.ongoingNotificationEnabled);
  }, [settings.ongoingNotificationEnabled]);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authProcessing, setAuthProcessing] = useState(false);

  const [capsules, setCapsules] = useState<Capsule[]>([]);

  useEffect(() => {
    initNotifications();
  }, []);

  // Listener for tap notification action to trigger Quick Capture
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data && data.action === 'open_quick_capture') {
        setShowQuickCapture(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (data && data.capsuleId) {
        const found = capsules.find(c => c.id === data.capsuleId);
        if (found) {
          setEditingCapsule(found);
          setEditContent(found.content);
          setEditSubjectDraft(found.subject || '');
          setEditCategoryDraft(found.category || '');
          setEditTagDraft(found.tag || (found.tags && found.tags.length > 0 ? found.tags[0] : ''));
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [capsules]);

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      try {
        const parsed = Linking.parse(event.url);
        if (parsed.path === 'quick-capture') {
          setShowQuickCapture(true);
        }
      } catch (e) {
        console.error('Failed to parse linking URL:', e);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);
  // Automatically sync local OS notifications when capsules list updates
  useEffect(() => {
    void syncAllCapsuleNotifications(capsules);
  }, [capsules]);

  const handleShareMultiple = async () => {
    if (selectedIds.length === 0) return;
    const selectedCaps = capsules.filter(c => selectedIds.includes(c.id));
    const combinedText = selectedCaps
      .map(c => plainTextFromContent(c.content))
      .join('\n\n---\n\n');
    try {
      await Share.share({
        message: combinedText,
        title: `Share ${selectedIds.length} Notes`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(true);
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  const [isFilterSectionExpanded, setIsFilterSectionExpanded] = useState(false);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  useEffect(() => {
    const valid =
      FILTER_OPTIONS.some((o) => o.value === filter) || filter === 'starred';
    if (!valid) {
      setFilter('all');
    }
  }, [filter]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInFlightRef = useRef(false);

  const syncCapsules = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setIsSyncing(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  const [refreshTitle, setRefreshTitle] = useState('Pull to sync');
  const [mobilePullY, setMobilePullY] = useState(0);
  const pullReachedRef = useRef(false);

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y < 0) {
      setMobilePullY(-y);
    } else {
      setMobilePullY(0);
    }

    if (y < -75) {
      if (!pullReachedRef.current && !refreshing && !isSyncing) {
        pullReachedRef.current = true;
        setRefreshTitle('Release to sync…');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      if (pullReachedRef.current) {
        pullReachedRef.current = false;
        if (!refreshing && !isSyncing) {
          setRefreshTitle('Pull to sync');
        }
      }
    }
  };

  const [showSyncComplete, setShowSyncComplete] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshTitle('Syncing…');
    showToast('Syncing notes...', 'info');
    try {
      await syncCapsules();
      setShowSyncComplete(true);
      showToast('Sync complete!', 'success');
      setTimeout(() => {
        setShowSyncComplete(false);
      }, 1500);
    } finally {
      setRefreshing(false);
      setRefreshTitle('Pull to sync');
      pullReachedRef.current = false;
    }
  }, [syncCapsules, showToast]);

  const [editingCapsule, setEditingCapsule] = useState<Capsule | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategoryDraft, setEditCategoryDraft] = useState('');
  const [editTagDraft, setEditTagDraft] = useState('');
  const [editSubjectDraft, setEditSubjectDraft] = useState('');
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const [editCategoryFocused, setEditCategoryFocused] = useState(false);
  const [editTagFocused, setEditTagFocused] = useState(false);
  const editModalCapsuleIdRef = useRef<string | null>(null);
  const editingCapsuleRef = useRef<Capsule | null>(null);
  editingCapsuleRef.current = editingCapsule;
  const [activeMenuCapsule, setActiveMenuCapsule] = useState<Capsule | null>(null);

  const [menuCategory, setMenuCategory] = useState('');
  const [menuTagInput, setMenuTagInput] = useState('');
  const [menuCategoryFocused, setMenuCategoryFocused] = useState(false);
  const [menuTagFocused, setMenuTagFocused] = useState(false);
  const categoryMenuSentRef = useRef('');
  const demoSeedInFlightRef = useRef(false);
  const activeMenuCapsuleRef = useRef<Capsule | null>(null);
  const menuTagInputRef = useRef('');
  activeMenuCapsuleRef.current = activeMenuCapsule;
  menuTagInputRef.current = menuTagInput;

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchColorMultiOpen, setBatchColorMultiOpen] = useState(false);
  const [batchReminderMultiOpen, setBatchReminderMultiOpen] = useState(false);
  const [batchTagCatOpen, setBatchTagCatOpen] = useState(false);
  const [batchCategory, setBatchCategory] = useState('');
  const [batchTag, setBatchTag] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const [colorPickerCapsule, setColorPickerCapsule] = useState<Capsule | null>(null);
  const [colorPickerHidePresets, setColorPickerHidePresets] = useState(false);
  const [showLocalColors, setShowLocalColors] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<Capsule | null>(null);

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isWebListening, setIsWebListening] = useState(false);
  const [quickCaptureMode, setQuickCaptureMode] = useState<'buttons' | 'text' | 'voice'>('buttons');
  const [editMode, setEditMode] = useState<'plain' | 'markdown'>('plain');
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const webSpeechRef = useRef<any>(null);

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  /** Platform flags */
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';

  const menuStyle = useMemo(() => {
    if (!menuPosition) {
      return {
        alignSelf: 'center' as const,
        marginTop: windowHeight * 0.25,
      };
    }
    const menuWidth = 180;
    const menuHeight = 240;
    
    let left = menuPosition.x - menuWidth;
    if (left < 16) left = 16;
    if (left + menuWidth > windowWidth - 16) {
      left = windowWidth - menuWidth - 16;
    }
    
    let top = menuPosition.y;
    if (top + menuHeight > windowHeight - 40) {
      top = menuPosition.y - menuHeight;
      if (top < 40) top = 40;
    }
    
    return {
      position: 'absolute' as const,
      left,
      top,
      width: menuWidth,
    };
  }, [menuPosition, windowWidth, windowHeight]);



  const sidebarWidth = useMemo(() => {
    if (Platform.OS === 'web') {
      return Math.min(300, Math.max(200, Math.round(windowWidth * 0.45)));
    }
    return Math.min(220, Math.max(160, Math.round(windowWidth * 0.5)));
  }, [windowWidth]);
  const isWideWeb = Platform.OS === 'web' && windowWidth >= 680;

  const sidebarAnim = useState(() => new Animated.Value(-2000))[0];
  const sidebarAnimInitRef = useRef(false);

  useEffect(() => {
    if (!sidebarAnimInitRef.current) {
      sidebarAnimInitRef.current = true;
      sidebarAnim.setValue(isSidebarOpen ? 0 : -sidebarWidth - 50);
    }
    Animated.timing(sidebarAnim, {
      toValue: isSidebarOpen ? 0 : -sidebarWidth - 50,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isSidebarOpen, sidebarAnim, sidebarWidth, user, isGuestMode]);

  const userDocUnsubRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      userDocUnsubRef.current?.();
      userDocUnsubRef.current = undefined;
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userDocUnsubRef.current = onSnapshot(
          userDocRef,
          (snap) => {
            if (snap.exists()) {
              const d = snap.data();
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                isPremium: d.isPremium || false,
              });
            } else {
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                isPremium: false,
                onboarded: false,
              });
              void setDoc(
                userDocRef,
                {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                  isPremium: false,
                  onboarded: false,
                  updatedAt: Date.now(),
                },
                { merge: true },
              );
            }
            setAuthLoading(false);
          },
          () => setAuthLoading(false),
        );
      } else {
        setUser(null);
        if (!isGuestMode) {
          setCapsules([]);
        }
        demoSeedInFlightRef.current = false;
        setAuthLoading(false);
      }
    });
    return () => {
      userDocUnsubRef.current?.();
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const q = query(collection(db, 'capsules'), where('userId', '==', uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Capsule, 'id'>),
        id: d.id,
      }));
      const sorted = docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCapsules(sorted);

      if (sorted.length > 0) {
        demoSeedInFlightRef.current = false;
        return;
      }
      // Auto-seeding removed as per new rule: demo data comes from onboarding process.
    });
    return () => unsub();
  }, [user, sortBy, sortOrder]);


  const seedDemoData = async () => {
    if (!user) return;
    const uid = user.uid;
    if (demoSeedInFlightRef.current) return;
    demoSeedInFlightRef.current = true;
    setAuthProcessing(true);
    try {
      const batch = writeBatch(db);
      const now = Date.now();
      
      // If user has interacted and modified the demo capsules in guest mode, 
      // migrate those modified versions so their modifications (e.g. reminders, stars, colors) are preserved!
      const currentDemos = capsules.filter(c => c.id.startsWith('demo-'));
      const itemsToImport = currentDemos.length > 0
        ? currentDemos.map(({ id, ...rest }) => rest)
        : AUTO_DEMO_CAPSULES;

      for (const seed of itemsToImport) {
        const ref = doc(collection(db, 'capsules'));
        batch.set(ref, {
          ...seed,
          userId: uid,
          createdAt: seed.createdAt ?? now,
          updatedAt: seed.updatedAt ?? now,
        });
      }
      await batch.commit();
      await updateDoc(doc(db, 'users', uid), { onboarded: true });
    } catch (e) {
      console.error(e);
    } finally {
      demoSeedInFlightRef.current = false;
      setAuthProcessing(false);
    }
  };

  useEffect(() => {
    if (!user && isGuestMode) {
      const fakeIdDemo = AUTO_DEMO_CAPSULES.map((c, i) => ({ ...c, id: `demo-${i}` }));
      setCapsules(fakeIdDemo);
    } else if (!user && !isGuestMode) {
      setCapsules([]);
    }
  }, [user, isGuestMode]);

  const requireAuth = useCallback(() => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in or create an account to save your own notes and use all features.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => {
            setIsGuestMode(false);
            setShowAuthScreen(true);
        }},
      ]);
      return true;
    }
    return false;
  }, [user]);

  const sortedCapsules = useMemo(() => {
    return [...capsules].sort((a, b) => {
      const ap = a.isPinned ? 1 : 0;
      const bp = b.isPinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      const valA = a[sortBy] || a.createdAt || 0;
      const valB = b[sortBy] || b.createdAt || 0;
      if (valA !== valB) {
        if (sortOrder === 'desc') return valB - valA;
        return valA - valB;
      }
      return a.id.localeCompare(b.id);
    });
  }, [capsules, sortBy, sortOrder]);

  const allTags = useMemo(
    () =>
      Array.from(
        new Set(
          sortedCapsules
            .map((c) => c.tag || (c.tags && c.tags.length > 0 ? c.tags[0] : undefined))
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [sortedCapsules],
  );

  const allCategories = useMemo(
    () =>
      Array.from(
        new Set(
          sortedCapsules.map((c) => c.category).filter(Boolean) as string[],
        ),
      ).sort(),
    [sortedCapsules],
  );

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    sortedCapsules.forEach((c) => {
      if (c.isArchived || c.isDeleted || !c.category) return;
      m.set(c.category, (m.get(c.category) || 0) + 1);
    });
    return m;
  }, [sortedCapsules]);

  const filteredCapsules = useMemo(() => {
    return sortedCapsules.filter((c) => {
      const searchLower = searchQuery.toLowerCase().trim();
      const currentTag = c.tag || (c.tags && c.tags.length > 0 ? c.tags[0] : undefined);
      const matchesSearch = !searchLower || 
        plainTextFromContent(c.content).toLowerCase().includes(searchLower) ||
        (c.category?.toLowerCase().includes(searchLower)) ||
        (currentTag?.toLowerCase().includes(searchLower) ?? false);
      const matchesCategory =
        categoryFilter === 'all' || c.category === categoryFilter;
      const matchesTag = !tagFilter || (currentTag === tagFilter);

      if (filter === 'archived')
        return (
          matchesSearch &&
          matchesCategory &&
          matchesTag &&
          c.isArchived &&
          !c.isDeleted
        );
      if (filter === 'trash')
        return matchesSearch && matchesCategory && matchesTag && c.isDeleted;
      if (filter === 'starred')
        return (
          matchesSearch &&
          matchesCategory &&
          matchesTag &&
          !!c.isStarred &&
          !c.isArchived &&
          !c.isDeleted
        );

      if (c.isArchived || c.isDeleted) return false;

      const matchesAdvanced = (() => {
        switch (filter) {
          case 'pending-todo':
            return c.isTodo && !c.completed;
          case 'without-todo':
            return !c.isTodo;
          case 'completed-todo':
            return (c.isTodo && c.completed) || hasFinishedOneShotReminder(c);
          case 'repeat-reminder':
            return hasRepeatReminder(c);
          case 'without-reminder':
            return !hasActiveReminder(c);
          case 'finished-reminder':
            return hasFinishedOneShotReminder(c);
          case 'pure-note':
            return !c.isTodo && !hasActiveReminder(c);
          default:
            return true;
        }
      })();

      return matchesSearch && matchesCategory && matchesTag && matchesAdvanced;
    });
  }, [sortedCapsules, searchQuery, categoryFilter, tagFilter, filter]);

  const allFilteredSelected = useMemo(() => {
    if (filteredCapsules.length === 0) return false;
    return filteredCapsules.every((c) => selectedIds.includes(c.id));
  }, [filteredCapsules, selectedIds]);

  const firstSelectedCapsule = useMemo(
    () => capsules.find((c) => selectedIds.includes(c.id)),
    [capsules, selectedIds],
  );


  const handleEmailAuth = async () => {
    setAuthError(null);
    setAuthProcessing(true);
    try {
      if (isRegistering) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: email.split('@')[0] });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password')
        setAuthError('Invalid email or password.');
      else if (code === 'auth/email-already-in-use')
        setAuthError('Email already in use.');
      else if (code === 'auth/weak-password')
        setAuthError('Password is too weak.');
      else setAuthError('An error occurred. Please try again.');
    } finally {
      setAuthProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setAuthError('Please enter your email first.');
      return;
    }
    setAuthProcessing(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Sent', 'Check your email for a password reset link.');
      setAuthError(null);
    } catch {
      setAuthError('Could not send reset email.');
    } finally {
      setAuthProcessing(false);
    }
  };

  const mergeCapsuleUpdates = (c: Capsule, updates: Partial<Capsule>): Capsule => {
    let n: Capsule = { ...c, ...updates };
    if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
      const v = updates.category;
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        const { category: _omit, ...rest } = n;
        n = rest as Capsule;
      }
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'tag')) {
      const t = updates.tag;
      if (t === undefined || t === null || (typeof t === 'string' && t.trim() === '')) {
        const { tag: _omit, ...rest } = n;
        n = rest as Capsule;
      }
    }
    if ('tags' in n) {
      const { tags: _omit, ...rest } = n as any;
      n = rest as Capsule;
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
  };

  const updateCapsule = useCallback(
    async (id: string, updates: Partial<Capsule>) => {
      const now = Date.now();
      const original = capsules.find((c) => c.id === id);
      let bump = shouldBumpUpdatedAt(updates);
      if (updates.content !== undefined && original && original.content === updates.content) {
        const otherKeys = Object.keys(updates).filter((k) => k !== 'content' && k !== 'updatedAt');
        if (otherKeys.length === 0) bump = false;
      }

      if (id.startsWith('demo-')) {
        setCapsules((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const merged = mergeCapsuleUpdates(c, updates);
            return bump ? { ...merged, updatedAt: now } : merged;
          }),
        );
        if (editingCapsule?.id === id) {
          setEditingCapsule((prev) => {
            if (!prev) return null;
            const merged = mergeCapsuleUpdates(prev, updates);
            return bump ? { ...merged, updatedAt: now } : merged;
          });
        }
        if (colorPickerCapsule?.id === id) {
          setColorPickerCapsule((prev) => {
            if (!prev) return null;
            const merged = mergeCapsuleUpdates(prev, updates);
            return bump ? { ...merged, updatedAt: now } : merged;
          });
        }
        return;
      }

      if (requireAuth()) return;
      // 乐观更新本地 capsules（与 demo 路径一致），避免关弹窗后 Firestore 回调未到导致卡片显示旧数据
      setCapsules((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const merged = mergeCapsuleUpdates(c, updates);
          return bump ? { ...merged, updatedAt: now } : merged;
        }),
      );
      if (editingCapsule?.id === id) {
        setEditingCapsule((prev) => {
          if (!prev) return null;
          const merged = mergeCapsuleUpdates(prev, updates);
          return bump ? { ...merged, updatedAt: now } : merged;
        });
      }
      if (colorPickerCapsule?.id === id) {
        setColorPickerCapsule((prev) => {
          if (!prev) return null;
          const merged = mergeCapsuleUpdates(prev, updates);
          return bump ? { ...merged, updatedAt: now } : merged;
        });
      }
      try {
        const docRef = doc(db, 'capsules', id);
        const clean = capsulePartialToFirestoreData(updates);
        if (bump) {
          clean.updatedAt = now;
        }
        await updateDoc(docRef, clean);
      } catch (e) {
        console.error(e);
        Alert.alert('Sync failed', 'Could not update the note. Check your network.');
      }
    },
    [user, editingCapsule?.id, colorPickerCapsule?.id, capsules, requireAuth],
  );

  const updateCapsuleRef = useRef(updateCapsule);
  updateCapsuleRef.current = updateCapsule;
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      capsules.forEach((cap) => {
        if (!cap.reminder?.date || cap.completed || cap.isDeleted || cap.isArchived) return;
        if (cap.reminder.date > now) return;
        let shouldUpdate = false;
        const nextReminder = { ...cap.reminder };
        if (cap.reminder.type === 'custom' && cap.reminder.customInterval) {
          const mult =
            cap.reminder.customUnit === 'day'
              ? 86400000
              : cap.reminder.customUnit === 'week'
                ? 604800000
                : 2592000000;
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
        }
        if (shouldUpdate) void updateCapsuleRef.current(cap.id, { reminder: nextReminder });
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [capsules]);

  const removeCapsuleForever = async (id: string) => {
    if (requireAuth()) return;
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'capsules', id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCapsule = async (text: string) => {
    if (!text.trim()) return;
    if (requireAuth()) return;
    if (!user) return;
    
    // Request notification permission immediately in the synchronous user click handler stack
    if (Platform.OS !== 'web') {
      void requestNotificationPermissions();
    }

    setIsProcessing(true);
    setInputText('');
    try {
      const { title, category, tags, refinedContent, isTodo, reminder } =
        await categorizeThought(text);
      const randomColor =
        PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      const norm = normalizeReminder(reminder);
      const isTodoResolved = Boolean(isTodo || (norm != null && norm.type !== 'none'));

      // 同步生成唯一的文档 ID，不阻塞 UI 线程
      const docRef = doc(collection(db, 'capsules'));
      
      const newNote = {
        id: docRef.id,
        userId: user.uid,
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: refinedContent }] }] }),
        subject: title || undefined,
        category: category || undefined,
        tag: tags && tags.length > 0 ? tags[0] : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completed: false,
        isTodo: isTodoResolved,
        isArchived: false,
        isDeleted: false,
        reminder: norm,
        color: randomColor,
      };

      // 1. 同步执行本地状态乐观更新（瞬时展现，不管断网与否卡片立刻出现在首页）
      setCapsules(prev => {
        if (prev.some(c => c.id === docRef.id)) return prev;
        return [newNote, ...prev];
      });

      // 2. 后台静默发送（即使离线，Firestore offline cache 也会保存并会在设备重连时自动推送）
      setDoc(docRef, newNote).catch(e => {
        console.error("EAS setDoc failed:", e);
      });

    } catch {
      const randomColor =
        PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      
      const docRef = doc(collection(db, 'capsules'));
      const fallbackNote = {
        id: docRef.id,
        userId: user.uid,
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: text }] }] }),
        subject: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completed: false,
        isTodo: false,
        isArchived: false,
        isDeleted: false,
        color: randomColor,
      };

      // 乐观更新 fallback 流程
      setCapsules(prev => {
        if (prev.some(c => c.id === docRef.id)) return prev;
        return [fallbackNote, ...prev];
      });

      // 后台静默发送 fallback
      setDoc(docRef, fallbackNote).catch(e => {
        console.error("EAS fallback setDoc failed:", e);
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateCapsuleRef = useRef(handleCreateCapsule);
  handleCreateCapsuleRef.current = handleCreateCapsule;
  const userForVoiceRef = useRef<UserProfile | null>(null);
  userForVoiceRef.current = user;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const win = typeof globalThis !== 'undefined' ? (globalThis as unknown as Window & {
      webkitSpeechRecognition?: new () => any;
      SpeechRecognition?: new () => any;
    }) : null;
    const SpeechRec =
      win &&
      (typeof win.webkitSpeechRecognition === 'function'
        ? win.webkitSpeechRecognition
        : typeof win.SpeechRecognition === 'function'
          ? win.SpeechRecognition
          : null);
    if (!win || !SpeechRec) {
      return;
    }
    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript as string | undefined;
      if (transcript?.trim()) {
        void (async () => {
          await handleCreateCapsuleRef.current(transcript.trim());
          const u = userForVoiceRef.current;
          if (u && !hasPremiumAccess(u)) {
            await incrementVoiceCaptureCount(u.uid);
          }
        })();
      }
      setIsWebListening(false);
    };
    recognition.onerror = () => setIsWebListening(false);
    recognition.onend = () => setIsWebListening(false);
    webSpeechRef.current = recognition;
    return () => {
      webSpeechRef.current = null;
    };
  }, []);

  const batchUpdate = async (updates: Partial<Capsule>) => {
    if (selectedIds.length === 0) return;

    const demoIds = selectedIds.filter((id) => id.startsWith('demo-'));
    const realIds = selectedIds.filter((id) => !id.startsWith('demo-'));

    if (realIds.length > 0) {
      if (requireAuth()) return;
      if (!user) return;
    }

    const now = Date.now();
    const bump = shouldBumpUpdatedAt(updates);

    if (demoIds.length > 0) {
      setCapsules((prev) =>
        prev.map((c) => {
          if (!demoIds.includes(c.id)) return c;
          const merged = mergeCapsuleUpdates(c, updates);
          return bump ? { ...merged, updatedAt: now } : merged;
        }),
      );
    }

    if (realIds.length > 0) {
      try {
        const batch = writeBatch(db);
        const clean = capsulePartialToFirestoreData(updates);
        if (bump) {
          clean.updatedAt = now;
        }
        realIds.forEach((id) => {
          batch.update(doc(db, 'capsules', id), clean as any);
        });
        await batch.commit();
      } catch (e) {
        console.error(e);
        Alert.alert('Sync failed', 'Could not update notes. Check your network.');
        return;
      }
    }

    setSelectedIds([]);
    setIsMultiSelectMode(false);
  };

  const batchRemovePermanently = async () => {
    if (requireAuth()) return;
    if (!user || selectedIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => batch.delete(doc(db, 'capsules', id)));
      await batch.commit();
      setSelectedIds([]);
      setIsMultiSelectMode(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePremiumSuccess = async () => {
    if (!user?.uid) return;
    setShowPremiumModal(false);
    try {
      await setDoc(doc(db, 'users', user.uid), { isPremium: true }, { merge: true });
      Alert.alert('Success', 'You now have Idea Capsule Pro.');
    } catch {
      Alert.alert('Error', 'Could not update subscription status.');
    }
  };

  const handleDowngrade = () => {
    if (!user?.uid) return;
    Alert.alert(
      'Downgrade?',
      'This turns off Pro on your account (same as the web app: isPremium false).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await setDoc(doc(db, 'users', user.uid), { isPremium: false }, { merge: true });
              setShowSettings(false);
              Alert.alert('Updated', 'You are on the free plan.');
            } catch {
              Alert.alert('Error', 'Could not update your account.');
            }
          },
        },
      ],
    );
  };

  const pickImageForCapsule = async (cap: Capsule) => {
    if (requireAuth()) return;
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access in Settings to attach images.',
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const isVideo = asset.type === 'video';

    if (!hasPremiumAccess(user) && (isVideo || (asset.fileSize ?? 0) > 5 * 1024 * 1024)) {
      setShowPremiumModal(true);
      return;
    }

    if ((asset.fileSize ?? 0) > 800 * 1024 || isVideo) {
      const url = asset.uri;
      const next = [...(cap.attachments || []), { url, type: isVideo ? 'video' as const : 'image' as const }];
      await updateCapsule(cap.id, { attachments: next });
      setEditingCapsule((e) => (e?.id === cap.id ? { ...e, attachments: next } : e));
      return;
    }

    try {
      const base64 = await readAsStringAsync(asset.uri, {
        encoding: EncodingType.Base64,
      });
      const mime = asset.mimeType || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${base64}`;
      const next = [...(cap.attachments || []), { url: dataUrl, type: 'image' as const }];
      await updateCapsule(cap.id, { attachments: next });
      setEditingCapsule((e) => (e?.id === cap.id ? { ...e, attachments: next } : e));
    } catch (e) {
      console.error(e);
    }
  };

  const removeAttachmentAt = async (index: number) => {
    const cap = editingCapsuleRef.current;
    if (!cap) return;
    const prev = cap.attachments || [];
    if (index < 0 || index >= prev.length) return;
    const next = prev.filter((_, j) => j !== index);
    await updateCapsule(cap.id, {
      attachments: next.length > 0 ? next : undefined,
    });
    setEditingCapsule((e) =>
      e?.id === cap.id
        ? mergeCapsuleUpdates(e, {
            attachments: next.length > 0 ? next : undefined,
          })
        : e,
    );
  };

  const startVoice = async () => {
    if (requireAuth()) return;
    if (!user) return;

    if (Platform.OS === 'web') {
      if (!hasPremiumAccess(user)) {
        const used = await getVoiceCaptureCount(user.uid);
        if (used >= VOICE_FREE_LIMIT) {
          setShowPremiumModal(true);
          return;
        }
      }
      const rec = webSpeechRef.current;
      if (!rec) {
        Alert.alert(
          'Voice',
          'This browser does not support dictation. Try Chrome or Edge.',
        );
        return;
      }
      try {
        setIsWebListening(true);
        rec.start();
      } catch {
        setIsWebListening(false);
        Alert.alert('Voice', 'Could not start dictation. Check microphone permission.');
      }
      return;
    }

    if (!hasPremiumAccess(user)) {
      const used = await getVoiceCaptureCount(user.uid);
      if (used >= VOICE_FREE_LIMIT) {
        setShowPremiumModal(true);
        return;
      }
    }

    if (isVoiceRecording && voiceRecordingRef.current) {
      const prev = voiceRecordingRef.current;
      voiceRecordingRef.current = null;
      try {
        await prev.stopAndUnloadAsync();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        console.error(e);
        setIsVoiceRecording(false);
        setQuickCaptureMode('buttons');
        return;
      }
      setIsVoiceRecording(false);
      setQuickCaptureMode('buttons');
      const uri = prev.getURI();
      if (!uri) {
        setQuickCaptureMode('buttons');
        Alert.alert('Voice', 'Could not save the recording file.');
        return;
      }
      let base64: string;
      try {
        base64 = await readAsStringAsync(uri, {
          encoding: EncodingType.Base64,
        });
      } catch (e) {
        console.error(e);
        Alert.alert('Voice', 'Could not read the recording.');
        return;
      }
      setIsProcessing(true);
      try {
        const meta = await categorizeThoughtFromAudio(base64, 'audio/mp4');
        if (meta.error === 'NO_KEY') {
          Alert.alert(
            'Gemini API Key Missing',
            'Please configure EXPO_PUBLIC_GEMINI_API_KEY in your mobile/.env file to enable voice transcription.'
          );
          return;
        }
        const refined = meta.refinedContent?.trim() || '';
        if (!refined) {
          Alert.alert(
            'Voice',
            'Could not transcribe audio. Check your network connection and Gemini API key.',
          );
          return;
        }
        const randomColor =
          PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
        const norm = normalizeReminder(meta.reminder);
        const isTodoResolved = Boolean(
          meta.isTodo || (norm != null && norm.type !== 'none'),
        );
        await addDoc(collection(db, 'capsules'), {
          userId: user.uid,
          content: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: refined }],
              },
            ],
          }),
          subject: meta.title || undefined,
          category: meta.category || undefined,
          tag: meta.tags && meta.tags.length > 0 ? meta.tags[0] : undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completed: false,
          isTodo: isTodoResolved,
          isArchived: false,
          isDeleted: false,
          reminder: norm,
          color: randomColor,
        });
        if (!hasPremiumAccess(user)) {
          await incrementVoiceCaptureCount(user.uid);
        }
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone', 'Microphone access is required to record a voice note.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      voiceRecordingRef.current = rec;
      setIsVoiceRecording(true);
      setQuickCaptureMode('voice');
    } catch (e) {
      console.error(e);
      Alert.alert('Voice', 'Could not start recording.');
      setIsVoiceRecording(false);
      setQuickCaptureMode('buttons');
      voiceRecordingRef.current = null;
    }
  };

  const openMenu = (c: Capsule, event?: any) => {
    setMenuCategory(c.category || '');
    categoryMenuSentRef.current = (c.category || '').trim();
    setMenuTagInput('');
    setMenuCategoryFocused(false);
    setMenuTagFocused(false);
    setActiveMenuCapsule(c);
    if (event?.nativeEvent) {
      setMenuPosition({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
    } else {
      setMenuPosition(null);
    }
  };

  /** Menu: category debounced sync (matches web—no extra Save tap). */
  useEffect(() => {
    if (!activeMenuCapsule || activeMenuCapsule.isDeleted) return;
    const trimmed = menuCategory.trim();
    if (trimmed === categoryMenuSentRef.current) return;
    const id = activeMenuCapsule.id;
    const t = setTimeout(() => {
      categoryMenuSentRef.current = trimmed;
      void updateCapsule(id, { category: trimmed || undefined });
      setActiveMenuCapsule((prev) =>
        prev?.id === id ? { ...prev, category: trimmed || undefined } : prev,
      );
    }, 360);
    return () => clearTimeout(t);
  }, [menuCategory, activeMenuCapsule?.id, activeMenuCapsule?.isDeleted, updateCapsule]);

  /** Commit pending tag text using refs (safe on menu dismiss / sub-sheets). Returns the capsule to use for follow-up updates. */
  const flushMenuTag = useCallback((): Capsule | null => {
    const cap = activeMenuCapsuleRef.current;
    if (!cap || cap.isDeleted) return null;
    const raw = menuTagInputRef.current.trim().replace(/^#/, '').replace(/,/g, '');
    if (!raw) return cap;
    let merged: Capsule = cap;
    setCapsules((s) => {
      const fromList = s.find((x) => x.id === cap.id) ?? cap;
      const currentTag = fromList.tag || (fromList.tags && fromList.tags.length > 0 ? fromList.tags[0] : undefined);
      if (currentTag === raw) {
        merged = fromList;
        return s;
      }
      merged = { ...fromList, tag: raw, tags: undefined };
      void updateCapsule(cap.id, { tag: raw });
      return s.map((x) => (x.id === cap.id ? { ...x, tag: raw, tags: undefined } : x));
    });
    setActiveMenuCapsule((prev) => (prev?.id === cap.id ? merged : prev));
    setMenuTagInput('');
    return merged;
  }, [updateCapsule]);

  const closeNotesMenu = useCallback(() => {
    // Flush category immediately if changed
    if (activeMenuCapsule && !activeMenuCapsule.isDeleted) {
      const trimmed = menuCategory.trim();
      if (trimmed !== categoryMenuSentRef.current) {
        categoryMenuSentRef.current = trimmed;
        void updateCapsule(activeMenuCapsule.id, { category: trimmed || undefined });
      }
    }
    flushMenuTag();
    setMenuTagInput('');
    setActiveMenuCapsule(null);
  }, [flushMenuTag, menuCategory, activeMenuCapsule, updateCapsule]);

  /** Tags: pause-then-commit (avoid clearing mid-composition on some keyboards). */
  useEffect(() => {
    if (!activeMenuCapsule || activeMenuCapsule.isDeleted) return;
    if (!menuTagInput.trim()) return;
    const t = setTimeout(() => {
      flushMenuTag();
    }, 950);
    return () => clearTimeout(t);
  }, [menuTagInput, activeMenuCapsule?.id, activeMenuCapsule?.isDeleted, flushMenuTag]);

  const applyMenuCategoryPick = useCallback(
    (cat: string) => {
      if (!activeMenuCapsule || activeMenuCapsule.isDeleted) return;
      const trimmed = cat.trim();
      setMenuCategory(trimmed);
      categoryMenuSentRef.current = trimmed;
      void updateCapsule(activeMenuCapsule.id, { category: trimmed || undefined });
      setActiveMenuCapsule((prev) =>
        prev?.id === activeMenuCapsule.id ? { ...prev, category: trimmed || undefined } : prev,
      );
    },
    [activeMenuCapsule, updateCapsule],
  );

  const applyMenuTagPick = useCallback(
    (tag: string) => {
      if (!activeMenuCapsule || activeMenuCapsule.isDeleted) return;
      const val = tag.trim().replace(/^#/, '').replace(/,/g, '');
      if (!val) return;
      const id = activeMenuCapsule.id;
      let merged: Capsule = activeMenuCapsule;
      setCapsules((s) => {
        const cap = s.find((x) => x.id === id) ?? activeMenuCapsule;
        if (!cap) return s;
        const currentTag = cap.tag || (cap.tags && cap.tags.length > 0 ? cap.tags[0] : undefined);
        if (currentTag === val) {
          merged = cap;
          return s;
        }
        merged = { ...cap, tag: val };
        void updateCapsule(id, { tag: val });
        return s.map((x) => (x.id === id ? { ...x, tag: val, tags: undefined } : x));
      });
      setActiveMenuCapsule((prev) => (prev?.id === id ? merged : prev));
    },
    [activeMenuCapsule, updateCapsule],
  );

  const removeMenuTag = useCallback(
    () => {
      if (!activeMenuCapsule || activeMenuCapsule.isDeleted) return;
      const id = activeMenuCapsule.id;
      void updateCapsule(id, { tag: undefined });
      setActiveMenuCapsule((prev) =>
        prev?.id === id ? { ...prev, tag: undefined, tags: undefined } : prev,
      );
    },
    [activeMenuCapsule, updateCapsule],
  );

  const clearMenuCategory = useCallback(() => {
    if (!activeMenuCapsule || activeMenuCapsule.isDeleted) return;
    const id = activeMenuCapsule.id;
    setMenuCategory('');
    categoryMenuSentRef.current = '';
    void updateCapsule(id, { category: undefined });
    setActiveMenuCapsule((prev) =>
      prev?.id === id ? { ...prev, category: undefined } : prev,
    );
  }, [activeMenuCapsule, updateCapsule]);

  /** Category autocomplete while focused—prefix match. */
  const menuCategoryAutocomplete = useMemo(() => {
    if (!menuCategoryFocused) return [];
    const q = menuCategory.trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    return allCategories
      .filter((c) => {
        const cl = c.toLowerCase();
        return cl.startsWith(ql) && cl !== ql;
      })
      .slice(0, 12);
  }, [menuCategoryFocused, menuCategory, allCategories]);

  /** Tags autocomplete while focused—match anywhere. */
  const menuTagAutocomplete = useMemo(() => {
    if (!menuTagFocused || !activeMenuCapsule) return [];
    const raw = menuTagInput.trim().replace(/^#/, '');
    if (!raw) return [];
    const ql = raw.toLowerCase();
    const currentTag = activeMenuCapsule.tag || (activeMenuCapsule.tags && activeMenuCapsule.tags.length > 0 ? activeMenuCapsule.tags[0] : undefined);
    const existing = new Set(currentTag ? [currentTag.toLowerCase()] : []);
    return allTags
      .filter((t) => {
        const tl = t.toLowerCase();
        return tl.includes(ql) && !existing.has(tl) && tl !== ql;
      })
      .slice(0, 12);
  }, [menuTagFocused, menuTagInput, allTags, activeMenuCapsule]);

  const editCategorySuggestions = useMemo(() => {
    if (!editCategoryFocused) return [];
    const q = editCategoryDraft.trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    return allCategories
      .filter((c) => {
        const cl = c.toLowerCase();
        return cl.startsWith(ql) && cl !== ql;
      })
      .slice(0, 8);
  }, [editCategoryFocused, editCategoryDraft, allCategories]);

  const editTagSuggestions = useMemo(() => {
    if (!editTagFocused) return [];
    const raw = editTagDraft.trim().replace(/^#/, '');
    if (!raw) return [];
    const ql = raw.toLowerCase();
    return allTags
      .filter((t) => {
        const tl = t.toLowerCase();
        return tl.includes(ql) && tl !== ql;
      })
      .slice(0, 8);
  }, [editTagFocused, editTagDraft, allTags]);

  const saveEditSilent = useCallback(() => {
    if (!editingCapsule) return;
    const id = editingCapsule.id;
    const original = capsules.find((c) => c.id === id);
    const content = editContent;
    const subjectTrim = editSubjectDraft.trim();
    const catTrim = editCategoryDraft.trim();
    const newTag = editTagDraft.replace(/,/g, '').trim();

    const updates: Partial<Capsule> = {};
    if (!original || original.content !== content) {
      updates.content = content;
    }
    if ((original?.subject || '') !== subjectTrim) {
      updates.subject = subjectTrim ? subjectTrim : undefined;
    }
    const prevCat = (original?.category || '').trim();
    if (prevCat !== catTrim) {
      updates.category = catTrim ? catTrim : undefined;
    }
    const prevTag = original?.tag || (original?.tags && original?.tags.length > 0 ? original?.tags[0] : '');
    if (prevTag !== newTag) {
      updates.tag = newTag ? newTag : undefined;
    }

    if (Object.keys(updates).length === 0) return;
    void updateCapsule(id, updates);
  }, [
    editingCapsule,
    editContent,
    editSubjectDraft,
    editCategoryDraft,
    editTagDraft,
    capsules,
    updateCapsule,
  ]);

  const saveEdit = useCallback(() => {
    saveEditSilent();
    setEditingCapsule(null);
  }, [saveEditSilent]);

  useEffect(() => {
    if (!editingCapsule) {
      editModalCapsuleIdRef.current = null;
      return;
    }
    if (editModalCapsuleIdRef.current !== editingCapsule.id) {
      editModalCapsuleIdRef.current = editingCapsule.id;
      setEditContent(editingCapsule.content);
      setEditSubjectDraft(editingCapsule.subject || '');
      setEditCategoryDraft(editingCapsule.category || '');
      setEditTagDraft(editingCapsule.tag || (editingCapsule.tags && editingCapsule.tags.length > 0 ? editingCapsule.tags[0] : ''));
    }
  }, [editingCapsule]);

  if (authLoading) {
    return (
      <View style={s.loadingRoot}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Zap size={40} color="#007AFF" style={{ position: 'absolute', opacity: 0.2 }} />
      </View>
    );
  }

  if (!user && !isGuestMode) {
    if (!showAuthScreen) {
      return (
        <LandingScreen
          onEmailAuth={() => setShowAuthScreen(true)}
          onGuestPress={() => setIsGuestMode(true)}
        />
      );
    }

    return (
      <SafeAreaView style={s.authRoot}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableOpacity style={s.backFab} onPress={() => setShowAuthScreen(false)}>
            <ChevronLeft size={22} color="#1D1D1F" />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={s.authScroll}>
            <Text style={s.authH}>{isRegistering ? 'Create account' : 'Welcome back'}</Text>
            <Text style={s.authHint}>
              {isRegistering
                ? 'Start capturing ideas everywhere'
                : 'Sign in to sync your capsules'}
            </Text>

            <Text style={s.label}>Email</Text>
            <View style={s.inputRow}>
              <Mail size={18} color="#8E8E93" />
              <TextInput
                style={s.input}
                placeholder="name@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <Lock size={18} color="#8E8E93" />
              <TextInput
                style={s.input}
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {authError ? <Text style={s.errTxt}>{authError}</Text> : null}

            <TouchableOpacity
              style={[s.primaryBtn, { marginTop: 10 }]}
              disabled={authProcessing}
              onPress={handleEmailAuth}
            >
              {authProcessing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={s.primaryBtnTxt}>
                  {isRegistering ? 'Sign up' : 'Sign in'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 6 }} onPress={handleResetPassword}>
              <Text style={{ color: '#007AFF', fontWeight: '700', fontSize: 13 }}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            <Text style={s.dividerLabel}>Or continue with</Text>
            <View style={s.socialRow}>
              <GoogleSignInButton variant="light" compact />
            </View>

            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => setIsRegistering(!isRegistering)}>
              <Text style={{ textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>
                {isRegistering ? 'Already have an account?' : 'New here?'}{' '}
                <Text style={{ color: '#007AFF', fontWeight: '800' }}>
                  {isRegistering ? 'Sign in' : 'Create account'}
                </Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const filterLabel = FILTER_OPTIONS.find((f) => f.value === filter)?.label ?? 'Filter';
  const scrollPadX = 8;
  const gridGap = 8;
  const layoutInnerWidth =
    isWideWeb ? Math.min(windowWidth, 720) : windowWidth;
  const gridAvail = Math.max(0, layoutInnerWidth - scrollPadX * 2);
  const minGridTile = 148;
  const gridCols = Math.min(
    8,
    Math.max(2, Math.floor((gridAvail + gridGap) / (minGridTile + gridGap))),
  );
  const gridColWidth = Math.floor(
    (gridAvail - gridGap * (gridCols - 1)) / gridCols,
  );
  const menuSheetWidth = Math.min(236, windowWidth - 36);
  const filterMenuTop = insets.top + 60;
  const listBottomPad = 14;

  const isSidebarScopeFilterActive =
    categoryFilter !== 'all' || tagFilter !== null || filter !== 'all';
  const isSidebarListScopeActive =
    categoryFilter !== 'all' || tagFilter !== null || filter === 'starred';
  const topFilterShowsNA =
    isSidebarListScopeActive && filter !== 'archived' && filter !== 'trash';

  const filterChipLabel = (() => {
    if (topFilterShowsNA) return 'N/A';
    const lbl = filterLabel;
    return lbl;
  })();


  return (
    <View
      style={[
        s.container,
        Platform.OS === 'web' && {
          width: '100%',
          minHeight: '100%',
          alignSelf: 'stretch',
        },
      ]}
    >
      <SafeAreaView
        style={[
          s.safeMain,
          isWideWeb && { maxWidth: 720, width: '100%', alignSelf: 'center' },
        ]}
        edges={['top']}
      >


        {/* Second Row: Actions & Search */}
        <View style={s.header}>
          <View style={s.sidebarOpenBtnWrap}>
            <TouchableOpacity
              onPress={() => setIsSidebarOpen(true)}
              hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
              style={s.headerIconHit}
              accessibilityRole="button"
              accessibilityLabel={
                isSidebarScopeFilterActive
                  ? 'Open sidebar — a filter is active'
                  : 'Categories and tags'
              }
            >
              <PanelLeft size={24} color="#007AFF" />
            </TouchableOpacity>
            {isSidebarScopeFilterActive ? (
              <View style={s.sidebarScopeDot} pointerEvents="none" />
            ) : null}
          </View>
          <View style={s.searchWrap}>
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={() => {
                  if (searchQuery.trim() !== '') {
                    setSearchQuery('');
                  } else {
                    searchInputRef.current?.focus();
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={searchQuery.trim() !== '' ? 0.6 : 1}
              >
                <Search size={17} color="#8E8E93" />
              </TouchableOpacity>
              {searchQuery.trim() !== '' && (
                <View
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: '#FF3B30',
                    borderWidth: 1.5,
                    borderColor: '#F2F2F7', // 与 searchWrap 的背景色融合
                  }}
                  pointerEvents="none"
                />
              )}
            </View>
            <TextInput
              ref={searchInputRef}
              style={s.searchIn}
              placeholder="Search inspiration…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#8E8E93"
              returnKeyType="search"
            />
          </View>
          <View style={s.iconsRow}>
            <TouchableOpacity
              style={s.headerIconHit}
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
            >
              {viewMode === 'list' ? (
                <LayoutGrid size={22} color="#1D1D1F" />
              ) : (
                <LayoutList size={22} color="#1D1D1F" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.headerIconHit}
              onPress={() => setIsSortMenuOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ArrowDownNarrowWide size={22} color="#1D1D1F" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, position: 'relative' }}>
          {/* 下拉刷新文字提示：以绝对定位漂浮在最顶层，不遮挡手势，绝对防止滚动抖动 */}
          {(mobilePullY > 0 || refreshing || isSyncing || showSyncComplete) && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 10,
                left: 0,
                right: 0,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999,
              }}
            >
              <Text style={{
                color: showSyncComplete ? '#34C759' : '#8E8E93',
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                backgroundColor: '#FFFBE6', // 保持和纸张背景底色一致
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}>
                {showSyncComplete
                  ? 'Sync complete'
                  : refreshing || isSyncing
                  ? 'Syncing…'
                  : mobilePullY >= 75
                  ? 'Release to sync notes…'
                  : 'Pull down to sync…'}
              </Text>
            </View>
          )}

          <ScrollView
            style={s.scrollFill}
            contentContainerStyle={[
              s.scrollBody, 
              { 
                paddingBottom: listBottomPad, 
                paddingTop: (refreshing || isSyncing || showSyncComplete) ? 42 : 0 
              }
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS === 'android'}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing || isSyncing}
                onRefresh={onRefresh}
                tintColor="transparent"
                colors={['transparent']}
              />
            }
          >
            <View style={viewMode === 'grid' ? s.gridRow : s.listCol}>
              {filteredCapsules.map((item) => {
                const renderLeftActions = (
                progress: Animated.AnimatedInterpolation<number>,
                dragX: Animated.AnimatedInterpolation<number>
              ) => {
                const transX = dragX.interpolate({
                  inputRange: [0, 20, 80],
                  outputRange: [-20, 0, 10],
                  extrapolate: 'clamp',
                });
                const opacity = dragX.interpolate({
                  inputRange: [0, 20, 80],
                  outputRange: [0, 1, 1],
                  extrapolate: 'clamp',
                });
                const scale = dragX.interpolate({
                  inputRange: [0, 65, 80, 120],
                  outputRange: [0.9, 1.0, 1.25, 1.25],
                  extrapolate: 'clamp',
                });

                if (filter === 'archived' || filter === 'trash') {
                  return (
                    <View style={s.swipeLeftAction}>
                      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, transform: [{ translateX: transX }, { scale }], opacity }}>
                        <RotateCcw size={18} color="#FFF" />
                        <Text style={s.swipeActionTxt}>Restore</Text>
                      </Animated.View>
                    </View>
                  );
                }

                // 根据状态机决定展现的文字和图标：Note -> Todo, Active -> Complete, Completed -> Activate
                const label = !item.isTodo ? 'Todo' : item.completed ? 'Activate' : 'Complete';
                const Icon = item.completed ? RotateCcw : Check;

                return (
                  <View style={s.swipeLeftAction}>
                    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, transform: [{ translateX: transX }, { scale }], opacity }}>
                      <Icon size={18} color="#FFF" />
                      <Text style={s.swipeActionTxt}>{label}</Text>
                    </Animated.View>
                  </View>
                );
              };

              const renderRightActions = (
                progress: Animated.AnimatedInterpolation<number>,
                dragX: Animated.AnimatedInterpolation<number>
              ) => {
                // dragX 在向左拖拽（拉出右侧）时是负值
                const transX = dragX.interpolate({
                  inputRange: [-80, -20, 0],
                  outputRange: [-10, 0, 20],
                  extrapolate: 'clamp',
                });
                const opacity = dragX.interpolate({
                  inputRange: [-80, -20, 0],
                  outputRange: [1, 1, 0],
                  extrapolate: 'clamp',
                });
                const scale = dragX.interpolate({
                  inputRange: [-120, -80, -65, 0],
                  outputRange: [1.25, 1.25, 1.0, 0.9],
                  extrapolate: 'clamp',
                });

                if (filter === 'archived') {
                  return (
                    <View style={s.swipeRightAction}>
                      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, transform: [{ translateX: transX }, { scale }], opacity }}>
                        <Trash2 size={18} color="#FFF" />
                        <Text style={s.swipeActionTxt}>Delete</Text>
                      </Animated.View>
                    </View>
                  );
                }
                if (filter === 'trash') {
                  return (
                    <View style={s.swipeRightAction}>
                      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, transform: [{ translateX: transX }, { scale }], opacity }}>
                        <Trash2 size={18} color="#FFF" />
                        <Text style={s.swipeActionTxt}>Delete Forever</Text>
                      </Animated.View>
                    </View>
                  );
                }
                const isArchive = settings.swipeRightAction === 'archive';
                const label = isArchive ? 'Archive' : 'Delete';
                const Icon = isArchive ? Archive : Trash2;

                return (
                  <View style={[s.swipeRightAction, isArchive && { backgroundColor: '#007AFF' }]}>
                    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, transform: [{ translateX: transX }, { scale }], opacity }}>
                      <Icon size={18} color="#FFF" />
                      <Text style={s.swipeActionTxt}>{label}</Text>
                    </Animated.View>
                  </View>
                );
              };

              const handleSwipeTrigger = (direction: 'left' | 'right') => {
                if (filter === 'archived') {
                  if (direction === 'left') {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    void updateCapsule(item.id, { isArchived: false });
                    showToast('Note restored!', 'success');
                  } else if (direction === 'right') {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    void updateCapsule(item.id, { isDeleted: true });
                    showToast('Note deleted!', 'success');
                  }
                  return;
                }

                if (filter === 'trash') {
                  if (direction === 'left') {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    void updateCapsule(item.id, { isDeleted: false });
                    showToast('Note restored!', 'success');
                  } else if (direction === 'right') {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    Alert.alert(
                      'Confirm Delete',
                      'Are you sure you want to permanently delete this note?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            void removeCapsuleForever(item.id);
                            showToast('Note deleted forever!', 'success');
                          },
                        },
                      ],
                    );
                  }
                  return;
                }

                if (direction === 'left') {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  // 右滑状态机递进：Note -> Active Todo -> Completed Todo -> Active Todo...
                  let updates: Partial<Capsule> = {};
                  let toastMsg = '';
                  if (!item.isTodo) {
                    updates = { isTodo: true, completed: false };
                    toastMsg = 'Task created!';
                  } else if (!item.completed) {
                    updates = { completed: true };
                    toastMsg = 'Task completed!';
                  } else {
                    updates = { completed: false };
                    toastMsg = 'Task activated!';
                  }
                  void updateCapsule(item.id, updates);
                  showToast(toastMsg, 'success');
                } else if (direction === 'right') {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  if (settings.swipeRightAction === 'archive') {
                    void updateCapsule(item.id, { isArchived: true });
                    showToast('Note archived!', 'success');
                  } else {
                    void updateCapsule(item.id, { isDeleted: true });
                    showToast('Note deleted!', 'success');
                  }
                }
              };

              return (
                <View
                  key={item.id}
                  style={[
                    viewMode === 'grid' ? s.cardWrapGrid : s.cardWrapList,
                    viewMode === 'grid' && { width: gridColWidth },
                  ]}
                >
                  {isMultiSelectMode && (
                    <TouchableOpacity
                      style={[
                        s.multiCheck,
                        viewMode === 'grid' && s.multiCheckFloating,
                      ]}
                      onPress={() => {
                        setSelectedIds((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((x) => x !== item.id)
                            : [...prev, item.id],
                        );
                      }}
                    >
                      {selectedIds.includes(item.id) ? (
                        <View style={s.checkedCircle}>
                          <Check size={12} color="#FFF" />
                        </View>
                      ) : (
                        <View style={[s.uncheckCircle, viewMode === 'grid' && s.uncheckCircleOnCard]} />
                      )}
                    </TouchableOpacity>
                  )}
                  {viewMode === 'list' && !isMultiSelectMode && settings.swipeEnabled ? (
                    <SwipeableCardWrapper
                      item={item}
                      renderLeftActions={renderLeftActions}
                      renderRightActions={renderRightActions}
                      onSwipeTrigger={handleSwipeTrigger}
                    >
                      <CapsuleCard
                        item={item}
                        isGrid={false}
                        isSelected={selectedIds.includes(item.id)}
                        isMulti={false}
                        onPress={() => setEditingCapsule(item)}
                        onLongPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setIsMultiSelectMode(true);
                          setSelectedIds((prev) =>
                            prev.includes(item.id) ? prev : [...prev, item.id],
                          );
                        }}
                        onMenu={(e) => openMenu(item, e)}
                        onToggleTodo={() => {
                          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          void updateCapsule(item.id, { completed: !item.completed });
                        }}
                      />
                    </SwipeableCardWrapper>
                  ) : (
                    <CapsuleCard
                      item={item}
                      isGrid={viewMode === 'grid'}
                      isSelected={selectedIds.includes(item.id)}
                      isMulti={isMultiSelectMode}
                      onPress={() =>
                        isMultiSelectMode
                          ? setSelectedIds((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((x) => x !== item.id)
                                : [...prev, item.id],
                            )
                          : setEditingCapsule(item)
                      }
                      onLongPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setIsMultiSelectMode(true);
                        setSelectedIds((prev) =>
                          prev.includes(item.id) ? prev : [...prev, item.id],
                        );
                      }}
                      onMenu={(e) => openMenu(item, e)}
                      onToggleTodo={() => {
                        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        void updateCapsule(item.id, { completed: !item.completed });
                      }}
                    />
                  )}
                </View>
              );
            })}
            {filteredCapsules.length === 0 && (
              <View style={s.emptyWrap}>
                <View style={s.emptyCircle}>
                  <Plus size={32} color="#8E8E93" />
                </View>
                <Text style={s.emptyTxt}>No capsules found in this view.</Text>
                {!user?.onboarded && (
                  <TouchableOpacity 
                    style={s.demoBtn} 
                    onPress={seedDemoData}
                    disabled={authProcessing}
                  >
                    <Zap size={16} color="#FFF" />
                    <Text style={s.demoBtnTxt}>{authProcessing ? 'Generating...' : 'Generate Demo Data'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 4 : 4}
          style={s.captureBarWrap}
        >
          {quickCaptureMode === 'buttons' ? (
            <View style={[s.captureBar, { justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 0, shadowColor: 'transparent', elevation: 0, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>
              <View
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.22,
                  shadowRadius: 12,
                  elevation: 16,
                  borderRadius: 27,
                }}
              >
                <LinearGradient
                  colors={['#007AFF', '#00C6FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    width: 190,
                    height: 54,
                    paddingHorizontal: 20,
                    borderRadius: 27,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setQuickCaptureMode('text')}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 }}
                    activeOpacity={0.85}
                  >
                    <Keyboard size={16} color="#FFF" strokeWidth={2.5} />
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>Text</Text>
                  </TouchableOpacity>

                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Plus size={14} color="#FFF" strokeWidth={3} />
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setQuickCaptureMode('voice');
                      void startVoice();
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 }}
                    activeOpacity={0.85}
                  >
                    <Mic size={16} color="#FFF" strokeWidth={2.5} />
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>Voice</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          ) : quickCaptureMode === 'text' ? (
            <View style={[s.captureBar, { justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 0, shadowColor: 'transparent', elevation: 0, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>
              <View
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.22,
                  shadowRadius: 12,
                  elevation: 16,
                  borderRadius: 27,
                }}
              >
                <LinearGradient
                  colors={['#007AFF', '#00C6FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: Math.min(320, windowWidth - 40),
                    height: 54,
                    paddingHorizontal: 16,
                    borderRadius: 27,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <Keyboard size={16} color="#FFF" style={{ marginRight: 6, opacity: 0.8 }} />
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#FFF',
                      paddingVertical: 4,
                    }}
                    placeholder="Record your thoughts..."
                    placeholderTextColor="rgba(255, 255, 255, 0.65)"
                    value={inputText}
                    onChangeText={setInputText}
                    autoFocus={true}
                    onSubmitEditing={() => {
                      if (!inputText.trim()) {
                        setQuickCaptureMode('buttons');
                        return;
                      }
                      void handleCreateCapsule(inputText);
                      setInputText('');
                      setQuickCaptureMode('buttons');
                    }}
                    returnKeyType="done"
                    editable={!isProcessing}
                    onBlur={() => {
                      if (!inputText.trim()) {
                        setQuickCaptureMode('buttons');
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={{ padding: 6 }}
                    onPress={() => {
                      setInputText('');
                      setQuickCaptureMode('buttons');
                    }}
                    hitSlop={8}
                  >
                    <X size={16} color="rgba(255, 255, 255, 0.8)" />
                  </TouchableOpacity>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFF" style={{ marginLeft: 4 }} />
                  ) : inputText.trim().length > 0 ? (
                    <TouchableOpacity
                      style={{ padding: 6, marginLeft: 4 }}
                      onPress={() => {
                        if (!inputText.trim()) return;
                        void handleCreateCapsule(inputText);
                        setInputText('');
                        setQuickCaptureMode('buttons');
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Check size={18} color="#FFF" strokeWidth={3} />
                    </TouchableOpacity>
                  ) : null}
                </LinearGradient>
              </View>
            </View>
          ) : (
            // quickCaptureMode === 'voice' 正在录音状态
            <View style={[s.captureBar, { justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 0, shadowColor: 'transparent', elevation: 0, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  void startVoice(); // 会停止录制并提交
                }}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.22,
                  shadowRadius: 12,
                  elevation: 16,
                  borderRadius: 27,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    backgroundColor: '#FF3B30',
                    width: 185,
                    height: 54,
                    borderRadius: 27,
                    paddingHorizontal: 15,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={s.waveDotBox}>
                      <View style={s.waveDot} />
                      <View style={[s.waveDot, { marginHorizontal: 3 }]} />
                      <View style={s.waveDot} />
                    </View>
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>Listening...</Text>
                  </View>
                  <Check size={18} color="#FFF" strokeWidth={3} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>

        {isSidebarOpen ? (
          <Pressable
            style={[s.sideOverlay, { left: sidebarWidth }]}
            onPress={() => setIsSidebarOpen(false)}
          />
        ) : null}
        <Animated.View
          pointerEvents={isSidebarOpen ? 'auto' : 'none'}
          style={[
            s.sidebar,
            { 
              width: sidebarWidth, 
              paddingTop: insets.top,
              transform: [{ translateX: sidebarAnim }] 
            },
          ]}
        >
          <View style={s.sideHead}>
            <View style={s.sideHeadLeft}>
              <View style={s.logoMini}>
                <AppLogo width={36} height={36} />
              </View>
              <Text style={s.sideBrandTitle}>Lumi Note</Text>
            </View>
            <TouchableOpacity onPress={() => setIsSidebarOpen(false)} style={s.sideCloseBtn} hitSlop={8}>
              <ChevronLeft size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={s.sideScroll}
            contentContainerStyle={s.sideScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing || isSyncing}
                onRefresh={onRefresh}
                tintColor="#007AFF"
                title={isSyncing || refreshing ? 'Syncing…' : 'Pull to sync'}
                titleColor="#8E8E93"
              />
            }
          >

            <View
              style={[
                s.sideNavPillWrap,
                filter === 'all' &&
                  categoryFilter === 'all' &&
                  tagFilter === null && {
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                  },
              ]}
            >
              <SidebarRow
                label="All"
                count={
                  capsules.filter((c) => !c.isArchived && !c.isDeleted).length
                }
                active={
                  filter === 'all' &&
                  categoryFilter === 'all' &&
                  tagFilter === null
                }
                icon="all"
                onPress={() => {
                  setFilter('all');
                  setCategoryFilter('all');
                  setTagFilter(null);
                  setIsSidebarOpen(false);
                }}
              />
            </View>

            <TouchableOpacity
              style={[
                s.sideSectionHead,
                isFilterSectionExpanded && {
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  marginBottom: 0,
                },
              ]}
              onPress={() => setIsFilterSectionExpanded(!isFilterSectionExpanded)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Filter size={20} color="#007AFF" strokeWidth={2.2} />
                <Text style={s.sideSectionTitle}>Filter</Text>
              </View>
              <ChevronDown
                size={18}
                color="#636366"
                style={{ transform: [{ rotate: isFilterSectionExpanded ? '0deg' : '-90deg' }] }}
              />
            </TouchableOpacity>

            {isFilterSectionExpanded && (
              <View style={{ backgroundColor: '#F9F9F9', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingBottom: 4, marginBottom: 10 }}>
                <SidebarRow
                  label="Note(s)"
                  count={
                    capsules.filter(
                      (c) =>
                        !c.isDeleted && !c.isArchived && !c.isTodo && !hasActiveReminder(c),
                    ).length
                  }
                  isSub
                  active={filter === 'pure-note'}
                  onPress={() => {
                    setFilter('pure-note');
                    setCategoryFilter('all');
                    setTagFilter(null);
                    setIsSidebarOpen(false);
                  }}
                />
                <SidebarRow
                  label="To-do"
                  count={capsules.filter(c => !c.isDeleted && !c.isArchived && c.isTodo && !c.completed).length}
                  isSub
                  active={filter === 'pending-todo'}
                  onPress={() => {
                    setFilter('pending-todo');
                    setCategoryFilter('all');
                    setTagFilter(null);
                    setIsSidebarOpen(false);
                  }}
                />
                <SidebarRow
                  label="Completed"
                  count={capsules.filter(c => !c.isDeleted && !c.isArchived && ((c.isTodo && c.completed) || hasFinishedOneShotReminder(c))).length}
                  isSub
                  active={filter === 'completed-todo'}
                  onPress={() => {
                    setFilter('completed-todo');
                    setCategoryFilter('all');
                    setTagFilter(null);
                    setIsSidebarOpen(false);
                  }}
                />
                <SidebarRow
                  label="Recurring"
                  count={capsules.filter(c => !c.isDeleted && !c.isArchived && hasRepeatReminder(c)).length}
                  isSub
                  active={filter === 'repeat-reminder'}
                  onPress={() => {
                    setFilter('repeat-reminder');
                    setCategoryFilter('all');
                    setTagFilter(null);
                    setIsSidebarOpen(false);
                  }}
                />
                <SidebarRow
                  label="Archived"
                  count={capsules.filter(c => c.isArchived && !c.isDeleted).length}
                  isSub
                  active={filter === 'archived'}
                  onPress={() => {
                    setFilter('archived');
                    setCategoryFilter('all');
                    setTagFilter(null);
                    setIsSidebarOpen(false);
                  }}
                />
                <SidebarRow
                  label="Trash"
                  count={capsules.filter(c => c.isDeleted).length}
                  isSub
                  active={filter === 'trash'}
                  onPress={() => {
                    setFilter('trash');
                    setCategoryFilter('all');
                    setTagFilter(null);
                    setIsSidebarOpen(false);
                  }}
                />
              </View>
            )}

            <View
              style={[
                s.sideNavPillWrap,
                filter === 'starred' && {
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                },
              ]}
            >
              <SidebarRow
                label="Starred"
                count={
                  capsules.filter(
                    (c) => c.isStarred && !c.isArchived && !c.isDeleted,
                  ).length
                }
                active={filter === 'starred'}
                icon="star"
                onPress={() => {
                  setFilter('starred');
                  setCategoryFilter('all');
                  setTagFilter(null);
                  setIsSidebarOpen(false);
                }}
              />
            </View>

            <TouchableOpacity
              style={s.sideSectionHead}
              onPress={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Folder size={20} color="#007AFF" strokeWidth={2.2} />
                <Text style={s.sideSectionTitle}>Categories</Text>
              </View>
              <ChevronDown
                size={18}
                color="#636366"
                style={{
                  transform: [{ rotate: isCategoriesExpanded ? '0deg' : '-90deg' }],
                }}
              />
            </TouchableOpacity>
            {isCategoriesExpanded &&
              allCategories.map((cat) => (
                <SidebarRow
                  key={cat}
                  label={cat}
                  count={categoryCounts.get(cat) || 0}
                  isSub
                  active={categoryFilter === cat && !tagFilter}
                  onPress={() => {
                    setCategoryFilter(cat);
                    setTagFilter(null);
                    if (filter === 'starred' || filter === 'archived' || filter === 'trash') setFilter('all');
                    setIsSidebarOpen(false);
                  }}
                />
              ))}
            <TouchableOpacity
              style={s.sideSectionHead}
              onPress={() => setIsTagsExpanded(!isTagsExpanded)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TagIcon size={20} color="#007AFF" strokeWidth={2.2} />
                <Text style={s.sideSectionTitle}>Tag</Text>
              </View>
              <ChevronDown
                size={18}
                color="#636366"
                style={{ transform: [{ rotate: isTagsExpanded ? '0deg' : '-90deg' }] }}
              />
            </TouchableOpacity>
            {isTagsExpanded &&
              allTags.map((t) => (
                <SidebarRow
                  key={t}
                  label={t}
                  count={sortedCapsules.filter((c) => c.tag === t || (!c.tag && c.tags?.includes(t))).length}
                  isSub
                  active={tagFilter === t}
                  onPress={() => {
                    setTagFilter(tagFilter === t ? null : t);
                    setCategoryFilter('all');
                    if (filter === 'starred' || filter === 'archived' || filter === 'trash') setFilter('all');
                    setIsSidebarOpen(false);
                  }}
                />
              ))}
            <View style={{ height: 16 }} />
            <View
              style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA', paddingTop: 8, marginTop: 4 }}
            >
              <SidebarRow
                label="Settings"
                icon="settings"
                count={0}
                active={false}
                onPress={() => {
                  setIsSidebarOpen(false);
                  setShowSettings(true);
                }}
              />
            </View>
          </ScrollView>
          <View style={[s.sideFooter, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={s.userCard}>
              {user?.photoURL ? (
                <Image source={{ uri: user?.photoURL }} style={s.userAvatar} />
              ) : (
                <View style={s.userAvatarPlaceholder}>
                  <UserIcon size={20} color="#FFF" />
                </View>
              )}
              <View style={s.userMeta}>
                <View style={s.userTitleRow}>
                  <Text style={s.userName} numberOfLines={1}>
                    {user?.displayName || (user ? 'User' : 'Guest')}
                  </Text>
                  {PAYWALL_ACTIVE && user?.isPremium ? (
                    <View style={s.userProBadge}>
                      <Text style={s.userProCrown}>👑</Text>
                      <Text style={s.userProTxt}>PRO</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={s.signOutRow}
                  onPress={() => {
                    setIsSidebarOpen(false);
                    if (!user) {
                      setIsGuestMode(false);
                      setShowAuthScreen(true);
                    } else {
                      void signOut(auth);
                    }
                  }}
                >
                  <LogOut size={12} color={user ? "#FF3B30" : "#007AFF"} />
                  <Text style={[s.signOutTxt, !user && { color: '#007AFF' }]}>
                    {user ? 'Sign Out' : 'Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        <Modal transparent visible={isFilterMenuOpen} animationType="fade">
          <View style={s.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, s.modalBackdrop]}
              onPress={() => setIsFilterMenuOpen(false)}
            />
            <View
              style={[StyleSheet.absoluteFillObject, s.modalFront]}
              pointerEvents="box-none"
            >
              <View style={[s.filterMenuBox, { top: filterMenuTop, right: 12 }]} pointerEvents="auto">
                {FILTER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={s.mItem}
                    onPress={() => {
                      setFilter(opt.value);
                      setCategoryFilter('all');
                      setTagFilter(null);
                      setIsFilterMenuOpen(false);
                    }}
                  >
                    <Text
                      style={[s.mItemTxt, filter === opt.value && { color: '#007AFF' }]}
                    >
                      {opt.label}
                    </Text>
                    {filter === opt.value ? <Check size={16} color="#007AFF" /> : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={!!activeMenuCapsule} animationType="fade">
          <Pressable
            style={[
              s.modalRoot,
              s.modalBackdrop,
              !menuPosition && s.modalFrontCenter,
            ]}
            onPress={closeNotesMenu}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={menuPosition ? menuStyle : { maxHeight: windowHeight * 0.85, width: menuSheetWidth }}
              contentContainerStyle={{ paddingBottom: 6 }}
            >
                <View style={[s.threeDotsBox, { width: menuPosition ? '100%' : menuSheetWidth }]}>
                  {activeMenuCapsule && !activeMenuCapsule.isDeleted ? (
                    <View style={{ paddingVertical: 4 }}>
                      {/* Cancel To-do / Set To-do */}
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (!activeMenuCapsule) return;
                          void updateCapsule(activeMenuCapsule.id, {
                            isTodo: !activeMenuCapsule.isTodo,
                          });
                          setActiveMenuCapsule(null);
                        }}
                      >
                        {activeMenuCapsule.isTodo ? (
                          <CheckSquare size={18} color="#007AFF" />
                        ) : (
                          <Square size={18} color="#8E8E93" />
                        )}
                        <Text style={s.mItemTxt}>
                          {activeMenuCapsule.isTodo ? 'Cancel To-do' : 'Set To-do'}
                        </Text>
                      </TouchableOpacity>

                      {/* Set Reminder */}
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (activeMenuCapsule) setReminderTarget(activeMenuCapsule);
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <Calendar size={18} color="#8E8E93" />
                        <Text style={s.mItemTxt}>Set Reminder</Text>
                      </TouchableOpacity>

                      {/* Change Color */}
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (activeMenuCapsule) {
                            setColorPickerCapsule(activeMenuCapsule);
                            setColorPickerHidePresets(false);
                          }
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <Palette size={18} color="#8E8E93" />
                        <Text style={s.mItemTxt}>Change Color</Text>
                      </TouchableOpacity>


                      {/* Star / Unstar */}
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (!activeMenuCapsule) return;
                          void updateCapsule(activeMenuCapsule.id, { isStarred: !activeMenuCapsule.isStarred });
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <Star
                          size={18}
                          color={activeMenuCapsule.isStarred ? '#FFB800' : '#8E8E93'}
                          fill={activeMenuCapsule.isStarred ? '#FFB800' : 'transparent'}
                        />
                        <Text style={s.mItemTxt}>
                          {activeMenuCapsule.isStarred ? 'Unstar' : 'Star'}
                        </Text>
                      </TouchableOpacity>

                      {/* Pin / Unpin */}
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (!activeMenuCapsule) return;
                          void updateCapsule(activeMenuCapsule.id, { isPinned: !activeMenuCapsule.isPinned });
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <Pin
                          size={18}
                          color={activeMenuCapsule.isPinned ? '#007AFF' : '#8E8E93'}
                          fill={activeMenuCapsule.isPinned ? '#007AFF' : 'transparent'}
                          style={{ transform: [{ rotate: '45deg' }] }}
                        />
                        <Text style={s.mItemTxt}>
                          {activeMenuCapsule.isPinned ? 'Unpin' : 'Pin'}
                        </Text>
                      </TouchableOpacity>

                      {/* Share */}
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={async () => {
                          if (!activeMenuCapsule) return;
                          const shareText = plainTextFromContent(activeMenuCapsule.content);
                          try {
                            await Share.share({
                              message: shareText,
                            });
                          } catch (err) {
                            console.warn('Share error:', err);
                          }
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <ShareIcon size={18} color="#8E8E93" />
                        <Text style={s.mItemTxt}>Share</Text>
                      </TouchableOpacity>
                      <View style={s.menuHairline} />
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={closeNotesMenu}
                      >
                        <X size={18} color="#8E8E93" />
                        <Text style={[s.mItemTxt, { color: '#8E8E93' }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : activeMenuCapsule?.isDeleted ? (
                    <View style={{ paddingVertical: 4 }}>
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (!activeMenuCapsule) return;
                          void updateCapsule(activeMenuCapsule.id, { isDeleted: false });
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <RotateCcw size={18} color="#1D1D1F" />
                        <Text style={s.mItemTxt}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (!activeMenuCapsule) return;
                          void removeCapsuleForever(activeMenuCapsule.id);
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <Trash2 size={18} color="#FF3B30" />
                        <Text style={[s.mItemTxt, { color: '#FF3B30' }]}>Delete Forever</Text>
                      </TouchableOpacity>
                      <View style={s.menuHairline} />
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={closeNotesMenu}
                      >
                        <X size={18} color="#8E8E93" />
                        <Text style={[s.mItemTxt, { color: '#8E8E93' }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
            </ScrollView>
          </Pressable>
        </Modal>

        <Modal transparent visible={!!colorPickerCapsule} animationType="fade">
          <View style={s.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, s.modalBackdrop]}
              onPress={() => setColorPickerCapsule(null)}
            />
            <View
              style={[StyleSheet.absoluteFillObject, s.modalFrontCenter]}
              pointerEvents="box-none"
            >
              <View style={{ width: Math.min(340, menuSheetWidth) }} pointerEvents="auto">
                {colorPickerCapsule ? (
                  <CapsuleColorSheet
                    capsule={colorPickerCapsule}
                    hidePresets={colorPickerHidePresets}
                    onSelectPreset={(hex) => {
                      void updateCapsule(colorPickerCapsule.id, { color: hex });
                      setColorPickerCapsule(null);
                    }}
                    onReset={() => {
                      void updateCapsule(colorPickerCapsule.id, { color: undefined });
                      setColorPickerCapsule(null);
                    }}
                    onCustomColor={(hex) => {
                      void updateCapsule(colorPickerCapsule.id, { color: hex });
                    }}
                    onClose={() => setColorPickerCapsule(null)}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={!!reminderTarget} animationType="fade">
          <View style={s.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, s.modalBackdropStrong]}
              onPress={() => setReminderTarget(null)}
            />
            <View
              style={[StyleSheet.absoluteFillObject, s.modalFrontCenter]}
              pointerEvents="box-none"
            >
              <View style={{ width: Math.min(400, windowWidth - 32) }} pointerEvents="auto">
                {reminderTarget ? (
                  <CapsuleReminderSheet
                    capsule={reminderTarget}
                    onClose={() => setReminderTarget(null)}
                    onSave={(r) => {
                      void updateCapsule(reminderTarget.id, { reminder: r });
                    }}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={batchColorMultiOpen && selectedIds.length > 0} animationType="fade">
          <View style={s.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, s.modalBackdropStrong]}
              onPress={() => setBatchColorMultiOpen(false)}
            />
            <View
              style={[StyleSheet.absoluteFillObject, s.modalFrontCenter]}
              pointerEvents="box-none"
            >
              <View style={{ width: Math.min(340, windowWidth - 32) }} pointerEvents="auto">
                {firstSelectedCapsule ? (
                  <CapsuleColorSheet
                    capsule={firstSelectedCapsule}
                    onSelectPreset={(hex) => {
                      void batchUpdate({ color: hex });
                      setBatchColorMultiOpen(false);
                    }}
                    onReset={() => {
                      void batchUpdate({ color: undefined });
                      setBatchColorMultiOpen(false);
                    }}
                    onCustomColor={(hex) => {
                      void batchUpdate({ color: hex });
                      setBatchColorMultiOpen(false);
                    }}
                    onClose={() => setBatchColorMultiOpen(false)}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={batchReminderMultiOpen && selectedIds.length > 0} animationType="fade">
          <View style={s.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, s.modalBackdropStrong]}
              onPress={() => setBatchReminderMultiOpen(false)}
            />
            <View
              style={[StyleSheet.absoluteFillObject, s.modalFrontCenter]}
              pointerEvents="box-none"
            >
              <View style={{ width: Math.min(400, windowWidth - 32) }} pointerEvents="auto">
                {firstSelectedCapsule ? (
                  <CapsuleReminderSheet
                    capsule={firstSelectedCapsule}
                    onClose={() => setBatchReminderMultiOpen(false)}
                    onSave={(r) => {
                      void batchUpdate({ reminder: r });
                      setBatchReminderMultiOpen(false);
                    }}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={batchTagCatOpen && selectedIds.length > 0} animationType="fade">
          <View style={s.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, s.modalBackdropStrong]}
              onPress={() => setBatchTagCatOpen(false)}
            />
            <View
              style={[StyleSheet.absoluteFillObject, s.modalFrontCenter]}
              pointerEvents="box-none"
            >
              <View style={{ width: Math.min(360, windowWidth - 32) }} pointerEvents="auto">
                <View style={s.colorSheet}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#1D1D1F' }}>
                      Category & Tag ({selectedIds.length} notes)
                    </Text>
                    <TouchableOpacity onPress={() => setBatchTagCatOpen(false)} hitSlop={12}>
                      <X size={20} color="#1D1D1F" />
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 12 }}>
                    <View style={{ flex: 0 }}>
                      <Text style={s.editFieldLbl}>Category</Text>
                      <TextInput
                        style={s.editFieldIn}
                        placeholder="e.g. Work, Ideas"
                        placeholderTextColor="#8E8E93"
                        value={batchCategory}
                        onChangeText={setBatchCategory}
                      />
                    </View>
                    <View style={{ flex: 0 }}>
                      <Text style={s.editFieldLbl}>Tag</Text>
                      <TextInput
                        style={s.editFieldIn}
                        placeholder="Tag"
                        placeholderTextColor="#8E8E93"
                        value={batchTag}
                        onChangeText={(t) => setBatchTag(t.replace(/,/g, ''))}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[s.primaryBtn, { marginTop: 20 }]}
                    onPress={() => {
                      const cat = batchCategory.trim();
                      const tagVal = batchTag.trim();
                      void batchUpdate({
                        category: cat || undefined,
                        tag: tagVal || undefined,
                      });
                      setBatchTagCatOpen(false);
                      setIsMultiSelectMode(false);
                      setSelectedIds([]);
                    }}
                  >
                    <Text style={s.primaryBtnTxt}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {isMultiSelectMode ? (
          <View style={s.sideMenuFloating}>
            <View style={s.sideMenuHead}>
              <Text style={s.sideMenuTitle}>{selectedIds.length} Selected</Text>
            </View>
            
            <TouchableOpacity
              style={s.mItem}
              onPress={() =>
                allFilteredSelected
                  ? setSelectedIds([])
                  : setSelectedIds(filteredCapsules.map((c) => c.id))
              }
            >
              <CheckSquare size={18} color="#007AFF" />
              <Text style={[s.mItemTxt, { color: '#007AFF' }]}>
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>

            {filter !== 'archived' && filter !== 'trash' ? (
              <>
                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    const first = capsules.find((c) => selectedIds.includes(c.id));
                    setBatchCategory(first?.category || '');
                    setBatchTag(first ? (first.tag || (first.tags && first.tags.length > 0 ? first.tags[0] : '')) : '');
                    setBatchTagCatOpen(true);
                  }}
                >
                  <TagIcon size={18} color="#007AFF" />
                  <Text style={[s.mItemTxt, { color: '#007AFF' }]}>Category & Tag</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    void batchUpdate({ isArchived: true });
                    setIsMultiSelectMode(false);
                    setSelectedIds([]);
                  }}
                >
                  <Archive size={18} color="#8E8E93" />
                  <Text style={s.mItemTxt}>Archive</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    void batchUpdate({ isDeleted: true });
                    setIsMultiSelectMode(false);
                    setSelectedIds([]);
                  }}
                >
                  <Trash2 size={18} color="#FF3B30" />
                  <Text style={[s.mItemTxt, { color: '#FF3B30' }]}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    void handleShareMultiple();
                    setIsMultiSelectMode(false);
                    setSelectedIds([]);
                  }}
                >
                  <ShareIcon size={18} color="#007AFF" />
                  <Text style={[s.mItemTxt, { color: '#007AFF' }]}>Share</Text>
                </TouchableOpacity>
              </>
            ) : filter === 'archived' ? (
              <>
                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    void batchUpdate({ isArchived: false });
                    setIsMultiSelectMode(false);
                    setSelectedIds([]);
                  }}
                >
                  <RotateCcw size={18} color="#4CAF50" />
                  <Text style={[s.mItemTxt, { color: '#4CAF50' }]}>Restore</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    void batchUpdate({ isDeleted: true });
                    setIsMultiSelectMode(false);
                    setSelectedIds([]);
                  }}
                >
                  <Trash2 size={18} color="#FF3B30" />
                  <Text style={[s.mItemTxt, { color: '#FF3B30' }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : filter === 'trash' ? (
              <>
                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    void batchUpdate({ isDeleted: false });
                    setIsMultiSelectMode(false);
                    setSelectedIds([]);
                  }}
                >
                  <RotateCcw size={18} color="#4CAF50" />
                  <Text style={[s.mItemTxt, { color: '#4CAF50' }]}>Restore</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    Alert.alert(
                      'Delete Forever',
                      'Are you sure you want to permanently delete the selected notes? This cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete Forever',
                          style: 'destructive',
                          onPress: () => {
                            void batchRemovePermanently();
                            setIsMultiSelectMode(false);
                            setSelectedIds([]);
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Trash2 size={18} color="#FF3B30" />
                  <Text style={[s.mItemTxt, { color: '#FF3B30' }]}>Delete Forever</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.mItem}
              onPress={() => {
                setIsMultiSelectMode(false);
                setSelectedIds([]);
              }}
            >
              <X size={18} color="#8E8E93" />
              <Text style={s.mItemTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <SettingsModalMobile
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          user={user}
          onUpgrade={() => {
            setShowPremiumModal(true);
          }}
          onDowngrade={handleDowngrade}
          settings={settings}
          onUpdateSettings={updateSettings}
        />

        <PremiumModalMobile
          visible={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          user={user}
          onSuccess={handlePremiumSuccess}
        />

        <Modal transparent visible={!!editingCapsule} animationType="fade">
          <View style={{ flex: 1, backgroundColor: '#FFF' }}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 15 : 0}
              style={s.editKeyboardWrap}
            >
              <Pressable
                style={[StyleSheet.absoluteFillObject, s.editBackdropTint]}
                onPress={saveEdit}
              />
              <View
                style={[
                  s.editBoxCenter,
                  {
                    justifyContent: 'flex-start',
                    paddingTop: insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 20 : 10),
                    paddingBottom: isKeyboardActive ? 0 : Math.max(insets.bottom, 8),
                  }
                ]}
              >
                <View style={[
                  s.editBox,
                  {
                    width: '100%',
                    borderRadius: 0,
                    minHeight: '100%',
                    maxHeight: '100%',
                    elevation: 0,
                    shadowOpacity: 0,
                  }
                ]}>
                  <View style={s.editHeader}>
                    <View style={s.editHeaderLeft}>
                      {/* Color dot indicator — 点击可直接在下方展开 Preset 颜色面板 */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowLocalColors(!showLocalColors)}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        style={[
                          s.editColorDot,
                          { backgroundColor: editingCapsule?.color || '#FFB900' },
                        ]}
                      />
                      {/* Note Title Input */}
                      <TextInput
                        style={s.editTitleInput}
                        value={editSubjectDraft}
                        onChangeText={setEditSubjectDraft}
                        placeholder="Note Title"
                        placeholderTextColor="#C7C7CC"
                        returnKeyType="done"
                        onBlur={saveEditSilent}
                      />
                    </View>
                    <TouchableOpacity onPress={saveEdit} style={s.editCloseBtn}>
                      <X size={20} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>

                  {/* 详情页内嵌调色栏：极其小巧、避免双 Modal 冲突 */}
                  {showLocalColors && (
                    <View style={{
                      flexDirection: 'row',
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      backgroundColor: '#F2F2F7',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: '#E5E5EA',
                    }}>
                      {PRESET_COLORS.map(c => (
                        <TouchableOpacity
                          key={c}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: c,
                            borderWidth: (editingCapsule?.color || '#FFB900') === c ? 2 : 0,
                            borderColor: '#007AFF',
                          }}
                          onPress={() => {
                            if (editingCapsule) {
                              void updateCapsule(editingCapsule.id, { color: c });
                              setEditingCapsule({ ...editingCapsule, color: c });
                              showToast('Color updated', 'success');
                            }
                            setShowLocalColors(false);
                          }}
                        />
                      ))}
                      <TouchableOpacity
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: '#FFF',
                          borderWidth: 1,
                          borderColor: '#E5E5EA',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => {
                          if (editingCapsule) {
                            setColorPickerCapsule(editingCapsule);
                            setColorPickerHidePresets(true);
                          }
                          setShowLocalColors(false);
                        }}
                      >
                        <Text style={{ fontSize: 11 }}>🎨</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: '#FFF',
                          borderWidth: 1,
                          borderColor: '#E5E5EA',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => {
                          if (editingCapsule) {
                            void updateCapsule(editingCapsule.id, { color: undefined });
                            setEditingCapsule({ ...editingCapsule, color: undefined });
                            showToast('Color reset', 'success');
                          }
                          setShowLocalColors(false);
                        }}
                      >
                        <X size={12} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                  )}

                {/* Plain / Markdown switcher — Aligned with Web */}
                <View style={s.editModeTabWrap}>
                  <View style={s.editModeTabs}>
                    <TouchableOpacity
                      style={[s.editModeTab, editMode === 'plain' && s.editModeTabActive]}
                      onPress={() => setEditMode('plain')}
                    >
                      <Text style={[s.editModeTabTxt, editMode === 'plain' && s.editModeTabTxtActive]}>Plain</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.editModeTab, editMode === 'markdown' && s.editModeTabActive]}
                      onPress={() => setEditMode('markdown')}
                    >
                      <Text style={[s.editModeTabTxt, editMode === 'markdown' && s.editModeTabTxtActive]}>Markdown</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flex: 1, backgroundColor: '#FFFBE6' }}>
                  <CapsuleEditorMobile
                    key={editingCapsule?.id || 'new'}
                    content={editContent}
                    onChange={(json) => setEditContent(json)}
                    placeholder="Type your brilliant thought here..."
                    autoFocus
                    editMode={editMode}
                    isMetaFocused={isMetaFocused}
                    attachments={editMode === 'plain' ? editingCapsule?.attachments : undefined}
                    onRemoveAttachment={editMode === 'plain' ? removeAttachmentAt : undefined}
                  />
                </View>

                {/* 并排紧凑的 Category & Tags —— 紧靠在 Done 按钮之上，背景保持一致的纯白色以形成悬浮纸卡质感 */}
                <View style={{
                  flexDirection: 'row',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: '#FFF',
                  gap: 12,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.editFieldLbl, { fontSize: 10, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }]}>Category</Text>
                    <TextInput
                      style={[s.editFieldIn, { height: 36, paddingVertical: 0, paddingHorizontal: 10, fontSize: 13, backgroundColor: '#F2F2F7', borderColor: 'transparent', borderRadius: 8 }]}
                      placeholder="Category"
                      placeholderTextColor="#8E8E93"
                      value={editCategoryDraft}
                      onChangeText={setEditCategoryDraft}
                      onFocus={() => setIsMetaFocused(true)}
                      onBlur={() => {
                        setIsMetaFocused(false);
                        saveEditSilent();
                      }}
                    />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Text style={[s.editFieldLbl, { fontSize: 10, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }]}>Tag</Text>
                    <TextInput
                      style={[s.editFieldIn, { height: 36, paddingVertical: 0, paddingHorizontal: 10, fontSize: 13, backgroundColor: '#F2F2F7', borderColor: 'transparent', borderRadius: 8 }]}
                      placeholder="Tag"
                      placeholderTextColor="#8E8E93"
                      value={editTagDraft}
                      onChangeText={(t) => setEditTagDraft(t.replace(/,/g, ''))}
                      onFocus={() => setIsMetaFocused(true)}
                      onBlur={() => {
                        setIsMetaFocused(false);
                        saveEditSilent();
                      }}
                    />
                  </View>
                </View>

                <View style={[s.editFooter, { backgroundColor: '#FFF' }]}>
                  <TouchableOpacity
                    onPress={() => editingCapsule && pickImageForCapsule(editingCapsule)}
                    style={{ padding: 8 }}
                  >
                    <ImageIcon size={22} color="#8E8E93" />
                  </TouchableOpacity>

                  <View style={{ flex: 1, paddingHorizontal: 12, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} color="#AEAEB2" />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: '#AEAEB2',
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                        }}
                      >
                        Created: {editingCapsule ? formatNoteDateTime(editingCapsule.createdAt) : ''}
                      </Text>
                    </View>
                    {editingCapsule?.reminder && editingCapsule.reminder.type !== 'none' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Bell size={10} color="#007AFF" strokeWidth={2.5} />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '800',
                            color: '#007AFF',
                            textTransform: 'uppercase',
                            letterSpacing: 0.3,
                          }}
                        >
                          Reminder: {formatNoteDateTime(editingCapsule.reminder.date)} (
                          {repeatLabelForMenu(editingCapsule.reminder)})
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity style={[s.doneBtnBlack, { borderRadius: 18, paddingHorizontal: 22 }]} onPress={saveEdit}>
                    <Text style={{ color: '#FFF', fontWeight: '800' }}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal transparent visible={isSortMenuOpen} animationType="fade">
          <View style={s.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, s.modalBackdrop]}
              onPress={() => setIsSortMenuOpen(false)}
            />
            <View
              style={[StyleSheet.absoluteFillObject, s.modalFrontCenter]}
              pointerEvents="box-none"
            >
              <View style={[s.threeDotsBox, { width: 200 }]} pointerEvents="auto">
                <View style={[s.menuSec, s.menuSecTightTop]}>
                  <Text style={s.menuSecTxt}>SORT BY</Text>
                </View>
                <TouchableOpacity
                  style={[s.mItem, sortBy === 'updatedAt' && { backgroundColor: 'rgba(0,122,255,0.06)' }]}
                  onPress={() => setSortBy('updatedAt')}
                >
                  <Text style={[s.mItemTxt, sortBy === 'updatedAt' && { color: '#007AFF', fontWeight: '800' }]}>Modified Time</Text>
                  {sortBy === 'updatedAt' && <ArrowDown size={16} color="#007AFF" />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.mItem, sortBy === 'createdAt' && { backgroundColor: 'rgba(0,122,255,0.06)' }]}
                  onPress={() => setSortBy('createdAt')}
                >
                  <Text style={[s.mItemTxt, sortBy === 'createdAt' && { color: '#007AFF', fontWeight: '800' }]}>Creation Time</Text>
                  {sortBy === 'createdAt' && <ArrowDown size={16} color="#007AFF" />}
                </TouchableOpacity>

                <View style={s.menuDivider} />

                <View style={s.menuSec}>
                  <Text style={s.menuSecTxt}>ORDER</Text>
                </View>
                <TouchableOpacity
                  style={[s.mItem, sortOrder === 'desc' && { backgroundColor: 'rgba(0,122,255,0.06)' }]}
                  onPress={() => setSortOrder('desc')}
                >
                  <Text style={[s.mItemTxt, sortOrder === 'desc' && { color: '#007AFF', fontWeight: '800' }]}>Newest First</Text>
                  {sortOrder === 'desc' && <Check size={16} color="#007AFF" />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.mItem, sortOrder === 'asc' && { backgroundColor: 'rgba(0,122,255,0.06)' }]}
                  onPress={() => setSortOrder('asc')}
                >
                  <Text style={[s.mItemTxt, sortOrder === 'asc' && { color: '#007AFF', fontWeight: '800' }]}>Oldest First</Text>
                  {sortOrder === 'asc' && <Check size={16} color="#007AFF" />}
                </TouchableOpacity>
                
                <View style={s.menuDivider} />
                <TouchableOpacity
                  style={[s.mItem, { justifyContent: 'center', backgroundColor: '#F2F2F7', borderRadius: 12, marginTop: 4 }]}
                  onPress={() => setIsSortMenuOpen(false)}
                >
                  <Text style={{ fontWeight: '800', color: '#007AFF' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <QuickCaptureModal
          visible={showQuickCapture}
          onClose={() => setShowQuickCapture(false)}
          capsules={capsules}
          onCreateCapsule={handleCreateCapsule}
          onToggleTodo={(id, completed) => updateCapsule(id, { completed })}
          isProcessing={isProcessing}
          isVoiceRecording={isVoiceRecording}
          startVoice={startVoice}
          limit={settings.quickCaptureLimit}
        />

        {/* Android Edge Panel — global floating side bar for quick capture */}
        {Platform.OS === 'android' && settings.edgePanelEnabled && (
          <EdgeMiniPanel
            capsules={capsules}
            onCreateCapsule={handleCreateCapsule}
            onToggleTodo={(id, completed) => updateCapsule(id, { completed })}
            onSelectCapsule={(capsule) => {
              setEditingCapsule(capsule);
              setEditContent(capsule.content);
              setEditSubjectDraft(capsule.subject || '');
              setEditCategoryDraft(capsule.category || '');
              setEditTagDraft(capsule.tag || (capsule.tags && capsule.tags.length > 0 ? capsule.tags[0] : ''));
            }}
            isProcessing={isProcessing}
            isVoiceRecording={isVoiceRecording}
            startVoice={startVoice}
            limit={settings.quickCaptureLimit}
          />
        )}

        {/* Floating Toast Notification */}
        {toastMessage && (
          <View style={s.toastWrapper} pointerEvents="none">
            <View style={s.toastContainer}>
              {toastType === 'info' && (
                <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 6 }} />
              )}
              {toastType === 'success' && (
                <Check size={14} color="#34C759" style={{ marginRight: 6 }} />
              )}
              <Text style={s.toastText}>{toastMessage}</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function SwipeableCardWrapper({
  item,
  renderLeftActions,
  renderRightActions,
  onSwipeTrigger,
  children,
}: {
  item: Capsule;
  renderLeftActions: (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => React.ReactNode;
  renderRightActions: (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => React.ReactNode;
  onSwipeTrigger: (direction: 'left' | 'right') => void;
  children: React.ReactNode;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const handleSwipeOpen = (direction: 'left' | 'right') => {
    onSwipeTrigger(direction);
    // 动作触发后自动回弹关闭滑块
    setTimeout(() => {
      swipeRef.current?.close();
    }, 100);
  };

  return (
    <Swipeable
      ref={swipeRef}
      activeOffsetX={[-15, 15]}
      containerStyle={{ width: '100%' }}
      childrenContainerStyle={{ width: '100%' }}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableLeftOpen={() => handleSwipeOpen('left')}
      onSwipeableRightOpen={() => handleSwipeOpen('right')}
      onSwipeableWillOpen={() => {
        // 在即将滑开的物理临界点触发清脆轻微的原生震动反馈
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      friction={1.5}
      leftThreshold={80}
      rightThreshold={80}
    >
      {children}
    </Swipeable>
  );
}

function CapsuleCard({
  item,
  isGrid,
  isSelected,
  isMulti,
  onPress,
  onLongPress,
  onMenu,
  onToggleTodo,
}: {
  item: Capsule;
  isGrid: boolean;
  isSelected: boolean;
  isMulti: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMenu: (e: any) => void;
  onToggleTodo: () => void;
}) {
  if (isGrid) {
    const currentTag = item.tag || (item.tags && item.tags.length > 0 ? item.tags[0] : undefined);
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onLongPress={onLongPress}
        style={[
          s.cardGrid,
          s.cardGridFill,
          { backgroundColor: item.color || PRESET_COLORS[0], position: 'relative' as const, flexDirection: 'column' },
          isSelected && { borderWidth: 2, borderColor: '#007AFF' },
        ]}
      >
        {/* 顶部：正文 / 标题文字 */}
        <View style={{ flex: 1, width: '100%', minWidth: 0 }}>
          <Text
            style={[
              s.cardText,
              item.isTodo && item.completed ? s.cardTextDone : null,
              { fontWeight: '700', fontSize: 13, lineHeight: 17 },
            ]}
            numberOfLines={4}
            ellipsizeMode="tail"
          >
            {item.subject ? item.subject : plainTextFromContent(item.content)}
          </Text>
        </View>

        {/* 底部：一整行，包含左下角待办和底部的 category、tag、时间 */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: 'auto', width: '100%', minHeight: 32, paddingRight: 32 }}>
          {/* 左下角待办方块 */}
          {item.isTodo ? (
            <View style={{ paddingBottom: 2, marginRight: 8 }}>
              <TouchableOpacity
                style={[s.checkOuter, item.completed && s.checkOuterDone]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onToggleTodo();
                }}
              >
                {item.completed ? <Check size={11} color="rgba(0,0,0,0.62)" strokeWidth={3} /> : null}
              </TouchableOpacity>
            </View>
          ) : null}

          {/* 待办方块右边：Category, Tag 以及创建时间 */}
          <View style={{ alignItems: 'flex-start', gap: 3, flex: 1 }}>
            {/* Category & Tag Row */}
            {(item.category || currentTag) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-start' }}>
                {item.category ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 8, fontWeight: '900', letterSpacing: 0.2 }}>
                      {item.category.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                {currentTag ? (
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 8, fontWeight: '900' }}>
                      #{currentTag}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Date Row */}
            {item.createdAt ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: 0.65 }}>
                <Clock size={8} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase' }}>
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 绝对定位角标：星标、置顶（右上角） */}
        {(item.isStarred || item.isPinned) && (
          <View style={{ position: 'absolute', top: 6, right: isMulti ? 6 : 28, flexDirection: 'row', gap: 3, zIndex: 3 }}>
            {item.isPinned && <Pin size={10} color="rgba(255,255,255,0.9)" />}
            {item.isStarred && <Star size={10} color="#FFD60A" fill="#FFD60A" />}
          </View>
        )}

        {/* 绝对定位角标：提醒铃铛 */}
        {hasActiveReminder(item) ? (
          <View style={{ position: 'absolute', bottom: 12, right: isMulti ? 8 : 28, zIndex: 3 }} pointerEvents="none">
            <Bell size={10} color="rgba(255,255,255,0.95)" strokeWidth={2.5} />
          </View>
        ) : null}

        {/* 绝对定位角标：三点菜单（右下角） */}
        {!isMulti ? (
          <View style={{ position: 'absolute', bottom: 10, right: 8, zIndex: 3 }}>
            <TouchableOpacity
              onPress={(e) => {
                (e as { stopPropagation?: () => void }).stopPropagation?.();
                onMenu(e);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreVertical size={14} color="#FFF" style={{ opacity: 0.6 }} />
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        s.cardList,
        { backgroundColor: item.color || PRESET_COLORS[0], position: 'relative' as const },
        isSelected && { borderWidth: 2, borderColor: '#007AFF' },
      ]}
    >
      {item.isTodo ? (
        <View style={s.cardCheckCol}>
          <TouchableOpacity
            style={[s.checkOuter, item.completed && s.checkOuterDone]}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleTodo();
            }}
          >
            {item.completed ? <Check size={11} color="rgba(0,0,0,0.62)" strokeWidth={3} /> : null}
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={s.cardBody}>
        <View style={s.cardHeaderRow}>
          <Text
            style={[
              s.cardText,
              item.isTodo && item.completed ? s.cardTextDone : null,
              { fontWeight: '700', fontSize: 14 },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.subject ? item.subject : plainTextFromContent(item.content)}
          </Text>
        </View>

        {/* Category & Tags Row */}
        {(() => {
          const currentTag = item.tag || (item.tags && item.tags.length > 0 ? item.tags[0] : undefined);
          if (!item.category && !currentTag) return null;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
              {item.category ? (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: '900', letterSpacing: 0.3 }}>
                    {item.category.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {currentTag ? (
                <View key={currentTag} style={{ backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '900' }}>
                    #{currentTag}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })()}

        {/* Date Row */}
        {item.createdAt ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, opacity: 0.65 }}>
            <Clock size={9} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {new Date(item.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        ) : null}
      </View>
      {/* Star & Pin badges — top-right, aligned with PC Web */}
      {(item.isStarred || item.isPinned) && (
        <View style={{ position: 'absolute', top: 5, right: isMulti ? 5 : 36, flexDirection: 'row', gap: 3, zIndex: 3 }}>
          {item.isPinned && <Pin size={10} color="rgba(255,255,255,0.9)" />}
          {item.isStarred && <Star size={10} color="#FFD60A" fill="#FFD60A" />}
        </View>
      )}
      {/* Reminder bell — bottom-right corner */}
      {hasActiveReminder(item) ? (
        <View style={s.cardBellCorner} pointerEvents="none">
          <Bell size={10} color="rgba(255,255,255,0.95)" strokeWidth={2.5} />
        </View>
      ) : null}
      {!isMulti ? (
        <View style={s.cardMenuCol}>
          <TouchableOpacity
            onPress={(e) => {
              (e as { stopPropagation?: () => void }).stopPropagation?.();
              onMenu(e);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={18} color="#FFF" style={{ opacity: 0.6 }} />
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function SidebarRow({
  label,
  count,
  active,
  isSub,
  onPress,
  icon,
}: {
  label: string;
  count: number;
  active?: boolean;
  isSub?: boolean;
  onPress: () => void;
  icon?: 'star' | 'all' | 'settings';
}) {
  return (
    <TouchableOpacity
      style={[s.sideRow, active && s.sideActive]}
      onPress={onPress}
    >
      {icon === 'star' ? (
        <Star
          size={18}
          color="#007AFF"
          fill="transparent"
          strokeWidth={2.2}
          style={{ marginRight: 10 }}
        />
      ) : icon === 'all' ? (
        <Layers
          size={18}
          color="#007AFF"
          strokeWidth={2.2}
          style={{ marginRight: 10 }}
        />
      ) : icon === 'settings' ? (
        <SettingsIcon
          size={18}
          color="#007AFF"
          strokeWidth={2.2}
          style={{ marginRight: 10 }}
        />
      ) : (
        <View
          style={[
            s.mark,
            active
              ? { backgroundColor: '#FFF' }
              : { backgroundColor: '#8E8E93', opacity: 0.3 },
          ]}
        />
      )}
      <Text
        style={[
          s.sideLabel,
          icon ? s.sideLabelPrimary : null,
          active && { color: '#FFF' },
        ]}
      >
        {label}
      </Text>
      {count > 0 && (
        <Text style={[s.sideCount, active && { color: '#FFF' }]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  swipeLeftAction: {
    backgroundColor: '#34C759',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingLeft: 24,
    height: '100%',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  swipeRightAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 24,
    height: '100%',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  swipeActionTxt: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  landingRoot: { flex: 1, backgroundColor: '#FFF' },
  landingInner: { flex: 1, padding: 32, justifyContent: 'center' },
  logoBoxL: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  landingTitle: { fontSize: 32, fontWeight: '900', color: '#1D1D1F' },
  landingSub: { fontSize: 15, color: '#8E8E93', marginTop: 12, marginBottom: 32, lineHeight: 22 },
  authRoot: { flex: 1, backgroundColor: '#FFF' },
  backFab: {
    position: 'absolute',
    top: 8,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authScroll: { paddingHorizontal: 28, paddingTop: 90, paddingBottom: 24 },
  authH: { fontSize: 26, fontWeight: '900', color: '#1D1D1F' },
  authHint: { color: '#8E8E93', marginTop: 6, marginBottom: 12, fontWeight: '600' },
  label: { fontSize: 10, fontWeight: '900', color: '#8E8E93', letterSpacing: 1.2, marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 10,
  },
  input: { flex: 1, height: 42, fontSize: 15, fontWeight: '600' },
  errTxt: { color: '#FF3B30', fontSize: 13, fontWeight: '600', marginTop: 8 },
  dividerLabel: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
    fontSize: 10,
    fontWeight: '900',
    color: '#8E8E93',
    letterSpacing: 1.5,
  },
  socialRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  socialBtn: {
    width: 56,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  safeMain: {
    flex: 1,
    ...Platform.select({
      web: {
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      },
      default: {},
    }),
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#FFF',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1D1D1F',
    letterSpacing: -0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    ...Platform.select({
      web: {
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      },
      default: {},
    }),
  },
  searchWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchIn: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#1D1D1F',
    paddingVertical: 10,
  },
  filterPillInline: {
    flexShrink: 1,
    minWidth: 72,
    maxWidth: 118,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterPillInlineTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D1D1F',
    flexShrink: 1,
  },
  iconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  headerIconHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarOpenBtnWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  sidebarScopeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  sideCloseBtn: {
    padding: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 999,
    marginRight: -4,
  },
  sideHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sidebarScopeDotSide: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  filterPillInlineMuted: {
    backgroundColor: '#E9E9ED',
    borderColor: '#D8D8DC',
  },
  filterPillInlineTxtMuted: {
    color: '#8E8E93',
  },
  scrollFill: {
    flex: 1,
    ...Platform.select({
      web: { width: '100%', minWidth: 0 },
      default: {},
    }),
  },
  scrollBody: {
    paddingHorizontal: 8,
    paddingTop: 2,
    flexGrow: 1,
    ...Platform.select({
      web: { width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' },
      default: {},
    }),
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
    ...Platform.select({
      web: { width: '100%', maxWidth: '100%', minWidth: 0 },
      default: {},
    }),
  },
  listCol: {
    flexDirection: 'column',
    ...Platform.select({
      web: { width: '100%', maxWidth: '100%', minWidth: 0 },
      default: {},
    }),
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 20,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  demoBtnTxt: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cardWrapList: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardWrapGrid: {
    position: 'relative',
    marginBottom: 8,
  },
  cardGrid: {
    aspectRatio: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
    elevation: 4,
    overflow: 'hidden',
  },
  cardGridFill: { width: '100%', alignSelf: 'stretch' },
  cardList: {
    flex: 1,
    width: '100%',
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  cardCheckCol: {
    width: 32,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingLeft: 4,
    paddingRight: 6,
  },
  cardMenuCol: {
    width: 36,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOuter: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOuterDone: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(255,255,255,0.92)',
  },
  cardText: {
    color: 'rgba(255,255,255,0.96)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
  },
  cardTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.72,
  },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    minHeight: 14,
  },
  cardBellCorner: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    zIndex: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '72%',
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF' },
  badgeTxt: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 9,
    fontWeight: '800',
    flexShrink: 1,
  },
  pillTag: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    marginLeft: 6,
  },
  pillTagLeft: {
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  pillTagRight: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.1)',
  },
  pillTagTxt: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 8,
    fontWeight: '900',
  },
  multiCheck: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  multiCheckFloating: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -18,
    zIndex: 20,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C7C7CC' },
  uncheckCircleOnCard: {
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFF',
    zIndex: 2000,
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 12,
  },
  sideScroll: { flex: 1, paddingHorizontal: 14 },
  sideScrollContent: { paddingTop: 8, paddingBottom: 12 },
  sideFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 6,
    flexShrink: 0,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    padding: 12,
  },
  userAvatar: { width: 40, height: 40, borderRadius: 12 },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMeta: { flex: 1, minWidth: 0 },
  userTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1D1D1F' },
  userProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#AF52DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  userProCrown: { fontSize: 10, lineHeight: 10, marginTop: -1 },
  userProTxt: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  signOutTxt: { fontSize: 10, fontWeight: '800', color: '#FF3B30' },
  sideOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1500,
  },
  sideHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  sideTitle: { fontSize: 17, fontWeight: '900' },
  logoMini: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideNavPillWrap: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 10,
    overflow: 'hidden',
  },
  sideSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sideSectionHeadFirst: {
    marginTop: 0,
  },
  sideSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D1D1F',
    letterSpacing: 0.2,
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 16,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  sideActive: { backgroundColor: '#007AFF' },
  mark: { width: 6, height: 6, borderRadius: 3 },
  sideLabel: { flex: 1, marginLeft: 6, fontSize: 13, fontWeight: '500', color: '#8E8E93' },
  sideCount: { fontSize: 10, fontWeight: '800', color: '#C7C7CC', marginRight: 2 },
  modalRoot: { flex: 1, backgroundColor: 'transparent' },
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  modalBackdropStrong: { backgroundColor: 'rgba(0,0,0,0.45)' },
  modalFront: {},
  modalFrontCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  backdropBase: { flex: 1, zIndex: 10000 },
  backdropBaseCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 10000 },
  backdropDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', zIndex: 10000 },
  editKeyboardWrap: { flex: 1 },
  editBackdropTint: { backgroundColor: 'rgba(0,0,0,0.45)' },
  editBoxCenter: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  filterMenuBox: {
    position: 'absolute',
    top: 56,
    right: 8,
    width: 220,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 10,
    elevation: 10,
  },
  threeDotsBox: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  mItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, gap: 10 },
  mItemTxt: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  menuSec: { backgroundColor: '#F2F2F7', paddingVertical: 5, paddingHorizontal: 10, marginTop: 2 },
  menuSecTightTop: { marginTop: 0 },
  menuSecTxt: { fontSize: 10, fontWeight: '800', color: '#8E8E93', letterSpacing: 0.8 },
  menuMetaBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
    gap: 3,
  },
  menuMetaLine: { fontSize: 12, fontWeight: '500', color: '#636366', lineHeight: 16 },
  menuHairline: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 5 },
  menuInputWrap: { paddingHorizontal: 8, paddingVertical: 2 },
  menuInput: { 
    backgroundColor: '#F2F2F7', 
    height: 38, 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    fontSize: 14,
    color: '#1D1D1F',
    textAlignVertical: 'center',
    paddingVertical: 0,
  },
  menuTagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 2,
  },
  menuTagChip: {
    backgroundColor: 'rgba(0,122,255,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.22)',
  },
  menuTagChipTxt: { fontSize: 12, fontWeight: '700', color: '#007AFF' },
  menuAutocompleteBox: {
    maxHeight: 160,
    marginHorizontal: 8,
    marginBottom: 4,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
  },
  menuAutocompleteRow: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  menuAutocompleteRowTxt: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  floatingBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  barTitle: { fontSize: 12, fontWeight: '800', padding: 8 },
  divider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 4 },
  settingsSheet: { width: '92%', backgroundColor: '#FFF', borderRadius: 32, padding: 24, maxHeight: '85%' },
  mHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mTitle: { fontSize: 20, fontWeight: '900' },
  uStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    marginBottom: 20,
  },
  aBig: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E9E9EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  proPanel: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#F2F2F7', marginBottom: 20 },
  proLblRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', padding: 12 },
  doneBtn: { alignItems: 'center', padding: 10 },
  doneTxt: { color: '#007AFF', fontWeight: '800' },
  sideMenuFloating: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 200,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 8,
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    zIndex: 1000,
  },
  sideMenuHead: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    marginBottom: 4,
  },
  sideMenuTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1D1D1F',
  },
  editBox: { 
    width: '94%', 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    flex: 1,
    maxHeight: '92%',
    minHeight: '75%',
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  editHeader: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  editHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editStarFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 4,
  },
  editColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  editMetaForm: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  editFieldLbl: {
    fontSize: 11,
    fontWeight: '800',
    color: '#636366',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  editFieldIn: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  editSuggestBox: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  editSuggestRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  editSuggestTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  editMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
    gap: 10,
  },
  editMetaLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  editMetaHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  editMetaPill: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '100%',
  },
  editMetaPillTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D1D1F',
  },
  editMetaPillTag: {
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  editMetaPillTagTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#007AFF',
  },
  editTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  editBodyContainer: {
    minHeight: 300,
    backgroundColor: '#FFF',
  },
  editAttachments: {
    marginTop: 8,
    paddingBottom: 8,
  },
  removeAttBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 50,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  editBody: { padding: 16, flex: 1 },
  editInput: { minHeight: 130, fontSize: 17, fontWeight: '500', color: '#1D1D1F' },
  editFooter: {
    minHeight: 52,
    backgroundColor: '#F9F9F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  doneBtnBlack: { backgroundColor: '#1D1D1F', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  captureBarWrap: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    zIndex: 500,
    elevation: 0,
  },
  captureBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  captureBarHit: {
    zIndex: 2,
    elevation: 6,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  captureInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnTxt: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
  },
  secondaryBtnTxt: { color: '#FF3B30', fontWeight: '800', fontSize: 15 },
  colorSheet: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'stretch',
  },
  colorSheetHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    marginBottom: 4,
    fontWeight: '600',
  },
  colorGridScroll: { flexGrow: 1, paddingBottom: 8 },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  colorDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  colorDotSelected: { borderWidth: 3, borderColor: '#007AFF' },
  colorCloseBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  sideBrandTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1D1D1F',
    marginLeft: -5,
  },
  sideLabelPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  editHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  editTitleInput: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1D1D1F',
    flex: 1,
    paddingVertical: 6,
  },
  editCloseBtn: {
    padding: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 999,
  },
  editModeTabWrap: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  editModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 2,
  },
  editModeTab: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  editModeTabActive: {
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  editModeTabTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
  },
  editModeTabTxtActive: {
    color: '#007AFF',
  },
  editField: {
    flex: 1,
  },
  captureInputCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  captureInputCapsuleActive: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: 'rgba(0,122,255,0.22)',
  },
  captureInputCapsuleListening: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  captureZapIcon: {
    marginRight: 6,
    opacity: 0.8,
  },
  captureTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1D1D1F',
    paddingVertical: 4,
  },
  captureCheckBtn: {
    padding: 6,
    marginLeft: 4,
  },
  captureMicBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureMicBtnListening: {
    backgroundColor: '#EF4444',
  },
  waveDotBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveDot: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FFF',
  },
  toastWrapper: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 29, 31, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    maxWidth: '85%',
  },
  toastText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
