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
import { getLearnedTime } from '../lib/reminderLearning';

interface Props {
  capsule: Capsule;
  onResolve: (updates: Partial<Capsule>) => void;
  onCustomPress: () => void;
}

/** 计算下一个指定星期几和小时的日期 */
function getNextDayOfWeekAndTime(dayOfWeek: number, hours: number, minutes: number): Date {
  const now = new Date();
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  const currentDay = now.getDay();
  let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  if (daysToAdd === 0 && result.getTime() <= now.getTime()) {
    daysToAdd = 7;
  }
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

function formatTimeLabel(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`;
  return `${displayHour}${displayMinute} ${ampm}`;
}

type QuickType = 'today' | 'tomorrow' | 'dayafter' | 'sat-am' | 'sat-pm' | 'sun-am' | 'sun-pm' | 'todo' | 'everyday' | 'everyweek' | 'justnote';

export function ClarificationPillMobile({ capsule, onResolve, onCustomPress }: Props) {
  if (!capsule.isAmbiguous) return null;

  // 状态：动态习得的小时/分钟
  const [learnedMorning, setLearnedMorning] = useState({ hour: 9, minute: 0 });
  const [learnedAfternoon, setLearnedAfternoon] = useState({ hour: 14, minute: 0 });
  const [learnedEvening, setLearnedEvening] = useState({ hour: 18, minute: 0 });

  // 入场和呼吸动画
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 异步加载用户习惯时间偏好
    async function loadLearnedTimes() {
      const m = await getLearnedTime('morning');
      const a = await getLearnedTime('afternoon');
      const e = await getLearnedTime('evening');
      setLearnedMorning(m);
      setLearnedAfternoon(a);
      setLearnedEvening(e);
    }
    void loadLearnedTimes();

    Animated.spring(slideAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

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
      const todayTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate(), learnedEvening.hour, learnedEvening.minute, 0, 0);
      // 如果计算的晚上时刻已过，顺延3小时
      if (todayTarget.getTime() <= now.getTime()) {
        todayTarget.setHours(todayTarget.getHours() + 3);
      }
      reminderUpdate = { type: 'once', date: todayTarget.getTime() };
    } else if (type === 'tomorrow') {
      const tomorrowTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, learnedMorning.hour, learnedMorning.minute, 0, 0);
      reminderUpdate = { type: 'once', date: tomorrowTarget.getTime() };
    } else if (type === 'dayafter') {
      const dayAfterTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, learnedMorning.hour, learnedMorning.minute, 0, 0);
      reminderUpdate = { type: 'once', date: dayAfterTarget.getTime() };
    } else if (type === 'sat-am') {
      reminderUpdate = { type: 'once', date: getNextDayOfWeekAndTime(6, learnedMorning.hour, learnedMorning.minute).getTime() };
    } else if (type === 'sat-pm') {
      reminderUpdate = { type: 'once', date: getNextDayOfWeekAndTime(6, learnedAfternoon.hour, learnedAfternoon.minute).getTime() };
    } else if (type === 'sun-am') {
      reminderUpdate = { type: 'once', date: getNextDayOfWeekAndTime(0, learnedMorning.hour, learnedMorning.minute).getTime() };
    } else if (type === 'sun-pm') {
      reminderUpdate = { type: 'once', date: getNextDayOfWeekAndTime(0, learnedAfternoon.hour, learnedAfternoon.minute).getTime() };
    } else if (type === 'everyday') {
      const dailyTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate(), learnedEvening.hour, learnedEvening.minute, 0, 0);
      if (dailyTarget.getTime() <= now.getTime()) {
        dailyTarget.setDate(dailyTarget.getDate() + 1);
      }
      reminderUpdate = { type: 'daily', date: dailyTarget.getTime() };
    } else if (type === 'everyweek') {
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
      nextMon.setHours(learnedMorning.hour, learnedMorning.minute, 0, 0);
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

  // 根据学到的作息，动态组装显示字样
  const chipData: { type: QuickType; label: string; color: string; borderColor: string; icon?: React.ReactNode }[] = [
    { 
      type: 'today', 
      label: `Today ${formatTimeLabel(learnedEvening.hour, learnedEvening.minute)}`, 
      color: '#007AFF', 
      borderColor: '#E5E5EA' 
    },
    { 
      type: 'tomorrow', 
      label: `Tomorrow ${formatTimeLabel(learnedMorning.hour, learnedMorning.minute)}`, 
      color: '#007AFF', 
      borderColor: '#E5E5EA' 
    },
    { 
      type: 'dayafter', 
      label: `Day After ${formatTimeLabel(learnedMorning.hour, learnedMorning.minute)}`, 
      color: '#007AFF', 
      borderColor: '#E5E5EA' 
    },
    { 
      type: 'sat-am', 
      label: `Sat ${formatTimeLabel(learnedMorning.hour, learnedMorning.minute)}`, 
      color: '#007AFF', 
      borderColor: '#E5E5EA' 
    },
    { 
      type: 'sat-pm', 
      label: `Sat ${formatTimeLabel(learnedAfternoon.hour, learnedAfternoon.minute)}`, 
      color: '#007AFF', 
      borderColor: '#E5E5EA' 
    },
    { 
      type: 'sun-am', 
      label: `Sun ${formatTimeLabel(learnedMorning.hour, learnedMorning.minute)}`, 
      color: '#007AFF', 
      borderColor: '#E5E5EA' 
    },
    { 
      type: 'sun-pm', 
      label: `Sun ${formatTimeLabel(learnedAfternoon.hour, learnedAfternoon.minute)}`, 
      color: '#007AFF', 
      borderColor: '#E5E5EA' 
    },
    { 
      type: 'everyday', 
      label: `Every Day ${formatTimeLabel(learnedEvening.hour, learnedEvening.minute)}`, 
      color: '#AF52DE', 
      borderColor: 'rgba(175,82,222,0.15)', 
      icon: <RefreshCw size={9} color="#AF52DE" style={{ marginRight: 2 }} /> 
    },
    { 
      type: 'everyweek', 
      label: `Every Mon ${formatTimeLabel(learnedMorning.hour, learnedMorning.minute)}`, 
      color: '#AF52DE', 
      borderColor: 'rgba(175,82,222,0.15)', 
      icon: <RefreshCw size={9} color="#AF52DE" style={{ marginRight: 2 }} /> 
    },
    { 
      type: 'todo', 
      label: 'Just Todo', 
      color: '#FF3B30', 
      borderColor: 'rgba(255,59,48,0.12)', 
      icon: <CheckSquare size={9} color="#FF3B30" style={{ marginRight: 2 }} /> 
    },
    { 
      type: 'justnote', 
      label: 'Just Note', 
      color: '#8E8E93', 
      borderColor: 'rgba(142,142,147,0.12)', 
      icon: <FileText size={9} color="#8E8E93" style={{ marginRight: 2 }} /> 
    },
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
          <Text style={styles.secLabel}>Smart Settings</Text>
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
