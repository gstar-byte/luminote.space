import React, { useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Check, Mic, Send, X, Star, Bell } from 'lucide-react-native';
import type { Capsule } from '../types';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = {
  visible: boolean;
  onClose: () => void;
  capsules: Capsule[];
  onCreateCapsule: (text: string) => Promise<void>;
  onToggleTodo: (id: string, completed: boolean) => void;
  isProcessing: boolean;
  isVoiceRecording: boolean;
  startVoice: (isReleaseTrigger?: boolean) => Promise<void>;
  limit: number;
};

// Helper to extract clean plain text for mini items
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

export function QuickCaptureModal({
  visible,
  onClose,
  capsules,
  onCreateCapsule,
  onToggleTodo,
  isProcessing,
  isVoiceRecording,
  startVoice,
  limit,
}: Props) {
  const [inputText, setInputText] = useState('');

  const recentCapsules = capsules
    .filter(c => !c.isArchived && !c.isDeleted)
    .slice(0, limit);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const txt = inputText;
    setInputText('');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onCreateCapsule(txt);
  };

  const handleClose = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
          >
            {/* Modal Box */}
            <View style={styles.dialogBox}>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.headerTitle}>QUICK CAPTURE</Text>
                  <Text style={styles.headerSubtitle}>Capture your spark instantly</Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                  <X size={20} color="#1D1D1F" />
                </TouchableOpacity>
              </View>

              {/* Body (Latest Entries) */}
              <View style={styles.body}>
                <Text style={styles.secLabel}>RECENT ENTRIES</Text>
                {recentCapsules.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTxt}>No recent entries</Text>
                  </View>
                ) : (
                  <FlatList
                    data={recentCapsules}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={recentCapsules.length > 3}
                    style={{ maxHeight: 220 }}
                    renderItem={({ item }) => {
                      const hasReminder = item.reminder && item.reminder.type !== 'none';
                      return (
                        <View style={[styles.miniCard, { backgroundColor: item.color || '#F2F2F7' }]}>
                          {item.isTodo && (
                            <TouchableOpacity
                              style={[styles.checkBox, item.completed && styles.checkBoxChecked]}
                              onPress={() => {
                                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                onToggleTodo(item.id, !item.completed);
                              }}
                            >
                              {item.completed && <Check size={10} color="#FFF" strokeWidth={3} />}
                            </TouchableOpacity>
                          )}
                          <Text
                            style={[styles.cardTxt, item.completed && styles.cardTxtDone]}
                            numberOfLines={1}
                          >
                            {plainTextFromContent(item.content)}
                          </Text>
                          <View style={styles.metaIcons}>
                            {item.isStarred && <Star size={10} color="#FFB800" fill="#FFB800" style={styles.metaIcon} />}
                            {hasReminder && <Bell size={10} color="#8E8E93" style={styles.metaIcon} />}
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
              </View>

              {/* Bottom Input Area */}
              <View style={styles.footer}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type or record..."
                    placeholderTextColor="#8E8E93"
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                    editable={!isProcessing}
                    autoFocus
                  />

                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#007AFF" style={styles.actionBtn} />
                  ) : inputText.trim().length > 0 ? (
                    <TouchableOpacity onPress={handleSend} style={styles.actionBtn} hitSlop={8}>
                      <Send size={18} color="#007AFF" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPressIn={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (!isVoiceRecording) {
                          void startVoice();
                        } else {
                          void startVoice(false);
                        }
                      }}
                      onPressOut={() => {
                        void startVoice(true);
                      }}
                      style={[styles.actionBtn, isVoiceRecording && styles.micRecording]}
                      hitSlop={8}
                    >
                      <Mic size={18} color={isVoiceRecording ? '#FFF' : '#8E8E93'} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
  },
  dialogBox: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1D1D1F',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    marginBottom: 20,
  },
  secLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 10,
  },
  emptyWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTxt: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
  },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  checkBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkBoxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  cardTxt: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#1D1D1F',
  },
  cardTxtDone: {
    textDecorationLine: 'line-through',
    opacity: 0.45,
  },
  metaIcons: {
    flexDirection: 'row',
    marginLeft: 6,
  },
  metaIcon: {
    marginLeft: 3,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#1D1D1F',
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionBtn: {
    padding: 6,
  },
  micRecording: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
  },
});
