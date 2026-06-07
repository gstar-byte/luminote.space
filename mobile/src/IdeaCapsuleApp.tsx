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
  const keys = (Object.keys(updates) as (keyof Capsule)[]).filter(
    (k) => updates[k] !== undefined,
  );
  if (keys.length === 1 && keys[0] === 'completed') return false;
  if (keys.length === 1 && keys[0] === 'isPinned') return false;
  return true;
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
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type !== 'doc' || !Array.isArray(parsed.content)) return raw;
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
    return lines.join('').trim();
  } catch { return raw; }
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
function capsulePartialToFirestoreData(updates: Partial<Capsule>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  Object.entries(updates).forEach(([k, v]) => {
    if (k === 'category') {
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        clean[k] = deleteField();
      } else {
        clean[k] = v;
      }
      return;
    }
    if (k === 'tags') {
      if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
        clean[k] = deleteField();
      } else {
        clean[k] = v;
      }
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
  edgePanelEnabled: true,
  ongoingNotificationEnabled: true,
  accessibilityWakeEnabled: true,
  quickCaptureLimit: 5,
};

export default function IdeaCapsuleApp() {
  const searchInputRef = useRef<TextInput>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

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
  const pullReachedRef = useRef(false);

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshTitle('Syncing…');
    try {
      await syncCapsules();
    } finally {
      setRefreshing(false);
      setRefreshTitle('Pull to sync');
      pullReachedRef.current = false;
    }
  }, [syncCapsules]);

  const [editingCapsule, setEditingCapsule] = useState<Capsule | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategoryDraft, setEditCategoryDraft] = useState('');
  const [editTagsDraft, setEditTagsDraft] = useState('');
  const [editSubjectDraft, setEditSubjectDraft] = useState('');
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const [editCategoryFocused, setEditCategoryFocused] = useState(false);
  const [editTagsFocused, setEditTagsFocused] = useState(false);
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

  const [colorPickerCapsule, setColorPickerCapsule] = useState<Capsule | null>(null);
  const [reminderTarget, setReminderTarget] = useState<Capsule | null>(null);

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isWebListening, setIsWebListening] = useState(false);
  const [quickCaptureMode, setQuickCaptureMode] = useState<'buttons' | 'text' | 'voice'>('buttons');
  const [editMode, setEditMode] = useState<'plain' | 'markdown'>('markdown');
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const webSpeechRef = useRef<any>(null);

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  /** Platform flags */
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';



  const sidebarWidth = useMemo(() => {
    if (Platform.OS === 'web') {
      return Math.min(300, Math.max(200, Math.round(windowWidth * 0.45)));
    }
    return Math.min(220, Math.max(160, Math.round(windowWidth * 0.5)));
  }, [windowWidth]);
  const isWideWeb = Platform.OS === 'web' && windowWidth >= 680;

  const sidebarAnim = useState(() => new Animated.Value(-2000))[0];

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: isSidebarOpen ? 0 : -sidebarWidth - 50,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isSidebarOpen, sidebarAnim, sidebarWidth]);

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
      const valA = a[sortBy] || 0;
      const valB = b[sortBy] || 0;
      if (sortOrder === 'desc') return valB - valA;
      return valA - valB;
    });
  }, [capsules, sortBy, sortOrder]);

  const allTags = useMemo(
    () =>
      Array.from(new Set(sortedCapsules.flatMap((c) => c.tags || []))).sort(),
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
      const matchesSearch = !searchLower || 
        plainTextFromContent(c.content).toLowerCase().includes(searchLower) ||
        (c.category?.toLowerCase().includes(searchLower)) ||
        (c.tags?.some((t) => t.toLowerCase().includes(searchLower)) ?? false);
      const matchesCategory =
        categoryFilter === 'all' || c.category === categoryFilter;
      const matchesTag = !tagFilter || (c.tags && c.tags.includes(tagFilter));

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
        return;
      }

      if (requireAuth()) return;
      if (editingCapsule?.id === id) {
        setEditingCapsule((prev) => {
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
    [user, editingCapsule?.id, capsules, requireAuth],
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
      const { category, tags, refinedContent, isTodo, reminder } =
        await categorizeThought(text);
      const randomColor =
        PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      const norm = normalizeReminder(reminder);
      const isTodoResolved = Boolean(isTodo || (norm != null && norm.type !== 'none'));

      await addDoc(collection(db, 'capsules'), {
        userId: user.uid,
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: refinedContent }] }] }),
        category: category || undefined,
        tags: tags && tags.length > 0 ? tags : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completed: false,
        isTodo: isTodoResolved,
        isArchived: false,
        isDeleted: false,
        reminder: norm,
        color: randomColor,
      });
    } catch {
      const randomColor =
        PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      await addDoc(collection(db, 'capsules'), {
        userId: user.uid,
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: text }] }] }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completed: false,
        isTodo: false,
        isArchived: false,
        isDeleted: false,
        color: randomColor,
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
          batch.update(doc(db, 'capsules', id), { ...clean } as Record<string, unknown>);
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
        return;
      }
      setIsVoiceRecording(false);
      const uri = prev.getURI();
      if (!uri) {
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
        const refined = meta.refinedContent?.trim() || '';
        if (!refined) {
          Alert.alert(
            'Voice',
            'Could not transcribe audio. Check your network and Gemini API key.',
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
          category: meta.category || undefined,
          tags: meta.tags && meta.tags.length > 0 ? meta.tags : undefined,
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
    } catch (e) {
      console.error(e);
      Alert.alert('Voice', 'Could not start recording.');
      setIsVoiceRecording(false);
      voiceRecordingRef.current = null;
    }
  };

  const openMenu = (c: Capsule) => {
    setMenuCategory(c.category || '');
    categoryMenuSentRef.current = (c.category || '').trim();
    setMenuTagInput('');
    setMenuCategoryFocused(false);
    setMenuTagFocused(false);
    setActiveMenuCapsule(c);
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
    const raw = menuTagInputRef.current.trim().replace(/^#/, '');
    if (!raw) return cap;
    let merged: Capsule = cap;
    setCapsules((s) => {
      const fromList = s.find((x) => x.id === cap.id) ?? cap;
      if (fromList.tags?.includes(raw)) {
        merged = fromList;
        return s;
      }
      const tags = [...(fromList.tags || []), raw];
      merged = { ...fromList, tags };
      void updateCapsule(cap.id, { tags });
      return s.map((x) => (x.id === cap.id ? { ...x, tags } : x));
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
      const val = tag.trim().replace(/^#/, '');
      if (!val) return;
      const id = activeMenuCapsule.id;
      let merged: Capsule = activeMenuCapsule;
      setCapsules((s) => {
        const cap = s.find((x) => x.id === id) ?? activeMenuCapsule;
        if (!cap) return s;
        if (cap.tags?.includes(val)) {
          merged = cap;
          return s;
        }
        const tags = [...(cap.tags || []), val];
        merged = { ...cap, tags };
        void updateCapsule(id, { tags });
        return s.map((x) => (x.id === id ? { ...x, tags } : x));
      });
      setActiveMenuCapsule((prev) => (prev?.id === id ? merged : prev));
    },
    [activeMenuCapsule, updateCapsule],
  );

  const removeMenuTag = useCallback(
    (tagToRemove: string) => {
      if (!activeMenuCapsule || activeMenuCapsule.isDeleted) return;
      const id = activeMenuCapsule.id;
      const nextTags = (activeMenuCapsule.tags || []).filter((t) => t !== tagToRemove);
      void updateCapsule(id, { tags: nextTags.length ? nextTags : undefined });
      setActiveMenuCapsule((prev) =>
        prev?.id === id ? { ...prev, tags: nextTags.length ? nextTags : undefined } : prev,
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
    const existing = new Set((activeMenuCapsule.tags || []).map((t) => t.toLowerCase()));
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
    if (!editTagsFocused) return [];
    const parts = editTagsDraft.split(',');
    const raw = (parts[parts.length - 1] || '').trim().replace(/^#/, '');
    if (!raw) return [];
    const ql = raw.toLowerCase();
    const existing = new Set(
      parts
        .slice(0, -1)
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean),
    );
    return allTags
      .filter((t) => {
        const tl = t.toLowerCase();
        return tl.includes(ql) && !existing.has(tl) && tl !== ql;
      })
      .slice(0, 8);
  }, [editTagsFocused, editTagsDraft, allTags]);

  const saveEditSilent = useCallback(() => {
    if (!editingCapsule) return;
    const id = editingCapsule.id;
    const original = capsules.find((c) => c.id === id);
    const content = editContent;
    const subjectTrim = editSubjectDraft.trim();
    const catTrim = editCategoryDraft.trim();
    const tagParts = editTagsDraft.split(',').map((t) => t.trim()).filter(Boolean);

    const tagSig = (arr: string[]) =>
      [...arr].map((t) => t.trim()).filter(Boolean).sort().join('\0');

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
    if (tagSig(original?.tags || []) !== tagSig(tagParts)) {
      updates.tags = tagParts.length ? tagParts : undefined;
    }

    if (Object.keys(updates).length === 0) return;
    void updateCapsule(id, updates);
  }, [
    editingCapsule,
    editContent,
    editSubjectDraft,
    editCategoryDraft,
    editTagsDraft,
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
      setEditTagsDraft((editingCapsule.tags || []).join(', '));
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
          onFacebookPress={() =>
            Alert.alert(
              'Facebook',
              'Facebook sign-in needs the Facebook SDK wired to Firebase—use email or Google for now.',
            )
          }
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
              style={[s.primaryBtn, { marginTop: 16 }]}
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

            <TouchableOpacity style={{ marginTop: 12 }} onPress={handleResetPassword}>
              <Text style={{ color: '#007AFF', fontWeight: '700', fontSize: 13 }}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            <Text style={s.dividerLabel}>Or continue with</Text>
            <View style={s.socialRow}>
              <GoogleSignInButton variant="light" compact />
              <TouchableOpacity
                style={[s.socialBtn, { backgroundColor: '#1877F2' }]}
                onPress={() =>
                  Alert.alert(
                    'Facebook',
                    'Facebook sign-in is not set up yet—use email or Google.',
                  )
                }
              >
                <Text style={{ color: '#FFF', fontWeight: '800' }}>f</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ marginTop: 24 }} onPress={() => setIsRegistering(!isRegistering)}>
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
          <TouchableOpacity 
            style={s.searchWrap} 
            activeOpacity={1} 
            onPress={() => searchInputRef.current?.focus()}
          >
            <Search size={17} color="#8E8E93" />
            <TextInput
              ref={searchInputRef}
              style={s.searchIn}
              placeholder="Search inspiration…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#8E8E93"
              returnKeyType="search"
            />
          </TouchableOpacity>
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

        <ScrollView
          style={s.scrollFill}
          contentContainerStyle={[s.scrollBody, { paddingBottom: listBottomPad }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isSyncing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
              title={refreshTitle}
              titleColor="#8E8E93"
            />
          }
        >
          <View style={viewMode === 'grid' ? s.gridRow : s.listCol}>
            {filteredCapsules.map((item) => {
              const renderLeftActions = () => (
                <View style={s.swipeLeftAction}>
                  <Check size={18} color="#FFF" />
                  <Text style={s.swipeActionTxt}>Done</Text>
                </View>
              );

              const renderRightActions = () => {
                const isArchive = settings.swipeRightAction === 'archive';
                return (
                  <View style={[s.swipeRightAction, isArchive && { backgroundColor: '#FF9500' }]}>
                    {isArchive ? (
                      <Archive size={18} color="#FFF" />
                    ) : (
                      <Trash2 size={18} color="#FFF" />
                    )}
                    <Text style={s.swipeActionTxt}>{isArchive ? 'Archive' : 'Delete'}</Text>
                  </View>
                );
              };

              const handleSwipeTrigger = (direction: 'left' | 'right') => {
                if (direction === 'left') {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  void updateCapsule(item.id, { 
                    completed: !item.completed,
                    isTodo: true
                  });
                } else if (direction === 'right') {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  if (settings.swipeRightAction === 'archive') {
                    void updateCapsule(item.id, { isArchived: true });
                  } else {
                    void updateCapsule(item.id, { isDeleted: true });
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
                        onMenu={() => openMenu(item)}
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
                      onMenu={() => openMenu(item)}
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) + 8 : 0}
          style={s.captureBarWrap}
        >
          <View style={[s.captureBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View
              style={[
                s.captureInputCapsule,
                isVoiceRecording && s.captureInputCapsuleListening,
                isTextInputFocused && s.captureInputCapsuleActive,
              ]}
            >
              <View style={s.captureZapIcon}>
                <Zap size={18} color="#007AFF" strokeWidth={2.5} />
              </View>
              <TextInput
                style={s.captureTextInput}
                placeholder={isVoiceRecording ? "Listening..." : "Record your thoughts..."}
                placeholderTextColor="#8E8E93"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => {
                  if (!inputText.trim()) {
                    alertCaptureEmpty();
                    return;
                  }
                  void handleCreateCapsule(inputText);
                  setInputText('');
                }}
                returnKeyType="done"
                editable={!isProcessing && !isVoiceRecording}
                onFocus={() => setIsTextInputFocused(true)}
                onBlur={() => setIsTextInputFocused(false)}
              />
              {isProcessing ? (
                <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 4 }} />
              ) : inputText.trim().length > 0 ? (
                <TouchableOpacity
                  style={s.captureCheckBtn}
                  onPress={() => {
                    if (!inputText.trim()) return;
                    void handleCreateCapsule(inputText);
                    setInputText('');
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Check size={20} color="#007AFF" strokeWidth={3} />
                </TouchableOpacity>
              ) : null}
            </View>

            {isVoiceRecording ? (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[s.captureMicBtn, s.captureMicBtnListening]}
                onPress={() => {
                  void startVoice();
                }}
              >
                <View style={s.waveDotBox}>
                  <View style={s.waveDot} />
                  <View style={[s.waveDot, { marginHorizontal: 3 }]} />
                  <View style={s.waveDot} />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  void startVoice();
                }}
              >
                <LinearGradient
                  colors={['#007AFF', '#00C6FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.captureMicBtn}
                >
                  {[<Mic key="mic" size={20} color="#FFF" />]}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
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
                <Text style={s.sideSectionTitle}>Tags</Text>
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
                  count={sortedCapsules.filter((c) => c.tags?.includes(t)).length}
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
              style={[
                s.sideNavPillWrap,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA', paddingTop: 12, marginTop: 4 }
              ]}
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
              s.modalFrontCenter,
            ]}
            onPress={closeNotesMenu}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: windowHeight * 0.85, width: menuSheetWidth }}
              contentContainerStyle={{ paddingBottom: 6 }}
            >
                <View style={[s.threeDotsBox, { width: menuSheetWidth }]}>
                  {activeMenuCapsule && !activeMenuCapsule.isDeleted ? (
                    <View style={{ paddingVertical: 4 }}>
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
                          color="#007AFF"
                          fill={activeMenuCapsule.isPinned ? '#007AFF' : 'transparent'}
                          style={{ transform: [{ rotate: '45deg' }] }}
                        />
                        <Text style={[s.mItemTxt, activeMenuCapsule.isPinned && { color: '#007AFF' }]}>
                          {activeMenuCapsule.isPinned ? 'Unpin Note' : 'Pin Note'}
                        </Text>
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
                          color="#007AFF"
                          fill={activeMenuCapsule.isStarred ? '#FFB800' : 'transparent'}
                        />
                        <Text style={[s.mItemTxt, activeMenuCapsule.isStarred && { color: '#007AFF' }]}>
                          {activeMenuCapsule.isStarred ? 'Unstar Note' : 'Star Note'}
                        </Text>
                      </TouchableOpacity>

                      {/* Change Color */}
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (activeMenuCapsule) setColorPickerCapsule(activeMenuCapsule);
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <Palette size={18} color="#8E8E93" />
                        <Text style={s.mItemTxt}>Change Color</Text>
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
                          <Square size={18} color="#8E8E93" />
                        ) : (
                          <CheckSquare size={18} color="#007AFF" />
                        )}
                        <Text style={[s.mItemTxt, !activeMenuCapsule.isTodo && { color: '#007AFF' }]}>
                          {activeMenuCapsule.isTodo ? 'Cancel To-do' : 'Set To-do'}
                        </Text>
                      </TouchableOpacity>

                      {/* Archive / Unarchive */}
                      <TouchableOpacity
                        style={s.mItem}
                        onPress={() => {
                          if (!activeMenuCapsule) return;
                          void updateCapsule(activeMenuCapsule.id, { isArchived: !activeMenuCapsule.isArchived });
                          setActiveMenuCapsule(null);
                        }}
                      >
                        <Archive size={18} color="#8E8E93" />
                        <Text style={s.mItemTxt}>
                          {activeMenuCapsule.isArchived ? 'Unarchive Note' : 'Archive Note'}
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
                        <Text style={s.mItemTxt}>Share Note</Text>
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
                    const sel = capsules.filter((c) => selectedIds.includes(c.id));
                    const allPinned = sel.length > 0 && sel.every((c) => c.isPinned);
                    void batchUpdate({ isPinned: allPinned ? false : true });
                  }}
                >
                  <Pin size={18} color="#007AFF" />
                  <Text style={[s.mItemTxt, { color: '#007AFF' }]}>
                    {(() => {
                      const sel = capsules.filter((c) => selectedIds.includes(c.id));
                      return sel.length > 0 && sel.every((c) => c.isPinned)
                        ? 'Unpin'
                        : 'Pin to top';
                    })()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    const sel = capsules.filter((c) => selectedIds.includes(c.id));
                    const allStarred = sel.length > 0 && sel.every((c) => c.isStarred);
                    void batchUpdate({ isStarred: allStarred ? false : true });
                  }}
                >
                  <Star
                    size={18}
                    color="#007AFF"
                    fill={(() => {
                      const sel = capsules.filter((c) => selectedIds.includes(c.id));
                      return sel.length > 0 && sel.every((c) => c.isStarred)
                        ? '#FFB800'
                        : 'transparent';
                    })()}
                  />
                  <Text style={[s.mItemTxt, { color: '#007AFF' }]}>
                    {(() => {
                      const sel = capsules.filter((c) => selectedIds.includes(c.id));
                      return sel.length > 0 && sel.every((c) => c.isStarred)
                        ? 'Unstar'
                        : 'Star';
                    })()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => {
                    const sel = capsules.filter((c) => selectedIds.includes(c.id));
                    const allTodo = sel.length > 0 && sel.every((c) => c.isTodo);
                    void batchUpdate(
                      allTodo ? { isTodo: false, completed: false } : { isTodo: true },
                    );
                  }}
                >
                  {(() => {
                    const sel = capsules.filter((c) => selectedIds.includes(c.id));
                    const allTodo = sel.length > 0 && sel.every((c) => c.isTodo);
                    return allTodo ? (
                      <Square size={18} color="#8E8E93" />
                    ) : (
                      <CheckSquare size={18} color="#007AFF" />
                    );
                  })()}
                  <Text style={[s.mItemTxt, { color: '#007AFF' }]}>
                    {(() => {
                      const sel = capsules.filter((c) => selectedIds.includes(c.id));
                      return sel.length > 0 && sel.every((c) => c.isTodo)
                        ? 'Remove to-do'
                        : 'Set to-do';
                    })()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => setBatchColorMultiOpen(true)}
                >
                  <Palette size={18} color="#007AFF" />
                  <Text style={[s.mItemTxt, { color: '#007AFF' }]}>Change color</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.mItem}
                  onPress={() => setBatchReminderMultiOpen(true)}
                >
                  <Calendar size={18} color="#007AFF" />
                  <Text style={[s.mItemTxt, { color: '#007AFF' }]}>Set reminder</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity style={s.mItem} onPress={() => batchUpdate({ isArchived: true })}>
              <Archive size={18} color="#8E8E93" />
              <Text style={s.mItemTxt}>Archive</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.mItem} onPress={() => batchUpdate({ isDeleted: true })}>
              <Trash2 size={18} color="#FF3B30" />
              <Text style={[s.mItemTxt, { color: '#FF3B30' }]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.mItem} onPress={handleShareMultiple}>
              <ShareIcon size={18} color="#007AFF" />
              <Text style={[s.mItemTxt, { color: '#007AFF' }]}>Share</Text>
            </TouchableOpacity>

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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
            style={s.editKeyboardWrap}
          >
            <Pressable
              style={[StyleSheet.absoluteFillObject, s.editBackdropTint]}
              onPress={saveEdit}
            />
            <View style={[s.editBoxCenter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <View style={s.editBox}>
                <View style={s.editHeader}>
                  <View style={s.editHeaderLeft}>
                    {/* Color dot indicator */}
                    <View
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

                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ flexGrow: 1 }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  <View style={s.editBodyContainer}>
                    {/* Plain / Markdown switcher */}
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

                    <CapsuleEditorMobile
                      content={editContent}
                      onChange={(json) => setEditContent(json)}
                      placeholder="Type your brilliant thought here..."
                      autoFocus
                      editMode={editMode}
                    />

                    {/* Category & Tags Input */}
                    <View style={s.editMetaForm}>
                      <View style={s.editField}>
                        <Text style={s.editFieldLbl}>Category</Text>
                        <TextInput
                          style={s.editFieldIn}
                          placeholder="e.g. Work, Ideas"
                          placeholderTextColor="#8E8E93"
                          value={editCategoryDraft}
                          onChangeText={setEditCategoryDraft}
                          onBlur={saveEditSilent}
                        />
                      </View>
                      <View style={[s.editField, { marginTop: 12 }]}>
                        <Text style={s.editFieldLbl}>Tags (comma separated)</Text>
                        <TextInput
                          style={s.editFieldIn}
                          placeholder="e.g. design, slide, coding"
                          placeholderTextColor="#8E8E93"
                          value={editTagsDraft}
                          onChangeText={setEditTagsDraft}
                          onBlur={saveEditSilent}
                        />
                      </View>
                    </View>

                    {editingCapsule?.attachments?.length ? (
                      <View style={s.editAttachments}>
                        {editingCapsule.attachments.map((a, i) => (
                          <View
                            key={`att-${editingCapsule.id}-${i}-${a.url.slice(0, 20)}`}
                            style={{ marginTop: 12 }}
                          >
                            <View style={{ position: 'relative' }}>
                              {a.type === 'image' ? (
                                <Image
                                  source={{ uri: a.url }}
                                  style={{ width: '100%', height: 180, borderRadius: 12 }}
                                />
                              ) : (
                                <View
                                  style={{
                                    width: '100%',
                                    height: 120,
                                    borderRadius: 12,
                                    backgroundColor: '#000',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ color: '#FFF' }}>Video</Text>
                                </View>
                              )}
                              <TouchableOpacity
                                onPress={(e) => {
                                  e?.stopPropagation?.();
                                  void removeAttachmentAt(i);
                                }}
                                style={s.removeAttBtn}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                              >
                                <X size={18} color="#FFF" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </ScrollView>
                <View style={s.editFooter}>
                  <TouchableOpacity
                    onPress={() => editingCapsule && pickImageForCapsule(editingCapsule)}
                    style={{ padding: 8 }}
                  >
                    <ImageIcon size={22} color="#8E8E93" />
                  </TouchableOpacity>

                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: '#AEAEB2',
                        textTransform: 'uppercase',
                      }}
                    >
                      Created: {editingCapsule ? formatNoteDateTime(editingCapsule.createdAt) : ''}
                    </Text>
                    {editingCapsule?.reminder && editingCapsule.reminder.type !== 'none' && (
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: '#007AFF',
                          textTransform: 'uppercase',
                          marginTop: 1,
                        }}
                      >
                        Reminder: {formatNoteDateTime(editingCapsule.reminder.date)} (
                        {repeatLabelForMenu(editingCapsule.reminder)})
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity style={s.doneBtnBlack} onPress={saveEdit}>
                    <Text style={{ color: '#FFF', fontWeight: '800' }}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
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
              <View style={[s.threeDotsBox, { width: 220 }]} pointerEvents="auto">
                <View style={[s.menuSec, s.menuSecTightTop]}>
                  <Text style={s.menuSecTxt}>SORT BY</Text>
                </View>
                <TouchableOpacity
                  style={[s.mItem, sortBy === 'updatedAt' && { backgroundColor: 'rgba(0,122,255,0.06)' }]}
                  onPress={() => setSortBy('updatedAt')}
                >
                  <Text style={[s.mItemTxt, sortBy === 'updatedAt' && { color: '#007AFF', fontWeight: '800' }]}>Modification Time</Text>
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
  renderLeftActions: () => React.ReactNode;
  renderRightActions: () => React.ReactNode;
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
      containerStyle={{ width: '100%' }}
      childrenContainerStyle={{ width: '100%' }}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      onSwipeableWillOpen={() => {
        // 在即将滑开的物理临界点触发清脆轻微的原生震动反馈
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      friction={1.5}
      leftThreshold={50}
      rightThreshold={50}
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
  onMenu: () => void;
  onToggleTodo: () => void;
}) {
  const bellRight = isMulti ? 10 : 48;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        isGrid ? s.cardGrid : s.cardList,
        isGrid && s.cardGridFill,
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
            ]}
            numberOfLines={isGrid ? 3 : 1}
            ellipsizeMode="tail"
          >
            {plainTextFromContent(item.content)}
          </Text>
        </View>
      </View>
      {hasActiveReminder(item) ? (
        <View style={[s.cardBellCorner, { right: bellRight }]} pointerEvents="none">
          <Bell size={12} color="rgba(255,255,255,0.95)" strokeWidth={2.5} />
        </View>
      ) : null}
      {!isMulti ? (
        <View style={s.cardMenuCol}>
          <TouchableOpacity
            onPress={(e) => {
              (e as { stopPropagation?: () => void }).stopPropagation?.();
              onMenu();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={isGrid ? 16 : 18} color="#FFF" style={{ opacity: 0.6 }} />
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
  authScroll: { padding: 24, paddingTop: 56 },
  authH: { fontSize: 26, fontWeight: '900', color: '#1D1D1F' },
  authHint: { color: '#8E8E93', marginTop: 8, marginBottom: 24, fontWeight: '600' },
  label: { fontSize: 10, fontWeight: '900', color: '#8E8E93', letterSpacing: 1.2, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 10,
  },
  input: { flex: 1, height: 48, fontSize: 15, fontWeight: '600' },
  errTxt: { color: '#FF3B30', fontSize: 13, fontWeight: '600', marginTop: 8 },
  dividerLabel: {
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 12,
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
  },
  sideHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    bottom: 8,
    zIndex: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
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
  sideHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    maxHeight: '92%',
    minHeight: '60%',
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
    zIndex: 500,
    elevation: 28,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    ...Platform.select({
      web: { width: '100%', maxWidth: '100%', minWidth: 0 },
      default: {},
    }),
  },
  captureBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFF',
    gap: 10,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1D1D1F',
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
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 12,
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
});
