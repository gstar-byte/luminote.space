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
  Platform,
  ScrollView,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Check, Mic, Plus, Send, X, Star, Bell, Search } from 'lucide-react-native';
import type { Capsule } from '../types';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_WIDTH = 290;
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 120,
  mass: 0.8,
};

type Props = {
  capsules: Capsule[];
  onCreateCapsule: (text: string) => Promise<void>;
  onToggleTodo: (id: string, completed: boolean) => void;
  onSelectCapsule: (capsule: Capsule) => void;
  isProcessing: boolean;
  isVoiceRecording: boolean;
  startVoice: () => Promise<void>;
  limit: number;
};

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

const CATEGORY_TABS = ['all', 'Work', 'Personal', 'Ideas', 'Finance', 'Health', 'Social', 'Learning'];

export function EdgeMiniPanel({
  capsules,
  onCreateCapsule,
  onToggleTodo,
  onSelectCapsule,
  isProcessing,
  isVoiceRecording,
  startVoice,
  limit,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Reanimated shared values
  const translateX = useSharedValue(PANEL_WIDTH);

  // Sync state to JS thread
  const togglePanelState = (open: boolean) => {
    setIsOpen(open);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openPanel = () => {
    'worklet';
    translateX.value = withSpring(0, SPRING_CONFIG);
    runOnJS(togglePanelState)(true);
  };

  const closePanel = () => {
    'worklet';
    translateX.value = withSpring(PANEL_WIDTH, SPRING_CONFIG);
    runOnJS(togglePanelState)(false);
  };

  // Drag Gesture
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      const currentX = isOpen ? 0 : PANEL_WIDTH;
      const nextX = currentX + event.translationX;
      if (nextX >= 0 && nextX <= PANEL_WIDTH) {
        translateX.value = nextX;
      }
    })
    .onEnd((event) => {
      const threshold = PANEL_WIDTH * 0.4;
      const isDraggingLeft = event.velocityX < -300;
      const isDraggingRight = event.velocityX > 300;
      
      if (isOpen) {
        if (translateX.value > threshold || isDraggingRight) {
          closePanel();
        } else {
          openPanel();
        }
      } else {
        if (translateX.value < PANEL_WIDTH - threshold || isDraggingLeft) {
          openPanel();
        } else {
          closePanel();
        }
      }
    });

  const animatedPanelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const animatedBackdropStyle = useAnimatedStyle(() => {
    const opacity = (PANEL_WIDTH - translateX.value) / PANEL_WIDTH * 0.45;
    return {
      opacity: opacity,
      display: translateX.value >= PANEL_WIDTH ? 'none' : 'flex',
    };
  });

  // Filter & Search Logic
  const filteredCapsules = capsules
    .filter(c => !c.isArchived && !c.isDeleted)
    .filter(c => {
      if (selectedCategory === 'all') return true;
      return c.category === selectedCategory;
    })
    .filter(c => {
      if (!searchText.trim()) return true;
      const contentText = plainTextFromContent(c.content).toLowerCase();
      const subjectText = (c.subject || '').toLowerCase();
      return contentText.includes(searchText.toLowerCase()) || subjectText.includes(searchText.toLowerCase());
    })
    .slice(0, limit);

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const txt = inputText;
    setInputText('');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onCreateCapsule(txt);
  };

  const handleCategoryPress = (cat: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <GestureDetector gesture={Gesture.Tap().onEnd(closePanel)}>
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
      </GestureDetector>

      {/* Floating Edge Handle */}
      {!isOpen && (
        <GestureDetector gesture={panGesture}>
          <TouchableOpacity
            style={[styles.floatingHandle, { top: SCREEN_HEIGHT * 0.42 }]}
            activeOpacity={0.8}
            onPress={() => {
              'worklet';
              openPanel();
            }}
          >
            <View style={styles.handleIndicator} />
          </TouchableOpacity>
        </GestureDetector>
      )}

      {/* Slide-out Sidebar Panel */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.panel, animatedPanelStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>LUMI PANEL</Text>
              <Text style={styles.headerSub}>Quick Workspace</Text>
            </View>
            <TouchableOpacity onPress={() => { closePanel(); }} hitSlop={12}>
              <X size={18} color="#1D1D1F" />
            </TouchableOpacity>
          </View>

          {/* Search bar inside panel */}
          <View style={styles.searchContainer}>
            <Search size={14} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recent notes..."
              placeholderTextColor="#8E8E93"
              value={searchText}
              onChangeText={setSearchText}
              clearButtonMode="while-editing"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} hitSlop={8}>
                <X size={14} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Quick Tabs */}
          <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              {CATEGORY_TABS.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.tab, isActive && styles.tabActive]}
                    onPress={() => handleCategoryPress(cat)}
                  >
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {cat === 'all' ? 'All' : cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Recent Notes List */}
          <View style={styles.body}>
            {filteredCapsules.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTxt}>No notes found.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredCapsules}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const hasReminder = item.reminder && item.reminder.type !== 'none';
                  return (
                    <TouchableOpacity
                      style={[styles.miniCard, { backgroundColor: item.color || '#F2F2F7' }]}
                      onPress={() => {
                        onSelectCapsule(item);
                        closePanel();
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          {item.isTodo && (
                            <TouchableOpacity
                              style={[styles.checkBox, item.completed && styles.checkBoxChecked]}
                              onPress={() => {
                                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                onToggleTodo(item.id, !item.completed);
                              }}
                            >
                              {item.completed && <Check size={8} color="#FFF" strokeWidth={3} />}
                            </TouchableOpacity>
                          )}
                          
                          {/* Subject / Title */}
                          <Text
                            style={[styles.cardTxt, item.completed && styles.cardTxtDone]}
                            numberOfLines={1}
                          >
                            {item.subject ? item.subject : plainTextFromContent(item.content)}
                          </Text>
                        </View>

                        {/* Detail text snippet if subject is present */}
                        {item.subject ? (
                          <Text style={styles.cardDetailTxt} numberOfLines={1}>
                            {plainTextFromContent(item.content)}
                          </Text>
                        ) : null}

                        {/* Bottom Row inside Card (Category pill & Meta indicators) */}
                        <View style={styles.cardBottom}>
                          {item.category ? (
                            <View style={styles.categoryPill}>
                              <Text style={styles.categoryPillTxt}>{item.category}</Text>
                            </View>
                          ) : null}

                          <View style={styles.metaIcons}>
                            {item.isStarred && <Star size={9} color="#FFB800" fill="#FFB800" style={styles.metaIcon} />}
                            {hasReminder && <Bell size={9} color="#8E8E93" style={styles.metaIcon} />}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>

          {/* Quick Input Bar */}
          <View style={styles.footer}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Capture thought..."
                placeholderTextColor="#8E8E93"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSendText}
                returnKeyType="send"
                editable={!isProcessing}
              />
              
              {isProcessing ? (
                <ActivityIndicator size="small" color="#007AFF" style={styles.footerIcon} />
              ) : inputText.trim().length > 0 ? (
                <TouchableOpacity onPress={handleSendText} style={styles.footerIcon} hitSlop={8}>
                  <Send size={18} color="#007AFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    startVoice();
                  }}
                  style={[styles.footerIcon, isVoiceRecording && styles.micRecording]}
                  hitSlop={8}
                >
                  <Mic size={18} color={isVoiceRecording ? '#FFF' : '#8E8E93'} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  floatingHandle: {
    position: 'absolute',
    right: 0,
    width: 24,
    height: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  handleIndicator: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: 'rgba(142, 142, 147, 0.5)',
  },
  panel: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.075,
    right: 0,
    width: PANEL_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -4, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
    padding: 16,
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1D1D1F',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 9,
    color: '#8E8E93',
    fontWeight: '700',
    marginTop: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 36,
    marginTop: 8,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1D1D1F',
    fontWeight: '600',
    paddingVertical: 4,
  },
  tabsContainer: {
    height: 28,
    marginTop: 10,
    marginBottom: 4,
  },
  tabsScroll: {
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 6,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  tabActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tabText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#FFF',
  },
  body: {
    flex: 1,
    paddingTop: 10,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTxt: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  miniCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  checkBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  checkBoxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  cardTxt: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#1D1D1F',
  },
  cardTxtDone: {
    textDecorationLine: 'line-through',
    opacity: 0.45,
  },
  cardDetailTxt: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 13,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  categoryPillTxt: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaIcons: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  metaIcon: {
    marginLeft: 3,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
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
    fontSize: 14,
    color: '#1D1D1F',
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  footerIcon: {
    padding: 6,
  },
  micRecording: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
  },
});
