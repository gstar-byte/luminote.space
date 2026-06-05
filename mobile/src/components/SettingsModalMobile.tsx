import React from 'react';
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
} from 'react-native';
import { User as UserIcon, X, Sliders } from 'lucide-react-native';
import type { UserProfile, AppSettings } from '../types';
import { PAYWALL_ACTIVE } from '../featureFlags';
import * as Haptics from 'expo-haptics';

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
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.head}>
            <View style={styles.headLeft}>
              <Sliders size={20} color="#007AFF" strokeWidth={2.5} />
              <Text style={styles.title}>Preferences</Text>
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

              {/* Swipe Right Mapping */}
              {settings.swipeEnabled && (
                <View style={styles.rowDivider}>
                  <View style={styles.row}>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowTitle}>Right Swipe Trigger</Text>
                      <Text style={styles.rowSub}>Action triggered when swiping card to the right</Text>
                    </View>
                    <View style={styles.segmentContainer}>
                      {(['archive', 'delete'] as const).map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.segmentBtn,
                            settings.swipeRightAction === opt && styles.segmentBtnActive,
                          ]}
                          onPress={() => handleSegmentChange('swipeRightAction', opt)}
                        >
                          <Text style={[
                            styles.segmentBtnTxt,
                            settings.swipeRightAction === opt && styles.segmentBtnTxtActive
                          ]}>
                            {opt === 'archive' ? 'Archive' : 'Delete'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Section: Floating Panels */}
            <Text style={styles.sectionLbl}>FLOATING PANELS</Text>
            <View style={styles.sectionCard}>
              {/* Edge Mini Panel */}
              <View style={styles.row}>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>Edge Swipe Panel</Text>
                  <Text style={styles.rowSub}>Show a floating handle on screen edge to pull side note widget</Text>
                </View>
                <Switch
                  value={settings.edgePanelEnabled}
                  onValueChange={(val) => handleToggle('edgePanelEnabled', val)}
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFF"
                  ios_backgroundColor="#E5E5EA"
                />
              </View>

              {/* Display Note Count Limit */}
              <View style={styles.rowDivider}>
                <View style={styles.row}>
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowTitle}>Quick Capture Limit</Text>
                    <Text style={styles.rowSub}>Max notes to show in Edge Drawer & Quick Dialog</Text>
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
                        onValueChange={(val) => handleToggle('accessibilityWakeEnabled', val)}
                        trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                        thumbColor="#FFF"
                        ios_backgroundColor="#E5E5EA"
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    backgroundColor: '#F2F2F7',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
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
});
