import React, { useState, useEffect } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Linking,
  NativeModules,
  TextInput,
  Alert,
} from 'react-native';
import { User as UserIcon, X, Sliders, Hand, Smartphone, Layers } from 'lucide-react-native';
import type { UserProfile, AppSettings } from '../types';
import { PAYWALL_ACTIVE } from '../featureFlags';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  visible: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onUpgrade: () => void;
  onDowngrade: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
};

export function SettingsModalMobile({
  visible,
  onClose,
  user,
  onUpgrade,
  onDowngrade,
  settings,
  onUpdateSettings,
}: Props) {
  const [provider, setProvider] = useState<'gemini' | 'deepseek' | 'local'>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedProvider = await AsyncStorage.getItem('luminote_nlp_provider');
        const savedGeminiKey = await AsyncStorage.getItem('luminote_gemini_api_key');
        const savedDeepseekKey = await AsyncStorage.getItem('luminote_deepseek_api_key');
        const savedSupabaseUrl = await AsyncStorage.getItem('luminote_supabase_url');
        const savedSupabaseAnonKey = await AsyncStorage.getItem('luminote_supabase_anon_key');

        if (savedProvider) setProvider(savedProvider as any);
        if (savedGeminiKey) setGeminiKey(savedGeminiKey);
        if (savedDeepseekKey) setDeepseekKey(savedDeepseekKey);
        if (savedSupabaseUrl) setSupabaseUrl(savedSupabaseUrl);
        if (savedSupabaseAnonKey) setSupabaseAnonKey(savedSupabaseAnonKey);
      } catch (e) {
        console.warn(e);
      }
    };
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const handleProviderChange = async (val: 'gemini' | 'deepseek' | 'local') => {
    setProvider(val);
    try {
      await AsyncStorage.setItem('luminote_nlp_provider', val);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleGeminiKeyChange = async (val: string) => {
    setGeminiKey(val);
    try {
      await AsyncStorage.setItem('luminote_gemini_api_key', val);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleDeepseekKeyChange = async (val: string) => {
    setDeepseekKey(val);
    try {
      await AsyncStorage.setItem('luminote_deepseek_api_key', val);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSupabaseUrlChange = async (val: string) => {
    setSupabaseUrl(val);
    try {
      await AsyncStorage.setItem('luminote_supabase_url', val);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSupabaseAnonKeyChange = async (val: string) => {
    setSupabaseAnonKey(val);
    try {
      await AsyncStorage.setItem('luminote_supabase_anon_key', val);
    } catch (e) {
      console.warn(e);
    }
  };

  if (!visible) return null;

  const handleToggle = async (key: keyof AppSettings, val: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onUpdateSettings({ [key]: val });
  };

  const handleSegmentChange = async (key: keyof AppSettings, val: any) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onUpdateSettings({ [key]: val });
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Drag Indicator Bar */}
          <View style={styles.indicatorContainer}>
            <View style={styles.indicator} />
          </View>

          {/* Header */}
          <View style={styles.head}>
            <View style={styles.headLeft}>
              <Sliders size={20} color="#007AFF" strokeWidth={2.5} />
              <Text style={styles.title}>Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <X size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Pro Status / Billing */}
            {PAYWALL_ACTIVE && (
              <View style={styles.card}>
                <View style={styles.accountRow}>
                  {user?.photoURL ? (
                    <Image source={{ uri: user.photoURL }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPh}>
                      <UserIcon size={24} color="#007AFF" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {user?.displayName || (user ? 'User' : 'Guest')}
                    </Text>
                    <Text style={styles.email} numberOfLines={1}>
                      {user?.email || 'Not signed in'}
                    </Text>
                  </View>
                </View>

                <View style={styles.tierRow}>
                  <View>
                    <Text style={styles.tierLbl}>ACCOUNT STATUS</Text>
                    {user?.isPremium ? (
                      <View style={styles.tierPro}>
                        <Text style={styles.tierCrown}>👑</Text>
                        <Text style={styles.tierProTxt}>Idea Capsule Pro</Text>
                      </View>
                    ) : (
                      <Text style={styles.tierFree}>Free Tier</Text>
                    )}
                  </View>
                  {user?.isPremium ? (
                    <TouchableOpacity style={styles.downBtn} onPress={onDowngrade}>
                      <Text style={styles.downBtnTxt}>Downgrade</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade}>
                      <Text style={styles.upgradeBtnTxt}>Upgrade</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Section: Gesture Interactions */}
            <Text style={styles.sectionLbl}>GESTURES & TOUCH</Text>
            <View style={styles.sectionCard}>
              {/* Swipe Action Enabled */}
              <View style={styles.row}>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>Swipe Actions</Text>
                  <Text style={styles.rowSub}>Enable left/right swipe shortcuts in list mode</Text>
                </View>
                <Switch
                  value={settings.swipeEnabled}
                  onValueChange={(val) => handleToggle('swipeEnabled', val)}
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFF"
                  ios_backgroundColor="#E5E5EA"
                />
              </View>


            </View>

            {/* Section: Floating Panels */}
            <Text style={styles.sectionLbl}>FLOATING PANELS</Text>
            <View style={styles.sectionCard}>
              {/* Display Note Count Limit */}
              <View style={styles.row}>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>Quick Capture Limit</Text>
                  <Text style={styles.rowSub}>Max notes to show in Quick Dialog</Text>
                </View>
                <View style={styles.segmentContainer}>
                  {[3, 5, 8].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.segmentBtn,
                        settings.quickCaptureLimit === num && styles.segmentBtnActive,
                      ]}
                      onPress={() => handleSegmentChange('quickCaptureLimit', num)}
                    >
                      <Text style={[
                        styles.segmentBtnTxt,
                        settings.quickCaptureLimit === num && styles.segmentBtnTxtActive
                      ]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Section: Platform Native Integrations */}
            {Platform.OS === 'android' && (
              <>
                <Text style={styles.sectionLbl}>ANDROID INTEGRATIONS</Text>
                <View style={styles.sectionCard}>
                  {/* Ongoing Notification */}
                  <View style={styles.row}>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowTitle}>Ongoing Notification</Text>
                      <Text style={styles.rowSub}>Keep permanent quick capture entry in notification tray</Text>
                    </View>
                    <Switch
                      value={settings.ongoingNotificationEnabled}
                      onValueChange={(val) => handleToggle('ongoingNotificationEnabled', val)}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                      thumbColor="#FFF"
                      ios_backgroundColor="#E5E5EA"
                    />
                  </View>

                  {/* Volume Key Long Press */}
                  <View style={styles.rowDivider}>
                    <View style={styles.row}>
                      <View style={styles.rowMeta}>
                        <Text style={styles.rowTitle}>Volume Key Wake</Text>
                        <Text style={styles.rowSub}>Long press volume down globally to wake quick entry window (Requires accessibility service enabled)</Text>
                      </View>
                      <Switch
                        value={settings.accessibilityWakeEnabled}
                        onValueChange={(val) => {
                          if (val) {
                            Alert.alert(
                              'Accessibility Setup Required',
                              'To enable Volume Key Wake, you need to enable the Lumi Note Accessibility Service in your Android System Settings.\n\nGo to:\nSettings → Accessibility → Installed Services → Lumi Note → Enable',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Enable Anyway', onPress: () => handleToggle('accessibilityWakeEnabled', true) },
                              ]
                            );
                          } else {
                            handleToggle('accessibilityWakeEnabled', false);
                          }
                        }}
                        trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                        thumbColor="#FFF"
                        ios_backgroundColor="#E5E5EA"
                      />
                    </View>
                  </View>

                  {/* Edge Panel */}
                  <View style={styles.rowDivider}>
                    <View style={styles.row}>
                      <View style={styles.rowMeta}>
                        <Text style={styles.rowTitle}>Edge Panel</Text>
                        <Text style={styles.rowSub}>Floating side bar on the right edge for instant capture and recent notes</Text>
                      </View>
                      <Switch
                        value={settings.edgePanelEnabled}
                        onValueChange={async (val) => {
                          if (val) {
                            const { EdgePanelModule } = NativeModules;
                            if (EdgePanelModule) {
                              try {
                                const hasPerm = await EdgePanelModule.hasOverlayPermission();
                                if (hasPerm) {
                                  void handleToggle('edgePanelEnabled', true);
                                } else {
                                  Alert.alert(
                                    'Overlay Permission Required',
                                    'To enable the Edge Panel globally, Lumi Note needs permission to draw over other apps. Please authorize this in your Android settings.',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      { 
                                        text: 'Go to Settings', 
                                        onPress: async () => {
                                          await EdgePanelModule.requestOverlayPermission();
                                          void handleToggle('edgePanelEnabled', true);
                                        } 
                                      },
                                    ]
                                  );
                                }
                              } catch (e) {
                                console.warn('[Overlay Permission] Check failed:', e);
                                void handleToggle('edgePanelEnabled', true);
                              }
                            } else {
                              void handleToggle('edgePanelEnabled', true);
                            }
                          } else {
                            const { EdgePanelModule } = NativeModules;
                            if (EdgePanelModule) {
                              try {
                                EdgePanelModule.enableEdgePanel(false);
                              } catch (e) {
                                console.warn('[Edge Panel Service] Stop failed:', e);
                              }
                            }
                            void handleToggle('edgePanelEnabled', false);
                          }
                        }}
                        trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                        thumbColor="#FFF"
                        ios_backgroundColor="#E5E5EA"
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* Section: iOS Back Tap */}
            {Platform.OS === 'ios' && (
              <>
                <Text style={styles.sectionLbl}>iOS BACK TAP</Text>
                <View style={styles.sectionCard}>
                  <View style={styles.row}>
                    <View style={{ marginRight: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,122,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Hand size={18} color="#007AFF" strokeWidth={2.5} />
                      </View>
                    </View>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowTitle}>Double / Triple Tap</Text>
                      <Text style={styles.rowSub}>
                        Tap the back of your iPhone to instantly open Quick Capture — no need to unlock or find the app.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowDivider}>
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#636366', lineHeight: 17 }}>
                        {'1. Open '}
                        <Text style={{ color: '#007AFF', fontWeight: '800' }}>Settings → Accessibility → Touch</Text>
                        {'\n2. Scroll to '}
                        <Text style={{ color: '#007AFF', fontWeight: '800' }}>Back Tap</Text>
                        {'\n3. Choose '}
                        <Text style={{ fontWeight: '800' }}>Double Tap</Text>
                        {' or '}
                        <Text style={{ fontWeight: '800' }}>Triple Tap</Text>
                        {'\n4. Select '}
                        <Text style={{ color: '#007AFF', fontWeight: '800' }}>Lumi Note</Text>
                        {' (under Shortcuts)'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowDivider}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 }}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Linking.openURL('App-prefs:ACCESSIBILITY_PATH');
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#007AFF' }}>Open Accessibility Settings</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* Section: Home Screen Widget */}
            <Text style={styles.sectionLbl}>HOME SCREEN WIDGET</Text>
            <View style={styles.sectionCard}>
              <View style={styles.row}>
                <View style={{ marginRight: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(52,199,89,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={18} color="#34C759" strokeWidth={2.5} />
                  </View>
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>Quick Capture Widget</Text>
                  <Text style={styles.rowSub}>
                    Add a Lumi Note widget to your home screen for one-tap note capture and recent notes at a glance.
                  </Text>
                </View>
              </View>
              <View style={styles.rowDivider}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  {Platform.OS === 'ios' ? (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#636366', lineHeight: 17 }}>
                      {'1. Long press on your '}
                      <Text style={{ fontWeight: '800' }}>Home Screen</Text>
                      {'\n2. Tap the '}
                      <Text style={{ color: '#007AFF', fontWeight: '800' }}>+ button</Text>
                      {' (top left)'}
                      {'\n3. Search for '}
                      <Text style={{ color: '#007AFF', fontWeight: '800' }}>Lumi Note</Text>
                      {'\n4. Choose a widget size and tap '}
                      <Text style={{ fontWeight: '800' }}>Add Widget</Text>
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#636366', lineHeight: 17 }}>
                      {'1. Long press on your '}
                      <Text style={{ fontWeight: '800' }}>Home Screen</Text>
                      {'\n2. Tap '}
                      <Text style={{ color: '#007AFF', fontWeight: '800' }}>Widgets</Text>
                      {'\n3. Search for '}
                      <Text style={{ color: '#007AFF', fontWeight: '800' }}>Lumi Note</Text>
                      {'\n4. Drag the widget to your home screen'}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.rowDivider}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,149,0,0.08)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }}>
                    <Smartphone size={13} color="#FF9500" strokeWidth={2.5} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#FF9500', flex: 1 }}>
                      Widget will be available after installing the app from {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}.
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Section: AI & Database Integrations */}
            <Text style={styles.sectionLbl}>AI & DATABASE INTEGRATIONS</Text>
            <View style={styles.sectionCard}>
              {/* NLP Provider */}
              <View style={styles.row}>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>AI Model</Text>
                  <Text style={styles.rowSub}>Select the AI model for categorization & voice</Text>
                </View>
                <View style={styles.pickerContainer}>
                  {['gemini', 'deepseek', 'local'].map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.segmentBtnMini,
                        provider === item && styles.segmentBtnActive,
                      ]}
                      onPress={() => handleProviderChange(item as any)}
                    >
                      <Text style={[
                        styles.segmentBtnTxtMini,
                        provider === item && styles.segmentBtnTxtActive
                      ]}>
                        {item === 'gemini' ? 'Gemini' : item === 'deepseek' ? 'DeepSeek' : 'Local'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Gemini Key Input */}
              {provider === 'gemini' && (
                <View style={styles.rowDivider}>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputTitle}>Gemini API Key</Text>
                    <TextInput
                      secureTextEntry
                      value={geminiKey}
                      onChangeText={handleGeminiKeyChange}
                      placeholder="Paste your Google AI Studio key..."
                      placeholderTextColor="#8E8E93"
                      style={styles.textInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              )}

              {/* DeepSeek Key Input */}
              {provider === 'deepseek' && (
                <View style={styles.rowDivider}>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputTitle}>DeepSeek API Key</Text>
                    <TextInput
                      secureTextEntry
                      value={deepseekKey}
                      onChangeText={handleDeepseekKeyChange}
                      placeholder="Paste your DeepSeek platform key..."
                      placeholderTextColor="#8E8E93"
                      style={styles.textInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              )}

              {/* Supabase URL Input */}
              <View style={styles.rowDivider}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputTitle}>Supabase URL</Text>
                  <TextInput
                    value={supabaseUrl}
                    onChangeText={handleSupabaseUrlChange}
                    placeholder="https://your-project.supabase.co"
                    placeholderTextColor="#8E8E93"
                    style={styles.textInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Supabase Anon Key Input */}
              <View style={styles.rowDivider}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputTitle}>Supabase Anon Key</Text>
                  <TextInput
                    secureTextEntry
                    value={supabaseAnonKey}
                    onChangeText={handleSupabaseAnonKeyChange}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    placeholderTextColor="#8E8E93"
                    style={styles.textInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.done} onPress={onClose}>
              <Text style={styles.doneTxt}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  indicatorContainer: {
    width: '100%',
    height: 14,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  indicator: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F2F2F7',
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#1D1D1F', letterSpacing: 0.5 },
  closeBtn: { padding: 6, backgroundColor: '#F2F2F7', borderRadius: 999 },
  body: { padding: 16, paddingBottom: 28 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: '#E5E5EA' },
  avatarPh: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,122,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: '#1D1D1F' },
  email: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  tierRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierLbl: { fontSize: 10, fontWeight: '900', color: '#8E8E93', letterSpacing: 0.5 },
  tierFree: { fontSize: 14, fontWeight: '800', color: '#1D1D1F', marginTop: 4 },
  tierPro: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  tierCrown: { fontSize: 14 },
  tierProTxt: { fontSize: 14, fontWeight: '800', color: '#AF52DE' },
  downBtn: {
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  downBtnTxt: { color: '#FF3B30', fontWeight: '800', fontSize: 12 },
  upgradeBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  upgradeBtnTxt: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  sectionLbl: {
    fontSize: 10,
    fontWeight: '900',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 6,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  rowMeta: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13, fontWeight: '800', color: '#1D1D1F' },
  rowSub: { fontSize: 11, fontWeight: '600', color: '#8E8E93', marginTop: 3, lineHeight: 15 },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 2,
    alignItems: 'center',
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  segmentBtnTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
  },
  segmentBtnTxtActive: {
    color: '#007AFF',
  },
  done: { alignItems: 'center', padding: 12, marginTop: 4 },
  doneTxt: { color: '#007AFF', fontWeight: '800', fontSize: 15 },
  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
    padding: 2,
    alignItems: 'center',
  },
  segmentBtnMini: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnTxtMini: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
  },
  inputCol: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  inputTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    height: 38,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1D1D1F',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
});
