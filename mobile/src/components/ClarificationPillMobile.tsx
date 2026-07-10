import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import { Clock, CheckSquare, FileText, Settings, Star, Pin, RefreshCw } from 'lucide-react-native';
import type { Capsule } from '../types';
import * as Haptics from 'expo-haptics';

interface Props {
  capsule: Capsule;
  onResolve: (updates: Partial<Capsule>) => void;
  onCustomPress: () => void;
}

/** 计算下一个指定星期几和小时的日期 */
function getNextDayOfWeekAndTime(dayOfWeek: number, hours: number): Date {
  const now = new Date();
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, 0, 0, 0);
  const currentDay = now.getDay();
  let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  if (daysToAdd === 0 && result.getTime() <= now.getTime()) {
    daysToAdd = 7;
  }
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

type QuickType = 'today' | 'tomorrow' | 'dayafter' | 'sat-am' | 'sat-pm' | 'sun-am' | 'sun-pm' | 'todo' | 'everyday' | 'everyweek' | 'justnote';

export function ClarificationPillMobile({ capsule, onResolve, onCustomPress }: Props) {
  if (!capsule.isAmbiguous) return null;

  // 入场动画
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Clock 图标呼吸动画
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Clock 呼吸脉冲
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const [withStar, setWithStar] = useState(!!capsule.isStarred);
  const [withPin, setWithPin] = useState(!!capsule.isPinned);

  const handleQuickSelect = (type: QuickType) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = new Date();
    const baseUpdates: Partial<Capsule> = {
      isAmbiguous: false,
      clarificationPrompt: null,
    };
    if (withStar) baseUpdates.isStarred = true;
    if (withPin) baseUpdates.isPinned = true;

    if (type === 'justnote') {
      onResolve({ ...baseUpdates, isTodo: false, reminder: { type: 'none' } });
      return;
    }

    if (type === 'todo') {
      onResolve({ ...baseUpdates, isTodo: true, reminder: { type: 'none' } });
      return;
    }

    let reminderUpdate: any = null;

    if (type === 'today') {
      const todaySix = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
      if (todaySix.getTime() <= now.getTime()) todaySix.setHours(todaySix.getHours() + 3);
      reminderUpdate = { type: 'once', date: todaySix.getTime() };
    } else if (type === 'tomorrow') {
      const tomorrowNine = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
      reminderUpdate = { type: 'once', date: tomorrowNine.getTime() };
    } else if (type === 'dayafter') {
      const dayAfterNine = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 9, 0, 0, 0);
      reminderUpdate = { type: 'once', date: dayAfterNine.getTime() };
    } else if (type === 'sat-am') {
      reminderUpdate = { type: 'once', date: getNextDayOfWeekAndTime(6, 9).getTime() };
    } else if (type === 'sat-pm') {
      reminderUpdate = { type: 'once', date: getNextDayOfWeekAndTime(6, 15).getTime() };
    } else if (type === 'sun-am') {
      reminderUpdate = { type: 'once', date: getNextDayOfWeekAndTime(0, 9).getTime() };
    } else if (type === 'sun-pm') {
      reminderUpdate = { type: 'once', date: getNextDayOfWeekAndTime(0, 15).getTime() };
    } else if (type === 'everyday') {
      const dailyEight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
      if (dailyEight.getTime() <= now.getTime()) dailyEight.setDate(dailyEight.getDate() + 1);
      reminderUpdate = { type: 'daily', date: dailyEight.getTime() };
    } else if (type === 'everyweek') {
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
      nextMon.setHours(9, 0, 0, 0);
      reminderUpdate = { type: 'weekly', date: nextMon.getTime() };
    }

    if (reminderUpdate) {
      onResolve({ ...baseUpdates, isTodo: true, reminder: reminderUpdate });
    }
  };

  const handleStarToggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVal = !withStar;
    setWithStar(newVal);
    // 与 Web 端一致：Star/Pin 立即 resolve
    onResolve({
      isStarred: newVal || undefined,
      isPinned: withPin || undefined,
      isAmbiguous: false,
      clarificationPrompt: null,
    });
  };

  const handlePinToggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVal = !withPin;
    setWithPin(newVal);
    onResolve({
      isStarred: withStar || undefined,
      isPinned: newVal || undefined,
      isAmbiguous: false,
      clarificationPrompt: null,
    });
  };

  const handleCustom = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCustomPress();
  };

  const chipData: { type: QuickType; label: string; color: string; borderColor: string; icon?: React.ReactNode }[] = [
    { type: 'today', label: 'Today 6 PM', color: '#007AFF', borderColor: '#E5E5EA' },
    { type: 'tomorrow', label: 'Tomorrow 9 AM', color: '#007AFF', borderColor: '#E5E5EA' },
    { type: 'dayafter', label: 'Day After 9 AM', color: '#007AFF', borderColor: '#E5E5EA' },
    { type: 'sat-am', label: 'Sat 9 AM', color: '#007AFF', borderColor: '#E5E5EA' },
    { type: 'sat-pm', label: 'Sat 3 PM', color: '#007AFF', borderColor: '#E5E5EA' },
    { type: 'sun-am', label: 'Sun 9 AM', color: '#007AFF', borderColor: '#E5E5EA' },
    { type: 'sun-pm', label: 'Sun 3 PM', color: '#007AFF', borderColor: '#E5E5EA' },
    { type: 'everyday', label: 'Every Day 8 PM', color: '#AF52DE', borderColor: 'rgba(175,82,222,0.15)', icon: <RefreshCw size={9} color="#AF52DE" style={{ marginRight: 2 }} /> },
    { type: 'everyweek', label: 'Every Mon 9 AM', color: '#AF52DE', borderColor: 'rgba(175,82,222,0.15)', icon: <RefreshCw size={9} color="#AF52DE" style={{ marginRight: 2 }} /> },
    { type: 'todo', label: 'Just Todo', color: '#FF3B30', borderColor: 'rgba(255,59,48,0.12)', icon: <CheckSquare size={9} color="#FF3B30" style={{ marginRight: 2 }} /> },
    { type: 'justnote', label: 'Just Note', color: '#8E8E93', borderColor: 'rgba(142,142,147,0.12)', icon: <FileText size={9} color="#8E8E93" style={{ marginRight: 2 }} /> },
  ];

  return (
    <Animated.View style={[
      styles.pillContainer,
      {
        opacity: slideAnim,
        transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      },
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Animated.View style={{ opacity: pulseAnim }}>
            <Clock size={12} color="#007AFF" />
          </Animated.View>
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.secLabel}>Quick Settings</Text>
          <Text style={styles.promptTxt}>
            {capsule.clarificationPrompt || 'Set a reminder, repeat loop, or keep as note?'}
          </Text>
        </View>
      </View>

      {/* Quick Action Chips */}
      <View style={styles.chipsContainer}>
        {chipData.map((chip) => (
          <TouchableOpacity
            key={chip.type}
            style={[styles.chip, { borderColor: chip.borderColor }]}
            activeOpacity={0.7}
            onPress={() => handleQuickSelect(chip.type)}
          >
            {chip.icon}
            <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
          </TouchableOpacity>
        ))}

        {/* Custom */}
        <TouchableOpacity
          style={[styles.chip, { borderColor: 'rgba(52,199,89,0.12)' }]}
          activeOpacity={0.7}
          onPress={handleCustom}
        >
          <Settings size={9} color="#34C759" style={{ marginRight: 2 }} />
          <Text style={[styles.chipText, { color: '#34C759' }]}>Custom</Text>
        </TouchableOpacity>

        {/* Star */}
        <TouchableOpacity
          style={[styles.chip, withStar && styles.chipStarActive]}
          activeOpacity={0.7}
          onPress={handleStarToggle}
        >
          <Star size={9} color={withStar ? '#FF9500' : '#8E8E93'} fill={withStar ? '#FFCC00' : 'transparent'} style={{ marginRight: 2 }} />
          <Text style={[styles.chipText, withStar ? { color: '#FF9500' } : { color: '#8E8E93' }]}>
            {withStar ? 'Starred' : 'Star'}
          </Text>
        </TouchableOpacity>

        {/* Pin */}
        <TouchableOpacity
          style={[styles.chip, withPin && styles.chipPinActive]}
          activeOpacity={0.7}
          onPress={handlePinToggle}
        >
          <Pin size={9} color={withPin ? '#007AFF' : '#8E8E93'} style={{ marginRight: 2 }} />
          <Text style={[styles.chipText, withPin ? { color: '#007AFF' } : { color: '#8E8E93' }]}>
            {withPin ? 'Pinned' : 'Pin'}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  iconBadge: {
    padding: 5,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 6,
    marginTop: 1,
  },
  headerTextWrap: {
    flex: 1,
  },
  secLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptTxt: {
    fontSize: 11,
    color: '#1D1D1F',
    fontWeight: '600',
    marginTop: 1,
    lineHeight: 14,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
  },
  chipStarActive: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderColor: 'rgba(255, 149, 0, 0.25)',
  },
  chipPinActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderColor: 'rgba(0, 122, 255, 0.25)',
  },
});
